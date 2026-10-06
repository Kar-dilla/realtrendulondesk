/** @jest-environment node */

var mockFindUnique: jest.Mock;
var mockUpdate: jest.Mock;
var mockSearchStory: jest.Mock;

jest.mock('@prisma/client', () => {
  mockFindUnique = jest.fn();
  mockUpdate = jest.fn();
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      story: {
        findUnique: (...args: any[]) => mockFindUnique(...args),
        update: (...args: any[]) => mockUpdate(...args),
      },
    })),
  };
});

jest.mock('@/lib/research/search', () => {
  mockSearchStory = jest.fn();
  return { searchStory: (...args: any[]) => mockSearchStory(...args) };
});

import { POST } from '../route';

function makeRequest(body: any) {
  return new Request('http://localhost/api/research/search', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/research/search', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockSearchStory.mockReset();
    mockUpdate.mockResolvedValue({});
  });

  it('rejects when storyId is missing', async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();
    expect(data.error_type).toBe('invalid_request');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('rejects when the story is not the currently selected one', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: false, verifiedClaims: [] });
    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();
    expect(data.error_type).toBe('invalid_request');
    expect(mockSearchStory).not.toHaveBeenCalled();
  });

  it('returns db_read_failed if the story lookup throws', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'));
    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();
    expect(data.error_type).toBe('db_read_failed');
  });

  it('marks status searching before calling the search engine, then searched on success', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: true, verifiedClaims: [] });
    mockSearchStory.mockResolvedValue({ ok: true, results: [{ title: 'T', url: 'https://a.com', content: 'c', published_date: null }] });

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(data.error).toBe(false);
    expect(data.results).toHaveLength(1);
    expect(mockUpdate).toHaveBeenNthCalledWith(1, { where: { id: 's1' }, data: { researchStatus: 'searching', researchError: null } });
    expect(mockUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 's1' },
      data: { searchResults: [{ title: 'T', url: 'https://a.com', content: 'c', published_date: null }], researchStatus: 'searched', researchError: null },
    });
  });

  it('marks status failed and passes through a no_results honest empty state', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: true, verifiedClaims: [] });
    mockSearchStory.mockResolvedValue({ ok: false, error_type: 'no_results', message: 'nothing found' });

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.error).toBe(true);
    expect(data.error_type).toBe('no_results');
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 's1' }, data: { researchStatus: 'failed', researchError: 'nothing found' } });
  });

  it('returns 429 and marks failed on rate_limit', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: true, verifiedClaims: [] });
    mockSearchStory.mockResolvedValue({ ok: false, error_type: 'rate_limit', message: 'quota hit' });

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error_type).toBe('rate_limit');
  });

  it('says explicitly when Tavily is unconfigured', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: true, verifiedClaims: [] });
    mockSearchStory.mockResolvedValue({ ok: false, error_type: 'missing_api_key', message: 'TAVILY_API_KEY is not set — no search backend is configured.' });

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(data.error_type).toBe('missing_api_key');
    expect(data.message).toContain('TAVILY_API_KEY');
  });

  it('returns db_write_failed if saving the results fails', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: true, verifiedClaims: [] });
    mockSearchStory.mockResolvedValue({ ok: true, results: [] });
    mockUpdate.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('write failed'));

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(data.error_type).toBe('db_write_failed');
  });
});
