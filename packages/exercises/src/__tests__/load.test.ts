/**
 * Counting which way a routine leans.
 *
 * The one thing worth pinning down beyond the arithmetic: this counts and says
 * nothing else. No warning, no ordering by severity, no opinion about which
 * direction a routine ought to have.
 */

import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../library/index.js';
import { spinalLoadMix, SPINAL_LOAD_ORDER } from '../load.js';

const byId = (id: string) => EXERCISES.find((exercise) => exercise.id === id)!;

describe('spinalLoadMix', () => {
  it('has nothing to say about an empty routine', () => {
    expect(spinalLoadMix([])).toEqual([]);
  });

  it('counts each direction somebody prescribed', () => {
    const mix = spinalLoadMix([byId('knee-to-chest'), byId('prone-press-up'), byId('bird-dog')]);
    expect(mix).toEqual([
      ['neutral', 1],
      ['flexion', 1],
      ['extension', 1],
    ]);
  });

  it('counts an exercise once however many sets it has', () => {
    // Three sets of one exercise is one decision about direction.
    const mix = spinalLoadMix([byId('knee-to-chest'), byId('knee-to-chest'), byId('pelvic-tilt')]);
    expect(mix).toEqual([['flexion', 2]]);
  });

  it('leaves out a direction nobody prescribed rather than showing a zero', () => {
    expect(spinalLoadMix([byId('cat-camel')])).toEqual([['mixed', 1]]);
  });

  it('keeps a fixed order, so a summary does not reshuffle as a routine is edited', () => {
    const mix = spinalLoadMix([byId('prone-press-up'), byId('bird-dog'), byId('knee-to-chest')]);
    expect(mix.map(([load]) => load)).toEqual(['neutral', 'flexion', 'extension']);
  });

  it('can describe every exercise in the library', () => {
    for (const exercise of EXERCISES) {
      expect(SPINAL_LOAD_ORDER).toContain(exercise.spinalLoad);
    }
  });
});
