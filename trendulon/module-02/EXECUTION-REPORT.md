# Module 02 (Discovery) — Execution Report

## Status: code written, NOT verified, NOT committed

No commit or push has been made. Two required steps from the brief are
still outstanding and cannot be done from where this was built (no network
access to Gemini, GitHub, or your Postgres instance):

1. The automated Jest run (mocked) — not executed, only written.
2. The manual live-scan verification — not executed.

Both need to happen in your Codespaces / real dev environment. See
"What I need back from you" at the bottom.

## Files, one by one

| File | What it does |
|---|---|
| `prisma/schema.prisma` | Adds a `Story` model — merge into your existing schema, don't run standalone. |
| `src/lib/types.PATCH.md` | Instructions (not a full file) for the fields to add to the existing shared `Story` interface. |
| `src/lib/discovery/gemini-client.ts` | Calls Gemini `generateContent` with `google_search` grounding tool, parses/validates the JSON response, classifies errors (missing key / rate limit / timeout / malformed). |
| `src/lib/discovery/dedupe.ts` | Post-processing dedup: headline-token Jaccard similarity + 36h time window. Also builds the `dedupe_key` used to prevent duplicate rows on rescans. |
| `src/lib/discovery/persist.ts` | Upserts by `dedupe_key`; never overwrites `verification_tier`/`fit_score` if already set by a later module. |
| `src/app/api/discovery/scan/route.ts` | `POST /api/discovery/scan` — orchestrates the above, returns real errors, never fabricates fallback data. |
| `src/app/discovery/page.tsx` | Replaces the "Coming soon" placeholder — button, loading state, results list, distinct error states. |
| `__tests__/discovery.test.ts` | Dedup + validator unit tests (mocked, no network). |
| `__tests__/discovery-page.test.tsx` | UI error/success state tests (mocked fetch). |
| `.env.example.ADDITION` | `GEMINI_API_KEY`, `GEMINI_MODEL`. |

## Prisma schema + fields, with reasoning

Added: `summary`, `category`, `source_urls`, `event_time`, `discovered_at`,
`dedupe_key` (unique) — all Module 02-owned. Also added `verification_tier`
and `fit_score` as nullable columns now, so Module 03/04 don't need a
schema migration later just to have somewhere to write — Module 02 itself
never writes to either.

## Dedup approach, and why

Discrete post-processing step (headline similarity + time window), not
inside the Gemini prompt. Reasoning is inline in `dedupe.ts` — short
version: a second AI judgment call for grouping isn't unit-testable the
way plain code is, and the Constitution's module-boundary spirit reads
better with Discovery doing search and nothing else.

## Automated test output

**Not run.** No network in my build environment to install jest /
testing-library / ts-jest. Run `npm test` yourself and paste me the
real output.

## Manual live-scan results

**Not run.** Needs your real `GEMINI_API_KEY` and `DATABASE_URL`. Click
the button in your dev server, then send me:
- the actual headlines/source URLs that came back
- a `SELECT * FROM stories` result (or Prisma Studio output) confirming the row landed

## Judgment calls flagged (repeated from inline code comments, gathered here)

1. **Endpoint path conflict**: brief says `/api/discovery/scan`; Module 01's
   button is on record as wired to `/api/discovery/run`. Not resolved —
   you need to either repoint the button or add a thin alias route.
2. **File path conflict**: brief assumes `lib/shared-store/types.ts`;
   Module 01 is on record as having shipped `src/lib/types.ts`. Went with
   the latter (with snake_case naming, matching the stated project
   convention) — confirm before merging.
3. **Model name**: `gemini-2.5-flash` is a placeholder, not a verified
   current free-tier grounding model — flagged with a comment at the
   top of `gemini-client.ts`. Check Google's docs before shipping.
4. **No existing component reuse**: the dashboard page is self-contained
   Tailwind, not built on Module 01's actual `StoryCard`/`StatusBadge`
   components, since I don't have that source. Brand hex values are
   hardcoded from what's on record, not pulled from a shared token file.
5. **Migration not generated**: schema.prisma is written, but the actual
   migration SQL needs `npx prisma migrate dev` run against your real
   schema state, not hand-written by me.

## Left for Module 03/04

`verification_tier` and `fit_score` exist as nullable columns, written
nowhere by this module. No tier badges, no scoring UI — the dashboard
page shows headline/summary/sources/timestamp only, as specified.

## Commit/push

Not made. Awaiting your review and explicit authorization.
