(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

import type {
  DayOfWeek,
  OnboardingData,
  RecoveryAddonBlock,
  SeasonPhase,
  WeekKind,
  Workout,
  WorkoutExercise,
} from '../types/domain';
import type { GenerationConstraintContext } from '../utils/generationConstraints';
import { attachRecoveryAddonsToWeek } from '../utils/recoveryAddonBuilder';
import { generateProgramLocally } from '../services/api/generateProgram';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';
import { getSessionComponents } from '../utils/sessionComponents';
import { classifyBibleInjurySeverity } from '../rules/injurySeverityBands';

const TODAY = '2026-07-06';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  fail ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T): void {
  ok(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function section(label: string): void {
  console.log(`\n${label}`);
}

function profile(
  phase: SeasonPhase,
  preferredTrainingDays: readonly DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
): OnboardingData {
  return {
    seasonPhase: phase,
    trainingDaysPerWeek: preferredTrainingDays.length,
    preferredTrainingDays: [...preferredTrainingDays],
    teamTrainingDaysPerWeek: phase === 'Off-season' ? 0 : 2,
    teamTrainingDays: phase === 'Off-season' ? [] : ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Moderate',
    sessionDurationMinutes: 60,
    trainingLocation: 'Commercial gym',
    equipment: ['Barbell', 'Dumbbells', 'Bench', 'Cable machine'],
    experienceLevel: '2-5 years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
    motivation: 'Strength, speed, repeat efforts',
    weightKg: 86,
    usualGameDay: phase === 'In-season' ? 'Saturday' : undefined,
  } as OnboardingData;
}

function row(workoutId: string, name: string, order = 1): WorkoutExercise {
  const now = `${TODAY}T12:00:00.000Z`;
  return {
    id: `${workoutId}-ex-${order}`,
    workoutId,
    exerciseId: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${order}`,
    exerciseOrder: order,
    prescribedSets: 3,
    prescribedRepsMin: 5,
    prescribedRepsMax: 8,
    restSeconds: 120,
    exercise: {
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${order}`,
      name,
      description: name,
      muscleGroups: [],
      exerciseType: 'Compound',
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: now,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function workout(dayOfWeek: number, name: string, workoutType: Workout['workoutType'], exerciseNames: string[], opts: Partial<Workout> = {}): Workout {
  const now = `${TODAY}T12:00:00.000Z`;
  const id = `w-${dayOfWeek}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return {
    id,
    microcycleId: 'mc-test',
    dayOfWeek,
    name,
    description: name,
    durationMinutes: opts.durationMinutes ?? 60,
    intensity: opts.intensity ?? 'Moderate',
    workoutType,
    sessionTier: opts.sessionTier ?? (workoutType === 'Recovery' ? 'recovery' : 'core'),
    exercises: exerciseNames.map((exerciseName, index) => row(id, exerciseName, index + 1)),
    createdAt: now,
    updatedAt: now,
    ...opts,
  };
}

function baseWeek(): Workout[] {
  return [
    workout(1, 'Upper Body Strength', 'Strength', ['Bench Press', 'Barbell Row']),
    workout(2, 'Lower Body Strength', 'Strength', ['Back Squat', 'Romanian Deadlift']),
    workout(3, 'Recovery Mobility', 'Recovery', ['90/90 Breathing'], { intensity: 'Light' }),
    workout(4, 'Upper Pull Strength', 'Strength', ['Pull Up', 'Face Pull']),
    workout(5, 'Lower Controlled Strength', 'Strength', ['Split Squat', 'Hip Thrust']),
  ];
}

function preSeasonWeek(): Workout[] {
  return [
    workout(1, 'Upper Body Strength', 'Strength', ['Bench Press', 'Barbell Row']),
    workout(2, 'Team Training', 'Team Training', ['Team Training']),
    workout(3, 'Lower Body Strength', 'Strength', ['Back Squat', 'Hip Thrust']),
    workout(4, 'Team Training', 'Team Training', ['Team Training']),
    workout(5, 'Recovery Mobility', 'Recovery', ['90/90 Breathing'], { intensity: 'Light' }),
  ];
}

function inSeasonWeek(): Workout[] {
  return [
    workout(1, 'Upper Body Strength', 'Strength', ['Bench Press', 'Barbell Row']),
    workout(2, 'Team Training', 'Team Training', ['Team Training']),
    workout(3, 'Lower Controlled Strength', 'Strength', ['Hip Thrust', 'Split Squat']),
    workout(5, 'Game-1 Recovery', 'Recovery', ['90/90 Breathing'], { intensity: 'Light' }),
    workout(6, 'Game Day', 'Game', [], { intensity: 'High' }),
  ];
}

function attach(args: {
  workouts?: Workout[];
  phase?: SeasonPhase;
  weekKind?: WeekKind;
  constraints?: GenerationConstraintContext;
  preferredTrainingDays?: readonly DayOfWeek[];
} = {}): Workout[] {
  return attachRecoveryAddonsToWeek({
    workouts: args.workouts ?? baseWeek(),
    profile: profile(
      args.phase ?? 'Pre-season',
      args.preferredTrainingDays ?? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    ),
    weekKind: args.weekKind,
    generationConstraints: args.constraints,
  });
}

function allAddons(workouts: Workout[]): RecoveryAddonBlock[] {
  return workouts.flatMap((workout) => workout.recoveryAddons ?? []);
}

function focusAreas(workouts: Workout[]): string[] {
  return allAddons(workouts).map((addon) => addon.focusArea);
}

function addonText(workouts: Workout[]): string {
  return allAddons(workouts).map((addon) =>
    `${addon.focusArea} ${addon.label} ${addon.exercises.map((exercise) => `${exercise.name} ${exercise.prescription} ${exercise.notes ?? ''}`).join(' ')}`,
  ).join(' | ');
}

function countInput(workouts: Workout[]) {
  return workouts.map((workout, index) => ({
    date: `2026-07-${String(6 + index).padStart(2, '0')}`,
    workout,
  }));
}

function withoutAddons(workouts: Workout[]): Workout[] {
  return workouts.map((workout) => {
    const { recoveryAddons, ...rest } = workout;
    return rest as Workout;
  });
}

function injuryContext(bodyPart: string, severity: number, injuryKeys: any[] = []): GenerationConstraintContext {
  const severityBand = classifyBibleInjurySeverity(severity).band;
  return {
    activeConstraintIds: [`injury-${bodyPart}`],
    activeInjuryKeys: injuryKeys,
    injuries: [{
      id: `injury-${bodyPart}`,
      sourceType: 'injury',
      bodyPart,
      region: bodyPart === 'shoulder' ? 'upper_body' : bodyPart === 'lower back' ? 'back_midline' : 'lower_body',
      severity,
      severityBand,
      onboardingSeverity: severity >= 6 ? 'Severe' : severity >= 4 ? 'Moderate' : 'Mild',
      triggers: [bodyPart],
      reduceAffectedWork: severity >= 4,
      removeRiskyWork: severity >= 6,
      pauseAffectedTraining: severity >= 8,
      injuryKeys,
    }],
  };
}

function readinessContext(tier: NonNullable<GenerationConstraintContext['readiness']>['tier']): GenerationConstraintContext {
  return {
    activeConstraintIds: ['fatigue-low-readiness'],
    activeInjuryKeys: [],
    injuries: [],
    readiness: {
      id: 'fatigue-low-readiness',
      sourceType: 'fatigue',
      severity: 7,
      tier,
      label: 'Cooked',
      avoidSprint: true,
      avoidHardConditioning: true,
      reduceHardExtras: true,
      preferRecovery: tier === 'major_reduction' || tier === 'full_pause',
      fullPause: tier === 'full_pause',
    },
  };
}

section('[1] off-season attaches broader support without exposure changes');
{
  const before = baseWeek();
  const after = attach({ workouts: before, phase: 'Off-season' });
  const addons = allAddons(after);
  ok('off-season attaches 2-4 add-ons', addons.length >= 2 && addons.length <= 4, addonText(after));
  ok('off-season includes trunk support', focusAreas(after).includes('trunk_core'), addonText(after));
  ok('off-season includes adductor or calf support',
    focusAreas(after).some((focus) => focus === 'adductors_groin' || focus === 'calves_tib_ankles'),
    addonText(after));
  const beforeCounts = countWeeklyExposures(countInput(before));
  const afterCounts = countWeeklyExposures(countInput(after));
  eq('hard exposure count unchanged', afterCounts.hardExposures, beforeCounts.hardExposures);
  eq('main strength count unchanged', afterCounts.mainStrengthExposures, beforeCounts.mainStrengthExposures);
  eq('conditioning count unchanged', afterCounts.conditioningExposures, beforeCounts.conditioningExposures);
  eq('sprint/COD count unchanged', afterCounts.sprintCodExposures, beforeCounts.sprintCodExposures);
}

section('[2] pre-season attaches moderate support without team-training interference');
{
  const after = attach({ workouts: preSeasonWeek(), phase: 'Pre-season' });
  const addons = allAddons(after);
  ok('pre-season attaches 2-3 add-ons', addons.length >= 2 && addons.length <= 3, addonText(after));
  ok('pre-season avoids attaching to team training when other days exist',
    after.every((workout) => workout.workoutType !== 'Team Training' || !workout.recoveryAddons?.length),
    JSON.stringify(after.map((workout) => [workout.name, workout.recoveryAddons?.map((addon) => addon.focusArea)])));
}

section('[3] in-season attaches minimum effective support');
{
  const after = attach({ workouts: inSeasonWeek(), phase: 'In-season' });
  const addons = allAddons(after);
  ok('in-season attaches 1-3 add-ons', addons.length >= 1 && addons.length <= 3, addonText(after));
  ok('in-season never attaches to game day',
    after.every((workout) => workout.workoutType !== 'Game' || !workout.recoveryAddons?.length),
    addonText(after));
  ok('in-season avoids carries in the shown game week',
    !focusAreas(after).includes('carries'),
    addonText(after));
}

section('[4] G-1 only allows very light mobility/reset/prehab');
{
  const after = attach({
    workouts: [
      workout(5, 'Game-1 Light Session', 'Strength', ['Bench Press', 'Band Pull Apart'], { intensity: 'Light' }),
      workout(6, 'Game Day', 'Game', [], { intensity: 'High' }),
    ],
    phase: 'In-season',
  });
  const gMinusOneAddons = after.find((item) => item.dayOfWeek === 5)?.recoveryAddons ?? [];
  ok('G-1 gets an optional very light add-on', gMinusOneAddons.length > 0, addonText(after));
  ok('G-1 add-ons are mobility/reset only in this placement',
    gMinusOneAddons.every((addon) => addon.focusArea === 'mobility_reset' && addon.kind === 'mobility'),
    addonText(after));
  ok('G-1 has no carry, hard trunk circuit, sprint or conditioning wording',
    !/carry|Nordic|sprint|conditioning/i.test(addonText(after)),
    addonText(after));
}

section('[5] deload biases mobility/reset/light trunk');
{
  const after = attach({ workouts: baseWeek(), phase: 'Pre-season', weekKind: 'deload' });
  const focuses = focusAreas(after);
  ok('deload attaches 1-2 add-ons', focuses.length >= 1 && focuses.length <= 2, addonText(after));
  ok('deload keeps only mobility/trunk in selected add-ons',
    focuses.every((focus) => focus === 'mobility_reset' || focus === 'trunk_core'),
    addonText(after));
}

section('[6] low availability returns minimum viable coverage');
{
  const after = attach({
    workouts: [
      workout(1, 'Upper Body Strength', 'Strength', ['Bench Press', 'Barbell Row']),
      workout(3, 'Lower Body Strength', 'Strength', ['Back Squat', 'Hip Thrust']),
    ],
    phase: 'Off-season',
    preferredTrainingDays: ['Monday', 'Wednesday'],
  });
  const focuses = focusAreas(after);
  ok('low availability does not bloat the week', focuses.length <= 2, addonText(after));
  ok('low availability sticks to minimum viable focus areas',
    focuses.every((focus) => ['trunk_core', 'mobility_reset', 'adductors_groin'].includes(focus)),
    addonText(after));
}

section('[7] injury/readiness constraints downgrade add-ons');
{
  const groin = attach({
    workouts: baseWeek(),
    phase: 'Pre-season',
    constraints: injuryContext('groin', 5, ['adductor']),
  });
  ok('groin issue avoids hard Copenhagen/adductor loading',
    !/Copenhagen/i.test(addonText(groin)),
    addonText(groin));
  ok('groin issue keeps adductor work gentle if selected',
    !focusAreas(groin).includes('adductors_groin') || /Groin Squeeze/i.test(addonText(groin)),
    addonText(groin));

  const hamstring = attach({
    workouts: baseWeek(),
    phase: 'Off-season',
    constraints: injuryContext('hamstring', 6, ['hamstring']),
  });
  ok('hamstring issue blocks Nordics/heavy hamstring support',
    !/Nordic/i.test(addonText(hamstring)) && !focusAreas(hamstring).includes('hamstring_light_prehab'),
    addonText(hamstring));

  const back = attach({
    workouts: baseWeek(),
    phase: 'Off-season',
    constraints: injuryContext('lower back', 5, ['lowerBack']),
  });
  ok('lower-back issue avoids heavy carries',
    !/Farmer Carry|Bear Carry|Bottoms-Up KB Carry/i.test(addonText(back)) && !focusAreas(back).includes('carries'),
    addonText(back));

  const cooked = attach({
    workouts: baseWeek(),
    phase: 'Pre-season',
    constraints: readinessContext('major_reduction'),
  });
  ok('major readiness trims optional support to recovery/trunk',
    focusAreas(cooked).every((focus) => ['mobility_reset', 'trunk_core'].includes(focus)),
    addonText(cooked));
}

section('[8] recovery_addons keep zero-credit fences and optional logging');
{
  const after = attach({ workouts: baseWeek(), phase: 'Off-season' });
  const addons = allAddons(after);
  ok('every add-on is optional no-penalty',
    addons.every((addon) => addon.optional === true && addon.skipPolicy === 'no_penalty'),
    addonText(after));
  ok('every add-on has zero-credit metadata',
    addons.every((addon) =>
      addon.counting.hardExposure === false &&
      addon.counting.mainStrength === false &&
      addon.counting.conditioningCredit === 'none' &&
      addon.counting.createsHardDay === false &&
      addon.counting.sprintCodExposure === false),
    addonText(after));

  const workoutWithAddon = after.find((item) => item.recoveryAddons?.length);
  const componentKinds = getSessionComponents(workoutWithAddon).map((component) => component.kind);
  const strippedComponentKinds = getSessionComponents(
    workoutWithAddon ? ({ ...workoutWithAddon, recoveryAddons: undefined } as Workout) : null,
  ).map((component) => component.kind);
  ok('recovery add-on becomes an optional feedback component only',
    componentKinds.includes('recovery_addon') &&
      !strippedComponentKinds.includes('recovery_addon'),
    `${componentKinds.join(',')} vs ${strippedComponentKinds.join(',')}`);

  const strippedCounts = countWeeklyExposures(countInput(withoutAddons(after)));
  const attachedCounts = countWeeklyExposures(countInput(after));
  eq('stripped and attached hard exposure counts match', attachedCounts.hardExposures, strippedCounts.hardExposures);
  eq('stripped and attached main strength counts match', attachedCounts.mainStrengthExposures, strippedCounts.mainStrengthExposures);
  eq('stripped and attached conditioning counts match', attachedCounts.conditioningExposures, strippedCounts.conditioningExposures);
  eq('stripped and attached sprint/COD counts match', attachedCounts.sprintCodExposures, strippedCounts.sprintCodExposures);
}

section('[9] healthy normal generation keeps real week structure');
{
  const program = generateProgramLocally(profile('Pre-season'), {
    todayISO: TODAY,
    blockNumber: 1,
    readinessSignal: null,
    activeConstraints: [],
  });
  const firstWeek = program.microcycles[0]?.workouts ?? [];
  ok('generated week still has workouts', firstWeek.length > 0);
  ok('generated week still has exercise rows',
    firstWeek.some((workout) => workout.exercises.length > 0),
    JSON.stringify(firstWeek.map((workout) => [workout.name, workout.exercises.length])));
  ok('generated week receives visible recovery add-ons',
    allAddons(firstWeek).length > 0,
    JSON.stringify(firstWeek.map((workout) => [workout.name, workout.recoveryAddons?.map((addon) => addon.focusArea)])));
  const strippedCounts = countWeeklyExposures(countInput(withoutAddons(firstWeek)));
  const attachedCounts = countWeeklyExposures(countInput(firstWeek));
  eq('generated hard exposure count does not change', attachedCounts.hardExposures, strippedCounts.hardExposures);
  eq('generated main strength count does not change', attachedCounts.mainStrengthExposures, strippedCounts.mainStrengthExposures);
  eq('generated conditioning count does not change', attachedCounts.conditioningExposures, strippedCounts.conditioningExposures);
}

if (fail > 0) {
  console.error(`\nrecoveryAddonAttachmentTests failed: ${fail}`);
  throw new Error(`recoveryAddonAttachmentTests failed: ${fail} (${failures.join(', ')})`);
}

console.log(`\nrecoveryAddonAttachmentTests: ${pass} passed`);
