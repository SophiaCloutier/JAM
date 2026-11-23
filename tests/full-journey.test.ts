import { afterAll, afterEach, expect, test } from 'bun:test';
import { buildServer } from '../src/server.ts';
import { database, closeDatabase } from '../src/database.ts';
import { addDays, bostonTime, localDay } from '../shared/catalog.ts';
process.env.MONGODB_DATABASE = `jam_full_test_${crypto.randomUUID().replaceAll('-', '')}`;
process.env.ADMIN_EMAILS = 'admin@example.edu';

let app = buildServer();
afterEach(async () => { await app.application.beginDrain(); await database().dropDatabase(); app = buildServer(); });
afterAll(async () => { await app.application.beginDrain(); await database().dropDatabase(); await closeDatabase(); });

async function call(path: string, body: object = {}, cookie = '') {
  const r = await app.handle(new Request(`http://localhost:3000/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Cookie: cookie }, body: JSON.stringify(body) }));
  return { status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
async function ok(path: string, body: object = {}, cookie = '') { const r = await call(path, body, cookie); expect(r.status).toBe(200); return r; }
/** Registers a user and adds interests in order through the profile endpoints. */
async function person(name: string, interests: string[]) {
  const { cookie } = await ok('/auth/register', { email: `${name}@example.edu`, password: 'long-test-password' });
  for (const tag of interests) await ok('/profile/addInterest', { tag }, cookie);
  return cookie;
}
const date = addDays(localDay(Date.now()), 2);
const request = (selected: string) => ({ date, start: bostonTime(date, '12:00'), end: bostonTime(date, '16:00'), selected, location: 'MIT campus', radius: 1 });
async function inbox(cookie: string) { return JSON.parse((await ok('/invitations/mine', {}, cookie)).data.inbox.invitations) as { invitation: string; event: string; details: string }[]; }
async function myRequest(cookie: string) { return JSON.parse((await ok('/requests/mine', {}, cookie)).data.pool.requests)[0] as { status: string; reason: string }; }
async function runMatching() { return ok('/admin/run', {}, await person('admin', ['drawing'])); }

test('spec scenario: related profile interests complete a group; an unrelated user is asked to choose another date', async () => {
  const a = await person('a', ['drawing', 'painting', 'photography']);
  const b = await person('b', ['drawing', 'pottery']);
  const c = await person('c', ['painting', 'drawing']);
  const d = await person('d', ['photography', 'painting']);
  const e = await person('e', ['guitar']);
  await ok('/requests/submit', request('drawing'), a); await ok('/requests/submit', request('drawing'), b);
  await ok('/requests/submit', request('painting'), c); await ok('/requests/submit', request('photography'), d);
  await ok('/requests/submit', request(''), e);
  await runMatching();
  // No chosen interest has three requesters, so profile interests form one drawing group; D qualifies through painting (0.7).
  const events = new Set<string>();
  for (const cookie of [a, b, c, d]) { const rows = await inbox(cookie); expect(rows).toHaveLength(1); events.add(rows[0].event); expect(JSON.parse(rows[0].details).tag).toBe('drawing'); }
  expect(events.size).toBe(1);
  expect(await inbox(e)).toHaveLength(0);
  expect(await myRequest(e)).toMatchObject({ status: 'UNMATCHED', reason: 'NO_MATCH' });
  // The date has been matched, so E cannot ask for it again, but may ask for a later date.
  expect((await call('/requests/submit', request('guitar'), e)).status).toBe(409);
  await ok('/requests/submit', { ...request('guitar'), date: addDays(date, 1), start: bostonTime(addDays(date, 1), '12:00'), end: bostonTime(addDays(date, 1), '16:00') }, e);
  // Three acceptances confirm the event.
  for (const cookie of [a, b, c]) await ok('/invitations/accept', { invitation: (await inbox(cookie))[0].invitation }, cookie);
  expect(JSON.parse((await ok('/events/mine', {}, a)).data.calendar.events[0].details).status).toBe('CONFIRMED');
}, 60000);

test('chosen interests form exact groups first, and Surprise me joins the smaller exact group', async () => {
  const drawers: string[] = [], painters: string[] = [];
  for (const n of ['d1', 'd2', 'd3']) { const c = await person(n, ['drawing']); drawers.push(c); await ok('/requests/submit', request('drawing'), c); }
  for (const n of ['p1', 'p2', 'p3', 'p4']) { const c = await person(n, ['painting']); painters.push(c); await ok('/requests/submit', request('painting'), c); }
  const surprise = await person('s', ['drawing', 'painting']);
  await ok('/requests/submit', request(''), surprise);
  await runMatching();
  const tag = async (cookie: string) => JSON.parse((await inbox(cookie))[0].details).tag as string;
  for (const c of drawers) expect(await tag(c)).toBe('drawing');
  for (const c of painters) expect(await tag(c)).toBe('painting');
  expect(await tag(surprise)).toBe('drawing'); // both exact; drawing had 3 members, painting 4
}, 60000);

test('a cluster bigger than the only venue open in its window is split: six get seats, the youngest two get NO_VENUE', async () => {
  // 07:00-09:00 within 1 mi of MIT reaches Campus and Cambridge; only one 6-seat sample café is open for that whole window.
  const early = { ...request('drawing'), start: bostonTime(date, '07:00'), end: bostonTime(date, '09:00') };
  const cookies: string[] = [];
  for (let i = 1; i <= 8; i++) { const c = await person(`e${i}`, ['drawing']); cookies.push(c); await ok('/requests/submit', early, c); }
  await runMatching();
  const events = new Set<string>();
  for (const c of cookies.slice(0, 6)) {
    const rows = await inbox(c); expect(rows).toHaveLength(1); events.add(rows[0].event);
    expect(await myRequest(c)).toMatchObject({ status: 'MATCHED' });
  }
  expect(events.size).toBe(1);
  for (const c of cookies.slice(6)) {
    expect(await inbox(c)).toHaveLength(0);
    expect(await myRequest(c)).toMatchObject({ status: 'UNMATCHED', reason: 'NO_VENUE' });
  }
}, 60000);

test('requests are authenticated, owner-checked and validated in the back end', async () => {
  expect((await call('/requests/submit', request('drawing'))).status).toBe(401);
  const owner = await person('owner', ['drawing']), other = await person('other', ['drawing']);
  const tooSoon = { ...request('drawing'), date: addDays(date, -1), start: bostonTime(addDays(date, -1), '12:00'), end: bostonTime(addDays(date, -1), '16:00') };
  expect((await call('/requests/submit', tooSoon, owner)).status).toBe(400); // fewer than two calendar days ahead
  expect((await call('/requests/submit', request('pottery'), owner)).status).toBe(400); // not a profile interest
  const { data } = await ok('/requests/submit', request('drawing'), owner);
  expect((await call('/requests/submit', request('drawing'), owner)).status).toBe(409); // one open request
  expect((await call('/requests/withdraw', { request: data.request }, other)).status).toBe(409);
  expect((await call('/admin/run', {}, other)).status).toBe(403);
  await ok('/requests/withdraw', { request: data.request }, owner);
  expect(await myRequest(owner)).toMatchObject({ status: 'WITHDRAWN' });
}, 60000);
