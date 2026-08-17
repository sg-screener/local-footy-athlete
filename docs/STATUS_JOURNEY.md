# STATUS — seat `journey`

Claimed 2026-08-17. Name checked against `ls docs/STATUS_*.md` at claim time —
`JOURNEY` was free (30 other status files exist; none is this name).

Mission: **COMPLETE ATHLETE JOURNEY** — cold start → onboarding → Block 1 →
athlete actions and feedback → program adjustment → Block 2 → restart/rebuild,
proven on ONE real athlete through production doors. Base `main @ a4ef85be`,
branch `feat/complete-athlete-journey`, worktree `scratchpad/wt-journey`.
CAP 4 sessions.

## THE CONTRACT THIS MISSION ANSWERS TO

`docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md` (approved by Sam
2026-08-16) is the authority for six of the seven proofs the mission names —
progression order, rotation at block boundaries, the three exclusion scopes,
substitution-without-banning, missed-session handling, and the
difficult/readiness reduction order. **Where a historical assertion contradicts
that document, the document wins.** Its own §"Implementation boundary" says its
typed rules, registry entries and mutation-proven guards land together, which is
this mission.

## INSTRUMENTS THAT ALREADY EXIST — reused, not rebuilt

| instrument | what it already does | why it is not enough alone |
| --- | --- | --- |
| `scripts/simulate-changeover.ts` (`sim:changeover`) | fresh install → onboarding → generate → walk the clock a day at a time → real rollover → real completion writer | its install path is a SECOND COPY of boot's job and drops `recordSelections` (below) |
| `scripts/print-week.ts` (`print:week`) | the real read chain offline, plain-English athlete words, exports `runScenario` / `scheduleStateFor` | prints a week, does not walk a life |
| `src/__tests__/blockTwoExplanationDeliveryTests.ts` | block 1 accepted → 12 recorded sessions → block 2 → the ATHLETE-FACING read chain | rolls the block with `acceptBlock`, not through `rolloverProgramBlock` |

**The doors, confirmed by reading production callers (not recalled):**

- onboarding: `useProfileStore.updateOnboardingData` + `completeOnboarding`
- **block 1 generation IS BOOT.** `appHydrationGate.ts:189` calls
  `runQuiescentBoot()`; `quiescentBoot.ts:532` is the `generateProgramLocally`
  call, with `recordSelections: true`. The program is never persisted — boot
  regenerates and replays the ledger.
- rollover: `getProgramBlockRolloverStatus` → `rolloverProgramBlock`, which
  delegates to `rebuildLocalWeek(scope:'block')` — `weekRebuild.ts:649` records
  selections and `:665` threads `progressionHistory` from the store.
- session outcome: `commitSessionOutcomeTransaction` (the one live writer)
- exclusions: `applyExerciseExclusionDecision` (`utils/exerciseExclusionOwner.ts`
  — its own header says three doors call it and no fourth exists)
- program edits: `executeProgramControlActionDurably` over
  `ProgramControlActionType` (`swap_exercise`, `remove_exercise`, readiness
  setters, …)

## MEASURED AT BASE — `feat/complete-athlete-journey` @ a4ef85be

### 1. `npm run sim:changeover -- --profile logs_every_weight`

20 sessions recorded, 0 refused, 0 threw, 0 rollover problems, 2.5s.

| census | value |
| --- | --- |
| days of feedback stored | 20 |
| of those, carrying a per-exercise strength log | 5 |
| days the athlete typed in a load | 15 (40 loads) |
| entries the progression reader SEES | 4 |

**Verdict printed by the script: `NOTHING MOVED`.** All 7 weekdays identical
between its week 1 and week 5 — same session names, same exercise names, same
sets, same reps, **same loads**.

### 2. `scripts/tmp-probe-journey.ts` (temporary; deleted before commit)

The rollover DOES happen and is not the missing piece:

