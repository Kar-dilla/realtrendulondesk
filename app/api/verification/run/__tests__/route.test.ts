/**
 * @jest-environment node
 */

var mockFindMany = jest.fn();
var mockUpdate = jest.fn();
var mockCount = jest.fn();
var mockCreateMany = jest.fn();
var mockTransaction = jest.fn(async (ops: Promise<any>[]) => Promise.all(ops));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    story: {
      findMany: (...args: any[]) => mockFindMany(...args),
      update: (...args: any[]) => mockUpdate(...args),
      count: (...args: any[]) => mockCount(...args),
    },
    verifiedClaim: {
      createMany: (...args: any[]) => mockCreateMany(...args),
    },
    $transaction: (ops: any) => mockTransaction(ops),
  })),
}));

jest.mock('@/lib/verification/classify', () => ({
  classifyStoryClaims: jest.fn(),
}));

import { classifyStoryClaims } from '@/lib/verification/classify';
import { GET, POST } from '../route';

describe('GET /api/verification/run', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the count of pending stories', async () => {
    mockCount.mockResolvedValue(7);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual({ error: false, pending: 7 });
  });

  it('reports db_read_failed if the count query throws', async () => {
    mockCount.mockRejectedValue(new Error('connection refused'));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error_type).toBe('db_read_failed');
  });
});

describe('POST /api/verification/run', () => {
  beforeEach(() => jest.clearAllMocks());

  it('only queries stories where verificationTier is null', async () => {
    mockFindMany.mockResolvedValue([]);
    await POST();
    expect(mockFindMany).toHaveBeenCalledWith({ where: { verificationTier: null } });
  });

  it('leaves already-verified stories untouched — the where-clause is what enforces this', async () => {
    mockFindMany.mockResolvedValue([{ id: 's1', headline: 'H', summary: 'S', sourceUrls: [] }]);
    (classifyStoryClaims as any).mockResolvedValue({
      ok: true,
      claims: [{ claim: 'x', tier: 'CONFIRMED', evidence: null }],
    });

    const res = await POST();
    const body = await res.json();

    expect(mockFindMany).toHaveBeenCalledWith({ where: { verificationTier: null } });
    expect(body.processed).toBe(1);
  });

  it('sets the story-level tier to the most conservative tier among its claims and persists both', async () => {
    mockFindMany.mockResolvedValue([{ id: 's1', headline: 'H', summary: 'S', sourceUrls: [] }]);
    (classifyStoryClaims as any).mockResolvedValue({
      ok: true,
      claims: [
        { claim: 'a', tier: 'CONFIRMED', evidence: null },
        { claim: 'b', tier: 'DISPUTED', evidence: null },
      ],
    });

    const res = await POST();
    const body = await res.json();

    expect(mockTransaction).toHaveBeenCalled();
    expect(body.results[0].tier).toBe('DISPUTED');
    expect(body.claims_tiered).toBe(2);
    expect(body.left_null).toBe(0);
  });

  it('leaves verificationTier null and does not fabricate a tier when the model output is malformed', async () => {
    mockFindMany.mockResolvedValue([{ id: 's1', headline: 'H', summary: 'S', sourceUrls: [] }]);
    (classifyStoryClaims as any).mockResolvedValue({
      ok: false,
      error_type: 'malformed_response',
      message: 'bad json',
    });

    const res = await POST();
    const body = await res.json();

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(body.results[0].tier).toBeNull();
    expect(body.left_null).toBe(1);
    expect(body.left_null_breakdown.model_failure).toBe(1);
    expect(body.left_null_breakdown.unclassifiable_content).toBe(0);
  });

  it('leaves verificationTier null when a story has no classifiable claims, bucketed separately from a model failure', async () => {
    mockFindMany.mockResolvedValue([{ id: 's1', headline: 'H', summary: 'S', sourceUrls: [] }]);
    (classifyStoryClaims as any).mockResolvedValue({ ok: true, claims: [] });

    const res = await POST();
    const body = await res.json();

    expect(body.results[0].tier).toBeNull();
    expect(body.results[0].reason).toBe('no_classifiable_claims');
    expect(body.left_null_breakdown.unclassifiable_content).toBe(1);
    expect(body.left_null_breakdown.model_failure).toBe(0);
  });

  it('leaves verificationTier null if the DB write fails after successful classification', async () => {
    mockFindMany.mockResolvedValue([{ id: 's1', headline: 'H', summary: 'S', sourceUrls: [] }]);
    (classifyStoryClaims as any).mockResolvedValue({
      ok: true,
      claims: [{ claim: 'a', tier: 'CONFIRMED', evidence: null }],
    });
    mockTransaction.mockRejectedValueOnce(new Error('write failed'));

    const res = await POST();
    const body = await res.json();

    expect(body.results[0].tier).toBeNull();
    expect(body.results[0].reason).toBe('db_write_failed');
    expect(body.left_null_breakdown.db_write_failed).toBe(1);
    expect(body.claims_tiered).toBe(0);
  });

  it('reports db_read_failed without processing anything if the initial query throws', async () => {
    mockFindMany.mockRejectedValue(new Error('connection refused'));
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error_type).toBe('db_read_failed');
    expect(classifyStoryClaims).not.toHaveBeenCalled();
  });
});
