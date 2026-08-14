# CORE — this seat's own status file. ONE WRITER: this seat.

**NAMED 2026-08-14.** Sent in on the GENERATION CORE REBUILD, under the phase
directive **BURN THE BOATS — old shit gone**. `core` because that is the subject:
the generated-week door. `ls docs/STATUS_*.md` and the last 20 commit stamps
showed `core` free (live recently: `tracer`, `baseline`, `kit`, `elegance`,
`seat`).

**EVERY COMMIT FROM THIS SEAT ENDS `Agent: core`.**

Work is in a detached worktree at `a8b65151`. **The shared checkout is never
touched.**

---

## BASE AND BASELINE — MEASURED, NOT RECALLED

- **Base: `slice-b1-pivot` @ `a8b65151`** (`docs(B1-M1-FINAL): HARD STOP — the
  composed week matches the baseline byte for byte and §18 still refuses it`).
- **Experiments: `slice-b1-m1-final` @ `9f284730`**, unmerged, harvested
  selectively.
- **Baseline world sweep, my own instrument, run at `a8b65151`: 61 built / 119
  refused of 180.** Reproduces the commit message's figure exactly, which is
  what calibrates the instrument.

### ⚠ THE 119 IS NOT 119 §18 REFUSALS — AND NOBODY HAD SPLIT IT

| Cause | Worlds |
| --- | ---: |
| **`B1-PIVOT` severance THROW** — a strength plan entry reached the severed `fallbackExercisesForPlanEntry` | **48** |
| Real §18 refusals (`pattern_restore_failure`, `pattern_imbalance`, `planner_selected_target_miss`, `required_minimum_shortfall`) | **71** |

**Every one of the 48 names the same plan entry: `w1:friday:none:optional`** —
the OPTIONAL day (Gunshow/prehab). That is non-strength content the RETAINED
adapter owns, not the composer. **40% of the "refusals" are a handover gap, not
a contract gap**, and fixing the contract alone could never have moved them.

---

## MISSION 1 — DEAD CODE DELETED. GATE: NO BEHAVIOUR CHANGE, PROVEN.

**Receipt: the 180-world sweep after deletion is BYTE-FOR-BYTE identical to the
baseline — same 61/119, same days, same rows, same doses, world for world.**

### What went, and why it was provably dead

The audit named the hydration-canonicalisation pipeline; **at this commit it is
bigger than the audit said**, because the pivot had already severed more.

`canonicaliseAcceptedBoundaryState` runs the whole structural migration only
when `structuralMigrationRequired: true`. **Exactly one function sets it —
`canonicaliseHydratedState` — and that function has no production caller.** So
the entire branch is unreachable. Deleted, 448 lines from `programStore.ts`:

- `canonicaliseHydratedState`, `HydratedStateCanonicalisationOptions`
- `canonicaliseHydratedProgram`, `canonicaliseHydratedMicrocycle`
- `hydratedWorkoutNeedsIngressCanonicalisation`
- `Section18LegacyMigrationError`, `legacyModeFor`,
  `deriveContractlessLegacyContract`
- the `structuralMigrationRequired` option and its five branches
- `liftGeneratorRecoveryAtHydration` + `src/rules/generatorRecoveryRestLift.ts`
- 10 orphaned imports
- `src/__tests__/legacyMigrationIsUnreachableAtBootTests.ts` + its package script

**WHY THE GENERATOR-RECOVERY LIFT WENT, AND WHERE THE BEHAVIOUR WENT.** Its own
docstring justified it with *"`currentProgram` is persisted whole"*. **That
premise is now false** — `partialize` persists inputs only. And the generator no
longer places recovery at all (`attachRecoveryAddonsToWeek` retired). So the
lift had nothing to lift, from a store that holds nothing to lift it from. It is
obsolete, not merely unreachable.

**The deleted guard suite is obsolete BY CONSTRUCTION, not by fiat.** It existed
to catch someone re-persisting `currentProgram` and reactivating a measured
20.4-second launch migration. That migration no longer exists to reactivate.

