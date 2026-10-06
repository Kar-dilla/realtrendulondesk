// app/research/page.tsx
//
// Module 06 v2 — Deep Research Engine. Two real, honestly-reported stages:
// Find Sources (Stage 1 / Research Engine) then Build Research Brief
// (Stage 2 / Research Analyst). The progress indicator reflects the story's
// actual persisted researchStatus, not a canned animation — a stage is only
// ever shown as done because the corresponding request actually completed.

'use client';

import { useEffect, useState } from 'react';
import { VerificationBadge, BadgeTier } from '@/components/VerificationBadge';

interface VerifiedClaimRow {
  id: string;
  claim: string;
  tier: BadgeTier;
  evidence: string | null;
}

interface SourcedItem {
  text: string;
  source_url: string | null;
  source_name: string | null;
  published_date: string | null;
}

interface TimelineEntry {
  date: string | null;
  event: string;
  source_url: string | null;
}

interface DisputedClaim {
  claim: string;
  claimed_by: string | null;
  disputed_by: string | null;
  evidence: string;
  unresolved: string;
}

interface ResearchBrief {
  overview: string;
  confirmed: SourcedItem[];
  developing: SourcedItem[];
  not_confirmed: SourcedItem[];
  timeline: TimelineEntry[];
  disputed_claims: DisputedClaim[];
  background: string;
  why_it_matters: string;
  open_questions: string[];
}

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  published_date: string | null;
}

type ResearchStatus = 'idle' | 'searching' | 'searched' | 'synthesizing' | 'synthesized' | 'complete' | 'failed' | null;

interface SelectedStory {
  id: string;
  headline: string;
  summary: string;
  verifiedClaims: VerifiedClaimRow[];
  researchStatus: ResearchStatus;
  researchError: string | null;
  researchInstructions: string | null;
  searchResults: TavilySearchResult[] | null;
  researchBrief: ResearchBrief | null;
  researchedAt: string | null;
}

interface ApiError {
  error: true;
  error_type: string;
  message: string;
}

const COLORS = {
  bg: '#0D0D0D',
  text: '#F2F2F2',
  accent: '#FF6A00',
  muted: '#8C8C8C',
  border: '#2A2A2A',
  card: '#161616',
};

const STATUS_LABEL: Record<string, string> = {
  idle: 'Not started',
  searching: 'Finding sources…',
  searched: 'Sources found — ready to build brief',
  synthesizing: 'Building brief…',
  complete: 'Finalized — sent to Script Generation',
  failed: 'Failed',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  marginBottom: 8,
  background: COLORS.bg,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
};

const cardStyle: React.CSSProperties = {
  padding: 16,
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  marginBottom: 20,
};

const buttonStyle = (disabled: boolean, primary = false): React.CSSProperties => ({
  background: primary ? COLORS.accent : COLORS.card,
  color: primary ? '#0D0D0D' : COLORS.text,
  border: primary ? 'none' : `1px solid ${COLORS.border}`,
  borderRadius: 6,
  padding: '9px 16px',
  fontSize: 13,
  fontWeight: primary ? 600 : 500,
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  marginRight: 8,
});

function briefToPlainText(brief: ResearchBrief): string {
  const lines: string[] = [];
  const src = (u: string | null) => (u ? ` (${u})` : ' (could not be independently verified)');

  lines.push('OVERVIEW', brief.overview, '');
  lines.push('CONFIRMED');
  brief.confirmed.forEach((i) => lines.push(`- ${i.text}${src(i.source_url)}`));
  lines.push('', 'DEVELOPING');
  brief.developing.forEach((i) => lines.push(`- ${i.text}${src(i.source_url)}`));
  lines.push('', 'NOT CONFIRMED');
  brief.not_confirmed.forEach((i) => lines.push(`- ${i.text}${src(i.source_url)}`));
  lines.push('', 'TIMELINE');
  brief.timeline.forEach((t) => lines.push(`- ${t.date ?? 'date unknown'}: ${t.event}${t.source_url ? ` (${t.source_url})` : ''}`));
  lines.push('', 'DISPUTED CLAIMS');
  brief.disputed_claims.forEach((d) => {
    lines.push(`- Claim: ${d.claim}`);
    lines.push(`  Claimed by: ${d.claimed_by ?? 'unknown'}`);
    lines.push(`  Disputed by: ${d.disputed_by ?? 'unknown'}`);
    lines.push(`  Evidence: ${d.evidence}`);
    lines.push(`  Unresolved: ${d.unresolved}`);
  });
  lines.push('', 'BACKGROUND', brief.background, '');
  lines.push('WHY IT MATTERS', brief.why_it_matters, '');
  lines.push('OPEN QUESTIONS');
  brief.open_questions.forEach((q) => lines.push(`- ${q}`));

  return lines.join('\n');
}

