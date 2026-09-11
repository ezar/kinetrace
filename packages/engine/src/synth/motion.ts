/**
 * Reference motions: a handful of keyframes that describe one repetition.
 *
 * The exercise DSL stores a reference motion per exercise. The library renders
 * it as an animated stick figure, the fixture builder turns it into landmark
 * sequences, and the tests assert the engine's behaviour on those sequences.
 */

import type { Landmark, PoseFrame, Vec3 } from '../types.js';
import { LANDMARK_COUNT } from '../pose/landmarks.js';
import { clamp } from '../metrics/geometry.js';
import {
  lerpPose,
  poseToWorldPoints,
  POSTURES,
  resolvePose,
  sideVisibility,
  type BodyPose,
  type BodyPoseInput,
  type BodyProportions,
  type PostureName,
} from './body.js';

export interface PoseKeyframe {
  /** Position inside the cycle, `[0, 1]`. Keyframes must be sorted. */
  t: number;
  pose: BodyPoseInput;
}

export interface ReferenceMotion {
  posture: PostureName;
  /** Which side of the subject the camera sits on, for side view exercises. */
  cameraSide?: 'left' | 'right';
  /** Joint angles held constant through the cycle. */
  base?: BodyPoseInput;
  /** Keyframes of one repetition, or of the held position for isometrics. */
  keyframes: PoseKeyframe[];
  /** Duration of one repetition, in seconds. */
  cycleSeconds: number;
}

/** Smoothstep, so synthetic movement accelerates and decelerates like a real one. */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Resolve the pose at a position inside the cycle, `[0, 1]`. */
export function samplePose(motion: ReferenceMotion, phase: number): BodyPose {
  const keyframes = motion.keyframes;
  if (keyframes.length === 0) throw new Error('Reference motion has no keyframes');
  const base = resolvePose(motion.base ?? {});
  const resolved = keyframes.map((keyframe) => ({
    t: keyframe.t,
    pose: resolvePose(keyframe.pose, base),
  }));
  const t = clamp(phase, 0, 1);

  const firstFrame = resolved[0];
  const lastFrame = resolved[resolved.length - 1];
  if (!firstFrame || !lastFrame) throw new Error('Reference motion has no keyframes');
  if (t <= firstFrame.t) return firstFrame.pose;
  if (t >= lastFrame.t) return lastFrame.pose;

  for (let index = 0; index < resolved.length - 1; index += 1) {
    const current = resolved[index];
    const next = resolved[index + 1];
    if (!current || !next) break;
    if (t >= current.t && t <= next.t) {
      const span = next.t - current.t;
      const local = span <= 0 ? 0 : (t - current.t) / span;
      return lerpPose(current.pose, next.pose, ease(local));
    }
  }
  return lastFrame.pose;
}

export interface SynthesisOptions {
  view: 'side' | 'front';
  /** Number of repetitions to generate. */
  cycles?: number;
  /** Frame rate of the synthetic camera, in frames per second. */
  fps?: number;
  /** Standard deviation of the landmark noise, in metres. */
  noiseMetres?: number;
  /** Deterministic seed for the noise generator. */
  seed?: number;
  /** Timestamp of the first frame, in milliseconds. */
  startTimestampMs?: number;
  /** Multiplier applied to every landmark visibility, to simulate poor detection. */
  visibilityScale?: number;
  /** Perturbation applied to the sampled pose, used to build the error fixtures. */
  modifier?: (pose: BodyPose, phase: number, cycle: number) => BodyPoseInput;
  proportions?: BodyProportions;
  /**
   * For isometric exercises: hold the pose at this position in the cycle for the
   * whole sequence instead of cycling through it.
   */
  holdAtPhase?: number;
  /** Total duration when `holdAtPhase` is used, in seconds. */
  holdSeconds?: number;
  /**
   * Extra seconds appended after the last full cycle, so the engine sees the
   * final repetition return to its resting phase.
   */
  extraSeconds?: number;
}

