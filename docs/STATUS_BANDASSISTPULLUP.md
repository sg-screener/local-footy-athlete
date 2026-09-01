# Band-Assisted Pull-Up — 2 September 2026

Owner: `bandassistpullup`

## Boundary

Add Sam's supplied Band-Assisted Pull-Up through the existing vertical-pull,
equipment, band-load and Swap systems. It is automatic only as the Pull-Up
regression and manually available only when replacing Pull-Ups. Do not create a
new equipment answer, load unit, exercise role, Add route or stored dose.

## Design choice

Two options were checked:

1. Add eligibility checks independently to the automatic builder, Swap menu and
   final write door.
2. Give source-bound regressions one pure relation and eligibility owner, then
   make the existing automatic and manual routes consult it.

Option 2 is used. It prevents this exercise leaking into Add, Chin-Up swaps or
ineligible profiles, while leaving the Pull-Up slot responsible for role and
dose. Band strength/colour uses the existing band control. Support height uses
the existing session note, so no new screen or stored field is introduced.

## Red-first receipt

The focused exercise-intake run first reported eight failing assertion cells:
three missing eligible Swap offers, two ineligible write-time admissions, one
source leak, one missing equipment rule and one missing band-load control. The
instrument counted assertion cells across five distinct profile coordinates.

## Verification

- Focused exercise-intake: 825 passing assertion cells, 0 failing. The suite
  covers 14 earlier submitted identities plus this source-bound identity.
- Five real profile coordinates cover automatic selection, Pull-Up Swap, the
  final safety door and Add exclusion: complete-beginner male, complete-beginner
  female, 1–2-year female, 1–2-year male and 2–5-year female.
- The real strength compiler replaces a prescribed Pull-Up with the assisted
  identity for the three eligible coordinates and leaves Pull-Ups unchanged for
  the two ineligible coordinates. The canonical edit compiler preserves the
  outgoing role, section, sets, rep range and rest while clearing outgoing load.
- Four isolated mutations were killed: change the source exercise, remove the
  1–2-year female exception, weaken the equipment requirement, and remove the
  band load control. They produced 10, 3, 1 and 1 failing assertion cells
  respectively and were restored.
- Equipment vocabulary: 95/95. Bands, rack and pull-up bar were already present;
  no equipment question was added.
- Muscle/workbook equality: 97/97 over 212 distinct workbook rows. The new row
  is `Exercise Master!A219:H219`; everyone-regression now has 12 rows.
- Workbook inspection found 0 formula-error cells. Its one sheet was rendered
  before and after; the new wrapped row matches the existing table layout. The
  source workbook and requested output copy were both exported.
- Automatic weekly selection: 13/13. Quick exercise actions: 64/64.
- Product and developer-tool compilation each report 0 errors. The test-only
  compiler still reports the same seven unrelated errors in
  `sessionWorkOwnershipJourneyTests.ts`.
- Law registry structure and the new guarded row pass. Its overall result is
  13/14 because 21 of 257 older laws remain `UNENFORCED`; 236 are guarded.
- The authored-cue suite remains 54/56 on the existing Tib Raises and
  Copenhagen Plank (Half) load-authority gaps. The general strength-pool suite
  remains 479/483 on four unrelated squat-selection cells. The tap-Swap suite
  remains 25/26 on its unrelated hamstring fallback cell.

## NOT COVERED

- Independent clinical validation of Sam's supplied ratings and restrictions.
- Physical-iPhone acceptance or external video playback.
