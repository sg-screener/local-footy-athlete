# CYCLIC GAME PROXIMITY — 2026-08-16, seat `core`

Branch `slice-weekly-scheduler`. Worktree-isolated. **No merge.** Planner stays deleted.

---

## 0. MERGE RECOMMENDATION — **DO NOT MERGE YET**, and the blocker is a decision, not a bug

| | |
| --- | --- |
| the reported G+1 defect | ✅ **real, fixed, mutation-proven** |
| cyclic across all 7 game weekdays | ✅ 124 cells |
| recurring vs first fixture | ✅ typed, `recurring` defaults everywhere |
| Sunday world | ✅ **refuses nothing — falls back to the approved Full Body ×2** |
| off-leg is scheduler-requested | ✅ guarded with a negative arm |
| product typecheck | ✅ **zero product, zero devtools regressions** |
| full sweep vs this branch's last | ✅ **0 newly red, 3 newly green** (96 → 93) |
| the three red behavioural suites | ⚠ 2 fixed; `weekly-dose-ownership` now RUNS and shows **9 real count differences** |

**The one thing standing between here and merge:** `test:weekly-dose-ownership`
now executes 330 weeks and reports that the scheduler chooses **different strength
counts** from the deleted planner in 9 cells. That is a coaching adjudication —
which number is right, the approved contract's or the old planner's — not a
mechanical fix, and it is not mine to decide.

---

## 1. THE DEFECT WAS REAL

Proximity was `orderIndex(day) - orderIndex(gameDay)` inside one Monday→Sunday
array. For a **Sunday** fixture that makes Monday `-6`: six days *before* the game,
wide open. Monday is **one day AFTER last Sunday's game**. So Lower + 30–50 minutes
of conditioning went onto G+1, which WC-050 reserves for rest or recovery.

**For a fixture on the last day of the array, every G-rule was unreachable.**

### The fix — one cyclic owner, two answers

`gameProximity(day, gameDay, recurrence)` returns `daysSincePreviousGame` (the
recovery side) and `daysUntilNextGame` (the taper side). **`null` means "there is
no such fixture", never "far away"** — a caller treating `null` as a large number
reintroduces the bug, and that is written on the function.

Six linear sites replaced: strength usability, the G-2 score, running top-up, power
eligibility, the G-2 power fence, sprint placement.

### Recurring vs first fixture

New typed input `fixtureRecurrence: 'recurring' | 'first_fixture_no_previous'`.

**`'recurring'` is the default at every caller.** Onboarding gives a *usual* game
day, which by definition means there was one last week; nothing in the profile can
say "first fixture ever", so nothing claims it. **A fixture outside the printed
week is never treated as evidence there was no game** — that inference was the bug.

For a genuine first fixture, `daysSincePreviousGame` is `null` for days before the
game, while a day *after* an in-week game is still G+1 either way.

### Mutation receipt

    restore the pre-fix linear in-week form  ->  51 of 124 cells RED

---

## 2. THE CYCLIC PROXIMITY MATRIX

`daysSincePreviousGame` / `daysUntilNextGame`, recurring, all 7 × 7:

