import { classifyStoryClaims } from '../classify';

const sampleStory = {
  headline: 'Magnitude 6.8 earthquake strikes northern Japan',
  summary:
    'A powerful earthquake hit northern Japan early Tuesday. Police confirmed at least 14 deaths and dozens of injuries. Local media reported several buildings collapsed in Sendai. Videos circulating online appear to show a tsunami warning siren activating, though this has not been confirmed by officials.',
  sourceUrls: ['https://example.com/article1', 'https://example.com/article2'],
};

function mockFetchOnce(body: any, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  }) as any;
}

describe('classifyStoryClaims', () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.GROQ_API_KEY;
  });

  it('parses a well-formed multi-claim Groq response, fences and all', async () => {
    const groqContent =
      '```json\n' +
      JSON.stringify({
        claims: [
          {
            claim: 'A magnitude 6.8 earthquake struck northern Japan early Tuesday.',
            tier: 'CONFIRMED',
            evidence: 'Attributed to police confirmation.',
          },
          { claim: 'At least 14 people died.', tier: 'CONFIRMED', evidence: 'Police confirmed the death toll.' },
          {
            claim: 'Several buildings collapsed in Sendai.',
            tier: 'REPORTED',
            evidence: 'Attributed to local media reporting, not an official source.',
          },
          {
            claim: 'A tsunami warning siren activated.',
            tier: 'UNVERIFIED',
            evidence: 'Only supported by circulating videos, no official confirmation.',
          },
        ],
      }) +
      '\n```';

    mockFetchOnce({ choices: [{ message: { content: groqContent } }] });

    const result = await classifyStoryClaims(sampleStory);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claims).toHaveLength(4);
      expect(result.claims[0].tier).toBe('CONFIRMED');
      expect(result.claims[2].tier).toBe('REPORTED');
      expect(result.claims[3].tier).toBe('UNVERIFIED');
      expect(result.claims.every((c) => typeof c.claim === 'string' && c.claim.length > 0)).toBe(true);
    }
  });

  it('returns ok:true with an empty claims array when the model finds nothing classifiable', async () => {
    mockFetchOnce({ choices: [{ message: { content: '{"claims": []}' } }] });
    const result = await classifyStoryClaims(sampleStory);
    expect(result).toEqual({ ok: true, claims: [] });
  });

  it('treats a missing evidence field as null rather than fabricating text', async () => {
    mockFetchOnce({
      choices: [{ message: { content: JSON.stringify({ claims: [{ claim: 'Something happened.', tier: 'REPORTED' }] }) } }],
    });
    const result = await classifyStoryClaims(sampleStory);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.claims[0].evidence).toBeNull();
  });

  it('returns malformed_response when the model output is not valid JSON', async () => {
    mockFetchOnce({ choices: [{ message: { content: 'Sure, here are the claims: 1. Something happened.' } }] });
    const result = await classifyStoryClaims(sampleStory);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error_type).toBe('malformed_response');
  });

  it('returns malformed_response, not a guessed tier, when a claim has an invalid tier value', async () => {
    mockFetchOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ claims: [{ claim: 'Something happened.', tier: 'PROBABLY_TRUE', evidence: 'vibes' }] }),
          },
        },
      ],
    });
    const result = await classifyStoryClaims(sampleStory);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error_type).toBe('malformed_response');
  });

  it('returns malformed_response when the claims field is missing entirely', async () => {
    mockFetchOnce({ choices: [{ message: { content: JSON.stringify({ notClaims: [] }) } }] });
    const result = await classifyStoryClaims(sampleStory);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error_type).toBe('malformed_response');
  });

  it('returns missing_api_key when GROQ_API_KEY is not set', async () => {
    delete process.env.GROQ_API_KEY;
    const result = await classifyStoryClaims(sampleStory);
    expect(result).toEqual({ ok: false, error_type: 'missing_api_key', message: expect.any(String) });
  });

  it('returns rate_limit on a 429 response', async () => {
    mockFetchOnce({}, 429);
    const result = await classifyStoryClaims(sampleStory);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error_type).toBe('rate_limit');
  });

  it('returns unknown on a non-429 error status', async () => {
    mockFetchOnce({}, 500);
    const result = await classifyStoryClaims(sampleStory);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error_type).toBe('unknown');
  });
});
