import type { RawArticle } from '../../contracts/providers';
import { cleanArticles, cleanTitle } from '../clean';
import { TOPICS } from '../sources/topics';

const art = (o: Partial<RawArticle> = {}): RawArticle => ({
  url: 'https://example.com/a',
  title: 'Placeholder',
  publisher: 'example.com',
  publishedAt: null,
  provider: 'rss:test',
  ...o,
});

const VOCAB = ['conflict', 'disaster', 'politics'];
const cat = (o: Partial<RawArticle>, categories: string[] = VOCAB) =>
  cleanArticles([art(o)], { categories })[0]?.category;

describe('cleanTitle', () => {
  it('leaves an already-clean title alone', () => {
    expect(cleanTitle('Sudan ceasefire talks resume in Jeddah', 'dw.com')).toBe('Sudan ceasefire talks resume in Jeddah');
  });
  it('strips " - Outlet" when it matches the publisher', () => {
    expect(cleanTitle('Cholera cases rise in Lagos - Reuters', 'reuters.com')).toBe('Cholera cases rise in Lagos');
    expect(cleanTitle('UN warns of famine risk in Sudan - BBC News', 'bbc.co.uk')).toBe('UN warns of famine risk in Sudan');
  });
  it('strips a " | Outlet" suffix', () => {
    expect(cleanTitle('Floods displace thousands in Kano | Premium Times', 'premiumtimesng.com')).toBe('Floods displace thousands in Kano');
  });
  it('strips an outlet-shaped dash suffix even when the publisher domain does not match', () => {
    expect(cleanTitle('Floods hit southern Brazil again this week - World News', 'news.google.com')).toBe('Floods hit southern Brazil again this week');
  });
  it('does NOT strip a dash clause that is part of the headline', () => {
    expect(cleanTitle('Kenya budget talks - what we know so far', 'dw.com')).toBe('Kenya budget talks - what we know so far');
    expect(cleanTitle('Israel - Hamas war latest', 'dw.com')).toBe('Israel - Hamas war latest');
  });
  it('strips a leading publisher prefix', () => {
    expect(cleanTitle('Reuters | Oil prices jump on supply fears', 'reuters.com')).toBe('Oil prices jump on supply fears');
  });
  it('decodes surviving HTML entities, including double-encoded ones', () => {
    expect(cleanTitle('Nigeria&#39;s inflation rises &amp; naira falls')).toBe("Nigeria's inflation rises & naira falls");
    expect(cleanTitle('It&amp;#39;s over for the bill')).toBe("It's over for the bill");
  });
  it('collapses whitespace and removes stray tags', () => {
    expect(cleanTitle('  Oil   prices\n  jump <b>again</b>  ')).toBe('Oil prices jump again');
  });
  it('strips leading site tags', () => {
    expect(cleanTitle('[VIDEO] Rescuers pull survivors from rubble')).toBe('Rescuers pull survivors from rubble');
    expect(cleanTitle('WATCH: Protesters block main road in Abuja')).toBe('Protesters block main road in Abuja');
  });
  it('fixes ALL CAPS, keeps acronyms, lowercases small words', () => {
    expect(cleanTitle('RESCUERS PULL SURVIVORS FROM COLLAPSED BUILDING IN LAGOS')).toBe('Rescuers Pull Survivors from Collapsed Building in Lagos');
    expect(cleanTitle('US AND UK SIGN NEW DEFENCE PACT WITH NATO')).toBe('US and UK Sign New Defence Pact with NATO');
  });
  it('strips the suffix first, then fixes caps', () => {
    expect(cleanTitle('GUNMEN KILL FIVE IN ZAMFARA VILLAGE - REUTERS', 'reuters.com')).toBe('Gunmen Kill Five in Zamfara Village');
  });
  it('does not touch mixed-case titles that contain acronyms', () => {
    expect(cleanTitle('NATO chiefs meet in Brussels')).toBe('NATO chiefs meet in Brussels');
  });
  it('never returns an empty title', () => {
    expect(cleanTitle('[VIDEO]')).toBe('[VIDEO]');
  });
});

