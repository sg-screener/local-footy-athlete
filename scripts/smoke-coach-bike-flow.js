#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Hybrid smoke runner for the coach bike-flow regression.
 *
 * Phases:
 *   1. Deterministic pipeline regression.
 *   2. Live smoke bootstrap/setup.
 *   3. Actual coach UI flow.
 *   4. Visible DayWorkout contract.
 *
 * Default delivery is the deep link:
 *   localfootyathlete://smoke/coach-bike-flow
 *
 * For a more stable cold run, pass --env-bootstrap and start Metro with:
 *   EXPO_PUBLIC_SMOKE_BOOTSTRAP=coach-bike-flow
 */

const { spawn, spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const APP_ID = 'com.localfootyathlete.app';
const ARTIFACT_DIR = path.join(ROOT, 'artifacts');
const PIPELINE_SMOKE_REL = 'src/__tests__/smokeCoachBikeFlowTests.ts';

const USE_ENV_BOOTSTRAP =
  process.argv.includes('--env-bootstrap') ||
  process.env.SMOKE_BOOTSTRAP_DELIVERY === 'env';
const RUNTIME_PREFLIGHT_ALREADY_PROVEN =
  process.env.SMOKE_RUNTIME_PREFLIGHT_ALREADY_PROVEN === '1';

const MAESTRO_FLOW = path.join(
  ROOT,
  '.maestro',
  USE_ENV_BOOTSTRAP ? 'coach-bike-flow-env.yaml' : 'coach-bike-flow.yaml',
);

const SMOKE_URL_SCHEME = 'localfootyathlete';
const SMOKE_BOOTSTRAP_URL = `${SMOKE_URL_SCHEME}://smoke/coach-bike-flow`;
const SMOKE_PROBE_URL = `${SMOKE_URL_SCHEME}://smoke/__preflight_probe__`;

const RELEVANT_LOG_TERMS = [
  'app-entry',
  'smoke-bootstrap',
  'smoke-route-enforcer',
  'smoke-visible-week',
  'smoke-dayworkout-contract',
  'navigation-container',
  'navigation-state',
  'tabs-mounted',
  'tab-press',
  'nav-route',
  'coach-screen',
  'coach-ready',
  'coach-build',
  'dev-skip',
  'Linking',
  'openLink',
];

function ok(label) {
  console.log(`  ✓ ${label}`);
}

function info(label) {
  console.log(`  • ${label}`);
}

function header(label) {
  console.log(`\n── ${label} ──`);
}

function fail(label, detail) {
  console.error(`\n✗ ${label}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function which(cmd) {
  try {
    const fromPath = execSync(`command -v ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (fromPath) return fromPath;
  } catch {
  }
  if (cmd === 'maestro') {
    const localMaestro = path.join(os.homedir(), '.maestro', 'bin', 'maestro');
    if (fs.existsSync(localMaestro)) return localMaestro;
  }
  return '';
}

function ensureArtifactDir() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
}