| game ↓ / day → | Sun | Mon | Tue | Wed | Thu | Fri | Sat |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Sunday** | 0/0 | **1**/6 | 2/5 | 3/4 | 4/3 | 5/**2** | 6/**1** |
| **Monday** | 6/**1** | 0/0 | **1**/6 | 2/5 | 3/4 | 4/3 | 5/**2** |
| **Tuesday** | 5/**2** | 6/**1** | 0/0 | **1**/6 | 2/5 | 3/4 | 4/3 |
| **Wednesday** | 4/3 | 5/**2** | 6/**1** | 0/0 | **1**/6 | 2/5 | 3/4 |
| **Thursday** | 3/4 | 4/3 | 5/**2** | 6/**1** | 0/0 | **1**/6 | 2/5 |
| **Friday** | 2/5 | 3/4 | 4/3 | 5/**2** | 6/**1** | 0/0 | **1**/6 |
| **Saturday** | **1**/6 | 2/5 | 3/4 | 4/3 | 5/**2** | 6/**1** | 0/0 |

Bold = a rule bites: G+1 (rest/recovery only), G-1 (no heavy lifting), G-2 (no
heavy lower, no added lower-body power). Every row is asserted; the old code could
only ever satisfy the middle of a row.

---

## 3. THE CORRECTED SUNDAY-GAME WEEK

Input: in-season, gym access Mon/Wed/Fri/Sat, club Wed+Fri, **recurring Sunday game**.

    Monday    G+1  -> Rest      (was Lower + 30-50 min conditioning)
    Saturday  G-1  -> Rest
    => only Wednesday and Friday remain legal, and they are separated

**The scheduler did not force Lower onto G+1 to keep the count, and it did not
refuse.** It took the approved highest-legal-structure fallback: **Full Body ×2**
on the two legal days — exactly the ordered behaviour.

| Day | Date | Type | Club? | Rows |
| --- | --- | --- | --- | ---: |
| Monday | 2026-07-13 | Rest | | 0 |
| Tuesday | 2026-07-14 | Rest | | 0 |
| Wednesday | 2026-07-15 | Team Training | club | 6 |
| Thursday | 2026-07-16 | Rest | | 0 |
| Friday | 2026-07-17 | Team Training | club | 6 |
| Saturday | 2026-07-18 | Rest | | 0 |
| Sunday | 2026-07-19 | Game | | 0 |

    Wednesday   Back Squat, Single-Leg RDL, Bench Press, Pull-Ups [main]
                Ab Wheel [accessory] · Continuous Aerobic Run [conditioning,
                aerobic_base, offFeet=TRUE, modality=bike]
    Friday      Deadlift, Bulgarian Split Squats, Overhead Press, Barbell Row [main]
                Band Pallof Press [accessory] · same conditioning block

---

## 4. OFF-LEG IS THE SCHEDULER'S REQUEST

The scheduler already typed `off_leg` whenever conditioning pairs with a lower
purpose (WC-115) — that part was right. **But `conditioningOffFeet` was absent from
`ADAPTER_CONTRIBUTED_FIELDS`, so the assembler dropped it on every composer day**
and the athlete's week said `undefined` while the block was a bike. Now `true`.

Guarded with a **negative arm**: upper + conditioning must NOT be `off_leg`. Without
it a blanket `off_leg` would pass and the intent would carry no information.

The specialist still chooses bike / row / ski. It does not invent the requirement.

---

## 5. THE NAMING DEFECT, RECORDED — NOT REDESIGNED

**"Continuous Aerobic Run" renders as a bike.** The template's own text says
"Run/Bike ONLY" and the resolver picked bike, so the prescription is right and the
*title* is wrong. The standalone-conditioning branch renames a shifted session to
its actual modality; the **combined** path has no such rename.

Logged for projection cleanup. **The authored conditioning templates were not
touched**, as instructed — this is a display-layer rename, and `conditioningOffFeet`
now reaching the workout is what makes a correct rename possible downstream.

---

## 6. THE THREE RED BEHAVIOURAL SUITES

| suite | before | now |
| --- | --- | --- |
| `test:readiness-dose-sweep` | threw, killed the run | **GREEN, 105 cells** |
| `test:readiness-structure-law` | 1 red | **GREEN, 100 cells** |
| `test:weekly-dose-ownership` | threw, killed the run | **runs 330 weeks; 9 cells red** |
| `test:rules-kernel` | 1 red | 121 passed, **1 red** |

**The illegal fixture has its own control now.** Both matrix suites were filling gym
days forward from Monday, so a two-day athlete got Monday + Tuesday — back-to-back,
which the approved source forbids. Re-fixtured to separation-first order, and
refusals are absorbed as a typed answer (`coachingPlanOrRefusal`) instead of
throwing. Each refused combination is **counted and named**, and the suite **fails
outright if more than half the matrix drops out** — a matrix that quietly empties
asserts nothing.

    Matrix: 423 combinations — 330 scheduled, 93 legally refused

### ⚠ What running them again immediately found

    FAIL low capacity still moderates the conditioning dose
    FAIL low capacity still asks for a ramp-up

**Two readiness DOSE behaviours I had deleted.** I hardcoded
`conditioningLoading: 'full'` and `rampUp: false` in the connector; both edges lived
in `buildAIConstraints` and went out whole with the planner. They are the *same two
edges* the readiness census had to be reclassified for last session — the suite that
owned them could not say so because it died at import. **Restored from `capacity`,
and declared in the census as re-homed rather than new.**

This is the argument against deleting a suite whose subject is a behaviour.

---

## 7. GATES

    full sweep       96 -> 93 red.  0 newly red.  3 newly green:
                     readiness-dose-sweep, readiness-structure-law,
                     strength-answer-authority
    test:compile     38 -> 35 file/scope pairs worse, ALL [tests].
                     ZERO product, ZERO devtools.
    180 worlds       140 built / 40 refused; 90 setups, 20 refuse (unchanged)
    scheduler        87/87 · anchors 12/12 · weekday-index 85/85 · cyclic 124/124

**A product typecheck regression appeared mid-session and was mine:**
`coachingInputsToSchedulerInputs` exists **twice** — the shared one and a private
copy inside `generateProgram.ts`, which is the one the plan cutover actually calls.
Fixed, not reported. **Two builders for one thing is the defect behind the defect**;
named here rather than refactored at the cap.

No threshold, floor, ceiling, ratchet or baseline was reset.

---

## 8. WHAT REMAINS

1. **`test:weekly-dose-ownership`, 9 cells** — the scheduler's strength counts differ
   from the deleted planner's. **Needs a coaching ruling, not a patch.**
2. **`test:rules-kernel`, 1 cell** — unclassified ("other") units in the live week.
3. **90 other red suites**, unchanged from the rollback point and not investigated.
4. **`test:compile`: 35 test files** still reference deleted symbols.
5. **"Continuous Aerobic Run" rendered as a bike** — §5, for projection cleanup.
6. **2 occurrences short of the 142 baseline**; 20 setups refuse (bodyweight-only
   targets, off-season ceilings).
7. **Two copies of the scheduler-inputs builder** (§7).
8. **No simulator, no device, no relaunch.** Every claim is headless.

Agent: core
