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

## Sections 2–5

Pending.

## NOT COVERED

- Full annual generation or any annual PDF audit.
- Native phone build, install, wipe, or physical-device acceptance.
- Unrelated inherited test failures outside each numbered section's focused
  surface.
