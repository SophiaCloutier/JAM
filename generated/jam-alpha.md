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

### Characterizing

Defined in [Characterizing](../design/concepts/Characterizing.md), line 1.

#### Actions

- `create(user: User) : returns (user: User)`
- `addInterest(user: User, tag: String) : returns (tag: String)`
  - Refuses `INVALID_INTEREST`: Check the action preconditions.
- `removeInterest(user: User, tag: String) : returns (tag: String)`

#### Queries

- `_get(user: User) : one (interests: String)`

#### Instances

- `Characterizing` — instance of `Characterizing` — [JAM application types](../design/types.md), line 21.
  - `User` is `Person` — [JAM application types](../design/types.md), line 22.

### Clock

Defined in [Clock](../design/concepts/Clock.md), line 1.

#### Actions

- `tick() : returns (tick: Tick)`
- `review() : returns (tick: Tick)`
- `reconcile() : returns (tick: Tick)`
- `recover() : returns (tick: Tick)`
- `hourly() : returns (tick: Tick)`

#### Instances

- `Clock` — instance of `Clock` — [JAM application types](../design/types.md), line 28.

### EventGenerating

Defined in [EventGenerating](../design/concepts/EventGenerating.md), line 1.

#### Actions

- `generate(group: Group, area: String, tag: String, start: Number, end: Number, size: Number) : returns (generated: Flag, group: Group, event: Event, start: Number, end: Number, capacity: Number, deadline: Number, details: String)`
- `review(event: Event, count: Number) : returns (event: Event, group: Group, status: String, locked: Flag)`
  - Refuses `EVENT_UNAVAILABLE`: Check the action preconditions.
- `cancel(event: Event) : returns (event: Event, group: Group)`
  - Refuses `EVENT_UNAVAILABLE`: Check the action preconditions.

#### Queries

- `_limits() : one (limits: String)`
- `_all() : many (event: Event, group: Group)`
- `_get(event: Event) : many (details: String)`
- `_deliveries() : many (generated: Flag, group: Group, event: Event, start: Number, end: Number, capacity: Number, deadline: Number, details: String)`
- `_admin() : one (events: String)`

#### Instances

- `EventGenerating` — instance of `EventGenerating` — [JAM application types](../design/types.md), line 26.
  - `Group` is `Matching.Group` — [JAM application types](../design/types.md), line 27.

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
- `_forUser(invitee: User) : many (invitation: Invitation, invitee: User, event: Event, request: Request, status: Status, deadline: Number, start: Number, end: Number, details: String, active: Flag, strike: Flag, reason: String)`

#### Instances

- `Inviting` — instance of `Inviting` — [JAM application types](../design/types.md), line 17.
  - `Event` is `Event` — [JAM application types](../design/types.md), line 19.
  - `Request` is `SlotRequest` — [JAM application types](../design/types.md), line 20.
  - `User` is `Person` — [JAM application types](../design/types.md), line 18.

### Matching

Defined in [Matching](../design/concepts/Matching.md), line 1.

#### Actions

- `submit(user: User, interests: String, start: Number, end: Number, areas: String, strikes: Number) : returns (request: Request)`
  - Refuses `INVALID_SLOT`: Check the action preconditions.
  - Refuses `SLOT_UNAVAILABLE`: Check the action preconditions.
- `withdraw(user: User, request: Request) : returns (request: Request)`
  - Refuses `INVALID_SLOT`: Check the action preconditions.
  - Refuses `SLOT_UNAVAILABLE`: Check the action preconditions.
- `fillOpenGroups() : returns (placed: Number)`
- `formGroups(limits: String) : returns (formed: Number)`
- `activate(group: Group, event: Event, capacity: Number) : returns (group: Group)`
- `abandon(group: Group) : returns (group: Group)`
- `close(group: Group) : returns (group: Group)`
- `reconcile(request: Request, status: String, active: Flag, reason: String) : returns (request: Request)`
- `expireOpen() : returns (checked: Flag)`

#### Queries

- `_mine(user: User) : one (requests: String)`
- `_drafts() : many (group: Group, area: String, tag: String, start: Number, end: Number, size: Number)`
- `_members(group: Group) : many (invitee: User, request: Request)`
- `_placements() : many (group: Group, event: Event)`

#### Instances

