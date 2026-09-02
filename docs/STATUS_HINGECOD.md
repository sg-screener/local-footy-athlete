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

## Addendum 2026-09-02 — Up-Back Shuttle trimmed to 10 reps

Sam: *"the COD is slightly too large … make the last thing 10 reps."* The
third section of the combined Change of Direction session now prescribes 10
reps (was 15) in the one authored template, the source-of-truth workbook tab
`COD Session Sections`, the Programming Bible, the R-331 registry text, the
fortnightly COD tape and the signed athlete-copy fixture. Equality
170/170, fortnightly COD tape 19/19. No cadence, placement or section order
changed.

## Addendum 2026-09-02 — R-337: the week is budgeted in stimuli, not days

Sam, on the five-day off-season weeks and Speed stacked onto tempo: *"is the
problem thinking in days vs thinking in stimulus?"* then *"count stimulus"*.

### Exact cause

The scheduler budgeted `conditioningTarget` (four from normal Off-season week
5) in receiver DAYS. The planned automatic Speed day had to be one of the
selected receivers, so it rode that day's metabolic work and the four-day
budget still delivered four metabolic days plus Speed. When the annual world's
receivers were Tue/Thu/Sat, the day-count gap was filled by the free-day top-up
pass, which may not use a gym day (Monday), and Friday would have made three
consecutive energy days, so the Sunday bike sprint was added: five training
days, Speed stacked on Saturday's tempo.

### What changed

- `weeklyProgrammingContract.ts`: typed `speedInsideConditioningTarget` on
  every phase overlay (true for normal Off-season build and Pre-season; false
  for early/transition Off-season and In-season, where WC-143 and P15 keep
  Speed riding an upper receiver in game weeks).
- `weeklyScheduler.ts`: `metabolicBudget = target − anchors − delivered − Speed
  stimulus`; with room the receiver selection excludes the Speed day and
  retries with stacking only when spacing cannot seat the budget; the stale
  "keep a receiver after Speed" score is silent when Speed owns its day; an
  existing training day is preferred over opening a new day before even
  spacing; a Speed day counts as a running day.
- `weeklyPlanDisplay.ts`: a strength session whose only energy-system
  component is Speed keeps its session name on the week row (it was titled
  "Speed Conditioning" while its parts correctly showed Upper Body Push +
  Speed).
- Three new scheduler cells and a rewritten fresh-Speed cell 9.

### Red-first, mutation, results

- Red first: 128/131 on the checkpoint code (the three new cells).
- Mutation: `speedInsideConditioningTarget: false` on the normal build overlay
  reds the same three cells; file restored byte-identical (sha checked).
- Checkpoint 34-week journeys, both sexes: off-season weeks 5–7 all five
  training days, Sunday energy day, Speed stacked on Saturday. After: four
  training days (Mon lower + easy off-feet or COD, Tue upper + hard, Thu hinge
  + tempo off-feet, Sat upper + Speed only), no Sunday session, zero stacked
  days. Pre-season weeks without club nights (13–14) follow the same shape.
- Unchanged: 31 Lower Hinge days per athlete with zero knee-dominant rows,
  zero repeats, zero dedicated-ownership or required plane findings, 34/34
  restarts each, focused audit 11/12 (Week-40 check needs a 40-week run).
- Suites: weekly scheduler 131/131, fresh Speed 14/14, persistence 2/2,
  fortnightly COD 19/19, scheduler fixtures 11/11, off-season continuity 9/9,
  spare-day options 22/22, generated-week 30/30, final composition 6/6,
  minimum-useful 7/7, selection 21/21, planes 13/13, template equality
  170/170, weekly-plan display green.

### Still stacked, by earlier rulings (not changed here)

- Pre-season weeks with club nights (Mon/Wed team training): Speed rides the
  Friday hinge beside its steady blocks through the club top-up path (P15 /
  R-330 club rule). In-season game weeks keep WC-143's shape.

### Inherited red, reproduced identically at the untouched checkpoint

travel-zero-equipment 8/10, session-classification 48/50,
canonical-weekly-compiler one duplicate-row cell, compound-session-selection
7/8, slot-coverage 81/84, the typecheck gate's five pre-existing files, law
registry 13/14, ruling registry 5/8.

### NOT COVERED

Full `test:bible`, `test:programming-hierarchy`'s inherited release chain,
annual PDFs, either phone, the simulator, weeks 35–52, and the club-night
Speed top-up shape (a separate ruling if Sam wants it split too).

## Addendum 2026-09-02 — R-338: flys count as conditioning and speed; Speed stays with the lifting

