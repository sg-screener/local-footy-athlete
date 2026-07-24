# Rider 0 — did A3b's authority reach the §18 gate, or did the gate ignore it?

**Status: EVIDENCE COMPLETE. STOP per M8 — the evidence diverges from the
approved reassessment.** No implementation code written.

**Scope.** Rider 0 on the approved
`docs/DURABLE_ATHLETE_STATE_FACT_OWNERSHIP_REASSESSMENT_2026-07-24.md`:
settle, before any code, whether the `injury_restriction` authorised reductions
were present in the contract at evaluation time. The reassessment posed this as
a binary (§1c, and NOT-COVERED bullet 2):

> If they were, the gate ignored an authorised reduction. If they were not, the
> authority never reached the gate at all. These are different fixes.

**The answer is neither.** The authority reached the gate and the gate honoured
every reduction it was given. The reductions were *authored incompletely*, by
the same owner that withdrew the credit they were supposed to cover.

---

## 1. Method

Probe: `src/__tests__/rider0InjuryAuthorityProbe.ts` (session scratch,
untracked). Seeds `spent-week-friday` device-exact (`seedOnboardingProgram` +
`preserveExactAcceptedWorkouts` commits, fixture mark published through the
accepted-state boundary exactly as `defaultDevE2ESeedCoordinator` does), patches
`evaluateSection18EffectiveWeek` to record the contract it was **actually
handed** on every call, then runs the exact action `handleApplyGuidedInjury`
commits (`useHomeScreen.ts:1569-1581`).

One fresh process per cell (the epoch-0 re-seed artifact is avoided, not masked).
Today Friday 2026-07-24, week starting 2026-07-20.

---

## 2. The reductions were present, and were honoured

Upper-body 8/10, at the rejecting evaluation:

```
prohibitedPatterns:  ["push","pull"]          ← region scoping SURVIVED
requiredSafe:        ["squat","hinge"]        ← safe patterns preserved
authorisedReductions: strength_pattern_count<=2   (injury_restriction/pattern)
                      main_strength_frequency<=2  (injury_restriction/week)
requiredMinimums:    main>=2  cond>=3  sprint>=1
blocking:  required_minimum_shortfall:main_strength(exp=2,act=1)
           required_minimum_shortfall:conditioning(exp=3,act=0)
           required_minimum_shortfall:sprint_high_speed(exp=1,act=0)
```

The `injury_restriction` reductions are in the contract the evaluator received.
The gate did not ignore them.

**The lower-body contrast proves the gate honours what it is given.** For a
lower-body 7 or 9, `applyGenerationSafetyToSection18Contract` *does* author a
sprint reduction (`section18SafetyPolicy.ts:224-231`), and the sprint minimum
correctly drops to 0 — the sprint shortfall disappears:

```
authorisedReductions: … sprint_high_speed_frequency<=0 (injury_restriction/week)
requiredMinimums:    main>=2  cond>=3  sprint>=0      ← sprint honoured
blocking:            required_minimum_shortfall:conditioning(exp=3,act=0)
```

Where a reduction is authored, the gate applies it. Where credit is withdrawn
without one, the gate rejects. That is correct gate behaviour on an
unsatisfiable contract.

## 3. Root cause — credit withdrawal and reduction authoring are not one decision

On this seed the athlete has **no app-authored conditioning and no app-authored
sprint**. All 3 conditioning exposures and all 3 sprint exposures are *anchor
credit* from two team trainings and the Saturday game:

```
healthy:  cond=3 [app=0 anchor=3]   sprint=3
          anchors: team@2 normal_unrestricted[cond=true sprint=true]
                   team@4 normal_unrestricted[cond=true sprint=true]
                   game@6 normal_unrestricted[cond=true sprint=true]
```

Any prohibited main-strength pattern sets `hasFieldRestriction`
(`section18SafetyPolicy.ts:199-204`), which demotes **every** anchor to
`modified`, which zeroes `currentProductionClaim.conditioning` and
`.sprintHighSpeed`:

```
injured:  cond=0 [app=0 anchor=0]   sprint=0
          anchors: team@2 modified[cond=false sprint=false]
                   team@4 modified[cond=false sprint=false]
                   game@6 modified[cond=false sprint=false]
```

The same function then authors reductions for `strength_pattern_count`,
`main_strength_frequency`, and — **lower-body only** — `sprint_high_speed_frequency`.
It **never** authors a conditioning reduction, in any branch, for any injury.

So the contract handed to the gate says, simultaneously, *"these anchors no
longer produce conditioning"* and *"this week must contain 3 conditioning
exposures"*. It is arithmetically unsatisfiable before the gate runs. Because
the fact and the week commit in one transaction, the unsatisfiable week takes
the athlete's injury report down with it.

**One-line statement of the defect:** withdrawing production credit and
authorising the matching typed reduction are the same decision, made in two
disconnected places by one owner, and for conditioning the second half is
missing entirely.

---

## 4. Three divergences from the approved reassessment

### 4a. The binary is false (§1c, NOT-COVERED bullet 2)

Neither "never reached the gate" nor "gate ignored it". Third answer: reached,
honoured, authored incompletely. This changes what Stage 2 builds — see §5.

### 4b. The named plausible path is ELIMINATED (§1c, Q3 step 5, Q6)

The reassessment flagged `safeFocusFor(region, serious)`
(`guidedInjuryControl.ts:181-188`) collapsing region-scoped safe work to
"Stop affected training" as a plausible contributing path, and Q6 proposed
retiring that branch.

It is not the trigger, on two independent grounds:

1. **Region scoping survived to the contract.** `prohibitedPatterns` is exactly
   `["push","pull"]`; `requiredSafe` is exactly `["squat","hinge"]`. Nothing was
   flattened to a whole-week pause. `safeFocus` and `rules` are display copy on
   the constraint and reach no contract field.
2. **Severity 7 fails identically and never takes the serious branch.**
   `trainingPaused` is false at 7, so `safeFocusFor` returns the region-scoped
   list — and the commit is rejected anyway.

**Q6's "retire the `safeFocusFor` collapse" is unmotivated by evidence and
should be dropped from scope** unless it is re-justified as a copy fix.

### 4c. The blast radius is much wider than diagnosed

The reassessment and the L10 diagnosis both scope A3b to the 8-10 *paused* band,
and leave severity 5 explicitly "unestablished" (T9 exists to close it). Closed
now, in fresh processes:

| region | severity | prohibited patterns | reductions authored | commit | fact recorded |
|---|---|---|---|---|---|
| upper | 2 | — | — | ok | **yes** |
| upper | 5 | — | — | ok | **yes** |
| upper | **7** | `push` | pattern≤3, main≤3 | **REJECTED** | **no** |
| upper | **9** | `push`,`pull` | pattern≤2, main≤2 | **REJECTED** | **no** |
| lower | 5 | — | — | ok | **yes** |
| lower | **7** | `squat`,`hinge` | pattern≤2, main≤2, sprint≤0 | **REJECTED** | **no** |
| lower | **9** | `squat`,`hinge` | pattern≤2, main≤2, sprint≤0 | **REJECTED** | **no** |

**The trigger is not the severity band and not `pauseAffectedTraining`. It is
"any injury that prohibits at least one main-strength pattern"** — i.e. severity
**≥ 6 in any region** (`weeklyExposureContractBuilders.ts:231-232`), plus
anything with `pauseAffectedTraining`.

Severity 5 persists cleanly, so the moderate band is fine. But **the app cannot
record any injury from 6/10 upward.** That is the 6-7 "limiting" band as well as
the 8-10 band — a materially larger trust failure than the record states, and it
widens the F6 correction in `docs/audits/DEAD_AFFORDANCE_INVENTORY_2026-07-23.md`.

---

