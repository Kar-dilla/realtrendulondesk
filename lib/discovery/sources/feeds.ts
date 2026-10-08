export interface FeedConfig {
  id: string;
  label: string;
  url: string;
}

// URLs are from memory and unverified.
export const FEEDS: FeedConfig[] = [
  { id: 'bbc-world', label: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'aljazeera', label: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'dw', label: 'DW', url: 'https://rss.dw.com/xml/rss-en-all' },
  { id: 'guardian-world', label: 'The Guardian World', url: 'https://www.theguardian.com/world/rss' },
  { id: 'sky-world', label: 'Sky News World', url: 'https://feeds.skynews.com/feeds/rss/world.xml' },
];
