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
