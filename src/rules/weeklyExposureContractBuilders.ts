import type {
  InjurySeverity,
  ReadinessLevel,
  SeasonPhase,
  WeekKind,
} from '../types/domain';
import type { GenerationReadinessTier } from '../utils/generationConstraints';
import { resolveWeekIntensityMultiplier } from './deloadWeekRules';
import type { OffseasonSubphase } from './offseasonSubphase';
import type { PreseasonSubphase } from './preseasonSubphase';
import type { MainStrengthPattern } from './strengthPatternContributions';
import {
  resolveSection18PhasePlannerSelection,
  type Section18PhasePlannerSelection,
  type Section18WeekMode,
} from './weeklyExposureContractV2';
import {
  addExposureReduction,
  trainingOrder,
  uniqueExposureDays,
  withExposureTarget,
  type WeeklyExposureContract,
  type WeeklyExposureContractMode,
  type WeeklyExposureContractSubphase,
  type WeeklyExposureDomain,
  type WeeklyExposureReductionReason,
} from './weeklyExposureContract';

export interface WeeklyExposureContractInput {
  seasonPhase: SeasonPhase;
  readiness: ReadinessLevel;
  selectedDayNumbers: readonly number[];
  teamTrainingDayNumbers: readonly number[];
  hasGame: boolean;
  gameDay: number | null;
  weekKind?: WeekKind;
  offseasonSubphase?: OffseasonSubphase | null;
  preseasonSubphase?: PreseasonSubphase | null;
  activeReadinessTier?: GenerationReadinessTier;
  maxStrengthSessions?: number | null;
  /** False means the resolved equipment set cannot deliver an app conditioning block. */
  appConditioningFeasible?: boolean;
  profileInjuries?: ReadonlyArray<{
    bodyArea: string;
    description?: string;
    severity?: InjurySeverity;
  }>;
  activeInjuries?: ReadonlyArray<{
    region: 'lower_body' | 'upper_body' | 'back_midline' | 'other';
    pauseAffectedTraining: boolean;
    removeRiskyWork?: boolean;
    effectiveSeverity?: number;
    /** Compatibility projection used by GenerationConstraintContext. */
    severity?: number;
    triggers?: readonly string[];
    injuryKeys?: readonly string[];
  }>;
  /** Explicit caller decision; omitted lets readiness/injury choose the mode. */
  byeMode?: 'build' | 'recovery';
}

const ALL_PATTERNS: readonly MainStrengthPattern[] = ['squat', 'hinge', 'push', 'pull'];

interface BaseTargets {
  mode: WeeklyExposureContractMode;
  subphase: WeeklyExposureContractSubphase;
  strength: { required: number; preferredMin: number; preferredMax: number; selectedTarget?: number };
  conditioning: { required: number; preferredMin: number; preferredMax: number; selectedTarget?: number };
  sprintCod: { required: number; preferredMin: number; preferredMax: number; selectedTarget?: number };
  fullRest: { required: number; preferredMin: number; preferredMax: number };
  allowCombined: boolean;
  preferredHardDays: number;
  permittedHardDays: number;
}

function phaseSelection(
  input: WeeklyExposureContractInput,
  mode: Section18WeekMode,
): Section18PhasePlannerSelection {
  return resolveSection18PhasePlannerSelection({
    mode,
    readiness: input.readiness,
    availableDayCount: uniqueExposureDays(input.selectedDayNumbers).length,
    teamTrainingCount: uniqueExposureDays(input.teamTrainingDayNumbers).length,
    weekKind: input.weekKind,
  });
}

