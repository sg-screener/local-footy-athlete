(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { performance } from 'node:perf_hooks';
import type { OnboardingData, Workout } from '../../../types/domain';
import { buildGeneratedMicrocycles } from '../../../services/api/generateProgram';
import { buildCoachingPlan, onboardingToCoachingInputs } from '../../../utils/coachingEngine';
import { buildBlockWeekStates, computeBlockBounds } from '../../../utils/programBlockState';
import { resolveEquipmentCapabilities } from '../../../utils/equipmentAvailability';
import { buildDeterministicCoachNoteDescriptors } from '../../../utils/deterministicCoachNoteFactory';
import { getSessionComponentRows, getSessionComponents } from '../../../utils/sessionComponents';
import { extractVisibleProgramItemsFromWorkout } from '../../../utils/visibleProgramReadModel';
import type {
  HarnessConditioningEntry,
  HarnessExposureLedger,
  HarnessSessionComponent,
  Slice3GoldenScenario,
  Slice3ScenarioTrace,
  Slice3StageObservation,
  Slice3TraceStage,
} from '../types';

const LEGACY_EQUIPMENT = [
  'barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine',
  'hamstring_curl', 'knee_extension', 'bands',
];
const DAY_NUMBER: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};
const EMPTY_ACCOUNTING: HarnessExposureLedger = {
  squatStrength: 0, hingeStrength: 0, upperPushStrength: 0, upperPullStrength: 0,
  conditioning: 0, hardConditioning: 0, sprintCod: 0, power: 0,
  upperStrengthFatigue: 0, lowerStrengthFatigue: 0,
  teamTrainingAnchors: 0, gameAnchors: 0, recovery: 0,
  hardDays: 0, mainStrength: 0, running: 0,
};

function profileFor(scenario: Slice3GoldenScenario): OnboardingData {
  const equipment = scenario.id === 'early-offseason-modern-full-gym' ? ['Full Gym']
    : scenario.id === 'early-offseason-explicit-no-cardio' ? ['Dumbbells Only']
      : scenario.id === 'early-offseason-row-only' ? ['RowErg'] : LEGACY_EQUIPMENT;
  return {
    firstName: 'BibleEquipment', position: 'inside_mid', motivation: 'Build strength and fitness',
    goals: ['Build Strength', 'Improve Fitness'], seasonPhase: 'Off-season',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], sessionDurationMinutes: 60,
    trainingLocation: 'Commercial gym', equipment,
    ...(scenario.id !== 'early-offseason-legacy-commercial'
      ? { equipmentSelectionCompleteness: 'complete' as const }
      : {}),
    experienceLevel: '5+ years', squatStrength: '1.5x bodyweight',
    benchStrength: '1.5x bodyweight+', conditioningLevel: 'Good',
    sprintExposure: 'Occasionally', recentTrainingLoad: 'Very consistent', injuries: [],
  } as OnboardingData;
}

function edgeWeek(plan: ReturnType<typeof buildCoachingPlan>): any[] {
  const byDay = new Map(plan.weeklyPlan.map((entry) => [entry.dayOfWeek, entry]));
  const row = (day: 'Monday' | 'Wednesday' | 'Friday', name: string, strength: string) => ({
    dayOfWeek: DAY_NUMBER[day], planEntryId: byDay.get(day)?.planEntryId,
    name, workoutType: 'Mixed', sessionTier: 'optional',
    exercises: [
      { name: strength, sets: 3, repsMin: 8, repsMax: 10 },
      { name: 'Bike Steady Zone 2', sets: 1, repsMin: 1, repsMax: 1 },
    ],
  });
  return [
    row('Monday', 'Full Body Strength + Aerobic Base', 'Romanian Deadlift'),
    row('Wednesday', 'Upper Push + Aerobic Base', 'Overhead Press'),
    row('Friday', 'Lower Squat + Aerobic Base', 'Back Squat'),
  ];
}

function conditioningEntry(workout: Workout): HarnessConditioningEntry[] {
  if (!workout.conditioningBlock) return [];
  return workout.conditioningBlock.options.map((option) => {
    const text = `${option.title} ${option.description}`;
    const typed = (option as typeof option & { modality?: string }).modality;
    const modality: HarnessConditioningEntry['modality'] = typed === 'bike' || /bike/i.test(text) ? 'bike'
      : typed === 'row' || /row/i.test(text) ? 'row'
        : typed === 'ski' || /ski/i.test(text) ? 'ski'
          : typed === 'running' || /run|jog/i.test(text) ? 'running'
            : /mixed/i.test(text) ? 'mixed_off_feet' : 'other';
    return {
      modality,
      intent: workout.conditioningCategory === 'aerobic_base' ? 'aerobic_base'
        : workout.conditioningCategory === 'tempo' ? 'tempo' : 'intervals',
      intensity: workout.conditioningCategory === 'aerobic_base' ? 'easy'
        : workout.conditioningCategory === 'tempo' ? 'moderate' : 'hard',
      offFeet: ['bike', 'row', 'ski', 'mixed_off_feet'].includes(modality),
    };
  });
}

