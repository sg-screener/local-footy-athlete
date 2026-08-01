# TEAM-NIGHT MOVABILITY — Sam's ruling, 2026-08-01

**RULED BY SAM at the combined device pass, 2026-08-01. RECORDED NOW, BUILT
POST-MERGE.** This file is the record; no code in the buttons/UI unit changes
because of it. Its unit is queued in
`docs/BUTTONS_UI_UNIT_BOUNDARY_2026-07-31.md`, "THE POST-MERGE QUEUE".

## The ruling

**Team training nights become movable and swappable through the day door,
with a typed ask: "just this once, or permanent?"**

The cases that motivated it are real calendar facts, not preferences: public
holidays, training camps, TT weekends — weeks where the club itself moves the
night.

- **One-off** ("just this once") → a **dated schedule fact**: a typed,
  dated, athlete-declared life-fact (north-star input class 2). The week
  re-derives around it; nothing permanent changes.
- **Permanent** → a **schedule change through program setup's owner** — the
  same owner that holds `teamTrainingDays` today. Not a parallel writer, not
  a fact that shadows the profile answer forever.

## Boundaries this ruling respects (and why it is queued, not built)

- The day door currently REFUSES moves on an anchored team night with the
  typed cause `anchored_day` ("Team training is fixed to this day…",
  `planChangeProducer.ts`). That sentence and refusal stay LAW until this
  unit lands — the ruling changes the end state, not today's signed copy.
- The one-off half lands on the SAME fact machinery as the busy/away doors,
  which are currently dead on a real accepted base (declared reds 8-9, the
  schedule-fact ownership collision). Building the one-off path before that
  collision is ruled would add a third door to a broken frame — so this unit
  is **queued behind the merge, alongside block rollover and the
  schedule-fact ownership collision**, per Sam's own ordering.
- The permanent half must go through the profile/program-setup owner so
  there is never a second representation of "which nights are team nights"
  (north star: store only decisions; one owner per fact).

## Also queued the same day (separate, smaller)

**Icon-picking session:** the terminal proposes 2-3 glyph candidates per
flagged row and Sam picks. Imagery is judged on glass, not signed as text
(copy sheet §6-II-h), so this is a live session with Sam, not a sheet.
