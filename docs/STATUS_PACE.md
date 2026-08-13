# PACE — your own status file. ONE WRITER: you.

**NAMED 2026-08-13, AND THE RENAME IS A CORRECTION OF MY OWN MISTAKE.**

I started this session, was told to *"rename `docs/STATUS_AGENT3.md` to your
name"*, found it had ALREADY been renamed to `docs/STATUS_AUDIT.md` by another
seat — and then **adopted that seat's name instead of taking my own.** For about
an hour two different sessions stamped `Agent: audit`, and I wrote my findings
into their status file.

**THE OTHER SEAT CAUGHT IT AND MEASURED IT BEFORE I DID** — 20 commits ending
`Agent: audit` against `terminal` 61 and `desktop` 33, with eight of the twenty
theirs, and it names `8bf8548b` and `569c27b4` as *"not ours"*. **Those two are
mine.** Their write-up is in `docs/STATUS_AUDIT.md` and under `## AWAITING SAM`.

**THE NAME IS `pace`, for the lane I actually worked:** the athlete's running
pace — the 2km time trial, MAS, and the conditioning prescriptions that spend
them. A fourth seat took `progression` the same way, which is the shape this one
copies. **Every commit from this seat ends `Agent: pace` from now on.**

**⚠ MY EARLIER ENTRIES ARE STILL IN `docs/STATUS_AUDIT.md` AND I AM NOT MOVING
THEM.** They are the four sections *"THE 32-FILE RESTORE LANDED"*, *"CENSUS C2 IS
PAID"*, *"QUEUE PASS: three claims measured"* and *"I WITHDRAW MY OWN REFUTATION
OF 28-C1"*. **Editing another seat's file is the exact rule I broke to put them
there, and breaking it a second time to tidy up would be worse than the mess.**
That seat may move or delete them freely; this note is the pointer.

**AND THE COMMITS CANNOT BE RESTAMPED** — `8bf8548b`, `569c27b4`, `1229ef0b`,
`b0e8e599`, `8e8aaf92`, `1722e279`, `0576c3c8` are on `main` and rewriting
history in a checkout three seats are committing into would be a far bigger
crime than a wrong label. **They stay wrong and this file is the record.**

---

## STATUS

### ✅ 2026-08-13 — CENSUS C2 IS PAID: the 2km time trial finally has a reader

**`8bf8548b`.** `docs/RULINGS_NOT_IN_THE_APP_2026-08-13.md` C2 — the athlete's
2km time was collected, validated and stored, and `deriveMas` had **zero
production callers**. So an athlete ran a 2km, the app took it, and their
conditioning card read the literal authored string `Intensity: 110% MAS`.

**WHAT SHIPPED.** `src/rules/masPace.ts` — one pure function that reads the %MAS
band out of the words already on the row and returns the speed it means for THAT
athlete: `Your pace: 9.8-12 km/h` when they have run one, `Estimated pace: …`
off Sam's experience ladder when they have not. Mounted on both conditioning row
shapes in `DayWorkoutScreenV2`. Held by `LAW-mas-percent-names-a-pace` /
`test:time-trial` `[23]`-`[25]`, 34 cells, born guarded, 144/144.

**THE ONE DESIGN DECISION WORTH RE-READING: IT DERIVES AT THE READ.** The obvious
build folds the pace into the row's notes inside `composeConditioningRows`, where
the `Intensity:` line is already assembled. **That would be a second
representation of the athlete's pace** — the exact defect `twoKmTimeTrial.ts`'s
own header forbids — and it would go stale the moment they logged a faster run.
Derived at the read, no stored pace exists to disagree with anything and
generation does not import the module at all. **Store the decision, derive
everything else.**

**IT DELIBERATELY DOES NOT ANSWER Q-001.** Range-or-binary is Sam's open
question. The pace is read off whichever percentage the card is ALREADY showing,
so `masCopy` gains no consumer and his answer moves every pace for free. A cell
asserts `masCopy` still has no production consumer, so a later agent cannot wire
it and call that this unit's doing.

