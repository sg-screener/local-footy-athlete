# SEAT INBOX — the review seat writes here; the terminal reads at every stop

**REWRITTEN 2026-08-12 after Sam asked the seat to audit it.** It had grown to
527 lines with three numbering schemes, stale cross-references from the seat's
own renumbering, two orders that contradicted each other, and three items already
done. **Detail lives in the linked docs; this file is the QUEUE.** Keep it under
200 lines.

**ARCHIVED 2026-08-13, because this file has a size budget Sam pays for in
dollars.** The 18 struck-through `~~ORIGINAL~~` blocks — a third of the file —
are in `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md`, **verbatim, nothing
reworded or dropped**, with a pointer left at each site. 96KB -> 66KB.
**Sam's QUOTED WORDS were kept inline wherever an item still answers to them:
his instruction is standing authority, not history.**

## Unprocessed

30-A5. **BLOCKED-BY: sam** — one sentence of athlete copy, nothing else. **⚠ DO
    NOT BUILD A5 — SAM OVERRULED IT 2026-08-12; THE APP ALREADY OBEYS.**

    **THE ONE QUESTION, AND ITS CROSS-REFERENCE WAS DANGLING.** This item said
    *"the only live part is COPY — see AWAITING SAM"* and **AWAITING SAM has no
    such entry**; it was reported in `8c182ca8`'s body and never reached the
    section a reader is pointed at. Written out here so it batches.
    **WHAT THE ATHLETE READS TODAY** (`planChangeRefusalCopy.ts:44`):
    *"This gives you N hard days this week. That's the upper edge."*
    **THE DEFECT IS ACCURACY, NOT CLARITY** — no jargon, so the clarity bar is
    met. But Sam's budget is **prefer 4, permit 5** (Bible `:118`), so **five is
    the upper edge and six is past it**, and one string serves both numbers: at
    six it tells the athlete they are at the limit when they are beyond it.
    **RECOMMENDATION:** keep that sentence for five; give six its own line saying
    it is past the permitted maximum. **The numbers are already his; only the
    words are missing, and athlete copy is never invented here.**
    **His words:** *"should give warnings but allow them to do whatever they
    want"*. `blockOverride.ts` is `canOverride`'s one reader: the app warns,
    records, and proceeds — **a refusal survives ONLY when the action is
    physically impossible.** A 6th hard day is not. **Bible `:118`'s "is refused"
    is the EARLIER text and is superseded on this exact question.**
    **Both routes I proposed (hierarchy refusing on `canOverride: false`;
    widening `hard_stop`) would have BUILT THE REFUSAL HE REMOVED.** Census
    `canOverride: false` = 6 production sites. **The only live part is COPY —
    see AWAITING SAM.**

    ~~ORIGINAL~~ **THE 6TH HARD DAY: SAM SAYS REFUSE, THE MODULE RESERVES ITS ONLY REFUSAL
    FOR INJURY. THE TENSION IS REAL AND IT IS AN ENGINEERING CALL.**

    **OWNED BY THE TERMINAL. Measured, not built — the fix has blast radius.**

    **HIS RULING, Bible `:118`:** *"An edit that would create a 6th hard day is
    **refused**, with plain-language copy saying why."*
    **THE APP:** `weekStructureValidator.ts:481` grades `hd >= 6` as `'strong'`
    with `canOverride: true`, and `conflictResolutionHierarchy.ts:106-107` maps
    **only `hard_stop` to `block`** — `strong` maps to `confirm`. So the week he
    called impossible is **one tap away.**

    **⚠ AND THE OBVIOUS FIX IS BARRED BY THE MODULE'S OWN LAW.**
    `weekStructureValidator.ts:32-35`: *"`hard_stop` — RESERVED for true
    safety/injury situations... **this validator does not emit `hard_stop` for
    programming-risk pairings — those are strong.**"* **A 6th hard day is
    programming risk, not a medical stop.** Promoting it to `hard_stop` would
    break a documented convention to satisfy a ruling — and would make a loading
    decision indistinguishable from a red-flag symptom.

    **TWO HONEST ROUTES, both engineering, neither a one-liner:**
    **(a)** make the hierarchy honour `canOverride: false` so a `strong` finding
    can refuse without claiming to be a medical stop — **this is the one that
    fits both texts**, and it is the recommendation; or
    **(b)** widen `hard_stop`'s reservation to cover authored REFUSALS as well as
    safety, and say so in its header.
    **(a) has blast radius: every `strong` finding's `canOverride` value becomes
    load-bearing. Census what currently sets `canOverride: false` BEFORE
    changing the mapping** — that number decides whether (a) is small or huge.

29-C3. **⚠ I WAS WRONG — THE CENSUS IS RIGHT AND THE BREACH IS REAL. I READ THE
    BIBLE AND IT SETTLES IT AGAINST ME.**

    **HIS TEXT, THREE TIMES, UNAMBIGUOUS:**
    - `:1297` — *"Work intervals longer than 8 minutes are Run or Bike only. Ski,
      Row and Air Bike have a HARD CAP of 8 minutes **in any one work
      interval**."*
    - `:1401` (Rower) and `:1402` (Ski) — *"HARD CAP 8 minutes in any one work
      interval... **Anything longer than 8 minutes must be Run or Bike.**"*

    **"IN ANY ONE WORK INTERVAL" COVERS A CONTINUOUS BLOCK.** A single continuous
    10-minute piece IS one work interval — it is the largest possible one. My
    "a continuous block is not an interval" reading was a distinction Sam never
    drew, invented to explain away a row, and **it would have dismissed a real
    defect.**
    **THE "Short Flush" ROW STRADDLES THE CAP:** *"one continuous 8–10 min
    block"* complies at 8 and breaches at 9 or 10. Its own note calling it
    *"the cap-compliant option"* is true only of the bottom of its range.
    **SO C3 IS BUILDABLE AND THE RULE IS CLEAR:** Ski, Row and Air Bike may not
    render for any work interval over 8 minutes. `ergCapMinutes`,
    `uncappedModalities` and `excludedModalities` already encode it and are read
    by nothing but a test; `renderableModalities` decides by prose regex.
    Interval length is `workPeriod`, a STRING, so a parser is needed — **and the
    authored range "8–10 min" must be read at its TOP, since that is what can
    ship.**

    **OWNED BY THE TERMINAL.**

    **THE CENSUS SAYS** the authored "Short Flush" row breaches the erg cap by
    offering *"one continuous 8–10 min block"* on Ski/Row.
    **THE ROW ITSELF SAYS OTHERWISE**, verbatim (`conditioningTemplates.ts:1197`):
    *"Ski/Row: one continuous 8–10 min block is **the cap-compliant option (rule
    3)**; Air Bike allowed (ruling 5)."* **Sam wrote that it complies, and cited
    the rule while doing it.**
    **THE LIKELY RESOLUTION, and it is a UNIT question — the fourth this
    session:** the cap governs *"work intervals over 8 min"*. **A continuous
    flush block is not a work interval.** If so the row is compliant, the census
    row is over-called, and **an enforcer built to the census's reading would
    REJECT one of Sam's own authored rows.**
    **SO: establish what the cap counts before enforcing it.** Does
    `ergCapMinutes` bound an interval inside repeated work, or any continuous
    block? Bible `:1297` and `:1401-1402` are the text to read.
    **THE REST OF C3 STANDS AND IS BUILDABLE:** `ergCapMinutes: 8`,
    `uncappedModalities`, `excludedModalities` are data read by **nothing but a
    test**, and `renderableModalities` decides Ski/Row by a **prose regex** over
    `modalityNotes`. Interval length lives in `workPeriod`, which is a STRING —
    so enforcement needs a parser over authored text, and that parser must not
    mistake a continuous block for an interval.

28-C1. **COD — SIX WALLS DOWN, ONE LEFT. The trail is archived; this is the live
    state.** Full history verbatim in `docs/SEAT_INBOX_COD_TRAIL_2026-08-13.md`.
    **OWNED BY THE TERMINAL.**

    **SHIPPED AND STANDING** (each survived a revert of the attempt around it):
    the `cod_decel` category; the selector branch; the eligibility gate; the
    explicit 8-quality → category map (which found a THIRD narrowing nobody knew
    about — `aerobic_capacity` splits across two categories, five templates were
    unreachable); Sam's own tab name **"Change of Direction/Decel"** as signed
    copy; and the rest floor, fixed in passing.

    **CLEARED, so nobody re-suspects them:** the week is NOT short of conditioning
    (contract wants 3, ships 3 — the "2" was a count of KINDS, not sessions); the
    reconcile line that lowers a requirement to match delivery **never fires** on
    a real week; the validator's conditioning counter is fine (non-zero on all 17
    QA weeks — a probe read it wrong); the six-day week is legal.

    **THE ONE WALL LEFT:** the week draws its three conditioning sessions from
    **two kinds**, and two of the three are attached to lifting days where hard
    work is correctly refused. **COD must become one of the kinds the standalone
    slot is drawn from.** Eligibility never sees `cod_decel` at all — nine
    refusal points tagged, not one hit — so the block is upstream of eligibility,
    in the standalone caller's choice of kind.

    **NEXT, and it is one line of output:** print what the standalone caller's
    first choice actually is. That says whether the parked rule fires on the slots
    that matter, or whether that path is never reached for the standalone session.

    **⚠ SIX MEASURING FAULTS CAME OUT OF THIS ITEM AND THE RULES THEY EARNED ARE
    BINDING ON EVERY AGENT AND THIS SEAT:**
    1. **State what is being counted and show one instance.** Put the UNIT on the
       number — "3 sessions", "2 kinds" — never a bare integer. Four of the six
       were one word covering two units.
    2. **A zero is the most dangerous number in this repo.** It is equally
       produced by "the thing does not happen" and "I am not looking where it
       happens". Show what a non-zero would have looked like.
    3. **Check the instrument is in place before trusting its silence.** A probe
       that silently failed to apply was read as an answer, twice.
    4. **A function's second caller is a different world.** Five attempts measured
       the attached-conditioning caller while reasoning about the standalone one.
    5. **Is the wall I just hit itself a census finding?** Grep
       `docs/RULINGS_NOT_IN_THE_APP_2026-08-13.md` before treating any obstacle as
       a fact of the system.
    6. **Measure the layer above before changing code** — the terminal's own
       verdict on why five of six reverts happened.


