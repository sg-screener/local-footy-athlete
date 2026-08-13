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
