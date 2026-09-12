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
export {
  METRIC_LABELS,
  PHASE_LABELS,
  phaseLabel,
  METRIC_DESCRIPTIONS,
  metricLabel,
  metricDescription,
  ENGINE_CUES,
  RULE_CUES,
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

/** Exercise ids of the maker's current back routine, used as the default routine. */
export const DEFAULT_ROUTINE_IDS = [
  'cat-camel',
  'glute-bridge',
  'dead-bug',
  'bird-dog',
  'front-plank',
] as const;
