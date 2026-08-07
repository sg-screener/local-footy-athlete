#!/usr/bin/env bash
# THE SEAT-INBOX STOP HOOK, PROVEN IN BOTH DIRECTIONS.
#
# The hook decides whether this terminal may end its turn. A hook that only
# ever blocks is as broken as one that never does, and BOTH failure modes have
# now happened on this file:
#
#   2026-08-07 (a) it matched a '1.' inside a PROCESSED section and blocked a
#                  cleared inbox — fixed by bounding the scan at the next '## '.
#   2026-08-07 (b) it matched the EMPTY-QUEUE MARKER when that marker was
#                  written as "1. (queue empty)" instead of "(none)" — because
#                  the scan infers "an order exists" from a NUMBERING ARTEFACT.
#
# So the cases below assert the blocking direction AND the non-blocking one.
# A case that must not block is not decoration: (a) and (b) were both false
# BLOCKS, and only a must-not-block case can catch that class.
set -uo pipefail

HOOK="$(cd "$(dirname "$0")/.." && pwd)/seat-inbox-hook.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/docs"

pass=0
fail=0

# run <name> <expected: block|allow> <inbox body...>
run() {
  local name="$1" expected="$2"; shift 2
  printf '%s\n' "$@" > "$WORK/docs/SEAT_INBOX.md"
  local out; out="$(cd "$WORK" && bash "$HOOK")"
  local actual="allow"
  echo "$out" | grep -q '"decision":"block"' && actual="block"
  if [ "$actual" = "$expected" ]; then
    echo "  PASS $name (expected $expected)"
    pass=$((pass + 1))
  else
    echo "  FAIL $name — expected $expected, got $actual"
    fail=$((fail + 1))
  fi
}

echo "-- seat inbox stop hook --"

run "a real order BLOCKS" block \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "1. SAM RULED: MERGE TO MAIN. Commit as authored." "" \
  "## Processed 2026-08-06 — earlier"

run "the (none) marker ALLOWS" allow \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "(none)" "" \
  "## Processed 2026-08-06 — earlier"

# REGRESSION (b): the exact shape that blocked a cleared inbox on 2026-08-07.
run "a NUMBERED empty-queue marker ALLOWS" allow \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "1. (queue empty)" "" \
  "## Processed 2026-08-06 — earlier"

# REGRESSION (a): a '1.' that lives only inside a PROCESSED section.
run "an order inside a PROCESSED section ALLOWS" allow \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "(none)" "" \
  "## Processed 2026-08-07 — the order as the seat wrote it" "" \
  "1. SAM RULED: MERGE. Commit as authored."

run "a PARKED item ALLOWS" allow \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "1. PARKED until the merge gate: the shadow unit." "" \
  "## Processed 2026-08-06 — earlier"

# NON-VACUITY, and it is not optional. Every case above asserts on a hook that
# could in principle be a no-op; this one mutates the inbox into an unambiguous
# order and requires a block, so a hook that always allowed would be caught.
run "a second real order still BLOCKS" block \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "1. ORDER: write the boundary report, then STOP." "" \
  "2. (queue empty below this)"

echo "Seat inbox hook totals: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
