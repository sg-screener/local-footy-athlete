/**
 * Athlete-requested session deletion — persisted ownership and repair.
 * Run: npm run test:athlete-session-deletion
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
  throw new Error('NETWORK DISABLED — athlete deletion repair must be local');
};
process.env.TZ = 'Australia/Melbourne';

import type {
  OnboardingData,
  TrainingProgram,
  UserRemovalConstraint,
  UserRemovalScope,
  Workout,
} from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore, canonicaliseHydratedState } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore, type CalendarDayType } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { buildReadinessSignalPatch } from '../utils/readiness';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import {
  commitAthleteSessionDeletionTransaction,
  commitProgramSetupRebuildTransaction,
} from '../store/acceptedStateTransaction';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import {
  applyUserRemovalConstraintsToWeek,
  userRemovalConstraintId,
} from '../rules/userRemovalConstraints';
import { rebuildLocalWeek } from '../utils/weekRebuild';
import { addDaysISO } from '../utils/programBlockState';
import { executeProgramControlAction } from '../utils/programControlActions';
import { applyPlanChange, previewPlanChangeRisk } from '../utils/planChangeProducer';
import { executeCoachCommand } from '../utils/coachCommandExecutor';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { repeatWeekIntoNextWeek } from '../utils/repeatWeek';
import { rolloverProgramBlock } from '../utils/programBlockRollover';
import {
  createEmptyReversibleAdjustmentLedger,
  normalizeReversibleAdjustmentLedger,
} from '../rules/reversibleAdjustmentLedger';
import { commitClearReversibleAdjustment } from '../store/reversibleAdjustmentTransaction';

const WEEK = '2026-07-13';
const FRIDAY = '2026-07-17';
const SATURDAY = '2026-07-18';
const SUNDAY = '2026-07-19';
const NEXT_WEEK = '2026-07-20';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const first = String(args[0] ?? '');
  if (first.includes('[ProgramGen]') || first.includes('[WorkoutCanonicalisation]')) return;
  originalWarn(...args);
};

let regressions = 0;
let properties = 0;
let mutations = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(kind: 'regression' | 'property' | 'mutation', name: string, body: () => void): void {
  try {
    body();
    if (kind === 'regression') regressions += 1;
    else if (kind === 'property') properties += 1;
    else mutations += 1;
    console.log(`  PASS [${kind}] ${name}`);
  } catch (error) {
    failures.push(`${kind}: ${name}`);
    console.error(`  FAIL [${kind}] ${name}`, error);
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

function profile(overrides: Partial<OnboardingData> = {}): OnboardingData {
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
    ...overrides,
  };
}

function emptyContext(markedDays: Record<string, CalendarDayType>) {
  return {
    markedDays,
    readinessSignalsByDate: {},
    activeConstraints: [],
    activeInjury: null,
    revision: 1,
    lastTransaction: 'athlete-removal-test:seed',
  };
}

function seed(args: {
  athlete?: OnboardingData;
  weekStart?: string;
  phaseEntryWeekStartISO?: string;
  targetMicrocycleIndex?: number;
  markedDays?: Record<string, CalendarDayType>;
} = {}): TrainingProgram {
  const athlete = args.athlete ?? profile();
  const weekStart = args.weekStart ?? WEEK;
  const phaseEntryWeekStartISO = args.phaseEntryWeekStartISO ?? weekStart;
  const program = quiet(() => generateProgramLocally(athlete, {
    todayISO: weekStart,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: athlete.seasonPhase!,
      phaseEntryWeekStartISO,
      originProvenance: 'explicit_user_phase_change',
    },
  }));
  const target = program.microcycles[args.targetMicrocycleIndex ?? 0] ?? program.microcycles[0];
  const marks = args.markedDays ?? {};
  useProfileStore.setState({ onboardingData: athlete, isOnboardingComplete: true });
  useCalendarStore.setState({ markedDays: marks, selectedDate: null });
  useReadinessStore.setState({ signalsByDate: {} });
  const coachState = useCoachUpdatesStore.getState();
  useCoachUpdatesStore.setState({
    activeConstraints: coachState.activeConstraints.length === 0
      ? coachState.activeConstraints
      : [],
    activeInjury: null,
  } as never);
  useProgramStore.setState({
    currentProgram: program,
    currentMicrocycle: target ?? null,
    todayWorkout: null,
    isGenerating: false,
    isLoading: false,
    error: null,
    blockState: null,
    acceptedMaterialContext: emptyContext(marks),
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  });
  return program;
}

function accepted(weekStart = WEEK) {
  const state = useProgramStore.getState();
  return rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
}

function byDay(weekStart = WEEK): Map<number, Workout> {
  return new Map(accepted(weekStart).visibleWorkouts.map((workout) =>
    [workout.dayOfWeek, workout]));
}

function dateForDay(weekStart: string, day: number): string {
  return addDaysISO(weekStart, day === 0 ? 6 : day - 1);
}

function visibleWeek(weekStart = WEEK) {
  return resolveWeekWithConditioning(weekStart, buildScheduleStateImperative());
}

function deleteWorkout(args: {
  date: string;
  workout: Workout;
  scope?: UserRemovalScope;
  remainingWorkout?: Workout | null;
  source?: 'tap' | 'coach';
}): void {
  commitAthleteSessionDeletionTransaction({
    date: args.date,
    reason: `test:athlete-delete:${args.date}`,
    source: args.source ?? 'tap',
    scope: args.scope ?? 'whole_session',
    originalWorkout: args.workout,
    remainingWorkout: args.remainingWorkout ?? null,
    equivalentExposureMayRelocate: true,
  });
}

function deleteThroughRealSheetDoor(
  date: string,
  scope?: 'strength' | 'conditioning',
  weekStart = WEEK,
): ReturnType<typeof applyPlanChange> {
  const change = { kind: 'remove_session' as const, date, ...(scope ? { scope } : {}) };
  const before = JSON.stringify({
    overlays: useProgramStore.getState().weekScopedOverlays,
    constraints: useProgramStore.getState().userRemovalConstraints,
    context: useProgramStore.getState().acceptedMaterialContext,
  });
  const week = visibleWeek(weekStart);
  const preview = previewPlanChangeRisk({
    change,
    visibleWeek: week,
    todayISO: WEEK,
    profile: useProfileStore.getState().onboardingData ?? undefined,
  });
  assert(preview.ok, `preview rejected deletion: ${JSON.stringify(preview.rejected)}`);
  assert(JSON.stringify({
    overlays: useProgramStore.getState().weekScopedOverlays,
    constraints: useProgramStore.getState().userRemovalConstraints,
    context: useProgramStore.getState().acceptedMaterialContext,
  }) === before, 'deletion preview mutated accepted state');
  const result = applyPlanChange({
    change,
    visibleWeek: week,
    todayISO: WEEK,
    trace: preview.trace,
    setManualOverride: () => {
      throw new Error('athlete deletion must not use the single-date writer');
    },
  });
  assert(result.ok, `commit rejected deletion: ${JSON.stringify(result.rejected)}`);
  return result;
}

function seedExactSundayRegression(): {
  athlete: OnboardingData;
  sunday: Workout;
  preservedDays: string;
} {
  const athlete = profile();
  seed({ athlete, markedDays: { [SATURDAY]: 'game' } });
  rebuildLocalWeek({
    baseProfile: athlete,
    newGameDay: null,
    scope: 'weekOverlay',
    targetDate: SATURDAY,
    manageCalendarFixture: true,
    todayISO: WEEK,
  });
  const state = useProgramStore.getState();
  const overlay = clone(state.weekScopedOverlays[WEEK]);
  const hard = accepted().visibleWorkouts.find((workout) =>
    /Hard Conditioning/i.test(workout.name));
  assert(hard, 'bye-build hard conditioning precondition missing');
  const optionalSource = accepted().visibleWorkouts.find((workout) =>
    workout.sessionTier === 'optional' && workout.dayOfWeek !== 6);
  const gunshow: Workout = optionalSource
    ? {
        ...clone(optionalSource),
        id: `exact-gunshow:${SATURDAY}`,
        planEntryId: `exact-gunshow:${SATURDAY}`,
        dayOfWeek: 6,
        name: 'Gunshow',
        exercises: optionalSource.exercises.map((row, index) => ({
          ...clone(row),
          id: `exact-gunshow:${SATURDAY}:row:${index + 1}`,
          workoutId: `exact-gunshow:${SATURDAY}`,
        })),
      }
    : {
        id: `exact-gunshow:${SATURDAY}`,
        microcycleId: hard.microcycleId,
        dayOfWeek: 6,
        name: 'Gunshow',
        description: 'Optional arms and shoulders.',
        durationMinutes: 30,
        intensity: 'Light',
        workoutType: 'Strength',
        sessionTier: 'optional',
        planEntryId: `exact-gunshow:${SATURDAY}`,
        exercises: [],
        createdAt: hard.createdAt,
        updatedAt: hard.updatedAt,
      };
  const accessoriesId = `exact-accessories:${FRIDAY}:week-overlay:${FRIDAY}`;
  const accessories: Workout = {
    ...clone(gunshow),
    id: accessoriesId,
    planEntryId: `exact-accessories:${FRIDAY}`,
    dayOfWeek: 5,
    name: 'Accessories',
    exercises: gunshow.exercises.map((row, index) => ({
      ...clone(row),
      id: `exact-accessories:${FRIDAY}:row:${index + 1}`,
      workoutId: accessoriesId,
    })),
  };
  const sunday = { ...clone(hard), dayOfWeek: 0, name: 'Hard Intervals' };
  if (optionalSource) {
    overlay.workoutsByDate[dateForDay(WEEK, optionalSource.dayOfWeek)] = null;
  }
  overlay.workoutsByDate[FRIDAY] = accessories;
  overlay.workoutsByDate[SATURDAY] = gunshow;
  overlay.workoutsByDate[SUNDAY] = sunday;
  useProgramStore.setState({
    weekScopedOverlays: { ...state.weekScopedOverlays, [WEEK]: overlay },
  });
  const preservedDays = JSON.stringify([1, 2, 3, 4, 5].map((day) => {
    const workout = byDay().get(day);
    return {
      day,
      planEntryId: workout?.planEntryId ?? null,
      name: workout?.name ?? null,
      exercises: workout?.exercises.map((row) => ({
        id: row.id,
        workoutId: row.workoutId,
        exerciseId: row.exerciseId,
        sets: row.prescribedSets,
        repsMin: row.prescribedRepsMin,
        repsMax: row.prescribedRepsMax,
        weight: row.prescribedWeightKg,
        rest: row.restSeconds,
      })) ?? [],
    };
  }));
  assert(byDay().get(0)?.name === 'Hard Intervals', 'Sunday hard-interval seed failed');
  assert(byDay().get(5)?.name === 'Accessories', 'Friday Accessories seed failed');
  assert(byDay().get(6)?.name === 'Gunshow', 'Saturday Gunshow seed failed');
  return { athlete, sunday, preservedDays };
}

function visibleSemantic(weekStart = WEEK): string {
  const week = accepted(weekStart);
  return JSON.stringify({
    days: week.visibleWorkouts.map((workout) => ({
      day: workout.dayOfWeek,
      name: workout.name,
      planEntryId: workout.planEntryId ?? null,
      rows: workout.exercises.map((row) => row.id),
    })).sort((left, right) => left.day - right.day),
    strength: week.evaluation.ledger.mainStrength.achievedCount,
    conditioning: week.evaluation.ledger.conditioning.coreCount,
    sprint: week.evaluation.ledger.sprintHighSpeed.achievedCount,
    reductions: week.contract.authorisedReductions.map((entry) => ({
      metric: entry.metric,
      reason: entry.reason,
      target: entry.reducedTarget,
    })).sort((left, right) => left.metric.localeCompare(right.metric)),
  });
}

function prescriptionSignature(workout: Workout | null | undefined): string {
  return JSON.stringify({
    planEntryId: workout?.planEntryId ?? null,
    rows: workout?.exercises.map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      sets: row.prescribedSets,
      repsMin: row.prescribedRepsMin,
      repsMax: row.prescribedRepsMax,
      weight: row.prescribedWeightKg,
      rest: row.restSeconds,
    })) ?? [],
  });
}

function mainStrengthPrescriptionSignature(workout: Workout | null | undefined): string {
  return JSON.stringify({
    planEntryId: workout?.planEntryId ?? null,
    rows: workout?.exercises.filter((row) =>
      row.section18Evidence?.role === 'main_strength').map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      sets: row.prescribedSets,
      repsMin: row.prescribedRepsMin,
      repsMax: row.prescribedRepsMax,
      weight: row.prescribedWeightKg,
      rest: row.restSeconds,
    })) ?? [],
  });
}

function seedExactInSeasonStrengthWeek(): OnboardingData {
  const athlete = profile();
  seed({ athlete, markedDays: { [SATURDAY]: 'game' } });
  assert(byDay().get(1)?.name === 'Lower Body Strength', 'Monday lower precondition missing');
  assert(byDay().get(2)?.name === 'Team Training + Upper Pull',
    'Tuesday pull + Team Training precondition missing');
  assert(byDay().get(4)?.name === 'Team Training + Upper Push',
    'Thursday push + Team Training precondition missing');
  return athlete;
}

function reloadAcceptedState(athlete: OnboardingData): void {
  const persisted = clone(useProgramStore.getState());
  const hydrated = canonicaliseHydratedState(persisted, {
    programAlreadyAccepted: true,
    profile: athlete,
    markedDays: persisted.acceptedMaterialContext.markedDays,
    validateWeekStarts: [WEEK],
  });
  useProgramStore.setState({ ...persisted, ...hydrated });
}

console.log('\n-- Athlete session deletion regressions --');

run('regression', '1 exact Sunday CORE conditioning deletion relocates to Saturday', () => {
  const seeded = seedExactSundayRegression();
  deleteThroughRealSheetDoor(SUNDAY);
  const week = accepted();
  const map = byDay();
  assert(!map.has(0), `Sunday resurrected as ${map.get(0)?.name}`);
  assert(/Hard (Conditioning|Intervals)/i.test(map.get(6)?.name ?? ''),
    `Saturday=${map.get(6)?.name}`);
  assert(map.get(6)?.sessionTier === 'core', 'Saturday did not become CORE conditioning');
  assert(!week.visibleWorkouts.some((workout) => workout.name === 'Gunshow'),
    'lower-priority Saturday Gunshow survived required relocation');
  assert(week.evaluation.ledger.conditioning.coreCount === 3,
    `conditioning=${week.evaluation.ledger.conditioning.coreCount}`);
  const preservedDaysAfter = JSON.stringify([1, 2, 3, 4, 5].map((day) => {
    const workout = map.get(day);
    return {
      day,
      planEntryId: workout?.planEntryId ?? null,
      name: workout?.name ?? null,
      exercises: workout?.exercises.map((row) => ({
        id: row.id,
        workoutId: row.workoutId,
        exerciseId: row.exerciseId,
        sets: row.prescribedSets,
        repsMin: row.prescribedRepsMin,
        repsMax: row.prescribedRepsMax,
        weight: row.prescribedWeightKg,
        rest: row.restSeconds,
      })) ?? [],
    };
  }));
  assert(preservedDaysAfter === seeded.preservedDays,
    `Monday–Friday changed\nbefore=${seeded.preservedDays}\nafter=${preservedDaysAfter}`);
  const hardCredits = week.evaluation.ledger.conditioning.credits.filter((credit) =>
    credit.source === 'app' && credit.stress === 'hard');
  assert(hardCredits.length === 1 && hardCredits[0].dayOfWeek === 6,
    `hard credits=${JSON.stringify(hardCredits)}`);
});

run('regression', '2 CORE strength deletion repairs on another valid day', () => {
  const athlete = profile({
    seasonPhase: 'Off-season',
    usualGameDay: undefined,
    gameDay: undefined,
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  });
  seed({ athlete, phaseEntryWeekStartISO: addDaysISO(WEEK, -28) });
  const before = accepted();
  const target = before.visibleWorkouts.find((workout) =>
    workout.sessionTier === 'core' && before.evaluation.ledger.mainStrength.sessionDays
      .includes(workout.dayOfWeek));
  assert(target, 'CORE strength target missing');
  const date = dateForDay(WEEK, target.dayOfWeek);
  deleteThroughRealSheetDoor(date);
  const after = accepted();
  assert(!byDay().has(target.dayOfWeek), 'deleted strength date is not Rest');
  assert(after.evaluation.blockingViolations.length === 0,
    JSON.stringify(after.evaluation.blockingViolations));
  assert(after.evaluation.ledger.mainStrength.achievedCount ===
    before.evaluation.ledger.mainStrength.achievedCount,
  `strength ${before.evaluation.ledger.mainStrength.achievedCount}->${after.evaluation.ledger.mainStrength.achievedCount}`);
  assert(after.visibleWorkouts.some((workout) =>
    workout.dayOfWeek !== target.dayOfWeek && workout.planEntryId === target.planEntryId),
  'accepted strength identity was not relocated');
});

run('regression', '3 optional session deletes without replacement', () => {
  const { sunday: _sunday } = seedExactSundayRegression();
  const gunshow = byDay().get(6);
  assert(gunshow?.sessionTier === 'optional', 'optional precondition missing');
  const before = accepted();
  deleteThroughRealSheetDoor(SATURDAY);
  const after = accepted();
  assert(!byDay().has(6), 'optional Saturday was replaced');
  assert(after.evaluation.ledger.mainStrength.achievedCount === before.evaluation.ledger.mainStrength.achievedCount,
    'optional deletion changed core strength');
  assert(after.evaluation.ledger.conditioning.coreCount === before.evaluation.ledger.conditioning.coreCount,
    'optional deletion changed core conditioning');
  assert(!after.contract.authorisedReductions.some((entry) =>
    entry.reason === 'explicit_user_override'), 'optional deletion created a reduction');
});

run('regression', '4 component deletion preserves the rest of a stacked day', () => {
  const athlete = profile({
    seasonPhase: 'Pre-season',
    usualGameDay: undefined,
    gameDay: undefined,
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
  });
  seed({ athlete });
  const stacked = accepted().visibleWorkouts.find((workout) => workout.hasCombinedConditioning);
  assert(stacked, 'stacked strength+conditioning precondition missing');
  const date = dateForDay(WEEK, stacked.dayOfWeek);
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
  let result: ReturnType<typeof applyPlanChange> | null = null;
  try {
    templateCatalog.listCoachRevisionTemplates = () => {
      templateCatalogCalls += 1;
      throw new Error('component deletion reached the revision template catalog');
    };
    liveWriteValidation.validateLiveWorkoutWrite = () => {
      liveWriteValidationCalls += 1;
      throw new Error('component deletion reached canonical template validation');
    };
    result = deleteThroughRealSheetDoor(date, 'conditioning');
  } finally {
    templateCatalog.listCoachRevisionTemplates = originalListTemplates;
    liveWriteValidation.validateLiveWorkoutWrite = originalValidateLiveWrite;
  }
  assert(templateCatalogCalls === 0, 'component deletion called listCoachRevisionTemplates');
  assert(liveWriteValidationCalls === 0,
    'component deletion called canonicalTemplateSectionSignature/validateLiveWorkoutWrite');
  assert(result, 'component deletion did not return from the typed production door');
  const remaining = byDay().get(stacked.dayOfWeek);
  assert(result.ok, `${result.message ?? 'component deletion failed'} ${JSON.stringify(result.rejected)}`);
  assert(remaining, 'component deletion became whole-day unavailability');
  assert(remaining.hasCombinedConditioning !== true && !remaining.conditioningBlock,
    'conditioning component survived');
  assert(useProgramStore.getState().acceptedMaterialContext.markedDays[date] !== 'rest',
    'component deletion created a whole-day Rest mark');
  assert(useProgramStore.getState().userRemovalConstraints.some((constraint) =>
    constraint.targetDate === date && constraint.scope === 'conditioning_component'),
  'typed component removal missing');
});

run('regression', '5 whole-session deletion on a stacked day leaves Rest', () => {
  const athlete = profile({
    seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
  });
  seed({ athlete });
  const stacked = accepted().visibleWorkouts.find((workout) => workout.hasCombinedConditioning);
  assert(stacked, 'stacked precondition missing');
  const date = dateForDay(WEEK, stacked.dayOfWeek);
  deleteWorkout({ date, workout: stacked });
  assert(!byDay().has(stacked.dayOfWeek), 'whole stacked day survived');
  assert(useProgramStore.getState().acceptedMaterialContext.markedDays[date] === 'rest',
    'whole deletion did not own Rest');
});

run('regression', '6 phase matrix keeps deletion authoritative and Bible-valid', () => {
  const scenarios: Array<{
    name: string;
    athlete: OnboardingData;
    phaseEntryOffsetWeeks: number;
    targetIndex?: number;
    marks?: Record<string, CalendarDayType>;
    componentScope?: 'strength' | 'conditioning';
    selectTarget?: (workouts: Workout[]) => Workout | undefined;
  }> = [
    { name: 'in-season game week (current)', athlete: profile(), phaseEntryOffsetWeeks: 0 },
    { name: 'in-season bye (current)', athlete: profile({ usualGameDay: undefined, gameDay: undefined }), phaseEntryOffsetWeeks: 0 },
    { name: 'early off-season', athlete: profile({ seasonPhase: 'Off-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 0 },
    { name: 'mid off-season', athlete: profile({ seasonPhase: 'Off-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 2 },
    { name: 'late off-season', athlete: profile({ seasonPhase: 'Off-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 6 },
    { name: 'early pre-season', athlete: profile({ seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 0 },
    { name: 'late pre-season', athlete: profile({ seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 6 },
    { name: 'pre-season deload', athlete: profile({ seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 0, targetIndex: 3 },
    {
      name: 'practice match',
      athlete: profile({
        seasonPhase: 'Pre-season',
        teamTrainingDaysPerWeek: 0, teamTrainingDays: [],
      }),
      phaseEntryOffsetWeeks: 2,
    },
    {
      name: 'stacked Team Training component',
      athlete: profile(),
      phaseEntryOffsetWeeks: 0,
      componentScope: 'strength',
      selectTarget: (workouts) => workouts.find((workout) =>
        /Team Training\s*\+/i.test(workout.name)),
    },
    {
      name: 'Sunday-fixture adjacent horizon',
      athlete: profile({ usualGameDay: 'Sunday', gameDay: 'Sunday' }),
      phaseEntryOffsetWeeks: 0,
    },
    {
      name: 'future in-season game week',
      athlete: profile(),
      phaseEntryOffsetWeeks: 0,
      targetIndex: 1,
    },
  ];
  for (const scenario of scenarios) {
    seed({
      athlete: scenario.athlete,
      phaseEntryWeekStartISO: addDaysISO(WEEK, -scenario.phaseEntryOffsetWeeks * 7),
      targetMicrocycleIndex: scenario.targetIndex,
      markedDays: scenario.marks,
    });
    const weekStart = useProgramStore.getState().currentMicrocycle!.startDate.slice(0, 10);
    const before = accepted(weekStart);
    const target = scenario.selectTarget?.(before.visibleWorkouts) ??
      before.visibleWorkouts.find((workout) =>
        workout.workoutType !== 'Game' && workout.workoutType !== 'Team Training' &&
        workout.workoutType !== 'Rest');
    assert(target, `${scenario.name}: production-door target missing`);
    const date = dateForDay(weekStart, target.dayOfWeek);
    deleteThroughRealSheetDoor(date, scenario.componentScope, weekStart);
    const after = accepted(weekStart);
    if (scenario.componentScope) {
      const remaining = byDay(weekStart).get(target.dayOfWeek);
      assert(remaining && /Team Training/i.test(remaining.name),
        `${scenario.name}: protected Team Training component was not preserved`);
    } else {
      assert(!byDay(weekStart).has(target.dayOfWeek), `${scenario.name}: target resurrected`);
    }
    assert(after.evaluation.blockingViolations.length === 0,
      `${scenario.name}: ${JSON.stringify(after.evaluation.blockingViolations)}`);
    assert(after.contract.identity.mode === before.contract.identity.mode,
      `${scenario.name}: phase mode changed`);
  }
});

run('regression', '7 fixture, practice-match, readiness, injury and equipment rules survive', () => {
  const scenarios: Array<{
    name: string;
    athlete: OnboardingData;
    marks: Record<string, CalendarDayType>;
    setup?: () => void;
  }> = [
    { name: 'game fixture', athlete: profile(), marks: { [SATURDAY]: 'game' } },
    {
      name: 'practice match',
      athlete: profile({
        seasonPhase: 'Pre-season',
        usualGameDay: undefined,
        gameDay: undefined,
        teamTrainingDaysPerWeek: 0,
        teamTrainingDays: [],
        trainingDaysPerWeek: 6,
        preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      }),
      marks: { [SATURDAY]: 'game' },
    },
    {
      name: 'readiness',
      athlete: profile(),
      marks: { [SATURDAY]: 'game' },
      setup: () => useReadinessStore.getState().setReadinessSignal(
        WEEK,
        buildReadinessSignalPatch('flat'),
      ),
    },
    { name: 'injury', athlete: profile({ injuries: [{ bodyArea: 'Hamstring', description: 'Sore running', severity: 'Moderate', whenItHurts: 'Running' }] }), marks: { [SATURDAY]: 'game' } },
    { name: 'equipment', athlete: profile({ trainingLocation: 'Home / garage', equipment: ['Bodyweight only'], equipmentSelectionCompleteness: 'complete' }), marks: { [SATURDAY]: 'game' } },
  ];
  for (const scenario of scenarios) {
    try {
      seed({ athlete: scenario.athlete, markedDays: scenario.marks });
      scenario.setup?.();
      const before = accepted();
      const fixture = before.contract.anchors.find((anchor) =>
        anchor.kind === 'game' || anchor.kind === 'practice_match');
      const target = before.visibleWorkouts.find((workout) =>
        workout.dayOfWeek !== fixture?.dayOfWeek && workout.workoutType !== 'Team Training' &&
        workout.workoutType !== 'Rest');
      assert(target, `${scenario.name}: deletable app session missing`);
      deleteWorkout({ date: dateForDay(WEEK, target.dayOfWeek), workout: target });
      const after = accepted();
      assert(after.evaluation.blockingViolations.length === 0,
        `${scenario.name}: ${JSON.stringify(after.evaluation.blockingViolations)}`);
      if (fixture) assert(after.contract.anchors.some((anchor) => anchor.id === fixture.id),
        `${scenario.name}: fixture anchor changed`);
    } catch (error) {
      throw new Error(`${scenario.name}: ${(error as Error).message}`, { cause: error });
    }
  }
});

run('regression', '8 Sunday deletion closes persisted following-week dependencies', () => {
  const seeded = seedExactSundayRegression();
  const nextMonday = accepted(NEXT_WEEK).visibleWorkouts.find((workout) => workout.dayOfWeek === 1);
  if (nextMonday) {
    const overlay = useProgramStore.getState().weekScopedOverlays[NEXT_WEEK];
    if (overlay) {
      overlay.workoutsByDate[NEXT_WEEK] = {
        ...nextMonday,
        derivedSessionProvenance: [{
          protocolVersion: 2,
          authorship: 'system',
          origin: 'rest_distribution_repair',
          scope: 'session',
          triggerSignature: 'user-removal-cross-week-test',
          targetMetric: 'full_rest',
          credit: { metric: 'full_rest', amount: 1 },
          originatingFixtureDate: null,
          originatingDate: NEXT_WEEK,
          validWhile: [],
          invalidWhen: [],
          history: [],
          sourcePlanEntryId: nextMonday.planEntryId ?? null,
          dependency: {
            kind: 'fixture_to_session',
            source: { date: SUNDAY, weekStart: WEEK },
            target: { date: NEXT_WEEK, weekStart: NEXT_WEEK },
            crossesWeekBoundary: true,
            displacedSession: { targetDate: NEXT_WEEK, sourcePlanEntryId: nextMonday.planEntryId ?? null, workout: clone(nextMonday) },
            restoration: { targetDate: NEXT_WEEK, sourcePlanEntryId: nextMonday.planEntryId ?? null, workout: clone(nextMonday) },
          },
        }],
      };
      useProgramStore.setState({ weekScopedOverlays: { ...useProgramStore.getState().weekScopedOverlays, [NEXT_WEEK]: overlay } });
    }
  }
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  assert(useProgramStore.getState().userRemovalConstraints.some((constraint) =>
    constraint.targetDate === SUNDAY && constraint.status === 'active'),
  'Sunday ownership missing');
  assert(accepted().evaluation.blockingViolations.length === 0, 'Sunday week not accepted');
});

run('regression', '9 tap and Coach whole-session deletion converge', () => {
  let seeded = seedExactSundayRegression();
  const tap = executeProgramControlAction({
    type: 'bin_session',
    source: { screen: 'program_tab', surface: 'test', initiatedBy: 'tap' },
    payload: { date: SUNDAY, scope: 'whole_day' },
    scope: 'today_only',
    requiresRebuild: false,
    createsActiveModifier: false,
    oneOffOnly: true,
  }, { visibleWeek: visibleWeek(), todayISO: WEEK });
  assert(tap.ok, tap.message ?? 'tap delete failed');
  const tapSemantic = visibleSemantic();
  seeded = seedExactSundayRegression();
  const coach = executeCoachCommand({
    command: {
      mode: 'mutate', operation: 'remove_session',
      target: { kind: 'date', date: SUNDAY, sessionName: seeded.sunday.name },
      payload: { operation: 'remove_session', reason: 'Athlete asked to bin it' },
      scope: 'one_off', confidence: 1, needsClarification: false,
      reason: 'athlete_requested_session_deletion',
    },
    todayISO: WEEK,
    referenceResolution: null,
    userMessage: 'Bin Sunday hard intervals',
  });
  assert(coach.kind === 'mutated' && coach.applied, JSON.stringify(coach));
  assert(visibleSemantic() === tapSemantic, 'tap and Coach accepted states differ');
});

run('regression', '10 reload, rebuild, Repeat Week and rollover do not resurrect target', () => {
  const seeded = seedExactSundayRegression();
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  const persisted = clone(useProgramStore.getState());
  const hydrated = canonicaliseHydratedState(persisted, {
    programAlreadyAccepted: true,
    profile: seeded.athlete,
    markedDays: persisted.acceptedMaterialContext.markedDays,
    validateWeekStarts: [WEEK],
  });
  useProgramStore.setState({ ...persisted, ...hydrated });
  assert(!byDay().has(0), 'reload resurrected target');
  const rebuilt = quiet(() => generateProgramLocally(seeded.athlete, {
    todayISO: WEEK,
    previousProgram: useProgramStore.getState().currentProgram,
    seasonPhaseClock: useProgramStore.getState().currentProgram?.seasonPhaseClock,
  }));
  commitProgramSetupRebuildTransaction({ program: rebuilt, profile: seeded.athlete, todayISO: WEEK });
  assert(!byDay().has(0), 'rebuild resurrected target');
  repeatWeekIntoNextWeek({ baseProfile: seeded.athlete, sourceWeekDate: WEEK, todayISO: WEEK });
  assert(!byDay().has(0), 'Repeat Week resurrected concrete target');
  rolloverProgramBlock({ baseProfile: seeded.athlete, targetDateISO: '2026-08-10' });
  assert(useProgramStore.getState().userRemovalConstraints.some((constraint) =>
    constraint.targetDate === SUNDAY && constraint.status === 'active'),
  'rollover discarded persisted removal ownership');
});

run('regression', '11 impossible relocation records typed reduction and keeps deletion', () => {
  const athlete = profile({
    seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  });
  seed({ athlete });
  const before = accepted();
  const target = before.visibleWorkouts.find((workout) =>
    before.evaluation.ledger.mainStrength.sessionDays.includes(workout.dayOfWeek));
  assert(target, 'constrained strength target missing');
  const date = dateForDay(WEEK, target.dayOfWeek);
  const result = deleteThroughRealSheetDoor(date);
  const after = accepted();
  assert(!byDay().has(target.dayOfWeek), 'typed-reduction target resurrected');
  assert(after.evaluation.blockingViolations.length === 0,
    JSON.stringify(after.evaluation.blockingViolations));
  const constraint = useProgramStore.getState().userRemovalConstraints.find((entry) =>
    entry.targetDate === date && entry.status === 'active');
  assert(constraint, 'typed reduction deletion identity missing');
  const reductions = after.contract.authorisedReductions.filter((entry) =>
    entry.reason === 'explicit_user_override' && entry.detail.includes(date));
  assert(reductions.length > 0 && reductions.every((entry) =>
    entry.affectedWeek === WEEK && entry.deletionIdentity === constraint.id),
  `reductions=${JSON.stringify(after.contract.authorisedReductions)}`);
  assert(result.message ===
    'Session removed. This week’s strength target has been reduced at your request.',
  `message=${result.message}`);
  reloadAcceptedState(athlete);
  assert(accepted().contract.authorisedReductions.some((entry) =>
    entry.deletionIdentity === constraint.id && entry.affectedWeek === WEEK),
  'hydration discarded typed deletion reduction');
  const rebuilt = quiet(() => generateProgramLocally(athlete, {
    todayISO: WEEK,
    previousProgram: useProgramStore.getState().currentProgram,
    seasonPhaseClock: useProgramStore.getState().currentProgram?.seasonPhaseClock,
  }));
  commitProgramSetupRebuildTransaction({ program: rebuilt, profile: athlete, todayISO: WEEK });
  assert(accepted().contract.authorisedReductions.some((entry) =>
    entry.deletionIdentity === constraint.id), 'rebuild discarded typed deletion reduction');
  repeatWeekIntoNextWeek({ baseProfile: athlete, sourceWeekDate: WEEK, todayISO: WEEK });
  assert(accepted().contract.authorisedReductions.some((entry) =>
    entry.deletionIdentity === constraint.id), 'Repeat Week discarded source reduction');
  rolloverProgramBlock({ baseProfile: athlete, targetDateISO: '2026-08-10' });
  assert(useProgramStore.getState().userRemovalConstraints.some((entry) =>
    entry.id === constraint.id && entry.status === 'active'),
  'rollover discarded reduction authorisation identity');
});

run('regression', '12 failed atomic publication preserves previous complete horizon', () => {
  const seeded = seedExactSundayRegression();
  const before = JSON.stringify({
    program: useProgramStore.getState().currentProgram,
    overlays: useProgramStore.getState().weekScopedOverlays,
    constraints: useProgramStore.getState().userRemovalConstraints,
    marks: useProgramStore.getState().acceptedMaterialContext.markedDays,
  });
  useProfileStore.setState({ onboardingData: null } as never);
  let rejected = false;
  try {
    deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  } catch {
    rejected = true;
  }
  const after = JSON.stringify({
    program: useProgramStore.getState().currentProgram,
    overlays: useProgramStore.getState().weekScopedOverlays,
    constraints: useProgramStore.getState().userRemovalConstraints,
    marks: useProgramStore.getState().acceptedMaterialContext.markedDays,
  });
  assert(rejected, 'technical publication failure was not surfaced');
  assert(after === before, 'failed publication partially committed');
});

run('regression', '13 direct and chained mutations converge on accepted state', () => {
  let seeded = seedExactSundayRegression();
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  const direct = visibleSemantic();
  seeded = seedExactSundayRegression();
  const state = useProgramStore.getState();
  useProgramStore.setState({ acceptedMaterialContext: { ...state.acceptedMaterialContext, lastTransaction: 'harmless-chain-prefix' } });
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  const chained = visibleSemantic();
  assert(chained === direct, 'direct and chained final states differ');
});

run('regression', '14 exact in-season Lower Body deletion relocates and explains publication', () => {
  const athlete = seedExactInSeasonStrengthWeek();
  const before = accepted();
  const lower = byDay().get(1)!;
  const result = deleteThroughRealSheetDoor(WEEK);
  const after = accepted();
  const relocated = after.visibleWorkouts.find((workout) =>
    workout.dayOfWeek !== 1 && workout.planEntryId === lower.planEntryId);
  assert(!byDay().has(1), 'Monday lower deletion was not preserved');
  assert(relocated?.dayOfWeek === 3, `lower destination=${relocated?.dayOfWeek}`);
  assert(after.evaluation.ledger.mainStrength.achievedCount ===
    before.evaluation.ledger.mainStrength.achievedCount, 'lower deletion reduced strength');
  assert(Object.values(after.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount)
    .every((count) => count > 0), 'lower deletion left a stale/missing pattern');
  assert(!after.contract.authorisedReductions.some((entry) =>
    entry.reason === 'explicit_user_override'), 'lower repair created a reduction');
  assert(result.message ===
    'Session removed. Lower-body strength was moved to Wednesday to keep your week balanced.',
  `message=${result.message}`);
  assert(visibleWeek().find((day) => day.date === '2026-07-15')?.workout?.planEntryId ===
    lower.planEntryId, 'weekly card projection missed relocated lower session');
  reloadAcceptedState(athlete);
  assert(!byDay().has(1) && byDay().get(3)?.planEntryId === lower.planEntryId,
    'reload changed Lower Body repair');
});

run('regression', '15 exact Upper Pull component deletion preserves Team Training and relocates pull', () => {
  const athlete = seedExactInSeasonStrengthWeek();
  const before = accepted();
  const pushBefore = clone(byDay().get(4)!);
  assert(byDay().get(5)?.sessionTier === 'optional', 'optional displacement precondition missing');
  const result = deleteThroughRealSheetDoor('2026-07-14', 'strength');
  const after = accepted();
  const tuesday = byDay().get(2);
  const relocated = after.visibleWorkouts.find((workout) =>
    workout.dayOfWeek !== 2 &&
    workout.strengthIntent?.effectivePatterns.includes('pull'));
  assert(tuesday?.name === 'Team Training' && tuesday.workoutType === 'Team Training',
    `Tuesday=${tuesday?.name}/${tuesday?.workoutType}`);
  assert(!tuesday.strengthIntent && !tuesday.exercises.some((row) =>
    row.section18Evidence?.role === 'main_strength'), 'deleted pull retained stale Tuesday credit');
  assert(relocated?.dayOfWeek === 3 && relocated.name === 'Upper Pull',
    `relocated=${relocated?.dayOfWeek}:${relocated?.name}`);
  assert(relocated.planEntryId === 'w1:tuesday:none:team:strength-component',
    `component identity=${relocated.planEntryId}`);
  assert(prescriptionSignature(byDay().get(4)) === prescriptionSignature(pushBefore),
    `Thursday Upper Push identity/prescription changed ` +
    `${prescriptionSignature(pushBefore)} -> ${prescriptionSignature(byDay().get(4))}`);
  assert(!byDay().has(5), 'optional Friday work was not displaced before CORE work');
  assert(after.evaluation.ledger.mainStrength.achievedCount ===
    before.evaluation.ledger.mainStrength.achievedCount, 'pull relocation reduced strength');
  assert(after.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount.pull === 1,
    'pull relocation was not visibly credited exactly once');
  assert(!after.contract.authorisedReductions.some((entry) =>
    entry.reason === 'explicit_user_override'), 'pull relocation created a reduction');
  assert(useProgramStore.getState().acceptedMaterialContext.markedDays['2026-07-14'] !== 'rest',
    'component deletion widened to whole-day Rest');
  assert(result.message === 'Upper Pull was removed. Pulling work was added to Wednesday.',
    `message=${result.message}`);
  assert(visibleWeek().find((day) => day.date === '2026-07-15')?.workout?.planEntryId ===
    relocated.planEntryId, 'weekly card and accepted pull differ');
  reloadAcceptedState(athlete);
  assert(byDay().get(2)?.name === 'Team Training' &&
    byDay().get(3)?.planEntryId === relocated.planEntryId,
  'reload changed Upper Pull repair');
});

run('regression', '16 Upper Push component deletion preserves Team Training and relocates push', () => {
  const athlete = seedExactInSeasonStrengthWeek();
  const pullBefore = clone(byDay().get(2)!);
  const result = deleteThroughRealSheetDoor('2026-07-16', 'strength');
  const after = accepted();
  const thursday = byDay().get(4);
  const relocated = after.visibleWorkouts.find((workout) =>
    workout.dayOfWeek !== 4 &&
    workout.strengthIntent?.effectivePatterns.includes('push'));
  assert(thursday?.name === 'Team Training' && !thursday.strengthIntent,
    `Thursday=${thursday?.name}`);
  assert(relocated && relocated.dayOfWeek !== 4, 'Upper Push was not relocated');
  assert(prescriptionSignature(byDay().get(2)) === prescriptionSignature(pullBefore),
    `Tuesday Upper Pull changed during push repair ` +
    `${prescriptionSignature(pullBefore)} -> ${prescriptionSignature(byDay().get(2))}`);
  assert(after.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount.push === 1,
    'push relocation was not credited exactly once');
  assert(!after.contract.authorisedReductions.some((entry) =>
    entry.reason === 'explicit_user_override'), 'push relocation created a reduction');
  assert(result.message.includes('Upper Push was removed. Pushing work was added to '),
    `message=${result.message}`);
  reloadAcceptedState(athlete);
  assert(byDay().get(4)?.name === 'Team Training' &&
    accepted().evaluation.ledger.strengthPatterns.meaningfulMainLiftCount.push === 1,
  'reload changed Upper Push repair');
});

run('regression', '17 existing alternative pull exposure avoids duplicate repair', () => {
  seedExactInSeasonStrengthWeek();
  const tuesday = clone(byDay().get(2)!);
  const alternativeId = 'accepted-alternative-upper-pull';
  const alternativeDate = '2026-07-15';
  const alternative: Workout = {
    ...tuesday,
    id: alternativeId,
    planEntryId: alternativeId,
    dayOfWeek: 3,
    name: 'Upper Pull',
    workoutType: 'Strength',
    section18ConditioningRole: 'none',
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'explicit_mutation',
    },
    derivedSessionProvenance: undefined,
    exercises: tuesday.exercises.map((row, index) => ({
      ...row,
      id: `${alternativeId}:row:${index + 1}`,
      workoutId: alternativeId,
    })),
    ...({ isTeamDay: false } as Record<string, unknown>),
  };
  const state = useProgramStore.getState();
  useProgramStore.setState({
    dateOverrides: { ...state.dateOverrides, [alternativeDate]: alternative },
    overrideContexts: {
      ...state.overrideContexts,
      [alternativeDate]: { intent: 'program_adjustment', label: 'accepted alternative exposure' },
    },
    acceptedMaterialContext: {
      ...state.acceptedMaterialContext,
      markedDays: { ...state.acceptedMaterialContext.markedDays, [FRIDAY]: 'rest' },
    },
  });
  useCalendarStore.setState({
    markedDays: { ...useCalendarStore.getState().markedDays, [FRIDAY]: 'rest' },
  });
  assert(byDay().get(3)?.planEntryId === alternativeId,
    'accepted alternative did not enter the visible source week');
  assert(accepted().evaluation.blockingViolations.length === 0,
    `alternative exposure seed was not Bible-valid: ` +
    `${JSON.stringify(accepted().evaluation.blockingViolations)}`);
  const result = deleteThroughRealSheetDoor('2026-07-14', 'strength');
  const after = accepted();
  assert(byDay().get(2)?.name === 'Team Training', 'Team Training did not survive');
  assert(byDay().get(3)?.planEntryId === alternativeId,
    `existing pull exposure changed: ${JSON.stringify(after.visibleWorkouts.map((workout) => ({
      day: workout.dayOfWeek,
      name: workout.name,
      id: workout.planEntryId,
      patterns: workout.strengthIntent?.effectivePatterns ?? [],
    })))} overrides=${JSON.stringify(Object.entries(useProgramStore.getState().dateOverrides)
      .map(([date, workout]) => ({ date, id: workout.planEntryId, name: workout.name })))}`);
  assert(after.evaluation.ledger.mainStrength.achievedCount === 3 &&
    after.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount.pull === 1,
  'existing exposure did not satisfy the accepted contract');
  assert(after.visibleWorkouts.filter((workout) =>
    workout.strengthIntent?.effectivePatterns.includes('pull')).length === 1,
  'unnecessary duplicate pull was created');
  assert(result.message ===
    'Upper Pull was removed. Your remaining sessions already cover this week’s target.',
  `message=${result.message}`);
});

run('regression', '18 CORE conditioning stacks onto compatible strength before reduction', () => {
  const seeded = seedExactSundayRegression();
  const state = useProgramStore.getState();
  const overlay = clone(state.weekScopedOverlays[WEEK]);
  overlay.workoutsByDate[FRIDAY] = null;
  overlay.workoutsByDate[SATURDAY] = null;
  const markedDays = {
    ...state.acceptedMaterialContext.markedDays,
    [FRIDAY]: 'rest' as const,
    [SATURDAY]: 'rest' as const,
  };
  useCalendarStore.setState({
    markedDays,
    selectedDate: useCalendarStore.getState().selectedDate,
  });
  useProgramStore.setState({
    weekScopedOverlays: { ...state.weekScopedOverlays, [WEEK]: overlay },
    acceptedMaterialContext: {
      ...state.acceptedMaterialContext,
      markedDays,
    },
  });
  const before = accepted();
  const mondayBefore = clone(byDay().get(1)!);
  assert(mondayBefore && before.evaluation.blockingViolations.length === 0,
    `stacking seed invalid: ${JSON.stringify(before.evaluation.blockingViolations)}`);
  const result = deleteThroughRealSheetDoor(SUNDAY);
  const after = accepted();
  const mondayAfter = byDay().get(1);
  assert(!byDay().has(0), 'deleted conditioning target resurrected');
  assert(mondayAfter?.planEntryId === mondayBefore.planEntryId &&
    mondayAfter.hasCombinedConditioning === true && !!mondayAfter.conditioningBlock,
  `Monday did not receive stacked conditioning: ${mondayAfter?.name}`);
  assert(mainStrengthPrescriptionSignature(mondayAfter) ===
    mainStrengthPrescriptionSignature(mondayBefore),
  'conditioning stacking rewrote the accepted strength prescription');
  assert(after.evaluation.ledger.conditioning.coreCount ===
    before.evaluation.ledger.conditioning.coreCount,
  `conditioning ${before.evaluation.ledger.conditioning.coreCount}->` +
    `${after.evaluation.ledger.conditioning.coreCount}`);
  assert(!after.contract.authorisedReductions.some((entry) =>
    entry.reason === 'explicit_user_override'), 'stackable repair created a reduction');
  assert(result.message ===
    'Session removed. Conditioning work was added to Monday.',
  `message=${result.message}`);
  reloadAcceptedState(seeded.athlete);
  assert(byDay().get(1)?.hasCombinedConditioning === true && !byDay().has(0),
    'reload changed conditioning stacking outcome');
});

console.log('\n-- Athlete session deletion properties --');

run('property', 'CORE label never grants deletion permission', () => {
  const seeded = seedExactSundayRegression();
  const renamed = { ...seeded.sunday, name: 'Anything', sessionTier: 'core' as const };
  deleteWorkout({ date: SUNDAY, workout: renamed });
  assert(!byDay().has(0), 'CORE-labelled target survived');
});

run('property', 'active removal application is idempotent', () => {
  const seeded = seedExactSundayRegression();
  const constraint: UserRemovalConstraint = {
    protocolVersion: 1,
    id: userRemovalConstraintId({ date: SUNDAY, scope: 'whole_session', workout: seeded.sunday }),
    authorship: 'user', source: 'tap', status: 'active', targetDate: SUNDAY,
    scope: 'whole_session', targetPlanEntryId: seeded.sunday.planEntryId ?? null,
    targetWorkoutId: seeded.sunday.id, originalWorkout: clone(seeded.sunday),
    remainingWorkout: null, equivalentExposureMayRelocate: true,
    wholeDayRestOwned: true, createdAt: '2026-07-15T00:00:00.000Z',
    restoredAt: null, restorationReason: null,
  };
  const once = applyUserRemovalConstraintsToWeek({ workouts: accepted().composedWorkouts, weekStart: WEEK, constraints: [constraint] });
  const twice = applyUserRemovalConstraintsToWeek({ workouts: once, weekStart: WEEK, constraints: [constraint] });
  assert(JSON.stringify(once) === JSON.stringify(twice), 'removal application is not idempotent');
});

run('property', 'workout names and stale workoutType are not removal identity', () => {
  const seeded = seedExactSundayRegression();
  const constraint: UserRemovalConstraint = {
    protocolVersion: 1,
    id: userRemovalConstraintId({ date: SUNDAY, scope: 'whole_session', workout: seeded.sunday }),
    authorship: 'user', source: 'tap', status: 'active', targetDate: SUNDAY,
    scope: 'whole_session', targetPlanEntryId: seeded.sunday.planEntryId ?? null,
    targetWorkoutId: seeded.sunday.id, originalWorkout: clone(seeded.sunday),
    remainingWorkout: null, equivalentExposureMayRelocate: true,
    wholeDayRestOwned: true, createdAt: '2026-07-15T00:00:00.000Z',
    restoredAt: null, restorationReason: null,
  };
  const mutated = accepted().composedWorkouts.map((workout) => workout.dayOfWeek === 0
    ? { ...workout, name: 'Renamed by rebuild', workoutType: 'Strength' as const }
    : workout);
  const visible = applyUserRemovalConstraintsToWeek({ workouts: mutated, weekStart: WEEK, constraints: [constraint] });
  assert(!visible.some((workout) => workout.dayOfWeek === 0), 'copy fields defeated target ownership');
});

run('property', 'equivalent work may relocate but never to prohibited target', () => {
  const seeded = seedExactSundayRegression();
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  const week = accepted();
  assert(!week.visibleWorkouts.some((workout) => workout.dayOfWeek === 0), 'target reused');
  assert(week.evaluation.ledger.conditioning.coreCount === 3, 'equivalent exposure did not relocate');
});

run('property', 'explicit re-add restores typed ownership', () => {
  const seeded = seedExactSundayRegression();
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  useProgramStore.getState().setManualOverride(
    SUNDAY,
    seeded.sunday,
    { intent: 'program_adjustment', label: 'explicit restore' },
  );
  assert(useProgramStore.getState().userRemovalConstraints.some((constraint) =>
    constraint.targetDate === SUNDAY && constraint.status === 'restored' &&
    constraint.restorationReason === 'explicit_re_add'), 'restoration state missing');
  assert(useProgramStore.getState().acceptedMaterialContext.markedDays[SUNDAY] !== 'rest',
    'restoration retained deletion-owned Rest mark');
});

run('regression', '19 whole CORE deletion restores the exact session and removes owned relocation', () => {
  seedExactInSeasonStrengthWeek();
  const original = clone(byDay().get(1)!);
  const before = visibleSemantic();
  deleteThroughRealSheetDoor(WEEK);
  const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(adjustment?.kind === 'session_delete', 'whole deletion adjustment missing');
  const outcome = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(outcome.outcome === 'restored', JSON.stringify(outcome));
  assert(visibleSemantic() === before, 'restored CORE week differs from its exact accepted before-state');
  assert(prescriptionSignature(byDay().get(1)) === prescriptionSignature(original),
    'restored CORE prescription differs');
  assert(useProgramStore.getState().userRemovalConstraints.filter((constraint) =>
    constraint.targetDate === WEEK && constraint.status === 'restored').length === 1,
  'only the exact owned removal was not marked restored');
});

run('regression', '20 Upper Pull restoration preserves Team Training and removes only owned relocation', () => {
  seedExactInSeasonStrengthWeek();
  const before = visibleSemantic();
  const tuesdayBefore = clone(byDay().get(2)!);
  deleteThroughRealSheetDoor('2026-07-14', 'strength');
  const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(adjustment?.kind === 'session_component_delete', 'component adjustment missing');
  const outcome = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(outcome.outcome === 'restored', JSON.stringify(outcome));
  const tuesdayAfter = byDay().get(2);
  assert(tuesdayAfter?.name === 'Team Training + Upper Pull', 'Upper Pull was not restacked');
  assert(prescriptionSignature(tuesdayAfter) === prescriptionSignature(tuesdayBefore),
    'Upper Pull prescription changed during restore');
  assert(visibleSemantic() === before, 'Upper Pull restoration changed unrelated sessions');
});

run('regression', '21 conditioning component restoration preserves the stacked strength component', () => {
  const athlete = profile({
    seasonPhase: 'Pre-season',
    usualGameDay: undefined,
    gameDay: undefined,
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
  });
  seed({ athlete });
  const stacked = accepted().visibleWorkouts.find((workout) => workout.hasCombinedConditioning);
  assert(stacked, 'stacked conditioning precondition missing');
  const before = visibleSemantic();
  const date = dateForDay(WEEK, stacked.dayOfWeek);
  const result = applyPlanChange({
    change: { kind: 'remove_session', date, scope: 'conditioning' },
    visibleWeek: visibleWeek(),
    todayISO: WEEK,
    setManualOverride: () => { throw new Error('component deletion used legacy override writer'); },
  });
  assert(result.ok, JSON.stringify(result.rejected));
  const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(adjustment?.restorationTarget.componentScope === 'conditioning_component',
    'conditioning ownership missing');
  const outcome = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(outcome.outcome === 'restored', JSON.stringify(outcome));
  assert(visibleSemantic() === before, 'conditioning restoration changed the stacked week');
});

run('regression', '22 Restore removes only its typed reduction and preserves an unrelated reduction', () => {
  const athlete = profile({
    seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  });
  seed({ athlete });
  const before = accepted();
  const target = before.visibleWorkouts.find((workout) =>
    before.evaluation.ledger.mainStrength.sessionDays.includes(workout.dayOfWeek));
  assert(target, 'typed reduction restoration target missing');
  const date = dateForDay(WEEK, target.dayOfWeek);
  deleteThroughRealSheetDoor(date);
  const adjustment = useProgramStore.getState().reversibleAdjustmentLedger.adjustments.at(-1);
  assert(adjustment?.linkedTypedReductions.length, 'owned typed reduction was not linked');
  const state = useProgramStore.getState();
  const overlay = clone(state.weekScopedOverlays[WEEK]);
  const owned = overlay.exposureContractV2.authorisedReductions.find((entry) =>
    entry.deletionIdentity === adjustment.linkedUserRemovalConstraintIds[0]);
  assert(owned, 'owned reduction missing from accepted contract');
  const migrated = normalizeReversibleAdjustmentLedger({
    value: null,
    userRemovalConstraints: state.userRemovalConstraints,
    acceptedRevision: state.acceptedMaterialContext.revision,
    exposureContractsByWeek: { [WEEK]: overlay.exposureContractV2 },
  });
  assert(migrated.adjustments.some((candidate) =>
    candidate.linkedTypedReductions.some((entry) =>
      entry.deletionIdentity === owned.deletionIdentity)),
  'lossless migration did not link the existing typed reduction by deletion identity');
  const program = clone(state.currentProgram);
  assert(program, 'accepted program missing');
  const unrelatedMicrocycle = program.microcycles.find((microcycle) =>
    microcycle.startDate !== WEEK && !!microcycle.exposureContractV2);
  assert(unrelatedMicrocycle?.exposureContractV2, 'unrelated contract week missing');
  const unrelated = {
    ...clone(owned),
    affectedWeek: unrelatedMicrocycle.startDate,
    detail: `${owned.detail}:unrelated`,
    deletionIdentity: 'unrelated-adjustment:reduction',
  };
  unrelatedMicrocycle.exposureContractV2.authorisedReductions = [
    ...unrelatedMicrocycle.exposureContractV2.authorisedReductions,
    unrelated,
  ];
  useProgramStore.setState({ currentProgram: program });
  const restored = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(restored.outcome === 'restored', JSON.stringify(restored));
  const reductions = accepted().contract.authorisedReductions;
  assert(!reductions.some((entry) =>
    entry.deletionIdentity === adjustment.linkedUserRemovalConstraintIds[0]),
  'owned typed reduction survived Restore');
  const persistedUnrelated = useProgramStore.getState().currentProgram?.microcycles
    .find((microcycle) => microcycle.startDate === unrelatedMicrocycle.startDate)
    ?.exposureContractV2?.authorisedReductions;
  assert(persistedUnrelated?.some((entry) =>
    entry.deletionIdentity === unrelated.deletionIdentity),
    'unrelated typed reduction was removed');
  assert(byDay().get(target.dayOfWeek)?.planEntryId === target.planEntryId,
    'typed reduction target session was not restored');
});

run('regression', '23 restoration gateway rejection publishes no partial accepted state', () => {
  const athlete = profile({
    seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined,
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  });
  seed({ athlete });
  const week = accepted();
  const target = week.visibleWorkouts.find((workout) =>
    week.evaluation.ledger.mainStrength.sessionDays.includes(workout.dayOfWeek));
  assert(target, 'gateway failure restoration target missing');
  deleteThroughRealSheetDoor(dateForDay(WEEK, target.dayOfWeek));
  const state = useProgramStore.getState();
  const ledger = clone(state.reversibleAdjustmentLedger);
  const adjustment = ledger.adjustments.at(-1);
  const ownedContract = adjustment?.displacedOriginalState.ownedWeeks[0]
    ?.beforeExposureContract;
  assert(adjustment && ownedContract, 'gateway failure owned contract missing');
  ownedContract.mainStrength.exposure.requiredMinimum = 99;
  ownedContract.mainStrength.exposure.plannerSelectedTarget = 99;
  useProgramStore.setState({ reversibleAdjustmentLedger: ledger });
  const beforeVisible = visibleSemantic();
  const beforeState = JSON.stringify({
    program: useProgramStore.getState().currentProgram,
    overlays: useProgramStore.getState().weekScopedOverlays,
    overrides: useProgramStore.getState().dateOverrides,
    contexts: useProgramStore.getState().overrideContexts,
    removals: useProgramStore.getState().userRemovalConstraints,
    ledger: useProgramStore.getState().reversibleAdjustmentLedger,
    material: useProgramStore.getState().acceptedMaterialContext,
  });
  const restored = commitClearReversibleAdjustment(
    adjustment.id,
    useProgramStore.getState().acceptedMaterialContext.revision,
  );
  assert(restored.outcome === 'safely-rejected', JSON.stringify(restored));
  assert(visibleSemantic() === beforeVisible, 'gateway rejection changed the visible program');
  const afterState = JSON.stringify({
    program: useProgramStore.getState().currentProgram,
    overlays: useProgramStore.getState().weekScopedOverlays,
    overrides: useProgramStore.getState().dateOverrides,
    contexts: useProgramStore.getState().overrideContexts,
    removals: useProgramStore.getState().userRemovalConstraints,
    ledger: useProgramStore.getState().reversibleAdjustmentLedger,
    material: useProgramStore.getState().acceptedMaterialContext,
  });
  assert(afterState === beforeState, 'gateway rejection published partial accepted state');
});

console.log('\n-- Athlete session deletion mutation witnesses --');

run('mutation', 'ignoring persisted removal resurrects target and is detected', () => {
  const seeded = seedExactSundayRegression();
  const constraint: UserRemovalConstraint = {
    protocolVersion: 1,
    id: 'mutation:removal', authorship: 'user', source: 'tap', status: 'active',
    targetDate: SUNDAY, scope: 'whole_session',
    targetPlanEntryId: seeded.sunday.planEntryId ?? null,
    targetWorkoutId: seeded.sunday.id, originalWorkout: clone(seeded.sunday),
    remainingWorkout: null, equivalentExposureMayRelocate: true,
    wholeDayRestOwned: true, createdAt: '2026-07-15T00:00:00.000Z',
    restoredAt: null, restorationReason: null,
  };
  const ignored = accepted().composedWorkouts.some((workout) => workout.dayOfWeek === 0);
  const enforced = applyUserRemovalConstraintsToWeek({ workouts: accepted().composedWorkouts, weekStart: WEEK, constraints: [constraint] });
  assert(ignored && !enforced.some((workout) => workout.dayOfWeek === 0),
    'mutation witness did not distinguish ignored ownership');
});

run('mutation', 'component scope cannot mutate into whole-day Rest ownership', () => {
  const seeded = seedExactSundayRegression();
  const remaining = { ...seeded.sunday, hasCombinedConditioning: false, conditioningBlock: undefined };
  deleteWorkout({
    date: SUNDAY,
    workout: seeded.sunday,
    scope: 'conditioning_component',
    remainingWorkout: remaining,
  });
  const constraint = useProgramStore.getState().userRemovalConstraints.find((candidate) =>
    candidate.targetDate === SUNDAY && candidate.status === 'active');
  assert(constraint?.scope === 'conditioning_component' && !constraint.wholeDayRestOwned,
    'component scope was widened');
  assert(useProgramStore.getState().acceptedMaterialContext.markedDays[SUNDAY] !== 'rest',
    'component scope wrote whole-day Rest');
});

run('mutation', 'publication cannot omit persisted constraint from accepted surfaces', () => {
  const seeded = seedExactSundayRegression();
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
  const state = useProgramStore.getState();
  assert(state.userRemovalConstraints.length === 1, 'constraint missing from ProgramStore');
  assert(!rebaseAcceptedEffectiveWeek({
    surfaces: state,
    weekStart: WEEK,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  }).visibleWorkouts.some((workout) => workout.dayOfWeek === 0),
  'accepted rebasing ignored persisted constraint');
});

console.warn = originalWarn;
console.log(`\nAthlete session deletion totals: regressions=${regressions}/23 properties=${properties}/5 mutations=${mutations}/3 failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failures: ${failures.join(' | ')}`);
  process.exitCode = 1;
}
