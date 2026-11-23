# JAM application types

```types
concrete Person
  A normalized college email identifies an account.
concrete Event
  An opaque event identity supplied by the event integration.
concrete SlotRequest
  An opaque availability request supplied by the matching integration.
```

```instances
instantiate Authenticating with
  User is Person
instantiate Sessioning with
  User is Person
instantiate Inviting with
  User is Person
  Event is Event
  Request is SlotRequest
instantiate Characterizing with
  User is Person
instantiate Matching with
  User is Person
  Event is Event
instantiate EventGenerating with
  Group is Matching.Cluster
```