### ⚠ ONE THING I DELETED AND HAD TO PUT BACK — CAUGHT BY `test:compile`

`legacyMigrationFallbackProfile` looked like a pipeline member and is not.
`contract.source === 'legacy_migration'` is produced by
`migrateLegacyWeeklyExposureContractV2` — the v1→v2 CONTRACT lift, which has
about ten live callers (`weekRebuild`, `postGenerationConstraintValidation`,
`section18ProgramObservation`, this store) — **not** by the deleted structural
pipeline. Restored with a note at its head saying so.

**The lesson, and it is mine: my first reachability grep excluded the file I was
cutting, so an internal caller was invisible.** The compile gate caught what the
grep missed. A grep that hides the subject file cannot prove a symbol dead.

---

## WHAT I FOUND THAT CHANGES MISSION 2's SHAPE

**`materialiseComposedWeek` and `assembleAuthoredWeek` exist, are pure, and have
ZERO production callers.** The live route still runs
`composeWeek` → `composedWeekToCoachInputs` (`generateProgram.ts:705`) →
`buildWorkoutsFromCoach` (`:747`) — the legacy builder — which is exactly where
the acceptance envelope is produced as a by-product. **The handover the base
commit says is built is built but not wired.**

That is why the base's HARD STOP reads the way it does: §18's input contract is
undeclared, so the only way to be acceptable is to have been built by the legacy
builder.

### Carried from `9f284730` — PROVEN ONLY

- `RotationContext.composedStrengthDays`; the adapter receives the COMPLETE
  planner week and authors no lifts on composed days (the day-level filter
  emptied the adapter and cost 22 worlds — deleted, not reapplied).
- a composed day carrying conditioning keeps its conditioning seed instead of
  collapsing to Rest.
- `materialiseComposedWeek` + `assembleAuthoredWeek` wiring.

### NOT carried — deliberately

- **The stamping experiments, all three.** `finaliseWorkoutAfterMutation` with
  `composed: true` measured 32/148, worse than no stamp at 49/131. The envelope
  is an accumulation of builder side effects and cannot be reproduced by calling
  one of its producers.

---

## OUTCOME — 61/180 → 120/180 BUILT, 59 GAINED, 0 LOST

**Full report: `docs/GENERATION_CORE_REBUILD_2026-08-14.md`.**

### ⚠ THE BASE COMMIT'S DIAGNOSIS WAS WRONG, AND THREE SESSIONS PAID FOR IT

It blamed the null `workout.section18Evidence`. **Measured: that field is inert.**
`null` and `{conditioningRole:'none'}` both return `null` from
`conditioningPresence` (`section18EffectiveWeekEvaluator.ts:317-318`), and the
envelope's `provenance` has **zero readers in the whole repo**. The real
difference was **`workout.speedBlock`** — the app's only source of app sprint
credit (`:670`) — which the materialiser never emitted and the merge threw away.
**The envelope and the speedBlock are two by-products of the same builder call;
the previous sessions measured the inert one.**

### The four things that moved the number, each attributed

| step | built | why |
| --- | ---: | --- |
| baseline | 61 | — |
| the composed-optional (Gunshow) day is adapter-owned, not a strength template | 85 | **48 of the 119 "refusals" were the severance THROW, not §18** — every one an optional arms day the composer never owned |
| direct handover — composer sole strength owner, adapter keeps the whole week | 108 | `materialiseComposedWeek` + `assembleAuthoredWeek` wired; no composer row enters the legacy builder |
| the week is judged by `GeneratedWeekContract`, not the repair gateway | **120** | residue-shaped refusals have no clause and no longer refuse |

### TWO REGRESSIONS I CAUSED, BOTH THE SAME MISTAKE

