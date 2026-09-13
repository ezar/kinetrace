/**
 * Which way a set of exercises loads the lower back.
 *
 * A prescription for a lumbar spine is partly a choice about direction, and a
 * routine is easy to assemble without noticing which way it leans — three
 * exercises that all reduce the lumbar curve do not announce themselves as a
 * group. This counts them so the review screen can show it.
 *
 * It counts. It does not recommend, warn, reorder or exclude: which way a
 * routine ought to lean belongs to the professional reading it, and nothing in
 * the app is allowed to have an opinion about it.
 */

import type { ExerciseDefinition, SpinalLoad } from './types.js';

/** Fixed order, so a routine's summary does not reshuffle as it is edited. */
export const SPINAL_LOAD_ORDER: readonly SpinalLoad[] = [
  'neutral',
  'flexion',
  'extension',
  'rotation',
  'mixed',
];

/**
 * How many distinct exercises pull each way, largest first among equals in the
 * declared order. Directions nobody prescribed are left out rather than shown
 * as zero.
 *
 * Distinct exercises rather than sets: three sets of one exercise is one
 * decision about direction, not three.
 */
export function spinalLoadMix(
  exercises: ReadonlyArray<Pick<ExerciseDefinition, 'id' | 'spinalLoad'>>,
): Array<[SpinalLoad, number]> {
  const counted = new Map<SpinalLoad, Set<string>>();
  for (const exercise of exercises) {
    const seen = counted.get(exercise.spinalLoad) ?? new Set<string>();
    seen.add(exercise.id);
    counted.set(exercise.spinalLoad, seen);
  }
  return SPINAL_LOAD_ORDER.filter((load) => counted.has(load)).map((load) => [
    load,
    counted.get(load)?.size ?? 0,
  ]);
}
