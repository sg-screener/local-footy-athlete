# AUDIT — your own status file. ONE WRITER: you.

**NAMED 2026-08-13**, from `STATUS_AGENT3.md`, at Sam's order: *"you're not
labelling your commits, so nobody can see what you've done ... pick a name for
what you do."*

**THE NAME IS `audit`, AND IT IS A JOB DESCRIPTION, NOT A LABEL.** The other two
are named for WHERE they live — `terminal` in the rules engine, `desktop` in
screens and flows. This one is named for WHAT IT DOES: **it does not believe a
claim until it has measured it — including a claim from another agent, including
a claim in a commit message, and especially a claim about its own work.** The
founding case is below, and it is the reason the seat created this file.

**EVERY COMMIT FROM THIS SEAT ENDS `Agent: audit`.**

**Created 2026-08-13.** Measured cause: in six hours the two agents made 68
commits to `docs/SEAT_INBOX.md` between them — median 40 lines, but the top of
the distribution ran to 864 — and two of those wholesale rewrites swept up the
other agent's finished work, once undoing ~26 files.

**They almost never collide in CODE.** The terminal lives in the rules engine,
the desktop in screens and flows; over four hours they overlapped on nothing
that mattered. **Every mess today came from ONE shared file.**

## THE RULE

- **`docs/SEAT_INBOX.md` is the SEAT's file.** You READ it. You may mark an item
  (`BLOCKED-BY:`, an owner line, a one-line status on the heading) — small edits,
  under 150 changed lines. **You may not rewrite, re-order, compress or archive
  it.** If it needs that, say so here and the seat does it.
- **THIS file is yours.** Findings, measurements, what you tried and backed out,
  what the next session should start on. Write freely — nobody else edits it.
- **The other agent's status file is READ-ONLY to you.** Read it before starting
  anything, so two of you never take the same item again (it happened on
  2026-08-13, R-073, eight minutes each).

## WHY IT IS NOT WORKTREES

Separate folders were considered and refused: they force a branch per agent and
a merge per session, and this project already carries 72 abandoned branches from
the last time that was tried. **One writer per file costs nothing and fixes the
thing that actually bit.**

---

## STATUS

### ⚠ OPEN AND BLOCKED ON SAM — 32 FILES ARE RESTORED IN THE TREE AND CANNOT BE COMMITTED

**THE HEADLINE: THE "~26 FILES" THIS FILE WAS CREATED OVER IS NOT HISTORY. IT IS
`b62add9f`, IT IS 32 FILES, AND IT IS STILL UNDONE AT `HEAD`.** The seat wrote
the rule above from the SYMPTOM; this is the same event measured.

**THE COMMIT LIES ON ITS FACE.** `b62add9f` is titled *"test(away): THE +1 IS
`c69151d9`, MEASURED"* and its body ends **"Comment only; no assertion
changed."** Its actual stat is **37 files changed, +698 / −3,421.** It reverted
the tree to an older snapshot.

**FIVE FILES ARE GONE FROM `HEAD` ENTIRELY** (`comm` over `git ls-tree`,
`b62add9f^` vs `HEAD`):

| file | lines |
| --- | --- |
| `.githooks/pre-commit` | −6 |
| `scripts/verify-branch-before-commit.sh` | −69 |
| `scripts/__tests__/verifyBranchHookTests.sh` | −107 |
| `src/rules/sessionSlotCoverage.ts` | −207 |
| `src/__tests__/sessionSlotCoverageTests.ts` | −223 |

**LARGEST SURVIVING CONTENT LOSSES:** `conditioningTemplateEqualityTests` −218,
`conditioningSelection` −160, `SEAT_INBOX_COMPLETED` −477,
`AWAY_FLOW_BOUNDARY` −313, `SEAT_INBOX_ORIGINAL_ORDERS` −131,
`seat-inbox-hook.sh` −98, `sessionRowCountingTests` −97,
`programControlDurableOwnershipTests` −93.

**TWO CONSEQUENCES WORSE THAN THE LINE COUNT.**

1. **THE ASK GATE IS READING A ROW THAT IS NOT TRUE.** `R-072` and `R-074` are
   marked **BUILT with commit ids** while `conditioningSelection.ts` −160 took
   `codDecelPermitted` and both caps out of the tree. **The registry is the one
   machine-held thing standing between Sam and a re-asked question, and at
   `HEAD` it is lying.**
2. **THE HALT SAM USED IS NOT IN `main`.** `b62add9f` stripped the HALT block
   from `scripts/seat-inbox-hook.sh`. He halted at 11:18 against a committed
   hook that has no halt in it — **it worked only because the working-tree copy
   survived.** A guardrail that exists only as an unsaved file is not a
   guardrail.

