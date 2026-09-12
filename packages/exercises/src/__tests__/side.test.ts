/**
 * The side a unilateral exercise is measured on.
 *
 * `auto` means "the side the camera sees better", which is the right answer
 * when nobody has said otherwise and the wrong one when somebody has: a split
 * squat filmed from the left should still measure the leg that was prescribed.
 */

import { describe, expect, it } from 'vitest';
import { getExercise } from '../index.js';
import { toRunnerConfig } from '../runner.js';

describe('toRunnerConfig · side', () => {
  it('leaves the library alone when no side is prescribed', () => {
    const exercise = getExercise('split-squat');
    expect(exercise).toBeDefined();
    const config = toRunnerConfig(exercise!);
    expect(config.metrics['knee']?.side).toBe('auto');
  });

  it('pins every auto slot to the prescribed side', () => {
    const exercise = getExercise('split-squat');
    const config = toRunnerConfig(exercise!, { side: 'right' });
    for (const slot of Object.values(config.metrics)) {
      expect(slot.side).toBe('right');
    }
  });

  it('does not touch a slot that averages both sides on purpose', () => {
    // Wall angels measure both shoulders together; pinning them to one side
    // would change what the exercise means, not just where it looks.
    const exercise = getExercise('wall-angels');
    const before = Object.values(exercise!.metrics).map((metric) => metric.side);
    expect(before).toEqual(['mean', 'mean']);
    const config = toRunnerConfig(exercise!, { side: 'left' });
    expect(Object.values(config.metrics).map((metric) => metric.side)).toEqual(['mean', 'mean']);
  });

  it('does not mutate the library definition', () => {
    // The definitions are shared across every session in the tab.
    const exercise = getExercise('side-plank-full');
    toRunnerConfig(exercise!, { side: 'left' });
    expect(getExercise('side-plank-full')?.metrics['line']?.side).toBe('auto');
  });

  it('marks as unilateral exactly the exercises done one side at a time', () => {
    // A bird dog and a dead bug alternate within the set, so the worked side
    // changes every repetition and there is no side to prescribe.
    const unilateral = [
      'split-squat',
      'side-plank-full',
      'side-plank-knees',
      'knee-to-chest',
      'thoracic-rotation-quadruped',
    ];
    for (const id of unilateral) {
      expect(getExercise(id)?.unilateral, id).toBe(true);
    }
    for (const id of ['glute-bridge', 'bird-dog', 'dead-bug', 'bodyweight-squat', 'wall-angels']) {
      expect(getExercise(id)?.unilateral, id).toBeUndefined();
    }
  });
});
