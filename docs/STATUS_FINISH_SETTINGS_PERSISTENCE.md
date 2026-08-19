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

## THE TWO OPTIONS, WEIGHED BEFORE CODING (Elegant Solution Requirement, standing)

**For the block-reset and load-reversion defects:**

1. *Incremental.* Add the four arguments to `profileProgramTransaction`, and
   separately add `progressionHistory` to `temporarySourceFactTransaction`. Two
   local fixes, smallest possible diff, no shared code touched.
2. *Ownership redesign.* Make *"what a regenerating caller must state"* ONE
   projection and route all five callers through it.

**(2) was taken, and the deciding evidence is in the repo already.** The same
list — the persisted-input field list — had been written out by hand in three
places, drifted, and killed every seeded Maestro flow in the repo; the remedy
recorded there was to make it a function. This list had been written out by hand
in three places and two more callers shipped without it. (1) fixes the two doors
that are wrong today and leaves the sixth door free to be wrong tomorrow, which
is Sam's standing *"don't fix edge cases, build a systemic fix"*. The cost of (2)
is that `weekRebuild` and `quiescentBoot` were touched — measured at zero: both
state exactly what they stated before, and the full sweep and the sixteen
cell-for-cell comparisons are identical.

**For the fresh-install reset:** (1) add `acceptedBlocks: {}` — one line;
(2) derive the CHECK from `projectProgramPersistedInputs`. **(2)**, for the same
reason and at the same cost: (1) is the line the last two authors also did not
write.

**For the dishonest refusal:** (1) map the free-text message
`"Weekly schedule refused (…)"` to a kind; (2) carry the error's typed `code`.
**(2)** — (1) is a string match against a sentence, which breaks the day anybody
re-words the error, and it would have to be repeated per error class.

## WHAT THE ATHLETE CAN SEE

**Three things, and all three are athlete-visible.** (a) An athlete in block 2
who changes their season phase, game day, club nights or gym equipment **keeps
the loads they earned** — `Leg Press 113.5 kg`, not 110 — and stays in block 2
instead of being silently restarted at block 1. (b) An athlete who ticks *"no
barbell today"* sees **the right numbers on the card they are about to train
off**, instead of numbers that revert until they close and reopen the app.
(c) An athlete whose new setup cannot make a week reads **why**, instead of
*"Something went wrong. Please try again."*

**BUT NONE OF IT HAS BEEN SEEN ON GLASS** — another lane owns the simulator
today. Under L10 this is *"gates green, awaiting Sam device acceptance"*, never
done.

---

# SESSION 2 — SAM'S COUNT-IT RULING, AND THE CROSS-LANE INTEGRATION CHECK

**Candidate tip `143d0f0f`.** Code changed, so the tip moved from `3c961390`.

## R-114 (written as R-112) — COUNT IT

Sam ruled the question this seat carried. The ruling, its three erasure sites,
the before/after measurement and the guard are in `docs/RULINGS_REGISTRY.md`
R-114 and in commit `ffaabdfb`. **It was written as `R-112`; seat `sessionui`
landed its own `R-112` and `R-113` on `main` while this branch was unmerged, so
the UNLANDED row moved and the landed ones were left alone.** The headline the report must not bury:

> **the athlete's lifts on a club night were never recorded at all.** Not
> mis-counted — absent. `buildStrengthPerformanceLogs` returned `[]` for a
> `workoutType: 'Team Training'` day, so no load and no set count reached the
> record, and the block boundary had nothing to progress those lifts from.

That third site is the one neither my earlier report nor the ratio arithmetic
had found: 4-required/4-recorded looked self-consistent from both sides.

| | separated club nights | club night IS a gym day |
| --- | --- | --- |
| before | 8 required / 7 recorded | **4 / 4**, and **0 of 3** club-night dates recorded any lifting |
| after | 8 required / 7 recorded | **8 / 7**, and **3 of 3** recorded |

`LAW-a-combined-day-credits-both-components` born GUARDED. Registry
**139 rows / 118 guarded / 21 UNENFORCED** — unchanged UNENFORCED.

## THE COMBINED-TREE MEASUREMENT

