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


28-C1. **THE RE-MEASUREMENT IS DONE — ON LEGAL WEEKS, AND THE WALL HAS MOVED.
    2026-08-13, terminal.**

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

35. **EQUIPMENT SCOPES · THE GUESSED SESSION CUT · THE MAS BLOCK CHECK — Sam,
    2026-08-13.** Full text: `docs/SEAT_ORDERS_FULL_2026-08-13.md`.
    **(a) THREE equipment scopes, no fourth:** PROFILE = permanent · SESSION VIEW
    = that session only (*"usually only just for that session"*) · AWAY = a dated
    span that lifts itself. **No day-screen door — verified absent, keep it that
    way.** The open question is only: *does a temporary equipment change in the
    session view actually swap that session's exercises?* **And rename
    `missing_this_week` (`programControlAction.ts:253`) — three scopes, three
    names.**
    **(b) Census C10 — Sam: *"that sounds shit and not good"*.** The only typed
    main-strength reduction fires on `availableSafePatterns.length === 0`, an
    INFERENCE. His own 2026-08-06 ruling specifies the fix: the same
    `not_attempted | substituted | exhausted` proof equipment has; *"proof, never
    inference"*. **A cut with no proof is a defect.**
    **(c) Census C11 — Sam: *"it needs to be checked"*.**
    `set_length_max_4_5_min` has five mentions and NO reader. Add the clause
    beside the three that work (`conditioningSelection.ts:291-304`). **Mutation
    proof, same shape as the erg cap closed today.**

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



7. **NOT BLOCKED — AND THE TWO QUESTIONS I PUT ON THIS LINE WERE BOTH RE-ASKS.
   WITHDRAWN 2026-08-13 BY THE GATE THAT NOW EXISTS BECAUSE OF THEM.**

   **RULINGS-CHECKED: RULING-as-many-games-as-needed,
   RULING-shortfall-sentence-names-its-cause — BOTH ANSWERED, BOTH BUILT.**

   **THIS ENTRY IS THE FOUNDING CASE OF ITEM 32 AND IS KEPT AS ONE.** I marked
   this item `BLOCKED-BY: sam` and sent him two questions. Sam: *"why the fuck is
   someone still saying shit like this WE HAVE FUCKING FIXED THESE ISSUES"*. He
   was right on both, and `test:ruling-registry` `[3]` now reds on this exact
   text.

   1. ~~"does a two-game week get a field?"~~ **RULED AND BUILT.** *"as many
      games as needed"*, and the profile does NOT grow a second field — **the
      CALENDAR holds fixtures; `gameDay` is only a DEFAULT** (`3f62ad62`,
      2026-08-12). **MY ERROR, NAMED: I read `domain.ts:192` `gameDay?: DayOfWeek`,
      saw one field, and reported "nowhere to live" — reading the PROFILE and
      reporting on the CALENDAR.** That field is precisely the mechanism Sam
      ruled is not the one.
   2. ~~"a second sentence is needed for a fixture-caused shortfall"~~ **SHIPPED
      TWELVE HOURS EARLIER.** `section18ShortfallDisclosure.ts:158` returns
      `` `With a game ${day}, there's only room for ` ``, held by
      `test:shortfall-copy` in both directions. **My claim that the module "has
      ONE unconditional sentence" was false — that is the OTHER branch.**

   **WHAT IS ACTUALLY LEFT OF (b) AND (c):** nothing that needs Sam. Both are
   engineering against rulings that already exist.

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

