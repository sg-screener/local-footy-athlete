/**
 * smokeNavState — single, authoritative state machine for the live
 * smoke harness.
 *
 * Background. The previous live-Maestro contradiction was:
 *
 *   smoke-bootstrap-route-ready: COMPLETED
 *   route-current-Coach:         FAILED
 *
 * That happened because route-readiness was being computed from
 * mismatched signals — bootstrap intent, navigator initialRouteName, an
 * inner-vs-outer screenListener race — instead of from React
 * Navigation's authoritative route state.
 *
 * The fix is this module: every smoke-relevant boolean is captured in a
 * single subscribable snapshot, and every smoke marker is derived from
 * that snapshot. Setters are invoked from EXACTLY one well-defined seam
 * each:
 *
 *   runtimeReady          — App.tsx mounts (or the smoke runtime
 *                           marker renders).
 *   bootstrapComplete     — runSmokeBootstrap finishes successfully.
 *   navReady              — NavigationContainer.onReady fires.
 *   routeIntent           — runSmokeBootstrap sets it to 'Coach' for
 *                           coach-bike-flow.
 *   routeEnforcerRequested — SmokeRouteEnforcer dispatches reset.
 *   actualCurrentRoute    — NavigationContainer.onStateChange resolves
 *                           the deepest active leaf route.
 *   coachReady            — CoachScreen mounts.
 *
 * This module is intentionally framework-free (no React imports). The
 * subscribe/getSnapshot pair is shaped for `useSyncExternalStore` so
 * any React component can read it.
 */

export type SmokeNavStateSnapshot = Readonly<{
  runtimeReady: boolean;
  bootstrapComplete: boolean;
  navReady: boolean;
  routeIntent: string | null;
  routeEnforcerRequested: boolean;
  actualCurrentRoute: string | null;
  coachReady: boolean;
}>;

const INITIAL: SmokeNavStateSnapshot = Object.freeze({
  runtimeReady: false,
  bootstrapComplete: false,
  navReady: false,
  routeIntent: null,
  routeEnforcerRequested: false,
  actualCurrentRoute: null,
  coachReady: false,
});

let snapshot: SmokeNavStateSnapshot = INITIAL;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of Array.from(subscribers)) {
    try {
      cb();
    } catch {
      // Subscribers MUST NOT throw; if one does we drop it on the floor
      // so the rest still get notified. Throwing here would brick the
      // entire smoke harness on a single misbehaving subscriber.
    }
  }
}

function update(patch: Partial<SmokeNavStateSnapshot>): boolean {
  const next: SmokeNavStateSnapshot = Object.freeze({ ...snapshot, ...patch });
  // Reference equality cuts wasted re-renders for repeat sets (e.g.
  // onStateChange firing with the same actualCurrentRoute multiple
  // times in a row).
  let changed = false;
  for (const key of Object.keys(patch) as Array<keyof SmokeNavStateSnapshot>) {
    if (snapshot[key] !== next[key]) {
      changed = true;
      break;
    }
  }
  if (!changed) return false;
  snapshot = next;
  notify();
  return true;
}

export function subscribeSmokeNavState(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export function getSmokeNavStateSnapshot(): SmokeNavStateSnapshot {
  return snapshot;
}

// ────────────────────────────────────────────────────────────────────
// Setters — exactly one call site per setter (per the doc comments).
// ────────────────────────────────────────────────────────────────────

export function setRuntimeReady(ready: boolean = true): void {
  update({ runtimeReady: ready });
}

export function setBootstrapComplete(complete: boolean = true): void {
  update({ bootstrapComplete: complete });
}

export function setNavReady(ready: boolean = true): void {
  update({ navReady: ready });
}

export function setRouteIntent(intent: string | null): void {
  update({ routeIntent: intent });
}

export function setRouteEnforcerRequested(requested: boolean = true): void {
  update({ routeEnforcerRequested: requested });
}

export function setActualCurrentRoute(route: string | null): void {
  update({ actualCurrentRoute: route });
}

export function setCoachReady(ready: boolean = true): void {
  update({ coachReady: ready });
}

/**
 * Returns the deepest active leaf route name from a React Navigation
 * state tree. Walks `state.routes[state.index].state` recursively so
 * nested tabs/stacks resolve to the actual visible screen.
 *
 * Why this matters: the previous bug used `screenListeners.state` on
 * the Tab.Navigator, whose event payload is the Tab navigator's OWN
 * state. When a tab is selected but its inner stack hasn't initialised
 * `state` yet, the recursion bottoms out at the tab name (CoachTab),
 * not the leaf screen (Coach). That mismatch made `route-current-Coach`
 * never appear on cold runs.
 *
 * NavigationContainer.onStateChange is the single source of truth: it
 * fires for ANY change anywhere in the tree, and the state passed in
 * is the full root state with every nested navigator's state attached
 * once it has initialised. Pair with getCurrentLeafRouteName and the
 * leaf name converges on Coach.
 */
export function getCurrentLeafRouteName(state: any): string | null {
  if (!state || !Array.isArray(state.routes) || state.routes.length === 0) {
    return null;
  }
  const route = state.routes[typeof state.index === 'number' ? state.index : 0];
  if (route?.state) {
    const inner = getCurrentLeafRouteName(route.state);
    if (inner !== null) return inner;
  }
  return route?.name ?? null;
}

/**
 * Test-only reset. The smoke harness starts JS fresh each run, so this
 * is exclusively for jest/sucrase tests in `src/__tests__`.
 */
export function __resetSmokeNavStateForTest(): void {
  snapshot = INITIAL;
  notify();
}
