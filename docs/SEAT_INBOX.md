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

## Unprocessed (newest first)

Deep background: `docs/HOW_TO_BUILD_THIS_APP_2026-08-12.md` (the architecture
answer) and `docs/ATLAS_VERIFICATION_2026-08-12.md` (receipts). A new agent's
entry point is `docs/CODEX_HANDOFF_2026-08-11.md`.

**THREE STAND-DOWNS — each has already cost time or money once.**

**A. THE FIFTH HARD DAY IS CLOSED.** **Sam:** *"4 hard days plus 1 moderate/easy
day is prefered but 5 hard days is okay"*. Five is not a defect. Measured well
(`a8f13d91`), correctly not wired. **Do not switch it on.**

**B. HYDRATION MAY QUIETLY RE-SHAPE THE DAYS AHEAD — ALREADY ANSWERED.** **Sam:**
*"once a session is done then it's locked in, only the rest of the week can
change ... wednesday to sunday should adjust to accomodate this"*. Both halves
already match the code. **No work owed. Do not ask again — fourth appearance of
the granted-permission defect.**

**D. HANDS OFF THE GENERATOR AND THE GENERATION ANCHOR — ANOTHER AGENT HOLDS
THEM. Sam, 2026-08-12:** *"Claude Code is working the reopen bug in this same
folder. Stay out of the program generator and anything touching the generation
anchor until it's done."*

**OFF LIMITS until Sam lifts it:** `src/services/api/generateProgram.ts`,
`src/utils/coachingEngine.ts`'s generation paths, `generationAnchorISO` and
everything that reads or writes it (`programStore` persistence, the quiescent
boot, `seedOnboardingProgram`).

**WHICH QUEUED ITEMS THIS BLOCKS:** **item 3** (±7 — its remaining step is in
the craft tier and the fixture authority, both generator-side), **item 4** (the
moderate day — its fix is a generation target), **item 7** (strength capacity —
the gateway's authorised reductions). **Items 8-15 are clear** (UI, gates,
registries, docs).

**SHARED CHECKOUT, NOT A WORKTREE.** That agent's files appear in `git status`
mid-commit. **Stage explicitly by path; never `git add -A`.** Its untracked
`src/__tests__/anchorRepro.ts` is why `test:profile-mirror-narrowing` reds — a
red that belongs to no committed change.

**C. SAM CANNOT DEVICE-TEST UNTIL HE REBUILDS HIS PHONE.** **Sam:** *"I can't
test until I've rebuilt my phone"*. **Nothing in this queue depends on his
phone.** State device items as PARKED in a stop report, never as a request.

---

0. **BUILT — THE HOOK NOW HAS FOUR EXITS AND `docs(stop):` IS NOT ONE OF THEM.**
   All four are in `scripts/seat-inbox-hook.sh` and proven in
   `test:seat-inbox-hook` (**21 -> 25 cells, four mutations killed**):
   **(1) queue empty** — unchanged. **(2) `docs(blocked):`** — a different word
   on purpose, so the exit cannot be taken by the report that used to take it.
   **(3) a NEW line under `## AWAITING SAM` in THAT commit** — "not already
   recorded" made checkable, because a question written yesterday would be a
   permanent door. **(4) three turn-ends on one HEAD** — measured in COMMITS,
   never a clock, exactly as the order reasons; state lives machine-local under
   `.claude/`, and a new commit RESETS it.
   **THE OLD CELL WAS THE HOLE.** `test:seat-inbox-hook` asserted *"a committed
   STOP report ALLOWS the turn to end"* and it PASSED — so this was never
   disobedience: a note in a file does not beat a door in a script. **The cell is
   INVERTED, not deleted**, so the exit's history stays readable.
   **ONE MUTATION SURVIVED AND ITS CASE WAS ADDED BECAUSE OF IT:** "the line must
   be NEW" was enforced only by there being no diff at all, so a hook that
   allowed on ANY added line passed every cell. There is now a case where a line
   is added ELSEWHERE in the inbox and the exit must stay shut.
   **I BUILT THE WRONG THING FIRST AND THREW IT AWAY.** Before re-reading this
   item I built a `STOP CONDITION:` declaration on top of `docs(stop):` — my own
   inference from the older wording. **The order says `docs(stop):` stops being
   an exit at all.** Reverted to HEAD and rebuilt to what is written. Registry
   row `LAW-stop-needs-an-exit`; 105/73 -> 106/74, UNENFORCED unmoved at 32.
   **⚠ SAM: `/hooks` verification is yours** — it blocks your completions too.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 0).

0a. **PAID IN FULL — `7a6281ce`, `f3861b31`, `f9f84123`.** One scale, one
   slider, one predicate. **The order's third site was REAL and my first two
   commits missed it:** the transaction validators still refused anything over
   5, so the slider was offering answers the transaction threw away — green at
   both ends because nothing compared them. `test:effort-scale` (42 cells,
   mutation-checked) now binds the slider, the form and BOTH transactions to
   `isEffortRating`. Three law-registry rows, two receipts and four comments
   that still said "1-5" were corrected. **`feel` is a DIFFERENT 1-5 scale
   (Heavy/Bad/Normal/Good/Flying) and correctly did NOT move.**
   **AWAITING SAM — the words.** He named `7 — hard` and the two ends; the
   seven between are the terminal's and are marked `PROPOSED ... AWAITING SAM`
   in the signed table: *2 easy · 3 light · 4 moderate · 5 steady · 6 solid ·
   8 very hard · 9 brutal*. **PARKED — no device pass on the slider's feel.**

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 0a).

