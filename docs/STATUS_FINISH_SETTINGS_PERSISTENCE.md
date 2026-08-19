# STATUS — seat `finish-settings-persistence`

**One name, one file, one writer.** Opened 2026-08-20.
`ls docs/STATUS_*.md` before the first commit returned 39 files — ARMS, AUDIT,
BASELINE, BIBLE, BLOCKTWO, BLOCKTWO_DIFFICULT, CAP, CLUBNIGHT_BOOT, COMPOSER,
CONDITIONING, CORE, DEMOLITION, DESKTOP, DEVICE, ELEGANCE, EQUIP, EXCLUSIONS,
FINISH_JOURNEY, FINISH_PROGRAMMING, GUNSHOW, JOURNEY, LADDER, LAWS,
ORCHESTRATOR, PACE, PATTERNS, PRINTER, PROGRESSION, PROJECTION, READINESS,
REBUILD, RESTART, ROTATION, SESSIONUI, SIM, TERMINAL, TRACER, VISIBLE, VOCAB —
and **`FINISH_SETTINGS_PERSISTENCE` was free.**

**Base:** `main @ 9f081efa` (clean commit; the shared checkout carried four
other agents' uncommitted files, which is why this seat branched from the
COMMIT and works in its own worktree).
**Branch:** `feat/finish-settings-persistence`.
**Worktree:** `scratchpad/wt-settings` (session-scoped).
**Control worktree:** `scratchpad/wt-control`, detached at the same `9f081efa`,
same `node_modules` (symlinked to the shared checkout's, as every prior seat's
control has been).
**Stamp:** `Agent: finish-settings-persistence`. Commits by explicit pathspec.
**NOT MERGED, and this seat does not merge.**

## THE MISSION

Finish the broader athlete SETTINGS and PERSISTENCE journeys through real
production doors: season phase, game information, club-training information,
permanent gym equipment, and Coach/program edits — each written through one
canonical transaction owner, rebuilt through the current runtime owners,
preserving unrelated accepted state, surviving close/reopen, and affecting only
the dates and blocks they are supposed to affect.

## OWNERSHIP BOUNDARY, STATED BEFORE ANY CODE MOVED

**MINE:** settings/domain persistence, boot hydration/replay, transaction tests,
journey harnesses.
**NOT MINE, and not edited:** `HomeScreenV2`, `DayWorkoutScreenV2`, the active
Session UI, the Coach UI, injury fallback rules. An athlete-visible
wording/layout need is exposed as typed state and written up as a HANDOFF.

## WHAT I READ BEFORE TOUCHING ANYTHING

`docs/CODEX_HANDOFF_2026-08-11.md`, `CLAUDE.md`, `AGENTS.md` (both halves,
LAW ZERO through the seat-coordination laws), `.claude/rules/suites-and-fixtures.md`,
`docs/NORTH_STAR.md`, `docs/RULINGS_REGISTRY.md` (gate + the rows this mission
touches), `docs/SEAT_INBOX.md` `## Unprocessed`, and the 39 status files.

**REGISTRY-GREP performed before any question was framed:** `season phase`,
`phase change`, `equipment`, `club`, `restart`, `persist`, `relaunch`,
`onboard`, `exclusion`, `settings`, `profile edit`. The rows that bind this
mission: **R-072** (three equipment scopes and no fourth), **R-018/R-019**
(away is a dated subtraction, not a fourth scope), **R-001** (the CALENDAR
holds fixtures; `gameDay` is only a DEFAULT), **R-091** (one generation door),
**R-097** (one generation-time owner; projection displays, never recalculates),
**R-105** (the weekly-reduction prompt belongs to the coach).

## THE DOORS THIS MISSION WALKS — read from production callers, not recalled

