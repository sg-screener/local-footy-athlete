# NOW — overwrite at every checkpoint (pointer, not history)

- **BRANCH:** `main` · **HEAD:** `2796f6d1` (day-first slice 1; docs follow it).
- **UNIT: DAY-FIRST UI, SLICE 1 — BUILT AND LANDED.** Sam ruled **fork A**
  (completion shown, not written) and the overnight authorisation carried the
  build. docs/DAY_FIRST_SLICE1_BOUNDARY_2026-08-08.md
- **WHAT IS ON HIS PHONE:** the Program tab **leads with today** — a seven-day
  week strip with the **game-day anchor**, the selected day at full size with
  every door it already had, and the day's session as a **tappable component
  timeline** between the day's name and its CTA. **No clock times.** A
  **Today / Week** control zooms out to the existing seven-row list.
- **COMPLETION IS SHOWN, NOT WRITTEN.** A filled node means the athlete's SAVED
  outcome recorded that component; hollow means not answered yet. Nothing on the
  screen writes. Gated, not merely intended: frozen inputs plus a source
  assertion that the timeline module reaches no writer.
- **TWO SHAPES OF ONE SCREEN, NOT TWO SCREENS.** Both render the same
  `visibleWeek` through the same `DayRow` from **one row call site**. A rival
  day-first screen behind a third `DESIGN_VERSION` — the switch the unit plan
  named — would have been two live truths about one week. The week list is one
  tap away and is the FORCED shape on another week (no today) and in a game
  picker (a week-level act), so no door and no testID moved.
- **THE GATE, on the FINAL tree `2796f6d1`, both instruments:** full `test:bible`
  **UNPIPED `TRUE_EXIT=1` at `test:program-control-durable`, 1 FAIL cell line**
  (*"a move committed durably reaches the visible week"*, 18 passed / 1 failed) —
  byte-for-byte main's declared red. **Sweep: 2 of 157 =
  `program-control-durable` + `fixture-identity`, the declared set EXACTLY**
  (157 = 156 + this unit's suite). `test:compile` EXIT 0, no file regressed.
  Copy extraction **130 before and after**, measured in a worktree. The chain ran
  on the final tree, **not once per commit** — and the first full run is what
  caught the profile-census red below.
- **CORRECTION, AND IT IS THE UNIT PLAN'S OWN:** §2f named *conditioning +
  finisher* as the live `kind` collision. **Measured at the emitter, that day
  cannot exist** — `getSessionComponents` emits one or the other. The reachable
  pair is **`recovery` + `recovery_addon`**, now built by the suite. "Key on
  `id`" was right for a wrong reason and is now right for a measured one. A
  consequence is NAMED not patched: two `recovery` parts render identically,
  because headline and rows both key on kind.
- **CORRECTION, MINE:** the new suite reached the profile store around its owner
  — `profileMirrorNarrowing`'s one-door census caught it on the full chain, and
  it is routed through `applyProfileOnboardingWrite` rather than joining ~50
  entries of declared debt. **The value of running the whole chain rather than
  the suites I thought were related.**
- **LOOP CHECK, SIGHTING 4, COMPRESSED:** `a count taken for a record` fired
  inside a gate I wrote, on its first mutation test — it counted call sites and
  passed while the loop feeding them was empty. AGENTS.md now carries the source-
  scan half of that law. **Seven mutations, seven reds** across the new suite.
- **PARKED FOR SAM (five, in the boundary report §7):** mid-session ticks do not
  survive an app kill (fork A's known edge); `Today`/`Week` ship PROPOSED,
  unsigned; icons are terminal-proposed from existing assets; the Today/Week
  choice is not persisted (persisting it would be new stored state); the two
  identical `recovery` rows.
- **NOT COVERED, first line of it: NO DEVICE EVIDENCE.** Nothing here has been on
  a phone, and the layout/spacing/colour of the strip and timeline are unverified
  by eye. This repo has no render-level test, so no cell asserts the day-first
  branch mounts — the three source-scan assertions read the block's shape and
  that limit is stated. Rulings 1–12 of the home-screen redesign remain owed.
- **NEXT:** Sam's veto on fork A and on the shape; then either the device pass on
  slice 1 or the next slice (the icon shortcut row / the four-action menu). The
  **LR-29 replay unit** still builds after day-first UI and remains the measured
  payer of main's `fixture-identity` red.

- **STILL TRUE FROM THE MERGE (2026-08-07, `89b540f9`):** main carries Stage B
  stages 1 + 2; **a green main went to a 2-red main knowingly** —
  `test:program-control-durable` + `test:fixture-identity`, the declared set
  exactly. `fixture-identity` 3/5/6 are plain laws whose payer is the LR-29
  replay unit, measured (under `LFA_FLIP_DOOR=1` that suite goes GREEN).
  Sam-accepted as known-imperfect.
- **The LR-29 dependency list is DELIVERED** —
  docs/REPLAY_UNIT_DEPENDENCY_LIST_2026-08-07.md. 3 of 10 readers read ZERO
  fields; the `current_microcycle` rung answered ZERO times in 156 suites; **the
  ledger has no vocabulary for illness/injury/readiness/phase**, so the unit's
  input set is ledger + fact stores and that fork is its largest open decision;
  **the boot already replays**, so its real first question is whether that replay
  already reconstructs `authorisedReductions`.

- **Branches (the ledger — ask git, never recall):**
  - `main` — **the tip**. `feat/stage-b-stage2` is fully merged, 0 ahead;
    `feat/r53-v3-switchover` is an ancestor. Both historical.
  - **TWELVE `scratch/*` branches** — inert instruments, unlanded, kept for the
    replay unit. **FOUR stashes**; only `stash@{0}` ("flip-move-i-wip") is the
    one the kickoff doc names. Stash is unsafe in this shared worktree.
- **WATCH-FORS still open on Sam's device:** completed-day display at the next
  completed session; the three fallback sheets; stale-banner Review; the
  team-training affordance.
- **DEFERRED, NOT FORGOTTEN:** coaching QUALITY — *"labels are okay but the
  programming is pretty shit"*. Exhibits at
  docs/COACHING_QUALITY_EXHIBITS_2026-08-07.md. Not current work.
- **Small maintenance, filed not now:** `runSlice1` runs 21.2s against its own
  18s warning and 30s hard ceiling.
- **INBOX CONVENTION:** an empty queue is written `(none)`, **unnumbered** — the
  stop hook read a numbered empty marker as an order twice
  (`scripts/__tests__/seatInboxHookTests.sh`, 6/6).
- **Standing:** `test:bible` is the ONLY official gate, unpiped, per commit.
  `npm run test:bible:parallel` is a NON-OFFICIAL fast pre-check — no official
  verdict ever cites it. Verify `git branch --show-current` before every commit
  (shared worktree).
