(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const diagnosticStorage = new Map<string, string>();
(global as unknown as { window: { localStorage: Storage } }).window = {
  localStorage: {
    getItem: (key: string) => diagnosticStorage.get(key) ?? null,
    setItem: (key: string, value: string) => { diagnosticStorage.set(key, value); },
    removeItem: (key: string) => { diagnosticStorage.delete(key); },
    clear: () => { diagnosticStorage.clear(); },
    key: (index: number) => Array.from(diagnosticStorage.keys())[index] ?? null,
    get length() { return diagnosticStorage.size; },
  },
};

import type { ActiveConstraint } from '../store/coachUpdatesStore';
import type { OverrideContext, Workout } from '../types/domain';
import type { ResolvedDay } from '../utils/sessionResolver';
import {
  beginAthleteActionTrace,
  clearAthleteActionDiagnosticEvents,
  configureAthleteActionDiagnosticsForTests,
  emitAthleteActionEvent,
  getAthleteActionDiagnosticEvents,
  runWithAthleteActionTrace,
  type AthleteActionDiagnosticEvent,
} from '../utils/athleteActionDiagnostics';
import { applyPlanChange } from '../utils/planChangeProducer';
import { executeCoachCommand } from '../utils/coachCommandExecutor';
import { searchWholeWeekRepairCandidates } from '../rules/wholeWeekRepairEngine';
import { commitAcceptedStateTransaction } from '../store/acceptedStateTransaction';
import { createEmptyAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { useProgramStore } from '../store/programStore';
import { createStrengthIntent } from '../rules/strengthPatternContributions';

const TODAY = '2026-07-13';
const SOURCE = '2026-07-14';
const TARGET = '2026-07-15';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`, detail ?? '');
  }
}

function enableDiagnostics(): void {
  configureAthleteActionDiagnosticsForTests({
    enabled: true,
    production: false,
    now: () => new Date('2026-07-16T10:00:00.000Z'),
    sink: () => undefined,
  });
  clearAthleteActionDiagnosticEvents();
}

function eventNames(events: readonly AthleteActionDiagnosticEvent[]): string[] {
  return events.map((event) => event.event);
}

function workout(id: string, dayOfWeek: number, name = 'Lower Strength'): Workout {
  const exercise = {
    id: `${id}:row`,
    workoutId: id,
    exerciseId: `${id}:exercise`,
    exerciseOrder: 0,
    prescribedSets: 3,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    prescribedWeightKg: 0,
    restSeconds: 90,
    exercise: {
      id: `${id}:exercise`,
      name: 'Back Squat',
      description: '',
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  };
  return {
    id,
    planEntryId: `plan:${id}`,
    microcycleId: 'diagnostic-week',
    dayOfWeek,
    name,
    description: '',
    durationMinutes: 45,
    intensity: 'Moderate',
    workoutType: 'Strength',
    sessionTier: 'core',
    strengthIntent: createStrengthIntent({
      archetype: 'lower',
      primaryPattern: 'squat',
      plannedPatterns: ['squat'],
    }),
    exercises: [exercise],
    createdAt: '2026-07-13T00:00:00.000Z',
    updatedAt: '2026-07-13T00:00:00.000Z',
  } as Workout;
}

function visibleWeek(removed = false): ResolvedDay[] {
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(`${TODAY}T12:00:00`);
    date.setDate(date.getDate() + offset);
    const iso = date.toISOString().slice(0, 10);
    const sourceWorkout = iso === SOURCE && !removed ? workout('source-session', 2) : null;
    return {
      date: iso,
      dayOfWeek: date.getDay(),
      short: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()],
      isToday: iso === TODAY,
      workout: sourceWorkout,
      source: sourceWorkout ? 'template' : 'rest',
      indicator: null,
    } as ResolvedDay;
  });
}

function resetAcceptedState(): void {
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    blockState: null,
    acceptedMaterialContext: createEmptyAcceptedMaterialContext(),
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    exposureContractsByWeek: {},
  });
}

function simpleAcceptedCommit(reason: string): void {
  commitAcceptedStateTransaction({ reason, validateWeekStarts: [] });
}

async function main(): Promise<void> {
  console.log('\n-- Athlete action diagnostic invariants --');

  // 1. One trace survives the complete tap-delete path.
  enableDiagnostics();
  resetAcceptedState();
  const tapDelete = applyPlanChange({
    change: { kind: 'remove_session', date: SOURCE },
    visibleWeek: visibleWeek(),
    todayISO: TODAY,
    setManualOverride: () => undefined,
    commitAthleteRemoval: () => simpleAcceptedCommit('diagnostic:tap_delete'),
  });
  const tapDeleteEvents = getAthleteActionDiagnosticEvents(tapDelete.traceId);
  const tapDeleteStages = eventNames(tapDeleteEvents);
  check('1 tap delete is accepted', tapDelete.ok, tapDelete);
  check('1 tap delete uses one trace through transaction, projection and UI',
    new Set(tapDeleteEvents.map((event) => event.traceId)).size === 1 &&
    [
      'athlete_action_requested',
      'athlete_action_parsed',
      'athlete_action_route_selected',
      'transaction_verification_result',
      'accepted_state_publication_result',
      'visible_projection_result',
      'athlete_action_completed',
      'athlete_ui_outcome_shown',
    ].every((stage) => tapDeleteStages.includes(stage)), tapDeleteStages);

  // 2. One trace survives the complete tap-move path.
  enableDiagnostics();
  resetAcceptedState();
  const writes: Record<string, Workout> = {};
  const contexts: Record<string, OverrideContext> = {};
  const tapMove = applyPlanChange({
    change: { kind: 'move_session', fromDate: SOURCE, toDate: TARGET },
    visibleWeek: visibleWeek(),
    todayISO: TODAY,
    setManualOverride: (date, value, context) => {
      if (value) writes[date] = value;
      else delete writes[date];
      if (context) contexts[date] = context;
      commitAcceptedStateTransaction({
        reason: `diagnostic:tap_move:${date}`,
        program: { dateOverrides: { ...writes }, overrideContexts: { ...contexts } },
        validateWeekStarts: [],
      });
    },
  });
  const tapMoveEvents = getAthleteActionDiagnosticEvents(tapMove.traceId);
  check('2 tap move is accepted', tapMove.ok, tapMove);
  check('2 tap move retains source/target and one trace across both writes',
    tapMoveEvents.length > 0 &&
    new Set(tapMoveEvents.map((event) => event.traceId)).size === 1 &&
    tapMoveEvents.every((event) => event.sourceDate === SOURCE && event.targetDate === TARGET) &&
    tapMoveEvents.filter((event) => event.event === 'accepted_state_publication_result').length >= 2,
    tapMoveEvents);

  // 3. Coach and tap routes expose equivalent diagnostic stages.
  enableDiagnostics();
  let coachRemoved = false;
  const coachResult = executeCoachCommand({
    command: {
      mode: 'mutate',
      operation: 'remove_session',
      target: { kind: 'date', date: SOURCE, sessionName: 'Lower Strength' },
      payload: { operation: 'remove_session', reason: 'diagnostic test' },
      scope: 'one_off',
      confidence: 1,
      needsClarification: false,
      reason: 'diagnostic_test',
    },
    todayISO: TODAY,
    referenceResolution: null,
    userMessage: 'remove the session',
    removeSessionDeps: {
      snapshotBefore: () => workout('source-session', 2),
      snapshotAfter: () => coachRemoved ? null : workout('source-session', 2),
      visibleWeek: () => visibleWeek(coachRemoved),
      readCalendarMark: () => null,
      applyRemove: () => {
        coachRemoved = true;
        simpleAcceptedCommit('diagnostic:coach_delete');
        return { applied: true };
      },
      rollback: () => { coachRemoved = false; },
    },
    undoDeps: {
      readDateOverride: () => ({ workout: null, context: null }),
      recordMutation: (entry) => ({
        ...entry,
        id: 'diagnostic-coach-mutation',
        timestamp: 1,
        revertedAt: null,
      }),
    },
  });
  const coachTraceId = getAthleteActionDiagnosticEvents()
    .find((event) => event.event === 'athlete_action_requested' && event.source === 'coach')?.traceId;
  const coachStages = eventNames(getAthleteActionDiagnosticEvents(coachTraceId));
  const commonStages = [
    'athlete_action_requested',
    'athlete_action_parsed',
    'athlete_action_route_selected',
    'transaction_verification_result',
    'accepted_state_publication_result',
    'visible_projection_result',
    'athlete_action_completed',
    'athlete_ui_outcome_shown',
  ];
  check('3 Coach mutation is verified', coachResult.kind === 'mutated' && coachResult.applied, coachResult);
  check('3 Coach and tap expose the same required stage set',
    commonStages.every((stage) => coachStages.includes(stage)) &&
    commonStages.every((stage) => tapDeleteStages.includes(stage)), coachStages);

  // 4. Candidate rejection codes retain the exact boundary and category.
  enableDiagnostics();
  const candidateTrace = beginAthleteActionTrace({
    source: 'tap', actionType: 'move_session', route: 'diagnostic_candidate_search',
  });
  runWithAthleteActionTrace(candidateTrace, () => searchWholeWeekRepairCandidates({
    initial: 0,
    stateSignature: String,
    assess: (candidate) => ({
      accepted: candidate === 1,
      blockingCount: candidate === 1 ? 0 : 1,
      evaluation: candidate,
    }),
    expand: (candidate) => candidate === 0 ? [1] : [],
    trace: candidateTrace,
    diagnosticBoundary: 'diagnosticBibleValidator',
    diagnosticWeekId: TODAY,
    diagnosticRejection: () => ({
      codes: ['required_strength_count'],
      invariant: 'main_strength_required_minimum',
    }),
  }));
  const rejected = getAthleteActionDiagnosticEvents(candidateTrace.traceId)
    .find((event) => event.event === 'repair_candidate_rejected');
  check('4 exact candidate rejection code and rejecting boundary survive',
    JSON.stringify(rejected?.rejectionCodes) === JSON.stringify(['required_strength_count']) &&
    rejected?.rejectingBoundary === 'diagnosticBibleValidator' &&
    rejected?.failureCategory === 'bible_contract', rejected);

  // 5. Staging failure records an atomic rollback and unchanged revision.
  enableDiagnostics();
  resetAcceptedState();
  const rollbackTrace = beginAthleteActionTrace({
    source: 'tap', actionType: 'program_change', route: 'diagnostic_rollback',
  });
  const beforeRevision = useProgramStore.getState().acceptedMaterialContext.revision;
  const throwingPatch = {} as Record<string, unknown>;
  Object.defineProperty(throwingPatch, 'currentProgram', {
    enumerable: true,
    get: () => { throw new Error('INJECTED_DIAGNOSTIC_STAGE_FAILURE'); },
  });
  try {
    runWithAthleteActionTrace(rollbackTrace, () => commitAcceptedStateTransaction({
      reason: 'diagnostic:forced_rollback',
      program: throwingPatch as never,
    }));
  } catch {
    // Expected failure injection.
  }
  const rollbackPublication = getAthleteActionDiagnosticEvents(rollbackTrace.traceId)
    .find((event) => event.event === 'accepted_state_publication_result');
  check('5 atomic rollback is recorded and state remains unchanged',
    rollbackPublication?.published === false &&
    rollbackPublication.atomicRollback === true &&
    rollbackPublication.previousStateRestored === true &&
    useProgramStore.getState().acceptedMaterialContext.revision === beforeRevision,
    rollbackPublication);

  // 6. Actual persistence completion and visible projection are logged.
  enableDiagnostics();
  const persistenceTrace = beginAthleteActionTrace({
    source: 'tap', actionType: 'program_change', route: 'diagnostic_persistence',
  });
  runWithAthleteActionTrace(persistenceTrace, () => simpleAcceptedCommit('diagnostic:persistence'));
  await new Promise((resolve) => setTimeout(resolve, 30));
  const persistenceEvents = getAthleteActionDiagnosticEvents(persistenceTrace.traceId);
  check('6 persistence result and visible projection result are both present',
    persistenceEvents.some((event) => event.event === 'persistence_result') &&
    persistenceEvents.some((event) =>
      event.event === 'visible_projection_result' && event.visibleEqualsAcceptedState === true),
    eventNames(persistenceEvents));

  // 7. Coach Note creation and clearing expose identities and restoration ownership.
  enableDiagnostics();
  resetAcceptedState();
  const noteTrace = beginAthleteActionTrace({
    source: 'tap', actionType: 'clear_adjustment', route: 'diagnostic_coach_notes',
  });
  const scheduleConstraint = {
    id: 'diagnostic-schedule-adjustment',
    type: 'schedule',
    severity: 5,
    status: 'active',
    startDate: TODAY,
    lastUpdatedAt: '2026-07-16T00:00:00.000Z',
    source: 'tap',
    weekStartISO: TODAY,
    modifierAffects: ['current_week'],
    linkedOverrideDates: [SOURCE],
    rules: [],
    safeFocus: [],
    advice: [],
  } as ActiveConstraint;
  runWithAthleteActionTrace(noteTrace, () => {
    commitAcceptedStateTransaction({
      reason: 'diagnostic:coach_note_created',
      activeConstraints: [scheduleConstraint],
      validateWeekStarts: [],
    });
    commitAcceptedStateTransaction({
      reason: 'diagnostic:coach_note_cleared',
      activeConstraints: [],
      validateWeekStarts: [],
    });
  });
  const noteEvents = getAthleteActionDiagnosticEvents(noteTrace.traceId)
    .filter((event) => event.event === 'coach_notes_result');
  check('7 Coach Note add and clear identities are logged',
    noteEvents.some((event) => (event.noteIdentitiesAdded as unknown[])?.length > 0) &&
    noteEvents.some((event) => event.adjustmentCleared === true &&
      (event.noteIdentitiesRemoved as unknown[])?.length > 0), noteEvents);

  // 8. Production configuration is a hard disable even when enabled is requested.
  configureAthleteActionDiagnosticsForTests({
    enabled: true,
    production: true,
    sink: () => undefined,
  });
  clearAthleteActionDiagnosticEvents();
  const productionTrace = beginAthleteActionTrace({
    source: 'tap', actionType: 'program_change', route: 'production_disabled_test',
  });
  emitAthleteActionEvent(productionTrace, 'athlete_action_parsed', { safeCode: 'must_not_emit' });
  check('8 production configuration emits no diagnostic events',
    getAthleteActionDiagnosticEvents().length === 0);

  // 9. Enabling diagnostics does not change candidate selection or outcome.
  configureAthleteActionDiagnosticsForTests({ enabled: false, production: false });
  const withoutDiagnostics = searchWholeWeekRepairCandidates({
    initial: 0,
    stateSignature: String,
    assess: (candidate) => ({ accepted: candidate === 2, blockingCount: 2 - candidate, evaluation: candidate }),
    expand: (candidate) => candidate < 2 ? [candidate + 1] : [],
  });
  enableDiagnostics();
  const outcomeTrace = beginAthleteActionTrace({
    source: 'tap', actionType: 'program_change', route: 'outcome_equivalence',
  });
  const withDiagnostics = searchWholeWeekRepairCandidates({
    initial: 0,
    stateSignature: String,
    assess: (candidate) => ({ accepted: candidate === 2, blockingCount: 2 - candidate, evaluation: candidate }),
    expand: (candidate) => candidate < 2 ? [candidate + 1] : [],
    trace: outcomeTrace,
  });
  check('9 logging does not change accepted outcome or selected candidate',
    JSON.stringify(withDiagnostics) === JSON.stringify(withoutDiagnostics), {
      withDiagnostics,
      withoutDiagnostics,
    });

  // 10. Default events remove sensitive state and retain compact codes.
  enableDiagnostics();
  const sensitiveTrace = beginAthleteActionTrace({
    source: 'coach', actionType: 'injury_change', route: 'sensitive_filter_test',
  });
  emitAthleteActionEvent(sensitiveTrace, 'mutation_constraint_created', {
    safeCode: 'injury_constraint_created',
    profile: { privateValue: 'SECRET_PROFILE' },
    bodyPart: 'SECRET_BODY_PART',
    healthDetails: 'SECRET_HEALTH',
    fullExercisePrescription: 'SECRET_PRESCRIPTION',
  });
  const safeEvent = getAthleteActionDiagnosticEvents(sensitiveTrace.traceId)
    .find((event) => event.event === 'mutation_constraint_created');
  const serialized = JSON.stringify(safeEvent);
  check('10 sensitive state is absent from default structured events',
    safeEvent?.safeCode === 'injury_constraint_created' &&
    !serialized.includes('SECRET_PROFILE') &&
    !serialized.includes('SECRET_BODY_PART') &&
    !serialized.includes('SECRET_HEALTH') &&
    !serialized.includes('SECRET_PRESCRIPTION'), safeEvent);

  configureAthleteActionDiagnosticsForTests(null);
  if (failed > 0) {
    console.error(`\nAthlete action diagnostics: ${passed} passed, ${failed} failed`);
    process.exit(1);
  }
  console.log(`\nAthlete action diagnostics: ${passed} passed, ${failed} failed`);
}

void main();
