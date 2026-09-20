import { describe, expect, it } from 'vitest';
import { getExercise } from '../index.js';
import {
  PROGRAMMES,
  SERMEF_LUMBAR,
  programmeDoses,
  programmeOmissions,
  type Programme,
} from '../programmes.js';
import { reviewPrescription } from '../prescription.js';

/**
 * A transcription is only worth anything if it still matches the paper, so
 * these tests are mostly about the document rather than about the code: the
 * steps are numbered as printed, the doses are the printed doses, and a step
 * that claims an exercise has to name one the library can actually run.
 */
describe('published programmes', () => {
  const all: readonly Programme[] = PROGRAMMES;

  it('numbers every step from one, in the order of the document', () => {
    for (const programme of all) {
      expect(programme.steps.map((step) => step.step)).toEqual(
        programme.steps.map((_, index) => index + 1),
      );
    }
  });

  it('either runs a step or says why it cannot, never both and never neither', () => {
    for (const programme of all) {
      for (const step of programme.steps) {
        expect(Boolean(step.dose) !== Boolean(step.omission)).toBe(true);
      }
    }
  });

  it('quotes a title and an instruction for every step', () => {
    for (const programme of all) {
      for (const step of programme.steps) {
        expect(step.title.length).toBeGreaterThan(3);
        expect(step.instruction.length).toBeGreaterThan(20);
      }
    }
  });

  it('names an exercise the library has, in the unit that exercise counts in', () => {
    for (const programme of all) {
      for (const dose of programmeDoses(programme)) {
        const exercise = getExercise(dose.exerciseId);
        expect(exercise, dose.exerciseId).toBeDefined();
        if (!exercise) continue;
        if (exercise.mode === 'reps') {
          expect(dose.reps, dose.exerciseId).toBeGreaterThan(0);
          expect(dose.holdSeconds, dose.exerciseId).toBeUndefined();
        } else {
          expect(dose.holdSeconds, dose.exerciseId).toBeGreaterThan(0);
          expect(dose.reps, dose.exerciseId).toBeUndefined();
        }
      }
    }
  });

  it('paces a phase the exercise actually has', () => {
    for (const programme of all) {
      for (const dose of programmeDoses(programme)) {
        const exercise = getExercise(dose.exerciseId);
        const phases = new Set((exercise?.phases ?? []).map((phase) => phase.id));
        for (const entry of dose.tempo ?? []) {
          expect(phases.has(entry.phase), `${dose.exerciseId}:${entry.phase}`).toBe(true);
          expect(entry.seconds).toBeGreaterThan(0);
        }
      }
    }
  });

  it('prescribes nothing the validator would reject', () => {
    for (const programme of all) {
      for (const dose of programmeDoses(programme)) {
        const exercise = getExercise(dose.exerciseId);
        if (!exercise) continue;
        const issues = reviewPrescription(exercise, {
          band: exercise.targets.band,
          sets: dose.sets,
          reps: dose.reps,
          holdSeconds: dose.holdSeconds,
          restSeconds: dose.restSeconds,
          tempo: dose.tempo,
        });
        expect(
          issues.filter((issue) => issue.severity === 'error'),
          dose.exerciseId,
        ).toEqual([]);
      }
    }
  });

  /**
   * The rule that was broken once already. Two steps were matched on their
   * titles to exercises whose own instructions ask for a different movement —
   * a pelvic tilt that stays on the floor where the document lifts off it, a
   * sustained stretch where the document works. Refusing an exercise by name
   * and then prescribing it elsewhere in the same document is that mistake
   * happening again, so it fails here.
   */
  it('never prescribes an exercise the same programme refused by name', () => {
    for (const programme of all) {
      const refused = new Set(
        programmeOmissions(programme).flatMap((step) =>
          step.omission?.near ? [step.omission.near] : [],
        ),
      );
      for (const dose of programmeDoses(programme)) {
        expect(refused.has(dose.exerciseId), dose.exerciseId).toBe(false);
      }
    }
  });

  it('points an omission at the library exercise it refused to match', () => {
    for (const programme of all) {
      for (const step of programmeOmissions(programme)) {
        const omission = step.omission;
        expect(omission).toBeDefined();
        if (omission?.reason === 'differentExercise') {
          expect(omission.near, `step ${step.step}`).toBeDefined();
          expect(getExercise(omission.near ?? ''), omission.near).toBeDefined();
        }
      }
    }
  });
});

/**
 * The SERMEF sheet, step by step. Written out rather than derived so that a
 * later edit to the data fails here instead of quietly changing what the app
 * says the document prescribes.
 */
describe('SERMEF lumbar programme', () => {
  it('cites the document', () => {
    expect(SERMEF_LUMBAR.source.publisher).toContain('SERMEF');
    expect(SERMEF_LUMBAR.source.year).toBe(2013);
  });

  it('has the ten printed steps', () => {
    expect(SERMEF_LUMBAR.steps).toHaveLength(10);
    expect(SERMEF_LUMBAR.steps.map((step) => step.title)).toEqual([
      'Báscula pélvica en supino',
      'Abdominales inferiores',
      'Abdominales superiores de frente (manos suelo)',
      'Abdominales superiores cruzados (manos suelo)',
      'Puente',
      'Extensión de tronco en prono',
      'Elevación de pierna extendida',
      'Estiramiento lumbosacro en suelo',
      'Gato-camello',
      'Elevación brazo-pierna alternativa',
    ]);
  });

  it('keeps the printed series and repetitions of every step', () => {
    expect(SERMEF_LUMBAR.steps.map((step) => step.printed)).toEqual([
      { sets: 1, reps: 10 },
      { sets: 1, reps: 10 },
      { sets: 1, reps: 10 },
      { sets: 1, reps: 10 },
      { sets: 1, reps: 10 },
      { sets: 1, reps: 10 },
      { sets: 1, reps: 10 },
      { sets: 1, reps: 4 },
      { sets: 1, reps: 5 },
      { sets: 1, reps: 10 },
    ]);
  });

  it('runs three of the ten, in the order of the document', () => {
    expect(programmeDoses(SERMEF_LUMBAR).map((dose) => dose.exerciseId)).toEqual([
      'glute-bridge',
      'childs-pose',
      'cat-camel',
    ]);
  });

  it('leaves the other seven out, each naming what it refused', () => {
    expect(
      programmeOmissions(SERMEF_LUMBAR).map((step) => [
        step.step,
        step.omission?.reason,
        step.omission?.near,
      ]),
    ).toEqual([
      [1, 'differentExercise', 'pelvic-tilt'],
      [2, 'differentExercise', 'double-knee-to-chest'],
      [3, 'differentExercise', 'mcgill-curl-up'],
      [4, 'notInLibrary', undefined],
      [6, 'differentExercise', 'prone-press-up'],
      [7, 'notInLibrary', undefined],
      [10, 'differentExercise', 'bird-dog'],
    ]);
  });

  it('carries the printed hold as a pace on the phase it belongs to', () => {
    const byId = new Map(programmeDoses(SERMEF_LUMBAR).map((dose) => [dose.exerciseId, dose]));
    expect(byId.get('glute-bridge')?.tempo).toEqual([{ phase: 'top', seconds: 5 }]);
    expect(byId.get('cat-camel')?.tempo).toEqual([
      { phase: 'cat', seconds: 5 },
      { phase: 'camel', seconds: 5 },
    ]);
  });

  it('declares no rest anywhere, because the document prints none', () => {
    for (const dose of programmeDoses(SERMEF_LUMBAR)) expect(dose.restSeconds).toBe(0);
  });
});
