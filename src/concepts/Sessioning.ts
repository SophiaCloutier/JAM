import { database } from '../database.ts';
export class UnknownSession extends Error {}
export class Forbidden extends Error {}
export class SessioningConcept {
  private readonly sessions = database().collection<{ session: string; subject: string; expiresAt: Date }>('sessions');
  async start({ subject }: { subject: string }) {
    await this.sessions.createIndex({ session: 1 }, { unique: true });
    await this.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    const session = crypto.randomUUID(), expiresAt = new Date(Date.now() + 7 * 86400000);
    await this.sessions.insertOne({ session, subject, expiresAt });
    return { session, expiresAt };
  }
  async current({ session }: { session: string }) {
    const row = await this.sessions.findOne({ session, expiresAt: { $gt: new Date() } });
    if (!row) throw new UnknownSession('Sign in to continue.');
    return { user: row.subject };
  }
  async end({ session }: { session: string }) {
    await this.sessions.deleteOne({ session });
    return { ended: true };
  }
  async authorize({ session }: { session: string }) {
    const { user } = await this.current({ session });
    if (!(process.env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).includes(user))
      throw new Forbidden('An administrator must run this action.');
    return { user };
  }
}
