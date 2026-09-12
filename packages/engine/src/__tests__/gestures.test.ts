import { describe, expect, it } from 'vitest';
import { GestureDetector } from '../gestures/detector.js';
import { GESTURE_MOTIONS } from '../gestures/demo.js';
import { synthesizeFrames } from '../synth/motion.js';
import { LANDMARK_COUNT, POSE_LANDMARK } from '../pose/landmarks.js';
import type { Landmark, PoseFrame } from '../types.js';

/**
 * Gestures are read from image space, where y grows downwards, so a wrist
 * "above the head" has a smaller y than the nose.
 */
function poseFrame(
  timestampMs: number,
  overrides: Partial<Record<number, { x: number; y: number }>>,
): PoseFrame {
  const image: Landmark[] = Array.from({ length: LANDMARK_COUNT }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
  }));
  image[POSE_LANDMARK.NOSE] = { x: 0.5, y: 0.2, z: 0, visibility: 0.95 };
  image[POSE_LANDMARK.LEFT_SHOULDER] = { x: 0.45, y: 0.35, z: 0, visibility: 0.95 };
  image[POSE_LANDMARK.RIGHT_SHOULDER] = { x: 0.55, y: 0.35, z: 0, visibility: 0.95 };
  image[POSE_LANDMARK.LEFT_WRIST] = { x: 0.4, y: 0.6, z: 0, visibility: 0.95 };
  image[POSE_LANDMARK.RIGHT_WRIST] = { x: 0.6, y: 0.6, z: 0, visibility: 0.95 };
  for (const [index, position] of Object.entries(overrides)) {
    if (!position) continue;
    image[Number(index)] = { ...position, z: 0, visibility: 0.95 };
  }
  return { timestampMs, image, world: [] };
}

describe('GestureDetector', () => {
  it('toggles pause when both wrists stay above the head for 1.5 s', () => {
    const detector = new GestureDetector();
    const handsUp = {
      [POSE_LANDMARK.LEFT_WRIST]: { x: 0.4, y: 0.1 },
      [POSE_LANDMARK.RIGHT_WRIST]: { x: 0.6, y: 0.1 },
    };
    const events = [];
    for (let t = 0; t <= 1600; t += 33) {
      events.push(...detector.update(poseFrame(t, handsUp)));
    }
    expect(events.filter((event) => event.type === 'pauseToggle')).toHaveLength(1);
  });

  it('does not fire when the hands go up only briefly', () => {
    const detector = new GestureDetector();
    const events = [];
    for (let t = 0; t <= 900; t += 33) {
      events.push(
        ...detector.update(
          poseFrame(t, {
            [POSE_LANDMARK.LEFT_WRIST]: { x: 0.4, y: 0.1 },
            [POSE_LANDMARK.RIGHT_WRIST]: { x: 0.6, y: 0.1 },
          }),
        ),
      );
    }
    expect(events).toHaveLength(0);
  });

  it('skips on a hand waving across the shoulder line', () => {
    const detector = new GestureDetector();
    const events = [];
    let t = 0;
    for (let wave = 0; wave < 4; wave += 1) {
      for (const y of [0.2, 0.5]) {
        for (let hold = 0; hold < 4; hold += 1) {
          t += 33;
          events.push(
            ...detector.update(poseFrame(t, { [POSE_LANDMARK.LEFT_WRIST]: { x: 0.4, y } })),
          );
        }
      }
    }
    expect(events.some((event) => event.type === 'skip')).toBe(true);
  });

  it('ignores a hand resting near the shoulder line', () => {
    const detector = new GestureDetector();
    const events = [];
    for (let t = 0; t < 3000; t += 33) {
      const y = 0.35 + (t % 66 === 0 ? 0.005 : -0.005);
      events.push(...detector.update(poseFrame(t, { [POSE_LANDMARK.LEFT_WRIST]: { x: 0.4, y } })));
    }
    expect(events).toHaveLength(0);
  });
});

/**
 * The onboarding illustrates each gesture with a reference motion. If the
 * illustration and the detector ever disagree, the app is teaching a gesture
 * that does not work — so the detector is run over the illustration itself.
 */
describe('the gesture demonstrations', () => {
  function detect(motion: (typeof GESTURE_MOTIONS)[keyof typeof GESTURE_MOTIONS]): string[] {
    const frames = synthesizeFrames(motion, { view: 'front', cycles: 3, fps: 30, seed: 7 });
    const detector = new GestureDetector();
    return frames.flatMap((frame) => detector.update(frame).map((event) => event.type));
  }

  it('shows a pause that the detector reads as a pause', () => {
    expect(detect(GESTURE_MOTIONS.pauseToggle)).toContain('pauseToggle');
  });

  it('shows a wave that the detector reads as a skip', () => {
    expect(detect(GESTURE_MOTIONS.skip)).toContain('skip');
  });

  it('does not confuse one demonstration for the other', () => {
    expect(detect(GESTURE_MOTIONS.pauseToggle)).not.toContain('skip');
    expect(detect(GESTURE_MOTIONS.skip)).not.toContain('pauseToggle');
  });
});
