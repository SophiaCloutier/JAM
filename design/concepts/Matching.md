# Matching
## Purpose
Group requests for the same date into clusters of compatible people, by interest similarity and availability.
## Principle
A user submits one request for a date at least two calendar days ahead. When the date becomes due, its requests are matched together exactly once: callers offer candidate interests per request, and Matching forms clusters of at least three or places requests into existing clusters, using only similarity (1.0 same tag, 0.7 same category, never below 0.7), a shared window of at least the event length, a shared reachable meeting area, and venue capacity. Requests left over are unmatched and their owners choose a new date; nothing is requeued.
## Types
```types
external User
external Event
```
## State
```state
a set of Requests with
  a user User
  a date String
  a start Number
  an end Number
  a reachable String
  a status String
  a cluster Cluster
a set of Clusters with
  a date String
  a tag String
  a status String
  an event Event
a set of Runs with
  a dates String
```
## Actions
```actions
submit(user: User, date: String, start: Number, end: Number, selected: String, interests: String, location: String, radius: Number) : returns (request: Request)
  where the date is fewer than two calendar days ahead, the window is not on that date or is shorter than the event, the selected interest is not in interests, or no meeting area is within the radius
  then
    refuses INVALID_SLOT "Check the date, time window, interest and distance."
  where the date has already been matched or the user has an open request
  then
    refuses SLOT_UNAVAILABLE "Choose a later date or wait for your open request."
  where preconditions hold
  then
    store a pending request with its reachable meeting areas
    returns request
withdraw(user: User, request: Request) : returns (request: Request)
  where the request is not the user's pending request
  then
    refuses SLOT_UNAVAILABLE "Only a waiting request can be withdrawn."
  where preconditions hold
  then
    mark the request withdrawn
    returns request
openDue(force: Flag) : returns (run: Run)
  where preconditions hold
  then
    record every due date with pending requests exactly once under a new run; dates already reached become unmatched
    returns run
form(date: String, stage: String, candidates: String, minScore: Number, limits: String) : returns (date: String, stage: String)
  where preconditions hold
  then
    greedily form clusters of at least three pending candidates per tag, exact holders first, within window, reach and capacity
    returns date, stage
assign(date: String, stage: String, candidates: String, limits: String) : returns (date: String, stage: String)
  where preconditions hold
  then
    place each pending candidate in the forming cluster with the highest similarity at least 0.7, then fewest members
    returns date, stage
finish(date: String) : returns (date: String)
  where preconditions hold
  then
    complete the date's forming clusters and mark remaining pending requests unmatched
    returns date
activate(cluster: Cluster, event: Event) : returns (cluster: Cluster)
  where preconditions hold
  then
    mark a complete cluster generated for the event
    returns cluster
abandon(cluster: Cluster) : returns (cluster: Cluster)
  where preconditions hold
  then
    mark a complete cluster failed and its members unmatched
    returns cluster
close(cluster: Cluster) : returns (cluster: Cluster)
  where preconditions hold
  then
    mark the cluster closed
    returns cluster
reconcile(request: Request, status: String, active: Flag, reason: String) : returns (request: Request)
  where preconditions hold
  then
    an inactive matched request becomes unmatched if its event was cancelled, otherwise closed
    returns request
```
## Queries
```queries
_mine(user: User) : one (requests: String)
  Read this user's requests as JSON, newest first.
_opened(run: Run) : many (date: String)
  Read the dates a run opened for matching.
_chosen(date: String) : one (candidates: String)
  Read pending requests for the date that chose an interest, offering only that interest.
_profile(date: String) : one (candidates: String)
  Read every pending request for the date, offering all of its profile interests.
_completed() : many (cluster: Cluster, area: String, tag: String, start: Number, end: Number, size: Number)
  Read complete clusters awaiting an event.
_members(cluster: Cluster) : many (invitee: User, request: Request)
  Read the matched members of a cluster.
```