Sam: *"the fly counts as conditioning ... flys and accelerations are
conditioning but they count towards the speed stimuli as well ... that friday
5 min intervals should not even be there = should just be hinge + flys"* and
*"keep it on the friday ... i'd rather them do it after lower body work than
the next day"*.

### Exact cause

The club-athlete Speed top-up (missing top-end quality with two club nights)
rode a conditioning receiver and never spent the stimulus budget, so the
pre-season club week was authored two metabolic sessions plus the fly. The
rider could only sit on a day already carrying conditioning, so the fly landed
on the Friday hinge beside 5-minute aerobic intervals.

### What changed

- `weeklyScheduler.ts`: where the overlay counts Speed inside its target, the
  club top-up uses the planned Speed path, spends one stimulus and is excluded
  from the metabolic receivers (`clubSpeedRides` only where the overlay does
  not, i.e. in-season R-268/P15). The fresh selector ranks an existing lower
  strength day ahead of a new standalone day (freshness still first).
- Scheduler cells: two new two-club-night pre-season cells; the off-season
  reference cells now expect the earliest fresh existing strength day (Monday)
  rather than a new Wednesday.

### Results

- Red first: the two new cells red; mutation (rider always) reds them again;
  file restored byte-identical.
- Pre-season club week (club Mon/Wed): Fri hinge + Fly only, Sat upper + hard,
  two app days plus two club nights = four; no aerobic session.
- Off-season build weeks unchanged from R-337.

### NOT COVERED

In-season club weeks keep R-268/P15 by ruling. Everything listed under R-337.

## Addendum 2026-09-02 — final full-year audit at `db534496`

Run from a clean detached checkout of `db5344964f3a74b515a701050ef6ab046efd476b`
with no production change. Fresh 52-week male and female programmes through the
R-335 accepted journey: 52/52 weeks, 364 consecutive distinct dates, 52/52 cold
restarts, 0 refusals, 0 refused actions per athlete. Accepted-journey acceptance
24/24, focused composition 24/24, strength-budget analyzer PASS/PASS/PASS (0
repeats, 0 dedicated-ownership breaches, 0 required plane findings with the 4
injury-week frontal absences as accepted typed exceptions, 0 athletic transverse
gaps with the typed COD credit), 47 Lower Hinge days per athlete with 0
knee-dominant rows, off-season build weeks on four training days with no Sunday
session and no stacked Speed. Two 114-page PDFs, every page auto-verified
(no blank, clipped, out-of-page or header-only pages; 52 weeks; 364 dates) and
the named pages inspected by eye. Six audit-tool mistakes in the copied
cca002a0 tooling were corrected before the final run and are listed with the
evidence. Outputs: `output/final-full-year-audit-db534496/` (untracked) in the
main checkout and in the audit checkout; report
`FINAL_FULL_YEAR_AUDIT.md` beside them.

## Addendum 2026-09-02 — R-339: running means running (unit 1 of Sam's six)

Cause: the planner said "running" for upper-day attached conditioning but the
session builder's combined-day policy (`combinedConditioningMustBeOffFeet`,
never a recorded ruling) sent every combined non-sprint session to a machine
and a weighted picker rolled bike/mixed/row/ski. Fix: the policy takes phase
and region (lower/full off-feet, in-season off-feet, flush off-feet, COD never
a machine, otherwise run); the builder passes `runOnly` for such days so a
run-capable template is chosen; standalone easy-aerobic days run outside
In-season. Guard: new chained `test:conditioning-modality-by-day` 5/5, red
4/5 under the old policy (mutation restored byte-identical). Regenerated
34-week journeys: off-season app conditioning 13/19 on legs (was 6/19),
pre-season 20/34 (was 4/33), in-season 0/8; restarts 34/34. Neighbours green:
COD tape 19/19, scheduler 133/133, generated-week 30/30, final composition
6/6. Inherited reds reproduced identically at the clean db534496 checkout:
conditioning-rotation 110/236, conditioning-equipment-consistency 6/20,
finisher-eligibility 58/68, canonical-weekly-compiler (duplicate-row cell and a
Section 18 onboarding-world shortfall).

## Addendum 2026-09-02 — R-340: repeat sprints reachable (unit 2 of six)

