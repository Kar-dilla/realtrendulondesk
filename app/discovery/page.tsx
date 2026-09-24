'use client';

import { useState } from 'react';

/**
 * ASSUMPTION FLAGGED: I don't have Module 01's actual StoryCard /
 * StatusBadge component source, so this page is self-contained plain
 * Tailwind rather than reusing those components. Swap in the real ones
 * once you paste this into the repo — the brand tokens (ink/char/slate/
 * paper/mute/signal) are hardcoded below to match what's on record from
 * Module 01, but confirm against the actual Tailwind config.
 */

interface DisplayStory {
  headline: string;
  summary: string;
  category: string | null;
  source_urls: string[];
  event_time: string | null;
  merged_from_count: number;
}

type ScanState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; stories: DisplayStory[]; insertedCount: number; skippedCount: number }
  | { status: 'error'; errorType: string; message: string };

export default function DiscoveryPage() {
  const [state, setState] = useState<ScanState>({ status: 'idle' });

  async function runScan() {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/discovery/scan', { method: 'POST' });
      const data = await res.json();

      if (data.error) {
        setState({ status: 'error', errorType: data.error_type ?? 'unknown', message: data.message ?? 'Unknown error.' });
        return;
      }

      setState({
        status: 'success',
        stories: data.stories,
        insertedCount: data.persisted?.inserted ?? 0,
        skippedCount: data.persisted?.skipped_existing ?? 0,
      });
    } catch (err: any) {
      setState({ status: 'error', errorType: 'network', message: err?.message ?? 'Request failed.' });
    }
  }

  return (
    <main className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2] px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Discovery</h1>

        <button
          onClick={runScan}
          disabled={state.status === 'loading'}
          className="bg-[#FF6A00] text-[#0D0D0D] font-medium px-5 py-2.5 rounded-md disabled:opacity-50"
        >
          {state.status === 'loading' ? 'Searching…' : "Top News — Last 24 Hours"}
        </button>

        {state.status === 'loading' && (
          <p className="mt-4 text-sm text-[#8C8C8C]">
            Running a live grounded search — this typically takes longer than a normal API call, sometimes 10-30 seconds.
          </p>
        )}

        {state.status === 'error' && (
          <div className="mt-6 border border-[#2A2A2A] bg-[#161616] rounded-md p-4">
            <p className="text-sm font-medium text-[#FF6A00] mb-1">
              {state.errorType === 'rate_limit' ? 'Discovery scan failed — free-tier quota hit'
                : state.errorType === 'timeout' ? 'Discovery scan failed — request timed out'
                : state.errorType === 'no_results' ? 'No results returned'
                : 'Discovery scan failed'}
            </p>
            <p className="text-sm text-[#8C8C8C]">{state.message}</p>
          </div>
        )}

        {state.status === 'success' && (
          <div className="mt-6 space-y-4">
            <p className="text-xs text-[#8C8C8C]">
              {state.insertedCount} new stor{state.insertedCount === 1 ? 'y' : 'ies'} saved
              {state.skippedCount > 0 ? `, ${state.skippedCount} already on file today` : ''}.
            </p>
            {state.stories.map((story, i) => (
              <article key={i} className="border border-[#2A2A2A] bg-[#161616] rounded-md p-4">
                <h2 className="font-medium">{story.headline}</h2>
                <p className="text-sm text-[#8C8C8C] mt-1">{story.summary}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {story.source_urls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="text-[#FF6A00] underline">
                      {new URL(url).hostname}
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
