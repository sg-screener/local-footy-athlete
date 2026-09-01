/**
 * R-311 integration receipt: the authored early Off-season Running Speed floor
 * must cross the real cold-onboarding install gate. A generator-only check is
 * insufficient because Section 18 rejects at `seedOnboardingProgram`.
 *
 * NOT COVERED: later phase transitions and the 52-week lived-year sequence;
 * those are owned by the final-year audit.
 */
Object.assign(globalThis, { __DEV__: true });

const { armTotalsOrRed, totalsPrinted } =
  require('./support/totalsOrRed') as typeof import('./support/totalsOrRed');
const { coldStartThroughOnboarding, quietAsync } =
  require('./support/athleteJourney') as typeof import('./support/athleteJourney');
const { athleteAnswers } =
  require('./compilerYear/catalog') as typeof import('./compilerYear/catalog');
const { presetEquipmentAnswer } =
  require('./support/equipmentAnswerFixture') as typeof import('./support/equipmentAnswerFixture');

armTotalsOrRed();

const MONDAY = '2026-09-28';
let passed = 0;
const failures: string[] = [];

function check(name: string, value: unknown, detail?: unknown): void {
  if (value) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}`, detail ?? '');
}

async function main(): Promise<void> {
  const profile = athleteAnswers({
    id: 'r311-cold-male',
    gender: 'male',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    experience: '5+ years',
    equipment: 'commercial',
    initialPhase: 'Off-season',
    clubDays: ['Tuesday', 'Thursday'],
    gameDay: 'Saturday',
    extraGame: false,
  });
  profile.firstName = 'R311 cold acceptance';
  profile.seasonFinishedOn = '2026-09-27';
  profile.equipmentAnswer = presetEquipmentAnswer('commercial_gym', MONDAY);
  if (profile.twoKmTimeTrial) {
    profile.twoKmTimeTrial = { ...profile.twoKmTimeTrial, recordedOn: MONDAY };
  }

  let installed: Awaited<ReturnType<typeof coldStartThroughOnboarding>> | null = null;
  let thrown: unknown = null;
  try {
    installed = await quietAsync(() => coldStartThroughOnboarding({
      profile,
      installDayISO: MONDAY,
    }));
  } catch (error) {
    thrown = error;
  }

  check('the exact full-equipment male year profile crosses real cold onboarding',
    thrown === null && installed !== null && !installed.onboardingRefusal,
    thrown instanceof Error ? thrown.message : (installed?.onboardingRefusal ?? thrown));

  const firstFour = installed?.program.microcycles.slice(0, 4) ?? [];
  const speedCounts = firstFour.map(microcycle => microcycle.workouts.filter(workout =>
    workout.speedBlock?.kind === 'true_speed' && workout.speedBlock.modality === 'run').length);
  check('all four accepted early Off-season weeks retain one real running-Speed exposure',
    firstFour.length === 4 && speedCounts.every(count => count === 1),
    { microcycles: firstFour.length, speedCounts });

  const total = passed + failures.length;
  console.log(`\nEarly Off-season Speed cold acceptance: passed=${passed}/${total} failures=${failures.length}`);
  totalsPrinted(failures.length);
  if (failures.length > 0) process.exit(1);
}

main().catch(error => {
  console.error(error);
  totalsPrinted(1);
  process.exit(1);
});
