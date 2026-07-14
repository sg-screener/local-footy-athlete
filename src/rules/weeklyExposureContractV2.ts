/**
 * Weekly Exposure Contract v2.
 *
 * This is the typed policy language for Programming Bible Section 18. It is
 * intentionally independent from the legacy contract builders: approved
 * minima/defaults/maxima come from the tables below, while current planner
 * output is recorded only as planner selection. The v2 evaluator is
 * observational in this slice and does not replace the legacy write gate yet.
 */

import type { ReadinessLevel, SeasonPhase, WeekKind } from '../types/domain';
import type { OffseasonSubphase } from './offseasonSubphase';
import type { PreseasonSubphase } from './preseasonSubphase';
import type { MainStrengthPattern } from './strengthPatternContributions';
import type {
  WeeklyExposureContract,
  WeeklyExposureReduction,
  WeeklyExposureReductionReason,
} from './weeklyExposureContract';

export const WEEKLY_EXPOSURE_CONTRACT_V2_VERSION = 2 as const;

export type Section18WeekMode =
  | 'in_season_game_week'
  | 'in_season_bye_build'
  | 'in_season_bye_recovery'
  | 'early_offseason'
  | 'mid_offseason'
  | 'late_offseason'
  | 'early_preseason'
  | 'mid_preseason'
  | 'late_preseason'
  | 'practice_match_week';

export type Section18Subphase =
  | OffseasonSubphase
  | PreseasonSubphase
  | 'game_week'
  | 'bye_build'
  | 'bye_recovery'
  | 'practice_match_week';

export type Section18AnchorState = 'game' | 'bye' | 'practice_match' | 'none';
export type Section18AnchorKind = 'team_training' | 'game' | 'practice_match';

export type AnchorParticipationState =
  | 'normal_unrestricted'
  | 'modified'
  | 'rehab'
  | 'restricted'
  | 'non_contact'
  | 'reduced_running'
  | 'did_not_participate'
  | 'unknown';

export type Section18ConditioningRole =
  | 'core'
  | 'optional_flush'
  | 'optional_noncore'
  | 'legacy_unknown'
  | 'none';

export type Section18ConditioningStress = 'light' | 'moderate' | 'hard' | 'unknown';

export type Section18RowRole =
  | 'main_strength'
  | 'strength_accessory'
  | 'conditioning'
  | 'power'
  | 'trunk_support'
  | 'recovery_support'
  | 'legacy_unknown';

/** Evidence stamped by canonical construction; the evaluator never parses copy. */
export interface WorkoutExerciseSection18Evidence {
  protocolVersion: 1;
  role: Section18RowRole;
  mainStrengthPattern: MainStrengthPattern | null;
  provenance: 'canonical_row_classifier' | 'legacy_unknown';
}

/** Workout-level component identity consumed by the independent evaluator. */
export interface WorkoutSection18Evidence {
  protocolVersion: 1;
  conditioningRole: Section18ConditioningRole;
  conditioningStress: Section18ConditioningStress;
  provenance: 'planner_and_canonical_content' | 'explicit_mutation' | 'legacy_unknown';
}

export interface Section18Range {
  min: number;
  max: number;
}

export type Section18PlannerSelectionKind = 'core' | 'optional' | 'none';

export interface Section18NumericPolicy {
  requiredMinimum: number;
  defaultTarget: number;
  preferredRange: Section18Range;
  /** Null means Section 18 does not define a numeric ceiling for this metric. */
  permittedMaximum: number | null;
  plannerSelectedTarget: number | null;
  plannerSelectionKind: Section18PlannerSelectionKind;
  achievedCount: number | null;
  unresolvedMinimumShortfall: number | null;
  maximumBreach: number | null;
}

export type Section18ReductionMetric =
  | 'main_strength_frequency'
  | 'conditioning_core_frequency'
  | 'sprint_high_speed_frequency'
  | 'strength_pattern_count'
  | 'full_rest_frequency'
  | 'session_intensity_percent'
  | 'session_volume'
  | 'power_primer_budget';

export type Section18ReductionScope = 'week' | 'session' | 'pattern' | 'anchor';
export type Section18ReductionChange = 'frequency' | 'dose_intensity' | 'both';

export interface Section18AuthorisedReduction {
  metric: Section18ReductionMetric;
  originalApprovedTarget: number;
  reducedTarget: number;
  reason: WeeklyExposureReductionReason;
  scope: Section18ReductionScope;
  change: Section18ReductionChange;
  detail: string;
  provenance: 'live_typed_reduction' | 'persisted_typed_reduction';
}

