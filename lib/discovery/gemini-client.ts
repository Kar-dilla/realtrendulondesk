/**
 * MODULE 02 — Live Discovery via Gemini API (Grounding with Google Search)
 *
 * IMPORTANT — verify before shipping:
 * The model name below is my best current guess, not a verified fact from
 * a live API check (I have no network access to hit Google's endpoint or
 * their pricing/model-list page from where I'm working). Before you rely
 * on this in production, check https://ai.google.dev/gemini-api/docs/pricing
 * and https://ai.google.dev/gemini-api/docs/models for whichever current
 * model has a genuine free tier for grounded search calls, and update
 * GEMINI_MODEL accordingly. Don't ship this constant unverified.
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface RawDiscoveredStory {
  headline: string;
  summary: string;
  category: string | null;
  source_urls: string[];
  event_time: string | null; // ISO 8601 if the model could infer one, else null
}

export type DiscoveryErrorType = 'missing_api_key' | 'rate_limit' | 'timeout' | 'malformed_response' | 'unknown';

export interface DiscoveryResult {
  ok: boolean;
  stories?: RawDiscoveredStory[];
  error_type?: DiscoveryErrorType;
  message?: string;
}

const SCAN_PROMPT = `You have live Google Search grounding enabled. Find significant, genuinely newsworthy events from roughly the last 24 hours — global or major regional stories, not routine/local filler.

Return ONLY a JSON array. No prose, no markdown code fences, no commentary before or after it. Each element must match exactly this shape:

{
  "headline": string,
  "summary": string,           // 1-2 sentences, factual, no editorializing
  "category": string | null,   // e.g. "politics", "conflict", "disaster", "economy", "technology" — null if genuinely unclear
  "source_urls": string[],     // real URLs of the actual articles you found, not invented ones
  "event_time": string | null  // ISO 8601 if you can pin down roughly when it happened, else null
}

Only include stories you found real, current source URLs for. Do not fabricate headlines, summaries, or URLs — if you're not confident a story is real and current, leave it out entirely.`;

export async function scanTopNews(timeoutMs = 25000): Promise<DiscoveryResult> {
  if (!GEMINI_API_KEY) {
    return { ok: false, error_type: 'missing_api_key', message: 'GEMINI_API_KEY is not set.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: SCAN_PROMPT }] }],
        tools: [{ google_search: {} }],
      }),
    });

    clearTimeout(timer);

    if (response.status === 429) {
      const body = await safeReadText(response);
      return {
        ok: false,
        error_type: 'rate_limit',
        message: `Gemini grounding quota/rate limit hit (free-tier request cap). Raw: ${body.slice(0, 300)}`,
      };
    }

    if (!response.ok) {
      const body = await safeReadText(response);
      return {
        ok: false,
        error_type: 'unknown',
        message: `Gemini API returned ${response.status}: ${body.slice(0, 300)}`,
      };
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return {
        ok: false,
        error_type: 'malformed_response',
        message: 'No text content in Gemini response — check candidates[0].finishReason for why (e.g. SAFETY, RECITATION).',
      };
    }

    const parsed = tryParseStoryArray(text);
    if (!parsed) {
      return {
        ok: false,
        error_type: 'malformed_response',
        message: 'Could not parse a JSON story array out of the model response.',
      };
    }

    return { ok: true, stories: parsed };
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      return { ok: false, error_type: 'timeout', message: `Gemini request exceeded ${timeoutMs}ms. Grounded calls run 1.5-3x slower than ungrounded — consider raising this before assuming the API is down.` };
    }
    return { ok: false, error_type: 'unknown', message: err?.message ?? String(err) };
  }
}

function tryParseStoryArray(text: string): RawDiscoveredStory[] | null {
  // Model sometimes wraps output in ```json fences despite instructions — strip defensively.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isValidRawStory);
  } catch {
    return null;
  }
}

export function isValidRawStory(x: any): x is RawDiscoveredStory {
  return (
    x &&
    typeof x.headline === 'string' &&
    typeof x.summary === 'string' &&
    Array.isArray(x.source_urls) &&
    x.source_urls.every((u: unknown) => typeof u === 'string')
  );
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
