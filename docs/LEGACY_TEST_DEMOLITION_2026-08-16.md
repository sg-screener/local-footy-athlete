# LEGACY TEST DEMOLITION — census, 2026-08-16, seat `core`

Base merged main `da4c5e46`. **No merge needed — this is on main.**

---

## 0. TWO CORRECTIONS TO MY OWN PRIOR REPORTING, BOTH MATERIAL

### (a) "93 of 414 suites" was wrong. The denominator is **252**.

`scripts/sweep.sh` derives its roster from `test:bible`, which chains **252**
suites. **162 `test:*` scripts exist that the sweep NEVER RUNS.** Every "93 of 414"
I have written — including in the merge receipt — used a denominator the instrument
does not measure.

    roster actually run:  252      failing: 93
    never run at all:     162      status: unknown until now

### (b) The deleted-symbol list carried three names that were never deleted

    classifyGenerationAdjacencyRegion   LIVE  coachingEngine.ts:6860
    scoreStrengthSequence               LIVE  coachingEngine.ts:7007
    enforceInSeasonPushPullBalance      LIVE  coachingEngine.ts:6632
    section18ModeAndSubphase            LIVE  MOVED to rules/section18WeekIdentity

**Only `buildCoachingPlan` is genuinely absent.** I had carried an early "gated for
deletion" note forward as fact. Any suite classified A on the strength of those
names would have been deleted while testing live product code.

---

## 1. THE CENSUS THAT REFRAMES THE MISSION

Every one of the 93 failing suites was executed and its failure mode captured:

    64 ASSERTION      12 WORLD_REFUSED      12 OTHER      5 HARNESS_DEAD

    reference a deleted planner symbol:   6  (one of them comment-only)
    do NOT:                              87

**The "93 failing suites" and the "planner-referencing files" are largely different
populations.** The pre-deletion rollback point was already 96 red; 87 of the 93
predate this entire slice and have nothing to do with the planner.

---

## 2. DELETION / MIGRATION CENSUS

### A — physically deleted (subject genuinely gone), 4 files, 1,040 lines

| file | why |
| --- | --- |
| `scripts/probe-planner-callers.ts` | its subject IS the deleted planner |
| `scripts/probe-planner-surface.ts` | its subject IS the deleted planner |
| `src/__tests__/weekendPriorityTests.js` | no npm script, no importers, orphan |
| `scripts/verifyConditioningSystem.js` | no npm script, no importers, orphan |

### B / D — migrated, 34 files

32 `.ts` files re-pointed off `buildCoachingPlan` onto
`support/coachingPlanForTests`, the shim onto the scheduler-backed producer. Two
type-position references and one stale import corrected by hand.

**Two needed genuine instrument repair, not a symbol swap.**
`injuryAuthorityOwnershipTests` and `powerPrimerPolicyTests` drove
plan → `buildWorkoutsFromCoach` with **no `composeWeek`** — the old two-step
pipeline. The adapter alone throws `B1-PIVOT` by design. Both now drive the real
generator in production's order. The injury fixture also needed the equipment
fields the two-step never asked for — fixture completion, not an expectation
rebase.

### The four dead harnesses, before → after

| suite | before | after |
| --- | --- | --- |
| `test:section18-planner` | dies at import | runs; `sprint_cod` required 1, actual 0 |
| `test:injury-authority` | dies at import | runs; 4 passed, 21 failed |
| `test:generation-vocabulary` | dies at import | runs; 17 passed, 1 failed |
| `test:power-primer-policy` | dies at import | runs; world refuses (`main_strength_permitted_maximum`) |

### ⚠ 17 suites were ALREADY DEAD and invisible

Of the 162 never-run scripts, 17 point at files this session touched. **All 17 were
dead before I started** — proven by control, not assumed:

    pre-session weeklySessionSpacingTests  ->  TypeError: Cannot read properties
                                               of undefined (reading 'call')
    after migration                        ->  6 passed, 15 failed

They now RUN and report real assertions. Their failures are pre-existing and were
concealed by a roster that never executed them.

---

## 3. C — GENUINE PRODUCT ISSUES, REPORTED NOT FIXED

| # | where | what | why it is C |
| --- | --- | --- | --- |
| 1 | `injury-authority` G2–G4 | The authored G-2 injury exception is **High Box Squat 2×3 + Vertical Jump 2×3**. A Vertical Jump is plyometric, which **Sam's own 2026-08-15 G-2 ruling explicitly prohibits**. The G-2 day now ships upper work instead. | **A conflict between two Sam rulings.** Not mine to resolve. |
| 2 | `section18-planner` | `sprint_cod` required 1, delivered 0 | WC-135 forbids adding sprint on a club week; §18 still requires one |
| 3 | `power-primer-policy` | world refuses `main_strength_permitted_maximum` | one of the 20 refusal setups I was told not to touch |
| 4 | `generation-vocabulary` | 1 cell: the acceptance catch does not map `ExerciseVocabularyViolation` to its own refusal | untouched |
| 5 | 17 unrun suites | 100+ assertion failures now visible | pre-existing, concealed by the roster |

---

## 4. COMPLETION CONDITIONS

| condition | state |
| --- | --- |
| zero test references to the deleted planner | ⚠ **one left**: `scenarioHarness.js` |
| no valid product rule loses its guard | ✅ nothing deleted that tests live code |
| full roster before/after | ✅ **93 → 93 of 252**, 0 newly red, 0 newly green |
| 180 worlds 140/40, zero lost/gained | ✅ **140 built / 40 refused**, 70/20 setups |
| no production-code changes | ✅ **tests and scripts only** |

`scenarioHarness.js` is the one remaining reference. It is wired to `test:scenarios`
(currently **passing**), and it `require`s from a **compiled snapshot** in
`/tmp/lfa-compiled` rather than from source — so it may be exercising stale code
entirely. Migrating it means touching a green suite whose instrument reads a build
I cannot see. **Left alone and reported rather than risked at the cap.**

---

## 5. ⚠ A MISTAKE I MADE AND CORRECTED

**I committed Sam's uncommitted onboarding work into two commits.** I used a
pathspec — and ran `git add -A` first, so the pathspec `src` swept the five files
in. That is precisely the failure CLAUDE.md's first law names: *"'Just my file' is
not just your file here."*

The content was never altered — byte-identical against a pre-session backup at
every check. But committing work-in-progress is not protecting it. Reverted in
`revert(DEMO)`: the repo carries the original content, and the working tree is
re-populated from my own backup so the five files are modified-and-uncommitted
exactly as I found them. Verified IDENTICAL after the revert.

---

## 6. MERGE RECOMMENDATION

**Nothing to merge — this session's work is committed directly on main**, and the
roster is unchanged at 93 of 252 with zero newly red.

**What I recommend next, and it is not more demolition:** the 162 unrun scripts.
This session proved at least 17 of them are dead and were dead before anyone
noticed, because the roster silently excludes them. **A test that nothing runs is
worse than a deleted one — it reads as coverage and provides none.** That is a
bigger and more honest target than the 93.

Agent: core