function createBaseContract(
  input: WeeklyExposureContractInput,
  targets: BaseTargets,
): WeeklyExposureContract {
  const selected = uniqueExposureDays(input.selectedDayNumbers);
  const selectedSet = new Set(selected);
  const teamDays = uniqueExposureDays(input.teamTrainingDayNumbers)
    .filter((day) => selectedSet.has(day));
  const fixtureCredit = input.hasGame && input.gameDay !== null ? 1 : 0;
  const anchorCredit = teamDays.length + fixtureCredit;
  const conditioningRequired = Math.max(targets.conditioning.required, anchorCredit);
  const selectedConditioning = Math.max(
    targets.conditioning.selectedTarget ?? targets.conditioning.required,
    anchorCredit,
  );
  return {
    protocolVersion: 1,
    identity: {
      phase: input.seasonPhase,
      subphase: targets.subphase,
      mode: targets.mode,
      weekKind: input.weekKind ?? 'build',
    },
    strength: {
      requiredPatterns: targets.strength.required > 0 ? [...ALL_PATTERNS] : [],
      targetCount: targets.strength.selectedTarget ?? targets.strength.required,
      required: targets.strength.required,
      preferred: { min: targets.strength.preferredMin, max: targets.strength.preferredMax },
    },
    conditioning: {
      targetCount: selectedConditioning,
      required: conditioningRequired,
      preferred: {
        min: Math.max(targets.conditioning.preferredMin, anchorCredit),
        max: Math.max(targets.conditioning.preferredMax, anchorCredit),
      },
      creditedTeamTrainingCount: teamDays.length,
      creditedGameOrPracticeMatchCount: fixtureCredit,
      additionalRequiredCount: Math.max(0, selectedConditioning - anchorCredit),
      allowCombinedStrengthConditioning: targets.allowCombined,
    },
    sprintCod: {
      targetCount: targets.sprintCod.selectedTarget ?? targets.sprintCod.required,
      required: targets.sprintCod.required,
      preferred: {
        min: targets.sprintCod.preferredMin,
        max: targets.sprintCod.preferredMax,
      },
      creditedTeamTrainingCount: teamDays.length,
      creditedGameOrPracticeMatchCount: fixtureCredit,
      additionalRequiredCount: Math.max(
        0,
        (targets.sprintCod.selectedTarget ?? targets.sprintCod.required) - anchorCredit,
      ),
    },
    anchors: {
      teamTrainingDays: teamDays,
      gameDay: input.hasGame ? input.gameDay : null,
      gameOrPracticeMatchCredit: fixtureCredit,
    },
    fullRest: {
      required: targets.fullRest.required,
      preferred: { min: targets.fullRest.preferredMin, max: targets.fullRest.preferredMax },
    },
    recovery: { minimumFullRestDays: targets.fullRest.required },
    hardDays: {
      preferredCount: targets.preferredHardDays,
      permittedCount: targets.permittedHardDays,
      isHardMaximum: false,
    },
    reductions: [],
  };
}

function reduce(
  contract: WeeklyExposureContract,
  domain: WeeklyExposureDomain,
  to: number,
  reason: WeeklyExposureReductionReason,
  detail: string,
): WeeklyExposureContract {
  return withExposureTarget(contract, domain, to, reason, detail);
}

function reduceAllocationTarget(
  initial: WeeklyExposureContract,
  domain: Exclude<WeeklyExposureDomain, 'full_rest'>,
  to: number,
  reason: WeeklyExposureReductionReason,
  detail: string,
): WeeklyExposureContract {
  const contract = reduce(initial, domain, to, reason, detail);
  const target = Math.max(0, Math.floor(to));
  const current = domain === 'main_strength'
    ? contract.strength.targetCount
    : domain === 'conditioning'
      ? contract.conditioning.targetCount
      : contract.sprintCod.targetCount;
  if (target >= current) return contract;
  addExposureReduction(contract.reductions, {
    domain,
    reason,
    metric: 'weekly_exposure_count',
    from: current,
    to: target,
    detail,
  });
  if (domain === 'main_strength') {
    contract.strength.targetCount = target;
    contract.strength.preferred.min = Math.min(contract.strength.preferred.min, target);
    contract.strength.preferred.max = Math.min(contract.strength.preferred.max, target);
  } else if (domain === 'conditioning') {
    contract.conditioning.targetCount = target;
    contract.conditioning.preferred.min = Math.min(contract.conditioning.preferred.min, target);
    contract.conditioning.preferred.max = Math.min(contract.conditioning.preferred.max, target);
  } else {
    contract.sprintCod.targetCount = target;
    contract.sprintCod.preferred.min = Math.min(contract.sprintCod.preferred.min, target);
    contract.sprintCod.preferred.max = Math.min(contract.sprintCod.preferred.max, target);
  }
  return contract;
}

