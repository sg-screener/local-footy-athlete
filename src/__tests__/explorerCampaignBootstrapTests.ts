import { readFileSync } from 'node:fs';
import {
  AthleteActionTraceCoordinator,
  explorerAthleteActionTraceRoots,
} from '../dev/e2e/AthleteActionTraceCoordinator';
import type { DevE2EKeyValueStorage } from '../dev/e2e/devE2ECheckpoint';
import { DevE2EEntryRouteQueue } from '../dev/e2e/devE2EEntryRouteQueue';
import {
  EXPLORER_CAMPAIGN_BOOTSTRAP_REASON,
  ExplorerCampaignBootstrapError,
  ExplorerCampaignBootstrapTransaction,
} from '../dev/e2e/explorerCampaignBootstrap';
import {
  EXPLORER_CAMPAIGN_BOOTSTRAP_STATUSES,
  explorerCampaignDeterministicClockFingerprint,
} from '../dev/e2e/explorerCampaignBootstrapContract';
import {
  __resetDevE2EStateForTest,
  devE2EMarkers,
  getDevE2EStateSnapshot,
  setDevE2EExplorerCampaignAccepted,
  setDevE2EExplorerCampaignError,
  setDevE2EExplorerCampaignPending,
  setDevE2EExplorerNativeLaunchDiagnostic,
  setDevE2EScenarioReady,
} from '../dev/e2e/devE2EState';
import {
  createExplorerNativeLaunchDiagnosticReceipt,
  verifyExplorerNativeLaunchDiagnosticReceipt,
  type AcknowledgedExplorerNativeLaunchDiagnosticReceiptV1,
} from '../dev/e2e/explorerNativeLaunchDiagnostic';
import { runExplorerInitialCampaignBootstrap } from
  '../../scripts/run-explorer-nine-live';

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

  constructor(private readonly timeline?: string[]) {}

  private record(event: string): void {
    this.events.push(event);
    this.timeline?.push(event);
  }

  async getItem(key: string): Promise<string | null> {
    this.record('read');
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.record(`write:${JSON.parse(value).status}`);
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const identity = {
  campaignId: 'explorer-nine-aaaaaaaaaaaa',
  integratedRepositorySha: 'a'.repeat(40),
  e2eMetroUrl: 'http://127.0.0.1:8082',
} as const;

const prerequisite = {
  ...identity,
  deterministicClockFingerprint:
    explorerCampaignDeterministicClockFingerprint(),
} as const;

const nativeReceipt = createExplorerNativeLaunchDiagnosticReceipt({
  launchPurpose: 'initial-cold-launch',
  requestedMetroUrl: identity.e2eMetroUrl,
  resolvedMetroUrl: identity.e2eMetroUrl,
  resolvedBundleFingerprint: 'fnv1a32:12345678',
  appBundleIdentifier: 'com.localfootyathlete.app',
  integratedRepositorySha: identity.integratedRepositorySha,
});

async function expectReason(
  reasonCode: string,
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(error instanceof ExplorerCampaignBootstrapError &&
      error.reasonCode === reasonCode, `expected ${reasonCode}`);
    return;
  }
  throw new Error(`${reasonCode} was accepted`);
}

