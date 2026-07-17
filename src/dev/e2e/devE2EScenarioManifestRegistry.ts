import { DEV_E2E_SEED_IDS } from './devE2ESeedIds';
import {
  DEV_E2E_SCENARIO_PROTOCOL_VERSION,
  validateDevE2EScenarioManifest,
  type DevE2EScenarioManifest,
} from './devE2EScenarioProtocol';
import {
  EXPLORER_NON_COACH_SMOKE_MANIFESTS,
} from './explorerSmokeScenarioManifests';

const DIAGNOSTIC_ACTION_TYPE: Readonly<Record<string, string>> = {
  'fixture.add': 'game_day_change',
  'fixture.move': 'game_day_change',
  'fixture.remove': 'game_day_change',
  'session.move': 'move_session',
  'session.delete': 'delete_session',
  'component.delete': 'delete_component',
  'injury.set': 'injury_change',
  'injury.resolve': 'injury_change',
  'readiness.set': 'readiness_change',
  'readiness.clear': 'readiness_change',
  'equipment.set': 'equipment_change',
  'equipment.clear': 'equipment_change',
  'session-feedback.record': 'session_feedback',
  'adjustment.restore': 'clear_adjustment',
  'week.repeat': 'repeat_week',
};

/** Exact Explorer smoke manifests projected into the scenario-session V2 protocol. */
export const EXPLORER_DEV_E2E_SCENARIO_MANIFESTS: readonly DevE2EScenarioManifest[] =
  EXPLORER_NON_COACH_SMOKE_MANIFESTS.map((manifest) =>
    validateDevE2EScenarioManifest({
      protocolVersion: DEV_E2E_SCENARIO_PROTOCOL_VERSION,
      scenarioId: manifest.scenarioId,
      seedId: manifest.seedId,
      steps: manifest.steps.map((step) => ({
        stepId: step.stepId,
        action: {
          actionType: DIAGNOSTIC_ACTION_TYPE[step.action.type],
          sources: ['tap'],
          controlId: step.controlTestId,
          sourceSurface: `explorer_production_binding:${step.action.type}`,
        },
        eligibilityWitnessIds: step.preconditions.map((predicate) =>
          `eligibility:${predicate.type}:${predicate.predicateId}`),
      })),
    }));

/**
 * Protocol-only manifests preserve every existing seed as a valid one-step
 * scenario. Explorer-owned multi-step manifests can extend this registry
 * without changing the session coordinator or seed families.
 */
export const DEV_E2E_SCENARIO_MANIFESTS: readonly DevE2EScenarioManifest[] =
  [...DEV_E2E_SEED_IDS.map((seedId) => validateDevE2EScenarioManifest({
    protocolVersion: DEV_E2E_SCENARIO_PROTOCOL_VERSION,
    scenarioId: seedId,
    seedId,
    steps: [{
      stepId: seedId,
      eligibilityWitnessIds: [`manifest:${seedId}:${seedId}`],
    }],
  })), ...EXPLORER_DEV_E2E_SCENARIO_MANIFESTS];

export function resolveDevE2EScenarioManifest(
  scenarioId: string,
): DevE2EScenarioManifest | null {
  return DEV_E2E_SCENARIO_MANIFESTS.find((manifest) =>
    manifest.scenarioId === scenarioId) ?? null;
}
