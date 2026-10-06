// app/api/research/synthesize/route.ts
//
// Stage 2 (Research Analyst role). Body: { storyId, instructions?, topicKey? }.
// Requires Stage 1 to have already run (not_yet_searched otherwise). Reads
// the stored searchResults + the story's VerifiedClaim rows + an optional
// owner instructions string, makes one Groq call, and on success saves the
// full 9-part researchBrief. Never calls Tavily itself.
//
// topicKey is carried over from v1/Constitution §6c (a manually-maintained
// running-topic note, read here as background context). This v2 brief's own
// UI spec doesn't re-list it explicitly, so keeping it is a judgment call —
// see NOTES-for-supervisor.md.

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { synthesizeResearchBrief } from '@/lib/research/synthesize';

const prisma = new PrismaClient();

function statusForSynthesizeError(errorType: string): number {
  switch (errorType) {
    case 'rate_limit':
      return 429;
    case 'missing_api_key':
      return 500;
    default:
      return 502;
  }
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: true, error_type: 'invalid_request', message: 'Request body was not valid JSON.' },
      { status: 400 }
    );
  }

  const storyId = body?.storyId;
  const instructions =
    typeof body?.instructions === 'string' && body.instructions.trim().length > 0 ? body.instructions.trim() : null;
  const topicKey = typeof body?.topicKey === 'string' && body.topicKey.trim().length > 0 ? body.topicKey.trim() : null;

  if (typeof storyId !== 'string' || storyId.trim().length === 0) {
    return NextResponse.json(
      { error: true, error_type: 'invalid_request', message: 'storyId is required.' },
      { status: 400 }
    );
  }

  let story: any;
  try {
    story = await prisma.story.findUnique({ where: { id: storyId }, include: { verifiedClaims: true } });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_read_failed', message: err?.message ?? 'Failed to read story.' },
      { status: 500 }
    );
  }

  if (!story || !story.selectedForPipeline) {
    return NextResponse.json(
      { error: true, error_type: 'invalid_request', message: 'Story is not the currently selected story.' },
      { status: 400 }
    );
  }

  const searchResults = Array.isArray(story.searchResults) ? story.searchResults : null;
  if (!searchResults || searchResults.length === 0) {
    return NextResponse.json(
      {
        error: true,
        error_type: 'not_yet_searched',
        message: 'No stored search results for this story — run Find Sources (Stage 1) first.',
      },
      { status: 400 }
    );
  }

  let topicNote: any = null;
  if (topicKey) {
    try {
      topicNote = await prisma.topicNote.findUnique({ where: { topicKey } });
    } catch (err: any) {
      return NextResponse.json(
        { error: true, error_type: 'db_read_failed', message: err?.message ?? 'Failed to read topic note.' },
        { status: 500 }
      );
    }
  }

  try {
    await prisma.story.update({
      where: { id: storyId },
      data: { researchStatus: 'synthesizing', researchError: null, researchInstructions: instructions },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_write_failed', message: err?.message ?? 'Failed to record synthesis status.' },
      { status: 500 }
    );
  }

  const result = await synthesizeResearchBrief(
    { headline: story.headline, summary: story.summary },
    story.verifiedClaims,
    searchResults,
    topicNote?.note ?? null,
    instructions
  );

  if (!result.ok) {
    try {
      await prisma.story.update({ where: { id: storyId }, data: { researchStatus: 'failed', researchError: result.message } });
    } catch {
      // Best-effort status write only.
    }
    return NextResponse.json(
      { error: true, error_type: result.error_type, message: result.message },
      { status: statusForSynthesizeError(result.error_type) }
    );
  }

  const researchedAt = new Date();
  try {
    // researchStatus returns to 'searched' (ready-to-review), not 'complete'
    // — per §5, only the finalize endpoint (Send to Script Generation) sets
    // 'complete'. See NOTES-for-supervisor.md for the reasoning; this is a
    // judgment call, not something the brief stated outright.
    await prisma.story.update({
      where: { id: storyId },
      data: { researchBrief: JSON.parse(JSON.stringify(result.brief)), researchedAt, researchStatus: 'searched', researchError: null },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_write_failed', message: err?.message ?? 'Failed to save research brief.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    error: false,
    brief: result.brief,
    researchedAt: researchedAt.toISOString(),
    researchStatus: 'searched',
  });
}
