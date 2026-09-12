import { describe, expect, it } from 'vitest';
import {
  canPrescribe,
  countingThreshold,
  metricRange,
  reviewPrescription,
  type Prescription,
  type PrescriptionIssueCode,
} from '../prescription.js';
import { getExercise } from '../index.js';
import { EXERCISES } from '../library/index.js';
import type { ExerciseDefinition } from '../types.js';

/** The reference repetition exercise: hip extension, counted above 148 deg. */
const bridge = getExercise('glute-bridge') as ExerciseDefinition;
/** The reference isometric. */
const plank = getExercise('front-plank') as ExerciseDefinition;

function prescribe(exercise: ExerciseDefinition, patch: Partial<Prescription> = {}): Prescription {
  return {
    band: { ...exercise.targets.band },
    ...(exercise.targets.safety ? { safety: { ...exercise.targets.safety } } : {}),
    sets: exercise.defaults.sets,
    ...(exercise.defaults.reps !== undefined ? { reps: exercise.defaults.reps } : {}),
    ...(exercise.defaults.holdSeconds !== undefined
      ? { holdSeconds: exercise.defaults.holdSeconds }
      : {}),
    restSeconds: exercise.defaults.restSeconds,
    ...patch,
  };
}

function codes(exercise: ExerciseDefinition, patch: Partial<Prescription> = {}): string[] {
  return reviewPrescription(exercise, prescribe(exercise, patch)).map((issue) => issue.code);
}

describe('the library itself', () => {
  it('prescribes its own defaults cleanly', () => {
    for (const exercise of EXERCISES) {
      const issues = reviewPrescription(exercise, prescribe(exercise));
      expect(`${exercise.id}: ${issues.map((issue) => issue.code).join(', ')}`).toBe(
        `${exercise.id}: `,
      );
    }
  });
});

describe('countingThreshold', () => {
  it('is the value a repetition has to pass', () => {
    expect(countingThreshold(bridge)).toBe(148);
  });

  it('is nothing for a hold, which has no repetition to count', () => {
    expect(countingThreshold(plank)).toBeNull();
  });
});

describe('metricRange', () => {
  it('comes from the metric the exercise is judged on', () => {
    expect(metricRange(bridge)).toEqual({ min: 0, max: 180 });
  });
});

describe('arithmetic', () => {
  it('rejects a band that is the wrong way round', () => {
    expect(codes(bridge, { band: { min: 180, max: 165 } })).toContain('bandInverted');
  });

  it('rejects an angle the body cannot make', () => {
    // A hip cannot open past 180 degrees, so a target that starts at 190 is
    // one nobody can reach.
    expect(codes(bridge, { band: { min: 190, max: 220 } })).toContain('bandOutsideMetric');
  });

  it('allows the open-ended maximum the library itself uses', () => {
    // 165 to 185 on a metric that stops at 180 means "no upper limit", and the
    // whole starter library is written that way.
    expect(codes(bridge, { band: { min: 165, max: 185 } })).toEqual([]);
  });

  it('rejects a band the safety stop would interrupt', () => {
    const issues = reviewPrescription(
      bridge,
      prescribe(bridge, { band: { min: 165, max: 195 }, safety: { min: 80, max: 190 } }),
    );
    expect(issues.map((issue) => issue.code)).toContain('bandOutsideSafety');
    expect(canPrescribe(issues)).toBe(false);
  });

  it('warns when the safety stop can never fire', () => {
    expect(codes(bridge, { safety: { min: -10, max: 190 } })).toContain('safetyNeverFires');
  });

  it('rejects nonsense dosage', () => {
    expect(codes(bridge, { sets: 0 })).toContain('setsInvalid');
    expect(codes(bridge, { reps: 0 })).toContain('repsInvalid');
    expect(codes(bridge, { restSeconds: -5 })).toContain('restInvalid');
    expect(codes(plank, { holdSeconds: 0 })).toContain('holdInvalid');
  });
});

/**
 * The checks that need to know how the engine counts. A repetition of the
 * bridge is counted once the hip passes 148 deg, and the band decides whether
 * it was good.
 */
