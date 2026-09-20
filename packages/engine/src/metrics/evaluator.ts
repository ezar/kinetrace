/**
 * Turns raw pose frames into smoothed, confidence-scored metric values.
 *
 * Pipeline per frame: One Euro filter on every landmark coordinate, space
 * selection (3D world landmarks when the required landmarks are visible enough,
 * 2D image landmarks otherwise), metric evaluation, then derived signals
 * (velocity over the smoothed value, stability over a one second window).
 */

import type { BodySide, Landmark, MetricFrame, MetricSample, PoseFrame, Vec3 } from '../types.js';
import type { ViewOrientation } from '../types.js';
import { LandmarkFilter, OneEuroFilter, REHAB_FILTER_PARAMS } from '../filter/oneEuro.js';
import { POSE_LANDMARK, type PoseLandmarkName } from '../pose/landmarks.js';
import {
  buildBodyFrame,
  getMetricDefinition,
  type BodyFrame,
  type MetricId,
} from './definitions.js';
import {
  clamp,
  cross,
  midpoint,
  normalize,
  standardDeviation,
  subtract,
  DEFAULT_GRAVITY_UP,
} from './geometry.js';

/** A metric slot declared by an exercise: which metric, measured on which side. */
export interface MetricSpec {
  id: MetricId;
  side: BodySide;
  /** Report the absolute value, for metrics whose sign only indicates a direction. */
  absolute?: boolean;
  /** Metric specific options, passed through to the metric definition. */
  options?: Record<string, string | number>;
}

export interface MetricEvaluatorOptions {
  /** View the exercise is performed in; metrics measured outside their preferred view lose confidence. */
  view: ViewOrientation;
  /** Window used for the stability (standard deviation) signal, in milliseconds. */
  stabilityWindowMs?: number;
  /** Minimum landmark visibility required to trust the 3D world landmarks. */
  worldVisibilityThreshold?: number;
}

const DEFAULT_STABILITY_WINDOW_MS = 1000;
const DEFAULT_WORLD_VISIBILITY_THRESHOLD = 0.6;
/** Confidence multiplier applied when a metric is computed outside its preferred view. */
const OFF_VIEW_CONFIDENCE = 0.8;
/** Confidence multiplier applied when a metric falls back to 2D image landmarks. */
const IMAGE_SPACE_CONFIDENCE = 0.7;
/**
 * Lateral axis used when the hip and shoulder lines both collapse, which happens
 * in a pure side view in 2D image space. The camera axis is then the best
 * available approximation of the subject's lateral axis.
 */
const FALLBACK_LATERAL: Vec3 = { x: 0, y: 0, z: 1 };

interface SlotState {
  spec: MetricSpec;
  filter: OneEuroFilter;
  history: Array<{ timestampMs: number; value: number }>;
  lastSide: 'left' | 'right';
}

const NAN_SAMPLE: MetricSample = {
  value: Number.NaN,
  velocity: 0,
  stability: 0,
  confidence: 0,
  fromImageSpace: false,
};

export class MetricEvaluator {
  private readonly worldFilter = new LandmarkFilter(REHAB_FILTER_PARAMS);
  private readonly imageFilter = new LandmarkFilter(REHAB_FILTER_PARAMS);
  private readonly slots = new Map<string, SlotState>();
  private readonly stabilityWindowMs: number;
  private readonly worldVisibilityThreshold: number;

  constructor(
    specs: Readonly<Record<string, MetricSpec>>,
    private readonly options: MetricEvaluatorOptions,
  ) {
    this.stabilityWindowMs = options.stabilityWindowMs ?? DEFAULT_STABILITY_WINDOW_MS;
    this.worldVisibilityThreshold =
      options.worldVisibilityThreshold ?? DEFAULT_WORLD_VISIBILITY_THRESHOLD;
    for (const [name, spec] of Object.entries(specs)) {
      this.slots.set(name, {
        spec,
        filter: new OneEuroFilter(REHAB_FILTER_PARAMS),
        history: [],
        lastSide: spec.side === 'right' ? 'right' : 'left',
      });
    }
  }

  reset(): void {
    this.worldFilter.reset();
    this.imageFilter.reset();
    for (const slot of this.slots.values()) {
      slot.filter.reset();
      slot.history = [];
    }
  }

  update(frame: PoseFrame): MetricFrame {
    const hasWorld = frame.world.length >= 33;
    const image = this.imageFilter.filter(frame.image, frame.timestampMs);
    const world = hasWorld ? this.worldFilter.filter(frame.world, frame.timestampMs) : [];

    const samples: Record<string, MetricSample> = {};
    for (const [name, slot] of this.slots) {
      samples[name] = this.evaluateSlot(slot, frame, image, world);
    }

    return {
      timestampMs: frame.timestampMs,
      poseConfidence: poseConfidence(image),
      samples,
    };
  }

