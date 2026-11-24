import { AtomicState } from '../state.ts';
import { timing } from '../config.ts';
import {
  addDays,
  isDay,
  localDay,
  locations,
  minimumSimilarity,
  radii,
  reachableAreas,
  similarity,
} from '../../shared/catalog.ts';
export class InvalidSlot extends Error {}
export class SlotUnavailable extends Error {}

type RequestStatus = 'PENDING' | 'MATCHED' | 'UNMATCHED' | 'WITHDRAWN' | 'CLOSED';
type RequestRow = {
  request: string;
  user: string;
  date: string;
  start: number;
  end: number;
  location: string;
  radius: number;
  reachable: string[];
  /** Opaque to matching: stored only so reactions can choose candidate interests. */
  selected: string;
  interests: string[];
  status: RequestStatus;
  cluster: string;
  reason: string;
  created: number;
};
type ClusterStatus = 'FORMING' | 'COMPLETE' | 'GENERATED' | 'FAILED' | 'CLOSED';
type ClusterRow = {
  cluster: string;
  date: string;
  tag: string;
  members: string[];
  start: number;
  end: number;
  areas: string[];
  area: string;
  status: ClusterStatus;
  event: string;
  created: number;
};
type Pool = {
  requests: RequestRow[];
  clusters: ClusterRow[];
  runs: { run: string; dates: string[] }[];
  opened: string[];
};
type Candidate = { request: string; tags: string[] };
type Window = { start: number; end: number; areas: string[] };

/** Groups compatible requests for one date by interest similarity and availability.
 * It never decides which interests a request offers; callers pass candidate tags. */
export class MatchingConcept {
  private readonly state = new AtomicState<Pool>('matching', () => ({
    requests: [],
    clusters: [],
    runs: [],
    opened: [],
  }));
  constructor(private readonly now: () => number = Date.now) {}

  async submit({
    user,
    date,
    start,
    end,
    selected,
    interests,
    location,
    radius,
  }: {
    user: string;
    date: string;
    start: number;
    end: number;
    selected: string;
    interests: string;
    location: string;
    radius: number;
  }) {
    let tags: unknown;
    try {
      tags = JSON.parse(interests);
    } catch {
      tags = null;
    }
    if (!Array.isArray(tags) || !tags.length || !tags.every(t => typeof t === 'string'))
      throw new InvalidSlot('Add at least one creative interest to your profile first.');
    if (selected && !tags.includes(selected))
      throw new InvalidSlot('Pick one of your profile interests, or choose Surprise me.');
    if (!isDay(date)) throw new InvalidSlot('Choose a date.');
    const earliest = addDays(localDay(this.now()), timing.leadDays);
    if (date < earliest)
      throw new InvalidSlot(`Requests need ${timing.leadDays} days' notice. Choose ${earliest} or later.`);
    if (
      ![start, end].every(Number.isFinite) ||
      localDay(start) !== date ||
      localDay(end - 1) !== date ||
      end - start < timing.duration
    )
      throw new InvalidSlot(
        `Your free time must be on the chosen date and last at least ${timing.duration / 3600000} hours.`,
      );
    if (!locations.some(l => l.name === location) || !radii.includes(radius))
      throw new InvalidSlot('Choose a place for "Near" and a distance for "Within" from the lists.');
    const reachable = reachableAreas(location, radius);
    if (!reachable.length)
      throw new InvalidSlot(`No JAM meeting area is within ${radius} miles of ${location}. Try a larger distance.`);
    return this.state.change(s => {
      if (s.opened.includes(date))
        throw new SlotUnavailable(`Matching for ${date} has already run. Choose a later date.`);
      if (s.requests.some(r => r.user === user && (r.status === 'PENDING' || r.status === 'MATCHED')))
        throw new SlotUnavailable('You already have an open request.');
      if (s.requests.length >= 5000) throw new SlotUnavailable('The alpha pool needs maintenance. Contact the team.');
      const request = crypto.randomUUID();
      s.requests.push({
        request,
        user,
        date,
        start,
        end,
        location,
        radius,
        reachable,
        selected,
        interests: tags as string[],
        status: 'PENDING',
        cluster: '',
        reason: '',
        created: this.now(),
      });
      return { request };
    });
  }

