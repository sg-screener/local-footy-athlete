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

44. **⚠ FOUR GUARDS ARE RED AND ONE IS A REAL REGRESSION FROM THE LAST HOUR.**

    **OWNED BY `progression` (the store writer) and `audit` (the two flows).**
    **REGISTRY-GREP:** `RULINGS_REGISTRY.md` for *store*, *writer*, *flow* — the
    one-writer-per-store law is architectural, not a Sam ruling. **Nothing to
    ask him.**

    **✅ THE STORE-WRITER HALF IS PAID — `progression`, 2026-08-13.** It was my
    regression (`8f4ba364`) and the guard was right. Rerouted through the store's
    own module: `restoreUserRemovalConstraintsWrite` in `programStore.ts`, the
    sibling of `applyProgramOverrideWrite` the executor already imports. **The
    debt allowance was NOT raised.** `test:repo-law-guards` one-writer cell back
    to PASS; ownership suite 5/0; mutation-proven (neutering the new writer reds
    both pin cells). **The two MAS flows and the other reds are `audit`'s.**

    **THE ONE THAT MATTERS — A SECOND LIVE WRITER JOINED THE PROGRAM STORE.**
    `useProgramStore <- utils/coachCommandExecutor.ts`. **This is new, from the
    refused-add / pinned-exercise fix.** The one-writer law exists because two
    writers on a stored shape is how state diverges silently. **Either route the
    write through the existing owner, or declare it in the debt with a reason —
    do not raise the allowance to make the red go away.**

    **THE OTHER THREE, and two are the same cause:**
    - **`mas-pace-absent-while-the-club-runs.yaml` and
      `mas-session-names-his-own-pace.yaml` are unreachable AND unrun.** Two new
      golden flows created with the MAS work that nothing links to and no receipt
      records. **Finish wiring them or retire them — an unrun flow is a test that
      exists and proves nothing**, which is the exact shape this repo keeps
      finding.
    - **3 unproven source anchors in `conditioningTemplateEqualityTests.ts`.** An
      `indexOf` that misses returns -1 and the slice reads from the end, so the
      cell can pass over the wrong text. **Guard the anchors.**

    **NONE of these are Sam's list.** They are the cost of the last hour's work
    and they should be paid before the next unit, not carried.


40. **CENSUS C4 — SAM'S FLOORS DO NOTHING. BUILD THE ENFORCEMENT.**

    **OWNED BY `pace`.**
    **REGISTRY-GREP:** `RULINGS_REGISTRY.md` for *running*, *floor*, *minimum* —
    the floors are AUTHORED (Bible `:4283` running 2/3/4, `weeklyExposureCounts.ts:45`
    conditioning 3-5, sprint min 1). **Nothing to ask Sam. This is a build.**

    **THE DEFECT:** the `under` findings are computed
    (`weeklyExposureCounts.ts:323-367`) and `weekStructureValidator.ts:454-466`
    takes the `under` branch FIRST and hardcodes `severity: 'info'`,
    `canOverride: true`, skipping light weeks entirely. **`grep` for any repair
    consumer of the three `_under` rule ids returns ZERO**, while the `_over`
    twin IS consumed (`coachTurnController.ts:2261`). **His ceilings refuse; his
    floors do nothing.**
    **BUILD:** the floors get the same weight as the ceilings, with the
    early-off-season and bye-recovery exemptions his text already names.
    **PROVE IT:** a week with 0 running days must not ship green. 17 QA either
    side.

41. **CENSUS C6 — DELOAD IS OWNED BY THE WEEK, WHICH SAM'S OWN LAW FORBIDS.**

    **OWNED BY `progression`.**
    **PREMISE VERIFIED AND THE DEFECT IS MEASURED — `progression`, 2026-08-13.**
    `resolveDayDirective` really does have ZERO callers (one grep hit, its own
    definition). A Thursday declaration, law vs live: **3 days RETRO-DELOADED
    (Mon-Wed, already trained or planned when he declared) and 3 days DROPPED
    (the following Mon-Wed ship at full load).** Table in
    `docs/STATUS_PROGRESSION.md`. **The build is NOT started** — it moves
    generated output and owes scenarios+qa either side, and item 34 bars starting
    a generation change at the tail of a session. All three files verified FREE.
    **⚠ AND THE PRESCRIBED BUILD IS NECESSARY BUT NOT SUFFICIENT — traced before
    building against it.** *"The week mode is DERIVED from it"* still yields a
    WEEK-shaped deload, which is the defect. The chain is week-shaped end to end:
    `weekDeloaded` -> `doorDeload` (`generateProgram.ts:606`) -> `deloadDoor`
    (`:730`, `:932`) -> `resolveDoorDeloadPolicy` (`defaultProgram.ts:1677`) ->
    a `DeloadWeekPolicy`. **The DOSE is resolved once per week.** A window
    starting on a Thursday needs the POLICY resolution moved inside the per-day
    loop — which lands on R-034's owner, whose transformation is stated per WEEK.
    **So this is an ARCHITECTURE call, not a wiring one**, and the escalation
    rule says produce the reassessment before writing more code. The small blast
    radius at the top (`doorDeload` has two uses) is exactly what makes it read
    as a one-liner. **Next session starts at that decision, not at the wiring.**
    **REGISTRY-GREP:** `RULINGS_REGISTRY.md` for *deload*, *cooked*, *readiness*
    — R-017 (the 7-day rolling window) is AUTHORED and BUILT at the fact level.
    **Nothing to ask Sam.**

    **THE DEFECT:** `resolveDayDirective` (`readinessIllnessLaw.ts:201`), whose
    own comment calls it *"The single read point for both doors"*, has **ZERO
    callers** — one grep hit, the export itself. The live owner is week-granular
    (`generationConstraints.ts:182-183` → `generateProgram.ts:551`), so a
    Thursday "wrecked" call retro-deloads Monday to Wednesday and drops off at
    Sunday. **Bible `:4960` says a week-granular owner can only honour a rolling
    window by snapping it to weeks — "the exact behaviour the law rules out".**
    **BUILD:** the day directive becomes the read point; the week mode is DERIVED
    from it. **PROVE IT:** a Thursday declaration leaves Mon-Wed untouched and
    reaches the following Wednesday.

