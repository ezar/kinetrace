/**
 * Pose gestures.
 *
 * The phone is on the floor two or three metres away, so the session is driven
 * from the mat: both wrists above the head toggles pause, and waving one hand
 * across the shoulder line skips to the next set.
 */

import type { PoseFrame } from '../types.js';
import { POSE_LANDMARK } from '../pose/landmarks.js';

export type GestureEvent =
  { type: 'pauseToggle'; timestampMs: number } | { type: 'skip'; timestampMs: number };

export interface GestureOptions {
  /** How long both wrists must stay above the head, in milliseconds. */
  pauseHoldMs?: number;
  /** Number of shoulder line crossings that count as a wave. */
  waveCrossings?: number;
  /** Window the crossings must happen inside, in milliseconds. */
  waveWindowMs?: number;
  /** Minimum landmark visibility for a gesture to be considered. */
  minVisibility?: number;
  /** Time after a gesture during which no new gesture fires, in milliseconds. */
  cooldownMs?: number;
  /**
   * Vertical margin, in normalised image units, that a wrist must clear before a
   * crossing counts. Keeps a resting hand from oscillating across the line.
   */
  crossingMargin?: number;
}

const DEFAULTS = {
  pauseHoldMs: 1500,
  waveCrossings: 3,
  waveWindowMs: 2000,
  minVisibility: 0.5,
  cooldownMs: 2000,
  crossingMargin: 0.03,
} as const;

export class GestureDetector {
  private handsUpSince: number | null = null;
  private lastGestureAt: number | null = null;
  private crossings: Array<{ timestampMs: number; side: 'left' | 'right' }> = [];
  private lastSign: Record<'left' | 'right', number> = { left: 0, right: 0 };

  constructor(private readonly options: GestureOptions = {}) {}

  reset(): void {
    this.handsUpSince = null;
    this.lastGestureAt = null;
    this.crossings = [];
    this.lastSign = { left: 0, right: 0 };
  }

  update(frame: PoseFrame): GestureEvent[] {
    const options = { ...DEFAULTS, ...this.options };
    const events: GestureEvent[] = [];
    const landmark = (index: number) => frame.image[index];

    const nose = landmark(POSE_LANDMARK.NOSE);
    const leftWrist = landmark(POSE_LANDMARK.LEFT_WRIST);
    const rightWrist = landmark(POSE_LANDMARK.RIGHT_WRIST);
    const leftShoulder = landmark(POSE_LANDMARK.LEFT_SHOULDER);
    const rightShoulder = landmark(POSE_LANDMARK.RIGHT_SHOULDER);
    if (!nose || !leftWrist || !rightWrist || !leftShoulder || !rightShoulder) return events;

    const onCooldown =
      this.lastGestureAt !== null && frame.timestampMs - this.lastGestureAt < options.cooldownMs;

    // Image space: y grows downwards, so "above the head" means a smaller y.
    const visible =
      Math.min(leftWrist.visibility, rightWrist.visibility, nose.visibility) >=
      options.minVisibility;
    const bothAbove = visible && leftWrist.y < nose.y && rightWrist.y < nose.y;

    if (bothAbove) {
      this.handsUpSince ??= frame.timestampMs;
      if (!onCooldown && frame.timestampMs - this.handsUpSince >= options.pauseHoldMs) {
        this.handsUpSince = null;
        this.lastGestureAt = frame.timestampMs;
        this.crossings = [];
        events.push({ type: 'pauseToggle', timestampMs: frame.timestampMs });
        return events;
      }
    } else {
      this.handsUpSince = null;
    }

    for (const side of ['left', 'right'] as const) {
      const wrist = side === 'left' ? leftWrist : rightWrist;
      const shoulder = side === 'left' ? leftShoulder : rightShoulder;
      if (Math.min(wrist.visibility, shoulder.visibility) < options.minVisibility) continue;
      const delta = shoulder.y - wrist.y;
      if (Math.abs(delta) < options.crossingMargin) continue;
      const sign = Math.sign(delta);
      if (this.lastSign[side] !== 0 && sign !== this.lastSign[side]) {
        this.crossings.push({ timestampMs: frame.timestampMs, side });
      }
      this.lastSign[side] = sign;
    }

    const windowStart = frame.timestampMs - options.waveWindowMs;
    this.crossings = this.crossings.filter((entry) => entry.timestampMs >= windowStart);
    for (const side of ['left', 'right'] as const) {
      const count = this.crossings.filter((entry) => entry.side === side).length;
      if (!onCooldown && !bothAbove && count >= options.waveCrossings) {
        this.crossings = [];
        this.lastGestureAt = frame.timestampMs;
        events.push({ type: 'skip', timestampMs: frame.timestampMs });
        break;
      }
    }

    return events;
  }
}
