# Characterizing
## Purpose
let users state relevant information about themselves
## Principle
a user creates a profile and adds interests; that information stays on the profile and can be read back until the user removes it; the user can add and remove interests at any point
## Types
```types
external User
```
## State
```state
a set of Profiles with
  a user User
  an interests String
Rule: interests is a set of at most 12 normalized tags, stored as a JSON list.
```
## Actions
```actions
create(user: User) : returns (user: User)
  where a profile with this user exists
  then
    refuses PROFILE_EXISTS "a profile with this user already exists."
  where preconditions hold
  then
    create a new profile with this user and no interests
    returns user
addInterest(user: User, tag: String) : returns (tag: String)
  where no profile with this user exists
  then
    refuses PROFILE_NOT_FOUND "no profile with this user exists."
  where the normalized tag is not 2 to 40 letters, or the profile already has 12 other interests
  then
    refuses INVALID_INTEREST "Use 2–40 letters for an interest, and keep up to 12 interests."
  where preconditions hold
  then
    normalize the tag (correcting a one-letter typo of a suggested tag) and add the tag to this profile's interests if it is not already there
    returns tag
removeInterest(user: User, tag: String) : returns (tag: String)
  where no profile with this user exists
  then
    refuses PROFILE_NOT_FOUND "no profile with this user exists."
  where preconditions hold
  then
    normalize the tag and remove it from this profile's interests if it is there
    returns tag
```
## Queries
```queries
_get(user: User) : one (interests: String)
  Return this user's interests as a JSON list, or an empty list if the user has no profile.
```
