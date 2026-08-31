/** Exhaustive, typed result for one catalogue row with zero lived placement. */
export type ZeroPlacementClassification =
  | 'not_eligible_for_audited_athletes'
  | 'eligible_but_out_ranked'
  | 'missing_automatic_programming_route'
  | 'incorrectly_tagged_or_classified'
  | 'intentionally_manual_or_special_use_only';

export interface ZeroPlacementTraceSummary {
  /** Distinct athlete + compiler decision ids in which this candidate appeared. */
  readonly candidateDecisions: number;
  readonly eligibleDecisions: number;
  readonly selectedDecisions: number;
}

export type ZeroPlacementRouteEvidence =
  | 'automatic_strength_or_power'
  | 'automatic_conditioning_template'
  | 'automatic_mobility_top_up'
  | 'mobility_pool_without_compiler_route'
  | 'retired_or_legacy_manual_conditioning'
  | 'explicit_pending_power_placement'
  | 'special_session_identity'
  | 'no_route';

export interface ZeroPlacementClassificationResult {
  readonly classification: ZeroPlacementClassification;
  readonly reason: string;
}

/**
 * Classifies from compiler evidence first, catalogue intent second. A selected
 * compiler identity that the completed final-program audit counted as zero is
 * not called "out-ranked": it is a downstream identity/survival mismatch.
 */
export function classifyZeroPlacement(
  trace: ZeroPlacementTraceSummary,
  route: ZeroPlacementRouteEvidence,
): ZeroPlacementClassificationResult {
  if (trace.selectedDecisions > 0) {
    return {
      classification: 'incorrectly_tagged_or_classified',
      reason: 'The compiler selected this identity, but the final-program audit counted zero placements; selection and final identity/survival disagree.',
    };
  }
  if (trace.eligibleDecisions > 0) {
    return {
      classification: 'eligible_but_out_ranked',
      reason: 'The candidate was eligible in at least one distinct compiler decision but was never selected.',
    };
  }
  if (trace.candidateDecisions > 0) {
    return {
      classification: 'not_eligible_for_audited_athletes',
      reason: 'The automatic route considered the candidate, but it was ineligible in every audited compiler decision.',
    };
  }
  if (route === 'automatic_mobility_top_up') {
    return {
      classification: 'not_eligible_for_audited_athletes',
      reason: 'A canonical automatic Mobility route exists, but the audited athlete-weeks opened no eligible decision seat for this identity.',
    };
  }
  if (route === 'retired_or_legacy_manual_conditioning'
      || route === 'explicit_pending_power_placement'
      || route === 'special_session_identity') {
    return {
      classification: 'intentionally_manual_or_special_use_only',
      reason: 'Catalogue metadata retains the identity for manual, fallback, injury, saved-session or special-session use; no automatic compiler route owns it.',
    };
  }
  return {
    classification: 'missing_automatic_programming_route',
    reason: route === 'mobility_pool_without_compiler_route'
      ? 'The identity is advertised by the mobility pool, but no canonical compiler decision considers it.'
      : 'The catalogue identity has neither compiler candidate evidence nor an explicit manual/special-only classification.',
  };
}
