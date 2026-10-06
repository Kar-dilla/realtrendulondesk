import { toStoryCardData } from '../story-card';

const base = {
  id: 's1',
  headline: 'Spain calls early election',
  category: 'Politics',
  sourceUrls: ['https://www.dw.com/a', 'https://dw.com/b', 'https://news.sky.com/c'],
  discoveredAt: new Date('2026-10-05T20:00:00Z'),
  fitScore: 66,
};

describe('toStoryCardData', () => {
  it('counts distinct publishers, not urls', () => {
    const c = toStoryCardData(base);
    expect(c.sourceCount).toBe(2);
    expect(c.sources.map((s) => s.domain)).toEqual(['dw.com', 'news.sky.com']);
  });
  it('derives priority and passes the score through', () => {
    const c = toStoryCardData(base);
    expect(c.priority).toBe('high');
    expect(c.score).toBe(66);
  });
  it('falls back for missing times and scores', () => {
    const c = toStoryCardData(base);
    expect(c.firstReportedAt).toBe('2026-10-05T20:00:00.000Z');
    expect(c.lastUpdatedAt).toBe('2026-10-05T20:00:00.000Z');
    expect(c.globalImpact).toBe(null);
    expect(c.sourceConfidence).toBe(null);
  });
  it('normalises confidence and prefers explicit times', () => {
    const c = toStoryCardData({
      ...base,
      sourceConfidence: 'high',
      firstReportedAt: '2026-10-05T10:00:00Z',
      lastUpdatedAt: '2026-10-05T18:00:00Z',
      globalImpact: 9.9,
      freshnessScore: 5.8,
    });
    expect(c.sourceConfidence).toBe('HIGH');
    expect(c.firstReportedAt).toBe('2026-10-05T10:00:00.000Z');
    expect(c.lastUpdatedAt).toBe('2026-10-05T18:00:00.000Z');
    expect(c.globalImpact).toBe(9.9);
    expect(c.freshness).toBe(5.8);
  });
  it('handles stories with no sources and junk confidence', () => {
    const c = toStoryCardData({ ...base, sourceUrls: [], sourceConfidence: 'maybe', fitScore: null });
    expect(c.sourceCount).toBe(0);
    expect(c.sourceConfidence).toBe(null);
    expect(c.priority).toBe('low');
  });
});