  async withdraw({ user, request }: { user: string; request: string }) {
    return this.state.change(s => {
      const r = s.requests.find(r => r.request === request && r.user === user && r.status === 'PENDING');
      if (!r) throw new SlotUnavailable('Only a request that is still waiting for matching can be withdrawn.');
      r.status = 'WITHDRAWN';
      r.reason = 'WITHDRAWN';
      return { request };
    });
  }

  /** Opens every due date exactly once. Date D is due from the start of D-1 (Boston time);
   * `force` also opens dates up to the earliest requestable date, for admin demos. */
  async openDue({ force }: { force: boolean }) {
    return this.state.change(s => {
      const today = localDay(this.now());
      const last = addDays(today, force ? timing.leadDays : timing.leadDays - 1);
      const due = [
        ...new Set(
          s.requests
            .filter(r => r.status === 'PENDING' && r.date <= last && !s.opened.includes(r.date))
            .map(r => r.date),
        ),
      ].sort();
      const run = crypto.randomUUID(),
        dates: string[] = [];
      for (const date of due) {
        s.opened.push(date);
        // A date already reached cannot get an event with a response window, so it is not matched.
        if (date <= today)
          for (const r of s.requests.filter(r => r.date === date && r.status === 'PENDING')) {
            r.status = 'UNMATCHED';
            r.reason = 'TOO_LATE';
          }
        else dates.push(date);
      }
      s.runs.push({ run, dates });
      s.runs = s.runs.slice(-100);
      return { run };
    });
  }

