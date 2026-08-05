# 1b — the offer has ONE placer, and every repair path can destroy it

Written at a clean stop with the tree green, at the point CLAUDE.md's escalation
rule fires for the **third** time in this unit. **Nothing in this document is
implemented.** Rulings 1 and 2 are built, measured and landed; this is what
landing them surfaced next.

Read `docs/1B_ONE_OWNER_DERIVATION_DESIGN_2026-08-06.md` and
`docs/1B_FLUSH_OFFER_RULINGS_2026-08-06.md` first.

## The class, three sightings, one unit

Every one of these is the same shape: **a layer states the athlete's offer
correctly, and a later layer changes, downgrades or destroys it.**

| # | sighting | state |
|---|---|---|
| 1 | `fixtureMinimalReplan` re-roles the placed flush to `required_core` on a fixture rebuild — an OFFER laundered into REQUIRED work | **PAID** (rulings 1 + 2) |
| 2 | the positional derivation gives the offer's core slot to the wrong session — an easy flush counted as core, a real VO2 session labelled the offer | **PAID** (see "the design was corrected", below) |
| 3 | an accepted-week repair strips the offer off the day it sits on, and nothing can put it back | **OPEN — this document** |

Sighting 3 is declared red in `athleteSessionDeletionTests` (regressions 15 and
17) with this document named as its payer. The entries force their own deletion
in the commit that pays them.

## Sighting 3, measured

`seedExactInSeasonStrengthWeek`, an in-season game week. Before any deletion,
Monday carries the offer Bible `:81` authors:

```
Mon  Lower Body Strength   Mixed   role=optional_flush  cat=aerobic_base
Tue  Team Training + Upper Pull
Wed  Prehab & Accessories
Thu  Team Training + Upper Push
Fri  Gunshow
Sat  Game Day
```

Delete Wednesday's Upper Pull through the real sheet door. The repair relocates
the pull work and returns:

```
Mon  Lower Body Strength   Strength   role=none          ← the offer is gone
Tue  Team Training
Wed  Upper Pull
Thu  Team Training + Upper Push
Fri  Gunshow
Sat  Game Day
```

The week silently stops offering the flush, and the signed confirmation gains
"I also rebalanced Monday to keep your week balanced." The sentence is **not
lying** — the repair really did touch Monday. What is wrong is that it needed
to, and that the loss it caused is not what the sentence names.

## Why this is not a fourth guard

Instrumented, not assumed. `applySection18ConditioningAllocation` — the one
placer — runs at generation and correctly identifies Monday as the only
fixture-safe candidate, and places the offer there. The accepted-week repair
path does not go through it: it reshapes accepted workouts directly. So:

> **There is exactly ONE placer of the offer and it runs only at generation.
> Every accepted-week repair path can destroy the offer, and none of them can
> restore it.**

The Stop-Patching Trigger names what would come next — "one more resolver",
"patch the finaliser", teaching a fourth site about flushes — so implementation
stopped here.

The same gap has a second, unmeasured face worth stating: `buildFixtureMinimalReplan`
now strips the offer by ruling 2 and cannot re-place one, so a fixture **move**
that leaves the week in a mode still declaring an offer loses it until the week
is regenerated. Ruling 2's test only covers game → bye, where the rebuilt mode
declares none, so no suite sees this today.

## The seven questions, for THIS boundary

1. **Current source of truth?** For *how many* offers a week has: the contract
   (`conditioning.optionalFlush.plannerSelectedCount`), authored per mode. For
   *which session is the offer*: the mark the placer writes on the week. The
   first is stated everywhere; the second exists only where the placer ran.
2. **How many representations?** After ruling 1, one — and that is the win. The
   problem is no longer disagreement, it is ABSENCE: repair paths rebuild a week
   without the placer and the mark simply never gets written.
3. **Where can intent be reinterpreted?** It is not reinterpreted any more. It
   is DROPPED — anywhere a day is reshaped by a repair (component deletion,
   relocation, rebalance) or by a fixture path that strips before rebuilding.
4. **Which layer should own the decision?** The layer that already answers "does
   this week satisfy its contract" should also answer "does this week still
   OFFER what its contract declares" — and a shortfall of offers should be a
   repairable finding like any other shortfall, not a silent absence. §18 already
   models exactly this for core conditioning.
5. **What simpler architecture removes representations?** Make the unplaced
   offer VISIBLE to the evaluator, then let the existing repair owner place it —
   rather than teaching each repair path to preserve or re-place a flush:
   - the ledger already carries `optionalFlushCount`; the contract already
     carries `plannerSelectedCount`. Nothing new is stored.
   - an advisory (never blocking — it is an offer) `offer_not_presented` when
     `optionalFlushCount < plannerSelectedCount`.
   - the whole-week repair owner gains ONE placement rule for it, reusing the
     placer's existing eligibility (`flushFixtureSafe`, strength day preferred,
     never a team day), so generation and repair place it the same way.

   That is one owner for "the week presents its offer", reached by every path
   that already runs the repair owner — instead of N paths each remembering.
