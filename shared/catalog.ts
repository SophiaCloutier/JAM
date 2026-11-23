export const suggestedTags = ['drawing', 'painting', 'pottery', 'scrapbooking', 'collage', 'origami', 'knitting', 'embroidery', 'photography', 'creative writing', 'guitar', 'drums', 'singing'];
/** Predefined creative categories. Similarity is deterministic: same tag 1.0, same category 0.7, otherwise 0. */
const categories: Record<string, string> = {
  drawing: 'visual art', painting: 'visual art', pottery: 'ceramics', scrapbooking: 'paper crafts', collage: 'paper crafts', origami: 'paper crafts',
  knitting: 'textiles', embroidery: 'textiles', photography: 'photography', 'creative writing': 'writing', guitar: 'music', drums: 'music', singing: 'music',
};
export function normalizeTag(tag: string) {
  const normalized = tag.trim().toLowerCase().replace(/\s+/g, ' ');
  const aliases: Record<string, string> = { sketching: 'drawing', sketches: 'drawing', ceramics: 'pottery', scrapbook: 'scrapbooking', 'paper collage': 'collage', vocals: 'singing', 'creative-writing': 'creative writing' };
  return aliases[normalized] ?? normalized;
}
export function similarity(a: string, b: string) { return a === b ? 1 : categories[a] && categories[a] === categories[b] ? 0.7 : 0; }
export const minimumSimilarity = 0.7;

/** Boston-area anchors a user can measure a travel radius from. `meeting` names the
 * areas where events can be held; they match the venue areas in src/venues.ts. */
export const locations = [
  { name: 'MIT campus', lat: 42.3601, lng: -71.0942, meeting: 'Campus' },
  { name: 'Central Square, Cambridge', lat: 42.3653, lng: -71.1037, meeting: 'Cambridge' },
  { name: 'Downtown Boston', lat: 42.3555, lng: -71.0605, meeting: 'Boston' },
  { name: 'Kendall Square', lat: 42.3629, lng: -71.0901, meeting: '' },
  { name: 'Harvard Square', lat: 42.3736, lng: -71.1190, meeting: '' },
  { name: 'Davis Square, Somerville', lat: 42.3967, lng: -71.1223, meeting: '' },
  { name: 'Allston', lat: 42.3539, lng: -71.1337, meeting: '' },
  { name: 'Back Bay', lat: 42.3503, lng: -71.0810, meeting: '' },
  { name: 'Fenway', lat: 42.3467, lng: -71.0972, meeting: '' },
  { name: 'South End', lat: 42.3388, lng: -71.0765, meeting: '' },
  { name: 'Charlestown', lat: 42.3782, lng: -71.0602, meeting: '' },
  { name: 'Brookline', lat: 42.3318, lng: -71.1212, meeting: '' },
  { name: 'Jamaica Plain', lat: 42.3097, lng: -71.1151, meeting: '' },
];
export const radii = [1, 3, 5, 10];
export function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => d * Math.PI / 180, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}
/** Meeting areas within `radius` miles of the named anchor, nearest first. Empty for an unknown anchor. */
export function reachableAreas(location: string, radius: number) {
  const anchor = locations.find(l => l.name === location);
  if (!anchor) return [];
  return locations.filter(l => l.meeting && distanceMiles(anchor, l) <= radius)
    .sort((a, b) => distanceMiles(anchor, a) - distanceMiles(anchor, b)).map(l => l.meeting);
}

/** Requests name a date at least this many calendar days after today (Boston time), at any time of day. */
export const leadDays = 2;
/** Calendar day (YYYY-MM-DD) in Boston time. */
export function localDay(time: number) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time); }
/** Calendar arithmetic on YYYY-MM-DD strings, independent of time of day. */
export function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
/** Epoch ms for a Boston wall-clock time ("HH:MM") on a calendar day, whatever the viewer's own timezone. */
export function bostonTime(day: string, time: string) {
  const [y, m, d] = day.split('-').map(Number), [h, min] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
    .formatToParts(guess).map(p => [p.type, Number(p.value)]));
  const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return guess + (guess - shown);
}
export function isDay(day: unknown): day is string {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && addDays(day, 0) === day;
}
