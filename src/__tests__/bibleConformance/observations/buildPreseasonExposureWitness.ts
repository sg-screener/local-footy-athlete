import type { OnboardingData } from '../../../types/domain';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
} from '../../../utils/coachingEngine';
import {
  buildPreseasonWeeklyExposureContract,
  evaluatePreseasonExposureContract,
} from '../../../rules/preseasonExposureContract';
import { buildInitialGeneratedCoachingPlan } from '../../../services/api/generateProgram';
import type { PreseasonExposureWitness } from '../invariants/preseasonExposureInvariants';

const PROFILE: OnboardingData = {
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

function componentShape(plan: CoachingPlan) {
  return plan.weeklyPlan.map((entry) => ({
    id: entry.planEntryId,
    patterns: entry.strengthIntent?.plannedPatterns ?? [],
    conditioning: !!entry.conditioningCategory,
    team: !!entry.isTeamDay,
  }));
}
export function buildPreseasonExposureWitness(): PreseasonExposureWitness {
  const inputs = onboardingToCoachingInputs(PROFILE, {
    availabilityDateISO: '2026-07-13',
    miniCycleNumber: 1,
    weekInBlock: 1,
    weekNumber: 1,
    weekKind: 'build',
    preseasonSubphase: 'mid_preseason',
  });
  const fallback = buildCoachingPlan(inputs);
  const edge = buildInitialGeneratedCoachingPlan({
    coachingInputs: inputs,
    profile: PROFILE,
    todayISO: '2026-07-13',
    blockNumber: 1,
  });
  if (!fallback.weeklyExposureContract || !edge.weeklyExposureContract) {
    throw new Error('Pre-season witness omitted its typed exposure contract');
  }
  const validation = evaluatePreseasonExposureContract(
    fallback.weeklyExposureContract,
    fallback.weeklyPlan,
  );
  const friday = fallback.weeklyPlan.find((entry) => entry.dayOfWeek === 'Friday');
  const saturday = fallback.weeklyPlan.find((entry) => entry.dayOfWeek === 'Saturday');
  const thursday = fallback.weeklyPlan.find((entry) => entry.dayOfWeek === 'Thursday');
  const teamOnly = fallback.weeklyPlan.find((entry) =>
    entry.isTeamDay && !(entry.strengthIntent?.plannedPatterns.length));
  const reduced = buildPreseasonWeeklyExposureContract({
    seasonPhase: 'Pre-season', readiness: 'low',
    selectedDayNumbers: [1, 2, 3, 4, 5, 6],
    teamTrainingDayNumbers: [1, 3], hasGame: false, gameDay: null,
  });
  const allTeamCredit = buildPreseasonWeeklyExposureContract({
    seasonPhase: 'Pre-season', readiness: 'high',
    selectedDayNumbers: [1, 2, 3, 4, 5, 6],
    teamTrainingDayNumbers: [1, 2, 3, 5], hasGame: false, gameDay: null,
  });

  return {
    validationViolationCount: validation.violations.length,
    requiredPatterns: [...fallback.weeklyExposureContract.strength.requiredPatterns],
    actualPatterns: [...validation.ledger.strengthPatterns],
    conditioningTarget: fallback.weeklyExposureContract.conditioning.targetCount,
    creditedTeamTraining: validation.ledger.teamTrainingCount,
    requiredAdditionalConditioning:
      fallback.weeklyExposureContract.conditioning.additionalRequiredCount,
    actualAdditionalConditioning: validation.ledger.additionalConditioningCount,
    recoveryDisplacedRequiredExposure:
      thursday?.tier === 'recovery' && validation.ledger.additionalConditioningCount <
        fallback.weeklyExposureContract.conditioning.additionalRequiredCount,
    safeConditioningPairAvailable: !!friday && !!saturday,
    safeConditioningPairUsed:
      friday?.hasCombinedConditioning === true && saturday?.hasCombinedConditioning === true,
    preferredHardDays: fallback.weeklyExposureContract.hardDays.preferredCount,
    permittedHardDays: fallback.weeklyExposureContract.hardDays.permittedCount,
    actualHardDays: validation.ledger.hardDayCount,
    fiveHardDayStructureAccepted:
      validation.ledger.hardDayCount === 5 && validation.violations.length === 0,
    teamOnlySessionHasStrengthCredit:
      (teamOnly?.strengthIntent?.plannedPatterns.length ?? 0) > 0,
    edgeContract: edge.weeklyExposureContract,
    fallbackContract: fallback.weeklyExposureContract,
    edgeComponentShape: componentShape(edge),
    fallbackComponentShape: componentShape(fallback),
    reductionsAreTyped: !!reduced && reduced.reductions.length > 0 &&
      reduced.reductions.every((entry) => !!entry.domain && !!entry.reason && entry.detail.trim().length > 0),
    zeroAdditionalConditioningAuthorised: !!allTeamCredit &&
      allTeamCredit.conditioning.additionalRequiredCount === 0 &&
      allTeamCredit.conditioning.creditedTeamTrainingCount >= allTeamCredit.conditioning.targetCount,
  };
}
