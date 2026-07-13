import type {
  SeasonPhase,
  SpeedBlock,
  WeekKind,
  Workout,
} from '../types/domain';
import { classifyVisibleSession } from './sessionClassificationAdapter';
import type { MainStrengthPattern } from './strengthPatternContributions';
import { countWeeklyExposures, type WeekDayInput } from './weeklyExposureCounts';

/**
 * Year-round weekly exposure protocol.
 *
 * Phase builders own the numbers and authorised reductions. This module owns
 * only the common representation, canonical counting and acceptance law.
 * Power intentionally does not appear: Bible power work is eligibility based,
 * not a numeric weekly minimum.
 */

export type WeeklyExposureDomain =
  | 'main_strength'
  | 'conditioning'
  | 'sprint_cod'
  | 'full_rest';

export type WeeklyExposureReductionReason =
  | 'insufficient_availability'
  | 'low_readiness'
  | 'injury_restriction'
  | 'equipment_infeasibility'
  | 'game_load_protection'
  | 'practice_match_load'
  | 'bye_recovery_mode'
  | 'deload_policy'
  | 'spacing_safety_conflict'
  | 'training_age_limit'
  | 'full_pause'
  | 'explicit_user_override';

export interface WeeklyExposureReduction {
  domain: WeeklyExposureDomain;
  reason: WeeklyExposureReductionReason;
  metric: 'weekly_exposure_count' | 'strength_pattern_count' | 'session_intensity_percent';
  from: number;
  to: number;
  detail: string;
}

export interface ExposureRange {
  min: number;
  max: number;
}

export type WeeklyExposureContractMode =
  | 'in_season_game_week'
  | 'in_season_bye_build'
  | 'in_season_bye_recovery'
  | 'early_offseason'
  | 'mid_offseason'
  | 'late_offseason'
  | 'early_preseason'
  | 'mid_preseason'
  | 'late_preseason';

export type WeeklyExposureContractSubphase =
  | 'game_week'
  | 'bye_build'
  | 'bye_recovery'
  | 'early_offseason'
  | 'mid_offseason'
  | 'late_offseason'
  | 'early_preseason'
  | 'mid_preseason'
  | 'late_preseason';

export interface WeeklyExposureContract {
  protocolVersion: 1;
  identity: {
    phase: SeasonPhase;
    subphase: WeeklyExposureContractSubphase;
    mode: WeeklyExposureContractMode;
    weekKind: WeekKind;
  };
  strength: {
    requiredPatterns: MainStrengthPattern[];
    /** Enforceable target: required floor plus only work deliberately selected by the phase planner. */
    targetCount: number;
    required: number;
    preferred: ExposureRange;
  };
  conditioning: {
    targetCount: number;
    required: number;
    preferred: ExposureRange;
    creditedTeamTrainingCount: number;
    creditedGameOrPracticeMatchCount: number;
    additionalRequiredCount: number;
    allowCombinedStrengthConditioning: boolean;
  };
  sprintCod: {
    targetCount: number;
    required: number;
    preferred: ExposureRange;
    creditedTeamTrainingCount: number;
    creditedGameOrPracticeMatchCount: number;
    additionalRequiredCount: number;
  };
  anchors: {
    teamTrainingDays: number[];
    gameDay: number | null;
    gameOrPracticeMatchCredit: number;
  };
  fullRest: {
    required: number;
    preferred: ExposureRange;
  };
  /** Compatibility projection used by the existing pre-season blueprint. */
  recovery: {
    minimumFullRestDays: number;
  };
  hardDays: {
    preferredCount: number;
    permittedCount: number;
    isHardMaximum: false;
  };
  reductions: WeeklyExposureReduction[];
}

