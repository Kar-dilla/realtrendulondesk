import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// POST /api/selection/select
// Body: { storyId: string }
// Sets selectedForPipeline = true and selectedAt = now(). The only write this
// module makes; no re-scoring, no "unselect". See Module 05 brief §3.
export async function POST(request: NextRequest) {
  let storyId: unknown;

  try {
    const body = await request.json();
    storyId = body?.storyId;
  } catch {
    return NextResponse.json(
      { error: true, error_type: "invalid_request", message: "Request body must be valid JSON with a storyId field." },
      { status: 400 }
    );
  }

  if (typeof storyId !== "string" || storyId.length === 0) {
    return NextResponse.json(
      { error: true, error_type: "invalid_request", message: "storyId is required." },
      { status: 400 }
    );
  }

  try {
    const story = await prisma.story.update({
      where: { id: storyId },
      data: { selectedForPipeline: true, selectedAt: new Date() },
    });

    return NextResponse.json({ error: false, story });
  } catch (err) {
    return NextResponse.json(
      {
        error: true,
        error_type: "db_write_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
