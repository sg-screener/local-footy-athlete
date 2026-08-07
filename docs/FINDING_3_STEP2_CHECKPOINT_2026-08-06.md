# FINDING 3 STEP 2 — CHECKPOINT 2: movement 2 explained, movement 1 not

Supersedes checkpoint 1. Still **uncommitted**, still not regenerating the
golden, because one of the two movements is explained with evidence and the
other is only localised. Diagnosis ran in the checkpoint's order.

Suites green on the current tree: `runSlice1` `TRUE_EXIT=0` / 0 FAILs,
`phase-structure` 11/11 (cells 10 and 11 both pass), `section18-safety` 34/34.

## Method — bisection by toggle, in one tree

Rather than switch trees, each change was put behind a temporary env toggle so
one variable could move at a time: `LFA_NO_BUDGET`, `LFA_NO_ATTACH_FIRST`,
`LFA_OLD_FREQ_CAP`, `LFA_OLD_FLUSH_DECL`. **All toggles have been removed** —
`grep -c 'process.env.LFA'` is 0 in all three production files.

## MOVEMENT 2 — EXPLAINED. A correct consequence, and the ruling's condition is NOT met.

`preseason-team-and-game` wk1/wk4, `hardExposures`/`hardDays 3 -> 4`.

**The budget is not involved.** Four-way bisection on wk1:

| | budget | attach-first | hardDays |
|---|---|---|---|
| A | ON | ON | **4** |
| B | OFF | ON | **4** |
| C | ON | OFF | 3 |
| D | OFF | OFF | 3 |

Attach-first is the sole cause; the budget makes no difference in either
direction. **My checkpoint-1 hypothesis — "the budget is trading a full-rest
breach for a hard-day breach" — is REFUTED.**

**And there is no breach to trade.** Measured on the same week:

```
hardPreferred=4  hardPermitted=5  isHardMaximum=false
fullRestRequired=1  restAchieved=1        (identical in BOTH worlds)
hardFindings=[]                            (no hard_day_limit_exceeded, no findings at all)

attach-first OFF:  Mon:Mixed/aerobic_base Tue:Team Wed:Conditioning/tempo Thu:Strength Fri:Strength Sat:Game
attach-first ON:   Mon:Mixed/aerobic_base Tue:Team Wed:Mixed/tempo        Thu:Strength Fri:Strength Sat:Game
```

The same six days are occupied either way, `restAchieved` equals
`fullRestRequired` in both, and the strength count is 3 in both. The single
difference is Wednesday: it already carried tempo conditioning, and attach-first
put the missing work THERE instead of elsewhere, making it `Mixed`. The week
moves from 3 hard days to 4 — which is the contract's own **preferred** count,
one below its permitted maximum of 5, with `isHardMaximum=false`.

So the week did not lose rest and did not exceed a maximum; it became denser on a
day it was already using, which is what attach-first is for and the shape Bible
`:81` authors. **Recorded as a correct consequence.**

### Ruling application

The review seat ruled in advance: *IF* diagnosis confirms the budget is trading a
full-rest breach for a hard-day breach, the correct shape is one budget object
carrying rest days AND hard days together as construction inputs.

**The condition is not satisfied, on two independent measurements:** the budget
is causally uninvolved (bisection A/B vs C/D), and there is no hard-day breach to
trade into (4 ≤ permitted 5, zero findings, rest quota untouched). So the
one-budget-object redesign is **not triggered by this evidence** and is not built.
That is the ruling applied, not the ruling declined — and it is worth noting the
ruling remains correct in principle: nothing here shows the boundaries should
stay separate, only that this week does not demonstrate the conflict. If a later
world DOES show attach-first or the budget pushing a week past
`hardDays.permittedCount`, the ruled shape is already decided and needs no
further sign-off.

## MOVEMENT 1 — LOCALISED, NOT EXPLAINED. Do not regenerate.

`offseason-severe-restriction` wk1/wk2 (`early_offseason`),
`mainStrengthExposures 1 -> 0`.

