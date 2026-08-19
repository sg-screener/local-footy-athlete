# STATUS — seat `finish-programming`

Opened 2026-08-19 at `20cb1422`. This file has one writer: `finish-programming`.

## Mission

Finish the athlete programming engine in this order:

1. scheduler and fixture/game-proximity behaviour;
2. conditioning and power delivery;
3. travel and zero-equipment programming.

Owned product surface: `src/rules/**`, `src/data/**`,
`src/services/api/generateProgram.ts`, programming/composer/scheduler/
conditioning modules under `src/utils`, and programming-only tests/scripts.

## Acceptance for every slice

- A real generated athlete world reaches the behaviour.
- A named guard fails when the behaviour is mutated.
- Generated-world and refusal censuses are compared in explicit units.
- Real athlete weeks are printed and inspected.
- The finished week is authored only by the scheduler/composer/specialists;
  the Section 18 boundary accepts or refuses and never repairs.
- Existing good behaviour is preserved.

## Starting authority and ownership

- Base is the requested current-main checkpoint `20cb1422`.
- `src/rules/weeklyScheduler.ts` owns which days carry work, spacing and
  fixture proximity.
- `src/rules/composeWeek.ts` plus specialists own what fills each authored day.
- `src/rules/section18AcceptedWeekGateway.ts` is validation-only.
- Deleted legacy repair, safety-rewrite and read-time authoring stacks will not
  be rebuilt.

## Design comparison before the first code change

1. Incremental: patch the first failed fixture coordinate at its caller. This is
   smaller, but would recreate per-case scheduling authority and repeat the
   deleted repair-stack shape.
2. Owner-first: express all fixture-relative legality and placement in the
   existing weekly scheduler, then have generation consume that one schedule.
   This removes the class of route-specific G-relative disagreement.

Chosen: option 2, using the already-established owner rather than introducing a
new scheduler or compatibility path.

## Starting findings from the demolition/rebuild records

- G+1/G-1/G-2, upper-body stacking inside 48 hours of a game, unavailable-date
  clearing, freed-fixture filling and session-cap choice are explicitly on the
  scheduler rebuild list.
- Power allowance/delivery is explicitly on the specialist/composer rebuild
  list. The demolition measurement found 96 authorised generated worlds and 0
  receiving power after the obsolete trimmer was deleted.
- Conditioning placement on empty days, running-cap enforcement and off-feet
  substitution belong at conditioning authoring time.
- Away filtering is a current input concern; away substitution is composer work.
- Equipment is resolved per day by the composer. No session-side exercise
  selector or read-time equipment rewriter may be restored.

## Baseline measurement at `20cb1422`

- Scheduler instrument: 96 of 96 behavioural cells green; 44 contract clauses,
  44 guarded, 0 unguarded.
- Generated-world census: 180 generation occurrences across 90 distinct athlete
  setups (dedup key `phase/days/club-state/kit`); 140 occurrences built and 40
  refused; 20 distinct setups refused.
- Refusal census: 3 typed finding families. The 40 occurrences / 20 distinct
  refusals split 20/10 `main_strength_planner_selected_target`, 16/8
  `hard_day_permitted_maximum+main_strength_permitted_maximum`, and 4/2
  `hard_day_permitted_maximum`.
- Power trace: the sampled real world is power-eligible, but its
  `plannerSelectedWeeklyBudget` is null and it delivers zero power rows.
- Printer: 8 athlete pages written, 2 scenarios refused, 0 missing-copy ids and
  0 printer findings. The explicit bye page incorrectly showed Saturday as Game
  Day; this was the first material target.

## Slice 1 — live target-week fixture scheduling

### First-run finding

`targetFixtureDay` reached `onboardingToCoachingInputs`, but both production
scheduler calls rebuilt `gameDay` from the profile. A target-week `null` (bye)
therefore became the profile's recurring Saturday game again. After that was
guarded and corrected, the next real output exposed the adjacent rebuild item:
Saturday was released by the availability owner but the scheduler ignored its
release provenance, put the hard bye replacement on Monday, and left Saturday
empty.

### Owner-side correction

- `weeklySchedulerInputsFrom` now consumes the target week's accepted fixture
  override and canonical effective availability. Undefined still means the
  recurring profile default; null remains an explicit bye.
- The override is scoped to the target microcycle. Later weeks in the same
  generated block retain the recurring profile fixture.