export interface WeeklyExposureAllocationLike {
  dayOfWeek?: string;
  isTeamDay?: boolean;
  isGameDay?: boolean;
  tier?: string;
  isHardExposure?: boolean;
  stressLevel?: 'high' | 'medium' | 'low';
  strengthIntent?: {
    plannedPatterns?: readonly MainStrengthPattern[];
    effectivePatterns?: readonly MainStrengthPattern[];
  };
  strengthPatternContributions?: readonly MainStrengthPattern[];
  strengthPattern?: 'lower' | 'lower_combined' | 'push' | 'pull' | 'upper_combined' | 'full_body';
  conditioningCategory?: string;
  hasCombinedConditioning?: boolean;
  attachedConditioningKind?: string;
  speedBlock?: SpeedBlock;
}

export interface WeeklyExposureLedger {
  achieved: Record<WeeklyExposureDomain, number>;
  strengthPatterns: MainStrengthPattern[];
  teamTrainingCredit: number;
  gameOrPracticeMatchCredit: number;
  additionalConditioningCount: number;
  additionalSprintCodCount: number;
  hardDayCount: number;
  activeTrainingDays: number[];
  fullRestDays: number[];
}

export type WeeklyExposureViolationCode =
  | 'missing_strength_pattern'
  | 'required_exposure_shortfall'
  | 'team_anchor_credit_mismatch'
  | 'fixture_anchor_credit_mismatch'
  | 'hard_day_limit_exceeded'
  | 'spacing_safety_conflict';

export interface WeeklyExposureViolation {
  code: WeeklyExposureViolationCode;
  domain?: WeeklyExposureDomain;
  expected: unknown;
  actual: unknown;
  day?: number;
  detail?: string;
}

export interface WeeklyExposureValidation {
  contract: WeeklyExposureContract;
  ledger: WeeklyExposureLedger;
  unresolvedShortfalls: WeeklyExposureViolation[];
  accepted: boolean;
}

