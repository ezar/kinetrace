import { describe, expect, it } from 'vitest';
import { buildPlan, estimateMinutes } from '../plan.js';
import type { Routine, RoutineExercise } from '../../db/schema.js';

function routine(...exercises: RoutineExercise[]): Pick<Routine, 'exercises'> {
  return { exercises };
}

const bridge: RoutineExercise = {
  exerciseId: 'glute-bridge',
  sets: 3,
  reps: 12,
  restSeconds: 45,
};
const splitSquat: RoutineExercise = {
  exerciseId: 'split-squat',
  sets: 3,
  reps: 10,
  restSeconds: 45,
};

describe('buildPlan', () => {
  it('gives a bilateral exercise one set per prescribed set, and no side', () => {
    const plan = buildPlan(routine(bridge));
    expect(plan).toHaveLength(3);
    expect(plan.every((item) => item.side === undefined)).toBe(true);
    expect(plan.map((item) => item.setNumber)).toEqual([1, 2, 3]);
  });

  it('runs both sides of a unilateral exercise when none is named', () => {
    // Which is also what every routine written before the field existed means.
    const plan = buildPlan(routine(splitSquat));
    expect(plan).toHaveLength(6);
    expect(plan.map((item) => item.side)).toEqual([
      'left',
      'left',
      'left',
      'right',
      'right',
      'right',
    ]);
  });

  it('counts sets within a side, not across both', () => {
    // "Set 2 of 3" has to mean the same thing on the second leg as the first.
    const plan = buildPlan(routine(splitSquat));
    expect(plan.map((item) => item.setNumber)).toEqual([1, 2, 3, 1, 2, 3]);
    expect(plan.every((item) => item.totalSets === 3)).toBe(true);
  });

  it('runs one side only when the prescription names one', () => {
    const plan = buildPlan(routine({ ...splitSquat, side: 'right' }));
    expect(plan).toHaveLength(3);
    expect(plan.every((item) => item.side === 'right')).toBe(true);
  });

  it('keeps the position in the session continuous across the two sides', () => {
    const plan = buildPlan(routine(bridge, splitSquat));
    expect(plan.map((item) => item.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('ignores the side on an exercise the library does not know', () => {
    const plan = buildPlan(routine({ exerciseId: 'from-a-sheet', sets: 2, restSeconds: 30 }));
    expect(plan).toHaveLength(2);
    expect(plan.every((item) => item.tracked === false)).toBe(true);
    expect(plan.every((item) => item.side === undefined)).toBe(true);
  });
});

describe('estimateMinutes', () => {
  it('counts both sides of a unilateral exercise as twice the work', () => {
    const oneSide = estimateMinutes(routine({ ...splitSquat, side: 'left' }));
    const bothSides = estimateMinutes(routine(splitSquat));
    // A routine that claims ten minutes and takes twenty is worse than no
    // estimate at all.
    expect(bothSides).toBeGreaterThan(oneSide);
  });

  it('never claims a routine takes no time', () => {
    expect(estimateMinutes(routine())).toBe(1);
  });
});