Bisection: **not** the budget, **not** attach-first, **not** the flush
declaration — all four combinations give `str=0`. Restoring the OLD frequency cap
(`LFA_OLD_FREQ_CAP`) restores `str=1`. So the cause is the ruled fix itself.

### A real defect was found on the way, and is FIXED

The first implementation gated site 1 on `requiredSafe.length === 0`.
`weeklyExposureContractV2` builds `requiredSafePatterns` as
`policy.balance && policy.strength.required > 0 ? … : []`, so **an all-optional
early off-season week has no required safe patterns for reasons that have nothing
to do with safety.** The condition read that mode fact as a whole-body
restriction. Corrected to `availableSafePatterns.length === 0` — is ANY main
pattern safe — which is the question the ruling asks. Cell 11 still passes, so
the whole-body half is intact.

Keep this fix regardless of what movement 1 turns out to be: it was a mode fact
being read as a safety fact, one condition away from shipping inside the commit
that fixes the same class of error.

### What is still unknown

The correction did **not** restore the exposure — `str` is still 0. So the
mechanism is: *the mere presence of the old `main_strength_frequency` ceiling of 2
caused one strength exposure to exist in a week whose contract selects zero.*
The obvious explanation is `applyReductionProjections`'s
`plannerSelectedTarget === null ? ceiling : min(…)` raising a null target to the
ceiling — **and that is refuted by measurement**: the pre-fix contract printed
`mainStrength.exposure req=0 plannerSelected=0`, not null, so `min(0, 2) = 0` and
the projection changed nothing. **I do not have the mechanism.**

### The coaching question underneath it, which is NOT finding 3's scope

Judged against the 1a control (`:110`, early off-season stays all-optional), as
instructed:

| scenario | early off-season `mainStrengthExposures` |
|---|---|
| `offseason-early-solo` (healthy) | **3** |
| `offseason-severe-restriction`, pre-fix | **1** |
| `offseason-severe-restriction`, post-fix | **0** |

The contract requires 0 and selects 0, so 0 satisfies it exactly and the week
still SHOWS its Tuesday strength session (`Tue:Strength` in every world — the
shape is byte-identical, only the classification moved). On that reading 0 is
correct and the 1 was surplus.

But 3 → 1 → 0 against a healthy control is the direction Bible `:72`/`:93` argue
against, and the 3 → 1 half is **pre-existing**, not caused by this unit. Whether
an all-optional week should offer restriction-safe upper strength is a real
question and it is ADJACENT to finding 3, not inside it: finding 3 is about a
week HOLDING its frequency, and early off-season's frequency is zero by mode.

**So the prediction is not corrected yet.** Correcting it needs the mechanism,
and rewriting it without one would be exactly the silent rewrite the instruction
forbids.

## Next actions

1. Establish movement 1's mechanism. Instrument the early-off-season path with
   and without the old ceiling and find what actually consumes
   `main_strength_frequency` there — candidates not yet excluded: the
   optional-only branch of `applySection18ConditioningAllocation`, the
   optional-strength selection in `resolveSection18PhasePlannerSelection`, and
   `restoreMissingPlanPatterns` during canonicalisation. Bisect, do not reason.
2. With the mechanism in hand, decide whether 0 is correct (record the corrected
   prediction WITH the evidence) or a defect (fix it, and it likely belongs to
   the all-optional/`:110` owner rather than to finding 3).
3. Then, and only then: regenerate the golden with both movements recorded as
   predictions, full `test:bible` off the printed exit line, branch verified,
   commit.
4. Step 3 (the four boundary tests, mutation-checked) is untouched and still owed.

## Gates

- Branch `feat/stage-b-stage2`; HEAD `7c83ec51` (step 1), which passed full
  `test:bible` `TRUE_EXIT=0`.
- Golden deliberately at its step-1 state, so
  `test:stage-b-generation-differential` is RED in the tree. That red is the
  correct signal that the unit is unfinished.
- The working tree has NOT had a full `test:bible` run and must not be committed
  until movement 1 is explained.