function SourcedItemRow({ item }: { item: SourcedItem }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={{ fontSize: 13, color: COLORS.text }}>{item.text}</span>{' '}
      {item.source_url ? (
        <a href={item.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: COLORS.accent }}>
          {item.source_name ?? 'source'}
        </a>
      ) : (
        <span style={{ fontSize: 12, color: COLORS.muted, fontStyle: 'italic' }}>could not be independently verified</span>
      )}
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <details style={{ ...cardStyle, marginBottom: 12 }} open>
      <summary style={{ fontSize: 14, color, cursor: 'pointer', fontWeight: 600 }}>{title}</summary>
      <div style={{ marginTop: 12 }}>{children}</div>
    </details>
  );
}

export default function ResearchPage() {
  const [story, setStory] = useState<SelectedStory | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [instructions, setInstructions] = useState('');
  const [topicKey, setTopicKey] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<ApiError | null>(null);

  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesizeError, setSynthesizeError] = useState<ApiError | null>(null);

  const [finalizing, setFinalizing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSelected();
  }, []);

  async function fetchSelected() {
    try {
      const res = await fetch('/api/research/selected');
      const data = await res.json();
      const s: SelectedStory | null = data.story ?? null;
      setStory(s);
      if (s?.researchInstructions) setInstructions(s.researchInstructions);
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to load selected story.');
      setStory(null);
    }
  }

  async function fetchNoteForKey(key: string) {
    if (!key.trim()) return;
    try {
      const res = await fetch(`/api/research/topic-notes?topicKey=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (!data.error && data.note) setNoteText(data.note.note);
    } catch {
      // Best-effort pre-fill only.
    }
  }

  async function saveNote() {
    if (!topicKey.trim()) return;
    setNoteSaving(true);
    setNoteSaved(false);
    try {
      const res = await fetch('/api/research/topic-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicKey, note: noteText }),
      });
      const data = await res.json();
      if (!data.error) setNoteSaved(true);
    } finally {
      setNoteSaving(false);
    }
  }

  async function runSearch() {
    if (!story) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch('/api/research/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: story.id }),
      });
      const data = await res.json();
      if (data.error) {
        setSearchError(data);
        setStory({ ...story, researchStatus: 'failed', researchError: data.message });
      } else {
        setStory({ ...story, searchResults: data.results, researchStatus: data.researchStatus });
      }
    } catch (err: any) {
      setSearchError({ error: true, error_type: 'network', message: err?.message ?? 'Request failed.' });
    } finally {
      setSearching(false);
    }
  }

  async function runSynthesize() {
    if (!story) return;
    setSynthesizing(true);
    setSynthesizeError(null);
    try {
      const res = await fetch('/api/research/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: story.id,
          instructions: instructions.trim() || undefined,
          topicKey: topicKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSynthesizeError(data);
        setStory({ ...story, researchStatus: 'failed', researchError: data.message });
      } else {
        setStory({
          ...story,
          researchBrief: data.brief,
          researchedAt: data.researchedAt,
          researchStatus: data.researchStatus,
        });
      }
    } catch (err: any) {
      setSynthesizeError({ error: true, error_type: 'network', message: err?.message ?? 'Request failed.' });
    } finally {
      setSynthesizing(false);
    }
  }

  async function finalize() {
    if (!story) return;
    setFinalizing(true);
    try {
      const res = await fetch('/api/research/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: story.id }),
      });
      const data = await res.json();
      if (!data.error) setStory({ ...story, researchStatus: data.researchStatus });
    } finally {
      setFinalizing(false);
    }
  }

  async function copyBrief() {
    if (!story?.researchBrief) return;
    try {
      await navigator.clipboard.writeText(briefToPlainText(story.researchBrief));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable or denied — best-effort only.
    }
  }

  if (story === undefined) {
    return (
      <main style={{ background: COLORS.bg, color: COLORS.text, minHeight: '100vh', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: COLORS.muted }}>Loading selected story…</p>
      </main>
    );
  }

  if (!story) {
    return (
      <main style={{ background: COLORS.bg, color: COLORS.text, minHeight: '100vh', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Story Research</h1>
          <p style={{ color: COLORS.muted, fontSize: 14 }}>
            {loadError ? `Could not load the selected story (${loadError}).` : 'No story is currently selected. Pick one in Editorial Selection first.'}
          </p>
        </div>
      </main>
    );
  }

  const hasSources = !!story.searchResults && story.searchResults.length > 0;
  const hasBrief = !!story.researchBrief;

  return (
    <main style={{ background: COLORS.bg, color: COLORS.text, minHeight: '100vh', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Story Research</h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 20 }}>
          Real sources, cross-checked, organized into a full brief — not a reorganization of what was already known.
        </p>

        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>{story.headline}</h2>
          <p style={{ fontSize: 14, color: COLORS.text, marginBottom: 12 }}>{story.summary}</p>
          {story.verifiedClaims.length === 0 ? (
            <p style={{ fontSize: 13, color: COLORS.muted }}>No verified claims recorded for this story.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {story.verifiedClaims.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <VerificationBadge tier={c.tier} />
                  <span style={{ fontSize: 13, color: COLORS.text }}>{c.claim}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Running Topic Note (optional)</h3>
          <input value={topicKey} onChange={(e) => setTopicKey(e.target.value)} onBlur={() => fetchNoteForKey(topicKey)} placeholder="e.g. iran-hormuz" style={inputStyle} />
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Background context on this recurring topic…" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={saveNote} disabled={noteSaving || !topicKey.trim()} style={buttonStyle(noteSaving || !topicKey.trim())}>
            {noteSaving ? 'Saving…' : noteSaved ? 'Saved' : 'Save Note'}
          </button>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Investigation Instructions (optional)</h3>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Anything specific you want investigated — e.g. 'focus on the economic angle'"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', marginBottom: 0 }}
          />
        </div>

        <div style={cardStyle}>
          <div style={{ marginBottom: 12, fontSize: 13, color: story.researchStatus === 'failed' ? '#EF4444' : COLORS.muted }}>
            Status: {STATUS_LABEL[story.researchStatus ?? 'idle'] ?? story.researchStatus}
            {story.researchStatus === 'failed' && story.researchError ? ` — ${story.researchError}` : ''}
          </div>

          <button onClick={runSearch} disabled={searching} style={buttonStyle(searching, !hasSources)}>
            {searching ? 'Finding sources…' : hasSources ? 'Search Again' : 'Find Sources'}
          </button>
          <button onClick={runSynthesize} disabled={synthesizing || !hasSources} style={buttonStyle(synthesizing || !hasSources, hasSources && !hasBrief)}>
            {synthesizing ? 'Building brief…' : hasBrief ? 'Regenerate Brief' : 'Build Research Brief'}
          </button>

          {searchError && (
            <p style={{ marginTop: 12, color: '#EF4444', fontSize: 13 }}>
              Find Sources failed ({searchError.error_type}): {searchError.message}
            </p>
          )}
          {synthesizeError && (
            <p style={{ marginTop: 12, color: '#EF4444', fontSize: 13 }}>
              Build Research Brief failed ({synthesizeError.error_type}): {synthesizeError.message}
            </p>
          )}
        </div>

        {hasSources && (
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>Sources Found ({story.searchResults!.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {story.searchResults!.map((r, i) => (
                <div key={i} style={{ fontSize: 13 }}>
                  <a href={r.url} target="_blank" rel="noreferrer" style={{ color: COLORS.accent }}>
                    {r.title || r.url}
                  </a>
                  {r.published_date && <span style={{ color: COLORS.muted, fontSize: 12 }}> — {r.published_date}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {hasBrief && (
          <>
            <div style={{ display: 'flex', marginBottom: 16 }}>
              <button onClick={copyBrief} style={buttonStyle(false)}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={finalize} disabled={finalizing || story.researchStatus === 'complete'} style={buttonStyle(finalizing || story.researchStatus === 'complete', true)}>
                {story.researchStatus === 'complete' ? 'Finalized' : finalizing ? 'Sending…' : 'Send to Script Generation'}
              </button>
            </div>

            <Section title="Overview" color={COLORS.accent}>
              <p style={{ fontSize: 13, color: COLORS.text, margin: 0 }}>{story.researchBrief!.overview}</p>
            </Section>

            <Section title="Confirmed" color="#22C55E">
              {story.researchBrief!.confirmed.length === 0 ? (
                <p style={{ fontSize: 13, color: COLORS.muted }}>Nothing in this bucket.</p>
              ) : (
                story.researchBrief!.confirmed.map((item, i) => <SourcedItemRow key={i} item={item} />)
              )}
            </Section>

            <Section title="Developing" color="#3B82F6">
              {story.researchBrief!.developing.length === 0 ? (
                <p style={{ fontSize: 13, color: COLORS.muted }}>Nothing in this bucket.</p>
              ) : (
                story.researchBrief!.developing.map((item, i) => <SourcedItemRow key={i} item={item} />)
              )}
            </Section>

            <Section title="Not Confirmed" color="#F59E0B">
              {story.researchBrief!.not_confirmed.length === 0 ? (
                <p style={{ fontSize: 13, color: COLORS.muted }}>Nothing in this bucket.</p>
              ) : (
                story.researchBrief!.not_confirmed.map((item, i) => <SourcedItemRow key={i} item={item} />)
              )}
            </Section>

            <Section title="Timeline" color={COLORS.text}>
              {story.researchBrief!.timeline.length === 0 ? (
                <p style={{ fontSize: 13, color: COLORS.muted }}>No timeline established.</p>
              ) : (
                story.researchBrief!.timeline.map((t, i) => (
                  <div key={i} style={{ marginBottom: 8, fontSize: 13 }}>
                    <strong style={{ color: COLORS.muted }}>{t.date ?? 'date unknown'}:</strong> {t.event}{' '}
                    {t.source_url ? (
                      <a href={t.source_url} target="_blank" rel="noreferrer" style={{ color: COLORS.accent, fontSize: 12 }}>
                        source
                      </a>
                    ) : (
                      <span style={{ color: COLORS.muted, fontSize: 12, fontStyle: 'italic' }}>could not be independently verified</span>
                    )}
                  </div>
                ))
              )}
            </Section>

            <Section title="Disputed Claims" color="#EF4444">
              {story.researchBrief!.disputed_claims.length === 0 ? (
                <p style={{ fontSize: 13, color: COLORS.muted }}>No disputed claims found.</p>
              ) : (
                story.researchBrief!.disputed_claims.map((d, i) => (
                  <div key={i} style={{ marginBottom: 12, fontSize: 13 }}>
                    <p style={{ margin: '0 0 4px 0' }}>
                      <strong>{d.claim}</strong>
                    </p>
                    <p style={{ margin: '0 0 2px 0', color: COLORS.muted }}>Claimed by: {d.claimed_by ?? 'unknown'}</p>
                    <p style={{ margin: '0 0 2px 0', color: COLORS.muted }}>Disputed by: {d.disputed_by ?? 'unknown'}</p>
                    <p style={{ margin: '0 0 2px 0', color: COLORS.muted }}>Evidence: {d.evidence}</p>
                    <p style={{ margin: 0, color: COLORS.muted }}>Unresolved: {d.unresolved}</p>
                  </div>
                ))
              )}
            </Section>

            <Section title="Background" color={COLORS.text}>
              <p style={{ fontSize: 13, color: COLORS.text, margin: 0 }}>{story.researchBrief!.background}</p>
            </Section>

            <Section title="Why It Matters" color={COLORS.text}>
              <p style={{ fontSize: 13, color: COLORS.text, margin: 0 }}>{story.researchBrief!.why_it_matters}</p>
            </Section>

            <Section title="Open Questions" color={COLORS.text}>
              {story.researchBrief!.open_questions.length === 0 ? (
                <p style={{ fontSize: 13, color: COLORS.muted }}>None recorded.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {story.researchBrief!.open_questions.map((q, i) => (
                    <li key={i} style={{ fontSize: 13, color: COLORS.text, marginBottom: 4 }}>
                      {q}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}
      </div>
    </main>
  );
}