- Released-game/practice-match/bye provenance is translated into typed
  `releasedFixtureDays`. In a healthy no-game week the scheduler prefers that
  day for the hard replacement exposure; no fixture repair or projection layer
  authors it.
- The paper-phone printer now feeds its calendar marks through the same
  fixture-conditioned availability owner used by production rebuilds.

### Guard and inspected week

- `test:weekly-scheduler` now includes the production generated-world suite
  `generatedSchedulerFixtureTests.ts`: recurring default, explicit bye, released
  availability, hard Saturday replacement, moved fixture replacement, and
  later-week recurrence are all guarded. A second no-club bye world proves the
  released-day preference independently of strength placement. The new suite is
  8 of 8 green; the
  existing scheduler remains 96 of 96 and conditioning authorship remains 42
  of 42.
- Printed bye: Monday lower strength; Tuesday and Thursday club; Saturday lower
  strength plus `Classic 4×4` (`vo2`, 4 x 4 minutes hard / 3 minutes easy);
  Wednesday, Friday and Sunday rest. No Saturday game remains.
- Post-slice generated/refusal censuses are byte-for-unit unchanged: 180
  generation occurrences, 90 distinct setups, 140 built, 40 refused, 20
  distinct refusals, same three finding families and splits.
- A standalone `tsc` attempt is not a valid repo instrument in this worktree:
  dependencies live in the main checkout and TypeScript cannot resolve Expo or
  React types through `NODE_PATH`. Behavioural suites run with the shared
  dependency binaries and are the recorded instruments.

### Mutation proof

Run against checkpoint `3ce32c6f`, then restored with only the strengthened
guard remaining:

1. Removing the target fixture from both production scheduler calls reddened 5
   of 7 cells: the bye resurrected Saturday Game, the move stayed on Saturday,
   and target-week scope failed.
2. Removing effective target-week availability from both calls reddened exactly
   the two released-day cells while fixture identity stayed green.
3. Removing released-day priority initially survived because the club-world's
   strength placement independently used Saturday. That mutation had missed its
   subject, so a no-club real generated bye was added. Re-running the same
   mutation then reddened exactly that cell: Saturday became Rest while the hard
   exposure moved elsewhere.

## Slice 1b — every target-week fixture

### First-run findings

- The availability owner already represented every accepted target-week
  fixture, but `weeklySchedulerInputs` collapsed that set to one `gameDay`.
  Every proximity, hard-day and conditioning calculation therefore saw only the
  first game.
- Once both games reached the scheduler, a Wednesday/Saturday week was refused
  before the existing reduction ladder could run: the early check required two
  legal days even though the ladder expressly supports one lawful session.
- Once the scheduler built the reduced Monday-upper week, §18 restored its
  generic squat/hinge requirement and rejected the scheduler-owned purpose set.
  The scheduler-derived contract now declares the completed schedule's actual
  pattern intentions; §18 still validates that set but no longer acts as an
  independent planner.

### Owner-side correction and real world

- The live input is now `gameDays`, with the scalar retained only as a legacy
  pure-caller fallback. Scheduler anchors, cyclic proximity, legality, hard-day
  accounting, running, sprint placement, conditioning and power eligibility all
  consume the complete set.
- The smallest approved layout is still two access days. A one-access-day
  athlete still refuses. An athlete with an approved access pattern compressed
  to one legal day by fixtures can now reach the already-approved reduction
  ladder; zero legal days still refuses.
- Real generated week, marks Wednesday 12 August and Saturday 15 August 2026 as
  games: Monday carries the sole upper-strength session; Wednesday and Saturday
  are both Game Day; Tuesday, Thursday, Friday and Sunday carry no strength.
  The generated week publishes rather than being rejected for lower patterns
  the scheduler deliberately omitted for fixture freshness.
- `test:weekly-scheduler` is 96 of 96 and the generated fixture suite is now 10
  of 10. The multiple-fixture cell requires the exact two game anchors and the
  exact non-vacuous Monday strength day.

### Mutation proof

Run against checkpoint `14934d13`, then restored byte-identical:

1. Truncating `proposedFixtures` to its first entry reddened exactly both
   multiple-fixture cells: the authored games became `[Wednesday]` instead of
   `[Wednesday, Saturday]`, and strength expanded from `[Monday]` to
   `[Sunday, Monday, Friday, Saturday]`.
2. Removing the scheduler-declared required-pattern set made the real generated
   world throw `required_safe_patterns_present:squat|hinge` before either cell
   could run. This proves the former independent-planner rejection is live and
   that the scheduler-derived contract is what prevents it.

