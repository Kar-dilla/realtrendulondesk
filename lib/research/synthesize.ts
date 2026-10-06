// lib/research/synthesize.ts
//
// Research Analyst role (Stage 2). Takes what the Research Engine (Stage 1)
// already found — this file never calls Tavily itself — plus the story's
// existing VerifiedClaim rows, compares and organizes them into the full
// 9-part ResearchBrief. One Groq call, same retry-on-429 discipline as
// lib/verification/classify.ts and v1's build-brief.ts (65s wait, one
// retry, then honest failure), and the same whole-response rejection on a
// malformed shape.
//
// The one check that's specific to this module: every source_url the model
// returns must be one of the URLs actually retrieved in Stage 1. A URL that
// isn't in that set is a fabricated citation — mechanically checkable, so
// it's checked, and it fails the whole brief the same way any other
// malformed shape does (never save five good sections and silently drop a
// fabricated sixth).

export interface SourcedItem {
  text: string;
  source_url: string | null;
  source_name: string | null;
  published_date: string | null;
}

export interface TimelineEntry {
  date: string | null;
  event: string;
  source_url: string | null;
}

export interface DisputedClaim {
  claim: string;
  claimed_by: string | null;
  disputed_by: string | null;
  evidence: string;
  unresolved: string;
}

export interface ResearchBrief {
  overview: string;
  confirmed: SourcedItem[];
  developing: SourcedItem[];
  not_confirmed: SourcedItem[];
  timeline: TimelineEntry[];
  disputed_claims: DisputedClaim[];
  background: string;
  why_it_matters: string;
  open_questions: string[];
}

export type SynthesizeResult =
  | { ok: true; brief: ResearchBrief }
  | {
      ok: false;
      error_type: 'rate_limit' | 'missing_api_key' | 'timeout' | 'malformed_output' | 'unknown';
      message: string;
    };

export interface SynthesizableClaim {
  claim: string;
  tier: string;
  evidence: string | null;
}

export interface SynthesizableSearchResult {
  title: string;
  url: string;
  content: string;
  published_date: string | null;
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const TIMEOUT_MS = 30000;
const MAX_CONTENT_CHARS = 800;

function buildPrompt(
  story: { headline: string; summary: string },
  claims: SynthesizableClaim[],
  searchResults: SynthesizableSearchResult[],
  topicNoteText: string | null,
  instructions: string | null
): string {
  const claimsBlock =
    claims.length > 0
      ? claims
          .map((c, i) => `${i + 1}. [${c.tier}] ${c.claim}${c.evidence ? ` (evidence: ${c.evidence})` : ''}`)
          .join('\n')
      : '(no verified claims recorded for this story)';

  const sourcesBlock = searchResults
    .map(
      (r, i) =>
        `${i + 1}. URL: ${r.url}\n   Title: ${r.title}\n   Published: ${r.published_date ?? 'unknown'}\n   Content: ${r.content.slice(0, MAX_CONTENT_CHARS)}`
    )
    .join('\n\n');

  const topicBlock = topicNoteText
    ? `\n\nBackground note on this recurring topic (context only, do not treat as a new claim to verify):\n${topicNoteText}`
    : '';

  const instructionsBlock = instructions
    ? `\n\nThe owner asked for this specific focus — weight your brief toward it where the retrieved sources actually support it, but do not invent material to satisfy it: ${instructions}`
    : '';

  return `You are a research analyst for a news pipeline. You are given already-tiered verified claims for one story (CONFIRMED / REPORTED / UNVERIFIED / DISPUTED) and a set of real, already-retrieved sources. Build a full research brief by comparing and organizing this material — do not search for anything new, and do not invent any fact, name, number, date, or URL that isn't already present in what's given below.

Retrieved sources for this story (the ONLY sources you may cite):
${sourcesBlock}

Verified claims already established for this story:
${claimsBlock}${topicBlock}${instructionsBlock}

Produce a JSON object with exactly these nine fields:

- "overview": a short paragraph covering what happened, where, when, who's involved, the latest development, and why it's newsworthy.
- "confirmed": array of objects {"text": string, "source_url": string|null, "source_name": string|null, "published_date": string|null} — facts solidly established by the retrieved sources or the CONFIRMED verified claims.
- "developing": array of the same object shape — facts still emerging, partial, or actively being updated.
- "not_confirmed": array of the same object shape — claims that remain unverified or not adequately confirmed by what's available.
- "timeline": array of objects {"date": string|null, "event": string, "source_url": string|null} — key events in chronological order. Use null for date if no date can be honestly established from the sources — never invent one.
- "disputed_claims": array of objects {"claim": string, "claimed_by": string|null, "disputed_by": string|null, "evidence": string, "unresolved": string} — points where sources conflict.
- "background": a short paragraph of context needed to understand the story (prior events, root causes).
- "why_it_matters": a short paragraph on the story's broader significance.
- "open_questions": array of strings — specific things that remain unknown or unresolved.

Critical rules:
- Every "source_url" value (in confirmed/developing/not_confirmed/timeline items) MUST be copied exactly from the "Retrieved sources" list above. If you cannot attach one of those exact URLs to a fact, set source_url to null — do not invent, guess, paraphrase, or reconstruct a URL.
- If a section genuinely has nothing to report, return an empty array (or an honest short string for overview/background/why_it_matters) rather than inventing content to fill it.
- Do not manufacture drama or certainty language beyond what the sources support.

Respond with strict JSON only. No prose, no markdown code fences, no explanation before or after.`;
}

function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
}

