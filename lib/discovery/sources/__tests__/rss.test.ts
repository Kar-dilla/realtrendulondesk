/** @jest-environment node */
import { readFileSync } from 'fs';
import { FEEDS } from '../feeds';
import type { FeedConfig } from '../feeds';
import { createRssProvider, parseFeed } from '../rss';

const feed: FeedConfig = { id: 'test', label: 'Test', url: 'https://example.com/feed.xml' };
const DATE = 'Mon, 06 Oct 2025 10:00:00 GMT';
const wrap = (items: string): string =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>${items}</channel></rss>`;
const item = (title: string, link: string, date: string = DATE, extra = ''): string =>
  `<item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate>${extra}</item>`;
const asFetch = (fn: unknown): typeof fetch => fn as typeof fetch;
const reply = (status: number, body: string): typeof fetch =>
  asFetch(() =>
    Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body) }),
  );
const run = (fetchFn: typeof fetch, sinceHours = 24, timeoutMs = 10000) =>
  createRssProvider(feed, { fetchFn, timeoutMs }).fetchRecent({ sinceHours });
const ago = (ms: number): string => new Date(Date.now() - ms).toUTCString();

describe('parseFeed', () => {
  it('1. cleans CDATA title and description in RSS 2.0', () => {
    const xml = wrap(
      `<item><title><![CDATA[  Hello   World  ]]></title><link>https://www.dw.com/a</link>` +
        `<pubDate>${DATE}</pubDate>` +
        `<description><![CDATA[<p>Fish &amp; chips</p><p>Second</p>]]></description></item>`,
    );
    const list = parseFeed(xml, feed);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      title: 'Hello World',
      snippet: 'Fish & chips Second',
      url: 'https://www.dw.com/a',
      publisher: 'dw.com',
      provider: 'rss:test',
      publishedAt: '2025-10-06T10:00:00.000Z',
    });
  });

  it('2. uses the alternate href when Atom link is an array', () => {
    const xml =
      `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom one</title>` +
      `<link rel="self" href="https://example.com/self"/><link rel="alternate" href="https://example.com/real"/>` +
      `<updated>2025-10-06T10:00:00Z</updated><summary>Sum</summary></entry></feed>`;
    expect(parseFeed(xml, feed)).toMatchObject([{ url: 'https://example.com/real', title: 'Atom one', snippet: 'Sum' }]);
  });

  it('3. reads an RSS 1.0 (rdf:RDF) item with dc:date', () => {
    const xml =
      `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" ` +
      `xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">` +
      `<channel><title>C</title></channel><item><title>RDF one</title><link>https://example.com/rdf</link>` +
      `<dc:date>2025-10-06T10:00:00+00:00</dc:date></item></rdf:RDF>`;
    expect(parseFeed(xml, feed)).toMatchObject([{ url: 'https://example.com/rdf', publishedAt: '2025-10-06T10:00:00.000Z' }]);
  });

  it('4. drops items with no title, no link, or an invalid date', () => {
    const xml = wrap(
      `<item><link>https://example.com/nt</link><pubDate>${DATE}</pubDate></item>` +
        `<item><title>No link</title><pubDate>${DATE}</pubDate></item>` +
        item('Bad date', 'https://example.com/bad', 'not a date') +
        item('Good', 'https://example.com/good'),
    );
    expect(parseFeed(xml, feed).map((a) => a.url)).toEqual(['https://example.com/good']);
  });

  it('5. keeps a duplicate url only once', () => {
    const xml = wrap(item('First', 'https://example.com/dup') + item('Second', 'https://example.com/dup'));
    const list = parseFeed(xml, feed);
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('First');
  });

  it('6. cuts a long snippet to 300 characters', () => {
    const xml = wrap(item('Long', 'https://example.com/long', DATE, `<description>${'word '.repeat(200)}</description>`));
    expect(parseFeed(xml, feed)[0]?.snippet?.length).toBe(300);
  });

  it('7. returns [] for plain text', () => {
    expect(parseFeed('just some plain text', feed)).toEqual([]);
  });
});

describe('createRssProvider', () => {
  it('8. HTTP 404 gives not_found', async () => {
    const r = await run(reply(404, 'nope'));
    expect(r).toMatchObject({ ok: false, provider: 'rss:test', error: { kind: 'not_found', status: 404, message: 'HTTP 404' } });
  });

  it('9. HTTP 503 gives overloaded', async () => {
    const r = await run(reply(503, 'busy'));
    expect(r).toMatchObject({ ok: false, error: { kind: 'overloaded', status: 503 } });
  });

  it('10. a rejecting fetch gives network', async () => {
    const r = await run(asFetch(() => Promise.reject(new Error('boom'))));
    expect(r).toMatchObject({ ok: false, error: { kind: 'network' } });
  });

  it('11. a fetch that never resolves times out as network', async () => {
    const hang = asFetch(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const r = await run(hang, 24, 20);
    expect(r).toMatchObject({ ok: false, error: { kind: 'network' } });
  });

  it('12. a 200 HTML page gives bad_response', async () => {
    const r = await run(reply(200, '<!DOCTYPE html><html><body><h1>Hi</h1></body></html>'));
    expect(r).toMatchObject({ ok: false, error: { kind: 'bad_response' } });
  });

  it('13. keeps only items inside sinceHours', async () => {
    const xml = wrap(
      item('New', 'https://example.com/new', ago(2 * 3600000)) +
        item('Old', 'https://example.com/old', ago(30 * 3600000)) +
        item('Soon', 'https://example.com/soon', ago(-2 * 60000)) +
        item('Far', 'https://example.com/far', ago(-10 * 60000)),
    );
    const r = await run(reply(200, xml), 24);
    expect(r.ok).toBe(true);
    expect(r.ok ? r.data.map((a) => a.url) : []).toEqual(['https://example.com/new', 'https://example.com/soon']);
  });
});

describe('live sample', () => {
  it('14. parses RSS_SAMPLE_FILE when set', () => {
    const file = process.env.RSS_SAMPLE_FILE;
    if (!file) return;
    const bbc = FEEDS.find((f) => f.id === 'bbc-world');
    if (!bbc) throw new Error('bbc-world feed missing');
    const list = parseFeed(readFileSync(file, 'utf8'), bbc);
    expect(list.length).toBeGreaterThanOrEqual(5);
    for (const a of list) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.url.startsWith('http')).toBe(true);
      expect(a.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    }
  });
});