| setting | canonical transaction owner | the app's own caller |
| --- | --- | --- |
| season phase | `commitProfileProgramTransaction({kind:'profile_setup'})` | `useSeasonPhaseControl.execute` (My Status) and `ProfileScreen.executeSetupUpdate` |
| game information | the same door, same change kind | `decideProfileSetupChange` -> `ProfileScreen.executeSetupUpdate` |
| club-training information | the same door, same change kind | the same two callers |
| permanent gym equipment | `commitProfileProgramTransaction({kind:'equipment_answer'})` | `ProfileScreen` -> `EquipmentEditorSheet.onSave` |
| SESSION-ONLY equipment | `executeProgramControlActionDurably({type:'set_equipment_modifier', scope:'today_only'})` | `DayWorkoutScreenV2.applySessionEquipment` |
| coach/program edit | `executeProgramControlActionDurably` | every program-control surface |
| close/reopen | `runQuiescentBoot` after a real store death | `appHydrationGate.ts:190` |

**The patch is not hand-written.** `decideProfileSetupChange`
(`rules/profileSetupChange.ts`) is the ONE decision behind the Save button —
it owns "what changed" and "may this be saved at all" — so a harness that built
its own patch would be a second author of exactly the comparison that door
exists to own.

## MEASURED AT BASE, BEFORE ANY CHANGE

| instrument | result |
| --- | --- |
| `npm run test:athlete-journey` @ `9f081efa` | **64 passed, 0 failed** |


---

# THE UNIT — CANDIDATE TIP `6a6a6192`, NOT MERGED

Branch `feat/finish-settings-persistence`, seven commits off `main @ 9f081efa`.
Control worktree detached at that same `9f081efa`, same `node_modules`.

| # | commit | what |
| --- | --- | --- |
| 1 | `4ea7fb8a` | the seat file |
| 2 | `6a463e2b` | the settings-door harness |
| 3 | `7157bdee` | **the block-reset and load-reversion fixes + the new gate** |
| 4 | `49e8bdc8` | **the honest refusal** |
| 5 | `5d86f26a` | two holes the mutations found in my own gate |
| 6 | `9a861cb4` | the gate joins `test:bible`; two laws enter GUARDED |
| 7 | `6a6a6192` | a defect report built and refuted, and the guard it left behind |

## THE JOURNEY MATRIX — setting × accepted-state shape × restart route

Every cell: apply through the canonical owner → census by NAME → relaunch
(process death + `runQuiescentBoot`) → compare. `FRESH` is the mission's
NON-SEEDED cold start (L3); `WORN` is four weeks lived, 19 days recorded through
the live outcome writer, own loads typed, one real miss, a standing
`until_changed` exclusion and a REAL rollover into block 2 (L13's second tier,
declared separately as that law requires).

| setting | canonical owner | FRESH | WORN | block no. before→after→reopened |
| --- | --- | --- | --- | --- |
| season phase (In→Pre) | `commitProfileProgramTransaction{profile_setup}` | PASS | PASS | 2→2→2 |
| game information (Sat→Sun) | the same door | PASS | PASS | 2→2→2 |
| club training (Tue+Thu→Tue) | the same door | PASS | PASS | 2→2→2 |
| permanent gym equipment | `…{equipment_answer}` | PASS | PASS | 2→2→2 |
| session-only equipment | `set_equipment_modifier` `today_only` | PASS | PASS | 2→2→2 |
| coach/program edit | `executeProgramControlActionDurably` | n/a | PASS | 2→2→2 |

Combined journeys, all PASS: permanent kit + a session-only fact both live at
once (2a); a standing exclusion then a settings change then a restart (2b); four
settings changed in sequence then a restart (2c); date/block scoping (3); the
honest refusal (4); the completion-ratio agreement on two athlete shapes (5).

**`npm run test:settings-persistence` — 135 passed, 0 failed.** In `test:bible`,
immediately after `test:athlete-journey`.

## FOUR DEFECTS FOUND. THREE FIXED. ONE REFUTED BY ITS OWN MEASUREMENT.

### 1. A SETTINGS CHANGE RESET AN ESTABLISHED ATHLETE TO BLOCK 1, PERMANENTLY

Change the usual game day Saturday → Sunday on a worn block-2 athlete:

```
acceptedBlocks {07-13:1, 08-10:2} -> {07-13:1, 08-10:1}
blockState     blockNumber 2 -> 1
Leg Press      113.5 -> 110 kg      (their own recorded 111, gone)
RDLs            82.5 ->  80 kg
```

