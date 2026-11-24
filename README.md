# JAM

JAM matches beginners in Boston into small groups to try a creative hobby together. Users list their interests and request a date. JAM forms groups by shared interest, free time and location, plans each event at a café, and invites the group. Built by [Sophia, Milin, Estrella and Rachel](team.md) for 6.1040, Fall 2026.

## Submissions

| Milestone | Deliverable | Link |
|---|---|---|
| F2 | Problem framing | [ProblemFraming.md](ProblemFraming.md) |
| F3 | Concept design (concepts, user journey, design summary, plan) | [ConceptDesign.md](ConceptDesign.md) |
| F3 | Visual design study | [Google Slides](https://docs.google.com/presentation/d/1r7CG1E5T2qyKVakuHljLeruqA5qVlXWfylAsXx5wW5o/edit?usp=sharing) |
| F4 | Deployed app | _Not yet deployed_ |
| F4 | Narrated recording | _Not yet recorded_ |
| F4 | Concept specifications | [design/concepts](design/concepts/) |
| F4 | Reactions and endpoints | [design/compositions/Application.md](design/compositions/Application.md) |
| F4 | Generated API documentation | [generated/jam-alpha.md](generated/jam-alpha.md) |
| F4 | Design notes | [docs/DECISIONS.md](docs/DECISIONS.md) |
| F4 | Validation and test results | [docs/VALIDATION.md](docs/VALIDATION.md) |

[ConceptDesign.md](ConceptDesign.md) and [ProblemFraming.md](ProblemFraming.md) describe the current implementation. Earlier versions are in the Git history, and [docs/DECISIONS.md](docs/DECISIONS.md) explains each change.

## Run locally

Requires [Bun](https://bun.sh) 1.4.x and Docker Desktop (or Podman), running.

```sh
bun install --frozen-lockfile
docker compose up -d          # or: podman compose up -d
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
bun run build
bun run seed
bun start
```

Open **http://localhost:3000**. The address must match `PUBLIC_ORIGIN` in `.env` exactly. Using `127.0.0.1` instead fails with "You do not have permission for this action."

Sign in as `percy@example.edu`, `riley@example.edu` or `alex@example.edu` with password `jam-demo-password`, or register any `.edu` email. Each of the three demo users has a sample invitation.

- **Run one server process.** Stop `bun start` before running any seed script. The server reads `.env` only at startup.
- **Hot reload:** set `PUBLIC_ORIGIN=http://localhost:5173`, run `bun start` and `bun run dev` in two terminals, and open http://localhost:5173.
- **Fresh data:** change `MONGODB_DATABASE` in `.env`. Seeds never delete data.
- **Optional:** set `OPENAI_API_KEY` and `OPENAI_MODEL` to write event descriptions with an LLM. Without them, JAM uses template text. Matching never uses the LLM.

## Try matching

Each date is matched once, starting the day before it. Admins can run matching early with **Run matching** on the plans page.

1. In `.env`, set a fresh `MONGODB_DATABASE` (for example `jam_demo`) and `ADMIN_EMAILS=you@school.edu,admin@example.edu`, using the email you will register with.
2. With the server stopped, run `bun run build`, then `bun run seed:requests`. This creates about 60 users with requests for the earliest requestable date (two days from today, Boston time). It should end with `61 new requests for <date>`.
3. Run `bun start`, register with your admin email, choose interests, and request the **earliest date the date picker allows** with one of these:

   | Interest | Free time | Near | Within |
   |---|---|---|---|
   | guitar | 19:00–22:00 | Kendall Square | 1 mile |
   | knitting | 14:00–17:00 | Harvard Square | 1 mile |
   | painting | 10:00–13:00 | Downtown Boston | 1 mile |
   | Surprise me (origami or scrapbooking in your profile) | 13:00–17:00 | MIT campus | 3 miles |

4. Click **Run matching**, then open **Invitations** to see your café and time.
5. An event is confirmed at three acceptances. Accept yours, then sign in as two group members (for example `guitar1@example.edu` and `guitar2@example.edu`, password `jam-demo-password`) and accept theirs.

The seeded groups also show the failure cases: a group with too few seats (`NO_VENUE`), groups competing for the same café, and a group too small to match (`NO_MATCH`). To print everyone's outcome without signing in, run `bun run seed:requests --run` on a fresh database (server stopped). That closes the date to new requests. `bun run seed:matching` is a smaller 8-user scenario for the interest options.

## Checks

MongoDB must be running. Tests create and drop their own databases.

```sh
bun run generate   # regenerate contracts after changing specs or compositions
bun run check      # spec, contract and type checks
bun test
bun run build
```

## Code layout

| Path | Contents |
|---|---|
| `src/concepts/` | One file per concept. Concepts never import each other. |
| `src/compositions/` | Reactions and HTTP endpoints that coordinate concepts. |
| `web/` | Vue front end. |
| `shared/` | Interest tags, similarity table and locations, shared by server and client. |
| `src/venues.ts` | Sample cafés with seats, daily limits and opening hours. |
| `scripts/` | Demo seed scripts. |
| `tests/` | Concept, planner, HTTP and full-journey tests. |

## Limitations

- The `.edu` suffix is checked, but email ownership is not verified.
- Venues are sample cafés, not reservations or partnerships.
- Skills, structured activities (such as bands), history-aware matching and no-show penalties are not implemented. See [ConceptDesign.md](ConceptDesign.md#development-plan).
- There is no clock concept. The server runs matching and event reviews at startup and every five minutes.
