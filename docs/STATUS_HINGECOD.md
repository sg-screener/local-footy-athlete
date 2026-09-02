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

## Addendum 2026-09-02 — R-344: bye-week weights (approved root cause, built)

Root cause (report approved by Sam): `buildFixtureProjection`
(`src/store/acceptedStateTransaction.ts`) generates its one-week stub with
`microcycleLimit: 1` and no `blockNumber` / `progressionHistory`;
`generateProgram.ts` defaults to block 1 and empty history; the boundary
never runs (`authoringBlockNumber > 1`); rows keep `applyLoadEstimates`'
onboarding estimate. Fires on `full_regeneration` (every bye) and on the
rolling horizon's +1 week after a moved Sunday game. Action receipts from the
year: the bye action's accepted program said Back Squat 97.5 / Pull-Ups BW+15
for 2027-04-26 while its overlay said 95 / BW.

Change: `src/rules/acceptedLoadCarry.ts` (one owner:
`carryOwnAcceptedLoads`, `carryOwnAcceptedLoadsIntoWorkout`); applied to the
projection's single output (the alternatives' workouts, so minimal repair,
full regeneration and the replan's released-day Gunshow offer are all
covered — the first placement on the target microcycle missed the offer,
caught by the journey cell: Face Pull 20 vs accepted 22.5); the readiness
path's inline R-034 carry now calls the owner (same-day first; a lift that
moved days is additionally carried).

Guards: new chained `test:accepted-load-carry` 7/7; R-344 journey cell in
chained `test:fixture-mutation-transaction` (worn block-2 world, bye →
Sunday move → relaunch, visible weeks read against the accepted program,
non-vacuity: ≥3 comparable lifts and ≥1 differing from the estimate).
Mutation: carry removed from the fixture door → journey cell red (Leg Press
120 vs 112.5); moved-day branch removed → pure cell red; both restored.
Suites: fixture-mutation 18/21, boot-preservation 20/20, athlete-journey
61/64, readiness-load-retention 30/32 and temporary-source-facts 0/1
(both identical at f224fae7); inherited and identical at f224fae7: fixture-conditioned-replan 15/34, fixture-identity 1/7,
accepted-state-transactions 20 failures, week-rebuild dies at import
("Fixture rebuild requires an accepted typed fixture effect"), practice-match
cells 4–6 ("I still need your team training days").

Regenerated 52-week years: male weeks 29–31 Back Squat 100 / 100 / 102.5
(was 100 / 95 / 95), 36–37 105 / 105, 42–43 — / 110, 48 112.5; year-end
Back Squat 115 (was 102.5), Bench 100, RDL 97.5; Pull-Ups climb 0 → 27.5 with
no drop. Female weeks 30–31 60 / 62.5, 36–37 65 / 65, 43 70, 48 72.5.
Restarts 52/52 both.

NOT COVERED: the derived read-time sessions outside the fixture door (the
readiness path is covered; other derived builders were not audited); the
phone screen (generation-level proof).

## Addendum 2026-09-02 — final full-year audit at `3b902a70`

Run from a clean detached checkout of `3b902a7013416870b52ec80b94e58af0a9243ad5`
with the untracked base driver copied in (sha bb1dd572…) and the db534496
tools copied and corrected. Fresh 52-week male and female programmes: 52/52
weeks, 364 distinct dates, 52/52 cold restarts each, 0 refused actions.
Accepted-journey acceptance 24/24; focused composition 22/24; strength-budget
selection FAIL on ONE repeat (Seated Calf Raise, week 41, both athletes:
Monday's Lower Squat is the Sunday-game fixture overlay, Wednesday's Lower
Hinge is the stored block week — two composers, two weekly ledgers), plane
PASS, 0 ownership breaches, 0 family repeats, 47 Lower Hinge days with 0
knee-dominant rows. Two 114-page PDFs, every page auto-verified, eight pages
inspected by eye. Outputs: `output/final-full-year-audit-3b902a70/` in the
main checkout and in the audit checkout; report `FINAL_FULL_YEAR_AUDIT.md`
beside them with the measured deltas against db534496 (running 43/87 app
conditioning sessions vs 20/86; real repeat sprints in weeks 16–18, 24–26,
31, 37; five speed templates in rotation; split lower days 4.4–5.0 rows /
10.6–14.0 sets; Pull-Ups BW → +27.5; Back Squat 100 → 115 across the season;
bye-adjacent weeks on the accepted loads; distinct female profile).

Audit-tool mistakes corrected this run: `scripts/four-confirmed-focused-audit.cjs`
counted prehab drills toward the useful-four (second copy of the pre-R-342
rule; corrected here and committed on this branch — the audited checkpoint's
generation code is unchanged); `build_final_pdfs.py` carried the db534496
filename suffix as a literal.

Correction to the R-342 registry wording: the loaded third seat on a Lower
Squat day is Leg Extension, Calf Raises OR Back Extension (15 of 45 days).
R-336 as built refuses only single-leg-hip MOVEMENTS on the squat day, so a
posterior isolation is legal there; "knee-dominant on the squat day" in the
R-342 row overstated the ownership rule.

Findings for a later owner: the week-41 repeat (seed the fixture stub's
weekly selector with the accepted week's identities, as the replan already
does for planner offers); "0 kg" labels on unloaded prehab/midline rows (37
rows, pre-existing); warm-up knee drills on hinge days (unchanged).

## Addendum 2026-09-02 — Sam's batch after the audit (R-345, R-346, R-347; sentence deleted)

**Item 1 (R-345), rebuilt weeks.** Carry owner gains `loads_and_dose` (fixture
door) with `loads` for the readiness door; `acceptedWeekIdentitiesByDay`
travels from `buildFixtureProjection` → `generateProgramLocally` →
`compileCanonicalProgramWeeks` → `composeWeek` (candidate list, prehab and
trunk fallback benches, a new `accepted_on_another_day` substitution cause
and trace rejection) and into the row compiler's later-family selector.
Mains excluded from the seed after measuring: listing them put High Box
Squat at 127.5 kg on every week after a Sunday game (the squat moves day
when Monday becomes recovery). Guards: `test:rebuilt-week-ledger` 2/2 (new,
chained), carry 10/10, fixture journey cell extended (sets, reps, no
cross-day repeat). Mutation: seed ignored → ledger 1/2; dose never carried →
carry 9/10; restored byte-identical.

