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

## NOT COVERED — after scheduler slice 1b

- Cross-week proximity around an explicit target-week bye/moved fixture still
  uses weekday recurrence rather than dated adjacent fixtures. This is the
  remaining scheduler/game-proximity item.
- The multi-fixture guard is green but its mutation proof is not yet recorded.
- Power delivery remains zero in the measured eligible world.
- Travel and zero-equipment output have only been baseline-printed/censused; no
  owned gap in those slices has yet been changed.
- No physical iPhone acceptance is claimed.

Agent: finish-programming
