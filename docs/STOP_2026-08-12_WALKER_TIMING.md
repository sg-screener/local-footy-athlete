# STOP — THE CHAIN'S 25 MINUTES WAS A SHRINK STORM, NOT A SUITE

**2026-08-12. HEAD `0ad3793f`, branch `main`.** Pays the measurement half of
seat inbox item 2 ("MAKE THE CHAIN CHEAP"). **Its premise is REFUTED by
measurement and the item is rewritten, not ticked.**

---

## 1. WHAT THE ORDER SAID, AND WHAT IS ACTUALLY TRUE

The order, verbatim: *"THE REAL BOTTLENECK IS ONE SUITE ... the sweep is ~35
minutes and `action-walker:deep` alone is ~25 — ~70% of the wall clock in one
suite. **Shard it**, or take it out of the per-unit chain."*

**The ~25 minutes was real on 2026-08-12 and the ~70% share was right. Every
other word of the diagnosis was wrong, and the prescribed fix would not have
worked.**

`action-walker:deep` is not an expensive suite. Recorded, from this repo's own
artefacts:

| when | wall | verdict |
|---|---|---|
| 2026-08-07 (`agreement-serial.json`) | **31.8s** | green |
| 2026-08-10 21:36 (`results-parallel-8.json`) | **34.6s** | green, seed 3 clean |
| 2026-08-12 | **~25 min** | RED |
| 2026-08-12, after the cap | **213s** | RED, same verdict |
| 2026-08-12, after §7 was paid | **47s** | seed 3 CLEAN |

**It is 25 minutes because it went RED, and for no other reason.** The order was
written from the terminal's own commentary and nobody had looked inside.

## 2. WHERE THE TIME ACTUALLY GOES — per step, not a total

Measured with a read-only probe wrapping the engine's host hooks; 180 real steps
across seeds 1 and 2.

| door | calls | total | avg | median | max |
|---|---|---|---|---|---|
| `plan_change` | 99 | 12.06s | 122ms | 88ms | 697ms |
| `mark_calendar` | 30 | 2.57s | 86ms | 35ms | 1409ms |
| `advance_time` | 30 | 0.18s | 6ms | 1ms | 60ms |
| `generate_program` | 2 | 0.09s | 43ms | — | 61ms |
| everything else | 19 | 0.02s | 1ms | 1ms | 2ms |

- **All seven laws, checked after every action: 846ms across 180 steps — 5ms a
  step, 5% of the walk.** The invariant block is not the cost.
- **A whole 90-step walk costs 7-9 seconds.** Three of them: ~25 seconds.
- **`freshInstall` is 0-3ms and runs ONCE per walk.** Generation runs once per
  walk at 43ms. **Nothing is rebuilt per step.**
- **No fixed sleeps, no polls, no retries, no timeouts, no network, no disk.**
  Two `setTimeout(resolve, 0)` yields exist and are macrotask hops, not delays.

## 3. THE ONE BUDGET IN THE FILE, AND IT WAS THE WHOLE 25 MINUTES

Seed 3 breaks `L-P4 MENU = PROJECTION` at step 87. `shrink()` then delta-debugs:
drop one action, **replay the entire history from a fresh install**, repeat —
the guard was **200**, and a deep replay costs **11-15 seconds**.

Watched live, replay by replay:

```
replay  4  +31s   history 88      replay 26  +382s  history 82
replay  5  +45s   history 87      replay 33  +466s  history 81
replay  8  +99s   history 86      replay 41  +560s  history 80
replay 11  +153s  history 85      replay 49  +657s  history 79
replay 15  +218s  history 84
replay 19  +291s  history 83      50 replays / 11 min bought 9 actions
```

**Replays 1-4 bought nothing. The last 8 replays bought one action.** The
budget's yield collapses immediately and it was set to spend 200.

**PAID — `69f388c3`.** Budget is `SHRINK_REPLAY_BUDGET = 12`, named, with its
reason. **Deep measured at 213 seconds end to end, same verdict.**

- **Coverage cost: nothing that is checked.** Full walk length, every law after
  every action, every violation found and reported.
- The reported reproduction is longer — 85 actions, not ~72. **Neither was ever
  readable**, so `shrinkBudgetSpent` now says the history is NOT proven minimal,
  and the report prints the reproduction anyone actually uses: `WALKER_TIER=deep
  seed 3`.
- **A replay COUNT, not a clock.** A time budget shrinks differently on a busy
  machine, so one seed would report two histories. A harness whose report is not
  reproducible is the opposite of this file's job.
