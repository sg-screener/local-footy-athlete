# STATUS — seat `longcues`

Opened 2026-09-04. One item: **R-366, show the long cues everywhere.**

## What was wrong

Sam photographed `Jefferson Curl` in Movement Prep reading **"Slow reps"**. The
curated cue for that movement — *"Tuck your chin and slowly roll down one
segment at a time. Add small weight when easy"* — has existed in
`src/data/exerciseCues.ts` the whole time and was never rendered on that row.

Two athlete-visible strings for one exercise:

| source | Jefferson Curl | Bosch Hold |
| --- | --- | --- |
| `exerciseCues.ts` (curated, Sam's sheet) | Tuck your chin and slowly roll down one segment at a time. Add small weight when easy | Single or double leg, slight knee bend, drive heel into ground, keep hips high. |
| `exercisePools.ts` `notes` (pool shorthand) | Slow reps | Drive the heel down, hips high. Single or double leg. |

The screen preferred the second one on every mobility-presented row.

## The census, before any edit

- **Writers of the override:** 2 — `MobilityExerciseList` (`cueTextOverride={exercise.notes}`)
  and the shared `SessionList` mapper (`cleanNotes(row.notes ?? row.exercise.description)`
  when `presentation === 'mobility' && !row.sessionSection`).
- **Reader:** 1 — `StrengthExerciseCard`'s
  `cueTextOverride !== undefined ? cueTextOverride : resolvedCue.text`.
- **Checkers pinning it:** 3 cells across `sessionExecutionChecklistTests`,
  `mobilityPrehabFlowTests` and `sessionChangeHubTests`, all asserting the prop's
  source text as REQUIRED.
- **Coverage check first:** all 94 `ex(...)` pool rows resolve to a real key in
  `EXERCISE_CUES` — 0 missing — so deleting the override could not blank a row.
- **Other surfaces asked, and left alone:** `projectionCopy.ts` already reads
  `buildCueText`; `visibleProgramReadModel` and the conditioning row use `notes`
  for modality inference and the dose line, which are not form cues. The pool
  `notes` field keeps every other reader.

## What changed

`cueTextOverride` is **deleted** — prop, parameter and ternary — so
`const cueText = resolvedCue.text` is the only path on every route. Not
defaulted: a prop that can be passed is a second authority waiting to be used.

The three cells are **INVERTED**, not removed: each now asserts the override's
absence. Their predicates match the prop's SYNTAX (`cueTextOverride\s*[=?,]`),
because the screen still names the deleted prop in the comment explaining why it
is gone, and a cell that reds on its own tombstone teaches the next reader to
delete the explanation.

`scripts/qa-start.sh` gained one line: `QA_METRO_PORT` now also reaches the app
via `-RCT_jsLocation`. It moved Metro and nothing else, so a seat that moved off
`:8081` to dodge another checkout still loaded that checkout's bundle. That cost
the previous seat twenty minutes on 2026-09-04 and reads as a product bug.

## Gates — measured at BOTH ends

Control run in a pristine `git worktree` at `HEAD` (97168ec8), same tree, same
`node_modules`:

| gate | HEAD control | with this change |
| --- | --- | --- |
| `test:compile` | FAILED — 7 errors, `sessionWorkOwnershipJourneyTests.ts` | FAILED — the same 7, none in my files |
| `test:release` | 0/27, dies at `devE2ESeedRegistry` "generated source row is missing" | identical |
| `test:session-execution-checklist` | 212 passed, 2 failed | **213 passed**, the same 2 failed |
| `test:mobility-flow` | 75 passed, 3 failed | **76 passed**, the same 3 failed |
| `test:session-change-hub` | 59 passed, ALL GREEN | 59 passed, ALL GREEN |

**Zero new failures; one new passing cell in each suite that gained one.**

### The five pre-existing reds are other seats' — named, not absorbed

- `sessionWorkOwnershipJourneyTests.ts` — 7 typecheck errors, `Property 'row'
  does not exist on type 'SessionTemplateItem'`. Committed at `01e805e3`.
- `devE2ESeedRegistry` throws for seed `session-layout-showcase` — a generation
  defect; the release gate stops on the first red unit, so it reaches nothing else.
- checklist `[10] exercise names are upright…` — the cell wants a literal
  `fontSize: 15`; the style now reads `SESSION_ROW_TEXT_SIZE`, changed by
  `37cb2593` / `0b8d7fce`.
- checklist `[10] choice and phase cards use the one trailing completion owner`.
- mobility `the shared execution section owns mobility disclosure` and two
  siblings — they look for `section.id === 'mobility'`, removed by `c3f16708`.

## Proof on glass

Simulator `iPhone 17 Pro` B8B2C7B0, own Metro on `:8085` (`:8081` belongs to
`/private/tmp/lfa-hingecod-8d68`, another seat's checkout — left running).

- **Bosch Hold**, Movement Prep, in the generated week: reads *"Single or double
  leg, slight knee bend, drive heel into ground, keep hips high."*
- **Jefferson Curl**, added through the real Add door: reads *"Tuck your chin and
  slowly roll down one segment at a time. Add small weight when easy"*.

WORKING — `test:session-execution-checklist` cell *"no route overrides the
curated cue with a row note"* fails if the override returns.
