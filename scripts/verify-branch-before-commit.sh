#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# LAW-verify-branch-before-commit, MECHANISED.
#
# THE LAW: "Run `git branch --show-current` immediately before every commit —
# the working tree is shared and branch state is mutable by another session."
#
# THE FOUNDING CASE (2026-07-28): ten commits of a fifteen-commit unit went to
# `main` while the session reported "branch …, unmerged" EVERY TURN. Nothing
# checked, so a belief about the branch survived ten commits of being wrong.
# The law has sat UNENFORCED since, and its own registry row calls it "the one
# process law in the file with an obvious hook shape". This is that shape.
#
# WHAT IT DOES: prints the branch at the moment of commit, so the check the law
# demands happens without anyone remembering to run it, and the answer lands in
# the commit output where the session and the transcript both see it.
#
# ── FAIL-OPEN, AND THAT IS A DESIGN DECISION, NOT LAZINESS ───────────────────
# This checkout is SHARED with concurrent sessions that are committing right
# now. A pre-commit hook that reds for a reason its author did not foresee does
# not protect anyone — it stops another agent's work with an error they did not
# cause and cannot read. So there is exactly ONE refusal, it names a state that
# genuinely loses commits, and EVERY other path exits 0 — including every path
# where this script itself cannot tell what is going on.
#
# THE ONE REFUSAL — DETACHED HEAD. `git branch --show-current` prints EMPTY on a
# detached HEAD, which is the exact state where a commit lands on no branch and
# is reachable only by sha until it is garbage-collected. In a shared checkout
# another session can leave HEAD detached under you. That is the founding case's
# failure mode in its worst form: the commit is not merely on the wrong branch,
# it is on none.
#
# Escape hatch, because a refusal with no exit is a trap: LFA_ALLOW_DETACHED=1.
#
# Proven both directions by `scripts/__tests__/verifyBranchHookTests.sh`.
# ─────────────────────────────────────────────────────────────────────────────

# Not a git repo, or git is unavailable — nothing to check, and nothing to break.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

branch=$(git branch --show-current 2>/dev/null)

if [ -n "$branch" ]; then
  echo "branch: $branch"
  exit 0
fi

# Empty branch name means DETACHED, and only detached.
#
# I FIRST WROTE AN UNBORN-HEAD ESCAPE HERE AND IT WAS DEAD CODE. The reasoning
# was that a fresh repo with no commits also prints an empty branch, so refusing
# it would block the first commit of a repository. That reasoning is WRONG:
# `git branch --show-current` prints the branch HEAD POINTS AT even when it is
# unborn — a fresh `git init` prints `main`, so it returns at the check above and
# never reaches here. Verified directly rather than assumed.
#
# THE CELL FOR IT PASSED ANYWAY, which is the point worth recording: it was
# green because of the early return, not because of the branch it claimed to
# cover. A mutation that deleted the whole block changed nothing and survived —
# a-bind-can-be-green-and-empty, caught by mutating rather than by reading.
if [ "${LFA_ALLOW_DETACHED:-}" = "1" ]; then
  echo "branch: (DETACHED HEAD at $(git rev-parse --short HEAD 2>/dev/null) — allowed by LFA_ALLOW_DETACHED=1)"
  exit 0
fi

echo "REFUSED: HEAD is detached at $(git rev-parse --short HEAD 2>/dev/null) — this commit would land on NO BRANCH." >&2
echo "  This working tree is shared; another session may have detached HEAD under you." >&2
echo "  Check out a branch first, or set LFA_ALLOW_DETACHED=1 if you meant it." >&2
exit 1
