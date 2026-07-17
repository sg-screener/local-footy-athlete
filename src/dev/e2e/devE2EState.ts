import type { AcknowledgedExplorerNativeLaunchDiagnosticReceiptV1 } from
  './explorerNativeLaunchDiagnostic';
import {
  explorerBuildShaDiagnosticMarker,
  explorerMetroDiagnosticMarker,
  explorerNativeBridgeDiagnosticMarker,
  explorerRequestedMetroDiagnosticMarker,
  explorerResolvedMetroDiagnosticMarker,
} from './explorerAppLaunchContract';

export type DevE2EPhase =
  | 'entry_ready'
  | 'seed_loading'
  | 'seed_ready'
  | 'seed_error'
  | 'checkpoint_ready'
  | 'reload_ready';

export interface DevE2EStateSnapshot {
  phase: DevE2EPhase;
  seedId: string | null;
  checkpointId: string | null;
  error: string | null;
  scenarioId: string | null;
  scenarioCheckpointStepId: string | null;
  scenarioReloadCount: number | null;
  scenarioNextStepId: string | null;
  scenarioEligibilityStatus: 'eligible' | 'complete' | 'blocked' | null;
  scenarioEligibilityReasonCode: string | null;
  scenarioErrorReasonCode: string | null;
  revision: number;
}

const INITIAL: DevE2EStateSnapshot = Object.freeze({
  phase: 'entry_ready',
  seedId: null,
  checkpointId: null,
  error: null,
  scenarioId: null,
  scenarioCheckpointStepId: null,
  scenarioReloadCount: null,
  scenarioNextStepId: null,
  scenarioEligibilityStatus: null,
  scenarioEligibilityReasonCode: null,
  scenarioErrorReasonCode: null,
  revision: 0,
});

let snapshot: DevE2EStateSnapshot = INITIAL;
const subscribers = new Set<() => void>();
const observedTraceMarkers = new Set<string>();
const explorerCaptureRequestMarkers = new Set<string>();
const explorerCaptureRequestEnvelopes = new Map<string, string>();
const explorerCaptureAcceptedMarkers = new Set<string>();
const explorerCaptureErrorMarkers = new Set<string>();
const explorerArtifactAcceptedMarkers = new Set<string>();
const explorerMetroDiagnosticMarkers = new Set<string>();
const explorerLaunchErrorMarkers = new Set<string>();
const explorerCampaignPendingMarkers = new Set<string>();
const explorerCampaignAcceptedMarkers = new Set<string>();
const explorerCampaignErrorMarkers = new Set<string>();

function notifySubscribers(): void {
  for (const subscriber of Array.from(subscribers)) {
    try {
      subscriber();
    } catch {
      // A diagnostic subscriber must never break the entry coordinator.
    }
  }
}

const CLEARED_SCENARIO_STATE = {
  scenarioId: null,
  scenarioCheckpointStepId: null,
  scenarioReloadCount: null,
  scenarioNextStepId: null,
  scenarioEligibilityStatus: null,
  scenarioEligibilityReasonCode: null,
  scenarioErrorReasonCode: null,
} as const;

function publish(next: Partial<Omit<DevE2EStateSnapshot, 'revision'>>): void {
  snapshot = Object.freeze({
    ...snapshot,
    ...next,
    revision: snapshot.revision + 1,
  });
  notifySubscribers();
}

export function getDevE2EStateSnapshot(): DevE2EStateSnapshot {
  return snapshot;
}

