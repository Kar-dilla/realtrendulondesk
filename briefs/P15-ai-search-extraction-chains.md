# P15: AI, search and extraction fallback chains

**Read `CONTRACT.md` first.** Brief v2 §7, §8, §17, §33, §34. Every provider has failed on this project at some point, so no feature may depend on a single provider.

## Goal
Build the three chains the app calls, then rewire Deep Research (Module 06) onto them.
- AI: Gemini, Groq, OpenRouter
- Search: Tavily, Google Custom Search, DuckDuckGo
- Extraction: Jina Reader for every URL search returns

## Read before you write
`lib/contracts/providers.ts` (the interfaces you implement), `lib/research/search.ts`, `lib/research/synthesize.ts`, everything under `app/api/research/`, and their tests. The existing fabricated-citation check in synthesis **must survive**.

## Build

**1. AI providers** in `lib/providers/ai/` (`gemini.ts`, `groq.ts`, `openrouter.ts`), plain `fetch`, no SDKs. Models come only from `GEMINI_MODEL`, `GROQ_MODEL`, `OPENROUTER_MODEL`. Never hardcode a model name. A provider whose key or model is missing returns `ok:false, kind:'auth'` immediately.

**2. AI chain** `lib/providers/ai/chain.ts`, `createAIService(...)`:
- Route by task (brief §33): classify/dedupe/summarize/analyze try Groq first; research/conflict try Gemini, Groq, OpenRouter; script/rewrite try Groq, OpenRouter, Gemini.
- Gemini 503: wait briefly, retry once, then fall through. Gemini 404 (dead model): no retry, fall through. Groq 429: wait about 65 seconds, retry once. OpenRouter 429: one retry, then give up.
- If all fail, return `ok:false` with the full `attempts` list and a message naming what was tried and why each failed. **Never return made-up output.**
- Waiting uses an injectable `sleep` so tests run instantly. Every request has a timeout.

**3. Search** in `lib/providers/search/` (`tavily.ts`, `googleCse.ts`, `duckduckgo.ts`, `chain.ts`). Fall through **only on real failure** (rate limit, quota, auth, network), never because results were few. Keep every source URL. For DuckDuckGo choose the smallest reliable approach; if it needs an npm package, ask the Lead. Brave Search is not allowed (free tier ended).

**4. Extraction** `lib/providers/extract/jina.ts`: `GET https://r.jina.ai/<url>`; add `Authorization: Bearer $JINA_API_KEY` when set. Run **every** URL search returned through it, even ones that already had partial text. Only mark a source "full text unavailable" if Jina also fails. Limit concurrency and respect the keyless 20 requests/minute. Cap text length and set `truncated`.

**5. Cache.** In-memory TTL cache for search results and extracted pages so the same URL is never fetched twice per window. (A database cache is a later table request.)

**6. Provider status** `lib/providers/status.ts`: `getProviderStatuses(): ProviderStatus[]` for P14's settings screen. Reports `configured` true/false per provider and the env var names. **Never return a key value.**

**7. Rewire Module 06.** Make `lib/research/search.ts`, `synthesize.ts` and the routes under `app/api/research/` use the chains. Response shapes only grow, never shrink (the page and tests read them). Add `extraction: { total, succeeded, failed: [{ url, reason }] }` so the UI can say "Research incomplete: 2 of 5 sources unavailable". Partial extraction failure is a warning, not an error. If the AI chain fails, keep the research evidence and set status `failed` with the attempt list.

## Out of scope
Any UI, the Settings screen (P14), script prompts (P09), discovery (P08).

## Acceptance
- Unit tests with fake providers cover each retry rule, fall-through order, all-fail message, search falls through on 429 but not on a thin result, Jina failure marks only that source, cache hit skips the call. No test touches the network or really sleeps.
- One live run of each provider you have keys for; paste results (never keys) in `DONE.md`.
- `grep -rn "gemini-1.5\|gemini-2" lib app` finds nothing.
- Existing research tests pass, or each intentional change is listed under "Tests changed".
- `bash scripts/check-owner.sh p15` says Clean; typecheck, test, build pass.
- `DONE.md` per `CONTRACT.md` §9, including the new env vars you rely on.
