import type {
  InjurySeverity,
  ReadinessLevel,
  SeasonPhase,
  WeekKind,
} from '../types/domain';
import type { GenerationReadinessTier } from '../utils/generationConstraints';
import type { MainStrengthPattern } from './strengthPatternContributions';

export type PreseasonExposureReductionDomain = 'strength' | 'conditioning';

export type PreseasonExposureReductionCode =
  | 'reduced_availability'
  | 'readiness_reduction'
  | 'full_pause'
  | 'game_proximity'
  | 'injury_restriction'
  | 'training_age_limit';

export interface PreseasonExposureReduction {
  domain: PreseasonExposureReductionDomain;
  code: PreseasonExposureReductionCode;
  reason: string;
}

export interface PreseasonWeeklyExposureContract {
  strength: {
    requiredPatterns: MainStrengthPattern[];
    /** Number of meaningful strength sessions/contributions to allocate. */
    targetCount: number;
  };
  conditioning: {
    /** Total weekly conditioning exposures, including team-training credit. */
    targetCount: number;
    creditedTeamTrainingCount: number;
    /** App-authored components required after team-training credit. */
    additionalRequiredCount: number;
    allowCombinedStrengthConditioning: boolean;
  };
  anchors: {
    teamTrainingDays: number[];
    gameDay: number | null;
  };
  recovery: {
    minimumFullRestDays: number;
  };
  hardDays: {
    preferredCount: number;
    permittedCount: number;
    isHardMaximum: false;
  };
  reductions: PreseasonExposureReduction[];
}

export interface PreseasonExposureContractInput {
  seasonPhase: SeasonPhase;
  readiness: ReadinessLevel;
  selectedDayNumbers: readonly number[];
  teamTrainingDayNumbers: readonly number[];
  hasGame: boolean;
  gameDay: number | null;
  weekKind?: WeekKind;
  activeReadinessTier?: GenerationReadinessTier;
  maxStrengthSessions?: number | null;
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

export interface PreseasonExposureAllocationLike {
  dayOfWeek?: string;
  isTeamDay?: boolean;
  tier?: string;
  isHardExposure?: boolean;
  stressLevel?: 'high' | 'medium' | 'low';
  strengthIntent?: { plannedPatterns?: readonly MainStrengthPattern[] };
  strengthPatternContributions?: readonly MainStrengthPattern[];
  conditioningCategory?: string;
  hasCombinedConditioning?: boolean;
  attachedConditioningKind?: string;
}

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
  | 'full_rest_shortfall';

export interface PreseasonExposureValidation {
  ledger: PreseasonExposureLedger;
  violations: Array<{
    code: PreseasonExposureViolationCode;
    expected: unknown;
    actual: unknown;
  }>;
}

const ALL_PATTERNS: readonly MainStrengthPattern[] = ['squat', 'hinge', 'push', 'pull'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function uniqueDays(days: readonly number[]): number[] {
  return Array.from(new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)));
}

function addReduction(
  reductions: PreseasonExposureReduction[],
  reduction: PreseasonExposureReduction,
): void {
  if (reductions.some((entry) => entry.domain === reduction.domain && entry.code === reduction.code)) return;
  reductions.push(reduction);
}

function injuryRestrictedRegions(input: PreseasonExposureContractInput): Set<'upper' | 'lower'> {
  const restricted = new Set<'upper' | 'lower'>();
  for (const injury of input.activeInjuries ?? []) {
    if (!injury.pauseAffectedTraining) continue;
    if (injury.region === 'upper_body') restricted.add('upper');
    if (injury.region === 'lower_body' || injury.region === 'back_midline') restricted.add('lower');
  }
  for (const injury of input.profileInjuries ?? []) {
    if (injury.severity !== 'Severe') continue;
    const text = `${injury.bodyArea} ${injury.description ?? ''}`.toLowerCase();
    if (/shoulder|elbow|wrist|hand|pec|upper/.test(text)) restricted.add('upper');
    if (/hip|knee|ankle|hamstring|groin|calf|achilles|lower back|lumbar|leg/.test(text)) {
      restricted.add('lower');
    }
  }
  return restricted;
}

function injuryRestrictedPatterns(
  input: PreseasonExposureContractInput,
  regions: ReadonlySet<'upper' | 'lower'>,
): Set<MainStrengthPattern> {
  const restricted = new Set<MainStrengthPattern>();
  if (regions.has('upper')) {
    restricted.add('push');
    restricted.add('pull');
  }
  if (regions.has('lower')) {
    restricted.add('squat');
    restricted.add('hinge');
  }
  for (const injury of input.activeInjuries ?? []) {
    if ((injury.effectiveSeverity ?? 0) < 4) continue;
    const keys = new Set(injury.injuryKeys ?? []);
    if (keys.has('shoulder')) restricted.add('push');
    if (keys.has('hamstring')) restricted.add('hinge');
    if (keys.has('knee')) restricted.add('squat');
    if (injury.region === 'back_midline') {
      restricted.add('squat');
      restricted.add('hinge');
    }
  }
  return restricted;
}

