# SEAT INBOX — the review seat writes here; the terminal reads at every stop

**REWRITTEN 2026-08-12 after Sam asked the seat to audit it.** It had grown to
527 lines with three numbering schemes, stale cross-references from the seat's
own renumbering, two orders that contradicted each other, and three items already
done. **Detail lives in the linked docs; this file is the QUEUE.** Keep it under
200 lines.

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

0. **DO NOT STOP WHILE THIS QUEUE HAS ITEMS. SAM'S STANDING ORDER, 2026-08-12.**
   *"Work continuously through the seat inbox in order — don't stop to ask me.
   My rulings are all recorded in the file. If something genuinely needs my
   decision, write it down, skip it, and take the next item."*

   **A `docs(stop):` commit is a LEGAL EXIT FROM THE HOOK, NOT PERMISSION TO
   STOP.** On 2026-08-12 the terminal wrote two stop reports back to back and
   halted for 50 minutes with twelve items still queued — **and neither report
   contained a question for Sam.** Both named their own next step.

   **SO: after a stop report, TAKE THE NEXT ITEM.** Stop only when (a) the queue
   is genuinely empty, (b) a decision is needed that is NOT already ruled in this
   file — in which case write it under `## AWAITING SAM`, skip it, and continue —
   or (c) Sam says stop. **A unit that ends "blocked, attempt 2 must do X first"
   is not a stopping point: X is the next unit.**

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

1. **STANDING, EVERY STOP — MERGE, THEN VOCABULARY, THEN PROPORTION.** These are
   always in force; they are not work items to clear.

   **1a. MERGE `codex/*`.** For every `codex/*` branch with commits not in
   `main`: `git merge --no-ff`, run the gates, **fix or report anything red —
   never leave it unmade and never ask Sam to merge.** Quiet if nothing is new.
   **The stop report names in ONE LINE which of Sam's UI changes are now in
   `main`** — his phone runs `main`, so that is how he sees Codex's work.
   **KNOWN BLOCKER: `codex/program-week-navigation-bounds` adds two registry rows
   that red `test:law-registry`'s `ruledAt` cell. Fix them in the merge.**
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
   - **STILL OPEN — `test:accepted-state-transactions` is 89.5s**, the largest
     real unit, new since 2026-08-07, never looked at.

3. **KILL THE ±7 INVENTION — ATTEMPT 1 BUILT, WORKED, AND WAS REVERTED FOR ONE
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

4. **THE MODERATE DAY — half of Sam's shape, held by nothing.**
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

5. **THE 17 SCENARIOS MUST REPORT SAM'S PREFERENCES, NOT JUST HARD LIMITS.**
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

6. **PLANNED LOAD IS NOT EXPERIENCED LOAD.**
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

7. **STRENGTH JOINS THE CAPACITY ARITHMETIC.** Sam: *"sometimes that may mean
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

8. **MY STATUS OWNS THE MODIFIERS — ONE UNIT, THIS ORDER, DO NOT REORDER.**
   **Sam ruled the old Program sheets obsolete:** *"we don't need this anymore -
   it shows up in the status bar and on the a simple thing shows on day screen
   and week screen"*. His design: Day and Week are READ-ONLY indicators; Coach /
   My Status owns the detail as **a row with a chevron**, not inline buttons.
   **(a)** land the 7 inert actions on My Status in that shape
   (`LIVE_ACTION_KINDS = ['dismiss_note']`, `CoachStatusScreen.tsx:168`); also
   `CoachTabScreen.tsx:466` passes `EMPTY_EQUIPMENT_FACT_IDS` so its equipment
   testIDs are wrong by construction. **(b)** retire the caption
   (`projectionCopy.ts:378` *"Change this on your program screen for now."*) and
   `repoLawGuardsTests.ts:1510`'s `NOT_YET_SURFACE` cell **in the same commit —
   finishing (a) without this FAILS that guard**. **(c)** THEN delete the
   Program-side leftovers: `handleCoachNoteAction` (`HomeScreenV2.tsx:350`), its
   state (`:238`, `:242`), `clearCopyForNote` (`:2583`), `CoachNoteSheet`
   (`:2634`, mount `:1190`), the DUPLICATE injury mount `:1198` (**keep `:1148`,
   it is live**), and the false comment at `:2578`.
   **(c) BEFORE (a)+(b) STRANDS ATHLETES** — the caption sends them to the screen
   (c) removes.

   **PRICED 2026-08-12, NOT BUILT. TWO FINDINGS THE ORDER DOES NOT CONTAIN:**
   **(1) THE CHEVRON SHAPE ALREADY EXISTS.** `CoachStatusScreen.tsx:103-133`
   already renders each modifier as a row with a `<Chevron>` that expands to the
   actions. **(a) is not a redesign — it is only "make the seven live".**
   **(2) THE WRITERS HARD-CODE `screen: 'program_tab'` — NINE SITES in
   `useHomeScreen.ts`,** with surfaces like `coach_notes_injury_resolved`. Those
   go into the action tape and the decision ledger. **Lifting them to My Status
   unchanged would write a FALSE surface onto every decision the athlete makes
   there**, so the extraction must make the source a PARAMETER, not move the
   code. That is the difference between a move and a lift, and the order prices
   neither.
   **ALSO PART OF THE SAME EXTRACTION, NOT A ONE-LINER:**
   `equipmentFactIds={EMPTY_EQUIPMENT_FACT_IDS}` (`CoachTabScreen.tsx:464`) is
   wrong because the Coach tab has no `equipmentFacts` source at all — the
   Program side gets it from `useHomeScreen`. It comes free WITH the extraction
   and cannot be fixed before it.
   **SCOPE, THEN:** extract `handleClearCoachNote`, `handleUpdateCoachNoteStatus`
   and the injury/confirm sheets out of `useHomeScreen` into a hook both screens
   mount, with the action source injected; then (a)+(b) in one commit; then (c).
   **NOT STARTED — no device verification is possible while Sam's phone is
   un-rebuilt, and this unit is entirely glass.**

