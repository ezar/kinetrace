/**
 * Bridge from the exercise DSL to the engine.
 *
 * The routine builder can override the target band per profile, because the
 * numbers in the library are only defaults: the physiotherapist's numbers win.
 * The same applies to the side of a unilateral exercise, which is a clinical
 * choice and not something the camera should be deciding.
 */

import type { ExerciseRunnerConfig, TargetBand, TempoTarget } from '@kinetrace/engine';
import type { ExerciseDefinition, ExerciseMetric } from './types.js';

export interface RunnerOptions {
  /** Target band from the routine, replacing the library default. */
  band?: TargetBand;
  /** Safety stop from the routine, replacing the library default. */
  safety?: TargetBand;
  /** Repetitions requested by the routine. */
  reps?: number;
  /** Hold time requested by the routine, in seconds. */
  holdSeconds?: number;
  /** Seconds per phase from the routine, replacing the library's. */
  tempo?: readonly TempoTarget[];
  /**
   * The limb this set is being done on, for a unilateral exercise. It replaces
   * `auto` on every slot that declares it — `auto` picks the side the camera
   * sees better, which is the wrong way to answer a question the prescription
   * already answered. Slots declared `mean` are left alone: they average both
   * sides on purpose.
   */
  side?: 'left' | 'right';
}

/** Pin every `auto` slot to the side the set is actually being done on. */
function metricsForSide(
  metrics: Record<string, ExerciseMetric>,
  side: 'left' | 'right' | undefined,
): Record<string, ExerciseMetric> {
  if (!side) return metrics;
  return Object.fromEntries(
    Object.entries(metrics).map(([slot, metric]) => [
      slot,
      metric.side === 'auto' ? { ...metric, side } : metric,
    ]),
  );
}

export function toRunnerConfig(
  exercise: ExerciseDefinition,
  options: RunnerOptions = {},
): ExerciseRunnerConfig {
  const holdSeconds = options.holdSeconds ?? exercise.defaults.holdSeconds ?? 30;
  return {
    metrics: metricsForSide(exercise.metrics, options.side),
    primaryMetric: exercise.primaryMetric,
    view: exercise.view.orientation,
    mode: exercise.mode,
    phases: exercise.phases,
    targets: {
      ...exercise.targets,
      ...(options.band ? { band: options.band } : {}),
      ...(options.safety ? { safety: options.safety } : {}),
    },
    rules: exercise.rules,
    targetReps: options.reps ?? exercise.defaults.reps,
    ...((options.tempo ?? exercise.tempo) ? { tempo: options.tempo ?? exercise.tempo } : {}),
    ...(exercise.mode === 'hold'
      ? {
          hold: {
            stabilityToleranceDeg: exercise.hold?.stabilityToleranceDeg ?? 4,
            targetMs: holdSeconds * 1000,
          },
        }
      : {}),
  };
}
