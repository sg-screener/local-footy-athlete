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

- **⚠ SAM: NOTHING IS BLOCKED ON YOU RIGHT NOW EXCEPT LOOKING.** The accounts
  question (**LOCAL-ONLY**) and the platform question (**iPHONE-ONLY**) were both
  **DECIDED BY YOU on 2026-08-10** — `docs/PUBLISH_ROADMAP_2026-08-05.md` lines
  115 and 126, `docs/LAW_SWEEP_STOP_2026-08-10.md` items 3 and 4. **They are not
  open and must not be asked again.** The only thing still genuinely owed is one
  line for `eas.json` (`submit.production.ios` is `{}`) and that is a publish-day
  item, not a today item. **Waiting on your word, on nothing urgent.**

## STATE

- **BRANCH:** `main` · **HEAD:** `f4f6b3b2` — **re-stamp this line at every checkpoint; it was four commits stale on 2026-08-10 and a stale HEAD makes every other line in this file unverifiable.**
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

## OPEN, ON US

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
