/**
 * Single-owner athlete move transaction and preview/commit parity.
 * Run: npm run test:athlete-session-move
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
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — athlete move repair must be local');
};
process.env.TZ = 'Australia/Melbourne';


import { storedWorldSurfaces } from '../utils/liveEvaluationSurfaces';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import type { OnboardingData, TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import {
  PROGRAM_STORE_PERSISTENCE_KEY,
  canonicaliseAcceptedStateCandidate,
  readDurableProgramStoreEnvelope,
  useProgramStore,
} from '../store/programStore';
import { useProfileStore, applyProfileOnboardingWrite } from '../store/profileStore';
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
import {
  commitAthleteSessionMoveTransaction,
  commitProgramSetupRebuildTransaction,
  commitReadinessSignalTransaction,
  stageAthleteSessionMoveTransaction,
  type AthleteSessionMoveTransactionInput,
} from '../store/acceptedStateTransaction';
import { rolloverProgramBlock } from '../utils/programBlockRollover';
import {
  createEmptyReversibleAdjustmentLedger,
  normalizeReversibleAdjustmentLedger,
} from '../rules/reversibleAdjustmentLedger';
import { commitClearReversibleAdjustment } from '../store/reversibleAdjustmentTransaction';
import { clearReversibleAdjustment } from '../store/reversibleAdjustmentTransaction';
import { executeProgramControlActionDurably } from '../utils/programControlActions';
import { acceptedStateFingerprint } from '../store/coachMutationTransaction';

const AsyncStorage = require('@react-native-async-storage/async-storage').default;

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

/**
 * ⚠ **THIS FIXTURE WENT STALE AND TOOK THE WHOLE SUITE DARK WITH IT.**
 *
 * Measured 2026-08-25: **all 20 cells were failing, and all 20 for ONE reason**
 * — `generateProgramLocally` threw `missing_required_profile` before a single
 * move was exercised. Onboarding grew `gender` (R-130), height, weight, first
 * name and the 2km time trial; the generator started refusing a profile without
 * them; this fixture was never updated. **So the move machinery — the door
 * behind every Add / Move / Remove in the app — has been completely unguarded,
 * while `test:bible` ran the suite and counted its failure among the noise.**
 *
 * The five values are `DEV_E2E_STANDARD_PROFILE`'s, deliberately: they are the
 * app's own standard athlete, so the fixture is not a set of numbers invented
 * to make a generator stop complaining.
 */
