# NOW — overwrite at every checkpoint (pointer, not history)

- **BRANCH:** `main` · **HEAD:** the coach's move actually lands. S4 not started,
  as ordered. Sam's boot fix below is still UNSEEN on his phone and is still the
  first thing to look at.

- **⛔ OPEN BLOCKER — THE MAESTRO RIG CANNOT RUN: THE SIMULATOR BINARY IS ONE DAY
  TOO OLD. HELD, NOT BEING FIXED.** Every flow dies on the launch path with
  `Cannot find native module 'ExpoPushTokenManager'` — `expo-notifications` →
  `journalReminderService.ts:33` → `AppNavigator.tsx:7` → `RootNavigator.tsx:6`
  → `App.tsx:69`, so no flow reaches any screen. **DATED RECEIPT:**
  `expo-notifications` entered `package.json` 2026-08-09 (`8b12fcdd`) and
  `ios/Podfile.lock` the same day (`77f5e415`); the installed simulator binary is
  from **2026-08-08** and contains **zero** occurrences of `ExpoPushTokenManager`
  (`strings` over the installed Mach-O). Metro serves today's JS to a binary that
  predates the dependency. **THE FIX IS A NATIVE SIMULATOR REBUILD**
  (`npx expo run:ios`, Debug), and it is **HELD until Sam's device workspace is
  free** — a second `xcodebuild` against the same workspace and DerivedData would
  contend with his in-flight device build. **Nothing that needs glass can be
  measured until this clears**, which includes both OPEN-UNKNOWNs below.
  - **THE L-C3 FLOW IS NOW WRITTEN AND HAS NEVER BEEN RUN, WHICH IS SAID HERE
    RATHER THAN LEFT TO BE DISCOVERED.** `.maestro/keyboard/` — a parameterised
    matrix (`conversation-keyboard-matrix.yaml`, so S4 joins by passing
    parameters, not by copying) plus the coach-tab caller
    (`coach-tab-keyboard.yaml`) carrying both OPEN-UNKNOWNs. Every testID in it
    was verified to EXIST in product source; **existence is not reachability**,
    and its YAML parses — that is the whole of what it currently claims. Run it
    with `E2E_METRO_URL=http://127.0.0.1:8081 npm run e2e:maestro:ios --
    .maestro/keyboard/coach-tab-keyboard.yaml` once the binary is rebuilt, and
    treat the first run as AUTHORING, not as a regression check.
    **The Undo assertion in it is EXPECTED TO FAIL** — that red is the finding,
    not a broken flow. And the toast has **no testID at all**, so it can only be
    matched by its copy, which is the weakest anchor in the file.
  - Separately FIXED and committed this pass (`dd192603`): eight of the eleven
    flows had *also* been crashing the app since 2026-07-18 because
    `reset-seed.yaml` omitted `e2eLaunchPurpose`, which
    `DevE2ELaunchDiagnostic.swift:55-60` treats as a `fatalError`. That half is
    verified green — the launch step and `e2e-entry-ready` now pass. **The rig
    had two independent breaks and only the first is paid.**

- **⚠ SAM: I TOLD YOU THE COACH COULD MOVE A SESSION. IT COULDN'T — AND NOW IT
  CAN.** The seat ordered a tape that actually runs the door instead of reading
  it. First run: your own tap on the Program tab moved the week and recorded it;
  **the coach's identical move, same world, same two days, same run, did nothing
  and told you *"Cannot safely apply this day/session action without the current
  visible week."*** One missing argument, fixed. What the tape says now: the two
  moves produce a **byte-identical** week, a byte-identical ledger entry, the
  same week after a relaunch, and Undo unwinds the coach's move and it stays
  unwound. `npm run tape:coach-move-durability` ·
  docs/COACH_MOVE_DURABILITY_BOUNDARY_2026-08-10.md

