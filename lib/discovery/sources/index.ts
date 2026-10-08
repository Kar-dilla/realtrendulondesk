import type { NewsProvider, ProviderError, RawArticle } from '../../contracts/providers';
import { FEEDS } from './feeds';
import type { FeedConfig } from './feeds';
import { runGdelt } from './gdelt';
import type { GdeltOptions, TopicStatus } from './gdelt';
import { createRssProvider } from './rss';
import { TOPICS } from './topics';

type RunOpts = Parameters<NewsProvider['fetchRecent']>[0];

// One row per RSS feed ("rss:<feed id>") and one row per GDELT topic ("gdelt:<topic id>").
// Same shape as GDELT's own TopicStatus: { id, ok, articleCount, error?, ms }.
export type SourceStatus = TopicStatus;

export interface AllSourcesOptions {
  feeds?: FeedConfig[];
  rss?: { fetchFn?: typeof fetch; timeoutMs?: number };
  gdelt?: GdeltOptions;
  // Test seams. Production code never sets these.
  createRssProviderFn?: typeof createRssProvider;
  runGdeltFn?: typeof runGdelt;
}

export interface AllSourcesResult {
  /** Every article from every source, concatenated. NOT deduplicated (Task 5). */
  articles: RawArticle[];
  /** One row per RSS feed and per GDELT topic, in that order. */
  sources: SourceStatus[];
}

interface Part {
  articles: RawArticle[];
  sources: SourceStatus[];
}

const errMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

async function runRssFeed(
  feed: FeedConfig,
  run: RunOpts,
  create: typeof createRssProvider,
  rssOpts: AllSourcesOptions['rss'],
): Promise<Part> {
  const id = `rss:${feed.id}`;
  const started = Date.now();
  try {
    const res = await create(feed, rssOpts).fetchRecent(run);
    const ms = Date.now() - started;
    if (res.ok) {
      return { articles: res.data, sources: [{ id, ok: true, articleCount: res.data.length, ms }] };
    }
    return { articles: [], sources: [{ id, ok: false, articleCount: 0, error: res.error, ms }] };
  } catch (err) {
    // Providers should never throw for expected failures. This only catches programmer errors,
    // so one broken feed still cannot take the whole run down.
    const error: ProviderError = { kind: 'unknown', message: `RSS provider threw: ${errMessage(err)}` };
    return { articles: [], sources: [{ id, ok: false, articleCount: 0, error, ms: Date.now() - started }] };
  }
}

async function runGdeltPart(opts: AllSourcesOptions, run: RunOpts): Promise<Part> {
  const gdeltOpts = opts.gdelt ?? {};
  const runGdeltFn = opts.runGdeltFn ?? runGdelt;
  try {
    const { articles, topics } = await runGdeltFn(gdeltOpts, run);
    return { articles, sources: topics.map((t) => ({ ...t, id: `gdelt:${t.id}` })) };
  } catch (err) {
    // runGdelt already reports per-topic failures itself. If it throws anyway, mark every
    // configured topic failed rather than collapsing GDELT into one row.
    const error: ProviderError = { kind: 'unknown', message: `GDELT run threw: ${errMessage(err)}` };
    const topics = gdeltOpts.topics ?? TOPICS;
    return {
      articles: [],
      sources: topics.map((t) => ({ id: `gdelt:${t.id}`, ok: false, articleCount: 0, error, ms: 0 })),
    };
  }
}

export async function runAllSources(opts: AllSourcesOptions, run: RunOpts): Promise<AllSourcesResult> {
  // maxItems is deliberately NOT forwarded. runGdelt would truncate its half but the RSS half ignores it,
  // so the combined list would be capped unevenly and per-source counts would no longer add up.
  // Capping belongs after dedup (Task 5).
  const sourceRun: RunOpts = {
    sinceHours: run.sinceHours,
    ...(run.signal ? { signal: run.signal } : {}),
  };
  const feeds = opts.feeds ?? FEEDS;
  const create = opts.createRssProviderFn ?? createRssProvider;

  // RSS feeds run in parallel with each other AND with GDELT. GDELT paces itself internally (~5 s between
  // topics), so starting RSS alongside it costs nothing and hides RSS latency behind GDELT's.
  const [rssParts, gdeltPart] = await Promise.all([
    Promise.all(feeds.map((feed) => runRssFeed(feed, sourceRun, create, opts.rss))),
    runGdeltPart(opts, sourceRun),
  ]);

  const articles = rssParts.flatMap((p) => p.articles).concat(gdeltPart.articles);
  const sources = rssParts.flatMap((p) => p.sources).concat(gdeltPart.sources);
  return { articles, sources };
}
