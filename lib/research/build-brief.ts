// lib/research/build-brief.ts
//
// Module 06 (Story Research). One Groq call per research run — not a batch
// loop like Discovery (02) or Verification (03/04) — so the closer analog to
// follow is lib/verification/classify.ts, not lib/discovery/discovery-source.ts.
//
// Retry-on-429 discipline (confirmed correct this session, do not regress):
// the retry lives INSIDE this function, wrapping the actual fetch call, not
// in an outer wrapper. A function that catches its own errors and returns
// {ok:false} instead of throwing makes an outer retry wrapper dead code —
// the wrapper never sees the 429. The wait is ~65s because Groq's free-tier
// rate limit resets per minute, not in a few seconds; one retry, then give
// up honestly.

export interface ResearchBrief {
  confirmed: string[];
  developing: string[];
  not_confirmed: string[];
}

export type BuildBriefResult =
  | { ok: true; brief: ResearchBrief }
  | {
      ok: false;
      error_type: 'rate_limit' | 'missing_api_key' | 'timeout' | 'malformed_output' | 'unknown';
      message: string;
    };

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const TIMEOUT_MS = 30000;

export interface BriefableClaim {
  claim: string;
  tier: string;
  evidence: string | null;
}

function buildPrompt(claims: BriefableClaim[], topicNoteText: string | null): string {
  const claimsBlock =
    claims.length > 0
      ? claims
          .map((c, i) => `${i + 1}. [${c.tier}] ${c.claim}${c.evidence ? ` (evidence: ${c.evidence})` : ''}`)
          .join('\n')
      : '(no verified claims provided)';

  const topicBlock = topicNoteText
    ? `\n\nBackground note on this recurring topic, for context only — do not treat this as a new claim to verify or re-tier:\n${topicNoteText}`
    : '';

  return `You are building a story research brief for a news pipeline. You are given a list of already-tiered claims (CONFIRMED / REPORTED / UNVERIFIED / DISPUTED) for one story. Organize them into exactly three buckets:

confirmed — claims that are established, solid fact for this story
developing — claims that are still emerging, partial, or actively being reported/updated
not_confirmed — claims that remain unverified, disputed, or explicitly not yet confirmed

Rules:
- Ground every bullet ONLY in the claims provided below (and the background note, if present, for context). Do not invent, infer, or add any claim, fact, name, number, or detail that isn't already present in the input.
- Each bullet should be a short, self-contained factual sentence.
- A given claim should inform at most one bucket — don't repeat the same claim across multiple buckets.
- If a bucket has nothing that fits, return an empty array for it. An empty array is a valid, honest answer — do not force an entry just to fill a bucket.

Verified claims for this story:
${claimsBlock}${topicBlock}

Respond with strict JSON only. No prose, no markdown code fences, no explanation before or after. Respond in exactly this shape:
{"confirmed": ["string", ...], "developing": ["string", ...], "not_confirmed": ["string", ...]}`;
}

function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((item) => typeof item === 'string');
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

export async function buildResearchBrief(
  claims: BriefableClaim[],
  topicNoteText: string | null
): Promise<BuildBriefResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, error_type: 'missing_api_key', message: 'GROQ_API_KEY is not set.' };
  }

  const prompt = buildPrompt(claims, topicNoteText);

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

  // Whole-response rejection on any invalid section — same discipline as
  // lib/verification/classify.ts: never silently drop or partially trust a
  // broken shape. If confirmed/developing/not_confirmed aren't all present
  // as string arrays, reject the whole brief rather than saving two good
  // buckets and dropping the third.
  if (
    !parsed ||
    !isStringArray(parsed.confirmed) ||
    !isStringArray(parsed.developing) ||
    !isStringArray(parsed.not_confirmed)
  ) {
    return {
      ok: false,
      error_type: 'malformed_output',
      message: 'Model output was missing one or more of confirmed/developing/not_confirmed as string arrays.',
    };
  }

  return {
    ok: true,
    brief: {
      confirmed: parsed.confirmed,
      developing: parsed.developing,
      not_confirmed: parsed.not_confirmed,
    },
  };
}