28. **BLOCKED-BY: other-agent — THE TERMINAL IS EDITING STEP 1'S EXACT LINE AS
    THIS IS WRITTEN.**

    **NOTHING IS OWED TO SAM — he gave the order: *"do the rebuild"*.**

    **MEASURED, NOT ASSUMED (2026-08-13, desktop agent).** Step 1 is *"add
    `constraint.scheduleKind === 'travel'` back to `isRuledDerivingConstraint`"*,
    which lives at `src/store/temporarySourceFactTransaction.ts:745`. That file
    is `MM`, and its live diff shows the terminal moving that very line:
    `- (constraint.scheduleKind === 'travel' ||` becoming
    `+ constraint.scheduleKind === 'travel' ||`, with a new comment reading
    *"a door that refuses is worse than a door that records, so travel stays
    on"*. **Steps 2 and 3 are a device pass that cannot start until step 1
    lands, so the whole item is theirs until it does.**

    ORIGINAL BELOW.
    **DO THE REBUILD — SAM'S ORDER, 2026-08-13, AND IT IS THE ONLY THING LEFT.**

    **His words on seeing the Saturday: *"why the fuck does it read training day?
    it should read whatever the new program is i.e. conditioning, lower body
    strength etc"*, then *"do the rebuild"*.**

    **THE DIAGNOSIS IS SETTLED, so start from it rather than re-deriving it.**
    Everything shipped so far FILTERS the week on the way out — it can HIDE the
    club, it cannot PUT his away session in the hole the game left. "Training
    Day" is `day.headline.training`, the app's placeholder for a day that exists
    and holds nothing (`projectionCopy.ts:148`). **Filtering was the wrong tool
    for a slot that needs filling.**

    **WHAT THE REBUILD MEANS, in Sam's own frame:** *"consider the time they are
    away as building a new program and their old program is gone for the time
    being"*. The trip's weeks are RE-AUTHORED — no team days, no fixtures, the
    athlete's own sessions distributed across the days he has — and the plan-side
    work for that is ALREADY BUILT and measured (`test:away-flow` [13]-[13e]:
    a week planned inside a trip has no team day, no game, and every row of his
    own training survives).

    **THE ONE THING IN THE WAY, and it is diagnosable now:** putting travel on
    the DERIVING lane (`isRuledDerivingConstraint`,
    `store/temporarySourceFactTransaction.ts`) makes the scoped regen re-author
    those weeks — and on a real seeded world the commit was REFUSED once
    (*"That didn't save — your week is unchanged."*). **That refusal now LOGS its
    typed reason (`247eb6d3`), which it never did before.** So the next act is
    three steps, not a hunt:
    1. Add `constraint.scheduleKind === 'travel'` back to
       `isRuledDerivingConstraint`.
    2. Run the away flow against a logged Metro and READ the
       `[temporary-source-fact] refused` line.
    3. Fix what it names.

    **STEP 1 WAS APPLIED ONCE AND BACKED OUT AGAIN — 2026-08-13, and the reason
    is a warning rather than a result.** Travel was added to
    `isRuledDerivingConstraint`, a clean `--clear` Metro was started and the flow
    run — and the run stopped 12 steps in instead of 14, the app sitting on the
    DAY screen, with NO `[temporary-source-fact] refused` line logged. **So the
    away door did not even complete, and nothing was learned.** The change was
    reverted rather than left in the tree: it is the same edit that once made the
    athlete's tap fail outright, and an unverified deriving-lane change is not
    something to hand over. **The tree is clean and identical to HEAD.**
    **START BY MAKING THE FLOW ITSELF PASS 14/14 AGAIN** (it did all day) before
    reading anything into a missing log — a half-run flow proves nothing, and
    that is the same mistake as trusting a stale bundle.

    **⚠ INSTRUMENT DISCIPLINE FIRST, OR THE WHOLE THING WASTES A DAY AGAIN.**
    `pkill -f "expo start --dev-client"`, then ONE `npx expo start --dev-client
    --port 8082 --clear`, and put a CONTROL in the same edit as the test — change
    an EXISTING log's text and confirm the NEW text appears before trusting any
    absence. **Three orphaned Metro processes on one port served stale bundles
    for hours and produced two confidently wrong conclusions.**

    **WHAT IS ALREADY WORKING AND MUST NOT REGRESS** (all seen on glass): the
    week-shape Away control, leave date, unbounded return date, the equipment
    question and its dated span, **the game off the week**, **the team night off
    a combined day**, and a fixture inside the trip no longer anchoring its week.

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