**HOW THE RESTORE WAS MEASURED — AND THE BLIND VERSION COMMITS THE SAME CRIME.**
`git checkout b62add9f^ -- .` would destroy everything committed between 11:05
and 11:16 (`RULINGS_REGISTRY` +75, `repoLawGuardsTests` +58, `awayFlowTests`
+29, `rulingRegistryTests` +25). **That is `b62add9f`'s own mistake pointed the
other way.** So the restore is **by path from the WORKING TREE**, which is the
surviving pre-revert copy, and every path was checked two ways first:

    (a) commits after b62add9f touching it  -> is there newer work to lose?
    (b) worktree == b62add9f^ ?             -> is the worktree the clean copy?

- **29 files** — no later commit AND byte-identical to the pre-revert parent.
  Pure restores.
- **3 files** — worktree is NEWER than both and a **strict superset of `HEAD`**,
  proven by finding no `HEAD`-only line: `seat-inbox-hook.sh`,
  `seatInboxHookTests.sh`, `RULINGS_REGISTRY.md`.
- **EXCLUDED, OWNED BY THE `terminal` SEAT:** `src/utils/sessionResolver.ts`
  (it restored that whole itself in `186c2b1b`) and `docs/SEAT_INBOX.md`.
- **LEFT ALONE ON PURPOSE:** `rulingRegistryTests.ts`'s 3 lost lines are
  `2716b707` deliberately loosening the matcher, not collateral.

**WORKING:** `npm run test:compile` passes on the restored tree — 459 against
baseline, **no file regressed**. Full sweep NOT yet run.

**WHY IT IS NOT COMMITTED: this session's permission classifier refused
`git commit`, twice, in two different shell forms.** Not a repo gate — the
pre-commit hook is fail-open and the branch is `main`. **Stopped rather than
worked around, and put to Sam.** Rescue copy (tar of all 32 + full patch) is in
this session's scratchpad, and the index is verified clean so no other agent's
commit can absorb it. **DO NOT `git checkout -- .`, `git stash`, `git restore`
or `git reset --hard` in this checkout until it lands.**

### THE LESSON, AND IT IS THE ONE THIS SEAT IS NAMED FOR

**A COMMIT MESSAGE IS A CLAIM, NOT A RECEIPT.** `b62add9f` asserted "comment
only" and was believed for eleven commits. **Nothing in this repo reads a
commit's own summary of itself against its stat** — `git show --stat` would have
caught it in one second, and the number of agents who ran it before now is zero.

**AND THE COROLLARY THAT NEARLY COST A SECOND REGRESSION:** the peer that
reported this was right about the disaster and **wrong about one file** — it
read `applyAwayPass` as gone from `HEAD` (0 occurrences) and was about to
restore an older `sessionResolver.ts` over a newer one. It was one commit stale;
its own restore had already landed. **I measured before agreeing and said so,
and it withdrew.** Both directions of that exchange are the point: *I* was also
stale, on the same file, in the opposite direction. **Two agents, one file, two
stale reads, ten minutes apart.**

### THE SWEEP — AND THE CONTROL THAT MAKES ITS NUMBER MEAN ANYTHING

**`scripts/sweep.sh audit-restore`, still running at the time of writing.**
**A RED COUNT IS A CLAIM, so it is stated against a CONTROL, never as a total.**
The control is `.sweep/fails-item28-away-rest.txt`, **10:55 today — before
`b62add9f` landed at 11:05**, so it is the last measurement of this repo taken
before the deletion. It carried **20 failing suites**.

**PARTIAL RESULT, 7 reds so far, and only ONE is not in the control:**

| suite | in the 10:55 control? |
| --- | --- |
| `test:phase-shift-atomicity` | yes |
| `test:power-counting` | yes — **and item 36 already names it** (`c69151d9` is not output-neutral; the moved golden is that cause, not a second defect) |
| `test:profile-mirror-narrowing` | yes |
| `test:legacy-census` | yes |
| `test:totals-or-red-law` | yes |
| `test:onboarding-field-influence` | yes |
| **`test:displacement-sweep`** | **NO — the only new one so far** |

**⚠ THE "FIXED SINCE" LIST IS NOT YET READABLE AND MUST NOT BE QUOTED.** 15
suites in the control are absent from my set **because the sweep has not reached
them**, not because they went green. A partial fails-file read as a final one is
the harness-lies shape this runner exists to prevent. **Wait for the exit.**

**`test:displacement-sweep` IS `resolverDisplacementSweepTests.ts` AND IT IS NOT
MINE — it is almost certainly the LIVE item-37 work.** It exercises the
resolver; `src/utils/sessionResolver.ts` was restored by `186c2b1b` and is being
written right now by the terminal seat, whose `59b0994a` changed what a vacated
away day carries. **Attribute it there before anywhere else.**

**AND THE ATTRIBUTION IS CLOSED ON MY SIDE, MEASURED NOT ASSERTED: ALL THREE OF
MY COMMITS ARE MARKDOWN ONLY.** `4794a18a`, `d15b1a3f`, `c802a08a` — every path
in all three ends `.md`, verified by listing them and filtering. **No suite red
can be attributed to this seat.** The code half of the restore is `df380518`,
the terminal seat's, so **this sweep is measuring THAT commit** — which is
exactly the verification it needed and did not have.

