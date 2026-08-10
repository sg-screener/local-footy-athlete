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

# ── REGRESSION (c), 2026-08-10: THE COURIER TOLL. ───────────────────────────
# SIGHTING 4 of "the scan infers an order from a NUMBERING ARTEFACT", and the
# first one that cost Sam something directly: the scan matched `^1\.` only, so
# every order the seat wrote as `00.` or `0.` was INVISIBLE and the turn ended
# silently. He had to type `check inbox` himself — twice on 2026-08-10. Each
# case below is a real shape from that day's inbox and each one ALLOWED before
# the content-based rewrite.

run "an order numbered 00. BLOCKS" block \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "00. STOP THE LINE. Flip the registry gate's default now." "" \
  "## Previously (now processed)"

run "an order numbered 0. BLOCKS" block \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "0. SAM'S RULING: every law gets a guard." "" \
  "## Previously (now processed)"

run "an order numbered 000. BLOCKS" block \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "000. SAM: audit every row against its source." "" \
  "## Previously (now processed)"

run "a BULLET order BLOCKS" block \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "- Build the export affordance and report the price first." "" \
  "## Previously (now processed)"

run "BARE PROSE with no marker at all BLOCKS" block \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "Sam wants the conditioning case answered before anything else." "" \
  "## Previously (now processed)"

# The whole batch is 00./0. — the exact shape that ended a turn silently,
# because no '1.' happened to exist further down to save it.
run "a batch of ONLY 00. and 0. BLOCKS" block \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "00. STOP THE LINE." "" "0. SAM'S RULING." "" \
  "## Previously (now processed)"

# ── AND THE OTHER DIRECTION, so the fix cannot be "block on everything". ────

run "an INDENTED continuation line is not its own order" allow \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "(none)" "   this indented line continues the marker above, and is not an order" "" \
  "## Previously (now processed)"

run "a 00.-numbered empty-queue marker ALLOWS" allow \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "00. (queue empty)" "" \
  "## Previously (now processed)"

run "a BOLD none marker ALLOWS" allow \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "**NONE.** Everything below is processed." "" \
  "## Previously (now processed)"

run "a 00.-numbered PARKED item ALLOWS" allow \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "00. PARKED until the build lands: the glass run." "" \
  "## Previously (now processed)"

run "an EMPTY Unprocessed section ALLOWS" allow \
  "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
  "## Previously (now processed)" "" \
  "1. AN ORDER FROM A PAST BATCH, long since processed."

echo "Seat inbox hook totals: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
