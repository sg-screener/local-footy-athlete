# NOW — overwrite at every checkpoint (pointer, not history)

- **BRANCH:** `main` · **HEAD:** `b6509f02` — **THE JOURNAL UI SLICE IS DONE; THE
  INBOX IS CLEAR.**
- **READ FIRST: docs/JOURNAL_UI_SLICE_BOUNDARY_2026-08-09.md** (plan measured
  first: docs/JOURNAL_UI_SLICE_PLAN_2026-08-09.md). Sam's exception-based front
  page is built in his order — hero / stat strip / week bars / earned cards /
  lifts / month drawer / note.
  - **GATE:** full `test:bible` UNPIPED `GATE_EXIT=1` at
    `program-control-durable`, 1 FAIL line — the declared red. **Sweep 2 of 167 =
    the declared set exactly.** `test:compile` PASSED. New gated suite
    `test:journal-ui` **58 passed, 0 failed**. **22 mutations, 21 red** (the one
    survivor was a BAD MUTATION of mine, re-aimed and red).
  - **THE SIGNING SESSION IS NOW THE BOTTLENECK, not any build.** The load band,
    the load stat tile and both earned cards are downstream of PROPOSED
    constants, so they are DARK. **8 proposed of 10. One sitting turns half the
    front page on with no code change.**
  - **TWO OF THOSE THRESHOLDS HAD NEVER BEEN READ BY ANY CODE** —
    `patternDriftThreshold` carried its provenance since the load slice while
    nothing compared anything to 0.25. Signing it would have changed nothing.
    It has a reader now.
  - **THE FINDING TO CARRY: building behind a signature hides your own
    duplicates.** The region observation shipped with TWO renderers, both dark,
    every cell passing — **it would have appeared for the first time on the day
    Sam signed, in a commit that touched no code** (`b6509f02`). The cell asserts
    the COUNT now: exactly one renderer per dark fact.
  - **THE STYLE LAW IS A GATE** — no raw hex, no rgb(), no bare padding/margin/
    gap on this screen; tokens read; shared `Card` mounted. Caught two on its
    first run. **Scope: ONE FILE**, stated out loud.
  - **`a count taken for a record` — SIGHTING 7**, inside a brand-new gate on its
    first run: the "letters are dead" sweep red on **Monday's `'M'`**.
  - **THE BINDER GREW A `WITHDRAWN:` FORM** — the sheet could record a string
    that CHANGED, never one that STOPPED, and batch 26 retires nine.
  - **ZERO NEW STORED STATE. North star: TOWARD.** Copy batch 26 PROPOSED;
    ceiling **580 → 572, DROPPED**, attributed.
  - **NOT COVERED, first line: NO DEVICE EVIDENCE. DEPTH 0.** An appearance
    slice's defects are VISUAL and no cell mounts the screen. **Sam's eye is the
    only instrument and it has not run.** Week navigation NOT built.
  - **PARKED FOR SAM (5):** the signing session; **whether the lifts empty state
    should come back** (the one retirement that costs information); the two
    threshold values; batch 26's words; **whether the week bars keep the app's
    red/orange/green** or take the mock's calmer ramp.
- **BEFORE IT: THE JOURNAL UNIT ITSELF IS COMPLETE** —
  docs/JOURNAL_UNIT_BOUNDARY_2026-08-09.md, 22 of 22 items, ten slices, audit at
  docs/JOURNAL_COMPLETION_AUDIT_2026-08-09.md.

