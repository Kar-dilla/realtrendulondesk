import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/selection
// Returns every story that has cleared Ranking (fitScore IS NOT NULL), sorted
// by fitScore descending. No tier/score cutoff, no pagination — deliberate
// per the Module 05 brief §2. Read-only against Ranking/Verification output.
export async function GET() {
  try {
    const stories = await prisma.story.findMany({
      where: { fitScore: { not: null } },
      orderBy: { fitScore: "desc" },
      select: {
        id: true,
        headline: true,
        summary: true,
        fitScore: true,
        verificationTier: true,
        editorialReason: true,
        fitRationale: true,
        selectedForPipeline: true,
        selectedAt: true,
      },
    });

    return NextResponse.json({ error: false, stories });
  } catch (err) {
    return NextResponse.json(
      {
        error: true,
        error_type: "db_read_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