0b. **BUILT AND LIVE — `59164984`. Sam ruled "proxies" 2026-08-12.**
   `scripts/completion-gate.sh` + a `TaskCompleted` entry in
   `.claude/settings.json`. **CORRECTION TO THE ORDER'S FILE PATH: `.claude/` is
   GITIGNORED here and nothing under it is tracked, so the script lives in
   `scripts/` like the existing Stop hook's does — a hook nobody can read in a
   diff is not a shared instrument.** Verified by driving it three ways: valid
   tree exit 0; docs-only exit 0 in **0.04s running nothing**; a broken `.ts`
   exit 2 naming the command and the file. **NOT DONE — `/hooks` verification
   is Sam's, since this blocks HIS completions too.**
   The proposal and the red-command measurement behind it stay at
   `docs/STOP_2026-08-12_COMPLETION_GATE_PROPOSAL.md`.

   ~~PROPOSED, NOT BUILT~~
   **THE FINDING THAT DECIDES THE DESIGN: three of the commands this order
   implies are ALREADY RED, so built literally the gate would refuse every
   completion from its first run.** `npm run typecheck` is RED (459 errors — the
   weak config the ratchet replaced); `npm run test:qa`, the "full scenario
   suite", is RED (84 pre-existing failures); `npm run test:law-registry` is RED
   **by Sam's own stop-the-line ruling** and must never be wired in.
   **PROPOSED INSTEAD, all green today and all already in `package.json`:**
   any `.ts`/`.tsx` -> `test:compile` (the RATCHET — fails on NEW drift, ignores
   the documented backlog, which is exactly a completion gate's job);
   `rules/**`+`store/**` -> also `test:repo-law-guards`; generation/repair/
   coaching -> also `test:rules-kernel`; docs-only -> nothing.
   **TWO FILES, the constraint's maximum:** `.claude/hooks/completion-gate.sh`
   (new) and `.claude/settings.json` (edited — it already holds the Stop hook).
   **AWAITING SAM — one decision:** green proxies now, or fix `typecheck` and
   `test:qa` first so the order can be built literally? **Recommended: proxies
   now.** Also `/hooks` verification is his — this hook blocks HIS completions.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 0b).

0c. **ALL SIX BUILT — `dc7d7246`, `ab43825c` (and (i) installed).**
   **(i) DONE** — LSP + plugin enabled, **~0 tokens per session**, out-of-process.
   **(ii) BUILT WITH ITS RISK CONTAINED** — `.claude/rules/coach-and-plan-edits.md`
   and `suites-and-fixtures.md`; AGENTS.md **746 -> 645**. Every moved section
   leaves a POINTER, because the mechanism is still unverified from here — if it
   is inert the law is one hop away, not gone.
   **(iii)/(iv)/(v)/(vi) BUILT** — `/lfa-task`, `lfa-verifier`, `/day-end`, and
   two lines in `CLAUDE.md` for `/goal`.
   **THE OVERLAP CHECK IS ANSWERED IN THE VERIFIER ITSELF:** 0b's gate owns the
   MECHANICAL questions and the verifier is told never to repeat them; its
   question is whether the CLAIM is true.
   **THE IGNORE EXCEPTION WENT WIDER THAN SAM NAMED** — `skills/` and `agents/`
   as well as `rules/`, on his own reasoning that a law only one machine sees is
   not a law. **Two lines to revert.** Also: `!.claude/rules/` alone is SILENTLY
   POWERLESS under `.claude/` — git cannot re-include inside an excluded
   directory; it needs `.claude/*`. Verified before writing.
   **⚠ SAM OWES ONE CHECK: restart, then `/context`** — that the rules load and
   the skills/agent are picked up. Until then it is a saving on paper.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 0c).

0d. **BOTH BUILT AND BOTH GUARDED — `CLAUDE.md` 137 -> 104 lines, and
   `npm run lfa:dev` reached a RUNNING app.**
   **(i)** `CLAUDE.md` gained `## WHAT COUNTS AS FINISHED` — source-of-truth
   order, athlete-visible proof, writer/reader/test per new field, the three
   words, and a command table. **It got SHORTER, not longer:** the Coach
   Escalation Rule and the Stop-Patching Trigger moved to
   `.claude/rules/coach-and-plan-edits.md` (pointer left), and the Elegant
   Solution Requirement was a word-for-word duplicate of `AGENTS.md` and is now
   a pointer.
   **(ii) THE RECIPE ALREADY EXISTED AND WAS NAMED, NOT REWRITTEN** —
   `scripts/qa-start.sh`, tracked, now behind `npm run lfa:dev`. **It stopped
   one step short of the order's words:** it booted a simulator and started
   Metro and left launching the app as homework, which is the step being
   rediscovered. It now picks **the booted simulator that has the app** (this
   machine holds a dozen `LFA Explorer` sims; the default `iPhone 17 Pro` is not
   the one on screen), launches the app, and **fails closed naming
   `npx expo run:ios` when nothing has it installed.** Recorded as the `lfa-dev`
   skill; `QA_RUNBOOK` and `FINAL_QA_CHECKLIST` now name the one command.
   **PROVEN, NOT ASSERTED: launched on the booted sim (pid 35161) and
   screenshotted — the Profile screen, real state.**
   **TWO REGISTRY ROWS, BOTH BORN GUARDED** by `test:repo-law-guards`
   (37 cells, +2, mutation-tested three ways): `LAW-definition-of-done` and
   `LAW-one-startup-command`. Registry **97/65 -> 99/67, UNENFORCED unmoved at
   32.** The done-row's receipt says out loud which half a script cannot hold.
   **FOUND WHILE BUILDING:** `simctl list devices` pads its lines with a
   trailing space, so the first device parser matched NOTHING and the script
   reported "not installed on any simulator" about a simulator with the app open
   on it. Fixed and commented at the regex.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 0d).

