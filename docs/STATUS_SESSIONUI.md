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

---

# PART 2 — THE DAY SUMMARY CARD (same task, Sam's follow-up ruling)

**Sam, 2026-08-20:** *"Merge POWER into Strength on the Program tab's Day summary
card too. No separate POWER row. Strength's count includes the power exercise. If
Strength is expanded, power appears first. Tapping Strength opens the combined
strength work. Preserve power's internal role for programming, counting and
progression. This is the same athlete-facing ruling, not a new programming
decision."*

Recorded as an extension of **R-110**, not a new row, because he said so — and the
stale *"WHAT IS NOT CHANGED, AND IS FOR SAM"* paragraph was rewritten rather than
left standing, because an answered question left open is a re-ask waiting to
happen.

## WHERE IT LANDED — the projection, not the timeline

The timeline and the day-detail projection both carry a standing law: *"every
part, in order, always. There is no filter in this file and there must never be
one."* So the merge is at the PARTS owner:

- `visibleProjection.ts` — `'power'` DELETED from `VisiblePartKind` and from
  `PART_COUNTS_TOWARD_LOAD`. Deleting the union member is what made the compiler
  find every table that had to answer for it, rather than me grepping.
- `projectVisibleWeek.ts` — `COMPONENT_TO_PART` maps the power COMPONENT to a
  `strength` PART; `partsForWorkout` does not mint a second strength part;
  `rowsForKind` loses its power branch; `PART_BUCKET_KIND` loses the row it no
  longer has anything to translate.
- `dayDetailComposition.ts` — power and strength rows are concatenated BEFORE
  `orderRowsAsSessionPresents`, so the session template places one list and power
  leads by D2's authored order. `powerExercises` is deleted; it had no reader
  left.
- `HomeScreenV2.tsx` — the `bolt` glyph row goes with the kind.

**A POWER-ONLY SESSION KEEPS ITS PART** (it reads "Strength"). Folding
unconditionally would take the day's only content off every surface — the exact
class the no-filter law exists to prevent.

## COUNTING — Sam's one preservation requirement, checked

`PART_COUNTS_TOWARD_LOAD` had `power: true` and `strength: true`, so a power row
inside a strength part counts exactly as it did. Two table-lookup cells had to
drop the word `power` with the kind; **the CLAIM was moved, not dropped**, into
`test:power-primer-policy`, which has a projected week with real power days.

## FIVE GUARDS INVERTED, NOT DELETED — every one required the old shape

| suite | what it required |
| --- | --- |
| `test:day-first-timeline` | a day LEADS with a power part, and the timeline NAMES it |
| `test:day-first-timeline` | the bucket-dedupe cell whose only exhibit was the power+strength day |
| `test:projection-ownership` | `parts.length === components.length`, one part per component |
| `test:power-primer-policy` | one power PART per power row |
| `test:action-walker` | L-P3 rows conservation: a strength part is owed `strengthRows` only |

**The walker one was found by MEASURING, not by reading** — it reported *"a
strength part with 4 rows while the day has 3 authored ones"*.

**And one was already red at HEAD for a reason that has nothing to do with
power:** `test:day-first-timeline`'s cell asserted `title === "Strength"` from
before the compound-title ruling, so the exhibit day legitimately read "Strength
+ Team Training". Fixed while inverting it — a guard red for a stale reason is a
guard nobody reads.

## MEASUREMENT — BOTH ENDS, 66 SUITES

Every suite reading the projection, the composition, the timeline, or either
screen. Run at the Part 1 commit and again at the candidate, comparing failure
NAMES.

**ONE LINE OF DIFFERENCE IN THE WHOLE SET, AND IT IS A FAILURE REMOVED.**

⚠ **AND THE FIRST CONTROL RUN WAS VOID.** It reported `exit=127` for all 66 —
`timeout` does not exist on macOS, so every suite failed to launch and the
instrument reported a confident, uniform, meaningless answer. Re-run with the
instrument fixed: 29 clean / 37 not.

| | result |
| --- | --- |
| 66-suite failure sets | identical but for one removed failure |
| `test:compile` | **671 errors / 77 worse pairs at both ends**, product scope unmoved at 30 |
| `test:ruling-registry` | 6/2 at both ends, same two cells |
| `test:projection-ownership` | 11/2 → **13/0** |
| `test:section18-recovery-neutrality` | 7/2 → **8/1** |
| `test:power-primer-policy` | 16/0 → **18/0** |
| `test:session-list-combinations` | `[1]` broken then fixed; `[2]` failing at BOTH ends |
| `test:action-walker` | 20/3 at both ends, same three |

**MUTATION-PROVEN, three mutations, restored from my own backups:**

| mutation | reds |
| --- | --- |
| the power part is not folded | 4 cells |
| power rows dropped from the strength part | 3 cells |
| power ordered after strength | 2 cells |

## PROVEN ON GLASS — BOTH SURFACES, ONE DAY

1. **Day summary card** — `STRENGTH — 6 exercises`, **no POWER row**, carrying
   the strength glyph rather than the bolt.
2. **Day summary card, expanded** — Vertical Jump, Back Squat, RDLs, Single-Leg
   RDL, Band Pallof Press, Cossack Squat. **Power first.**
3. **Session screen, same day** — `STRENGTH 0/6`, the same six, the same order.

## NOT COVERED

**`test:session-list-combinations` cell `[2]` fails at BOTH ends** — a stale
containment (`session_list_badges_a_midline_row_the_projection_has_no_part_for`)
that already needed retiring before this slice. **My change grew its list from 2
coordinates to 4**, because merging the parts collapsed several coordinate names
together. The cell's verdict is unchanged and the debt is not mine, but the list
it prints is longer and somebody should retire it — it also owns a declared red
on the walker, so retiring it is a two-file job with its own measurement.

**Also not covered:** Product work, per Sam's non-goal for this task.
