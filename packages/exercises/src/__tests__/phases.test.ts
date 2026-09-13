/**
 * The derived shape of a repetition.
 *
 * These numbers are not asserted to the millisecond on purpose: they come out
 * of a filter and a synthesiser, and pinning them exactly would make the tests
 * fail for improvements rather than for regressions. What is worth asserting is
 * the shape — the order of the movements, that the first one opens the
 * repetition and the last one closes it, and that every phase the library
 * declares has words to say.
 */

import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../library/index.js';
import { phaseCueKey } from '../dictionary.js';
import { phaseMarks, phaseTimeline } from '../phases.js';

const byId = (id: string) => EXERCISES.find((exercise) => exercise.id === id)!;
const repExercises = EXERCISES.filter((exercise) => exercise.mode === 'reps');
const holdExercises = EXERCISES.filter((exercise) => exercise.mode === 'hold');

describe('phaseTimeline', () => {
  it('reads the three phases of a cat and camel in the order they happen', () => {
    const marks = phaseTimeline(byId('cat-camel')!);
    expect(marks.map((mark) => mark.phase)).toEqual(['cat', 'neutral', 'camel', 'neutral']);
  });

  it('opens the repetition with the first movement of the cycle', () => {
    // The cat starts at the top of the cycle, so it is not a reaction to
    // anything: it is where the repetition begins.
    const [first] = phaseTimeline(byId('cat-camel')!);
    expect(first?.at).toBe(0);
  });

  it('calls the bridge up early and down at the end of the hold, not on the way down', () => {
    // The `top` band is only entered when the hips are already well up. The mark
    // has to be walked back to where the lift began, or it arrives too late to
    // be an instruction at all.
    const marks = phaseTimeline(byId('glute-bridge')!);
    expect(marks.map((mark) => mark.phase)).toEqual(['top', 'rest']);
    expect(marks[0]?.at).toBeLessThan(0.2);
    expect(marks[1]?.at).toBeGreaterThan(0.55);
    expect(marks[1]?.at).toBeLessThan(0.8);
  });

  it.each(holdExercises.map((exercise) => exercise.id))('says nothing to pace in %s', (id) => {
    expect(phaseTimeline(byId(id)!)).toEqual([]);
  });

  it.each(repExercises.map((exercise) => exercise.id))(
    'describes a whole repetition of %s',
    (id) => {
      const exercise = byId(id)!;
      const marks = phaseTimeline(exercise);
      const declared = new Set(exercise.phases.map((phase) => phase.id));

      expect(marks.length).toBeGreaterThanOrEqual(2);
      // It starts near the top of the cycle and returns before the end of it.
      expect(marks[0]?.at).toBeLessThan(0.25);
      expect(marks[marks.length - 1]?.at).toBeLessThan(1);
      for (const mark of marks) {
        expect(declared).toContain(mark.phase);
        expect(mark.at).toBeGreaterThanOrEqual(0);
      }
      // Strictly in order, and never two words on the same instant.
      const gaps = marks.slice(1).map((mark, index) => mark.at - (marks[index]?.at ?? 0));
      for (const gap of gaps) expect(gap).toBeGreaterThan(0.05);
    },
  );

  it.each(repExercises.map((exercise) => exercise.id))('has something to say in %s', (id) => {
    const exercise = byId(id)!;
    for (const mark of phaseTimeline(exercise)) {
      expect(phaseCueKey(exercise.id, mark.phase)).toBeDefined();
    }
  });

  it('gives the same answer twice without deriving it twice', () => {
    const exercise = byId('bird-dog')!;
    expect(phaseMarks(exercise)).toBe(phaseMarks(exercise));
    expect(phaseMarks(exercise)).toEqual(phaseTimeline(exercise));
  });
});
