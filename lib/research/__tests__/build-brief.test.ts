/** @jest-environment node */

import { buildResearchBrief } from '../build-brief';

describe('buildResearchBrief', () => {
  const claims = [{ claim: 'Three people were arrested.', tier: 'CONFIRMED', evidence: 'Police statement.' }];

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
    const result = await buildResearchBrief(claims, null);
    expect(result).toEqual({ ok: false, error_type: 'missing_api_key', message: expect.any(String) });
  });

  it('returns a parsed brief on success', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                confirmed: ['Three people were arrested.'],
                developing: [],
                not_confirmed: [],
              }),
            },
          },
        ],
      }),
    }) as any;

    const result = await buildResearchBrief(claims, null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.brief.confirmed).toEqual(['Three people were arrested.']);
      expect(result.brief.developing).toEqual([]);
      expect(result.brief.not_confirmed).toEqual([]);
    }
  });

  it('includes topic note text in the prompt when provided', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"confirmed":[],"developing":[],"not_confirmed":[]}' } }],
      }),
    });
    global.fetch = fetchMock as any;

    await buildResearchBrief(claims, 'Ongoing border dispute since March.');

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.messages[0].content).toContain('Ongoing border dispute since March.');
  });

  it('retries once after a 429 and succeeds on the second attempt', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    jest.useFakeTimers();

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"confirmed":[],"developing":[],"not_confirmed":[]}' } }],
        }),
      });
    global.fetch = fetchMock as any;

    const resultPromise = buildResearchBrief(claims, null);
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

    const resultPromise = buildResearchBrief(claims, null);
    await jest.advanceTimersByTimeAsync(65000);
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: false, error_type: 'rate_limit', message: expect.any(String) });
  });

  it('returns malformed_output when the response is not valid JSON', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'not json at all' } }] }),
    }) as any;

    const result = await buildResearchBrief(claims, null);
    expect(result).toEqual({ ok: false, error_type: 'malformed_output', message: expect.any(String) });
  });

  it('returns malformed_output when a bucket is missing or not a string array', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ confirmed: ['ok'], developing: 'oops' }) } }],
      }),
    }) as any;

    const result = await buildResearchBrief(claims, null);
    expect(result).toEqual({ ok: false, error_type: 'malformed_output', message: expect.any(String) });
  });

  it('does not invent claims: an empty input still produces a valid (possibly empty) brief', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"confirmed":[],"developing":[],"not_confirmed":[]}' } }],
      }),
    }) as any;

    const result = await buildResearchBrief([], null);
    expect(result).toEqual({
      ok: true,
      brief: { confirmed: [], developing: [], not_confirmed: [] },
    });
  });
});
