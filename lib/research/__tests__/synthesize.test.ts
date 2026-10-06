/** @jest-environment node */

import { synthesizeResearchBrief } from '../synthesize';

describe('synthesizeResearchBrief', () => {
  const story = { headline: 'Earthquake hits northern Japan', summary: 'A strong quake struck early Tuesday.' };
  const claims = [{ claim: 'At least 14 people are dead', tier: 'CONFIRMED', evidence: 'Police statement.' }];
  const searchResults = [
    { title: 'NHK report', url: 'https://nhk.example/1', content: 'Details of the quake.', published_date: '2026-09-01' },
    { title: 'Reuters report', url: 'https://reuters.example/2', content: 'More details.', published_date: '2026-09-01' },
  ];

  function validBriefJson(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      overview: 'A strong earthquake hit northern Japan.',
      confirmed: [{ text: 'At least 14 dead', source_url: 'https://nhk.example/1', source_name: 'NHK', published_date: '2026-09-01' }],
      developing: [],
      not_confirmed: [],
      timeline: [{ date: '2026-09-01', event: 'Quake struck', source_url: 'https://reuters.example/2' }],
      disputed_claims: [],
      background: 'The region has a history of seismic activity.',
      why_it_matters: 'Significant human impact.',
      open_questions: ['Full damage extent unknown'],
      ...overrides,
    });
  }

  const originalFetch = global.fetch;
  const originalEnv = process.env.GROQ_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GROQ_API_KEY = originalEnv;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('returns missing_api_key when GROQ_API_KEY is unset', async () => {
    delete process.env.GROQ_API_KEY;
    const result = await synthesizeResearchBrief(story, claims, searchResults, null, null);
    expect(result).toEqual({ ok: false, error_type: 'missing_api_key', message: expect.any(String) });
  });

  it('returns a valid full brief on success', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: validBriefJson() } }] }),
    }) as any;

    const result = await synthesizeResearchBrief(story, claims, searchResults, null, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.brief.overview).toContain('earthquake');
      expect(result.brief.confirmed[0].source_url).toBe('https://nhk.example/1');
      expect(result.brief.timeline[0].date).toBe('2026-09-01');
    }
  });

  it('rejects the whole brief when a source_url is not among the retrieved URLs (fabricated citation)', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: validBriefJson({
                confirmed: [
                  { text: 'At least 14 dead', source_url: 'https://not-a-real-retrieved-url.example/x', source_name: null, published_date: null },
                ],
              }),
            },
          },
        ],
      }),
    }) as any;

    const result = await synthesizeResearchBrief(story, claims, searchResults, null, null);
    expect(result).toEqual({ ok: false, error_type: 'malformed_output', message: expect.any(String) });
  });

  it('accepts a null source_url as an honest "could not verify" answer', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: validBriefJson({
                not_confirmed: [{ text: 'Unverified rumor', source_url: null, source_name: null, published_date: null }],
              }),
            },
          },
        ],
      }),
    }) as any;

    const result = await synthesizeResearchBrief(story, claims, searchResults, null, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.brief.not_confirmed[0].source_url).toBeNull();
    }
  });

  it('rejects the whole brief when any one of the nine fields is missing or malformed', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    const brokenJson = JSON.stringify({
      overview: 'ok',
      confirmed: [],
      developing: [],
      not_confirmed: [],
      timeline: [],
      disputed_claims: 'this should be an array, not a string',
      background: 'ok',
      why_it_matters: 'ok',
      open_questions: [],
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: brokenJson } }] }),
    }) as any;

    const result = await synthesizeResearchBrief(story, claims, searchResults, null, null);
    expect(result).toEqual({ ok: false, error_type: 'malformed_output', message: expect.any(String) });
  });

  it('includes owner instructions and topic note text in the prompt when provided', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: validBriefJson() } }] }),
    });
    global.fetch = fetchMock as any;

    await synthesizeResearchBrief(story, claims, searchResults, 'Ongoing seismic activity in this region since 2024.', 'Focus on the economic angle.');

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const prompt = sentBody.messages[0].content;
    expect(prompt).toContain('Focus on the economic angle.');
    expect(prompt).toContain('Ongoing seismic activity in this region since 2024.');
  });

  it('retries once after a 429 and succeeds on the second attempt', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    jest.useFakeTimers();

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: validBriefJson() } }] }) });
    global.fetch = fetchMock as any;

    const resultPromise = synthesizeResearchBrief(story, claims, searchResults, null, null);
    await jest.advanceTimersByTimeAsync(65000);
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it('gives up honestly after a second 429', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    jest.useFakeTimers();

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    global.fetch = fetchMock as any;

    const resultPromise = synthesizeResearchBrief(story, claims, searchResults, null, null);
    await jest.advanceTimersByTimeAsync(65000);
    const result = await resultPromise;

    expect(result).toEqual({ ok: false, error_type: 'rate_limit', message: expect.any(String) });
  });

  it('returns malformed_output when the response is not valid JSON', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'not json at all' } }] }),
    }) as any;

    const result = await synthesizeResearchBrief(story, claims, searchResults, null, null);
    expect(result).toEqual({ ok: false, error_type: 'malformed_output', message: expect.any(String) });
  });
});
