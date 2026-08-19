/**
 * LIVE FIXTURE FACTS -> THE PRODUCTION SCHEDULER.
 *
 * Every cell runs `generateProgramLocally` and reads the authored workouts. A
 * pure scheduler cell cannot catch the production boundary replacing an
 * explicit bye or moved fixture with the profile's usual game day.
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { generateProgramLocally } from '../services/api/generateProgram';
import { resolveProfileTargetWeekAvailability } from '../rules/fixtureConditionedAvailability';
import { ownSeasonPhaseForGeneration } from '../rules/seasonPhaseOwner';
import { weeklySchedulerInputsFrom } from '../rules/weeklySchedulerInputs';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
}

const WEEK_MONDAY = '2026-08-10';

const profile = {
  ageRange: '26-30',
  experienceLevel: 'Intermediate',
  trainingLocation: 'Commercial gym',
  equipmentSelectionCompleteness: 'complete',
  equipment: ['Full Gym'],
  recentTrainingLoad: 'Pretty consistent',
  conditioningLevel: 'Average',
  seasonPhase: 'In-season',
  trainingDaysPerWeek: 5,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  gameDay: 'Saturday',
};

function clockAtPhaseWeek(phaseWeek: number) {
  const entry = new Date(`${WEEK_MONDAY}T12:00:00`);
  entry.setDate(entry.getDate() - ((phaseWeek - 1) * 7));
  return {
    protocolVersion: 1,
    selectedPhase: 'In-season',
    phaseEntryWeekStartISO: entry.toISOString().slice(0, 10),
    originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state',
  };
}

function availabilityFor(targetFixtureDay?: string | null, athleteProfile = profile) {
  return targetFixtureDay === null
    ? resolveProfileTargetWeekAvailability({
        profile: athleteProfile as never,
        weekStart: WEEK_MONDAY,
        markedDays: { '2026-08-15': 'noGame' },
        ownedPhase: ownSeasonPhaseForGeneration(athleteProfile as never),
      })
    : undefined;
}

function generated(
  targetFixtureDay?: string | null,
  microcycleLimit: 1 | 4 = 1,
  athleteProfile = profile,
) {
  const targetWeekAvailability = availabilityFor(targetFixtureDay, athleteProfile);
  return generateProgramLocally(athleteProfile as never, {
    todayISO: WEEK_MONDAY,
    blockNumber: 1,
    microcycleLimit,
    seasonPhaseClock: clockAtPhaseWeek(8),
    previousProgram: null,
    athletePrefs: {},
    activeConstraints: [],
    ...(targetFixtureDay !== undefined ? { targetFixtureDay } : {}),
    ...(targetWeekAvailability ? { targetWeekAvailability } : {}),
  } as never);
}

function games(program: ReturnType<typeof generated>, microcycleIndex = 0) {
  return (program.microcycles[microcycleIndex]?.workouts ?? [])
    .filter((workout) => workout.workoutType === 'Game');
}

console.log('\nGenerated scheduler fixture ownership\n');

const ordinary = generated();
ok('profile default authors the recurring Saturday fixture',
  games(ordinary).length === 1 && games(ordinary)[0].dayOfWeek === 6,
  games(ordinary).map((workout) => ({ day: workout.dayOfWeek, name: workout.name })));

const bye = generated(null);
const byeAvailability = availabilityFor(null)!;
const byeSchedulerInputs = weeklySchedulerInputsFrom({
  profile: profile as never,
  weekStartISO: WEEK_MONDAY,
  offseasonSubphase: null,
  targetFixtureDay: null,
  targetWeekAvailability: byeAvailability,
});
ok('the availability owner releases Saturday into the scheduler input',
  byeSchedulerInputs.gymAccessDays.includes(6)
    && byeSchedulerInputs.releasedFixtureDays?.includes(6),
  {
    released: byeAvailability.releasedFixtures,
    gymAccessDays: byeSchedulerInputs.gymAccessDays,
    releasedFixtureDays: byeSchedulerInputs.releasedFixtureDays,
  });
const byeWeek = bye.microcycles[0]?.workouts ?? [];
const byeSaturday = byeWeek.find((workout) => workout.dayOfWeek === 6);
ok('an explicit target-week bye authors no game', games(bye).length === 0,
  games(bye).map((workout) => ({ day: workout.dayOfWeek, name: workout.name })));
ok('the released fixture day is used for athlete work rather than left empty',
  !!byeSaturday && (
    (byeSaturday.exercises?.length ?? 0) > 0 || !!byeSaturday.conditioningBlock
  ),
  byeWeek.map((workout) => ({
    day: workout.dayOfWeek,
    type: workout.workoutType,
    rows: workout.exercises?.length ?? 0,
    conditioning: workout.conditioningCategory ?? null,
  })));
ok('the healthy bye puts the hard replacement exposure on the released fixture day',
  !!byeSaturday?.conditioningBlock
    && (byeSaturday.conditioningCategory === 'vo2'
      || byeSaturday.conditioningCategory === 'glycolytic'),
  {
    type: byeSaturday?.workoutType,
    category: byeSaturday?.conditioningCategory ?? null,
    hasBlock: !!byeSaturday?.conditioningBlock,
  });

const noClubProfile = {
  ...profile,
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
};
const noClubBye = generated(null, 1, noClubProfile);
const noClubSaturday = noClubBye.microcycles[0]?.workouts
  .find((workout) => workout.dayOfWeek === 6);
ok('released-day provenance places the hard bye exposure even when strength uses other days',
  !!noClubSaturday?.conditioningBlock
    && (noClubSaturday.conditioningCategory === 'vo2'
      || noClubSaturday.conditioningCategory === 'glycolytic'),
  {
    type: noClubSaturday?.workoutType,
    rows: noClubSaturday?.exercises?.length ?? 0,
    category: noClubSaturday?.conditioningCategory ?? null,
  });

const moved = generated('Wednesday');
ok('a moved target-week fixture replaces rather than duplicates the usual fixture',
  games(moved).length === 1 && games(moved)[0].dayOfWeek === 3,
  games(moved).map((workout) => ({ day: workout.dayOfWeek, name: workout.name })));

const targetByeBlock = generated(null, 4);
ok('the target-week bye does not erase recurring fixtures from later weeks',
  games(targetByeBlock, 0).length === 0
    && [1, 2, 3].every((index) =>
      games(targetByeBlock, index).length === 1
      && games(targetByeBlock, index)[0].dayOfWeek === 6),
  targetByeBlock.microcycles.map((_, index) =>
    games(targetByeBlock, index).map((workout) => workout.dayOfWeek)));

totalsPrinted();
console.log(`\nGenerated scheduler fixtures: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}
