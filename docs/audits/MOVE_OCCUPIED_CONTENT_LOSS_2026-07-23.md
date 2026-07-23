# Diagnosis — Move onto an occupied G-1 day silently destroys the moved session

**Date:** 2026-07-23 · **Branch:** `diagnose/move-occupied-content-loss` (off
`main` @ `2ab1517`) · **Status:** DIAGNOSIS ONLY — no implementation. RED
invariant tests written; STOP for review per the Coach Architecture Escalation
Rule.

Pins the NEW finding in `docs/audits/FULLSWEEP_2026-07-23.md` (Section A item 6b
/ "NEW" finding 1).

---

## 1. Summary

A **chained double-move** that lands a real session on an occupied **G-1 day**
(the day before a game) silently **destroys the moved session** and **duplicates
the destination's resolver-derived Gunshow filler onto both days**, while the
transaction reports success: *"Done. 2026-07-15 and 2026-07-17 swapped
sessions."*

The intent (move/swap) is understood correctly at the top of the pipeline. Two
**later** layers corrupt it, and **no verifier catches the loss** because none
checks that a pure relocation conserves the athlete's sessions.

## 2. Reproduction & pinned trigger

Reproduced on **both** the real device (iPhone 17 Pro sim, `standard-in-season-week`
seed) and a deterministic device-exact harness
(`src/__tests__/athleteMoveOccupiedContentLossTests.ts`).

Baseline week (anchor Mon 2026-07-13, Saturday game 2026-07-18):

| Day | Session |
|-----|---------|
| MON 07-13 | Lower Body Strength (`tier=core`, real plan entry) |
| WED 07-15 | Rest (empty) |
| FRI 07-17 | **Gunshow** (`id=derived-arms_pump-…`, `tier=optional`) — a resolver-derived G-1 session |
| SAT 07-18 | Game Day |

**Trigger is the CHAIN — a single occupied-destination move does NOT do it:**

- **Single move** MON (Lower Body Strength) → FRI (occupied Gunshow): **refused.**
  Device: *"I couldn't safely make that change, so the plan is untouched."*
  Harness: `ok:false`, week byte-identical. (Invariant M1 — GREEN.)
- **Chained move** MON→WED (empty), then WED→FRI (occupied Gunshow): **both
  report success**; the second says *"…swapped sessions."* Result:
  **WED = Gunshow, FRI = Gunshow (both `id=derived-arms_pump-2026-07-17`), Lower
  Body Strength gone from the entire week.** (Invariant M2 — RED.)

The loss reproduces **only** on a REAL accepted composition base (R11 device-exact
seed) **with the explicit Saturday game mark** the dev reset installs. The
R1-style hand-built seed leaves the composition base null and the Saturday game
virtual — under which the resolver's G-1 protected-core guard *preserves* the
moved strength session and the loss does not reproduce. This is exactly why the
existing `athleteSessionMoveTests.ts` "occupied compatible destination swaps
atomically" (test 3) is GREEN: it swaps two native plan entries in Off-season
with no game proximity.

## 3. Root cause — the causal chain

The destination's visible content on Friday is **not an athlete-owned session**.
It is a **resolver-derived, game-proximity session** (`Gunshow`, `arms_pump`)
synthesised every render by the G-1 rule in
`src/utils/sessionResolver.ts:657-695`, which returns
`buildDerivedSession('arms_pump', …)` for the day before a game. Because the
composition base materialises it, `acceptedWorkoutForDate(FRI)` returns a
concrete Gunshow — so the move layer treats it as a swappable session.

Step by step (chained case):

1. **Move 1 (MON→WED)** — `stageAthleteSessionMoveTransaction`
   (`src/store/acceptedStateTransaction.ts:2543-2612`) builds constraint **C1**:
   `targetDate=MON` (source cleared, `remainingWorkout=null`),
   `moveTargetDate=WED`, `movedWorkout=Lower Body Strength`. WED now shows the
   strength session. Correct.