- `Matching` — instance of `Matching` — [JAM application types](../design/types.md), line 23.
  - `Event` is `Event` — [JAM application types](../design/types.md), line 25.
  - `User` is `Person` — [JAM application types](../design/types.md), line 24.

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

### admin event list

Authored path: `Meetups.AdminEvents`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 101.

```former
Former "admin event list" — inputs (); bindings (events); promises exactly one record — forms:
  a record of
    where EventGenerating._admin () has (events)
    events
```

### my event details

Authored path: `Meetups.MyEvents`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 97.

```former
Former "my event details" — inputs (user); bindings (event, details); promises exactly one record — forms:
  a record of
    events: each Inviting._forUser (invitee: user) has (event)
      where EventGenerating._get (event) has (details)
      form a record of
        details
        event
```

### my interests

Authored path: `Profiles.MyProfile`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 27.

```former
Former "my interests" — inputs (user); bindings (interests); promises exactly one record — forms:
  a record of
    where Characterizing._get (user) has (interests)
    interests
```

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

### my slots

Authored path: `Meetups.MyRequests`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 47.

```former
Former "my slots" — inputs (user); bindings (requests); promises exactly one record — forms:
  a record of
    where Matching._mine (user) has (requests)
    requests
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

### Meetups.ActivateGroup

Authored path: `Meetups.ActivateGroup`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 63.

```reaction
when EventGenerating.generate (group, capacity, event, generated: true)
then
  Matching.activate (capacity, event, group)
```

### Meetups.Admin

Authored path: `Meetups.Admin`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 103.
- Covered by [JAM invitations](../design/compositions/Application.md), line 126.

```reaction
when RequestBoundary.request (path: "/admin/events", requestId, session)
then
  Sessioning.authorize (session)
```

### Meetups.Admin#2

Authored path: `Meetups.Admin`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 103.
- Covered by [JAM invitations](../design/compositions/Application.md), line 126.

```reaction
when Sessioning.authorize (session, user), asked by Meetups.Admin
where
  earlier, RequestBoundary.request (path: "/admin/events", requestId, session)
then
  RequestBoundary.respond (admin: former "admin event list", requestId)
```

### Meetups.AdminCancelled

Authored path: `Meetups.AdminCancelled`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 89.

```reaction
when EventGenerating.cancel (event, group)
then
  Matching.close (group)
```

### Meetups.AdminCancelled#2

Authored path: `Meetups.AdminCancelled`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 89.

```reaction
when Matching.close (group), asked by Meetups.AdminCancelled
where
  earlier, EventGenerating.cancel (event, group)
then
  Inviting.closeEvent (cancelled: true, event)
```

### Meetups.CancelEvent

Authored path: `Meetups.CancelEvent`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 107.
- Covered by [JAM invitations](../design/compositions/Application.md), line 134.

```reaction
when RequestBoundary.request (event, path: "/admin/cancel", requestId, session)
then
  Sessioning.authorize (session)
```

### Meetups.CancelEvent#2

Authored path: `Meetups.CancelEvent`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 107.
- Covered by [JAM invitations](../design/compositions/Application.md), line 134.

```reaction
when Sessioning.authorize (session, user), asked by Meetups.CancelEvent
where
  earlier, RequestBoundary.request (event, path: "/admin/cancel", requestId, session)
then
  EventGenerating.cancel (event)
```

### Meetups.CancelEvent#3

Authored path: `Meetups.CancelEvent`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 107.
- Covered by [JAM invitations](../design/compositions/Application.md), line 134.

```reaction
when EventGenerating.cancel (event), asked by Meetups.CancelEvent#2
where
  earlier, RequestBoundary.request (event, path: "/admin/cancel", requestId, session)
then
  RequestBoundary.respond (event, requestId)
```

### Meetups.CancelInvitations

Authored path: `Meetups.CancelInvitations`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 85.

```reaction
when EventGenerating.review (event, status: "CANCELLED")
then
  Inviting.closeEvent (cancelled: true, event)
```

### Meetups.CloseAtCutoff

Authored path: `Meetups.CloseAtCutoff`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 83.

```reaction
when EventGenerating.review (group, locked: true)
then
  Matching.close (group)
```

### Meetups.Confirm

Authored path: `Meetups.Confirm`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 75.

```reaction
when Inviting.accept (event)
where
  Inviting._count (event) has (count)
