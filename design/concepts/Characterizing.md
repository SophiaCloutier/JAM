# Characterizing
## Purpose
Store creative interests.
## Principle
Add and remove normalized interests without affecting existing requests.
## Types
```types
external User
```
## State
```state
a set of Profiles with
  a user User
  an interests String
```
## Actions
```actions
create(user: User) : returns (user: User)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns user
addInterest(user: User, tag: String) : returns (tag: String)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns tag
  where an action precondition fails
  then
    refuses INVALID_INTEREST "Check the action preconditions."
removeInterest(user: User, tag: String) : returns (tag: String)
  where action preconditions hold
  then
    apply the documented state transition atomically
    returns tag
```
## Queries
```queries
_get(user: User) : one (interests: String)
  Read the owned state without changing it.
```
