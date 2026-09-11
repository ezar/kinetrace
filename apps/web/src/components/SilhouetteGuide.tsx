/**
 * Silhouette guide for the camera setup assistant.
 *
 * Shows the expected view as a dimmed stick figure the user lines themselves up
 * with, drawn from the exercise's own reference motion.
 */

import type { JSX } from 'react';
import { ExerciseDemo } from './ExerciseDemo.js';
import type { ReferenceMotion } from '@kinetrace/engine';

export interface SilhouetteGuideProps {
  reference: ReferenceMotion;
  /** The view the exercise is performed in. */
  view?: 'side' | 'front';
  className?: string;
}

export function SilhouetteGuide({
  reference,
  view = 'side',
  className,
}: SilhouetteGuideProps): JSX.Element {
  return (
    <div className={`pointer-events-none opacity-45 ${className ?? ''}`} aria-hidden="true">
      <ExerciseDemo
        reference={reference}
        view={view}
        className="h-full w-full"
        still
        far
        dashed
        ground={false}
        stroke="#f7f5f2"
      />
    </div>
  );
}