Letting an adapter that no longer owns a day's STRENGTH go on describing that
day. Deprived of its lifts it types a composed lower-body day
`workoutType: 'Conditioning'`, `conditioningRole: 'optional_flush'` — **−12
worlds** — and it under-counted conditioning by reading the stored role
literally when the authored owner assigns roles POSITIONALLY at judgement time
— **−42 worlds**. Both measured, attributed, fixed. Neither was absorbed.

### Deletion score (production)

**850 deleted / 249 added — net −601 lines**, plus two whole files. Dead by
proof, not by assumption: the legacy hydration/migration pipeline (the
`structuralMigrationRequired` branch nothing sets), `applyPoolRotation` (zero
call sites after the pivot), `generatorRecoveryRestLift` (its own premise
"currentProgram is persisted whole" is now false), and
`composedWeekToCoachInputs` (the composer→old-builder round trip).

**AND ONE I GOT WRONG.** `legacyMigrationFallbackProfile` is fed by
`migrateLegacyWeeklyExposureContractV2` — the v1→v2 CONTRACT lift with ~10 live
callers — not by the deleted pipeline. `test:compile` caught it; restored with a
note. **My first grep excluded the file I was cutting, so an internal caller was
invisible. A grep that hides the subject file cannot prove a symbol dead.**

### Gates

- `test:generated-week` — **36 passed / 0 failed.** One red-proven cell per
  clause; plus the purity cells (the validator returns the week byte-identical,
  imports no builder/gateway/repair/canonicaliser, and reads no `provenance`).
- **Provenance-invariance proved:** two weeks with identical meaning and
  different provenance get the same verdict AND the same ledger.
- **Boot regeneration: PASS** — semantically identical. It caught a real
  one-field disagreement (`Strength` vs `Mixed` on a combined day) which is
  fixed, so generation and relaunch now agree.
- Sweep re-run after every deletion: **120/60 unchanged.**

---

# COMPOSER COMPLETION — 2026-08-14, base `459d6bf9`, branch `slice-composer-completion`

Full report: `docs/COMPOSER_COMPLETION_2026-08-14.md`. Commits `55af1e65`,
`32f408b2`, `75fc0c4e`. **MERGE RECOMMENDED. Not merged.**

## THE TWO THINGS WORTH CARRYING FORWARD

**1. THE ORDER'S PREMISE WAS FALSE AND THREE COUNTERS WERE NEEDED TO KNOW IT.**
"Six built worlds ship a squat with no hinge" — they all train a hinge, on the
second night. The composer built `full_body_a` (squat) and `full_body_b` (hinge);
the census inferred the day's ladder from the PLANNER'S TITLE, which still said
"Lower body strength" / "Upper body", and `hinge` is not a member of the upper
ladder so the deadlift was never assigned. **Building what was ordered would have
put a second hinge into a balanced week.**

**A DAY'S SHAPE CANNOT BE RECOVERED FROM ITS NAME, EVEN IN PRINCIPLE.** Sam's
full-body A and B are DIFFERENT ladders and every naming owner in this app calls
both `Full Body Strength`. No text probe could ever have been right. The composer
now carries `composedDayShape` and readers read it.

**2. `archetype:'full_body'` WAS MAPPED TO `'lower'` — ONE LINE, 22 REFUSALS.**
A day the planner asked to cover squat+hinge+push+pull got the five-slot lower
ladder on a FULL GYM, so the week trained no push or no pull and was refused
correctly. **The composer was the liar, not the judge.** 120/180 -> 142/180.

## MEASUREMENTS (clean control worktree at base for every baseline figure)

    worlds built             120 -> 142      refused 60 -> 38
    laddered days            294 -> 338      breadth floor 300 now PASSES
    deficient                 28 -> 0        (CIRCULAR for composed days — see below)
    R-089 unmatched squat      6 -> 0        two independent counters
    composed rows legal for kit          1422 checked, 0 illegal
    typed equipment gaps surviving        202 across 84 worlds
    bible:parallel (253)      71 red -> 70 red, NO NEW RED, week-identity newly green
    compile / qa / scenarios  identical to baseline

