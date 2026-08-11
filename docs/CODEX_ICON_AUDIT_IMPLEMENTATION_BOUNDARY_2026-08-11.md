LOOP CHECK: one meaning with multiple local icon drawings — sighting 3 — compress

# CODEX ICON AUDIT IMPLEMENTATION BOUNDARY — 2026-08-11

## What Sam ordered

Implement the icon audit decisions after the traced equipment and torso icons
were approved. Sam explicitly overrode the active law-registry stop line for
this icon unit only.

## Options compared before implementation

1. Replace each SVG path where it happened to appear and keep the screen-local
   icon sets.
2. Add one icon owner for the approved meanings and traces, then make every
   affected screen request its icon from that owner.

Option 2 landed. The existing equipment lookup remains the equipment vocabulary
owner, but it now delegates pictures to the shared icon owner. Profile, this
week's equipment and per-session equipment therefore continue to use exactly
the same lookup rather than gaining another icon set.

## What changed

- Sick now uses a sick face in the quick action and illness sheet.
- Injury now uses a medical-cross icon in the quick action and workout door.
- Mobility uses a stretching person on Program and both editing surfaces.
- Prehab / accessories uses the medical shield on both editing surfaces and
  the Program row.
- Mild illness no longer looks like hydration, totally cooked uses a low
  battery, and severe illness no longer uses the generic bed.
- Move is a plain right arrow; Gun show is a literal flexed arm; future weeks
  uses the library calendar-sync symbol.
- Dumbbells and kettlebell reuse the app's library glyphs.
- Cable machine now uses the previously approved upright selector/cable-station
  drawing. Weight machines uses Sam's later seated plate-loaded trace. Bench,
  pull-up bar, foam roller, bike erg, air bike, row erg, ski erg and treadmill
  use the other approved audit drawings. The rejected hanging-pulley drawing
  is not present.
- Injury regions use an injured upper-body figure, legs and a curved spine.
- Add exercise uses the flexed arm, legs, approved torso / abs trace, medical
  shield and stretching person.
- No equipment is a plain prohibited sign. Don't like it is a recognisable
  hand giving thumbs down.
- The In-season choice now uses Sam's thinner traced Australian-rules ball
  from the shared icon owner. The older screen-local ball drawing is retired.

## First-run findings

- The icon ownership cell initially failed all ten checks before the owner and
  wiring existed, then failed only the foam-roller construction check because
  React Native expresses the SVG rotation as properties rather than an SVG
  transform string. The check was corrected to read the representation the app
  actually renders; the roller geometry did not change.
- The plan-change producer suite ran 296 cells: 228 passed and 68 failed. The
  failures name programming and registry behaviour outside the icon-only diff.
  Whether all 68 predate this unit was not re-measured against a separate clean
  checkout, so that is OPEN-UNKNOWN.
- The accessibility wrapper suite ran 38 cells: 33 passed and 5 failed. The
  failures name expanded-day grouping and equipment semantic identifiers,
  neither of which was edited here. Whether all five predate this unit was not
  re-measured against a separate clean checkout, so that is OPEN-UNKNOWN.
- The first plain simulator launch reached the existing spoken development
  refusal because a prior harness clock receipt had no active checkpoint. The
  refusal offered its established clear-state door; the subsequent deterministic
  reset cleared that simulator-only state and reached Program normally.

## Receipts

- Approved icon ownership: 11 named cells run, 11 passed. Eight traced machine
  / torso paths are fingerprinted byte-for-byte, and the supplied foam roller's
  rotated hollow/ribbed construction is pinned separately.
- Weekly readiness: 30 cells run, 30 passed.
- Guided injury totality: 25 cells run, 25 passed.
- Equipment vocabulary: 63 cells run, 63 passed.
- Equipment answer ownership: 38 cells run, 38 passed.
- Exercise-edit entry surface: 35 cells run, 35 passed.
- Repository process guards: 34 cells run, 34 passed.
- Typecheck baseline: 35 product, 51 development-tool and 373 test diagnostics,
  459 total against the baseline; no file regressed.
- The iOS simulator bundle rebuilt successfully with zero build errors. The
  Profile -> setup change -> equipment flow then completed and photographed
  both halves of the equipment sheet. Visual inspection found all approved
  equipment traces contained within their circles with no clipping, and the
  rejected pulley drawing absent.
- After the later cable / weight-machine split, approved icon ownership again
  ran 11 cells with 11 passed, equipment vocabulary ran 63 cells with 63
  passed, and the compile baseline remained at 459 diagnostics with no file
  regression. The Profile equipment flow completed again; visual inspection
  confirmed the upright station at Cable machine and the seated plate-loaded
  trace at Weight machines.
- After the thinner footy trace entered the In-season choice, approved icon
  ownership ran 12 cells with 12 passed and the compile baseline remained at
  459 diagnostics with no file regression. The guard compares every path in
  the supplied SVG with the shared app owner and proves the retired local
  drawing no longer exists on that screen.
- The approved icon test is in the mandatory chain before the law-registry gate.
  The chain remains deliberately red because 32 unrelated registry rows remain
  unguarded; Sam explicitly overrode that stop for this unit.

## What catches the next defect of this class

The icon ownership cell fails if an affected surface stops requesting the
shared icon, if a supplied trace changes by one byte, if the roller loses its
approved construction, or if the rejected local drawings return. Because that
cell is in the mandatory chain, a later local redraw cannot pass unnoticed.

## North Star

Neutral for stored product state. Toward one-owner architecture: repeated
visual meanings now derive from one icon owner rather than being stored as
screen-local drawings.

## NOT COVERED

- Readiness, Plan change, Injury and Add exercise were source-pinned but were
  not separately photographed in the rebuilt simulator during this unit.
- The new In-season footy trace was source-pinned but was not separately
  photographed in the rebuilt simulator during this unit.
- Sam's physical iPhone has not shown the new icons. Athlete-facing acceptance
  therefore remains open.
- Icons outside the audit decision list were not redesigned.
- Android rendering was not exercised.
