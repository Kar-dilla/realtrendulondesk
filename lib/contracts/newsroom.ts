// View-models the UI packages share. Built FROM the shared-store types
// (Story, RankedStory, VerifiedClaim ...), never a replacement for them.
// Owned by the Lead (Wave 0). Need a field? Ask the Lead.

import type { VerificationTier } from '../shared-store/types';

/** The five evidence labels from brief v2 §35. The store's VerificationTier has no FALSE yet. */
export type EvidenceTier = VerificationTier | 'FALSE';

export const EVIDENCE_TIERS: readonly EvidenceTier[] = [
  'CONFIRMED',
  'REPORTED',
  'UNVERIFIED',
  'DISPUTED',
  'FALSE',
];

export type PriorityLevel = 'high' | 'medium' | 'low';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface StorySource {
  domain: string; // "dw.com"
  url: string;
}

/** Everything a story card needs. Impact/freshness are 0-10, `score` is 0-100. null = not computed yet. */
export interface StoryCardData {
  id: string;
  headline: string;
  category: string | null;
  priority: PriorityLevel;
  score: number | null;
  globalImpact: number | null;
  humanImpact: number | null;
  freshness: number | null;
  sourceConfidence: ConfidenceLevel | null;
  sourceCount: number;
  sources: StorySource[];
  firstReportedAt: string | null; // ISO
  lastUpdatedAt: string | null; // ISO
}
