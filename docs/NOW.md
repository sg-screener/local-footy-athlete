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

- **⚠ SAM: THE DAY SCREEN'S ADDITIONS ARE BUILT AND YOU CAN LOOK AT THEM NOW.**
  `25565430`. Eyebrow, drop-downs with exercises and prescriptions, the change
  card, the calmer card. Both states shot at
  `artifacts/ui-walk/dropdown-{1-collapsed,2-expanded}.png`,
  `.maestro/golden/day-card-dropdowns.yaml` holds them, and the simulator is
  sitting on the real screen. **Your eye on it is the next thing that moves the
  merge. Still open — you have not sent it.**

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

- **BRANCH:** `main` · **HEAD:** `284a86bb` — **re-stamp this line at every checkpoint; it was four commits stale on 2026-08-10 and a stale HEAD makes every other line in this file unverifiable.**
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
- **THE UI MERGE — SLICES 2, 3 AND 5 LANDED** (`25565430`, `2752c90a`,
  `226531b2`). **THE WEEK NOW USES HER CARD STRUCTURE AND PROPORTIONS FOR ALL
  SEVEN DAYS** (`284a86bb`): large dates, compact badges, an acted active-
  modifier line, and one-chevron flat full-session expansion are green on the
  simulator; Sam's iPhone acceptance still owed.
  **STILL OPEN: slice 3b** — the status screen's buttons are a NO-OP and the day
  screen keeps every control, because wiring them needs
  `handleCoachNoteAction` and the phase-shift machine lifted out of
  `useHomeScreen`. **So rulings 4 and 6 are NOT closed**; only ruling 4's
  destination exists. Also open on the week: "Completed" on past weeks, and the
  team-training badge (deferred with a reason — the row title already says it).
  Plan:
  `docs/UI_MERGE_PLAN_2026-08-10.md` · rulings:
  `docs/UI_MERGE_RULINGS_2026-08-10.md` · her signed prototype:
  `docs/design/LFA_UI_PROTOTYPE_2026-08-10.html`.
- **THE SEEDED WORLD IS NOT DURABLE — PRICED, NOT FIXED.** One boolean (the
  replay latch) carries two meanings, so the boot path cannot tell a REPLAY from
  an INSTALL and drops the install's writes. Three fix shapes and the elegant one
  named in `docs/UI_MERGE_SLICE3_BOUNDARY_2026-08-10.md` addendum 4. **Unblocks
  six red flows. And the open question that matters most: does a REAL ONBOARDING
  install hit the same window? Not measured — if it does, this is athlete-facing
  data loss, not a harness bug.**
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
