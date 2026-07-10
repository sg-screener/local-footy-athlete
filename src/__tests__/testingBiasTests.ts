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
  OnboardingData,
  RecoveryAddonBlock,
  Workout,
} from '../types/domain';
import {
  applyRecoveryAddonTestingBias,
  composeProgrammingBias,
  computeTestingBias,
} from '../rules/testingBias';
import {
  applyConditioningCategoryBias,
  computeProgrammingBias,
  type BiasConditioningCategory,
} from '../rules/programmingBias';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
  type SessionAllocation,
} from '../utils/coachingEngine';
import type { GenerationConstraintContext } from '../utils/generationConstraints';
import { attachRecoveryAddonsToWeek } from '../utils/recoveryAddonBuilder';
import { countWeeklyExposures } from '../rules/weeklyExposureCounts';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';

const TODAY = '2026-07-06';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

function allNeutral(bias: ReturnType<typeof computeTestingBias>): boolean {
  return [
    bias.lowerStrengthBias,
    bias.upperStrengthBias,
    bias.aerobicBias,
    bias.speedBias,
    bias.recoveryAddonBias,
    bias.accessoryBias,
  ].every((value) => value === 0);
}

const BASE_PROFILE: OnboardingData = {
  seasonPhase: 'Off-season',
  position: 'inside_mid',
  trainingDaysPerWeek: 3,
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
  sessionDurationMinutes: 60,
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
  experienceLevel: '2-5 years',
  squatStrength: 'Around bodyweight',
  benchStrength: 'Around bodyweight',
  conditioningLevel: 'Good',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Stay consistent',
};

function profile(overrides: Partial<OnboardingData> = {}): OnboardingData {
  return { ...BASE_PROFILE, ...overrides };
}

function planFor(
  data: OnboardingData,
  generationConstraints?: GenerationConstraintContext,
): CoachingPlan {
  return buildCoachingPlan(onboardingToCoachingInputs(data, {
    availabilityDateISO: TODAY,
    generationConstraints,
  }));
}

function planText(plan: CoachingPlan): string {
  return plan.weeklyPlan.map((session) => [
    session.dayOfWeek,
    session.tier,
    session.focus,
    session.strengthPattern,
    session.conditioningCategory,
    session.speedWorkKind,
    session.stressLevel,
  ].filter(Boolean).join(' ')).join(' | ');
}

function lowerDose(sessions: readonly SessionAllocation[]): number {
  return sessions.reduce((total, session) => {
    if (session.strengthPattern === 'lower' || session.strengthPattern === 'lower_combined') return total + 1;
    if (session.strengthPattern === 'full_body') return total + 0.5;
    return total;
  }, 0);
}

function upperDose(sessions: readonly SessionAllocation[]): number {
  return sessions.reduce((total, session) => {
    if (session.strengthPattern === 'push' || session.strengthPattern === 'pull') return total + 1;
    if (session.strengthPattern === 'upper_combined') return total + 1;
    if (session.strengthPattern === 'full_body') return total + 0.5;
    return total;
  }, 0);
}

function workout(dayOfWeek: number, name: string, workoutType: Workout['workoutType'] = 'Strength'): Workout {
  return {
    id: `testing-${dayOfWeek}-${name}`,
    microcycleId: 'testing-week',
    dayOfWeek,
    name,
    description: name,
    durationMinutes: 55,
    intensity: workoutType === 'Recovery' ? 'Light' : 'Moderate',
    workoutType,
    sessionTier: workoutType === 'Recovery' ? 'recovery' : 'core',
    exercises: [],
    createdAt: `${TODAY}T00:00:00.000Z`,
    updatedAt: `${TODAY}T00:00:00.000Z`,
  };
}

function addonFocus(workouts: readonly Workout[]): string[] {
  return workouts.flatMap((item) => item.recoveryAddons ?? [])
    .map((addon: RecoveryAddonBlock) => addon.focusArea);
}

console.log('\nTesting / imbalance bias');

console.log('\n[1] neutral and balanced signals');
{
  const missing = computeTestingBias({ phase: 'Off-season' });
  ok('missing testing data is neutral', allNeutral(missing), missing);
  eq('missing testing data has no conditioning preference', missing.conditioningCategoryPreference, {});

  const balanced = computeTestingBias({
    phase: 'Off-season',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    injuries: [],
  });
  ok('balanced testing remains neutral', allNeutral(balanced), balanced);

  const unknown = computeTestingBias({
    phase: 'Off-season',
    squatStrength: 'Not sure',
    benchStrength: 'Not sure',
  });
  ok('Not sure never becomes weakness evidence', allNeutral(unknown), unknown);
}

