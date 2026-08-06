# FINDING 3 — matrix coverage gate, predictions BEFORE regeneration

Step 1 of the approved build order
(`docs/FINDING_3_PLACEMENT_REASSESSMENT_APPROVAL_2026-08-06.md`): the
restricting-injury scenario joins the differential matrix FIRST, so the unit
that follows has a baseline to move. **Written before `--write` was run.**

## Why the matrix cannot see this unit today — MEASURED, not reasoned

Both matrices' only injured scenario is `offseason-lower-niggle`, a **Mild**
profile injury. Measured against the healthy control on the unfixed tree, under
the matrix's own profile and pinned clock (`2026-07-13`):

| field | control `offseason-early-solo` | `offseason-lower-niggle` (Mild) |
|---|---|---|
| `v2 prohibitedPatterns` | `[]` | `[]` |
| `v2 requiredSafePatterns` (mid) | `["squat","hinge","push","pull"]` | `["squat","hinge","push","pull"]` |
| v1 reductions | none | none |
| mid-off-season week shape | `Mon Mixed / Tue Str(opt) / Wed Str / Thu Rec / Fri Mixed / Sat Mixed` | identical |

**Every field identical.** `resolveRestrictedMainStrengthPatterns` restricts
profile injuries only at `Severe` (`weeklyExposureContractBuilders.ts:257`), so
Mild reaches neither fix site. The scenario named "injury" in the matrix is,
for this unit, a second copy of the healthy control.

## The new scenario, and proof it reaches BOTH sites

`offseason-severe-restriction` — base profile (6 days Mon–Sat, full gym, 2–5
years, Elite conditioning), one **Severe** hamstring injury, default phase
entry, so weeks 1–2 land `early_offseason` and weeks 3–4 `mid_offseason` — the
§4 repro's own shape.

Measured on the unfixed tree, mid-off-season weeks:

| site | the rule it states | evidence in the new baseline |
|---|---|---|
| 2 — `weeklyExposureContractBuilders:320` | `strength.targetCount → min(target, allowed.length)` | v1 reduction **`main_strength/weekly_exposure_count:3->2:injury_restriction`**, v1 `strength target=2` |
| 1 — `section18SafetyPolicy:277` | `main_strength_frequency → min(selected, requiredSafe.length)` | v2 authorised reduction **`main_strength_frequency:3->2:injury_restriction`** |

Both caps are visible in the baseline, which is the coverage gate's actual job:
§1 of the measurement doc found the hard way that paying one site alone leaves
the world unchanged. `prohibitedPatterns=["squat","hinge"]`, provenance
`profile_injury`.

**Appended LAST in `STAGE_B_SCENARIOS`, deliberately.** The golden's
`scenarios` array follows declaration order, so appending keeps the golden diff
purely ADDITIVE — every existing scenario stays at its index and its bytes stay
on the same lines. Inserting beside `offseason-lower-niggle` would read tidier
in `scenarios.ts` and would shift every later scenario's byte position,
destroying exactly the property this gate needs to prove.

## Predictions — the golden

1. `scenarios` gains **exactly one** element, `offseason-severe-restriction`,
   at the END. Every existing element byte-identical, same index.
2. `modesReached` **UNCHANGED**. The scenario reaches `early_offseason` and
   `mid_offseason`; both are already in the census.
3. `formatVersion` and `todayISO` unchanged.
4. `test:stage-b-generation-differential` REDS on "current generation output
   matches the committed baseline byte for byte" and is regenerated with
   `--write` **in this same commit**. The determinism check must stay green —
   two runs byte-identical — or the scenario is not differentially testable and
   this stops.
5. `powerCountingDifferential`'s golden **UNCHANGED**: separate scenario file,
   untouched.
6. Every other bible suite unchanged. This commit adds a scenario and a golden;
   it changes no production code.

## Predictions — the new scenario's baseline CONTENT

### CORRECTED AFTER MEASURING THE REGENERATED GOLDEN

The predictions above (golden structure) were all confirmed. This section's
first draft named the wrong WITNESS and is corrected here rather than
rewritten, because which field pins the fact is the whole point of a coverage
gate.