0f. **THE "HIDDEN SESSION" IS FIXED — AND MY FIRST READING OF IT WAS WRONG.**
   **Sam, 2026-08-12: fix it, and do NOT drive the simulator — Claude Code owns
   it.** Both obeyed: this was worked entirely in node.
   **THE CORRECTION FIRST.** 0e reported that today's card does not draw
   everything the day holds. **It draws everything the day holds. The SEED was
   wrong.** `stabilizeMicrocycle` rewrites every exercise row id to make a seed
   reproducible and **never rewrote `conditioningBlock.options[].exerciseIds`**,
   so the block pointed at ids no row had, the conditioning row was filed as
   strength, and `getSessionComponents` reported one component where the day has
   two. **23 of 23 seeded workouts carrying a block — every seed, not a sample.**
   **THE GENERATOR'S OWN OUTPUT WAS MEASURED AT THE SAME TIME AND IS CORRECT**
   (4 of 4 blocks resolve; components read `strength, conditioning`). **No
   athlete was ever affected and no product code changed.**
   **FIXED IN THE SEED, PROVEN WITHOUT GLASS:** `projectParts` for that Monday
   now yields `strength` AND `conditioning`; before the fix, `strength` alone.
   Three cells in `test:dev-e2e-seeds` (cause, consequence, anti-vacuous),
   mutation-checked. Registry row `LAW-rename-carries-its-references`, 101/69 ->
   102/70, UNENFORCED unmoved at 32.
   **THE COST OF THE SEED BUG BEYOND THIS BUG:** every seeded world was a world
   no athlete is in, on exactly the axis the fixture-fidelity law names.
   **⚠ OWED AND BLOCKED: the deletion flow's re-run on glass**, because the
   simulator is Claude Code's until Sam says otherwise.
   **⚠ THREE REDS IN THIS TREE ARE NOT MINE** — `test:compile` on untracked
   `fixtureSettleAfterSetupTests.ts`; `test:dev-e2e-seeds` and
   `test:dev-e2e-scenario-session` on the same pre-existing "manifests add no
   seed families" cell (identical name for name at HEAD, measured both ways);
   and `test:repo-law-guards`' orphan-flow cell now names the other agent's
   untracked `.maestro/tmp-gameday-verify.yaml`.

0e. **BOTH BUILT. THE CENSUS CAME FIRST AND IT PAID TWICE.**
   **(i) THE SET WAS NOT A SET.** Of the five named flows: **move a session had
   NOTHING** — `fixture-move.yaml` moves a GAME, and the explorer's `session.move`
   enters through a 2x2px dev-only control, not the athlete's button; **clear or
   reverse an adjustment had NOTHING** — the readiness flow opens both doors and
   presses Cancel; **delete a session was half** — one part-scope, no whole day,
   no relaunch; **relaunch/persistence exists**; **preview and approve a repaired
   week HAS NO DOOR** (`SUPPORTED_ATHLETE_ACTIONS` 5.4 is DECIDED, NOT BUILT), so
   no flow was written for it and the gap is carried by name.
   **BUILT AND GREEN ON THE SIMULATOR, FIRST RUN:** `.maestro/golden/session-move.yaml`
   (whole session onto the empty Sunday, both days redrawn, survives a relaunch)
   and `.maestro/golden/readiness-adjust-and-clear.yaml` (illness adjusts the
   week, "I'm good now" takes it back, the clear survives a relaunch).
   `lower-body-deletion.yaml` extended to the whole-day scope + relaunch.
   **THE RE-AIM FOUND A DEFECT, AND IT IS AN ATHLETE ONE — SEAT PLEASE ROUTE:**
   on the `lower-body-deletion` seed today's card is titled "Strength" and draws
   two parts; **delete the strength part and the card becomes "Conditioning" with
   a part that was there all along.** The athlete has a session today they cannot
   see. Photographed both sides. **Not diagnosed here — a projection defect is
   its own unit.**
   **(ii) TWO PARAGRAPHS IN `CLAUDE.md`,** folded into 0d(i)'s section as
   ordered: auto memory is for environment and navigation, **never product law**,
   which lives in the registry or nowhere.
   **TWO REGISTRY ROWS, BORN GUARDED** — `LAW-canonical-athlete-flows`,
   `LAW-memory-not-a-law-store`. Registry **99/67 -> 101/69, UNENFORCED unmoved
   at 32**; `test:repo-law-guards` 37 -> 38 cells.
   **⚠ TWO THINGS THE SEAT SHOULD KNOW, NEITHER MINE.** (1) **THE SIMULATOR IS
   SHARED AND NOBODY SAID SO** — three `maestro test` runs from a concurrent
   agent appeared on the same device mid-pass, so my re-aimed deletion run was
   STOPPED rather than reported; two Maestro sessions interleave taps into one
   app and the honest outcome is "unknown", not "red". **That re-run is owed.**
   (2) **`test:compile` IS RED ON A FILE THAT IS NOT MINE** — untracked
   `src/__tests__/fixtureSettleAfterSetupTests.ts`, 1 error, the same
   red-belongs-to-no-committed-change shape the inbox already records for
   `anchorRepro.ts`.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 0e).

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
   WRONG THING.** `test:craft-tier` 36/36, the property that reverted attempt 1
   now **PASSES with the ±7 GONE**, and the sweep is **15 of 196 — IDENTICAL name
   for name to the HEAD baseline measured the same hour.** The 17 QA scenarios
   are unchanged: no hard failures, no preference regressions, no improvements.
   **THE ±7 WAS NEVER THE DEFECT. IT WAS THE LID.**
   `canonicaliseAcceptedStateCandidate` re-gates every hydrated week at commit
   time and writes the gateway's re-derived day over the proposal's — and the
   re-derivation **carries no provenance**. A cross-week dependency the proposal
   held was destroyed at commit, on every path that re-gates. Measured at the
   write, both arms: `overlay Monday 2026-07-19 -> accepted Monday 2026-07-19`
   with the phantom present, `-> NONE` without it. **With a fabricated game at ±7
   the re-derived Monday happened to be a G+1 day and minted its own record, so
   the loss was invisible.** Three attempts read the deletion as "breaking the
   link"; it only stopped hiding a defect already there.
   **SECOND SIGHTING OF ONE CLASS IN ONE DAY** — `LAW-rename-carries-its-references`
   this morning (a seed stabiliser renaming rows and orphaning the block that
   pointed at them), `LAW-regate-carries-provenance` tonight.
   **TWO OF MY OWN CELLS WERE WRONG AND THE CELLS CAUGHT THEM, NOT READING:** the
   expiry filter keyed on a field a `DerivedSessionExpiry` does not have, so
   nothing ever expired and a stale record travelled; and the first test contract
   was a two-field stub that died inside the expiry owner.
   **VALIDITY IS ASKED, NEVER RE-ANSWERED** — `buildDerivedSessionExpiryCandidates`
   owns it, and because its candidates are ALTERNATIVES, a record any candidate
   would expire is not carried.
   Registry rows `LAW-regate-carries-provenance`, `LAW-no-invented-fixture`.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 3).

