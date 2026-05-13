/**
 * smokeBootstrap unit tests.
 *
 * Covers URL parsing, env-var detection, dev gating, and the actual
 * bootstrap pipeline via injected store refs (so this test never
 * touches AsyncStorage or any Zustand persist middleware).
 *
 * Run: npm run test:smoke-bootstrap
 */

import {
  __resetSmokeBootstrapForTest,
  getSmokeFlowFromEnv,
  getSmokeFlowFromGeneratedFlag,
  getSmokeRuntimeSignal,
  isSmokeBootstrapAllowed,
  parseSmokeBootstrapUrl,
  runSmokeBootstrap,
  SMOKE_FLOWS,
  SMOKE_URL_HOST,
  SMOKE_URL_SCHEME,
} from '../utils/smokeBootstrap';
import { DEFAULT_PROGRAM } from '../data/defaultProgram';
import { DEV_TEST_ONBOARDING_DATA } from '../utils/devOnboardingSkip';

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
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function section(label: string) {
  console.log(`\n${label}`);
}

// ────────────────────────────────────────────────────────────────────
// [1] Constants
// ────────────────────────────────────────────────────────────────────
section('[1] URL scheme constants');
{
  eq('scheme is localfootyathlete', SMOKE_URL_SCHEME, 'localfootyathlete');
  eq('host is smoke', SMOKE_URL_HOST, 'smoke');
  ok(
    'SMOKE_FLOWS contains coach-bike-flow',
    SMOKE_FLOWS.includes('coach-bike-flow' as any),
  );
}

// ────────────────────────────────────────────────────────────────────
// [2] parseSmokeBootstrapUrl
// ────────────────────────────────────────────────────────────────────
section('[2] parseSmokeBootstrapUrl');
{
  eq(
    'parses canonical URL',
    parseSmokeBootstrapUrl('localfootyathlete://smoke/coach-bike-flow'),
    { flow: 'coach-bike-flow' },
  );
  eq(
    'tolerates trailing slash',
    parseSmokeBootstrapUrl('localfootyathlete://smoke/coach-bike-flow/'),
    { flow: 'coach-bike-flow' },
  );
  eq(
    'tolerates query string',
    parseSmokeBootstrapUrl('localfootyathlete://smoke/coach-bike-flow?ts=123'),
    { flow: 'coach-bike-flow' },
  );
  eq(
    'is case-insensitive on scheme/host',
    parseSmokeBootstrapUrl('LOCALFOOTYATHLETE://SMOKE/coach-bike-flow'),
    { flow: 'coach-bike-flow' },
  );
  eq('rejects null', parseSmokeBootstrapUrl(null), null);
  eq('rejects undefined', parseSmokeBootstrapUrl(undefined), null);
  eq('rejects empty string', parseSmokeBootstrapUrl(''), null);
  eq(
    'rejects wrong scheme',
    parseSmokeBootstrapUrl('otherapp://smoke/coach-bike-flow'),
    null,
  );
  eq(
    'rejects wrong host',
    parseSmokeBootstrapUrl('localfootyathlete://prod/coach-bike-flow'),
    null,
  );
  eq(
    'rejects unknown flow (never silently degrades)',
    parseSmokeBootstrapUrl('localfootyathlete://smoke/not-a-real-flow'),
    null,
  );
  eq(
    'rejects empty flow path',
    parseSmokeBootstrapUrl('localfootyathlete://smoke/'),
    null,
  );
}

// ────────────────────────────────────────────────────────────────────
// [3] getSmokeFlowFromEnv
// ────────────────────────────────────────────────────────────────────
section('[3] getSmokeFlowFromEnv');
{
  eq(
    'parses known flow from env',
    getSmokeFlowFromEnv('coach-bike-flow'),
    'coach-bike-flow',
  );
  eq(
    'is case-insensitive',
    getSmokeFlowFromEnv('COACH-BIKE-FLOW'),
    'coach-bike-flow',
  );
  eq('trims whitespace', getSmokeFlowFromEnv('  coach-bike-flow  '), 'coach-bike-flow');
  eq('rejects unknown flow', getSmokeFlowFromEnv('not-a-flow'), null);
  eq('rejects empty', getSmokeFlowFromEnv(''), null);
  eq('rejects undefined', getSmokeFlowFromEnv(undefined), null);
}

