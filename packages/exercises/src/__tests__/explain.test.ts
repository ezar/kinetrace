import { describe, expect, it } from 'vitest';
import { describeCondition } from '../explain.js';
import { getExercise } from '../index.js';
import { EXERCISES } from '../library/index.js';
import { metricLabel } from '../dictionary.js';
import type { ExerciseDefinition } from '../types.js';

const bridge = getExercise('glute-bridge') as ExerciseDefinition;

describe('describeCondition', () => {
  it('reads a bound on the primary metric', () => {
    expect(describeCondition({ above: 168 }, bridge).es).toContain('por encima de 168 °');
    expect(describeCondition({ above: 168 }, bridge).en).toContain('above 168 °');
  });

  it('names the signal, not just the number', () => {
    const spoken = describeCondition({ signal: 'absVelocity', above: 45 }, bridge);
    expect(spoken.es).toBe('la velocidad de flexión de cadera por encima de 45 °/s');
    expect(spoken.en).toBe('the speed of hip flexion above 45 °/s');
  });

  it('names a metric other than the primary one', () => {
    const spoken = describeCondition({ metric: 'trunkLine', below: -10 }, bridge);
    expect(spoken.es).toContain('por debajo de -10 °');
    expect(spoken.es).not.toContain('trunkLine');
  });

  it('reads a range as a range', () => {
    expect(describeCondition({ above: 30, below: 45 }, bridge).es).toContain('entre 30 ° y 45 °');
  });

  it('joins the parts of a composite condition', () => {
    const spoken = describeCondition({ all: [{ above: 30 }, { below: 45 }] }, bridge);
    expect(spoken.es).toContain(' y ');
    expect(spoken.en).toContain(' and ');
    expect(describeCondition({ any: [{ above: 30 }, { below: 10 }] }, bridge).en).toContain(' or ');
  });

  it('names every rule in the library after a metric, not after a slot', () => {
    for (const exercise of EXERCISES) {
      for (const rule of exercise.rules) {
        const slot = 'metric' in rule.when ? (rule.when.metric ?? '') : '';
        const metric = exercise.metrics[slot || exercise.primaryMetric];
        if (!metric) continue;
        const spoken = describeCondition(rule.when, exercise);
        const label = metricLabel(metric.id, 'es').toLowerCase();
        expect(`${exercise.id}/${rule.id}: ${spoken.es.includes(label)}`).toBe(
          `${exercise.id}/${rule.id}: true`,
        );
      }
    }
  });
});