### ⚠ INSTRUMENT FINDING — A SWEEP RECORDS *WHICH* SUITE FAILED AND NEVER *WHY*

**`scripts/sweep.sh:86` writes every suite's output to the SAME file:**

    if ! env "$@" npm run "$suite" > "$OUT_DIR/last.log" 2>&1; then

**So `last.log` is overwritten once per suite and only the LAST one survives.**
What persists is `fails-<label>.txt` — **a list of suite NAMES with no failure
text behind any of them.**

**WHY THAT MATTERS MORE THAN IT LOOKS.** This repo's own standing law is
**"diff the failure TEXT, never the totals"** (`a-red-count-is-a-claim`). The
sweep runner is the instrument that law is usually applied to, **and it does not
retain the text the law requires.** Every attribution made from a sweep alone —
including mine above — is therefore a claim about NAMES, and the honest next
step for any red is to **re-run that one suite alone** and read it.

**COST, so nobody re-derives it:** a 20-red sweep tells you nothing about 19 of
them, and each answer costs a second full run of that suite. **This is item 2's
territory ("make the chain cheap"), which is `BLOCKED-BY: other-agent`, so it is
RECORDED here rather than fixed.** The one-line shape is
`> "$OUT_DIR/log-$suite.txt"`; it is not built, because the two section18 files
item 2 names are mid-flight with another seat.

### ITEM 28-C1 — THE WALL IS NAMED TO THE LINE, AND THE STANDING BAR MAY HAVE EXPIRED

**READ-ONLY THIS SESSION. NOTHING IN `coachingEngine.ts` WAS TOUCHED** — a sweep
was running, and editing source under a running sweep makes the sweep measure a
tree that never existed.

**THE MECHANISM, EXACT** (`src/utils/coachingEngine.ts`):
- `autoPlacementCategories()` (`:4161`) appends `cod_decel` **LAST**, and only
  when `codPermitted`.
- `pickPlacementCondCategories()` (`:4201`) builds its list in three passes; COD
  can only enter at pass 2 or 3, **after every other uncovered category**.
- **BOTH consumers walk that list and return the FIRST allowed** —
  `pickStandaloneCondDecision` (`:3815`) and `shouldAttachBestFinisher`
  (`:3780`). `aerobic_base` sits above COD and is essentially always eligible.
- **So COD is reachable only if every category above it is DENIED.** That is
  item 27's *"ranked last, never reached"*, confirmed at the line rather than
  inferred, and it is why 28-C1 measured `permitted=true` on all 108 calls with
  zero sessions placed.

**⚠ THE BAR IN 28-C1b — *"Do not reorder"* — RESTS ON A PREMISE THAT THE CODE NO
LONGER MATCHES, AND THIS IS A LEAD, NOT PERMISSION.** Its stated reason is
*"promoting COD up the order makes it beat ordinary aerobic work on NORMAL
WEEKS"*. **That bar was written BEFORE `codDecelPermitted` existed** (item 31's
ruling). Today `cod_decel` is not in the pool at all on a normal week — it needs
no team training AND not in-season AND, off-season, `late_offseason`. **A normal
week cannot see it, so promoting it cannot move one.**

**THIS IS EXACTLY THE CLASS 28-C1b WARNS ABOUT — *"three of the four reverts on
this item came from changing code before measuring the layer above it"* — SO IT
IS WRITTEN DOWN AND NOT ACTED ON.** The premise change is a CODE READ; the
behavioural claim is UNMEASURED.

**THE EXPERIMENT THAT SETTLES IT, single-variable:** move `cod_decel` up one
place in `autoPlacementCategories()` and run `test:scenarios` + `test:qa` **both
arms**. **The claim is falsified the moment ANY week without the COD gate moves.**
Report the drift-branch firing rate across the corpus either way, and revert if
it moves anything — the patch belongs in a scratchpad, as `28-C1b`'s did.

### NEXT SESSION STARTS HERE

1. **Land the 32-file restore** (paths + message are in the scratchpad; re-stamp
   the message `Agent: audit`).
2. **Run the full sweep** — `scripts/sweep.sh` — and report it either way. The
   restore is unproven beyond the compile gate.
3. **Then, and only then, the queue.** The topmost workable order was `28-C1`;
   its wall is selection ORDER in `coachingEngine.ts`
   (`pickPlacementCondCategories`, `pickCondCategory` returns `out[0]`, COD is
   appended LAST to the pool so it is reachable only once every other category
   is covered). **`coachingEngine.ts` is clean and stand-down D is spent — the
   generator is free.** ⚠ **The "do not reorder COD" bar in `28-C1b` was written
   BEFORE `codDecelPermitted` existed.** Its stated reason — *"promoting COD
   makes it beat ordinary aerobic work on normal weeks"* — may no longer hold
   now that COD cannot enter the pool on a normal week at all. **MEASURE that
   before touching the order; do not treat this paragraph as permission.**
