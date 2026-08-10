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

if [ -n "$order" ]; then
  echo '{"decision":"block","reason":"The seat inbox holds an unprocessed order. Read docs/SEAT_INBOX.md — the topmost item under \"## Unprocessed\" — and continue under the one-turn law. Item numbering carries no meaning; the order is whatever is written there. End your turn only when the inbox is clear or a genuine STOP report is committed."}'
fi
exit 0
