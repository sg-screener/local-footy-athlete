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
import {
  resolveSeasonSubphaseAtPhaseWeek,
  type SeasonPhaseClockResolutionProvenance,
} from './seasonPhaseClock';

export const WEEKLY_EXPOSURE_CONTRACT_V2_VERSION = 2 as const;

export type Section18WeekMode =
  | 'in_season_game_week'
  | 'in_season_bye_build'
  | 'in_season_bye_recovery'
  | 'optional_week'
  | 'early_offseason'
  | 'mid_offseason'
  | 'late_offseason'
  | 'early_preseason'
  | 'mid_preseason'
  | 'late_preseason'
  | 'practice_match_week';

/**
 * Optional-only week modes: minimums lifted to 0 and every surviving session is optional
 * ("nothing is required this week"). The SINGLE source of truth for that classification,
 * keyed on the derived week mode the §18 gateway already consumes (never a duplicated
 * fact-kind or mode list). Both the session-tier stamp (generation) and the in-season
 * coverage validation key off this, so DEV-only validation cannot diverge from the mode.
 * See docs/FINDING3_VISIBLE_OPTIONAL_DIAGNOSIS_2026-07-23.md.
 */
/**
 * A FIXTURE week: the athlete plays. A game and a practice match are the same
 * shape (Sam, 2026-07-28) and this is the single place that says so.
 *
 * Load-bearing twice, and that is the point — the pair used to be spelled out
 * inline at the anchor credit and nowhere else, so the intensity policy never
 * learned the fact. See `requiredAppHardMinimum` below.
 */
export function isFixtureWeekMode(mode: Section18WeekMode): boolean {
  return mode === 'in_season_game_week' || mode === 'practice_match_week';
}

export function isOptionalOnlyWeekMode(mode: Section18WeekMode): boolean {
  return mode === 'optional_week' ||
    mode === 'in_season_bye_recovery' ||
    mode === 'early_offseason';
}

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

/**
 * Whether an anchor's participation state means the athlete WAS THERE.
 *
 * Sam, 2026-07-27: "Counting counts structure; intensity and prescribed volume
 * must never feed identity." A conditioning exposure exists because the athlete
 * attended the session, not because they attended it at full intensity — so a
 * `modified`, `rehab`, `restricted`, `non_contact` or `reduced_running` anchor
 * still claims conditioning. `did_not_participate` is absence and `unknown` is
 * legacy content with no evidence either way; neither has ever credited.
 *
 * Sprint/high-speed and hard-day claims are INTENSITY and stay behind
 * `normal_unrestricted`. Keeping one helper for the identity half is what stops
 * the two questions collapsing back into one boolean, which is how a deload
 * came to delete a session from the week's count.
 */
export function anchorAttendanceClaimsConditioning(
  participation: AnchorParticipationState,
): boolean {
  return participation !== 'did_not_participate' && participation !== 'unknown';
}

export type Section18ConditioningRole =
  | 'required_core'
  | 'planner_selected_core'
  | 'optional_flush'
  | 'optional_recovery_aerobic'
  /**
   * Conditioning beyond everything the contract asks for: the core capacity is
   * spent and the authored flush allowance is spent. The ledger has always
   * counted it (`optionalNonCoreAchievedCount`), and the evaluator has always
   * had a branch for it — reached through a `as string` cast, because the role
   * it tests for was never in this union. Naming it is what lets the one owner
   * DERIVE it instead of the branch staying unreachable.
   */
  | 'optional_noncore'
  /** Persisted Contract v2 data from before core ownership was split. */
  | 'core'
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
  /** Movement pattern for safety filtering, including accessory-dose rows. */
  strengthPattern: MainStrengthPattern | null;
  /** Meaningful main-lift credit; accessories remain null. */
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
  /** Core selection is independently enforceable above the required floor. */
  unresolvedPlannerSelectedShortfall: number | null;
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
  /** Present for athlete-deletion reductions so hydration/rebuild can audit ownership. */
  affectedWeek?: string;
  /** Stable UserRemovalConstraint identity that authorised this reduction. */
  deletionIdentity?: string;
}

/**
 * The governed boundary for a week contract.
 *
 * §18 governs what the app PRESCRIBES from this date onward. Dates before it are
 * history: they count toward the week's requirements and are never governed,
 * never re-prescribed, never rewritten. Null (the default, and every contract
 * authored before this existed) means the whole week is governed.
 *
 * Two things set it: an authoring owner stamping "today" when a fact lands
 * mid-week, and onboarding stamping the signup date so days before the program
 * existed are neither missed nor governed (E6).
 */
export type Section18GovernedFrom = string | null;

/**
 * The ONE owner of the governed boundary stamp. Sets `governedFromISO` and
 * marks every anchor whose day falls before it as `delivered_history` —
 * settled participation no later safety pass may demote. Called by whichever
 * owner authors the week (the scoped regen, generation); nothing else may
 * write the boundary. See
 * docs/SECTION18_DELIVERED_VS_REMAINING_REASSESSMENT_2026-07-24.md §2 Q4.
 */
