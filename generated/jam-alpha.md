<!-- Generated from the JAM alpha assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# JAM alpha — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Authenticating

Defined in [Authenticating](../design/concepts/Authenticating.md), line 1.

#### Actions

- `register(email: String, password: String) : returns (user: User)`
  - Refuses `INVALID_ACCOUNT`: email is not .edu or password length is outside 10 to 128.
  - Refuses `ACCOUNT_TAKEN`: email is already registered.
- `login(email: String, password: String) : returns (user: User)`
  - Refuses `INVALID_CREDENTIALS`: credentials do not match.

#### Instances

- `Authenticating` — instance of `Authenticating` — [JAM application types](../design/types.md), line 13.
  - `User` is `Person` — [JAM application types](../design/types.md), line 14.

### Clock

Defined in [Clock](../design/concepts/Clock.md), line 1.

#### Actions

- `tick() : returns (tick: Tick)`

#### Instances

- `Clock` — instance of `Clock` — [JAM application types](../design/types.md), line 21.

### Inviting

Defined in [Inviting](../design/concepts/Inviting.md), line 1.

#### Actions

- `invite(invitee: User, event: Event, request: Request, start: Number, end: Number, deadline: Number, details: String) : returns (invitation: Invitation)`
  - Refuses `INVITATION_UNAVAILABLE`: time window is invalid or user has another active invitation.
- `accept(invitation: Invitation, invitee: User) : returns (event: Event, request: Request)`
  - Refuses `INVITATION_FORBIDDEN`: invitee does not own invitation.
  - Refuses `INVITATION_UNAVAILABLE`: invitation is not pending and active before deadline.
- `decline(invitation: Invitation, invitee: User) : returns (event: Event, request: Request)`
  - Refuses `INVITATION_FORBIDDEN`: invitee does not own invitation.
  - Refuses `INVITATION_UNAVAILABLE`: invitation is not pending and active before deadline.
- `cancel(invitation: Invitation, invitee: User) : returns (event: Event, request: Request)`
  - Refuses `INVITATION_FORBIDDEN`: invitee does not own invitation.
  - Refuses `INVITATION_UNAVAILABLE`: invitation is not accepted and active before start.
- `expire(invitation: Invitation) : returns (changed: Flag)`
- `closeEvent(event: Event, cancelled: Flag) : returns (event: Event)`

#### Queries

- `_mine(invitee: User) : one (invitations: String, strikes: Number)`
- `_overdue() : many (invitation: Invitation)`
- `_all() : many (invitation: Invitation, invitee: User, event: Event, request: Request, status: Status, deadline: Number, start: Number, end: Number, details: String, active: Flag, strike: Flag, reason: String)`
- `_count(event: Event) : one (count: Number)`
- `_strikes(invitee: User) : one (strikes: Number)`

#### Instances

- `Inviting` — instance of `Inviting` — [JAM application types](../design/types.md), line 17.
  - `Event` is `Event` — [JAM application types](../design/types.md), line 19.
  - `Request` is `SlotRequest` — [JAM application types](../design/types.md), line 20.
  - `User` is `Person` — [JAM application types](../design/types.md), line 18.

### Sessioning

Defined in [Sessioning](../design/concepts/Sessioning.md), line 1.

#### Actions

- `start(subject: User) : returns (session: Session, expiresAt: DateTime)`
- `current(session: Session) : returns (user: User)`
  - Refuses `UNKNOWN_SESSION`: session is absent or expired.
- `end(session: Session) : returns (ended: Flag)`
- `authorize(session: Session) : returns (user: User)`
  - Refuses `UNKNOWN_SESSION`: session is absent or expired.
  - Refuses `FORBIDDEN`: subject is not an operator.

#### Instances

- `Sessioning` — instance of `Sessioning` — [JAM application types](../design/types.md), line 15.
  - `User` is `Person` — [JAM application types](../design/types.md), line 16.

## Application types

Concrete types:

- `Event` — [JAM application types](../design/types.md), line 6.
- `Person` — [JAM application types](../design/types.md), line 4.
- `SlotRequest` — [JAM application types](../design/types.md), line 8.

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### my invitations

