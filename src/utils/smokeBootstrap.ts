/**
 * Retired live-smoke compatibility surface.
 *
 * Coach/DayWorkout still contain diagnostic branches from the historical
 * coach-bike smoke flow. Keeping these two inert reads avoids touching Coach
 * mutation work while ensuring the removed env/source-flag bootstrap can
 * never activate. Dev E2E setup is owned exclusively by DevE2ESeedCoordinator.
 */

export interface SmokeRuntimeSignal {
  flow: string | null;
  source: 'env' | 'file' | null;
  envValue: string | undefined;
  fileValue: string | null | undefined;
}

const RETIRED_SIGNAL: SmokeRuntimeSignal = Object.freeze({
  flow: null,
  source: null,
  envValue: undefined,
  fileValue: null,
});

export function getSmokeRuntimeSignal(): SmokeRuntimeSignal {
  return RETIRED_SIGNAL;
}

export function getSmokeInitialRoute(): 'Coach' | null {
  return null;
}
