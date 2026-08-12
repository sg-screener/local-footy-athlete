# SEAT INBOX — the ORIGINAL ORDERS, archived verbatim 2026-08-13

**WHY THIS FILE EXISTS.** `docs/SEAT_INBOX.md` is re-read at every stop and has
a size budget that `test:repo-law-guards` enforces, because Sam pays for that
re-reading in dollars. The struck-through `~~ORIGINAL~~` blocks were a third of
the file and are HISTORY — the order as first written, kept so a later reader can
see what was asked before it was worked.

**NOTHING IS REWORDED, SUMMARISED OR DELETED.** Every block below is the exact
text that stood in the inbox, in inbox order, under the item it belonged to.
The inbox keeps a pointer at each site.

---

## item 0

   ~~ORIGINAL~~ **MAKE "DO NOT STOP" A MECHANISM, NOT A NOTE — THEN RUN THE LIST OVERNIGHT.
   BUILD THIS FIRST, BEFORE ANY OTHER ITEM.**
   **SAM, 2026-08-12:** *"why does it keep fuckign stopping if theres nothing for
   me to say"* and *"i want it to run through the list overnight as long as it
   can"*.

   **THE DIAGNOSIS, AND IT IS THE SESSION'S OWN LESSON.** Order 0 has said "do
   not stop while this queue has items" for hours and the terminal has stopped
   after nearly every unit anyway. **It is not disobeying — a `docs(stop):`
   commit is a LEGAL EXIT in `scripts/seat-inbox-hook.sh`, and a note in a file
   never beats a door in a script.** Sam should not be the restart button.

   **CHANGE THE HOOK. It may allow a stop ONLY when one of these is true:**
   1. **The queue is empty.**
   2. **HEAD is a commit whose subject begins `docs(blocked):`** — a declaration
      that it genuinely cannot proceed, naming why. **A routine progress report
      is NOT this.** `docs(stop):` alone stops being an exit.
   3. **A decision is needed that is NOT already recorded in this file** — write
      it under `## AWAITING SAM`, then it may stop.
   4. **NO PROGRESS: three consecutive turn-ends with no new commit on `main`.**
      **This is the loop breaker and it is the safety this whole change rests
      on.** Measure it — do not estimate it. **Progress means a commit, not
      activity.** On the third, allow the stop and say plainly that it stalled.

   **WHY "no progress" AND NOT A CLOCK:** a time budget stops useful work as
   readily as useless work. A commit counter only fires when nothing is actually
   being produced, which is the only failure worth interrupting for.

   **WHAT SAM GETS:** it works down the list continuously without him, and the
   report he reads covers everything since the last stop rather than one unit.
   **Progress reports still get written — they just stop ending the turn.**

   **BUILD IT SAFELY:** the hook is live while you edit it. **Test the new logic
   in isolation first** (the existing `scripts/__tests__/seatInboxHookTests.sh`
   is the place, and it already proves both directions — must-block AND
   must-not-block; the must-not-block cases are the ones that catch a hook that
   can never be satisfied). **Prove all four exits fire, and prove a routine
   `docs(stop):` no longer ends the turn, BEFORE you rely on it.**

   **THEN: work the list. Do not stop to report progress. Sam is asleep.**

---