/** Shared typed constraint projection; policy consumers must not reclassify injuries independently. */
export function resolveRestrictedMainStrengthPatterns(
  input: Pick<WeeklyExposureContractInput, 'activeInjuries' | 'profileInjuries'>,
): Set<MainStrengthPattern> {
  const restricted = new Set<MainStrengthPattern>();
  for (const injury of input.activeInjuries ?? []) {
    if (!injury.pauseAffectedTraining &&
        (injury.effectiveSeverity ?? injury.severity ?? 0) < 6) continue;
    const keys = new Set(injury.injuryKeys ?? []);
    if (injury.region === 'upper_body') {
      restricted.add('push');
      if (injury.pauseAffectedTraining) restricted.add('pull');
    }
    if (injury.region === 'lower_body' || injury.region === 'back_midline') {
      restricted.add('squat');
      restricted.add('hinge');
    }
    if (keys.has('shoulder')) restricted.add('push');
    if (keys.has('hamstring')) restricted.add('hinge');
    if (keys.has('knee')) restricted.add('squat');
  }
  for (const injury of input.profileInjuries ?? []) {
    if (injury.severity !== 'Severe') continue;
    const text = `${injury.bodyArea} ${injury.description ?? ''}`.toLowerCase();
    if (/shoulder|elbow|wrist|hand|pec|upper/.test(text)) restricted.add('push');
    if (/hip|knee|ankle|hamstring|groin|calf|achilles|lower back|lumbar|leg/.test(text)) {
      restricted.add('squat');
      restricted.add('hinge');
    }
  }
  return restricted;
}

