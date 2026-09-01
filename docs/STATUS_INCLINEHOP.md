# Incline Push-Up and Single-Leg Hop and Stick — 2 September 2026

Owner: `inclinehop`

## Boundary

Add Sam's supplied Incline Push-Up as a source-bound Push-ups regression and
Single-Leg Hop and Stick as an ordinary lower-body Power option. Do not add an
equipment answer, load unit, screen, exercise role or second power selector.

## Design choice

Two options were checked:

1. Add exercise-specific branches to automatic programming and manual menus.
2. Extend the existing source-bound regression table and existing typed Power pool.

Option 2 is used. The source-bound table keeps the Incline Push-Up tied to the
Push-ups slot, while the Power pool already owns phase, experience, equipment,
rotation and automatic selection. The existing session note records Incline
Push-Up support height. Single-Leg Hop and Stick uses the curated prescription
field already read by automatic power rows and manual Add/Swap.

## Verification

- Red-first focused intake: 57 failing assertion cells. Fifty-five were genuine
  missing-contract cells for the two new exercises; two exposed a test-array
  insertion mistake that temporarily misaligned existing Sleeper Stretch and
  Foam Roller Thoracic Extension expectations. That harness error was corrected
  before production implementation.
- Focused exercise intake including all isolated mutations: 913 passing
  assertion cells, 0 failing, over 15 distinct submitted exercises. Eight new
  mutations were killed: Incline source, eligibility, equipment and load mode;
  hop experience, in-season eligibility, dose and load mode.
- Incline Push-Up is checked across five profile coordinates for automatic
  identity selection, Push-ups-only Swap, write-time enforcement and Add
  exclusion. The real strength compiler exercises the available beginner
  source slots; the pure automatic identity owner covers the authorised
  1–2-year female exception even where the sampled female session shape does
  not contain a Push-ups accessory slot.
- Single-Leg Hop and Stick is reached by the real lower-power selector in-season
  for a 2–5-year athlete, keeps its lower-power role through manual Add/Swap and
  is refused to both complete beginners and 1–2-year athletes.
- Power pool: 104/104. Equipment vocabulary: 95/95. Muscle/workbook equality:
  97/97 over 214 distinct workbook rows. The new rows are `Exercise Master`
  rows 220 and 221; everyone-regression is 13 rows and 2+ years is 18 rows.
- Automatic weekly selection: 13/13. Quick exercise actions: 64/64.
- Product and developer-tool compilation each report 0 errors. Test-only
  compilation retains seven unrelated errors in
  `sessionWorkOwnershipJourneyTests.ts`.
- Workbook inspection found 0 formula-error cells. Its one sheet was rendered
  before and after; both new wrapped rows match the established table layout.
- Law registry structure and both new guarded rows pass. Its overall result is
  13/14 because 21 of 259 older laws remain `UNENFORCED`; 238 are guarded.
- Existing unrelated reds remain unchanged: authored cues 54/56 (Tib Raises
  and Copenhagen Plank (Half) load handling), strength pools 482/486 (four
  squat-selection cells), and tap Swap 25/26 (hamstring fallback).

## NOT COVERED

- Independent clinical validation of Sam's supplied ratings and restrictions.
- Physical-iPhone acceptance or external video playback.
