# Weight-control seat

Owner: `weightcontrol`

## Current issue

On the installed iPhone 16 Pro Max Release build, the Estimated 1RM questions
appear before the ordinary feedback, duplicate session-owned load and reps, add
unrequested fields, and do not match the established popup.

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

---

## Issue 2 — conditioning checkbox is one column inboard

On the installed iPhone Release build, Short Flush draws its completion box in
the title row immediately before swap/remove. Every ordinary exercise instead
keeps swap/remove in the title corner and completion on its own lower control
line at the card's right edge.

### Cause and options

The first conditioning-checkbox fix correctly reused the checklist's existing
completion item, but deliberately mounted it in each conditioning renderer's
header because conditioning has no weight stepper. That made it a third header
action and forced it left of swap/remove.

1. Add a margin or absolute offset to the two existing header mounts. This
   would keep completion competing with the title actions and duplicate the
   correction across choice and phase cards.
2. Keep the one checklist-owned checkbox and give both conditioning renderers
   one shared trailing completion row, in normal layout flow and aligned to the
   card's right content edge.

Option 2 removes the conflicting ownership without changing completion state,
selection, logging, swap/remove, or accepted-state persistence.

### Baseline

- Physical screenshot: Short Flush tick is visibly left of the checkbox column.
- Source: both `ConditioningChoiceRow` and `ConditioningPhaseRow` mount the tick
  in their title header through `addonCheckboxSlot`.
- `test:session-execution` — 203 passed, 0 failed.
- `test:session-logging-ui` chain — 46 passed, 0 failed.
- `test:session-template` — inherited 84 passed, 1 obsolete source-shape failure
  (`the numeric index is back in the row header`).

### Fix and coverage

- `ConditioningChoiceRow` and `ConditioningPhaseRow` now hand the existing
  checklist-owned tick to one shared trailing row. The row is normal layout
  flow, owns the card's right content edge and does not use a route-specific
  horizontal offset.
- The single-option Short Flush state and collapsed/expanded multi-option
  choice states all use the same choice renderer. Standalone conditioning
  phases use the same placement owner. Read-only state still comes from the
  unchanged checklist checkbox passed into that owner.
- `test:session-execution` — 206 passed, 0 failed.
- Liveness mutation: changing the placement owner's `justifyContent` from
  `flex-end` to `center` made `[10] the conditioning tick owns the same
  card-right edge without an independent offset` fail (205 passed, 1 failed).
  The mutation was removed and the suite returned to 206/206.
- `test:conditioning-templates` — 152 passed, 0 failed.
- `test:session-logging-ui` chain — 46 passed, 0 failed.
- `test:session-template` remains at 84 passed, 1 inherited obsolete
  source-shape failure (`the numeric index is back in the row header`).
- `test:compile` reports 0 product errors and 0 devtool errors. Its overall
  result remains red on the exact checkpoint's three test-harness type errors
  in `canonicalWeeklyCompilerSliceTests.ts` and `fatiguePlumbingTests.ts`.
- `test:accessibility-contracts` remains at its inherited 41 passed, 6 failed
  source-shape boundary. No checkbox accessibility label, state or tap target
  changed here.
- `test:results-persist` reaches one control and refuses five old fixture
  actions because those fixtures lack an accepted profile/program. That
  diagnostic failure predates this layout-only change and was not treated as
  a product requirement.
- `test:repo-law-guards` remains at the shared-checkout boundary of 51 passed,
  12 failed. The named failures are existing report/inbox/flow/store/anchor
  debt; this change adds no positional source anchor and does not touch the
  inbox or those owners.

### Not covered yet

- Post-fix simulator conditioning glass: the preserved simulator athlete's
  reachable current week contains no conditioning session, and no state was
  reset or replaced to manufacture one.
- Fixed Release build on Sam's physical iPhone.
- Physical Dynamic Type and VoiceOver sweep; no accessibility ownership or
  typography was changed by this placement fix.

---

## Issue 3 — Estimated 1RM feedback duplicated session data

The physical Release form put tracked-lift questions before the ordinary
feedback, then asked the athlete to re-enter load and reps and added an
unrequested setup/technique field, Skip action, summary and caveat. Its bespoke
form hierarchy also looked unlike the established popup.

### Cause and options

