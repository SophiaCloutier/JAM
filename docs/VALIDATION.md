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
