# STATUS — seat `ladder`

Mission: **BLOCK TWO — PROGRESSION LADDER AND RECOVERY RESPONSE.**
Base `3b5b59d0` (main). Branch `feat/block-two-ladder`, isolated worktree.

Name chosen 2026-08-16 after `ls docs/STATUS_*.md`: `blocktwo`,
`blocktwo-difficult` and `progression` are all taken by other seats and none of
them is this mission. `ladder` is the mission's own word.

**EVERY COMMIT FROM THIS SEAT ENDS `Agent: ladder`.**

Authority: `docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md`.
The clause table is `docs/BLOCK_TWO_LADDER_CLAUSE_TABLE_2026-08-16.md` — 9 of 20
required behaviours already had a production owner AND a guard; 11 were the build.

## BASELINE, MEASURED AT `3b5b59d0` BEFORE ANY EDIT

| suite | at base |
| --- | --- |
| `test:block-two-progression` | 37 / 0 |
| `test:block-two-difficult-missed` | 88 / 0 |
| `test:block-two-screen-delivery` | 35 / 0 |
| `test:block-two-boot-preservation` | 20 / 0 |
| `test:exercise-exclusions` | 51 / 0 |
| `test:strength-progression-inputs` | 18 / 0 |
| `test:clause-enforcement` | 136 / 136 |
| `test:ladder-wide` | **13 / 14 — one RED at base**, `most worlds actually built`. Parked baseline, not this mission's. |

## SLICE 1 — THE SECOND RUNG. `test:block-two-ladder`, 47 cells, 19 mutations red.

### THE FIVE MEASUREMENTS THAT DECIDED THE BUILD

**1. `section18Evidence` CARRIES THE SLOT ON EVERY COMPOSED ROW — AND HAD NO
TYPE.** `materialiseComposedWeek.ts:90` has written `slot: row.slot ?? null`
since 2026-08-16 and casts the row through `as unknown as WorkoutExercise`, so
the field every WC-030 count depends on was invisible to the compiler. Typed now
on `WorkoutExerciseSection18Evidence`.

**2. NO GENERATED WORLD CONTAINS HARD CONDITIONING — STILL TRUE ON `main`.**
64 of 64 conditioning days across 16 built worlds are `aerobic_base`. `sprint`,
`vo2`, `glycolytic`, `cod_decel` appear zero times. R-098 recorded this at
`6117a9fd`; `composeWeek` merging did not change it.

**3. THERE IS NO CONDITIONING-ONLY DAY.** 144 strength-only, 64 combined, **0
conditioning-only**. This is why the session feeling cannot answer "was the
strength hard" on its own, and why the split reads `conditioning.rpe` for the
conditioning half.

**4. THE 16-SET CEILING IS UNREACHABLE BY GENERATION.** Largest main/secondary
session total across 33 built worlds: **12**. Across seven consecutive real
rollovers driven through the ladder: **13**. The ceiling refusal has no generated
coordinate and its two cells say `[CONSTRUCTED]` in their own names.

**5. THE IN-BLOCK FREEZE ALREADY BREAKS THE CONTRACT'S ORDER.**
`utils/progressionRules.buildBuildOutput` returns `loadDelta: 'up'` **and**
`setsDelta: 'add_one'` on the same lift in the same rollover after three
consecutive full completions; `buildOverreach` does the same. The boundary now
has the last word on an added set exactly as R-098 gave it the last word on a
reduced one, and the rung is computed from the athlete's PREVIOUS prescription
rather than from the row — so the freeze's set and the ladder's set are the same
one set, not two.

### THREE MUTATIONS SURVIVED THE FIRST PASS AND EACH NAMED A REAL HOLE

**M1 — A GATE THAT NO WORLD COULD REACH.** `if (history.reduces) return []` stood
first in the ladder and deleting it changed nothing: `reduces` is
`recoveryVerdict === 'very_hard'` and `qualifies` requires
`recoveryVerdict === 'good'`, so `reduces` STRICTLY IMPLIES `!qualifies`.
**Three gates were catching one fixture.** Deleted, with the reasoning kept on
the gate that does bind. The contract's *"do not add in this state"* is enforced
once and the very-hard cell proves it.

**M3 — AN AMBIGUOUS ANSWER HAD NO WORLD.** Every fixture that made the strength
quality hard also made the block fail `qualifies`, so the strength-quality gate
was never the thing doing the work. Closed by a block in which **every session
carried both strength and conditioning**: the block still qualifies, the strength
quality reads `unknown` because no answer was only about lifting, and the ladder
must add nothing. That is the commonest shape for an athlete on a Mixed day.

**M12 — "THE COMBINED DAY'S FEELING IS A STRENGTH ANSWER" WAS UNTESTED.** The
conditioning-hard fixture answered `feeling: 'good'` on its combined days, so
counting them changed no verdict. Closed by a block whose combined days answer
`very_hard` while the pure lifting days answer `good` — the contract's own
"strength easy, conditioning difficult" case, where a read that counts the
combined day calls STRENGTH brutal on the strength of an answer about running.

### WHAT THE LADDER ACTUALLY DOES, MEASURED OVER SEVEN REAL ROLLOVERS

Same athlete, blocks 2→8, each block's history harvested from the block the
generator produced. Per rollover: every lift with recorded history takes the LOAD
rung (`Deadlift 95 → 97.5 → 100 → 102.5 → 105 → 107.5`), and a set lands only on
a lift whose load did not move — `Seated DB Press 2→3`, `Bulgarian Split Squats
3→4`, `Close Grip Bench 3→4`, `Pull-Ups 2→3`. **No lift ever took both rungs in
one rollover.** No rep range moved. The deload week never rose. Session
main/secondary totals stayed between 10 and 13.

### ONE INTERPRETATION SAM MAY WANT TO OVERRULE

The rung is **one set per SESSION**, on that session's first eligible main lift.
The contract's cap is stated per session (*"the session remains inside its
approved cap"*), and a session with four eligible lifts gaining four sets is a
jump of four rather than the smallest next step. It is NOT one set per block: a
three-day week gains one set on each of its three days. If Sam wants one set per
BLOCK, it is a one-line change in `decideBlockBoundarySetAdditions`.
