/**
 * NOTE: I have not run this suite. There's no network in my sandbox to
 * `npm install` jest/testing-library/ts-jest, so this is written to the
 * project's stated conventions but unverified by an actual run. Run
 * `npm test` yourself and send me the real output — per the brief, that's
 * required before anything gets called done.
 *
 * Assumed available: jest, ts-jest (or Next's built-in jest config),
 * @testing-library/react, @testing-library/jest-dom. If your repo doesn't
 * have these yet, `npm install --save-dev jest ts-jest @types/jest
 * @testing-library/react @testing-library/jest-dom jest-environment-jsdom`.
 */

import { dedupeStories, buildDedupeKey } from '../lib/discovery/dedupe';
import { isValidRawStory, type RawDiscoveredStory } from '../lib/discovery/discovery-source';

describe('dedupeStories', () => {
  it('merges multiple sources describing the same event into one story', () => {
    const raw: RawDiscoveredStory[] = [
      {
        headline: 'Powerful earthquake hits northern Japan',
        summary: 'A 6.8 magnitude earthquake struck northern Japan early Tuesday.',
        category: 'disaster',
        source_urls: ['https://reuters.com/a'],
        event_time: '2026-09-22T02:00:00Z',
      },
      {
        headline: 'Earthquake strikes northern Japan, dozens injured',
        summary: 'At least 14 dead and dozens injured after a powerful earthquake hit northern Japan.',
        category: 'disaster',
        source_urls: ['https://apnews.com/b'],
        event_time: '2026-09-22T02:15:00Z',
      },
    ];

    const result = dedupeStories(raw);

    expect(result).toHaveLength(1);
    expect(result[0].merged_from_count).toBe(2);
    expect(result[0].source_urls).toEqual(
      expect.arrayContaining(['https://reuters.com/a', 'https://apnews.com/b'])
    );
    // Longer summary should win.
    expect(result[0].summary).toContain('14 dead');
  });

  it('does NOT merge two distinct earthquakes on the same day', () => {
    const raw: RawDiscoveredStory[] = [
      {
        headline: 'Earthquake hits northern Japan',
        summary: 'A quake struck Hokkaido.',
        category: 'disaster',
        source_urls: ['https://reuters.com/a'],
        event_time: '2026-09-22T02:00:00Z',
      },
      {
        headline: 'Earthquake strikes central Chile',
        summary: 'A separate quake hit the Chilean coast.',
        category: 'disaster',
        source_urls: ['https://reuters.com/c'],
        event_time: '2026-09-22T14:00:00Z',
      },
    ];

    const result = dedupeStories(raw);
    expect(result).toHaveLength(2);
  });

  it('keeps unrelated stories separate', () => {
    const raw: RawDiscoveredStory[] = [
      {
        headline: 'Central bank raises interest rates',
        summary: 'Rates rise by 25 basis points.',
        category: 'economy',
        source_urls: ['https://reuters.com/x'],
        event_time: '2026-09-22T09:00:00Z',
      },
      {
        headline: 'Powerful earthquake hits northern Japan',
        summary: 'A quake struck Japan.',
        category: 'disaster',
        source_urls: ['https://reuters.com/y'],
        event_time: '2026-09-22T09:00:00Z',
      },
    ];

    expect(dedupeStories(raw)).toHaveLength(2);
  });
});

describe('buildDedupeKey', () => {
  it('produces the same key for near-duplicate headlines on the same day', () => {
    const a = buildDedupeKey({
      headline: 'Powerful earthquake hits northern Japan',
      summary: '', category: null, source_urls: [], event_time: '2026-09-22T02:00:00Z',
    });
    const b = buildDedupeKey({
      headline: 'northern Japan hit by powerful earthquake',
      summary: '', category: null, source_urls: [], event_time: '2026-09-22T05:00:00Z',
    });
    expect(a).toBe(b);
  });
});

describe('isValidRawStory', () => {
  it('accepts a well-formed story', () => {
    expect(isValidRawStory({
      headline: 'X', summary: 'Y', category: null,
      source_urls: ['https://example.com'], event_time: null,
    })).toBe(true);
  });

  it('rejects a story missing required fields', () => {
    expect(isValidRawStory({ headline: 'X' })).toBe(false);
  });

  it('rejects a story with non-string source_urls', () => {
    expect(isValidRawStory({
      headline: 'X', summary: 'Y', category: null,
      source_urls: [123], event_time: null,
    })).toBe(false);
  });
});
