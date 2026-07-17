import { isDevE2ESeedId, type DevE2ESeedId } from './devE2ESeedIds';

export type DevE2EEntryRoute =
  | { kind: 'reset'; seedId: DevE2ESeedId }
  | { kind: 'checkpoint'; checkpointId: DevE2ESeedId }
  | { kind: 'scenario_reset'; scenarioId: string }
  | { kind: 'scenario_checkpoint'; scenarioId: string; checkpointStepId: string }
  | { kind: 'explorer_run'; scenarioId: string }
  | { kind: 'explorer_campaign' }
  | {
      kind: 'explorer_evidence_start';
      campaignId: string;
      integratedRepositorySha: string;
    }
  | {
      kind: 'explorer_evidence';
      captureId: string;
      encodedReceipt: string;
    };

const EXACT_E2E_ROUTE = /^localfootyathlete:\/\/e2e\/(reset|checkpoint)\/([a-z0-9-]+)$/;
const EXACT_SCENARIO_RESET_ROUTE =
  /^localfootyathlete:\/\/e2e\/scenario\/reset\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const EXACT_SCENARIO_CHECKPOINT_ROUTE =
  /^localfootyathlete:\/\/e2e\/scenario\/checkpoint\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const EXACT_EXPLORER_RUN_ROUTE =
  /^localfootyathlete:\/\/e2e\/explorer\/run\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const EXACT_EXPLORER_CAMPAIGN_ROUTE =
  /^localfootyathlete:\/\/e2e\/explorer\/run-all-nine$/;
const EXACT_EXPLORER_EVIDENCE_START_ROUTE =
  /^localfootyathlete:\/\/e2e\/explorer\/evidence\/start\/(explorer-nine-[a-z0-9]+(?:-[a-z0-9]+)*)\/([a-f0-9]{40})$/;
const EXACT_EXPLORER_EVIDENCE_ROUTE =
  /^localfootyathlete:\/\/e2e\/explorer\/evidence\/(explorer-capture-[a-f0-9]{64})\?receipt=([^&#]+)$/;

export function parseDevE2EEntryRoute(url: string | null | undefined): DevE2EEntryRoute | null {
  if (!url) return null;
  const evidenceStart = EXACT_EXPLORER_EVIDENCE_START_ROUTE.exec(url);
  if (evidenceStart) {
    return {
      kind: 'explorer_evidence_start',
      campaignId: evidenceStart[1],
      integratedRepositorySha: evidenceStart[2],
    };
  }
  const evidence = EXACT_EXPLORER_EVIDENCE_ROUTE.exec(url);
  if (evidence) {
    return {
      kind: 'explorer_evidence',
      captureId: evidence[1],
      encodedReceipt: evidence[2],
    };
  }
  if (EXACT_EXPLORER_CAMPAIGN_ROUTE.test(url)) return { kind: 'explorer_campaign' };
  const explorerRun = EXACT_EXPLORER_RUN_ROUTE.exec(url);
  if (explorerRun) return { kind: 'explorer_run', scenarioId: explorerRun[1] };
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
