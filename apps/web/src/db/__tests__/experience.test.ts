/**
 * What the app knows about what somebody has already done.
 *
 * The demonstration before a session is decided from this, so the two rules
 * worth pinning down are the ones that would quietly show the wrong person the
 * wrong thing: a set done by voice counts, and being told to stop is read from
 * the profile rather than inferred.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db, type SetRecord } from '../schema.js';
import { dismissDemo, exerciseExperience, restoreDemos } from '../repositories.js';

async function profile(): Promise<number> {
  return (await db.profiles.add({
    name: 'Ana',
    color: '#d9702f',
    language: 'es',
    physioNotes: '',
    createdAt: Date.now(),
  } as never)) as number;
}

async function session(profileId: number, sets: Array<Partial<SetRecord>>): Promise<void> {
  const id = (await db.sessions.add({
    profileId,
    routineId: 1,
    startedAt: Date.now(),
  } as never)) as number;
  for (const [index, patch] of sets.entries()) {
    await db.sets.add({
      sessionId: id,
      exerciseId: 'glute-bridge',
      index,
      reps: 12,
      partials: 0,
      holdMs: 0,
      romMax: 170,
      romMean: 165,
      goodRepPct: 90,
      issues: {},
      peaks: [],
      startedAt: Date.now(),
      ...patch,
    } as never);
  }
}

describe('exerciseExperience', () => {
  beforeEach(async () => {
    await db.profiles.clear();
    await db.sessions.clear();
    await db.sets.clear();
  });

  it('knows nothing about somebody who has never done anything', async () => {
    const id = await profile();
    await expect(exerciseExperience(id)).resolves.toEqual({
      sessions: 0,
      done: new Set(),
      dismissed: new Set(),
    });
  });

  it('counts a set done by voice as having done the exercise', async () => {
    // The one place an unmeasured set counts for as much as a measured one:
    // the question is whether somebody knows the movement, not whether the
    // camera saw it.
    const id = await profile();
    await session(id, [{ measured: false }]);
    const experience = await exerciseExperience(id);
    expect(experience.done).toEqual(new Set(['glute-bridge']));
    expect(experience.sessions).toBe(1);
  });

  it('counts sessions that recorded something, not sessions that were opened', async () => {
    const id = await profile();
    await session(id, []);
    await session(id, [{}, {}]);
    await expect(exerciseExperience(id)).resolves.toMatchObject({ sessions: 1 });
  });

  it("keeps one person out of another's history", async () => {
    const mine = await profile();
    const theirs = await profile();
    await session(theirs, [{}]);
    await expect(exerciseExperience(mine)).resolves.toMatchObject({
      sessions: 0,
      done: new Set(),
    });
  });

  it('remembers being told to stop showing an exercise, and takes it back', async () => {
    const id = await profile();
    await dismissDemo(id, 'cat-camel');
    await dismissDemo(id, 'bird-dog');
    await dismissDemo(id, 'cat-camel');
    expect((await exerciseExperience(id)).dismissed).toEqual(new Set(['cat-camel', 'bird-dog']));

    await restoreDemos(id);
    expect((await exerciseExperience(id)).dismissed).toEqual(new Set());
  });

  it('does nothing rather than throwing for a profile that is gone', async () => {
    await expect(dismissDemo(999, 'cat-camel')).resolves.toBeUndefined();
  });
});
