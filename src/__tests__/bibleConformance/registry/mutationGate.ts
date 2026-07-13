import { runMutationAcceptanceTest } from '../mutationAcceptanceTests';
import { runComponentMutationAcceptanceTests } from '../componentMutationAcceptanceTests';
import { runSlice3MutationAcceptanceTests } from '../slice3MutationAcceptanceTests';
import { runSlice4MutationAcceptanceTests } from '../slice4MutationAcceptanceTests';
import { runConditioningIdentityMutationAcceptanceTests } from '../conditioningIdentityMutationAcceptanceTests';
import { runPreseasonExposureMutationAcceptanceTests } from '../preseasonExposureMutationAcceptanceTests';
import { SMOKE_MUTATIONS, verifyMutationCatalogue } from './mutationCatalogue';
import type { MutationGateResult } from '../types';

/** Registry-driven dispatcher for all accepted isolated mutation probes. */
export function runSmokeMutationGate(): MutationGateResult[] {
  verifyMutationCatalogue();
  const composite = runMutationAcceptanceTest();
  const results: MutationGateResult[] = [{
    id: 'composite_lower_single_winner',
    active: composite.mutationActive, killed: composite.killed, restored: composite.restored,
    invariantId: 'INV_HEALTHY_BLOCK_PATTERN_BALANCE',
    firstStage: composite.firstDivergenceStage ?? 'allocation', report: composite.report,
  }];
  results.push(...runComponentMutationAcceptanceTests().map((entry) => ({
    id: entry.mutationId, active: entry.mutationActive, killed: entry.killed, restored: entry.restored,
    invariantId: entry.invariantId, firstStage: entry.firstDivergenceStage ?? 'generated_fallback', report: entry.report,
  })));
  results.push(...runSlice3MutationAcceptanceTests().map((entry) => ({
    id: entry.mutationId, active: entry.mutationActive, killed: entry.killed, restored: entry.restored,
    invariantId: entry.invariantId, firstStage: entry.firstDivergenceStage, report: entry.report,
  })));
  results.push(...runSlice4MutationAcceptanceTests().map((entry) => ({
    id: entry.mutationId, active: entry.mutationActive, killed: entry.killed, restored: entry.restored,
    invariantId: entry.invariantId, firstStage: entry.firstDivergenceStage, report: entry.report,
  })));
  results.push(...runConditioningIdentityMutationAcceptanceTests());
  results.push(...runPreseasonExposureMutationAcceptanceTests());
  const expected = SMOKE_MUTATIONS.map((entry) => entry.id).sort();
  const actual = results.map((entry) => entry.id).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Smoke mutation gate differs from catalogue: expected ${expected.join(', ')}, actual ${actual.join(', ')}`);
  }
  if (results.some((entry) => !entry.active || !entry.killed || !entry.restored)) {
    throw new Error('Smoke mutation gate contains an incomplete proof');
  }
  return results;
}