**Loadable lifts (R-346).** Side Plank, Cossack Squat, Lateral Lunge on the
loadable list; Side Plank off the no-load list. render-truth 30/30;
block-two-progression 47/47 (bodyweight-accessory cell accepts held-or-rung).

**Squat-day seat (R-347).** Three causes found in order: (1) the seat shopped
the isolation pool only → mapping change; (2) the selector admits a compound
only through a compound-direction seat → the seat is one; (3) the block
selector's plane cohort narrowed on the transverse hole → one lift 40/45 →
frontal-only seat context for both the composer cohort and the block
selector. Guards: selection 22/22 (new 50-world cell), coverage 87/90 (two
new cells, three inherited reds). Mutation: seat removed from compound
directions → 21/22.

**Added-load sentence deleted** (Sam: no reader, no purpose). `projectionCopy`
entry, function and list line removed; block-two-progression cell asserts the
loaded-lift sentence never claims a BW row.

**Audit PDF tool:** prints nothing where the app's label is blank (was "0 kg"
from the placeholder); patched in the 3b902a70 audit checkout's tools copy.

Regenerated 52-week years (both): focused 24/24, strength-budget
PASS/PASS/PASS, 0 repeats, 0 posterior on squat-day seats, ten lifts in
rotation on that seat, rebuilt weeks at the accepted squat loads, 52/52
restarts. Suites at baseline: fixture-mutation 18/21, slot-coverage 87/90,
scheduler fixtures 9/11, composer B1 50/4, settings-persistence 178/5,
athlete-journey 61/3, readiness-load-retention 30/2, boot-preservation 20/20,
upper split 29/29, scheduler 138/138, signed-copy 7/7, minimum-useful 9/9.

NOT COVERED: the readiness and injury overlays do not yet state
`acceptedWeekIdentitiesByDay` (their repeat exposure is unmeasured); the phone
screens for BW + 2.5 kg on the three new loadable lifts.

## Addendum 2026-09-02 — "remaining-week deload" (reviewer point 3): robot and test, not the app

Root cause, approved by Sam: R-275 (2026-08-30) says one "Totally cooked" tap
rests THAT DATE only and two tired taps on consecutive dates deload from the
second date through Sunday. Measured on a real in-season week: one cooked tap
→ Monday rest, Tuesday–Friday unchanged; two tired taps Mon+Tue → from Tuesday
3×4–6 becomes 2×4–6 at the same 92.5 kg, accessories to one set, the optional
Gunshow dropped. The audit robot fired one cooked tap and labelled it
"remaining week deload" (the pre-R-275 R-127 semantics), and
`readinessLoadRetentionTests` still encoded R-127 (red since R-275).
Changes: the wrapper relabels week 35 "Totally cooked - rest today" and adds a
Monday+Tuesday tired pair in week 45 so the year exercises the real deload;
the suite now has three scenarios per sex — cooked (that date rest, other
days' sets untouched), tired pair (from the second date ≥2 lifts fewer sets,
first date untouched), illness (reduces) — all holding kilograms: 52/52
(was 30/32). fatigue-sequence 35/35 + plumbing 18/18. No product code.

## Addendum 2026-09-02 — final full-year audit at `773765a4`

Clean detached checkout, base driver copied in, tools copied from the
3b902a70 run. Both athletes 52/52 weeks, 364 dates, 52/52 restarts, 0 refused
actions. Accepted-journey acceptance 24/24 (after correcting the checker's
pre-R-275 "Very tired" label — an audit-tool mistake, committed on this
branch), focused composition 24/24, strength-budget PASS/PASS/PASS (0
repeats, 0 ownership breaches, 16 soft plane findings, 4 accepted injury
exceptions), 46–47 Lower Hinge days per athlete with 0 knee-dominant rows.
Two 114-page PDFs, every page auto-verified, zero suspect pages, zero "0 kg"
labels; pages 60 and 90 inspected by eye. Genuine programming problems in the
measured surfaces: none. Observations for Sam: in-season hinge days average
3.5 hamstring/posterior rows of 5; the two-day tired deload turns Wednesday's
hinge session into Mobility and drops the optional Gunshow; the week box does
not carry the "two tired days in a row" sentence. Outputs:
`output/final-full-year-audit-773765a4/` in the main checkout and the audit
checkout; report `FINAL_FULL_YEAR_AUDIT.md` with the measured deltas against
3b902a70.

## Addendum 2026-09-02 — reviewer points, resolved by ruling (R-348, R-349, R-350)

**R-348 hinge day shape.** `hingeSupportBucket` (typed: hamstrings-only
isolation → `hamstring`; hamstrings-with-glutes/low-back/calves → 
`back_extension`; compounds, glute-only, calf, groin, hip, trunk → none) and
`withoutSpentHingeBuckets` in `composeWeek`, applied before the seat
preferences at both candidate sites. Before: 21/22 in-season hinge days were
RDLs, Hamstring Curl, Back Extension, Nordic Lower, Crab Walks. After: RDLs,
Hamstring Curl, Back Extension, Copenhagen, Crab Walks; 47 hinge days per
athlete, 0 over the cap, 42–43 with one of each bucket. Mutation: cap off →
36 days over → cell red.

**R-349 readiness deload keeps sessions.** `SchedulerReadiness.deloadKeepsSessions`
from `canonicalWeeklyCompiler` (readiness.deloaded), read by the three
fourth-session literals in `weeklyScheduler`; `lowReadiness` itself unchanged
for conditioning. Week 45 now keeps Lower Squat / Upper Pull / Lower Hinge /
Upper Push at half sets, weights held. Scheduler 140/140 (R-349 cell + veto
control); mutation → 139/140.