async function main(): Promise<void> {
  console.log('\n-- Explorer campaign bootstrap transaction --');

  await test('initial launch diagnostic needs native launch proof, not campaign identity', () => {
    const diagnostic = verifyExplorerNativeLaunchDiagnosticReceipt(
      nativeReceipt,
      {
      launchPurpose: 'initial-cold-launch',
      },
    );
    expect(diagnostic.launchPurpose === 'initial-cold-launch' &&
      diagnostic.requestedMetroUrl === identity.e2eMetroUrl,
    'native launch proof was not sufficient');
  });

  await test('one bootstrap receipt owns all campaign status and identity fields', () => {
    const bridge = readFileSync(
      'src/dev/e2e/explorerPhysicalEvidenceDevBridge.ts',
      'utf8',
    );
    const session = readFileSync('src/dev/e2e/devE2EScenarioSession.ts', 'utf8');
    expect(EXPLORER_CAMPAIGN_BOOTSTRAP_STATUSES.join(',') ===
      'pending,accepted,active,complete,blocked',
    'bootstrap status protocol is incomplete');
    expect(!bridge.includes('dev-e2e-explorer-physical-evidence-campaign') &&
      !session.includes('integratedRepositorySha') &&
      !session.includes('e2eMetroUrl'),
    'a downstream layer retained or recreated campaign identity ownership');
  });

  await test('campaign URL before readiness is queued and processed exactly once', async () => {
    const queue = new DevE2EEntryRouteQueue<string>();
    const processed: string[] = [];
    await queue.enqueue('campaign-url', 'campaign-url');
    await queue.enqueue('campaign-url', 'campaign-url');
    expect(processed.length === 0, 'pre-ready URL ran early');
    await queue.setReady(async (route) => {
      processed.push(route);
      return true;
    });
    expect(processed.join(',') === 'campaign-url', 'queued URL was lost or duplicated');
  });

  await test('campaign URL after readiness processes immediately', async () => {
    const queue = new DevE2EEntryRouteQueue<string>();
    let processed = false;
    await queue.setReady(async () => {
      processed = true;
      return true;
    });
    await queue.enqueue('campaign-url', 'campaign-url');
    expect(processed, 'ready queue did not process immediately');
  });

  await test('URL delivery during readiness flush preserves campaign-first order', async () => {
    const queue = new DevE2EEntryRouteQueue<string>();
    const events: string[] = [];
    let releaseCampaign!: () => void;
    const campaignGate = new Promise<void>((resolve) => {
      releaseCampaign = resolve;
    });
    await queue.enqueue('campaign', 'campaign');
    const ready = queue.setReady(async (route) => {
      events.push(`start:${route}`);
      if (route === 'campaign') await campaignGate;
      events.push(`end:${route}`);
      return true;
    });
    await Promise.resolve();
    const scenario = queue.enqueue('scenario', 'scenario');
    releaseCampaign();
    await Promise.all([ready, scenario]);
    expect(events.join(',') ===
      'start:campaign,end:campaign,start:scenario,end:scenario',
    'a later scenario route overtook campaign acceptance');
  });

  await test('campaign persistence and exact readback precede accepted marker', async () => {
    const timeline: string[] = [];
    const storage = new MemoryStorage(timeline);
    const transaction = new ExplorerCampaignBootstrapTransaction(
      storage,
      true,
      {
        pending: () => timeline.push('pending'),
        accepted: () => timeline.push('accepted'),
        error: (reason) => timeline.push(`error:${reason}`),
      },
    );
    await transaction.accept(identity);
    expect(timeline.join(',') ===
      'read,pending,write:pending,read,write:accepted,read,accepted',
    'transaction did not durably verify pending and accepted states');
    expect(timeline.indexOf('accepted') > timeline.lastIndexOf('read'),
      'accepted marker preceded durable readback');
  });

  await test('durable readback mismatch fails closed', async () => {
    const storage = new MemoryStorage();
    const originalGet = storage.getItem.bind(storage);
    let reads = 0;
    storage.getItem = async (key) => {
      const raw = await originalGet(key);
      reads += 1;
      if (reads === 2 && raw) {
        const record = JSON.parse(raw);
        record.status = 'accepted';
        return JSON.stringify(record);
      }
      return raw;
    };
    const transaction = new ExplorerCampaignBootstrapTransaction(storage, true);
    await expectReason(
      EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.PERSISTENCE_READBACK_MISMATCH,
      () => transaction.accept(identity),
    );
  });

  await test('identical duplicate is idempotent and conflicting duplicate is rejected', async () => {
    const storage = new MemoryStorage();
    const transaction = new ExplorerCampaignBootstrapTransaction(storage, true);
    await transaction.accept(identity);
    const writes = storage.events.filter((event) => event.startsWith('write')).length;
    await transaction.accept(identity);
    expect(storage.events.filter((event) => event.startsWith('write')).length === writes,
      'identical duplicate rewrote the transaction');
    await expectReason(
      EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.CONFLICT,
      () => transaction.accept({
        ...identity,
        campaignId: 'explorer-nine-bbbbbbbbbbbb',
      }),
    );
    expect(transaction.readActive()?.campaignId === identity.campaignId,
      'conflict overwrote the active campaign');
  });

  await test('scenario reset requires accepted campaign identity', async () => {
    const transaction = new ExplorerCampaignBootstrapTransaction(
      new MemoryStorage(),
      true,
    );
    await expectReason(
      EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.CAMPAIGN_MISSING,
      () => transaction.requireScenarioReset(prerequisite),
    );
  });

  await test('accepted campaign becomes active before reset and can complete', async () => {
    const transaction = new ExplorerCampaignBootstrapTransaction(
      new MemoryStorage(),
      true,
    );
    await transaction.accept(identity);
    expect((await transaction.requireScenarioReset(prerequisite)).status === 'active',
      'scenario prerequisite did not activate the campaign');
    expect((await transaction.transition('complete')).status === 'complete',
      'campaign completion status was not owned by the transaction');
    expect((await transaction.transition('blocked')).status === 'blocked',
      'campaign blocked status was not owned by the transaction');
  });

  await test('wrong Metro, repository SHA, campaign ID and clock fail closed', async () => {
    for (const [reasonCode, override] of [
      [EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.METRO_URL_MISMATCH,
        { e2eMetroUrl: 'http://127.0.0.1:8083' }],
      [EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.REPOSITORY_SHA_MISMATCH,
        { integratedRepositorySha: 'b'.repeat(40) }],
      [EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.CAMPAIGN_ID_MISMATCH,
        { campaignId: 'explorer-nine-bbbbbbbbbbbb' }],
      [EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.STALE_CLOCK_RECEIPT,
        { deterministicClockFingerprint: 'stale' }],
    ] as const) {
      const transaction = new ExplorerCampaignBootstrapTransaction(
        new MemoryStorage(),
        true,
      );
      await transaction.accept(identity);
      await expectReason(reasonCode, () => transaction.requireScenarioReset({
        ...prerequisite,
        ...override,
      }));
    }
  });

  await test('accepted identity survives cold reload', async () => {
    const storage = new MemoryStorage();
    await new ExplorerCampaignBootstrapTransaction(storage, true).accept(identity);
    const cold = new ExplorerCampaignBootstrapTransaction(storage, true);
    const restored = await cold.restore();
    expect(restored?.campaignId === identity.campaignId &&
      restored.status === 'accepted', 'cold reload lost accepted identity');
  });

  await test('release builds reject campaign start', async () => {
    const transaction = new ExplorerCampaignBootstrapTransaction(
      new MemoryStorage(),
      false,
    );
    await expectReason(
      EXPLORER_CAMPAIGN_BOOTSTRAP_REASON.RELEASE_BUILD,
      () => transaction.accept(identity),
    );
  });

  await test('launch, pending, accepted, error and scenario markers remain distinct', () => {
    __resetDevE2EStateForTest();
    setDevE2EExplorerNativeLaunchDiagnostic(
      nativeReceipt as AcknowledgedExplorerNativeLaunchDiagnosticReceiptV1,
    );
    setDevE2EExplorerCampaignPending(identity.campaignId);
    setDevE2EExplorerCampaignAccepted(identity.campaignId);
    setDevE2EExplorerCampaignError('example');
    setDevE2EScenarioReady({
      scenarioId: 'smoke-fixture-move',
      seedId: 'fixture-move',
      nextStepId: 'move-fixture',
      eligibilityStatus: 'eligible',
      eligibilityReasonCode: 'eligible',
    });
    const markers = devE2EMarkers(getDevE2EStateSnapshot());
    expect([
      'e2e-explorer-launch-diagnostic-initial-cold-launch',
      `e2e-explorer-campaign-pending-${identity.campaignId}`,
      `e2e-explorer-campaign-accepted-${identity.campaignId}`,
      'e2e-explorer-campaign-error-example',
      'e2e-scenario-ready-smoke-fixture-move',
    ].every((marker) => markers.includes(marker)),
    'marker ownership collapsed across phases');
  });

  await test('runner sends campaign once and waits for acceptance before reset', async () => {
    const events: string[] = [];
    await runExplorerInitialCampaignBootstrap({
      launch: async () => { events.push('entry-ready', 'launch-diagnostic'); },
      sendCampaignStart: () => { events.push('campaign-start'); },
      waitForCampaignAccepted: async () => { events.push('campaign-accepted'); },
    });
    events.push('scenario-reset', 'seed-reset-capture-request');
    expect(events.join(',') === [
      'entry-ready',
      'launch-diagnostic',
      'campaign-start',
      'campaign-accepted',
      'scenario-reset',
      'seed-reset-capture-request',
    ].join(','), 'bounded bootstrap command/state order changed');
    const source = readFileSync('scripts/run-explorer-nine-live.ts', 'utf8');
    expect(!/campaign-start[\s\S]{0,200}(?:sleep|setTimeout|retry)/i.test(source),
      'sleep/retry loop owns campaign-start correctness');
  });

  await test('system hydration trace is not an Explorer athlete-action root', () => {
    const traces = new AthleteActionTraceCoordinator(
      () => true,
      () => new Date('2026-07-13T02:00:00.000Z'),
    );
    traces.startRoot({ source: 'system', actionType: 'store_hydration' });
    expect(explorerAthleteActionTraceRoots(traces.getRecords()).length === 0,
      'ambient system hydration was counted as an Explorer action');
    traces.startRoot({
      source: 'tap',
      actionType: 'fixture.move',
      campaignId: identity.campaignId,
      scenarioRunId: 'smoke-fixture-move',
      scenarioStepId: 'move-fixture',
    }, { forceRoot: true });
    expect(explorerAthleteActionTraceRoots(
      traces.getRecords(),
      identity.campaignId,
    ).length === 1, 'first actual Explorer action root was not counted');
  });

  console.log(`\nExplorer campaign bootstrap: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