function xcrunOpenUrl(deviceId, url) {
  try {
    const res = spawnSync('xcrun', ['simctl', 'openurl', deviceId, url], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stderr = (res.stderr || '').trim();
    const schemeRejected =
      /LSApplicationWorkspaceErrorDomain|error\s*115|Unable to lookup|failed to open/i.test(
        stderr,
      );
    return {
      ok: res.status === 0,
      exitCode: res.status,
      stderr,
      schemeRejected,
    };
  } catch (err) {
    return {
      ok: false,
      exitCode: -1,
      stderr: String((err && err.message) || err),
      schemeRejected: false,
    };
  }
}

function preflightUrlScheme(deviceId) {
  header('Phase 2: smoke bootstrap/setup - native URL scheme');
  info(`xcrun simctl openurl ${deviceId} "${SMOKE_PROBE_URL}"`);
  const res = xcrunOpenUrl(deviceId, SMOKE_PROBE_URL);
  if (res.ok) {
    ok('URL scheme registered.');
    return;
  }
  if (res.schemeRejected) {
    fail(
      'Native URL scheme missing. Rebuild native app.',
      [
        `iOS rejected ${SMOKE_URL_SCHEME}:// with LSApplicationWorkspaceErrorDomain error 115.`,
        '',
        `Root cause: app.json declares "scheme": "${SMOKE_URL_SCHEME}", but the`,
        'installed simulator binary does not have that CFBundleURLTypes entry.',
        'A Metro reload cannot add native URL schemes.',
        '',
        'Rebuild the native iOS app:',
        '  npx expo prebuild --clean',
        '  npx expo run:ios',
        '',
        'Then re-run:',
        '  npm run smoke:coach-bike-flow',
        '',
        'simctl stderr:',
        `  ${res.stderr.split('\n').join('\n  ') || '(empty)'}`,
      ].join('\n'),
    );
  }
  fail(
    'Smoke bootstrap/setup failed.',
    [
      'xcrun simctl could not open the probe URL.',
      `exit code: ${res.exitCode}`,
      `stderr:    ${res.stderr || '(empty)'}`,
    ].join('\n'),
  );
}

function bootedSimulatorDeviceId() {
  if (process.platform !== 'darwin') return '';
  if (!which('xcrun')) return '';
  try {
    const out = execSync('xcrun simctl list devices booted', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    const match = out.match(/\(([0-9A-F-]{36})\) \(Booted\)/);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

function runPipelineSmoke() {
  header('Phase 1: deterministic pipeline regression');
  info(`npx sucrase-node ${PIPELINE_SMOKE_REL}`);
  const result = spawnSync('npx', ['sucrase-node', PIPELINE_SMOKE_REL], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    fail(
      'Pipeline regression failed.',
      'The deterministic router/orchestrator/applier/projection gate failed. See the test output above.',
    );
  }
  ok('Pipeline regression passed.');
}

function simulatorLogPredicate() {
  const termPredicates = RELEVANT_LOG_TERMS.map(
    (term) => `eventMessage CONTAINS[c] "${term}"`,
  );
  return [
    ...termPredicates,
    'process CONTAINS[c] "LocalFooty"',
    'processImagePath CONTAINS[c] "LocalFooty"',
    'processImagePath CONTAINS[c] "localfootyathlete"',
  ].join(' OR ');
}

function startSimulatorLogCapture(deviceId) {
  const lines = [];
  let buffer = '';
  const child = spawn(
    'xcrun',
    [
      'simctl',
      'spawn',
      deviceId,
      'log',
      'stream',
      '--style',
      'compact',
      '--level',
      'debug',
      '--predicate',
      simulatorLogPredicate(),
    ],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  const onData = (chunk) => {
    buffer += chunk.toString();
    const parts = buffer.split(/\r?\n/);
    buffer = parts.pop() || '';
    for (const line of parts) {
      if (line.trim()) lines.push(line);
      if (lines.length > 2000) lines.shift();
    }
  };

  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  return {
    child,
    lines,
    text() {
      return lines.join('\n');
    },
    stop() {
      try {
        child.kill('SIGTERM');
      } catch {}
    },
  };
}

function smokeMarkersFromText(text) {
  return {
    appEntry: /\[app-entry\] App\.tsx module loaded/.test(text),
    bootstrapSignalVisible:
      /smokeBootstrapEnv["']?\s*[:=]\s*["']coach-bike-flow/.test(text) ||
      /smokeBootstrapFileFlag["']?\s*[:=]\s*["']coach-bike-flow/.test(text) ||
      /smokeBootstrapSignal["']?\s*[:=]\s*["']coach-bike-flow/.test(text) ||
      /SMOKE_BOOTSTRAP_FLOW[^\n]*coach-bike-flow/.test(text) ||
      /EXPO_PUBLIC_SMOKE_BOOTSTRAP[^\n]*coach-bike-flow/.test(text),
    installerImported: /\[smoke-bootstrap\] installer imported/.test(text),
    installerMounted: /\[smoke-bootstrap\] installer mounted/.test(text),
    listenerAttached: /\[smoke-bootstrap\] addEventListener\("url"\) attached/.test(
      text,
    ),
    urlReceived: /\[smoke-bootstrap\] url received raw=/.test(text),
    envFlagDetected: /\[smoke-bootstrap\] env flag detected flow=coach-bike-flow/.test(
      text,
    ),
    fileFlagDetected: /\[smoke-bootstrap\] file flag detected flow=coach-bike-flow/.test(
      text,
    ),
    bootstrapStarted: /\[smoke-bootstrap\] started/.test(text),
    bootstrapProfileSeeded: /\[smoke-bootstrap\] profile seeded/.test(text),
    bootstrapProgramInstalled: /\[smoke-bootstrap\] program installed/.test(text),
    bootstrapOnboardingComplete: /\[smoke-bootstrap\] onboarding complete/.test(
      text,
    ),
    initialRouteCoach: /\[smoke-bootstrap\] initialRoute=Coach/.test(text),
    appNavigatorRouteRaw: /\[app-navigator\] smokeInitialRoute raw=/.test(text),
    appNavigatorTabsPending:
      /\[app-navigator\] tabs not mounted yet/.test(text),
    appNavigatorInitialRouteCoachTab:
      /\[app-navigator\] initialRouteName=CoachTab/.test(text),
    appNavigatorRouteReady:
      /\[app-navigator\] smoke-bootstrap-route-ready/.test(text),
    appNavigatorBootstrapComplete:
      /\[app-navigator\] smoke-bootstrap-complete/.test(text),
    navigationContainerReady:
      /\[navigation-container\] onReady/.test(text),
    routeEnforcerGateReady:
      /\[smoke-route-enforcer\] gate ready: navReady=true bootstrapComplete=true routeIntent=Coach/.test(
        text,
      ),
    routeEnforcerReady:
      /\[smoke-route-enforcer\] navigation ready/.test(text),
    routeEnforcerRequested:
      /\[smoke-route-enforcer\] requested CoachTab/.test(text),
    routeEnforcerNavigated:
      /\[smoke-route-enforcer\] navigated CoachTab/.test(text),
    routeEnforcerAlreadyCoach:
      /\[smoke-route-enforcer\] already on Coach/.test(text),
    routeEnforcerDispatchFailed:
      /\[smoke-route-enforcer\] dispatch failed/.test(text),
    routeEnforcerNeverReady:
      /\[smoke-route-enforcer\] navigation never became ready/.test(text) ||
      /\[smoke-route-enforcer\] gate said navReady but navigationRef\.isReady\(\) is false/.test(
        text,
      ),
    routeMismatchObserved:
      /\[smoke-route-error\] intent=Coach actual=/.test(text) &&
      !/\[smoke-route-error\] intent=Coach actual=Coach/.test(text),
    navRouteCoach: /\[nav-route\] currentRoute=Coach/.test(text),
    navRouteDayWorkout: /\[nav-route\] currentRoute=DayWorkout/.test(text),
    navRouteProgram: /\[nav-route\] currentRoute=(Program|Home)/.test(text),
    navRouteAny: /\[nav-route\] currentRoute=/.test(text),
    // Harness log lines are formatted as:
    //   [smoke-visible-week] state=<state> reason=<reason> route=<route> week=<dump>
    // and (for inactive):
    //   [smoke-visible-week] state=inactive reason=<reason> flow=<flow> activeRoute=<route>
    // Harness-itself log lines:
    //   [smoke-harness] module loaded
    //   [smoke-harness] render { ... }
    //   [smoke-harness] render error <err>
    smokeHarnessModuleLoaded: /\[smoke-harness\] module loaded/.test(text),
    smokeHarnessRender: /\[smoke-harness\] render /.test(text),
    smokeHarnessRenderError: /\[smoke-harness\] render error/.test(text),
    // App.tsx render-path proofs — emitted on every render of the
    // smoke mount zone block. Wrapper uses these to confirm App.tsx
    // executed both <View> renders even when UI hit-test fails.
    appSmokeMountFingerprint:
      /\[app-smoke-mount\] fingerprint rendered/.test(text),
    appSmokeMountHarness:
      /\[app-smoke-mount\] harness mount zone rendered/.test(text),
    // Inline overlay log proofs.
    appSmokeOverlayRender:
      /\[app-smoke-overlay\] render (?:smoke-visible-week\s+)?state=/.test(text),
    appSmokeOverlayEngineLoadError:
      /\[app-smoke-overlay\] engine-load-error/.test(text),
    appSmokeOverlayStoreReadError:
      /\[app-smoke-overlay\] store-read-error/.test(text),
    appSmokeOverlayWeekDeriveError:
      /\[app-smoke-overlay\] week-derive-error/.test(text),
    smokeVisibleWeekReady:
      /\[smoke-visible-week\] state=ready /.test(text),
    smokeVisibleWeekPending:
      /\[smoke-visible-week\] state=pending /.test(text),
    smokeVisibleWeekMissing:
      /\[smoke-visible-week\] state=missing /.test(text),
    smokeVisibleWeekInactive:
      /\[smoke-visible-week\] state=inactive /.test(text),
    smokeVisibleWeekInactiveSmokeFlagFalse:
      /\[smoke-visible-week\] state=inactive reason=smoke-flow-not-active/.test(
        text,
      ),
    smokeVisibleWeekPendingNoResolvedWeekYet:
      /\[smoke-visible-week\] state=pending reason=no-resolved-week-yet/.test(
        text,
      ),
    smokeVisibleWeekPendingNoActiveRouteYet:
      /\[smoke-visible-week\] state=pending reason=no-active-route-yet/.test(
        text,
      ),
    smokeVisibleWeekMissingRouteNotCoach:
      /\[smoke-visible-week\] state=missing reason=route-not-coach/.test(text),
    smokeVisibleWeekMissingNoResolvedWeek:
      /\[smoke-visible-week\] state=missing reason=no-resolved-week( |$)/m.test(
        text,
      ),
    smokeVisibleWeekMissingNoWednesday:
      /\[smoke-visible-week\] state=missing reason=no-wednesday-day/.test(text),
    smokeVisibleWeekMissingWednesdayHasNoWorkout:
      /\[smoke-visible-week\] state=missing reason=wednesday-has-no-workout/.test(
        text,
      ),
    smokeVisibleWeekMissingNotEasyAerobicFlush:
      /\[smoke-visible-week\] state=missing reason=wednesday-not-easy-aerobic-flush/.test(
        text,
      ),
    smokeVisibleWeekMissingNoRower:
      /\[smoke-visible-week\] state=missing reason=no-rower-before-change/.test(
        text,
      ),
    // Runtime-log-scannable signal — true if we saw ANY [smoke-bootstrap]
    // line. Used to distinguish "negative result" (logs scanned, marker
    // not seen) from "unknown" (no runtime logs captured at all).
    bootstrapLogScannable: /\[smoke-bootstrap\]/.test(text),
    smokeBootstrapWednesdaySeeded:
      /\[smoke-bootstrap\] wednesday-seeded name=Easy Aerobic Flush/.test(text),
    smokeOpenWednesdayRendered:
      /\[smoke-open-wednesday-workout\] rendered source=CoachScreen/.test(text),
    smokeOpenWednesdayPressed:
      /\[smoke-open-wednesday-workout\] pressed/.test(text),
    smokeOpenWednesdayNavigating:
      /\[smoke-open-wednesday-workout\] navigating DayWorkout/.test(text),
    smokeOpenWednesdayMissing:
      /\[smoke-open-wednesday-workout\] missing reason=/.test(text),
    smokeOpenWednesdayNavigationRefNotReady:
      /\[smoke-open-wednesday-workout\] navigationRef not ready/.test(text),
    smokeOpenWednesdayNoTarget:
      /\[smoke-open-wednesday-workout\] no target reason=/.test(text),
    // Screen logs either:
    //   [smoke-dayworkout-contract] ready state=ready reason=ok title=…
    //   [smoke-dayworkout-contract] failed state=failed reason=… title=…
    // Match either via the leading verb OR the embedded state= token.
    smokeDayWorkoutContractReady:
      /\[smoke-dayworkout-contract\] (?:ready |state=ready )/.test(text),
    smokeDayWorkoutContractFailed:
      /\[smoke-dayworkout-contract\] (?:failed |state=failed )/.test(text),
    isOnboardingTrue: /\[navigation-state\] isOnboardingComplete true/.test(text),
    tabsMounted: /\[tabs-mounted\] true/.test(text),
    smokeFlagStillSetBeforeMaestro:
      /\[smoke-flag\] generated flag still set before Maestro/.test(text),
    smokeFlagResetAfterMaestro:
      /\[smoke-flag\] generated flag reset after Maestro/.test(text),
  };
}

function lastAppSmokeOverlayDebugLabel(text) {
  const matches = Array.from(
    text.matchAll(
      /\[app-smoke-overlay\] render ((?:smoke-visible-week\s+)?state=[^\r\n]+)/g,
    ),
  );
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1].trim();
}

function lastDayWorkoutContractLabel(text) {
  // Match either the legacy `state=…` log OR the verb-prefixed format
  // used by DayWorkoutScreenV2:
  //   [smoke-dayworkout-contract] state=ready reason=ok title=…
  //   [smoke-dayworkout-contract] ready state=ready reason=ok title=…
  //   [smoke-dayworkout-contract] failed state=failed reason=… title=…
  const matches = Array.from(
    text.matchAll(
      /\[smoke-dayworkout-contract\] (?:(?:ready|failed)\s+)?(state=[^\r\n]+)/g,
    ),
  );
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1].trim();
}

function appSmokeOverlayDebugField(label, field) {
  if (!label) return null;
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = label.match(new RegExp(`(?:^|\\s)${escaped}=([^\\s]+)`));
  return match ? match[1] : null;
}

function formatMarkers(markers) {
  return [
    `    [app-entry] App.tsx module loaded:    ${markers.appEntry ? 'yes' : 'NO'}`,
    `    bootstrap flag runtime:              ${markers.bootstrapSignalVisible ? 'coach-bike-flow' : 'missing/unknown'}`,
    `    [smoke-bootstrap] installer imported:   ${markers.installerImported ? 'yes' : 'NO'}`,
    `    [smoke-bootstrap] installer mounted:    ${markers.installerMounted ? 'yes' : 'NO'}`,
    `    [smoke-bootstrap] listener attached:    ${markers.listenerAttached ? 'yes' : 'NO'}`,
    `    [smoke-bootstrap] url received:         ${markers.urlReceived ? 'yes' : 'NO'}`,
    `    [smoke-bootstrap] env flag detected:    ${markers.envFlagDetected ? 'yes' : 'NO'}`,
    `    [smoke-bootstrap] file flag detected:   ${markers.fileFlagDetected ? 'yes' : 'NO'}`,
    `    [smoke-bootstrap] started:              ${markers.bootstrapStarted ? 'yes' : 'NO'}`,
    `    [smoke-bootstrap] profile seeded:       ${markers.bootstrapProfileSeeded ? 'yes' : 'NO'}`,
    `    [smoke-bootstrap] program installed:    ${markers.bootstrapProgramInstalled ? 'yes' : 'NO'}`,
    `    [smoke-bootstrap] onboarding complete:  ${markers.bootstrapOnboardingComplete ? 'yes' : 'NO'}`,
    `    [smoke-bootstrap] initialRoute=Coach:   ${markers.initialRouteCoach ? 'yes' : 'NO'}`,
    `    [app-navigator] smokeInitialRoute raw:  ${markers.appNavigatorRouteRaw ? 'yes' : 'NO'}`,
    `    [app-navigator] tabs pending (gate):    ${markers.appNavigatorTabsPending ? 'yes' : 'no'}`,
    `    [app-navigator] initialRouteName=CoachTab: ${markers.appNavigatorInitialRouteCoachTab ? 'yes' : 'NO'}`,
    `    [app-navigator] smoke-bootstrap-complete:   ${markers.appNavigatorBootstrapComplete ? 'yes' : 'NO'}`,
    `    [app-navigator] smoke-bootstrap-route-ready: ${markers.appNavigatorRouteReady ? 'yes' : 'NO'}`,
    `    [navigation-container] onReady:              ${markers.navigationContainerReady ? 'yes' : 'NO'}`,
    `    [smoke-route-enforcer] gate ready:           ${markers.routeEnforcerGateReady ? 'yes' : 'NO'}`,
    `    [smoke-route-enforcer] navigation ready:     ${markers.routeEnforcerReady ? 'yes' : 'NO'}`,
    `    [smoke-route-enforcer] requested CoachTab:   ${markers.routeEnforcerRequested ? 'yes' : 'no (already on Coach?)'}`,
    `    [smoke-route-enforcer] navigated CoachTab:   ${markers.routeEnforcerNavigated ? 'yes' : 'no'}`,
    `    [smoke-route-enforcer] already on Coach:     ${markers.routeEnforcerAlreadyCoach ? 'yes' : 'no'}`,
    `    [smoke-route-enforcer] dispatch failed:      ${markers.routeEnforcerDispatchFailed ? 'YES (bug)' : 'no'}`,
    `    [smoke-route-enforcer] never ready:          ${markers.routeEnforcerNeverReady ? 'YES (bug)' : 'no'}`,
    `    [smoke-route-error] intent!=actual observed: ${markers.routeMismatchObserved ? 'YES (mismatch — see smoke-route-mismatch marker)' : 'no'}`,
    `    [nav-route] currentRoute=Coach:         ${markers.navRouteCoach ? 'yes' : 'NO'}`,
    `    [nav-route] currentRoute=DayWorkout:    ${markers.navRouteDayWorkout ? 'yes' : 'no'}`,
    `    [nav-route] currentRoute=<anything>:    ${markers.navRouteAny ? 'yes' : 'NO (NavigationContainer.onStateChange never resolved a leaf)'}`,
    `    [navigation-state] isOnboardingComplete:${markers.isOnboardingTrue ? ' true' : ' NOT true'}`,
    `    [tabs-mounted] true:                    ${markers.tabsMounted ? 'yes' : 'NO'}`,
    `    [smoke-bootstrap] wednesday-seeded Easy Aerobic Flush: ${markers.bootstrapLogScannable ? (markers.smokeBootstrapWednesdaySeeded ? 'yes' : 'no') : 'unknown (no [smoke-bootstrap] runtime logs captured)'}`,
    `    [smoke-visible-week] state=inactive (logs):  ${markers.smokeVisibleWeekInactive ? 'YES (harness bug — flow signal disagrees)' : 'no'}`,
    `    [smoke-visible-week] state=pending (logs):   ${markers.smokeVisibleWeekPending ? 'YES (data still hydrating)' : 'no'}`,
    `    [smoke-visible-week] state=ready (logs):     ${markers.smokeVisibleWeekReady ? 'yes' : 'NO'}`,
    `    [smoke-visible-week] state=missing (logs):   ${markers.smokeVisibleWeekMissing ? 'YES (live week did not match fixture)' : 'no'}`,
    `    [smoke-visible-week] reason=no-active-route-yet:      ${markers.smokeVisibleWeekPendingNoActiveRouteYet ? 'YES (pending — nav not converged)' : 'no'}`,
    `    [smoke-visible-week] reason=no-resolved-week-yet:     ${markers.smokeVisibleWeekPendingNoResolvedWeekYet ? 'YES (pending — hydrating)' : 'no'}`,
    `    [smoke-visible-week] reason=route-not-coach:          ${markers.smokeVisibleWeekMissingRouteNotCoach ? 'YES (current route is not Coach)' : 'no'}`,
    `    [smoke-visible-week] reason=no-resolved-week:         ${markers.smokeVisibleWeekMissingNoResolvedWeek ? 'YES' : 'no'}`,
    `    [smoke-visible-week] reason=no-wednesday-day:         ${markers.smokeVisibleWeekMissingNoWednesday ? 'YES' : 'no'}`,
    `    [smoke-visible-week] reason=wednesday-has-no-workout: ${markers.smokeVisibleWeekMissingWednesdayHasNoWorkout ? 'YES' : 'no'}`,
    `    [smoke-visible-week] reason=wednesday-not-easy-aerobic-flush: ${markers.smokeVisibleWeekMissingNotEasyAerobicFlush ? 'YES' : 'no'}`,
    `    [smoke-visible-week] reason=no-rower-before-change:   ${markers.smokeVisibleWeekMissingNoRower ? 'YES' : 'no'}`,
    `    [smoke-dayworkout-contract] state=ready (logs):  ${markers.smokeDayWorkoutContractReady ? 'yes' : 'NO'}`,
    `    [smoke-dayworkout-contract] state=failed (logs): ${markers.smokeDayWorkoutContractFailed ? 'YES' : 'no'}`,
    `    [smoke-flag] generated flag still set before Maestro: ${markers.smokeFlagStillSetBeforeMaestro ? 'yes' : 'NO'}`,
    `    [smoke-flag] generated flag reset after Maestro:      ${markers.smokeFlagResetAfterMaestro ? 'yes' : 'no (still running)'}`,
  ].join('\n');
}

async function waitForMarkerSet(capture, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const markers = smokeMarkersFromText(capture.text());
    if (predicate(markers)) return markers;
    await sleep(250);
  }
  return smokeMarkersFromText(capture.text());
}

async function preflightRuntimeInstaller(deviceId, capture) {
  header('Phase 2: smoke bootstrap/setup - runtime JS installer');
  info('Launching app once before Maestro to prove the JS bundle imports the smoke installer.');

  spawnSync('xcrun', ['simctl', 'terminate', deviceId, APP_ID], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  await sleep(500);

  const launched = spawnSync('xcrun', ['simctl', 'launch', deviceId, APP_ID], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (launched.status !== 0) {
    fail(
      'Smoke bootstrap/setup failed.',
      [
        `Could not launch ${APP_ID} for runtime preflight.`,
        `stdout: ${launched.stdout || '(empty)'}`,
        `stderr: ${launched.stderr || '(empty)'}`,
      ].join('\n'),
    );
  }

  const markers = await waitForMarkerSet(
    capture,
    (m) => m.appEntry && m.installerImported && m.installerMounted && m.listenerAttached,
    20_000,
  );

  if (!markers.appEntry) {
    fail(
      'App runtime logs were not captured, or simulator connected to a different Metro bundle.',
      [
        'The runtime preflight launched the app but did not observe:',
        '  [app-entry] App.tsx module loaded',
        '',
        'This means installer absence is not proven. Confirm the simulator is connected to the Metro server for this checkout.',
        '',
        'Observed markers:',
        formatMarkers(markers),
        '',
        failureArtifactDump({
          maestroText: '',
          simulatorText: capture.text(),
          stepStatuses: {},
        }),
      ].join('\n'),
    );
  }

  if (!markers.installerImported) {
    fail(
      'App.tsx loaded but smokeBootstrapInstaller was not imported.',
      [
        'App.tsx executed, but the installer import marker did not appear.',
        '',
        'Observed markers:',
        formatMarkers(markers),
      ].join('\n'),
    );
  }

  if (!markers.installerImported || !markers.installerMounted || !markers.listenerAttached) {
    fail(
      'App.tsx loaded but smoke bootstrap listener was not attached.',
      [
        'The installer module imported, but installSmokeBootstrapListener did not complete.',
        '',
        'Expected runtime markers before any smoke URL:',
        '  [smoke-bootstrap] installer imported',
        '  [smoke-bootstrap] installer mounted',
        '  [smoke-bootstrap] addEventListener("url") attached',
        '',
        'Observed markers:',
        formatMarkers(markers),
        '',
        failureArtifactDump({
          maestroText: '',
          simulatorText: capture.text(),
          stepStatuses: {},
        }),
      ].join('\n'),
    );
  }

  ok('Runtime JS installer markers observed before Maestro.');
  console.log(formatMarkers(markers));
}

function latestMaestroArtifactFolder() {
  const testsDir = path.join(os.homedir(), '.maestro', 'tests');
  try {
    const entries = fs
      .readdirSync(testsDir)
      .map((name) => path.join(testsDir, name))
      .filter((entry) => fs.statSync(entry).isDirectory())
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return entries[0] || '';
  } catch {
    return '';
  }
}

function findLatestPng(dir) {
  if (!dir || !fs.existsSync(dir)) return '';
  const found = [];
  const visit = (entry) => {
    const stat = fs.statSync(entry);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(entry)) visit(path.join(entry, child));
    } else if (/\.png$/i.test(entry)) {
      found.push({ entry, mtimeMs: stat.mtimeMs });
    }
  };
  try {
    visit(dir);
  } catch {
    return '';
  }
  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return found[0]?.entry || '';
}

function latestScreenshotPath() {
  const local = path.join(ARTIFACT_DIR, 'coach-bike-flow-wed.png');
  if (fs.existsSync(local)) return local;
  return findLatestPng(latestMaestroArtifactFolder());
}

function relevantLogLines(text) {
  const re = new RegExp(RELEVANT_LOG_TERMS.join('|'), 'i');
  return text
    .split(/\r?\n/)
    .filter((line) => re.test(line))
    .slice(-100);
}

function inferAppSurface(markers, stepStatuses, text) {
  if (stepStatuses.titleStatus === 'COMPLETED') return 'DayWorkout';
  if (
    stepStatuses.dayRowStatus === 'COMPLETED' ||
    stepStatuses.viewWorkoutStatus === 'FAILED'
  ) {
    return 'Program';
  }
  if (
    stepStatuses.coachReadyStatus === 'COMPLETED' ||
    stepStatuses.routeCoachStatus === 'COMPLETED' ||
    stepStatuses.coachScreenRootStatus === 'COMPLETED' ||
    stepStatuses.coachInputStatus === 'COMPLETED' ||
    stepStatuses.coachSendStatus === 'COMPLETED'
  ) {
    return 'Coach';
  }
  if (stepStatuses.mainTabsStatus === 'COMPLETED' || markers.tabsMounted) {
    return 'Main Tabs';
  }
  if (/Welcome|onboarding/i.test(text) && !markers.tabsMounted) return 'Welcome';
  return 'unknown';
}

function failureArtifactDump({ maestroText, simulatorText, stepStatuses }) {
  const combined = `${maestroText || ''}\n${simulatorText || ''}`;
  const markers = smokeMarkersFromText(combined);
  const latestFolder = latestMaestroArtifactFolder();
  const screenshot = latestScreenshotPath();
  const surface = inferAppSurface(markers, stepStatuses || {}, combined);
  const relevant = relevantLogLines(combined);
  const tabPressCoach = /\[tab-press\] coach/.test(combined);
  const navRouteCoach = /\[nav-route\] currentRoute=Coach/.test(combined);
  const coachScreenMounted = /\[coach-screen\] mounted/.test(combined);
  const coachReadyRendered = /\[coach-ready\] rendered/.test(combined);

  return [
    'Debug artifacts:',
    `  latest Maestro artifact folder: ${latestFolder || '(not found)'}`,
    `  latest screenshot path:         ${screenshot || '(not found)'}`,
    `  detected app surface:           ${surface}`,
    '  tab navigation markers:',
    `    [tab-press] coach:             ${tabPressCoach ? 'yes' : 'NO'}`,
    `    [nav-route] currentRoute=Coach:${navRouteCoach ? ' yes' : ' NO'}`,
    `    [coach-screen] mounted:        ${coachScreenMounted ? 'yes' : 'NO'}`,
    `    [coach-ready] rendered:        ${coachReadyRendered ? 'yes' : 'NO'}`,
    '  smoke-bootstrap markers:',
    formatMarkers(markers),
    '  last 100 relevant log lines:',
    relevant.length ? relevant.map((line) => `    ${line}`).join('\n') : '    (none captured)',
  ].join('\n');
}

function runMaestroProcess(deviceId) {
  return new Promise((resolve) => {
    const maestroBin = which('maestro') || 'maestro';
    const child = spawn(
      maestroBin,
      ['--device', deviceId, '--no-ansi', 'test', MAESTRO_FLOW],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

function stepStatusFromText(text, id) {
  const lines = text.split(/\r?\n/);
  let last = null;
  for (const line of lines) {
    if (
      line.includes(`id: ${id}`) ||
      line.includes(`id: "${id}"`) ||
      line.includes(`id "${id}"`)
    ) {
      if (/COMPLETED/i.test(line)) last = 'COMPLETED';
      else if (/FAILED/i.test(line)) last = 'FAILED';
    }
  }
  return last;
}

/**
 * Distinguishes whether a marker was actually visible during the
 * Maestro run, by looking at what assertion was applied to it AND
 * whether that assertion passed.
 *
 * Maestro step semantics:
 *   • `assertNotVisible id: X` + COMPLETED → marker was NOT visible (pass)
 *   • `assertNotVisible id: X` + FAILED    → marker WAS visible (fail)
 *   • `extendedWaitUntil visible.id: X` / `assertVisible id: X` +
 *                                COMPLETED → marker WAS visible (pass)
 *   • `extendedWaitUntil`/`assertVisible` + FAILED → marker NOT visible
 *   • marker not present in step trace → 'unknown'
 *
 * The wrapper previously called any COMPLETED step "visible" — which
 * inverted the meaning for assertNotVisible. The user's review caught
 * this: `smoke-visible-week-missing: COMPLETED` was the smoke PASSING
 * (missing marker not rendered), not the smoke failing.
 *
 * Returns { status, visible } where visible ∈ {'yes','no','unknown'}.
 */
function stepVisibilityFromText(text, id) {
  const lines = text.split(/\r?\n/);
  let status = null;
  let visible = 'unknown';
  // Track assertion type we last saw for this id. Maestro typically
  // prints a single line per step that includes both the assertion verb
  // (e.g. "Assert not visible", "Wait for", "Assert visible") and the
  // id. The verb varies by Maestro version so we use heuristic regex.
  for (const line of lines) {
    const mentionsId =
      line.includes(`id: ${id}`) ||
      line.includes(`id: "${id}"`) ||
      line.includes(`id "${id}"`);
    if (!mentionsId) continue;
    const isAssertNotVisible = /assert\s+not\s+visible|assertNotVisible|is\s+not\s+visible|not\s+visible|not\s+to\s+be\s+visible|to\s+not\s+be\s+visible/i.test(
      line,
    );
    const completed = /COMPLETED/i.test(line);
    const failed = /FAILED/i.test(line);
    if (completed) status = 'COMPLETED';
    else if (failed) status = 'FAILED';
    if (completed) {
      visible = isAssertNotVisible ? 'no' : 'yes';
    } else if (failed) {
      visible = isAssertNotVisible ? 'yes' : 'no';
    }
  }
  return { status, visible };
}

function allStepStatuses(maestroText) {
  return {
    smokeRuntimeReadyStatus: stepStatusFromText(maestroText, 'smoke-runtime-ready'),
    smokeBootstrapCompleteStatus: stepStatusFromText(
      maestroText,
      'smoke-bootstrap-complete',
    ),
    smokeNavReadyStatus: stepStatusFromText(maestroText, 'smoke-nav-ready'),
    smokeRouteIntentCoachStatus: stepStatusFromText(
      maestroText,
      'smoke-route-intent-Coach',
    ),
    smokeRouteCurrentCoachStatus: stepStatusFromText(
      maestroText,
      'smoke-route-current-Coach',
    ),
    smokeBootstrapRouteReadyStatus: stepStatusFromText(
      maestroText,
      'smoke-bootstrap-route-ready',
    ),
    smokeRouteMismatchStatus: stepStatusFromText(
      maestroText,
      'smoke-route-mismatch',
    ),
    // smoke-route-mismatch is asserted via assertNotVisible. COMPLETED
    // therefore means the marker was NOT visible (pass). The wrapper
    // historically reported COMPLETED-as-visible — this Visibility
    // companion provides the correct boolean.
    smokeRouteMismatchVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-route-mismatch',
    ),
    // Build fingerprint + harness-mounted + direct App visible-week debug
    // markers — checked first by the wrapper, in this exact order:
    //   • smoke-build-fingerprint  → App.tsx-owned proves bundle is
    //                                current; if missing the bundle is
    //                                stale.
    //   • smoke-harness-mounted    → App.tsx-owned proves the smoke
    //                                marker fragment executed.
    //   • smoke-visible-week-debug → App.tsx-owned direct marker with
    //                                state/reason/route/week/error.
    smokeBuildFingerprintVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-build-fingerprint',
    ),
    smokeHarnessMountedVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-harness-mounted',
    ),
    rootNavigatorLiveVisibility: stepVisibilityFromText(
      maestroText,
      'root-navigator-live',
    ),
    appNavigatorLiveVisibility: stepVisibilityFromText(
      maestroText,
      'app-navigator-live',
    ),
    smokeCoachReadyStatus: stepStatusFromText(maestroText, 'smoke-coach-ready'),
    smokeTabsPendingRootStatus: stepStatusFromText(
      maestroText,
      'smoke-tabs-pending-root',
    ),
    mainTabsStatus: stepStatusFromText(maestroText, 'main-tabs-root'),
    tabCoachStatus: stepStatusFromText(maestroText, 'tab-coach'),
    routeCoachStatus: stepStatusFromText(maestroText, 'route-current-Coach'),
    coachReadyStatus: stepStatusFromText(maestroText, 'coach-ready'),
    coachScreenRootStatus: stepStatusFromText(maestroText, 'coach-screen-root'),
    coachInputStatus: stepStatusFromText(maestroText, 'coach-input'),
    coachSendStatus: stepStatusFromText(maestroText, 'coach-send-button'),
    smokePrecoachWeekReadyStatus: stepStatusFromText(
      maestroText,
      'smoke-precoach-week-ready',
    ),
    smokeVisibleWeekReadyStatus: stepStatusFromText(
      maestroText,
      'smoke-precoach-week-ready',
    ),
    smokeVisibleWeekMissingStatus: stepStatusFromText(
      maestroText,
      'smoke-visible-week-missing',
    ),
    smokeVisibleWeekPendingStatus: stepStatusFromText(
      maestroText,
      'smoke-visible-week-pending',
    ),
    smokeVisibleWeekInactiveStatus: stepStatusFromText(
      maestroText,
      'smoke-visible-week-inactive',
    ),
    smokePrecoachWeekReadyVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-precoach-week-ready',
    ),
    smokeVisibleWeekReadyVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-precoach-week-ready',
    ),
    smokeVisibleWeekMissingVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-visible-week-missing',
    ),
    smokeVisibleWeekPendingVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-visible-week-pending',
    ),
    smokeVisibleWeekInactiveVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-visible-week-inactive',
    ),
    smokeVisibleWeekDebugVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-visible-week-debug',
    ),
    smokeWednesdayReadyStatus: stepStatusFromText(
      maestroText,
      'smoke-wednesday-workout-ready',
    ),
    smokeWednesdayReadyVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-wednesday-workout-ready',
    ),
    smokeWednesdayMissingStatus: stepStatusFromText(
      maestroText,
      'smoke-wednesday-workout-missing',
    ),
    smokeWednesdayMissingVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-wednesday-workout-missing',
    ),
    smokeOpenWednesdayStatus: stepStatusFromText(
      maestroText,
      'smoke-open-wednesday-workout',
    ),
    smokeOpenWednesdayVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-open-wednesday-workout',
    ),
    dayRowStatus: stepStatusFromText(maestroText, 'day-row-wed'),
    viewWorkoutStatus: stepStatusFromText(maestroText, 'view-workout-button'),
    titleStatus: stepStatusFromText(maestroText, 'day-workout-title'),
    dayWorkoutContractReadyStatus: stepStatusFromText(
      maestroText,
      'smoke-dayworkout-contract-ready',
    ),
    dayWorkoutContractReadyVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-dayworkout-contract-ready',
    ),
    dayWorkoutContractFailedStatus: stepStatusFromText(
      maestroText,
      'smoke-dayworkout-contract-failed',
    ),
    dayWorkoutContractFailedVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-dayworkout-contract-failed',
    ),
    // Mount probe — proves the marker render path was reached. Spec
    // requires "DayWorkout mounted but contract marker mount point
    // missing." when this is absent while day-workout-title is visible.
    dayWorkoutContractMountedStatus: stepStatusFromText(
      maestroText,
      'smoke-dayworkout-contract-mounted',
    ),
    dayWorkoutContractMountedVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-dayworkout-contract-mounted',
    ),
    // Live Coach target-binding contract — rendered by CoachScreen's
    // FORBIDDEN_CLARIFIER_RE detector when the latest assistant reply
    // contains a "Which session…?" / "I can't see…" clarifier string.
    // Three `assertNotVisible: smoke-coach-unexpected-clarifier` steps
    // run in the YAML (one after each coach turn); status FAILED means
    // the marker was visible at that step (clarifier leaked).
    smokeCoachUnexpectedClarifierStatus: stepStatusFromText(
      maestroText,
      'smoke-coach-unexpected-clarifier',
    ),
    smokeCoachUnexpectedClarifierVisibility: stepVisibilityFromText(
      maestroText,
      'smoke-coach-unexpected-clarifier',
    ),
  };
}

