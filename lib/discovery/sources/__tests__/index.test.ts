import { fail, ok } from '../../../contracts/providers';
import type { ProviderError, RawArticle } from '../../../contracts/providers';
import type { FeedConfig } from '../feeds';
import type { GdeltRun, TopicStatus } from '../gdelt';
import { runAllSources } from '../index';
import type { AllSourcesOptions } from '../index';

type CreateRss = NonNullable<AllSourcesOptions['createRssProviderFn']>;
type RunGdeltFn = NonNullable<AllSourcesOptions['runGdeltFn']>;

const RUN = { sinceHours: 24 };

const FEED_LIST: FeedConfig[] = [
  { id: 'a', label: 'Feed A', url: 'https://a.test/rss' },
  { id: 'b', label: 'Feed B', url: 'https://b.test/rss' },
  { id: 'c', label: 'Feed C', url: 'https://c.test/rss' },
];

const article = (provider: string, n: number): RawArticle => ({
  url: `https://${provider.replace(':', '-')}.test/story-${n}`,
  title: `${provider} story ${n}`,
  publisher: `${provider.replace(':', '-')}.test`,
  publishedAt: '2026-10-08T06:00:00.000Z',
  provider,
});
const articles = (provider: string, count: number): RawArticle[] =>
  Array.from({ length: count }, (_, i) => article(provider, i + 1));

const err = (kind: ProviderError['kind'], message: string): ProviderError => ({ kind, message });

// plan maps feed id -> articles to return, or a ProviderError to fail with.
function rssStub(plan: Record<string, RawArticle[] | ProviderError>): CreateRss {
  return (feed) => {
    const id = `rss:${feed.id}`;
    return {
      id,
      async fetchRecent() {
        const outcome = plan[feed.id];
        if (outcome === undefined) return fail<RawArticle[]>(id, err('unknown', `no stub for ${feed.id}`));
        return Array.isArray(outcome) ? ok(id, outcome) : fail<RawArticle[]>(id, outcome);
      },
    };
  };
}

const topicOk = (id: string, articleCount: number): TopicStatus => ({ id, ok: true, articleCount, ms: 5 });
const topicFail = (id: string, error: ProviderError): TopicStatus => ({ id, ok: false, articleCount: 0, error, ms: 5 });
const gdeltStub = (result: GdeltRun): RunGdeltFn => async () => result;
const gdeltEmpty = gdeltStub({ articles: [], topics: [] });

