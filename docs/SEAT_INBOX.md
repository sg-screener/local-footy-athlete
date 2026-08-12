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

**AND THE 4+1 GENERATION TARGET IS PARKED TOO, 2026-08-13 — SAME AREA, SAME
ANSWER: NOT NOW.** **Sam:** *"stop worrying about this moderate day thing - this
is only on 17 QA - when we get deeper into the app and test 100 then we will
have many more useful scenarios where it might make sense"*. **Reopen when the
harness carries ~100 weeks, not before. Do not re-ask.** See item 4.

**B. HYDRATION MAY QUIETLY RE-SHAPE THE DAYS AHEAD — ALREADY ANSWERED.** **Sam:**
*"once a session is done then it's locked in, only the rest of the week can
change ... wednesday to sunday should adjust to accomodate this"*. Both halves
already match the code. **No work owed. Do not ask again — fourth appearance of
the granted-permission defect.**

**D. HANDS OFF THE GENERATOR AND THE GENERATION ANCHOR — ANOTHER AGENT HOLDS
THEM. Sam, 2026-08-12:** *"Claude Code is working the reopen bug in this same
folder. Stay out of the program generator and anything touching the generation
anchor until it's done."*

**WHO "ANOTHER AGENT" MEANS — CLARIFIED BY SAM 2026-08-13, AND IT HAD ALREADY
COST ONE WRONG SELF-BLOCK.** *"you're Claude Code, and you're the one who had
it. Stand-down D was written for the terminal to keep it off your files."* **This
stand-down points ONE WAY: it keeps the TERMINAL out of the desktop agent's
generator work. The desktop agent is not blocked by it and never was** — it read
its own stand-down as applying to itself and offered to build item 22(c) in
halves for no reason.

**AND IT IS SPENT. Sam:** *"Your reopen-bug fix landed 9 hours ago and no
generator file has moved since, so unless you know otherwise the generator is
free."* **VERIFIED 2026-08-13 02:18 rather than taken on trust:** the newest
commit touching `generateProgram.ts`, `coachingEngine.ts`, `weekRebuild.ts`,
`derivedWeekContract.ts` or `acceptedStateTransaction.ts` is `f2152d2b` at
08-12 17:05 — nine hours — and every one of those files is clean in the working
tree. **The generator is FREE. Item 22(c) may be built whole, rebuild included.**
(One adjacent file, `acceptedStateTransaction.ts`, carries uncommitted work from
the other seat; it is not on the rebuild path, but stage by path as always.)

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

**AND STAGING BY PATH IS NOT ENOUGH — STAGE AND COMMIT IN ONE STEP. SIGHTING 2,
MEASURED 2026-08-13.** Twice now, work staged by path was swept into the OTHER
agent's commit before its own `git commit` ran, landing under a subject that
describes different work entirely:
- **`4b5218e0` "docs(inbox): ITEM 21 CUT TO THE RULE"** actually carries all of
  **items 16 and 19** — 12 files, the day/week modifier notice and the
  add-a-game control.
- **`c8f2b4b8` "docs(blocked): ITEM 20 CANNOT BE BUILT AS WRITTEN"** actually
  carries **`ModifiersSheet`**, Sam's "add the popup" sheet, and its five signed
  strings.
**Nothing was lost and both are verified** — but `git log` now lies about when
those features landed, and anyone bisecting will be reading the wrong subjects.
**THE HALF THAT IS OURS TO FIX:** a `git add` in one command and a `git commit`
in the next leaves a window the other agent's `commit` walks through. Run them
as ONE command (`git add <paths> && git commit ...`). **The half that is not:**
whatever that agent uses commits the whole index rather than its own paths,
which is this stand-down's existing rule being broken from the other side.

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
   **PARKED BY SAM 2026-08-13 — DO NOT BUILD THE GENERATION TARGET, AND DO NOT
   RE-ASK.** The seat re-ran `test:qa` and reported the real shape rather than
   the item's summary: **NINE of 17 weeks build FIVE hard days** (S1, S2, S4,
   S10, S11, S13, E1, E2, E3); four build four; two build three; two build one
   (off-season low availability, correctly small). The narrowed question put to
   him was which of the five softens — team nights and the game cannot, leaving
   the Monday strength day or the midweek conditioning day. **His answer was to
   refuse the question at this sample size:** *"stop worrying about this moderate
   day thing - this is only on 17 QA - when we get deeper into the app and test
   100 then we will have many more useful scenarios where it might make sense"*.
   **THE REOPEN CONDITION IS THE SCENARIO SET, NOT A RULING:** revisit when the
   harness carries roughly 100 weeks. **Until then the moderate-day target is not
   owed, not blocked, and not a defect.** Everything built above — the range, the
   advisory finding, the stress-vocabulary law — STAYS: it costs nothing and it
   is the instrument that will answer him when the set is big enough.
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

