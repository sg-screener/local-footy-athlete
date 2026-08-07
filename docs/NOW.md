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
- **(a) DELIVERED — THE LR-29 MEASURED DEPENDENCY LIST.**
  docs/REPLAY_UNIT_DEPENDENCY_LIST_2026-08-07.md. The unit stays RE-SLOTTED to
  build **after day-first UI**, and it remains the measured payer of main's
  `fixture-identity` red — **re-confirmed today, not carried**: under
  `LFA_FLIP_DOOR=1` on `fc4013cc`, `fixture-identity` goes **GREEN**.
  Headline findings: **3 of 10 readers read ZERO fields** (50,078 door calls
  satisfied by an existence predicate); the `current_microcycle` rung
  **answered ZERO times in 156 suites** and can be deleted; **the ledger has no
  vocabulary for illness/injury/readiness/phase**, so "replay the ledger" is
  not a sufficient description of the unit — the input set is ledger + fact
  stores, and that fork is the largest open decision; and **the boot already
  replays** (`quiescentBoot.rebuildDerivedWorld`), so the unit's real first
  question is whether that replay already reconstructs `authorisedReductions`.
  Instrument on `scratch/lr29-dependency-list` (`7c3dc1e3`), flag-inert, and
  **priced against the control set before any reading was believed — 2 of 156
  both arms, so the Proxy does not perturb.**
- **(b) DELIVERED — THE DAY-FIRST UI UNIT PLAN.**
  docs/DAY_FIRST_UI_UNIT_PLAN_2026-08-07.md (rulings doc is in `docs/`, not
  `artifacts/` as the order cited). The timeline must consume `project()`'s
  `VisibleDay.parts`, **not `ProjectedDayParts`** — the structural half carries
  no words, so a timeline built on it renders nameless. Group by `id`, never by
  `kind`. Ruling 13 is MOOT (R5.7 already cut it); ruling 11 (injury "Other"
  data path) is its own investigation.
- **(c) SLICE 1 IS STOPPED ON ITS CHECK-OFF HALF — a genuine standing
  condition, and the render half is clean.** The order's premise *"check-off via
  the existing per-component completion"* is **refuted by measurement**:
  `componentCompletions` has exactly ONE writer,
  `commitSessionOutcomeTransaction`, which mints a **session-outcome receipt**
  driving the Done badge, the completed-day display and progression — and there
  is **no draft-persistence path**. One tick therefore either fabricates a
  completion (signed-behaviour change, and it corrupts the completed-day
  boundary that is one of Sam's own standing device flags) or persists partial
  progress (new stored state of the worst shape). **Not the terminal's to
  choose** — fork A/B/C is in the plan, **A recommended** (completion shown,
  not written; zero new state).
  **NOTHING WAS BUILT this pass.** The `componentIdFromPartId` helper was
  drafted and **held out rather than landed unused**.

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
