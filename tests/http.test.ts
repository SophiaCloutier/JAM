import { afterAll, expect, test } from 'bun:test';
import { database, closeDatabase } from '../src/database.ts';
import { buildServer } from '../src/server.ts';
import { InvitingConcept } from '../src/concepts/Inviting.ts';
process.env.MONGODB_DATABASE = `jam_http_test_${crypto.randomUUID().replaceAll('-', '')}`;
const app = buildServer();
async function call(path: string, body: object = {}, cookie = '', origin = 'http://localhost:3000') {
  const response = await app.handle(new Request(`http://localhost:3000/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie }, body: JSON.stringify(body) }));
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
afterAll(async () => { await app.application.beginDrain(); await database().dropDatabase(); await closeDatabase(); });
test('HTTP journey authenticates cookies, hides other inboxes, rejects forgery, and persists responses', async () => {
  expect((await call('/invitations/mine')).status).toBe(401);
  expect((await call('/auth/register', { email: 'not-college@example.com', password: 'long-password' })).status).toBe(400);
  const first = await call('/auth/register', { email: 'percy@example.edu', password: 'long-password' });
  expect(first.status).toBe(200); expect(first.cookie).toContain('jam-session=');
  const second = await call('/auth/register', { email: 'riley@example.edu', password: 'long-password' });
  expect((await call('/auth/register', { email: 'percy@example.edu', password: 'long-password' })).status).toBe(409);
  expect((await call('/invitations/mine', { session: first.cookie.split('=')[1] })).status).toBeGreaterThanOrEqual(400);
  expect((await call('/invitations/mine', {}, first.cookie, 'https://untrusted.example')).status).toBe(403);
  const inv = new InvitingConcept(); const start = Date.now() + 86400000;
  const { invitation } = await inv.invite({ invitee: 'percy@example.edu', event: 'test', request: 'request', start, end: start + 7200000, deadline: Date.now() + 21600000, details: '{}' });
  expect(JSON.parse((await call('/invitations/mine', {}, second.cookie)).body.inbox.invitations)).toHaveLength(0);
  expect((await call('/invitations/accept', { invitation }, second.cookie)).status).toBe(403);
  expect((await call('/invitations/accept', { invitation }, first.cookie)).status).toBe(200);
  expect((await call('/invitations/decline', { invitation }, first.cookie)).status).toBe(409);
  const rebuilt = buildServer();
  const response = await rebuilt.handle(new Request('http://localhost:3000/api/invitations/mine', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Cookie: first.cookie }, body: '{}' }));
  expect(JSON.parse((await response.json()).inbox.invitations)[0].status).toBe('ACCEPTED');
  await rebuilt.application.beginDrain();
  expect((await call('/auth/logout', {}, first.cookie)).status).toBe(200);
  expect((await call('/invitations/mine', {}, first.cookie)).status).toBe(401);
}, 30000);