- **BRANCH:** `main` · **HEAD:** `b75cc63f` — **SIX SLICES IN, CONTINUOUSLY.**
- **LAST UNIT: NIGGLE HISTORY + NOTE RESURFACING** (`b75cc63f`), addendum Group 2
  item 9. docs/JOURNAL_NIGGLE_SLICE_BOUNDARY_2026-08-09.md · plan
  docs/JOURNAL_NIGGLE_SLICE_PLAN_2026-08-09.md
  - **Niggle history by region, plus what the athlete wrote the last time that
    region flared.** Zero new stored state — both inputs already exist as INPUTS.
  - **RESURFACING IS BY TIME, because a note CANNOT be knee-tagged** — the tag
    vocabulary is the closed eight with no region. Route (b), a region on a note,
    reopens a vocabulary Sam closed and is **HIS call, not assumed**.
  - **TWO WRONG ASSUMPTIONS OF MINE, EACH CAUGHT BY AN EXISTING LAW.**
    (1) `journalNoteOwnershipTests` refused the module: **no `rules/` module reads
    the note store** — and "the type import is erased" would have traded a
    non-negotiable for a convenience. The note now arrives as a NARROW STRUCTURAL
    VIEW. (2) The COMPILER refused `episode.region` as a key: it is
    `upper_body|lower_body|back_midline|other`, a coarse constraint bucket — it
    would have filed knee and hamstring together AND put an internal word on the
    athlete's screen. Keyed on `bodyPart` through `resolveInjuryRegion` now.
  - **7 MUTATIONS, 6 REDS, 1 GENUINE SURVIVOR** (the region tie-break; no fixture
    had tied). **The harness now PROVES each mutation applied before reading its
    result** — the strength line's lesson, built in.
  - **GATE:** `GATE_EXIT=1` at `program-control-durable`, 1 FAIL line — the
    declared red. **Sweep 2 of 164 = the declared set exactly**, head `b75cc63f`.
    `test:compile` PASSED. `test:journal-niggle-history` **30 passed, 0 failed**.
    Copy batch 21 PROPOSED; ceiling **570 → 572**.
- **NEXT MEASURED — THE LAST SLICE IN THE ORDER: THE MONTHLY REVIEW**
  (docs/JOURNAL_MONTHLY_REVIEW_PLAN_2026-08-09.md). **NO CHART WALL:**
  `react-native-svg` is a dependency AND genuinely wired (AppNavigator,
  PlanChangeSheet, GuidedInjuryFlowSheet all render it today), so drawing works on
  the build Sam already runs. `victory-native` and Skia are dependencies but
  **imported nowhere** — unproven on device, so recommended AGAINST by default.
  **Almost every series already exists** (`JournalLoadModel.history`,
  `patternSharesDone`, `JournalWork`); the one new derivation is a MULTI-WEEK
  strength series beside the existing week-over-week arrow.
- **PREVIOUS: THIS WEEK'S JOB** (`67f80e0b`), Monday card item 4.
- **LAST UNIT: THIS WEEK'S JOB** (`67f80e0b`), Monday card / addendum Group 1
  item 4. "This week asks for 3 strength, 2 conditioning." — read off the
  contract the Section 18 resolver already authored onto the microcycle.
  - **A GATE CAUGHT ME PUTTING A STALE NUMBER ON THE ATHLETE'S SCREEN.** The
    first version rendered a completion verdict from `achievedCount` /
    `unresolvedMinimumShortfall` on the **stored** contract;
    `section18ShortfallCopyTests` refused it — *"no caller reads an achieved tally
    off a stored contract"*. **A TARGET is policy; an ACHIEVED TALLY is derived
    output and a stored one goes stale.** The verdict is gone, the module reads
    targets only, and the two withdrawn sentences were **REMOVED from batch 20**
    rather than left proposed.
  - **Week STATUS (item 3) is therefore NOT built** — it needs a freshly-derived
    ledger (`ledgerFromEffectiveWorkouts` + `evaluateWeeklyExposureContract`) and
    belongs to the owners that gate names. Its wording comes to Sam as its own
    batch when built. **"Did the work happen" already answers completion** from
    recorded outcomes, so the athlete is not left without one.
  - `ATHLETE_WORD_FOR_DOMAIN` is **EXPORTED from its owner, not copied**;
    `ATHLETE_FORBIDDEN_VOCABULARY` asserted on this surface too.
  - **GATE:** full `test:bible` UNPIPED `GATE_EXIT=1` at
    `test:program-control-durable`, 1 FAIL line — the declared red. **Sweep 2 of
    163 = the declared set exactly**, at head `67f80e0b`. `test:compile` PASSED.
    New gated suite `test:journal-week-job` **24 passed, 0 failed**. Copy batch 20
    PROPOSED; ceiling **568 → 570**, attributed.
  - Boundary: docs/JOURNAL_WEEK_JOB_BOUNDARY_2026-08-09.md