## 5. What this does and does not change about Option B

**Survives unchanged — B3, split the transaction.** The strongest confirmation
in this probe: the fact is destroyed by the week's inadmissibility, across six
of seven cells. Recording that the athlete is hurt must not be conditional on
producing an admissible week. B3 remains the root fix for A3b.

**Survives, restated — B4, bands consumed once.** The reassessment framed B4 as
"translate the Bible bands into typed region-scoped reductions", implying the
translation was missing. It is not missing; it is *partial*. The correct
statement is stronger and narrower: **credit withdrawal and typed reduction must
be a single atomic decision with one owner**, so that no contract can ever reach
the gate claiming both "this no longer produces X" and "this week requires X".
That is a static invariant, and it is what T7/T10 should pin.

**New, and not in the reassessment — nothing re-authors week content.** In every
rejected cell the candidate week is byte-identical to the healthy week
(`1:Strength/core 2:Team Training/core 4:Team Training/core 5:Strength/optional
6:Game/core 0:Recovery/recovery`). The injury path validates the *existing base*
against a stricter contract and never regenerates content. So even with a
perfectly consistent contract, the athlete's Monday pressing session would still
be on screen for a shoulder injury — the week would stop *failing*, without ever
*changing*. **B4 alone does not make an injury visible.** This is exactly rider
1's materialisation question, and it means the injury path needs a
materialisation owner (the `commitDerivingSourceFactScopedRegen` shape) that it
currently does not have.

---

## 6. The open question that is Sam's to rule (L7)

The mechanism is settled; the *right behaviour* is not, and the two answers lead
to materially different fixes.

**Should an upper-body 8/10 shoulder injury withdraw the athlete's conditioning
and sprint credit from their team trainings and their game?**

- **If no** (the Bible reading: "pause **affected** work"; a shoulder does not
  stop someone running) — then anchor participation must become region-scoped.
  No conditioning reduction is needed, because no credit should have been
  withdrawn. This is the smaller change and the one §0 of the reassessment
  argues for.
- **If yes** (a `modified` anchor genuinely produces less) — then the matching
  typed conditioning reduction must be authored atomically with the withdrawal.
  The week legitimately requires less.

This is a programming-semantics call, so it is not being made here.

---

## NOT COVERED (Process Law L2)

- **No device pass, no simulator run.** Every figure is from direct calls into
  the real store/transaction/evaluator code on one seed. L4 stands: the device
  is the arbiter and nothing here has been seen on a phone.
- **No code was written and no gate suite was run.** This document changes
  nothing. The probe is untracked session scratch.
- **One seed only.** `spent-week-friday`, in-season game week, 3 training days,
  zero app-authored conditioning. A profile that *does* carry app conditioning
  might clear the conditioning minimum and mask the defect — **untested**, and
  it may well be why this was never caught. It also means the failure may be
  profile-dependent on device, which is not established either way.
- **`back_midline` and `other` regions untested.** Only `upper_body` and
  `lower_body` were run. `back_midline` prohibits squat+hinge like lower body
  and is *expected* to behave as lower body — not measured.
- **Only the report/create operation was probed.** Injury *update*, *refresh*
  and *resolve* transitions were not run, and severity-lowering recovery
  (8-10 → 6-7, Bible :2466) is untested.
- **Only this week was evaluated for the injury path.** Weeks +1/+2/+3 appear in
  the evaluator trace as clean, unmodified weeks, which is itself consistent
  with A3a — but the injury *horizon* question (`affectedHorizon` already reads
  `fact.affectedWeeks` for injuries) was not probed and is Stage 1's subject.
- **A3a is untouched by this document.** Every A3a figure in the reassessment
  stands; nothing here revisits illness duration.
- **The `cooked_week` "recomposed but identical" observation** is not
  investigated here and remains an untraced observation.
- **No claim is made that the anchor demotion is wrong.** §6 states it as an
  open question for Sam, not a finding.
