/**
 * Metric definitions.
 *
 * Every metric is an angle in degrees computed from landmarks. Metrics are
 * declared as data so that the exercise DSL can reference them by id and the
 * camera setup assistant can derive which landmarks must be visible.
 *
 * Angle convention: interior joint angles are 180 degrees when the segments are
 * collinear (a straight knee, an extended hip) and decrease with flexion. This
 * is the convention used by the exercise thresholds in the library.
 */

import type { BodySide, Vec3, ViewOrientation } from '../types.js';
import { POSE_LANDMARK, type PoseLandmarkName } from '../pose/landmarks.js';
import {
  angleBetween,
  cross,
  dot,
  jointAngle,
  length,
  midpoint,
  normalize,
  RAD_TO_DEG,
  scale,
  signedAngleAround,
  subtract,
} from './geometry.js';

/** Identifier of a metric supported by the engine. */
export type MetricId =
  | 'kneeFlexion'
  | 'hipFlexion'
  | 'shoulderFlexion'
  | 'shoulderAbduction'
  | 'elbowFlexion'
  | 'trunkInclination'
  | 'pelvisTilt'
  | 'thoracicRotation'
  | 'hipLevelDifference'
  | 'kneeValgus'
  | 'trunkLineDeviation'
  | 'spineFlexion';

/** Anatomical frame of the subject, derived from the torso landmarks. */
export interface BodyFrame {
  /** Unit vector from the hip midpoint to the shoulder midpoint (superior axis). */
  up: Vec3;
  /** Unit vector pointing to the subject's left (lateral axis). */
  lateral: Vec3;
  /** Unit vector pointing out of the subject's chest (anterior axis). */
  anterior: Vec3;
  hipMid: Vec3;
  shoulderMid: Vec3;
}

/** Everything a metric needs to produce one value. */
export interface MetricContext {
  /** Landmark position in the space that was selected for this frame. */
  point: (name: PoseLandmarkName) => Vec3;
  /** Unit vector pointing away from the ground, in the same space as `point`. */
  gravityUp: Vec3;
  frame: BodyFrame;
  /** Concrete side the metric is being computed for. */
  side: 'left' | 'right';
  /** Metric specific options declared by the exercise, e.g. `{ distal: 'knee' }`. */
  options: Readonly<Record<string, string | number>>;
}

export interface MetricDefinition {
  id: MetricId;
  /** Landmarks that must be visible for the metric to be trustworthy. */
  landmarks: (side: 'left' | 'right') => PoseLandmarkName[];
  /** View the metric is most accurate in. Other views still compute, with lower confidence. */
  preferredView: ViewOrientation | 'any';
  /** True when the metric is a single-limb measurement and therefore has a meaningful side. */
  bilateral: boolean;
  /** Human-readable unit, always degrees in v1. */
  unit: 'deg';
  /**
   * The values this metric can physically take, in degrees. Interior joint
   * angles run 0 to 180; signed measurements run either side of zero. Used to
   * bound the prescription a professional can write and the dials that show it,
   * so nobody can be given a target their body cannot express.
   */
  range: { min: number; max: number };
  /** Short description used in the library UI and in generated documentation. */
  description: string;
  compute: (context: MetricContext) => number;
}

function sided(name: string, side: 'left' | 'right'): PoseLandmarkName {
  return `${side === 'left' ? 'LEFT' : 'RIGHT'}_${name}` as PoseLandmarkName;
}

const TORSO: PoseLandmarkName[] = ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP'];

/**
 * Build the anatomical frame from the four torso landmarks.
 * Returns `null` when the torso is degenerate (landmarks collapsed on top of each other).
 */
export function buildBodyFrame(point: (name: PoseLandmarkName) => Vec3): BodyFrame | null {
  const leftShoulder = point('LEFT_SHOULDER');
  const rightShoulder = point('RIGHT_SHOULDER');
  const leftHip = point('LEFT_HIP');
  const rightHip = point('RIGHT_HIP');
  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);

  const up = normalize(subtract(shoulderMid, hipMid));
  const rawLateral = normalize(subtract(leftHip, rightHip));
  if (length(up) < 0.5 || length(rawLateral) < 0.5) return null;

  // Re-orthogonalise the lateral axis against the superior axis.
  const lateral = normalize(subtract(rawLateral, scale(up, dot(rawLateral, up))));
  if (length(lateral) < 0.5) return null;
  const anterior = normalize(cross(lateral, up));
  return { up, lateral, anterior, hipMid, shoulderMid };
}

/** Angle of elevation of the upper arm measured inside a given plane. */
function armElevationInPlane(context: MetricContext, planeNormal: Vec3): number {
  const shoulder = context.point(sided('SHOULDER', context.side));
  const hip = context.point(sided('HIP', context.side));
  const elbow = context.point(sided('ELBOW', context.side));
  const trunkDown = subtract(hip, shoulder);
  const arm = subtract(elbow, shoulder);
  const n = normalize(planeNormal);
  const trunkInPlane = subtract(trunkDown, scale(n, dot(trunkDown, n)));
  const armInPlane = subtract(arm, scale(n, dot(arm, n)));
  return angleBetween(trunkInPlane, armInPlane);
}

