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

37. **BLOCKED-BY: other-agent — AWAY MUST REPLACE THE WORK IT REMOVES — SAM,
    2026-08-13, AND HE CLOSED MY QUESTION INSTEAD OF ANSWERING IT.**

    **MARKED BY `audit`, 2026-08-13, NOT CLAIMED AND NOT EDITED BELOW THIS
    PARAGRAPH.** This item names the DESKTOP as owner. **Two seats are already in
    it; a third is how b62add9f happened.**

    **⚠ ONE HALF OF THAT MARKING IS WRONG, AND THE TERMINAL IS CORRECTING THE
    CLAIM ABOUT ITSELF (2026-08-13).** It said *"the terminal seat is also live in
    `src/utils/sessionResolver.ts` … and it holds that file"*. **The terminal has
    never edited that file.** Checked the way this very item says to:
    `git show HEAD:src/utils/sessionResolver.ts | cmp -s - src/utils/sessionResolver.ts`
    — **IDENTICAL, so nobody holds it.** The desktop wrote it and committed
    (`186c2b1b`, `59b0994a`). **THE BLOCK STILL STANDS on its real reason — the
    desktop owns this item — but a phantom file-hold is exactly the thing that
    stalls a seat for no reason, so it is struck rather than left.** Marking is the permitted edit for a non-owner — the duplicate
    below is marked the same way, and **collapsing the two 37s stays the SEAT's
    edit, exactly as this item already says.**

    **⚠ DUPLICATE — THE SEAT'S FULLER COPY OF THIS ITEM IS BELOW AND IT CARRIES
    MORE OF SAM'S WORDS THAN THIS ONE DOES. READ THAT ONE.** Two 37s exist
    because the desktop wrote one from his chat message and the seat wrote one
    from the same message with more of it quoted. **Collapsing them is the SEAT's
    edit, not mine** (one writer per file). Marked rather than merged.

    **THE DAY HALF IS BUILT — `59b0994a`+, seen on glass:** the vacated Saturday
    reads *"Conditioning — 2 exercises"*. **The BLOCK half is not built.**

    **OWNED BY THE DESKTOP** — corrected 2026-08-13. The terminal claimed this
    for ninety minutes on a wrong inference (the desktop's handoff said it was
    going back to Sam; Sam's reply is what pulled it straight back in). **Sam
    assigned this one directly in chat**, and the desktop wrote both the item and
    R-075 from that message. The owner ratchet (`test:repo-law-guards`) went
    16 -> 17 the moment this item arrived and is what surfaced the collision at
    all — on the day it was built.

    **His words:** *"Away has to replace the work it removes, not just delete it
    - your Saturday Rest Day is the wrong case. Don't ask me about it."*
    **Registered as R-075 in the same commit** (registry gate rule 3).

    **SO BOTH ANSWERS SHIPPED SO FAR ARE WRONG, AND THE SECOND ONE WAS MINE.**
    *"Training Day"* (the empty-day placeholder) and *"Rest Day"* are two wordings
    of the same hole. He does not want the hole named better; he wants it FILLED.

    **⚠ `'rest'` IS LEFT IN PLACE ON PURPOSE, AND IT IS NOT THE ANSWER.** It is
    strictly better than the placeholder he swore at, so reverting it would
    regress his ORIGINAL complaint while fixing nothing. **It is a holding
    position with a ruling against it — do not read it as done.**

    **THE BLOCKER IS ARCHITECTURAL AND IT IS MEASURED, NOT ASSUMED. TWO ROUTES
    TRIED TODAY, BOTH ON GLASS, BOTH FAILED:**
    1. **THE READ CANNOT AUTHOR.** `applyAwayPass` filters `ResolvedDay[]`, and
       §18 tier four runs at read time with `resolveVisibleWorkouts` = the
       IDENTITY, so it can CONFORM a week but has no generator. **Moving the away
       pass BEFORE §18 was built and photographed: Saturday stayed empty and
       WEDNESDAY GOT WORSE** — core `Conditioning` became optional
       `Accessories`. Reverted.
    2. **THE AUTHORING ROUTE COSTS MORE THAN IT PAYS** — item 28: the deriving
       lane re-authors the week but takes Thursday from `Strength` to `Rest Day`,
       runs ~1 minute and generates 1,220 workouts.

    **BOTH ROUTES DEAD-END AT THE SAME PLACE, AND THAT IS THE FINDING:** a
    club-less week's §18 contract declares more core conditioning than a
    bye-build delivers, and the 48-candidate repair search cannot close it.
    **ONE UNIT NOW SITS BEHIND BOTH ITEM 28 AND R-075.**

    **START HERE, NOT FROM SCRATCH — THE MECHANISM HE WANTS ALREADY EXISTS.**
    `sessionResolver.ts` `_resolveDateRaw` already answers *"a game slot was
    freed"* with `buildDerivedSession('prehab_accessories', …, 'Freed game slot',
    …)`. It never fires for away because it is gated to a TEMPLATE game with NO
    calendar mark, and an away-vacated fixture is a MARKED one. **A freed slot is
    a freed slot however it was freed** — that is the sentence to build, and it
    needs no new machinery, no stored state, and no §18 change.



28-C1. **BLOCKED-BY: other-agent — THE RE-MEASUREMENT IS DONE — ON LEGAL WEEKS,
    AND THE WALL HAS MOVED. 2026-08-13, terminal.**

    **MARKED BY `audit`, 2026-08-13, AND THE CHECK IS THIS ITEM'S OWN.** Its wall
    is selection ORDER in `src/utils/coachingEngine.ts`
    (`pickPlacementCondCategories` / `pickCondCategory` returning `out[0]`, COD
    appended last). **That file is NOT free now:** `git show HEAD:… | cmp -s -
    src/utils/coachingEngine.ts` DIFFERS, so another seat is inside it. **Nothing
    is owed to Sam and no ruling is missing — this is a file collision only, and
    it clears the moment that seat commits.**
    **AND THE NOTE BELOW IS THE REASON THE CHECK WAS RUN RATHER THAN SKIPPED:**
    `MM` meant free last time and does not mean free now. Only `cmp` decides.

    **THE FILES WERE FREE** — all four showed `MM` and all four are
    BYTE-IDENTICAL to HEAD. The shared index is stale after private-index
    commits; `git status` lies. Use `cmp` against `git show HEAD:<path>`.

    **MEASURED ON PERMITTED WEEKS** — 5 worlds, 20 weeks, 56 conditioning
    pieces, all with NO club. **COD = 0 everywhere.**
    **BUT THE OFF-SEASON ZEROS ARE THE GATE WORKING:** generation starts at week
    1, so those weeks are early/mid off-season and `codDecelPermitted` refuses
    them — his *"after first 4 weeks"*. Three of five worlds were never eligible.
    **THE LIVE CASE IS PRE-SEASON WITH NO CLUB, AND THE WALL HAS MOVED.**
    Instrumented: `permitted=true` on all 108 calls, so COD IS in the pool — and
    **the cut probe never fires once.** COD is never placed at all, so the
    field-load streak cap is NO LONGER the wall. What remains is selection
    ORDER: COD is reached only at pass 2/3 and the caller returns on the FIRST
    allowed category. **That is item 27's "ranked last, never reached".**

    **NOTHING IS OWED TO SAM.** ~~ORIGINAL~~ — archived verbatim to
    `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 28-C1).

