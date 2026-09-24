import type { Story } from '@prisma/client';

export type Tier = 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'DISPUTED';

export const VALID_TIERS: Tier[] = ['CONFIRMED', 'REPORTED', 'UNVERIFIED', 'DISPUTED'];

export interface ClassifiedClaim {
  claim: string;
  tier: Tier;
  evidence: string | null;
}

export type ClassifyResult =
  | { ok: true; claims: ClassifiedClaim[] }
  | {
      ok: false;
      error_type: 'rate_limit' | 'missing_api_key' | 'timeout' | 'malformed_response' | 'unknown';
      message: string;
    };

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const TIMEOUT_MS = 30000;

type ClassifiableStory = Pick<Story, 'headline' | 'summary' | 'sourceUrls'>;

function buildPrompt(story: ClassifiableStory): string {
  return `You are a fact-verification classifier for a news pipeline. Given a news story, break its content down into individual, distinct factual claims and classify each one into exactly one of four tiers:

CONFIRMED — stated as established fact by the source, attributed to an authority (police, officials, named eyewitnesses with direct knowledge)
REPORTED — attributed to media reporting without independent confirmation ("local media reported...")
UNVERIFIED — circulating claims not yet confirmed by any authority (viral videos, social posts, rumor)
DISPUTED — conflicting claims from different sources on the same fact

Story headline: ${story.headline}
Story summary: ${story.summary}
Source URLs: ${story.sourceUrls.length > 0 ? story.sourceUrls.join(', ') : 'none provided'}

Rules:
- Only extract claims that are actually present in the story text. Do not invent claims.
- If the content is too thin to extract any real factual claims (e.g. a headline-only listicle with no substantive detail), return an empty claims array. An empty array is a valid, honest answer — do not force a claim just to have one.
- Each claim needs a short evidence note explaining what in the story supports that tier assignment.

Respond with strict JSON only. No prose, no markdown code fences, no explanation before or after. Respond in exactly this shape:
{"claims": [{"claim": "string", "tier": "CONFIRMED|REPORTED|UNVERIFIED|DISPUTED", "evidence": "string"}]}`;
}

function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
}

export async function classifyStoryClaims(story: ClassifiableStory): Promise<ClassifyResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, error_type: 'missing_api_key', message: 'GROQ_API_KEY is not set.' };
  }

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      response = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: buildPrompt(story) }],
        }),
        signal: controller.signal,
      });
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
    return { ok: false, error_type: 'rate_limit', message: 'Groq rate limit hit.' };
  }
  if (!response.ok) {
    return { ok: false, error_type: 'unknown', message: `Groq request failed with status ${response.status}.` };
  }

  let raw: string;
  try {
    const data = await response.json();
    raw = data?.choices?.[0]?.message?.content ?? '';
  } catch {
    return { ok: false, error_type: 'malformed_response', message: 'Could not parse Groq response body as JSON.' };
  }

  const stripped = stripFences(raw);

  let parsed: any;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return { ok: false, error_type: 'malformed_response', message: 'Model output was not valid JSON.' };
  }

  if (!parsed || !Array.isArray(parsed.claims)) {
    return { ok: false, error_type: 'malformed_response', message: 'Model output was missing a claims array.' };
  }

  // Whole-story rejection on any single invalid claim: partially trusting a
  // broken response risks silently accepting a fabricated or mis-shaped tier,
  // which the Constitution's "never fabricate a tier" rule forbids.
  const claims: ClassifiedClaim[] = [];
  for (const item of parsed.claims) {
    const hasValidClaim = item && typeof item.claim === 'string' && item.claim.trim().length > 0;
    const hasValidTier = item && typeof item.tier === 'string' && VALID_TIERS.includes(item.tier as Tier);

    if (!hasValidClaim || !hasValidTier) {
      return {
        ok: false,
        error_type: 'malformed_response',
        message: 'Model output contained a claim with a missing or invalid tier.',
      };
    }

    claims.push({
      claim: item.claim,
      tier: item.tier as Tier,
      evidence: typeof item.evidence === 'string' && item.evidence.trim().length > 0 ? item.evidence : null,
    });
  }

  return { ok: true, claims };
}
