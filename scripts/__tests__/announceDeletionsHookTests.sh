#!/usr/bin/env bash
# THE DELETION CENSUS, PROVEN IN BOTH DIRECTIONS.
#
# This announcer has NO refusal — every path exits 0 — so "does it refuse?" is
# not the question. The two that matter are:
#
#   1. DOES IT SPEAK when a deletion is staged? (a silent announcer is the whole
#      defect it exists to fix — `b62add9f` was silent and cost 3,421 lines)
#   2. DOES IT STAY QUIET otherwise? (a hook that prints a deletion warning on
#      every ordinary commit is noise, and noise gets hooks disabled)
#
# THE MUST-STAY-QUIET CASES ARE THE IMPORTANT HALF, exactly as in its sibling:
# this checkout is shared, and a hook that shouts on every commit is one an
# annoyed agent removes — at which point the law is unenforced again and looks
# guarded.
#
# Guards LAW-census-before-retirement.
set -uo pipefail

HOOK="$(cd "$(dirname "$0")/.." && pwd)/announce-deletions-before-commit.sh"
pass=0
fail=0

ok() {
  local name="$1" condition="$2" detail="${3:-}"
  if [ "$condition" = "1" ]; then
    echo "  PASS $name"; pass=$((pass + 1))
  else
    echo "  FAIL $name ${detail:+— $detail}"; fail=$((fail + 1))
  fi
}

# A throwaway repo per case. The hook reads real staged git state; a fixture
# that faked it would be asserting against a mock of the only thing under test.
fresh_repo() {
  local repo; repo="$(mktemp -d)"
  ( cd "$repo" \
    && git init -q \
    && git config user.email t@t && git config user.name t \
    && printf 'a\nb\nc\n' > kept.txt \
    && printf '1\n2\n3\n4\n5\n' > doomed.txt \
    && git add -A && git commit -q -m first ) >/dev/null 2>&1
  echo "$repo"
}

echo "announceDeletionsHookTests"

# ── 1. IT SPEAKS, AND IT NAMES THE FILE ──────────────────────────────────────
# The founding case's whole failure was that nothing said the files were going.
repo="$(fresh_repo)"
( cd "$repo" && git rm -q doomed.txt ) >/dev/null 2>&1
out="$(cd "$repo" && bash "$HOOK" 2>&1)"; code=$?
ok "a staged deletion is ANNOUNCED" \
  "$(echo "$out" | grep -q 'census: THIS COMMIT DELETES' && echo 1 || echo 0)" "out=$out"
ok "the announcement NAMES the deleted file" \
  "$(echo "$out" | grep -q 'doomed.txt' && echo 1 || echo 0)" "out=$out"
ok "it counts the file" \
  "$(echo "$out" | grep -q 'DELETES 1 TRACKED FILE' && echo 1 || echo 0)" "out=$out"
# 5 lines in doomed.txt. A count that named the instrument's unit instead of the
# domain's would print 0, 1 or the file count here — LAW-count-names-instrument,
# sighted five times on the day this was written.
ok "it counts the LINES REMOVED, not the files, and gets 5" \
  "$(echo "$out" | grep -q '5 line(s) removed' && echo 1 || echo 0)" "out=$out"
ok "announcing NEVER refuses the commit" "$([ $code -eq 0 ] && echo 1 || echo 0)" "exit=$code"
rm -rf "$repo"

# ── 2. IT STAYS QUIET — the half that keeps the hook installed ───────────────
repo="$(fresh_repo)"
( cd "$repo" && printf 'a\nb\nc\nd\n' > kept.txt && git add kept.txt ) >/dev/null 2>&1
out="$(cd "$repo" && bash "$HOOK" 2>&1)"; code=$?
ok "a MODIFY-only commit says nothing" \
  "$([ -z "$out" ] && echo 1 || echo 0)" "out=$out"
ok "a modify-only commit exits 0" "$([ $code -eq 0 ] && echo 1 || echo 0)" "exit=$code"
rm -rf "$repo"

repo="$(fresh_repo)"
( cd "$repo" && printf 'new\n' > added.txt && git add added.txt ) >/dev/null 2>&1
out="$(cd "$repo" && bash "$HOOK" 2>&1)"
ok "an ADD-only commit says nothing" "$([ -z "$out" ] && echo 1 || echo 0)" "out=$out"
rm -rf "$repo"

# ── 3. IT READS THE STAGED TREE, NOT THE WORKING TREE ───────────────────────
# THE SHARED-CHECKOUT CASE, AND IT IS THE REASON `--cached` IS IN THE SCRIPT.
# Another session deletes a file in the working tree and has NOT staged it. That
# deletion is not in your commit, and reporting it would smear their unstaged
# work onto your census — a fact about the wrong world, which is this repo's
# most expensive recurring defect.
repo="$(fresh_repo)"
( cd "$repo" && rm doomed.txt ) >/dev/null 2>&1   # deleted on disk, NOT staged
out="$(cd "$repo" && bash "$HOOK" 2>&1)"
ok "an UNSTAGED deletion is NOT announced — the staged tree is the commit" \
  "$([ -z "$out" ] && echo 1 || echo 0)" "out=$out"
rm -rf "$repo"

# ── 4. OUTSIDE A REPO, AND AN EMPTY STAGE ───────────────────────────────────
repo="$(mktemp -d)"
out="$(cd "$repo" && bash "$HOOK" 2>&1)"; code=$?
ok "outside a git repo it is silent and exits 0" \
  "$([ $code -eq 0 ] && [ -z "$out" ] && echo 1 || echo 0)" "exit=$code out=$out"
rm -rf "$repo"

repo="$(fresh_repo)"
out="$(cd "$repo" && bash "$HOOK" 2>&1)"; code=$?
ok "nothing staged at all is silent and exits 0" \
  "$([ $code -eq 0 ] && [ -z "$out" ] && echo 1 || echo 0)" "exit=$code out=$out"
rm -rf "$repo"

# ── 5. THE FOUNDING CASE'S SHAPE — many files at once ───────────────────────
# b62add9f deleted FIVE. A cell that only ever sees one deletion would not catch
# a plural-vs-singular or an accumulator that overwrites instead of adding.
repo="$(fresh_repo)"
( cd "$repo" && printf 'x\n' > b.txt && printf 'y\n' > c.txt && git add -A \
  && git commit -q -m second && git rm -q doomed.txt b.txt c.txt ) >/dev/null 2>&1
out="$(cd "$repo" && bash "$HOOK" 2>&1)"
ok "THREE deletions are counted as three, not as one" \
  "$(echo "$out" | grep -q 'DELETES 3 TRACKED FILE' && echo 1 || echo 0)" "out=$out"
ok "all three are named" \
  "$(echo "$out" | grep -q 'doomed.txt' && echo "$out" | grep -q 'b.txt' \
     && echo "$out" | grep -q 'c.txt' && echo 1 || echo 0)" "out=$out"
ok "lines removed sums ACROSS files (5+1+1=7)" \
  "$(echo "$out" | grep -q '7 line(s) removed' && echo 1 || echo 0)" "out=$out"
rm -rf "$repo"

echo "announce-deletions hook totals: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
