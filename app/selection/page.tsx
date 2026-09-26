// app/selection/page.tsx
//
// Module 05 — Editorial Selection. Shows every story that has cleared
// Ranking (fitScore not null), sorted by fitScore descending, no cutoff.
// Owner filters by tier/min score in the UI. Matches the COLORS/layout
// convention from app/ranking/page.tsx.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { VerificationBadge } from '@/components/VerificationBadge';

interface SelectableStory {
  id: string;
  headline: string;
  summary: string;
  fitScore: number;
  verificationTier: 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'DISPUTED' | null;
  editorialReason: string | null;
  fitRationale: string | null;
  selectedForPipeline: boolean;
  selectedAt: string | null;
}

// Duplicated from app/ranking/page.tsx intentionally — both pages render the
// same categorical editorialReason values. This is a small display constant,
// not logic worth extracting into a cross-module shared dependency.
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

const ALL_TIERS = ['CONFIRMED', 'REPORTED', 'UNVERIFIED', 'DISPUTED'] as const;

export default function SelectionPage() {
  const [stories, setStories] = useState<SelectableStory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<Set<string>>(new Set(ALL_TIERS));
  const [minFitScore, setMinFitScore] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/selection');
        const data = await res.json();
        if (!res.ok || data.error) {
          if (!cancelled) setLoadError(data.message ?? 'Failed to load stories.');
          return;
        }
        if (!cancelled) setStories(data.stories ?? []);
      } catch {
        if (!cancelled) setLoadError('Failed to load stories.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!stories) return [];
    return stories.filter((s) => {
      const tierOk = s.verificationTier ? tierFilter.has(s.verificationTier) : true;
      return tierOk && s.fitScore >= minFitScore;
    });
  }, [stories, tierFilter, minFitScore]);

  function toggleTier(tier: string) {
    setTierFilter((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  }

  async function handleSelect(storyId: string) {
    setSelectError(null);
    setSelectingId(storyId);
    try {
      const res = await fetch('/api/selection/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSelectError(data.message ?? 'Failed to select the story.');
        return;
      }
      setStories((prev) =>
        prev
          ? prev.map((s) =>
              s.id === storyId ? { ...s, selectedForPipeline: true, selectedAt: data.story.selectedAt } : s
            )
          : prev
      );
    } catch {
      setSelectError('Failed to select the story.');
    } finally {
      setSelectingId(null);
    }
  }

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
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Selection</h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 24 }}>
          Every story that has cleared Ranking, sorted by fit score. No cutoff — filter below to narrow it.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 24,
            alignItems: 'flex-start',
            padding: 16,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 6 }}>Verification tier</div>
            {ALL_TIERS.map((tier) => (
              <label key={tier} style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={tierFilter.has(tier)}
                  onChange={() => toggleTier(tier)}
                  style={{ marginRight: 6 }}
                />
                {tier}
              </label>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 6 }}>Minimum fit score</div>
            <input
              type="number"
              value={minFitScore}
              onChange={(e) => setMinFitScore(Number(e.target.value) || 0)}
              style={{
                background: COLORS.bg,
                color: COLORS.text,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                padding: '6px 10px',
                width: 80,
              }}
            />
          </div>
        </div>

        {loadError && (
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
            {loadError}
          </div>
        )}

        {selectError && (
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
            {selectError}
          </div>
        )}

        {!stories && !loadError && <p style={{ color: COLORS.muted, fontSize: 14 }}>Loading…</p>}

        {stories && filtered.length === 0 && (
          <p style={{ color: COLORS.muted, fontSize: 14 }}>No stories match the current filters.</p>
        )}

        {filtered.map((story) => (
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
              <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 15 }}>{story.fitScore}</span>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <VerificationBadge tier={story.verificationTier} />
              <span style={{ fontSize: 13, color: COLORS.muted }}>
                {story.editorialReason
                  ? REASON_LABELS[story.editorialReason] ?? story.editorialReason
                  : 'No clear editorial reason'}
              </span>
            </div>

            <p style={{ fontSize: 13, color: COLORS.text, margin: '0 0 8px' }}>{story.summary}</p>
            {story.fitRationale && <p style={{ fontSize: 13, color: COLORS.text, margin: 0 }}>{story.fitRationale}</p>}

            <div style={{ marginTop: 12 }}>
              {story.selectedForPipeline ? (
                <span style={{ fontSize: 13, color: COLORS.accent, fontWeight: 600 }}>Selected</span>
              ) : (
                <button
                  onClick={() => handleSelect(story.id)}
                  disabled={selectingId === story.id}
                  style={{
                    background: COLORS.accent,
                    color: '#0D0D0D',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontWeight: 600,
                    cursor: selectingId === story.id ? 'default' : 'pointer',
                    opacity: selectingId === story.id ? 0.6 : 1,
                  }}
                >
                  {selectingId === story.id ? 'Selecting…' : 'Select'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
