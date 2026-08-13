import type {
  Microcycle,
  TrainingProgram,
  Workout,
  WorkoutExercise,
} from '../types/domain';
import type {
  FeedbackCompletion,
  FeedbackFeeling,
  FeedbackSoreness,
  SessionFeedback,
  SessionFeedbackComponent,
} from '../store/programStore';
import type {
  RecordSessionOutcomeIntent,
  SessionOutcomeReason,
} from '../types/sessionOutcome';
import type { CoachContextPacket, CoachIntent } from '../utils/coachIntent';
import type { ResolvedDay } from '../utils/sessionResolver';
import {
  beginProgramPersistenceStage,
  endProgramPersistenceStage,
  persistProgramStoreEnvelopeDurably,
  useProgramStore,
} from '../store/programStore';
import { asyncStorageDurable } from '../store/asyncStorageCompat';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useCoachMutationHistoryStore } from '../store/coachMutationHistoryStore';
import { useCoachPreferencesStore } from '../store/coachPreferencesStore';
import { createEmptyAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
  resolveSessionOutcomeTarget,
  type SessionOutcomeTransactionResult,
} from '../store/sessionOutcomeTransaction';
import {
  executeCoachSessionOutcome,
  resolveCoachSessionOutcomeIntent,
} from '../utils/coachSessionOutcome';
import { getSessionComponents } from '../utils/sessionComponents';
import { buildStrengthPerformanceLogs } from '../utils/strengthLogging';
import {
  applyStrengthProgression,
  buildProgressionContext,
  buildStrengthWorkoutHistoryFromFeedback,
  deriveMissedStrengthSessionsThisWeek,
} from '../utils/strengthProgressionIntegration';
import { deriveAdaptation } from '../utils/feedbackAdapter';
import { deriveConditioningProgressionInputOverrides } from '../utils/sessionBuilder';
import {
  resolveConditioningProgression,
  type ConditioningProgressionInput,
} from '../utils/conditioningProgressionRules';
import { semanticFingerprint } from '../utils/programSemanticSnapshot';
import {
  handleCoachTurn,
  type CoachTurnDebug,
  type CoachTurnMessage,
} from '../utils/coachTurnController';
import { GAME_FEEL_OPTIONS } from '../utils/sessionFeedbackForm';
import { classifyDaySessions } from '../rules/sessionTaxonomy';
import { readFileSync } from 'fs';
import { join } from 'path';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing, cleared only by the printed
// totals. This suite sits in test:bible; unarmed, it exits 0 on a drained loop
// and the chain calls that green.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

declare const process: { exitCode?: number; env?: Record<string, string | undefined> };

const TODAY = '2026-07-16';
const TARGET_DATE = '2026-07-13';
const SECOND_DATE = '2026-07-15';
const NEXT_DATE = '2026-07-20';
const NOW = '2026-07-13T12:00:00.000Z';