export function subscribeDevE2EState(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function setDevE2EEntryReady(): void {
  observedTraceMarkers.clear();
  explorerCaptureRequestMarkers.clear();
  explorerCaptureRequestEnvelopes.clear();
  explorerCaptureAcceptedMarkers.clear();
  explorerCaptureErrorMarkers.clear();
  explorerArtifactAcceptedMarkers.clear();
  explorerMetroDiagnosticMarkers.clear();
  explorerLaunchErrorMarkers.clear();
  explorerCampaignPendingMarkers.clear();
  explorerCampaignAcceptedMarkers.clear();
  explorerCampaignErrorMarkers.clear();
  publish({
    phase: 'entry_ready',
    seedId: null,
    checkpointId: null,
    error: null,
    ...CLEARED_SCENARIO_STATE,
  });
}

export function setDevE2ESeedLoading(seedId: string): void {
  observedTraceMarkers.clear();
  publish({
    phase: 'seed_loading',
    seedId,
    checkpointId: null,
    error: null,
    ...CLEARED_SCENARIO_STATE,
  });
}

export function setDevE2ESeedReady(seedId: string): void {
  publish({
    phase: 'seed_ready',
    seedId,
    checkpointId: null,
    error: null,
  });
}

export function setDevE2ESeedError(error: unknown, seedId: string | null = null): void {
  publish({
    phase: 'seed_error',
    seedId,
    checkpointId: null,
    error: error instanceof Error ? error.message : String(error),
    ...CLEARED_SCENARIO_STATE,
  });
}

export function setDevE2ECheckpointReady(checkpointId: string): void {
  publish({
    phase: 'checkpoint_ready',
    seedId: checkpointId,
    checkpointId,
    error: null,
  });
}

export function setDevE2EReloadReady(seedId: string, checkpointId: string): void {
  publish({
    phase: 'reload_ready',
    seedId,
    checkpointId,
    error: null,
  });
}

export function setDevE2EScenarioReady(args: {
  scenarioId: string;
  seedId: string;
  nextStepId: string | null;
  eligibilityStatus: 'eligible' | 'complete' | 'blocked';
  eligibilityReasonCode: string;
}): void {
  publish({
    phase: 'seed_ready',
    seedId: args.seedId,
    checkpointId: null,
    error: null,
    scenarioId: args.scenarioId,
    scenarioCheckpointStepId: null,
    scenarioReloadCount: 0,
    scenarioNextStepId: args.nextStepId,
    scenarioEligibilityStatus: args.eligibilityStatus,
    scenarioEligibilityReasonCode: args.eligibilityReasonCode,
    scenarioErrorReasonCode: null,
  });
}

export function setDevE2EScenarioCheckpointReady(args: {
  scenarioId: string;
  seedId: string;
  checkpointStepId: string;
  reloadCount: number;
  nextStepId: string | null;
  eligibilityStatus: 'eligible' | 'complete' | 'blocked';
  eligibilityReasonCode: string;
}): void {
  publish({
    phase: 'checkpoint_ready',
    seedId: args.seedId,
    checkpointId: args.checkpointStepId,
    error: null,
    scenarioId: args.scenarioId,
    scenarioCheckpointStepId: args.checkpointStepId,
    scenarioReloadCount: args.reloadCount,
    scenarioNextStepId: args.nextStepId,
    scenarioEligibilityStatus: args.eligibilityStatus,
    scenarioEligibilityReasonCode: args.eligibilityReasonCode,
    scenarioErrorReasonCode: null,
  });
}

export function setDevE2EScenarioReloadReady(args: {
  scenarioId: string;
  seedId: string;
  checkpointStepId: string;
  reloadCount: number;
  nextStepId: string | null;
  eligibilityStatus: 'eligible' | 'complete' | 'blocked';
  eligibilityReasonCode: string;
}): void {
  publish({
    phase: 'reload_ready',
    seedId: args.seedId,
    checkpointId: args.checkpointStepId,
    error: null,
    scenarioId: args.scenarioId,
    scenarioCheckpointStepId: args.checkpointStepId,
    scenarioReloadCount: args.reloadCount,
    scenarioNextStepId: args.nextStepId,
    scenarioEligibilityStatus: args.eligibilityStatus,
    scenarioEligibilityReasonCode: args.eligibilityReasonCode,
    scenarioErrorReasonCode: null,
  });
}

export function setDevE2EScenarioActionActive(
  scenarioId: string,
  stepId: string,
): void {
  if (snapshot.scenarioId !== scenarioId ||
    snapshot.scenarioNextStepId !== stepId) return;
  publish({
    scenarioEligibilityStatus: 'blocked',
    scenarioEligibilityReasonCode: 'action_in_progress',
  });
}

export function setDevE2EScenarioError(
  reasonCode: string,
  error: unknown,
  scenarioId: string | null = snapshot.scenarioId,
): void {
  publish({
    phase: 'seed_error',
    error: error instanceof Error ? error.message : String(error),
    scenarioId,
    scenarioEligibilityStatus: 'blocked',
    scenarioEligibilityReasonCode: reasonCode,
    scenarioErrorReasonCode: reasonCode,
  });
}

function markerToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Render-only markers proving the actual, trace-correlated React callback fired. */
export function setDevE2ETraceUIObserved(
  controlId: string,
  traceId?: string,
  observationId?: string,
): void {
  if (!controlId) return;
  const markers = [
    `e2e-trace-ui-observed-${controlId}`,
    ...(traceId && observationId ? [
      [
        'e2e-trace-ui-observed',
        markerToken(controlId),
        'trace',
        markerToken(traceId),
        'observation',
        markerToken(observationId),
      ].join('-'),
    ] : []),
  ];
  const next = markers.filter((marker) => !observedTraceMarkers.has(marker));
  if (next.length === 0) return;
  next.forEach((marker) => observedTraceMarkers.add(marker));
  snapshot = Object.freeze({ ...snapshot, revision: snapshot.revision + 1 });
  notifySubscribers();
}

export function setDevE2EExplorerCaptureRequest(
  captureId: string,
  encodedRequest: string,
): void {
  if (!captureId || !encodedRequest ||
    (explorerCaptureRequestMarkers.has(captureId) &&
      explorerCaptureRequestEnvelopes.get(captureId) === encodedRequest)) return;
  explorerCaptureRequestMarkers.add(captureId);
  explorerCaptureRequestEnvelopes.set(captureId, encodedRequest);
  snapshot = Object.freeze({ ...snapshot, revision: snapshot.revision + 1 });
  notifySubscribers();
}

export function setDevE2EExplorerCaptureAccepted(captureId: string): void {
  if (!captureId || explorerCaptureAcceptedMarkers.has(captureId)) return;
  explorerCaptureRequestMarkers.delete(captureId);
  explorerCaptureRequestEnvelopes.delete(captureId);
  explorerCaptureAcceptedMarkers.add(captureId);
  snapshot = Object.freeze({ ...snapshot, revision: snapshot.revision + 1 });
  notifySubscribers();
}

export function setDevE2EExplorerCaptureError(reasonCode: string): void {
  if (!reasonCode || explorerCaptureErrorMarkers.has(reasonCode)) return;
  explorerCaptureErrorMarkers.add(reasonCode);
  snapshot = Object.freeze({ ...snapshot, revision: snapshot.revision + 1 });
  notifySubscribers();
}

export function setDevE2EExplorerArtifactAccepted(scenarioId: string): void {
  if (!scenarioId || explorerArtifactAcceptedMarkers.has(scenarioId)) return;
  explorerArtifactAcceptedMarkers.add(scenarioId);
  snapshot = Object.freeze({ ...snapshot, revision: snapshot.revision + 1 });
  notifySubscribers();
}

export function setDevE2EExplorerNativeLaunchDiagnostic(
  receipt: AcknowledgedExplorerNativeLaunchDiagnosticReceiptV1,
): void {
  const markers = [
    'e2e-explorer-metro-diagnostic-ready',
    explorerMetroDiagnosticMarker(receipt.requestedMetroUrl),
    explorerRequestedMetroDiagnosticMarker(receipt.requestedMetroUrl),
    explorerResolvedMetroDiagnosticMarker(receipt.resolvedMetroUrl),
    explorerBuildShaDiagnosticMarker(receipt.integratedRepositorySha),
    explorerNativeBridgeDiagnosticMarker(receipt.nativeBridgeVersion),
    `e2e-explorer-launch-receipt-${receipt.receiptFingerprint}`,
    `e2e-explorer-launch-diagnostic-${receipt.launchPurpose}`,
  ];
  const next = markers.filter((marker) => !explorerMetroDiagnosticMarkers.has(marker));
  if (next.length === 0) return;
  next.forEach((marker) => explorerMetroDiagnosticMarkers.add(marker));
  snapshot = Object.freeze({ ...snapshot, revision: snapshot.revision + 1 });
  notifySubscribers();
}

export function setDevE2EExplorerLaunchError(reasonCode: string): void {
  const token = markerToken(reasonCode);
  if (!token || explorerLaunchErrorMarkers.has(token)) return;
  explorerLaunchErrorMarkers.add(token);
  snapshot = Object.freeze({ ...snapshot, revision: snapshot.revision + 1 });
  notifySubscribers();
}

export function setDevE2EExplorerCampaignPending(campaignId: string): void {
  if (!campaignId || explorerCampaignPendingMarkers.has(campaignId)) return;
  explorerCampaignPendingMarkers.add(campaignId);
  snapshot = Object.freeze({ ...snapshot, revision: snapshot.revision + 1 });
  notifySubscribers();
}

export function setDevE2EExplorerCampaignAccepted(campaignId: string): void {
  if (!campaignId || explorerCampaignAcceptedMarkers.has(campaignId)) return;
  explorerCampaignAcceptedMarkers.add(campaignId);
  snapshot = Object.freeze({ ...snapshot, revision: snapshot.revision + 1 });
  notifySubscribers();
}

export function setDevE2EExplorerCampaignError(reasonCode: string): void {
  const token = markerToken(reasonCode);
  if (!token || explorerCampaignErrorMarkers.has(token)) return;
  explorerCampaignErrorMarkers.add(token);
  snapshot = Object.freeze({ ...snapshot, revision: snapshot.revision + 1 });
  notifySubscribers();
}

export function devE2EMarkers(state: DevE2EStateSnapshot): string[] {
  const markers = [
    'e2e-entry-ready',
    ...Array.from(observedTraceMarkers).sort(),
    ...Array.from(explorerCaptureRequestMarkers)
      .sort()
      .map((captureId) => `e2e-explorer-capture-request-${captureId}`),
    ...Array.from(explorerCaptureRequestEnvelopes.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, encodedRequest]) =>
        `e2e-explorer-capture-envelope-${encodedRequest}`),
    ...Array.from(explorerCaptureAcceptedMarkers)
      .sort()
      .map((captureId) => `e2e-explorer-capture-accepted-${captureId}`),
    ...Array.from(explorerCaptureErrorMarkers)
      .sort()
      .map((reasonCode) => `e2e-explorer-capture-error-${reasonCode}`),
    ...Array.from(explorerArtifactAcceptedMarkers)
      .sort()
      .map((scenarioId) => `e2e-explorer-artifact-accepted-${scenarioId}`),
    ...Array.from(explorerMetroDiagnosticMarkers).sort(),
    ...Array.from(explorerLaunchErrorMarkers)
      .sort()
      .map((reasonCode) => `e2e-explorer-launch-error-${reasonCode}`),
    ...Array.from(explorerCampaignPendingMarkers)
      .sort()
      .map((campaignId) => `e2e-explorer-campaign-pending-${campaignId}`),
    ...Array.from(explorerCampaignAcceptedMarkers)
      .sort()
      .map((campaignId) => `e2e-explorer-campaign-accepted-${campaignId}`),
    ...Array.from(explorerCampaignErrorMarkers)
      .sort()
      .map((reasonCode) => `e2e-explorer-campaign-error-${reasonCode}`),
  ];
  if (!state.scenarioId) {
    switch (state.phase) {
      case 'seed_loading':
        markers.push('e2e-seed-loading');
        break;
      case 'seed_ready':
        if (state.seedId) markers.push(`e2e-seed-ready-${state.seedId}`);
        break;
      case 'seed_error':
        markers.push('e2e-seed-error');
        break;
      case 'checkpoint_ready':
        if (state.checkpointId) {
          markers.push(`e2e-checkpoint-ready-${state.checkpointId}`);
        }
        break;
      case 'reload_ready':
        if (state.seedId) markers.push(`e2e-reload-ready-${state.seedId}`);
        break;
      case 'entry_ready':
        break;
    }
  } else {
    markers.push(`e2e-scenario-ready-${state.scenarioId}`);
    if (state.phase === 'checkpoint_ready' && state.scenarioCheckpointStepId) {
      markers.push(
        `e2e-checkpoint-ready-${state.scenarioId}-${state.scenarioCheckpointStepId}`,
      );
    }
    if (state.phase === 'reload_ready' &&
      state.scenarioCheckpointStepId &&
      state.scenarioReloadCount !== null) {
      markers.push(
        `e2e-reload-ready-${state.scenarioId}-${state.scenarioCheckpointStepId}-${state.scenarioReloadCount}`,
      );
    }
    if (state.scenarioEligibilityStatus === 'eligible' && state.scenarioNextStepId) {
      markers.push(
        `e2e-next-action-eligible-${state.scenarioId}-${state.scenarioNextStepId}`,
      );
      if (state.scenarioId.startsWith('smoke-')) {
        markers.push(
          `e2e-explorer-next-action-eligible-${state.scenarioId}-${state.scenarioNextStepId}`,
        );
      }
    }
    if (state.scenarioEligibilityStatus === 'complete') {
      markers.push(`e2e-scenario-complete-${state.scenarioId}`);
    }
  }
  if (state.scenarioErrorReasonCode) {
    markers.push(`e2e-scenario-error-${state.scenarioErrorReasonCode}`);
  }
  return markers;
}

export function hasDevE2EMarker(marker: string): boolean {
  return devE2EMarkers(snapshot).includes(marker);
}

export function __resetDevE2EStateForTest(): void {
  observedTraceMarkers.clear();
  explorerCaptureRequestMarkers.clear();
  explorerCaptureRequestEnvelopes.clear();
  explorerCaptureAcceptedMarkers.clear();
  explorerCaptureErrorMarkers.clear();
  explorerArtifactAcceptedMarkers.clear();
  explorerMetroDiagnosticMarkers.clear();
  explorerLaunchErrorMarkers.clear();
  explorerCampaignPendingMarkers.clear();
  explorerCampaignAcceptedMarkers.clear();
  explorerCampaignErrorMarkers.clear();
  snapshot = INITIAL;
  notifySubscribers();
}