describe('categories: keyword rules (RSS)', () => {
  it('assigns conflict / disaster / politics on clear hits', () => {
    expect(cat({ title: 'Airstrike hits market in northern Syria, dozens killed' })).toBe('conflict');
    expect(cat({ title: 'Earthquake of magnitude 6.1 strikes off Japan coast' })).toBe('disaster');
    expect(cat({ title: 'Senate passes budget after election dispute' })).toBe('politics');
  });
  it('uses the snippet when the title is vague', () => {
    expect(cat({ title: 'Thousands flee homes in northern California', snippet: 'The wildfire has grown overnight.' })).toBe('disaster');
  });
  it('accepts two weak hits', () => {
    expect(cat({ title: 'Army says attack repelled' })).toBe('conflict');
  });
  it('treats hyphenated and plural forms as matches', () => {
    expect(cat({ title: 'Cease-fire collapses as troops advance' })).toBe('conflict');
    expect(cat({ title: 'Wildfires spread across the region' })).toBe('disaster');
  });
  it('matches whole words only', () => {
    expect(cat({ title: 'Warwick students win award for new bridge design' })).toBeNull();
  });
  it('stays null on a single weak hit', () => {
    expect(cat({ title: 'Company fire sale draws investors' })).toBeNull();
  });
  it('stays null when nothing matches', () => {
    expect(cat({ title: 'Local team wins derby after late goal' })).toBeNull();
  });
  it('stays null when two categories are genuinely close', () => {
    expect(cat({ title: 'Parliament votes to approve ceasefire deal' })).toBeNull();
  });
  it('ignores table categories that are not in the vocabulary', () => {
    expect(cat({ title: 'Central bank raises interest rate as inflation bites' })).toBeNull();
    expect(cat({ title: 'Central bank raises interest rate as inflation bites' }, ['economy'])).toBe('economy');
  });
});

describe('categories: GDELT tag is trusted', () => {
  it('uses the topic from the provider id even when the words say something else', () => {
    expect(cat({ provider: 'gdelt:disaster', title: 'Troops launch offensive after ceasefire collapses' })).toBe('disaster');
  });
  it('trusts every real TOPICS id with the default vocabulary', () => {
    for (const t of TOPICS) {
      const id = String(t.id);
      const out = cleanArticles([art({ provider: `gdelt:${id}`, title: 'Zzz nothing here' })])[0];
      expect(out?.category).toBe(id);
    }
  });
  it('falls back to keywords when a GDELT article carries no usable topic', () => {
    expect(cat({ provider: 'gdelt', title: 'Earthquake of magnitude 6.1 strikes off Japan coast' })).toBe('disaster');
    expect(cat({ provider: 'gdelt:nonsense', title: 'Earthquake of magnitude 6.1 strikes off Japan coast' })).toBe('disaster');
    expect(cat({ provider: 'gdelt', title: 'Local team wins derby after late goal' })).toBeNull();
  });
});

describe('cleanArticles', () => {
  it('keeps order and original fields, adds cleanTitle + category, and does not mutate input', () => {
    const input = [
      art({ title: 'Floods displace thousands in Kano | Premium Times', publisher: 'premiumtimesng.com', url: 'https://x/1' }),
      art({ title: 'Local team wins derby after late goal', url: 'https://x/2' }),
    ];
    const snapshot = JSON.stringify(input);
    const out = cleanArticles(input, { categories: VOCAB });
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(out.map((a) => a.url)).toEqual(['https://x/1', 'https://x/2']);
    expect(out[0]?.title).toBe('Floods displace thousands in Kano | Premium Times');
    expect(out[0]?.cleanTitle).toBe('Floods displace thousands in Kano');
    expect(out[0]?.category).toBe('disaster');
    expect(out[1]?.category).toBeNull();
  });
});
