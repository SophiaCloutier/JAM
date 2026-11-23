import { MongoServerError } from 'mongodb';
import { database } from '../database.ts';
export class InvitationUnavailable extends Error {}
export class InvitationForbidden extends Error {}
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
interface InvitationRow {
  invitation: string; invitee: string; event: string; request: string;
  status: InvitationStatus; deadline: number; start: number; end: number;
  details: string; active: boolean; reason: string;
}

/** Owns invitation decisions. Event and request are opaque external identifiers. */
export class InvitingConcept {
  private readonly rows = database().collection<InvitationRow>('invitations');
  constructor(private readonly now: () => number = Date.now) {}
  async invite({ invitee, event, request, start, end, deadline, details }: {
    invitee: string; event: string; request: string; start: number; end: number; deadline: number; details: string;
  }) {
    if (![start, end, deadline].every(Number.isFinite) || deadline <= this.now() || deadline > start || end <= start)
      throw new InvitationUnavailable('The invitation window is closed.');
    await this.rows.createIndex({ invitee: 1, event: 1 }, { unique: true });
    await this.rows.createIndex({ invitee: 1 }, { unique: true, partialFilterExpression: { active: true } });
    // Idempotent delivery is essential when the scheduler reconciles after restart.
    const previous = await this.rows.findOne({ invitee, event });
    if (previous) return { invitation: previous.invitation };
    // Expiry is lazy: an unanswered invitation past its deadline stops holding the active lock here.
    await this.#expireOverdue({ invitee });
    const invitation = crypto.randomUUID();
    try { await this.rows.insertOne({ invitation, invitee, event, request, start, end,
      deadline: Math.min(deadline, this.now() + 6 * 3600000), details,
      status: 'PENDING', active: true, reason: '' }); }
    catch (e) { if (e instanceof MongoServerError && e.code === 11000) throw new InvitationUnavailable('You already have an active invitation.'); throw e; }
    return { invitation };
  }
  async #owned(invitation: string, invitee: string) {
    const row = await this.rows.findOne({ invitation, invitee });
    if (!row) throw new InvitationForbidden('This invitation is not yours or no longer exists.');
    return row;
  }
  async accept({ invitation, invitee }: { invitation: string; invitee: string }) {
    await this.#owned(invitation, invitee);
    const row = await this.rows.findOneAndUpdate({ invitation, invitee, status: 'PENDING', active: true, deadline: { $gt: this.now() } },
      { $set: { status: 'ACCEPTED' } }, { returnDocument: 'after' });
    if (!row) throw new InvitationUnavailable('This invitation was answered or expired. Refresh your inbox.');
    return { event: row.event, request: row.request };
  }
  async decline({ invitation, invitee }: { invitation: string; invitee: string }) {
    await this.#owned(invitation, invitee);
    const row = await this.rows.findOneAndUpdate({ invitation, invitee, status: 'PENDING', active: true, deadline: { $gt: this.now() } },
      { $set: { status: 'DECLINED', active: false } }, { returnDocument: 'after' });
    if (!row) throw new InvitationUnavailable('This invitation was answered or expired. Refresh your inbox.');
    return { event: row.event, request: row.request };
  }
  async cancel({ invitation, invitee }: { invitation: string; invitee: string }) {
    await this.#owned(invitation, invitee);
    const row = await this.rows.findOneAndUpdate({ invitation, invitee, status: 'ACCEPTED', active: true, start: { $gt: this.now() } },
      { $set: { status: 'CANCELLED', active: false, reason: 'YOU_CANCELLED' } }, { returnDocument: 'after' });
    if (!row) throw new InvitationUnavailable('Only an accepted invitation before the event can be cancelled.');
    return { event: row.event, request: row.request };
  }
  async closeEvent({ event, cancelled }: { event: string; cancelled: boolean }) {
    await this.#expireOverdue({ event });
    if (cancelled) {
      await this.rows.updateMany({ event, active: true, status: 'PENDING' }, { $set: { status: 'EXPIRED', active: false, reason: 'EVENT_CANCELLED' } });
      await this.rows.updateMany({ event, active: true, status: 'ACCEPTED' }, { $set: { status: 'CANCELLED', active: false, reason: 'EVENT_CANCELLED' } });
    }
    else await this.rows.updateMany({ event, active: true }, { $set: { active: false } });
    return { event };
  }
  /** Persists expiry for overdue pending rows; called only from actions. */
  async #expireOverdue(filter: { invitee?: string; event?: string }) {
    await this.rows.updateMany({ ...filter, status: 'PENDING', deadline: { $lte: this.now() } }, { $set: { status: 'EXPIRED', active: false } });
  }
  /** Reads report an overdue pending invitation as expired before it is persisted. Pure. */
  #view<T extends { status: InvitationStatus; deadline: number; active: boolean }>(row: T): T {
    return row.status === 'PENDING' && row.deadline <= this.now() ? { ...row, status: 'EXPIRED', active: false } : row;
  }
  async _mine({ invitee }: { invitee: string }) {
    const rows = (await this.rows.find({ invitee }, { projection: { _id: 0, invitee: 0, strike: 0 } }).sort({ start: -1 }).toArray()).map(r => this.#view(r));
    return { invitations: JSON.stringify(rows) };
  }
  async _all(_: Record<string, never>): Promise<InvitationRow[]> { return (await this.rows.find({}, { projection: { _id: 0, strike: 0 } }).toArray()).map(r => this.#view(r)); }
  async _count({ event }: { event: string }) { return { count: await this.rows.countDocuments({ event, status: 'ACCEPTED', active: true }) }; }
  async _forUser({ invitee }: { invitee: string }): Promise<InvitationRow[]> { return (await this.rows.find({ invitee }, { projection: { _id: 0, strike: 0 } }).toArray()).map(r => this.#view(r)); }
}