then
  EventGenerating.review (count, event)
```

### Meetups.DeliverBackfill

Authored path: `Meetups.DeliverBackfill`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 69.

```reaction
when Matching.fillOpenGroups ()
where
  EventGenerating._deliveries () has (deadline, details, end, event, group, start)
  Matching._members (group) has (invitee, request)
then
  Inviting.invite (deadline, details, end, event, invitee, request, start)
```

### Meetups.Events

Authored path: `Meetups.Events`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 99.
- Covered by [JAM invitations](../design/compositions/Application.md), line 122.

```reaction
when RequestBoundary.request (path: "/events/mine", requestId, session)
then
  Sessioning.current (session)
```

### Meetups.Events#2

Authored path: `Meetups.Events`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 99.
- Covered by [JAM invitations](../design/compositions/Application.md), line 122.

```reaction
when Sessioning.current (session, user), asked by Meetups.Events
where
  earlier, RequestBoundary.request (path: "/events/mine", requestId, session)
then
  RequestBoundary.respond (calendar: former "my event details" with (user), requestId)
```

### Meetups.ExpireWaiting

Authored path: `Meetups.ExpireWaiting`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 95.

```reaction
when Clock.reconcile ()
then
  Matching.expireOpen ()
```

### Meetups.FinishInvitations

Authored path: `Meetups.FinishInvitations`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 87.

```reaction
when EventGenerating.review (event, status: "DONE")
then
  Inviting.closeEvent (cancelled: false, event)
```

### Meetups.FormGroups

Authored path: `Meetups.FormGroups`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 57.

```reaction
when Matching.fillOpenGroups ()
where
  EventGenerating._limits () has (limits)
then
  Matching.formGroups (limits)
```

### Meetups.GenerateForMatch

Authored path: `Meetups.GenerateForMatch`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 59.

```reaction
when Matching.formGroups ()
where
  Matching._drafts () has (area, end, group, size, start, tag)
then
  EventGenerating.generate (area, end, group, size, start, tag)
```

### Meetups.InviteParticipants

Authored path: `Meetups.InviteParticipants`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 67.

```reaction
when EventGenerating.generate (group, deadline, details, end, event, generated: true, start)
where
  Matching._members (group) has (invitee, request)
then
  Inviting.invite (deadline, details, end, event, invitee, request, start)
```

### Meetups.LateCancel

Authored path: `Meetups.LateCancel`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 81.

```reaction
when Inviting.cancel (request)
then
  Matching.reconcile (active: false, reason: "YOU_CANCELLED", request, status: "CANCELLED")
```

### Meetups.Mine

Authored path: `Meetups.Mine`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 49.
- Covered by [JAM invitations](../design/compositions/Application.md), line 110.

```reaction
when RequestBoundary.request (path: "/requests/mine", requestId, session)
then
  Sessioning.current (session)
```

### Meetups.Mine#2

Authored path: `Meetups.Mine`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 49.
- Covered by [JAM invitations](../design/compositions/Application.md), line 110.

```reaction
when Sessioning.current (session, user), asked by Meetups.Mine
where
  earlier, RequestBoundary.request (path: "/requests/mine", requestId, session)
then
  RequestBoundary.respond (pool: former "my slots" with (user), requestId)
```

### Meetups.ReconcileClosedEvent

Authored path: `Meetups.ReconcileClosedEvent`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 93.

```reaction
when Inviting.closeEvent (event)
where
  Inviting._all () has (active, event, reason, request, status)
then
  Matching.reconcile (active, reason, request, status)
```

### Meetups.ReconcileDecisions

Authored path: `Meetups.ReconcileDecisions`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 91.

```reaction
when Clock.reconcile ()
where
  Inviting._all () has (active, reason, request, status)
then
  Matching.reconcile (active, reason, request, status)
```

### Meetups.ReconsiderCancellation

Authored path: `Meetups.ReconsiderCancellation`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 77.

```reaction
when Inviting.cancel (event)
where
  Inviting._count (event) has (count)
then
  EventGenerating.review (count, event)
```

### Meetups.RecoverDeliveries

Authored path: `Meetups.RecoverDeliveries`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 71.

```reaction
when Clock.recover ()
where
  EventGenerating._deliveries () has (deadline, details, end, event, group, start)
  Matching._members (group) has (invitee, request)