9. **BUILD LAYER 3 — THE ATHLETE'S WILL. RULED BY SAM 2026-08-12:** *"should
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

10. **THE GATE — `LAW-computed-must-be-consumed`.** `HOW_TO_BUILD_THIS_APP` §4
   lists NINE values computed every assessment and read by nobody. One
   `noUnusedWrites`-style gate over `contract.*` and exported rule outputs
   catches all nine. **Subsumes the narrower `subject: 'doc' | 'behaviour'`
   proposal — build it here, not in item 13.**
   **CORRECTION FROM THE TERMINAL, 2026-08-12, worth keeping:** this gate would
   NOT have caught the eight-copies-of-one-answer class. *"Computed and unread"*
   and *"computed eight times over"* are different diseases wanting different
   instruments.

11. **THE FEATURE REGISTRY.**
   `docs/HOW_WE_STOP_BELIEVING_THINGS_ARE_DONE_2026-08-12.md`. Two states, no
   third — **`held`** (names the test that fails) or **`UNPROVEN`** (names what a
   proof would take) — plus a `reachable` field laws do not need. Copy
   `lawRegistry.ts` exactly; **do not design a second mechanism.** Seed it
   honestly and let the number be ugly.

12. **PICTURES MUST BE NEWER THAN CODE.** `UI_STATE_2026-08-12.md:14` pins itself
   to `a9c82856`, **a docs-only commit 14h48m after the newest screenshot** —
   which is why the seat cited a stale UI location with confidence. **Do NOT
   just re-shoot** (Sam has more UI coming; they would restale immediately):
   SHA in the filename, a committed manifest (shots are gitignored, so mtime
   dies at `git clone`), one gate cell, and the index may never pin to a docs
   commit. **Then shoot once, after Sam's UI work settles.**

13. **KEEP THE UNENFORCED LAW COUNT FALLING.** Measured 2026-08-12 by the
   terminal: **97 rows, 65 guarded, 32 UNENFORCED.** Priority is the FOUR that
   change what the athlete sees — `LAW-L6-honest-actions`,
   `LAW-attributed-content-change`, `LAW-L5-no-dead-affordances`,
   `LAW-L15-one-write-format`. Two rows read guarded but are held by grepping
   `NOW.md` for a word (`LAW-L4-device-is-arbiter`, `LAW-L10-phone-is-done`).

14. **FIRST BATCH UNDER 1c — ONE UNIT.** Off-feet walking gate
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

15. **FINISH THE PHASE-SHEET MOVE.** The surface is on the Coach tab
   (`CoachTabScreen.tsx:479`); the implementation never followed, so
   `src/components/SeasonPhaseShiftSheet.tsx` is a permanent six-line re-export
   of a component still inside `HomeScreenV2.tsx:3352`. Move it, delete the
   bridge, delete the orphaned `phaseCard` style (`:4173` — the existing gate
   greps *usage*, so the dead definition passes). Nothing breaks.

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

- The Wednesday game-day check (`06401d92`), the Renee UI pass, and the craft
  tier's hydration relocation are all **BUILT, awaiting device acceptance**.
  When he rebuilds, the white screen after a refused dev launch is expected and
  now names its own cause (`docs/WHITE_SCREEN_BOUNDARY_2026-08-10.md`).
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
