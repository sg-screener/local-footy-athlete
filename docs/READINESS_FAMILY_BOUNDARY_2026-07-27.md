# Readiness law family — boundary report, 2026-07-27

Branch `close/readiness-law-family` (4 commits on top of `main` @ `cea7193`).
Not merged. `stash@{0}` is untouched.

## Step 1 — the failing case, identified without runtime probes

`src/__tests__/acceptedStateTransactionTests.ts:846`, property **"no structural
readiness change can bypass the gateway"**.

| | |
|---|---|
| iteration | **`sore`** — a general **moderate soreness** fact (not `flat`/fatigue) |
| profile | **Pre-season**, `early_preseason`, `weekKind: build` |
| fact date | **WEDNESDAY 2026-07-15** — mid-week |
| week start | Monday 2026-07-13 |
| `governedFromISO` | **set, and correct: `2026-07-15`** |
| contract | `requiredMinimum 3`, `plannerSelectedTarget 4`, kind `core`, **`achievedCount 3`** |
| reductions | **`[]`** — none, as the readiness law requires |
| finding | `planner_selected_target_miss:main_strength`, expected 4, actual 3 |

The `flat` iteration passes; the loop simply aborts at `sore` first.

## Step 2 — all three hypotheses were wrong

- **(a) contract never decorated** — no. The contract was *correct*: target 4,
  no reductions, and no optional week involved (`sessionsOptional` false).
- **(b) whole-week case, fact at week start** — no. The fact is mid-week and
  `governedFromISO` was set.
- **(c) `asIllnessRecoveryWeek` zeroing the whole calendar week** — no.
  Remainder scoping worked; delivered Mon/Tue were preserved.

**The actual cause.** Saturday's planned hinge lift was still present. It had
been **reclassified** from `main_strength` to `strength_accessory`.

`classifyGeneratedWorkoutRow` decides main-lift identity from prescribed
**sets** and **position** — both of which a deload changes. Evidence:

| | pre-fact | post-deload |
|---|---|---|
| Saturday | `Romanian Deadlift \| main_strength \| 3x` @ index 5 | `Romanian Deadlift \| strength_accessory \| 2x` @ index 2 |

The classifier's only clause that admits a moderate-load lift is
`sets >= 3 && repsMax <= 12 && load === 'moderate'`. The deload halved 3→2 sets
and trimmed the accessories ahead of it, closing both escape hatches at once.
High-load lifts (Back Squat, OHP, Pull-Ups) qualify on the registry tag alone
and were immune — the hinge slot alone carried it.

A main-strength exposure was deleted from the week's **structure** with no
authorised reduction to explain it. It was invisible on `main` because the
retired `moderate_reduction` tier lowered the contract target to 2. **The
readiness law removed the mask, not the defect.**

Fixed at the single owner (the pool registry already answers this by identity,
and the deload transform already trusts it) rather than at each of the 15
consumers of `role === 'main_strength'`.

A second defect surfaced from the test fixture: `deloadWeekRules` asked that
registry with the **raw** name while §18 resolves the alias first, so
"Romanian Deadlift" was an anchor to one owner and an accessory to the other —
and the accessory trim deleted the session's main lift outright.

## The four regressions that were hiding behind it

`stash@{0}` recorded "RED: 1 property test". The `test:bible` chain stops at the
first failing suite, so **everything after `test:accepted-state-transactions`
had never been run**. All of the following pass on `main`:

1. **R15 + R19** (`test:readiness-ownership`) — every severe-illness commit
   failed visible verification. Cause: `asIllnessRecoveryWeek` zeroed both §18
   numbers for strength but only the *minimum* for conditioning and sprint, so
   the optional week stayed committed to core targets it has none of by design
   (`planner_selected_target_miss:sprint_high_speed:0`). **Fixed.**
2. **5 of 6 failures in `test:illness-recovery-mode`** — same cause. **Fixed.**
3. **Invariant 10** (`test:illness-recovery-mode`) — asserted the retired
   `weekKind` proxy. Re-pointed at `deloadDoor` + the actual dose. **Fixed.**
