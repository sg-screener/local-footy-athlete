# G-1 Move Ask-Flow — athlete-placed content outranks derived filler

**Unit G-1. Ruled by Sam 2026-07-28/29. Status: design signed off, building.**

Generation never plans hard strength or conditioning on G-1. That law is
unchanged. This unit is about what happens when the ATHLETE puts a session
there: the app stops silently substituting or refusing, warns once, and offers
three named routes.

---

## 1. The defect

Probed against the seeded `practice match` scenario (`athleteSessionMoveTests`
case 12, Pre-season, phase entry −2 weeks, practice match on Saturday):

```
composed week (athlete's, pre-resolver)      visible week (post-resolver)
  Mon  Full Body Strength   core               Mon  Full Body Strength
  Tue  Hard Intervals       core               Tue  Hard Intervals
  Wed  Upper Push           core               Wed  Upper Push
  Thu  Upper Pull           core               Thu  Upper Pull
  Fri  Rest stub                               Fri  EMPTY
  Sat  practice match anchor                   Sat  Game Day
```

Move Monday → Friday and `commitAthleteSessionMoveTransaction` throws:

```
athlete_move_content_not_conserved
Move would silently destroy session w1:monday:none:strength
```

The chain:

1. `applyUserRemovalConstraintsToWeek` (`rules/userRemovalConstraints.ts:61`)
   correctly places the athlete's session on Friday.
2. `applyGameProximity` (`utils/sessionResolver.ts:659`) then overwrites it with
   the derived G-1 Gunshow.
3. The conservation post-condition in `commitAthleteSessionMoveTransaction`
   detects the loss and correctly refuses the whole move.

Step 2 is the defect. The G-1 branch does have a protection guard —

```ts
if (isProtectedCoreExposure(templateWorkout) && !explicitGameDates.has(nextDate))
```

— but it is disabled for EXPLICIT fixtures. A practice match is an explicit
calendar mark, so the guard is bypassed and the derived filler wins. Before the
practice-match ruling (`db9a9af`) the Saturday fixture was virtual, the guard
held, and this row passed. That is why exactly one matrix row broke.

**Root cause, stated as law: derived filler outranks athlete-placed content.**
Sam's ruling inverts it.

## 2. Two refusal doors, not one

The ask-flow has to replace both, or the practice-match case keeps falling
through to a generic failure.

| Case | Door | Today's athlete-facing outcome |
|---|---|---|
| G-1 visibly shows the Gunshow (normal in-season week) | `resolveAthleteMutation` → `move_destination_resolver_owned` (`utils/planChangeProducer.ts:1093`) | *"That day is kept light around your game, so a session can't be moved onto it."* |
| G-1 visibly empty but still G-1 (practice match; canonical Rest stub) | conservation post-condition throws | *"I couldn't safely make that change, so the plan is untouched."* |

## 3. Design

Four touches. No new resolver, no new resolution of the athlete's request, no
compatibility branch.

### 3.1 Ownership condition — one site

`applyGameProximity`'s G-1 branch never displaces an **athlete-placed** session,
explicit fixture or virtual. This is the whole law, applied where the violation
happens.

The placement stamp is written at the single site athlete content enters a week
— `applyUserRemovalConstraintsToWeek`, the sole applier of
`UserRemovalConstraint.movedWorkout`. The stamp is DERIVED from the constraint
at application time; the constraint stays the only stored representation. No
second source of truth is created.

§18 repair relocation does not pass through that site, so it does not receive
the stamp: automatic heavy relocation onto G-1 stays refused exactly as today.
`athleteSessionDeletionTests` regressions 14/15 pin this. **The ask-flow is the
only door onto G-1.**

### 3.2 The ask reuses the existing typed classifier

`gMinusOneHardStopFindings` (`utils/programEditRiskAssessment.ts:305`) already
emits a typed `g1_hard_work` hard stop and already knows the offending unit's
category and stress. It stops being a dead end and becomes a typed offer,
carried on the producer's existing blocked-assessment channel and rendered as a
new `PlanChangeSheet` step beside `confirm_warning` / `block_warning`.

The ask fires only for sessions that classifier already calls hard. A recovery
or mobility session moved onto G-1 passes straight through as it does today —
the existing G-1 branch already preserves recovery and rest.