console.log('\n[2] strength imbalance signals are small and regional');
{
  const weakLower = computeTestingBias({
    phase: 'Off-season',
    squatStrength: 'Less than bodyweight',
    benchStrength: '1.25x bodyweight',
  });
  ok('weak lower signal creates lower bias', weakLower.lowerStrengthBias > 0, weakLower);
  eq('weak lower does not create upper bias', weakLower.upperStrengthBias, 0);
  ok('weak lower adds small accessory/support bias', weakLower.accessoryBias > 0, weakLower);
  ok('weak lower bias stays at or below 10%', weakLower.lowerStrengthBias <= 0.1, weakLower);

  const weakUpper = computeTestingBias({
    phase: 'Off-season',
    squatStrength: '1.5x bodyweight',
    benchStrength: 'Less than bodyweight',
  });
  ok('weak upper signal creates upper bias', weakUpper.upperStrengthBias > 0, weakUpper);
  eq('weak upper does not create lower bias', weakUpper.lowerStrengthBias, 0);
  ok('weak upper adds small accessory bias', weakUpper.accessoryBias > 0, weakUpper);

  const neutralPlan = planFor(profile());
  const weakLowerPlan = planFor(profile({
    squatStrength: 'Less than bodyweight',
    benchStrength: '1.25x bodyweight',
  }));
  ok('weak lower can only favour approved lower/full-body support, not add sessions',
    lowerDose(weakLowerPlan.weeklyPlan) >= lowerDose(neutralPlan.weeklyPlan) &&
      weakLowerPlan.coreSessions === neutralPlan.coreSessions,
    { neutral: planText(neutralPlan), weakLower: planText(weakLowerPlan) });
}

console.log('\n[3] aerobic and speed testing gaps only re-order permitted categories');
{
  const aerobic = computeTestingBias({ phase: 'Off-season', conditioningLevel: 'Poor' });
  ok('poor aerobic signal creates small aerobic bias', aerobic.aerobicBias > 0 && aerobic.aerobicBias <= 0.1, aerobic);
  const categories: BiasConditioningCategory[] = ['vo2', 'tempo', 'aerobic_base'];
  const aerobicOrder = applyConditioningCategoryBias(categories, aerobic.conditioningCategoryPreference);
  eq('poor aerobic signal favours aerobic base where available', aerobicOrder[0], 'aerobic_base');

  const speed = computeTestingBias({ phase: 'Off-season', biggestLimitation: 'Speed' });
  ok('poor speed signal creates small speed bias', speed.speedBias > 0 && speed.speedBias <= 0.1, speed);
  const gateFiltered: BiasConditioningCategory[] = ['aerobic_base', 'tempo', 'vo2'];
  const speedOrder = applyConditioningCategoryBias(gateFiltered, speed.conditioningCategoryPreference);
  ok('speed testing bias cannot re-add sprint after gate removal', !speedOrder.includes('sprint'), speedOrder);
  ok('speed testing bias preserves the gate-filtered category set',
    speedOrder.length === gateFiltered.length && gateFiltered.every((category) => speedOrder.includes(category)),
    speedOrder);
}

console.log('\n[4] phase scaling and beginner policy');
{
  const signal = {
    squatStrength: 'Less than bodyweight' as const,
    benchStrength: '1.25x bodyweight' as const,
    biggestLimitation: 'Speed' as const,
  };
  const off = computeTestingBias({ phase: 'Off-season', ...signal });
  const pre = computeTestingBias({ phase: 'Pre-season', ...signal });
  const inSeason = computeTestingBias({ phase: 'In-season', ...signal });
  ok('off-season expresses more lower bias than pre-season and in-season',
    off.lowerStrengthBias > pre.lowerStrengthBias && pre.lowerStrengthBias > inSeason.lowerStrengthBias,
    { off, pre, inSeason });
  ok('in-season testing bias remains minimal',
    Math.max(inSeason.lowerStrengthBias, inSeason.speedBias) <= 0.03,
    inSeason);

  const beginner = computeTestingBias({ phase: 'Off-season', ...signal, isBeginner: true });
  eq('beginner policy fully suppresses speed testing bias', beginner.speedBias, 0);
  ok('beginner support bias is damped', beginner.lowerStrengthBias < off.lowerStrengthBias, beginner);

  const beginnerPlan = planFor(profile({
    experienceLevel: 'Complete beginner',
    squatStrength: "I don't squat",
    benchStrength: '1.25x bodyweight',
    biggestLimitation: 'Speed',
    sprintExposure: 'No sprint training',
  }));
  ok('beginner plan keeps beginner core cap', beginnerPlan.coreSessions <= 2, planText(beginnerPlan));
  ok('beginner testing bias adds no sprint',
    !beginnerPlan.weeklyPlan.some((session) =>
      session.conditioningCategory === 'sprint' || session.speedWorkKind === 'true_speed'),
    planText(beginnerPlan));
}

