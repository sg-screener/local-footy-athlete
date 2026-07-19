export interface DevE2EScenarioActionBridgeInput {
  source: 'tap' | 'coach' | 'system';
  actionType: string;
  controlId?: string;
  sourceSurface?: string;
  canonicalTargetIds?: readonly string[];
}

export interface DevE2EScenarioActionBridgeClaim {
  scenarioId: string;
  seedId: string;
  scenarioStepId: string;
  priorActionTraceId: string | null;
  explorerActionIngressClaimId?: string;
}

interface DevE2EScenarioActionBridge {
  claim: (
    input: DevE2EScenarioActionBridgeInput,
  ) => DevE2EScenarioActionBridgeClaim | null;
  registerTrace: (
    claim: DevE2EScenarioActionBridgeClaim,
    traceId: string,
  ) => void;
}

let bridge: DevE2EScenarioActionBridge | null = null;

export function installDevE2EScenarioActionBridge(
  value: DevE2EScenarioActionBridge,
): void {
  bridge = value;
}

export function clearDevE2EScenarioActionBridge(): void {
  bridge = null;
}

export function claimRegisteredDevE2EScenarioAction(
  input: DevE2EScenarioActionBridgeInput,
): DevE2EScenarioActionBridgeClaim | null {
  return bridge?.claim(input) ?? null;
}

export function registerClaimedDevE2EScenarioActionTrace(
  claim: DevE2EScenarioActionBridgeClaim,
  traceId: string,
): void {
  bridge?.registerTrace(claim, traceId);
}