export function uniqueExposureDays(days: readonly number[]): number[] {
  return Array.from(new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
    .sort((a, b) => trainingOrder(a) - trainingOrder(b));
}

export function trainingOrder(day: number): number {
  return day === 0 ? 7 : day;
}

export function addExposureReduction(
  reductions: WeeklyExposureReduction[],
  reduction: WeeklyExposureReduction,
): void {
  if (
    reduction.to >= reduction.from ||
    reductions.some((entry) =>
      entry.domain === reduction.domain &&
      entry.reason === reduction.reason &&
      entry.metric === reduction.metric)
  ) return;
  reductions.push(reduction);
}

export function withExposureTarget(
  contract: WeeklyExposureContract,
  domain: WeeklyExposureDomain,
  to: number,
  reason: WeeklyExposureReductionReason,
  detail: string,
): WeeklyExposureContract {
  const next = structuredContractClone(contract);
  const from = requiredForDomain(next, domain);
  const target = Math.max(0, Math.floor(to));
  if (target >= from) return next;
  addExposureReduction(next.reductions, {
    domain,
    reason,
    metric: 'weekly_exposure_count',
    from,
    to: target,
    detail,
  });
  if (domain === 'main_strength') {
    next.strength.required = target;
    next.strength.targetCount = target;
    next.strength.preferred = clampRange(next.strength.preferred, target);
    if (target === 0) next.strength.requiredPatterns = [];
  } else if (domain === 'conditioning') {
    next.conditioning.required = target;
    next.conditioning.targetCount = target;
    next.conditioning.preferred = clampRange(next.conditioning.preferred, target);
    next.conditioning.additionalRequiredCount = Math.max(
      0,
      target - next.conditioning.creditedTeamTrainingCount -
        next.conditioning.creditedGameOrPracticeMatchCount,
    );
  } else if (domain === 'sprint_cod') {
    next.sprintCod.required = target;
    next.sprintCod.targetCount = target;
    next.sprintCod.preferred = clampRange(next.sprintCod.preferred, target);
    next.sprintCod.additionalRequiredCount = Math.max(
      0,
      target - next.sprintCod.creditedTeamTrainingCount -
        next.sprintCod.creditedGameOrPracticeMatchCount,
    );
  } else {
    next.fullRest.required = target;
    next.fullRest.preferred = clampRange(next.fullRest.preferred, target);
    next.recovery.minimumFullRestDays = target;
  }
  return next;
}

function structuredContractClone(contract: WeeklyExposureContract): WeeklyExposureContract {
  return {
    ...contract,
    identity: { ...contract.identity },
    strength: {
      ...contract.strength,
      requiredPatterns: [...contract.strength.requiredPatterns],
      preferred: { ...contract.strength.preferred },
    },
    conditioning: {
      ...contract.conditioning,
      preferred: { ...contract.conditioning.preferred },
    },
    sprintCod: { ...contract.sprintCod, preferred: { ...contract.sprintCod.preferred } },
    anchors: { ...contract.anchors, teamTrainingDays: [...contract.anchors.teamTrainingDays] },
    fullRest: { ...contract.fullRest, preferred: { ...contract.fullRest.preferred } },
    recovery: { ...contract.recovery },
    hardDays: { ...contract.hardDays },
    reductions: [...contract.reductions],
  };
}

function clampRange(range: ExposureRange, required: number): ExposureRange {
  return {
    min: Math.min(range.min, required),
    max: Math.max(Math.min(range.max, Math.max(required, range.min)), required),
  };
}

function requiredForDomain(contract: WeeklyExposureContract, domain: WeeklyExposureDomain): number {
  if (domain === 'main_strength') return contract.strength.required;
  if (domain === 'conditioning') return contract.conditioning.required;
  if (domain === 'sprint_cod') return contract.sprintCod.required;
  return contract.fullRest.required;
}

function enforceableForDomain(
  contract: WeeklyExposureContract,
  domain: WeeklyExposureDomain,
): number {
  if (domain === 'main_strength') return contract.strength.targetCount;
  if (domain === 'conditioning') return contract.conditioning.targetCount;
  if (domain === 'sprint_cod') return contract.sprintCod.targetCount;
  return contract.fullRest.required;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayNumber(name: string | undefined): number {
  if (!name) return -1;
  return DAY_NAMES.indexOf(name);
}

function fixtureOffset(day: number, gameDay: number | null): number | null {
  if (gameDay === null) return null;
  let diff = day - gameDay;
  if (diff > 0) diff -= 7;
  if (diff === -6) return 1;
  return diff;
}

function patternSetForAllocation(allocation: WeeklyExposureAllocationLike): MainStrengthPattern[] {
  const typed = allocation.strengthIntent?.effectivePatterns?.length
    ? allocation.strengthIntent.effectivePatterns
    : allocation.strengthIntent?.plannedPatterns;
  const explicit = typed ?? allocation.strengthPatternContributions;
  if (explicit?.length) return [...explicit];
  if (allocation.strengthPattern === 'lower' || allocation.strengthPattern === 'lower_combined') {
    return ['squat', 'hinge'];
  }
  if (allocation.strengthPattern === 'push') return ['push'];
  if (allocation.strengthPattern === 'pull') return ['pull'];
  if (allocation.strengthPattern === 'upper_combined') return ['push', 'pull'];
  if (allocation.strengthPattern === 'full_body') return ['squat', 'hinge', 'push', 'pull'];
  return [];
}

function evaluateSafety(
  contract: WeeklyExposureContract,
  allocations: readonly WeeklyExposureAllocationLike[],
): WeeklyExposureViolation[] {
  if (contract.anchors.gameDay === null) return [];
  const violations: WeeklyExposureViolation[] = [];
  for (const allocation of allocations) {
    const day = dayNumber(allocation.dayOfWeek);
    if (day < 0 || allocation.isTeamDay || allocation.isGameDay) continue;
    const offset = fixtureOffset(day, contract.anchors.gameDay);
    const patterns = patternSetForAllocation(allocation);
    const hasStrength = patterns.length > 0;
    const hasLower = patterns.some((pattern) => pattern === 'squat' || pattern === 'hinge');
    const hasConditioning = !!allocation.conditioningCategory || !!allocation.hasCombinedConditioning;
    const hasSpeed = !!allocation.speedBlock;
    const hardConditioning = allocation.conditioningCategory === 'vo2' ||
      allocation.conditioningCategory === 'glycolytic' ||
      allocation.conditioningCategory === 'sprint';
    const unsafe =
      (offset === -1 && (hasStrength || hasConditioning || hasSpeed)) ||
      (offset === -2 && (hasLower || hardConditioning || hasSpeed)) ||
      ((offset === 0 || offset === 1) && (hasStrength || hasConditioning || hasSpeed));
    if (unsafe) {
      violations.push({
        code: 'spacing_safety_conflict',
        expected: 'no incompatible app exposure in the fixture protection window',
        actual: { patterns, conditioning: allocation.conditioningCategory, speed: hasSpeed },
        day,
        detail: `Unsafe app exposure at G${offset && offset > 0 ? '+' : ''}${offset}.`,
      });
    }
  }
  return violations;
}

/** Count post-allocation intent, including declared anchor credit. */
export function ledgerFromAllocations(
  contract: WeeklyExposureContract,
  allocations: readonly WeeklyExposureAllocationLike[],
): WeeklyExposureLedger {
  const patterns = new Set<MainStrengthPattern>();
  const strengthDays = new Set<number>();
  const conditioningDays = new Set<number>();
  const sprintDays = new Set<number>();
  const hardDays = new Set<number>(contract.anchors.teamTrainingDays);
  const activeDays = new Set<number>(contract.anchors.teamTrainingDays);
  if (contract.anchors.gameDay !== null) {
    activeDays.add(contract.anchors.gameDay);
    hardDays.add(contract.anchors.gameDay);
  }

  for (const allocation of allocations) {
    const day = dayNumber(allocation.dayOfWeek);
    if (day < 0) continue;
    const planned = patternSetForAllocation(allocation);
    if (planned.length > 0) {
      strengthDays.add(day);
      activeDays.add(day);
      planned.forEach((pattern) => patterns.add(pattern));
    }
    if (allocation.conditioningCategory || allocation.hasCombinedConditioning) {
      conditioningDays.add(day);
      activeDays.add(day);
    }
    if (allocation.speedBlock) {
      sprintDays.add(day);
      activeDays.add(day);
    }
    if (allocation.isTeamDay || allocation.isHardExposure || allocation.stressLevel === 'high') {
      hardDays.add(day);
    }
  }

  const teamDays = new Set(contract.anchors.teamTrainingDays);
  const extraConditioning = Array.from(conditioningDays).filter((day) => !teamDays.has(day)).length;
  const extraSprint = Array.from(sprintDays).filter((day) => !teamDays.has(day)).length;
  const fullRestDays = [0, 1, 2, 3, 4, 5, 6].filter((day) => !activeDays.has(day));
  return {
    achieved: {
      main_strength: strengthDays.size,
      conditioning: contract.conditioning.creditedTeamTrainingCount +
        contract.conditioning.creditedGameOrPracticeMatchCount + extraConditioning,
      sprint_cod: contract.sprintCod.creditedTeamTrainingCount +
        contract.sprintCod.creditedGameOrPracticeMatchCount + extraSprint,
      full_rest: fullRestDays.length,
    },
    strengthPatterns: ['squat', 'hinge', 'push', 'pull'].filter(
      (pattern): pattern is MainStrengthPattern => patterns.has(pattern as MainStrengthPattern),
    ),
    teamTrainingCredit: contract.anchors.teamTrainingDays.length,
    gameOrPracticeMatchCredit: contract.anchors.gameOrPracticeMatchCredit,
    additionalConditioningCount: extraConditioning,
    additionalSprintCodCount: extraSprint,
    hardDayCount: hardDays.size,
    activeTrainingDays: Array.from(activeDays).sort((a, b) => trainingOrder(a) - trainingOrder(b)),
    fullRestDays,
  };
}

/**
 * Promote only exposure the phase planner actually selected into the
 * enforceable target. Preferred ranges remain advisory and cannot create work
 * by themselves; this capture happens after phase allocation and before final
 * effective-week validation.
 */
export function withPlannerSelectedExposureTargets(
  source: WeeklyExposureContract,
  allocations: readonly WeeklyExposureAllocationLike[],
): WeeklyExposureContract {
  const contract = structuredContractClone(source);
  const ledger = ledgerFromAllocations(contract, allocations);
  const mayPromote = (domain: WeeklyExposureDomain): boolean =>
    !contract.reductions.some((entry) =>
      entry.domain === domain && entry.metric === 'weekly_exposure_count');
  const selectedTarget = (
    required: number,
    current: number,
    achieved: number,
  ): number => Math.max(required, current, achieved);
  const selectedAnchoredTarget = (
    required: number,
    current: number,
    creditedAnchors: number,
    selectedAdditional: number,
  ): number => {
    const baselineAdditional = Math.max(0, current - creditedAnchors);
    return selectedAdditional > baselineAdditional
      ? Math.max(required, current, creditedAnchors + selectedAdditional)
      : Math.max(required, current);
  };

  if (mayPromote('main_strength')) {
    contract.strength.targetCount = selectedTarget(
      contract.strength.required,
      contract.strength.targetCount,
      ledger.achieved.main_strength,
    );
  }
  if (mayPromote('conditioning')) {
    contract.conditioning.targetCount = selectedAnchoredTarget(
      contract.conditioning.required,
      contract.conditioning.targetCount,
      contract.conditioning.creditedTeamTrainingCount +
        contract.conditioning.creditedGameOrPracticeMatchCount,
      ledger.additionalConditioningCount,
    );
  }
  if (mayPromote('sprint_cod')) {
    contract.sprintCod.targetCount = selectedAnchoredTarget(
      contract.sprintCod.required,
      contract.sprintCod.targetCount,
      contract.sprintCod.creditedTeamTrainingCount +
        contract.sprintCod.creditedGameOrPracticeMatchCount,
      ledger.additionalSprintCodCount,
    );
  }
  contract.conditioning.additionalRequiredCount = Math.max(
    0,
    contract.conditioning.targetCount - contract.conditioning.creditedTeamTrainingCount -
      contract.conditioning.creditedGameOrPracticeMatchCount,
  );
  contract.sprintCod.additionalRequiredCount = Math.max(
    0,
    contract.sprintCod.targetCount - contract.sprintCod.creditedTeamTrainingCount -
      contract.sprintCod.creditedGameOrPracticeMatchCount,
  );
  return contract;
}

function dateForDow(weekStartISO: string, dow: number): string {
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const value = new Date(`${weekStartISO.slice(0, 10)}T12:00:00`);
  value.setDate(value.getDate() + mondayOffset);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/** Count canonical stored/effective workouts through the shared classifier. */
export function ledgerFromEffectiveWorkouts(
  contract: WeeklyExposureContract,
  workouts: readonly Workout[],
  weekStartISO: string,
): WeeklyExposureLedger {
  const days: WeekDayInput[] = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
    date: dateForDow(weekStartISO, dow),
    workouts: workouts.filter((workout) => workout.dayOfWeek === dow),
  }));
  const counts = countWeeklyExposures(days);
  // Generated microcycles intentionally do not persist a Game workout. The
  // visible week resolver projects the target-week fixture from the schedule.
  // Credit that declared anchor exactly once here so raw-microcycle acceptance
  // and resolved-visible-week acceptance use the same exposure truth.
  const projectedFixtureCredit = Math.max(
    counts.games,
    contract.anchors.gameOrPracticeMatchCredit,
  );
  const missingProjectedFixtureCredit = projectedFixtureCredit - counts.games;
  const patterns = new Set<MainStrengthPattern>();
  const activeDays = new Set<number>();
  const sprintDays = new Set<number>();
  const hardDays = new Set<number>();
  for (const workout of workouts) {
    const classification = classifyVisibleSession(workout);
    const typed = workout.strengthIntent?.effectivePatterns?.length
      ? workout.strengthIntent.effectivePatterns
      : workout.strengthIntent?.plannedPatterns ?? workout.strengthPatternContributions ?? [];
    typed.forEach((pattern) => patterns.add(pattern));
    if (
      classification.contributions.mainStrength > 0 ||
      classification.contributions.conditioning > 0 ||
      classification.contributions.sprintCod > 0 ||
      classification.anchors.game || classification.anchors.teamTraining
    ) activeDays.add(workout.dayOfWeek);
    if (workout.speedBlock) sprintDays.add(workout.dayOfWeek);
    if (classification.contributions.hardDay > 0) hardDays.add(workout.dayOfWeek);
  }
  if (missingProjectedFixtureCredit > 0 && contract.anchors.gameDay !== null) {
    activeDays.add(contract.anchors.gameDay);
    hardDays.add(contract.anchors.gameDay);
  }
  const fullRestDays = [0, 1, 2, 3, 4, 5, 6].filter((day) => !activeDays.has(day));
  return {
    achieved: {
      main_strength: counts.mainStrengthExposures,
      conditioning: counts.conditioningExposures + missingProjectedFixtureCredit,
      sprint_cod: counts.sprintCodExposures + missingProjectedFixtureCredit,
      full_rest: fullRestDays.length,
    },
    strengthPatterns: ['squat', 'hinge', 'push', 'pull'].filter(
      (pattern): pattern is MainStrengthPattern => patterns.has(pattern as MainStrengthPattern),
    ),
    teamTrainingCredit: counts.teamTrainingSessions,
    gameOrPracticeMatchCredit: projectedFixtureCredit,
    additionalConditioningCount: counts.extraConditioningSessions,
    additionalSprintCodCount: sprintDays.size,
    hardDayCount: hardDays.size,
    activeTrainingDays: Array.from(activeDays).sort((a, b) => trainingOrder(a) - trainingOrder(b)),
    fullRestDays,
  };
}