**Temporary worktree `scratchpad/wt-integration`, branch
`measure/settings-plus-coach-DO-NOT-MERGE`, tip `e585ed5d`** = Settings
`ffaabdfb` + Coach/Product `f5c27c44`. Never merged anywhere; the branch name
says so. Conflicts in four files, resolved keeping BOTH lanes' work.

### ⚠ MY FIRST RESOLUTION WAS WRONG AND IT NEARLY BECAME A FALSE FINDING

The combined tree first failed **13 athlete-journey cells, 5
settings-persistence cells, and threw in coach-weekly-reduction**. That is not
an interaction — it was my merge. The Coach lane had EXTRACTED
`rebuildLocalWeek`'s step-1 generation into `generateProgramForProfile` /
`...FromStore`, so their side of that hunk was EMPTY; taking "mine" re-inserted
the inline call *inside* their extracted one, with duplicate `todayISO` and
`blockNumber` keys. **Each candidate is green alone** — Settings 138/0 + 64/0,
Coach 64/0 + 62/0 — which is what forced the re-examination. Corrected, all
three gates are green on the combined tree: **138/0, 64/0, 62/0**.

### THE FIVE QUESTIONS, ANSWERED WITH A FOUR-WAY CONTROL

One `confirmWeeklyCommitment` acceptance, instrumented on the module objects so
production call sites are intercepted, on the same worn athlete in four trees.

| | gen 1 blockNumber | gen 1 history | gen 2 blockNumber | publish 1 → 2 changed | preview vs accepted, LOADS |
| --- | --- | --- | --- | --- | --- |
| base `main` `9f081efa` | `undefined` | **ABSENT** | **1** | **8 of 44** | — |
| Coach alone `f5c27c44` | `undefined` | **ABSENT** | **1** | **8 of 44** | **20 of 44 differ** |
| Settings alone `ffaabdfb` | 2 | present | 2 | **0 of 44** | — |
| **Combined `e585ed5d`** | **2** | **present** | **2** | **0 of 44** | **0 differ** |

**1 — HOW MANY GENERATION AND PUBLISH EVENTS.** **Two of each, on every tree.**
Generation 1 is the transaction's own build (`recordSelections: 'author'`);
generation 2 is `settleDerivedWorldAfterDecision` → `rebuildDerivedWorld` →
`quiescentBoot` (`'replay'`), publishing as `quiescent_boot`.

**2 — DOES THE SHARED INPUT OWNER REMOVE THE 60-OF-90 DIFFERENCE. YES.** On the
Coach candidate alone the preview and the delivered program differ in **20 of 44
loads, 8 identities, 24 full prescriptions**. Combined with this branch:
**0, 0, 0.** Every one of the preview's 44 prescriptions appears identically in
the accepted program. The second publish also stops rewriting the first: **8 of
44 → 0 of 44.**

**3 — PREVIEW = ACCEPTED = RELAUNCHED.** **accepted vs relaunched: 0 differences
on structure, exercise identity, prescribed loads and full prescription** —
byte-identical. **preview vs accepted: 0 disagreements**, and the accepted
program carries **4 rows the preview did not show**. Those four are the
athlete's excluded lift, below.

**4 — IS EACH INPUT SUPPLIED EXACTLY ONCE FROM THE CANONICAL OWNER. YES.**
`statedProgressionInputs` is called **exactly twice — once per generation** — and
both calls return identical values: `blockNumber=2`, `acceptedBlocks=2`,
`feedbackDays=19`, `overrideDays=7`. No caller hand-builds `progressionHistory`
any more; the Coach lane's extraction became the sixth caller and reads the same
owner.

**5 — IS THE SECOND GENERATION AN OBSOLETE AUTHORITY TO DELETE. NO — AND ON THIS
BRANCH IT IS ALSO NO LONGER AN AUTHORITY THAT DISAGREES.** It is R5.1's settle,
the mechanism that makes *"the week after a tap is the week after a relaunch"*
true by construction, and question 3's byte-identity is its product. On `main`
and on the Coach candidate it silently rewrote **8 of 44** of the first publish's
prescriptions; on this branch it rewrites **0**. Deleting it would delete the
property, so it stays — what needed removing was the disagreement, and the shared
input owner removed it.

## THE ONE RESIDUE, MEASURED AND NOT FIXED

Every settings change puts the athlete's excluded lift back into the **STORED**
program while the athlete never **SEES** it — the read-time projection filters
it:

| change | visible | stored |
| --- | --- | --- |
| phase In→Pre | 0 → 0 | 0 → **6** |
| game Sat→Sun · club Tue+Thu→Tue · two gym-day changes | 0 → 0 | 0 → **4** |

Pre-existing at `9f081efa` (the base control reproduces it), caused by neither
candidate, and not athlete-facing. Under the north star the stored program is
itself a derived artefact regenerated at every boot while the exclusion is the
stored DECISION, so this is the architecture working. **⚠ WHAT IT PUTS AT RISK:**
anything reading the STORED program rather than the projection sees the excluded
row — `deriveAcceptedBlockStrengthRequirement` is exactly such a reader. Not
reachable on any world this suite builds; named so the next reader of that
function does not rediscover it.

**The visible property is now pinned on ALL eleven doors** (it was pinned on the
phase change alone).

## FINAL MUTATION TALLY — 15 SUBJECTS, 15 KILLED, 0 UNPROVEN

The earlier "11 run / 9 killed" was ambiguous. Stated by SUBJECT — the thing
being proven — at final state:

| # | subject | final |
| --- | --- | --- |
| 1 | the settings door states the recorded history | M1 **KILLED** (10) |
| 2 | the dated-fact door states it too | M2 **KILLED** (2) |
| 3 | the fresh-install reset is total | M3 **KILLED** (throws by name) |
| 4 | the block-state ladder's accepted-record arm | M4 **KILLED** (16) |
| 5 | a typed refusal is carried by its code | M5 **KILLED** (2) |
| 6 | the scheduler refusal has athlete copy | M6 **KILLED** (2) |
| 7 | the exclusion census is not blind | M7 **KILLED** |
| 8 | **the restart really happens** | M8 SURVIVED → guard added → M8b **KILLED** (14) |
| 9 | **"this session only" is a DAY** | M9 missed → gap found → M9b **KILLED** (1) |
| 10 | the permanent kit answer reaches the profile | M10 **KILLED** (4) |
| 11 | the one-sided denominator "fix" is refused | M11 **KILLED** (1) |
| 12 | the club-night lifts are recorded | M12 **KILLED** (3) |
| 13 | the denominator is component-aware | M13 **KILLED** (2) |
| 14 | the predicate discriminates | M14 **KILLED** (2) |
| 15 | the excluded lift stays off the week | M15 **KILLED** (8) |

**No subject remains unproven.** Subjects 8 and 9 required a guard to be ADDED
before their mutation could kill; the first attempt on each is recorded as the
hole it exposed, not as a pass. Every mutation was restored from an own-backup
and the tree verified byte-identical after each.

## FINAL CONTROL COMPARISON — at tip `143d0f0f`

**⚠ AND THE FIRST READING OF IT WAS WRONG, CAUGHT BY A SANITY CHECK.** I first
read `branch 31 of 397` against `control 184 of 396` — 153 suites apparently
repaired. `test:law-registry` was in that "repaired" list and I had run it
minutes earlier at 12/2, which cannot be green. The branch sweep had **not
finished**; I had read a partial failure file. Re-read after completion, and
with the control **re-swept at the same moment** rather than trusted from
earlier in the session:

| instrument | control @ `9f081efa` | branch @ `143d0f0f` |
| --- | --- | --- |
| `scripts/sweep.sh`, full, untruncated, both complete | **184 of 396** | **184 of 397** |
| GAINED | — | **0** |
| LOST | — | **0** |
| failing sets | **IDENTICAL name for name** | |
| `test:compile` | RED, 78 lines | RED, **diff EMPTY** |
| `test:law-registry` | 136 / 115 / 21 | 139 / 118 / **21** |
| `test:settings-persistence` | (does not exist) | **143 passed, 0 failed** |

## NOT COVERED — session 2 additions

- **The combined tree is a MEASUREMENT, not a merge candidate.** It carries my
  merge resolutions, which nobody has reviewed; whoever integrates for real
  should redo them rather than take `e585ed5d`.
- **The Coach lane's own findings B-1..B-5 were not re-verified**, only B-3/B-4.
- **The stored-vs-visible exclusion residue is named, not fixed.**
- **Still no glass.** Every number here is headless.

---