- **NEXT MEASURED: NIGGLE HISTORY + RESURFACING** —
  docs/JOURNAL_NIGGLE_SLICE_PLAN_2026-08-09.md. Niggle history is FREE over
  `InjuryEpisodeV1`. **BUT: a note CANNOT be knee-tagged** — `JOURNAL_NOTE_TAGS`
  is a closed eight with no region. Resurfacing by tag-region is not buildable;
  **route (a) resurfaces BY TIME** (notes written during an earlier episode's
  `affectedWeeks`, injury-tagged) and needs nothing new. Route (b), a region on a
  note, reopens a vocabulary Sam closed — **his call**.
- **CHECKPOINT + HANDOVER:** docs/JOURNAL_UNIT_HANDOVER_2026-08-09.md — **read it
  first if you are a fresh session.** (Written at three slices; four are in now.)
- **PREVIOUS: THE STRENGTH LINE** (`64d142d7`), Monday card item 2.
  docs/JOURNAL_STRENGTH_LINE_BOUNDARY_2026-08-09.md · plan
  docs/JOURNAL_MONDAY_CARD_PLAN_2026-08-09.md
  - **"Back Squat — 120kg, up on last week."** Pure derivation over
    `SessionFeedback.strength[]`, which the app has recorded for months "for
    future progression/diary use". **Zero new stored state.**
  - **IT SHIPS A NUMBER WHERE THE LOAD HEADLINE CANNOT, structurally:** this
    module has NO constants to wait on. `flat` is exact equality — a fact, not a
    tolerance. **A tolerance would BE a constant and joins the signing table.**
  - **THREE ABSENCES ARE FIRST-CLASS:** a SKIPPED lift is excluded (its stored kg
    is what was PRESCRIBED and not lifted); a lift with no previous CALENDAR week
    is `new`, never `flat`; reps are null when unlogged, never the prescription.
  - **"ANCHOR LIFT" HAS NO OWNER IN THIS APP** — `isAnchor` elsewhere means a
    game/team-training anchor DAY. Read as "the main lifts the app already
    records"; a narrower authored set is **Sam's ruling, not a guess**.
  - **6 MUTATIONS, 6 REDS — AND ONE FALSE GREEN THAT IS THE LESSON.** A `perl`
    substitution silently matched nothing, so the mutation never applied and
    reported as a SURVIVOR. **A mutation that fails to apply is indistinguishable
    from one that survives, and it points you at your test instead of your
    tooling. Assert the replacement is PRESENT in the file before reading the
    result.** Third address of `a fixture is a claim too`.
  - **GATE:** full `test:bible` UNPIPED `GATE_EXIT=1` at
    `test:program-control-durable`, 1 FAIL line — the declared red. **Sweep 2 of
    162 = the declared set exactly**, at head `64d142d7`. `test:compile` PASSED.
    New gated suite `test:journal-strength-trend` **23 passed, 0 failed**.
  - **Copy batch 19 PROPOSED**; ceiling **566 → 568**, attributed to the two
    sentences the extractor can see.
- **NEXT, MEASURED WITH RECEIPTS** (plan doc §3b): week status + this week's job
  both derive from the week's CONTRACT (`weeklyExposureContractBuilders.ts`,
  evaluated by `evaluateWeeklyExposureContract`); phase has one owner
  (`ownSeasonPhase`). **THE TRAP TO REFUSE: `useResolvedWeek` exposes neither the
  contract nor the phase, so the next builder must find where the generation path
  already resolves the contract and READ it — building a second one is a second
  answer to "what does this week ask of the athlete".**
