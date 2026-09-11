/**
 * Camera setup assistant.
 *
 * The session does not start until the camera can actually see what the
 * exercise needs. Every check below runs on landmarks alone, so the assistant
 * works with the preview switched off.
 */

import type { Landmark, PoseFrame, ViewOrientation } from '../types.js';
import { POSE_LANDMARK, type PoseLandmarkName } from '../pose/landmarks.js';
import { meanVisibility } from '../metrics/evaluator.js';

export type SetupCheckId = 'bodyVisible' | 'framing' | 'view' | 'detection';

export type SetupCheckStatus = 'pending' | 'ok' | 'failed';

export interface SetupCheck {
  id: SetupCheckId;
  status: SetupCheckStatus;
  /**
   * Key into the setup dictionary describing what to change, e.g.
   * `setup.tip.stepBack`. Null when the check passes.
   */
  tipKey: string | null;
}

export interface SetupState {
  checks: SetupCheck[];
  /** True once every check has held for the required stability window. */
  ready: boolean;
  /** View the assistant currently detects, or null when it cannot tell yet. */
  detectedView: ViewOrientation | null;
  /** How long every check has been passing, in milliseconds. */
  stableMs: number;
}

export interface SetupAssistantOptions {
  /** View the exercise requires. */
  requiredView: ViewOrientation;
  /** Landmark indices the exercise's metrics need. */
  requiredLandmarks: readonly number[];
  /** Minimum visibility for a required landmark, `[0, 1]`. */
  minVisibility?: number;
  /** How long every check must pass before setup is complete, in milliseconds. */
  stableForMs?: number;
  /** Acceptable fraction of the frame the body should occupy, `[0, 1]`. */
  framing?: { min: number; max: number };
}

const DEFAULTS = {
  minVisibility: 0.6,
  stableForMs: 2000,
  framing: { min: 0.35, max: 0.95 },
} as const;

/**
 * Ratio of shoulder width to torso length below which the subject is sideways.
 * Facing the camera the shoulder line projects at full width; turned sideways it
 * collapses towards zero.
 */
const SIDE_VIEW_RATIO = 0.38;
const FRONT_VIEW_RATIO = 0.52;

/** Detect whether the subject faces the camera or stands sideways to it. */
export function detectView(image: readonly Landmark[]): ViewOrientation | null {
  const leftShoulder = image[POSE_LANDMARK.LEFT_SHOULDER];
  const rightShoulder = image[POSE_LANDMARK.RIGHT_SHOULDER];
  const leftHip = image[POSE_LANDMARK.LEFT_HIP];
  const rightHip = image[POSE_LANDMARK.RIGHT_HIP];
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null;

  const shoulderWidth = Math.hypot(
    leftShoulder.x - rightShoulder.x,
    leftShoulder.y - rightShoulder.y,
  );
  const shoulderMid = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const hipMid = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
  const torsoLength = Math.hypot(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y);
  if (torsoLength < 1e-4) return null;

  const ratio = shoulderWidth / torsoLength;
  if (ratio <= SIDE_VIEW_RATIO) return 'side';
  if (ratio >= FRONT_VIEW_RATIO) return 'front';
  return null;
}

/** Fraction of the frame occupied by the body, along its longest axis. */
export function framingFraction(image: readonly Landmark[], required: readonly number[]): number {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const index of required) {
    const landmark = image[index];
    if (!landmark) continue;
    minX = Math.min(minX, landmark.x);
    maxX = Math.max(maxX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxY = Math.max(maxY, landmark.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return 0;
  return Math.max(maxX - minX, maxY - minY);
}

const LANDMARK_NAMES = Object.entries(POSE_LANDMARK) as Array<[PoseLandmarkName, number]>;

function namesFor(indices: readonly number[]): PoseLandmarkName[] {
  return LANDMARK_NAMES.filter(([, index]) => indices.includes(index)).map(([name]) => name);
}

export class SetupAssistant {
  private passingSince: number | null = null;
  private lastState: SetupState;

  constructor(private readonly options: SetupAssistantOptions) {
    this.lastState = {
      checks: [
        { id: 'bodyVisible', status: 'pending', tipKey: null },
        { id: 'framing', status: 'pending', tipKey: null },
        { id: 'view', status: 'pending', tipKey: null },
        { id: 'detection', status: 'pending', tipKey: null },
      ],
      ready: false,
      detectedView: null,
      stableMs: 0,
    };
  }

  get state(): SetupState {
    return this.lastState;
  }

  reset(): void {
    this.passingSince = null;
  }

  update(frame: PoseFrame): SetupState {
    const minVisibility = this.options.minVisibility ?? DEFAULTS.minVisibility;
    const stableForMs = this.options.stableForMs ?? DEFAULTS.stableForMs;
    const framing = this.options.framing ?? DEFAULTS.framing;

    const required = this.options.requiredLandmarks;
    const visibility = meanVisibility(frame.image, namesFor(required));
    const missing = required.filter(
      (index) => (frame.image[index]?.visibility ?? 0) < minVisibility,
    );

    const bodyVisible: SetupCheck = {
      id: 'bodyVisible',
      status: missing.length === 0 ? 'ok' : 'failed',
      tipKey: missing.length === 0 ? null : 'setup.tip.wholeBody',
    };

    const fraction = framingFraction(frame.image, required);
    const framingCheck: SetupCheck = {
      id: 'framing',
      status: fraction >= framing.min && fraction <= framing.max ? 'ok' : 'failed',
      tipKey:
        fraction > framing.max
          ? 'setup.tip.stepBack'
          : fraction < framing.min
            ? 'setup.tip.comeCloser'
            : null,
    };

    const detectedView = detectView(frame.image);
    const viewCheck: SetupCheck = {
      id: 'view',
      status: detectedView === this.options.requiredView ? 'ok' : 'failed',
      tipKey:
        detectedView === this.options.requiredView
          ? null
          : this.options.requiredView === 'side'
            ? 'setup.tip.turnSideways'
            : 'setup.tip.faceCamera',
    };

    const detectionCheck: SetupCheck = {
      id: 'detection',
      status: visibility >= minVisibility + 0.1 ? 'ok' : 'failed',
      tipKey: visibility >= minVisibility + 0.1 ? null : 'setup.tip.moreLight',
    };

    const checks = [bodyVisible, framingCheck, viewCheck, detectionCheck];
    const allPass = checks.every((check) => check.status === 'ok');
    if (allPass) this.passingSince ??= frame.timestampMs;
    else this.passingSince = null;

    const stableMs = this.passingSince === null ? 0 : frame.timestampMs - this.passingSince;
    this.lastState = {
      checks,
      ready: allPass && stableMs >= stableForMs,
      detectedView,
      stableMs,
    };
    return this.lastState;
  }
}
