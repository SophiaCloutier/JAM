import { afterAll, beforeEach, expect, test } from 'bun:test';
import { database, closeDatabase } from '../src/database.ts';
import { InvitingConcept, InvitationForbidden, InvitationUnavailable } from '../src/concepts/Inviting.ts';
process.env.MONGODB_DATABASE = `jam_inviting_test_${crypto.randomUUID().replaceAll('-', '')}`;
let now = Date.now();
const inviting = new InvitingConcept(() => now);
const delivery = (invitee = 'a', event = 'event') => ({ invitee, event, request: `request-${invitee}`, start: now + 86400000, end: now + 93600000, deadline: now + 21600000, details: '{}' });
beforeEach(async () => { await database().collection('invitations').deleteMany({}); });
afterAll(async () => { await database().dropDatabase(); await closeDatabase(); });
test('operational principle: deliver, accept, cancel exactly once', async () => {
  const { invitation } = await inviting.invite(delivery());
  expect(await inviting.invite(delivery())).toEqual({ invitation });
  await inviting.accept({ invitation, invitee: 'a' });
  expect((await inviting._count({ event: 'event' })).count).toBe(1);
  await inviting.cancel({ invitation, invitee: 'a' });
  await expect(inviting.cancel({ invitation, invitee: 'a' })).rejects.toBeInstanceOf(InvitationUnavailable);
  expect(JSON.parse((await inviting._mine({ invitee: 'a' })).invitations)[0]).toMatchObject({ status: 'CANCELLED', reason: 'YOU_CANCELLED', active: false });
});
test('one active invite and owner authorization are enforced in storage', async () => {
  const { invitation } = await inviting.invite(delivery());
  await expect(inviting.invite(delivery('a', 'another'))).rejects.toBeInstanceOf(InvitationUnavailable);
  await expect(inviting.accept({ invitation, invitee: 'intruder' })).rejects.toBeInstanceOf(InvitationForbidden);
  await inviting.decline({ invitation, invitee: 'a' });
  await expect(inviting.accept({ invitation, invitee: 'a' })).rejects.toBeInstanceOf(InvitationUnavailable);
  await inviting.invite(delivery('a', 'another'));
});
test('expiry is lazy: at the deadline responses are refused, reads show EXPIRED, and the lock is released', async () => {
  const input = delivery(); const { invitation } = await inviting.invite(input);
  now = input.deadline;
  await expect(inviting.accept({ invitation, invitee: 'a' })).rejects.toBeInstanceOf(InvitationUnavailable);
  await expect(inviting.decline({ invitation, invitee: 'a' })).rejects.toBeInstanceOf(InvitationUnavailable);
  // No periodic job ran, yet every read reports the overdue invitation as expired and inactive.
  expect(JSON.parse((await inviting._mine({ invitee: 'a' })).invitations)[0]).toMatchObject({ status: 'EXPIRED', active: false });
  expect((await inviting._all({})).find(r => r.invitation === invitation)).toMatchObject({ status: 'EXPIRED', active: false });
  // The stale row must not block the next invitation through the one-active-invitation index.
  await inviting.invite(delivery('a', 'another'));
});
test('closing a cancelled event keeps expired invitations distinct from event cancellations', async () => {
  const input = delivery(); const { invitation } = await inviting.invite(input);
  const { invitation: other } = await inviting.invite(delivery('b'));
  await inviting.accept({ invitation: other, invitee: 'b' });
  now = input.deadline;
  await inviting.closeEvent({ event: 'event', cancelled: true });
  const rows = await inviting._all({});
  expect(rows.find(r => r.invitation === invitation)).toMatchObject({ status: 'EXPIRED', reason: '' });
  expect(rows.find(r => r.invitation === other)).toMatchObject({ status: 'CANCELLED', reason: 'EVENT_CANCELLED' });
});
test('concurrent accept and decline cannot both win', async () => {
  const { invitation } = await inviting.invite(delivery());
  const results = await Promise.allSettled([inviting.accept({ invitation, invitee: 'a' }), inviting.decline({ invitation, invitee: 'a' })]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
});
test('event cancellation releases the active lock', async () => {
  const { invitation } = await inviting.invite(delivery());
  await inviting.accept({ invitation, invitee: 'a' });
  await inviting.closeEvent({ event: 'event', cancelled: true });
  await inviting.invite(delivery('a', 'another'));
});
