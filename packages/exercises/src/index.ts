/**
 * Kinetrace exercise library.
 *
 * The DSL types, the validator, the Spanish and English cue dictionary and the
 * starter library. No engine changes are needed to add an exercise.
 */

export * from './types.js';
export * from './validate.js';
export * from './matcher.js';
export * from './prescription.js';
export { describeCondition } from './explain.js';
export * from './runner.js';
export * from './guided.js';
export * from './programmes.js';
export { phaseTimeline, phaseMarks } from './phases.js';
export { spinalLoadMix, SPINAL_LOAD_ORDER } from './load.js';
export type { PhaseMark } from './phases.js';
export {
  METRIC_LABELS,
  PHASE_LABELS,
  phaseLabel,
  METRIC_DESCRIPTIONS,
  metricLabel,
  metricDescription,
  ENGINE_CUES,
  RULE_CUES,
  PHASE_CUES,
  phaseCueKey,
  SETUP_TIPS,
  CAMERA_TIPS,
  EXERCISE_TEXT,
  resolveText,
} from './dictionary.js';
export { VOICE_PHRASES, VOICE_EXAMPLES, voiceGrammar } from './voice.js';
export { EXERCISES } from './library/index.js';
export * from './library/index.js';

import { EXERCISES } from './library/index.js';
import type { ExerciseDefinition } from './types.js';

const BY_ID = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));

export function getExercise(id: string): ExerciseDefinition | undefined {
  return BY_ID.get(id);
}

/**
 * Exercise ids of a starting set of stretches, in the order that keeps somebody
 * on the floor: two lying down, then up onto the knees, then sitting back.
 *
 * Ordered for practicality, not for physiology — getting up and down four times
 * before breakfast is how a routine stops being done. Which stretches a given
 * person should do, and for how long, is the physiotherapist's call, and the
 * review screen says as much about every number in here.
 */
export const STRETCH_ROUTINE_IDS = [
  'double-knee-to-chest',
  'supine-hamstring-stretch',
  'half-kneeling-hip-flexor',
  'childs-pose',
] as const;

/** Exercise ids of the maker's current back routine, used as the default routine. */
export const DEFAULT_ROUTINE_IDS = [
  'cat-camel',
  'glute-bridge',
  'dead-bug',
  'bird-dog',
  'front-plank',
] as const;
