import { describe, expect, it } from 'vitest';
import { getExercise } from '@kinetrace/exercises';
import type { ExerciseDefinition } from '@kinetrace/exercises';
import { prescribedTarget } from '../target.js';
import type { Routine } from '../../db/schema.js';

const bridge = getExercise('glute-bridge') as ExerciseDefinition;

function routine(patch: Partial<Routine>): Routine {
  return {
    id: 1,
    profileId: 1,
    name: 'Rutina',
    exercises: [{ exerciseId: 'glute-bridge', sets: 3, reps: 12, restSeconds: 45 }],
    createdAt: 0,
    updatedAt: 1000,
    ...patch,
  } as Routine;
}

describe('prescribedTarget', () => {
  it('falls back to the library when nobody has set anything', () => {
    const target = prescribedTarget([routine({})], 'glute-bridge', bridge);
    expect(target.band).toEqual(bridge.targets.band);
    expect(target.prescribed).toBe(false);
    expect(target.by).toBeUndefined();
  });

  it('uses the band the routine carries', () => {
    const target = prescribedTarget(
      [
        routine({
          exercises: [
            {
              exerciseId: 'glute-bridge',
              sets: 3,
              reps: 12,
              restSeconds: 45,
              band: { min: 150, max: 185 },
            },
          ],
        }),
      ],
      'glute-bridge',
      bridge,
    );
    expect(target.band).toEqual({ min: 150, max: 185 });
    expect(target.prescribed).toBe(true);
  });

  it('names whoever signed the review', () => {
    const target = prescribedTarget(
      [routine({ review: { by: 'Dra. Ruiz', at: 5 } })],
      'glute-bridge',
      bridge,
    );
    expect(target.by).toBe('Dra. Ruiz');
  });

  it('prefers the routine touched most recently', () => {
    const old = routine({
      id: 1,
      updatedAt: 100,
      exercises: [
        {
          exerciseId: 'glute-bridge',
          sets: 3,
          reps: 12,
          restSeconds: 45,
          band: { min: 120, max: 185 },
        },
      ],
    });
    const fresh = routine({
      id: 2,
      updatedAt: 900,
      exercises: [
        {
          exerciseId: 'glute-bridge',
          sets: 3,
          reps: 12,
          restSeconds: 45,
          band: { min: 160, max: 185 },
        },
      ],
    });
    expect(prescribedTarget([old, fresh], 'glute-bridge', bridge).band.min).toBe(160);
  });

  it('ignores routines that do not contain the exercise', () => {
    const other = routine({
      updatedAt: 9000,
      exercises: [{ exerciseId: 'front-plank', sets: 3, holdSeconds: 30, restSeconds: 45 }],
    });
    const mine = routine({
      id: 2,
      updatedAt: 10,
      exercises: [
        {
          exerciseId: 'glute-bridge',
          sets: 3,
          reps: 12,
          restSeconds: 45,
          band: { min: 155, max: 185 },
        },
      ],
    });
    expect(prescribedTarget([other, mine], 'glute-bridge', bridge).band.min).toBe(155);
  });

  it('does not mutate the routines it is given', () => {
    const routines = [routine({ updatedAt: 1 }), routine({ id: 2, updatedAt: 2 })];
    const order = routines.map((entry) => entry.id);
    prescribedTarget(routines, 'glute-bridge', bridge);
    expect(routines.map((entry) => entry.id)).toEqual(order);
  });
});
