import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { classifyStoryClaims, type Tier } from '@/lib/verification/classify';
import { rollupTier } from '@/lib/verification/rollup';

const prisma = new PrismaClient();

interface StoryResult {
  storyId: string;
  headline: string;
  tier: Tier | null;
  reason: string | null;
  claims: { claim: string; tier: Tier; evidence: string | null }[];
}

// Cheap count for the dashboard's "Verify New Stories (n pending)" button.
export async function GET() {
  try {
    const pending = await prisma.story.count({ where: { verificationTier: null } });
    return NextResponse.json({ error: false, pending });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_read_failed', message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function POST() {
  let pendingStories;
  try {
    pendingStories = await prisma.story.findMany({ where: { verificationTier: null } });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_read_failed', message: err?.message ?? String(err) },
      { status: 500 }
    );
  }

  const results: StoryResult[] = [];
  let claimsTiered = 0;
  let leftNull = 0;
  const breakdown = { model_failure: 0, unclassifiable_content: 0, db_write_failed: 0 };

  for (const story of pendingStories) {
    const classification = await classifyStoryClaims(story);

    // Model/API failure — could not get a usable response at all.
    if (!classification.ok) {
      leftNull++;
      breakdown.model_failure++;
      results.push({
        storyId: story.id,
        headline: story.headline,
        tier: null,
        reason: classification.error_type,
        claims: [],
      });
      continue;
    }

    // Model responded fine but found nothing classifiable — genuinely
    // unclassifiable content, not a model failure. Never force a tier here.
    if (classification.claims.length === 0) {
      leftNull++;
      breakdown.unclassifiable_content++;
      results.push({
        storyId: story.id,
        headline: story.headline,
        tier: null,
        reason: 'no_classifiable_claims',
        claims: [],
      });
      continue;
    }

    const tier = rollupTier(classification.claims.map((c) => c.tier)) as Tier;

    try {
      await prisma.$transaction([
        prisma.verifiedClaim.createMany({
          data: classification.claims.map((c) => ({
            storyId: story.id,
            claim: c.claim,
            tier: c.tier,
            evidence: c.evidence,
          })),
        }),
        prisma.story.update({
          where: { id: story.id },
          data: { verificationTier: tier },
        }),
      ]);
    } catch (err: any) {
      // Classified successfully but couldn't persist — stays null rather
      // than reporting a tier that never actually made it to the DB.
      leftNull++;
      breakdown.db_write_failed++;
      results.push({
        storyId: story.id,
        headline: story.headline,
        tier: null,
        reason: 'db_write_failed',
        claims: [],
      });
      continue;
    }

    claimsTiered += classification.claims.length;
    results.push({
      storyId: story.id,
      headline: story.headline,
      tier,
      reason: null,
      claims: classification.claims,
    });
  }

  return NextResponse.json({
    error: false,
    processed: pendingStories.length,
    claims_tiered: claimsTiered,
    left_null: leftNull,
    left_null_breakdown: breakdown,
    results,
  });
}
