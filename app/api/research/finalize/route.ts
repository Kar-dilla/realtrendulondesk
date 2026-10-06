// app/api/research/finalize/route.ts
//
// "Send to Script Generation." Module 07 doesn't exist yet, so this does
// exactly one thing and nothing else: mark the brief finalized. It must not
// pretend to call or stub Module 07.

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    story = await prisma.story.findUnique({ where: { id: storyId } });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_read_failed', message: err?.message ?? 'Failed to read story.' },
      { status: 500 }
    );
  }

  if (!story || !story.researchBrief) {
    return NextResponse.json(
      { error: true, error_type: 'invalid_request', message: 'This story has no research brief to finalize yet.' },
      { status: 400 }
    );
  }

  try {
    await prisma.story.update({ where: { id: storyId }, data: { researchStatus: 'complete' } });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_write_failed', message: err?.message ?? 'Failed to mark research complete.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ error: false, researchStatus: 'complete' });
}
