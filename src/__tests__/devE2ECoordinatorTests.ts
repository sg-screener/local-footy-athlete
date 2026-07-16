import type { TrainingProgram } from '../types/domain';
import fs from 'fs';
import path from 'path';
import {
  DevE2ESeedCoordinator,
  type DevE2ECoordinatorDeps,
} from '../dev/e2e/DevE2ESeedCoordinator';
import type { DevE2ESeed } from '../dev/e2e/devE2ESeedRegistry';
import { DEV_E2E_STANDARD_PROFILE } from '../dev/e2e/devE2EStandardProfile';
import {
  __resetDevE2EStateForTest,
  getDevE2EStateSnapshot,
} from '../dev/e2e/devE2EState';
import { semanticFingerprint } from '../dev/e2e/semanticFingerprint';
import {
  createDevE2EClockReceiptForSeed,
  type DevE2EClockReceipt,
} from '../dev/e2e/DevE2EClock';

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    console.log(`  ✗ ${name}`);
  }
}

function program(): TrainingProgram {
  return {
    id: 'dev-e2e-standard-in-season-week',
    userId: 'dev-e2e-athlete',
    name: 'test',
    description: 'test',
    programPhase: 'In-Season',
    startDate: '2026-07-13T12:00:00.000Z',
    endDate: '2026-07-19T12:00:00.000Z',
    microcycles: [{
      id: 'week',
      programId: 'dev-e2e-standard-in-season-week',
      weekNumber: 1,
      startDate: '2026-07-13T12:00:00.000Z',
      endDate: '2026-07-19T12:00:00.000Z',
      miniCycleNumber: 1,
      intensityMultiplier: 1,
      workouts: [],
      createdAt: '2026-07-13T12:00:00.000Z',
      updatedAt: '2026-07-13T12:00:00.000Z',
    }],
    primaryFocus: 'test',
    isActive: true,
    createdAt: '2026-07-13T12:00:00.000Z',
    updatedAt: '2026-07-13T12:00:00.000Z',
  };
}