Cause: the five repeat-sprint templates lived behind the `sprint` category,
which every Speed request narrows to acceleration/top-end (R-311), and the hard
slot only asked for aerobic power or anaerobic work. Fix: `repeat_sprint` is a
hard conditioning demand category (added across the domain union, contract,
selector waist and pool, Section 18 stress, deload, game safety, block
boundary, taxonomy, visible identity, builder), Pre-season rotates it with
aerobic power from phase week 4, In-season bye weeks take it as their small hard
dose, and the Speed pool drops it. Red-first: four scheduler cells + the
category truth table; mutation (late list ignored) reds the late-Pre-season
cell; file restored byte-identical. Regenerated 52-week male year: nine
repeat-sprint sessions (weeks 16–18, 24–26 as runs on upper days; bye weeks
31, 37, 43 on the bike), 52/52 restarts. Suites: scheduler 137/137, fresh
Speed 14/14, COD 19/19, modality-by-day 5/5, equality 176/176, generated-week
30/30, final composition 6/6, deload 50/50; inherited reds unchanged.

## Addendum 2026-09-02 — R-341: speed variety (unit 3 of six)

Cause: with club nights the ask was top-end only and the preference
alternated Fly 20 / Fly 30 by week. Fix: Pre-season shelves rotate (top-end:
Fly 20, Fly 30, Progressive; acceleration: 20 m, Hill, 30 m) and the first
Pre-season club block asks for an authored acceleration on even weeks.
Guard: new chained `test:speed-template-variety` 5/5, red 3/5 under the old
alternation (mutation restored). Regenerated 52-week male year: Fly 20 ×6,
Fly 30 ×5, Progressive ×3, 20 m ×3, Hill ×2 (was Fly 20 ×11, three
accelerations); scheduler 137/137, fresh Speed 14/14, restarts 52/52.

## Addendum 2026-09-02 — R-342: meat on the lower days (unit 4 of six)

Sam: *"there just isn't much meat on the bones of the sessions ... figure out
why they are so small"*. Measured on the audited year (db534496), split lower
days per phase: Off-season squat 4.0 rows / 11.0 sets, hinge 4.0 / 9.0;
Pre-season 3.5 / 8.2 and 3.4 / 7.8; In-season 4.0 / 9.4 and 3.9 / 9.1. Three
causes: the ladder was main + single-leg + THREE robustness seats (2 × 10
drills); the in-season four-day layout capped those days at 10 sets (WC-031);
and R-334's useful-four counted prehab drills, so every thin day read "met".

Changes: a typed `loaded_lower_accessory` seat third on both split ladders,
filled only by the authored `isolation_lower` strength pool (route ≠ prehab,
so Tib Raises stays out) and dosed 3 × 8–12 by the lower ladder's third
position; WC-031 killed (clause row removed, `SPLIT_LOWER_SET_BUDGET`
deleted, WC-103 on the default budget) and the seat counts toward the set
budget; `rowCountsTowardUsefulStrengthMinimum` excludes prehab-route rows
through one shared `usefulStrengthIdentityCounts`, which the composer's
redundancy pruning also uses; and the robustness seat opens its loaded bench
first while the day has fewer than four loaded rows.

What did not work first: reusing the female `lower_accessory` seat name. That
seat is deliberately low-fatigue and every `isolation_lower`-tagged prehab
drill fills it, so the first regenerated year seated Crab Walks, Bosch Hold
and SL 45° Back Extension Hold on four of five lower days. The typed seat
fixed it. Second, with prehab excluded from the count, two prehab robustness
rows left many days at three loaded rows (unexplained shortfall); the
loaded-first bench fixed that with zero shortfalls remaining.

After, regenerated 52-week years (male / female identical on these numbers):
Off-season squat 5.0 rows / 14.0 (13.2 f) sets, hinge 5.0 / 11.8 (12.4 f);
Pre-season 4.4 / 10.8 and 4.4 / 10.6; In-season 5.0 / 12.4 and 5.0 / 12.0.
Every ordinary day "met"; the 6–7 reduced pre-season days carry typed causes
(deload 6, illness 3, injury 3, kit/availability 1). Restarts 52/52 both.

Guards: minimum-useful 9/9 (three new cells), slot coverage 85/88 (three new
cells; the three reds are inherited and identical at 6f1ae864), scheduler
138/138 (two new cells; the WC-031 cell rewritten to the default budget),
selection 21/21, upper split 29/29, modality 5/5, variety 5/5. Mutation:
old ladder → coverage 83/88; loaded-first bench removed → minimum-useful 7/9
and selection 20/21; prehab counted → minimum-useful 8/9; all three files
restored byte-identical. Inherited and unchanged at the control worktree:
composer B1 50/4, severance 4 reds, generated scheduler fixtures 9/11,
canonical compiler (duplicate-row cell + Section 18 onboarding world),
release gate stopping at test:test-truth (dev E2E seed registry throws),
typecheck gate's five pre-existing file errors.

