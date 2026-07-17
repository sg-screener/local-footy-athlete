import fs from 'fs';
import path from 'path';
import { parseDevE2EEntryRoute } from '../dev/e2e/devE2EEntryRoute';
import { DEV_E2E_SEED_IDS } from '../dev/e2e/devE2ESeedIds';

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

for (const seedId of DEV_E2E_SEED_IDS) {
  ok(`reset route accepts ${seedId}`,
    parseDevE2EEntryRoute(`localfootyathlete://e2e/reset/${seedId}`)?.kind === 'reset');
  ok(`checkpoint route accepts ${seedId}`,
    parseDevE2EEntryRoute(`localfootyathlete://e2e/checkpoint/${seedId}`)?.kind === 'checkpoint');
  ok(`scenario reset route accepts ${seedId}`,
    parseDevE2EEntryRoute(
      `localfootyathlete://e2e/scenario/reset/${seedId}`,
    )?.kind === 'scenario_reset');
  ok(`scenario checkpoint route accepts ${seedId}`,
    parseDevE2EEntryRoute(
      `localfootyathlete://e2e/scenario/checkpoint/${seedId}/first-action`,
    )?.kind === 'scenario_checkpoint');
}

for (const invalid of [
  'localfootyathlete://smoke/coach-bike-flow',
  'localfootyathlete://e2e/reset/unknown',
  'localfootyathlete://e2e/reset/standard-in-season-week/',
  'localfootyathlete://e2e/reset/standard-in-season-week?override=1',
  ' localfootyathlete://e2e/reset/standard-in-season-week',
  'https://e2e/reset/standard-in-season-week',
  'localfootyathlete://e2e/scenario/reset/standard-in-season-week/',
  'localfootyathlete://e2e/scenario/checkpoint/standard-in-season-week',
  'localfootyathlete://e2e/scenario/checkpoint/standard-in-season-week/first_action',
  `localfootyathlete://e2e/explorer/evidence/explorer-capture-${'a'.repeat(64)}`,
  `localfootyathlete://e2e/explorer/evidence/explorer-capture-${'a'.repeat(64)}?receipt=%7B%7D&extra=1`,
]) {
  ok(`exact parser rejects ${invalid}`, parseDevE2EEntryRoute(invalid) === null);
}

ok('physical evidence campaign route accepts exact campaign and repository identity',
  parseDevE2EEntryRoute(
    'localfootyathlete://e2e/explorer/evidence/start/' +
    'explorer-nine-9f28da0d51a6/9f28da0d51a62106bc85d12a14868c216de8b96d',
  )?.kind === 'explorer_evidence_start');
ok('physical evidence acknowledgement route accepts exact capture and payload identity',
  parseDevE2EEntryRoute(
    `localfootyathlete://e2e/explorer/evidence/explorer-capture-${'a'.repeat(64)}` +
    '?receipt=%7B%7D',
  )?.kind === 'explorer_evidence');
const selectedMetroUrl = 'http://127.0.0.1:8082';
const metroDiagnostic = parseDevE2EEntryRoute(
  'localfootyathlete://e2e/explorer/diagnostics/scenario-reset' +
  `?e2eMetroUrl=${encodeURIComponent(selectedMetroUrl)}`,
);
ok('Explorer launch diagnostic carries exact purpose and Metro URL',
  metroDiagnostic?.kind === 'explorer_diagnostic' &&
  metroDiagnostic.launchPurpose === 'scenario-reset' &&
  metroDiagnostic.e2eMetroUrl === selectedMetroUrl);
ok('Explorer route accepts one exact Metro query field',
  parseDevE2EEntryRoute(
    'localfootyathlete://e2e/explorer/run/smoke-fixture-move' +
    `?e2eMetroUrl=${encodeURIComponent(selectedMetroUrl)}`,
  )?.kind === 'explorer_run');
ok('Explorer route rejects duplicate Metro query fields',
  parseDevE2EEntryRoute(
    'localfootyathlete://e2e/explorer/run/smoke-fixture-move' +
    `?e2eMetroUrl=${encodeURIComponent(selectedMetroUrl)}` +
    `&e2eMetroUrl=${encodeURIComponent(selectedMetroUrl)}`,
  ) === null);

