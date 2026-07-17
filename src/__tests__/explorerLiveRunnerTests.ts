import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  EXPLORER_LIVE_RUNNER_HARD_STOP_MS,
  EXPLORER_LIVE_RUNNER_INFRASTRUCTURE_RETRY_LIMIT,
  EXPLORER_LIVE_RUNNER_TARGET_MS,
  ExplorerLiveRunnerError,
  assertExplicitMetroUrl,
  assertOneSelectedSimulator,
  buildMaestroHierarchyCommand,
  buildMaestroScreenshotCommand,
  compileExplorerNineCapturePlan,
  createEvidenceReceiptFromFiles,
  explorerEvidenceAcknowledgementUrl,
  extractPendingCaptureRequests,
  parseBootedIOSSimulators,
  runWholeScenarioWithInfrastructureRetry,
} from '../../scripts/run-explorer-nine-live';
import {
  EXPLORER_HIERARCHY_FORMAT,
  createExplorerPhysicalCaptureRequest,
} from '../dev/e2e/explorerPhysicalEvidence';
import { EXPLORER_NON_COACH_SMOKE_MANIFESTS } from
  '../dev/e2e/explorerSmokeScenarioManifests';
import { parseDevE2EEntryRoute } from '../dev/e2e/devE2EEntryRoute';

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