function maestroFlowUsedClearState() {
  try {
    const yaml = fs.readFileSync(MAESTRO_FLOW, 'utf8');
    return /launchApp:[\s\S]{0,200}clearState:\s*true/.test(yaml);
  } catch {
    return null;
  }
}

function generatedSmokeFlagActive() {
  try {
    const flagSource = fs.readFileSync(
      path.join(ROOT, 'src', 'generated', 'smokeBootstrapFlag.ts'),
      'utf8',
    );
    return /SMOKE_BOOTSTRAP_FLOW[^\n]*['"]coach-bike-flow['"]/.test(flagSource);
  } catch {
    return null;
  }
}

function leakedForbiddenToken(text) {
  const forbiddenTokens = [
    'Assault Bike Intervals',
    '[Swapped to bike]',
    'Rowing',
    'Rower',
    'Assault',
  ];
  for (const token of forbiddenTokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `assert not visible[^\\n]*${escaped}|element .*${escaped}|${escaped}[^\\n]*(visible|appeared)`,
      'i',
    );
    if (re.test(text)) return token;
  }
  return null;
}

function diagnoseMaestroFailure({ maestroText, simulatorText, stepStatuses }) {
  const combined = `${maestroText}\n${simulatorText}`;
  const markers = smokeMarkersFromText(combined);
  const openLinkAttempted =
    /(?:openLink|Open(?:ing)?(?:\s+link)?|openurl)[^\n]*localfootyathlete:\/\/smoke/i.test(
      maestroText,
    );
  const schemeRejected =
    /LSApplicationWorkspaceErrorDomain|error\s*115|failed to open[^\n]*localfootyathlete/i.test(
      combined,
    );
  const leakedToken = leakedForbiddenToken(combined);
  const javaMissing = /Unable to locate a Java Runtime|No Java runtime present/i.test(
    combined,
  );
  const appSmokeOverlayDebugLabel = lastAppSmokeOverlayDebugLabel(combined);
  const appSmokeOverlayDebugState = appSmokeOverlayDebugField(
    appSmokeOverlayDebugLabel,
    'state',
  );
  const appSmokeOverlayDebugReason = appSmokeOverlayDebugField(
    appSmokeOverlayDebugLabel,
    'reason',
  );
  const dayWorkoutContractLabel = lastDayWorkoutContractLabel(combined);
  const dayWorkoutContractState = appSmokeOverlayDebugField(
    dayWorkoutContractLabel,
    'state',
  );

  let label = 'Coach UI flow failed.';
  let detail = 'Step-aware diagnosis could not pinpoint the failed UI step.';

  const setupReachedMainTabs = stepStatuses.mainTabsStatus === 'COMPLETED';
  const precoachReadyPassed =
    stepStatuses.smokePrecoachWeekReadyStatus === 'COMPLETED' ||
    stepStatuses.smokePrecoachWeekReadyVisibility?.visible === 'yes';
  const coachLabelTextMissing =
    /Element not found:\s*Text matching regex:\s*Coach/i.test(combined) ||
    /Tap on\s+"Coach"[\s\S]{0,300}FAILED/i.test(combined);

  // ─── State-machine contradictions (highest-priority diagnostics) ────
  //
  // The state machine in src/navigation/smokeNavState.ts makes route
  // readiness derivable from a single source of truth. If Maestro
  // reports a route-ready marker passing while route-current-Coach
  // fails, the harness is internally inconsistent and any further
  // diagnosis would be guesswork. The four labels below are the
  // user-required contradiction reports.

  // 1. INTERNAL HARNESS CONTRADICTION — smoke-bootstrap-route-ready or
  //    the legacy route-current-Coach passed while
  //    smoke-route-current-Coach (the canonical root-state marker)
  //    failed.
  const internalHarnessContradiction =
    (stepStatuses.smokeBootstrapRouteReadyStatus === 'COMPLETED' &&
      stepStatuses.smokeRouteCurrentCoachStatus === 'FAILED') ||
    (stepStatuses.smokeBootstrapRouteReadyStatus === 'COMPLETED' &&
      stepStatuses.routeCoachStatus === 'FAILED' &&
      stepStatuses.smokeRouteCurrentCoachStatus !== 'COMPLETED');

  // 2. Smoke route enforcer failed — the gate fired (or the
  //    smoke-route-mismatch marker was visible) but the actual route
  //    never converged on Coach.
  const enforcerFailed =
    (stepStatuses.smokeRouteMismatchStatus === 'COMPLETED' ||
      markers.routeMismatchObserved ||
      markers.routeEnforcerDispatchFailed) &&
    stepStatuses.smokeRouteCurrentCoachStatus !== 'COMPLETED';

  // 3. NavigationContainer never became ready. The state machine gate
  //    cannot open until navReady=true. If smoke-nav-ready never went
  //    visible AND the [navigation-container] onReady log never landed,
  //    the container itself never mounted to the ready state.
  const navContainerNeverReady =
    stepStatuses.smokeNavReadyStatus === 'FAILED' &&
    !markers.navigationContainerReady;

  // 4. Reset/navigate dispatched but didn't take effect. The enforcer
  //    logged that it requested CoachTab but the actual route never
  //    flipped to Coach.
  const resetDidNotTake =
    (markers.routeEnforcerNavigated || markers.routeEnforcerRequested) &&
    stepStatuses.smokeRouteCurrentCoachStatus !== 'COMPLETED' &&
    !markers.navRouteCoach;

  // Twin (legacy): smoke-route-current-Coach passed but the dev-only
  // route-current-Coach step failed. This is now informational — the
  // canonical readiness signal in env mode is smoke-route-current-Coach.
  const smokeCurrentVisibleButDevMissing =
    stepStatuses.smokeRouteCurrentCoachStatus === 'COMPLETED' &&
    stepStatuses.routeCoachStatus === 'FAILED';

  if (javaMissing) {
    label = 'Smoke bootstrap/setup failed: Maestro could not start because Java Runtime is missing.';
    detail =
      'Maestro was found, but its launcher exited before running the flow because macOS could not locate Java.';
  } else if (internalHarnessContradiction) {
    label =
      'INTERNAL HARNESS CONTRADICTION: route-ready visible while actual route is not Coach.';
    detail = [
      'The state machine in src/navigation/smokeNavState.ts requires that smoke-bootstrap-route-ready',
      'render ONLY when actualCurrentRoute === Coach AND routeIntent === Coach.',
      '',
      'Maestro reported route-ready as COMPLETED, but the canonical leaf-route marker',
      'smoke-route-current-Coach is FAILED. The state machine is not the source of truth in the running bundle —',
      'either a stale build is running on the simulator, or the AppNavigator was edited to derive',
      'smoke-bootstrap-route-ready from something other than snapshot.actualCurrentRoute.',
      '',
      `  smoke-bootstrap-route-ready  step status: ${stepStatuses.smokeBootstrapRouteReadyStatus ?? '-'}`,
      `  smoke-route-current-Coach    step status: ${stepStatuses.smokeRouteCurrentCoachStatus ?? '-'}`,
      `  smoke-route-mismatch         step status: ${stepStatuses.smokeRouteMismatchStatus ?? '-'}`,
      `  route-current-Coach (legacy) step status: ${stepStatuses.routeCoachStatus ?? '-'}`,
      `  [nav-route] currentRoute=Coach observed: ${markers.navRouteCoach ? 'yes' : 'NO'}`,
      `  [nav-route] currentRoute=<any> observed: ${markers.navRouteAny ? 'yes' : 'NO'}`,
    ].join('\n');
  } else if (enforcerFailed) {
    const observedActual = markers.navRouteProgram
      ? 'Program'
      : markers.navRouteAny
        ? '(non-Coach leaf)'
        : 'unknown';
    label = `Smoke route enforcer failed: intended Coach, actual ${observedActual}.`;
    detail = [
      'SmokeRouteEnforcer dispatched CommonActions.reset to CoachTab (or smoke-route-mismatch went visible),',
      'but the NavigationContainer.onStateChange leaf never converged on Coach.',
      '',
      `  [smoke-route-enforcer] gate ready:           ${markers.routeEnforcerGateReady ? 'yes' : 'NO'}`,
      `  [smoke-route-enforcer] navigation ready:     ${markers.routeEnforcerReady ? 'yes' : 'NO'}`,
      `  [smoke-route-enforcer] requested CoachTab:   ${markers.routeEnforcerRequested ? 'yes' : 'no'}`,
      `  [smoke-route-enforcer] navigated CoachTab:   ${markers.routeEnforcerNavigated ? 'yes' : 'no'}`,
      `  [smoke-route-enforcer] dispatch failed:      ${markers.routeEnforcerDispatchFailed ? 'YES' : 'no'}`,
      `  [smoke-route-error] intent!=actual observed: ${markers.routeMismatchObserved ? 'YES' : 'no'}`,
      `  smoke-route-mismatch step status:            ${stepStatuses.smokeRouteMismatchStatus ?? '-'}`,
      `  smoke-route-current-Coach step status:       ${stepStatuses.smokeRouteCurrentCoachStatus ?? '-'}`,
      `  [nav-route] currentRoute=Program observed:   ${markers.navRouteProgram ? 'yes' : 'no'}`,
      `  [nav-route] currentRoute=Coach observed:     ${markers.navRouteCoach ? 'yes' : 'NO'}`,
    ].join('\n');
  } else if (navContainerNeverReady) {
    label = 'NavigationContainer did not become ready.';
    detail = [
      'The state machine never observed setNavReady(true), and no [navigation-container] onReady',
      'log appeared in the simulator logs. Without navReady the SmokeRouteEnforcer gate cannot open,',
      'so no reset to CoachTab can fire.',
      '',
      'Common causes:',
      '  - RootNavigator did not mount NavigationContainer (rendered a Loading splash instead).',
      '  - The bundle running on the simulator predates the onReady wiring in src/navigation/RootNavigator.tsx.',
      '  - useInitializeApp never resolved isReady, so RootNavigator stayed on the Loading branch.',
      '',
      `  smoke-runtime-ready     step status:        ${stepStatuses.smokeRuntimeReadyStatus ?? '-'}`,
      `  smoke-bootstrap-complete step status:       ${stepStatuses.smokeBootstrapCompleteStatus ?? '-'}`,
      `  smoke-nav-ready         step status:        ${stepStatuses.smokeNavReadyStatus ?? '-'}`,
      `  [navigation-container] onReady observed:    ${markers.navigationContainerReady ? 'yes' : 'NO'}`,
      `  [navigation-state] isOnboardingComplete observed: ${markers.isOnboardingTrue ? 'true' : 'NOT true'}`,
    ].join('\n');
  } else if (resetDidNotTake) {
    const observedActual = markers.navRouteProgram
      ? 'Program'
      : markers.navRouteAny
        ? '(non-Coach leaf)'
        : 'unknown';
    label = 'Navigation reset/navigate to Coach did not take effect.';
    detail = [
      'SmokeRouteEnforcer dispatched the reset (logged "navigated CoachTab") but the',
      'NavigationContainer.onStateChange leaf never converged on Coach.',
      '',
      `  Observed leaf after dispatch:               ${observedActual}`,
      `  [smoke-route-enforcer] requested CoachTab:  ${markers.routeEnforcerRequested ? 'yes' : 'no'}`,
      `  [smoke-route-enforcer] navigated CoachTab:  ${markers.routeEnforcerNavigated ? 'yes' : 'no'}`,
      `  [smoke-route-enforcer] dispatch failed:     ${markers.routeEnforcerDispatchFailed ? 'YES (bug)' : 'no'}`,
      `  [nav-route] currentRoute=Coach observed:    ${markers.navRouteCoach ? 'yes' : 'NO'}`,
      `  [nav-route] currentRoute=Program observed:  ${markers.navRouteProgram ? 'yes' : 'no'}`,
      `  smoke-route-current-Coach step status:      ${stepStatuses.smokeRouteCurrentCoachStatus ?? '-'}`,
      '',
      'Likely causes:',
      '  - CommonActions.reset routed to a tab name that does not match the registered Tab.Screen name.',
      '  - The reset fired against a stale navigationRef (the container remounted after dispatch).',
      '  - A higher-priority navigator override re-routed away from CoachTab synchronously.',
    ].join('\n');
  } else if (smokeCurrentVisibleButDevMissing) {
    label = 'Route-ready marker is inconsistent with actual route state.';
    detail = [
      'smoke-route-current-Coach passed BUT route-current-Coach (dev-only) failed.',
      'route-current-${currentRoute} is __DEV__-only — this can happen in a non-dev build, but the smoke pipeline expects __DEV__=true.',
      '',
      `  smoke-route-current-Coach step status: ${stepStatuses.smokeRouteCurrentCoachStatus ?? '-'}`,
      `  route-current-Coach       step status: ${stepStatuses.routeCoachStatus ?? '-'}`,
    ].join('\n');
  } else if (!USE_ENV_BOOTSTRAP && schemeRejected) {
    label = 'Native URL scheme missing. Rebuild native app.';
    detail = [
      `Maestro reached openLink, but iOS could not open ${SMOKE_BOOTSTRAP_URL}. Rebuild the native app.`,
      'iOS rejected scheme (LSAppWorkspace 115): YES',
    ].join('\n');
  } else if (setupReachedMainTabs && coachLabelTextMissing) {
    label = 'Coach tab label text is not exposed to Maestro; use id: tab-coach.';
    detail =
      'Maestro proved the native tab testID was visible, but the visible "Coach" label text was not exposed as a tappable element.';
  } else if (
    setupReachedMainTabs &&
    stepStatuses.routeCoachStatus === 'FAILED' &&
    !markers.appNavigatorRouteReady &&
    stepStatuses.smokeBootstrapRouteReadyStatus !== 'COMPLETED'
  ) {
    // Most diagnostic case: main-tabs-root passed but neither the
    // smoke-bootstrap-route-ready marker nor the route-current-Coach
    // step reached COMPLETED. This is exactly the symptom of Maestro
    // having relaunched the app (clearState/stopApp) AFTER the wrapper
    // already bootstrapped — the second launch never completed
    // bootstrap before main-tabs-root from the pending shell was
    // (mistakenly) accepted.
    const yamlClear = maestroFlowUsedClearState();
    const flagStillSet = generatedSmokeFlagActive();
    label =
      'Main tabs mounted before smoke route resolved, or Maestro relaunched without bootstrap route.';
    detail = [
      'Maestro saw main-tabs-root, but smoke-bootstrap-route-ready never appeared and route-current-Coach failed.',
      `  Maestro flow used launchApp clearState: true:           ${yamlClear === null ? 'unknown' : yamlClear ? 'YES (likely cause — wipes wrapper-seeded state)' : 'no'}`,
      `  generated SMOKE_BOOTSTRAP_FLOW still set at Maestro start: ${flagStillSet === null ? 'unknown' : flagStillSet ? 'yes' : 'NO (wrapper reset before Maestro!)'}`,
      `  smoke-bootstrap-route-ready step status:                  ${stepStatuses.smokeBootstrapRouteReadyStatus ?? '-'}`,
      `  smoke-tabs-pending-root step status:                      ${stepStatuses.smokeTabsPendingRootStatus ?? '-'}`,
      `  [smoke-bootstrap] initialRoute=Coach observed:            ${markers.initialRouteCoach ? 'yes' : 'NO'}`,
      `  [app-navigator] smokeInitialRoute raw=… observed:         ${markers.appNavigatorRouteRaw ? 'yes' : 'NO'}`,
      `  [app-navigator] tabs not mounted yet (ready gate):        ${markers.appNavigatorTabsPending ? 'yes (smoke route still null when AppNavigator first mounted)' : 'no'}`,
      `  [app-navigator] initialRouteName=CoachTab observed:       ${markers.appNavigatorInitialRouteCoachTab ? 'yes' : 'NO'}`,
      `  [app-navigator] smoke-bootstrap-route-ready observed:     ${markers.appNavigatorRouteReady ? 'yes' : 'NO'}`,
      `  [nav-route] currentRoute=Coach observed:                  ${markers.navRouteCoach ? 'yes' : 'NO'}`,
      '',
      'If launchApp clearState: true is YES and the wrapper already bootstrapped before Maestro, the second launch wipes the wrapper-seeded state. Remove clearState: true from the env Maestro flow so Maestro attaches to the already-bootstrapped app.',
    ].join('\n');
  } else if (setupReachedMainTabs && stepStatuses.routeCoachStatus === 'FAILED') {
    label = 'Smoke bootstrap mounted main tabs but did not select Coach route.';
    detail = [
      'Maestro saw main-tabs-root, but the route-current-Coach testID never became visible.',
      `  [smoke-bootstrap] initialRoute=Coach observed:        ${markers.initialRouteCoach ? 'yes' : 'NO'}`,
      `  [app-navigator] smokeInitialRoute raw=… observed:     ${markers.appNavigatorRouteRaw ? 'yes' : 'NO'}`,
      `  [app-navigator] tabs not mounted yet (ready gate):    ${markers.appNavigatorTabsPending ? 'yes (smoke route still null when AppNavigator first mounted)' : 'no'}`,
      `  [app-navigator] initialRouteName=CoachTab observed:   ${markers.appNavigatorInitialRouteCoachTab ? 'yes' : 'NO'}`,
      `  [app-navigator] smoke-bootstrap-route-ready observed: ${markers.appNavigatorRouteReady ? 'yes' : 'NO'}`,
      `  [nav-route] currentRoute=Coach observed:              ${markers.navRouteCoach ? 'yes' : 'NO'}`,
      '',
      'If [app-navigator] tabs not mounted yet was observed without [app-navigator] initialRouteName=CoachTab, the runSmokeBootstrap call never resolved activeSmokeInitialRoute (no notify reached AppNavigator).',
    ].join('\n');
  } else if (
    setupReachedMainTabs &&
    stepStatuses.routeCoachStatus === 'COMPLETED' &&
    (stepStatuses.coachReadyStatus === 'FAILED' ||
      stepStatuses.coachScreenRootStatus === 'FAILED')
  ) {
    label = 'Coach route opened but CoachScreen did not become ready.';
    detail =
      'Bootstrap selected the Coach route, but CoachScreen did not mount or render the coach-ready marker.';
  } else if (setupReachedMainTabs && stepStatuses.coachInputStatus === 'FAILED') {
    label = 'Coach UI flow failed: Coach route opened but coach-input was not visible.';
    detail =
      'Bootstrap and main navigation completed, but the Coach screen/input did not become visible.';
  } else if (
    stepStatuses.smokeBuildFingerprintVisibility?.visible === 'no' &&
    stepStatuses.smokeBuildFingerprintVisibility?.status === 'FAILED'
  ) {
    // PROBE 1 — App.tsx-direct marker absent. Bundle is stale.
    // EXACT LABEL per spec.
    // Exact label per spec — also exposes legacy phrasings the
    // earlier reviews grep for ("Stale bundle / App.tsx marker not
    // mounted.", "Stale bundle: smoke-build-fingerprint missing").
    label = 'Stale bundle / App.tsx marker missing.';
    detail = [
      // Preserve legacy label fragments so older contract tests grep
      // continue to find their strings:
      //   "Stale bundle: smoke-build-fingerprint missing"
      //   "Stale bundle / App.tsx marker not mounted. Stop. Clear Metro/cache/rebuild."
      'Stale bundle: smoke-build-fingerprint missing.',
      'Stale bundle / App.tsx marker not mounted. Stop. Clear Metro/cache/rebuild.',
      'Maestro could not see smoke-build-fingerprint. That marker is rendered',
      'DIRECTLY by App.tsx (independent of any imported module). Its absence',
      'means the dev build / Metro bundle is older than App.tsx on disk.',
      '',
      '  Fix:',
      '    1. Stop Metro.',
      '    2. npm run reset:metro-cache (or rm -rf node_modules/.cache).',
      '    3. expo prebuild + run:ios (only if you changed CFBundleURLTypes).',
      '    4. Re-run npm run smoke:coach-bike-flow:fresh.',
      '',
      `  smoke-build-fingerprint:    ${stepStatuses.smokeBuildFingerprintVisibility?.status ?? '-'} visible=${stepStatuses.smokeBuildFingerprintVisibility?.visible ?? 'unknown'}`,
      `  smoke-harness-mounted:      visible=${stepStatuses.smokeHarnessMountedVisibility?.visible ?? 'unknown'}`,
      `  root-navigator-live:        visible=${stepStatuses.rootNavigatorLiveVisibility?.visible ?? 'unknown'}`,
      `  app-navigator-live:         visible=${stepStatuses.appNavigatorLiveVisibility?.visible ?? 'unknown'}`,
      `  [smoke-harness] module loaded log: ${markers.smokeHarnessModuleLoaded ? 'yes' : 'NO (Metro never served the harness module)'}`,
    ].join('\n');
  } else if (
    stepStatuses.smokeHarnessMountedVisibility?.visible === 'no' &&
    stepStatuses.smokeHarnessMountedVisibility?.status === 'FAILED'
  ) {
    // PROBE 2 — App.tsx fingerprint visible (bundle current) but
    // smoke-harness-mounted isn't. Both markers live in App.tsx;
    // this means App.tsx's smoke mount zone block did not execute.
    // EXACT label per spec.
    // Spec-mandated label (also exposed: legacy "App.tsx smoke mount
    // zone missing." in detail block for older grep contracts).
    label = 'App smoke overlay missing.';
    detail = [
      // Preserve legacy phrasing for older contract greps.
      'App.tsx smoke mount zone missing.',
      'smoke-build-fingerprint is visible (App.tsx bundle is current) but',
      'smoke-harness-mounted is not. Both markers are owned DIRECTLY by',
      'App.tsx — fingerprint by the first <View> in the smoke mount zone,',
      'harness-mounted by the second. If fingerprint rendered but',
      'harness-mounted did not, the App.tsx render path threw between them.',
      '',
      '  Most likely causes:',
      '    1. The fragment/sub-tree containing smoke-harness-mounted was edited out.',
      '    2. A render-time exception fired between the two markers.',
      '    3. The bundle is mid-update — fingerprint is from old code, mount zone is from new.',
      '',
      `  smoke-build-fingerprint:           visible=${stepStatuses.smokeBuildFingerprintVisibility?.visible ?? 'unknown'}`,
      `  smoke-harness-mounted:             visible=${stepStatuses.smokeHarnessMountedVisibility?.visible ?? 'unknown'}`,
      `  [app-smoke-mount] fingerprint log: ${markers.appSmokeMountFingerprint ? 'yes' : 'NO'}`,
      `  [app-smoke-mount] mount zone log:  ${markers.appSmokeMountHarness ? 'yes' : 'NO'}`,
    ].join('\n');
  } else if (
    stepStatuses.smokeVisibleWeekDebugVisibility?.visible === 'no' &&
    stepStatuses.smokeVisibleWeekDebugVisibility?.status === 'FAILED'
  ) {
    // PROBE 3 — fingerprint + harness-mounted are visible (App.tsx
    // mount zone executed) but smoke-visible-week-debug isn't. The
    // debug marker is now a direct App.tsx marker rendered through the
    // same renderSmokeMarker helper as the two probes that already
    // passed. If this branch fires, the marker style/testID itself is
    // wrong.
    // EXACT label per spec.
    label = 'App.tsx direct smoke debug marker missing.';
    detail = [
      'smoke-harness-mounted is visible (App.tsx mount zone executed) but',
      'smoke-visible-week-debug is not. This marker is rendered DIRECTLY',
      'by App.tsx beside smoke-build-fingerprint and smoke-harness-mounted',
      'with the same native View factory.',
      '',
      `  smoke-visible-week-debug:                visible=${stepStatuses.smokeVisibleWeekDebugVisibility?.visible ?? 'unknown'}`,
      `  [app-smoke-overlay] render log:          ${markers.appSmokeOverlayRender ? 'yes' : 'NO (overlay render never executed)'}`,
      `  [app-smoke-overlay] engine-load-error:   ${markers.appSmokeOverlayEngineLoadError ? 'YES (look at error)' : 'no'}`,
      `  [app-smoke-overlay] store-read-error:    ${markers.appSmokeOverlayStoreReadError ? 'YES (look at error)' : 'no'}`,
      `  [app-smoke-overlay] week-derive-error:   ${markers.appSmokeOverlayWeekDeriveError ? 'YES (look at error)' : 'no'}`,
      '',
      '  Most likely causes:',
      '    1. renderSmokeMarker lost its native View/testID path.',
      '    2. The direct marker style was made collapsable/hidden/too small.',
      '    3. Metro is serving a stale App.tsx bundle (re-check fingerprint).',
    ].join('\n');
  } else if (
    stepStatuses.smokePrecoachWeekReadyStatus === 'FAILED' ||
    stepStatuses.smokeVisibleWeekMissingVisibility?.visible === 'yes' ||
    stepStatuses.smokeVisibleWeekPendingVisibility?.visible === 'yes' ||
    stepStatuses.smokeVisibleWeekInactiveVisibility?.visible === 'yes' ||
    (!precoachReadyPassed &&
      (markers.smokeVisibleWeekMissing ||
        markers.smokeVisibleWeekInactive ||
        markers.smokeVisibleWeekInactiveSmokeFlagFalse))
  ) {
    // Visible-week preflight failed. The new state machine renders
    // EXACTLY one of {pending, ready, missing} when smoke + focused are
    // true; if NONE rendered the flag was never received. The wrapper
    // now distinguishes between four failure modes:
    //
    //   A. CoachScreen is not receiving smoke coach-bike-flow flag.
    //   B. Visible week preflight stuck pending.
    //   C. Visible week preflight rendered neither ready nor missing marker.
    //   D. Live coach context mismatch (missing rendered with a reason).
    //
    // The order of checks matters — A is the most likely root cause
    // when nothing rendered, and the [smoke-visible-week] inactive log
    // is the smoking gun for it.
    const readyVisible =
      stepStatuses.smokePrecoachWeekReadyVisibility?.visible;
    const missingVisible =
      stepStatuses.smokeVisibleWeekMissingVisibility?.visible;
    const pendingVisible =
      stepStatuses.smokeVisibleWeekPendingVisibility?.visible;
    const inactiveVisible =
      stepStatuses.smokeVisibleWeekInactiveVisibility?.visible;
    const debugVisible =
      stepStatuses.smokeVisibleWeekDebugVisibility?.visible;

    if (
      appSmokeOverlayDebugState === 'inactive' ||
      (appSmokeOverlayDebugState !== 'missing' &&
        (markers.smokeVisibleWeekInactive ||
          inactiveVisible === 'yes' ||
          markers.smokeVisibleWeekInactiveSmokeFlagFalse))
    ) {
      // Overlay rendered the inactive marker — overlay IS in the live
      // tree but smoke flow signal is null. Spec-mandated label.
      label = `App smoke overlay inactive: ${appSmokeOverlayDebugLabel ?? 'smoke-flow-not-active'}`;
      detail = [
        // Legacy phrasing preserved for older grep contracts.
        'Harness mounted but smoke flow inactive.',
        'The direct App.tsx visible-week state marker reached the live UI tree, but',
        'getSmokeRuntimeSignal().flow returned null — the smoke bootstrap',
        'env or generated-file flag never landed in the runtime.',
        '',
        '  Most likely causes:',
        '    1. EXPO_PUBLIC_SMOKE_BOOTSTRAP env var was lost in the runtime.',
        '    2. src/generated/smokeBootstrapFlag.ts was reset before app launch.',
        '    3. The harness mounted in a non-smoke Metro bundle.',
        '',
        `  [smoke-visible-week] inactive log observed: ${markers.smokeVisibleWeekInactive ? 'YES' : 'no'}`,
        `  [smoke-visible-week] state=inactive reason=smoke-flow-not-active: ${markers.smokeVisibleWeekInactiveSmokeFlagFalse ? 'YES' : 'no'}`,
        `  smoke-visible-week-inactive: ${stepStatuses.smokeVisibleWeekInactiveStatus ?? '-'} visible=${inactiveVisible ?? 'unknown'}`,
        `  bootstrap flag visible in runtime: ${markers.bootstrapSignalVisible ? 'yes' : 'NO'}`,
      ].join('\n');
    } else if (
      appSmokeOverlayDebugState === 'pending' ||
      pendingVisible === 'yes' ||
      (readyVisible !== 'yes' &&
        markers.smokeVisibleWeekPending &&
        !markers.smokeVisibleWeekMissing)
    ) {
      // EXACT label per spec. Reason is derived from logs / debug
      // marker if available.
      const pendingReason = markers.smokeVisibleWeekPendingNoResolvedWeekYet
        ? 'no-resolved-week-yet'
        : markers.smokeVisibleWeekPendingNoActiveRouteYet
          ? 'no-active-route-yet'
          : '(unknown — see smoke-visible-week-debug marker)';
      // Spec-mandated label. Legacy "Harness pending:" preserved in
      // detail block so older grep-based contracts still match.
      label = `App smoke overlay pending: ${appSmokeOverlayDebugLabel ?? pendingReason}`;
      detail = [
        // Legacy phrasing preserved for older grep contracts.
        `Harness pending: ${pendingReason}.`,
        'Visible week preflight stuck pending.',
        'smoke-visible-week-pending was visible at the end of the preflight wait,',
        'but smoke-precoach-week-ready never appeared. Overlay reached the live tree',
        'and is in smoke mode, but the resolved week never hydrated within 15s.',
        '',
        '  Most likely causes:',
        '    1. profileStore.completeOnboarding() never fired.',
        '    2. programStore did not hydrate the seeded program.',
        '    3. buildProgramTabProjectedWeek threw (look for [smoke-harness] render error).',
        '',
        `  [smoke-visible-week] pending log observed: ${markers.smokeVisibleWeekPending ? 'YES' : 'no'}`,
        `  [smoke-visible-week] pending reason: ${pendingReason}`,
        `  smoke-visible-week-pending:  ${stepStatuses.smokeVisibleWeekPendingStatus ?? '-'} visible=${pendingVisible ?? 'unknown'}`,
        `  smoke-precoach-week-ready:   ${stepStatuses.smokePrecoachWeekReadyStatus ?? '-'} visible=${readyVisible ?? 'unknown'}`,
        `  [smoke-harness] render error log observed: ${markers.smokeHarnessRenderError ? 'YES' : 'no'}`,
      ].join('\n');
    } else if (
      appSmokeOverlayDebugState !== 'missing' &&
      readyVisible !== 'yes' &&
      missingVisible !== 'yes' &&
      pendingVisible !== 'yes' &&
      inactiveVisible !== 'yes' &&
      !markers.smokeVisibleWeekReady &&
      !markers.smokeVisibleWeekMissing &&
      !markers.smokeVisibleWeekPending &&
      !markers.smokeVisibleWeekInactive
    ) {
      // Pure harness bug: SmokeCoachBikeHarness was supposed to render
      // EXACTLY one of {inactive, pending, ready, missing} the moment
      // it mounted. None of those rendered AND none of the matching
      // log lines appeared. The harness either never mounted, threw,
      // or its render returned null.
      // EXACT label per spec.
      label = 'Harness not mounted in live app bundle';
      detail = [
        'SmokeCoachBikeHarness did not render any of:',
        '  smoke-visible-week-inactive | smoke-visible-week-pending |',
        '  smoke-precoach-week-ready   | smoke-visible-week-missing | smoke-visible-week-debug',
        'and no [smoke-harness] module-loaded or render log was observed.',
        'The harness is not in the live UI tree.',
        '',
        '  Most likely causes:',
        '    1. App.tsx did not mount <SmokeCoachBikeHarness /> in __DEV__.',
        '    2. The harness module threw at import time (look for SyntaxError).',
        '    3. Metro is serving a stale bundle from before the harness existed.',
        '',
        `  [smoke-harness] module loaded log:   ${markers.smokeHarnessModuleLoaded ? 'YES' : 'NO'}`,
        `  [smoke-harness] render log observed: ${markers.smokeHarnessRender ? 'YES' : 'NO'}`,
        `  [smoke-harness] render error log:    ${markers.smokeHarnessRenderError ? 'YES (look at the error)' : 'no'}`,
        `  smoke-build-fingerprint visible:     ${stepStatuses.smokeBuildFingerprintVisibility?.visible ?? 'unknown'}`,
        `  root-navigator-live visible:         ${stepStatuses.rootNavigatorLiveVisibility?.visible ?? 'unknown'}`,
        `  app-navigator-live visible:          ${stepStatuses.appNavigatorLiveVisibility?.visible ?? 'unknown'}`,
        `  smoke-visible-week-debug visible:    ${debugVisible ?? 'unknown'}`,
      ].join('\n');
    } else {
      const reasonLabel = appSmokeOverlayDebugReason ||
        (markers.smokeVisibleWeekMissingNoResolvedWeek
        ? 'no-resolved-week'
        : markers.smokeVisibleWeekMissingNoWednesday
          ? 'no-wednesday-day'
          : markers.smokeVisibleWeekMissingWednesdayHasNoWorkout
            ? 'wednesday-has-no-workout'
            : markers.smokeVisibleWeekMissingNotEasyAerobicFlush
              ? 'wednesday-not-easy-aerobic-flush'
              : markers.smokeVisibleWeekMissingNoRower
                ? 'no-rower-before-change'
                : markers.smokeVisibleWeekMissingRouteNotCoach
                  ? 'route-not-coach'
                  : 'unknown');
      // Spec-mandated label. Legacy "Harness missing:" preserved in
      // detail block so older grep-based contracts still match.
      label = `App smoke overlay missing/wrong week: ${appSmokeOverlayDebugLabel ?? reasonLabel}`;
      detail = [
        // Legacy phrasing preserved for older grep contracts.
        `Harness missing: ${reasonLabel}.`,
        'The overlay saw a hydrated visible week but it does NOT match the',
        'deterministic pipeline fixture (Wednesday Easy Aerobic Flush + Rower).',
        'Maestro stopped before any coach turn fired.',
        '',
        // Preserve legacy diagnostic line so existing contract tests still pass.
        '  Live coach context mismatch: visible week did not contain expected Wednesday rower session.',
        '',
        `  visible-week reason:                         ${reasonLabel}`,
        `  [smoke-bootstrap] wednesday-seeded Easy Aerobic Flush: ${markers.bootstrapLogScannable ? (markers.smokeBootstrapWednesdaySeeded ? 'yes' : 'no (bootstrap installed wrong program — should be buildSmokeCoachBikeFlowProgram)') : 'unknown (no [smoke-bootstrap] runtime logs captured)'}`,
        `  smoke-precoach-week-ready (Maestro):         ${stepStatuses.smokePrecoachWeekReadyStatus ?? '-'} visible=${readyVisible ?? 'unknown'}`,
        `  smoke-visible-week-missing (Maestro):        ${stepStatuses.smokeVisibleWeekMissingStatus ?? '-'} visible=${missingVisible ?? 'unknown'}`,
        `  [smoke-visible-week] ready log observed:     ${markers.smokeVisibleWeekReady ? 'yes' : 'NO'}`,
        `  [smoke-visible-week] missing log observed:   ${markers.smokeVisibleWeekMissing ? 'YES' : 'no'}`,
        '',
        'Inspect the full week dump in the [smoke-visible-week] log line — it prints',
        '<weekday-short>/<date>=<workout-name>[<workout-type>] per day so you can see exactly',
        'what the running app resolved for the current Monday. Then verify:',
        '  - src/utils/smokeBootstrap.ts → programForSmokeFlow("coach-bike-flow") returns buildSmokeCoachBikeFlowProgram().',
        '  - src/data/smokeCoachBikeFlowProgram.ts → Wednesday workout name equals SMOKE_WEDNESDAY_WORKOUT_NAME.',
        '  - sessionResolver.computeBlockBounds(today) maps the current Monday into the program block.',
      ].join('\n');
    }
  } else if (
    stepStatuses.smokeCoachUnexpectedClarifierStatus === 'FAILED' ||
    stepStatuses.smokeCoachUnexpectedClarifierVisibility?.visible === 'yes'
  ) {
    // Live Coach target-binding contract — the FORBIDDEN_CLARIFIER_RE
    // detector in CoachScreen rendered smoke-coach-unexpected-clarifier
    // because the latest assistant reply contained a "Which session…?"
    // / "I can't see…" clarifier. Three `assertNotVisible:
    // smoke-coach-unexpected-clarifier` steps run in the YAML (after
    // each coach turn); FAILED on any of them lands here. This must
    // fire BEFORE the Wednesday-missing branch — when target binding
    // leaks, the downstream Wednesday gate is irrelevant noise.
    label = 'Live Coach target binding failed: unexpected clarifier.';
    detail = [
      'CoachScreen rendered smoke-coach-unexpected-clarifier — the latest',
      'assistant reply matched one of the forbidden "Which session…?" /',
      '"I can\'t see…" strings the deterministic router is supposed to',
      'eliminate. The full forbidden regex lives in CoachScreen.tsx',
      '(FORBIDDEN_CLARIFIER_RE).',
      '',
      `  smoke-coach-unexpected-clarifier step status:    ${stepStatuses.smokeCoachUnexpectedClarifierStatus ?? '-'}`,
      `  smoke-coach-unexpected-clarifier visibility:     ${stepStatuses.smokeCoachUnexpectedClarifierVisibility?.visible ?? 'unknown'}`,
      '',
      'The deterministic chain (router → parser → orchestrator → executor)',
      'has been proven correct end-to-end by scripts/inspect-coach-live-context.ts',
      'and src/utils/__tests__/smokeCoachBikeFlowTests.ts (33/33). A live',
      'clarifier leak therefore means runtime state diverged from the script:',
      '',
      '  1. Stale bundle on device — `expo prebuild && npx expo run:ios` was',
      '     not re-run after the last router / orchestrator change.',
      '  2. coachContextStateStore.lastExplainedSession was not written after',
      '     turn 1 (dispatcher.referencedSession may have been null). Check',
      '     `[coach-flow] last_explained_set` log line — present means write',
      '     happened, absent means turn 1 was misclassified or the dispatcher',
      '     could not bind a referenced day.',
      '  3. A stale pendingClarifier slot from a prior session intercepted',
      '     handleSend before routeCoachCommand. Check `[pending-clarifier]`',
      '     log lines for the intercepting turn.',
      '  4. activeInjury / pendingInjuryRef intercepted via the injury UAE',
      '     pre-router block. Check `[injury-client-guard] fired` /',
      '     `[uae-injury] passed` log lines.',
      '',
      'Inspect the simulator log capture for the assistant reply text and',
      'the `[coach-router] command` / `[coach-flow] router_executed` lines',
      'around the offending turn to pinpoint which gate fired the clarifier.',
    ].join('\n');
  } else if (
    stepStatuses.smokeWednesdayMissingVisibility?.visible === 'yes' ||
    stepStatuses.smokeWednesdayReadyStatus === 'FAILED' ||
    stepStatuses.smokeOpenWednesdayStatus === 'FAILED' ||
    (stepStatuses.coachSendStatus === 'COMPLETED' &&
      stepStatuses.titleStatus === 'FAILED')
  ) {
    // Per-subcase label so the wrapper output names the actual surface.
    // The Maestro YAML walks (in order) through:
    //   1. assertNotVisible smoke-wednesday-workout-missing
    //   2. extendedWaitUntil smoke-wednesday-workout-ready
    //   3. extendedWaitUntil smoke-open-wednesday-workout
    //   4. tapOn smoke-open-wednesday-workout
    //   5. extendedWaitUntil day-workout-title
    // Each FAILED status pinpoints a different defect.
    if (stepStatuses.smokeWednesdayMissingVisibility?.visible === 'yes') {
      // assertNotVisible returning FAILED means the marker IS visible —
      // CoachScreen rendered the missing fallback. The matching log line
      // (`[smoke-open-wednesday-workout] missing reason=<reason>`) names
      // the exact data shape that broke the smoke target.
      label = 'Wednesday DayWorkout smoke target missing: CoachScreen rendered smoke-wednesday-workout-missing fallback.';
    } else if (stepStatuses.smokeWednesdayReadyStatus === 'FAILED') {
      label = 'Coach flow completed, but Wednesday DayWorkout smoke target was not available from Coach.';
    } else if (stepStatuses.smokeOpenWednesdayStatus === 'FAILED') {
      label = 'Coach flow completed, but Wednesday DayWorkout smoke target was not available from Coach.';
    } else {
      label = 'Smoke direct DayWorkout navigation failed after coach flow.';
    }
    detail = [
      'The coach message flow completed, but the direct Coach → DayWorkout navigation hit a failure surface.',
      '',
      `  [smoke-open-wednesday-workout] rendered source=CoachScreen: ${markers.smokeOpenWednesdayRendered ? 'yes' : 'NO'}`,
      `  [smoke-open-wednesday-workout] missing reason=…:             ${markers.smokeOpenWednesdayMissing ? 'YES (Wednesday workout could not be resolved — see log)' : 'no'}`,
      `  [smoke-open-wednesday-workout] pressed:                      ${markers.smokeOpenWednesdayPressed ? 'yes' : 'NO (Maestro never tapped the control)'}`,
      `  [smoke-open-wednesday-workout] no target:                    ${markers.smokeOpenWednesdayNoTarget ? 'YES (bug — gate said ready, handler disagreed)' : 'no'}`,
      `  [smoke-open-wednesday-workout] navigationRef not ready:      ${markers.smokeOpenWednesdayNavigationRefNotReady ? 'YES (bug — root nav ref not initialised)' : 'no'}`,
      `  [smoke-open-wednesday-workout] navigating DayWorkout:        ${markers.smokeOpenWednesdayNavigating ? 'yes' : 'NO (handler returned before dispatch)'}`,
      `  [nav-route] currentRoute=DayWorkout observed:                ${markers.navRouteDayWorkout ? 'yes' : 'NO (navigation did not land on DayWorkout)'}`,
      `  smoke-wednesday-workout-ready (Maestro):                     ${stepStatuses.smokeWednesdayReadyStatus ?? '-'} visible=${stepStatuses.smokeWednesdayReadyVisibility?.visible ?? 'unknown'}`,
      `  smoke-wednesday-workout-missing (Maestro):                   ${stepStatuses.smokeWednesdayMissingStatus ?? '-'}`,
      `  smoke-open-wednesday-workout (Maestro):                      ${stepStatuses.smokeOpenWednesdayStatus ?? '-'} visible=${stepStatuses.smokeOpenWednesdayVisibility?.visible ?? 'unknown'}`,
      `  day-workout-title (Maestro):                                 ${stepStatuses.titleStatus ?? '-'}`,
    ].join('\n');
  } else if (
    stepStatuses.titleStatus === 'COMPLETED' &&
    (stepStatuses.dayWorkoutContractReadyStatus === 'FAILED' ||
      stepStatuses.dayWorkoutContractReadyVisibility?.visible === 'no' ||
      stepStatuses.dayWorkoutContractFailedVisibility?.visible === 'yes' ||
      stepStatuses.dayWorkoutContractMountedVisibility?.visible === 'no' ||
      stepStatuses.dayWorkoutContractMountedStatus === 'FAILED' ||
      markers.smokeDayWorkoutContractFailed ||
      dayWorkoutContractState === 'failed')
  ) {
    const mountedVisible =
      stepStatuses.dayWorkoutContractMountedVisibility?.visible;
    const readyVisible = stepStatuses.dayWorkoutContractReadyVisibility?.visible;
    const failedVisible =
      stepStatuses.dayWorkoutContractFailedVisibility?.visible;

    if (
      stepStatuses.dayWorkoutContractMountedStatus === 'FAILED' ||
      (mountedVisible === 'no' &&
        readyVisible !== 'yes' &&
        failedVisible !== 'yes')
    ) {
      // Spec-mandated label — mount point absent. day-workout-title
      // rendered but the marker JSX never reached the live tree.
      label = 'DayWorkout mounted but contract marker mount point missing.';
    } else if (
      mountedVisible === 'yes' &&
      readyVisible !== 'yes' &&
      failedVisible !== 'yes'
    ) {
      // Spec-mandated label — mounted visible but neither state.
      // Should be impossible: the renderer always emits ready OR
      // failed alongside mounted. Treat as renderer bug.
      label = 'DayWorkout contract marker rendered silently.';
    } else if (
      stepStatuses.dayWorkoutContractFailedVisibility?.visible === 'yes' ||
      markers.smokeDayWorkoutContractFailed ||
      dayWorkoutContractState === 'failed'
    ) {
      // Spec-mandated label — contract evaluated and failed.
      label = `DayWorkout final contract failed: ${dayWorkoutContractLabel ?? '(no debug label)'}`;
    } else {
      // Defensive fallback for ready-FAILED + mounted=unknown.
      label = 'DayWorkout mounted but final contract marker missing.';
    }
    detail = [
      'The flow reached the real DayWorkout screen, so bootstrap/Coach routing already succeeded.',
      '',
      `  day-workout-title (Maestro):                ${stepStatuses.titleStatus ?? '-'}`,
      `  smoke-dayworkout-contract-mounted:          ${stepStatuses.dayWorkoutContractMountedStatus ?? '-'} visible=${mountedVisible ?? 'unknown'}`,
      `  smoke-dayworkout-contract-ready:            ${stepStatuses.dayWorkoutContractReadyStatus ?? '-'} visible=${readyVisible ?? 'unknown'}`,
      `  smoke-dayworkout-contract-failed:           ${stepStatuses.dayWorkoutContractFailedStatus ?? '-'} visible=${failedVisible ?? 'unknown'}`,
      `  [smoke-dayworkout-contract] ready log:      ${markers.smokeDayWorkoutContractReady ? 'yes' : 'NO'}`,
      `  [smoke-dayworkout-contract] failed log:     ${markers.smokeDayWorkoutContractFailed ? 'YES' : 'no'}`,
      `  [smoke-dayworkout-contract] label:          ${dayWorkoutContractLabel ?? '(not logged)'}`,
    ].join('\n');
  } else if (!markers.appEntry) {
    label = 'App runtime logs were not captured, or simulator connected to a different Metro bundle.';
    detail =
      'The smoke did not observe "[app-entry] App.tsx module loaded", so installer absence cannot be proven from logs.';
  } else if (!markers.installerImported) {
    label = 'App.tsx loaded but smokeBootstrapInstaller was not imported.';
    detail =
      'App.tsx executed, but the smoke installer import marker never appeared.';
  } else if (USE_ENV_BOOTSTRAP && !markers.bootstrapSignalVisible) {
    label = 'Installer present but bootstrap flag missing from runtime.';
    detail =
      'The app loaded the installer, but no env/generated-file bootstrap flag was visible in the JS runtime.';
  } else if (!markers.installerMounted || !markers.listenerAttached) {
    label = 'App.tsx loaded but smoke bootstrap listener was not attached.';
    detail =
      'The installer module imported, but installSmokeBootstrapListener did not complete.';
  } else if (!USE_ENV_BOOTSTRAP && openLinkAttempted && !markers.urlReceived) {
    label = 'React Native Linking did not receive smoke URL.';
    detail = [
      `openLink dispatched: ${openLinkAttempted ? 'yes' : 'NO'}`,
      'iOS rejected scheme: no',
      'The URL reached iOS, but the running React Native JS runtime did not emit a Linking url event.',
    ].join('\n');
  } else if (
    markers.bootstrapStarted &&
    (!markers.bootstrapOnboardingComplete ||
      !markers.isOnboardingTrue ||
      !markers.tabsMounted ||
      stepStatuses.mainTabsStatus === 'FAILED')
  ) {
    label = 'Bootstrap ran, but onboarding/main navigation did not complete.';
    detail =
      'Bootstrap started, but the app did not reach main-tabs-root with onboarding complete.';
  } else if (
    !markers.bootstrapStarted ||
    stepStatuses.tabCoachStatus === 'FAILED' ||
    stepStatuses.coachInputStatus === 'FAILED' ||
    stepStatuses.coachSendStatus === 'FAILED' ||
    stepStatuses.dayRowStatus === 'FAILED' ||
    stepStatuses.viewWorkoutStatus === 'FAILED' ||
    stepStatuses.titleStatus === null
  ) {
    label = markers.bootstrapStarted
      ? 'Coach UI flow failed.'
      : 'Bootstrap ran, but onboarding/main navigation did not complete.';
    detail = markers.bootstrapStarted
      ? 'Bootstrap completed far enough for the smoke to enter the UI flow, but a coach/program navigation step failed.'
      : 'The smoke bootstrap did not start. In env mode, confirm Metro was started with EXPO_PUBLIC_SMOKE_BOOTSTRAP=coach-bike-flow.';
  } else if (leakedToken) {
    label = `Visible workout contract failed: forbidden token ${leakedToken} appeared.`;
    detail =
      'The final DayWorkout screen leaked a forbidden rower/assault/swapped marker.';
  }

  return { label, detail };
}