**MEASURED, AND IT CHANGES WHO SEES IT.** An in-season week WITH a club
prescribes **no %MAS at all** — `generateProgramLocally` over
`DEV_E2E_STANDARD_PROFILE` at 2026-07-13 yields **0** rows carrying a MAS band.
Remove the club: **8** in-season, **7** pre-season. **The club supplies the
running.** So the line lives on club-less weeks — off-season, pre-season without
a club, a bye, a trip.

**⚠ NOT SEEN ON GLASS, AND THE REASON IS THAT MEASUREMENT.**
`standard-in-season-week` is the only seeded world a golden flow reaches in one
step and it **cannot** show this line; a flow over it would photograph a true
negative and read as proof. **Three hand-driven attempts died at the same
dev-harness cold-start gate** (*"DevE2EClock reload mismatch"*) — the app reaches
`program-screen` inside a maestro flow and falls back to the gate the moment it
is touched from outside one. **§8 second-wall count, so I stopped.**
**OWED: a golden flow that drives the Away control to make a club-less week and
photographs `Your pace:`. OWNER: whoever holds the away flow.**

**MUTATION RUN, AND ONE OF MY OWN CLAIMS DIED IN IT.** Point-before-range reds 10
cells; deleting the literal `MAS` token reds 4; always-measured reds 3; disabling
the point-band branch reds 1. **My first comment credited `\b` and
case-sensitivity with refusing `95-100% maximal` — dropping `\b`, adding `/i`, or
both leaves all 144 green.** `maximal` and `MAS` diverge at the third letter. The
comment now states what was measured.

**NOTED, NOT FIXED, NOT MINE:** `cleanNotes` (`dayWorkoutHelpers.ts:78`) step 2
replaces every en dash with a space, so authored `90–100% MAS` reaches the
combined-day card as `90 100% MAS`. The pace parse reads the RAW notes.

### 🛑 2026-08-13 — THE MISTAKE OF THE DAY, AND IT WAS MINE TWICE

**I published a null result as a refutation without proving my mutation reached
the code it was meant to test.** I promoted `cod_decel` inside
`autoPlacementCategories`, saw zero COD and byte-identical weeks, and told the
queue — and Sam — that item 28-C1's diagnosis was refuted and *"ranking is
measured innocent"*. **`autoPlacementCategories` feeds passes 2 and 3 only. PASS
1 sets the rank, over `categoryPriority` / `zonePriority`, and `cod_decel` is in
neither.** My change reordered a list that had already lost the race. Prepend it
to pass 1 and COD is picked **14 times** in one pre-season no-club week.

**Withdrawn in `8e8aaf92`. The other `audit` seat reached the same answer
independently and its write-up is the fuller one.**

**AND THE SAME FAULT, EARLIER IN THE SAME TURN, TWICE:** a week fingerprint that
walked `microcycles[].days[].workouts[]` and returned `[]` for all six worlds
(caught only because six different worlds cannot honestly share one hash), and a
phantom file-hold asserted from `git status` without the `cmp` this repo's own
note demands. **Three sightings of one shape in one turn.**

> **A NULL RESULT IS A CLAIM ABOUT THE INSTRUMENT FIRST.** Before reporting
> *"X changes nothing"*, prove the change EXECUTED. The positive control here
> cost one edit and would have caught it instantly.

**THE ONE THING MY ARM HAD THAT THE OTHER'S DID NOT:** the run **exits non-zero
the moment COD is actually picked**. `categoryToFlavour`
(`coachingEngine.ts:2633`) declares `: CondFlavour` and covers **five** of
`CondCategory`'s **six** members — **no `cod_decel` case**, so it returns
`undefined` at all seven call sites. `cod_decel` joined
`OffseasonConditioningCategory` on 2026-08-13; the map never followed.
**Ship the ranking fix alone and generation breaks. This is the hazard
`TWO_KM_TIME_TRIAL_DEFAULTS` uses `satisfies Record<…>` to turn into a BUILD
failure — worth copying here in the same commit.**

### 2026-08-13 — WHAT ELSE THIS TURN MEASURED

- **CENSUS C1's RECEIPT IS STALE.** It says `poolForCategory` has *"no
  `cod_decel` branch at all"*. The branch is at `conditioningSelection.ts:211`
  and the pool returns all four templates.