export function evaluateWeeklyExposureContract(
  contract: WeeklyExposureContract,
  ledger: WeeklyExposureLedger,
  options: { allocations?: readonly WeeklyExposureAllocationLike[] } = {},
): WeeklyExposureValidation {
  const unresolved: WeeklyExposureViolation[] = [];
  if (contract.strength.required > 0) {
    for (const pattern of contract.strength.requiredPatterns) {
      if (!ledger.strengthPatterns.includes(pattern)) {
        unresolved.push({
          code: 'missing_strength_pattern',
          domain: 'main_strength',
          expected: pattern,
          actual: ledger.strengthPatterns,
        });
      }
    }
  }
  const domains: WeeklyExposureDomain[] = [
    'main_strength', 'conditioning', 'sprint_cod', 'full_rest',
  ];
  for (const domain of domains) {
    const achieved = ledger.achieved[domain];
    const enforceable = enforceableForDomain(contract, domain);
    if (achieved < enforceable) {
      unresolved.push({
        code: 'required_exposure_shortfall',
        domain,
        expected: enforceable,
        actual: achieved,
      });
    }
  }
  if (ledger.teamTrainingCredit !== contract.anchors.teamTrainingDays.length) {
    unresolved.push({
      code: 'team_anchor_credit_mismatch',
      expected: contract.anchors.teamTrainingDays.length,
      actual: ledger.teamTrainingCredit,
    });
  }
  if (ledger.gameOrPracticeMatchCredit !== contract.anchors.gameOrPracticeMatchCredit) {
    unresolved.push({
      code: 'fixture_anchor_credit_mismatch',
      expected: contract.anchors.gameOrPracticeMatchCredit,
      actual: ledger.gameOrPracticeMatchCredit,
    });
  }
  if (ledger.hardDayCount > contract.hardDays.permittedCount) {
    unresolved.push({
      code: 'hard_day_limit_exceeded',
      expected: contract.hardDays.permittedCount,
      actual: ledger.hardDayCount,
    });
  }
  if (options.allocations) unresolved.push(...evaluateSafety(contract, options.allocations));
  return {
    contract,
    ledger,
    unresolvedShortfalls: unresolved,
    accepted: unresolved.length === 0,
  };
}

