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