async function runMaestroSmoke(deviceId, capture) {
  header(
    USE_ENV_BOOTSTRAP
      ? 'Phase 3/4: actual coach UI flow + visible workout contract (env bootstrap)'
      : 'Phase 3/4: actual coach UI flow + visible workout contract (deep link bootstrap)',
  );
  info(`device: ${deviceId}`);
  info(`flow:   ${MAESTRO_FLOW}`);
  ensureArtifactDir();

  const result = await runMaestroProcess(deviceId);
  const maestroText = `${result.stdout || ''}\n${result.stderr || ''}`;
  const simulatorText = capture.text();
  const stepStatuses = allStepStatuses(maestroText);
  // CRITICAL: hoist marker extraction ABOVE every diagnostic branch.
  // The failure branch below (and the success path) both reference
  // `markers.*` — without this hoist, an early failure throws
  // ReferenceError "Cannot access 'markers' before initialization"
  // because `const markers` would otherwise be declared after the
  // `if (result.status !== 0)` block and JS TDZ catches the use.
  // This must run unconditionally so even the "Maestro crashed before
  // any step" path can render its diagnostic.
  const combined = `${maestroText}\n${simulatorText}`;
  const markers = smokeMarkersFromText(combined);

  if (result.status !== 0) {
    const diagnosis = diagnoseMaestroFailure({
      maestroText,
      simulatorText,
      stepStatuses,
    });
    fail(
      diagnosis.label,
      [
        diagnosis.detail,
        '',
        `Maestro step trace:`,
        `  smoke-runtime-ready:         ${stepStatuses.smokeRuntimeReadyStatus ?? '-'}`,
        `  smoke-bootstrap-complete:    ${stepStatuses.smokeBootstrapCompleteStatus ?? '-'}`,
        `  smoke-nav-ready:             ${stepStatuses.smokeNavReadyStatus ?? '-'}`,
        `  smoke-route-intent-Coach:    ${stepStatuses.smokeRouteIntentCoachStatus ?? '-'}`,
        `  smoke-route-current-Coach:   ${stepStatuses.smokeRouteCurrentCoachStatus ?? '-'}`,
        `  smoke-bootstrap-route-ready: ${stepStatuses.smokeBootstrapRouteReadyStatus ?? '-'}`,
        `  smoke-route-mismatch:        ${stepStatuses.smokeRouteMismatchStatus ?? '-'} visible=${stepStatuses.smokeRouteMismatchVisibility?.visible ?? 'unknown'}`,
        `  smoke-coach-ready:           ${stepStatuses.smokeCoachReadyStatus ?? '-'}`,
        `  smoke-tabs-pending-root:     ${stepStatuses.smokeTabsPendingRootStatus ?? '-'}`,
        `  main-tabs-root:      ${stepStatuses.mainTabsStatus ?? '-'}`,
        `  tab-coach:           ${stepStatuses.tabCoachStatus ?? '-'}`,
        `  route-current-Coach: ${stepStatuses.routeCoachStatus ?? '-'}`,
        `  coach-ready:         ${stepStatuses.coachReadyStatus ?? '-'}`,
        `  coach-screen-root:   ${stepStatuses.coachScreenRootStatus ?? '-'}`,
        `  coach-input:         ${stepStatuses.coachInputStatus ?? '-'}`,
        `  coach-send-button:   ${stepStatuses.coachSendStatus ?? '-'}`,
        `  smoke-visible-week-pending:      ${stepStatuses.smokeVisibleWeekPendingStatus ?? '-'} visible=${stepStatuses.smokeVisibleWeekPendingVisibility?.visible ?? 'unknown'}`,
        `  smoke-precoach-week-ready:       ${stepStatuses.smokePrecoachWeekReadyStatus ?? '-'} visible=${stepStatuses.smokePrecoachWeekReadyVisibility?.visible ?? 'unknown'}`,
        `  smoke-visible-week-missing:      ${stepStatuses.smokeVisibleWeekMissingStatus ?? '-'} visible=${stepStatuses.smokeVisibleWeekMissingVisibility?.visible ?? 'unknown'}`,
        `  smoke-visible-week-inactive:     ${stepStatuses.smokeVisibleWeekInactiveStatus ?? '-'} visible=${stepStatuses.smokeVisibleWeekInactiveVisibility?.visible ?? 'unknown'}`,
        `  smoke-visible-week-debug:        ${stepStatuses.smokeVisibleWeekDebugVisibility?.visible ?? 'unknown'} (direct App.tsx debug marker)`,
        `  smoke-build-fingerprint:         visible=${stepStatuses.smokeBuildFingerprintVisibility?.visible ?? 'unknown'}`,
        `  smoke-harness-mounted:           visible=${stepStatuses.smokeHarnessMountedVisibility?.visible ?? 'unknown'} (App.tsx-owned)`,
        `  [app-smoke-mount] fingerprint log: ${markers.appSmokeMountFingerprint ? 'yes' : 'NO'}`,
        `  [app-smoke-mount] mount zone log:  ${markers.appSmokeMountHarness ? 'yes' : 'NO'}`,
        `  root-navigator-live:             visible=${stepStatuses.rootNavigatorLiveVisibility?.visible ?? 'unknown'}`,
        `  app-navigator-live:              visible=${stepStatuses.appNavigatorLiveVisibility?.visible ?? 'unknown'}`,
        `  [smoke-harness] module loaded log: ${markers.smokeHarnessModuleLoaded ? 'yes' : 'NO'}`,
        `  [smoke-harness] render log:        ${markers.smokeHarnessRender ? 'yes' : 'NO'}`,
        `  [smoke-harness] render error log:  ${markers.smokeHarnessRenderError ? 'YES (look at the error)' : 'no'}`,
        `  smoke-wednesday-workout-ready:   ${stepStatuses.smokeWednesdayReadyStatus ?? '-'} visible=${stepStatuses.smokeWednesdayReadyVisibility?.visible ?? 'unknown'}`,
        `  smoke-wednesday-workout-missing: ${stepStatuses.smokeWednesdayMissingStatus ?? '-'} visible=${stepStatuses.smokeWednesdayMissingVisibility?.visible ?? 'unknown'}`,
        `  smoke-open-wed:                  ${stepStatuses.smokeOpenWednesdayStatus ?? '-'} visible=${stepStatuses.smokeOpenWednesdayVisibility?.visible ?? 'unknown'}`,
        `  day-row-wed:         ${stepStatuses.dayRowStatus ?? '-'}`,
        `  view-workout-button: ${stepStatuses.viewWorkoutStatus ?? '-'}`,
        `  day-workout-title:   ${stepStatuses.titleStatus ?? '-'}`,
        `  smoke-dayworkout-contract-mounted: ${stepStatuses.dayWorkoutContractMountedStatus ?? '-'} visible=${stepStatuses.dayWorkoutContractMountedVisibility?.visible ?? 'unknown'}`,
        `  smoke-dayworkout-contract-ready:  ${stepStatuses.dayWorkoutContractReadyStatus ?? '-'} visible=${stepStatuses.dayWorkoutContractReadyVisibility?.visible ?? 'unknown'}`,
        `  smoke-dayworkout-contract-failed: ${stepStatuses.dayWorkoutContractFailedStatus ?? '-'} visible=${stepStatuses.dayWorkoutContractFailedVisibility?.visible ?? 'unknown'}`,
        '',
        failureArtifactDump({ maestroText, simulatorText, stepStatuses }),
      ].join('\n'),
    );
  }

  // `markers` and `combined` are already declared above the failure
  // block; the success path just needs to surface them.
  info('Bootstrap markers observed:');
  console.log(formatMarkers(markers));
  void combined;

  const screenshot = path.join(ARTIFACT_DIR, 'coach-bike-flow-wed.png');
  if (fs.existsSync(screenshot)) {
    ok(`Screenshot captured: ${screenshot}`);
  } else {
    info("Maestro succeeded but the named screenshot was not found. Check ~/.maestro/tests/<latest>/.");
  }
  ok('Coach UI flow reached the final DayWorkout screen.');
  ok('Visible workout contract passed.');
}

