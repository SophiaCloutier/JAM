# Inviting
## Purpose
Get a firm response to a time-limited invitation.
## Principle
Invite once per person and event. A person accepts or declines before the deadline; silence expires. Only an accepted invitation before start can be cancelled by its owner. Closing a cancelled event cancels its accepted invitations.
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
  a reason String
Rule: At most one active invitation per user and one invitation per user and event. A pending invitation at or past its deadline is expired: reads report it as EXPIRED and inactive, and the next invite to that user or closeEvent for that event persists it.
```
## Actions
```actions
invite(invitee: User, event: Event, request: Request, start: Number, end: Number, deadline: Number, details: String) : returns (invitation: Invitation)
  where time window is invalid or user has another active invitation
  then
    refuses INVITATION_UNAVAILABLE "time window is invalid or user has another active invitation."
  where preconditions hold
  then
    reuse an existing delivery, or expire the invitee's overdue pending invitations and create a pending invitation with deadline capped at six hours
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
    atomically change accepted to cancelled and inactive
    returns event, request
closeEvent(event: Event, cancelled: Flag) : returns (event: Event)
  where preconditions hold
  then
    expire overdue pending invitations, then deactivate event invitations; if cancelled mark active invitations cancelled
    returns event
```
## Queries
```queries
_mine(invitee: User) : one (invitations: String)
  Return JSON invitation history for this user.
_all() : many (invitation: Invitation, invitee: User, event: Event, request: Request, status: Status, deadline: Number, start: Number, end: Number, details: String, active: Flag, reason: String)
  Return invitation records for internal reconciliation.
_count(event: Event) : one (count: Number)
  Count active accepted invitations.
_forUser(invitee: User) : many (invitation: Invitation, invitee: User, event: Event, request: Request, status: Status, deadline: Number, start: Number, end: Number, details: String, active: Flag, reason: String)
  Read invitations owned by this user.
```



