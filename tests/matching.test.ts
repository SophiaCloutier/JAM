import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { database, closeDatabase } from '../src/database.ts';
import { MatchingConcept, InvalidSlot, SlotUnavailable } from '../src/concepts/Matching.ts';
import { bostonTime } from '../shared/catalog.ts';
process.env.MONGODB_DATABASE = `jam_matching_test_${crypto.randomUUID().replaceAll('-', '')}`;

/*
 * Testing strategy
 *
 * submit(user, date, window, selected, interests, location, radius)
 *   partition on lead time:
 *     - earliest allowed date (any time that day)
 *     - too soon
 *   partition on window:
 *     - at least the event length
 *     - shorter
 *   partition on chosen interest:
 *     - in the profile
 *     - not in the profile
 *     - Surprise me
 *   partition on reach:
 *     - some meeting area within the radius
 *     - none
 *     - unknown location
 *   partition on open requests:
 *     - none
 *     - already one open
 *   partition on the date:
 *     - not yet matched
 *     - already matched
 *
 * withdraw(user, request)
 *   partition on request:
 *     - owner's waiting request
 *     - someone else's request
 *
 * openDue(force)
 *   partition on timing:
 *     - date not yet due
 *     - due (from the day before)
 *     - already reached (missed during downtime)
 *   partition on force:
 *     - false
 *     - true
 *   partition on repeats:
 *     - first run
 *     - later runs
 *
 * form / assign / finish (the option chain)
 *   partition on similarity:
 *     - exact tag
 *     - related (0.7)
 *     - unrelated
 *   partition on option:
 *     - chosen interest
 *     - Surprise me (profile interests)
 *   partition on ties:
 *     - one fitting cluster
 *     - several (smaller wins)
 *   partition on hard constraints:
 *     - shared window
 *     - no shared window
 *     - no shared area
 *     - capacity reached
 *
 * activate / abandon / reconcile
 *   partition on outcome:
 *     - no venue
 *     - event cancelled
 *     - declined
 *     - user requests again later
 *
 * _planning()
 *   - complete clusters with their full shared window
 *   - all shared areas
 *   - members oldest first
 *   - _completed unchanged
 *
 * settle(date, placed)
 *   partition on each cluster:
 *     - some member placed
 *     - none placed
 *   partition on each member:
 *     - placed
 *     - not placed
 *   partition on repeats:
 *     - first settle
 *     - settle again
 *   partition on close(cluster) afterwards:
 *     - failed cluster
 *     - generated cluster
 */

// Thursday 2026-11-26, 3pm Boston time. Saturday is the earliest requestable date.
const THURSDAY = '2026-11-26';
const FRIDAY = '2026-11-27';
const SATURDAY = '2026-11-28';
const SUNDAY = '2026-11-29';
const limits = JSON.stringify({ Campus: 8, Cambridge: 6, Boston: 8 });

let now = bostonTime(THURSDAY, '15:00');
const matching = new MatchingConcept(() => now);

type Ask = {
  selected?: string;
  interests?: string[];
  date?: string;
  from?: string;
  until?: string;
  location?: string;
  radius?: number;
};

/** Submits a request. Each call is one second later, so "oldest first" is deterministic. */
function ask(user: string, options: Ask = {}) {
  const {
    selected = '',
    date = SATURDAY,
    from = '10:00',
    until = '16:00',
    location = 'MIT campus',
    radius = 1,
  } = options;
  const interests = options.interests ?? [selected || 'drawing'];
  now += 1000;
  return matching.submit({
    user,
    date,
    start: bostonTime(date, from),
    end: bostonTime(date, until),
    selected,
    interests: JSON.stringify(interests),
    location,
    radius,
  });
}

/** Runs the same option chain the Meetups reactions run, using only Matching's actions and queries. */
async function runChain(date = SATURDAY, caps = limits) {
  const chosen = async () => (await matching._chosen({ date })).candidates;
  const profile = async () => (await matching._profile({ date })).candidates;
  await matching.form({ date, stage: 'chosen', candidates: await chosen(), minScore: 1, limits: caps });
  await matching.assign({ date, stage: 'chosen', candidates: await chosen(), limits: caps });
  await matching.assign({ date, stage: 'profile', candidates: await profile(), limits: caps });
  await matching.form({ date, stage: 'profile', candidates: await profile(), minScore: 0.7, limits: caps });
  await matching.assign({ date, stage: 'leftover', candidates: await profile(), limits: caps });
  await matching.finish({ date });
}

