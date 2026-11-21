# Inviting
## Purpose
Get a firm response to a time-limited invitation.
## Principle
Invite once per person and event. A person accepts or declines before the deadline; silence expires. Only an accepted invitation before start can be cancelled by its owner, recording exactly one strike. Event cancellation never adds a strike.
## Types
```types
external User
external Event
external Request
Status is PENDING or ACCEPTED or DECLINED or EXPIRED or CANCELLED
```
## State
```state
a set of Invitations with
  an invitee User
  an event Event
  a request Request
  a status Status
  a deadline Number
  a start Number
  an end Number
  a details String
  an active Flag
  a strike Flag
  a reason String
Rule: At most one active invitation per user and one invitation per user and event. Strikes are the count of invitations cancelled by their owner.
```
## Actions
```actions
invite(invitee: User, event: Event, request: Request, start: Number, end: Number, deadline: Number, details: String) : returns (invitation: Invitation)
  where time window is invalid or user has another active invitation
  then
    refuses INVITATION_UNAVAILABLE "time window is invalid or user has another active invitation."
  where preconditions hold
  then
    reuse an existing delivery or create pending invitation with deadline capped at six hours
    returns invitation
accept(invitation: Invitation, invitee: User) : returns (event: Event, request: Request)
  where invitee does not own invitation
  then
    refuses INVITATION_FORBIDDEN "invitee does not own invitation."
  where invitation is not pending and active before deadline
  then
    refuses INVITATION_UNAVAILABLE "invitation is not pending and active before deadline."
  where preconditions hold
  then
    atomically change pending to accepted before deadline
    returns event, request
decline(invitation: Invitation, invitee: User) : returns (event: Event, request: Request)
  where invitee does not own invitation
  then
    refuses INVITATION_FORBIDDEN "invitee does not own invitation."
  where invitation is not pending and active before deadline
  then
    refuses INVITATION_UNAVAILABLE "invitation is not pending and active before deadline."
  where preconditions hold
  then
    atomically change pending to declined and inactive before deadline
    returns event, request
cancel(invitation: Invitation, invitee: User) : returns (event: Event, request: Request)
  where invitee does not own invitation
  then
    refuses INVITATION_FORBIDDEN "invitee does not own invitation."
  where invitation is not accepted and active before start
  then
    refuses INVITATION_UNAVAILABLE "invitation is not accepted and active before start."
  where preconditions hold
  then
    atomically change accepted to cancelled and inactive and record strike
    returns event, request
expire(invitation: Invitation) : returns (changed: Flag)
  where preconditions hold
  then
    expire only pending invitations whose deadline passed, returning whether changed
    returns changed
closeEvent(event: Event, cancelled: Flag) : returns (event: Event)
  where preconditions hold
  then
    deactivate event invitations; if cancelled mark active invitations cancelled without strikes
    returns event
```
## Queries
```queries
_mine(invitee: User) : one (invitations: String, strikes: Number)
  Return JSON invitation history and strike count for this user.
_overdue() : many (invitation: Invitation)
  Return pending invitations at or past deadline.
_all() : many (invitation: Invitation, invitee: User, event: Event, request: Request, status: Status, deadline: Number, start: Number, end: Number, details: String, active: Flag, strike: Flag, reason: String)
  Return invitation records for internal reconciliation.
_count(event: Event) : one (count: Number)
  Count active accepted invitations.
_strikes(invitee: User) : one (strikes: Number)
  Count owner-cancelled invitations.
```



