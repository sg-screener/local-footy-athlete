/**
 * Shared onboarding accepted-state cold-start regressions.
 *
 * Run: npm run test:onboarding-cold-start
 */

import fs from 'fs';
import path from 'path';

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};

import type { OnboardingData, TrainingProgram } from '../types/domain';
import {
  generateProgramFromProfile,
  generateProgramLocally,
} from '../services/api/generateProgram';
import { DEFAULT_PROGRAM } from '../data/defaultProgram';
import {
  createEmptyAcceptedMaterialContext,
  normalizeAcceptedProgramSurfaces,
} from '../store/acceptedStateColdStart';
import { useProgramStore } from '../store/programStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useProfileStore } from '../store/profileStore';
import {
  seedOnboardingProgram,
  toOnboardingPipelineError,
} from '../utils/onboardingCompletion';
import {
  DEV_TEST_ONBOARDING_DATA,
  runDevOnboardingSkip,
} from '../utils/devOnboardingSkip';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';

const EFFECTIVE_TODAY_ISO = '2026-07-13';
const EFFECTIVE_WEEK_START_ISO = '2026-07-13';

let passed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL ${name}`, error);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withoutGenerationLogs<T>(body: () => T): T {
  const warn = console.warn;
  const error = console.error;
  console.warn = () => undefined;
  console.error = () => undefined;
  try {
    return body();
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

async function withoutGenerationLogsAsync<T>(body: () => Promise<T>): Promise<T> {
  const warn = console.warn;
  const error = console.error;
  console.warn = () => undefined;
  console.error = () => undefined;
  try {
    return await body();
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

function generatedProgram(): TrainingProgram {
  return withoutGenerationLogs(() => generateProgramLocally(DEV_TEST_ONBOARDING_DATA, {
    todayISO: '2026-07-13',
    previousProgram: null,
    activeConstraints: [],
  }));
}

function resetToSparseColdStart(): void {
  useProgramStore.getState().clear();
  useCalendarStore.setState({ markedDays: {}, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProfileStore.setState({
    onboardingData: DEV_TEST_ONBOARDING_DATA,
    isOnboardingComplete: false,
  });

  // The old/partial persistence envelope that reproduced the regression.
  useCalendarStore.setState({ markedDays: undefined } as never);
  useReadinessStore.setState({ signalsByDate: undefined } as never);
  useProgramStore.setState({
    currentProgram: undefined,
    currentMicrocycle: undefined,
    todayWorkout: undefined,
    blockState: undefined,
    acceptedMaterialContext: undefined,
    dateOverrides: undefined,
    overrideContexts: undefined,
    weekScopedOverlays: undefined,
    exposureContractsByWeek: undefined,
  } as never);
}

function install(
  program: TrainingProgram,
  todayISO: string = EFFECTIVE_TODAY_ISO,
): ReturnType<typeof useProgramStore.getState> {
  useProfileStore.setState({ onboardingData: DEV_TEST_ONBOARDING_DATA });
  withoutGenerationLogs(() =>
    seedOnboardingProgram({
      onboardingData: DEV_TEST_ONBOARDING_DATA,
      program: clone(program),
      todayISO,
    }));
  return useProgramStore.getState();
}

function acceptedShape(state: ReturnType<typeof useProgramStore.getState>): string {
  return JSON.stringify({
    currentProgram: state.currentProgram ? 'object' : 'null',
    currentMicrocycle: state.currentMicrocycle ? 'object' : 'null',
    blockState: state.blockState ? 'object' : 'null',
    microcycles: (state.currentProgram?.microcycles.length ?? 0) > 0 ? 'nonempty' : 'empty',
    dateOverrides: typeof state.dateOverrides,
    overrideContexts: typeof state.overrideContexts,
    weekScopedOverlays: typeof state.weekScopedOverlays,
    exposureContractsByWeek: typeof state.exposureContractsByWeek,
    markedDays: typeof state.acceptedMaterialContext.markedDays,
    readinessSignals: typeof state.acceptedMaterialContext.readinessSignalsByDate,
    activeConstraints: Array.isArray(state.acceptedMaterialContext.activeConstraints),
    activeInjury: state.acceptedMaterialContext.activeInjury === null ? 'null' : 'object',
  });
}

function canonicalVisibleProjection(): string {
  const state = buildScheduleStateImperative();
  return JSON.stringify(buildProgramTabProjectedWeek({
    mondayISO: EFFECTIVE_WEEK_START_ISO,
    todayISO: EFFECTIVE_TODAY_ISO,
    state,
  }).map((day) => ({
    date: day.date,
    indicator: day.indicator,
    workoutName: day.workout?.name ?? null,
    workoutType: day.workout?.workoutType ?? null,
    sessionTier: day.workout?.sessionTier ?? null,
  })));
}

function canonicalVisibleDay(date: string): ReturnType<
  typeof buildProgramTabProjectedWeek
>[number] {
  const weekStart = date === '2026-07-13'
    ? EFFECTIVE_WEEK_START_ISO
    : useProgramStore.getState().currentMicrocycle?.startDate.slice(0, 10) ?? date;
  const day = buildProgramTabProjectedWeek({
    mondayISO: weekStart,
    todayISO: date,
    state: buildScheduleStateImperative(),
  }).find((candidate) => candidate.date === date);
  assert(day, `canonical visible day missing for ${date}`);
  return day;
}

function withTestClock(dateISO: string): void {
  (globalThis as any).__LFA_DEV_E2E_CLOCK_RECEIPT__ = {
    anchorInstant: `${dateISO}T02:00:00.000Z`,
    timezone: 'Australia/Melbourne',
  };
}

function fakeCoachResponse(): Response {
  return new Response(JSON.stringify({
    _v: 'cold-start-test',
    reply: 'Generated test program',
    programUpdate: {
      workouts: [
        {
          dayOfWeek: 1,
          name: 'Lower Strength',
          workoutType: 'core',
          sessionTier: 'core',
          exercises: [{ name: 'Back Squat', sets: 4, repsMin: 4, repsMax: 6 }],
        },
        {
          dayOfWeek: 2,
          name: 'Team Training',
          workoutType: 'team',
          sessionTier: 'core',
          exercises: [],
        },
        {
          dayOfWeek: 3,
          name: 'Recovery',
          workoutType: 'recovery',
          sessionTier: 'recovery',
          exercises: [],
        },
        {
          dayOfWeek: 4,
          name: 'Team Training',
          workoutType: 'team',
          sessionTier: 'core',
          exercises: [],
        },
        {
          dayOfWeek: 5,
          name: 'Optional Upper',
          workoutType: 'optional',
          sessionTier: 'optional',
          exercises: [{ name: 'DB Bench Press', sets: 3, repsMin: 6, repsMax: 8 }],
        },
      ],
    },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function main(): Promise<void> {
  const source = generatedProgram();

  await run('1 async Sunday-to-Monday rollover keeps one generation and acceptance date', async () => {
    resetToSparseColdStart();
    const originalFetch = global.fetch;
    const runtime = global as unknown as { __DEV__: boolean };
    const previousDev = runtime.__DEV__;
    const previousClock = (globalThis as any).__LFA_DEV_E2E_CLOCK_RECEIPT__;
    runtime.__DEV__ = true;
    withTestClock('2026-07-19');
    (global as unknown as { fetch: typeof fetch }).fetch = async () => {
      const response = fakeCoachResponse();
      const readBody = response.text.bind(response);
      Object.defineProperty(response, 'text', {
        value: async () => {
          // The request began on Sunday. Simulate the response completing
          // after local midnight on Monday.
          withTestClock('2026-07-20');
          return readBody();
        },
      });
      return response;
    };
    try {
      const direct = await withoutGenerationLogsAsync(() => generateProgramFromProfile(
        DEV_TEST_ONBOARDING_DATA,
      ));
      const state = install(direct, '2026-07-19');
      assert(state.currentProgram?.id === direct.id, 'directly generated program was not stored');
      assert(state.currentProgram.microcycles.length === 4, 'direct generation lost microcycles');
      assert(
        state.currentProgram.startDate.slice(0, 10) === '2026-07-13',
        `response completion changed block start to ${state.currentProgram.startDate}`,
      );
      assert(
        state.currentMicrocycle?.startDate.slice(0, 10) === '2026-07-13',
        'accepted installation did not retain the Sunday-containing microcycle',
      );
      assert(state.todayWorkout === null, 'Sunday raw compatibility cache should remain null');
      const sunday = canonicalVisibleDay('2026-07-19');
      assert(
        sunday.workout?.workoutType === 'Recovery',
        `Sunday G+1 did not project Recovery: ${sunday.workout?.name ?? 'rest'}`,
      );
    } finally {
      (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
      runtime.__DEV__ = previousDev;
      if (previousClock) {
        (globalThis as any).__LFA_DEV_E2E_CLOCK_RECEIPT__ = previousClock;
      } else {
        delete (globalThis as any).__LFA_DEV_E2E_CLOCK_RECEIPT__;
      }
    }
  });

  let devShape = '';
  let devVisibleProjection = '';
  let devMicrocycleCount = 0;
  let devProgramId = '';
  let devGeneratorCalls = 0;
  await run('2 dev onboarding skip installs the deterministic accepted seed', async () => {
    resetToSparseColdStart();
    // The coordinator runs after hydration in the app. Reproduce the hydrated
    // cold-start invariants here; the sparse-state cases below intentionally
    // bypass Zustand's merge normalisers to exercise production acceptance.
    useCalendarStore.setState({ markedDays: {} });
    useReadinessStore.setState({ signalsByDate: {} });
    const runtime = global as unknown as { __DEV__: boolean };
    const previousDev = runtime.__DEV__;
    runtime.__DEV__ = true;
    let result: Awaited<ReturnType<typeof runDevOnboardingSkip>>;
    try {
      result = await withoutGenerationLogsAsync(() => runDevOnboardingSkip({
        generateProgram: async () => {
          devGeneratorCalls += 1;
          return clone(source);
        },
      }));
    } finally {
      runtime.__DEV__ = previousDev;
    }
    const state = useProgramStore.getState();
    assert(!result.usedFallback, 'dev skip used DEFAULT_PROGRAM');
    assert(result.program.id === 'dev-e2e-standard-in-season-week',
      'dev skip did not return the standard deterministic seed');
    assert(state.currentProgram?.id === result.program.id,
      'dev skip did not store the standard deterministic seed');
    assert(
      state.currentMicrocycle?.startDate.slice(0, 10) === EFFECTIVE_WEEK_START_ISO,
      'dev seed did not select the Monday-containing microcycle',
    );
    assert(
      state.todayWorkout?.name === 'Lower Body Strength',
      `dev Monday compatibility row changed: ${state.todayWorkout?.name ?? 'null'}`,
    );
    assert(
      canonicalVisibleDay(EFFECTIVE_TODAY_ISO).workout?.name === 'Lower Body Strength',
      'dev Monday canonical visible day disagrees with the accepted session',
    );
    devProgramId = result.program.id;
    devShape = acceptedShape(state);
    devVisibleProjection = canonicalVisibleProjection();
    devMicrocycleCount = state.currentProgram?.microcycles.length ?? 0;
  });

  let realShape = '';
  let realVisibleProjection = '';
  let realMicrocycleCount = 0;
  await run('3 normal onboarding completion stores generated program', () => {
    resetToSparseColdStart();
    const state = install(source);
    assert(state.currentProgram?.id === source.id, 'normal onboarding did not store generated program');
    assert(
      state.currentMicrocycle?.startDate.slice(0, 10) === EFFECTIVE_WEEK_START_ISO,
      'normal onboarding did not select the date-containing microcycle',
    );
    assert(
      state.todayWorkout?.name === 'Lower Body Strength',
      `normal Monday compatibility row changed: ${state.todayWorkout?.name ?? 'null'}`,
    );
    assert(
      canonicalVisibleDay('2026-07-13').workout?.name === 'Lower Body Strength',
      'Monday canonical visible day disagrees',
    );
    assert(
      canonicalVisibleDay('2026-07-14').workout?.workoutType === 'Team Training' &&
        canonicalVisibleDay('2026-07-16').workout?.workoutType === 'Team Training',
      'Tuesday/Thursday team training geometry changed',
    );
    assert(
      canonicalVisibleDay('2026-07-15').workout === null,
      'genuine Wednesday full-rest day was populated',
    );
    assert(
      canonicalVisibleDay('2026-07-18').workout?.workoutType === 'Game',
      'Saturday fixture did not project Game',
    );
    const recovery = canonicalVisibleDay('2026-07-19');
    assert(
      recovery.workout?.workoutType === 'Recovery' && recovery.indicator === 'recovery',
      'G+1 active recovery was collapsed to full rest',
    );
    realShape = acceptedShape(state);
    realVisibleProjection = canonicalVisibleProjection();
    realMicrocycleCount = state.currentProgram?.microcycles.length ?? 0;
  });

  await run('4 empty calendar store means no invented non-fixture marks', () => {
    resetToSparseColdStart();
    useProfileStore.setState({
      onboardingData: { ...DEV_TEST_ONBOARDING_DATA, gameDay: 'Varies', usualGameDay: undefined },
    });
    const value = withoutGenerationLogs(() => generateProgramLocally(
      { ...DEV_TEST_ONBOARDING_DATA, gameDay: 'Varies', usualGameDay: undefined },
      { todayISO: '2026-07-13', previousProgram: null, activeConstraints: [] },
    ));
    withoutGenerationLogs(() => seedOnboardingProgram({
      onboardingData: { ...DEV_TEST_ONBOARDING_DATA, gameDay: 'Varies', usualGameDay: undefined },
      program: value,
      todayISO: '2026-07-13',
    }));
    assert(Object.keys(useProgramStore.getState().acceptedMaterialContext.markedDays).length === 0,
      'empty calendar manufactured marks');
  });

  await run('5 pre-season practice-match geometry survives a sparse cold start', () => {
    resetToSparseColdStart();
    const state = install(source);
    assert(Object.keys(state.acceptedMaterialContext.readinessSignalsByDate).length === 0,
      'cold start manufactured readiness');
    const practiceMatchProfile: OnboardingData = {
      ...DEV_TEST_ONBOARDING_DATA,
      seasonPhase: 'Pre-season' as const,
      gameDay: 'Sunday' as const,
      usualGameDay: 'Sunday' as const,
      trainingDaysPerWeek: 5,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    };
    const practiceMatch = withoutGenerationLogs(() => generateProgramLocally(
      practiceMatchProfile,
      { todayISO: EFFECTIVE_TODAY_ISO, previousProgram: null, activeConstraints: [] },
    ));
    assert(
      practiceMatch.microcycles.every((microcycle) =>
        microcycle.exposureContractV2?.identity.declaredSubphase === 'practice_match_week' &&
        microcycle.exposureContractV2.identity.expectedSubphase === 'practice_match_week'),
      'pre-season practice-match contract geometry changed',
    );
  });

  await run('6 off-season geometry survives with empty constraints and injury state', () => {
    resetToSparseColdStart();
    const state = install(source);
    assert(state.acceptedMaterialContext.activeConstraints.length === 0,
      'cold start manufactured constraints');
    assert(state.acceptedMaterialContext.activeInjury === null,
      'cold start manufactured injury state');
    const offSeason = withoutGenerationLogs(() => generateProgramLocally({
      ...DEV_TEST_ONBOARDING_DATA,
      seasonPhase: 'Off-season',
      gameDay: 'Varies',
      usualGameDay: undefined,
      teamTrainingDaysPerWeek: 0,
      teamTrainingDays: [],
    }, {
      todayISO: EFFECTIVE_TODAY_ISO,
      previousProgram: null,
      activeConstraints: [],
    }));
    assert(
      offSeason.microcycles.length === 4 && offSeason.microcycles.every((microcycle) =>
        microcycle.exposureContractV2?.identity.seasonPhase === 'Off-season' &&
        microcycle.exposureContractV2.identity.mode.includes('offseason') &&
        !microcycle.workouts.some((workout) => workout.workoutType === 'Game')),
      'off-season block geometry changed',
    );
  });

  await run('7 undefined legacy override and overlay maps become empty maps', () => {
    resetToSparseColdStart();
    const state = install(source);
    assert(Object.keys(state.dateOverrides).length === 0, 'date overrides not normalised');
    assert(Object.keys(state.overrideContexts).length === 0, 'override contexts not normalised');
    assert(typeof state.weekScopedOverlays === 'object', 'week overlays not normalised');
  });

  await run('8 missing Contract v1/v2 persistence maps become empty maps', () => {
    resetToSparseColdStart();
    const state = install(source);
    assert(Object.keys(state.exposureContractsByWeek).length === 0,
      'legacy exposure-contract map was manufactured');
    assert(state.currentProgram?.microcycles.every((week) => !!week.exposureContractV2),
      'accepted generated weeks lost their own Contract v2');
  });

  await run('9 successful generated program is accepted and stored', () => {
    resetToSparseColdStart();
    assert(install(source).currentProgram?.id === 'prog-ai-1', 'generated program was replaced');
  });

  await run('10 four-week install selects the microcycle containing todayISO', () => {
    resetToSparseColdStart();
    const state = install(source, '2026-07-27');
    assert(state.currentProgram?.microcycles.length === 4, 'microcycle count changed');
    assert(
      state.currentMicrocycle?.id === state.currentProgram?.microcycles[2]?.id &&
        state.currentMicrocycle?.id !== state.currentProgram?.microcycles[0]?.id,
      `selected ${state.currentMicrocycle?.id ?? 'null'} instead of the date-containing week`,
    );
  });

  await run('11 null or stale todayWorkout cannot change the hydrated visible projection', async () => {
    resetToSparseColdStart();
    const storedState = install(source);
    const visibleBefore = canonicalVisibleProjection();
    const persistedState = JSON.parse(JSON.stringify(storedState));
    const rehydrateWith = async (todayWorkout: unknown) => {
      persistedState.todayWorkout = todayWorkout;
      useProgramStore.setState({
        currentProgram: undefined,
        currentMicrocycle: undefined,
        todayWorkout: undefined,
        acceptedMaterialContext: undefined,
        dateOverrides: undefined,
        overrideContexts: undefined,
        weekScopedOverlays: undefined,
        exposureContractsByWeek: undefined,
      } as never);
      localStorageData.set('program-store', JSON.stringify({ state: persistedState, version: 0 }));
      await useProgramStore.persist.rehydrate();
      const hydrated = useProgramStore.getState();
      assert(hydrated.currentProgram?.microcycles.length === 4, 'rehydration lost microcycles');
      assert(Object.keys(hydrated.dateOverrides).length === 0, 'rehydration did not normalise maps');
      assert(
        canonicalVisibleProjection() === visibleBefore,
        'compatibility cache changed the hydrated canonical projection',
      );
    };
    await rehydrateWith(null);
    await rehydrateWith(source.microcycles[3]?.workouts[0] ?? source.microcycles[0].workouts[0]);
  });

  await run('12 dev skip and normal onboarding agree canonically while retaining storage horizons', () => {
    assert(devShape === realShape, `shape mismatch\ndev=${devShape}\nreal=${realShape}`);
    assert(
      devVisibleProjection === realVisibleProjection,
      `visible projection mismatch\ndev=${devVisibleProjection}\nreal=${realVisibleProjection}`,
    );
    assert(devMicrocycleCount === 1, `dev seed horizon changed: ${devMicrocycleCount}`);
    assert(realMicrocycleCount === 4, `normal onboarding horizon changed: ${realMicrocycleCount}`);
  });

  await run('13 CompleteScreen captures and forwards exactly one effective date per attempt', () => {
    const generation = toOnboardingPipelineError(new Error('generation'), 'generation', 'generate');
    const acceptanceCause = Object.assign(new Error('rejected'), { code: 'section18_week_rejected' });
    const acceptance = toOnboardingPipelineError(
      acceptanceCause,
      'accepted_state_transaction',
      'accept',
    );
    const transaction = toOnboardingPipelineError(
      new Error('transaction'),
      'accepted_state_transaction',
      'commit',
    );
    const persistenceCause = Object.assign(new Error('storage'), { code: 'persistence_write_failed' });
    const persistence = toOnboardingPipelineError(
      persistenceCause,
      'accepted_state_transaction',
      'persist',
    );
    const navigation = toOnboardingPipelineError(
      new Error('navigation'),
      'onboarding_navigation',
      'navigate',
    );
    assert(generation.stage === 'generation', 'generation stage mislabelled');
    assert(acceptance.stage === 'section18_acceptance', 'acceptance stage mislabelled');
    assert(transaction.stage === 'accepted_state_transaction', 'transaction stage mislabelled');
    assert(persistence.stage === 'persistence', 'persistence stage mislabelled');
    assert(navigation.stage === 'onboarding_navigation', 'navigation stage mislabelled');
    assert(acceptance.originalStack === acceptanceCause.stack, 'original stack was not preserved');
    const completeScreen = fs.readFileSync(path.join(
      __dirname,
      '../screens/onboarding/CompleteScreen.tsx',
    ), 'utf8');
    assert(
      (completeScreen.match(/todayISOLocal\(\)/g) ?? []).length === 1,
      'CompleteScreen rereads today within an onboarding attempt',
    );
    assert(
      /generateProgramFromProfile\(onboardingData,\s*\{\s*todayISO:\s*effectiveTodayISO/.test(completeScreen) &&
        /seedOnboardingProgram\([\s\S]*?todayISO:\s*effectiveTodayISO/.test(completeScreen),
      'CompleteScreen does not forward the captured effective date through generation and installation',
    );
  });

  await run('14 dev skip never calls the injected generator or uses DEFAULT_PROGRAM', () => {
    assert(devGeneratorCalls === 0, 'dev skip waited for the injected network generator');
    assert(devProgramId !== DEFAULT_PROGRAM.id, 'dev skip installed DEFAULT_PROGRAM');
  });

  await run('15 Home cards and Coach today-session reads remain projection-owned', () => {
    resetToSparseColdStart();
    const state = install(source);
    const visibleBefore = canonicalVisibleProjection();
    const before = {
      currentProgram: state.currentProgram,
      currentMicrocycle: state.currentMicrocycle,
      todayWorkout: state.todayWorkout,
      blockState: state.blockState,
      dateOverrides: state.dateOverrides,
      overrideContexts: state.overrideContexts,
      weekScopedOverlays: state.weekScopedOverlays,
      exposureContractsByWeek: state.exposureContractsByWeek,
    };
    const after = normalizeAcceptedProgramSurfaces(before);
    for (const key of Object.keys(before) as Array<keyof typeof before>) {
      assert(after[key] === before[key], `normalisation changed existing ${key}`);
    }
    useProgramStore.setState({
      todayWorkout: source.microcycles[3]?.workouts[0] ?? null,
    });
    assert(
      canonicalVisibleProjection() === visibleBefore,
      'stale todayWorkout changed the shared visible projection',
    );
    const homeSource = fs.readFileSync(path.join(
      __dirname,
      '../screens/home/useHomeScreen.ts',
    ), 'utf8');
    const coachSource = fs.readFileSync(path.join(
      __dirname,
      '../screens/coach/CoachScreen.tsx',
    ), 'utf8');
    const coachControllerSource = fs.readFileSync(path.join(
      __dirname,
      '../utils/coachTurnController.ts',
    ), 'utf8');
    assert(
      /useResolvedWeek\(\)/.test(homeSource) && !/\btodayWorkout\b/.test(homeSource),
      'Home card stopped using the canonical resolved-week projection',
    );
    assert(
      /useResolvedWeek\(\)/.test(coachSource) && !/\btodayWorkout\b/.test(coachSource) &&
        /buildProgramTabProjectedWeek\(/.test(coachControllerSource),
      'Coach today-session resolution stopped using the canonical visible projection',
    );
  });

  await run('mutation removing the dateOverrides cold-start default reproduces the crash', () => {
    const sparse = { dateOverrides: undefined };
    const normal = normalizeAcceptedProgramSurfaces(sparse);
    assert(Object.keys(normal.dateOverrides).length === 0, 'canonical default is not effective');
    const mutant = {
      ...normal,
      dateOverrides: sparse.dateOverrides as unknown as Record<string, never>,
    };
    let reproduced = false;
    try {
      Object.keys(mutant.dateOverrides);
    } catch (error) {
      reproduced = error instanceof TypeError;
    }
    assert(reproduced, 'removing the default did not reproduce the onboarding failure');
  });

  assert(
    JSON.stringify(createEmptyAcceptedMaterialContext()) === JSON.stringify({
      markedDays: {},
      readinessSignalsByDate: {},
      activeConstraints: [],
      activeInjury: null,
      injuryEpisodes: [],
      temporarySourceFacts: [],
      acceptedCompositionBase: null,
      acceptedProfileSnapshot: null,
      revision: 0,
      lastTransaction: null,
    }),
    'canonical empty context changed',
  );

  console.log(`\nOnboarding cold-start totals: passed=${passed}/16 failures=${failures.length}`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
