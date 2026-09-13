import { describe, expect, it } from 'vitest';
import { getExercise } from '@kinetrace/exercises';
import { summariseExercise } from '../summary.js';
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
    startedAt: Date.UTC(2026, 8, 1),
    ...patch,
  };
}

const bridge = getExercise('glute-bridge');

describe('summariseExercise', () => {
  it('reports the range and the share of good repetitions for a measured set', () => {
    const summary = summariseExercise(
      [set({ exerciseId: 'glute-bridge', reps: 9, partials: 1 })],
      bridge,
    );
    expect(summary.measured).toBe(true);
    expect(summary.reps).toBe(9);
    expect(summary.goodPct).toBe(90);
    expect(summary.romBest).toBe(170);
    expect(summary.romMean).toBe(165);
  });

  it('claims no range and no percentage for a session done without the camera', () => {
    const summary = summariseExercise(
      [
        set({ exerciseId: 'glute-bridge', measured: false, romMax: 0, romMean: 0, goodRepPct: 0 }),
        set({ exerciseId: 'glute-bridge', measured: false, romMax: 0, romMean: 0, goodRepPct: 0 }),
      ],
      bridge,
    );
    expect(summary.measured).toBe(false);
    expect(summary.goodPct).toBeNull();
    expect(summary.romBest).toBeUndefined();
    expect(summary.romMean).toBeUndefined();
    // The repetitions are still worth reporting — they are what was asked for,
    // and `measured` is what says so.
    expect(summary.sets).toBe(2);
    expect(summary.reps).toBe(20);
  });

  it('gives no percentage for a measured set that produced nothing', () => {
    // Tracking lost the whole set. The old fallback called that a hundred per
    // cent: zero repetitions, all of them good.
    const summary = summariseExercise(
      [set({ exerciseId: 'glute-bridge', reps: 0, partials: 0, romMax: 0, romMean: 0 })],
      bridge,
    );
    expect(summary.measured).toBe(true);
    expect(summary.goodPct).toBeNull();
  });

  it('counts a mixed exercise on what was actually watched', () => {
    const summary = summariseExercise(
      [
        set({ exerciseId: 'glute-bridge', reps: 8, partials: 2 }),
        set({ exerciseId: 'glute-bridge', reps: 10, measured: false, romMax: 0, romMean: 0 }),
      ],
      bridge,
    );
    expect(summary.measured).toBe(true);
    expect(summary.allMeasured).toBe(false);
    expect(summary.reps).toBe(18);
    // Eight of the ten repetitions somebody watched were complete — which is
    // not a fact about the eighteen it would be printed beside. No share.
    expect(summary.goodPct).toBeNull();
  });

  it('takes no correction from a set nobody watched', () => {
    const summary = summariseExercise(
      [
        set({
          exerciseId: 'glute-bridge',
          measured: false,
          romMax: 0,
          romMean: 0,
          issues: { 'rib-flare': 3 },
        }),
      ],
      bridge,
    );
    expect(summary.topIssues).toEqual([]);
  });

  it('orders corrections by how often they came up, and keeps three', () => {
    const summary = summariseExercise(
      [
        set({ exerciseId: 'glute-bridge', issues: { a: 1, b: 5, c: 3, d: 4 } }),
        set({ exerciseId: 'glute-bridge', issues: { a: 1 } }),
      ],
      bridge,
    );
    expect(summary.topIssues).toEqual([
      ['b', 5],
      ['d', 4],
      ['c', 3],
    ]);
  });

  it('takes the smallest range as the best one where less is the goal', () => {
    const cat = getExercise('cat-camel');
    const summary = summariseExercise(
      [set({ exerciseId: 'cat-camel', romMax: 40 }), set({ exerciseId: 'cat-camel', romMax: 25 })],
      cat,
    );
    expect(summary.romBest).toBe(cat?.targets.direction === 'decrease' ? 25 : 40);
  });
});
