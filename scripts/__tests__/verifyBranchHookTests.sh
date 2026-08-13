#!/usr/bin/env bash
# THE BRANCH CHECK, PROVEN IN BOTH DIRECTIONS.
#
# A hook that refuses everything is as broken as one that refuses nothing, and
# THIS hook is deliberately fail-open: it has exactly one refusal and every other
# path exits 0. That makes the must-NOT-refuse cases the important half — they
# are what stops this script becoming a way to break another session's commits
# in a shared checkout.
#
# Guards LAW-verify-branch-before-commit.
set -uo pipefail

HOOK="$(cd "$(dirname "$0")/.." && pwd)/verify-branch-before-commit.sh"
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

# A throwaway repo per case: the hook reads real git state, and a fixture that
# faked it would be asserting against a mock of the only thing under test.
fresh_repo() {
  local repo; repo="$(mktemp -d)"
  ( cd "$repo" \
    && git init -q \
    && git config user.email t@t && git config user.name t \
    && git commit -q --allow-empty -m "first" ) >/dev/null 2>&1
  echo "$repo"
}

echo "-- verify-branch-before-commit --"

# ── ON A BRANCH: prints it, allows. This is the law's actual requirement — the
# check happens without anyone remembering to run it.
repo="$(fresh_repo)"
( cd "$repo" && git checkout -q -b feat/some-work ) >/dev/null 2>&1
out="$(cd "$repo" && bash "$HOOK" 2>&1)"; code=$?
ok "on a branch it ALLOWS" "$([ $code -eq 0 ] && echo 1 || echo 0)" "exit=$code"
ok "on a branch it PRINTS the branch name" \
  "$(echo "$out" | grep -q 'branch: feat/some-work' && echo 1 || echo 0)" "got: $out"
rm -rf "$repo"

# NON-VACUITY: a DIFFERENT branch must print a DIFFERENT name. Without this the
# cell above passes on a script that hardcodes the string.
repo="$(fresh_repo)"
( cd "$repo" && git checkout -q -b other/branch-name ) >/dev/null 2>&1
out="$(cd "$repo" && bash "$HOOK" 2>&1)"
ok "the printed name FOLLOWS the branch, it is not a constant" \
  "$(echo "$out" | grep -q 'branch: other/branch-name' && echo 1 || echo 0)" "got: $out"
rm -rf "$repo"

# ── DETACHED HEAD: the one refusal. This is the founding case's worst form —
# the commit lands on no branch at all.
repo="$(fresh_repo)"
( cd "$repo" && git commit -q --allow-empty -m "second" && git checkout -q HEAD~1 ) >/dev/null 2>&1
out="$(cd "$repo" && bash "$HOOK" 2>&1)"; code=$?
ok "a DETACHED HEAD is REFUSED" "$([ $code -ne 0 ] && echo 1 || echo 0)" "exit=$code"
ok "the refusal SAYS detached, so the cause is readable" \
  "$(echo "$out" | grep -qi 'detached' && echo 1 || echo 0)" "got: $out"
# ...and the escape hatch works, because a refusal with no exit is a trap.
out="$(cd "$repo" && LFA_ALLOW_DETACHED=1 bash "$HOOK" 2>&1)"; code=$?
ok "LFA_ALLOW_DETACHED=1 ALLOWS the detached commit" \
  "$([ $code -eq 0 ] && echo 1 || echo 0)" "exit=$code out=$out"
rm -rf "$repo"

# ── THE FAIL-OPEN CASES. Each of these is a state the hook must NOT refuse,
# because refusing it would break a concurrent session for a reason it did not
# cause. These are the cells that matter most for a hook installed repo-wide.

# A REPO WITH NO COMMITS YET. I expected this to print an empty branch and need
# its own escape, wrote one, and the mutation that DELETED that escape survived
# — because `--show-current` prints the branch HEAD points at even when unborn,
# so a fresh `git init` prints `main` and never reaches the detached path. The
# escape was dead code and this cell was green because of the early return.
# The cell STAYS, because "a fresh repo is not refused" is a real must-not-refuse
# claim; its NAME now says what actually makes it true.
repo="$(mktemp -d)"
( cd "$repo" && git init -q && git config user.email t@t && git config user.name t ) >/dev/null 2>&1
out="$(cd "$repo" && bash "$HOOK" 2>&1)"; code=$?
ok "a repo with NO COMMITS is not refused — it reports its unborn branch normally" \
  "$([ $code -eq 0 ] && echo "$out" | grep -q 'branch: ' && echo 1 || echo 0)" "exit=$code out=$out"
rm -rf "$repo"

# Outside a git repo at all.
repo="$(mktemp -d)"
out="$(cd "$repo" && bash "$HOOK" 2>&1)"; code=$?
ok "outside a git repo it ALLOWS" "$([ $code -eq 0 ] && echo 1 || echo 0)" "exit=$code"
rm -rf "$repo"

# A detached HEAD in a repo with a DIRTY tree — the everyday shape of a
# concurrent session's work. Still refused, and still only for being detached.
repo="$(fresh_repo)"
( cd "$repo" && git commit -q --allow-empty -m "second" && git checkout -q HEAD~1 \
  && echo dirty > file.txt ) >/dev/null 2>&1
code=0; ( cd "$repo" && bash "$HOOK" >/dev/null 2>&1 ) || code=$?
ok "a dirty tree does not change the verdict — only detachment does" \
  "$([ $code -ne 0 ] && echo 1 || echo 0)" "exit=$code"
rm -rf "$repo"

echo "verify-branch hook totals: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
