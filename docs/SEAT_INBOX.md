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


28-C1. **BLOCKED-BY: other-agent — ITS QUESTION IS VOID AND ITS REMAINING WORK
    IS THE TERMINAL'S, WHOSE FILES ARE OPEN RIGHT NOW.**

    **NOTHING IS OWED TO SAM HERE.** Item 31 part 6 dissolved the pending
    question in his own words — the five-day field-load streak came from a week
    with three team trainings, **which off-season cannot have**, so "protect COD
    from the cap or leave it cut" was asked about an impossible week. **DO NOT
    ASK HIM.** What is left is a RE-MEASUREMENT on a legal no-team-training week,
    and that is not a wall — it is simply not this seat's file.

    **THE BLOCK, MEASURED NOT ASSUMED (2026-08-13, desktop agent).** The four
    files that re-measurement touches — `src/rules/conditioningSelection.ts`,
    `src/data/defaultProgram.ts`, `src/utils/coachingEngine.ts` and
    `src/__tests__/weekPlanQA.ts` — are all `MM` in the shared checkout with
    changes this seat did not make. The item's own line says **OWNED BY THE
    TERMINAL**, and a second agent editing the same four files is how a commit
    absorbs work nobody meant to ship.

    **AND ONE THING IT WAS WAITING ON IS NOW PAID.** Item 31's *"the week fact
    itself is profile-derived until part 5's dated span exists"* is closed —
    part 5 landed and BOTH COD readers now see the week, measured at
    `test:christmas-break` `[11]`-`[11c]`. **So the legal week this item needs
    can now be built.** Details under item 31.

    ORIGINAL BELOW.
    **UNBLOCKED 2026-08-13 — SAM RULED IT; SEE ITEM 31, WHICH SUPERSEDES THE
    QUESTION BELOW.** He did not answer "protect COD from the streak cap"; he
    answered a better question — **WHERE COD IS ALLOWED AT ALL**: late
    off-season, the Christmas break, or pre-season with no team training, and
    **never in season**. The mark comes off because the ruling exists, not
    because the cap question was settled. **THE SEVENTH WALL IS FOUND, AND IT IS NOT WHERE
    ANY OF THE SIX LOOKED. COD IS BUILT END TO END AND IS CUT EVERY TIME, BY A
    RULE OF SAM'S OWN, DOING EXACTLY WHAT HE SAID.** Measured 2026-08-13; the
    probe this item asked for was run and every premise below it is refuted.

    **THE ONE QUESTION FOR SAM, and it is the only thing left:** COD reaches the
    athlete's plan correctly, with his own signed label, and is then **removed by
    the field-load streak cap — because standalone conditioning is the
    designated first thing cut, which IS his "cut first when something has to
    give".** On a real week the streak was **Monday–Friday, five field-load days
    against a cap of three**, so the cut was legitimate. **Result: COD placed 2
    times across 34 QA weeks and shipped 0.**
    **SO: should a COD session be protected from the field-load streak cap, or
    is "an athlete in a busy week never sees COD" the right answer?** Either way
    is one small change. **Nothing else about COD is open.**

    **THE MEASUREMENT, because three premises died with it.**
    - **REFUTED — "the block is upstream of eligibility, in the standalone
      caller's choice of kind".** `pickPlacementCondCategories` OFFERS
      `cod_decel` on every no-team-training week, and **offers it FIRST**
      (`codIndex=0`) on six of them. Pass 2 iterates the placement pool
      directly, so the pool is a source, not only a filter.
    - **REFUTED — "eligibility never sees `cod_decel` at all".** It sees it and
      **ALLOWS it**: `allow=true category=cod_decel downgraded=false`, at the
      real placement site, not just the scoring one.
    - **REFUTED — my own next hypothesis, before it became a finding.** I
      suspected `st.condCategories['cod_decel']` was `undefined`, making the
      uncovered test `undefined === 0` false. **It is initialised to 0**
      (`coachingEngine.ts:3361`). Recorded because it was wrong, not omitted.
    - **THE SESSION IS ACTUALLY BUILT:** pushed with
      `focus="Conditioning - Change of Direction/Decel"` — his tab name, the
      label 28-C1e fixed — and then demoted to *"Mobility, foam rolling, light
      movement"* with `conditioningCategory` cleared.
    - **THE OWNER:** `enforceFieldLoadStreak`'s `isBreakable`, whose own comment
      says it: *"Standalone conditioning is the most replaceable field-load
      day."* **COD can only ever BE standalone** — the attached slots correctly
      refuse a hard category — **so COD is always the first thing this cap eats.**

    **WHY SIX ATTEMPTS MISSED IT: they were all upstream of the push, and the
    removal is downstream of it.** The bisect took four probes: the count is 1
    after `optimiseStrengthLoadSequence`, 1 after `enforceWeekendPeak`, and 0
    after `enforceFieldLoadStreak`.
    **AND THE "COD = 0" NUMBER WAS ALWAYS TRUE OF THE RIGHT UNIT** — I checked,
    because four counts have been wrong this session. It is 0 on the ENGINE'S
    OWN OUTPUT OBJECT (`plan.weeklyPlan`, 34 weeks), not on printed text. My
    first attempt to count it from the report WAS a bad instrument, and the
    aerobic control showed only 2 of 4 pushes reaching print, so I stopped
    using it rather than report from it.
    **ALL INSTRUMENTATION REMOVED — `coachingEngine.ts` and `weekPlanQA.ts` are
    byte-identical to HEAD.**

    **BELOW IS THE EARLIER STATE, KEPT BECAUSE ITS SHIPPED LIST IS STILL TRUE.
    Its "one wall left" paragraph is the part now refuted.**
    Full history verbatim in `docs/SEAT_INBOX_COD_TRAIL_2026-08-13.md`.
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