  /** Forms new clusters of at least three. For each tag, candidates whose best tag scores at least
   * `minScore` are eligible; exact holders are tried first. `stage` only labels the step for callers. */
  async form({
    date,
    stage,
    candidates,
    minScore,
    limits,
  }: {
    date: string;
    stage: string;
    candidates: string;
    minScore: number;
    limits: string;
  }) {
    const caps: Record<string, number> = JSON.parse(limits),
      offered: Candidate[] = JSON.parse(candidates);
    return this.state.change(s => {
      const pool = this.#candidates(s, date, offered);
      const counts = new Map<string, number>();
      for (const { tags } of pool) for (const t of new Set(tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
      const order = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));
      for (const tag of order) {
        for (let formed = true; formed; ) {
          formed = false;
          const score = (c: { tags: string[] }) => Math.max(...c.tags.map(t => similarity(t, tag)));
          const eligible = pool
            .filter(c => c.row.status === 'PENDING' && score(c) >= Math.max(minScore, minimumSimilarity))
            .sort((a, b) => score(b) - score(a) || this.#byAge(a.row, b.row));
          for (const seed of eligible) {
            let window: Window | undefined = { start: seed.row.start, end: seed.row.end, areas: seed.row.reachable };
            if (this.#cap(window.areas, caps) < 3) continue;
            const members = [seed.row];
            for (const other of eligible) {
              if (other === seed) continue;
              const next = this.#fit(window, other.row, members.length, caps);
              if (next) {
                window = next;
                members.push(other.row);
              }
            }
            if (members.length < 3) continue;
            const cluster = crypto.randomUUID();
            s.clusters.push({
              cluster,
              date,
              tag,
              members: members.map(r => r.request),
              ...window,
              area: this.#area(window.areas, caps),
              status: 'FORMING',
              event: '',
              created: this.now(),
            });
            for (const r of members) {
              r.status = 'MATCHED';
              r.cluster = cluster;
            }
            formed = true;
            break;
          }
        }
      }
      return { date, stage };
    });
  }

  /** Places each candidate, in request order, into the best forming cluster for the date:
   * highest similarity (at least 0.7) across its tags, then fewest members, then oldest cluster. */
  async assign({
    date,
    stage,
    candidates,
    limits,
  }: {
    date: string;
    stage: string;
    candidates: string;
    limits: string;
  }) {
    const caps: Record<string, number> = JSON.parse(limits),
      offered: Candidate[] = JSON.parse(candidates);
    return this.state.change(s => {
      for (const { row, tags } of this.#candidates(s, date, offered).sort((a, b) => this.#byAge(a.row, b.row))) {
        let best: { cluster: ClusterRow; score: number; next: Window } | undefined;
        for (const cluster of s.clusters.filter(c => c.date === date && c.status === 'FORMING')) {
          const score = Math.max(...tags.map(t => similarity(t, cluster.tag)));
          if (score < minimumSimilarity) continue;
          const next = this.#fit(cluster, row, cluster.members.length, caps);
          if (!next) continue;
          if (
            !best ||
            score > best.score ||
            (score === best.score && cluster.members.length < best.cluster.members.length)
          )
            best = { cluster, score, next };
        }
        if (!best) continue;
        Object.assign(best.cluster, best.next, { area: this.#area(best.next.areas, caps) });
        best.cluster.members.push(row.request);
        row.status = 'MATCHED';
        row.cluster = best.cluster.cluster;
      }
      return { date, stage };
    });
  }

  /** Ends a date's run: its clusters become complete and anyone left waiting is unmatched. */
  async finish({ date }: { date: string }) {
    return this.state.change(s => {
      for (const c of s.clusters) if (c.date === date && c.status === 'FORMING') c.status = 'COMPLETE';
      for (const r of s.requests)
        if (r.date === date && r.status === 'PENDING') {
          r.status = 'UNMATCHED';
          r.reason = 'NO_MATCH';
        }
      return { date };
    });
  }

  async activate({ cluster, event }: { cluster: string; event: string }) {
    return this.state.change(s => {
      const c = s.clusters.find(c => c.cluster === cluster);
      if (c?.status === 'COMPLETE') {
        c.status = 'GENERATED';
        c.event = event;
      }
      return { cluster };
    });
  }
  /** No event could be generated: members are told to choose another date. */
  async abandon({ cluster }: { cluster: string }) {
    return this.state.change(s => {
      const c = s.clusters.find(c => c.cluster === cluster);
      if (c?.status === 'COMPLETE') {
        c.status = 'FAILED';
        for (const r of s.requests.filter(r => r.cluster === cluster && r.status === 'MATCHED')) {
          r.status = 'UNMATCHED';
          r.reason = 'NO_VENUE';
        }
      }
      return { cluster };
    });
  }
  async close({ cluster }: { cluster: string }) {
    return this.state.change(s => {
      const c = s.clusters.find(c => c.cluster === cluster);
      if (c && c.status !== 'FAILED') c.status = 'CLOSED';
      return { cluster };
    });
  }
  /** Records the final outcome of a matched request's invitation. Never requeues. */
  async reconcile({
    request,
    status,
    active,
    reason,
  }: {
    request: string;
    status: string;
    active: boolean;
    reason: string;
  }) {
    return this.state.change(s => {
      const r = s.requests.find(r => r.request === request);
      if (!r || r.status !== 'MATCHED' || active) return { request };
      if (reason === 'EVENT_CANCELLED') {
        r.status = 'UNMATCHED';
        r.reason = 'EVENT_CANCELLED';
      } else {
        r.status = 'CLOSED';
        r.reason = reason || status;
      }
      return { request };
    });
  }

  /** Records which requests a date's event plan seated. `placed` is a JSON array of request ids.
   * Each complete cluster of the date becomes GENERATED if any of its requests is placed, otherwise FAILED;
   * its matched requests that were not placed become unmatched (NO_VENUE).
   * Does no planning, and only touches complete clusters, so settling twice changes nothing. */
  async settle({ date, placed }: { date: string; placed: string }) {
    let ids: unknown;
    try {
      ids = JSON.parse(placed);
    } catch {
      ids = [];
    }
    const seated = new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
    return this.state.change(s => {
      for (const c of s.clusters.filter(c => c.date === date && c.status === 'COMPLETE')) {
        c.status = c.members.some(m => seated.has(m)) ? 'GENERATED' : 'FAILED';
        for (const r of s.requests.filter(
          r => r.cluster === c.cluster && r.status === 'MATCHED' && !seated.has(r.request),
        )) {
          r.status = 'UNMATCHED';
          r.reason = 'NO_VENUE';
        }
      }
      return { date };
    });
  }

  async _mine({ user }: { user: string }) {
    const s = await this.state.read();
    return {
      requests: JSON.stringify(
        s.requests
          .filter(r => r.user === user)
          .sort((a, b) => b.created - a.created)
          .map(({ request, date, start, end, selected, location, radius, status, reason }) => ({
            request,
            date,
            start,
            end,
            selected,
            location,
            radius,
            status,
            reason,
          })),
      ),
    };
  }
  async _opened({ run }: { run: string }) {
    return ((await this.state.read()).runs.find(r => r.run === run)?.dates ?? []).map(date => ({ date }));
  }
  /** Pending requests that chose an interest, offering only that interest. */
  async _chosen({ date }: { date: string }) {
    const rows = (await this.state.read()).requests.filter(
      r => r.date === date && r.status === 'PENDING' && r.selected,
    );
    return { candidates: JSON.stringify(rows.map(r => ({ request: r.request, tags: [r.selected] }))) };
  }
  /** Every pending request, offering all of its profile interests. */
  async _profile({ date }: { date: string }) {
    const rows = (await this.state.read()).requests.filter(r => r.date === date && r.status === 'PENDING');
    return { candidates: JSON.stringify(rows.map(r => ({ request: r.request, tags: r.interests }))) };
  }
  async _completed(_: Record<string, never>) {
    return (await this.state.read()).clusters
      .filter(c => c.status === 'COMPLETE')
      .map(c => ({
        cluster: c.cluster,
        area: c.area,
        tag: c.tag,
        start: c.start,
        end: c.start + timing.duration,
        size: c.members.length,
      }));
  }
  async _members({ cluster }: { cluster: string }) {
    return (await this.state.read()).requests
      .filter(r => r.cluster === cluster && r.status === 'MATCHED')
      .map(r => ({ invitee: r.user, request: r.request }));
  }

  /** Complete clusters awaiting a plan, one row per date, as JSON:
   * [{ cluster, tag, start, end, areas, members: [{ request, user }] }].
   * `start`/`end` is the cluster's full shared window and `areas` all its shared reachable areas;
   * members are oldest first. */
  async _planning(_: Record<string, never>) {
    const s = await this.state.read(),
      complete = s.clusters.filter(c => c.status === 'COMPLETE');
    return [...new Set(complete.map(c => c.date))].sort().map(date => ({
      date,
      clusters: JSON.stringify(
        complete
          .filter(c => c.date === date)
          .map(c => ({
            cluster: c.cluster,
            tag: c.tag,
            start: c.start,
            end: c.end,
            areas: c.areas,
            members: s.requests
              .filter(r => r.cluster === c.cluster && r.status === 'MATCHED')
              .sort((a, b) => this.#byAge(a, b))
              .map(r => ({ request: r.request, user: r.user })),
          })),
      ),
    }));
  }

  #candidates(s: Pool, date: string, offered: Candidate[]) {
    return offered
      .flatMap(c => {
        const row = s.requests.find(r => r.request === c.request && r.date === date && r.status === 'PENDING');
        return row && Array.isArray(c.tags) && c.tags.length
          ? [{ row, tags: c.tags.filter(t => typeof t === 'string') }]
          : [];
      })
      .filter(c => c.tags.length);
  }
  #byAge(a: RequestRow, b: RequestRow) {
    return a.created - b.created || a.request.localeCompare(b.request);
  }
  #cap(areas: string[], caps: Record<string, number>) {
    return Math.min(15, Math.max(0, ...areas.map(a => caps[a] ?? 0)));
  }
  #area(areas: string[], caps: Record<string, number>) {
    return [...areas].sort((a, b) => (caps[b] ?? 0) - (caps[a] ?? 0))[0] ?? '';
  }
  /** The shared window after adding `row`, or undefined if availability, reach or capacity would break. */
  #fit(window: Window, row: RequestRow, size: number, caps: Record<string, number>): Window | undefined {
    const start = Math.max(window.start, row.start),
      end = Math.min(window.end, row.end);
    const areas = window.areas.filter(a => row.reachable.includes(a));
    if (end - start < timing.duration || !areas.length || size + 1 > this.#cap(areas, caps)) return undefined;
    return { start, end, areas };
  }
}