**and it survived the relaunch.** Sam's ruling of 2026-08-18 — *"Once Block 2 is
accepted, restart must never infer or reset them to Block 1"* — was held at boot
and broken by the one door an athlete changes their setup through. All four of
phase, game, club and permanent equipment did it.

### 2. A SESSION-ONLY EQUIPMENT ANSWER REVERTED THE WHOLE WEEK'S LOADS

Tick *"no barbell today"*: `RDLs` 82.5 → 80, two lifts 4 sets → 3, **for the
week, not the day.** Closing and reopening put them back — so the card the
athlete was about to train off was wrong and the app disagreed with itself until
a relaunch.

**ONE CAUSE FOR BOTH, R-097's SHAPE TWICE — the four arguments a regenerating
caller must STATE.** Five production callers hand `generateProgramLocally` a week
for an athlete who already has one. Three stated the recorded history; the
settings transaction stated **none** of it and the dated-fact transaction stated
the block's coordinates but not its history.

**THE FIX IS AN OWNERSHIP CORRECTION, NOT FIVE PATCHES.**
`programStore.statedProgressionInputs` is now the ONE projection of *"what a
regenerating caller must state"*, exactly as `projectProgramPersistedInputs`
beside it is the one projection of what the store persists — and for the same
reason: that list had already drifted into three copies and killed the whole
simulator rig. It takes the STATE as an argument because `quiescentBoot` must
capture before its clean slate nulls `blockState`. `weekRebuild` and
`quiescentBoot` state exactly what they stated before; only the authorship moved.

### 3. AN IMPOSSIBLE SETUP WAS REFUSED CORRECTLY AND EXPLAINED DISHONESTLY

An In-season athlete with two club nights and a Saturday game cuts to one gym
day. The scheduler refuses (`not_enough_legal_gym_days`, WC-142), the change
rolls back whole, the athlete keeps their program — and reads **"Something went
wrong. Please try again."**, the exact sentence `rules/programMutationRefusal`'s
own header names as the disease it was written to cure.

The cure had been applied to the reasons the door RETURNS and never to the errors
it CATCHES: `error.message` instead of the typed `code` the error had carried all
along. `typedRefusalReason` reads `code`, so the next typed refusal is carried
without anyone remembering to add it.

### 4. REFUTED — the club-night denominator

Moving the club night onto a gym day takes the recorded requirement 8 → 4 while
the athlete still visibly gets gym work twice a week. I had the fix written.
**Measured first: `readBlockHistory` excludes the same day, so both sides agree
(8/7 and 4/4) and the 75% gate is not wrong. NO PRODUCT CODE CHANGED.** What
survives is the hazard of a one-sided edit, and that is now stage 5's subject.

### AND THE FRESH-INSTALL RESET WAS NOT TOTAL

`acceptedBlocks` joined `programStore`'s persisted inputs on 2026-08-17 and never
joined `resetStoresToFreshInstall`. **A brand-new athlete cold-started after a
worn one BOOTED AS BLOCK 2** — `miniCycleNumber [1,1,1,1] → [2,2,2,2]`, power row
`Vertical Jump → Lateral Jump` across the relaunch. Nothing failed; the next
suite measured a different athlete than it built. Fixed by asking
`projectProgramPersistedInputs` what the store persists and refusing any
survivor, so the check grows by itself.

## MUTATIONS — eleven, each restored from an own-backup, tree verified byte-identical

| # | mutation | verdict |
| --- | --- | --- |
| M1 | settings door states no history again | **KILLED** 10 reds, all four WORN settings |
| M2 | dated-fact door states no history again | **KILLED** 2 |
| M3 | `acceptedBlocks` leaves the fresh-install reset | **KILLED** the new check THROWS by name |
| M4 | block-state ladder loses its accepted-record arm | **KILLED** 16 |
| M5 | transaction stringifies the typed error again | **KILLED** 2 |
| M6 | scheduler refusal loses its copy row | **KILLED** 2 |
| M7 | exclusion census goes permanently blind | **KILLED** the anti-vacuity cell |
| M8 | **the relaunch is inert** | **SURVIVED → a real hole** |
| M8b | the same, after `reopenTheApp` | **KILLED** 14, one per relaunch site |
| M9 | action `scope` widened | **MISSED → and still a real hole** |
| M9b | the real horizon lever (`missing_for_session` → week) | **KILLED** 1, and it names Wednesday |
| M10 | permanent kit answer stops reaching the profile | **KILLED** 4 |
| M11 | the one-sided denominator fix I nearly shipped | **KILLED** 1 |

