// app/api/research/topic-notes/route.ts
//
// Per Constitution §6c: a lightweight, manually-maintained note per
// recurring topic. The owner writes/edits it by hand — no LLM involvement,
// no topic-detection or auto-tagging here.
//
// GET  /api/research/topic-notes?topicKey=...  -> { error: false, note: null | TopicNote }
// POST /api/research/topic-notes { topicKey, note } -> upsert

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topicKey = searchParams.get('topicKey');

  if (!topicKey) {
    return NextResponse.json(
      { error: true, error_type: 'invalid_request', message: 'topicKey query parameter is required.' },
      { status: 400 }
    );
  }

  try {
    const note = await prisma.topicNote.findUnique({ where: { topicKey } });
    return NextResponse.json({ error: false, note: note ?? null });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_read_failed', message: err?.message ?? 'Failed to read topic note.' },
      { status: 500 }
    );
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

  const topicKey = body?.topicKey;
  const note = body?.note;

  if (typeof topicKey !== 'string' || topicKey.trim().length === 0 || typeof note !== 'string') {
    return NextResponse.json(
      { error: true, error_type: 'invalid_request', message: 'topicKey and note are both required.' },
      { status: 400 }
    );
  }

  try {
    const saved = await prisma.topicNote.upsert({
      where: { topicKey },
      create: { topicKey, note },
      update: { note },
    });
    return NextResponse.json({ error: false, note: saved });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_write_failed', message: err?.message ?? 'Failed to save topic note.' },
      { status: 500 }
    );
  }
}
