/**
 * Dev onboarding skip tests.
 *
 * Run: npm run test:dev-onboarding-skip
 */

import { DEFAULT_PROGRAM, buildWorkoutsFromCoach } from '../data/defaultProgram';
import {
  getProgramGenerationProfileFieldDiagnostics,
} from '../services/api/generateProgram';
import {
  DEV_TEST_ONBOARDING_DATA,
  isDevOnboardingSkipEnabled,
  runDevOnboardingSkip,
} from '../utils/devOnboardingSkip';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n      ${detail}` : ''));
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function section(label: string) {
  console.log(`\n${label}`);
}

section('[1] dev gate');
{
  eq('enabled in dev', isDevOnboardingSkipEnabled(true), true);
  eq('hidden outside dev', isDevOnboardingSkipEnabled(false), false);
}

section('[2] default test athlete profile');
{
  eq('name', DEV_TEST_ONBOARDING_DATA.firstName, 'Sam');
  eq('height', DEV_TEST_ONBOARDING_DATA.heightCm, 184);
  eq('weight', DEV_TEST_ONBOARDING_DATA.weightKg, 90);
  eq('position', DEV_TEST_ONBOARDING_DATA.position, 'Midfielder');
  eq('season phase', DEV_TEST_ONBOARDING_DATA.seasonPhase, 'In-season');
  eq('game day', DEV_TEST_ONBOARDING_DATA.gameDay, 'Saturday');
  eq('team training days', DEV_TEST_ONBOARDING_DATA.teamTrainingDays, ['Tuesday', 'Thursday']);
  eq('preferred training days', DEV_TEST_ONBOARDING_DATA.preferredTrainingDays, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  eq('injuries none', DEV_TEST_ONBOARDING_DATA.injuries, []);
  eq(
    'no required generation profile fields missing',
    getProgramGenerationProfileFieldDiagnostics(DEV_TEST_ONBOARDING_DATA).missingRequired,
    [],
  );
}

section('[2b] generated workout type normalization');
{
  const [workout] = buildWorkoutsFromCoach([
    {
      dayOfWeek: 1,
      name: 'Lower Strength',
      workoutType: 'core',
      sessionTier: 'core',
      exercises: [
        {
          name: 'Back Squat',
          sets: 4,
          repsMin: 4,
          repsMax: 6,
        },
      ],
    },
  ]);
  eq('core workoutType normalises to Strength', workout.workoutType, 'Strength');
  eq('core remains sessionTier', workout.sessionTier, 'core');
}

async function main() {
section('[3] skip creates completed onboarding state');
{
  const calls = {
    profile: null as any,
    completed: false,
    program: null as any,
    microcycle: null as any,
    todayWorkout: null as any,
    gameDates: [] as string[],
  };
  const result = await runDevOnboardingSkip({
    generateProgram: async () => DEFAULT_PROGRAM,
    profileStore: {
      updateOnboardingData: (profile) => { calls.profile = profile; },
      completeOnboarding: () => { calls.completed = true; },
    },
    programStore: {
      setCurrentProgram: (program) => { calls.program = program; },
      setCurrentMicrocycle: (microcycle) => { calls.microcycle = microcycle; },
      setTodayWorkout: (workout) => { calls.todayWorkout = workout; },
    },
    calendarStore: {
      setGameDay: (date) => { calls.gameDates.push(date); },
    },
  });
  eq('did not use fallback', result.usedFallback, false);
  eq('profile written', calls.profile.firstName, 'Sam');
  eq('onboarding completed', calls.completed, true);
  ok('program written', !!calls.program?.microcycles?.length);
  ok('microcycle written', !!calls.microcycle?.workouts?.length);
  ok('game dates seeded', calls.gameDates.length > 0);
}

section('[4] generator failure falls back to valid default program');
{
  const calls = {
    completed: false,
    program: null as any,
    error: null as string | null,
  };
  const result = await runDevOnboardingSkip({
    generateProgram: async () => {
      throw new Error('local edge function unavailable');
    },
    profileStore: {
      updateOnboardingData: () => {},
      completeOnboarding: () => { calls.completed = true; },
    },
    programStore: {
      setCurrentProgram: (program) => { calls.program = program; },
      setCurrentMicrocycle: () => {},
      setTodayWorkout: () => {},
      setError: (error) => { calls.error = error; },
    },
    calendarStore: {
      setGameDay: () => {},
    },
  });
  eq('used fallback', result.usedFallback, true);
  eq('onboarding completed', calls.completed, true);
  ok('fallback program has workouts', !!calls.program?.microcycles?.[0]?.workouts?.length);
  ok(
    'fallback stores dev warning',
    !!calls.error && calls.error.includes('Using DEFAULT_PROGRAM'),
    `expected warning error, got ${calls.error}`,
  );
}

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
