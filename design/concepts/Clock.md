# Clock
## Purpose
Introduce periodic work.
## Principle
Each host tick produces a unique occurrence that compositions react to.
## Types
```types

```
## State
```state
a set of Ticks
```
## Actions
```actions
tick() : returns (tick: Tick)
  where preconditions hold
  then
    emit a fresh tick identity
    returns tick
```
## Queries
```queries
```

