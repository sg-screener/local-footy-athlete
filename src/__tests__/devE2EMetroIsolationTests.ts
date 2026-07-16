import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

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
  appDelegate.includes('[DevE2E Metro] Resolved bundle:'));

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

console.log(`\nDev E2E Metro isolation: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  failures.forEach((failure) => console.log(`  • ${failure}`));
  process.exit(1);
}
