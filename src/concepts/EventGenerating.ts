import { AtomicState } from '../state.ts';
import { eventCopy } from '../event-copy.ts';
import { venues } from '../venues.ts';
import { planning, timing } from '../config.ts';
import { planEvents, type PlanCluster } from '../event-planner.ts';

type Member = { invitee: string; request: string };
type EventRow = {
  event: string;
  plan: string;
  /** The cluster the event was planned for. Several events may share a group. */
  group: string;
  venue: string;
  area: string;
  tag: string;
  start: number;
  end: number;
  /** Seats this event holds at its venue: the number of people placed in it. */
  capacity: number;
  status: string;
  accepted: number;
  title: string;
  description: string;
  inviteBlurb: string;
  members: Member[];
};
type Change = { event: string; group: string; status: string };
type State = {
  plans?: { plan: string; date: string }[];
  events: EventRow[];
  reviews?: { review: string; changes: Change[] }[];
};

export class EventUnavailable extends Error {}

export class EventGeneratingConcept {
  private readonly state = new AtomicState<State>('event_generating', () => ({ plans: [], events: [], reviews: [] }));
  constructor(private readonly now: () => number = Date.now) {}

  /** Plans a date once: venues, start times and splits for its clusters.
   * Planning the same date again returns the same plan. */
  async plan({ date, clusters }: { date: string; clusters: string }) {
    const previous = (await this.state.read()).plans?.find(p => p.date === date);
    if (previous) return { plan: previous.plan };

    const planned = planEvents({
      date,
      clusters: this.#parseClusters(clusters),
      venues,
      earliest: this.now() + timing.cutoff + timing.response,
      duration: timing.duration,
      gridMinutes: planning.gridMinutes,
      seed: planning.seed,
      minSize: planning.minSize,
      maxSize: planning.maxSize,
    });

    // Copy may call a model, so it is produced before the atomic write (mutators must be pure).
    const copies = await Promise.all(planned.map(e => eventCopy(e.tag)));

    return this.state.change(s => {
      s.plans ??= [];
      const existing = s.plans.find(p => p.date === date);
      if (existing) return { plan: existing.plan };

      const plan = crypto.randomUUID();
      s.plans.push({ plan, date });
      planned.forEach((e, i) => {
        s.events.push({
          ...e,
          ...copies[i],
          event: crypto.randomUUID(),
          plan,
          capacity: e.members.length,
          status: 'FORMING',
          accepted: 0,
        });
      });
      return { plan };
    });
  }

  async review({ event, count }: { event: string; count: number }) {
    return this.state.change(s => {
      const e = s.events.find(e => e.event === event);
      if (!e) throw new EventUnavailable('Event not found.');

      if (!this.#isClosed(e)) {
        if (this.now() >= e.end) {
          e.status = e.status === 'CONFIRMED' ? 'DONE' : 'CANCELLED';
        } else if (this.now() < e.start) {
          // After start the plan is fixed; late arrivals cannot change its state.
          e.accepted = count;
          if (count >= 3) e.status = 'CONFIRMED';
          else if (this.#pastCutoff(e)) e.status = 'CANCELLED';
          else e.status = 'FORMING';
        }
      }
      return { event, group: e.group, status: e.status, locked: this.#pastCutoff(e) };
    });
  }

  /** Applies this concept's own time rules to every open event, using the last accepted count it was given:
   * fewer than three accepted at the cutoff cancels; a finished event is done if confirmed, else cancelled. */
  async reviewDue(_: Record<string, never>) {
    return this.state.change(s => {
      const review = crypto.randomUUID();
      const changes: Change[] = [];
      for (const e of s.events) {
        if (this.#isClosed(e)) continue;
        const before = e.status;
        if (this.now() >= e.end) e.status = e.status === 'CONFIRMED' ? 'DONE' : 'CANCELLED';
        else if (this.#pastCutoff(e) && e.accepted < 3) e.status = 'CANCELLED';
        if (e.status !== before) changes.push({ event: e.event, group: e.group, status: e.status });
      }
      s.reviews = [...(s.reviews ?? []), { review, changes }].slice(-50);
      return { review };
    });
  }

  async cancel({ event }: { event: string }) {
    return this.state.change(s => {
      const e = s.events.find(e => e.event === event && e.start > this.now() && e.status !== 'DONE');
      if (!e) throw new EventUnavailable('Only upcoming events can be cancelled.');
      e.status = 'CANCELLED';
      return { event, group: e.group };
    });
  }

  async _reviewed({ review }: { review: string }) {
    const reviews = (await this.state.read()).reviews ?? [];
    return reviews.find(r => r.review === review)?.changes ?? [];
  }

  /** The largest venue seat count per area, as JSON. Matching uses it to cap cluster size. */
  async _limits(_: Record<string, never>) {
    const limits: Record<string, number> = {};
    for (const v of venues) limits[v.area] = Math.max(limits[v.area] ?? 0, v.capacity);
    return { limits: JSON.stringify(limits) };
  }

  async _all(_: Record<string, never>) {
    const { events } = await this.state.read();
    return events.map(e => ({ event: e.event, group: e.group }));
  }

  async _planned({ plan }: { plan: string }) {
    const { events } = await this.state.read();
    return events.filter(e => e.plan === plan).map(e => this.#delivery(e));
  }

  async _members({ event }: { event: string }) {
    const { events } = await this.state.read();
    return events.find(e => e.event === event)?.members ?? [];
  }

  /** Request ids that received a seat in a plan, as a JSON array. */
  async _placed({ plan }: { plan: string }) {
    const { events } = await this.state.read();
    const requests = events.filter(e => e.plan === plan).flatMap(e => e.members.map(m => m.request));
    return { placed: JSON.stringify(requests) };
  }

  async _get({ event }: { event: string }) {
    const { events } = await this.state.read();
    return events.filter(e => e.event === event).map(e => ({ details: this.#details(e) }));
  }

  /** Upcoming open events whose invitations may still be delivered. */
  async _deliveries(_: Record<string, never>) {
    const { events } = await this.state.read();
    return events
      .filter(e => ['FORMING', 'CONFIRMED'].includes(e.status) && e.start > this.now() + timing.cutoff)
      .map(e => this.#delivery(e));
  }

  async _admin(_: Record<string, never>) {
    const { events } = await this.state.read();
    return { events: JSON.stringify(events.map(({ members, ...e }) => ({ ...e, size: members.length }))) };
  }

  #parseClusters(clusters: string): PlanCluster[] {
    try {
      const parsed = JSON.parse(clusters);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  #isClosed(e: EventRow) {
    return e.status === 'CANCELLED' || e.status === 'DONE';
  }
  #pastCutoff(e: EventRow) {
    return this.now() >= e.start - timing.cutoff;
  }
  /** Display details for invitees. Members are left out so invitees never see each other's ids. */
  #details({ members: _, ...e }: EventRow) {
    return JSON.stringify(e);
  }
  #delivery(e: EventRow) {
    return {
      event: e.event,
      group: e.group,
      start: e.start,
      end: e.end,
      capacity: e.capacity,
      deadline: Math.min(this.now() + timing.response, e.start - timing.cutoff),
      details: this.#details(e),
    };
  }
}
