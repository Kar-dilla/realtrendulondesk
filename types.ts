// Shared-store contract (types only). Constitution §4.
// Fields beyond the brief's two concrete interfaces are deliberately loose/optional:
// the owning module will refine them. Do not tighten these without Supervisor approval.

export type VerificationTier = 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'DISPUTED';

// Module 02 (Discovery)
export interface Story {
  id: string;
  headline: string;
  discoveredAt: string;
  sourceUrls: string[];
}

// Module 03 (Verification)
export interface VerifiedClaim {
  storyId: string;
  claim: string;
  tier: VerificationTier;
  evidence?: string;
}

// Module 04 (Ranking/Fit)
export interface RankedStory {
  storyId: string;
  score?: number;
  editorialReason?: string;
}

// Module 06 (Story Research)
export interface StoryBrief {
  storyId: string;
  confirmed?: string[];
  developing?: string[];
  notConfirmed?: string[];
}

// Module 07 (Script Engine)
export interface Script {
  id: string;
  storyId: string;
  version?: number;
  body?: string;
  platform?: string;
}

// Module 08 (Visual Research)
export interface VisualAsset {
  id: string;
  storyId: string;
  description?: string;
  sourceUrl?: string;
  licensed?: boolean;
}

// Module 09 (Distribution/Analytics)
export interface PublishRecord {
  storyId: string;
  platform?: string;
  scriptVersion?: number;
  publishedAt?: string;
}

export interface PerformanceData {
  storyId: string;
  platform?: string;
  capturedAt?: string;
  metrics?: Record<string, number>;
}

// Constitution §3: insights are conditional patterns, never absolute rules.
export interface EditorialInsight {
  id: string;
  pattern?: string;
  conditions?: string[];
  evidenceStoryIds?: string[];
}
