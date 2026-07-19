import type { DevE2ESeedCoordinator } from './DevE2ESeedCoordinator';
import {
  createExplorerLiveScenarioRunner,
  runAllExplorerSmokeScenarios,
  type ExplorerCampaignResult,
} from './explorerScenarioRunner';
import type {
  ExplorerRuntimeResult,
} from './explorerRuntime';
import {
  completeActiveExplorerCampaign,
  readActiveExplorerCampaignBootstrap,
} from './explorerCampaignBootstrap';
import { createCanonicalExplorerLiveHostDependencies } from
  './explorerCanonicalLiveHost';
import { setDevE2EExplorerArtifactAccepted } from './devE2EState';

declare const __DEV__: boolean | undefined;

/** Last dev-only receipt, exposed for deterministic native E2E inspection. */
let lastResult: ExplorerRuntimeResult | ExplorerCampaignResult | null = null;

function assertLiveHostAvailable(): void {
  const available = typeof __DEV__ !== 'undefined'
    ? __DEV__
    : (globalThis as { __DEV__?: boolean }).__DEV__ === true;
  if (!available) throw new Error('explorer_live_host_release_build_rejected');
}

function liveHostDependencies(args: {
  coordinator: DevE2ESeedCoordinator;
  scenarioId: string;
}) {
  assertLiveHostAvailable();
  const campaign = readActiveExplorerCampaignBootstrap();
  if (!campaign) {
    throw new Error('explorer_live_physical_evidence_campaign_missing');
  }
  return createCanonicalExplorerLiveHostDependencies({
    coordinator: args.coordinator,
    scenarioId: args.scenarioId,
    campaignId: campaign.campaignId,
    integratedRepositorySha: campaign.integratedRepositorySha,
  });
}

/** Real dev entry caller: it can only wait for UI-owned action ingress. */
export async function runLiveExplorerScenario(args: {
  coordinator: DevE2ESeedCoordinator;
  scenarioId: string;
}): Promise<ExplorerRuntimeResult> {
  assertLiveHostAvailable();
  const runner = createExplorerLiveScenarioRunner({
    hostDependencies: liveHostDependencies(args),
  });
  const result = await runner.run(args.scenarioId);
  if (result.status === 'complete' && result.artifactBundle) {
    setDevE2EExplorerArtifactAccepted(args.scenarioId);
  }
  lastResult = result;
  return result;
}

export async function runLiveExplorerCampaign(
  coordinator: DevE2ESeedCoordinator,
): Promise<ExplorerCampaignResult> {
  assertLiveHostAvailable();
  const result = await runAllExplorerSmokeScenarios({
    runner: {
      run: (scenarioId) => runLiveExplorerScenario({ coordinator, scenarioId }),
    },
  });
  if (result.status === 'complete') {
    await completeActiveExplorerCampaign();
  }
  lastResult = result;
  return result;
}

export function readLastLiveExplorerResult():
  ExplorerRuntimeResult | ExplorerCampaignResult | null {
  return lastResult;
}

export function __resetLiveExplorerResultForTest(): void {
  lastResult = null;
}
