import { describe, expect, it } from 'vitest';
import {
  angleBetween,
  jointAngle,
  signedAngleAround,
  standardDeviation,
  vec,
} from '../metrics/geometry.js';

describe('geometry', () => {
  it('measures the angle between two vectors', () => {
    expect(angleBetween(vec(1, 0, 0), vec(0, 1, 0))).toBeCloseTo(90);
    expect(angleBetween(vec(1, 0, 0), vec(1, 0, 0))).toBeCloseTo(0);
    expect(angleBetween(vec(1, 0, 0), vec(-1, 0, 0))).toBeCloseTo(180);
  });

  it('reports 180 degrees for a straight joint', () => {
    expect(jointAngle(vec(0, 1, 0), vec(0, 0, 0), vec(0, -1, 0))).toBeCloseTo(180);
    expect(jointAngle(vec(0, 1, 0), vec(0, 0, 0), vec(1, 0, 0))).toBeCloseTo(90);
  });

  it('signs angles by the right-hand rule around the axis', () => {
    const positive = signedAngleAround(vec(1, 0, 0), vec(0, 1, 0), vec(0, 0, 1));
    const negative = signedAngleAround(vec(0, 1, 0), vec(1, 0, 0), vec(0, 0, 1));
    expect(positive).toBeCloseTo(90);
    expect(negative).toBeCloseTo(-90);
  });

  it('returns NaN for degenerate inputs instead of a wrong number', () => {
    expect(angleBetween(vec(0, 0, 0), vec(1, 0, 0))).toBeNaN();
  });

  it('computes the standard deviation of a window', () => {
    expect(standardDeviation([2, 2, 2])).toBe(0);
    expect(standardDeviation([1, 3])).toBeCloseTo(1);
    expect(standardDeviation([])).toBe(0);
  });
});
