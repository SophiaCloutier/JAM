# JAM

A small-group creative meetup app for beginners. This branch is the **full alpha MVP**, built with Vue, TypeScript, Bun, MongoDB, and the course's `@mit-sdg/sync-engine` 1.1.0. Concepts never import one another; all application coordination lives in compositions.

## Local branches

- `codex/alpha-inviting`: this independently runnable slice, including accounts as supporting infrastructure, invitation inbox, decisions, deadlines, strikes, specs, and tests.
- `codex/alpha-full`: extends this slice with profiles, availability, matching, venues, event lifecycle, and admin controls.

All work is local. Nothing has been pushed or deployed.

## Run from a fresh clone

Install **Bun 1.4.x** and **Docker Desktop** (running), then:

```sh
bun install --frozen-lockfile
docker compose up -d
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell, `cp .env.example .env` on macOS/Linux). The defaults work with the included local MongoDB container.

```sh
bun run build
bun run seed
bun start
```

Open [localhost:3000](http://localhost:3000). Sign in as `percy@example.edu`, `riley@example.edu`, or `alex@example.edu` with password `jam-demo-password`. These are local fixtures, not real students or venue reservations. Seed does not reset decisions or delete data; use a fresh `MONGODB_DATABASE` for a fresh demo.

For hot reload, set `PUBLIC_ORIGIN=http://localhost:5173`, start `bun start` in one terminal and `bun run dev` in another, then open [localhost:5173](http://localhost:5173).

## Checks

```sh
bun run generate
bun run check
bun test
bun run build
```

MongoDB must be running for tests. Tests create and delete uniquely named test databases; no application database is erased. Generated contracts and readable API docs are committed in [generated](generated/). Regenerate after changing specs or compositions.

## Your integration points

- `.env`: insert your MongoDB URI/database and the browser's exact `PUBLIC_ORIGIN`. No secrets are required for the local demo.
- [Inviting](src/concepts/Inviting.ts): `invite` takes opaque user/event/request identities, epoch-millisecond timestamps, and a JSON display snapshot. No public API can create arbitrary invitations.
- [Invitations composition](src/compositions/Invitations.ts): cookie authentication, inbox, and responses run through the actual sync engine. Expiry is owned by Inviting: an unanswered invitation past its deadline reads as expired, with no periodic job.
- Teammates should supply event deliveries via syncs and handle decision outputs in syncs. `closeEvent` releases invitations on event cancellation or completion.
- [Current concept contracts](design/concepts/) and [decisions](docs/DECISIONS.md) supersede the older F3 behavior where invitation answers could change freely.

## Scope and handoff

The `.edu` suffix is checked, but mailbox ownership is **not verified**. The full branch includes interest profiles, date requests with a free-time window and travel distance, a once-per-date deterministic matching run, venue capacity, confirmation, cancellation and completion. There is no clock concept: the host calls `Matching.openDue` and `EventGenerating.reviewDue` at startup and every five minutes. Run one server process.

The F4 documents additionally call for deployment, a narrated recording, and submission. Those are outstanding team deliverables; no URL, recording, or submission is claimed here. See [validation](docs/VALIDATION.md).

## Full MVP setup

Set `ADMIN_EMAILS` in `.env` to your registered email to see matching controls. Create at least three accounts, choose a shared interest, and request the same date at least two calendar days ahead with overlapping free time and a shared meeting area. Run matching as the administrator (it treats dates up to the earliest requestable date as due); sign into each account and accept. The third acceptance confirms the event. Automatically, each date is matched once, from the day before it, while the server is running.

`src/venues.ts` contains suggested alpha locations and capacities: replace them with approved, precise meetup locations before a real pilot. They are not reservations. Optional `OPENAI_API_KEY` and `OPENAI_MODEL` enable event copy through the [Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create); leave them blank for tested template copy. Matching does not use the LLM.

The seed command on this branch still creates invitation fixtures for reviewing the shared Inviting slice; use fresh accounts for a full matching walkthrough.