**M8 IS THE ONE THAT MATTERED.** Replacing `relaunchApp` with
`{ ok: true, error: null }` left **all 112 cells green** — every *"identical
after close/reopen"* claim was comparing a week against itself, and `relaunch.ok`
could not catch it because a relaunch that never runs also never fails. Closed by
witnessing the restart on OBJECT IDENTITY, which is the one thing an equality
check cannot see.

**M9 WAS THE MUTATION THAT MISSED — and telling that apart from a blind gate
found a second hole.** An equipment fact's horizon comes from the DECISION KIND,
not the action scope. The surrounding cells compare WEEKS, so a session answer
leaking to every day of its own week would have passed all of them, and *"for
this session only"* is a claim about a DAY.

## THE EXACT CONTROL COMPARISON

Failure SETS, sorted and diffed whole — never totals, and never through a pipe.

| instrument | control @ `9f081efa` | branch @ `6a6a6192` |
| --- | --- | --- |
| `scripts/sweep.sh`, full, untruncated | **184 of 396** | **184 of 397** |
| GAINED (red only on the branch) | — | **0** |
| LOST (red only at base) | — | **0** |
| the two failing sets | **IDENTICAL name for name** | |
| `test:compile` | RED, 78 diagnostic lines | RED, **diff EMPTY** |
| `test:law-registry` | 136 rows / 115 guarded / 21 UNENFORCED | 138 / 117 / **21** |

The +1 suite is `test:settings-persistence` joining the chain, and it is NOT in
the failing set. Sixteen green suites in the settings/boot/block-two family were
additionally compared **CELL FOR CELL**, not on totals — `athlete-journey` 64/0,
`block-two-progression` 38/0, `-explanation-delivery` 14/0, `-difficult-missed`
88/0, `-boot-preservation` 20/0, `-ladder` 59/0, `-screen-delivery` 35/0,
`worn-world-boot` 5/0, `persisted-inputs-schema` 8/0,
`persisted-input-projection` 8/0, `results-persist` 5/0, `profile-quarantine`
8/0, `profile-rehydration-cannot-unfinish` 5/0, `fixture-settle-after-setup` 5/0,
`equipment-answer` 41/0, `dated-equipment-fact` 3/0 — identical on both trees.

## ⚠ THE GUARDS FOR THIS MISSION'S OWN SUBJECT ARE MOSTLY NOT WATCHING

Measured at base over the 35 chain suites covering every settings, phase, game,
equipment, boot and block-two door: **19 fail on `main`, and 10 of those are
DEAD rather than red** — they throw before reporting anything, so their totals
line is absent and a reader counting reds sees nothing.

| suite | base state |
| --- | --- |
| `test:block-rollover`, `test:week-rebuild` | **DEAD** — `Cannot find module '../utils/section18ProgramObservation'` |
| `test:block-state`, `test:game-local-rebuild` | **DEAD** — `ProgramGenError: I still need to know what equipment…` |
| `test:equipment-scopes` | **DEAD** — `Cannot find module '../../scripts/trace-equipment-scopes'` |
| `test:mid-block-restart` | **DEAD** — `validateLiveProgramWrite is not a function` |
| `test:block-two-extra-session` | **DEAD** — `Cannot read properties of null (reading 'sentence')` |
| `test:phase-shift-atomicity`, `test:phase-skew-repair`, `test:phase-ownership`, `test:phase-clock` | **DEAD** — no totals line |
| `test:phase-structure` 4/7 · `test:fact-door-inputs` 6/2 · `test:operation-ownership` 9/3 · `test:session-equipment-owner` 24/3 · `test:game-anchor` 13/2 · `test:quiescent-boot` 4/1 · `test:program-hydration-ownership` 4/10 · `test:exercise-exclusions` 52/1 | genuinely RED |