**R-350 streak row.** `selectActiveProgramModifiers` derives the
`source-fact:fatigue-sequence` constraint from all fatigue reports (active or
expired) and projects it with the signed body from the second date through
Sunday. Readiness suite 58/58 (two board cells); mutation → 56/58.

Both regenerated years: focused 24/24, budget PASS/PASS/PASS, 0 repeats,
52/52 restarts. modifier-lifecycle's five FAILURE lines are identical at
868c4b12 (Section 18 onboarding-world shortfall, inherited).

## Addendum 2026-09-02 — final full-year audit at `71ff5788`

Clean detached checkout, base driver copied in, tools copied from the
773765a4 run unpatched. Both athletes 52/52 weeks, 364 dates, 52/52 restarts,
0 refused actions; acceptance 24/24, focused 24/24, strength-budget
PASS/PASS/PASS, 47 Lower Hinge days per athlete with 0 knee-dominant rows and
0 over the R-348 cap; week 45 keeps four sessions at half sets with the
streak row on the board. Two 114-page PDFs, every page auto-verified, zero
suspect pages; pages 54 and 90 inspected by eye. Genuine programming problems
in the measured surfaces: none. Outputs: `output/final-full-year-audit-71ff5788/`
in the main checkout and the audit checkout; report `FINAL_FULL_YEAR_AUDIT.md`
with the measured deltas against 773765a4.

## 2026-09-02 — R-351: a full-body day beside dedicated days owns one big lift (pile 2 of the red-test report)

**What Sam approved.** "approve 2 3. 4 5" on the root-cause report of the
inherited red suites. Pile 2 = the 3-day athlete refused at onboarding.

**Measured before.** The 3-day, no-club, Off-season athlete every one of
`session-change-durability`, `injury-recomposition`, `modifier-lifecycle`,
`canonical-weekly-compiler`, `injury-fallback-journey` and `compiler-year`
cold-starts through was refused: `Section 18 final-week rejection
(required_minimum_shortfall:main_strength:2)` — expected 3, actual 2, evidence
Mon 2026-07-27 + Wed 2026-07-29 (week 3, mid Off-season). The Friday
`full_body` day composed Single-Leg RDL, Single-Arm DB Floor Press,
Single-Arm Lat Pulldown: three unilateral helpers, no main lift. Cause: the
weekly strength budget (R-317) reserves squat + hinge for the lower day and
all four push/pull planes for the upper day, and a full-body day "reserves
nothing and spends what is unreserved" — nothing was. Bisected between the
census checkpoint `aa2167e2` (accepted) and the branch start `8d68d6dd`
(refused): first bad commit `e05491f7` "Replace repeated strength mains with
weekly budget" (seat `weeklybudget`, 2026-09-01). Same refusal at the control
tree.

**The change (WORKING, `test:three-day-main-seat`, chained in `test:bible`).**
- `weeklyStrengthBudget.ts`: `handVerticalSeatsToAnUnseatedFullBodyDay` —
  when every main seat is reserved and a `full_body` day owns none, the owner
  holding BOTH planes of a pattern hands the vertical plane over
  (`vertical_push`, `vertical_pull`). Order-independent; no-op when any seat is
  unreserved or no full-body day exists.
- `composeWeek.ts` `coverageSlotsForFullBodyDay`: new optional
  `reservedForThisDay` — seats the budget reserved for this day lead the day
  even when another day could supply the plane kit-wise; deduped in the gap
  walk. The composer passes the budget's reservations for the day.
- R-317 unchanged: one seat per week; the upper day still composes its vertical
  rows as supporting work.

**Red first.** 9 of 14 cells red before the change (budget ownership ×5 incl.
the order control, coverage lead ×2, athlete accepted, week-3 full-body
main). 18/18 after. Athlete-visible: weeks 1–4 each have three main-lift days;
the Friday full-body day now reads Single-Leg RDL, Single-Arm DB Floor Press,
Pull-Ups (vertical pull main; the balance shape that week is A, so the
vertical PUSH seat lands on a B-shape week).

