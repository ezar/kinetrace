import { describe, expect, it } from 'vitest';
import { OneEuroFilter, LandmarkFilter, REHAB_FILTER_PARAMS } from '../filter/oneEuro.js';

describe('OneEuroFilter', () => {
  it('passes the first sample through unchanged', () => {
    const filter = new OneEuroFilter();
    expect(filter.filter(42, 0)).toBe(42);
  });

  it('removes most of the noise from a still signal', () => {
    const filter = new OneEuroFilter();
    let noisyError = 0;
    let filteredError = 0;
    for (let index = 0; index < 120; index += 1) {
      const noise = Math.sin(index * 7.3) * 2;
      const raw = 100 + noise;
      const filtered = filter.filter(raw, index * 33);
      if (index < 10) continue;
      noisyError += Math.abs(raw - 100);
      filteredError += Math.abs(filtered - 100);
    }
    expect(filteredError).toBeLessThan(noisyError * 0.35);
  });

  it('estimates the derivative of a ramp in units per second', () => {
    const filter = new OneEuroFilter();
    // 60 degrees per second sampled at 30 fps.
    for (let index = 0; index < 90; index += 1) {
      filter.filter(index * 2, index * 33.33);
    }
    expect(filter.derivative).toBeGreaterThan(55);
    expect(filter.derivative).toBeLessThan(65);
  });

  it('tracks a fast movement with limited lag', () => {
    const filter = new OneEuroFilter(REHAB_FILTER_PARAMS);
    let value = 0;
    for (let index = 0; index < 60; index += 1) {
      value = filter.filter(index < 30 ? 0 : 90, index * 33.33);
    }
    expect(value).toBeGreaterThan(85);
  });

  it('forgets its state on reset', () => {
    const filter = new OneEuroFilter();
    filter.filter(10, 0);
    filter.filter(20, 33);
    filter.reset();
    expect(filter.filter(100, 66)).toBe(100);
    expect(filter.derivative).toBe(0);
  });
});

describe('LandmarkFilter', () => {
  it('filters every coordinate and keeps visibility untouched', () => {
    const filter = new LandmarkFilter();
    const landmarks = [{ x: 0, y: 0, z: 0, visibility: 0.9 }];
    filter.filter(landmarks, 0);
    const result = filter.filter([{ x: 1, y: 1, z: 1, visibility: 0.4 }], 33);
    expect(result[0]?.visibility).toBe(0.4);
    expect(result[0]?.x).toBeGreaterThan(0);
    expect(result[0]?.x).toBeLessThan(1);
  });
});
