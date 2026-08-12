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

# ── REGRESSION (d), 2026-08-10: THE EXIT THE HOOK PROMISED AND NEVER HAD. ──
# The block reason has always ended "...or a genuine STOP report is committed",
# and nothing ever looked for one. These cases run in a REAL git repo, because
# the exit is defined by HEAD's commit subject and a fixture cannot fake that
# without making the claim vacuous.

# `body`, `awaiting` and `stale` were added 2026-08-12 when item 0 became a
# mechanism: the exits now read a DIFFERENT subject word, a NEW line under
# `## AWAITING SAM`, and a counter of turn-ends with no new commit. A
# subject-only fixture can no longer express any of them.
git_case() {
  local name="$1" expected="$2" subject="$3" awaiting_before="${4:-}" awaiting_after="${5:-}" \
    elsewhere="${6:-}" body="${7:-}"
  local repo; repo="$(mktemp -d)"
  mkdir -p "$repo/docs"
  write_inbox() {
    {
      printf '%s\n' "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
        "1. A REAL ORDER, unprocessed."
      [ -n "$2" ] && printf '%s\n' "$2"
      printf '%s\n' "" "## AWAITING SAM — his call" ""
      [ -n "$1" ] && printf '%s\n' "$1"
      printf '%s\n' "" "## Previously (now processed)"
    } > "$repo/docs/SEAT_INBOX.md"
  }
  write_inbox "$awaiting_before" ""
  ( cd "$repo" \
    && git init -q \
    && git config user.email t@t && git config user.name t \
    && git add -A && git commit -q -m "an earlier commit" ) >/dev/null 2>&1
  write_inbox "${awaiting_after:-$awaiting_before}" "$elsewhere"
  if [ -n "$body" ]; then
    ( cd "$repo" && git add -A && git commit -q --allow-empty -m "$subject" -m "$body" ) >/dev/null 2>&1
  else
    ( cd "$repo" && git add -A && git commit -q --allow-empty -m "$subject" ) >/dev/null 2>&1
  fi
  local out; out="$(cd "$repo" && bash "$HOOK")"
  local actual="allow"
  echo "$out" | grep -q '"decision":"block"' && actual="block"
  rm -rf "$repo"
  if [ "$actual" = "$expected" ]; then
    echo "  PASS $name (expected $expected)"; pass=$((pass + 1))
  else
    echo "  FAIL $name — expected $expected, got $actual"; fail=$((fail + 1))
  fi
}

# NON-VACUITY FIRST: the same unprocessed order must still BLOCK when HEAD is an
# ordinary commit. Without this, every "allow" below would prove nothing.
git_case "an unprocessed order BLOCKS when HEAD is an ordinary commit" block \
  "feat(thing): did some work"

# ── ITEM 0, 2026-08-12: `docs(stop):` IS NO LONGER AN EXIT. ────────────────
#
# THIS CELL USED TO READ "a committed STOP report ALLOWS the turn to end" AND IT
# PASSED. That expectation WAS the hole Sam ordered closed: *"why does it keep
# fuckign stopping if theres nothing for me to say"*. The terminal was not
# disobeying order 0 — this script held a door open that the order forbade, and
# a note in a file never beats a door in a script. The case is INVERTED, not
# deleted, so the history of the exit stays legible.
git_case "a routine docs(stop): progress report NO LONGER ends the turn" block \
  "docs(stop): STOP — item 4 landed, item 7 measured"

