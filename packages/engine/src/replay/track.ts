/**
 * Skeleton tracks.
 *
 * Kinetrace stores skeletons, never pixels. A track is the landmark sequence of
 * one set, resampled to 15 fps and quantised to 16-bit, which is enough to
 * replay the movement as a stick figure and to plot the angle trace, and small
 * enough to keep months of sessions in IndexedDB.
 *
 * Quantisation: positions are clamped to +/- 2 m around the hip midpoint and
 * mapped onto a 16-bit integer range, so the worst case error is about 0.06 mm.
 */

import type { Landmark, PoseFrame } from '../types.js';
import { LANDMARK_COUNT } from '../pose/landmarks.js';
import { clamp } from '../metrics/geometry.js';

/** Frames per second a track is resampled to before storage. */
export const TRACK_FPS = 15;
/** Half-range of the quantised coordinate space, in metres. */
const RANGE_METRES = 2;
const SCALE = 32767 / RANGE_METRES;

export interface SkeletonTrack {
  /** Sampling rate of the stored frames, in frames per second. */
  fps: number;
  /** Number of stored frames. */
  frameCount: number;
  /** Quantised world landmark coordinates, `frameCount * 33 * 3` values. */
  positions: Int16Array;
  /** Landmark visibility quantised to a byte, `frameCount * 33` values. */
  visibility: Uint8Array;
  /** Timestamp of the first frame, in milliseconds since the epoch. */
  startedAt: number;
}

export class TrackRecorder {
  private readonly positions: number[] = [];
  private readonly visibility: number[] = [];
  private frameCount = 0;
  private lastSampleMs: number | null = null;
  private startedAt: number | null = null;

  constructor(private readonly fps: number = TRACK_FPS) {}

  /** Feed a pose frame. Frames arriving faster than the track rate are dropped. */
  add(frame: PoseFrame, wallClockMs: number = Date.now()): void {
    const intervalMs = 1000 / this.fps;
    if (this.lastSampleMs !== null && frame.timestampMs - this.lastSampleMs < intervalMs - 1) {
      return;
    }
    this.lastSampleMs = frame.timestampMs;
    this.startedAt ??= wallClockMs;

    const source = frame.world.length >= LANDMARK_COUNT ? frame.world : frame.image;
    for (let index = 0; index < LANDMARK_COUNT; index += 1) {
      const landmark = source[index];
      this.positions.push(
        quantise(landmark?.x ?? 0),
        quantise(landmark?.y ?? 0),
        quantise(landmark?.z ?? 0),
      );
      this.visibility.push(Math.round(clamp(landmark?.visibility ?? 0, 0, 1) * 255));
    }
    this.frameCount += 1;
  }

  finish(): SkeletonTrack {
    return {
      fps: this.fps,
      frameCount: this.frameCount,
      positions: Int16Array.from(this.positions),
      visibility: Uint8Array.from(this.visibility),
      startedAt: this.startedAt ?? Date.now(),
    };
  }
}

function quantise(value: number): number {
  return Math.round(clamp(value, -RANGE_METRES, RANGE_METRES) * SCALE);
}

function dequantise(value: number): number {
  return value / SCALE;
}

/** Read one frame back out of a track. */
export function trackFrame(track: SkeletonTrack, index: number): Landmark[] {
  const frame: Landmark[] = [];
  const base = index * LANDMARK_COUNT * 3;
  const visibilityBase = index * LANDMARK_COUNT;
  for (let landmark = 0; landmark < LANDMARK_COUNT; landmark += 1) {
    frame.push({
      x: dequantise(track.positions[base + landmark * 3] ?? 0),
      y: dequantise(track.positions[base + landmark * 3 + 1] ?? 0),
      z: dequantise(track.positions[base + landmark * 3 + 2] ?? 0),
      visibility: (track.visibility[visibilityBase + landmark] ?? 0) / 255,
    });
  }
  return frame;
}

/** Duration of a track, in milliseconds. */
export function trackDurationMs(track: SkeletonTrack): number {
  return (track.frameCount / track.fps) * 1000;
}
