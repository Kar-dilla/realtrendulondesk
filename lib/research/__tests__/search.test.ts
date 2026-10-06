/** @jest-environment node */

import { buildQueriesForStory, searchStory } from '../search';

describe('buildQueriesForStory', () => {
  it('uses the headline plus up to two claims', () => {
    const queries = buildQueriesForStory({
      headline: 'Earthquake hits northern Japan',
      verifiedClaims: [{ claim: 'At least 14 people are dead' }, { claim: 'Dozens injured' }, { claim: 'Third claim, should be excluded' }],
    });
    expect(queries).toEqual(['Earthquake hits northern Japan', 'At least 14 people are dead', 'Dozens injured']);
  });

  it('skips empty claim text', () => {
    const queries = buildQueriesForStory({ headline: 'H', verifiedClaims: [{ claim: '' }, { claim: '  ' }] });
    expect(queries).toEqual(['H']);
  });
});

describe('searchStory', () => {
  const story = { headline: 'H', verifiedClaims: [{ claim: 'C1' }] };
  const originalFetch = global.fetch;
  const originalEnv = process.env.TAVILY_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.TAVILY_API_KEY = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns missing_api_key when TAVILY_API_KEY is unset', async () => {
    delete process.env.TAVILY_API_KEY;
    const result = await searchStory(story);
    expect(result).toEqual({
      ok: false,
      error_type: 'missing_api_key',
      message: expect.stringContaining('TAVILY_API_KEY is not set'),
    });
  });

  it('dedups results by URL across queries', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          { title: 'A', url: 'https://a.com', content: 'a', published_date: '2026-01-01' },
          { title: 'A dup', url: 'https://a.com', content: 'a dup', published_date: '2026-01-01' },
        ],
      }),
    }) as any;

    const result = await searchStory(story);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.results).toHaveLength(1);
      expect(result.results[0].url).toBe('https://a.com');
    }
  });

  it('returns no_results when Tavily returns nothing across all queries', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [] }) }) as any;

    const result = await searchStory(story);
    expect(result).toEqual({ ok: false, error_type: 'no_results', message: expect.any(String) });
  });

  it('returns rate_limit when Tavily returns 429 on every query', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}), text: async () => '' }) as any;

    const result = await searchStory(story);
    expect(result).toEqual({ ok: false, error_type: 'rate_limit', message: expect.any(String) });
  });

  it('returns missing_api_key when Tavily rejects the key (401)', async () => {
    process.env.TAVILY_API_KEY = 'bad-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}), text: async () => '' }) as any;

    const result = await searchStory(story);
    expect(result).toEqual({ ok: false, error_type: 'missing_api_key', message: expect.any(String) });
  });

  it('still returns results from queries that succeeded even if another query failed', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    let call = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ results: [{ title: 'A', url: 'https://a.com', content: 'a', published_date: null }] }),
        });
      }
      return Promise.resolve({ ok: false, status: 500, json: async () => ({}), text: async () => 'server error' });
    }) as any;

    const result = await searchStory(story);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.results).toHaveLength(1);
    }
  });

  it('caps total results at MAX_TOTAL_RESULTS', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    const manyResults = Array.from({ length: 20 }, (_, i) => ({
      title: `Result ${i}`,
      url: `https://example.com/${i}`,
      content: 'x',
      published_date: null,
    }));
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: manyResults }) }) as any;

    const result = await searchStory(story);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.results.length).toBeLessThanOrEqual(15);
    }
  });
});