function profile(): OnboardingData {
  return {
    firstName: 'Sam',
    gender: 'male',
    heightCm: 184,
    weightKg: 90,
    twoKmTimeTrial: { seconds: 480, recordedOn: '2026-07-01', source: 'onboarding' },
    seasonPhase: 'In-season',
    position: 'inside_mid',
    motivation: 'Build strength and football fitness',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '60-90 minutes',
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

function seed(
  athlete: OnboardingData = profile(),
  options: { phaseEntryWeekStartISO?: string } = {},
): TrainingProgram {
  const program = quiet(() => generateProgramLocally(athlete, {
    todayISO: CURRENT_WEEK,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: athlete.seasonPhase!,
      phaseEntryWeekStartISO: options.phaseEntryWeekStartISO ?? CURRENT_WEEK,
      originProvenance: 'explicit_user_phase_change',
    },
  }));
  useCalendarStore.setState({ markedDays: {}, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  // THE WORLD IS RETIRED BEFORE THE PROFILE IS ANSWERED, AND THE PROFILE GOES
  // THROUGH THE OWNED DOOR (seat answer 2, 2026-08-07).
  //
  // This used to be `useProfileStore.setState({ onboardingData: athlete })`,
  // placed ABOVE the program write. Both halves of that were wrong, and
  // together they manufactured a world no athlete can be in.
  //
  // The direct write fired the profile mirror fence while `programStore` still
  // held the PREVIOUS cell's accepted snapshot, so the fence — correctly, by
  // its own law — republished that stale canonical straight back over the
  // athlete this cell had just seeded. In-suite the write did not take AT ALL:
  // cell 19 asked for an Off-season athlete with no game day and ran against
  // In-season/Saturday, which is how a projected Saturday fixture appeared on a
  // week whose own contract declared none. That contradiction was diagnosed as
  // a product defect and a ruling was reasoned from it before measurement
  // showed the state was unreachable (docs/R53_SEAT_ANSWERS_2026-08-07.md §1).
  //
  // The order below is the one the app itself has: answers land when there is
  // no accepted program to contradict them. Retiring the previous world first
  // leaves no canonical for the fence to republish, so the athlete's answers
  // stand — and the write goes through `applyProfileOnboardingWrite`, the one
  // door, exactly as product code must.
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
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  });
  const written = applyProfileOnboardingWrite({
    next: athlete,
    writer: 'onboarding_step',
    isOnboardingComplete: true,
  });
  assert(written.ok, `the seed's profile write was refused: ${written.reason}`);
  // The fixture asserts it holds what it asked for. A seed that cannot prove
  // this is the whole defect class above, and it costs one comparison.
  const live = useProfileStore.getState().onboardingData;
  assert(live?.seasonPhase === athlete.seasonPhase &&
    live?.usualGameDay === athlete.usualGameDay &&
    live?.gameDay === athlete.gameDay,
  `the seeded profile did not survive the write: asked for ${athlete.seasonPhase}/`
  + `${athlete.usualGameDay ?? 'no game day'}, store holds ${live?.seasonPhase}/`
  + `${live?.usualGameDay ?? 'no game day'}`);
  return program;
}

function addDaysISO(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function accepted(weekStart: string) {
  const state = useProgramStore.getState();
  return rebaseAcceptedEffectiveWeek({
    surfaces: storedWorldSurfaces(state),
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
  // An unanswered G-1 ask is not a green light. The real sheet shows the three
  // routes and commits nothing until the athlete picks one, so neither does this.
  if (preview.g1Ask) return { preview, commit: null };
  const commit = applyPlanChange({
    change,
    visibleWeek: week,
    todayISO: CURRENT_WEEK,
    trace: preview.trace,
    applyOverride: () => {
      throw new Error('athlete move/delete must not use the single-date writer');
    },
  });
  return { preview, commit };
}


/**
 * Clear a day the GENERATOR filled with optional work, through the real door.
 *
 * Every cell that moves a session onto Wednesday needs Wednesday to start as
 * rest. It used to, for a reason Sam's Rest law (2026-07-30) has now removed:
 * the generator placed optional accessory work there (Bible G-3), and the §18
 * gateway then DELETED that work to manufacture a rest day. A day carrying only
 * optional work already counts as rest, so the gateway no longer strips it and
 * the destination arrives occupied.
 *
 * The fixture reaches an empty Wednesday BY ACTING — the athlete removes the
 * session — rather than by asking for a profile that happens to produce one.
 * That is AGENTS.md's rule for athlete-facing suites, and it keeps every other
 * scenario in this file on the same generated week as before.
 */
function clearGeneratedOptionalDay(weekStart: string, dayOfWeek: number): void {
  if (!workoutOn(weekStart, dayOfWeek)) return;
  applyPlanChange({
    change: { kind: 'remove_session', date: dateForDay(weekStart, dayOfWeek) },
    visibleWeek: visibleWeek(weekStart),
    todayISO: CURRENT_WEEK,
    applyOverride: () => {
      throw new Error('clearing a day must not use the single-date writer');
    },
  });
  if (workoutOn(weekStart, dayOfWeek)) {
    throw new Error(`could not clear ${weekStart}+${dayOfWeek} through the real door`);
  }
}

console.log('\n-- Athlete session move transaction --');

run('1 future Monday strength moves to Wednesday Rest through preview → commit', () => {
  seed();
  clearGeneratedOptionalDay(FUTURE_WEEK, 3);
  assert(workoutOn(FUTURE_WEEK, 1), 'future Monday source missing');
  assert(!workoutOn(FUTURE_WEEK, 3), 'future Wednesday must start as Rest');
  const original = clone(workoutOn(FUTURE_WEEK, 1)!);
  const templateCatalog = require('../utils/coachRevisionTemplates') as {
    listCoachRevisionTemplates: () => unknown[];
  };
  const liveWriteValidation = require('../utils/postGenerationConstraintValidation') as {
    validateLiveWorkoutWrite: (...args: unknown[]) => unknown;
  };
  const originalListTemplates = templateCatalog.listCoachRevisionTemplates;
  const originalValidateLiveWrite = liveWriteValidation.validateLiveWorkoutWrite;
  let templateCatalogCalls = 0;
  let liveWriteValidationCalls = 0;
  let result: ReturnType<typeof realDoor> | null = null;
  try {
    templateCatalog.listCoachRevisionTemplates = () => {
      templateCatalogCalls += 1;
      throw new Error('move_session reached the revision template catalog');
    };
    liveWriteValidation.validateLiveWorkoutWrite = () => {
      liveWriteValidationCalls += 1;
      throw new Error('move_session reached canonical template validation');
    };
    result = realDoor({
      kind: 'move_session',
      fromDate: dateForDay(FUTURE_WEEK, 1),
      toDate: dateForDay(FUTURE_WEEK, 3),
    }, FUTURE_WEEK);
  } finally {
    templateCatalog.listCoachRevisionTemplates = originalListTemplates;
    liveWriteValidation.validateLiveWorkoutWrite = originalValidateLiveWrite;
  }
  assert(templateCatalogCalls === 0, 'move_session called listCoachRevisionTemplates');
  assert(liveWriteValidationCalls === 0,
    'move_session called canonicalTemplateSectionSignature/validateLiveWorkoutWrite');
  assert(result, 'move_session did not return from the typed production door');
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
  clearGeneratedOptionalDay(CURRENT_WEEK, 3);
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
  // The move target must start as rest; the generator's optional G-3 work
  // is no longer stripped by the gateway (Sam's Rest law). Removed by acting.
  clearGeneratedOptionalDay(FUTURE_WEEK, 3);
  const input = moveInput(FUTURE_WEEK);
  commitAthleteSessionMoveTransaction(input);
  const constraint = useProgramStore.getState().userRemovalConstraints.find((candidate) =>
    candidate.mutationKind === 'move' && candidate.targetDate === input.sourceDate);
  assert(constraint?.moveTargetDate === input.targetDate && !!constraint.movedWorkout,
    'typed source/target ownership missing');
  const persisted = clone(useProgramStore.getState());
  const hydrated = canonicaliseAcceptedStateCandidate(persisted, {
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
    applyOverride: () => { throw new Error('unexpected single-date write'); },
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
  // An IMPOSSIBLE store state on purpose, to prove the transaction surfaces the
  // technical failure instead of publishing half a move. Not a seed: no world
  // is being manufactured, and nothing downstream is expected to succeed.
  useProfileStore.setState({ onboardingData: null } as never); // PROFILE-DOOR-BYPASS: fault injection
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
    applyOverride: () => { throw new Error('unexpected single-date write'); },
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

run('10 reload, rebuild and rollover retain move ownership', () => {
  const athlete = profile();
  seed(athlete);
  // The move target must start as rest; the generator's optional G-3 work
  // is no longer stripped by the gateway (Sam's Rest law). Removed by acting.
  clearGeneratedOptionalDay(FUTURE_WEEK, 3);
  const input = moveInput(FUTURE_WEEK);
  commitAthleteSessionMoveTransaction(input);
  const persisted = clone(useProgramStore.getState());
  const hydrated = canonicaliseAcceptedStateCandidate(persisted, {
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
  rolloverProgramBlock({ baseProfile: athlete, targetDateISO: '2026-08-10' });
  assert(useProgramStore.getState().userRemovalConstraints.some((constraint) =>
    constraint.mutationKind === 'move' &&
    constraint.targetDate === input.sourceDate &&
    constraint.moveTargetDate === input.targetDate),
  'rollover discarded move ownership');
});

run('11 a later readiness transaction or rollback retains move ownership and placement', () => {
  seed();
  // The move target must start as rest; the generator's optional G-3 work
  // is no longer stripped by the gateway (Sam's Rest law). Removed by acting.
  clearGeneratedOptionalDay(FUTURE_WEEK, 3);
  // The move target must start as rest; the generator's optional G-3 work
  // is no longer stripped by the gateway (Sam's Rest law). Removed by acting.
  clearGeneratedOptionalDay(FUTURE_WEEK, 3);
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

run('12 direct/reload moves converge across the production-door phase matrix', () => {
  seed();
  commitAthleteSessionMoveTransaction(moveInput(FUTURE_WEEK));
  const direct = semantic(FUTURE_WEEK);
  seed();
  const persisted = clone(useProgramStore.getState());
  const hydrated = canonicaliseAcceptedStateCandidate(persisted, {
    profile: profile(),
    markedDays: persisted.acceptedMaterialContext.markedDays,
    validateWeekStarts: [FUTURE_WEEK],
  });
  useProgramStore.setState({ ...persisted, ...hydrated });
  commitAthleteSessionMoveTransaction(moveInput(FUTURE_WEEK));
  assert(semantic(FUTURE_WEEK) === direct, 'direct and chained move states differ');

  const noFixture = {
    usualGameDay: undefined,
    gameDay: undefined,
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  } satisfies Partial<OnboardingData>;
  const matrix: Array<{
    name: string;
    athlete: OnboardingData;
    phaseEntryOffsetWeeks: number;
    weekIndex: number;
  }> = [
    { name: 'in-season game week current', athlete: profile(), phaseEntryOffsetWeeks: 0, weekIndex: 0 },
    { name: 'in-season bye current', athlete: { ...profile(), ...noFixture }, phaseEntryOffsetWeeks: 0, weekIndex: 0 },
    { name: 'early off-season', athlete: { ...profile(), ...noFixture, seasonPhase: 'Off-season' }, phaseEntryOffsetWeeks: 0, weekIndex: 0 },
    { name: 'mid off-season', athlete: { ...profile(), ...noFixture, seasonPhase: 'Off-season' }, phaseEntryOffsetWeeks: 2, weekIndex: 0 },
    { name: 'late off-season', athlete: { ...profile(), ...noFixture, seasonPhase: 'Off-season' }, phaseEntryOffsetWeeks: 6, weekIndex: 0 },
    { name: 'early pre-season', athlete: { ...profile(), ...noFixture, seasonPhase: 'Pre-season' }, phaseEntryOffsetWeeks: 0, weekIndex: 0 },
    { name: 'late pre-season', athlete: { ...profile(), ...noFixture, seasonPhase: 'Pre-season' }, phaseEntryOffsetWeeks: 6, weekIndex: 0 },
    { name: 'pre-season deload', athlete: { ...profile(), ...noFixture, seasonPhase: 'Pre-season' }, phaseEntryOffsetWeeks: 0, weekIndex: 3 },
    { name: 'practice match', athlete: { ...profile(), seasonPhase: 'Pre-season', teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }, phaseEntryOffsetWeeks: 2, weekIndex: 0 },
    { name: 'stacked Team Training days', athlete: profile(), phaseEntryOffsetWeeks: 0, weekIndex: 0 },
    { name: 'Sunday-fixture adjacent future week', athlete: { ...profile(), usualGameDay: 'Sunday', gameDay: 'Sunday' }, phaseEntryOffsetWeeks: 0, weekIndex: 1 },
    { name: 'future in-season game week', athlete: profile(), phaseEntryOffsetWeeks: 0, weekIndex: 1 },
  ];
  for (const scenario of matrix) {
    const program = seed(scenario.athlete, {
      phaseEntryWeekStartISO: addDaysISO(
        CURRENT_WEEK,
        -scenario.phaseEntryOffsetWeeks * 7,
      ),
    });
    const weekStart = program.microcycles[scenario.weekIndex]?.startDate.slice(0, 10);
    assert(weekStart, `${scenario.name}: target week missing`);
    const before = accepted(weekStart);
    const week = visibleWeek(weekStart);
    const acceptedIdentityByDay = new Map(before.visibleWorkouts.map((workout) => [
      workout.dayOfWeek,
      workout.planEntryId ?? workout.id,
    ]));
    const eligible = week.filter((day) => day.workout?.planEntryId &&
      !/Game|Practice Match|Team Training/i.test(
        `${day.workout.name} ${day.workout.workoutType}`,
      ) && acceptedIdentityByDay.get(day.dayOfWeek) ===
        (day.workout.planEntryId ?? day.workout.id));
    const source = eligible[0];
    const protectedDayNames = new Set<string>([
      scenario.athlete.usualGameDay,
      scenario.athlete.gameDay,
      ...(scenario.athlete.teamTrainingDays ?? []),
    ].filter(Boolean) as string[]);
    const emptyAcceptedTarget = week.find((day) => {
      const dayName = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday',
        'Thursday', 'Friday', 'Saturday',
      ][day.dayOfWeek];
      return !day.workout && !acceptedIdentityByDay.has(day.dayOfWeek) &&
        !protectedDayNames.has(dayName);
    });
    const target = emptyAcceptedTarget ?? eligible[1];
    assert(source?.workout && target && source.date !== target.date,
      `${scenario.name}: safe source/target pair missing`);
    const sourceIdentity = source.workout.planEntryId ?? source.workout.id;
    const change: PlanChange = {
      kind: 'move_session',
      fromDate: source.date,
      toDate: target.date,
    };
    let moved = realDoor(change, weekStart);
    // Some rows of this matrix land on the day before the fixture — the
    // practice-match week's only free day IS its G-1. That destination now
    // raises Sam's ask instead of applying anything, so the athlete's answer is
    // part of the production door and this test has to give one. Convergence is
    // what is under test, and it must hold for a routed move too.
    if (moved.preview.g1Ask) {
      assert(!moved.commit, `${scenario.name}: the ask applied something`);
      moved = realDoor({ ...change, g1Route: 'deloaded' }, weekStart);
    }
    assert(moved.preview.ok && moved.commit?.ok,
      `${scenario.name}: ${JSON.stringify(moved)}`);
    const after = accepted(weekStart);
    assert(after.evaluation.blockingViolations.length === 0,
      `${scenario.name}: ${JSON.stringify(after.evaluation.blockingViolations)}`);
    assert(after.contract.identity.mode === before.contract.identity.mode,
      `${scenario.name}: phase mode changed`);
    const publishedTarget = workoutOn(
      weekStart,
      new Date(`${target.date}T12:00:00`).getDay(),
    );
    assert(publishedTarget?.planEntryId === sourceIdentity ||
      publishedTarget?.id === sourceIdentity,
    `${scenario.name}: moved identity ${sourceIdentity} did not own ${target.date}; ` +
      `published=${publishedTarget?.planEntryId ?? publishedTarget?.id ?? 'REST'}`);
  }
});

run('13 Monday → Wednesday restoration returns both exact prescriptions', () => {
  seed();
  const mondayBefore = clone(workoutOn(FUTURE_WEEK, 1)!);
  const wednesdayBefore = clone(workoutOn(FUTURE_WEEK, 3));
  commitAthleteSessionMoveTransaction(moveInput(FUTURE_WEEK));
  const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(adjustment?.kind === 'session_move', 'move did not create a typed adjustment');
  const result = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(result.outcome === 'restored', JSON.stringify(result));
  const mondayAfter = workoutOn(FUTURE_WEEK, 1);
  const wednesdayAfter = workoutOn(FUTURE_WEEK, 3);
  assert(mondayAfter?.id === mondayBefore.id, 'Monday stable identity was not restored');
  assert(prescriptionSignature(mondayAfter) === prescriptionSignature(mondayBefore),
    'Monday prescription was not restored exactly');
  assert((wednesdayAfter?.id ?? null) === (wednesdayBefore?.id ?? null),
    'original Wednesday was not restored');
  assert(!wednesdayBefore || prescriptionSignature(wednesdayAfter!) ===
    prescriptionSignature(wednesdayBefore), 'original Wednesday prescription changed');
});

run('14 repeated restoration is idempotent', () => {
  seed();
  commitAthleteSessionMoveTransaction(moveInput(FUTURE_WEEK));
  const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(adjustment, 'move adjustment missing');
  const revision = useProgramStore.getState().acceptedMaterialContext.revision;
  const first = commitClearReversibleAdjustment(adjustment.id, revision);
  const afterFirst = semantic(FUTURE_WEEK);
  const second = commitClearReversibleAdjustment(adjustment.id, revision);
  assert(first.outcome === 'restored', JSON.stringify(first));
  assert(second.outcome === 'already-cleared', JSON.stringify(second));
  assert(semantic(FUTURE_WEEK) === afterFirst, 'second Clear changed the restored program');
});

run('15 newer overlapping athlete intent supersedes stale restoration', () => {
  seed();
  commitAthleteSessionMoveTransaction(moveInput(FUTURE_WEEK));
  const first = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(first, 'first move adjustment missing');
  const moved = workoutOn(FUTURE_WEEK, 3);
  assert(moved, 'first move target missing');
  // Second, overlapping move relocates the SAME session again to another empty
  // day (Monday, vacated by the first move). Deliberately a plain empty day:
  // Friday is G-1, and a move there now goes through the ask-flow, which would
  // put a route choice in the middle of a test about supersede semantics. Those
  // semantics are independent of the destination day.
  commitAthleteSessionMoveTransaction({
    sourceDate: dateForDay(FUTURE_WEEK, 3),
    targetDate: dateForDay(FUTURE_WEEK, 1),
    reason: 'test:newer_athlete_move',
    source: 'tap',
    acceptedSourcePlanEntryId: moved.planEntryId ?? null,
    sourceWorkoutId: moved.id,
    originalSourceWorkout: moved,
    existingTargetWorkout: workoutOn(FUTURE_WEEK, 1),
    scope: 'whole_session',
  });
  const second = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(second, 'newer move adjustment missing');
  const beforeClear = semantic(FUTURE_WEEK);
  const result = commitClearReversibleAdjustment(
    first.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(result.outcome === 'superseded', JSON.stringify(result));
  assert(result.supersededById === second.id, 'newer owner was not reported');
  assert(semantic(FUTURE_WEEK) === beforeClear, 'superseded restore overwrote newer intent');
});

run('17 changed accepted-after prescription conflicts without overwriting later intent', () => {
  seed();
  commitAthleteSessionMoveTransaction(moveInput(FUTURE_WEEK));
  const state = useProgramStore.getState();
  const adjustment = state.reversibleAdjustmentLedger.adjustments.at(-1);
  assert(adjustment, 'conflict witness adjustment missing');
  const removalId = adjustment.linkedUserRemovalConstraintIds[0];
  const owner = state.userRemovalConstraints.find((constraint) => constraint.id === removalId);
  assert(owner?.movedWorkout?.exercises[0], 'move ownership prescription missing');
  const changedOwner = clone(owner);
  changedOwner.movedWorkout!.exercises[0].prescribedSets += 1;
  useProgramStore.setState({
    userRemovalConstraints: state.userRemovalConstraints.map((constraint) =>
      constraint.id === changedOwner.id ? changedOwner : constraint),
    acceptedMaterialContext: {
      ...state.acceptedMaterialContext,
      revision: state.acceptedMaterialContext.revision + 1,
      lastTransaction: 'test:newer_prescription_intent',
    },
  });
  const laterIntent = semantic(FUTURE_WEEK);
  const result = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(result.outcome === 'conflicted', JSON.stringify(result));
  assert(semantic(FUTURE_WEEK) === laterIntent,
    'conflicted Restore overwrote the later accepted prescription');
  assert(useProgramStore.getState().reversibleAdjustmentLedger.adjustments
    .find((candidate) => candidate.id === adjustment.id)?.status === 'conflicted',
  'conflict was not persisted on the exact adjustment');
});

run('18 hydration migration creates ledger state only from exact legacy removal ownership', () => {
  seed();
  commitAthleteSessionMoveTransaction(moveInput(FUTURE_WEEK));
  const state = useProgramStore.getState();
  const constraint = state.userRemovalConstraints[0];
  assert(constraint?.originalWorkout && constraint.movedWorkout,
    'lossless legacy migration witness missing');
  const before = semantic(FUTURE_WEEK);
  const migrated = normalizeReversibleAdjustmentLedger({
    value: null,
    userRemovalConstraints: state.userRemovalConstraints,
    acceptedRevision: state.acceptedMaterialContext.revision,
  });
  assert(migrated.adjustments.length === state.userRemovalConstraints.length,
    'migration fabricated an adjustment without exact removal ownership');
  const record = migrated.adjustments[0];
  assert(record.validity.source === 'legacy_exact_user_removal' &&
    record.sourceSurface === 'hydration_migration' && record.kind === 'session_move',
  'legacy exact ownership was not represented explicitly');
  assert(record.displacedOriginalState.ownedDays.some((owned) =>
    owned.beforeWorkout?.id === constraint.originalWorkout.id),
  'migration lost the exact displaced prescription');
  assert(migrated.adjustments.every((candidate) =>
    state.userRemovalConstraints.some((removal) =>
      candidate.sourceActionOrIntentId === removal.id)),
  'legacy fixture or Coach Note state was fabricated into the ledger');
  useProgramStore.setState({ reversibleAdjustmentLedger: migrated });
  assert(semantic(FUTURE_WEEK) === before, 'ledger migration changed the visible program');
});

run('19 clearing one of two same-week adjustments preserves the unrelated active move', () => {
  // Off-season week: five plain gym sessions Mon–Fri with empty Sat/Sun and NO
  // game-proximity fillers, so two INDEPENDENT non-destructive moves exist (the
  // In-season week has only one movable non-anchor session). Both relocate a real
  // session onto an empty weekend day; days 2 and 4 stay untouched.
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
  commitAthleteSessionMoveTransaction(moveInput(FUTURE_WEEK, 1, 6));
  const first = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(first, 'first same-week adjustment missing');
  commitAthleteSessionMoveTransaction(moveInput(FUTURE_WEEK, 3, 0));
  const second = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(second && second.id !== first.id, 'second same-week adjustment identity missing');
  assert(first.affectedWeeks.some((week) => second.affectedWeeks.includes(week)),
    'same-week adjustment precondition missing');
  const unrelatedBefore = JSON.stringify([2, 4].map((day) => {
    const workout = workoutOn(FUTURE_WEEK, day);
    return workout ? {
      day,
      id: workout.id,
      planEntryId: workout.planEntryId ?? null,
      prescription: prescriptionSignature(workout),
    } : null;
  }));
  const restored = commitClearReversibleAdjustment(
    first.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(restored.outcome === 'restored', JSON.stringify(restored));
  assert(useProgramStore.getState().reversibleAdjustmentLedger.adjustments
    .find((candidate) => candidate.id === second.id)?.status === 'active',
  'clearing the first adjustment cleared the unrelated second adjustment');
  const unrelatedAfter = JSON.stringify([2, 4].map((day) => {
    const workout = workoutOn(FUTURE_WEEK, day);
    return workout ? {
      day,
      id: workout.id,
      planEntryId: workout.planEntryId ?? null,
      prescription: prescriptionSignature(workout),
    } : null;
  }));
  assert(unrelatedAfter === unrelatedBefore,
    'clearing one same-week move changed the unrelated move prescription');
});

run('20 an occupied restoration target conflicts without publishing a program overwrite', () => {
  seed();
  commitAthleteSessionMoveTransaction(moveInput(FUTURE_WEEK));
  const state = useProgramStore.getState();
  const adjustment = state.reversibleAdjustmentLedger.adjustments.at(-1);
  assert(adjustment, 'occupied-target adjustment missing');
  const sourceDate = dateForDay(FUTURE_WEEK, 1);
  const occupant = clone(workoutOn(FUTURE_WEEK, 5));
  assert(occupant, 'occupied-target witness session missing');
  occupant.dayOfWeek = 1;
  const linked = new Set(adjustment.linkedUserRemovalConstraintIds);
  useProgramStore.setState({
    dateOverrides: { ...state.dateOverrides, [sourceDate]: occupant },
    userRemovalConstraints: state.userRemovalConstraints.map((constraint) =>
      linked.has(constraint.id)
        ? {
            ...constraint,
            status: 'restored' as const,
            restoredAt: '2026-07-16T00:00:00.000Z',
            restorationReason: 'explicit_re_add' as const,
          }
        : constraint),
    acceptedMaterialContext: {
      ...state.acceptedMaterialContext,
      revision: state.acceptedMaterialContext.revision + 1,
      lastTransaction: 'test:occupied_restoration_target',
    },
  });
  const programBefore = JSON.stringify({
    dateOverrides: useProgramStore.getState().dateOverrides,
    overlays: useProgramStore.getState().weekScopedOverlays,
    removals: useProgramStore.getState().userRemovalConstraints,
    marks: useProgramStore.getState().acceptedMaterialContext.markedDays,
  });
  const restored = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(restored.outcome === 'conflicted', JSON.stringify(restored));
  const programAfter = JSON.stringify({
    dateOverrides: useProgramStore.getState().dateOverrides,
    overlays: useProgramStore.getState().weekScopedOverlays,
    removals: useProgramStore.getState().userRemovalConstraints,
    marks: useProgramStore.getState().acceptedMaterialContext.markedDays,
  });
  assert(programAfter === programBefore,
    'conflicted occupied-target Restore published a program overwrite');
  assert(useProgramStore.getState().dateOverrides[sourceDate]?.id === occupant.id,
    'occupied restoration target was overwritten silently');
});

async function runAsync(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}`, error);
  }
}

async function finish(): Promise<void> {
  await runAsync('21 tap creation and Restore are durable before returning success', async () => {
    seed();
    const before = semantic(FUTURE_WEEK);
    const result = await executeProgramControlActionDurably({
      type: 'move_session',
      source: { screen: 'program_tab', surface: 'test', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: {
        fromDate: dateForDay(FUTURE_WEEK, 1),
        toDate: dateForDay(FUTURE_WEEK, 3),
      },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: true,
    }, { visibleWeek: visibleWeek(FUTURE_WEEK), todayISO: CURRENT_WEEK });
    assert(result.ok, JSON.stringify(result));
    const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
    assert(adjustment?.status === 'active', 'durable tap adjustment missing');
    // R1.3 (shell rebuild, docs/SHELL_REBUILD_RULING_2026-08-05.md): persisted
    // state is INPUTS — the reversible-adjustment record is a derived output
    // now, rebuilt at boot by replaying the ledger, so the durable
    // acknowledgement this cell pins moved to the DECISION: the move's own
    // ledger entry (R1.4a appends it in the same act that lands the change).
    const creationLedger = await AsyncStorage.getItem('decision-ledger-store');
    const ledgerEntries = (JSON.parse(creationLedger ?? '{}') as {
      state?: { entries?: { decision?: { kind?: string; change?: {
        kind?: string; fromDate?: string; toDate?: string;
      } } }[] };
    }).state?.entries ?? [];
    assert(ledgerEntries.some((entry) =>
      entry.decision?.kind === 'plan_change' &&
      entry.decision.change?.kind === 'move_session' &&
      entry.decision.change.fromDate === dateForDay(FUTURE_WEEK, 1) &&
      entry.decision.change.toDate === dateForDay(FUTURE_WEEK, 3)),
    'creation returned before the decision reached the durable ledger');
    const restored = await clearReversibleAdjustment(
      adjustment.id,
      useProgramStore.getState().acceptedMaterialContext.revision,
    );
    assert(restored.outcome === 'restored', JSON.stringify(restored));
    assert(semantic(FUTURE_WEEK) === before, 'durable Restore did not restore the exact week');
    // RE-AIMED 2026-08-09 — LR-29's heir HAS landed, and this cell's original
    // prediction was half right, so it is corrected rather than deleted.
    //
    // The reversal producer now exists (`store/undoLastDecision.ts`) and the
    // boot honours reversals (`rules/decisionLedgerReplay.ts`), proven durable
    // by `npm run tape:lr29-undo-durability`. But THIS route — the snapshot
    // restore Coach Notes calls — was deliberately NOT re-pointed at it, and
    // the reason is a measurement rather than a delivery boundary:
    //
    //   the snapshot route carries `displacedOriginalState.calendarFacts` and
    //   can therefore put back a `move_session`'s calendar `rest` mark; the
    //   ledger route re-derives from decisions and CANNOT, because a calendar
    //   mark is not a decision. Re-pointing this door today would trade a
    //   complete-but-brittle undo for a robust-but-incomplete one, and the
    //   athlete would lose material they currently get back.
    //
    // So the assertion stands, and its meaning has changed: it now pins that
    // the two routes are still SEPARATE. It reds on the day somebody unifies
    // them — which is the right day to require the calendar-mark ownership
    // ruling (docs/LR29_UNDO_BUILD_BOUNDARY_2026-08-09.md §4) to be answered.
    const restoreLedger = await AsyncStorage.getItem('decision-ledger-store');
    const entriesAfterRestore = (JSON.parse(restoreLedger ?? '{}') as {
      state?: { entries?: { decision?: { kind?: string } }[] };
    }).state?.entries ?? [];
    assert(!entriesAfterRestore.some((entry) => entry.decision?.kind === 'reversal'),
      'a reversal entry reached the ledger — the reversal producer has landed, '
      + 'so this cell must now assert the reversal\'s durable acknowledgement');
  });

  await runAsync('22 injected restoration persistence failure rolls back exactly', async () => {
    seed();
    const moved = await executeProgramControlActionDurably({
      type: 'move_session',
      source: { screen: 'program_tab', surface: 'test', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: {
        fromDate: dateForDay(FUTURE_WEEK, 1),
        toDate: dateForDay(FUTURE_WEEK, 3),
      },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: true,
    }, { visibleWeek: visibleWeek(FUTURE_WEEK), todayISO: CURRENT_WEEK });
    assert(moved.ok, JSON.stringify(moved));
    const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
    assert(adjustment, 'failure witness adjustment missing');
    const beforeState = acceptedStateFingerprint();
    const beforeVisible = semantic(FUTURE_WEEK);
    const beforeEnvelope = await readDurableProgramStoreEnvelope();
    const originalSetItem = AsyncStorage.setItem.bind(AsyncStorage);
    let rejectOnce = true;
    AsyncStorage.setItem = async (key: string, value: string) => {
      if (key === PROGRAM_STORE_PERSISTENCE_KEY && rejectOnce) {
        rejectOnce = false;
        throw new Error('injected_reversible_restore_persistence_failure');
      }
      return originalSetItem(key, value);
    };
    try {
      const restored = await clearReversibleAdjustment(
        adjustment.id,
        useProgramStore.getState().acceptedMaterialContext.revision,
      );
      assert(restored.outcome === 'safely-rejected', JSON.stringify(restored));
    } finally {
      AsyncStorage.setItem = originalSetItem;
    }
    assert(acceptedStateFingerprint() === beforeState, 'failed Restore changed accepted memory');
    assert(semantic(FUTURE_WEEK) === beforeVisible, 'failed Restore changed the visible week');
    assert((await readDurableProgramStoreEnvelope()) === beforeEnvelope,
      'failed Restore changed the durable envelope');
  });

  console.log(`\nAthlete session move totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.log(`Failures: ${failures.join(', ')}`);
    process.exit(1);
  }
}

void finish();