# ── ITEM 29, 2026-08-13: THE EXIT SAM CLOSED REOPENED UNDER A NEW NAME. ──────
#
# Item 0 removed `docs(stop):` because a routine progress report was ending
# turns. `docs(blocked):` then carried the same traffic under a different word —
# 18 of 77 commits in six hours, one roughly every twenty minutes — and the hook
# could not tell, because it read only the subject PREFIX. Sam saw the symptom:
# "it works for like 5 min then stops and reports but doesn't need us to say
# anything".
#
# THE DISTINCTION, NOW WRITTEN DOWN. BLOCKED means the terminal cannot resolve it
# ALONE: a ruling only Sam can give, a file another agent holds, or something
# outside the repo. A wall it can MEASURE ITSELF is not a block — "I have found
# the next question" is the definition of NOT blocked.
#
# INVERTED, NOT DELETED, so the exit's history stays legible: the bare subject
# used to allow and now blocks.
git_case "docs(blocked): with NO stated reason no longer ends the turn" block \
  "docs(blocked): the second-game field does not exist, item 7 cannot be built"

# ── SAM, 2026-08-13: THE COMMIT-SUBJECT EXIT IS WITHDRAWN ALTOGETHER. ────────
#
# Item 29 measured its own fix and it had missed: 0 of the 18 blocked commits
# before qualified and 4 of 4 after did, yet the rate went UP, 3.0/hour to
# 7.4/hour, all four landing on Sam. THE DOOR WAS NEVER THE PROBLEM — blocked on
# one item is not blocked on the queue, and each of those four stopped with 22
# live orders workable.
#
# HIS RULING: "batch — and when you're stuck on an item, move to the next item
# instead of stopping. Only stop when the whole list is blocked."
#
# THESE THREE ARE INVERTED, NOT DELETED — third time this door has been the hole
# (docs(stop): 2026-08-10, docs(blocked): 2026-08-12, the qualified body
# 2026-08-13), and a deleted cell would erase that.
git_case "BLOCKED-BY: sam no longer ends the turn — work the next item instead" block \
  "docs(blocked): the moderate-day target needs a ruling" "" "" "" \
  "BLOCKED-BY: sam"
git_case "BLOCKED-BY: other-agent no longer ends the turn" block \
  "docs(blocked): HomeScreenV2 is mid-flight in this checkout" "" "" "" \
  "BLOCKED-BY: other-agent"
git_case "BLOCKED-BY: external no longer ends the turn" block \
  "docs(blocked): the simulator will not build" "" "" "" \
  "BLOCKED-BY: external"

# These two already blocked and MUST STILL BLOCK. They are not redundant with
# the inversions above: they are the cells that would catch a re-opening of the
# door in its narrow form, and they cost nothing to keep.
git_case "an invented BLOCKED-BY category still BLOCKS" block \
  "docs(blocked): I found the next question" "" "" "" \
  "BLOCKED-BY: measurement"
git_case "a BLOCKED-BY naming the terminal itself still BLOCKS" block \
  "docs(blocked): I need to probe one more layer" "" "" "" \
  "BLOCKED-BY: terminal"

# ── THE REPLACEMENT, SHIPPED IN THE SAME COMMIT AS THE REMOVAL. ──────────────
#
# A blocked item stops COUNTING as work, so the scan walks past it to the next
# one and "the whole list is blocked" becomes "the scan found nothing" — EXIT 1,
# which already existed. The marker sits on the item HEAD line because column 0
# is the only thing the scan reads.
run "a marked-blocked item is walked PAST to the next order" block \
  "# SEAT INBOX" "" "## Unprocessed" "" \
  "1. NEEDS A RULING — BLOCKED-BY: sam" "" \
  "2. AN ORDER THAT IS STILL WORKABLE." "" \
  "## Previously (now processed)"

run "the whole list marked blocked ALLOWS — his questions arrive in ONE batch" allow \
  "# SEAT INBOX" "" "## Unprocessed" "" \
  "1. NEEDS A RULING — BLOCKED-BY: sam" "" \
  "2. THE FILE IS HELD — BLOCKED-BY: other-agent" "" \
  "3. THE SIMULATOR WILL NOT BUILD — BLOCKED-BY: external" "" \
  "## Previously (now processed)"

