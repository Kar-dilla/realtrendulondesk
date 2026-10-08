import { domainFromUrl } from '../../format';
import { fail, kindFromStatus, ok } from '../../contracts/providers';
import type { NewsProvider, ProviderError, ProviderResult, RawArticle } from '../../contracts/providers';
import { GDELT_LANGUAGE, GDELT_MAX_RECORDS, GDELT_MIN_GAP_MS, TOPICS } from './topics';
import type { TopicConfig } from './topics';

const ENDPOINT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const ID = 'gdelt';

type Obj = Record<string, unknown>;
type RunOpts = Parameters<NewsProvider['fetchRecent']>[0];

export interface GdeltOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  topics?: TopicConfig[];
  maxRecords?: number;
  minGapMs?: number;
  backoffMs?: number;
  sleepFn?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface TopicStatus {
  id: string;
  ok: boolean;
  articleCount: number;
  error?: ProviderError;
  ms: number;
}

export interface GdeltRun {
  articles: RawArticle[];
  topics: TopicStatus[];
}

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function seenToIso(raw: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(raw);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseArticles(json: unknown): RawArticle[] {
  const raw: unknown = isObj(json) ? json['articles'] : undefined;
  const list: unknown[] = Array.isArray(raw) ? raw : [];
  const out: RawArticle[] = [];
  for (const a of list) {
    if (!isObj(a)) continue;
    const url = str(a['url']);
    const title = collapse(str(a['title']));
    const publishedAt = seenToIso(str(a['seendate']));
    if (!title || !url.startsWith('http') || publishedAt === null) continue;
    const language = str(a['language']);
    if (language && language.toLowerCase() !== GDELT_LANGUAGE) continue;
    const country = str(a['sourcecountry']);
    out.push({
      url,
      title,
      publisher: domainFromUrl(url),
      publishedAt,
      ...(language ? { language } : {}),
      ...(country ? { country } : {}),
      provider: ID,
    });
  }
  return out;
}

// GDELT answers some bad queries (and rate limits) with plain text, sometimes with HTTP 200.
// An empty body or {} means "no articles", which is not an error.
export function parseGdeltBody(body: string): ProviderResult<RawArticle[]> {
  const trimmed = body.trim();
  if (!trimmed) return ok(ID, []);
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    if (/limit requests/i.test(trimmed)) {
      return fail(ID, { kind: 'rate_limit', message: 'GDELT asked us to slow down (1 request per 5 seconds)' });
    }
    return fail(ID, { kind: 'bad_response', message: `GDELT did not return JSON: ${collapse(trimmed).slice(0, 100)}` });
  }
  if (!isObj(json)) return fail(ID, { kind: 'bad_response', message: 'GDELT returned an unexpected JSON shape' });
  return ok(ID, parseArticles(json));
}

const defaultSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve();
    const done = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done);
  });

interface Cfg {
  fetchFn: typeof fetch;
  timeoutMs: number;
  maxRecords: number;
  backoffMs: number;
}

async function queryTopic(topic: TopicConfig, sinceHours: number, cfg: Cfg, signal?: AbortSignal): Promise<ProviderResult<RawArticle[]>> {
  const url = new URL(ENDPOINT);
  const params: Record<string, string> = {
    query: `${topic.query} sourcelang:${GDELT_LANGUAGE}`,
    mode: 'artlist',
    format: 'json',
    sort: 'datedesc',
    timespan: `${Math.max(1, Math.ceil(sinceHours))}h`,
    maxrecords: String(cfg.maxRecords),
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  signal?.addEventListener('abort', onAbort);
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(onAbort, cfg.timeoutMs);
  try {
    const res = await cfg.fetchFn(url.toString(), {
      signal: controller.signal,
      headers: { 'user-agent': 'TrendulonNewsroom/1.0', accept: 'application/json, text/plain, */*' },
    });
    if (res.status < 200 || res.status >= 300) {
      const kind = kindFromStatus(res.status);
      const retry = kind === 'rate_limit' ? { retryAfterSeconds: Math.ceil(cfg.backoffMs / 1000) } : {};
      return fail(ID, { kind, message: `HTTP ${res.status}`, status: res.status, ...retry });
    }
    return parseGdeltBody(await res.text());
  } catch {
    return fail(ID, { kind: 'network', message: 'Could not reach GDELT (network error or timeout)' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// Runs the topic queries one at a time, never overlapping, at least minGapMs apart.
// After a 429 the next query waits backoffMs instead. A failed topic never stops the run.
export async function runGdelt(opts: GdeltOptions, run: RunOpts): Promise<GdeltRun> {
  const cfg: Cfg = {
    fetchFn: opts.fetchFn ?? fetch,
    timeoutMs: opts.timeoutMs ?? 10000,
    maxRecords: opts.maxRecords ?? GDELT_MAX_RECORDS,
    backoffMs: opts.backoffMs ?? 30000,
  };
  const minGapMs = opts.minGapMs ?? GDELT_MIN_GAP_MS;
  const sleep = opts.sleepFn ?? defaultSleep;
  const seen = new Set<string>();
  const articles: RawArticle[] = [];
  const topics: TopicStatus[] = [];
  let first = true;
  let lastStart = 0;
  let gap = minGapMs;
  for (const topic of opts.topics ?? TOPICS) {
    if (run.signal?.aborted) break;
    if (!first) await sleep(Math.max(0, gap - (Date.now() - lastStart)), run.signal);
    if (run.signal?.aborted) break;
    first = false;
    gap = minGapMs;
    lastStart = Date.now();
    const res = await queryTopic(topic, run.sinceHours, cfg, run.signal);
    const ms = Date.now() - lastStart;
    if (res.ok) {
      for (const a of res.data) {
        if (seen.has(a.url)) continue;
        seen.add(a.url);
        articles.push(a);
      }
      topics.push({ id: topic.id, ok: true, articleCount: res.data.length, ms });
    } else {
      topics.push({ id: topic.id, ok: false, articleCount: 0, error: res.error, ms });
      if (res.error.kind === 'rate_limit') gap = cfg.backoffMs;
    }
  }
  return { articles: run.maxItems === undefined ? articles : articles.slice(0, run.maxItems), topics };
}

// ok:true when at least one topic query worked. Use runGdelt to see which topics failed.
export function createGdeltProvider(opts: GdeltOptions = {}): NewsProvider {
  return {
    id: ID,
    async fetchRecent(run: RunOpts): Promise<ProviderResult<RawArticle[]>> {
      const { articles, topics } = await runGdelt(opts, run);
      if (topics.some((t) => t.ok)) return ok(ID, articles);
      const first = topics[0]?.error;
      if (!first) return fail(ID, { kind: 'network', message: 'GDELT run was cancelled before any query ran' });
      return fail(ID, { ...first, message: `All ${topics.length} GDELT topic queries failed. First error: ${first.message}` });
    },
  };
}
