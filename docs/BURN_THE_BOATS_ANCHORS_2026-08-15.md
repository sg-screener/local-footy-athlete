# BURN THE BOATS — deletion, then the anchor fix. 2026-08-15, seat `core`

**Branch `slice-weekly-scheduler`.** Worktree-isolated; the shared checkout's
uncommitted onboarding-copy files were never touched.

Rollback point: tag **`pre-legacy-planner-deletion`** at `9e6e423f`.

---

## 0. VERDICT — **DO NOT MERGE.** Sam reviews the week first, as ordered.

| condition | state |
| --- | --- |
| legacy planner physically deleted | ✅ **1,234 lines** |
| zero legacy-planner executions | ✅ not exported — stronger than a zero count |
| five anchor guards written first, seen RED | ✅ 3/10 → **12/12** |
| each defence individually mutation-proven | ✅ §4 |
| merge replaced structurally, by ownership class | ✅ §3 |
| no weekday / type-name / session-name patched | ✅ **zero name matches in the fix** |
| worlds restored | ⚠ **44 → 140.** Baseline main was 142 |
| no threshold, ratchet or baseline reset | ✅ none, anywhere |
| every remaining red visible and attributed | ✅ §6 |

---

## 1. DELETED

`src/utils/coachingEngine.ts` **9,074 → 7,840 lines (−1,234)**. No file removed
entirely — the planner was a region of one large module.

`buildCoachingPlan` (727) · `buildAIConstraints` (196) ·
`buildParallelSection18Contract` (147) · `section18ModeAndSubphase` (71) ·
`testingEffectReason` (23) · `underlyingModeFor` (14) ·
`firstPlanShapeDifference` (12) · `getOptionalFocus` (11) ·
`appendAllocationCoachNoteEffect` (9) · `hasActiveTestingBias` (5) · +1 (19)

The unreachable set was **computed to a fixpoint**, not eyeballed
(`scripts/find-unreachable-engine-helpers.ts`): round 1 the planner + 3, then 6
functions / 256 lines, then 1 / 19, then CASCADE COMPLETE.

> ⚠ My first deletion pass removed three helpers that **had live callers inside
> the same file** — my grep for "external consumers" excluded the file they lived
> in. Restored from the tag and redone from the computed cascade. That is why the
> tool exists and why it deletes nothing itself.

**Zero-execution receipt.** `scripts/probe-planner-callers.ts` reports
*"buildCoachingPlan IS NOT EXPORTED — the legacy planner is DELETED"*. It was
changed to say that rather than print `0 executions`: once the symbol is gone the
probe's wrapper never installs, so a "0" would have been the count of a thing it
was no longer watching.

---

## 2. THE GUARDS — WRITTEN FIRST, AND RED

Committed **before** the fix, in `e66b4868`:

    FAIL  the anchor world produces a week      <- refused outright
    FAIL  the fixture carries the GAME type
    FAIL  the fixture is present at all
    FAIL  club night Wednesday carries TEAM TRAINING
    FAIL  club night Friday carries TEAM TRAINING
    FAIL  every club night the athlete declared is present
    FAIL  at least one club night also carries app strength content
    passed=3/10   ->   after the fix: passed=12/12

**Three of the ten passed vacuously in that red run** — "no anchor is Rest" and
"no anchor is overwritten by conditioning" were green because the week was
*empty*. The suite says so out loud: cell `[0]` is a non-vacuity arm that fails
first. Without it the suite would have read 3/10 healthy on a week containing
nothing.

**They test the class, never a weekday.** The fixture world uses **Wednesday and
Friday club nights and a SUNDAY game** — deliberately not the app's historical
defaults — with gym access that OVERLAPS both club nights so the same-day case is
exercised rather than assumed away. Every assertion reads a typed property.

---

## 3. THE OWNERSHIP CLASS

**Day identity was reconstructed by every reader instead of carried from its
owner.** `isTeamDay` was the single typed day-fact in the pipeline, and it was the
single anchor that survived to the athlete. Everything else was re-derived from
loose hints — a `conditioningFlavour` here, a `strengthPattern` there, in a fixed
precedence — and the fixture had no typed carrier at all.

`AuthoredDayIdentity` (`src/types/domain.ts`) is the general form: `anchor` is the
day's immovable identity, `components` is what it may contain. **Scheduler states
it → connector carries it → adapter stamps it on the workout → assembler defends
it.** Writer, reader and behavioural test are all named on the field.

### Five readers were guessing. Measured, not reviewed.

I had already misdiagnosed this file twice from reading it, so
`scripts/probe-anchor-loss.ts` prints scheduler / connector / adapter / final side
by side for one real athlete. **It refuted my own standing diagnosis on the first
run:** the club nights were *not* being lost, and `assembleAuthoredWeek` was not
the owner I had named in the previous report.

| # | reader | what it did | effect on the athlete |
| --- | --- | --- | --- |
| 1 | connector | emitted no game carrier at all | fixture became **Rest** |
| 2 | `normalizeGeneratedWorkoutType` | tested flavour **above** pattern | strength+conditioning day → "Conditioning" |
| 3 | `fallbackWorkoutTypeForPlanEntry` | **the same inference a second time** | same two defects, second site |
| 4 | standalone-conditioning branch | **built a whole day inline**, never reaching the resolver | **Monday's lifts deleted** |
| 5 | `assembleAuthoredWeek` | retyped a club night to "Mixed" once gym work merged onto it | club night stopped being one |

Plus: `builtWorkout` **never wrote `isTeamDay` at all** — it passed the flag to the
name resolver and dropped it, so both club nights reached §18 as ordinary days.

(3) is the §8 second-wall shape: fixing either site alone would have left the
other. Both now call **one** resolver.