42. **BLOCKED-BY: other-agent — CENSUS C8. PREMISE VERIFIED 4/4 BY `desktop`; THE
    BUILD WAITS ON THE GOLDEN'S OPEN REGRESSION.**

    **All four claims re-located and confirmed** (the item's line numbers had
    drifted), **plus a fifth: the contrast row's own note says *"straight after
    your heavy set"* while `exerciseOrder: 0` places it before every lift.** Full
    table in `docs/STATUS_DESKTOP.md`.
    **THE BLOCK IS MEASURED:** all four edits move `test:power-counting`'s golden,
    which currently holds an unresolved REGRESSION (~14 of 289 diffs = an athlete
    losing three single-leg/calf rows to a zero-row mobility session, proven at
    `ad140f56`). **A fifth cause in that golden makes none of them readable.**
    Unblocks the moment the session flip is settled and the golden re-recorded.

    **OWNED BY `desktop`.**
    **REGISTRY-GREP:** `RULINGS_REGISTRY.md` for *contrast*, *superset*,
    *pairing* — Bible `:225` defines it and R-015 covers mobility pairing only.
    **Nothing to ask Sam.**

    **THE DEFECT:** `buildPowerRow` (`defaultProgram.ts:1531-1559`) sets no
    `supersetGroup`, no `supersetOrder`, no `pairType` — the only difference
    contrast makes is a notes string. `workoutCanonicalisation.ts:791-796` then
    **actively strips** any `pairType === 'contrast'`, and `:822-827` sorts power
    rows to the top, ahead of the main lift. `powerRowAlignment.ts:99` checks
    only same-FAMILY, so "heavy deadlift + vertical jump" passes.
    **Sam's rule:** a heavy lift supersetted with an explosive lift **of the same
    pattern**, at the MAIN slot. **The rendering already exists and is idle** —
    same built-and-disconnected shape as the mobility pairing.
    **PROVE IT:** a contrast day ships one paired block at the main slot, same
    pattern both halves. Mutation: break the pattern match, cell reds.

43. **CENSUS C10 — THE LOCK ON A GUESSED STRENGTH CUT.**

    **OWNED BY `audit`.**
    **REGISTRY-GREP:** R-073 — Sam ruled *"that sounds shit and not good"*, and
    the row records the defect **does not reproduce** (28 weeks, 7 worlds, zero
    unexplained shortfalls). **Nothing to ask Sam. This is the LOCK, not a fix.**

    **WHAT IS MISSING:** nothing PREVENTS an inferred cut. The only producer
    (`section18SafetyPolicy.ts:311-318`) fires on
    `availableSafePatterns.length === 0` — an inference that never asks whether a
    day remained. His 2026-08-06 ruling gives the shape: the same
    `not_attempted | substituted | exhausted` proof equipment has, *"proof, never
    inference"*. **And the number proving a week fell short is already computed
    every week and simply not used.**
    **PROVE IT WITH A MUTANT:** re-introduce an inferred cut and the cell must
    red. A green suite over a defect that does not reproduce proves nothing.


39. **BLOCKED-BY: other-agent — SPRINT CAP, R-079. Owner named in its own text
    (TERMINAL) and that seat is live.** Marked by `audit`, not claimed, nothing
    below the head line edited. Reason: a second seat entering a fresh ruling
    registers it twice, and this item already reserves R-079.

31. **BLOCKED-BY: other-agent — ALL THREE PARTS VERIFIED BUILT by `audit`;
    only ARCHIVAL remains and that is the SEAT's edit. COD WINDOW + CHRISTMAS
    BREAK CONTROL — SAM RULED 2026-08-13.**
    Verified part by part: the two December questions have TWO production
    readers; Bible `:1440` carries his ruling verbatim; QA S7 is re-phased to
    Pre-season (not retired, so its three-team-day coverage survives).
    **Nothing owed to Sam, nothing owed in code.** Receipts:
    `docs/STATUS_AUDIT.md`.

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