Authored path: `Invitations.MyInbox`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 17.

```former
Former "my invitations" — inputs (user); bindings (invitations, strikes); promises exactly one record — forms:
  a record of
    where Inviting._mine (invitee: user) has (invitations, strikes)
    invitations
    strikes
```

## Reactions

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

### Invitations.Accept

Authored path: `Invitations.Accept`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 12.
- Covered by [JAM invitations](../design/compositions/Application.md), line 18.

```reaction
when RequestBoundary.request (invitation, path: "/invitations/accept", requestId, session)
then
  Sessioning.current (session)
```

### Invitations.Accept#2

Authored path: `Invitations.Accept`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 12.
- Covered by [JAM invitations](../design/compositions/Application.md), line 18.

```reaction
when Sessioning.current (session, user), asked by Invitations.Accept
where
  earlier, RequestBoundary.request (invitation, path: "/invitations/accept", requestId, session)
then
  Inviting.accept (invitation, invitee: user)
```

### Invitations.Accept#3

Authored path: `Invitations.Accept`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 12.
- Covered by [JAM invitations](../design/compositions/Application.md), line 18.

```reaction
when Inviting.accept (invitation, invitee: user, event), asked by Invitations.Accept#2
where
  earlier, RequestBoundary.request (invitation, path: "/invitations/accept", requestId, session)
then
  RequestBoundary.respond (event, requestId)
```

### Invitations.Cancel

Authored path: `Invitations.Cancel`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 14.
- Covered by [JAM invitations](../design/compositions/Application.md), line 18.

```reaction
when RequestBoundary.request (invitation, path: "/invitations/cancel", requestId, session)
then
  Sessioning.current (session)
```

### Invitations.Cancel#2

Authored path: `Invitations.Cancel`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 14.
- Covered by [JAM invitations](../design/compositions/Application.md), line 18.

```reaction
when Sessioning.current (session, user), asked by Invitations.Cancel
where
  earlier, RequestBoundary.request (invitation, path: "/invitations/cancel", requestId, session)
then
  Inviting.cancel (invitation, invitee: user)
```

### Invitations.Cancel#3

Authored path: `Invitations.Cancel`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 14.
- Covered by [JAM invitations](../design/compositions/Application.md), line 18.

```reaction
when Inviting.cancel (invitation, invitee: user, event), asked by Invitations.Cancel#2
where
  earlier, RequestBoundary.request (invitation, path: "/invitations/cancel", requestId, session)
then
  RequestBoundary.respond (event, requestId)
```

### Invitations.Decline

Authored path: `Invitations.Decline`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 13.
- Covered by [JAM invitations](../design/compositions/Application.md), line 18.

```reaction
when RequestBoundary.request (invitation, path: "/invitations/decline", requestId, session)
then
  Sessioning.current (session)
```

### Invitations.Decline#2

Authored path: `Invitations.Decline`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 13.
- Covered by [JAM invitations](../design/compositions/Application.md), line 18.

```reaction
when Sessioning.current (session, user), asked by Invitations.Decline
where
  earlier, RequestBoundary.request (invitation, path: "/invitations/decline", requestId, session)
then
  Inviting.decline (invitation, invitee: user)
```

### Invitations.Decline#3

Authored path: `Invitations.Decline`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 13.
- Covered by [JAM invitations](../design/compositions/Application.md), line 18.

```reaction
when Inviting.decline (invitation, invitee: user, event), asked by Invitations.Decline#2
where
  earlier, RequestBoundary.request (invitation, path: "/invitations/decline", requestId, session)
then
  RequestBoundary.respond (event, requestId)
```

### Invitations.ExpireOverdue

Authored path: `Invitations.ExpireOverdue`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 20.

```reaction
when Clock.tick ()
where
  Inviting._overdue () has (invitation)
then
  Inviting.expire (invitation)
```

### Invitations.Inbox

Authored path: `Invitations.Inbox`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 11.
- Covered by [JAM invitations](../design/compositions/Application.md), line 17.

