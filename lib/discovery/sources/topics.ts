export interface TopicConfig {
  id: string;
  query: string;
}

// Each query is ONE parenthesized OR group: GDELT rejects unparenthesized ORs.
// GDELT also rejects keywords shorter than 3 characters.
export const TOPICS: TopicConfig[] = [
  { id: 'conflict', query: '(conflict OR war OR attack OR military)' },
  { id: 'disaster', query: '(earthquake OR flood OR hurricane OR wildfire OR disaster)' },
  { id: 'politics', query: '(election OR government OR parliament OR president)' },
  { id: 'economy', query: '(economy OR inflation OR "central bank" OR recession OR trade)' },
  { id: 'technology', query: '(technology OR cybersecurity OR "artificial intelligence" OR semiconductor)' },
  { id: 'science', query: '(science OR research OR space OR climate)' },
  { id: 'health', query: '(health OR outbreak OR vaccine OR hospital)' },
  { id: 'world', query: '(world OR international OR diplomacy OR summit)' },
];

// English only. Added to every query as sourcelang:<value>, outside the OR group.
// Also used to drop any article whose language field is not this one (lowercase).
export const GDELT_LANGUAGE = 'english';

// Live check: a broad query returned 116 articles, so the cap is above 75. 250 is GDELT's documented maximum.
export const GDELT_MAX_RECORDS = 250;

// GDELT allows about 1 request per 5 seconds per IP.
export const GDELT_MIN_GAP_MS = 5000;
