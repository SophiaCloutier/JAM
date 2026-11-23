# Alpha implementation decisions

The user's request is to implement two local branches incrementally with the sync engine and a simple black-and-white UI. Attached course/team documents are design inputs, not permission to publish, submit coursework, send messages, or push. The user explicitly prohibited pushing.

The November 20 architecture PDF is the current product baseline where it differs from ConceptDesign.md and the older team docs. In particular: interest-only profiles; one slot per request; final invitation decisions; six-hour response window; strikes for cancelling after acceptance; unstructured activities. Historical F3 documents remain intact.

The user's personal project is a structural reference: Vue, Bun, MongoDB, registered Markdown concept specs, declarative compositions, HTTP cookie policy, and generated contracts. JAM uses the same pinned course engine and HTTP adapter, not a homemade event bus. The published package supersedes the architecture PDF's explicitly tentative older `actions/frames` pseudocode.

Inviting owns the active-invitation lock and response state. MongoDB partial unique indexes protect one active invitation; conditional updates protect answer-once decisions even across competing requests. A strike is derived from an immutable cancellation flag on the invitation, avoiding a second counter write that could double count or be lost. Event shutdown uses `closeEvent` and never adds a strike.

The alpha host serializes HTTP admission and ticks through reaction settlement. Run one server process. Multi-replica scheduling and distributed cross-concept transactions are out of scope. Database credentials and session tokens are never included in generated documentation or logged by application code.

JSON display snapshots keep the Inviting concept independent from event structure. Times are epoch milliseconds in storage and displayed in the viewer's stated local timezone. Cancellation/decline consequences are explained before confirmation. The event display is a snapshot on this slice; the full branch supplies live event state through composition.

Increment 1: scaffold, independent concepts, auth and invitation HTTP compositions, desktop/mobile layout, seed, concept boundary tests, and real MongoDB/HTTP journey checks. Fixes from validation included engine specification grammar and declaring the inbox read model rather than passing a query as a response value.

Increment 2: added independent Characterizing, Matching and EventGenerating concepts and their sync compositions. Matching uses exact tags and fixed-category similarity (0.7); embedding similarity is deferred. Each small matching/event aggregate uses MongoDB revision compare-and-swap so grouping and venue reservations are atomic. The pool is capped at 5,000 historical requests for alpha.

Backfill closes early enough to preserve the full six-hour response window before the eight-hour cutoff. Accepted requests from cancelled events reopen with priority only if their remaining availability can still fit that window and a two-hour event. Otherwise they close and the user posts a new slot. Pending invitations to cancelled events expire without strikes. These timing refinements avoid immediately requeueing users into impossible events.

Full-journey verification passed: three HTTP-registered users add interests, post slots, trigger matching, receive engine-generated invitations, accept, and see a confirmed event (21 assertions). Optional paid LLM copy, public deployment, and full lifecycle browser validation have not been exercised.

## Increment 3: date-based matching, option logic in reactions, no Clock concept

Prompted by the team's updated Matching / EventGenerating / Inviting concept document. Changes and reasons:

