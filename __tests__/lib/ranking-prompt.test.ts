// __tests__/lib/ranking-prompt.test.ts

import { buildRankingPrompt, parseRankingOutput, sortByFitScoreDesc } from '@/lib/ranking-prompt';

describe('buildRankingPrompt', () => {
  it('includes the story headline, summary, and verification tier', () => {
    const prompt = buildRankingPrompt({
      id: '1',
      headline: 'Test headline',
      summary: 'Test summary',
      verificationTier: 'DISPUTED',
    });
    expect(prompt).toContain('Test headline');
    expect(prompt).toContain('Test summary');
    expect(prompt).toContain('DISPUTED');
  });

  it('falls back to UNKNOWN when verificationTier is null', () => {
    const prompt = buildRankingPrompt({
      id: '1',
      headline: 'h',
      summary: 's',
      verificationTier: null,
    });
    expect(prompt).toContain('UNKNOWN');
  });
});

describe('parseRankingOutput', () => {
  it('parses a valid response', () => {
    const result = parseRankingOutput(
      JSON.stringify({
        editorialReason: 'significant_human_impact',
        fitScore: 77,
        fitRationale: 'Affects a large number of people directly.',
      })
    );
    expect(result).toEqual({
      editorialReason: 'significant_human_impact',
      fitScore: 77,
      fitRationale: 'Affects a large number of people directly.',
    });
  });

  it('strips markdown fences defensively', () => {
    const result = parseRankingOutput(
      '```json\n' +
        JSON.stringify({ editorialReason: 'none', fitScore: 3, fitRationale: 'No reason.' }) +
        '\n```'
    );
    expect(result?.fitScore).toBe(3);
  });

  it('returns null for invalid editorialReason category', () => {
    const result = parseRankingOutput(
      JSON.stringify({ editorialReason: 'made_up_category', fitScore: 50, fitRationale: 'x' })
    );
    expect(result).toBeNull();
  });

  it('returns null for out-of-range fitScore', () => {
    const result = parseRankingOutput(
      JSON.stringify({ editorialReason: 'none', fitScore: 150, fitRationale: 'x' })
    );
    expect(result).toBeNull();
  });

  it('returns null for non-JSON input', () => {
    expect(parseRankingOutput('I think this story is pretty important, score 80')).toBeNull();
  });

  it('returns null for empty fitRationale', () => {
    const result = parseRankingOutput(
      JSON.stringify({ editorialReason: 'none', fitScore: 10, fitRationale: '   ' })
    );
    expect(result).toBeNull();
  });
});

describe('sortByFitScoreDesc', () => {
  it('sorts highest fitScore first', () => {
    const input = [
      { id: 'a', fitScore: 40 },
      { id: 'b', fitScore: 92 },
      { id: 'c', fitScore: 65 },
    ];
    expect(sortByFitScoreDesc(input).map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts unscored (null) stories last', () => {
    const input = [
      { id: 'a', fitScore: null },
      { id: 'b', fitScore: 50 },
    ];
    expect(sortByFitScoreDesc(input).map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('does not mutate the original array', () => {
    const input = [
      { id: 'a', fitScore: 10 },
      { id: 'b', fitScore: 90 },
    ];
    sortByFitScoreDesc(input);
    expect(input.map((s) => s.id)).toEqual(['a', 'b']);
  });
});
