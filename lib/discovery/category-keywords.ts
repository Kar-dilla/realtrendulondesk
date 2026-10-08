// Keyword table for RSS categorisation (Task 4). Config only: tune words here, not in clean.ts.
//
// Keys MUST be topic ids from ./sources/topics (GDELT's vocabulary). clean.ts ignores any key
// that is not a real topic id, so extra categories are harmless but dormant until a matching topic exists.
//
// strong = unambiguous on its own. weak = suggestive, needs company.
// Matching is case-insensitive, whole-word, hyphens treated as spaces, plain plural ("s"/"es") allowed.
// So list singular forms only, and list real variants ("flood", "flooding") separately.

export interface CategoryKeywords {
  strong: string[];
  weak: string[];
}

/** Minimum score before a category is assigned. Strong hit: title 3, snippet 2. Weak hit: 1 (title or snippet). */
export const MIN_SCORE = 2;
/** The winner must beat the runner-up by this much, otherwise it is genuinely unclear and stays null. */
export const MIN_MARGIN = 2;

export const CATEGORY_KEYWORDS: Record<string, CategoryKeywords> = {
  conflict: {
    strong: [
      'airstrike', 'air strike', 'drone strike', 'missile strike', 'shelling', 'ceasefire', 'cease fire',
      'invasion', 'militant', 'insurgent', 'hostage', 'frontline', 'war crime', 'troops', 'rocket attack',
    ],
    weak: ['war', 'attack', 'killed', 'clash', 'military', 'bombing', 'army', 'gunmen', 'soldier', 'offensive', 'rebel', 'conflict'],
  },
  disaster: {
    strong: [
      'earthquake', 'tsunami', 'hurricane', 'typhoon', 'cyclone', 'wildfire', 'flood', 'flooding', 'landslide',
      'mudslide', 'volcano', 'tornado', 'drought', 'famine', 'heatwave', 'blizzard', 'plane crash',
      'building collapse', 'shipwreck', 'capsized',
    ],
    weak: ['storm', 'fire', 'crash', 'collapse', 'evacuated', 'rescue', 'rescuer', 'victim', 'survivor', 'eruption', 'emergency'],
  },
  politics: {
    strong: [
      'election', 'parliament', 'parliamentary', 'senate', 'senator', 'congress', 'lawmaker', 'referendum',
      'impeach', 'impeachment', 'prime minister', 'presidential', 'legislature', 'opposition leader',
      'ballot', 'coalition government',
    ],
    weak: ['vote', 'minister', 'government', 'president', 'campaign', 'opposition', 'cabinet', 'policy', 'party'],
  },

  // Dormant unless TOPICS has an id with the same name. Starting guesses, not verified against your vocabulary.
  economy: {
    strong: ['inflation', 'interest rate', 'central bank', 'gdp', 'recession', 'unemployment', 'stock market', 'tariff', 'exchange rate', 'imf', 'world bank'],
    weak: ['economy', 'market', 'trade', 'price', 'bank', 'oil', 'currency', 'debt', 'growth', 'jobs'],
  },
  health: {
    strong: ['outbreak', 'epidemic', 'pandemic', 'vaccine', 'cholera', 'ebola', 'malaria', 'mpox', 'measles'],
    weak: ['health', 'hospital', 'disease', 'virus', 'doctor', 'patient', 'drug'],
  },
  technology: {
    strong: ['artificial intelligence', 'cybersecurity', 'cyberattack', 'data breach', 'semiconductor', 'chatbot', 'ransomware', 'smartphone'],
    weak: ['ai', 'tech', 'software', 'app', 'startup', 'digital', 'online'],
  },
};
