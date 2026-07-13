(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { OnboardingData, Workout } from '../types/domain';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
} from '../utils/coachingEngine';
import {
  buildGeneratedMicrocycles,
  buildGenerationPrompt,
} from '../services/api/generateProgram';
import {
  buildTemporaryEquipmentConstraint,
  resolveEquipmentCapabilities,
} from '../utils/equipmentAvailability';
import { buildBlockWeekStates, computeBlockBounds } from '../utils/programBlockState';
import { getSessionComponentRows, getSessionComponents } from '../utils/sessionComponents';
import { extractVisibleProgramItemsFromWorkout } from '../utils/visibleProgramReadModel';
import { buildDeterministicCoachNoteDescriptors } from '../utils/deterministicCoachNoteFactory';
import { classifyGeneratedWorkoutRow } from '../rules/generatedWorkoutRowClassification';

const REFERENCE_DATE = '2026-07-13';
const DAY_NUMBER: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
  }
}

const LEGACY_EQUIPMENT = [
  'barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine',
  'hamstring_curl', 'knee_extension', 'bands',
];

function profile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return {
    firstName: 'EquipmentAudit', position: 'inside_mid', motivation: 'Build strength and fitness',
    goals: ['Build Strength', 'Improve Fitness'], seasonPhase: 'Off-season',
    trainingDaysPerWeek: 6,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    teamTrainingDaysPerWeek: 0, teamTrainingDays: [], sessionDurationMinutes: 60,
    trainingLocation: 'Commercial gym', equipment: LEGACY_EQUIPMENT,
    experienceLevel: '5+ years', squatStrength: '1.5x bodyweight',
    benchStrength: '1.5x bodyweight+', conditioningLevel: 'Good',
    sprintExposure: 'Occasionally', recentTrainingLoad: 'Very consistent', injuries: [],
    ...overrides,
  } as OnboardingData;
}

function allocation(profileData: OnboardingData): {
  inputs: ReturnType<typeof onboardingToCoachingInputs>;
  plan: CoachingPlan;
  blockStart: string;
} {
  const { blockStart } = computeBlockBounds(new Date(`${REFERENCE_DATE}T12:00:00`));
  const inputs = onboardingToCoachingInputs(profileData, { availabilityDateISO: REFERENCE_DATE });
  const state = buildBlockWeekStates({ blockStartISO: blockStart, blockNumber: 1, seasonPhase: 'Off-season' })[0];
  const plan = buildCoachingPlan({
    ...inputs, miniCycleNumber: state.miniCycleNumber, weekInBlock: state.weekInBlock,
    weekNumber: state.weekNumber, weekKind: state.weekKind,
  });
  return { inputs, plan, blockStart };
}

