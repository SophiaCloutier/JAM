import { afterAll, beforeEach, expect, test } from 'bun:test';
import { database, closeDatabase } from '../src/database.ts';
import { CharacterizingConcept, InvalidInterest, ProfileExists, ProfileNotFound } from '../src/concepts/Characterizing.ts';
process.env.MONGODB_DATABASE = `jam_characterizing_test_${crypto.randomUUID().replaceAll('-', '')}`;
const characterizing = new CharacterizingConcept();
const interests = async (user = 'a') => JSON.parse((await characterizing._get({ user })).interests);
beforeEach(async () => { await database().collection('profiles').deleteMany({}); });
afterAll(async () => { await database().dropDatabase(); await closeDatabase(); });

test('operational principle: create, add, read back, remove', async () => {
  expect(await characterizing.create({ user: 'a' })).toEqual({ user: 'a' });
  expect(await interests()).toEqual([]);
  await characterizing.addInterest({ user: 'a', tag: 'pottery' });
  await characterizing.addInterest({ user: 'a', tag: 'guitar' });
  expect(await interests()).toEqual(['pottery', 'guitar']);
  await characterizing.removeInterest({ user: 'a', tag: 'pottery' });
  expect(await interests()).toEqual(['guitar']);
});

test('a user has at most one profile, and add/remove require it', async () => {
  await characterizing.create({ user: 'a' });
  await expect(characterizing.create({ user: 'a' })).rejects.toBeInstanceOf(ProfileExists);
  await expect(characterizing.addInterest({ user: 'b', tag: 'pottery' })).rejects.toBeInstanceOf(ProfileNotFound);
  await expect(characterizing.removeInterest({ user: 'b', tag: 'pottery' })).rejects.toBeInstanceOf(ProfileNotFound);
  expect(await interests('b')).toEqual([]); // no profile reads as empty, and nothing was created
  await expect(characterizing.create({ user: 'b' })).resolves.toEqual({ user: 'b' });
});

test('tags are normalized, aliased, typo-snapped and not duplicated', async () => {
  await characterizing.create({ user: 'a' });
  for (const tag of ['  Creative   Writing ', 'ceramics', 'drawinf', 'pottery', 'Drawing']) await characterizing.addInterest({ user: 'a', tag });
  expect(await interests()).toEqual(['creative writing', 'pottery', 'drawing']);
  expect(await characterizing.addInterest({ user: 'a', tag: 'Sketching' })).toEqual({ tag: 'drawing' });
  await characterizing.addInterest({ user: 'a', tag: 'dance' }); // custom tags are kept as typed
  expect(await interests()).toContain('dance');
});

test('invalid tags and a 13th interest are refused without changing the profile', async () => {
  await characterizing.create({ user: 'a' });
  for (const tag of ['', 'x', '9lives', 'a'.repeat(41), 'emoji 🎨']) await expect(characterizing.addInterest({ user: 'a', tag })).rejects.toBeInstanceOf(InvalidInterest);
  for (let i = 0; i < 12; i++) await characterizing.addInterest({ user: 'a', tag: `hobby ${i}` });
  await expect(characterizing.addInterest({ user: 'a', tag: 'one more' })).rejects.toBeInstanceOf(InvalidInterest);
  await characterizing.addInterest({ user: 'a', tag: 'hobby 0' }); // re-adding an existing tag at the cap is fine
  expect(await interests()).toHaveLength(12);
});

test('removing an absent tag succeeds and changes nothing', async () => {
  await characterizing.create({ user: 'a' });
  await characterizing.addInterest({ user: 'a', tag: 'guitar' });
  expect(await characterizing.removeInterest({ user: 'a', tag: 'Pottery' })).toEqual({ tag: 'pottery' });
  expect(await interests()).toEqual(['guitar']);
});

test('profiles are independent per user', async () => {
  await characterizing.create({ user: 'a' });
  await characterizing.create({ user: 'b' });
  await characterizing.addInterest({ user: 'a', tag: 'guitar' });
  expect(await interests('b')).toEqual([]);
});