# SESSION 3 — THE FROZEN PRODUCT CANDIDATE, AND THE EXCLUDED-EXERCISE RESIDUE

**Frozen Settings candidate `07e01739`.** Both items closed.

## 1. THE RESIDUE — REMOVE MEANS REMOVE, IN STORAGE

**THE AUTHORITY WAS NOT THE SETTINGS DOOR. IT WAS THE REPLAY'S OWN OUTPUT.**
Measured before anything moved: after the rollover the stored program holds **0**
rows of the excluded lift; after a **plain relaunch with no settings change at
all** it holds **4**. Every settings door ends in
`settleDerivedWorldAfterDecision`, which is that same boot path — which is why
all five looked guilty and none was.

**WHY THE ROW WAS THERE, AND WHY THE FIX IS NOT "TELL THE COMPOSER".**
`exclusionsForSelectionAuthority` deliberately withholds the dated decisions from
a replay so the composer RESTORES the recorded lift instead of choosing a new one
for the emptied slot. Its founding measurement: an athlete removed `RDLs`,
reopened the app, and **`Deadlift@77.5` walked into the hinge**. Sam's 2026-08-19
ruling — *"Remove means simply remove the selected exercise/component. Nothing
replaces it"* — is exactly what that protects.

**SO THE REMOVAL MOVED; IT WAS NOT ADDED.** `applyExclusionsToAuthoredWeek` is
`rules/exerciseExclusions`' single definition and was already doing this work at
READ time, on every render, over a week that had the row in it. It is now applied
once where the week is **authored**, after selection — so the slot is left empty
and nothing replaces it. Same ruling, applied to storage instead of to the
projection. **No new filter, no compatibility layer, selection untouched**; the
read-time application is now idempotent over anything this generator built.

| state | STORED | VISIBLE |
| --- | --- | --- |
| after the rollover | 0 | 0 |
| after a plain relaunch | 0 | 0 |
| after each of four settings changes | 0 | 0 |
| after each relaunch that follows | 0 | 0 |

Ten readings, all agreeing. Progressed loads intact (`Leg Press 113.5`,
`RDLs 82.5`).

### ⚠ A NAMED CELL CONTRADICTED THIS, AND ITS PREMISE IS REFUTED BY MEASUREMENT

`exerciseExclusionScopeTests` [3] asserted *"the stored program KEPT the row, so
Restore has something to give back"*. Restore does not need the row hoarded — it
returns `rebuildRequired: true`, and what gives the lift back is
`blockSelectionHistoryStore`, the store built to remember what a block chose.
Walked end to end through the real doors:

```
STORED 4 -> 4 (excluded) -> 0 (relaunch) -> 0 (restore tap)
      -> 4 (the rebuild restore ASKS FOR) -> 4 (next relaunch)
```

with the visible week agreeing at every step, and
`activeProgramModifiers`' Restore control setting `rebuildRequired` for exactly
that reason. **THE CELL WAS NOT DELETED.** It asserted a MECHANISM and now
asserts the two PROPERTIES that mechanism served: stored and visible AGREE, and
the composer did not re-decide the slot (checked on the recorded selection — the
`Deadlift@77.5` coordinate). `test:exercise-exclusions` **52 passed / 1 failed at
base → 53 passed / 1 failed**, the same single pre-existing red.

## 2. THE FROZEN COMBINATION — `measure/settings-plus-frozen-product-DO-NOT-MERGE @ 37d8717d`

Settings `674892b5` + **frozen Product `18968818`**. Conflicts in the same four
files, resolved the way the first measurement had to be corrected to: **their**
`weekRebuild` extraction is the caller, and `generateProgramForProfileFromStore`
reads `statedProgressionInputs` rather than hand-writing the same four fields —
so the extraction becomes a sixth caller of the one owner. 141 law rows, no
duplicate ids; 399 suites, both new gates in the chain.

**ALL FOUR GATES GREEN ON THE COMBINED TREE:** `settings-persistence` **148/0**,
`athlete-journey` **64/0**, `coach-weekly-reduction` **64/0**,
`exercise-exclusions` **53/1** (the pre-existing red).

### PREVIEW = ACCEPTED = RELAUNCHED — EXACTLY, ON EVERY AXIS

