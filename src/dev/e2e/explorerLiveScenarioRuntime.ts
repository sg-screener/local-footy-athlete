import type { DevE2ESeedCoordinator } from './DevE2ESeedCoordinator';
import { buildDevE2ESeed } from './devE2ESeedRegistry';
import { captureDevE2EMemoryFingerprints } from './devE2EPersistence';
import { readActiveDevE2EClockReceipt } from './devE2EClockPersistence';
import {
  EXPLORER_SCENARIO_ARTIFACT_FAILURE,
  ExplorerScenarioArtifactValidationError,
} from './explorerScenarioArtifactBundle';
import {
  createExplorerProductionScenarioRunner,
  runAllExplorerSmokeScenarios,
  type ExplorerCampaignResult,
} from './explorerScenarioRunner';
import type {
  ExplorerRuntimeDependencies,
  ExplorerRuntimeResult,
} from './explorerRuntime';
import { semanticFingerprintV2 } from '../../utils/semanticFingerprintV2';
import {
  readExplorerPhysicalEvidenceCampaignIdentity,
  requestExplorerPhysicalEvidence,
} from './explorerPhysicalEvidenceDevBridge';

/** Last dev-only receipt, exposed for deterministic native E2E inspection. */
let lastResult: ExplorerRuntimeResult | ExplorerCampaignResult | null = null;

function unavailable(): never {
  throw new ExplorerScenarioArtifactValidationError(
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.SCREENSHOT_MISSING,
    'live capture receipt has not been installed',
  );
}

function liveHostDependencies(args: {
  coordinator: DevE2ESeedCoordinator;
  scenarioId: string;
}): Omit<ExplorerRuntimeDependencies, 'loadManifest' | 'actionBridge' | 'waitForReactRender'> {
  const campaign = readExplorerPhysicalEvidenceCampaignIdentity();
  if (!campaign) {
    throw new Error('explorer_live_physical_evidence_campaign_missing');
  }
  return {
    physicalEvidence: {
      campaignId: campaign.campaignId,
      integratedRepositorySha: campaign.integratedRepositorySha,
      deterministicClockFingerprint: () => {
        const clock = readActiveDevE2EClockReceipt();
        if (!clock) throw new Error('explorer_live_clock_missing');
        return clock.semanticFingerprint;
      },
      requestCapture: requestExplorerPhysicalEvidence,
    },
    resetSeedOnce: async (seedId) => {
      const reset = await args.coordinator.resetScenario(args.scenarioId);
      if (!reset) throw new Error(`explorer_live_reset_refused:${args.scenarioId}`);
      const seed = buildDevE2ESeed(seedId);
      const fingerprints = captureDevE2EMemoryFingerprints();
      const clock = readActiveDevE2EClockReceipt();
      if (!clock || clock.seedId !== seedId) {
        throw new Error(`explorer_live_clock_missing:${seedId}`);
      }
      return {
        resetId: `explorer-live-reset:${args.scenarioId}`,
        seedId,
        seedEvidence: {
          witnessReport: {
            seedId,
            complete: true,
            witnesses: seed.witnesses.map((witness, index) => ({
              witnessId: `seed:${seedId}:${witness.kind}:${index + 1}`,
              status: 'passed' as const,
              evidenceFingerprint: semanticFingerprintV2(witness),
            })),
          },
          initialAcceptedSemanticFingerprint: semanticFingerprintV2(fingerprints),
          initialPersistedStoreFingerprints: fingerprints,
          // Physical evidence is owned by the native/Maestro harness. Empty
          // references deliberately force incomplete_artifact until supplied.
          initialScreenshotReference: { artifactId: '', contentFingerprint: '' },
          initialAccessibilityHierarchyReference: { artifactId: '', contentFingerprint: '' },
        },
      };
    },
    readEligibilityWitnessState: async () => unavailable(),
    publishEligibilityMarker: () => {},
    claimIntendedAction: () => {},
    captureOracleContext: async () => unavailable(),
    checkpointScenarioStep: async () => unavailable(),
    coldReloadScenarioSessionV2: async () => unavailable(),
    assembleActionEvidence: async () => unavailable(),
    assembleScenarioArtifact: async () => unavailable(),
  };
}

/** Real dev entry caller: it always constructs the production action registry. */
export async function runLiveExplorerScenario(args: {
  coordinator: DevE2ESeedCoordinator;
  scenarioId: string;
}): Promise<ExplorerRuntimeResult> {
  const runner = createExplorerProductionScenarioRunner({
    hostDependencies: liveHostDependencies(args),
  });
  const result = await runner.run(args.scenarioId);
  lastResult = result;
  return result;
}

export async function runLiveExplorerCampaign(
  coordinator: DevE2ESeedCoordinator,
): Promise<ExplorerCampaignResult> {
  const result = await runAllExplorerSmokeScenarios({
    runner: {
      run: (scenarioId) => runLiveExplorerScenario({ coordinator, scenarioId }),
    },
  });
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
