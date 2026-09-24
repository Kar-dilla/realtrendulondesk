export interface RawDiscoveredStory {
  headline: string;
  summary: string;
  category: string | null;
  source_urls: string[];
  event_time: string | null;
}

export function isValidRawStory(x: unknown): x is RawDiscoveredStory {
  if (typeof x !== 'object' || x === null) return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.headline === 'string' &&
    typeof s.summary === 'string' &&
    (s.category === null || typeof s.category === 'string') &&
    Array.isArray(s.source_urls) &&
    s.source_urls.every((u) => typeof u === 'string') &&
    (s.event_time === null || typeof s.event_time === 'string')
  );
}

export type ScanResult =
  | { ok: true; stories: RawDiscoveredStory[] }
  | { ok: false; error_type: string; message: string };

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
}

class DiscoveryError extends Error {
  constructor(public kind: string, message: string) {
    super(message);
  }
}

async function searchTavily(): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new DiscoveryError('missing_api_key', 'TAVILY_API_KEY is not set.');

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: 'breaking news today: politics, conflict, disaster, economy, world affairs',
      topic: 'news',
      time_range: 'day',
      search_depth: 'basic',
      max_results: 15,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new DiscoveryError('missing_api_key', 'Tavily rejected the API key.');
  }
  if (res.status === 429) {
    throw new DiscoveryError('rate_limit', 'Tavily free-tier quota hit — check usage at app.tavily.com.');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DiscoveryError('error', `Tavily returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  const results: TavilyResult[] = Array.isArray(data?.results) ? data.results : [];
  if (results.length === 0) {
    throw new DiscoveryError('no_results', 'Tavily returned no results.');
  }
  return results;
}

async function structureWithGroq(results: TavilyResult[]): Promise<RawDiscoveredStory[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new DiscoveryError('missing_api_key', 'GROQ_API_KEY is not set.');

  const prompt = `You are extracting structured news story data from raw search results. For EACH result below, produce one JSON object with exactly these fields: headline (string, cleaned up), summary (string, 1-2 sentences from the content), category (string like "disaster","politics","economy","technology", etc, or null if unclear), source_urls (array with just that one result's URL), event_time (ISO 8601 string if a date is inferable from the content/published_date, else null).

Do NOT merge or deduplicate — one output object per input result, even if some describe the same event. That happens in a later step.

Return ONLY a JSON array, no prose, no markdown fences, no explanation.

Raw results:
${JSON.stringify(results.map((r) => ({ title: r.title, url: r.url, content: r.content, published_date: r.published_date })), null, 2)}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });

  if (res.status === 401) throw new DiscoveryError('missing_api_key', 'Groq rejected the API key.');
  if (res.status === 429) throw new DiscoveryError('rate_limit', 'Groq free-tier quota hit — check console.groq.com/settings/limits.');
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new DiscoveryError('error', `Groq returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  const cleaned = text.replace(/```json|```/g, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new DiscoveryError('malformed_output', 'Groq returned non-JSON output.');
  }

  if (!Array.isArray(parsed)) {
    throw new DiscoveryError('malformed_output', 'Groq output was not a JSON array.');
  }

  const valid = parsed.filter(isValidRawStory);
  if (valid.length === 0) {
    throw new DiscoveryError('malformed_output', 'No valid story objects in Groq output.');
  }
  return valid;
}

export async function scanTopNews(): Promise<ScanResult> {
  try {
    const tavilyResults = await searchTavily();
    const stories = await structureWithGroq(tavilyResults);
    return { ok: true, stories };
  } catch (err) {
    if (err instanceof DiscoveryError) {
      return { ok: false, error_type: err.kind, message: err.message };
    }
    return { ok: false, error_type: 'unknown', message: err instanceof Error ? err.message : String(err) };
  }
}
