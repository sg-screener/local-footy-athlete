import assert from 'node:assert/strict';
import { classifyZeroPlacement } from '../rules/catalogueReachabilityClassification';

const cases = [
  [{ candidateDecisions: 3, eligibleDecisions: 0, selectedDecisions: 0 }, 'automatic_strength_or_power', 'not_eligible_for_audited_athletes'],
  [{ candidateDecisions: 3, eligibleDecisions: 2, selectedDecisions: 0 }, 'automatic_strength_or_power', 'eligible_but_out_ranked'],
  [{ candidateDecisions: 3, eligibleDecisions: 2, selectedDecisions: 1 }, 'automatic_strength_or_power', 'incorrectly_tagged_or_classified'],
  [{ candidateDecisions: 3, eligibleDecisions: 2, selectedDecisions: 0, attemptSelectedDecisions: 1 }, 'automatic_strength_or_power', 'selected_only_in_nonfinal_compilation'],
  [{ candidateDecisions: 0, eligibleDecisions: 0, selectedDecisions: 0 }, 'automatic_mobility_top_up', 'not_eligible_for_audited_athletes'],
  [{ candidateDecisions: 0, eligibleDecisions: 0, selectedDecisions: 0 }, 'retired_or_legacy_manual_conditioning', 'intentionally_manual_or_special_use_only'],
] as const;

for (const [trace, route, expected] of cases) {
  assert.equal(classifyZeroPlacement(trace, route).classification, expected);
}
console.log(`catalogue reachability classification: ${cases.length} passed`);
