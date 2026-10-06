# Trendulon Newsroom: Contract (Wave 0)

Read this fully before you write any code. Rules here beat any preference of your own.
The Lead (Kardilla) is the only person who merges. Questions go to the Lead.

## 1. Names

- **P01–P15** = work packages (this plan). **M01–M09** = the older module numbers in `lib/modules.ts`. Never mix them.
- Brand: black `#0a0a0a`, white, orange `#fe6d05`. Tagline: "Global stories. Told the right way."

## 2. Ownership: touch only your folders

Full list in `scripts/ownership.txt`. Summary:

| Pkg | Job | Owns |
|---|---|---|
| P01 | Shell, sidebar, login | `components/shell/`, `components/ui/Nav.tsx`, `app/layout.tsx`, `app/globals.css`, `app/ui.css`, `app/login/`, `app/auth/`, `lib/supabase/`, `lib/modules.ts`, `proxy.ts` |
| P02 | Dashboard UI | `app/dashboard/`, `components/dashboard/`, `app/page.tsx` |
| P03 | Today's News UI | `app/discovery/`, `components/discovery/` |
| P04 | Verification UI | `app/verification/`, `components/verification/` |
| P05 | Top Stories UI | `app/ranking/`, `components/ranking/` |
| P06 | Selection UI | `app/selection/`, `components/selection/` |
| P07 | Deep Research UI | `app/research/`, `components/research/` |
| P08 | GDELT + RSS discovery | `lib/discovery/`, `app/api/discovery/` |
| P09 | Script Studio | `app/scripts/`, `components/scripts/`, `lib/scripts/`, `app/api/scripts/` |
| P10 | Media Assets | `app/visuals/`, `components/media/`, `lib/media/`, `app/api/media/` |
| P11 | Publishing workflow | `app/published/`, `components/publishing/`, `lib/publishing/`, `app/api/publishing/` |
| P12 | Performance | `app/analytics/`, `components/performance/`, `lib/performance/`, `app/api/performance/` |
| P13 | Editorial Standards | `app/standards/`, `components/standards/`, `lib/standards/`, `app/api/standards/`, `app/api/ranking/`, `lib/ranking-prompt.ts` |
| P14 | Settings UI | `app/settings/`, `components/settings/`, `lib/settings/`, `app/api/settings/` |
| P15 | AI / search / extraction chains | `lib/providers/`, `lib/research/`, `app/api/research/` |

**Lead-only files** (ask, never edit): `package.json`, `prisma/`, `lib/shared-store/`, `lib/contracts/`, `lib/format.ts`, `components/ui/*` (except `Nav.tsx`), `scripts/`, `CONTRACT.md`, `.env*`, every existing `__tests__` folder, `lib/verification/`, `components/VerificationBadge.tsx`.

Need a shared file changed? Write the exact change you need in your `DONE.md` under "Requests to Lead".

## 3. Routes and sidebar labels

Existing routes stay. Only the labels change. P01 wires this into `lib/modules.ts`.

| Sidebar label | Route | UI owner |
|---|---|---|
| Dashboard | `/dashboard` | P02 |
| Today's News | `/discovery` | P03 |
| Top Stories | `/ranking` | P05 |
| Deep Research | `/research` | P07 |
| Script Studio | `/scripts` | P09 |
| Media Assets | `/visuals` | P10 |
| Published Stories | `/published` | P11 |
| Performance | `/analytics` | P12 |
| Editorial Standards | `/standards` | P13 |
| Settings | `/settings` | P14 |

`/verification` (P04) and `/selection` (P06) stay alive but are reached from story cards, not the sidebar.

## 4. Use the kit. Do not reinvent it

```ts
import { Card, Button, StoryCard, PriorityBadge, ProgressBar, TierBadge } from '@/components/ui';
import type { StoryCardData } from '@/lib/contracts';
import { timeAgo, formatScore } from '@/lib/format';
```

- Colours come from CSS variables (`var(--accent)`, `var(--ok)` ...). **No new hex values.**
- The story card is `StoryCard`. Dashboard, Today's News, Top Stories and Selection all use it. Do not fork it.
- Every page needs three states: loading, empty (say what to do next), error (say what failed and how to retry).
- Design for a 390px-wide phone first. The Lead tests on a phone.
- No new npm packages without Lead approval.

## 5. Backend rules

1. External APIs are called from `app/api/**` or `lib/**` on the server only. Never from a component.
2. Keys live in env vars. Never prefix a secret with `NEXT_PUBLIC_`. Never log a key.
3. A provider never throws for an expected failure. It returns `{ ok:false, error }` (see `lib/contracts/providers.ts`).
4. If every provider in a chain fails, return the attempt list and a clear message. Never invent output.
5. AI output is not evidence. Citations may only point at URLs that were actually retrieved (brief v2 §9, §16).
6. Retry rules (brief v2 §8, §34): Gemini 503 = wait briefly, retry once, then fall through. Gemini 404 = fall through at once. Groq 429 = wait about 65 s, retry once. OpenRouter 429 = one retry, then surface the error.
7. Cache search and extraction results. Do not hit the same URL twice.

## 6. Database: Prisma on Supabase

- Only the Lead edits `prisma/schema.prisma` and runs migrations. Need a table or column? Put it in `DONE.md` under "Table requests" (model name, fields, why).
- Never run `prisma migrate reset` or `db push --force-reset` against the shared database.
- Prisma connects as a server role and bypasses Row Level Security. So every app table gets RLS **enabled with no policies** (the public anon key then sees nothing) and the browser never queries these tables directly.
- Connection strings in `.env`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // Supabase pooler, port 6543, add ?pgbouncer=true
  directUrl = env("DIRECT_URL")     // used by migrations; use the Session pooler string (port 5432)
}
```

Codespaces often has no IPv6, and Supabase's plain "direct" string is IPv6-only on the free plan. If migrations hang, use the Session pooler string for `DIRECT_URL`.

## 7. Env vars (names only, add to `.env.example`)

```
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
TAVILY_API_KEY=
GOOGLE_CSE_API_KEY=
GOOGLE_CSE_ID=
JINA_API_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=
GROQ_API_KEY=
GROQ_MODEL=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
PEXELS_API_KEY=
UNSPLASH_ACCESS_KEY=
```

GDELT, RSS, Wikimedia Commons and Openverse need no keys. Only the two `NEXT_PUBLIC_SUPABASE_*` values may reach the browser.

## 8. How the Lead pastes your work

```bash
git checkout -b p03                 # your package id
# ...paste your files at their repo-relative paths...
bash scripts/check-owner.sh p03     # must say "Clean"
npm run typecheck && npm test && npm run build
git add -A && git commit -m "P03: Today's News UI"
git checkout main && git merge p03
```

If `check-owner.sh` prints OUTSIDE, nothing gets committed until that file is removed.

## 9. What you hand back: a `DONE.md`

```
# P03 DONE
Files (repo-relative): ...
New env vars: ...
Table requests: ...
Requests to Lead: ...
How I tested it: (commands run + what you saw)
Known gaps: ...
```

Files are sent as a zip whose paths start at the repo root (`app/discovery/page.tsx`, not `discovery/page.tsx`).

## 10. Order

- **Wave 0:** this kit. Finish Module 06 first (status-value fix, schema migration, `npm test`, commit).
- **Wave 1:** P01, P08, P15 start together.
- **Wave 2:** P02–P07 reskins and P09–P14 new modules, once P01 is merged and the app runs.
- **Wave 3:** the Lead and Claude run the full test, click through every page, fix the seams.
- **Not built yet, on purpose:** the Learning system. It needs real performance data first.
