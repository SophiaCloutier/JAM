import { MongoServerError } from 'mongodb';
import { database } from '../database.ts';
import { normalizeTag, suggestedTags } from '../../shared/catalog.ts';
export class InvalidInterest extends Error {}
export class ProfileExists extends Error {}
export class ProfileNotFound extends Error {}
export class CharacterizingConcept {
  private readonly profiles = database().collection<{ user: string; interests: string[] }>('profiles');
  async create({ user }: { user: string }) {
    await this.profiles.createIndex({ user: 1 }, { unique: true });
    try { await this.profiles.insertOne({ user, interests: [] }); }
    catch (e) { if (e instanceof MongoServerError && e.code === 11000) throw new ProfileExists('This user already has a profile.'); throw e; }
    return { user };
  }
  async addInterest({ user, tag }: { user: string; tag: string }) {
    tag = normalizeTag(tag);
    if (!/^[a-z][a-z0-9 &'/-]{1,39}$/.test(tag)) throw new InvalidInterest('Use 2–40 letters for an interest.');
    // Conservative typo dedupe only against canonical tags; do not merge unrelated user tags.
    const near = suggestedTags.find(candidate => candidate.length >= 5 && candidate.length === tag.length && [...candidate].filter((c, i) => c !== tag[i]).length === 1);
    if (near) tag = near;
    const profile = await this.profiles.findOne({ user });
    if (!profile) throw new ProfileNotFound('This user has no profile.');
    if (profile.interests.length >= 12 && !profile.interests.includes(tag)) throw new InvalidInterest('Keep up to 12 interests. Remove one to add another.');
    await this.profiles.updateOne({ user }, { $addToSet: { interests: tag } });
    return { tag };
  }
  async removeInterest({ user, tag }: { user: string; tag: string }) {
    tag = normalizeTag(tag);
    const { matchedCount } = await this.profiles.updateOne({ user }, { $pull: { interests: tag } });
    if (!matchedCount) throw new ProfileNotFound('This user has no profile.');
    return { tag };
  }
  async _get({ user }: { user: string }) { return { interests: JSON.stringify((await this.profiles.findOne({ user }))?.interests ?? []) }; }
}
