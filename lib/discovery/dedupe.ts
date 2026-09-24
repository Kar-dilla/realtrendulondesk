import type { RawDiscoveredStory } from './discovery-source';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'of', 'to', 'for', 'and', 'or', 'is',
  'are', 'was', 'were', 'after', 'over', 'amid', 'as', 'with', 'from', 'by',
  'its', 'has', 'have', 'had', 'it', 'this', 'that', 'new', 'says', 'said',
]);

const SIMILARITY_THRESHOLD = 0.3;
const TIME_WINDOW_MS = 36 * 60 * 60 * 1000;

export interface DedupedStory extends RawDiscoveredStory {
  merged_from_count: number;
}

export function dedupeStories(raw: RawDiscoveredStory[]): DedupedStory[] {
  const groups: DedupedStory[] = [];

  for (const story of raw) {
    const match = groups.find((g) => sameEvent(g, story));
    if (match) {
      mergeInto(match, story);
    } else {
      groups.push({ ...story, source_urls: [...story.source_urls], merged_from_count: 1 });
    }
  }

  return groups;
}

function sameEvent(a: RawDiscoveredStory, b: RawDiscoveredStory): boolean {
  const sim = headlineSimilarity(a.headline, b.headline);
  if (sim < SIMILARITY_THRESHOLD) return false;

  if (a.event_time && b.event_time) {
    const dt = Math.abs(new Date(a.event_time).getTime() - new Date(b.event_time).getTime());
    if (dt > TIME_WINDOW_MS) return false;
  }

  return true;
}

function mergeInto(target: DedupedStory, addition: RawDiscoveredStory): void {
  for (const url of addition.source_urls) {
    if (!target.source_urls.includes(url)) target.source_urls.push(url);
  }
  if (addition.summary.length > target.summary.length) target.summary = addition.summary;
  if (!target.event_time && addition.event_time) target.event_time = addition.event_time;
  if (!target.category && addition.category) target.category = addition.category;
  target.merged_from_count += 1;
}

function headlineSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function stem(word: string): string {
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
}

function tokenize(headline: string): Set<string> {
  return new Set(
    headline
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map(stem)
  );
}

export function buildDedupeKey(story: RawDiscoveredStory | DedupedStory): string {
  const dateWindow = story.event_time
    ? story.event_time.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const normalizedHeadline = Array.from(tokenize(story.headline)).sort().join('-');
  return `${dateWindow}:${normalizedHeadline}`;
}
