import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { database, closeDatabase } from '../src/database.ts';
import { EventGeneratingConcept, EventUnavailable } from '../src/concepts/EventGenerating.ts';
import { timing } from '../src/config.ts';
import { venues } from '../src/venues.ts';
import { bostonTime } from '../shared/catalog.ts';
process.env.MONGODB_DATABASE = `jam_events_test_${crypto.randomUUID().replaceAll('-', '')}`;

/*
 * Testing strategy
 *
 * plan(date, clusters)
 *   partition on repeats:
 *     - first plan for the date
 *     - same date again (with different clusters)
 *   partition on each cluster:
 *     - fits a venue
 *     - bigger than every venue open in its window
 *     - fits no venue at all
 *   partition on the result:
 *     - some events
 *     - no events
 *
 * _planned / _members / _placed
 *   partition on people:
 *     - placed (returned)
 *     - unplaced (never returned)
 *
 * _limits
 *   - matches the largest venue seat count per area
 *
 * review / reviewDue
 *   partition on accepted count:
 *     - below three
 *     - three or more
 *   partition on time:
 *     - before the cutoff
 *     - at the cutoff
 *     - after the end
 *   partition on repeats:
 *     - first review that changes a status
 *     - later reviews
 *
 * cancel / _deliveries
 *   partition on event:
 *     - upcoming
 *     - unknown
 *   partition on delivery:
 *     - cancelled events are no longer delivered
 */

// Friday 2026-11-27, 00:30 Boston time: Saturday's matching has just run.
const FRIDAY = bostonTime('2026-11-27', '00:30');
const SATURDAY = '2026-11-28';

let now = FRIDAY;
const events = new EventGeneratingConcept(() => now);

type ClusterOptions = { tag?: string; from?: string; until?: string; areas?: string[] };

/** One cluster as Matching's `_planning` hands it over. */
function cluster(id: string, n: number, options: ClusterOptions = {}) {
  const { tag = 'drawing', from = '12:00', until = '16:00', areas = ['Campus', 'Cambridge', 'Boston'] } = options;
  return {
    cluster: id,
    tag,
    start: bostonTime(SATURDAY, from),
    end: bostonTime(SATURDAY, until),
    areas,
    members: Array.from({ length: n }, (_, i) => ({ request: `${id}-r${i}`, user: `${id}-u${i}` })),
  };
}

function planSaturday(...clusters: ReturnType<typeof cluster>[]) {
  return events.plan({ date: SATURDAY, clusters: JSON.stringify(clusters) });
}

async function placed(plan: string) {
  const { placed } = await events._placed({ plan });
  return JSON.parse(placed) as string[];
}

/** Plans one small cluster and returns its single event. */
async function planOne(n = 3) {
  const { plan } = await planSaturday(cluster('g1', n));
  const [event] = await events._planned({ plan });
  return { plan, ...event };
}

beforeEach(async () => {
  await database().collection('event_generating').deleteMany({});
  now = FRIDAY;
});
afterAll(async () => {
  await database().dropDatabase();
  await closeDatabase();
});

describe('plan', () => {
  // covers: first plan; same date again; cluster fits a venue; _planned fields and details
  test('planning is once per date: the same date returns the same plan and events', async () => {
    const first = await planSaturday(cluster('g1', 5));
    const again = await planSaturday(cluster('g2', 9, { tag: 'origami' }));
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

  // covers: cluster bigger than every venue open in its window
  test('a cluster too big for its only venue seats as many as fit, never overfilling', async () => {
    // 07:00-09:00 on campus: only one sample café (6 seats) is open for the whole window.
    const { plan } = await planSaturday(cluster('early', 8, { from: '07:00', until: '09:00', areas: ['Campus'] }));

    const planned = await events._planned({ plan });
    expect(planned).toHaveLength(1);
    expect(planned[0].capacity).toBe(6);
    expect(await placed(plan)).toEqual(['early-r0', 'early-r1', 'early-r2', 'early-r3', 'early-r4', 'early-r5']);
  });

  // covers: cluster fits no venue; no events
  test('an unplaceable date still records a plan with no events', async () => {
    const { plan } = await planSaturday(cluster('g1', 3, { from: '05:00', until: '07:00' }));

    expect(await events._planned({ plan })).toEqual([]);
    expect(await placed(plan)).toEqual([]);
  });
});

describe('_planned, _members and _placed', () => {
  // covers: placed people returned; unplaced people never returned
  test('members and placed ids hand back exactly the seated people, and nobody else', async () => {
    const night = cluster('night', 3, { tag: 'guitar', from: '22:00', until: '23:59', areas: ['Boston'] });
    const { plan } = await planSaturday(cluster('g1', 4), night);

    const planned = await events._planned({ plan });
    expect(planned.map(e => e.group)).toEqual(['g1']);

    const members = await events._members({ event: planned[0].event });
    expect(members.map(m => m.request).sort()).toEqual(['g1-r0', 'g1-r1', 'g1-r2', 'g1-r3']);
    expect((await placed(plan)).sort()).toEqual(['g1-r0', 'g1-r1', 'g1-r2', 'g1-r3']);
  });
});

describe('_limits', () => {
  // covers: largest seat count per area
  test('reflects the venue list', async () => {
    const limits = JSON.parse((await events._limits({})).limits);
    for (const area of ['Campus', 'Cambridge', 'Boston']) {
      const largest = Math.max(...venues.filter(v => v.area === area).map(v => v.capacity));
      expect(limits[area]).toBe(largest);
    }
  });
});

describe('review and reviewDue', () => {
  // covers: below three; before the cutoff; at the cutoff; later reviews report nothing
  test('reviewDue cancels an event short of three acceptances at the cutoff, without any clock concept', async () => {
    const { event, start } = await planOne();
    await events.review({ event, count: 2 });

    const early = await events.reviewDue({});
    expect(await events._reviewed({ review: early.review })).toEqual([]);

    now = start - timing.cutoff;
    const due = await events.reviewDue({});
    expect(await events._reviewed({ review: due.review })).toEqual([{ event, group: 'g1', status: 'CANCELLED' }]);

    // A second review reports nothing new, so reactions do not close the event twice.
    const again = await events.reviewDue({});
    expect(await events._reviewed({ review: again.review })).toEqual([]);
  });

  // covers: three or more; after the end
  test('reviewDue finishes a confirmed event after it ends', async () => {
    const { event, end } = await planOne();
    expect((await events.review({ event, count: 3 })).status).toBe('CONFIRMED');

    now = end;
    const { review } = await events.reviewDue({});
    expect(await events._reviewed({ review })).toEqual([{ event, group: 'g1', status: 'DONE' }]);
  });
});

describe('cancel and _deliveries', () => {
  // covers: upcoming event; unknown event; cancelled events are not delivered
  test('only upcoming events can be cancelled, and cancelled events are no longer delivered', async () => {
    const { event } = await planOne();
    expect((await events._deliveries({})).map(d => d.event)).toEqual([event]);

    expect(await events.cancel({ event })).toEqual({ event, group: 'g1' });
    expect(await events._deliveries({})).toEqual([]);

    await expect(events.cancel({ event: 'missing' })).rejects.toBeInstanceOf(EventUnavailable);
  });
});
