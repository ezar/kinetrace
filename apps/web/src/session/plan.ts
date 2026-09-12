/** Turn a routine into the flat list of sets a session walks through. */

import { getExercise, type ExerciseDefinition } from '@kinetrace/exercises';
import type { TargetBand, TempoTarget } from '@kinetrace/engine';
import type { PrescribedSide, Routine, RoutineExercise } from '../db/schema.js';

export interface PlanItem {
  /** Position in the session, starting at 0. */
  index: number;
  exerciseId: string;
  exercise?: ExerciseDefinition;
  /** Position of the exercise inside the routine, starting at 0. */
  exerciseIndex: number;
  /** Set number inside this exercise, starting at 1 — per side when there are two. */
  setNumber: number;
  totalSets: number;
  /** The limb this set is done on, for a unilateral exercise. */
  side?: PrescribedSide;
  reps?: number;
  holdSeconds?: number;
  restSeconds: number;
  band?: TargetBand;
  safety?: TargetBand;
  /** Seconds per phase, when somebody has prescribed a pace. */
  tempo?: TempoTarget[];
  /** A line from the professional who reviewed this exercise. */
  physioNote?: string;
  /** Text from a sheet import that matched no exercise; shown but not tracked. */
  customNote?: string;
  /** False for imported items the library cannot track. */
  tracked: boolean;
}

/**
 * The sides a unilateral exercise is done on, in the order they are done: one
 * side all the way through, then the other. A prescription that names a side
 * runs that side only; one that names none means both, which is what a routine
 * written before the field existed also means.
 *
 * A bilateral exercise has no side at all, rather than a side of `undefined`
 * repeated twice.
 */
function sidesFor(entry: RoutineExercise, unilateral: boolean): Array<PrescribedSide | undefined> {
  if (!unilateral) return [undefined];
  return entry.side ? [entry.side] : ['left', 'right'];
}

export function buildPlan(routine: Pick<Routine, 'exercises'>): PlanItem[] {
  const items: PlanItem[] = [];
  routine.exercises.forEach((entry: RoutineExercise, exerciseIndex) => {
    const exercise = getExercise(entry.exerciseId);
    const totalSets = Math.max(1, entry.sets);
    for (const side of sidesFor(entry, Boolean(exercise?.unilateral))) {
      for (let setNumber = 1; setNumber <= totalSets; setNumber += 1) {
        items.push({
          index: items.length,
          exerciseId: entry.exerciseId,
          exercise,
          exerciseIndex,
          setNumber,
          totalSets,
          ...(side ? { side } : {}),
          reps: entry.reps ?? exercise?.defaults.reps,
          holdSeconds: entry.holdSeconds ?? exercise?.defaults.holdSeconds,
          restSeconds: entry.restSeconds,
          band: entry.band,
          safety: entry.safety,
          tempo: entry.tempo,
          physioNote: entry.physioNote,
          customNote: entry.customNote,
          tracked: Boolean(exercise),
        });
      }
    }
  });
  return items;
}

/** Rough duration of a routine in minutes, for the routine card. */
export function estimateMinutes(routine: Pick<Routine, 'exercises'>): number {
  let seconds = 0;
  for (const entry of routine.exercises) {
    const exercise = getExercise(entry.exerciseId);
    // Both sides of a unilateral exercise are twice the work, and a routine
    // that claims ten minutes and takes twenty is worse than no estimate.
    const sides = sidesFor(entry, Boolean(exercise?.unilateral)).length;
    const sets = Math.max(1, entry.sets) * sides;
    const holdSeconds = entry.holdSeconds ?? exercise?.defaults.holdSeconds;
    const reps = entry.reps ?? exercise?.defaults.reps ?? 10;
    // Four seconds per repetition is the tempo the reference motions use.
    const workSeconds = holdSeconds ?? reps * 4;
    seconds += sets * (workSeconds + entry.restSeconds);
  }
  // Plus a little for getting into position between exercises.
  return Math.max(1, Math.round((seconds + routine.exercises.length * 20) / 60));
}