30. **BLOCKED-BY: other-agent** — its owner is inside the fix right now; see the
    marker note at the foot of this item. **EVERYTHING BUILT TODAY MAY BE
    INVISIBLE — CHANGES ONLY REACH A WEEK THAT
    HAS NOT BEEN BUILT YET. THIS IS THE CENSUS DEFECT, IN TODAY'S WORK.**

    **OWNED BY THE DESKTOP AGENT, and it found this itself by putting the away
    flow on a PHONE rather than trusting a green suite.** That is the only reason
    anyone knows.

    **WHAT IT MEASURED:** the away flow is built and tested — team night comes
    off a "Strength + Team Training" day and the gym half survives, a team-only
    night or a game becomes rest, a normal session is untouched, and it all
    returns on the return date. **On the phone, nothing changed.** Tuesday and
    Thursday still read "Strength + Team Training"; Saturday still read "Game
    Day". **Because the code that does it runs only when a week is FIRST BUILT,
    and never re-runs over a week already sitting there.**

    **SAM'S RULING IS THEREFORE UNMET.** Item 22(c): *"the plan should change
    until their return date"*. **Changing what WOULD be built is not changing the
    plan.**

    **⚠ AND THE SAME DOUBT NOW COVERS THE REST OF TODAY. The desktop agent said
    so about its own equipment work — "the note shows up, but I did not confirm
    the exercises changed" — and that honesty is the model. EVERY change landed
    today that is supposed to alter an EXISTING week is now UNVERIFIED, not
    done:** the equipment substitution, the dated equipment span, the modifier
    effects, and anything in the census fixes that reshapes a live week rather
    than a freshly generated one. **Do not report any of them as delivered until
    each has been seen on a week that already existed.**

    **THIS IS THE CENSUS DEFECT WEARING TODAY'S CLOTHES.** Twenty findings said:
    the app holds Sam's logic and does not read it. **This says: the app now
    RUNS his logic and the athlete's week does not receive it.** Same shape, one
    layer later. **The rebuild path is the reader.**

    **BUILD — and it is a real unit, not a tail:** the pass that rebuilds a week
    when something changes must apply the away/equipment/modifier facts to a week
    that ALREADY EXISTS. The desktop agent has written down what it takes.
    **Start it fresh, not at the end of a session — half-doing this is how the
    last two nights went wrong.**

    **⚠ IN FLIGHT BY ITS OWNER RIGHT NOW — DO NOT START A SECOND ONE.**
    **Measured 2026-08-13 05:45 by the terminal, read-only, nothing touched.**

    **ANSWERED IN PART, AND ONE OF MY OWN CLAIMS IS WITHDRAWN. Desktop,
    2026-08-13.** The acceptance this item asks for now EXISTS as a cell:
    `test:program-control-durable` "ITEM 30: an equipment fact reaches a week
    that ALREADY EXISTS" — walk to a world, assert it holds barbell rows, apply
    a `missing_this_week` fact, assert none survive. **It is GREEN**, so the
    equipment substitution does reach an existing week.
    **BUT IT IS NOT MY LANE CHANGE THAT DELIVERS IT.** Putting equipment back on
    the inert lane leaves the cell GREEN — measured by mutation — so that
    substitution was already arriving by another route, and `0f31219d`'s claim
    that the lane fix is what made it land is WITHDRAWN. The lane fix is still
    right (a ruled fact must author its weeks, and it mints the adjustment the
    undo needs); it is not the reader this item was looking for.
    **STILL UNMET: the AWAY half.** The week does move, but the club work does
    not come off, because a day is a team day via the PLAN's `isTeamDay` and the
    name enforcement re-derives it after the constraint seam runs.

    **THE NEXT ACT IS MEASURED TO ITS LINE, so the next pass builds instead of
    hunting.** `coachingEngine.ts:1792` reads
    `teamDayNums = inputs.teamTrainingDays.map(dayNameToNumber)` and `:1798`
    stamps `isTeamDay` from it. Its ONE owner is `onboardingToCoachingInputs`,
    called from exactly TWO places (`generateProgram.ts:939` and `:1469`), both
    of which already hold the week's date and the active constraints. **The
    build: drop a weekday from `teamTrainingDays` when that weekday's DATE in
    the week being planned falls inside a live `travel` span.**
    **THE BLAST RADIUS IS SMALL AND THE REASON IS CHECKABLE: the filter is
    INERT unless a travel fact is live, and no scenario or QA week has one** —
    so the 120-session distribution and the 17 QA weeks cannot move. Run them
    either side anyway and report both numbers.
    **A FIXTURE INSIDE THE SPAN IS THE SECOND HALF and is NOT the same shape** —
    a game is an anchor the week is built around, not a plan flag, so it needs
    its own measurement before anyone touches it.
    **NOT STARTED HERE ON THIS ITEM'S OWN INSTRUCTION** — *"start it fresh, not
    at the end of a session"*. Everything it needs is above.
    The desktop agent has UNCOMMITTED edits in `temporarySourceFactTransaction.ts`
    (last write 05:10) plus four more files, and a `.git/index.lock` stale since
    05:31. **The edit is exactly this item's fix:** `isRuledDerivingConstraint`
    gains `type === 'equipment'` and `scheduleKind === 'travel'`, moving both off
    the INERT lane and onto the DERIVING one.

    **AND THE CHAIN CLOSES — VERIFIED, so its owner does not have to re-find it.**
    The deriving lane calls `commitDerivingSourceFactScopedRegen`
    (`temporarySourceFactTransaction.ts:438`), which calls `generateProgramLocally`
    (`:531`) with the constraints threaded; that is `generateProgram.ts:909`, and
    at `:683-697` it builds `hardPostGenerationConstraints` — **`type ===
    'equipment'` plus any `schedule` kind except `busy_week` and `max_sessions`,
    so travel and equipment BOTH pass the filter** — and runs
    `validateWorkoutAgainstActiveConstraints` over every workout. **That is the
    away rule, reaching a week that already exists.** The boundary report's
    "what it would take" is the shape being built.

    **STILL UNPROVEN AND STILL THE ONLY THING THAT COUNTS: the phone.** No device
    pass has been run on this. **Two green suites have now agreed with a screen
    that had not moved** — do not report it delivered on a suite.

    **THE ACCEPTANCE TEST IS NOT A SUITE. It is a phone, a week that already
    exists, and the change appearing on it.** Nothing else counts as done for
    this item. **A green suite has now twice agreed with a screen that had not
    moved.**

1. **STANDING, EVERY STOP — MERGE, THEN VOCABULARY, THEN PROPORTION.** These are
   always in force; they are not work items to clear.

   **1a. MERGE `codex/*`.** For every `codex/*` branch with commits not in
   `main`: `git merge --no-ff`, run the gates, **fix or report anything red —
   never leave it unmade and never ask Sam to merge.** Quiet if nothing is new.
   **The stop report names in ONE LINE which of Sam's UI changes are now in
   `main`** — his phone runs `main`, so that is how he sees Codex's work.
   ~~KNOWN BLOCKER~~ **PAID 2026-08-12 — `e231a6bc` merged
   `codex/program-week-navigation-bounds` (week-navigation bounds, tired icon
   ladder, phase-shift day grid) and `7aef3749` fixed BOTH reds it brought: the
   three registry rows now cite the boundary docs they shipped with, and
   `profileResetUITests`' phase-sheet slice was re-aimed after `BuildingState`
   moved.**

   **AND THE OTHER 42 BRANCHES ARE STALE — MEASURED, SO NOBODY RE-ASKS.** 43
   `codex/*` branches carry a content delta. **42 of them fork from mid-July and
   sit 1100-1230 commits behind `main`**; merging them would revert a month of
   work. Only `program-week-navigation-bounds` forked from 2026-08-12 (66
   behind). **Check merge-base AGE, never commit count** — `git rev-list --count
   main..branch` says "1 commit" for a branch a month stale.
   **Do not care which folder Codex uses** — the seat broke an isolated worktree
   on 2026-08-12 and Sam said *"you just make things more complicated for no
   fucking reason"*. This order is branch-based. **Do not propose isolation
   again unless a real collision is observed and named.**

   **1b. THE WORD "DONE" IS RETIRED.** Every claim is **WORKING** (name the test
   that fails if it breaks), **BUILT** (code exists, nothing checks it) or
   **WRITTEN** (a doc says it, no code). **Banned: done, shipped, in, handled,
   sorted.** `docs/HOW_WE_STOP_BELIEVING_THINGS_ARE_DONE_2026-08-12.md` §3.

   **1c. MECHANICAL ITEMS BATCH.** A style value, icon, copy string, label or
   one-line predicate with no behaviour change is **batched with its neighbours
   into ONE unit, ONE report, ONE sweep** — no per-item measure/build/mutate/
   report/stop cycle. Test: *would a wrong answer change an athlete's training?*
   If no, batch it. **Mutation testing stays mandatory for anything that would.**
   Rigour on rules work is untouched (`CLAUDE.md:30`).

   **1d. NEVER POLL A LONG RUN.** Start it, block on completion, read the result
   ONCE. **No progress narration, no re-reading files while waiting.** On
   2026-08-12 the terminal spent ~52.8k of Sam's tokens saying *"still zero
   reds"* fifteen times. If a wait cannot be blocked on, say so in one line and
   stop.

