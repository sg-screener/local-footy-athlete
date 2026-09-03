# Rear-shoulder warm-up choices — 3 September 2026

Owner: `warmuprear`.

Starting point: `0d050932` on isolated branch
`codex/warmup-rear-shoulder-20260903`. This branch stacks cleanly after the
yellow-accent commit and never touches Claude's running candidate checkout.

## What Sam ruled

`Incline Y Raise`, `Face Pull`, `Cable Face Pull`, `Rear Delt Fly` and
`Band Pull-Apart` can all be selected in the warm-up. `Face Pull` and
`Cable Face Pull` must not appear together on the same day.

## Options compared

1. Move the five exercises into the Shoulder health catalogue pool. This would
   alter their existing Arms/shoulders ownership and could change Add, Gunshow
   and other pool-based behavior.
2. Give the existing shoulder-prehab warm-up slot one explicit extra-eligibility
   list, then record the two Face Pull names in the app's existing typed
   variation-family owner.

Option 2 landed. It adds one warm-up permission without reclassifying the
exercises, and the shared family rule prevents the pair in warm-up, generated
main work, Add and Swap instead of teaching only one selector a special case.

## Red first

The new focused guard began 2/8 green and 6 red:

- none of the five reached the real shoulder-prehab candidate door;
- none appeared across 730 dated upper warm-ups;
- the two Face Pull names had no shared variation identity;
- the apparent main/warm-up exclusion was vacuous because the blocked sibling
  could not appear in the control warm-up;
- the band-only athlete could not receive Band Pull-Apart from this slot.

The existing catalogue-ownership cell and mutation harness were the two green
controls.

## What changed

- The shoulder-prehab slot now names the five as extra eligible exercises.
- Normal equipment, injury, experience and game-distance checks remain in the
  candidate path.
- `Face Pull` and `Cable Face Pull` are one typed variation family.
- Exact and family collisions are checked against main work, earlier warm-up
  picks, performed warm-up retention and the published selection trace.
- Performed work stays; a freshly redrawn sibling is the row that gives way.
- Their existing catalogue pools and Arms/shoulders availability are unchanged.

## Verification

- `test:warmup-rear-shoulder`: 9/9 green.
- The date sweep observes every one of the five in a real upper warm-up.
- Both Face Pull directions are exercised with the other version in main work.
- Band-only sees only Band Pull-Apart from the five; bodyweight-only sees none.
- Mutation: emptying the extra eligibility list makes the guard exit red for
  the correct list, candidate and actual-selection cells.
- `npx tsc --noEmit`: green.
- `test:quick-exercise-actions`: 64/64 green.
- `test:muscle-experience`: 97/97 green.
- Direct exercise-intake catalogue sweep: 929/929 green across 15 distinct
  submitted exercises.
- `test:upper-split-composition`: 29/29 green. Its chained Composer B1 keeps
  the candidate's unrelated 4 red.
- `test:mobility-flow`: all 75 programming/retention cells retain their result;
  its 3 existing UI source-shape cells remain red.
- Existing registry debt is unchanged: ruling registry 3 red and law registry
  1 red. The totals-or-red census also retains its 3 repo-wide historical reds.

## NOT COVERED

- Simulator and physical-iPhone pixels; Claude owns the active simulator and
  Metro session.
- The combined candidate after Claude's current Maestro updates.
- A full annual cohort or full `test:bible`; the existing candidate release
  reds remain outside this change.