- **⚠ SAM: YOUR MULTI-SESSION CATCH — I COULD NOT REPRODUCE WHAT YOU SAW, AND I
  FOUND A DIFFERENT REAL DEFECT LOOKING FOR IT.** You said *"i tried moving
  monday S&C to wednesday and it only moved the strength"*. Measured in
  `tape:coach-move-durability` (new multi-part section):
  - **On a plain two-part day (strength+conditioning) the move carries BOTH
    parts** — coach and your own tap, identical. **Your partial-move symptom did
    NOT reproduce.** I am not reporting it as fixed; I am reporting that this
    world did not reach it.
  - **On an ANCHORED day (Monday = strength + team training, your exact day
    shape) the coach is REFUSED** — *"This would remove or replace a protected
    game/team anchor"* — and it tells you *"I couldn't make that change."*
  - **AND HERE IS THE DEFECT, MEASURED:** on that same day, your own tap
    carrying the picker's own *"Just the gym session"* row **APPLIED** — the
    strength moved, team training stayed. **The coach is refused exactly where
    you succeed.** Same day, same destination, same door. That is an L-C4 parity
    break, measured rather than argued (arm D).
  - **THE LIKELIEST EXPLANATION OF WHAT YOU SAW, AND IT IS A HYPOTHESIS — no
    cell holds it:** if you tapped *"Just the gym session"* on a Monday that also
    carried conditioning, **only the strength would move, which is exactly what
    you describe.** *"Gym session"* may be reading to you as *"my whole S&C"*.
    **Tell me what Monday actually carried** (strength + conditioning + team
    training?) and whether you used the coach or the picker — that one answer
    decides whether this is a copy defect or a door defect.

- **⚠ SAM: WHAT THE COACH TAB DOES, WITH WHAT HOLDS EACH CLAIM.** Every line
  below is either pinned by a named cell or marked **OPEN-UNKNOWN** — the new
  standing rule (AGENTS.md), written because *"why is Friday heavy? is refused"*
  reached you here and was false.
  - Type **"move Friday to Sunday"** or *"can you move Friday to Sunday?"* and
    it is read as a change, not a question — `test:coach-tab-slice3` [1], the
    marker matrix, 11 rows.
  - A card comes up in the strip above the keypad — what changes, from what, to
    what, and why — with **Make the change** and **Not now** — [3] and [6].
  - **Nothing happens until you tap** — [3]: a proposed action always arrives
    with its card, and the screen holds no executable it cannot show.
  - **Tapping it goes through the same door as your own tap, and Undo covers it**
    — `tape:coach-move-durability`, both arms byte-identical through a relaunch,
    and section [7] pins the argument the tape found missing.
  - **The Undo TOAST on a coach move: OPEN-UNKNOWN, and the source now says it
    probably does NOT appear.** The toast reads the ledger and the coach's
    decision is byte-identical to yours, so it *should* appear — but
    `UndoToast` is mounted in exactly ONE place, `HomeScreenV2.tsx:1225`, and
    **`CoachTabScreen` mounts no undo surface at all.** Its own docstring says
    *"This mounts once, on the Program screen."* Because bottom tabs stay
    mounted, the likely behaviour is worse than absence: the toast arms
    invisibly behind the Coach tab and **burns its own 6-second timer**
    (`UndoToast.tsx:31,47`), marking the entry seen, so it is gone before you
    ever switch tabs. `rules/undoToast.ts:17-19` predicted the gap in writing —
    *"A coach-authored change would appear here for free."*
    **THIS IS A HYPOTHESIS, NOT A FINDING: no cell holds it and no glass has
    confirmed it**, and the rig that would confirm it is the blocker above. It
    is row-listed in the L-C4 parity census as a coach/athlete parity defect.
  - **Both card buttons reachable with the keyboard up: OPEN-UNKNOWN, and it is
    the thing to watch.** Every keyboard cell reads SOURCE; no keyboard has been
    raised in this repo. The card adds height to the strip that rides the keypad
    — if anything overshoots or sits under the keys, this is the slice that
    shows it.
  - It still ANSWERS the same three questions — `test:coach-tab-slice2`, 76 cells.
  - **And the thing I told you it refused — *"why is Friday heavy?"* — it did
    NOT refuse: it answered "Friday: Lower Squat."** You asked WHY and it told
    you WHAT. Fixed; it now says it has no answer, honestly — [2], *"a reason
    question about a day is placed as a REASON"* + *"Sam's own message is placed
    as a reason question"*. The Bible layer is what fills it.
  - **Tell me the first request it refused that it should have proposed.**