## FOUR TRAPS THIS SEAT HIT, FOR THE NEXT ONE

- **A RATCHET CAN GO CIRCULAR WHEN YOU FIX THE WIRING.** `composeWeek` fills
  `SLOTS_FOR_KIND[kind]`; teaching the census to read the declared `kind` made it
  judge against the SAME LIST, so "0 deficient" is now true by construction.
  Banked to 0 as ordered, with that stated at the constant. **The honest measure
  moved to a CONTENT arm** that counts squat/hinge from `slotsForExerciseName` and
  consults no ladder. It caught my own regression within one commit.
- **MY FIX CAUSED A FRESH R-089 BREAK, TWICE.** 10 unmatched squats one way, 22
  unmatched single-leg knees the other. A adds `squat+single_leg_hip`, B adds
  `hinge+single_leg_knee` — Sam's shapes CROSS R-089's two pairs, so an ODD
  full-body-day count violates under BOTH starting shapes, for any number of lower
  days. Enumerated, not assumed.
- **I DIFFED GATE OUTPUT THAT CARRIED TIMINGS.** All 71 baseline reds read as
  "newly green" and all 69 as "new red" at once. Extract on suite NAME.
- **A SUITE REPORTED THE SAME PASS COUNT BEFORE AND AFTER 15 NEW CELLS.** Sucrase
  does not typecheck, so `target.label` (the field is `id`) was silently undefined
  and the cells had already run under `[undefined]` names. **Only a clean control
  worktree at base gave the true 73.**

## AND THE ONE THAT MATTERS MOST

**R-087 HAD ALREADY ANSWERED THE QUESTION I HAD TYPED OUT FOR SAM.** I was about
to ask what a lone full-body day owes, with two candidate answers. R-087
(2026-08-13): *"THE WEEK IS THE UNIT OF COVERAGE, NOT THE DAY. A FULL BODY DAY HAS
NO FIXED TEMPLATE … Any fix that hardcodes a full-body row list, however carefully
chosen, contradicts this ruling on the day it lands."* It even pre-refuses the
shape I was going to propose. **The registry grep is the only thing that stopped
it reaching him.** Nothing is owed by Sam out of this mission.

**The 14 still-refusing worlds have a specified, already-ruled fix** — a full-body
day's slots are what the WEEK has not covered, sized to Bible `:122`'s seven — and
R-087 is `UNENFORCED`. Not built here because it moves a full-body day from 5 rows
to 7, a volume change touching `doseFor`, the exercise cap and §18 counting.

## STILL OPEN, NOT MINE, NOT TOUCHED

- **24 occ / 15 worlds, all Bodyweight**: the planner selects an `upper pull
  emphasis` session for an athlete with nothing to pull on, so that day carries no
  main lift and the main-strength count is short. Planner-owned.
- **`declaredKitGaps` is never passed** to `validateGeneratedWeek` at its
  production call site, though the input type declares it. Did not affect any
  finding measured here. An unread input on a live seam.
- **`workout.name` still describes the session the composer replaced.** Not the
  athlete's day title, but it reaches `CoachScreen`'s LLM context — the coach is
  told a day is "Lower body strength (squat + hinge)" while it holds a bench press
  and pull-ups. The authored label is Sam's to sign.

---

# R-087 BUILT — 2026-08-14, ordered by Sam after he approved the two-day week

**120/180 -> 156/180.** A general full-body day now ASKS THE WEEK what is still
open (`coverageSlotsForFullBodyDay`): uncovered slots first, in Sam's own
enumeration order, sized to Bible `:122`'s seven, then R-089's *"squatting and
hinging again is fine"* for the remainder. R-093's fixed A/B shapes stay, and ONLY
for their case. **Sam's approved two-day week is byte-identical.**

    worlds built    142 -> 156     refused 38 -> 24     laddered days 338 -> 376
    deficient         0 -> 0       R-089 squat 0 -> 0 (both arms)
    bible:parallel   71 -> 65 red, NO NEW RED, 6 newly green (all verified non-vacuous)
    kit legality     1626 composed rows, 0 illegal; 232 typed gaps across 92 worlds

