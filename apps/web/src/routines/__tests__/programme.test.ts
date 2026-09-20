/**
 * Whether a routine is still the document it cites.
 *
 * The citation panel and the review card both ask this before repeating the
 * claim, and both got it wrong the first time: they said "copied from the
 * document" over numbers somebody had since changed, and over a routine a
 * professional had since signed. The answer has to come from comparing the
 * numbers, not from the citation merely existing.
 */

import { describe, expect, it } from 'vitest';
import { SERMEF_LUMBAR, programmeDoses } from '@kinetrace/exercises';
import type { RoutineExercise } from '../../db/schema.js';
import {
  isUnchangedTranscription,
  matchesProgrammeDose,
  programmeDoseFor,
  routineProgramme,
} from '../programme.js';

/** The routine `createProgrammeRoutine` builds, without going through Dexie. */
function transcribed(): RoutineExercise[] {
  return programmeDoses(SERMEF_LUMBAR).map((dose) => ({
    exerciseId: dose.exerciseId,
    sets: dose.sets,
    ...(dose.reps === undefined ? {} : { reps: dose.reps }),
    ...(dose.holdSeconds === undefined ? {} : { holdSeconds: dose.holdSeconds }),
    restSeconds: dose.restSeconds,
    ...(dose.tempo ? { tempo: [...dose.tempo] } : {}),
  }));
}

describe('routineProgramme', () => {
  it('finds the transcription a routine cites', () => {
    const found = routineProgramme({
      programmeId: 'sermef-lumbar',
      title: 'x',
      publisher: 'y',
      year: 2013,
    });
    expect(found?.id).toBe('sermef-lumbar');
  });

  it('returns nothing for a routine with no citation, or one this build lost', () => {
    expect(routineProgramme(undefined)).toBeUndefined();
    expect(
      routineProgramme({ programmeId: 'gone', title: 'x', publisher: 'y', year: 2013 }),
    ).toBeUndefined();
  });
});

describe('isUnchangedTranscription', () => {
  it('says yes to the routine the programme builds', () => {
    expect(isUnchangedTranscription(transcribed(), SERMEF_LUMBAR)).toBe(true);
  });

  it('says no once a dose is changed', () => {
    const edited = transcribed();
    const first = edited[0];
    if (first) edited[0] = { ...first, sets: first.sets + 1 };
    expect(isUnchangedTranscription(edited, SERMEF_LUMBAR)).toBe(false);
  });

  it('says no once a rest is added, which the document never prints', () => {
    const edited = transcribed();
    const first = edited[0];
    if (first) edited[0] = { ...first, restSeconds: 30 };
    expect(isUnchangedTranscription(edited, SERMEF_LUMBAR)).toBe(false);
  });

  it('says no once the pace stops being the printed hold', () => {
    const edited = transcribed();
    const paced = edited.findIndex((entry) => entry.tempo);
    const entry = edited[paced];
    if (entry) edited[paced] = { ...entry, tempo: [{ phase: 'top', seconds: 2 }] };
    expect(isUnchangedTranscription(edited, SERMEF_LUMBAR)).toBe(false);
  });

  it('says no to a reordering, because the order is part of the document', () => {
    const edited = transcribed().reverse();
    expect(isUnchangedTranscription(edited, SERMEF_LUMBAR)).toBe(false);
  });

  it('says no when an exercise is added or dropped', () => {
    expect(isUnchangedTranscription(transcribed().slice(1), SERMEF_LUMBAR)).toBe(false);
  });
});

describe('matchesProgrammeDose', () => {
  it('covers an entry the document prints, and nothing else', () => {
    const entries = transcribed();
    for (const entry of entries) {
      const printed = programmeDoseFor(SERMEF_LUMBAR, entry.exerciseId);
      expect(printed, entry.exerciseId).toBeDefined();
      if (printed) expect(matchesProgrammeDose(entry, printed)).toBe(true);
    }
  });

  it('stops covering it the moment the number changes', () => {
    const entry = transcribed()[0];
    const printed = entry ? programmeDoseFor(SERMEF_LUMBAR, entry.exerciseId) : undefined;
    expect(printed).toBeDefined();
    if (entry && printed) {
      expect(matchesProgrammeDose({ ...entry, sets: entry.sets + 2 }, printed)).toBe(false);
    }
  });

  it('knows nothing about an exercise the document does not print', () => {
    expect(programmeDoseFor(SERMEF_LUMBAR, 'front-plank')).toBeUndefined();
  });
});
