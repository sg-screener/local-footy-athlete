# STATUS — seat `cuefix`

Opened 2026-08-26 for Sam's audit item 1 only: some exercise cards randomly
omit Form cues.

## Baseline

- The row intentionally suppresses an authored cue when its equipment does not
  match the exercise's resolved implement.
- The suppression rule is sound; the inputs disagree. Crab Walks and Side
  Plank Row are band movements in the exercise pool and in their authored cue,
  while the canonical equipment sheet says bodyweight or has no answer.
- Rings/TRX and trap bar are canonical requirements but the selected-implement
  owner does not recognise them as performing implements.
- Four bench-supported cues are filed as if the bench were the implement. That
  suppresses them even when the athlete has a bench, despite the existing
  ruling saying they should render in that case.
- A full-kit census initially withheld nine curated cues. Eight were setup
  disagreements; the ninth was the generic Skull Crushers row selecting
  dumbbells while its cue named a straight/EZ bar.

## Scope fence

Item 1 only. No coach-chat rebuild, programming, scheduling, conditioning,
or authored cue wording is touched. The only dose-field change is the directly
reported Add-menu bug: absent rest stays absent instead of becoming 90 seconds.

## Landed

- The session now gives the cue resolver the same effective dated kit used to
  resolve the row's implement.
- Crab Walks and Side Plank Row use the band requirement already recorded by
  the current equipment census and their pools.
- Rings/TRX and trap bar are recognised as performing implements.
- Bench-dependent cue wording has a typed apparatus requirement, separate from
  the movement's bodyweight implement.
- The affected-row explanation has no nested left margin and shares the name,
  dose and Form-cues edge.
- An athlete-added row with no rest prescription now stores zero instead of an
  invented 90-second rest period.

## Receipts

- Focused cue/equipment census 23/23: every curated cue reaches the control on
  a full kit. Skull Crushers is the bar/EZ-bar variation under the name Sam
  chose; Dumbbell Skull Crusher remains the separate dumbbell variation. The
  pool, requirement, selected implement, load map and authored load workbook
  all give that same answer. The ruling is recorded in the guarded law registry,
  rather than surviving only in comments.
- Liveness: restoring Crab Walks to bodyweight failed three cue cells; bypassing
  the apparatus check failed four no-bench cells; removing rings/TRX and trap
  bar failed three setup cells. Each mutation was restored and the suite
  returned to 21/21.
- Skull Crushers liveness: restoring its load map to dumbbell failed the named
  cross-source agreement cell; restoring barbell returned the focused suite to
  23/23.
- Alignment liveness: restoring the 44px notice margin failed the named row-grid
  cell; removing it returned that cell green. The surrounding checklist suite
  remains at its pre-existing 195/200 state.
- Simulator: the standard seed rendered the swapped-from line on the same left
  edge as Hamstring Curl, its dose and Form cues.
- Simulator: Add Strength → Lower body → Accessories → Crab Walks rendered and
  expanded the exact authored cue. A new negative assertion first failed on the
  invented `1:30 rest`; after the writer fix the same flow passed with no rest
  line.
- Equipment vocabulary 89/89, cue join 6/6 and render truth 29/29 passed. The
  Maestro element scan names only its existing stale-flow set; neither new flow
  contributes an unknown product id.
- Load-ratio/workbook agreement passed 47/47 after the same barbell answer was
  written into the ruled workbook. The workbook was rendered before and after;
  its five sheets retain their existing layout and only that one value changed.
- The visible-surface suite's four Skull Crushers cells pass. Its overall
  69/81 result retains the same 12 unrelated failures. The law-registry gate
  accepts the new row and remains red only on its three existing registry debts.

## NOT COVERED

- Physical iPhone Release acceptance remains Sam's final check.
- The full Bible and several older coach-era suites remain red before this
  change; their unrelated failures were not folded into item 1.