function isNullableString(x: unknown): x is string | null {
  return x === null || typeof x === 'string';
}

function isSourcedItem(x: unknown): x is SourcedItem {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.text === 'string' &&
    s.text.trim().length > 0 &&
    isNullableString(s.source_url) &&
    isNullableString(s.source_name) &&
    isNullableString(s.published_date)
  );
}

function isTimelineEntry(x: unknown): x is TimelineEntry {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return isNullableString(s.date) && typeof s.event === 'string' && s.event.trim().length > 0 && isNullableString(s.source_url);
}

function isDisputedClaim(x: unknown): x is DisputedClaim {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.claim === 'string' &&
    s.claim.trim().length > 0 &&
    isNullableString(s.claimed_by) &&
    isNullableString(s.disputed_by) &&
    typeof s.evidence === 'string' &&
    typeof s.unresolved === 'string'
  );
}

/**
 * Validates the full shape AND, per the brief's specific fabricated-citation
 * check, that every non-null source_url in the brief is one of the URLs
 * actually retrieved in Stage 1. Returns null on any failure — the whole
 * brief is rejected, never partially trusted.
 */
function validateBrief(parsed: any, retrievedUrls: Set<string>): ResearchBrief | null {
  if (!parsed || typeof parsed !== 'object') return null;

  if (typeof parsed.overview !== 'string') return null;
  if (typeof parsed.background !== 'string') return null;
  if (typeof parsed.why_it_matters !== 'string') return null;
  if (!Array.isArray(parsed.open_questions) || !parsed.open_questions.every((q: unknown) => typeof q === 'string')) {
    return null;
  }

  if (!Array.isArray(parsed.confirmed) || !parsed.confirmed.every(isSourcedItem)) return null;
  if (!Array.isArray(parsed.developing) || !parsed.developing.every(isSourcedItem)) return null;
  if (!Array.isArray(parsed.not_confirmed) || !parsed.not_confirmed.every(isSourcedItem)) return null;
  if (!Array.isArray(parsed.timeline) || !parsed.timeline.every(isTimelineEntry)) return null;
  if (!Array.isArray(parsed.disputed_claims) || !parsed.disputed_claims.every(isDisputedClaim)) return null;

  const allSourceUrls: (string | null)[] = [
    ...parsed.confirmed.map((i: SourcedItem) => i.source_url),
    ...parsed.developing.map((i: SourcedItem) => i.source_url),
    ...parsed.not_confirmed.map((i: SourcedItem) => i.source_url),
    ...parsed.timeline.map((t: TimelineEntry) => t.source_url),
  ];

  for (const url of allSourceUrls) {
    if (url !== null && !retrievedUrls.has(url)) {
      // A source_url that isn't among the URLs actually retrieved in Stage 1
      // is a fabricated citation — reject the whole brief.
      return null;
    }
  }

  return {
    overview: parsed.overview,
    confirmed: parsed.confirmed,
    developing: parsed.developing,
    not_confirmed: parsed.not_confirmed,
    timeline: parsed.timeline,
    disputed_claims: parsed.disputed_claims,
    background: parsed.background,
    why_it_matters: parsed.why_it_matters,
    open_questions: parsed.open_questions,
  };
}

async function callGroq(apiKey: string, prompt: string, signal?: AbortSignal): Promise<Response> {
  return fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  });
}

export async function synthesizeResearchBrief(
  story: { headline: string; summary: string },
  claims: SynthesizableClaim[],
  searchResults: SynthesizableSearchResult[],
  topicNoteText: string | null,
  instructions: string | null
): Promise<SynthesizeResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, error_type: 'missing_api_key', message: 'GROQ_API_KEY is not set.' };
  }

  const prompt = buildPrompt(story, claims, searchResults, topicNoteText, instructions);
  const retrievedUrls = new Set(searchResults.map((r) => r.url));

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      response = await callGroq(apiKey, prompt, controller.signal);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, error_type: 'timeout', message: 'Groq request timed out.' };
    }
    return { ok: false, error_type: 'unknown', message: err?.message ?? String(err) };
  }

  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 65000));
    try {
      response = await callGroq(apiKey, prompt);
    } catch (err: any) {
      return { ok: false, error_type: 'unknown', message: err?.message ?? String(err) };
    }
    if (response.status === 429) {
      return { ok: false, error_type: 'rate_limit', message: 'Groq rate limit hit twice; giving up.' };
    }
  }

  if (!response.ok) {
    return { ok: false, error_type: 'unknown', message: `Groq request failed with status ${response.status}.` };
  }

  let raw: string;
  try {
    const data = await response.json();
    raw = data?.choices?.[0]?.message?.content ?? '';
  } catch {
    return { ok: false, error_type: 'malformed_output', message: 'Could not parse Groq response body as JSON.' };
  }

  const stripped = stripFences(raw);

  let parsed: any;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { ok: false, error_type: 'malformed_output', message: 'Model output was not valid JSON.' };
  }

  const brief = validateBrief(parsed, retrievedUrls);
  if (!brief) {
    return {
      ok: false,
      error_type: 'malformed_output',
      message:
        'Model output did not match the expected research-brief shape, or cited a source_url that was not among the URLs actually retrieved in Stage 1.',
    };
  }

  return { ok: true, brief };
}