function applyCommonSafetyReductions(
  initial: WeeklyExposureContract,
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  let contract = initial;
  const selected = uniqueExposureDays(input.selectedDayNumbers);
  const selectedSet = new Set(selected);
  const teamDays = uniqueExposureDays(input.teamTrainingDayNumbers).filter((day) => selectedSet.has(day));
  const anchorCredit = teamDays.length + (input.hasGame && input.gameDay !== null ? 1 : 0);
  const nonTeamDays = selected.filter((day) => !teamDays.includes(day) && day !== input.gameDay);
  const gameOffset = (day: number): number | null => {
    if (!input.hasGame || input.gameDay === null) return null;
    let offset = day - input.gameDay;
    if (offset > 0) offset -= 7;
    return offset === -6 ? 1 : offset;
  };
  const conditioningPlacementDays = nonTeamDays.filter((day) => {
    const offset = gameOffset(day);
    if (offset === null) return true;
    return offset !== -2 && offset !== -1 && offset !== 1;
  });
  const sprintPlacementDays = nonTeamDays.filter((day) => {
    const offset = gameOffset(day);
    if (offset === null) return true;
    return offset !== -2 && offset !== -1 && offset !== 1;
  });

  const tier = input.activeReadinessTier;
  if (tier === 'slight_reduction') {
    contract = reduceAllocationTarget(contract, 'sprint_cod', Math.min(3, anchorCredit), 'low_readiness',
      'Slight readiness reduction removes app-authored sprint while preserving normal anchor exposure.');
  } else if (tier === 'full_pause') {
    contract = reduceAllocationTarget(contract, 'main_strength', 0, 'full_pause',
      'The active full-pause readiness state removes app training.');
    contract.strength.requiredPatterns = [];
    contract = reduceAllocationTarget(contract, 'conditioning', anchorCredit, 'full_pause',
      'Only unavoidable team/game anchors remain during a full pause.');
    contract = reduceAllocationTarget(contract, 'sprint_cod', Math.min(3, anchorCredit), 'full_pause',
      'Only unavoidable team/game sprint credit remains during a full pause.');
  } else if (tier === 'major_reduction') {
    contract = reduceAllocationTarget(contract, 'main_strength', 0, 'low_readiness',
      'Major readiness reduction authorises a recovery-only app week when final safe content contains no main strength.');
    contract.strength.requiredPatterns = [];
    contract = reduceAllocationTarget(contract, 'conditioning', anchorCredit, 'low_readiness',
      'Major readiness reduction removes app-authored conditioning.');
    contract = reduceAllocationTarget(contract, 'sprint_cod', Math.min(3, anchorCredit), 'low_readiness',
      'Major readiness reduction removes app-authored sprint/COD.');
  } else if (tier === 'moderate_reduction' || input.readiness === 'low') {
    contract = reduceAllocationTarget(contract, 'main_strength', Math.min(2, selected.length), 'low_readiness',
      'Low or moderately reduced readiness consolidates strength into controlled sessions.');
    contract = reduceAllocationTarget(contract, 'conditioning', anchorCredit + Math.min(1, conditioningPlacementDays.length), 'low_readiness',
      'Low readiness keeps at most one low-stress app conditioning exposure.');
    contract = reduceAllocationTarget(contract, 'sprint_cod', Math.min(3, anchorCredit), 'low_readiness',
      'Low readiness removes app-authored sprint/COD.');
    contract.conditioning.allowCombinedStrengthConditioning = false;
  }

  const blockedPatterns = resolveRestrictedMainStrengthPatterns(input);
  if (blockedPatterns.size > 0) {
    const allowed = ALL_PATTERNS.filter((pattern) => !blockedPatterns.has(pattern));
    contract.strength.requiredPatterns = contract.strength.required > 0 ? allowed : [];
    addExposureReduction(contract.reductions, {
      domain: 'main_strength',
      reason: 'injury_restriction',
      metric: 'strength_pattern_count',
      from: ALL_PATTERNS.length,
      to: allowed.length,
      detail: `Active injury restrictions remove affected strength patterns: ${Array.from(blockedPatterns).join(', ')}.`,
    });
    contract = reduceAllocationTarget(contract, 'main_strength', Math.min(contract.strength.targetCount, allowed.length),
      'injury_restriction',
      `Active injury restrictions remove affected strength patterns: ${Array.from(blockedPatterns).join(', ')}.`);
    const lowerBlocked = blockedPatterns.has('squat') || blockedPatterns.has('hinge');
    if (lowerBlocked) {
      contract = reduceAllocationTarget(contract, 'sprint_cod', Math.min(3, anchorCredit), 'injury_restriction',
        'A lower-limb or back restriction removes app-authored sprint/COD.');
    }
  }

  const activeInjuryBlocksSprint = (input.activeInjuries ?? []).some((injury) => {
    if (injury.region !== 'lower_body' && injury.region !== 'back_midline') return false;
    const sprintTrigger = /\b(sprint|speed|max velocity|running|cod|change of direction|cutting|jumping)\b/i
      .test((injury.triggers ?? []).join(' '));
    return injury.pauseAffectedTraining || injury.removeRiskyWork === true || sprintTrigger;
  });
  if (activeInjuryBlocksSprint) {
    contract = reduceAllocationTarget(contract, 'sprint_cod', Math.min(3, anchorCredit),
      'injury_restriction',
      'An active lower-body or back restriction explicitly removes app-authored sprint/COD.');
  }

  if (input.seasonPhase === 'Pre-season' && teamDays.length > 0 && nonTeamDays.length === 0) {
    contract.strength.requiredPatterns = contract.strength.required > 0 ? ['push', 'pull'] : [];
    addExposureReduction(contract.reductions, {
      domain: 'main_strength',
      reason: 'spacing_safety_conflict',
      metric: 'strength_pattern_count',
      from: ALL_PATTERNS.length,
      to: 2,
      detail: 'Every available day is a team-training anchor, so required gym pattern coverage is limited to safe upper-body work.',
    });
  }

  if (input.maxStrengthSessions !== null && input.maxStrengthSessions !== undefined) {
    contract = reduceAllocationTarget(contract, 'main_strength', Math.min(contract.strength.targetCount, input.maxStrengthSessions),
      'training_age_limit',
      'Training-age policy consolidates the weekly strength dose.');
    if (input.maxStrengthSessions <= 2) {
      contract.conditioning.allowCombinedStrengthConditioning = false;
    }
  }

  contract = reduceAllocationTarget(contract, 'main_strength', Math.min(contract.strength.targetCount, selected.length),
    'insufficient_availability',
    'Selected-day availability cannot safely hold the original strength target.');
  const maximumConditioning = anchorCredit + conditioningPlacementDays.length;
  contract = reduceAllocationTarget(contract, 'conditioning', Math.min(contract.conditioning.targetCount, maximumConditioning),
    'insufficient_availability',
    'No additional safe non-anchor slot remains for conditioning.');
  contract = reduceAllocationTarget(contract, 'sprint_cod', Math.min(contract.sprintCod.targetCount, anchorCredit + sprintPlacementDays.length),
    'insufficient_availability',
    'No additional safe non-anchor slot remains for sprint/COD.');

  if (input.appConditioningFeasible === false && contract.conditioning.additionalRequiredCount > 0) {
    contract = reduceAllocationTarget(contract, 'conditioning', anchorCredit, 'equipment_infeasibility',
      'Resolved equipment capabilities cannot deliver a safe app conditioning modality.');
  }

  if (!contract.conditioning.allowCombinedStrengthConditioning) {
    const standaloneConditioningCapacity = Math.max(
      0,
      conditioningPlacementDays.length - contract.strength.targetCount,
    );
    contract = reduceAllocationTarget(
      contract,
      'conditioning',
      Math.min(contract.conditioning.targetCount, anchorCredit + standaloneConditioningCapacity),
      'insufficient_availability',
      'Required strength owns the available app slots and combined conditioning is not authorised.',
    );
  }

  if (input.weekKind === 'deload') {
    const intensityPercent = Math.round(
      resolveWeekIntensityMultiplier(input.seasonPhase, input.weekKind) * 100,
    );
    if (intensityPercent < 100) {
      addExposureReduction(contract.reductions, {
        domain: 'main_strength',
        reason: 'deload_policy',
        metric: 'session_intensity_percent',
        from: 100,
        to: intensityPercent,
        detail: 'The phase deload policy reduces session intensity while retaining safe movement-pattern frequency.',
      });
    }
    const appConditioningBeforeDeload = Math.max(
      0,
      contract.conditioning.targetCount - anchorCredit,
    );
    const appConditioningAfterDeload = anchorCredit >= 2
      ? Math.min(1, appConditioningBeforeDeload)
      : Math.min(2, Math.max(0, appConditioningBeforeDeload - 1));
    contract = reduceAllocationTarget(
      contract,
      'conditioning',
      anchorCredit + appConditioningAfterDeload,
      'deload_policy',
      'Deload policy preserves anchors and keeps at most two controlled app exposures, including one restorative top-up when anchor load is already high.',
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

function byeRecoveryMode(input: WeeklyExposureContractInput): boolean {
  if (input.byeMode) return input.byeMode === 'recovery';
  return input.weekKind === 'deload' || input.readiness === 'low' ||
    input.activeReadinessTier === 'moderate_reduction' ||
    input.activeReadinessTier === 'major_reduction' ||
    input.activeReadinessTier === 'full_pause' ||
    (input.activeInjuries ?? []).some((injury) => injury.pauseAffectedTraining);
}

export function buildInSeasonGameWeekExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  const selected = phaseSelection(input, 'in_season_game_week');
  const anchorCount = uniqueExposureDays(input.teamTrainingDayNumbers).length + 1;
  let contract = applyCommonSafetyReductions(createBaseContract(input, {
    mode: 'in_season_game_week',
    subphase: 'game_week',
    strength: { required: 2, preferredMin: 2, preferredMax: 3, selectedTarget: selected.mainStrength },
    conditioning: { required: Math.max(3, anchorCount), preferredMin: Math.max(3, anchorCount), preferredMax: Math.max(3, anchorCount), selectedTarget: selected.coreConditioning },
    // The game/team anchors satisfy the shared floor without inflating it.
    sprintCod: { required: 1, preferredMin: 1, preferredMax: 1, selectedTarget: selected.sprintHighSpeed },
    fullRest: { required: 1, preferredMin: 1, preferredMax: 2 },
    allowCombined: true,
    preferredHardDays: 4,
    permittedHardDays: 5,
  }), input);
  if (input.gameDay !== null) {
    const safeStrengthCapacity = uniqueExposureDays(input.selectedDayNumbers).filter((day) => {
      let offset = day - input.gameDay!;
      if (offset > 0) offset -= 7;
      if (offset === -6) offset = 1;
      return offset !== 0 && offset !== -1 && offset !== 1;
    }).length;
    contract = reduceAllocationTarget(
      contract,
      'main_strength',
      Math.min(contract.strength.targetCount, safeStrengthCapacity),
      'spacing_safety_conflict',
      'Game-day, G-1 and G+1 protection leave fewer safe gym placements in this selected week.',
    );
  }
  return contract;
}

export function buildInSeasonByeBuildExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  const selected = phaseSelection(input, 'in_season_bye_build');
  return applyCommonSafetyReductions(createBaseContract(input, {
    mode: 'in_season_bye_build',
    subphase: 'bye_build',
    strength: { required: 2, preferredMin: 3, preferredMax: 4, selectedTarget: selected.mainStrength },
    conditioning: { required: 3, preferredMin: 3, preferredMax: 3, selectedTarget: selected.coreConditioning },
    sprintCod: { required: 1, preferredMin: 1, preferredMax: 1, selectedTarget: selected.sprintHighSpeed },
    fullRest: { required: 1, preferredMin: 1, preferredMax: 2 },
    allowCombined: true,
    preferredHardDays: 4,
    permittedHardDays: 5,
  }), input);
}

export function buildInSeasonByeRecoveryExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  const selected = phaseSelection(input, 'in_season_bye_recovery');
  const teams = uniqueExposureDays(input.teamTrainingDayNumbers).length;
  let contract = createBaseContract(input, {
    mode: 'in_season_bye_recovery',
    subphase: 'bye_recovery',
    strength: { required: 2, preferredMin: 2, preferredMax: 2, selectedTarget: selected.mainStrength },
    conditioning: { required: 0, preferredMin: 0, preferredMax: teams, selectedTarget: selected.coreConditioning },
    sprintCod: { required: 1, preferredMin: 1, preferredMax: 1, selectedTarget: selected.sprintHighSpeed },
    fullRest: { required: 2, preferredMin: 2, preferredMax: 3 },
    allowCombined: false,
    preferredHardDays: 2,
    permittedHardDays: 4,
  });
  for (const domain of ['main_strength', 'conditioning', 'sprint_cod'] as WeeklyExposureDomain[]) {
    const before = domain === 'main_strength' ? 3 :
      domain === 'conditioning' ? 3 : 1;
    const after = domain === 'main_strength' ? contract.strength.required :
      domain === 'conditioning' ? contract.conditioning.required : contract.sprintCod.required;
    addExposureReduction(contract.reductions, {
      domain,
      reason: 'bye_recovery_mode',
      metric: 'weekly_exposure_count',
      from: before,
      to: after,
      detail: 'Bye recovery mode spends the missing game slot on restoration, not extra build work.',
    });
  }
  if (teams === 0) {
    contract = reduceAllocationTarget(
      contract,
      'sprint_cod',
      0,
      'bye_recovery_mode',
      'Bye recovery without a genuine team anchor removes app-authored sprint/high-speed work.',
    );
  }
  return applyCommonSafetyReductions(contract, input);
}