async function main(): Promise<void> {
  console.log('\n-- External Explorer nine-flow live runner --');

  await test('runner commands pin the selected simulator and explicit Metro', () => {
    const hierarchy = buildMaestroHierarchyCommand({ simulatorId: 'simulator-1' });
    const screenshot = buildMaestroScreenshotCommand({
      simulatorId: 'simulator-1',
      metroUrl: 'http://127.0.0.1:8081',
      screenshotRelativePath:
        'artifacts/explorer-nine-abcdef/smoke-one/seed-initial.png',
    });
    expect(hierarchy.args.includes('--device=simulator-1'),
      'hierarchy command omitted selected simulator');
    expect(screenshot.args.includes('--device=simulator-1') &&
      screenshot.args.includes('E2E_METRO_URL=http://127.0.0.1:8081') &&
      screenshot.args.includes(
        'SCREENSHOT_PATH=artifacts/explorer-nine-abcdef/smoke-one/seed-initial'),
    'screenshot command omitted simulator, Metro, or exact output path');
    expect(assertExplicitMetroUrl('http://127.0.0.1:8081').port === '8081',
      'explicit Metro URL was rejected');
  });

  await test('runner accepts exactly one explicitly selected booted simulator', () => {
    const parsed = parseBootedIOSSimulators(JSON.stringify({
      devices: {
        'com.apple.CoreSimulator.SimRuntime.iOS-18-0': [
          { udid: 'simulator-1', name: 'iPhone 16', state: 'Booted' },
          { udid: 'simulator-2', name: 'iPhone 15', state: 'Shutdown' },
        ],
      },
    }));
    expect(assertOneSelectedSimulator(parsed, 'simulator-1').name === 'iPhone 16',
      'one explicit simulator was not selected');
    try {
      assertOneSelectedSimulator([...parsed, {
        udid: 'simulator-3', name: 'iPhone SE',
      }], 'simulator-1');
    } catch (error) {
      expect(error instanceof ExplorerLiveRunnerError,
        'multiple simulators had the wrong failure');
      return;
    }
    throw new Error('multiple booted simulators were accepted');
  });

  await test('all nine capture plans compile in canonical order', () => {
    const plans = compileExplorerNineCapturePlan();
    expect(plans.length === 9, 'capture plan count changed');
    expect(plans.every((plan, index) =>
      plan.scenarioId === EXPLORER_NON_COACH_SMOKE_MANIFESTS[index].scenarioId &&
      plan.captures.length ===
        1 + EXPLORER_NON_COACH_SMOKE_MANIFESTS[index].steps.length * 2 &&
      plan.captures[0].screenshotBasename === 'seed-initial.png'),
    'canonical scenario order or capture cardinality drifted');
  });

  await test('request envelopes round-trip from the accessibility hierarchy', () => {
    const request = createExplorerPhysicalCaptureRequest({
      campaignId: 'explorer-nine-9f28da0d51a6',
      scenarioId: 'smoke-envelope',
      capturePhase: 'seed-reset',
      reloadCount: 0,
      traceId: null,
      controlId: null,
      observationId: null,
      expectedSemanticIdentity: {
        manifestSemanticHash: 'manifest',
        actionSemanticHash: null,
        canonicalSemanticIdentity: 'manifest',
      },
      deterministicClockFingerprint: 'clock',
    });
    const hierarchy = `prefix e2e-explorer-capture-envelope-${
      encodeURIComponent(JSON.stringify(request))} suffix`;
    expect(extractPendingCaptureRequests(hierarchy)[0]?.captureId === request.captureId,
      'accessibility envelope lost request identity');
  });

  await test('one whole-scenario retry is allowed only for infrastructure', async () => {
    let attempts = 0;
    const recovered = await runWholeScenarioWithInfrastructureRetry({
      run: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new ExplorerLiveRunnerError(
            'infrastructure', 'checkpoint_failed',
          );
        }
        return 'complete';
      },
    });
    expect(recovered.attempts === 2 && attempts === 2 &&
      EXPLORER_LIVE_RUNNER_INFRASTRUCTURE_RETRY_LIMIT === 1,
    'one infrastructure retry was not preserved');
    attempts = 0;
    try {
      await runWholeScenarioWithInfrastructureRetry({
        run: async () => {
          attempts += 1;
          throw new ExplorerLiveRunnerError('oracle', 'hard_oracle_failed');
        },
      });
    } catch {
      expect(attempts === 1, 'oracle failure was silently rerun');
      return;
    }
    throw new Error('oracle failure was accepted');
  });

  await test('runner enforces the 35-minute target and 45-minute hard stop constants', () => {
    expect(EXPLORER_LIVE_RUNNER_TARGET_MS === 35 * 60 * 1_000,
      'normal target changed');
    expect(EXPLORER_LIVE_RUNNER_HARD_STOP_MS === 45 * 60 * 1_000,
      'hard stop changed');
  });

  await test('file hashes, sizes, paths and acknowledgement routes are deterministic', () => {
    const root = mkdtempSync(join(tmpdir(), 'explorer-physical-'));
    try {
      const campaignDirectory = 'artifacts/explorer-nine-9f28da0d51a6';
      const request = createExplorerPhysicalCaptureRequest({
        campaignId: 'explorer-nine-9f28da0d51a6',
        scenarioId: 'smoke-file-hash',
        capturePhase: 'seed-reset',
        reloadCount: 0,
        traceId: null,
        controlId: null,
        observationId: null,
        expectedSemanticIdentity: {
          manifestSemanticHash: 'manifest', actionSemanticHash: null,
          canonicalSemanticIdentity: 'manifest',
        },
        deterministicClockFingerprint: 'clock',
      });
      const directory = join(root, campaignDirectory, request.scenarioId);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(root, campaignDirectory,
        request.requestedScreenshotRelativePath), Buffer.from([137, 80, 78, 71]));
      writeFileSync(join(root, campaignDirectory,
        request.requestedHierarchyRelativePath), JSON.stringify({
        format: EXPLORER_HIERARCHY_FORMAT, hierarchy: {},
      }));
      const receipt = createEvidenceReceiptFromFiles({
        request,
        repositoryRoot: root,
        campaignDirectory,
        integratedRepositorySha: '9f28da0d51a62106bc85d12a14868c216de8b96d',
      });
      const second = createEvidenceReceiptFromFiles({
        request,
        repositoryRoot: root,
        campaignDirectory,
        integratedRepositorySha: '9f28da0d51a62106bc85d12a14868c216de8b96d',
      });
      expect(JSON.stringify(receipt) === JSON.stringify(second),
        'same files produced different receipts');
      const url = explorerEvidenceAcknowledgementUrl(receipt);
      const route = parseDevE2EEntryRoute(url);
      expect(route?.kind === 'explorer_evidence' &&
        route.captureId === receipt.captureId,
      'acknowledgement URL did not reach the strict route');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await test('capture flow uses Maestro screenshot ownership only', () => {
    const flow = readFileSync(
      '.maestro/common/capture-explorer-evidence.yaml', 'utf8');
    expect(flow.includes('takeScreenshot:') && flow.includes('${SCREENSHOT_PATH}') &&
      !flow.includes('simctl io'), 'capture flow bypassed Maestro screenshot ownership');
  });

  console.log(`\nExplorer live runner: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void main();