/** Opens due dates and returns the dates the run opened. */
async function openDates(force: boolean) {
  const { run } = await matching.openDue({ force });
  return (await matching._opened({ run })).map(r => r.date);
}

/** Moves the clock to just after midnight on Friday, when Saturday becomes due, and opens due dates. */
async function openFriday(force = false) {
  now = bostonTime(FRIDAY, '00:30');
  return openDates(force);
}

async function status(user: string) {
  const { requests } = await matching._mine({ user });
  return JSON.parse(requests)[0] as { status: string; reason: string };
}

async function clusters() {
  return matching._completed({});
}

async function clusterOf(user: string) {
  for (const c of await clusters()) {
    const members = await matching._members({ cluster: c.cluster });
    if (members.some(m => m.invitee === user)) return c;
  }
  return undefined;
}

type Planning = {
  cluster: string;
  tag: string;
  start: number;
  end: number;
  areas: string[];
  members: { request: string; user: string }[];
};

async function planning() {
  const rows = await matching._planning({});
  return rows.map(r => ({ date: r.date, clusters: JSON.parse(r.clusters) as Planning[] }));
}

async function askAll(users: string[], options: Ask = {}) {
  for (const user of users) await ask(user, options);
}

beforeEach(async () => {
  await database().collection('matching').deleteMany({});
  now = bostonTime(THURSDAY, '15:00');
});
afterAll(async () => {
  await database().dropDatabase();
  await closeDatabase();
});

describe('submit', () => {
  // covers: earliest allowed date at any time that day; too soon
  test('lead time counts calendar days: Thursday 3pm can request Saturday 11am but not Friday', async () => {
    await ask('a', { from: '11:00', until: '13:00' });
    await expect(ask('b', { date: FRIDAY })).rejects.toBeInstanceOf(InvalidSlot);

    // Late Thursday still counts as Thursday.
    now = bostonTime(THURSDAY, '23:59');
    await ask('c', { from: '11:00', until: '13:00' });
  });

  // covers: short window; chosen interest not in profile; no area in reach; unknown location; one open request
  test('submit validates window, chosen interest and reach', async () => {
    await expect(ask('a', { from: '10:00', until: '11:30' })).rejects.toBeInstanceOf(InvalidSlot);
    await expect(ask('a', { selected: 'pottery', interests: ['drawing'] })).rejects.toBeInstanceOf(InvalidSlot);
    await expect(ask('a', { location: 'Allston', radius: 1 })).rejects.toBeInstanceOf(InvalidSlot);
    await expect(ask('a', { location: 'Nowhere' })).rejects.toBeInstanceOf(InvalidSlot);

    await ask('a');
    await expect(ask('a', { date: SUNDAY })).rejects.toBeInstanceOf(SlotUnavailable);
  });
});

describe('openDue', () => {
  // covers: forced first run; later runs; request for an already matched date
  test('a date is opened once; later requests for it are refused and re-running opens nothing', async () => {
    await ask('a');
    expect(await openDates(true)).toEqual([SATURDAY]);
    expect(await openDates(true)).toEqual([]);

    // Still Thursday, so Saturday passes the lead-time rule, but its matching has already run.
    await expect(ask('b')).rejects.toBeInstanceOf(SlotUnavailable);
    await ask('b', { date: SUNDAY });
  });

  // covers: not yet due without force; due with force
  test('dates are not due before the day before them unless forced', async () => {
    await ask('a');
    expect(await openDates(false)).toEqual([]);
    expect(await openDates(true)).toEqual([SATURDAY]);
  });
});

describe('withdraw and missed dates', () => {
  // covers: someone else's request; owner's waiting request; date already reached
  test("withdraw only affects the owner's waiting request; dates already reached are marked too late", async () => {
    const { request } = await ask('a');
    await expect(matching.withdraw({ user: 'intruder', request })).rejects.toBeInstanceOf(SlotUnavailable);
    await matching.withdraw({ user: 'a', request });
    expect((await status('a')).status).toBe('WITHDRAWN');

    await ask('b');
    now = bostonTime(SATURDAY, '09:00'); // the server was down for the whole of Friday
    await matching.openDue({ force: false });
    expect(await status('b')).toMatchObject({ status: 'UNMATCHED', reason: 'TOO_LATE' });
  });
});