section('[3b] generated smoke bootstrap flag');
{
  eq(
    'parses known flow from generated flag',
    getSmokeFlowFromGeneratedFlag('coach-bike-flow'),
    'coach-bike-flow',
  );
  eq(
    'generated flag is case-insensitive',
    getSmokeFlowFromGeneratedFlag('COACH-BIKE-FLOW'),
    'coach-bike-flow',
  );
  eq('generated flag trims whitespace', getSmokeFlowFromGeneratedFlag('  coach-bike-flow  '), 'coach-bike-flow');
  eq('generated flag rejects unknown flow', getSmokeFlowFromGeneratedFlag('not-a-flow'), null);
  eq('generated flag rejects null', getSmokeFlowFromGeneratedFlag(null), null);
  eq('generated flag rejects undefined', getSmokeFlowFromGeneratedFlag(undefined), null);

  const oldEnv = process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP;
  process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP = 'coach-bike-flow';
  const signal = getSmokeRuntimeSignal();
  eq('runtime signal reads env flow when present', signal.flow, 'coach-bike-flow');
  eq('runtime signal source is env when env is present', signal.source, 'env');
  if (oldEnv === undefined) {
    delete process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP;
  } else {
    process.env.EXPO_PUBLIC_SMOKE_BOOTSTRAP = oldEnv;
  }
}

// ────────────────────────────────────────────────────────────────────
// [4] isSmokeBootstrapAllowed
// ────────────────────────────────────────────────────────────────────
section('[4] isSmokeBootstrapAllowed');
{
  eq('allowed when isDev=true', isSmokeBootstrapAllowed(true, undefined), true);
  eq(
    'blocked when isDev=false, no override',
    isSmokeBootstrapAllowed(false, undefined),
    false,
  );
  eq(
    'allowed when override="1"',
    isSmokeBootstrapAllowed(false, '1'),
    true,
  );
  eq(
    'allowed when override="true"',
    isSmokeBootstrapAllowed(false, 'true'),
    true,
  );
  eq(
    'blocked when override is some other value',
    isSmokeBootstrapAllowed(false, 'yes'),
    false,
  );
  eq(
    'blocked when override empty',
    isSmokeBootstrapAllowed(false, ''),
    false,
  );
}