## Slice 1c — dated cross-week game proximity

- Explicit target-week fixture resolution now carries dated actual fixtures plus
  the adjacent prior/next recurring-profile fixtures. The scheduler calculates
  G+1/G-1/G-2 from those dates; unresolved ordinary weeks retain the existing
  recurring-weekday path.
- Real generated Sunday-bye week: no Game Day; Monday is recovery from the prior
  Sunday fixture; strength is Tuesday, Thursday and Sunday; conditioning is
  Friday and Saturday. This separates “no fixture in this week” from “no nearby
  fixture”.
- Scheduler remains 96 of 96; generated fixture suite is 11 of 11.
- Mutation proof against `42007ea7`: disabling the dated-proximity branch
  reddened exactly the Sunday-bye G+1 cell (10 of 11); the tree was restored
  byte-identical.

## NOT COVERED — scheduler/game slice complete

- Power delivery remains zero in the measured eligible world.
- Travel and zero-equipment output have only been baseline-printed/censused; no
  owned gap in those slices has yet been changed.
- No physical iPhone acceptance is claimed.

Agent: finish-programming

## Slice 2a — composer-side power delivery

### First-run findings

- The scheduler and power specialist authored primer candidates, but the
  scheduler-derived §18 contract left `plannerSelectedWeeklyBudget` null. The
  composer correctly treated the missing allowance as zero, producing the
  measured 0 delivered rows despite eligible worlds.
- Repairing the existing phase-aware generator guard exposed two stale phase
  contracts before it reached power: early Off-season offered four optional
  strength sessions although the approved range is 2–3; mid Off-season still
  required sprinting in weeks 3–4 although R-079 begins it only after week 4.
- The paper-phone run then found a live projection gap invisible to the internal
  census: stored power rows produced a named `Power` block with no exercise.
- Once row projection was restored, five club-night worlds still hid the power
  row and every same-day strength row. `getTeamTrainingWorkoutState` let an exact
  `Team Training` title overrule typed composer row evidence and treated the
  entire workout as the club's. Typed athlete rows now outrank that stale title;
  untyped legacy team-only shells retain their ingress cleanup.

### Owner-side correction and real worlds

- `schedulerExposureContract` now receives the number of candidates already
  selected by the power specialist and stamps the smaller of that count and the
  phase-owned preferred maximum. No scheduler power count and no §18 trimming
  pass were added.
- `materialiseComposedWeek` receives the positive allowance through the existing
  connector and places the selected rows ahead of real strength content.
- The projection now carries the component owner's `powerRows` into the visible
  part instead of declaring that population rowless.
- Real pre-season bodyweight world: budget 2; Lateral Bounds on Monday and
  Explosive Push-up on Tuesday; both have athlete strength content and neither is
  Game, G-1 or G+1.
- Real club-night world: Tuesday visibly prints Explosive Push-up, Barbell Row,
  Lat Pulldown and Band Pull-Apart, followed by the Team Training appointment.

### Measurements and printed coaching output

- `test:power-primer-policy`: existing policy/deload suite 58 of 58 and live
  delivery suite 7 of 7.
- `test:weekly-scheduler`: scheduler 96 of 96; fixture suite 11 of 11.
- Power census: 180 generation occurrences / 90 distinct athlete setups; 144
  built, 36 refused; 442 delivered sessions. 100 worlds were authorised for
  power, all 100 received it, 200 power rows were delivered, and the typed
  authorised-but-undelivered map is empty. The demolition baseline was 0 rows
  across 96 authorised worlds.
- Refusal census improved from 140 built / 40 refused to 144 / 36. Remaining
  typed families: 20 occurrences / 10 distinct setups at
  `main_strength_planner_selected_target`; 12 / 6 at
  `hard_day_permitted_maximum`; 4 / 4 at the combined hard-day and
  main-strength maximum.
- `print:week`: 8 real weeks written, 0 missing-copy gaps and 0 detected output
  findings after projection repair. Two scenarios still refuse generation and
  remain printed as refusals rather than being counted as weeks that built.

### Verification strategy

- The live guard enters `generateProgramLocally`, checks the contract budget,
  stored rows, role-filtered strength content, game-proximity fence, canonical
  visible projection, and a real combined club-night projection. A future defect
  that restores internal counts but loses the row on the athlete surface is red.