13. **STANDING, EVERY STOP — KEEP THE UNENFORCED LAW COUNT FALLING.** Full
    text, the priced routes and the refutations:
    `docs/SEAT_ORDERS_PARKED_FULL_2026-08-13.md`.
    ~~**The truth is `grep -c "state: 'UNENFORCED'" src/rules/lawRegistry.ts`**~~
    ~~— the terminal has miscounted this twice, both times one low.~~
    **⚠ THAT INSTRUCTION NAMES THE WRONG INSTRUMENT, AND IT HAS BEEN SENDING
    EVERY SEAT ONE HIGH. Measured by `audit`, 2026-08-13:**

    | instrument | number | unit |
    | --- | --- | --- |
    | `grep -c "state: 'UNENFORCED'"` | **28** | textual occurrences |
    | `test:law-registry` | **27** | rows in `LAW_REGISTRY` |

    **✅ AND IT IS NOW A GATE, NOT A NOTE — `55cf3420`, and the COUNT FELL 27 →
    26.** A written correction in a queue file is exactly the thing this repo has
    proved does not hold (*"WRITTEN ORDERS DO KIND OF JACK SHIT … ONLY THINGS
    THAT ARE BUILT AND SET IN STONE ACTUALLY CHANGE HOW THEY BEHAVE"*), so
    **`LAW-count-names-instrument` is no longer `UNENFORCED`** — its founding
    case is this very instruction. The cell holds an **IDENTITY**, not an
    inequality: `occurrences − distinct === type-declaration lines`. It reds when
    a NEW non-row occurrence appears, refuses to run vacuously, and is
    **mutation-checked both ways** (dropping the accounting term reds it; a stray
    non-row mention reds it). **The numbers in the table above are now 27 and 26
    — kept as measured so the correction stays legible.**
    **PARTIAL BY CONSTRUCTION AND THE ROW SAYS SO:** it gates THIS count only. A
    report elsewhere printing one number without naming its instrument is still
    uncaught, which is the general form `wouldTake` asked for and this is not.

    **The 28th is `lawRegistry.ts:108` — the TYPE DECLARATION** (`readonly state:
    'UNENFORCED'` in the `LawGuard` union), which is not a law and never was.
    **So the gate's 27 is the truth and the grep is one HIGH** — the opposite of
    what this line says, which is why "miscounted, both times one low" reads the
    way it does: those reports were quoting the gate at a line insisting on the
    grep. **`LAW-count-names-instrument`, and the instruction itself was the
    carrier.** Use `npm run test:law-registry` — it prints
    `LAW REGISTRY: <rows> rows, <n> guarded, <n> UNENFORCED` and it counts ROWS.
    **RE-MEASURED THIS STOP: 124 rows, 97 guarded, 27 UNENFORCED.** The count did
    not fall — `LAW-mas-percent-names-a-pace` entered GUARDED (`8bf8548b`), so
    rows went 123 -> 124 and UNENFORCED stayed put.
    **Four laws remain priced and each names why it is hard:**
    `LAW-green-gate-is-a-claim` (needs standing mutation testing),
    `LAW-L9-checkpoint-discipline` (reds on arrival, needs a from-here cutoff —
    a process decision imposed on other agents),
    `LAW-attributed-content-change` (reproduces only on a real accepted base),
    `LAW-L6-honest-actions` (structural).

21. **BLOCKED-BY: other-agent — THE NUMBER IT SHARED WITH ITEM 25 IS VOID, AND
    WHAT IS LEFT NEEDS NO RULING.**

    **MARKED BY `audit`, 2026-08-13, ON THIS ITEM'S OWN SENTENCE.** It ends
    *"Same root cause, same fix — session size derived from the authored policy
    … Do not build them apart"*, and item 34 says *"Census C7, A4 and session
    size are ONE unit"*. **34 is marked to the terminal, which reports itself
    live on it. So this is the same unit under another number and it goes with
    its owner. Nothing is owed to Sam — R-014 already withdrew the only question
    that pointed at him.**

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


26. **BLOCKED-BY: other-agent — THE ⚠ HALF IS BUILT — HIS 2-3 PAIRS SURVIVE THE
   VALIDATOR NOW.**

   **MARKED BY `audit`, 2026-08-13, AND THE BLOCK IS A SEQUENCING ONE, NOT A FILE
   HOLD** — `classifyGeneratedWorkoutRow` and its four callers are all FREE
   (cmp-verified against `HEAD`, not `git status`). **This item's next act —
   teaching that classifier to read the authored role, which it cannot today
   because it has no `role` parameter at all — MOVES `test:power-counting`'s
   golden BY DESIGN.** That golden is mid-investigation by the terminal seat and
   **now carries THREE unattributed diff classes** (`overBudgetProbe.powerDays`,
   `keptFamilies`, `taxonomy` — 14 diffs, found only once the collection cap was
   raised 200 → 5000 and the true total turned out to be **291, not 201**).
   **Adding a fourth cause before those three are named would make none of them
   readable, and the golden is the only instrument that would catch this item's
   own regression.** Unblocks the moment that golden is attributed.
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 26).**

