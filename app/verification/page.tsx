'use client';

import { useEffect, useState } from 'react';
import { VerificationBadge } from '@/components/VerificationBadge';

type Tier = 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'DISPUTED';

interface ClaimResult {
  claim: string;
  tier: Tier;
  evidence: string | null;
}

interface StoryResult {
  storyId: string;
  headline: string;
  tier: Tier | null;
  reason: string | null;
  claims: ClaimResult[];
}

interface RunResponse {
  error: boolean;
  error_type?: string;
  message?: string;
  processed?: number;
  claims_tiered?: number;
  left_null?: number;
  left_null_breakdown?: { model_failure: number; unclassifiable_content: number; db_write_failed: number };
  results?: StoryResult[];
}

const COLORS = {
  bg: '#0D0D0D',
  text: '#F2F2F2',
  accent: '#FF6A00',
  muted: '#8C8C8C',
  border: '#2A2A2A',
  card: '#161616',
};

function reasonLabel(reason: string | null): string {
  switch (reason) {
    case 'no_classifiable_claims':
      return 'No classifiable claims found — content was too thin to verify.';
    case 'db_write_failed':
      return 'Claims were classified but could not be saved. Left unverified — try running again.';
    case 'rate_limit':
      return 'Verification could not run (Groq rate limit hit).';
    case 'missing_api_key':
      return 'Verification could not run (GROQ_API_KEY is not configured).';
    case 'timeout':
      return 'Verification could not run (request to Groq timed out).';
    case 'malformed_response':
      return 'Verification could not run (model output was not usable).';
    default:
      return `Verification could not run for this story (${reason ?? 'unknown failure'}).`;
  }
}

export default function VerificationPage() {
  const [pending, setPending] = useState<number | null>(null);
  const [pendingError, setPendingError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/verification/run')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (typeof data.pending === 'number') {
          setPending(data.pending);
        } else {
          setPendingError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setPendingError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRun() {
    setLoading(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/verification/run', { method: 'POST' });
      const data: RunResponse = await res.json();
      setRunResult(data);
      if (!data.error) setPending(0);
    } catch (err: any) {
      setRunResult({ error: true, error_type: 'network', message: err?.message ?? 'Request failed.' });
    } finally {
      setLoading(false);
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
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Verification</h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 24 }}>
          Break each pending story down into claims and tier them against sources.
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
            onClick={handleRun}
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
            {loading ? 'Verifying…' : 'Verify New Stories'}
          </button>
          <span style={{ color: COLORS.muted, fontSize: 13 }}>
            {pendingError ? 'Could not load pending count.' : pending === null ? 'Checking pending stories…' : `${pending} pending`}
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
            Verification run failed ({runResult.error_type ?? 'error'}): {runResult.message ?? 'Unknown error.'}
          </div>
        )}

        {runResult && !runResult.error && (
          <div style={{ marginBottom: 24, fontSize: 13, color: COLORS.muted }}>
            Processed {runResult.processed} · {runResult.claims_tiered} claims tiered · {runResult.left_null} left unverified
            {runResult.left_null_breakdown && (runResult.left_null ?? 0) > 0 && (
              <span>
                {' '}
                (model failures: {runResult.left_null_breakdown.model_failure}, unclassifiable content:{' '}
                {runResult.left_null_breakdown.unclassifiable_content}, save failures:{' '}
                {runResult.left_null_breakdown.db_write_failed})
              </span>
            )}
          </div>
        )}

        {runResult && !runResult.error && runResult.results && runResult.results.length === 0 && (
          <p style={{ color: COLORS.muted, fontSize: 14 }}>No pending stories to verify.</p>
        )}

        {runResult?.results?.map((story) => (
          <div
            key={story.storyId}
            style={{
              padding: 16,
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <VerificationBadge tier={story.tier} />
              <span style={{ fontSize: 15, fontWeight: 500 }}>{story.headline}</span>
            </div>

            {story.tier === null && (
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 8 }}>{reasonLabel(story.reason)}</p>
            )}

            {story.claims.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {story.claims.map((claim, i) => (
                  <div key={i} style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <VerificationBadge tier={claim.tier} />
                      <span style={{ fontSize: 13 }}>{claim.claim}</span>
                    </div>
                    {claim.evidence && <p style={{ color: COLORS.muted, fontSize: 12, marginLeft: 2 }}>{claim.evidence}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
