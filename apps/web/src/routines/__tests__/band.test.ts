import { describe, expect, it } from 'vitest';
import { formatBand } from '../band.js';

describe('formatBand', () => {
  it('uses the compact form when both bounds are positive', () => {
    expect(formatBand(165, 185, 'a')).toBe('165–185°');
  });

  it('spells the range out when a bound is negative', () => {
    expect(formatBand(-8, 8, 'a')).toBe('-8 a 8°');
    expect(formatBand(-20, -5, 'to')).toBe('-20 to -5°');
  });

  it('never puts a minus sign against the dash', () => {
    expect(formatBand(-8, 8, 'a')).not.toContain('-8–');
  });
});
