/**
 * Which exercises to show before a session starts.
 *
 * Counting repetitions at somebody who has never seen the movement is not
 * coaching, it is a metronome. So before the work begins the app shows what the
 * exercise looks like — the same animated figure the library shows, built from
 * the exercise's own reference motion.
 *
 * It does not do this forever. Once somebody has done an exercise a few times
 * the demonstration is in the way, and an app that will not get out of the way
 * is an app people stop opening. The default is therefore to show an exercise
 * that is new to this profile, and to show everything for the first few
 * sessions, when nothing is familiar yet and the habit is not formed.
 */

import type { ExerciseExperience } from '../db/repositories.js';
import type { PlanItem } from './plan.js';

/**
 * Sessions during which everything still gets shown.
 *
 * Three, because the first is the one where nothing is familiar, and by the
 * fourth somebody who has turned up three times knows what they are doing.
 */
export const SETTLING_IN_SESSIONS = 3;

export type ShowDemo = 'new' | 'always' | 'never';

/**
 * The exercises worth showing, in the order the routine does them and without
 * repeating one that appears in several sets.
 *
 * An item the library cannot track — a line kept from an imported sheet — has
 * no reference motion and so nothing to show.
 */
export function primerFor(
  plan: readonly PlanItem[],
  experience: ExerciseExperience,
  setting: ShowDemo,
): string[] {
  if (setting === 'never') return [];
  const settlingIn = experience.sessions < SETTLING_IN_SESSIONS;
  const ids: string[] = [];
  for (const item of plan) {
    if (!item.exercise) continue;
    if (ids.includes(item.exerciseId)) continue;
    if (setting === 'new' && !settlingIn && experience.done.has(item.exerciseId)) continue;
    ids.push(item.exerciseId);
  }
  return ids;
}
