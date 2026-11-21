import { AtomicState } from '../state.ts';
import { timing } from '../config.ts';
import { areas as knownAreas, localDay, similarity } from '../../shared/catalog.ts';
export class InvalidSlot extends Error {}
export class SlotUnavailable extends Error {}
type RequestRow = { request: string; user: string; interests: string[]; start: number; end: number; areas: string[]; status: 'OPEN' | 'PLACED' | 'CLOSED'; priority: number; strikes: number; created: number; group: string; reason: string };
type GroupRow = { group: string; members: string[]; excluded: string[]; area: string; tag: string; start: number; end: number; capacity: number; status: 'DRAFT' | 'OPEN' | 'CLOSED'; event: string };
type Pool = { requests: RequestRow[]; groups: GroupRow[]; blocked: { user: string; start: number; end: number }[] };
export class MatchingConcept {
  private readonly state = new AtomicState<Pool>('matching', () => ({ requests: [], groups: [], blocked: [] }));
  constructor(private readonly now: () => number = Date.now) {}
  async submit({ user, interests, start, end, areas, strikes }: { user: string; interests: string; start: number; end: number; areas: string; strikes: number }) {
    const tags: string[] = JSON.parse(interests), selected: string[] = JSON.parse(areas);
    if (![start, end].every(Number.isFinite) || start < this.now() + timing.lead || end - start < timing.duration || end - start > 24 * 3600000 || localDay(start) !== localDay(end - 1) || !tags.length || !selected.length || selected.some(a => !knownAreas.includes(a)))
      throw new InvalidSlot('Pick interests and a same-day slot of at least two hours, at least 24 hours ahead, in a supported area.');
    return this.state.change(s => {
      if (s.requests.some(r => r.user === user && r.status !== 'CLOSED')) throw new SlotUnavailable('You already have an open slot or invitation.');
      if (s.blocked.some(b => b.user === user && b.start < end && start < b.end)) throw new SlotUnavailable('This overlaps a slot you declined or let expire. Pick another time.');
      if (s.requests.length >= 5000) throw new SlotUnavailable('The alpha pool needs maintenance. Contact the team.');
      const request = crypto.randomUUID();
      s.requests.push({ request, user, interests: tags, start, end, areas: [...new Set(selected)], status: 'OPEN', priority: 0, strikes, created: this.now(), group: '', reason: '' });
      return { request };
    });
  }
  async withdraw({ user, request }: { user: string; request: string }) {
    return this.state.change(s => {
      const r = s.requests.find(r => r.request === request && r.user === user && r.status === 'OPEN');
      if (!r) throw new SlotUnavailable('Only your waiting slot can be withdrawn.');
      r.status = 'CLOSED'; r.reason = 'WITHDRAWN'; return { request };
    });
  }
  async fillOpenGroups(_: Record<string, never>) {
    return this.state.change(s => {
      let placed = 0;
      for (const group of s.groups.filter(g => g.status === 'OPEN' && this.now() + timing.cutoff + timing.response <= g.start)) {
        for (const r of this.#ordered(s)) {
          if (group.members.length >= group.capacity) break;
          if (group.excluded.includes(r.user) || !r.areas.includes(group.area) || r.start > group.start || r.end < group.end || !r.interests.some(t => similarity(t, group.tag) >= 0.7)) continue;
          r.status = 'PLACED'; r.group = group.group; group.members.push(r.request); placed++;
        }
      }
      return { placed };
    });
  }
  #ordered(s: Pool) { return s.requests.filter(r => r.status === 'OPEN').sort((a, b) => (b.priority - b.strikes) - (a.priority - a.strikes) || a.created - b.created || a.request.localeCompare(b.request)); }
  async formGroups({ limits }: { limits: string }) {
    const caps: Record<string, number> = JSON.parse(limits);
    return this.state.change(s => {
      let formed = 0;
      while (true) {
        const open = this.#ordered(s).filter(r => r.end >= this.now() + timing.cutoff + timing.response + timing.duration);
        let best: { members: RequestRow[]; area: string; tag: string; start: number; score: number } | undefined;
        for (const anchor of open) for (const tag of anchor.interests) for (const area of anchor.areas) {
          const cap = Math.min(15, caps[area] ?? 0); if (cap < 3) continue;
          const start = Math.max(anchor.start, this.now() + timing.cutoff + timing.response);
          const members = open.filter(r => r.areas.includes(area) && r.start <= start && r.end >= start + timing.duration && r.interests.some(t => similarity(t, tag) >= 0.7)).slice(0, cap);
          const score = members.length * 100 + members.reduce((sum, r) => sum + r.priority - r.strikes, 0);
          if (members.length >= 3 && (!best || score > best.score)) best = { members, area, tag, start, score };
        }
        if (!best) break;
        const group = crypto.randomUUID();
        s.groups.push({ group, members: best.members.map(r => r.request), excluded: [], area: best.area, tag: best.tag, start: best.start, end: best.start + timing.duration, capacity: best.members.length, status: 'DRAFT', event: '' });
        for (const r of best.members) { r.status = 'PLACED'; r.group = group; }
        formed++;
      }
      return { formed };
    });
  }
  async activate({ group, event, capacity }: { group: string; event: string; capacity: number }) {
    return this.state.change(s => { const g = s.groups.find(g => g.group === group); if (g && g.status === 'DRAFT') { g.status = 'OPEN'; g.event = event; g.capacity = capacity; } return { group }; });
  }
  async abandon({ group }: { group: string }) {
    return this.state.change(s => {
      const g = s.groups.find(g => g.group === group); if (g?.status === 'DRAFT') {
        g.status = 'CLOSED'; for (const r of s.requests.filter(r => r.group === group && r.status === 'PLACED')) { r.status = 'OPEN'; r.group = ''; }
      } return { group };
    });
  }
  async close({ group }: { group: string }) { return this.state.change(s => { const g = s.groups.find(g => g.group === group); if (g) g.status = 'CLOSED'; return { group }; }); }
  async reconcile({ request, status, active, reason }: { request: string; status: string; active: boolean; reason: string }) {
    return this.state.change(s => {
      const r = s.requests.find(r => r.request === request);
      if (!r || r.status !== 'PLACED' || active) return { request };
      const g = s.groups.find(g => g.group === r.group);
      if (g) { g.members = g.members.filter(id => id !== request); if (!g.excluded.includes(r.user)) g.excluded.push(r.user); }
      if (status === 'CANCELLED' && reason === 'EVENT_CANCELLED' && r.end >= this.now() + timing.cutoff + timing.response + timing.duration) {
        r.status = 'OPEN'; r.group = ''; r.priority++; r.reason = 'REQUEUED';
      } else {
        r.status = 'CLOSED'; r.reason = reason || status;
        if (status === 'DECLINED' || status === 'EXPIRED') s.blocked.push({ user: r.user, start: r.start, end: r.end });
      }
      return { request };
    });
  }
  async expireOpen(_: Record<string, never>) {
    return this.state.change(s => { for (const r of s.requests) if (r.status === 'OPEN' && r.end < this.now() + timing.cutoff + timing.response + timing.duration) { r.status = 'CLOSED'; r.reason = 'NO_MATCH'; } return { checked: true }; });
  }
  async _mine({ user }: { user: string }) { const s = await this.state.read(); return { requests: JSON.stringify(s.requests.filter(r => r.user === user).sort((a,b) => b.created - a.created)) }; }
  async _drafts(_: Record<string, never>) { return (await this.state.read()).groups.filter(g => g.status === 'DRAFT').map(g => ({ group: g.group, area: g.area, tag: g.tag, start: g.start, end: g.end, size: g.members.length })); }
  async _members({ group }: { group: string }) { return (await this.state.read()).requests.filter(r => r.group === group && r.status === 'PLACED').map(r => ({ invitee: r.user, request: r.request })); }
  async _placements(_: Record<string, never>) { return (await this.state.read()).groups.filter(g => g.status === 'OPEN').map(g => ({ group: g.group, event: g.event })); }
}