**`section18ProgramObservation` HAS A NAMED CAUSE AND AN OWNER TO ASSIGN.**
`3f97cc67` — *"eleven superseded modules deleted with their obsolete tests"*, on
`main` — deleted the module and left **three chain suites importing it**
(`section18ContractV2Tests`, `programBlockRolloverTests`,
`weekRebuildIntegrationTests`). Reviving them means naming what replaced
`observeMicrocycleSection18`, which is §18 work and not this seat's lane. **NOT
FIXED, NAMED.**

**⚠ A CORRECTION I OWE MY OWN MEASUREMENT.** My first witness batch reported
"10 of 21 failing" and **five of those were npm scripts I had invented**
(`test:season-phase-skew-repair`, `test:fact-door-input-ownership`,
`test:publication-operation-ownership`,
`test:equipment-schedule-fact-transaction`, `test:phase-structure-conformance`).
`sweep.sh` counts a missing script as a failure. The comparison was still valid —
identical both sides — but the COUNT was mine, not the repo's. Corrected above
against the real script names. *A red count is a claim too.*

Separately: **`equipmentScheduleFactTransactionTests.ts` has no npm script at
all** — a settings-transaction test nothing runs. That is SEAT_INBOX item 71's
finding with one more instance.

## UI HANDOFFS — typed state exposed, wording owed

`HomeScreenV2`, `DayWorkoutScreenV2`, the Session UI, the Coach UI and the injury
fallback rules were **not edited**.

1. **NEW ATHLETE-FACING COPY, OWED A SIGNATURE.** The honest refusal ships one
   new sentence in `rules/programMutationRefusal`'s `COPY` table:

   > *"Those training days cannot make a full week alongside your club nights and
   > your game, so nothing changed. Pick different days, or change your club
   > nights or game day, and save again."*

   It follows that table's own pattern (its nine siblings are unsigned plain
   strings in the same file) and it replaces a sentence that was false. **Sam or
   the UI lane to sign or re-word it.** The typed kind `week_cannot_be_built` is
   the stable handle; the words can change without touching a caller.
2. **NO SCREEN CHANGE IS REQUIRED** for any of the three fixes. Both refusal
   surfaces (`useSeasonPhaseControl`, `ProfileScreen.executeSetupUpdate`) already
   render `classifyProgramMutationRefusal(...).userMessage`, so the honest
   sentence reaches the athlete through the wiring that is already there.

## ONE QUESTION FOR SAM — and the grep that survived it

**REGISTRY-GREP: R-093, R-094, R-099, R-002, R-079, R-072, R-018, R-019, R-001,
R-091, R-097, R-105.** R-093/R-094 rule that gym work on a club night is full
body and receives normal loads. R-099 rules the 75% missed-session ask. **None of
them says whether that combined day COUNTS as a strength session for attendance.**

Measured, two athletes identical but for where the club night falls: separated
club nights record **8 required / 7 done**; a club night on a gym day records
**4 required / 4 done**. Both sides of the ratio agree, so nothing is broken —
but the second athlete trains in the gym twice a week and the app counts it once.

## NOT COVERED

- **NOTHING WAS SEEN ON GLASS.** Another lane owns the simulator today; every
  claim here is headless. L10 is unmet by construction.
- **No pixels.** The sheet's SELECTION is supplied and handed to the real
  decider; the taps that build it belong to the Maestro flows.
- **The away/holiday span (R-072 scope 3)** is not walked here. Scopes 1 and 2
  are; the dated away span belongs to `test:away-flow`.
- **`baseline_equipment`, `preferred_training_weekdays`,
  `permanent_unavailable_weekdays` and `permanent_session_time_cap`** — four of
  the six `ProfileProgramChange` kinds — are not walked. The two the athlete
  reaches from Profile are.
- **The 10 DEAD guards above are not revived.**
- **A second athlete shape** (Off-season, bodyweight-only, injured) is not run
  through the matrix; the mission's five settings need an In-season athlete to
  exist at all, so one shape carries all of them.
- **Crash-loss** is not modelled: `relaunchApp` flushes first, so this is a
  restart and not a kill. Crash-loss is its own tape.
