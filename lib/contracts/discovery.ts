// Handshake between "fetch articles" and "build stories". Do not edit.
import type { RawArticle } from './providers';

export interface SourceStatus {
  id: string;
  label: string;
  ok: boolean;
  articleCount: number;
  error?: string;
  ms?: number;
}
export interface FetchSourcesOptions {
  sinceHours: number;
  signal?: AbortSignal;
}
export interface FetchSourcesResult {
  articles: RawArticle[];
  sources: SourceStatus[];
}
export type FetchSources = (opts: FetchSourcesOptions) => Promise<FetchSourcesResult>;
export interface ScanSummary {
  articlesFetched: number;
  newStories: number;
  updatedStories: number;
  sources: SourceStatus[];
}