/** Deterministic pseudo-random generator, so fixtures are reproducible. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000 - 0.5;
  };
}

/** Project world points into normalised image coordinates for the chosen view. */
function project(
  points: readonly Vec3[],
  view: 'side' | 'front',
  cameraSide: 'left' | 'right',
): Array<{ x: number; y: number; z: number }> {
  // Camera basis: `right` is the image +X axis, `up` the image +Y axis before flipping.
  const right: Vec3 =
    view === 'front'
      ? { x: 1, y: 0, z: 0 }
      : cameraSide === 'left'
        ? { x: 0, y: 0, z: -1 }
        : { x: 0, y: 0, z: 1 };
  const depth: Vec3 =
    view === 'front'
      ? { x: 0, y: 0, z: -1 }
      : cameraSide === 'left'
        ? { x: -1, y: 0, z: 0 }
        : { x: 1, y: 0, z: 0 };

  // A 2.2 m tall field of view keeps a standing adult inside the frame with margin.
  const frameHeightMetres = 2.2;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const centreY = (minY + maxY) / 2;

  return points.map((point) => {
    const u = point.x * right.x + point.y * right.y + point.z * right.z;
    const v = point.y - centreY;
    const d = point.x * depth.x + point.y * depth.y + point.z * depth.z;
    return {
      x: 0.5 + u / frameHeightMetres,
      y: 0.5 - v / frameHeightMetres,
      z: d / frameHeightMetres,
    };
  });
}

/** Generate a landmark sequence from a reference motion. */
export function synthesizeFrames(motion: ReferenceMotion, options: SynthesisOptions): PoseFrame[] {
  const fps = options.fps ?? 30;
  const cycles = options.cycles ?? 1;
  const cameraSide = motion.cameraSide ?? 'left';
  const posture = POSTURES[motion.posture];
  const random = createRandom(options.seed ?? 12345);
  const noise = options.noiseMetres ?? 0;
  const visibilityScale = options.visibilityScale ?? 1;
  const startTimestampMs = options.startTimestampMs ?? 0;

  const isHold = options.holdAtPhase !== undefined;
  const totalSeconds = isHold
    ? (options.holdSeconds ?? motion.cycleSeconds)
    : motion.cycleSeconds * cycles + (options.extraSeconds ?? 0);
  const frameCount = Math.max(1, Math.round(totalSeconds * fps));

  const frames: PoseFrame[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    const seconds = index / fps;
    const cycleIndex = isHold ? 0 : Math.floor(seconds / motion.cycleSeconds);
    const phase = isHold
      ? (options.holdAtPhase ?? 0)
      : (seconds % motion.cycleSeconds) / motion.cycleSeconds;

    let pose = samplePose(motion, phase);
    if (options.modifier) {
      pose = resolvePose(
        options.modifier(pose, isHold ? seconds / totalSeconds : phase, cycleIndex),
        pose,
      );
    }

    const world = poseToWorldPoints(pose, posture, options.proportions);
    const noisy = world.map((point) => ({
      x: point.x + random() * noise,
      y: point.y + random() * noise,
      z: point.z + random() * noise,
    }));
    const image = project(noisy, options.view, cameraSide);

    const worldLandmarks: Landmark[] = [];
    const imageLandmarks: Landmark[] = [];
    for (let landmark = 0; landmark < LANDMARK_COUNT; landmark += 1) {
      const visibility = clamp(
        sideVisibility(landmark, options.view, cameraSide) * visibilityScale,
        0,
        1,
      );
      const worldPoint = noisy[landmark] ?? { x: 0, y: 0, z: 0 };
      const imagePoint = image[landmark] ?? { x: 0, y: 0, z: 0 };
      worldLandmarks.push({ ...worldPoint, visibility });
      imageLandmarks.push({ ...imagePoint, visibility });
    }

    frames.push({
      timestampMs: startTimestampMs + Math.round((index / fps) * 1000),
      image: imageLandmarks,
      world: worldLandmarks,
      gravityUp: { x: 0, y: 1, z: 0 },
    });
  }
  return frames;
}
