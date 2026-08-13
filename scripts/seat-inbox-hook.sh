#!/bin/bash
# Stop hook: the terminal may not end its turn while ANY unprocessed
# seat order exists. (Parked-item exclusion removed 2026-08-07 — a
# parked item is marked "parked" in its own text; nothing is excluded
# by name.)
inbox="docs/SEAT_INBOX.md"
[ -f "$inbox" ] || exit 0

# ─────────────────────────────────────────────────────────────────────────────
# THE HALT — THE HUMAN ALWAYS WINS, AND UNTIL 2026-08-13 HE COULD NOT.
#
# Sam stopped the terminal twice and told it he was moving to a new chat. It
# answered: *"the stop hook wants me to keep working the queue, but you've
# stopped me twice ... so I'm not going to keep running your simulator."* It had
# to ARGUE its way out, because this hook gave it no other door. **A guardrail
# that overrides the person it works for is not a guardrail.**
#
# This is checked FIRST, before the queue is even read, because a halt that has
# to wait its turn is not a halt.
#
# Any agent told to stop creates the file; deleting it resumes. It is one line
# either way and needs no argument:
#
#     echo halt > .claude/HALT   # stop being blocked
#     : > .claude/HALT           # go back to working the queue
#
# THE TEST IS `-s`, NOT `-f` — CONTENT, NOT EXISTENCE — AND THAT IS DELIBERATE.
# This repo is reached over a mount that CANNOT DELETE FILES; `rm` and `mv` both
# fail with "Operation not permitted". A halt you cannot lift is worse than no
# halt, and the seat built exactly that trap on the first attempt and could not
# clear it. Truncation always works. Resuming must never depend on a delete.
#
# `.claude/` is gitignored, so a halt is THIS machine's, never the repo's, and
# can never travel to another agent or be committed by accident.
if [ -s ".claude/HALT" ]; then
  echo "seat-inbox-hook: HALTED by .claude/HALT — the queue is not being enforced. Say so plainly, and say that emptying it (: > .claude/HALT) resumes it." >&2
  exit 0
