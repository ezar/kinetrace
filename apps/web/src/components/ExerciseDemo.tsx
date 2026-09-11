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
    const durationMs = reference.cycleSeconds * 1000;
    const started = performance.now();
    const step = (now: number): void => {
      const phase = ((now - started) % durationMs) / durationMs;
      setLandmarks(landmarksAt(reference, phase));
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [reference, frozen]);

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
