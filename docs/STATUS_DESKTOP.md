# DESKTOP — your own status file. ONE WRITER: you.

**CLAIMED 2026-08-13 by session `691865a7`, and the claim is reasoned rather than
assumed:** the other two named themselves to me over the wire — `34617` as *"the
terminal"* (rules engine: conditioning selection, `defaultProgram`, §18 safety)
and `88331` as *"second terminal (session -8f)"*. **I am the one driving the
simulator and Maestro**, and the away flow this session continues is recorded in
the inbox as *"OWNED BY THE DESKTOP AGENT, and it found this itself by putting
the away flow on a PHONE"*. `STATUS_AGENT3.md` is therefore `88331`'s to rename.
**If either of them disagrees, this line is the thing to correct.**

**Created 2026-08-13.** Measured cause: in six hours the two agents made 68
commits to `docs/SEAT_INBOX.md` between them — median 40 lines, but the top of
the distribution ran to 864 — and two of those wholesale rewrites swept up the
other agent's finished work, once undoing ~26 files.

**They almost never collide in CODE.** The terminal lives in the rules engine,
the desktop in screens and flows; over four hours they overlapped on nothing
that mattered. **Every mess today came from ONE shared file.**

## THE RULE

- **`docs/SEAT_INBOX.md` is the SEAT's file.** You READ it. You may mark an item
  (`BLOCKED-BY:`, an owner line, a one-line status on the heading) — small edits,
  under 150 changed lines. **You may not rewrite, re-order, compress or archive
  it.** If it needs that, say so here and the seat does it.
- **THIS file is yours.** Findings, measurements, what you tried and backed out,
  what the next session should start on. Write freely — nobody else edits it.
- **The other agent's status file is READ-ONLY to you.** Read it before starting
  anything, so two of you never take the same item again (it happened on
  2026-08-13, R-073, eight minutes each).

## WHY IT IS NOT WORKTREES

Separate folders were considered and refused: they force a branch per agent and
a merge per session, and this project already carries 72 abandoned branches from
the last time that was tried. **One writer per file costs nothing and fixes the
thing that actually bit.**

---

## STATUS

## 2026-08-13 — AWAY (items 28, 36, 37 / R-075) — session `691865a7`

**WHAT THE ATHLETE CAN SEE NOW, photographed each time:** telling the app he is
away 13-20 July takes the team night off Tuesday and Thursday, takes the game off
Saturday, and **Saturday now carries "Accessories — 5 exercises"** where it used
to read *"Training Day"*. His five own training days are untouched throughout.

### THE THREE THINGS WORTH CARRYING FORWARD

**1. TWO ORDERED FIXES WERE REFUTED BY MEASURING THEM, ON THE SAME DAY.** Item
28's step 1 (*"put travel back on `isRuledDerivingConstraint`"*) and item 36's
(*"assert the athlete's rows are a SUPERSET home->away"*). Both were aimed at
mechanisms that measurement said were not there. **Neither was a bad order — both
were written from totals rather than contents.** Item 28 was decided by
photographing the week both ways; item 36 by dumping the ROWS instead of the row
COUNT. **When an order names a mechanism, print the mechanism before building
against it.**

**2. THE INSTRUMENT CONTROL IS NOW PERMANENT AND IT IS WHY ANY OF THIS READ.**
`[temporary-source-fact] lane` logs on EVERY commit, not only on failure, so **a
run with no lane line is a DEAD INSTRUMENT, not a result.** That single line
withdrew the premise the whole of item 28 rested on: the refusal (*"That didn't
save"*) never reproduced, and two earlier confidently-wrong conclusions had come
from reading an absence with no control.

**3. `git status` IS NOT AN INSTRUMENT IN THIS CHECKOUT AND IT COST REAL WORK
TODAY.** `b62add9f` committed a stale index — 37 files, 3,421 deletions, titled
*"comment only"*. It deleted the entire away read-filter. I read HEAD **three
times** before believing it, then restored from my working copy
(`186c2b1b`), verified as a strict superset (`git diff --numstat b62add9f^ HEAD`
= `+26 / -0`). **Use `cmp` against `git show HEAD:<path>`, and stage-and-commit by
path in ONE command.**

### WHAT I TRIED AND BACKED OUT — so nobody spends it again

- **Travel on the deriving lane** (item 28 step 1). Re-authors the current week,
  but Thu goes `Strength` -> `Rest Day`, the tap takes ~1 min and generates
  **1,220 workouts** — §18's 48-candidate repair search regenerating Thursday
  **616 times** on a club-less bye-build. Backed out; the comment now carries the
  measurement so the line is not ordered changed a third time.
- **Moving `applyAwayPass` BEFORE §18 tier four** (item 37, first attempt).
  Photographed: Saturday stayed empty AND **Wednesday got worse** — core
  `Conditioning` became optional `Accessories`. Reverted.
- **`'rest'` on the vacated day.** Shipped, and Sam overturned it within the hour:
  *"your Saturday Rest Day is the wrong case"*. **`'none'` and `'rest'` are two
  wordings of one hole.**

### START HERE NEXT

- **THE ONE UNIT BEHIND BOTH ITEM 28 AND R-075:** a club-less week's §18 contract
  declares more core conditioning than a bye-build delivers, and the 48-candidate
  repair search cannot close it. **Both away routes dead-end there.** R-075 is
  filled at the DAY, not the WEEK.
- **Item 34 / census C7 is one line from startable** and is the terminal's now:
  the hinge is deleted on purpose by the `main_pattern_drift` branch in
  `workoutCanonicalisation.ts`, receipted in `482e0cb6`.
- **`test:power-counting`'s golden has moved and NOBODY owns it.** Cause is known
  (`c69151d9` is not output-neutral). I declined to re-bless a golden I did not
  author; it is still unclaimed.
- **The device flow lives in a session scratchpad and has nearly been lost twice.**
  `pkill -f "expo start --dev-client"` -> ONE `npx expo start --dev-client --port
  8082 --clear` -> `scripts/dev-e2e/run-maestro-ios.sh -e
  SEED_ID=standard-in-season-week <flow>`. 14 steps. **It should live in
  `.maestro/`.**