then
  Inviting.invite (deadline, details, end, event, invitee, request, start)
```

### Meetups.RecoverDrafts

Authored path: `Meetups.RecoverDrafts`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 61.

```reaction
when Clock.recover ()
where
  Matching._drafts () has (area, end, group, size, start, tag)
then
  EventGenerating.generate (area, end, group, size, start, tag)
```

### Meetups.ReleaseFailedGroup

Authored path: `Meetups.ReleaseFailedGroup`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 65.

```reaction
when EventGenerating.generate (group, generated: false)
then
  Matching.abandon (group)
```

### Meetups.ReviewEvents

Authored path: `Meetups.ReviewEvents`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 73.

```reaction
when Clock.review ()
where
  EventGenerating._all () has (event)
  Inviting._count (event) has (count)
then
  EventGenerating.review (count, event)
```

### Meetups.Run

Authored path: `Meetups.Run`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 105.
- Covered by [JAM invitations](../design/compositions/Application.md), line 130.

```reaction
when RequestBoundary.request (path: "/admin/run", requestId, session)
then
  Sessioning.authorize (session)
```

### Meetups.Run#2

Authored path: `Meetups.Run`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 105.
- Covered by [JAM invitations](../design/compositions/Application.md), line 130.

```reaction
when Sessioning.authorize (session, user), asked by Meetups.Run
then
  Clock.hourly ()
```

### Meetups.Run#3

Authored path: `Meetups.Run`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 105.
- Covered by [JAM invitations](../design/compositions/Application.md), line 130.

```reaction
when Clock.hourly (tick), asked by Meetups.Run#2
where
  earlier, RequestBoundary.request (path: "/admin/run", requestId, session)
then
  RequestBoundary.respond (requestId, tick)
```

### Meetups.SayNo

Authored path: `Meetups.SayNo`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 79.

```reaction
when Inviting.decline (request)
then
  Matching.reconcile (active: false, reason: "", request, status: "DECLINED")
```

### Meetups.StartMatching

Authored path: `Meetups.StartMatching`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 55.

```reaction
when Clock.hourly ()
then
  Matching.fillOpenGroups ()
```

### Meetups.Submit

Authored path: `Meetups.Submit`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 51.
- Covered by [JAM invitations](../design/compositions/Application.md), line 114.

```reaction
when RequestBoundary.request (areas, end, path: "/requests/submit", requestId, session, start)
then
  Sessioning.current (session)
```

### Meetups.Submit#2

Authored path: `Meetups.Submit`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 51.
- Covered by [JAM invitations](../design/compositions/Application.md), line 114.

```reaction
when Sessioning.current (session, user), asked by Meetups.Submit
where
  Characterizing._get (user) has (interests)
  Inviting._strikes (invitee: user) has (strikes)
  earlier, RequestBoundary.request (areas, end, path: "/requests/submit", requestId, session, start)
then
  Matching.submit (areas, end, interests, start, strikes, user)
```

### Meetups.Submit#3

Authored path: `Meetups.Submit`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 51.
- Covered by [JAM invitations](../design/compositions/Application.md), line 114.

```reaction
when Matching.submit (areas, end, interests, start, strikes, user, request), asked by Meetups.Submit#2
where
  earlier, RequestBoundary.request (areas, end, path: "/requests/submit", requestId, session, start)
then
  RequestBoundary.respond (request, requestId)
```

### Meetups.Withdraw

Authored path: `Meetups.Withdraw`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 53.
- Covered by [JAM invitations](../design/compositions/Application.md), line 118.

```reaction
when RequestBoundary.request (path: "/requests/withdraw", request, requestId, session)
then
  Sessioning.current (session)
```

### Meetups.Withdraw#2

Authored path: `Meetups.Withdraw`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 53.
- Covered by [JAM invitations](../design/compositions/Application.md), line 118.

```reaction
when Sessioning.current (session, user), asked by Meetups.Withdraw
where
  earlier, RequestBoundary.request (path: "/requests/withdraw", request, requestId, session)
then
  Matching.withdraw (request, user)
```

### Meetups.Withdraw#3

Authored path: `Meetups.Withdraw`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 53.
- Covered by [JAM invitations](../design/compositions/Application.md), line 118.

```reaction
when Matching.withdraw (request, user), asked by Meetups.Withdraw#2
where
  earlier, RequestBoundary.request (path: "/requests/withdraw", request, requestId, session)
