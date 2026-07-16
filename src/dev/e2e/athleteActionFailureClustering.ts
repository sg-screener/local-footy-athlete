export const ATHLETE_ACTION_FAILURE_CODES = [
  'action_does_nothing',
  'false_success',
  'incorrect_rejection',
  'reload_loss',
  'coach_note_disagreement',
  'failed_restoration',
  'fixture_horizon_corruption',
  'direct_chained_divergence',
  'source_fact_no_programming_effect',
  'poor_coaching_outcome',
  'unclear_result_communication',
  'inconsistent_ui_control',
] as const;

export type AthleteActionFailureCode = typeof ATHLETE_ACTION_FAILURE_CODES[number];

export interface AthleteActionFailureSignalsV2 {
  expectedMaterialChange: boolean;
  acceptedSemanticChanged: boolean;
  reportedSuccess: boolean;
  durableReadbackMatched: boolean;
  rejected: boolean;
  rejectionExpected: boolean;
  postReloadMatched: boolean;
  coachNoteMatchedAcceptedOwnership: boolean;
  restorationRequested: boolean;
  restorationMatchedOwnedBeforeState: boolean;
  fixtureMutation: boolean;
  fixtureHorizonValid: boolean;
  directAndChainedCompared: boolean;
  directAndChainedMatched: boolean;
  sourceFactCreated: boolean;
  programmingEffectExpected: boolean;
  programmingEffectObserved: boolean;
  coachingOutcomeAcceptable: boolean;
  resultCommunicationClear: boolean;
  equivalentControlsCompared: boolean;
  equivalentControlsConsistent: boolean;
}

export interface AthleteActionFailureClusterV2 {
  version: 2;
  primaryCode: AthleteActionFailureCode | null;
  codes: AthleteActionFailureCode[];
  evidence: Partial<Record<AthleteActionFailureCode, string[]>>;
}

const ORDER = new Map<AthleteActionFailureCode, number>(
  ATHLETE_ACTION_FAILURE_CODES.map((code, index) => [code, index]),
);

export function clusterAthleteActionFailure(
  signals: AthleteActionFailureSignalsV2,
): AthleteActionFailureClusterV2 {
  const evidence: Partial<Record<AthleteActionFailureCode, string[]>> = {};
  const add = (code: AthleteActionFailureCode, ...reasons: string[]): void => {
    evidence[code] = reasons;
  };

  if (signals.expectedMaterialChange && !signals.acceptedSemanticChanged) {
    add('action_does_nothing', 'material_change_expected', 'accepted_semantic_fingerprint_unchanged');
  }
  if (signals.reportedSuccess && (!signals.acceptedSemanticChanged || !signals.durableReadbackMatched)) {
    add('false_success', 'success_reported', signals.durableReadbackMatched
      ? 'accepted_state_unchanged'
      : 'durable_readback_not_acknowledged');
  }
  if (signals.rejected && !signals.rejectionExpected) {
    add('incorrect_rejection', 'action_rejected', 'expected_outcome_permitted_action');
  }
  if (!signals.postReloadMatched) {
    add('reload_loss', 'post_reload_fingerprint_mismatch');
  }
  if (!signals.coachNoteMatchedAcceptedOwnership) {
    add('coach_note_disagreement', 'rendered_note_ownership_differs_from_accepted_provenance');
  }
  if (signals.restorationRequested && !signals.restorationMatchedOwnedBeforeState) {
    add('failed_restoration', 'owned_restoration_requested', 'restored_semantic_state_mismatch');
  }
  if (signals.fixtureMutation && !signals.fixtureHorizonValid) {
    add('fixture_horizon_corruption', 'fixture_mutated', 'selected_horizon_invalid_after_mutation');
  }
  if (signals.directAndChainedCompared && !signals.directAndChainedMatched) {
    add('direct_chained_divergence', 'direct_and_chained_actions_compared', 'semantic_outcomes_differ');
  }
  if (signals.sourceFactCreated && signals.programmingEffectExpected && !signals.programmingEffectObserved) {
    add('source_fact_no_programming_effect', 'canonical_source_fact_created', 'expected_programming_effect_missing');
  }
  if (!signals.coachingOutcomeAcceptable) {
    add('poor_coaching_outcome', 'expected_outcome_quality_gate_failed');
  }
  if (!signals.resultCommunicationClear) {
    add('unclear_result_communication', 'actual_rendered_result_failed_communication_contract');
  }
  if (signals.equivalentControlsCompared && !signals.equivalentControlsConsistent) {
    add('inconsistent_ui_control', 'equivalent_controls_compared', 'normalized_actions_or_outcomes_differ');
  }

  const codes = (Object.keys(evidence) as AthleteActionFailureCode[])
    .sort((left, right) => (ORDER.get(left) ?? 0) - (ORDER.get(right) ?? 0));
  return {
    version: 2,
    primaryCode: codes[0] ?? null,
    codes,
    evidence,
  };
}