export function buildInSeasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  if (input.hasGame && input.gameDay !== null) return buildInSeasonGameWeekExposureContract(input);
  return byeRecoveryMode(input)
    ? buildInSeasonByeRecoveryExposureContract(input)
    : buildInSeasonByeBuildExposureContract(input);
}

export function buildEarlyOffseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  const selected = phaseSelection(input, 'early_offseason');
  const contract = createBaseContract(input, {
    mode: 'early_offseason', subphase: 'early_offseason',
    // Bible first 1-2 weeks: everything is optional. Preferred work remains explicit.
    strength: { required: 0, preferredMin: 2, preferredMax: 3, selectedTarget: 0 },
    conditioning: { required: 0, preferredMin: 1, preferredMax: 2, selectedTarget: 0 },
    sprintCod: { required: 0, preferredMin: 0, preferredMax: 0, selectedTarget: 0 },
    fullRest: { required: 2, preferredMin: 2, preferredMax: 3 },
    allowCombined: false,
    preferredHardDays: 2,
    permittedHardDays: 4,
  });
  const reduced = applyCommonSafetyReductions(contract, input);
  if (
    (input.activeReadinessTier === 'major_reduction' ||
      input.activeReadinessTier === 'full_pause') &&
    selected.optionalMainStrength > 0
  ) {
    addExposureReduction(reduced.reductions, {
      domain: 'main_strength',
      reason: input.activeReadinessTier === 'full_pause' ? 'full_pause' : 'low_readiness',
      metric: 'weekly_exposure_count',
      from: selected.optionalMainStrength,
      to: 0,
      detail: 'Typed readiness ownership removes planner-selected optional early off-season strength.',
    });
  }
  return reduced;
}

