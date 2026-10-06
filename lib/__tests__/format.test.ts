import { domainFromUrl, formatScore, pluralize, priorityFromScore, timeAgo } from '../format';

const NOW = new Date('2026-10-06T12:00:00Z');

describe('timeAgo', () => {
  it('handles missing and invalid input', () => {
    expect(timeAgo(null, NOW)).toBe('—');
    expect(timeAgo(undefined, NOW)).toBe('—');
    expect(timeAgo('not a date', NOW)).toBe('—');
  });
  it('formats minutes, hours and days', () => {
    expect(timeAgo('2026-10-06T11:59:50Z', NOW)).toBe('just now');
    expect(timeAgo('2026-10-06T11:59:00Z', NOW)).toBe('1 minute ago');
    expect(timeAgo('2026-10-06T11:33:00Z', NOW)).toBe('27 minutes ago');
    expect(timeAgo('2026-10-06T01:00:00Z', NOW)).toBe('11 hours ago');
    expect(timeAgo('2026-10-04T12:00:00Z', NOW)).toBe('2 days ago');
  });
  it('treats future timestamps as just now', () => {
    expect(timeAgo('2026-10-06T12:05:00Z', NOW)).toBe('just now');
  });
});

describe('formatScore', () => {
  it('rounds to one decimal and handles null', () => {
    expect(formatScore(9.94)).toBe('9.9');
    expect(formatScore(1.5)).toBe('1.5');
    expect(formatScore(null)).toBe('—');
    expect(formatScore(NaN)).toBe('—');
  });
});

describe('priorityFromScore', () => {
  it('maps score bands', () => {
    expect(priorityFromScore(66)).toBe('high');
    expect(priorityFromScore(60)).toBe('high');
    expect(priorityFromScore(59.9)).toBe('medium');
    expect(priorityFromScore(40)).toBe('medium');
    expect(priorityFromScore(12)).toBe('low');
    expect(priorityFromScore(null)).toBe('low');
  });
});

describe('domainFromUrl / pluralize', () => {
  it('strips www and survives bad urls', () => {
    expect(domainFromUrl('https://www.dw.com/en/story')).toBe('dw.com');
    expect(domainFromUrl('https://news.sky.com/x')).toBe('news.sky.com');
    expect(domainFromUrl('nonsense')).toBe('nonsense');
  });
  it('pluralizes', () => {
    expect(pluralize(1, 'source')).toBe('1 source');
    expect(pluralize(8, 'source')).toBe('8 sources');
  });
});
