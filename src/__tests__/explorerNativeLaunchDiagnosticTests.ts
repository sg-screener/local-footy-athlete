import { readFileSync } from 'node:fs';
import type { DevE2EKeyValueStorage } from '../dev/e2e/devE2ECheckpoint';
import {
  __resetDevE2EStateForTest,
  devE2EMarkers,
  getDevE2EStateSnapshot,
  setDevE2EExplorerNativeLaunchDiagnostic,
  setDevE2EExplorerLaunchError,
} from '../dev/e2e/devE2EState';
import {
  EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON,
  EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_STORAGE_KEY,
  ExplorerNativeLaunchDiagnosticError,
  ExplorerNativeLaunchDiagnosticTransaction,
  __resetExplorerNativeLaunchDiagnosticForTest,
  createExplorerNativeLaunchDiagnosticReceipt,
  hydrateExplorerNativeLaunchDiagnostic,
  parseExplorerNativeLaunchDiagnosticReceipt,
  readActiveExplorerNativeLaunchDiagnostic,
  serializeExplorerNativeLaunchDiagnosticReceipt,
  verifyExplorerNativeLaunchDiagnosticReceipt,
} from '../dev/e2e/explorerNativeLaunchDiagnostic';
import {
  __resetExplorerCampaignBootstrapForTest,
} from '../dev/e2e/explorerCampaignBootstrap';
import {
  startExplorerPhysicalEvidenceCampaign,
} from '../dev/e2e/explorerPhysicalEvidenceDevBridge';

let passed = 0;
let failed = 0;

