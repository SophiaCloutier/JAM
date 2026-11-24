import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { database, closeDatabase } from '../src/database.ts';
import { InvitingConcept, InvitationForbidden, InvitationUnavailable } from '../src/concepts/Inviting.ts';
process.env.MONGODB_DATABASE = `jam_inviting_test_${crypto.randomUUID().replaceAll('-', '')}`;

/*
 * Testing strategy
 *
 * invite(invitee, event, ...)
 *   partition on delivery:
 *     - new delivery
 *     - same invitee and event again (reused)
 *     - invitee already has an active invitation
 *     - invitee's only invitation is expired or closed
 *
 * accept / decline (invitation, invitee)
 *   partition on caller:
 *     - owner
 *     - someone else
 *   partition on state:
 *     - pending before the deadline
 *     - already answered
 *     - at or past the deadline
 *   partition on concurrency:
 *     - one call
 *     - accept and decline racing
 *
 * cancel(invitation, invitee)
 *   partition on state:
 *     - accepted (first cancel)
 *     - already cancelled
 *
 * closeEvent(event, cancelled)
 *   partition on each invitation:
 *     - pending past its deadline
 *     - accepted
 *   partition on the lock:
 *     - the invitee can be invited again
 *
 * reads (_mine, _all, _count)
 *   partition on row:
 *     - live row
 *     - overdue pending row (reported as EXPIRED before anything persists it)
 */

let now = Date.now();
const inviting = new InvitingConcept(() => now);

/** A valid delivery: event tomorrow for two hours, six-hour deadline. */
function delivery(invitee = 'a', event = 'event') {
  return {
    invitee,
    event,
    request: `request-${invitee}`,
    start: now + 86400000,
    end: now + 93600000,
    deadline: now + 21600000,
    details: '{}',
  };
}

async function mine(invitee: string) {
  const { invitations } = await inviting._mine({ invitee });
  return JSON.parse(invitations);
}

beforeEach(async () => {
  await database().collection('invitations').deleteMany({});
});
afterAll(async () => {
  await database().dropDatabase();
  await closeDatabase();
});

describe('operational principle', () => {
  // covers: new delivery; reused delivery; owner accepts; _count; cancel once; cancel again
  test('deliver, accept, cancel exactly once', async () => {
    const { invitation } = await inviting.invite(delivery());
    expect(await inviting.invite(delivery())).toEqual({ invitation });

    await inviting.accept({ invitation, invitee: 'a' });
    expect((await inviting._count({ event: 'event' })).count).toBe(1);

    await inviting.cancel({ invitation, invitee: 'a' });
    await expect(inviting.cancel({ invitation, invitee: 'a' })).rejects.toBeInstanceOf(InvitationUnavailable);
    expect((await mine('a'))[0]).toMatchObject({ status: 'CANCELLED', reason: 'YOU_CANCELLED', active: false });
  });
});

describe('invite and answer', () => {
  // covers: invitee already active; caller is someone else; already answered; invite after a decline
  test('one active invite and owner authorization are enforced in storage', async () => {
    const { invitation } = await inviting.invite(delivery());
    await expect(inviting.invite(delivery('a', 'another'))).rejects.toBeInstanceOf(InvitationUnavailable);
    await expect(inviting.accept({ invitation, invitee: 'intruder' })).rejects.toBeInstanceOf(InvitationForbidden);

    await inviting.decline({ invitation, invitee: 'a' });
    await expect(inviting.accept({ invitation, invitee: 'a' })).rejects.toBeInstanceOf(InvitationUnavailable);
    await inviting.invite(delivery('a', 'another'));
  });

  // covers: accept and decline racing
  test('concurrent accept and decline cannot both win', async () => {
    const { invitation } = await inviting.invite(delivery());
    const results = await Promise.allSettled([
      inviting.accept({ invitation, invitee: 'a' }),
      inviting.decline({ invitation, invitee: 'a' }),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  });
});

describe('expiry', () => {
  // covers: at the deadline; overdue pending row in reads; invite after expiry
  test('expiry is lazy: at the deadline responses are refused, reads show EXPIRED, and the lock is released', async () => {
    const input = delivery();
    const { invitation } = await inviting.invite(input);
    now = input.deadline;

    await expect(inviting.accept({ invitation, invitee: 'a' })).rejects.toBeInstanceOf(InvitationUnavailable);
    await expect(inviting.decline({ invitation, invitee: 'a' })).rejects.toBeInstanceOf(InvitationUnavailable);

    // No periodic job ran, yet every read reports the overdue invitation as expired and inactive.
    expect((await mine('a'))[0]).toMatchObject({ status: 'EXPIRED', active: false });
    expect((await inviting._all({})).find(r => r.invitation === invitation)).toMatchObject({ status: 'EXPIRED', active: false });

    // The stale row must not block the next invitation through the one-active-invitation index.
    await inviting.invite(delivery('a', 'another'));
  });
});

describe('closeEvent', () => {
  // covers: cancelled event with a pending-past-deadline invitation and an accepted one
  test('closing a cancelled event keeps expired invitations distinct from event cancellations', async () => {
    const input = delivery();
    const { invitation } = await inviting.invite(input);
    const { invitation: other } = await inviting.invite(delivery('b'));
    await inviting.accept({ invitation: other, invitee: 'b' });
    now = input.deadline;

    await inviting.closeEvent({ event: 'event', cancelled: true });

    const rows = await inviting._all({});
    expect(rows.find(r => r.invitation === invitation)).toMatchObject({ status: 'EXPIRED', reason: '' });
    expect(rows.find(r => r.invitation === other)).toMatchObject({ status: 'CANCELLED', reason: 'EVENT_CANCELLED' });
  });

  // covers: accepted invitation, then invite again after the event closes
  test('event cancellation releases the active lock', async () => {
    const { invitation } = await inviting.invite(delivery());
    await inviting.accept({ invitation, invitee: 'a' });

    await inviting.closeEvent({ event: 'event', cancelled: true });
    await inviting.invite(delivery('a', 'another'));
  });
});