4. **BUILT — THE MODERATE HALF NOW SPEAKS, AND A FOURTH WORD WAS FOUND.**
   **THE INSTRUCTION THIS ITEM ANSWERS TO, in Sam's words:** *"4 hard days plus
   1 moderate/easy day"*. (Kept inline when the original order was archived —
   his words are the standing authority, not history.)
   **THE RANGE AND THE ADVISORY ARE IN.** `preferredModerateDayRange` on the
   contract (min 1; **max 7 meaning UNBOUNDED — the ruling gives a minimum and
   no ceiling, and a max of 1 would make a two-moderate-day week a defect**), and
   a `moderate_day_missing` finding that is **advisory and can never be anything
   else**. Held by `test:section18-v2`, 3 cells, in the chain.
   **THE MUTATION DEMONSTRATES THE RULING RATHER THAN ASSERTING IT:** making the
   finding `blocking` does not merely red a cell — it throws
   `Section18WeekAcceptanceError` and takes the suite down. That is exactly the
   outage "advisory, never blocking" exists to prevent.
   **THE CELLS DRIVE THE CONTRACT NUMBER, NOT A WORLD.** The first version
   asserted "a week with no moderate day" over a hand-built fixture that turned
   out to have TWO — the fixture was wrong, not the rule.
   **AND THE REASON THE MODERATE TIER LOOKED EMPTY HAS A SECOND CAUSE:**
   `section18OfferPlacement.ts:508` wrote `stressLevel: 'moderate'` — **a word
   outside the union `high | medium | low`**, cast `as never` two lines below so
   the compiler never saw it. The ledger counts a moderate day by `=== 'medium'`,
   **so every offer the app marked as the easier option was invisible to the
   count.** Fixed, and guarded by a source scan (`LAW-stress-vocabulary-is-one-word`)
   because a type cannot reach past a cast. **The scan had to be widened twice —
   it missed its own founding case (a ternary), then flagged a comparison operand
   — and both corrections carry their own probe.**
   **⚠ THE FIX CHANGED NOTHING MEASURABLE AND THAT IS REPORTED, NOT HIDDEN:** all
   17 QA scenarios are identical before and after (4 of 17 meet both preferences
   in both arms) because that placer does not run in them. **12 of 17 still have
   zero moderate days.**
   **NOT BUILT: the generation target toward 4+1.** The item itself says nothing
   about WHICH session should become moderate or at whose expense — **that is
   Sam's call, and it is the only thing left on this item.**
   Registry 103/71 -> 105/73, **UNENFORCED unmoved at 32** (the vocabulary law
   was born UNENFORCED and its guard built in the same pass rather than banked as
   debt).

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 4).

5. **BUILT — THE 17 NOW ANSWER "IS THIS A WEEK SAM WOULD WRITE".**
   `LFA_HARD_DAY_PROBE=1 npm run test:qa` prints a table across all 17: hard
   days, anchor-caused hard days, moderate days, each week's own preferred
   maximum, a score, and a verdict against a committed baseline
   (`scripts/preference-baseline.json`). **Same flag, no second seam**, as
   ordered.
   **TODAY'S NUMBER: 4 of 17 weeks meet both of his ruled preferences. 0 hard
   violations.**
   **THE SCORE INVENTS NO POLICY** — it counts RULED preferences (hard days
   within the week's own preferred max; at least one moderate day), each quoted
   at the code, both thresholds READ from the contract so an off-season week
   whose preferred max is 2 is judged against 2, not 4. A fifth hard day costs
   the preference and is never a violation (stand-down A).
   **THE THREE OUTCOMES ARE KEPT APART** — hard failure, preference regression
   (continues only with a stated reason), intentional change (baseline updated
   with evidence) — and **over-fitting is mechanical**: improvements ≥ 1 with
   more regressions than improvements is REJECTED.
   **`test:qa` PRINTS AND DOES NOT BLOCK, ON PURPOSE:** it carries 84
   pre-existing failures, so a verdict inside its exit code would be
   indistinguishable from them. The rules are held by **`test:preference-shape`,
   8 cells, green, in the chain**, three mutations killed. Registry row
   `LAW-preference-report`; 102/70 -> 103/71, UNENFORCED unmoved at 32.
   **⚠ ONE DISCREPANCY FOR THE SEAT, NOT RESOLVED HERE.** Item 4 records the
   shape as occurring in **2 of 17 and in ZERO fixture weeks**. My count is
   **4 of 17**, and two of the four (S3, S12) carry anchor-caused hard days.
   **The two counts are different questions** — "exactly 4 hard days" versus
   "within this week's preferred maximum" — and I have not established what item
   4 counted as a fixture week. **A count names its instrument's unit; both
   readings are printed side by side in the table rather than reconciled by
   assertion.**

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 5).

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
   load is a coaching question. **Written under `## AWAITING SAM`.**
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

