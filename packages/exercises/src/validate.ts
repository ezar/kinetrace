/**
 * Exercise validation.
 *
 * Runs in the unit tests and in the build, so a malformed exercise never
 * reaches a session. Contributors get the file, the field and the reason.
 */

import { conditionMetrics, METRIC_IDS, type Condition } from '@kinetrace/engine';
import { EXERCISE_TEXT } from './dictionary.js';
import type { ExerciseDefinition, SpinalLoad } from './types.js';

export interface ValidationIssue {
  exerciseId: string;
  /** Dotted path to the offending field, e.g. `rules[1].cueKey`. */
  path: string;
  message: string;
}

const ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Every direction the library knows how to describe and the app can name. */
const SPINAL_LOADS: readonly SpinalLoad[] = [
  'flexion',
  'extension',
  'rotation',
  'neutral',
  'mixed',
];

export function validateExercise(exercise: ExerciseDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const report = (path: string, message: string): void => {
    issues.push({ exerciseId: exercise.id, path, message });
  };

  if (!ID_PATTERN.test(exercise.id)) report('id', 'must be kebab-case');
  if (!exercise.names.es.trim() || !exercise.names.en.trim()) {
    report('names', 'both Spanish and English names are required');
  }

  if (!SPINAL_LOADS.includes(exercise.spinalLoad)) {
    report('spinalLoad', `unknown spinal load "${exercise.spinalLoad}"`);
  }

  // An exercise nobody can explain has no business being prescribed. Two steps
  // is the floor because one is a description, not instructions.
  for (const language of ['es', 'en'] as const) {
    const steps = exercise.howTo[language];
    if (steps.length < 2) {
      report(`howTo.${language}`, 'at least two steps are required');
    }
    if (steps.some((step) => !step.trim())) {
      report(`howTo.${language}`, 'steps must not be blank');
    }
  }
  if (exercise.howTo.es.length !== exercise.howTo.en.length) {
    report('howTo', 'both languages must describe the same steps');
  }

  const metricNames = Object.keys(exercise.metrics);
  if (metricNames.length === 0) report('metrics', 'at least one metric slot is required');
  for (const [name, metric] of Object.entries(exercise.metrics)) {
    if (!METRIC_IDS.includes(metric.id)) {
      report(`metrics.${name}.id`, `unknown metric "${metric.id}"`);
    }
  }
  if (!metricNames.includes(exercise.primaryMetric)) {
    report('primaryMetric', `"${exercise.primaryMetric}" is not a declared metric slot`);
  }

  const checkCondition = (condition: Condition, path: string): void => {
    for (const metric of conditionMetrics(condition, exercise.primaryMetric)) {
      if (!metricNames.includes(metric)) {
        report(path, `condition references unknown metric slot "${metric}"`);
      }
    }
  };

  const phaseIds = exercise.phases.map((phase) => phase.id);
  if (new Set(phaseIds).size !== phaseIds.length) report('phases', 'phase ids must be unique');
  if (exercise.mode === 'reps' && exercise.phases.length < 2) {
    report('phases', 'a repetition cycle needs at least two phases');
  }
  exercise.phases.forEach((phase, index) => {
    if (phase.minDwellMs < 0) report(`phases[${index}].minDwellMs`, 'must not be negative');
    checkCondition(phase.when, `phases[${index}].when`);
  });

  const { band, safety } = exercise.targets;
  if (band.min > band.max) report('targets.band', 'min must not be greater than max');
  if (safety) {
    if (safety.min > band.min || safety.max < band.max) {
      report('targets.safety', 'the safety range must contain the target band');
    }
  }

  exercise.rules.forEach((rule, index) => {
    if (!EXERCISE_TEXT[rule.cueKey]) {
      report(`rules[${index}].cueKey`, `"${rule.cueKey}" is missing from the cue dictionary`);
    }
    if (rule.sustainMs < 0) report(`rules[${index}].sustainMs`, 'must not be negative');
    if (rule.cooldownMs < 0) report(`rules[${index}].cooldownMs`, 'must not be negative');
    for (const phase of rule.phases ?? []) {
      if (!phaseIds.includes(phase)) {
        report(`rules[${index}].phases`, `unknown phase "${phase}"`);
      }
    }
    checkCondition(rule.when, `rules[${index}].when`);
  });

  if (new Set(exercise.rules.map((rule) => rule.id)).size !== exercise.rules.length) {
    report('rules', 'rule ids must be unique');
  }

  if (exercise.mode === 'hold') {
    if (!exercise.hold) report('hold', 'hold exercises must declare a stability tolerance');
    if (exercise.defaults.holdSeconds === undefined) {
      report('defaults.holdSeconds', 'hold exercises must declare a default hold time');
    }
  } else if (exercise.defaults.reps === undefined) {
    report('defaults.reps', 'repetition exercises must declare default repetitions');
  }
  if (exercise.defaults.sets <= 0) report('defaults.sets', 'must be positive');
  if (exercise.defaults.restSeconds < 0) report('defaults.restSeconds', 'must not be negative');

  if (!EXERCISE_TEXT[exercise.cameraTipKey]) {
    report('cameraTipKey', `"${exercise.cameraTipKey}" is missing from the tip dictionary`);
  }

  const keyframes = exercise.reference.keyframes;
  if (keyframes.length === 0) report('reference.keyframes', 'at least one keyframe is required');
  keyframes.forEach((keyframe, index) => {
    if (keyframe.t < 0 || keyframe.t > 1) {
      report(`reference.keyframes[${index}].t`, 'must be between 0 and 1');
    }
    const previous = keyframes[index - 1];
    if (previous && keyframe.t < previous.t) {
      report(`reference.keyframes[${index}].t`, 'keyframes must be sorted by t');
    }
  });
  if (exercise.reference.cycleSeconds <= 0) {
    report('reference.cycleSeconds', 'must be positive');
  }
  for (const { phase } of exercise.tempo ?? []) {
    if (!phaseIds.includes(phase)) report('tempo', `unknown phase "${phase}"`);
  }

  return issues;
}

/** Validate a whole library, including cross-exercise checks. */
export function validateLibrary(exercises: readonly ExerciseDefinition[]): ValidationIssue[] {
  const issues = exercises.flatMap(validateExercise);
  const seen = new Set<string>();
  for (const exercise of exercises) {
    if (seen.has(exercise.id)) {
      issues.push({ exerciseId: exercise.id, path: 'id', message: 'duplicate exercise id' });
    }
    seen.add(exercise.id);
  }
  return issues;
}

export function formatIssues(issues: readonly ValidationIssue[]): string {
  return issues.map((issue) => `${issue.exerciseId}: ${issue.path} — ${issue.message}`).join('\n');
}
