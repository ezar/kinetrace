/**
 * A published programme, once it has become a routine somebody can run.
 *
 * The transcription itself is tested in the library, against the document.
 * What matters here is what survives the trip into the database: the order,
 * the doses, the citation, the document's own words, and the fact that opening
 * the programme twice does not leave the person with two of it.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { SERMEF_LUMBAR } from '@kinetrace/exercises';
import { db } from '../schema.js';
import { createProgrammeRoutine, openProgrammeRoutine, saveRoutine } from '../repositories.js';

async function profile(): Promise<number> {
  return (await db.profiles.add({
    name: 'Ana',
    color: '#d9702f',
    language: 'es',
    physioNotes: '',
    createdAt: Date.now(),
  } as never)) as number;
}

describe('a programme as a routine', () => {
  beforeEach(async () => {
    await db.routines.clear();
    await db.profiles.clear();
  });

  it('keeps the exercises in the order the document prints them', async () => {
    const id = await createProgrammeRoutine(await profile(), 'SERMEF', SERMEF_LUMBAR);
    const routine = await db.routines.get(id);
    expect(routine?.exercises.map((entry) => entry.exerciseId)).toEqual([
      'pelvic-tilt',
      'double-knee-to-chest',
      'glute-bridge',
      'childs-pose',
      'cat-camel',
    ]);
  });

  it('carries the printed doses, including the holds as a pace', async () => {
    const id = await createProgrammeRoutine(await profile(), 'SERMEF', SERMEF_LUMBAR);
    const routine = await db.routines.get(id);
    const byId = new Map((routine?.exercises ?? []).map((entry) => [entry.exerciseId, entry]));

    expect(byId.get('pelvic-tilt')).toMatchObject({ sets: 1, reps: 10, restSeconds: 0 });
    expect(byId.get('pelvic-tilt')?.tempo).toEqual([{ phase: 'tilted', seconds: 5 }]);
    expect(byId.get('double-knee-to-chest')).toMatchObject({ sets: 10, holdSeconds: 5 });
    expect(byId.get('childs-pose')).toMatchObject({ sets: 4, holdSeconds: 10 });
    expect(byId.get('cat-camel')?.tempo).toHaveLength(2);
  });

  it('cites the document on the routine and quotes it on every exercise', async () => {
    const id = await createProgrammeRoutine(await profile(), 'SERMEF', SERMEF_LUMBAR);
    const routine = await db.routines.get(id);

    expect(routine?.source?.programmeId).toBe('sermef-lumbar');
    expect(routine?.source?.publisher).toContain('SERMEF');
    for (const entry of routine?.exercises ?? []) {
      expect(entry.sourceNote, entry.exerciseId).toBeTruthy();
    }
    expect(routine?.exercises[0]?.sourceNote).toContain('Báscula pélvica en supino');
  });

  it('is unsigned: a citation is not a professional', async () => {
    const id = await createProgrammeRoutine(await profile(), 'SERMEF', SERMEF_LUMBAR);
    expect((await db.routines.get(id))?.review).toBeUndefined();
  });

  it('opens the same routine twice rather than making a second copy', async () => {
    const profileId = await profile();
    const first = await openProgrammeRoutine(profileId, 'SERMEF', SERMEF_LUMBAR);
    const second = await openProgrammeRoutine(profileId, 'SERMEF', SERMEF_LUMBAR);
    expect(second).toBe(first);
    expect(await db.routines.count()).toBe(1);
  });

  it('still recognises it after somebody has edited the exercises', async () => {
    const profileId = await profile();
    const id = await openProgrammeRoutine(profileId, 'SERMEF', SERMEF_LUMBAR);
    const routine = await db.routines.get(id);
    await saveRoutine({
      id,
      profileId,
      name: 'SERMEF',
      exercises: (routine?.exercises ?? []).slice(0, 2),
    });

    expect(await openProgrammeRoutine(profileId, 'SERMEF', SERMEF_LUMBAR)).toBe(id);
    expect((await db.routines.get(id))?.source?.programmeId).toBe('sermef-lumbar');
  });

  it('keeps one profile\u2019s copy out of another\u2019s', async () => {
    const ana = await profile();
    const luis = await profile();
    const first = await openProgrammeRoutine(ana, 'SERMEF', SERMEF_LUMBAR);
    const second = await openProgrammeRoutine(luis, 'SERMEF', SERMEF_LUMBAR);
    expect(second).not.toBe(first);
  });
});