16. **BUILT AND SEEN ON GLASS — THE DAY AND WEEK SAY WHAT IS CHANGING.**
    Mounted twice in `HomeScreenV2.tsx`: `surface="day"` above the day card,
    `surface="week"` above the seven rows. The count is
    `useActiveModifiers().count` — and `useHomeScreen`'s inline
    `selectActiveCoachNotes` memo, whose inputs were byte-identical, was
    **COLLAPSED into that hook** rather than joined by a third copy, so rule (d)
    is structural rather than a promise. Read-only; tapping navigates `CoachTab`
    with `status: 'open'`. Registry row flipped to held.

    **FOUR ASSERTIONS, AND ONLY THREE WERE FLIPPED — THE ORDER'S OWN LIST WAS
    NOT SAFE TO FOLLOW LITERALLY.** `coach-my-status.yaml`'s FIRST one sits in
    the "NOTHING ACTIVE" block; flipping it would have asserted the opposite of
    rule (e), so it is KEPT and re-commented as the zero-state proof.
    `standard-program-week.yaml`'s two could not be flipped until its modifier
    door was fixed: it tapped `equipment-preset-open`, **an id no product source
    produces**, so both sat in a zero-modifier world where the strip correctly
    renders nothing. Door re-routed onto the readiness door, then inverted.

    **AND THERE WERE SIX, NOT FOUR.** `dayFirstTimelineTests` and
    `coachTabSlice3Tests` each also asserted Program does not mount the strip.
    The latter was ONE `&&` over two different claims — no notice, no list — and
    only the first was ruled away, so it is SPLIT rather than loosened.

    **THE FIRST THREE CELLS SHIPPED GREEN AND EMPTY.** A mutation run broke ONE
    of the two mounts and they stayed green: they searched the whole FILE for
    `count={modifierCount}`, and the surviving mount kept the string there. The
    mounts are now extracted and asserted one by one. **Five mutations, five
    killed.**

    **ON GLASS:** `.maestro/golden/program-modifier-notice.yaml` — zero shows
    nothing on BOTH shapes, both surfaces appear with a real readiness modifier,
    both open My Status. `coach-my-status.yaml` green end to end.

    **ONE RED LEFT BEHIND, AND IT IS NOT THIS UNIT'S.**
    `standard-program-week.yaml` now reaches PAST its dead door and fails at
    `program-week-previous` -> "Return to this week". A no-modifier control run
    reproduced it exactly: the seed holds ONE week, so that control is inert and
    the label never changes. Pre-existing, newly visible, and it belongs to that
    seed.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 16).

17. **WORKING — A GAME'S LOAD IS READ (`f923523a`).** `gameSRPE` = body RPE x
    minutes on the ground, in `journalLoad` beside its two siblings, carried into
    `deriveSessionLoad`, counted in `measured`, and wired from the journal
    producer. **FULL, NOT WEIGHTED** — no coefficient exists in the path and a
    cell pins the product. Missing either half is UNMEASURED, never half-counted.
    **The "nobody has ruled" comment is deleted in the same commit that made it
    false**, in both `journalLoad` and the sibling registry row.
    **The test that fails if it breaks:** `test:journal-load` (124 -> 133 cells),
    plus a SOURCE cell requiring `JournalScreen` actually hand the game over —
    a reader that stops at `deriveSessionLoad` is the defect item 10 names.
    **Mutation-checked four ways:** half-counting, a smuggled 0.5 discount,
    dropping the game from `measured`, unwiring the producer. Registry row
    `LAW-game-load-is-full`.
    **MEASURED LIMIT:** `gameSRPE` stops at the session load and the `measured`
    flag — **exactly as `teamTrainingSRPE` does. NEITHER reaches
    `JournalLoadWeekTotals`**, where only conditioning has a stream. So a rated
    game moves the week's measured-session count and its own row, and no weekly
    load number yet. **That is item 6's open question, not this one's.**

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 17).