30. **BLOCKED-BY: other-agent — THE TERMINAL IS INSIDE THIS ITEM RIGHT NOW.**

    **NOTHING IS OWED TO SAM.** He has already ruled the shape (bye-week build);
    what is left is engineering.

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

2. **BLOCKED-BY: other-agent — MAKE THE CHAIN CHEAP. MEASURED 2026-08-12, AND THIS ITEM'S OWN DIAGNOSIS
   WAS WRONG.** `docs/STOP_2026-08-12_WALKER_TIMING.md`. **Sam, 2026-08-12:**
   *"i want to know how long that 192 tests are taking and if it's really
   necessary"*.

   **THE BLOCK, PRECISELY, 2026-08-13:** every remaining route on the 89s suite
   is a real fix in the two §18 files, and this item already records them as
   **mid-flight with another agent**. Re-checked today rather than taken on
   trust — `coachingEngine.ts` still carries that seat's uncommitted probes and
   two type errors. **NOTHING IS OWED BY SAM. It clears when those files are
   clean; the priced routes are in
   `docs/STOP_2026-08-12_ACCEPTED_STATE_TRANSACTIONS_COST.md` and the six
   expensive cells are named below.**
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
   - **PAID 2026-08-13 — AND LOOKING AT IT FOUND AN ATHLETE-FACING PROBLEM, NOT
     A TEST ONE. THIS IS THE HEADLINE, NOT THE TIMING.**
     **THE SUITE:** 87.4s, 43 assertions, green. **The cost is not spread —
     5 of 43 tests are 76.4s of it (82%)**, and the top 6 are ~90%. Nothing is
     wasted setup: `generate()` is 12-17ms every time.
     **ONE FUNCTION IS THE WHOLE BILL, AND IT IS PRODUCTION CODE.**
     `canonicaliseHydratedProgram` (`programStore.ts:981`) took **60ms on one
     input and 18,415ms on the next.** Same function, same call, 300x.
     **WHAT SWITCHES IT — and it is the worst possible answer:**

     | In-season, Saturday game | team days | canonicalise |
     | --- | --- | --- |
     | ✓ | none | **60ms** |
     | ✓ | `[Tuesday]` | **18,415ms** |
     | ✓ | `[Tuesday, Thursday]` | **16,889ms** |

     **TEAM TRAINING IS THE TRIGGER. Every real in-season footballer has team
     training days — so the 60ms case is the unrealistic one and the 18-second
     case is the normal one.**
     **⚠ CORRECTED THE SAME NIGHT, BY ME, AND THE CORRECTION IS THE IMPORTANT
     HALF: NO ATHLETE CAN EVER HIT THIS.** I wrote that hydration "plausibly
     means ~18 seconds of blocking work at launch". **That was wrong, and it was
     already written down before I said it.**
     `FEAT-legacy-program-migration` (`featureRegistry.ts:205`) is
     **`built_unreachable` ON PURPOSE**, and it even records the same number —
     *"a measured 20.4s canonicalisation"* kept off the athlete's launch.
     **I VERIFIED BOTH PROTECTIONS MYSELF rather than taking the row's word:**
     `canonicaliseHydratedState` has **no production caller**, and
     `programStore.partialize` persists **inputs only** — anchor, phase clock,
     feedback, weight overrides, facts, injuries — **no program, no
     microcycles**, so no launch reads a stored program back to migrate.
     **Held by `test:legacy-migration-unreachable`, 3 cells, green, in chain.**
     **THIS IS THE NORTH STAR PAYING OUT:** store only decisions, derive
     everything else. Because the program is DERIVED and never stored, the
     expensive migration has nothing to migrate.
     **SO THE 18s IS A TEST-ONLY COST**, and the lesson is mine: **I read a call
     site and inferred a launch. The feature registry is the place that answers
     "does this actually run", and I should have checked it before saying so.**
     **THE LOOP IS NAMED — PROBE RUN THE SAME NIGHT, AND IT IS NOT WHAT THE
     PROFILE FIRST SAID.**
     **THE PROFILER'S TOP LINE IS A DECOY.** `stateSignature`
     (`section18AcceptedWeekGateway.ts:1487`) holds **8.3s of 18.6s (45%)** and
     it serialises the WHOLE week per candidate — so "the dedup key is too
     expensive" is the obvious read, **and it is wrong.** Counted per search:
     **48 candidates, 17-24ms total, signatures 0-4ms.** Each individual search
     is cheap.
     **THE REAL SHAPE: `searchWholeWeekRepairCandidates` RUNS 1000 TIMES FOR ONE
     HYDRATION, NESTED TO DEPTH 10.** The engine re-enters itself — a candidate's
     `assess` triggers another whole-week search, which assesses candidates,
     which search again. `maxCandidates` (48) caps the BREADTH of one level and
     **nothing caps the DEPTH of re-entry**; the cap was written for one search.
     **SO THE FIX IS NOT A FASTER SIGNATURE.** Making the key cheap would divide
     an exponential by a constant. **The layer above is the re-entry.**
     **⚠ DO NOT PATCH THIS AT THE END OF A SESSION.** The repair engine decides
     whether an athlete's week is REPAIRABLE or REJECTED; a depth cap or a
     shared memo can turn a repairable week into a refused one, and `assess` has
     not been shown pure. **Its 14 cells all pass today and would still pass
     with a wrong cap** — none of them measures re-entry.
     **START IT FRESH, and start by asking whether the re-entry is intended at
     all.**
     **Do not optimise the SUITE — the suite is honest; it is timing real work.**
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
   - **THE 10% IS TAKEN 2026-08-13 (desktop), and it is only 10% — this is a
     footnote to the measurement above, not a rival to it.** `seed()` was
     generating a whole program on all 25 calls; it now memoises by
     (profile, start), so **25 generations become 7**. Deep clone out,
     `resetStores()` still per call, and the suite's own determinism cell is
     what makes it safe. All 43 cells stay green. **The terminal's finding
     stands unchanged: the cost is `stateSignature`, not generation.**
     **AND THE SIX CELLS THAT HOLD THE TIME ARE NOW NAMED**, via the suite's own
     `AST_TIME=1` switch: `13 legacy unknown anchors remain uncredited` 18.6s ·
     `unknown legacy participation never gains anchor credit` 16.6s · `no
     calendar mutation can bypass the gateway` 14.6s · `visible projection is
     ledger-equivalent to gateway acceptance` 12.5s · `hydration remains
     deterministic and idempotent` 12.2s · `no contractless material week
     persists without accepted Contract v2` 8.2s. **82 of 89 seconds in six
     cells; the other 37 cost 7.** Whoever takes a priced route has the list of
     callers to aim at.
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