fi
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
  # ───────────────────────────────────────────────────────────────────────────
  # A BLOCKED ITEM IS NOT A WORKABLE ORDER. (Sam, 2026-08-13.)
  #
  # HIS RULING, verbatim: *"batch — and when you're stuck on an item, move to
  # the next item instead of stopping. Only stop when the whole list is
  # blocked."*
  #
  # WHY IT LANDED HERE AND NOT AS A FIFTH EXIT. Item 29 shut the unqualified
  # `docs(blocked):` exit and the blocked rate went UP, 3.0/hour to 7.4/hour,
  # every one of them `BLOCKED-BY: sam`. The gate was tight and the goal was
  # missed, because BLOCKED ON ONE ITEM IS NOT BLOCKED ON THE QUEUE: each stop
  # left 22 other live orders workable. A door cannot fix that — the fix is that
  # a blocked item stops COUNTING as work, so the scan walks past it to the next
  # one, and "the whole list is blocked" becomes "the scan found nothing", which
  # is EXIT 1 and already exists. No new exit, no new state, no clock.
  #
  # THE MARKER IS THE VOCABULARY ITEM 29 ALREADY RULED — one word list, and the
  # queue now says on its face what is stuck and on whom. It must sit on the
  # item's HEAD line, because column 0 is the only thing this scan reads; an
  # invented category is not a marker, so the item stays workable and the
  # terminal cannot rubber-stamp its way to silence.
  # ───────────────────────────────────────────────────────────────────────────
  printf '%s' "$line" \
    | grep -qiE 'BLOCKED-BY:[[:space:]]*(other-agent|external|sam)([^a-zA-Z-]|$)' && continue
  # ───────────────────────────────────────────────────────────────────────────
  # THREE MORE STATES THE QUEUE ALREADY WRITES AND THIS SCAN COULD NOT READ.
  # (2026-08-13, seat `arms`, after the hook re-fired four times on a queue whose
  # every item was closed, blocked, or owned by a seat that was actively
  # committing.)
  #
  # NOTHING HERE IS A NEW CATEGORY — that is the whole design. The scan knew two
  # states, BLOCKED and WORKABLE, and the inbox has been writing three others in
  # its own words for days. Each one is named as a DEFECT in the inbox's own
  # text, by a different agent, before I arrived:
  #
  #   · OWNED BY — `CLAUDE.md`, this morning: *"OWNED IS NOT BLOCKED. THIS ONE
  #     WORD WAS DOING TWO JOBS… you walk past it. You do NOT mark it blocked."*
  #     An owned item was WORKABLE here, so the only way past it was to write a
  #     BLOCKED-BY the rule forbids. **The scan was asking for the false marker
  #     the rule was written to stop**, and 15 of 19 items had already worn it.
  #   · ✅ CLOSED — item 40: *"a `✅ CLOSED` head is still WORKABLE to the stop
  #     hook… so a finished item keeps the queue non-empty until the SEAT
  #     archives it. Same structural trap named on item 31."*
  #   · STANDING, EVERY STOP — item 13: *"THESE TWO ITEMS HOLD THE STOP HOOK
  #     OPEN FOREVER — A DEFECT, NOT A BACKLOG… neither clearable nor blocked,
  #     the only two states the scan knows, and `EXIT 1` is unreachable while a
  #     standing order exists."* It names this fix and its own wording for it.
  #
  # EACH IS DELIBERATELY NARROW, because the rubber-stamp risk is the same one
  # the invented-category cell guards:
  #   · OWNED BY must NAME an owner in backticks. A bare "OWNED BY" skips
  #     nothing, so it cannot be typed over a queue to buy silence, and the name
  #     is the thing another seat checks before walking past.
  #   · the completion mark must OPEN the head line — a ✅ inside an item's prose
  #     is a receipt about some part of it, not a statement that it is finished.
  #   · the standing phrase is item 13's own, and those items say of themselves
  #     *"they are not work items to clear."*
  # ───────────────────────────────────────────────────────────────────────────
  printf '%s' "$line" | grep -qiE 'OWNED BY[[:space:]]+`[^`]+`' && continue
  printf '%s' "$norm" | grep -q '^✅' && continue
  printf '%s' "$line" | grep -qi 'STANDING, EVERY STOP' && continue
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
# THREE EXITS, NOT FOUR — EXIT 2 WAS WITHDRAWN 2026-08-13, see its own block
# below. The numbering is KEPT so the history stays legible: exit 3 is still
# called exit 3, because renumbering would make every doc and cell that names
# them silently wrong.
#
# A STOP IS ALLOWED ONLY WHEN ONE OF THESE IS TRUE:
#
#   1. THE QUEUE IS EMPTY — the scan above found no WORKABLE order. Since
#      2026-08-13 that includes a queue whose every remaining item is MARKED
#      blocked, which is how "only stop when the whole list is blocked" is
#      enforced: not by a door, but by a blocked item ceasing to be work.
#   2. WITHDRAWN.
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
  head_sha=$(git rev-parse HEAD 2>/dev/null || echo "")

  # EXIT 2 IS WITHDRAWN — RETIRED 2026-08-13 BY SAM, AND ITS REPLACEMENT SHIPS
  # IN THE SAME COMMIT (the marker in the scan above).
  #
  # ITS WHOLE HISTORY, BECAUSE THIS IS THE SECOND TIME THIS DOOR WAS THE HOLE.
  # 2026-08-10: the exit was `docs(stop):`. Item 0 (2026-08-12) withdrew it
  # because a routine progress report was ending turns. Item 29 (2026-08-13)
  # caught the same traffic wearing `docs(blocked):` — 18 of 77 commits in six
  # hours — and tightened it to demand `BLOCKED-BY: sam|other-agent|external` in
  # the body. THAT TIGHTENING WORKED AND MISSED THE POINT: measured, 0 of the 18
  # before qualified and 4 of 4 after did, while the rate went UP, 3.0/hour to
  # 7.4/hour, all four landing on Sam.
  #
  # THE DIAGNOSIS THREE ATTEMPTS HAD MISSED: the door was never the problem.
  # BLOCKED ON ONE ITEM IS NOT BLOCKED ON THE QUEUE. Sam, 2026-08-13: *"when
  # you're stuck on an item, move to the next item instead of stopping. Only
  # stop when the whole list is blocked."* So a blocked item stops counting as
  # work — marked, walked past, batched — and the stop it used to justify is
  # EXIT 1, reached honestly when nothing workable is left.
  #
  # NOTHING IS LOST BY REMOVING IT. A `docs(blocked):` commit is still written
  # and still names its category; it just is not a door. The turn ends when the
  # QUEUE says so, not when a commit subject does.
  #
  # THE THIRD ATTEMPT AT ONE DOOR IS §8's SECOND-WALL SHAPE, and this is the
  # alternative it demands: stop tightening the exit, change what counts as work.
  #
  # EXIT 3 — a decision written down under `## AWAITING SAM` in THIS commit.
  #
  # THE ASK GATE — ADDED 2026-08-13 BY THE SEAT, AT SAM'S INSISTENCE THAT IT BE
  # A MECHANISM AND NOT AN INSTRUCTION.
  #
  # His words: *"IT SHOULDN'T EVEN BE AN OPTION FOR THE AI TO FIX A PROBLEM THAT
  # HAS BEEN FIXED"* and *"WRITTEN ORDERS DO KIND OF JACK SHIT ... ONLY THINGS
  # THAT ARE BUILT AND SET IN STONE ACTUALLY CHANGE HOW THEY BEHAVE"*. He is
  # right, and this is the door his questions come through, so this is where it
  # belongs.
  #
  # ON 2026-08-13 THREE QUESTIONS WERE DRAFTED FOR HIM AND TWO WERE ALREADY
  # BUILT — a week holding two games (`3f62ad62`, ruled "as many games as
  # needed") and the fixture shortfall sentence (`1dc52caf`). Both were recorded
  # in prose an agent never opened. `docs/RULINGS_REGISTRY.md` is now the one
  # machine-held list, and THIS is what makes reading it non-optional:
  #
  #   AN AWAITING SAM ENTRY MUST CARRY A `REGISTRY-GREP:` LINE STATING THE GREP
  #   THAT WAS RUN AND WHAT IT RETURNED. WITHOUT IT, THE EXIT IS NOT TAKEN.
  #
  # It cannot verify the grep was honest. It CAN make "I never checked" a thing
  # the terminal has to type a lie to claim, and it puts the registry in front of
  # every question at the moment the question is being written. That is the
  # difference between a rule and a wall.
  if [ -n "$order" ]; then
    added=$(git show HEAD --unified=0 -- "$inbox" 2>/dev/null \
      | sed -n 's/^+\([^+].*\)/\1/p')
    if [ -n "$added" ] && ! printf '%s\n' "$added" | grep -q 'REGISTRY-GREP:'; then
      echo "seat-inbox-hook: AWAITING SAM entry has no REGISTRY-GREP: line. Grep docs/RULINGS_REGISTRY.md first and state what it returned. Two of three questions drafted for Sam on 2026-08-13 were already built." >&2
      added=""
    fi
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
  echo '{"decision":"block","reason":"The seat inbox holds a WORKABLE order. Read docs/SEAT_INBOX.md — the topmost item under \"## Unprocessed\" — and continue under the one-turn law. Item numbering carries no meaning; the order is whatever is written there. WHEN YOU ARE STUCK ON AN ITEM, MOVE TO THE NEXT ITEM — DO NOT STOP (Sam, 2026-08-13). Mark the stuck item by putting BLOCKED-BY: sam, BLOCKED-BY: other-agent or BLOCKED-BY: external on that item HEAD line in the inbox, with the question written underneath, then go and work the next order in the SAME turn. Those three words are the whole list and an invented category marks nothing. BLOCKED means you cannot resolve it ALONE: a ruling only Sam can give, a file another agent is holding, or something outside the repo — a wall you can measure yourself is NOT a block. Neither docs(stop): nor docs(blocked): is an exit any more; a commit subject cannot end a turn (item 0, 2026-08-12; Sam, 2026-08-13). You may end the turn only when: every remaining item is marked blocked or the queue is clear, so his questions reach him in ONE batch; you wrote a NEW decision under ## AWAITING SAM in this commit — and that entry CARRIES A REGISTRY-GREP: line naming the grep you ran over docs/RULINGS_REGISTRY.md and what it returned, because on 2026-08-13 two of three questions drafted for Sam were already built and already ruled; or three turn-ends have passed with no new commit at all."}'
fi
exit 0
