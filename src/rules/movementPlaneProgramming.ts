/** Pure movement-plane tie-breaking and coverage auditing. No writes or UI. */

import {
  movementPlaneMetadataFor,
  type MovementPlane,
} from '../data/exerciseMovementPlaneMetadata';
import { muscleMetadataFor } from '../data/muscleExperienceMetadata';
import type { ConditioningQuality } from '../data/conditioningTemplates';
import type {
  ContractPhase,
  OffseasonBlock,
} from './weeklyProgrammingContract';

export interface MovementPlaneTieBreakContext {
  /** The automatic identity being replaced on this date, when there is one. */
  readonly referenceIdentity?: string;
  /** Useful planes the already-filtered week has not supplied yet. */
  readonly missingUsefulPlanes?: readonly MovementPlane[];
}

/**
 * Return only the equal-suitability cohort favoured by movement planes.
 * Callers apply every legality/purpose/family gate before this function and
 * stable history inside the returned cohort afterwards.
 */
export function preferredMovementPlaneCohort<T extends string>(
  candidates: readonly T[],
  context: MovementPlaneTieBreakContext | undefined,
): T[] {
  if (!context || candidates.length < 2) return [...candidates];
  const referencePlane = context.referenceIdentity
    ? movementPlaneMetadataFor(context.referenceIdentity)?.primaryPlane
    : undefined;
  if (referencePlane) {
    const samePrimary = candidates.filter((candidate) =>
      movementPlaneMetadataFor(candidate)?.primaryPlane === referencePlane);
    if (samePrimary.length > 0) return samePrimary;
  }
  for (const plane of context.missingUsefulPlanes ?? []) {
    const fillsHole = candidates.filter((candidate) => {
      const metadata = movementPlaneMetadataFor(candidate);
      if (!metadata) return false;
      // Sam explicitly allows a secondary transverse demand to fill the gym
      // strength hole. A primary multiplanar exercise fills the same hole.
      if (plane === 'transverse') {
        return metadata.primaryPlane === 'transverse'
          || metadata.primaryPlane === 'multiplanar'
          || metadata.secondaryPlanes.includes('transverse');
      }
      return metadata.primaryPlane === plane;
    });
    if (fillsHole.length > 0) return fillsHole;
  }
  return [...candidates];
}

export type MovementPlaneExerciseContribution =
  | 'strength'
  | 'prehab'
  | 'power'
  | 'trunk'
  | 'mobility'
  | 'stretch'
  | 'tissue'
  | 'breathing';

export type TypedAthleticPlaneExposure =
  | 'rotational_med_ball'
  | 'cod_decel'
  | 'cutting'
  | 'curved_running'
  | 'angled_deceleration'
  | 'team_training'
  | 'straight_line_acceleration';

export type AthleticTransverseSafetyConstraint =
  | 'injury'
  | 'illness'
  | 'travel'
  | 'deload'
  | 'game_proximity'
  | 'low_readiness'
  | 'running_restricted';

export interface AthleticTransverseExposureRuleInput {
  readonly phase: ContractPhase;
  readonly offseasonBlock: OffseasonBlock | null;
  readonly phaseWeekNumber: number | null;
  readonly christmasBreakWeekNumber: number | null;
  /** True only after the audit has a complete current-plus-previous-week window. */
  readonly rollingWindowComplete: boolean;
  /** Typed credits inside that same rolling window. */
  readonly athleticExposures: readonly TypedAthleticPlaneExposure[];
  /** Existing safety owners translate their decisions into these typed reasons. */
  readonly safetyConstraints: readonly AthleticTransverseSafetyConstraint[];
}

export interface AthleticTransverseExposureRuleResult {
  readonly rollingWindowDays: 14;
  readonly targetActive: boolean;
  readonly qualifyingExposurePresent: boolean;
  readonly missingRequiredExposure: boolean;
  readonly automaticCodDue: boolean;
}

export interface MovementPlaneAuditInput {
  readonly exerciseRows: readonly {
    readonly identity: string;
    readonly contribution: MovementPlaneExerciseContribution;
  }[];
  readonly athleticExposures: readonly TypedAthleticPlaneExposure[];
  readonly athleticTransverseRuleContext: Omit<
    AthleticTransverseExposureRuleInput,
    'athleticExposures'
  >;
  /** Null means the 7–14 day history was not available to this audit. */
  readonly daysSinceLastTrunkTransverse: number | null;
}

export type MovementPlaneCoverageFinding =
  | { readonly kind: 'missing_lower_body_frontal'; readonly severity: 'required' }
  | { readonly kind: 'missing_gym_transverse_or_multiplanar'; readonly severity: 'required' }
  | { readonly kind: 'missing_athletic_transverse'; readonly severity: 'required' }
  | { readonly kind: 'trunk_transverse_due'; readonly severity: 'soft' }
  | { readonly kind: 'trunk_transverse_history_unknown'; readonly severity: 'soft' };

const LOWER_BODY_POOLS = new Set([
  'Lower squat', 'Lower hinge', 'Lower plyometric', 'Accessories lower',
  'Groin / adductors', 'Calves', 'Lower prehab', 'Power',
]);
const MEANINGFUL_LOWER_CONTRIBUTIONS = new Set<MovementPlaneExerciseContribution>([
  'strength', 'prehab', 'power',
]);
const MEANINGFUL_GYM_CONTRIBUTIONS = new Set<MovementPlaneExerciseContribution>([
  'strength', 'prehab', 'power', 'trunk',
]);
const TRUNK_TRANSVERSE_IDENTITIES = new Set([
  'Band Pallof Press', 'Woodchop (Standing)', 'Woodchop (Half Kneeling)',
  'Side Plank Row',
]);
const ATHLETIC_TRANSVERSE_EXPOSURES = new Set<TypedAthleticPlaneExposure>([
  'rotational_med_ball', 'cod_decel', 'cutting', 'curved_running',
  'angled_deceleration', 'team_training',
]);

