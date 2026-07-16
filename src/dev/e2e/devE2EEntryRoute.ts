import { isDevE2ESeedId, type DevE2ESeedId } from './devE2ESeedIds';

export type DevE2EEntryRoute =
  | { kind: 'reset'; seedId: DevE2ESeedId }
  | { kind: 'checkpoint'; checkpointId: DevE2ESeedId }
  | { kind: 'scenario_reset'; scenarioId: string }
  | { kind: 'scenario_checkpoint'; scenarioId: string; checkpointStepId: string };

const EXACT_E2E_ROUTE = /^localfootyathlete:\/\/e2e\/(reset|checkpoint)\/([a-z0-9-]+)$/;
const EXACT_SCENARIO_RESET_ROUTE =
  /^localfootyathlete:\/\/e2e\/scenario\/reset\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const EXACT_SCENARIO_CHECKPOINT_ROUTE =
  /^localfootyathlete:\/\/e2e\/scenario\/checkpoint\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function parseDevE2EEntryRoute(url: string | null | undefined): DevE2EEntryRoute | null {
  if (!url) return null;
  const scenarioReset = EXACT_SCENARIO_RESET_ROUTE.exec(url);
  if (scenarioReset) {
    return { kind: 'scenario_reset', scenarioId: scenarioReset[1] };
  }
  const scenarioCheckpoint = EXACT_SCENARIO_CHECKPOINT_ROUTE.exec(url);
  if (scenarioCheckpoint) {
    return {
      kind: 'scenario_checkpoint',
      scenarioId: scenarioCheckpoint[1],
      checkpointStepId: scenarioCheckpoint[2],
    };
  }
  const match = EXACT_E2E_ROUTE.exec(url);
  if (!match || !isDevE2ESeedId(match[2])) return null;
  return match[1] === 'reset'
    ? { kind: 'reset', seedId: match[2] }
    : { kind: 'checkpoint', checkpointId: match[2] };
}