```
microcycles: 2026-07-13 2026-07-20 2026-07-27 2026-08-03
blockState after commit: {"blockStartDate":"2026-07-13","blockNumber":1}
week 4 (2026-08-10): needsRollover=true current=1 next=2 nextStart=2026-08-10
   -> rolledOver=true refusal=null
      newWeeks=2026-08-10 2026-08-17 2026-08-24 2026-08-31
      explanationRows=20
   blockState now: {"blockStartDate":"2026-08-10","blockNumber":2}
```

Two facts worth carrying forward:

- **The sim's "week 5" is block 2 WEEK 2, and its "week 1" is block 1 WEEK 2.**
  Its `firstWeekStart` is `microcycles[1]`, so the labels are offset by one
  block week. Any conclusion drawn from that pair must say so.
- **20 explanation rows were stored with NO history recorded at all** in this
  probe. A block boundary that explains twenty things to an athlete who has
  logged nothing is worth a look; not yet diagnosed.

### 3. THE FIRST NAMED DEFECT — and it is in the HARNESS, not the product

`simulate-changeover.ts:513` generates the first program with
`generateProgramLocally(...)` directly and **never passes
`recordSelections`**, so it defaults false and **block 1's selections are never
recorded**. Production does not do this: every committing caller
(`quiescentBoot.ts:535`, `acceptedStateTransaction.ts:1953`,
`profileProgramTransaction.ts:205`, `weekRebuild.ts:649`,
`temporarySourceFactTransaction.ts:534`) sets it true.

**So block 2 rotation had no block-1 history to rotate away from.** That is a
candidate explanation for `NOTHING MOVED` and it is NOT yet established as the
whole of it — progression and rotation are two claims and this measurement
separates neither. Recorded here so the next reader does not bank it.

**⚠ THE STANDING TRAP THIS SITS ON:** `a-conclusion-outlives-the-world-it-was-
measured-in`. Every number above came from this worktree at this HEAD.

## ⚠ CORRECTION — MY OWN `recordSelections` FINDING IS REFUTED

**The claim in the commit above is FALSE and must not be carried forward.** I
said the onboarding door installs block 1 without recording its selections.
Measured through the real door (`generateProgramFromProfile` +
`seedOnboardingProgram`, argument for argument as `CompleteScreen` calls them):

```
recorded block selections after install: 36
```

`seedOnboardingProgram` -> `setCurrentProgram` reaches
`commitAcceptedStateTransaction`, whose own generation call
(`acceptedStateTransaction.ts:1953`) passes `recordSelections: true`. **Rotation
is not starved and block 2 does rotate** — 7 of 10 exercises change across the
boundary, which is the approved contract's *"most exercises change when a new
block begins"*.

The reason I got it wrong is the reason this harness exists: I read the call site
and reasoned forward instead of walking the door. `CompleteScreen.tsx:302` really
does omit the argument; the install path supplies it one hop later.
[[a-count-taken-for-a-record]], and this one is mine.

## THE REAL DEFECT — MEASURED, ATTRIBUTED, AND HELD RED

`npm run test:athlete-journey` — **11 passed, 3 failed** at
`feat/complete-athlete-journey`. All three reds are one defect:

**THE BLOCK-BOUNDARY COMPLETION GATE IS MEASURED AGAINST THE ATHLETE'S STATED
INTENT, NOT AGAINST THE SESSIONS THE APP ACTUALLY PROGRAMMED.**

The journey athlete asks for three gym days (Mon/Wed/Fri) in-season with a
Saturday game. Friday is protected as G-1, so **the app programs TWO strength
sessions a week — eight in the block.** They complete seven of the eight offered
and miss one. Then:

| | value | instrument |
| --- | --- | --- |
| gate denominator generation used | **12** | the export wrapped on the real rollover |
| strength sessions the app offered | **8** | counted during the walk |
| sessions completed | 7 | `readBlockHistory` |
| recovery verdict | `good` | `readBlockHistory` |
| `qualifies` with required=12 | **false** | `7 >= ceil(12 x 0.75) = 9` is false |
| `qualifies` with required=8 | **true** | `7 >= ceil(8 x 0.75) = 6` |

