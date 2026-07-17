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

export function devE2EMarkers(state: DevE2EStateSnapshot): string[] {
  const markers = [
    'e2e-entry-ready',
    ...Array.from(observedTraceMarkers).sort(),
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
  snapshot = INITIAL;
  notifySubscribers();
}
