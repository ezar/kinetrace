/** Turn a routine into the flat list of sets a session walks through. */

import { getExercise, type ExerciseDefinition } from '@kinetrace/exercises';
import type { TargetBand } from '@kinetrace/engine';
import type { Routine, RoutineExercise } from '../db/schema.js';

export interface PlanItem {
  /** Position in the session, starting at 0. */
  index: number;
  exerciseId: string;
  exercise?: ExerciseDefinition;
  /** Position of the exercise inside the routine, starting at 0. */
  exerciseIndex: number;
  /** Set number inside this exercise, starting at 1. */
  setNumber: number;
  totalSets: number;
  reps?: number;
  holdSeconds?: number;
  restSeconds: number;
  band?: TargetBand;
  /** Text from a sheet import that matched no exercise; shown but not tracked. */
  customNote?: string;
  /** False for imported items the library cannot track. */
  tracked: boolean;
}

export function buildPlan(routine: Pick<Routine, 'exercises'>): PlanItem[] {
  const items: PlanItem[] = [];
  routine.exercises.forEach((entry: RoutineExercise, exerciseIndex) => {
    const exercise = getExercise(entry.exerciseId);
    const totalSets = Math.max(1, entry.sets);
    for (let setNumber = 1; setNumber <= totalSets; setNumber += 1) {
      items.push({
        index: items.length,
        exerciseId: entry.exerciseId,
        exercise,
        exerciseIndex,
        setNumber,
        totalSets,
        reps: entry.reps ?? exercise?.defaults.reps,
        holdSeconds: entry.holdSeconds ?? exercise?.defaults.holdSeconds,
        restSeconds: entry.restSeconds,
        band: entry.band,
        customNote: entry.customNote,
        tracked: Boolean(exercise),
      });
    }
  });
  return items;
}

/** Rough duration of a routine in minutes, for the routine card. */
export function estimateMinutes(routine: Pick<Routine, 'exercises'>): number {
  let seconds = 0;
  for (const entry of routine.exercises) {
    const exercise = getExercise(entry.exerciseId);
    const sets = Math.max(1, entry.sets);
    const holdSeconds = entry.holdSeconds ?? exercise?.defaults.holdSeconds;
    const reps = entry.reps ?? exercise?.defaults.reps ?? 10;
    // Four seconds per repetition is the tempo the reference motions use.
    const workSeconds = holdSeconds ?? reps * 4;
    seconds += sets * (workSeconds + entry.restSeconds);
  }
  // Plus a little for getting into position between exercises.
  return Math.max(1, Math.round((seconds + routine.exercises.length * 20) / 60));
}