18. **THE RULE AND THE STORE ARE WORKING; THE INPUT IS BUILT (`2132f9b3`).**
    **ALL FOUR KINDS ARE REAL** — `conditioningSRPE`, `teamTrainingSRPE`,
    `gameSRPE`, `strengthSRPE` — which is the sentence item 6 has been reaching
    for, and a cell asserts it rather than announcing it.
    **THE GAP WAS ONE FIELD:** effort was already stored as `difficulty`; actual
    minutes was the only missing half. **Option (b) is the trap and three cells
    guard it** — nothing back-fills the planned value, and a mutation adding a
    60-minute default reds all three. **NOT SAVE-BLOCKING on purpose:** the
    ruling's own shape is that a missing answer is UNMEASURED, so a blank must
    not strand an athlete who did not time their lift.
    **THE WORDS ARE SAM'S — "Rough time in the gym"**, chosen by him 2026-08-13
    from his own two existing lines. Hours/minutes labels and the refusal are
    REUSED from the game copy, not re-signed. Same `parseHoursMinutes`; not a
    second design.
    **THE CELL THAT EARNS ITS KEEP:** `buildSessionFeedbackPayload` REBUILDS its
    object, so a field it does not name is lost when the athlete edits an answer
    — the class that bit the team-night unit. Asserted THROUGH the builder on the
    checklist path. `test:journal-load` -> 142, `test:team-night-size` -> 56.
    Registry row `LAW-strength-load-is-actual-minutes`.
    **BUILT, NOT WORKING, ON THE UI HALF — AND THAT IS THE HONEST WORD.** No cell
    mounts the panel, so **nothing proves the athlete SEES the new input or that
    it sits right on the screen.** Needs a simulator pass; **PARKED behind Sam's
    phone rebuild (stand-down C), never a request.**

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 18).

19. **BUILT AND SEEN ON GLASS — ONE ADD-FIXTURE CONTROL, WEEK-ONLY, NO CAP.**

    **THIS ITEM'S OWN PREMISE WAS WRONG AND THE CODE SAID SO.** It states "in
    season there is NO add-a-game control at all". **There was one.** It was
    gated `!weekHasGame`, so it existed on an empty week and VANISHED the moment
    the week had a fixture. Pre-season's card had the same defect in other
    clothes: `weekDays.find(...)` took the FIRST fixture, and once one existed
    the card stopped being a button and became a LABEL routing to that fixture.
    **Neither phase had a route to a SECOND game — a CAP, not an absence.** Same
    fix, different reason; building against "there is no control" would have
    added a third card beside the two that already existed.

    **TWO CARDS BECAME ONE**, gated on the phase alone, labelled by phase ("Add
    a game" / "Add a pre-season practice match"), always adding. No cap, no
    warning at three, no confirm. `weekHasGame` left the hook with its last
    reader, and the four orphaned `addGame*` style rules went in the same commit
    as their call site — item 15's lesson, since the style gate greps USAGE.

    **THEN SAM MOVED IT, 2026-08-13:** *"add a game button should only be on
    week screen - not day screen and then you select what day you need to add it
    too"*. The control sits in the shared scroll body, which BOTH shapes draw,
    so it had inherited the day screen by default rather than by decision. Gated
    `!dayFirst`. **The ruling also closes a logic hole:** tapping it enters the
    picker, and a picker forces the week shape — so on the day screen its only
    possible next act was to leave the day screen. "Which day?" is a week
    question.

    **ON GLASS:** `.maestro/golden/add-a-game-in-season.yaml` — the day screen
    does NOT carry it; the week screen does, on a week that ALREADY has a
    Saturday game; and Wednesday and Sunday both come back as `fixture-target-*`
    so a second game has somewhere to go.

    **TWO INSTRUMENT FAULTS FOUND HERE, BOTH OF WHICH BLAMED THE PRODUCT FIRST.**
    `scrollUntilVisible` on the control's ID at 60% matched it in the view
    hierarchy while it was still BELOW the fold and never scrolled, so the tap
    hit nothing and the flow failed at the picker. And **in picker mode a day row
    is `fixture-target-<date>`, not `day-row-<weekday>`** — the obvious row
    assertion could never have passed.

    **ITEM 7 IS UNBLOCKED, AS THIS ITEM ORDERED IT SAID.** Sam's own case — *"only
    doing 1 strength session ... if they have 2 games and 2 team trainings"* — is
    representable now.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 19).

