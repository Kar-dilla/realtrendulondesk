// lib/research/search.ts
//
// Research Engine role (Stage 1). Searches actual sources and retrieves real
// material — no analysis, no synthesis, no writing. Reuses TAVILY_API_KEY
// and the same honest-failure conventions as lib/discovery/discovery-source.ts
// (a DiscoveryError-style error class, Promise.allSettled across parallel
// queries, dedup by URL) — but builds targeted queries from this one
// specific story rather than Discovery's fixed category queries, which are
// for finding new stories broadly, not researching one deeply.

export interface StoryToSearch {
  headline: string;
  verifiedClaims: { claim: string }[];
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  published_date: string | null;
}

export type SearchStoryResult =
  | { ok: true; results: TavilySearchResult[] }
  | {
      ok: false;
      error_type: 'missing_api_key' | 'rate_limit' | 'no_results' | 'error';
      message: string;
    };

class ResearchSearchError extends Error {
  constructor(public kind: 'missing_api_key' | 'rate_limit' | 'error', message: string) {
    super(message);
  }
}

const RESULTS_PER_QUERY = 6;
const MAX_TOTAL_RESULTS = 15;
const MAX_QUERIES_FROM_CLAIMS = 2;

/**
 * Targeted queries for one specific story: the headline plus one or two
 * queries built from its most salient claims, per the brief — not
 * Discovery's fixed category queries. Salience here just means "the first
 * couple of already-tiered claims for this story," since no separate
 * entity-extraction step was asked for and inventing one would be scope
 * creep beyond what this brief specifies.
 */
export function buildQueriesForStory(story: StoryToSearch): string[] {
  const queries = [story.headline];
  for (const c of story.verifiedClaims.slice(0, MAX_QUERIES_FROM_CLAIMS)) {
    if (c.claim && c.claim.trim().length > 0) queries.push(c.claim);
  }
  return queries;
}

async function runOneQuery(apiKey: string, query: string): Promise<TavilySearchResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      topic: 'news',
      search_depth: 'advanced',
      max_results: RESULTS_PER_QUERY,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new ResearchSearchError('missing_api_key', 'Tavily rejected the API key.');
  }
  if (res.status === 429) {
    throw new ResearchSearchError('rate_limit', 'Tavily free-tier quota hit — check usage at app.tavily.com.');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ResearchSearchError('error', `Tavily returned ${res.status} for query "${query}": ${text}`);
  }

  const data = await res.json();
  const raw = Array.isArray(data?.results) ? data.results : [];
  return raw
    .map(
      (r: any): TavilySearchResult => ({
        title: typeof r.title === 'string' ? r.title : '',
        url: typeof r.url === 'string' ? r.url : '',
        content: typeof r.content === 'string' ? r.content : '',
        published_date: typeof r.published_date === 'string' ? r.published_date : null,
      })
    )
    .filter((r: TavilySearchResult) => r.url.length > 0);
}

export async function searchStory(story: StoryToSearch): Promise<SearchStoryResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error_type: 'missing_api_key',
      message: 'TAVILY_API_KEY is not set — no search backend is configured, so no research was actually performed.',
    };
  }

  const queries = buildQueriesForStory(story);
  const settled = await Promise.allSettled(queries.map((q) => runOneQuery(apiKey, q)));

  const allResults: TavilySearchResult[] = [];
  const errors: ResearchSearchError[] = [];

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      allResults.push(...outcome.value);
    } else if (outcome.reason instanceof ResearchSearchError) {
      errors.push(outcome.reason);
    }
  }

  if (allResults.length === 0 && errors.length > 0) {
    // Prefer the most actionable error if queries failed for different
    // reasons: a missing key or an exhausted quota explains "why nothing
    // came back" better than a generic per-query error does.
    const preferred =
      errors.find((e) => e.kind === 'missing_api_key') ?? errors.find((e) => e.kind === 'rate_limit') ?? errors[0];
    return { ok: false, error_type: preferred.kind, message: preferred.message };
  }

  const seen = new Set<string>();
  const deduped: TavilySearchResult[] = [];
  for (const r of allResults) {
    if (!seen.has(r.url)) {
      seen.add(r.url);
      deduped.push(r);
    }
  }

  if (deduped.length === 0) {
    return {
      ok: false,
      error_type: 'no_results',
      message: 'Tavily returned no results for this story — an honest empty state, not a search failure.',
    };
  }

  return { ok: true, results: deduped.slice(0, MAX_TOTAL_RESULTS) };
}
