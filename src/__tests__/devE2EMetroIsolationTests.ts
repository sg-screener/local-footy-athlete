import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {
  explorerMetroDiagnosticMarker,
  verifyExplorerMetroDiagnostic,
  verifyExplorerNativeLaunchDiagnostic,
} from '../dev/e2e/explorerAppLaunchContract';
import { parseDevE2EEntryRoute } from '../dev/e2e/devE2EEntryRoute';
import {
  __resetDevE2EStateForTest,
  devE2EMarkers,
  getDevE2EStateSnapshot,
  setDevE2EExplorerMetroDiagnostic,
} from '../dev/e2e/devE2EState';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}`);
  }
}

const root = path.resolve(__dirname, '..', '..');
const appDelegate = fs.readFileSync(
  path.join(root, 'ios', 'LocalFootyAthlete', 'AppDelegate.swift'),
  'utf8',
);

ok('native Metro selection is DEBUG-only',
  /#if DEBUG\s+DevE2EMetroLaunch\.configureIfRequested\(\)\s+#endif/.test(appDelegate) &&
  /#if DEBUG\s+private enum DevE2EMetroLaunch[\s\S]+#endif/.test(appDelegate));
ok('launch argument owns the bundle provider before React Native starts',
  appDelegate.indexOf('DevE2EMetroLaunch.configureIfRequested()') <
  appDelegate.indexOf('factory.startReactNative('));
ok('explicit URL configures both scheme and host-port',
  appDelegate.includes('provider.packagerScheme = scheme') &&
  appDelegate.includes('provider.jsLocation = hostPort'));
ok('invalid explicit URL fails instead of falling back',
  appDelegate.includes('[DevE2E Metro] Invalid e2eMetroUrl') &&
  appDelegate.includes('let port = components.port'));
ok('release bundle behavior remains the embedded main.jsbundle',
  /#else\s+return Bundle\.main\.url\(forResource: "main", withExtension: "jsbundle"\)\s+#endif/.test(appDelegate));
ok('selected server and resolved bundle are observable',
  appDelegate.includes('[DevE2E Metro] Selected server:') &&
  appDelegate.includes('[DevE2E Metro] Resolved bundle:') &&
  appDelegate.includes('forKey: resolvedMetroKey'));

for (const file of ['reset-seed.yaml', 'checkpoint-and-reload.yaml']) {
  const flowPath = path.join(root, '.maestro', 'common', file);
  const flowSource = fs.readFileSync(flowPath, 'utf8');
  const documents: unknown[] = [];
  yaml.loadAll(flowSource, (document) => documents.push(document));
  ok(`${file} parses as a Maestro header and command document`,
    documents.length === 2 && Boolean(documents[0]) && Array.isArray(documents[1]));
  ok(`${file} passes the selected Metro URL on cold launch`,
    /launchApp:[\s\S]*arguments:\s+e2eMetroUrl: "\$\{E2E_METRO_URL\}"/.test(flowSource));
}

const canonicalLaunchPath = path.join(
  root, '.maestro', 'common', 'launch-explorer-app.yaml',
);
const canonicalLaunch = fs.readFileSync(canonicalLaunchPath, 'utf8');
const canonicalDocuments: unknown[] = [];
yaml.loadAll(canonicalLaunch, (document) => canonicalDocuments.push(document));
ok('canonical Explorer launch flow parses and owns the only Explorer launchApp',
  canonicalDocuments.length === 2 && Array.isArray(canonicalDocuments[1]) &&
  canonicalLaunch.includes('launchApp:') &&
  canonicalLaunch.includes('e2eMetroUrl: "${E2E_METRO_URL}"') &&
  canonicalLaunch.includes('e2eLaunchPurpose: "${EXPLORER_LAUNCH_PURPOSE}"') &&
  !canonicalLaunch.includes('openLink:'));

for (const [file, purpose] of [
  ['reset-scenario.yaml', 'scenario-reset'],
  ['run-explorer-scenario.yaml', 'scenario-reset'],
  ['scenario-checkpoint-and-reload.yaml', 'action-reload'],
  ['scenario-final-checkpoint-and-reload.yaml', 'final-step-reload'],
  ['relaunch-explorer-diagnostics.yaml', 'diagnostic-relaunch'],
] as const) {
  const flowSource = fs.readFileSync(path.join(root, '.maestro', 'common', file), 'utf8');
  const documents: unknown[] = [];
  yaml.loadAll(flowSource, (document) => documents.push(document));
  ok(`${file} parses and delegates launch ownership`,
    documents.length === 2 && Array.isArray(documents[1]) &&
    flowSource.includes('file: launch-explorer-app.yaml') &&
    flowSource.includes(`EXPLORER_LAUNCH_PURPOSE: ${purpose}`) &&
    !flowSource.includes('EXPLORER_LAUNCH_DEEP_LINK:') &&
    !flowSource.includes('launchApp:'));
}

const selectedMetro = 'http://127.0.0.1:8082';
const diagnosticRoute = parseDevE2EEntryRoute(
  'localfootyathlete://e2e/explorer/diagnostics/initial-cold-launch' +
  `?e2eMetroUrl=${encodeURIComponent(selectedMetro)}`,
);
ok('diagnostic deep link preserves the exact selected Metro URL',
  diagnosticRoute?.kind === 'explorer_diagnostic' &&
  diagnosticRoute.e2eMetroUrl === selectedMetro &&
  diagnosticRoute.launchPurpose === 'initial-cold-launch');
ok('matching app diagnostics publish an exact URL marker',
  verifyExplorerMetroDiagnostic({
    deepLinkMetroUrl: selectedMetro,
    nativeMetroUrl: selectedMetro,
  }) === selectedMetro &&
  explorerMetroDiagnosticMarker(selectedMetro).includes(encodeURIComponent(selectedMetro)));
ok('initial app diagnostic is independent of campaign/deep-link identity',
  verifyExplorerNativeLaunchDiagnostic({
    nativeMetroUrl: selectedMetro,
    resolvedMetroUrl: selectedMetro,
    launchPurpose: 'initial-cold-launch',
  }).launchPurpose === 'initial-cold-launch');
__resetDevE2EStateForTest();
setDevE2EExplorerMetroDiagnostic({
  metroUrl: selectedMetro,
  launchPurpose: 'initial-cold-launch',
});
const diagnosticMarkers = devE2EMarkers(getDevE2EStateSnapshot());
ok('rendered diagnostics expose exact URL and launch-path markers',
  diagnosticMarkers.includes(explorerMetroDiagnosticMarker(selectedMetro)) &&
  diagnosticMarkers.includes(
    'e2e-explorer-launch-diagnostic-initial-cold-launch',
  ));
let mismatchFailed = false;
try {
  verifyExplorerMetroDiagnostic({
    deepLinkMetroUrl: selectedMetro,
    nativeMetroUrl: 'http://127.0.0.1:8081',
  });
} catch (error) {
  mismatchFailed = error instanceof Error &&
    error.message === 'explorer_metro_diagnostic_mismatch';
}
ok('app diagnostics reject ambient Metro before route dispatch', mismatchFailed);

const entrySource = fs.readFileSync(
  path.join(root, 'src', 'dev', 'e2e', 'devE2EEntry.tsx'),
  'utf8',
);
ok('Explorer diagnostics run before seed reset and scenario execution',
  entrySource.indexOf('verifyExplorerMetroDiagnostic({') >= 0 &&
  entrySource.indexOf('verifyExplorerMetroDiagnostic({') <
    entrySource.indexOf('switch (route.kind)'));

const wrapper = fs.readFileSync(
  path.join(root, 'scripts', 'dev-e2e', 'run-maestro-ios.sh'),
  'utf8',
);
ok('wrapper requires an explicit URL and checks that Metro is live',
  wrapper.includes('E2E_METRO_URL is required') &&
  wrapper.includes('/status') &&
  wrapper.includes('packager-status:running'));
ok('wrapper has no fixed Metro port', !/8081|8082/.test(wrapper));
ok('wrapper forwards one URL to every Maestro launch',
  wrapper.includes('-e "E2E_METRO_URL=${E2E_METRO_URL}"'));

const explorerSources = [
  fs.readFileSync(path.join(root, 'scripts', 'run-explorer-nine-live.ts'), 'utf8'),
  fs.readFileSync(path.join(root, 'scripts', 'explorer-app-launch.ts'), 'utf8'),
  canonicalLaunch,
].join('\n');
ok('Explorer isolation never discovers or terminates ambient Metro servers',
  !/\blsof\b|killall|pkill|metroPortScan/.test(explorerSources) &&
  !/8081|8082/.test(explorerSources));

console.log(`\nDev E2E Metro isolation: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  failures.forEach((failure) => console.log(`  • ${failure}`));
  process.exit(1);
}
