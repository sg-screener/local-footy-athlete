# 1b — addendum: the approved ownership was built, and it hit a SECOND PLANNER

**Read `docs/1B_FLUSH_OFFER_ARCHITECTURE_REASSESSMENT_2026-08-06.md` first.** This
is its addendum, written at the point CLAUDE.md's escalation rule fires for the
second time in the same unit. Nothing further is implemented.

Sam's ruling INTENT is not in question and is not relitigated
(`docs/FLUSH_OFFER_RULING_2026-08-05.md`).

## What was built, and what it proved

"Declare, then place" — the ownership the reassessment recommended and Sam
approved — is implemented and **held on `fix/1b-flush-offer` at `5bf74a8e`**. It
is not on this branch, because `test:bible` is red with it.

It works, and the reassessment's central finding was correct:

- `resolveSection18PhasePlannerSelection` now declares the authored
  `optionalFlush.min` instead of a flat `0`. **`optionalFlush.min` stops being
  inert** — the ruling's own instrument becomes real, which was the parked
  finding from 2026-08-05.
- The in-season game-week policy carries the ruling, `optionalFlush` min 0 → 1.
- `coachingEngine` feeds the declaration into `plannerSelected` **before** the
  contract is built, so the contract carries the offer into the allocation
  rather than learning about it afterwards.
- The allocation places what was declared. The old flush loop could only
  **demote** sessions that already carried conditioning, and in an in-season game
  week nothing does — which is the whole reason the week came back with zero
  conditioning against Bible `:81`.

Measured on the derived in-season week: Monday's strength day comes back as a
`Mixed` session carrying an authored **"Short Flush"** (`exerciseType: Cardio`,
`nameProvenance: authored`, "10–20 min continuous easy … Very easy, 3–4/10"),
typed `optional_flush`. That is exactly `:81`'s "optional flushout/ aerobic
conditioning off-leg", and `:127`'s arithmetic is untouched.

`phaseStructureConformanceTests` runs **7 passed / 0 failed with both 1b declared
reds deleted** on that branch.

## Why it is held

Remove the game from that week and rebuild it (`rebuildLocalWeek`, the ordinary
fixture-change path) and the accepted week comes back as:

```
Mon  Lower Body Strength + Aerobic Conditioning   role = required_core   ← the offer, promoted
Tue  Team Training + Upper Pull
Wed  Prehab & Accessories
Thu  Team Training + Upper Push
Fri  Gunshow
Sat  —                                            ← the hard conditioning session never built
```

Baseline, without 1b, that same rebuild produces `Sat Hard Conditioning`
(`required_core`, `glycolytic`) and leaves Monday clean.

So two things break at once, and both are Sam's ruling broken one layer down:

1. **The athlete's OFFER is laundered into required work.** A flush the athlete
   was free to skip becomes core conditioning they owe.
2. **The week loses the hard session it should have built** on the freed
   Saturday, because the promoted flush already satisfies the core floor.

## The engine is not the culprit — this was instrumented, not assumed

Printing the allocator's input and output on that rebuild shows
`applySection18ConditioningAllocation` producing the **correct** bye-build plan:
core conditioning on Saturday, Monday clean, `plannerSelected.optionalFlush = 0`
for `in_season_bye_build` (that mode's authored min is 0, so the declaration
correctly does not fire there).

The engine's plan and the accepted week disagree. The promotion happens after it.

## The layer

`src/utils/fixtureMinimalReplan.ts` is a **second planner**. On a fixture change
it recomputes the week's conditioning from its own shortfall arithmetic against
`baselineEvaluation.ledger.conditioning.coreCount` and stamps its own role
(`:1090`):

```ts
const role = baselineEvaluation.ledger.conditioning.coreCount
  < contract.conditioning.core.requiredMinimum
  ? 'required_core'
  : 'planner_selected_core';
```

It has its own notion of which days already hold core conditioning
(`daysWithCoreConditioning`, `:1072`), its own candidate-day selection, and its
own conditioning authoring. It does not know that a typed flush is an offer.

**This is CLAUDE.md's escalation trigger word for word:** the layer that
understands the intent is overruled by a later one. The Stop-Patching Trigger
names the move that would come next — "one more resolver", "patch the finaliser"
— so implementation stopped here rather than adding a guard inside
`fixtureMinimalReplan`.

