# Weight-control seat

Owner: `weightcontrol`

## Current issue

On the installed iPhone 16 Pro Max Release build at `6fee60e2`, tapping RDLs
from 90 kg to 92.5 kg left the value correct but rendered it at an almost
invisible size.

## Evidence before the fix

- The phone screenshot shows the outer stepper unchanged and the correct
  `92.5kg` value drawn at roughly the native minimum size.
- Acting through the existing iPhone 17 Pro simulator state reached the same
  RDL control and changed 80 -> 82.5 -> 92.5 kg. The Debug simulator kept the
  label readable, so the exact visual failure is not reproduced there.
- Every editable load label in `StrengthExerciseCard` enables native
  `adjustsFontSizeToFit` with `minimumFontScale={0.75}`.
- React Native 0.81's iOS Fabric layout path records `minimumFontScale`, but
  the fitter reads `minimumFontSize` and otherwise falls back to 4 points.

## Options compared

1. Special-case RDLs or remount their text after each increment. This would
   mask one observed row while leaving the same native sizing path on every
   other exercise and state.
2. Keep the shared fixed-width control and remove native auto-shrinking from
   all of its live labels. The legal values already fit at the authored type
   size, and this removes the Release-only failure path without changing load
   authority, persistence, buttons, editing, or accepted-state transactions.

Option 2 is the smaller systemic fix.

## Coverage

- Baseline: `test:session-execution` — 201 passed, 0 failed.
- Fixed source: `test:session-execution` — 203 passed, 0 failed.
- Liveness mutation: restoring `adjustsFontSizeToFit` on the bodyweight branch
  made `[10] live load labels keep the authored readable size after a stepper
  update` fail (202 passed, 1 failed). The mutation was then removed.
- Simulator: existing data preserved; RDL 92.5 kg and Bulgarian Split Squats
  27.5 kg remained readable after normal `+` actions.
- Fixed simulator glass: RDL was acted 92.5 -> 90 -> 92.5 kg through the
  visible `-` / `+` controls; both accessibility-value assertions passed and
  the final 92.5 kg label remained at the authored readable size. The shared
  BW and Medium band states were also visible and readable after Fast Refresh.
- `test:render-truth` — 29 passed, 0 failed.
- `test:training-logging` — 14 passed, 0 failed.
- `test:undo-reversal` — 28 passed, 0 failed.
- `test:modifier-lifecycle` chain — green, including 241 lifecycle journeys.
- `test:compile` reports 0 product errors and 0 devtool errors. Its overall
  result is red on three test-harness type errors already present in the exact
  `6fee60e2` checkpoint (`canonicalWeeklyCompilerSliceTests.ts` and
  `fatiguePlumbingTests.ts`), outside this change.
- `test:session-execution-checklist` reaches the new 203/203 session cells,
  then remains red on three current-checkpoint Mobility source-shape checks
  that look for the retired pre-`SessionExecutionSection` JSX arrangement.
  The executing shared section and simulator glass are present; these obsolete
  diagnostics were not treated as product requirements or rewritten here.
- `test:repo-law-guards` remains at its current shared-checkout debt boundary
  (51 passed, 12 failed). None of its named failures is in this three-file
  change; the session test's pre-existing anchor count is among the reported
  debt and the new guard adds no position lookup.

## Not covered yet

- Fixed Release build on Sam's physical iPhone.
- Physical Dynamic Type and VoiceOver sweep; spoken value ownership is not
  being changed by this fix.
- Full `test:bible`; the focused product/compiler, persistence, Undo,
  modifier, equipment and render checks above were used for this render-only
  change.