8. **BUILT — MY STATUS OWNS THE MODIFIERS, AND SAM HAS SEEN IT ON GLASS.**
   `a0e293b3` (writers take their source as a parameter) → `8de98d3f` (a+b, one
   commit) → `2e16fb9f` (c) → `cbc36bcf` (his copy ruling). **The ruled order
   was kept.** All eight modifier actions are live on My Status;
   `EMPTY_EQUIPMENT_FACT_IDS` is retired; the caption and its guard are gone; the
   Program-side leftovers are deleted. Held by `test:my-status-modifiers` (8
   cells), `test:coach-note-action-source` (4) and
   `test:program-tab-read-only-modifiers` (6), all in `test:bible`, all
   mutation-checked. `.maestro/golden/coach-my-status.yaml` is green on LFA
   Explorer and its not-yet assertion is INVERTED, not deleted.

   **FOUR THINGS THE ORDER DID NOT CONTAIN, each found by building it:**
   **(1) THE DECISION LEDGER RECORDS NONE OF THESE ACTIONS** — only three
   exercise-level types reach it, so the tape is the whole record and the order's
   "tape and ledger" premise was half false. **(2) THE DURABLE DOOR WAS DROPPING
   THE SCREEN** (`program_control_durable:<surface ?? screen>`, and every
   coach-note action sets a surface) — the lift would have LOST the provenance,
   not forged it. **(3) `coach_tab` WAS THE WRONG VALUE**: it maps to the
   diagnostic label `'coach'`, the field Sam asked for on 2026-08-10 so an
   investigation can tell his own tap from a coach-authored change. The screen id
   is `my_status`. **(4) THREE COMPONENTS HAD TO BE EXTRACTED, NOT DELETED** —
   the confirmation sheet, the rebuild sheet and the rebuild owner all lived
   inside `HomeScreenV2`, and (a) made My Status depend on all three. The rebuild
   was measured, not assumed: four modifier families return
   `rebuildRequired: true`.

   **SAM RULED THE STATUS SHEET TWICE THE SAME DAY, AND BOTH ARE RECORDED.**
   *"Drop 'Worse' … four options only … And change 'Still sick' to 'Still pretty
   sick'"*, then *"actually keep worse for now"*. The rename ships, `worse`
   stays, five answers, all now SIGNED copy rather than inline literals.

   **AWAITING SAM — see `## AWAITING SAM` below.** The second half of his design
   is not built.

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

10. **BUILT — THE GATE EXISTS, AND ITS FIRST RUN FOUND SIXTEEN, NOT TWO.**
   **THE INSTRUCTION THIS ITEM ANSWERS TO:** the §4 class named *"Computed and
   unread"* — a field *"computed eight times over"* and read by nothing. (Kept
   inline when the original order was archived.)
   `test:computed-must-be-consumed`, in `test:bible`, mutation-checked three
   ways with a liveness arm. §4 named two `contract.*` offenders; measuring all
   **42 assigned `contract.*` fields found SIXTEEN** written on every assessment
   and read by nothing — **fourteen of them one module's entire achieved-ledger
   family** (`section18EffectiveWeekEvaluator`). **The doc's nine was a sample,
   not a census** — `LAW-count-names-instrument` again, and why the gate
   measures instead of encoding the list it was handed.
   **The sixteen are declared as dated debt and the list MAY ONLY SHRINK:** the
   gate reds when the set grows AND when a declared field gains a reader without
   leaving the list.
   **NOTE FOR ITEM 4's OWNER:** `achievedModerateDayCount` is STILL unread. The
   moderate-day finding reads `ledger.restStress.moderateDays.length` directly,
   so that unit did not close this one.
   **WHAT IT DOES NOT COVER, STATED:** six of §4's nine are not `contract.*` —
   a Set indexed `[0]`, a decision list, a collapsed N-list. `canOverride` was
   closed separately (`LAW-warn-then-allow`, `ca33206f`). A call-graph gate for
   "exported and never called" is NOT built.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 10).

11. **BUILT — THE FEATURE REGISTRY EXISTS, AND THE NUMBER IS UGLY AS ORDERED.**
   `src/rules/featureRegistry.ts` + `test:feature-registry`, in `test:bible`,
   mutation-checked three ways with a liveness arm. `lawRegistry`'s shape
   verbatim — no second mechanism — plus the one field laws do not need.
   **SEEDED: 9 rows, 7 held, 2 UNPROVEN, 3 BUILT-BUT-UNREACHABLE.**
   **`reachable` IS THE POINT:** a law is true or not, but a feature can be
   built, tested and impossible to get to. An `athlete_reachable` + `held` row
   must say in its receipt HOW IT WAS SEEN, or the cell reds.
   **IT DOES NOT RED ON `UNPROVEN`, deliberately** — Sam ruled an unguarded RULE
   is a rule not followed; an unproven FEATURE is simply unproven, and reding
   would mean a row could only be added once finished, so the roster would fill
   with lies or stay empty. The count is PRINTED instead.
   **THE ROSTER DECLARES ITS OWN INCOMPLETENESS** (`FEATURE_REGISTRY_SCOPE`,
   asserted): it covers only what this terminal could write a receipt for on
   2026-08-12. **Growing it is the work.**

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 11).

12. **BUILT — THE MECHANISM SHIPS, THE PICTURES DO NOT (as ordered).**
   `src/dev/uiPictureManifest.ts` + `test:ui-picture-manifest`, in `test:bible`,
   mutation-checked both ways. **SHA in the filename, a TRACKED manifest
   (`artifacts/` is gitignored, so mtime dies at clone), one gate cell, and the
   index may never pin to a docs commit.**
   **IT RED ON ITS FIRST RUN, ON THE FOUNDING DEFECT.** `a9c82856` changed two
   docs and nothing else; `UI_STATE_2026-08-12.md` said its four surfaces "stand
   at" it. **The pin is now GONE rather than corrected** — the shots really are
   out of date (`8de98d3f` changed My Status, `e231a6bc` merged three UI fixes),
   so a truer SHA would still point at pictures that do not show it.
   **ALL FOUR ROWS ARE `STALE` AND SAY WHAT RE-SHOOTING TAKES. NOT RE-SHOT,
   DELIBERATELY** — *"Then shoot once, after Sam's UI work settles."*

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 12).

