# Patch for src/lib/types.ts (or lib/shared-store/types.ts — see note below)

I don't have read access to your repo, so I'm not overwriting this file —
that risks silently deleting fields Module 01 or the shell already depend
on. Add the fields below to your **existing** `Story` interface by hand.

**Path mismatch to resolve first:** the Module 02 brief assumes
`lib/shared-store/types.ts`. What's on record from Module 01 is
`src/lib/types.ts`, using snake_case field names to match DB columns. I've
followed the Module 01 convention (snake_case, `src/lib/types.ts`) below —
confirm that's still the real path before you paste this in. If the repo
actually moved to `lib/shared-store/types.ts` in the meantime, same
fields, different file.

```ts
export interface Story {
  // --- existing fields — do not rename ---
  id: string;
  headline: string;
  discovered_at: string;      // ISO 8601
  source_urls: string[];

  // --- Module 02 additions (this brief) ---
  summary: string;
  category: string | null;
  event_time: string | null;  // ISO 8601, approximate; null if Gemini couldn't pin a time
  dedupe_key: string;

  // --- reserved for later modules — Module 02 writes these as null/undefined ---
  verification_tier: 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'DISPUTED' | null;
  fit_score: number | null;
}
```

Judgment call, flagged: the brief's own example text lists the existing
fields in camelCase (`discoveredAt`, `sourceUrls`), which conflicts with
the snake_case convention on record from Module 01. I went with
snake_case since that's the actual stated convention for this repo — if
Module 01 really shipped camelCase, swap it back before merging.
