# Sessioning
## Purpose
Remember authenticated subjects.
## Principle
Starting creates a seven-day opaque session; current resolves it until expiration or end. Only configured operators may authorize privileged work.
## Types
```types
external User
```
## State
```state
a set of Sessions with
  a subject User
  an expiresAt DateTime
```
## Actions
```actions
start(subject: User) : returns (session: Session, expiresAt: DateTime)
  where preconditions hold
  then
    create a random session and expiry
    returns session, expiresAt
current(session: Session) : returns (user: User)
  where session is absent or expired
  then
    refuses UNKNOWN_SESSION "session is absent or expired."
  where preconditions hold
  then
    resolve the active session subject
    returns user
end(session: Session) : returns (ended: Flag)
  where preconditions hold
  then
    delete the session if present
    returns ended
authorize(session: Session) : returns (user: User)
  where session is absent or expired
  then
    refuses UNKNOWN_SESSION "session is absent or expired."
  where subject is not an operator
  then
    refuses FORBIDDEN "subject is not an operator."
  where preconditions hold
  then
    resolve active session and allow configured operators
    returns user
```
## Queries
```queries
```