- **COACH SLICE 3 (2026-08-10).** **READ:**
  docs/COACH_SLICE3_BOUNDARY_2026-08-10.md ·
  docs/COACH_MOVE_DURABILITY_BOUNDARY_2026-08-10.md · gate
  `test:coach-tab-slice3` (**127 cells** — 116 at the slice, +11 for the tape's
  finding; **27 mutations, 27 red** across the suite's life).
  - **THE DOOR HAD NEVER RUN, AND WHEN IT WAS RUN IT DID NOT WORK.** The
    confirm handler passed the door `{ todayISO }` and every plan-change action
    needs a visible week, so the coach's move was inert while 116 cells stayed
    green — **all of them claims about which FUNCTION is called, and the defect
    was in an ARGUMENT.** Fixed; section [7] pins the argument and compares it
    to the sheet's. See the durability boundary above.
  - **ONE READING SEAM, NOT TWO READERS.** *"Can you move Friday to Sunday?"*
    carries an interrogative AND a move verb; two readers tried in sequence
    answer by table order, which is the slice-2 class exactly. The MARKER MATRIX
    was written before the resolver, as ordered — **eleven rows, seven matching
    three families at once**, and it is what reds when the precedence is
    reversed.
  - **THE CARD IS A PROJECTION OF THE ACTION** (L-C2). `changeCardFor` sees the
    action and the week and nothing else — no message, no request, no
    conversation — so card and change cannot drift. A kind it cannot draw gets
    no card, and `coachProposal` returns action-and-card together, so *"a
    proposed action without a card"* is unrepresentable.
  - **THE TRUTH GATE HAD NO VOCABULARY FOR A MOVE.** All fourteen forbidden
    phrases came from the substitution incident; none could catch a coach
    claiming a move it had not made. Three added, the confirmation worded in the
    first person so the gate can read it. **Measured, not assumed:**
    `test:coach-truth-gate` 61/61, and the frozen command-router's single red
    reproduces byte-identically against a restored baseline copy.
  - **THE REFUSAL RUNG CAME FREE.** Capability is checked before the destination
    is asked for — because L-C1 requires it — so *"why can't I move Saturday?"*
    is answered with the day's own recorded refusal, spoken verbatim.
  - **A DEFECT IN SLICE 2's SHIPPED CODE, found by needing two days:** day
    resolution walked `WEEKDAY_INDEX`, so the day the coach picked was decided by
    the order of `WEEKDAY_NAMES` rather than by the sentence. *"Am I training
    friday or monday?"* answered about Monday. Third sighting of an ordered table
    answering a question about specificity.
  - **TWO MUTATIONS SURVIVED AND BOTH WERE MY CELLS PASSING FOR THE WRONG
    REASON** — a sort no input could observe, and a no-card probe whose payload
    was missing the field rather than the kind. Re-aimed and re-probed, both red.
  - **THE L-C3 DEVICE FAILURE (inbox item 0) IS FIXED AT THE SHARED OWNER.**
    `KeyboardStickyView` lifted the footer and **nothing ever moved the body** —
    `flex: 1` inside a root that does not shrink, so the list ran behind the
    keypad. Hidden everywhere else because `KeyboardAwareScrollView` scrolls the
    FOCUSED INPUT clear, and **a screen whose input is in the FOOTER has no
    focused input in the body at all.** The body now reserves the keyboard's
    height off the same native frame the footer rides; the conversation pins to
    bottom on new content when already at bottom, and re-pins on
    `keyboardDidShow`. `test:keyboard-convention` 43/43.
  - **AND THE FREE DEVICE EVIDENCE HELD A DEFECT: *"why is Friday heavy?"* was
    NOT refused** — the day marker won and it answered with Friday's session
    list. Both the slice-2 boundary and this file said otherwise; **no cell held
    the claim.** Fixed as a `reason` subject, recognised positively and answered
    honestly — the arm the Bible layer lands on.
  - **NOT COVERED, first line: ~~THE DOOR HAS NEVER RUN~~ — PAID, AND IT WAS
    RIGHT TO WORRY.** The tape exists (`tape:coach-move-durability`), the door
    runs, and the run found the slice inert. What is still uncovered: **no
    React** — nothing is mounted, so render order, a stale closure and the
    settling effect's timing are outside what the tape sees; **one action kind,
    one week, L13 depth 1**; and the Undo TOAST over a coach move is
    OPEN-UNKNOWN. **Item 0 is fixed in SHAPE, not proven on glass** — every one
    of its cells reads source, no keyboard has been raised here, and the inset
    is a Reanimated layout animation only a device can judge.
    **No follow-up context:** both asks teach the whole shape because a bare
    *"friday"* in reply would be read as a question.

- **COACH SLICE 2 (2026-08-10).** `5ff09347` (the seat's parked ideas) ·
  `24617f53` (batch 30 ruled, the greeting signed) · `e533f1ec` (the slice).
  **READ:** docs/COACH_SLICE2_BOUNDARY_2026-08-10.md · gate
  `test:coach-tab-slice2` (76 cells, 11 mutations 11 red).
  - **THE GREETING IS SAM'S SENTENCE, VERBATIM, AND IT IS THE ONE BATCH-30
    STRING IN THE SIGNED-COPY SHEET.** A verbatim quote is the strongest
    provenance the sheet has. It ships AHEAD OF THE ABILITY by his own ruling;
    **the re-check condition (a beta gate before S3) is written in the module
    that holds the words and pinned by a cell**, not left in a doc.
  - **THE TRUTH GATE IS THE KEYSTONE, AND IT IS SALVAGE USED UNCHANGED.** Every
    answer runs past `validateCoachCommunicationTruth` with ZERO applied
    changes — the flag that arms `FORBIDDEN_WHEN_NO_APPLIED`. Read-only becomes
    a claim about the coach's MOUTH, not just its imports. **Proven to BITE on a
    real answer with a control beside it**, not on the validator.
  - **THE SALVAGE TARGET RESOLVER COULD NOT BE RE-POINTED, AND THAT IS THE
    FINDING.** `resolveCoachTargetFrame` consumes `ResolvedDay[]` — feeding it
    means a SECOND week representation in the coach's read path, the exact count
    the reassessment ruled against — and it imports a zustand store constant.
    **A salvage module written against a retired representation cannot be
    re-pointed without restoring the representation.** Slice 2 targets a DATE
    looked up in the week it was handed, which is what the ledger's own
    targeting law says a decision may name.
  - **THE READER RECOGNISES POSITIVELY.** No "is this a mutation" test and none
    needed: anything unplaced is `unknown` and the coach says so. **A negative
    test must be exhaustive to be safe; a positive one is safe by being
    incomplete.**
  - **THE IMPORT BAN WAS ONE HOP TOO SHORT AND SLICE 2 IS WHAT EXPOSED IT.**
    The cheapest way to hand the coach a store is now `rules/coachAnswer`, where
    slice 1's cell was not looking — the screen's list would stay spotless and
    the gate would stay green. It now sweeps the screen's `rules/` imports one
    hop out, **excluding `import type`, which is erased.**
  - **A REAL DEFECT FOUND BY PROBING, NOT BY A RED.** *"What am I doing on
    friday this week?"* carries a day marker AND a week marker; the table was
    searched in ORDER and the coach answered with the WEEK and never mentioned
    Friday — **72/72 green throughout, because no cell fed it a message matching
    two markers.** Now precedence is SPECIFICITY, not table order. **The class
    for S3: a first-match-wins resolver needs at least one input matching two
    rules, per pair that can co-occur.**
  - **NOT COVERED, first line: DEPTH 0, NOBODY HAS ASKED THIS COACH ANYTHING.**
    No keyboard case exercised — still the half L-C3 calls a gate failure, and
    it matters more now that the tab has to be TYPED into. **The reader has
    never seen a sentence Sam wrote**; the likeliest failure is a refused good
    question. **Batch 31 is PROPOSED, on the module not the sheet.**

- **COACH SLICE 1 (2026-08-09) — superseded above, kept for its findings.**
  `ee85c40e` (kickoff + mock as authored) ·
  `c25c8b77` (the slice) · `adab18df` (the survivor + the duplicate).
  **READ:** docs/COACH_SLICE1_BOUNDARY_2026-08-09.md · kickoff
  docs/COACH_REBUILD_KICKOFF_2026-08-09.md · gate `test:coach-tab-slice1`
  (57 cells at slice 1; **80 today** — the signing, slice 2 and slice 3 each
  added to it, and cells were re-aimed, none deleted).
  - **THE TAB MOUNTS THE REBUILD, NOT THE SCREEN R5.7 CUT.** `CoachScreen` and
    its stack stay frozen and UNREACHED — the kickoff's supersession answer to
    the parked 41,220-line question, started rather than promised.
  - **THE COACH'S WORDS FOR A DAY ARE THE WEEK ROW'S WORDS** —
    `visibleDayLeadHeadline`, the same call `HomeScreenV2` makes, asserted on
    both sides. Ruling 1 holds by construction, not by care.
  - **L-C1 IS RETURNED AS DATA:** the opener carries the `grounds` it used, so
    "the coach invented a fact" is a testable claim rather than a worry.
  - **READ-ONLY IS AN IMPORT BAN,** not a promise — module families, because a
    ban on a symbol is one rename from useless. **Zero new stored state.**
  - **A MUTATION SURVIVED AND IT WAS THE INTERESTING ONE:** `'Tuesday'` →
    `'Tues'` left 56/56 green, because the derived abbreviation `'Tue'` was
    still correct. Both cells true; the athlete reads "Game Tues".
  - **THE SWEEP FOUND A DUPLICATE PREDICATE THE CHAIN CANNOT SEE** — the same
    tab-count cell in two suites. Four suites censused, all four re-aimed to
    pin the SET rather than the count.
  - **NOT COVERED, first line: DEPTH 0, NOBODY HAS SEEN THIS SCREEN.** No
    keyboard case exercised — which is the half L-C3 calls a gate failure. The
    opener has never run over an accumulated world. **Batch 30 was PROPOSED at
    slice 1 and is RULED as of 2026-08-09 — see the slice-2 block above.**

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
  `test:program-control-durable`, 1 FAIL cell** — *"a move committed durably
  reaches the visible week"*, main's declared red, 92 suites reached.
  `test:compile` PASSED, totals byte-identical to baseline (35/51/373).
  **Sweep 2 of 174** = the declared set exactly
  (`program-control-durable`, `fixture-identity`). **The denominator did NOT
  move this pass — `tape:coach-move-durability` is a TAPE: it asserts nothing,
  prints a measurement, and is deliberately not in the chain. Section [7] of
  `test:coach-tab-slice3` is what the chain sees of its finding.** Previously,
  **the denominator moved 173 → 174 in the commit that earned it**
  (`test:coach-tab-slice3`). Previously: **the denominator
  moved 172 → 173 in the commit that earned it** (`test:coach-tab-slice2`).
  Previously: **The denominator
  moved 171 → 172 in the commit that earned it** (`test:coach-tab-slice1`,
  which sits past the chain's exit — the sweep is what proves it).
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

- **COACH REBUILD IS OPEN AND SLICES 1 + 2 + 3 ARE LANDED** (see the top of this
  file). **The greeting's second sentence — *"I can … make changes to your
  program"* — is TRUE as of slice 3, for one kind.** S4 (*it knows how you're
  tracking*) is next and is NOT started. Sam's note still
  governs S4: **the journal's behind-the-scenes record — load, regions, feel,
  niggles — is an INPUT to coach intelligence.** That is why the data layer
  stayed live and why every journal suite is pinned in the chain.
  Ten unordered coach feature ideas are parked at
  docs/PARKED_QUESTIONS/COACH_WOW_IDEAS_2026-08-09.md (`5ff09347`, the seat's,
  committed as authored). **Item 4 — ASK WHY ABOUT ANYTHING — is the named gap
  between S2's kickoff line and what slice 2 delivers.**

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
