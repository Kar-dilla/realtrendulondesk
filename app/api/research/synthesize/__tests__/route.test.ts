/** @jest-environment node */

var mockFindUnique: jest.Mock;
var mockUpdate: jest.Mock;
var mockTopicNoteFindUnique: jest.Mock;
var mockSynthesizeResearchBrief: jest.Mock;

jest.mock('@prisma/client', () => {
  mockFindUnique = jest.fn();
  mockUpdate = jest.fn();
  mockTopicNoteFindUnique = jest.fn();
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      story: {
        findUnique: (...args: any[]) => mockFindUnique(...args),
        update: (...args: any[]) => mockUpdate(...args),
      },
      topicNote: {
        findUnique: (...args: any[]) => mockTopicNoteFindUnique(...args),
      },
    })),
  };
});

jest.mock('@/lib/research/synthesize', () => {
  mockSynthesizeResearchBrief = jest.fn();
  return { synthesizeResearchBrief: (...args: any[]) => mockSynthesizeResearchBrief(...args) };
});

import { POST } from '../route';

function makeRequest(body: any) {
  return new Request('http://localhost/api/research/synthesize', { method: 'POST', body: JSON.stringify(body) });
}

const sampleBrief = {
  overview: 'o',
  confirmed: [],
  developing: [],
  not_confirmed: [],
  timeline: [],
  disputed_claims: [],
  background: 'b',
  why_it_matters: 'w',
  open_questions: [],
};

describe('POST /api/research/synthesize', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockTopicNoteFindUnique.mockReset();
    mockSynthesizeResearchBrief.mockReset();
    mockUpdate.mockResolvedValue({});
  });

  it('rejects when storyId is missing', async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();
    expect(data.error_type).toBe('invalid_request');
  });

  it('rejects when the story is not the currently selected one', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: false, searchResults: [], verifiedClaims: [] });
    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();
    expect(data.error_type).toBe('invalid_request');
  });

  it('returns not_yet_searched when no search results are stored', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: true, searchResults: null, verifiedClaims: [] });
    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();
    expect(data.error_type).toBe('not_yet_searched');
    expect(mockSynthesizeResearchBrief).not.toHaveBeenCalled();
  });

  it('returns not_yet_searched when searchResults is an empty array', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: true, searchResults: [], verifiedClaims: [] });
    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();
    expect(data.error_type).toBe('not_yet_searched');
  });

  it('returns db_read_failed if the story lookup throws', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'));
    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();
    expect(data.error_type).toBe('db_read_failed');
  });

  it('fetches the topic note when topicKey is provided and passes its text through', async () => {
    mockFindUnique.mockResolvedValue({
      id: 's1',
      selectedForPipeline: true,
      searchResults: [{ title: 'T', url: 'https://a.com', content: 'c', published_date: null }],
      verifiedClaims: [],
      headline: 'H',
      summary: 'S',
    });
    mockTopicNoteFindUnique.mockResolvedValue({ topicKey: 'iran-hormuz', note: 'background text' });
    mockSynthesizeResearchBrief.mockResolvedValue({ ok: true, brief: sampleBrief });

    await POST(makeRequest({ storyId: 's1', topicKey: 'iran-hormuz' }));

    expect(mockTopicNoteFindUnique).toHaveBeenCalledWith({ where: { topicKey: 'iran-hormuz' } });
    expect(mockSynthesizeResearchBrief).toHaveBeenCalledWith(
      { headline: 'H', summary: 'S' },
      [],
      [{ title: 'T', url: 'https://a.com', content: 'c', published_date: null }],
      'background text',
      null
    );
  });

  it('passes owner instructions through and persists them', async () => {
    mockFindUnique.mockResolvedValue({
      id: 's1',
      selectedForPipeline: true,
      searchResults: [{ title: 'T', url: 'https://a.com', content: 'c', published_date: null }],
      verifiedClaims: [],
      headline: 'H',
      summary: 'S',
    });
    mockSynthesizeResearchBrief.mockResolvedValue({ ok: true, brief: sampleBrief });

    await POST(makeRequest({ storyId: 's1', instructions: 'Focus on the economic angle.' }));

    expect(mockUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 's1' },
      data: { researchStatus: 'synthesizing', researchError: null, researchInstructions: 'Focus on the economic angle.' },
    });
    expect(mockSynthesizeResearchBrief).toHaveBeenCalledWith(
      { headline: 'H', summary: 'S' },
      [],
      [{ title: 'T', url: 'https://a.com', content: 'c', published_date: null }],
      null,
      'Focus on the economic angle.'
    );
  });

  it('passes through a malformed_output failure without saving a brief, and marks status failed', async () => {
    mockFindUnique.mockResolvedValue({
      id: 's1',
      selectedForPipeline: true,
      searchResults: [{ title: 'T', url: 'https://a.com', content: 'c', published_date: null }],
      verifiedClaims: [],
      headline: 'H',
      summary: 'S',
    });
    mockSynthesizeResearchBrief.mockResolvedValue({ ok: false, error_type: 'malformed_output', message: 'bad shape' });

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(data.error_type).toBe('malformed_output');
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 's1' }, data: { researchStatus: 'failed', researchError: 'bad shape' } });
    expect(mockUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ researchBrief: expect.anything() }) }));
  });

  it('saves the brief, sets status back to searched (not complete), and returns it on success', async () => {
    mockFindUnique.mockResolvedValue({
      id: 's1',
      selectedForPipeline: true,
      searchResults: [{ title: 'T', url: 'https://a.com', content: 'c', published_date: null }],
      verifiedClaims: [],
      headline: 'H',
      summary: 'S',
    });
    mockSynthesizeResearchBrief.mockResolvedValue({ ok: true, brief: sampleBrief });

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(data.error).toBe(false);
    expect(data.brief).toEqual(sampleBrief);
    expect(data.researchStatus).toBe('searched');
    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({ researchBrief: sampleBrief, researchStatus: 'searched' }),
      })
    );
  });

  it('returns db_write_failed if saving the brief fails', async () => {
    mockFindUnique.mockResolvedValue({
      id: 's1',
      selectedForPipeline: true,
      searchResults: [{ title: 'T', url: 'https://a.com', content: 'c', published_date: null }],
      verifiedClaims: [],
      headline: 'H',
      summary: 'S',
    });
    mockSynthesizeResearchBrief.mockResolvedValue({ ok: true, brief: sampleBrief });
    mockUpdate.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('write failed'));

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(data.error_type).toBe('db_write_failed');
  });
});
