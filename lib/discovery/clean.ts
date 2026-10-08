// Task 4: per-article title cleaning + rule-based category. No AI, no cross-article comparison
// (grouping is Task 5, persistence Task 6). Pure functions, no network.

import type { RawArticle } from '../contracts/providers';
import { CATEGORY_KEYWORDS, MIN_MARGIN, MIN_SCORE } from './category-keywords';
import type { CategoryKeywords } from './category-keywords';
import { TOPICS } from './sources/topics';

export interface CleanedArticle extends RawArticle {
  /** Display-ready headline. `title` is left exactly as the source gave it. */
  cleanTitle: string;
  /** A topic id from TOPICS (GDELT's vocabulary), or null. Null means "not confident", never "forgot". */
  category: string | null;
}

export interface CleanOptions {
  /** Valid category ids. Defaults to the ids in TOPICS. Tests override it. */
  categories?: readonly string[];
  /** Keyword table. Defaults to CATEGORY_KEYWORDS. */
  keywords?: Record<string, CategoryKeywords>;
}

// ---------- title cleaning ----------

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d', ndash: '\u2013', mdash: '\u2014', hellip: '\u2026',
};

function decodeOnce(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match: string, body: string) => {
    if (body.startsWith('#')) {
      const hex = body.charAt(1).toLowerCase() === 'x';
      const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

// Two passes: feeds sometimes double-encode ("&amp;#39;").
const decodeEntities = (s: string): string => decodeOnce(decodeOnce(s));
const stripTags = (s: string): string => s.replace(/<\/?[a-z][^>]*>/gi, ' ');
const collapse = (s: string): string => s.replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
const wordCount = (s: string): number => s.split(' ').filter(Boolean).length;

const LEADING_TAG = /^(?:\[[^\]]{1,30}\]|\((?:video|photos?|watch|live|audio)\))\s*/i;
const LEADING_LABEL = /^(?:watch|video|photos?|live updates|live|breaking|just in)\s*[:|]\s*/i;

function stripLeadingTags(t: string): string {
  let out = t;
  for (let i = 0; i < 2; i++) {
    const next = out.replace(LEADING_TAG, '').replace(LEADING_LABEL, '');
    if (next === out) break;
    out = next;
  }
  return out;
}

const SEPARATORS = [' | ', ' - ', ' \u2013 ', ' \u2014 '];
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu']);
const OUTLET_SUFFIXES = new Set(['news', 'com', 'online', 'world', 'international', 'tv', 'radio', 'times', 'media', 'live']);

function normalizeName(s: string): string {
  const n = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return n.startsWith('the') && n.length > 5 ? n.slice(3) : n;
}

/** "bbc.co.uk" -> "bbc", "www.dw.com" -> "dw", "theguardian.com" -> "guardian". */
function publisherRoot(publisher: string): string {
  const host = (publisher.toLowerCase().replace(/^https?:\/\//, '').split('/')[0] ?? '').replace(/^www\./, '');
  const parts = host.split('.').filter(Boolean);
  if (parts.length > 1) parts.pop();
  if (parts.length > 1 && SECOND_LEVEL.has(parts[parts.length - 1] ?? '')) parts.pop();
  return normalizeName(parts[parts.length - 1] ?? '');
}

function matchesPublisher(segment: string, root: string): boolean {
  if (root.length < 2) return false;
  const n = normalizeName(segment);
  if (n === root) return true;
  return n.startsWith(root) && OUTLET_SUFFIXES.has(n.slice(root.length));
}

/** Short, every word capitalised, no sentence punctuation: shaped like "World News" or "The Guardian". */
function looksLikeOutlet(segment: string): boolean {
  return segment.length <= 40 && !/[.!?:;]$/.test(segment) && segment.split(' ').every((w) => /^[A-Z0-9]/.test(w));
}

function stripPublisherPrefix(t: string, root: string): string {
  if (!root) return t;
  let cut = -1;
  let sepLen = 0;
  for (const sep of SEPARATORS) {
    const i = t.indexOf(sep);
    if (i > 0 && (cut === -1 || i < cut)) {
      cut = i;
      sepLen = sep.length;
    }
  }
  if (cut === -1) return t;
  const rest = t.slice(cut + sepLen).trim();
  return rest && matchesPublisher(t.slice(0, cut), root) ? rest : t;
}

function stripSuffix(t: string, root: string): string {
  let cut = -1;
  let sep = '';
  for (const s of SEPARATORS) {
    const i = t.lastIndexOf(s);
    if (i > cut) {
      cut = i;
      sep = s;
    }
  }
  if (cut <= 0) return t;
  const head = t.slice(0, cut).trim();
  const tail = t.slice(cut + sep.length).trim();
  if (!head || !tail) return t;
  if (matchesPublisher(tail, root)) return head; // high confidence: the suffix is this article's own outlet
  // Lower confidence: guess from shape. Conservative on purpose, a wrongly chopped headline is silent damage.
  if (sep === ' | ') return wordCount(head) >= 3 && wordCount(tail) <= 6 ? head : t;
  return wordCount(head) >= 4 && wordCount(tail) <= 3 && looksLikeOutlet(tail) ? head : t;
}

const ACRONYMS = new Set([
  'US', 'USA', 'UK', 'UN', 'EU', 'AU', 'UAE', 'NATO', 'IMF', 'OPEC', 'FBI', 'CIA', 'BBC', 'CNN', 'NHS',
  'UNICEF', 'UNESCO', 'ECOWAS', 'FIFA', 'NYSE', 'GDP', 'CEO', 'COVID', 'HIV', 'AIDS', 'AI', 'EV', 'TV', 'PM',
]);
const SMALL = new Set(['a', 'an', 'the', 'in', 'on', 'of', 'to', 'for', 'and', 'or', 'at', 'by', 'as', 'vs', 'from', 'with', 'but', 'nor']);

/** Only touches titles with NO lowercase letters at all. Mixed-case titles are left alone. */
function fixAllCaps(t: string): string {
  if (/[a-z]/.test(t) || t.replace(/[^A-Za-z]/g, '').length < 8) return t;
  let first = true;
  return t.replace(/[A-Za-z][A-Za-z'\u2019]*/g, (w: string) => {
    const isFirst = first;
    first = false;
    if (ACRONYMS.has(w)) return w;
    const lower = w.toLowerCase();
    if (!isFirst && SMALL.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

/** Exported for tests. Production callers use cleanArticles. */
export function cleanTitle(raw: string, publisher = ''): string {
  const original = collapse(raw);
  const root = publisherRoot(publisher);
  let t = collapse(stripTags(decodeEntities(raw)));
  t = stripLeadingTags(t);
  t = stripPublisherPrefix(t, root);
  t = stripSuffix(t, root);
  t = fixAllCaps(collapse(t));
  return t || original; // never return an empty title
}

// ---------- categorisation ----------

const normalizeText = (s: string): string =>
  s.toLowerCase().replace(/[\u2019]/g, "'").replace(/[-\u2010\u2011\u2013\u2014]/g, ' ').replace(/\s+/g, ' ').trim();

const matcherCache = new Map<string, RegExp>();
function matcher(keyword: string): RegExp {
  let re = matcherCache.get(keyword);
  if (!re) {
    const escaped = normalizeText(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`(?<![a-z0-9])${escaped}(?:s|es)?(?![a-z0-9])`);
    matcherCache.set(keyword, re);
  }
  return re;
}

function keywordCategory(
  title: string,
  snippet: string | undefined,
  vocab: ReadonlySet<string>,
  table: Record<string, CategoryKeywords>,
): string | null {
  const t = normalizeText(title);
  const s = normalizeText(snippet ?? '');
  const scores: Array<[string, number]> = [];

  for (const [category, kws] of Object.entries(table)) {
    if (!vocab.has(category)) continue; // not in GDELT's vocabulary, never emit it
    let score = 0;
    for (const kw of kws.strong) {
      const re = matcher(kw);
      if (re.test(t)) score += 3;
      else if (re.test(s)) score += 2;
    }
    for (const kw of kws.weak) {
      const re = matcher(kw);
      if (re.test(t) || re.test(s)) score += 1;
    }
    if (score > 0) scores.push([category, score]);
  }

  scores.sort((a, b) => b[1] - a[1]);
  const top = scores[0];
  if (!top || top[1] < MIN_SCORE) return null;
  const runnerUp = scores[1]?.[1] ?? 0;
  return top[1] - runnerUp >= MIN_MARGIN ? top[0] : null;
}

const GDELT_PREFIX = 'gdelt:';

function categoryFor(
  article: RawArticle,
  title: string,
  vocab: ReadonlySet<string>,
  table: Record<string, CategoryKeywords>,
): string | null {
  // GDELT's topic is trusted as-is, never re-derived from the words.
  if (article.provider.startsWith(GDELT_PREFIX)) {
    const topic = article.provider.slice(GDELT_PREFIX.length);
    if (vocab.has(topic)) return topic;
  }
  // RSS, or a GDELT article that carries no usable topic tag: keywords, and null when unsure.
  return keywordCategory(title, article.snippet, vocab, table);
}

export function cleanArticles(articles: RawArticle[], opts: CleanOptions = {}): CleanedArticle[] {
  const vocab: ReadonlySet<string> = new Set(opts.categories ?? TOPICS.map((t) => String(t.id)));
  const table = opts.keywords ?? CATEGORY_KEYWORDS;
  return articles.map((article) => {
    const clean = cleanTitle(article.title, article.publisher);
    return { ...article, cleanTitle: clean, category: categoryFor(article, clean, vocab, table) };
  });
}
