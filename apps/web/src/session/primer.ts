/**
 * Which exercises to show before a session starts.
 *
 * Counting repetitions at somebody who has never seen the movement is not
 * coaching, it is a metronome. So before the work begins the app shows what the
 * exercise looks like — the same animated figure the library shows, built from
 * the exercise's own reference motion.
 *
 * It does not do this forever, and there are three ways out. It stops on its
 * own once somebody has done the exercise; it stops for everything after the
 * first few sessions; and "I know this one" stops it for that exercise from the
 * next session onwards. An app that will not get out of the way is an app
 * people stop opening.
 *
 * Being told to stop wins over every other rule, including `always` — it is the
 * most specific thing anybody has said — and settings can take it all back at
 * once, because nobody should have to live with a button they meant to miss.
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
    if (experience.dismissed.has(item.exerciseId)) continue;
    if (setting === 'new' && !settlingIn && experience.done.has(item.exerciseId)) continue;
    ids.push(item.exerciseId);
  }
  return ids;
}