- **Requests are for a date, at least two calendar days ahead.** The rule compares Boston calendar dates only, so a request on Thursday at any time may name Saturday at any time. The constant lives in `shared/catalog.ts` (`leadDays`) so the form's client-side check and the server rule cannot drift. `LEAD_HOURS` was removed.
- **Matching runs once per date.** `Matching.openDue` treats date D as due from the start of D-1, after submissions for D closed at the end of D-2, and records each opened date so repeated calls and restarts never re-match it. A request for an already-matched date is refused. Dates missed entirely during downtime are marked `TOO_LATE`.
- **Matching knows only similarity and availability; reactions choose the option.** Matching's `form` and `assign` take candidate interests per request and never read whether the user chose one. The Meetups reactions chain: exact clusters from chosen interests (score 1.0) → join on chosen interests (1.0, then 0.7, then smaller cluster) → join on profile interests (option 1's fallback, option 2's first step) → form clusters from profile interests (≥0.7) → join leftovers → finish. Each step handles a whole date in one action so the chain order is deterministic. The chosen interest and profile snapshot are stored with the request only so the queries can hand them back to reactions.
- **Similarity is the predefined table**: same tag 1.0, same category 0.7, otherwise 0, minimum 0.7. `pottery` was added (category ceramics) so the doc's examples are expressible.
- **Hard constraints**: a cluster keeps the intersection of its members' free-time windows (at least the event length), the intersection of their reachable meeting areas, and the largest venue capacity among those areas. Clusters are only created with three or more members, so there are no partial clusters to manage.
- **Location is an anchor and a travel distance** (1/3/5/10 mi) from a fixed list of Boston-area places. Reachable meeting areas are the existing venue areas (Campus, Cambridge, Boston) within that distance, so EventGenerating did not need to change how it picks venues.
- **No backfill or requeue.** Leftovers become unmatched (`NO_MATCH`); a failed generation makes members unmatched (`NO_VENUE`); a cancelled event makes requests unmatched (`EVENT_CANCELLED`). Declines, expiries and attendance close the request. The Plan page explains the reason and reopens the form with the previous interest pre-filled; the user may keep or change the interest but must pick a still-open date, because the matched date's run has already happened.
- **Clock concept removed.** Clock only produced identifiers for reactions to hang work on. Each concept now owns its own time rules: Inviting expires lazily (reads report an overdue pending invitation as EXPIRED; `invite` and `closeEvent` persist it, so the one-active-invitation index never blocks a new invitation), and EventGenerating's `reviewDue` cancels events short of three acceptances at the cutoff and finishes ended events from its own stored counts. The host calls `Matching.openDue` then `EventGenerating.reviewDue` at startup and every five minutes; the admin Run endpoint calls `openDue` with `force` for demos. Sessioning stays: it resolves the signed-in user, not time.
- **Strikes removed for now** from Inviting, the inbox and matching priority (see future considerations). Owner cancellation after accepting still exists and releases the place.
- `Application.md` was rewritten to describe each reaction instead of placeholder text, and the generated contract was regenerated.

Review notes: the implementation was agent-generated in this increment and reviewed step by step by Rachel during the session (lead-time semantics, removal of the `LEAD_DAYS` setting, sync-engine conformance of lazy expiry, scope of Clock/Sessioning). See `VALIDATION.md` for exactly what was and was not run.

### Future considerations

- **Strikes**: reintroduce cancellation strikes (and whether they affect matching order) once the core matching flow is validated with users.
- **Inviting deadline**: the team wants 24 hours to respond after the invitation arrives; it is still six hours. With matching at the start of D-1, a 24-hour window ends early on D, before events.
- **CANCELLED meaning**: the team wants CANCELLED to mean only "event cancelled" (fewer than three or no venue). Owner cancellation after accepting currently also records CANCELLED with reason `YOU_CANCELLED`.
- **EventGenerating**: accept every reachable area instead of one, and choose a start time inside the cluster's window rather than the window's start.
- **Expired invitations** only reach Matching when the event closes, so a user who ignored an invitation cannot submit a new request until then.
- **Notifications** are in-app only (request status and reason); no email.
- **Endpoint fallbacks**: the sync-engine check reports `MISSING_ENDPOINT_FALLBACK` advisories for every endpoint (present before this increment).

## Characterizing: refined and simplified concept

