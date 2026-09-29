/** @jest-environment node */

var mockFindUnique: jest.Mock;
var mockUpsert: jest.Mock;

jest.mock('@prisma/client', () => {
  mockFindUnique = jest.fn();
  mockUpsert = jest.fn();
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      topicNote: {
        findUnique: (...args: any[]) => mockFindUnique(...args),
        upsert: (...args: any[]) => mockUpsert(...args),
      },
    })),
  };
});

import { GET, POST } from '../route';

function makeGetRequest(topicKey?: string) {
  const url = topicKey
    ? `http://localhost/api/research/topic-notes?topicKey=${encodeURIComponent(topicKey)}`
    : 'http://localhost/api/research/topic-notes';
  return new Request(url);
}

function makePostRequest(body: any) {
  return new Request('http://localhost/api/research/topic-notes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('GET /api/research/topic-notes', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
  });

  it('rejects when topicKey is missing', async () => {
    const res = await GET(makeGetRequest());
    const data = await res.json();
    expect(data.error_type).toBe('invalid_request');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('returns note: null (not an error) when none exists yet', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await GET(makeGetRequest('iran-hormuz'));
    const data = await res.json();
    expect(data).toEqual({ error: false, note: null });
  });

  it('returns the note when one exists', async () => {
    mockFindUnique.mockResolvedValue({ topicKey: 'iran-hormuz', note: 'text' });
    const res = await GET(makeGetRequest('iran-hormuz'));
    const data = await res.json();
    expect(data.note.note).toBe('text');
  });

  it('returns db_read_failed on a database error', async () => {
    mockFindUnique.mockRejectedValue(new Error('down'));
    const res = await GET(makeGetRequest('iran-hormuz'));
    const data = await res.json();
    expect(data.error_type).toBe('db_read_failed');
  });
});

describe('POST /api/research/topic-notes', () => {
  beforeEach(() => {
    mockUpsert.mockReset();
  });

  it('rejects when topicKey is empty', async () => {
    const res = await POST(makePostRequest({ topicKey: '', note: 'x' }));
    const data = await res.json();
    expect(data.error_type).toBe('invalid_request');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('rejects when note is missing', async () => {
    const res = await POST(makePostRequest({ topicKey: 'iran-hormuz' }));
    const data = await res.json();
    expect(data.error_type).toBe('invalid_request');
  });

  it('upserts and returns the saved note', async () => {
    mockUpsert.mockResolvedValue({ topicKey: 'iran-hormuz', note: 'new text' });
    const res = await POST(makePostRequest({ topicKey: 'iran-hormuz', note: 'new text' }));
    const data = await res.json();

    expect(data.error).toBe(false);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { topicKey: 'iran-hormuz' },
      create: { topicKey: 'iran-hormuz', note: 'new text' },
      update: { note: 'new text' },
    });
  });

  it('returns db_write_failed on a database error', async () => {
    mockUpsert.mockRejectedValue(new Error('down'));
    const res = await POST(makePostRequest({ topicKey: 'iran-hormuz', note: 'x' }));
    const data = await res.json();
    expect(data.error_type).toBe('db_write_failed');
  });
});
