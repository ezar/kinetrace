/**
 * Checking what a professional prescribes.
 *
 * The library ships default ranges and says, on every screen that shows one,
 * that a physiotherapist's numbers replace them. This is what stands behind
 * that promise: given an exercise and the numbers somebody wrote for one
 * person, it says what is wrong with them.
 *
 * Most of the checks are arithmetic. One is not, and it is the reason this file
 * exists: a repetition is only counted once the movement has crossed the
 * threshold that opens the exercise's top phase, and the target band decides
 * whether that repetition was *good*. Set the band below that threshold and
 * every repetition is good the moment it is counted — the target silently stops
 * meaning anything. Nobody would see that from the two numbers alone.
 *
 * No text lives here. Issues are codes, like every other thing the engine and
 * the library hand to the app.
 */

import { getMetricDefinition, type TargetBand } from '@kinetrace/engine';
import type { Condition } from '@kinetrace/engine';
import type { ExerciseDefinition } from './types.js';

/** What a professional prescribes for one exercise, for one person. */
export interface Prescription {
  band: TargetBand;
  /** Range outside which the session stops. Absent means the library default. */
  safety?: TargetBand;
  sets: number;
  reps?: number;
  holdSeconds?: number;
  restSeconds: number;
}

export type PrescriptionIssueCode =
  /** `min` is not below `max`. */
  | 'bandInverted'
  | 'safetyInverted'
  /** The band asks for something the safety stop would interrupt. */
  | 'bandOutsideSafety'
  /** The band asks for an angle the body cannot make. */
  | 'bandOutsideMetric'
  /** The safety stop sits outside the measurable range, so it can never fire. */
  | 'safetyNeverFires'
  /** The whole band sits on the far side of the repetition threshold. */
  | 'bandOutsideCountingRange'
  /** Every counted repetition would be marked good. */
  | 'bandNotDiscriminating'
  /** Narrower than the movement the engine already forgives. */
  | 'bandNarrowerThanWobble'
  /** A long way from the library default: worth a second look before signing. */
  | 'farFromDefault'
  | 'setsInvalid'
  | 'repsInvalid'
  | 'holdInvalid'
  | 'restInvalid';

export interface PrescriptionIssue {
  code: PrescriptionIssueCode;
  /** An error cannot be signed off; a warning is shown and can be. */
  severity: 'error' | 'warning';
  /** Numbers the message interpolates. */
  params: Record<string, number>;
}

/**
 * Landmark noise is a few degrees even on a good camera, so a band narrower
 * than this reads as random to the person trying to sit inside it.
 */
export const MEASUREMENT_NOISE_DEG = 5;

/** How far from the library default a band may sit before it is worth a look. */
export const FAR_FROM_DEFAULT_DEG = 40;

/**
 * The bound a plain condition puts on the primary metric's value, or null when
 * the condition is composite or tests something else. Guessing would be worse
 * than skipping the check.
 */
function valueBound(condition: Condition, bound: 'above' | 'below'): number | null {
  if ('all' in condition) {
    for (const inner of condition.all) {
      const found = valueBound(inner, bound);
      if (found !== null) return found;
    }
    return null;
  }
  if ('any' in condition || 'not' in condition || 'always' in condition) return null;
  if (condition.metric !== undefined) return null;
  if (condition.signal !== undefined && condition.signal !== 'value') return null;
  return condition[bound] ?? null;
}

/**
 * The value the primary metric must pass for a repetition to be counted at all,
 * or null for holds and for exercises whose phases are not simple thresholds.
 *
 * Phase 0 is the resting phase; the rest are what a repetition travels through,
 * so the binding threshold is the furthest of them.
 */
export function countingThreshold(exercise: ExerciseDefinition): number | null {
  if (exercise.mode !== 'reps') return null;
  const increasing = exercise.targets.direction === 'increase';
  const bounds: number[] = [];
  for (const phase of exercise.phases.slice(1)) {
    const bound = valueBound(phase.when, increasing ? 'above' : 'below');
    if (bound !== null) bounds.push(bound);
  }
  if (bounds.length === 0) return null;
  return increasing ? Math.max(...bounds) : Math.min(...bounds);
}

/** What the exercise's primary metric can physically read. */
export function metricRange(exercise: ExerciseDefinition): TargetBand {
  const metric = exercise.metrics[exercise.primaryMetric];
  const definition = metric ? getMetricDefinition(metric.id) : undefined;
  const range = definition?.range ?? { min: 0, max: 180 };
  // An absolute metric only ever reports magnitudes, whatever its sign.
  return metric?.absolute ? { min: 0, max: Math.max(-range.min, range.max) } : range;
}

