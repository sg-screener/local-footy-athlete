# STATUS — seat `completion`

Opened 2026-08-24 for Sam's approved audit item 1: reopening a recorded
programmed session must restore the exact saved checklist results. This is one
completion-state repair for every execution section, not a Mobility-only patch.

## Baseline

`npm run test:session-execution` prints 185 green / 6 red at the untouched
checkpoint. The six existing reds are source-shape assertions unrelated to
saved checklist hydration. They are the control for this task: no additional
red may be introduced.

## Acceptance

- Exact saved `executionItems` repopulate the live checklist by stable item id.
- Partial completion stays partial; unchecked items stay unchecked.
- Saved ids no longer present in the current plan are ignored.
- A legacy whole-session `full` record restores prescribed items only; it does
  not invent completion for optional work.
- Rebuilding the execution summary immediately after hydration reproduces the
  saved per-item evidence.

## Result

One pure read owner now converts the saved item results back into completed ids.
The screen reads that owner when a session opens and whenever its saved result
arrives. A render caused by changing a load or another same-session detail does
not reset an active unsaved checklist.

## Measured evidence

- `test:session-execution`: 190 green / 6 red. Baseline was 185 / 6, so all
  five new cells are green and no red was added.
- Mutation: ignoring the saved `completed` value moves the suite to 188 green /
  8 red; the exact restoration and round-trip cells both die. Mutation restored.
- `test:mobility-flow`: 59 green / 0 red.
- `test:results-persist`: 5 green / 0 red.
- `test:session-logging-ui`: 25 green / 0 red.
- `test:compile`: no error in any changed product file. The repository gate
  remains red on unrelated file/scope pairs already outside this unit.
- `.maestro/visible/session-checklist-reopen.yaml`: exit 0 on the iPhone 17 Pro
  simulator. It reaches the state by acting: standard seed -> open workout ->
  Select all -> finish -> answer RPE -> save -> return to Program -> reopen the
  completed session. The reopened Select all is still checked, which can only
  be true when every selectable item, including Mobility / Warm-up, restored.
  Screenshot: `artifacts/visible/session-checklist-restored-after-reopen.png`.

The older `one-set-strength` golden seed was tried first and refused before the
flow with its existing message, `one-set-strength requires a deterministic
strength exercise.` No product conclusion was drawn from that broken
instrument; the lived journey uses the healthy standard seed instead.

NOT COVERED: physical iPhone Release rebuild and Sam acceptance; a lived
partial-session reopen (partial and obsolete-id shapes are covered headlessly).
