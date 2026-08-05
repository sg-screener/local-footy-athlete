# FINDING 3 — the ruled fix, built and measured, and why it is not landing yet

The ruling (`docs/FINDING_3_RULING_2026-08-06.md`) was built, measured at every
site that states the rule, and **reverted**. Not because it is wrong — cells 10
and 11 prove it is right — but because it is not sufficient on its own, and
what it needs next is a different layer that CLAUDE.md's escalation rule says
to reassess before touching.

No production code rides with this document. Cell 10 stays declared red, with
its declaration re-pointed here.

## 1. The finding doc named ONE expression. There are TWO.

`FINDING_3_SUBSTITUTE_BEFORE_REDUCE_2026-08-06.md` §"The root cause, one line"
names `section18SafetyPolicy`. Paying that alone left cell 10 red at **exactly
the same `6 → 5`** — measured, not reasoned.

| | site | what it capped |
|---|---|---|
| 1 | `section18SafetyPolicy.ts` (Contract v2 policy) | `main_strength_frequency` → `min(selected, requiredSafe.length)` |
| 2 | `weeklyExposureContractBuilders.ts:320` (v1 allocation) | `strength.targetCount` → `min(targetCount, allowed.length)` |

Site 2 was the one governing cell 10's world. Both were changed to reduce only
when NO safe pattern remains. Cell 10 then greened.

*One owner is proven by enumerating the SHAPES that reach the rule, never by
the owner existing* — the same lesson as `owner-unreachable-by-shape`, in its
rule form rather than its call-site form.

## 2. What the fix produces — it works, and it works well

Generation with a restricting hamstring, against the healthy control:

| phase | before | after |
|---|---|---|
| pre-season | 6 sessions, 2 strength | 6 sessions, **4 strength** — 2 push + 2 pull, balanced |
| in-season | 5 sessions, 2 strength | 5 sessions, **3 strength** — 1 pull + 2 push |

Both hold their frequency, fill the freed days with safe work, and sit inside
`permittedCountDifference`. This is `:4755` doing what it says.

## 3. Both new cells are load-bearing, proven by mutation

Cell 10's original session-count assertion was **weaker than the ruling**:
reverting site 1 alone left it green, because a capped day keeps a workout and
merely stops carrying main strength. Cell 10 now also asserts that main-strength
FREQUENCY is not reduced while a safe pattern remains.

| mutant | cell 10 | cell 11 |
|---|---|---|
| A — site 1 restored to the pattern-count cap | **FAIL** | PASS |
| B — the whole-body branch deleted entirely | PASS | **FAIL** |

Mutant B's dump identified cell 11's owner by its detail string: it is site 2's
`allowed.length === 0` branch. Site 1's matching branch is NOT independently
pinned by this suite — stated, not implied.

Cell 11 passes on the reverted tree too, which is the point of it: it pins the
half of the ruling that must not regress when the other half lands.

## 4. WHY IT IS NOT LANDING — the reduction was masking a placement defect

With the rule changed, the first bible suite reds:

```
injury-restricted final week:
  [{"code":"required_exposure_shortfall","domain":"full_rest","expected":2,"actual":1}]
  yearRoundExposureConformance.ts:512
```

Repro (`profile()` = off-season, 6 preferred days Mon–Sat, active hamstring
7/10, `todayISO: 2026-07-13`), weeks 3 and 4:

```
HEALTHY (accepted)                      INJURED, after the fix (REFUSED)
  Sun —                    rest           Sun —                    rest
  Mon Mixed  Upper Push                   Mon Mixed  Upper Push
  Tue Strength Prehab (opt)               Tue Strength Upper Push
  Wed Strength Lower Hinge                Wed Mixed  Upper Pull
  Thu Recovery Mobility    rest           Thu Strength Upper Pull
  Fri Mixed  Upper Pull                   Fri Conditioning Tempo Intervals
  Sat Mixed  Lower Squat                  Sat Conditioning Aerobic Flush
  5 working days, 2 full rest             6 working days, 1 full rest
```

**The two contracts are identical**: strength target 4 / required 3,
conditioning target 3 / required 3, `fullRest` required 2. That is exactly what
the ruling asks for — the injured week's demand is now the healthy week's
demand.

The healthy week places that demand in five working days by STACKING
conditioning onto strength days (three `Mixed`). The injured week stacks only
two, puts two conditioning exposures on bare days, and spends the rest day. §18
then refuses the week outright — in the app that is a throw, not a shortfall
note.

So the pattern-count cap was not only wrong, it was **load-bearing for the
wrong reason**: by taking two strength sessions away it left the placer enough
bare days that it never had to stack, and the week fit by accident. Removing it
exposes an owner that was never being asked the hard question.

This is the shape Sam named: *a gate passing on coordinates it never builds*.

## 5. The escalation call

CLAUDE.md: stop when "the AI/semantic layer understands the user correctly, but
a later layer changes, blocks, downgrades, or reinterprets that intent", and do
not add another resolver, guard or fallback before a reassessment is approved.

That is this exactly. The contract now states the right demand and a later
layer cannot place it. The tempting moves are all the forbidden ones — cap the
frequency by available days (re-installs the defect under a new name), special-
case the injured branch in the placer, or reduce conditioning to make room.

**Not built. Reassessment owed, and it is small and well-posed:**

1. Who owns the week's WORKING-DAY BUDGET — the number of days the demand may
   occupy given `fullRest.required`? Today nothing appears to; the healthy week
   satisfies it as a by-product of stacking.
2. What decides whether a conditioning exposure stacks onto a strength day
   (`Mixed`) or takes a bare day? Why does that decision differ between two
   weeks with identical contracts?
3. Is the 4th conditioning exposure on the injured Saturday the always-present
   optional flush offer from 1b (`022e1495`)? If so this is a live interaction
   between two correct mechanisms: 1b's offer is placed unconditionally, and
   finding 3 removes the bare day it was quietly relying on.
4. Should `:4688` step 3 — "move or remove lower-priority optional work to
   recover space" — be reachable here at all? It is the authored answer to this
   exact situation and nothing appears to invoke it.
5. Which layer should own it, so the fix removes a representation rather than
   adding a guard?

Question 3 is the one to measure first; it is cheap and it would explain the
whole diff.

## 6. What is committed

- cell 11 (whole-body), green on the reverted tree — the must-not-regress half
- cell 10 strengthened to state the ruling, still declared red, matcher unchanged
- the declared-red entry RETAINED and re-pointed at this document

## 7. What the goldens did

Nothing, and deliberately: **no golden was regenerated.** Both differential
matrices carry one injured scenario (`offseason-lower-niggle`) authored as a
**Mild** profile injury, and `resolveRestrictedMainStrengthPatterns` restricts
profile injuries only at `Severe` — so neither site is reached and neither
golden moves.

That is a coverage gap worth stating plainly: **the generation goldens cannot
see this unit at all.** A restricting-injury scenario belongs in the matrix
before the fix lands, or the golden will keep certifying a week the fix never
touched.