### 3.3 The three routes — a UNIFORM menu (Sam, 2026-07-29)

Every session type gets the same three options. Route (b)'s CONTENT differs by
session type; the menu shape does not.

| Route | Strength move | Conditioning / sprint move | Transaction |
|---|---|---|---|
| **(a) Gunshow** | Move abandoned | Move abandoned | **None.** Source session stays where it is; the derived Gunshow stays on G-1. Nothing to undo. |
| **(b) Accessories** | Their session, main lifts stripped | The derived accessories/pump session, labelled as its own thing | Move transaction, placed workout transformed |
| **(c) Same session deloaded** | DELOAD_LAW dose | DELOAD_LAW dose | Move transaction, placed workout transformed; second warning first |

Route (b) for a conditioning move is **not** an easy-aerobic version wearing the
athlete's session name. That identity-swap class stays banned. It is the derived
pump session under its own name, and the copy says the original session is being
given up.

(a) and (b) therefore differ for every session type: (a) keeps the source day's
session, (b) trades it for the pump session on G-1.

Route (c) carries the second, stronger warning regardless of session type.

**Reduction mechanism:** exactly one. Route (c) applies
`applyStrengthDeloadToExercises` + `applyConditioningDeloadToExercises`
(`rules/deloadWeekRules.ts`) under a `resolveDoorDeloadPolicy`-shaped policy.
`DELOAD_LAW` is untouched. Route (b)'s strength stripping reuses the accessory /
main-lift classification that already lives in that same module.

### 3.4 Typed option list, extensible by construction

The menu is a typed list of options, not three hardcoded branches. A fourth
option — **pre-game PRIMER**, short sharp activation reusing the power-primer
machinery and Sam's authored power pool — is PARKED pending Sam's authored
prescription, and is to be addable as one list entry plus one transformation.

### 3.5 Transaction ownership

All committing routes go through `commitAthleteSessionMoveTransaction`. The
constraint's `originalWorkout` stays the FULL accepted source session, so Undo
restores exactly what was there. Disclosure and the reversible-adjustment ledger
are unchanged.

## 4. Warning copy — authored, signed by Sam 2026-07-29

Day names resolve from the actual fixture and source day; `Friday` / `Monday`
below are the seeded example.

**Warning 1 — the ask**

> **Big session the day before your game.**
> Train hard Friday and you'll feel it Saturday. Pick one:
>
> - **Keep Friday's Gunshow** — Light upper-body pump, what the day before a
>   game is built for. Your Monday session stays where it is.
> - **Accessories only** — Your session with the main lifts stripped out. Pump
>   and prehab, nothing heavy.
> - **Same session, deloaded** — Half the sets at RPE 5–6, weight stays.
>   Conditioning halved.

**Route (b) sub-line when the moved session has NO accessories** — a
conditioning or sprint session. NOT YET SIGNED: drafted from Sam's
honest-labelling ruling, awaiting his word. The menu shape and the other five
strings above are signed.

> - **Accessories only** — A pump session instead. Your Monday session is
>   dropped, not moved.

**Warning 2 — before route (c) applies**

> **This still costs you Saturday.**
> Half the sets is easier, not light. The day before a game is built for a pump
> and nothing else. Go ahead only if this session matters more than the game.

No unauthored copy reaches a card. The option (b) sub-line for a
conditioning/sprint move names the pump session honestly rather than reusing the
athlete's session name.

## 5. Escalation boundary

Sam's standing rule applies. If honouring athlete placement turns out to need
more than the contained condition in §3.1 plus the ask-flow — a second resolver,
another guard, a fallback, a finaliser patch — implementation STOPS and the
seven-question reassessment is written before any further code.

## 6. Gates

- `npm run test:athlete-session-move` — **22 passed, 0 failed** (case 12 fixed).
- `npm run test:athlete-session-deletion` — regressions 14/15 green; G-1 stays
  protected from silent heavy relocation.
- New suite pinning the ask-flow: menu uniformity, route outcomes, the
  no-transaction property of (a), DELOAD_LAW as the only reduction, the second
  warning on (c), and copy equality against this document.
- `npm run test:bible` EXIT=0.
- Merge brings `feat/practice-match-g1-hold` (`4a0de0d`) with it.