`readBlockHistory`'s gate is
`completed >= ceil(requiredStrengthSessions * QUALIFYING_COMPLETION_RATIO)`, and
**both** callers state that number as `plan.coreSessions * WEEKS_PER_BLOCK`
(`generateProgram.ts:1660` and `:1813`). `plan.coreSessions` is the COACHING
PLAN's strength-day count (`scheduleToCoachingPlan.ts:335`) — the intent. The
week the app laid out carries its own count, and **the scheduler already owns
it**: `weeklyScheduler.ts:1189` `requiredStrengthSessions: needed`, read at
`schedulerExposureContract.ts:91`.

**Two representations of "how many sessions were required", disagreeing** — the
defect class this repo exists to fight. The consequence is not cosmetic:

- every continuing lift stores `history_held` with `previousLoadKg ===
  nextLoadKg` (`Leg Press` 125 -> 125, `RDLs` 80 -> 80, both read correctly from
  the athlete's OWN recorded loads);
- so the approved contract's first progression rule — *"When training is being
  completed and recovery is good: increase load by the smallest practical
  increment"* — **is unreachable for this athlete**, and it fails SILENTLY: the
  boundary runs, reads their real 125 kg, and holds it;
- and the same wrong denominator drives the missed-session ask
  (`useBlockBoundaryPrompts.ts:165` computes it a THIRD way,
  `currentSessionsPerWeek * WEEKS_PER_BLOCK`), so an athlete with perfect
  attendance reads as 58% and would be asked whether their commitment is
  unrealistic.

**WHY NO EXISTING SUITE SEES THIS.** `blockTwoProgressionTests` and
`blockTwoExplanationDeliveryTests` both hand `readBlockHistory` a history for an
athlete whose asked-for days and programmed days AGREE (pre-season, three gym
days, no fixture protection), so intent and delivery are the same number and the
gate cannot be wrong. **The defect needs a week the app REDUCED, which only an
in-season fixture-protected athlete produces.**

## SECOND CLAIM, DELIBERATELY NOT BANKED

`explanations shown: []` is **not** a delivery break. 40 rows are stored and all
40 are `history_held` — nothing moved, so there is nothing to say. The projection
is right to stay silent, and a suite that asserted "an explanation is always
shown" would be asserting a defect. This is recorded because it looked like the
`blockTwoExplanationDelivery` break and is not.

## THE FIX IS DESIGNED AND DELIBERATELY NOT LANDED — TWO CANDIDATE SOURCES, BOTH MEASURED DEAD

The gate needs ONE number: how many strength sessions the app actually gave the
athlete over the block that ended. Three candidates were tried against the real
journey. **All three numbers were measured, not reasoned about, and two of them
are now refuted.** This is written down so the next session does not pay for them
again.

| candidate | value on this athlete | verdict |
| --- | --- | --- |
| `plan.coreSessions * WEEKS_PER_BLOCK` (today's code) | **12** | WRONG — the athlete's stated intent |
| `previousProgram`'s own strength workouts, counted | **8** ✅ | CORRECT number, FATAL path hole |
| `plan.constraints.weeklyExposureContract.strength.targetCount * 4` | **12** | WRONG — the plan, not the delivered week |
| what the app actually programmed | **8** | the truth |

### Candidate 2 — the right number, and it breaks the launch path

Counting the previous block's own strength workouts gives 8, the gate qualifies,
and the journey goes fully green: `Leg Press` **125 -> 127.5 kg**, `RDLs`
**80 -> 82.5 kg**, `+2.5` each — the approved contract's *"smallest practical
increment"* — and the athlete SEES the raised load.

**It is still wrong, and a control run at base is what proved it.**
`quiescentBoot` regenerates with `previousProgram: null`
(`quiescentBoot.ts:538`), so the count returns 0 on every app launch,
`requiredStrengthSessions > 0` fails, and **every load the boundary raised would
be un-raised the next time the athlete opens the app** — exactly the defect
`test:block-two-boot-preservation` exists to catch.

Measured blast radius of candidate 2, control worktree at `a4ef85be` vs branch,
same tree, same node_modules:

| suite | base | with candidate 2 | new reds |
| --- | --- | --- | --- |
| `test:block-two-progression` | 38/0 | 33/5 | **5** |
| `test:block-two-explanation-delivery` | 14/0 | 7/7 | **7** |
| `test:block-two-difficult-missed` | 88/0 | 87/1 | **1** |
| `test:block-two-ladder` | 51/1 | 46/6 | **5** |
| `test:block-two-extra-session` | 39/1 | 39/1 | 0 |
| `test:block-two-boot-preservation` | 20/0 | 20/0 | 0 |

**Those 18 reds are NOT stale assertions to be replaced.** They are four suites
correctly reporting that the boundary stopped progressing anything, because they
call `acceptBlock`, which passes no `previousProgram`. The suites are right and
the fix was wrong. `test:block-two-ladder` and `test:block-two-extra-session` are
**red at base** (1 each) — do not bank those as gains or losses.

### Candidate 3 — measured in one run, dead in the same run

`strength.targetCount` looked like the answer: `scheduleToCoachingPlan.ts:114`
sets it from the approved phase x availability layout and its own comment says
*"REQUIRED sessions, not scheduled ones"*. **It reads 3 for this athlete while
the app ships 2**, so the plan and the delivered week disagree and the plan is
not the delivered week. (`strength.required` and `preferred.max` are separate
traps — see the docstring drafted for `countProgrammedStrengthSessions`.)

### ⚠ AND CANDIDATE 3 EXPOSED A SECOND, SEPARATE QUESTION — NOT MINE, NOT STARTED

**The plan authorises 3 required strength sessions and the accepted week ships
2.** `schedulerExposureContract`'s own header says that is supposed to be
refused: *"A week that ships one main-strength session when WC-110 required two
is still refused ... collapsing them would make the contract unable to say the
scheduler got it wrong."* This week shipped short of its own required count and
was accepted. **One ledger line; deliberately not chased.** It may be the G-1
protection legitimately reducing the week without recording the reduction — in
which case the reduction is real and undisclosed, which is its own defect — or it
may be the acceptance gate not enforcing what its header claims.

### THE SHAPE THE FIX MUST HAVE, for whoever takes it next

**The caller that owns the grid STATES the input.** `quiescentBoot`'s own comment
already names this pattern for exactly this reason: *"This is the shape
`utils/weekRebuild.ts` already uses at the rollover: the caller that owns the
grid STATES the inputs. Boot still decides nothing."* `blockNumber` and
`progressionHistory` are already threaded that way, and boot captures them
**before** the clean slate precisely because the slate erases `blockState`.

So `programmedStrengthSessions` joins `progressionHistory` as a stated input:

- `weekRebuild.ts:665` counts it from `persistedProgram` (the rollover path);
- `quiescentBoot.ts` counts it from the stored program **before the clean slate**,
  beside where it already captures `blockState` for the same reason;
- generation reads the stated input and never reaches for a substitute — an
  absent count means the gate cannot qualify, which is the truthful answer for
  block 1 and for a probe;
- the four block-two suites state it too, because the input shape grew. **That is
  not editing an assertion to match a regression** — the assertions are unchanged
  and their worlds gain a fact the app already had.

`countProgrammedStrengthSessions` (walking a program's microcycles, windowed on
`microcycle.startDate` because a `Workout` has `dayOfWeek` and no date) is the
right body and was written and measured correct. It is reverted with its call
sites, not kept half-wired.

## ✅ SAM RULED IT, AND IT IS BUILT — 2026-08-17

> *"The completion denominator must be the required strength sessions in the
> accepted block the athlete actually received—not requested gym availability and
> not a recalculated planning target. Give that block-specific delivered
> requirement one durable owner at block acceptance, and make rollover and restart
> read the same value. Do not add a fallback to either of the two refuted
> numbers."*

**THE OWNER:** `programStore.acceptedBlockRequirements` —
`Record<blockStartISO, number>`, a persisted INPUT.

| role | site |
| --- | --- |
| derivation (one function) | `blockBoundaryProgression.deriveAcceptedBlockStrengthRequirement` |
| writer (one function, two acceptance doors) | `programStore.recordAcceptedBlockStrengthRequirement`, called from `setCurrentProgram` and `weekRebuild.commitRebuiltProgram` — beside where each already stamps `blockState` |
| reader: rollover | `weekRebuild.ts:673` states it into `progressionHistory` |
| reader: restart | `quiescentBoot.ts:508` states the same map, captured BEFORE the clean slate |
| consumers | `generateProgram.ts:1680` (rotation) and `:1838` (loads/volume), keyed on `previousBlock.startISO` |

**Keyed by block start, and earlier blocks are KEPT.** The boundary asks about the
block that just ENDED, so a single "current" number would destroy the only copy of
the answer at the exact moment it is needed.

**NO FALLBACK, and that is guarded behaviourally.** An absent entry gives 0, which
makes the gate unreachable — the truthful answer for block 1 and for a probe.

### MEASURED

`npm run test:athlete-journey` — **18 passed, 3 failed** (the 3 are a separate
defect, below). The denominator went `12 -> 8`, and on the real journey:

```
the gate denominator generation actually used: [8]
the requirement each accepted block recorded: {"2026-07-13":8,"2026-08-10":8}
Leg Press  125 -> 127.5 kg   (+2.5, the contract's smallest practical increment)
RDLs        80 -> 82.5 kg
```

…and the athlete READS it, in the app's own words:

> *"You completed enough of the last block and reported good recovery, so Leg Press
> has moved from 125 kg to 127.5 kg. You can change it if needed."*

### MUTATIONS — every corrected boundary seen red

| # | mutation | result |
| --- | --- | --- |
| M1 | writer removed from `setCurrentProgram` (install door) | **KILLED** — 3 reds: the denominator, the stored decision, and the athlete-visible load |
| M2 | writer removed from `commitRebuiltProgram` (rollover door) | **KILLED** — after the cell below was added |
| M3 | both refuted fallbacks restored at the generation read | **KILLED** — after the cell below was added |
| M4 | field dropped from the real `partialize` | **KILLED** — observed red during the build, green after |

**⚠ M2 AND M3 BOTH SURVIVED FIRST, AND EACH EXPOSED A REAL HOLE IN MY OWN GUARD.**

- **M2** survived because this journey only ever READS block 1's requirement, and
  block 1 is recorded by the *other* door. The rollover's write would have shipped
  unguarded and failed one block later. Closed by *"EVERY ACCEPTED BLOCK RECORDED
  ITS OWN REQUIREMENT"* — the ruling says acceptance records, not that this
  journey happens to read it.
- **M3** survived because a `?? fallback` is **unreachable while the entry
  exists**. Re-introducing both forbidden fallbacks left the suite fully green.
  Closed by authoring with an EMPTY map — the state a probe and a block-1 athlete
  are really in — and asserting the denominator is 0. `[0]` at HEAD, `[12]`
  mutated. Third sighting of `half-mutation-proves-nothing`, and this time it was
  my guard's coverage, not the mutation's aim.

### BLAST RADIUS — lost and gained, separately

`scripts/sweep.sh` on this branch vs a **control worktree at `a4ef85be`**, same
node_modules, both sweeps run to completion:

- **branch: 45 failing suites. control: 45 failing suites.**
- **GAINED (red only on the branch): 0.**
- **LOST (red only at base): 0.**
- **The two failing sets are IDENTICAL name for name.**

The block-two family, re-measured on the restored tree: `block-two-progression`
**38/0**, `block-two-explanation-delivery` **14/0**, `block-two-difficult-missed`
**88/0**, `block-two-boot-preservation` **20/0**, `exercise-exclusions` **52/0**.
`block-two-ladder` 51/1 and `block-two-extra-session` 39/1 are **red at base** and
unmoved.

`test:athlete-journey` has **joined `test:bible`**, immediately before the
block-two family it guards. A guard outside the chain is a guard nothing runs.

### TWO THINGS THIS COST, FOR THE NEXT SEAT

1. **`programStore` PROJECTS ITS PERSISTED INPUTS IN TWO PLACES.** The `persist`
   middleware's `partialize` **and** the storage adapter `programStateStorage`,
   which re-shapes a full state into the same `{state:{inputs:{…}}}` envelope on
   its own path. I added the field to one only, and block 1's entry reached disk
   while block 2's did not — which reads exactly like flaky persistence rather
   than a missing line.
2. **`acceptBlock` PROMISES TO ACCEPT *"exactly as production acceptance does"***
   and did not record this. Four block-two suites went red **correctly**,
   reporting that the boundary had stopped progressing in THEIR worlds. Fixed at
   the door; two suites additionally state their own world's requirement inline
   because they never accept a block 1. **No assertion was edited.**

## ⚠ THE NAMED BLOCKER — A SECOND, INDEPENDENT DEFECT THE RESTART PROOF FOUND

**BOOT DOES NOT RESTORE WHICH BLOCK THE ATHLETE IS IN.** Three restart cells are
red and they are not the denominator:

```
after restart — blockState={"blockStartDate":"2026-08-10","blockNumber":1}
                anchor="2026-08-10"
after restart — weeks=[2026-08-10, 08-17, 08-24, 08-31]  miniCycleNumbers=[1,1,1,1]
```

The dates are block 2's; the NUMBER is block 1's. The whole block-boundary layer
is gated on `authoringBlockNumber > 1`, so it never runs: **Leg Press comes back
at 125 kg and the explanation is gone.** The requirement itself survives (its cell
PASSES), so this is a different fact being lost.

`blockState` is not persisted. **Adding it to both projections does NOT fix this**
— tried and BACKED OUT: the regenerated program's `miniCycleNumber` is 1 anyway,
so `deriveStoredBlockStateFromProgram` overwrites the restored number. It needs
its own unit sized as "which block am I in, across a process death", not a
persistence line. Note `test:block-two-boot-preservation` is **20/0 throughout**,
so its relaunch does not model a real process death.

## THE JOURNEY NOW — 26 passed, 3 failed

`npm run test:athlete-journey`. The 3 are the named blocker below, not new.

| step | athlete action | stored truth | visible result | verdict |
| --- | --- | --- | --- | --- |
| 1 | answers onboarding: phase, 3 gym days, equipment, 2 club nights, Saturday game | accepted; 36 block selections recorded | Block 1 installed, 4 weeks | **WORKING** |
| 2 | — | accepted microcycles | displayed week matches storage row for row and dose for dose | **WORKING** |
| 3 | 19 sessions done, loads typed, 1 missed (no record) | 19 feedback days, 8 with strength logs, 8 progression entries | — | **WORKING** |
| 4 | types 111 kg for a lift the card said 125 | logged sets + weight override at 111 | Block 2 prescribes **113.5 kg** | **WORKING** |
| 5 | "leave this out today" | `today_only`, no expiry, `rebuildRequired:false` | Block 2 still programs it | **WORKING** |
| 6 | "leave this out until I change it" | `until_changed`, `activeThroughISO: null` | Block 2 does NOT program it | **WORKING** |
| 7 | block ends | real rollover fires, block 1 -> 2, each block records its own requirement | Block 2 week 1 | **WORKING** |
| 8 | — | `history_progressed` for both continuing lifts | *"…so Leg Press has moved from 111 kg to 113.5 kg. You can change it if needed."* | **WORKING** |
| 9 | — | rotated-in lifts: `authored_estimate` / `bodyweight_default` | no rotated lift carries another's load | **WORKING** |
| 10 | closes and reopens the app | requirement map survives | **loads revert, explanations vanish** | **BLOCKED** (below) |

**BLOCK 1, week 1** — Mon `full_body` (Leg Press 3x3-4 @125, Single-Leg RDL 3x6-8 @17.5,
Bench Press 3x3-5 @82.5, Pull-Ups 3x4-6, Band Pallof Press 2x10-15) · Tue/Thu Team
Training · Wed `full_body` (RDLs 3x2-4 @80, Bulgarian Split Squats 3x6-8 @25,
Landmine Press 3x3-5 @35, Barbell Row 3x4-6 @72.5, Banded Dead Bug 2x10-15) ·
Fri rest (G-1, protected) · Sat Game Day · Sun rest.

**BLOCK 2, week 1** — Mon `full_body` (**Leg Press 3x3-4 @113.5**, Incline DB Bench
4x3-5 @30, Single-Arm Lat Pulldown 3x4-6 @30, Copenhagen Plank (Half) 2x10-15) ·
Wed `full_body` (**RDLs 3x2-4 @82.5**, Single-Leg Leg Press 4x6-8 @75, Z-Press
3x3-5 @35, Chest-Supported DB Row 3x4-6 @20, Crab Walks 2x10-15) · club nights,
fixture and rest days unchanged. **Single-Leg RDL is absent — the athlete excluded
it.** 7 of 10 exercises rotated.

**AFTER RESTART** — the same week with **Leg Press back at 125 kg**, RDLs back at
80 kg, and **no explanations at all**. That is the blocker.

### ⚠ ONE THING A READER COULD MIS-READ, SO IT IS SAID PLAINLY

**`today_only` RECORDS THE SCOPE ANSWER; IT DOES NOT REMOVE THE ROW.** The
exclusion owner's own comment says the removal override already did that, and it
returns `rebuildRequired: false` accordingly. The row leaves the day through a
separate `remove_exercise` program-control action. **This journey walks the scope
answer, NOT the row removal.**

### ONE HARNESS ERROR I MADE AND CORRECTED, worth the line

My first load-edit modelled the athlete logging every set at the prescribed 125
and THEN calling `setWeightOverride(111)`, and it reported that block 2 ignored the
edit. **The app was right to ignore it:** `buildStrengthPerformanceLogs` prefers
the LOGGED sets, and logging 125 while relabelling the prescription 111 is two
different facts, not one edit. The edit now goes into the set log, and block 2
progresses from 111. **A harness that models the wrong act manufactures a defect
report** — see [[a-fixture-is-a-claim-too]].

## STILL NOT COVERED — named, not half-built

- **the row-removal door** (`remove_exercise`) and **the ordinary substitution**
  (`swap_exercise`) — the contract's *"an ordinary substitution changes the
  programmed row without banning the original"*;
- **readiness/recovery feedback as its own act** (`set_fatigue_status`,
  `set_recovery_mode`). Soreness and feeling ARE recorded per session and the
  boundary reads them, but the readiness DOORS are not walked;
- **the optional-session offer** — the journey never legitimately reached one;
- **difficult/missed feedback reducing the right thing.** `test:block-two-difficult-missed`
  (88/0) covers it off its own worlds; this journey does not drive the very-hard arm.

## WHAT I HAVE NOT TOUCHED

**The tree carries the harness, the ruled fix, and this document**, and
the three reds are the base's behaviour, not mine — proven by reverting the fix
and re-running: `block-two-progression` 38/0, `block-two-explanation-delivery`
14/0, `block-two-difficult-missed` 88/0, all back to their base numbers.

`git status` before every commit; `git commit -- <pathspec>` only.

## STILL NOT COVERED — the mission's remaining scope

Named rather than half-built:

- the athlete-action doors: load EDIT (a number different from the prescription),
  readiness/recovery feedback, one temporary removal, one longer exclusion, one
  ordinary substitution, the optional-session offer;
- restart/rebuild through `runQuiescentBoot` (the driver's `relaunchApp` is
  written and **has never been run**);
- proofs: unseen lifts use the authored starting estimate; rotated lifts never
  inherit another exercise's load; exclusion and substitution scope; rotation
  against phase policy; difficult/missed feedback reducing the right thing.