  private evaluateSlot(
    slot: SlotState,
    frame: PoseFrame,
    image: readonly Landmark[],
    world: readonly Landmark[],
  ): MetricSample {
    const definition = getMetricDefinition(slot.spec.id);
    const sides = this.resolveSides(slot, image);
    const required = sides.flatMap((side) => definition.landmarks(side));
    const visibility = meanVisibility(image, required);

    const useWorld = world.length > 0 && visibility >= this.worldVisibilityThreshold;
    const landmarks = useWorld ? world : image;
    const point = (name: PoseLandmarkName): Vec3 => {
      const landmark = landmarks[POSE_LANDMARK[name]];
      if (!landmark) return { x: 0, y: 0, z: 0 };
      // Image landmark depth is not metric; flatten to 2D and flip Y so that +Y is up.
      return useWorld
        ? { x: landmark.x, y: landmark.y, z: landmark.z }
        : { x: landmark.x, y: -landmark.y, z: 0 };
    };

    const bodyFrame = buildBodyFrame(point) ?? fallbackBodyFrame(point);
    const gravityUp = useWorld ? (frame.gravityUp ?? DEFAULT_GRAVITY_UP) : DEFAULT_GRAVITY_UP;

    let sum = 0;
    for (const side of sides) {
      const raw = definition.compute({
        point,
        gravityUp,
        frame: bodyFrame,
        side,
        options: slot.spec.options ?? {},
      });
      if (!Number.isFinite(raw)) {
        slot.filter.reset();
        slot.history = [];
        return NAN_SAMPLE;
      }
      sum += raw;
    }
    const mean = sum / sides.length;
    const raw = slot.spec.absolute ? Math.abs(mean) : mean;

    const value = slot.filter.filter(raw, frame.timestampMs);
    slot.history.push({ timestampMs: frame.timestampMs, value });
    const windowStart = frame.timestampMs - this.stabilityWindowMs;
    while (slot.history.length > 0 && (slot.history[0]?.timestampMs ?? 0) < windowStart) {
      slot.history.shift();
    }

    const viewFactor =
      definition.preferredView === 'any' || definition.preferredView === this.options.view
        ? 1
        : OFF_VIEW_CONFIDENCE;
    const spaceFactor = useWorld ? 1 : IMAGE_SPACE_CONFIDENCE;

    return {
      value,
      velocity: slot.filter.derivative,
      stability: standardDeviation(slot.history.map((entry) => entry.value)),
      confidence: clamp(visibility * viewFactor * spaceFactor, 0, 1),
      fromImageSpace: !useWorld,
    };
  }

  /**
   * Resolve the sides a slot is measured on. `auto` picks the side whose
   * landmarks are better visible, with hysteresis so that the tracked side does
   * not flip frame to frame; `mean` averages both sides.
   */
  private resolveSides(slot: SlotState, image: readonly Landmark[]): Array<'left' | 'right'> {
    const { side } = slot.spec;
    const definition = getMetricDefinition(slot.spec.id);
    if (!definition.bilateral) return ['left'];
    if (side === 'left' || side === 'right') return [side];
    if (side === 'mean') return ['left', 'right'];
    // The landmarks that tell the sides apart, which for a metric reading the
    // anatomical frame is not the same list as the one that must be visible:
    // that one carries the whole torso, and the far side's shoulder and hip
    // say nothing about which side the camera sees better.
    const discriminating = definition.sideLandmarks ?? definition.landmarks;
    const left = meanVisibility(image, discriminating('left'));
    const right = meanVisibility(image, discriminating('right'));
    const HYSTERESIS = 0.08;
    const chosen: 'left' | 'right' =
      slot.lastSide === 'left'
        ? right > left + HYSTERESIS
          ? 'right'
          : 'left'
        : left > right + HYSTERESIS
          ? 'left'
          : 'right';
    slot.lastSide = chosen;
    return [chosen];
  }
}

/**
 * Frame used when the hip and shoulder lines both collapse, which happens in a
 * pure side view in 2D image space.
 */
function fallbackBodyFrame(point: (name: PoseLandmarkName) => Vec3): BodyFrame {
  const hipMid = midpoint(point('LEFT_HIP'), point('RIGHT_HIP'));
  const shoulderMid = midpoint(point('LEFT_SHOULDER'), point('RIGHT_SHOULDER'));
  const up = normalize(subtract(shoulderMid, hipMid));
  return {
    up,
    lateral: FALLBACK_LATERAL,
    anterior: normalize(cross(FALLBACK_LATERAL, up)),
    hipMid,
    shoulderMid,
  };
}

export function meanVisibility(
  landmarks: readonly Landmark[],
  names: readonly PoseLandmarkName[],
): number {
  if (names.length === 0) return 0;
  let sum = 0;
  for (const name of names) {
    sum += landmarks[POSE_LANDMARK[name]]?.visibility ?? 0;
  }
  return sum / names.length;
}

/** Overall pose confidence: the mean visibility of the torso and limb landmarks. */
export function poseConfidence(landmarks: readonly Landmark[]): number {
  const names: PoseLandmarkName[] = [
    'LEFT_SHOULDER',
    'RIGHT_SHOULDER',
    'LEFT_HIP',
    'RIGHT_HIP',
    'LEFT_KNEE',
    'RIGHT_KNEE',
  ];
  return meanVisibility(landmarks, names);
}
