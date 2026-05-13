/**
 * Smoke-bootstrap deep-link installer.
 *
 * Why this module exists (separate from useInitializeApp):
 *   The previous wiring registered `Linking.addEventListener` inside a
 *   React `useEffect`, behind an `await Linking.getInitialURL()` call.
 *   Maestro's sequence is:
 *
 *     1. launchApp clearState: true        — kills + cold-starts the app
 *     2. openLink localfootyathlete://...  — fires almost immediately
 *
 *   Cold start has no URL, so getInitialURL returns null. The `openLink`
 *   then fires a warm URL — but the listener registration was still
 *   awaiting that initial probe + an env-var probe, so the event was
 *   dispatched into the void. iOS does not queue Linking events for
 *   late-attached listeners; if there's no handler when the URL arrives,
 *   it is lost.
 *
 *   This installer is called at App.tsx top level (module load), BEFORE
 *   any React rendering. It:
 *     - synchronously registers `Linking.addEventListener('url', …)` so
 *       any subsequent warm URL is captured;
 *     - kicks off `Linking.getInitialURL()` for the cold-start case;
 *     - polls `getInitialURL()` for ~10s as a belt-and-braces fallback
 *       (in case the platform delivers the URL via the initial-URL
 *       channel slightly after launch — observed on Expo dev client
 *       where the first URL is the dev-client launch URL and the smoke
 *       URL arrives second).
 *
 *   Every URL path logs a precise raw-URL marker before parsing:
 *     [smoke-bootstrap] url received raw=<url> source=<channel>
 *   so the smoke wrapper can distinguish "URL never arrived" from
 *   "URL arrived but bootstrap refused" (e.g. parser rejected, not in
 *   dev, etc.).
 *
 *   The bootstrap itself is idempotent (lastBootstrapForFlow guard in
 *   smokeBootstrap.ts), so duplicate deliveries from multiple channels
 *   short-circuit safely.
 */

import { Linking } from 'react-native';
import {
  isSmokeBootstrapAllowed,
  parseSmokeBootstrapUrl,
  runSmokeBootstrap,
  type SmokeFlow,
} from './smokeBootstrap';
import { logger } from './logger';

logger.info('[smoke-bootstrap] installer imported');

export type DeepLinkSource =
  | 'getInitialURL'
  | 'event'
  | 'getInitialURL.poll'
  | 'manual';

let installed = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let urlEventSubscription: { remove: () => void } | null = null;

/**
 * Pure URL → bootstrap handler. Logs the raw URL first (so the smoke
 * wrapper can detect "URL was received but did not parse" separately
 * from "URL never arrived"), then attempts to parse + bootstrap.
 *
 * Returns the resolved flow when bootstrap fires, null otherwise.
 * Idempotent against re-deliveries via runSmokeBootstrap's guard.
 */
export async function handleIncomingSmokeUrl(
  url: string | null | undefined,
  source: DeepLinkSource,
): Promise<SmokeFlow | null> {
  if (!url) return null;

  // Raw-URL marker — fires for every URL the installer receives,
  // regardless of whether it parses as a smoke URL. This is the key
  // diagnostic the smoke wrapper greps for.
  logger.info(
    `[smoke-bootstrap] url received raw=${url} source=${source}`,
  );

  const parsed = parseSmokeBootstrapUrl(url);
  if (!parsed) {
    // Not a smoke URL (could be dev-client launch URL, push handoff,
    // etc.) — log and move on. The wrapper can tell the difference.
    logger.info(
      `[smoke-bootstrap] ignored: not a recognised smoke URL (source=${source})`,
    );
    return null;
  }

  if (!isSmokeBootstrapAllowed()) {
    logger.warn(
      `[smoke-bootstrap] refused: smoke URL in non-dev build (source=${source})`,
    );
    return null;
  }

  try {
    const res = await runSmokeBootstrap({ flow: parsed.flow });
    return res.flow;
  } catch (err: any) {
    logger.error(
      `[smoke-bootstrap] FAILED to run bootstrap (source=${source})`,
      err?.message ?? err,
    );
    return null;
  }
}

/**
 * Install the deep-link listener + polling fallback. Idempotent —
 * subsequent calls are no-ops, so safe to call from both App.tsx and a
 * test setup file.
 *
 * Returns a teardown function (only useful in tests / hot reload).
 */
export function installSmokeBootstrapListener(): () => void {
  if (installed) {
    return () => {};
  }
  installed = true;

  logger.info('[smoke-bootstrap] installer mounted');

  // ── 1. Warm-URL listener — register SYNCHRONOUSLY ──────────────
  // This is the critical race fix. If we await anything before this
  // call, Maestro's openLink (delivered ~0–200ms after launchApp) will
  // be missed.
  try {
    urlEventSubscription = Linking.addEventListener('url', (event) => {
      void handleIncomingSmokeUrl(event?.url ?? null, 'event');
    });
    logger.info('[smoke-bootstrap] addEventListener("url") attached');
  } catch (err: any) {
    logger.warn(
      '[smoke-bootstrap] could not attach Linking event listener',
      err?.message ?? err,
    );
  }

  // ── 2. Cold-start probe — async, does not block listener ───────
  // Fire-and-forget. Idempotency guard prevents double-bootstrap if
  // the same URL also arrives via the event channel.
  Promise.resolve()
    .then(() => Linking.getInitialURL())
    .then((url) => handleIncomingSmokeUrl(url, 'getInitialURL'))
    .catch((err) => {
      logger.warn(
        '[smoke-bootstrap] getInitialURL probe failed',
        err?.message ?? err,
      );
    });

  // ── 3. Polling fallback ────────────────────────────────────────
  // Expo dev client launches with a dev-client URL first; the smoke
  // URL can arrive seconds later via openLink. If the event listener
  // was attached too late (shouldn't happen now, but belt-and-braces),
  // periodically re-poll the initial URL channel. Once bootstrap
  // succeeds, the idempotency guard makes further polls no-ops, but we
  // stop the timer too so we're not allocating timers forever.
  const POLL_INTERVAL_MS = 500;
  const POLL_DURATION_MS = 10_000;
  const POLL_END_AT = Date.now() + POLL_DURATION_MS;
  pollTimer = setInterval(async () => {
    if (Date.now() >= POLL_END_AT) {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      return;
    }
    try {
      const url = await Linking.getInitialURL();
      const flow = await handleIncomingSmokeUrl(url, 'getInitialURL.poll');
      if (flow) {
        // Bootstrap succeeded — no need to keep polling.
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }
    } catch {
      // Swallow — polling shouldn't crash the app if Linking is
      // momentarily unavailable.
    }
  }, POLL_INTERVAL_MS);

  return () => {
    try {
      urlEventSubscription?.remove();
    } catch {}
    urlEventSubscription = null;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    installed = false;
  };
}

/**
 * Reset internal state — for tests only. Production code should call
 * installSmokeBootstrapListener exactly once at app startup.
 */
export function __resetSmokeBootstrapInstallerForTest(): void {
  if (urlEventSubscription) {
    try {
      urlEventSubscription.remove();
    } catch {}
  }
  urlEventSubscription = null;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  installed = false;
}

/**
 * For tests — true once the installer has run.
 */
export function __isSmokeBootstrapInstalledForTest(): boolean {
  return installed;
}