37. **BLOCKED-BY: other-agent — AWAY REPLACES THE WORK IT REMOVES — SAM RULED
    2026-08-13. THE SATURDAY REST DAY IS WRONG.** (Seat's fuller copy; marked by
    `audit`, same reason as the duplicate above — owned by the desktop, and the
    terminal seat holds `sessionResolver.ts`.)

    **✅ THE DAY HALF IS BUILT AND ON GLASS — `59b0994a`+, 2026-08-13, desktop.**
    The vacated Saturday reads **"Conditioning — 2 exercises"** (`400 m Repeats`,
    CORE), and Sunday — which held nothing — correctly stays *"Rest Day"*. **Both
    of your first two rules are satisfied.** `sessionResolver.ts` `freedByTheTrip`
    reuses the app's own *"a game slot was freed"* answer; `test:away-flow`
    [15d]/[15e] hold it, and **[15e] asserts the KIND** — the first build filled
    the day with `prehab_accessories`, which is a substitution in SHAPE and not in
    kind, and it passed [15d] while still being wrong.
    **⚠ STILL OPEN — THE BLOCK HALF, which is the harder one and is your third
    rule:** nothing counts what the trip removes ACROSS its weeks and aims a
    matching total back (*"5 conditionings and 5 strength"*). The per-day
    substitution does not add up to that on its own, and the 17 QA scenarios have
    not been run either side because no scenario carries a travel fact.

    **OWNED BY THE DESKTOP AGENT** (it owns the away flow).
    **REGISTRY-GREP:** grepped `RULINGS_REGISTRY.md` for *away* — R-018 (away
    RESHAPES, does not avoid the dates), R-019 (equipment is a subtraction),
    R-020 (*"clear team training and games while away"*). **R-020 said what comes
    OFF and never said what goes back. This is the missing half, and it makes the
    Saturday question void — do not ask it.**

    **HIS WORDS:**
    > *"If nothing was on that day then it's probably worth just leaving as rest
    > - if something was on that day then it should be substited with a new
    > similar session to keep the program flowing - it really is common sense"*
    > *"if I go away for 2 weeks and I was going to miss 4 team trainings 1 game
    > and 5 strength sessions, then the 2 weeks should aim to fill those with 5
    > conditionings and 5 strength ya know"*

    **THE RULE, and his example IS the specification:**
    - **A day that held NOTHING of his stays REST.**
    - **A day that held SOMETHING gets a SIMILAR session in its place.**
    - **The unit is the AWAY BLOCK, not the day.** Count what the trip removes,
      replace it like-for-like in QUALITY across the block: **4 team trainings +
      1 game = 5 removed → 5 CONDITIONING. 5 strength → 5 STRENGTH.**
    - **Team training and games map to CONDITIONING** — that is the quality they
      supplied. This is the same crosswalk the exposure counts already use
      (`sessionClassificationAdapter.ts:165` credits an anchor as sprint/COD).
    - ***"AIM to fill"*** — a target, not a hard floor. Equipment or days
      available may reduce it; **a shortfall must SAY SO**, in the sentence that
      already branches by cause (R-029).

    **SO THE CURRENT BUILD IS WRONG AT THE SATURDAY.** That day held a GAME —
    something — so it must get a similar session, not `Rest Day`. **The `'rest'`
    fix at the vacate sites was right for a day that held nothing and wrong for a
    day that held a fixture. Split the two cases.**

    **PROVE IT with his own example:** a 2-week away block over 4 team trainings,
    1 game and 5 strength returns **5 conditioning and 5 strength**, and a day
    that was already empty is still rest. Run the 17 QA scenarios either side.


