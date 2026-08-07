# NOW — overwrite at every checkpoint (pointer, not history)

- **BRANCH:** `main` · **HEAD:** `89b540f9` (the merge commit).
- **UNIT:** Stage B stages 1 + 2 **MERGED TO MAIN**. The L10 combined device
  pass — the gate main waited on since `75fb71df` — was run by Sam on
  2026-08-07 and **PASSED**. Taps 1/2/3 correct, tap 4 N/A (no coach override
  exists in his state), tap 5 = programming-quality findings which Sam
  explicitly DEFERRED. Mechanics passed; the gate judged mechanics.
  docs/DEVICE_PASS_TAP_LIST_STAGES_1_2_2026-08-07.md
- **THE GATE, BOTH SIDES, full `test:bible` UNPIPED on main:**
  **BEFORE `TRUE_EXIT=0`** — green to its last suite
  (`stage-b-generation-differential`), **0 FAIL lines**.
  **AFTER `TRUE_EXIT=1`** at `test:program-control-durable`, **1 FAIL line**,
  same assertion text (18 passed / 1 failed). Sweep at `89b540f9`:
  **2 of 156 = `test:program-control-durable` + `test:fixture-identity`** —
  **the branch's declared set EXACTLY. No difference, no STOP.**
- **SAID PLAINLY: this merge took a green main to a 2-red main, knowingly.**
  `fixture-identity` 3/5/6 are red as **plain laws with no declaration wearing
  them** — the ratchet deleted their debt entries when V3 was expected to pay
  them and V3 banked short. **Payer = the LR-29 replay unit**, measured (it is
  the one unit whose arm turns `fixture-identity` green). Sam-accepted as
  known-imperfect.
- **NEXT (seat's overnight order, 2026-08-07):**
  (a) the LR-29 replay unit is **RE-SLOTTED** — produce its **measured
  dependency list ONLY**, filed beside docs/REPLAY_UNIT_KICKOFF_2026-08-07.md;
  the unit itself now builds **AFTER day-first UI, before beta**. It remains
  the payer of the declared `fixture-identity` reds.
  (b) then **DAY-FIRST UI kicks off** — docs/DAY_FIRST_UI_DIRECTION_2026-08-01.md
  + artifacts/HOME_SCREEN_REDESIGN_RULINGS_2026-07-30.md (13 binding Sam
  rulings) + the signed copy sheet. First deliverable: the unit plan with its
  FULL measured dependency list (the V3 law — dependencies before build).
  (c) overnight authorisation to build slice 1 if that list is clean of stop
  conditions; new strings ship PROPOSED; L16 vertical slice.

- **Branches (the ledger — ask git, never recall):**
  - `main` — **the tip**, carries everything below. `89b540f9`.
  - `feat/stage-b-stage2` — **FULLY MERGED into main**, 0 ahead. Its 267
    commits are main's now. Safe to delete; kept this pass only so the merge
    can be read from either side.
  - `feat/r53-v3-switchover` — merged into stage-b-stage2 at `75fb71df`,
    therefore an **ancestor of main**. Historical.
  - **TWELVE `scratch/*` branches — inert instruments, unlanded, kept for the
    replay unit.** Enumerated rather than sampled (the ledger is taken from
    `for-each-ref`, not from memory — an earlier draft of this block named five
    and there are twelve):
    `r53-legv-price` `1d831279` · `r53-legv-readers` `24c32928` ·
    `r53-legv-replay` `cf44bcc7` · `r53-legv-writer-reprice` `ec490090` ·
    `r53-pricing-3-scaffold` `2eedd2d4` · `r53-pricing-4` `ae242d43` ·
    `r53-pricing-5` `de059e7d` · `r53-pricing-5-before` `24cb9620` ·
    `r53-pricing-6` `2d617a56` · `r53-pricing-7` `f91ea404` ·
    `r53-pricing-7-probe` `8696193e` ·
    `r53-removal-door-attribution` `b5c57963`.
  - **FOUR stashes, and only the first is the one the kickoff doc names:**
    `stash@{0}` "flip-move-i-wip" (route 2's four-site build, preserved for the
    replay unit) · `stash@{1}` and `stash@{2}` are readiness-family arms taken
    ON MAIN and recorded as RED · `stash@{3}` a 2026-07-27 tier/flag migration.
    Stash is unsafe in this shared worktree — nothing here is to be popped
    without its own unit.

- **WATCH-FORS still open on Sam's device** (untestable in the states he was
  in): completed-day display at the next completed session; the three fallback
  sheets; stale-banner Review; the team-training affordance.
- **DEFERRED, NOT FORGOTTEN:** coaching QUALITY (session composition, ordering,
  density) — Sam's words, *"labels are okay but the programming is pretty
  shit"*. Concrete exhibits from the device pass are filed at
  docs/COACHING_QUALITY_EXHIBITS_2026-08-07.md so that unit starts from real
  screens instead of memory. Not current work.
- **Small maintenance, filed not now:** `runSlice1` runs 21.2s against its own
  18s warning and 30s hard ceiling.
- **Standing:** `test:bible` is the ONLY official gate, unpiped, per commit.
  `npm run test:bible:parallel` is a NON-OFFICIAL fast pre-check — no official
  verdict ever cites it. Verify `git branch --show-current` before every commit
  (shared worktree).
