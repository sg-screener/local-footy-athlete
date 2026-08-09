# NOW — overwrite at every checkpoint (pointer, not history)

- **BRANCH:** `main` · **HEAD:** `4274e2f0` — **THE COACH UNIT'S LAW DOC IS
  WRITTEN AND THE FIRST LEDGER DOOR IS BUILT.** Sam's boot fix below is still
  UNSEEN on his phone and is still the first thing to look at.

- **THE OVERNIGHT COACH GROUNDWORK (2026-08-09 night).**
  **READ:** docs/COACH_DOORS_BOUNDARY_2026-08-09.md ·
  law doc docs/COACH_ARCHITECTURE_REASSESSMENT_2026-08-09.md ·
  gate `test:program-control-decisions` (11 cells) ·
  instrument `npm run tape:exercise-edit-durability`.
  - **THE RULING: ten representations of one athlete sentence, and the ledger
    is not one of them.** The coach's output becomes a `ProgramControlAction`,
    the athlete's own door executes it, the ledger records it verbatim. Ten
    collapse to two. **The coach gets undo, replay and durability by NOT having
    a writer.** AGENTS.md requires this doc APPROVED before further coach
    pipeline code — tonight was door/engine work, which does not need it.
  - **A REAL BUG, MEASURED THEN FIXED: an athlete's own exercise edit did not
    survive a relaunch.** Tap remove, and it is back tomorrow with nothing shown
    and nothing logged. The survey filed this as an INFERENCE; the tape observed
    the three mechanisms together, then the fix made it durable. **Red before,
    green after, with a control proving the boot reproduces an unedited day.**
  - **ONE LEDGER KIND FOR A 26-MEMBER UNION** — `program_control`, carrying the
    action unchanged. **ZERO new stored state; north star TOWARD.** An
    allow-list keeps it honest: recording a type the boot cannot replay is worse
    than recording nothing.
  - **THE SIDE-WRITER CLASS GOT ITS CENSUS** (the compression `side-writer-
    outside-the-ledger` asked for, not a fourth per-kind fix): undo, then diff
    the WHOLE persisted envelope. **CENSUS CLEAN.** It found three side-writers
    before it found none — **all three were the instrument's own** (unflushed
    baseline, unequal relaunch, and a raw-string compare that read JSON KEY
    ORDER as drift).
  - **STILL HALF TRUE: two ledger destinations of five.** Injury, illness/
    readiness and setup answers are NOT on the ledger and were deliberately not
    attempted — they PERSIST today, so a ledger kind alone would be two stored
    representations of one input. They need the fact slices to leave
    `partialize` plus a migration, and **a mistake there loses facts that
    currently survive.**
  - **ITEM 3 RETURNED ZERO DELETIONS, AND THAT IS THE RESULT.** A real import
    graph says cutting `CoachScreen.tsx` makes **40 modules / 41,220 lines**
    unreachable — bigger than the survey's 28,160 name-scan lower bound, and 8
    of them are not named `*coach*`. But **the tree is rooted at the one module
    the order's rule protects** (`AppNavigator.tsx:10` imports it), so the rule
    has no consistent deletion set. The three apparently-orphaned modules were
    each checked and each KEPT — one is target-resolution SALVAGE, one is held
    by three suites, one was a COMMENT mention. **Sam's call, parked.**
  - **`a count taken for a record` — ELEVENTH AND TWELFTH SIGHTINGS**, both in
    my own new instruments on their first runs: `import type` counted as a
    runtime edge (it is erased — that alone made 6,296 lines look load-bearing),
    and a byte-compare of JSON read key order as a state change.
  - **NOT COVERED, first line: DEPTH 0, NO DEVICE EVIDENCE.** Only
    `remove_exercise` was driven end to end of the three allow-listed types; a
    swap's safety check on REPLAY is unexercised. **No coach turn was executed** —
    that the coach's vocabulary fits `ProgramControlAction` is a type-level
    reading of two unions, not a port, and is the likeliest place it is wrong.

- **⚠ SAM: REBUILD RELEASE AND OPEN IT.** The boot error screen was
  `missing_generation_anchor` — **neither of the two suspects.** His world was
  built across pre-2026-08-06 eras and never stored a generation anchor at all,
  so the boot refused **permanently** and Try Again was correctly useless.

