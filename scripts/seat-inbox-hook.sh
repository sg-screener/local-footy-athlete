#!/bin/bash
# Stop hook: the terminal may not end its turn while ANY unprocessed
# seat order exists. (Parked-item exclusion removed 2026-08-07 — a
# parked item is marked "parked" in its own text; nothing is excluded
# by name.)
inbox="docs/SEAT_INBOX.md"
[ -f "$inbox" ] || exit 0
first=$(awk '/## Unprocessed/{f=1;next} f&&/^1\./{print;exit}' "$inbox")
if [ -n "$first" ] && ! echo "$first" | grep -qi "parked"; then
  echo '{"decision":"block","reason":"The seat inbox holds an unprocessed order. Read docs/SEAT_INBOX.md item 1 and continue under the one-turn law. End your turn only when the inbox is clear or a genuine STOP report is committed."}'
fi
exit 0
