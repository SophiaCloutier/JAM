import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { database, closeDatabase } from '../src/database.ts';
import { CharacterizingConcept, InvalidInterest, ProfileExists, ProfileNotFound } from '../src/concepts/Characterizing.ts';
process.env.MONGODB_DATABASE = `jam_characterizing_test_${crypto.randomUUID().replaceAll('-', '')}`;

/*
 * Testing strategy
 *
 * create(user)
 *   partition on profile:
 *     - user has no profile
 *     - user already has a profile
 *
 * addInterest(user, tag)
 *   partition on profile:
 *     - exists
 *     - missing
 *   partition on tag form:
 *     - canonical
 *     - needs normalizing (case, spacing)
 *     - alias
 *     - one-letter typo of a suggested tag
 *     - custom
 *   partition on validity:
 *     - valid
 *     - empty
 *     - too short
 *     - starts with a digit
 *     - too long
 *     - unsupported characters
 *   partition on count:
 *     - below 12
 *     - at 12, adding a new tag
 *     - at 12, re-adding an existing tag
 *   partition on duplicates:
 *     - new tag
 *     - already present
 *
 * removeInterest(user, tag)
 *   partition on profile:
 *     - exists
 *     - missing
 *   partition on tag:
 *     - present
 *     - absent
 *
 * _get(user)
 *   partition on profile:
 *     - has interests
 *     - empty
 *     - no profile
 *   partition on other users:
 *     - users are independent of each other
 */

const characterizing = new CharacterizingConcept();

async function interests(user = 'a') {
  const { interests } = await characterizing._get({ user });
  return JSON.parse(interests);
}

beforeEach(async () => {
  await database().collection('profiles').deleteMany({});
});
afterAll(async () => {
  await database().dropDatabase();
  await closeDatabase();
});

describe('operational principle', () => {
  // covers: create new; add valid canonical tags; remove present tag; _get with interests and empty
  test('create, add, read back, remove', async () => {
    expect(await characterizing.create({ user: 'a' })).toEqual({ user: 'a' });
    expect(await interests()).toEqual([]);

    await characterizing.addInterest({ user: 'a', tag: 'pottery' });
    await characterizing.addInterest({ user: 'a', tag: 'guitar' });
    expect(await interests()).toEqual(['pottery', 'guitar']);

    await characterizing.removeInterest({ user: 'a', tag: 'pottery' });
    expect(await interests()).toEqual(['guitar']);
  });
});

describe('create', () => {
  // covers: create when a profile exists; add/remove with a missing profile; _get with no profile
  test('a user has at most one profile, and add/remove require it', async () => {
    await characterizing.create({ user: 'a' });
    await expect(characterizing.create({ user: 'a' })).rejects.toBeInstanceOf(ProfileExists);

    await expect(characterizing.addInterest({ user: 'b', tag: 'pottery' })).rejects.toBeInstanceOf(ProfileNotFound);
    await expect(characterizing.removeInterest({ user: 'b', tag: 'pottery' })).rejects.toBeInstanceOf(ProfileNotFound);

    expect(await interests('b')).toEqual([]); // no profile reads as empty, and nothing was created
    await expect(characterizing.create({ user: 'b' })).resolves.toEqual({ user: 'b' });
  });
});

describe('addInterest', () => {
  // covers: normalizing, alias, typo, duplicate, custom tag
  test('tags are normalized, aliased, typo-snapped and not duplicated', async () => {
    await characterizing.create({ user: 'a' });
    for (const tag of ['  Creative   Writing ', 'ceramics', 'drawinf', 'pottery', 'Drawing']) {
      await characterizing.addInterest({ user: 'a', tag });
    }
    expect(await interests()).toEqual(['creative writing', 'pottery', 'drawing']);

    expect(await characterizing.addInterest({ user: 'a', tag: 'Sketching' })).toEqual({ tag: 'drawing' });

    await characterizing.addInterest({ user: 'a', tag: 'dance' }); // custom tags are kept as typed
    expect(await interests()).toContain('dance');
  });

  // covers: every invalid form; at 12 adding new; at 12 re-adding existing
  test('invalid tags and a 13th interest are refused without changing the profile', async () => {
    await characterizing.create({ user: 'a' });
    for (const tag of ['', 'x', '9lives', 'a'.repeat(41), 'emoji 🎨']) {
      await expect(characterizing.addInterest({ user: 'a', tag })).rejects.toBeInstanceOf(InvalidInterest);
    }

    for (let i = 0; i < 12; i++) {
      await characterizing.addInterest({ user: 'a', tag: `hobby ${i}` });
    }
    await expect(characterizing.addInterest({ user: 'a', tag: 'one more' })).rejects.toBeInstanceOf(InvalidInterest);
    await characterizing.addInterest({ user: 'a', tag: 'hobby 0' }); // re-adding an existing tag at the cap is fine
    expect(await interests()).toHaveLength(12);
  });
});

describe('removeInterest', () => {
  // covers: remove an absent tag (normalized in the result)
  test('removing an absent tag succeeds and changes nothing', async () => {
    await characterizing.create({ user: 'a' });
    await characterizing.addInterest({ user: 'a', tag: 'guitar' });

    expect(await characterizing.removeInterest({ user: 'a', tag: 'Pottery' })).toEqual({ tag: 'pottery' });
    expect(await interests()).toEqual(['guitar']);
  });
});

describe('_get', () => {
  // covers: users are independent
  test('profiles are independent per user', async () => {
    await characterizing.create({ user: 'a' });
    await characterizing.create({ user: 'b' });
    await characterizing.addInterest({ user: 'a', tag: 'guitar' });

    expect(await interests('b')).toEqual([]);
  });
});
