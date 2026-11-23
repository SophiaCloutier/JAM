import { expect, test } from 'bun:test';
import { planEvents, sessionsFor, type PlanCluster, type PlanInput, type PlannedEvent } from '../src/event-planner.ts';
import { venues as sampleVenues, type Venue } from '../src/venues.ts';
import { bostonTime } from '../shared/catalog.ts';

const DATE = '2026-11-28', HOUR = 3600000;
const at = (hhmm: string) => bostonTime(DATE, hhmm);
const cafe = (name: string, area: string, capacity: number, extra: Partial<Venue> = {}): Venue => ({ name, area, capacity, dailyCap: 3, opens: '08:00', closes: '22:00', ...extra });
let counter = 0;
/** A cluster of `n` members (oldest first) sharing a window and reachable areas. */
function cluster(tag: string, n: number, from = '10:00', until = '18:00', areas = ['Campus', 'Cambridge', 'Boston']): PlanCluster {
  counter++;
  return { cluster: `c${counter}-${tag}`, tag, start: at(from), end: at(until), areas,
    members: Array.from({ length: n }, (_, i) => ({ request: `c${counter}-r${i}`, user: `c${counter}-u${i}` })) };
}
function plan(clusters: PlanCluster[], venues: Venue[] = sampleVenues, over: Partial<PlanInput> = {}) {
  return planEvents({ date: DATE, clusters, venues, earliest: at('00:00'), duration: 2 * HOUR, gridMinutes: 30, seed: 'test', minSize: 3, maxSize: 15, ...over });
}
const everyone = (events: PlannedEvent[]) => events.flatMap(e => e.members.map(m => m.request));
/** Checks every invariant the planner promises, for any input. */
function assertValid(events: PlannedEvent[], clusters: PlanCluster[], venues: Venue[]) {
  const clusterOf = new Map(clusters.flatMap(c => c.members.map(m => [m.request, c] as const)));
  expect(new Set(everyone(events)).size).toBe(everyone(events).length); // nobody twice
  for (const e of events) {
    const venue = venues.find(v => v.name === e.venue)!;
    expect(e.members.length).toBeGreaterThanOrEqual(3);
    expect(e.members.length).toBeLessThanOrEqual(Math.min(15, venue.capacity));
    expect(e.end - e.start).toBe(2 * HOUR);
    expect(e.start).toBeGreaterThanOrEqual(bostonTime(DATE, venue.opens));
    expect(e.end).toBeLessThanOrEqual(bostonTime(DATE, venue.closes));
    expect((e.start - at('00:00')) % (30 * 60000)).toBe(0);
    expect(clusters.find(c => c.cluster === e.group)?.tag).toBe(e.tag);
    for (const m of e.members) {
      const c = clusterOf.get(m.request)!;
      expect(c.tag).toBe(e.tag);
      expect(c.start <= e.start && c.end >= e.end).toBe(true);
      expect(c.areas).toContain(venue.area);
    }
  }
  for (const v of venues) {
    const here = events.filter(e => e.venue === v.name);
    expect(here.length).toBeLessThanOrEqual(v.dailyCap);
    for (const p of here.map(e => e.start)) expect(here.filter(e => e.start <= p && p < e.end).reduce((n, e) => n + e.members.length, 0)).toBeLessThanOrEqual(v.capacity);
  }
}

test('sample venues are labelled samples and stay within 4 to 15 seats', () => {
  expect(sampleVenues.length).toBeGreaterThanOrEqual(12);
  for (const v of sampleVenues) { expect(v.name).toMatch(/^Sample/); expect(v.capacity).toBeGreaterThanOrEqual(4); expect(v.capacity).toBeLessThanOrEqual(15); }
  expect(new Set(sampleVenues.map(v => v.area))).toEqual(new Set(['Campus', 'Cambridge', 'Boston']));
});

test('sessions lie on the grid, inside opening hours, and not before the earliest start', () => {
  const v = cafe('A', 'Campus', 8, { opens: '08:15', closes: '12:00' });
  const starts = sessionsFor({ date: DATE, venues: [v], earliest: at('09:00'), duration: 2 * HOUR, gridMinutes: 30 }).map(s => s.start);
  expect(starts).toEqual([at('09:00'), at('09:30'), at('10:00')]);
});

test('a busy day keeps every invariant: sizes, windows, areas, seats, daily cap and opening hours', () => {
  const clusters = [cluster('drawing', 15, '09:00', '21:00'), cluster('drawing', 12, '14:00', '18:00', ['Campus']), cluster('knitting', 10, '13:00', '17:00', ['Cambridge']),
    cluster('guitar', 9, '18:00', '22:00', ['Boston']), cluster('pottery', 5, '06:00', '08:30')];
  const events = plan(clusters);
  assertValid(events, clusters, sampleVenues);
  expect(events.some(e => e.tag === 'knitting')).toBe(true);
  expect(events.some(e => e.tag === 'pottery')).toBe(false); // nothing is open for a full two hours inside that window
});

