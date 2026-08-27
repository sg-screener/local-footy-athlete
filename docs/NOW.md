# NOW — overwrite at every checkpoint (pointer, not history)

**THIS FILE IS A POINTER AND IT IS NOW BUDGETED.** It was 53KB on 2026-08-10 and
had become history — re-read at every stop, and Sam paid for it in dollars
(`/usage`: 126M tokens in, $68.95 for 1h43m, almost all of it reading this file
and `SEAT_INBOX.md`). Everything it held is verbatim in
`docs/NOW_HISTORY_TO_2026-08-10.md`; **nothing was deleted, only moved off the
hot path.** `test:repo-law-guards` now fails when either file exceeds its budget.
**If you are about to append a paragraph here, it belongs in the boundary report
and this file gets one line pointing at it.**

---

## FOR SAM — the short list

> **NOTHING IN THIS BLOCK MAY ASK SAM FOR SOMETHING HE HAS ALREADY GIVEN.** On
> 2026-08-10 this list asked a second time for the rebuild he had run and for two
> decisions he had made hours earlier — the granted-permission defect, third
> appearance in one day. **Before a `⚠ SAM` bullet is written, check the roadmap
> and the stop docs for an answer already recorded.**

- **⚠ SAM: THE FULL RENEE EYE PASS IS SIMULATOR-GREEN, NOT ON YOUR PHONE (`.maestro/golden/one-set-feedback.yaml`).**
  All seven Week cards, collapsed Today, inline session expansion, status and
  season review, Profile cleanup, readiness routes, missed-session choices and
  the live exercise checklist are in one checkpoint. The completed Day card now
  has no Done badge and shows a green tick beside `Session complete`. The real
  reload tape also preserves the Saturday Game Day card after process death.
  `docs/CODEX_UI_SESSION_PERSISTENCE_BOUNDARY_2026-08-11.md`.

- **⚠ SAM: THE REBUILD IS DONE AND THE WHITE SCREEN THAT FOLLOWED IS FIXED.**
  `61ab9e46`. A refused development launch used to render nothing at all; it now
  names its reason and offers a one-tap clear. **It will happen again after any
  test run** — the leftover marker that causes it is named and NOT fixed — but it
  now tells you what it is. **Reproduced and cleared on the simulator, in a flow;
  not seen on your phone.** `docs/WHITE_SCREEN_BOUNDARY_2026-08-10.md`.

- **⚠ SAM: THE TEST RIG WORKS AND IT FOUND THE ROT YOU WARNED ABOUT.** One flow
  runs end to end in 18 seconds (`96dd6f01`), and on its first working run it
  caught that **every practice week here was built from a profile the app would
  refuse from a real person** — no 2km time. **21 of 332 suites consumed that
  impossible athlete** and whether they still pass on a legal profile is
  **still open**. **Not something you have seen on your phone.**

- **⚠ SAM: A GAME CAN NOW BE ON ANY DAY OF THE WEEK — CHECK IT ON YOUR PHONE.**
  Both places that ask for your game day now offer all seven days, not just
  Friday/Saturday/Sunday. **What to check:** set your game day to a Wednesday in
  Profile, then close the app fully and reopen it — the Wednesday games must
  still be there. Before this, a midweek game was treated as NO game, so the
  week got none of the protection around it, and the games vanished on reopen.
  **Gates green, not seen on your phone**
  (`docs/GAME_ANCHOR_BOUNDARY_2026-08-12.md`).

- **⚠ SAM: NOTHING IS BLOCKED ON YOU RIGHT NOW EXCEPT LOOKING.** The accounts
  question (**LOCAL-ONLY**) and the platform question (**iPHONE-ONLY**) were both
  **DECIDED BY YOU on 2026-08-10** — `docs/PUBLISH_ROADMAP_2026-08-05.md` lines
  115 and 126, `docs/LAW_SWEEP_STOP_2026-08-10.md` items 3 and 4. **They are not
  open and must not be asked again.** The only thing still genuinely owed is one
  line for `eas.json` (`submit.production.ios` is `{}`) and that is a publish-day
  item, not a today item. **Waiting on your word, on nothing urgent.**

## STATE

