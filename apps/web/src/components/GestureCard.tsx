/**
 * A gesture, performed rather than described.
 *
 * The motion comes from the engine, next to the detector that reads it, and a
 * test runs the detector over it — so what this draws is always a gesture the
 * session will actually recognise.
 *
 * Both cards are otherwise a standing figure and look alike at a glance, so the
 * arm making the gesture is drawn in the accent colour to say where to look.
 * The frame is square because the figure is scaled to fit its box, and a short
 * wide box would shrink a standing body to nothing.
 */

import type { JSX } from 'react';
import { GESTURE_MOTIONS, POSE_LANDMARK } from '@kinetrace/engine';
import { ExerciseDemo } from './ExerciseDemo.js';

/** The arm the gesture is made with, drawn in the accent colour. */
const ARM_LANDMARKS = {
  both: [
    POSE_LANDMARK.LEFT_SHOULDER,
    POSE_LANDMARK.LEFT_ELBOW,
    POSE_LANDMARK.LEFT_WRIST,
    POSE_LANDMARK.RIGHT_SHOULDER,
    POSE_LANDMARK.RIGHT_ELBOW,
    POSE_LANDMARK.RIGHT_WRIST,
  ],
  right: [POSE_LANDMARK.RIGHT_SHOULDER, POSE_LANDMARK.RIGHT_ELBOW, POSE_LANDMARK.RIGHT_WRIST],
} as const;

export interface GestureCardProps {
  motion: keyof typeof GESTURE_MOTIONS;
  arms: keyof typeof ARM_LANDMARKS;
  caption: string;
}

export function GestureCard({ motion, arms, caption }: GestureCardProps): JSX.Element {
  return (
    <figure className="card flex flex-1 flex-col items-center gap-1 p-3">
      <ExerciseDemo
        reference={GESTURE_MOTIONS[motion]}
        view="front"
        highlight={ARM_LANDMARKS[arms]}
        highlightStroke="var(--color-accent)"
        className="aspect-square w-full text-ink"
      />
      <figcaption className="text-center text-[13px] leading-snug text-muted">{caption}</figcaption>
    </figure>
  );
}
