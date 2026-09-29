// app/research/page.tsx
//
// Module 06 (Story Research). Shows the currently selected story, a manual
// running-topic note (Constitution §6c), and a "Generate Research Brief"
// button that renders the three-way Confirmed / Developing / Not Confirmed
// split — the actual point of this module, so it's never collapsed into a
// single blob of text. If no story is selected, the rest of the page's
// controls don't render.

'use client';

import { useEffect, useState } from 'react';
import { VerificationBadge, BadgeTier } from '@/components/VerificationBadge';

interface VerifiedClaimRow {
  id: string;
  claim: string;
  tier: BadgeTier;
  evidence: string | null;
}

interface ResearchBrief {
  confirmed: string[];
  developing: string[];
  not_confirmed: string[];
}

interface SelectedStory {
  id: string;
  headline: string;
  summary: string;
  verifiedClaims: VerifiedClaimRow[];
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

const SECTION_STYLE: Record<keyof ResearchBrief, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: '#22C55E' },
  developing: { label: 'Developing', color: '#3B82F6' },
  not_confirmed: { label: 'Not Confirmed', color: '#F59E0B' },
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

export default function ResearchPage() {
  // undefined = still loading, null = loaded and nothing is selected
  const [story, setStory] = useState<SelectedStory | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [topicKey, setTopicKey] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<ApiError | null>(null);

  useEffect(() => {
    fetchSelected();
  }, []);

  async function fetchSelected() {
    try {
      const res = await fetch('/api/research/selected');
      const data = await res.json();
      setStory(data.story ?? null);
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
      // Best-effort pre-fill only; leave the textarea as the owner typed it.
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

  async function generateBrief() {
    if (!story) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/research/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: story.id, topicKey: topicKey.trim() || undefined }),
      });
      const data = await res.json();
      if (data.error) {
        setGenError(data);
      } else {
        setStory({ ...story, researchBrief: data.brief, researchedAt: data.researchedAt });
      }
    } catch (err: any) {
      setGenError({ error: true, error_type: 'network', message: err?.message ?? 'Request failed.' });
    } finally {
      setGenerating(false);
    }
  }

  if (story === undefined) {
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
        <p style={{ color: COLORS.muted }}>Loading selected story…</p>
      </main>
    );
  }

  if (!story) {
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
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Story Research</h1>
          <p style={{ color: COLORS.muted, fontSize: 14 }}>
            {loadError
              ? `Could not load the selected story (${loadError}).`
              : 'No story is currently selected. Pick one in Editorial Selection first.'}
          </p>
        </div>
      </main>
    );
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
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Story Research</h1>
        <p style={{ color: COLORS.muted, fontSize: 14, marginBottom: 24 }}>
          Build the confirmed / developing / not-confirmed brief for the selected story.
        </p>

        <div
          style={{
            padding: 16,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
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

        <div
          style={{
            padding: 16,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Running Topic Note (optional)</h3>
          <input
            value={topicKey}
            onChange={(e) => setTopicKey(e.target.value)}
            onBlur={() => fetchNoteForKey(topicKey)}
            placeholder="e.g. iran-hormuz"
            style={inputStyle}
          />
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Background context on this recurring topic…"
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <button
            onClick={saveNote}
            disabled={noteSaving || !topicKey.trim()}
            style={{
              background: COLORS.card,
              color: COLORS.text,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              padding: '8px 14px',
              fontSize: 13,
              cursor: noteSaving ? 'default' : 'pointer',
              opacity: noteSaving || !topicKey.trim() ? 0.6 : 1,
            }}
          >
            {noteSaving ? 'Saving…' : noteSaved ? 'Saved' : 'Save Note'}
          </button>
        </div>

        <div
          style={{
            padding: 16,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <button
            onClick={generateBrief}
            disabled={generating}
            style={{
              background: COLORS.accent,
              color: '#0D0D0D',
              border: 'none',
              borderRadius: 6,
              padding: '10px 18px',
              fontWeight: 600,
              cursor: generating ? 'default' : 'pointer',
              opacity: generating ? 0.6 : 1,
            }}
          >
            {generating ? 'Generating…' : 'Generate Research Brief'}
          </button>

          {genError && (
            <p style={{ marginTop: 12, color: '#EF4444', fontSize: 13 }}>
              Failed ({genError.error_type}): {genError.message}
            </p>
          )}
        </div>

        {story.researchBrief && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(Object.keys(SECTION_STYLE) as (keyof ResearchBrief)[]).map((key) => (
              <div
                key={key}
                style={{
                  padding: 16,
                  background: COLORS.card,
                  border: `1px solid ${SECTION_STYLE[key].color}`,
                  borderRadius: 8,
                }}
              >
                <h3 style={{ fontSize: 14, color: SECTION_STYLE[key].color, marginBottom: 10 }}>
                  {SECTION_STYLE[key].label}
                </h3>
                {story.researchBrief![key].length === 0 ? (
                  <p style={{ fontSize: 13, color: COLORS.muted }}>Nothing in this bucket.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {story.researchBrief![key].map((item, i) => (
                      <li key={i} style={{ fontSize: 13, color: COLORS.text, marginBottom: 6 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
