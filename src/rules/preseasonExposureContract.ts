import type {
  InjurySeverity,
  ReadinessLevel,
  SeasonPhase,
  WeekKind,
} from '../types/domain';
import type { GenerationReadinessTier } from '../utils/generationConstraints';
import type { MainStrengthPattern } from './strengthPatternContributions';
import type { PreseasonSubphase } from './preseasonSubphase';
import {
  evaluateAllocationExposureContract,
  type WeeklyExposureAllocationLike,
  type WeeklyExposureContract,
} from './weeklyExposureContract';
import { buildPreseasonExposureContract } from './weeklyExposureContractBuilders';

export interface PreseasonExposureContractInput {
  seasonPhase: SeasonPhase;
  readiness: ReadinessLevel;
  selectedDayNumbers: readonly number[];
  teamTrainingDayNumbers: readonly number[];
  hasGame: boolean;
  gameDay: number | null;
  weekKind?: WeekKind;
  preseasonSubphase?: PreseasonSubphase | null;
  activeReadinessTier?: GenerationReadinessTier;
  maxStrengthSessions?: number | null;
  appConditioningFeasible?: boolean;
  profileInjuries?: ReadonlyArray<{
    bodyArea: string;
    description?: string;
    severity?: InjurySeverity;
  }>;
  activeInjuries?: ReadonlyArray<{
    region: 'lower_body' | 'upper_body' | 'back_midline' | 'other';
    pauseAffectedTraining: boolean;
    effectiveSeverity?: number;
    injuryKeys?: readonly string[];
  }>;
}

export type PreseasonStrengthSlotIdentity =
  | MainStrengthPattern
  | 'lower_combined'
  | 'upper_combined';

export interface PreseasonExposureBlueprint {
  strength: Array<{ day: number; identity: PreseasonStrengthSlotIdentity }>;
  conditioningDays: number[];
  restDays: number[];
}

export type PreseasonExposureAllocationLike = WeeklyExposureAllocationLike;

export interface PreseasonExposureLedger {
  strengthPatterns: MainStrengthPattern[];
  strengthContributionCount: number;
  teamTrainingCount: number;
  additionalConditioningCount: number;
  conditioningExposureCount: number;
  trainingDayCount: number;
  hardDayCount: number;
  fullRestDayCount: number;
}

export type PreseasonExposureViolationCode =
  | 'missing_strength_pattern'
  | 'strength_target_shortfall'
  | 'conditioning_target_shortfall'
  | 'team_credit_mismatch'
  | 'hard_day_limit_exceeded'
  | 'full_rest_shortfall'
  | 'shared_contract_violation';

export interface PreseasonExposureValidation {
  ledger: PreseasonExposureLedger;
  violations: Array<{
    code: PreseasonExposureViolationCode;
    expected: unknown;
    actual: unknown;
  }>;
}

/** Shared protocol type retained under the old export name for callers. */
export type PreseasonWeeklyExposureContract = WeeklyExposureContract;

function uniqueDays(days: readonly number[]): number[] {
  return Array.from(new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)));
}

/**
 * Pre-season phase-owned builder projected into the shared year-round
 * protocol. There is no second pre-season demand representation here.
 */
export function buildPreseasonWeeklyExposureContract(
  input: PreseasonExposureContractInput,
): PreseasonWeeklyExposureContract | null {
  if (input.seasonPhase !== 'Pre-season') return null;
  return buildPreseasonExposureContract({
    ...input,
    preseasonSubphase: input.preseasonSubphase ?? 'mid_preseason',
  });
}

function trainingOrder(day: number): number {
  return day === 0 ? 7 : day;
}

function pickRestDays(
  selectedDays: readonly number[],
  teamDays: ReadonlySet<number>,
  count: number,
  requiredSeparatedLowerSlots: number,
): number[] {
  if (count <= 0) return [];
  const ordered = [...selectedDays].sort((a, b) => trainingOrder(a) - trainingOrder(b));
  const candidates = ordered.filter((day) => !teamDays.has(day));
  const middleCandidates = [...candidates].sort((a, b) => {
    const aIndex = ordered.indexOf(a);
    const bIndex = ordered.indexOf(b);
    return Math.abs(aIndex - 3) - Math.abs(bIndex - 3) || aIndex - bIndex;
  });
  const preferred = Array.from(new Set(
    [ordered[3], 0, ...middleCandidates, ordered[ordered.length - 1]].filter(
    (day): day is number => day !== undefined && candidates.includes(day),
    ),
  ));

  const combinations: number[][] = [];
  const choose = (start: number, picked: number[]): void => {
    if (picked.length === Math.min(count, candidates.length)) {
      combinations.push([...picked]);
      return;
    }
    for (let index = start; index < candidates.length; index++) {
      picked.push(candidates[index]);
      choose(index + 1, picked);
      picked.pop();
    }
  };
  choose(0, []);

  const separatedLowerCapacity = (restDays: readonly number[]): number => {
    const restSet = new Set(restDays);
    const usable = candidates
      .filter((day) => !restSet.has(day))
      .sort((a, b) => trainingOrder(a) - trainingOrder(b));
    let countPlaced = 0;
    let previousPosition = -99;
    for (const day of usable) {
      const position = trainingOrder(day);
      if (position - previousPosition < 2) continue;
      countPlaced++;
      previousPosition = position;
    }
    return countPlaced;
  };
  const preferenceScore = (restDays: readonly number[]): number =>
    restDays.reduce((score, day) => score + preferred.indexOf(day), 0);

  combinations.sort((left, right) => {
    const leftCapacity = separatedLowerCapacity(left);
    const rightCapacity = separatedLowerCapacity(right);
    const leftFeasible = leftCapacity >= requiredSeparatedLowerSlots;
    const rightFeasible = rightCapacity >= requiredSeparatedLowerSlots;
    if (leftFeasible !== rightFeasible) return leftFeasible ? -1 : 1;
    if (!leftFeasible && leftCapacity !== rightCapacity) return rightCapacity - leftCapacity;
    return preferenceScore(left) - preferenceScore(right);
  });
  return combinations[0] ?? [];
}

