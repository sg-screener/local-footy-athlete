#!/bin/bash
# Stop hook: the terminal may not end its turn while ANY unprocessed
# seat order exists. (Parked-item exclusion removed 2026-08-07 — a
# parked item is marked "parked" in its own text; nothing is excluded
# by name.)
inbox="docs/SEAT_INBOX.md"
[ -f "$inbox" ] || exit 0
# ─────────────────────────────────────────────────────────────────────────────
# AN ORDER IS CONTENT, NOT A NUMBER. (2026-08-10, item 000(B).)
#
# SIGHTING 4 OF THE CLASS THIS FILE'S OWN COMMENTS NAMED TWICE: "the scan
# infers 'an order exists' from a NUMBERING ARTEFACT". The scan matched
# `^1\.` and nothing else, so **every order the seat wrote as `00.`, `0.` or
# `000.` was invisible to it**. Every batch survived only because a `1.`
# happened to exist further down; a batch of `00.` and `0.` alone ended the
# turn silently and SAM HAD TO TYPE `check inbox` HIMSELF. That is the courier
# toll — he becomes the message bus — and it is a real defect with a cost in
# his day, not a cosmetic one. Observed live on 2026-08-10: he typed it twice.
#
# The two earlier misfires were the same disease in the other direction:
#   2026-08-07 (a) matched a '1.' inside a PROCESSED section and blocked a
#                  cleared inbox — fixed by bounding the scan at the next '## '.
#   2026-08-07 (b) matched the EMPTY-QUEUE MARKER written as "1. (queue empty)".
#
# So the rule is now stated positively and by CONTENT: **anything under
# `## Unprocessed`, up to the next `## ` heading, that is not blank, not an
# empty-queue marker and not a parked item, is an order.** Numbering is read
# only to be STRIPPED. A new numbering convention cannot re-arm the trap,
# because no convention is consulted.
#
# Items are found at COLUMN 0: an item head starts flush left and its
# continuation lines are indented, which is how this file has always been
# written. An indented line is never an item on its own, so a wrapped sentence
# cannot masquerade as a second order.
#
# Both directions are proven in `scripts/__tests__/seatInboxHookTests.sh`, and
# the must-NOT-block cases are the point: (a) and (b) were false BLOCKS, and
# only a must-not-block case can catch that class.
# ─────────────────────────────────────────────────────────────────────────────
heads=$(awk '/^## Unprocessed/{f=1;next} f&&/^## /{exit} f&&/^[^[:space:]]/{print}' "$inbox")

order=""
while IFS= read -r line; do
  [ -n "$line" ] || continue
  # Strip decoration and ANY numbering/bullet, then read what is left.
  norm=$(printf '%s' "$line" \
    | sed -E 's/^[[:space:]]*//; s/^[*_>#]+[[:space:]]*//; s/^[0-9]+\.[[:space:]]*//; s/^[-*+][[:space:]]*//; s/^[*_]+//')
  # A line that says the queue is empty is not an order, however it is written.
  printf '%s' "$norm" | grep -qiE '^\(?(none|nothing|queue empty|empty)\b' && continue
  # A parked item is marked parked in its own text.
  printf '%s' "$line" | grep -qi 'parked' && continue
  order="$line"
  break
done <<EOF
$heads
EOF

