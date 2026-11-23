# JAM application

## Accounts and sessions

Accounts enter through [registration](reaction:Sessions.Register) or [login](reaction:Sessions.Login).
The session cookie resolves the [current user](reaction:Sessions.Current) and is cleared by [logout](reaction:Sessions.Logout).
Every endpoint below that acts for a user resolves that user from the cookie in the back end; admin endpoints use `Sessioning.authorize`.

```endpoints
Sessions.Register at /auth/register
Sessions.Login at /auth/login
Sessions.Current at /auth/current
Sessions.Logout at /auth/logout
```

## Profiles

Registering [creates an empty profile](reaction:Profiles.CreateProfile). The [profile endpoint](reaction:Profiles.Profile)
returns the user's own interests through the [profile read model](former:Profiles.MyProfile), and users
[add](reaction:Profiles.AddInterest) or [remove](reaction:Profiles.RemoveInterest) interests.

```endpoints
Profiles.Profile at /profile/mine
Profiles.AddInterest at /profile/addInterest
Profiles.RemoveInterest at /profile/removeInterest
```

## Requests

A user [submits a request](reaction:Meetups.Submit) for a date at least two calendar days ahead, with a free-time window,
an optional chosen interest ("Surprise me" sends an empty choice), a starting location and a travel distance. Submit reads the
user's profile interests at that moment and passes them to Matching as opaque data. A waiting request can be
[withdrawn](reaction:Meetups.Withdraw). [My requests](reaction:Meetups.Mine) uses the [request read model](former:Meetups.MyRequests),
which includes unmatched requests and their reason so the user can choose another date.

```endpoints
Meetups.Mine at /requests/mine
Meetups.Submit at /requests/submit
Meetups.Withdraw at /requests/withdraw
```

## Scheduled matching

There is no clock concept. The host calls `Matching.openDue` every few minutes; Matching decides which dates are due
(date D from the start of D-1) and opens each date exactly once. The admin [run endpoint](reaction:Meetups.Run) calls it with
`force` for demos. Matching only scores interest similarity and availability; the reactions below choose which interests each
request offers, which is how the two request options are realised:

1. [Form clusters from chosen interests](reaction:Meetups.FormChosen): requests that chose an interest offer only that interest, and
   clusters of at least three form on exact matches (minimum score 1.0).
2. [Join on chosen interests](reaction:Meetups.JoinChosen): still-waiting requests that chose an interest join the best existing cluster
   for it: exact before related (0.7), then the smallest cluster.
3. [Join on profile interests](reaction:Meetups.JoinProfile): every still-waiting request now offers all of its profile interests. This is
   the fallback for option 1 and the first step for "Surprise me".
4. [Form clusters from profile interests](reaction:Meetups.FormProfile): leftovers form new clusters on exact or related profile interests.
5. [Join leftovers](reaction:Meetups.JoinLeftovers): anyone still waiting may join the clusters formed in step 4.
6. [Finish the date](reaction:Meetups.Finish): clusters become complete and remaining requests become unmatched (`NO_MATCH`).

## Events and invitations

When a date finishes, its complete clusters are [passed to EventGenerating](reaction:Meetups.GenerateForMatch) as opaque JSON:
each cluster's tag, full shared window, shared reachable areas and members. `EventGenerating.plan` plans the whole date once,
without any notion of similarity. It chooses a venue in one of the cluster's areas, a start time on the grid inside the cluster's window
and the venue's opening hours, and splits of three to fifteen people, with overlapping events at one venue sharing its seats and a
daily event limit per venue. Leftovers may take spare seats in another event with the same tag that fits their own cluster.
[Recovery](reaction:Meetups.RecoverDrafts) plans dates whose clusters were left complete by an interrupted run; planning is idempotent per date.
Each planned event [invites its members](reaction:Meetups.InviteParticipants), and [delivery recovery](reaction:Meetups.RecoverDeliveries)
re-sends idempotently. The seated request ids are then [reported to Matching](reaction:Meetups.SettlePlan): a cluster with any seated
member is generated, otherwise failed, and members who got no seat become unmatched (`NO_VENUE`).

The [inbox](reaction:Invitations.Inbox) uses the [private inbox read model](former:Invitations.MyInbox) to expose only invitations owned by the session subject.
[Accept](reaction:Invitations.Accept), [decline](reaction:Invitations.Decline), and [cancel](reaction:Invitations.Cancel)
resolve the actor from the cookie. Inviting checks ownership and transitions atomically. Expiry belongs to Inviting:
an unanswered invitation past its deadline reads as expired and stops holding the user's active-invitation lock.

```endpoints
Invitations.Inbox at /invitations/mine
Invitations.Accept at /invitations/accept
Invitations.Decline at /invitations/decline
Invitations.Cancel at /invitations/cancel
```

Accepting [updates the event's accepted count](reaction:Meetups.Confirm), and an owner cancellation
[does the same](reaction:Meetups.ReconsiderCancellation). A decline [closes the request](reaction:Meetups.SayNo), as does an owner
[cancellation](reaction:Meetups.LateCancel). Reviews that lock an event [close its cluster](reaction:Meetups.CloseAtCutoff), and a review that
cancels or finishes an event [cancels](reaction:Meetups.CancelInvitations) or [finishes](reaction:Meetups.FinishInvitations) its invitations.

The host also calls `EventGenerating.reviewDue`, which applies EventGenerating's own time rules: fewer than three accepted at the
cutoff cancels the event, and an ended event is done if confirmed. Events it cancelled [cancel their invitations](reaction:Meetups.CancelDue),
events it finished [finish theirs](reaction:Meetups.FinishDue), and either way [the cluster closes](reaction:Meetups.CloseReviewed).
When an event's invitations close, each outcome is [reconciled into Matching](reaction:Meetups.ReconcileClosedEvent): a cancelled event makes its
requests unmatched (`EVENT_CANCELLED`) so users choose another date; other outcomes close the request. Nothing is requeued.

[My events](reaction:Meetups.Events) joins the user's invitations with live event details through the [events read model](former:Meetups.MyEvents).
Admins see [all events](reaction:Meetups.Admin) through the [admin read model](former:Meetups.AdminEvents) and can
[cancel an event](reaction:Meetups.CancelEvent), which [closes its cluster and invitations](reaction:Meetups.AdminCancelled).

```endpoints
Meetups.Events at /events/mine
Meetups.Admin at /admin/events
Meetups.Run at /admin/run
Meetups.CancelEvent at /admin/cancel
```