/**
 * Converts the already-decided contract into a deterministic placement
 * blueprint. It contains no workout copy and does not decide conditioning
 * dose or modality.
 */
export function buildPreseasonExposureBlueprint(args: {
  contract: PreseasonWeeklyExposureContract;
  selectedDayNumbers: readonly number[];
  weekNumber?: number;
}): PreseasonExposureBlueprint {
  const selectedDays = uniqueDays(args.selectedDayNumbers)
    .sort((a, b) => trainingOrder(a) - trainingOrder(b));
  const teamDays = new Set(args.contract.anchors.teamTrainingDays);
  const unselectedFullRestDays = Math.max(0, 7 - selectedDays.length);
  const selectedRestCount = Math.max(
    selectedDays.length >= 5 && args.contract.strength.targetCount >= 3 ? 1 : 0,
    args.contract.recovery.minimumFullRestDays - unselectedFullRestDays,
  );
  const requiredLowerPatternCount = args.contract.strength.requiredPatterns.filter(
    (pattern) => pattern === 'squat' || pattern === 'hinge',
  ).length;
  const requiredSeparatedLowerSlots = requiredLowerPatternCount === 0
    ? 0
    : args.contract.strength.targetCount >= 4 && requiredLowerPatternCount >= 2
      ? 2
      : 1;
  const restDays = pickRestDays(
    selectedDays,
    teamDays,
    selectedRestCount,
    requiredSeparatedLowerSlots,
  );
  const restSet = new Set(restDays);
  const gameDay = args.contract.anchors.gameDay;
  const usable = selectedDays.filter((day) => !restSet.has(day) && day !== gameDay);
  const nonTeam = usable.filter((day) => !teamDays.has(day));
  const team = usable.filter((day) => teamDays.has(day));
  const target = Math.min(args.contract.strength.targetCount, usable.length);

  const selectedStrengthDays = nonTeam.length > target && target > 1
    ? [...nonTeam.slice(0, target - 1), nonTeam[nonTeam.length - 1]]
    : nonTeam.slice(0, target);
  const teamNeeded = Math.max(0, target - selectedStrengthDays.length);
  selectedStrengthDays.push(...team.slice(0, teamNeeded));
  selectedStrengthDays.sort((a, b) => trainingOrder(a) - trainingOrder(b));

  const required = new Set(args.contract.strength.requiredPatterns);
  const hasUpper = required.has('push') || required.has('pull');
  const hasLower = required.has('squat') || required.has('hinge');
  const upperTarget = hasUpper && hasLower ? Math.ceil(target / 2) : hasUpper ? target : 0;
  const lowerTarget = hasUpper && hasLower ? target - upperTarget : hasLower ? target : 0;
  const regions = new Map<number, 'upper' | 'lower'>();
  let upperCount = 0;
  let lowerCount = 0;
  let previous: 'upper' | 'lower' | null = null;

  // Team overlays consume upper slots first. Reserve those slots before
  // assigning non-team days so chronology cannot accidentally spend the
  // upper quota and force lower strength onto a field anchor.
  for (const day of selectedStrengthDays.filter((candidate) => teamDays.has(candidate))) {
    if (!hasUpper) continue;
    regions.set(day, 'upper');
    upperCount++;
  }
  for (const day of selectedStrengthDays.filter((candidate) => !teamDays.has(candidate))) {
    let region: 'upper' | 'lower';
    const upperRemaining = upperTarget - upperCount;
    const lowerRemaining = lowerTarget - lowerCount;
    if (lowerRemaining > upperRemaining) region = 'lower';
    else if (upperRemaining > lowerRemaining) region = 'upper';
    else region = previous === 'upper' ? 'lower' : 'upper';
    regions.set(day, region);
    if (region === 'upper') upperCount++;
    else lowerCount++;
    previous = region;
  }

  const upperDays = selectedStrengthDays.filter((day) => regions.get(day) === 'upper');
  const lowerDays = selectedStrengthDays.filter((day) => regions.get(day) === 'lower');
  const oddWeek = (args.weekNumber ?? 1) % 2 === 1;
  const upperOrder: MainStrengthPattern[] = oddWeek ? ['push', 'pull'] : ['pull', 'push'];
  const lowerOrder: MainStrengthPattern[] = oddWeek ? ['hinge', 'squat'] : ['squat', 'hinge'];
  const identityByDay = new Map<number, PreseasonStrengthSlotIdentity>();

  if (upperDays.length === 1 && required.has('push') && required.has('pull')) {
    identityByDay.set(upperDays[0], 'upper_combined');
  } else {
    upperDays.forEach((day, index) => {
      const identity = upperOrder.find((pattern) => required.has(pattern)) ?? 'push';
      const alternate = upperOrder[(index + upperOrder.indexOf(identity)) % upperOrder.length];
      identityByDay.set(day, required.has(alternate) ? alternate : identity);
    });
  }
  if (lowerDays.length === 1 && required.has('squat') && required.has('hinge')) {
    identityByDay.set(lowerDays[0], 'lower_combined');
  } else {
    lowerDays.forEach((day, index) => {
      const identity = lowerOrder.find((pattern) => required.has(pattern)) ?? 'squat';
      const alternate = lowerOrder[(index + lowerOrder.indexOf(identity)) % lowerOrder.length];
      identityByDay.set(day, required.has(alternate) ? alternate : identity);
    });
  }

  const strength = selectedStrengthDays
    .map((day) => ({ day, identity: identityByDay.get(day) }))
    .filter((entry): entry is { day: number; identity: PreseasonStrengthSlotIdentity } => !!entry.identity);
  const nonTeamStrength = strength.filter((entry) => !teamDays.has(entry.day));
  const upperConditioning = nonTeamStrength
    .filter((entry) => entry.identity === 'push' || entry.identity === 'pull' || entry.identity === 'upper_combined')
    .sort((a, b) => trainingOrder(b.day) - trainingOrder(a.day));
  const lowerConditioning = nonTeamStrength
    .filter((entry) => entry.identity === 'squat' || entry.identity === 'hinge' || entry.identity === 'lower_combined')
    .sort((a, b) => trainingOrder(b.day) - trainingOrder(a.day));
  const strengthDaySet = new Set(strength.map((entry) => entry.day));
  const standaloneConditioning = nonTeam
    .filter((day) => !strengthDaySet.has(day))
    .sort((a, b) => trainingOrder(a) - trainingOrder(b))
    .map((day) => ({ day, identity: 'standalone' as const }));
  const pairedConditioning = [...upperConditioning, ...lowerConditioning];
  const conditioningDays = (
    args.contract.conditioning.allowCombinedStrengthConditioning
      ? [...pairedConditioning, ...standaloneConditioning]
      : [...standaloneConditioning, ...pairedConditioning]
  )
    .slice(0, args.contract.conditioning.additionalRequiredCount)
    .map((entry) => entry.day);

  return { strength, conditioningDays, restDays };
}

