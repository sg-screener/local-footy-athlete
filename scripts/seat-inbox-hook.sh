#!/bin/bash
# Stop hook: the terminal may not end its turn while an unprocessed
# seat order exists. Sam-ordered 2026-08-07 ("until this is done").
inbox="docs/SEAT_INBOX.md"
[ -f "$inbox" ] || exit 0
first=$(awk '/## Unprocessed/{f=1;next} f&&/^1\./{print;exit}' "$inbox")
if [ -n "$first" ] && ! echo "$first" | grep -q "PARALLEL_GATE_SHADOW_UNIT"; then
  echo '{"decision":"block","reason":"The seat inbox holds an unprocessed order. Read docs/SEAT_INBOX.md item 1 and continue under the one-turn law. End your turn only when the inbox is clear (item moved to Processed) or a genuine STOP report is committed."}'
fi
exit 0