### The anchor credit — a genuine conflict, resolved by Sam's own line

The approved contract forbids **adding** sprint work on a club-training week, and
§18 requires ≥1 sprint night. Anchors carried `participation: 'unknown'` — nobody
has reported anything, because the week is being *authored* — so they earned
nothing, and the app had **no legal way** to satisfy the minimum.

Sam, this brief: *"conditioning/sprint credit supplied by those visible anchors."*

The anchor already records what generation knows:
`participationProvenance: 'derived_healthy_unrestricted'`. A derived-healthy anchor
now participates normally **for the purpose of judging the week being handed over**.

> ⚠ It is **not** promoted to `explicit`, and nothing is written back. `explicit`
> means the *athlete* said so and the safety boundary treats it very differently;
> a derived assumption laundering itself into a reported fact would be the worse
> defect by far. A real participation fact is not derived, and it wins.

---

## 4. MUTATION RECEIPTS — each defence removed **alone**

    assembler anchor defence removed   -> FAIL both "club night carries TEAM TRAINING"
    shared identity resolver disabled  -> FAIL "fixture carries GAME", "no anchor is Rest"

### ⚠ Two of my own instruments were wrong first, and both read GREEN

- **A half-mutation.** I removed the reader in `normalizeGeneratedWorkoutType` but
  left the *same* resolver reachable through `fallbackNameForPlanEntry`'s sibling,
  so the fixture survived anyway and all ten cells stayed green. I verified the
  edit had applied — it had. The mutation was simply incomplete.
- **A hedge in an assertion.** The club-night cells read
  `type === 'Team Training' || isTeamDay`. `isTeamDay` is set by a path that
  pre-dates this work, so removing the assembler defence — the thing that actually
  stops the retype — **reddened nothing**. Split into two cells; now killable.

---

## 5. WORLD ACCOUNTING

    main @ 0e43fcfd (baseline)     142 built /  38 refused
    after deletion (1bd79e1b)       44 built / 136 refused    <- authorised broken state
    after the merge fix              140 built /  40 refused

Remaining 40 refused occurrences = **20 distinct worlds**, three families, **none
about anchors**:

| occ | worlds | finding | profile |
| ---: | ---: | --- | --- |
| 20 | 10 | `main_strength_planner_selected_target` | **Bodyweight Only**, In-/Pre-season 4–6d |
| 16 | 8 | `hard_day_permitted_maximum` + `main_strength_permitted_maximum` | Off-season 5–6d, Full Gym / Dumbbells |
| 4 | 2 | `hard_day_permitted_maximum` | Off-season 5–6d, Bodyweight Only |

**2 occurrences short of the 142 baseline, and I am not claiming parity.**

---

## 6. GATES — every red visible, none reset

**`scripts/sweep.sh`, and the count on its own is meaningless**, so the failing
suite **names** were diffed against a full sweep of the rollback point run in a
second worktree at the tag:

    rollback point  (pre-legacy-planner-deletion)   96 red
    this branch                                      96 red
    NEW: 5      NEWLY GREEN: 5      net 0

| new reds | newly green |
| --- | --- |
| `readiness-dose-sweep` | `action-log` |
| `readiness-structure-law` | `coach-add-session-ownership` |
| `rules-kernel` | `mobility-accessory-doors` |
| `strength-answer-authority` | `onboarding-generation-outcome` |
| `weekly-dose-ownership` | `strength-variants` |

**`test:compile` — FAILED, 39 file/scope pairs worse, and all 39 are `[tests]`.
Zero product files and zero devtools files regressed.** They reference symbols the
deletion removed. Left visible and unfixed, as ordered; **no baseline entry, floor,
ceiling, ratchet or allow-list was touched anywhere in this mission.**

---

## 7. THE ANCHOR WEEK, AS THE ATHLETE RECEIVES IT

In-season · 4 gym days · club Wed+Fri · game Sunday · gym access overlaps both club nights

| Day | Type | Team? | Session | Rows |
| --- | --- | --- | --- | ---: |
| Monday | Mixed | | lower | 6 |
| Tuesday | Rest | | Rest | 0 |
| Wednesday | Team Training | club | Team Training | 4 |
| Thursday | Rest | | Rest | 0 |
| Friday | Team Training | club | Team Training | 4 |
| Saturday | Rest | | Rest | 0 |
| Sunday | Game | | Game | 0 |

    Monday — Mixed          Back Squat, Deadlift [main] · Bulgarian Split Squats,
                            Single-Leg RDL, Ab Wheel [accessory] · Continuous Aerobic Run
    Wednesday — Team Tr.    Barbell Row [main] · Lat Pulldown, Band Pull-Apart
    Friday — Team Tr.       Bench Press [main] · DB Shoulder Press, Banded Bicep Curl

**This week is not coach-approved.** It is structurally correct against the guards.

---

## 8. WHAT REMAINS GENUINELY BROKEN

1. **Two worlds short of baseline** (140 vs 142), unattributed.
2. **20 worlds still refuse** — bodyweight-only strength targets, off-season
   hard-day and strength ceilings. Neither family is an anchor defect and neither
   was investigated this session.
3. **`test:compile` fails on 39 test files.** Deliberate and visible.
4. **96 red suites**, unchanged in count from the rollback point but with 5 new
   ones named above. Not investigated.
5. **Monday is named "lower"** — a raw purpose token as an athlete-facing session
   name. Different owner (the composer names its own days), outside the anchor
   class, so it was reported rather than absorbed.
6. **No simulator, no device, no relaunch.** Every claim here is headless.
7. The anchor-credit change is judged only at the **generation** boundary. Whether
   a stored or replayed week should read a derived-healthy anchor the same way is
   **not** settled and was not touched.

Agent: core