- **ITEM 13's STANDING INSTRUCTION NAMES THE WRONG INSTRUMENT.** It says the
  truth is `grep -c "state: 'UNENFORCED'"` and that the terminal miscounted
  twice *"both times one low"*. **grep 28, gate 27** — the 28th is
  `lawRegistry.ts:108`, the TYPE DECLARATION. **The grep is one HIGH and the
  "miscounts" were the gate being right.** Use `npm run test:law-registry`.
- **ITEM 1a (standing merge) — QUIET, re-measured.** 42 `codex/*` branches carry
  a delta; the newest merge-base across all of them is **2026-07-19** (1,389
  behind); `codex/program-week-navigation-bounds` is fully an ancestor of `main`.
- **ITEM 7 — both named sub-builds exist** (capacity `item 7a` at
  `weeklyExposureContractBuilders.ts:406`; the shortfall copy now branches
  `fixture` / `athlete_rest`), **and its title survives them.**
  **⚠ AND I SCOPED MY OWN TABLE:** strength target is flat at 3 across games and
  team days **at the CONTRACT layer only**. R-073's own receipt counts
  `spacing_safety_conflict` x4 — a fixture reducing strength DOWNSTREAM in the
  §18 evaluator. **So "a game never costs strength" is true of the layer I
  probed and false of the app.** What IS established: `gameDay` is
  `number | null` (`weeklyExposureContractBuilders.ts:35`), so a second game has
  no representation at that seam. **Next step is a measurement of the FULL
  pipeline with a two-game week, not a build.**
- **I SHIPPED A REMOVAL WITHOUT ITS DESTINATION.** `0576c3c8` carried item 36 out
  of the inbox and updated the pointer, while the archive file it points at was
  uncommitted — so at that commit the inbox named a destination git did not have.
  Nothing was lost (the desktop's move was verbatim, 92 insertions and zero
  removals) and the desktop committed the archive minutes later. **`git commit --
  <shared path>` commits the WORKING TREE copy of that path, including another
  seat's in-flight edits. Diff the path against HEAD and READ IT first** — my
  edit was ~25 lines and the commit was 29 insertions and 86 deletions, a number
  I printed and did not read.

### ✅ 2026-08-13 — ITEM 7's LAST MEASUREMENT: THE SECOND GAME NEVER REACHES THE STRENGTH TARGET

**Structural, not statistical, and every seam was read rather than assumed:**

**⚠ ONE ROW OF THIS TABLE IS STRUCK AND THE REGISTRY GATE IS WHAT CAUGHT IT.** I
had `OnboardingData.gameDay` (`types/domain.ts:192`) as seam one. **R-001 forbids
that inference by line** — *"the profile does NOT grow a second game field — the
CALENDAR holds fixtures; `gameDay` is only a DEFAULT"* — and already carries
**⚠ RE-ASKED 2026-08-13 by reading `domain.ts:192` and concluding "room for
one"**. **I made the identical wrong read, from the identical line, the same
day.** `BUILT 3f62ad62`. **The gate did its job before this reached Sam, which is
the entire reason it exists; the finding survives on the seams R-001 does not
cover.**

| seam | games it can carry |
| --- | --- |
| ~~`OnboardingData.gameDay`~~ | ~~one~~ — **STRUCK, refuted by R-001** |
| `WeeklyExposureContractInput.gameDay` (`weeklyExposureContractBuilders.ts:35`) | **one** |
| `coachingEngine.ts:1066` — `inputs.gameDay ? dayNameToNumber(...) : null` | **one** |
| `postGenerationConstraintValidation.ts:845/1955` | **one** |
| `generateProgramLocally` bake (`generateProgram.ts:1088`) | **`markedDays: {}` — none** |

**The plural owner EXISTS and serves a different path.** `targetWeekFixtures`
(`fixtureConditionedAvailability.ts:141`) returns a LIST straight off
`markedDays`, so two games in a week really are representable — item 32's
*"many games per week"* (`3f62ad62`) is real. **It feeds the READ/derive side,
never the strength contract.**

**SO SAM'S *"2 games and 2 team trainings → 1 strength"* IS NOT REFUSED BY THE
ARITHMETIC. THE ARITHMETIC IS NEVER TOLD ABOUT THE SECOND GAME.** That is census
C2's shape one layer up: the fact exists and the code that would act on it has no
reader for it. **Same seat, same day, second sighting of one pattern — worth
naming as a class rather than fixing twice.**