- **BRANCH:** `codex/failure-only-state-export` · **IMPLEMENTATION:** `8e7afd5a`.
- **CURRENT UNIT:** final-row composition locally verified; fixture fallback, practice-match budget and exercise-edit ownership on restart; owner `testtruth`.
- **RECEIPT:** `docs/STATUS_TESTTRUTH.md` step 21; compiler 375/375, year 416/416 with zero programming/restart failures, including exercise Swap then game Move.
- **NEXT:** lighter-day ownership, then remaining global writer proof and release debt; owner `testtruth`, when Sam starts it.
- **OPEN:** 2 confirmed rival authors, 1 derived publisher and 1,217 unresolved candidate owners keep release red; existing typecheck debt remains. No phone acceptance claimed.
- **ONE COMMAND STARTS THE APP: `npm run lfa:dev`** (`scripts/qa-start.sh`, the
  only startup script — the law is `LAW-one-startup-command`). It picks the
  BOOTED simulator that has the app, starts Metro, and **launches**; it fails
  closed naming `npx expo run:ios`. Recipe recorded as the `lfa-dev` skill.
  **`CLAUDE.md` now says what counts as finished** (`LAW-definition-of-done`)
  and got shorter doing it, 137 → 104 lines.
- **THE FIVE CANONICAL ATHLETE FLOWS EXIST AS A SET** (`LAW-canonical-athlete-flows`).
  Move a session and clear an adjustment had NO flow at all; both are built and
  green on the simulator.
  **CORRECTED — THE "HIDDEN SESSION" WAS THE SEED, NOT THE APP.** The seed
  stabiliser renamed every exercise row and left the conditioning block pointing
  at the old ids, so **23 of 23 seeded workouts lost their conditioning
  component**. The generator's own output was measured CORRECT: **no athlete was
  affected and no product code changed.** Fixed at the seed, three cells in
  `test:dev-e2e-seeds`, `LAW-rename-carries-its-references`.
  `docs/STOP_2026-08-12_SEED_CONDITIONING_IDENTITY.md`.
  **THE DELETION WALKTHROUGH IS GREEN ON GLASS (2026-08-12)** — and its first
  assertion is the on-glass proof of the seed fix. **Ask `ps -o etime` before
  calling a maestro collision a concurrent agent: three processes holding the
  device were 1-22 DAYS old and wedged.** `docs/GOLDEN_FLOW_RUN_RECEIPT.md`.
- **`test:bible` IS DELIBERATELY RED and stays red until every law has a guard.**
  `test:law-registry` is the chain's last link and fails while any registry row
  reads `UNENFORCED`. The red does not mean the app broke — it means the app has
  never been checked against those rules, and from now that counts as failing.
  **Only guards, guard-caught fixes and measurement land while it is red.** The
  count is measured by running `test:law-registry`, never recalled. **Sam's rule:
  it may only fall.**
- **`test:bible` stops at the first failing suite** — anything past position 92
  needs `scripts/sweep.sh <label>`. `npm run test:bible:parallel` is a
  NON-OFFICIAL pre-check. **Verify `git branch --show-current` before every
  commit** (shared worktree).
- **REAL PER-SUITE TIMES, MEASURED 2026-08-12** (`docs/STOP_2026-08-12_WALKER_TIMING.md`).
  Serial arm, 165 of 192 units, **449s**: `accepted-state-transactions` 89.5s ·
  `chain:runSlice1` 48.7s · `action-walker` 31.0s · `program-control-durable`
  26.7s · `injury-authority` 18.9s · `athlete-door-matrix` 18.2s ·
  `operation-ownership` 18.1s · `fact-horizon` 13.5s · `compile` 12.5s.
  **125 of the 165 finish under a second** — a short head and a very long free
  tail, not a broadly slow chain.
  **`action-walker:deep` was ~25 min (~70% of the chain) ONLY because it is RED:**
  a 200-replay shrink at 11-15s a replay. Budget is now 12 (`69f388c3`) and the
  suite measures **213s** capped, and **48s GREEN** since both its reds were
  paid (`0ad3793f`, `fd4f68a2`). **Sharding it was refused with reasons — all
  the time sat inside ONE walk.** **Sweep is now 10 of 190**, down from 14.
  **`accepted-state-transactions` at 89.5s is the largest real unit and has never
  been looked at.**
- **THE AGREEMENT LAW HAS NOT ESTABLISHED AGREEMENT.** Last run AGREES (158
  units, 2.17x, 2026-08-07) but **the run before it DISAGREED** on
  `chain:runSlice1`'s exit code, and the chain has since grown 158 → 192 units.
  **A flake in the arm that decides whether suites are lost is the finding.**
  `parallel` stays NON-OFFICIAL until both are answered.

## OPEN, ON US