**Blast radius (branch after vs branch tip `2b516ff5` before, same trees).**
Revived: session-change-durability (dead → 58/1), injury-recomposition (dead →
179/7), modifier-lifecycle (1/34 all Section-18 refusals → 2/33, now a
different, fixture refusal: "I still need your team training days" on the two
3-day archetypes), canonical-weekly-compiler (died after 1 FAIL → runs to 8
FAILs, all in the athlete-owned-fifth journey), injury-fallback-journey (dead →
4 FAILs), compiler-year (Section 18 → team-days fixture refusal). Unchanged
before/after: weekly-scheduler 9/11 (two bye-fixture cells), composer-severance
7 FAILs + TypeError, full-body-balance chain 7/8 (classification scope), ladder
census 9/14 (R-089 counts), section18-planner throws (conditioning 4 vs 3),
slot-coverage 87/90. Green: weekly-strength-budget 5/5, weekly-strength-variety
5/5, section18-v2 141/141, minimum-useful-strength 9/9,
automatic-weekly-selection 24/24. `test:compile` is red at the control tree
too (sessionBuilder.ts, automaticWeeklyExerciseSelectionTests.ts,
sessionWorkOwnershipJourneyTests.ts — not this unit's files).

**Found in passing, NOT fixed (needs Sam).** The 2-day bodyweight beginner
archetype (`male-2-novice-bodyweight`) is refused at generation: "the week
trains no push" (`required_safe_patterns_present:push`), at the control tree
too. Push-ups is selectable, seated at horizontal_push, legal on an empty kit
and allowed for a beginner — so the refusal is upstream of legality; root
cause still open.

## 2026-09-02 — R-351 amendment: a balance-shape full-body day composes BOTH seats it owns

**Measured after the first R-351 commit.** The 3-day athlete's Friday read
Single-Leg RDL, Single-Arm DB Floor Press, Pull-Ups: the balance shape that
week is A (vertical pull), so the vertical PUSH seat the day owns was only
composed on B-shape weeks. The tracked-lift suite showed the consequence on a
6-day world (lower/upper/full body in weeks 1–2): "Overhead Press repeats
often enough for observations" went red for both sexes (control 6 fails →
branch 8), because the athlete's tracked press now sat in a seat delivered on
alternate weeks. **The change:** `withOwnedSeats(shape, owned)` in
`composeWeek.ts` — a balance-shape day keeps its A/B ladder and ADDS the owned
seats the shape lacks, before the robustness seats. Friday now reads
Single-Leg RDL, Single-Arm DB Floor Press, Pull-Ups, Landmine Press every
week (weeks 1–4 measured). Four new cells in `test:three-day-main-seat`
("the full-body day carries BOTH the vertical push and the vertical pull it
owns", weeks 1–4) — red by the measurement above, 22/22 after.
`test:estimated-1rm` back to the control's 28/6.

## 2026-09-02 — pile 3: the showcase robot seed no longer needs a lift the plan stopped generating

`session-layout-showcase` (dev seed) looked for a generated "Half-Kneeling
Single-Arm Overhead Press" row only to copy its sets and reps into an
`add_exercise` of that long name; the row is no longer generated, the seed
threw "generated source row is missing", and `test:dev-e2e-seeds` (the
release gate's bootstrap through `test:test-truth`) and the writer census
died with it. Now the dose is copied from the named row when present, else
from any generated supporting strength row; the added exercise keeps the long
name (the witness still expects it). `test:dev-e2e-seeds` 104/104 (was a
throw). Test infrastructure, no ruling.

## 2026-09-02 — R-352: a pinned drill wins the last robustness seat once four loaded rows stand (pile 4)

Root cause (mine): R-342 retyped one robustness seat as the loaded seat; the
remaining robustness seat walked to the first uncovered football category
(glute/hip → Crab Walks) and the athlete's pinned Reverse Nordic Curl lost.
`test:exercise-intake` was 912/5 on the branch, 913/0 at the control (the
four "compiler honors Reverse Nordic boundary" cells + the mutation fixture).
**The change:** in `preferMissingFootballCategory`, once the day is not below
its four loaded rows, the legal pinned candidates are the bench (the block
selector honours the pin); below four, loaded work still comes first. 917/0
after; then a control cell per experience × G-day asserts four loaded rows
stand before the pinned drill wherever it lands: 929/0. Law row
`LAW-pinned-drill-wins-the-last-seat`, registry R-352.

## 2026-09-02 — pile 5: stale cells and fixtures re-pinned to the current rulings

| suite | before | cause | what changed | after |
| --- | --- | --- | --- | --- |
| `test:fact-horizon` | 13/1 | T2b asserted the R-035/R-038 seven-day cooked window; R-275 (2026-08-30) supersedes it: cooked rests its own date | cell re-pinned: window = the declaration date, never reaches week 2 | 14/0 |
| `test:session-execution` | 210/2 | source cells pinned `fontSize: 15` (now the constant `SESSION_ROW_TEXT_SIZE = 15`) and `ConditioningPrescriptionCopy` (now `ConditioningCardBody`) | cells accept the constant (and pin its value) and the new body component; the order body → one completion owner → quick actions is still pinned | 212/0 |
| `test:estimated-1rm` | 28/6 | the anchor map judged EVERY push/pull plane against the tracked bench/pull-up; under R-317 each plane is its own seat, so a lawful horizontal-pull main read as "wrong" | map re-pinned to the product's own seat table (`selectedTrackedLiftProgrammingSeat`) | 30/4 — the 4 left are the Bulgarian split squat gap below |
| `test:modifier-lifecycle`, `test:compiler-year`, `test:injury-recomposition` | died / refused | the archetype answers (`compilerYear/catalog.ts`) lacked `teamTrainingStopsOverChristmas`, which the TeamTrainingDays onboarding step requires of a Pre-season athlete with club nights ("I still need your team training days") | catalog answers `false` | modifier-lifecycle green (was 1/34), injury-recomposition ALL GREEN 186, compiler-year runs the years (see remaining) |
| `test:fixture-identity` (+ the lawfulness proof it mirrors) | 1/6, all "onboarding completion REFUSED — your team training days" | same missing answer in the test's own Pre-season world | answer added in both files | 4/3 — the 3 left are real identity cells (a published week vs the derived week), diagnostic rewrite list |
| `test:session-change-durability` | dead → 58/1 | the order probe's helper took the menu's FIRST offer for the swapped-in row, which is the exercise it replaced (no longer on the day, so offered back) | helper takes the first offer that is neither the row nor a named exercise to avoid | ALL GREEN 59 |

**Remaining reds, NOT fixed, each with its cause (needs Sam):**
- **Bodyweight beginner refused ("the week trains no push")** — `undo-reversal` 19/20, `compiler-year` male-2 archetype. Root cause: the weekly selector's `canUse` refuses a compound with no main family (`automaticMainFamilyForExercise` → null) on a MAIN seat; Push-ups has no anchor family, so a bodyweight athlete's push main seat is empty, the seat falls to the prehab rung (Scap Push-Up, slot shoulder_prehab), and the week judge refuses `required_safe_patterns_present:push`. At the control tree too.
- **Bulgarian split squat as the tracked squat lift never lands** — `estimated-1rm` 4 cells. The seat table puts `bulgarian_split_squat` in the `squat` seat, but the selector says it has no main family, so the squat main seat refuses it (`weekly_spacing` in the trace) every week and the single-leg seat takes Reverse Lunges. Two owners disagree on where a tracked single-leg lift sits.
- **`canonical-weekly-compiler` 8 cells (athlete-owned fifth strength session)** — the fifth session lands on Saturday 2026-07-18 and the exercise Add/Remove doors then answer "nothing on your plan" / "no session on 2026-07-18". Not diagnosed.
- **`injury-fallback-journey` 4 cells** — "lower back, limiting" removes no rows from the 3-day lower day (Leg Press, RDLs, Lateral Lunge, Nordic Lower, Calf Raises all stand), and the 3-day world never exercises the single-leg-knee and trunk patterns. Not diagnosed.
- **`compiler-year`: female-3-novice-home fails its year at week 23** ("Accumulated injury/edit/restart lifecycle failed"; the runner prints no detail). Not diagnosed.
- **`session-section-add` 2 cells** — after swapping a day to a Primer session the plan shows one section (`primer`); the cells expect an `optional` section to be offered before the Add. Product-or-test question.
- Inherited and unchanged before/after: `weekly-scheduler` 9/11 (bye fixture cells), `composer-severance` 7 + TypeError, `ladder-wide` 9/14, `slot-coverage` 87/90, `full-body-balance` chain 7/8, `section18-planner` throw, `test:compile` (three files, at the control tree too), guards `law-registry` 13/1, `repo-law-guards` 51/12, `ruling-registry` 5/3 — identical at the control.

## 2026-09-02 — release gate, the year audit at the final checkpoint, and the root causes still open

**Release gate (`npm run test:release`) at `d18ccf85`.** The bootstrap now
runs: test-truth 14/14, release-gate contract 14/14, unrunnable-suite ratchet
5/5, typecheck-gate controls 6/6, dev-e2e seeds 104/104, Maestro preflight
9/9. The gate then stops at its first red unit, `test:compile` — the same five
file/scope pairs (`sessionBuilder.ts` ×3 scopes,
`automaticWeeklyExerciseSelectionTests.ts`, `sessionWorkOwnershipJourneyTests.ts`)
that are red at the control tree and at the branch start; none is this
branch's file. RESULT 1/27 units green — the 26 behind it are unreached, not
red. Until that typecheck debt is paid the gate cannot see the 25 witnesses.

**Open root causes (for Sam — NOT built).**
- **Bodyweight beginner refused ("the week trains no push").** Exact rule:
  `createAutomaticWeeklyExerciseSelector().canUse` — a compound whose
  `automaticMainFamilyForExercise` is null (Push-ups, Bodyweight Squat's
  push cousins) may not take a MAIN seat (`if (!family) return
  !requestedAsMain`). On a bodyweight kit the horizontal-push main seat's
  bench is only such compounds, so the seat is empty, the composer falls to
  the prehab rung (Scap Push-Up, seat `shoulder_prehab`), and the week judge
  refuses `required_safe_patterns_present:push` at generation. Trace: both
  full-body days DECLARE `horizontal_push`; no selection trace is published
  for it. Options: (a) when a main seat's family bench is empty, seat the
  best legal compound as a NON-main row before the prehab rung (Push-ups at
  index 0/1 still classifies as a main lift for §18 by
  `classifyGeneratedWorkoutRow`, so the day still counts); (b) give Push-ups
  a main family — rejected, it would let it spend the weekly press seat
  everywhere; (c) rewrite the archetype — rejected, a real athlete. Tests: a
  new bodyweight-beginner onboarding cell; `undo-reversal` 19/20;
  `compiler-year` male-2 reaching 52/52; the R-317 budget suite unchanged.
- **Bulgarian split squat as the tracked squat lift never lands**
  (`estimated-1rm` 4 cells, red at the control too). The seat table
  (`TRACKED_LIFT_PROGRAMMING_SEAT`) puts `bulgarian_split_squat` in the
  `squat` main seat; the selector says it has no main family, so the squat
  seat refuses it every week (trace: `weekly_spacing`) and High Box Squat is
  taken, while the single-leg seat takes Reverse Lunges. Two owners disagree
  on where a tracked single-leg lift sits. Smallest correction: seat it as
  the tracked lift of the `single_leg_knee` seat (drop the `isMainLift`
  requirement on `requestedTrackedAnchor` for that seat) — needs a ruling.
- **`compiler-year` female-3-novice-home** (Complete beginner, home kit,
  Pre-season, club Tuesday). The runner's own report
  (`outputs/compiler-year-acceptance/result.json`, run BEFORE the owned-seat
  amendment) shows Pre-season weeks 10–12 with `main_strength` 2 of 3 and a
  conditioning planner-target miss (4 vs 3), then week 23 (In-season 8)
  failing `facts_history_unchanged`: a Long-Lever Copenhagen row appears in
  a fixture-replan overlay's Monday. With the amendment her week 1 Friday
  composes Band-Assisted Pull-Up and Seated DB Press as mains (measured);
  the rerun on the final code is recorded below.
- **`canonical-weekly-compiler` athlete-owned-fifth journey (8 cells),
  `injury-fallback-journey` (4), `session-section-add` primer/optional (2)** —
  causes named in the pile-5 table; not diagnosed to a rule.

**Full-year audit at `d18ccf85` (the final checkpoint of this round).** Same
pipeline as the 71ff5788 run: clean worktree `/private/tmp/lfa-final-audit-d18ccf85`,
the preserved driver copied to its `outputs/release-candidate-0bcc3353-rcsteps`
path, `node scripts/programming-remediation-year.cjs --output=$A/run --kit=full`
(1:32), the three analyzers, then the copied tools (evidence, stimulus stats,
hinge scan, PDFs, page QA) and an rsync to
`output/final-full-year-audit-d18ccf85/` in the main checkout.
Results: acceptance verdict PASS; four-confirmed focused audit 24/24 (0
failures); weekly-strength-budget verdict PASS (selection PASS, movement
plane PASS); evidence status COMPLETE_52_WEEK_TECHNICAL_AUDIT_WITH_FINDINGS
with **0 findings**, both athletes 52/52 weeks, 364/364 distinct dates,
52/52 cold restarts; both PDFs built (`LFA_FINAL_FULL_YEAR_{MALE,FEMALE}_d18ccf85.pdf`)
and every page check true, no suspect pages. The audited athletes are 4-day
athletes; no full-body day is in this audit, so R-351 is witnessed by
`test:three-day-main-seat` and the compiler-year archetypes, not here.

**`compiler-year` rerun on the final code (`d18ccf85`).** 6 of 8 archetypes
reach 52/52 (male-3-experienced-gym, female-4, male-5, female-5-home, male-6,
female-6). Still failing: male-2-novice-bodyweight (the push refusal above)
and female-3-novice-home — Pre-season weeks 10–12 count 2 of 3 main-strength
days (Wed + Fri; the Monday carries no main lift in those weeks — week 1's
Monday does), then week 23 (In-season 8) fails `facts_history_unchanged` /
`facts_lifecycle_complete` because a fixture-replan overlay adds a
Long-Lever Copenhagen row to the Monday. Neither is diagnosed to a rule yet.

## 2026-09-02 (later) — Sam's answers on the three open items

**1. Bodyweight-only is not a path (R-230, restated).** Sam: "there is no
way to do bodyweight only — the only way is a holiday 'do what ya can'
program." So the compiler-year archetype `male-2-novice-bodyweight` was a
world the equipment step refuses; the push refusal it produced was never an
athlete-reachable defect and the selector rule I named (a family-less
compound may not take a main seat) stands. Fixture re-pinned:
`male-2-novice-home` (home kit: dumbbells, bands, bench, pull-up bar); the
one test naming the old id follows it. `test:undo-reversal` 26/2 → 28/0.
Note added under R-230 in the registry. The `'bodyweight'` catalog option
stays for the away-window worlds other suites build.

**2. R-353 — the tracked Bulgarian split squat sits in the single-leg knee
seat (approved: "yep fix that").** Root cause as reported: the seat table
put it in the squat MAIN seat and the weekly selector refuses a compound
with no main family there, so it was refused every week (High Box Squat
taken) while the single-leg seat took Reverse Lunges. Change:
`TRACKED_LIFT_PROGRAMMING_SEAT.bulgarian_split_squat = 'single_leg_knee'`
(type widened); the composer maps the `single_leg_knee` seat to the squat
tracked choice and requests the tracked anchor there without `isMainLift`.
`test:estimated-1rm` 30/4 → 34/0 (the four Bulgarian/alternatives cells were
the red-first). Law row `LAW-tracked-single-leg-squat-sits-in-the-single-leg-seat`.

**3. "What's wrong with that?" — the beginner home-gym player, traced.**
Walked her through the runner's own steps (cold start, weekly rollover,
followed weeks, then the runner's week-10 report: a moderate KNEE injury).
- Weeks 10–12: the injury pauses every leg row on her Monday (Bodyweight
  Squat, Glute Bridge, Reverse Lunges, Single-Leg RDL, Groin Squeeze, Broad
  Jumps) and the day becomes "Continuous Aerobic" with a Single-Arm DB Row,
  McGill Sit Up and Side Plank. The week checker then counts two
  app-programmed main-strength days (Wed, Fri) against the Pre-season three
  and records a blocking `required_minimum_shortfall` — an injury week
  judged by the healthy contract, with no authorised reduction recorded.
  Two things the athlete would notice: Push-ups are inserted into her
  Wednesday MOBILITY session (weeks 10 and 12), and Friday stacks three
  presses (DB Bench Press, Seated DB Press, Push-ups as a main) in week 11 —
  the injury filler picks upper work without reading what the week already
  carries.
- Week 23 (In-season 8): the lifecycle check removes a session, records the
  week's Monday+Tuesday as history, reports a SHOULDER injury on the
  Wednesday, and asserts history unchanged. Monday 2026-12-21 gained a
  Long-Lever Copenhagen row from a `fixture-replan … week-overlay` — the
  injury rebuild redid the whole fixture week including the already-done
  Monday. Athlete-visible: a session you did on Monday changes after you
  report a shoulder on Wednesday.
- New after re-pinning the 2-day archetype to a home kit: `male-2-novice-home`
  stops at week 7 (Off-season 8) in the same lifecycle check; detail below
  once the rerun's report is read.
Neither is built; both are for Sam's approval.

**Blast radius after R-353 and the archetype re-pin (branch vs the branch tip
`2b516ff5` before this round).** Green: three-day-main-seat 22/22,
weekly-strength-budget 5/5, weekly-strength-variety 5/5,
automatic-weekly-selection 24/24, minimum-useful-strength 9/9,
block-two-progression 47/47, section18-v2 141/141, accepted-load-carry 10/10,
readiness-load-retention 58/58, session-change-durability 59/59, undo-reversal
28/28, estimated-1rm chain 34/34 + 181 + 48 + 37 + 54. Unchanged inherited
reds: full-body-balance chain 7/8, slot-coverage 87/90, composer-severance,
athlete-journey 61/3 (rewrite list). `test:exercise-intake`: the first
section 929/0; its later "Authored cue + video" section runs now that the
first is green and shows the branch start's two reds (Tib Raises and
Copenhagen Plank (Half) load handling, at `8d68d6dd` too) plus one of mine —
two comments used the retired bare name "Copenhagen Plank"; corrected to the
real name, back to the inherited 54/56.

**`compiler-year` on the final code:** 6 of 8 archetypes reach 52/52. The
two that stop are ONE bug: `male-2-novice-home` at week 7 (Off-season 8) and
`female-3-novice-home` at week 23 (In-season 8) both fail the lifecycle's
`history_unchanged` — after the runner reports an injury on the Wednesday,
the already-done Monday gains a row from a `week-overlay` rebuild (Copenhagen
Plank (Half) for him, Long-Lever Copenhagen for her). The push refusal is
gone with the archetype re-pin.

## 2026-09-02 (later) — R-354 + R-355: injury reports leave done days alone; injured limited-kit sessions double up

**Sam:** "approve the past-session bug and the filler … yes doubling".
REGISTRY-GREP before the doubling question: R-334 (no repeat filler for a
HEALTHY session; injury is a typed cause for a shorter one), R-317, R-230,
R-083, the 2026-08-20 "Breathing Reset never inside Strength" and 2026-08-27
injury over-restriction rulings — none ruled the injured, limited-kit case.

**R-354 root cause, traced by logging every compile during the report.** The
source-fact rebuild pins the done days correctly (boundary = the fact's first
shaped date; Monday came out unchanged). The extra row was added AFTER it:
`compileCanonicalInjuryWeek` runs `completeWeeklyLowerBodyFrontal` over the
whole week, and that pass walks every strength date from the first — Monday —
and appends a groin/frontal row (Copenhagen Plank (Half) for the 2-day
novice, Long-Lever Copenhagen for the 3-day beginner). **Change:**
`compileCanonicalInjuryWeek` takes `historyBeforeISO`; the source-fact
compiler passes the newest injury's `firstShapedDateInWeek`; the completion
pass takes `placeableFromISO` and never places before it. The fixture replan's
own call of the completion pass is untouched (it carries its own remainder).

**R-355 root cause.** `deriveInjurySessionAdjustment` ran on Mobility
sessions (a paused Crab Hold → Push-ups added); `chooseInjurySessionAdditions`
read only the WEEK for duplicates, so a day with two presses got a third, and
on limited kit the unused bench emptied and only midline was offered.
**Change:** no additions on Mobility/Recovery sessions; the day's pattern is
capped at two rows; when the unused compound bench is empty, a safe compound
the rest of the week already carries is repeated (never a paused row, a row
already on the day, or an athlete exclusion) — the weekly once-per-identity
rule is deliberately not asked for that repeat.

**Red first (control worktree at `4712a17a`, same test file):** 12/16 —
R-354 "Monday and Tuesday byte-identical" red (Monday gained Copenhagen Plank
(Half)); "Mobility session receives no strength filler" red (Push-ups);
"repeats a safe compound" red (McGill Sit Up, Side Plank, Dead Bug only);
the third-press cell red. After: 16/16 (`test:injury-limited-kit`, chained).

**Blast radius (branch vs `4712a17a`).** Identical: injury-session-adjustment
51/54 (3 inherited), session-change-sequence 18/4, injury-compiler-preview
(running-budget cells), session-injury-review [5] ×2, canonical-weekly-compiler
55 → 54 failed. Improved: injury-fallback-journey 4 → 2 fails (the "lower
back, limiting" pair went green; the two coverage cells remain). Green:
injury-recomposition 186, modifier-lifecycle, session-change-durability 59,
three-day-main-seat 22, readiness-load-retention 58, fact-horizon 14,
movement-planes 13/13, guided-injury-totality 50, injury-latest-severity 48.

**`compiler-year` on the final code: ALL EIGHT archetypes reach 52/52.**
394 of 416 athlete-weeks green; the 22 red weeks are week-checker findings
inside measured weeks, not stops: 12× conditioning planner target 4 vs 3, 3×
conditioning minimum 3 vs 2, 2× main-strength planner target 3 vs 2 (the
injured weeks), 2× pull main lift lost under a restriction, 1× sprint
high-speed maximum, 4× energy-session content. Spread over five archetypes
(incl. female-4 weeks 2 and 41, male-5 weeks 4 and 41 — worlds this branch
never touched). Not this unit's; listed for the next round.

## 2026-09-02 (later) — task 2: the release gate's type step is green; the gate now runs its units

**Type-checker debt (Sam: "do 2 then 1").** Three files, none this branch's:
`sessionBuilder.ts` compared a sprint-narrowed quality with `cod_decel`
(unreachable there; the combined-COD warm-up case is answered on the general
path — behaviour unchanged, `speed-template-variety` 5/5, `session-execution`
212/212); `automaticWeeklyExerciseSelectionTests` stub typed as `Exercise`;
`sessionWorkOwnershipJourneyTests` find typed to the exercise member of the
template-item union; my own `injuryLimitedKitTests` casts through `unknown`.
`test:compile`: TOTAL 0 error(s), PASSED.

**The gate then ran on and stopped at unit 3 (`test:exercise-intake`).** Two
inherited "keeps defined load handling" cells (Tib Raises, Copenhagen Plank
(Half)) accepted only two of the four load-handling shapes; re-pinned to the
one owner `resolveLoadAuthority` (both are authored "unloaded" prehab):
56/56. That let the chain reach `generatedPowerDeliveryTests` for the first
time (it died at onboarding on the team-days answer before this round): its
club-night cell built a bodyweight world its own comment says is the
full-gym world (R-230) — re-pinned: 48/48. The whole intake chain is green.

**Every gate unit run individually (30 current-contract units): 23 green, 7
red.** `compiler-year` (the 22 week findings below) and
`chained-mutation-continuity` (3 failures, the same findings: male-5 week 4
pull main, female-3 week 9 conditioning) are ONE cause. `weekly-writer-zero`:
"review names an absent capability:
canonicalWeeklyAthleteEditCompiler.ts#reduceContractForRequest" — a review
inventory naming a function that no longer exists. `canonical-weekly-compiler`
54 (athlete-owned fifth journey), `injury-fallback-journey` 2 (coverage
cells), `slot-coverage` 3, `session-section-add` 2 — inherited, unchanged.

**`test:weekly-writer-zero` (gate unit).** Three review rows named
capabilities the census no longer discovers (`reduceContractForRequest`,
`visibleWorkoutIdentity#strengthRows/#conditioningRows`) — removed; the
"absent capability" errors are gone. The unit stays red on its own zero-proof:
DENOMINATOR 1162 capability owners, 1015 reviewed, **147 unresolved** →
"ZERO NOT PROVEN". Each unresolved owner needs an explicit review line in
`scripts/weekly-writer-ownership.json`; this branch's new functions are among
them. Not a fix this seat can make silently — reported.

## 2026-09-02 (later) — task 1, R-356: the five week-checker notes, all built ("yep do all")

Each note was reproduced through the real doors on the archetype worlds
(walk with phase shifts, report / fixture add / move, then the same
evaluation the year runner makes), traced to its rule, then fixed:

1. **Injury conditioning allowance.** The safety policy recorded reductions
   for sprint and main strength under a lower-body restriction, never for
   conditioning — and a moderate knee (running trigger) sets no lower-body
   restriction at all; the withdrawal happens in the exposure filter. Change:
   the source-fact compiler counts core-conditioning credits the injury
   withdrew (accepted day carried a `core` block; the day as the athlete sees
   it after the read-time filter does not) and records them through the new
   `recordInjuryConditioningWithdrawal` as an `injury_restriction` reduction
   of `conditioning_core_frequency`. First attempt at the policy level was
   removed (one owner). Measured: female-3 Pre-season 10 → reduction 4→3, no
   finding; male-2 Off-season 10 → 4→2 (two sessions withdrawn), no finding.
2. **Second upper day.** `createWeeklyStrengthBudget`: "first claim wins" left
   a second dedicated upper day with no seat (a practice match on a five-day
   home week packed four mains into Wednesday). The second upper day takes
   the vertical planes. Both upper days now carry mains; no finding.
3. **Lone strength day.** The extra-game rebuild's one full-body coverage day
   declared squat, hinge, single-leg pair, push, pull — and the four-compound
   ceiling was reached before the pull seat (gap "already_on_day"). The
   item-1 ledger was NOT the cause (verified: it was already empty). Change:
   `coverageSlotsForFullBodyDay` seats the push/pull pair before the
   single-leg pair when no other day supplies any upper seat. The rebuilt
   day now reads Leg Press, RDLs, Bench Press, Single-Arm DB Row as mains; no
   finding. (Also kept: the fixture stub's item-1 ledger is now scoped by a
   rehearsal compile to days the rebuilt week still trains as strength days —
   a game-day club night no longer pins its lifts "elsewhere".)
4. **Sprint exposures.** `appSprintNeedPermitted` counted DISTINCT DAYS of club
   nights + games against the in-season maximum; a game moved onto a club
   night counted once while the §18 ledger counts both. Exposures are counted
   now; the moved-game week carries no app sprint and no breach.
5. **Emptied conditioning card.** Two sites: `compileInjuryConditioning` (fold)
   and `compileCanonicalDayConstraints` (read-time exposure filter) both
   collapse a Conditioning day left with nothing but its warm-up to the honest
   rest shell (`isEmptiedConditioningShell`, one predicate). The two-day
   novice's Saturday "Aerobic Conditioning" card is a rest day.

**Red first** at `4712a17a`: `test:week-checker-allowances` 19/32 (every
numbered cell red, controls green). After: 32/32. Chained in `test:bible`.
Law row `LAW-week-checker-judges-what-the-app-could-build`, registry R-356.

**Blast radius after R-356 (branch vs `4712a17a`).** `test:compile` PASSED
(0 errors). Green: weekly-strength-budget 5/5, three-day-main-seat 22/22,
injury-limited-kit 16/16, week-checker-allowances 32/32, section18-v2
141/141, fixture-mutation-transaction 21/21, injury-recomposition 186,
exercise-intake chain green, session-change-durability 59,
readiness-load-retention 58, modifier-lifecycle, chained-mutation-continuity
927/0 (was 924/3 — the same three findings), deload-law 78/78,
block-two-progression 47/47, accepted-load-carry 10/10. Unchanged inherited:
weekly-scheduler 9/11, ladder-wide 9/14, composer-severance, slot-coverage
87/90, full-body-balance 7/8, injury-fallback-journey 2 coverage cells.
**`compiler-year`: 416 green / 416 reached / 416 required athlete-weeks (8
athletes × 52).** The one failure key left is the writer-ownership census
prerequisite (151/1163 unresolved candidate owners; this branch's new
functions are among them), the same job the release gate's census unit
needs.

**Correction the same day.** The final-checkpoint year audit at `cee3c49e`
FAILED its repeat checks: week 22, both athletes, Barbell Row ×2 and
Pull-Ups ×2 (`repeatedExactExerciseBreaches` 4, `repeatedMainFamilyBreaches`
4). Cause: R-356 fix 3's rehearsal-scoped item-1 ledger let a fixture
rebuild repeat the KEPT day's lifts on the rebuilt day. That variant was not
the fix for the lone-day pull main (the coverage order was; the M5 world
stays green without it) and is reverted; the ledger seeds from every accepted
day again. `test:week-checker-allowances` 32/32 after the revert. The audit
is rerun at the corrected tip below.

**Second correction, same day.** The rerun audit at `886d14f9` still repeated
Barbell Row and Pull-Ups in week 22 — so the ledger was innocent. The real
cause was R-355's doubling rung: week 22 carries the driver's calf injury
(6/10) on a FULL gym; every upper main seat was already spent for the week,
the weekly selector refused the unused compounds as mains, and the repeat
rung then doubled the week's own Barbell Row and Pull-Ups onto the injured
days. Doubling now fires only when the kit offers no unused legal compound
at all (`compounds.length === 0`), which is what "limited equipment" means;
a spent seat budget is not limited kit. `test:injury-limited-kit` 16/16 and
`test:week-checker-allowances` 32/32 after the gate. The audit is rerun once
more below.

**Third correction, and the honest picture.** With doubling gated, the
year runner fell to 363/416: `required_minimum_shortfall:main_strength 3 vs
2` on every full-gym knee week. Probed the same knee week on the pre-change
tree (`4712a17a`) and the tip: IDENTICAL rows and the identical finding — an
injured lower day carries no main lift, and the 416/416 earlier in the day
was the repeat rung duplicating a lift onto it. So the allowance is the
answer, as for conditioning: `recordInjuryWithdrawals` now records
`main_strength_frequency` (injury_restriction) for each strength day whose
every main lift the injury paused, counted as the athlete sees the week. New
cell on the full-gym three-day player's knee week (allowance recorded, no
shortfall, control: the lower day really lost its mains). Suite 38/38.
`test:compile` PASSED. Year audit at `4e2ebbf2`: acceptance PASS, focused
24/24, budget PASS (selection PASS, plane PASS). Reruns of the year runner
and the audit at this tip are recorded below.