let passed = 0;
let failed = 0;

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  ok ${name}`);
    return;
  }
  failed += 1;
  console.log(`  fail ${name}${detail === undefined ? '' : `\n      ${stringify(detail)}`}`);
}

function eq(name: string, actual: unknown, expected: unknown): void {
  ok(name, semanticFingerprint(actual) === semanticFingerprint(expected), { actual, expected });
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function exercise(args: {
  id: string;
  name: string;
  order: number;
  weightKg?: number;
}): WorkoutExercise {
  return {
    id: args.id,
    workoutId: 'mixed-session',
    exerciseId: args.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    exerciseOrder: args.order,
    prescribedSets: 4,
    prescribedRepsMin: 5,
    prescribedRepsMax: 5,
    prescribedWeightKg: args.weightKg,
    restSeconds: 90,
    exercise: {
      id: args.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: args.name,
      description: '',
    } as any,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const MIXED_WORKOUT: Workout = {
  id: 'mixed-session',
  planEntryId: 'plan-entry-monday-mixed',
  microcycleId: 'micro-session-outcome',
  dayOfWeek: 1,
  name: 'Lower Strength + Assault Bike Sprints',
  description: '',
  durationMinutes: 65,
  intensity: 'High',
  workoutType: 'Mixed',
  sessionTier: 'core',
  hasCombinedConditioning: true,
  attachedConditioningKind: 'component',
  conditioningFlavour: 'high-intensity',
  conditioningBlock: {
    intent: 'high-intensity',
    attachedKind: 'component',
    options: [{
      title: 'Assault Bike Sprints',
      description: 'Six hard efforts',
      exerciseIds: ['conditioning-row'],
    }],
  },
  exercises: [
    exercise({ id: 'strength-row', name: 'Back Squat', order: 1, weightKg: 100 }),
    exercise({ id: 'conditioning-row', name: 'Assault Bike Sprints', order: 2 }),
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const SECOND_WORKOUT: Workout = {
  ...MIXED_WORKOUT,
  id: 'upper-session',
  planEntryId: 'plan-entry-wednesday-upper',
  dayOfWeek: 3,
  name: 'Upper Strength',
  workoutType: 'Strength',
  hasCombinedConditioning: false,
  attachedConditioningKind: undefined,
  conditioningFlavour: undefined,
  conditioningBlock: undefined,
  exercises: [{
    ...exercise({ id: 'upper-row', name: 'Bench Press', order: 1, weightKg: 70 }),
    workoutId: 'upper-session',
  }],
};

const GAME_WORKOUT: Workout = {
  ...MIXED_WORKOUT,
  id: 'game-session',
  planEntryId: 'plan-entry-monday-game',
  name: 'Game Day',
  workoutType: 'Game',
  sessionTier: 'core',
  hasCombinedConditioning: false,
  attachedConditioningKind: undefined,
  conditioningFlavour: undefined,
  conditioningBlock: undefined,
  exercises: [],
};

const TEAM_TRAINING_WORKOUT = {
  ...MIXED_WORKOUT,
  id: 'team-training-session',
  planEntryId: 'plan-entry-monday-team-training',
  name: 'Strength + Team Training',
  workoutType: 'Mixed',
  isTeamDay: true,
} as Workout;

const MICROCYCLE: Microcycle = {
  id: 'micro-session-outcome',
  programId: 'program-session-outcome',
  weekNumber: 1,
  startDate: '2026-07-13',
  endDate: '2026-07-19',
  miniCycleNumber: 1,
  intensityMultiplier: 1,
  weekKind: 'build',
  workouts: [MIXED_WORKOUT, SECOND_WORKOUT],
  createdAt: NOW,
  updatedAt: NOW,
};

const PROGRAM: TrainingProgram = {
  id: 'program-session-outcome',
  userId: 'local',
  name: 'Session outcome parity fixture',
  description: '',
  programPhase: 'Base-Building',
  startDate: '2026-07-13',
  endDate: '2026-08-09',
  microcycles: [MICROCYCLE],
  primaryFocus: 'Parity',
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
};

type ComponentCase = {
  completion: FeedbackCompletion;
  reason: SessionOutcomeReason | null;
};

interface ParityCase {
  name: string;
  completion: FeedbackCompletion;
  feeling: FeedbackFeeling | null;
  soreness: FeedbackSoreness | null;
  reason: SessionOutcomeReason | null;
  difficulty?: number;
  strength: ComponentCase;
  conditioning: ComponentCase;
}

const CASES: ParityCase[] = [
  {
    name: 'full_easy',
    completion: 'full',
    feeling: 'easy',
    soreness: 'none',
    reason: null,
    difficulty: 4,
    strength: { completion: 'full', reason: null },
    conditioning: { completion: 'full', reason: null },
  },
  {
    name: 'full_very_hard',
    completion: 'full',
    feeling: 'very_hard',
    soreness: 'moderate',
    reason: null,
    difficulty: 9,
    strength: { completion: 'full', reason: null },
    conditioning: { completion: 'full', reason: null },
  },
  {
    name: 'partial_too_hard_today',
    completion: 'partial',
    feeling: 'hard',
    soreness: 'mild',
    reason: 'too_hard_today',
    difficulty: 8,
    strength: { completion: 'partial', reason: 'too_hard_today' },
    conditioning: { completion: 'partial', reason: 'too_hard_today' },
  },
  {
    name: 'skipped_missed',
    completion: 'skipped',
    feeling: null,
    soreness: null,
    reason: 'busy_no_time',
    strength: { completion: 'skipped', reason: 'busy_no_time' },
    conditioning: { completion: 'skipped', reason: 'busy_no_time' },
  },
  {
    name: 'strength_skipped_conditioning_full',
    completion: 'partial',
    feeling: 'good',
    soreness: 'none',
    reason: 'other',
    difficulty: 6,
    strength: { completion: 'skipped', reason: 'other' },
    conditioning: { completion: 'full', reason: null },
  },
  {
    name: 'conditioning_skipped_strength_full',
    completion: 'partial',
    feeling: 'good',
    soreness: 'none',
    reason: 'equipment_unavailable',
    difficulty: 6,
    strength: { completion: 'full', reason: null },
    conditioning: { completion: 'skipped', reason: 'equipment_unavailable' },
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function resetFixture(): Promise<void> {
  for (const key of [
    'program-store',
    'calendar-storage',
    'readiness-store',
    'coach-updates',
    'coach-mutation-history-store',
    'coach-preferences-store',
  ]) {
    await asyncStorageDurable.removeItem(key);
  }
  useCalendarStore.setState({ markedDays: {} });
  useReadinessStore.setState({ signalsByDate: {} });
  useCoachUpdatesStore.setState({
    updatesByWeek: {},
    activeConstraints: [],
    activeInjury: null,
    dismissedCoachNoteIds: [],
  });
  useCoachMutationHistoryStore.getState().clearAll();
  useCoachPreferencesStore.getState().clearAllModalityPreferences();
  useProgramStore.setState({
    currentProgram: clone(PROGRAM),
    currentMicrocycle: clone(MICROCYCLE),
    todayWorkout: null,
    blockState: null,
    acceptedMaterialContext: createEmptyAcceptedMaterialContext(),
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {
      [TARGET_DATE]: {
        'back-squat': 100,
      },
    },
    error: null,
  });
  await Promise.resolve();
}

function componentsFor(testCase: ParityCase): SessionFeedbackComponent[] {
  return getSessionComponents(MIXED_WORKOUT).map((component) => {
    const value = component.kind === 'strength'
      ? testCase.strength
      : component.kind === 'conditioning'
        ? testCase.conditioning
        : { completion: testCase.completion, reason: testCase.reason };
    return {
      componentId: component.id,
      kind: component.kind,
      label: component.label,
      completion: value.completion,
      ...(value.completion === 'partial' && value.reason
        ? { partialReason: value.reason as SessionFeedbackComponent['partialReason'] }
        : {}),
      ...(value.completion === 'skipped' && value.reason
        ? { skipReason: value.reason as SessionFeedbackComponent['skipReason'] }
        : {}),
    };
  });
}

function conditioningLog(testCase: ParityCase): SessionFeedback['conditioning'] {
  if (testCase.conditioning.completion === 'skipped') return undefined;
  return {
    sessionName: 'Assault Bike Sprints',
    mode: 'assault_bike',
    intervalsCompleted: testCase.conditioning.completion === 'full' ? 6 : 3,
    totalTimeMinutes: testCase.conditioning.completion === 'full' ? 18 : 10,
    rpe: testCase.difficulty,
  };
}

function tapFeedback(testCase: ParityCase): SessionFeedback {
  const strength = testCase.strength.completion === 'skipped'
    ? undefined
    : buildStrengthPerformanceLogs(
        MIXED_WORKOUT,
        { 'back-squat': 100 },
        testCase.strength.completion,
      );
  return {
    dateStr: TARGET_DATE,
    completion: testCase.completion,
    components: componentsFor(testCase),
    ...(testCase.feeling ? { feeling: testCase.feeling } : {}),
    ...(testCase.soreness ? { soreness: testCase.soreness } : {}),
    ...(testCase.completion === 'partial' && testCase.reason
      ? { partialReason: testCase.reason as SessionFeedback['partialReason'] }
      : {}),
    ...(testCase.completion === 'skipped' && testCase.reason
      ? { skipReason: testCase.reason as SessionFeedback['skipReason'] }
      : {}),
    ...(testCase.difficulty !== undefined ? { difficulty: testCase.difficulty } : {}),
    ...(conditioningLog(testCase) ? { conditioning: conditioningLog(testCase) } : {}),
    ...(strength?.length ? { strength } : {}),
  };
}

function visibleDay(date: string, workout: Workout): ResolvedDay {
  return {
    date,
    dayOfWeek: workout.dayOfWeek,
    short: workout.dayOfWeek === 1 ? 'MON' : 'WED',
    isToday: date === TODAY,
    workout,
    source: 'template',
    indicator: 'core',
  };
}

function packet(args: {
  message?: string;
  lastOpenedDate?: string | null;
  lastMutationDate?: string | null;
} = {}): CoachContextPacket {
  return {
    userMessage: args.message ?? 'I finished Monday and it felt solid',
    recentMessages: [],
    activeInjury: null,
    activeConstraints: [],
    coachUpdate: null,
    currentWeek: [
      visibleDay(TARGET_DATE, MIXED_WORKOUT),
      visibleDay(SECOND_DATE, SECOND_WORKOUT),
    ],
    nextWeek: [],
    sessionFeedback: {},
    todayISO: TODAY,
    ...(args.lastOpenedDate
      ? {
          lastOpenedWorkout: {
            date: args.lastOpenedDate,
            sessionName: MIXED_WORKOUT.name,
            updatedAt: Date.now(),
            source: 'day_workout',
          },
        }
      : {}),
    ...(args.lastMutationDate
      ? {
          lastMutationTarget: {
            date: args.lastMutationDate,
            sessionName: MIXED_WORKOUT.name,
            updatedAt: Date.now(),
            source: 'coach_mutation',
            lastMutationType: 'session_outcome_fixture',
          },
        }
      : {}),
  };
}

function coachIntent(testCase: ParityCase, explicitDate = true): CoachIntent {
  return {
    intent: 'record_session_outcome',
    confidence: 0.99,
    needsClarification: false,
    payload: {
      ...(explicitDate ? { targetDate: TARGET_DATE } : {}),
      completion: testCase.completion,
      feeling: testCase.feeling ?? undefined,
      soreness: testCase.soreness ?? undefined,
      outcomeReason: testCase.reason ?? undefined,
      difficulty: testCase.difficulty,
      componentOutcomes: [
        {
          kind: 'strength',
          completion: testCase.strength.completion,
          reason: testCase.strength.reason ?? undefined,
        },
        {
          kind: 'conditioning',
          completion: testCase.conditioning.completion,
          reason: testCase.conditioning.reason ?? undefined,
        },
      ],
      conditioning: conditioningLog(testCase),
    },
    rationale: 'Structured session feedback.',
  };
}

function withoutSource(intent: RecordSessionOutcomeIntent): Omit<RecordSessionOutcomeIntent, 'source'> {
  const { source: _source, ...semantic } = intent;
  return semantic;
}

function withoutReceipt(feedback: SessionFeedback): Omit<SessionFeedback, 'outcomeReceipt'> {
  const { outcomeReceipt: _receipt, ...semantic } = feedback;
  return semantic;
}

function receiptProjection(result: Extract<SessionOutcomeTransactionResult, { ok: true }>) {
  return {
    protocolVersion: result.receipt.protocolVersion,
    transactionId: result.receipt.transactionId,
    semanticFingerprint: result.receipt.semanticFingerprint,
    date: result.receipt.date,
    sessionIdentity: result.receipt.sessionIdentity,
    componentIds: result.receipt.componentIds,
  };
}

function acceptedProgramContentSnapshot(): unknown {
  const state = useProgramStore.getState();
  const coach = useCoachUpdatesStore.getState();
  return {
    currentProgram: state.currentProgram,
    currentMicrocycle: state.currentMicrocycle,
    todayWorkout: state.todayWorkout,
    dateOverrides: state.dateOverrides,
    overrideContexts: state.overrideContexts,
    weekScopedOverlays: state.weekScopedOverlays,
    userRemovalConstraints: state.userRemovalConstraints,
    exposureContractsByWeek: state.exposureContractsByWeek,
    markedDays: useCalendarStore.getState().markedDays,
    activeConstraints: coach.activeConstraints,
    activeInjury: coach.activeInjury,
    coachUpdatesByWeek: coach.updatesByWeek,
  };
}

function progressionSnapshot(feedback: SessionFeedback): unknown {
  const feedbackMap = { [TARGET_DATE]: feedback };
  const adaptation = deriveAdaptation(feedback);
  const history = buildStrengthWorkoutHistoryFromFeedback(feedbackMap, NEXT_DATE);
  const missed = deriveMissedStrengthSessionsThisWeek(feedbackMap, TODAY);
  const strengthContext = buildProgressionContext(
    'Off-season',
    'medium',
    [],
    NEXT_DATE,
    [],
    {},
    history,
    feedback.feeling ?? null,
    [feedback],
    adaptation,
    { missedSessionsThisWeek: missed },
  );
  const progressedStrength = applyStrengthProgression(MIXED_WORKOUT, strengthContext);
  const conditioningOverrides = deriveConditioningProgressionInputOverrides({
    feedback,
    exercises: MIXED_WORKOUT.exercises,
    baseDuration: 18,
  });
  const conditioningInput: ConditioningProgressionInput = {
    tier: 'B-high',
    capacity: 'medium',
    recentRPE: 6,
    completionQuality: 'full',
    hasRecentFeedback: false,
    hasAvoidInjury: false,
    hasModifyInjury: false,
    seasonPhase: 'Off-season',
    weeklyConditioningCount: 1,
    daysToGame: null,
    doubleGameWeek: false,
    highFatigueStrengthThisWeek: false,
    lastSessionProgressed: false,
    weeklyLoad: 0,
    previousWeekLoad: 0,
    currentReps: 6,
    currentIntervals: 6,
    currentDuration: 18,
    currentRest: 60,
    ...conditioningOverrides,
  };
  const conditioningDecision = resolveConditioningProgression(conditioningInput);
  return {
    adaptation,
    missed,
    history,
    strengthRows: progressedStrength.exercises.map((row) => ({
      id: row.id,
      sets: row.prescribedSets,
      repsMin: row.prescribedRepsMin,
      repsMax: row.prescribedRepsMax,
      weightKg: row.prescribedWeightKg,
      restSeconds: row.restSeconds,
    })),
    strengthDecision: (progressedStrength as any)._progressionResults,
    conditioningOverrides,
    conditioningDecision,
  };
}

async function hydratedFeedback(): Promise<SessionFeedback | undefined> {
  const token = beginProgramPersistenceStage();
  useProgramStore.setState({ sessionFeedback: {} });
  endProgramPersistenceStage(token);
  await useProgramStore.persist.rehydrate();
  return useProgramStore.getState().sessionFeedback[TARGET_DATE];
}

interface RouteSnapshot {
  result: Extract<SessionOutcomeTransactionResult, { ok: true }>;
  feedback: SessionFeedback;
  durableFeedback: SessionFeedback;
  hydratedFeedback: SessionFeedback;
  progression: unknown;
  programBefore: unknown;
  programAfter: unknown;
}

async function runTap(testCase: ParityCase): Promise<RouteSnapshot> {
  await resetFixture();
  const programBefore = acceptedProgramContentSnapshot();
  const intent = createRecordSessionOutcomeIntentFromFeedback({
    date: TARGET_DATE,
    feedback: tapFeedback(testCase),
    workout: MIXED_WORKOUT,
    todayISO: TODAY,
    source: { entryPoint: 'tap', surface: 'parity_harness' },
  });
  const result = await commitSessionOutcomeTransaction(intent);
  if (!result.ok) throw new Error(`tap failed: ${result.code}: ${result.reason}`);
  const programAfter = acceptedProgramContentSnapshot();
  const durableFeedback = JSON.parse(result.persistedEnvelope).state.inputs.sessionFeedback[TARGET_DATE];
  const rehydrated = await hydratedFeedback();
  if (!rehydrated) throw new Error('tap hydration did not restore feedback');
  return {
    result,
    feedback: result.feedback,
    durableFeedback,
    hydratedFeedback: rehydrated,
    progression: progressionSnapshot(rehydrated),
    programBefore,
    programAfter,
  };
}

async function runCoach(testCase: ParityCase): Promise<RouteSnapshot> {
  await resetFixture();
  const programBefore = acceptedProgramContentSnapshot();
  const execution = await executeCoachSessionOutcome(coachIntent(testCase), packet());
  if (execution.kind !== 'recorded') {
    throw new Error(`coach failed: ${execution.kind}`);
  }
  const result = execution.result;
  const programAfter = acceptedProgramContentSnapshot();
  const durableFeedback = JSON.parse(result.persistedEnvelope).state.inputs.sessionFeedback[TARGET_DATE];
  const rehydrated = await hydratedFeedback();
  if (!rehydrated) throw new Error('coach hydration did not restore feedback');
  return {
    result,
    feedback: result.feedback,
    durableFeedback,
    hydratedFeedback: rehydrated,
    progression: progressionSnapshot(rehydrated),
    programBefore,
    programAfter,
  };
}

async function runParityCases(): Promise<void> {
  console.log('\n-- Session outcome metamorphic parity --');
  for (const testCase of CASES) {
    const tap = await runTap(testCase);
    const coach = await runCoach(testCase);
    const prefix = testCase.name;
    eq(`${prefix}: normalized canonical intent`,
      withoutSource(tap.result.normalizedIntent),
      withoutSource(coach.result.normalizedIntent));
    eq(`${prefix}: accepted feedback`,
      withoutReceipt(tap.feedback),
      withoutReceipt(coach.feedback));
    eq(`${prefix}: durable feedback`,
      withoutReceipt(tap.durableFeedback),
      withoutReceipt(coach.durableFeedback));
    eq(`${prefix}: hydration feedback`,
      withoutReceipt(tap.hydratedFeedback),
      withoutReceipt(coach.hydratedFeedback));
    eq(`${prefix}: typed receipt identity`,
      receiptProjection(tap.result),
      receiptProjection(coach.result));
    eq(`${prefix}: progression decisions`, tap.progression, coach.progression);
    eq(`${prefix}: tap leaves program content unchanged`, tap.programBefore, tap.programAfter);
    eq(`${prefix}: Coach leaves program content unchanged`, coach.programBefore, coach.programAfter);
    ok(`${prefix}: durable receipt is present`,
      !!tap.hydratedFeedback.outcomeReceipt && !!coach.hydratedFeedback.outcomeReceipt);
  }
}

async function runProtocolInvariants(): Promise<void> {
  console.log('\n-- Session outcome protocol invariants --');

  await resetFixture();
  const duplicateIntent = createRecordSessionOutcomeIntentFromFeedback({
    date: TARGET_DATE,
    feedback: tapFeedback(CASES[0]),
    workout: MIXED_WORKOUT,
    source: { entryPoint: 'tap', surface: 'duplicate_test' },
  });
  const first = await commitSessionOutcomeTransaction(duplicateIntent);
  const second = await commitSessionOutcomeTransaction(duplicateIntent);
  ok('first identical command commits', first.ok && first.status === 'committed', first);
  ok('duplicate identical command is idempotent', second.ok && second.status === 'idempotent', second);
  if (first.ok && second.ok) {
    eq('duplicate returns the original receipt', first.receipt, second.receipt);
  }
  ok('duplicate leaves one feedback fact', Object.keys(useProgramStore.getState().sessionFeedback).length === 1);

  await resetFixture();
  const staleIdentity: RecordSessionOutcomeIntent = {
    ...createRecordSessionOutcomeIntentFromFeedback({
      date: TARGET_DATE,
      feedback: tapFeedback(CASES[0]),
      workout: MIXED_WORKOUT,
      source: { entryPoint: 'tap', surface: 'identity_test' },
    }),
    sessionIdentity: { workoutId: 'stale-workout-id' },
  };
  const rejected = await commitSessionOutcomeTransaction(staleIdentity);
  ok('stale workout identity is rejected',
    !rejected.ok && rejected.code === 'workout_identity_mismatch',
    rejected);
  ok('identity rejection publishes no feedback',
    !useProgramStore.getState().sessionFeedback[TARGET_DATE]);

  await resetFixture();
  const staleComponent = createRecordSessionOutcomeIntentFromFeedback({
    date: TARGET_DATE,
    feedback: tapFeedback(CASES[0]),
    workout: MIXED_WORKOUT,
    source: { entryPoint: 'tap', surface: 'component_identity_test' },
  });
  staleComponent.componentOutcomes[0] = {
    ...staleComponent.componentOutcomes[0],
    componentId: 'stale-component-id',
  };
  const componentRejected = await commitSessionOutcomeTransaction(staleComponent);
  ok('stale component identity is rejected',
    !componentRejected.ok && componentRejected.code === 'component_identity_mismatch',
    componentRejected);
  ok('component rejection publishes no feedback',
    !useProgramStore.getState().sessionFeedback[TARGET_DATE]);

  await resetFixture();
  const ambiguous = resolveCoachSessionOutcomeIntent(
    coachIntent(CASES[0], false),
    packet({ message: 'That session felt easy' }),
  );
  ok('ambiguous recent target asks one clarification', ambiguous.kind === 'clarify', ambiguous);
  const contextual = resolveCoachSessionOutcomeIntent(
    coachIntent(CASES[0], false),
    packet({ message: 'It felt easy', lastOpenedDate: TARGET_DATE }),
  );
  ok('opened workout resolves a multi-turn target', contextual.kind === 'ready', contextual);
  const mutationContext = resolveCoachSessionOutcomeIntent(
    coachIntent(CASES[0], false),
    packet({ message: 'That one felt easy', lastMutationDate: TARGET_DATE }),
  );
  ok('mutation history resolves a follow-up target', mutationContext.kind === 'ready', mutationContext);

  const futureEdit: CoachIntent = {
    intent: 'request_program_adjustment',
    confidence: 0.99,
    needsClarification: false,
    payload: {
      operation: 'change_duration',
      targetDate: NEXT_DATE,
      durationMinutes: 45,
    },
  };
  ok('future make-easier/edit intent is not session feedback',
    resolveCoachSessionOutcomeIntent(futureEdit, packet()).kind === 'not_outcome');

  let futureCode: string | null = null;
  try {
    resolveSessionOutcomeTarget(NEXT_DATE, TODAY);
  } catch (error) {
    futureCode = (error as { detailCode?: string }).detailCode ?? null;
  }
  ok('future outcome target is rejected against the command clock',
    futureCode === 'future_session_outcome', futureCode);

  await resetFixture();
  const missedBefore = acceptedProgramContentSnapshot();
  const missed = await executeCoachSessionOutcome(coachIntent(CASES[3]), packet());
  ok('missed attendance is recorded', missed.kind === 'recorded', missed);
  eq('missed attendance does not move/delete/change content',
    missedBefore,
    acceptedProgramContentSnapshot());
  ok('missed attendance creates no constraint or injury',
    useCoachUpdatesStore.getState().activeConstraints.length === 0 &&
      useCoachUpdatesStore.getState().activeInjury === null);

  await resetFixture();
  const equipment = await executeCoachSessionOutcome(coachIntent(CASES[5]), packet());
  ok('equipment reason is accepted as feedback', equipment.kind === 'recorded', equipment);
  ok('equipment reason creates no constraint or Coach Note',
    useCoachUpdatesStore.getState().activeConstraints.length === 0 &&
      Object.keys(useCoachUpdatesStore.getState().updatesByWeek).length === 0);

  await resetFixture();
  const sore = await executeCoachSessionOutcome(coachIntent(CASES[1]), packet());
  ok('post-session soreness is accepted as feedback', sore.kind === 'recorded', sore);
  ok('post-session soreness creates no injury/constraint',
    useCoachUpdatesStore.getState().activeInjury === null &&
      useCoachUpdatesStore.getState().activeConstraints.length === 0);

  await resetFixture();
  const controllerMessages: CoachTurnMessage[] = [];
  const controllerUser: CoachTurnMessage = {
    id: 'session-outcome-controller-user',
    role: 'user',
    content: 'Monday was very hard but I finished it',
  };
  let classifierCalls = 0;
  let debug: CoachTurnDebug | null = null;
  const controllerResult = await handleCoachTurn({
    userMessage: controllerUser,
    messages: controllerMessages,
    todayISO: TODAY,
    classifier: {
      classify: async () => {
        classifierCalls += 1;
        return {
          status: 'classified' as const,
          provenance: 'deterministic' as const,
          intent: coachIntent(CASES[1]),
        };
      },
    },
    pendingCoachProposal: null,
    pendingReadiness: null,
    pendingInjury: null,
    smokeCoachBikeFlow: false,
    isFocused: true,
    smokeWednesdayMissingReason: null,
    smokeWednesdayOpenTarget: null,
    setPendingCoachProposal: () => {},
    setPendingReadiness: () => {},
    appendUser: () => controllerMessages.push(controllerUser),
    appendAssistant: (message) => controllerMessages.push(message),
    appendUserAndAssistant: (message) => controllerMessages.push(controllerUser, message),
    clearInput: () => {},
    setIsLoading: () => {},
    setCoachProgressLabel: () => {},
    startSetupRebuildProgress: () => {},
    clearSetupRebuildProgress: () => {},
    setLastCoachDebug: (next) => { debug = next; },
    semanticProgramEditDraftMode: 'off',
    coachRevisionProposalMode: 'off',
  });
  ok('Coach controller handles outcome at the typed front door', controllerResult.handled);
  ok('Coach controller classifies the turn exactly once', classifierCalls === 1);
  ok('Coach controller reports the verified transaction route',
    debug?.route === 'session_outcome:recorded', debug);
  ok('Coach controller publishes durable feedback before replying',
    !!useProgramStore.getState().sessionFeedback[TARGET_DATE]?.outcomeReceipt &&
      controllerMessages.some((message) => message.role === 'assistant'));
}

async function runLegacyHydrationInvariant(): Promise<void> {
  console.log('\n-- Legacy session feedback hydration --');
  await resetFixture();
  const legacy: SessionFeedback = {
    dateStr: TARGET_DATE,
    completion: 'full',
    feeling: 'good',
  };
  const token = beginProgramPersistenceStage();
  useProgramStore.setState({ sessionFeedback: { [TARGET_DATE]: legacy } });
  await persistProgramStoreEnvelopeDurably(token);
  endProgramPersistenceStage(token);

  const clearToken = beginProgramPersistenceStage();
  useProgramStore.setState({ sessionFeedback: {} });
  endProgramPersistenceStage(clearToken);
  await useProgramStore.persist.rehydrate();
  const hydrated = useProgramStore.getState().sessionFeedback[TARGET_DATE];
  eq('legacy feedback survives hydration unchanged', hydrated, legacy);
  ok('legacy feedback remains readable without a receipt', hydrated?.outcomeReceipt === undefined);
}

async function runGameFeedbackInvariants(): Promise<void> {
  console.log('\n-- Game feedback transaction invariants --');
  ok('the ruled five-point wording is exact',
    GAME_FEEL_OPTIONS.map((option) => option.label).join(',')
      === 'Heavy,Bad,Normal,Good,Flying',
    GAME_FEEL_OPTIONS);
  const panelSource = readFileSync(
    join(__dirname, '..', 'components', 'SessionFeedbackPanel.tsx'),
    'utf8',
  );
  const gameCopySource = readFileSync(
    join(__dirname, '..', 'rules', 'gameFeedback.ts'),
    'utf8',
  );
  ok('one panel selects the match form through the shared game taxonomy',
    /classifyDaySessions\(props\.workout\)[\s\S]{0,160}GameSessionFeedbackPanel/.test(panelSource),
    panelSource.length);
  const practiceMatchWorkout: Workout = {
    ...GAME_WORKOUT,
    id: 'practice-match-session',
    name: 'Practice Match',
    fixtureVariant: 'practice_match',
  };
  ok('scheduled games and practice matches share the game feedback classification',
    classifyDaySessions(GAME_WORKOUT).some((unit) => unit.category === 'game')
      && classifyDaySessions(practiceMatchWorkout).some((unit) => unit.category === 'game'));
  ok('the match form asks all four ruled questions',
    ['Did you play the whole game?', 'Rough time on ground',
      'How hard was the game on your body?', 'How do you feel?']
      .every((question) => gameCopySource.includes(question))
      && /GAME_FEEDBACK_COPY\.wholeQuestion/.test(panelSource)
      && /GAME_FEEDBACK_COPY\.durationQuestion/.test(panelSource)
      && /GAME_FEEDBACK_COPY\.rpeQuestion/.test(panelSource)
      && /GAME_FEEDBACK_COPY\.feelQuestion/.test(panelSource));
  // INVERTED 2026-08-12, NOT DELETED — and note this cell's last clause was the
  // one that FORBADE the 1-10 anchor. Sam reversed the 2026-08-11 ruling it
  // encoded ("make it 1-10 everywhere") because the 1-5 scale shared `difficulty`
  // with the 1-10 conditioning RPE, and the reader — written for 1-10 — took a
  // strength session's "very hard" 5 as EASY and added volume for it.
  // `docs/EFFORT_SCALE_INVERSION_2026-08-12.md`. The forbidding clause now
  // points the other way, so the retired scale cannot creep back.
  ok('game and practice-match effort use the SLIDER on the 1-10 scale',
    /game-feedback-rpe-grid/.test(panelSource)
      && /<EffortSlider/.test(panelSource)
      && /GAME_FEEDBACK_COPY\.rpeHint/.test(panelSource)
      && gameCopySource.includes('1 = very easy · 10 = very hard')
      && !gameCopySource.includes('1 = very easy · 5 = very hard'));
  ok('the game effort starts EMPTY — an untouched form is not an answer',
    /const \[bodyRpe, setBodyRpe\] = useState<number \| null>\(initialGame\?\.bodyRpe \?\? null\)/
      .test(panelSource));
  ok('the match form writes the complete game payload through the shared transaction',
    /const game: GameSessionOutcome = \{[\s\S]{0,220}playedWholeGame[\s\S]{0,220}timeOnGroundMinutes[\s\S]{0,220}bodyRpe[\s\S]{0,220}feel: gameFeel/.test(panelSource)
      && /createRecordSessionOutcomeIntentFromFeedback\(\{[\s\S]{0,300}surface: 'game_feedback_panel'/.test(panelSource));
  await resetFixture();
  const gameMicrocycle: Microcycle = {
    ...clone(MICROCYCLE),
    workouts: [clone(GAME_WORKOUT), clone(SECOND_WORKOUT)],
  };
  const gameProgram: TrainingProgram = {
    ...clone(PROGRAM),
    microcycles: [gameMicrocycle],
  };
  useProgramStore.setState({
    currentProgram: gameProgram,
    currentMicrocycle: gameMicrocycle,
  });
  useCalendarStore.setState({ markedDays: { [TARGET_DATE]: 'game' } });

  const game = {
    playedWholeGame: false,
    timeOnGroundMinutes: 83,
    bodyRpe: 4,
    feel: 3 as const,
  };
  const feedback: SessionFeedback = {
    dateStr: TARGET_DATE,
    completion: 'full',
    game,
  };
  const gameTarget = resolveSessionOutcomeTarget(TARGET_DATE, TODAY);
  const intent = createRecordSessionOutcomeIntentFromFeedback({
    date: TARGET_DATE,
    feedback,
    workout: gameTarget.workout,
    source: { entryPoint: 'tap', surface: 'game_feedback_test' },
  });
  eq('game payload survives the tap adapter unchanged', intent.game, game);
  const beforeProgram = acceptedProgramContentSnapshot();
  const result = await commitSessionOutcomeTransaction(intent, TODAY);
  ok('complete game payload commits through the shared outcome transaction', result.ok, result);
  eq('the persisted dated feedback carries the complete game payload',
    useProgramStore.getState().sessionFeedback[TARGET_DATE]?.game,
    game);
  eq('the durable program envelope carries the complete game payload',
    JSON.parse(result.ok ? result.persistedEnvelope : '{}')
      ?.state?.inputs?.sessionFeedback?.[TARGET_DATE]?.game,
    game);
  eq('the complete game payload survives program-store hydration',
    (await hydratedFeedback())?.game,
    game);
  ok('new game writes do not create the legacy standalone gameFeel field',
    useProgramStore.getState().sessionFeedback[TARGET_DATE]?.gameFeel === undefined);
  eq('saving game feedback leaves program content unchanged',
    acceptedProgramContentSnapshot(),
    beforeProgram);
  ok('saving game feedback creates no modifier or injury',
    useCoachUpdatesStore.getState().activeConstraints.length === 0
      && useCoachUpdatesStore.getState().activeInjury === null);

  await resetFixture();
  const nonGameIntent = createRecordSessionOutcomeIntentFromFeedback({
    date: TARGET_DATE,
    feedback,
    workout: MIXED_WORKOUT,
    source: { entryPoint: 'tap', surface: 'game_feedback_non_game_test' },
  });
  const nonGameResult = await commitSessionOutcomeTransaction(nonGameIntent, TODAY);
  ok('a non-game visible session refuses a game payload',
    !nonGameResult.ok && 'code' in nonGameResult
      && nonGameResult.code === 'game_outcome_on_non_game',
    nonGameResult);

  await resetFixture();
  useProgramStore.setState({
    currentProgram: gameProgram,
    currentMicrocycle: gameMicrocycle,
  });
  useCalendarStore.setState({ markedDays: { [TARGET_DATE]: 'game' } });
  const invalidTarget = resolveSessionOutcomeTarget(TARGET_DATE, TODAY);
  const invalidIntent = createRecordSessionOutcomeIntentFromFeedback({
    date: TARGET_DATE,
    feedback: {
      ...feedback,
      // 11, NOT 6 — 6 became a LEGAL rating when Sam moved every effort input
      // to 1-10 on 2026-08-12. This cell pinned the old ceiling and would
      // otherwise have asserted that a rating the slider now offers must be
      // refused, which is the drift it exists to prevent.
      game: { ...game, bodyRpe: 11 } as SessionFeedback['game'],
    },
    workout: invalidTarget.workout,
    source: { entryPoint: 'tap', surface: 'game_feedback_invalid_test' },
  });
  const invalidResult = await commitSessionOutcomeTransaction(invalidIntent, TODAY);
  ok('an incomplete or out-of-range game payload is refused at the transaction',
    !invalidResult.ok && 'code' in invalidResult
      && invalidResult.code === 'invalid_game_outcome',
    invalidResult);

  await resetFixture();
  const teamMicrocycle: Microcycle = {
    ...clone(MICROCYCLE),
    workouts: [clone(TEAM_TRAINING_WORKOUT), clone(SECOND_WORKOUT)],
  };
  const teamProgram: TrainingProgram = {
    ...clone(PROGRAM),
    microcycles: [teamMicrocycle],
  };
  useProgramStore.setState({
    currentProgram: teamProgram,
    currentMicrocycle: teamMicrocycle,
  });
  const teamMeasurement = { durationMinutes: 95, effort: 4 };
  const teamTarget = resolveSessionOutcomeTarget(TARGET_DATE, TODAY);
  const teamIntent = createRecordSessionOutcomeIntentFromFeedback({
    date: TARGET_DATE,
    feedback: {
      dateStr: TARGET_DATE,
      completion: 'full',
      teamTraining: teamMeasurement,
    },
    workout: teamTarget.workout,
    source: { entryPoint: 'tap', surface: 'team_training_feedback_test' },
  });
  eq('team-training measurement survives the tap adapter unchanged',
    teamIntent.teamTraining,
    teamMeasurement);
  const teamResult = await commitSessionOutcomeTransaction(teamIntent, TODAY);
  ok('team-training duration and effort commit through the shared outcome transaction',
    teamResult.ok,
    teamResult);
  eq('the persisted dated feedback carries the complete team-training measurement',
    useProgramStore.getState().sessionFeedback[TARGET_DATE]?.teamTraining,
    teamMeasurement);
  eq('the durable program envelope carries the complete team-training measurement',
    JSON.parse(teamResult.ok ? teamResult.persistedEnvelope : '{}')
      ?.state?.inputs?.sessionFeedback?.[TARGET_DATE]?.teamTraining,
    teamMeasurement);
}

async function main(): Promise<void> {
  if (process.env?.GAME_FEEDBACK_ONLY === '1') {
    await runGameFeedbackInvariants();
    console.log(`\nGame feedback outcome: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
    return;
  }
  await runParityCases();
  await runProtocolInvariants();
  await runGameFeedbackInvariants();
  await runLegacyHydrationInvariant();
  console.log(`\nSession outcome parity: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  failed += 1;
  console.error(error);
  process.exitCode = 1;
});
