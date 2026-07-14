/**
 * Active safety projection for Section 18 Contract v2.
 *
 * Generation constraints are the typed source of truth. This module projects
 * them into the persisted contract without looking at whatever workout content
 * happened to survive. The post-canonical finaliser must conform to this
 * policy; it must never lower the policy to match unsafe output.
 */

import type { GenerationConstraintContext } from '../utils/generationConstraints';
import { resolveRestrictedMainStrengthPatterns } from './weeklyExposureContractBuilders';
import type { MainStrengthPattern } from './strengthPatternContributions';
import {
  refreshSection18SafetyPolicy,
  type AnchorParticipationState,
  type Section18AuthorisedReduction,
  type Section18ReductionMetric,
  type Section18SafetyDomain,
  type WeeklyExposureContractV2,
} from './weeklyExposureContractV2';
import type { WeeklyExposureReductionReason } from './weeklyExposureContract';

const PATTERNS: readonly MainStrengthPattern[] = ['squat', 'hinge', 'push', 'pull'];

function cloneContract(contract: WeeklyExposureContractV2): WeeklyExposureContractV2 {
  return JSON.parse(JSON.stringify(contract)) as WeeklyExposureContractV2;
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function selectedMainStrengthTarget(contract: WeeklyExposureContractV2): number {
  return Math.max(
    contract.mainStrength.exposure.plannerSelectedTarget ??
      contract.mainStrength.exposure.defaultTarget,
    contract.mainStrength.optionalMainStrengthSelected,
  );
}

function addReduction(
  contract: WeeklyExposureContractV2,
  args: {
    metric: Section18ReductionMetric;
    reducedTarget: number;
    reason: WeeklyExposureReductionReason;
    scope?: Section18AuthorisedReduction['scope'];
    change?: Section18AuthorisedReduction['change'];
    detail: string;
  },
): void {
  const originalPolicy = args.metric === 'main_strength_frequency'
    ? contract.mainStrength.exposure
    : args.metric === 'conditioning_core_frequency'
      ? contract.conditioning.core
      : args.metric === 'sprint_high_speed_frequency'
        ? contract.sprintHighSpeed.exposure
        : null;
  const originalApprovedTarget = args.metric === 'main_strength_frequency'
    ? Math.max(args.reducedTarget, selectedMainStrengthTarget(contract))
    : args.metric === 'strength_pattern_count'
      ? PATTERNS.length
      : args.metric === 'power_primer_budget'
        ? Math.max(
            0,
            contract.power.plannerSelectedWeeklyBudget ?? contract.power.preferredWeeklyRange.max,
          )
        : Math.max(
            args.reducedTarget,
            originalPolicy?.plannerSelectedTarget ?? originalPolicy?.defaultTarget ?? args.reducedTarget,
          );
  const alreadyPresent = contract.authorisedReductions.some((entry) =>
    entry.metric === args.metric && entry.reason === args.reason &&
    entry.reducedTarget <= args.reducedTarget,
  );
  if (!alreadyPresent) {
    contract.authorisedReductions.push({
      metric: args.metric,
      originalApprovedTarget,
      reducedTarget: Math.max(0, args.reducedTarget),
      reason: args.reason,
      scope: args.scope ?? 'week',
      change: args.change ?? 'frequency',
      detail: args.detail,
      provenance: 'live_typed_reduction',
    });
  }
}

function effectiveFrequencyCeiling(
  contract: WeeklyExposureContractV2,
  metric: Section18ReductionMetric,
): number | null {
  const targets = contract.authorisedReductions
    .filter((entry) => entry.metric === metric && entry.change !== 'dose_intensity')
    .map((entry) => entry.reducedTarget);
  return targets.length > 0 ? Math.min(...targets) : null;
}

function applyReductionProjections(contract: WeeklyExposureContractV2): void {
  contract.mainStrength.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'main_strength_frequency' || entry.metric === 'strength_pattern_count' ||
    entry.metric === 'session_intensity_percent' || entry.metric === 'session_volume');
  contract.conditioning.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'conditioning_core_frequency');
  contract.sprintHighSpeed.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'sprint_high_speed_frequency');

  const updatePolicy = (
    policy: WeeklyExposureContractV2['mainStrength']['exposure'],
    metric: Section18ReductionMetric,
  ) => {
    const ceiling = effectiveFrequencyCeiling(contract, metric);
    if (ceiling === null) return;
    policy.requiredMinimum = Math.min(policy.requiredMinimum, ceiling);
    policy.plannerSelectedTarget = policy.plannerSelectedTarget === null
      ? ceiling
      : Math.min(policy.plannerSelectedTarget, ceiling);
  };
  updatePolicy(contract.mainStrength.exposure, 'main_strength_frequency');
  updatePolicy(contract.conditioning.core, 'conditioning_core_frequency');
  updatePolicy(contract.sprintHighSpeed.exposure, 'sprint_high_speed_frequency');
}

