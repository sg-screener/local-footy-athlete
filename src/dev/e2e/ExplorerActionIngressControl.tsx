import React from 'react';
import { Pressable, Text } from 'react-native';
import { useProgramStore } from '../../store/programStore';
import {
  ExplorerActionIngressError,
  explorerCanonicalTargetIds,
  explorerLiveActionIngressGate,
} from './explorerActionIngress';
import { createExplorerProductionBindings } from './explorerProductionBindings';
import { resolveExplorerSmokeScenarioManifest } from
  './explorerSmokeScenarioManifests';
import { explorerActionSemanticHash } from
  './explorerScenarioContractValidation';
import { setDevE2EExplorerActionError } from './devE2EState';

const CONTROL_STYLE = {
  position: 'absolute' as const,
  top: 2,
  left: 0,
  width: 2,
  height: 2,
  opacity: 0.01,
  zIndex: 2147483647,
  elevation: 2147483647,
};

/**
 * Development-only semantic control. A real Maestro tap enters here; the live
 * runtime cannot call this handler or receive its production capability.
 */
export function ExplorerActionIngressControl(): React.ReactElement | null {
  const gate = explorerLiveActionIngressGate();
  const request = gate.readActiveRequest();
  const manifest = request
    ? resolveExplorerSmokeScenarioManifest(request.scenarioId)
    : null;
  const step = request
    ? manifest?.steps.find((candidate) => candidate.stepId === request.stepId)
    : undefined;
  let manifestMatches = false;
  if (request && step && step.action.type !== 'coach.message') {
    manifestMatches = step.controlTestId === request.expectedControlId &&
      explorerActionSemanticHash(step.action) === request.actionSemanticHash &&
      JSON.stringify([...explorerCanonicalTargetIds(step.action)].sort()) ===
        JSON.stringify([...request.expectedCanonicalTargetIds].sort());
  }
  React.useEffect(() => {
    if (request && !manifestMatches) {
      setDevE2EExplorerActionError('manifest_action_ingress_mismatch');
    }
  }, [manifestMatches, request?.requestId]);
  if (!request || !step || step.action.type === 'coach.message' ||
    !manifestMatches) return null;

  const onPress = () => {
    const acceptedRevision =
      useProgramStore.getState().acceptedMaterialContext.revision;
    try {
      gate.claimAndStart({
        campaignId: request.campaignId,
        scenarioId: request.scenarioId,
        stepId: request.stepId,
        actionSemanticHash: request.actionSemanticHash,
        controlId: request.expectedControlId,
        canonicalTargetIds: request.expectedCanonicalTargetIds,
        acceptedRevision,
      }, (claim) => {
        // This production capability exists only inside the tapped UI handler.
        const bindings = createExplorerProductionBindings();
        void bindings.actionBridge.execute(step.action, {
          claim: {
            campaignId: claim.campaignId,
            scenarioId: claim.scenarioId,
            stepId: claim.stepId,
            intendedActionSemanticHash: claim.actionSemanticHash,
            expectedAcceptedRevision: claim.acceptedRevision,
            priorActionTraceId: claim.priorActionTraceId,
          },
        }).then(async (receipt) => {
          gate.registerTrace(claim.claimId, receipt.traceV2RootId);
          await gate.registerProductionReceipt(receipt);
        }).catch((error: unknown) => {
          setDevE2EExplorerActionError(
            error instanceof ExplorerActionIngressError
              ? error.reasonCode
              : 'production_action_failed',
          );
        });
      });
    } catch (error) {
      setDevE2EExplorerActionError(
        error instanceof ExplorerActionIngressError
          ? error.reasonCode
          : 'action_claim_failed',
      );
    }
  };

  return (
    <Pressable
      accessible
      collapsable={false}
      onPress={onPress}
      style={CONTROL_STYLE}
      testID={request.expectedControlId}
      accessibilityLabel={request.expectedControlId}
      accessibilityRole="button"
    >
      <Text>{request.expectedControlId}</Text>
    </Pressable>
  );
}
