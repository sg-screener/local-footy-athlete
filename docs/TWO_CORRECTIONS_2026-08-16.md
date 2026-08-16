# THE TWO BOOKKEEPING CORRECTIONS — 2026-08-16, seat `core`

Branch `slice-weekly-scheduler`. Worktree-isolated. **No merge.** Planner deleted.
G-2 untouched. Approved contract untouched. No thresholds reset. No new refusal
families chased.

Applied and measured **separately**, one commit each, so every number is
attributable to one change.

---

## CHANGE 1 — pre-season strength expectation (`fed83f8e`)

**The defect.** A pre-season week WITH a fixture resolves to the old checker's
`practice_match_week` row, which expects **3** (preferred 2–3). The approved source,
Pre-season 5–6 days: ***"Four required strength sessions: Upper ×2 + Lower ×2."***
The number 3 appears nowhere in the approved contract.

**The fix.** The V1 exposure contract's strength expectation is taken from the
scheduler's own count, which comes from `baseLayoutFor` — the approved
phase × availability table. The old per-mode number is not consulted.

> ⚠ **Only the expectation moved. The floor did not.** `required` is untouched.
> Raising a floor refuses weeks that were legal a moment ago, and a bookkeeping
> correction must not be able to cost an athlete a week. (`withExposureTarget` was
> unusable — by design it only ever reduces.)

### My first attempt broke 12 off-season worlds, and the suite said so

I used `demand.mainStrength`, the layout's count, which **includes optional
sessions**. The early off-season overlay (WC-130) makes every session optional —
*"zero completed is valid"* — so the target became 3–4 against a core count of 0:

    FAIL every week at or above its target, or explained by a typed reduction
         Off-season/early_offseason/…: core=0 < target=3, no typed reduction
    FAIL the contract records every target it lowers
    6 failing cells -> 8

Narrowed to **required** strength sessions. Both families cleared.

### It also exposed the last holder of the old number

`B3` asserted 3 while reporting `planned=4, contractTarget=4` — the scheduler and
the contract now **agree**, and the test expectation was the stale one. Corrected
to 4 with the approved quote beside it.

### Result

    test:weekly-dose-ownership   6 -> 4 failing cells (of 23)
    180 worlds                   80 built / 100 refused
    LOST 0    GAINED 0
    families                     60 / 20 / 16 / 4  — identical, occurrence for occurrence

---

## CHANGE 2 — hard-day accounting (`ba0f0f4`)

**The defect.** `existingHardExposures` means the hard days **already committed by
anchors** before the app adds anything — club nights plus fixture credit. I had it
set to `demand.hardDays`, the week's TOTAL, which counts every strength day the app
itself authored. An in-season athlete with no club and no game reported **3
committed hard days against 0 real anchors**.

**The fix.** Read off the contract's anchors, which the scheduler supplied from the
agreed week. A stale onboarding fixture or an unselected club night can no longer
inflate it.

    counted=5 vs contract=1   club day the athlete did not select   -> fixed
    counted=3 vs contract=0   stale onboarding game day             -> fixed
    committed hard days across the whole 318-week matrix            -> fixed

### Result

    test:weekly-dose-ownership   4 -> 1 failing cell (of 23)
    180 worlds                   80 built / 100 refused
    LOST 0    GAINED 0
    families                     60 / 20 / 16 / 4  — identical

---

## WORLD ACCOUNTING — NEITHER CHANGE MOVED A WORLD

| | built | refused | lost | gained |
| --- | ---: | ---: | ---: | ---: |
| before both | 80 | 100 | — | — |
| after change 1 | 80 | 100 | **0** | **0** |
| after change 2 | 80 | 100 | **0** | **0** |

Units: **generation occurrences** of 180 (90 athlete setups × 2 run lengths).
50 of 90 setups refuse, unchanged.

**Family deltas: all zero.** 60 `WC-043`, 20 `main_strength_planner_selected_target`,
16 `hard_day_permitted_maximum + main_strength_permitted_maximum`, 4
`hard_day_permitted_maximum` — before, between and after.

**I predicted these would recover worlds. They did not, and I am not dressing that
up.** Both were accounting defects in what the plan *reports*, not in what the
scheduler *builds*; the 100 refusals are decided upstream by legality and by kit.

---

## THE FOUR REMAINING DELEGATED PROHIBITIONS — CONFIRMED

None produces a competing week-legality verdict. **No stop condition.**

| clause | what it actually does | verdict? |
| --- | --- | --- |
| WC-048 | `dailyMovementCeiling` is passed to the composer as `maxExercisesPerSession` — a **constraint on its own content** | no — supplies a fact |
| WC-062 | declared club nights are stamped onto days as `clubTraining: true` | no — supplies a fact |
| WC-110 | has no code of its own; it is a pointer to WC-043, which IS in the owner | no |
| WC-135 | `inSeasonSprintDay` returns a day or `null`. It **places** content under its own conditions (no club training, G-3 or earlier); it never refuses a week | no — structurally constrains its own content |

### One observation, named rather than buried

`dayIsUsableForStrength` **pre-filters** candidate days using WC-050, WC-060 and
WC-061 before the owner ever sees them. It is not a competing verdict — the owner
re-checks all three clauses on the finished assignment, so no week can pass the
owner while breaking them — but it is a **redundant second reading** of three
clauses. If the two ever disagreed the filter would win silently, by removing
candidates. Naming it, not expanding the mission to remove it.

---

## GATES

    clause-enforcement    105/105 cells        weekly-scheduler   84/84 cells
    cyclic-proximity      124/124 cells        anchor-survival    12/12 cells
    weekday-index          85/85 cells         readiness-dose     105/105 cells
    readiness-structure   100/100 cells        rules-kernel       121/122 cells (1 red)
    weekly-dose-ownership  22/23 cells (1 red)

    full sweep     93 of 414 SUITES failing — 0 newly red, 0 newly green
    test:compile   35 file/scope PAIRS worse, ALL [tests]; zero product, zero devtools

**No threshold, floor, ceiling, ratchet or baseline was reset.**

### The two remaining red cells

1. `weekly-dose-ownership` — *"the built, contracted and judged hard-day maxima are
   one number"*: built=5, contract=4, §18=4. This is the **ceiling value**, not the
   counting, and it was **not** one of the two corrections. The approved source is
   explicit that it is deliberately two numbers: *"Prefer 4 hard days; allow 5."*
   Left alone as instructed.
2. `rules-kernel` — 1 cell, unclassified ("other") units in the live week.

---

## MERGE RECOMMENDATION — **DO NOT MERGE**

The enforcement boundary and both corrections are sound, and nothing regressed:
zero newly red suites, zero worlds lost, product typecheck clean.

**The blocker is unchanged and is not a bug: the corpus builds 80 of 180
occurrences against main's 142.** That gap is G-2 being enforced as the written
prohibition rather than a purchasable score — correct, and athlete-safety relevant,
but it means 50 of 90 setups now receive a typed refusal instead of a week that
broke the contract.

**That is a product call, not an engineering one**, and it is the one thing I
cannot settle: whether those athletes should get a refusal, a reduced-structure
fallback the contract does not currently describe, or a change to the approved
source. Every other blocker I have raised on this branch is now closed.

Agent: core