describe('clustering: similarity and options', () => {
  // covers: exact tag; chosen interest
  test('exact clusters form before related ones: three drawing and three painting choosers make two clusters', async () => {
    await askAll(['d1', 'd2', 'd3'], { selected: 'drawing' });
    await askAll(['p1', 'p2', 'p3'], { selected: 'painting' });
    await openFriday();
    await runChain();

    const tags = (await clusters()).map(c => [c.tag, c.size]).sort();
    expect(tags).toEqual([
      ['drawing', 3],
      ['painting', 3],
    ]);
  });

  // covers: related (0.7); chosen interest
  test('a chosen interest without its own group joins a related (0.7) cluster', async () => {
    await askAll(['d1', 'd2', 'd3'], { selected: 'drawing' });
    await ask('p', { selected: 'painting', interests: ['painting'] });
    await openFriday();
    await runChain();

    expect((await clusterOf('p'))?.tag).toBe('drawing');
    expect((await status('p')).status).toBe('MATCHED');
  });

  // covers: Surprise me; exact beats related even when the related cluster is smaller
  test('surprise me prefers an exact profile match over a smaller related cluster', async () => {
    await askAll(['d1', 'd2', 'd3'], { selected: 'drawing' });
    await askAll(['p1', 'p2', 'p3', 'p4'], { selected: 'painting' });
    await ask('s', { interests: ['pottery', 'painting'] });
    await openFriday();
    await runChain();

    expect((await clusterOf('s'))?.tag).toBe('painting');
  });

  // covers: unrelated; leftover becomes NO_MATCH
  test('unrelated interests never match and leftovers are told to choose another date', async () => {
    await askAll(['d1', 'd2', 'd3'], { selected: 'drawing' });
    await ask('pot', { selected: 'pottery', interests: ['pottery', 'guitar'] });
    await openFriday();
    await runChain();

    expect(await status('pot')).toMatchObject({ status: 'UNMATCHED', reason: 'NO_MATCH' });
    expect(await clusterOf('pot')).toBeUndefined();
  });
});

describe('clustering: ties and hard constraints', () => {
  // covers: several fitting clusters (smaller wins); shared window required
  test('ties on similarity go to the smaller cluster, and availability is a hard constraint', async () => {
    await askAll(['m1', 'm2', 'm3', 'm4'], { selected: 'drawing', from: '09:00', until: '11:00' });
    await askAll(['a1', 'a2', 'a3'], { selected: 'drawing', from: '15:00', until: '17:00' });
    // Surprise me: joins after clusters form.
    await ask('late', { interests: ['drawing'], from: '08:00', until: '18:00' });
    await openFriday();
    await runChain();

    expect((await clusterOf('late'))?.size).toBe(4); // fits both drawing groups; joined the afternoon group of three
    expect((await clusterOf('m1'))?.size).toBe(4);
    expect((await clusters()).length).toBe(2);
  });

  // covers: no shared window; no shared area
  test('incompatible windows or no shared meeting area never cluster', async () => {
    await ask('w1', { from: '08:00', until: '10:00' });
    await ask('w2', { from: '11:00', until: '13:00' });
    await ask('w3', { from: '14:00', until: '16:00' });
    await ask('r1', { date: SUNDAY });
    await ask('r2', { date: SUNDAY });
    // r3 reaches only Boston; the others reach Campus/Cambridge.
    await ask('r3', { date: SUNDAY, location: 'Downtown Boston', radius: 1 });

    expect(await openFriday()).toEqual([SATURDAY]);
    await runChain(SATURDAY);

    now = bostonTime(SATURDAY, '00:30');
    expect(await openDates(false)).toEqual([SUNDAY]);
    await runChain(SUNDAY);

    expect(await clusters()).toEqual([]);
    for (const u of ['w1', 'r3']) expect((await status(u)).status).toBe('UNMATCHED');
  });

  // covers: capacity reached
  test('venue capacity caps a cluster', async () => {
    await askAll(['d1', 'd2', 'd3', 'd4'], { selected: 'drawing' });
    await openFriday();
    await runChain(SATURDAY, JSON.stringify({ Campus: 3, Cambridge: 3, Boston: 3 }));

    expect((await clusters()).map(c => c.size)).toEqual([3]);
    expect((await status('d4')).status).toBe('UNMATCHED');
  });
});

