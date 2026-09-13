import { describe, expect, it } from 'vitest';
import { dailySeries, subjectKey, subjectsIn } from '../progress.js';
import type { SetRecord } from '../../db/schema.js';

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
    startedAt: Date.UTC(2026, 8, 1, 9),
    ...patch,
  };
}

const day = (d: number, hour = 9): number => Date.UTC(2026, 8, d, hour);

describe('subjectsIn', () => {
  it('lists each exercise once, in the order it first appears', () => {
    const subjects = subjectsIn([
      set({ exerciseId: 'glute-bridge' }),
      set({ exerciseId: 'front-plank' }),
      set({ exerciseId: 'glute-bridge' }),
    ]);
    expect(subjects.map((s) => s.exerciseId)).toEqual(['glute-bridge', 'front-plank']);
  });

  it('splits a unilateral exercise into one subject per limb', () => {
    const subjects = subjectsIn([
      set({ exerciseId: 'split-squat', side: 'left' }),
      set({ exerciseId: 'split-squat', side: 'right' }),
      set({ exerciseId: 'split-squat', side: 'left' }),
    ]);
    expect(subjects).toEqual([
      { exerciseId: 'split-squat', side: 'left' },
      { exerciseId: 'split-squat', side: 'right' },
    ]);
  });

  it('keeps a sided and an unsided history of the same exercise apart', () => {
    // Sets recorded before the side existed are not the same subject as either
    // limb, and merging them would attribute somebody's old numbers to a leg.
    const subjects = subjectsIn([
      set({ exerciseId: 'split-squat' }),
      set({ exerciseId: 'split-squat', side: 'left' }),
    ]);
    expect(subjects).toHaveLength(2);
    expect(subjectKey(subjects[0]!)).toBe('split-squat');
    expect(subjectKey(subjects[1]!)).toBe('split-squat|left');
  });
});

describe('dailySeries', () => {
  const bridge = { exerciseId: 'glute-bridge' };

  it('gives one point per day, oldest first', () => {
    const points = dailySeries(
      [
        set({ exerciseId: 'glute-bridge', startedAt: day(3) }),
        set({ exerciseId: 'glute-bridge', startedAt: day(1) }),
        set({ exerciseId: 'glute-bridge', startedAt: day(1, 18) }),
      ],
      bridge,
      false,
    );
    expect(points.map((point) => point.day)).toEqual(['2026-09-01', '2026-09-03']);
  });

  it('takes the best peak of the day, and the lowest where smaller is better', () => {
    const sets = [
      set({ exerciseId: 'front-plank', romMax: 12, startedAt: day(1) }),
      set({ exerciseId: 'front-plank', romMax: 4, startedAt: day(1, 10) }),
    ];
    const plank = { exerciseId: 'front-plank' };
    expect(dailySeries(sets, plank, false)[0]?.rom).toBe(12);
    expect(dailySeries(sets, plank, true)[0]?.rom).toBe(4);
  });

  it('leaves a gap rather than a zero on a day that measured nothing', () => {
    // A null breaks the line; a zero would draw a cliff to the floor and read
    // as a catastrophic loss of range.
    const points = dailySeries(
      [set({ exerciseId: 'glute-bridge', romMax: 0, startedAt: day(1) })],
      bridge,
      false,
    );
    expect(points[0]?.rom).toBeNull();
    expect(points[0]?.reps).toBe(10);
  });

  it('sums repetitions and averages the good percentage across the day', () => {
    const points = dailySeries(
      [
        set({ exerciseId: 'glute-bridge', reps: 12, goodRepPct: 100, startedAt: day(1) }),
        set({ exerciseId: 'glute-bridge', reps: 8, goodRepPct: 50, startedAt: day(1, 10) }),
      ],
      bridge,
      false,
    );
    expect(points[0]).toMatchObject({ reps: 20, good: 75 });
  });

  it('plots one limb only', () => {
    const sets = [
      set({ exerciseId: 'split-squat', side: 'left', romMax: 104, startedAt: day(1) }),
      set({ exerciseId: 'split-squat', side: 'right', romMax: 131, startedAt: day(1) }),
    ];
    const left = dailySeries(sets, { exerciseId: 'split-squat', side: 'left' }, false);
    expect(left).toHaveLength(1);
    expect(left[0]?.rom).toBe(104);
  });

  it('ignores every other exercise', () => {
    const points = dailySeries(
      [set({ exerciseId: 'front-plank', startedAt: day(1) })],
      bridge,
      false,
    );
    expect(points).toEqual([]);
  });
});

describe('guided sets stay off the chart', () => {
  it('leaves a voice guided set out of the series', () => {
    // Not a bad day — a day with no reading. Drawing it would invent a dip.
    const points = dailySeries(
      [
        set({ exerciseId: 'glute-bridge', romMax: 172, startedAt: day(1) }),
        set({ exerciseId: 'glute-bridge', romMax: 0, measured: false, startedAt: day(2) }),
      ],
      { exerciseId: 'glute-bridge' },
      false,
    );
    expect(points.map((point) => point.day)).toEqual(['2026-09-01']);
  });

  it('does not offer an exercise that has only ever been guided', () => {
    const subjects = subjectsIn([
      set({ exerciseId: 'glute-bridge', measured: false }),
      set({ exerciseId: 'front-plank' }),
    ]);
    expect(subjects.map((s) => s.exerciseId)).toEqual(['front-plank']);
  });
});
