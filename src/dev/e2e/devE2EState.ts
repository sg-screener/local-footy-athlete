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
  revision: number;
}

const INITIAL: DevE2EStateSnapshot = Object.freeze({
  phase: 'entry_ready',
  seedId: null,
  checkpointId: null,
  error: null,
  revision: 0,
});

let snapshot: DevE2EStateSnapshot = INITIAL;
const subscribers = new Set<() => void>();

function publish(next: Omit<DevE2EStateSnapshot, 'revision'>): void {
  snapshot = Object.freeze({ ...next, revision: snapshot.revision + 1 });
  for (const subscriber of Array.from(subscribers)) {
    try {
      subscriber();
    } catch {
      // A diagnostic subscriber must never break the entry coordinator.
    }
  }
}

export function getDevE2EStateSnapshot(): DevE2EStateSnapshot {
  return snapshot;
}

export function subscribeDevE2EState(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function setDevE2EEntryReady(): void {
  publish({
    phase: 'entry_ready',
    seedId: null,
    checkpointId: null,
    error: null,
  });
}

export function setDevE2ESeedLoading(seedId: string): void {
  publish({
    phase: 'seed_loading',
    seedId,
    checkpointId: null,
    error: null,
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

export function devE2EMarkers(state: DevE2EStateSnapshot): string[] {
  const markers = ['e2e-entry-ready'];
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
  return markers;
}

export function __resetDevE2EStateForTest(): void {
  snapshot = INITIAL;
  for (const subscriber of Array.from(subscribers)) subscriber();
}