function edgeWeek(plan: CoachingPlan): any[] {
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

function generate(profileData: OnboardingData, constraints: any[] = []) {
  const { inputs, plan, blockStart } = allocation(profileData);
  const equipment = resolveEquipmentCapabilities(profileData, constraints, REFERENCE_DATE);
  const microcycles = buildGeneratedMicrocycles({
    coachWorkouts: edgeWeek(plan), plan, coachingInputs: inputs, profile: profileData,
    programId: 'conditioning-equipment-consistency', microcyclePrefix: 'conditioning-equipment',
    blockStartISO: blockStart, blockNumber: 1, athletePrefs: {},
    availableEquipmentTags: equipment.tags,
    availableConditioningModalities: equipment.conditioningModalities,
  });
  return { plan, equipment, microcycles };
}

function strengthConditioning(workouts: readonly Workout[]): Workout[] {
  return workouts.filter((workout) => [1, 3, 5].includes(workout.dayOfWeek));
}

function hasConditioning(workout: Workout): boolean {
  return !!workout.conditioningBlock &&
    getSessionComponentRows(workout).conditioningRows.length > 0;
}

console.log('conditioningEquipmentConsistencyTests');

console.log('\n[1] legacy and modern Commercial-gym profiles converge');
{
  const legacy = generate(profile());
  const modern = generate(profile({ equipment: ['Full Gym'], equipmentSelectionCompleteness: 'complete' }));
  for (const [label, result] of [['legacy', legacy], ['modern', modern]] as const) {
    ok(`${label} resolves normal commercial cardio capability`,
      ['bike', 'row', 'ski'].every((modality) => result.equipment.conditioningModalities.includes(modality as any)),
      result.equipment);
    ok(`${label} Week 1 retains three attached conditioning components`,
      strengthConditioning(result.microcycles[0].workouts).every(hasConditioning));
    ok(`${label} Week 2 retains three attached conditioning components`,
      strengthConditioning(result.microcycles[1].workouts).every(hasConditioning));
  }
}

console.log('\n[2] explicit no-cardio and temporary no-cardio are authoritative');
{
  const explicit = generate(profile({
    equipment: ['Dumbbells Only'], equipmentSelectionCompleteness: 'complete',
  }));
  ok('explicit complete no-cardio has no conditioning capability',
    explicit.equipment.conditioningModalities.length === 0);
  ok('edge Bike rows cannot restore removed Week 1 conditioning',
    strengthConditioning(explicit.microcycles[0].workouts).every((workout) => !hasConditioning(workout)));
  ok('fallback also removes infeasible Week 2 conditioning',
    strengthConditioning(explicit.microcycles[1].workouts).every((workout) => !hasConditioning(workout)));
  ok('no-cardio Coach Note is suppressed when conditioning is absent',
    buildDeterministicCoachNoteDescriptors(explicit.microcycles[1].workouts.map((workout) => ({
      date: `2026-07-${String(19 + workout.dayOfWeek).padStart(2, '0')}`,
      workout,
    }))).every((note) => note.title !== 'Early off-season focus'));

  const temporary = buildTemporaryEquipmentConstraint({
    presetId: 'no_erg_cardio', date: REFERENCE_DATE,
    todayISO: `${REFERENCE_DATE}T09:00:00.000Z`,
  });
  const constrained = generate(profile(), [temporary]);
  ok('temporary missing cardio overrides legacy Commercial-gym baseline',
    constrained.equipment.conditioningModalities.length === 0);
  const cleared = generate(profile(), []);
  ok('clearing temporary missing cardio restores current planning capability',
    strengthConditioning(cleared.microcycles[1].workouts).every(hasConditioning));
}

console.log('\n[3] one available off-feet modality replaces deterministically');
{
  const rowOnly = generate(profile({
    equipment: ['RowErg'], equipmentSelectionCompleteness: 'complete',
  }));
  const allConditioningRows = rowOnly.microcycles.slice(0, 2).flatMap((microcycle) =>
    microcycle.workouts.flatMap((workout) => getSessionComponentRows(workout).conditioningRows)
      .filter((row, index) => classifyGeneratedWorkoutRow({
        name: row.exercise?.name ?? '',
        sets: row.prescribedSets,
        repsMax: row.prescribedRepsMax,
        index,
      }).kind === 'conditioning'));
  const names = allConditioningRows.map((row) => row.exercise?.name ?? '');
  ok('RowErg-only profile retains feasible conditioning', names.length > 0, names);
  ok('RowErg-only profile never invents Bike, SkiErg or running',
    names.every((name) => /row/i.test(name) && !/bike|ski|run|jog/i.test(name)), names);
}

console.log('\n[4] fixed four-week block uses one feasibility owner and honest projections');
{
  const result = generate(profile());
  ok('exact regression builds four microcycles', result.microcycles.length === 4);
  ok('Weeks 1 and 2 share early policy and conditioning presence',
    result.microcycles.slice(0, 2).every((microcycle) =>
      strengthConditioning(microcycle.workouts).every(hasConditioning)));
  ok('all subphases persist feasibility diagnostics on planned conditioning',
    result.microcycles.every((microcycle) => microcycle.workouts.every((workout) =>
      !workout.conditioningCategory || !!workout.conditioningFeasibility)));
  const early = result.microcycles.slice(0, 2).flatMap((microcycle) =>
    strengthConditioning(microcycle.workouts));
  ok('weekly-card items and detail rows both expose conditioning once', early.every((workout) => {
    const weekly = extractVisibleProgramItemsFromWorkout(workout)
      .filter((item) => item.domain === 'conditioning');
    const detail = getSessionComponentRows(workout).conditioningRows;
    const componentKinds = getSessionComponents(workout).map((component) => component.kind);
    return weekly.length === 1 && detail.length > 0 &&
      componentKinds.filter((kind) => kind === 'conditioning').length === 1;
  }));
  const week2Notes = buildDeterministicCoachNoteDescriptors(
    result.microcycles[1].workouts.map((workout) => ({
      date: `2026-07-${String(19 + workout.dayOfWeek).padStart(2, '0')}`,
      workout,
    })),
  );
  ok('early-offseason Coach Note appears only with final visible off-feet conditioning',
    week2Notes.some((note) => note.title === 'Early off-season focus'));

  const prompt = buildGenerationPrompt(
    profile(), result.plan, result.equipment.tags, result.equipment.conditioningModalities,
  );
  ok('edge prompt carries the same canonical modality capability ledger',
    prompt.includes('Canonical conditioning modalities: bike, row, ski, treadmill'));
}

console.log(`\nConditioning equipment consistency: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`);
  process.exit(1);
}