function stage(args: {
  name: Slice3TraceStage;
  workouts: Workout[];
  date: string;
  allowedModalities: string[];
  view?: 'weekly' | 'detail';
  noteVisible?: boolean;
}): Slice3StageObservation {
  const selected = args.workouts.filter((workout) => [1, 3, 5].includes(workout.dayOfWeek));
  const conditioning = selected.flatMap(conditioningEntry);
  const conditioningVisible = args.view === 'weekly'
    ? selected.flatMap((workout) => extractVisibleProgramItemsFromWorkout(workout))
      .filter((item) => item.domain === 'conditioning').length
    : args.view === 'detail'
      ? selected.flatMap((workout) => getSessionComponentRows(workout).conditioningRows)
        .length
      : conditioning.length;
  const statuses = selected.flatMap((workout) => workout.conditioningFeasibility?.status
    ? [workout.conditioningFeasibility.status] : []);
  const reasons = selected.flatMap((workout) => workout.conditioningFeasibility?.reason
    ? [workout.conditioningFeasibility.reason] : []);
  const hasConditioning = args.view ? conditioningVisible > 0 : conditioning.length > 0;
  const components = new Set<HarnessSessionComponent>();
  for (const workout of selected) {
    for (const component of getSessionComponents(workout)) {
      if (component.kind === 'strength') components.add('strength');
      if (component.kind === 'conditioning') components.add('conditioning');
      if (component.kind === 'recovery') components.add('recovery');
    }
  }
  if (args.view && !hasConditioning) components.delete('conditioning');
  const noteVisible = args.noteVisible ?? false;
  return {
    stage: args.name,
    planEntryId: 'early-offseason-conditioning-ledger',
    day: 'Monday/Wednesday/Friday', date: args.date,
    workoutName: 'Early off-season cross-week conditioning ledger', workoutType: 'Mixed',
    intensity: 'Low', components: Array.from(components).sort() as HarnessSessionComponent[],
    plannedPatterns: [], effectivePatterns: [],
    exerciseNames: selected.flatMap((workout) => workout.exercises.map((row) => row.exercise?.name ?? '')),
    conditioning: args.view && !hasConditioning ? [] : conditioning,
    power: { kind: 'none' }, visibleTitle: 'Early off-season conditioning',
    visibleSubtitle: hasConditioning ? 'Strength + Aerobic Base' : 'Strength', evidence: [],
    accounting: args.name === 'weekly_accounting' ? { ...EMPTY_ACCOUNTING } : undefined,
    conditioningFeasibility: {
      owner: 'conditioningFeasibility', decisions: statuses.length, statuses, reasons,
      allowedModalities: args.allowedModalities, noteVisible,
      noteTruthful: !noteVisible || (hasConditioning && conditioning.every((entry) => entry.offFeet && entry.intensity === 'easy')),
    },
  };
}

export function isConditioningEquipmentScenario(scenario: Slice3GoldenScenario): boolean {
  return scenario.id.startsWith('early-offseason-') && scenario.id !== 'early-offseason-healthy';
}

export function buildConditioningEquipmentTrace(scenario: Slice3GoldenScenario): Slice3ScenarioTrace {
  const startedAt = performance.now();
  const profile = profileFor(scenario);
  const { blockStart } = computeBlockBounds(new Date(`${scenario.referenceDate}T12:00:00`));
  const inputs = onboardingToCoachingInputs(profile, { availabilityDateISO: scenario.referenceDate });
  const state = buildBlockWeekStates({ blockStartISO: blockStart, blockNumber: 1, seasonPhase: 'Off-season' })[0];
  const plan = buildCoachingPlan({
    ...inputs, miniCycleNumber: state.miniCycleNumber, weekInBlock: state.weekInBlock,
    weekNumber: state.weekNumber, weekKind: state.weekKind,
  });
  const equipment = resolveEquipmentCapabilities(profile, [], scenario.referenceDate);
  const microcycles = buildGeneratedMicrocycles({
    coachWorkouts: edgeWeek(plan), plan, coachingInputs: inputs, profile,
    programId: `bible-${scenario.id}`, microcyclePrefix: `bible-${scenario.id}`,
    blockStartISO: blockStart, blockNumber: 1, athletePrefs: {},
    availableEquipmentTags: equipment.tags,
    availableConditioningModalities: equipment.conditioningModalities,
  });
  const week1 = microcycles[0].workouts;
  const week2 = microcycles[1].workouts;
  const noteVisible = buildDeterministicCoachNoteDescriptors(week2.map((workout) => ({
    date: `2026-07-${String(19 + workout.dayOfWeek).padStart(2, '0')}`, workout,
  }))).some((note) => note.title === 'Early off-season focus');
  const allowed = equipment.conditioningModalities;
  return {
    scenario,
    stages: {
      allocation: stage({ name: 'allocation', workouts: week1, date: scenario.referenceDate, allowedModalities: allowed }),
      generated_fallback: stage({ name: 'generated_fallback', workouts: week1, date: scenario.referenceDate, allowedModalities: allowed }),
      resolved_effective: stage({ name: 'resolved_effective', workouts: week2, date: '2026-07-20', allowedModalities: allowed, noteVisible }),
      visible_week: stage({ name: 'visible_week', workouts: week2, date: '2026-07-20', allowedModalities: allowed, view: 'weekly', noteVisible }),
      visible_detail: stage({ name: 'visible_detail', workouts: week2, date: '2026-07-20', allowedModalities: allowed, view: 'detail', noteVisible }),
      weekly_accounting: stage({ name: 'weekly_accounting', workouts: microcycles[3].workouts, date: '2026-08-03', allowedModalities: allowed }),
    },
    runtimeMs: performance.now() - startedAt,
  };
}