**THE BUILD, NAMED, NOT TAKEN:** thread the fixture LIST into the exposure
contract in place of the single `gameDay`, then let the strength target answer to
it. Owes `test:scenarios` + `test:qa` both arms.

### ✅ 2026-08-13 — THE COD LANDMINE IS HELD (`dd73a53b`)

**`LAW-every-category-has-a-flavour`, born guarded, `[C12]` in
`test:conditioning-templates`, 91/91.** `categoryToFlavour` covers five of
`CondCategory`'s six members and returns `undefined` for `cod_decel` at all seven
call sites — the reason a generation run exits non-zero the moment COD is picked.

**IT IS INERT ON OUTPUT** (a source read), so it owed no scenario sweep and could
land in the turn it was found. **Mutation-checked three ways, one per assertion:**
a new enum member reds it, emptying the debt list reds it, and fixing `cod_decel`
without removing it from the list reds the inflation cell.

**AND ITS OWN NON-VACUITY CELLS CAUGHT TWO FAULTS IN IT BEFORE IT SHIPPED** — an
unscoped category parse that scraped every union in the policy file (13 values,
including `gradual_reentry`), and `[a-z_]+` silently dropping `vo2`. **The first
green would have compared junk against an incomplete list.** Fourth sighting of
the instrument-first law this turn, and the first time the instrument caught
itself.

**WHY COD IS DECLARED DEBT, NOT MAPPED:** `CondFlavour` is
`aerobic | tempo | high-intensity`, and `flavourToCategory` maps
`high-intensity` back to `glycolytic` — so any mapping makes COD return as
something else, which the 4A ruling forbids. **The vocabulary cannot express COD
without lying.** That is the design decision 28-C1's ranking fix has to make, and
it can no longer be reached by accident.

### 🛑 2026-08-13 — THE ONE PROCESS LESSON WORTH KEEPING FROM THIS SEAT'S FIRST DAY

**FIVE FAULTS, ONE SHAPE, AND I SHIPPED THREE OF THEM AFTER WRITING THE RULE
THAT CATCHES THEM.**

1. A week fingerprint that walked coordinates the program does not use and
   returned `[]` for six different worlds — *"nothing moved"* was the only answer
   it could give, **in both arms.**
2. A phantom file-hold asserted from `git status` without the `cmp` this repo's
   own note demands.
3. A refutation of item 28-C1 published from a mutation that **never reached the
   code path it was meant to test.**
4. `[C12]`'s own parser: unscoped, scraping 13 unions, and silently dropping
   `vo2`. **Its non-vacuity cells caught it — the first time an instrument of
   mine caught itself.**
5. A "172 lines LOST" alarm raised by diffing a commit against a WORKING TREE two
   seats were rewriting. **The file had GROWN. The alarm pointed the wrong way
   round.**

> **A NULL RESULT — AND A SCARY NUMBER — IS A CLAIM ABOUT THE INSTRUMENT FIRST.**
> Before *"X changes nothing"*, prove the change EXECUTED. Before *"X was
> destroyed"*, compare `HEAD` against `HEAD~1`, never against a shared working
> tree. **Every one of these cost more to un-say than the control would have cost
> to run.**

**AND THE SHARED-FILE RULE, WHICH I BROKE TWICE IN OPPOSITE DIRECTIONS.**
`git commit -- <shared path>` commits the **working tree** copy of that path.
Mine was stale both times: once it published another seat's uncommitted removal
under my message, once it **reverted** their archival and re-inflated the inbox
by 12.5KB — a file Sam pays for by the byte.

> **THE RULE IS NOT "PRINT THE STAT". IT IS "PRINT IT IN A SEPARATE STEP AND STOP
> ON IT".** I put the stat and the commit in one shell invocation, so a
> 155-deletion number scrolled past unread. Two commands, always.

### NEXT SESSION STARTS HERE

1. **The glass proof for the pace line** — a golden flow driving the Away control
   to make a club-less week. Everything else about that unit is proven.
2. **COD is TWO changes, never one** — pass 1's ranking AND `categoryToFlavour`'s
   missing `cod_decel` case, in the same commit, or generation breaks.
3. **Do not stamp `Agent: audit`.** It is another seat's name.
