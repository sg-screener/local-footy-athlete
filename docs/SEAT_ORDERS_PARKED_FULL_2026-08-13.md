# PARKED ORDERS — full text, archived 2026-08-13

**Sam, 2026-08-13:** *"once something is fixed and commited though, those notes
dont need to be there anymore do they?"* **He was right, and the measurement
widened it: the bulk was not FINISHED items, it was PARKED ones.** Four orders
held 32KB of a 65KB file — every byte re-read at every stop by every agent —
while three of the four were waiting on another agent and could not be worked.

**Do not read this file. Grep it** — only when a summary in the inbox is
challenged or you are about to start one of these.

---

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







35. **⚠ MY BLOCK ON THIS WAS WRONG TWICE — WITHDRAWN 2026-08-13.**
    I marked (c) `BLOCKED-BY: other-agent` because `conditioningSelection.ts`
    showed `MM`. **It was byte-identical to HEAD — the file was FREE — and the
    work was ALREADY BUILT** (`97c8d41b`, the reader is at `:570`). **I blocked a
    finished job on a file nobody was holding.**
    **THE CAUSE IS AN ENVIRONMENT FACT WORTH MORE THAN THIS ITEM: `git status`
    LIES IN THIS CHECKOUT.** After a private-index commit the shared index goes
    stale and files show `MM` while identical to HEAD. **Verify with
    `git show HEAD:<path> | cmp -s - <path>`, never with the status letters.**
    Found by the terminal on 28-C1; re-verified here across seven files —
    **five were free, two genuinely held.**
    **RE-VERIFIED BASES FOR THIS SEAT'S OTHER BLOCKS:** item 28 stands
    (`temporarySourceFactTransaction.ts` genuinely differs); item 30's
    `defaultProgram.ts` genuinely differs; **items 33 and 34 rested partly on
    files that are FREE** — their remaining claim is the terminal's COMMIT
    ACTIVITY, which is real, not a file hold.
    **WHERE (a) AND (b) ACTUALLY STAND — no file blocks either.**
    (a) answered in source; **the glass check is owed and is blocked by the
    SHARED SIMULATOR, which is a device, not a file.** (b) five measurement
    passes, build specified to the line, not started: it needs the full scenario
    report because `assessContract` is called by the acceptance gates.
    **Nothing is owed to Sam on any of the three.**
    ORIGINAL BELOW.
    **EQUIPMENT SCOPES · THE GUESSED SESSION CUT · THE MAS BLOCK CHECK — Sam,
    2026-08-13.** Full text: `docs/SEAT_ORDERS_FULL_2026-08-13.md`.
    **(a) THREE equipment scopes, no fourth:** PROFILE = permanent · SESSION VIEW
    = that session only (*"usually only just for that session"*) · AWAY = a dated
    span that lifts itself. **No day-screen door — verified absent, keep it that
    way.** ~~The open question is only: does a temporary equipment change in the
    session view actually swap that session's exercises?~~ **ANSWERED IN SOURCE
    2026-08-13: YES.** `DayWorkoutScreenV2.ts:717` executes `swap_exercise` per
    replacement, `scope: 'today_only'`, `oneOffOnly: true`. **GLASS CHECK STILL
    OWED — attempted and abandoned: the simulator is shared and I was
    interleaving with the terminal's away run.**
    **⚠ AND THE `missing_this_week` RENAME IS REFUTED ON ITS PREMISE:** the
    session door writes NO equipment fact (zero hits in the day screen or the
    session sheet). That payload's only two writers are in
    `EquipmentLimitationSheet`, the PROGRAM-screen week/span door. The name is
    imprecise there; it is not carrying "just this session".
    **⚠ (b) MEASURED 2026-08-13 BY THE TERMINAL — THE DEFECT DOES NOT REPRODUCE.
    DO NOT BUILD IT YET.** 28 weeks, 7 worlds, 4 injury-free and 3 with a SEVERE
    injury (knee / lower back / shoulder), 3-day and game weeks included:
    **ZERO weeks with an unexplained main-strength shortfall.** Every cut already
    names a PROVEN reason — `insufficient_availability` x2 (*"Selected-day
    availability cannot safely hold the original strength target"*),
    `spacing_safety_conflict` x4 — and **`injury_restriction` fired ZERO times.**
    **The `availableSafePatterns.length === 0` producer never ran once.**
    **THE ONE STATE I COULD NOT REACH:** it needs NO main pattern safe, which a
    single injured area does not achieve. **A multi-area severe injury might —
    produce that state before building.** R-073 carries the numbers.
    **(c) BUILT `97c8d41b`** — the 4-5 min set cap is the fourth clause in the
    selection filter, 87 cells, two mutants killed THROUGH THE REAL SELECTOR.
    **⚠ THE UNIT WAS NEARLY WRONG:** all three capped templates use SECOND-scale
    intervals, so a filter on `longestWorkIntervalMinutes` would have been
    permanently inert. A block is rounds x (work + rest). **This item's
    BLOCKED-BY was a phantom** — `conditioningSelection.ts` showed `MM` and was
    byte-identical to HEAD.
    **THE ROWS ARE R-072/R-073/R-074, not R-071/072/073 — R-071 was already
    taken** (`01ef5863`). Ids are addresses.

    **(b) Census C10 — Sam: *"that sounds shit and not good"*.** The only typed
    main-strength reduction fires on `availableSafePatterns.length === 0`, an
    INFERENCE. His own 2026-08-06 ruling specifies the fix: the same
    `not_attempted | substituted | exhausted` proof equipment has; *"proof, never
    inference"*. **A cut with no proof is a defect.**
    **⚠ FOUR MEASUREMENT PASSES, EACH ONE SHRANK IT — full detail in
    `docs/SEAT_ORDERS_FULL_2026-08-13.md`:** (1) the break I first named is in a
    FALLBACK builder, not the primary path; (2) the proof is already computed —
    `assessContract` writes `unresolvedMinimumShortfall` and
    `unresolvedPlannerSelectedShortfall` on every week; (3) the item's premise is
    FALSE — a short week is not silent, it trips a **BLOCKING** finding, and a
    reduction only suppresses the tier-3 advisory; (4) **the danger of "no room"
    silencing genuine breakage is STRUCTURALLY IMPOSSIBLE** —
    `SAFETY_REDUCTION_REASONS` (`weeklyExposureContractV2.ts:553`) is a closed
    set of seven that alone lower the ceiling, and `insufficient_availability`
    is not one of them, while `hasFrequencyReduction` (`:839`) accepts any
    reduction. **So the reason word already exists and is already safe.**
    **THE LAST QUESTION WAS SEQUENCING, AND IT IS MEASURED TOO (pass 5).**
    `applyGenerationSafetyToSection18Contract` DOES run post-placement —
    `postGenerationConstraintValidation.ts:1241` and `:1640`, on a microcycle
    whose workouts already exist — **but it is handed `contract` and
    `generationConstraints` only, never a ledger, so it cannot see the achieved
    count.** The one place that can is `assessContract`, which already CLONES AND
    WRITES the contract (`unresolvedMinimumShortfall` is its write). **Authoring
    a reduction from the shortfall it just computed is the same act at the same
    seam.**
    **NOT BUILT, AND HERE IS THE HONEST REASON:** `assessContract` runs inside
    `evaluateSection18EffectiveWeek`, which acceptance gates call to compare
    before/after. **A new reduction there changes contracts everywhere the
    evaluator runs**, so it needs the full scenario report against the committed
    baseline — not a tail-end edit. **Everything else is specified: the reason
    word (`insufficient_availability`), the number (the shortfall), the seam
    (`assessContract`), and the proof that it cannot silence a broken week.**
    **(c) Census C11 — Sam: *"it needs to be checked"*.**
    `set_length_max_4_5_min` has five mentions and NO reader. Add the clause
    beside the three that work (`conditioningSelection.ts:291-304`). **Mutation
    proof, same shape as the erg cap closed today.**

