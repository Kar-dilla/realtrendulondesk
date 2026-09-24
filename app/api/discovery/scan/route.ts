import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { scanTopNews } from '@/lib/discovery/discovery-source';
import { dedupeStories } from '@/lib/discovery/dedupe';
import { persistStories } from '@/lib/discovery/persist';

// NOTE on the endpoint path: the brief specifies /api/discovery/scan. On
// record, Module 01 already wired its "Find Today's Stories" button to
// POST /api/discovery/run. That's a real conflict I can't resolve for you —
// I don't have visibility into the deployed repo to confirm which one is
// still live. Pick one:
//   (a) rename the Module 01 button's fetch target to /scan, or
//   (b) add a thin /api/discovery/run route that just calls this handler.
// I went with the brief's /scan path here since it's the newer, explicit spec.

const prisma = new PrismaClient();

export async function POST() {
  const result = await scanTopNews();

  if (!result.ok) {
    const status = result.error_type === 'rate_limit' ? 429
      : result.error_type === 'missing_api_key' ? 500
      : result.error_type === 'timeout' ? 504
      : 502;

    return NextResponse.json(
      { error: true, error_type: result.error_type, message: result.message },
      { status }
    );
  }

  if (!result.stories || result.stories.length === 0) {
    return NextResponse.json(
      { error: true, error_type: 'no_results', message: 'No results returned from Gemini for the last 24 hours.' },
      { status: 200 }
    );
  }

  const deduped = dedupeStories(result.stories);

  try {
    const { inserted, skipped_existing } = await persistStories(prisma, deduped);
    return NextResponse.json({
      error: false,
      stories: deduped,
      persisted: { inserted, skipped_existing },
    });
  } catch (err: any) {
    // Discovery succeeded but the DB write failed — surface that distinctly
    // rather than pretending the scan itself failed.
    return NextResponse.json(
      { error: true, error_type: 'db_write_failed', message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