export interface Section18AnchorContract {
  id: string;
  kind: Section18AnchorKind;
  dayOfWeek: number;
  participation: AnchorParticipationState;
  participationProvenance: 'explicit' | 'legacy_unknown' | 'current_input_missing';
  /** What the current/legacy production path claimed before v2 participation gates. */
  currentProductionClaim: {
    conditioning: boolean;
    sprintHighSpeed: boolean;
    hardDay: boolean;
  };
  creditPolicy: {
    conditioningRequiresNormalParticipation: true;
    sprintRequiresNormalHighSpeedParticipation: true;
    hardDayRequiresNormalHardParticipation: true;
    formalPowerPrimerCredit: false;
  };
}

export interface Section18Identity {
  seasonPhase: SeasonPhase;
  declaredSubphase: Section18Subphase;
  expectedSubphase: Section18Subphase | null;
  mode: Section18WeekMode;
  blockNumber: number | null;
  weekInBlock: number | null;
  globalWeek: number | null;
  /** Time since phase entry. Null until the product persists that clock. */
  phaseWeek: number | null;
  phaseWeekProvenance: 'explicit_phase_clock' | 'program_block_derived' | 'legacy_unknown';
  weekKind: WeekKind;
  anchorState: Section18AnchorState;
}

export interface Section18EquipmentPolicyState {
  appConditioningFeasible: boolean | null;
  substitutionStatus:
    | 'not_required'
    | 'substituted'
    | 'not_attempted'
    | 'exhausted'
    | 'legacy_unknown';
  consideredSubstitutions: Array<
    'running' | 'walking' | 'bodyweight' | 'hills' | 'available_ergs' | 'safe_mixed'
  >;
}

export interface WeeklyExposureContractV2 {
  protocolVersion: typeof WEEKLY_EXPOSURE_CONTRACT_V2_VERSION;
  authority: 'LFA_PROGRAMMING_BIBLE_SECTION_18';
  source: 'section18_resolver' | 'legacy_migration';
  /** Complete typed reduction ledger; domain arrays below are projections. */
  authorisedReductions: Section18AuthorisedReduction[];
  identity: Section18Identity;
  mainStrength: {
    exposure: Section18NumericPolicy;
    optionalMainStrengthSelected: number;
    accessoriesRemainNonCore: true;
    reductions: Section18AuthorisedReduction[];
  };
  strengthPatterns: {
    requiredSafePatterns: MainStrengthPattern[];
    prohibitedPatterns: MainStrengthPattern[];
    prohibitedPatternProvenance: 'active_constraints' | 'profile_injury' | 'explicit_none' | 'legacy_missing';
    achievedMeaningfulMainLifts: Record<MainStrengthPattern, number | null>;
    balanceExpectation: 'equal_or_near_equal' | 'not_applicable';
    permittedCountDifference: number;
    intentionalImbalanceReason: string | null;
    laterSessionRestorationRequired: boolean;
  };
  conditioning: {
    core: Section18NumericPolicy;
    optionalFlush: {
      permitted: boolean;
      preferredRange: Section18Range;
      plannerSelectedCount: number | null;
      achievedCount: number | null;
    };
    optionalNonCoreAchievedCount: number | null;
    legacyUnknownAchievedCount: number | null;
    requiredCoreStress: Section18ConditioningStress[];
    intensityPolicy: {
      requiredAppMediumHardMinimum: number;
      requiredAppHardMinimum: number;
      permittedHardCoreMaximum: number | null;
    };
    achievedByStress: Record<Section18ConditioningStress, number | null>;
    anchorCredit: number | null;
    appAuthoredCoreCredit: number | null;
    reductions: Section18AuthorisedReduction[];
  };
  sprintHighSpeed: {
    exposure: Section18NumericPolicy;
    achievedSources: Section18SprintCreditSource[];
    reductions: Section18AuthorisedReduction[];
  };
  anchors: Section18AnchorContract[];
  power: {
    eligible: boolean | null;
    preferredWeeklyRange: Section18Range;
    plannerSelectedWeeklyBudget: number | null;
    achievedPrimerCount: number | null;
    removalReason: string | null;
    advisoryOverSelection: number | null;
    fieldActionsCountAsFormalPrimer: false;
  };
  restStress: {
    requiredFullRestMinimum: number;
    preferredFullRestCount: Section18Range;
    achievedTrueFullRestCount: number | null;
    achievedActiveRecoveryCount: number | null;
    preferredHardDayRange: Section18Range;
    normalProgrammedHardDayMaximum: number;
    authorisedUnavoidableAnchorExcess: number;
    unavoidableAnchorCausedExcess: number | null;
    achievedModerateDayCount: number | null;
    achievedHardDayCount: number | null;
    moderateDayDefault: number;
    hardDayMaximumBreach: number | null;
  };
  equipment: Section18EquipmentPolicyState;
  migration: {
    legacyContractPresent: boolean;
    missingParticipationRemainsUnknown: boolean;
    missingConditioningRoleRemainsUnknown: boolean;
    missingProhibitedPatternsTraceable: boolean;
  };
}