- **THE ANCHOR RECOVERY (fifty-sixth pass).**
  - **ROOT CAUSE, with receipts:** "the anchor rides the program it anchors"
    (Sam, 2026-08-06); `generateProgram.ts:998` is the only stamp and it
    postdates his program; the old-shape envelope migration carries the absence
    forward (`programStore.ts:361`). **Never written — not a wipe, not a
    partialize gap.**
  - **THE REFUSAL STAYS RIGHT.** `?? todayISOLocal()` deleted worn athletes'
    weeks; **nothing here reads the device clock.**
  - **THE WORLD IS ASKED WHAT IT REMEMBERS** instead
    (`rules/generationAnchorRecovery.ts`): stored anchor → **its own earliest
    microcycle start** → oldest ledger decision. **A world testifying to
    NOTHING still refuses, typed.**
  - **NO WRITE, NO NEW STORED STATE.** The recovery is derived; the rebuild
    re-stamps the anchor, so the world heals itself without reaching around the
    store's write owner.
  - **`wornWorldBootTests` CAUGHT IT AND WAS RE-AIMED, NOT LOOSENED** — its law
    is "do not invent today", never "always refuse". It now pins that a
    recovered world reproduces the athlete's weeks EXACTLY and never lands on
    today. **This is also the install-over reproduction the standing order
    demanded: red before, green after, on an ACCUMULATED world. The
    fifty-fifth pass's debt is PAID.**
  - **NEITHER SUSPECT FIRED.** (a) was real, mine, and fixed at `1682f6fd` —
    but it was not his failure. (b) was never implicated.

- **THE BOOT ARMOUR (fifty-fifth pass).**
  - **THE REGRESSION WAS MINE, at `ca89ff7f`:** `replayableEntries` throws on a
    row whose `decision` is missing, and it runs OUTSIDE the per-entry
    try/catch. Before the filter existed a bad row broke only its own replay.
  - **FIXED IN TWO HALVES:** every exported ledger reader is TOTAL (unreadable
    rows dropped and COUNTED, `unreadableEntryCount`); and the boot's **replay
    PHASE** is wrapped — not one kind, because the per-entry catch never covered
    computing the replay SET.
  - **GENERATION IS DELIBERATELY NOT CAUGHT.** Replay is recoverable; generation
    is not, and a blank app serves nobody better than the error screen. Cell
    [17] pins that scope in both directions.
  - **SUSPECT (b) — the deleted mark-writer — IS NOT CLEARED.** The fix would
    stop it being FATAL, which is a reason to expect his phone to open, not
    evidence of which suspect fired.
  - **ORDER 1 WAS NOT DONE AS SPECIFIED:** the install-over accumulated-world
    boot is still UNBUILT, and the order's own L13 point stands — my new cells
    are fresh-world cells too. **That is the next pass's first debt.**

- **⚠ SAM: THE FIRST THING TO LOOK AT ON THE PHONE — move a session on the
  Program screen.** A toast should say *"You moved a session"* with **Undo**.
  Tap it: the week goes back, and it stays back after a relaunch. **Nothing else
  changed on that screen.** Batch 29 is two words (`"You"`, `"Undo"`), PROPOSED.

- **THE UNDO UNIT — BUILT, GATED, WITH ITS CLASS STILL OPEN.**
  **READ:** docs/LR29_UNDO_BUILD_BOUNDARY_2026-08-09.md (+ its addendum) ·
  rulings docs/UNDO_SHAPE_RULING_2026-08-09.md ·
  docs/UNDO_SURFACE_RULING_2026-08-09.md · gate `test:undo-reversal` (14 cells) ·
  instrument `npm run tape:lr29-undo-durability`.
  - **UNDO = APPEND A `reversal`, RE-DERIVE.** Two statements, **zero new stored
    state**, durable across a process death. The kind has been declared since
    R1.1 and inert; this is the heir `quiescentBoot.ts` named.
  - **§4 CLOSED BY DELETING A REPRESENTATION.** A move wrote a calendar `rest`
    mark that is not a decision, so undo could not take it back. **Sam had
    already ruled that exact write out of the sibling deletion door on
    2026-07-30**, and the move's own constraint already owned the emptiness. The
    write is gone; nothing was added to the undo door.
  - **THE TOAST IS UNDO'S ONLY SCREEN-LEVEL AFFORDANCE** (surface ruling: the
    bar and sheet are dead, change-talk belongs to the coach tab). It **reads the
    ledger** rather than being raised by ten call sites, so every door gets it by
    existing.
  - **THE CLASS IS OPEN:** undo is proven complete for **one** decision kind.
    `side-writer-outside-the-ledger` sighting 1 — the compression rule is a
    CENSUS of decision side-writers, not another per-kind fix.
  - **COPY GATES GREEN IS NOT EVIDENCE:** batch 29 lives in `rules/`, invisible
    to the extractor. On the module, **not on the sheet.**
  - **PARKED to the coach kickoff:** undo of a COACH-authored decision. The
    mechanism does not read provenance, so it would currently offer one.

