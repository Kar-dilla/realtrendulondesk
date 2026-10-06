// Shared vocabulary. Every package uses these lists so labels and values never drift.
// Owned by the Lead (Wave 0). Need a new value? Ask the Lead.

export type ScriptPlatform =
  | 'youtube_shorts'
  | 'tiktok'
  | 'instagram_reels'
  | 'x'
  | 'website'
  | 'substack';

export const SCRIPT_PLATFORMS: readonly { id: ScriptPlatform; label: string }[] = [
  { id: 'youtube_shorts', label: 'YouTube Shorts' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram_reels', label: 'Instagram Reels' },
  { id: 'x', label: 'X' },
  { id: 'website', label: 'Website' },
  { id: 'substack', label: 'Substack' },
];

/** Brief v2 §24: Draft -> Editor review -> Approved -> Published. Nothing publishes itself. */
export type PublishStatus = 'draft' | 'review' | 'approved' | 'published';

export const PUBLISH_STATUSES: readonly { id: PublishStatus; label: string }[] = [
  { id: 'draft', label: 'Draft' },
  { id: 'review', label: 'In review' },
  { id: 'approved', label: 'Approved' },
  { id: 'published', label: 'Published' },
];

/** Brief v2 §15 source categories. */
export type SourceCategory =
  | 'official'
  | 'primary'
  | 'major_news'
  | 'local_media'
  | 'specialist'
  | 'social'
  | 'unverified';

export const SOURCE_CATEGORIES: readonly { id: SourceCategory; label: string }[] = [
  { id: 'official', label: 'Official' },
  { id: 'primary', label: 'Primary source' },
  { id: 'major_news', label: 'Major news organization' },
  { id: 'local_media', label: 'Local media' },
  { id: 'specialist', label: 'Specialist publication' },
  { id: 'social', label: 'Social media' },
  { id: 'unverified', label: 'Unverified' },
];
