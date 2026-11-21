# EventGenerating
## Purpose
Create concrete plans within venue capacity.
## Principle
Generate once per group; confirm three acceptances, cancel insufficient groups at cutoff, and complete confirmed events after their end.
## Types
```types
external Group
```
## State
```state
a set of Events with
  a group Group
  a status String
```
## Actions
```actions
generate(group: Group, area: String, tag: String, start: Number, end: Number, size: Number) : returns (generated: Flag, group: Group, event: Event, start: Number, end: Number, capacity: Number, deadline: Number, details: String)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns generated, group, event, start, end, capacity, deadline, details
review(event: Event, count: Number) : returns (event: Event, group: Group, status: String, locked: Flag)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns event, group, status, locked
  where an action precondition fails
  then
    refuses EVENT_UNAVAILABLE "Check the action preconditions."
cancel(event: Event) : returns (event: Event, group: Group)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns event, group
  where an action precondition fails
  then
    refuses EVENT_UNAVAILABLE "Check the action preconditions."
```
## Queries
```queries
_limits() : one (limits: String)
  Read the owned state without changing it.
_all() : many (event: Event, group: Group)
  Read the owned state without changing it.
_get(event: Event) : many (details: String)
  Read the owned state without changing it.
_deliveries() : many (generated: Flag, group: Group, event: Event, start: Number, end: Number, capacity: Number, deadline: Number, details: String)
  Read the owned state without changing it.
_admin() : one (events: String)
  Read the owned state without changing it.
```
