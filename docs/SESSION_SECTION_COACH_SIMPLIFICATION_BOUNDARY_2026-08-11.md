# SESSION SECTION + COACH SIMPLIFICATION — BOUNDARY — 2026-08-11

**LOOP CHECK: `same-session-meaning-with-multiple-visual-owners` — sighting 2;
compress. Mobility, Strength and Team Training looked like one checklist on the
review card but became three different disclosure systems inside the session.
The correction is one execution-section owner, not three matched styles.**

## What Sam ruled

- Mobility / Warm-up uses the same dropdown shape as Strength and Team Training.
- Accessories / Prehab lives inside Strength rather than in a separate dropdown.
- Expanded Team Training uses the same plain checklist-row language as Strength.
- The Program shape control says Day / Week and uses Renee's larger proportions.
- An empty Coach conversation shows only Sam's G'day greeting. It has no automatic
  schedule summary and no Move a session starter chip.

## Options compared before implementation

### Session structure

1. Keep the custom mobility component, Accessories section and Team Training
   card, then tune their borders, type and spacing until they look similar.
2. Merge Accessories / Prehab into Strength in the execution plan and let the
   same section component own disclosure for Mobility, Strength and Team
   Training. Keep only the row contents specialised.

Option 2 landed. It removes two disclosure owners and one section identity, so a
later style change cannot leave Mobility or Team Training behind again.

### Coach empty state

1. Keep the derived opener and starter chip in the screen but conditionally hide
   them in today's state.
2. Remove both initial-content representations from the live screen while
   retaining the typed question, proposal, confirmation and accepted mutation
   paths.

Option 2 landed. Typed session moves still work; the empty state simply stops
offering or narrating one before the athlete asks.

## What changed

- The execution plan now places accessory, midline and prehab rows inside the
  Strength disclosure.
- Mobility's component renders rows only. The common execution section owns its
  title, completion count, chevron and collapsed state.
- Team Training expands to one ordinary checked row, without the inset green
  information card or a second explanatory sentence.
- Program's internal `today` state is unchanged, but visible and accessibility
  copy now say Day. The segmented control is 280 points wide, each half keeps a
  44-point target, and labels use the accepted larger scale.
- Coach no longer imports or renders the automatic week opener and no longer
  defines the starter-chip copy. The grounded opener remains available to the
  answer rule when an athlete asks about the week.

## First-run findings

- Three checklist cells and four mobility cells failed because they still
  required the superseded separate Accessories section and mobility-owned
  chevron. They now guard the shared ownership boundary.
- Four Coach cells failed because they still required the second automatic
  bubble. They now require one greeting and the absence of both retired initial
  affordances.
- The broader session UI suite could not run because it still opened a deleted
  Power Primer component. Its stale dead-component assertions were replaced by
  source cells over the live ordinary-row owner; all 25 cells then passed.
- The compile gate found one removed import still needed by a surviving movement
  row style. Restoring that theme-token import cleared the new error and reduced
  the product baseline total by one.
- The repo process guard found the immediately preceding mobility boundary had
  placed its loop check near the end rather than at the required opening. That
  report was corrected before this boundary was written.

## What catches the next defect of this class

- The checklist guard proves no Accessories section is produced, Mobility is
  wrapped by the common execution section, and Team Training has no accent-card
  branch.
- The mobility guard proves the row component owns no state or chevron and that
  the screen's common section wraps it above the session list.
- The Program guard pins Day / Week in both visible and accessibility copy plus
  the control width, hit-target height and label size.
- The Coach guard requires the greeting, forbids the automatic opener and chip,
  while the mutation guard still proves typed moves reach the accepted door.
- Persistence, copy binding, app-wide typography and compile gates ran beside
  those boundary checks.

## Verification result

The named session, mobility, Program, Coach, persistence, copy, typography,
session-UI and compile surfaces are green. The law registry remains at its known
global red: 93 registered laws, 61 guarded and 32 unguarded. This pass added one
guarded law and added no unguarded debt.

## NOT COVERED

- Sam's physical iPhone; athlete-facing acceptance remains open until he rebuilds
  and checks these exact screens.
- A fresh simulator screenshot comparison against Renee's prototype.
- VoiceOver traversal through the expanded live-session checklist.
- Dynamic Type at accessibility sizes on the widened Day / Week control.
- The frozen legacy Coach screen, which is not routed by this Coach tab.
