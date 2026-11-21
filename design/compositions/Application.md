# JAM invitations

Accounts enter through [registration](reaction:Sessions.Register) or [login](reaction:Sessions.Login).
The session cookie resolves the [current user](reaction:Sessions.Current) and is cleared by [logout](reaction:Sessions.Logout).

```endpoints
Sessions.Register at /auth/register
Sessions.Login at /auth/login
Sessions.Current at /auth/current
Sessions.Logout at /auth/logout
Invitations.Inbox at /invitations/mine
Invitations.Accept at /invitations/accept
Invitations.Decline at /invitations/decline
Invitations.Cancel at /invitations/cancel
```

The [inbox](reaction:Invitations.Inbox) uses the [private inbox read model](former:Invitations.MyInbox) to expose only invitations owned by the session subject.
[Accept](reaction:Invitations.Accept), [decline](reaction:Invitations.Decline), and [cancel](reaction:Invitations.Cancel)
resolve the actor from the cookie. Inviting checks ownership and transitions atomically.
[Periodic expiry](reaction:Invitations.ExpireOverdue) is driven by Clock and also runs on startup.

This branch deliberately has no matching or event-generating implementation. The seed script calls
Inviting.invite with fixture event details. The full branch supplies those values through composition.

[CreateProfile](reaction:Profiles.CreateProfile) coordinates its named application step.

[MyProfile](former:Profiles.MyProfile) coordinates its named application step.

[Profile](reaction:Profiles.Profile) coordinates its named application step.

[AddInterest](reaction:Profiles.AddInterest) coordinates its named application step.

[RemoveInterest](reaction:Profiles.RemoveInterest) coordinates its named application step.

```endpoints
Profiles.Profile at /profile/mine
```

```endpoints
Profiles.AddInterest at /profile/addInterest
```

```endpoints
Profiles.RemoveInterest at /profile/removeInterest
```

[MyRequests](former:Meetups.MyRequests) coordinates its named application step.

[Mine](reaction:Meetups.Mine) coordinates its named application step.

[Submit](reaction:Meetups.Submit) coordinates its named application step.

[Withdraw](reaction:Meetups.Withdraw) coordinates its named application step.

[StartMatching](reaction:Meetups.StartMatching) coordinates its named application step.

[FormGroups](reaction:Meetups.FormGroups) coordinates its named application step.

[GenerateForMatch](reaction:Meetups.GenerateForMatch) coordinates its named application step.

[RecoverDrafts](reaction:Meetups.RecoverDrafts) coordinates its named application step.

[ActivateGroup](reaction:Meetups.ActivateGroup) coordinates its named application step.

[ReleaseFailedGroup](reaction:Meetups.ReleaseFailedGroup) coordinates its named application step.

[InviteParticipants](reaction:Meetups.InviteParticipants) coordinates its named application step.

[DeliverBackfill](reaction:Meetups.DeliverBackfill) coordinates its named application step.

[RecoverDeliveries](reaction:Meetups.RecoverDeliveries) coordinates its named application step.

[ReviewEvents](reaction:Meetups.ReviewEvents) coordinates its named application step.

[Confirm](reaction:Meetups.Confirm) coordinates its named application step.

[ReconsiderCancellation](reaction:Meetups.ReconsiderCancellation) coordinates its named application step.

[SayNo](reaction:Meetups.SayNo) coordinates its named application step.

[LateCancel](reaction:Meetups.LateCancel) coordinates its named application step.

[CloseAtCutoff](reaction:Meetups.CloseAtCutoff) coordinates its named application step.

[CancelInvitations](reaction:Meetups.CancelInvitations) coordinates its named application step.

[FinishInvitations](reaction:Meetups.FinishInvitations) coordinates its named application step.

[AdminCancelled](reaction:Meetups.AdminCancelled) coordinates its named application step.

[ReconcileDecisions](reaction:Meetups.ReconcileDecisions) coordinates its named application step.

[ReconcileClosedEvent](reaction:Meetups.ReconcileClosedEvent) coordinates its named application step.

[ExpireWaiting](reaction:Meetups.ExpireWaiting) coordinates its named application step.

[MyEvents](former:Meetups.MyEvents) coordinates its named application step.

[Events](reaction:Meetups.Events) coordinates its named application step.

[AdminEvents](former:Meetups.AdminEvents) coordinates its named application step.

[Admin](reaction:Meetups.Admin) coordinates its named application step.

[Run](reaction:Meetups.Run) coordinates its named application step.

[CancelEvent](reaction:Meetups.CancelEvent) coordinates its named application step.

```endpoints
Meetups.Mine at /requests/mine
```

```endpoints
Meetups.Submit at /requests/submit
```

```endpoints
Meetups.Withdraw at /requests/withdraw
```

```endpoints
Meetups.Events at /events/mine
```

```endpoints
Meetups.Admin at /admin/events
```

```endpoints
Meetups.Run at /admin/run
```

```endpoints
Meetups.CancelEvent at /admin/cancel
```