function seed(): DevE2ESeed {
  return {
    id: 'standard-in-season-week',
    anchorDate: '2026-07-13',
    profile: { firstName: 'Sam' },
    program: program(),
    auxiliaryState: [],
    witnesses: [
      { kind: 'program', programId: 'dev-e2e-standard-in-season-week', weekStart: '2026-07-13' },
      { kind: 'calendar_mark', date: '2026-07-18', mark: 'game' },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function main() {
  __resetDevE2EStateForTest();
  ok('semantic fingerprints match JSON object persistence',
    semanticFingerprint({ retained: 1, omitted: undefined }) ===
      semanticFingerprint(JSON.parse(JSON.stringify({ retained: 1, omitted: undefined }))));
  ok('semantic fingerprints match JSON array persistence',
    semanticFingerprint([1, undefined, 3]) ===
      semanticFingerprint(JSON.parse(JSON.stringify([1, undefined, 3]))));
  const events: string[] = [];
  let dirty = {
    clarifier: true,
    feedback: true,
    calendar: true,
    constraints: true,
    coach: true,
    removals: true,
  };
  let persistenceCalls = 0;
  const finalPersistence = deferred<Record<string, string>>();
  let activeClock: DevE2EClockReceipt | null = null;
  const clockReceipt = createDevE2EClockReceiptForSeed(
    'standard-in-season-week',
    '2026-07-13T00:00:00.000Z',
  );
  const checkpoint = {
    version: 2 as const,
    seedId: 'standard-in-season-week' as const,
    checkpointId: 'standard-in-season-week' as const,
    fingerprints: { state: 'ready' },
    clockFingerprint: clockReceipt.semanticFingerprint,
  };
  let writtenCheckpoint: typeof checkpoint | null = null;
  const deps: DevE2ECoordinatorDeps = {
    waitForHydration: async () => { events.push('hydrated'); },
    clearClock: async () => {
      events.push('clock-clear');
      activeClock = null;
    },
    installClock: async () => {
      events.push('clock-install');
      activeClock = clockReceipt;
      return clockReceipt;
    },
    readClockReceipt: () => activeClock,
    readTodayISO: () => '2026-07-13',
    resetLocalState: () => {
      events.push('reset');
      dirty = Object.fromEntries(Object.keys(dirty).map((key) => [key, false])) as typeof dirty;
    },
    waitForPersistence: async () => {
      persistenceCalls += 1;
      events.push(`persist-${persistenceCalls}`);
      if (persistenceCalls === 2) return finalPersistence.promise;
      return { state: 'empty' };
    },
    buildSeed: () => {
      events.push('build');
      ok('stale removals cannot cross reset', !dirty.removals);
      ok('stale feedback cannot cross reset', !dirty.feedback);
      ok('stale calendar marks cannot cross reset', !dirty.calendar);
      ok('stale constraints cannot cross reset', !dirty.constraints);
      ok('stale Coach state cannot cross reset', !dirty.coach && !dirty.clarifier);
      return seed();
    },
    writeProfile: () => events.push('profile'),
    installProgram: () => events.push('program'),
    applyAuxiliaryState: () => events.push('auxiliary'),
    completeOnboarding: () => events.push('complete'),
    readWitnessState: () => ({
      program: program(),
      profile: DEV_E2E_STANDARD_PROFILE,
      calendarMarks: { '2026-07-18': 'game' },
      activeInjury: null,
      activeConstraints: [],
      sessionFeedback: {},
    }),
    validateWitnesses: (_seedId, witnesses, state) => {
      const programWitness = witnesses.find((witness) => witness.kind === 'program');
      const calendarWitness = witnesses.find((witness) => witness.kind === 'calendar_mark');
      return [
        programWitness?.kind === 'program' && state.program?.id !== programWitness.programId
          ? 'program'
          : null,
        calendarWitness?.kind === 'calendar_mark' &&
          state.calendarMarks[calendarWitness.date] !== calendarWitness.mark
          ? 'calendar'
          : null,
      ].filter((failure): failure is string => !!failure);
    },
    captureMemoryFingerprints: () => ({ state: 'ready' }),
    fingerprintMapsMatch: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    writeCheckpoint: async (record) => { writtenCheckpoint = record as typeof checkpoint; },
    readCheckpoint: async () => checkpoint,
    readPersistedFingerprints: async () => checkpoint.fingerprints,
    clearCheckpoint: async () => events.push('checkpoint-clear'),
  };

  const coordinator = new DevE2ESeedCoordinator(true, deps);
  const resetting = coordinator.reset('standard-in-season-week');
  await Promise.resolve();
  await Promise.resolve();
  ok('ready is withheld while final persistence is pending',
    getDevE2EStateSnapshot().phase === 'seed_loading');
  finalPersistence.resolve({ state: 'ready' });
  ok('valid reset succeeds', await resetting);
  ok('ready appears only after persistence matches',
    getDevE2EStateSnapshot().phase === 'seed_ready');
  ok('program is cleared before seed build', events.indexOf('reset') < events.indexOf('build'));
  ok('old clock is cleared before local state reset',
    events.indexOf('clock-clear') < events.indexOf('reset'));
  ok('seed clock is installed before seed build',
    events.indexOf('clock-install') < events.indexOf('build'));
  ok('empty persistence flush precedes build', events.indexOf('persist-1') < events.indexOf('build'));
  ok('onboarding completes after auxiliary state', events.indexOf('auxiliary') < events.indexOf('complete'));
  ok('checkpoint succeeds after a ready seed', await coordinator.checkpoint('fixture-move'));
  ok('checkpoint preserves seed identity separately from checkpoint identity',
    writtenCheckpoint?.seedId === 'standard-in-season-week' &&
      writtenCheckpoint?.checkpointId === 'fixture-move');
  ok('checkpoint marker uses checkpoint identity',
    getDevE2EStateSnapshot().phase === 'checkpoint_ready' &&
      getDevE2EStateSnapshot().checkpointId === 'fixture-move');

  const eventCount = events.length;
  ok('unknown seed returns false', !(await coordinator.reset('not-allowlisted')));
  ok('unknown seed causes no state mutation', events.length === eventCount);

  const release = new DevE2ESeedCoordinator(false, deps);
  ok('release reset is refused', !(await release.reset('standard-in-season-week')));
  ok('release checkpoint is refused', !(await release.checkpoint('standard-in-season-week')));
  ok('release validation is refused', !(await release.validateReloadCheckpoint()));
  ok('release mode does not call dependencies', events.length === eventCount);

  let buildCalls = 0;
  const reloadHydration = deferred<void>();
  const reloadEvents: string[] = [];
  const reloadDeps: DevE2ECoordinatorDeps = {
    ...deps,
    waitForHydration: async () => {
      reloadEvents.push('hydration-wait');
      await reloadHydration.promise;
      reloadEvents.push('hydrated');
    },
    waitForPersistence: async () => ({ state: 'ready' }),
    buildSeed: () => { buildCalls += 1; return seed(); },
    readCheckpoint: async () => {
      reloadEvents.push('checkpoint-read');
      return checkpoint;
    },
    readPersistedFingerprints: async () => {
      reloadEvents.push('persisted-read');
      return checkpoint.fingerprints;
    },
  };
  const reload = new DevE2ESeedCoordinator(true, reloadDeps);
  activeClock = clockReceipt;
  const validatingReload = reload.validateReloadCheckpoint();
  await Promise.resolve();
  await Promise.resolve();
  ok('reload durable reads start before hydration completes',
    reloadEvents.includes('checkpoint-read') && reloadEvents.includes('persisted-read') &&
      !reloadEvents.includes('hydrated'));
  reloadHydration.resolve();
  ok('reload checkpoint validates', await validatingReload);
  ok('reload validation never rebuilds or reseeds', buildCalls === 0);
  ok('reload marker uses preserved seed', getDevE2EStateSnapshot().phase === 'reload_ready');

  const clockMismatch = new DevE2ESeedCoordinator(true, {
    ...reloadDeps,
    waitForHydration: async () => {},
    readClockReceipt: () => createDevE2EClockReceiptForSeed(
      'fixture-move',
      '2026-07-13T00:00:00.000Z',
    ),
  });
  let clockMismatchRejected = false;
  try {
    await clockMismatch.validateReloadCheckpoint();
  } catch {
    clockMismatchRejected = true;
  }
  ok('reload rejects a checkpoint bound to a different clock receipt', clockMismatchRejected);
  ok('reload clock mismatch exposes the exact seed identities',
    getDevE2EStateSnapshot().error ===
      'DevE2EClock reload mismatch: checkpoint seed=standard-in-season-week receipt seed=fixture-move.');

  const mismatch = new DevE2ESeedCoordinator(true, {
    ...reloadDeps,
    waitForHydration: async () => {},
    readPersistedFingerprints: async () => ({ state: 'changed' }),
  });
  let mismatchRejected = false;
  try {
    await mismatch.validateReloadCheckpoint();
  } catch {
    mismatchRejected = true;
  }
  ok('reload mismatch is rejected', mismatchRejected);
  ok('reload mismatch exposes exact store fingerprints',
    getDevE2EStateSnapshot().error ===
      'Reload persisted fingerprint mismatch for standard-in-season-week: state expected=ready actual=changed');

  const defaultCoordinatorSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'dev', 'e2e', 'defaultDevE2ESeedCoordinator.ts'),
    'utf8',
  );
  const persistenceSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'dev', 'e2e', 'devE2EPersistence.ts'),
    'utf8',
  );
  const programClear = defaultCoordinatorSource.indexOf('useProgramStore.getState().clear()');
  const oldDomainClears = [
    'clearCoachContext()',
    'clearPending()',
    'clearNotes()',
    'useCalendarStore.getState().clear()',
    'useReadinessStore.getState().clear()',
    'clearAllCoachUpdates()',
    'clearAll()',
    'clearAllModalityPreferences()',
    'useAthletePreferencesStore.getState().clear()',
    'useUIStore.getState().clear()',
    'useProfileStore.getState().clear()',
  ];
  ok('ProgramStore clears after every old domain',
    programClear >= 0 && oldDomainClears.every((needle) => {
      const domainClear = defaultCoordinatorSource.indexOf(needle);
      return domainClear >= 0 && domainClear < programClear;
    }));
  ok('dev feedback seed does not call the retired live feedback setter',
    !defaultCoordinatorSource.includes('.setSessionFeedback('));
  ok('dev feedback seed remains explicit fixture installation',
    defaultCoordinatorSource.includes('useProgramStore.setState((state) => ({') &&
      defaultCoordinatorSource.includes('[item.date]: {'));
  for (const storageKey of [
    'profile-store',
    'program-store',
    'calendar-storage',
    'readiness-store',
    'coach-store',
    'coach-memory-store',
    'coach-mutation-history-store',
    'coach-preferences-store',
    'coach-updates',
    'athlete-preferences-store',
    'ui-store',
  ]) {
    ok(`hydration/persistence includes ${storageKey}`, persistenceSource.includes(`key: '${storageKey}'`));
  }
  ok('hydration waits for every relevant persisted store',
    /Promise\.all\(semanticStores\.map\(waitForStoreHydration\)\)/.test(persistenceSource));
  ok('cold reload actively hydrates stores instead of waiting on a missed notification',
    /await descriptor\.store\.persist\.rehydrate\(\)/.test(persistenceSource) &&
      /Dev E2E store did not hydrate/.test(persistenceSource));
  ok('persistence readiness is semantic equality gated',
    /while \(!fingerprintMapsMatch\(expected, persisted\)\)/.test(persistenceSource));

  console.log(`\nDev E2E coordinator: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`  • ${failure}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
