import { isDevE2ESeedId, type DevE2ESeedId } from './devE2ESeedIds';
import {
  isExplorerAppLaunchPurpose,
  type ExplorerAppLaunchPurpose,
} from './explorerAppLaunchContract';

export type DevE2EEntryRoute =
  | { kind: 'reset'; seedId: DevE2ESeedId }
  | { kind: 'checkpoint'; checkpointId: DevE2ESeedId }
  | { kind: 'scenario_reset'; scenarioId: string }
  | { kind: 'scenario_checkpoint'; scenarioId: string; checkpointStepId: string }
  | {
      kind: 'explorer_run';
      scenarioId: string;
      e2eMetroUrl: string | null;
      campaignId: string | null;
      integratedRepositorySha: string | null;
      deterministicClockFingerprint: string | null;
    }
  | {
      kind: 'explorer_campaign';
      e2eMetroUrl: string | null;
      campaignId: string | null;
      integratedRepositorySha: string | null;
      deterministicClockFingerprint: string | null;
    }
  | {
      kind: 'explorer_diagnostic';
      launchPurpose: ExplorerAppLaunchPurpose;
      e2eMetroUrl: string | null;
    }
  | {
      kind: 'explorer_evidence_start';
      campaignId: string;
      integratedRepositorySha: string;
      e2eMetroUrl: string | null;
    }
  | {
      kind: 'explorer_evidence';
      captureId: string;
      receiptFileReference: string;
      receiptSha256: string;
      e2eMetroUrl: string | null;
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
const EXACT_EXPLORER_DIAGNOSTIC_ROUTE =
  /^localfootyathlete:\/\/e2e\/explorer\/diagnostics\/([a-z]+(?:-[a-z]+)*)$/;
const EXACT_EXPLORER_EVIDENCE_START_ROUTE =
  /^localfootyathlete:\/\/e2e\/explorer\/evidence\/start\/(explorer-nine-[a-z0-9]+(?:-[a-z0-9]+)*)\/([a-f0-9]{40})$/;
const EXACT_EXPLORER_EVIDENCE_ROUTE =
  /^localfootyathlete:\/\/e2e\/explorer\/evidence\/(explorer-capture-[a-f0-9]{64})\?receiptFile=([^&#]+)&receiptSha256=([a-f0-9]{64})$/;

export function explorerPhysicalEvidenceCaptureIdFromRoute(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'localfootyathlete:' || parsed.hostname !== 'e2e') {
    return null;
  }
  return /^\/explorer\/evidence\/(explorer-capture-[a-f0-9]{64})$/
    .exec(parsed.pathname)?.[1] ?? null;
}

function splitExplorerBootstrapQuery(url: string): {
  routeUrl: string;
  e2eMetroUrl: string | null;
  campaignId: string | null;
  integratedRepositorySha: string | null;
  deterministicClockFingerprint: string | null;
} | null {
  if (!url.startsWith('localfootyathlete://e2e/explorer/')) {
    return {
      routeUrl: url,
      e2eMetroUrl: null,
      campaignId: null,
      integratedRepositorySha: null,
      deterministicClockFingerprint: null,
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const field = (name: string): string | null | undefined => {
    const values = parsed.searchParams.getAll(name);
    return values.length > 1 ? undefined : values[0] ?? null;
  };
  const e2eMetroUrl = field('e2eMetroUrl');
  const campaignId = field('campaignId');
  const integratedRepositorySha = field('integratedRepositorySha');
  const deterministicClockFingerprint = field('deterministicClockFingerprint');
  if (e2eMetroUrl === undefined || campaignId === undefined ||
    integratedRepositorySha === undefined ||
    deterministicClockFingerprint === undefined) return null;
  for (const name of [
    'e2eMetroUrl',
    'campaignId',
    'integratedRepositorySha',
    'deterministicClockFingerprint',
  ]) {
    parsed.searchParams.delete(name);
  }
  return {
    routeUrl: parsed.toString(),
    e2eMetroUrl,
    campaignId,
    integratedRepositorySha,
    deterministicClockFingerprint,
  };
}

export function parseDevE2EEntryRoute(url: string | null | undefined): DevE2EEntryRoute | null {
  if (!url) return null;
  const explorer = splitExplorerBootstrapQuery(url);
  if (!explorer) return null;
  const routeUrl = explorer.routeUrl;
  const evidenceStart = EXACT_EXPLORER_EVIDENCE_START_ROUTE.exec(routeUrl);
  if (evidenceStart) {
    return {
      kind: 'explorer_evidence_start',
      campaignId: evidenceStart[1],
      integratedRepositorySha: evidenceStart[2],
      e2eMetroUrl: explorer.e2eMetroUrl,
    };
  }
  const evidence = EXACT_EXPLORER_EVIDENCE_ROUTE.exec(routeUrl);
  if (evidence) {
    let receiptFileReference: string;
    try {
      receiptFileReference = decodeURIComponent(evidence[2]);
    } catch {
      return null;
    }
    return {
      kind: 'explorer_evidence',
      captureId: evidence[1],
      receiptFileReference,
      receiptSha256: evidence[3],
      e2eMetroUrl: explorer.e2eMetroUrl,
    };
  }
  const diagnostic = EXACT_EXPLORER_DIAGNOSTIC_ROUTE.exec(routeUrl);
  if (diagnostic && isExplorerAppLaunchPurpose(diagnostic[1])) {
    return {
      kind: 'explorer_diagnostic',
      launchPurpose: diagnostic[1],
      e2eMetroUrl: explorer.e2eMetroUrl,
    };
  }
  if (EXACT_EXPLORER_CAMPAIGN_ROUTE.test(routeUrl)) {
    return {
      kind: 'explorer_campaign',
      e2eMetroUrl: explorer.e2eMetroUrl,
      campaignId: explorer.campaignId,
      integratedRepositorySha: explorer.integratedRepositorySha,
      deterministicClockFingerprint: explorer.deterministicClockFingerprint,
    };
  }
  const explorerRun = EXACT_EXPLORER_RUN_ROUTE.exec(routeUrl);
  if (explorerRun) {
    return {
      kind: 'explorer_run',
      scenarioId: explorerRun[1],
      e2eMetroUrl: explorer.e2eMetroUrl,
      campaignId: explorer.campaignId,
      integratedRepositorySha: explorer.integratedRepositorySha,
      deterministicClockFingerprint: explorer.deterministicClockFingerprint,
    };
  }
  const scenarioReset = EXACT_SCENARIO_RESET_ROUTE.exec(routeUrl);
  if (scenarioReset) {
    return { kind: 'scenario_reset', scenarioId: scenarioReset[1] };
  }
  const scenarioCheckpoint = EXACT_SCENARIO_CHECKPOINT_ROUTE.exec(routeUrl);
  if (scenarioCheckpoint) {
    return {
      kind: 'scenario_checkpoint',
      scenarioId: scenarioCheckpoint[1],
      checkpointStepId: scenarioCheckpoint[2],
    };
  }
  const match = EXACT_E2E_ROUTE.exec(routeUrl);
  if (!match || !isDevE2ESeedId(match[2])) return null;
  return match[1] === 'reset'
    ? { kind: 'reset', seedId: match[2] }
    : { kind: 'checkpoint', checkpointId: match[2] };
}