// ────────────────────────────────────────────────────────────────────
// [5] runSmokeBootstrap — seeds stores via injected refs
// ────────────────────────────────────────────────────────────────────
async function main() {
  section('[5] runSmokeBootstrap — happy path');
  {
    __resetSmokeBootstrapForTest();
    const calls = {
      profileCleared: false,
      profileUpdate: null as any,
      onboardingCompleted: false,
      programSet: null as any,
      microcycleSet: null as any,
      todayWorkoutSet: null as any,
      gameDates: [] as string[],
      gamesCleared: false,
    };

    const result = await runSmokeBootstrap({
      flow: 'coach-bike-flow',
      profileStore: {
        clear: () => {
          calls.profileCleared = true;
        },
        updateOnboardingData: (data) => {
          calls.profileUpdate = data;
        },
        completeOnboarding: () => {
          calls.onboardingCompleted = true;
        },
      },
      programStore: {
        setCurrentProgram: (program) => {
          calls.programSet = program;
        },
        setCurrentMicrocycle: (mc) => {
          calls.microcycleSet = mc;
        },
        setTodayWorkout: (w) => {
          calls.todayWorkoutSet = w;
        },
      },
      calendarStore: {
        clearAllGames: () => {
          calls.gamesCleared = true;
        },
        setGameDay: (date) => {
          calls.gameDates.push(date);
        },
      },
    });

    eq('result.flow is coach-bike-flow', result.flow, 'coach-bike-flow');
    eq('result has the persona', result.onboardingData.firstName, 'Sam');
    ok('result has program with microcycles', !!result.program?.microcycles?.length);
    eq('calendarStore.clearAllGames called', calls.gamesCleared, true);
    eq('profileStore.clear called', calls.profileCleared, true);
    eq('updateOnboardingData called with Sam', calls.profileUpdate?.firstName, 'Sam');
    eq(
      'profile height 184',
      calls.profileUpdate?.heightCm,
      184,
    );
    eq(
      'profile weight 90',
      calls.profileUpdate?.weightKg,
      90,
    );
    eq(
      'profile position Midfielder',
      calls.profileUpdate?.position,
      'Midfielder',
    );
    eq(
      'profile season in-season',
      calls.profileUpdate?.seasonPhase,
      'In-season',
    );
    eq(
      'profile game day Saturday',
      calls.profileUpdate?.gameDay,
      'Saturday',
    );
    eq('completeOnboarding called', calls.onboardingCompleted, true);
    ok('setCurrentProgram called', !!calls.programSet?.microcycles?.length);
    ok('setCurrentMicrocycle called', !!calls.microcycleSet?.workouts?.length);
    ok(
      'calendar game dates seeded',
      calls.gameDates.length > 0,
      `gameDates count: ${calls.gameDates.length}`,
    );
  }

  section('[6] runSmokeBootstrap — idempotency guard');
  {
    __resetSmokeBootstrapForTest();
    let updateCallCount = 0;
    let completeCallCount = 0;

    const noopProfile = {
      clear: () => {},
      updateOnboardingData: () => {
        updateCallCount++;
      },
      completeOnboarding: () => {
        completeCallCount++;
      },
    };
    const noopProgram = {
      setCurrentProgram: () => {},
      setCurrentMicrocycle: () => {},
      setTodayWorkout: () => {},
    };
    const noopCalendar = {
      clearAllGames: () => {},
      setGameDay: () => {},
    };

    // First run mutates.
    await runSmokeBootstrap({
      flow: 'coach-bike-flow',
      profileStore: noopProfile,
      programStore: noopProgram,
      calendarStore: noopCalendar,
    });
    eq('first call invokes updateOnboardingData once', updateCallCount, 1);
    eq('first call invokes completeOnboarding once', completeCallCount, 1);

    // Second run short-circuits.
    const second = await runSmokeBootstrap({
      flow: 'coach-bike-flow',
      profileStore: noopProfile,
      programStore: noopProgram,
      calendarStore: noopCalendar,
    });
    eq(
      'second call does NOT re-call updateOnboardingData',
      updateCallCount,
      1,
    );
    eq(
      'second call does NOT re-call completeOnboarding',
      completeCallCount,
      1,
    );
    eq('second call still returns the flow', second.flow, 'coach-bike-flow');
  }

  section('[7] runSmokeBootstrap — explicit overrides honoured');
  {
    __resetSmokeBootstrapForTest();
    const customOnboarding = {
      ...DEV_TEST_ONBOARDING_DATA,
      firstName: 'CustomTester',
    };
    let seenProfile: any = null;
    const result = await runSmokeBootstrap({
      flow: 'coach-bike-flow',
      onboardingData: customOnboarding,
      program: DEFAULT_PROGRAM,
      profileStore: {
        clear: () => {},
        updateOnboardingData: (p) => {
          seenProfile = p;
        },
        completeOnboarding: () => {},
      },
      programStore: {
        setCurrentProgram: () => {},
        setCurrentMicrocycle: () => {},
        setTodayWorkout: () => {},
      },
      calendarStore: {
        clearAllGames: () => {},
        setGameDay: () => {},
      },
    });
    eq('override persona used', seenProfile?.firstName, 'CustomTester');
    eq('result.onboardingData reflects override', result.onboardingData.firstName, 'CustomTester');
  }

  section('[8] runSmokeBootstrap — store method failures do not abort');
  {
    __resetSmokeBootstrapForTest();
    let onboardingCompleted = false;
    // clearAllGames + profileStore.clear are best-effort — bootstrap must
    // continue if either throws (e.g. older store shape).
    await runSmokeBootstrap({
      flow: 'coach-bike-flow',
      profileStore: {
        clear: () => {
          throw new Error('legacy store has no clear');
        },
        updateOnboardingData: () => {},
        completeOnboarding: () => {
          onboardingCompleted = true;
        },
      },
      programStore: {
        setCurrentProgram: () => {},
        setCurrentMicrocycle: () => {},
        setTodayWorkout: () => {},
      },
      calendarStore: {
        clearAllGames: () => {
          throw new Error('legacy store has no clearAllGames');
        },
        setGameDay: () => {},
      },
    });
    eq(
      'completeOnboarding still ran despite clear failures',
      onboardingCompleted,
      true,
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
