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
- A full-kit census currently withholds nine curated cues. Skull Crushers on a
  dumbbell selection is the one intentional absence: Sam ruled that the
  existing authored cue is the barbell variant and no replacement copy may be
  invented.

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

- Focused cue/equipment census: 21 passed, 0 failed. On a full kit, the only
  curated cue still withheld is the explicitly unresolved dumbbell Skull
  Crushers variant.
- Liveness: restoring Crab Walks to bodyweight failed three cue cells; bypassing
  the apparatus check failed four no-bench cells; removing rings/TRX and trap
  bar failed three setup cells. Each mutation was restored and the suite
  returned to 21/21.
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

## NOT COVERED

- Physical iPhone Release acceptance remains Sam's final check.
- No replacement cue was authored for dumbbell Skull Crushers.
- The full Bible and several older coach-era suites remain red before this
  change; their unrelated failures were not folded into item 1.
