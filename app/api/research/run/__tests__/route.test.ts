/** @jest-environment node */

var mockFindUnique: jest.Mock;
var mockUpdate: jest.Mock;
var mockTopicNoteFindUnique: jest.Mock;
var mockBuildResearchBrief: jest.Mock;

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

jest.mock('@/lib/research/build-brief', () => {
  mockBuildResearchBrief = jest.fn();
  return { buildResearchBrief: (...args: any[]) => mockBuildResearchBrief(...args) };
});

import { POST } from '../route';

function makeRequest(body: any) {
  return new Request('http://localhost/api/research/run', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/research/run', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
    mockTopicNoteFindUnique.mockReset();
    mockBuildResearchBrief.mockReset();
  });

  it('rejects when storyId is missing', async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();
    expect(data.error).toBe(true);
    expect(data.error_type).toBe('invalid_request');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('rejects when the story does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await POST(makeRequest({ storyId: 'missing' }));
    const data = await res.json();
    expect(data.error_type).toBe('invalid_request');
  });

  it('rejects when the story is not the currently selected one', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: false, verifiedClaims: [] });
    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();
    expect(data.error_type).toBe('invalid_request');
    expect(mockBuildResearchBrief).not.toHaveBeenCalled();
  });

  it('returns db_read_failed if the story/topic-note lookup throws', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'));
    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();
    expect(data.error_type).toBe('db_read_failed');
  });

  it('passes through a Groq failure without saving anything', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: true, verifiedClaims: [] });
    mockBuildResearchBrief.mockResolvedValue({ ok: false, error_type: 'malformed_output', message: 'bad shape' });

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(data.error_type).toBe('malformed_output');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('fetches the topic note when topicKey is provided and passes its text through', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: true, verifiedClaims: [] });
    mockTopicNoteFindUnique.mockResolvedValue({ topicKey: 'iran-hormuz', note: 'background text' });
    mockBuildResearchBrief.mockResolvedValue({
      ok: true,
      brief: { confirmed: [], developing: [], not_confirmed: [] },
    });
    mockUpdate.mockResolvedValue({});

    await POST(makeRequest({ storyId: 's1', topicKey: 'iran-hormuz' }));

    expect(mockTopicNoteFindUnique).toHaveBeenCalledWith({ where: { topicKey: 'iran-hormuz' } });
    expect(mockBuildResearchBrief).toHaveBeenCalledWith([], 'background text');
  });

  it('saves the brief and returns it on success', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: true, verifiedClaims: [] });
    mockBuildResearchBrief.mockResolvedValue({
      ok: true,
      brief: { confirmed: ['a'], developing: [], not_confirmed: [] },
    });
    mockUpdate.mockResolvedValue({});

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(data.error).toBe(false);
    expect(data.brief).toEqual({ confirmed: ['a'], developing: [], not_confirmed: [] });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({ researchBrief: { confirmed: ['a'], developing: [], not_confirmed: [] } }),
      })
    );
  });

  it('returns db_write_failed if saving the brief fails', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', selectedForPipeline: true, verifiedClaims: [] });
    mockBuildResearchBrief.mockResolvedValue({
      ok: true,
      brief: { confirmed: [], developing: [], not_confirmed: [] },
    });
    mockUpdate.mockRejectedValue(new Error('write failed'));

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(data.error_type).toBe('db_write_failed');
  });
});