export function stampSection18GovernedBoundary(args: {
  contract: WeeklyExposureContractV2;
  weekStartISO: string;
  governedFromISO: string;
}): WeeklyExposureContractV2 {
  const weekStart = args.weekStartISO.slice(0, 10);
  const boundary = args.governedFromISO.slice(0, 10);
  const dateForDow = (dayOfWeek: number): string => {
    const date = new Date(`${weekStart}T12:00:00`);
    date.setDate(date.getDate() + (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return date.toISOString().slice(0, 10);
  };
  if (boundary <= weekStart) return { ...args.contract, governedFromISO: boundary };
  return {
    ...args.contract,
    governedFromISO: boundary,
    anchors: args.contract.anchors.map((anchor) => {
      if (dateForDow(anchor.dayOfWeek) >= boundary) return anchor;
      // A history anchor's participation is what actually happened. An
      // explicitly recorded modification stands; a DERIVED demotion (minted
      // from a fact reported after the day elapsed) is exactly the
      // retroactive credit withdrawal the boundary forbids, so it is undone.
      const participation = anchor.participationProvenance === 'explicit'
        ? anchor.participation
        : 'normal_unrestricted' as const;
      const normal = participation === 'normal_unrestricted';
      return {
        ...anchor,
        participation,
        participationProvenance: 'delivered_history' as const,
        currentProductionClaim: {
          // Attendance, not intensity (Sam, 2026-07-27) — see
          // `anchorAttendanceClaimsConditioning`.
          conditioning: anchorAttendanceClaimsConditioning(participation),
          sprintHighSpeed: normal,
          hardDay: normal,
        },
      };
    }),
  };
}

export interface Section18AnchorContract {
  id: string;
  kind: Section18AnchorKind;
  dayOfWeek: number;
  participation: AnchorParticipationState;
  participationProvenance:
    | 'explicit'
    | 'derived_healthy_unrestricted'
    | 'derived_active_constraint'
    | 'healthy_legacy_assumption'
    | 'legacy_unknown'
    | 'current_input_missing'
    /** The anchor's day elapsed before the contract's governed boundary. Its
     *  participation is settled history: no later safety pass may demote it,
     *  because a demotion would retroactively decide that work the athlete
     *  already completed produced nothing. */
    | 'delivered_history';
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
  phaseEntryWeekStartISO: string | null;
  phaseClockSelectedPhase: SeasonPhase | null;
  phaseWeekProvenance: SeasonPhaseClockResolutionProvenance | 'legacy_unknown';
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

export type Section18SafetyDomain =
  | 'main_strength'
  | 'conditioning'
  | 'sprint_high_speed'
  | 'power'
  | 'anchor_participation'
  | 'session_dose';

export interface Section18SafetyPolicy {
  requiredSafePatterns: MainStrengthPattern[];
  prohibitedPatterns: MainStrengthPattern[];
  prohibitedSprintHighSpeed: boolean;
  prohibitedPower: boolean;
  prohibitedPowerFamilies: Array<'lower' | 'upper'>;
  affectedDomains: Section18SafetyDomain[];
  unaffectedDomains: Section18SafetyDomain[];
  trainingPaused: boolean;
  mainStrengthFrequencyCeiling: number | null;
  conditioningFrequencyCeiling: number | null;
  sprintHighSpeedFrequencyCeiling: number | null;
  lighterStrengthRequired: boolean;
  strengthIntensityCeiling: 'Light' | 'Moderate' | null;
  meaningfulMainLiftSetCeiling: number | null;
  reasons: WeeklyExposureReductionReason[];
}

export interface WeeklyExposureContractV2 {
  protocolVersion: typeof WEEKLY_EXPOSURE_CONTRACT_V2_VERSION;
  authority: 'LFA_PROGRAMMING_BIBLE_SECTION_18';
  source: 'section18_resolver' | 'legacy_migration';
  /** Complete typed reduction ledger; domain arrays below are projections. */
  authorisedReductions: Section18AuthorisedReduction[];
  /** Safety-only ownership consumed by the shared post-canonical finaliser. */
  safety: Section18SafetyPolicy;
  /**
   * From which date this contract governs. Earlier dates are history — counted
   * toward requirements, never governed, never rewritten. Optional so every
   * contract authored before this concept remains valid and fully governed.
   */
  governedFromISO?: Section18GovernedFrom;
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
    optionalRecoveryAerobic: {
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
    /** Phase/mode-owned blocking ceiling. A preferred count is never a maximum. */
    permittedHardDayMaximum: number;
    /** @deprecated Compatibility projection of preferredHardDayRange.max. */
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
  phaseEntryWeekStartISO?: string | null;
  phaseClockSelectedPhase?: SeasonPhase | null;
  phaseWeekProvenance?: Section18Identity['phaseWeekProvenance'];
  weekKind?: WeekKind;
  anchorState: Section18AnchorState;
  teamTrainingDays: readonly number[];
  /**
   * EVERY FIXTURE THIS WEEK, NOT THE FIRST ONE.
   *
   * Was `fixtureDay?: number | null`. A week can hold more than one fixture —
   * a split round, a midweek game plus the usual weekend one — and
   * `targetWeekFixtures` has always RETURNED them all. The singular field is
   * where they were thrown away: `derivedWeekContract:90` took `fixtures[0]`
   * and the rest never reached an anchor, so the second game of a Wednesday +
   * Saturday week got no G-1/G-2 protection, no credit and no place in the
   * week's identity. Measured 2026-08-12: both fixtures resolve, one survives.
   *
   * `teamTrainingDays` directly above has been a list since the beginning and
   * `anchorsFor` has always mapped over it; this is the same shape applied to
   * the anchor kind that needed it more.
   */
  fixtureDays?: readonly number[];
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
    optionalRecoveryAerobic?: number | null;
    sprintHighSpeed: number | null;
    powerPrimers: number | null;
  };
  prohibitedPatterns?: readonly MainStrengthPattern[];
  prohibitedPatternProvenance?: WeeklyExposureContractV2['strengthPatterns']['prohibitedPatternProvenance'];
  intentionalImbalanceReason?: string | null;
  reductions?: readonly Section18AuthorisedReduction[];
  prohibitedSprintHighSpeed?: boolean;
  prohibitedPower?: boolean;
  prohibitedPowerFamilies?: readonly ('lower' | 'upper')[];
  affectedSafetyDomains?: readonly Section18SafetyDomain[];
  trainingPaused?: boolean;
  authorisedUnavoidableAnchorExcess?: number;
  equipment?: Partial<Section18EquipmentPolicyState>;
  source?: WeeklyExposureContractV2['source'];
}

const ALL_PATTERNS: readonly MainStrengthPattern[] = ['squat', 'hinge', 'push', 'pull'];
const ALL_SAFETY_DOMAINS: readonly Section18SafetyDomain[] = [
  'main_strength',
  'conditioning',
  'sprint_high_speed',
  'power',
  'anchor_participation',
  'session_dose',
];

const SAFETY_REDUCTION_REASONS = new Set<WeeklyExposureReductionReason>([
  'low_readiness',
  'injury_restriction',
  'bye_recovery_mode',
  'optional_week_mode',
  'deload_policy',
  'training_age_limit',
  'full_pause',
]);

function safetyFrequencyCeiling(
  reductions: readonly Section18AuthorisedReduction[],
  metric: Section18ReductionMetric,
): number | null {
  const targets = reductions
    .filter((entry) => entry.metric === metric && entry.change !== 'dose_intensity' &&
      SAFETY_REDUCTION_REASONS.has(entry.reason))
    .map((entry) => entry.reducedTarget);
  return targets.length > 0 ? Math.min(...targets) : null;
}

function buildSafetyPolicy(args: {
  mode: Section18WeekMode;
  weekKind: WeekKind;
  prohibitedPatterns: readonly MainStrengthPattern[];
  requiredSafePatterns: readonly MainStrengthPattern[];
  reductions: readonly Section18AuthorisedReduction[];
  cookedReadiness: boolean;
  prohibitedSprintHighSpeed?: boolean;
  prohibitedPower: boolean;
  prohibitedPowerFamilies?: readonly ('lower' | 'upper')[];
  affectedSafetyDomains?: readonly Section18SafetyDomain[];
  trainingPaused?: boolean;
}): Section18SafetyPolicy {
  const trainingPaused = args.trainingPaused === true || args.reductions.some((entry) =>
    entry.reason === 'full_pause');
  const optionalWeek = args.mode === 'optional_week';
  // THE ILLNESS LAW (Sam, 2026-07-27) — the SPLIT. illness_recovery used to
  // inherit bye_recovery's entire recovery-tier envelope: a main-lift ceiling of
  // 2, a Moderate intensity ceiling, a 2-set meaningful-lift ceiling and no
  // power. Two doors sharing one envelope, and it belonged to neither — the
  // illness door's dose is the DELOAD LAW's, and a bye is not an illness. What
  // illness does to the week is "nothing required, everything optional", which
  // is `policyFor`'s business, not the safety envelope's.
  const byeRecovery = args.mode === 'in_season_bye_recovery';
  // A deload week still trains LIGHTER — that is the deload law's own
  // instruction ("every set easy, RPE 5-6"), not an invented reduction. It is
  // the removal of POWER and the cutting of COUNTS that the law forbids.
  const lighterStrengthRequired = args.cookedReadiness || byeRecovery ||
    optionalWeek || args.weekKind === 'deload';
  const reducedMainCeiling = safetyFrequencyCeiling(args.reductions, 'main_strength_frequency');
  const mainCeiling = trainingPaused
    ? 0
    : byeRecovery
      ? Math.min(2, reducedMainCeiling ?? 2)
      : reducedMainCeiling;
  const conditioningCeiling = trainingPaused
    ? 0
    : safetyFrequencyCeiling(args.reductions, 'conditioning_core_frequency');
  const sprintCeiling = trainingPaused || args.prohibitedSprintHighSpeed
    ? 0
    : safetyFrequencyCeiling(args.reductions, 'sprint_high_speed_frequency');
  // THE DELOAD LAW: a deload and a cooked athlete no longer remove power —
  // "a deload is not a reason to lose sharpness". A bye recovery week still
  // does; that mode is not a deload door and Sam's law does not reach it.
  const prohibitedPower = trainingPaused || args.prohibitedPower || byeRecovery;
  const affected = new Set<Section18SafetyDomain>(args.affectedSafetyDomains ?? []);
  if (args.prohibitedPatterns.length > 0 || mainCeiling !== null) affected.add('main_strength');
  if (conditioningCeiling !== null) affected.add('conditioning');
  if (sprintCeiling !== null || args.prohibitedSprintHighSpeed) affected.add('sprint_high_speed');
  if (prohibitedPower || (args.prohibitedPowerFamilies?.length ?? 0) > 0) affected.add('power');
  if (lighterStrengthRequired) affected.add('session_dose');
  if (args.prohibitedSprintHighSpeed) affected.add('anchor_participation');
  const reasons = Array.from(new Set(args.reductions
    .filter((entry) => SAFETY_REDUCTION_REASONS.has(entry.reason))
    .map((entry) => entry.reason)));
  // The envelope split above means `byeRecovery` no longer covers illness. The
  // TYPED REASON must still be recorded for both — an untyped reduction is
  // exactly what INV_EXPOSURE_REDUCTION_HAS_REASON exists to catch.
  const recoveryReason: WeeklyExposureReductionReason = optionalWeek
    ? 'optional_week_mode' : 'bye_recovery_mode';
  if ((byeRecovery || optionalWeek) && !reasons.includes(recoveryReason)) {
    reasons.push(recoveryReason);
  }
  return {
    requiredSafePatterns: [...args.requiredSafePatterns],
    prohibitedPatterns: [...args.prohibitedPatterns],
    prohibitedSprintHighSpeed: trainingPaused || args.prohibitedSprintHighSpeed === true,
    prohibitedPower,
    prohibitedPowerFamilies: Array.from(new Set(args.prohibitedPowerFamilies ?? [])),
    affectedDomains: ALL_SAFETY_DOMAINS.filter((domain) => affected.has(domain)),
    unaffectedDomains: ALL_SAFETY_DOMAINS.filter((domain) => !affected.has(domain)),
    trainingPaused,
    mainStrengthFrequencyCeiling: mainCeiling,
    conditioningFrequencyCeiling: conditioningCeiling,
    sprintHighSpeedFrequencyCeiling: sprintCeiling,
    lighterStrengthRequired,
    strengthIntensityCeiling: args.cookedReadiness || byeRecovery ? 'Moderate' : null,
    meaningfulMainLiftSetCeiling: args.cookedReadiness || byeRecovery ? 2 : null,
    reasons,
  };
}

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
    unresolvedPlannerSelectedShortfall: null,
    maximumBreach: null,
  };
}

/**
 * Stable Section 18 signature for cross-path phase-table comparisons.
 *
 * Contract v2 is the phase-planner authority. Legacy targetCount projections
 * must not decide whether Repeat Week may retain source prescriptions. Early
 * Off-season keeps optional main-strength selection explicit without turning
 * it into an enforceable core target.
 */
export function section18PhaseTableSignature(
  contract: WeeklyExposureContractV2 | null | undefined,
): string {
  if (!contract) return 'missing';
  const mainStrength = contract.mainStrength.exposure.plannerSelectionKind === 'optional'
    ? contract.mainStrength.optionalMainStrengthSelected
    : contract.mainStrength.exposure.plannerSelectedTarget;
  return JSON.stringify({
    mode: contract.identity.mode,
    mainStrength,
    coreConditioning: contract.conditioning.core.plannerSelectedTarget,
    sprintHighSpeed: contract.sprintHighSpeed.exposure.plannerSelectedTarget,
  });
}

function expectedSubphase(input: Section18ContractV2Input): Section18Subphase | null {
  const phaseWeek = input.phaseWeek;
  if (input.seasonPhase === 'Off-season') {
    return phaseWeek
      ? resolveSeasonSubphaseAtPhaseWeek(input.seasonPhase, phaseWeek)
      : null;
  }
  if (input.seasonPhase === 'Pre-season') {
    if (input.anchorState === 'practice_match') return 'practice_match_week';
    return phaseWeek
      ? resolveSeasonSubphaseAtPhaseWeek(input.seasonPhase, phaseWeek)
      : null;
  }
  // The optional-week mode no longer answers here: it says what the week DOES,
  // and this function answers where the week IS. An optional week keeps the
  // season position it would have had, in every phase.
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
  for (const fixtureDay of uniqueDays(input.fixtureDays ?? [])) {
    const kind: Section18AnchorKind = input.anchorState === 'practice_match'
      ? 'practice_match'
      : 'game';
    anchors.push({
      id: `${kind}-${fixtureDay}`,
      kind,
      dayOfWeek: fixtureDay,
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
  hardDays: { preferred: Section18Range; permittedMaximum: number };
  balance: boolean;
  selectionKind: Section18PlannerSelectionKind;
}

export interface Section18PhasePlannerSelectionInput {
  mode: Section18WeekMode;
  readiness: ReadinessLevel;
  availableDayCount: number;
  teamTrainingCount: number;
  weekKind?: WeekKind;
  /** Explicit typed ceiling resolved by training-age/readiness/injury ownership. */
  mainStrengthFrequencyCeiling?: number | null;
  conditioningCoreFrequencyCeiling?: number | null;
  sprintHighSpeedFrequencyCeiling?: number | null;
}

export interface Section18PhasePlannerSelection {
  mainStrength: number;
  coreConditioning: number;
  sprintHighSpeed: number;
  optionalMainStrength: number;
  optionalFlush: number;
  optionalRecoveryAerobic: number;
  appCoreConditioning: number;
  requiredAppMediumHardMinimum: number;
  requiredAppHardMinimum: number;
}

/** Section 18 table translated directly; no legacy builder constants are read. */
/**
 * The mode an optional week would have carried. Its subphase is untouched by the
 * optional stamp, so it still says where in the season this week sits; only the
 * in-season subphases need mapping back to their mode names.
 */
function underlyingModeForSubphase(
  input: { declaredSubphase?: Section18Subphase },
): Section18WeekMode {
  switch (input.declaredSubphase) {
    case undefined: return 'in_season_bye_build';
    // An optional week's subphase must be a real season position. If one ever
    // arrives still carrying the mode name — persisted data from before the
    // de-conflation, or a fixture — fall back rather than recurse forever.
    case 'optional_week' as never: return 'in_season_bye_build';
    case 'game_week': return 'in_season_game_week';
    case 'bye_recovery': return 'in_season_bye_recovery';
    case 'bye_build': return 'in_season_bye_build';
    case 'practice_match_week': return 'practice_match_week';
    default: return input.declaredSubphase as Section18WeekMode;
  }
}

function policyFor(input: Pick<
  Section18ContractV2Input,
  'mode' | 'teamTrainingDays' | 'cookedReadiness' | 'readiness' | 'weekKind'
> & {
  /** Read only when recovering the week an optional stamp decorates. */
  anchorState?: Section18AnchorState;
  /**
   * The week's true season position, read ONLY by `optional_week` to recover the
   * policy it decorates rather than inventing counts of its own. Optional
   * because the phase-planner selection path has no subphase to offer; absent,
   * an optional week decorates the bye build week, which is the conservative
   * choice — it has the fuller structure, and the deload law says structure does
   * not change.
   */
  declaredSubphase?: Section18Subphase;
}): Section18ModePolicy {
  const tt = uniqueDays(input.teamTrainingDays).length;
  // THE DELOAD LAW (Sam, 2026-07-27): "Power/speed: KEEP a small sharp dose ...
  // Power is not removed on a deload; a deload is not a reason to lose
  // sharpness." This file used to compute `noPower` from cooked readiness, low
  // readiness and a deload week — all three of which are DELOAD DOORS, so all
  // three removed the one thing the law says a deload keeps. The deload law
  // shipped in the dose layer and never reached §18, leaving the contradiction
  // live in two representations. Power now survives every deload door; only a
  // genuine safety prohibition removes it, below.
  switch (input.mode) {
    case 'in_season_game_week':
    // RULED (Sam, 2026-07-28): a pre-season practice-match week is structurally
    // an IN-SEASON GAME WEEK and carries its authored numbers. `practice_match_week`
    // had a policy of its own here — required 3 against this row's 2, its own
    // preferred range, no full-rest requirement, and a different app-conditioning
    // minimum. That WAS the second representation, so the ruling deletes it
    // rather than editing it into agreement: editing two rows into matching
    // leaves two rows, and the next change moves only one of them.
    //
    // The mode survives in the enum because identity still needs it — a
    // practice-match week is a pre-season week, and Section 18 checks the
    // declared subphase against the season phase. What does not survive is a
    // second set of numbers for the same shape.
    case 'practice_match_week':
      return {
        strength: { required: 2, defaultTarget: 3, preferred: { min: 2, max: 3 }, max: 4 },
        // RULED (Sam, 2026-08-05): `optionalFlush` min 0 → 1. Bible :81's three
        // ideal in-season structures all carry "optional flushout/ aerobic
        // conditioning off-leg", and the ruling makes them conformance targets
        // on this point rather than illustrations — so the week always OFFERS
        // one. It stays `max: 1`, and it rides as an OPTIONAL: the flush is
        // counted in `optionalFlushCount`, never `coreCount`, so :127's
        // arithmetic is untouched — team training plus the game still satisfy
        // the in-season conditioning target on their own.
        //
        // This row is shared with `practice_match_week` by the 2026-07-28 ruling
        // above ("structurally an IN-SEASON GAME WEEK and carries its authored
        // numbers"), so a pre-season practice-match week gains the offer too.
        // That follows from the existing ruling rather than a new one, and is
        // flagged in the boundary report for Sam.
        conditioning: { required: 3, defaultTarget: Math.max(3, tt + 1), preferred: { min: 3, max: Math.max(3, tt + 1) }, max: Math.max(3, tt + 1), stress: ['moderate', 'hard'], optionalFlush: { min: 1, max: 1 }, requiredAppMediumHardMinimum: tt === 0 ? 2 : tt === 1 ? 1 : 0,
          // RULED (Sam, 2026-07-29): in ANY fixture week the GAME carries the
          // hard conditioning exposure, so the contract never requires a hard
          // app-conditioning session on top of it — the app top-up is moderate
          // or easier. This used to read `tt === 1 ? 1 : 0`, which demanded a
          // hard app session in a game week with exactly one team training.
          // Combined with the practice-match ruling that made a pre-season
          // fixture week game-shaped, that week could not be built at all: the
          // §18 gateway exhausted its repairs and returned `impossible`, which
          // the athlete met as "We couldn't safely build your week from your
          // current settings."
          //
          // The count side of this credit already existed — `appCoreConditioning`
          // subtracts 1 for a fixture week. Only the INTENSITY side was missing.
          requiredAppHardMinimum: 0,
          permittedHardCoreMaximum: null },
        sprint: { required: 1, preferred: { min: 1, max: 1 }, max: null },
        power: { eligible: true, preferred: { min: 0, max: 2 }, removalReason: null },
        rest: { required: 1, preferred: { min: 1, max: 2 } },
        hardDays: { preferred: { min: 3, max: 4 }, permittedMaximum: 5 },
        balance: true,
        selectionKind: 'core',
      };
    case 'in_season_bye_build':
      return {
        strength: { required: 2, defaultTarget: 3, preferred: { min: 3, max: 4 }, max: 4 },
        conditioning: { required: 3, defaultTarget: 3, preferred: { min: 3, max: 4 }, max: null, stress: ['moderate', 'hard'], optionalFlush: { min: 0, max: 1 }, requiredAppMediumHardMinimum: 0, requiredAppHardMinimum: 0, permittedHardCoreMaximum: null },
        sprint: { required: 1, preferred: { min: 1, max: 1 }, max: null },
        power: { eligible: true, preferred: { min: 0, max: 2 }, removalReason: null },
        rest: { required: 1, preferred: { min: 1, max: 2 } },
        hardDays: { preferred: { min: 3, max: 4 }, permittedMaximum: 5 },
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
        hardDays: { preferred: { min: 2, max: 2 }, permittedMaximum: 4 },
        balance: true,
        selectionKind: 'core',
      };
    case 'optional_week': {
      // THE ILLNESS LAW (Sam, 2026-07-27) — severity decides exactly TWO things,
      // deload or not and optional or not. "No other illness-specific numbers
      // may exist."
      //
      // This case used to hand-write a whole policy: strength capped at 2, a
      // light-only conditioning stress, a zero hard-core maximum, one sprint,
      // four rest days, a hard-day cap and no power — borrowed wholesale from
      // bye_recovery's envelope. Every one of those was an illness-specific
      // number, and the count ceilings were also STRUCTURE, which the deload law
      // holds constant while the work shrinks.
      //
      // So the mode DECORATES the week the athlete would otherwise have had.
      // Only the two flags the law authorises are applied: nothing required, and
      // selection optional. The dose shrink is DELOAD_LAW's and is not a §18
      // ceiling.
      //
      // Recovering the underlying week, in ANY phase. The declared subphase is
      // the week's true season position and survives the optional stamp, so it
      // is the honest source — this used to assume in-season and pick between a
      // game week and a bye, which silently mis-typed every off-season and
      // pre-season optional week.
      const base = policyFor({ ...input, mode: underlyingModeForSubphase(input) });
      return {
        ...base,
        strength: { ...base.strength, required: 0, defaultTarget: 0 },
        conditioning: {
          ...base.conditioning,
          required: 0,
          defaultTarget: 0,
          requiredAppMediumHardMinimum: 0,
          requiredAppHardMinimum: 0,
          // The core conditioning CEILING is lifted too, as it always was on
          // this mode. An optional week additionally offers easy recovery
          // aerobic work (see `optionalRecoveryAerobic` below), and that work
          // counts toward this total — so keeping the base week's ceiling would
          // reject the week for accepting the very sessions the mode exists to
          // offer. This is not a dose number: nothing here is required, so
          // nothing here is capped. The athlete chooses.
          max: null,
        },
        sprint: { ...base.sprint, required: 0 },
        // Nothing is required, so no pattern balance can be required either.
        balance: false,
        selectionKind: 'optional',
      };
    }
    case 'early_offseason':
      return {
        strength: { required: 0, defaultTarget: 0, preferred: { min: 2, max: 3 }, max: 3 },
        conditioning: { required: 0, defaultTarget: 0, preferred: { min: 1, max: 2 }, max: 3, stress: ['light'], optionalFlush: { min: 1, max: 2 }, requiredAppMediumHardMinimum: 0, requiredAppHardMinimum: 0, permittedHardCoreMaximum: 0 },
        sprint: { required: 0, preferred: { min: 0, max: 0 }, max: 0 },
        power: { eligible: false, preferred: { min: 0, max: 0 }, removalReason: 'early_offseason' },
        rest: { required: 0, preferred: { min: 3, max: 4 } },
        hardDays: { preferred: { min: 0, max: 2 }, permittedMaximum: 4 },
        balance: false,
        selectionKind: 'optional',
      };
    case 'mid_offseason':
      return {
        strength: { required: 3, defaultTarget: 4, preferred: { min: 3, max: 4 }, max: 4 },
        conditioning: { required: 3, defaultTarget: 3, preferred: { min: 3, max: 4 }, max: 5, stress: ['light', 'moderate', 'hard'], optionalFlush: { min: 0, max: 1 }, requiredAppMediumHardMinimum: 0, requiredAppHardMinimum: 0, permittedHardCoreMaximum: 1 },
        sprint: { required: 1, preferred: { min: 1, max: 1 }, max: null },
        power: { eligible: true, preferred: { min: 1, max: 2 }, removalReason: null },
        rest: { required: 0, preferred: { min: 2, max: 2 } },
        hardDays: { preferred: { min: 3, max: 4 }, permittedMaximum: 5 },
        balance: true,
        selectionKind: 'core',
      };
    case 'late_offseason':
      return {
        strength: { required: 3, defaultTarget: 4, preferred: { min: 3, max: 4 }, max: 4 },
        conditioning: { required: 3, defaultTarget: 4, preferred: { min: 4, max: 4 }, max: 5, stress: ['light', 'moderate', 'hard'], optionalFlush: { min: 0, max: 1 }, requiredAppMediumHardMinimum: 0, requiredAppHardMinimum: 0, permittedHardCoreMaximum: 2 },
        sprint: { required: 1, preferred: { min: 1, max: 2 }, max: 2 },
        power: { eligible: true, preferred: { min: 1, max: 2 }, removalReason: null },
        rest: { required: 0, preferred: { min: 2, max: 2 } },
        hardDays: { preferred: { min: 3, max: 4 }, permittedMaximum: 5 },
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
        power: { eligible: true, preferred: { min: 1, max: 2 }, removalReason: null },
        rest: { required: 0, preferred: { min: 2, max: 2 } },
        hardDays: { preferred: { min: 3, max: 4 }, permittedMaximum: 5 },
        balance: true,
        selectionKind: 'core',
      };
  }
}

function clampSelectedTarget(
  target: number,
  maximum: number | null,
  explicitCeiling: number | null | undefined,
): number {
  return Math.max(0, Math.min(
    target,
    maximum ?? Number.POSITIVE_INFINITY,
    explicitCeiling ?? Number.POSITIVE_INFINITY,
  ));
}

/**
 * Section 18 phase-owned selection. This runs before weekday allocation, so
 * old geometry, optional work and support placeholders cannot choose the
 * weekly targets. Typed safety/training-age ceilings may constrain a default;
 * the legacy contract records the corresponding reduction reason.
 */
export function resolveSection18PhasePlannerSelection(
  input: Section18PhasePlannerSelectionInput,
): Section18PhasePlannerSelection {
  const teamTrainingCount = Math.max(0, Math.floor(input.teamTrainingCount));
  const availableDayCount = Math.max(0, Math.floor(input.availableDayCount));
  const policy = policyFor({
    mode: input.mode,
    teamTrainingDays: Array.from({ length: teamTrainingCount }, (_, index) => index),
    readiness: input.readiness,
    // READINESS IS A HOMONYM (Sam, 2026-07-27). `input.readiness` is the
    // CAPACITY score `calculateReadiness` computes from onboarding answers —
    // recent training load, conditioning level, sprint exposure. It changes only
    // when the profile changes and means "this athlete's baseline is low", NOT
    // "I am cooked today". Feeding it in here handed a detrained athlete the
    // safety envelope of someone who had declared themselves wrecked. Sam ruled
    // it CUT: cooked readiness comes from the readiness FACT and nothing else.
    cookedReadiness: false,
    weekKind: input.weekKind,
  });
  const recoveryMode = input.mode === 'in_season_bye_recovery';
  const optionalWeek = input.mode === 'optional_week';
  const earlyOffseason = input.mode === 'early_offseason';
  // RULED (Sam, 2026-07-28, Batch 2 — authored FIRST because this is the OWNER).
  // Two conjuncts died here, for different reasons:
  //   readiness === 'high'      capacity may not set structure. Deleting it
  //                             anywhere else while the owner kept its own axis
  //                             would have MOVED the axis, not removed it.
  //   teamTrainingCount <= 1    Sam: a bye build week may still carry 2 team
  //                             days. This was never a rule, just an untested
  //                             assumption about what a bye looks like.
  // What remains is a pure SCHEDULE fact: enough days to hold four sessions.
  // RULED (a) (Sam, 2026-07-28): 4 is the PREFERRED MAXIMUM / planner aim for a
  // bye build week with room for it — never a selected target that §18 rejects
  // stored weeks against. Freshly planned weeks aim for 4; weeks already
  // accepted at 3 stay valid, with no migration and no rejection-on-read.
  //
  // THE STANDING LAW THIS GENERALISES: a preference changes the shape of FUTURE
  // planning and never invalidates accepted history.
  //
  // So `strongByeBuild` is DELETED rather than rewritten. The aim of 4 already
  // exists — this mode's policy is
  //   strength: { required: 2, defaultTarget: 3, preferred: { min: 3, max: 4 }, max: 4 }
  // so `preferred.max` is the planner aim and `defaultTarget` is the selected
  // target §18 validates. The old branch raised the SELECTED target to 4, which
  // is what made §18 reject a stored week built at 3 and empty it on rehydrate.
  // Nothing needs to be added to express the ruling; the override was the defect.

  const unconstrainedStrength = earlyOffseason
    // RULED: early off-season strength target is 3, flat. Every session in the
    // block is optional, so the target describes what is OFFERED, not owed.
    ? Math.min(policy.strength.max, availableDayCount, 3)
    : policy.strength.defaultTarget;
  const strengthCapacity = earlyOffseason
    ? availableDayCount
    : Number.POSITIVE_INFINITY;
  const mainStrength = clampSelectedTarget(
    Math.min(unconstrainedStrength, strengthCapacity),
    policy.strength.max,
    input.mainStrengthFrequencyCeiling,
  );

  const coreConditioning = clampSelectedTarget(
    recoveryMode ? teamTrainingCount : policy.conditioning.defaultTarget,
    policy.conditioning.max,
    input.conditioningCoreFrequencyCeiling,
  );
  const sprintHighSpeed = clampSelectedTarget(
    policy.sprint.required,
    policy.sprint.max,
    input.sprintHighSpeedFrequencyCeiling,
  );
  // Severe-illness recovery selects only OPTIONAL, reduced work: up to two light
  // optional lifts and one gentle aerobic session, with every enforceable floor
  // (main strength / core conditioning / sprint) at 0. Nothing is required.
  const illnessOptionalStrength = optionalWeek
    ? Math.min(policy.strength.preferred.max, availableDayCount)
    : 0;
  const optionalRecoveryAerobic = optionalWeek
    ? Math.min(1, Math.max(0, availableDayCount - illnessOptionalStrength))
    : recoveryMode
      ? teamTrainingCount === 0 && availableDayCount > mainStrength
        ? Math.min(1, availableDayCount - mainStrength)
        : teamTrainingCount === 1 && availableDayCount > mainStrength
          ? 1
          : 0
      : earlyOffseason
        // RULED (Sam, 2026-07-28): 0 required, 1-2 optional. The
        // `teamTrainingCount < 3` conjunct died with the readiness one and for a
        // plainer reason — there are NO team days in early off-season, so it was
        // a condition that could never be false, dressed as a decision.
        ? Math.min(2, Math.max(0, availableDayCount - mainStrength))
        : 0;

  return {
    mainStrength,
    coreConditioning,
    sprintHighSpeed,
    optionalMainStrength: earlyOffseason ? mainStrength : illnessOptionalStrength,
    // RULED (Sam, 2026-08-05): the optional flushout is a REQUIRED OFFER on an
    // in-season week — the app always presents it, doing it is the athlete's
    // choice. See docs/FLUSH_OFFER_RULING_2026-08-05.md.
    //
    // This used to be a flat `0`, which is what made `optionalFlush.min` INERT:
    // the authored minimum was read by nothing, so a mode could author "offer at
    // least one flush" and no week ever did. Only `.max` had an effect (as a
    // placement cap), so the table's two numbers meant "cap" and "decoration".
    //
    // Declaring the authored minimum here is the whole of the "declare, then
    // place" ownership (architecture reassessment
    // docs/1B_FLUSH_OFFER_ARCHITECTURE_REASSESSMENT_2026-08-06.md, questions
    // 4/5): the planner states what the week wants BEFORE the contract is built,
    // the contract carries it, and the allocation's job is to place what was
    // declared. The move this replaces — stamping a flush AFTER the contract was
    // built — was invisible to the contract that then judged it, and failed for
    // that reason on 2026-08-05.
    //
    // Modes whose `selectionKind` is `optional` never reach this field: the
    // contract builder reads `plannerSelected.coreConditioning` for them
    // instead, so early off-season's authored `{min:1,max:2}` is unaffected.
    optionalFlush: policy.conditioning.optionalFlush.min,
    optionalRecoveryAerobic,
    // The fixture IS one of the week's conditioning exposures. Same fact the
    // intensity policy above reads, asked through the same predicate.
    appCoreConditioning: Math.max(0, coreConditioning - teamTrainingCount -
      (isFixtureWeekMode(input.mode) ? 1 : 0)),
    requiredAppMediumHardMinimum: policy.conditioning.requiredAppMediumHardMinimum,
    requiredAppHardMinimum: policy.conditioning.requiredAppHardMinimum,
  };
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
  const coreSprintSelected = selectedKind === 'optional'
    ? 0
    : input.plannerSelected.sprintHighSpeed;
  const optionalFlushSelected = selectedKind === 'optional'
    ? input.plannerSelected.coreConditioning
    : input.plannerSelected.optionalFlush ?? 0;
  const optionalRecoveryAerobicSelected = input.plannerSelected.optionalRecoveryAerobic ?? 0;
  const powerEligible = policy.power.eligible && prohibited.length < ALL_PATTERNS.length;
  const powerRemoval = powerEligible
    ? null
    : policy.power.removalReason ?? (prohibited.length === ALL_PATTERNS.length ? 'full_pattern_restriction' : 'ineligible');
  const selectedAppCoreCapacity = Math.max(
    0,
    (input.plannerSelected.coreConditioning ?? conditioningRequired) - anchors.length,
  );

  return {
    protocolVersion: WEEKLY_EXPOSURE_CONTRACT_V2_VERSION,
    authority: 'LFA_PROGRAMMING_BIBLE_SECTION_18',
    source: input.source ?? 'section18_resolver',
    authorisedReductions: reductions,
    safety: buildSafetyPolicy({
      mode: input.mode,
      weekKind: input.weekKind ?? 'build',
      prohibitedPatterns: prohibited,
      requiredSafePatterns,
      reductions,
      // The same homonym cut as above: the capacity score does not make an
      // athlete "cooked". Only the readiness door's own flag does.
      cookedReadiness: input.cookedReadiness === true,
      prohibitedSprintHighSpeed: input.prohibitedSprintHighSpeed,
      prohibitedPower: input.prohibitedPower === true || !powerEligible,
      prohibitedPowerFamilies: input.prohibitedPowerFamilies,
      affectedSafetyDomains: input.affectedSafetyDomains,
      trainingPaused: input.trainingPaused,
    }),
    identity: {
      seasonPhase: input.seasonPhase,
      declaredSubphase: input.declaredSubphase,
      expectedSubphase: expectedSubphase(input),
      mode: input.mode,
      blockNumber: input.blockNumber ?? null,
      weekInBlock: input.weekInBlock ?? null,
      globalWeek: input.globalWeek ?? null,
      phaseWeek: input.phaseWeek ?? null,
      phaseEntryWeekStartISO: input.phaseEntryWeekStartISO ?? null,
      phaseClockSelectedPhase: input.phaseClockSelectedPhase ?? null,
      phaseWeekProvenance: input.phaseWeekProvenance ?? 'legacy_unknown',
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
      optionalRecoveryAerobic: {
        permitted: input.mode === 'in_season_bye_recovery' ||
          input.mode === 'optional_week' || input.mode === 'early_offseason',
        preferredRange: input.mode === 'in_season_bye_recovery' ||
          input.mode === 'optional_week'
          ? policy.conditioning.optionalFlush
          : input.mode === 'early_offseason'
            ? policy.conditioning.preferred
            : { min: 0, max: 0 },
        plannerSelectedCount: optionalRecoveryAerobicSelected,
        achievedCount: null,
      },
      optionalNonCoreAchievedCount: null,
      legacyUnknownAchievedCount: null,
      requiredCoreStress: policy.conditioning.stress,
      intensityPolicy: {
        requiredAppMediumHardMinimum: Math.min(
          policy.conditioning.requiredAppMediumHardMinimum,
          selectedAppCoreCapacity,
        ),
        requiredAppHardMinimum: Math.min(
          policy.conditioning.requiredAppHardMinimum,
          selectedAppCoreCapacity,
        ),
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
        // Sprint was the ONE domain that never received the week's selection
        // kind, so it silently defaulted to 'core' while strength and
        // conditioning were correctly marked optional. §18 then held every
        // optional week to a core sprint target the mode has none of by design,
        // and rejected the commit — which is what made a severe illness
        // impossible to report. The kind and the core selection move together
        // here exactly as they do for the other two.
        selected: coreSprintSelected,
        selectionKind: selectedKind,
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
      preferredHardDayRange: policy.hardDays.preferred,
      permittedHardDayMaximum: policy.hardDays.permittedMaximum,
      normalProgrammedHardDayMaximum: policy.hardDays.preferred.max,
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

/** Rebuild the derived safety projection after active constraints change a persisted contract. */
export function refreshSection18SafetyPolicy(
  source: WeeklyExposureContractV2,
  overrides: Partial<Pick<
    Section18ContractV2Input,
    | 'prohibitedSprintHighSpeed'
    | 'prohibitedPower'
    | 'prohibitedPowerFamilies'
    | 'affectedSafetyDomains'
    | 'trainingPaused'
    | 'cookedReadiness'
  >> = {},
): WeeklyExposureContractV2 {
  const contract = JSON.parse(JSON.stringify(source)) as WeeklyExposureContractV2;
  const persistedCookedReadiness = contract.authorisedReductions.some((entry) =>
    entry.reason === 'low_readiness' && (
      entry.metric === 'main_strength_frequency' ||
      entry.metric === 'conditioning_core_frequency' ||
      entry.metric === 'session_intensity_percent' ||
      entry.metric === 'session_volume'
    ));
  contract.safety = buildSafetyPolicy({
    mode: contract.identity.mode,
    weekKind: contract.identity.weekKind,
    prohibitedPatterns: contract.strengthPatterns.prohibitedPatterns,
    requiredSafePatterns: contract.strengthPatterns.requiredSafePatterns,
    reductions: contract.authorisedReductions,
    cookedReadiness: overrides.cookedReadiness ?? persistedCookedReadiness,
    prohibitedSprintHighSpeed: overrides.prohibitedSprintHighSpeed ??
      contract.safety?.prohibitedSprintHighSpeed,
    prohibitedPower: overrides.prohibitedPower ?? contract.power.eligible === false,
    prohibitedPowerFamilies: overrides.prohibitedPowerFamilies ??
      contract.safety?.prohibitedPowerFamilies,
    affectedSafetyDomains: overrides.affectedSafetyDomains ?? contract.safety?.affectedDomains,
    trainingPaused: overrides.trainingPaused ?? contract.safety?.trainingPaused,
  });
  return contract;
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

const OFF_SEASON_SUBPHASES: ReadonlySet<string> = new Set([
  'early_offseason',
  'mid_offseason',
  'late_offseason',
]);

/**
 * The contract's own answer to "where in the off-season is this week".
 *
 * `declaredSubphase` spans off-season, pre-season and the in-season week kinds,
 * so it needs narrowing before it can serve as an OFF-SEASON subphase. Null
 * means the contract is not describing an off-season week — the caller decides
 * what that means for it, which for a canonical context is `'not_off_season'`.
 *
 * Exists because the canonicalisation context now REQUIRES the resolution and
 * several §18 builders had the contract in hand without reading this field.
 */
export function contractOffseasonSubphase(
  contract: WeeklyExposureContractV2,
): OffseasonSubphase | null {
  if (contract.identity.seasonPhase !== 'Off-season') return null;
  const declared = contract.identity.declaredSubphase;
  return OFF_SEASON_SUBPHASES.has(declared) ? (declared as OffseasonSubphase) : null;
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
    phaseEntryWeekStartISO: null,
    phaseClockSelectedPhase: null,
    phaseWeekProvenance: 'legacy_unknown',
    weekKind: legacy.identity.weekKind,
    anchorState: anchorStateFromLegacy(legacy),
    teamTrainingDays: legacy.anchors.teamTrainingDays,
    // The legacy shape carries ONE game day and cannot express more; a list of
    // one is the honest translation, not a widening.
    fixtureDays: legacy.anchors.gameDay === null ? [] : [legacy.anchors.gameDay],
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
