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

Mutation receipt: after checkpoint `81e1e38e`, restoring the old weekly-style
behaviour by removing the complete-14-day-window gate made the phase/window cell
red (12/13). Restoring the gate returned 13/13 green.

## Section 3 — standalone flush presentation

Two options were considered:

1. Patch the Recovery renderer or special-case Bike Flush Intervals 2:1.
2. Let an exercise row's typed conditioning-block ownership choose the existing
   canonical conditioning presentation, regardless of the surrounding session
   label.

Option 2 was used. It fixes every standalone flush through the same final
composer used by ordinary conditioning and leaves ordinary Recovery exercises
alone.

Red-first receipt: the exact Bike 2:1 row already retained its template,
modality, work/recovery, amount, effort and cue internally, but the final item
said `presentation: recovery`; its final-card and restart cells failed.

Green receipt: `test:standalone-flush-presentation` is 4/4. The real
flush-restart journey now compares the complete conditioning card before and
after relaunch, not only its title and modality. The wider session-template
suite is 87/88: its one numeric-index source-shape failure is inherited and
unrelated to this work.

Mutation receipt: after checkpoint `8fb37118`, disabling typed
conditioning-block ownership made all three conditioning-card cells red while
the ordinary-Recovery control stayed green (1/4). Restoring the owner returned
the focused suite to 4/4.

## Section 4 — one weekly selector everywhere

Two options were considered:

1. Add duplicate filters inside Gunshow, Primer and Power or clean the finished
   week after composition.
2. Carry the existing canonical weekly selector through every automatic gym
   composer and persist typed automatic authorship for rebuilds.

Option 2 was used. Normal strength selects first; its real delivered identities
seed the shared history. Power, Gunshow, Primer and optional automatic sessions
then use their existing role-specific candidate order, skipping spent identities
and leaving an exhausted seat empty. Mobility and Prehab remain exempt.
Athlete-added rows never receive the automatic marker and remain unrestricted.

Red-first receipt: the 50-world focused boundary was 13/15. Male one-game weeks
repeated `Dumbbell Kickback` between an upper session and Gunshow in all four
weeks (plus `Face Pull` in week 4). Female one-game weeks repeated
`Rotational Medicine-Ball Slam` and `Box Jumps` between ordinary power and
Primer in all four weeks.

Green receipts:

- `test:automatic-weekly-selection`: 16/16, including zero exact repeats over
  50 real generated worlds × four weeks, the two named failures, unrestricted
  athlete additions, and identical automatic history after restart.
- `test:power-pool`: 104/104; `test:primer-session`: 25/25;
  `test:optional-topup`: 30/30.
- `test:fixture-mutation-transaction`: the new move, restore and restart
  repeat checks all passed in cell 9. The wider suite remains inherited red at
  17/20 on its three Practice Match onboarding cells.
- `test:injury-recomposition`: all synchronous injury selection/recomposition
  cells passed before its inherited real-onboarding journey refused the week
  for `required_minimum_shortfall:main_strength:2`.
- Product and dev-tool typechecking remain at 0 errors. The test-only typecheck
  remains inherited red with seven `SessionTemplateItem.row` errors in
  `sessionWorkOwnershipJourneyTests.ts`.
- `test:pools` remains inherited red at 482/486 on four existing rotation/pin
  expectations; no pool selection policy was changed by this section.

Mutation receipt: after checkpoint `da0759b7`, disconnecting the shared
selector from the optional-session adapter first survived because the repeat
counter could no longer see rows whose automatic marker had disappeared. The
guard was strengthened to prove typed automatic authorship before counting.
The same mutation then made the Gunshow and Primer authorship cells red
(14/16); restoring the selector returned the focused boundary to 16/16.

## Section 5

Pending.

## NOT COVERED

- Full annual generation or any annual PDF audit.
- Native phone build, install, wipe, or physical-device acceptance.
- Unrelated inherited test failures outside each numbered section's focused
  surface.
