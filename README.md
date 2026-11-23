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

With **Podman** instead of Docker, use `podman compose up -d` (run `podman machine start` first if the VM is stopped). Stop the database later with `docker compose down` / `podman compose down`; its data is kept.

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell, `cp .env.example .env` on macOS/Linux). The defaults work with the included local MongoDB container.

```sh
bun run build
bun run seed
bun start
```

Open [localhost:3000](http://localhost:3000). Sign in as `percy@example.edu`, `riley@example.edu`, or `alex@example.edu` with password `jam-demo-password`. These are local fixtures, not real students or venue reservations. Seed does not reset decisions or delete data; use a fresh `MONGODB_DATABASE` for a fresh demo.

For hot reload, set `PUBLIC_ORIGIN=http://localhost:5173`, start `bun start` in one terminal and `bun run dev` in another, then open [localhost:5173](http://localhost:5173).

## Try matching and event planning with demo users

`bun run seed:requests` creates about 60 demo users who already have requests for the earliest requestable date (two calendar days from today, Boston time). The groups are sized to the sample cafés in [src/venues.ts](src/venues.ts): big groups, a group with too few seats (`NO_VENUE`), groups competing for the same cafés, an evening group, a group no café is open for, and a group too small to match (`NO_MATCH`). You then add your own request and run matching.

1. **Start MongoDB** and copy `.env.example` to `.env` (see above). For a clean demo, set `MONGODB_DATABASE=jam_demo` (any unused name) in `.env`. Each date is matched only once per database.
2. **Make yourself an admin.** In `.env`, set `ADMIN_EMAILS` to the `.edu` email you will register with, plus the seeded admin:
   ```
   ADMIN_EMAILS=you@school.edu,admin@example.edu
   ```
   Only these accounts see the **Run matching** button, which runs matching immediately instead of waiting for the automatic run.
3. **Seed while the server is stopped.** The seed script starts its own copy of the app on the same database, and the alpha supports one process at a time. Stop `bun start` (Ctrl+C) if it is running, then:
   ```sh
   bun run build
   bun run seed:requests
   ```
   It should end with `61 new requests for <date> (61 users).` If it says `0 new requests`, the users already had requests in this database (use a fresh `MONGODB_DATABASE`).
4. **Start the server:** `bun start`, then open [localhost:3000](http://localhost:3000). Restart it whenever you change `.env`; the server reads `.env` only at startup.
5. **Register and request.** Register with the email from step 2, choose interests, and request the **earliest date the date picker allows**. Any of these requests will join a seeded group:

   | Interest | Free time | Starting from | Distance | Joins |
   |---|---|---|---|---|
   | guitar | 19:00–22:00 | Kendall Square | 1 mi | an evening guitar group |
   | knitting | 14:00–17:00 | Harvard Square | 1 mi | a Cambridge knitting group |
   | painting | 10:00–13:00 | Downtown Boston | 1 mi | a Boston painting group |
   | Surprise me (origami or scrapbooking in your profile) | 13:00–17:00 | MIT campus | 3 mi | a Cambridge origami or scrapbooking group |

   Avoid drawing at 13:00–18:00 on campus: that group is already at its size limit.
6. **Run matching.** Click **Run matching** at the bottom of the Plan page, then open **Invitations** to see your café and time.
7. **Confirm the event (optional).** An event is confirmed after three acceptances. Accept your invitation, then sign in as two people from your group and accept theirs. Their emails follow the group name, for example `guitar1@example.edu` and `guitar2@example.edu`, all with the password `jam-demo-password`.

Things to know:
- **Run matching only matches dates up to the earliest requestable date.** A request for a later date stays "Waiting for matching" until the server matches it automatically, from the start of the day before that date.
- To see everyone's outcome without signing in to each account, run `bun run seed:requests --run` (server stopped) on a fresh database. It seeds, runs matching and prints each user's status with their café and time. After that the date is closed, so you can no longer add your own request for it.
- `bun run seed:matching` is a smaller scenario (8 users) focused on Matching's interest options.

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

The `.edu` suffix is checked, but mailbox ownership is **not verified**. The full branch includes interest profiles, date requests with a free-time window and travel distance, a once-per-date deterministic matching run, a once-per-date event plan that chooses venues, start times and splits for the matched groups, confirmation, cancellation and completion. There is no clock concept: the host calls `Matching.openDue` and `EventGenerating.reviewDue` at startup and every five minutes. Run one server process.

The F4 documents additionally call for deployment, a narrated recording, and submission. Those are outstanding team deliverables; no URL, recording, or submission is claimed here. See [validation](docs/VALIDATION.md).

## Full MVP setup

The quickest walkthrough is [Try matching and event planning with demo users](#try-matching-and-event-planning-with-demo-users). To do it by hand instead: set `ADMIN_EMAILS` in `.env` to your registered email to see matching controls. Create at least three accounts, choose a shared interest, and request the same date at least two calendar days ahead with overlapping free time and a shared meeting area. Run matching as the administrator (it treats dates up to the earliest requestable date as due); sign into each account and accept. The third acceptance confirms the event. Automatically, each date is matched once, from the day before it, while the server is running.

`src/venues.ts` contains sample cafés with JAM seat counts, daily event limits and opening hours: they are placeholders, not reservations or partnerships, so replace them with approved, precise meetup locations before a real pilot. After matching, EventGenerating plans each date once: a venue in the group's reachable areas and a start time on a `START_GRID_MINUTES` grid (default 30) inside the group's shared free time and the venue's opening hours. It splits large groups into events of 3 to 15, and overlapping events at one venue share its seats. Group members who get no seat are told no venue was available. Optional `OPENAI_API_KEY` and `OPENAI_MODEL` enable event copy through the [Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create); leave them blank for tested template copy. Matching does not use the LLM.

The seed command on this branch still creates invitation fixtures for reviewing the shared Inviting slice; use fresh accounts or `bun run seed:requests` (see above) for a full matching walkthrough. Like the server, every seed script should run with `bun start` stopped.