- **THE HIDE** (`7f9e54ab`, ruling committed as authored first at `47312bd9`;
  native rebuild artifacts at `77f5e415`).
  **READ:** docs/JOURNAL_HIDDEN_BOUNDARY_2026-08-09.md
  - **R5.7's shape exactly: ENTRY SURFACE GONE, MACHINERY FROZEN NOT DELETED.**
    One `Tab.Screen` block removed at the navigation owner. Restoring it is one
    block. Nothing deleted, no copy withdrawn, **batches 15-28 stay signed**.
  - **THE FINDING: "unreachable = nothing can ever fire" is HALF TRUE.** True of
    every future schedule — the opt-in has one product caller and it is the
    hidden screen. **False of a schedule already accepted: the OS is this
    feature's store and it outlives the surface.** Tapping one would have
    navigated to a tab that no longer exists, which THROWS, with the athlete not
    yet in the app.
  - So: tab removed, tap door removed, **cancel added on mount** through the
    service's existing door. Stateless, idempotent, **no new stored state —
    north star NEUTRAL.**
  - **THE TWO DATA-CREATING TAPS STAY** ("How did that go?", the post-game
    legs/energy rating) — seat-ruled, **Sam's veto open**. They live on
    `SessionFeedbackPanel`, and the gate proves that screen still REACHABLE hop
    by hop rather than merely present.
  - **NEW GATE `test:journal-hidden`, 35 cells** — the gate must watch the
    deleted surface. **6 cells re-aimed, none deleted. 9 mutations, 9 red.**
    M6's first probe was a prefix of its own mutation and **the harness refused
    to read the result** instead of reporting a survivor.
  - **`a count taken for a record` — TENTH SIGHTING**, in the new gate on its
    first run: the opt-in sweep read its own OWNER as a second caller. The
    instrument counted a NAME; the claim was about CALL SITES.

- **GATE:** full `test:bible` **UNPIPED `GATE_EXIT=1` at
  `test:program-control-durable`, 1 FAIL line** — main's declared red.
  `test:compile` PASSED, totals byte-identical to baseline (35/51/373).
  **Sweep 2 of 171** = the declared set exactly. **The denominator moved
  170 → 171 in the commit that earned it** (`test:program-control-decisions`,
  which sits at position 100, past the chain's exit at 91 — the sweep is what
  proves it).
  **THE DENOMINATOR MOVED 169 → 170 IN THE COMMIT THAT EARNED IT**
  (`test:undo-reversal`), and it still names its instrument: chain steps /
  `npm run` suites / **sweep suites** are three different units (the sweep
  runner excludes `test:compile`). **`test:undo-reversal` sits PAST the gate
  exit at position 92, so the chain never reaches it — the sweep is what proves
  it green.**

