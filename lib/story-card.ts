// Turns a stored Story row into the StoryCardData the UI renders.
// ONE mapper for Dashboard, Today's News, Top Stories and Selection. Do not write your own.
// Owned by the Lead.

import type { ConfidenceLevel, StoryCardData } from './contracts/newsroom';
import { domainFromUrl, priorityFromScore } from './format';

/** Structural type: a Prisma `Story` row satisfies it, and tests can pass plain objects. */
export interface StoryRowLike {
  id: string;
  headline: string;
  category: string | null;
  sourceUrls: string[];
  discoveredAt: Date | string;
  eventTime?: Date | string | null;
  fitScore: number | null;
  firstReportedAt?: Date | string | null;
  lastUpdatedAt?: Date | string | null;
  globalImpact?: number | null;
  humanImpact?: number | null;
  freshnessScore?: number | null;
  sourceConfidence?: string | null;
}

function toIso(v: Date | string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toConfidence(v: string | null | undefined): ConfidenceLevel | null {
  const u = (v ?? '').toUpperCase();
  return u === 'HIGH' || u === 'MEDIUM' || u === 'LOW' ? u : null;
}

export function toStoryCardData(row: StoryRowLike): StoryCardData {
  const seen = new Set<string>();
  const sources: { domain: string; url: string }[] = [];
  for (const url of row.sourceUrls) {
    const domain = domainFromUrl(url);
    if (seen.has(domain)) continue;
    seen.add(domain);
    sources.push({ domain, url });
  }
  const first = toIso(row.firstReportedAt) ?? toIso(row.eventTime) ?? toIso(row.discoveredAt);
  return {
    id: row.id,
    headline: row.headline,
    category: row.category,
    priority: priorityFromScore(row.fitScore),
    score: row.fitScore,
    globalImpact: row.globalImpact ?? null,
    humanImpact: row.humanImpact ?? null,
    freshness: row.freshnessScore ?? null,
    sourceConfidence: toConfidence(row.sourceConfidence),
    sourceCount: sources.length,
    sources,
    firstReportedAt: first,
    lastUpdatedAt: toIso(row.lastUpdatedAt) ?? first,
  };
}