**What was wrong.** The draft said the two caps would be visible in the
baseline as the reduction entries `main_strength/weekly_exposure_count:3->2`
and `main_strength_frequency:3->2`. They are not: the snapshot records **no
reduction entries at all** (`'reduction'`, `'requiredSafe'`,
`'injury_restriction'` all absent from the scenario's serialisation). Those
strings came from the instrumented probe, not from the golden. The draft also
said §18 would read `accepted` in the `early_offseason` weeks; the snapshot
reports the GATEWAY's status, which is `repaired` there — the earlier figure
came from `evaluateEffectiveWeekExposureContract`, a different evaluator.

**What the golden actually witnesses**, measured, and it is sufficient:

| scenario | wk | mode | req | selected | achieved | §18 | strength exposures | cond | rec |
|---|---|---|---|---|---|---|---|---|---|
| `offseason-early-solo` | 3 | mid | 3 | 4 | 4 | accepted | 4 | 3 | 1 |
| `offseason-lower-niggle` | 3 | mid | 3 | 4 | 4 | accepted | 4 | 3 | 1 |
| **`offseason-severe-restriction`** | 3 | mid | **2** | **2** | **2** | accepted | **2** | **4** | 1 |
| `offseason-severe-restriction` | 4 | mid | 2 | 2 | 2 | accepted | 2 | 3 | 1 |

Both caps ARE pinned, through the projected policy rather than through stored
entries: `requiredMinimum` 3→2 is site 1's `main_strength_frequency` reduction
after `applyReductionProjections`, and `plannerSelectedTarget` 4→2 is site 2's
`targetCount` cap. And the control and the Mild niggle are **identical on every
column** — the coverage gap the reassessment asserted is now witnessed by the
golden itself, not just by a probe.

Week 3's `conditioningExposures=4` against the control's 3 is cause A's
precondition — the surplus allocation — visible in the baseline. Week 4 reads 3;
that asymmetry is recorded, not explained.

That acceptance is the defect, not the reassurance: the week fits because the
cap took two strength sessions away. The same "fit by accident" §4 named, now
pinned where the fix must be seen to move it.

### The limit of this gate, stated

`visibleCounts` has no full-rest-day count, so the golden **cannot** witness
`full_rest` directly — the very metric the defect breaches. It witnesses it
only indirectly, through `section18.status` (a week that loses a required rest
day stops being `accepted`).

Adding `fullRestDays` to `visibleCounts` would fix that and is deliberately NOT
done here: it changes the snapshot SHAPE, which regenerates every week of all
15 scenarios and destroys the purely-additive property proved above — and step 1
of the approved order authorises a scenario, not a shape change. The direct
budget assertion is boundary test 1's job, on the LEDGER. Recorded as a
candidate for whoever next has reason to move the snapshot shape.

## Prediction — what step 2 will move, and nothing else

Recorded now, checked then. In the two `mid_offseason` weeks of
`offseason-severe-restriction`:

- `mainStrengthExposure.requiredMinimum` **2 → 3** and
  `plannerSelectedTarget` **2 → 4** — the frequency reduction disappears, so the
  projection stops lowering the policy.
- `achievedCount` and `visibleCounts.mainStrengthExposures` **2 → 4**.
- `section18.status` stays **`accepted`**. If it becomes `refused` the unit is
  half-built: that is precisely the §4 red, and it means the placement half did
  not land.
- The strength work lands ATTACH-FIRST on Mon/Wed/Fri/Sat with Tue/Thu free.
- `strength_pattern_count` stays reduced — the ruling keeps that half — which
  the golden shows indirectly as balance across push/pull only.
- The two `early_offseason` weeks must **NOT** move: strength target is 0, so
  there is no frequency to hold. Movement there is unpredicted and stops the
  unit.
- No other scenario moves. In particular `offseason-lower-niggle` must stay
  byte-identical: a Mild injury reaches neither site, so a diff there would mean
  the unit changed the unrestricted path.

Unpredicted movement in any other scenario is a STOP, per the harness's own
instruction.

## CORRECTED AFTER DIAGNOSIS — two movements the predictions above got wrong

Both were STOPPED on rather than regenerated through, diagnosed by bisection, and
are corrected here WITH their mechanisms. Neither is rewritten silently: the
original predictions stand above, wrong, and these are the corrections.

### Correction A — `early_offseason` DOES move, and it is correct

Predicted: "the two `early_offseason` weeks must NOT move". Measured:
`mainStrengthExposures 1 -> 0` in both.

**Mechanism, established by bisection.** Not the budget, not attach-first, not
the flush declaration — all four combinations of those give 0. Restoring the old
frequency cap restores the 1. The consumer is
`section18SafetyFinaliser.ts:415-470`: when
`safety.mainStrengthFrequencyCeiling !== null`, the finaliser runs a
CONSOLIDATION pass that, for every pattern in `requiredSafePatterns` not already
represented, **clones a main-strength row onto a kept session** (falling back to
`safePatternFallbackRow` when no source row exists). With the old cap the
restricted early-off-season week had a ceiling of 2 and
`requiredSafePatterns = ['push','pull']`, so the pass manufactured two main lifts
on Tuesday:

```
old cap ON :  Tue rows = [main_strength/pull, main_strength/push, trunk_support, strength_accessory, strength_accessory]
old cap OFF:  Tue rows = [trunk_support, strength_accessory, strength_accessory]
```

**Direction, judged against the laws.** `:110` — the week is all-optional and
its contract requires and selects zero main strength (`requiredMinimum: 0`,
`plannerSelectedTarget: 0`, `unresolvedMinimumShortfall: 0`,
`unresolvedPlannerSelectedShortfall: null`, `maximumBreach: 0`). `:72`/`:93`
speak to keeping work in when work exists; this work never existed in the plan —
it was authored by a pass whose job is to CAP frequency. A cap that adds main
lifts is a reduction inventing exposure, which is the shape Sam's
intensity-never-feeds-identity law forbids.

So `1 -> 0` is **a correct consequence of the corrected gate**: a week that
requires and selects zero main strength no longer has a classification
manufactured for it by a ceiling that should never have been authored. The week's
shape is byte-identical in both worlds — Tuesday is still shown, still a Strength
session, still optional.

The adjacent question this exposes — an all-optional week SELECTS three optional
main-strength sessions and under a restriction offers none, where the healthy
control offers three — is ruled out of this unit's scope and filed as its own
queue entry (`docs/QUEUE_ALL_OPTIONAL_RESTRICTED_STRENGTH_OFFER_2026-08-06.md`,
pointed at from the legacy-reckoning census). It is pre-existing: the healthy-to-
restricted collapse was 3 -> 1 before this unit touched anything.

### Correction C — the POWER-COUNTING golden moves too, same cause

Step 1's prediction 5 said `powerCountingDifferential`'s golden would be
UNCHANGED because it is a separate scenario file. Wrong: it carries
**`preseason-team-and-game` as well** (scenario index 6), so the very movement
corrected in B below is visible in both goldens. Measured diff:

```
scenarios.6.weeks.0.days.2.name         "Tempo Intervals" → "Lower Squat"
scenarios.6.weeks.0.days.2.workoutType  "Conditioning"    → "Mixed"
scenarios.6.weeks.0.counts.hardDays     2 → 3
scenarios.6.weeks.0.counts.byCategory   lower_strength 1→2, upper_strength 2→1, prehab +1
```

Same world, same mechanism, already diagnosed and ruled correct in B:
`hardPreferred=4`, `hardPermitted=5`, `isHardMaximum=false`, rest quota untouched,
zero findings, and `section18.status` unchanged at `repaired`. Regenerated on that
basis, not re-derived.

**The lesson, which is the reusable part:** "separate scenario file" is not
evidence of "separate coverage". Two matrices sharing a scenario id share its
movements, and the prediction assumed independence it never checked. Next time,
grep the scenario id across both matrices before predicting either.

### Correction B — `preseason-team-and-game` moves, and it is correct

Predicted: "no other scenario moves". Measured: `hardExposures`/`hardDays 3 -> 4`
in wk1 and wk4, plus `recoverySessions 0 -> 1` in wk4.

**Mechanism, established by bisection.** Attach-first is the sole cause; the
budget makes no difference in either direction (budget ON/OFF × attach-first
ON/OFF gives 4/4/3/3). Wednesday already carried tempo conditioning, and
attach-first put the missing strength THERE rather than elsewhere, making it
`Mixed`:

```
attach-first OFF:  Mon:Mixed/aerobic_base Tue:Team Wed:Conditioning/tempo Thu:Strength Fri:Strength Sat:Game
attach-first ON :  Mon:Mixed/aerobic_base Tue:Team Wed:Mixed/tempo        Thu:Strength Fri:Strength Sat:Game
```

**Direction.** The same six days are occupied either way, `restAchieved` equals
`fullRestRequired` (1) in both, and the strength count is 3 in both. The week
moves to `hardDays = 4`, which is the contract's own **preferred** count
(`hardPreferred=4`), one below its permitted maximum (`hardPermitted=5`), with
`isHardMaximum=false` and `hardFindings=[]` — no `hard_day_limit_exceeded`, no
findings at all. The week became denser on a day it was already using, which is
what attach-first is for and the shape Bible `:81` authors.

**Ruling application.** The review seat ruled in advance that IF the budget were
trading a full-rest breach for a hard-day breach, the fix would be one budget
object carrying rest days AND hard days together as construction inputs. That
condition is **not satisfied**, on two independent measurements: the budget is
causally uninvolved, and there is no breach to trade into. So the redesign is not
triggered by this evidence and is not built. The ruling stands for the future: if
a later world shows either mechanism pushing a week past
`hardDays.permittedCount`, the shape is already decided and needs no further
sign-off.
