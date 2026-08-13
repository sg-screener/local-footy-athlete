# THE FULL TEXT OF SEAT ORDERS 31-35 — archived 2026-08-13

**Moved out of `SEAT_INBOX.md` because the READING is what costs Sam time, and
the seat wrote most of the bulk.** Measured: the inbox was 90KB of a 96KB
budget; the four hot docs together were 167KB (~42k tokens) re-read at every
stop, while the whole completion gate runs in 32 seconds and `test:qa` in one.
**The tests were never the cost.**

**Do not read this file. Grep it** — only when a summary in the inbox is
challenged or you need a receipt it cites.

---

35. **SAM RULED THREE THINGS IN ONE MESSAGE, 2026-08-13: THE EQUIPMENT SCOPES,
    THE GUESSED SESSION CUT, AND THE MAS BLOCK CHECK.**

    **REGISTRY-GREP:** grepped `docs/RULINGS_REGISTRY.md` for *equipment*, *MAS*
    and *exhaustion* before writing — R-018/R-019 cover AWAY equipment only,
    nothing covers the profile/session split, and nothing covers C10 or C11.
    **These are new rulings. Add R-071, R-072, R-073 in the same commit.**

    **(a) THE EQUIPMENT SCOPES — THERE ARE EXACTLY THREE. Sam, verbatim:**
    > *"equipment is usually only just for that session - there is no longer a
    > button on the day screen that allows you to edit equipment. you can make
    > permanant changes inside the profile section, or temporary changes to
    > equipment in a session view"*

    **THE THREE, and no fourth may be invented:**
    1. **PROFILE — permanent.** The athlete's standing kit.
    2. **SESSION VIEW — this session only.** The default case: *"usually only
       just for that session"*.
    3. **AWAY — a dated span that lifts itself on the return date** (R-018,
       built today). His own words: *"the plan should change until their return
       date"*.
    **NO DAY-SCREEN DOOR. VERIFIED, not taken on trust:** no equipment control
    exists in `DayWorkoutScreenV2.tsx`. **It is gone and must stay gone.**

    **WHAT THIS SETTLES:** census row about the equipment change "not reaching an
    existing week" was measured against the WRONG SCOPE. A session-scoped change
    is not supposed to rewrite the week — **it is supposed to change THAT
    SESSION, and that is what must be verified on glass.** Restate the open
    question as: *does a temporary equipment change in the session view actually
    swap the exercises in that session?* **Nothing else about equipment is owed.**
    ~~**⚠ AND CHECK THE SPAN DID NOT SWALLOW THE SESSION CASE.**~~
    **CHECKED 2026-08-13 — REFUTED, AND (a)'s OPEN QUESTION IS ANSWERED WITH IT.**

    **THE QUESTION — *"does a temporary equipment change in the session view
    actually swap the exercises in that session?"* — YES.** Measured at
    `DayWorkoutScreenV2.tsx:717` (`applySessionEquipment`): it builds a
    replacement plan from the session's requirements and the kit the athlete
    ticked off, then for each replacement executes **`swap_exercise` with
    `scope: 'today_only'` and `oneOffOnly: true`** — one action per exercise,
    refusing honestly and naming the exercise when no safe replacement exists.
    **It changes THAT SESSION and nothing else, which is exactly the scope Sam
    ruled.**

    **AND THE ⚠ IS BASED ON A PREMISE THAT IS NOT TRUE.** The session door
    **writes no equipment fact at all** — zero occurrences of
    `set_equipment_modifier` or `missing_this_week` in either
    `DayWorkoutScreenV2.tsx` or `SessionEquipmentSheet.tsx`. `missing_this_week`
    has exactly TWO writers, both in `EquipmentLimitationSheet.tsx` (:102, :184),
    which is the PROGRAM-screen week/span door. **So a payload named for a week
    is never asked to carry "just this session" — the session scope does not use
    it.** The name is still imprecise for the door that DOES use it, but that is
    a naming question about scope 1-vs-3, not the defect this ⚠ describes.

    **⚠ MEASURED IN SOURCE, NOT ON GLASS.** The item says the swap "must be
    verified on glass" and this is not that: it is the code path read end to end.
    **The device check is still owed** — open a session, tick kit off, and see
    the rows change.

    **⚠⚠ THE GLASS CHECK WAS ATTEMPTED 2026-08-13 AND ABANDONED — THE SIMULATOR
    IS SHARED WITH THE TERMINAL AND I WAS INTERLEAVING WITH ITS RUN.**
    I reached the session view and its three controls (`+`, a dumbbell, injury)
    and got no further. **Mid-run the screen changed to a WEEK view I did not
    navigate to**, carrying *"Got it — logged that you're away. Team training and
    games come off as your plan updates."* and a **`SAT 18 — Training Day`** —
    which is item 28's away rebuild, live, on the same device. **Two agents
    driving one simulator corrupt each other's runs in both directions**, so I
    stopped rather than keep tapping. **The check remains OWED; nothing about it
    is claimed.**

    **AND SAM'S COMPLAINT IS VISIBLE ON GLASS RIGHT NOW, WHICH IS ITEM 28's
    RECEIPT, NOT MINE:** *"why the fuck does it read training day?"* — `Training
    Day` is exactly what Saturday reads.

    **TWO INSTRUMENT LESSONS, BOTH PAID IN TAPS:**
    1. **The panel's tap space is 402x874 POINTS; a screenshot is 919x1919
       PIXELS.** Four taps went nowhere because I used image coordinates. The
       attach call states the point space — read it.
    2. **`maestro inspect_screen` RELOADS THE APP MID-SESSION**, and the reload
       trips the dev-harness cold-start gate (*"clock receipt has no active
       checkpoint"*), costing a full reseed each time. **Inspect once before you
       start, or not at all — then drive from the point space.**

    **(b) THE GUESSED STRENGTH CUT — SAM: *"yeah well that sounds shit and not
    good"*. THAT IS A RULING: BUILD IT.** Census C10.
    **The defect:** the only producer of a typed main-strength reduction
    (`section18SafetyPolicy.ts:311-318`) fires on
    `availableSafePatterns.length === 0` — an INFERENCE from which patterns are
    injury-safe. **It never asks whether a day remained.** So a week that
    genuinely ran out of room records NO typed reduction at all and degrades to
    an advisory nobody surfaces — **and the Coach Note owes the athlete a reason
    it cannot give.**
    **His own earlier ruling already specifies the fix** —
    `INJURY_AUTHORITY_EXHAUSTION_RULING_2026-08-06.md:22-27`, kept by V2: main
    strength gains the SAME exhaustion proof equipment has
    (`not_attempted | substituted | exhausted`), and **MEASURED exhaustion —
    *"proof, never inference"* — is what emits the reduction.**
    **BUILD:** the status on the main-strength contract block
    (`weeklyExposureContractV2.ts:373-378`, which has no exhaustion field today),
    the measurement that fills it, and the reduction emitted from THAT rather
    than from "no pattern is safe". **A cut with no proof is a defect, not a
    reduction.**

    **⚠⚠ THE MEASUREMENT ALREADY EXISTS AND IS ALREADY COMPUTED — CORRECTED
    2026-08-13, SAME SESSION, AND THE FIRST ANSWER WAS WRONG.**

    **WHAT I FIRST RECORDED (commit `fa89388b`):** *"the proof site is
    `postGenerationConstraintValidation.ts:1026` — `if (!source ||
    !targetWorkout) break;` is the week running out of room."*
    **THAT BREAK IS IN `buildSection18ProductionFallbackCandidate`**, whose own
    comment says it is *"invoked only after the primary candidate fails"*.
    **I read a loop and attributed it to the path athletes are actually on.**
    A-function's-second-caller-is-a-different-world, sighting on my own work,
    inside the item that exists because a cut was INFERRED rather than proven.

    **THE REAL ANSWER, AND IT IS BETTER: THE PROOF IS ALREADY THERE, GENERALLY.**
    `section18EffectiveWeekEvaluator.ts:1020` already runs
    `assess(contract.mainStrength.exposure, ledger.mainStrength.achievedCount)`,
    and `assess` (`:1009-1019`) already writes **`unresolvedMinimumShortfall`**
    and **`unresolvedPlannerSelectedShortfall`** onto the contract — *"the target
    minus what the week actually achieved"*, on the real evaluation path, for
    every week. **That IS measured exhaustion. Nothing needs to be measured; the
    reduction needs to be emitted from a number that is already on the
    contract.**

    **SO THE BUILD SHRINKS, AND THE ARCHITECTURE QUESTION DISSOLVES WITH IT.**
    No new field on the mainStrength block, no status written from a seam that
    does not own it, no write-back from post-generation validation. **The unit is:
    emit a typed `main_strength_frequency` reduction whose reason is EXHAUSTION
    when `unresolvedPlannerSelectedShortfall > 0` (or the minimum one) after
    placement, beside the injury producer rather than instead of it.**

    **AND THE ITEM'S "RATHER THAN" IS STILL WRONG — IT IS AN ADDITION.**
    `section18SafetyPolicy.ts:311` carries `reason: 'injury_restriction'` and its
    comment records a differential-golden defect it exists to avoid: reading an
    all-optional early-off-season mode fact as a whole-body restriction and
    zeroing the frequency. **Two reductions, two reasons. Replacing one with the
    other reintroduces a defect that already shipped once.**

    **STAND-DOWN D RE-VERIFIED AS SPENT** before any of this was touched.

    **⚠⚠⚠ AND THE ITEM'S PREMISE IS WRONG ON THE EVIDENCE — MEASURED THIRD PASS,
    2026-08-13. DO NOT BUILD AGAINST IT AS WRITTEN.**

    **THE CLAIM:** *"a week that genuinely ran out of room records NO typed
    reduction at all and degrades to an advisory nobody surfaces."*

    **WHAT ACTUALLY HAPPENS** (`section18EffectiveWeekEvaluator.ts:862-899`) is a
    THREE-TIER ladder, and an authorised reduction touches only the bottom one:
    1. `actual < requiredMinimum` -> **`required_minimum_shortfall`, severity
       BLOCKING.** Fires regardless of any reduction.
    2. `actual < plannerSelectedTarget` -> **`planner_selected_target_miss`,
       severity BLOCKING.** Also fires regardless.
    3. `actual < defaultTarget` **AND `!hasFrequencyReduction(...)`** ->
       `default_target_miss`, severity **advisory**.

    **SO A ROOM-EXHAUSTED WEEK IS NOT SILENT AND IS NOT AN ADVISORY — IT IS
    BLOCKING, with `expected` and `actual` on it.** The only thing an authorised
    reduction suppresses is tier 3.

    **THE REAL DEFECT, RESTATED:** the week is recorded as an ERROR when it
    should be recorded as an EXPLAINED CUT. Sam's *"yeah well that sounds shit
    and not good"* is about the app cutting on a guess; the fix is that a week
    which genuinely had no room should **AUTHORISE** the reduction — so the
    athlete gets a reason and the week stops reading as broken — rather than
    tripping a blocking finding nobody can act on.

    **AND THE REASON WORD ALREADY EXISTS.** `insufficient_availability` is
    already in `WeeklyExposureReductionReason` (`weeklyExposureContract.ts:32`).
    **No new vocabulary, no new field, no new measurement.**

    **THE OPEN QUESTION IS NOW SHARP AND IT IS NOT SAM'S:** may a blocking
    finding be downgraded to an authorised reduction, and WHO authorises it —
    because "the week had no room" must not become a way to silence tier 1 and 2
    for weeks that are genuinely broken. **That is the whole remaining design.**

    **(c) BLOCKED-BY: other-agent — THE MAS BLOCK LIMIT.** The fourth clause goes
    in `conditioningSelection.ts:291-304`, and that file is `MM` in the shared
    checkout with changes this seat did not make. **The finding is confirmed
    though: `set_length_max_4_5_min` appears five times — one union member, one
    source string, three template assignments — and NOTHING reads it.** Nothing
    is owed to Sam; he already said *"okay it needs to be checked"*.
    ORIGINAL: **SAM: *"okay it needs to be checked"*. BUILD THE
    CHECK.** Census C11.
    **His rule:** short-intermittent high-%MAS work keeps the set/block to
    **≤ ~4-5 min**, *"enforced at selection time, not written into the dose"*
    (`CONDITIONING_FRAMEWORK_SAM_2026-07-25.md:58`, `:113`, `:127`).
    **The property EXISTS and has NO READER:** `set_length_max_4_5_min` appears
    five times — one union member, one source string, three template assignments
    (`conditioningTemplates.ts:69,93,918,935,1003`) — **and nothing reads it.**
    **BUILD:** a clause in the selection filter beside the three that already
    work (`conditioningSelection.ts:291-304` gates `warmup_rider_only`,
    `finisher_role_only`, `fallback_only`). **Same place, same shape — this is
    not new machinery, it is the fourth clause in an existing list.**
    **PROVE IT WITH A MUTATION:** delete the clause and a cell must red on a
    block that runs past five minutes. **The erg cap (C3) was closed the same way
    today — copy that unit exactly.**



34. **BLOCKED-BY: other-agent — THE TERMINAL IS BUILDING THIS RIGHT NOW, AND
    PART 2 HAS ALREADY LANDED.**

    **NOTHING IS OWED TO SAM. He ruled it; this is engineering.**

    **MEASURED 2026-08-13, desktop agent — the item is moving under the file:**
    - **Part 2 IS BUILT** — `01ef5863` *"CONDITIONING STOPS COUNTING AS A GYM
      EXERCISE"*, which is this item's `ROLES_EXEMPT_FROM_COUNTING` addition.
    - **Part 1 IS IN FLIGHT** — `cc6ef611` *"SAM'S SLOT LAW IS A RULE NOW"* added
      `src/rules/sessionSlotCoverage.ts` and its suite (158 + 152 lines) minutes
      ago, and `sessionRowCounting.ts` is `MM` in the shared checkout with
      changes this seat did not make.

    **AND ITS EFFECT ON THE QUEUE IS ALREADY PAID:** the floor question it voids
    was removed from items 21 and 25 in `61424153`, and R-014 carries the ruling.
    **Zero questions now point at Sam.**

    ORIGINAL BELOW.
    **⚠ SAM HAS RULED HOW A SESSION IS BUILT, AND IT IS NOT A NUMBER. THE
    SESSION-FLOOR QUESTION IS VOID. 2026-08-13.**

    **OWNED BY THE TERMINAL. Top of the queue — it deletes one of the five
    questions about to be sent to him and rewrites two more.**

    **HIS WORDS, verbatim — every clause is a slot:**
    > *"because the number of exercises is not important the total work being
    > done evenly across the body is"*
    > *"lower body strength should have a hinge, a squat, an single leg knee, a
    > single leg hip, and accessory and/or some core"*
    > *"and upper body strength day should have push pull on the horizontal,
    > push pull on the vertical then should arm work or accessory work for the
    > shoulders"*
    > *"if you upper body pull or upper body push then it just becomes
    > horizontal movement, vertical movement, more arm work, more accessory
    > work, maybe a lift like a single arm press so you get some pushing and
    > core in at the same time"*
    > *"then you can throw power and stuff in there"*
    > *"i thought this would have been explained by now"*

    **1 — THE FLOOR QUESTION IS DEAD. DO NOT SEND IT.** "Minimum exercises in a
    gym session — 3, 4 or 5?" is question 1 of the five drafted for him.
    **He has just answered a better question than the one being asked: the rule
    is PATTERN COVERAGE, and a count is a proxy for it.** A session is the right
    size when its slots are filled. Registry row R-014 changes from UNRULED to
    this ruling. **A short session is now a session MISSING A PATTERN, which is a
    nameable defect instead of a number nobody authored.**

    **2 — CONDITIONING STOPS COUNTING AS A STRENGTH EXERCISE. Sam, same
    message:** *"yes it should be its own thing and not count as a strength
    exercise - thats stupid"*. `ROLES_EXEMPT_FROM_COUNTING`
    (`sessionRowCounting.ts:64-86`) holds `power`, `team_training`, `mobility`
    — **add `conditioning`.** It is the fifth case of the shape that set exists
    for, and it is the one his own team-training ruling used as its REFERENCE
    (*"looked at more like conditioning"*) while conditioning itself still
    counted. **Golden diff required, as the module's header demands.**

    **3 — ⚠ AND HE IS RIGHT THAT IT WAS ALREADY EXPLAINED. IT IS IN HIS BIBLE,
    VERBATIM, AND THE APP DOES NOT DO IT.**
    - **LOWER — `LFA_PROGRAMMING_BIBLE.md:227`:** *"Lower-session heavy-slot
      ladder, in fill order: heavy squat pattern -> heavy hinge pattern ->
      single-leg knee-dominant -> single-leg hip-dominant -> accessories. An
      athlete is better served by a squat and a hinge than by two squats."*
      **That is his message, word for word, written before today.**
    - **UPPER — `:338` *"Push: Horizontal and vertical pressing"*, `:348`
      *"Pull: Horizontal and vertical pulling"*, `:3322` *"Horizontal/vertical
      pull"*.**
    - **THIS IS CENSUS ROW C7, STATUS: NOT IN APP.** Strength selection for
      generated weeks is done by the model and the prompt never mentions the
      ladder — `grep -rniE "single-leg|unilateral" src/services/api/generateProgram.ts`
      returns ZERO. The only ladder-shaped code
      (`exerciseScorer.ts:597-601`) is reachable from ONE call site,
      `coachRevisionTemplates.ts:597`, which is the coach-revision path — **never
      the weekly generator.**
    - **AND THE FALLBACKS ACTIVELY BREACH IT:** the squat-only branch
      (`defaultProgram.ts:1179-1183`) is Back Squat + Reverse Lunges + Leg
      Extension — **no hinge, no hip-dominant single leg**; the hinge-only branch
      (`:1172-1177`) is RDLs + Hip Thrusts + Hamstring Curl — **no squat, no
      single leg at all, and two hinges, which `:227` names as the exact thing to
      avoid.** That is also census row A4 (two main lifts, one pattern).

    **4 — SO THE BUILD IS ONE UNIT, NOT THREE.** C7 (the ladder), A4 (no two
    mains of one pattern) and the session-size item are **the same defect**:
    nothing composes a session by PATTERN. **Build the slot list as the authored
    owner and fill it; the count falls out.**
    - **LOWER SLOTS:** hinge · squat · single-leg knee-dominant · single-leg
      hip-dominant · accessory and/or core.
    - **UPPER (full):** horizontal push · horizontal pull · vertical push ·
      vertical pull · arm/shoulder accessory.
    - **UPPER (split push OR pull day):** horizontal · vertical · more arm work ·
      more accessory · optionally a combined lift such as a **single-arm press**,
      which he names specifically because it buys pressing and core together.
    - **POWER SITS ON TOP** — *"then you can throw power and stuff in there"* —
      consistent with power already being exempt from the count.

    **5 — WHAT THIS DOES TO THE OTHER FOUR QUESTIONS.** Q4 ("the double hinge")
    is ANSWERED BY THIS RULING and by `:227`; it is no longer his. **Re-check all
    five against `RULINGS_REGISTRY.md` before any of them is sent** — that is
    what the ask gate is for, and this item is its first real test.

    **PROVE IT:** the 17 QA scenarios and the 120-session distribution either
    side, **plus a new cell per slot: a lower day with no hinge is RED, a lower
    day with two squats is RED, an upper day missing vertical is RED.** Sam's
    sentence is the assertion — nothing else needs authoring.



33. **BLOCKED-BY: other-agent — ALL THREE GATE CELLS ARE BUILT; THE SEEDING HALF
    IS THE TERMINAL'S AND IT IS INSIDE THE FILE RIGHT NOW.**

    **NOTHING IS OWED TO SAM HERE.**

    **THE GATE IS `WORKING` — `test:ruling-registry`, 7 cells, armed in
    `test:bible`.** The three this item ordered, in its own numbering:
    1. **Every row has an id, a quote and a status** — `[1]`. **It reads the row
       FORMAT rather than a list of allowed words**, because the header's *"two
       states only"* is out of date: the rows use `PARKED BY SAM` (R-008),
       `UNRULED` (R-014) and `BINDING` (R-030), **and all three are right** — a
       gate enumerating them reds once per new word its own author invents.
       `[1b]` opens every `file:line`; `[1c]` resolves every `BUILT <commit>`,
       whose founding case is this registry's own seeding commit — *"I caught
       myself fabricating a citation"*.
    2. **The UNENFORCED count falls and never rises silently** — `[2]`, ceiling
       **11 of 70 rows**, and it reds in BOTH directions: debt rising past the
       ceiling, and a ceiling left standing after the debt was paid.
    3. **The ask gate** — `[3]`. **Sam chose between the two that got built:**
       *"if you built a gate that runs the search itself, keep that one over the
       state-your-grep version."* The hook's `REGISTRY-GREP:` line catches "I
       never checked"; `[3]` greps the registry ITSELF and catches "I checked and
       was wrong", which is what actually happened. `[3c]` pins the matcher at
       both ends so it can neither rot into a rubber stamp nor refuse every
       question.

    **MUTATION-CHECKED SIX WAYS**, including both ratchet directions, a
    fabricated commit receipt, an uncited re-ask, and gutting the matcher.

    **THE COUNT THIS ITEM ASKS FOR: ZERO questions now point at Sam.** It was 5
    when the gate was built. **The first run refused two** — both this seat's,
    one of them the founding case. **The last two were voided by R-014 arriving**:
    items 21 and 25 were both blocked on the session FLOOR, and R-014 now ends
    *"DO NOT SEND HIM A FLOOR NUMBER QUESTION"* because *"the number of exercises
    is not important the total work being done evenly across the body is"*.
    **Neither needed him; both needed the registry to be read.** That is the
    test this item said was Sam's rather than a suite's.

    **AND CLEARING THE QUEUE BROKE A CELL, WHICH IS THE FINDING.** `[3]` asserted
    `sites.length > 0` as its non-vacuity guard — correct while questions
    existed, **and WRONG the moment the queue emptied: it reddened on the exact
    outcome this item exists to produce.** A zero is equally produced by "no
    questions" and "the scanner is blind", so the liveness moved to `[3b]`, which
    feeds the scanner a SYNTHETIC inbox holding one real question, one paragraph
    QUOTING the marker, and the legend line — and requires exactly one hit.
    Mutation-checked both ways: blinding the scanner reds it, and so does letting
    it match a mention of the marker again.

    **WHAT IS LEFT IS THE SEEDING, AND IT IS THE TERMINAL'S:** the Bible
    changelog, the ~70 `*_RULING*.md` docs and `LFA_PROGRAMMING_POLICY_DECISIONS.md`.
    **MEASURED: it is mid-flight — 33 rows at `aa16cdfe`, 56, 69 and now 70
    across three commits in the last hour.** Two agents seeding one file is how
    rows get lost.

    **⚠⚠ AND A HAZARD TO THE REGISTRY ITSELF, MEASURED NOT ASSUMED.**
    `docs/RULINGS_REGISTRY.md` is **STAGED FOR DELETION** in the shared index
    while an untracked copy carrying the live rows sits on disk. **A commit taken
    with that index removes the registry from the repo**, leaving it one
    `git clean` from gone. **Not touched by this seat — it is the terminal's
    index and it may be mid-rename.** Named loudly instead.

    ~~ORIGINAL ORDER~~ — archived verbatim to
    `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 33).



32. **THE ASK GATE IS BUILT AND IT GREPS — `WORKING`, `test:ruling-registry`,
    7 cells, armed in `test:bible`. THE REGISTRY IS THE TERMINAL'S
    `docs/RULINGS_REGISTRY.md` AND THERE IS ONLY ONE.**

    **TWO GATES GOT BUILT IN PARALLEL AND SAM CHOSE BETWEEN THEM:** *"if you
    built a gate that runs the search itself, keep that one over the
    state-your-grep version."*
    - **The terminal's** `seat-inbox-hook.sh` requires a `REGISTRY-GREP:` line,
      and its own comment states the limit honestly: *"It cannot verify the grep
      was honest."* **Left in place, unduplicated** — it catches "I never
      checked".
    - **This one greps.** `[3]` reads every question pointed at Sam, searches
      the registry itself, and reds when a question hits a row it does not cite.
      It catches *"I checked and was wrong"*, which is what actually happened.
      `[3c]` pins the matcher at BOTH ends against the real case, so it can
      neither rot into a rubber stamp nor refuse every question.

    **⚠ AND THIS SEAT BUILT A RIVAL REGISTRY WITHOUT LOOKING — 14 ROWS IN
    TYPESCRIPT, WHILE THE REAL ONE WAS BEING COMMITTED AT 33.** Sam: *"The
    registry has 33 rows, not 14 — check before you add or trim."* **A second
    list of rulings is the exact defect item 32 exists to end, and I built one
    inside the item that forbids it.** Deleted; `[4]` holds its absence as a cell
    rather than a memory. Its 14 rows were checked against the real registry
    first and every one was already covered.

    **TWO INSTRUMENT FAULTS IN THE GATE, BOTH FOUND BY IT REDDENING ON CORRECT
    CONTENT:** it matched the words `BLOCKED-BY: sam` anywhere, so it flagged the
    paragraph QUOTING the marker while withdrawing it and the inbox's own legend
    of legal values; and it enumerated the status vocabulary, reddening on
    `PARKED`, `UNRULED` and `BINDING`.

    **⚠ FOR THE REGISTRY'S AUTHOR — ITS HEADER IS OUT OF DATE, NOT ITS ROWS.**
    Rule 4 says *"Two states only"* (BUILT / UNENFORCED). The rows use at least
    five: R-008 `PARKED BY SAM`, R-014 `UNRULED`, R-030 `BINDING`. **All are
    right** — "he parked it", "he has never ruled it" and "this binds every
    reply" are real states neither of the two can express. This gate reads the
    row FORMAT instead, so it never argues about vocabulary.

    **⚠⚠ AND A HAZARD TO THE REGISTRY ITSELF, MEASURED NOT ASSUMED.**
    `docs/RULINGS_REGISTRY.md` is **STAGED FOR DELETION** in the shared index
    (`git diff --cached` shows 372 deletions) while an untracked copy carrying
    the live rows sits on disk. **A commit taken with that index removes the
    registry from the repo**, leaving it one `git clean` from gone — the exact
    fate the copy-sheet nearly met. **Not touched by this seat: it is the
    terminal's index and it may be mid-rename.** Named loudly instead.

    **⚠ AND THE ROOT CAUSE THIS SEAT OWNS, STATED PLAINLY:** I relayed two
    questions out of inbox prose without reading the code. **Every other claim in
    that report was verified against `file:line`; the questions were not** — the
    one output that reaches Sam directly was the one I did not check.

    ~~ORIGINAL ORDER~~ — archived verbatim to
    `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 32).