describe('outcomes after matching', () => {
  // covers: no venue; event cancelled; declined; user requests again later
  test('no venue and a cancelled event ask for a new date; a decline closes', async () => {
    await askAll(['d1', 'd2', 'd3'], { selected: 'drawing' });
    await askAll(['p1', 'p2', 'p3'], { selected: 'painting' });
    await openFriday();
    await runChain();

    const drawing = (await clusters()).find(c => c.tag === 'drawing')!;
    const painting = (await clusters()).find(c => c.tag === 'painting')!;

    await matching.abandon({ cluster: drawing.cluster });
    expect(await status('d1')).toMatchObject({ status: 'UNMATCHED', reason: 'NO_VENUE' });

    await matching.activate({ cluster: painting.cluster, event: 'event-1' });
    const [p1, p2] = await matching._members({ cluster: painting.cluster });
    await matching.reconcile({ request: p1.request, status: 'CANCELLED', active: false, reason: 'EVENT_CANCELLED' });
    await matching.reconcile({ request: p2.request, status: 'DECLINED', active: false, reason: '' });
    expect(await status(p1.invitee)).toMatchObject({ status: 'UNMATCHED', reason: 'EVENT_CANCELLED' });
    expect(await status(p2.invitee)).toMatchObject({ status: 'CLOSED', reason: 'DECLINED' });

    // An unmatched user may request again for a later, still-open date.
    now = bostonTime(FRIDAY, '09:00');
    await ask('d1', { date: SUNDAY, selected: 'painting', interests: ['painting', 'drawing'] });
  });
});

describe('_planning', () => {
  // covers: full shared window, all shared areas, members oldest first; _completed unchanged
  test('hands over each complete cluster with its full shared window, all shared areas and members oldest first', async () => {
    await ask('a', { selected: 'drawing', from: '10:00', until: '16:00' });
    await ask('b', { selected: 'drawing', from: '11:00', until: '15:00' });
    await ask('c', { selected: 'drawing', from: '09:00', until: '14:30' });
    await openFriday();
    await runChain();

    const rows = await planning();
    expect(rows.map(r => r.date)).toEqual([SATURDAY]);

    const [c] = rows[0].clusters;
    expect(c).toMatchObject({
      tag: 'drawing',
      start: bostonTime(SATURDAY, '11:00'),
      end: bostonTime(SATURDAY, '14:30'),
      areas: ['Campus', 'Cambridge'],
    });
    expect(c.members.map(m => m.user)).toEqual(['a', 'b', 'c']);

    // _completed is unchanged: it still reports the collapsed single area and an event-length window.
    const [completed] = await clusters();
    expect(completed).toMatchObject({ cluster: c.cluster, area: 'Campus', start: c.start, end: c.start + 2 * 3600000 });
  });
});

describe('settle', () => {
  // covers: cluster with some placed and one with none; placed and unplaced members; settle again; close afterwards
  test('a cluster with a seated member is generated, unseated members get NO_VENUE, and a cluster with none is failed', async () => {
    await askAll(['d1', 'd2', 'd3', 'd4'], { selected: 'drawing' });
    await askAll(['p1', 'p2', 'p3'], { selected: 'painting' });
    await openFriday();
    await runChain();

    const [{ clusters: complete }] = await planning();
    const drawing = complete.find(c => c.tag === 'drawing')!;
    const painting = complete.find(c => c.tag === 'painting')!;
    const seated = drawing.members.slice(0, 3).map(m => m.request);

    await matching.settle({ date: SATURDAY, placed: JSON.stringify(seated) });
    for (const u of ['d1', 'd2', 'd3']) expect((await status(u)).status).toBe('MATCHED');
    for (const u of ['d4', 'p1', 'p2', 'p3'])
      expect(await status(u)).toMatchObject({ status: 'UNMATCHED', reason: 'NO_VENUE' });
    expect(await planning()).toEqual([]);
    expect(await clusters()).toEqual([]);

    // A failed cluster cannot be activated or closed, and settling again changes nothing.
    await matching.close({ cluster: painting.cluster });
    await matching.settle({ date: SATURDAY, placed: '[]' });
    expect((await status('d1')).status).toBe('MATCHED');

    // Closing a generated cluster (for example when one of its events locks) never changes its requests.
    await matching.close({ cluster: drawing.cluster });
    for (const u of ['d1', 'd2', 'd3']) expect((await status(u)).status).toBe('MATCHED');
  });
});
