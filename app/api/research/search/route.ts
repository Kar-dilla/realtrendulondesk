// app/api/research/search/route.ts
//
// Stage 1 (Research Engine role). Body: { storyId }. Runs the Tavily
// queries for this specific story, dedups, stores the raw results, returns
// them. No Groq call here — this role only retrieves, it never analyzes.
// Fast — should return in a few seconds barring a Tavily rate limit, so this
// stays comfortably under the ~100s Codespaces proxy timeout on its own.

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { searchStory } from '@/lib/research/search';

const prisma = new PrismaClient();

function statusForSearchError(errorType: string): number {
  switch (errorType) {
    case 'rate_limit':
      return 429;
    case 'no_results':
      // An honest empty state, not a crash — still {error:true} so the UI
      // can branch on it distinctly from a hard failure, but not a 5xx.
      return 200;
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

  try {
    await prisma.story.update({ where: { id: storyId }, data: { researchStatus: 'searching', researchError: null } });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_write_failed', message: err?.message ?? 'Failed to record search status.' },
      { status: 500 }
    );
  }

  const result = await searchStory(story);

  if (!result.ok) {
    try {
      await prisma.story.update({ where: { id: storyId }, data: { researchStatus: 'failed', researchError: result.message } });
    } catch {
      // Best-effort status write only — the search failure itself is still
      // the more informative thing to report back to the caller.
    }
    return NextResponse.json(
      { error: true, error_type: result.error_type, message: result.message },
      { status: statusForSearchError(result.error_type) }
    );
  }

  try {
    await prisma.story.update({
      where: { id: storyId },
      data: { searchResults: result.results, researchStatus: 'searched', researchError: null },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_write_failed', message: err?.message ?? 'Failed to save search results.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ error: false, results: result.results, researchStatus: 'searched' });
}