The first implementation treated missing per-set logging as permission to add a
second data-entry form. But this session already has the accepted values Sam
named: checking the exercise identifies it as completed, the weight control
owns its load, and `displayReps` owns the one rep target the athlete sees.

1. Pre-fill the existing fields and leave them editable. This would reduce
   typing while retaining the duplicate owner and every unwanted surface.
2. Derive the pair from the checked session row and reduce every tracked lift
   to its name, the one RIR question and the shared 0–5+ picker, after minutes.

Option 2 landed. It extends the existing session-value and prescription-display
owners rather than adding a Back-Squat-only path.

### Coverage

- A checked row supplies its current date-specific weight override, falling
  back to the row's prescribed load, and the same canonical rep target shown in
  the session. A 3 × 3 row therefore supplies 3 reps; a Pull-Up displaying BW
  supplies zero added kilograms plus the recorded session bodyweight. Per-set
  logs cannot make an unticked row appear in the questions or replace that
  session-owned pair.
- All selected tracked lifts use the same minimal component. It contains only
  the lift name, **How many more clean reps could you have done on your last
  set?**, and the existing unanswered 0–5+ picker.
- The questions render after `strength-feedback-minutes`. Both text lines use
  the popup's shared `bodySmallEmphasis` typography; the picker is the same
  `DiscreteSlider` owner used by the established effort control.
- New feedback has no editable load/reps/bodyweight, setup/technique, Skip,
  summary, separate readout or repeated approximation caveat.
- Setup no longer gates Lat Pulldown or splits a new-method chart into multiple
  histories. The optional legacy field remains accepted on old stored records
  so existing athlete data is preserved, but it is ignored.
- Test-first proof: the new contract was red against the installed-checkpoint
  implementation — 158 passed / 17 failed in `test:estimated-1rm`, and 50
  passed / 4 failed in `test:effort-scale`.
- Fixed source: `test:estimated-1rm` — 175 passed, 0 failed, including Progress,
  workout-log wiring and the effort-scale chain.
- `test:effort-scale` — 54 passed, 0 failed.
- Liveness mutation: re-enabling the picker's separate readout changed that
  suite to 53 passed / 1 failed at **the minimal picker starts empty without
  adding a separate readout line**. Restoring `showReadout={false}` returned it
  to 54/54.
- `test:session-logging-ui` chain — 46 passed, 0 failed.
- Preservation matrix: `test:session-execution` — 206 passed, 0 failed;
  `test:undo-reversal` — 28 passed, 0 failed; `test:modifier-lifecycle` — 241
  lifecycle journeys plus its three companion suites green;
  `test:injury-recomposition` — 186 passed, 0 failed.
- `test:compile` reports 0 product errors and 0 devtool errors. Its overall
  result remains red on the exact checkpoint's three inherited test-harness
  type errors in `canonicalWeeklyCompilerSliceTests.ts` and
  `fatiguePlumbingTests.ts`.
- `test:session-equipment-owner` refused its old hand-built onboarding fixture
  before reaching equipment because gender and season-finish answers are
  missing. The maintained session-execution equipment cells remained green;
  the obsolete fixture was not treated as a product requirement.
- `test:law-registry` remains at its inherited 13 passed / 1 failed boundary:
  21 of 217 registry rows are `UNENFORCED` and 196 are guarded.
- `test:repo-law-guards` remains at its inherited 51 passed / 12 failed
  shared-checkout boundary. None of the named report, inbox, flow, store or
  source-anchor failures is introduced by these scoped files.
- Preserved-data iPhone 17 Pro simulator: opened today's actual Strength +
  Mobility session, selected its real checklist, and opened feedback without
  saving. The visible order is minutes, Back Squat question/picker, then RDL
  question/picker. Visual inspection and the accessibility tree found the two
  exact questions and found none of the retired weight, rep, setup, Skip,
  summary or approximation strings. No feedback outcome was published.

### Not covered yet

- Saving and reopening this simulator feedback outcome; the glass pass stopped
  before Save to preserve the athlete's existing session data.
- Fixed Release build on Sam's physical iPhone.
- Physical Dynamic Type and VoiceOver order.
- Individual predictive accuracy of the underlying Estimated 1RM method; this
  change is input ownership and presentation, not a new calculation formula.
