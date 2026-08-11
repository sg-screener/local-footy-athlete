LOOP CHECK: seven equal choices leave an orphaned final row — sighting 1 — iterate

# PHASE SHIFT DAY GRID BOUNDARY — 2026-08-12

## What Sam ordered

The seven day buttons shown while shifting season phase must not render as six
buttons followed by one orphaned button. They should render as four on the first
row and three on the second.

## Reachability proved before editing

The Program tab mounts the V2 Home screen. Its season-phase shift sheet renders
the availability, team-training and usual-game-day questions, and all three use
the same day-chip grid and style. No control was removed.

## Options compared before implementation

1. Split each seven-day array after the fourth item and maintain separate row
   wrappers in all three questions.
2. Give the shared day-chip style a four-column basis and retain the existing
   centred wrapping grid.

Option 2 landed. It makes every seven-day question 4 + 3 through one layout
owner and leaves the day rendering, selection and accessibility behavior
unchanged.

## First-run finding

The guard ran before implementation. All 170 existing checks passed and the new
geometry cell failed on the prior minimum-width-only style, which allowed six
buttons on the first row and stranded the seventh.

## What changed

- Each phase-shift day button now occupies 22% of the shared row width.
- The centred wrapped grid therefore fits at most four equal buttons per row and
  centres the remaining three.
- Availability, team-training days and usual game day inherit the same fix.
- A guarded registry row records the 4 + 3 layout ruling.

## Receipts

- Phase/Profile UI guard: 171 named checks run, 171 passed.

## What catches the next defect of this class

The guard proves the V2 screen is live, locates the complete phase-sheet region,
proves all three questions consume the shared grid and day-chip style, and pins
the centred wrap plus four-column basis. A local fix on only one question cannot
satisfy it.

## North Star

Neutral. This is presentation-only; no program fact, phase decision or mutation
path changed. One shared style continues to own all three equivalent layouts.

## NOT COVERED

- Sam's physical iPhone. The exact visual balance remains awaiting his device
  check.
- Very narrow accessibility display modes where the existing 58-point minimum
  may require fewer than four buttons on a row.
- Onboarding's separate day grid, which is not the season-phase shift surface
  Sam reported.