27. **CLOSED BY R-078 — SAM RULED *"leave it"*. THE "CAN FIRE" PARAGRAPH BELOW
   IS NOT PERMISSION. C1's MECHANISM IS NOW EXACT, AND ONE OF ITS CONCLUSIONS
   IS OFF-SEASON-ONLY — `audit`, 2026-08-13. C1 AND 28-C1 ARE ONE DEFECT.**
   **CITES R-078** (`5105b634`). I wrote the analysis below and I am closing it:
   it ends by noting pre-season has room, he was shown that arithmetic, and he
   said leave it. **Held by 4 cells in `test:standalone-conditioning-ownership`,
   mutation-proven — a fifth attempt reds in thirty seconds.**

   **CONFIRMED, INDEPENDENTLY:** C1's *"COD appears every time… on day 3 ranked
   SECOND"* reproduces exactly — I measured `out=["aerobic_base","cod_decel",
   "tempo"]` among 8 shapes over 189 calls. **`first-match-wins` + an
   always-allowed `aerobic_base` above it is the refusal, exactly as C1 says.**
   **⚠ WHAT C1 COULD NOT KNOW, AND IT CHANGES WHERE THE FIX GOES:** the rank is
   **NOT settable from the pool.** Promoting `cod_decel` to FIRST in
   `autoPlacementCategories` leaves `out` **byte-identical**, because
   `pickPlacementCondCategories` **PASS 1** orders from `categoryPriority` /
   `zonePriority` — **neither of which contains `cod_decel`** — and
   `pushUniqueCategory` appends. **`autoPlacementCategories` sets MEMBERSHIP,
   never ORDER.** C1 says *"the fix is placement, not rank"*; it is truer than it
   knew — rank is not even reachable from there.
   **⚠ AND "THERE IS NO SPARE ROOM" IS OFF-SEASON-ONLY.** C1 measured off-season
   (6 days, 6 workouts, ZERO rest) and concluded *"COD can only enter by
   SUBSTITUTION"*. **Pre-season with no club — which 28-C1 named as the LIVE case
   — has `standalone=11`, `combined=0` and 12 EMPTY DAYS across 4 weeks.** So in
   the live case **Sam's literal *"place if there is room"* CAN fire**, and the
   substitution-only conclusion does not carry over. **Neither measurement is
   wrong; they are different phases, and only one of them is the live case.**
   **Full tables and the reverted-instrument receipt: `docs/STATUS_AUDIT.md`.**

   ~~A1 AND B1 ARE FIXED (`0cb3f771`, `c3f3410e`). C1 IS SCOPED AND STOPPED —~~
   **Full report archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 27).**

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

- **⚠ NEW 2026-08-13, terminal — A BODYWEIGHT LEG DAY SHIPS THE SAME SQUAT
  TWICE. When there is no other legal exercise, does the app REPEAT it, DROP it,
  or SHIP THE DAY SHORT?**

  **REGISTRY-GREP:** grepped `RULINGS_REGISTRY.md` for *duplicate*, *two squats*,
  *equipment*, *bodyweight*, *substitut*, *repeat*. **R-019 and R-072 are the
  equipment SCOPES (what a change applies to) and say nothing about what happens
  when a substitution runs out of options. *"two squats"*, *"bodyweight"*,
  *"substitut"* and *"repeat"* return NOTHING.** R-014 rules that a session is
  judged by PATTERN COVERAGE, which is what makes this a defect at all — but it
  does not say which of the three answers is right. **A gap, not a re-ask.**

  **WHAT SHIPS TODAY** (bodyweight only, off-season, 4 days):

      "Lower Squat"  Bodyweight Squat · Glute Bridge · Bodyweight Squat ·
                     Single Leg RDL · Leg Extension · Back Squat

  **The same exercise printed twice, and three squat-pattern rows on one leg
  day.** Traced: with bodyweight equipment the squat pool filters to almost
  nothing, so `Reverse Lunges` and `Back Squat` BOTH rotate to `Bodyweight
  Squat`. The app's within-session "don't repeat" rule then has nowhere else to
  go and returns the same name again. **Not caused by anything built today — it
  is older, and control-proven.**

  **WHY IT IS YOURS AND NOT MINE:** all three answers are defensible and they
  give the athlete different weeks.
  1. **REPEAT** — he gets the volume, and two sets of bodyweight squats is not
     absurd for a home week.
  2. **DROP** — a shorter, cleaner day. Matches *"the number of exercises is not
     important the total work being done evenly across the body is"*.
  3. **SHIP SHORT AND SAY SO** — the day is short because his kit cannot fill it,
     and the app tells him rather than padding.

  **WHAT TO SEND — one line:** *"repeat it"*, *"drop it"*, or *"tell me the day
  is short"*.

  **NOT BLOCKING.** The oracle already detects this (`sessionSlotCoverage`
  returns `duplicated: ['squat']`); what is missing is the ANSWER it should act
  on.

- **⚠ NEW 2026-08-13, terminal — DOES A TEAM NIGHT *COUNT AS* YOUR SPRINT, OR
  DOES IT *EARN* ONE ON TOP? Your R-079 and the app disagree, and both readings
  are defensible.**

  **REGISTRY-GREP:** grepped `RULINGS_REGISTRY.md` for *sprint*, *target met*,
  *anchor*, *team night*, *flying*. **Returned R-007, R-062, R-079** — R-007 is
  the hard-day budget, R-062 unrelated, and **R-079 is my own row from today,
  which rules the UNIT (nights) and the per-phase NUMBERS but never says whether
  the club's own session IS the exposure.** *"target met"* and *"team night"*
  return NOTHING. **This is a gap, not a re-ask.**

  **THE DISAGREEMENT, MEASURED:** you ruled *"in pre season you can do flying
  sprints when there is team training because you will get accelerations at
  footy"* — the club gives accelerations, the app adds top-end. **I built that
  (`0d4824df`) and it changes nothing**, because `sprintExposureGate` answers
  `preseason_target_met` first: `anchorSprintCodExposures >= target`, i.e. **the
  team night is already counted as your sprint for the week, so the app refuses
  to add more.** Your ruling says add; the gate says you already have one.

  **AND IT IS THE SAME QUESTION UNDER THE SECOND GAP:** an athlete with **no
  club, in-season** gets ZERO sprint work. Their week requires 1, correctly
  raises a BLOCKING shortfall, and **the only code that could place a sprint does
  not run in-season at all** — because in-season sprint is treated as the club's
  job. For a club athlete that is right. For this athlete nobody wrote the case.

  **WHAT TO SEND — one line each, and either answer is buildable:**
  1. *"a team night IS my sprint"* (the gate is right; your pre-season flying
     sprints need a different door, and my inert change comes out), **or**
  2. *"a team night EARNS a sprint on top"* (the gate stops counting anchors
     against the target in pre-season, and the change I already landed starts
     working).
  3. And for the no-club athlete: *"in season with no club, give them sprints"*
     or *"leave it — that is what a club is for"*.

  **NOT BLOCKING.** The unit, the numbers and the cells are built and green;
  only these two doors wait.

- **✅ ANSWERED AND CLOSED 2026-08-13 — SAM RULED *"leave it"*. REGISTERED AS
  R-078 AND HELD BY A CELL IN THE SAME COMMIT.**

  **CITES R-078** (this question's own answer). **He chose option 1: zero COD in a
  tight no-team-training week is CORRECT, not a defect** — *"low selection
  priority"* is his own Bible line and he kept it, knowing the alternative was one
  `tempo` session giving up its slot. **Nothing was built, because the answer was
  DO NOTHING** — `coachingEngine.ts` is byte-identical to `HEAD` and both attempted
  fixes are reverted.
  **THE CELL IS THE POINT, NOT THE ROW.** `test:standalone-conditioning-ownership`
  now carries 4 R-078 cells — the gate PERMITS the world, the pool is non-empty,
  the week really does place conditioning, and COD is still zero — because this
  item was "fixed" and reverted FOUR times and a ruling with no gate gets
  re-litigated. **Mutation-proven: forcing `cod_decel` to the front of the
  candidate list reds it at `cod: 6`.**

  ORIGINAL QUESTION BELOW.
  - **⚠ 2026-08-13 — COD/DECEL CAN ONLY APPEAR BY TAKING ANOTHER SESSION'S
  SLOT. WHICH ONE IS PROGRAMMING CONTENT, AND `LAW-L7` MAKES THAT SAM'S.**

  **REGISTRY-GREP:** `docs/RULINGS_REGISTRY.md` for *displac* (**0**), *which
  category* (**0**), *aerobic base* (**0**), *must-cover* (**0**), *cut first*
  (**0**), *substitut* (3), *swap* (6), *replaces* (2). **The 11 hits were read,
  not counted** — every one is exercise-pool variant swapping (`Face Pulls`,
  `Single Leg RDL`) or the AWAY substitution ruling. **NOTHING rules what a COD
  session displaces.** Not a re-ask.

  **HIS OWN WORDS ALREADY IN THE BIBLE:** *"AVAILABILITY GATE, no-team-training
  weeks only, **LOW selection priority** — the whole COD/Decel row."* **The app
  obeys that exactly, and that is the problem.**

  **THE MEASUREMENT THAT MAKES IT A QUESTION** (pre-season, no club, 4 weeks):
  **2.0–2.75 conditioning slots per week** against **3–4 categories**. A slot goes
  to the first allowed candidate, so with COD ranked last **something else is
  always still uncovered when the last slot is filled.** **"Low priority" and
  "prescribed" cancel exactly: COD is placed ZERO times, and no reordering that
  keeps it last can change that.** Measured, and both cheap fixes are refuted —
  raising its urgency changes nothing, because urgency is not selection.

  **SO THERE ARE ONLY TWO HONEST ANSWERS, and both are his:**
  1. **LEAVE IT.** *"Low priority"* means it genuinely does not appear when the
     week is this tight. **Then the app is already correct and this item closes.**
  2. **IT MUST APPEAR** in those weeks — which means **one session of something
     else loses its slot.**

  **RECOMMENDATION, WITH THE NUMBERS RATHER THAN A BARE QUESTION: option 2,
  taking ONE `tempo` session.** Measured split in a permitted week is
  **`aerobic_base` 4 · `tempo` 5 · `vo2` 2** across 4 weeks. **Tempo is the
  largest block, so it is the smallest relative loss**, and it leaves the aerobic
  base and the two hard `vo2` sessions untouched — which matches his off-season
  guidance (*"aerobic capacity as the base… a mix of stimulus… not all aerobic
  base"*).

  **WHAT HE WAS ASKED, in his own terms:** *"In weeks with no team training, the
  change-of-direction work never actually gets scheduled — there's only room for
  about 2-3 conditioning sessions and it's always last in the queue. To make it
  show up, something else has to give up a spot. I'd take it off tempo. Or say
  the word and I'll leave it as is."*
  **NOT BLOCKING** — the app is defensible either way; option 1 closes the item.

- **ANSWERED AND CLOSED 2026-08-13 ✅ — SAM RULED IT: *"finished items are being
  filed by the seat"*.** The status quo option wins: the seat files a finished
  item out as a routine step, and items 1 and 13 are NOT marked. **Do not re-ask,
  and do not add a "done" escape to the hook — he chose the other answer.**
  Verified rather than assumed: items 7, 28, 29, 33, 36 and one 37 are out of the
  queue and present in `docs/SEAT_INBOX_COMPLETED_2026-08-13.md`.
  Original below.

  ~~**⚠ NEW 2026-08-13 — A FINISHED ITEM KEEPS THE QUEUE ALIVE, AND THAT COST HIM
  MOST OF A TURN TODAY. ONE SMALL PROCESS RULING.**~~

  **REGISTRY-GREP: no row governs this.** Grepped `RULINGS_REGISTRY.md` for
  *inbox*, *queue*, *hook*, *processed*, *done*, *stop*. Every hit is a ruling
  ABOUT something (R-005 session lock, R-008 the parked moderate day, R-030
  complexity) or a mention of `SEAT_INBOX` inside another row's receipt. **There
  is no ruling on queue hygiene at all**, which is why this is a question and not
  a re-ask.

  **THE MEASUREMENT, taken by running the hook's own scan by hand:** the seat hook
  reads item HEAD lines under `## Unprocessed` and walks past only two things —
  `BLOCKED-BY: {sam|other-agent|external}` and the word *parked*. **It has no way
  to say DONE.** So a finished item keeps counting as a live order until someone
  physically moves it out of the file. Today the scan landed on **item 36 — mine,
  paid, `test:away-flow` 46/0** — and then on **33 (BUILT)**, with **32, 31, 25,
  26, 27, 28, 29 and 7 all finished and all still in the queue behind it.**

  **AND EXIT 1 IS STRUCTURALLY UNREACHABLE ANYWAY:** items 1 and 13 say of
  themselves *"STANDING, EVERY STOP … they are not work items to clear"*. They
  carry no marker, so the scan will always find them. **The queue can never be
  empty by design.**

  **I MOVED ONLY MY OWN (item 36 → `SEAT_INBOX_COMPLETED_2026-08-13.md`, verbatim)
  and left the rest alone**, because moving another agent's item is a seat edit
  and the one-writer rule is what stopped three of my commits swallowing other
  people's work today.

  **⚠ AND I DELIBERATELY DID NOT ADD A "DONE" ESCAPE TO THE HOOK**, though it is
  four lines. The hook's own comments record that exact door being opened and
  closed twice (`docs(stop):`, then `docs(blocked):`) because it became the hole.
  **A terminal widening the gate that governs it is the rubber-stamp shape those
  comments warn about, so it is his call and not mine.**

  **THE QUESTION:** should finished items be moved out by the seat as a routine
  step (status quo, costs a seat pass), or should STANDING items 1 and 13 be
  marked so the scan walks past them and "queue clear" becomes reachable?