36. **THE `[13d]` RED IS PAID — AND THE PRESCRIBED FIX WAS REFUTED BY THE SAME
    MEASUREMENT THAT PAID IT. `test:away-flow` IS 44/0.**

    **REGISTRY-GREP: R-018, R-020, R-006, R-070/`:227`.** R-020 (*"yes clear team
    training and games while away"* — the club goes, his own sessions stay) and
    R-018 (*"the plan should change until their return date"*) are the two that
    bite. **Neither is breached. No question for Sam.**

    **THE ORDER SAID: "assert the athlete's own rows are a SUPERSET home→away,
    not equal", and "state the +1 honestly — the fallback grew by TWO rows and
    the week shows ONE". BOTH HALVES ARE ANSWERED BY DUMPING THE ROWS INSTEAD OF
    THE TOTALS:**

    | | rows |
    | --- | --- |
    | HOME | Lower Body Strength [4] · Team+Upper Pull [3] · Team+Upper Push [3] · Gunshow [6] · Prehab [5] = **21** |
    | AWAY | Lower Body Strength [7] · Lower Squat [5] · Upper Body Strength [5] · Prehab [5] = **22** |

    **ELEVEN ROWS LOST, ELEVEN GAINED.** Gone: Short Flush, Pull-Ups, Overhead
    Press, DB Bench Press, Bicep Curl, and the entire six-row Gunshow arm day.
    Arrived: Vertical Jump, 20 m Acceleration Reps, Continuous Aerobic Run,
    Walking Lunges, Single Leg RDL, Nordic Lower, Explosive Push-up, Bench Press,
    Classic 4x4.

    **SO A SUPERSET REDS INSTANTLY — eleven of his own rows are not there**, and
    it reds in BOTH arms, so it was never true.

    **⚠ CORRECTED `b62add9f` — THE +1 *DOES* HAVE AN ARITHMETIC EXPLANATION, AND
    IT IS `c69151d9`.** This item first said the +1 was "an eleven-for-eleven
    SWAP that nets one" and not attributable to the grown fallback. **Refuted by
    single-variable measurement** — revert ONLY `defaultProgram.ts` to
    `c69151d9^` and re-run both arms:

    | | home | away |
    | --- | --- | --- |
    | at HEAD | 21 | **22** |
    | fallback reverted | 21 | **21** |

    **Home is fixed across the revert, so the fallback is the whole of the +1.**
    The swap and the growth are two INDEPENDENT facts: the swap is present in
    both arms, so it is not what moved. The superset refutation stands either
    way. The away week reaches the grown fallback because its Wednesday is
    synthesised whole by `completeCoachWorkoutsFromPlan` (`fallbackReason:
    edge_omitted_day`) as the "Lower Squat" day.

    **AND THE ORDER'S "+2 AUTHORED, +1 SHIPPED" IS EXPLAINED, NOT WAVED AWAY:**
    `applyPoolRotation` turns `RDLs` into `Deadlift` (pattern preserved), then
    `finaliseWorkoutAfterMutation` drops that hinge — **the open C7 defect
    receipted in `5d6ef5fa`**, reached here by probe before that commit was read.
    So `Single Leg RDL` lands, the hinge does not. **When C7 is fixed `[13d]`
    stays green (the floor is one-sided) but away becomes 23.**

    **CONSEQUENCE FOR A NEIGHBOUR: `c69151d9` IS NOT OUTPUT-NEUTRAL.**
    `test:power-counting`'s moved golden is this same cause, not a second defect.

    **AND THE OLD CELL WAS PASSING BY COINCIDENCE — 21 == 21 over two completely
    different weeks.** Its name claimed *"every row of his own training survives
    the trip"*, which has never been true of this app. **The operator was not the
    defect; the premise was.** Same shape as item 28's step 1, twice in one day:
    an ordered fix aimed at a mechanism that measurement then said was not there.

    **THE SWAP IS THE APP OBEYING SAM, NOT DRIFTING FROM HIM** — *"consider the
    time they are away as building a new program and their old program is gone
    for the time being"*. The club was carrying his conditioning and half his
    upper volume; take it away and a REAL upper day has to appear (Friday's
    optional arm day became core Upper Body Strength) and the app has to supply
    the running the club used to (sprints, an aerobic run, a 4x4). **A week that
    merely deleted the club would be the defect.**

    **WHAT LANDED, and neither is a count range:**
    - **`[13d]` the trip does not COST him training — his volume never falls.**
      A one-sided floor. It still reds the day a trip starts eating his work,
      which is the only reason the cell has ever existed.
    - **`[13f]` the away week is RE-AUTHORED, not the home week minus the club.**
      This is `[13d]`'s non-vacuity AND a pin: without it the floor sits green
      over a week that merely subtracted two club nights — which is what
      everyone believed was happening, for as long as the totals matched.

    **THE FALLBACK IS UNTOUCHED** — `c69151d9` stands, exactly as ordered.

35. **EQUIPMENT SCOPES · THE GUESSED SESSION CUT · THE MAS BLOCK CHECK.** Full
    text: `docs/SEAT_ORDERS_FULL_2026-08-13.md`; the block history and its two
    withdrawals: `docs/SEAT_ORDERS_PARKED_FULL_2026-08-13.md`.
    **Sam's words, 2026-08-13:** *"equipment is usually only just for that
    session"* · *"yeah well that sounds shit and not good"* · *"okay it needs to
    be checked"*.
    **Registered as R-072 (equipment scopes), R-073 (a cut must be proven),
    R-074 (the 4-5 min block cap).** R-072 and R-074 are BUILT.
    **R-073 is the live one and it is small:** the number proving a week fell
    short is already computed every week and simply is not used to explain the
    cut. **Measured first: 28 weeks, 7 worlds — ZERO unexplained shortfalls, so
    this is a missing LOCK, not a live defect.**

    **R-073's ONE NAMED OPEN QUESTION IS NOW ANSWERED — 2026-08-13.** The row
    said *"a multi-area severe injury MIGHT reach `availableSafePatterns.length
    === 0`… build only after producing that state"*. I produced it by calling
    the map directly instead of reasoning about it, and **the guessed shape is
    wrong:**
    - three SEVERE single-area injuries → `["pull"]` left safe;
    - **lower_body + upper_body-with-`pauseAffectedTraining` → `[]`, the state;**
    - ONE multi-area severe injury alone → `["squat","hinge"]` left safe;
    - `profileInjuries` only, every area, all Severe → `["pull"]`.

    **`pull` IS RESTRICTED BY EXACTLY ONE CONDITION IN THE WHOLE MAP** —
    `region === 'upper_body' && pauseAffectedTraining`
    (`weeklyExposureContractBuilders.ts:244-246`). Nothing else ever touches it,
    and the `profileInjuries` half has no `pull` clause at all. **So it takes TWO
    active injuries, not one multi-area one, and no number of profile injuries
    can ever do it** — which is exactly why 28 weeks and 7 worlds never saw it.
    **THE STATE IS REACHABLE, SO THE BRANCH IS LIVE CODE, NOT DEAD CODE — but in
    it the reason is PROVEN (all four patterns named by a live injury), so it is
    not what Sam's ruling forbids. The LOCK is still what is owed. Do not "fix"
    the producer; gate it.** Written into R-073 in the same commit.

34. **⚠ A SESSION IS BUILT BY PATTERN COVERAGE, NOT BY A COUNT. Sam,
    2026-08-13.** Full text and receipts: `docs/SEAT_ORDERS_FULL_2026-08-13.md`.
    **His words:** *"the number of exercises is not important the total work
    being done evenly across the body is"*.
    - **LOWER:** hinge · squat · single-leg knee · single-leg hip · accessory
      and/or core. **Already Bible `:227`, and NOT IN THE APP (census C7).**
    - **UPPER (full):** horizontal push · horizontal pull · vertical push ·
      vertical pull · arm/shoulder accessory. (Bible `:338`, `:348`.)
    - **UPPER (split push OR pull):** horizontal · vertical · more arm · more
      accessory · optionally a single-arm press (pressing + core together).
    - **Power sits on top.**
    **THE FLOOR QUESTION AND THE DOUBLE-HINGE QUESTION ARE BOTH VOID** — this
    ruling answers them. **Census C7, A4 and session size are ONE unit.**
    **AND: `conditioning` joins `ROLES_EXEMPT_FROM_COUNTING`** — Sam: *"it should
    be its own thing and not count as a strength exercise"*.
    **The fallbacks breach `:227` today:** `defaultProgram.ts:1179-1183` has no
    hinge; `:1172-1177` is two hinges.
    **PROVE IT:** a lower day with no hinge is RED; two squats is RED; an upper
    day missing vertical is RED.

    **✅ THE DROP SITE IS NAMED TO THE LINE — 2026-08-13, AND IT IS NOT A BUG,
    IT IS A GUARD.** R-014 had this bounded to one function
    (`finaliseWorkoutAfterMutation`) with *"what is left is WHICH LINE INSIDE
    IT"*. Probed at the candidate branch through the REAL generator; it printed
    exactly ONE line in the whole away suite, and it is exactly the missing row:

        DRIFT-DROP "Deadlift" pattern=hinge intended=[squat] workout="Lower Squat"

    **THE `main_pattern_drift` BRANCH DELETES THE HINGE ON PURPOSE.** The plan
    entry names the day's main lift (`squat`), the fallback correctly emits Sam's
    ladder (squat AND hinge), and the canonicaliser removes the hinge as drift
    *from the plan*. **So `:227` and `main_pattern_drift` are in direct
    contradiction and the guard is winning** — *"an athlete is better served by a
    squat and a hinge than by two squats"*.
    **SEVEN STAGES WERE CLEARED BEFORE THIS ONE AND TWO FIXES WERE SPENT ON
    LAYERS NOT IN THE CHAIN — so the receipt matters more than the line.**

    **THE FIX, one sentence, explaining the class rather than the case:**
    `intendedPatterns` names the day's MAIN LIFT, never its whole content, so a
    row whose pattern COMPLETES that day's own ladder is not drift. **Do not
    special-case squat/hinge. Do not delete the drift guard** — it exists to stop
    a day wandering off its plan.

    **WHY IT IS NOT LANDED IN THIS COMMIT, and this is a cost, not a block:** it
    changes generated output, so it owes `test:scenarios` + `test:qa` either side
    plus the drift branch's firing rate across the corpus. **AND THE GUARD THE
    ORDER ASKS FOR CANNOT SHIP WITHOUT IT:** `LAW-0-registry` forbids a new law
    row entering as `UNENFORCED`, so *"a lower day with no hinge is RED"* and the
    fix are ONE commit, never two. **Next session starts at the branch, not at
    the hunt.**

33. **THE RULINGS REGISTRY + ASK GATE — BUILT.** Full text:
    `docs/SEAT_ORDERS_FULL_2026-08-13.md`.
    `docs/RULINGS_REGISTRY.md`, 70 rows, seeded from every named source; the gate
    is in `scripts/seat-inbox-hook.sh` with cells.
    **Sam, 2026-08-13:** *"IT SHOULDN'T EVEN BE AN OPTION FOR THE AI TO FIX A
    PROBLEM THAT HAS BEEN FIXED"*, and *"ONLY THINGS THAT ARE BUILT AND SET IN
    STONE ACTUALLY CHANGE HOW THEY BEHAVE"* — which is why this is a hook and not
    an instruction. **Remaining: nothing — but a grep returning nothing still
    means "not recorded", never "he never decided".**

32. **THE THREE QUESTIONS DRAFTED FOR SAM WERE RE-ASKS — CLOSED.** Full text:
    `docs/SEAT_ORDERS_FULL_2026-08-13.md`.
    Two were already built (`3f62ad62` many games per week; `1dc52caf` the
    fixture shortfall sentence). The third was barred in shape.
    **Sam, 2026-08-13:** *"why the fuck is someone still saying shit like this WE
    HAVE FUCKING FIXED THESE ISSUES"*. **Superseded by item 33 — the registry and
    the gate now exist.**

31. **COD WINDOW + CHRISTMAS BREAK CONTROL — SAM RULED 2026-08-13.** Full text:
    `docs/SEAT_ORDERS_FULL_2026-08-13.md`.
    **Off-season means NO team training, full stop; the Christmas break is an
    off-season inside pre-season.** COD is permitted ONLY when: **no team
    training this week AND not in season AND not the first four weeks of
    off-season** (his *"after first 4 weeks"* = `late_offseason`,
    `seasonPhaseClock.ts:72-74`). Pre-season with no team training counts.
    **Build the two questions (desktop):** ~10 Dec *"when is your last team
    training?"*, ~3 Jan *"when does team training go back?"* — dates decide when
    to ASK, never the answer. Reuse the away dated-span mechanism.
    **Correct Bible `:1440`, and fix or retire QA scenario S7** (off-season with
    three team trainings — a week that cannot exist).

30. **BLOCKED-BY: other-agent — AND THE BLOCK IS NOW ONLY ONE FILE WIDE.
    RE-MEASURED 2026-08-13 by the terminal, which is the session this marker
    names.** The marker was written when a PREVIOUS terminal session held three
    files. Checked with `cmp` against `git show HEAD:<path>`, not `git status`:

    | file | state |
    | --- | --- |
    | `src/rules/derivedWeekContract.ts` | **FREE** — byte-identical to HEAD |
    | `src/data/defaultProgram.ts` | **FREE** — byte-identical to HEAD |
    | `src/utils/coachingEngine.ts` | **HELD** — carries uncommitted work |

    **So two thirds of the stated block has lifted and the marker was over-stating
    it.** Left BLOCKED rather than cleared, because one file genuinely is held and
    I do not know whether the fix needs it — **that is a question for whoever
    holds `coachingEngine.ts`, not a wall I can measure away.** Whoever takes this
    should re-check that one file first; the other two are ready.

    **NOTHING IS OWED TO SAM.** He has already ruled the shape (bye-week build);
    what is left is engineering.

    **⚠ THE DEFECT HAS A SECOND FACT UNDER IT, AND IT IS NOW PROVEN ON GLASS —
    2026-08-13, desktop agent.** The Christmas break (item 31 part 5) inherits
    this whole. `.maestro/golden/christmas-break-takes-the-club-off.yaml` seeds
    10 December, answers the question, pages to **21-27 December — wholly inside
    the break** — and **Tuesday the 22nd and Thursday the 24th still read
    "Strength + Team Training"**, with `1 active modifier impacting program` in
    the header. **The fact is live and the weeks already built are unchanged**,
    which is this item's sentence word for word.
    **AND IT EXPLAINS WHY BOTH SUITES ARE GREEN:** `test:away-flow` [13]-[13e]
    and `test:christmas-break` [7b]/[9]/[11c] both GENERATE their weeks with the
    constraint live. **A cell that builds its own world cannot see a week that
    was built before the athlete answered.** That is the shape to keep in mind
    when this is fixed — the fix is not proven by either suite going green.
    **THE FLOW IS LEFT RED ON PURPOSE** and recorded that way in
    `docs/GOLDEN_FLOW_RUN_RECEIPT.md`; it will go green when this item does, and
    it is the cheapest available proof that it did. **ONE FIX SERVES BOTH FACTS.**

    **MEASURED, NOT ASSUMED (2026-08-13, desktop agent).** The terminal's three
    newest commits include `8a2f5ef2 docs(away): THE READ FILTER NEVER RUNS ON
    THE PROGRAM TAB — measured, and I am not closing this out`, and it is holding
    `src/rules/derivedWeekContract.ts`, `src/data/defaultProgram.ts` and
    `src/utils/coachingEngine.ts` uncommitted — the three files the session-reuse
    leak lives behind. Two agents in those files is how one commit swallows the
    other's half-finished work.

    **WHAT THIS SEAT ADDED WITHOUT ENTERING THEM:** the leak now has a second
    fact under it, and it has been asked rather than assumed — see the new
    paragraph at the end of this item.

    ORIGINAL BELOW.
    **THE AWAY RULING IS CARRIED OUT WHEN A WEEK IS BUILT — and NOT YET on a
    week already on screen.**
    **WORKING:** a week planned inside a trip loses the team night and keeps
    every row of the athlete's own training (`test:away-flow` [13]-[13e]).
    **THE PLAN HALF IS MEASURED CORRECT** — a device probe showed the anchor and
    the span right and the club list emptied. **Do not go back to it.**
    **NOT WORKING, and seen on glass:** putting travel on the DERIVING lane so it
    re-authors the CURRENT week made the tap fail once, then succeed and produce
    a WRONG week — a team night appeared on a day the plan never marked, because
    a regenerated week reuses sessions and a reused session KEEPS ITS OLD NAME.
    **That is the one open defect on this half: SESSION REUSE, not allocation.**
    **Everything else — the refusal hunt, the two refuted theories, the instrument
    lessons — is archived to `docs/AWAY_FLOW_BOUNDARY_2026-08-13.md`.**
    **AND SAM HAS SINCE RULED THE WHOLE SHAPE (see `## AWAITING SAM`): away is a
    BYE-WEEK BUILD, and dropping fixtures inside the span at `targetWeekFixtures`
    delivers it.**

    **THE LEAK NOW HAS A SECOND FACT UNDER IT — item 31 part 5's Christmas break
    (desktop agent, 2026-08-13).** It takes the club off a week the same way away
    does, so it is exposed to the same reuse. **ASKED, NOT ASSUMED:**
    `test:christmas-break` `[10e]`-`[10g]` rebuild a break week FROM a normal
    week that really does name team training (the non-vacuity half), and nothing
    carries forward — no name, no `isTeamDay`.
    **⚠ AND THAT IS THE SMALLER CLAIM, DELIBERATELY.** Those cells drive FULL
    generation with `previousProgram`; the defect was seen on a PHONE through the
    SCOPED REGEN path, and this item's own archive says why no node harness
    reaches it — *"the scoped regen never fires there, because that harness has
    no microcycles to regen into (`canScopedRegen`)"*. **So: the break does not
    leak on the path a suite can reach, and its scoped-regen behaviour is
    UNMEASURED, exactly as away's is.** One fix here serves both facts.

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

2. **BLOCKED-BY: other-agent — MAKE THE CHAIN CHEAP.** Full text and all
   timings: `docs/SEAT_ORDERS_PARKED_FULL_2026-08-13.md`.
   **Sam:** *"i want to know how long that 192 tests are taking and if it's
   really necessary"*.
   **PAID: the ~25 minutes was a RED suite replaying one broken walk 200 times,
   not an expensive suite.** Budget now 12; the suite measures 213s.
   **LEFT:** an 89s suite where **82 seconds sit in six cells**, all named in the
   full text. The 42% cut (91s->53s) EXISTS and was REVERTED — it breaks the
   guarantee that a fixture move publishes its dependent week in the same
   snapshot. **Three priced routes; none started, because the two section18
   files they touch are mid-flight with another agent.**

7. **NOT BLOCKED — SAM'S OWN CASE IS NOT REPRESENTABLE TODAY.** Full text:
   `docs/SEAT_ORDERS_PARKED_FULL_2026-08-13.md`.
   The two questions this item put to Sam were withdrawn — the answers were
   already in the code and in his rulings. **Sam, 2026-08-13, on being asked
   things already settled:** *"WE HAVE FUCKING FIXED THESE ISSUES"*. **What remains is the build, and it is
   the seat's measurement that is stale, not his instruction.** Re-measure before
   starting: this item has been wrong about its own premise once already.

13. **STANDING, EVERY STOP — KEEP THE UNENFORCED LAW COUNT FALLING.** Full
    text, the priced routes and the refutations:
    `docs/SEAT_ORDERS_PARKED_FULL_2026-08-13.md`.
    **The truth is `grep -c "state: 'UNENFORCED'" src/rules/lawRegistry.ts`** —
    the terminal has miscounted this twice, both times one low.
    **Four laws remain priced and each names why it is hard:**
    `LAW-green-gate-is-a-claim` (needs standing mutation testing),
    `LAW-L9-checkpoint-discipline` (reds on arrival, needs a from-here cutoff —
    a process decision imposed on other agents),
    `LAW-attributed-content-change` (reproduces only on a real accepted base),
    `LAW-L6-honest-actions` (structural).

21. **NOT BLOCKED — THE NUMBER IT SHARED WITH ITEM 25 IS VOID, AND WHAT IS LEFT
    NEEDS NO RULING.**

    **REGISTRY-GREP: R-010 and R-014.** R-010 (*"just keep sessions for gym the
    same before footy training"*) is the ruling being BROKEN here — the opposite
    of a prior answer, so it does not close this. **R-014 DOES close the half
    that was pointed at Sam:** it now ends **"DO NOT SEND HIM A FLOOR NUMBER
    QUESTION"**, because *"the number of exercises is not important the total
    work being done evenly across the body is"*.

    **SO THE ASK IS WITHDRAWN AND THE MEASUREMENT BELOW IS RE-AIMED.** "The gym
    half of a team night averages 2.93 rows against 4.68" is still a real
    finding — **but 2.93 is not the defect, an unfilled pattern is.** R-010 says
    the gym session is the same whatever else is on that day; R-014 says "the
    same" is measured in SLOTS, not rows. **Both point at the same build and
    neither needs him.**

    **THE OLD BLOCK IS STALE:** it said the fix sits in files "the terminal holds
    uncommitted". The terminal holds nothing — `sessionBuilder.ts` and
    `sessionRowCounting.ts` are both clean. So this was worked.

    **HIS RULING:** *"just keep sessions for gym the same before footy
    training"*. **THE APP DOES NOT.** Across 4 worlds, 75 gym sessions, counting
    strength rows properly (`!== NON_COUNTING_ROW_INDEX`):

    | | sessions | distribution | average |
    | --- | --- | --- | --- |
    | **gym half of a TEAM NIGHT** | 28 | **26 x 3 rows**, 2 x 2 | **2.93** |
    | **gym-only day** | 47 | 3x1, 4x19, 5x21, 6x6 | **4.68** |

    **THE GYM SESSION BEFORE FOOTY TRAINING IS 40% SMALLER THAN THE SAME
    ATHLETE'S OTHER GYM SESSIONS.** It is not noise — 26 of 28 are exactly three.

    **⚠ AND MY OWN EARLIER CENSUS MISSED THIS ENTIRELY.** Item 25's distribution
    filtered `workoutType === 'Strength'`, which EXCLUDES both `Mixed` and
    `Team Training` days — so it measured gym-only days and called them "gym
    sessions". The numbers there are true of what they covered and were never
    the whole population. Corrected here rather than left to be re-found.

    **THIS IS ITEM 25'S DEFECT, NOT A SECOND ONE.** Session size comes from
    `templateWorkout.exercises.length` (`sessionBuilder.ts:718`), and a team-night
    template was authored with three rows. **Same root cause, same fix — session
    size derived from the authored policy, not from a template's row count — and
    the FLOOR question already with Sam settles both.** Do not build them apart.

    ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 21).


25. **CLOSED BY R-014 — there is no session floor, because size was never the
    rule. Measurement archived verbatim to
    `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 25).**
    **REGISTRY-GREP: R-014**, which now reads *"because the number of exercises
    is not important the total work being done evenly across the body is"* and
    ends **"DO NOT SEND HIM A FLOOR NUMBER QUESTION."** The "FLOOR = 4"
    recommendation is WITHDRAWN. **The 3-row sessions it measured are still a
    defect — but the defect is an UNFILLED PATTERN, not a count**, and that
    build is item 34's. R-014 stays `UNENFORCED`: nothing composes a session by
    pattern.

26. **THE ⚠ HALF IS BUILT — HIS 2-3 PAIRS SURVIVE THE VALIDATOR NOW.**
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 26).**

27. **A1 AND B1 ARE FIXED (`0cb3f771`, `c3f3410e`). C1 IS SCOPED AND STOPPED —
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 27).**

28. **THE REBUILD IS DONE, AND ITS ORDERED STEP 1 WAS THE WRONG STEP — REFUTED
    ON GLASS, BOTH SIDES PHOTOGRAPHED, 2026-08-13.**

    **SAM'S COMPLAINT IS FIXED.** *"why the fuck does it read training day?"* —
    that Saturday now reads **"Rest Day"** on the simulator, and his five own
    training days are all still there (Tue Strength, Wed Conditioning, Thu
    Strength, Fri Gunshow, plus today).

    **IT WAS ONE WORD, IN THE READ.** `sessionResolver.ts` `applyAwayPass`
    vacated a fixture day with `buildDay(..., null, 'none')`. `'none'` means "no
    workout", and `dayKind` (`rules/projectVisibleWeek.ts:208`) maps every
    non-fixture, non-`'rest'` day to `'training'`, whose signed headline is
    *"Training Day"* — the app's placeholder for a day that exists and holds
    nothing. **So the game came off correctly and printed a placeholder in the
    hole, on every away week, for as long as away has worked.** Now `'rest'`, at
    BOTH vacate sites (the fixture, and a team-only day) — they have to agree or
    the same week calls two identical holes by two different names.
    **R-020 DECIDES THE WORD, so nothing new was ruled:** *"yes clear team
    training and games while away"* — the club goes and **his own sessions
    stay**; he never had a session of his own on a fixture day, so once the game
    is off he is not training that day. R-006 permits up to three full rest days
    in exactly this shape of week.
    **HELD BY `test:away-flow` [15c]/[15d]/[15e]** — non-vacuity first (at home
    that Saturday reads GAME), then the headline through the COPY REGISTRY
    rather than a literal, then the typed read underneath it so a copy change
    alone cannot make the cell pass on a day that is still a hole. **Mutation-
    proven: [15d] and [15e] both red at HEAD.**
    **AND [15b] IS WHY THIS SURVIVED A DAY.** It asserts the game is GONE and
    says nothing about what stands in its place, so it stayed green over a
    Saturday reading *"Training Day"*. **A cell that asserts an absence and never
    asserts the presence is half a cell.**

    ── **STEP 1 IS REFUTED. DO NOT ORDER THAT LINE CHANGED A THIRD TIME.** ──

    Travel WAS put back on `isRuledDerivingConstraint`, run on the simulator
    against the same seed and the same week, and photographed. **The deriving
    lane is worse for the athlete and the numbers are not close:**

    | | inert lane (HEAD) | deriving lane |
    | --- | --- | --- |
    | Thu 16 — a team night he is away for | **Strength** | **Rest Day** |
    | Sat 18 — his game | "Training Day" | "Training Day" |
    | the tap | instant | **~1 min, 1,220 workouts generated** |

    **IT COSTS HIM A TRAINING DAY AND FIXES NOTHING.** Removing the club anchors
    makes the week a bye-build whose contract declares more core conditioning
    than the week carries, so §18 runs
    `repairCoreConditioningShortfallCandidates` through its 48-candidate search
    (`section18AcceptedWeekGateway.ts`), regenerates Thursday **616 times**, and
    still hands back an empty day. The one defect Sam actually named was
    IDENTICAL either way — so it was never that lane's to fix.

    **AND THE PREMISE THE WHOLE HUNT RESTED ON IS WITHDRAWN: THE REFUSAL DOES
    NOT REPRODUCE.** A new `[temporary-source-fact] lane` line now logs on EVERY
    commit (not only on failure) — it fired, showed `scopedRegen: true`, and **no
    `refused` line was ever printed.** The lane is not refusing. It is simply the
    wrong tool, exactly as the north star says: away is a DECISION, and the week
    it implies is DERIVED — `derivedWeekContract` drops the fixture anchor,
    `onboardingToCoachingInputs` drops the club days, `applyAwayPass` filters the
    read. **None of them stores a thing, and all three already reach a week the
    athlete is looking at.**

    **THE CONTROL IS NOW PERMANENT INFRASTRUCTURE, and it is the only reason any
    of this was readable.** `[temporary-source-fact] lane` fires on every commit,
    so a run with no lane line is a DEAD INSTRUMENT, not a result — which is the
    distinction that produced two confidently wrong conclusions on this item
    before it existed.

    **STILL OPEN, NAMED SO NOBODY RE-FINDS IT:** with no club anchors the week's
    §18 contract declares more core conditioning than a bye-build delivers, and
    the 48-candidate repair search burns ~1,200 generations on it. **That is a
    §18 unit, not an away unit** — it is only visible from here because away is
    the cheapest way to make a club-less week. It costs nothing today because
    travel is inert.

    **WHAT IS WORKING AND MUST NOT REGRESS** (all seen on glass): the week-shape
    Away control, leave date, unbounded return date, the equipment question and
    its dated span, **the game off the week**, **the team night off a combined
    day**, a fixture inside the trip no longer anchoring its week, and now **the
    vacated day reading Rest Day instead of a placeholder**.

    **INSTRUMENT NOTE, PAID FORWARD.** The device flow that proves all of this
    lived in a session scratchpad and was nearly lost twice. `pkill -f "expo
    start --dev-client"`, then ONE `npx expo start --dev-client --port 8082
    --clear`, then the flow via `scripts/dev-e2e/run-maestro-ios.sh` with
    `-e SEED_ID=standard-in-season-week`. It runs 14/14.

29. **THE AWAY FLOW IS BUILT — full report in
    `docs/AWAY_FLOW_BOUNDARY_2026-08-13.md`.**
    **WORKING, seen on glass:** the week-shape control, the leave date, the
    unbounded return date, the equipment question and its dated span, the GAME
    coming off the week during a trip, and a fixture inside the trip no longer
    anchoring its week.
    **STILL SHOWING: the team night on a combined day.** The card's words come
    from `getSessionComponents`, and the two-field fix for it measured WORSE on
    the real day — it took his gym session off the card. The exact next place is
    named in the boundary report.
    **Held by `test:away-flow` (36 cells), `test:day-first-timeline`,
    `test:program-control-durable`.**

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

- **⚠ NEW 2026-08-13 — THE VACATED SATURDAY IS A REST DAY, AND HE MAY HAVE MEANT
  A SESSION. ASKED IN CHAT, RECORDED HERE BECAUSE A CHAT MESSAGE IS NOT A
  DURABLE RULING.**

  **REGISTRY-GREP: `training day`, `rest day`, `away`, `travel`, `bye`, `vacated`,
  `empty day` over `docs/RULINGS_REGISTRY.md`.** Returned **R-018** (*"the plan
  should change until their return date"*), **R-020** (*"yes clear team training
  and games while away"* — the club goes, **his own sessions stay**), **R-019**
  (away equipment is a subtraction) and **R-006** (1-2 full rest days everywhere;
  **3 permitted on bye-recovery weeks**). **NOTHING IN THE REGISTRY NAMES WHAT
  STANDS ON A DAY THE CLUB VACATED** — that is the gap, and it is why this is a
  question and not a re-ask.

  **WHAT SHIPPED (`a46d8c9e`, seen on glass):** his Saturday game came off the
  away week and the day read *"Training Day"* — the placeholder for a day that
  exists and holds nothing, and the literal thing he swore at. It now reads
  **"Rest Day"**, and his five own training days are untouched.

  **WHY REST WAS THE DEFENSIBLE READ AND NOT AN INVENTION:** R-020 says his own
  sessions stay, and he never had a session of his own on a fixture day — Saturday
  was in his week only for the match, and Saturday is not one of his preferred
  training days. R-006 permits the rest day in exactly this shape of week. **So
  the ruling covers the day; it does not name the WORD.**

  **THE DOUBT, STATED PLAINLY:** his sentence was *"it should read whatever the
  new program is i.e. conditioning, lower body strength etc"* — which points at a
  SESSION, not a better label. He was looking at a week where other days were
  also wrong, so he may have been naming the class rather than that day.

  **WHAT HE WAS ASKED, in his own terms:** *"That Saturday now says Rest Day
  because you don't normally train Saturdays — it was only in your week for the
  match. If you'd rather it gave you an actual session there, say so."*
  **NOT BLOCKING ANYTHING** — the placeholder is gone either way, and turning a
  rest day into a session is additive.

- **ANSWERED 2026-08-13, AND HIS ANSWER IS BIGGER THAN THE QUESTION — AWAY IS A
  BYE-WEEK BUILD.** Sam, verbatim: *"If you're away, you're not playing, so a
  taper and a recovery day would be training for a match you're not at. The other
  side: your season view quietly loses a game that really happened. The period
  you're away should almost look like a bye week build or an off season block
  with no team training, ensuring that when you treat when you get back enough
  time to recover before the next game so you wouldn't do heavy legs on a friday
  when you are travelling home that day just because you're away, a game still
  may be that weekend"*.

  **THE RULING, AS ACCEPTANCE CRITERIA:**
  1. **A fixture INSIDE the trip does not ANCHOR the week** — no G-1 taper, no
     G+1 recovery. He is not playing it.
  2. **⚠ CORRECTED BY SAM THE SAME DAY, AND MY RECOMMENDATION IS OVERRULED.**
     I recommended leaving his calendar mark alone. He said: *"i think the game
     should be removed if the athlete is away … the game on the 15th should be
     removed or at least blanked out"*. **So the fixture inside the trip GOES
     from the week — removed, or blanked so it plainly is not his to play.**
     He had already weighed the cost he named (*"your season view quietly loses
     a game that really happened"*) and ruled anyway. **Do not re-argue it.**
  3. **The away period is shaped like a BYE WEEK BUILD or an off-season block,
     with no team training.**
  4. **A fixture AFTER he returns still shapes the tail of the trip.** No heavy
     legs on the Friday he flies home if there is a game that weekend.

  **THE APP ALREADY HAS THE SHAPE HE NAMED, which is why this is small.**
  `derivedWeekContract.ts:92-102`: a week with NO FIXTURE derives
  `anchorState: 'bye'` and mode `in_season_bye_build`. **So dropping fixtures
  that fall inside the away span — at the one fixture owner,
  `targetWeekFixtures` (`rules/fixtureConditionedAvailability.ts:141`) — gives
  all four at once:** no anchor for the game he misses (1); the mark untouched,
  because the filter is on the READ and not the store (2); a bye-week build for
  the span (3); and a fixture OUTSIDE the span still anchoring, so the
  travel-home Friday is still G-1 (4).

  **HIS WORKED EXAMPLE IS THE ACCEPTANCE TEST, verbatim** — *"they leave thursday
  august 13th and get back friday 21st of august. Team training should be removed
  thursday tuesday and thursday (if they train those nights), and the game on the
  15th should be removed or at least blanked out, but the next saturday the 22nd
  game is still alive and there training on wednesday thursday friday the
  following week needs to not kill them for that return"*.

  **UNFOLDED, and every line is checkable:**
  - Away span **Thu 13 Aug → Thu 20 Aug** (back Friday the 21st).
  - Team nights **Thu 13, Tue 18, Thu 20** all go.
  - **Sat 15 game: GONE.** That week (10-16) has no fixture left, so it derives
    `anchorState: 'bye'` / `in_season_bye_build` — the shape he named.
  - **Sat 22 game: ALIVE.** Its week (17-23) is HALF AWAY: Mon-Thu inside the
    trip, Fri 21 the travel home, game Saturday.
  - **So the tail of the trip is still G-2 and G-1** — Thu 20 and Fri 21 — and
    must not *"kill them for that return"*. **This falls out of the same filter
    rather than needing its own rule: the 22nd is outside the span, so it
    anchors, and its taper reaches back into days the athlete is still away.**

  **THE MIXED WEEK IS THE REAL TEST.** A cell that only walks a wholly-away week
  cannot see criterion 4 at all.

  **BUILT 2026-08-13, AND IT NEEDED NO WIRING AT ALL.** The filter went in at
  `derivedWeekContract`'s `fixtureIdentityForWeek`, which **already receives
  `temporarySourceFacts`** — so the trip was in scope the whole time and the
  seven `targetWeekFixtures` callers never had to be threaded.
  **His worked example is a cell:** `test:away-flow` [14]-[14d] — both weeks are
  game weeks first (non-vacuity), then the 15th's week becomes
  `anchorState: 'bye'` / `in_season_bye_build` and the 22nd's week stays a game
  week. **Mutation-checked:** disabling the filter reds [14b].
  **AND IT REACHES THE WEEK THE ATHLETE IS ALREADY LOOKING AT** — which is what
  item 30 had been chasing through the deriving lane and failing. The effect is
  DERIVED, so `changedProgram` is true while NO overlay is authored and NO
  reversible adjustment is minted (`test:program-control-durable`). **Store the
  decision, derive everything else** — the deriving lane was the wrong tool and
  is what made the door refuse on a real world.
  **AND THE CARD IS DONE TOO, 2026-08-13, after he said the halfway version was
  not good enough:** *"no it shouldn't show + team training and the game really
  should just be removed as well … if the person is away, consider the time they
  are away as building a new program and their old program is gone for the time
  being … thats clunky and unprofessional"*.
  **HIS FRAMING IS THE FIX AND IT NAMED THE GAP I HAD BEEN PATCHING AROUND.** The
  two earlier filters both change what a week *IS* — the plan stops marking team
  days, a fixture stops anchoring. **Neither touches a week that was ALREADY
  STORED with the club on it, and that is the week he is looking at.** So the
  third filter is on the READ: `applyAwayPass` in `sessionResolver`, the last
  pass of `resolveWeekWithConditioning`. A fixture inside the trip stands down to
  an empty day; a team night is stripped from its day and a club-only day empties;
  a combined day keeps its own half, renamed through the one owner.
  **IT IS A FILTER, NOT AN EDIT.** His calendar mark, his accepted program and the
  team night all still exist and all come back when the fact expires or he clears
  it. Held by `test:away-flow` [15]/[15b], non-vacuity first; mutation-checked.

  **⚠ AND IT DOES NOT REACH THE PROGRAM TAB. MEASURED, NOT SUSPECTED,
  2026-08-13.** A probe at the top of `applyAwayPass`, run through the real flow
  against a logged Metro, **never fired once** — while a probe in the coaching
  engine on the same run did. **So `resolveWeekWithConditioning` is NOT what
  draws the athlete's week**, even though `buildProgramTabProjectedWeek` appears
  to call it and `useResolvedWeek` → `projectWeekFor` →
  `buildProgramTabProjectedWeek` is the documented chain.
  **THE READER IS FOUND, AND IT IS THE ONE I ALREADY EDITED — which makes the
  remaining gap NARROW AND STRANGE. Measured 2026-08-13 with probes at four
  layers, twice, the second time on a cache-cleared Metro:**
  `projectWeekFor` (9 calls) → `buildProgramTabProjectedWeek` (18) →
  `resolveWeekWithConditioning` (61, twenty of them WITH the travel fact
  present, `facts=1`). **So the chain is exactly as documented and the fact
  reaches it.**
  **⚠ AND `applyAwayPass` — the LAST LINE of that same function — logged ZERO
  times.** Both of the function's two returns call it (`:1732` and `:2181`,
  verified by listing every `return` in the body and every top-level `}`), the
  function is entered 61 times, and its final pass is never reached. **I cannot
  explain that, and I am not guessing a fifth time.**
  **THE PROBE WAS RUN AND IT FOUND THE LINE — `sessionResolver.ts:1729`,
  `if (!state.seasonPhase) return baseDays`.** Two stamps added in ONE edit:
  the top of `resolveWeekWithConditioning` fired 61 times, the pass at the bottom
  ZERO. **`state.seasonPhase` is empty in the state the screen builds, so the
  whole conditioning tail is skipped and the athlete's week is `resolveWeek`'s
  output — every filter added below that line over two days could never run.**
  **THE EARLY RETURN NOW RUNS THE AWAY PASS TOO** (`:1729`). All suites green.
  **⚠ AND IT IS NOT PROVEN ON GLASS, because the instrument stopped being
  trustworthy.** Late in the session Metro repeatedly served a STALE bundle: an
  edit would compile, the flow would run, and the new stamp would not appear
  while older stamps in the same file did. **Two conclusions were drawn from that
  silence and both were wrong.**
  **THE INSTRUMENT FAULT WAS THREE ORPHANED METRO PROCESSES ON ONE PORT.** Kill
  them all, start ONE `--clear`, and put a CONTROL (change an existing log's
  text) in the same edit as the test. **Every "it never fired" conclusion taken
  before that is void.**
  **THE REAL DEFECT: `resolveWeekWithConditioning` HAS THREE EXITS** — the
  no-season guard, `return section18TierFour({...})` at `:1894`, and the final
  line. A real week has a stored §18 contract and leaves at the MIDDLE one, so
  every filter added at the bottom over two days never ran. Wrapped.
  **GAME: OFF ON GLASS** — Saturday reads "Training Day". **TEAM NIGHT: STILL
  SHOWING**, and the two-field fix for it was measured WORSE on the real day (it
  took his gym session off the card). **Full account, and the exact next place —
  the team identity the real workout carries in its `sections` — is in
  `docs/AWAY_FLOW_BOUNDARY_2026-08-13.md`.**

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
