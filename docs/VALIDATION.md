# Invitation-slice validation

Run `docker compose up -d`, `bun test`, `bun run check`, and `bun run build`.

Automated tests cover invitation delivery idempotency, one active invitation, acceptance, decline, deadline equality, expiry replay, owner cancellation and exactly one strike, system cancellation without strikes, and concurrent response races. The HTTP journey checks cookie issuance, .edu input rejection, duplicate registration, unauthenticated access, forged session input, cross-origin rejection, another user's inbox and response protection, persistence across assembly restart, and logout.

Manual walkthrough: seed, sign in as Percy, inspect the full invitation, accept, reopen the inbox, and cancel after reading the warning. Sign in as Riley and decline. Alex can be used for expiry testing. Confirm that errors preserve the current screen and history distinguishes decisions from event cancellation.

These are local results, not deployment evidence or user research. The team still needs to record a narrated useful journey, deploy and verify a public URL, and link both in the README for F4.

Observed locally: six tests / 28 assertions pass; concept source checks, generated artifact checks, TypeScript and Vue type checks pass; production build passes. Browser walkthrough verified demo sign-in, invitation rendering, confirmation prompt, and successful acceptance without a page reload.
