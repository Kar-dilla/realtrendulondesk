/** @jest-environment node */
import { readFileSync } from 'fs';
import { createGdeltProvider, parseGdeltBody, runGdelt } from '../gdelt';
import type { GdeltOptions } from '../gdelt';
import { TOPICS } from '../topics';
import type { TopicConfig } from '../topics';

const topics: TopicConfig[] = [
  { id: 'a', query: '(alpha OR beta)' },
  { id: 'b', query: '(gamma OR delta)' },
];
const art = (url: string, title: string, seendate = '20251006T101500Z') => ({
  url,
  title,
  seendate,
  domain: 'example.com',
  language: 'English',
  sourcecountry: 'United Kingdom',
});
const body = (...arts: object[]): string => JSON.stringify({ articles: arts });
const asFetch = (fn: unknown): typeof fetch => fn as typeof fetch;
const res = (status: number, text: string) => ({ status, ok: status >= 200 && status < 300, text: () => Promise.resolve(text) });
const reply = (status: number, text: string): typeof fetch => asFetch(() => Promise.resolve(res(status, text)));
const seq = (...replies: Array<[number, string]>): typeof fetch => {
  let i = 0;
  return asFetch(() => {
    const pick: [number, string] = replies[Math.min(i++, replies.length - 1)] ?? [500, ''];
    return Promise.resolve(res(pick[0], pick[1]));
  });
};
const opts = (fetchFn: typeof fetch, extra: GdeltOptions = {}): GdeltOptions => ({
  fetchFn,
  topics,
  sleepFn: () => Promise.resolve(),
  ...extra,
});
const fetchRecent = (o: GdeltOptions, maxItems?: number) =>
  createGdeltProvider(o).fetchRecent(maxItems === undefined ? { sinceHours: 24 } : { sinceHours: 24, maxItems });

describe('parsing', () => {
  it('1. maps a GDELT artlist response to RawArticle', async () => {
    const sample = body(art('https://www.dw.com/en/x/a-1', '  Quake   hits  coast '));
    const r = await fetchRecent(opts(reply(200, sample), { topics: topics.slice(0, 1) }));
    expect(r).toEqual({
      ok: true,
      provider: 'gdelt',
      data: [
        {
          url: 'https://www.dw.com/en/x/a-1',
          title: 'Quake hits coast',
          publisher: 'dw.com',
          publishedAt: '2025-10-06T10:15:00.000Z',
          language: 'English',
          country: 'United Kingdom',
          provider: 'gdelt',
        },
      ],
    });
  });

  it('2. malformed (non-JSON) reply gives bad_response', async () => {
    const r = await fetchRecent(opts(reply(200, 'Your query was too short or too long.')));
    expect(r).toMatchObject({ ok: false, error: { kind: 'bad_response' } });
  });

  it('3. empty body and {} are ok with no articles', async () => {
    const empty = { ok: true, provider: 'gdelt', data: [] };
    expect(await fetchRecent(opts(reply(200, '')))).toEqual(empty);
    expect(await fetchRecent(opts(reply(200, '{}')))).toEqual(empty);
  });

  it('4. drops items with no title, a non-http url, or a bad date', () => {
    const r = parseGdeltBody(
      body(
        art('https://e.com/nt', ''),
        art('ftp://e.com/f', 'Not http'),
        art('https://e.com/bad', 'Bad date', '2025-10-06'),
        art('https://e.com/ok', 'Ok'),
      ),
    );
    expect(r.ok ? r.data.map((a) => a.url) : []).toEqual(['https://e.com/ok']);
  });
});

