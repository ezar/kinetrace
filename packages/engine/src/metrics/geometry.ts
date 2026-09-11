/** Vector helpers used by the metric definitions. All angles are in degrees. */

import type { Landmark, Vec3 } from '../types.js';

export const RAD_TO_DEG = 180 / Math.PI;
export const DEG_TO_RAD = Math.PI / 180;

export function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function fromLandmark(landmark: Landmark): Vec3 {
  return { x: landmark.x, y: landmark.y, z: landmark.z };
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scale(a: Vec3, factor: number): Vec3 {
  return { x: a.x * factor, y: a.y * factor, z: a.z * factor };
}

export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  return len < 1e-9 ? { x: 0, y: 0, z: 0 } : scale(a, 1 / len);
}

/** Angle between two vectors, in degrees, always in `[0, 180]`. */
export function angleBetween(a: Vec3, b: Vec3): number {
  const denominator = length(a) * length(b);
  if (denominator < 1e-9) return Number.NaN;
  const cosine = Math.min(1, Math.max(-1, dot(a, b) / denominator));
  return Math.acos(cosine) * RAD_TO_DEG;
}

/**
 * Interior angle at `vertex` formed by the segments to `a` and `b`, in degrees.
 * 180 degrees means the three points are collinear, e.g. a fully extended knee.
 */
export function jointAngle(a: Vec3, vertex: Vec3, b: Vec3): number {
  return angleBetween(subtract(a, vertex), subtract(b, vertex));
}

/**
 * Signed angle from `a` to `b` measured around `axis`, in degrees, in `(-180, 180]`.
 * Positive follows the right-hand rule around `axis`.
 */
export function signedAngleAround(a: Vec3, b: Vec3, axis: Vec3): number {
  const n = normalize(axis);
  const aProjected = subtract(a, scale(n, dot(a, n)));
  const bProjected = subtract(b, scale(n, dot(b, n)));
  if (length(aProjected) < 1e-9 || length(bProjected) < 1e-9) return Number.NaN;
  const unsigned = angleBetween(aProjected, bProjected);
  const sign = Math.sign(dot(cross(aProjected, bProjected), n));
  return sign < 0 ? -unsigned : unsigned;
}

/** Component of `v` with the `axis` direction removed. */
export function projectOntoPlane(v: Vec3, axis: Vec3): Vec3 {
  const n = normalize(axis);
  return subtract(v, scale(n, dot(v, n)));
}

/** Clamp a value into `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Population standard deviation of a sample window. */
export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / values.length;
  return Math.sqrt(variance);
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

/** Default gravity reference: the camera is level and +Y points up. */
export const DEFAULT_GRAVITY_UP: Vec3 = { x: 0, y: 1, z: 0 };