# ─────────────────────────────────────────────────────────────────────────────
# THE FOUR EXITS. (Item 0, built 2026-08-12 to Sam's order, verbatim.)
#
# **SAM:** *"why does it keep fuckign stopping if theres nothing for me to say"*
# and *"i want it to run through the list overnight as long as it can"*.
#
# THE DIAGNOSIS IS THIS SESSION'S OWN. Order 0 said "do not stop while this queue
# has items" for hours and the terminal stopped after nearly every unit anyway.
# **It was not disobeying: `docs(stop):` was a LEGAL EXIT in this script, and a
# note in a file never beats a door in a script.** Sam was the restart button.
#
# HISTORY, KEPT BECAUSE IT IS THE REASON THIS BLOCK EXISTS: from 2026-08-10 the
# exit was "HEAD's subject begins `docs(stop):`", which itself fixed a promise
# this hook had made in its block text and never implemented. That exit is now
# WITHDRAWN — it became the hole. A routine progress report no longer ends a
# turn; progress reports are still written, they just stop being a door.
#
# A STOP IS ALLOWED ONLY WHEN ONE OF THESE IS TRUE:
#
#   1. THE QUEUE IS EMPTY — the scan above found no order.
#   2. HEAD's subject begins `docs(blocked):` — a declaration that the terminal
#      genuinely cannot proceed, naming why. Deliberately a DIFFERENT word from
#      `docs(stop):`, so the exit cannot be taken by the report it used to be
#      taken by.
#   3. A DECISION WAS WRITTEN DOWN THIS COMMIT — HEAD adds a line inside
#      `## AWAITING SAM`. "Not already recorded in this file" is the order's
#      wording, so the check is that the line is NEW, not merely that the section
#      exists: a section that has held something since yesterday would otherwise
#      be a permanent door.
#   4. NO PROGRESS — three consecutive turn-ends with the same HEAD. **Measured,
#      not estimated: progress is a COMMIT, not activity.** This is the loop
#      breaker and the safety the whole change rests on; without it a terminal
#      that cannot commit would be blocked forever with no way out.
#
# THE COUNTER'S STATE IS MACHINE-LOCAL (`.claude/` is gitignored) because it is
# about THIS terminal's turns, not about the repo. It stores the HEAD it last saw
# and how many turn-ends have ended on that same HEAD.
# ─────────────────────────────────────────────────────────────────────────────
if [ -n "$order" ] && git rev-parse --git-dir >/dev/null 2>&1; then
  head_subject=$(git log -1 --pretty=%s 2>/dev/null || echo "")
  head_sha=$(git rev-parse HEAD 2>/dev/null || echo "")

  # EXIT 2 — a declaration that it cannot proceed, AND A REASON THAT QUALIFIES.
  #
  # THE EXIT SAM CLOSED REOPENED UNDER A NEW NAME (item 29, 2026-08-13). Item 0
  # removed `docs(stop):` because a routine progress report was ending turns;
  # `docs(blocked):` then carried the same traffic under a different word — 18 of
  # 77 commits in six hours, roughly one every twenty minutes. The hook could not
  # tell, because it only read the subject PREFIX.
  #
  # THE DISTINCTION, WHICH NOBODY HAD WRITTEN DOWN. BLOCKED means the terminal
  # cannot resolve it ALONE: it needs a ruling only Sam can give, a file another
  # agent is holding, or something outside the repo. A wall it can MEASURE ITSELF
  # is not a block — "I have found the next question" is the definition of NOT
  # blocked, because it is the definition of knowing what to do next.
  #
  # So the subject is no longer enough. The body must name the category, and the
  # word must be one of three. Anything else and the exit stays shut: the commit
  # is fine, it just does not end the turn.
  case "$head_subject" in
    'docs(blocked):'*)
      blocked_by=$(git log -1 --pretty=%B 2>/dev/null \
        | sed -n 's/^BLOCKED-BY:[[:space:]]*\([a-z-]*\).*/\1/p' | head -1)
      case "$blocked_by" in
        sam|other-agent|external) order="" ;;
      esac
      ;;
  esac

  # EXIT 3 — a decision written down under `## AWAITING SAM` in THIS commit.
  if [ -n "$order" ]; then
    added=$(git show HEAD --unified=0 -- "$inbox" 2>/dev/null \
      | sed -n 's/^+\([^+].*\)/\1/p')
    if [ -n "$added" ]; then
      section=$(awk '/^## AWAITING SAM/{f=1;next} f&&/^## /{exit} f&&NF{print}' "$inbox")
      if [ -n "$section" ]; then
        while IFS= read -r line; do
          [ -n "$line" ] || continue
          # `--` is not decoration: an AWAITING SAM line starts with "- ", and
          # without it grep reads the added line as its own options and dies.
          if printf '%s\n' "$section" | grep -qxF -- "$line"; then order=""; break; fi
        done <<ADDED
$added
ADDED
      fi
    fi
  fi

  # EXIT 4 — the loop breaker. Three turn-ends on one HEAD and the stop is
  # allowed, because at that point the terminal is not producing anything and
  # blocking it again only burns Sam's tokens.
  if [ -n "$order" ] && [ -n "$head_sha" ]; then
    state_dir=".claude"
    state_file="$state_dir/seat-inbox-hook-state"
    [ -d "$state_dir" ] || mkdir -p "$state_dir" 2>/dev/null
    last_sha=""; stalls=0
    if [ -f "$state_file" ]; then
      last_sha=$(sed -n '1p' "$state_file" 2>/dev/null)
      stalls=$(sed -n '2p' "$state_file" 2>/dev/null)
      case "$stalls" in ''|*[!0-9]*) stalls=0 ;; esac
    fi
    if [ "$last_sha" = "$head_sha" ]; then
      stalls=$((stalls + 1))
    else
      stalls=1
    fi
    printf '%s\n%s\n' "$head_sha" "$stalls" > "$state_file" 2>/dev/null
    if [ "$stalls" -ge 3 ]; then
      order=""
      echo "seat-inbox-hook: STALLED — three turn-ends on $head_sha with no new commit. Allowing the stop; say plainly that it stalled." >&2
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# THE REASON TEXT IS THE ONLY PLACE THE TERMINAL IS EVER TOLD THE RULE.
#
# It went stale the moment EXIT 2 grew a body requirement (item 29): the door
# started demanding `BLOCKED-BY:` and this sentence still said "naming why you
# cannot proceed", which a terminal satisfies by writing prose. So the exit was
# refused for a reason its own instructions never mentioned — the same class as
# the promise this hook once made in its block text and never implemented
# (`4bb9b2e0`), pointing the other way.
#
# `seatInboxHookTests.sh` now asserts this string names the line AND all three
# legal values, so a future tightening of the door cannot leave the sign behind.
# ─────────────────────────────────────────────────────────────────────────────
if [ -n "$order" ]; then
  echo '{"decision":"block","reason":"The seat inbox holds an unprocessed order. Read docs/SEAT_INBOX.md — the topmost item under \"## Unprocessed\" — and continue under the one-turn law. Item numbering carries no meaning; the order is whatever is written there. A docs(stop): progress report is NO LONGER an exit (item 0, 2026-08-12). End your turn only when: the queue is clear; HEAD is a commit whose subject begins docs(blocked): AND whose body carries a line reading BLOCKED-BY: sam, BLOCKED-BY: other-agent or BLOCKED-BY: external — those three words are the whole list, and the prefix alone is not an exit (item 29, 2026-08-13). BLOCKED means you cannot resolve it ALONE: a ruling only Sam can give, a file another agent is holding, or something outside the repo. A wall you can measure yourself is NOT a block — finding the next question is the definition of knowing what to do next, so take that step in THIS turn. You may also end when you wrote a NEW decision under ## AWAITING SAM in this commit, or when three turn-ends have passed with no new commit at all."}'
fi
exit 0
