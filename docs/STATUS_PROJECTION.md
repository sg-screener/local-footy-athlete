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

---

# OUTCOME — 2026-08-17, three commits, cap not reached

| surface | state |
| --- | --- |
| 1. conditioning shows its real prescription | **WORKING** — `test:athlete-projection` cell 3 |
| 2. strength shows the ruled single rep | **WORKING** — cell 2 |
| 3. sprint under Speed | **WORKING** — cells 4 and 5 |
| 4. typed kit gaps visible | **WORKING** — cell 6 |
| 5a. progression + reduced-week explanations | **WORKING**, wiring proven — cells 7 and 8 |
| 5b. typed REFUSAL explanations | **WORKING** — cells 12, 13, 14 |

Printed weeks: **0 findings, 0 `[NO COPY]`** across seven generated worlds,
down from 11 findings at base.

## THE BLOCKER IS CLOSED — Sam ruled the structure, 2026-08-17

He gave the three lines and the constraint on the middle one:

> We couldn't build a safe week from your current setup.
> [Plain-language explanation of the exact typed refusal.]
> Update the relevant answer and try again.

> *"The second line must come from the existing typed refusal reason — do not
> invent new refusal logic or collapse different causes into one generic
> message."*

**FOURTEEN SENTENCES, ONE PER CLAUSE, KEPT COMPLETE BY THE TYPE SYSTEM.**
`REFUSAL_CLAUSE_COPY` is a `Record<GeneratedWeekClauseId, string>` over the
closed union, so a fifteenth clause fails the build until its sentence exists.
That is what stops the no-collapsing rule decaying into a default later.

The two worlds that refuse on `main` now print exactly what the athlete sees:

| world | the athlete's middle line |
| --- | --- |
| `1-early-off-season` | You've asked for more lifting days than is safe to program in one week. |
| `6-bodyweight-only` | Your week can't fit the number of lifting sessions this phase of your season is built around. |

Two different clauses, two different sentences.

**A REFUSED WEEK IS NEVER AN EMPTY SUCCESSFUL ONE.** The refusal throws and
carries no program, and it always has words — a wordless refusal renders blank,
and a blank week reads as *"nothing to do today"* rather than *"we could not
build this"*. `weekRefusalIsSpeakable` is exported so a surface cannot forget to
ask. A `disclosed_gap` finding produces NO refusal text, pinned by its own cell:
a disclosable clause fails without refusing (R-083) and already reaches the
athlete through the day's gaps.

**The printer now writes a refused week as a PAGE** rather than logging `FAILED`
and writing nothing — which is precisely how this surface came to have no words
in the first place.

## THE SECOND GAP IS CLOSED TOO — and it was hiding a real defect

Ordered 2026-08-17. `test:block-two-explanation-delivery` builds a REAL athlete:
block 1 generated with its selections recorded, twelve sessions of recorded full
completion and good recovery, then block 2 generated FROM that history — and
asks the ATHLETE-FACING READ CHAIN (`buildProgramTabProjectedWeek` ->
`project()`, `useSchedule.projectWeekFor`'s own two calls) what it shows.

**THE MIDDLE WAS NEVER CROSSED BEFORE.** `athleteVisibleProjectionTests` proved
the carrier with a hand-built row. `blockTwoProgressionTests` [11]/[12] proved
the storage and the renderer. **Nothing asked the read path**, so the explanation
could have been dropped anywhere between them with both suites green.

**AND IT FOUND A DELIVERY DEFECT THAT EVERY OTHER CELL AGREED WAS FINE.** The
athlete was shown:

```
...RDLs has moved from 100 kg to 102.5 kg...
...RDLs has moved from 100 kg to 102.5 kg...
...RDLs has moved from 100 kg to 102.5 kg...
...RDLs has moved from 100 kg to 102.5 kg...
```

`blockBoundaryExplanation` stores one row PER OCCURRENCE of the lift across the
block — four sessions, four rows — which is CORRECT for storage. It is wrong on
the glass: one decision, told four times. **The sentence, the stored row and the
prescribed weight all agreed perfectly and the reading was still wrong**, which
is exactly the class of defect a storage-side or renderer-side test cannot see.

Fixed at the DELIVERY layer only (`distinctExplanations` in `project()`). No
stored row changed, no progression policy changed, and
`blockBoundaryExplanationSentences` is untouched so the two block-two suites keep
their exact semantics.

The agreement cell was upgraded from a LIST comparison to a SET equality plus a
no-duplicates claim — the list comparison passed while the athlete read the same
line four times, so it was the weaker statement wearing a stronger name.

**RESTART, BOTH MEANINGS.** Serialised-and-read-back re-projects identically,
AND regenerating block 2 from the same stored inputs produces a byte-identical
explanation and the same sentence — which is the one that matters, because this
app regenerates on boot rather than reading a stored program back.

**THE CONTROL.** An athlete with no qualifying history is shown NO sentence.
Without that cell the suite would pass on a projection hardwired to talk.

MUTATIONS: production reader removed from `project()` -> 6 cells red; dedupe
removed -> 2 cells red.

## WORLD CENSUS — lost and gained, separately

- **LOST: 0.** The same two scenarios refuse at base and on this branch, with
  byte-identical reasons. No world that generated before stopped generating.
- **GAINED: 1**, and it is a HARNESS addition, not a programming change:
  `10-dumbbell-away`. Sam's proof list named a dumbbell-away week and there was
  none — `5-away-trip` carries a travel schedule fact with NO equipment
  subtraction, so that athlete keeps a rack and a leg press in a hotel.
- **No generation, scheduling, selection or refusal-policy file was touched.**

## WHAT THIS COST, FOR THE NEXT SEAT

**A NUL BYTE IN A TEMPLATE LITERAL, AND `grep` WENT SILENT.** An edit wrote
`\x00` where a space belonged, inside
`` `${templateName}\x00${field}` ``. The lookup then never matched its own
registry. Worse: **`grep`/`ugrep` treated `projectionCopy.ts` as BINARY and
returned NOTHING for every pattern** — including patterns that were plainly
there. It reads exactly like "the code I wrote is not in the file". `python3`
read it fine. **If a grep on a file you just edited returns nothing, check for
NULs before you believe it.**

**A HALF-MUTATION PROVED NOTHING, AGAIN (sighting N).** Mutation M7 inserted an
invented row after the `support` branch of `rowsForKind` — which the `strength`
branch above already returns past. It compiled, it ran, it never executed, and
the cell "passed". Re-aimed at the reachable branch it killed the cell
instantly. **A mutation that leaves the suite green is a claim about the
mutation, not about the guard, until you prove the line ran.**

**A CONSERVATION GUARD MUST COMPARE AGAINST THE *RESOLVED* WEEK.** The first
draft compared the projection against `program.microcycles[0]` and failed on
`4-bye-week`, where the resolver legitimately relocates a session onto a date
generation never named. `runScenario` now returns `weekDays` for exactly this.
Sam's words are "stored ACCEPTED program"; the generated microcycle is not it.
