/**
 * What a session's sets add up to, per exercise.
 *
 * Separate from the screen that draws it because the interesting part is not
 * the layout: it is which of these numbers the app is entitled to state. A set
 * done without the camera records the prescription, not an observation, and
 * every field derived from watching has to come back empty for it — otherwise
 * the summary quietly reports a form it never saw.
 */

import type { ExerciseDefinition } from '@kinetrace/exercises';
import type { SetRecord } from '../db/schema.js';

export interface ExerciseSummary {
  /** True when at least one set of this exercise was watched by the camera. */
  measured: boolean;
  sets: number;
  /**
   * Repetitions. Counted by the engine for a measured set, and the number that
   * was asked for in a guided one — which is why `measured` travels with it.
   */
  reps: number;
  partials: number;
  /**
   * Share of repetitions that were complete, or null when there is nothing to
   * take a share of: an unmeasured exercise, or a measured one whose tracking
   * produced nothing at all.
   */
  goodPct: number | null;
  heldMs: number;
  /** Best and mean range, over the measured sets only. Undefined when none. */
  romBest: number | undefined;
  romMean: number | undefined;
  /** The three most frequent corrections, most frequent first. */
  topIssues: ReadonlyArray<readonly [string, number]>;
}

const TOP_ISSUES = 3;

export function summariseExercise(
  sets: readonly SetRecord[],
  exercise: ExerciseDefinition | undefined,
): ExerciseSummary {
  const measuredSets = sets.filter((set) => set.measured !== false);
  const measured = measuredSets.length > 0;

  const reps = sets.reduce((total, set) => total + set.reps, 0);
  const measuredReps = measuredSets.reduce((total, set) => total + set.reps, 0);
  const partials = sets.reduce((total, set) => total + set.partials, 0);
  const heldMs = sets.reduce((total, set) => total + set.holdMs, 0);

  const romValues = measuredSets.map((set) => set.romMax).filter((value) => value > 0);
  const decreasing = exercise?.targets.direction === 'decrease';

  // Corrections come from watching, so only the watched sets can contribute
  // one. A guided set stores an empty map anyway; this makes it a rule rather
  // than a coincidence of how the guided session happens to write its rows.
  const issues = new Map<string, number>();
  for (const set of measuredSets) {
    for (const [ruleId, count] of Object.entries(set.issues)) {
      issues.set(ruleId, (issues.get(ruleId) ?? 0) + count);
    }
  }

  return {
    measured,
    sets: sets.length,
    reps,
    partials,
    goodPct:
      measured && measuredReps + partials > 0
        ? Math.round((measuredReps / (measuredReps + partials)) * 100)
        : null,
    heldMs,
    romBest: romValues.length
      ? decreasing
        ? Math.min(...romValues)
        : Math.max(...romValues)
      : undefined,
    romMean: measured
      ? measuredSets.reduce((total, set) => total + set.romMean, 0) / measuredSets.length
      : undefined,
    topIssues: [...issues.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_ISSUES),
  };
}
