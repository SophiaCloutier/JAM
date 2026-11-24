# Invitation-slice validation

Run `docker compose up -d`, `bun test`, `bun run check`, and `bun run build`.

Automated tests cover invitation delivery idempotency, one active invitation, acceptance, decline, deadline equality, expiry replay, owner cancellation, lazy expiry (reads report EXPIRED and the active lock is released without a periodic job), event cancellation keeping expired and cancelled outcomes distinct, and concurrent response races. The HTTP journey checks cookie issuance, .edu input rejection, duplicate registration, unauthenticated access, forged session input, cross-origin rejection, another user's inbox and response protection, persistence across assembly restart, and logout.

*Update 2026-11-23:* the single HTTP journey has since been split into separate tests and extended to every endpoint. See [Increment 5](#increment-5-test-suite-restructure-lifecycle-recovery-and-every-endpoint).

Manual walkthrough: seed, sign in as Percy, inspect the full invitation, accept, reopen the inbox, and cancel after reading the warning. Sign in as Riley and decline. Alex can be used for expiry testing. Confirm that errors preserve the current screen and history distinguishes decisions from event cancellation.

These are local results, not deployment evidence or user research. The team still needs to record a narrated useful journey, deploy and verify a public URL, and link both in the README for F4.

Observed locally: six tests / 28 assertions pass; concept source checks, generated artifact checks, TypeScript and Vue type checks pass; production build passes. Browser walkthrough verified demo sign-in, invitation rendering, confirmation prompt, and successful acceptance without a page reload.

## Increment 3: date-based matching without a clock concept

New and changed tests:
- `tests/matching.test.ts` (Matching concept, injected clock, setup only through Matching actions): calendar-day lead time (Thursday 3pm may request Saturday 11am, not Friday); window, chosen-interest, location and reach validation; one open request; a date opens exactly once and is then closed to new requests; dates are not due before the day before them unless forced; exact clusters form before related ones; a chosen interest joins a related (0.7) cluster; ties go to the smaller cluster; availability, reach and venue capacity are hard constraints; Surprise me prefers an exact profile match; unrelated interests never match; no-venue, event-cancelled and declined outcomes; owner-only withdraw; dates missed during downtime are marked too late.
- `tests/event-generating.test.ts`: once-per-cluster generation and capacity for everyone invited; `reviewDue` cancels an event short of three acceptances at the cutoff, reports each change once, and finishes confirmed events.
- `tests/full-journey.test.ts` (HTTP and reactions): the concept doc's end-to-end scenario including an unmatched user who cannot re-request the matched date but can request a later one; exact groups before related groups with Surprise me joining the smaller exact group; authentication, owner checks, lead-time and interest validation, one open request, and admin-only matching.

Observed by the implementer (agent) on 2026-11-22, before the team ran anything: `sync-engine check`, `sync-engine artifacts check`, `tsc` and `vue-tsc` pass. MongoDB was not available on that machine, so the Matching and EventGenerating test files were run against an in-memory stand-in for `AtomicState` only: 16 tests pass, repeated three times. **Not yet run:** any test against real MongoDB, the full HTTP journey, the Inviting tests, and a browser walkthrough of the new request form. Run `docker compose up -d` then `bun test` to check them.

## Increment 4: event planning

New and changed tests:
- `tests/event-planner.test.ts` (pure, no database). Covers: sample venues; grid sessions; a busy day that checks every invariant (sizes 3–15, inside the cluster's window, venue area among the cluster's areas, overlapping seats ≤ capacity, daily cap, opening hours); seat sharing; the daily cap; identical output for identical input; ties spreading across venues; a 31-person cluster split 15/13/3 under one group; oldest seated first; leftovers joining a spare seat with the same tag; members who cannot fit absent from every event.
- `tests/concept-boundaries.test.ts`: no concept imports another; EventGenerating and the planner use no similarity.
- `tests/event-generating.test.ts` (rewritten): once-per-date planning, members and placed ids, a cluster too big for its only venue, an unplaceable date, `_limits`, `reviewDue` cancel and finish, admin cancel.
- `tests/matching.test.ts`: existing tests unchanged; new tests for `_planning` and `settle`.
- `tests/full-journey.test.ts`: existing tests unchanged; new journey where eight people share a window in which only a six-seat café is open, so six are invited and two get `NO_VENUE`.

Observed by the implementer (agent) on 2026-11-23: `bun run generate`, `bun run check` (same 19 `MISSING_ENDPOINT_FALLBACK` advisories as before) and `bun run build` pass. Docker and MongoDB were not available on that machine. The planner, boundary and catalog tests pass. The Matching and EventGenerating test files pass (23 tests) against an in-memory stand-in for `AtomicState` and `database()`. **Not yet run:** any test against real MongoDB, the full HTTP journeys (including the new `NO_VENUE` one), the Inviting, Characterizing and HTTP tests, and a browser walkthrough. Run `docker compose up -d` then `bun test`.

*Update 2026-11-23:* all of these have since passed against real MongoDB, including the `NO_VENUE` journey (see the next two sections).

## Characterizing and full run against MongoDB (2026-11-23)

New tests:
- `tests/characterizing.test.ts` (concept, real MongoDB, setup only through Characterizing actions): create, add, read back and remove; a second profile is refused (`PROFILE_EXISTS`); add and remove without a profile are refused (`PROFILE_NOT_FOUND`) and create nothing; normalization, aliases, one-letter typo correction against suggested tags, and no duplicates; invalid tags and a 13th interest are refused without changing the profile; removing an absent tag changes nothing; profiles are independent per user.
- `tests/catalog.test.ts`: the "did you mean" suggestion catches missing, swapped and substituted letters of suggested tags, and suggests nothing for exact tags, aliases, unrelated words, or short words two edits away.

Observed by Milin on 2026-11-23 with Bun 1.4.2 and MongoDB 8.3 in Docker: `bun test` passes 56 tests across 9 files (804 assertions), including every file listed above as not yet run (Inviting, HTTP and full-journey tests against real MongoDB). `bun run check` (same 19 `MISSING_ENDPOINT_FALLBACK` advisories) and `bun run build` pass. Browser check: registering, signing in, choosing interests and filling in the request form at `http://localhost:3000`.

Found while testing: opening the app at `http://127.0.0.1:3000` instead of the configured `PUBLIC_ORIGIN` makes every request fail with "You do not have permission for this action." This is the intended cross-origin protection; the README now says to use the exact origin. The disabled "Find me a JAM" button showed a loading cursor and hid its reason until a date was chosen; it now shows a not-allowed cursor and always states what is missing.

**Not yet done:** deployment, a narrated recording, and a full browser walkthrough of matching, invitations and event confirmation.

## Increment 5: test suite restructure, lifecycle, recovery and every endpoint

### Structure (all test files)

Each test file now starts with a **testing strategy** comment that lists, for every action or behavior, the partitions of its inputs and states as indented bullets. Tests are grouped with `describe` blocks by action or partition. Each test has a `// covers:` line naming the partitions it exercises. Setup and helpers are split into one statement per line. The restructure changed no assertions: before and after, the database-free files ran 505 assertions and the Matching and EventGenerating files ran 81.

### New and changed tests

- `tests/http.test.ts`: the single HTTP journey became 22 separate tests, so one failing assertion no longer hides the rest. Each test starts from an empty database. It now calls all 18 endpoints:
  - authentication: no cookie, valid cookie with `/auth/current`, session id forged in the body, an expired session (clock moved 7 days forward; logging in again works), logout
  - registration: non-college email, new `.edu` email, duplicate email
  - login: right password (case and spaces in the email ignored), wrong password and unknown email (both 401 with no cookie)
  - untrusted origin
  - profile: add, read back, remove a present tag, remove an absent tag, no session
  - requests: submit, read back, withdraw
  - invitations:
    - another user can't see or answer someone else's invitation
    - accept once, then decline refused
    - cancel refused while pending
    - cancel refused for another user
    - cancel works once for the owner
  - admin and events: a non-admin is refused on every admin endpoint; an admin runs matching, lists the event, and cancels it, and members see it cancelled on `/events/mine`
  - persistence across a rebuilt server
  - **coverage check:** the last test reads the endpoint list from `design/compositions/Application.md` and fails if any endpoint was never called. It relies on Bun running a file's tests in order.
- `tests/full-journey.test.ts` (HTTP and the real reactions, no `runChain()` stand-in), new scenarios:
  - **chosen-interest fallback:** a chosen interest with no group joins a group through an exact profile interest
  - **Surprise me alone:** no chosen interests; the group forms from shared profile interests, and a user with no match gets `NO_MATCH`
  - **lifecycle** (clock moved with `setSystemTime`; scheduled work run with `app.poke()`, as the host timer does):
    - cancelling after accepting before the cutoff drops a confirmed event back to forming
    - cancelling after the cutoff cancels it at once
    - `reviewDue` at the cutoff cancels an event short of three, and accepted requests become `EVENT_CANCELLED`
    - `/admin/cancel` is admin-only; it cancels the event and every member's request becomes `EVENT_CANCELLED`
  - **recovery:** a crash is simulated by calling the concepts directly so the chain stops partway, then the host restarts with `app.poke()`
    - after matching finished, before planning: `RecoverDrafts` plans and invites
    - after planning, before invitations: `RecoverDeliveries` delivers
    - later restarts never invite anyone twice
- `tests/event-copy.test.ts` (new; `fetch` mocked, no network): `eventCopy` returns the model's copy on success, and the request sends the tag only as data. It falls back to the template on a 500, a timeout, message content that isn't JSON, a field over its length limit, and when no API key is set (in which case `fetch` is never called).
- `tests/catalog.test.ts`: the single test became four, one per partition (same eight assertions).

### How the new tests were checked

To confirm the new tests depend on the real reactions, the reactions they target were disabled temporarily, then restored:
- Making the profile stages offer only chosen interests made both new matching journeys fail.
- Unwiring `ReconsiderCancellation`, `CancelDue`, `AdminCancelled`, `RecoverDrafts` and `RecoverDeliveries` made all six lifecycle and recovery tests fail.

The event-copy failure tests return copy that differs from the template, so removing the `response.ok` check or the length limits would make them fail.

### Behavior the tests document

When `reviewDue` cancels an event at the cutoff, a member who never answered already has an expired invitation: it expired six hours after it was sent, before the cutoff. Their request closes as `EXPIRED` rather than becoming `EVENT_CANCELLED`, so they are not asked to choose another date. Accepted members become `EVENT_CANCELLED`. This is existing behavior; changing it would be a small change in `Matching.reconcile`.

### Observed

Observed by the implementer (agent) on 2026-11-23 with Bun 1.4.3 and MongoDB 8 (`mongo:8` under Podman): `bun test` passes **94 tests across 10 files (1159 assertions)**. `bun run check` (same 19 `MISSING_ENDPOINT_FALLBACK` advisories) and `bun run build` pass.

| File | Tests |
|---|---|
| `http.test.ts` | 22 |
| `matching.test.ts` | 15 |
| `event-planner.test.ts` | 12 |
| `full-journey.test.ts` | 12 |
| `event-generating.test.ts` | 8 |
| `characterizing.test.ts` | 6 |
| `event-copy.test.ts` | 6 |
| `inviting.test.ts` | 6 |
| `catalog.test.ts` | 4 |
| `concept-boundaries.test.ts` | 3 |

**Not checked by automated tests:** the new date picker, the Location group (Near / Within) and the interest-button hover on the request page. These have no UI tests. A browser check is needed for: choosing a date, keyboard navigation in the calendar, and the layout on a phone-width screen.

**Not yet done:** deployment, a narrated recording, and a full browser walkthrough of matching, invitations and event confirmation.
