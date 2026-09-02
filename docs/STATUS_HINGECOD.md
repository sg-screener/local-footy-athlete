# Lower Hinge knee-dominant filler and COD transverse audit credit

Owner: `hingecod`

Starting checkpoint: `8d68d6dd34083d597c83507fb1a1729dc4ce6d16` (branch
`codex/four-confirmed-fixes`), worked in the isolated worktree
`/private/tmp/lfa-hingecod-8d68` on branch `fable/hinge-cod-audit-fixes`.

Scope: the two confirmed annual-audit findings only — knee-dominant filler on
dedicated Lower Hinge sessions, and the analyzer's false
`missing_athletic_transverse` around the combined Change of Direction session.
No architecture rebuild, no annual PDF, no inherited red repaired.

## Exact cause

1. **Hinge filler.** The football-robustness seat draws from the whole
   robustness bench. The weekly selector judged dedicated-day ownership only
   for the `strength` route and only by the `single_leg_knee` slot, so a
   prehab-authored lunge (Slant Board Step-Down) passed on the prehab route,
   and quad-led isolation/prehab (Standing Knee Extension, Reverse Nordic Curl,
   Spanish Squat Hold) has no knee slot at all and passed on both routes. The
   composer also narrowed to a robustness category before applying weekly
   legality, so when the category's members were illegal it fell through
   rather than taking the next legal unused posterior option.
2. **COD credit.** `weekly-strength-budget-year-audit.cjs` resolved each
   exported row through `resolveTemplateByName` only. The combined Change of
   Direction session renders its three authored sections as rows and has no
   row carrying the template name, so the `cod_decel` credit was never earned
   and the 14-day window reported missing exposure (male off-season weeks 6
   and 7 on the checkpoint's own accumulated journey).

## Options compared

1. Patch the twelve weeks or the named exercises after composition.
2. One typed purpose rule in the existing weekly selector, applied to both the
   strength and prehab routes and therefore to every rebuild path that already
   uses that selector; the composer applies weekly legality before choosing a
   robustness category and opens the posterior-chain bench first on hinge days;
   weekly frontal completion asks the selector with the composed day shape.

Option 2 landed. For the analyzer, the compared options were a new export
field naming the selected template versus resolving the typed section identity
already exported per row back to its authored template. The section resolver
landed in the conditioning-selection owner; no export change was needed, and
the same analyzer credits the untouched checkpoint's export.

## Red-first receipt (checkpoint code, accumulated 34-week journeys)

- Male: 31 dedicated Lower Hinge days, 16 carrying a knee-dominant automatic
  row. Female: 31 days, 11 carrying one. By exercise across both: Slant Board
  Step-Down 12 (the audit's twelve sessions: male weeks 5–7 and 16–18, female
  weeks 5–10), Reverse Nordic Curl 6, Standing Knee Extension 6, Spanish Squat
  Hold 3.
- Analyzer on the checkpoint's male 18-week export: `missing_athletic_transverse`
  for weeks 6 and 7 with the combined COD session present in weeks 5 and 7.

## What changed

- `src/rules/automaticWeeklyExerciseSelection.ts`: typed
  `dedicatedLowerDayConflict` (knee-dominant by real squat/single-leg-knee
  slot, or by signed primary muscle Quads/Knee when not hinge-family), applied
  to strength and prehab routes on Lower Hinge; Lower Squat keeps its existing
  strength-route hip-dominant refusal. `automaticExerciseSuppliesPosteriorChain`
  names hinge-purpose support. `chooseFallback` orders posterior work first on
  hinge days. The final audit reports a typed `conflict`.
- `src/rules/composeWeek.ts`: weekly legality before robustness-category
  preference; hinge days open the posterior bench first and use calf/general
  robustness only when it is exhausted; frontal-first stays ahead when the
  week still lacks lower frontal work.
- `src/rules/canonicalWeeklyPlaneCompletion.ts`: asks the selector with the
  workout's composed day shape.
- `src/rules/conditioningSelection.ts`: `resolveTemplateBySectionName`.
- `src/rules/movementPlaneProgramming.ts`:
  `athleticPlaneExposureForConditioningQuality`.
- `src/rules/programmingYearAuditProjection.ts`:
  `athleticPlaneExposuresForAuditDay`; the analyzer script calls it.
- Guard cells in `automaticWeeklyExerciseSelectionTests.ts` (four new) and
  `programmingYearAuditProjectionTests.ts` (two new); registry R-336 and two
  law rows.

## Focused results (regenerated 34-week journeys per athlete, full kit)

- Male and female: 31 Lower Hinge days each, zero knee-dominant automatic
  rows, every useful-session receipt `met` or typed (scheduled deload, injury,
  illness), zero exact repeats, zero main-family repeats, zero dedicated
  ownership findings, 34/34 successful cold restarts each.
- Analyzer: zero `missing_athletic_transverse`, zero required plane findings.
  Soft trunk-transverse findings identical to the checkpoint. The two accepted
  lower-frontal exceptions (weeks 22–23, injury) exist identically at the
  checkpoint.
- Changed days versus the checkpoint over the first 18 male weeks: 17 of 126
  (all Lower Hinge days plus two weekly-history ripples); female first 10
  weeks: 8 of 70. Typical hinge day now: RDLs, Hamstring Curl, Nordic Lower,
  Bosch Hold / Crab Walks / SL 45° Back Extension Hold.
- `scripts/four-confirmed-focused-audit.cjs` on both artifacts: 11/12, the
  only failure being the Week-40 nested-conditioning check, which needs a
  40-week run (not generated).

Suites: `test:automatic-weekly-selection` 21/21,
`test:programming-audit-projection` 9/9, `test:minimum-useful-strength-session`
7/7, `test:movement-planes` 13/13, `test:programming-final-composition` 6/6,
`test:generated-week-assembly` 30/30, `test:weekly-strength-budget` 5/5,
`test:weekly-strength-variety` 5/5, full-body balance 10/10.

Mutations (file restored byte-identical after each, sha checked):

- Removing the hinge branch of `dedicatedLowerDayConflict`: selection suite
  18/21 (dedicated-ownership, knee-dominant refusal and fallback cells red).
- Removing `resolveTemplateBySectionName` from the day projection: projection
  suite red on the combined-COD cell and the analyzer again reports male
  weeks 6 and 7.

## Inherited red, reproduced identically at the untouched checkpoint

- `test:compound-session-selection` 7/8 (classification scope changed).
- `test:slot-coverage` 81/84.
- `test:compile` gate: the same five pre-existing file/scope errors
  (`sessionBuilder.ts`, `sessionWorkOwnershipJourneyTests.ts`, one
  pre-existing fixture error in the selection test file).
- `test:law-registry` 13/14 (historical UNENFORCED rows);
  `test:ruling-registry` 5/8 (R-070 site, nine historical UNENFORCED rulings,
  uncited inbox questions). None of these lists changed.

## NOT COVERED

- Full `test:bible`, annual PDF regeneration, either phone, the simulator.
- Weeks 35–52 of the journeys (In-season beyond week 34 was not regenerated).
- Any reordering of Lower Squat support; that day is unchanged by ruling.
- Athlete-added work is outside the rule and was not exercised on device.
