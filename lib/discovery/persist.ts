import type { PrismaClient } from '@prisma/client';
import { buildDedupeKey, type DedupedStory } from './dedupe';

export interface PersistResult {
  inserted: number;
  skipped_existing: number;
}

/**
 * Upserts on dedupeKey: if a scan re-discovers something already stored
 * today, we don't insert a duplicate row. We deliberately don't touch
 * verificationTier / fitScore on conflict — those belong to later
 * modules and Module 02 must never overwrite them once set.
 */
export async function persistStories(prisma: PrismaClient, stories: DedupedStory[]): Promise<PersistResult> {
  let inserted = 0;
  let skipped_existing = 0;

  for (const story of stories) {
    const dedupeKey = buildDedupeKey(story);

    const existing = await prisma.story.findUnique({ where: { dedupeKey } });
    if (existing) {
      skipped_existing++;
      continue;
    }

    await prisma.story.create({
      data: {
        headline: story.headline,
        summary: story.summary,
        category: story.category,
        sourceUrls: story.source_urls,
        eventTime: story.event_time ? new Date(story.event_time) : null,
        dedupeKey,
        // verificationTier and fitScore left unset — Module 03/04's job.
      },
    });
    inserted++;
  }

  return { inserted, skipped_existing };
}