export type Section18SprintCreditSource =
  | { kind: 'app_sprint'; dayOfWeek: number; evidence: 'typed_true_speed_block' }
  | {
      kind: 'team_training' | 'game' | 'practice_match';
      dayOfWeek: number;
      participation: AnchorParticipationState;
      evidence: 'normal_unrestricted_participation';
    };

export interface Section18ContractV2Input {
  seasonPhase: SeasonPhase;
  declaredSubphase: Section18Subphase;
  mode: Section18WeekMode;
  blockNumber?: number | null;
  weekInBlock?: number | null;
  globalWeek?: number | null;
  phaseWeek?: number | null;
  phaseWeekProvenance?: Section18Identity['phaseWeekProvenance'];
  weekKind?: WeekKind;
  anchorState: Section18AnchorState;
  teamTrainingDays: readonly number[];
  fixtureDay?: number | null;
  fixtureParticipation?: AnchorParticipationState;
  teamParticipation?: Readonly<Record<number, AnchorParticipationState>>;
  participationProvenance?: Section18AnchorContract['participationProvenance'];
  currentProductionClaimsAnchorCredit?: boolean;
  readiness: ReadinessLevel;
  cookedReadiness?: boolean;
  plannerSelected: {
    mainStrength: number | null;
    optionalMainStrength?: number;
    coreConditioning: number | null;
    optionalFlush?: number | null;
    sprintHighSpeed: number | null;
    powerPrimers: number | null;
  };
  prohibitedPatterns?: readonly MainStrengthPattern[];
  prohibitedPatternProvenance?: WeeklyExposureContractV2['strengthPatterns']['prohibitedPatternProvenance'];
  intentionalImbalanceReason?: string | null;
  reductions?: readonly Section18AuthorisedReduction[];
  authorisedUnavoidableAnchorExcess?: number;
  equipment?: Partial<Section18EquipmentPolicyState>;
  source?: WeeklyExposureContractV2['source'];
}

const ALL_PATTERNS: readonly MainStrengthPattern[] = ['squat', 'hinge', 'push', 'pull'];

function numericPolicy(args: {
  required: number;
  defaultTarget: number;
  preferred: Section18Range;
  maximum: number | null;
  selected: number | null;
  selectionKind?: Section18PlannerSelectionKind;
}): Section18NumericPolicy {
  return {
    requiredMinimum: args.required,
    defaultTarget: args.defaultTarget,
    preferredRange: args.preferred,
    permittedMaximum: args.maximum,
    plannerSelectedTarget: args.selected,
    plannerSelectionKind: args.selectionKind ?? 'core',
    achievedCount: null,
    unresolvedMinimumShortfall: null,
    maximumBreach: null,
  };
}

function expectedSubphase(input: Section18ContractV2Input): Section18Subphase | null {
  const phaseWeek = input.phaseWeek ?? input.globalWeek ?? (
    input.blockNumber && input.weekInBlock
      ? (input.blockNumber - 1) * 4 + input.weekInBlock
      : null
  );
  if (input.seasonPhase === 'Off-season') {
    if (!phaseWeek) return null;
    if (phaseWeek <= 2) return 'early_offseason';
    if (phaseWeek <= 4) return 'mid_offseason';
    return 'late_offseason';
  }
  if (input.seasonPhase === 'Pre-season') {
    if (input.anchorState === 'practice_match') return 'practice_match_week';
    if (!phaseWeek) return null;
    if (phaseWeek === 1) return 'early_preseason';
    if (phaseWeek <= 3) return 'mid_preseason';
    return 'late_preseason';
  }
  if (input.anchorState === 'game') return 'game_week';
  return input.mode === 'in_season_bye_recovery' ? 'bye_recovery' : 'bye_build';
}

