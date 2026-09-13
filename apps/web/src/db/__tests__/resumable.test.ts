/**
 * Which unfinished session is worth offering to continue.
 *
 * The rule that needs a test is the one the guided mode added: a session done
 * by voice is stepped over rather than ending the search, because resuming
 * leads to the measured session — the one mode the person could not use that
 * day — and a guided set holds no measurement worth preserving.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db, type SetRecord } from '../schema.js';
import { resumableSession } from '../repositories.js';

async function session(startedAt: number, sets: Array<Partial<SetRecord>>): Promise<number> {
  const id = (await db.sessions.add({ profileId: 1, routineId: 1, startedAt } as never)) as number;
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
      startedAt,
      ...patch,
    } as never);
  }
  return id;
}

const minutesAgo = (n: number): number => Date.now() - n * 60_000;

describe('resumableSession', () => {
  beforeEach(async () => {
    await db.sessions.clear();
    await db.sets.clear();
  });

  it('offers the most recent unfinished session that recorded something', async () => {
    const id = await session(minutesAgo(30), [{}, {}]);
    await expect(resumableSession(1)).resolves.toMatchObject({ session: { id }, nextIndex: 2 });
  });

  it('does not offer a session done by voice', async () => {
    await session(minutesAgo(10), [{ measured: false }, { measured: false }]);
    await expect(resumableSession(1)).resolves.toBeUndefined();
  });

  it('steps over a guided session to reach an older measured one', async () => {
    // The bug this exists for: rejecting the newest session outright also hid
    // the one behind it, which was genuinely resumable.
    const measured = await session(minutesAgo(120), [{}]);
    await session(minutesAgo(10), [{ measured: false }]);
    await expect(resumableSession(1)).resolves.toMatchObject({ session: { id: measured } });
  });

  it('offers a session that mixes measured and guided sets', async () => {
    const id = await session(minutesAgo(20), [{}, { measured: false }]);
    await expect(resumableSession(1)).resolves.toMatchObject({ session: { id } });
  });

  it('offers nothing when a session recorded no sets at all', async () => {
    await session(minutesAgo(5), []);
    await expect(resumableSession(1)).resolves.toBeUndefined();
  });

  it('offers nothing from yesterday', async () => {
    await session(minutesAgo(13 * 60), [{}]);
    await expect(resumableSession(1)).resolves.toBeUndefined();
  });
});