describe('errors', () => {
  it('5. HTTP 429 on every topic gives rate_limit', async () => {
    const r = await fetchRecent(opts(reply(429, 'slow down')));
    expect(r).toMatchObject({ ok: false, provider: 'gdelt', error: { kind: 'rate_limit', status: 429 } });
  });

  it('6. other non-200 statuses map through kindFromStatus', async () => {
    expect(await fetchRecent(opts(reply(503, '')))).toMatchObject({ ok: false, error: { kind: 'overloaded', status: 503 } });
    expect(await fetchRecent(opts(reply(403, '')))).toMatchObject({ ok: false, error: { kind: 'auth', status: 403 } });
  });

  it('7. a rejecting fetch gives network', async () => {
    const r = await fetchRecent(opts(asFetch(() => Promise.reject(new Error('boom')))));
    expect(r).toMatchObject({ ok: false, error: { kind: 'network' } });
  });

  it('8. a fetch that never resolves times out as network', async () => {
    const hang = asFetch(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const r = await fetchRecent(opts(hang, { topics: topics.slice(0, 1), timeoutMs: 20 }));
    expect(r).toMatchObject({ ok: false, error: { kind: 'network' } });
  });

  it('9. one failed topic does not fail the run, and it is reported', async () => {
    const make = () => seq([503, ''], [200, body(art('https://e.com/1', 'One'))]);
    const run = await runGdelt(opts(make()), { sinceHours: 24 });
    expect(run.articles.map((a) => a.url)).toEqual(['https://e.com/1']);
    expect(run.topics.map((t) => [t.id, t.ok, t.error?.kind])).toEqual([
      ['a', false, 'overloaded'],
      ['b', true, undefined],
    ]);
    expect((await fetchRecent(opts(make()))).ok).toBe(true);
  });
});

describe('pacing and request shape', () => {
  it('10. runs topics one at a time, at least 5 seconds apart', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const f = asFetch(async () => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await Promise.resolve();
      inflight -= 1;
      return res(200, '{}');
    });
    const waits: number[] = [];
    const sleepFn = (ms: number): Promise<void> => {
      waits.push(ms);
      return Promise.resolve();
    };
    await runGdelt(opts(f, { topics: TOPICS, sleepFn }), { sinceHours: 24 });
    expect(maxInflight).toBe(1);
    expect(waits).toHaveLength(TOPICS.length - 1);
    expect(waits.every((w) => w > 4000 && w <= 5000)).toBe(true);
  });

  it('11. waits the backoff time after a 429', async () => {
    const waits: number[] = [];
    const sleepFn = (ms: number): Promise<void> => {
      waits.push(ms);
      return Promise.resolve();
    };
    const f = seq([429, ''], [200, body(art('https://e.com/1', 'One'))]);
    const run = await runGdelt(opts(f, { sleepFn, minGapMs: 5000, backoffMs: 9000 }), { sinceHours: 24 });
    expect(waits[0]).toBeGreaterThan(8000);
    expect(waits[0]).toBeLessThanOrEqual(9000);
    expect(run.topics[0]?.error?.retryAfterSeconds).toBe(9);
    expect(run.articles).toHaveLength(1);
  });

  it('12. sends the expected query parameters', async () => {
    const urls: string[] = [];
    const f = asFetch((u: string) => {
      urls.push(u);
      return Promise.resolve(res(200, '{}'));
    });
    await fetchRecent(opts(f, { topics: topics.slice(0, 1), maxRecords: 75 }));
    const u = new URL(urls[0] ?? '');
    expect(u.origin + u.pathname).toBe('https://api.gdeltproject.org/api/v2/doc/doc');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      query: '(alpha OR beta) sourcelang:english',
      mode: 'artlist',
      format: 'json',
      sort: 'datedesc',
      timespan: '24h',
      maxrecords: '75',
    });
  });

  it('13. the topic list is 8 parenthesized OR groups', () => {
    expect(TOPICS.map((t) => t.id)).toEqual(['conflict', 'disaster', 'politics', 'economy', 'technology', 'science', 'health', 'world']);
    expect(TOPICS.every((t) => /^\(.+\)$/.test(t.query))).toBe(true);
  });

  it('14. dedupes a url across topics and honors maxItems', async () => {
    const make = () =>
      seq(
        [200, body(art('https://e.com/1', 'One'), art('https://e.com/2', 'Two'))],
        [200, body(art('https://e.com/1', 'One again'), art('https://e.com/3', 'Three'))],
      );
    const all = await fetchRecent(opts(make()));
    expect(all.ok ? all.data.map((a) => a.url) : []).toEqual(['https://e.com/1', 'https://e.com/2', 'https://e.com/3']);
    const two = await fetchRecent(opts(make()), 2);
    expect(two.ok ? two.data.map((a) => a.url) : []).toEqual(['https://e.com/1', 'https://e.com/2']);
  });
});

describe('live sample', () => {
  it('15. parses GDELT_SAMPLE_FILE when set', () => {
    const file = process.env.GDELT_SAMPLE_FILE;
    if (!file) return;
    const r = parseGdeltBody(readFileSync(file, 'utf8'));
    const list = r.ok ? r.data : [];
    expect(r.ok).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(5);
    for (const a of list) {
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.url.startsWith('http')).toBe(true);
      expect(a.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    }
  });
});

describe('language and rate-limit text', () => {
  it('16. keeps only English articles', () => {
    const spanish = { ...art('https://e.com/es', 'Terremoto en la costa'), language: 'Spanish' };
    const r = parseGdeltBody(body(spanish, art('https://e.com/en', 'Quake hits coast')));
    expect(r.ok ? r.data.map((a) => a.url) : []).toEqual(['https://e.com/en']);
  });

  it('17. every query asks GDELT for English sources only', async () => {
    const queries: string[] = [];
    const f = asFetch((u: string) => {
      queries.push(new URL(u).searchParams.get('query') ?? '');
      return Promise.resolve(res(200, '{}'));
    });
    await runGdelt(opts(f, { topics: TOPICS }), { sinceHours: 24 });
    expect(queries).toHaveLength(TOPICS.length);
    expect(queries.every((q) => q.endsWith(' sourcelang:english'))).toBe(true);
  });

  it('18. GDELT rate-limit text on HTTP 200 counts as rate_limit', async () => {
    const msg = 'Please limit requests to one every 5 seconds or contact the GDELT team for larger queries.';
    const r = await fetchRecent(opts(reply(200, msg)));
    expect(r).toMatchObject({ ok: false, error: { kind: 'rate_limit' } });
  });
});
