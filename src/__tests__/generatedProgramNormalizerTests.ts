/**
 * Generated-program normaliser regression tests.
 *
 * Run: npm run test:generated-program-normalizer
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import type { DayOfWeek, OnboardingData, Workout } from '../types/domain';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type SessionAllocation,
} from '../utils/coachingEngine';
import {
  buildGeneratedMicrocycles,
  buildGenerationPrompt,
  buildInitialGeneratedCoachingPlan,
} from '../services/api/generateProgram';
import { classifyVisibleSession } from '../rules/sessionClassificationAdapter';
import { projectVisibleDay } from '../utils/visibleProgramProjection';
import { strengthPatternLedger } from '../rules/strengthPatternContributions';
import { classifyGeneratedWorkoutRow } from '../rules/generatedWorkoutRowClassification';
import { getSessionComponentRows, getSessionComponents } from '../utils/sessionComponents';
import { extractVisibleProgramItemsFromWorkout } from '../utils/visibleProgramReadModel';
import { FULL_GYM_EQUIPMENT } from '../utils/equipmentAvailability';
import { combinedConditioningCategoryLabel } from '../utils/weeklyPlanDisplay';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

function eq<T>(name: string, actual: T, expected: T): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function section(name: string): void {
  console.log(`\n${name}`);
}

const PROFILE: OnboardingData = {
  firstName: 'MixedSessionTester',
  ageRange: '25-34',
  position: 'inside_mid',
  motivation: 'Get stronger, run longer',
  goals: ['Build Strength', 'Improve Fitness'],
  experienceLevel: 'Intermediate' as any,
  squatStrength: '1.5x BW' as any,
  benchStrength: '1x BW' as any,
  conditioningLevel: 'Good',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 6,
  preferredTrainingDays: [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Monday', 'Wednesday'],
  teamTrainingIntensity: 'High',
  teamTrainingDuration: '90 min' as any,
  sessionDurationMinutes: 60 as any,
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
} as OnboardingData;

const DAY_NUMBER: Record<DayOfWeek, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function exercise(name: string) {
  return { name, sets: 3, repsMin: 5, repsMax: 8 };
}

function structuralShape(plan: readonly SessionAllocation[]) {
  return plan.map((session) => ({
    dayOfWeek: session.dayOfWeek,
    tier: session.tier,
    strengthPattern: session.strengthPattern ?? null,
    strengthPatternContributions: session.strengthPatternContributions ?? [],
    planEntryId: session.planEntryId ?? null,
    isTeamDay: session.isTeamDay ?? false,
    hasCombinedConditioning: session.hasCombinedConditioning ?? false,
    conditioningCategory: session.conditioningCategory ?? null,
  }));
}

function conditioningIds(workout: Workout): Set<string> {
  return new Set(
    (workout.conditioningBlock?.options ?? []).flatMap((option) => option.exerciseIds),
  );
}

function strengthNames(workout: Workout): string[] {
  const ids = conditioningIds(workout);
  return (workout.exercises ?? [])
    .filter((row) => !ids.has(row.id))
    .map((row) => row.exercise?.name ?? '')
    .filter(Boolean);
}

function visible(workout: Workout, date: string): Workout | null {
  return projectVisibleDay({
    day: {
      date,
      dayOfWeek: workout.dayOfWeek,
      short: 'DAY',
      isToday: false,
      workout,
      source: 'template',
      indicator: workout.sessionTier ?? null,
    } as any,
    activeInjury: null,
    todayISO: '2026-07-06',
    extraConstraints: [],
    modalityPreferences: {},
  }).day.workout;
}

const inputs = onboardingToCoachingInputs(PROFILE, {
  availabilityDateISO: '2026-07-06',
});

section('[1] Edge prompt and first client microcycle share one block-state plan');
{
  const promptPlan = buildInitialGeneratedCoachingPlan({
    coachingInputs: inputs,
    profile: PROFILE,
    todayISO: '2026-07-06',
    blockNumber: 1,
  });
  const firstMicrocyclePlan = buildCoachingPlan({
    ...inputs,
    miniCycleNumber: 1,
    weekInBlock: 1,
    weekNumber: 1,
    weekKind: 'build',
  });
  eq(
    'edge prompt structure equals the first normalised block week',
    structuralShape(promptPlan.weeklyPlan),
    structuralShape(firstMicrocyclePlan.weeklyPlan),
  );
}

section('[2] Edge-style mixed sessions retain strength plus typed conditioning');
const midPlan = buildCoachingPlan({
  ...inputs,
  miniCycleNumber: 2,
  weekInBlock: 2,
  weekNumber: 2,
  weekKind: 'build',
});
const edgeWorkouts = [
  {
    dayOfWeek: 1,
    name: 'Team Training + Upper Push',
    workoutType: 'Team Training',
    sessionTier: 'core',
    exercises: [exercise('Bench Press'), exercise('Overhead Press'), exercise('Dips')],
  },
  {
    dayOfWeek: 2,
    name: 'Lower Hinge + Easy Off-Feet Aerobic',
    // Deliberately wrong edge enum: deterministic component structure wins.
    workoutType: 'Conditioning',
    sessionTier: 'core',
    exercises: [
      exercise('Romanian Deadlift'),
      exercise('Hip Thrusts'),
      exercise('Nordic Lower'),
      exercise('Easy Zone 2 Bike'),
    ],
  },
  {
    dayOfWeek: 3,
    name: 'Team Training - Field Session',
    workoutType: 'Team Training',
    sessionTier: 'core',
    exercises: [],
  },
  {
    dayOfWeek: 4,
    name: 'Full Body Recovery',
    workoutType: 'Recovery',
    sessionTier: 'recovery',
    exercises: [exercise('Mobility Flow')],
  },
  {
    dayOfWeek: 5,
    name: 'Upper Pull',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [exercise('Pull-Ups'), exercise('Barbell Row'), exercise('Face Pulls')],
  },
  {
    dayOfWeek: 6,
    name: 'Lower Squat + Easy Off-Feet Aerobic',
    workoutType: 'Mixed',
    sessionTier: 'core',
    exercises: [
      exercise('Back Squat'),
      exercise('Bulgarian Split Squats'),
      exercise('Leg Extension'),
      exercise('Easy Zone 2 Bike'),
    ],
  },
];
const built = buildWorkoutsFromCoach(
  edgeWorkouts,
  'mc-generated-mixed',
  midPlan.weeklyPlan,
  PROFILE,
  {
    miniCycleNumber: 2,
    weekInBlock: 2,
    weekStartISO: '2026-07-13',
    weekKind: 'build',
  },
);
const workoutOn = (day: DayOfWeek) => built.find((workout) => workout.dayOfWeek === DAY_NUMBER[day])!;
const tuesday = workoutOn('Tuesday');
const friday = workoutOn('Friday');
const saturday = workoutOn('Saturday');

ok('Lower Hinge retains meaningful lower strength rows', strengthNames(tuesday).length >= 3, strengthNames(tuesday));
ok('Lower Hinge retains a separate conditioning block', !!tuesday.conditioningBlock?.options.length);
eq('Lower Hinge is structurally Mixed despite wrong edge enum', tuesday.workoutType, 'Mixed' as any);
ok('Lower Squat retains meaningful lower strength rows', strengthNames(saturday).length >= 3, strengthNames(saturday));
ok('Lower Squat retains a separate conditioning block', !!saturday.conditioningBlock?.options.length);
eq('Lower Squat remains structurally Mixed', saturday.workoutType, 'Mixed' as any);
ok('Upper Pull remains visible strength', classifyVisibleSession(friday).contributions.mainStrength === 1, friday);
ok('Team Training + Upper Push preserves the anchor', classifyVisibleSession(workoutOn('Monday')).anchors.teamTraining);
ok('Team Training + Upper Push preserves upper strength', classifyVisibleSession(workoutOn('Monday')).contributions.mainStrength === 1);

const visibleTuesday = visible(tuesday, '2026-07-14');
const visibleSaturday = visible(saturday, '2026-07-18');
ok('visible projection does not flatten Lower Hinge to Aerobic Base', !!visibleTuesday && visibleTuesday.workoutType === 'Mixed' && strengthNames(visibleTuesday).length >= 3, visibleTuesday);
ok('visible projection does not flatten Lower Squat to Aerobic Base', !!visibleSaturday && visibleSaturday.workoutType === 'Mixed' && strengthNames(visibleSaturday).length >= 3, visibleSaturday);

const usefulStrength = built.reduce(
  (total, workout) => total + classifyVisibleSession(workout).contributions.mainStrength,
  0,
);
ok('healthy six-day Mon-Sat pre-season week retains four useful strength contributions', usefulStrength >= 4, built.map((workout) => ({ name: workout.name, type: workout.workoutType })));

section('[3] Required strength shells get deterministic content fallback');
{
  const upperPlan = midPlan.weeklyPlan.filter((session) => session.dayOfWeek === 'Friday');
  const [emptyUpper] = buildWorkoutsFromCoach([{
    dayOfWeek: 5,
    name: 'Upper Pull',
    workoutType: 'Strength',
    sessionTier: 'core',
    exercises: [],
  }], 'mc-empty-upper', upperPlan, PROFILE);
  ok('empty Upper Pull shell receives safe plan strength rows', emptyUpper.exercises.length >= 3, emptyUpper.exercises.map((row) => row.exercise?.name));
  ok('empty Upper Pull shell does not collapse to Rest', !!visible(emptyUpper, '2026-07-17'));
}

section('[4] Exact early off-season edge response obeys the deterministic component contract');
{
  const earlyProfile: OnboardingData = {
    ...PROFILE,
    seasonPhase: 'Off-season',
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    teamTrainingIntensity: undefined,
    teamTrainingDuration: undefined,
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Very consistent',
    injuries: [],
  } as OnboardingData;
  const earlyInputs = onboardingToCoachingInputs(earlyProfile, {
    miniCycleNumber: 1,
    weekInBlock: 1,
    weekNumber: 1,
    weekKind: 'build',
    availabilityDateISO: '2026-07-06',
  });
  const earlyPlan = buildCoachingPlan(earlyInputs);
  const earlyPrompt = buildGenerationPrompt(earlyProfile, earlyPlan, FULL_GYM_EQUIPMENT);
  const planByDay = new Map(
    earlyPlan.weeklyPlan.map((entry) => [DAY_NUMBER[entry.dayOfWeek!], entry]),
  );
  const withPlanId = (dayOfWeek: number) => ({
    planEntryId: planByDay.get(dayOfWeek)?.planEntryId,
    dayOfWeek,
  });
  const exactEdgeResponse = [
    {
      ...withPlanId(1),
      name: 'Full Body Strength + Aerobic Base',
      workoutType: 'Mixed',
      sessionTier: 'core',
      exercises: [
        { ...exercise('Romanian Deadlift'), notes: 'EDGE-WEEK-1-SENTINEL' },
        { ...exercise('Broad Jump'), pairType: 'contrast', supersetGroup: 'A', supersetOrder: 2 },
        exercise('Bench Press'),
        exercise('Pull-Ups'),
        { ...exercise('Hamstring Curl'), repsMin: 10, repsMax: 12 },
        { ...exercise('Pallof Press'), repsMin: 10, repsMax: 12 },
        { ...exercise('Bike Steady Zone 2'), sets: 1, repsMin: 1, repsMax: 1 },
      ],
    },
    {
      ...withPlanId(2),
      name: 'Conditioning Aerobic Base',
      workoutType: 'Conditioning',
      sessionTier: 'optional',
      exercises: [{ ...exercise('Bike Steady Zone 2'), sets: 1, repsMin: 1, repsMax: 1 }],
    },
    {
      ...withPlanId(3),
      name: 'Upper Push Strength + Mixed Conditioning',
      workoutType: 'Mixed',
      sessionTier: 'core',
      exercises: [
        exercise('Overhead Press'),
        exercise('Explosive Push-Ups'),
        exercise('Incline DB Press'),
        exercise('Incline DB Row'),
        { ...exercise('Lateral Raise'), repsMin: 12, repsMax: 15 },
        { ...exercise('Rower Intervals'), sets: 1, repsMin: 1, repsMax: 1 },
      ],
    },
    {
      ...withPlanId(4),
      name: 'Recovery Mobility + Light Movement',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [{ ...exercise('Mobility Flow'), sets: 1, repsMin: 10, repsMax: 15 }],
    },
    {
      ...withPlanId(5),
      name: 'Lower Squat Strength + Tempo Conditioning',
      workoutType: 'Mixed',
      sessionTier: 'core',
      exercises: [
        exercise('Back Squat'),
        exercise('Reverse Lunges'),
        { ...exercise('Leg Extension'), repsMin: 10, repsMax: 12 },
        { ...exercise('Bike Tempo'), sets: 1, repsMin: 1, repsMax: 1 },
      ],
    },
    {
      ...withPlanId(6),
      name: 'Recovery Mobility + Tissue Quality',
      workoutType: 'Recovery',
      sessionTier: 'recovery',
      exercises: [{ ...exercise('Tissue Quality Flow'), sets: 1, repsMin: 10, repsMax: 15 }],
    },
  ];

  ok('edge prompt carries stable plan-entry ids and authoritative main patterns',
    earlyPlan.weeklyPlan.every((entry) =>
      !!entry.planEntryId && earlyPrompt.includes(`planEntryId=${entry.planEntryId}`)) &&
      earlyPrompt.includes('archetype=full_body; primary=hinge; planned=hinge+pull') &&
      earlyPrompt.includes('archetype=upper; primary=push; planned=push') &&
      earlyPrompt.includes('archetype=lower; primary=squat; planned=squat'),
    earlyPrompt);
  ok('edge prompt states the early optional/no-power/no-running contract',
    /every session is OPTIONAL/i.test(earlyPrompt) &&
      /No running, power, jumps, explosive push-ups or contrast/i.test(earlyPrompt),
    earlyPrompt);

  const earlyBuilt = buildWorkoutsFromCoach(
    exactEdgeResponse,
    'mc-early-exact',
    earlyPlan.weeklyPlan,
    earlyProfile,
    {
      miniCycleNumber: 1,
      weekInBlock: 1,
      weekStartISO: '2026-07-06',
      weekKind: 'build',
    },
    { availableEquipment: FULL_GYM_EQUIPMENT },
  );
  const earlyWorkoutOn = (day: DayOfWeek) =>
    earlyBuilt.find((workout) => workout.dayOfWeek === DAY_NUMBER[day])!;
  const monday = earlyWorkoutOn('Monday');
  const wednesday = earlyWorkoutOn('Wednesday');
  const fridayEarly = earlyWorkoutOn('Friday');
  const mondayRows = getSessionComponentRows(monday);
  const wednesdayRows = getSessionComponentRows(wednesday);
  const mondayStrength = mondayRows.strengthRows.map((row) => row.exercise?.name ?? '');
  const wednesdayStrength = wednesdayRows.strengthRows.map((row) => row.exercise?.name ?? '');
  const allStrengthNames = earlyBuilt.flatMap((workout) =>
    getSessionComponentRows(workout).strengthRows.map((row) => row.exercise?.name ?? ''));

  eq('early six-day plan owns the exact weekly main-pattern ledger',
    strengthPatternLedger(earlyPlan.weeklyPlan),
    { squat: 1, hinge: 1, push: 1, pull: 1 });
  eq('Full Body label carries canonical Lower Hinge + Upper Pull intent',
    monday.strengthPatternContributions,
    ['hinge', 'pull']);
  ok('Romanian Deadlift remains on the hinge + pull session',
    mondayStrength.some((name) => /romanian deadlift|rdls?/i.test(name)), mondayStrength);
  ok('Pull-Ups remain on the hinge + pull session',
    mondayStrength.some((name) => /pull-?ups?/i.test(name)), mondayStrength);
  ok('Bench Press drift is removed from the hinge + pull session',
    !mondayStrength.some((name) => /bench press|incline press|overhead press/i.test(name)), mondayStrength);
  ok('Monday has no squat-pattern main work',
    !mondayStrength.some((name) =>
      classifyGeneratedWorkoutRow({ name, sets: 3, repsMax: 10, index: 0 }).mainPattern === 'squat'),
    mondayStrength);
  ok('minor upper-pull accessory remains on the Upper Push day',
    wednesdayStrength.some((name) => /incline db row/i.test(name)), wednesdayStrength);
  eq('unknown DB row is conservatively classified as strength, not erg conditioning',
    classifyGeneratedWorkoutRow({ name: 'Incline DB Row', sets: 3, repsMax: 10, index: 3 }).kind,
    'strength_accessory');
  eq('generated Rower Intervals is classified as conditioning',
    classifyGeneratedWorkoutRow({ name: 'Rower Intervals', sets: 1, repsMax: 1 }).kind,
    'conditioning');
  ok('raw power exercises cannot bypass early power policy',
    !allStrengthNames.some((name) => /broad jump|explosive push/i.test(name)) &&
      earlyBuilt.every((workout) => !workout.powerBlock), allStrengthNames);
  ok('no stale contrast metadata remains',
    earlyBuilt.every((workout) => workout.exercises.every((row) => row.pairType !== 'contrast')));
  ok('Bike Zone 2 is promoted to a typed conditioning component',
    mondayRows.conditioningRows.length > 0 && !!monday.conditioningBlock?.options.length,
    getSessionComponents(monday));
  ok('raw conditioning is absent from Monday strength rows',
    !mondayStrength.some((name) => /bike|rower|ski|zone\s*2|interval/i.test(name)), mondayStrength);
  ok('Rower Intervals is downgraded to valid easy typed aerobic work',
    wednesday.conditioningCategory === 'aerobic_base' &&
      wednesdayRows.conditioningRows.length > 0 &&
      wednesday.intensity === 'Light',
    wednesdayRows.conditioningRows.map((row) => ({ name: row.exercise?.name, notes: row.notes })));
  ok('conditioning component rows have no prescribed kilogram load',
    [...mondayRows.conditioningRows, ...wednesdayRows.conditioningRows]
      .every((row) => !row.prescribedWeightKg),
    [...mondayRows.conditioningRows, ...wednesdayRows.conditioningRows]
      .map((row) => ({ name: row.exercise?.name, weight: row.prescribedWeightKg })));
  ok('all three strength contributions retain Mixed identity',
    [monday, wednesday, fridayEarly].every((workout) =>
      workout.workoutType === 'Mixed' && !!workout.conditioningBlock?.options.length),
    [monday, wednesday, fridayEarly].map((workout) => ({ name: workout.name, type: workout.workoutType })));
  ok('weekly-card identity preserves strength title and surfaces aerobic context',
    /full body/i.test(monday.name) && /upper push/i.test(wednesday.name) &&
      /lower squat/i.test(fridayEarly.name) &&
      [monday, wednesday, fridayEarly].every((workout) =>
        combinedConditioningCategoryLabel(workout) === 'Aerobic Base'),
    [monday, wednesday, fridayEarly].map((workout) => ({
      name: workout.name,
      conditioning: combinedConditioningCategoryLabel(workout),
    })));
  ok('Day 5 Lower Squat remains in the accepted first week',
    !!fridayEarly && fridayEarly.strengthPatternContributions?.includes('squat'));
  ok('weekly visible items surface strength and conditioning separately',
    [monday, wednesday, fridayEarly].every((workout) => {
      const domains = new Set(extractVisibleProgramItemsFromWorkout(workout).map((item) => item.domain));
      return domains.has('strength') && domains.has('conditioning');
    }));
  ok('all early week sessions use the optional tier',
    earlyBuilt.length === 6 && earlyBuilt.every((workout) => workout.sessionTier === 'optional'),
    earlyBuilt.map((workout) => ({ day: workout.dayOfWeek, tier: workout.sessionTier })));
  const earlyMainRows = earlyBuilt.flatMap((workout) =>
    getSessionComponentRows(workout).strengthRows.filter((row) =>
      /romanian deadlift|rdls?|pull-?ups?|overhead press|back squat/i
        .test(row.exercise?.name ?? '')));
  ok('early main strength prescriptions use body-armour rep ranges',
    earlyMainRows.length >= 4 && earlyMainRows.every((row) =>
      row.prescribedRepsMin >= 8 && row.prescribedRepsMax <= 12),
    earlyMainRows.map((row) => ({
      name: row.exercise?.name,
      reps: [row.prescribedRepsMin, row.prescribedRepsMax],
    })));

  const microcycles = buildGeneratedMicrocycles({
    coachWorkouts: exactEdgeResponse,
    plan: earlyPlan,
    coachingInputs: earlyInputs,
    profile: earlyProfile,
    programId: 'program-early-exact',
    microcyclePrefix: 'mc-early-exact',
    blockStartISO: '2026-07-06',
    blockNumber: 1,
    athletePrefs: {},
    availableEquipmentTags: FULL_GYM_EQUIPMENT,
  });
  ok('four microcycles are built without replaying edge week content', microcycles.length === 4);
  eq('first microcycle keeps the accepted generated week component structure',
    microcycles[0].workouts.map((workout) => ({
      day: workout.dayOfWeek,
      name: workout.name,
      type: workout.workoutType,
      planEntryId: workout.planEntryId,
      patterns: workout.strengthPatternContributions ?? [],
      components: getSessionComponents(workout).map((component) => component.kind)
        .filter((kind) => kind !== 'recovery_addon'),
    })),
    earlyBuilt.map((workout) => ({
      day: workout.dayOfWeek,
      name: workout.name,
      type: workout.workoutType,
      planEntryId: workout.planEntryId,
      patterns: workout.strengthPatternContributions ?? [],
      components: getSessionComponents(workout).map((component) => component.kind)
        .filter((kind) => kind !== 'recovery_addon'),
    })));
  ok('edge source content appears only in the exact first microcycle',
    microcycles[0].workouts.some((workout) =>
      workout.exercises.some((row) => row.notes?.includes('EDGE-WEEK-1-SENTINEL'))) &&
      microcycles.slice(1).every((microcycle) =>
        microcycle.workouts.every((workout) =>
          workout.exercises.every((row) => !row.notes?.includes('EDGE-WEEK-1-SENTINEL')))));
  ok('each microcycle workout matches its own stable plan-entry identity',
    microcycles.every((microcycle) => {
      const weekPlan = buildCoachingPlan({
        ...earlyInputs,
        miniCycleNumber: microcycle.miniCycleNumber,
        weekInBlock: ((microcycle.weekNumber - 1) % 4) + 1,
        weekNumber: microcycle.weekNumber,
        weekKind: microcycle.weekKind,
      });
      const expectedByDay = new Map(
        weekPlan.weeklyPlan.map((entry) => [DAY_NUMBER[entry.dayOfWeek!], entry.planEntryId]),
      );
      return microcycle.workouts.every((workout) =>
        workout.planEntryId === expectedByDay.get(workout.dayOfWeek));
    }),
    microcycles.map((microcycle) => microcycle.workouts.map((workout) => workout.planEntryId)));
  const firstVisibleFriday = visible(
    microcycles[0].workouts.find((workout) => workout.dayOfWeek === 5)!,
    '2026-07-10',
  );
  ok('first microcycle Day 5 survives visible projection',
    !!firstVisibleFriday && firstVisibleFriday.strengthPatternContributions?.includes('squat'),
    firstVisibleFriday);
}

console.log(`\nGenerated program normalizer tests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`Failures:\n${failures.map((name) => `  - ${name}`).join('\n')}`);
  process.exit(1);
}