4. **A Bible assertion** demanding typographic quotes the authored sentence
   never had. **Fixed.**

`test:fact-horizon` went from **13 failures to 3**.

## NOT COVERED

### 1. `poor_sleep_week` — the one remaining gate failure (3 assertions, one cause)

`test:fact-horizon` T2, T4 and R3. Diagnosed, **not fixed**:

```
week 2026-07-24, mode in_season_game_week, weekKind build, governed 2026-07-24
conditioning: requiredMinimum 3, achievedCount 2
finding: required_minimum_shortfall:conditioning, expected 3, actual 2
visible: Mon Strength/core, Tue Team/core, Thu Team/core,
         Fri Strength/OPTIONAL, Sat Game/core, Sun Recovery/recovery
```

`cooked_week` passes on the same seed because it mints an *optional* week
(required 0). `poor_sleep_week` maps to **`wrecked`** — deloaded, minimums
still standing — and the deloaded week delivers one fewer **core conditioning
exposure** than the minimum.

This is the same family as the fix above (a dose transform changing what §18
COUNTS), but closing it needs a ruling I did not want to guess at:

> Under "one quality exposure max, the rest easy aerobic", do the downgraded
> easy-aerobic rows still count as **core** conditioning exposures? And how do
> required minimums reconcile across the delivered/governed boundary when a
> mid-week fact regenerates only the remainder?

Per `CLAUDE.md` ("if the correct abstraction is unclear, ask first") this is
Sam's call, not a guess.

### 2. Tasks 8 and 9 from the stash — NOT LANDED

The three structural assertions, the reductions-typed invariant and
`INV_LOW_READINESS_MAKES_NO_COUNT_REDUCTION` for both tiers were **not**
written. Landing new invariants on top of a red gate would have buried the
remaining defect. They should follow item 1.

### 3. Step 3 — the `sessionsOptional` stamp's scoping: FLAGGED, NOT FIXED

Evidence captured during diagnosis, from the allocator on an optional week:

```
deloaded:true optional:true  targetCount 0
Mon..Sat ALL "recovery" — "Mobility, foam rolling, light movement"
```

Two concerns, neither closed:

- **It empties the week.** Sam's law is explicit that "absolutely cooked" *does
  not* empty the week — "it lifts the MINIMUMS so nothing is required, and the
  sessions remain, offered." The allocator replaces every session with a
  recovery session instead.
- **It re-plans delivered days.** The all-recovery plan covers Monday and
  Tuesday, i.e. days before the fact date. Whether they are restored downstream
  was not established — the optional path did not reject, so no payload was
  available to inspect, and confirming it would have needed the transaction
  probing that was ruled out.

Separately observed and unexplained: on the deloaded week the delivered Mon/Tue
main lifts went 3x → 2x (contract `meaningfulMainLiftSetCeiling: 2` applies
week-wide, including days before `governedFromISO`). Flagged, not investigated.

### 4. Not verified

- No device/simulator pass. Per Process Law L10 nothing here is "done".
- `test:compile` and everything after `test:fact-horizon` in the chain still
  have not run to completion — the gate stops at item 1.
- Untouched: whether `if (false)` / `true &&` fossils left by the migration in
  `coachingEngine.ts`, and the dead `readinessDeloaded || readinessDeloaded`
  branches in `recoveryAddonCoverage.ts`, should be swept.

## Gate state

| | before | after |
|---|---|---|
| `test:bible` | fails at suite 7 of 48 | fails at suite 18 of 48 |
| failing assertions | 1 visible, 4 hidden regressions behind it | 3, one shared cause |
| `test:accepted-state-transactions` | 9/10 properties | **10/10** |
| `test:readiness-ownership` | 20/22 | **22/22** (matches main) |
| `test:illness-recovery-mode` | 10/16 | **16/16** |
| `test:readiness-illness-law` | 64/71 | **71/71** |
| `test:deload-law` | 47/47 | **50/50** (+3 new) |
| `test:fact-horizon` | 13 failures | 3 |

**The gate is RED.** Nothing was merged to `main`.