console.log('\n[5] role/goal + testing compose without doubling');
{
  const roleGoal = computeProgrammingBias({
    role: 'outside_runner',
    goals: ['Get faster'],
    phase: 'Off-season',
  });
  const testing = computeTestingBias({
    phase: 'Off-season',
    biggestLimitation: 'Speed',
    sprintExposure: 'No sprint training',
  });
  const combined = composeProgrammingBias(roleGoal, testing);
  ok('composed speed bias stays capped at 15%', combined.speedBias <= 0.15, combined);
  eq('same sprint preference uses max rather than summing', combined.conditioningCategoryPreference.sprint, 2);
  ok('composition preserves testing reasons', combined.testingNotes.some((note) => /speed/i.test(note)), combined.testingNotes);
}

console.log('\n[6] robustness signal favours safe prehab without creating hard exposure');
{
  const robustness = computeTestingBias({
    phase: 'Off-season',
    biggestLimitation: 'Injury history',
  });
  ok('injury history creates recovery add-on bias', robustness.recoveryAddonBias > 0, robustness);
  const ordered = applyRecoveryAddonTestingBias([
    { focusArea: 'mobility_reset' as const },
    { focusArea: 'hamstring_light_prehab' as const },
    { focusArea: 'trunk_core' as const },
  ], robustness);
  eq('robustness bias moves trunk/prehab ahead of generic mobility',
    ordered.map((item) => item.focusArea),
    ['trunk_core', 'hamstring_light_prehab', 'mobility_reset']);

  const before = [
    workout(1, 'Lower Strength'),
    workout(2, 'Upper Strength'),
    workout(3, 'Recovery', 'Recovery'),
    workout(4, 'Full Body Strength'),
    workout(5, 'Easy Aerobic', 'Conditioning'),
  ];
  const after = attachRecoveryAddonsToWeek({
    workouts: before,
    profile: profile({ biggestLimitation: 'Injury history' }),
    weekKind: 'build',
  });
  ok('injury-history profile favours robustness/prehab coverage',
    addonFocus(after).includes('hamstring_light_prehab'), addonFocus(after));
  const beforeCounts = countWeeklyExposures(before.map((item, index) => ({
    date: `2026-07-${String(6 + index).padStart(2, '0')}`,
    workout: item,
  })));
  const afterCounts = countWeeklyExposures(after.map((item, index) => ({
    date: `2026-07-${String(6 + index).padStart(2, '0')}`,
    workout: item,
  })));
  eq('recovery add-on bias creates no hard days', afterCounts.hardExposures, beforeCounts.hardExposures);
  eq('recovery add-on bias creates no conditioning exposure', afterCounts.conditioningExposures, beforeCounts.conditioningExposures);
}

