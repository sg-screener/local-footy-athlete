# STATUS — seat `projection`

Claimed 2026-08-17. Name checked against `ls docs/STATUS_*.md` at claim time —
`PROJECTION` was free (`PRINTER` and `PROGRESSION` exist and are other seats).

Mission: ATHLETE-FACING PROJECTION CLEANUP — five display surfaces, base
`main @ 9769c185`, branch `feat/athlete-projection-cleanup`, worktree
`scratchpad/wt-proj`. CAP 3 sessions.

## THE INSTRUMENT — I did not build one, I extended the printer

`npm run print:week` (seat `printer`, item 65) already runs the app's real read
chain offline: `generateProgramLocally` -> `buildProgramTabProjectedWeek` ->
`project()`. It writes nine plain-English weeks to `docs/printed-weeks/` and it
already ANNOTATES four of the five defects this mission names. It is the
measurement and it is also the PRINT FOR SAM deliverable.

Two exports added so guards and probes can reuse it instead of hand-building a
second `ScheduleState` (the hazard its own header names):

- `export interface PrintScenario` / `export const SCENARIOS`
- `export interface PrintedWeek` / `export function runScenario`

`main()` stays guarded by `require.main === module`, so importing still writes
no files. `__DEV__` is still forced false at module scope by the printer —
unchanged, and re-assert on your side if you need it true.

## BASELINE — measured on this branch, not quoted from the committed files

`npm run print:week` on `feat/athlete-projection-cleanup` @ 9769c185:

| scenario | result |
| --- | --- |
| 1-early-off-season | **REFUSED** `main_strength_permitted_maximum:4` |
| 2-deep-pre-season | 7 days, 0 missing words, 0 findings |
| 3-in-season-two-team-nights | 7 days, 0 missing words, 0 findings |
| 4-bye-week | 7 days, 0 missing words, 1 finding |
| 5-away-trip | 7 days, 0 missing words, 3 findings |
| 6-bodyweight-only | **REFUSED** `main_strength_planner_selected_target:3` |
| 7-no-club-pre-season | 7 days, 0 missing words, 2 findings |
| 8-no-club-in-season | 7 days, 0 missing words, 2 findings |
| 9-later-off-season | 7 days, 0 missing words, 3 findings |

11 findings across the six printed weeks. `[NO COPY]` total: **0**.

The committed `docs/printed-weeks/*.md` differ from a fresh run only in
EXERCISE SELECTION (rotation drift — `Deadlift` -> `RDLs`, `Incline Bench` ->
`Bench Press`). Every defect below reproduces identically, so the committed
files are a valid baseline and the drift is not mine.

## WHAT IS ACTUALLY WRONG — probed, not inferred

`scripts/tmp-probe-shape.ts` (temporary, deleted before commit) dumps the real
generated rows through `runScenario`. Pre-season no-club, Tuesday:

```
speedBlock: {"id":"speed-10-m-acceleration-reps-pre_lift",
  "title":"10 m Acceleration Reps","kind":"true_speed","placement":"pre_lift",
  "prescription":"6-10 reps · ~2 s (10 m) · 45-60 s walk-back (full recovery)",
  "templateName":"10 m Acceleration Reps",
  "exerciseIds":["speed-2026-08-11-warmup","speed-2026-08-11-main"]}

row: {"name":"10 m Acceleration Reps","id":"speed-2026-08-11-main",
  "role":"conditioning","sets":8,"min":1,"max":1,"prov":"authored",
  "notes":"Work: ~2 s (10 m)\nRest: 45-60 s walk-back (full recovery)\n
           Sets: 6-10 reps\nIntensity: 95-100% maximal - crisp first step"}

row: {"name":"Classic 4x4","id":"cond-2026-08-11-main",
  "role":"conditioning","sets":4,"min":1,"max":1,"prov":"authored",
  "notes":"Work: 4 min hard\nRest: 3 min easy jog\nSets: 4 reps\n
           Intensity: 90-100% MAS; HR 90-95% max late"}
```