export function evaluateAllocationExposureContract(
  contract: WeeklyExposureContract,
  allocations: readonly WeeklyExposureAllocationLike[],
): WeeklyExposureValidation {
  return evaluateWeeklyExposureContract(contract, ledgerFromAllocations(contract, allocations), {
    allocations,
  });
}

export function evaluateEffectiveWeekExposureContract(
  contract: WeeklyExposureContract,
  workouts: readonly Workout[],
  weekStartISO: string,
): WeeklyExposureValidation {
  const canonicalAllocations: WeeklyExposureAllocationLike[] = workouts.map((workout) => {
    const classification = classifyVisibleSession(workout);
    return {
      dayOfWeek: DAY_NAMES[workout.dayOfWeek],
      isTeamDay: classification.anchors.teamTraining,
      isGameDay: classification.anchors.game,
      stressLevel: classification.stressLevel ?? undefined,
      strengthIntent: workout.strengthIntent,
      strengthPatternContributions: workout.strengthPatternContributions,
      conditioningCategory: workout.conditioningCategory,
      hasCombinedConditioning: workout.hasCombinedConditioning,
      attachedConditioningKind: workout.attachedConditioningKind,
      speedBlock: workout.speedBlock,
    };
  });
  return evaluateWeeklyExposureContract(
    contract,
    ledgerFromEffectiveWorkouts(contract, workouts, weekStartISO),
    { allocations: canonicalAllocations },
  );
}

