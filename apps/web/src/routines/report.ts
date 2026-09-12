/**
 * The aggregation behind the page taken to the appointment.
 *
 * It lives apart from the screen because it is the part with rules in it: which
 * peak is the best one depends on the direction the metric moves, a hold has no
 * range to report, and a unilateral exercise is two rows rather than one. Those
 * are the things that were wrong three times over before anybody looked at a
 * printed page, and they are worth a test rather than a second look.
 *
 * It reports and does not conclude. No averages of pain, no adherence score, no
 * comparison between the two sides: the reader is the clinician.
 */

import type { ExerciseDefinition } from '@kinetrace/exercises';
import { prescribedTarget } from '../session/target.js';
import type { PrescribedSide, Routine, SetRecord } from '../db/schema.js';

export interface ExerciseRow {
  exerciseId: string;
  /** The side these sets were done on, for a unilateral exercise. */
  side?: PrescribedSide;
  sets: number;
  reps: number;
  partials: number;
  holdMinutes: number;
  /** Best peak of the period, in degrees. */
  best: number;
  /** Mean of the per-set best peaks, in degrees. */
  mean: number;
  goodPct: number;
  /** Holds have no range to report: the time is the measurement. */
  isHold: boolean;
  target: { min: number; max: number };
  targetBy?: string;
  /** The three most frequent corrections, most frequent first. */
  issues: Array<{ ruleId: string; count: number }>;
}

/**
 * Group key. A unilateral exercise reports one row per side it was done on.
 * Exercise ids are kebab-case, so a pipe cannot collide with one.
 */
function keyOf(set: SetRecord): string {
  return set.side ? `${set.exerciseId}|${set.side}` : set.exerciseId;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export interface ReportInput {
  sets: readonly SetRecord[];
  routines: readonly Routine[];
  /** The library lookup, injected so the aggregation is testable without it. */
  getExercise: (id: string) => ExerciseDefinition | undefined;
}

/**
 * One row per exercise — per side, where the exercise has one — in the order
 * the sets were first recorded, which is the order of the routine.
 *
 * Sets whose exercise the library no longer knows are dropped rather than
 * reported as an unnamed row.
 */
export function reportRows({ sets, routines, getExercise }: ReportInput): ExerciseRow[] {
  const grouped = new Map<string, SetRecord[]>();
  for (const set of sets) {
    const key = keyOf(set);
    grouped.set(key, [...(grouped.get(key) ?? []), set]);
  }

  return [...grouped.values()].flatMap((records) => {
    const first = records[0];
    if (!first) return [];
    const exercise = getExercise(first.exerciseId);
    if (!exercise) return [];

    const target = prescribedTarget(routines, first.exerciseId, exercise);
    const decreasing = exercise.targets.direction === 'decrease';
    // A peak of zero is a set that never produced a measurement — tracking lost,
    // or a hold — and averaging it in would drag the range towards nothing.
    const peaks = records.map((set) => set.romMax).filter((value) => value > 0);

    const issues = new Map<string, number>();
    for (const set of records) {
      for (const [ruleId, count] of Object.entries(set.issues)) {
        issues.set(ruleId, (issues.get(ruleId) ?? 0) + count);
      }
    }

    return [
      {
        exerciseId: first.exerciseId,
        ...(first.side ? { side: first.side } : {}),
        sets: records.length,
        reps: records.reduce((total, set) => total + set.reps, 0),
        partials: records.reduce((total, set) => total + set.partials, 0),
        holdMinutes: Math.round(records.reduce((total, set) => total + set.holdMs, 0) / 60000),
        best:
          peaks.length === 0 ? 0 : Math.round(decreasing ? Math.min(...peaks) : Math.max(...peaks)),
        mean: mean(peaks),
        goodPct: mean(records.map((set) => set.goodRepPct)),
        isHold: exercise.mode === 'hold',
        target: target.band,
        ...(target.by ? { targetBy: target.by } : {}),
        issues: [...issues.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([ruleId, count]) => ({ ruleId, count })),
      },
    ];
  });
}
