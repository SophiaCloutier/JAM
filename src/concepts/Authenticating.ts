import { MongoServerError } from 'mongodb';
import { database } from '../database.ts';
export class InvalidCredentials extends Error {}
export class InvalidAccount extends Error {}
export class AccountTaken extends Error {}

/** Owns credentials only. An .edu suffix is eligibility, not email verification. */
export class AuthenticatingConcept {
  private readonly accounts = database().collection<{ email: string; verifier: string }>('accounts');
  async register({ email, password }: { email: string; password: string }) {
    email = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.edu$/.test(email) || email.length > 254 || password.length < 10 || password.length > 128)
      throw new InvalidAccount('Use a college .edu email and a password of 10–128 characters.');
    await this.accounts.createIndex({ email: 1 }, { unique: true });
    const verifier = await Bun.password.hash(password, { algorithm: 'argon2id' });
    try {
      await this.accounts.insertOne({ email, verifier });
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000)
        throw new AccountTaken('This email already has an account. Sign in instead.');
      throw e;
    }
    return { user: email };
  }
  async login({ email, password }: { email: string; password: string }) {
    const row = await this.accounts.findOne({ email: email.trim().toLowerCase() });
    if (!row || !(await Bun.password.verify(password, row.verifier)))
      throw new InvalidCredentials('Check your email and password.');
    return { user: row.email };
  }
}
