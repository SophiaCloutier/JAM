/** Pure event planner: no database, no clock, no randomness. Imported only by EventGenerating.
 * Given one date's clusters (a tag label, a shared free window, reachable areas and members) and the venues,
 * it decides which sessions (venue + start time) to open and who sits where. Tags are only labels here:
 * there is no similarity. People it cannot seat are left out of the result. Same input, same output. */
import { bostonTime } from '../shared/catalog.ts';
import type { Venue } from './venues.ts';

export type PlanCluster = {
  cluster: string;
  tag: string;
  start: number;
  end: number;
  areas: string[];
  members: { request: string; user: string }[];
};
export type PlannedEvent = {
  group: string;
  venue: string;
  area: string;
  tag: string;
  start: number;
  end: number;
  members: { invitee: string; request: string }[];
};
export type PlanInput = {
  date: string;
  clusters: PlanCluster[];
  venues: Venue[];
  /** No event may start before this instant (now + cutoff + response window). */
  earliest: number;
  duration: number;
  gridMinutes: number;
  seed: string;
  minSize: number;
  maxSize: number;
};

type Session = { venue: Venue; start: number; end: number };
type Person = { request: string; user: string; cluster: PlanCluster };
type Open = Session & { group: string; tag: string; members: Person[] };
type Candidate = { session: Session; cluster: PlanCluster; take: number; h: number; key: string };

/** FNV-1a, 32 bit. Only used to break ties so equal choices spread across venues and times. */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Minutes after midnight as "HH:MM". */
function clock(minutes: number) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** "HH:MM" as minutes after midnight. */
function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Every (venue, start) on the grid whose whole event lies inside opening hours and is not before `earliest`. */
export function sessionsFor({
  date,
  venues,
  earliest,
  duration,
  gridMinutes,
}: Pick<PlanInput, 'date' | 'venues' | 'earliest' | 'duration' | 'gridMinutes'>): Session[] {
  const sessions: Session[] = [];
  for (const venue of venues) {
    const closes = bostonTime(date, venue.closes);
    const firstSlot = Math.ceil(toMinutes(venue.opens) / gridMinutes) * gridMinutes;
    for (let m = firstSlot; m < 24 * 60; m += gridMinutes) {
      const start = bostonTime(date, clock(m));
      const end = start + duration;
      if (end > closes) break;
      if (start >= earliest) sessions.push({ venue, start, end });
    }
  }
  return sessions;
}

export function planEvents(input: PlanInput): PlannedEvent[] {
  const { date, minSize, maxSize, seed } = input;
  const clusters = input.clusters
    .filter(
      c => Number.isFinite(c.start) && Number.isFinite(c.end) && Array.isArray(c.areas) && Array.isArray(c.members),
    )
    .sort((a, b) => a.cluster.localeCompare(b.cluster));

  // Each request appears once; members arrive oldest first.
  const seen = new Set<string>();
  const people = new Map<string, Person[]>();
  for (const c of clusters) {
    const fresh: Person[] = [];
    for (const m of c.members) {
      if (seen.has(m.request)) continue;
      seen.add(m.request);
      fresh.push({ ...m, cluster: c });
    }
    people.set(c.cluster, fresh);
  }

  const sessions = sessionsFor(input);
  const open: Open[] = [];
  const placed = new Set<string>();

  const unplaced = (c: PlanCluster) => people.get(c.cluster)!.filter(p => !placed.has(p.request));
  const fits = (c: PlanCluster, s: Session) => c.start <= s.start && c.end >= s.end && c.areas.includes(s.venue.area);
  const eventsAt = (venue: Venue) => open.filter(e => e.venue === venue);
  const tieKey = (s: Session, tag: string) => `${seed}|${date}|${s.venue.name}|${s.start}|${tag}`;

  /** Largest number of JAM seats taken at any moment of [start, end) at this venue. */
  const occupied = (venue: Venue, start: number, end: number) => {
    const here = eventsAt(venue);
    const moments = [start, ...here.map(e => e.start).filter(p => p > start && p < end)];
    let most = 0;
    for (const moment of moments) {
      const seated = here.filter(e => e.start <= moment && moment < e.end).reduce((n, e) => n + e.members.length, 0);
      most = Math.max(most, seated);
    }
    return most;
  };

  /** How many of a cluster's waiting members this session should seat, or 0 if it cannot seat a full group. */
  const seatsFor = (session: Session, waiting: number) => {
    const { venue } = session;
    const free = venue.capacity - occupied(venue, session.start, session.end);
    let take = Math.min(maxSize, venue.capacity, free, waiting);
    // Avoid stranding 1 or 2 members when a slightly smaller group leaves a full group behind.
    const rest = waiting - take;
    const shrunk = take - (minSize - rest);
    if (rest > 0 && rest < minSize && shrunk >= minSize) take = shrunk;
    return take >= minSize ? take : 0;
  };

  /** More seats wins; equal seats go to the lower seeded hash, then the key itself. */
  const better = (a: Candidate, b: Candidate | undefined) => {
    if (!b) return true;
    if (a.take !== b.take) return a.take > b.take;
    if (a.h !== b.h) return a.h < b.h;
    return a.key < b.key;
  };

  // Greedy: open the session that seats the most people, until no session can seat a full group.
  for (;;) {
    let best: Candidate | undefined;
    for (const cluster of clusters) {
      const waiting = unplaced(cluster).length;
      if (waiting < minSize) continue;
      for (const session of sessions) {
        if (!fits(cluster, session)) continue;
        if (eventsAt(session.venue).length >= session.venue.dailyCap) continue;
        const take = seatsFor(session, waiting);
        if (!take) continue;
        const key = tieKey(session, cluster.tag);
        const candidate = { session, cluster, take, h: hash(key), key };
        if (better(candidate, best)) best = candidate;
      }
    }
    if (!best) break;

    const members = unplaced(best.cluster).slice(0, best.take);
    open.push({ ...best.session, group: best.cluster.cluster, tag: best.cluster.tag, members });
    for (const p of members) placed.add(p.request);
  }

  // Top-up: leftovers take spare seats in an open session with the same tag,
  // inside their own cluster's window and areas.
  const hasSpareSeat = (e: Open) =>
    e.members.length < Math.min(maxSize, e.venue.capacity) && occupied(e.venue, e.start, e.end) < e.venue.capacity;
  const smallestFirst = (a: Open, b: Open) => {
    const ka = tieKey(a, a.tag),
      kb = tieKey(b, b.tag);
    return a.members.length - b.members.length || hash(ka) - hash(kb) || ka.localeCompare(kb);
  };
  for (const cluster of clusters) {
    for (const person of unplaced(cluster)) {
      const spare = open.filter(e => e.tag === cluster.tag && fits(cluster, e) && hasSpareSeat(e)).sort(smallestFirst);
      if (!spare.length) continue;
      spare[0].members.push(person);
      placed.add(person.request);
    }
  }

  return open
    .sort((a, b) => a.start - b.start || a.venue.name.localeCompare(b.venue.name) || a.group.localeCompare(b.group))
    .map(e => ({
      group: e.group,
      venue: e.venue.name,
      area: e.venue.area,
      tag: e.tag,
      start: e.start,
      end: e.end,
      members: e.members.map(p => ({ invitee: p.user, request: p.request })),
    }));
}
