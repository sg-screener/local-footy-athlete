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
  applyRecoveryAddonBias,
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
  return bias.speedBias === 0 &&
    Object.keys(bias.conditioningCategoryPreference).length === 0 &&
    Object.keys(bias.recoveryAddonFocusPreference).length === 0;
}

const BASE_PROFILE: OnboardingData = {
  seasonPhase: 'Off-season',
  position: 'inside_mid',
  trainingDaysPerWeek: 3,
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
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
  options: { weekInBlock?: number } = {},
): CoachingPlan {
  return buildCoachingPlan(onboardingToCoachingInputs(data, {
    availabilityDateISO: TODAY,
    generationConstraints,
    weekInBlock: options.weekInBlock,
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
  ok('testing output contains only consumed fields plus explicit debug data',
    Object.keys(missing).sort().join(',') === [
      'conditioningCategoryPreference',
      'debug',
      'recoveryAddonFocusPreference',
      'speedBias',
    ].sort().join(','),
    Object.keys(missing));
  ok('the bias exposes no regional strength direction at all — Sam killed the gap-lean',
    !('lowerStrengthBias' in missing) && !('upperStrengthBias' in missing),
    Object.keys(missing));
  ok('neutral testing reason is explicitly debug-only',
    missing.debug.reasons.some((reason) => /neutral bias/i.test(reason)),
    missing.debug.reasons);

  const balanced = computeTestingBias({
    phase: 'Off-season',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    injuries: [],
  });
  ok('a healthy profile with no stated weakness remains neutral', allNeutral(balanced), balanced);
}

console.log('\n[2] the strength answers lean NOTHING — Sam killed the gap (2026-07-30)');
{
  // The full authority gate is `strengthAnswerAuthorityTests` (in `test:bible`). These
  // two keep the claim adjacent to the mechanism that used to hold it.
  const lopsided = planFor(profile({
    squatStrength: 'Less than bodyweight',
    benchStrength: '1.5x bodyweight+',
  }));
  const mirrored = planFor(profile({
    squatStrength: '2x bodyweight+',
    benchStrength: 'Less than bodyweight',
  }));
  const neutralPlan = planFor(profile());
  ok('a lopsided profile and its mirror produce the SAME week as a balanced one',
    planText(lopsided) === planText(neutralPlan) &&
      planText(mirrored) === planText(neutralPlan),
    { neutral: planText(neutralPlan), lopsided: planText(lopsided), mirrored: planText(mirrored) });
  eq('neither direction moves the lower dose',
    [lowerDose(lopsided.weeklyPlan), lowerDose(mirrored.weeklyPlan)],
    [lowerDose(neutralPlan.weeklyPlan), lowerDose(neutralPlan.weeklyPlan)]);
  eq('neither direction moves the upper dose',
    [upperDose(lopsided.weeklyPlan), upperDose(mirrored.weeklyPlan)],
    [upperDose(neutralPlan.weeklyPlan), upperDose(neutralPlan.weeklyPlan)]);
}

console.log('\n[3] aerobic and speed testing gaps only re-order permitted categories');
{
  const aerobic = computeTestingBias({ phase: 'Off-season', conditioningLevel: 'Poor' });
  ok('poor aerobic signal creates small bounded category preference',
    (aerobic.conditioningCategoryPreference.aerobic_base ?? 0) > 0 &&
      (aerobic.conditioningCategoryPreference.aerobic_base ?? 0) <= 0.1,
    aerobic);
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

  const poorAerobicPlan = planFor(profile({
    seasonPhase: 'Pre-season',
    position: undefined,
    motivation: 'Stay consistent',
    conditioningLevel: 'Poor',
    trainingDaysPerWeek: 5,
    preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
  }), undefined, { weekInBlock: 2 });
  const poorCategories = poorAerobicPlan.weeklyPlan
    .map((session) => session.conditioningCategory)
    .filter(Boolean);
  ok('poor aerobic testing signal reaches safe pre-season category selection',
    poorCategories.some((category) => category === 'aerobic_base' || category === 'tempo'),
    planText(poorAerobicPlan));
  ok('poor aerobic nudge does not add sessions beyond availability',
    poorAerobicPlan.weeklyPlan.length <= 5,
    planText(poorAerobicPlan));
}

console.log('\n[4] phase scaling and beginner policy');
{
  const signal = { biggestLimitation: 'Speed' as const };
  const off = computeTestingBias({ phase: 'Off-season', ...signal });
  const pre = computeTestingBias({ phase: 'Pre-season', ...signal });
  const inSeason = computeTestingBias({ phase: 'In-season', ...signal });
  ok('off-season expresses more speed bias than pre-season and in-season',
    off.speedBias > pre.speedBias && pre.speedBias > inSeason.speedBias,
    { off, pre, inSeason });
  ok('in-season testing bias remains minimal', inSeason.speedBias <= 0.03, inSeason);

  const aerobicOff = computeTestingBias({ phase: 'Off-season', conditioningLevel: 'Poor' });
  const aerobicIn = computeTestingBias({ phase: 'In-season', conditioningLevel: 'Poor' });
  ok('phase scaling applies to the aerobic direction too',
    (aerobicOff.conditioningCategoryPreference.aerobic_base ?? 0) >
      (aerobicIn.conditioningCategoryPreference.aerobic_base ?? 0),
    { aerobicOff, aerobicIn });

  const beginner = computeTestingBias({ phase: 'Off-season', ...signal, isBeginner: true });
  eq('beginner policy fully suppresses speed testing bias', beginner.speedBias, 0);
  const beginnerRobust = computeTestingBias({
    phase: 'Off-season', biggestLimitation: 'Injury history', isBeginner: true,
  });
  const adultRobust = computeTestingBias({ phase: 'Off-season', biggestLimitation: 'Injury history' });
  ok('beginner support bias is damped rather than removed',
    (beginnerRobust.recoveryAddonFocusPreference.trunk_core ?? 0) > 0 &&
      (beginnerRobust.recoveryAddonFocusPreference.trunk_core ?? 0) <
        (adultRobust.recoveryAddonFocusPreference.trunk_core ?? 0),
    { beginnerRobust, adultRobust });

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
  const combinedActiveWeights = [
    combined.strengthBias,
    combined.speedBias,
    ...Object.values(combined.conditioningCategoryPreference),
    ...Object.values(combined.recoveryAddonFocusPreference),
  ];
  ok('all composed role/goal/testing outputs stay capped at 15%',
    combinedActiveWeights.every((weight) => Math.abs(weight) <= 0.15),
    combined);
  eq('same sprint preference uses max rather than summing', combined.conditioningCategoryPreference.sprint, 0.15);
  ok('composition preserves testing reasons in explicit debug data',
    combined.testingDebug.reasons.some((note) => /speed/i.test(note)),
    combined.testingDebug.reasons);
}

console.log('\n[6] robustness signal favours safe prehab without creating hard exposure');
{
  const robustness = computeTestingBias({
    phase: 'Off-season',
    biggestLimitation: 'Injury history',
  });
  ok('injury history creates a bounded recovery add-on preference',
    (robustness.recoveryAddonFocusPreference.hamstring_light_prehab ?? 0) > 0,
    robustness);
  const ordered = applyRecoveryAddonBias([
    { focusArea: 'mobility_reset' as const },
    { focusArea: 'hamstring_light_prehab' as const },
    { focusArea: 'trunk_core' as const },
  ], robustness.recoveryAddonFocusPreference);
  ok('robustness bias moves trunk/prehab ahead of generic mobility',
    ordered.at(-1)?.focusArea === 'mobility_reset',
    ordered.map((item) => item.focusArea));

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

  const neutralSupport = attachRecoveryAddonsToWeek({
    workouts: before,
    profile: profile({
      position: undefined,
      motivation: 'Stay consistent',
      biggestLimitation: undefined,
    }),
    weekKind: 'build',
  });
  const sizeSupport = attachRecoveryAddonsToWeek({
    workouts: before,
    profile: profile({
      position: undefined,
      motivation: 'Build muscle and size',
      biggestLimitation: undefined,
    }),
    weekKind: 'build',
  });
  const durabilitySupport = attachRecoveryAddonsToWeek({
    workouts: before,
    profile: profile({
      position: undefined,
      motivation: 'Stay injury-free and durable',
      biggestLimitation: undefined,
    }),
    weekKind: 'build',
  });
  ok('strength/size goal changes safe support ordering without adding a session',
    addonFocus(sizeSupport).join(',') !== addonFocus(neutralSupport).join(',') &&
      sizeSupport.length === neutralSupport.length,
    { neutral: addonFocus(neutralSupport), size: addonFocus(sizeSupport) });
  ok('durability goal changes safe prehab ordering without adding a hard day',
    addonFocus(durabilitySupport).join(',') !== addonFocus(neutralSupport).join(',') &&
      addonFocus(durabilitySupport).includes('hamstring_light_prehab'),
    { neutral: addonFocus(neutralSupport), durability: addonFocus(durabilitySupport) });
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
      deloaded: true,
      sessionsOptional: false,
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
  // ⚠ PRE-EXISTING RED — NOT caused by the strength-band deletion (2026-07-31).
  //
  // Verified against a clean worktree at HEAD (`92db2b0`): this assertion already failed
  // there, with the same message, for BOTH a lopsided and a balanced profile. HEAD's own
  // run of this file is "42 passed, 1 failed" and it is this one. The reason nobody knew:
  // `test:testing-bias` is NOT in `test:bible`, so the suite has been rotting unwatched.
  //
  // WHAT IT SAYS. An athlete with an active knee constraint whose triggers include
  // `squat` and `jumping` still gets a Friday session whose focus reads "Lower body -
  // squat emphasis". The assertion is on the plan's FOCUS TEXT, so what is established is
  // that the LABEL survives the constraint — whether the exercises underneath it are
  // knee-safe is NOT established by this test either way, and was not investigated here.
  //
  // Left failing deliberately. Loosening it to go green is exactly what L13 forbids, and
  // the defect belongs to the injury-constraint/placement owner, not to this unit.
  const injuredLower = planFor(profile({
    squatStrength: 'Less than bodyweight',
    benchStrength: '1.25x bodyweight',
  }), kneeConstraint);
  ok('[PRE-EXISTING RED at HEAD] knee constraint blocks squat bias while safe work remains',
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