/** Everything wrong with a prescription, worst first. */
export function reviewPrescription(
  exercise: ExerciseDefinition,
  prescription: Prescription,
): PrescriptionIssue[] {
  const issues: PrescriptionIssue[] = [];
  const { band, safety } = prescription;
  const add = (
    code: PrescriptionIssueCode,
    severity: 'error' | 'warning',
    params: Record<string, number> = {},
  ): void => {
    issues.push({ code, severity, params });
  };

  // Everything below reads the band as a range. When it is not one, saying so
  // once is the whole truth; the derived checks would only add noise about a
  // negative width and a distance from the default that means nothing.
  const bandIsARange = band.min < band.max;
  if (!bandIsARange) add('bandInverted', 'error', { min: band.min, max: band.max });
  if (safety && !(safety.min < safety.max)) {
    add('safetyInverted', 'error', { min: safety.min, max: safety.max });
  }

  const range = metricRange(exercise);
  // Only one end of a repetition band is binding. An exercise judged on going
  // further is judged on its minimum, so a maximum past the measurable range is
  // how the library says "no upper limit" — the glute bridge's own 165 to 185
  // on a joint angle that stops at 180. A hold is judged on both ends.
  const bindingEnds: Array<'min' | 'max'> =
    exercise.mode === 'hold'
      ? ['min', 'max']
      : exercise.targets.direction === 'increase'
        ? ['min']
        : ['max'];
  if (bandIsARange && bindingEnds.some((end) => band[end] < range.min || band[end] > range.max)) {
    add('bandOutsideMetric', 'error', { min: range.min, max: range.max });
  }
  if (safety && safety.min <= range.min && safety.max >= range.max) {
    add('safetyNeverFires', 'warning', { min: range.min, max: range.max });
  }
  if (
    bandIsARange &&
    safety &&
    safety.min < safety.max &&
    (band.min < safety.min || band.max > safety.max)
  ) {
    add('bandOutsideSafety', 'error', { min: safety.min, max: safety.max });
  }

  if (!bandIsARange) {
    // Nothing below can be said about a band that is not a range.
  } else if (exercise.mode === 'hold') {
    const wobble = exercise.hold?.stabilityToleranceDeg ?? 0;
    // The timer already forgives this much movement, so a band inside it would
    // stutter between held and lost while somebody is perfectly still.
    if (band.max - band.min < Math.max(MEASUREMENT_NOISE_DEG, wobble * 2)) {
      add('bandNarrowerThanWobble', 'warning', { width: band.max - band.min, wobble });
    }
  } else if (band.max - band.min < MEASUREMENT_NOISE_DEG) {
    add('bandNarrowerThanWobble', 'warning', {
      width: band.max - band.min,
      wobble: MEASUREMENT_NOISE_DEG,
    });
  }

  const threshold = countingThreshold(exercise);
  if (threshold !== null && bandIsARange) {
    const increasing = exercise.targets.direction === 'increase';
    const outside = increasing ? band.max <= threshold : band.min >= threshold;
    const loose = increasing ? band.min <= threshold : band.max >= threshold;
    if (outside) add('bandOutsideCountingRange', 'error', { threshold });
    else if (loose) add('bandNotDiscriminating', 'warning', { threshold });
  }

  const fromDefault = Math.max(
    Math.abs(band.min - exercise.targets.band.min),
    Math.abs(band.max - exercise.targets.band.max),
  );
  if (bandIsARange && fromDefault > FAR_FROM_DEFAULT_DEG) {
    add('farFromDefault', 'warning', {
      min: exercise.targets.band.min,
      max: exercise.targets.band.max,
    });
  }

  if (!Number.isInteger(prescription.sets) || prescription.sets < 1) {
    add('setsInvalid', 'error', {});
  }
  if (exercise.mode === 'reps') {
    const reps = prescription.reps;
    if (reps === undefined || !Number.isInteger(reps) || reps < 1) add('repsInvalid', 'error', {});
  } else {
    const seconds = prescription.holdSeconds;
    if (seconds === undefined || !(seconds >= 1)) add('holdInvalid', 'error', {});
  }
  if (!(prescription.restSeconds >= 0)) add('restInvalid', 'error', {});

  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}

/** True when nothing blocks signing the prescription off. */
export function canPrescribe(issues: readonly PrescriptionIssue[]): boolean {
  return !issues.some((issue) => issue.severity === 'error');
}
