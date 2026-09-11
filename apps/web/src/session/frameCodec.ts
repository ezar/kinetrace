/**
 * Pose frames are packed into a single Float32Array before crossing into the
 * worker, so each frame is one transferable buffer instead of 66 objects.
 *
 * Layout: `[timestampMs, hasGravity, gx, gy, gz, image(33*4), world(33*4)]`,
 * where each landmark is `x, y, z, visibility`. An absent world array is
 * encoded as all zeros and a zero visibility.
 */

import { LANDMARK_COUNT, type Landmark, type PoseFrame } from '@kinetrace/engine';

const HEADER = 5;
const STRIDE = 4;
export const FRAME_FLOATS = HEADER + LANDMARK_COUNT * STRIDE * 2;

export function packFrame(frame: PoseFrame): Float32Array {
  const buffer = new Float32Array(FRAME_FLOATS);
  buffer[0] = frame.timestampMs;
  buffer[1] = frame.gravityUp ? 1 : 0;
  buffer[2] = frame.gravityUp?.x ?? 0;
  buffer[3] = frame.gravityUp?.y ?? 1;
  buffer[4] = frame.gravityUp?.z ?? 0;

  const write = (landmarks: readonly Landmark[], offset: number): void => {
    for (let index = 0; index < LANDMARK_COUNT; index += 1) {
      const landmark = landmarks[index];
      const base = offset + index * STRIDE;
      buffer[base] = landmark?.x ?? 0;
      buffer[base + 1] = landmark?.y ?? 0;
      buffer[base + 2] = landmark?.z ?? 0;
      buffer[base + 3] = landmark?.visibility ?? 0;
    }
  };
  write(frame.image, HEADER);
  write(frame.world, HEADER + LANDMARK_COUNT * STRIDE);
  return buffer;
}

export function unpackFrame(buffer: Float32Array): PoseFrame {
  const read = (offset: number): Landmark[] => {
    const landmarks: Landmark[] = [];
    for (let index = 0; index < LANDMARK_COUNT; index += 1) {
      const base = offset + index * STRIDE;
      landmarks.push({
        x: buffer[base] ?? 0,
        y: buffer[base + 1] ?? 0,
        z: buffer[base + 2] ?? 0,
        visibility: buffer[base + 3] ?? 0,
      });
    }
    return landmarks;
  };

  const world = read(HEADER + LANDMARK_COUNT * STRIDE);
  const hasWorld = world.some((landmark) => landmark.visibility > 0);
  return {
    timestampMs: buffer[0] ?? 0,
    image: read(HEADER),
    world: hasWorld ? world : [],
    gravityUp:
      buffer[1] === 1 ? { x: buffer[2] ?? 0, y: buffer[3] ?? 1, z: buffer[4] ?? 0 } : undefined,
  };
}
