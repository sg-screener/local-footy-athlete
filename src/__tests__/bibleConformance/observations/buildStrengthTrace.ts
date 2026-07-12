import { performance } from 'node:perf_hooks';
import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  Workout,
} from '../../../types/domain';
import { buildWorkoutsFromCoach } from '../../../data/defaultProgram';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
  type SessionAllocation,
} from '../../../utils/coachingEngine';
import {
  buildBlockWeekStates,
  computeBlockBounds,
  type ProgramBlockState,
} from '../../../utils/programBlockState';
import {
  buildDayWorkoutProjectedDay,
  buildProgramTabProjectedWeek,
  extractVisibleProgramItemsFromWorkout,
} from '../../../utils/visibleProgramReadModel';
import type { ScheduleState } from '../../../utils/sessionResolver';
import { DEFAULT_ATHLETE_CONTEXT } from '../../../utils/sessionBuilder';
import { resolveEquipmentAvailability } from '../../../utils/equipmentAvailability';
import {
  getSessionComponentRows,
  getSessionComponents,
} from '../../../utils/sessionComponents';
import { deriveVisibleWorkoutIdentity } from '../../../utils/visibleWorkoutIdentity';
import type {
  ObservedStrengthSession,
  StrengthArchetype,
  StrengthGoldenScenario,
  StrengthPattern,
  StrengthScenarioTrace,
  StrengthTraceStage,
} from '../types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NUMBERS: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};
const PATTERN_ORDER: StrengthPattern[] = ['squat', 'hinge', 'push', 'pull'];

function canonicalPatterns(patterns: readonly string[] | undefined): StrengthPattern[] {
  const values = new Set(patterns ?? []);
  return PATTERN_ORDER.filter((pattern) => values.has(pattern));
}

function rowNames(rows: readonly any[]): string[] {
  return rows
    .map((row) => String(row?.exercise?.name ?? row?.name ?? '').trim())
    .filter(Boolean);
}