- **THE MODERATE HALF OF SAM'S SHAPE NOW SPEAKS** (`LAW-moderate-day-advisory`),
  advisory and never blocking — making it blocking throws and takes the suite
  down, which is the outage that ruling prevents. **And a FOURTH WORD was found:
  `stressLevel: 'moderate'` outside the union `high|medium|low`, hidden by an
  `as never` cast, so every "easier option" offer was invisible to the moderate
  count.** Fixed and guarded by a source scan
  (`LAW-stress-vocabulary-is-one-word`). **The fix changed NOTHING measurable —
  all 17 scenarios identical — because that placer does not run in them.**
  **12 of 17 weeks still have zero moderate days.**
- **THE ±7 IS DELETED — fourth attempt, and it was never the defect.** The real
  one: `canonicaliseAcceptedStateCandidate` re-derives a week at commit time and
  writes it over the proposal WITHOUT its provenance, so a cross-week dependency
  died at commit on every re-gating path. **The phantom fixture was the only
  thing hiding it.** Fixed by carrying still-valid records through the re-gate
  (`LAW-regate-carries-provenance`); the ±7 then deletes cleanly
  (`LAW-no-invented-fixture`). **Sweep 15 of 196, IDENTICAL name for name to the
  HEAD baseline; the 17 scenarios unchanged.** Second sighting in one day of
  "a rebuild must carry what pointed at it".
- ~~**THE ±7 IS DIAGNOSED AND NOT FIXED.**~~ Measured in both arms: the dependency
  link is derived MORE often without the ±7, reaches the materialiser MORE often,
  and the proposal carries it IDENTICALLY — **the COMMIT is where it dies.** Five
  candidates dead. `docs/FIXTURE_AUTHORITY_CENSUS_2026-08-12.md` §7-§10.
- **ITEM 7 IS BLOCKED ON SAM, TWICE:** the profile has ONE game field, so
  *"2 games and 2 team trainings"* cannot be expressed; and the fixture-caused
  shortfall needs a second SIGNED sentence.

- **THE 17 SCENARIOS NOW ANSWER "IS THIS A WEEK SAM WOULD WRITE"** (item 5,
  `LAW-preference-report`). `LFA_HARD_DAY_PROBE=1 npm run test:qa` prints a
  table against a committed baseline; **4 of 17 weeks meet both ruled
  preferences, 0 hard violations.** The score COUNTS ruled preferences and
  invents no weighting; over-fitting (a gain on one week bought with regressions
  across the rest) is REJECTED mechanically. Rules held by
  `test:preference-shape`, 8 cells, in the chain — `test:qa` prints and does
  not block because its 84 pre-existing failures would hide any verdict.
  **OPEN: item 4 counts the shape as 2 of 17, this counts 4 of 17 — two
  different questions, not reconciled.**

- **THE ARCHITECTURE ANSWER IS WRITTEN: `docs/HOW_TO_BUILD_THIS_APP_2026-08-12.md`.**
  Sam asked for the best way to build the app, not the fastest. **Headline: this
  app is not built wrong, it is built right and DISCONNECTED.** The calendar,
  fixture resolution, proximity sets, the Section 17 kernel and the contract's
  anchor array are **already list-shaped for N games on any day**; it collapses at
  ONE line, `derivedWeekContract.ts:90` — **a waist, not a floor.** Three layers:
  facts / the brain / **the athlete's will, which does not exist** (a `block` has
  one button labelled `"OK"`; `canOverride` is written 9 times and read **zero**).
  **Nine values are computed every assessment and read by nobody** — one
  `noUnusedWrites` gate is the compression for sightings 1-6.



