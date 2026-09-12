import { describe, expect, it } from 'vitest';
import { shouldOfferInstall } from '../install.js';

describe('shouldOfferInstall', () => {
  const base = { installed: false, alreadyAsked: false, available: true };

  it('offers once the browser says it is possible', () => {
    expect(shouldOfferInstall(base)).toBe(true);
  });

  it('says nothing before the browser has offered', () => {
    expect(shouldOfferInstall({ ...base, available: false })).toBe(false);
  });

  it('says nothing to somebody already running it from their home screen', () => {
    expect(shouldOfferInstall({ ...base, installed: true })).toBe(false);
  });

  it('asks once and then never again, whichever way they answered', () => {
    expect(shouldOfferInstall({ ...base, alreadyAsked: true })).toBe(false);
  });
});