NOT COVERED: simulator proof of the new rows on the phone (generation-level
proof only); combined `lower` days and full-body shapes (untouched by order);
Section 18 exposure evidence for the new seat beyond the set budget.

## Addendum 2026-09-02 — R-343: pull-ups earn added weight (unit 5 of six)

Sam: the athlete *"would add weight"*; why did the audit not? Cause: the
block boundary's `bodyweight_default` branch wrote nothing until a load had
been recorded, and the audit robot's `typeLoadsForSession` skipped every
zero-load row, so no set (and no reps) was ever logged for a Pull-Up.

Changes: `readBlockHistory` records `topOfRangeCompletedByExercise` from
logged sets (`actualReps >= prescribedRepsMax`, full completion, in-block);
`bodyweightAddedLoadEarned` (bodyweight_plus mode, qualifying block, top of
range, lattice rung above zero) feeds a new `bodyweight_progressed` decision
(BW → BW + 2.5 kg) and `progressedFromOwnHistory` so rotation sees the same
answer; a signed `blockBoundary.addedLoad` sentence (wording is the seat's
under his ruling); the journey helper logs bodyweight rows at bodyweight with
reps and sets no override; the in-block wave keeps a load the
weighted-bodyweight lattice would snap to zero. Journey cell "UNSEEN LIFTS"
admits the new kind (a bodyweight lift never has a recorded LOAD, so it read
as unseen).

Guards: block-two-progression 47/47 (five new cells); mutation: reps proof
dropped → 45/47, suggestion disabled → 44/47, file restored byte-identical.
Ladder 59/59, boot-preservation 20/20, equipment-load-increments 9/9,
strength-progression-inputs 18/18, capacity-laundering 25/25, signed-copy
7/7, athlete-journey 61/64 (identical three reds at b48e53d8),
difficult-missed 87/88 and strength-progression-integration 97/98 (identical
at control), generated-power-delivery exits 1 with zero cells at control too.

Regenerated 52-week male year: Pull-Ups 0,0,0,0 → 2.5 (w5) → 5 (w12) → 7.5
(w16) → 10 (w20) → 12.5 (w24) → 15 (w32) → 17.5 (w35) → 20 (w39) → 22.5
(w44) → 25 (w47) → 27.5 (w51); restarts 52/52.

FINDING (pre-existing, NOT fixed, no owner yet): weeks 30–31, 36–37, 42–43
and 48 — the week before each in-season bye and the bye itself — carry the
ONBOARDING ESTIMATES for every lift (Back Squat 95 / Bench 80 / RDL 77.5
where the athlete is at 100 / 85 / 82.5), so the athlete's progress is
dropped on those weeks and the Pull-Up reads BW. The audited db534496 year
shows the identical 95/80/77.5 on the same weeks; it read as a 5% wave.
Measured by `startingWeightForAthlete` on the audit profile. Candidate
cause: those weeks derive through the in-block engine with an empty
last-performed map (sibling transfer × loadRatio 0 for Pull-Ups), not through
the stored block rows.

NOT COVERED: the app screen for the added-load sentence (generation-level
proof only); a female year for this unit (unit 6 regenerates both).

## Addendum 2026-09-02 — female audit profile (unit 6 of six)

Sam: *"this is your fault for making the audit identical."* Cause: the
preserved driver's `athleteAnswers` gave both athletes 178 cm / 80 kg, squat
1.5× and bench 1.25× bodyweight and a 2 km of 8:00; only the composition
rules (R-130) could differ. Change, in `scripts/programming-remediation-year.cjs`
only (audit tooling, no product law): the female example answers 168 cm /
66 kg, squats around bodyweight, benches less than bodyweight, 2 km 9:00; all
other answers stay shared so a difference is attributable. The profile is
recorded in `female-year.json`.

Regenerated both 52-week years at 070ae519 + this change, 52/52 restarts
each. Week 1 / 12 / 27 / 52 loads — male: Back Squat 72.5 / 92.5 / 100 /
102.5, Bench 62.5 / 77.5 / 85 / 95; female: Back Squat 40 / 52.5 / 60 / 60,
Bench 30 / 40 / 47.5 / 52.5. Pull-Ups climb BW → +27.5 kg for both because
the audit robot completes the top of every range (a real athlete's climb is
her own logs). Split lower days: 4.4–5.0 rows and 10.6–13.2 sets for both.

NOT COVERED: an in-season female squat that does not flatline at 60 (Sam:
"no not yet" on waving); position, age and conditioning-level differences
(kept shared on purpose).