## The seven questions, for THIS boundary

1. **Current source of truth?** Contradictory, and that is the finding. The
   engine's allocator owns the role at generation; `fixtureMinimalReplan` owns it
   again at fixture change; `postGenerationConstraintValidation` (`:1012`) owns a
   third opinion, defaulting an unroled conditioning session to
   `planner_selected_core`.
2. **How many representations of "this session's §18 conditioning role"?** At
   least four writers outside the engine — `fixtureMinimalReplan`,
   `postGenerationConstraintValidation`, `canonicalPlanChangeCandidateMaterializer`,
   `coachRevisionOverrideWriter` — plus the accepted-week gateway that copies it
   forward. The role is **stored and recopied**, never derived.
3. **Where can intent be reinterpreted?** Anywhere the week is rebuilt,
   revalidated, or materialised. Each site re-derives a shortfall and re-stamps.
4. **Which layer should own the decision?** One. The role is a FUNCTION of the
   contract and the week's content — it is derived, not a fact — so by the north
   star it should not be stored on the allocation at all, and certainly not
   re-authored independently by every repair path.
5. **What simpler architecture removes representations?** Derive
   `section18ConditioningRole` once, from the contract plus the week, at the
   single point that already evaluates the week (`section18EffectiveWeekEvaluator`
   is the natural home — it is the layer that already refuses to let a flush
   satisfy the core floor). Every other site stops writing the field and reads
   the derivation. That deletes the disagreement instead of adding a fifth
   opinion to arbitrate it.
6. **Which legacy paths retire?** `fixtureMinimalReplan`'s conditioning shortfall
   and role assignment, and `postGenerationConstraintValidation`'s
   `?? 'planner_selected_core'` default, are the two that demonstrably contradict
   the engine today.
7. **What tests prove the boundary?** `phaseStructureConformanceTests` cells 5
   and 7 (both declared red on this branch), plus a new cell asserting that a
   flush SURVIVES a fixture-change rebuild as a flush — the exact regression
   measured above, which no suite covers today.

## One change in the held branch is independently right

Core selection now refuses to consume a session typed `optional_flush`. That is
not a guard: the §18 evaluator has always held that "a typed flush cannot satisfy
the core-conditioning floor" (`core_flush_misclassification`), while the
allocator's `existingEligible` treated any conditioning-carrying session as
available core. The change makes the two agree. It does not fix the defect above,
because that defect is in a different layer.

## Questions for Sam

1. **Approve the single-owner derivation in question 5?** It is a bigger pivot
   than 1b, and it is the thing that makes 1b hold still once it lands. The
   alternative — teaching `fixtureMinimalReplan` about flushes — is a fifth
   representation and the rule says not to.
2. **Should a flush survive a fixture-change rebuild at all?** A flush placed in
   a game week persists into the rebuilt bye week in the held branch. Bye-build
   authors `optionalFlush: {min: 0, max: 1}`, so it is *permitted* there, but
   nothing says it is *wanted* there. Either answer is buildable; the ruling does
   not currently cover it.

## Also settled this session (no ruling needed)

**Cell 6 — the empty Sunday — was never a conditioning defect**, as the
reassessment suspected. Measured: the derived in-season Sunday already comes back
`source: 'rest', indicator: 'rest'` — a **typed rest day** — which `:81`'s "sunday
rest **or** recovery" permits. The cell reddened only because its instrument read
`workout.name` plus attached activity names, and a typed rest day carries neither.

It is re-scoped to a control that pins the typed rest day, is **green**, and its
declared-red entry is deleted.

The surface half needs no new copy either. `Rest Day` already exists as
registered copy at `src/rules/projectionCopy.ts:154` (`day.headline.rest`), and
`projectVisibleWeek` resolves a day's headline through
`signedCopy('day.headline.' + kind)` (`:651`), so a `rest` day resolves to it.
**No new athlete-visible words were invented, and none are proposed.**

Read as a code path, not as a device observation — this was traced through the
projection, not seen on a phone. If Sam wants the rendered Sunday confirmed, it
belongs on the combined device pass rather than in a suite.