13. **KEEP THE UNENFORCED LAW COUNT FALLING.**
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

15. **BUILT — THE MOVE IS FINISHED AND THE BRIDGE IS GONE.**
   `SeasonPhaseShiftSheet` (props, `BackChevron`, the component and its 20 style
   rules) moved BYTE-FOR-BYTE into `src/components/SeasonPhaseShiftSheet.tsx`;
   the six-line re-export is deleted. **A file that says "during the move" and
   never stops saying it is a file that has stopped being read.**
   **THE ORPHANED STYLE WAS FOUR, NOT ONE.** The item names `phaseCard`;
   `phaseBadge`, `phaseBody` and `phaseBodyAccent` also measured ZERO uses
   repo-wide. The phase card left Program at the merge and its styling stayed a
   month — **the existing style gate greps USAGE, so a definition nothing uses
   passes it**, which is exactly why the item had to name one by hand.
   **TWO GUARDS MOVED WITH THE SURFACE:** `profileResetUITests`' day-grid region
   and `coachTabSlice3Tests`' phase-review cell both sliced `HomeScreenV2` for a
   component no longer in it. Re-aimed, not deleted.
   **ON GLASS:** `.maestro/golden/coach-my-status.yaml` green end to end, phase
   review included (Review -> the three options -> Confirm -> "What days can you
   train?" -> Cancel).

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 15).

16. **SAM HAS RULED — MOUNT THE STRIP ON DAY AND WEEK. THE SECOND HALF OF HIS
    OWN DESIGN, ANSWERED 2026-08-12.**

    **OWNED BY THE DESKTOP AGENT — THE ONE THAT ASKED THE QUESTION AND HAS THE
    SIMULATOR. TERMINAL: DO NOT TAKE THIS ITEM.** It edits `HomeScreenV2.tsx`,
    which is mid-flight in this shared checkout, and it must be SEEN on glass
    before it is called done — a count row that renders behind a header or under
    the notch passes every assertion and is still wrong. **Terminal, skip to
    item 13 and item 14's NOT STARTED half.** He was asked yes or no in the item-8 stop
    report. **Sam:** *"yes — one line on week, small card on day, read-only
    both"*. That is the whole spec and it matches what `ModifiersStrip` was
    already written to do.

    **THE COMPONENT ALREADY TAKES THE SURFACE.** `ModifiersStripProps.surface`
    is `'day' | 'week' | 'coach'`; the week branch and its copy keys
    (`modifiers.strip.week`, `modifiers.strip.week_one`) exist; the testIDs are
    `modifiers-strip-${surface}`. **Nothing new is designed. It is mounted once,
    on `CoachTabScreen.tsx:442`, and this order mounts the other two.** Do not
    write a second component — the header says why, and the seat says it again:
    three copies of a count row is three places for the count to disagree.

    **WHAT TO BUILD:**
    (a) **Week — ONE LINE.** The `surface="week"` branch above the seven day
    rows in `HomeScreenV2.tsx`'s week view, above `day-row-mon`.
    (b) **Day — A SMALL CARD.** The `surface="day"` branch above the day card,
    which is ruling 4's placement and already what the component's header
    describes.
    (c) **READ-ONLY, BOTH.** Tapping opens My Status. **It carries no controls
    of its own** — cell [5] of `test:program-tab-read-only-modifiers` holds that
    and must stay green. `<ActiveModifiersSection>` does NOT come back to
    Program.
    (d) **The count comes from `useActiveModifiers`, never a separate count.**
    (e) **Zero means nothing on Program** — the component already returns null
    at `count <= 0` for non-coach surfaces. Leave that. Coach keeps its
    permanent doorway.

    **THREE ASSERTIONS ENCODE ITS ABSENCE ON PURPOSE AND ALL THREE MUST INVERT
    IN THIS COMMIT** — measured 2026-08-12, not guessed:
    - `src/__tests__/programTabIsReadOnlyModifiersTests.ts:172-180`, cell *"the
      day/week indicator is still MISSING, and this cell is the record"*. Its
      own failure message tells you to invert it. **Invert, do not delete** —
      and rewrite the comment block at `:147-159` so the next reader is not told
      a built thing is missing.
    - `.maestro/golden/coach-my-status.yaml:24` and `:100` —
      `assertNotVisible: modifiers-strip-day`.
    - `.maestro/golden/standard-program-week.yaml:60` (day) and `:100` (week) —
      both `assertNotVisible`. **The week one sits right after `day-row-fri`, so
      the flow already walks past the exact place the line goes.**
    **A flow that asserts a thing is invisible does not fail when you build it —
    it fails when the strip appears, which is the point. Invert all four cells,
    or the golden flows red for a correct change and someone reverts it.**

    **THEN THE REGISTRY ROW.** `src/rules/featureRegistry.ts:128-129` carries
    this as BUILT-BUT-UNREACHABLE with `wouldTake` naming exactly this work.
    **Flip the row to held/reachable and rewrite the receipt with the mount
    sites** — a registry that still says UNREACHABLE after the thing is mounted
    is the defect the registry was built to kill.

    **WHY THIS IS SAFE UNDER STAND-DOWN D:** it is a mount and four assertion
    inversions. It touches no generator file, no `generationAnchorISO`, no
    `section18CraftTier.ts`. **Stage by path.**

    **PROOF OWED IN THE STOP REPORT:** the two new mount lines quoted with file
    and line; the four inverted assertions quoted; `test:program-tab-read-only-modifiers`
    green with cell [5] still green; the registry row's new text.