31. **PARTS 1-4 BUILT 2026-08-13 BY THE TERMINAL.** (1) Bible amended at `:1289`
    and `:1440` with a changelog entry naming the replaced text — `test:bible-anchors`
    274/274. (2) S7 re-phased to Pre-season AND **S5 fixed too, which the item did
    not name** — same contradiction, same harness violation; QA violations 4 -> 0,
    failing assertions 84 -> 76 with no added line. (3) `codDecelPermitted` is the
    one rule, 9 cells, every line mutation-killed. (4) **THE WRONG INPUT WAS IN TWO
    PLACES** — `coachingEngine.ts:4126` read the same standing profile as
    `defaultProgram.ts:1978`; both now ask the rule.
    ~~**STILL OPEN: the week fact itself is profile-derived until part 5's dated
    span exists (desktop agent)**~~ **— PAID 2026-08-13 BY PART 5, AND MEASURED
    RATHER THAN CLAIMED.** The span exists and it reaches BOTH readers, which is
    the half that could have failed silently: the engine asks
    `inputs.teamTrainingDays.length`, the plan asks `weeklyPlan.some(isTeamDay)`,
    and a span that reached one of them would have left the other
    profile-derived with every existing cell still green. `test:christmas-break`
    `[11]` refuses COD to a pre-season club athlete with no break (non-vacuity),
    `[11b]` permits it to the SAME athlete inside the break, `[11c]` holds the
    plan reader. **Mutation-checked: dropping the break from the club-day filter
    reds `[11b]` and `[11c]` and leaves `[11]` green.** No change was made to
    `codDecelPermitted` or to either call site — they were already correct and
    were waiting on an input.
    **STILL OPEN, AND UNTOUCHED BY PART 5: the same impossible
    off-season-with-team-training shape survives in `finisherEligibilityTests.ts`,
    where re-phasing changes what is asserted.**

    **⚠ AND A NEW RED ARRIVED WITH PART 2's RE-PHASING — FOR THE TERMINAL, NOT
    THIS SEAT.** `test:phase-structure` cell 4, *"early off-season stays
    all-optional (Bible :110)"*, is FAILING. **ATTRIBUTED IN A DETACHED WORKTREE
    AT HEAD, so it is not this seat's working tree talking**: it is red in
    COMMITTED code, and it was GREEN in this same tree earlier today, before
    `8a2f5ef2`, `edcfc663` and `df1ee8e1` landed. Nothing in part 5 can reach it
    — the break's span filter is inert with no span, and off-season already
    derives zero team days through `clubTrainingDaysForPhase`. **Named here
    because a suite that goes red between two of your own commits is the cheapest
    bug anyone will ever fix, and only for about an hour.**
    ORIGINAL BELOW.
    **SAM RULED THE COD WINDOW AND ASKED FOR A CHRISTMAS-BREAK CONTROL.
    2026-08-13. THIS CLOSES 28-C1 AND CORRECTS THE BIBLE.**

    **OWNED BY THE TERMINAL** (the gate and the phase rule). **The two questions
    are UI and belong to the desktop agent — split it at that line.**

    **HIS WORDS, verbatim, because every clause is a specification:**
    > *"off season means NO team training, the christmas break is essentially an
    > off season inside pre season - there is never team trainings here so these
    > are the only times COD may be useful"*
    > *"it may be helpful to add a button for Christmas break and removing team
    > training sessions from the app - maybe around the 10th of December. That
    > way an athlete can select when their last team training is, and then
    > around the 3rd of Jan they should be ask when does team training go back?
    > that way the app isn't guessing"*
    > *"also if an athlete is in pre season mode but has no team trainings they
    > can do COD"*
    > *"So the athlete can only do COD work in late off season (after first 4
    > weeks of off season), in christmas break or during pre season if no team
    > trainings (i.e some people play for cash a few hours away from home so
    > they don't train with the team). No COD required in season for anyone."*

    **1 — THE BIBLE IS WRONG AND SAM HAS CORRECTED IT.** `:1440` reads *"Late
    off-season and the Christmas break are the only normal home for COD/Decel
    work, because those are the weeks with no team training"*, which IMPLIES
    early/mid off-season has team training. **It does not. OFF-SEASON MEANS NO
    TEAM TRAINING, full stop.** Amend `:1440` and `:1289` with his words and a
    changelog line. **The reason COD is late-off-season-only is NOT team
    training — it is that the first four weeks are recovery.**

    **2 — THE QA SCENARIO IS INVALID AND IT MISLED TWO AGENTS AND THE SEAT.**
    S7 is *"Off-season six days with three team trainings"*. **That week cannot
    exist.** ~~It is also the week whose five-day field-load streak was used to
    judge COD.~~ **Fix or retire S7** — and note the harness ALREADY flags it
    (*"Monday is a team day but isTeamDay=false"*), so the contradiction was
    visible and unread.

    **⚠ ONE CLAUSE STRUCK, BY THE AGENT WHOSE MEASUREMENT IT NAMES (terminal,
    2026-08-13). THE COD STREAK WAS NOT MEASURED ON S7, AND IT COULD NOT HAVE
    BEEN.** `autoPlacementCategories` (`coachingEngine.ts`) appends `cod_decel`
    **only when `weekHasTeamTraining` is FALSE** — `return weekHasTeamTraining ?
    base : [...base, 'cod_decel']`. S7 has three team trainings, so COD is never
    even a candidate there. **My own probe output agrees:** every COD offer
    printed `teamTraining=false`, and the `teamTraining=true` lines printed
    `codIndex=-1`. **The five-day field-load streak that cut COD was a
    no-team-training week.**
    **SO THE 28-C1 MEASUREMENT STANDS AND DOES NOT NEED REDOING** — COD is
    offered, eligibility allows it, the session is built with Sam's label, and
    `enforceFieldLoadStreak` removes it. **S7 being invalid is still a real
    finding on its own merits; it is just not the week that judged COD.**
    Recorded rather than left, because a correction that is itself wrong costs
    the next pass a whole re-measurement.

    **3 — THE COD GATE, FINAL. Permitted in exactly three cases:**
    - **late off-season** — his *"after first 4 weeks"* maps EXACTLY to the
      existing clock: `early_offseason` weeks 1-2, `mid_offseason` 3-4,
      `late_offseason` 5+ (`seasonPhaseClock.ts:72-74`). **No new phase needed.**
    - **the Christmas break**
    - **pre-season WITH NO TEAM TRAINING** — a real athlete, not an edge case:
      *"some people play for cash a few hours away from home so they don't train
      with the team"*.
    **NEVER in season, for anyone.**
    **THE UNIFYING RULE, and it is simpler than the phase list:** the gate is
    **"no team training this week" AND "not in season" AND "not the first four
    weeks of off-season"**. Write it that way, not as three phase branches.

    **4 — THE GATE IS ALREADY LIVE BUT READS THE WRONG THING. MEASURED.**
    `defaultProgram.ts:1978` now passes
    `noTeamTrainingWeek: (onboardingData?.teamTrainingDays?.length ?? 0) === 0`.
    **That is the athlete's STANDING PROFILE answer, not a fact about THIS
    WEEK.** An athlete who trains with a club in season has a non-empty list all
    year, so the gate is false in December — **COD can never fire for the very
    athlete the ruling is written for.** This is why the Christmas control is
    not a nicety; it is the missing input.

    ~~**5 — BUILD THE TWO QUESTIONS (desktop agent).**~~ **DONE 2026-08-13 —
    `WORKING`, `test:christmas-break`, 43 cells, armed in `test:bible`. Boundary:
    `docs/CHRISTMAS_BREAK_BOUNDARY_2026-08-13.md`; law:
    `LAW-christmas-break-is-two-questions`.** Both questions ask, both answers
    land on ONE `no_team_training` fact (open-ended in December, closed in
    January), the club comes off every week the span touches, and **his fixtures
    survive — that is the whole difference from `travel` and cell [8c] holds
    it.** `Christmas-Block` was checked first as instructed: it is a
    `ProgramPhase` member with NO READER anywhere in `src/`, so there was nothing
    to reuse; left as found.
    **STILL OPEN, AND IT IS PART 4's, NOT PART 5's: the gate at
    `defaultProgram.ts:1978` is not rewired.** The input it needs now exists —
    `onboardingToCoachingInputs` returns `teamTrainingDays` already filtered by
    the break, so "no team training THIS WEEK" is `teamDays.length === 0` at that
    seam. **ALSO OWED: a device pass with the clock at 10 December and 3 January
    — the ask is date-gated and the simulator clock is August, so the four screen
    cells are SOURCE-PINNED, not glass.**
    **AND A FINDING FOR ITEM 28: `awayFlowTests` `[13c]` ("no game either") is
    VACUOUS** — its `[13]` control checks TEAM DAYS only, and the home week it
    compares against has no fixture at all, so the cell is `0 === 0`. The away
    RULE is still held by `[14b]` at the week-identity seam; the row-counting
    cell is not what holds it. Named, not fixed — that suite is item 28's.

    Sam: *"that way the app isn't guessing"* — so do not infer either date.
    - **~10 December: "When is your last team training?"**
    - **~3 January: "When does team training go back?"**
    **The answers create a dated NO-TEAM-TRAINING SPAN.** Between those dates
    team training is removed from the week and the COD gate opens; on the return
    date it closes by itself. **This is the same shape as the away/equipment
    span built today — a dated fact that lifts itself. Reuse it; do not invent a
    second mechanism.**
    **`Christmas-Block` ALREADY EXISTS as a `ProgramPhase`** (`domain.ts:243`)
    and `clubSeasonScope.ts:19` already quotes the Bible line. **Check what
    those two do today before adding anything.**
    **The dates are DEFAULTS, not rules** — he said *"maybe around"* and
    *"around"*. The athlete's answer is the truth; the date only decides when to
    ask.

    **6 — WHAT THIS DOES TO 28-C1's PENDING QUESTION.** It **dissolves it.** The
    question was whether COD should be protected from the field-load streak cap.
    **It should not, and it does not need to be:** the streak came from a week
    with three team trainings, which off-season cannot have. **In a genuine
    no-team-training week the field load is the app's own and the cap is not
    under pressure. Re-measure on a legal week before changing the cap.**
    **DO NOT ask Sam "protect it or leave it cut" — that question is now void.**


