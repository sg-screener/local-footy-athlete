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
# THE STOP-REPORT EXIT, WHICH THIS HOOK HAS BEEN PROMISING AND NEVER HAD.
#
# The block reason has always ended "...or a genuine STOP report is committed" —
# and **nothing in this script ever looked for one**. A terminal that committed a
# real STOP was blocked exactly as hard as one that had done nothing, so the only
# way out was to keep working or to leave the queue unanswered. **Same defect
# class as the `^1\.` numbering artefact: the reason text promised a mechanism
# the logic did not implement.** 2026-08-10.
#
# WHAT COUNTS, and it is deliberately narrow: the CURRENT HEAD commit is a stop
# report — subject beginning `docs(stop):`. Not "a stop report exists somewhere
# in history"; not a marker a terminal can write into a file it also authors. It
# must be the last thing committed, so the exit costs a real commit whose message
# is the report and whose diff is on the record.
#
# THIS IS NOT A WAY TO SKIP WORK. A stop report that is not true is a lie in the
# git log with the author's name on it, which is a worse position than an
# unanswered queue. LAW-do-as-instructed and DOC-TRUTH both bind it.
if [ -n "$order" ] && git rev-parse --git-dir >/dev/null 2>&1; then
  head_subject=$(git log -1 --pretty=%s 2>/dev/null || echo "")
  case "$head_subject" in
    'docs(stop):'*) order="" ;;
  esac
fi

if [ -n "$order" ]; then
  echo '{"decision":"block","reason":"The seat inbox holds an unprocessed order. Read docs/SEAT_INBOX.md — the topmost item under \"## Unprocessed\" — and continue under the one-turn law. Item numbering carries no meaning; the order is whatever is written there. End your turn only when the inbox is clear, or when HEAD is a committed STOP report (a commit whose subject begins docs(stop):)."}'
fi
exit 0