7. **BLOCKED-BY: sam — (a) IS BUILT; (b) AND (c) CANNOT MOVE WITHOUT HIM.**

   **THE TWO THINGS THAT ARE HIS, and the item already measured why neither is
   the terminal's to decide:**
   1. **A SECOND GAME IN A WEEK HAS NOWHERE TO LIVE.** The profile has ONE game
      field (`domain.ts:192,196`). His own sentence — *"1 strength session … if
      they have 2 games and 2 team trainings"* — **cannot be built or tested at
      all** until there is somewhere to put the second game. **The question:
      does a two-game week get a field, or is it out of scope?**
   2. **THE WORDS FOR A FIXTURE-CAUSED SHORTFALL.** `section18ShortfallDisclosure`
      has ONE unconditional sentence, *"Resting {Day} means you'll miss a
      strength session this week"*, and no branch for a shortfall the FIXTURES
      caused. **A second sentence is needed and the words are his to sign**, on
      the effort-scale precedent.

   **NOT A WALL THIS SEAT CAN MEASURE PAST:** both are rulings, not code. The
   capacity half that COULD be measured was, and it shipped.

   ORIGINAL BELOW.
   **(a) IS BUILT 2026-08-13 — AND IT IS AN ATTRIBUTION FIX, NOT A BEHAVIOURAL
   ONE. MEASURED BOTH WAYS BEFORE THE CLAIM.** Strength capacity now excludes
   the game day (`weeklyExposureContractBuilders.ts`), so it no longer counts a
   day no strength session can be placed on. **The target NUMBER is identical to
   HEAD on every shape tested (2, 2, 3, 3, 1)** — `spacing_safety_conflict` was
   already cutting the same week to the same number. **What changes is which
   rule takes the credit**, and that is worth having: the reduction now names its
   true cause, and if spacing ever changes, capacity still holds the line.
   **TEAM DAYS ARE STILL COUNTED** — strength stacks on a team night — so this
   deliberately does NOT reuse `nonTeamDays`, and a cell reds if it ever does.
   **3 cells, 2 mutants killed. AND MY FIRST DRAFT WAS GREEN-AND-EMPTY:** it
   asserted `targetCount <= 2` and PASSED AT HEAD; its own non-vacuity cell
   caught it, which is the only reason it was rewritten to assert the REASON.
   **The coordinate is BUILT by the cell** — across all 34 QA weeks the game day
   is never among the selected training days, so no fixture exercises this;
   nothing prevents the overlap, so it is reachable and merely unexercised.
   **(b) and (c) UNCHANGED and still open.** ORIGINAL BELOW.
   **MEASURED, NOT BUILT — AND SAM'S OWN CASE IS NOT REPRESENTABLE TODAY.**
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


