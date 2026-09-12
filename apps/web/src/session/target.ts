/**
 * Which target a chart should draw.
 *
 * The library ships a default range and says, everywhere it shows one, that a
 * physiotherapist's numbers replace it. Once they have, the progress chart has
 * to follow: drawing the default at somebody who was deliberately given a lower
 * one shows them failing, week after week, at a target nobody set them.
 */

import type { ExerciseDefinition } from '@kinetrace/exercises';
import type { TargetBand } from '@kinetrace/engine';
import type { Routine } from '../db/schema.js';

export interface PrescribedTarget {
  band: TargetBand;
  /** True when the routine carries its own band rather than the library's. */
  prescribed: boolean;
  /** Who signed the review, when one has been signed. */
  by?: string;
}

/**
 * The band in force for an exercise, from the most recently touched routine that
 * contains it, falling back to the library default.
 */
export function prescribedTarget(
  routines: readonly Routine[],
  exerciseId: string,
  exercise: ExerciseDefinition,
): PrescribedTarget {
  const holder = [...routines]
    .filter((routine) => routine.exercises.some((entry) => entry.exerciseId === exerciseId))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const entry = holder?.exercises.find((item) => item.exerciseId === exerciseId);
  return {
    band: entry?.band ?? exercise.targets.band,
    prescribed: entry?.band !== undefined,
    ...(holder?.review ? { by: holder.review.by } : {}),
  };
}
