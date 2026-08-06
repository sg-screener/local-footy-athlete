# QUEUE ENTRY — an all-optional week selects optional strength and, under a restriction, offers none

Filed 2026-08-06 out of finding 3's step 2, which ruled it **ADJACENT and out of
scope**. Recorded here so it is not folded into a unit it does not belong to, and
not lost.

**It has no LR id, deliberately.** The live ledger is at 30 of 30 and 30 is the
RATIFIED ceiling (Sam, 2026-08-05, `DAY_CLOSE_RULINGS_2026-08-05.md` ruling 1).
Following this census's own precedent for the D-2 hydration branch — *"a
thirty-first unit needs Sam's word, not a bump taken while filing"* — this waits
for either an id or an existing unit's scope. It does not map cleanly onto a
current unit's subject, so assigning it is a review-seat call, not a filing
decision.

## The measurement

Early off-season (`:110`, all-optional), 6 preferred days, full gym, 2–5 years.
Differential matrix scenarios, pinned clock `2026-07-13`,
`mainStrengthExposures` in week 1:

| scenario | early off-season `mainStrengthExposures` |
|---|---|
| `offseason-early-solo` (healthy) | **3** |
| `offseason-severe-restriction`, before finding 3's step 2 | **1** |
| `offseason-severe-restriction`, after finding 3's step 2 | **0** |

Both worlds carry the SAME contract intent:

```
mainStrength.exposure = { requiredMinimum: 0, defaultTarget: 0, plannerSelectedTarget: 0,
                          plannerSelectionKind: 'optional', preferredRange: {min:2,max:3} }
optionalMainStrengthSelected = 3
requiredSafePatterns = ['push','pull']   prohibited = ['squat','hinge']
```

So the week SELECTS three optional main-strength sessions and its safe patterns
are push and pull — both entirely available — and it places none of them. The
restricted week's shape is:

```
Mon Conditioning/optional   Tue Strength/optional   Wed Conditioning/optional
Thu Recovery/optional       Fri Recovery/recovery   Sat Recovery/optional
```

Tuesday's session carries `[trunk_support, strength_accessory, strength_accessory]`
— accessories only, no main lift, with push and pull both safe.

## Why it is NOT finding 3's defect

Finding 3 is about a restricted week HOLDING its main-strength FREQUENCY. Early
off-season's frequency is **zero by mode**: `requiredMinimum: 0`,
`plannerSelectedTarget: 0`, `unresolvedMinimumShortfall: 0`,
`unresolvedPlannerSelectedShortfall: null`. Nothing is owed, so there is no
frequency to hold and nothing for `:4755` to bite on.

The `3 -> 1` half is **pre-existing** and predates step 2 entirely. Step 2's
`1 -> 0` is a separate, understood consequence
(`FINDING_3_PLACEMENT_REASSESSMENT_2026-08-06.md` and step 2's boundary report):
the `1` was manufactured by `section18SafetyFinaliser`'s frequency-ceiling
consolidation pass, and removing the wrongly-authored ceiling removed the pass.

## The question for the review seat

`:72` "continue to do work on unaffected areas" and `:93` "get as much work as
you can in around the injury" argue that a restricted athlete offered an
all-optional week should still be OFFERED safe upper strength — push and pull are
untouched by a hamstring. `:110` says the week requires nothing, which is about
requirement, not about what is offered.

So: **when an all-optional week selects N optional main-strength sessions and a
restriction removes some patterns, should it offer N sessions built from the safe
patterns, or may it offer none?** The healthy control offers 3; the restricted
week offers 0 while declaring the same selection. If the answer is "N from the
safe patterns", the owner is the all-optional/`:110` selection path, not the
safety policy.

## What must NOT be done to close it

Reinstating any frequency ceiling to make the consolidation pass author strength
again. That pass adds main lifts as a side effect of a CAP, which is a reduction
inventing exposure — the shape Sam's intensity-never-feeds-identity law forbids.
Whatever offers the work must offer it because the week selected it.
