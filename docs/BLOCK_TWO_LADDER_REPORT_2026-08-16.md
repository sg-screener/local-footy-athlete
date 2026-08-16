# BLOCK TWO — PROGRESSION LADDER AND RECOVERY RESPONSE: THE REPORT

Seat `ladder`. Base `3b5b59d0` (main). Branch `feat/block-two-ladder`, isolated
worktree. Two commits: `ba0b6806` (rung two), `e05ab118` (rung three + R-101).

Clause table: `docs/BLOCK_TWO_LADDER_CLAUSE_TABLE_2026-08-16.md`.
Seat findings: `docs/STATUS_LADDER.md`. Registry row: **R-101**.

## 1. CLAUSE TABLE — BEFORE AND AFTER

| # | Required behaviour | BEFORE | AFTER |
| --- | --- | --- | --- |
| P1 | load through the canonical owner | **REUSE** `decideBlockBoundaryLoads` (R-096/R-097), `test:block-two-progression` | unchanged |
| P2 | one set when load must not rise | **NONE at the boundary**; the in-block freeze emits `add_one` *together with* `loadDelta: 'up'` | **BUILT** `decideBlockBoundarySetAdditions`, `test:block-two-ladder` |
| P3 | offer one extra session, never silently | probe + question/answer machinery existed for the SMALLER direction only | **BUILT** `rules/extraSessionOffer.ts` + card + door, `test:block-two-extra-session` |
| S1 | at most one set, main or secondary | — | **BUILT** |
| S2 | never exceed the 16-set session ceiling | `SET_CEILING` module-private; WC-030 checks the LAYOUT, never a session | **BUILT** (count), **REUSED** (constant, now exported) |
| S3 | accessories/core outside the count | `slotCountsTowardSetBudget` + `section18Evidence.slot` (untyped) | **REUSED**, and the slot is **typed** now |
| S4 | no reps to manufacture progression | held on the reduction path only | **BUILT** (assertion) |
| S5 | never load + sets on one lift in one rollover | **NONE — actively broken by the freeze** | **BUILT** |
| S6 | prescriptions remain editable | manual/weight override doors | unchanged |
| Q1 | strength easy / conditioning hard → strength only | one whole-block verdict; `conditioning` never read | **BUILT** — `byQuality` split |
| Q2 | conditioning easy / strength hard → conditioning only | — | **HALF BUILT** — strength is held; conditioning has no rung to climb (§5) |
| Q3 | everything easy → load, sets, then offer | — | **BUILT** |
| Q4 | a difficult quality stays achievable | `applyBlockBoundaryConditioning` replaces, never deletes | unchanged |
| L1 | hard conditioning reduced first | **REUSE** (R-098) | unchanged |
| L2 | main/secondary sets reduced | **REUSE** (R-098) | unchanged |
| L3 | replaced with easy aerobic | **REUSE** (R-098) | unchanged |
| L4 | meaningful load retained | **REUSE** (R-096/R-098) | unchanged |
| L5 | never add load, sets or sessions | load only | **BUILT** — sets and sessions gated |
| L6 | hard conditioning falls before strength volume | ordered at the call site, not asserted | **NOT COVERED** (§5) |
| L7 | injury outranks | injury system | unchanged |

**9 of 20 reused. 10 built. 1 not covered.**

## 2. REPRESENTATIVE HISTORIES AND WHAT BLOCK TWO DID

All histories harvested from the block the generator actually produced; only
the athlete's ANSWERS vary. Pre-season athlete, three gym days, club nights.

| the athlete said | load | sets | conditioning | session offer |
| --- | --- | --- | --- | --- |
| completed 12/12, `good` / `mild` | **UP** on every lift with history | **+1** on the first eligible lift of each build session whose load held | unchanged | none — `good` is not `easy` |
| completed 12/12, `easy` / `none` | UP | +1 | unchanged | **OFFERED** |
| completed 12/12, `very_hard` / `high` | **HELD** | **REDUCED** (R-098) | replaced if hard (unreachable) | none |
| answered nothing | HELD | unchanged | unchanged | none |
| completed 5/12 | held | unchanged | unchanged | none — the *smaller* commitment question instead |
| strength days `good`, conditioning RPE **9** | UP | **+1 (strength progresses)** | unchanged | none |
| strength days `very_hard`, conditioning RPE **4** | held | **none** | unchanged | none |
| every session COMBINED, `good` / `mild` | UP | **none — the answer is ambiguous** | unchanged | none |

## 3. EXACT DELTAS — SEVEN CONSECUTIVE REAL ROLLOVERS

Blocks 2→8, each block's history harvested from the previous block's real
programme, compared against the same history with the recovery answers stripped.