const DEFINITIONS: Record<MetricId, MetricDefinition> = {
  kneeFlexion: {
    id: 'kneeFlexion',
    landmarks: (side) => [sided('HIP', side), sided('KNEE', side), sided('ANKLE', side)],
    preferredView: 'side',
    bilateral: true,
    unit: 'deg',
    range: { min: 0, max: 180 },
    description: 'Interior hip-knee-ankle angle. 180 deg is a straight knee.',
    compute: (context) =>
      jointAngle(
        context.point(sided('HIP', context.side)),
        context.point(sided('KNEE', context.side)),
        context.point(sided('ANKLE', context.side)),
      ),
  },

  hipFlexion: {
    id: 'hipFlexion',
    landmarks: (side) => [sided('SHOULDER', side), sided('HIP', side), sided('KNEE', side)],
    preferredView: 'side',
    bilateral: true,
    unit: 'deg',
    range: { min: 0, max: 180 },
    description: 'Interior shoulder-hip-knee angle. 180 deg is a fully extended hip.',
    compute: (context) =>
      jointAngle(
        context.point(sided('SHOULDER', context.side)),
        context.point(sided('HIP', context.side)),
        context.point(sided('KNEE', context.side)),
      ),
  },

  elbowFlexion: {
    id: 'elbowFlexion',
    landmarks: (side) => [sided('SHOULDER', side), sided('ELBOW', side), sided('WRIST', side)],
    preferredView: 'any',
    bilateral: true,
    unit: 'deg',
    range: { min: 0, max: 180 },
    description: 'Interior shoulder-elbow-wrist angle. 180 deg is a straight arm.',
    compute: (context) =>
      jointAngle(
        context.point(sided('SHOULDER', context.side)),
        context.point(sided('ELBOW', context.side)),
        context.point(sided('WRIST', context.side)),
      ),
  },

  shoulderFlexion: {
    id: 'shoulderFlexion',
    landmarks: (side) => [sided('SHOULDER', side), sided('HIP', side), sided('ELBOW', side)],
    preferredView: 'side',
    bilateral: true,
    unit: 'deg',
    range: { min: 0, max: 180 },
    description: 'Arm elevation in the sagittal plane. 0 deg is arm alongside the trunk.',
    compute: (context) => armElevationInPlane(context, context.frame.lateral),
  },

  shoulderAbduction: {
    id: 'shoulderAbduction',
    landmarks: (side) => [sided('SHOULDER', side), sided('HIP', side), sided('ELBOW', side)],
    preferredView: 'front',
    bilateral: true,
    unit: 'deg',
    range: { min: 0, max: 180 },
    description: 'Arm elevation in the frontal plane. 0 deg is arm alongside the trunk.',
    compute: (context) => armElevationInPlane(context, context.frame.anterior),
  },

  trunkInclination: {
    id: 'trunkInclination',
    landmarks: () => TORSO,
    preferredView: 'any',
    bilateral: false,
    unit: 'deg',
    range: { min: 0, max: 180 },
    description: 'Angle of the trunk against gravity. 0 deg is upright, 90 deg is horizontal.',
    compute: (context) => angleBetween(context.frame.up, context.gravityUp),
  },

  pelvisTilt: {
    id: 'pelvisTilt',
    landmarks: () => [...TORSO, 'LEFT_KNEE', 'RIGHT_KNEE'],
    preferredView: 'side',
    bilateral: false,
    unit: 'deg',
    range: { min: -60, max: 60 },
    description:
      'Sagittal angle between the trunk axis and the femur axis. Positive is anterior tilt (the lower back arches away from the mat), negative is posterior tilt.',
    compute: (context) => {
      const { frame } = context;
      const kneeMid = midpoint(context.point('LEFT_KNEE'), context.point('RIGHT_KNEE'));
      const trunk = subtract(frame.shoulderMid, frame.hipMid);
      const femurReversed = subtract(frame.hipMid, kneeMid);
      return -signedAngleAround(trunk, femurReversed, frame.lateral);
    },
  },

  thoracicRotation: {
    id: 'thoracicRotation',
    landmarks: () => TORSO,
    preferredView: 'front',
    bilateral: false,
    unit: 'deg',
    range: { min: -90, max: 90 },
    description:
      'Transverse angle between the shoulder line and the hip line. Positive is rotation towards the subject’s left.',
    compute: (context) => {
      const shoulderLine = subtract(
        context.point('LEFT_SHOULDER'),
        context.point('RIGHT_SHOULDER'),
      );
      const hipLine = subtract(context.point('LEFT_HIP'), context.point('RIGHT_HIP'));
      return signedAngleAround(hipLine, shoulderLine, context.frame.up);
    },
  },

  hipLevelDifference: {
    id: 'hipLevelDifference',
    landmarks: () => ['LEFT_HIP', 'RIGHT_HIP'],
    preferredView: 'front',
    bilateral: false,
    unit: 'deg',
    range: { min: -45, max: 45 },
    description:
      'Tilt of the hip line against the horizontal. Positive means the left hip is higher.',
    compute: (context) => {
      const hipLine = normalize(subtract(context.point('LEFT_HIP'), context.point('RIGHT_HIP')));
      const component = Math.min(1, Math.max(-1, dot(hipLine, context.gravityUp)));
      return Math.asin(component) * RAD_TO_DEG;
    },
  },

  kneeValgus: {
    id: 'kneeValgus',
    landmarks: (side) => [sided('HIP', side), sided('KNEE', side), sided('ANKLE', side)],
    preferredView: 'front',
    bilateral: true,
    unit: 'deg',
    range: { min: -45, max: 45 },
    description:
      'Deviation of the knee from the hip-to-ankle line, in the frontal plane. Positive means the knee falls inwards (valgus).',
    compute: (context) => {
      const hip = context.point(sided('HIP', context.side));
      const knee = context.point(sided('KNEE', context.side));
      const ankle = context.point(sided('ANKLE', context.side));
      const line = subtract(ankle, hip);
      const lineLength = length(line);
      if (lineLength < 1e-6) return Number.NaN;
      const lineDirection = scale(line, 1 / lineLength);
      const toKnee = subtract(knee, hip);
      const along = dot(toKnee, lineDirection);
      const offset = subtract(toKnee, scale(lineDirection, along));
      // `lateral` points to the subject's left, so medial is -lateral on the left leg.
      const medialSign = context.side === 'left' ? -1 : 1;
      const medialOffset = dot(offset, context.frame.lateral) * medialSign;
      const distance = Math.max(Math.abs(along), 1e-6);
      return Math.atan2(medialOffset, distance) * RAD_TO_DEG;
    },
  },

  trunkLineDeviation: {
    id: 'trunkLineDeviation',
    landmarks: () => [...TORSO, 'LEFT_ANKLE', 'RIGHT_ANKLE', 'LEFT_KNEE', 'RIGHT_KNEE'],
    preferredView: 'any',
    bilateral: false,
    unit: 'deg',
    range: { min: -60, max: 60 },
    description:
      'Angle between the shoulder-to-ankle line and the shoulder-to-hip line. Positive means the hips hang below the line (sagging), negative means they are lifted above it (piking). Set the `distal` option to `knee` for exercises supported on the knees.',
    compute: (context) => {
      const { frame, gravityUp } = context;
      const distal = context.options.distal === 'knee' ? 'KNEE' : 'ANKLE';
      const distalMid = midpoint(
        context.point(`LEFT_${distal}` as const),
        context.point(`RIGHT_${distal}` as const),
      );
      const line = subtract(distalMid, frame.shoulderMid);
      const toHip = subtract(frame.hipMid, frame.shoulderMid);
      const lineLength = length(line);
      if (lineLength < 1e-6) return Number.NaN;
      const unsigned = angleBetween(line, toHip);
      const lineDirection = scale(line, 1 / lineLength);
      const along = dot(toHip, lineDirection);
      const perpendicular = subtract(toHip, scale(lineDirection, along));
      const verticalOffset = dot(perpendicular, gravityUp);
      return verticalOffset <= 0 ? unsigned : -unsigned;
    },
  },

  spineFlexion: {
    id: 'spineFlexion',
    landmarks: () => [...TORSO, 'LEFT_KNEE', 'RIGHT_KNEE'],
    preferredView: 'side',
    bilateral: false,
    unit: 'deg',
    range: { min: 0, max: 180 },
    description:
      'Interior angle at the hip midpoint between the shoulder midpoint and the knee midpoint. A proxy for global spine flexion in quadruped positions; 180 deg is a flat back.',
    compute: (context) => {
      const kneeMid = midpoint(context.point('LEFT_KNEE'), context.point('RIGHT_KNEE'));
      return jointAngle(context.frame.shoulderMid, context.frame.hipMid, kneeMid);
    },
  },
};

export const METRIC_DEFINITIONS: Readonly<Record<MetricId, MetricDefinition>> = DEFINITIONS;

export const METRIC_IDS = Object.keys(DEFINITIONS) as MetricId[];

export function getMetricDefinition(id: MetricId): MetricDefinition {
  const definition = DEFINITIONS[id];
  if (!definition) throw new Error(`Unknown metric: ${id}`);
  return definition;
}

/** Landmark indices a metric needs, for the setup assistant. */
export function metricLandmarkIndices(id: MetricId, side: BodySide): number[] {
  const definition = getMetricDefinition(id);
  const sides: Array<'left' | 'right'> =
    side === 'left' || side === 'right' ? [side] : ['left', 'right'];
  const names = new Set<PoseLandmarkName>();
  for (const concreteSide of sides) {
    for (const name of definition.landmarks(concreteSide)) names.add(name);
  }
  return [...names].map((name) => POSE_LANDMARK[name]);
}
