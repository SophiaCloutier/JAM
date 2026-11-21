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