| axis | preview | accepted | relaunched | preview≠accepted | accepted≠relaunched |
| --- | --- | --- | --- | --- | --- |
| structure | 28 | 28 | 28 | **0** | **0** |
| exercise identity | 44 | 44 | 44 | **0** | **0** |
| prescribed loads | 44 | 44 | 44 | **0** | **0** |
| full prescription | 44 | 44 | 44 | **0** | **0** |

**Rows the athlete gets that the preview did not show: 0.** On the previous
combination this was 4 — the excluded lift — so the residue fix is what closed
the last gap in this question, not the input owner.

### GENERATION AND PUBLISH EVENTS, AND THE FOUR-WAY CONTROL

| | gen 1 blockNumber | gen 1 history | gen 2 blockNumber | publish 1 → 2 changed | preview vs accepted (loads) |
| --- | --- | --- | --- | --- | --- |
| base `main` `9f081efa` | `undefined` | **ABSENT** | **1** | **8 of 44** | — |
| Coach `f5c27c44` alone | `undefined` | **ABSENT** | **1** | **8 of 44** | **20 of 44 differ** |
| Settings `674892b5` alone | 2 | present | 2 | **0 of 44** | — |
| **Settings + FROZEN `18968818`** | **2** | **present** | **2** | **0 of 44** | **0 differ** |

**Two generations, two publishes**, per acceptance, on every tree — gen 1 the
transaction (`author`), gen 2 the settle (`replay`, publishing as
`quiescent_boot`). `statedProgressionInputs` called **exactly twice, once per
generation**, both returning `blockNumber=2, acceptedBlocks=2, feedbackDays=19,
overrideDays=7`. The second generation is **not** obsolete — it is R5.1's settle
and the reason accepted == relaunched — and on this candidate it no longer
disagrees with the first.

### SAM'S HANDOFF PROPERTY, PROVEN

`docs/PROFILE_CHANGE_DOUBLE_REGENERATION_HANDOFF_2026-08-20.md` names this lane
as owner: *"Existing exercises must retain progression from their own history."*
On the combined tree, across one real `confirmWeeklyCommitment`: **10 exercises
carried across the change, 0 loads moved.** Guarded on the candidate by stage 6,
which walks that door directly.

## MUTATIONS — 18 SUBJECTS, 18 KILLED, 0 UNPROVEN

Subjects 1–15 are unchanged from session 2. New:

| # | subject | final |
| --- | --- | --- |
| 16 | the authoring-time removal (stored == visible) | **KILLED** — 5 reds, one per WORN door, naming stored 4/6 vs visible 0 |
| 17 | the composer may not re-decide the emptied slot | **SURVIVED my suite; KILLED by `test:exercise-exclusions`**, naming the `Deadlift@77.5` defect |
| 18 | the handoff's carried-load property | **KILLED** — *"3 of 9 carried exercises changed load: Leg Press 113.5→110, RDLs 82.5→80, Single-Leg Leg Press 75→32.5"* |

**M17 IS REPORTED AS IT HAPPENED.** It is killed by the suite that OWNS exclusion
semantics, not by mine — which is the right place for it — and my suite is
recorded as blind to that subject rather than credited with it.

## CONTROL COMPARISON — candidate `674892b5`

| instrument | control @ `9f081efa` | candidate |
| --- | --- | --- |
| `scripts/sweep.sh`, full, both complete | **184 of 396** | **184 of 397** |
| GAINED / LOST | — | **0 / 0** |
| `test:compile` | RED, 78 lines | **diff EMPTY** |
| `test:exercise-exclusions` | 52 / 1 | **53 / 1** (same red) |
| `test:settings-persistence` | (absent) | **157 / 0** |

Sanity-checked: `test:law-registry` IS in the candidate's failing set (it must
be), and `test:settings-persistence` is NOT.

## NOT COVERED — session 3 additions

- **THE NEW-EXERCISE HALF OF SAM'S HANDOFF RULING IS NOT EXERCISED.** *"New
  exercises use their own history or authored starting estimate"* has an EMPTY
  subject on this athlete — the commitment change adds days without adding
  exercises — so stage 6 prints that and asserts nothing over it.
- **Both `measure/*` branches remain DO-NOT-MERGE.** They carry my merge
  resolutions, which nobody has reviewed; the real integration should redo them.
- **Still no glass.**
