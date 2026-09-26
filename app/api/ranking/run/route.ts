// app/api/ranking/run/route.ts
//
// Module 04 — Ranking/Fit. Mirrors Module 03's GET-pending-count +
// POST-run batch pattern, using the same inline PrismaClient/Groq-fetch
// convention as Modules 02-03 (no shared /lib/prisma or /lib/groq exist
// in this repo).

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { buildRankingPrompt, parseRankingOutput } from '@/lib/ranking-prompt';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 1, backoffMs = 65000): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const isRateLimit = err instanceof Error && /429|rate.?limit/i.test(err.message);
    if (isRateLimit && retries > 0) {
      await sleep(backoffMs);
      return withRetry(fn, retries - 1, backoffMs);
    }
    throw err;
  }
}


const prisma = new PrismaClient();

// Cap per-run batch size so a run finishes well inside the
// Codespaces proxy's connection timeout, even with a rate-limit retry in the mix.
const BATCH_LIMIT = 10;

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set.');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Groq returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

export async function GET() {
  try {
    const pendingCount = await prisma.story.count({ where: { fitScore: null } });
    return NextResponse.json({ error: false, pendingCount });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_read_failed', message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

interface RankedResult {
  id: string;
  headline: string;
  fitScore: number | null;
  editorialReason: string | null;
  fitRationale: string | null;
  verificationTier: 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'DISPUTED' | null;
  error?: string;
}

export async function POST() {
  let pendingStories;
  try {
    pendingStories = await prisma.story.findMany({
      where: { fitScore: null },
      select: { id: true, headline: true, summary: true, verificationTier: true },
      take: BATCH_LIMIT,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_read_failed', message: err?.message ?? String(err) },
      { status: 500 }
    );
  }

  const results: RankedResult[] = [];
  let processed = 0;
  let withReason = 0;
  let noReason = 0;
  let leftNull = 0;

  for (const story of pendingStories) {
    let rawOutput: string;
    try {
      rawOutput = await withRetry(() => callGroq(buildRankingPrompt({ ...story, verificationTier: story.verificationTier as any })));
      await sleep(1500);
    } catch (err) {
      leftNull += 1;
      results.push({
        id: story.id,
        headline: story.headline,
        fitScore: null,
        editorialReason: null,
        fitRationale: null,
        verificationTier: story.verificationTier as RankedResult['verificationTier'],
        error: `Groq call failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    const parsed = parseRankingOutput(rawOutput);
    if (!parsed) {
      // Never fabricate a score on malformed output — Constitution section 7.
      leftNull += 1;
      results.push({
        id: story.id,
        headline: story.headline,
        fitScore: null,
        editorialReason: null,
        fitRationale: null,
        verificationTier: story.verificationTier as RankedResult['verificationTier'],
        error: 'Malformed or unparseable model output',
      });
      continue;
    }

    const editorialReason = parsed.editorialReason === 'none' ? null : parsed.editorialReason;

    try {
      await prisma.story.update({
        where: { id: story.id },
        data: {
          fitScore: parsed.fitScore,
          editorialReason,
          fitRationale: parsed.fitRationale,
        },
      });
    } catch (err: any) {
      leftNull += 1;
      results.push({
        id: story.id,
        headline: story.headline,
        fitScore: null,
        editorialReason: null,
        fitRationale: null,
        verificationTier: story.verificationTier as RankedResult['verificationTier'],
        error: `Save failed: ${err?.message ?? String(err)}`,
      });
      continue;
    }

    processed += 1;
    if (editorialReason === null) noReason += 1;
    else withReason += 1;

    results.push({
      id: story.id,
      headline: story.headline,
      fitScore: parsed.fitScore,
      editorialReason,
      fitRationale: parsed.fitRationale,
      verificationTier: story.verificationTier as RankedResult['verificationTier'],
    });
  }

  return NextResponse.json({
    error: false,
    processed,
    withReason,
    noReason,
    leftNull,
    results,
  });
}