console.log('\n[7] game, injury and readiness gates win');
{
  const inSeason = planFor(profile({
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingIntensity: 'Hard',
    usualGameDay: 'Saturday',
    squatStrength: 'Less than bodyweight',
    benchStrength: '1.25x bodyweight',
  }));
  const friday = inSeason.weeklyPlan.find((session) => session.dayOfWeek === 'Friday');
  ok('in-season weak-lower bias does not violate G-1 freshness',
    !friday || (
      friday.stressLevel !== 'high' &&
      !friday.strengthPattern &&
      !friday.conditioningCategory &&
      !friday.speedWorkKind
    ), planText(inSeason));

  const readiness: GenerationConstraintContext = {
    activeConstraintIds: ['readiness-testing'],
    activeInjuryKeys: [],
    injuries: [],
    readiness: {
      id: 'readiness-testing',
      sourceType: 'fatigue',
      severity: 5,
      tier: 'moderate_reduction',
      avoidSprint: true,
      avoidHardConditioning: true,
      reduceHardExtras: true,
      preferRecovery: false,
      fullPause: false,
    },
  };
  const tiredSpeed = planFor(profile({ biggestLimitation: 'Speed' }), readiness);
  ok('readiness gate blocks speed/hard-conditioning testing bias',
    tiredSpeed.weeklyPlan.every((session) =>
      session.conditioningCategory !== 'sprint' &&
      session.conditioningCategory !== 'vo2' &&
      session.conditioningCategory !== 'glycolytic' &&
      !session.speedWorkKind),
    planText(tiredSpeed));

  const kneeConstraint: GenerationConstraintContext = {
    activeConstraintIds: ['injury-knee'],
    activeInjuryKeys: ['knee'],
    injuries: [{
      id: 'injury-knee',
      sourceType: 'injury',
      bodyPart: 'knee',
      bucket: 'knee',
      region: 'lower_body',
      severity: 5,
      severityBand: 'reduce_affected_4_5',
      onboardingSeverity: 'Moderate',
      triggers: ['squat', 'jumping', 'change of direction'],
      reduceAffectedWork: true,
      removeRiskyWork: false,
      pauseAffectedTraining: false,
      injuryKeys: ['knee'],
    }],
  };
  const injuredLower = planFor(profile({
    squatStrength: 'Less than bodyweight',
    benchStrength: '1.25x bodyweight',
  }), kneeConstraint);
  ok('knee constraint blocks squat bias while safe work remains',
    !/squat emphasis|quad-dominant main/i.test(planText(injuredLower)) &&
      injuredLower.weeklyPlan.some((session) =>
        session.strengthPattern === 'push' || session.strengthPattern === 'pull' || session.strengthPattern === 'upper_combined'),
    planText(injuredLower));
}

console.log('\n[8] equipment remains exercise-selection source of truth');
{
  const bodyweightProfile = profile({
    equipment: ['Bodyweight Only'],
    experienceLevel: 'Complete beginner',
    squatStrength: "I don't squat",
    benchStrength: '1.25x bodyweight',
  });
  const workouts = buildWorkoutsFromCoach(
    [{
      dayOfWeek: 1,
      name: 'Lower Squat',
      workoutType: 'Strength',
      sessionTier: 'core',
      exercises: [
        { name: 'Back Squat', sets: 3, repsMin: 5, repsMax: 8 },
        { name: 'Deadlift', sets: 3, repsMin: 6, repsMax: 10 },
      ],
    }],
    'testing-bias-bodyweight',
    undefined,
    bodyweightProfile,
    { miniCycleNumber: 1, weekInBlock: 1, weekStartISO: TODAY },
    { excluded: [], pinned: [], availableEquipment: ['bodyweight'] },
  );
  const lowerWorkouts = workouts.filter((item) => /lower|squat|hinge/i.test(item.name));
  const unavailable = lowerWorkouts.flatMap((item) => item.exercises)
    .filter((row) => (row.exercise?.equipmentRequired ?? []).length > 0)
    .map((row) => ({ name: row.exercise?.name, equipment: row.exercise?.equipmentRequired }));
  ok('bodyweight equipment gate overrides weak-lower exercise preference',
    lowerWorkouts.length > 0 && unavailable.length === 0,
    { lowerWorkouts: lowerWorkouts.map((item) => item.name), unavailable });
  ok('bodyweight testing-bias plan still keeps useful work',
    workouts.some((item) => item.exercises.length > 0 || item.workoutType === 'Recovery'),
    workouts.map((item) => item.name));
}

console.log('\n[9] healthy default path is unchanged');
{
  const missing = planFor(profile({
    squatStrength: undefined,
    benchStrength: undefined,
  }));
  const balanced = planFor(profile());
  ok('healthy neutral and balanced profiles keep the same deterministic week',
    JSON.stringify(missing.weeklyPlan) === JSON.stringify(balanced.weeklyPlan),
    { missing: planText(missing), balanced: planText(balanced) });
}

console.log(`\ntestingBiasTests: ${pass} passed, ${fail} failed`);
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
process.exit(fail > 0 ? 1 : 0);
