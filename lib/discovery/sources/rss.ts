import { XMLParser } from 'fast-xml-parser';
import { domainFromUrl } from '../../format';
import { fail, kindFromStatus, ok } from '../../contracts/providers';
import type { NewsProvider, ProviderResult, RawArticle } from '../../contracts/providers';
import type { FeedConfig } from './feeds';

type Obj = Record<string, unknown>;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const get = (o: unknown, key: string): unknown => (isObj(o) ? o[key] : undefined);
const toArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();

function text(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return isObj(v) ? text(v['#text']) : '';
}

const ENTITIES: Array<[RegExp, string]> = [
  [/&nbsp;/g, ' '],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&amp;/g, '&'],
];

function snippetOf(item: Obj): string {
  for (const key of ['description', 'summary', 'content:encoded']) {
    const raw = text(item[key]).trim();
    if (!raw) continue;
    const noTags = raw.replace(/<[^>]*>/g, ' ');
    const clean = collapse(ENTITIES.reduce((s, [re, to]) => s.replace(re, to), noTags));
    if (clean) return clean.slice(0, 300);
  }
  return '';
}

function itemUrl(item: Obj): string {
  const links = toArray(item['link']);
  const alt = links.find(
    (l): l is Obj => isObj(l) && (l['@_rel'] === undefined || l['@_rel'] === 'alternate') && typeof l['@_href'] === 'string',
  );
  const guid = text(item['guid']).trim();
  return (alt ? text(alt['@_href']) : text(links[0]) || (guid.startsWith('http') ? guid : '')).trim();
}

function isoDate(item: Obj): string | null {
  for (const key of ['pubDate', 'dc:date', 'published', 'updated']) {
    const raw = text(item[key]).trim();
    if (!raw) continue;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

// null means "not a feed" (no rss, feed or rdf:RDF root); [] means a valid feed with no items.
function readItems(xml: string): unknown[] | null {
  try {
    const doc: unknown = parser.parse(xml);
    if (!isObj(doc)) return null;
    if ('rss' in doc) return toArray(get(get(doc['rss'], 'channel'), 'item'));
    if ('feed' in doc) return toArray(get(doc['feed'], 'entry'));
    if ('rdf:RDF' in doc) return toArray(get(doc['rdf:RDF'], 'item'));
    return null;
  } catch {
    return null;
  }
}

function buildArticles(items: unknown[], feed: FeedConfig): RawArticle[] {
  const seen = new Set<string>();
  const out: RawArticle[] = [];
  for (const item of items) {
    if (!isObj(item)) continue;
    const title = collapse(text(item['title']));
    const url = itemUrl(item);
    const publishedAt = isoDate(item);
    if (!title || !url.startsWith('http') || publishedAt === null || seen.has(url)) continue;
    seen.add(url);
    const snippet = snippetOf(item);
    out.push({
      url,
      title,
      publisher: domainFromUrl(url),
      publishedAt,
      ...(snippet ? { snippet } : {}),
      provider: `rss:${feed.id}`,
    });
  }
  return out;
}

export function parseFeed(xml: string, feed: FeedConfig): RawArticle[] {
  try {
    return buildArticles(readItems(xml) ?? [], feed);
  } catch {
    return [];
  }
}

export function createRssProvider(feed: FeedConfig, opts: { fetchFn?: typeof fetch; timeoutMs?: number } = {}): NewsProvider {
  const id = `rss:${feed.id}`;
  const timeoutMs = opts.timeoutMs ?? 10000;
  const headers = {
    'user-agent': 'TrendulonNewsroom/1.0',
    accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  };
  return {
    id,
    async fetchRecent({ sinceHours, signal }: { sinceHours: number; signal?: AbortSignal }): Promise<ProviderResult<RawArticle[]>> {
      const fetchFn = opts.fetchFn ?? fetch;
      const controller = new AbortController();
      const onAbort = (): void => controller.abort();
      signal?.addEventListener('abort', onAbort);
      if (signal?.aborted) controller.abort();
      const timer = setTimeout(onAbort, timeoutMs);
      try {
        let xml: string;
        try {
          const res = await fetchFn(feed.url, { signal: controller.signal, headers });
          if (res.status < 200 || res.status >= 300) {
            return fail(id, { kind: kindFromStatus(res.status), message: `HTTP ${res.status}`, status: res.status });
          }
          xml = await res.text();
        } catch {
          return fail(id, { kind: 'network', message: 'Could not reach the feed (network error or timeout)' });
        }
        const items = readItems(xml);
        if (items === null) return fail(id, { kind: 'bad_response', message: 'Response was not an RSS or Atom feed' });
        const now = Date.now();
        const min = now - sinceHours * 3600000;
        const max = now + 5 * 60000;
        const fresh = buildArticles(items, feed).filter((a) => {
          const t = a.publishedAt ? Date.parse(a.publishedAt) : NaN;
          return t >= min && t <= max;
        });
        return ok(id, fresh);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
    },
  };
}