export function buildMidOffseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  const selected = phaseSelection(input, 'mid_offseason');
  return applyCommonSafetyReductions(createBaseContract(input, {
    mode: 'mid_offseason', subphase: 'mid_offseason',
    strength: { required: 3, preferredMin: 3, preferredMax: 4, selectedTarget: selected.mainStrength },
    conditioning: { required: 3, preferredMin: 3, preferredMax: 4, selectedTarget: selected.coreConditioning },
    sprintCod: { required: 1, preferredMin: 1, preferredMax: 1, selectedTarget: selected.sprintHighSpeed },
    fullRest: { required: 2, preferredMin: 2, preferredMax: 2 },
    allowCombined: true,
    preferredHardDays: 4,
    permittedHardDays: 5,
  }), input);
}

export function buildLateOffseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  const selected = phaseSelection(input, 'late_offseason');
  return applyCommonSafetyReductions(createBaseContract(input, {
    mode: 'late_offseason', subphase: 'late_offseason',
    strength: { required: 3, preferredMin: 3, preferredMax: 4, selectedTarget: selected.mainStrength },
    conditioning: { required: 3, preferredMin: 3, preferredMax: 4, selectedTarget: selected.coreConditioning },
    sprintCod: { required: 1, preferredMin: 1, preferredMax: 2, selectedTarget: selected.sprintHighSpeed },
    fullRest: { required: 1, preferredMin: 1, preferredMax: 2 },
    allowCombined: true,
    preferredHardDays: 4,
    permittedHardDays: 5,
  }), input);
}

