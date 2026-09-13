/**
 * Animated demo of an exercise, generated from its reference motion.
 *
 * No video, no illustrations to maintain: the same keyframes the fixtures and
 * the tests use are what the library shows.
 */

import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  poseToWorldPoints,
  POSTURES,
  samplePose,
  worldToLandmarks,
  type Landmark,
  type ReferenceMotion,
} from '@kinetrace/engine';
import { StickFigure } from './StickFigure.js';

export interface ExerciseDemoProps {
  reference: ReferenceMotion;
  /** Landmark indices of the tracked joint. */
  highlight?: readonly number[];
  /** The view the exercise is performed in, which decides the plane drawn. */
  view?: 'side' | 'front';
  className?: string;
  /** Freeze on the most expressive frame instead of animating. */
  still?: boolean;
  /**
   * Drive the animation from somebody else's clock instead of its own.
   *
   * A guided session paces the voice against a wall clock, and the figure has
   * to move to the same one or it is showing a different exercise from the one
   * being called. `startedAt` is a `Date.now()` stamp of the first repetition
   * and `cycleMs` how long one takes, which is the prescribed tempo where there
   * is one and the reference cycle otherwise.
   */
  clock?: { startedAt: number; cycleMs: number };
  /** Far mode uses heavier strokes. */
  far?: boolean;
  /** Draw the ground line under the figure. */
  ground?: boolean;
  stroke?: string;
  highlightStroke?: string;
  dashed?: boolean;
}

const VISIBILITY = 1;

function landmarksAt(reference: ReferenceMotion, phase: number): Landmark[] {
  const pose = samplePose(reference, phase);
  const points = poseToWorldPoints(pose, POSTURES[reference.posture]);
  return worldToLandmarks(
    points,
    points.map(() => VISIBILITY),
  );
}

export function ExerciseDemo({
  reference,
  highlight,
  view = 'side',
  className,
  still = false,
  clock,
  far = false,
  ground = true,
  stroke,
  highlightStroke,
  dashed = false,
}: ExerciseDemoProps): JSX.Element {
  const prefersReducedMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frozen = still || prefersReducedMotion;
  const [landmarks, setLandmarks] = useState<Landmark[]>(() =>
    landmarksAt(reference, frozen ? 0.5 : 0),
  );
  const frameRef = useRef(0);

  useEffect(() => {
    if (frozen) {
      setLandmarks(landmarksAt(reference, 0.5));
      return;
    }
    const durationMs = clock?.cycleMs ?? reference.cycleSeconds * 1000;
    if (durationMs <= 0) return;
    // A borrowed clock is a wall clock, because that is what the session's own
    // timers run on; its own is the monotonic one, which cannot jump.
    const elapsed = clock
      ? (): number => Date.now() - clock.startedAt
      : (
          (started) => (): number =>
            performance.now() - started
        )(performance.now());
    const step = (): void => {
      const since = elapsed();
      const phase = since <= 0 ? 0 : (since % durationMs) / durationMs;
      setLandmarks(landmarksAt(reference, phase));
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [reference, frozen, clock]);

  return (
    <StickFigure
      landmarks={landmarks}
      space="world"
      plane={view === 'side' ? 'sagittal' : 'frontal'}
      cameraSide={reference.cameraSide ?? 'left'}
      highlight={highlight}
      className={className}
      far={far}
      ground={ground}
      dashed={dashed}
      {...(stroke ? { stroke } : {})}
      {...(highlightStroke ? { highlightStroke } : {})}
    />
  );
}
