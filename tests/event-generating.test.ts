import { afterAll, beforeEach, expect, test } from 'bun:test';
import { database, closeDatabase } from '../src/database.ts';
import { EventGeneratingConcept } from '../src/concepts/EventGenerating.ts';
import { timing } from '../src/config.ts';
process.env.MONGODB_DATABASE = `jam_events_test_${crypto.randomUUID().replaceAll('-', '')}`;
let now = Date.UTC(2026, 10, 27, 5, 30);
const events = new EventGeneratingConcept(() => now);
const start = now + 36 * 3600000, end = start + timing.duration;
beforeEach(async () => { await database().collection('event_generating').deleteMany({}); now = Date.UTC(2026, 10, 27, 5, 30); });
afterAll(async () => { await database().dropDatabase(); await closeDatabase(); });

test('generation is once per cluster and reserves capacity for everyone invited', async () => {
  const first = await events.generate({ group: 'g1', area: 'Campus', tag: 'drawing', start, end, size: 7 });
  expect(first.generated).toBe(true);
  expect(first.capacity).toBeGreaterThanOrEqual(7);
  expect((await events.generate({ group: 'g1', area: 'Campus', tag: 'drawing', start, end, size: 7 })).event).toBe(first.event);
  expect((await events.generate({ group: 'g2', area: 'Campus', tag: 'drawing', start, end, size: 20 })).generated).toBe(false);
});

test('reviewDue cancels an event short of three acceptances at the cutoff, without any clock concept', async () => {
  const { event } = await events.generate({ group: 'g1', area: 'Campus', tag: 'drawing', start, end, size: 3 });
  await events.review({ event, count: 2 });
  const early = await events.reviewDue({});
  expect(await events._reviewed({ review: early.review })).toEqual([]);
  now = start - timing.cutoff;
  const due = await events.reviewDue({});
  expect(await events._reviewed({ review: due.review })).toEqual([{ event, group: 'g1', status: 'CANCELLED' }]);
  // A second review reports nothing new, so reactions do not close the event twice.
  expect(await events._reviewed({ review: (await events.reviewDue({})).review })).toEqual([]);
});

test('reviewDue finishes a confirmed event after it ends', async () => {
  const { event } = await events.generate({ group: 'g1', area: 'Campus', tag: 'drawing', start, end, size: 3 });
  expect((await events.review({ event, count: 3 })).status).toBe('CONFIRMED');
  now = end;
  const { review } = await events.reviewDue({});
  expect(await events._reviewed({ review })).toEqual([{ event, group: 'g1', status: 'DONE' }]);
});