- **PREVIOUS: THE FEEL SLICE** (`41d847d7`, `528e5c67`).
  docs/JOURNAL_FEEL_SLICE_BOUNDARY_2026-08-09.md · plan
  docs/JOURNAL_FEEL_SLICE_PLAN_2026-08-09.md
  - **The athlete can rate their legs after a game, and say whether any session
    matched the plan.** Two new INPUTS on the door that already existed
    (`startFinished: true` → the session-outcome transaction). Zero derived state,
    no new store, no new transaction. North star: **TOWARD.**
  - **EFFORT-ON-STRENGTH IS DELIVERED, AS THE TAP** — Sam's "one tap, no per-set
    anything". No second numeric field was minted; the tap rides every performed
    session, the only place a strength effort can be recorded today.
  - **ASK-FLAG IS SEND-FLAG.** Rating asked only on a game, stored only on a game;
    tapping back to "as expected" clears the why in BOTH form and payload; a
    half-answered pair is refused at the DRAFT.
  - **NO FIFTH SPELLING OF "IS THIS A GAME"** — it has four and no owner; the panel
    asks `classifyDaySessions`. The other four are named census debt.
  - **THE COPY GATES COULD NOT SEE A WORD OF IT — THIRD SIGHTING.** Both scope to
    screens/components/navigation; these words are authored in
    `utils/sessionFeedbackForm.ts`. Closed for that module via the existing
    `AUTHORING_MODULES` hatch (bound 84 → 99). **SIZED, NOT FOLDED IN: ~150 label
    strings across 20+ utils/rules modules are invisible to both gates**, including
    the feedback form's pre-existing vocabulary, none ever on the sheet. Own unit.
  - **A RED SUITE FOUND, REPORTED, NOT ABSORBED:** `test:session-feedback-form` is
    ungated with **4 pre-existing failures** — they assert a power component
    `getSessionComponents` no longer emits. Whether power should be separately
    completable is Sam's call. My change is failure-neutral: 4 before, 4 after.
  - **8 MUTATIONS, 8 REDS — TWO SURVIVED FIRST**, and both were one gap: the
    payload cells handed the builder `null` themselves, so nothing checked the
    PANEL computes it. **A builder tested with hand-written nulls proves the
    builder and nothing about its caller.**
  - **GATE:** full `test:bible` UNPIPED `GATE_EXIT=1` at
    `test:program-control-durable`, 1 FAIL line — the declared red. `test:compile`
    PASSED. New gated suite `test:journal-feel` **54 passed, 0 failed**.
    **Sweep 2 of 161 = the declared set exactly**, at head `528e5c67`.
  - **Copy batch 18 PROPOSED.** The five body-feel words (Empty/Heavy/Okay/Good/
    Flying) are entirely mine and most want Sam's eye.
  - **A PROCESS SLIP, OWNED:** I used `git stash` once — forbidden in this shared
    worktree by AGENTS.md. Caught immediately, popped, every file verified restored
    and compiling; the scratchpad-copy method used thereafter.
- **NEXT: THE MONDAY CARD** — measured, docs/JOURNAL_MONDAY_CARD_PLAN_2026-08-09.md.
  **Most of the card is already built** by slices 1/2/load/feel; what remains is
  the strength line (new pure code), week status, this week's job, and what
  changed/was protected.
  - **THE WALL, MEASURED: there is NO notification infrastructure at all.**
    `expo-notifications` is not a dependency. A local notification needs a new
    NATIVE dependency + a permission prompt the athlete can refuse + a scheduling
    policy — a Sam decision, PARKED not guessed. **The card builds in full without
    it**, so the split is clean and this is not a stop.