/**
 * Reconcile an explicitly authorised target-week change to its canonical
 * ledger. This is deliberately separate from validation: callers may invoke
 * it only when an owning user/safety action has already authorised the dose
 * reduction. Anchor, hard-day and spacing failures are never reduced here.
 */
export function reconcileWeeklyExposureContractToLedger(
  source: WeeklyExposureContract,
  ledger: WeeklyExposureLedger,
  reason: WeeklyExposureReductionReason,
  detail: string,
): WeeklyExposureContract {
  const contract = structuredContractClone(source);
  const reducible: WeeklyExposureDomain[] = ['main_strength', 'conditioning', 'sprint_cod'];
  for (const domain of reducible) {
    const actual = ledger.achieved[domain];
    const required = requiredForDomain(contract, domain);
    const allocationTarget = domain === 'main_strength'
      ? contract.strength.targetCount
      : domain === 'conditioning'
        ? contract.conditioning.targetCount
        : contract.sprintCod.targetCount;
    const from = Math.max(required, allocationTarget);
    if (domain === 'main_strength') {
      const missingRequiredPattern = contract.strength.requiredPatterns.some(
        (pattern) => !ledger.strengthPatterns.includes(pattern),
      );
      if (missingRequiredPattern) {
        addExposureReduction(contract.reductions, {
          domain,
          reason,
          metric: 'strength_pattern_count',
          from: contract.strength.requiredPatterns.length,
          to: ledger.strengthPatterns.length,
          detail,
        });
        contract.strength.requiredPatterns = contract.strength.required > 0
          ? [...ledger.strengthPatterns]
          : [];
      }
    }
    if (actual >= from) continue;
    addExposureReduction(contract.reductions, {
      domain,
      reason,
      metric: 'weekly_exposure_count',
      from,
      to: actual,
      detail,
    });
    if (domain === 'main_strength') {
      contract.strength.required = Math.min(required, actual);
      contract.strength.targetCount = actual;
      contract.strength.requiredPatterns = contract.strength.required > 0
        ? [...ledger.strengthPatterns]
        : [];
    } else if (domain === 'conditioning') {
      contract.conditioning.required = Math.min(required, actual);
      contract.conditioning.targetCount = actual;
      contract.conditioning.additionalRequiredCount = Math.max(
        0,
        actual - contract.conditioning.creditedTeamTrainingCount -
          contract.conditioning.creditedGameOrPracticeMatchCount,
      );
    } else {
      contract.sprintCod.required = Math.min(required, actual);
      contract.sprintCod.targetCount = actual;
      contract.sprintCod.additionalRequiredCount = Math.max(
        0,
        actual - contract.sprintCod.creditedTeamTrainingCount -
          contract.sprintCod.creditedGameOrPracticeMatchCount,
      );
    }
  }
  return contract;
}
