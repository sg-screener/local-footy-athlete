import { semanticFingerprintV2, type SemanticFingerprintV2 } from '../../utils/semanticFingerprintV2';
import type {
  ExplorerActionType,
  ExplorerIngressSurface,
} from './explorerScenarioContracts';

export const EXPLORER_FAILURE_CLUSTER_SIGNATURE_VERSION = 1 as const;
export const EXPLORER_FAILURE_CLUSTER_SIGNATURE_CONTRACT =
  'explorer-failure-cluster-signature-v1' as const;

export interface ExplorerFailureClusterComponents {
  readonly oracleId: string;
  readonly primaryFailureCode: string;
  readonly actionKind: ExplorerActionType;
  readonly productionSurface: ExplorerIngressSurface;
  readonly firstDivergentProjection: string;
  readonly firstFailingStepId: string;
}

export interface ExplorerFailureClusterSignature {
  readonly version: typeof EXPLORER_FAILURE_CLUSTER_SIGNATURE_VERSION;
  readonly contract: typeof EXPLORER_FAILURE_CLUSTER_SIGNATURE_CONTRACT;
  readonly components: ExplorerFailureClusterComponents;
  readonly semanticHash: SemanticFingerprintV2;
}

function nonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new Error(`Explorer failure cluster ${field} must be non-empty.`);
  }
}

/** Reply wording is intentionally absent from this typed semantic projection. */
export function buildExplorerFailureClusterSignature(
  components: ExplorerFailureClusterComponents,
): ExplorerFailureClusterSignature {
  nonEmpty(components.oracleId, 'oracleId');
  nonEmpty(components.primaryFailureCode, 'primaryFailureCode');
  nonEmpty(components.actionKind, 'actionKind');
  nonEmpty(components.productionSurface, 'productionSurface');
  nonEmpty(components.firstDivergentProjection, 'firstDivergentProjection');
  nonEmpty(components.firstFailingStepId, 'firstFailingStepId');

  const canonicalComponents: ExplorerFailureClusterComponents = {
    oracleId: components.oracleId,
    primaryFailureCode: components.primaryFailureCode,
    actionKind: components.actionKind,
    productionSurface: components.productionSurface,
    firstDivergentProjection: components.firstDivergentProjection,
    firstFailingStepId: components.firstFailingStepId,
  };
  return {
    version: EXPLORER_FAILURE_CLUSTER_SIGNATURE_VERSION,
    contract: EXPLORER_FAILURE_CLUSTER_SIGNATURE_CONTRACT,
    components: canonicalComponents,
    semanticHash: semanticFingerprintV2({
      contract: EXPLORER_FAILURE_CLUSTER_SIGNATURE_CONTRACT,
      components: canonicalComponents,
    }),
  };
}

export function sameExplorerFailureClusterSignature(
  left: ExplorerFailureClusterSignature,
  right: ExplorerFailureClusterSignature,
): boolean {
  return left.contract === EXPLORER_FAILURE_CLUSTER_SIGNATURE_CONTRACT &&
    right.contract === EXPLORER_FAILURE_CLUSTER_SIGNATURE_CONTRACT &&
    left.semanticHash === right.semanticHash;
}
