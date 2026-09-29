/** @jest-environment node */

var mockFindMany: jest.Mock;

jest.mock('@prisma/client', () => {
  mockFindMany = jest.fn();
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      story: {
        findMany: (...args: any[]) => mockFindMany(...args),
      },
    })),
  };
});

import { GET } from '../route';

describe('GET /api/research/selected', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it('returns the selected story when one exists', async () => {
    mockFindMany.mockResolvedValue([{ id: 's1', headline: 'H', verifiedClaims: [] }]);

    const res = await GET();
    const data = await res.json();

    expect(data).toEqual({ error: false, story: { id: 's1', headline: 'H', verifiedClaims: [] } });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { selectedForPipeline: true },
        orderBy: { selectedAt: 'desc' },
        take: 1,
      })
    );
  });

  it('returns story: null (not an error) when nothing is selected', async () => {
    mockFindMany.mockResolvedValue([]);

    const res = await GET();
    const data = await res.json();

    expect(data).toEqual({ error: false, story: null });
  });

  it('returns db_read_failed on a database error', async () => {
    mockFindMany.mockRejectedValue(new Error('connection lost'));

    const res = await GET();
    const data = await res.json();

    expect(data.error).toBe(true);
    expect(data.error_type).toBe('db_read_failed');
  });
});
