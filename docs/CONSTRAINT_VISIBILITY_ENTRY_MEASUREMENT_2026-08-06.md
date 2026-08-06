# CONSTRAINT-VISIBILITY ENTRY MEASUREMENT — 2026-08-06

Condition 1 of `CONSTRAINT_VISIBILITY_PRECONDITION_RULING_2026-08-06.md`,
measured. **STOP at condition 1. NOTHING BUILT.** The canonical source is
reachable at every door and is not the TRUTH at every door, and the gap is not
a gap the ruling anticipated.

## What was measured, and how

`canonicalUserRemovalConstraints()` (`src/utils/canonicalRemovalConstraints.ts`)
reads `useProgramStore.getState().userRemovalConstraints` through a lazy
require — the same idiom `programStore` already uses to reach the gateway, so
no module-load cycle exists in either direction. It answered at every one of
the 8,528 production entries below; **reachability is not in question.**

`probeConstraintEntry` in `section18AcceptedWeekGateway.ts` compares, at both
public entries, what the caller THREADED against what the canonical source
HOLDS, and names the door from its own call stack so the census counts doors
rather than my reading of them. It prints only under
`LFA_CONSTRAINT_ENTRY_PROBE=1` and is inert otherwise (baseline reprinted
below). Swept over ten witness suites: deletion, move, fixture-identity,
accepted-state, gateway, deriving-device-commit, quiescent-boot, week-identity,
derived-repair-ownership, day-precedence, deletion-calendar.

Six outcomes, and the two the ruling named are not the big ones:

```
agree               2918   the store is the truth and the caller threaded it
absent/store-empty  2398   no constraints anywhere — the ruling's "empty is truth"
PROPOSAL            2827   the thread holds a constraint THE STORE DOES NOT
FORGOTTEN            328   the residual the ruling was aimed at
STATUS-DIFF           54   same ids, different status/date
STALE                  3   the store holds a constraint the thread does not
```

Per production door:

```
gateway  services/api/generateProgram.ts:715          FORGOTTEN 160  empty 880
gateway  store/programStore.ts:1285                   agree 346  PROPOSAL 241  empty 5
gateway  store/programStore.ts:902                    empty 88
gateway  utils/fixtureMinimalReplan.ts:1181           agree 140  PROPOSAL 331
gateway  utils/fixtureMinimalReplan.ts:1346           agree   2  PROPOSAL   7
gateway  utils/fixtureMinimalReplan.ts:1380           agree   2  PROPOSAL   3
gateway  utils/fixtureMinimalReplan.ts:1494           agree  10
gateway  utils/postGenerationConstraintValidation.ts:1266   FORGOTTEN 4  empty 171
gateway  utils/postGenerationConstraintValidation.ts:1357   empty 1
gateway  utils/postGenerationConstraintValidation.ts:1573   empty 12
gateway  utils/postGenerationConstraintValidation.ts:1773   empty 4
visible  rules/acceptedEffectiveWeek.ts:150   agree 1566  PROPOSAL 631  STATUS-DIFF 54  STALE 3
visible  rules/wholeWeekRepairEngine.ts:69    FORGOTTEN 164  empty 1232
visible  store/programStore.ts:1295           agree 452  PROPOSAL 361  empty 5
visible  utils/fixtureMinimalReplan.ts:304    agree 400  PROPOSAL 1253
```

**The residual is CONFIRMED.** `FORGOTTEN` is real at four doors — the two
live `postGenerationConstraintValidation` doors, `generateProgram.ts:715`, and
the same absence inherited inward at `wholeWeekRepairEngine.ts:69` where the
search re-resolves each candidate. `programStore.ts:902` never met a non-empty
store in this witness set, so its forgottenness is named but **unpriced**.

## The refutation — a proposal is not a forgotten input

**`PROPOSAL` is 2,827 entries across six doors, 8.6× the class the ruling was
aimed at, and it is the mechanism's refutation.** The threaded array holds a
constraint the store does not, because the athlete's decision is UNDER
EVALUATION: `stageAthleteMutationTransaction` composes the proposed constraint
set, runs the gateway on it, and only then commits — `useProgramStore.setState`
is at `acceptedStateTransaction.ts:832`, downstream of every entry counted
above. A gateway resolving from the persisted store at those doors evaluates
the week the athlete is LEAVING, not the one they chose.

And the distinction is not incidental — it is signed, and it is deliberate at
`acceptedStateTransaction.ts:2785-2791`, which threads **two different
constraint sets in the same call**:

```ts
// Deletion repair needs the accepted target still present as a relocation
// template. A move, by contrast, must enter repair with both athlete-owned
// halves already staged. The gateway receives the proposed constraint in
// both cases and keeps the prohibited source immutable.
userRemovalConstraints: args.mutationIntent === 'athlete_move'
  ? userRemovalConstraints        // proposed — both halves staged
  : state.userRemovalConstraints, // prior — the binned target survives as a template
```

One persisted source cannot express a distinction that is DEFINED by not being
persisted yet. Resolving from the store hands the prior set to both intents,
which silently reverts the move's staging — the same class of defect the ruling
exists to kill, reinstalled by the fix. `STATUS-DIFF`'s 54 are the second face
of it: the move staging both halves and the re-add flipping `active` →
`restored` while the store still says `active`.

So the ruling's parenthetical named two cases and there are three. Empty from
the source is truth; empty from a forgotten parameter was the lie; **non-empty
from a parameter the source has never heard of is a DECISION, and retiring the
parameter deletes it.**

## What survives, and where the resolution point should go

The systemic instinct is right and only the resolution point is wrong. The
fifteen doors do not share a SOURCE, but they already share a COMPOSER —
`buildFixtureProjection`, `acceptedStateTransaction.ts:1643-1649`:

```ts
const sourceSurfaces = args.sourceSurfaces ?? {
  ..., userRemovalConstraints: liveState.userRemovalConstraints,
};
```

An `AcceptedEffectiveWeekSurfaces` **is** the evaluation context the ruling
asked for. It already owns `userRemovalConstraints`, and it already falls back
to the live store in exactly one place when no caller stages one. So the class
still dies if the gateway takes the SURFACES instead of a bare optional array:
the parameter stops being forgettable because it stops being optional and stops
being composed per-caller, the four forgotten doors get the store for free, and
a proposal keeps working because a proposal is just a surfaces object the
transaction composed. That is a candidate, not a ruling — it is not what was
signed, and the escalation rule says stop rather than substitute.

## State

**NOTHING BUILT. The final pricing did NOT re-run** — it is gated on this
condition, and this condition did not pass. The branch is unchanged behaviour:
probe off reprints the baseline exactly.

```
deletion 24/24·5/5·3/3   accepted-state 23/23·10/10·10/10   phase-structure 11/11
section18-gateway 91/0 (52 scenarios · 19 properties · 19 mutations)
fixture-identity 3/3 (needs 6/6 — the unit's standing red, unmoved)
typecheck gate PASSED, no file regressed against baseline
```

Still owed and untouched: condition 4 of the search ruling (146 wall-clock
stamps → one injected `todayISO`), and `programStore.ts:902`'s price.