17. **SAM HAS RULED — A GAME'S LOAD IS READ, FULL, SAME UNIT AS EVERY OTHER
    SESSION.** Asked under `## AWAITING SAM` since item 6. **Sam, 2026-08-12:**
    *"yes don't we do 'how long was your game?' and multiply by game RPE for a
    score that counts toward load?"* — **and the app already asks both.**
    `SessionFeedbackPanel.tsx:383` asks the duration (hours + minutes),
    `:415` asks the effort on the 1-10 slider, both are validated at the
    transaction boundary (`sessionOutcome.ts:130,137`) and **read by nothing.**

    **BUILD `gameSRPE`, THE SAME SHAPE AS THE TWO THAT EXIST.** `bodyRpe x
    timeOnGroundMinutes`, in `journalLoad.ts` beside `conditioningSRPE` and
    `teamTrainingSRPE`. **Missing either half means UNMEASURED, never
    half-counted** — that rule is already written in both siblings and must not
    be softened here. Carry it into `deriveSessionLoad`, count it in `measured`,
    and wire it from the journal producer **so it is read end to end** — a
    reader that stops at `deriveSessionLoad` recreates the exact defect item 10
    exists to catch.

    **DELETE THE COMMENT THAT SAYS THIS IS UNRULED.** `journalLoad.ts:544-549`
    reads *"A GAME IS DELIBERATELY NOT HERE ... a coaching question nobody has
    ruled"*. **It is ruled. That comment becomes a lie the moment this lands**,
    and a stale comment beside a live reader is what sent the last four
    measurements down the wrong path. Replace it with the ruling and its date.

    **FULL, NOT WEIGHTED. Do not invent a discount** because a game "isn't
    training" — Sam considered the three options and chose full. Registry row,
    cells in `test:journal-load`, one mutation killed at minimum.

18. **SAM HAS RULED — STRENGTH ASKS HOW LONG IT TOOK. OPTION (a), AND IT CLOSES
    THE LAST GAP IN EXPERIENCED LOAD.** **Sam, 2026-08-12:** *"i think do a for
    now and I will think of if thats good enough long term"*. **The "for now" is
    his, not a hedge to build around: build (a) properly, do not leave a seam
    for (b) or (c).**

    **THE MEASURED GAP IS ONE FIELD, NOT THREE.** Re-measured 2026-08-12: a
    strength session already asks *"How hard was the session?"* on the 1-10
    slider and stores it as `difficulty` (`SessionFeedbackPanel.tsx:1065,892`).
    **Actual minutes is the only missing half.**

    **BUILD:** an actual-duration input on the strength feedback form — **the
    same hours + minutes pair the game form already uses (`:383-410`), not a
    second design** — validated the same way, then `strengthSRPE` =
    `difficulty x actualMinutes`, wired end to end exactly as item 17.

    **PLANNED MINUTES ARE NOT THE FALLBACK ANYMORE.** Sam chose (a) over (b) on
    purpose. **A session missing the answer is UNMEASURED**, same as the other
    three. Do not quietly substitute `domain.ts:834`'s planned value — that is
    option (b), which he did not choose, and it would make the column look
    complete when it is not.

    **WHEN THIS LANDS, ALL FOUR KINDS ARE REAL.** Say so in the stop report with
    the four function names, because that is the sentence item 6 has been
    reaching for since it was written.

19. **SAM HAS RULED — AS MANY GAMES AS THE WEEK NEEDS, AND THE BUTTON IS THE
    WHOLE PROBLEM.** The `## AWAITING SAM` entry asked whether a second game
    field should land or two-game weeks be ruled out of scope. **Both were the
    wrong question.** **Sam, 2026-08-12:** *"no a user should be able to have as
    many games as needed in their week. Are you talking about having a button
    that says 'add a game' when in season - like the 'add pre season practice
    match' button?"* — **yes, that button, and he found the defect from the
    couch.**

    **MEASURED 2026-08-12, ALL THREE:**
    - `useHomeScreen.ts:1315` — `const showPracticeMatchCTA = currentPhase ===
      'Pre-season';`. **In season there is NO add-a-game control at all.** The
      picker banner at `HomeScreenV2.tsx:612` already writes the in-season
      words — *"Tap the day to set as game day"* — **for a mode nothing in
      season can enter.** The copy was ready and the door was not.
    - `HomeScreenV2.tsx:156` — `weekDays.find(day => day.workout?.workoutType ===
      'Game')`. **`find`, so the FIRST.** Once one fixture exists the control
      stops offering "add" and becomes a label for that one
      (`:157-161`), and `handlePracticeMatchPress` (`:162`) routes to its
      actions instead of the picker. **There is no second-game route on any
      screen.**
    - **THE ENGINE IS ALREADY READY AND THIS IS WHY THE ITEM IS SMALL.**
      `derivedWeekContract.ts:90` was THE WAIST and it was unpinched
      (`3f62ad62`): `targetWeekFixtures` returns the whole week sorted and
      `fixtureDays` now carries **every** fixture, so each gets its anchor,
      its G-1/G-2 protection and its credit. **This item is UI. It does not
      re-open the contract.**

    **OWNED BY THE DESKTOP AGENT, WITH ITEM 16 — BOTH EDIT
    `HomeScreenV2.tsx`. TERMINAL: DO NOT TAKE THIS ITEM.** Two agents adding
    controls to the same screen in a shared checkout is how the last merge cost
    an hour. **Terminal takes 17, 18 and 20**, which are rules and journal files
    and touch no screen.

    **BUILD:**
    (a) **The control shows IN SEASON as well as pre-season**, with the label
    following the phase — "Add a game" in season, "Add a pre-season practice
    match" in pre-season. The banner copy already branches; match it.
    (b) **It stays an ADD control after the first fixture.** Existing fixtures
    are reached by tapping their own day, which already works — the control's
    job is adding, and one week may need several.
    (c) **No cap.** Sam's words are *"as many games as needed"*. **Do not add a
    two-game limit, a warning at three, or a confirm.** If the week gets ugly
    that is the contract's job to disclose, not the button's job to prevent.

    **DO NOT ADD A SECOND GAME FIELD TO THE PROFILE.** `gameDay` and
    `usualGameDay` are the DEFAULT competition day, not the week's fixtures —
    read through `rules/gameAnchor.ts`. The calendar holds the real ones. The
    `## AWAITING SAM` entry that proposed a second field is **withdrawn** by his
    answer; strike it rather than leaving two answers in the file.

    **THEN ITEM 7 IS UNBLOCKED.** His own case — *"only doing 1 strength session
    ... if they have 2 games and 2 team trainings"* — **becomes representable
    the day this lands.** Say so in the stop report.

