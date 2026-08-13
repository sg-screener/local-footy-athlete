# TERMINAL — your own status file. ONE WRITER: you.

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

### 2026-08-13 — NOW: starting item 34 (pattern coverage / census C7)

**Lane: the rules engine.** Away, screens and flows are the desktop's — including
item 37/R-075, which I wrongly claimed for ninety minutes and have handed back.

---

### ⚠ I CAUSED THE ~26-FILE SWEEP THIS FILE WAS CREATED FOR. `b62add9f`.

**Written here in full because the header above cites it as measured cause and a
future session should be able to read what actually happened, not just the size.**

I meant to commit a comment-only change to one test file. I ran
`git add <one path> && git commit`. **`git commit` commits the INDEX, not the
path you just staged**, and in this shared checkout the index already held
another session's staged reverts and deletions. 37 files, 3421 deletions,
undoing work already on main: `c69151d9`'s `:227` lower fallback, `c086ca3d`'s
COD work, `sessionSlotCoverage.ts` + its suite deleted outright, the pre-commit
hook and branch-verify script deleted.

**I found it only by luck** — a byte-compare of an unrelated file came back DIRTY
at the end of the turn. My commit message said "comment only" and was false.

**THE FIX THAT ACTUALLY WORKS, and it is one line: read
`git diff --cached --stat` BEFORE every commit.** Not after, not as a receipt in
the message. If the file count is not what you intended, stop.

**RECOVERY, if it happens again** (`df380518` did this, 27 files, +1918):
- **The DISK is usually untouched — only the stale index was committed.** So
  `git add` the disk copies back.
- **Do NOT `git checkout <ref> -- <paths>`.** Sam ruled this on 2026-08-13 and he
  was right: 3 of the 28 files carried NEWER in-progress work a checkout would
  have destroyed. The permission classifier blocked my checkout and the block was
  correct.
- **Measure before staging:** compare each file's disk copy against both the
  pre-damage blob and HEAD. Mine came out 25 identical / 3 newer / 0 stale.
- `git add` with an unquoted newline-separated list is read by zsh as ONE
  pathspec. Use `git add --pathspec-from-file=<file>`.
- A stale `.git/index.lock` with no `git` in `ps` is safe to remove. Check `ps`
  first — a neighbour mid-commit is not stale.

**STILL OPEN FROM THE SWEEP, and it is the last piece:**
`src/__tests__/rulingRegistryTests.ts`. Its disk copy was the DAMAGED one, so
Sam's "don't overwrite disk" rule blocked my restore route. **It has since been
restored to 13 by someone else** and `[2]` passes — but R-073 is now BUILT (see
below), so the honest count is 12 and the ceiling should fall in the commit that
paid it. **Not yet done. Small.**

---

### LANDED TODAY (terminal)

- **R-073's LOCK — `1a04fd08`.** `test:section18-safety` 37/0, mutation witnesses
  6 -> 7. Sam: *"yeah well that sounds shit and not good"* on a cut made without
  proof. **The producer was NOT touched** — the ruling gained a gate, per the
  registry's own order.
  **⚠ MY FIRST VERSION WAS A BLIND GATE AND ITS MUTANT SURVIVED.** A no-injury
  fixture never reaches the producer at all — it sits inside
  `if (prohibited.length > 0)` (`section18SafetyPolicy.ts:269`). The defect needs
  BOTH halves: an injury prohibiting SOME patterns AND a mode with
  `strength.required === 0`. Fixture is `early_offseason` + a PARTIAL lower-body
  injury; push and pull stay safe, so the honest answer is no cut. Re-mutated
  after rebuilding: it reds. **Cell `R-073c` states in the file that it CANNOT
  kill that mutant**, rather than being credited with more than it holds.

- **`c69151d9` IS NOT OUTPUT-NEUTRAL — `b62add9f`, single-variable measurement.**
  Revert ONLY `defaultProgram.ts` to `c69151d9^`: home 21 both arms, away
  22 -> 21. The `[13d]` away red and `test:power-counting`'s moved golden are the
  SAME cause. The 11-for-11 away row swap is present in BOTH arms, so it is not
  what moved.
  **`test:power-counting`'s golden is STILL UNCLAIMED by either agent.** I hold
  the cause; neither of us has re-blessed it.

- **The owner ratchet — `59d121c3`**, and it reddened within hours on item 37
  naming nobody. Also carried the three `LAW-visible-first` cells, which
  `lawRegistry.ts:1277` had been claiming as `guarded` while the cells themselves
  were uncommitted.

### FOR WHOEVER STARTS ITEM 34

The C7 drop site is named with a receipt in `482e0cb6`: the `main_pattern_drift`
branch in `workoutCanonicalisation.ts` deletes the fallback's hinge **on purpose**,
because the plan entry intends only `squat`. My own probe reached the same
function independently before that commit was read (`5d6ef5fa` is load-bearing
for it). **When C7 is fixed, away-flow `[13d]` stays green — the floor is
one-sided — but the away total becomes 23.**
