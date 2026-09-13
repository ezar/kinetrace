import { describe, expect, it } from 'vitest';
import { getExercise } from '@kinetrace/exercises';
import { reportRows } from '../report.js';
import type { PrescribedSide, Routine, SetRecord } from '../../db/schema.js';

let nextId = 1;

function set(patch: Partial<SetRecord> & { exerciseId: string }): SetRecord {
  return {
    id: nextId++,
    sessionId: 1,
    index: 0,
    reps: 10,
    partials: 0,
    holdMs: 0,
    romMax: 170,
    romMean: 165,
    goodRepPct: 90,
    issues: {},
    peaks: [],
    startedAt: Date.UTC(2026, 8, 1),
    ...patch,
  };
}

const noRoutines: Routine[] = [];
const rows = (sets: SetRecord[], routines: Routine[] = noRoutines) =>
  reportRows({ sets, routines, getExercise });

describe('reportRows', () => {
  it('sums the sets of one exercise into a single row', () => {
    const result = rows([
      set({ exerciseId: 'glute-bridge', reps: 12, partials: 1 }),
      set({ exerciseId: 'glute-bridge', reps: 10, partials: 2 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sets: 2, reps: 22, partials: 3 });
  });

  it('reports each side of a unilateral exercise separately', () => {
    // The split squat is judged on knee flexion, which falls as the person goes
    // down: the band is 80 to 105 degrees and the best peak is the lowest one.
    // So the left leg gets into range and the right stops 26 degrees short.
    const result = rows([
      set({ exerciseId: 'split-squat', side: 'left', romMax: 108 }),
      set({ exerciseId: 'split-squat', side: 'left', romMax: 104 }),
      set({ exerciseId: 'split-squat', side: 'right', romMax: 131 }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((row) => row.side)).toEqual(['left', 'right']);
    // The whole point of the split: the limited leg keeps its own number
    // instead of being hidden behind the good one.
    expect(result[0]).toMatchObject({ side: 'left', sets: 2, best: 104 });
    expect(result[1]).toMatchObject({ side: 'right', sets: 1, best: 131 });
  });

  it('keeps a bilateral exercise as one row with no side', () => {
    const result = rows([set({ exerciseId: 'glute-bridge' })]);
    expect(result[0]?.side).toBeUndefined();
  });

  it('takes the lowest peak as the best where the target is to decrease', () => {
    // The front plank is judged on trunk line deviation: closer to zero is better.
    const plank = getExercise('front-plank');
    expect(plank?.targets.direction).toBe('decrease');
    const result = rows([
      set({ exerciseId: 'front-plank', romMax: 12 }),
      set({ exerciseId: 'front-plank', romMax: 5 }),
    ]);
    expect(result[0]?.best).toBe(5);
  });

  it('leaves a set that measured nothing out of the range', () => {
    // Tracking lost mid-set writes a peak of zero. Averaging it in would report
    // a range half what the person actually reached.
    const result = rows([
      set({ exerciseId: 'glute-bridge', romMax: 170 }),
      set({ exerciseId: 'glute-bridge', romMax: 0 }),
    ]);
    expect(result[0]).toMatchObject({ best: 170, mean: 170, sets: 2 });
  });

  it('reports zero rather than a range when nothing was measured at all', () => {
    const result = rows([set({ exerciseId: 'glute-bridge', romMax: 0 })]);
    expect(result[0]).toMatchObject({ best: 0, mean: 0 });
  });

  it('marks a hold so the page knows not to print a range', () => {
    const result = rows([set({ exerciseId: 'front-plank', holdMs: 30_000, reps: 0 })]);
    expect(result[0]).toMatchObject({ isHold: true, holdMinutes: 1 });
  });

  it('counts the corrections and keeps the three most frequent', () => {
    const result = rows([
      set({ exerciseId: 'glute-bridge', issues: { pace: 2, squeeze: 1 } }),
      set({ exerciseId: 'glute-bridge', issues: { pace: 3 } }),
    ]);
    expect(result[0]?.issues).toEqual([
      { ruleId: 'pace', count: 5 },
      { ruleId: 'squeeze', count: 1 },
    ]);
  });

  it('reports the target the routine set, and who set it', () => {
    const routine: Routine = {
      id: 1,
      profileId: 1,
      name: 'Espalda',
      exercises: [
        {
          exerciseId: 'glute-bridge',
          sets: 3,
          reps: 12,
          restSeconds: 45,
          band: { min: 150, max: 185 },
        },
      ],
      review: { by: 'Dra. Ruiz', at: Date.UTC(2026, 8, 2) },
      createdAt: 0,
      updatedAt: 0,
    };
    const result = rows([set({ exerciseId: 'glute-bridge' })], [routine]);
    expect(result[0]?.target).toEqual({ min: 150, max: 185 });
    expect(result[0]?.targetBy).toBe('Dra. Ruiz');
  });

  it('falls back to the library target when no routine prescribes one', () => {
    const library = getExercise('glute-bridge')?.targets.band;
    const result = rows([set({ exerciseId: 'glute-bridge' })]);
    expect(result[0]?.target).toEqual(library);
    expect(result[0]?.targetBy).toBeUndefined();
  });

  it('drops sets whose exercise the library no longer knows', () => {
    const result = rows([
      set({ exerciseId: 'glute-bridge' }),
      set({ exerciseId: 'an-exercise-that-was-removed' }),
    ]);
    expect(result).toHaveLength(1);
  });

  it('has nothing to say about an empty history', () => {
    expect(rows([])).toEqual([]);
  });
});

describe('reportRows · sides that were never recorded', () => {
  it('groups sets written before the side existed as one row', () => {
    // Every routine run before the field was added has no side on its sets, and
    // reporting them as an unlabelled pair would invent a distinction.
    const older: PrescribedSide | undefined = undefined;
    const result = rows([
      set({ exerciseId: 'split-squat', ...(older ? { side: older } : {}) }),
      set({ exerciseId: 'split-squat' }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.side).toBeUndefined();
  });
});

describe('reportRows · sets nobody measured', () => {
  it('counts a guided set as done, and leaves it out of the range', () => {
    // The numbers on a guided set are the prescription, not an observation.
    const result = rows([
      set({ exerciseId: 'glute-bridge', romMax: 176, goodRepPct: 92 }),
      set({ exerciseId: 'glute-bridge', romMax: 0, goodRepPct: 0, measured: false }),
    ]);
    expect(result[0]).toMatchObject({ sets: 2, guidedSets: 1, best: 176, mean: 176, goodPct: 92 });
  });

  it('still counts the repetitions, because turning up is the point', () => {
    const result = rows([
      set({ exerciseId: 'glute-bridge', reps: 12 }),
      set({ exerciseId: 'glute-bridge', reps: 12, measured: false }),
    ]);
    expect(result[0]?.reps).toBe(24);
  });

  it('gives no percentage at all when nothing in the row was measured', () => {
    // Zero would read as "failed every repetition"; null is "no reading".
    const result = rows([
      set({ exerciseId: 'glute-bridge', romMax: 0, goodRepPct: 0, measured: false }),
    ]);
    expect(result[0]).toMatchObject({ sets: 1, guidedSets: 1, goodPct: null, best: 0 });
  });

  it('treats every set recorded before the flag existed as measured', () => {
    const result = rows([set({ exerciseId: 'glute-bridge', goodRepPct: 88 })]);
    expect(result[0]).toMatchObject({ guidedSets: 0, goodPct: 88 });
  });
});

describe('the report says a row was not measured rather than measuring nothing', () => {
  it('reports no range for a row whose sets were all guided', () => {
    // `0° / 0°` reads as a measurement of nothing rather than the absence of
    // one — the mistake the hold column already made once.
    const result = rows([
      set({ exerciseId: 'glute-bridge', romMax: 0, romMean: 0, measured: false }),
      set({ exerciseId: 'glute-bridge', romMax: 0, romMean: 0, measured: false }),
    ]);
    expect(result[0]).toMatchObject({ sets: 2, guidedSets: 2, best: 0, mean: 0, goodPct: null });
    // The screen decides from these two numbers; this is the condition it uses.
    expect((result[0]?.sets ?? 0) - (result[0]?.guidedSets ?? 0)).toBe(0);
  });
});
