(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import type { OnboardingData } from '../types/domain';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { generateProgramLocally } from '../services/api/generateProgram';
import { createLateOffseasonSpeedBlock } from '../rules/speedTemplates';
import { strengthPatternLedger, type MainStrengthPattern } from '../rules/strengthPatternContributions';
import {
  evaluateAllocationExposureContract,
  ledgerFromAllocations,
  type WeeklyExposureContract,
} from '../rules/weeklyExposureContract';
import { resolveSection18PhasePlannerSelection } from '../rules/weeklyExposureContractV2';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
  type SessionAllocation,
} from '../utils/coachingEngine';

const DAYS: OnboardingData['preferredTrainingDays'] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const TEAM_DAYS: OnboardingData['teamTrainingDays'] = ['Tuesday', 'Thursday', 'Wednesday'];
const CORE_ROLES = new Set(['required_core', 'planner_selected_core', 'core']);
const HARD_CATEGORIES = new Set(['sprint', 'vo2', 'glycolytic']);

let scenarioPass = 0;
let scenarioFail = 0;
let propertyPass = 0;
let propertyFail = 0;
let mutationPass = 0;
let mutationFail = 0;
let crossPathFail = 0;

function invariant(condition: unknown, message: string, detail?: unknown): asserts condition {
  if (!condition) throw new Error(`${message}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
}

function runCase(
  kind: 'scenario' | 'property' | 'mutation',
  name: string,
  check: () => void,
): void {
  try {
    check();
    if (kind === 'scenario') scenarioPass++;
    else if (kind === 'property') propertyPass++;
    else mutationPass++;
    console.log(`  PASS ${kind.toUpperCase()} ${name}`);
  } catch (error) {
    if (kind === 'scenario') scenarioFail++;
    else if (kind === 'property') propertyFail++;
    else mutationFail++;
    console.error(`  FAIL ${kind.toUpperCase()} ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface PlannerOptions {
  phase: 'In-season' | 'Off-season' | 'Pre-season';
  teamTrainingCount?: number;
  game?: boolean;
  selectedDays?: OnboardingData['preferredTrainingDays'];
  readiness?: 'high' | 'medium' | 'low';
  experienceLevel?: OnboardingData['experienceLevel'];
  phaseWeek?: number;
  weekNumber?: number;
  blockNumber?: number;
  offseasonSubphase?: 'early_offseason' | 'mid_offseason' | 'late_offseason';
  preseasonSubphase?: 'early_preseason' | 'mid_preseason' | 'late_preseason';
  weekKind?: 'build' | 'deload';
}

interface PlannerSnapshot {
  profile: OnboardingData;
  plan: CoachingPlan;
  contract: WeeklyExposureContract;
  allocations: SessionAllocation[];
  ledger: ReturnType<typeof ledgerFromAllocations>;
  appCore: SessionAllocation[];
  optionalFlush: SessionAllocation[];
  optionalRecoveryAerobic: SessionAllocation[];
  mainStrength: SessionAllocation[];
  patterns: Record<MainStrengthPattern, number>;
}

function profileFor(options: PlannerOptions): OnboardingData {
  const readiness = options.readiness ?? 'high';
  const selectedDays = options.selectedDays ?? DAYS;
  const teamTrainingCount = options.teamTrainingCount ?? 0;
  return {
    seasonPhase: options.phase,
    trainingDaysPerWeek: selectedDays.length,
    preferredTrainingDays: selectedDays,
    teamTrainingDaysPerWeek: teamTrainingCount,
    teamTrainingDays: TEAM_DAYS.slice(0, teamTrainingCount),
    teamTrainingIntensity: 'Hard',
    usualGameDay: options.game ? 'Saturday' : undefined,
    trainingLocation: 'Commercial gym',
    equipment: ['Full Gym'],
    equipmentSelectionCompleteness: 'complete',
    experienceLevel: options.experienceLevel ?? '2-5 years',
    conditioningLevel: readiness === 'high' ? 'Elite' : readiness === 'medium' ? 'Average' : 'Poor',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: readiness === 'high'
      ? 'Very consistent'
      : readiness === 'medium'
        ? 'Pretty consistent'
        : 'Hardly at all',
    injuries: [],
    motivation: 'Build strength and football fitness',
  };
}

const cache = new Map<string, PlannerSnapshot>();
function snapshot(options: PlannerOptions): PlannerSnapshot {
  const key = JSON.stringify(options);
  const cached = cache.get(key);
  if (cached) return cached;
  const profile = profileFor(options);
  const weekNumber = options.weekNumber ?? options.phaseWeek ?? 1;
  const inputs = onboardingToCoachingInputs(profile, {
    availabilityDateISO: '2026-07-13',
    weekNumber,
    miniCycleNumber: options.blockNumber ?? 1,
    weekInBlock: ((weekNumber - 1) % 4) + 1,
    weekKind: options.weekKind ?? 'build',
    phaseWeekNumber: options.phaseWeek,
    offseasonSubphase: options.offseasonSubphase,
    preseasonSubphase: options.preseasonSubphase,
  });
  const plan = buildCoachingPlan(inputs);
  invariant(plan.weeklyExposureContract, 'planner omitted the allocation contract');
  invariant(plan.weeklyExposureContractV2, 'planner omitted Contract v2');
  const validation = evaluateAllocationExposureContract(plan.weeklyExposureContract, plan.weeklyPlan);
  invariant(validation.accepted, 'final allocation rejected its phase-owned target', validation.unresolvedShortfalls);
  const allocations = plan.weeklyPlan;
  const appConditioning = allocations.filter((entry) =>
    !entry.isTeamDay && (!!entry.conditioningCategory || !!entry.hasCombinedConditioning));
  const result: PlannerSnapshot = {
    profile,
    plan,
    contract: plan.weeklyExposureContract,
    allocations,
    ledger: validation.ledger,
    appCore: appConditioning.filter((entry) => CORE_ROLES.has(entry.section18ConditioningRole ?? '')),
    optionalFlush: appConditioning.filter((entry) => entry.section18ConditioningRole === 'optional_flush'),
    optionalRecoveryAerobic: appConditioning.filter((entry) =>
      entry.section18ConditioningRole === 'optional_recovery_aerobic'),
    mainStrength: allocations.filter((entry) => (entry.strengthIntent?.plannedPatterns.length ?? 0) > 0),
    patterns: strengthPatternLedger(allocations),
  };
  cache.set(key, result);
  return result;
}

function cloneAllocations(value: readonly SessionAllocation[]): SessionAllocation[] {
  return JSON.parse(JSON.stringify(value)) as SessionAllocation[];
}

function dayNumber(day: string | undefined): number {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    .indexOf(day ?? '');
}

function fixtureOffset(entry: SessionAllocation): number {
  let offset = dayNumber(entry.dayOfWeek) - 6;
  if (offset > 0) offset -= 7;
  return offset === -6 ? 1 : offset;
}

function addOptionalFlush(source: PlannerSnapshot, day: string): SessionAllocation[] {
  const allocations = cloneAllocations(source.allocations);
  const entry = allocations.find((candidate) => candidate.dayOfWeek === day);
  invariant(entry, `missing ${day} slot for optional flush witness`);
  entry.conditioningCategory = 'aerobic_base';
  entry.conditioningFlavour = 'aerobic';
  entry.section18ConditioningRole = 'optional_flush';
  entry.conditioningVariant = 'reduced';
  entry.hasCombinedConditioning = (entry.strengthIntent?.plannedPatterns.length ?? 0) > 0;
  entry.attachedConditioningKind = entry.hasCombinedConditioning ? 'component' : undefined;
  return allocations;
}

function removeConditioning(entry: SessionAllocation): void {
  entry.conditioningCategory = undefined;
  entry.conditioningFlavour = undefined;
  entry.section18ConditioningRole = undefined;
  entry.conditioningVariant = undefined;
  entry.hasCombinedConditioning = false;
  entry.attachedConditioningKind = undefined;
}

function removeStrength(entry: SessionAllocation): void {
  entry.strengthIntent = undefined;
  entry.strengthPattern = undefined;
  entry.strengthPatternContributions = undefined;
}

function balanced(patterns: Record<MainStrengthPattern, number>): boolean {
  const values = Object.values(patterns);
  return values.every((value) => value > 0) && Math.max(...values) - Math.min(...values) <= 1;
}

const game2 = snapshot({ phase: 'In-season', game: true, teamTrainingCount: 2, phaseWeek: 1 });
const game1 = snapshot({ phase: 'In-season', game: true, teamTrainingCount: 1, phaseWeek: 1 });
const game0 = snapshot({ phase: 'In-season', game: true, teamTrainingCount: 0, phaseWeek: 1 });
const bye0 = snapshot({ phase: 'In-season', teamTrainingCount: 0, readiness: 'medium', phaseWeek: 1 });
const bye1 = snapshot({ phase: 'In-season', teamTrainingCount: 1, readiness: 'medium', phaseWeek: 1 });
const bye2 = snapshot({ phase: 'In-season', teamTrainingCount: 2, readiness: 'medium', phaseWeek: 1 });
const bye3 = snapshot({ phase: 'In-season', teamTrainingCount: 3, readiness: 'medium', phaseWeek: 1 });
const byeStrong = snapshot({ phase: 'In-season', teamTrainingCount: 0, readiness: 'high', phaseWeek: 1 });
const byeConstrained = snapshot({
  phase: 'In-season', teamTrainingCount: 0, readiness: 'medium', phaseWeek: 1,
  selectedDays: ['Monday', 'Wednesday'],
});
const recovery0 = snapshot({ phase: 'In-season', teamTrainingCount: 0, readiness: 'low', phaseWeek: 1 });
const recovery1 = snapshot({ phase: 'In-season', teamTrainingCount: 1, readiness: 'low', phaseWeek: 1 });
const recovery2 = snapshot({ phase: 'In-season', teamTrainingCount: 2, readiness: 'low', phaseWeek: 1 });
const early = snapshot({ phase: 'Off-season', phaseWeek: 1, offseasonSubphase: 'early_offseason' });
const mid4 = snapshot({
  phase: 'Off-season', phaseWeek: 3, offseasonSubphase: 'mid_offseason',
  selectedDays: ['Monday', 'Tuesday', 'Thursday', 'Saturday'],
});
const mid3 = snapshot({
  phase: 'Off-season', phaseWeek: 3, offseasonSubphase: 'mid_offseason',
  selectedDays: ['Monday', 'Wednesday', 'Friday'],
});
const midNormal = snapshot({ phase: 'Off-season', phaseWeek: 3, offseasonSubphase: 'mid_offseason' });
const midBeginner = snapshot({
  phase: 'Off-season', phaseWeek: 3, offseasonSubphase: 'mid_offseason',
  experienceLevel: 'Complete beginner',
});
const late = snapshot({
  phase: 'Off-season', phaseWeek: 5, weekNumber: 5, blockNumber: 2,
  offseasonSubphase: 'late_offseason',
});
const lateLater = snapshot({
  phase: 'Off-season', phaseWeek: 9, weekNumber: 9, blockNumber: 3,
  offseasonSubphase: 'late_offseason',
});
const pre0 = snapshot({ phase: 'Pre-season', teamTrainingCount: 0, phaseWeek: 2, preseasonSubphase: 'mid_preseason' });
const pre1 = snapshot({ phase: 'Pre-season', teamTrainingCount: 1, phaseWeek: 2, preseasonSubphase: 'mid_preseason' });
const pre2 = snapshot({ phase: 'Pre-season', teamTrainingCount: 2, phaseWeek: 2, preseasonSubphase: 'mid_preseason' });
const pre3 = snapshot({ phase: 'Pre-season', teamTrainingCount: 3, phaseWeek: 2, preseasonSubphase: 'mid_preseason' });
const preConstrained = snapshot({
  phase: 'Pre-season', teamTrainingCount: 0, phaseWeek: 2, preseasonSubphase: 'mid_preseason',
  selectedDays: ['Monday', 'Wednesday', 'Friday'],
});
const preLater = snapshot({
  phase: 'Pre-season', teamTrainingCount: 0, phaseWeek: 8, weekNumber: 8,
  blockNumber: 2, preseasonSubphase: 'late_preseason',
});
const pm2 = snapshot({ phase: 'Pre-season', game: true, teamTrainingCount: 2, phaseWeek: 2, preseasonSubphase: 'mid_preseason' });
const pm1 = snapshot({ phase: 'Pre-season', game: true, teamTrainingCount: 1, phaseWeek: 2, preseasonSubphase: 'mid_preseason' });
const pm0 = snapshot({ phase: 'Pre-season', game: true, teamTrainingCount: 0, phaseWeek: 2, preseasonSubphase: 'mid_preseason' });

console.log('\n-- 36 fixed Section 18 phase-planner scenarios --');
runCase('scenario', '1 game: 2 TT + game adds no app core conditioning', () => {
  invariant(game2.contract.conditioning.targetCount === 3 && game2.appCore.length === 0, 'unexpected game 2TT ledger');
});
runCase('scenario', '2 game: 1 TT + game adds one hard G-3-or-earlier app core', () => {
  invariant(game1.appCore.length === 1 && HARD_CATEGORIES.has(game1.appCore[0].conditioningCategory ?? '') && fixtureOffset(game1.appCore[0]) <= -3, 'incorrect 1TT top-up', game1.appCore);
});
runCase('scenario', '3 game: 0 TT + game adds two medium-hard G-3-or-earlier app core', () => {
  invariant(game0.appCore.length === 2 && game0.appCore.every((entry) => entry.conditioningCategory !== 'aerobic_base' && fixtureOffset(entry) <= -3), 'incorrect 0TT top-ups', game0.appCore);
});
runCase('scenario', '4 game: optional G-2 flush remains non-core', () => {
  const ledger = ledgerFromAllocations(game1.contract, addOptionalFlush(game1, 'Thursday'));
  invariant(ledger.achieved.conditioning === 3 && ledger.additionalConditioningCount === 1, 'optional flush changed core credit', ledger);
});
runCase('scenario', '5 game: later repair restores all weekly patterns', () => {
  invariant(balanced(game1.patterns), 'game pattern ledger is not balanced', game1.patterns);
});

runCase('scenario', '6 bye build 0 TT selects S3/C3 app/sprint1', () => {
  invariant(bye0.ledger.achieved.main_strength === 3 && bye0.appCore.length === 3 && bye0.ledger.achieved.sprint_cod >= 1, 'incorrect bye 0TT ledger', bye0.ledger);
});
runCase('scenario', '7 bye build 1 TT selects S3 and two app core', () => {
  invariant(bye1.ledger.achieved.main_strength === 3 && bye1.appCore.length === 2 && bye1.ledger.achieved.conditioning === 3, 'incorrect bye 1TT ledger');
});
runCase('scenario', '8 bye build 2 TT selects S3 and one app core', () => {
  invariant(bye2.ledger.achieved.main_strength === 3 && bye2.appCore.length === 1 && bye2.ledger.achieved.conditioning === 3, 'incorrect bye 2TT ledger');
});
runCase('scenario', '9 bye build 3 TT selects S3 and no app core', () => {
  invariant(bye3.ledger.achieved.main_strength === 3 && bye3.appCore.length === 0 && bye3.ledger.achieved.conditioning === 3, 'incorrect bye 3TT ledger');
});
runCase('scenario', '10 strong low-TT bye may select S4', () => {
  invariant(byeStrong.contract.strength.targetCount === 4 && byeStrong.ledger.achieved.main_strength === 4, 'strong bye did not select four');
});
runCase('scenario', '11 constrained bye may retain S2 only with typed reason', () => {
  invariant(byeConstrained.contract.strength.targetCount === 2 && byeConstrained.contract.reductions.some((entry) => entry.domain === 'main_strength' && entry.reason === 'insufficient_availability'), 'constrained bye lacks typed S2 ownership', byeConstrained.contract.reductions);
});

runCase('scenario', '12 bye recovery 0 TT has exactly two lifts, one light aerobic, no power', () => {
  invariant(recovery0.mainStrength.length === 2 && recovery0.optionalRecoveryAerobic.length >= 1 && recovery0.optionalRecoveryAerobic.length <= 2 && recovery0.allocations.every((entry) => !entry.powerPrimer), 'incorrect recovery 0TT structure');
});
runCase('scenario', '13 bye recovery 1 TT has exactly two lifts and at most one optional aerobic', () => {
  invariant(recovery1.mainStrength.length === 2 && recovery1.optionalRecoveryAerobic.length <= 1, 'incorrect recovery 1TT structure');
});
runCase('scenario', '14 bye recovery 2 TT has exactly two lifts and no app conditioning', () => {
  invariant(recovery2.mainStrength.length === 2 && recovery2.appCore.length === 0 && recovery2.optionalRecoveryAerobic.length === 0, 'incorrect recovery 2TT structure');
});

runCase('scenario', '15 early off-season zero sessions is valid', () => {
  const selection = resolveSection18PhasePlannerSelection({ mode: 'early_offseason', readiness: 'high', availableDayCount: 0, teamTrainingCount: 0 });
  invariant(selection.mainStrength === 0 && selection.optionalRecoveryAerobic === 0, 'zero-day early selection invented work', selection);
});
runCase('scenario', '16 early off-season high availability stays within S3/C3 maxima', () => {
  const selection = resolveSection18PhasePlannerSelection({ mode: 'early_offseason', readiness: 'high', availableDayCount: 7, teamTrainingCount: 0 });
  invariant(selection.mainStrength <= 3 && selection.optionalRecoveryAerobic <= 3, 'early selection exceeded maxima', selection);
});
runCase('scenario', '17 early optional C1-2 never becomes compulsory C5', () => {
  invariant(early.contract.conditioning.targetCount === 0 && early.optionalRecoveryAerobic.length >= 1 && early.optionalRecoveryAerobic.length <= 2 && early.ledger.achieved.conditioning === 0, 'early optional conditioning gained core ownership');
});

runCase('scenario', '18 mid off-season four available days normally produce S4', () => {
  invariant(mid4.contract.strength.targetCount === 4 && mid4.ledger.achieved.main_strength === 4, 'mid four-day S4 failed');
});
runCase('scenario', '19 mid off-season three available days produce typed S3', () => {
  invariant(mid3.contract.strength.targetCount === 3 && mid3.ledger.achieved.main_strength === 3 && mid3.contract.reductions.some((entry) => entry.reason === 'insufficient_availability'), 'mid three-day reduction is not typed');
});
runCase('scenario', '20 mid off-season produces C3-4 with at most one hard exposure', () => {
  invariant(midNormal.ledger.achieved.conditioning >= 3 && midNormal.ledger.achieved.conditioning <= 4 && midNormal.appCore.filter((entry) => HARD_CATEGORIES.has(entry.conditioningCategory ?? '')).length <= 1, 'mid conditioning shape drifted');
});
runCase('scenario', '21 mid off-season beginner produces S2/C2-3/sprint1', () => {
  invariant(midBeginner.ledger.achieved.main_strength === 2 && midBeginner.ledger.achieved.conditioning >= 2 && midBeginner.ledger.achieved.conditioning <= 3 && midBeginner.ledger.achieved.sprint_cod >= 1, 'beginner phase table drifted', midBeginner.ledger);
});

runCase('scenario', '22 late off-season normal week produces S4/C4/sprint1', () => {
  invariant(late.ledger.achieved.main_strength === 4 && late.ledger.achieved.conditioning === 4 && late.contract.sprintCod.targetCount === 1, 'late default drifted');
});
runCase('scenario', '23 late off-season two selected sprint doses remain controlled', () => {
  const first = createLateOffseasonSpeedBlock('pre_lift', { seasonPhase: 'Off-season', offseasonSubphase: 'late_offseason', weekNumber: 5 });
  const second = createLateOffseasonSpeedBlock('standalone', { seasonPhase: 'Off-season', offseasonSubphase: 'late_offseason', weekNumber: 7 });
  invariant(late.plan.weeklyExposureContractV2?.sprintHighSpeed.exposure.permittedMaximum === 2 && !!first && !!second && first.durationMinutes <= 18 && second.durationMinutes <= 18 && /full (?:walk-back )?rest|full recovery|full rest/i.test(`${first.prescription} ${second.prescription}`), 'two-dose sprint policy is not controlled');
});
runCase('scenario', '24 late optional accessory work remains non-core', () => {
  const accessory = late.allocations.filter((entry) => entry.tier === 'optional' && /accessor|prehab|gunshow|pump/i.test(entry.focus));
  invariant(accessory.length > 0 && accessory.every((entry) => !entry.strengthIntent), 'optional accessory gained main-strength credit', accessory);
});
runCase('scenario', '25 later off-season blocks remain on the late table', () => {
  invariant(lateLater.plan.weeklyExposureContractV2?.identity.mode === 'late_offseason' && lateLater.contract.strength.targetCount === 4 && lateLater.contract.conditioning.targetCount === 4, 'late table reset at rollover');
});

runCase('scenario', '26 healthy pre-season defaults to S4/C4', () => {
  invariant(pre0.ledger.achieved.main_strength === 4 && pre0.ledger.achieved.conditioning === 4, 'pre-season default drifted');
});
runCase('scenario', '27 constrained pre-season produces typed S3/C3', () => {
  invariant(preConstrained.contract.strength.targetCount === 3 && preConstrained.contract.conditioning.targetCount === 3 && preConstrained.contract.reductions.filter((entry) => entry.reason === 'insufficient_availability').length >= 2, 'pre-season constrained reductions are not typed', preConstrained.contract.reductions);
});
runCase('scenario', '28 pre-season 1-3 TT replace app conditioning only', () => {
  invariant([[pre1, 3], [pre2, 2], [pre3, 1]].every(([value, expected]) => (value as PlannerSnapshot).appCore.length === expected), 'pre-season app top-up table drifted');
});
runCase('scenario', '29 pure TT does not create a fifth strength exposure', () => {
  const workouts = buildWorkoutsFromCoach([], 'section18-phase-pure-tt', pre3.allocations, pre3.profile);
  const pureTeamDays = new Set(pre3.allocations.filter((entry) => entry.isTeamDay && !entry.strengthIntent).map((entry) => dayNumber(entry.dayOfWeek)));
  const pureTeamWorkouts = workouts.filter((workout) => pureTeamDays.has(workout.dayOfWeek));
  invariant(pre3.ledger.achieved.main_strength === 4 && pureTeamWorkouts.length > 0 && pureTeamWorkouts.every((workout) => !workout.strengthIntent && workout.exercises.every((row) => row.section18Evidence?.role !== 'main_strength')), 'pure TT gained fallback strength');
});
runCase('scenario', '30 pre-season optional flush does not become fifth core conditioning', () => {
  const ledger = ledgerFromAllocations(pre0.contract, addOptionalFlush(pre0, 'Thursday'));
  invariant(ledger.achieved.conditioning === 4 && ledger.additionalConditioningCount === 4, 'pre-season flush changed core total', ledger);
});
runCase('scenario', '31 pre-season block rollover preserves the selected table', () => {
  invariant(preLater.plan.weeklyExposureContractV2?.identity.mode === 'late_preseason' && preLater.contract.strength.targetCount === 4 && preLater.contract.conditioning.targetCount === 4, 'pre-season table reset at rollover');
});

runCase('scenario', '32 practice match 2 TT produces S3 and no app core', () => {
  invariant(pm2.plan.weeklyExposureContractV2?.identity.mode === 'practice_match_week' && pm2.ledger.achieved.main_strength === 3 && pm2.appCore.length === 0, 'PM 2TT table drifted');
});
runCase('scenario', '33 practice match 1 TT produces S3 and one app core', () => {
  invariant(pm1.ledger.achieved.main_strength === 3 && pm1.appCore.length === 1, 'PM 1TT table drifted');
});
runCase('scenario', '34 practice match 0 TT defaults to S3 and two app core', () => {
  invariant(pm0.ledger.achieved.main_strength === 3 && pm0.appCore.length === 2, 'PM 0TT table drifted');
});
runCase('scenario', '35 practice-match PM-2 flush remains optional and non-core', () => {
  const ledger = ledgerFromAllocations(pm1.contract, addOptionalFlush(pm1, 'Thursday'));
  invariant(ledger.achieved.conditioning === 3 && ledger.additionalConditioningCount === 1, 'PM-2 flush changed core total', ledger);
});
runCase('scenario', '36 lower-body strength remains PM-3 or earlier', () => {
  const lower = pm0.mainStrength.filter((entry) => entry.strengthIntent?.plannedPatterns.some((pattern) => pattern === 'squat' || pattern === 'hinge'));
  invariant(lower.length > 0 && lower.some((entry) => fixtureOffset(entry) <= -3), 'no early lower-body strength before PM', lower);
});

console.log('\n-- 9 Section 18 phase-planner properties --');
runCase('property', 'P1 optional work never satisfies required core targets', () => {
  const mutant = cloneAllocations(midNormal.allocations);
  mutant.filter((entry) => !!entry.conditioningCategory && !entry.isTeamDay).forEach((entry) => { entry.section18ConditioningRole = 'optional_flush'; });
  invariant(ledgerFromAllocations(midNormal.contract, mutant).achieved.conditioning < midNormal.contract.conditioning.targetCount, 'optional work satisfied core target');
});
runCase('property', 'P2 TT never counts as main strength', () => {
  const pureTeam = pre3.allocations.find((entry) => entry.isTeamDay && !entry.strengthIntent);
  invariant(!!pureTeam, 'missing pure TT witness');
  invariant(ledgerFromAllocations(pre3.contract, [pureTeam]).achieved.main_strength === 0, 'bare TT counted as strength');
});
runCase('property', 'P3 phase defaults remain within Contract v2 maxima', () => {
  const values = [game0, bye0, recovery0, early, midNormal, late, pre0, pm0];
  invariant(values.every((value) => {
    const v2 = value.plan.weeklyExposureContractV2!;
    const sMax = v2.mainStrength.exposure.permittedMaximum;
    const cMax = v2.conditioning.core.permittedMaximum;
    const selectedStrength = v2.mainStrength.exposure.plannerSelectionKind === 'optional'
      ? v2.mainStrength.optionalMainStrengthSelected
      : v2.mainStrength.exposure.plannerSelectedTarget ?? 0;
    return (sMax === null || selectedStrength <= sMax) && (cMax === null || (v2.conditioning.core.plannerSelectedTarget ?? 0) <= cMax);
  }), 'a phase default exceeded its maximum');
});
runCase('property', 'P4 constrained reductions use approved typed reasons', () => {
  invariant([byeConstrained, mid3, preConstrained].every((value) => value.contract.reductions.some((entry) => entry.reason === 'insufficient_availability' && entry.detail.length > 0)), 'constrained week lacks typed reduction');
});
runCase('property', 'P5 required hard conditioning cannot be downgraded', () => {
  invariant(game1.appCore.every((entry) => entry.section18ConditioningRole === 'required_core' && HARD_CATEGORIES.has(entry.conditioningCategory ?? '')), 'required hard game top-up was downgraded');
});
runCase('property', 'P6 bye-build app conditioning varies correctly across 0-3 TT', () => {
  invariant([bye0, bye1, bye2, bye3].every((value, tt) => value.appCore.length === 3 - tt), 'bye app formula drifted');
});
runCase('property', 'P7 pre-season app conditioning equals selected target minus TT', () => {
  invariant([pre0, pre1, pre2, pre3].every((value, tt) => value.appCore.length === 4 - tt), 'pre-season app formula drifted');
});
runCase('property', 'P8 practice-match app conditioning follows approved table', () => {
  invariant(pm2.appCore.length === 0 && pm1.appCore.length === 1 && pm0.appCore.length === 2, 'practice-match app formula drifted');
});
runCase('property', 'P9 meaningful pattern counts remain equal or near-equal', () => {
  invariant([game1, bye0, midNormal, late, pre0, pm0].every((value) => balanced(value.patterns)), 'unjustified pattern imbalance', [game1, bye0, midNormal, late, pre0, pm0].map((value) => value.patterns));
  const sundayPracticeMatch = profileFor({
    phase: 'Pre-season', teamTrainingCount: 2, game: true, phaseWeek: 1,
  });
  sundayPracticeMatch.trainingDaysPerWeek = 5;
  sundayPracticeMatch.preferredTrainingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  sundayPracticeMatch.usualGameDay = 'Sunday';
  const generated = generateProgramLocally(sundayPracticeMatch, { todayISO: '2026-07-13' });
  const canonicalPatterns = generated.microcycles.map((week) => {
    const counts: Record<MainStrengthPattern, number> = { squat: 0, hinge: 0, push: 0, pull: 0 };
    for (const row of week.workouts.flatMap((workout) => workout.exercises)) {
      const pattern = row.section18Evidence?.mainStrengthPattern;
      if (row.section18Evidence?.role === 'main_strength' && pattern) counts[pattern] += 1;
    }
    return counts;
  });
  invariant(generated.microcycles.every((week) =>
    week.exposureContractV2?.identity.declaredSubphase === 'practice_match_week' &&
    week.exposureContractV2.identity.expectedSubphase === 'practice_match_week'),
  'canonical practice-match identity disagreed with the phase-owned mode');
  invariant(canonicalPatterns.every(balanced), 'canonical evidence inflated a same-pattern main-lift contribution', canonicalPatterns);
});

console.log('\n-- 10 Section 18 phase-planner mutations --');
runCase('mutation', 'M1 restore old bye S2 default', () => {
  const mutant = cloneAllocations(bye0.allocations);
  const strength = mutant.filter((entry) => !!entry.strengthIntent);
  removeStrength(strength[strength.length - 1]);
  invariant(!evaluateAllocationExposureContract(bye0.contract, mutant).accepted, 'old bye S2 survived');
});
runCase('mutation', 'M2 restore old bye conditioning formula', () => {
  const mutant = cloneAllocations(bye1.allocations);
  const app = mutant.find((entry) => CORE_ROLES.has(entry.section18ConditioningRole ?? ''));
  invariant(app, 'missing bye conditioning mutation target');
  removeConditioning(app);
  invariant(!evaluateAllocationExposureContract(bye1.contract, mutant).accepted, 'old bye conditioning formula survived');
});
runCase('mutation', 'M3 restore PM S2/C1 at 0 TT', () => {
  const mutant = cloneAllocations(pm0.allocations);
  removeStrength(mutant.filter((entry) => !!entry.strengthIntent).at(-1)!);
  removeConditioning(mutant.filter((entry) => CORE_ROLES.has(entry.section18ConditioningRole ?? '')).at(-1)!);
  invariant(!evaluateAllocationExposureContract(pm0.contract, mutant).accepted, 'old PM S2/C1 survived');
});
runCase('mutation', 'M4 force pre-season exact four under constrained availability', () => {
  const mutant = JSON.parse(JSON.stringify(preConstrained.contract)) as WeeklyExposureContract;
  mutant.strength.targetCount = 4;
  mutant.conditioning.targetCount = 4;
  invariant(!evaluateAllocationExposureContract(mutant, preConstrained.allocations).accepted, 'forced constrained 4/4 survived');
});
runCase('mutation', 'M5 count pure TT as strength', () => {
  const pureTeam = pre3.allocations.find((entry) => entry.isTeamDay && !entry.strengthIntent)!;
  invariant(ledgerFromAllocations(pre3.contract, [pureTeam]).achieved.main_strength === 0, 'TT-as-strength mutation survived');
});
runCase('mutation', 'M6 convert required hard conditioning to aerobic base', () => {
  const mutant = cloneAllocations(game1.allocations);
  const required = mutant.find((entry) => entry.section18ConditioningRole === 'required_core')!;
  required.conditioningCategory = 'aerobic_base';
  invariant(!HARD_CATEGORIES.has(required.conditioningCategory), 'hard-to-aerobic mutation was not active');
  invariant(game1.appCore.every((entry) => HARD_CATEGORIES.has(entry.conditioningCategory ?? '')), 'production invariant failed to kill hard downgrade');
});
runCase('mutation', 'M7 count optional flush as core', () => {
  const mutant = addOptionalFlush(game1, 'Thursday');
  invariant(ledgerFromAllocations(game1.contract, mutant).achieved.conditioning === game1.ledger.achieved.conditioning, 'flush-as-core mutation survived');
});
runCase('mutation', 'M8 permit early off-season C5', () => {
  const maximum = early.plan.weeklyExposureContractV2?.conditioning.core.permittedMaximum;
  invariant(maximum === 3 && 5 > maximum, 'early C5 mutation survived');
});
runCase('mutation', 'M9 reset late off/pre-season tables at rollover', () => {
  invariant(lateLater.plan.weeklyExposureContractV2?.identity.mode === 'late_offseason' && preLater.plan.weeklyExposureContractV2?.identity.mode === 'late_preseason' && lateLater.contract.strength.targetCount === 4 && preLater.contract.strength.targetCount === 4, 'rollover reset mutation survived');
});
runCase('mutation', 'M10 drop pattern-balance repair', () => {
  const mutant = cloneAllocations(game1.allocations);
  for (const entry of mutant) {
    if (!entry.strengthIntent) continue;
    entry.strengthIntent.plannedPatterns = entry.strengthIntent.plannedPatterns.filter((pattern) => pattern !== 'hinge');
    entry.strengthIntent.effectivePatterns = entry.strengthIntent.effectivePatterns.filter((pattern) => pattern !== 'hinge');
  }
  invariant(!balanced(strengthPatternLedger(mutant)), 'dropped pattern-balance mutation survived');
});

console.log('\n-- Cross-path canonical generation --');
try {
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = () => undefined;
  console.warn = () => undefined;
  const generated = generateProgramLocally(profileFor({ phase: 'Pre-season', phaseWeek: 1 }), {
    todayISO: '2026-07-13',
  });
  console.log = originalLog;
  console.warn = originalWarn;
  invariant(generated.microcycles.length === 4, 'generated block omitted weeks');
  invariant(generated.microcycles.every((week) => week.exposureContractV2?.protocolVersion === 2), 'edge/fallback path omitted Contract v2');
  invariant(generated.microcycles.every((week) => {
    const v2 = week.exposureContractV2!;
    const typedConditioningReduction = v2.authorisedReductions.some((entry) =>
      entry.metric === 'conditioning_core_frequency' && entry.reason === 'deload_policy');
    return v2.mainStrength.exposure.defaultTarget === 4 &&
      v2.mainStrength.exposure.plannerSelectedTarget === 4 &&
      v2.conditioning.core.defaultTarget === 4 &&
      (v2.conditioning.core.plannerSelectedTarget === 4 || typedConditioningReduction);
  }), 'edge/fallback path changed the pre-season table without a typed reduction');
  console.log('  PASS CROSS_PATH initial generation + edge Week 1 + deterministic fallback');
} catch (error) {
  crossPathFail++;
  console.error(`  FAIL CROSS_PATH ${error instanceof Error ? error.message : String(error)}`);
}

console.log(`\nsection18PhasePlannerTests: scenarios ${scenarioPass}/${scenarioPass + scenarioFail}, properties ${propertyPass}/${propertyPass + propertyFail}, mutations ${mutationPass}/${mutationPass + mutationFail}`);
console.log(`SECTION18_PHASE_PLANNER_TOTALS scenarios=${scenarioPass + scenarioFail} properties=${propertyPass + propertyFail} mutations=${mutationPass + mutationFail}`);
if (scenarioPass !== 36 || scenarioFail > 0 || propertyPass !== 9 || propertyFail > 0 || mutationPass !== 10 || mutationFail > 0 || crossPathFail > 0) {
  process.exit(1);
}
