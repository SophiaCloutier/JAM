export const suggestedTags = ['drawing', 'painting', 'scrapbooking', 'collage', 'origami', 'knitting', 'embroidery', 'photography', 'creative writing', 'guitar', 'drums', 'singing'];
export const areas = ['Campus', 'Cambridge', 'Boston'];
const categories: Record<string, string> = {
  drawing: 'visual art', painting: 'visual art', scrapbooking: 'paper crafts', collage: 'paper crafts', origami: 'paper crafts',
  knitting: 'textiles', embroidery: 'textiles', photography: 'photography', 'creative writing': 'writing', guitar: 'music', drums: 'music', singing: 'music',
};
export function normalizeTag(tag: string) {
  const normalized = tag.trim().toLowerCase().replace(/\s+/g, ' ');
  const aliases: Record<string, string> = { sketching: 'drawing', sketches: 'drawing', scrapbook: 'scrapbooking', 'paper collage': 'collage', vocals: 'singing', 'creative-writing': 'creative writing' };
  return aliases[normalized] ?? normalized;
}
export function similarity(a: string, b: string) { return a === b ? 1 : categories[a] && categories[a] === categories[b] ? 0.7 : 0; }
export function localDay(time: number) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time); }
