/**
 * Core data types shared by every stage of the Kinetrace engine.
 *
 * The engine never sees pixels. It consumes landmark frames produced by a pose
 * adapter and produces numbers, events and cues.
 */

/** A single pose landmark. */
export interface Landmark {
  /**
   * X coordinate. Image landmarks are normalised to `[0, 1]` (0 = left edge).
   * World landmarks are in metres, right-handed, origin at the hip midpoint.
   */
  x: number;
  /** Y coordinate. Image: normalised `[0, 1]`, 0 = top edge. World: metres, +Y is up. */
  y: number;
  /** Z coordinate. Image: normalised depth, negative is closer to the camera. World: metres, +Z is anterior. */
  z: number;
  /** Detector confidence that the landmark is visible and not occluded, `[0, 1]`. */
  visibility: number;
}

/** One frame of pose data, as delivered by the pose adapter. */
export interface PoseFrame {
  /** Monotonic frame timestamp in milliseconds. */
  timestampMs: number;
  /** 33 landmarks in normalised image space. */
  image: readonly Landmark[];
  /** 33 landmarks in metres, hip-centred. Empty when the detector produced none. */
  world: readonly Landmark[];
  /**
   * Gravity direction in world landmark space, as a unit vector pointing up.
   * Supplied by `DeviceOrientationEvent` on phones; defaults to `(0, 1, 0)` on
   * laptops, where the camera is assumed to be level.
   */
  gravityUp?: Vec3;
}

/** A 3D vector in metres (world landmarks) or normalised units (image landmarks). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Camera viewpoint an exercise is performed in front of. */
export type ViewOrientation = 'side' | 'front';

/** Which limb a metric is measured on. */
export type BodySide = 'left' | 'right' | 'auto' | 'mean';

/** Result of evaluating one metric on one frame. */
export interface MetricSample {
  /** Metric value in degrees (all v1 metrics are angular). */
  value: number;
  /** Rate of change in degrees per second, smoothed over the recent window. */
  velocity: number;
  /** Standard deviation of `value` over the last second, in degrees. */
  stability: number;
  /** `[0, 1]` confidence derived from the visibility of the landmarks involved. */
  confidence: number;
  /** True when the value had to be computed from image landmarks instead of world landmarks. */
  fromImageSpace: boolean;
}

/** Every metric computed for one frame, keyed by the metric slot names declared by the exercise. */
export interface MetricFrame {
  timestampMs: number;
  /** Overall pose confidence for the frame, `[0, 1]`. */
  poseConfidence: number;
  samples: Readonly<Record<string, MetricSample>>;
}