function uniqueDays(days: readonly number[]): number[] {
  return Array.from(new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
    .sort((a, b) => a - b);
}

function anchorsFor(input: Section18ContractV2Input): Section18AnchorContract[] {
  const provenance = input.participationProvenance ?? 'current_input_missing';
  const anchors: Section18AnchorContract[] = uniqueDays(input.teamTrainingDays).map((day) => ({
    id: `tt-${day}`,
    kind: 'team_training',
    dayOfWeek: day,
    participation: input.teamParticipation?.[day] ?? 'unknown',
    participationProvenance: input.teamParticipation?.[day] ? 'explicit' : provenance,
    currentProductionClaim: {
      conditioning: input.currentProductionClaimsAnchorCredit ?? false,
      sprintHighSpeed: input.currentProductionClaimsAnchorCredit ?? false,
      hardDay: input.currentProductionClaimsAnchorCredit ?? false,
    },
    creditPolicy: {
      conditioningRequiresNormalParticipation: true,
      sprintRequiresNormalHighSpeedParticipation: true,
      hardDayRequiresNormalHardParticipation: true,
      formalPowerPrimerCredit: false,
    },
  }));
  if (input.fixtureDay !== null && input.fixtureDay !== undefined) {
    const kind: Section18AnchorKind = input.anchorState === 'practice_match'
      ? 'practice_match'
      : 'game';
    anchors.push({
      id: `${kind}-${input.fixtureDay}`,
      kind,
      dayOfWeek: input.fixtureDay,
      participation: input.fixtureParticipation ?? 'unknown',
      participationProvenance: input.fixtureParticipation ? 'explicit' : provenance,
      currentProductionClaim: {
        conditioning: input.currentProductionClaimsAnchorCredit ?? false,
        sprintHighSpeed: input.currentProductionClaimsAnchorCredit ?? false,
        hardDay: input.currentProductionClaimsAnchorCredit ?? false,
      },
      creditPolicy: {
        conditioningRequiresNormalParticipation: true,
        sprintRequiresNormalHighSpeedParticipation: true,
        hardDayRequiresNormalHardParticipation: true,
        formalPowerPrimerCredit: false,
      },
    });
  }
  return anchors;
}

interface Section18ModePolicy {
  strength: { required: number; defaultTarget: number; preferred: Section18Range; max: number };
  conditioning: {
    required: number;
    defaultTarget: number;
    preferred: Section18Range;
    max: number | null;
    stress: Section18ConditioningStress[];
    optionalFlush: Section18Range;
    requiredAppMediumHardMinimum: number;
    requiredAppHardMinimum: number;
    permittedHardCoreMaximum: number | null;
  };
  sprint: { required: number; preferred: Section18Range; max: number | null };
  power: { eligible: boolean; preferred: Section18Range; removalReason: string | null };
  rest: { required: number; preferred: Section18Range };
  balance: boolean;
  selectionKind: Section18PlannerSelectionKind;
}

/** Section 18 table translated directly; no legacy builder constants are read. */
function policyFor(input: Section18ContractV2Input): Section18ModePolicy {
  const tt = uniqueDays(input.teamTrainingDays).length;
  const noPower = input.cookedReadiness || input.readiness === 'low' || input.weekKind === 'deload';
  switch (input.mode) {
    case 'in_season_game_week':
      return {
        strength: { required: 2, defaultTarget: 2, preferred: { min: 2, max: 3 }, max: 4 },
        conditioning: { required: 3, defaultTarget: 3, preferred: { min: 3, max: 3 }, max: 3, stress: ['moderate', 'hard'], optionalFlush: { min: 0, max: 1 }, requiredAppMediumHardMinimum: tt === 0 ? 2 : tt === 1 ? 1 : 0, requiredAppHardMinimum: tt === 1 ? 1 : 0, permittedHardCoreMaximum: null },
        sprint: { required: 1, preferred: { min: 1, max: 1 }, max: null },
        power: { eligible: !noPower, preferred: { min: 0, max: 2 }, removalReason: noPower ? 'low_readiness_or_deload' : null },
        rest: { required: 1, preferred: { min: 1, max: 2 } },
        balance: true,
        selectionKind: 'core',
      };
    case 'in_season_bye_build':
      return {
        strength: { required: 2, defaultTarget: 3, preferred: { min: 3, max: 4 }, max: 4 },
        conditioning: { required: 3, defaultTarget: 3, preferred: { min: 3, max: 3 }, max: null, stress: ['moderate', 'hard'], optionalFlush: { min: 0, max: 1 }, requiredAppMediumHardMinimum: 0, requiredAppHardMinimum: 0, permittedHardCoreMaximum: null },
        sprint: { required: 1, preferred: { min: 1, max: 1 }, max: null },
        power: { eligible: !noPower, preferred: { min: 0, max: 2 }, removalReason: noPower ? 'low_readiness_or_deload' : null },
        rest: { required: 1, preferred: { min: 1, max: 2 } },
        balance: true,
        selectionKind: 'core',
      };
    case 'in_season_bye_recovery':
      return {
        strength: { required: 2, defaultTarget: 2, preferred: { min: 2, max: 2 }, max: 2 },
        conditioning: { required: 0, defaultTarget: tt, preferred: { min: 0, max: tt }, max: null, stress: ['light'], optionalFlush: tt === 0 ? { min: 1, max: 2 } : tt === 1 ? { min: 0, max: 1 } : { min: 0, max: 0 }, requiredAppMediumHardMinimum: 0, requiredAppHardMinimum: 0, permittedHardCoreMaximum: 0 },
        sprint: { required: 1, preferred: { min: 1, max: 1 }, max: null },
        power: { eligible: false, preferred: { min: 0, max: 0 }, removalReason: 'bye_recovery_mode' },
        rest: { required: 2, preferred: { min: 2, max: 3 } },
        balance: true,
        selectionKind: 'core',
      };
    case 'early_offseason':
      return {
        strength: { required: 0, defaultTarget: 0, preferred: { min: 2, max: 3 }, max: 3 },
        conditioning: { required: 0, defaultTarget: 0, preferred: { min: 1, max: 2 }, max: 3, stress: ['light'], optionalFlush: { min: 1, max: 2 }, requiredAppMediumHardMinimum: 0, requiredAppHardMinimum: 0, permittedHardCoreMaximum: 0 },
        sprint: { required: 0, preferred: { min: 0, max: 0 }, max: 0 },
        power: { eligible: false, preferred: { min: 0, max: 0 }, removalReason: 'early_offseason' },
        rest: { required: 0, preferred: { min: 3, max: 4 } },
        balance: false,
        selectionKind: 'optional',
      };
    case 'mid_offseason':
      return {
        strength: { required: 3, defaultTarget: 4, preferred: { min: 3, max: 4 }, max: 4 },
        conditioning: { required: 3, defaultTarget: 3, preferred: { min: 3, max: 4 }, max: 5, stress: ['light', 'moderate', 'hard'], optionalFlush: { min: 0, max: 1 }, requiredAppMediumHardMinimum: 0, requiredAppHardMinimum: 0, permittedHardCoreMaximum: 1 },
        sprint: { required: 1, preferred: { min: 1, max: 1 }, max: null },
        power: { eligible: !noPower, preferred: { min: 1, max: 2 }, removalReason: noPower ? 'low_readiness_or_deload' : null },
        rest: { required: 0, preferred: { min: 2, max: 2 } },
        balance: true,
        selectionKind: 'core',
      };
    case 'late_offseason':
      return {
        strength: { required: 3, defaultTarget: 4, preferred: { min: 3, max: 4 }, max: 4 },
        conditioning: { required: 3, defaultTarget: 4, preferred: { min: 4, max: 4 }, max: 5, stress: ['light', 'moderate', 'hard'], optionalFlush: { min: 0, max: 1 }, requiredAppMediumHardMinimum: 0, requiredAppHardMinimum: 0, permittedHardCoreMaximum: 2 },
        sprint: { required: 1, preferred: { min: 1, max: 2 }, max: 2 },
        power: { eligible: !noPower, preferred: { min: 1, max: 2 }, removalReason: noPower ? 'low_readiness_or_deload' : null },
        rest: { required: 0, preferred: { min: 2, max: 2 } },
        balance: true,
        selectionKind: 'core',
      };
    case 'practice_match_week':
      return {
        strength: { required: 3, defaultTarget: 3, preferred: { min: 3, max: tt === 0 ? 4 : 3 }, max: tt === 0 ? 4 : 3 },
        conditioning: { required: 3, defaultTarget: 3, preferred: { min: 3, max: 3 }, max: 3, stress: ['moderate', 'hard'], optionalFlush: { min: 0, max: 1 }, requiredAppMediumHardMinimum: tt === 0 ? 2 : tt === 1 ? 1 : 0, requiredAppHardMinimum: 0, permittedHardCoreMaximum: null },
        sprint: { required: 1, preferred: { min: 1, max: 1 }, max: null },
        power: { eligible: !noPower, preferred: { min: 1, max: 2 }, removalReason: noPower ? 'low_readiness_or_deload' : null },
        rest: { required: 0, preferred: { min: 2, max: 2 } },
        balance: true,
        selectionKind: 'core',
      };
    case 'early_preseason':
    case 'mid_preseason':
    case 'late_preseason':
    default:
      return {
        strength: { required: 3, defaultTarget: 4, preferred: { min: 4, max: 4 }, max: 4 },
        conditioning: { required: 3, defaultTarget: 4, preferred: { min: 4, max: 4 }, max: 4, stress: ['moderate', 'hard'], optionalFlush: { min: 0, max: 1 }, requiredAppMediumHardMinimum: 0, requiredAppHardMinimum: 0, permittedHardCoreMaximum: null },
        sprint: { required: 1, preferred: { min: 1, max: 1 }, max: null },
        power: { eligible: !noPower, preferred: { min: 1, max: 2 }, removalReason: noPower ? 'low_readiness_or_deload' : null },
        rest: { required: 0, preferred: { min: 2, max: 2 } },
        balance: true,
        selectionKind: 'core',
      };
  }
}

function reducedTarget(
  reductions: readonly Section18AuthorisedReduction[],
  metric: Section18ReductionMetric,
  fallback: number,
): number {
  const entries = reductions.filter((entry) => entry.metric === metric && entry.change !== 'dose_intensity');
  return entries.length > 0 ? entries[entries.length - 1].reducedTarget : fallback;
}

export function buildSection18WeeklyExposureContractV2(
  input: Section18ContractV2Input,
): WeeklyExposureContractV2 {
  const policy = policyFor(input);
  const reductions = [...(input.reductions ?? [])];
  const prohibited = ALL_PATTERNS.filter((pattern) => input.prohibitedPatterns?.includes(pattern));
  const requiredSafePatterns = policy.balance && policy.strength.required > 0
    ? ALL_PATTERNS.filter((pattern) => !prohibited.includes(pattern))
    : [];
  const anchors = anchorsFor(input);
  const strengthRequired = reducedTarget(reductions, 'main_strength_frequency', policy.strength.required);
  const conditioningRequired = reducedTarget(reductions, 'conditioning_core_frequency', policy.conditioning.required);
  const sprintRequired = reducedTarget(reductions, 'sprint_high_speed_frequency', policy.sprint.required);
  const selectedKind = policy.selectionKind;
  const optionalStrength = selectedKind === 'optional'
    ? input.plannerSelected.mainStrength ?? 0
    : input.plannerSelected.optionalMainStrength ?? 0;
  const coreStrengthSelected = selectedKind === 'optional' ? 0 : input.plannerSelected.mainStrength;
  const coreConditioningSelected = selectedKind === 'optional' ? 0 : input.plannerSelected.coreConditioning;
  const optionalFlushSelected = selectedKind === 'optional'
    ? input.plannerSelected.coreConditioning
    : input.plannerSelected.optionalFlush ?? 0;
  const powerEligible = policy.power.eligible && prohibited.length < ALL_PATTERNS.length;
  const powerRemoval = powerEligible
    ? null
    : policy.power.removalReason ?? (prohibited.length === ALL_PATTERNS.length ? 'full_pattern_restriction' : 'ineligible');

  return {
    protocolVersion: WEEKLY_EXPOSURE_CONTRACT_V2_VERSION,
    authority: 'LFA_PROGRAMMING_BIBLE_SECTION_18',
    source: input.source ?? 'section18_resolver',
    authorisedReductions: reductions,
    identity: {
      seasonPhase: input.seasonPhase,
      declaredSubphase: input.declaredSubphase,
      expectedSubphase: expectedSubphase(input),
      mode: input.mode,
      blockNumber: input.blockNumber ?? null,
      weekInBlock: input.weekInBlock ?? null,
      globalWeek: input.globalWeek ?? null,
      phaseWeek: input.phaseWeek ?? null,
      phaseWeekProvenance: input.phaseWeekProvenance ?? 'program_block_derived',
      weekKind: input.weekKind ?? 'build',
      anchorState: input.anchorState,
    },
    mainStrength: {
      exposure: numericPolicy({
        required: strengthRequired,
        defaultTarget: policy.strength.defaultTarget,
        preferred: policy.strength.preferred,
        maximum: policy.strength.max,
        selected: coreStrengthSelected,
        selectionKind: selectedKind,
      }),
      optionalMainStrengthSelected: optionalStrength,
      accessoriesRemainNonCore: true,
      reductions: reductions.filter((entry) =>
        entry.metric === 'main_strength_frequency' || entry.metric === 'session_intensity_percent' ||
        entry.metric === 'session_volume' || entry.metric === 'strength_pattern_count'),
    },
    strengthPatterns: {
      requiredSafePatterns,
      prohibitedPatterns: prohibited,
      prohibitedPatternProvenance: input.prohibitedPatternProvenance ?? (
        prohibited.length > 0 ? 'active_constraints' : 'explicit_none'
      ),
      achievedMeaningfulMainLifts: { squat: null, hinge: null, push: null, pull: null },
      balanceExpectation: policy.balance ? 'equal_or_near_equal' : 'not_applicable',
      permittedCountDifference: 1,
      intentionalImbalanceReason: input.intentionalImbalanceReason ?? null,
      laterSessionRestorationRequired: policy.balance,
    },
    conditioning: {
      core: numericPolicy({
        required: conditioningRequired,
        defaultTarget: policy.conditioning.defaultTarget,
        preferred: policy.conditioning.preferred,
        maximum: policy.conditioning.max,
        selected: coreConditioningSelected,
        selectionKind: selectedKind,
      }),
      optionalFlush: {
        permitted: policy.conditioning.optionalFlush.max > 0,
        preferredRange: policy.conditioning.optionalFlush,
        plannerSelectedCount: optionalFlushSelected,
        achievedCount: null,
      },
      optionalNonCoreAchievedCount: null,
      legacyUnknownAchievedCount: null,
      requiredCoreStress: policy.conditioning.stress,
      intensityPolicy: {
        requiredAppMediumHardMinimum: policy.conditioning.requiredAppMediumHardMinimum,
        requiredAppHardMinimum: policy.conditioning.requiredAppHardMinimum,
        permittedHardCoreMaximum: policy.conditioning.permittedHardCoreMaximum,
      },
      achievedByStress: { light: null, moderate: null, hard: null, unknown: null },
      anchorCredit: null,
      appAuthoredCoreCredit: null,
      reductions: reductions.filter((entry) => entry.metric === 'conditioning_core_frequency'),
    },
    sprintHighSpeed: {
      exposure: numericPolicy({
        required: sprintRequired,
        defaultTarget: policy.sprint.required,
        preferred: policy.sprint.preferred,
        maximum: policy.sprint.max,
        selected: input.plannerSelected.sprintHighSpeed,
      }),
      achievedSources: [],
      reductions: reductions.filter((entry) => entry.metric === 'sprint_high_speed_frequency'),
    },
    anchors,
    power: {
      eligible: powerEligible,
      preferredWeeklyRange: policy.power.preferred,
      plannerSelectedWeeklyBudget: input.plannerSelected.powerPrimers,
      achievedPrimerCount: null,
      removalReason: powerRemoval,
      advisoryOverSelection: null,
      fieldActionsCountAsFormalPrimer: false,
    },
    restStress: {
      requiredFullRestMinimum: policy.rest.required,
      preferredFullRestCount: policy.rest.preferred,
      achievedTrueFullRestCount: null,
      achievedActiveRecoveryCount: null,
      preferredHardDayRange: { min: 3, max: 4 },
      normalProgrammedHardDayMaximum: 4,
      authorisedUnavoidableAnchorExcess: Math.max(0, input.authorisedUnavoidableAnchorExcess ?? 0),
      unavoidableAnchorCausedExcess: null,
      achievedModerateDayCount: null,
      achievedHardDayCount: null,
      moderateDayDefault: 1,
      hardDayMaximumBreach: null,
    },
    equipment: {
      appConditioningFeasible: input.equipment?.appConditioningFeasible ?? null,
      substitutionStatus: input.equipment?.substitutionStatus ?? 'legacy_unknown',
      consideredSubstitutions: [...(input.equipment?.consideredSubstitutions ?? [])],
    },
    migration: {
      legacyContractPresent: input.source === 'legacy_migration',
      missingParticipationRemainsUnknown: anchors.some((anchor) => anchor.participation === 'unknown'),
      missingConditioningRoleRemainsUnknown: input.source === 'legacy_migration',
      missingProhibitedPatternsTraceable: input.prohibitedPatternProvenance === 'legacy_missing',
    },
  };
}

function reductionMetric(entry: WeeklyExposureReduction): Section18ReductionMetric {
  if (entry.metric === 'session_intensity_percent') return 'session_intensity_percent';
  if (entry.metric === 'strength_pattern_count') return 'strength_pattern_count';
  if (entry.domain === 'main_strength') return 'main_strength_frequency';
  if (entry.domain === 'conditioning') return 'conditioning_core_frequency';
  if (entry.domain === 'sprint_cod') return 'sprint_high_speed_frequency';
  return 'full_rest_frequency';
}

export function migrateLegacyReductionV2(
  entry: WeeklyExposureReduction,
  provenance: Section18AuthorisedReduction['provenance'] = 'persisted_typed_reduction',
): Section18AuthorisedReduction {
  const metric = reductionMetric(entry);
  const doseOnly = entry.metric === 'session_intensity_percent';
  return {
    metric,
    originalApprovedTarget: entry.from,
    reducedTarget: entry.to,
    reason: entry.reason,
    scope: metric === 'strength_pattern_count' ? 'pattern' : 'week',
    change: doseOnly ? 'dose_intensity' : 'frequency',
    detail: entry.detail,
    provenance,
  };
}

function v2ModeFromLegacy(contract: WeeklyExposureContract): Section18WeekMode {
  if (contract.identity.phase === 'Pre-season' && contract.anchors.gameOrPracticeMatchCredit > 0) {
    return 'practice_match_week';
  }
  return contract.identity.mode;
}

function anchorStateFromLegacy(contract: WeeklyExposureContract): Section18AnchorState {
  if (contract.identity.phase === 'Pre-season' && contract.anchors.gameOrPracticeMatchCredit > 0) {
    return 'practice_match';
  }
  if (contract.identity.phase === 'In-season') {
    return contract.anchors.gameOrPracticeMatchCredit > 0 ? 'game' : 'bye';
  }
  return contract.anchors.gameOrPracticeMatchCredit > 0 ? 'game' : 'none';
}

/** Deterministic persisted-v1 migration. Missing evidence remains unknown. */
export function migrateLegacyWeeklyExposureContractV2(
  legacy: WeeklyExposureContract,
  identity: {
    blockNumber?: number | null;
    weekInBlock?: number | null;
    globalWeek?: number | null;
  } = {},
): WeeklyExposureContractV2 {
  const contract = buildSection18WeeklyExposureContractV2({
    seasonPhase: legacy.identity.phase,
    declaredSubphase: legacy.identity.subphase,
    mode: v2ModeFromLegacy(legacy),
    blockNumber: identity.blockNumber,
    weekInBlock: identity.weekInBlock,
    globalWeek: identity.globalWeek,
    phaseWeek: null,
    phaseWeekProvenance: 'legacy_unknown',
    weekKind: legacy.identity.weekKind,
    anchorState: anchorStateFromLegacy(legacy),
    teamTrainingDays: legacy.anchors.teamTrainingDays,
    fixtureDay: legacy.anchors.gameDay,
    readiness: 'medium',
    plannerSelected: {
      mainStrength: legacy.strength.targetCount,
      coreConditioning: legacy.conditioning.targetCount,
      optionalFlush: null,
      sprintHighSpeed: legacy.sprintCod.targetCount,
      powerPrimers: null,
    },
    prohibitedPatterns: [],
    prohibitedPatternProvenance: 'legacy_missing',
    reductions: legacy.reductions.map((entry) => migrateLegacyReductionV2(entry)),
    equipment: {
      appConditioningFeasible: null,
      substitutionStatus: 'legacy_unknown',
      consideredSubstitutions: [],
    },
    participationProvenance: 'legacy_unknown',
    currentProductionClaimsAnchorCredit: true,
    source: 'legacy_migration',
  });
  contract.migration = {
    legacyContractPresent: true,
    missingParticipationRemainsUnknown: true,
    missingConditioningRoleRemainsUnknown: true,
    missingProhibitedPatternsTraceable: true,
  };
  return contract;
}