then
  RequestBoundary.respond (request, requestId)
```

### Profiles.AddInterest

Authored path: `Profiles.AddInterest`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 31.
- Covered by [JAM invitations](../design/compositions/Application.md), line 40.

```reaction
when RequestBoundary.request (path: "/profile/addInterest", requestId, session, tag)
then
  Sessioning.current (session)
```

### Profiles.AddInterest#2

Authored path: `Profiles.AddInterest`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 31.
- Covered by [JAM invitations](../design/compositions/Application.md), line 40.

```reaction
when Sessioning.current (session, user), asked by Profiles.AddInterest
where
  earlier, RequestBoundary.request (path: "/profile/addInterest", requestId, session, tag)
then
  Characterizing.addInterest (tag, user)
```

### Profiles.AddInterest#3

Authored path: `Profiles.AddInterest`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 31.
- Covered by [JAM invitations](../design/compositions/Application.md), line 40.

```reaction
when Characterizing.addInterest (tag, user, result.tag: normalized), asked by Profiles.AddInterest#2
where
  earlier, RequestBoundary.request (path: "/profile/addInterest", requestId, session, tag)
then
  RequestBoundary.respond (requestId, tag: normalized)
```

### Profiles.CreateProfile

Authored path: `Profiles.CreateProfile`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 25.

```reaction
when Authenticating.register (user)
then
  Characterizing.create (user)
```

### Profiles.Profile

Authored path: `Profiles.Profile`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 29.
- Covered by [JAM invitations](../design/compositions/Application.md), line 36.

```reaction
when RequestBoundary.request (path: "/profile/mine", requestId, session)
then
  Sessioning.current (session)
```

### Profiles.Profile#2

Authored path: `Profiles.Profile`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 29.
- Covered by [JAM invitations](../design/compositions/Application.md), line 36.

```reaction
when Sessioning.current (session, user), asked by Profiles.Profile
where
  earlier, RequestBoundary.request (path: "/profile/mine", requestId, session)
then
  RequestBoundary.respond (profile: former "my interests" with (user), requestId)
```

### Profiles.RemoveInterest

Authored path: `Profiles.RemoveInterest`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 33.
- Covered by [JAM invitations](../design/compositions/Application.md), line 44.

```reaction
when RequestBoundary.request (path: "/profile/removeInterest", requestId, session, tag)
then
  Sessioning.current (session)
```

### Profiles.RemoveInterest#2

Authored path: `Profiles.RemoveInterest`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 33.
- Covered by [JAM invitations](../design/compositions/Application.md), line 44.

```reaction
when Sessioning.current (session, user), asked by Profiles.RemoveInterest
where
  earlier, RequestBoundary.request (path: "/profile/removeInterest", requestId, session, tag)
then
  Characterizing.removeInterest (tag, user)
```

### Profiles.RemoveInterest#3

Authored path: `Profiles.RemoveInterest`.
- Covered by [JAM invitations](../design/compositions/Application.md), line 33.
- Covered by [JAM invitations](../design/compositions/Application.md), line 44.

```reaction
when Characterizing.removeInterest (tag, user), asked by Profiles.RemoveInterest#2
where
  earlier, RequestBoundary.request (path: "/profile/removeInterest", requestId, session, tag)
then
  RequestBoundary.respond (requestId, tag)
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

- `/admin/cancel` — requires `session`, `event`
- `/admin/events` — requires `session`
- `/admin/run` — requires `session`
- `/auth/current` — requires `session`
- `/auth/login` — requires `email`, `password`
- `/auth/logout` — requires `session`
- `/auth/register` — requires `email`, `password`
- `/events/mine` — requires `session`
- `/invitations/accept` — requires `session`, `invitation`
- `/invitations/cancel` — requires `session`, `invitation`
- `/invitations/decline` — requires `session`, `invitation`
- `/invitations/mine` — requires `session`
- `/profile/addInterest` — requires `session`, `tag`
- `/profile/mine` — requires `session`
- `/profile/removeInterest` — requires `session`, `tag`
- `/requests/mine` — requires `session`
- `/requests/submit` — requires `session`, `start`, `end`, `areas`
- `/requests/withdraw` — requires `session`, `request`