The F3 concept design (`ConceptDesign.md`) modeled a profile as a set of Information items, each with a type (INTEREST or SKILL) and a value, edited through `addInformation` and `removeInformation`. For alpha we simplified this to a profile that holds only a set of normalized interest tags, with `addInterest` and `removeInterest`. Matching uses only interests, and the dev plan defers the skills/interests split to F5, so the typed Information records added state and identifiers no action used yet. Actions now take the user rather than a Profile or Information identity, because each user has exactly one profile and an interest is identified by its tag. The purpose and principle keep the design's language, and `design/concepts/Characterizing.md` was rewritten from placeholder text to state real preconditions and effects. We kept the design's preconditions as errors: `create` refuses `PROFILE_EXISTS` for a second profile, and `addInterest`/`removeInterest` refuse `PROFILE_NOT_FOUND` instead of creating a missing profile. Every profile is therefore created once, by the reaction on registration (the demo seed now creates its users' profiles too). Interests are normalized, limited to 2–40 characters and at most 12 per profile, and a one-letter typo of a suggested tag snaps to that tag so near-duplicates don't split matching groups. Removing an absent tag succeeds without change. A request copies the profile's interests when it is submitted, so later profile edits never change an existing request. Skills, proficiency and the beginner comfort question remain F5 work.

## Increment 4: EventGenerating plans venues, times and splits

Before this increment EventGenerating took the first venue in the cluster's single collapsed area, at the start of the cluster's window, that had enough capacity, and it never split a group. Many clusters that could have met somewhere at some time got `NO_VENUE`. Matching's clustering already worked, so it was kept as it is.

- **Matching: two additions only.** `_planning()` hands every complete cluster to a reaction as JSON, one row per date: `{ cluster, tag, start, end, areas, members: [{ request, user }] }`, with the cluster's full shared window, all its shared reachable areas, and members oldest first. `settle(date, placed)` records the outcome: a complete cluster becomes GENERATED if any of its requests got a seat, otherwise FAILED, and its unseated members become `UNMATCHED` (`NO_VENUE`). Clustering, similarity, capacity limits, the option chain, `_completed`, `activate` and `abandon` are unchanged. The reactions no longer call `activate` or `abandon`.
- **EventGenerating plans a whole date once** with `plan(date, clusters)`, using a pure planner in `src/event-planner.ts`. Events have 3 to `min(15, venue capacity)` people and last the event duration. They start on a `START_GRID_MINUTES` grid (default 30), inside the cluster's window and the venue's Boston opening hours, and no earlier than now + cutoff + response window. The venue must be in one of the cluster's areas. Overlapping events at a venue share its JAM seats, and the per-venue daily cap remains. A greedy loop opens the session that seats the most people. It avoids leaving one or two members of a cluster behind, and ties are broken by a seeded hash of `date|venue|start|tag`. Leftovers then take spare seats in another event with the same tag that fits their own cluster's window and areas. Unseated people are never stored. Planning a date twice returns the same plan. EventGenerating uses no similarity: tags are only labels to it.
- **`event.group`** is the cluster an event was planned for, and several events may share it. `Matching.close({ cluster: group })` only sets the cluster's status marker and never touches requests, so closing it when one event locks cannot affect a sibling event or its members.
- **Venues** are twelve sample cafés across Campus, Cambridge and Boston with seats (4–15), daily caps and opening hours, labelled as samples. `_limits` is unchanged and reflects the new list, so Matching's cluster cap is now the largest café seat count per area.
- A test fails if any file in `src/concepts/` imports another concept, or if EventGenerating or the planner uses similarity.

Decisions made where the brief was open:
- **`_planning` takes no arguments** and returns one row per date that still has complete clusters. A single date-filtered query could not serve recovery: after an interrupted run nothing says which dates still need planning. Both the normal reaction (after `finish`) and recovery (after `openDue`) use it, and planning and settling are idempotent per date.
- **Remainder rule** counts the cluster's still-unseated members.
- **Event capacity** in `_planned` and the details is the number of seats the event holds (its members), because a venue's seats are shared between overlapping events.
- **Top-up members** keep their own request ids, and their own cluster becomes GENERATED through `settle` because one of its requests is seated.

### Future considerations

- **Host your own event**: let a user propose a venue and time that others can join.
- **Related-category fallback** in planning: when a cluster cannot be seated, offer spare seats at an event with a related tag. This is deliberately not done now, so that EventGenerating stays free of similarity.
- **History-aware matching**: prefer mixing people who have not met recently, or reuniting groups who enjoyed an event.
- Backfill after declines and the 24-hour response window remain open (see Increment 3).