- Mutation-checked both ways: budget back to 200 reds the ceiling cell;
  `shrinkBudgetSpent: false` reds the exhausted arm. The converged arm asserts it
  replayed at least twice — a shrink with nothing to do passes everything else.

## 4. WHY "SHARD IT" WOULD NOT HAVE WORKED — the order's own prescription, refuted

1. **All 25 minutes sat inside ONE walk.** Three shards = one 25-minute shard.
2. **The three walks cannot overlap in a process.** Module-level mutable state
   (`todayISO`, `weekStart`, `generated`, `lastChange`, `rolloverFailure`) plus
   singleton stores. Only cross-process sharding is even possible.
3. **`every declared red still reds` reads `declaredRedHits` across the WHOLE
   tier.** Split the seeds and the stale-debt cell fails in every shard.
4. **"Walk only what changed" does not exist and cannot cheaply.** There is no
   map from a source file to a walker coordinate; the walker starts from a blank
   install and derives. The only knob is the seed set, which has no relationship
   to code areas.

**The chain does not need sharding here. It needed one suite to stop being red,
and a budget that stops when its yield does.**

## 5. THE AGREEMENT VERDICT — asked for in one line, and the honest line has caveats

**`AGREEMENT_EXIT=0 verdict=AGREE`** — 158 units compared suite-for-suite,
serial 257.7s vs parallel 118.7s, **2.17x** (`agreement-run-3.log`, 2026-08-07).

**NOT made official, and the "if yes" branch is NOT taken. Two reasons:**

1. **The run before it DISAGREED.** `agreement-run-2.log`:
   `DISAGREE EXIT DIFFERS: chain:runSlice1 serial=0 parallel=1`. An agreement law
   that agrees on the third run and not the second has not established agreement
   — it has established a flake, and a flake in the arm that decides whether
   suites are lost is the finding, not the footnote.
2. **The verdict covers 158 units. The chain is now 192.** 34 units have never
   been compared in either arm.

**`NOW.md:72` keeps "NON-OFFICIAL pre-check" until both are answered.** Sam
started the re-run himself at ~10:17 on 2026-08-12; it was stopped by his
instruction at 165/192 units and its verdict is unread.

## 6. REAL PER-SUITE TIMES — recorded as ordered

2026-08-12 serial arm, derived from per-suite log completion times, 165 of 192
units before the run was stopped. **449s measured.**

| suite | wall |
|---|---|
| `test:accepted-state-transactions` | 89.5s |
| `chain:runSlice1` | 48.7s |
| `test:action-walker` | 31.0s |
| `test:program-control-durable` | 26.7s |
| `test:injury-authority` | 18.9s |
| `test:athlete-door-matrix` | 18.2s |
| `test:operation-ownership` | 18.1s |
| `test:fact-horizon` | 13.5s |
| `test:compile` | 12.5s |

**125 of the 165 finish in under a second.** The chain is not broadly slow; it
has a short head and a very long tail of near-free units.

**`test:accepted-state-transactions` at 89.5s is now the largest single unit and
has never been looked at either.** It was 0 on the 2026-08-07 list — it is new.
**Not started. Named here so the next pass does not re-derive it.**

## 7. THE RED UNDERNEATH — MEASURED, RULED BY SAM, AND PAID

`L-P4 MENU = PROJECTION`, seed 3, 2026-10-15. Diagnosed without paying the
shrink, by swallowing the violation and dumping the day:

```
card workout   "Rest"
snapshot secs  [{"kind":"session","title":"Rest"}]      <- an APPOINTMENT
projection     kind=training parts=["recovery"]
capabilities   {"canAdd":true,"canMoveWholeDay":true,"canRemoveWholeDay":true}
part caps      [{"kind":"recovery","canMove":true,"canRemove":true}]
MOVE           refusal="nothing_movable"  scopes=[]
```

**`moveOptionsForDay` is not defective.** Its top gate already asks the
projection (`canMoveWholeDay` — true, so it passes). It then derives the SCOPES
from `visibleSessionKindsForSnapshot`, gets `['session']`, and `session` is
correctly absent from `MOVABLE_SECTION_KINDS` because a commitment cannot be
rescheduled. `offered` is empty, so `planChangeProducer.ts:783` refuses.

