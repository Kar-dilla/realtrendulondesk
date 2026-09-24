import { rollupTier } from '../rollup';

describe('rollupTier', () => {
  it('returns null for an empty claims list', () => {
    expect(rollupTier([])).toBeNull();
  });

  it('returns CONFIRMED when every claim is CONFIRMED', () => {
    expect(rollupTier(['CONFIRMED', 'CONFIRMED'])).toBe('CONFIRMED');
  });

  it('picks DISPUTED over every other tier present', () => {
    expect(rollupTier(['CONFIRMED', 'REPORTED', 'DISPUTED', 'UNVERIFIED'])).toBe('DISPUTED');
  });

  it('picks UNVERIFIED over REPORTED and CONFIRMED when no DISPUTED claim is present', () => {
    expect(rollupTier(['CONFIRMED', 'REPORTED', 'UNVERIFIED'])).toBe('UNVERIFIED');
  });

  it('picks REPORTED over CONFIRMED when those are the only two tiers present', () => {
    expect(rollupTier(['CONFIRMED', 'REPORTED'])).toBe('REPORTED');
  });

  it('is order-independent', () => {
    expect(rollupTier(['DISPUTED', 'CONFIRMED'])).toBe('DISPUTED');
    expect(rollupTier(['CONFIRMED', 'DISPUTED'])).toBe('DISPUTED');
  });
});
