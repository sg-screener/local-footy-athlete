import type { OnboardingData } from '../../../types/domain';
import { buildWorkoutsFromCoach } from '../../../data/defaultProgram';
import { buildCoachingPlan, onboardingToCoachingInputs } from '../../../utils/coachingEngine';
import { resolveEquipmentAvailability } from '../../../utils/equipmentAvailability';
import { canonicalWeekLedger } from './buildCanonicalPathLedger';
import type { GeneratedCheckResult, PairwiseScenario } from '../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function profileFor(scenario: PairwiseScenario): OnboardingData {
  const phase = scenario.phase === 'in_season'
    ? 'In-season'
    : scenario.phase.includes('preseason') ? 'Pre-season' : 'Off-season';
  const preferredTrainingDays = DAYS.slice(0, scenario.availability);
  const teamTrainingDays = scenario.teamSessions === 0
    ? [] : scenario.teamSessions === 1 ? ['Tuesday'] as const : ['Tuesday', 'Thursday'] as const;
  const gameDay = scenario.game === 'saturday' ? 'Saturday'
    : scenario.game === 'sunday' ? 'Sunday' : undefined;
  const recentTrainingLoad = scenario.readiness === 'low' ? 'Hardly at all'
    : scenario.readiness === 'high' ? 'Very consistent' : 'Pretty consistent';
  const conditioningLevel = scenario.readiness === 'low' ? 'Poor'
    : scenario.readiness === 'high' ? 'Good' : 'Average';
  const injuries = scenario.restriction === 'none' ? [] : [{
    bodyArea: scenario.restriction === 'hamstring' ? 'Hamstring' : 'Shoulder',
    description: `Representative ${scenario.restriction} restriction`,
    severity: 'Moderate' as const,
    whenItHurts: 'Both' as const,
  }];
  const trainingLocation = scenario.equipment === 'commercial' ? 'Commercial gym'
    : scenario.equipment === 'home' ? 'Home gym' : 'Outdoor';
  const equipment = scenario.equipment === 'commercial' ? ['Full Gym']
    : scenario.equipment === 'home' ? ['Dumbbells', 'Bands', 'Bench'] : ['Bodyweight Only'];
  return {
    firstName: 'Pairwise', ageRange: '26-30',
    position: scenario.role === 'inside' ? 'inside_mid' : 'outside_runner',
    motivation: scenario.goal === 'strength' ? 'Build Strength' : 'Improve Speed, Improve Fitness',
    goals: scenario.goal === 'strength' ? ['Build Strength'] : ['Improve Speed', 'Improve Fitness'],
    experienceLevel: scenario.experience === 'beginner' ? 'Complete beginner' : '2-5 years',
    squatStrength: scenario.experience === 'beginner' ? "I don't squat" : '1.5x bodyweight',
    benchStrength: scenario.experience === 'beginner' ? "I don't bench" : 'Around bodyweight',
    conditioningLevel, sprintExposure: scenario.experience === 'beginner' ? 'No sprint training' : 'Occasionally',
    recentTrainingLoad, injuries, seasonPhase: phase,
    trainingDaysPerWeek: scenario.availability,
    preferredTrainingDays: [...preferredTrainingDays],
    teamTrainingDaysPerWeek: scenario.teamSessions,
    teamTrainingDays: [...teamTrainingDays], teamTrainingIntensity: 'Hard',
    teamTrainingDuration: '90 minutes', usualGameDay: gameDay, gameDay,
    sessionDurationMinutes: scenario.duration === 'short' ? 30 : scenario.duration === 'long' ? 90 : 60,
    trainingLocation, equipment,
  };
}

function weekForPhase(phase: PairwiseScenario['phase']): number {
  if (phase === 'early_offseason' || phase === 'early_preseason') return 1;
  if (phase === 'mid_offseason') return 2;
  if (phase === 'late_offseason' || phase === 'later_preseason') return 4;
  return 1;
}

export function evaluatePairwiseScenario(scenario: PairwiseScenario): GeneratedCheckResult[] {
  const profile = profileFor(scenario);
  const week = weekForPhase(scenario.phase);
  const inputs = onboardingToCoachingInputs(profile, {
    availabilityDateISO: scenario.referenceDate,
    weekInBlock: week,
    weekNumber: week,
    miniCycleNumber: week,
    weekKind: week === 4 ? 'deload' : 'build',
    offseasonSubphase: scenario.phase === 'early_offseason' ? 'early_offseason'
      : scenario.phase === 'mid_offseason' ? 'mid_offseason'
        : scenario.phase === 'late_offseason' ? 'late_offseason' : undefined,
    preseasonSubphase: scenario.phase === 'early_preseason' ? 'early_preseason'
      : scenario.phase === 'later_preseason' ? 'late_preseason' : undefined,
  });
  const plan = buildCoachingPlan(inputs);
  const workouts = buildWorkoutsFromCoach(
    [], `pairwise:${scenario.id}`, plan.weeklyPlan, profile,
    { miniCycleNumber: week, weekInBlock: week, weekStartISO: scenario.referenceDate, weekKind: week === 4 ? 'deload' : 'build' },
    { availableEquipment: resolveEquipmentAvailability(profile, [], scenario.referenceDate) },
  );
  const ledger = canonicalWeekLedger(workouts);
  const allocationIds = plan.weeklyPlan.map((entry) => entry.planEntryId ?? '').filter(Boolean);
  const workoutIds = ledger.workouts.map((entry) => entry.planEntryId).filter(Boolean);
  const uniqueAllocation = new Set(allocationIds).size === allocationIds.length;
  const uniqueWorkouts = new Set(workoutIds).size === workoutIds.length;
  const allJoined = workoutIds.every((id) => allocationIds.includes(id));
  const subset = ledger.workouts.every((entry) =>
    entry.effectivePatterns.every((pattern) => entry.plannedPatterns.includes(pattern)));
  return [
    {
      id: `${scenario.id}:stable-join`, domain: 'placement',
      ruleIds: ['ALL-PATH-EQUIV-01', 'ALL-MOVE-IDENTITY-01'],
      invariant: 'PAIRWISE_PLAN_ENTRY_JOIN', passed: uniqueAllocation && uniqueWorkouts && allJoined,
      stage: 'generated_fallback', expected: 'unique allocation-owned planEntryId joins',
      actual: { uniqueAllocation, uniqueWorkouts, allJoined },
    },
    {
      id: `${scenario.id}:effective-subset`, domain: 'strength',
      ruleIds: ['ALL-STR-BLOCK-01'], invariant: 'PAIRWISE_EFFECTIVE_SUBSET', passed: subset,
      stage: 'generated_fallback', expected: 'effective patterns subset of planned patterns',
      actual: ledger.workouts.map((entry) => ({ id: entry.planEntryId, planned: entry.plannedPatterns, effective: entry.effectivePatterns })),
    },
  ];
}