2. **Move 2 (WED→FRI)** — `acceptedTarget = acceptedWorkoutForDate(FRI)` = the
   materialised **derived Gunshow**. Because it is non-null, the move is
   classified as a swap (`swapped = !!existingTargetWorkout`,
   `planChangeProducer.ts:1088`). Constraint **C2**:
   `targetDate=WED`, `moveTargetDate=FRI`, `movedWorkout=Lower Body Strength`,
   `remainingWorkout=` the swapped-back **Gunshow**.

3. **Constraint application** — `applyUserRemovalConstraintsToWeek`
   (`src/rules/userRemovalConstraints.ts:31-64`) applies C1 then C2 by
   day-of-week: C2's `targetDate=WED` filter strips the strength session C1 put
   on WED and pushes the swapped-back **Gunshow** onto WED; C2's
   `moveTargetDate=FRI` pushes **Lower Body Strength** onto FRI.
   Intermediate state: WED=Gunshow, FRI=Lower Body Strength.

4. **Resolver re-derivation** — `resolveWeekWithConditioning` runs the G-1 rule.
   Friday is G-1 to the **explicit** Saturday game, so `explicitGameDates.has(SAT)`
   is true and the protected-core guard at `sessionResolver.ts:677`
   (`isProtectedCoreExposure(templateWorkout) && !explicitGameDates.has(nextDate)`)
   is bypassed → the resolver **overwrites Friday's Lower Body Strength with a
   freshly derived Gunshow**.
   Final visible week: **WED = Gunshow (concrete swapped copy), FRI = Gunshow
   (re-derived), Lower Body Strength destroyed.**

Two distinct ownership violations produce the loss; the missing invariant lets it
ship:

- **(A) Swap-source-of-truth violation.** Friday's `acceptedTarget` is a
  *resolver-owned* derived proximity session, not an athlete-authored plan entry.
  Swapping it back to Wednesday launders resolver-owned content into
  athlete-owned content. Derived G-1/G+1 sessions are re-synthesised every render
  and are not swappable.
- **(B) Move-into-resolver-owned-day violation.** Placing a real session on a G-1
  day is futile — the resolver owns that day and regenerates Gunshow over it. The
  move layer never asks whether the destination day's content is resolver-owned
  (derived) versus athlete-ownable. (The *single*-move path already refuses this;
  the chained path reaches the same illegal end-state without the refusal.)

## 4. The missing invariant

**No layer asserts content conservation across a pure Move/Swap.** Verified
against every gate the commit path runs through:

- **§18 evaluator** (`section18EffectiveWeekEvaluator.ts`) — checks only
  aggregate exposure **counts/floors/ceilings** (main-strength frequency, rest
  floor, etc.). It receives only `{ contract, workouts, weekStart }` — no
  before-image. A dropped session is invisible unless it pushes a *required
  minimum* below contract; a lost session compensated by a duplicate elsewhere
  passes with zero blocking violations.
- **Commit verifier** (`assertAcceptedVisibleLedgerEquivalence`,
  `acceptedStateTransaction.ts:318`) — compares an `acceptedLedgerSignature`
  (JSON of aggregate **counts**) before vs. after re-projection. It proves
  *projection stability of counts*, not *identity conservation*. Two weeks with
  different sessions but identical exposure counts share a signature.
- **Visible-domain move verifier** (`verifyMoveExpectation` /
  `verifyRenderedSessionMove`, `coachVisibleDomainVerifier.ts:302`,
  `visibleProgramReadModel.ts:697`) — a **name-only** "left source / landed on
  dest" check. A Gunshow appearing on *both* days satisfies even this.

**Missing invariant (the ownership boundary):**

> A pure Move/Swap (no add/remove intent) must **conserve the multiset of
> athlete-owned session identities**. The moved session's identity must be
> present in the resolved week afterwards; no athlete-owned session may be
> silently destroyed; a resolver-owned derived session must not be materialised
> as an athlete-owned "swapped" session. **Success must imply conservation** — a
> "swapped sessions" acknowledgement is only truthful if both relocated
> identities are actually present after resolution.

