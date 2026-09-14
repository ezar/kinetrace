import { describe, expect, it } from 'vitest';
import { EXERCISES } from '@kinetrace/exercises';
import { demoPlane } from '../demoPlane.js';

describe('demoPlane', () => {
  it('lets a standing exercise be drawn the way its camera sees it', () => {
    expect(demoPlane('standing', 'front')).toBe('frontal');
    expect(demoPlane('standing', 'side')).toBe('sagittal');
  });

  it('draws a lying or quadruped pose from the side whatever the camera needs', () => {
    // The camera view is chosen so the metric can be computed; the drawing has
    // to be legible, which is a different question.
    for (const posture of ['supine', 'prone', 'quadruped'] as const) {
      expect(demoPlane(posture, 'front')).toBe('sagittal');
      expect(demoPlane(posture, 'side')).toBe('sagittal');
    }
  });

  it('draws a side lying pose from the front, which is the mirror case', () => {
    expect(demoPlane('sideLyingLeft', 'side')).toBe('frontal');
    expect(demoPlane('sideLyingRight', 'front')).toBe('frontal');
  });

  it('never draws a library exercise in the plane that collapses its long axis', () => {
    for (const exercise of EXERCISES) {
      const plane = demoPlane(exercise.reference.posture, exercise.view.orientation);
      const collapses =
        (plane === 'frontal' &&
          ['supine', 'prone', 'quadruped'].includes(exercise.reference.posture)) ||
        (plane === 'sagittal' && exercise.reference.posture.startsWith('sideLying'));
      expect(collapses, exercise.id).toBe(false);
    }
  });
});
