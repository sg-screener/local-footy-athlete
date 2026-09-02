/**
 * FixtureMutationTransaction ownership, durability and Home parity.
 * Run: npm run test:fixture-mutation-transaction
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = true;

const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};

import { storedWorldSurfaces } from '../utils/liveEvaluationSurfaces';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayOfWeek, OnboardingData } from '../types/domain';
import type {
  FixtureMutationAction,
  FixtureMutationKind,
  FixtureMutationSourceMetadata,
} from '../types/fixtureMutation';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  canonicaliseAcceptedStateCandidate,
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
import { undoLastDecision } from '../store/undoLastDecision';
import {
  beginAthleteActionTrace,
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
  getAthleteActionTracesV2,
} from '../utils/athleteActionDiagnostics';
import { executeHomeGameMutation } from './support/homeGameMutationCompat';
import { deriveVisibleWeekLive } from '../utils/deriveVisibleWeek';
import {
  validateProgramWeek,
  validatorDaysFromResolvedWeek,
} from '../rules/weekStructureValidator';
import {
  auditFinalAutomaticWeek,
  automaticExerciseRouteForIdentity,
  workoutExerciseWasAutomaticallySelected,
} from '../rules/automaticWeeklyExerciseSelection';
import { slotDayKindForPatterns } from '../rules/sessionSlotCoverage';

const WEEK_START = '2026-03-23';
const FRIDAY = '2026-03-27';
const SATURDAY = '2026-03-28';
const SUNDAY = '2026-03-29';

let passed = 0;
const failures: string[] = [];

function automaticWeeklyRepeats(): unknown[] {
  return (useProgramStore.getState().currentProgram?.microcycles ?? []).flatMap((week) =>
    auditFinalAutomaticWeek(week.workouts.map((workout) => ({
      dayKind: slotDayKindForPatterns(workout.strengthIntent?.plannedPatterns ?? []),
      exercises: workout.exercises.filter(workoutExerciseWasAutomaticallySelected).map((row) => ({
        identity: row.exercise?.name ?? '', authorship: 'automatic' as const,
        route: row.role === 'power' ? 'power' as const
          : automaticExerciseRouteForIdentity(row.exercise?.name ?? ''),
        requestedAsMain: row.section18Evidence?.role === 'main_strength',
      })),
    }))).repeatedExact);
}

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
  phase?: OnboardingData['seasonPhase']; withFixture?: boolean;
} = {}): OnboardingData {
  const { athleteAnswers, ARCHETYPES } = require('./compilerYear/catalog') as typeof import('./compilerYear/catalog');
  const phase = args.phase ?? 'In-season';
  const base = ARCHETYPES.find(athlete => athlete.id === 'male-5-two-fixtures')!;
  // In-season onboarding requires the standing game answer. A bye is then an
  // accepted Remove, not an impossible no-game onboarding fixture.
  return athleteAnswers({ ...base, initialPhase: phase, gameDay: 'Saturday' });
}

async function seedAcceptedWeek(args: {
  athlete: OnboardingData; markedDays?: Record<string, CalendarDayType>;
}): Promise<void> {
  const { coldStartThroughOnboarding, quietAsync } = require('./support/athleteJourney') as typeof import('./support/athleteJourney');
  const installed = await quietAsync(() => coldStartThroughOnboarding({ profile: args.athlete, installDayISO: WEEK_START }));
  assert(!installed.onboardingRefusal, installed.onboardingRefusal ?? 'onboarding refused');
  if (args.athlete.seasonPhase === 'In-season' && args.markedDays && !Object.keys(args.markedDays).length) {
    const removed = await quietAsync(() => executeFixtureMutationTransaction(input({
      action: 'remove', fixtureKind: 'game', sourceDate: SATURDAY,
    })));
    assert(removed.outcome === 'accepted', JSON.stringify(removed));
  }
  for (const [date, mark] of Object.entries(args.markedDays ?? {})) {
    if (mark !== 'game') throw new Error('Fixture diagnostic requires an accepted fixture action, not synthetic marks');
    const result = await quietAsync(() => executeFixtureMutationTransaction(input({
      action: 'add', fixtureKind: args.athlete.seasonPhase === 'Pre-season' ? 'practice_match' : 'game',
      targetDate: date, source: source(`fixture-diagnostic-setup:${date}`),
    })));
    assert(result.outcome === 'accepted' || result.outcome === 'no_change', JSON.stringify(result));
  }
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
    surfaces: storedWorldSurfaces(state),
    weekStart: WEEK_START,
    profile: athlete,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
  return JSON.stringify({
    fixtureDays: accepted.visibleWorkouts.filter(workout => workout.workoutType === 'Game')
      .map(workout => workout.dayOfWeek),
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

function fixtureSafetyAcrossMaterialisedHorizon(athlete: OnboardingData): {
  strongG1: string[]; strongG2: string[]; signatures: string[];
} {
  const starts = (useProgramStore.getState().currentProgram?.microcycles ?? [])
    .map((week) => week.startDate.slice(0, 10));
  const weeks = starts.map((start) => deriveVisibleWeekLive(start, WEEK_START));
  const gameDates = weeks.flatMap((week) => week
    .filter((day) => /Game/i.test(`${day.workout?.name ?? ''} ${day.workout?.workoutType ?? ''}`))
    .map((day) => day.date));
  const strongG1: string[] = [];
  const strongG2: string[] = [];
  for (const week of weeks) {
    const report = validateProgramWeek({
      days: validatorDaysFromResolvedWeek(week),
      anchors: { gameDates },
      profile: athlete,
    });
    for (const finding of report.findings) {
      if (finding.severity !== 'strong' && finding.severity !== 'hard_stop') continue;
      if (finding.ruleId === 'g1_not_light') strongG1.push(`${finding.dates.join(',')}:${finding.message}`);
      if (finding.ruleId.startsWith('g2_')) strongG2.push(`${finding.ruleId}:${finding.dates.join(',')}`);
    }
  }
  return {
    strongG1,
    strongG2,
    signatures: weeks.map((week) => JSON.stringify(week.map((day) => ({
      date: day.date,
      id: day.workout?.planEntryId ?? day.workout?.id ?? null,
      name: day.workout?.name ?? null,
      rows: day.workout?.exercises.map((row) => row.exercise?.name) ?? [],
    })))),
  };
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
  await seedAcceptedWeek({
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
  const safety = fixtureSafetyAcrossMaterialisedHorizon(athlete);
  assert(safety.strongG1.length === 0,
    `fixture ${args.action} delivered strong G-1 work: ${safety.strongG1.join(' | ')}`);
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
      expectedMark: { date: SATURDAY, value: undefined },
    }));

  await run('7 a stale render revision does not refuse the athlete\'s decision (R1.4b)', async () => {
    // This cell used to pin the OPPOSITE: a mismatched expectedAcceptedRevision
    // answered `conflicted` and published nothing. That handshake is RETIRED
    // (R1.4b, shell rebuild): boot no longer mints revisions past the render,
    // and a fixture tap is a decision about a DATE resolved against current
    // accepted state — his device's "Couldn't update your week" was this
    // handshake refusing a change nothing conflicted with. The pin reverses:
    // a tap carrying a stale revision still LANDS, so re-adding the check
    // reds here.
    const athlete = profile();
    await seedAcceptedWeek({ athlete });
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
    assert(result.outcome !== 'conflicted',
      `the retired revision handshake refused the move again: ${JSON.stringify(result)}`);
    assert(result.outcome === 'accepted',
      `the stale-revision move did not land: ${JSON.stringify(result)}`);
  });

  await run('8 persistence failure restores fixture, program, ledger, mirrors and notes', async () => {
    const athlete = profile();
    await seedAcceptedWeek({ athlete });
    const before = completeAcceptedStateFingerprint();
    const beforeEnvelope = await readDurableProgramStoreEnvelope();
    const beforeNotes = JSON.stringify(useCoachUpdatesStore.getState().activeConstraints);
    const beforeMarks = JSON.stringify(useProgramStore.getState().acceptedMaterialContext.markedDays);
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
    assert(JSON.stringify(useProgramStore.getState().acceptedMaterialContext.markedDays) === beforeMarks,
      'persistence failure did not restore the exact fixture inputs');
    assert(useProgramStore.getState().reversibleAdjustmentLedger.adjustments.length === 0,
      'persistence failure did not restore the ledger');
    assert(JSON.stringify(useCoachUpdatesStore.getState().activeConstraints) === beforeNotes,
      'persistence failure did not restore Coach Notes exactly');
  });

  await run('9 fixture restoration repairs the complete recorded horizon', async () => {
    const athlete = profile();
    await seedAcceptedWeek({ athlete });
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
    assert(automaticWeeklyRepeats().length === 0,
      `fixture repair introduced automatic repeats: ${JSON.stringify(automaticWeeklyRepeats())}`);
    if (!('result' in moved)) throw new Error(JSON.stringify(moved));
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
    assert(restored.outcome === 'recomposed', JSON.stringify(restored));
    assert(automaticWeeklyRepeats().length === 0,
      `fixture restoration introduced automatic repeats: ${JSON.stringify(automaticWeeklyRepeats())}`);
    assert(restored.affectedWeeks.length === adjustment.rollingDependencyWeeks.length,
      'restoration did not validate the complete horizon');
    assert(visibleSemantic(athlete) === before,
      'restoration did not recover the exact visible fixtures and sessions');
    const envelope = await readDurableProgramStoreEnvelope();
    assert(envelope, 'restored durable envelope missing');
    const { relaunchApp } = require('./support/athleteJourney') as typeof import('./support/athleteJourney');
    const restart = await relaunchApp({ storage: localStorageData, todayISO: WEEK_START });
    assert(restart.ok, JSON.stringify(restart));
    assert(automaticWeeklyRepeats().length === 0,
      `fixture-repair restart introduced automatic repeats: ${JSON.stringify(automaticWeeklyRepeats())}`);
    assert(visibleSemantic(athlete) === before,
      'hydration changed the restored fixture state');
  });

  await run('10 Game Change Coach Note uses acknowledged source metadata', async () => {
    const athlete = profile();
    await seedAcceptedWeek({ athlete });
    const metadata = source('coach-fixture:coach-turn-1', {
      requestedBy: 'athlete',
      producer: 'coach',
      surface: 'coach_chat',
      turnId: 'coach-turn-1',
    });
    const result = await executeFixtureMutationTransaction(input({
      action: 'move',
      fixtureKind: 'game',
      sourceDate: SATURDAY,
      targetDate: '2026-03-25',
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
      `Coach Note source metadata missing: ${JSON.stringify({noteId: result.noteId, notes: useCoachUpdatesStore.getState().activeConstraints})}`);
    assert(note?.fixtureMutationTraceId === result.traceId,
      'Coach Note trace acknowledgement missing');
    assert(note?.noteProof?.kind === 'game_change' && note.noteProof.after.length > 0,
      'Coach Note proof was not derived from acknowledged visible rows');
  });

  await run('11 TraceV2 has one root for fixture action plus note projection', async () => {
    const athlete = profile();
    await seedAcceptedWeek({ athlete });
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
      // Store-armour writes have their own system diagnostic roots. They are
      // not extra athlete fixture actions; count the semantic action roots.
      const records = getAthleteActionTracesV2().filter(record =>
        record.root.actionType.status === 'captured' && record.root.actionType.value === 'game_day_change');
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

  await run('12 Home tap adapter is semantically identical to canonical transaction', async () => {
    const athlete = profile();
    await seedAcceptedWeek({ athlete });
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

    await seedAcceptedWeek({ athlete });
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
    await seedAcceptedWeek({ athlete });
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
    // The screen compatibility wrapper was BURNED in 3f97cc67 (zero
    // production importers) and lives on only as test support
    // (`./support/homeGameMutationCompat`). An absent file owns no
    // transaction stages, which is exactly what this cell asserts — so the
    // wrapper's source is read from wherever it still exists, or stands
    // empty when it is gone from src/screens entirely.
    const controllerPath = `${screensRoot}/home/homeGameMutationController.ts`;
    const controller = fs.existsSync(controllerPath)
      ? fs.readFileSync(controllerPath, 'utf8') as string
      : '';
    const home = fs.readFileSync(
      `${screensRoot}/home/useHomeScreen.ts`,
      'utf8',
    ) as string;
    const calendar = fs.readFileSync(
      `${__dirname}/../store/calendarStore.ts`,
      'utf8',
    ) as string;
    // Same treatment as the controller: a burned adapter cannot own a second
    // fixture mutation engine.
    const coachAdapterPath = `${__dirname}/../utils/coachFixtureChange.ts`;
    const coachAdapter = fs.existsSync(coachAdapterPath)
      ? fs.readFileSync(coachAdapterPath, 'utf8') as string
      : '';
    assert(FIXTURE_MUTATION_TRANSACTION_NAME === 'FixtureMutationTransaction',
      'canonical transaction name drifted');
    assert(!/runCoachMutationTransaction|rebuildLocalWeek|upsertGameChangeCoachNoteFromDiff/
      .test(controller), 'screen compatibility wrapper still owns transaction stages');
    assert(!/function\s+FixtureMutationTransaction|class\s+FixtureMutationTransaction/
      .test(screenSource), 'canonical fixture transaction remains under src/screens');
    assert(/executeFixtureMutationTransaction\(/.test(home) &&
      !/\bsetGameDay\(|\bremoveGameDay\(/.test(home),
    'live Home fixture UI bypasses FixtureMutationTransaction');
    assert(!/\b(?:setGameDay|removeGameDay|setNoGame|removeNoGame)\s*:/.test(calendar),
      'retired calendar fixture methods returned');
    // `utils/coachFixtureChange` was torn down with the frozen coach systems
    // (202de26f, the coach rebuild). While no adapter exists there IS no
    // second engine; when the rebuild lands one, it must route through the
    // canonical transaction like its predecessor did.
    assert(coachAdapter === '' || (
      /executeFixtureMutationTransaction\(command\)/.test(coachAdapter) &&
      !/rebuildLocalWeek|runCoachMutationTransaction|upsertGameChangeCoachNoteFromDiff/.test(coachAdapter)),
    'Coach adapter introduced a second fixture mutation engine');
  });

  await run('15 Saturday-to-Sunday repair stays G-1 safe across the next fixture, restart and Undo', async () => {
    const athlete = profile();
    await seedAcceptedWeek({ athlete });
    const before = fixtureSafetyAcrossMaterialisedHorizon(athlete);
    const mondayBefore = deriveVisibleWeekLive(WEEK_START, WEEK_START)
      .find((day) => day.date === WEEK_START)?.workout;
    assert(mondayBefore, 'known journey did not reach Monday work');
    const moved = await executeFixtureMutationTransaction(input({
      action: 'move', fixtureKind: 'game', sourceDate: SATURDAY, targetDate: SUNDAY,
      source: source('known-phone-sat-to-sun'),
    }));
    assert(moved.outcome === 'accepted', JSON.stringify(moved));
    const after = fixtureSafetyAcrossMaterialisedHorizon(athlete);
    assert(after.strongG1.length === 0,
      `published the known G-1 violation: ${after.strongG1.join(' | ')}`);
    assert(after.strongG2.length === 0,
      `published work forbidden by the existing G-2 rules: ${after.strongG2.join(' | ')}`);
    const afterRows = after.signatures.join('|');
    const mondayIdentity = mondayBefore.planEntryId ?? mondayBefore.id;
    assert(afterRows.includes(mondayIdentity),
      `displaced Monday training ${mondayIdentity} was silently deleted`);
    const exactAfter = JSON.stringify(after.signatures);
    const { relaunchApp } = require('./support/athleteJourney') as typeof import('./support/athleteJourney');
    const restart = await relaunchApp({ storage: localStorageData, todayISO: WEEK_START });
    assert(restart.ok, restart.error ?? 'restart failed');
    assert(JSON.stringify(fixtureSafetyAcrossMaterialisedHorizon(athlete).signatures) === exactAfter,
      'restart reconstructed a different repaired horizon');
    const undone = await undoLastDecision();
    assert(undone.outcome === 'undone', JSON.stringify(undone));
    assert(JSON.stringify(fixtureSafetyAcrossMaterialisedHorizon(athlete).signatures)
      === JSON.stringify(before.signatures), 'Undo did not restore the pre-move horizon');
  });

  await run('16 Sunday-to-Saturday and bye-week Remove remain G-1 safe without a blanket G-2 ban', async () => {
    const athlete = profile();
    await seedAcceptedWeek({ athlete });
    const toSunday = await executeFixtureMutationTransaction(input({
      action: 'move', fixtureKind: 'game', sourceDate: SATURDAY, targetDate: SUNDAY,
    }));
    assert(toSunday.outcome === 'accepted', JSON.stringify(toSunday));
    const toSaturday = await executeFixtureMutationTransaction(input({
      action: 'move', fixtureKind: 'game', sourceDate: SUNDAY, targetDate: SATURDAY,
    }));
    assert(toSaturday.outcome === 'accepted', JSON.stringify(toSaturday));
    assert(fixtureSafetyAcrossMaterialisedHorizon(athlete).strongG1.length === 0,
      'Sunday-to-Saturday delivered strong G-1 work');
    const removed = await executeFixtureMutationTransaction(input({
      action: 'remove', fixtureKind: 'game', sourceDate: SATURDAY,
    }));
    assert(removed.outcome === 'accepted', JSON.stringify(removed));
    assert(fixtureSafetyAcrossMaterialisedHorizon(athlete).strongG1.length === 0,
      'bye-week removal delivered strong G-1 work');
    const sourceText = require('fs').readFileSync(
      `${__dirname}/../utils/fixtureMinimalReplan.ts`, 'utf8') as string;
    assert(!/gameMinusTwoDayNumbers|gameMinusTwoDays/.test(sourceText),
      'fixture repair invented a blanket G-2 exclusion instead of using the existing validator rules');
  });

  await run('17 Friday school game plus Saturday club game are two explicit fixtures', async () => {
    const athlete = profile();
    await seedAcceptedWeek({ athlete });
    const added = await executeFixtureMutationTransaction(input({
      action: 'add', fixtureKind: 'game', targetDate: FRIDAY,
      source: source('legitimate-double:school-friday'),
    }));
    assert(added.outcome === 'accepted', JSON.stringify(added));
    const marks = useProgramStore.getState().acceptedMaterialContext.markedDays;
    assert(marks[FRIDAY] === 'game' && marks[SATURDAY] === 'game', JSON.stringify(marks));
    const visible = deriveVisibleWeekLive(WEEK_START, WEEK_START);
    const fixtures = visible.filter((day) => day.workout?.workoutType === 'Game')
      .map((day) => day.date).sort();
    assert(JSON.stringify(fixtures) === JSON.stringify([FRIDAY, SATURDAY]),
      `explicit consecutive fixtures were rejected, deleted or collapsed: ${JSON.stringify(fixtures)}`);
    const safety = fixtureSafetyAcrossMaterialisedHorizon(athlete);
    assert(safety.strongG1.length === 0 && safety.strongG2.length === 0,
      `generated work did not move around the fixed fixtures: ${JSON.stringify(safety)}`);
  });

  await run('18 Saturday and Sunday round-robin fixtures coexist; a duplicate add is no-change', async () => {
    const athlete = profile();
    await seedAcceptedWeek({ athlete });
    const added = await executeFixtureMutationTransaction(input({
      action: 'add', fixtureKind: 'game', targetDate: SUNDAY,
      source: source('legitimate-double:round-robin-sunday'),
    }));
    assert(added.outcome === 'accepted', JSON.stringify(added));
    const duplicate = await executeFixtureMutationTransaction(input({
      action: 'add', fixtureKind: 'game', targetDate: SUNDAY,
      source: source('legitimate-double:duplicate-sunday'),
    }));
    assert(duplicate.outcome === 'no_change', JSON.stringify(duplicate));
    const marks = useProgramStore.getState().acceptedMaterialContext.markedDays;
    assert(marks[SATURDAY] === 'game' && marks[SUNDAY] === 'game', JSON.stringify(marks));
  });

  await run('19 moving one explicit game preserves the other fixture', async () => {
    const athlete = profile();
    await seedAcceptedWeek({ athlete });
    const friday = await executeFixtureMutationTransaction(input({
      action: 'add', fixtureKind: 'game', targetDate: FRIDAY,
      source: source('legitimate-double:before-move'),
    }));
    assert(friday.outcome === 'accepted', JSON.stringify(friday));
    const moved = await executeFixtureMutationTransaction(input({
      action: 'move', fixtureKind: 'game', sourceDate: FRIDAY, targetDate: SUNDAY,
      source: source('legitimate-double:move-school-game'),
    }));
    assert(moved.outcome === 'accepted', JSON.stringify(moved));
    const marks = useProgramStore.getState().acceptedMaterialContext.markedDays;
    assert(marks[FRIDAY] === undefined && marks[SATURDAY] === 'game'
      && marks[SUNDAY] === 'game', JSON.stringify(marks));
  });

  await run('20 restart and Undo preserve two genuine fixtures as two facts', async () => {
    const athlete = profile();
    await seedAcceptedWeek({ athlete });
    const baseline = visibleSemantic(athlete);
    const added = await executeFixtureMutationTransaction(input({
      action: 'add', fixtureKind: 'game', targetDate: FRIDAY,
      source: source('legitimate-double:restart-undo'),
    }));
    assert(added.outcome === 'accepted', JSON.stringify(added));
    const withTwo = visibleSemantic(athlete);
    const { relaunchApp } = require('./support/athleteJourney') as typeof import('./support/athleteJourney');
    const restart = await relaunchApp({ storage: localStorageData, todayISO: WEEK_START });
    assert(restart.ok && visibleSemantic(athlete) === withTwo,
      restart.error ?? 'restart changed the two-fixture week');
    const marksAfterRestart = useProgramStore.getState().acceptedMaterialContext.markedDays;
    assert(marksAfterRestart[FRIDAY] === 'game' && marksAfterRestart[SATURDAY] === 'game',
      JSON.stringify(marksAfterRestart));
    const undone = await undoLastDecision();
    assert(undone.outcome === 'undone', JSON.stringify(undone));
    assert(visibleSemantic(athlete) === baseline,
      'Undo did not remove only the added Friday fixture and restore the original week');
    const marksAfterUndo = useProgramStore.getState().acceptedMaterialContext.markedDays;
    assert(marksAfterUndo[FRIDAY] === undefined && marksAfterUndo[SATURDAY] === 'game',
      JSON.stringify(marksAfterUndo));
  });

  // ── R-344 (Sam, 2026-09-02): a rebuilt week carries the athlete's OWN loads ──
  // Measured on the 52-week year before the fix: every bye week and every week
  // after a Sunday game read the onboarding estimate (Back Squat 95 / Bench 80
  // against the athlete's 100 / 85) and a weighted Pull-Up read "BW", because
  // the one-week fixture stub is generated without the block's progression.
  await run('R-344 / item 1: a bye week, the week after a Sunday game, and a relaunch keep the athlete\'s own loads, sets and reps, with no weekly repeat', async () => {
    const { buildWornWorld } = require('./support/settingsJourney') as typeof import('./support/settingsJourney');
    const { relaunchApp, quietAsync } = require('./support/athleteJourney') as typeof import('./support/athleteJourney');
    const { addDaysISO } = require('../utils/programBlockState') as typeof import('../utils/programBlockState');
    const { startingWeightForAthlete } = require('../utils/loadEstimation') as typeof import('../utils/loadEstimation');
    const { automaticExerciseRouteForIdentity, workoutExerciseWasAutomaticallySelected } =
      require('../rules/automaticWeeklyExerciseSelection') as typeof import('../rules/automaticWeeklyExerciseSelection');
    const athlete = profile();
    const world = await quietAsync(() => buildWornWorld({ profile: athlete, installDayISO: WEEK_START }));
    assert(world.blockTwoStart !== null && !world.rolloverRefusal,
      `the worn world must roll into block 2: ${JSON.stringify(world)}`);
    const blockTwoStart = world.blockTwoStart as string;
    // THE ACCEPTED LOADS, snapshotted before any fixture decision: name+role → kg.
    const acceptedDetail = new Map<string, string[]>();
    const ownDose = new Map<string, Map<string, [number, number, number]>>();
    const acceptedLoads = (weekStart: string): Map<string, number> => {
      const program = useProgramStore.getState().currentProgram;
      const microcycle = program?.microcycles.find((week) => week.startDate.slice(0, 10) === weekStart);
      const loads = new Map<string, number>();
      const doses = new Map<string, [number, number, number]>();
      const detail: string[] = [];
      for (const workout of microcycle?.workouts ?? []) for (const row of workout.exercises ?? []) {
        const name = row.exercise?.name; const kg = row.prescribedWeightKg;
        detail.push(`${name}@d${workout.dayOfWeek}/${row.section18Evidence?.role ?? ''}=${kg}#${row.id}`);
        if (name && typeof kg === 'number' && kg > 0) {
          loads.set(`${name}|${row.section18Evidence?.role ?? ''}`, kg);
          doses.set(`${name}|${row.section18Evidence?.role ?? ''}`,
            [row.prescribedSets, row.prescribedRepsMin, row.prescribedRepsMax]);
        }
      }
      acceptedDetail.set(weekStart, detail);
      ownDose.set(weekStart, doses);
      return loads;
    };
    const accepted = new Map<string, Map<string, number>>();
    for (let offset = 0; offset < 28; offset += 7) {
      const weekStart = addDaysISO(blockTwoStart, offset);
      accepted.set(weekStart, acceptedLoads(weekStart));
    }
    const expectOwnLoads = (weekStart: string, label: string): void => {
      const state = useProgramStore.getState();
      const visible = rebaseAcceptedEffectiveWeek({
        surfaces: storedWorldSurfaces(state), weekStart, profile: athlete,
        markedDays: state.acceptedMaterialContext.markedDays,
      }).visibleWorkouts;
      const own = accepted.get(weekStart) ?? new Map<string, number>();
      let compared = 0; let differsFromEstimate = 0;
      const wrong: string[] = [];
      // Item 1 (Sam, 2026-09-02): a rebuilt week keeps the same lift's sets and
      // reps, and never repeats an automatic strength identity across its days.
      const seen = new Map<string, number>();
      for (const workout of visible) for (const row of workout.exercises ?? []) {
        const name = row.exercise?.name ?? '';
        if (name && workoutExerciseWasAutomaticallySelected(row)
          && automaticExerciseRouteForIdentity(name) === 'strength') {
          const prior = seen.get(name);
          if (prior !== undefined && prior !== workout.dayOfWeek) {
            wrong.push(`${name} repeats on days ${prior} and ${workout.dayOfWeek}`);
          }
          seen.set(name, workout.dayOfWeek);
        }
        const kg = own.get(`${name}|${row.section18Evidence?.role ?? ''}`);
        if (kg === undefined) continue;
        compared += 1;
        if (kg !== startingWeightForAthlete(name, athlete)) differsFromEstimate += 1;
        const dose = ownDose.get(weekStart)?.get(`${name}|${row.section18Evidence?.role ?? ''}`);
        if (dose && (row.prescribedSets !== dose[0] || row.prescribedRepsMin !== dose[1]
          || row.prescribedRepsMax !== dose[2])) {
          wrong.push(`${name}: visible ${row.prescribedSets}x${row.prescribedRepsMin}-${row.prescribedRepsMax} `
            + `vs accepted ${dose[0]}x${dose[1]}-${dose[2]}`);
        }
        if (row.prescribedWeightKg !== kg) {
          wrong.push(`${name}@d${workout.dayOfWeek}/${row.section18Evidence?.role ?? ''}#${row.id} (mc ${workout.microcycleId}): `
            + `visible ${row.prescribedWeightKg} vs accepted ${kg}; accepted rows: `
            + (acceptedDetail.get(weekStart) ?? []).filter((entry) => entry.startsWith(`${name}@`)).join(', '));
        }
      }
      assert(compared >= 3, `${label}: only ${compared} lifts comparable — the cell would be vacuous`);
      assert(differsFromEstimate >= 1,
        `${label}: every accepted load equals the onboarding estimate — the cell could not see the defect`);
      assert(wrong.length === 0, `${label}: ${wrong.join('; ')}`);
    };
    const decide = (args: { action: FixtureMutationAction; sourceDate?: string; targetDate?: string; todayISO: string }) => ({
      action: args.action, fixtureKind: 'game' as const,
      ...(args.sourceDate ? { sourceDate: args.sourceDate } : {}),
      ...(args.targetDate ? { targetDate: args.targetDate } : {}),
      expectedAcceptedRevision: useProgramStore.getState().acceptedMaterialContext.revision,
      source: source(`r344:${args.action}:${args.todayISO}`),
      todayISO: args.todayISO,
    });
    // 1. THE BYE — block 2, week 1: remove Saturday's game.
    const bye = await quietAsync(() => executeFixtureMutationTransaction(
      decide({ action: 'remove', sourceDate: addDaysISO(blockTwoStart, 5), todayISO: blockTwoStart })));
    assert(bye.outcome === 'accepted', JSON.stringify(bye));
    expectOwnLoads(blockTwoStart, 'bye week');
    // 2. THE SUNDAY GAME — block 2, week 2: move Saturday to Sunday; week 3 is the dependent week.
    const weekTwo = addDaysISO(blockTwoStart, 7);
    const moved = await quietAsync(() => executeFixtureMutationTransaction(decide({
      action: 'move', sourceDate: addDaysISO(weekTwo, 5), targetDate: addDaysISO(weekTwo, 6), todayISO: weekTwo,
    })));
    assert(moved.outcome === 'accepted', JSON.stringify(moved));
    expectOwnLoads(weekTwo, 'Sunday-game week');
    expectOwnLoads(addDaysISO(weekTwo, 7), 'the week after the Sunday game');
    // 3. A RELAUNCH re-materialises the overlays through the same door.
    const restart = await relaunchApp({ storage: localStorageData, todayISO: weekTwo });
    assert(restart.ok, `relaunch failed: ${restart.error}`);
    expectOwnLoads(blockTwoStart, 'bye week after relaunch');
    expectOwnLoads(addDaysISO(weekTwo, 7), 'the week after the Sunday game, after relaunch');
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