**The defect is one layer up: TWO DECOMPOSITIONS OF ONE DAY.** The gate was
migrated to the projection; the scope list was not. That is a half-migration,
and the file's own comment already states the intended end state — *"WHETHER
ANYTHING MAY LEAVE THIS DAY IS THE PROJECTION'S ANSWER ... one owner."*

**THE RULING — SAM, 2026-08-12, asked which decomposition is right about
2026-10-15 and answered: "recovery session".**

So the card is wrong. A day whose only content is a recovery session is not a
`session` appointment named "Rest", and **the scope list must read the
projection's `parts` like the gate above it already does** — one owner, which is
what the function's own comment has claimed since it was written.

**THE SHAPE THIS TAKES, AND WHY IT IS NOT A GUARD.** The fix REMOVES a
representation rather than adding a branch: `moveOptionsForDay` stops
re-deriving "what is on this day" from `visibleSessionKindsForSnapshot` and asks
the projection, which already models the thing the second reading was there to
protect — `APPOINTMENT_COMPONENTS` holds `session` and `team_training`, and
`partCapabilities` answers `canMove: false` for them. **A "Club Session"
commitment stays immovable through the owner's own answer instead of through a
kind list kept in a second file.** That is the direction `CLAUDE.md` names:
fewer representations, not more guards.

**BUILT — `0ad3793f`.** Both halves of the offer now come from the projection.
`MOVE_SCOPE_SECTION_KIND` and `MOVABLE_SECTION_KINDS` are DELETED in the same
commit as their replacement; nothing else read them.

**THE NEAR-MISS IS REAL AND IS WHY IT IS A NAMED PREDICATE, NOT A BOOLEAN.**
"Would a whole-day move drag something that must stay?" is NOT
`part.capabilities.canMove` — a recovery add-on also answers false and yet RIDES
with the day, so keying on it would retire the whole-day move from every day
carrying one. `partHoldsTheDayDown` is exported from the owner and imported by
the door.

**RECEIPTS.**

- **Seed 3 walks clean to 94 days. `action-walker:deep` is 47 SECONDS** — from
  ~25 min, via 213s with the cap, to 47s once it stopped being red.
- **Two cells in `test:projection-ownership`** (a GREEN suite, 11 → 13). One pins
  all three positions of the predicate: appointment TRUE, add-on FALSE, team
  night FALSE. The other pins that the door actually CALLS it and that neither
  deleted table came back — a correct predicate nobody calls is how the two
  decompositions drifted apart in the first place.
- **Mutation-tested, and each mutation reds only its own cell:** dropping
  `canRemove` from the predicate reds cell one; putting the card's section kinds
  back in the door reds cell two.
- **Ten suites around the door green**, including `athlete-door-matrix` (433
  cells), `athlete-session-move` (22), `move-scoping` (16) and
  `visible-program-projection` (83).
- **`test:plan-change-producer` is RED and was RED before this change** — 68
  failures, **identical set name for name**, diffed rather than counted.
- **FULL SWEEP: `14 of 190`, the failing set IDENTICAL to the recorded baseline
  name for name.** Zero new reds, zero suites newly green.

**`action-walker:deep` STAYS in that failing set** — §8's L16 persist failure is
untouched and still red.

## 8. NOT VERIFIED — stated so it is not mistaken for a finding

`THE L16 SLICE` also fails in both tiers (`the program did not survive the
relaunch at all — the loop is broken at PERSIST`). **It failed identically
before this session's commit** (`logs-serial-1/test_action-walker.log`,
2026-08-12 10:22: `21 passed, 1 failed`), so it is pre-existing and untouched
here. **Its cause is NOT investigated. Do not read this line as a diagnosis.**

## 9. STATUS OF EVERY CLAIM IN THIS REPORT

- **WORKING** — the shrink budget. `test:action-walker` cell *"the shrink budget
  is spent, is bounded, and says which ending it got"*, both arms,
  mutation-checked in two directions.
- **WORKING** — the 213s deep wall clock. Measured end to end, twice.
- **MEASURED** — the per-step table, the replay trajectory, the per-suite times,
  the L-P4 day dump. Instruments were read-only and outside the repo.
- **WRITTEN** — nothing. No claim here rests on a doc alone.
- **WORKING** — L-P4's owner (§7), `0ad3793f`. Sam: *"recovery session"*. Two
  cells, both mutation-checked; sweep 14 of 190 identical to baseline.
- **OPEN** — the agreement re-run's verdict (§5),
  `test:accepted-state-transactions` at 89.5s (§6), the L16 persist failure (§8).
