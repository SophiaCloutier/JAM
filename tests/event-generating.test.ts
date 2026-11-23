import { afterAll, beforeEach, expect, test } from 'bun:test';
import { database, closeDatabase } from '../src/database.ts';
import { EventGeneratingConcept, EventUnavailable } from '../src/concepts/EventGenerating.ts';
import { timing } from '../src/config.ts';
import { venues } from '../src/venues.ts';
import { bostonTime } from '../shared/catalog.ts';
process.env.MONGODB_DATABASE = `jam_events_test_${crypto.randomUUID().replaceAll('-', '')}`;
// Friday 2026-11-27, 00:30 Boston time: Saturday's matching has just run.
const FRIDAY = bostonTime('2026-11-27', '00:30'), SATURDAY = '2026-11-28';
let now = FRIDAY;
const events = new EventGeneratingConcept(() => now);
beforeEach(async () => { await database().collection('event_generating').deleteMany({}); now = FRIDAY; });
afterAll(async () => { await database().dropDatabase(); await closeDatabase(); });

/** One cluster as Matching's `_planning` hands it over. */
function cluster(id: string, n: number, { tag = 'drawing', from = '12:00', until = '16:00', areas = ['Campus', 'Cambridge', 'Boston'] } = {}) {
  return { cluster: id, tag, start: bostonTime(SATURDAY, from), end: bostonTime(SATURDAY, until), areas,
    members: Array.from({ length: n }, (_, i) => ({ request: `${id}-r${i}`, user: `${id}-u${i}` })) };
}
async function planOne(n = 3) {
  const { plan } = await events.plan({ date: SATURDAY, clusters: JSON.stringify([cluster('g1', n)]) });
  const [event] = await events._planned({ plan });
  return { plan, ...event };
}

test('planning is once per date: the same date returns the same plan and events', async () => {
  const first = await events.plan({ date: SATURDAY, clusters: JSON.stringify([cluster('g1', 5)]) });
  const again = await events.plan({ date: SATURDAY, clusters: JSON.stringify([cluster('g2', 9, { tag: 'origami' })]) });
  expect(again.plan).toBe(first.plan);
  const planned = await events._planned({ plan: first.plan });
  expect(planned).toHaveLength(1);
  const e = planned[0];
  expect(e.group).toBe('g1');
  expect(e.end - e.start).toBe(timing.duration);
  expect(e.start).toBeGreaterThanOrEqual(bostonTime(SATURDAY, '12:00'));
  expect(e.end).toBeLessThanOrEqual(bostonTime(SATURDAY, '16:00'));
  expect(e.capacity).toBe(5);
  expect(e.deadline).toBe(Math.min(now + timing.response, e.start - timing.cutoff));
  const details = JSON.parse(e.details);
  expect(details).toMatchObject({ tag: 'drawing', status: 'FORMING', group: 'g1', title: expect.any(String) });
  expect(details.venue).toMatch(/^Sample/);
  expect(details.members).toBeUndefined(); // invitees are not shown to each other
});

test('members and placed ids hand back exactly the seated people, and nobody else', async () => {
  const { plan } = await events.plan({ date: SATURDAY, clusters: JSON.stringify([
    cluster('g1', 4), cluster('night', 3, { tag: 'guitar', from: '22:00', until: '23:59', areas: ['Boston'] }),
  ]) });
  const planned = await events._planned({ plan });
  expect(planned.map(e => e.group)).toEqual(['g1']);
  expect((await events._members({ event: planned[0].event })).map(m => m.request).sort()).toEqual(['g1-r0', 'g1-r1', 'g1-r2', 'g1-r3']);
  expect((JSON.parse((await events._placed({ plan })).placed) as string[]).sort()).toEqual(['g1-r0', 'g1-r1', 'g1-r2', 'g1-r3']);
});

test('a cluster too big for its only venue seats as many as fit, never overfilling', async () => {
  // 07:00-09:00 on campus: only one sample café (6 seats) is open for the whole window.
  const { plan } = await events.plan({ date: SATURDAY, clusters: JSON.stringify([cluster('early', 8, { from: '07:00', until: '09:00', areas: ['Campus'] })]) });
  const planned = await events._planned({ plan });
  expect(planned).toHaveLength(1);
  expect(planned[0].capacity).toBe(6);
  expect(JSON.parse((await events._placed({ plan })).placed)).toEqual(['early-r0', 'early-r1', 'early-r2', 'early-r3', 'early-r4', 'early-r5']);
});

test('an unplaceable date still records a plan with no events', async () => {
  const { plan } = await events.plan({ date: SATURDAY, clusters: JSON.stringify([cluster('g1', 3, { from: '05:00', until: '07:00' })]) });
  expect(await events._planned({ plan })).toEqual([]);
  expect(JSON.parse((await events._placed({ plan })).placed)).toEqual([]);
});

test('_limits reflects the venue list', async () => {
  const limits = JSON.parse((await events._limits({})).limits);
  for (const area of ['Campus', 'Cambridge', 'Boston']) expect(limits[area]).toBe(Math.max(...venues.filter(v => v.area === area).map(v => v.capacity)));
});

test('reviewDue cancels an event short of three acceptances at the cutoff, without any clock concept', async () => {
  const { event, start } = await planOne();
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
  const { event, end } = await planOne();
  expect((await events.review({ event, count: 3 })).status).toBe('CONFIRMED');
  now = end;
  const { review } = await events.reviewDue({});
  expect(await events._reviewed({ review })).toEqual([{ event, group: 'g1', status: 'DONE' }]);
});

test('only upcoming events can be cancelled, and cancelled events are no longer delivered', async () => {
  const { event } = await planOne();
  expect((await events._deliveries({})).map(d => d.event)).toEqual([event]);
  expect(await events.cancel({ event })).toEqual({ event, group: 'g1' });
  expect(await events._deliveries({})).toEqual([]);
  await expect(events.cancel({ event: 'missing' })).rejects.toBeInstanceOf(EventUnavailable);
});