2. **MAKE THE CHAIN CHEAP — MEASURED 2026-08-12, AND THIS ITEM'S OWN DIAGNOSIS
   WAS WRONG.** `docs/STOP_2026-08-12_WALKER_TIMING.md`. **Sam, 2026-08-12:**
   *"i want to know how long that 192 tests are taking and if it's really
   necessary"*.
   - **PAID — the ~25 minutes.** `action-walker:deep` is **not** an expensive
     suite: it was **34.6s and green on 2026-08-10**. It cost ~25 minutes on
     2026-08-12 **only because it went RED** — one walk breaks a law at step 87
     and the shrinker replayed the whole 88-action history up to **200 times at
     11-15s a replay**. The walking itself is 7-9s per walk; the laws cost 5ms
     per action; nothing is rebuilt per step; there are no sleeps, polls,
     retries or timeouts. Budget is now **12** (`69f388c3`, both arms
     mutation-checked) and the suite measures **213s**.
   - **"SHARD IT" IS REFUSED, WITH REASONS.** All the time sat inside ONE walk,
     so three shards is still one 25-minute shard; the walks share module-level
     mutable state and cannot overlap in a process; and the stale-debt cell
     reads declared-red hits across the WHOLE tier, so it fails in every shard.
     **"Walk only what changed" does not exist** — there is no map from a source
     file to a walker coordinate.
   - **Per-suite times recorded in `NOW.md`.** The chain is a short head and a
     long free tail: **125 of 165 units finish under a second.**
   - **NOT PAID — `test:accepted-state-transactions` is 89.5s**, the largest real
     unit, new since 2026-08-07, and **never looked at.**
   - **NOT PAID — the agreement law has NOT established agreement.** Last run
     AGREES (158 units, 2.17x) but **the run before it DISAGREED** on
     `chain:runSlice1`'s exit code, and the chain has grown 158 → 192 units.
     **The flake is the finding.** `parallel` stays NON-OFFICIAL; `NOW.md:72` is
     deliberately unchanged.
   - **PAID — the red underneath.** `L-P4 MENU = PROJECTION` fired on a day the
     card called a "Rest" appointment and the projection called a movable
     recovery session. **Sam, 2026-08-12: "recovery session"**, so
     `moveOptionsForDay` now takes BOTH halves of its offer from the projection
     and `MOVE_SCOPE_SECTION_KIND`/`MOVABLE_SECTION_KINDS` are deleted. A
     representation removed, not a guard added. `0ad3793f` — seed 3 clean,
     **deep is 47s**, two mutation-checked cells, sweep 14 of 190 identical to
     baseline.
   - **PAID — `THE L16 SLICE`, and it was a REAL data-loss defect, not a test
     artefact.** A bare profile envelope must ask the disk before it writes; a
     material one need not. So a WIPE issued FIRST landed LAST, on top of the
     answers issued after it — the athlete's 40 answers were in memory and the
     disk held a 103-byte empty shell. Persisted state is inputs only, so the
     next launch had nothing to rebuild the program from. Writes to the profile
     key now chain, which also makes the quarantine law work for the first time
     (the bare write now reads a disk that holds the answers, so it is REFUSED).
     `fd4f68a2` — one mutation-checked cell, **sweep 14 of 190 -> 10 of 190,
     FOUR suites green, ZERO new reds.** Two named suspects were refuted first:
     the quarantine held nothing and the replay latch was false.
   - **NOT PAID, NOT INVESTIGATED — a second defect found on the way past.**
     Rehydrating an EMPTY profile envelope does not merely fail to restore
     answers: `profileStore`'s `merge` spreads `...persisted` over the live
     state, so it flips `isOnboardingComplete` from **true to false** in memory.
     An empty envelope actively un-finishes a finished profile. Reachable
     whenever disk is bare and memory is not.
   - **MEASURED 2026-08-12 — `test:accepted-state-transactions`, and the answer
     is a PRODUCT function, not a test.** `docs/STOP_2026-08-12_ACCEPTED_STATE_TRANSACTIONS_COST.md`.
     **Generation is 12.0s of 91s** — the obvious suspect, refuted, and worth
     only 10% if memoised. A CPU profile put **~33s of self time in ONE
     function**: the gateway's `stateSignature`, a full `JSON.stringify` of
     every workout and exercise row. Instrumented: **977,034 calls, 40.2s, and
     25.9 GB of JSON** — to evaluate at most 48 candidates per search. The
     repair engine bounds `assess` by `maxCandidates` and does NOT bound
     signing: it signs every generated CHILD, and `expand` returns tens of
     thousands.
   - **THE 42% CUT EXISTS AND WAS REVERTED, BECAUSE IT IS NOT FREE.** Queueing
     children unsigned takes the suite **91s -> 53s** and breaks the property
     *"a fixture MOVE publishes its dependent week once"* with
     `following-week dependency was not committed in the same snapshot`. That is
     an athlete-facing atomicity guarantee. **"The pre-check is not
     load-bearing" is FALSE** — a second premise refuted in the same unit.
     Three priced routes are in the doc; **none started**, because the two
     section18 files a real fix touches are mid-flight with another agent.
   - **THE QUESTION THIS OPENED IS CLOSED, AND THE ANSWER IS NO.**
     `canonicaliseHydratedProgram` took **20.4s and 17.9s** on a migrated
     in-season week where three others on the same shape took 8-85ms — so
     "twenty-second launch" was a real thing to fear. **An athlete cannot reach
     it.** The only function setting `structuralMigrationRequired` has NO
     production caller, and `programStore.partialize` persists INPUTS ONLY —
     `currentProgram` never touches disk, so no launch reads a legacy program
     back. The north star is what makes the slow path unreachable.
     **Guarded, because it is one line of `partialize` from vanishing:**
     `test:legacy-migration-unreachable`, mutation-checked both ways.

3. **THE ±7 IS DELETED. FOURTH ATTEMPT, AND THE THREE BEFORE IT WERE HUNTING THE
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 3).**

