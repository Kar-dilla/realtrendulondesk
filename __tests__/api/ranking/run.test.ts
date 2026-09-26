/** @jest-environment node */
// __tests__/api/ranking/run.test.ts
//
// Per Constitution 6d: node environment required since this imports and
// invokes route.ts handlers directly.

// Jest hoists jest.mock() calls above these, so mock fns must be declared
// with `var`, not `const`/`let` — see Constitution 6d.
var mockFindMany: jest.Mock;
var mockCount: jest.Mock;
var mockUpdate: jest.Mock;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    story: {
      // Closures, not direct references — a direct reference would capture
      // `undefined` due to hoisting order (Constitution 6d).
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  })),
}));

import { GET, POST } from '@/app/api/ranking/run/route';

function mockGroqResponse(content: string) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}

beforeEach(() => {
  mockFindMany = jest.fn();
  mockCount = jest.fn();
  mockUpdate = jest.fn();
  global.fetch = jest.fn() as any;
  process.env.GROQ_API_KEY = 'test-key';
});

const disasterStory = {
  id: 'story-1',
  headline: 'Magnitude 7.2 earthquake strikes northern Japan, at least 14 dead',
  summary: 'A powerful earthquake hit northern Japan early Tuesday, triggering building collapses.',
  verificationTier: 'CONFIRMED' as const,
};

const listicleStory = {
  id: 'story-2',
  headline: 'Best Airlines of 2026, Ranked',
  summary: 'A roundup of the top-rated airlines this year based on reader surveys.',
  verificationTier: null,
};

describe('GET /api/ranking/run', () => {
  it('returns the count of stories with fitScore null', async () => {
    mockCount.mockResolvedValue(7);
    const res = await GET();
    const body = await res.json();
    expect(mockCount).toHaveBeenCalledWith({ where: { fitScore: null } });
    expect(body).toEqual({ error: false, pendingCount: 7 });
  });

  it('reports db_read_failed if the count query throws', async () => {
    mockCount.mockRejectedValue(new Error('connection refused'));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error_type).toBe('db_read_failed');
  });
});

describe('POST /api/ranking/run', () => {
  it('only processes stories where fitScore IS NULL', async () => {
    mockFindMany.mockResolvedValue([disasterStory]);
    (global.fetch as jest.Mock).mockResolvedValue(
      mockGroqResponse(
        JSON.stringify({
          editorialReason: 'major_conflict_or_disaster',
          fitScore: 92,
          fitRationale: 'Major disaster with confirmed casualties and ongoing rescue operations.',
        })
      )
    );
    mockUpdate.mockResolvedValue({});

    await POST();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { fitScore: null } })
    );
  });

  it('differentiates a genuinely high-merit story from a low-merit one', async () => {
    mockFindMany.mockResolvedValue([disasterStory, listicleStory]);
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        mockGroqResponse(
          JSON.stringify({
            editorialReason: 'major_conflict_or_disaster',
            fitScore: 92,
            fitRationale: 'Major disaster with confirmed casualties and ongoing rescue operations.',
          })
        )
      )
      .mockResolvedValueOnce(
        mockGroqResponse(
          JSON.stringify({
            editorialReason: 'none',
            fitScore: 8,
            fitRationale: 'Promotional ranking content with no editorial reason under the Standard.',
          })
        )
      );
    mockUpdate.mockResolvedValue({});

    const res = await POST();
    const body = await res.json();

    expect(mockUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'story-1' },
      data: {
        fitScore: 92,
        editorialReason: 'major_conflict_or_disaster',
        fitRationale: 'Major disaster with confirmed casualties and ongoing rescue operations.',
      },
    });
    expect(mockUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'story-2' },
      data: {
        fitScore: 8,
        editorialReason: null,
        fitRationale: 'Promotional ranking content with no editorial reason under the Standard.',
      },
    });
    expect(body.processed).toBe(2);
    expect(body.withReason).toBe(1);
    expect(body.noReason).toBe(1);
    expect(body.results).toHaveLength(2);
    expect(body.results[1].fitScore).toBe(8);
    expect(body.results[1].editorialReason).toBeNull();
  });

  it('leaves a story with no clear editorial reason scored low with editorialReason null, not forced into a category', async () => {
    mockFindMany.mockResolvedValue([listicleStory]);
    (global.fetch as jest.Mock).mockResolvedValue(
      mockGroqResponse(
        JSON.stringify({ editorialReason: 'none', fitScore: 5, fitRationale: 'No editorial reason applies.' })
      )
    );
    mockUpdate.mockResolvedValue({});

    await POST();

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'story-2' },
      data: { fitScore: 5, editorialReason: null, fitRationale: 'No editorial reason applies.' },
    });
  });

  it('leaves fields null on malformed model output rather than fabricating values', async () => {
    mockFindMany.mockResolvedValue([disasterStory]);
    (global.fetch as jest.Mock).mockResolvedValue(mockGroqResponse('not valid json at all'));

    const res = await POST();
    const body = await res.json();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(body.processed).toBe(0);
    expect(body.leftNull).toBe(1);
    expect(body.results[0]).toEqual(
      expect.objectContaining({ id: 'story-1', error: expect.stringContaining('Malformed') })
    );
  });

  it('leaves fields null when the model omits a required field despite instructions', async () => {
    mockFindMany.mockResolvedValue([listicleStory]);
    // Missing fitRationale entirely - malformed
    (global.fetch as jest.Mock).mockResolvedValue(
      mockGroqResponse(JSON.stringify({ editorialReason: 'useful_explanation', fitScore: 70 }))
    );

    await POST();

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('records a result entry with the error when the Groq call itself throws', async () => {
    mockFindMany.mockResolvedValue([disasterStory]);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Groq API timeout'));

    const res = await POST();
    const body = await res.json();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(body.results[0].error).toContain('Groq call failed');
  });
});