function dateForDay(weekStart: string, day: string): string {
  const offset = day === 'Sunday' ? 6 : (DAY_NUMBERS[day] ?? 1) - 1;
  const date = new Date(`${weekStart}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function contractFields(value: Pick<SessionAllocation, 'strengthIntent'> | Workout) {
  const intent = value.strengthIntent;
  return {
    archetype: (intent?.archetype ?? null) as StrengthArchetype | null,
    primaryPattern: (intent?.primaryPattern ?? null) as StrengthPattern | null,
    plannedPatterns: canonicalPatterns(intent?.plannedPatterns),
    effectivePatterns: canonicalPatterns(intent?.effectivePatterns),
  };
}

function allocationSnapshot(
  session: SessionAllocation,
  state: ProgramBlockState,
): ObservedStrengthSession {
  return {
    stage: 'allocation',
    weekNumber: state.weekNumber,
    weekInBlock: state.weekInBlock,
    day: session.dayOfWeek ?? 'TBD',
    date: session.dayOfWeek ? dateForDay(state.weekStart, session.dayOfWeek) : undefined,
    planEntryId: session.planEntryId ?? '',
    ...contractFields(session),
    tier: session.tier,
    workoutType: null,
    components: [],
    exerciseNames: [],
    strengthRowNames: [],
    conditioningRowNames: [],
    supportRowNames: [],
    visibleItemDomains: [],
    visibleTitle: null,
    visibleSubtitle: null,
    focus: session.focus,
  };
}

function workoutSnapshot(args: {
  stage: Exclude<StrengthTraceStage, 'allocation'>;
  workout: Workout;
  state: ProgramBlockState;
  date?: string;
  focusByPlanEntryId: Map<string, string>;
  includeVisibleItems?: boolean;
}): ObservedStrengthSession {
  const rows = getSessionComponentRows(args.workout);
  const identity = deriveVisibleWorkoutIdentity(args.workout);
  return {
    stage: args.stage,
    weekNumber: args.state.weekNumber,
    weekInBlock: args.state.weekInBlock,
    day: DAY_NAMES[args.workout.dayOfWeek] ?? String(args.workout.dayOfWeek),
    date: args.date ?? dateForDay(args.state.weekStart, DAY_NAMES[args.workout.dayOfWeek]),
    planEntryId: args.workout.planEntryId ?? '',
    ...contractFields(args.workout),
    tier: args.workout.sessionTier ?? null,
    workoutType: args.workout.workoutType,
    components: getSessionComponents(args.workout).map((component) => component.kind),
    exerciseNames: rowNames(args.workout.exercises ?? []),
    strengthRowNames: rowNames(rows.strengthRows),
    conditioningRowNames: rowNames(rows.conditioningRows),
    supportRowNames: rowNames(rows.supportRows),
    visibleItemDomains: args.includeVisibleItems
      ? extractVisibleProgramItemsFromWorkout(args.workout).map((item) => item.domain)
      : [],
    visibleTitle: identity.title,
    visibleSubtitle: String(identity.subtitle),
    focus: args.focusByPlanEntryId.get(args.workout.planEntryId ?? '') ?? null,
  };
}

function mutateAllocationFocus(
  scenario: StrengthGoldenScenario,
  plan: CoachingPlan,
): void {
  const mutation = scenario.displayMutation;
  if (!mutation) return;
  for (const session of plan.weeklyPlan) {
    if (session.dayOfWeek === mutation.targetDay && session.strengthIntent) {
      session.focus = mutation.focus;
    }
  }
}

function mutateWorkoutName(
  scenario: StrengthGoldenScenario,
  workouts: Workout[],
): void {
  const mutation = scenario.displayMutation;
  if (!mutation) return;
  const targetDow = DAY_NUMBERS[mutation.targetDay];
  for (const workout of workouts) {
    if (workout.dayOfWeek === targetDow && workout.strengthIntent) {
      workout.name = mutation.workoutName;
      workout.description = mutation.focus;
    }
  }
}

function scheduleState(args: {
  profile: OnboardingData;
  program: TrainingProgram;
  microcycle: Microcycle;
  plan: CoachingPlan;
  blockStart: string;
  referenceDate: string;
}): ScheduleState & { activeConstraints: any[] } {
  const equipmentTags = resolveEquipmentAvailability(args.profile, [], args.referenceDate);
  const selectedDays = new Set([
    ...(args.profile.preferredTrainingDays ?? []),
    ...(args.profile.teamTrainingDays ?? []),
  ]);
  return {
    currentProgram: args.program,
    currentMicrocycle: args.microcycle,
    manualOverrides: {},
    weekScopedOverlays: {},
    markedDays: {},
    athleteContext: {
      ...DEFAULT_ATHLETE_CONTEXT,
      injuries: args.profile.injuries ?? [],
      equipmentTags,
      trainingLocation: args.profile.trainingLocation ?? 'Commercial gym',
      onboardingData: args.profile,
    },
    seasonPhase: args.profile.seasonPhase,
    usualGameDay: args.profile.usualGameDay,
    gameDay: args.profile.gameDay,
    readiness: args.plan.readiness,
    sessionFeedback: {},
    weightOverrides: {},
    blockState: { blockStartDate: args.blockStart, blockNumber: 1 },
    availableDayNumbers: Array.from(selectedDays)
      .map((day) => DAY_NUMBERS[String(day)])
      .filter((day): day is number => day !== undefined),
    activeInjury: null,
    activeConstraints: [],
  };
}

/** Build the four-stage trace using only exported production return values. */
export function buildStrengthScenarioTrace(
  scenario: StrengthGoldenScenario,
): StrengthScenarioTrace {
  const startedAt = performance.now();
  if (scenario.timezone !== 'Australia/Melbourne') {
    throw new Error(`Unsupported strength-golden timezone: ${scenario.timezone}`);
  }
  const profile = scenario.profile as OnboardingData;
  const date = new Date(`${scenario.referenceDate}T12:00:00`);
  const { blockStart, blockEnd } = computeBlockBounds(date);
  const states = buildBlockWeekStates({
    blockStartISO: blockStart,
    blockNumber: 1,
    seasonPhase: profile.seasonPhase,
  });
  const inputs = onboardingToCoachingInputs(profile, {
    availabilityDateISO: scenario.referenceDate,
  });
  const equipment = resolveEquipmentAvailability(profile, [], scenario.referenceDate);
  const plans: CoachingPlan[] = [];
  const microcycles: Microcycle[] = [];
  const allocation: ObservedStrengthSession[] = [];
  const generatedFallback: ObservedStrengthSession[] = [];

  for (const state of states) {
    const plan = buildCoachingPlan({
      ...inputs,
      miniCycleNumber: state.miniCycleNumber,
      weekInBlock: state.weekInBlock,
      weekNumber: state.weekNumber,
      weekKind: state.weekKind,
    });
    mutateAllocationFocus(scenario, plan);
    plans.push(plan);
    const microcycleId = `bible:${scenario.id}:w${state.weekNumber}`;
    const workouts = buildWorkoutsFromCoach(
      [],
      microcycleId,
      plan.weeklyPlan,
      profile,
      {
        miniCycleNumber: state.miniCycleNumber,
        weekInBlock: state.weekInBlock,
        weekStartISO: state.weekStart,
        weekKind: state.weekKind,
        intensityMultiplier: state.intensityMultiplier,
      },
      { availableEquipment: equipment },
    );
    mutateWorkoutName(scenario, workouts);
    const focusByPlanEntryId = new Map(
      plan.weeklyPlan.map((session) => [session.planEntryId ?? '', session.focus]),
    );
    allocation.push(...plan.weeklyPlan.map((session) => allocationSnapshot(session, state)));
    generatedFallback.push(...workouts.map((workout) => workoutSnapshot({
      stage: 'generated_fallback',
      workout,
      state,
      focusByPlanEntryId,
    })));
    microcycles.push({
      id: microcycleId,
      programId: `bible:${scenario.id}`,
      weekNumber: state.weekNumber,
      startDate: `${state.weekStart}T12:00:00`,
      endDate: `${state.weekEnd}T12:00:00`,
      miniCycleNumber: state.miniCycleNumber,
      weekKind: state.weekKind,
      intensityMultiplier: state.intensityMultiplier,
      workouts,
      createdAt: `${scenario.referenceDate}T00:00:00`,
      updatedAt: `${scenario.referenceDate}T00:00:00`,
    });
  }

  const program: TrainingProgram = {
    id: `bible:${scenario.id}`,
    userId: 'bible-harness',
    name: scenario.description,
    description: scenario.description,
    programPhase: 'In-Season',
    startDate: `${blockStart}T12:00:00`,
    endDate: `${blockEnd}T12:00:00`,
    microcycles,
    primaryFocus: 'Bible strength conformance',
    isActive: true,
    createdAt: `${scenario.referenceDate}T00:00:00`,
    updatedAt: `${scenario.referenceDate}T00:00:00`,
  };
  const visibleWeek: ObservedStrengthSession[] = [];
  const visibleDetail: ObservedStrengthSession[] = [];

  states.forEach((state, index) => {
    const plan = plans[index];
    const microcycle = microcycles[index];
    const stateInput = scheduleState({
      profile,
      program,
      microcycle,
      plan,
      blockStart,
      referenceDate: scenario.referenceDate,
    });
    const focusByPlanEntryId = new Map(
      plan.weeklyPlan.map((session) => [session.planEntryId ?? '', session.focus]),
    );
    const projectedWeek = buildProgramTabProjectedWeek({
      mondayISO: state.weekStart,
      todayISO: scenario.referenceDate,
      state: stateInput,
      overrideContexts: {},
      modalityPreferences: {},
    });
    for (const day of projectedWeek) {
      if (!day.workout?.planEntryId) continue;
      visibleWeek.push(workoutSnapshot({
        stage: 'visible_week',
        workout: day.workout,
        state,
        date: day.date,
        focusByPlanEntryId,
        includeVisibleItems: true,
      }));
      const detailDay = buildDayWorkoutProjectedDay({
        date: day.date,
        todayISO: scenario.referenceDate,
        state: stateInput,
        overrideContext: undefined,
        modalityPreferences: {},
      });
      if (!detailDay.workout?.planEntryId) continue;
      visibleDetail.push(workoutSnapshot({
        stage: 'visible_detail',
        workout: detailDay.workout,
        state,
        date: detailDay.date,
        focusByPlanEntryId,
        includeVisibleItems: true,
      }));
    }
  });

  return {
    scenario,
    sessions: {
      allocation,
      generated_fallback: generatedFallback,
      visible_week: visibleWeek,
      visible_detail: visibleDetail,
    },
    runtimeMs: performance.now() - startedAt,
  };
}