export function evaluatePreseasonExposureContract(
  contract: PreseasonWeeklyExposureContract,
  allocations: readonly PreseasonExposureAllocationLike[],
): PreseasonExposureValidation {
  const shared = evaluateAllocationExposureContract(contract, allocations);
  const ledger: PreseasonExposureLedger = {
    strengthPatterns: shared.ledger.strengthPatterns,
    strengthContributionCount: shared.ledger.achieved.main_strength,
    teamTrainingCount: shared.ledger.teamTrainingCredit,
    additionalConditioningCount: shared.ledger.additionalConditioningCount,
    conditioningExposureCount: shared.ledger.achieved.conditioning,
    trainingDayCount: shared.ledger.activeTrainingDays.length,
    hardDayCount: shared.ledger.hardDayCount,
    fullRestDayCount: shared.ledger.achieved.full_rest,
  };
  const violations: PreseasonExposureValidation['violations'] =
    shared.unresolvedShortfalls.map((violation) => ({
      code: violation.code === 'missing_strength_pattern'
        ? 'missing_strength_pattern'
        : violation.code === 'required_exposure_shortfall' && violation.domain === 'main_strength'
          ? 'strength_target_shortfall'
          : violation.code === 'required_exposure_shortfall' && violation.domain === 'conditioning'
            ? 'conditioning_target_shortfall'
            : violation.code === 'required_exposure_shortfall' && violation.domain === 'full_rest'
              ? 'full_rest_shortfall'
              : violation.code === 'team_anchor_credit_mismatch'
                ? 'team_credit_mismatch'
                : violation.code === 'hard_day_limit_exceeded'
                  ? 'hard_day_limit_exceeded'
                  : 'shared_contract_violation',
      expected: violation.expected,
      actual: violation.actual,
    }));
  return { ledger, violations };
}
