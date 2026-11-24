import { afterAll, afterEach, describe, expect, setSystemTime, test } from 'bun:test';
import { buildServer } from '../src/server.ts';
import { database, closeDatabase } from '../src/database.ts';
import { timing } from '../src/config.ts';
import { MatchingConcept } from '../src/concepts/Matching.ts';
import { EventGeneratingConcept } from '../src/concepts/EventGenerating.ts';
import { addDays, bostonTime, localDay } from '../shared/catalog.ts';
process.env.MONGODB_DATABASE = `jam_full_test_${crypto.randomUUID().replaceAll('-', '')}`;
process.env.ADMIN_EMAILS = 'admin@example.edu';

/*
 * Testing strategy (HTTP endpoints and every reaction: Matching -> EventGenerating -> Inviting)
 *
 * Matching outcome
 *   partition on grouping:
 *     - exact chosen groups
 *     - profile-interest group (related 0.7)
 *     - Surprise me joining the smaller group
 *     - chosen interest with no group, falling back to an exact profile interest
 *     - Surprise me only (no chosen interests; the group forms from profile interests)
 *     - no match (NO_MATCH)
 *
 * Event planning outcome
 *   partition on seats:
 *     - whole cluster seated
 *     - cluster split, some members without a seat (NO_VENUE)
 *
 * After matching
 *   partition on a new request:
 *     - for the matched date (refused)
 *     - for a later date (allowed)
 *   partition on acceptances:
 *     - three acceptances confirm the event
 *
 * Event lifecycle (time moved with setSystemTime; scheduled work via app.poke(), as the host timer does)
 *   partition on cancel after accepting:
 *     - before the cutoff: the event drops back to forming
 *     - after the cutoff: the event is cancelled at once
 *   partition on the cutoff review:
 *     - fewer than three accepted: event cancelled
 *   partition on each invitation when an event is cancelled:
 *     - accepted: request becomes EVENT_CANCELLED
 *     - pending, before its deadline: request becomes EVENT_CANCELLED
 *     - pending, past its deadline (silence): request closes as EXPIRED
 *     - cancelled by its owner: request stays closed as YOU_CANCELLED
 *   partition on /admin/cancel caller and target:
 *     - not an admin
 *     - admin, upcoming event
 *     - admin, unknown event
 *
 * Recovery (concepts called directly to stop mid-chain, then the host restarts with app.poke())
 *   partition on the crash point:
 *     - after matching finished, before planning (RecoverDrafts)
 *     - after planning, before invitations (RecoverDeliveries)
 *   partition on repeats:
 *     - first restart
 *     - later restarts deliver nothing twice
 *
 * Request endpoints
 *   partition on caller:
 *     - not signed in
 *     - owner
 *     - another user
 *     - non-admin running matching
 *   partition on input:
 *     - too soon
 *     - interest not in profile
 *     - second open request
 */

const ORIGIN = 'http://localhost:3000';
const date = addDays(localDay(Date.now()), 2);

let app = buildServer();

type Invitation = { invitation: string; event: string; details: string; start: number; end: number; status: string; reason: string };