```
block 3   LOAD Kettlebell Swings 24 → 28      SETS Seated DB Press        2 → 3
          LOAD Walking Lunges    25 → 27.5    SETS Bulgarian Split Squats 3 → 4
          LOAD Goblet Squat      27.5 → 30
          LOAD Deadlift          95 → 97.5
block 4   LOAD Goblet Squat      30 → 32.5    SETS Close Grip Bench       3 → 4
          LOAD Hip Thrusts       87.5 → 90
          LOAD Deadlift          97.5 → 100
block 5   LOAD Leg Press        132.5 → 135   (no set: every counting row's load rose)
          LOAD Deadlift         100 → 102.5
block 6   LOAD Bench Press       85 → 87.5    SETS Pull-Ups               2 → 3
          LOAD Deadlift         102.5 → 105
block 7   LOAD Goblet Squat      37.5 → 40    (no set)
          LOAD Deadlift         105 → 107.5
```

**No lift ever took both rungs in one rollover. No rep range moved anywhere. The
deload week never rose. Session main/secondary set totals stayed between 10 and
13, never near the ceiling of 16.**

## 4. THE PROGRAM SCREEN — OFFER AND TAPS

The card is called as the component it is, its element tree walked, and the
node's own `onPress` invoked — the same closure a finger reaches.

| | result |
| --- | --- |
| sentence rendered | *"You’ve been completing your training consistently and recovering well. Your schedule allows another session. Would you like to add one session each week?"* — byte-for-byte |
| buttons rendered | **Add one session** · **Keep my current schedule** — byte-for-byte |
| rendering alone | **no handler fired** — nothing is added by drawing the card |
| tap *Add one session* | asked for **4** sessions a week (from 3) |
| tap *Keep my current schedule* | decline handler once, accept handler untouched |
| the offered week | `Monday / Wednesday / Friday` **+ Saturday** — every chosen day kept, one free day added, and no other free day would have left the week better separated |
| does it build? | **yes** — generation builds the four-day week before the card ever renders |

**NOT SEEN ON GLASS.** No device has rendered this card. That receipt is owed.

## 5. PERSISTENCE

| | result |
| --- | --- |
| stored set counts vs what the screen shows | identical |
| projection handed a CONTRADICTORY history | does not move — it displays, it does not decide |
| regenerate from the same recorded history | same set counts, byte for byte |
| decline → ledger | one `weekly_commitment_answer` entry, `declined` |
| decline → the offer | not put again in this block |
| decline → the programme | every set, rep and load identical |
| relaunch (rederive from the persisted ledger) | still silent |
| an answer against ANOTHER block | does **not** silence this one |

**No new persisted key.** Both answers ride the existing decision ledger, so
`test:persisted-inputs-schema`'s four-class property is untouched (8/0).

## 6. MUTATION RECEIPTS — 39 MUTATIONS, ALL SEEN RED, NO SURVIVORS

`test:block-two-ladder` 47 cells · `test:block-two-extra-session` 38 cells.

**EIGHT SURVIVED A FIRST PASS. Each named a real hole; three were the same
shape.**

| survived | what it proved | closed by |
| --- | --- | --- |
| M1 | `if (history.reduces)` was a gate **no world could reach** — `reduces` strictly implies `!qualifies` | the gate **deleted** |
| M3 | every strength-hard fixture also failed `qualifies`, so the quality gate never did the work | a block of **only combined sessions**: it qualifies, the strength answer is ambiguous, nothing is added |
| M12 | the conditioning-hard fixture answered `good` on its combined days, so counting them changed no verdict | a block whose **combined days answer `very_hard`** while pure lifting days answer `good` |
| E10/E11 | the explicit no-free-day refusal was **subsumed** by the un-growable-patch check | the redundant gate **deleted** |
| E16 | every fixture was already at block 2 | a block-1 derivation |
| E17 | the ordering witness was asserted true and passed in by hand — never made to say NO | block 1's own programme, whose stored explanation is empty |
| E21 | the decline used a hand-written block number, not the card's | the offer's own `forBlockNumber`, asserted and used |

Mutations proven red include: both gates deleted; the rung set to two; the
ceiling raised to 99; the ceiling made unreachable by one; the slot ignored in
the count and in eligibility; the rung added to the row instead of the previous
prescription; the freeze snapshot ignored; reps moved by the apply pass; the
ladder never called by generation; the effort band moved to 7 and to 10; silence
read as good; secondary preferred over main; the legality probe ignored;
availability forgetting team nights, the game day and constraints; an inactive
constraint treated as live; growth taking the first free days instead of the
best separated; growth dropping one of the athlete's own days; the decline button
removed; the sentence and the accept label reworded.

## 7. GATE NUMBERS — BOTH ARMS, CLEAN `3b5b59d0` CONTROL WORKTREE