export function buildOffseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  if (input.offseasonSubphase === 'early_offseason') return buildEarlyOffseasonExposureContract(input);
  if (input.offseasonSubphase === 'late_offseason') return buildLateOffseasonExposureContract(input);
  return buildMidOffseasonExposureContract(input);
}

function buildPreseasonBase(
  input: WeeklyExposureContractInput,
  targets: BaseTargets,
): WeeklyExposureContract {
  const selected = phaseSelection(
    input,
    input.hasGame && input.gameDay !== null ? 'practice_match_week' : targets.mode,
  );
  let contract = createBaseContract(input, {
    ...targets,
    strength: { ...targets.strength, selectedTarget: selected.mainStrength },
    conditioning: { ...targets.conditioning, selectedTarget: selected.coreConditioning },
    sprintCod: { ...targets.sprintCod, selectedTarget: selected.sprintHighSpeed },
  });
  contract = applyCommonSafetyReductions(contract, input);
  if (input.hasGame && input.gameDay !== null) {
    const safeStrengthCapacity = uniqueExposureDays(input.selectedDayNumbers).filter((day) => {
      let offset = day - input.gameDay!;
      if (offset > 0) offset -= 7;
      if (offset === -6) offset = 1;
      return offset !== 0 && offset !== -1 && offset !== 1;
    }).length;
    contract = reduceAllocationTarget(
      contract,
      'main_strength',
      Math.min(contract.strength.targetCount, safeStrengthCapacity),
      'spacing_safety_conflict',
      'Practice-match, G-1 and G+1 protection leave fewer safe gym placements in this selected week.',
    );
  }
  return contract;
}

