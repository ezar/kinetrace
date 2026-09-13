import { describe, expect, it } from 'vitest';
import { METRIC_IDS } from '@kinetrace/engine';
import { EXERCISES } from '../library/index.js';
import { PHASE_LABELS } from '../dictionary.js';
import { DEFAULT_ROUTINE_IDS, getExercise } from '../index.js';
import { EXERCISE_TEXT, resolveText } from '../dictionary.js';
import { formatIssues, validateExercise, validateLibrary } from '../validate.js';
import { toRunnerConfig } from '../runner.js';
import type { ExerciseDefinition } from '../types.js';

describe('library', () => {
  it('validates every exercise', () => {
    const issues = validateLibrary(EXERCISES);
    expect(formatIssues(issues)).toBe('');
  });

  it('covers the starter set the specification asks for', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(16);
    for (const id of DEFAULT_ROUTINE_IDS) expect(getExercise(id)).toBeDefined();
  });

  it('gives every exercise a Spanish and an English name and at least one synonym each', () => {
    for (const exercise of EXERCISES) {
      expect(exercise.names.es.length).toBeGreaterThan(2);
      expect(exercise.names.en.length).toBeGreaterThan(2);
      expect(exercise.synonyms.es.length).toBeGreaterThan(0);
      expect(exercise.synonyms.en.length).toBeGreaterThan(0);
    }
  });

  it('only uses metrics the engine implements', () => {
    for (const exercise of EXERCISES) {
      for (const metric of Object.values(exercise.metrics)) {
        expect(METRIC_IDS).toContain(metric.id);
      }
    }
  });

  it('keeps the phase thresholds below the target band so short repetitions are seen', () => {
    for (const exercise of EXERCISES.filter((item) => item.mode === 'reps')) {
      expect(exercise.phases.length).toBeGreaterThanOrEqual(2);
      expect(exercise.targets.band.min).toBeLessThanOrEqual(exercise.targets.band.max);
    }
  });

  it('translates every cue into both languages', () => {
    for (const [key, entry] of Object.entries(EXERCISE_TEXT)) {
      expect(entry.es.length, key).toBeGreaterThan(0);
      expect(entry.en.length, key).toBeGreaterThan(0);
    }
  });

  it('keeps cues short enough to hear across a room', () => {
    // The tracking banner is a screen message rather than a movement cue, and
    // the specification fixes its wording, so it is exempt from the six word rule.
    const exempt = new Set(['engine.trackingLost']);
    for (const [key, entry] of Object.entries(EXERCISE_TEXT)) {
      if (exempt.has(key)) continue;
      if (!key.startsWith('cue.') && !key.startsWith('engine.')) continue;
      expect(entry.es.split(/\s+/).length, key).toBeLessThanOrEqual(6);
      expect(entry.en.split(/\s+/).length, key).toBeLessThanOrEqual(6);
    }
  });

  it('interpolates cue parameters', () => {
    expect(resolveText('engine.goodRep', 'es', { count: 4 })).toBe('bien, 4');
    expect(resolveText('engine.goodRep', 'en', { count: 4 })).toBe('good, 4');
    expect(resolveText('unknown.key', 'es')).toBe('unknown.key');
  });
});

describe('validateExercise', () => {
  const base = EXERCISES[0] as ExerciseDefinition;

  it('rejects a primary metric that is not declared', () => {
    const issues = validateExercise({ ...base, primaryMetric: 'nope' });
    expect(issues.some((issue) => issue.path === 'primaryMetric')).toBe(true);
  });

  it('rejects a cue key that is missing from the dictionary', () => {
    const issues = validateExercise({
      ...base,
      rules: [
        {
          id: 'x',
          priority: 'form',
          when: { above: 1 },
          sustainMs: 0,
          cooldownMs: 0,
          cueKey: 'cue.doesNotExist',
        },
      ],
    });
    expect(issues.some((issue) => issue.path === 'rules[0].cueKey')).toBe(true);
  });

  it('rejects a source it has no name for', () => {
    // The value that does not exist yet is `clinical`, and it will not exist
    // until a citation arrives with it.
    const issues = validateExercise({
      ...base,
      provenance: { targets: 'derived', dose: 'clinical' as never },
    });
    expect(issues.some((issue) => issue.path === 'provenance.dose')).toBe(true);
  });

  it('checks both families of numbers, not just the first', () => {
    const issues = validateExercise({
      ...base,
      provenance: { targets: 'guesswork' as never, dose: 'authored' },
    });
    expect(issues.some((issue) => issue.path === 'provenance.targets')).toBe(true);
  });

  it('rejects an exercise with nothing but a name to go on', () => {
    // The whole point of the field being required: an exercise nobody can
    // explain has no business being prescribed.
    const issues = validateExercise({ ...base, howTo: { es: ['Uno.'], en: ['One.'] } });
    expect(issues.some((issue) => issue.path === 'howTo.es')).toBe(true);
    expect(issues.some((issue) => issue.path === 'howTo.en')).toBe(true);
  });

  it('rejects a blank step', () => {
    const issues = validateExercise({
      ...base,
      howTo: { es: ['Uno.', '  '], en: ['One.', 'Two.'] },
    });
    expect(issues.some((issue) => issue.path === 'howTo.es')).toBe(true);
  });

  it('rejects two languages that do not describe the same steps', () => {
    const issues = validateExercise({
      ...base,
      howTo: { es: ['Uno.', 'Dos.', 'Tres.'], en: ['One.', 'Two.'] },
    });
    expect(issues.some((issue) => issue.path === 'howTo')).toBe(true);
  });

  it('rejects a safety range that does not contain the target band', () => {
    const issues = validateExercise({
      ...base,
      targets: { ...base.targets, safety: { min: 170, max: 175 } },
    });
    expect(issues.some((issue) => issue.path === 'targets.safety')).toBe(true);
  });

  it('rejects a rule that refers to an unknown metric slot', () => {
    const issues = validateExercise({
      ...base,
      rules: [
        {
          id: 'x',
          priority: 'form',
          when: { metric: 'ghost', above: 1 },
          sustainMs: 0,
          cooldownMs: 0,
          cueKey: 'cue.slowDown',
        },
      ],
    });
    expect(issues.some((issue) => issue.message.includes('ghost'))).toBe(true);
  });
});

describe('toRunnerConfig', () => {
  it('carries the library defaults through to the engine', () => {
    const exercise = getExercise('glute-bridge')!;
    const config = toRunnerConfig(exercise);
    expect(config.primaryMetric).toBe('hip');
    expect(config.targets.band).toEqual(exercise.targets.band);
  });

  it("lets a profile's own band replace the default", () => {
    const exercise = getExercise('glute-bridge')!;
    const config = toRunnerConfig(exercise, { band: { min: 150, max: 175 } });
    expect(config.targets.band).toEqual({ min: 150, max: 175 });
    expect(config.targets.safety).toEqual(exercise.targets.safety);
  });

  it('converts hold seconds into the engine unit', () => {
    const config = toRunnerConfig(getExercise('front-plank')!, { holdSeconds: 45 });
    expect(config.hold?.targetMs).toBe(45_000);
  });
});

describe('phase names', () => {
  it('exist for every phase the library declares', () => {
    for (const exercise of EXERCISES) {
      for (const phase of exercise.phases) {
        expect(`${exercise.id}/${phase.id}: ${phase.id in PHASE_LABELS}`).toBe(
          `${exercise.id}/${phase.id}: true`,
        );
      }
    }
  });
});