13. **KEEP THE UNENFORCED LAW COUNT FALLING.**
   **A FIFTH PASS PRICED ONE MORE AND DID NOT LOWER THE COUNT — 2026-08-13,
   desktop agent.** `LAW-doc-truth`. The obvious gate is "every `test:<name>` and
   every `src/...` path a doc cites must exist", and over all 451 docs it is very
   much non-empty: **14 occurrences / 6 DISTINCT dead `test:` scripts, and 159
   occurrences / 126 DISTINCT dead `src/` paths.**
   **⚠ THE FIRST COUNT WAS WRONG AND IS RECORDED WRONG-THEN-RIGHT: 200/141**,
   because the path regex alternated `(ts|tsx)` in that order and matched `.ts`
   inside `.tsx` — **41 occurrences of "dead" files that are alive**. Sighting 15
   of the count-names-the-instrument law, in the pass that was about to build a
   gate on the number.
   **THEN THE GATE IS REFUTED BY SCOPE, and that is the finding worth keeping.**
   Restricted to LIVING docs — the four standing files plus every doc the
   registry cites in `ruledAt`, 32 files — it is **GREEN AND EMPTY**: zero dead
   `test:` citations, and its only two dead paths are in a ROADMAP naming files
   it proposes to build. **Every real violation is in an ARCHIVED doc, where the
   citation was true when written**, and a gate forcing those green would rewrite
   history this repo deliberately keeps. **What is needed is not a scan but a
   RENAME MAP** — retiring a `test:` script must update the docs citing it or
   record the old name as retired. **6 distinct names is the entire standing
   debt.** Row updated; count unchanged, and it says so.
   **PAID TWICE 2026-08-13 — 29 -> 28 -> 27.**
   **SECOND: `LAW-visible-first` is GUARDED.** Built to the shape its own row
   named — a boundary report must say what the athlete can see, or say
   NOT-VISIBLE and why. **3 cells over 74 reports, 3 mutants killed.** 64 of 74
   already complied, so the ten that did not are DECLARED DEBT on the same
   ratchet as NOT-COVERED — the list only shrinks, and a compliant file left in
   it reds. **Saying NOT-VISIBLE is compliance; SILENCE is what the law forbids.**
   **AND A THIRD LAW WAS CORRECTED RATHER THAN GUARDED —
   `LAW-terminal-is-stopped-after-a-report`, whose text had gone FALSE.** Its
   first clause ("a terminal ENDS ITS TURN at every report and is STOPPED until
   someone types at it") is the OPPOSITE of Sam's ruling today. **A registry row
   contradicting a live ruling is worse than an unguarded one.** Its proposed
   guard is also REFUTED: scanned NOW.md plus every BOUNDARY and STOP report — 75
   files — for "an agent is currently building/working" claims and found **ZERO**,
   so that gate would be green and empty. **And the founding case was a claim made
   in CHAT, which no repo test can read.** Recorded so nobody builds the vacuous
   version. **Count unchanged by that one, and it says so.**
   **FIRST: `LAW-verify-branch-before-commit` is GUARDED.**
   Its own row had said for weeks that it was *"MECHANISABLE AND CHEAP — the one
   process law in the file with an obvious hook shape"*. It was.
   `scripts/verify-branch-before-commit.sh` now runs as a real `pre-commit` hook
   (`core.hooksPath .githooks`), so the branch check happens at EVERY commit
   without anyone remembering. **9 cells (`test:verify-branch-hook`, in
   `test:bible`), 4 mutants killed, and a 5th SURVIVED and rewrote the script** —
   an unborn-HEAD escape I had reasoned my way into was unreachable, because
   `--show-current` prints the branch HEAD points at even when unborn.
   **FAIL-OPEN BY DESIGN:** one refusal only (detached HEAD, where the commit
   lands on no branch), because this checkout is shared and a hook that reds for
   an unforeseen reason stops another agent for something it did not cause.
   **NOT HELD: installation.** `core.hooksPath` is per-clone config — a fresh
   clone gets the script and the cells and must run the config line once.
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





21. **BLOCKED-BY: other-agent — ASSIGNED TO THE TERMINAL, AND ITS ONE
    NON-GENERATION ORDER IS ALREADY PAID.**

    **NOTHING IS OWED TO SAM — he has already ruled it:** *"just keep sessions
    for gym the same before footy training"*. What is left is generation work.

    **MEASURED 2026-08-13, desktop agent.** Item 22's own routing line says
    **"TERMINAL: STAY ON ITEM 20, then item 21's re-count"**, and the fix this
    item names is generation-side (`sessionBuilder.ts:718`) in files the terminal
    holds uncommitted. **Its one order a desktop seat could have taken — delete
    the "already at the club" falsehood — IS DONE**: `sessionRowCounting.ts:346`
    now carries the correction and Sam's words, not the claim. Checked before
    assuming, because the grep that finds the fix and the grep that finds the
    fault return the same line.

    ORIGINAL BELOW.
    **SAM HAS RULED — A GYM SESSION IS THE SAME SIZE WHATEVER ELSE IS ON THAT
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

    ~~**STILL NOT STARTED:** the question itself, the routing, the rebuild, and
    the copy that still says the program is "avoiding the dates you are away".~~
    **(c) IS CLOSED — ITEM 28 BUILT IT, BY A DIFFERENT ROUTE THAN THIS ITEM
    PREDICTED. VERIFIED LINE BY LINE 2026-08-13, desktop agent, because a
    "still not started" list is exactly what sends the next agent to rebuild
    something that exists:**
    - **the question** — *"Do you have your normal equipment?"* is
      `HomeScreenV2.tsx:3266`, the third step of `AwaySheet`.
    - **the routing** — "no" hands the span to `EquipmentLimitationSheet`, which
      writes `kind: 'missing_for_span'` (`:177`) over the trip.
    - **the copy** — *"Your program is avoiding the dates you are away"* is GONE
      from every shipped string; it survives only in the two comments that record
      its withdrawal, and `test:copy-rulings-binding` asserts WITHDRAWN strings
      are absent. Batch 34 carries its replacement.
    - **the rebuild** — the dated equipment fact substitutes exercises for the
      span. No generation stand-down was needed: nothing rebuilds on a new kit,
      the SELECTION reads the fact.

    **AND THE "THREE WAYS OUT" QUESTION IS VOID — SAM ANSWERED IT HIMSELF, LATER,
    IN ITEM 28's WORDS.** This item asked whether to derive the complement (i),
    add a `have` mode (ii), or ask what is MISSING (iii) — and named (iii) *"only
    to be ruled out on the record"* because it contradicts ruling 3's pre-ticked
    shape. **He then ruled (iii) IN, unprompted:** *"the athlete just removes the
    equipment they don't have while on the trip"*. The trip sheet asks *"What
    will you be without?"* because he said so. **DO NOT ASK HIM. Ruling 3 is
    untouched — it governs the ONBOARDING screen, which still pre-ticks; the trip
    is a different question about a kit he already answered for.**

    **WHAT REMAINS OF (c): NOTHING.** The `EquipmentScreen` reuse this item spent
    two slices on is also moot — the away flow never needed that door, because
    `EquipmentLimitationSheet` was already the right one. **Slice 2's `onDone`
    seam (`0ee5caf1`) is still built and still correct; it simply has no away
    caller.** Named so it is not mistaken for dead code by the next census.

    (a) and (b) are BUILT and on glass (`5ff77758`).


25. **BLOCKED-BY: sam** — for ONE number only: the FLOOR. Everything else is
    measured and buildable, and the measurement found a defect nobody had named.

    **⚠⚠ I REPORTED A CEILING BREACH TO SAM AND IT WAS MY INSTRUMENT, NOT THE
    APP. WITHDRAWN 2026-08-13, SAME SESSION.** I said six sessions ship SEVEN
    rows against his cap of six. **They do not. Nothing breaches his cap.**
    **THE FAULT:** `countingIndices` does NOT return "the indices of counted
    rows". It returns a PARALLEL array, one entry per row, holding either the
    row's counting position or `NON_COUNTING_ROW_INDEX` (99) — so its `.length`
    is ALWAYS the total row count. I read `.length` as a count of counted rows,
    so I measured TOTAL ROWS and called them strength rows.
    **a-count-taken-for-a-record, and the instrument was mine.**

    **THE CORRECTED MEASUREMENT — 52 gym sessions, 6 athlete worlds, counting
    `!== NON_COUNTING_ROW_INDEX`:**

    | counted strength rows | sessions |
    | --- | --- |
    | 3 | 16 |
    | 5 | 20 |
    | 6 | 16 |

    **MAX = 6. OVER HIS CAP = ZERO.** The ceiling is unenforced, exactly as this
    item says — but it is not being exceeded, so enforcing it changes nothing
    today. **I built that enforcement and REVERTED it: it moved not one session,
    and shipping an inert change as "his ruling is now enforced" would have been
    a false receipt.**
    **WHAT SURVIVES THE CORRECTION, AND IT IS THE HALF THAT MATTERED:**
    **SIXTEEN OF 52 SESSIONS SHIP THREE COUNTED ROWS**, below the code's own
    `SESSION_SIZE_FLOOR = 4`, and they can never reach it because
    `exerciseScorer.ts:317` clamps the top-up target to
    `Math.min(template count, 4)`. **A 3-row session stays 3 forever.** That is
    the live defect and it is a FLOOR problem, not a ceiling one.

    **THE ONE QUESTION, AND IT IS NOT A BARE NUMBER — his own weeks answer most
    of it.** The ceiling is his (6). The floor has never been authored.
    **RECOMMENDATION: FLOOR = 4.** It is already the number in the code, it is
    the smallest possible change, and it lifts only the fifteen 3-row sessions.
    His weeks already cluster at **5** (20 of 52), so 5 stays the typical session
    and nothing he has seen moves. **Veto in a word if 5 or 3 is the floor
    instead.**

    **⚠ THE CENSUS THIS ITEM CALLS "the next unit" ALREADY EXISTS — IT IS IN
    ITEM 27, TWO SCREENS DOWN THIS FILE.** *"13 fields, 3 unread, of which ONE is
    a live unenforced ruling, TWO are abolished leftovers, and the headline field
    is forwarded but never enforced."*
    **I RE-RAN IT INDEPENDENTLY BEFORE FINDING THAT, AND IT REPRODUCES EXACTLY** —
    which is worth more than either measurement alone. Reading every production
    file for each of the 13 `TrainingAgePolicy` fields:
    `maxHardExposures` **0 readers**, `maxOptionalSessions` **0 readers** (both
    abolished by Sam in §11 — dead fields, not unenforced rulings);
    `maxExercisesPerStrengthSession` **1 reader, and it FORWARDS to the AI
    prompt** rather than enforcing; the other nine have real readers, verified
    against a control (`maxSetsPerExercise` clamps in `defaultProgram.ts:971`).
    **INSTRUMENT LIMIT, STATED: `level` is uncountable this way** — the word
    collides with unrelated fields and my scan returned 57 false readers for it.
    **SO THE CENSUS IS NOT OWED. What is owed is acting on it.**

    **BUILDABLE WITHOUT HIM, AND NOT STARTED — the ceiling half.** Enforcing 6 is
    his own authored number and needs no ruling; it changes 6 of 52 sessions and
    is a generation change with real blast radius, so it starts fresh rather than
    at the end of a long turn.

    ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 25).

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
  **THE NEXT ACT IS THE NARROWEST POSSIBLE PROBE:** put one `console.warn` on the
  line IMMEDIATELY BEFORE `return applyAwayPass(...)` and one on the first line
  INSIDE it. If the outer fires and the inner does not, the call is being
  optimised or shadowed and the answer is in the module graph — `sessionResolver`
  sits in four of the require cycles Metro warns about on every boot, and a cycle
  is the only mechanism left that fits.
  **Do not add a fourth filter anywhere until that has answered.**
  **THE PASS IS KEPT** — it is correct, tested and live for the resolver's other
  callers — but **the athlete's week is unchanged by it, and the screenshots
  still show the club.**
- **ANSWERED 2026-08-13 — a game inside the trip DISAPPEARS.** Sam: ***"yes it
  should disappear OBVIOUSLY YOU'RE NOT GOING TO BE THERE"***. **Built the same
  day** — the fixture is dropped at the plan, so the week loses its taper and
  its G+1 with it. **Do not re-ask.**
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
- **⚠ STALE, CORRECTED 2026-08-13 — THE FILES ARE CLEAR AND ITEM 3 IS CLOSED.**
  This entry said item 9's four-answer collapse and item 3's remaining step were
  waiting on files another agent held. **`section18CraftTier.ts` and
  `projectVisibleWeek.ts` are both clean, unedited since 2026-08-12.** Item 3
  owed nothing — both its laws are `guarded` and green — and is archived.
  **Item 9 is workable whenever someone picks it up; it is not blocked.**
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
