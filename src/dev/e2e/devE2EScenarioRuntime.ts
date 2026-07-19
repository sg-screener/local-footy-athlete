import {
  devE2EScenarioStep,
  DEV_E2E_SCENARIO_REASON,
  DevE2EScenarioProtocolError,
  type DevE2EScenarioManifest,
} from './devE2EScenarioProtocol';
import type { DevE2EScenarioSessionRecord } from './devE2EScenarioSession';
import {
  clearDevE2EScenarioActionBridge,
  installDevE2EScenarioActionBridge,
} from '../../utils/devE2EScenarioActionBridge';
import {
  hasDevE2EMarker,
  setDevE2EScenarioActionActive,
  setDevE2EScenarioError,
} from './devE2EState';
import { useProgramStore } from '../../store/programStore';
import { explorerLiveActionIngressGate } from './explorerActionIngress';

declare const __DEV__: boolean | undefined;

interface ActiveScenarioRuntime {
  manifest: DevE2EScenarioManifest;
  session: DevE2EScenarioSessionRecord;
  claimedStepId: string | null;
}

export interface DevE2EScenarioActionInput {
  source: 'tap' | 'coach' | 'system';
  actionType: string;
  controlId?: string;
  sourceSurface?: string;
  canonicalTargetIds?: readonly string[];
}

export interface DevE2EScenarioActionClaim {
  scenarioId: string;
  seedId: string;
  scenarioStepId: string;
  priorActionTraceId: string | null;
  explorerActionIngressClaimId?: string;
}

let active: ActiveScenarioRuntime | null = null;

function isAvailable(): boolean {
  if (typeof __DEV__ !== 'undefined') return __DEV__;
  return (globalThis as { __DEV__?: boolean }).__DEV__ === true;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fail(reasonCode: string, message: string): never {
  const error = new DevE2EScenarioProtocolError(reasonCode, message);
  setDevE2EScenarioError(reasonCode, error);
  throw error;
}

export function activateDevE2EScenarioRuntime(
  session: DevE2EScenarioSessionRecord,
  manifest: DevE2EScenarioManifest,
): boolean {
  if (!isAvailable()) {
    active = null;
    clearDevE2EScenarioActionBridge();
    return false;
  }
  active = {
    session: clone(session),
    manifest,
    claimedStepId: session.activeActionTraceId
      ? session.nextActionEligibility.nextStepId
      : null,
  };
  installDevE2EScenarioActionBridge({
    claim: claimDevE2EScenarioAction,
    registerTrace: registerDevE2EScenarioActionTrace,
  });
  return true;
}

export function clearDevE2EScenarioRuntime(): void {
  active = null;
  clearDevE2EScenarioActionBridge();
}

export function readActiveDevE2EScenarioSession(): DevE2EScenarioSessionRecord | null {
  return active ? clone(active.session) : null;
}

export function claimDevE2EScenarioAction(
  input: DevE2EScenarioActionInput,
): DevE2EScenarioActionClaim | null {
  if (!isAvailable() || !active || input.actionType === 'hydration') return null;
  if (input.source === 'system' &&
    devE2EScenarioStep(
      active.manifest,
      active.session.nextActionEligibility.nextStepId ?? '',
    )?.action?.sources?.includes('system') !== true) {
    return null;
  }
  const eligibility = active.session.nextActionEligibility;
  if (active.claimedStepId || active.session.activeActionTraceId ||
    eligibility.status !== 'eligible' || !eligibility.nextStepId) {
    fail(
      DEV_E2E_SCENARIO_REASON.NEXT_ACTION_BLOCKED,
      `Dev E2E scenario next action is blocked: ${eligibility.reasonCode}.`,
    );
  }
  const marker = `e2e-next-action-eligible-${active.session.scenarioId}-${eligibility.nextStepId}`;
  if (!hasDevE2EMarker(marker)) {
    fail(
      DEV_E2E_SCENARIO_REASON.ELIGIBILITY_MARKER_MISSING,
      `Dev E2E scenario eligibility marker is missing: ${marker}.`,
    );
  }
  const step = devE2EScenarioStep(active.manifest, eligibility.nextStepId);
  if (!step) {
    fail(
      DEV_E2E_SCENARIO_REASON.CORRUPT_SESSION,
      `Dev E2E scenario next step is absent from the manifest: ${eligibility.nextStepId}.`,
    );
  }
  const matcher = step.action;
  const matches = !matcher ||
    (matcher.actionType === undefined || matcher.actionType === input.actionType) &&
    (matcher.sources === undefined || matcher.sources.includes(input.source)) &&
    (matcher.controlId === undefined || matcher.controlId === input.controlId) &&
    (matcher.sourceSurface === undefined || matcher.sourceSurface === input.sourceSurface);
  if (!matches) {
    fail(
      DEV_E2E_SCENARIO_REASON.NEXT_ACTION_MISMATCH,
      `Dev E2E scenario action does not match step ${step.stepId}.`,
    );
  }
  const ingressRequest = explorerLiveActionIngressGate().readActiveRequest();
  let explorerActionIngressClaimId: string | undefined;
  if (ingressRequest && ingressRequest.scenarioId === active.session.scenarioId &&
    ingressRequest.stepId === step.stepId) {
    const ingressClaim = explorerLiveActionIngressGate().claimAndStart({
      campaignId: ingressRequest.campaignId,
      scenarioId: active.session.scenarioId,
      stepId: step.stepId,
      actionSemanticHash: ingressRequest.actionSemanticHash,
      controlId: input.controlId ?? '',
      canonicalTargetIds: input.canonicalTargetIds ?? [],
      acceptedRevision:
        useProgramStore.getState().acceptedMaterialContext.revision,
    }, () => undefined);
    explorerActionIngressClaimId = ingressClaim.claimId;
  }
  active.claimedStepId = step.stepId;
  return {
    scenarioId: active.session.scenarioId,
    seedId: active.session.seedId,
    scenarioStepId: step.stepId,
    priorActionTraceId: active.session.priorActionTraceId,
    ...(explorerActionIngressClaimId ? { explorerActionIngressClaimId } : {}),
  };
}

export function registerDevE2EScenarioActionTrace(
  claim: DevE2EScenarioActionClaim,
  traceId: string,
): void {
  if (!active ||
    active.session.scenarioId !== claim.scenarioId ||
    active.claimedStepId !== claim.scenarioStepId ||
    active.session.activeActionTraceId) {
    fail(
      DEV_E2E_SCENARIO_REASON.TRACE_CORRELATION_MISMATCH,
      'Dev E2E scenario action trace registration is out of sequence.',
    );
  }
  active.session.activeActionTraceId = traceId;
  if (claim.explorerActionIngressClaimId) {
    explorerLiveActionIngressGate().registerTrace(
      claim.explorerActionIngressClaimId,
      traceId,
    );
  }
  setDevE2EScenarioActionActive(active.session.scenarioId, claim.scenarioStepId);
}

export function __resetDevE2EScenarioRuntimeForTest(): void {
  active = null;
  clearDevE2EScenarioActionBridge();
}
