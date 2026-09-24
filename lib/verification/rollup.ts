import type { Tier } from './classify';

// Lower number = more conservative = takes precedence in the rollup.
// DISPUTED beats UNVERIFIED beats REPORTED beats CONFIRMED.
const PRECEDENCE: Record<Tier, number> = {
  DISPUTED: 0,
  UNVERIFIED: 1,
  REPORTED: 2,
  CONFIRMED: 3,
};

/**
 * Given every claim's tier for a story, return the most conservative tier
 * present. Returns null only when there are no claims to roll up (callers
 * should not invoke this for a story with zero claims — that case stays
 * null upstream without calling in here at all).
 */
export function rollupTier(tiers: Tier[]): Tier | null {
  if (tiers.length === 0) return null;
  return tiers.reduce((worst, current) => (PRECEDENCE[current] < PRECEDENCE[worst] ? current : worst));
}
