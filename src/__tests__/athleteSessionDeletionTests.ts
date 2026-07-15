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
import { applyPlanChange } from '../utils/planChangeProducer';
import { executeCoachCommand } from '../utils/coachCommandExecutor';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { repeatWeekIntoNextWeek } from '../utils/repeatWeek';
import { rolloverProgramBlock } from '../utils/programBlockRollover';

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

console.log('\n-- Athlete session deletion regressions --');

run('regression', '1 exact Sunday CORE conditioning deletion relocates to Saturday', () => {
  const seeded = seedExactSundayRegression();
  deleteWorkout({ date: SUNDAY, workout: seeded.sunday });
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
  deleteWorkout({ date, workout: target });
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
  deleteWorkout({ date: SATURDAY, workout: gunshow });
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
  const result = applyPlanChange({
    change: { kind: 'remove_session', date, scope: 'conditioning' },
    visibleWeek: visibleWeek(),
    todayISO: WEEK,
    setManualOverride: (overrideDate, workout, context) =>
      useProgramStore.getState().setManualOverride(overrideDate, workout, context),
  });
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
  }> = [
    { name: 'in-season', athlete: profile(), phaseEntryOffsetWeeks: 0 },
    { name: 'bye', athlete: profile({ usualGameDay: undefined, gameDay: undefined }), phaseEntryOffsetWeeks: 0 },
    { name: 'early off-season', athlete: profile({ seasonPhase: 'Off-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 0 },
    { name: 'mid off-season', athlete: profile({ seasonPhase: 'Off-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 2 },
    { name: 'late off-season', athlete: profile({ seasonPhase: 'Off-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 6 },
    { name: 'pre-season', athlete: profile({ seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 0 },
    { name: 'deload', athlete: profile({ seasonPhase: 'Pre-season', usualGameDay: undefined, gameDay: undefined, teamTrainingDaysPerWeek: 0, teamTrainingDays: [] }), phaseEntryOffsetWeeks: 0, targetIndex: 3 },
  ];
  for (const scenario of scenarios) {
    seed({
      athlete: scenario.athlete,
      phaseEntryWeekStartISO: addDaysISO(WEEK, -scenario.phaseEntryOffsetWeeks * 7),
      targetMicrocycleIndex: scenario.targetIndex,
    });
    const weekStart = useProgramStore.getState().currentMicrocycle!.startDate.slice(0, 10);
    const before = accepted(weekStart);
    const target = before.visibleWorkouts.find((workout) =>
      workout.workoutType !== 'Game' && workout.workoutType !== 'Team Training' &&
      workout.workoutType !== 'Rest');
    if (!target) continue; // Zero-session early off-season is valid policy.
    const date = dateForDay(weekStart, target.dayOfWeek);
    deleteWorkout({ date, workout: target });
    const after = accepted(weekStart);
    assert(!byDay(weekStart).has(target.dayOfWeek), `${scenario.name}: target resurrected`);
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
  deleteWorkout({ date, workout: target });
  const after = accepted();
  assert(!byDay().has(target.dayOfWeek), 'typed-reduction target resurrected');
  assert(after.evaluation.blockingViolations.length === 0,
    JSON.stringify(after.evaluation.blockingViolations));
  assert(after.contract.authorisedReductions.some((entry) =>
    entry.reason === 'explicit_user_override' && entry.detail.includes(date)),
  `reductions=${JSON.stringify(after.contract.authorisedReductions)}`);
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
console.log(`\nAthlete session deletion totals: regressions=${regressions}/13 properties=${properties}/5 mutations=${mutations}/3 failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failures: ${failures.join(' | ')}`);
  process.exitCode = 1;
}