The correct owner is the **move transaction** (the §18 transaction owner from the
ownership migration), asserting conservation **against the resolved week** (post
G-1/G+1 re-derivation), not against the pre-resolution staged surfaces. The
current verifiers all run pre-resolution or on counts, which is why the
resolver's overwrite is invisible to them.

## 5. Proposed RED invariant tests

`src/__tests__/athleteMoveOccupiedContentLossTests.ts` (run:
`npm run test:athlete-move-occupied-content-loss`). Device-exact seed (R11) with
the explicit Saturday game mark.

| # | Invariant | Today |
|---|-----------|-------|
| M1 | Single occupied-destination move onto the G-1 day is safely refused; week byte-identical | **GREEN** (characterization — pins the "chain required" boundary) |
| M2 | Chained double-move conserves content and reports honestly: (a) moved session survives, (b) no session identity duplicated across two days, (c) a "swapped sessions" success implies (a)+(b) | **RED** (reproduces the loss) |

M2 fails today with the exact device symptom:
`week = …, 2026-07-15:Gunshow, …, 2026-07-17:Gunshow, …` and Lower Body Strength
absent, under `ok=true, msg="Done. 2026-07-15 and 2026-07-17 swapped sessions."`
These join `test:bible` once green (kept out of the chain while RED).

## 6. Architecture reassessment (per the Coach Architecture Escalation Rule)

The AI/semantic layer understood the request; a **later** layer destroyed the
intent. Reassessment before any code:

1. **Current source of truth?** The accepted-state surfaces + persisted
   `userRemovalConstraint`s, projected through the resolver into the visible
   week. The *visible* week is a derived view the resolver can rewrite (G-1/G+1
   proximity), so "what the athlete owns" and "what is shown" are two different
   things the move layer conflates.
2. **How many representations of the request?** At least three: the `PlanChange`
   / move input, the `UserRemovalConstraint` (source/target/moved/remaining), and
   the resolved visible week. The swap decision (`swapped = !!existingTargetWorkout`)
   is taken on the *resolved* week, but the *displaced* content it swaps back is a
   resolver-owned derived session.
3. **Where can intent be reinterpreted?** (a) swap classification reads a derived
   session as swappable; (b) the resolver re-derives Gunshow over the moved
   session on the destination day; (c) the success message is gated on
   `swapped`, not on post-resolution conservation.
4. **Which layer should own the decision?** The move transaction owner — it must
   (i) refuse or re-plan a move whose destination content is resolver-owned
   rather than swap a phantom, and (ii) assert identity conservation against the
   **resolved** week before reporting success.
5. **Simpler source-of-truth redesign?** Give the move layer an explicit notion
   of *ownable vs. resolver-derived* content (derived proximity sessions carry
   `derivedSessionProvenance` / no `planEntryId`) so "occupied" means "occupied by
   an athlete-owned session", not "occupied by anything the resolver rendered".
   This removes the phantom-swap representation instead of adding a guard.
6. **Legacy paths to retire?** The dual swap implementations
   (`applyAdjustmentEvents.applyMoveSession` vs.
   `commitAthleteSessionMoveTransaction`) and the name-only move verifiers should
   converge on one conservation-checked transaction rather than being patched
   separately.
7. **Tests that prove the ownership boundary?** M1 (single-move refusal) + M2
   (conservation + honest success) above; extend to G+1 recovery days and to the
   Coach free-text move door once the owner is chosen.

**Do not** add a targeted G-1 guard, a swap-classification special-case, or a
message patch before this reassessment is approved — any of those would fix this
one path while leaving the "pure relocation may silently destroy content" class
open.

## 7. Recommendation

STOP for review. The high-leverage fix is a **content-conservation post-condition
owned by the move transaction, asserted against the resolved week**, plus teaching
the swap classifier that resolver-derived days are not swappable. That closes the
whole class (any Move/Swap onto any resolver-owned day, single or chained),
whereas a G-1-specific guard would not.