# THE ONE THAT STOPS THE MARKER BECOMING A RUBBER STAMP. Any word would
# otherwise buy silence, and the terminal writes this file itself.
run "an INVENTED blocked category marks nothing — the item stays workable" block \
  "# SEAT INBOX" "" "## Unprocessed" "" \
  "1. I FOUND THE NEXT QUESTION — BLOCKED-BY: measurement" "" \
  "## Previously (now processed)"

# AND THE MARKER MUST BE ON THE HEAD LINE. An indented continuation is not an
# item, so a marker buried in an item's body cannot silence its own head — which
# is exactly the "hidden from the scan" class this file has hit five times.
run "a marker in an item's BODY does not block that item" block \
  "# SEAT INBOX" "" "## Unprocessed" "" \
  "1. A REAL ORDER whose body mentions the vocabulary." \
  "    We are BLOCKED-BY: sam on one sub-question, not on the item." "" \
  "## Previously (now processed)"

# EXIT 3 — a decision written down THIS COMMIT under `## AWAITING SAM`.
git_case "a NEW line under AWAITING SAM ALLOWS when it states its registry grep" allow \
  "docs(seat): record the decision Sam owes" "" \
  "- Which day should the game move to? REGISTRY-GREP: grepped RULINGS_REGISTRY.md for \"game\" -> R-001 (any number of games) does not cover which DAY a move lands on."
# THE ASK GATE (2026-08-13). Sam: *"it shouldn't even be an option for the AI to
# fix a problem that has been fixed"*. On that day three questions were drafted
# for him and TWO were already built and already ruled — both recorded in prose
# no agent opened. This cell is the wall: a question that never states its grep
# of `docs/RULINGS_REGISTRY.md` does not open the door.
#
# IT IS THE MUTATION PROOF FOR THE CELL ABOVE. Delete the `REGISTRY-GREP:` check
# from the hook and this cell reds while that one still passes — which is the
# whole reason it exists as its own case rather than a tweak to the fixture.
git_case "an AWAITING SAM entry with NO registry grep is REFUSED" block \
  "docs(seat): ask Sam a question" "" "- Can someone have two games in one week?"
# ...and the same section unchanged does NOT, or a question written yesterday
# would be a permanent door.
git_case "an UNCHANGED AWAITING SAM section still BLOCKS" block \
  "docs(seat): tidy something else" "- Which day should the game move to?" "- Which day should the game move to?"
git_case "an EMPTY AWAITING SAM section still BLOCKS" block \
  "docs(seat): tidy something else"
# THE CASE THAT MAKES "NEW" MEAN ANYTHING, added after a mutation survived: a
# commit that DOES add a line to the inbox, just not under AWAITING SAM. Without
# it, "the line must be in that section" was enforced only by there being no
# diff at all, and a hook that allowed on ANY added line passed every cell.
git_case "a line added ELSEWHERE in the inbox does not open the AWAITING SAM exit" block \
  "docs(seat): add another order" "- An old question, unchanged." "- An old question, unchanged." \
  "2. A SECOND ORDER the seat just wrote."

# EXIT 4 — the loop breaker, measured in COMMITS and not in time. Three
# turn-ends on one HEAD and the stop is allowed; the first two still block.
stall_case() {
  local repo; repo="$(mktemp -d)"
  mkdir -p "$repo/docs"
  printf '%s\n' "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
    "1. A REAL ORDER, unprocessed." "" "## Previously (now processed)" \
    > "$repo/docs/SEAT_INBOX.md"
  ( cd "$repo" && git init -q && git config user.email t@t && git config user.name t \
    && git add -A && git commit -q -m "feat: ordinary" ) >/dev/null 2>&1
  local first second third
  first="$(cd "$repo" && bash "$HOOK")"
  second="$(cd "$repo" && bash "$HOOK")"
  third="$(cd "$repo" && bash "$HOOK")"
  local ok=1
  echo "$first"  | grep -q '"decision":"block"' || ok=0
  echo "$second" | grep -q '"decision":"block"' || ok=0
  echo "$third"  | grep -q '"decision":"block"' && ok=0
  # AND A NEW COMMIT RESETS IT — otherwise the breaker would fire on a terminal
  # that is working perfectly well, three units in.
  ( cd "$repo" && git commit -q --allow-empty -m "feat: progress" ) >/dev/null 2>&1
  local after; after="$(cd "$repo" && bash "$HOOK")"
  echo "$after" | grep -q '"decision":"block"' || ok=0
  rm -rf "$repo"
  if [ "$ok" -eq 1 ]; then
    echo "  PASS three turn-ends with no new commit ALLOW the third, and a commit RESETS the counter"
    pass=$((pass + 1))
  else
    echo "  FAIL the no-progress breaker did not fire on the third turn-end, or a new commit did not reset it"
    fail=$((fail + 1))
  fi
}
stall_case

