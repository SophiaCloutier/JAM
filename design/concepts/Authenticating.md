# Authenticating
## Purpose
Authenticate college accounts.
## Principle
Register an eligible email with a password, then log in with the same credentials. Duplicates and wrong passwords are refused.
## Types
```types
external User
```
## State
```state
a set of Accounts with
  an email String
  a verifier String
```
## Actions
```actions
register(email: String, password: String) : returns (user: User)
  where email is not .edu or password length is outside 10 to 128
  then
    refuses INVALID_ACCOUNT "email is not .edu or password length is outside 10 to 128."
  where email is already registered
  then
    refuses ACCOUNT_TAKEN "email is already registered."
  where preconditions hold
  then
    normalize email, hash password, and persist a unique account
    returns user
login(email: String, password: String) : returns (user: User)
  where credentials do not match
  then
    refuses INVALID_CREDENTIALS "credentials do not match."
  where preconditions hold
  then
    verify password and return the registered email
    returns user
```
## Queries
```queries
```

