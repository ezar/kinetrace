import { describe, expect, it } from 'vitest';
import { RuleEngine, type RuleDef } from '../rules/engine.js';
import { CueScheduler } from '../cues/scheduler.js';
import { evaluateCondition } from '../rules/conditions.js';
import type { MetricFrame } from '../types.js';

function frame(values: Record<string, number>, timestampMs: number): MetricFrame {
  return {
    timestampMs,
    poseConfidence: 0.9,
    samples: Object.fromEntries(
      Object.entries(values).map(([name, value]) => [
        name,
        { value, velocity: 0, stability: 0, confidence: 0.9, fromImageSpace: false },
      ]),
    ),
  };
}

describe('conditions', () => {
  const sample = frame({ hip: 150, line: -3 }, 0);

  it('tests bounds on the named metric', () => {
    expect(evaluateCondition({ metric: 'hip', above: 140 }, sample, 'hip')).toBe(true);
    expect(evaluateCondition({ metric: 'hip', below: 140 }, sample, 'hip')).toBe(false);
    expect(evaluateCondition({ above: 140 }, sample, 'hip')).toBe(true);
  });

  it('supports absolute values and combinators', () => {
    expect(evaluateCondition({ metric: 'line', signal: 'absValue', above: 2 }, sample, 'hip')).toBe(
      true,
    );
    expect(evaluateCondition({ all: [{ above: 140 }, { below: 160 }] }, sample, 'hip')).toBe(true);
    expect(evaluateCondition({ any: [{ above: 200 }, { below: 160 }] }, sample, 'hip')).toBe(true);
    expect(evaluateCondition({ not: { above: 200 } }, sample, 'hip')).toBe(true);
    expect(evaluateCondition({ always: true }, sample, 'hip')).toBe(true);
  });

  it('is false when the metric is missing or unbounded', () => {
    expect(evaluateCondition({ metric: 'missing', above: 1 }, sample, 'hip')).toBe(false);
    expect(evaluateCondition({ metric: 'hip' }, sample, 'hip')).toBe(false);
  });
});

describe('RuleEngine', () => {
  const rule: RuleDef = {
    id: 'hipsSagging',
    priority: 'form',
    when: { above: 12 },
    sustainMs: 1000,
    cooldownMs: 4000,
    cueKey: 'cue.liftHips',
  };

  it('waits for the sustain time before firing', () => {
    const engine = new RuleEngine([rule], 'line');
    expect(engine.update(frame({ line: 20 }, 0), null)).toHaveLength(0);
    expect(engine.update(frame({ line: 20 }, 900), null)).toHaveLength(0);
    expect(engine.update(frame({ line: 20 }, 1000), null)).toHaveLength(1);
  });

  it('respects the cooldown', () => {
    const engine = new RuleEngine([rule], 'line');
    engine.update(frame({ line: 20 }, 0), null);
    engine.update(frame({ line: 20 }, 1000), null);
    for (let t = 1033; t < 5000; t += 33) {
      expect(engine.update(frame({ line: 20 }, t), null)).toHaveLength(0);
    }
    expect(engine.update(frame({ line: 20 }, 6100), null)).toHaveLength(1);
  });

  it('restarts the sustain timer when the problem goes away', () => {
    const engine = new RuleEngine([rule], 'line');
    engine.update(frame({ line: 20 }, 0), null);
    engine.update(frame({ line: 0 }, 500), null);
    expect(engine.update(frame({ line: 20 }, 1100), null)).toHaveLength(0);
  });

  it('only evaluates rules in the phases they belong to', () => {
    const engine = new RuleEngine([{ ...rule, phases: ['top'], sustainMs: 0 }], 'line');
    expect(engine.update(frame({ line: 20 }, 0), 'rest')).toHaveLength(0);
    expect(engine.update(frame({ line: 20 }, 100), 'top')).toHaveLength(1);
  });

  it('attaches the current metric value to the cue', () => {
    const engine = new RuleEngine([{ ...rule, sustainMs: 0, valueFrom: 'line' }], 'line');
    const [candidate] = engine.update(frame({ line: 20.4 }, 0), null);
    expect(candidate?.params).toEqual({ value: 20 });
  });
});

describe('CueScheduler', () => {
  const form = { ruleId: 'a', cueKey: 'cue.liftHips', priority: 'form' as const, timestampMs: 0 };
  const safety = {
    ruleId: 'b',
    cueKey: 'engine.safetyStop',
    priority: 'safety' as const,
    timestampMs: 0,
  };
  const praise = {
    ruleId: 'c',
    cueKey: 'engine.goodRep',
    priority: 'encouragement' as const,
    timestampMs: 0,
  };

  it('says nothing when nothing is proposed', () => {
    expect(new CueScheduler().select([], 0)).toBeNull();
  });

  it('picks safety over form over encouragement', () => {
    const scheduler = new CueScheduler();
    expect(scheduler.select([praise, form, safety], 0)?.ruleId).toBe('b');
  });

  it('keeps four seconds between corrective cues', () => {
    const scheduler = new CueScheduler();
    expect(scheduler.select([form], 0)).not.toBeNull();
    expect(scheduler.select([{ ...form, ruleId: 'd' }], 2000)).toBeNull();
    expect(scheduler.select([{ ...form, ruleId: 'd' }], 4100)).not.toBeNull();
  });

  it('lets praise through between corrections', () => {
    const scheduler = new CueScheduler();
    scheduler.select([form], 0);
    expect(scheduler.select([praise], 1500)?.ruleId).toBe('c');
  });

  it('never blocks a safety cue', () => {
    const scheduler = new CueScheduler();
    scheduler.select([form], 0);
    expect(scheduler.select([safety], 500)?.ruleId).toBe('b');
  });
});