test('overlapping events at one venue share its seats', () => {
  const venue = cafe('Shared', 'Campus', 10);
  const clusters = [cluster('drawing', 6, '10:00', '12:00'), cluster('painting', 6, '11:00', '13:00')];
  const events = plan(clusters, [venue]);
  assertValid(events, clusters, [venue]);
  expect(events).toHaveLength(2); // they overlap from 11:00 to 12:00, so together they hold at most 10 seats
  expect(everyone(events).length).toBeLessThanOrEqual(10);
});

test('the daily cap limits events per venue', () => {
  const venue = cafe('Busy', 'Campus', 15, { dailyCap: 1 });
  const clusters = [cluster('drawing', 4), cluster('painting', 4)];
  const events = plan(clusters, [venue]);
  expect(events).toHaveLength(1);
  assertValid(events, clusters, [venue]);
});

test('the same input gives identical output', () => {
  const make = () => { counter = 1000; return [cluster('drawing', 23), cluster('origami', 8, '12:00', '16:00')]; };
  expect(plan(make())).toEqual(plan(make()));
});

test('ties spread across venues instead of always using the first one', () => {
  const venues = ['A', 'B', 'C', 'D'].map(n => cafe(n, 'Campus', 6, { dailyCap: 1 }));
  const used = new Set<string>();
  for (const tag of ['drawing', 'painting', 'origami', 'knitting', 'guitar', 'singing']) used.add(plan([cluster(tag, 5)], venues)[0].venue);
  expect(used.size).toBeGreaterThan(1);
});

test('a 31-person cluster splits without leaving a remainder of 1 or 2', () => {
  const venues = [cafe('Big1', 'Campus', 15), cafe('Big2', 'Cambridge', 15), cafe('Big3', 'Boston', 15)];
  const clusters = [cluster('drawing', 31)];
  const events = plan(clusters, venues);
  assertValid(events, clusters, venues);
  expect(everyone(events)).toHaveLength(31);
  expect(events.map(e => e.members.length).sort((a, b) => b - a)).toEqual([15, 13, 3]);
  expect(new Set(events.map(e => e.group))).toEqual(new Set([clusters[0].cluster])); // several events share one group
});

test('oldest members are seated first when there are too many people', () => {
  const venue = cafe('Only', 'Campus', 5, { dailyCap: 1 });
  const clusters = [cluster('drawing', 8)];
  expect(everyone(plan(clusters, [venue]))).toEqual(clusters[0].members.slice(0, 5).map(m => m.request));
});

test('a leftover joins a spare seat in an event with the same tag', () => {
  // The bigger cluster opens a 4-person event in an 8-seat venue with a daily cap of one. The second drawing cluster
  // (two people) can never open its own session, but its window and area fit, so both take spare seats.
  const venue = cafe('Roomy', 'Campus', 8, { dailyCap: 1 });
  const main = cluster('drawing', 4, '10:00', '12:00'), small = cluster('drawing', 2, '09:00', '13:00'), other = cluster('painting', 2, '09:00', '13:00');
  const events = plan([main, small, other], [venue]);
  expect(events).toHaveLength(1);
  expect(events[0].group).toBe(main.cluster);
  expect(everyone(events).sort()).toEqual([...main.members, ...small.members].map(m => m.request).sort());
  assertValid(events, [main, small, other], [venue]);
});

test('a member who cannot fit is absent from every event', () => {
  const venue = cafe('Small', 'Campus', 6, { dailyCap: 1 });
  const big = cluster('drawing', 8, '10:00', '12:00');
  const elsewhere = cluster('drawing', 3, '10:00', '12:00', ['Boston']);
  const events = plan([big, elsewhere], [venue]);
  assertValid(events, [big, elsewhere], [venue]);
  // 8 cannot fit in 6 seats; the first five are seated, then the top-up fills the sixth seat.
  expect(everyone(events)).toEqual(big.members.slice(0, 6).map(m => m.request));
  for (const m of [...big.members.slice(6), ...elsewhere.members]) expect(everyone(events)).not.toContain(m.request);
});

test('no event starts before the earliest allowed start', () => {
  const events = plan([cluster('drawing', 6, '08:00', '20:00')], sampleVenues, { earliest: at('15:10') });
  expect(events.length).toBeGreaterThan(0);
  for (const e of events) expect(e.start).toBeGreaterThanOrEqual(at('15:30'));
});