describe('runAllSources', () => {
  it('combines every source and reports one row per feed and per GDELT topic', async () => {
    const gdelt: GdeltRun = {
      articles: articles('gdelt', 4),
      topics: [topicOk('conflict', 3), topicOk('economy', 1)],
    };
    const res = await runAllSources(
      {
        feeds: FEED_LIST,
        createRssProviderFn: rssStub({ a: articles('rss:a', 2), b: articles('rss:b', 3), c: articles('rss:c', 1) }),
        runGdeltFn: gdeltStub(gdelt),
      },
      RUN,
    );
    expect(res.articles).toHaveLength(10);
    expect(res.sources.map((s) => s.id)).toEqual(['rss:a', 'rss:b', 'rss:c', 'gdelt:conflict', 'gdelt:economy']);
    expect(res.sources.map((s) => s.articleCount)).toEqual([2, 3, 1, 3, 1]);
    expect(res.sources.every((s) => s.ok)).toBe(true);
  });

  it('reports one failed RSS feed honestly and keeps everything else', async () => {
    const res = await runAllSources(
      {
        feeds: FEED_LIST,
        createRssProviderFn: rssStub({ a: articles('rss:a', 2), b: err('rate_limit', 'HTTP 429'), c: articles('rss:c', 1) }),
        runGdeltFn: gdeltStub({ articles: articles('gdelt', 4), topics: [topicOk('conflict', 4)] }),
      },
      RUN,
    );
    expect(res.articles).toHaveLength(2 + 1 + 4);
    expect(res.articles.some((a) => a.provider === 'rss:b')).toBe(false);
    expect(res.sources.find((s) => s.id === 'rss:b')).toMatchObject({
      ok: false,
      articleCount: 0,
      error: { kind: 'rate_limit' },
    });
    expect(res.sources.filter((s) => s.ok)).toHaveLength(3);
  });

  it('still returns RSS when GDELT fails on every topic', async () => {
    const res = await runAllSources(
      {
        feeds: FEED_LIST,
        createRssProviderFn: rssStub({ a: articles('rss:a', 2), b: articles('rss:b', 2), c: articles('rss:c', 2) }),
        runGdeltFn: gdeltStub({
          articles: [],
          topics: [topicFail('conflict', err('network', 'down')), topicFail('economy', err('rate_limit', 'slow down'))],
        }),
      },
      RUN,
    );
    expect(res.articles).toHaveLength(6);
    expect(res.sources.filter((s) => s.id.startsWith('rss:')).every((s) => s.ok)).toBe(true);
    expect(res.sources.find((s) => s.id === 'gdelt:conflict')).toMatchObject({ ok: false, error: { kind: 'network' } });
    expect(res.sources.find((s) => s.id === 'gdelt:economy')).toMatchObject({ ok: false, error: { kind: 'rate_limit' } });
  });

  it('contains a GDELT crash and marks every configured topic failed', async () => {
    const res = await runAllSources(
      {
        feeds: FEED_LIST,
        createRssProviderFn: rssStub({ a: articles('rss:a', 1), b: articles('rss:b', 1), c: articles('rss:c', 1) }),
        gdelt: {
          topics: [
            { id: 'conflict', query: '(war OR attack)' },
            { id: 'world', query: '(world OR summit)' },
          ],
        },
        runGdeltFn: async () => {
          throw new Error('boom');
        },
      },
      RUN,
    );
    expect(res.articles).toHaveLength(3);
    const gdeltRows = res.sources.filter((s) => s.id.startsWith('gdelt:'));
    expect(gdeltRows.map((s) => s.id)).toEqual(['gdelt:conflict', 'gdelt:world']);
    expect(gdeltRows.every((s) => !s.ok && s.error?.message.includes('boom'))).toBe(true);
  });

  it('returns an empty list and a full failure report when every source fails (does not throw)', async () => {
    const res = await runAllSources(
      {
        feeds: FEED_LIST,
        createRssProviderFn: rssStub({
          a: err('network', 'timeout'),
          b: err('not_found', 'HTTP 404'),
          c: err('bad_response', 'not a feed'),
        }),
        runGdeltFn: gdeltStub({
          articles: [],
          topics: [topicFail('conflict', err('network', 'down')), topicFail('economy', err('network', 'down'))],
        }),
      },
      RUN,
    );
    expect(res.articles).toEqual([]);
    expect(res.sources).toHaveLength(5);
    expect(res.sources.every((s) => !s.ok && s.articleCount === 0 && s.error !== undefined)).toBe(true);
  });

  it('merges without dropping, adding, or deduplicating anything', async () => {
    const dupe = article('rss:shared', 1);
    const shared = [dupe, article('rss:shared', 2)];
    const gdeltArticles = [article('gdelt', 1), article('gdelt', 2), dupe];
    const res = await runAllSources(
      {
        feeds: FEED_LIST,
        createRssProviderFn: rssStub({ a: shared, b: shared, c: [] }),
        runGdeltFn: gdeltStub({ articles: gdeltArticles, topics: [topicOk('conflict', 3)] }),
      },
      RUN,
    );
    const rssCounted = res.sources.filter((s) => s.id.startsWith('rss:')).reduce((n, s) => n + s.articleCount, 0);
    expect(res.articles).toHaveLength(rssCounted + gdeltArticles.length);
    expect(res.articles).toHaveLength(7);
    // Duplicate URLs survive the merge: de-duplication is Task 5's job.
    expect(res.articles.filter((a) => a.url === dupe.url)).toHaveLength(3);
  });

  it('does not forward maxItems to either provider, but does forward sinceHours and signal', async () => {
    const ctrl = new AbortController();
    const rssRuns: unknown[] = [];
    let gdeltRun: unknown;
    const createRssProviderFn: CreateRss = (feed) => ({
      id: `rss:${feed.id}`,
      async fetchRecent(r) {
        rssRuns.push(r);
        return ok(`rss:${feed.id}`, articles(`rss:${feed.id}`, 2));
      },
    });
    const res = await runAllSources(
      {
        feeds: FEED_LIST,
        createRssProviderFn,
        runGdeltFn: async (_o, r) => {
          gdeltRun = r;
          return { articles: articles('gdelt', 2), topics: [topicOk('conflict', 2)] };
        },
      },
      { sinceHours: 6, maxItems: 1, signal: ctrl.signal },
    );
    expect(res.articles).toHaveLength(8);
    expect(rssRuns).toHaveLength(3);
    for (const r of [...rssRuns, gdeltRun]) {
      expect(r).toHaveProperty('sinceHours', 6);
      expect(r).toHaveProperty('signal', ctrl.signal);
      expect(r).not.toHaveProperty('maxItems');
    }
  });

  it('contains an RSS provider that throws instead of returning a result', async () => {
    const base = rssStub({ a: articles('rss:a', 2), b: [], c: articles('rss:c', 1) });
    const createRssProviderFn: CreateRss = (feed, o) =>
      feed.id === 'b'
        ? {
            id: 'rss:b',
            async fetchRecent(): Promise<never> {
              throw new Error('kaboom');
            },
          }
        : base(feed, o);
    const res = await runAllSources({ feeds: FEED_LIST, createRssProviderFn, runGdeltFn: gdeltEmpty }, RUN);
    expect(res.articles).toHaveLength(3);
    expect(res.sources.find((s) => s.id === 'rss:b')).toMatchObject({ ok: false, error: { kind: 'unknown' } });
  });

  it('starts every RSS feed before waiting on any of them', async () => {
    let started = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const createRssProviderFn: CreateRss = (feed) => ({
      id: `rss:${feed.id}`,
      async fetchRecent() {
        started += 1;
        await gate;
        return ok(`rss:${feed.id}`, []);
      },
    });
    const pending = runAllSources({ feeds: FEED_LIST, createRssProviderFn, runGdeltFn: gdeltEmpty }, RUN);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toBe(FEED_LIST.length);
    release();
    await pending;
  });
});
