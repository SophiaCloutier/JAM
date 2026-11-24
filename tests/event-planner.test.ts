import { describe, expect, test } from 'bun:test';
import { planEvents, sessionsFor, type PlanCluster, type PlanInput, type PlannedEvent } from '../src/event-planner.ts';
import { venues as sampleVenues, type Venue } from '../src/venues.ts';
import { bostonTime } from '../shared/catalog.ts';

/*
 * Testing strategy
 *
 * Sample venues
 *   - 12 or more
 *   - labelled as samples
 *   - 4-15 seats
 *   - covering Campus, Cambridge and Boston
 *
 * sessionsFor(date, venues, earliest, duration, grid)
 *   partition on opening time:
 *     - on the grid
 *     - between grid points
 *   partition on each start:
 *     - before earliest
 *     - inside opening hours
 *     - event would end after closing
 *
 * planEvents(...) invariants, checked by assertValid on every result:
 *   - size 3 to min(15, capacity)
 *   - duration
 *   - inside opening hours
 *   - on the grid
 *   - inside the cluster's window
 *   - venue area among the cluster's areas
 *   - nobody twice
 *   - daily cap
 *   - overlapping seats <= capacity
 *
 * planEvents(...) behaviour
 *   partition on demand vs seats:
 *     - fits one session
 *     - needs a split
 *     - more people than any session can hold
 *   partition on windows:
 *     - overlapping events at one venue
 *     - no venue open for the window
 *   partition on venue limits:
 *     - daily cap reached
 *     - seats shared with an overlapping event
 *   partition on leftovers:
 *     - remainder of 1-2 avoided
 *     - leftover takes a spare same-tag seat
 *     - cannot fit anywhere
 *   partition on ties:
 *     - equal sessions spread across venues
 *   partition on time:
 *     - before the earliest allowed start
 *     - after the earliest allowed start
 *   partition on determinism:
 *     - identical input gives identical output
 */

const DATE = '2026-11-28';
const HOUR = 3600000;

function at(hhmm: string) {
  return bostonTime(DATE, hhmm);
}

/** A test café, open 08:00-22:00 with up to three events a day unless overridden. */
function cafe(name: string, area: string, capacity: number, extra: Partial<Venue> = {}): Venue {
  return { name, area, capacity, dailyCap: 3, opens: '08:00', closes: '22:00', ...extra };
}

let counter = 0;

/** A cluster of `n` members (oldest first) sharing a window and reachable areas. */
function cluster(tag: string, n: number, from = '10:00', until = '18:00', areas = ['Campus', 'Cambridge', 'Boston']): PlanCluster {
  counter++;
  return {
    cluster: `c${counter}-${tag}`,
    tag,
    start: at(from),
    end: at(until),
    areas,
    members: Array.from({ length: n }, (_, i) => ({ request: `c${counter}-r${i}`, user: `c${counter}-u${i}` })),
  };
}

function plan(clusters: PlanCluster[], venues: Venue[] = sampleVenues, over: Partial<PlanInput> = {}) {
  return planEvents({
    date: DATE,
    clusters,
    venues,
    earliest: at('00:00'),
    duration: 2 * HOUR,
    gridMinutes: 30,
    seed: 'test',
    minSize: 3,
    maxSize: 15,
    ...over,
  });
}

/** Every seated request id, in event order. */
function everyone(events: PlannedEvent[]) {
  return events.flatMap(e => e.members.map(m => m.request));
}

/** Seats taken at one venue at the moment `moment`. */
function seatedAt(events: PlannedEvent[], moment: number) {
  return events
    .filter(e => e.start <= moment && moment < e.end)
    .reduce((n, e) => n + e.members.length, 0);
}

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
    for (const moment of here.map(e => e.start)) {
      expect(seatedAt(here, moment)).toBeLessThanOrEqual(v.capacity);
    }
  }
}

describe('sample venues', () => {
  // covers: count, labels, seat range, areas
  test('sample venues are labelled samples and stay within 4 to 15 seats', () => {
    expect(sampleVenues.length).toBeGreaterThanOrEqual(12);
    for (const v of sampleVenues) {
      expect(v.name).toMatch(/^Sample/);
      expect(v.capacity).toBeGreaterThanOrEqual(4);
      expect(v.capacity).toBeLessThanOrEqual(15);
    }
    expect(new Set(sampleVenues.map(v => v.area))).toEqual(new Set(['Campus', 'Cambridge', 'Boston']));
  });
});

describe('sessionsFor', () => {
  // covers: opening between grid points; before earliest; event would end after closing
  test('sessions lie on the grid, inside opening hours, and not before the earliest start', () => {
    const v = cafe('A', 'Campus', 8, { opens: '08:15', closes: '12:00' });
    const sessions = sessionsFor({ date: DATE, venues: [v], earliest: at('09:00'), duration: 2 * HOUR, gridMinutes: 30 });
    expect(sessions.map(s => s.start)).toEqual([at('09:00'), at('09:30'), at('10:00')]);
  });
});

