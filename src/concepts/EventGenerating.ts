import { AtomicState } from '../state.ts';
import { eventCopy } from '../event-copy.ts';
import { venues } from '../venues.ts';
import { timing } from '../config.ts';
import { localDay } from '../../shared/catalog.ts';
type EventRow = { event: string; group: string; area: string; tag: string; start: number; end: number; capacity: number; venue: string; status: string; title: string; description: string; inviteBlurb: string; accepted: number };
export class EventUnavailable extends Error {}
export class EventGeneratingConcept {
  private readonly state = new AtomicState<{ events: EventRow[] }>('event_generating', () => ({ events: [] }));
  constructor(private readonly now: () => number = Date.now) {}
  async generate({ group, area, tag, start, end, size }: { group: string; area: string; tag: string; start: number; end: number; size: number }) {
    const previous = (await this.state.read()).events.find(e => e.group === group);
    if (previous) return this.#delivery(previous);
    const copy = await eventCopy(tag);
    return this.state.change(s => {
      const existing = s.events.find(e => e.group === group); if (existing) return this.#delivery(existing);
      const venue = venues.find(v => v.area === area && v.capacity >= size &&
        s.events.filter(e => e.venue === v.name && e.status !== 'CANCELLED' && localDay(e.start) === localDay(start)).length < v.dailyCap &&
        !s.events.some(e => e.venue === v.name && e.status !== 'CANCELLED' && start < e.end && e.start < end));
      if (!venue || start < this.now() + timing.cutoff + timing.response) return { generated: false, group, event: '', start, end, capacity: 0, deadline: 0, details: '' };
      const event = crypto.randomUUID();
      const e = { event, group, area, tag, start, end, capacity: Math.min(15, venue.capacity), venue: venue.name, status: 'FORMING', accepted: 0, ...copy };
      s.events.push(e); return this.#delivery(e);
    });
  }
  #delivery(e: EventRow) { return { generated: true, group: e.group, event: e.event, start: e.start, end: e.end, capacity: e.capacity, deadline: Math.min(this.now() + timing.response, e.start - timing.cutoff), details: JSON.stringify(e) }; }
  async review({ event, count }: { event: string; count: number }) {
    return this.state.change(s => {
      const e = s.events.find(e => e.event === event); if (!e) throw new EventUnavailable('Event not found.');
      if (!['CANCELLED', 'DONE'].includes(e.status)) {
        // After start the plan is fixed; late arrivals cannot change its state.
        if (this.now() >= e.end) e.status = e.status === 'CONFIRMED' ? 'DONE' : 'CANCELLED';
        else if (this.now() < e.start) {
          e.accepted = count;
          e.status = count >= 3 ? 'CONFIRMED' : this.now() >= e.start - timing.cutoff ? 'CANCELLED' : 'FORMING';
        }
      }
      return { event, group: e.group, status: e.status, locked: this.now() >= e.start - timing.cutoff };
    });
  }
  async cancel({ event }: { event: string }) {
    return this.state.change(s => { const e = s.events.find(e => e.event === event && e.start > this.now() && e.status !== 'DONE'); if (!e) throw new EventUnavailable('Only upcoming events can be cancelled.'); e.status = 'CANCELLED'; return { event, group: e.group }; });
  }
  async _limits(_: Record<string, never>) { const limits: Record<string, number> = {}; for (const v of venues) limits[v.area] = Math.max(limits[v.area] ?? 0, v.capacity); return { limits: JSON.stringify(limits) }; }
  async _all(_: Record<string, never>) { return (await this.state.read()).events.map(e => ({ event: e.event, group: e.group })); }
  async _get({ event }: { event: string }) { return (await this.state.read()).events.filter(e => e.event === event).map(e => ({ details: JSON.stringify(e) })); }
  async _deliveries(_: Record<string, never>) { return (await this.state.read()).events.filter(e => ['FORMING', 'CONFIRMED'].includes(e.status) && e.start > this.now() + timing.cutoff).map(e => this.#delivery(e)); }
  async _admin(_: Record<string, never>) { return { events: JSON.stringify((await this.state.read()).events) }; }
}