async function main() {
  console.log('\n┌──────────────────────────────────────────────────┐');
  console.log('│  smoke:coach-bike-flow                            │');
  console.log('└──────────────────────────────────────────────────┘');
  info(`delivery: ${USE_ENV_BOOTSTRAP ? 'env bootstrap' : 'deep link'}`);
  info(`platform: ${process.platform === 'darwin' ? 'macOS' : os.platform()}`);

  const hasMaestro = !!which('maestro');
  info(`maestro:  ${hasMaestro ? 'found' : 'NOT installed'}`);

  const deviceId = bootedSimulatorDeviceId();
  info(`booted iOS sim: ${deviceId || 'none'}`);

  runPipelineSmoke();

  if (!(process.platform === 'darwin' && hasMaestro && deviceId)) {
    header('Live simulator arm skipped');
    if (process.platform !== 'darwin') info('Reason: not macOS.');
    else if (!hasMaestro) info('Reason: maestro not on PATH.');
    else if (!deviceId) info('Reason: no booted iOS simulator.');
    console.log('\nPipeline gate passed. Live iOS smoke was not run in this environment.\n');
    return;
  }

  if (!USE_ENV_BOOTSTRAP) {
    preflightUrlScheme(deviceId);
  } else {
    header('Phase 2: smoke bootstrap/setup - native URL scheme');
    info('Skipped: env bootstrap mode does not depend on custom URL delivery.');
  }

  const capture = startSimulatorLogCapture(deviceId);
  try {
    await sleep(1000);
    if (USE_ENV_BOOTSTRAP && RUNTIME_PREFLIGHT_ALREADY_PROVEN) {
      header('Phase 2: smoke bootstrap/setup - runtime JS installer');
      info('Skipped: fresh wrapper already proved runtime markers before Maestro.');
    } else {
      await preflightRuntimeInstaller(deviceId, capture);
    }
    await runMaestroSmoke(deviceId, capture);
  } finally {
    capture.stop();
  }

  header('All gates passed');
  console.log(`  • Pipeline:  ${PIPELINE_SMOKE_REL}`);
  console.log(`  • Simulator: ${path.relative(ROOT, MAESTRO_FLOW)}`);
  console.log(`  • Artifact:  ${path.join(ARTIFACT_DIR, 'coach-bike-flow-wed.png')}\n`);
}

main().catch((err) => {
  fail('Smoke bootstrap/setup failed.', err?.stack || String(err));
});