20. **SAM HAS CHOSEN THE WORDS — AND THE REAL DEFECT IS THAT ONE SENTENCE
    SERVES TWO DIFFERENT CAUSES.** **Sam, 2026-08-12:** *"yeah thats bad
    wording"*, then **A**:

        "With a game Saturday, there's only room for two strength sessions
        this week."

    **`renderSection18Shortfall` (`:96-103`) has ONE unconditional sentence**,
    *"Resting {day} means you'll miss {n} {type} session(s) this week"*, and
    `Section18Shortfall` carries only `date` / `type` / `count`. **The date is
    "the date whose fact caused the shortfall" — and that fact can be the
    athlete's OWN rest mark or the club's fixture. The sentence assumes rest
    every time.** That is precisely what Sam objected to: it blames him for the
    draw.

    **SO THE TYPE GROWS A CAUSE, AND THE RENDERER BRANCHES:**
    - **fixture-caused** — Sam's new sentence, above.
    - **athlete's own rest mark** — the EXISTING sentence stays. *"Resting
      Friday means you'll miss a strength session this week"* is honest when
      resting Friday is what he chose. **Do not replace it; it was never the
      defect.**

    **SAM'S SENTENCE STATES WHAT FITS, NOT WHAT IS MISSED — and `count` is the
    missed number.** *"only room for two"* needs the target as well. Either
    carry the fitting number on the shortfall or derive it at the one call
    site; **do not subtract a hardcoded target inside the renderer.** Word the
    number, not the digit, at one and two ("a" / "two"), matching the article
    rule already in `articleFor`.

    **THE COPY IS EQUALITY-BOUND IN BOTH DIRECTIONS** by
    `section18ShortfallCopyTests` against the design record, same regime as the
    G-1 warning. **Update the record and the test in the same commit** or the
    gate reds on a change Sam signed. `ATHLETE_FORBIDDEN_VOCABULARY` still
    applies to the new string.

    **⚠ SAM, ONE LINE BACK IN THE STOP REPORT:** the branch above is the seat's
    reading of *why* the wording was bad, not a second ruling by him. **If he
    wants his sentence used for BOTH causes, say so and the rest branch goes.**

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

    **THE COUNTS IN THE 120-SESSION MEASUREMENT ARE THEREFORE OVERSTATED.** A
    "4-exercise" team night is a 3-exercise lift; a "2" is a single exercise.
    **Re-run and re-report with team-training rows excluded before building
    anything — the real gap is bigger than the item says.**

    **GENERATION, SO STAND-DOWN D HOLDS ON THE BUILD.** The measurement above is
    already done; the re-count is a harness run and needs no generator edit.

    **Sam, on testing:** *"run whatever little tests you have to"*. Behavioural
    cells, and the 120-session distribution is the instrument: team nights join
    strength and mixed days in the 4-6 band **without the other two moving.**
    Run the 17 QA scenarios either side and report both numbers.

Not ordered yet, shaped in `ATLAS_VERIFICATION` §4: retire dormant code to
`src/retired/` (49 unreachable tap sites, 67 unmounted routes); make onboarding
addressable then walk it; the harvest ratchet and a computed tap atlas.

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
- **DECISION OWED — the moderate-day generation target (item 4).** The range and
  the advisory are built; nothing says WHICH session becomes the moderate one, or
  at whose expense.
- **ANSWERED 2026-08-12, ALL FOUR — now items 17, 18, 19, 20. Do not re-ask.**
  A game's load counts **in full** (17). Strength gets an **actual-minutes
  field**, option (a) (18). **As many games per week as the athlete needs**, and
  the profile does NOT grow a second game field — the add-a-game button is the
  defect (19). The shortfall sentence gets **Sam's wording for fixture-caused
  shortfalls only**; the rest-mark sentence stays (20).
- **CLOSED, do not re-ask:** the week-card shape; the accounts question
  (LOCAL-ONLY); the platform question (iPHONE-ONLY).

## Previously (now processed)

`docs/SEAT_INBOX_ARCHIVE_TO_2026-08-10.md` — most recently the craft validator,
cleared 2026-08-12. **This file holds LIVE ORDERS ONLY.** It was 353KB once and
every stop paid to re-read it.

## HOUSEKEEPING (not an order — the hook stops scanning before here)

**EVERY ORDER LIVES UNDER `## Unprocessed`. Sub-headings inside it MUST be
`###`.** `scripts/seat-inbox-hook.sh` bounds its scan at the next `## `, so an
order under its own `## ` heading is INVISIBLE to the stop hook and Sam becomes
the courier. The seat did this twice on 2026-08-12. **A guard cell now exists
(`1fcf5c04`) — but keep orders in ONE numbered sequence anyway: three schemes
(000/00/0a/0 plus a second 1-4 inside a context section) is why the terminal
picked the wrong item three times.**
