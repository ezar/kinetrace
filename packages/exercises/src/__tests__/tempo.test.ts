import { describe, expect, it } from 'vitest';
import { ExerciseRunner, materializeFixture } from '@kinetrace/engine';
import { getExercise, toRunnerConfig } from '../index.js';
import type { ExerciseDefinition } from '../types.js';

const bridge = getExercise('glute-bridge') as ExerciseDefinition;

/** Cues raised over a set of repetitions at a given pace. */
function cuesAtPace(cycleSeconds: number): string[] {
  const frames = materializeFixture(
    {
      kind: 'synthetic',
      exerciseId: 'glute-bridge',
      variant: 'pace',
      description: '',
      view: 'side',
      fps: 30,
      cycles: 5,
      cycleSeconds,
      noiseMetres: 0.004,
      seed: 11,
    },
    bridge.reference,
  );
  const runner = new ExerciseRunner(toRunnerConfig(bridge));
  const cues: string[] = [];
  for (const frame of frames) {
    const cue = runner.update(frame).cue;
    if (cue) cues.push(cue.cueKey);
  }
  return cues;
}

/**
 * The threshold is calibrated against the library's own reference movement, the
 * way every other number in it was. The point of the feature is the band the
 * velocity rule already in the exercise does not reach.
 */
describe('pacing over real repetitions', () => {
  it('says nothing at the pace the exercise asks for', () => {
    expect(cuesAtPace(3.5)).not.toContain('engine.rushed');
    expect(cuesAtPace(4)).not.toContain('engine.rushed');
  });

  it('tolerates being a little quick', () => {
    expect(cuesAtPace(3)).not.toContain('engine.rushed');
  });

  it('speaks up at a pace the velocity rule misses entirely', () => {
    const cues = cuesAtPace(2.5);
    expect(cues).toContain('engine.rushed');
    // Which is the whole reason this exists: at 2.5 seconds a repetition the
    // rule that was already there stays silent.
    expect(cues).not.toContain('cue.slowDown');
  });

  it('still says nothing when the exercise declares no tempo', () => {
    const plank = getExercise('front-plank') as ExerciseDefinition;
    expect(plank.tempo).toBeUndefined();
    const runner = new ExerciseRunner(toRunnerConfig(plank));
    const frames = materializeFixture(
      {
        kind: 'synthetic',
        exerciseId: 'front-plank',
        variant: 'hold',
        description: '',
        view: 'side',
        fps: 30,
        holdSeconds: 10,
        holdAtPhase: 0.5,
        noiseMetres: 0.004,
        seed: 3,
      },
      plank.reference,
    );
    const cues = frames.flatMap((frame) => {
      const cue = runner.update(frame).cue;
      return cue ? [cue.cueKey] : [];
    });
    expect(cues).not.toContain('engine.rushed');
  });
});
