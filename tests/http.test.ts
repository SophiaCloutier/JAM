import { afterAll, afterEach, describe, expect, setSystemTime, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { database, closeDatabase } from '../src/database.ts';
import { buildServer } from '../src/server.ts';
import { InvitingConcept } from '../src/concepts/Inviting.ts';
import { addDays, bostonTime, localDay } from '../shared/catalog.ts';
process.env.MONGODB_DATABASE = `jam_http_test_${crypto.randomUUID().replaceAll('-', '')}`;
process.env.ADMIN_EMAILS = 'admin@example.edu';

/*
 * Testing strategy (the real HTTP handler; each test starts from an empty database)
 *
 * Every endpoint declared in design/compositions/Application.md is called at least once;
 * the last test checks this.
 *
 * Authentication (/auth/current and every session-protected endpoint)
 *   partition on session:
 *     - no cookie
 *     - valid cookie
 *     - session id forged in the body
 *     - expired session
 *     - logged out
 *
 * Registration (/auth/register)
 *   partition on email:
 *     - non-college email
 *     - new .edu email
 *     - email already registered
 *
 * Login (/auth/login)
 *   partition on credentials:
 *     - correct password
 *     - wrong password
 *     - unknown email
 *
 * Origin
 *   partition on origin:
 *     - trusted
 *     - untrusted
 *
 * Profile (/profile/mine, /profile/addInterest, /profile/removeInterest)
 *   partition on tag:
 *     - present
 *     - absent
 *
 * Requests (/requests/mine, /requests/submit, /requests/withdraw)
 *   - submit, read back, withdraw
 *
 * Inbox and responses (/invitations/*)
 *   partition on caller:
 *     - owner
 *     - another signed-in user
 *   partition on state:
 *     - pending
 *     - accepted
 *     - already cancelled
 *
 * Admin (/admin/events, /admin/run, /admin/cancel) and /events/mine
 *   partition on caller:
 *     - not an admin
 *     - admin
 *
 * Persistence
 *   - a response survives building a new server on the same database
 */

const ORIGIN = 'http://localhost:3000';
const TIMEOUT = 30000;
const PASSWORD = 'long-password';
const DAY = 86400000;

let app = buildServer();

/** Every path this file has sent a request to, for the coverage check at the end. */
const hit = new Set<string>();

async function call(path: string, body: object = {}, cookie = '', origin = ORIGIN, server = app) {
  hit.add(path);
  const response = await server.handle(new Request(`${ORIGIN}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify(body),
  }));
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '',
  };
}

function register(email: string) {
  return call('/auth/register', { email, password: PASSWORD });
}

function login(email: string, password = PASSWORD) {
  return call('/auth/login', { email, password });
}

/** Registers a user and returns their session cookie. */
async function signedIn(email: string) {
  const { status, cookie } = await register(email);
  expect(status).toBe(200);
  return cookie;
}

/** Delivers a pending invitation straight through Inviting (there is no public endpoint that creates one). */
async function invite(invitee: string) {
  const start = Date.now() + DAY;
  const { invitation } = await new InvitingConcept().invite({
    invitee,
    event: 'test',
    request: 'request',
    start,
    end: start + 7200000,
    deadline: Date.now() + 21600000,
    details: '{}',
  });
  return invitation;
}

async function inbox(cookie: string, server = app) {
  const { body } = await call('/invitations/mine', {}, cookie, ORIGIN, server);
  return JSON.parse(body.inbox.invitations) as { status: string; reason: string; event: string; invitation: string }[];
}

async function interests(cookie: string) {
  const { body } = await call('/profile/mine', {}, cookie);
  return JSON.parse(body.profile.interests) as string[];
}

/** A request for the earliest requestable date, free 12:00-16:00 near MIT. */
function request(selected: string) {
  const date = addDays(localDay(Date.now()), 2);
  return { date, start: bostonTime(date, '12:00'), end: bostonTime(date, '16:00'), selected, location: 'MIT campus', radius: 1 };
}

async function myRequests(cookie: string) {
  const { body } = await call('/requests/mine', {}, cookie);
  return JSON.parse(body.pool.requests) as { request: string; status: string }[];
}

afterEach(async () => {
  setSystemTime();
  await app.application.beginDrain();
  await database().dropDatabase();
  app = buildServer();
});
afterAll(async () => {
  await app.application.beginDrain();
  await database().dropDatabase();
  await closeDatabase();
});

describe('authentication', () => {
  // covers: no cookie
  test('a request without a session cookie is refused', async () => {
    expect((await call('/invitations/mine')).status).toBe(401);
    expect((await call('/auth/current')).status).toBe(401);
  }, TIMEOUT);

  // covers: valid cookie
  test('a signed-in user can read their inbox and who they are', async () => {
    const cookie = await signedIn('percy@example.edu');
    expect((await call('/invitations/mine', {}, cookie)).status).toBe(200);

    const current = await call('/auth/current', {}, cookie);
    expect(current.status).toBe(200);
    expect(current.body.user).toBe('percy@example.edu');
  }, TIMEOUT);

  // covers: session id forged in the body
  test('a session id sent in the body instead of the cookie is refused', async () => {
    const cookie = await signedIn('percy@example.edu');
    const session = cookie.split('=')[1];
    expect((await call('/invitations/mine', { session })).status).toBeGreaterThanOrEqual(400);
  }, TIMEOUT);

  // covers: expired session
  test('a session older than seven days is refused, and signing in again works', async () => {
    const cookie = await signedIn('percy@example.edu');

    setSystemTime(new Date(Date.now() + 7 * DAY + 60000));
    expect((await call('/auth/current', {}, cookie)).status).toBe(401);
    expect((await call('/invitations/mine', {}, cookie)).status).toBe(401);

    const fresh = await login('percy@example.edu');
    expect(fresh.status).toBe(200);
    expect((await call('/auth/current', {}, fresh.cookie)).status).toBe(200);
  }, TIMEOUT);

  // covers: logged out
  test('after logout the old cookie no longer works', async () => {
    const cookie = await signedIn('percy@example.edu');
    expect((await call('/auth/logout', {}, cookie)).status).toBe(200);
    expect((await call('/invitations/mine', {}, cookie)).status).toBe(401);
    expect((await call('/auth/current', {}, cookie)).status).toBe(401);
  }, TIMEOUT);
});

describe('registration', () => {
  // covers: non-college email
  test('a non-college email is refused', async () => {
    expect((await register('not-college@example.com')).status).toBe(400);
  }, TIMEOUT);

  // covers: new .edu email
  test('a new .edu email registers and receives a session cookie', async () => {
    const first = await register('percy@example.edu');
    expect(first.status).toBe(200);
    expect(first.cookie).toContain('jam-session=');
  }, TIMEOUT);

  // covers: email already registered
  test('an email that is already registered is refused', async () => {
    await signedIn('percy@example.edu');
    expect((await register('percy@example.edu')).status).toBe(409);
  }, TIMEOUT);
});

describe('login', () => {
  // covers: correct password
  test('the right password starts a new session for the same user', async () => {
    const first = await signedIn('percy@example.edu');
    const again = await login('Percy@Example.edu ');

    expect(again.status).toBe(200);
    expect(again.cookie).toContain('jam-session=');
    expect(again.cookie).not.toBe(first);
    expect((await call('/auth/current', {}, again.cookie)).body.user).toBe('percy@example.edu');
  }, TIMEOUT);

  // covers: wrong password
  test('a wrong password is refused without a session', async () => {
    await signedIn('percy@example.edu');
    const wrong = await login('percy@example.edu', 'not-the-password');
    expect(wrong.status).toBe(401);
    expect(wrong.cookie).toBe('');
  }, TIMEOUT);

  // covers: unknown email
  test('an unknown email is refused the same way', async () => {
    const unknown = await login('nobody@example.edu');
    expect(unknown.status).toBe(401);
    expect(unknown.cookie).toBe('');
  }, TIMEOUT);
});

describe('origin', () => {
  // covers: untrusted origin (trusted origin is used by every other test)
  test('a request from an untrusted origin is refused even with a valid cookie', async () => {
    const cookie = await signedIn('percy@example.edu');
    expect((await call('/invitations/mine', {}, cookie, 'https://untrusted.example')).status).toBe(403);
  }, TIMEOUT);
});

describe('profile', () => {
  // covers: add, read back, remove a present tag, remove an absent tag
  test('interests can be added, read back and removed', async () => {
    const cookie = await signedIn('percy@example.edu');
    expect(await interests(cookie)).toEqual([]);

    expect((await call('/profile/addInterest', { tag: 'Pottery' }, cookie)).body.tag).toBe('pottery');
    await call('/profile/addInterest', { tag: 'guitar' }, cookie);
    expect(await interests(cookie)).toEqual(['pottery', 'guitar']);

    expect((await call('/profile/removeInterest', { tag: 'pottery' }, cookie)).status).toBe(200);
    expect(await interests(cookie)).toEqual(['guitar']);

    expect((await call('/profile/removeInterest', { tag: 'drawing' }, cookie)).status).toBe(200);
    expect(await interests(cookie)).toEqual(['guitar']);
  }, TIMEOUT);

  // covers: no cookie on the profile endpoints
  test('profile endpoints need a session', async () => {
    expect((await call('/profile/mine')).status).toBe(401);
    expect((await call('/profile/removeInterest', { tag: 'guitar' })).status).toBe(401);
  }, TIMEOUT);
});

describe('requests', () => {
  // covers: submit, read back, withdraw
  test('a request can be submitted, read back and withdrawn', async () => {
    const cookie = await signedIn('percy@example.edu');
    await call('/profile/addInterest', { tag: 'drawing' }, cookie);

    const submitted = await call('/requests/submit', request('drawing'), cookie);
    expect(submitted.status).toBe(200);
    expect(await myRequests(cookie)).toMatchObject([{ request: submitted.body.request, status: 'PENDING' }]);

    expect((await call('/requests/withdraw', { request: submitted.body.request }, cookie)).status).toBe(200);
    expect(await myRequests(cookie)).toMatchObject([{ status: 'WITHDRAWN' }]);
  }, TIMEOUT);
});

describe('inbox and responses', () => {
  // covers: another signed-in user (reading and answering)
  test('another user cannot see or answer someone else\'s invitation', async () => {
    await signedIn('percy@example.edu');
    const riley = await signedIn('riley@example.edu');
    const invitation = await invite('percy@example.edu');

    expect(await inbox(riley)).toHaveLength(0);
    expect((await call('/invitations/accept', { invitation }, riley)).status).toBe(403);
  }, TIMEOUT);

  // covers: owner; pending; accepted
  test('the owner can accept a pending invitation once, and cannot then decline it', async () => {
    const percy = await signedIn('percy@example.edu');
    const invitation = await invite('percy@example.edu');

    expect((await call('/invitations/accept', { invitation }, percy)).status).toBe(200);
    expect((await call('/invitations/decline', { invitation }, percy)).status).toBe(409);
  }, TIMEOUT);

  // covers: owner cancelling an accepted invitation; pending; already cancelled; another user
  test('only the owner can cancel, and only an accepted invitation, once', async () => {
    const percy = await signedIn('percy@example.edu');
    const riley = await signedIn('riley@example.edu');
    const invitation = await invite('percy@example.edu');

    expect((await call('/invitations/cancel', { invitation }, percy)).status).toBe(409); // still pending
    await call('/invitations/accept', { invitation }, percy);
    expect((await call('/invitations/cancel', { invitation }, riley)).status).toBe(403);

    expect((await call('/invitations/cancel', { invitation }, percy)).status).toBe(200);
    expect((await inbox(percy))[0]).toMatchObject({ status: 'CANCELLED', reason: 'YOU_CANCELLED' });
    expect((await call('/invitations/cancel', { invitation }, percy)).status).toBe(409); // already cancelled
  }, TIMEOUT);
});

describe('admin and events', () => {
  // covers: not an admin, on every admin endpoint
  test('admin endpoints refuse a signed-in user who is not an admin', async () => {
    const cookie = await signedIn('percy@example.edu');
    expect((await call('/admin/events', {}, cookie)).status).toBe(403);
    expect((await call('/admin/run', {}, cookie)).status).toBe(403);
    expect((await call('/admin/cancel', { event: 'any' }, cookie)).status).toBe(403);
  }, TIMEOUT);

  // covers: admin running matching, listing events and cancelling one; /events/mine
  test('an admin runs matching, sees the event, and cancels it; members see it cancelled', async () => {
    const members: string[] = [];
    for (const name of ['m1', 'm2', 'm3']) {
      const cookie = await signedIn(`${name}@example.edu`);
      await call('/profile/addInterest', { tag: 'drawing' }, cookie);
      await call('/requests/submit', request('drawing'), cookie);
      members.push(cookie);
    }
    const admin = await signedIn('admin@example.edu');

    expect((await call('/admin/run', {}, admin)).status).toBe(200);

    const listed = await call('/admin/events', {}, admin);
    expect(listed.status).toBe(200);
    const [event] = JSON.parse(listed.body.admin.events) as { event: string; status: string }[];
    expect(event.status).toBe('FORMING');

    const mine = await call('/events/mine', {}, members[0]);
    expect(mine.status).toBe(200);
    expect(mine.body.calendar.events[0].event).toBe(event.event);

    expect((await call('/admin/cancel', { event: event.event }, admin)).status).toBe(200);
    const after = await call('/events/mine', {}, members[0]);
    expect(JSON.parse(after.body.calendar.events[0].details).status).toBe('CANCELLED');
  }, TIMEOUT);
});

describe('persistence', () => {
  // covers: a response survives building a new server on the same database
  test('an accepted invitation is still accepted after the server is rebuilt', async () => {
    const percy = await signedIn('percy@example.edu');
    const invitation = await invite('percy@example.edu');
    expect((await call('/invitations/accept', { invitation }, percy)).status).toBe(200);

    const rebuilt = buildServer();
    try {
      expect((await inbox(percy, rebuilt))[0].status).toBe('ACCEPTED');
    } finally {
      await rebuilt.application.beginDrain();
    }
  }, TIMEOUT);
});

describe('endpoint coverage', () => {
  // Runs last (bun runs a file's tests in order): every declared endpoint must have been called above.
  test('every endpoint in Application.md was called by this file', () => {
    const design = readFileSync(resolve(import.meta.dir, '../design/compositions/Application.md'), 'utf8');
    const declared = [...design.matchAll(/^\S+ at (\/\S+)$/gm)].map(m => m[1]);
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter(path => !hit.has(path))).toEqual([]);
  });
});
