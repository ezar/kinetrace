/**
 * Bridge from the exercise DSL to the engine.
 *
 * The routine builder can override the target band per profile, because the
 * numbers in the library are only defaults: the physiotherapist's numbers win.
 */

import type { ExerciseRunnerConfig, TargetBand, TempoTarget } from '@kinetrace/engine';
import type { ExerciseDefinition } from './types.js';

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
}

export function toRunnerConfig(
  exercise: ExerciseDefinition,
  options: RunnerOptions = {},
): ExerciseRunnerConfig {
  const holdSeconds = options.holdSeconds ?? exercise.defaults.holdSeconds ?? 30;
  return {
    metrics: exercise.metrics,
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
