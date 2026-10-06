// Provider contracts (brief v2 §5-§8, §34). Types and tiny helpers only; no network code lives here.
// The real fallback chains are built by P15; discovery providers by P08.
//
// THE RULE: a provider NEVER throws for an expected failure (rate limit, 404, timeout, bad JSON).
// It returns { ok: false, error }. Only programmer errors may throw.
// Owned by the Lead (Wave 0). Need a change? Ask the Lead.

export type ProviderErrorKind =
  | 'rate_limit' // 429
  | 'quota' // 402 / daily quota exhausted
  | 'overloaded' // 502 / 503 / 504
  | 'not_found' // 404 (e.g. dead model name)
  | 'auth' // 401 / 403 / missing key
  | 'network' // timeout, DNS, aborted
  | 'bad_response' // 200 but unusable / unparseable
  | 'unknown';

export interface ProviderError {
  kind: ProviderErrorKind;
  message: string;
  status?: number;
  retryAfterSeconds?: number;
}

export type ProviderResult<T> =
  | { ok: true; provider: string; data: T }
  | { ok: false; provider: string; error: ProviderError };

export function ok<T>(provider: string, data: T): ProviderResult<T> {
  return { ok: true, provider, data };
}

export function fail<T = never>(provider: string, error: ProviderError): ProviderResult<T> {
  return { ok: false, provider, error };
}

export function kindFromStatus(status: number): ProviderErrorKind {
  if (status === 429) return 'rate_limit';
  if (status === 402) return 'quota';
  if (status === 404) return 'not_found';
  if (status === 401 || status === 403) return 'auth';
  if (status === 502 || status === 503 || status === 504) return 'overloaded';
  return 'unknown';
}

// ---------- News discovery (P08) ----------

export interface RawArticle {
  url: string;
  title: string;
  publisher: string; // domain, e.g. "dw.com"
  publishedAt: string | null; // ISO
  snippet?: string;
  language?: string;
  country?: string;
  provider: string; // "gdelt" | "rss:<feed id>"
}

export interface NewsProvider {
  readonly id: string;
  fetchRecent(opts: {
    sinceHours: number;
    maxItems?: number;
    signal?: AbortSignal;
  }): Promise<ProviderResult<RawArticle[]>>;
}

// ---------- Web search (P15) ----------

export interface SearchHit {
  url: string;
  title: string;
  snippet?: string;
  publishedAt?: string | null;
  provider: string;
}

export interface SearchProvider {
  readonly id: string;
  search(
    query: string,
    opts?: { maxResults?: number; domains?: string[]; freshnessHours?: number; signal?: AbortSignal },
  ): Promise<ProviderResult<SearchHit[]>>;
}

// ---------- Full-text extraction (P15) ----------

export interface ExtractedContent {
  url: string;
  title?: string;
  text: string;
  fetchedAt: string; // ISO
  truncated: boolean;
}

export interface ExtractionProvider {
  readonly id: string;
  extract(url: string, opts?: { signal?: AbortSignal }): Promise<ProviderResult<ExtractedContent>>;
}

// ---------- AI (P15) ----------

export type AITask =
  | 'classify'
  | 'dedupe'
  | 'summarize'
  | 'rank'
  | 'research'
  | 'conflict'
  | 'script'
  | 'rewrite'
  | 'analyze';

export interface AIRequest {
  task: AITask;
  system: string;
  prompt: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface AICompletion {
  text: string;
  model: string;
}

export interface AIProvider {
  readonly id: string; // "gemini" | "groq" | "openrouter"
  complete(req: AIRequest): Promise<ProviderResult<AICompletion>>;
}

// ---------- Chains: what the app actually calls ----------

export interface ChainAttempt {
  provider: string;
  model?: string;
  ok: boolean;
  error?: ProviderError;
  ms: number;
}

/** Brief v2 §8: if every provider fails, say what was tried and why. Never fabricate output. */
export type ChainResult<T> =
  | { ok: true; provider: string; data: T; attempts: ChainAttempt[] }
  | { ok: false; message: string; attempts: ChainAttempt[] };

export interface AIService {
  run(req: AIRequest): Promise<ChainResult<AICompletion>>;
}
export interface SearchService {
  search(query: string, opts?: Parameters<SearchProvider['search']>[1]): Promise<ChainResult<SearchHit[]>>;
}
export interface ExtractionService {
  extract(url: string): Promise<ChainResult<ExtractedContent>>;
}

// ---------- Settings screen (P14 reads, P15 implements) ----------

export interface ProviderStatus {
  id: string;
  kind: 'news' | 'search' | 'extract' | 'ai' | 'media';
  label: string;
  /** true when every required env var is set. The VALUES are never exposed, only this flag. */
  configured: boolean;
  envVars: string[];
  model?: string;
}