function participationForConstraint(args: {
  existing: AnchorParticipationState;
  explicit: boolean;
  hasFieldRestriction: boolean;
  lowerBodyRestriction: boolean;
  readinessRestriction: boolean;
}): AnchorParticipationState {
  if (args.explicit && args.existing !== 'normal_unrestricted') return args.existing;
  if (!args.hasFieldRestriction) {
    return args.explicit ? args.existing : 'normal_unrestricted';
  }
  if (args.lowerBodyRestriction || args.readinessRestriction) return 'reduced_running';
  return 'modified';
}

/**
 * Project a generation-time or live active-constraint context onto Contract
 * v2. Existing explicit modified participation and previously persisted
 * prohibitions are conservative: neither is ever upgraded by a later pass.
 */
export function applyGenerationSafetyToSection18Contract(args: {
  contract: WeeklyExposureContractV2;
  generationConstraints?: GenerationConstraintContext;
  forceFullPause?: boolean;
}): WeeklyExposureContractV2 {
  let contract = cloneContract(args.contract);
  const context = args.generationConstraints;
  const derivedProhibited = resolveRestrictedMainStrengthPatterns({
    activeInjuries: context?.injuries,
    profileInjuries: [],
  });
  const prohibited = unique([
    ...(contract.strengthPatterns.prohibitedPatterns ?? []),
    ...derivedProhibited,
  ]).filter((pattern): pattern is MainStrengthPattern => PATTERNS.includes(pattern));
  const availableSafePatterns = PATTERNS.filter((pattern) => !prohibited.includes(pattern));
  const selectedStrengthTarget = selectedMainStrengthTarget(contract);
  const requiredSafe = prohibited.length > 0 && selectedStrengthTarget > 0
    ? availableSafePatterns
    : contract.strengthPatterns.balanceExpectation === 'equal_or_near_equal'
      ? availableSafePatterns
      : contract.strengthPatterns.requiredSafePatterns.filter((pattern) =>
          !prohibited.includes(pattern));
  contract.strengthPatterns.prohibitedPatterns = prohibited;
  contract.strengthPatterns.requiredSafePatterns = requiredSafe;
  if (derivedProhibited.size > 0) {
    contract.strengthPatterns.prohibitedPatternProvenance = 'active_constraints';
  }

  const readiness = context?.readiness;
  // A sprint-only restriction may also cause the weekly power selector to
  // record a zero primer budget. Neither reduction means the athlete is
  // globally "cooked". Only strength, conditioning or session-dose
  // reductions may carry cooked-readiness ownership across validation passes.
  const persistedLowReadiness = contract.authorisedReductions.some((entry) =>
    entry.reason === 'low_readiness' && (
      entry.metric === 'main_strength_frequency' ||
      entry.metric === 'conditioning_core_frequency' ||
      entry.metric === 'session_intensity_percent' ||
      entry.metric === 'session_volume'
    ));
  const persistedAppSprintRestriction = contract.authorisedReductions.some((entry) =>
    entry.reason === 'low_readiness' && entry.metric === 'sprint_high_speed_frequency');
  const cookedReadiness = readiness?.tier === 'moderate_reduction' ||
    readiness?.tier === 'major_reduction' || readiness?.tier === 'full_pause' || persistedLowReadiness;
  const fullPause = args.forceFullPause === true || readiness?.fullPause === true ||
    contract.safety?.fullPause === true || contract.authorisedReductions.some((entry) =>
      entry.reason === 'full_pause');
  const lowerBodyRestriction = prohibited.includes('squat') || prohibited.includes('hinge') ||
    context?.injuries.some((injury) =>
      (injury.region === 'lower_body' || injury.region === 'back_midline') &&
      (injury.removeRiskyWork || injury.pauseAffectedTraining)) === true;
  const upperBodyRestriction = prohibited.includes('push') || prohibited.includes('pull');
  const significantReadinessRestriction = readiness?.tier === 'moderate_reduction' ||
    readiness?.tier === 'major_reduction' || readiness?.tier === 'full_pause' ||
    cookedReadiness || fullPause;
  const readinessFieldRestriction = significantReadinessRestriction;
  const hasFieldRestriction = lowerBodyRestriction || upperBodyRestriction || readinessFieldRestriction;

  if (prohibited.length > 0) {
    addReduction(contract, {
      metric: 'strength_pattern_count',
      reducedTarget: requiredSafe.length,
      reason: 'injury_restriction',
      scope: 'pattern',
      detail: `Active injury policy prohibits ${prohibited.join(', ')} while preserving safe unaffected patterns.`,
    });
    addReduction(contract, {
      metric: 'main_strength_frequency',
      reducedTarget: Math.min(
        selectedMainStrengthTarget(contract),
        requiredSafe.length,
      ),
      reason: 'injury_restriction',
      detail: 'The selected strength frequency cannot exceed the number of safely available main patterns.',
    });
  }
  if (lowerBodyRestriction) {
    addReduction(contract, {
      metric: 'sprint_high_speed_frequency',
      reducedTarget: 0,
      reason: 'injury_restriction',
      detail: 'An active lower-body or back restriction removes sprint/high-speed exposure and anchor credit.',
    });
  }
  if (readiness?.tier === 'moderate_reduction') {
    addReduction(contract, {
      metric: 'main_strength_frequency',
      reducedTarget: 2,
      reason: 'low_readiness',
      detail: 'Low readiness retains at most two controlled strength sessions.',
    });
    addReduction(contract, {
      metric: 'conditioning_core_frequency',
      reducedTarget: 1,
      reason: 'low_readiness',
      detail: 'Low readiness retains at most one low-stress app conditioning exposure.',
    });
    addReduction(contract, {
      metric: 'sprint_high_speed_frequency',
      reducedTarget: 0,
      reason: 'low_readiness',
      detail: 'Low readiness removes sprint/high-speed exposure and anchor credit.',
    });
  } else if (readiness?.tier === 'major_reduction' || fullPause) {
    for (const [metric, detail] of [
      ['main_strength_frequency', 'Major readiness restriction removes main-strength training.'],
      ['conditioning_core_frequency', 'Major readiness restriction removes core conditioning.'],
      ['sprint_high_speed_frequency', 'Major readiness restriction removes sprint/high-speed exposure.'],
    ] as const) {
      addReduction(contract, {
        metric,
        reducedTarget: 0,
        reason: fullPause ? 'full_pause' : 'low_readiness',
        detail,
      });
    }
  } else if (readiness?.avoidSprint) {
    addReduction(contract, {
      metric: 'sprint_high_speed_frequency',
      reducedTarget: contract.anchors.length,
      reason: 'low_readiness',
      detail: 'Slight readiness restriction removes app-authored sprint while preserving normal healthy anchor credit.',
    });
  }
  if (
    cookedReadiness &&
    !contract.authorisedReductions.some((entry) =>
      entry.metric === 'sprint_high_speed_frequency' &&
      (entry.reason === 'low_readiness' || entry.reason === 'full_pause'))
  ) {
    addReduction(contract, {
      metric: 'sprint_high_speed_frequency',
      reducedTarget: 0,
      reason: fullPause ? 'full_pause' : 'low_readiness',
      detail: 'Persisted cooked-readiness ownership removes sprint/high-speed exposure and anchor credit.',
    });
  }

  if (cookedReadiness || fullPause) {
    addReduction(contract, {
      metric: 'power_primer_budget',
      reducedTarget: 0,
      reason: fullPause ? 'full_pause' : 'low_readiness',
      detail: 'Cooked or paused readiness removes all formal power primers.',
    });
  }

  applyReductionProjections(contract);

  contract.anchors = contract.anchors.map((anchor) => {
    const participation = participationForConstraint({
      existing: anchor.participation,
      explicit: anchor.participationProvenance === 'explicit',
      hasFieldRestriction,
      lowerBodyRestriction,
      readinessRestriction: readinessFieldRestriction,
    });
    const normal = participation === 'normal_unrestricted';
    return {
      ...anchor,
      participation,
      participationProvenance: anchor.participationProvenance === 'explicit' &&
        participation === anchor.participation
        ? 'explicit'
        : hasFieldRestriction
          ? 'derived_active_constraint'
          : contract.source === 'legacy_migration'
            ? 'healthy_legacy_assumption'
            : 'derived_healthy_unrestricted',
      currentProductionClaim: {
        conditioning: normal,
        sprintHighSpeed: normal,
        hardDay: normal,
      },
    };
  });
  contract.migration.missingParticipationRemainsUnknown = contract.anchors.some(
    (anchor) => anchor.participation === 'unknown',
  );

  const prohibitedPowerFamilies: Array<'lower' | 'upper'> = unique([
    ...(contract.safety?.prohibitedPowerFamilies ?? []),
    ...(lowerBodyRestriction ? ['lower' as const] : []),
    ...(upperBodyRestriction ? ['upper' as const] : []),
  ]);
  const prohibitedPower = fullPause || cookedReadiness ||
    contract.identity.mode === 'in_season_bye_recovery' ||
    contract.identity.weekKind === 'deload' || contract.power.eligible === false;
  if (prohibitedPower) {
    contract.power.eligible = false;
    contract.power.removalReason = fullPause
      ? 'full_pause'
      : cookedReadiness
        ? 'low_readiness'
        : contract.identity.mode === 'in_season_bye_recovery'
          ? 'bye_recovery_mode'
          : contract.power.removalReason ?? 'deload_policy';
  }

  const affectedDomains: Section18SafetyDomain[] = [];
  if (prohibited.length > 0 || effectiveFrequencyCeiling(contract, 'main_strength_frequency') !== null) {
    affectedDomains.push('main_strength');
  }
  if (effectiveFrequencyCeiling(contract, 'conditioning_core_frequency') !== null) {
    affectedDomains.push('conditioning');
  }
  if (lowerBodyRestriction || readinessFieldRestriction || persistedAppSprintRestriction ||
      readiness?.avoidSprint) affectedDomains.push('sprint_high_speed');
  if (hasFieldRestriction) affectedDomains.push('anchor_participation');
  if (prohibitedPower || prohibitedPowerFamilies.length > 0) affectedDomains.push('power');
  if (cookedReadiness || contract.identity.mode === 'in_season_bye_recovery') {
    affectedDomains.push('session_dose');
  }

  contract = refreshSection18SafetyPolicy(contract, {
    cookedReadiness,
    prohibitedSprintHighSpeed: lowerBodyRestriction || significantReadinessRestriction || fullPause,
    prohibitedPower,
    prohibitedPowerFamilies,
    affectedSafetyDomains: unique(affectedDomains),
    fullPause,
  });
  return contract;
}