const root = path.resolve(__dirname, '..', '..');
const appSource = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8');
const entrySource = fs.readFileSync(
  path.join(root, 'src', 'dev', 'e2e', 'devE2EEntry.tsx'),
  'utf8',
);
const clockSource = fs.readFileSync(
  path.join(root, 'src', 'dev', 'e2e', 'DevE2EClock.ts'),
  'utf8',
);
const clockPersistenceSource = fs.readFileSync(
  path.join(root, 'src', 'dev', 'e2e', 'devE2EClockPersistence.ts'),
  'utf8',
);
const scenarioRuntimeSource = fs.readFileSync(
  path.join(root, 'src', 'dev', 'e2e', 'devE2EScenarioRuntime.ts'),
  'utf8',
);
const appGuard = appSource.indexOf('if (__DEV__)');
const appRequire = appSource.indexOf("require('./src/dev/e2e/devE2EEntry')");
const releaseReturn = entrySource.indexOf('if (!isDev)');
const coordinatorRequire = entrySource.indexOf("require('./defaultDevE2ESeedCoordinator')");

ok('App loads the entry only inside __DEV__', appGuard >= 0 && appRequire > appGuard);
ok('development restores the clock before importing RootNavigator stores',
  appSource.includes('prepareDevE2EAppLaunch().then((ready) => {') &&
    appSource.indexOf('prepareDevE2EAppLaunch().then((ready) => {') <
      appSource.lastIndexOf("require('./src/navigation/RootNavigator')"));
ok('development installs URL ingress before the asynchronous clock barrier',
  appSource.indexOf('installDevE2EEntry();') >= 0 &&
    appSource.indexOf('installDevE2EEntry();') <
      appSource.indexOf('prepareDevE2EAppLaunch().then((ready) => {'));
ok('release imports RootNavigator without the development bootstrap',
  /} else \{[\s\S]*ReleaseRootNavigator = require\('\.\/src\/navigation\/RootNavigator'\)\.default;/.test(appSource));
ok('release refusal occurs before coordinator import', releaseReturn >= 0 && coordinatorRequire > releaseReturn);
ok('entry has no production or env override', !/EXPO_PUBLIC|process\.env/.test(entrySource));
ok('clock has no public env or diagnostics override',
  !/EXPO_PUBLIC|process\.env|athleteActionDiagnostics/.test(
    `${clockSource}\n${clockPersistenceSource}`,
  ));
ok('release refusal returns installed false', /if \(!isDev\)[\s\S]*installed: false/.test(entrySource));
ok('release refusal occurs before physical evidence route handling',
  releaseReturn >= 0 && entrySource.indexOf("case 'explorer_evidence'") > releaseReturn);
ok('release scenario runtime cannot activate',
  /if \(!isAvailable\(\)\) \{[\s\S]{0,120}active = null;[\s\S]{0,120}return false;/.test(
    scenarioRuntimeSource,
  ));
ok('dev E2E errors expose their exact reason to accessibility',
  entrySource.includes('testID="e2e-seed-error-reason"') &&
    entrySource.includes('accessibilityLabel={errorReason}'));
ok('scenario reload errors retain their exact scenario reason marker',
  entrySource.includes('await coordinator.validateReloadCheckpoint();') &&
    entrySource.includes('activeInstallation?.coordinatorReady()'));

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(target)
      : /\.tsx?$/.test(entry.name) ? [target] : [];
  });
}

const productionServiceSource = sourceFiles(path.join(root, 'src', 'services'))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');
const retiredSmokeSource = fs.readFileSync(
  path.join(root, 'src', 'utils', 'smokeBootstrap.ts'),
  'utf8',
);
ok('no production service imports the seed registry',
  !/devE2ESeedRegistry|DevE2ESeedCoordinator/.test(productionServiceSource));
ok('App has only the new development entry',
  !/installSmokeBootstrapListener|SmokeCoachBikeHarness/.test(appSource));
ok('retired smoke compatibility cannot read env or generated flags',
  !/process\.env|EXPO_PUBLIC|smokeBootstrapFlag|runSmokeBootstrap/.test(retiredSmokeSource));
ok('source-mutating smoke wrappers are retired',
  !fs.existsSync(path.join(root, 'scripts', 'smoke-coach-bike-flow.js')) &&
    !fs.existsSync(path.join(root, 'scripts', 'smoke-coach-bike-flow-fresh.js')));

console.log(`\nDev E2E entry boundary: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  failures.forEach((failure) => console.log(`  • ${failure}`));
  process.exit(1);
}
