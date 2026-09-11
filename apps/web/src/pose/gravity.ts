/**
 * Gravity reference.
 *
 * With the phone on the floor leaning on a book, the camera is not level, so
 * "up" in the landmark frame is not the vertical. `DeviceOrientationEvent`
 * gives the tilt, which turns trunk inclination into a real angle against
 * gravity instead of an angle against the camera.
 *
 * On laptops no orientation events arrive and the camera is assumed level; the
 * setup assistant says so.
 */

import type { Vec3 } from '@kinetrace/engine';

export interface GravityReading {
  /** Unit vector pointing away from the ground, in the engine's landmark frame. */
  up: Vec3;
  /** True when the value came from the device rather than the level-camera assumption. */
  measured: boolean;
}

export const LEVEL_CAMERA: GravityReading = { up: { x: 0, y: 1, z: 0 }, measured: false };

const DEG_TO_RAD = Math.PI / 180;

/**
 * Convert a device orientation into the up vector of the landmark frame.
 *
 * Device frame: X to the right of the screen, Y towards its top, Z out of it.
 * The landmark frame has X to the right of the image, Y up and Z towards the
 * camera, so for the front camera the axes line up and for the rear camera the
 * Z axis is reversed.
 */
export function orientationToUp(beta: number, gamma: number, facing: 'user' | 'environment'): Vec3 {
  const b = beta * DEG_TO_RAD;
  const g = gamma * DEG_TO_RAD;
  const up: Vec3 = {
    x: Math.cos(b) * Math.sin(g),
    y: Math.sin(b),
    z: Math.cos(b) * Math.cos(g),
  };
  return facing === 'user' ? up : { x: up.x, y: up.y, z: -up.z };
}

export type GravityListener = (reading: GravityReading) => void;

/**
 * Start listening for device orientation.
 *
 * @returns a function that stops listening.
 */
export function watchGravity(
  facing: 'user' | 'environment',
  onReading: GravityListener,
): () => void {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
    onReading(LEVEL_CAMERA);
    return () => {};
  }

  const handler = (event: DeviceOrientationEvent): void => {
    if (event.beta === null || event.gamma === null) return;
    onReading({ up: orientationToUp(event.beta, event.gamma, facing), measured: true });
  };

  window.addEventListener('deviceorientation', handler);
  return () => window.removeEventListener('deviceorientation', handler);
}

/** iOS requires a user gesture before orientation events are delivered. */
export async function requestGravityPermission(): Promise<boolean> {
  const constructor = (
    window as unknown as {
      DeviceOrientationEvent?: { requestPermission?: () => Promise<'granted' | 'denied'> };
    }
  ).DeviceOrientationEvent;
  if (!constructor?.requestPermission) return true;
  try {
    return (await constructor.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}