## THE LESSON, AND IT IS THE ONE WORTH KEEPING

**A NUMBER MOVING THE RIGHT WAY IS NOT EVIDENCE THAT NOTHING ELSE MOVED.** The
refusal count went exactly where I wanted it — and R-087 had simultaneously broken
two other rulings that the refusal count could not see:

- **R-080** (muscle-group narrowing) had been safe only because no slot was ever
  filled twice: *you cannot collide with yourself.* **R-087's coverage day is the
  first thing in this app that can owe the same slot twice** — R-093's kit fallback
  repeats an achievable plane — and R-080's only enforcer, `applyPoolRotation`, was
  deleted in the B2 rebuild. Two days shipped `Band Pull-Apart | Rear Delt Fly`,
  both `isolation_upper`. Fixed by reading `PoolEntry.group` at selection.
- **The judge scored 8 days deficient FOR OBEYING R-093.** A ruled plane-repeat
  looked like a duplicate. Fixed at both ends: the day declares the RESOLVED plane
  (so a repeat is declared twice — the truth), and `sessionSlotCoverage` compares
  against declared MULTIPLICITY instead of a flat `> 1`.

**A new capability re-opens rulings that were only ever true by accident.** Before
adding one, ask which existing law was safe because the old shape made it
unreachable.

## AND MY OWN PROBES LIED TO ME

`probe-world-detail` indexes composer CALLS by `week - 1`; that is not
`microcycles[week - 1]`, so its `w2` output is week 1's composition under a w2
label. `probe-validator-input` prints the LAST validator call — a third week again.
**I diagnosed one world off the wrong one before noticing.**
`scripts/probe-census-offenders.ts` exists to replicate the census EXACTLY, and its
header says so. **When two instruments disagree, build the one that is the gate.**

## STILL RED, NOT MINE, LEFT TO ITS OWNER

`R-089 [CONTENT] single-leg knee` — **2 occurrences, `Pre-season/{5d,6d}/noclub/
Full Gym/w2`, both `sq2/hi2 slk3/slh2`.** The composer's rows are `slk2/slh2`; the
third knee is a `Lateral Lunge` written by `canonical_row_classifier` (the optional
top-up) on a day the composer does not own. **Both worlds REFUSED at baseline**, so
this is pre-existing behaviour made visible by them building at all — the same
shape as this mission's opening finding. It is a CELL regression inside an
already-red suite, so no suite total shows it; stated explicitly in §1 of the
report.

## REMAINING REFUSALS — 24 occurrences / 15 distinct profiles, ALL Bodyweight Only

The planner selects an `upper pull emphasis` session for an athlete with nothing to
pull on, so that day carries no main lift and the main-strength count is short.
Planner-owned. Untouched, per Sam.

---

# R-087 CORRECTED — Sam rejected the week, and he was right

*"that's a terrible program — there's no spacing and the volume is way too big on
Monday."*

**THE BUG WAS ONE WORD OF HIS OWN RULING.** R-087 says a full-body day depends on
*"the rest of the week"*. I implemented that as **the days BEFORE it**. The
full-body day was MONDAY, so the accumulated set was empty, every slot read as
missing, and the day took the first seven of the ladder — squat, deadlift, both
single-leg compounds, a press and a pull — the night before Tuesday's full lower
session, which supplies most of them.

**R-014 governs the size and I had it backwards:** *"the number of exercises is not
important the total work being done evenly across the body is."* Bible `:122`'s
seven is an EXAMPLE, never a quota.

