// Shared formatting helpers. Pure functions, safe in server and client code.
// Owned by the Lead (Wave 0). Need a change? Ask the Lead, don't edit.

import type { PriorityLevel } from './contracts/newsroom';

/** Score at or above this is "high priority". Placeholder until Editorial Standards (P13) makes it configurable. */
export const PRIORITY_HIGH_MIN = 60;
/** Score at or above this (and below HIGH) is "medium priority". */
export const PRIORITY_MEDIUM_MIN = 40;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 9.94 -> "9.9". null / NaN -> "—". */
export function formatScore(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(1);
}

/** ISO timestamp -> "11 hours ago". Bad or missing input -> "—". */
export function timeAgo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (seconds < 45) return 'just now';
  if (seconds < 3600) {
    const m = Math.max(1, Math.floor(seconds / 60));
    return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  }
  const d = Math.floor(seconds / 86400);
  return `${d} ${d === 1 ? 'day' : 'days'} ago`;
}

/** "https://www.dw.com/en/x" -> "dw.com". Unparseable input is returned unchanged. */
export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function priorityFromScore(score: number | null | undefined): PriorityLevel {
  if (score === null || score === undefined || Number.isNaN(score)) return 'low';
  if (score >= PRIORITY_HIGH_MIN) return 'high';
  if (score >= PRIORITY_MEDIUM_MIN) return 'medium';
  return 'low';
}

export function pluralize(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : many ?? one + 's'}`;
}