- **ANSWERED AND CLOSED 2026-08-13 ✅ — SAM RULED IT AS R-077: *"away keeps the
  bye's 2 lifts"*. R-069(2) WINS.** An away week is not a rebuild of the three gym
  days it replaced and the missing lifts are not chased; he accepted training less
  BECAUSE he can add a session back.
  **⚠ SCOPE, so nobody over-reads it: R-075 IS NOT OVERTURNED** — the conditioning
  replacement stands and ships (`freedByTheTrip`, `c8702c56`). Away replaces the
  club's work in KIND; it just does not chase the lifts.
  **VERIFIED BY `pace`, NOT BELIEVED:** the answer was DO NOTHING and nothing was
  done — no commit touches `coachingEngine.ts` for R-075/R-077, the three
  placement attempts stay reverted, `freedByTheTrip` is still live, and the escape
  hatch is held by `test:away-flow` [17e]/[17f]/[17g] with the suite at **49/0**.
  **Do not re-ask.** Original below.

  ~~**⚠ NEW 2026-08-13 — R-075 AND R-069(2) CONTRADICT EACH OTHER, AND ONLY SAM CAN
  SAY WHICH WINS. THIS IS WHY ITEM 37's STRENGTH ARM IS `BLOCKED-BY: sam`.**~~

  **REGISTRY-GREP: R-069, R-075, R-006, R-007, R-009, R-074.** Grepped
  `RULINGS_REGISTRY.md` for *bye*, *two main*,
  *strength exposure*, *main strength*, then re-grepped for every row the ask
  gate flagged. Returned **R-069** — the five locked decisions of 14 July 2026,
  whose clause (2) is ***"bye recovery is exactly 2 lighter lifts"*** — plus
  **R-006**, **R-007**, **R-074** and R-075 itself. **R-069(2) is the ruling the
  code is obeying**, so this is not a defect and not a re-ask: it is two of his
  own rulings pulling opposite ways.

  **THE THREE THAT DO NOT SURVIVE THE OPEN, said rather than skipped:**
  - **R-007** (*"4 hard days plus 1 moderate/easy day is prefered but 5 hard days
    is okay"*) — **NOT BREACHED, and this is the one that could have been.** The
    replacement is the Gunshow: an OPTIONAL arms/pump day carrying
    `isHardExposure: false`. **It adds a SESSION, never a hard day**, so the 4+1
    shape is untouched whichever way he rules.
  - **R-074** (the 4-5 min set/block cap) — conditioning selection only. Nothing
    here touches a dose or a work interval; the phrase overlap is *"block"*.
  - **R-006** (1-2 full rest days, 3 on bye-recovery weeks) — **gives the room
    rather than blocking it.** The away week reaches 3 rest days against a
    required 1, so using one is inside his own bounds. It is not what stops the
    replacement; the 2-lift bye shape is.
  - **R-009** (*"should give warnings but allow them to do whatever they want"*) —
    matched on the word *permit*. **It is about refusing the ATHLETE and this
    question refuses nobody**; it asks what the app should PLAN. No overlap.

  **THE CONFLICT, in one line each:**
  - **R-069(2):** a bye week is **exactly 2** main strength exposures.
  - **R-075:** *"Away has to replace the work it removes, not just delete it."*

  **AND AWAY IS BUILT AS A BYE ON HIS OWN INSTRUCTION** — *"the period you're away
  should almost look like a bye week build"*. So a trip inherits the 2-lift bye
  shape, while the week it replaced had 3 gym days plus the Gunshow.

  **MEASURED, NOT ASSERTED:** across a block, home 20 strength sessions vs away
  16. The bye allocator places 2 by design (its own comment: *"Healthy bye: two
  main strength exposures"*), the contract asks 3, and a repair stage covers the
  third by **consuming any optional session it finds** — which is why three
  separate attempts to hand back the Gunshow were each eaten. Full trail in
  `docs/STATUS_DESKTOP.md`.

  **THE QUESTION FOR HIM, and it is a product ruling, not a bug report:** *when
  he is away, does the week keep the BYE's 2 lifts, or does it owe him the same
  number of gym sessions he would have had at home?*

  **NOT BLOCKING THE REST OF ITEM 37** — the day half is built and on glass (a
  vacated Saturday reads *"Conditioning — 2 exercises"*), and the conditioning arm
  of his own arithmetic already holds one-for-one. **Only the strength count waits
  on this.**

- **ANSWERED AND CLOSED 2026-08-13 ✅ — SAM RULED IT AS R-076: *"face pull is
  shoulder work for sure"*.** It leaves the horizontal-pull pool and stops being
  interchangeable with a row.
  **VERIFIED BY `pace`, NOT BELIEVED** — `exercisePoolsStrength.ts`: `Face Pull`,
  `Rear Delt Fly`, `Band Pull-Apart` and `Cable Face Pull` all sit in the
  `isolation_upper/accessory` **Shoulder / trap block** with the ruling cited
  inline, and `horizontal_pull/accessory` now holds only `Seated Cable Row`,
  `Chest-Supported DB Row` and `Inverted Row` — **no face pull anywhere in it.**
  **⚠ WHAT HIS RULING DOES NOT CLOSE, and R-076's row says so:** the lookup fix
  is still refuted for a NEW reason — `isolation_upper/accessory` is ONE
  undifferentiated pool holding bicep, tricep AND shoulder blocks, so rotation
  there can still ship three bicep curls and no triceps. **Sub-grouping that pool
  is the next unit. That is not a question for him.** **Do not re-ask the face
  pull.** Original below.

  ~~**⚠ NEW 2026-08-13, terminal — IS A FACE PULL A BACK EXERCISE OR SHOULDER
  WORK? The app currently says BACK, and that is what spoils a session.**~~

  **REGISTRY-GREP:** grepped `docs/RULINGS_REGISTRY.md` for *Face Pull*,
  *rear delt*, *arm_or_shoulder*, *shoulder*, *accessory*, *tag*,
  *interchangeable*, *swap*. **Only `accessory` hit, once — R-015, which is the
  mobility-superset ruling and says nothing about which exercises may substitute
  for each other.** R-014 quotes his ladder (*"arm work or accessory work for the
  shoulders"*) and that DID settle which SLOT a face pull fills — already built,
  not being re-asked. **What is unruled is INTERCHANGEABILITY, and no row covers
  it.**

  **WHY IT IS NOT A NAMING NICETY — MEASURED, 3 worlds x 3 weeks.** The pools
  file `Face Pull` as `horizontal_pull/accessory`, in the same list as
  `Seated Cable Row`, so the app treats them as swappable. It also cannot match
  the name the generator ships (`Face Pulls`), and that MISS is currently the
  only thing stopping the swap. Close the miss — which is otherwise plainly
  correct — and rotation immediately ships:

  | before | after |
  | --- | --- |
  | `Pull-Ups \| Barbell Row \| Face Pulls` | `Pull-Ups \| Barbell Row \| Seated Cable Row` |
  | `… Bicep Curls \| Tricep Pushdowns …` | `… Bicep Curl (Barbell) \| Bicep Curl (Dumbbell)` |

  **The pull day loses its shoulder work for a second row; the arm work becomes
  two bicep curls and no tricep** — his own "two squats" shape in arm form. **The
  fix is REFUTED and backed out (`faa69c2f`); the lookup miss is load-bearing
  until the pool membership is decided.**

  **WHAT TO SEND — one line, either is actionable:** *"face pull is shoulder
  work"* (it moves out of the horizontal-pull pool and stops being swappable with
  a row), or *"face pull is a back exercise"* (it stays, and the arm/shoulder slot
  must be filled by something else). **If he does not care, the terminal will take
  shoulder work** — it is the reading his own ladder sentence supports and the one
  that keeps a pull day balanced. **NOT BLOCKING: the composer work continues
  either way; only the lookup fix waits on this.**

- **⚠ THE ACUTE HALF IS RESOLVED WITHOUT HIM — 2026-08-13. THE SECOND `audit`
  WAS ME, AND I HAVE TAKEN MY OWN NAME.**
  I was told to rename `STATUS_AGENT3.md`, found it already renamed to
  `STATUS_AUDIT.md` by another seat, and **adopted that seat's name instead of
  taking one of my own** — then wrote my findings into their status file. **That
  is the whole of the collision this question measured.** I am now `Agent: pace`
  with `docs/STATUS_PACE.md` (`cfbb7184`), which is the LANE-NAME shape this
  question itself recommends and the fourth seat had already adopted
  (`Agent: progression`). **The commits already on `main` stay mis-stamped —
  rewriting history in a checkout three seats commit into is worse than a wrong
  label — and `STATUS_PACE.md` names them.**
  **SO NOTHING IS BROKEN TODAY.** What is left for him is only whether a naming
  RULE should exist, and two seats have now taken lane names unprompted without
  one. **If that reads as settled, close this row rather than sending it.**
  Original below.

  ~~**⚠ NEW 2026-08-13 — THE COMMIT STAMP HE ORDERED THIS MORNING IS ALREADY
  AMBIGUOUS: TWO SEATS ARE WRITING `Agent: audit`.**~~

  **REGISTRY-GREP:** grepped `docs/RULINGS_REGISTRY.md` for `Agent:`, *agent
  name*, *attribution*, *stamp*, *seat name*, *one owner*, *ownership*, *naming*.
  **Returned NOTHING on agent identity** — `naming` (5) is all exercise-name law
  (R-027 *"athlete-facing words are never invented by an agent"*), `ownership`
  and `stamp` (1 each) are program-ownership and provenance. **No row governs
  who may use which agent name, so this is a gap, not a re-ask.**

  **HIS ORDER, 2026-08-13:** *"you're not labelling your commits, so nobody can
  see what you've done. From now on end every commit message with `Agent: <name>`
  — pick a name for what you do."*

  **⚠ UPDATED 12:2x — THE NUMBER HAS DOUBLED IN FORTY MINUTES.** It is now **20
  commits** ending `Agent: audit`, against `terminal` 61 and `desktop` 33.
  **This seat authored eight of the twenty.** A fourth seat has since done the
  right thing unprompted and taken a LANE name — `Agent: progression`
  (`docs/STATUS_PROGRESSION.md`), which is the shape being recommended below.
  **Left as the original measurement plus this update rather than overwritten,
  because the RATE is the argument: a shared stamp does not stay a small problem.**

  **MEASURED, NOT SUSPECTED.** Ten commits ended `Agent: audit` when this was
  written. **Eight are
  this seat's** (`4794a18a`, `d15b1a3f`, `c802a08a`, `15d32ef2`, `63fe3fba`,
  `b19109d4`, `d7953e9d`, `9c865a84`). **`8bf8548b` and `569c27b4` are not** —
  they are the MAS / census-C2 work and they create `src/rules/masPace.ts`, which
  this seat has never opened.

  **HOW, AND IT IS INNOCENT:** `docs/STATUS_AGENT3.md` was renamed
  `docs/STATUS_AUDIT.md` at 11:34 with the new stamp written into it; a seat
  working from the old filename picked the name up out of that file 14 minutes
  later. **Nobody impersonated anybody.**

  **IT HAS ALREADY MISFIRED TWICE, IN BOTH DIRECTIONS:**
  1. A paragraph on item 28-C1 credits `audit` with marking it blocked and
     withdrawing it. **This seat never touched 28-C1** — `git log
     --grep='Agent: audit' -- docs/SEAT_INBOX.md` returns exactly ONE commit,
     `c802a08a`, item 37 only. That paragraph entered in `9c2b7562`/`faa69c2f`,
     both `Agent: terminal`.
  2. Corrections this seat wrote were **absorbed into `1229ef0b`** — another
     seat's commit, also stamped `Agent: audit`. **Nothing was lost**, but the
     history now cannot say who wrote them.

  **WHY IT IS WORTH HIS THIRTY SECONDS:** every commit in this repo is authored
  `sg-screener`, so **git cannot separate the seats and the stamp is the ONLY
  attribution that exists.** A shared stamp is worth LESS than no stamp, because
  it reads as certainty. **This is precisely the thing he asked for, not working.**

  **RECOMMENDATION, so this is not a bare question:** the second adopter takes a
  new name — eight of ten commits, the status file, and the cross-session memory
  are already `audit`, and those cannot be re-stamped retroactively. **A name per
  SEAT, allocated once and written in the registry, beats a name per job.**
  **NOT BLOCKING ANYTHING** — work continues either way; only the record suffers.
  **This seat will not unilaterally take a second name.**

- **ANSWERED AND CLOSED 2026-08-13 ✅ — SAM RULED IT AS R-075, AND HIS ANSWER WAS
  "BOTH OF YOUR OPTIONS ARE WRONG".**

  **THE QUESTION WAS:** the vacated Saturday now reads *"Rest Day"* — would he
  rather it gave him an actual session? **HIS ANSWER, unprompted and closing it
  rather than picking:** *"Away has to replace the work it removes, not just
  delete it - your Saturday Rest Day is the wrong case. Don't ask me about it."*

  **SO THE ENTRY IS RETIRED, NOT ANSWERED-IN-PLACE.** Leaving it open is what
  `test:ruling-registry` [3] correctly reddened on: a question sitting under
  AWAITING SAM after its own ruling exists IS a re-ask, however well it was
  grepped when written. **R-075 is the row; the question is void.**

  **WHAT SHIPPED FROM IT:** the day half is BUILT and on glass (`c8702c56`) — a
  vacated Saturday reads *"Conditioning — 2 exercises"*, and a day that held
  nothing still reads *"Rest Day"*, which is his first rule unchanged. The
  strength arm of R-075 is open and carried on the row, not here.
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
15, 16, 19, 23 **and 36, 37, 28, 29**, moved out of the queue 2026-08-13 **verbatim, byte-identical,
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