/** Exact typed conditioning credit for the athletic-plane audit; no template name is read. */
export function athleticPlaneExposureForConditioningQuality(
  quality: ConditioningQuality,
): TypedAthleticPlaneExposure | undefined {
  return quality === 'cod_decel' ? 'cod_decel' : undefined;
}

export function qualifiesAthleticTransverseExposure(
  exposure: TypedAthleticPlaneExposure,
): boolean {
  return ATHLETIC_TRANSVERSE_EXPOSURES.has(exposure);
}

/**
 * One typed rule shared by generation and audit.
 *
 * Generation reads `automaticCodDue`; audit reads `missingRequiredExposure`.
 * The first late-off-season week places the small dose early in the new window,
 * while the audit does not call a partial window missing. No identity/display
 * string is interpreted here.
 */
export function athleticTransverseExposureRule(
  input: AthleticTransverseExposureRuleInput,
): AthleticTransverseExposureRuleResult {
  const phaseWeek = input.phaseWeekNumber ?? 0;
  const targetActive = input.phase === 'Off-season' ? phaseWeek >= 5 : phaseWeek > 0;
  const qualifyingExposurePresent = input.athleticExposures.some(
    qualifiesAthleticTransverseExposure,
  );
  const safetyClear = input.safetyConstraints.length === 0;
  const missingRequiredExposure = targetActive
    && input.rollingWindowComplete
    && safetyClear
    && !qualifyingExposurePresent;
  const offSeasonDoseWeek = input.phase === 'Off-season'
    && input.offseasonBlock === 'normal_build'
    && phaseWeek >= 5
    && (phaseWeek - 5) % 2 === 0;
  const christmasWeek = input.christmasBreakWeekNumber ?? 0;
  const christmasDoseWeek = input.phase === 'Pre-season'
    && christmasWeek >= 1
    && (christmasWeek - 1) % 2 === 0;
  return {
    rollingWindowDays: 14,
    targetActive,
    qualifyingExposurePresent,
    missingRequiredExposure,
    automaticCodDue: targetActive
      && safetyClear
      && !qualifyingExposurePresent
      && (offSeasonDoseWeek || christmasDoseWeek),
  };
}

export function exerciseSuppliesLowerBodyFrontal(
  identity: string,
  contribution: MovementPlaneExerciseContribution,
): boolean {
  const metadata = movementPlaneMetadataFor(identity);
  const muscle = muscleMetadataFor(identity);
  return metadata?.primaryPlane === 'frontal'
    && MEANINGFUL_LOWER_CONTRIBUTIONS.has(contribution)
    && Boolean(muscle && LOWER_BODY_POOLS.has(muscle.pool));
}

export function exerciseSuppliesTrunkTransverse(identity: string): boolean {
  return TRUNK_TRANSVERSE_IDENTITIES.has(identity);
}

export function exerciseSuppliesGymTransverseOrMultiplanar(
  identity: string,
  contribution: MovementPlaneExerciseContribution,
): boolean {
  if (!MEANINGFUL_GYM_CONTRIBUTIONS.has(contribution)) return false;
  const metadata = movementPlaneMetadataFor(identity);
  return metadata?.primaryPlane === 'transverse'
    || metadata?.primaryPlane === 'multiplanar'
    || metadata?.secondaryPlanes.includes('transverse') === true;
}

export interface MovementPlaneCoverageAudit {
  readonly lowerBodyFrontalPresent: boolean;
  readonly gymTransverseOrMultiplanarPresent: boolean;
  readonly athleticTransversePresent: boolean;
  readonly trunkTransversePresent: boolean;
  readonly findings: readonly MovementPlaneCoverageFinding[];
}

export function auditMovementPlaneCoverage(
  input: MovementPlaneAuditInput,
): MovementPlaneCoverageAudit {
  const lowerBodyFrontalPresent = input.exerciseRows.some((row) =>
    exerciseSuppliesLowerBodyFrontal(row.identity, row.contribution));
  const gymTransverseOrMultiplanarPresent = input.exerciseRows.some((row) =>
    exerciseSuppliesGymTransverseOrMultiplanar(row.identity, row.contribution))
    || input.athleticExposures.includes('rotational_med_ball');
  const athleticRule = athleticTransverseExposureRule({
    ...input.athleticTransverseRuleContext,
    athleticExposures: input.athleticExposures,
  });
  const athleticTransversePresent = athleticRule.qualifyingExposurePresent;
  const trunkTransversePresent = input.exerciseRows.some((row) =>
    exerciseSuppliesTrunkTransverse(row.identity));
  const findings: MovementPlaneCoverageFinding[] = [];
  if (!lowerBodyFrontalPresent) {
    findings.push({ kind: 'missing_lower_body_frontal', severity: 'required' });
  }
  if (!gymTransverseOrMultiplanarPresent) {
    findings.push({ kind: 'missing_gym_transverse_or_multiplanar', severity: 'required' });
  }
  if (athleticRule.missingRequiredExposure) {
    findings.push({ kind: 'missing_athletic_transverse', severity: 'required' });
  }
  if (!trunkTransversePresent) {
    if (input.daysSinceLastTrunkTransverse === null) {
      findings.push({ kind: 'trunk_transverse_history_unknown', severity: 'soft' });
    } else if (input.daysSinceLastTrunkTransverse >= 14) {
      findings.push({ kind: 'trunk_transverse_due', severity: 'soft' });
    }
  }
  return {
    lowerBodyFrontalPresent,
    gymTransverseOrMultiplanarPresent,
    athleticTransversePresent,
    trunkTransversePresent,
    findings,
  };
}