- **THE LR-29 REPLAY UNIT IS OPEN — UNDO IS ITS FACE** (Sam's addendum,
  docs/REPLAY_UNIT_KICKOFF_2026-08-07.md; dependency list at
  docs/REPLAY_UNIT_DEPENDENCY_LIST_2026-08-07.md). **The opening law held:
  built from the measured map, item 1 first, no serial discovery.**
  **READ:** docs/LR29_ITEM1_BOOT_REPLAY_TAPE_2026-08-09.md ·
  instrument `npm run tape:lr29-boot-replay` (NOT in `test:bible` — it asserts
  nothing and prints a measurement).
  - **ITEM 1 IS NOT ANSWERED, AND THE PROBE IS WHY.** `6 → 6 → 6`: a whole-day
    delete put **nothing** in the accumulator, so "the boot reconstructed it"
    and "there was nothing to reconstruct" are the same reading. Reporting that
    beat opening the unit on a vacuous green.
  - **AND THE REASON IS A CONDITION, NOT A GAP.** A typed reduction is not what
    a delete produces — it is what a delete produces **when the week cannot
    absorb it** (`userRemovalConstraints.addFrequencyReduction`: *"relocation
    and substitution were exhausted"*). The world was reached correctly and the
    probe was too easy. **Item 1 is ONE ACT away, not one investigation away:
    delete enough of a pattern that §18 cannot repair it, then photograph.**
  - **EVERY REDUCTION IN THAT WORLD IS GENERATION-AUTHORED POLICY**
    (`game_load_protection` ×3, `deload_policy` ×3) and survives because **the
    boot re-generates** — no ledger replay involved. The athlete's delete landed
    in `userRemovalConstraints`, which the boot DID reconstruct (1 → 1).
  - **THE FIND WORTH CARRYING INTO THE BUILD: the answering RUNG moved while
    the answer did not.** A past week's overlay did not survive the boot and the
    door answered from the covering microcycle instead — row-for-row identical,
    so nothing visible changed, **which is exactly why it would never be
    noticed.**
  - **THE INSTRUMENT'S OWN DEFECT, CAUGHT MID-RUN:** the first photograph read
    `programStore.exposureContractsByWeek` and reported ZERO contracts in all
    three worlds. **The declaration lives on the overlay or the covering
    microcycle** — it now asks through `selectStoredWeekDeclaration`, the door
    every reader uses.
  - **ITEM 2 IS A DESIGN FORK NEEDING A RULING, not a measurement:** the
    ledger's six kinds cannot express illness, injury, readiness or phase, so
    replay consumes ledger + fact stores, or the ledger gains R3's fact
    decisions first. **Undo's SHAPE IS RULED — one step (2026-08-09), and the
    fork above is no longer abstract: the calendar-mark finding is that same
    §3 fork, reproduced in the athlete's most visible feature.**

- **COACH REBUILD IS AFTER UNDO, NOT NOW** (seat is preparing its kickoff). Note
  for its design, per Sam: **the journal's behind-the-scenes record — load,
  regions, feel, niggles — is an INPUT to coach intelligence.** That is why the
  data layer stayed live and why every journal suite is pinned in the chain.

- **STRUCK BY THE HIDE:** C4 (the week bars' colours), the three proof answers,
  "March 2025", 08:00 as the hour, the restored lifts line, the in-app off
  switch. **The weekday `+1` conversion is now unproven AND unprovable without
  restoring the tab** — the proof panel lives on the hidden screen. Closed by
  removal, not by an answer.

- **STILL OPEN, NOT THIS UNIT:** the **~150 `label:` strings across 20+
  `utils`/`rules` modules** invisible to both copy gates. Legacy
  `JournalStack`/`JournalHome`/`RouteEnum.JOURNAL` in `src/types/navigation.ts`
  — type-only debt from the OLD purged journal tree, named not hunted. **No
  instrument distinguishes "shipped" from "shipped and reachable"** — the sheet
  now records ~100 signed strings that are present and unreachable.

- **STILL TRUE FROM THE MERGE (2026-08-07, `89b540f9`):** main carries Stage B
  stages 1 + 2; a green main went to a **2-red main knowingly** —
  `test:program-control-durable` + `test:fixture-identity`, the declared set
  exactly. **`fixture-identity`'s payer is the LR-29 replay unit** — re-measured,
  it goes GREEN under `LFA_FLIP_DOOR=1`. That is the unit opening now.
- **DEFERRED, NOT FORGOTTEN:** coaching QUALITY — *"labels are okay but the
  programming is pretty shit"*, docs/COACHING_QUALITY_EXHIBITS_2026-08-07.md.
- **WATCH-FORS still open on Sam's device:** completed-day display at the next
  completed session; the three fallback sheets; stale-banner Review; the
  team-training affordance.
- **INBOX CONVENTION:** an empty queue is written `(none)`, **unnumbered** — the
  stop hook read a numbered empty marker as an order twice.
- **Standing:** `test:bible` is the ONLY official gate, unpiped, per commit — and
  it **stops at the first failing suite**, so anything after position 92 needs
  the sweep. `npm run test:bible:parallel` is a NON-OFFICIAL fast pre-check.
  Verify `git branch --show-current` before every commit (shared worktree).