/**
 * Owns pre-season weekly exposure demand before any weekday is assigned.
 * Subphase policy may alter dose/intensity later; it cannot silently erase a
 * healthy required domain here.
 */
export function buildPreseasonWeeklyExposureContract(
  input: PreseasonExposureContractInput,
): PreseasonWeeklyExposureContract | null {
  if (input.seasonPhase !== 'Pre-season') return null;

  const selectedDays = uniqueDays(input.selectedDayNumbers);
  const selectedSet = new Set(selectedDays);
  const teamTrainingDays = uniqueDays(input.teamTrainingDayNumbers)
    .filter((day) => selectedSet.has(day));
  const creditedTeamTrainingCount = teamTrainingDays.length;
  const reductions: PreseasonExposureReduction[] = [];
  const restrictedRegions = injuryRestrictedRegions(input);
  const restrictedPatterns = injuryRestrictedPatterns(input, restrictedRegions);
  let requiredPatterns = ALL_PATTERNS.filter((pattern) => !restrictedPatterns.has(pattern));

  let strengthTarget = 4;
  let conditioningTarget = 4;
  let allowCombinedStrengthConditioning = true;

  if (input.hasGame && input.gameDay !== null) {
    strengthTarget = Math.min(strengthTarget, 3);
    conditioningTarget = creditedTeamTrainingCount;
    addReduction(reductions, {
      domain: 'strength', code: 'game_proximity',
      reason: 'Practice-match proximity limits the healthy no-game four-session strength structure.',
    });
    if (creditedTeamTrainingCount === 0) {
      strengthTarget = Math.min(strengthTarget, 2);
      requiredPatterns = requiredPatterns.filter((pattern) => pattern === 'push' || pattern === 'pull');
    }
    addReduction(reductions, {
      domain: 'conditioning', code: 'game_proximity',
      reason: 'The practice match owns the game-like running load, so app conditioning is removed around the match.',
    });
  }

  const readinessTier = input.activeReadinessTier;
  if (readinessTier === 'full_pause') {
    strengthTarget = 0;
    conditioningTarget = 0;
    requiredPatterns = [];
    addReduction(reductions, {
      domain: 'strength', code: 'full_pause',
      reason: 'An active full-pause readiness constraint temporarily removes strength training.',
    });
    addReduction(reductions, {
      domain: 'conditioning', code: 'full_pause',
      reason: 'An active full-pause readiness constraint temporarily removes conditioning.',
    });
  } else if (readinessTier === 'major_reduction') {
    strengthTarget = Math.min(strengthTarget, 1);
    conditioningTarget = Math.min(conditioningTarget, creditedTeamTrainingCount);
    addReduction(reductions, {
      domain: 'strength', code: 'readiness_reduction',
      reason: 'Major readiness reduction limits the week to one controlled safe strength exposure.',
    });
    addReduction(reductions, {
      domain: 'conditioning', code: 'readiness_reduction',
      reason: 'Major readiness reduction removes app-authored conditioning while preserving fixed anchors.',
    });
  } else if (readinessTier === 'moderate_reduction' || input.readiness === 'low') {
    strengthTarget = Math.min(strengthTarget, readinessTier === 'moderate_reduction' ? 3 : 2);
    conditioningTarget = Math.min(conditioningTarget, creditedTeamTrainingCount + 1);
    allowCombinedStrengthConditioning = false;
    addReduction(reductions, {
      domain: 'strength', code: 'readiness_reduction',
      reason: 'Low or moderately reduced readiness consolidates strength patterns into fewer controlled sessions.',
    });
    addReduction(reductions, {
      domain: 'conditioning', code: 'readiness_reduction',
      reason: 'Low or moderately reduced readiness keeps at most one additional low-stress conditioning exposure.',
    });
  }

  if (restrictedPatterns.size > 0) {
    const unrestrictedPatternCapacity = requiredPatterns.length;
    strengthTarget = Math.min(strengthTarget, unrestrictedPatternCapacity);
    addReduction(reductions, {
      domain: 'strength', code: 'injury_restriction',
      reason: `Active injury restrictions remove only the affected patterns: ${Array.from(restrictedPatterns).join(', ')}.`,
    });
  }

  if (input.maxStrengthSessions !== null && input.maxStrengthSessions !== undefined) {
    const capped = Math.min(strengthTarget, Math.max(0, input.maxStrengthSessions));
    if (capped < strengthTarget) {
      strengthTarget = capped;
      addReduction(reductions, {
        domain: 'strength', code: 'training_age_limit',
        reason: 'The training-age policy consolidates required patterns into fewer sessions.',
      });
      conditioningTarget = Math.min(conditioningTarget, creditedTeamTrainingCount + 2);
      allowCombinedStrengthConditioning = false;
      addReduction(reductions, {
        domain: 'conditioning', code: 'training_age_limit',
        reason: 'The training-age policy uses standalone low-stress conditioning instead of combined S+C days.',
      });
    }
  }

  const selectedTeamSet = new Set(teamTrainingDays);
  const sandwichedOnlyNonTeamDay = selectedDays.length <= 3 && selectedDays.some((day) =>
    !selectedTeamSet.has(day) &&
    selectedTeamSet.has((day + 6) % 7) &&
    selectedTeamSet.has((day + 1) % 7),
  );
  if (sandwichedOnlyNonTeamDay) {
    strengthTarget = Math.min(strengthTarget, teamTrainingDays.length);
    requiredPatterns = requiredPatterns.filter((pattern) => pattern === 'push' || pattern === 'pull');
    allowCombinedStrengthConditioning = false;
    addReduction(reductions, {
      domain: 'strength', code: 'reduced_availability',
      reason: 'The only non-team slot is sandwiched between field anchors, so heavy lower strength is not forced into it.',
    });
  }

  if (
    (input.readiness === 'low' || readinessTier === 'moderate_reduction' ||
      readinessTier === 'major_reduction' || readinessTier === 'full_pause') &&
    input.hasGame && input.gameDay !== null
  ) {
    strengthTarget = Math.min(strengthTarget, 1);
    requiredPatterns = requiredPatterns.filter((pattern) => pattern === 'push' || pattern === 'pull');
  }

  if (restrictedPatterns.size > 0 && input.hasGame && input.gameDay !== null) {
    strengthTarget = Math.min(strengthTarget, 1);
  }

  if (selectedDays.length <= 4 && input.hasGame && input.gameDay !== null) {
    strengthTarget = Math.min(strengthTarget, 1);
    requiredPatterns = requiredPatterns.filter((pattern) => pattern === 'push' || pattern === 'pull');
    addReduction(reductions, {
      domain: 'strength', code: 'reduced_availability',
      reason: 'Four-or-fewer selected training days in a game week consolidate the upper-body pair without forcing lower strength into game proximity.',
    });
  }

  if (selectedDays.length < strengthTarget) {
    strengthTarget = selectedDays.length;
    addReduction(reductions, {
      domain: 'strength', code: 'reduced_availability',
      reason: 'Selected-day availability requires combined-pattern strength sessions.',
    });
  }

  const nonTeamDayCount = selectedDays.filter((day) => !teamTrainingDays.includes(day)).length;
  const nonTeamDays = selectedDays
    .filter((day) => !teamTrainingDays.includes(day))
    .sort((a, b) => trainingOrder(a) - trainingOrder(b));
  const onlyLowerSlotsAreAdjacent =
    selectedDays.length <= 4 &&
    teamTrainingDays.length >= 2 &&
    nonTeamDays.length === 2 &&
    trainingOrder(nonTeamDays[1]) - trainingOrder(nonTeamDays[0]) === 1;
  if (!input.hasGame && onlyLowerSlotsAreAdjacent && strengthTarget >= 4) {
    strengthTarget = 3;
    addReduction(reductions, {
      domain: 'strength', code: 'reduced_availability',
      reason: 'Adjacent non-team slots consolidate squat and hinge into one lower session instead of forcing back-to-back lower loading.',
    });
  }
  if (nonTeamDayCount === 0 && strengthTarget > 0) {
    strengthTarget = Math.min(strengthTarget, 2);
    requiredPatterns = requiredPatterns.filter((pattern) => pattern === 'push' || pattern === 'pull');
    allowCombinedStrengthConditioning = false;
    addReduction(reductions, {
      domain: 'strength', code: 'reduced_availability',
      reason: 'All selected days are field anchors, so safe upper-body strength is consolidated onto team days.',
    });
  }
  const requestedAdditional = Math.max(0, conditioningTarget - creditedTeamTrainingCount);
  const feasibleAdditional = Math.min(requestedAdditional, nonTeamDayCount);
  if (feasibleAdditional < requestedAdditional) {
    conditioningTarget = creditedTeamTrainingCount + feasibleAdditional;
    addReduction(reductions, {
      domain: 'conditioning', code: 'reduced_availability',
      reason: 'No additional non-team day remains for another safe conditioning component.',
    });
  }

  if (strengthTarget === 0) requiredPatterns = [];

  return {
    strength: {
      requiredPatterns: [...requiredPatterns],
      targetCount: Math.max(0, strengthTarget),
    },
    conditioning: {
      targetCount: Math.max(0, conditioningTarget),
      creditedTeamTrainingCount,
      additionalRequiredCount: Math.max(0, conditioningTarget - creditedTeamTrainingCount),
      allowCombinedStrengthConditioning,
    },
    anchors: {
      teamTrainingDays,
      gameDay: input.hasGame ? input.gameDay : null,
    },
    recovery: {
      minimumFullRestDays: 2,
    },
    hardDays: {
      preferredCount: 4,
      // Five is the safe upper edge for pre-season structure, not a target.
      // Readiness reductions lower dose and requested exposure above; they do
      // not make fixed team anchors plus safe required work structurally
      // invalid merely because the resulting calendar uses five days.
      permittedCount: 5,
      isHardMaximum: false,
    },
    reductions,
  };
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

function dayNumber(name: string | undefined): number {
  if (!name) return -1;
  return DAY_NAMES.indexOf(name);
}

export function evaluatePreseasonExposureContract(
  contract: PreseasonWeeklyExposureContract,
  allocations: readonly PreseasonExposureAllocationLike[],
): PreseasonExposureValidation {
  const patterns = new Set<MainStrengthPattern>();
  const strengthDays = new Set<number>();
  const teamDays = new Set<number>();
  const conditioningDays = new Set<number>();
  const trainingDays = new Set<number>();
  const hardDays = new Set<number>();

  for (const allocation of allocations) {
    const day = dayNumber(allocation.dayOfWeek);
    if (day < 0) continue;
    const planned = allocation.strengthIntent?.plannedPatterns ?? allocation.strengthPatternContributions ?? [];
    if (planned.length > 0) {
      strengthDays.add(day);
      planned.forEach((pattern) => patterns.add(pattern));
    }
    if (allocation.isTeamDay) teamDays.add(day);
    if (allocation.conditioningCategory || allocation.hasCombinedConditioning) conditioningDays.add(day);
    if (allocation.isTeamDay || planned.length > 0 || allocation.conditioningCategory || allocation.hasCombinedConditioning) {
      trainingDays.add(day);
    }
    if (allocation.isTeamDay || allocation.isHardExposure || allocation.stressLevel === 'high') hardDays.add(day);
  }

  const additionalConditioningDays = Array.from(conditioningDays)
    .filter((day) => !teamDays.has(day));
  const ledger: PreseasonExposureLedger = {
    strengthPatterns: ALL_PATTERNS.filter((pattern) => patterns.has(pattern)),
    strengthContributionCount: strengthDays.size,
    teamTrainingCount: teamDays.size,
    additionalConditioningCount: additionalConditioningDays.length,
    conditioningExposureCount: teamDays.size + additionalConditioningDays.length,
    trainingDayCount: trainingDays.size,
    hardDayCount: hardDays.size,
    fullRestDayCount: Math.max(0, 7 - trainingDays.size),
  };
  const violations: PreseasonExposureValidation['violations'] = [];
  for (const pattern of contract.strength.requiredPatterns) {
    if (!patterns.has(pattern)) {
      violations.push({ code: 'missing_strength_pattern', expected: pattern, actual: ledger.strengthPatterns });
    }
  }
  if (ledger.strengthContributionCount < contract.strength.targetCount) {
    violations.push({
      code: 'strength_target_shortfall',
      expected: contract.strength.targetCount,
      actual: ledger.strengthContributionCount,
    });
  }
  if (ledger.conditioningExposureCount < contract.conditioning.targetCount) {
    violations.push({
      code: 'conditioning_target_shortfall',
      expected: contract.conditioning.targetCount,
      actual: ledger.conditioningExposureCount,
    });
  }
  if (ledger.teamTrainingCount !== contract.conditioning.creditedTeamTrainingCount) {
    violations.push({
      code: 'team_credit_mismatch',
      expected: contract.conditioning.creditedTeamTrainingCount,
      actual: ledger.teamTrainingCount,
    });
  }
  if (ledger.hardDayCount > contract.hardDays.permittedCount) {
    violations.push({
      code: 'hard_day_limit_exceeded',
      expected: contract.hardDays.permittedCount,
      actual: ledger.hardDayCount,
    });
  }
  if (ledger.fullRestDayCount < contract.recovery.minimumFullRestDays) {
    violations.push({
      code: 'full_rest_shortfall',
      expected: contract.recovery.minimumFullRestDays,
      actual: ledger.fullRestDayCount,
    });
  }
  return { ledger, violations };
}
