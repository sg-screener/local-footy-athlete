/**
 * resetSignals.ts — tiny pub/sub for "screen, drop your in-memory
 * coach state". Used by the reset utilities to nuke pendingInjuryRef
 * (which lives in CoachScreen, not a Zustand store) without coupling
 * the reset module to a React component.
 *
 * Pattern:
 *   CoachScreen.useEffect(() => subscribeResetSignal(callback), []);
 *   resetCoach.clearCoachAdjustments(...) → fires the signal.
 */

import { logger } from './logger';

type Listener = () => void;

const listeners: Set<Listener> = new Set();

export function subscribeResetSignal(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function fireResetSignal(): void {
  for (const fn of listeners) {
    try { fn(); } catch (e) {
      logger.warn('[reset] listener_error', { error: String(e) });
    }
  }
}

/** Clear all listeners — used by tests. */
export function clearResetListeners(): void {
  listeners.clear();
}