async function test(name: string, run: () => void | Promise<void>): Promise<void> {
  try {
    await run();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${name}`, error);
  }
}

function expect(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

class MemoryStorage implements DevE2EKeyValueStorage {
  readonly values = new Map<string, string>();
  readonly events: string[] = [];

  async getItem(key: string): Promise<string | null> {
    this.events.push(`read:${key}`);
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.events.push(`write:${key}`);
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.events.push(`remove:${key}`);
    this.values.delete(key);
  }
}

const selectedMetroUrl = 'http://127.0.0.1:8082';
const repositorySha = 'a'.repeat(40);

function fixture(overrides: Partial<Parameters<
typeof createExplorerNativeLaunchDiagnosticReceipt
>[0]> = {}) {
  return createExplorerNativeLaunchDiagnosticReceipt({
    launchPurpose: 'initial-cold-launch',
    requestedMetroUrl: selectedMetroUrl,
    resolvedMetroUrl: selectedMetroUrl,
    resolvedBundleFingerprint: 'fnv1a32:12345678',
    appBundleIdentifier: 'com.localfootyathlete.app',
    integratedRepositorySha: repositorySha,
    ...overrides,
  });
}

async function expectReason(
  reasonCode: string,
  run: () => unknown | Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(error instanceof ExplorerNativeLaunchDiagnosticError &&
      error.reasonCode === reasonCode, `expected ${reasonCode}`);
    return;
  }
  throw new Error(`${reasonCode} was accepted`);
}

async function main(): Promise<void> {
  console.log('\n-- Explorer native launch diagnostic receipt --');

  await test('current native receipt reaches JavaScript through exact readback', async () => {
    const storage = new MemoryStorage();
    const receipt = fixture();
    const raw = serializeExplorerNativeLaunchDiagnosticReceipt(receipt);
    const hydrated = await new ExplorerNativeLaunchDiagnosticTransaction(
      storage,
      true,
    ).hydrate(raw);
    expect(hydrated.receiptFingerprint === receipt.receiptFingerprint,
      'native receipt did not hydrate');
    expect(storage.values.get(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_STORAGE_KEY) === raw,
      'JavaScript did not persist the exact native receipt JSON');
    expect(storage.events.join(',') === [
      `read:${EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_STORAGE_KEY}`,
      `write:${EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_STORAGE_KEY}`,
      `read:${EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_STORAGE_KEY}`,
    ].join(','), 'persistence/readback ordering changed');
  });

  await test('initial launch marker is published only after durable readback', async () => {
    __resetDevE2EStateForTest();
    const storage = new MemoryStorage();
    const receipt = fixture();
    const transaction = new ExplorerNativeLaunchDiagnosticTransaction(storage, true);
    const pending = transaction.hydrate(
      serializeExplorerNativeLaunchDiagnosticReceipt(receipt),
    );
    expect(!devE2EMarkers(getDevE2EStateSnapshot()).includes(
      'e2e-explorer-launch-diagnostic-initial-cold-launch'),
    'launch marker appeared before the receipt transaction completed');
    setDevE2EExplorerNativeLaunchDiagnostic(await pending);
    const markers = devE2EMarkers(getDevE2EStateSnapshot());
    expect(markers.includes(
      'e2e-explorer-launch-diagnostic-initial-cold-launch') &&
      markers.includes(`e2e-explorer-launch-build-sha-${repositorySha}`),
    'durable receipt did not publish launch/build markers');
    expect(!markers.some((marker) => marker.includes('campaign-')),
      'launch diagnostic marker was coupled to campaign identity');
  });

  await test('requested and resolved Metro mismatches fail independently', async () => {
    await expectReason(
      EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.REQUESTED_METRO_URL_MISMATCH,
      () => verifyExplorerNativeLaunchDiagnosticReceipt(fixture({
        requestedMetroUrl: 'http://127.0.0.1:8083',
      }), { selectedMetroUrl }),
    );
    await expectReason(
      EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RESOLVED_METRO_URL_MISMATCH,
      () => verifyExplorerNativeLaunchDiagnosticReceipt(fixture({
        resolvedMetroUrl: 'http://127.0.0.1:8083',
      }), { selectedMetroUrl }),
    );
  });

  await test('stale build SHA and launch purpose fail before campaign acceptance', async () => {
    await expectReason(
      EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.BUILD_SHA_MISMATCH,
      () => verifyExplorerNativeLaunchDiagnosticReceipt(fixture(), {
        integratedRepositorySha: 'b'.repeat(40),
      }),
    );
    await expectReason(
      EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.LAUNCH_PURPOSE_MISMATCH,
      () => verifyExplorerNativeLaunchDiagnosticReceipt(fixture(), {
        launchPurpose: 'scenario-reset',
      }),
    );
  });

  await test('typed launch failures publish an exact machine-readable marker', () => {
    __resetDevE2EStateForTest();
    setDevE2EExplorerLaunchError(
      EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.BUILD_SHA_MISMATCH,
    );
    expect(devE2EMarkers(getDevE2EStateSnapshot()).includes(
      'e2e-explorer-launch-error-build-sha-mismatch',
    ), 'exact launch failure marker was not published');
  });

  await test('unsupported schema, bridge and fingerprint fail closed', async () => {
    const raw = serializeExplorerNativeLaunchDiagnosticReceipt(fixture());
    for (const [reasonCode, key, value] of [
      [EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.SCHEMA_VERSION_UNSUPPORTED,
        'schemaVersion', 2],
      [EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.BRIDGE_VERSION_UNSUPPORTED,
        'nativeBridgeVersion', '2'],
      [EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_FINGERPRINT_MISMATCH,
        'receiptFingerprint', 'fnv1a32:00000000'],
    ] as const) {
      const valueObject = JSON.parse(raw) as Record<string, unknown>;
      valueObject[key] = value;
      await expectReason(reasonCode, () =>
        parseExplorerNativeLaunchDiagnosticReceipt(JSON.stringify(valueObject)));
    }
  });

  await test('identical receipt is idempotent and conflicting receipt is rejected', async () => {
    const storage = new MemoryStorage();
    const transaction = new ExplorerNativeLaunchDiagnosticTransaction(storage, true);
    const raw = serializeExplorerNativeLaunchDiagnosticReceipt(fixture());
    await transaction.hydrate(raw);
    const writes = storage.events.filter((event) => event.startsWith('write')).length;
    await transaction.hydrate(raw);
    expect(storage.events.filter((event) => event.startsWith('write')).length === writes,
      'identical receipt rewrote durable state');
    await expectReason(
      EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_CONFLICT,
      () => transaction.hydrate(serializeExplorerNativeLaunchDiagnosticReceipt(
        fixture({ launchPurpose: 'scenario-reset' }),
      )),
    );
  });

  await test('React remount and cold JS reload retain the exact receipt', async () => {
    const storage = new MemoryStorage();
    const raw = serializeExplorerNativeLaunchDiagnosticReceipt(fixture());
    const first = new ExplorerNativeLaunchDiagnosticTransaction(storage, true);
    await first.hydrate(raw);
    expect((await first.hydrate(raw)).receiptFingerprint ===
      first.readActive()?.receiptFingerprint,
    'React remount lost the active receipt');
    const writes = storage.events.filter((event) => event.startsWith('write')).length;
    const cold = new ExplorerNativeLaunchDiagnosticTransaction(storage, true);
    expect((await cold.hydrate(raw)).receiptFingerprint ===
      fixture().receiptFingerprint,
    'cold reload did not restore the native receipt');
    expect(storage.events.filter((event) => event.startsWith('write')).length === writes,
      'cold reload rewrote an identical receipt');
  });

  await test('campaign start consumes active receipt; logs or query alone cannot accept', async () => {
    __resetExplorerNativeLaunchDiagnosticForTest();
    __resetExplorerCampaignBootstrapForTest();
    const storage = new MemoryStorage();
    await expectReason(
      EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.NATIVE_RECEIPT_MISSING,
      () => startExplorerPhysicalEvidenceCampaign({
        campaignId: 'explorer-nine-aaaaaaaaaaaa',
        integratedRepositorySha: repositorySha,
        e2eMetroUrl: selectedMetroUrl,
        storage,
        isDev: true,
      }),
    );
    await hydrateExplorerNativeLaunchDiagnostic({
      nativeReceiptJson: serializeExplorerNativeLaunchDiagnosticReceipt(fixture()),
      storage,
      isDev: true,
    });
    expect(readActiveExplorerNativeLaunchDiagnostic()?.integratedRepositorySha ===
      repositorySha, 'active receipt was not installed before campaign start');
    expect(await startExplorerPhysicalEvidenceCampaign({
      campaignId: 'explorer-nine-aaaaaaaaaaaa',
      integratedRepositorySha: repositorySha,
      e2eMetroUrl: selectedMetroUrl,
      storage,
      isDev: true,
    }), 'campaign did not accept the acknowledged native receipt');
  });

  await test('release builds expose neither receipt bridge nor entry route', async () => {
    await expectReason(
      EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RELEASE_BUILD,
      () => new ExplorerNativeLaunchDiagnosticTransaction(
        new MemoryStorage(),
        false,
      ).hydrate(serializeExplorerNativeLaunchDiagnosticReceipt(fixture())),
    );
    const nativeSource = readFileSync(
      'ios/LocalFootyAthlete/DevE2ELaunchDiagnostic.swift',
      'utf8',
    );
    const bridgeSource = readFileSync(
      'ios/LocalFootyAthlete/DevE2ELaunchDiagnosticBridge.m',
      'utf8',
    );
    const appSource = readFileSync('App.tsx', 'utf8');
    expect(nativeSource.startsWith('#if DEBUG') &&
      nativeSource.trimEnd().endsWith('#endif') &&
      bridgeSource.startsWith('#if DEBUG') &&
      appSource.includes("if (__DEV__)"),
    'release boundary no longer encloses native and JavaScript diagnostics');
  });

  await test('clear-state capture recreates one current receipt before JS boot', () => {
    const nativeSource = readFileSync(
      'ios/LocalFootyAthlete/DevE2ELaunchDiagnostic.swift',
      'utf8',
    );
    const appDelegate = readFileSync(
      'ios/LocalFootyAthlete/AppDelegate.swift',
      'utf8',
    );
    expect(nativeSource.indexOf('removeObject(forKey: receiptDefaultsKey)') <
      nativeSource.indexOf('pending = DevE2EPendingLaunchDiagnostic(') &&
      nativeSource.indexOf('UserDefaults.standard.set(json') <
      nativeSource.indexOf('currentReceiptJSON = json'),
    'clear-state launch does not recreate the current native receipt');
    expect(appDelegate.indexOf('captureAndConfigureIfRequested()') <
      appDelegate.indexOf('factory.startReactNative('),
    'native arguments are not captured before React/JS boot');
  });

  const entrySource = readFileSync('src/dev/e2e/devE2EEntry.tsx', 'utf8');
  await test('early campaign URL waits behind diagnostic hydration', () => {
    expect(entrySource.indexOf('await launchDiagnosticReady;') <
      entrySource.indexOf('await routeQueue.setReady(processRoute);'),
    'route readiness can race ahead of launch diagnostic hydration');
  });

  console.log(`\nExplorer native launch diagnostic: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