20. **WORKING — THE SENTENCE NAMES ITS CAUSE AND ITS DAY.** Both branches built,
    copy equality-bound both directions, **13 cells in `test:shortfall-copy`,
    mutation-checked six ways.** Registry row `LAW-shortfall-names-its-cause`.
    **The plumbing was the job and it was done: `recordAcceptedWeekShortfall`
    now derives the day from the week's own facts.**
    **THE ORDER DIAGNOSED ONE DEFECT; MEASUREMENT FOUND THREE.** Wrong CAUSE
    (Sam's complaint), wrong DAY, and a REST asserted that may never have
    happened — the call site passed `weekStart`, so every Monday-start week read
    *"Resting Monday"*. **Confirmed by rendering it, not by reading.** `date` is
    now THE DAY BELONGING TO THE CAUSE.
    **A REGRESSION CORRECTED ME MID-BUILD:** a rest mark is a CALENDAR fact, not
    a workout named Rest, so my first version found no rested day and SILENCED
    the disclosure — the exact case accept-and-reduce exists for. The athlete's
    marks are the primary fact now; the week's sessions are the fallback.
    **NO NEW PREDICATE:** `classifyDaySessions` is asked what a game is — two
    private copies exist already and a third is the defect this repo keeps
    finding.
    **BEHAVIOUR CHANGE, STATED:** a week with neither a game nor a rest mark now
    produces NO disclosure rather than one naming a day nobody chose.
    **NOT COVERED:** no cell mounts a surface, so nothing proves the athlete SEES
    either sentence on a device.

   ~~ORIGINAL ORDER~~ — archived verbatim to `docs/SEAT_INBOX_ORIGINAL_ORDERS_2026-08-13.md` (item 20).

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

    **STILL NOT STARTED:** the away flow's equipment question, the rebuild on
    the new kit, and the copy that still says the program is "avoiding the dates
    you are away". (a) and (b) are BUILT and on glass (`5ff77758`).

    **GENERATION IS INVOLVED (a rebuild on a new kit) — STAND-DOWN D APPLIES to
    the rebuild half.** The sheet, the question and the dated equipment fact are
    clear to build now.

23. **BUILT — TWELVE PHRASES SHIP, AND THE MISCOUNT IS FIXED AT ITS SOURCE.**
    `74d76479`. Four `signed_sentence` entries, four union members, the pool
    builder BRANCHES on `kind`, and the "three live builders" comment is
    corrected. **The count did not move, as ordered:** `my-status-modifiers`
    8 -> 8, `program-tab-read-only-modifiers` 9 -> 9. `'unsigned'` stays, with
    three sites (soreness, generated programme-effect notes, and the catch-all
    for constraints that are neither readiness nor schedule) and its cell
    untouched. **A new cell drives the REAL builder with an excluded and a
    pinned exercise and reds if they share an effect** — mutating the branch
    away reproduces exactly the defect this item was raised to prevent.

    ~~ORIGINAL ORDER~~ **SAM SIGNED THE LAST FOUR SHORT PHRASES — AND IT WAS FOUR, NOT THREE.**

    **OWNED BY THE DESKTOP AGENT** — the same files as item 22(a):
    `src/rules/projectionCopy.ts`, `src/utils/activeProgramModifiers.ts`,
    `ModifiersSheet`, `src/__tests__/modifierEffectPhrasesTests.ts`.
    **TERMINAL: NOT YOURS. Go to item 21, which is now clear.**

    **Sam, 2026-08-13:** *"i'd rather them shortened"*, then, shown these four,
    ***"signed"***. They are signed copy and may ship verbatim:
    - an exercise preference (avoid / preferred alternative / added focus)
      → **Exercise preference applied**
    - an EXCLUDED exercise → **Exercise removed**
    - a PINNED exercise → **Exercise prioritised**
    - a conditioning modality swap → **Conditioning swapped**

    **WHY FOUR WHEN EVERY DOC SAID THREE — MEASURED BEFORE IT WAS PUT TO HIM.**
    `athletePreferenceModifier` is ONE builder carrying `kind: 'excluded' |
    'pinned'` (`activeProgramModifiers.ts:1201-1226`), and the two are OPPOSITES
    — excluded AVOIDS the exercise, pinned PRIORITISES it. One phrase for both
    would have been false every second time it rendered. **The comment block at
    `activeProgramModifiers.ts:117-121` says "Three live builders" and is now
    wrong by one — correct it in the same pass.**

    **`'unsigned'` DOES NOT DISAPPEAR. DELETING THE UNION MEMBER WILL BREAK THE
    BUILD.** There are **FIVE** `effect: 'unsigned'` sites, not three. Sam's four
    cover three. The other two are DELIBERATE and stay:
    - **soreness** (`:986`) — its own sentence names the body part, which this
      file already argues is more useful than a generic phrase.
    - **deterministic programme-effect notes** (`:696`) — generated notes with
      their own authored sentence.
    **Keep the member, and keep the `isShownOnProgram({ effect: 'unsigned' })`
    cell exactly as written:** a missing phrase is a gap in the WORDS and never a
    reason to stop telling the athlete their program changed.

    **BUILD:** four `signed_sentence` entries under the item-22(a) block in
    `projectionCopy.ts`, `provenance` citing THIS item and the date; four new
    members on `ActiveProgramModifierEffect`; **the pool builder must BRANCH on
    `kind`** rather than return one effect for both. Then four more rows in
    `SAM_PHRASES` — **that array is the signing record, so type his words in by
    hand; do not import them from the registry the suite exists to check.**

    **THE CELL THAT CAN BREAK IS THE COUNT, NOT THE COPY.**
    `test:modifier-effect-phrases` asserts every phrase-bearing effect is shown
    on Program. Four kinds move from a long sentence to a short phrase and **the
    visible row count must not move.** Run `test:my-status-modifiers` and
    `test:program-tab-read-only-modifiers` either side and report both numbers.

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