**THE AUTHORED DOSE IS ALREADY ON THE ROW AND ALREADY STORED.** Work, rest,
sets/rounds and intensity are four authored lines in `notes`, traced to
`data/conditioningTemplates.ts` (`workPeriod` / `restPeriod` / `setsRounds` /
`intensity` / `totalSessionTime` — Sam's six-value schema). `prescribedSets:1,
RepsMin:1, RepsMax:1` on a conditioning row is a PLACEHOLDER, not a dose.

So all five surfaces are display defects. Nothing needs re-authoring, nothing
needs re-generating, and the north star answer is *toward* — every fix reads an
input the composer already stored.

### Surface 1 — "1 × 1"

`projectVisibleWeek.prescriptionCopy` falls through to
`row.prescription.sets_reps` on `sets=1, min=max=1`, printing `1 × 1` over the
top of a real authored prescription. Own it: a conditioning row's prescription
comes from the authored dose, never from the placeholder numbers.

R-049 is adjacent and binding: warm-up and cool-down rows never count toward
dose. `Warm-up — 1 × 1` is the same defect on a row that should carry no dose
line at all.

### Surface 2 — the rep range

`prescriptionCopy` emits `row.prescription.sets_reps_range` -> `3 × 4-6`.
**R-016 says `BUILT`, and it is — in `dayWorkoutHelpers.formatStrengthSetsReps`,
which calls `rules/prescriptionDisplay.displayReps`.** The projection never got
the ruling. Two owners, one question, and they disagree: the day screen says
`3 × 5` and the projection says `3 × 4-6`. `displayReps` is the existing owner
and the projection must call it. The stored range is untouched — the law's own
words are "ranges remain the generation source".

### Surface 3 — sprint filed under Strength

Pre-season Tuesday prints an empty `**Speed**` block and then lists
`10 m Acceleration Reps` under `**Strength**`. The typed owner exists:
`workout.speedBlock` (`SpeedBlock`, `types/domain.ts:488`) carries
`exerciseIds`, `placement: 'pre_lift'` and its own authored `prescription`.
`projectVisibleWeek.rowsForKind` returns `[]` for `kind === 'speed'`, so the
speed part is empty by construction and `composeDayDetail` leaves the row in
`strengthExercises`. Position is already right — Speed sits before Strength on
the printed day — so this is a re-file, not a re-order.

### Surfaces 4 and 5 — measured, owners not yet named

- **4 (kit gaps).** The printed away week shows substituted content
  (`Goblet Squat`, `Cossack Squat`) with NO text saying why. Generation for the
  away scenario emits a full-gym week (`Leg Press`, `Lat Pulldown`); the away
  kit is applied at the READ side, which is what `bb952170` landed. So the
  substitution happens where the athlete can see the result and not the reason.
  Typed carrier: `DerivedSessionOrigin: 'equipment_substitution'` exists
  (`types/domain.ts:776`). Whether the resolved week actually carries it on this
  flow is the open question.
- **5 (explanations).** Two of nine scenarios REFUSE outright with typed
  reasons (`main_strength_permitted_maximum:4`,
  `main_strength_planner_selected_target:3`). The refusal is typed and the
  printer prints only `FAILED`. Block-two progression and reduced-week carriers
  not yet located.

## OPEN — for Sam

One design fork, stated in the approval message: whether a conditioning row
shows all four authored lines (Work / Rest / Sets / Intensity) or a single
summary line. Everything else in the mission is a ruling that already exists.

REGISTRY-GREP: R-016 (single middle number — `BUILT`, and this is the surface
it was not built on), R-049 (dose counts main work only), R-018/R-019/R-075
(away is an equipment subtraction that must REPLACE the work it removes).

## What I have not touched

No generation file, no scheduling file, no selection file. `git status` before
every commit; `git commit -- <pathspec>` only.
