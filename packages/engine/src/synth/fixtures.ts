/**
 * Fixture specifications.
 *
 * A fixture is a landmark sequence the engine is tested against. Two kinds are
 * supported: `recorded`, which carries real landmarks captured from a camera,
 * and `synthetic`, which carries the recipe to rebuild a sequence from an
 * exercise's reference motion. Synthetic fixtures stay a few hundred bytes and
 * are reviewable in a pull request; recorded ones are the ground truth once
 * somebody has a camera and a mat.
 *
 * Both kinds are materialised into the same `PoseFrame[]`, so the tests, the
 * replay tool and the engine never need to know which they are looking at.
 */

import type { Landmark, PoseFrame, ViewOrientation } from '../types.js';
import { clamp, lerp } from '../metrics/geometry.js';
import { lerpPose, resolvePose, type BodyPose, type BodyPoseInput } from './body.js';
import { samplePose, synthesizeFrames, type ReferenceMotion } from './motion.js';

/** A deliberate deviation from the reference movement, used to build error fixtures. */
export type Perturbation =
  /** Replace joint angles, optionally only inside a window of the cycle. */
  | { kind: 'override'; pose: BodyPoseInput; fromPhase?: number; toPhase?: number }
  /**
   * Scale the movement towards its first keyframe. 0.6 turns full repetitions
   * into partials without changing their timing.
   */
  | { kind: 'amplitude'; factor: number };

export interface SyntheticFixtureSpec {
  kind: 'synthetic';
  exerciseId: string;
  /** Short name of the variant, e.g. `good` or `sagging-hips`. */
  variant: string;
  description: string;
  view: ViewOrientation;
  fps: number;
  /** Repetitions to generate. Ignored for holds. */
  cycles?: number;
  /** Duration for hold exercises, in seconds. */
  holdSeconds?: number;
  /** Position in the cycle to hold, for hold exercises. */
  holdAtPhase?: number;
  /** Seconds per repetition, overriding the reference motion's own tempo. */
  cycleSeconds?: number;
  noiseMetres?: number;
  seed?: number;
  perturbations?: Perturbation[];
  /** Window where landmark visibility collapses, to exercise the confidence gate. */
  dropout?: { fromSeconds: number; toSeconds: number; visibilityScale: number };
  expect?: FixtureExpectation;
}

export interface RecordedFixtureSpec {
  kind: 'recorded';
  exerciseId: string;
  variant: string;
  description: string;
  view: ViewOrientation;
  fps: number;
  /** `[timestampMs, ...33 landmarks as x, y, z, visibility]` in world and image space. */
  frames: Array<{
    t: number;
    world: number[][];
    image: number[][];
  }>;
  expect?: FixtureExpectation;
}

export type FixtureSpec = SyntheticFixtureSpec | RecordedFixtureSpec;

/** What the engine should do with the fixture. Asserted by the unit tests. */
export interface FixtureExpectation {
  reps?: number;
  partials?: number;
  /** Hold time the engine should accumulate, in milliseconds, with a tolerance. */
  heldMs?: { atLeast?: number; atMost?: number };
  /** Rule ids that must fire at least once. */
  cues?: string[];
  /** Rule ids that must stay silent. */
  silent?: string[];
  /** The engine must report losing the body. */
  trackingLost?: boolean;
}

function applyPerturbations(
  pose: BodyPose,
  restPose: BodyPose,
  phase: number,
  perturbations: readonly Perturbation[],
): BodyPose {
  let result = pose;
  for (const perturbation of perturbations) {
    if (perturbation.kind === 'amplitude') {
      result = lerpPose(restPose, result, perturbation.factor);
      continue;
    }
    const from = perturbation.fromPhase ?? 0;
    const to = perturbation.toPhase ?? 1;
    if (phase < from || phase > to) continue;
    result = resolvePose(perturbation.pose, result);
  }
  return result;
}

/** Build the pose frames a fixture describes. */
export function materializeFixture(spec: FixtureSpec, reference?: ReferenceMotion): PoseFrame[] {
  if (spec.kind === 'recorded') {
    return spec.frames.map((frame) => ({
      timestampMs: frame.t,
      world: frame.world.map(toLandmark),
      image: frame.image.map(toLandmark),
      gravityUp: { x: 0, y: 1, z: 0 },
    }));
  }
  if (!reference) {
    throw new Error(
      `Synthetic fixture ${spec.exerciseId}/${spec.variant} needs a reference motion`,
    );
  }

  const motion: ReferenceMotion = spec.cycleSeconds
    ? { ...reference, cycleSeconds: spec.cycleSeconds }
    : reference;
  const restPose = samplePose(motion, 0);
  const perturbations = spec.perturbations ?? [];

  const frames = synthesizeFrames(motion, {
    view: spec.view,
    fps: spec.fps,
    cycles: spec.cycles ?? 1,
    // A third of a cycle of tail, so the last repetition returns to its resting
    // phase and gets counted, without starting another one.
    extraSeconds: motion.cycleSeconds / 3,
    noiseMetres: spec.noiseMetres ?? 0,
    seed: spec.seed ?? 1,
    ...(spec.holdSeconds === undefined
      ? {}
      : { holdSeconds: spec.holdSeconds, holdAtPhase: spec.holdAtPhase ?? 0 }),
    modifier: perturbations.length
      ? (pose, phase) => applyPerturbations(pose, restPose, phase, perturbations)
      : undefined,
  });

  if (!spec.dropout) return frames;
  const { fromSeconds, toSeconds, visibilityScale } = spec.dropout;
  return frames.map((frame) => {
    const seconds = frame.timestampMs / 1000;
    if (seconds < fromSeconds || seconds > toSeconds) return frame;
    const scale = (landmark: Landmark): Landmark => ({
      ...landmark,
      visibility: clamp(landmark.visibility * visibilityScale, 0, 1),
    });
    return { ...frame, image: frame.image.map(scale), world: frame.world.map(scale) };
  });
}

function toLandmark(values: number[]): Landmark {
  return {
    x: values[0] ?? 0,
    y: values[1] ?? 0,
    z: values[2] ?? 0,
    visibility: values[3] ?? 0,
  };
}

/** Convert frames into the compact array form used by recorded fixtures. */
export function serializeFrames(
  frames: readonly PoseFrame[],
  decimals = 4,
): RecordedFixtureSpec['frames'] {
  const round = (value: number): number => Number(value.toFixed(decimals));
  const pack = (landmarks: readonly Landmark[]): number[][] =>
    landmarks.map((landmark) => [
      round(landmark.x),
      round(landmark.y),
      round(landmark.z),
      round(landmark.visibility),
    ]);
  return frames.map((frame) => ({
    t: frame.timestampMs,
    world: pack(frame.world),
    image: pack(frame.image),
  }));
}

/** Linear interpolation re-exported for fixture authors writing custom ramps. */
export { lerp };
