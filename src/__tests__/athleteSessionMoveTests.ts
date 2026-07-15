/**
 * Single-owner athlete move transaction and preview/commit parity.
 * Run: npm run test:athlete-session-move
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — athlete move repair must be local');
};
process.env.TZ = 'Australia/Melbourne';

import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore, canonicaliseHydratedState } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import {
  applyPlanChange,
  previewPlanChangeRisk,
  type PlanChange,
} from '../utils/planChangeProducer';
import { executeCoachCommand } from '../utils/coachCommandExecutor';
import {
  commitAthleteSessionMoveTransaction,
  commitProgramSetupRebuildTransaction,
  commitReadinessSignalTransaction,
  stageAthleteSessionMoveTransaction,
  type AthleteSessionMoveTransactionInput,
} from '../store/acceptedStateTransaction';
import { repeatWeekIntoNextWeek } from '../utils/repeatWeek';
import { rolloverProgramBlock } from '../utils/programBlockRollover';

const CURRENT_WEEK = '2026-07-13';
const FUTURE_WEEK = '2026-07-20';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}`, error);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function quiet<T>(body: () => T): T {
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

function profile(): OnboardingData {
  return {
    seasonPhase: 'In-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes',
    teamTrainingIntensity: 'Hard',
    sessionDurationMinutes: 60,
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: 'Advanced',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
  };
}

function seed(athlete: OnboardingData = profile()): TrainingProgram {
  const program = quiet(() => generateProgramLocally(athlete, {
    todayISO: CURRENT_WEEK,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: athlete.seasonPhase!,
      phaseEntryWeekStartISO: CURRENT_WEEK,
      originProvenance: 'explicit_user_phase_change',
    },
  }));
  useProfileStore.setState({ onboardingData: athlete, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: {}, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles[0] ?? null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    acceptedMaterialContext: {
      markedDays: {},
      readinessSignalsByDate: {},
      activeConstraints: [],
      activeInjury: null,
      revision: 1,
      lastTransaction: 'athlete-move-test:seed',
    },
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  });
  return program;
}

function accepted(weekStart: string) {
  const state = useProgramStore.getState();
  return rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
}

function visibleWeek(weekStart: string) {
  return resolveWeekWithConditioning(weekStart, buildScheduleStateImperative());
}

function dateForDay(weekStart: string, dayOfWeek: number): string {
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function workoutOn(weekStart: string, dayOfWeek: number): Workout | null {
  return accepted(weekStart).visibleWorkouts.find((workout) =>
    workout.dayOfWeek === dayOfWeek) ?? null;
}

function semantic(weekStart: string): string {
  return accepted(weekStart).visibleWorkouts
    .map((workout) => `${workout.dayOfWeek}:${workout.workoutType === 'Game'
      ? 'GAME'
      : workout.planEntryId ?? workout.id}:${workout.name}`)
    .sort()
    .join('|');
}

function prescriptionSignature(workout: Workout): string {
  return JSON.stringify(workout.exercises.map((row) => ({
    exerciseId: row.exerciseId,
    sets: row.prescribedSets,
    repsMin: row.prescribedRepsMin,
    repsMax: row.prescribedRepsMax,
    weight: row.prescribedWeightKg,
    rest: row.restSeconds,
  })));
}

function moveInput(weekStart: string, sourceDay = 1, targetDay = 3): AthleteSessionMoveTransactionInput {
  const source = workoutOn(weekStart, sourceDay);
  assert(source, `source day ${sourceDay} missing`);
  return {
    sourceDate: dateForDay(weekStart, sourceDay),
    targetDate: dateForDay(weekStart, targetDay),
    reason: 'test:athlete_move',
    source: 'tap',
    acceptedSourcePlanEntryId: source.planEntryId ?? null,
    sourceWorkoutId: source.id,
    originalSourceWorkout: source,
    existingTargetWorkout: workoutOn(weekStart, targetDay),
    scope: 'whole_session',
  };
}

function realDoor(change: PlanChange, weekStart: string) {
  const before = JSON.stringify({
    program: useProgramStore.getState().currentProgram,
    overlays: useProgramStore.getState().weekScopedOverlays,
    constraints: useProgramStore.getState().userRemovalConstraints,
    context: useProgramStore.getState().acceptedMaterialContext,
  });
  const week = visibleWeek(weekStart);
  const preview = previewPlanChangeRisk({
    change,
    visibleWeek: week,
    todayISO: CURRENT_WEEK,
    profile: useProfileStore.getState().onboardingData ?? undefined,
    activeConstraints: [],
  });
  const afterPreview = JSON.stringify({
    program: useProgramStore.getState().currentProgram,
    overlays: useProgramStore.getState().weekScopedOverlays,
    constraints: useProgramStore.getState().userRemovalConstraints,
    context: useProgramStore.getState().acceptedMaterialContext,
  });
  assert(afterPreview === before, 'preview mutated accepted state');
  if (!preview.ok) return { preview, commit: null };
  const commit = applyPlanChange({
    change,
    visibleWeek: week,
    todayISO: CURRENT_WEEK,
    trace: preview.trace,
    setManualOverride: () => {
      throw new Error('athlete move/delete must not use the single-date writer');
    },
  });
  return { preview, commit };
}

console.log('\n-- Athlete session move transaction --');

run('1 future Monday strength moves to Wednesday Rest through preview → commit', () => {
  seed();
  assert(workoutOn(FUTURE_WEEK, 1), 'future Monday source missing');
  assert(!workoutOn(FUTURE_WEEK, 3), 'future Wednesday must start as Rest');
  const original = clone(workoutOn(FUTURE_WEEK, 1)!);
  const result = realDoor({
    kind: 'move_session',
    fromDate: dateForDay(FUTURE_WEEK, 1),
    toDate: dateForDay(FUTURE_WEEK, 3),
  }, FUTURE_WEEK);
  assert(result.preview.ok, JSON.stringify(result.preview.rejected));
  assert(result.commit?.ok, JSON.stringify(result.commit?.rejected));
  const destination = workoutOn(FUTURE_WEEK, 3);
  assert(!workoutOn(FUTURE_WEEK, 1), 'source was not Rest after commit');
  assert(destination, 'destination did not receive source workout');
  assert(destination.planEntryId === original.planEntryId && destination.id === original.id,
    'stable identity was not preserved');
  assert(prescriptionSignature(destination) === prescriptionSignature(original),
    'prescription changed during move');
  assert(accepted(FUTURE_WEEK).evaluation.blockingViolations.length === 0,
    'moved week is not Bible-valid');
});

run('2 current-week Monday move uses the identical transaction', () => {
  seed();
  assert(!workoutOn(CURRENT_WEEK, 3), 'current Wednesday must start as Rest');
  const result = realDoor({
    kind: 'move_session',
    fromDate: dateForDay(CURRENT_WEEK, 1),
    toDate: dateForDay(CURRENT_WEEK, 3),
  }, CURRENT_WEEK);
  assert(result.preview.ok && result.commit?.ok, JSON.stringify(result));
  assert(!workoutOn(CURRENT_WEEK, 1) && !!workoutOn(CURRENT_WEEK, 3),
    'current-week move did not publish both halves');
});

run('3 occupied compatible destination swaps atomically', () => {
  const athlete: OnboardingData = {
    ...profile(),
    seasonPhase: 'Off-season',
    usualGameDay: undefined,
    gameDay: undefined,
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  };
  seed(athlete);
  const occupied = accepted(FUTURE_WEEK).visibleWorkouts.filter((workout) =>
    workout.workoutType !== 'Game' && workout.workoutType !== 'Team Training');
  assert(occupied.length >= 2, 'two occupied compatible destinations missing');
  const source = clone(occupied[0]);
  const target = clone(occupied[1]);
  const sourceDate = dateForDay(FUTURE_WEEK, source.dayOfWeek);
  const targetDate = dateForDay(FUTURE_WEEK, target.dayOfWeek);
  const result = realDoor({
    kind: 'move_session',
    fromDate: sourceDate,
    toDate: targetDate,
  }, FUTURE_WEEK);
  assert(result.preview.ok && result.commit?.ok, JSON.stringify(result));
  assert(workoutOn(FUTURE_WEEK, target.dayOfWeek)?.id === source.id,
    'source did not land on occupied destination');
  assert(workoutOn(FUTURE_WEEK, source.dayOfWeek)?.id === target.id,
    'occupied destination did not move back to source');
});

run('4 persisted move constraint owns both dates through hydration', () => {
  seed();
  const input = moveInput(FUTURE_WEEK);
  commitAthleteSessionMoveTransaction(input);
  const constraint = useProgramStore.getState().userRemovalConstraints.find((candidate) =>
    candidate.mutationKind === 'move' && candidate.targetDate === input.sourceDate);
  assert(constraint?.moveTargetDate === input.targetDate && !!constraint.movedWorkout,
    'typed source/target ownership missing');
  const persisted = clone(useProgramStore.getState());
  const hydrated = canonicaliseHydratedState(persisted, {
    programAlreadyAccepted: true,
    profile: profile(),
    markedDays: persisted.acceptedMaterialContext.markedDays,
    validateWeekStarts: [FUTURE_WEEK],
  });
  useProgramStore.setState({ ...persisted, ...hydrated });
  assert(!workoutOn(FUTURE_WEEK, 1), 'hydration resurrected source');
  assert(workoutOn(FUTURE_WEEK, 3)?.id === input.originalSourceWorkout.id,
    'hydration lost destination');
});

run('5 preview and commit publishability and accepted candidate agree', () => {
  seed();
  const week = visibleWeek(FUTURE_WEEK);
  const change: PlanChange = {
    kind: 'move_session',
    fromDate: dateForDay(FUTURE_WEEK, 1),
    toDate: dateForDay(FUTURE_WEEK, 3),
  };
  const preview = previewPlanChangeRisk({
    change,
    visibleWeek: week,
    todayISO: CURRENT_WEEK,
    profile: profile(),
  });
  const previewSemantic = preview.proposedWeek
    .map((day) => `${day.date}:${day.workout?.workoutType === 'Game'
      ? 'GAME'
      : day.workout?.planEntryId ?? day.workout?.id ?? 'REST'}`)
    .sort().join('|');
  const commit = applyPlanChange({
    change,
    visibleWeek: week,
    todayISO: CURRENT_WEEK,
    trace: preview.trace,
    setManualOverride: () => { throw new Error('unexpected single-date write'); },
  });
  const commitSemantic = visibleWeek(FUTURE_WEEK)
    .map((day) => `${day.date}:${day.workout?.workoutType === 'Game'
      ? 'GAME'
      : day.workout?.planEntryId ?? day.workout?.id ?? 'REST'}`)
    .sort().join('|');
  assert(preview.ok === commit.ok, 'preview.ok !== commit.ok');
  assert(previewSemantic === commitSemantic,
    `preview candidate differs from committed visible state\npreview=${previewSemantic}\ncommit=${commitSemantic}`);
});

run('6 induced publication failure cannot create a half-move', () => {
  seed();
  const input = moveInput(FUTURE_WEEK);
  const before = semantic(FUTURE_WEEK);
  const beforeConstraints = JSON.stringify(useProgramStore.getState().userRemovalConstraints);
  useProfileStore.setState({ onboardingData: null } as never);
  let rejected = false;
  try {
    commitAthleteSessionMoveTransaction(input);
  } catch {
    rejected = true;
  }
  assert(rejected, 'injected technical failure was not surfaced');
  assert(semantic(FUTURE_WEEK) === before, 'failure published one half of the move');
  assert(JSON.stringify(useProgramStore.getState().userRemovalConstraints) === beforeConstraints,
    'failure published move provenance');
});

run('7 tap and Coach moves converge on accepted state and provenance', () => {
  seed();
  const tap = realDoor({
    kind: 'move_session',
    fromDate: dateForDay(FUTURE_WEEK, 1),
    toDate: dateForDay(FUTURE_WEEK, 3),
  }, FUTURE_WEEK);
  assert(tap.commit?.ok, JSON.stringify(tap.commit));
  const tapState = semantic(FUTURE_WEEK);
  const tapConstraint = useProgramStore.getState().userRemovalConstraints.find((candidate) =>
    candidate.mutationKind === 'move');
  seed();
  const source = workoutOn(FUTURE_WEEK, 1)!;
  const coach = executeCoachCommand({
    command: {
      mode: 'mutate',
      operation: 'move_session',
      target: { kind: 'date', date: dateForDay(FUTURE_WEEK, 1), sessionName: source.name },
      payload: { operation: 'move_session', toDate: dateForDay(FUTURE_WEEK, 3), swap: false },
      scope: 'one_off',
      confidence: 1,
      needsClarification: false,
      reason: 'athlete_requested_move',
    },
    todayISO: CURRENT_WEEK,
    referenceResolution: null,
    userMessage: 'Move Monday strength to Wednesday',
  });
  const coachConstraint = useProgramStore.getState().userRemovalConstraints.find((candidate) =>
    candidate.mutationKind === 'move');
  assert(coach.kind === 'mutated' && coach.applied, JSON.stringify(coach));
  assert(semantic(FUTURE_WEEK) === tapState, 'tap and Coach visible states differ');
  assert(coachConstraint?.id === tapConstraint?.id &&
    coachConstraint?.moveTargetDate === tapConstraint?.moveTargetDate,
  'tap and Coach provenance differ');
});

run('8 failed preview and failed commit share the identity rejection family', () => {
  seed();
  const week = visibleWeek(FUTURE_WEEK);
  const sourceDate = dateForDay(FUTURE_WEEK, 1);
  const targetDate = dateForDay(FUTURE_WEEK, 3);
  const tampered = week.map((day) => day.date === sourceDate && day.workout
    ? { ...day, workout: { ...day.workout, id: 'stale-source-id', planEntryId: undefined } }
    : day);
  const preview = previewPlanChangeRisk({
    change: { kind: 'move_session', fromDate: sourceDate, toDate: targetDate },
    visibleWeek: tampered,
    todayISO: CURRENT_WEEK,
    profile: profile(),
  });
  const commit = applyPlanChange({
    change: { kind: 'move_session', fromDate: sourceDate, toDate: targetDate },
    visibleWeek: tampered,
    todayISO: CURRENT_WEEK,
    trace: preview.trace,
    setManualOverride: () => { throw new Error('unexpected single-date write'); },
  });
  assert(!preview.ok && !commit.ok, 'identity mismatch did not reject both paths');
  assert(/identity/i.test(preview.rejected[0]?.reason ?? '') &&
    /identity/i.test(commit.rejected[0]?.reason ?? ''),
  'preview/commit root rejection families differ');
});

run('9 move staging closes persisted rolling-horizon dependencies', () => {
  seed();
  const input = moveInput(FUTURE_WEEK);
  const dependentWeek = '2026-07-27';
  const dependent = accepted(dependentWeek).visibleWorkouts[0];
  assert(dependent, 'dependent-week workout missing');
  const program = clone(useProgramStore.getState().currentProgram!);
  const microcycle = program.microcycles.find((candidate) =>
    dependentWeek >= candidate.startDate.slice(0, 10) &&
    dependentWeek <= candidate.endDate.slice(0, 10));
  assert(microcycle, 'dependent microcycle missing');
  const stored = microcycle.workouts.find((candidate) =>
    (candidate.planEntryId ?? candidate.id) === (dependent.planEntryId ?? dependent.id));
  assert(stored, 'dependent stored workout missing');
  stored.derivedSessionProvenance = [{
    protocolVersion: 2,
    authorship: 'system',
    origin: 'rest_distribution_repair',
    scope: 'session',
    triggerSignature: 'athlete-move-cross-week-test',
    targetMetric: 'full_rest',
    credit: { metric: 'full_rest', amount: 1 },
    originatingFixtureDate: null,
    originatingDate: dependentWeek,
    validWhile: [],
    invalidWhen: [],
    history: [],
    sourcePlanEntryId: dependent.planEntryId ?? null,
    dependency: {
      kind: 'fixture_to_session',
      source: { date: input.sourceDate, weekStart: FUTURE_WEEK },
      target: { date: dependentWeek, weekStart: dependentWeek },
      crossesWeekBoundary: true,
      displacedSession: {
        targetDate: dependentWeek,
        sourcePlanEntryId: dependent.planEntryId ?? null,
        workout: clone(dependent),
      },
      restoration: {
        targetDate: dependentWeek,
        sourcePlanEntryId: dependent.planEntryId ?? null,
        workout: clone(dependent),
      },
    },
  }];
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: program.microcycles[0] ?? null,
  });
  const staged = stageAthleteSessionMoveTransaction(input, { purpose: 'preview' });
  assert(staged.affectedWeekStarts.includes(FUTURE_WEEK), 'source week missing from horizon');
  assert(staged.affectedWeekStarts.includes(dependentWeek),
    `dependent week missing from horizon: ${staged.affectedWeekStarts.join(',')}`);
});

run('10 reload, rebuild, Repeat Week and rollover retain move ownership', () => {
  const athlete = profile();
  seed(athlete);
  const input = moveInput(FUTURE_WEEK);
  commitAthleteSessionMoveTransaction(input);
  const persisted = clone(useProgramStore.getState());
  const hydrated = canonicaliseHydratedState(persisted, {
    programAlreadyAccepted: true,
    profile: athlete,
    markedDays: persisted.acceptedMaterialContext.markedDays,
    validateWeekStarts: [FUTURE_WEEK],
  });
  useProgramStore.setState({ ...persisted, ...hydrated });
  assert(!workoutOn(FUTURE_WEEK, 1), 'reload resurrected move source');
  assert(workoutOn(FUTURE_WEEK, 3)?.id === input.originalSourceWorkout.id,
    'reload lost move destination');
  const rebuilt = quiet(() => generateProgramLocally(athlete, {
    todayISO: CURRENT_WEEK,
    previousProgram: useProgramStore.getState().currentProgram,
    seasonPhaseClock: useProgramStore.getState().currentProgram?.seasonPhaseClock,
  }));
  commitProgramSetupRebuildTransaction({ program: rebuilt, profile: athlete, todayISO: CURRENT_WEEK });
  assert(!workoutOn(FUTURE_WEEK, 1), 'rebuild resurrected move source');
  assert(workoutOn(FUTURE_WEEK, 3)?.id === input.originalSourceWorkout.id,
    'rebuild lost move destination');
  repeatWeekIntoNextWeek({
    baseProfile: athlete,
    sourceWeekDate: FUTURE_WEEK,
    todayISO: CURRENT_WEEK,
  });
  assert(!workoutOn(FUTURE_WEEK, 1), 'Repeat Week resurrected concrete move source');
  assert(workoutOn(FUTURE_WEEK, 3)?.id === input.originalSourceWorkout.id,
    'Repeat Week lost concrete move destination');
  rolloverProgramBlock({ baseProfile: athlete, targetDateISO: '2026-08-10' });
  assert(useProgramStore.getState().userRemovalConstraints.some((constraint) =>
    constraint.mutationKind === 'move' &&
    constraint.targetDate === input.sourceDate &&
    constraint.moveTargetDate === input.targetDate),
  'rollover discarded move ownership');
});

run('11 a later readiness transaction or rollback retains move ownership and placement', () => {
  seed();
  const input = moveInput(FUTURE_WEEK);
  commitAthleteSessionMoveTransaction(input);
  try {
    commitReadinessSignalTransaction({
      date: dateForDay(FUTURE_WEEK, 4),
      patch: { source: 'quick_check', soreness: 'moderate' },
    });
  } catch {
    // A newly unsafe readiness candidate is allowed to reject, but the
    // accepted athlete move must still be the complete rollback state.
  }
  assert(useProgramStore.getState().userRemovalConstraints.some((constraint) =>
    constraint.mutationKind === 'move' &&
    constraint.targetDate === input.sourceDate &&
    constraint.moveTargetDate === input.targetDate),
  'readiness transaction discarded move ownership');
  assert(!workoutOn(FUTURE_WEEK, 1), 'readiness transaction resurrected move source');
  assert(workoutOn(FUTURE_WEEK, 3)?.id === input.originalSourceWorkout.id,
    'readiness transaction lost move destination');
});

run('12 direct and reload-chained moves converge on accepted state', () => {
  seed();
  commitAthleteSessionMoveTransaction(moveInput(FUTURE_WEEK));
  const direct = semantic(FUTURE_WEEK);
  seed();
  const persisted = clone(useProgramStore.getState());
  const hydrated = canonicaliseHydratedState(persisted, {
    programAlreadyAccepted: true,
    profile: profile(),
    markedDays: persisted.acceptedMaterialContext.markedDays,
    validateWeekStarts: [FUTURE_WEEK],
  });
  useProgramStore.setState({ ...persisted, ...hydrated });
  commitAthleteSessionMoveTransaction(moveInput(FUTURE_WEEK));
  assert(semantic(FUTURE_WEEK) === direct, 'direct and chained move states differ');
});

console.log(`\nAthlete session move totals: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`Failures: ${failures.join(', ')}`);
  process.exit(1);
}
