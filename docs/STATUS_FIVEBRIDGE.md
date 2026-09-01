# Five connected fixes — fivebridge

Owner: `fivebridge`

Starting checkpoint: `cca002a0d0239d048f977e410bac9168da19b1fd`

Scope: the five numbered fixes Sam requested on 2026-09-02. This seat works in
the isolated `/private/tmp/lfa-five-connected-fixes` worktree so later unrelated
changes in the shared checkout are not rewritten.

## Baseline

- `test:movement-planes`: 10/10 green at the starting checkpoint.
- `test:conditioning-identity`: inherited red before this work: 10 failures
  (two authored-dose expectations and eight four-week generated-session
  expectations). These are recorded, not silently repaired as unrelated work.
- No annual PDF was generated.

## Section 1 — movement-plane metadata

Two options were considered:

1. Add the 11 values only to code and loosen workbook equality.
2. Keep the existing two-way code/workbook contract and add the values to both
   canonical representations.

Option 2 preserves the existing ownership model and makes either side drifting
red, so it was used.

Red-first receipt: after the expected map and explicit audit-identity guard were
added, `test:movement-planes` failed with `123 !== 134` and printed exactly the
11 missing identities.

Green receipt: `test:movement-planes` is 11/11 green. The workbook was rendered
after editing and its formula-error scan found 0 matches. The unanswered
question list fell from 92 identities to 81, exactly matching the workbook.

Mutation receipt: after checkpoint `c2f7eb78`, changing Explosive Landmine
Press from sagittal to frontal made both the exact typed-classification guard
and the workbook/code equality guard red. Restoring the row returned the suite
to 11/11 green.

## Section 2 — athletic transverse timing

Two options were considered:

1. Teach the annual audit to ignore particular weeks while leaving the
   scheduler's fortnightly calculation separate.
2. Put phase, 14-day window, typed credit and safety precedence in one pure
   rule, then have generation read its `automaticCodDue` answer and audit read
   its `missingRequiredExposure` answer.

Option 2 was used. It prevents the generator and audit from carrying different
definitions of the same target.

Red-first receipt: the two new phase/window/safety cells failed because the
shared rule did not exist. Green receipts:

- `test:movement-planes`: 13/13.
- `fortnightlyCodDoseTests`: 19/19; work-day and conditioning counts remain
  unchanged.
- `weeklySchedulerTests`: 128/128, Fresh Speed 14/14, persistence 2/2, COD
  19/19 and generated fixture ownership 11/11 before the broader command
  reached an inherited unrelated mutation failure in
  `generatedTravelZeroEquipmentTests` cell 7.
- `test:law-registry`: the edited R-327 row and guard wiring pass; the command
  remains inherited red because the starting checkpoint already carries 21
  unrelated `UNENFORCED` registry rows.

Mutation receipt: pending until the section implementation checkpoint is saved.

## Sections 3–5

Pending.

## NOT COVERED

- Full annual generation or any annual PDF audit.
- Native phone build, install, wipe, or physical-device acceptance.
- Unrelated inherited test failures outside each numbered section's focused
  surface.
