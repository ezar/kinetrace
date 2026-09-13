/**
 * Who gets shown what, and — the half that matters more — who stops being
 * shown it.
 */

import { describe, expect, it } from 'vitest';
import { getExercise } from '@kinetrace/exercises';
import { primerFor, SETTLING_IN_SESSIONS } from '../primer.js';
import type { PlanItem } from '../plan.js';

function item(exerciseId: string, setNumber = 1): PlanItem {
  return {
    index: setNumber - 1,
    exerciseId,
    exercise: getExercise(exerciseId),
    setNumber,
    totalSets: 2,
    reps: 10,
    restSeconds: 30,
    tracked: true,
  } as PlanItem;
}

const plan = [item('cat-camel', 1), item('cat-camel', 2), item('glute-bridge', 1)];
const veteran = {
  sessions: 20,
  done: new Set(['cat-camel', 'glute-bridge']),
  dismissed: new Set<string>(),
};

describe('primerFor', () => {
  it('shows each exercise once, however many sets it has', () => {
    expect(primerFor(plan, { sessions: 0, done: new Set(), dismissed: new Set() }, 'new')).toEqual([
      'cat-camel',
      'glute-bridge',
    ]);
  });

  it('gets out of the way once the exercises are familiar', () => {
    expect(primerFor(plan, veteran, 'new')).toEqual([]);
  });

  it('shows only the exercise that is new', () => {
    const experience = { sessions: 20, done: new Set(['cat-camel']), dismissed: new Set<string>() };
    expect(primerFor(plan, experience, 'new')).toEqual(['glute-bridge']);
  });

  it('shows everything while the first sessions are still settling in', () => {
    // Even an exercise already done: at session two nothing is a habit yet.
    const experience = {
      sessions: SETTLING_IN_SESSIONS - 1,
      done: new Set(['cat-camel']),
      dismissed: new Set<string>(),
    };
    expect(primerFor(plan, experience, 'new')).toEqual(['cat-camel', 'glute-bridge']);
  });

  it('stops on the session that ends the settling in', () => {
    const experience = {
      sessions: SETTLING_IN_SESSIONS,
      done: new Set(['cat-camel']),
      dismissed: new Set<string>(),
    };
    expect(primerFor(plan, experience, 'new')).toEqual(['glute-bridge']);
  });

  it('stops showing an exercise somebody has said they already know', () => {
    // From the next session, not this one: the button also moves on.
    const experience = { sessions: 0, done: new Set<string>(), dismissed: new Set(['cat-camel']) };
    expect(primerFor(plan, experience, 'new')).toEqual(['glute-bridge']);
  });

  it('takes being told to stop over being told to always show', () => {
    // "I know this one" is the more specific thing somebody said, and settings
    // can take it back for everything at once.
    const experience = { sessions: 0, done: new Set<string>(), dismissed: new Set(['cat-camel']) };
    expect(primerFor(plan, experience, 'always')).toEqual(['glute-bridge']);
  });

  it('shows nothing at all when that is what was asked for', () => {
    expect(
      primerFor(plan, { sessions: 0, done: new Set(), dismissed: new Set() }, 'never'),
    ).toEqual([]);
  });

  it('shows everything when that is what was asked for', () => {
    expect(primerFor(plan, veteran, 'always')).toEqual(['cat-camel', 'glute-bridge']);
  });

  it('has nothing to show for a line the library cannot track', () => {
    const untracked = [{ ...item('cat-camel'), exercise: undefined, tracked: false } as PlanItem];
    expect(
      primerFor(untracked, { sessions: 0, done: new Set(), dismissed: new Set() }, 'always'),
    ).toEqual([]);
  });
});