describe('the band against the repetition threshold', () => {
  it('warns when every counted repetition would be good', () => {
    // 140 is below the 148 the movement must already reach to be counted.
    expect(codes(bridge, { band: { min: 140, max: 185 } })).toContain('bandNotDiscriminating');
  });

  it('rejects a band entirely below the threshold', () => {
    const issues = reviewPrescription(bridge, prescribe(bridge, { band: { min: 100, max: 140 } }));
    expect(issues.map((issue) => issue.code)).toContain('bandOutsideCountingRange');
    expect(canPrescribe(issues)).toBe(false);
  });

  it('is happy with a band the movement has to reach for', () => {
    expect(codes(bridge, { band: { min: 160, max: 185 } })).toEqual([]);
  });

  it('says nothing about it for a hold', () => {
    expect(codes(plank)).toEqual([]);
  });
});

describe('the soft warnings', () => {
  it('warns about a band narrower than the measurement wobbles', () => {
    expect(codes(bridge, { band: { min: 170, max: 172 } })).toContain('bandNarrowerThanWobble');
  });

  it('warns about a hold band narrower than the stability the timer forgives', () => {
    const width = (plank.hold?.stabilityToleranceDeg ?? 0) * 2;
    const middle = (plank.targets.band.min + plank.targets.band.max) / 2;
    const narrow = { min: middle - width / 4, max: middle + width / 4 };
    expect(codes(plank, { band: narrow })).toContain('bandNarrowerThanWobble');
  });

  it('warns about a band a long way from the default, which is what a typo looks like', () => {
    // 65 instead of 165.
    expect(codes(bridge, { band: { min: 65, max: 185 } })).toContain('farFromDefault');
  });

  it('lets a warning be signed off, unlike an error', () => {
    const issues = reviewPrescription(bridge, prescribe(bridge, { band: { min: 140, max: 185 } }));
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
    expect(canPrescribe(issues)).toBe(true);
  });

  it('puts the errors first', () => {
    const issues = reviewPrescription(bridge, prescribe(bridge, { band: { min: 100, max: 103 } }));
    const severities = issues.map((issue) => issue.severity);
    expect(severities).toEqual([...severities].sort((a) => (a === 'error' ? -1 : 1)));
    expect(issues[0]?.severity).toBe('error');
  });
});

describe('every issue code is reachable', () => {
  it('is produced by some prescription in these tests', () => {
    const seen = new Set<PrescriptionIssueCode>();
    const cases: Array<[ExerciseDefinition, Partial<Prescription>]> = [
      [bridge, { band: { min: 180, max: 165 } }],
      [bridge, { safety: { min: 200, max: 80 } }],
      [bridge, { band: { min: 165, max: 195 }, safety: { min: 80, max: 190 } }],
      [bridge, { band: { min: 190, max: 220 } }],
      [bridge, { safety: { min: -10, max: 190 } }],
      [bridge, { band: { min: 100, max: 140 } }],
      [bridge, { band: { min: 140, max: 185 } }],
      [bridge, { band: { min: 170, max: 172 } }],
      [bridge, { band: { min: 65, max: 185 } }],
      [bridge, { sets: 0 }],
      [bridge, { reps: 0 }],
      [plank, { holdSeconds: 0 }],
      [bridge, { restSeconds: -1 }],
    ];
    for (const [exercise, patch] of cases) {
      for (const issue of reviewPrescription(exercise, prescribe(exercise, patch))) {
        seen.add(issue.code);
      }
    }
    const expected: PrescriptionIssueCode[] = [
      'bandInverted',
      'safetyInverted',
      'bandOutsideSafety',
      'bandOutsideMetric',
      'safetyNeverFires',
      'bandOutsideCountingRange',
      'bandNotDiscriminating',
      'bandNarrowerThanWobble',
      'farFromDefault',
      'setsInvalid',
      'repsInvalid',
      'holdInvalid',
      'restInvalid',
    ];
    expect([...seen].sort()).toEqual([...expected].sort());
  });
});

describe('an inverted band', () => {
  it('says so once, without the nonsense that follows from a negative width', () => {
    const reported = codes(bridge, { band: { min: 200, max: 80 } });
    expect(reported).toContain('bandInverted');
    expect(reported).not.toContain('bandNarrowerThanWobble');
    expect(reported).not.toContain('farFromDefault');
    expect(reported).not.toContain('bandOutsideCountingRange');
  });

  it('still reports what does not depend on the band', () => {
    expect(codes(bridge, { band: { min: 200, max: 80 }, sets: 0 })).toContain('setsInvalid');
  });
});
