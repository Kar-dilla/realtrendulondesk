import type { EvidenceTier } from '../../lib/contracts/newsroom';

const LABEL: Record<EvidenceTier, string> = {
  CONFIRMED: 'Confirmed',
  REPORTED: 'Reported',
  UNVERIFIED: 'Unverified',
  DISPUTED: 'Disputed',
  FALSE: 'False',
};

/** Evidence label (brief v2 §35). Separate from the older components/VerificationBadge.tsx, which stays untouched. */
export function TierBadge({ tier }: { tier: EvidenceTier }) {
  return (
    <span className="tl-tier" data-tier={tier}>
      {LABEL[tier]}
    </span>
  );
}
