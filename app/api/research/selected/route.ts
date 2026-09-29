// app/api/research/selected/route.ts
//
// Returns the currently selected story (selectedForPipeline = true) with its
// VerifiedClaim rows, for the /research page to display. Queried defensively
// (orderBy selectedAt desc, take: 1) rather than assuming exactly one
// selected row exists, per the Module 06 brief. An honest empty state —
// { error: false, story: null } — is returned when nothing is selected;
// that's not an error condition.

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const stories = await prisma.story.findMany({
      where: { selectedForPipeline: true },
      orderBy: { selectedAt: 'desc' },
      take: 1,
      include: { verifiedClaims: true },
    });

    return NextResponse.json({ error: false, story: stories[0] ?? null });
  } catch (err: any) {
    return NextResponse.json(
      { error: true, error_type: 'db_read_failed', message: err?.message ?? 'Failed to read selected story.' },
      { status: 500 }
    );
  }
}