export function buildEarlyPreseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  return buildPreseasonBase(input, {
    mode: 'early_preseason', subphase: 'early_preseason',
    strength: { required: 3, preferredMin: 4, preferredMax: 4 },
    conditioning: { required: 3, preferredMin: 4, preferredMax: 4 },
    sprintCod: { required: 1, preferredMin: 1, preferredMax: 1 },
    fullRest: { required: 2, preferredMin: 2, preferredMax: 2 },
    allowCombined: true,
    preferredHardDays: 4,
    permittedHardDays: 5,
  });
}

export function buildMidPreseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  return buildPreseasonBase(input, {
    mode: 'mid_preseason', subphase: 'mid_preseason',
    strength: { required: 3, preferredMin: 4, preferredMax: 4 },
    conditioning: { required: 3, preferredMin: 4, preferredMax: 4 },
    sprintCod: { required: 1, preferredMin: 1, preferredMax: 1 },
    fullRest: { required: 2, preferredMin: 2, preferredMax: 2 },
    allowCombined: true,
    preferredHardDays: 4,
    permittedHardDays: 5,
  });
}

export function buildLatePreseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  return buildPreseasonBase(input, {
    mode: 'late_preseason', subphase: 'late_preseason',
    strength: { required: 3, preferredMin: 4, preferredMax: 4 },
    conditioning: { required: 3, preferredMin: 4, preferredMax: 4 },
    sprintCod: { required: 1, preferredMin: 1, preferredMax: 1 },
    fullRest: { required: 2, preferredMin: 2, preferredMax: 2 },
    allowCombined: true,
    preferredHardDays: 4,
    permittedHardDays: 5,
  });
}

export function buildPreseasonExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  if (input.preseasonSubphase === 'early_preseason') return buildEarlyPreseasonExposureContract(input);
  if (input.preseasonSubphase === 'late_preseason') return buildLatePreseasonExposureContract(input);
  return buildMidPreseasonExposureContract(input);
}

export function buildWeeklyExposureContract(
  input: WeeklyExposureContractInput,
): WeeklyExposureContract {
  if (input.seasonPhase === 'In-season') return buildInSeasonExposureContract(input);
  if (input.seasonPhase === 'Off-season') {
    // A stale onboarding game-day value is not an off-season fixture anchor.
    // Off-season allocation has no game projection and must not manufacture
    // fixture credit or G-relative safety rules that its phase does not own.
    return buildOffseasonExposureContract({ ...input, hasGame: false, gameDay: null });
  }
  return buildPreseasonExposureContract(input);
}

/** Deterministic helper for target-week construction and tests. */
export function selectedExposureDaysFromCount(count: number): number[] {
  return [1, 2, 3, 4, 5, 6, 0]
    .sort((a, b) => trainingOrder(a) - trainingOrder(b))
    .slice(0, Math.max(0, Math.min(7, Math.floor(count))));
}