- **PREVIOUS: THE LOAD SLICE** (`d0651fc3`, `285c5a20`, `61b7d74f`, `d44476c9`,
  `12da456f`).
  docs/JOURNAL_LOAD_SLICE_BOUNDARY_2026-08-09.md · plan
  docs/JOURNAL_LOAD_SLICE_PLAN_2026-08-09.md
  - **ZERO NEW STORED STATE** — every number derives on read from
    `SessionFeedback`. North star: **TOWARD**, by the widest margin in this unit.
  - **PROVENANCE TRAVELS WITH THE NUMBER.** One constants table, each entry
    carrying `signed`/`proposed`; every derived value carries the COMBINED
    provenance of what fed it; `signedValue()` is the only door a surface may
    read through. **Sam's signature alone turns the lines on — no code change.**
    Mutation-proven both ways.
  - **ATHLETE-VISIBLE:** the Load section leads with its own evidence ("Load is
    measured from the sessions you log — 3 of 5 this week have detail recorded"),
    which needs no signature because no constant feeds a count. Headline
    continuum, band and region lines are **built, tested and DARK**.
  - **THE FALLBACK RUNG CANNOT ENTER RATIO SPACE** — past weeks have no derivable
    day shape, and re-deriving hardness from stored component kinds is REFUSED (a
    second hardness authority). **Sam's one open question.**
  - **THREE DEFECTS I CAUGHT IN MY OWN MODULE AFTER IT HAD ALREADY PASSED A FULL
    GATE.** **(1)** The four-week normal was the four most recently LOGGED weeks, not
    the four CALENDAR weeks — weeks -1/-2/-3/-20 is not a four-week normal
    (`61b7d74f`). **Every fixture logged contiguously, which is exactly when the
    two readings agree.** **(2)** The model held Sam's 2/1/0 rung as a SECOND OWNER
    of `JournalWeek.load.thisWeek`, over a different input set, and summed ZERO
    for a week with nothing recorded (`d44476c9`). **The rung is now absent from
    the module entirely** — "it never enters ratio space" became inexpressible
    rather than tested. **(3)** The coverage line could read **"6 of 5"** — planned counts DAYS the week
    asks work of, measured counts DATES logged, so measured can exceed planned.
    Denominator DROPPED, never clamped (`12da456f`).
  - **THE PATTERN IN ALL THREE:** each was a wrong ASSUMPTION, not a wrong line —
    invisible to a suite written by whoever made it. What found them was reading
    the finished module back asking "what does this quietly assume?", AFTER the
    gate was green. **No mutation could have surfaced any of the three.**
  - **24 MUTATIONS, 24 REDS — TWO SURVIVED THEIR FIRST RUN:** the window did not
    exist (no fixture ever exceeded it), and "an unlisted string ships" reds on
    the BINDER not the extraction ceiling (a count cannot see a swap).
  - **GATE:** full `test:bible` UNPIPED `GATE_EXIT=1` at
    `test:program-control-durable`, 1 FAIL line — main's declared red, same
    assertion text. `test:compile` PASSED, no file regressed. New suite
    `test:journal-load` **91 passed, 0 failed**, registered in `test:bible`.
    **Sweep 2 of 160 = the declared set exactly**, at head `12da456f`.
  - **Copy batch 17 PROPOSED**; two batch-15 lines superseded before Sam ruled on
    them. Extraction ceiling **565 → 566, attributed four-in / two-out**.
  - **NOT COVERED:** NO DEVICE EVIDENCE, no cell mounts the screen; DEPTH 0;
    the effort tap on strength NOT built (its constant defaults OFF); charts are
    layer 5, deferred; **the extractor cannot see keyed copy objects or template
    literals** — named as owed; resurfacing still owed from slice 2.
- **STANDING AUTHORISATION IN THE INBOX (Sam, 2026-08-09): RUN THE WHOLE JOURNAL
  CONTINUOUSLY.** No waiting for eye passes between slices. Remaining order:
  post-game body-feel rating + "felt different" tap (+ effort-on-strength) →
  Monday card composition (+ local notification) → niggle history + note
  resurfacing + progress markers → monthly review incl. the ruled charts.
  **Looks/polish deferred to ONE pass at the end** — favour completeness.
- **THE LOAD MODEL IS RULED, NOT BUILT** (Sam, 2026-08-08 pm —
  docs/JOURNAL_LOAD_MODEL_RULING_2026-08-08.md). **2/1/0 is DEMOTED to the
  fallback rung, not retired; the day-shape derivation stands.** Three layers:
  strength TONNAGE + conditioning sRPE as two native streams, combined **only in
  ratio space** vs each stream's own 4-week normal, plus a region layer for
  observation lines. Constants arrive as ONE signing batch when that slice opens.
- **SLICE 1 STILL STANDS BEHIND IT** (`1659d664`): the tab, the week-shape strip,
  did-the-work-happen, how-it-felt, zero new stored state.
- **PREVIOUS: THE JOURNAL UNIT — OPENED AND MEASURED** (`bdef6a00`), plus Sam's
  load + day-shape rulings (`65bff3b3`).
  docs/JOURNAL_UNIT_PLAN_2026-08-09.md is the dependency list the V3 law
  requires before a build.
  - **TWO OF THE KICKOFF'S THREE "MUST SETTLE FIRST" ITEMS DO NOT EXIST.** The
    logging tree (`WorkoutLoggerScreen`, `SetLoggerRow`, `useWorkoutLog`,
    `workoutService`, `src/screens/journal/`) and `src/types/domain.d.ts` were
    deleted in `2df51650` on 2026-07-25; `actualRpe` is in no source file;
    `cluster-B-logged-set-fields` owns zero baseline entries. **The Journal is
    GREENFIELD** — no baseline to extend, no `LoggedSet` decision owed.
    Corrected in place in BOTH the kickoff and the base design doc it was
    inherited from.
  - **THE JOURNAL IS ALMOST ENTIRELY A READ.** `SessionFeedback`
    (`programStore.ts:1693`) is a persisted, never-pruned input already carrying
    completion, per-component completions, feeling, difficulty, soreness,
    teamNightSize, skip/partial reasons, a conditioning log, `notes`, a durable
    receipt — and a `strength` field whose own comment says *"for future
    progression/diary use"*.
  - **THE ONE MONDAY-CARD ITEM WITH NO OWNER AT ALL: load vs normal
    (ACWR-lite).** Zero files match `acwr|chronicLoad|acuteLoad|weeklyVolume`.
    What "load" means is a coaching question for Sam — it blocks that item only.
  - **THREE NEW STORED INPUTS, ALL ANSWERS, ZERO DERIVED STATE:** free notes +
    tags (own armoured store, joins the hydration gate + reset day one),
    post-game feel rating and the "felt different" tap (both ride
    `SessionFeedback` on the EXISTING door — "Log Game" already routes through
    `startFinished: true`). North star: **TOWARD.**
  - **LR-18 RULED (mine, veto open): DELETE `workoutLogStore`, do not persist.**
    Nothing writes it; `resultsPersistOwnershipTests.ts:317` already holds that
    line. Sam's own model rules per-set entry out, so persisting would mint a
    durable key for cancelled work.
  - **SLICE 1 HAS NO STOP CONDITIONS:** the tab + this week read-only, zero new
    stored state. NOT BUILT — awaiting Sam.
  - **TWO OPEN QUESTIONS FOR SAM:** what "load" means; and the week-shape strip
    has no Moderate (the app knows hard/not-hard only, `hardDay: 0|1`).
- **LAST UNIT: THE DEAD ZONE UNDER THE DAY CARD — FIXED** (`d07e3fad`), from
  Sam's 11:04 screenshot while building for Renee. **Invisible witness nodes were
  participating in layout:** `DayStateLeaves` returns a FRAGMENT, so its
  witnesses flattened into direct children of a `gap: spacing.sm` container and
  every one of them earned a gap — **it grew as receipts accrued**, which is why
  it looked like a spacing bug spacing could not fix. All six now sit in one
  `stateLeafWell`; **`position: 'absolute'` is the load-bearing property** (a 0x0
  STATIC wrapper still earns one gap). Leaves gate mutation-proven THROUGH the
  new wrapper. **No device evidence — Sam's rebuild is the instrument**, and the
  wrapper clips, which is safe for every tree-traversing gate but flagged for any
  on-device explorer that resolves by geometry.
- **UNIT: THE COMPOUND BUCKET NAME — BUILT AND LANDED** (`791979c0`), Sam's
  2026-08-08 afternoon answers. **A day is named by EVERY bucket on it**, joined
  by his own " + ", in timeline order, **each word once**. Week row and day title
  are the same rule, the same function. Batch 12 SIGNED in the same commit; chips
  stay unlit (his "a"). docs/COMPOUND_BUCKET_BOUNDARY_2026-08-08.md
- **JOINING IS NOW A SHEET OPERATION, which is the part that generalises.**
  `copy.joiner.plus` is a signed entry marked `joiner: true`; `joinSignedCopy`
  refuses any entry that is not one; `isSignedCopyText` splits on separators and
  requires EVERY piece to be signed. **A compound with one unsigned half still
  reads unsigned.** This retired the last surface-side join in the app —
  `DayWorkoutScreenV2` was building its subtitle on a `' + '` literal, undetected
  since Task 6.
- **`attached` IS RETIRED, and it closed parked question 4 as a consequence.**
  Its definition was "the parts the lead did not speak for"; a compound title
  speaks for all of them. The day screen's subtitle is date + count now.
- **THE TAPE, BOTH WORLDS, THREE GENERATED WEEKS: 6 rows changed, ALL titles.
  TIMELINE BYTE-IDENTICAL. Parts byte-identical.** The exhibit Tuesday (power +
  strength) shows NO diff line — it stayed "Strength", the dedupe proving itself
  on the day the power ruling came from.
- **FOR SAM'S EYE, THE ONE THING TO JUDGE: four of the six changed rows gained
  "+ Team Training"**, not the "+ Conditioning" of his example. His exhibit week
  now reads "Strength + Team Training" on three of five training days — a longer
  row than anything he has seen. Built as ordered (all buckets), flagged not
  narrowed.
- **SEVEN MUTATIONS, SEVEN REDS**, each against the cell claiming the property.
- **A RED THAT WAS NOT MINE, ATTRIBUTED NOT SHRUGGED** (`214ef66c`): the sweep
  came back **3 of 157** against a declared 2. `test:decision-ledger-ownership`
  hardcodes '2026-08-08' as an answer value and asserts it never appears in the
  serialised tape — and every tape entry carries a required `at` UTC timestamp.
  **It reds on exactly two days in history and is green on the other 363.** The
  assertion's UNIT was the whole blob; its CLAIM was the answer-bearing fields.
  `at` is now excluded by name only; mutation-proven that a real leak still reds.
  The three sibling tape suites were audited: green, and none uses a date literal.
- **SLICE 2 STILL STANDS BEHIND IT** — `e8d227ac` (layout + chip row + spacing)
  and `c140a2d0` (bucket vocabulary). docs/DAY_FIRST_SLICE2_BOUNDARY_2026-08-08.md
- **WHAT IS ON HIS PHONE, in the order he wrote out:** the Today/Week control,
  **the seven-day strip directly under it**, today's card with its component
  timeline, **the life-fact chip row**, then Coach Notes. The missed-session
  prompt and the phase-skew disclosure moved below the card with the notes; the
  picker banners stayed above the days they instruct about.
- **FIVE STACKED BARS ARE ONE ROW OF ICON CHIPS, AND NOT ONE DOOR MOVED.** Same
  handler, same testID, same accessibility label on all five — including the two
  whose testID changes when their fact is active. Each bar's sentence is now the
  chip's SPOKEN name. **Labels PROPOSED, unsigned:** Time / Away / Sick / Injured
  / Equipment (copy batch 12, with slice 1's "Today"/"Week").
- **THE DAY SAYS ITS NAME ONCE.** The week row and the day title are the day's
  **BUCKET** (Strength, Conditioning, Rest, Mobility, Accessories, Gunshow,
  Speed); the **timeline is the one enumeration** and carries the variant name.
  **"Power" is gone from the week view** — the exhibit day reads "Strength" — and
  is NOT retired: it still names that component on the timeline.
- **THE PROJECTION OWNS THE WORD.** `VisiblePart` carries `bucket` beside
  `headline`; `PART_BUCKET_KIND` is a table the type system forces to be
  complete. It sits on the WORDS half of the projection, so a missing copy entry
  still cannot disarm the structural laws. **Nothing on the Program screen
  composes a name out of other names any more.**
- **MEASURED IN BOTH WORLDS BEFORE A WORD CHANGED** — a tape over three real
  generated weeks, diffed: every training day's row and title → its bucket;
  Power → Strength; Rest / Practice Match / Game / Team Training unchanged; **the
  TIMELINE BYTE-IDENTICAL**; and **Gunshow kept "Gunshow" on its own**, through
  the typed charter-door branch rather than a special case.
- **THE GATE, both commits:** full `test:bible` **UNPIPED `TRUE_EXIT=1` at
  `test:program-control-durable`, 1 FAIL line** — main's declared red, same
  assertion text. **Sweep 2 of 157 = the declared set EXACTLY.** `test:compile`
  EXIT 0, no file regressed. Copy extraction ceiling **DROPPED 141 → 130 in the
  commit that earned it**, honestly labelled: five sentences left the
  EXTRACTOR'S view, not the app.
- **EIGHT NEW CELLS, TWELVE MUTATIONS, TWELVE REDS — and one mutation SURVIVED
  first.** Deleting the charter-optional branch from `partBucket` left every cell
  green, because a Gunshow day quietly reading "Strength" is a *legal bucket
  word*. A cell of its own now holds it. **That is the finding to carry: a
  vocabulary gate is blind to a wrong word from its own vocabulary.**
- **THREE PINS MOVED, ALL OUT LOUD**, all the legitimate case (the ruling moved,
  on a date, from the owner): A4 rider (a) "notes above the week" → below the
  card, still asserting a POSITION; `coachNoteDisplayTests`' helper pin → the
  structural form; and the readiness entry's button ROLE → asserted at its new
  owner, identity still asserted at the call site.
- **LOOP CHECK, SIGHTING 5:** `a count taken for a record` fired again, inside a
  gate I had just written, on its first run — it counted a door FILE-wide and
  called a legitimate second owner a leftover. **The number named the FILE while
  the claim was about the SCREEN.** Secondary: **a green gate watching nothing** —
  the copy-binding gate reads quoted strings in TABLE ROWS, and my table quoted
  the OLD sentences, so it bound five strings nobody needed watching and none of
  the new labels while printing PASS. 29 → 41 bound, mutation-proven.
- **SEVEN QUESTIONS PARKED**
  (docs/PARKED_QUESTIONS/DAY_FIRST_SLICE2_2026-08-08.md): whether an active fact
  should light its chip (**not built on purpose** — only 2 of 5 chips know);
  **a zoomed-out week row now shows ONE word**, a real loss at that size; power
  still gets its own timeline row for one exercise; **the day SCREEN has the same
  double-labelling one screen over**, outside the order; the five labels for
  signing; the Gunshow-without-a-typed-door gap; where the readiness owner's
  title went.
- **NOT COVERED, first line of it: NO DEVICE EVIDENCE.** Chip sizing, label
  lengths, every tightened gap and how a one-word row scans are unverified by
  eye; this repo has no render-level test, so the gates read source SHAPE and
  projection OUTPUT. The row icon still comes from a title-STRING table
  ("Strength" resolves, "Power" did not, so nothing regressed) — argued from the
  table, not rendered. `coachNoteDisplayTests` does not run at all (crashes at
  HEAD on a missing `TodayWorkoutCard.tsx`, pre-existing, not in the chain); its
  pin was updated anyway rather than left as a trap.
- **THE "RULINGS 1–12 REMAIN OWED" LINE THAT USED TO SIT HERE WAS FALSE, and it
  cost a whole unit.** All 13 home-screen redesign rulings are BUILT, DELIVERED
  or MOOT — re-measured in the source 2026-08-08, **one receipt per ruling** in
  DAY_FIRST_UI_UNIT_PLAN_2026-08-07.md §3. The seat ordered a close-out unit off
  this line before Sam caught it. **Standing law from that: a status claim about
  built work carries a code receipt (`file:line` or commit) AT THE CLAIM, or it
  says OPEN-UNKNOWN.** "Later slice" is a plan, not a status, and it goes stale
  in silence.
- **SLICE 1 STILL STANDS BEHIND IT** (`2796f6d1`, fork A — completion SHOWN, not
  written; two shapes of one screen, one row call site).
  docs/DAY_FIRST_SLICE1_BOUNDARY_2026-08-08.md
- **NEXT: THE JOURNAL UNIT** (seat order, docs/JOURNAL_UNIT_KICKOFF_2026-08-08.md
  — Sam: "I want it all in the journal"). Natural boundary: `/clear` + re-orient
  paste, Opus. Before it: Sam's eye on the compound rows — he holds a veto, and
  the parked questions are his. Then either the device pass or the next slice. The **LR-29
  replay unit** still builds after day-first UI and remains the measured payer of
  main's `fixture-identity` red.

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