- The existing phase-aware guard now dates its requested phase week directly:
  phase week 7 is the normal comparator and the scheduled phase-week-8 deload is
  the deload world. It no longer generates unrelated intermediate weeks merely
  to reach the subject.

### Mutation proof

Run against checkpoint `01fa17eb`, with every production mutation restored
byte-identical before the final green run:

1. Forcing the selected allowance to zero reddened the positive-budget cell and
   the real club-night delivery cell.
2. Removing the phase cap raised the fixture-world budget from 2 to 3 and the
   non-vacuous four-strength-day world's budget/rows from 2 to 4; exactly both
   cap cells reddened.
3. Removing the visible power-row bridge reddened exactly the two athlete-surface
   cells; contract and stored delivery remained green.
4. Restoring title-based team-only precedence reddened exactly the club-night
   cell: its visible parts became an empty Power block plus Team Training and
   the typed strength rows disappeared.
5. Removing the early-Off-season three-session cap made the phase-week-1 world
   refuse at `main_strength_permitted_maximum`, expected 3 / actual 4.
6. Restoring the stale mid-Off-season sprint requirement made the phase-week-4
   world refuse at `sprint_high_speed_required_minimum`, expected 1 / actual 0.

## NOT COVERED — power slice complete

- The two explicit print refusals and the remaining 36 corpus refusals are not
  claimed fixed; they feed the conditioning/travel work still to come.
- No physical iPhone acceptance is claimed.

Agent: finish-programming

## Slice 2b — conditioning specialist remeasurement

### Real generated-world census

- `scripts/probe-conditioning-census.ts` generated 198 distinct phase/week/day/
  club/fixture worlds at phase weeks 1, 3 and 6 and inspected the final workouts
  returned by `generateProgramLocally`, not scheduler intent.
- 196 of 198 worlds built. This improves the conditioning owner's last recorded
  185 of 198 without adding a repair layer. The two remaining refusals are both
  early-Off-season optional weeks with five selected gym days plus a game and
  one or two club nights; they are refusal inputs for the travel/equipment slice,
  not lost conditioning sessions.
- Zero authored conditioning categories reached the athlete without a material
  session. The final weeks delivered all four live categories:
  `aerobic_base`, `tempo`, `vo2` and `sprint`.
- Early Off-season phase week 1 delivered zero conditioning in every built
  world, as the optional-block law allows. Mid Off-season delivered only
  easy/moderate aerobic work. Late Off-season delivered hard work in 16 worlds
  and sprint in 8; game/team-load and three-day feasibility shapes lawfully used
  the contract's permitted range without inventing a required hard-app minimum.
- The 180-occurrence / 90-distinct-setup refusal census is unchanged from the
  immediately preceding power checkpoint: 144 built and 36 refused. No
  conditioning code was changed to make a refusal disappear.

### Printed coaching output inspected

- The real later-Off-season no-club week prints four different conditioning
  jobs rather than internal category counts: Monday `Steady Blocks`, Tuesday
  `Classic 4x4`, Wednesday `30:30 Controlled Tempo Blocks`, and Sunday
  `10m Acceleration`.
- The real in-season two-team-night week does not add a hidden hard conditioning
  session around the Saturday game. The team anchors remain the conditioning
  load and the printed app work stays freshness-compatible.

### Guards and liveness

- Green at this checkpoint: phase authorship 42/42, rollover response 21/21,
  Off-season deload conditioning 10/10, template equality 95/95, dose ingress
  12/12, conditioning balance 11/11, and retired progression input 8/8.
- Current-turn mutation: replaced the specialist's phase-owned hard-quality
  selection with `null`. `test:conditioning-phase-authorship` fell to 35/42;
  the seven red cells named real bye, pre-season, healthy-readiness comparator,
  48-hour-window non-vacuity and late-Off-season outputs. Restoring the exact
  expression returned 42/42, and the production file matched checkpoint
  `01fa17eb` byte-for-byte.
- This is a class guard: it observes final generated athlete sessions and will
  fail when phase authorship, placement, materialisation or downstream survival
  removes the hard quality, rather than merely asserting that a scheduler branch
  exists.

## NOT COVERED — conditioning slice complete

- The two early-Off-season census refusals and the 36-world general refusal set
  are not represented as conditioning losses. Travel and zero-equipment now own
  the next diagnosis.
- Existing status receipts include separate mutation kills for rollover and
  deload dose/template preservation; they were re-run green here, not re-authored.
- No physical iPhone acceptance is claimed.

Agent: finish-programming