describe('planEvents: invariants', () => {
  // covers: several clusters and areas at once; no venue open for a window
  test('a busy day keeps every invariant: sizes, windows, areas, seats, daily cap and opening hours', () => {
    const clusters = [
      cluster('drawing', 15, '09:00', '21:00'),
      cluster('drawing', 12, '14:00', '18:00', ['Campus']),
      cluster('knitting', 10, '13:00', '17:00', ['Cambridge']),
      cluster('guitar', 9, '18:00', '22:00', ['Boston']),
      cluster('pottery', 5, '06:00', '08:30'),
    ];
    const events = plan(clusters);

    assertValid(events, clusters, sampleVenues);
    expect(events.some(e => e.tag === 'knitting')).toBe(true);
    expect(events.some(e => e.tag === 'pottery')).toBe(false); // nothing is open for a full two hours inside that window
  });

  // covers: before / after the earliest allowed start
  test('no event starts before the earliest allowed start', () => {
    const events = plan([cluster('drawing', 6, '08:00', '20:00')], sampleVenues, { earliest: at('15:10') });
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.start).toBeGreaterThanOrEqual(at('15:30'));
    }
  });
});

describe('planEvents: venue limits', () => {
  // covers: seats shared with an overlapping event
  test('overlapping events at one venue share its seats', () => {
    const venue = cafe('Shared', 'Campus', 10);
    const clusters = [cluster('drawing', 6, '10:00', '12:00'), cluster('painting', 6, '11:00', '13:00')];
    const events = plan(clusters, [venue]);

    assertValid(events, clusters, [venue]);
    expect(events).toHaveLength(2); // they overlap from 11:00 to 12:00, so together they hold at most 10 seats
    expect(everyone(events).length).toBeLessThanOrEqual(10);
  });

  // covers: daily cap reached
  test('the daily cap limits events per venue', () => {
    const venue = cafe('Busy', 'Campus', 15, { dailyCap: 1 });
    const clusters = [cluster('drawing', 4), cluster('painting', 4)];
    const events = plan(clusters, [venue]);

    expect(events).toHaveLength(1);
    assertValid(events, clusters, [venue]);
  });
});

describe('planEvents: splits and leftovers', () => {
  // covers: needs a split; remainder of 1-2 avoided; several events share one group
  test('a 31-person cluster splits without leaving a remainder of 1 or 2', () => {
    const venues = [cafe('Big1', 'Campus', 15), cafe('Big2', 'Cambridge', 15), cafe('Big3', 'Boston', 15)];
    const clusters = [cluster('drawing', 31)];
    const events = plan(clusters, venues);

    assertValid(events, clusters, venues);
    expect(everyone(events)).toHaveLength(31);
    expect(events.map(e => e.members.length).sort((a, b) => b - a)).toEqual([15, 13, 3]);
    expect(new Set(events.map(e => e.group))).toEqual(new Set([clusters[0].cluster])); // several events share one group
  });

  // covers: more people than any session can hold (oldest first)
  test('oldest members are seated first when there are too many people', () => {
    const venue = cafe('Only', 'Campus', 5, { dailyCap: 1 });
    const clusters = [cluster('drawing', 8)];
    const seated = everyone(plan(clusters, [venue]));
    expect(seated).toEqual(clusters[0].members.slice(0, 5).map(m => m.request));
  });

  // covers: leftover takes a spare same-tag seat; other tags never do
  test('a leftover joins a spare seat in an event with the same tag', () => {
    // The bigger cluster opens a 4-person event in an 8-seat venue with a daily cap of one. The second drawing cluster
    // (two people) can never open its own session, but its window and area fit, so both take spare seats.
    const venue = cafe('Roomy', 'Campus', 8, { dailyCap: 1 });
    const main = cluster('drawing', 4, '10:00', '12:00');
    const small = cluster('drawing', 2, '09:00', '13:00');
    const other = cluster('painting', 2, '09:00', '13:00');
    const events = plan([main, small, other], [venue]);

    expect(events).toHaveLength(1);
    expect(events[0].group).toBe(main.cluster);
    expect(everyone(events).sort()).toEqual([...main.members, ...small.members].map(m => m.request).sort());
    assertValid(events, [main, small, other], [venue]);
  });

  // covers: cannot fit anywhere (no seat, or venue out of reach)
  test('a member who cannot fit is absent from every event', () => {
    const venue = cafe('Small', 'Campus', 6, { dailyCap: 1 });
    const big = cluster('drawing', 8, '10:00', '12:00');
    const elsewhere = cluster('drawing', 3, '10:00', '12:00', ['Boston']);
    const events = plan([big, elsewhere], [venue]);

    assertValid(events, [big, elsewhere], [venue]);
    // 8 cannot fit in 6 seats; the first five are seated, then the top-up fills the sixth seat.
    expect(everyone(events)).toEqual(big.members.slice(0, 6).map(m => m.request));
    for (const m of [...big.members.slice(6), ...elsewhere.members]) {
      expect(everyone(events)).not.toContain(m.request);
    }
  });
});

describe('planEvents: determinism and ties', () => {
  // covers: identical input gives identical output
  test('the same input gives identical output', () => {
    const make = () => {
      counter = 1000;
      return [cluster('drawing', 23), cluster('origami', 8, '12:00', '16:00')];
    };
    expect(plan(make())).toEqual(plan(make()));
  });

  // covers: equal sessions spread across venues
  test('ties spread across venues instead of always using the first one', () => {
    const venues = ['A', 'B', 'C', 'D'].map(n => cafe(n, 'Campus', 6, { dailyCap: 1 }));
    const used = new Set<string>();
    for (const tag of ['drawing', 'painting', 'origami', 'knitting', 'guitar', 'singing']) {
      used.add(plan([cluster(tag, 5)], venues)[0].venue);
    }
    expect(used.size).toBeGreaterThan(1);
  });
});