6. **Which legacy paths retire?** None new. The placement rule moves out of
   `applySection18ConditioningAllocation`'s tail into the shared owner, and
   generation calls the same thing it already calls.
7. **What tests prove the boundary?** `athleteSessionDeletionTests` 15 and 17
   (declared red today) go green with their ORIGINAL signed sentences — no
   "rebalanced Monday" clause, because nothing needs rebalancing. Plus a new
   cell: a fixture MOVE inside a mode that still declares an offer comes back
   still offering one.

## Questions for Sam

1. **Should the offer be REPAIRABLE?** Everything above assumes yes — that
   "the app always presents it" (`docs/FLUSH_OFFER_RULING_2026-08-05.md`) is a
   property of the week, not of the moment it was generated. The alternative
   reading is that the offer is placed once and an athlete edit may cost them
   it; that is buildable and much smaller, but it means an ordinary deletion
   quietly puts the week back out of conformance with Bible `:81`.
2. **Advisory or blocking?** An offer is the athlete's choice, so a missing one
   should not refuse a week. Advisory is proposed. Say if a week that stops
   offering should be repaired but never reported.

## The design was corrected, and Sam should know why

`docs/1B_ONE_OWNER_DERIVATION_DESIGN_2026-08-06.md` specified a **purely
positional** derivation: walk the week's app conditioning in training order,
fill the required floor, then the planner's target, and everything past that is
an offer. It explicitly forbade ordering the walk by content.

That rule was built exactly as written and **is wrong in a second world**, which
the design's single measured world could not show. On a pre-season
practice-match week (`acceptedStateTransactionTests` regression 6):

- the placer puts the offer on Monday's strength day — early in the week;
- positionally, Monday therefore takes a CORE slot;
- the offer's `light` stress then fails the mode's `requiredAppMediumHardMinimum`
  of 2, a BLOCKING `conditioning_intensity_mismatch`;
- the gateway repairs a week that was never broken, and the repair comes back
  with **no hinge lift at all** — a blocking `pattern_restore_failure` two
  layers away from anything about conditioning;
- meanwhile a real Wednesday VO2 session is labelled the athlete's optional
  flush.

Both halves of that are the ruling inverted. The correction keeps everything the
ruling asked for and changes one thing:

> The contract decides HOW MANY offers a week may have. The week's content
> records WHICH session was offered — the placer's mark, honoured and capped by
> the authored allowance, with any surplus falling through to the positional
> rule. No stamped `required_core` / `planner_selected_core` is read by anything;
> that is the field five writers disagreed about, and it still decides nothing.

This is ruling 1's own sentence taken literally — "a function of the contract
**plus the week's content**" — with the mark read as content rather than as a
competing derivation, which it no longer is now that the other writers are
retired.

**The evidence that this is the right cut, and not a convenience:** with the
purely positional rule, four assertions across two pre-existing §18 suites had
to be re-scoped to keep the chain green. With the correction, **every one of
them passes untouched.** A change that makes existing gates move is a change to
justify; a change that leaves them alone is one they already agreed with.

## What IS built, measured and landed

- Ruling 1 — `section18EffectiveWeekEvaluator.buildLedger` derives the role from
  the contract plus the week. `fixtureMinimalReplan`'s duplicated
  `required_core`/`planner_selected_core` rule and its stored-role read are
  retired (it reads the ledger); `postGenerationConstraintValidation`'s
  `?? 'planner_selected_core'` default is retired; the stack merge in
  `canonicalPlanChangeCandidateMaterializer` no longer carries a stale
  conditioning identity onto a day with no conditioning.
- Ruling 2 — a flush does not survive a fixture change. Applied to the whole of
  `buildFixtureMinimalReplan`, including the edit-cost baseline: stripping it
  only from the candidate seed left the offer's day already counted as
  "changed", so the shortfall repair stacked there for free and the bye week's
  Saturday lost its hard conditioning. Both halves were needed.
- The held `fix/1b-flush-offer` work landed on top, never before.
- `phaseStructureConformanceTests` cells 5, 7 and 8 green; all three declared-red
  entries deleted in the same commit.
- `optional_noncore` is now in `Section18ConditioningRole`. The evaluator has
  always counted it and always had a branch for it, reached through an
  `as string` cast because the role was never in the union.
- Stress is NOT derived from the derived role. Doing so was tried and inverts
  Sam's law ("intensity must never feed identity") — a genuinely hard session
  past the week's core capacity had its stress rewritten to `light`, and six
  hard days stopped breaching the mode's hard-day maximum.