```reaction
when RequestBoundary.request (path: "/invitations/mine", requestId, session)
then
  Sessioning.current (session)
```

### Invitations.Inbox#2

Authored path: `Invitations.Inbox`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 11.
- Covered by [JAM invitations](../design/compositions/Application.md), line 17.

```reaction
when Sessioning.current (session, user), asked by Invitations.Inbox
where
  earlier, RequestBoundary.request (path: "/invitations/mine", requestId, session)
then
  RequestBoundary.respond (inbox: former "my invitations" with (user), requestId)
```

### Sessions.Current

Authored path: `Sessions.Current`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 4.
- Covered by [JAM invitations](../design/compositions/Application.md), line 9.

```reaction
when RequestBoundary.request (path: "/auth/current", requestId, session)
then
  Sessioning.current (session)
```

### Sessions.Current#2

Authored path: `Sessions.Current`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 4.
- Covered by [JAM invitations](../design/compositions/Application.md), line 9.

```reaction
when Sessioning.current (session, user), asked by Sessions.Current
where
  earlier, RequestBoundary.request (path: "/auth/current", requestId, session)
then
  RequestBoundary.respond (requestId, user)
```

### Sessions.Login

Authored path: `Sessions.Login`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 3.
- Covered by [JAM invitations](../design/compositions/Application.md), line 8.

```reaction
when RequestBoundary.request (email, password, path: "/auth/login", requestId)
then
  Authenticating.login (email, password)
```

### Sessions.Login#2

Authored path: `Sessions.Login`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 3.
- Covered by [JAM invitations](../design/compositions/Application.md), line 8.

```reaction
when Authenticating.login (email, password, user), asked by Sessions.Login
then
  Sessioning.start (subject: user)
```

### Sessions.Login#3

Authored path: `Sessions.Login`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 3.
- Covered by [JAM invitations](../design/compositions/Application.md), line 8.

```reaction
when Sessioning.start (subject: user, expiresAt, session), asked by Sessions.Login#2
where
  earlier, RequestBoundary.request (email, password, path: "/auth/login", requestId)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

### Sessions.Logout

Authored path: `Sessions.Logout`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 4.
- Covered by [JAM invitations](../design/compositions/Application.md), line 10.

```reaction
when RequestBoundary.request (path: "/auth/logout", requestId, session)
then
  Sessioning.end (session)
```

### Sessions.Logout#2

Authored path: `Sessions.Logout`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 4.
- Covered by [JAM invitations](../design/compositions/Application.md), line 10.

```reaction
when Sessioning.end (session, ended), asked by Sessions.Logout
where
  earlier, RequestBoundary.request (path: "/auth/logout", requestId, session)
then
  RequestBoundary.respond (ended, requestId)
```

### Sessions.Register

Authored path: `Sessions.Register`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 3.
- Covered by [JAM invitations](../design/compositions/Application.md), line 7.

```reaction
when RequestBoundary.request (email, password, path: "/auth/register", requestId)
then
  Authenticating.register (email, password)
```

### Sessions.Register#2

Authored path: `Sessions.Register`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 3.
- Covered by [JAM invitations](../design/compositions/Application.md), line 7.

```reaction
when Authenticating.register (email, password, user), asked by Sessions.Register
then
  Sessioning.start (subject: user)
```

### Sessions.Register#3

Authored path: `Sessions.Register`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 3.
- Covered by [JAM invitations](../design/compositions/Application.md), line 7.

```reaction
when Sessioning.start (subject: user, expiresAt, session), asked by Sessions.Register#2
where
  earlier, RequestBoundary.request (email, password, path: "/auth/register", requestId)
then
  RequestBoundary.respond (expiresAt, requestId, session, user)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/auth/current` — requires `session`
- `/auth/login` — requires `email`, `password`
- `/auth/logout` — requires `session`
- `/auth/register` — requires `email`, `password`
- `/invitations/accept` — requires `session`, `invitation`
- `/invitations/cancel` — requires `session`, `invitation`
- `/invitations/decline` — requires `session`, `invitation`
- `/invitations/mine` — requires `session`