| suite | control | branch |
| --- | --- | --- |
| `test:compile` | 6 worse pairs | **6 — the same six**, all pre-existing bibleConformance observation files |
| `block-two-progression` | 37 / 0 | 37 / 0 |
| `block-two-difficult-missed` | 88 / 0 | 88 / 0 |
| `block-two-screen-delivery` | 35 / 0 | **35 / 0** (see below) |
| `block-two-boot-preservation` | 20 / 0 | 20 / 0 |
| `exercise-exclusions` | 51 / 0 | 51 / 0 |
| `strength-progression-inputs` | 18 / 0 | 18 / 0 |
| `missed-sessions` | 10 / 0 | 10 / 0 |
| `clause-enforcement` | 136 / 136 | 136 / 136 |
| `weekly-scheduler` | 84 / 84 | 84 / 84 |
| `week-validator` | 47 / 2 | 47 / 2 |
| `persisted-inputs-schema` | 8 / 0 | 8 / 0 |
| `copy-rulings-binding` | 9 / 0 | 9 / 0 |
| `computed-must-be-consumed` | 4 / 0 | 4 / 0 |
| `stored-state-writer-audit` | 10 / 0 | 10 / 0 |
| `feature-registry` · `dead-affordances` · `ui-picture-manifest` | 6/0 · 6/0 · 5/0 | identical |
| **`ladder-wide`** | **13 / 14** | 13 / 14 — the parked baseline red |
| `signed-copy-extraction` | 7 / 1 | 7 / 1 — the athlete-visible ceiling, 585 vs 580, unchanged |
| `ruling-registry` · `law-registry` · `repo-law-guards` | 6/2 · 12/2 · 55/8 | identical |
| `program-control-durable` · `decision-ledger-ownership` | 9/11 · 7/1 | identical |
| **NEW** `block-two-ladder` | — | **47 / 0** |
| **NEW** `block-two-extra-session` | — | **38 / 0** |

`block-rollover`, `block-state` and `deload-week` crash at import in **both**
arms — pre-existing, not repaired here.

**No baseline, ratchet or allow-list was reset.** `scripts/typecheck-baseline.json`
is untouched.

**⚠ ONE REGRESSION I CAUSED AND FIXED, RECORDED BECAUSE IT WAS A REAL DEFECT.**
`block-two-screen-delivery` went 35/0 → **33/2**. Its cost property — *"an
athlete who was never going to be asked must not pay for the legality probe"* —
is instrumented by a profile proxy counting reads of `preferredTrainingDays`.
The offer's derivation computed the athlete's free days **eagerly**, before the
first gate, so every athlete on every redraw of the Program surface touched that
field — and would have paid a whole generation the moment the gate order
shifted. Both reads are inside the closures now; 35/0 restored, and the same
property is held for the offer in its own suite.

## 8. MERGE RECOMMENDATION

**MERGE.** The two new suites are 85 cells with 39 mutations proven red and no
survivors; every existing suite is byte-identical to a clean control worktree at
the base commit; `test:compile` shows no new pair. The athlete-visible change —
a main lift going from three sets to four, and a card asking before a fourth
training day is added — is guarded through the real generation path, the real
component and the real door.

**One thing to hear from Sam first, and it is not a blocker:** the rung is **one
set per SESSION**, on that session's first eligible main lift, so a three-day
week gains one set on each of its three days. The contract states its cap per
session (*"the session remains inside its approved cap"*) and a session gaining
four sets at once is not the smallest next step — but "one set per BLOCK" is a
legitimate other reading and is a one-line change.

## 9. NOT COVERED

1. **The 16-set ceiling has no generated coordinate.** Largest main/secondary
   session total across 33 built worlds: **12**; across seven real rollovers
   through the ladder: **13**. Its two cells are marked `[CONSTRUCTED]` in their
   own names. **The missing producer is a layout that authors a 15–16-set
   session.** Not claimed as a generated proof.
2. **Q2's "progress conditioning" half.** Every generated conditioning exposure
   is already `aerobic_base`, the easiest authored category — 64 of 64 across 16
   worlds. There is no rung to climb to. **The missing producer is a
   scheduler/§18 change that emits `tempo`, `vo2`, `sprint` or `glycolytic`.**
   What IS proven for that case: a strength-hard block progresses **no** strength.
3. **L6 — "hard conditioning falls before strength volume" is not independently
   asserted.** The call order at the one call site is the contract's, and R-098
   owns both halves, but the ordering itself has no cell — and the
   hard-conditioning coordinate is unreachable for the same reason as (2).
   Not faked against a synthetic world.
4. **The "unavailable" half of rung 3's trigger.** Every qualifying athlete's
   block raises at least one load, so no generated world reaches "the smaller
   rungs had nowhere to go". Only the *insufficient* branch is built.
5. **No device has rendered the offer card.** The element-level suite proves the
   behaviour, the words and the taps; it does not prove layout, styling, or that
   the card is mounted where a human can see it.
6. **The full accept transaction is not driven end to end.** What is asserted is
   the PATCH the door is handed (four days, best separated, buildable by
   generation) — driving `commitProfileProgramTransaction` needs the store stack
   the screen-delivery suite stands up.
7. **Pre-existing debt left alone**, as instructed: `ladder-wide` 13/14,
   `signed-copy-extraction` 7/1, `week-validator` 47/2, `ruling-registry` 6/2,
   `law-registry` 12/2, `repo-law-guards` 55/8, `program-control-durable` 9/11,
   `decision-ledger-ownership` 7/1, and the three suites that crash at import.
