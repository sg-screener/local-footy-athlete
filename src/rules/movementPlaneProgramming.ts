/** Pure movement-plane tie-breaking and coverage auditing. No writes or UI. */

import {
  movementPlaneMetadataFor,
  type MovementPlane,
} from '../data/exerciseMovementPlaneMetadata';
import { muscleMetadataFor } from '../data/muscleExperienceMetadata';

export interface MovementPlaneTieBreakContext {
  /** The automatic identity being replaced on this date, when there is one. */
  readonly referenceIdentity?: string;
  /** Useful primary planes the already-filtered week has not supplied yet. */
  readonly missingUsefulPrimaryPlanes?: readonly MovementPlane[];
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
  for (const plane of context.missingUsefulPrimaryPlanes ?? []) {
    const fillsHole = candidates.filter((candidate) =>
      movementPlaneMetadataFor(candidate)?.primaryPlane === plane);
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

export interface MovementPlaneAuditInput {
  readonly exerciseRows: readonly {
    readonly identity: string;
    readonly contribution: MovementPlaneExerciseContribution;
  }[];
  readonly athleticExposures: readonly TypedAthleticPlaneExposure[];
  /** Null means the 7–14 day history was not available to this audit. */
  readonly daysSinceLastTrunkTransverse: number | null;
}

export type MovementPlaneCoverageFinding =
  | { readonly kind: 'missing_lower_body_frontal'; readonly severity: 'required' }
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
const TRUNK_TRANSVERSE_IDENTITIES = new Set([
  'Band Pallof Press', 'Woodchop (Standing)', 'Woodchop (Half Kneeling)',
  'Side Plank Row',
]);
const ATHLETIC_TRANSVERSE_EXPOSURES = new Set<TypedAthleticPlaneExposure>([
  'rotational_med_ball', 'cod_decel', 'cutting', 'curved_running',
  'angled_deceleration', 'team_training',
]);

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

export interface MovementPlaneCoverageAudit {
  readonly lowerBodyFrontalPresent: boolean;
  readonly athleticTransversePresent: boolean;
  readonly trunkTransversePresent: boolean;
  readonly findings: readonly MovementPlaneCoverageFinding[];
}

export function auditMovementPlaneCoverage(
  input: MovementPlaneAuditInput,
): MovementPlaneCoverageAudit {
  const lowerBodyFrontalPresent = input.exerciseRows.some((row) =>
    exerciseSuppliesLowerBodyFrontal(row.identity, row.contribution));
  const athleticTransversePresent = input.athleticExposures.some((exposure) =>
    ATHLETIC_TRANSVERSE_EXPOSURES.has(exposure));
  const trunkTransversePresent = input.exerciseRows.some((row) =>
    exerciseSuppliesTrunkTransverse(row.identity));
  const findings: MovementPlaneCoverageFinding[] = [];
  if (!lowerBodyFrontalPresent) {
    findings.push({ kind: 'missing_lower_body_frontal', severity: 'required' });
  }
  if (!athleticTransversePresent) {
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
    athleticTransversePresent,
    trunkTransversePresent,
    findings,
  };
}