# ── THE SIGN ON THE DOOR MUST DESCRIBE THE DOOR. (Item 29, 2026-08-13.) ──────
#
# EXIT 2 grew a body requirement and the block reason kept saying "naming why
# you cannot proceed" — prose a terminal satisfies while still being refused,
# for a rule its own instructions never stated. This is the same class as
# `4bb9b2e0` (the hook promised a stop exit and never implemented one), pointing
# the other way: there the sign over-promised, here it under-described.
#
# So the reason text is now ASSERTED, not trusted. Every legal value is named
# individually, so dropping one from the door and forgetting the sign reds here.
reason_case() {
  local repo; repo="$(mktemp -d)"
  mkdir -p "$repo/docs"
  printf '%s\n' "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
    "1. A REAL ORDER, unprocessed." "" "## Previously (now processed)" \
    > "$repo/docs/SEAT_INBOX.md"
  ( cd "$repo" && git init -q && git config user.email t@t && git config user.name t \
    && git add -A && git commit -q -m "feat: ordinary" ) >/dev/null 2>&1
  local out; out="$(cd "$repo" && bash "$HOOK")"
  rm -rf "$repo"
  local missing=""
  for needle in 'BLOCKED-BY: sam' 'BLOCKED-BY: other-agent' 'BLOCKED-BY: external'; do
    printf '%s' "$out" | grep -qF -- "$needle" || missing="$missing [$needle]"
  done
  if [ -z "$missing" ]; then
    echo "  PASS the block reason names the BLOCKED-BY line and all three legal values"
    pass=$((pass + 1))
  else
    echo "  FAIL the block reason does not tell the terminal about:$missing"
    fail=$((fail + 1))
  fi
}
reason_case

# NON-VACUITY for the cell above: it must red when a value is taken off the
# sign. Proven by removing one from a COPY of the hook and re-reading it, so the
# assertion cannot be passing on a string that happens to contain the words for
# some other reason.
reason_liveness_case() {
  local repo; repo="$(mktemp -d)"
  mkdir -p "$repo/docs"
  printf '%s\n' "# SEAT INBOX" "" "## Unprocessed (newest first)" "" \
    "1. A REAL ORDER, unprocessed." "" "## Previously (now processed)" \
    > "$repo/docs/SEAT_INBOX.md"
  ( cd "$repo" && git init -q && git config user.email t@t && git config user.name t \
    && git add -A && git commit -q -m "feat: ordinary" ) >/dev/null 2>&1
  sed 's/BLOCKED-BY: other-agent or //' "$HOOK" > "$repo/mutated-hook.sh"
  local out; out="$(cd "$repo" && bash ./mutated-hook.sh)"
  rm -rf "$repo"
  if printf '%s' "$out" | grep -qF -- 'BLOCKED-BY: other-agent'; then
    echo "  FAIL the reason cell is vacuous — the mutant still reads as complete"
    fail=$((fail + 1))
  else
    echo "  PASS the reason cell reds when a legal value is dropped from the sign (liveness)"
    pass=$((pass + 1))
  fi
}
reason_liveness_case

echo "Seat inbox hook totals: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
