/**
 * FixtureMutationTransaction ownership, durability and Home parity.
 * Run: npm run test:fixture-mutation-transaction
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayOfWeek, OnboardingData } from '../types/domain';
import type {
  FixtureMutationAction,
  FixtureMutationKind,
  FixtureMutationSourceMetadata,
} from '../types/fixtureMutation';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  canonicaliseHydratedState,
  PROGRAM_STORE_PERSISTENCE_KEY,
  readDurableProgramStoreEnvelope,
  useProgramStore,
} from '../store/programStore';
import {
  publishAcceptedProfileCompatibilityMirror,
  useProfileStore,
} from '../store/profileStore';
import { useCalendarStore, type CalendarDayType } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import {
  ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
  normalizeAcceptedMaterialContext,
} from '../store/acceptedStateColdStart';
import {
  completeAcceptedStateFingerprint,
} from '../store/coachMutationTransaction';
import {
  executeFixtureMutationInMemory,
  executeFixtureMutationTransaction,
  FIXTURE_MUTATION_TRANSACTION_NAME,
} from '../store/fixtureMutationTransaction';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { clearReversibleAdjustment } from '../store/reversibleAdjustmentTransaction';
import {
  beginAthleteActionTrace,
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
  getAthleteActionTracesV2,
} from '../utils/athleteActionDiagnostics';
import { executeHomeGameMutation } from '../screens/home/homeGameMutationController';

const WEEK_START = '2026-03-23';
const SATURDAY = '2026-03-28';
const SUNDAY = '2026-03-29';

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

function profile(args: {
  phase?: 'In-season' | 'Pre-season';
  withFixture?: boolean;
} = {}): OnboardingData {
  const withFixture = args.withFixture ?? true;
  return {
    seasonPhase: args.phase ?? 'In-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
    ],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Hard',
    sprintExposure: '2+ times per week',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Very consistent',
    experienceLevel: 'Advanced',
    injuries: [],
    motivation: 'Get stronger',
    usualGameDay: withFixture ? 'Saturday' : undefined,
    gameDay: withFixture ? 'Saturday' : undefined,
  };
}

function seedAcceptedWeek(args: {
  athlete: OnboardingData;
  markedDays?: Record<string, CalendarDayType>;
}): void {
  const markedDays = args.markedDays ?? (
    args.athlete.usualGameDay ? { [SATURDAY]: 'game' as const } : {}
  );
  const program = generateProgramLocally(args.athlete, {
    todayISO: WEEK_START,
    previousProgram: null,
    activeConstraints: [],
    readinessSignal: null,
  });
  useCalendarStore.setState({ markedDays, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles[0] ?? null,
    todayWorkout: null,
    blockState: null,
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    acceptedMaterialContext: normalizeAcceptedMaterialContext({
      markedDays,
      readinessSignalsByDate: {},
      activeConstraints: [],
      activeInjury: null,
      acceptedProfileSnapshot: {
        protocolVersion: ACCEPTED_PROFILE_SNAPSHOT_PROTOCOL_VERSION,
        capturedAt: `${WEEK_START}T00:00:00.000Z`,
        updatedAt: `${WEEK_START}T00:00:00.000Z`,
        sourceRevision: 1,
        onboardingData: args.athlete,
      },
      revision: 1,
      lastTransaction: 'fixture-transaction-test:seed',
    }),
  });
  publishAcceptedProfileCompatibilityMirror(args.athlete);
  useProfileStore.setState({ isOnboardingComplete: true });
  useCoachUpdatesStore.setState({
    updatesByWeek: {},
    activeConstraints: [],
    activeInjury: null,
    dismissedCoachNoteIds: [],
  });
}

function source(
  commandId: string,
  overrides: Partial<FixtureMutationSourceMetadata> = {},
): FixtureMutationSourceMetadata {
  return {
    requestedBy: 'athlete',
    producer: 'tap',
    surface: 'program_tab',
    commandId,
    ...overrides,
  };
}

function input(args: {
  action: FixtureMutationAction;
  fixtureKind: FixtureMutationKind;
  sourceDate?: string;
  targetDate?: string;
  source?: FixtureMutationSourceMetadata;
}) {
  return {
    action: args.action,
    fixtureKind: args.fixtureKind,
    ...(args.sourceDate ? { sourceDate: args.sourceDate } : {}),
    ...(args.targetDate ? { targetDate: args.targetDate } : {}),
    expectedAcceptedRevision:
      useProgramStore.getState().acceptedMaterialContext.revision,
    source: args.source ?? source(
      `test:${args.fixtureKind}:${args.action}:${args.sourceDate ?? 'none'}:${args.targetDate ?? 'none'}`,
    ),
    todayISO: WEEK_START,
  };
}

function lastAdjustment() {
  return useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
}

function visibleSemantic(athlete: OnboardingData): string {
  const state = useProgramStore.getState();
  const accepted = rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart: WEEK_START,
    profile: athlete,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
  return JSON.stringify({
    marks: state.acceptedMaterialContext.markedDays,
    workouts: accepted.visibleWorkouts.map((workout) => ({
      day: workout.dayOfWeek,
      id: workout.planEntryId,
      name: workout.name,
      type: workout.workoutType,
      tier: workout.sessionTier,
      exercises: workout.exercises.map((row) => ({
        name: row.exercise?.name,
        sets: row.prescribedSets,
        min: row.prescribedRepsMin,
        max: row.prescribedRepsMax,
      })),
    })),
    ledger: {
      strength: accepted.evaluation.ledger.mainStrength.achievedCount,
      conditioning: accepted.evaluation.ledger.conditioning.coreCount,
      patterns: accepted.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount,
    },
  });
}

async function assertFixtureMutation(args: {
  phase: 'In-season' | 'Pre-season';
  withFixture: boolean;
  action: FixtureMutationAction;
  sourceDate?: string;
  targetDate?: string;
  expectedKind: string;
  expectedMark: { date: string; value: CalendarDayType | undefined };
}): Promise<void> {
  const athlete = profile({ phase: args.phase, withFixture: args.withFixture });
  seedAcceptedWeek({
    athlete,
    markedDays: args.withFixture ? { [SATURDAY]: 'game' } : {},
  });
  const result = await executeFixtureMutationTransaction(input({
    action: args.action,
    fixtureKind: args.phase === 'Pre-season' ? 'practice_match' : 'game',
    sourceDate: args.sourceDate,
    targetDate: args.targetDate,
  }));
  assert(
    result.outcome !== 'no_change' &&
      result.outcome !== 'conflicted' &&
      result.outcome !== 'impossible',
    JSON.stringify(result),
  );
  assert(lastAdjustment()?.kind === args.expectedKind,
    `kind=${lastAdjustment()?.kind}`);
  assert(
    useProgramStore.getState().acceptedMaterialContext.markedDays[args.expectedMark.date] ===
      args.expectedMark.value,
    JSON.stringify(useProgramStore.getState().acceptedMaterialContext.markedDays),
  );
  if (args.action === 'move' && args.sourceDate) {
    assert(
      useProgramStore.getState().acceptedMaterialContext.markedDays[args.sourceDate] === undefined,
      'move did not release its source fixture date',
    );
  }
}

async function main(): Promise<void> {
  await run('1 Game add publishes through FixtureMutationTransaction', () =>
    assertFixtureMutation({
      phase: 'In-season',
      withFixture: false,
      action: 'add',
      targetDate: SATURDAY,
      expectedKind: 'game_fixture_add',
      expectedMark: { date: SATURDAY, value: 'game' },
    }));

  await run('2 Game move publishes source release and target occupation atomically', () =>
    assertFixtureMutation({
      phase: 'In-season',
      withFixture: true,
      action: 'move',
      sourceDate: SATURDAY,
      targetDate: SUNDAY,
      expectedKind: 'game_fixture_move',
      expectedMark: { date: SUNDAY, value: 'game' },
    }));

  await run('3 Game remove publishes recurring-fixture suppression', () =>
    assertFixtureMutation({
      phase: 'In-season',
      withFixture: true,
      action: 'remove',
      sourceDate: SATURDAY,
      expectedKind: 'game_fixture_remove',
      expectedMark: { date: SATURDAY, value: 'noGame' },
    }));

  await run('4 Practice Match add remains distinct from Game add', () =>
    assertFixtureMutation({
      phase: 'Pre-season',
      withFixture: false,
      action: 'add',
      targetDate: SATURDAY,
      expectedKind: 'practice_match_fixture_add',
      expectedMark: { date: SATURDAY, value: 'game' },
    }));

  await run('5 Practice Match move remains distinct from Game move', () =>
    assertFixtureMutation({
      phase: 'Pre-season',
      withFixture: true,
      action: 'move',
      sourceDate: SATURDAY,
      targetDate: SUNDAY,
      expectedKind: 'practice_match_fixture_move',
      expectedMark: { date: SUNDAY, value: 'game' },
    }));

  await run('6 Practice Match remove remains distinct from Game remove', () =>
    assertFixtureMutation({
      phase: 'Pre-season',
      withFixture: true,
      action: 'remove',
      sourceDate: SATURDAY,
      expectedKind: 'practice_match_fixture_remove',
      expectedMark: { date: SATURDAY, value: 'noGame' },
    }));

  await run('7 expected accepted-revision conflict publishes nothing', async () => {
    const athlete = profile();
    seedAcceptedWeek({ athlete });
    const before = completeAcceptedStateFingerprint();
    const beforeEnvelope = await readDurableProgramStoreEnvelope();
    const result = await executeFixtureMutationTransaction({
      ...input({
        action: 'move',
        fixtureKind: 'game',
        sourceDate: SATURDAY,
        targetDate: SUNDAY,
      }),
      expectedAcceptedRevision:
        useProgramStore.getState().acceptedMaterialContext.revision + 1,
    });
    assert(result.outcome === 'conflicted', JSON.stringify(result));
    assert(completeAcceptedStateFingerprint() === before,
      'conflict changed accepted state');
    assert((await readDurableProgramStoreEnvelope()) === beforeEnvelope,
      'conflict changed durable state');
    assert(useCoachUpdatesStore.getState().activeConstraints.length === 0,
      'conflict created a Coach Note');
  });

  await run('8 persistence failure restores fixture, program, ledger, mirrors and notes', async () => {
    const athlete = profile();
    seedAcceptedWeek({ athlete });
    const before = completeAcceptedStateFingerprint();
    const beforeEnvelope = await readDurableProgramStoreEnvelope();
    const beforeNotes = JSON.stringify(useCoachUpdatesStore.getState().activeConstraints);
    const originalSetItem = AsyncStorage.setItem.bind(AsyncStorage);
    let rejectOnce = true;
    AsyncStorage.setItem = async (key: string, value: string) => {
      if (key === PROGRAM_STORE_PERSISTENCE_KEY && rejectOnce) {
        rejectOnce = false;
        throw new Error('injected_fixture_persistence_failure');
      }
      return originalSetItem(key, value);
    };
    try {
      const result = await executeFixtureMutationTransaction(input({
        action: 'move',
        fixtureKind: 'game',
        sourceDate: SATURDAY,
        targetDate: SUNDAY,
      }));
      assert(result.outcome === 'impossible', JSON.stringify(result));
    } finally {
      AsyncStorage.setItem = originalSetItem;
    }
    assert(completeAcceptedStateFingerprint() === before,
      'persistence failure changed accepted state');
    assert((await readDurableProgramStoreEnvelope()) === beforeEnvelope,
      'persistence failure changed durable envelope');
    assert(useProgramStore.getState().acceptedMaterialContext.markedDays[SATURDAY] === 'game',
      'persistence failure did not restore the fixture');
    assert(useProgramStore.getState().reversibleAdjustmentLedger.adjustments.length === 0,
      'persistence failure did not restore the ledger');
    assert(JSON.stringify(useCoachUpdatesStore.getState().activeConstraints) === beforeNotes,
      'persistence failure did not restore Coach Notes exactly');
  });

  await run('9 fixture restoration repairs the complete recorded horizon', async () => {
    const athlete = profile();
    seedAcceptedWeek({ athlete });
    const before = visibleSemantic(athlete);
    const moved = await executeFixtureMutationTransaction(input({
      action: 'move',
      fixtureKind: 'game',
      sourceDate: SATURDAY,
      targetDate: SUNDAY,
    }));
    assert(
      moved.outcome !== 'no_change' &&
        moved.outcome !== 'conflicted' &&
        moved.outcome !== 'impossible',
      JSON.stringify(moved),
    );
    const adjustmentId = moved.result.reversibleAdjustmentId;
    assert(adjustmentId, 'move adjustment missing');
    const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments
      .find((candidate) => candidate.id === adjustmentId);
    assert(adjustment && adjustment.rollingDependencyWeeks.length > 1,
      'rolling dependency horizon missing');
    const restored = await clearReversibleAdjustment(
      adjustmentId,
      useProgramStore.getState().acceptedMaterialContext.revision,
    );
    assert(restored.outcome === 'restored', JSON.stringify(restored));
    assert(restored.affectedWeeks.length === adjustment.rollingDependencyWeeks.length,
      'restoration did not validate the complete horizon');
    assert(visibleSemantic(athlete) === before,
      'restoration did not recover the exact visible state');
    const envelope = await readDurableProgramStoreEnvelope();
    assert(envelope, 'restored durable envelope missing');
    const persisted = JSON.parse(envelope).state as ReturnType<typeof useProgramStore.getState>;
    const hydrated = canonicaliseHydratedState(persisted, {
      programAlreadyAccepted: true,
      profile: athlete,
      markedDays: persisted.acceptedMaterialContext.markedDays,
      validateWeekStarts: adjustment.rollingDependencyWeeks,
    });
    useProgramStore.setState({ ...persisted, ...hydrated });
    assert(visibleSemantic(athlete) === before,
      'hydration changed the restored fixture state');
  });

  await run('10 Game Change Coach Note uses acknowledged source metadata', async () => {
    const athlete = profile();
    seedAcceptedWeek({ athlete });
    const metadata = source('home-tap-source-proof', { turnId: 'tap-turn-1' });
    const result = await executeFixtureMutationTransaction(input({
      action: 'move',
      fixtureKind: 'game',
      sourceDate: SATURDAY,
      targetDate: SUNDAY,
      source: metadata,
    }));
    assert(
      result.outcome !== 'no_change' &&
        result.outcome !== 'conflicted' &&
        result.outcome !== 'impossible',
      JSON.stringify(result),
    );
    const adjustment = lastAdjustment();
    assert(adjustment?.sourceActor === metadata.requestedBy,
      'ledger requestedBy acknowledgement missing');
    assert(adjustment?.sourceProducer === metadata.producer,
      'ledger producer acknowledgement missing');
    assert(adjustment?.sourceSurface === metadata.surface,
      'ledger surface acknowledgement missing');
    assert(adjustment?.sourceActionOrIntentId === metadata.commandId,
      'ledger command acknowledgement missing');
    assert(adjustment?.sourceTurnId === metadata.turnId,
      'ledger turn acknowledgement missing');
    const note = useCoachUpdatesStore.getState().activeConstraints.find((constraint) =>
      constraint.id === result.noteId);
    assert(note?.type === 'schedule' && note.fixtureMutationSource?.commandId === metadata.commandId,
      'Coach Note source metadata missing');
    assert(note?.fixtureMutationTraceId === result.traceId,
      'Coach Note trace acknowledgement missing');
    assert(note?.noteProof?.kind === 'game_change' && note.noteProof.after.length > 0,
      'Coach Note proof was not derived from acknowledged visible rows');
  });

  await run('11 TraceV2 has one root for fixture action plus note projection', async () => {
    const athlete = profile();
    seedAcceptedWeek({ athlete });
    clearAthleteActionDiagnosticEvents();
    configureAthleteActionDiagnosticsForTests({
      enabled: true,
      production: false,
      now: () => new Date('2026-03-23T10:00:00.000Z'),
      sink: () => undefined,
    });
    try {
      const root = beginAthleteActionTrace({
        source: 'tap',
        actionType: 'game_day_change',
        route: 'fixture_test_root',
        targetDate: SUNDAY,
        fixtureId: `game:${SATURDAY}`,
      });
      const result = await executeFixtureMutationTransaction({
        ...input({
          action: 'move',
          fixtureKind: 'game',
          sourceDate: SATURDAY,
          targetDate: SUNDAY,
          source: source('one-root-trace'),
        }),
        trace: root,
      });
      assert(
        result.outcome !== 'no_change' &&
          result.outcome !== 'conflicted' &&
          result.outcome !== 'impossible',
        JSON.stringify(result),
      );
      const records = getAthleteActionTracesV2();
      assert(records.length === 1, `TraceV2 roots=${records.length}`);
      assert(records[0]?.traceId === root.traceId && result.traceId === root.traceId,
        'transaction did not reuse the supplied TraceV2 root');
      const fixtureIdentity = records[0]?.root.identities.fixtureId;
      assert(
        fixtureIdentity?.status === 'captured' &&
          fixtureIdentity.value === `game:${SATURDAY}` &&
          !fixtureIdentity.value.includes('one-root-trace'),
        'source metadata leaked into semantic fixture identity',
      );
      assert(records[0]?.events.some((event) =>
        event.event === 'transaction_publish_result'), 'publication span missing');
      assert(records[0]?.events.some((event) =>
        event.event === 'coach_notes_result'), 'Coach Note span missing');
    } finally {
      configureAthleteActionDiagnosticsForTests(null);
      clearAthleteActionDiagnosticEvents();
    }
  });

  await run('12 Home tap adapter is semantically identical to canonical transaction', () => {
    const athlete = profile();
    seedAcceptedWeek({ athlete });
    const home = executeHomeGameMutation({
      baseProfile: athlete,
      currentPhase: 'In-season',
      newGameDay: 'Sunday' as DayOfWeek,
      targetDate: SUNDAY,
      clearOverlayDate: SATURDAY,
      beforeRows: [],
      todayISO: WEEK_START,
    });
    assert(home.outcome !== 'impossible', JSON.stringify(home));
    const homeSemantic = visibleSemantic(athlete);

    seedAcceptedWeek({ athlete });
    const canonical = executeFixtureMutationInMemory(input({
      action: 'move',
      fixtureKind: 'game',
      sourceDate: SATURDAY,
      targetDate: SUNDAY,
      source: source('home-parity-canonical'),
    }));
    assert(
      canonical.outcome !== 'no_change' &&
        canonical.outcome !== 'conflicted' &&
        canonical.outcome !== 'impossible',
      JSON.stringify(canonical),
    );
    assert(visibleSemantic(athlete) === homeSemantic,
      'Home adapter and canonical transaction diverged');
  });

  await run('13 no-diff fixture actions create no misleading note', async () => {
    const athlete = profile();
    seedAcceptedWeek({ athlete });
    const revision = useProgramStore.getState().acceptedMaterialContext.revision;
    const result = await executeFixtureMutationTransaction(input({
      action: 'add',
      fixtureKind: 'game',
      targetDate: SATURDAY,
      source: source('no-diff-add'),
    }));
    assert(result.outcome === 'no_change', JSON.stringify(result));
    assert(useProgramStore.getState().acceptedMaterialContext.revision === revision,
      'no-diff action changed the accepted revision');
    assert(useCoachUpdatesStore.getState().activeConstraints.length === 0,
      'no-diff action created a Coach Note');
  });

  await run('14 canonical fixture transaction ownership is absent from src/screens', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path') as typeof import('path');
    const screensRoot = `${__dirname}/../screens`;
    const files: string[] = [];
    const visit = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(target);
        else if (/\.(ts|tsx)$/.test(entry.name)) files.push(target);
      }
    };
    visit(screensRoot);
    const screenSource = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    const controller = fs.readFileSync(
      `${screensRoot}/home/homeGameMutationController.ts`,
      'utf8',
    ) as string;
    const home = fs.readFileSync(
      `${screensRoot}/home/useHomeScreen.ts`,
      'utf8',
    ) as string;
    const calendar = fs.readFileSync(
      `${__dirname}/../store/calendarStore.ts`,
      'utf8',
    ) as string;
    assert(FIXTURE_MUTATION_TRANSACTION_NAME === 'FixtureMutationTransaction',
      'canonical transaction name drifted');
    assert(!/runCoachMutationTransaction|rebuildLocalWeek|upsertGameChangeCoachNoteFromDiff/
      .test(controller), 'screen compatibility wrapper still owns transaction stages');
    assert(!/function\s+FixtureMutationTransaction|class\s+FixtureMutationTransaction/
      .test(screenSource), 'canonical fixture transaction remains under src/screens');
    assert(/executeFixtureMutationTransaction\(/.test(home) &&
      !/\bsetGameDay\(|\bremoveGameDay\(/.test(home),
    'live Home fixture UI bypasses FixtureMutationTransaction');
    assert(/COMPATIBILITY-ONLY FIXTURE WRITE/.test(calendar),
      'direct CalendarStore fixture doors are not marked compatibility-only');
  });
}

void main().then(() => {
  console.log(`\nfixtureMutationTransactionTests: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
    process.exit(1);
  }
  process.exit(0);
});
