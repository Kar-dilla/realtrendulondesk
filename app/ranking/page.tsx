// app/ranking/page.tsx
//
// Replaces the /ranking placeholder. Displays the results of the most
// recent ranking run, sorted by fitScore descending — same pattern as
// Verification's page (shows the just-processed batch, not a persistent
// story browser; there is no GET /api/stories endpoint in this repo and
// none is needed here).

'use client';

import { useState } from 'react';
import { VerificationBadge } from '@/components/VerificationBadge';
import { sortByFitScoreDesc } from '@/lib/ranking-prompt';

interface RankedStory {
  id: string;
  headline: string;
  fitScore: number | null;
  editorialReason: string | null;
  fitRationale: string | null;
  verificationTier: 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'DISPUTED' | null;
  error?: string;
}

interface RunResponse {
  error: boolean;
  error_type?: string;
  message?: string;
  processed?: number;
  withReason?: number;
  noReason?: number;
  leftNull?: number;
  results?: RankedStory[];
}

const REASON_LABELS: Record<string, string> = {
  major_global_consequence: 'Major global consequence',
  significant_human_impact: 'Significant human impact',
  rapidly_developing_event: 'Rapidly developing event',
  underreported_event: 'Underreported event',
  important_policy_change: 'Important policy change',
  major_conflict_or_disaster: 'Major conflict or disaster',
  useful_explanation: 'Useful explanation',
  likely_to_be_misunderstood: 'Likely to be misunderstood',
};

const COLORS = {
  bg: '#0D0D0D',
  text: '#F2F2F2',
  accent: '#FF6A00',
  muted: '#8C8C8C',
  border: '#2A2A2A',
  card: '#161616',
};

export default function RankingPage() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pendingError, setPendingError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);

  async function fetchPendingCount() {
    try {
      const res = await fetch('/api/ranking/run');
      const data = await res.json();
      if (typeof data.pendingCount === 'number') {
        setPendingCount(data.pendingCount);
      } else {
        setPendingError(true);
      }
    } catch {
      setPendingError(true);
    }
  }

  async function runRanking() {
    setLoading(true);
    try {
      const res = await fetch('/api/ranking/run', { method: 'POST' });
      const data: RunResponse = await res.json();
      setRunResult(data);
      if (!data.error) await fetchPendingCount();
    } catch (err: any) {
      setRunResult({ error: true, error_type: 'network', message: err?.message ?? 'Request failed.' });
    } finally {
      setLoading(false);
    }
  }

  const sortedStories = runResult?.results ? sortByFitScoreDesc(runResult.results) : [];

  return (
    <main
      style={{
        background: COLORS.bg,
        color: COLORS.text,
        minHeight: '100vh',
        padding: '32px 24px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 840, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Ranking / Fit</h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 24 }}>
          Score each pending story against the Standard&apos;s editorial-reason rule.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: 16,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <button
            onClick={runRanking}
            disabled={loading}
            style={{
              background: COLORS.accent,
              color: '#0D0D0D',
              border: 'none',
              borderRadius: 6,
              padding: '10px 18px',
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Ranking…' : 'Rank Pending Stories'}
          </button>
          <span style={{ color: COLORS.muted, fontSize: 13 }}>
            {pendingError ? 'Could not load pending count.' : pendingCount === null ? 'Checking pending stories…' : `${pendingCount} pending`}
          </span>
        </div>

        {runResult?.error && (
          <div
            style={{
              padding: 16,
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              marginBottom: 24,
              color: '#EF4444',
              fontSize: 14,
            }}
          >
            Ranking run failed ({runResult.error_type ?? 'error'}): {runResult.message ?? 'Unknown error.'}
          </div>
        )}

        {runResult && !runResult.error && (
          <div style={{ marginBottom: 24, fontSize: 13, color: COLORS.muted }}>
            Processed {runResult.processed} · {runResult.withReason} with editorial reason ·{' '}
            {runResult.noReason} with none · {runResult.leftNull} left unscored
          </div>
        )}

        {sortedStories.length === 0 && runResult && !runResult.error && (
          <p style={{ color: COLORS.muted, fontSize: 14 }}>No pending stories to rank.</p>
        )}

        {sortedStories.map((story) => (
          <div
            key={story.id}
            style={{
              padding: 16,
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>{story.headline}</span>
              <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 15 }}>
                {story.fitScore ?? '—'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <VerificationBadge tier={story.verificationTier} />
              <span style={{ fontSize: 13, color: COLORS.muted }}>
                {story.editorialReason ? REASON_LABELS[story.editorialReason] ?? story.editorialReason : 'No clear editorial reason'}
              </span>
            </div>

            {story.fitRationale && <p style={{ fontSize: 13, color: COLORS.text, margin: 0 }}>{story.fitRationale}</p>}
            {story.error && <p style={{ fontSize: 13, color: '#EF4444', margin: 0 }}>{story.error}</p>}
          </div>
        ))}
      </div>
    </main>
  );
}
