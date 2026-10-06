'use client';

import type { StoryCardData } from '../../lib/contracts/newsroom';
import { pluralize, timeAgo } from '../../lib/format';
import { Button } from './Button';
import { Card } from './Card';
import { FlaskIcon, LinkIcon, SourcesIcon } from './icons';
import { PriorityBadge } from './PriorityBadge';
import { ProgressBar } from './ProgressBar';

export interface StoryCardProps {
  story: StoryCardData;
  /** Omit the handler to hide the button. */
  onDeepResearch?: (storyId: string) => void;
  onOpenSources?: (storyId: string) => void;
  deepResearchLabel?: string;
}

const MAX_DOMAINS = 4;

/** The one story card used on Dashboard, Today's News, Top Stories and Selection. Do not fork it. */
export function StoryCard({ story, onDeepResearch, onOpenSources, deepResearchLabel = 'Deep Research' }: StoryCardProps) {
  const shown = story.sources.slice(0, MAX_DOMAINS).map((s) => s.domain);
  const extra = story.sources.length - shown.length;
  const domains = shown.join(', ') + (extra > 0 ? ` +${extra} more` : '');

  return (
    <Card as="article" interactive>
      <div className="tl-story">
        <div className="tl-story__top">
          <PriorityBadge level={story.priority} />
          {story.category ? <span className="tl-chip">{story.category}</span> : null}
          {story.score !== null ? <span className="tl-story__score">Score {Math.round(story.score)}</span> : null}
        </div>

        <h3 className="tl-story__headline">{story.headline}</h3>

        <div className="tl-story__metrics">
          <ProgressBar label="Global impact" value={story.globalImpact} />
          <ProgressBar label="Human impact" value={story.humanImpact} />
          <ProgressBar label="Freshness" value={story.freshness} />
          <div className="tl-confidence" data-level={story.sourceConfidence ?? undefined}>
            Source confidence
            <strong>{story.sourceConfidence ?? '—'}</strong>
          </div>
        </div>

        <div className="tl-story__meta">
          <span>
            <SourcesIcon width={14} height={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            {pluralize(story.sourceCount, 'source')}
          </span>
          <span>First reported {timeAgo(story.firstReportedAt)}</span>
          <span>Last updated {timeAgo(story.lastUpdatedAt)}</span>
          {domains ? <span className="tl-story__sources">{domains}</span> : null}
        </div>

        {onDeepResearch || onOpenSources ? (
          <div className="tl-story__actions">
            {onDeepResearch ? (
              <Button variant="primary" icon={<FlaskIcon />} onClick={() => onDeepResearch(story.id)}>
                {deepResearchLabel}
              </Button>
            ) : null}
            {onOpenSources ? (
              <Button icon={<LinkIcon />} onClick={() => onOpenSources(story.id)}>
                Open Sources
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
