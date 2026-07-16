import { DEV_E2E_SEED_IDS } from './devE2ESeedIds';
import {
  DEV_E2E_SCENARIO_PROTOCOL_VERSION,
  validateDevE2EScenarioManifest,
  type DevE2EScenarioManifest,
} from './devE2EScenarioProtocol';

/**
 * Protocol-only manifests preserve every existing seed as a valid one-step
 * scenario. Explorer-owned multi-step manifests can extend this registry
 * without changing the session coordinator or seed families.
 */
export const DEV_E2E_SCENARIO_MANIFESTS: readonly DevE2EScenarioManifest[] =
  DEV_E2E_SEED_IDS.map((seedId) => validateDevE2EScenarioManifest({
    protocolVersion: DEV_E2E_SCENARIO_PROTOCOL_VERSION,
    scenarioId: seedId,
    seedId,
    steps: [{
      stepId: seedId,
      eligibilityWitnessIds: [`manifest:${seedId}:${seedId}`],
    }],
  }));

export function resolveDevE2EScenarioManifest(
  scenarioId: string,
): DevE2EScenarioManifest | null {
  return DEV_E2E_SCENARIO_MANIFESTS.find((manifest) =>
    manifest.scenarioId === scenarioId) ?? null;
}