6. **RE-MEASURED — THE PREMISE MOVED, AND TWO SESSION KINDS ALREADY STORE BOTH
   HALVES OF sRPE WITH NO READER.** `docs/EXPERIENCED_LOAD_MEASUREMENT_2026-08-12.md`
   §6, taken after `0a` put every effort input on one 1-10 scale.
   **Team training stores `effort` + `durationMinutes`. A game stores `bodyRpe` +
   `timeOnGroundMinutes`. Both are written, validated at the transaction
   boundary — and `journalLoad` has NO path for either.** Its only sRPE reader
   takes a `ConditioningPerformanceLog`.
   **SO THE ASYMMETRY IS NOT WHAT §3 SAID.** Three of four kinds have real
   athlete-reported load and two of those three are discarded. **Only STRENGTH
   needs Sam's estimate ruling**; team training and games need **a reader, not a
   ruling**, and it is the same shape as `conditioningSRPE`.
   **THIRD SIGHTING TODAY of written-and-never-consumed** —
   `achievedModerateDayCount` (item 4), `canOverride`, and now these two.
   **Item 10's `LAW-computed-must-be-consumed` is the compression for all of
   them.**
   **THE TEAM-NIGHT READER IS BUILT** — `teamTrainingSRPE` (effort x minutes,
   same unit as conditioning), carried into `deriveSessionLoad`, counted in
   `measured`, and wired from the journal producer so it is read end to end.
   Six cells in `test:journal-load` (122/0), two mutations killed. Registry row
   `LAW-team-night-load-is-read`.
   **THE GAME READER IS NOT BUILT AND WILL NOT BE WITHOUT A RULING** — it stores
   both halves too, but whether a match's minutes are full or weighted training
   load is a coaching question. **Written under `## AWAITING SAM

- **ONE RULING — SPRINT CAP: 2 NIGHTS OR 2-3 EXPOSURES? (census A6). Two of your
  own lines disagree, in different units.**
  - **Bible `:90`:** *"Sprinting limited to **2 nights per week** which includes
    nights at team training."* — HARD, counted in NIGHTS.
  - **Bible `:129`:** *"A second exposure may occur naturally, while **2-3
    remains the usual maximum**."* — SOFT, counted in EXPOSURES.
  **They cannot both be the enforced number.** A hard 2 refuses weeks `:129`
  calls usual; leaving it open is today's behaviour.
  **MEASURED (the census receipt is partly wrong):** four rows carry
  `max: null` — in-season game week, both bye rows, mid off-season. **Pre-season
  is NOT uncapped: `:1030` already sets `max: 2`.** Early off-season is `max: 0`,
  correctly.
  **RECOMMENDATION:** enforce **`:90` — 2 nights, team training counted** — and
  read `:129`'s "2-3" as the exposure preference it says it is, not a cap. That
  makes the four `null` rows `max: 2`. **Units have been the trap tonight, so I
  have not guessed.**

- **ONE SENTENCE — THE 6-HARD-DAY WARNING UNDERSTATES ITSELF (A5's only live
  part). Measured; the block half is correctly NOT built.**
  **What the athlete reads today** (`planChangeRefusalCopy.ts:43`):
  *"This gives you 6 hard days this week. That's the upper edge."*
  **No banned vocabulary — the clarity bar is met.** The defect is accuracy:
  **your budget is PREFER 4, PERMIT 5** (Bible `:118`), so **five IS the upper
  edge and six is PAST it.** One string covers both cases, so at six it tells
  the athlete they are at the limit when they are beyond it — the same shape as
  the shortfall sentence you corrected earlier.
  **RECOMMENDATION:** keep the sentence for five, give six its own line saying
  it is past the permitted max. **The words are yours; the numbers in it are
  already your own (4 preferred, 5 permitted).**

- **ONE CONTENT CALL — THE DOUBLE HINGE (census A4). Measured, and smaller than
  the census says.**
  **His rule, Bible `:226`:** *"ONE MAIN PER PATTERN PER SESSION... A second
  heavy lift in a session must be a different pattern."*
  **MEASURED across every fallback branch: exactly ONE violating shape —
  `RDLs + Hip Thrusts`, both hinge, both classifying as main lifts — in two
  branches.**
  **AND THE CENSUS'S SECOND EXAMPLE IS OVER-CALLED:** `Overhead Press + Incline
  DB Bench` does NOT come out as two mains — only one classifies as a main lift.
  **THE CALL IS WHICH WAY TO FIX IT, and that is CONTENT (L7):**
  **(a) drop Hip Thrusts**, losing a row and shrinking the session; or
  **(b) keep it and lighten it** to an accessory dose.
  **RECOMMENDATION: (b).** It obeys `:226` exactly — the rule bars a second
  HEAVY lift of the pattern, not a second exercise — and it does not shrink a
  session, which is what bit us on team nights.

- **ONE LINE OWED — HOW A PACE IS SHOWN (census C2, the 2km time trial).**
  **Not a bare question: the derivation is built, the number exists, and only
  the WORDS are missing.**
  `deriveMas` is correct and has **zero production callers** — an athlete runs
  the trial, the app validates and stores it, and their conditioning card reads
  the template's authored intensity (e.g. *"Intensity: 110% MAS"*) with **no
  personal pace and no distance.**
  **GREPPED FIRST:** `STAGE_C_TIME_TRIAL_RULINGS_2026-07-29.md` rules the
  DERIVATION (MAS = 2km speed x 1.00; defaults 6:30 / 7:15 / 8:00 / 8:45 by
  level) and **says nothing about display**; the copy sheet has no pace line.
  **RECOMMENDATION:** show the athlete their own pace BESIDE the authored
  intensity, not instead of it — the 55 signed templates own the intensity
  ranges (`masCopy.ts:16`, whose header records the "110% MAS" binary as
  **accreted, not authored**). **The number is ready; only the words are not.**
   **STILL NOT BUILT: strength.** That is where the estimate ruling applies, and
   it is the remaining half of this item.
   **STILL SAM'S:** whether a game's minutes count as full load or weighted, and
   whether strength's VOLUME LOAD may share a column with sRPE (§4's open fork).

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 6).

7. **MEASURED, NOT BUILT — AND SAM'S OWN CASE IS NOT REPRESENTABLE TODAY.**
   Three things checked before writing any code, 2026-08-12:
   **(a) THE PREMISE IS CONFIRMED.** `weeklyExposureContractBuilders.ts:386`
   caps strength at `Math.min(targetCount, selected.length)` — **every selected
   day, the GAME DAY included**, while conditioning and sprint are capped at
   `anchorCredit + placementDays` and `nonTeamDays` (`:277`) exists and is used
   for everything else. **Strength is the only allocation whose capacity counts
   a day it can never be placed on.**
   **(b) TEAM DAYS ARE NOT THE DEFECT.** Strength legitimately STACKS on a team
   night — "Team Training + Upper Pull" is a real generated session — so
   counting team days is correct and the item's phrasing on that point is too
   strong. **The game day is the wrong one to count.**
   **(c) SAM'S SENTENCE CANNOT BE EXPRESSED AT ALL.** *"1 strength session ... if
   they have 2 games and 2 team trainings"* — **the profile has ONE game field**
   (`domain.ts:192,196`: `gameDay`, `usualGameDay`). A second game in a week has
   nowhere to live, so the case that motivates this item cannot be built or
   tested until that lands. **Same blocker item 2 already records.**
   **THE COPY IS ONE TEMPLATE, CONFIRMED** — `section18ShortfallDisclosure.ts:97`
   has a single unconditional return, *"Resting {Day} means you'll miss a
   strength session this week"*, with no branch for a shortfall the FIXTURES
   caused. **The fix needs a second SIGNED sentence, which is Sam's to sign** —
   the words are not the terminal's to invent, and the effort-scale words are the
   precedent (marked PROPOSED, awaiting him).
   **NOT BUILT: the capacity change and the copy.** The capacity change is
   generation behaviour and must land with the full scenario report against the
   committed preference baseline (item 5's instrument, which now exists for
   exactly this).
   **⚠ AWAITING SAM — two things, both his:** the second-game field (or a ruling
   that a two-game week is out of scope), and the words for a fixture-caused
   shortfall.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 7).

9. **PARTLY BUILT — the athlete can now go ahead anyway; the four-answer
   collapse is BLOCKED.** `ca33206f`. `mayOverrideBlock` is `canOverride`'s
   FIRST production reader after nine writes; the block sheet offers "Do it
   anyway" / "Keep my plan" when every finding allows it, and the override is
   recorded on the tape (`athlete_action_override_allowed`) BEFORE the change
   commits. `LAW-warn-then-allow` born guarded; `test:block-override`,
   mutation-checked three ways.
   **BLOCKED, NOT SKIPPED — the remainder needs two files another agent holds.**
   Collapsing the four competing answers onto `resolverMayDisplace` means
   editing `projectVisibleWeek.ts:214-219` and `section18CraftTier.ts:217-232`
   (the `date|name` STRING JOIN that breaks on a rename). Both are mid-flight in
   this shared checkout. **Take it when they are clear.**

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 9).

13. **KEEP THE UNENFORCED LAW COUNT FALLING.**
   **WHAT IS LEFT IS PRICED, 2026-08-13 — so the next pass does not re-derive it.**
   Four of the remaining 29 were measured tonight and each needs something a
   gate cannot supply:
   - **`LAW-green-gate-is-a-claim`** — needs STANDING MUTATION TESTING, which is
     infrastructure with a runtime budget, not a cell. **Its precondition is paid
     (see below); the keyword shortcut is REFUTED.**
   - **`LAW-L9-checkpoint-discipline`** — **1 of the last 40 `src/`-touching
     commits moved `NOW.md`.** A gate reds on arrival, and **git history cannot
     shrink, so the debt-ratchet shape does not apply.** It needs a
     from-here-forward cutoff, which is a process decision over other agents
     mid-flight and is not the terminal's to impose alone.
   - **`LAW-attributed-content-change`** — its row names a one-line probe, but
     the suite that owns the case says the loss **reproduces ONLY on a real
     accepted composition base with the dev-reset Saturday game mark**, and that
     a hand-built seed does NOT reproduce it. Reaching that world is the unit.
   - **`LAW-L6-honest-actions`** — structural: success derived FROM the applied
     transaction rather than composed beside it. Unchanged assessment.

   **A FOURTH PASS THAT DID NOT LOWER THE COUNT, AND SAYS SO. 2026-08-13.**
   `LAW-green-gate-is-a-claim` — the law every guard tonight rested on — had
   **NO RULING SITE**: cited by boundary reports for weeks, obeyed by habit,
   written nowhere. Its own row named that as the precondition. **It is now
   written down as `AGENTS.md` L12a, beside L12 whose other half it is, and the
   row's `ruledAt` points there. The precondition is PAID.**
   **THE OBVIOUS GUARD IS REFUTED, so nobody builds it twice.** A per-suite "does
   this file carry a liveness arm" scan **is satisfied by a COMMENT** — it reads
   prose, so a suite could mention the word and pass while asserting nothing.
   **That gate would BE the green-and-empty shape the law forbids.** Measured:
   **21 of 200 chain suites** carry any liveness or mutation arm. The honest
   mechanisation is standing mutation testing in the chain — infrastructure with
   a runtime budget, not a cell — so the row stays **UNENFORCED honestly rather
   than closed with a scan that could not fail.**

   **PAID A THIRD TIME, 2026-08-13: 30 -> 29.** `LAW-anchor-must-be-found` is held
   by `test:repo-law-guards`, on its DECIDABLE half — an `indexOf` anchor must be
   proven found before it is used as a `slice` bound. **`indexOf` returns -1 on a
   miss and `slice(-1, …)` reads from the END of the file, so the cell asserts
   something TRUE about the WRONG region and goes green.**
   **MEASURED BEFORE BUILT: 124 unguarded anchors across 32 files** (of 335
   total), carried as **per-file, shrink-only debt** — per file, not one total,
   so a new one cannot hide behind someone else's repair. Largest is
   `dayFirstTimelineTests` at 47. Mutation-checked three ways.
   **THE `{0,N}` HALF IS NOT DONE and is named, not forgotten: 194 character-window
   regexes exist; banning them would red 194 places at once and deserves its own
   unit.**

   **PAID AGAIN, 2026-08-13: 31 -> 30** (`a538a12f`). `LAW-L15-one-write-format`
   is held by `test:repo-law-guards` (already in `test:bible`) — four cells,
   mutation-checked five ways. Detail in the commit and the registry receipt.
   **THE FINDING, because it outlives the cell:** twelve of thirteen persisted
   stores have exactly ONE writer. **`useProgramStore` has 8 `setState`
   occurrences, 6 of them across 5 modules that do not own it** — carried as
   dated, shrink-only debt, because whether an L12 transaction owner is a second
   live writer is an ARCHITECTURE ruling, not a test edit.
   **STILL UNENFORCED of the priority four:** `LAW-L6-honest-actions` and
   `LAW-attributed-content-change`. **The second cannot be flipped by building —
   its own row says what a guard would take is NOT YET KNOWN and names a
   one-line measurement as the next act, not a gate.**

   ~~PAID ONCE, 2026-08-12: 32 -> 31.~~ `LAW-L5-no-dead-affordances` is guarded
   by `test:dead-affordances` (in `test:bible`, mutation-checked three ways on a
   real screen). **It holds ONE SHAPE and the receipt says so first:** a press
   that provably does nothing and a control disabled by a literal. The walker
   pass the old row asked for is still unbuilt.
   **Its two founding cases both landed in this session and neither was caught
   by anything** — My Status's seven live-looking dead controls (`8de98d3f`) and
   the block sheet's single `OK` (`ca33206f`).
   **AN ALLOW-LIST, NOT A BAN:** both `onPress={() => {}}` in the tree are
   CORRECT (a tap-shield over a modal's dismiss layer, and a dev panel), so a
   no-op press must DECLARE itself with a reason. `disabled={notYet}` — a
   variable — stays legal.
   **STILL UNENFORCED of the priority four:** `LAW-L6-honest-actions`,
   `LAW-attributed-content-change`, `LAW-L15-one-write-format`. L6 is the
   hardest and the most valuable: it is the general form of "Done. Session
   moved." beside a deleted row.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 13).

14. **PARTLY BUILT — the two that could change training are done; one is
   DELIBERATELY NOT.**
   **OFF-FEET WALKING — FIXED, and it was real.** `brisk_walking` was the only
   on-feet family that never asked about `conditioningOffFeet`, so an athlete
   told to stay off their feet was refused running, refused hills, **and handed
   a walk** — the one thing the instruction was about. Both gates now derive
   from `FAMILY_ON_FEET`. `test:off-feet-walking`, in `test:bible`,
   mutation-checked: restoring the original condition reds the BEHAVIOURAL cell,
   not just the table.
   **AND THE TABLE FOUND AN ELEVENTH FAMILY ON ITS FIRST COMPILE.** `mixed` is
   in the family UNION and absent from `ALL_FAMILIES`; a `Record` over the union
   cannot be partial, so the type checker asked before any cell ran. That is the
   argument for a table over two more `&&`s, made by the compiler.
   **PROFILE "SOMETHING CHANGED?" DIAGNOSTIC — REMOVED**, as Sam confirmed the
   dead tap now works: the counter readout, its state and all four `logger.warn`
   probes. **The `__DEV__` stored-state export block is UNTOUCHED** — a separate
   2026-07-30 concern, exactly as this item instructs.
   **`ModifiersStrip`'s TWO "DEAD" UNION MEMBERS ARE NOT DELETED — AND SAM HAS
   NOW SAID YES.** Holding them was right: `'day'` and `'week'` become live in
   **item 16**. Had they been deleted 2026-08-12 they would be going back in
   today. **Nothing owed here; see item 16.**
   **WORKED 2026-08-13 (`e303c2f4`) — AND MEASURING IT CHANGED THE UNIT.**
   **ATLAS §4.4's PREMISE IS REFUTED WHERE IT MATTERS.** Over 120 generated
   sessions: **Strength 5-6, Mixed 4-6, Team Training 2-4. ZERO over the
   authored ceiling of 6**, so enforcing the ceiling would guard a shape that
   does not occur — **and all 26 sessions under 4 are TEAM-TRAINING nights**.
   **I THEN CALLED THAT CORRECT BECAUSE THE ATHLETE IS "already at the club",
   AND SAM STRUCK IT AS FALSE — see item 21.** Same day is not same place. The
   26 are a DEFECT; the comment that justified them is deleted.
   **BUILT — the part needing no ruling.** `MIN_SESSION_SIZE` was PRIVATE to
   `exerciseScorer`, making session size two representations. It is now
   `SESSION_SIZE_FLOOR` in `sessionRowCounting`, **labelled UNAUTHORED**. Same
   value; the distribution is byte-identical before and after.
   `test:row-counting` 31 -> 34 cells, BEHAVIOURAL, mutation-checked both ways.
   **NOT BUILT ON PURPOSE, TWICE.** (1) **`MIN EXERCISES PER SESSION` is NOT
   emitted to the prompt** — an invented MIN beside the authored MAX ships a
   number nobody authored as coaching instruction (L7). (2) **No predicate
   judges a session against the bounds** — it would have no production reader,
   and a reader-less field is banned here. **Sam's ruling gives it one.**
   Question filed under AWAITING SAM.

   ~~NOT STARTED:~~ the session-size floor/ceiling at `sessionRowCounting.ts:253`
   and `MIN EXERCISES PER SESSION` in the prompt.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 14).

17. **WORKING — A GAME'S LOAD IS READ (`f923523a`).** `gameSRPE` = body RPE x
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 17).**

18. **THE RULE AND THE STORE ARE WORKING; THE INPUT IS BUILT (`2132f9b3`).**
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 18).**

20. **WORKING — THE SENTENCE NAMES ITS CAUSE AND ITS DAY.** Both branches built,
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 20).**

21. **SAM HAS RULED — A GYM SESSION IS THE SAME SIZE WHATEVER ELSE IS ON THAT
    DAY.** Item 14 asked whether a team night has its own smallest size and
    offered "no floor" or "a floor of N". **Sam, 2026-08-13, refused both, and
    then said the order was overcomplicating it:** *"just keep sessions for gym
    the same before footy training"*.

    **THAT IS THE WHOLE RULE. There is no team-night size case.** No exception
    to `SESSION_SIZE_FLOOR` in either direction.

    **AND THE REASON THE SMALL SESSIONS LOOKED CORRECT IS FALSE. Sam:** *"just
    because the strength is on the same day doesn't mean they are doing it at
    the club, they might do it in the morning or on the drive to footy"*.
    **DELETE THE CLAIM WHEREVER IT IS WRITTEN** — `sessionRowCounting.ts:294`
    says *"a day the athlete is already at the club"* and that is now a stated
    falsehood sitting in a comment beside the constant it justifies. **A session
    sharing a DATE with team training says nothing about where or when it is
    done.** Do not reason from same-day to same-place again.

    **SO 26 OF 32 TEAM NIGHTS UNDER 4 EXERCISES IS A DEFECT**, not a correct
    smallness.

    **THE ONLY REAL TEAM-NIGHT DIFFERENCE IS ORDER, AND IT IS A PREFERENCE:**
    prefer not to put lower body or sprint work before training — **but place it
    there when that is the only room in the week.** A lean, never a block. **The
    Bible already carries this exact line** (`testingBias.ts:52-53`, quoting
    `:378`). Wire it; do not author a rival.

    **AND SAM HAS NAMED THE SHAPE. 2026-08-13:** *"team training should be
    looked at more like conditioning - it's not part of the strength exercises -
    it's its own component of the day"*. **THE CHECK THIS ITEM ORDERED IS
    ANSWERED, AND HE IS RIGHT — MEASURED, three receipts:**
    - **A team-training row lives in `workout.exercises`, the same array as the
      lifts.** `teamTraining.ts:126` `splitTeamTrainingFromExercises` exists
      solely to pull them back out for display.
    - **`ROLES_EXEMPT_FROM_COUNTING` has ONE member: `'power'`**
      (`sessionRowCounting.ts:64`). There is no `team_training` role at all —
      `SessionRole` is power / main_lift / accessory / midline / prehab /
      conditioning (`sessionRoles.ts:28-34`). **So a team-training row COUNTS
      against the per-session exercise budget.** That is the defect, stated.
    - **IT IS IDENTIFIED BY NAME, WHICH THAT MODULE BANS IN ITS OWN HEADER.**
      `isTeamTrainingItem` (`teamTraining.ts:103-119`) matches on
      `workoutType`, a name set, and three regexes. `sessionRowCounting.ts:36-37`
      reads: *"FILTER BY ROLE BEFORE ANY NAME PROBE RUNS. A name probe over an
      unfiltered list is the bug."*

    **THE FIX IS THE ONE THAT MODULE WAS BUILT TO RECEIVE, AND ITS HEADER SAYS
    SO.** `sessionRowCounting.ts:57-61`: *"`conditioningBlock` and `speedBlock`
    have the same shape problem power did ... when they become rows they join
    this set rather than growing a second mechanism beside it."* **Team training
    is the third case of that exact shape. Give it an authored role and add that
    role to `ROLES_EXEMPT_FROM_COUNTING`. Do not write a name-based exemption
    beside the fence — that is the banned pattern, in the file that bans it.**
    **The header comment says adding a role here is a counting change and must
    come with a golden diff. Bring one.**

    ~~**THE COUNTS IN THE 120-SESSION MEASUREMENT ARE THEREFORE OVERSTATED.** A
    "4-exercise" team night is a 3-exercise lift; a "2" is a single exercise.
    **Re-run and re-report with team-training rows excluded before building
    anything — the real gap is bigger than the item says.**~~
    **RE-COUNTED 2026-08-13 — REFUTED ON
    THE LOCAL DETERMINISTIC PATH. THE GAP IS EXACTLY AS FIRST MEASURED, NOT
    BIGGER: 26 of 120, unchanged to the row.**
    - **ZERO team-training rows sit inside `workout.exercises`** across all 120
      generated sessions. Excluding them changed nothing because there was
      nothing to exclude. **Not a green-and-empty bind: the rows were dumped and
      read** — a "4-exercise" team night is *Goblet Squat, Trap Bar Deadlift,
      Pallof Press, Back Squat*, four real lifts, and a "3" is three real lifts.
      **So the small sessions are genuinely small; the defect is real and its
      size was already right.**
    - **THE ORDERED FIX WOULD BE INERT HERE, AND THIS IS THE FINDING THAT MATTERS
      FOR THE BUILD.** A role census over every generated row: **`power` 36,
      NO ROLE AT ALL 563.** The generator authors no role but power. Since
      `participatesInCounting` counts any row with no role, **adding a
      `team_training` role to `ROLES_EXEMPT_FROM_COUNTING` cannot fire until the
      generator actually authors that role on the row.** The exemption is the
      right shape; it needs a WRITER first, and the item does not name one.
    - **THE MECHANISM IS STILL REAL** — `splitTeamTrainingFromExercises` exists
      and item 21's three receipts are correct as CODE facts. They simply do not
      occur on this path.
    **LIMIT, STATED:** local deterministic generation only. **Whether the AI path
    inserts a team-training row into `exercises` is UNMEASURED**, and it is the
    one place the overstatement could still be true.

    **BUILT AND DIAGNOSED 2026-08-13 — THE FENCE IS IN, THE SMALL SESSIONS ARE
    NOT FIXED, AND THE ORDERED FIX IS NOT THE FIX.**
    **THE COUNTING FENCE IS BUILT (`e8521b79`).** `team_training` is a role and
    is exempt; two cells INVERTED not deleted; the compiler forced the §18
    crosswalk question and the answer is that a team night has **no §18 row
    spelling** — it is already credited at the SESSION level under 17.E, so a row
    spelling would count it twice. **THE GOLDEN DIFF THE HEADER DEMANDS IS
    EMPTY**, as the census predicted. It closes the fence for the AI path; **it
    did not fix the small sessions.**
    **THE SMALL SESSIONS, PROBED BRANCH BY BRANCH across 120 sessions:**
    - Team days hit exactly two branches — `upper [push+pull]` and
      `lower [squat+hinge]` — and **both return 3 rows.**
    - **NON-team days hit the SAME 3-row branches** (16 of them). **The gym piece
      is 3 rows everywhere; only the DAY TOTAL differs**, because conditioning
      rows land on non-team days and not on team nights.
    - **The table is internally inconsistent and that is the real defect:**
      `hinge+pull` returns 5, `full_body` 4, but `squat+hinge` and `push+pull`
      return 3 — same two-pattern shape, different sizes.
    **ATTEMPTED AND REVERTED, WITH NUMBERS.** Raising those two branches 3 -> 4
    took team nights from `2x3 3x23 4x6` to `3x4 4x22 5x6` — **under-floor 26 ->
    4, ceiling never breached. But MIXED MOVED** (`4x20 5x8 6x28` ->
    `4x8 5x16 6x32`), and this item's own acceptance is *"without the other two
    moving"*. Non-team days share those branches, so a branch edit cannot be
    targeted. **Reverted; the generator is clean.**
    **THE CORRECT SHAPE, NAMED FOR THE NEXT PASS:** the floor belongs at the DAY,
    after conditioning rows land — **`finaliseBuiltWorkout` in `defaultProgram.ts`
    is the seam** and it already receives the plan entry. A day-level floor is
    universal, so it is **NOT the team-night case Sam forbade**; it only bites
    where the day is short. **It must protect the authored small sessions** — the
    signed G-2 primer (its row count is load-bearing for `looksLikeNeuralPrimer`),
    recovery, speed and conditioning-only days. **That guard list is the whole
    risk, and the 17 QA scenarios must be run either side.**

    **STAND-DOWN D IS SPENT — AND THIS LINE BLOCKED THE TERMINAL ON 2026-08-13
    WHILE ALREADY STALE.** The terminal declared itself blocked (`fe6a58b6`)
    citing *"stand-down D, which Sam has not lifted"* — but the header of THIS
    file had already recorded Sam lifting it. Two places in one file disagreed
    and the agent believed the older one. **Sam:** *"Your reopen-bug fix landed 9
    hours ago and no generator file has moved since, so unless you know otherwise
    the generator is free."* **RE-VERIFIED at the top of 08-13 rather than taken
    on trust:** `generateProgram.ts` last moved at `f2152d2b` 08-12 17:05,
    `coachingEngine.ts` at `3f62ad62` 08-12 13:33, `weekRebuild.ts` at `06401d92`
    08-12 08:35, and **every one of them is CLEAN in the working tree.** The
    desktop agent is in `programControlAction.ts`, which is not on the generator
    path. **ITEM 21'S BUILD IS CLEAR. Stage by path as always.**

    **Sam, on testing:** *"run whatever little tests you have to"*. Behavioural
    cells, and the 120-session distribution is the instrument: team nights join
    strength and mixed days in the 4-6 band **without the other two moving.**
    Run the 17 QA scenarios either side and report both numbers.

    **HALF BUILT 2026-08-13 (`e8521b79`), AND THE SECOND HALF IS RESUMED HERE.**
    The role fix landed with an EMPTY golden diff, reported honestly: it guards
    a case the local path does not currently produce. **The size half was
    diagnosed, attempted, and REVERTED — correctly.**

    **THE DIAGNOSIS IS ACCEPTED AND IT SUPERSEDES THIS ITEM'S FIRST GUESS.** The
    gym session is 3 exercises on EVERY day; other days gain a conditioning
    piece and reach 4-6, a team night gains nothing and stays at 3. **So the
    fault is not the team night at all — two templates hand out 3 where their
    equivalents hand out 4-5.** That is a template-parity defect wearing a
    team-night costume, and it is why Sam's *"keep sessions for gym the same
    before footy training"* is already true in the code and still looks wrong on
    glass.

    **WHY THE REVERT WAS RIGHT, RECORDED SO IT IS NOT UNDONE:** fixing the two
    templates moved days that were not broken, which this item forbids. **The
    floor is being applied in the wrong place.** `SESSION_SIZE_FLOOR` (=4,
    `sessionRowCounting.ts:358`) is consumed at `exerciseScorer.ts:201` as
    `MIN_SESSION_SIZE` — **per template, before the day exists.** A day-level
    truth cannot be enforced by a template that cannot see the day.

    **BUILD: apply the floor AFTER the day is composed, not inside a template.**
    Templates keep their own sizes; the day-level pass tops a short day up to
    the floor.

    **THE EXEMPTION LIST IS THE RISK, AND IT IS THE ONE THING TO GET RIGHT.**
    Some sessions are MEANT to be small — Sam personally signed at least one
    where the exercise count is load-bearing. **Enumerate them from their signed
    source and cite each one in the code; do not infer the list from what is
    currently small,** which would freeze today's defect into the rule. **If a
    session's smallness cannot be traced to a signed ruling, it is not exempt —
    say so and list it rather than guessing.**

    **PROVE IT:** the 120-session distribution AND the 17 QA scenarios either
    side. Team nights join the 4-6 band; **strength days and mixed days must not
    move by a single row.** Report all four numbers.

22. **SAM SIGNED THE POPUP'S SHORT PHRASES, DROPPED ONE ROW, AND TURNED ANOTHER
    INTO A FEATURE. 2026-08-13.**

    **OWNED BY THE DESKTOP AGENT — all three parts. (a) is its own popup; (c)
    is the onboarding equipment screen and the away flow, both UI. TERMINAL:
    STAY ON ITEM 20, then item 21's re-count.**

    **(a) THE SIGNED PHRASES — his words, use them as the right-hand column:**
    - Cooked / tired → **Training volume adjusted**
    - Sick → **Training eased back**
    - Injury → **Exercises swapped out**
    - Injury (paused) → **Training paused**
    - Equipment missing → **Exercises substituted**
    - Day unavailable → **Sessions moved**
    - Deload week → **Planned lighter week**
    - Game moved → **Week rebuilt around the game**

    **(b) TIME CAP IS OUT.** **Sam:** *"i've taken out time caps for now - i
    figure if people are short on time they will just do less of the session"*.
    **No phrase, and do not render a time-cap row in the sheet.** The
    `time_limit` constraint kind still exists in the type
    (`domain.ts:153`) — **this is a display ruling, not a deletion order. Do not
    rip the kind out** until he says so; other facts still write it.

    **(c) TRAVEL IS NOT A PHRASE, IT IS A FLOW — AND TODAY IT DOES THE OPPOSITE
    OF WHAT HE WANTS.** **Sam:** *"Away this week (do you have access to regular
    equipment? if yes, follow same program, if no = reselect equipment i.e.
    commercial gym vs home/club gym, vs bodyweight and then give program based
    on that information) ... and then the plan should change until their return
    date"*.

    **MEASURED 2026-08-13, and the gap is behavioural, not cosmetic:**
    - Travel today reads *"Away / travel period active"* / *"Your program is
      avoiding the dates you are away."* (`temporarySourceFact.ts:968,975`).
      **It REMOVES training on those dates. Sam wants it RESHAPED.** Away is not
      a rest period; it is a different gym.
    - **Nothing in the travel path asks about equipment.** No reference to
      equipment exists in `equipmentAvailability.ts` for travel.
    - **The equipment modifier is THIS WEEK ONLY and has no return date.**
      `set_equipment_modifier`'s decision is `missing_this_week`
      (`programControlAction.ts:245-259`). Travel already carries
      `effectiveFrom` / `effectiveUntil`. **The two must meet: an equipment
      change that lasts a dated span, then lifts itself.**

    **BUILD, in his order:** away is set with a return date → **"Do you have
    your normal equipment?"** → **yes**: program unchanged, only the dates he is
    away are honoured → **no**: he picks what he DOES have, the program rebuilds
    on that kit for the span, and **on the return date the modifier drops off
    and the program goes back to normal by itself.**

    **IT IS THE ONBOARDING DOOR, MOVED INSIDE THE APP. Sam, 2026-08-13:**
    *"this is basically what happens in the onboarding process - now it can just
    be inside the app"*. **He is right, and it is already built and already
    signed — DO NOT DESIGN A NEW SHEET.**
    - `EquipmentScreen.tsx` is his audit ruling 3 (2026-07-31): *"Where do you
      train?" first; the choice PRE-TICKS the checklist as a visible starting
      point; the athlete unticks what their place doesn't have ... THE STORED
      ANSWER IS THE FINAL TICKED LIST.*
    - `EQUIPMENT_LOCATION_PRESETS` is **commercial gym / club gym / home gym**
      (`equipmentLocationPresets.ts:50-67`) — Sam's three, already there.
      Bodyweight-only is continuing with nothing ticked, which that screen's
      header already calls a real answer.
    - **This is why it does not breach ruling 5.** A location that SEEDS a
      checklist you then edit is ruling 3; a preset menu whose answer is FINAL
      is what ruling 5 retired. Same day, no conflict. **Reuse the door; do not
      rebuild the menu he killed.**

    **SO THE WORK IS: make that door reachable in-app from the away flow, and
    give its answer a START and an END.** The screen and the checklist exist;
    what does not is a dated equipment fact
    (`set_equipment_modifier` is `missing_this_week`, no return date) and the
    away flow's question in front of it.

    **MEASURED 2026-08-13 — THE FULL MAP, so the build starts on facts.**
    - **The door:** the `Away` chip is `home-away-this-week-entry`
      (`HomeScreenV2.tsx:843`), which opens `AwayDaysSheet` and lands on
      `handleApplyAwayDays(dates)`. That is where the equipment question goes.
    - **The copy to change:** `temporarySourceFact.ts` — title *"Away / travel
      period active"*, body *"Your program is avoiding the dates you are away."*
      **That sentence IS the defect**: it states removal, and Sam wants reshape.
    - **The screen to reuse, and why it is not reachable:** `EquipmentScreen` is
      registered ONLY in `OnboardingNavigator.tsx:86` as route `Equipment`
      inside the onboarding stack. **It is not on any in-app navigator**, which
      is precisely "make that door reachable in-app".
    - **The write with no end date:** `EquipmentLimitationSheet.tsx:148` writes
      `kind: 'missing_this_week'` (typed at
      `types/programControlAction.ts:253`). **Nothing in that shape can express
      a span**, which is the dated equipment fact the item asks for. Travel
      already carries `effectiveFrom`/`effectiveUntil`; the equipment answer
      does not.
    - **The effect field now names it:** travel currently ships
      `effect: 'sessions_moved'`, which is what it honestly does TODAY. When
      this item lands, away stops moving sessions and starts substituting
      exercises, and that effect moves with it.

    **SLICE 1 BUILT — THE DATED EQUIPMENT FACT (`bfad51b7`).** A
    `missing_for_span` decision carrying `from`/`until`, scoped to a WINDOW so
    it lifts itself on the return date. **`kind: 'window'` was already in
    `TemporarySourceFactScope`** — the equipment path hard-coded
    `{ kind: 'week' }` and never used it, so this was a scope argument rather
    than new machinery. Held by `test:dated-equipment-fact`. **The compiler did
    NOT catch the gap:** the executor's fall-through reads `tags` off either
    variant, so a span-carrying decision compiled and was silently week-scoped.

    **AND A NEW BLOCKER FOR THE DOOR, MEASURED 2026-08-13.**
    `EquipmentScreen.tsx:122` hard-navigates to `'GymExperience'`, an ONBOARDING
    route, and `:132`/`:189` call `navigation.goBack()`. **So it cannot simply
    be registered on an in-app navigator: its "continue" would aim at a screen
    the app stack does not contain.** Reusing the door — which is Sam's explicit
    instruction, and right — means its DESTINATION becomes an input (a
    completion callback or a route param) instead of a hard-coded onboarding
    step. That is the next act, and it is small, but it is a change to a signed
    onboarding screen rather than a pure addition.

    **SLICE 2 BUILT — THE DOOR OPENS BOTH WAYS (`0ee5caf1`, item 24).**
    `EquipmentScreen`'s exit is an optional `onDone` defaulting to the original
    `GymExperience` navigate. Onboarding passes nothing and is unmoved, proven
    either side.

    **THE HOOK POINT FOR SLICE 3, MEASURED so the next pass does not re-find it:**
    `HomeScreenV2.tsx:1223`, the `onAwayDays` handler. It already receives the
    away `dates` — **which ARE the span**: first date is `from`, the return is
    the day after the last. On `result.ok` it currently just closes the sheet.
    **That success branch is where "Do you have your normal equipment?" goes**,
    with `no` routing to `EquipmentScreen` (now reusable) and its `onDone`
    writing a `missing_for_span` decision over those same dates.

    **SLICE 3 ATTEMPTED AND REVERTED 2026-08-13 — AND THE REVERT IS THE
    FINDING.** The route and a wrapper compiled and were thrown away, because
    the write at the end of them was a NO-OP: **`EquipmentScreen` produces what
    the athlete HAS, and `set_equipment_modifier` wants what they are
    MISSING.** The wrapper had `tags: []`, which says "nothing is missing" — a
    dated fact that changes nothing, shipping green.
    **THE GAP THE ITEM DID NOT ANTICIPATE:** away needs the COMPLEMENT — the
    athlete's normal kit MINUS the kit where they are going — and nothing today
    computes it. The onboarding screen never had to: onboarding's answer IS the
    kit, with no prior list to subtract from.
    **THREE WAYS OUT, and it is Sam's call which:** (i) derive the complement
    from the stored answer before and after; (ii) give the equipment fact a
    `have` mode beside `without`, so the away answer is stored as-is; or
    (iii) have the away screen ask what is MISSING rather than what is present,
    which contradicts ruling 3's pre-ticked shape and is named here only to be
    ruled out on the record.
    **Nothing was left half-wired:** the attempt is fully reverted, the tree is
    clean and the gate passes.

    **STILL NOT STARTED:** the question itself, the routing, the rebuild, and
    the copy that still says the program is "avoiding the dates you are away".
    (a) and (b) are BUILT and on glass (`5ff77758`).

    **GENERATION IS INVOLVED (a rebuild on a new kit) — STAND-DOWN D APPLIES to
    the rebuild half.** The sheet, the question and the dated equipment fact are
    clear to build now.

24. **SAM SAYS YES — THE EQUIPMENT SCREEN'S EXIT BECOMES AN INPUT.**

    **OWNED BY THE DESKTOP AGENT.** Asked by it 2026-08-13 before touching a
    signed screen, which was the right call.

    **Sam's answer: YES, change it — onboarding must behave exactly as it does
    today.** This was already implied by his own ruling (*"this is basically what
    happens in the onboarding process - now it can just be inside the app"*,
    item 22(c)): a door that can only be entered from onboarding cannot be
    reused from the away flow. Reuse REQUIRES the exit to move.

    **MEASURED BEFORE ANSWERING — the change is one line, not a refactor.**
    `EquipmentScreen.tsx:122` holds a single hard navigate,
    `() => navigation.navigate('GymExperience')`. The screen is mounted in
    exactly ONE place, `OnboardingNavigator.tsx:86`. There is no second caller
    to regress.

    **THE SHAPE, so onboarding cannot drift:** the exit is a prop/param that
    **DEFAULTS to today's `GymExperience` navigate**. Onboarding passes nothing
    and is byte-identical in behaviour; the away flow passes its own return.
    **Do not invert this** — a required param would make onboarding's behaviour
    a caller's responsibility, which is how a signed screen quietly changes.

    **PROVE ONBOARDING DID NOT MOVE, do not assert it.** `test:equipment-answer`
    already reads this file (`equipmentAnswerTests.ts:347`); run the onboarding
    walk either side and report both numbers. **His audit ruling 3 is untouched
    by this** — "where do you train" first, pre-ticked checklist, the athlete
    edits it, the stored answer is the final ticked list. **Nothing about the
    QUESTION changes. Only where "continue" lands.**

25. **SAM ALREADY RULED SESSION SIZE. THE APP HOLDS HIS RULING AND OBEYS
    SOMETHING ELSE. THIS IS THE DISCONNECTION, NOT A MISSING RULE.**

    **OWNED BY THE TERMINAL.** It is the same defect item 21's second half is
    circling; **read this item FIRST — it changes what the fix is.**

    **Sam, 2026-08-13, and this is the whole item:** *"i've answered this type of
    shit so many times - all my programming logic should be in the app by now and
    it's not WHERE THE FUCK IS IT AND WHY IS IT NOT IN THE APP BY NOW"*.

    **HE IS RIGHT, AND THE SEAT BROKE THE BIBLE-FIRST LAW BY ASKING HIM AGAIN.**
    The seat put "how many exercises should a gym session have?" to him. **That
    question was already answered, IN THE BIBLE, BY HIM.** Grepping first would
    have dissolved it. Recorded so the next seat does not repeat it.

    **HIS AUTHORED RULING — `LFA_PROGRAMMING_BIBLE.md:3149`, §11, verbatim:**
    *"ONE exercise cap for every training age. The beginner-only cap of 3
    exercises per strength session was never authored; 'do not overload them with
    too many exercises' is guidance about dose and complexity, not a numeric
    limit, and a separate beginner cap is exactly the 'second beginner/experienced
    representation' this section forbids."*

    **HE STRUCK THE NUMBER 3 HIMSELF. It is still coming out of the app.**

    **WHERE HIS RULING LIVES — it is in there, and it is inert.**
    - `trainingAgePolicy.ts:43` — `maxExercisesPerStrengthSession: 6`, ONE value
      for every training age, exactly as he ruled. **AUTHORED.**
    - `trainingAgePolicy.ts:112` records the retired `3` and why: *"never
      authored"*.
    - `coachingEngine.ts:8682` passes it to the AI as `maxExercisesPerSession`.
    - **AND THAT IS THE END OF ITS REACH.** `sessionRowCounting.ts:315-318`
      states it plainly: *"It is not a validator and it is not enforced. Nothing
      trims a session that exceeds the ceiling and nothing pads one that falls
      under this floor."*

    **WHAT THE APP ACTUALLY OBEYS INSTEAD — one line, and no ruling behind it.**
    `sessionBuilder.ts:718`: `const exerciseCount = templateWorkout.exercises.length || 5;`
    **Session size is however many rows a human happened to type into a template
    file.** Two templates were written with three. That is the entire provenance
    of the number Sam has never seen a reason for. And
    `exerciseScorer.ts:317` — `Math.min(intent.exerciseCount, MIN_SESSION_SIZE)`
    — means the floor **cannot even top up past the template's own accident**:
    a 3-row template stays 3 no matter what the floor says.

    **SO THE FIX IS NOT "PICK A NUMBER" AND NOT "FIX TWO TEMPLATES."** Both are
    edge-case patches and Sam's standing project instruction forbids them:
    *"Don't fix edge cases, build a systemic fix into the system so issues are
    fixed globally"*.

    **BUILD: SESSION SIZE IS DERIVED FROM THE AUTHORED POLICY, NOT FROM A
    TEMPLATE'S ROW COUNT.** A template supplies WHICH exercises and in what
    order. **It must not supply HOW MANY.** The count comes from
    `trainingAgePolicy`, the same object that already holds his ceiling, and the
    scorer fills to it. **Delete the `|| 5` fallback and the
    `Math.min(..., MIN_SESSION_SIZE)` clamp — both are the accident, not the
    rule.**

    **THE FLOOR STILL NEEDS AUTHORING AND SAM MUST NOT BE ASKED COLD.** The
    ceiling is his (6). The floor is not. **Do not park a bare number question on
    him.** Derive a candidate from what his own signed weeks already do, bring
    him the distribution and ONE recommendation with its reasoning, and let him
    veto in a word. That is the only shape this question may reach him in.

    **THE CLASS, NOT THE INSTANCE — THIS IS THE ITEM THAT MATTERS.** An authored
    ruling of Sam's sitting in a policy object, computed, passed along, and read
    by no enforcer is exactly the architecture finding in
    `docs/HOW_TO_BUILD_THIS_APP_2026-08-12.md`: **the app is built RIGHT and
    DISCONNECTED.** Session size is one instance. **Report how many OTHER
    authored values in `trainingAgePolicy` and the Bible-derived rule objects
    have no enforcer** — that census is the next unit, and it is the answer to
    the question he actually asked.

    **AND THE RECEIPT ALREADY EXISTED, MEASURED 2026-08-12, AND NOBODY BUILT
    IT.** `ATLAS_VERIFICATION_2026-08-12.md:180` finding 7, verbatim verdict:
    **"3-exercise days are old logic surviving — CONFIRMED, AND WORSE."** It
    names the producer: **eleven 3-row branches** in `defaultProgram.ts:1069`
    `fallbackExercisesForPlanEntry`, reachable by three live paths, and
    **`generateProgramLocally` synthesises EVERY day from them**
    (`generateProgram.ts:866-872`, whose own comment reads *"3-ish core
    exercises per session"*). **They are not an error path. They are the normal
    output of non-AI generation.** And: *"there is no floor AND no ceiling —
    `maxExercisesPerStrengthSession` is read by no prompt builder, validator or
    trim"*; the AI prompt emits a MAX with no MIN.
    **`HOW_TO_BUILD_THIS_APP_2026-08-12.md:174` gives that value a reader count
    of ZERO.** So this was diagnosed a day before Sam's anger, written down
    twice, and left. **The measurement is DONE. Do not re-measure it. Build.**

    **THE STRING TO KILL IS `"3-ish core exercises per session"`.** That comment
    and the eleven branches beneath it are the entire provenance of the number
    Sam says he never authored — because he didn't. He ABOLISHED it on
    2026-07-27 (`LFA_PROGRAMMING_BIBLE.md:4969`) and it is still shipping.

    **PROVE IT:** 120-session distribution and the 17 QA scenarios either side,
    all four numbers.

    ---
    **DERIVED 2026-08-13 — AND HIS OWN SIGNED WEEKS ANSWER IT. THE FLOOR OF 4 WAS
    NEVER HIS AND NEITHER IS A FLOOR.**
    Item 25 says derive from what his signed weeks do, bring ONE recommendation,
    let him veto in a word. **Three signed sources, all his:**
    - **GUNSHOW (§20.3, signed 2026-07-30): 2 biceps + 2 triceps + 2 pump delts =
      SIX.**
    - **MOBILITY (Bible `:4910`, signed): *"a composed session aims for 6
      movements inside the 5-8 window"* — SIX, with a stated window.**
    - **THE CEILING (§11, `:3149`): SIX.**
    **All three land on the same number, and it is the number already in the
    policy object.**
    **AND HE ALREADY RULED THE MECHANISM, AGAINST PADDING.** §20.3, his words:
    *"Under restricted equipment a gunshow gets smaller, never padded. There are
    no cross-family top-ups: the app never invents to fill a quota."*
    **⚠ SAM VETOED THE 6 AND HE WAS RIGHT — MY RECOMMENDATION BELOW IS WRONG AND
    IS STRUCK. 2026-08-13:** *"no 6 is not a ceiling i dont know where the fuck
    you're getting that from, there's to many variables to give 6 as a ceiling,
    you should be able to figure out what is needed that day from the bible and
    all the programming logic i have put in there"*.
    **AND THE MEASUREMENT AGREES WITH HIM. I CALLED THE 6 "AUTHORED" AND IT IS
    NOT.** Grepped after his veto: **the number 6 appears NOWHERE in the Bible as
    a cap.** §11 `:3149` abolishes the beginner 3 and says there is "ONE
    per-session exercise cap for every training age" — **it never states the
    number.** `trainingAgePolicy.ts:43`'s `6` was chosen in code, exactly like the
    `3` before it. **So BOTH numbers are invented, and item 25's premise is
    stronger than it was written: the app does not hold his ruling and disobey
    it — it holds an INVENTED ceiling and calls it his.**
    **AND HIS SIZES ARE IN THE BIBLE AFTER ALL — `:122`, HIS OWN WORDS:**
    *"I wouldn't stack lower body strength (say **6-7 exercises**) with upper body
    strength (**6-7 exercises**) because that would be 12-14 lifts in one day. I'd
    prefer to just make that a full body day i.e. **full body strength and 7
    exercises**."*
    **SO HE DID AUTHOR SESSION SIZES, PER SESSION TYPE: lower 6-7, upper 6-7,
    full body 7** — and they are HIGHER than the invented ceiling of 6 the code
    has been enforcing as "his". **A 6-exercise cap was clipping his own 7.**
    This is exactly what he meant by *"figure out what is needed that day from the
    bible"*, and it is the input the derivation starts from. **Still not a single
    constant: `:108` and `:122` both make size follow the session TYPE and the
    day's shape.**

    **WHAT HE ACTUALLY RULED: session size is DERIVED PER DAY** from the Bible's
    own logic — phase sets/reps (`:767-769`), the seven strength sessions
    (§20.5), game proximity (`:204`), accessory dose (`:818`), equipment and
    injury. **Not a constant, and not a template's row count. The next unit is
    that derivation. Do not bring him another number.**

    ~~**RECOMMENDATION (one, his to veto): session size is a TARGET OF 6, not a
    floor that pads.** Templates stop dictating HOW MANY; the app aims for 6 and
    **shrinks honestly** when equipment, injury or game proximity restrict it —
    never inventing filler to hit a number. **The 4 is deleted, not re-authored:
    it was `MIN_SESSION_SIZE`, invented in one file, and it contradicts his
    shrink-never-pad rule.**~~
    **DISTRIBUTION TODAY, for the same message:** Strength 5-6, Mixed 4-6, Team
    Training 2-4; **zero sessions over 6**; 26 of 120 under 4.

    **THE CENSUS ITEM 25 ORDERS — `trainingAgePolicy`, 13 authored fields:**
    - **`initialLoadMultiplier` — AUTHORED BY SAM (50%, Bible `:3142`, `:4968`
      correcting the code's invented 0.75) AND HAS ZERO PRODUCTION READERS.**
      **A new athlete is not getting his 50% starting load.** This is a SECOND
      live instance of the exact defect he is angry about, found while measuring
      the first.
    - `maxExercisesPerStrengthSession` — **one "reader", and it only FORWARDS the
      value to the AI prompt.** No enforcer, which is this item.
    - `maxHardExposures`, `maxOptionalSessions` — zero readers, but **correctly**:
      Sam ABOLISHED both (§11). **They are dead fields to delete, not unenforced
      rulings.** Distinguishing the two is the point of the census.
    - The remaining 9 have readers.
    **SO: 13 fields, 3 unread, of which ONE is a live unenforced ruling, TWO are
    abolished leftovers, and the headline field is forwarded but never enforced.**

    **ITEM 26 CONSTRAINS THIS AND MUST BE ANSWERED IN THE SAME BUILD.** His rule 5
    says paired mobility *"counts toward nothing"*. **So the target of 6 counts
    STRENGTH rows only** — a 6-exercise session with 3 mobility pairs is 9 rows on
    glass and still six. Stated here so the two items cannot disagree.

26. **THE ⚠ HALF IS BUILT — HIS 2-3 PAIRS SURVIVE THE VALIDATOR NOW.**
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 26).**

27. **A1 AND B1 ARE FIXED (`0cb3f771`, `c3f3410e`). C1 IS SCOPED AND STOPPED —
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 27).**

28. **THE AWAY FLOW IS BUILT — AND AWAY STOPPED DELETING THE ATHLETE'S WEEK.**
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 28).**

## SAFE FOR A PARALLEL AGENT — context, not orders

**This heading is the stop hook's region terminator** (`repoLawGuardsTests.ts:252`
`INBOX_ORDERS_END`). **Everything below it is invisible to the hook, which is
correct — nothing below is an order. Do not put an order here, and do not rename
this heading.**

**SAM OWNS THE UI AND IS WORKING ON IT NOW.** *"i like how the app is looking
now - but i have a few more UI tweaks to make and then it's all about getting it
functioning like a proper app with my logic fully in the app"*. **"Fully in the
app" means CONSUMED, not present** — that phrase is the whole queue above.
**LANDED by Codex 2026-08-12:** the day/week toggle staying put across weeks, and
the 7-day chip grid (4+3). **Still his:** edit icons on injury tap-throughs; icon
colours in the flat button; icon sizes; recovery icon → full battery; weekly-view
buttons (*Away this week* + equipment yes/no → bodyweight; *Practice match*
removed from the day screen in pre-season; *Bye* as a weekly-only in-season
button); an add/move/swap/remove entry point on the weekly view. **Plus "add a
game", which is BLOCKED on item 5.**
**Do not start these and do not "help".** Merging them is item 1a.

**BUTTON REMOVAL, ALWAYS:** ~49 tap sites sit in files that read as live
(`HomeScreenClassic` is inside the file the navigator mounts, behind a
compile-time const). **Prove a control is REACHABLE before removing it, and
report the ones you could not reach** — those are the finding.
`LAW-L5-no-dead-affordances` is UNENFORCED, so nothing catches a mistake here.

**THE MERGE LEFTOVERS CENSUS** (`docs/WHAT_THE_MERGE_LEFT_BEHIND_2026-08-12.md`)
found: **ZERO controls an athlete can tap that do nothing**; five half-finished
moves (items 8, 12, 15 above cover them); seven of eight surfaces with no current
picture (item 12). **The journal was NOT touched** — one commit, one line, a
shared data-shape change its readers correctly followed. Sam was right and the
seat was wrong.

## AWAITING SAM — parked behind his phone rebuild, never a request

- **ANSWERED 2026-08-13, NOW PART OF ITEM 28 — away and the club.** Sam:
  ***"yes clear team training and games while away"***. **Do not re-ask.** Built
  the same day; see item 28 for what is WORKING and what is only BUILT.
- **ANSWERED 2026-08-13, NOW ITEM 21 — the team-night size question is
  CLOSED and its premise refused.** Sam: a team night's strength session is
  **a normal strength session**; the only difference is ORDER (prefer not to
  put lower body or sprint work before training, but allow it when that is
  the only room). **No team-night floor, in either direction. Do not
  re-ask.**
- The Wednesday game-day check (`06401d92`), the Renee UI pass, and the craft
  tier's hydration relocation are all **BUILT, awaiting device acceptance**.
  When he rebuilds, the white screen after a refused dev launch is expected and
  now names its own cause (`docs/WHITE_SCREEN_BOUNDARY_2026-08-10.md`).
- **NOT A DECISION, A BLOCKER, RECORDED SO IT IS NOT RE-ATTEMPTED:** item 9's
  four-answer collapse and item 3's remaining step both need files another agent
  is editing in this shared checkout (`section18CraftTier.ts`,
  `projectVisibleWeek.ts`, the generator under stand-down D). **Neither is
  skipped for want of a ruling; both are waiting for a clear file.**
- **ANSWERED 2026-08-12, NOW ITEM 16 — the day/week modifier indicator.**
  Sam: *"yes — one line on week, small card on day, read-only both"*. Moved
  out of this section into the queue. **Do not re-ask.**
- **ANSWERED 2026-08-13 — BUILT. Sam: *"add the popup"*.** `ModifiersSheet` now
  stands between the notice and My Status on both Program shapes, with his
  prototype's five strings signed verbatim. **Do not re-ask.** One follow-up
  question it raised is the entry directly below.
- **ANSWERED 2026-08-13, NOW ITEM 23 — the short phrase per modifier kind is
  SIGNED and the column question is closed with it.** Sam: *"i'd rather them
  shortened"*, then ***"signed"*** on the four phrases in item 23. **It was FOUR,
  not the three every doc said** — excluded and pinned are opposites sharing one
  builder. The rows become two columns for every kind that HAS a phrase; soreness
  and the generated programme-effect notes keep their own sentence on purpose and
  stay one column. **Do not re-ask.**
   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 22).

## Previously (now processed)

`docs/SEAT_INBOX_COMPLETED_2026-08-13.md` — items 0, 0a-0f, 4, 5, 8, 10, 11, 12,
15, 16, 19 and 23, moved out of the queue 2026-08-13 **verbatim, byte-identical,
nothing reworded**. Each was a BUILT stub with no open sub-order.

`docs/SEAT_INBOX_ARCHIVE_TO_2026-08-10.md` — most recently the craft validator,
cleared 2026-08-12. **This file holds LIVE ORDERS ONLY.** It was 353KB once and
every stop paid to re-read it.

## HOUSEKEEPING (not an order — the hook stops scanning before here)

**WHEN YOU ARE STUCK ON AN ITEM, MARK IT AND WORK THE NEXT ONE.** Sam,
2026-08-13: *"batch — and when you're stuck on an item, move to the next item
instead of stopping. Only stop when the whole list is blocked."* Put
**`BLOCKED-BY: sam`**, **`BLOCKED-BY: other-agent`** or **`BLOCKED-BY: external`**
**on the item's HEAD line** — column 0 is all the hook reads, so a marker in the
body silences nothing — and write the question underneath. The hook then walks
past it to the next order. **When every remaining item is marked, and only then,
the turn ends and his questions reach him in one batch.** Those three words are
the whole list; an invented category marks nothing. **A commit subject is no
longer an exit — `docs(blocked):` does not end a turn.**

**EVERY ORDER LIVES UNDER `## Unprocessed`. Sub-headings inside it MUST be
`###`.** `scripts/seat-inbox-hook.sh` bounds its scan at the next `## `, so an
order under its own `## ` heading is INVISIBLE to the stop hook and Sam becomes
the courier. The seat did this twice on 2026-08-12. **A guard cell now exists
(`1fcf5c04`) — but keep orders in ONE numbered sequence anyway: three schemes
(000/00/0a/0 plus a second 1-4 inside a context section) is why the terminal
picked the wrong item three times.**
