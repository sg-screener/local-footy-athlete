#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# LAW-census-before-retirement, MECHANISED — AND IT IS AN ANNOUNCER, NOT A WALL.
#
# THE LAW: "Nothing is retired until it has been censused — you count what a
# deletion takes with it before deleting."
#
# ── THE FOUNDING CASE IS FOUR HOURS OLD ──────────────────────────────────────
# `b62add9f` (2026-08-13, 11:05) is titled "test(away): THE +1 IS c69151d9,
# MEASURED" and its body ends "Comment only; no assertion changed."
#
#   ACTUAL: 37 files changed, +698 / -3421, and FIVE tracked files deleted —
#   including .githooks/pre-commit and verify-branch-before-commit.sh, this
#   script's own siblings, plus src/rules/sessionSlotCoverage.ts (-207) and its
#   223-line suite.
#
# It stood on `main` for eleven commits. Nobody was lying: the author believed
# it. NOTHING IN THIS REPO READS A COMMIT'S SUMMARY OF ITSELF AGAINST ITS OWN
# STAT, so a plausible subject bought total trust, and `git show --stat` would
# have refuted it in one second.
#
# ── WHY IT PRINTS AND DOES NOT REFUSE ────────────────────────────────────────
# Its sibling `verify-branch-before-commit.sh` states the doctrine and it is
# right: this checkout is SHARED with concurrent sessions committing right now,
# so a hook that reds for a reason its author did not foresee stops another
# agent's work with an error they did not cause and cannot read.
#
# THAT DOCTRINE BITES HARDER HERE, because a legitimate deletion is COMMON —
# archiving docs, retiring a dead module, removing a superseded suite. A wall
# would refuse honest work several times a day and be disabled within an hour.
# An ANNOUNCER cannot be wrong: it states a fact the author already owns, in the
# one place they are guaranteed to look, at the one moment they can still act.
#
# So it is the same shape as `branch:` — the check the law demands happens
# without anyone remembering to run it, and the answer lands in the commit
# output where the session and the transcript both see it.
#
# EVERY PATH EXITS 0. There is no refusal in this file, deliberately and
# permanently. If you are tempted to add one, read the paragraph above first.
# ─────────────────────────────────────────────────────────────────────────────

git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# ── THE SECOND ANNOUNCEMENT: MASS LINE LOSS INSIDE A FILE THAT SURVIVES ──────
#
# ADDED 2026-08-13, THE SAME DAY, AFTER THE FIRST VERSION FAILED TO COVER THE
# SECOND INCIDENT. The deleted-FILE census below would not have caught either of
# the day's two worst events, because in both the file survived and only its
# CONTENTS died:
#
#   b62add9f  "Comment only; no assertion changed."   -3,421 lines, 37 files
#   (mine)    a regex lookahead ran to the NEXT ITEM HEAD instead of the end of
#             my own marking, and deleted SIX ORDERS — 720 lines — out of
#             docs/SEAT_INBOX.md. I never committed it; ANOTHER SEAT'S commit
#             swept it up, under a subject about something else.
#
# THREE SEATS HAD AN ABSORPTION INCIDENT ON ONE DAY, every one from a read that
# went stale between looking and staging. The common shape is not "deletion" —
# it is A COMMIT WHOSE SIZE ITS AUTHOR WOULD NOT RECOGNISE. So the announcement
# is the SIZE, printed where the author still has a second to react.
#
# THE THRESHOLD IS DELIBERATELY HIGH. Archiving a doc, retiring a suite and
# splitting a module all remove hundreds of lines legitimately and often. A
# number low enough to catch every accident is a number people learn to scroll
# past, and a hook that is scrolled past is UNENFORCED wearing a green badge.
# 200 is above ordinary editing and below every incident this repo has recorded.
LOSS_FLOOR=${LFA_CENSUS_LINE_FLOOR:-200}
big_losses=$(git diff --cached --numstat --diff-filter=M 2>/dev/null \
  | awk -v floor="$LOSS_FLOOR" '$2 ~ /^[0-9]+$/ && $2 >= floor { print $3 " (-" $2 " lines)" }')
if [ -n "$big_losses" ]; then
  echo "census: ⚠ THIS COMMIT REMOVES A LOT OF CONTENT FROM FILES THAT SURVIVE:"
  printf '%s\n' "$big_losses" | sed 's/^/  - /'
  echo "  If that is a surprise, STOP — you may be committing work that is not yours."
  echo "  On 2026-08-13 a \"comment only\" commit removed 3,421 lines, and a second"
  echo "  commit swept up 720 lines of another seat's uncommitted damage."
fi

# --- The staged deletions, which is what the law is about --------------------
#
# `--cached` is the STAGED tree, not the working tree: this runs as a
# pre-commit hook, so the staged set IS the commit about to be made. Reading the
# working tree instead would report another agent's unstaged edits as yours,
# which in this checkout is the difference between a fact and a smear.
deleted=$(git diff --cached --name-only --diff-filter=D 2>/dev/null)
[ -n "$deleted" ] || exit 0

count=$(printf '%s\n' "$deleted" | grep -c .)

# Lines removed, over the SAME staged set. `--numstat` prints "added removed
# path"; a binary file prints "-" and is skipped by the numeric test rather than
# poisoning the sum with a non-number.
removed=$(git diff --cached --numstat 2>/dev/null \
  | awk '$2 ~ /^[0-9]+$/ { total += $2 } END { print total + 0 }')

echo "census: THIS COMMIT DELETES ${count} TRACKED FILE(S), ${removed} line(s) removed:"
printf '%s\n' "$deleted" | sed 's/^/  - /'
echo "  LAW-census-before-retirement: count what the deletion takes with it, and"
echo "  say so in the message. If this is a surprise, STOP — b62add9f said"
echo "  \"comment only\" and removed five files and 3,421 lines."

exit 0
