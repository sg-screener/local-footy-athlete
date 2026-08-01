# Team-night movability — design sheet (2026-08-01)

Unit 3 of the day shift, designing the unit Sam ruled at the combined pass
(`docs/TEAM_NIGHT_MOVABILITY_RULING_2026-08-01.md`). SHEET ONLY — no code;
the strings and two design choices park for Sam
(`docs/PARKED_QUESTIONS_2026-08-01.md` §3).

## The ruling being designed

Team training nights become movable/swappable through the day door, with a
typed ask: **"just this once, or permanent?"** One-off = a dated schedule
fact; permanent = a schedule change through program setup's owner
(`teamTrainingDays` — one owner, never a shadow).

## The flow (follows the G-1 ask pattern: one ask, typed routes, one funnel)

1. Athlete opens the day door on a team night and taps Move (or Swap). Today
   this refuses with the signed `anchored_day` sentence ("Team training is
   fixed to this day, so it can't be moved from here.") — that sentence
   RETIRES when this unit lands and is recorded as such in the copy sheet.
2. The producer raises the typed ask instead of the refusal:
   `team_night_move_ask` with two routes (+ back):
   - **`this_week_only`** → a dated schedule fact: "team training is on
     <target day> instead of <usual day>, for the week of <date>" — a typed,
     dated, athlete-declared life-fact. The week re-derives around it;
     nothing permanent changes; undo = resolve the fact.
   - **`permanent`** → the program-setup owner updates `teamTrainingDays`
     (the same write path onboarding/profile-edit uses — no parallel
     writer), which regenerates forward per that owner's existing rules.
3. Landing behaviour reuses the doubling law: a team night moved onto an
   occupied day lands COMBINED (anchor stays an anchor on its new day); the
   vacated day re-derives.

## Dependencies, stated honestly

- **The one-off half needs Unit 2's approved lanes.** A team-night fact is a
  DERIVING schedule fact (it changes the week's shape by definition), so it
  commits via scoped regen — the lane that exists and works (illness
  precedent). It must NOT be built while schedule facts ride the dead lane;
  this is why Sam queued the unit behind the ownership reassessment.
- **The permanent half has no dependency** — the setup owner exists.
- The ask component itself can reuse the G-1 ask sheet chrome (warning
  register per Sam's earlier ruling on asks that guard a day).

## Copy, PROPOSED for signing (park §3)

| Where | String |
|---|---|
| Ask title | "Move team training?" |
| Ask body | "Is this a one-off, or has your club changed nights?" |
| Route: once | "Just this week — training's moved for the week of <date>" |
| Route: permanent | "Permanent — my team now trains <day>s" |
| Back | "Go back — leave it where it is" |
| One-off success | "Got it — team training is on <day> this week only." |
| Permanent success | "Got it — your team nights are updated and your program follows." |

Pattern notes: the route labels NAME the consequence (the G-1 ask copy
pattern Sam signed — a route says what the day keeps/becomes); the permanent
success claims regeneration because the setup owner really does regenerate.
No refusal copy is proposed — under the ruling the ask replaces the refusal,
and proposing copy for a refusal that shouldn't happen is the reversed-string
mistake from the G-1 unit, not repeated.

## Design choices parked for Sam

1. **Does SWAP on a team night raise the same ask?** The ruling names
   "movable/swappable"; the sheet proposes: Move raises the ask; Swap stays
   refused (a team night's content is the club's, not a session type to
   trade) — but that is a proposal, not the ruling's plain text.
2. **Where does the permanent route confirm?** Proposal: a one-line confirm
   inside the ask (no navigation to program setup) — the setup owner is the
   WRITER, not necessarily the SCREEN. Alternative: deep-link to setup.

## What the unit will gate on (L12, pre-committed)

Walker: a new `move_team_night` action through the real door; laws — the ask
appears on a team night exactly (never on a plain day), `this_week_only`
conserves every other day byte-for-byte and the fact undoes clean,
`permanent` updates the ONE owner and no shadow representation exists
(grep-gate on second writers of `teamTrainingDays`), and the vacated/landing
days obey the doubling law. Door matrix rows for both routes × occupied/empty
landing day.
