/**
 * Fixture driven engine tests.
 *
 * Every fixture in `fixtures/landmarks/` carries the expectations the engine
 * has to meet on it, and this suite asserts them. Adding an exercise means
 * adding a fixture, which means this suite grows with the library.
 */

import { describe, expect, it } from 'vitest';
import { ExerciseRunner, type EngineEvent } from '@kinetrace/engine';
import { toRunnerConfig } from '@kinetrace/exercises';
import { loadAllFixtures, loadFixtureFile, type LoadedFixture } from '../scripts/fixtures/load.js';

interface RunOutcome {
  reps: number;
  partials: number;
  heldMs: number;
  cueRuleIds: string[];
  cues: Array<{ timestampMs: number; ruleId: string; cueKey: string }>;
  events: EngineEvent[];
}

function run(fixture: LoadedFixture): RunOutcome {
  const { exercise, frames, spec } = fixture;
  const runner = new ExerciseRunner(
    toRunnerConfig(exercise, {
      ...(spec.kind === 'synthetic' && spec.holdSeconds ? { holdSeconds: spec.holdSeconds } : {}),
    }),
  );
  const outcome: RunOutcome = {
    reps: 0,
    partials: 0,
    heldMs: 0,
    cueRuleIds: [],
    cues: [],
    events: [],
  };
  for (const frame of frames) {
    const update = runner.update(frame);
    outcome.events.push(...update.events);
    if (update.cue) {
      outcome.cues.push({
        timestampMs: update.cue.timestampMs,
        ruleId: update.cue.ruleId,
        cueKey: update.cue.cueKey,
      });
      outcome.cueRuleIds.push(update.cue.ruleId);
    }
    outcome.reps = update.state.reps;
    outcome.partials = update.state.partials;
    outcome.heldMs = update.state.heldMs;
  }
  return outcome;
}

const fixtures = loadAllFixtures();

describe('fixtures', () => {
  it('covers every exercise in the library with a good variant', () => {
    const good = fixtures.filter((fixture) => fixture.spec.variant === 'good');
    expect(good.length).toBeGreaterThanOrEqual(16);
  });

  for (const fixture of fixtures) {
    const { spec, exercise } = fixture;
    const name = `${spec.exerciseId}.${spec.variant}`;
    const expected = spec.expect;
    if (!expected) continue;

    describe(name, () => {
      const outcome = run(fixture);

      if (expected.reps !== undefined) {
        it(`counts ${expected.reps} repetitions`, () => {
          expect(outcome.reps).toBe(expected.reps);
        });
      }
      if (expected.partials !== undefined) {
        it(`counts ${expected.partials} partial repetitions`, () => {
          expect(outcome.partials).toBe(expected.partials);
        });
      }
      if (expected.heldMs?.atLeast !== undefined) {
        it(`holds for at least ${expected.heldMs.atLeast} ms`, () => {
          expect(outcome.heldMs).toBeGreaterThanOrEqual(expected.heldMs?.atLeast ?? 0);
        });
      }
      for (const ruleId of expected.cues ?? []) {
        it(`fires the ${ruleId} cue`, () => {
          expect(outcome.cueRuleIds).toContain(ruleId);
        });
      }
      if ((expected.silent ?? []).length > 0) {
        it('stays quiet about form', () => {
          for (const ruleId of expected.silent ?? []) {
            expect(outcome.cueRuleIds, `${name} fired ${ruleId}`).not.toContain(ruleId);
          }
        });
      }
      if (expected.trackingLost) {
        it('reports that it lost the body', () => {
          expect(outcome.events.some((event) => event.type === 'trackingLost')).toBe(true);
        });
      }

      it('never repeats a corrective cue inside its cooldown', () => {
        const lastFired = new Map<string, number>();
        for (const cue of outcome.cues) {
          const rule = exercise.rules.find((item) => item.id === cue.ruleId);
          if (!rule) continue;
          const previous = lastFired.get(cue.ruleId);
          if (previous !== undefined) {
            expect(cue.timestampMs - previous).toBeGreaterThanOrEqual(rule.cooldownMs);
          }
          lastFired.set(cue.ruleId, cue.timestampMs);
        }
      });
    });
  }
});

/** The acceptance criteria written into the specification, asserted literally. */
describe('acceptance criteria', () => {
  it('counts ten good glute bridges as ten repetitions and no partials', () => {
    const outcome = run(loadFixtureFile('glute-bridge.good.json'));
    expect(outcome.reps).toBe(10);
    expect(outcome.partials).toBe(0);
  });

  it('says "lift your hips" within 1.5 s of a sagging plank and not again for 4 s', () => {
    const outcome = run(loadFixtureFile('front-plank.sagging-hips.json'));
    const cues = outcome.cues.filter((cue) => cue.cueKey === 'cue.liftHips');
    expect(cues.length).toBeGreaterThan(0);
    expect(cues[0]?.timestampMs).toBeLessThanOrEqual(1500);
    for (let index = 1; index < cues.length; index += 1) {
      const gap = (cues[index]?.timestampMs ?? 0) - (cues[index - 1]?.timestampMs ?? 0);
      expect(gap).toBeGreaterThanOrEqual(4000);
    }
  });

  it('pauses counting and says it lost the user when confidence stays low for a second', () => {
    const fixture = loadFixtureFile('glute-bridge.lost-tracking.json');
    const outcome = run(fixture);
    const lost = outcome.events.find((event) => event.type === 'trackingLost');
    expect(lost).toBeDefined();
    expect(outcome.cues.some((cue) => cue.cueKey === 'engine.trackingLost')).toBe(true);
    // The dropout starts at 8 s; the engine waits one second before reacting.
    expect(lost?.timestampMs).toBeGreaterThanOrEqual(8900);
    expect(lost?.timestampMs).toBeLessThanOrEqual(9300);
  });

  it('calls a short repetition a partial and says how far it got', () => {
    const outcome = run(loadFixtureFile('glute-bridge.partial.json'));
    expect(outcome.reps).toBe(0);
    expect(outcome.partials).toBeGreaterThan(0);
    expect(outcome.cues.some((cue) => cue.cueKey === 'engine.partialRep')).toBe(true);
  });
});
