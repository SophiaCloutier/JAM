# Invitation-slice validation

Run `docker compose up -d`, `bun test`, `bun run check`, and `bun run build`.

Automated tests cover invitation delivery idempotency, one active invitation, acceptance, decline, deadline equality, expiry replay, owner cancellation, lazy expiry (reads report EXPIRED and the active lock is released without a periodic job), event cancellation keeping expired and cancelled outcomes distinct, and concurrent response races. The HTTP journey checks cookie issuance, .edu input rejection, duplicate registration, unauthenticated access, forged session input, cross-origin rejection, another user's inbox and response protection, persistence across assembly restart, and logout.

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

## Characterizing and full run against MongoDB (2026-11-23)

New tests:
- `tests/characterizing.test.ts` (concept, real MongoDB, setup only through Characterizing actions): create, add, read back and remove; a second profile is refused (`PROFILE_EXISTS`); add and remove without a profile are refused (`PROFILE_NOT_FOUND`) and create nothing; normalization, aliases, one-letter typo correction against suggested tags, and no duplicates; invalid tags and a 13th interest are refused without changing the profile; removing an absent tag changes nothing; profiles are independent per user.
- `tests/catalog.test.ts`: the "did you mean" suggestion catches missing, swapped and substituted letters of suggested tags, and suggests nothing for exact tags, aliases, unrelated words, or short words two edits away.

Observed by Milin on 2026-11-23 with Bun 1.4.2 and MongoDB 8.3 in Docker: `bun test` passes 56 tests across 9 files (804 assertions), including every file listed above as not yet run (Inviting, HTTP and full-journey tests against real MongoDB). `bun run check` (same 19 `MISSING_ENDPOINT_FALLBACK` advisories) and `bun run build` pass. Browser check: registering, signing in, choosing interests and filling in the request form at `http://localhost:3000`.

Found while testing: opening the app at `http://127.0.0.1:3000` instead of the configured `PUBLIC_ORIGIN` makes every request fail with "You do not have permission for this action." This is the intended cross-origin protection; the README now says to use the exact origin. The disabled "Find me a JAM" button showed a loading cursor and hid its reason until a date was chosen; it now shows a not-allowed cursor and always states what is missing.

**Not yet done:** deployment, a narrated recording, and a full browser walkthrough of matching, invitations and event confirmation.
