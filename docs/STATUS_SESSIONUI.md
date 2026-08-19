# STATUS — seat `sessionui`

**Started 2026-08-20.** Seat name checked against `ls docs/STATUS_*.md` before the
first commit: `SESSIONUI` was free.

## The task

Sam's two outstanding Session-screen UI rulings, as ONE slice:

1. **Power belongs inside the Strength section, generally as its first row.**
   Delete the separate POWER / PRIMER section from the athlete-facing screen.
   One power row + four other strength rows reads **Strength 0/5**. Power's
   internal role and programming logic are untouched — projection, grouping and
   order only.
2. **Reposition the exercise controls.** Play/demo immediately beside the
   exercise name; completion checkbox at the far right where play sits today.
   Sets/reps stay lower-left, weight controls lower-right. Mobility, Power and
   Strength rows alike. Completion behaviour, video behaviour and accessible
   exercise-name labels preserved.

Non-goal, stated by Sam: **no Product work in this task.**

## BASE MEASUREMENT — taken BEFORE any edit, on `main` at `1b84d94c`

| suite | base |
| --- | --- |
| `test:session-execution` | **68 passed, 1 failed** — `the opened-session icon mounts the one session equipment sheet` (pre-existing, not this slice) |
| `test:session-logging-ui` | 25 passed, 0 failed |
| `test:surface-agreement` | 5 passed, 0 failed |
| `test:accessibility-contracts` | ⚠ **DEAD — it THROWS.** `ReferenceError: readFileSync is not defined` at `accessibilityWrapperContractTests.ts:192`, plus 4 red cells in section [3]. Landed with R-109 (`1b84d94c`) yesterday. |

## WHAT LANDED

**R-110 — power is a Strength row.** `src/utils/sessionExecutionChecklist.ts`:
`'power'` deleted from `SessionExecutionSectionId`, `SECTION_LABELS` and
`SECTION_ORDER`; `sectionForTemplateItem` routes `role === 'power'` to
`'strength'`; the orphan-component branch routes `kind === 'power'` there too.
Power's ROLE, its typed component and every §18 counter are untouched.

**R-111 — control placement.** `src/screens/home/DayWorkoutScreenV2.tsx`:
`ExerciseHeaderRow` wraps the name and `PlayButton` in one `exerciseNameGroup`;
`ExecutionChecklistItem` renders the content first and the checkbox last;
`executionItem` goes `center` → `flex-start` with `marginTop: 3` on the box so it
lands on the exercise-name line. Handlers, roles, states, labels and testIDs all
unchanged. Sets/reps and the weight control were not touched.

**Both changes are in components MOBILITY, POWER AND STRENGTH ROWS ALL SHARE**,
so "apply consistently" needed no per-surface work — and a cell requires there be
exactly one `ExerciseHeaderRow` and one `ExecutionChecklistItem`.

## A THING I WROTE AND THEN DELETED

An `orderSectionItems` partition inside the projection that hoisted power to the
head of Strength. **Mutating it to a no-op reddened NOT ONE CELL** — `d2Rank` in
`sessionTemplate` has always owned that order and the section filter preserves
it. A second sort that agrees with the first is a rival authority, not a
backstop. Deleted, with the reason left at the site and a cell that forbids a new
`.sort(` in the projection. The ordering property is held end to end instead: a
fixture that authors power LAST still projects it first.

## NOT MY CHANGE, REPAIRED BECAUSE IT WAS IN MY PATH

`test:accessibility-contracts` **THREW on every run** —
`ReferenceError: readFileSync is not defined` at
`accessibilityWrapperContractTests.ts:192`, shipped with R-109 (`1b84d94c`)
calling `readFileSync`/`join` in a file that imports neither and uses a `read()`
helper. The suite died there, so its later sections never ran at all. One-line
repair; it guards the accessible exercise-name labels this slice had to preserve.
**DEAD → 36 passed, 4 failed**, and those 4 are byte-identical to base (they are
HomeScreenV2 day-row cells, nothing to do with this).

## MEASUREMENT — BOTH ENDS, SAME TREE

**30 suites** — every suite whose source reads `DayWorkoutScreenV2.tsx` or
imports `sessionExecutionChecklist` — run at HEAD and at the candidate, comparing
**failure NAMES**, not totals.

| | result |
| --- | --- |
| candidate vs control | **identical failure sets, zero lines of diff** |
| `test:session-execution` | 68/1 → **98/1**; the 1 is the pre-existing `the opened-session icon mounts the one session equipment sheet` |
| `test:accessibility-contracts` | DEAD (threw) → **36/4**, same 4 |
| `test:compile` | red at BOTH ends and it is not this slice: control **673 errors / 78 worse pairs**, candidate **671 / 77**. None of the four changed files appears in either list. |
| `test:ruling-registry` | 6/2 at BOTH ends, same two cells (`UNENFORCED ceiling`, `re-ask scanner`) |

**MUTATION-PROVEN, four mutations, each restored from my own scratchpad backup:**

| mutation | reds | and nothing else |
| --- | --- | --- |
| power routed away from Strength | 7 cells | ✓ |
| checkbox back to the left | 1 cell | ✓ |
| play back to the far right | 2 cells | ✓ |
| row re-centred | the inverted cell | ✓ |

## PROVEN ON GLASS — iPhone 17 Pro, `standard-in-season-week`, 2026-08-20

1. **Strength session WITH power** — `STRENGTH 0/6`, **Vertical Jump is row 1**,
   then Back Squat, RDLs, Single-Leg RDL, Band Pallof Press. **No POWER section.**
2. **Strength session WITHOUT power** — Vertical Jump removed through the
   athlete's own Remove door: `STRENGTH 0/5`, **opening with Back Squat**.
3. **Mobility expanded** — Couch Stretch / Elephant Walks / Lateral Lunge, each
   with play beside the name and the checkbox at the far right.
4. **Strength expanded** — same arrangement, sets/reps lower-left, weight
   lower-right.
5. **Completion still works** — ticking Vertical Jump moved `0/6 → 1/6` and
   dulled the row; unticking restored it.
6. **Video still works** — the relocated play button opened the Back Squat demo.

## NOT COVERED — AND IT IS FOR SAM, NOT FOR THE NEXT SEAT TO ASSUME

**The Program tab's DAY CARD still lists `POWER — 1 exercise` as its own
timeline row.** Different owner: `rules/dayTimeline` over `projectDayDetail`'s
typed PARTS — one tappable door per component — and power is exactly the typed
component R-110 tells us to preserve. **Merging it there is a ruling nobody has
given**, so it was named rather than swept in. Recorded in R-110.

**Also not covered:** the `stacked-team-training-upper-pull` seed FAILED to
reset twice (element never appeared; it left the app at onboarding). Pre-existing
and unrelated — the without-power proof was taken through the Remove door on
`standard-in-season-week` instead, which is a stronger proof anyway because it is
a real athlete action.

**Also not covered:** Product work, per Sam's non-goal for this task.
