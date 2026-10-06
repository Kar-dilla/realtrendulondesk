# P08: Discovery rework (GDELT + RSS, no AI)

**Read `CONTRACT.md` first.** Brief v2 §5, §6, §38: discovery must be cheap and broad. Tavily and Groq are reserved for Deep Research. Discovery uses **no AI call at all**.

## Goal
"Scan the last 24 hours" fetches news from GDELT and a set of RSS feeds, groups duplicates into one story per event, scores freshness, and saves stories. It also records how many sources answered.

## Read before you write
Everything in `lib/discovery/` (`discovery-source.ts`, `dedupe.ts`, `persist.ts`, `gemini-client.ts`), `app/api/discovery/scan/route.ts`, `__tests__/discovery.test.ts`, `lib/shared-store/types.ts`, `lib/contracts/providers.ts`. Keep the existing `Story` shape and `persist` behaviour; change only where stories come from.

## Build

**1. `lib/discovery/providers/gdelt.ts`** implements `NewsProvider`. GDELT DOC 2.0 API, article-list mode, JSON, last 24h, newest first. It needs search terms, so run a configurable list of topic queries (conflict, disaster, politics, economy, technology, science, health, world) one after another with a pause between them. GDELT asks callers to be gentle with request rates: **check its current documentation for the limit and respect it.** Query list lives in config, not code.

**2. `lib/discovery/providers/rss.ts`** implements `NewsProvider` for one feed. `lib/discovery/feeds.ts` holds the feed list as config: aim for about 13 reputable international outlets (candidates: BBC, Al Jazeera, DW, France 24, Sky News, The Guardian, NPR, Euronews and similar). **Verify every feed URL live before you keep it;** drop dead ones. Handle both RSS and Atom. You may ask the Lead to approve `fast-xml-parser`; do not write a regex parser.

**3. Failure handling.** Each provider returns `ok:false` instead of throwing (see contract). One dead source must never fail the scan. Timeout every request (suggest 10s).

**4. Story building, no AI.**
- Clean titles (strip " - Outlet" suffixes, entities, whitespace). Skip items older than 24h or with no URL.
- Category: map from feed category tags, GDELT theme/topic query, and a keyword table in config. Unknown = `null`, never guessed by a model.
- Group duplicates into one story: reuse `dedupe.ts`, extended with title similarity (normalised word overlap) plus time proximity. "Explosion rocks Beirut" and "Blast reported in Beirut" must group. Prefer a tested, deterministic rule over cleverness.
- For each story set: `sourceUrls` (all distinct articles), `firstReportedAt` (earliest article time), `lastUpdatedAt` (latest), `freshnessScore` 0-10 (newer and still-updating = higher; document your formula in a comment and unit test it).
- A re-scan that finds new articles for an existing story **updates** it (counts as "updated"); a brand new event counts as "new".

**5. Scan report.** `POST /api/discovery/scan` returns, and saves to the new `ScanRun` table: `articlesFetched`, `newStories`, `updatedStories`, `sources: [{ id, ok, count, error? }]`. Add `GET /api/discovery/status` returning the latest run. The dashboard shows "631 articles, 258 new stories, 0 updated, 13 of 14 sources responded" from this.

**6. Remove the AI.** Discovery must no longer call Tavily, Groq or Gemini. Delete or leave unused `gemini-client.ts` only if nothing else imports it (grep first).

## Out of scope
Impact scores, `fitScore`, priority (the ranking step does those), any UI, Deep Research.

## Acceptance
- Unit tests with recorded sample payloads (save small real GDELT and RSS samples as fixtures). No test touches the network.
- Tests for: dedupe grouping, freshness formula, one provider failing, all providers failing, 24h cutoff.
- Run one live scan against real feeds and paste the counts and per-source results into `DONE.md`.
- No `TAVILY`/`GROQ`/`GEMINI` reference remains in `lib/discovery/` or the scan route.
- Existing response fields stay; you only add.
- `__tests__/discovery.test.ts` changes only where behaviour intentionally changed; list each change.
- `bash scripts/check-owner.sh p08` says Clean; typecheck, test, build pass.
- `DONE.md` per `CONTRACT.md` §9.
