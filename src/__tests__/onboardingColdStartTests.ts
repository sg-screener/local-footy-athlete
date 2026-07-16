/**
 * Shared onboarding accepted-state cold-start regressions.
 *
 * Run: npm run test:onboarding-cold-start
 */

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

import type { TrainingProgram } from '../types/domain';
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

function install(program: TrainingProgram): ReturnType<typeof useProgramStore.getState> {
  useProfileStore.setState({ onboardingData: DEV_TEST_ONBOARDING_DATA });
  withoutGenerationLogs(() =>
    seedOnboardingProgram({ onboardingData: DEV_TEST_ONBOARDING_DATA, program: clone(program) }));
  return useProgramStore.getState();
}

function acceptedShape(state: ReturnType<typeof useProgramStore.getState>): string {
  return JSON.stringify({
    currentProgram: state.currentProgram ? 'object' : 'null',
    currentMicrocycle: state.currentMicrocycle ? 'object' : 'null',
    todayWorkout: state.todayWorkout ? 'object' : 'null',
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

  await run('1 fresh install and direct generateProgramFromProfile cold start', async () => {
    resetToSparseColdStart();
    const originalFetch = global.fetch;
    (global as unknown as { fetch: typeof fetch }).fetch = async () => fakeCoachResponse();
    try {
      const direct = await withoutGenerationLogsAsync(() => generateProgramFromProfile(
        DEV_TEST_ONBOARDING_DATA,
        { todayISO: '2026-07-13' },
      ));
      const state = install(direct);
      assert(state.currentProgram?.id === direct.id, 'directly generated program was not stored');
      assert(state.currentProgram.microcycles.length === 4, 'direct generation lost microcycles');
    } finally {
      (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    }
  });

  let devShape = '';
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
    devProgramId = result.program.id;
    devShape = acceptedShape(state);
  });

  let realShape = '';
  await run('3 normal onboarding completion stores generated program', () => {
    resetToSparseColdStart();
    const state = install(source);
    assert(state.currentProgram?.id === source.id, 'normal onboarding did not store generated program');
    realShape = acceptedShape(state);
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
    }));
    assert(Object.keys(useProgramStore.getState().acceptedMaterialContext.markedDays).length === 0,
      'empty calendar manufactured marks');
  });

  await run('5 empty readiness store stays unknown/empty', () => {
    resetToSparseColdStart();
    const state = install(source);
    assert(Object.keys(state.acceptedMaterialContext.readinessSignalsByDate).length === 0,
      'cold start manufactured readiness');
  });

  await run('6 empty constraints and injury store stays empty/null', () => {
    resetToSparseColdStart();
    const state = install(source);
    assert(state.acceptedMaterialContext.activeConstraints.length === 0,
      'cold start manufactured constraints');
    assert(state.acceptedMaterialContext.activeInjury === null,
      'cold start manufactured injury state');
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

  await run('10 four microcycles remain after persistence publication', () => {
    resetToSparseColdStart();
    assert(install(source).currentProgram?.microcycles.length === 4, 'microcycle count changed');
  });

  await run('11 newly stored program rehydrates with four microcycles', async () => {
    resetToSparseColdStart();
    const storedState = install(source);
    const persistedEnvelope = JSON.stringify({
      state: JSON.parse(JSON.stringify(storedState)),
      version: 0,
    });
    useProgramStore.setState({
      currentProgram: undefined,
      currentMicrocycle: undefined,
      acceptedMaterialContext: undefined,
      dateOverrides: undefined,
      overrideContexts: undefined,
      weekScopedOverlays: undefined,
      exposureContractsByWeek: undefined,
    } as never);
    localStorageData.set('program-store', persistedEnvelope);
    await useProgramStore.persist.rehydrate();
    const hydrated = useProgramStore.getState();
    assert(hydrated.currentProgram?.microcycles.length === 4, 'rehydration lost microcycles');
    assert(Object.keys(hydrated.dateOverrides).length === 0, 'rehydration did not normalise maps');
  });

  await run('12 dev skip and normal onboarding publish the same accepted surfaces', () => {
    assert(devShape === realShape, `shape mismatch\ndev=${devShape}\nreal=${realShape}`);
  });

  await run('13 diagnostics preserve stack and identify every pipeline stage', () => {
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
  });

  await run('14 dev skip never calls the injected generator or uses DEFAULT_PROGRAM', () => {
    assert(devGeneratorCalls === 0, 'dev skip waited for the injected network generator');
    assert(devProgramId !== DEFAULT_PROGRAM.id, 'dev skip installed DEFAULT_PROGRAM');
  });

  await run('15 existing complete accepted-state surfaces are unchanged by normalisation', () => {
    resetToSparseColdStart();
    const state = install(source);
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
