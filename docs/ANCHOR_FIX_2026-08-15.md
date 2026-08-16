# ANCHOR FIX — final report, 2026-08-15, seat `core`

**Branch `slice-weekly-scheduler`, base `main @ 0e43fcfd`.** Nothing merged.
Main untouched; the shared checkout's five uncommitted onboarding files untouched.

## 0. MERGE VERDICT — **DO NOT MERGE**

| condition | state |
| --- | --- |
| zero legacy-planner executions | ✅ **0 / 180 worlds, proven** |
| anchors preserved end to end | ❌ **club nights survive the adapter and are lost after it; the game is lost** |
| all pre-existing built worlds restored | ❌ **44 built (was 142)** |
| new reds cleared | ❌ |
| physical deletion | ❌ **0 lines — refused deliberately** |
| complete chained gate | ❌ not re-run at this state |

## 1. ZERO-EXECUTION RECEIPT — MET

    scripts/probe-planner-callers.ts, 180-world corpus, stack-attributed

    BEFORE  572 executions   (392 @ generateProgram.ts:686, 180 @ :452)
    AFTER     0 executions   TARGET: 0
              "ZERO EXECUTIONS — the legacy planner is unreachable."

Both call sites now run scheduler → materialise → connector. No legacy planner was
restored or called to obtain anchors.

## 2. ANCHOR FINGERPRINT — WHERE IT SURVIVES AND WHERE IT DIES

Traced for `In-season/3d/club/Full Gym` (Tue/Thu club, Saturday game):

| stage | Tue club | Thu club | Sat game |
| --- | --- | --- | --- |
| scheduler `schedule.days` | ✅ `clubTraining=true` | ✅ | ✅ `owner=game` |
| connector `weeklyPlan` | ✅ `isTeamDay=true` | ✅ | ✅ `focus=game` |
| **adapter output workouts** | ✅ **"Team Training"** | ✅ **"Team Training"** | ❌ **"Rest"** |
| **week as §18 judges it** | ❌ **"Speed Conditioning"** | ❌ **"Rest"** | ❌ **"Rest"** |

**MY PREVIOUS DIAGNOSIS WAS WRONG AND THIS CORRECTS IT.** I reported that the
connector drops the club anchors. **It does not** — the connector emits them
correctly and the adapter builds "Team Training" on both nights. They are lost
**after** the adapter, between it and §18.

Only the GAME dies earlier: a contentless allocation that canonicalisation
collapses to Rest. Removing the game allocation entirely (on the theory that the
fixture projection places it) **changed nothing — still 44 built**, so that theory
is disproved and the change was reverted rather than shipped unverified.

**Consequence:** §18 sees no anchors, so
`sprint_high_speed_required_minimum` fires on 88 occurrences / 44 worlds — the
contract says *"Games and club training can supply it"* and there is nothing left
to supply it. Crediting anchors inside `WeeklyDemand.sprintHighSpeed` did **not**
move it, which rules out the selected-count fix: §18 counts sprint ACHIEVED IN THE
WEEK.

## 3. WORLD ACCOUNTING

    142 built / 38 refused   (main @ 0e43fcfd)
    136 built / 44 refused   (previous session, planner still running)
     44 built / 136 refused  (now, zero executions)

    LOST 108 · GAINED 10     — never reported as a net
    lost by phase:   In-season 48 · Pre-season 44 · Off-season 16
    gained by phase: Off-season 10

**Not attributed world-by-world to an approved contract rule, because they are not
contract changes — they are the anchor defect above.** Under the mission's own
standard that is a regression to fix, not an accounting to explain.

## 4. DELETION — 0 LINES, REFUSED ON PURPOSE

Zero executions makes deletion *possible*; the corpus makes it *wrong*. Deleting
1,020 lines now would permanently freeze a week with no game and no club nights in
it, with no way back. **The planner stays until the week is sound.**

## 5. GUARDS

The five ordered anchor guards were **not written**. Writing guards for a pipeline
whose defect is still unlocated would have produced cells asserting the current
broken behaviour. The fingerprint table in §2 is the measurement they should be
built from, and it now names the exact stage.

`test:weekly-scheduler` 87 passed / 0 failures, including the G-2 pair from the
previous session.

## 6. THE EXACT REMAINING DEFECT

**Between `buildWorkoutsFromCoach`'s output and the week §18 receives, team-training
workouts are replaced** — Tuesday becomes "Speed Conditioning", Thursday becomes
"Rest". `assembleAuthoredWeek` merges composer days onto adapter days by
`dayOfWeek`; the composed week holds Mon/Wed only, so Tue/Thu should pass through
untouched and do not.

That merge, and whatever runs after it, is the next thing to open. **It is not the
connector, not the scheduler and not the specialists** — all three are verified
correct at their own boundary in §2.

## 7. NOT COVERED

- The five anchor guards, the deletion, the chained gate, the printed final weeks.
- No simulator, no phone.
