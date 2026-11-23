# EventGenerating
## Purpose
Turn a date's groups into concrete events at venues, within opening hours, venue seats and each group's shared free time and reach.
## Principle
Plan each date once: choose venues, grid start times and splits so that every event has three to fifteen people, lies inside its group's shared window, is at a venue in one of the group's reachable areas, never pushes overlapping events at one venue past its seats, and keeps each venue within its daily event limit. People who cannot be seated are left out. Then confirm three acceptances, cancel events short of three at the cutoff, and complete confirmed events after their end.
## Types
```types
external Group
external User
external Request
```
## State
```state
a set of Plans with
  a date String
a set of Events with
  a plan Plan
  a group Group
  a venue String
  a tag String
  a start Number
  an end Number
  a capacity Number
  a status String
  an accepted Number
a set of Placements with
  an event Event
  an invitee User
  a request Request
a set of Reviews with
  a changes String
```
## Actions
```actions
plan(date: String, clusters: String) : returns (plan: Plan)
  where preconditions hold
  then
    reuse the date's existing plan, or plan events for the date's groups and store them with their placed members under a new plan
    returns plan
review(event: Event, count: Number) : returns (event: Event, group: Group, status: String, locked: Flag)
  where the event does not exist
  then
    refuses EVENT_UNAVAILABLE "Event not found."
  where preconditions hold
  then
    if the event is still open: after its end mark it done if confirmed, otherwise cancelled; before its start store the accepted count and mark it confirmed at three or more, cancelled if past the cutoff, otherwise forming; report whether the cutoff has passed
    returns event, group, status, locked
reviewDue() : returns (review: Review)
  where preconditions hold
  then
    using stored accepted counts, cancel open events past cutoff with fewer than three accepted and finish ended events, recording the changes under a new review
    returns review
cancel(event: Event) : returns (event: Event, group: Group)
  where the event has started or is done
  then
    refuses EVENT_UNAVAILABLE "Only upcoming events can be cancelled."
  where preconditions hold
  then
    mark the event cancelled
    returns event, group
```
## Queries
```queries
_limits() : one (limits: String)
  Read the largest venue seat count per area as JSON.
_all() : many (event: Event, group: Group)
  Read every event with its group.
_planned(plan: Plan) : many (event: Event, group: Group, start: Number, end: Number, capacity: Number, deadline: Number, details: String)
  Read the events of a plan with their response deadline and display details.
_members(event: Event) : many (invitee: User, request: Request)
  Read the people placed in an event.
_placed(plan: Plan) : one (placed: String)
  Read the request ids seated by a plan as a JSON array.
_get(event: Event) : many (details: String)
  Read the event's display details as JSON.
_deliveries() : many (event: Event, group: Group, start: Number, end: Number, capacity: Number, deadline: Number, details: String)
  Read upcoming open events whose invitations may still be delivered.
_admin() : one (events: String)
  Read every event with its size as JSON, for operators.
_reviewed(review: Review) : many (event: Event, group: Group, status: String)
  Read the events whose status a review changed.
```
