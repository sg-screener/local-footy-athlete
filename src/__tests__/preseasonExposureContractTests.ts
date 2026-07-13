(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import type { OnboardingData } from '../types/domain';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
  type SessionAllocation,
} from '../utils/coachingEngine';
import {
  buildPreseasonExposureBlueprint,
  buildPreseasonWeeklyExposureContract,
  evaluatePreseasonExposureContract,
} from '../rules/preseasonExposureContract';
import {
  buildGenerationPrompt,
  buildInitialGeneratedCoachingPlan,
} from '../services/api/generateProgram';
import { FULL_GYM_EQUIPMENT } from '../utils/equipmentAvailability';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    pass++;
    console.log(`  ok ${name}`);
    return;
  }
  fail++;
  failures.push(name);
  console.log(`  fail ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
}

function eq<T>(name: string, actual: T, expected: T): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { expected, actual });
}

const EXACT_PROFILE: OnboardingData = {
  firstName: 'ExposureFirst',
  seasonPhase: 'Pre-season',
  trainingDaysPerWeek: 6,
  preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Monday', 'Wednesday'],
  teamTrainingIntensity: 'Hard',
  sessionDurationMinutes: 60,
  trainingLocation: 'Commercial gym',
  equipment: ['Full Gym'],
  experienceLevel: '2-5 years',
  squatStrength: '1.5x bodyweight',
  benchStrength: '1.25x bodyweight',
  conditioningLevel: 'Elite',
  sprintExposure: '2+ times per week',
  recentTrainingLoad: 'Very consistent',
  injuries: [],
  motivation: 'Build strength and match fitness',
};

function planFor(
  profile: OnboardingData,
  weekNumber = 1,
  weekKind: 'build' | 'deload' = 'build',
): CoachingPlan {
  const inputs = onboardingToCoachingInputs(profile, {
    availabilityDateISO: '2026-07-13',
    miniCycleNumber: weekNumber,
    weekInBlock: weekNumber,
    weekNumber,
    weekKind,
  });
  return buildCoachingPlan(inputs);
}

function byDay(plan: CoachingPlan, day: string): SessionAllocation | undefined {
  return plan.weeklyPlan.find((entry) => entry.dayOfWeek === day);
}

function plannedPatterns(plan: CoachingPlan): string[] {
  return Array.from(new Set(plan.weeklyPlan.flatMap((entry) =>
    entry.strengthIntent?.plannedPatterns ?? []))).sort();
}

function validate(plan: CoachingPlan) {
  if (!plan.preseasonExposureContract) throw new Error('Pre-season plan omitted its exposure contract');
  return evaluatePreseasonExposureContract(plan.preseasonExposureContract, plan.weeklyPlan);
}

function assertContractSatisfied(name: string, plan: CoachingPlan): void {
  const result = validate(plan);
  eq(`${name} satisfies final exposure validation`, result.violations, []);
  ok(`${name} carries typed reasons for every reduction`,
    (plan.preseasonExposureContract?.reductions ?? []).every((entry) =>
      !!entry.domain && !!entry.code && entry.reason.trim().length > 0),
    plan.preseasonExposureContract?.reductions);
}

console.log('\n-- Typed contract and exact six-day blueprint --');
{
  const contract = buildPreseasonWeeklyExposureContract({
    seasonPhase: 'Pre-season',
    readiness: 'high',
    selectedDayNumbers: [1, 2, 3, 4, 5, 6],
    teamTrainingDayNumbers: [1, 3],
    hasGame: false,
    gameDay: null,
    maxStrengthSessions: 4,
  });
  if (!contract) throw new Error('Expected a pre-season exposure contract');
  eq('healthy contract requires all four strength patterns',
    contract.strength.requiredPatterns, ['squat', 'hinge', 'push', 'pull']);
  eq('healthy contract requires four strength contributions', contract.strength.targetCount, 4);
  eq('healthy contract requires four total conditioning exposures', contract.conditioning.targetCount, 4);
  eq('two team anchors receive exactly two conditioning credits', contract.conditioning.creditedTeamTrainingCount, 2);
  eq('two real app conditioning components remain required', contract.conditioning.additionalRequiredCount, 2);
  eq('four hard days remains a preference', contract.hardDays.preferredCount, 4);
  eq('five hard days is explicitly permitted', contract.hardDays.permittedCount, 5);
  eq('hard-day preference is not encoded as a hard maximum', contract.hardDays.isHardMaximum, false);
  eq('healthy exact profile has no authorised reductions', contract.reductions, []);

  const blueprint = buildPreseasonExposureBlueprint({
    contract,
    selectedDayNumbers: [1, 2, 3, 4, 5, 6],
    weekNumber: 1,
  });
  eq('blueprint reserves Thursday as the in-week rest day', blueprint.restDays, [4]);
  eq('blueprint allocates conditioning only after strength placement', blueprint.conditioningDays, [5, 6]);
  eq('blueprint owns the exact Week 1 strength structure', blueprint.strength, [
    { day: 1, identity: 'push' },
    { day: 2, identity: 'hinge' },
    { day: 5, identity: 'pull' },
    { day: 6, identity: 'squat' },
  ]);
}

console.log('\n-- Exact four-microcycle regression --');
for (let week = 1; week <= 4; week++) {
  const plan = planFor(EXACT_PROFILE, week, week === 4 ? 'deload' : 'build');
  const ledger = validate(plan).ledger;
  const label = `week ${week}`;
  assertContractSatisfied(label, plan);
  eq(`${label} covers push, pull, squat and hinge`, plannedPatterns(plan), ['hinge', 'pull', 'push', 'squat']);
  ok(`${label} Monday is upper strength plus team training`,
    !!byDay(plan, 'Monday')?.isTeamDay &&
      (byDay(plan, 'Monday')?.strengthIntent?.archetype === 'upper'), byDay(plan, 'Monday'));
  ok(`${label} Tuesday is lower strength`, byDay(plan, 'Tuesday')?.strengthIntent?.archetype === 'lower', byDay(plan, 'Tuesday'));
  ok(`${label} Wednesday remains team training without false main-strength credit`,
    !!byDay(plan, 'Wednesday')?.isTeamDay &&
      (byDay(plan, 'Wednesday')?.strengthIntent?.plannedPatterns.length ?? 0) === 0,
    byDay(plan, 'Wednesday'));
  ok(`${label} Thursday is recovery/rest after required work is allocated`,
    byDay(plan, 'Thursday')?.tier === 'recovery', byDay(plan, 'Thursday'));
  ok(`${label} Friday is upper strength plus a real conditioning component`,
    byDay(plan, 'Friday')?.strengthIntent?.archetype === 'upper' &&
      byDay(plan, 'Friday')?.hasCombinedConditioning === true &&
      byDay(plan, 'Friday')?.attachedConditioningKind === 'component', byDay(plan, 'Friday'));
  ok(`${label} Saturday is lower strength plus a real conditioning component`,
    byDay(plan, 'Saturday')?.strengthIntent?.archetype === 'lower' &&
      byDay(plan, 'Saturday')?.hasCombinedConditioning === true &&
      byDay(plan, 'Saturday')?.attachedConditioningKind === 'component', byDay(plan, 'Saturday'));
  eq(`${label} ledger keeps four strength contributions`, ledger.strengthContributionCount, 4);
  eq(`${label} ledger keeps two team conditioning anchors`, ledger.teamTrainingCount, 2);
  eq(`${label} ledger keeps two additional conditioning components`, ledger.additionalConditioningCount, 2);
  eq(`${label} ledger accepts five training/hard days`, [ledger.trainingDayCount, ledger.hardDayCount], [5, 5]);
  eq(`${label} ledger preserves two full rest days`, ledger.fullRestDayCount, 2);
}

console.log('\n-- Edge prompt and deterministic fallback share the contract --');
{
  const inputs = onboardingToCoachingInputs(EXACT_PROFILE, { availabilityDateISO: '2026-07-13' });
  const edge = buildInitialGeneratedCoachingPlan({
    coachingInputs: inputs,
    profile: EXACT_PROFILE,
    todayISO: '2026-07-13',
    blockNumber: 1,
  });
  const fallback = planFor(EXACT_PROFILE, 1);
  eq('edge and fallback own the same typed exposure contract',
    edge.preseasonExposureContract, fallback.preseasonExposureContract);
  eq('edge and fallback own the same plan-entry component skeleton',
    edge.weeklyPlan.map((entry) => ({
      id: entry.planEntryId,
      patterns: entry.strengthIntent?.plannedPatterns ?? [],
      conditioning: !!entry.conditioningCategory,
      team: !!entry.isTeamDay,
    })),
    fallback.weeklyPlan.map((entry) => ({
      id: entry.planEntryId,
      patterns: entry.strengthIntent?.plannedPatterns ?? [],
      conditioning: !!entry.conditioningCategory,
      team: !!entry.isTeamDay,
    })));
  const prompt = buildGenerationPrompt(EXACT_PROFILE, edge, FULL_GYM_EQUIPMENT);
  ok('edge prompt receives the exact pre-season exposure contract',
    prompt.includes('strength=4 [squat+hinge+push+pull]') &&
      prompt.includes('conditioning=4 (team credit=2, additional components=2)') &&
      prompt.includes('preferred hard days=4, permitted=5'), prompt);
  ok('edge prompt carries stable planEntryIds and component ownership',
    edge.weeklyPlan.every((entry) => !!entry.planEntryId && prompt.includes(entry.planEntryId!)), prompt);
}

console.log('\n-- Constrained profiles retain or explicitly reduce exposure --');
const constrained: Array<{
  name: string;
  profile: OnboardingData;
  check: (plan: CoachingPlan) => boolean;
}> = [
  {
    name: 'five available days',
    profile: {
      ...EXACT_PROFILE,
      trainingDaysPerWeek: 5,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    check: (plan) => plan.preseasonExposureContract?.strength.targetCount === 4 &&
      plan.preseasonExposureContract?.conditioning.additionalRequiredCount === 2,
  },
  {
    name: 'four available days',
    profile: {
      ...EXACT_PROFILE,
      trainingDaysPerWeek: 4,
      preferredTrainingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    },
    check: (plan) => plan.preseasonExposureContract?.strength.targetCount === 4 &&
      plan.preseasonExposureContract?.conditioning.additionalRequiredCount === 2,
  },
  {
    name: 'one team-training day',
    profile: {
      ...EXACT_PROFILE,
      teamTrainingDaysPerWeek: 1,
      teamTrainingDays: ['Monday'],
    },
    check: (plan) => plan.preseasonExposureContract?.conditioning.creditedTeamTrainingCount === 1 &&
      plan.preseasonExposureContract?.conditioning.additionalRequiredCount === 3,
  },
  {
    name: 'three team-training days',
    profile: {
      ...EXACT_PROFILE,
      teamTrainingDaysPerWeek: 3,
      teamTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    },
    check: (plan) => plan.preseasonExposureContract?.conditioning.creditedTeamTrainingCount === 3 &&
      plan.preseasonExposureContract?.conditioning.additionalRequiredCount === 1,
  },
  {
    name: 'low readiness',
    profile: {
      ...EXACT_PROFILE,
      conditioningLevel: 'Poor',
      recentTrainingLoad: 'Hardly at all',
      sprintExposure: 'No sprint training',
    },
    check: (plan) => (plan.preseasonExposureContract?.strength.targetCount ?? 4) < 4 &&
      (plan.preseasonExposureContract?.reductions.some((entry) => entry.code === 'readiness_reduction') ?? false),
  },
  {
    name: 'lower-body injury restriction',
    profile: {
      ...EXACT_PROFILE,
      injuries: [{ bodyArea: 'hamstring', description: 'tear', severity: 'Severe' }],
    },
    check: (plan) => plan.preseasonExposureContract?.strength.requiredPatterns.every((pattern) =>
      pattern === 'push' || pattern === 'pull') === true &&
      (plan.preseasonExposureContract?.reductions.some((entry) => entry.code === 'injury_restriction') ?? false),
  },
];

for (const scenario of constrained) {
  const plan = planFor(scenario.profile, 2);
  assertContractSatisfied(scenario.name, plan);
  ok(`${scenario.name} uses the expected contract adjustment`, scenario.check(plan), plan.preseasonExposureContract);
}

{
  const build = planFor(EXACT_PROFILE, 3, 'build');
  const deload = planFor(EXACT_PROFILE, 4, 'deload');
  assertContractSatisfied('deload', deload);
  eq('deload preserves required strength-pattern coverage', plannedPatterns(deload), plannedPatterns(build));
  eq('deload preserves exposure counts while downstream policy reduces dose',
    {
      strength: deload.preseasonExposureContract?.strength.targetCount,
      conditioning: deload.preseasonExposureContract?.conditioning.targetCount,
    },
    {
      strength: build.preseasonExposureContract?.strength.targetCount,
      conditioning: build.preseasonExposureContract?.conditioning.targetCount,
    });
}

console.log(`\npreseasonExposureContractTests: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(`Failures: ${failures.join(', ')}`);
  process.exit(1);
}
