# Matching
## Purpose
Group compatible availability requests.
## Principle
One open request per user; form groups with common time, area and related interests, then release or reopen requests as decisions arrive.
## Types
```types
external User
external Event
```
## State
```state
a set of Requests with
  a user User
  a status String
  a group Group
a set of Groups with
  a status String
```
## Actions
```actions
submit(user: User, interests: String, start: Number, end: Number, areas: String, strikes: Number) : returns (request: Request)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns request
  where an action precondition fails
  then
    refuses INVALID_SLOT "Check the action preconditions."
  where an action precondition fails
  then
    refuses SLOT_UNAVAILABLE "Check the action preconditions."
withdraw(user: User, request: Request) : returns (request: Request)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns request
  where an action precondition fails
  then
    refuses INVALID_SLOT "Check the action preconditions."
  where an action precondition fails
  then
    refuses SLOT_UNAVAILABLE "Check the action preconditions."
fillOpenGroups() : returns (placed: Number)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns placed
formGroups(limits: String) : returns (formed: Number)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns formed
activate(group: Group, event: Event, capacity: Number) : returns (group: Group)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns group
abandon(group: Group) : returns (group: Group)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns group
close(group: Group) : returns (group: Group)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns group
reconcile(request: Request, status: String, active: Flag, reason: String) : returns (request: Request)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns request
expireOpen() : returns (checked: Flag)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns checked
```
## Queries
```queries
_mine(user: User) : one (requests: String)
  Read the owned state without changing it.
_drafts() : many (group: Group, area: String, tag: String, start: Number, end: Number, size: Number)
  Read the owned state without changing it.
_members(group: Group) : many (invitee: User, request: Request)
  Read the owned state without changing it.
_placements() : many (group: Group, event: Event)
  Read the owned state without changing it.
```