- **THE GAME DAY IS OPEN TO ALL SEVEN DAYS, AND EIGHT COPIES OF ONE PREDICATE
  BECAME ONE.** `HOW_TO_BUILD_THIS_APP` §5 items 1 AND 2, both landed.
  `src/rules/gameAnchor.ts` is the only thing that answers "which day is the
  game"; the Fri/Sat/Sun allowlist, the `GameDay` enum and `mapToLegacyGameDay`
  are deleted. **The finding: three of the eight copies already accepted all
  seven days — the app could READ a Wednesday game and could not WRITE one.**
  **No device migration is owed and that is proven, not assumed** — the legacy
  value was never a day and parses to null at the owner. Guarded by
  `test:game-anchor` (14 cells, in the chain), **mutation-tested twice**;
  registry 95/63 → 96/64 with the unguarded count unmoved. **Sweep `14 of 190`,
  the failing set IDENTICAL to the baseline name for name** (189 → 190 is this
  unit's own suite joining the chain). `06401d92` ·
  `docs/GAME_ANCHOR_BOUNDARY_2026-08-12.md` ·
  `docs/STOP_2026-08-12_GAME_ANCHOR.md`.
- **CORRECTION: THE GAME-ANCHOR COUNT WAS WRONG BY HALF — EIGHT CLAIMED,
  SIXTEEN REAL.** The census grepped for the legacy literal plus a hand-list, so
  every copy spelling `usualGameDay || gameDay` inline was invisible to it —
  eight more, across `coachingEngine`, `rollingHorizonRepair`,
  `fixtureConditionedAvailability`, `acceptedStateTransaction` and
  `generateProgram`. **`a-count-taken-for-a-record`, and this one is ours: the
  number named the INSTRUMENT'S unit and was read in the domain's.** Six of the
  eight had NO membership test, so a legacy `'Varies'` travelled as if it were a
  day — a latent defect, not just duplication. **All sixteen now delegate; the
  guard counts the SHAPE, not the literal, and is mutation-tested.**
- **NO ORDER CAN HIDE FROM THE STOP HOOK ANY MORE — and the founding case was
  this terminal's.** The hook's scan stops at the next `## `, so a `## ` heading
  inside the unprocessed region hid every order below it and **Sam became the
  courier**. `test:repo-law-guards` 34 → 35 cells, mutation-tested against the
  real file; registry row born `guarded` (96/64 → **97/65**, UNENFORCED unmoved
  at 32). **Repairing by hand a file that HAS A PARSER, without reading the
  parser, is the same class of mistake as the corruption it was fixing.**
  `1fcf5c04` + `a1257884`.
- **A SHARED CHECKOUT COST MOST OF A SESSION.** Codex checked a branch out in
  THIS tree mid-unit; three routes to land work were denied and the stop hook —
  which reads HEAD — could not see four stop reports sitting on `main`.
  **`codex/program-week-navigation-bounds` is UNMERGED and its two registry rows
  RED `test:law-registry`'s `ruledAt` cell** (both cite *"Sam … direct
  request"*, no path). Measured on main after the switch: that cell now PASSES,
  10 of 11, the single red the by-design UNENFORCED stop.
- **A CONCURRENT WRITE CORRUPTED `docs/SEAT_INBOX.md` AND BOTH DOC GATES PASSED
  OVER IT.** The seat's merge-leftovers block landed **inside STAND-DOWN B's
  sentence**, splitting a stand-down whose whole job is to stop a question
  reaching Sam a fourth time. **Repaired, content unchanged.**
  `test:seat-inbox-hook` and `test:repo-law-guards` both read the broken file
  and passed. **Nothing detects a mid-sentence splice; the inbox warns that two
  agents in one checkout share a git index, and it should warn that they share
  this file too.** `docs/GAME_ANCHOR_BOUNDARY_2026-08-12.md` §6.
- **`test:compile` WAS RED AT HEAD AND NO SWEEP CAN SEE IT.** `scripts/sweep.sh`
  filters `test:compile` out of the chain by construction, so a typecheck
  regression is invisible to the instrument that reports "N of 189".
  `section18CraftTierTests.ts` landed with `2db1b8ce` missing a required field
  and was never added to the typecheck baseline. **The one line is cleared; the
  instrument gap is the finding and is NOT fixed.**
- **THE ±7 INVENTION IS NOW MORE REACHABLE, NOT LESS.** `section18CraftTier.ts:161`
  fabricates neighbouring games the validator trusts as real
  (`weekStructureValidator.ts:255,272`). A midweek athlete can exist for the
  first time, and an irregular fixture list is exactly what it gets wrong.
  **`HOW_TO_BUILD_THIS_APP` §5 item 3 is the next unit.**
- **THE FIFTH HARD DAY IS APP-SELECTED IN 7 WEEKS OUT OF 8.** Measured
  2026-08-12 (`a8f13d91`): eight of seventeen QA scenarios carry a fifth hard
  day and in seven of them nothing forced it but the app. The arithmetic that
  tells "the club did this" from "the app chose this" runs on every assessment
  and is written to a field with ZERO readers. **Enforcing it is priced and
  NOT started** — it would turn 7 of 17 scenarios blocking at the gate every
  write door converges on. `docs/FIFTH_HARD_DAY_MEASUREMENT_2026-08-12.md`.
- **SAM'S CRAFT RULES ARE SWITCHED ON.** `weekStructureValidator` was
  FINDINGS-ONLY by its own header with three logging callers; it now runs inside
  the §18 gateway's `assess` closure as a blocking tier and the search MOVES a
  badly placed session instead of only naming it. **Measured: zero `strong`
  findings across all 17 `test:qa` scenarios, so no generated week changes today
  — the door is shut for edits, moves and stored weeks.** New `test:craft-tier`,
  29 cells, 3 mutations killed. **Needs Sam's eye: hydration can now swap a day
  in a week already on his phone.** `docs/CRAFT_TIER_BOUNDARY_2026-08-12.md`.
  Session stop report: `docs/STOP_2026-08-12_CRAFT_TIER_AND_FIFTH_HARD_DAY.md`.

- **SAM RULED 2026-08-12 — HYDRATION MAY RE-SHAPE THE REST OF THE WEEK, QUIETLY.
  CLOSED, DO NOT RE-ASK.** *"once a session is done then it's locked in, only the
  rest of the week can change ... they realise they have a saturday game and not
  a sunday game then wednesday to sunday should adjust to accomodate this"*. Both
  halves already match the code (`governedFromISO` is date-stamped, past test is
  `<`), so **no work is owed and the "tell him it moved" copy is WITHDRAWN.**
  **He also named the fixture shape:** *"games are basically only ever on friday
  saturday sunday - occasionally younger guys will have ... school footy thursday
  and another game saturday or sunday but it's rare"*. **THURSDAY, not Wednesday,
  is the realistic lost-game-day case** (`mapToLegacyGameDay` flattens it to
  `'Varies'`), and **the two-game week cannot be expressed at all**: the profile
  has no second-game field, while `weekStructureValidator` already takes
  `gameDates: string[]` and three `.find()` adapters throw the extras away
  (`section18CraftTier.ts:152`, `derivedWeekContract.ts:226`,
  `section18AcceptedWeekGateway.ts:290`). **Friday is then G+1 and G-1 at once,
  for the youngest athletes, protected against one arbitrary game.** Merged into
  seat inbox item 2.

- **SEAT ACCEPTED THE CRAFT TIER — AND ITS ZERO-CHANGE MEASUREMENT IS THE
  FINDING, NOT THE REASSURANCE.** The quality Sam complains about lives in the
  `soft` tier the craft tier declines by its own ruling 2.
  **SAM RULED 2026-08-12:** *"4 hard days plus 1 moderate/easy day is prefered
  but 5 hard days is okay"* — **five hard days is NOT a defect, the hard-day
  count is CLOSED, do not re-open it.** What his words expose is the OTHER half
  of the shape: **`achievedModerateDayCount`
  (`section18EffectiveWeekEvaluator.ts:1034`) has ZERO readers** — no range, no
  minimum, no finding. One half of his default week is fully governed and the
  other half is counted and discarded. **Sighting 5, new organ: wired to a
  write-only FIELD, not a logger** — two instances (`:1034`, `:1047`); a
  `noUnusedWrites` gate over `contract.*` catches both. Seat inbox item 1.

- **THE WHITE SCREEN IS FIXED AND ITS CAUSE IS NOT.** `61ab9e46`. A refused dev
  launch used to render nothing at all; it now names the reason and offers a
  one-tap clear (`.maestro/golden/dev-launch-refusal-speaks.yaml`, green).
  **Why a harness clock receipt outlives its checkpoint is NOT fixed** — Sam will
  meet the screen again after any Maestro run, he will just know what it is.
  `docs/WHITE_SCREEN_BOUNDARY_2026-08-10.md`.
- **A REFUSAL HAS NEVER FIRED.** `DevE2ELaunchDiagnostic.swift` went from TEN
  hard `fatalError`s on the launch path to ZERO, and each one is now a typed code
  surfacing as `e2e-explorer-launch-error-<code>`. **Native — inert until the
  rebuild.** No flow launches with a bad input to prove the marker appears; that
  flow is the next cheap act and is deliberately not written blind.
  `docs/LAUNCH_DIAGNOSTIC_REFUSAL_BOUNDARY_2026-08-10.md`.
- **THE MERGE'S REMAINING WORK IS ONE UNIT, AND IT IS SHAPED**:
  `useRebuildNotice()` — one owner of "a rebuild is happening", everyone else
  reads it. **Measured, not hoped:** the modifier actions and the phase shift
  drive the SAME four pieces of rebuild state, so one move closes ruling 4's
  remaining strands AND ruling 6. Both routes priced, recommendation given with
  its reason: `docs/REBUILD_NOTICE_OWNERSHIP_2026-08-10.md`. **First thing to
  check: whether `runRebuild` closes over day-screen state.**
- **THE RENEE UI PASS AND LIVE SESSION REDESIGN ARE GATES-GREEN, AWAITING SAM
  DEVICE ACCEPTANCE.** One Week card head owns all seven days; Today starts
  closed; Day shows the real warm-up, strength and conditioning rows; Coach owns
  My Status and season phase; Profile no longer duplicates those controls. The
  live session owns per-exercise completion and a 1–5 effort result. **The
  picture index for every current surface is `docs/UI_STATE_2026-08-12.md` —
  look there before reading any UI prose.** The Day
  completion state says `Session complete` once with a green tick. Full receipts
  and exclusions: `docs/CODEX_UI_SESSION_PERSISTENCE_BOUNDARY_2026-08-11.md`.
- **THE SEEDED WORLD AND GAME DAYS NOW SURVIVE A REAL PROCESS RELAUNCH.** The
  repair removed derived `game/noGame` rows from Calendar persistence and keeps
  fixture decisions in Profile / the decision ledger. The corrected reload tape
  cold-seeds, checkpoints, stops the app, relaunches it and sees Saturday Game
  Day on Week. **Still not covered:** legacy worlds whose only fixture record is
  an old Calendar mirror, and Sam's physical iPhone.
- **`injury-case` INSTALLS AGAIN** (`31fc279f`) — the witness was right and the
  ORDER was wrong: an install claim was being validated after a legitimate
  mutation answered a different question. **It now fails on the DURABILITY defect
  instead**, which is a different problem and is priced above.
- **FIVE dev-e2e SUITES JOINED THE CHAIN** (`4189de2b`) — they existed and
  nothing ran them, which is why a seed answering in a vocabulary the app refuses
  sat undetected. **Four of the five are RED**: `dev-e2e-seeds` 2,
  `dev-e2e-entry` 2, `dev-e2e-reset-hydration` 2, `dev-e2e-scenario-session` 1.
  Visible now, not diagnosed.
- **THE DAY NAME IS READ BY DOORS, NOT JUST SHOWN** — the move gate and the
  repair both read it, so a combined day's conditioning has no name to carry.
  Read, never run: `docs/DOES_THE_DOOR_READ_THE_NAME_2026-08-10.md`.
- **THE OLD EXPOSURE RULES ARE CUT FROM GENERATION BUT STILL RUN IN THREE OTHER
  PLACES** with no guard — measured open, not claimed fixed. `2ec4d49b` ·
  `docs/V1_EXPOSURE_CONTRACT_CUT_2026-08-10.md`.
- **COACH REBUILD:** slices 1+2+3 landed; **S4 (*it knows how you're tracking*)
  is NOT started.** The journal's behind-the-scenes record — load, regions, feel,
  niggles — is an INPUT to it; that is why the journal data layer stayed live and
  every journal suite is pinned in the chain.
- **STILL OPEN, NOT ANY UNIT:** ~150 `label:` strings across 20+ `utils`/`rules`
  modules invisible to both copy gates; legacy `JournalStack`/`JournalHome`/
  `RouteEnum.JOURNAL` type-only debt; **no instrument distinguishes "shipped"
  from "shipped and reachable"**.
- **DEFERRED, NOT FORGOTTEN:** coaching QUALITY — *"labels are okay but the
  programming is pretty shit"*, `docs/COACHING_QUALITY_EXHIBITS_2026-08-07.md`.

## CONVENTIONS

- **Inbox:** an empty queue is written `(none)`. Numbering does not matter in
  either direction (`f168b48b`) — the stop hook reads content. Seat orders are
  1, 2, 3, newest first; urgency belongs in the words.
- **A seat order is as short as it can be and still be unambiguous.** Receipts
  belong in the boundary report, not in the order.
- **Reports to Sam:** `CLAUDE.md` governs — what happened, what's next, what to
  send. **The ceremony moves to the docs; it does not shrink.**

## WHERE THE HISTORY WENT

- `docs/NOW_HISTORY_TO_2026-08-10.md` — this file's entire prior contents.
- `docs/SEAT_INBOX_ARCHIVE_TO_2026-08-10.md` — every processed seat order.
- `docs/STOP_INBOX_QUEUE_2026-08-10.md` — the live law-guard queue.
