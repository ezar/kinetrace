/**
 * The gestures, as movement.
 *
 * Nobody discovers "both wrists above your head" from a sentence. These are the
 * same kind of reference motion the exercises carry, so the onboarding can show
 * the gesture being performed by the same stick figure that counts the
 * repetitions, with no illustration to draw or keep in step.
 *
 * Because they are movement rather than a picture, the detector can be run over
 * them: `gestures.test.ts` asserts that each one actually fires the gesture it
 * claims to show, so the two can never drift apart.
 */

import type { ReferenceMotion } from '../synth/motion.js';
import type { GestureEvent } from './detector.js';

export const GESTURE_MOTIONS: Readonly<Record<GestureEvent['type'], ReferenceMotion>> = {
  /**
   * Both arms go up and stay up, which is what holding the pause looks like.
   *
   * The arms are raised with abduction rather than with `shoulderAngle`:
   * shoulder elevation happens in the sagittal plane, so from the front the arm
   * is foreshortened to a stub. Swung out sideways it keeps its full length in
   * the plane the camera — and this illustration — actually sees.
   */
  pauseToggle: {
    posture: 'standing',
    cycleSeconds: 4,
    base: { shoulderAngle: 0, elbowAngle: 178 },
    keyframes: [
      { t: 0, pose: { shoulderAbduction: 8 } },
      { t: 0.22, pose: { shoulderAbduction: 150 } },
      { t: 0.8, pose: { shoulderAbduction: 150 } },
      { t: 1, pose: { shoulderAbduction: 8 } },
    ],
  },

  /** One hand waves across the shoulder line, the other stays down. */
  skip: {
    posture: 'standing',
    cycleSeconds: 1.1,
    base: {
      left: { shoulderAngle: 8, shoulderAbduction: 6 },
      right: { shoulderAngle: 0, elbowAngle: 176 },
    },
    keyframes: [
      { t: 0, pose: { right: { shoulderAbduction: 62 } } },
      { t: 0.5, pose: { right: { shoulderAbduction: 132 } } },
      { t: 1, pose: { right: { shoulderAbduction: 62 } } },
    ],
  },
};