## THE DISTRIBUTION, BEFORE AND AFTER — `Pre-season/5d/noclub/Full Gym/w1`

    BEFORE  Mon 7 lifts + conditioning | Tue 5 (full lower again) | Wed 3 | Thu-Sun empty
    AFTER   Mon 2 (Barbell Row, Lat Pulldown) | Tue 5 | Wed 3 | Thu-Sun empty
    SHIPPED no week — honest refusal

## AND THE CORRECTED ANSWER WAS ALSO NOT SHIPPABLE

A two-row day under a *"Full body — cover all movement patterns"* heading is a
different bad week. Measured: **10 such days, 8 of two rows and 2 of a single
`Push-ups`**, and it cost 4 worlds against the checkpoint while gaining none.

So a gate declines them — **definitional, not a count**, because Sam forbade
inventing a cap and R-014 forbids counting exercises: *does this gap set train the
lower body AND the upper body?* An upper-only gap set is not a small full-body day.

**ZERO `full_body_coverage` DAYS ARE COMPOSED ACROSS ALL 180 WORLDS.** R-087's
premise — that such a day has genuine week-wide gaps worth a session — **does not
hold for any week this planner builds**, because the planner always pairs it with a
lower day and an upper day that supply the ladder. The blocker is the
**session-count/scheduling capability**. The 142-world checkpoint is restored
exactly.

## THE LESSON

**A DORMANT BRANCH STILL NEEDS ITS GUARD.** An unreachable branch with no test is
what later code trusts. Both functions are called DIRECTLY in
`composerSeveranceTests` (8 cells, suite 88 -> 96), including a cell that reproduces
Sam's rejected input and asserts the day comes back pull-only and **does not re-take
a slot the rest of the week already trains**. That cell would have caught the
original defect.

**AND: the correction fixed the R-089 single-leg-knee regression for free** (2 -> 0),
because the two offending worlds now refuse instead of publishing a week whose
top-up added a third knee.

## FLAKE, RECORDED

`test:census-hook` went red once under the parallel runner; green 3/3 standalone,
green in both earlier rosters, green on a clean re-run of the full roster. It shells
to `git` in a temp repo. **Recorded, not counted as a result, not hand-waved.**

---

# MERGED TO MAIN — 2026-08-14

Merge commit `a3138e17`, two parents (`459d6bf9` + `38560c0d`), `--no-ff`.
**Restore point: tag `pre-composer-completion-merge` -> `459d6bf9`**, the same
process as `pre-burn-the-boats-merge`.

## THE COMPLETE ROSTER, RERUN ON MAIN AFTER THE MERGE

    test:bible:parallel (253)  71 red -> 70 red   NO NEW RED
                               test:week-identity newly green (W6, traced cause)
    test:compile               PASSED — no file regressed
    test:composer-severance    96 / 0
    test:generated-week        36 / 0
    test:ladder-wide           13/14 — 142 built / 38 refused, 0 deficient of 338,
                               R-089 0/0 on BOTH arms
    test:qa                    168 passed, 10 allowed, 1 policy fail — identical to baseline
    test:scenarios             1 failed (G+1_RECOVERY) — identical to baseline

Every figure matches the branch measurement exactly. The one remaining
`ladder-wide` failure is the built-world floor (142 < 150), **not lowered**.

## WHAT THIS MERGE DOES NOT CLAIM

**THE 142 BUILT WEEKS ARE NOT COACH-APPROVED.** Sam has read and approved exactly
ONE printed week (In-season/2d/club) and rejected one (Pre-season/5d/noclub/Full
Gym). The other 140 are measured against the ladder, R-089 and kit legality — none
of which is a judgement that the training is good. **The claim is narrow: the
family Sam rejected now refuses honestly instead of publishing a bad week.**

## NEXT — NOT STARTED, AND NOT TO BE STARTED

**Sam is defining the base weekly programming and spacing layouts tomorrow, and
those become the specification.** The 14 refusals blocked on the
session-count/scheduling capability wait for it. **No scheduling work has begun and
none is queued.** Nothing in this mission should be read as a design for it.
