/** @jest-environment node */

var mockFindUnique: jest.Mock;
var mockUpdate: jest.Mock;

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

import { POST } from '../route';

function makeRequest(body: any) {
  return new Request('http://localhost/api/research/finalize', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/research/finalize', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  it('rejects when storyId is missing', async () => {
    const res = await POST(makeRequest({}));
    const data = await res.json();
    expect(data.error_type).toBe('invalid_request');
  });

  it('rejects when the story has no research brief yet', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', researchBrief: null });
    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();
    expect(data.error_type).toBe('invalid_request');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('sets researchStatus to complete and nothing else', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', researchBrief: { overview: 'x' } });
    mockUpdate.mockResolvedValue({});

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(data).toEqual({ error: false, researchStatus: 'complete' });
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 's1' }, data: { researchStatus: 'complete' } });
  });

  it('returns db_read_failed if the story lookup throws', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'));
    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();
    expect(data.error_type).toBe('db_read_failed');
  });

  it('returns db_write_failed if the update throws', async () => {
    mockFindUnique.mockResolvedValue({ id: 's1', researchBrief: { overview: 'x' } });
    mockUpdate.mockRejectedValue(new Error('write failed'));

    const res = await POST(makeRequest({ storyId: 's1' }));
    const data = await res.json();

    expect(data.error_type).toBe('db_write_failed');
  });
});