async function call(path: string, body: object = {}, cookie = '') {
  const r = await app.handle(new Request(`${ORIGIN}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify(body),
  }));
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get('set-cookie')?.split(';')[0] ?? '',
  };
}

/** Calls an endpoint and expects success. */
async function ok(path: string, body: object = {}, cookie = '') {
  const r = await call(path, body, cookie);
  expect(r.status).toBe(200);
  return r;
}

/** Registers a user and adds interests in order through the profile endpoints. */
async function person(name: string, interests: string[]) {
  const { cookie } = await ok('/auth/register', { email: `${name}@example.edu`, password: 'long-test-password' });
  for (const tag of interests) await ok('/profile/addInterest', { tag }, cookie);
  return cookie;
}

/** A request body for `day` (default: the earliest requestable date), free 12:00-16:00 near MIT. */
function request(selected: string, day = date, from = '12:00', until = '16:00') {
  return {
    date: day,
    start: bostonTime(day, from),
    end: bostonTime(day, until),
    selected,
    location: 'MIT campus',
    radius: 1,
  };
}

async function submit(cookie: string, selected: string) {
  return ok('/requests/submit', request(selected), cookie);
}

async function inbox(cookie: string) {
  const { data } = await ok('/invitations/mine', {}, cookie);
  return JSON.parse(data.inbox.invitations) as Invitation[];
}

async function myRequest(cookie: string) {
  const { data } = await ok('/requests/mine', {}, cookie);
  return JSON.parse(data.pool.requests)[0] as { status: string; reason: string };
}

async function tagOf(cookie: string) {
  const [invitation] = await inbox(cookie);
  return JSON.parse(invitation.details).tag as string;
}

/** The admin's session cookie, registered once per test. */
let adminCookie = '';
async function asAdmin() {
  adminCookie ||= await person('admin', ['drawing']);
  return adminCookie;
}

async function runMatching() {
  return ok('/admin/run', {}, await asAdmin());
}

/** The status in the live event details the user sees on My events. */
async function eventStatus(cookie: string) {
  const { data } = await ok('/events/mine', {}, cookie);
  return JSON.parse(data.calendar.events[0].details).status as string;
}

async function accept(cookie: string) {
  const [invitation] = await inbox(cookie);
  return ok('/invitations/accept', { invitation: invitation.invitation }, cookie);
}

/** Three people who chose `tag` for the earliest date, submitted in order. */
async function threeRequests(tag = 'drawing') {
  const cookies: string[] = [];
  for (const name of ['m1', 'm2', 'm3']) {
    const cookie = await person(name, [tag]);
    cookies.push(cookie);
    await submit(cookie, tag);
  }
  return cookies;
}

/** Three people matched and invited to one event. Returns their cookies and the event's start. */
async function invitedGroup() {
  const cookies = await threeRequests();
  await runMatching();
  const [invitation] = await inbox(cookies[0]);
  return { cookies, start: invitation.start };
}

/** Moves the clock to just after the event's cutoff. */
function passCutoff(start: number) {
  setSystemTime(new Date(start - timing.cutoff + 60000));
}

/** Simulates a crash: runs Matching for the date with the concepts directly, so no reaction plans or invites. */
async function matchWithoutReactions() {
  const matching = new MatchingConcept();
  const { limits } = await new EventGeneratingConcept()._limits({});
  await matching.openDue({ force: true });
  const { candidates } = await matching._chosen({ date });
  await matching.form({ date, stage: 'chosen', candidates, minScore: 1, limits });
  await matching.finish({ date });
  return matching;
}

afterEach(async () => {
  setSystemTime();
  adminCookie = '';
  await app.application.beginDrain();
  await database().dropDatabase();
  app = buildServer();
});
afterAll(async () => {
  await app.application.beginDrain();
  await database().dropDatabase();
  await closeDatabase();
});

describe('matching and planning end to end', () => {
  // covers: profile-interest group (related 0.7); NO_MATCH; whole cluster seated; request again; three acceptances
  test('spec scenario: related profile interests complete a group; an unrelated user is asked to choose another date', async () => {
    const a = await person('a', ['drawing', 'painting', 'photography']);
    const b = await person('b', ['drawing', 'pottery']);
    const c = await person('c', ['painting', 'drawing']);
    const d = await person('d', ['photography', 'painting']);
    const e = await person('e', ['guitar']);
    await submit(a, 'drawing');
    await submit(b, 'drawing');
    await submit(c, 'painting');
    await submit(d, 'photography');
    await submit(e, '');
    await runMatching();

    // No chosen interest has three requesters, so profile interests form one drawing group; D qualifies through painting (0.7).
    const events = new Set<string>();
    for (const cookie of [a, b, c, d]) {
      const rows = await inbox(cookie);
      expect(rows).toHaveLength(1);
      events.add(rows[0].event);
      expect(JSON.parse(rows[0].details).tag).toBe('drawing');
    }
    expect(events.size).toBe(1);
    expect(await inbox(e)).toHaveLength(0);
    expect(await myRequest(e)).toMatchObject({ status: 'UNMATCHED', reason: 'NO_MATCH' });

    // The date has been matched, so E cannot ask for it again, but may ask for a later date.
    expect((await call('/requests/submit', request('guitar'), e)).status).toBe(409);
    await ok('/requests/submit', request('guitar', addDays(date, 1)), e);

    // Three acceptances confirm the event.
    for (const cookie of [a, b, c]) {
      const [invitation] = await inbox(cookie);
      await ok('/invitations/accept', { invitation: invitation.invitation }, cookie);
    }
    const { data } = await ok('/events/mine', {}, a);
    expect(JSON.parse(data.calendar.events[0].details).status).toBe('CONFIRMED');
  }, 60000);

  // covers: exact chosen groups; Surprise me joining the smaller group
  test('chosen interests form exact groups first, and Surprise me joins the smaller exact group', async () => {
    const drawers: string[] = [];
    const painters: string[] = [];
    for (const name of ['d1', 'd2', 'd3']) {
      const cookie = await person(name, ['drawing']);
      drawers.push(cookie);
      await submit(cookie, 'drawing');
    }
    for (const name of ['p1', 'p2', 'p3', 'p4']) {
      const cookie = await person(name, ['painting']);
      painters.push(cookie);
      await submit(cookie, 'painting');
    }
    const surprise = await person('s', ['drawing', 'painting']);
    await submit(surprise, '');
    await runMatching();

    for (const cookie of drawers) expect(await tagOf(cookie)).toBe('drawing');
    for (const cookie of painters) expect(await tagOf(cookie)).toBe('painting');
    expect(await tagOf(surprise)).toBe('drawing'); // both exact; drawing had 3 members, painting 4
  }, 60000);

  // covers: chosen interest with no group, falling back to an exact profile interest
  test('option 1 fallback: a chosen interest with no group joins a group through an exact profile interest', async () => {
    // Pottery has no group and no related interest, so the chosen-interest stages cannot place this person;
    // only the profile-interest stages (join on profile interests, then join leftovers) can put them in the drawing group.
    const drawers: string[] = [];
    for (const name of ['d1', 'd2', 'd3']) {
      const cookie = await person(name, ['drawing']);
      drawers.push(cookie);
      await submit(cookie, 'drawing');
    }
    const potter = await person('potter', ['pottery', 'drawing']);
    await submit(potter, 'pottery');
    await runMatching();

    const [invitation] = await inbox(potter);
    expect(invitation).toBeDefined();
    expect(JSON.parse(invitation.details).tag).toBe('drawing');
    expect(await myRequest(potter)).toMatchObject({ status: 'MATCHED' });
    for (const cookie of drawers) {
      expect((await inbox(cookie))[0].event).toBe(invitation.event);
    }
  }, 60000);

  // covers: Surprise me only (no chosen interests; the group forms from profile interests); NO_MATCH
  test('option 2 alone: Surprise me requests form a group from shared profile interests', async () => {
    // Nobody chose an interest, so the chosen stages do nothing and the group must come from profile interests.
    const knitters: string[] = [];
    for (const [name, interests] of [['k1', ['knitting', 'origami']], ['k2', ['knitting']], ['k3', ['guitar', 'knitting']]] as const) {
      const cookie = await person(name, [...interests]);
      knitters.push(cookie);
      await submit(cookie, '');
    }
    const loner = await person('loner', ['creative writing']);
    await submit(loner, '');
    await runMatching();

    const events = new Set<string>();
    for (const cookie of knitters) {
      const rows = await inbox(cookie);
      expect(rows).toHaveLength(1);
      expect(JSON.parse(rows[0].details).tag).toBe('knitting');
      events.add(rows[0].event);
      expect(await myRequest(cookie)).toMatchObject({ status: 'MATCHED' });
    }
    expect(events.size).toBe(1);

    expect(await inbox(loner)).toHaveLength(0);
    expect(await myRequest(loner)).toMatchObject({ status: 'UNMATCHED', reason: 'NO_MATCH' });
  }, 60000);

  // covers: cluster split, some members without a seat (NO_VENUE)
  test('a cluster bigger than the only venue open in its window is split: six get seats, the youngest two get NO_VENUE', async () => {
    // 07:00-09:00 within 1 mi of MIT reaches Campus and Cambridge; only one 6-seat sample café is open for that whole window.
    const early = request('drawing', date, '07:00', '09:00');
    const cookies: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const cookie = await person(`e${i}`, ['drawing']);
      cookies.push(cookie);
      await ok('/requests/submit', early, cookie);
    }
    await runMatching();

    const events = new Set<string>();
    for (const cookie of cookies.slice(0, 6)) {
      const rows = await inbox(cookie);
      expect(rows).toHaveLength(1);
      events.add(rows[0].event);
      expect(await myRequest(cookie)).toMatchObject({ status: 'MATCHED' });
    }
    expect(events.size).toBe(1);

    for (const cookie of cookies.slice(6)) {
      expect(await inbox(cookie)).toHaveLength(0);
      expect(await myRequest(cookie)).toMatchObject({ status: 'UNMATCHED', reason: 'NO_VENUE' });
    }
  }, 60000);
});

describe('request endpoints', () => {
  // covers: not signed in; too soon; interest not in profile; second open request; another user; non-admin; owner
  test('requests are authenticated, owner-checked and validated in the back end', async () => {
    expect((await call('/requests/submit', request('drawing'))).status).toBe(401);

    const owner = await person('owner', ['drawing']);
    const other = await person('other', ['drawing']);

    const tooSoon = request('drawing', addDays(date, -1));
    expect((await call('/requests/submit', tooSoon, owner)).status).toBe(400); // fewer than two calendar days ahead
    expect((await call('/requests/submit', request('pottery'), owner)).status).toBe(400); // not a profile interest

    const { data } = await submit(owner, 'drawing');
    expect((await call('/requests/submit', request('drawing'), owner)).status).toBe(409); // one open request
    expect((await call('/requests/withdraw', { request: data.request }, other)).status).toBe(409);
    expect((await call('/admin/run', {}, other)).status).toBe(403);

    await ok('/requests/withdraw', { request: data.request }, owner);
    expect(await myRequest(owner)).toMatchObject({ status: 'WITHDRAWN' });
  }, 60000);
});

describe('event lifecycle', () => {
  // covers: cancel after accepting, before the cutoff
  test('cancelling after accepting drops a confirmed event below three; before the cutoff it goes back to forming', async () => {
    const { cookies: [a, b, c] } = await invitedGroup();
    for (const cookie of [a, b, c]) await accept(cookie);
    expect(await eventStatus(a)).toBe('CONFIRMED');

    const [invitation] = await inbox(c);
    await ok('/invitations/cancel', { invitation: invitation.invitation }, c);

    expect(await eventStatus(a)).toBe('FORMING');
    expect((await inbox(c))[0]).toMatchObject({ status: 'CANCELLED', reason: 'YOU_CANCELLED' });
    expect(await myRequest(c)).toMatchObject({ status: 'CLOSED', reason: 'YOU_CANCELLED' });
    for (const cookie of [a, b]) expect(await myRequest(cookie)).toMatchObject({ status: 'MATCHED' });
  }, 60000);

  // covers: cancel after accepting, after the cutoff; accepted and owner-cancelled invitations
  test('cancelling after the cutoff drops the event below three and cancels it at once', async () => {
    const { cookies: [a, b, c], start } = await invitedGroup();
    for (const cookie of [a, b, c]) await accept(cookie);

    passCutoff(start);
    const [invitation] = await inbox(c);
    await ok('/invitations/cancel', { invitation: invitation.invitation }, c);

    expect(await eventStatus(a)).toBe('CANCELLED');
    for (const cookie of [a, b]) {
      expect((await inbox(cookie))[0]).toMatchObject({ status: 'CANCELLED', reason: 'EVENT_CANCELLED' });
      expect(await myRequest(cookie)).toMatchObject({ status: 'UNMATCHED', reason: 'EVENT_CANCELLED' });
    }
    expect(await myRequest(c)).toMatchObject({ status: 'CLOSED', reason: 'YOU_CANCELLED' });
  }, 60000);

  // covers: cutoff review with fewer than three accepted; accepted and silent (past deadline) invitations
  test('reviewDue at the cutoff cancels an event short of three, and accepted requests become EVENT_CANCELLED', async () => {
    const { cookies: [a, b, c], start } = await invitedGroup();
    await accept(a);
    await accept(b);

    passCutoff(start);
    await app.poke();

    expect(await eventStatus(a)).toBe('CANCELLED');
    for (const cookie of [a, b]) {
      expect((await inbox(cookie))[0]).toMatchObject({ status: 'CANCELLED', reason: 'EVENT_CANCELLED' });
      expect(await myRequest(cookie)).toMatchObject({ status: 'UNMATCHED', reason: 'EVENT_CANCELLED' });
    }
    // C never answered: the invitation expired at its deadline, before the cutoff, so the request closes as expired.
    expect((await inbox(c))[0]).toMatchObject({ status: 'EXPIRED' });
    expect(await myRequest(c)).toMatchObject({ status: 'CLOSED', reason: 'EXPIRED' });

    // A later review changes nothing.
    await app.poke();
    expect(await myRequest(a)).toMatchObject({ status: 'UNMATCHED', reason: 'EVENT_CANCELLED' });
  }, 60000);

  // covers: /admin/cancel by a non-admin, by an admin for an upcoming event and for an unknown event;
  //         accepted and pending (before deadline) invitations
  test('/admin/cancel is admin-only and cancels the event; every member is asked to choose another date', async () => {
    const { cookies: [a, b, c] } = await invitedGroup();
    await accept(a);
    const [{ event }] = await inbox(a);

    expect((await call('/admin/cancel', { event }, b)).status).toBe(403);
    expect(await eventStatus(a)).toBe('FORMING');

    await ok('/admin/cancel', { event }, await asAdmin());

    expect(await eventStatus(a)).toBe('CANCELLED');
    expect((await inbox(a))[0]).toMatchObject({ status: 'CANCELLED', reason: 'EVENT_CANCELLED' });
    for (const cookie of [b, c]) {
      expect((await inbox(cookie))[0]).toMatchObject({ status: 'EXPIRED', reason: 'EVENT_CANCELLED' });
    }
    for (const cookie of [a, b, c]) {
      expect(await myRequest(cookie)).toMatchObject({ status: 'UNMATCHED', reason: 'EVENT_CANCELLED' });
    }

    expect((await call('/admin/cancel', { event: 'no-such-event' }, await asAdmin())).status).toBe(409);
  }, 60000);
});

describe('recovery after a crash', () => {
  // covers: crash after matching finished, before planning; first and later restarts
  test('re-running openDue plans and invites a date whose matching finished before the crash (RecoverDrafts)', async () => {
    const cookies = await threeRequests();
    const matching = await matchWithoutReactions();
    expect((await matching._planning({})).map(r => r.date)).toEqual([date]);
    for (const cookie of cookies) expect(await inbox(cookie)).toHaveLength(0);

    await app.poke(); // the restarted host's first scheduled run

    const events = new Set<string>();
    for (const cookie of cookies) {
      const rows = await inbox(cookie);
      expect(rows).toHaveLength(1);
      events.add(rows[0].event);
      expect(await myRequest(cookie)).toMatchObject({ status: 'MATCHED' });
    }
    expect(events.size).toBe(1);
    expect(await matching._planning({})).toEqual([]);

    // Later runs plan and deliver nothing twice.
    await app.poke();
    for (const cookie of cookies) {
      const rows = await inbox(cookie);
      expect(rows).toHaveLength(1);
      expect(events.has(rows[0].event)).toBe(true);
    }
  }, 60000);

  // covers: crash after planning, before invitations; first and later restarts
  test('re-running openDue delivers invitations for an event planned before the crash (RecoverDeliveries)', async () => {
    const cookies = await threeRequests();
    const matching = await matchWithoutReactions();
    const events = new EventGeneratingConcept();
    const [{ clusters }] = await matching._planning({});
    const { plan } = await events.plan({ date, clusters });
    await matching.settle({ date, placed: (await events._placed({ plan })).placed });
    const [planned] = await events._planned({ plan });
    for (const cookie of cookies) expect(await inbox(cookie)).toHaveLength(0);

    await app.poke(); // the restarted host's first scheduled run

    for (const cookie of cookies) {
      const rows = await inbox(cookie);
      expect(rows).toHaveLength(1);
      expect(rows[0].event).toBe(planned.event);
      expect(await myRequest(cookie)).toMatchObject({ status: 'MATCHED' });
    }

    // Later runs deliver nothing twice.
    await app.poke();
    for (const cookie of cookies) expect(await inbox(cookie)).toHaveLength(1);
  }, 60000);
});
