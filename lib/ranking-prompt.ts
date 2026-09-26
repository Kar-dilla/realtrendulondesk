// lib/ranking-prompt.ts
//
// Builds the Groq prompt for Module 04 (Ranking/Fit) and defines the
// editorial reason taxonomy from the Trendulon Constitution, Standard rule #6.
//
// ASSUMPTION: I don't have Module 02/03's actual prompt-building files to
// mirror their exact conventions (system prompt structure, JSON-mode flags,
// etc). This follows the brief's described shape only.

export const EDITORIAL_REASONS = [
  'major_global_consequence',
  'significant_human_impact',
  'rapidly_developing_event',
  'underreported_event',
  'important_policy_change',
  'major_conflict_or_disaster',
  'useful_explanation',
  'likely_to_be_misunderstood',
] as const;

export type EditorialReason = (typeof EDITORIAL_REASONS)[number];

export interface StoryForRanking {
  id: string;
  headline: string;
  summary: string;
  verificationTier: 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'DISPUTED' | null;
}

export interface RankingModelOutput {
  editorialReason: EditorialReason | 'none';
  fitScore: number; // 0-100
  fitRationale: string; // one sentence
}

/**
 * Builds the prompt sent to Groq for a single story.
 *
 * Deliberately instructs the model NOT to force a category when none
 * applies — this is the entire point of Module 04 per the brief. A
 * college-rankings listicle should come back with `editorialReason: "none"`
 * and a low score, not a fabricated justification.
 */
export function buildRankingPrompt(story: StoryForRanking): string {
  return `You are the Ranking/Fit evaluator for Trendulon, a newsroom system with a strict editorial Standard.

Evaluate the following story against Trendulon's Standard rule #6: every story needs an identifiable editorial reason to exist, not just trending status. The valid reason categories are:

1. major_global_consequence — major global consequence
2. significant_human_impact — significant human impact
3. rapidly_developing_event — rapidly developing event
4. underreported_event — underreported event
5. important_policy_change — important policy or regulatory change
6. major_conflict_or_disaster — major conflict or disaster
7. useful_explanation — useful explanation of something complex
8. likely_to_be_misunderstood — something the audience is likely to misunderstand

Story:
Headline: ${story.headline}
Summary: ${story.summary}
Verification tier: ${story.verificationTier ?? 'UNKNOWN'}

Rules:
- If NO category genuinely applies, return "none" for editorialReason. Do not invent a justification. Generic trending content, listicles, rankings, and PR fluff should usually get "none" and a low score.
- If the story is UNVERIFIED or DISPUTED but would otherwise be high-impact, you may still assign a category and a meaningfully high score — but fitRationale must say so honestly (e.g. "significant potential impact, but claims remain unverified").
- fitScore is 0-100 reflecting overall editorial worth under the Standard, not popularity or virality.
- fitRationale is exactly one plain-language sentence explaining the score.

Respond with ONLY a JSON object, no markdown fences, no preamble:
{"editorialReason": "<one of the 8 keys above, or \\"none\\">", "fitScore": <integer 0-100>, "fitRationale": "<one sentence>"}`;
}

/**
 * Parses and validates the model's raw text response. Returns null on any
 * malformation — callers must leave fitScore/editorialReason/fitRationale
 * null on the Story record rather than fabricate a value, per the
 * Constitution's honesty rule (section 7) and the brief's explicit
 * malformed-output test requirement.
 */
export function parseRankingOutput(raw: string): RankingModelOutput | null {
  let parsed: unknown;
  try {
    // Model is instructed not to use fences, but strip them defensively —
    // same defensive pattern used elsewhere in this codebase per the
    // Constitution's artifact-API error handling convention.
    const cleaned = raw.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const reason = obj.editorialReason;
  const validReason =
    reason === 'none' || EDITORIAL_REASONS.includes(reason as EditorialReason);
  if (!validReason) return null;

  const score = obj.fitScore;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
    return null;
  }

  const rationale = obj.fitRationale;
  if (typeof rationale !== 'string' || rationale.trim().length === 0) return null;

  return {
    editorialReason: reason as EditorialReason | 'none',
    fitScore: Math.round(score),
    fitRationale: rationale.trim(),
  };
}

/**
 * Sorts stories by fitScore descending (highest editorial merit first) —
 * the actual point of the /ranking page per the brief. Unscored stories
 * (fitScore null) sort last. Extracted as a pure function so it's testable
 * without rendering the page component.
 */
export function sortByFitScoreDesc<T extends { fitScore: number | null }>(stories: T[]): T[] {
  return [...stories].sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1));
}
