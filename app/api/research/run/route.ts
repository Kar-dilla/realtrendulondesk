// app/api/research/run/route.ts
//
// Body: { storyId: string, topicKey?: string }
//
// Rejects with invalid_request if storyId is missing or if the story isn't
// actually the currently selected one — don't silently research an
// unselected story. Calls Groq once via lib/research/build-brief, and on a
// malformed/rate-limited/missing-key failure returns an honest error without
// saving anything (no partial or guessed brief). On success, saves
// researchBrief + researchedAt.

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { buildResearchBrief } from '@/lib/research/build-brief';
import { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

function errorStatusFor(errorType: string): number {
  switch (errorType) {
    case 'invalid_request':
      return 400;
    case 'rate_limit':
      return 429;
    case 'missing_api_key':
    case 'db_read_failed':
    case 'db_write_failed':
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
      { status: errorStatusFor('invalid_request') }
    );
  }

  const storyId = body?.storyId;
  const topicKey = body?.topicKey;

  if (typeof storyId !== 'string' || storyId.trim().length === 0) {
    return NextResponse.json(
      { error: true, error_type: 'invalid_request', message: 'storyId is required.' },
      { status: errorStatusFor('invalid_request') }
    );
  }

  let story: any;
  let topicNote: any = null;
  try {
    story = await prisma.story.findUnique({
      where: { id: storyId },
      include: { verifiedClaims: true },
    });

    if (typeof topicKey === 'string' && topicKey.trim().length > 0) {
      topicNote = await prisma.topicNote.findUnique({ where: { topicKey } });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_read_failed', message: err?.message ?? 'Failed to read story or topic note.' },
      { status: errorStatusFor('db_read_failed') }
    );
  }

  if (!story || story.id !== storyId || !story.selectedForPipeline) {
    return NextResponse.json(
      { error: true, error_type: 'invalid_request', message: 'Story is not the currently selected story.' },
      { status: errorStatusFor('invalid_request') }
    );
  }

  const result = await buildResearchBrief(story.verifiedClaims, topicNote?.note ?? null);

  if (!result.ok) {
    return NextResponse.json(
      { error: true, error_type: result.error_type, message: result.message },
      { status: errorStatusFor(result.error_type) }
    );
  }

  const researchedAt = new Date();
  try {
    await prisma.story.update({
      where: { id: storyId },
      data: { researchBrief: result.brief as unknown as Prisma.InputJsonValue, researchedAt },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_write_failed', message: err?.message ?? 'Failed to save research brief.' },
      { status: errorStatusFor('db_write_failed') }
    );
  }

  return NextResponse.json({ error: false, brief: result.brief, researchedAt: researchedAt.toISOString() });
}
