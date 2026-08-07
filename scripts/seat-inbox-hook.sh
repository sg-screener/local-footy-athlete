#!/bin/bash
# Stop hook: the terminal may not end its turn while ANY unprocessed
# seat order exists. (Parked-item exclusion removed 2026-08-07 — a
# parked item is marked "parked" in its own text; nothing is excluded
# by name.)
inbox="docs/SEAT_INBOX.md"
[ -f "$inbox" ] || exit 0
# The scan STOPS at the next '## ' heading. Without that bound the flag stayed
# on to end-of-file and matched a '1.' line inside a PROCESSED section — on
# 2026-08-07 it read "1. SAM RULED: MERGE" from the thirty-second pass and
# blocked on a cleared inbox. The name exclusion this replaced had been hiding
# the bug: it happened to match the only item that ever reached the end.
first=$(awk '/^## Unprocessed/{f=1;next} f&&/^## /{exit} f&&/^1\./{print;exit}' "$inbox")
if [ -n "$first" ] && ! echo "$first" | grep -qi "parked"; then
  echo '{"decision":"block","reason":"The seat inbox holds an unprocessed order. Read docs/SEAT_INBOX.md item 1 and continue under the one-turn law. End your turn only when the inbox is clear or a genuine STOP report is committed."}'
fi
exit 0
