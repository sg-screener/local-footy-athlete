#!/usr/bin/env bash
# SWEEP RUNNER — measures every test:bible suite under a named flag arm and
# prints a failure set.
#
# HARNESS-LIES COMPRESSION (seat order, 2026-08-07, third sighting).
#
# A sweep that cannot prove which tree it ran in is not a measurement. On
# 2026-08-07 a leg (ii) pricing run reported a clean "1 failure" because
# `git worktree add` refuses a second checkout of the same branch, the `cd`
# failed silently, and the loop measured the BRANCH — where the flag under test
# does not exist and is therefore inert. The number was plausible, wrong, and
# silent.
#
# So the world-identity line below is MANDATORY and prints before any suite
# runs: working directory, HEAD, and proof that the toggled symbol exists in
# this tree. Same discipline as gate.sh's exit line — trust only printed
# evidence. If the preamble cannot be established the runner exits non-zero
# WITHOUT measuring, because a sweep that runs anyway is how the lie happens.
#
#   usage: scripts/sweep.sh <label> [SYMBOL_THAT_MUST_EXIST] [VAR=VAL ...]
#   e.g.   scripts/sweep.sh legii-alone LFA_SCAFFOLD_LEG_II LFA_SCAFFOLD_LEG_II=1

set -uo pipefail

LABEL="${1:?usage: sweep.sh <label> [required-symbol] [VAR=VAL ...]}"
shift
REQUIRED_SYMBOL="${1:-}"
[ $# -gt 0 ] && shift

OUT_DIR="${SWEEP_OUT:-.sweep}"
mkdir -p "$OUT_DIR"
FAILS="$OUT_DIR/fails-$LABEL.txt"

# ── MANDATORY PREAMBLE — world identity, printed, or we do not measure ──
if [ ! -f package.json ]; then
  echo "SWEEP ABORT: no package.json in $(pwd) — wrong tree" >&2
  exit 2
fi
HEAD_SHA="$(git rev-parse --short HEAD 2>/dev/null)" || {
  echo "SWEEP ABORT: not a git tree at $(pwd)" >&2; exit 2; }

SYMBOL_HITS="n/a"
if [ -n "$REQUIRED_SYMBOL" ]; then
  SYMBOL_HITS="$(grep -rl "$REQUIRED_SYMBOL" src 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$SYMBOL_HITS" = "0" ]; then
    echo "SWEEP ABORT: '$REQUIRED_SYMBOL' does not exist in src/ at $(pwd)" >&2
    echo "  the arm under test would be INERT here — this is the 2026-08-07 lie" >&2
    exit 3
  fi
fi

echo "SWEEP WORLD: label=$LABEL cwd=$(pwd) head=$HEAD_SHA symbol=${REQUIRED_SYMBOL:-none} files_with_symbol=$SYMBOL_HITS arm=[$*]"

# ── the suites, read from the bible chain itself so it cannot drift ──
SUITES="$(node -e '
const s = require("./package.json").scripts["test:bible"];
console.log([...s.matchAll(/npm run (test:[a-z0-9:\-]+)/g)].map((m) => m[1])
  .filter((n) => n !== "test:compile").join("\n"));
')"
TOTAL="$(printf '%s\n' "$SUITES" | wc -l | tr -d ' ')"
echo "SWEEP SUITES: $TOTAL"

: > "$FAILS"
while IFS= read -r suite; do
  [ -z "$suite" ] && continue
  if ! env "$@" npm run "$suite" > "$OUT_DIR/last.log" 2>&1; then
    echo "$suite" >> "$FAILS"
  fi
done <<< "$SUITES"

echo "SWEEP RESULT: label=$LABEL failures=$(wc -l < "$FAILS" | tr -d ' ') of $TOTAL"
cat "$FAILS"