## item 0a

   ~~ORIGINAL ORDER~~ **ONE EFFORT SCALE: 1-10, EVERYWHERE. SAM RULED 2026-08-12.**
   *"okay do 1-10 for everything i think? can you make sure he does that and
   updtes all the session feedback forms as well"* — and, on strength: *"ask
   me"*, i.e. **strength sessions get an effort rating of their own.**

   **THERE ARE THREE SCALES TODAY AND A TRANSLATOR BETWEEN THEM:**
   - conditioning RPE is **1-10** (`sessionFeedbackForm.ts:161` — *"Legacy
     conditioning RPE remains 1-10"*)
   - the live checklist's effort is **1-5** (`programStore.ts:1678` — *"Live
     session effort is 1-5; legacy conditioning-only feedback may be 1-10"*)
   - game / practice-match effort is **1-5**
   - and `feedbackAdapter.ts:274` exists only to *"map the 5-level feeling to
     approximate RPE difficulty (1-10)"* — **a conversion nobody owns, which is
     the session's own defect class.**

   **THIS RE-SCOPES SAM'S OWN EARLIER RULING AND HE MADE THE CHANGE HIMSELF.**
   `gameFeedback.ts:17` carries *"Sam 2026-08-11; game and practice-match effort
   changed to 1-5"* with the copy *"1 = very easy · 5 = very hard"*. **Superseded
   2026-08-12: 1-10.**

   **WHY 10 AND NOT 5 — HIS BIBLE IS ALREADY WRITTEN IN TENS.**
   `LFA_PROGRAMMING_BIBLE.md:771`: *"in season should be big weights, not to
   complete fatigue or max though. Could say 7/8 out of 10. Pre season off season
   ... 8/9 out of 10."* Plus RPE 6-7 for beginners (`:4968`, blessed by him) and
   RPE 5-6 on a deload (`:3749`, `:4956`). **The app already PRESCRIBES a number
   out of ten and never asks whether the athlete hit it. A 1-5 answer cannot be
   checked against a /10 prescription without the very translator this deletes.**

   **DO:** one scale type, 1-10, used by conditioning, the live checklist,
   strength (new — "ask me"), and game / practice-match. **Update every feedback
   form and its athlete-visible copy** through the signed-copy path, not by
   editing strings in place. **DELETE `feedbackAdapter.ts:274`'s 5→10 mapping**
   once nothing feeds it — if anything still does, that caller is the finding.
   **Migration: existing stored 1-5 values must be handled explicitly** — either
   converted with a stated rule or marked as legacy-scale. **Do not silently
   reinterpret an old 3 as a new 3.**

   **THIS UNBLOCKS ITEM 6** (planned vs experienced load): strength gains a real
   effort number, so it stops being an all-estimate column.

---

## item 0b

   ~~ORIGINAL ORDER~~ **THE COMPLETION GATE — NOTHING MAY BE CALLED FINISHED
   UNTIL THE RIGHT CHECKS PASS. TOOLING ONLY; DO NOT CHANGE APP BEHAVIOUR.**
   Sam approved this on 2026-08-12 as step 2 of three. **Step 1 (the iOS
   Simulator pane) is DONE — the app builds, installs and boots in it.**

   **WHY IT IS NEEDED AND WHAT IT IS NOT.** The existing `Stop` hook
   (`scripts/seat-inbox-hook.sh`) only checks whether the INBOX is clear. **It
   cannot tell a real "done" from a false one.** This is a different hook.

   **BUILD:** a `TaskCompleted` hook — `.claude/settings.json` plus one script
   under `.claude/hooks/`. **Exit code 2 blocks completion** and the reason is
   fed back. **Path-aware, using ONLY commands that already exist in
   `package.json` — invent nothing:**
   - TypeScript changed → typecheck
   - rules / store / generation files changed → the relevant targeted suites
   - program generation, repair, scheduling or coaching rules changed → the
     full scenario suite
   - visual-only or docs-only changes → **must NOT** run the expensive suite

   **CONSTRAINTS: no new registry, no new doc, no worktree, at most two
   permanent files.** Show the proposed file list and which existing command
   each check calls BEFORE writing anything. Verify with `/hooks` afterwards.

---

## item 0c

   ~~ORIGINAL~~ **THE REST OF THE TOOLING PLAN — SAM RULED IT IN, 2026-08-12.**
   *"i really want to get all of chat's ideas in there so we can build this more
   efficiently going forward"*. **The seat had parked these on its own judgment;
   that was `seat-rations-what-Sam-ruled` again and it is withdrawn.** Build in
   this order, cheapest first. **Each is TOOLING — no app behaviour changes.**

   **(i) TypeScript language server — DONE 2026-08-12, VERIFIED.**
   `typescript-language-server@5.3.0` + `typescript@7.0.2` installed globally;
   `typescript-lsp@claude-plugins-official` installed and **enabled**.
   `claude plugin details` reports **1 LSP server, ~0 tokens added to every
   session** — out-of-process, so it costs context nothing.
   **THE WARNED-ABOUT DEFECT DID NOT BITE.** The plugin's source directory
   genuinely has no `plugin.json` — but neither does `frontend-design`, which
   works — because the marketplace entry carries the whole `lspServers` config
   itself and `strict: false`. It installed first try. **REQUIRES A RESTART to
   take effect.**

   **(ii) BLOCKED ON TWO THINGS, NEITHER OF WHICH IS EFFORT. Not started.**
   **(1) I CANNOT VERIFY THE MECHANISM EXISTS IN THIS BUILD.** There is no
   `.claude/rules/` anywhere on this machine, `claude --help` never mentions
   rules, and there is no example to copy. The order asserts the feature as
   fact; a ruling premise is a claim too. **Building a rules file I cannot
   observe loading is exactly the "hand-roll a substitute" that (i) forbids** —
   and only `/context`, which is Sam's to run, could confirm it.
   **(2) `.claude/` IS GITIGNORED HERE (`.gitignore:7`), SO MOVING LAWS THERE
   DELETES THEM FOR EVERYONE ELSE.** `AGENTS.md` is tracked; `.claude/rules/`
   would not be. The concurrent agent in this same checkout would silently lose
   whatever moved, and so would a fresh clone. **FIX IS ONE LINE — a
   `!.claude/rules/` exception — but that is Sam's call on his own ignore file.**
   **MEASURED SO THE NEXT PASS NEED NOT: ~125-149 of AGENTS.md's 746 lines are
   genuinely path-scoped** (Coach Intelligence 27, Coach Escalation 30,
   hand-built fixtures 38, L13 walker 30, L14 domain purity 10, L16 slice 14).
   **That is a 20% cut, not a transformation** — the other 600 lines are Law
   Zero, the counting laws, the process laws and the seat rules, all of which
   apply to every turn.

   ~~ORIGINAL~~ **Path-scoped rules, `.claude/rules/*.md`** with `paths:` frontmatter
   globs. **`AGENTS.md` is 746 lines re-read every single turn.** Move the rules
   that only matter when specific files are touched — the program generator,
   repair engine, coach planning, scenario tests — into a path-scoped rule that
   loads only then. **Do NOT copy the law registry into it.** Target: what
   remains loaded always is short. Verify with `/context`.

   **(iii) `/lfa-task` skill**, `.claude/skills/lfa-task/SKILL.md`,
   `disable-model-invocation: true`, taking ONE observable outcome as
   `$ARGUMENTS` and injecting live git state with `` !`git status --short` ``.
   It must force: acceptance criteria and non-goals up front; search the ruling
   registry BEFORE asking Sam anything; trace the data flow before editing;
   extend existing mechanisms rather than adding abstractions; a vertical slice
   with writer, reader, reachable entry point, persistence and test; simulator
   proof for UI; the full scenario report for generation changes.
   **`argument-hint` is REJECTED by the current skill format — do not use it.**

   **(iv) `lfa-verifier` subagent**, `.claude/agents/lfa-verifier.md`, read-only,
   `memory: local`. Reviews the diff against the task and the rulings and reports
   ONLY material gaps: built but unreachable, written but never consumed,
   persistence claimed without a relaunch, a ruling contradicted, tests using an
   internal shortcut instead of the real path, preference regressions,
   over-fitting, unsupported completion claims. **No style or naming noise.**
   **CHECK FIRST whether item 0b's gate already covers part of this and say so —
   two overlapping reviewers is the disease, not the cure.**

   **(v) `/day-end` skill** — today's commits, working tree and task state into
   one factual report: actually completed, verified, still unfinished, tomorrow's
   first action. **Attempted work must never be reported as completed.**

   **(vi) `/goal`** is not a build — it is how Sam and the terminal USE a big
   task. Document it in `CLAUDE.md` in two lines and stop.

   **CONSTRAINTS ON ALL SIX: no new registry — extend the law registry. No
   worktree. No new documentation file. Reuse what exists. Show the file list
   before writing.** `/rename` does not exist; ignore any reference to it.

---

## item 0d

   ~~ORIGINAL~~ **THE TWO PIECES OF THE TOOLING PLAN THE SEAT MISSED. Sam caught it:**
   *"all of chat is done? wasn't there like 7-8 things?"* — **there were, and
   0c only covered six. The seat said "all of it" without counting.**

   **(i) `CLAUDE.md` DOES NOT SAY WHAT COUNTS AS FINISHED.** It governs how to
   TALK to Sam and nothing else. Add, in his words not jargon:
   - **Source-of-truth order:** the task's acceptance criteria → the law/ruling
     registry → executable tests → the code (which is evidence of what was
     built, NOT of what was intended). **Chat messages are not durable rulings —
     when Sam rules, the registry is updated in the same task.**
   - **Definition of done:** the primary proof is the athlete-visible Program
     flow — **not a coach mutation, a log line, a debug marker or an internal
     function call.** UI changes need simulator proof. Persistence claims need a
     relaunch. Generation changes need the full scenario report.
   - **Every new domain field needs a writer, a reader and a behavioural test,
     named in the same task.** *(This alone would have caught `canOverride`,
     written nine times and read zero.)*
   - **The three words:** WORKING / BUILT / WRITTEN. Banned: done, shipped,
     wired, handled, sorted, passing.
   - **The actual commands** it cannot infer — start, typecheck, targeted tests,
     scenarios.
   **KEEP IT SHORT.** It is 130 lines; adding this should not double it. **Cut
   anything now covered by `AGENTS.md` or the path-scoped rules in the same
   edit.**

   **(ii) ONE COMMAND THAT STARTS EVERYTHING.** Today the startup recipe —
   environment, Metro, which simulator, which app, reaching a known baseline —
   is rediscovered every session. **Make ONE deterministic command
   (`npm run lfa:dev`) that gets to a running app, and record the recipe as a
   skill so it is not re-derived.** `/run-skill-generator` is the intended tool.
   **Do not leave several startup scripts or temporary variants behind — one.**
   **CHECK FIRST whether a working recipe already exists** in `package.json` or
   the Maestro setup; if it does, name it rather than writing a second one.

---

## item 0e

   ~~ORIGINAL~~ **THE LAST TWO OF THE TOOLING PLAN. Sam counted and the seat was wrong
   twice — "all of chat is done" was said before checking, then 0d covered only
   two of the four remaining.** These are the last.

   **(i) FIVE PERMANENT ATHLETE FLOWS, NOT A THROWAWAY PER BUG.** The plan:
   *"You do not need a brand-new temporary Maestro flow for every bug. Keep a
   handful of canonical athlete flows."* Named: **move a session; delete a
   session; preview and approve a repaired week; relaunch and prove persistence;
   clear/reverse an adjustment.** **CENSUS FIRST — `.maestro/` already holds
   flows; say which of the five exist, which are one-offs that should be retired
   into them, and which are genuinely missing.** Do not write five new ones on
   top of what is there. **And the simulator pane now covers interactive
   checking — Maestro's job is the repeatable regression set, nothing else.**

   **(ii) SAY WHAT AUTO MEMORY IS FOR, AND WHAT IT MUST NEVER HOLD.** Two lines
   in `CLAUDE.md` (fold into 0d(i), do not write a new file):
   **YES — environment and navigation:** the right Metro command, an env var a
   test needs, which module owns program persistence, a simulator reset quirk.
   **NEVER — product law:** what makes a valid football week, what deletion
   means, whether athlete intent is hard or soft, which session may move, what
   `canOverride` is for. **Those live in the law registry or they do not exist.**
   **This is the trap Sam has actually been in** — a ruling remembered in a place
   that is machine-local, model-authored and silently truncated is a ruling that
   will vanish. *"i constantly give a fix and a law and believe you will remember
   and you never fucking do."*

---

## item 3

   ~~ORIGINAL~~ **THE MEASUREMENT THE SECOND-WALL LAW DEMANDED IS TAKEN — AND THE ASSUMPTION
   BEHIND ALL THREE ATTEMPTS IS FALSE.** Sam freed the generator 2026-08-12;
   this is the first act under that. **`docs/FIXTURE_AUTHORITY_CENSUS_2026-08-12.md`
   §7.**
   **THE CRAFT TIER'S ±7 ANCHORS DO NOT REACH THE DEPENDENCY RECORD BY ANY
   PATH.** Three writers exist and only ONE mints a source date —
   `sessionResolver.ts:734`, from `effectiveGameDatesAround` (marks + the
   in-season recurring rule). The gateway and the replan COPY it. The craft
   tier's fabricated `previousGameDate`/`nextGameDate` feed
   `validateProgramWeek` — **findings only, and no finding can become a
   `dependency.source`.**
   **SO ATTEMPT 1'S REGRESSION IS NOT WHAT IT LOOKED LIKE.** Deleting the ±7
   could not remove the following week's record directly; something downstream
   of the FINDINGS did. Two candidates named and ordered in §7 (the craft tier's
   repair search moving sessions; what the gateway accepts as
   `crossWeekFixtureDependency`).
   **AND THE MEASUREMENT IS TAKEN — §8. THE LOSS IS AT PUBLISH, NOT IN
   DERIVATION, AND THAT KILLS THE PREMISE OF ALL THREE ATTEMPTS.** Both arms
   measured: with the ±7 GONE the resolver mints the Sunday→Monday link **30×
   (vs 23 at HEAD)** and the materialiser sees a Monday carrying it **4× (vs
   2×)** — **more, not less** — and the property still fails.
   `repairOptionalRestCandidates` never runs in this suite (0 calls both arms),
   so §7's second candidate is eliminated too. **`test:craft-tier` is 36/36
   GREEN with the ±7 removed: the fix is not in question, only what its changed
   FINDINGS do to the week that gets published.**
   **REVERTED — nothing shipped without a receipt.**
   **ATTEMPT 3'S FIRST ACT IS AGAIN A MEASUREMENT:** instrument the overlay
   publish and print which workout reaches `workoutsByDate[NEXT_WEEK]`, with its
   provenance, in both arms. **The derivation half is CLOSED — do not re-open
   it.**
   **NOT STARTED: the deletion itself.**

   ~~ORIGINAL~~ **KILL THE ±7 INVENTION — ATTEMPT 1 BUILT, WORKED, AND WAS REVERTED FOR ONE
   NEW RED. `docs/PLUS_MINUS_7_ATTEMPT_1_BLOCKED_2026-08-12.md`.**
   **THE PREREQUISITE CENSUS IS DONE —
   `docs/FIXTURE_AUTHORITY_CENSUS_2026-08-12.md`. IT DE-RISKS THIS ITEM.** The
   "six answers" were THREE things and only one is a defect:
   **(a) the "cancelled fixture" is MEASURED and collapses into (c)** — the
   authority is computed while the calendar is HALF-APPLIED (old mark cleared,
   new one not yet written), so the profile's recurring `usualGameDay` rule
   re-supplies the very fixture being moved away from. **149 occurrences in one
   suite run.** The rule itself is correct — an unmarked week really does have
   the usual game — so what is wrong is WHEN it is asked. (An earlier answer — *"a before
   snapshot legitimately in flight"* — was wrong and is withdrawn in the doc.) **(b) `UNDEFINED` is NOT reachable in production** — the only
   production caller of the replan always computes the authority, and the
   replan's inner type already declares it required; every UNDEFINED came from
   suites calling the gateway DIRECTLY, which is the harness entering below the
   door. **(c) MEASURED at the exact point of failure:** THREE distinct worlds
   reach one week's craft evaluation — one holding the CANCELLED fixture, one
   holding the MOVED one (correct), and one holding NOTHING. **The ±7 looked
   stable only because it answered from the CONTRACT and could not tell them
   apart**; the empty-authority calls are precisely where attempt 1 lost the
   neighbour. **THE ROOT IS NAMED: the gateway RE-ENTERS ITSELF through the
   resolver** (`assess` -> `resolveFinalVisibleSection18Week` ->
   `sessionResolver:973` -> the gateway again), and the inner call **derives a
   FRESH authority from its own `state.markedDays`** instead of inheriting the
   outer one. Empty state, empty authority. **THIS IS SIGHTING 3 of the class
   `gatewayAuthorityInputCensusTests` exists for** — sighting 2 was this same
   input, paid by giving the resolver the field; the disease came back one level
   down as RE-DERIVATION. **ATTEMPT 3 WAS BUILT AND DID NOT WORK — see §6 of the census doc.**
   Threading the authority so the inner resolve INHERITS it is
   behaviour-preserving on its own (suite stays 10/10) but **does NOT unblock
   the ±7 deletion**: with both applied the same property still fails. Reverted;
   nothing shipped without a receipt.
   **§8 SECOND-WALL LAW FIRES — same wall, third pass.** Three attempts have
   each named a plausible cause and none has explained the failure.
   **STOP GUESSING AND MEASURE THE PROPERTY ITSELF:** the dependency record is
   written by the REPLAN, not the craft tier, and every attempt so far has
   ASSUMED the craft tier's anchors feed it. **That assumption has never been
   checked and is the first thing to check.**
   **BANKED, DO NOT RE-DERIVE:** the defect is real and celled; UNDEFINED is
   test-only; the gateway re-entrancy is a genuine defect **worth paying on its
   own merits with its own cell, NOT as a prerequisite for this item.**
   **The census gate is owed a third cell: an authority re-derived downstream of
   one already established is the same defect as one never passed.**
   **SO ATTEMPT 2 IS: (1) answer (c); (2) THEN delete the ±7 using the cells
   already written and proven red-before/green-after.** The earlier "make it
   REQUIRED" step is **WITHDRAWN**: `test:gateway-authority-census` already
   scans every call site and demands the authority or a declared reason, in both
   directions — a required field would break the legitimate hand-built-contract
   cells and could not tell "must supply" from "has none, and here is why". The regression that forced attempt 1's
   revert is explained by (c), not by a reason to keep inventing fixtures.
   `section18CraftTier.ts:161` fabricates neighbouring games at ±7 days and
   `weekStructureValidator.ts:255,272` **trusts them as real**. **The defect is
   now REPRODUCED, not predicted:** a Sunday-fixture week judges its Monday as
   `g_plus1_hard_work`, a Monday-fixture week judges its Sunday as
   `g1_not_light`. The fix (read `activeFixtureDates`, drop the `.find()`) made
   `test:craft-tier` 42/42 and mutation-checked clean.
   **REVERTED because the sweep went 10 -> 11:** the ±7 was accidentally
   supplying the FOLLOWING week's G+1 link on a fixture move, and
   `test:accepted-state-transactions` asserts it.
   **THE REAL BLOCKER, AND IT IS THE BIGGER FINDING: `activeFixtureDates` gives
   SIX different answers for one week in one operation — including UNDEFINED and
   including a fixture the move had already CANCELLED.** The old code never
   asked, so it was consistently wrong instead of inconsistently right.
   **DO THIS FIRST, IN THIS ORDER:** census the three gateway call paths and
   explain the stale date; make the input REQUIRED (`governableDates` carries
   the precedent verbatim); **only then** delete the `±7`. Deleting it while the
   authority disagrees with itself trades a phantom fixture for a missing one.

---

## item 4

   ~~ORIGINAL~~ **THE MODERATE DAY — half of Sam's shape, held by nothing.**
   *"4 hard days plus 1 moderate/easy day"* (`LFA_PROGRAMMING_BIBLE.md:4808`).
   Hard days have a range, a maximum and two findings.
   `achievedModerateDayCount` (`section18EffectiveWeekEvaluator.ts:1034`) has
   **ZERO readers** — a week of 4 hard days and no moderate day passes silently.
   **FIX: a `preferredModerateDayRange` + an ADVISORY finding, never blocking**
   (`:4810`), then a generation target toward 4+1.
   **MEASURED 2026-08-12 — `docs/MODERATE_DAY_MEASUREMENT_2026-08-12.md`. The
   step this item ordered first is DONE and the answer is sharper than the item
   assumed: 2 of 17 scenarios meet 4+1, and 11 of 17 have ZERO moderate days.
   THE SPLIT IS SEASONAL — every in-season/pre-season FIXTURE week is
   `moderate=0` (12 of 12, S3 the lone exception); every moderate day the app
   produces is in an off-season or no-fixture week. In the season the athlete
   plays in, the moderate tier effectively does not exist.** S14 (low readiness
   AND injuries) still lands 4 hard / 0 moderate.
   **THE ADVISORY'S ACCEPTANCE TEST IS NOW WRITTEN DOWN: it must fire on 11
   scenarios the day it lands and stay SILENT on S3 and S7.** A finding that
   fires everywhere or nowhere is not measuring Sam's shape.
   **NOT BUILT:** the range, the advisory finding and the generation target.
   Nothing here says WHICH session should become moderate or at whose expense.

---

## item 5

   ~~ORIGINAL~~ **THE 17 SCENARIOS MUST REPORT SAM'S PREFERENCES, NOT JUST HARD LIMITS.**
   **Sam's step 3 of three, approved 2026-08-12, and his oldest fear:** *"I
   don't want to get 2 weeks down the line and realise that a weekly template
   optimised for that and that alone."*

   **The scenarios currently answer "is this week legal", never "is this a week
   Sam would write".** That is why item 4's finding — **his 4-hard-plus-1-
   moderate shape occurs in 2 of 17 weeks, and in ZERO fixture weeks** — went
   unseen for months. The instrument existed; the question was never asked.

   **BUILD:** every rules-engine change emits a before/after table across all 17
   — hard violations, whether the 4+1 shape holds, a preference score, and
   **changed-from-baseline**. Three outcomes, distinguished: **hard failure**
   (blocks), **preference regression** (continues only with a stated reason),
   **intentional change** (baseline updated with evidence). **And the one his
   fear names: a big gain on ONE scenario with broad regression across the rest
   is REJECTED as over-fitting, not celebrated.**
   **Extend the existing `HARD_DAY_PROBE` seam — do not add a second flag.**
   **Do not build 500 synthetic athletes.** Make the 17 report properly first.

---

## item 6

   ~~ORIGINAL~~ **PLANNED LOAD IS NOT EXPERIENCED LOAD.**
   `docs/HOW_THE_ATHLETE_TELLS_US_2026-08-12.md`. Hard/moderate/easy stays for
   BUILDING; readiness must read what the athlete REPORTED. `conditioningSRPE`
   is built and correct (`journalLoad.ts:509-520`) and its only importers are
   four journal files, behind the surface Sam hid. **Ordered after item 4 on
   Sam's call** — *"the moderate day shouldnt this be before planed vs
   experienced because it's part of planned?"* **MEASURED 2026-08-12 —
   `docs/EXPERIENCED_LOAD_MEASUREMENT_2026-08-12.md`. THE ANSWER IS WORSE THAN
   "no timestamp": a strength session stores NO rpe, NO minutes and NO start or
   end time — three missing things, not one — while conditioning stores both
   halves of sRPE and needs nothing.** So the plan's premise is only half
   satisfiable today.
   **AND SAM'S §4 RULING HAS AN UNSTATED CONSEQUENCE:** "assume they did as
   planned, marked as an estimate" means **for strength EVERY value is an
   estimate, on every session, forever, until an RPE is captured** — the mark is
   not an edge case there, it is the whole column, against 0% of logged
   conditioning. **That asymmetry is what any design must answer.**
   **A THIRD OPTION EXISTS AND IS IN NEITHER THE PLAN NOR THIS ITEM:** strength
   already stores actual sets/reps/weight, and VOLUME LOAD is already computed
   beside `conditioningSRPE`. It reads real athlete data with nothing new to
   build; its cost is a different unit from conditioning's sRPE. **Sam's call
   between capture-an-RPE / volume-load / estimate-everything.**
   **§4 IS NOW RULED. Sam, 2026-08-12:** *"assume they did as planned"*. **A
   missing answer means the session happened as planned, at the planned effort,
   MARKED AS AN ESTIMATE.** Build it; do not re-ask.

   **RE-MEASURED 2026-08-12 — THIS ITEM'S HEADLINE FINDING IS STALE, AND SAM'S
   OWN RULING IS WHAT OBSOLETED IT.** `docs/EXPERIENCED_LOAD_REMEASURED_2026-08-12.md`.
   The effort-scale unit (item 0a, `7a6281ce`) landed AFTER the measurement above
   was taken, and item 6 was never re-read against it. **A strength session NOW
   ASKS "How hard was the session?" on the 1-10 slider and stores the answer as
   `difficulty`** (`SessionFeedbackPanel.tsx:1065,892`; `executionSummary` is
   built for any session with an execution plan, `DayWorkoutScreenV2.tsx:555`).
   **So "three missing things" is ONE: actual minutes.** Planned minutes are a
   REQUIRED field already populated (`domain.ts:834`, `coachingEngine.ts:1732`).

   **THE CONSEQUENCE: THE ASYMMETRY THIS ITEM RESERVES FOR SAM NO LONGER
   EXISTS.** Option (a) capture-an-RPE is BUILT, not a choice. Option (c) now
   means `reported RPE x planned minutes` — **half real athlete data, half
   estimate** — so the 100%-estimate strength column the measurement said must
   be designed against **cannot happen**. The estimate mark belongs on the
   DURATION, not on the value. Option (b) volume load stops being a rescue and
   becomes an ordinary second measure. **The build §4 ruled is now small and
   honest; what remains for Sam is a much smaller presentation call.**

   **`programStore.ts:1807`'s comment still says `difficulty` "is written from
   the conditioning RPE input alone" — STALE, and it is the line that will
   mislead the next reader.** Not corrected here: that file is mid-flight with
   another agent in this shared checkout.

---

## item 7

   ~~ORIGINAL~~ **STRENGTH JOINS THE CAPACITY ARITHMETIC.** Sam: *"sometimes that may mean
   only doing 1 strength session during the week if they have 2 games and 2 team
   trainings"* — **unreachable today by design.** The only fixture-authorised
   gateway reduction writes `conditioning_core_frequency` ONLY
   (`section18AcceptedWeekGateway.ts:1205`), and strength capacity counts
   team-training days as available (`weeklyExposureContractBuilders.ts:386-388`)
   though `nonTeamDays` (`:277`) exists for everything else. **A 1-strength week
   is the PLAN, not a shortfall.** **And fix the copy** —
   `section18ShortfallDisclosure.ts:96-103` has one template, *"Resting {Day}
   means you'll miss a strength session"*, which blames the athlete for the
   club's draw.

---

## item 9

   ~~ORIGINAL ORDER~~ **BUILD LAYER 3 — THE ATHLETE'S WILL. RULED BY SAM 2026-08-12:** *"should
   give warnings but allow them to do whatever they want"*. **So: the app warns
   and RECORDS that it warned, then does what the athlete asked. A `block` with
   no way through is retired except where the action is physically impossible.**
   `HOW_TO_BUILD_THIS_APP` §2. **What Sam actually asked for** — *"nothing so tight that ... the athlete can't
   choose to do whatever they want"* — **and it does not exist.** A `block` has
   one button labelled `"OK"` (`PlanChangeSheet.tsx:859-883`); `canOverride` is
   written in nine places and **read nowhere in production**; an allowed override
   is **not recorded** (`planChangeProducer.ts:2412-2416`). Collapse the four
   competing answers to "is this the athlete's will" onto `resolverMayDisplace`,
   including the `source === 'manual'` OR-branch at
   `projectVisibleWeek.ts:214-219` and the `date|name` STRING JOIN at
   `section18CraftTier.ts:217-232` **which breaks on a rename**.

---

## item 10

   ~~ORIGINAL ORDER~~ **THE GATE — `LAW-computed-must-be-consumed`.** `HOW_TO_BUILD_THIS_APP` §4
   lists NINE values computed every assessment and read by nobody. One
   `noUnusedWrites`-style gate over `contract.*` and exported rule outputs
   catches all nine. **Subsumes the narrower `subject: 'doc' | 'behaviour'`
   proposal — build it here, not in item 13.**
   **CORRECTION FROM THE TERMINAL, 2026-08-12, worth keeping:** this gate would
   NOT have caught the eight-copies-of-one-answer class. *"Computed and unread"*
   and *"computed eight times over"* are different diseases wanting different
   instruments.

---

## item 11

   ~~ORIGINAL ORDER~~ **THE FEATURE REGISTRY.**
   `docs/HOW_WE_STOP_BELIEVING_THINGS_ARE_DONE_2026-08-12.md`. Two states, no
   third — **`held`** (names the test that fails) or **`UNPROVEN`** (names what a
   proof would take) — plus a `reachable` field laws do not need. Copy
   `lawRegistry.ts` exactly; **do not design a second mechanism.** Seed it
   honestly and let the number be ugly.

---

## item 12

   ~~ORIGINAL ORDER~~ **PICTURES MUST BE NEWER THAN CODE.** `UI_STATE_2026-08-12.md:14` pins itself
   to `a9c82856`, **a docs-only commit 14h48m after the newest screenshot** —
   which is why the seat cited a stale UI location with confidence. **Do NOT
   just re-shoot** (Sam has more UI coming; they would restale immediately):
   SHA in the filename, a committed manifest (shots are gitignored, so mtime
   dies at `git clone`), one gate cell, and the index may never pin to a docs
   commit. **Then shoot once, after Sam's UI work settles.**

---

## item 13

   ~~ORIGINAL MEASUREMENT~~ **97 rows, 65 guarded, 32 UNENFORCED** (the registry
   is 117 rows now; the count that matters is UNENFORCED, and it is 31). Priority is the FOUR that
   change what the athlete sees — `LAW-L6-honest-actions`,
   `LAW-attributed-content-change`, `LAW-L5-no-dead-affordances`,
   `LAW-L15-one-write-format`. Two rows read guarded but are held by grepping
   `NOW.md` for a word (`LAW-L4-device-is-arbiter`, `LAW-L10-phone-is-done`).

---

## item 14

   ~~ORIGINAL ORDER~~ **FIRST BATCH UNDER 1c — ONE UNIT.** Off-feet walking gate
   (`conditioningFeasibility.ts:215` permits walking ungated while `:207`/`:210`
   reject running and hills and `:326-329` forgets walking — declare `onFeet` on
   the family table and derive both gates); session-size floor and ceiling at
   `sessionRowCounting.ts:253` plus `MIN EXERCISES PER SESSION` in the prompt;
   `ModifiersStrip`'s two dead union members (`:41-43`). **INCLUDE the `ProfileScreen` "TEMPORARY" diagnostics
   (`:147`, `:622`, `:630`, `:1626`): SAM CONFIRMED 2026-08-12 that the
   "Something changed?" dead tap the 29 July diagnostic was chasing now WORKS.**
   Delete the counter readout and its state. **The `:630` release-visible export
   block is a SEPARATE 2026-07-30 concern — read its own comment before touching
   it, and do not delete it in the same sweep.**

---

## item 15

   ~~ORIGINAL ORDER~~ **FINISH THE PHASE-SHEET MOVE.** The surface is on the Coach tab
   (`CoachTabScreen.tsx:479`); the implementation never followed, so
   `src/components/SeasonPhaseShiftSheet.tsx` is a permanent six-line re-export
   of a component still inside `HomeScreenV2.tsx:3352`. Move it, delete the
   bridge, delete the orphaned `phaseCard` style (`:4173` — the existing gate
   greps *usage*, so the dead definition passes). Nothing breaks.

---

## item 16

    ~~ORIGINAL ORDER~~ **OWNED BY THE DESKTOP AGENT — THE ONE THAT ASKED THE
    QUESTION AND HAS THE SIMULATOR. TERMINAL: DO NOT TAKE THIS ITEM.** It edits `HomeScreenV2.tsx`,
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

---

## item 17

    ~~ORIGINAL~~ **SAM HAS RULED — A GAME'S LOAD IS READ, FULL, SAME UNIT AS EVERY OTHER
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

---

## item 18

    ~~ORIGINAL~~ **SAM HAS RULED — STRENGTH ASKS HOW LONG IT TOOK. OPTION (a), AND IT CLOSES
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

---

## item 19

    ~~ORIGINAL ORDER~~ **SAM HAS RULED — AS MANY GAMES AS THE WEEK NEEDS, AND
    THE BUTTON IS THE
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

---

## item 20

    ~~ORIGINAL~~ **THE PLUMBING IS THE JOB. DO IT — NOTHING IS BLOCKING IT.** The stop report
    (`c8f2b4b8`) is CORRECT on all three defects and RIGHT not to bolt Sam's
    sentence onto a wrong fact. **But it stopped on a job with no blocker.** Its
    own words: *"I'm not stuck on a decision from you, just on this being a
    bigger job than it looked."* **Bigger is not blocked.** Measured
    2026-08-13 by the seat:
    - **`src/store/acceptedStateTransaction.ts` is CLEAN and has not been
      touched in 16 hours** (`055d901b`). It is not mid-flight and no agent
      holds it.
    - **It is NOT under stand-down D.** D names `generateProgram.ts`,
      `coachingEngine.ts`'s generation paths, `generationAnchorISO` and its
      persistence. This file is none of them.
    - Sam has ruled the wording AND the fixture-only branch. **Nothing is owed
      by him.**
    **So: thread the cause and the day to the call site, THEN put Sam's sentence
    on last — in that order, as the report itself proposes.** "Someone builds
    it" is this queue's way of saying nobody does; the item has an owner and it
    is whoever reads this.

    **THE THREE DEFECTS, CONFIRMED — the report found them and the seat checked
    the third independently:**
    (i) **wrong reason** — one sentence blames a rest mark for every cause.
    (ii) **wrong day** — the single call site passes `date: weekStart`
    (`acceptedStateTransaction.ts:404`) and the renderer does
    `dayNameFor(shortfall.date)`. Weeks start Monday (`mondayOfISO`), **so it
    says "Resting Monday" on every week regardless of the day actually rested.**
    (iii) **claims a rest that may not have happened** — the disclosure is
    recorded from ANY blocking violation, not from a rest mark.
    **And Sam's sentence needs a THIRD day again — the GAME's day, not the
    rested day.** The original order did not account for that; it does now.

    **DO NOT LOCK THE COPY UNTIL THE FACTS ARE RIGHT.** The equality-bound copy
    test is what makes a wrong sentence expensive to undo. **Facts first, cell
    last.**

    ~~ORIGINAL~~ **SAM HAS CHOSEN THE WORDS — AND THE REAL DEFECT IS THAT ONE SENTENCE
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

    **ANSWERED 2026-08-13 — SAM SAID FIXTURE-ONLY.** Asked directly: does the new
    sentence replace both causes, or only the fixture one? **His answer: only the
    fixture one.** The athlete's own rest mark KEEPS the existing sentence,
    because *"Resting Friday means you'll miss a strength session this week"* is
    honest when resting Friday is what he chose. **The branch above is now RULED,
    not the seat's reading. Do not re-ask.**

    **NOT STARTED, AND TWO MEASUREMENTS CHANGE ITS SHAPE (2026-08-13):**
    - **THE CAUSE IS NOT AVAILABLE WHERE THE SHORTFALL IS BUILT.** The single
      production call site is `acceptedStateTransaction.ts:404`
      (`recordAcceptedWeekShortfall`), and it holds ONLY `weekStart` and the
      blocking violations — **nothing about fixtures or rest marks.** So the
      branch cannot be decided in the renderer or the producer as they stand:
      either the caller gains a week-facts input, or the cause is resolved
      before it. **That is a threading decision in a hot shared file, not a copy
      change**, and it is the reason this item is larger than it reads.
    - **CONFIRMED BY RUNNING IT — THE SENTENCE NAMES THE WRONG DAY.** Upgraded
      from OPEN-UNKNOWN 2026-08-13: the renderer was driven with three dates and
      names whatever it is handed, and the ONE production call site
      (`acceptedStateTransaction.ts:515`) hands it `weekStart`. **So on a
      Monday-start week the athlete reads "Resting Monday means you'll miss a
      strength session this week" — whichever day was actually rested, and
      WHETHER OR NOT THEY RESTED AT ALL.**
    - **SO THE SENTENCE IS WRONG THREE WAYS, NOT ONE**, and Sam only had to see
      it once to know: it names the wrong CAUSE (his complaint), the wrong DAY,
      and it asserts a REST that may never have happened. **Writing his signed
      sentence on top of this renderer would attach his words to a wrong fact.**
    - **AND HIS SENTENCE NEEDS A DIFFERENT DAY AGAIN.** *"With a game Saturday…"*
      names the GAME's date; the surviving rest sentence names the RESTED date.
      **So `date` cannot keep one meaning across the two branches** — it becomes
      the day belonging to the CAUSE. That is not in the order as written, which
      is why this is reported rather than absorbed.
    - **`fits` HAS A SOURCE ALREADY:** Sam's sentence states what FITS and
      `count` is what is MISSED, but `shortfallsFromFindings` already reads
      `finding.actual` — the fitting number — and currently discards it. Carry
      that, rather than subtracting a target in the renderer.

---

## item 22

  ~~ORIGINAL QUESTION~~ **does the day/week modifier notice open a SHEET first,
  or go straight to My Status?** Sam sent his prototype
  screen and asked whether tapping the notice opens *"something like this? which
  you can then tap and be taken to the status area inside the coach tab"*. **It
  does not — measured on glass, `artifacts/ui-walk/item16-week-opens-status.png`:
  the tap lands directly on My Status inside the Coach tab, one hop, no
  intermediate sheet.**
  **HIS PROTOTYPE IS A TWO-STEP:** a "Your session has been modified" sheet
  listing each modifier with what it did ("Time away — training volume
  adjusted", "Equipment access — exercises substituted"), then **GO TO MY
  STATUS** and **NOT NOW**.
  **WHY IT WAS BUILT ONE-HOP, SO THE CHOICE IS INFORMED RATHER THAN RE-LITIGATED:**
  item 16 rule (c) says the notice *"carries no controls of its own"*, and a
  sheet with two buttons is arguably controls. That reading is what produced the
  single hop. **His prototype overrules it if he wants the sheet — it is his
  design, and rule (c)'s purpose was keeping the modifier LIST and its eight
  ACTIONS off Program, which a read-only summary + a navigation button does not
  breach.**
  **NOT NEW INFORMATION, ONE SCREEN EARLIER.** The sheet's list is the same list
  My Status renders, so the gain is dismissibility ("Not now") and not having to
  leave Program to learn what changed; the cost is a sheet between the athlete
  and a screen they already reach in one tap.
  **Both surfaces would open it** — day and week — since they are one component.
- **DECISION OWED — item 22(a)/(b): THREE MODIFIER KINDS HAVE NO SIGNED PHRASE,
  AND HIDING THE TIME-CAP ROW DESYNCS THE COUNT. Measured 2026-08-13, before
  building, because both change what gets built.**
  **(i) THE EIGHT PHRASES DO NOT COVER THE SET.** Sam's list maps cleanly onto
  readiness (tired -> volume adjusted, sick -> eased back), injury and injury-
  paused, equipment, unavailable day, deload and game-moved. **Three live
  builders are unnamed:** `preferenceModifier` (avoid exercise / preferred
  alternative / add focus), `athletePreferenceModifier` (excluded / pinned
  exercise) and `modalityModifier` (a conditioning slot swapped, e.g. bike for
  run). They are real, active, athlete-visible modifiers. **Plan unless he says
  otherwise:** they keep their own authored sentence in the row and get NO short
  phrase — inventing one is the unsigned-words defect. **What is owed is three
  more phrases, or a "leave those as sentences" ruling.**
  **(ii) ANSWERED 2026-08-13 — TIME CAPS LEAVE THE PROGRAM COUNT TOO. Sam:**
  *"hide time caps from the Program count and the popup together, keep them on
  My Status."* The question was live because `time_limit` still has LIVE
  writers — `coachProgramEdit.ts:1194` and `profileProgramTransaction.ts:179` —
  so a cap CAN be active, and the notice counts exactly what the sheet lists;
  hiding only the row would have put "2 active modifiers" above a list of one.
  **My Status keeps them because it holds the only control that clears one**, so
  dropping them there would strand an active constraint with no door.
  **NOT BLOCKING (a):** the eight signed phrases are unambiguous.
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

