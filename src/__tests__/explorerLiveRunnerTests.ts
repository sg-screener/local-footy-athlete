import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import {
  EXPLORER_LIVE_RUNNER_HARD_STOP_MS,
  EXPLORER_LIVE_RUNNER_INFRASTRUCTURE_RETRY_LIMIT,
  EXPLORER_LIVE_RUNNER_TARGET_MS,
  ExplorerLiveRunnerError,
  assertExplicitMetroUrl,
  assertOneSelectedSimulator,
  assertReservedMetroUrl,
  buildMaestroHierarchyCommand,
  buildMaestroScreenshotCommand,
  compileExplorerNineCapturePlan,
  createEvidenceReceiptFromFiles,
  explorerIOSBundleEndpoint,
  explorerEvidenceAcknowledgementUrl,
  explorerScenarioRunUrl,
  extractPendingCaptureRequests,
  parseBootedIOSSimulators,
  parseExplorerInstalledDebugAppBuildIdentity,
  preflightExplorerMetro,
  runWholeScenarioWithInfrastructureRetry,
  writeExplorerCampaignEnvironmentReceipt,
  writeExplorerPhysicalEvidenceReceiptFile,
} from '../../scripts/run-explorer-nine-live';
import {
  EXPLORER_APP_CLEAR_STATE_FLOW,
  EXPLORER_APP_LAUNCH_FLOW,
  buildExplorerAppLaunchPlan,
  buildExplorerDeepLinkCommand,
  type ExplorerAppLaunchPurpose,
} from '../../scripts/explorer-app-launch';
import {
  EXPLORER_HIERARCHY_FORMAT,
  createExplorerPhysicalCaptureRequest,
} from '../dev/e2e/explorerPhysicalEvidence';
import { EXPLORER_NON_COACH_SMOKE_MANIFESTS } from
  '../dev/e2e/explorerSmokeScenarioManifests';
import { parseDevE2EEntryRoute } from '../dev/e2e/devE2EEntryRoute';

const {
  EXPLORER_PHYSICAL_EVIDENCE_ENDPOINT,
  createExplorerPhysicalEvidenceMetroMiddleware,
  resolveExplorerPhysicalEvidenceArtifact,
} = require('../../scripts/explorer-physical-evidence-metro-middleware');

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
      metroUrl: 'http://127.0.0.1:8082',
      screenshotRelativePath:
        'artifacts/explorer-nine-abcdef/smoke-one/seed-initial.png',
    });
    expect(hierarchy.args.includes('--device=simulator-1'),
      'hierarchy command omitted selected simulator');
    expect(screenshot.args.includes('--device=simulator-1') &&
      screenshot.args.includes('E2E_METRO_URL=http://127.0.0.1:8082') &&
      screenshot.args.includes(
        'SCREENSHOT_PATH=artifacts/explorer-nine-abcdef/smoke-one/seed-initial'),
    'screenshot command omitted simulator, Metro, or exact output path');
    expect(assertExplicitMetroUrl('http://127.0.0.1:8082').port === '8082',
      'explicit Metro URL was rejected');
  });

  await test('every Explorer launch path uses the canonical selected-Metro builder', () => {
    const selected = 'http://127.0.0.1:8082';
    const paths: Array<{ name: string; purpose: ExplorerAppLaunchPurpose }> = [
      { name: 'first scenario launch', purpose: 'scenario-reset' },
      { name: 'subsequent scenario reset', purpose: 'scenario-reset' },
      { name: 'cold reload', purpose: 'action-reload' },
      { name: 'final reload', purpose: 'final-step-reload' },
      { name: 'infrastructure retry', purpose: 'infrastructure-retry' },
      { name: 'diagnostic launch', purpose: 'diagnostic-relaunch' },
      { name: 'initial cold launch', purpose: 'initial-cold-launch' },
    ];
    for (const path of paths) {
      const plan = buildExplorerAppLaunchPlan({
        simulatorId: 'simulator-1', metroUrl: selected, purpose: path.purpose,
      });
      const launchCommand = plan.commands.find((command) =>
        command.args.includes(EXPLORER_APP_LAUNCH_FLOW));
      expect(Boolean(launchCommand),
        `${path.name} bypassed the canonical flow`);
      expect(Boolean(launchCommand?.args.includes(`E2E_METRO_URL=${selected}`)) &&
        Boolean(launchCommand?.args.includes(
          `EXPLORER_LAUNCH_PURPOSE=${path.purpose}`,
        )),
      `${path.name} omitted the selected Metro`);
      expect(!launchCommand?.args.some((argument) =>
        argument.startsWith('EXPLORER_LAUNCH_DEEP_LINK=')),
      `${path.name} still couples launch proof to a deep link`);
      expect(!plan.commands.some((command) =>
        command.args.join(' ').includes('8081')),
        `${path.name} fell back to the ambient Metro`);
    }
  });

  await test('initial launch and all running-app links pin 8082 without probing 8081', () => {
    const launch = buildExplorerAppLaunchPlan({
      simulatorId: 'simulator-1',
      metroUrl: 'http://127.0.0.1:8082',
      purpose: 'initial-cold-launch',
    });
    const route = buildExplorerDeepLinkCommand({
      simulatorId: 'simulator-1',
      metroUrl: 'http://127.0.0.1:8082',
      deepLink: 'localfootyathlete://e2e/explorer/run/smoke-fixture-move',
    });
    const delivered = route.args.at(-1) ?? '';
    expect(launch.statePolicy === 'clear' && launch.commands.length === 2 &&
      launch.commands[0]?.args.includes(EXPLORER_APP_CLEAR_STATE_FLOW) &&
      launch.commands[1]?.args.includes(EXPLORER_APP_LAUNCH_FLOW),
    'initial launch did not own the literal clear-then-launch sequence');
    expect(new URL(delivered).searchParams.get('e2eMetroUrl') ===
      'http://127.0.0.1:8082', 'running-app deep link lost selected Metro');
    expect(!launch.commands.some((command) =>
      command.args.join(' ').includes('8081')) && !delivered.includes('8081'),
      'ambient Metro leaked into a launch command');
    const scenarioRoute = buildExplorerDeepLinkCommand({
      simulatorId: 'simulator-1',
      metroUrl: 'http://127.0.0.1:8082',
      deepLink: explorerScenarioRunUrl({
        scenarioId: 'smoke-fixture-move',
        campaignId: 'explorer-nine-aaaaaaaaaaaa',
        integratedRepositorySha: 'a'.repeat(40),
      }),
    }).args.at(-1) ?? '';
    const parsed = parseDevE2EEntryRoute(scenarioRoute);
    expect(parsed?.kind === 'explorer_run' &&
      parsed.campaignId === 'explorer-nine-aaaaaaaaaaaa' &&
      parsed.integratedRepositorySha === 'a'.repeat(40) &&
      parsed.e2eMetroUrl === 'http://127.0.0.1:8082' &&
      Boolean(parsed.deterministicClockFingerprint),
    'scenario reset route omitted its accepted campaign prerequisite');
  });

  await test('Metro preflight is exact, local, reserved-port bound and probes iOS bundle', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: URL | RequestInfo) => {
      const url = String(input);
      calls.push(url);
      return url.endsWith('/status')
        ? new Response('packager-status:running', { status: 200 })
        : new Response('bundle', { status: 200 });
    }) as typeof fetch;
    const preflight = await preflightExplorerMetro({
      metroUrl: 'http://127.0.0.1:8082',
      reservedMetroPort: 8082,
      fetchImpl,
    });
    expect(preflight.metroUrl.port === '8082' && calls.length === 2,
      'selected Metro did not complete both preflight probes');
    expect(calls[0] === 'http://127.0.0.1:8082/status' &&
      calls[1] === explorerIOSBundleEndpoint(preflight.metroUrl).toString(),
    'preflight did not probe the exact status and iOS bundle endpoints');
    expect(calls.every((url) => url.includes(':8082') && !url.includes(':8081')),
      'preflight inspected an ambient Metro');
    expect(assertReservedMetroUrl('http://localhost:8082', 8082).port === '8082',
      'localhost reserved Metro was rejected');
  });

  await test('Metro preflight fails closed on status body, bundle status and reserved port', async () => {
    const expectReason = async (
      reasonCode: string,
      run: () => Promise<unknown>,
    ): Promise<void> => {
      try {
        await run();
      } catch (error) {
        expect(error instanceof ExplorerLiveRunnerError &&
          error.reasonCode === reasonCode, `expected ${reasonCode}`);
        return;
      }
      throw new Error(`${reasonCode} was accepted`);
    };
    await expectReason('metro_url_required', () => preflightExplorerMetro({
      metroUrl: '', reservedMetroPort: 8082,
    }));
    await expectReason('metro_url_invalid', () => preflightExplorerMetro({
      metroUrl: 'http://192.0.2.1:8082', reservedMetroPort: 8082,
    }));
    await expectReason('reserved_metro_port_mismatch', () => preflightExplorerMetro({
      metroUrl: 'http://127.0.0.1:8082', reservedMetroPort: 8083,
      fetchImpl: (async () => new Response('packager-status:running')) as typeof fetch,
    }));
    await expectReason('metro_not_running', () => preflightExplorerMetro({
      metroUrl: 'http://127.0.0.1:8082', reservedMetroPort: 8082,
      fetchImpl: (async () =>
        new Response('packager-status:running\n', { status: 200 })) as typeof fetch,
    }));
    let call = 0;
    await expectReason('metro_ios_bundle_unavailable', () => preflightExplorerMetro({
      metroUrl: 'http://127.0.0.1:8082', reservedMetroPort: 8082,
      fetchImpl: (async () => {
        call += 1;
        return call === 1
          ? new Response('packager-status:running', { status: 200 })
          : new Response('missing', { status: 404 });
      }) as typeof fetch,
    }));
  });

  await test('launch builder refuses a missing E2E_METRO_URL', () => {
    try {
      buildExplorerAppLaunchPlan({
        simulatorId: 'simulator-1',
        metroUrl: '',
        purpose: 'initial-cold-launch',
      });
    } catch (error) {
      expect(error instanceof Error && error.message.includes('E2E_METRO_URL'),
        'missing Metro URL had the wrong failure');
      return;
    }
    throw new Error('launch without e2eMetroUrl was accepted');
  });

  await test('campaign environment receipt records the exact selected URL', () => {
    const root = mkdtempSync(join(tmpdir(), 'explorer-environment-'));
    try {
      const selected = 'http://127.0.0.1:8082';
      const metroUrl = new URL(selected);
      const receipt = writeExplorerCampaignEnvironmentReceipt({
        repositoryRoot: root,
        campaignDirectory: 'artifacts/explorer-nine-abcdef',
        campaignId: 'explorer-nine-abcdef',
        integratedRepositorySha: 'a'.repeat(40),
        e2eMetroUrl: selected,
        metroUrl,
        reservedMetroPort: 8082,
        bundleEndpoint: explorerIOSBundleEndpoint(metroUrl),
      });
      const written = JSON.parse(readFileSync(join(
        root, 'artifacts/explorer-nine-abcdef/campaign-environment-receipt.json',
      ), 'utf8')) as typeof receipt;
      expect(written.e2eMetroUrl === selected && written.reservedMetroPort === 8082,
        'environment receipt lost selected Metro identity');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await test('static ownership forbids Explorer launch construction outside the builder', () => {
    const canonical = readFileSync('.maestro/common/launch-explorer-app.yaml', 'utf8');
    const callSites = [
      '.maestro/common/reset-scenario.yaml',
      '.maestro/common/run-explorer-scenario.yaml',
      '.maestro/common/scenario-checkpoint-and-reload.yaml',
      '.maestro/common/scenario-final-checkpoint-and-reload.yaml',
      '.maestro/common/relaunch-explorer-diagnostics.yaml',
    ].map((file) => readFileSync(file, 'utf8'));
    const runner = readFileSync('scripts/run-explorer-nine-live.ts', 'utf8');
    expect(canonical.includes('launchApp:') && canonical.includes('e2eMetroUrl:') &&
      canonical.includes('e2eLaunchPurpose:') &&
      !canonical.includes('openLink:'),
    'canonical launch flow lost native launch diagnostic ownership');
    expect(callSites.every((source) => !source.includes('launchApp:') &&
      source.includes('file: launch-explorer-app.yaml') &&
      !source.includes('EXPLORER_LAUNCH_DEEP_LINK:')),
    'an Explorer Maestro call site constructs launchApp directly');
    expect(!runner.includes("args: ['simctl', 'openurl'") &&
      runner.includes('buildExplorerAppLaunchPlan({') &&
      runner.includes('buildExplorerDeepLinkCommand({'),
    'live runner bypasses canonical launch/deep-link builders');
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

  await test('installed Debug identity fails stale SHA and unsupported bridge preflight', () => {
    const sha = 'a'.repeat(40);
    expect(parseExplorerInstalledDebugAppBuildIdentity(JSON.stringify({
      schemaVersion: 1,
      nativeBridgeVersion: '1',
      integratedRepositorySha: sha,
    }), sha).integratedRepositorySha === sha,
    'current installed Debug identity was rejected');
    for (const [reasonCode, identity] of [
      ['stale_debug_binary', {
        schemaVersion: 1,
        nativeBridgeVersion: '1',
        integratedRepositorySha: 'b'.repeat(40),
      }],
      ['installed_native_bridge_version_unsupported', {
        schemaVersion: 1,
        nativeBridgeVersion: '2',
        integratedRepositorySha: sha,
      }],
    ] as const) {
      try {
        parseExplorerInstalledDebugAppBuildIdentity(
          JSON.stringify(identity),
          sha,
        );
      } catch (error) {
        expect(error instanceof ExplorerLiveRunnerError &&
          error.reasonCode === reasonCode, `expected ${reasonCode}`);
        continue;
      }
      throw new Error(`${reasonCode} was accepted`);
    }
  });

  await test('runner waits for acknowledged native receipt before campaign start', () => {
    const runner = readFileSync('scripts/run-explorer-nine-live.ts', 'utf8');
    const launch = runner.indexOf('async function launchExplorerApp(');
    const campaignStart = runner.indexOf('sendCampaignStart: () => {');
    expect(launch >= 0 && launch < campaignStart &&
      runner.includes('preflightInstalledExplorerDebugApp({') &&
      runner.includes('explorerRequestedMetroDiagnosticMarker(') &&
      runner.includes('explorerResolvedMetroDiagnosticMarker(') &&
      runner.includes('explorerBuildShaDiagnosticMarker(') &&
      runner.includes('explorerNativeBridgeDiagnosticMarker('),
    'runner no longer proves installed build/native receipt before campaign start');
  });

  await test('all nine capture plans compile in canonical order', () => {
    const plans = compileExplorerNineCapturePlan();
    expect(plans.length === 9, 'capture plan count changed');
    expect(plans.every((plan, index) =>
      plan.scenarioId === EXPLORER_NON_COACH_SMOKE_MANIFESTS[index].scenarioId &&
      plan.captures.length ===
        1 + EXPLORER_NON_COACH_SMOKE_MANIFESTS[index].steps.length * 2 &&
      plan.captures[0].screenshotBasename === 'seed-initial.png' &&
      EXPLORER_NON_COACH_SMOKE_MANIFESTS[index].steps.every((step, stepIndex) =>
        plan.captures[stepIndex * 2 + 1].controlId === step.controlTestId &&
        plan.captures[stepIndex * 2 + 2].controlId === step.controlTestId)),
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
      const acknowledgement = writeExplorerPhysicalEvidenceReceiptFile({
        receipt,
        repositoryRoot: root,
        campaignDirectory,
      });
      const url = explorerEvidenceAcknowledgementUrl(acknowledgement);
      const deliveredUrl = buildExplorerDeepLinkCommand({
        simulatorId: 'simulator-1',
        metroUrl: 'http://127.0.0.1:8082',
        deepLink: url,
      }).args[3];
      const route = parseDevE2EEntryRoute(deliveredUrl);
      expect(route?.kind === 'explorer_evidence' &&
        route.captureId === receipt.captureId &&
        route.receiptFileReference === acknowledgement.receiptFileReference &&
        route.receiptSha256 === acknowledgement.receiptSha256,
      'acknowledgement URL did not reach the strict route');
      expect(deliveredUrl.length < 1_024,
        `file-reference acknowledgement is still fragile (${deliveredUrl.length})`);
      const receiptPath = join(
        root, campaignDirectory, acknowledgement.receiptFileReference,
      );
      expect(readFileSync(receiptPath, 'utf8') === JSON.stringify(receipt),
        'runner receipt file did not preserve exact serialized evidence');
      expect(writeExplorerPhysicalEvidenceReceiptFile({
        receipt,
        repositoryRoot: root,
        campaignDirectory,
      }).receiptSha256 === acknowledgement.receiptSha256,
      'identical receipt-file submission was not idempotent');
      try {
        writeExplorerPhysicalEvidenceReceiptFile({
          receipt: {
            ...receipt,
            screenshot: { ...receipt.screenshot, sha256: '0'.repeat(64) },
          },
          repositoryRoot: root,
          campaignDirectory,
        });
      } catch (error) {
        expect(error instanceof ExplorerLiveRunnerError &&
          error.reasonCode === 'physical_evidence_receipt_file_conflict',
        'conflicting receipt file had the wrong failure');
        return;
      }
      throw new Error('conflicting receipt file overwrote immutable evidence');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await test('Metro evidence reader rejects absolute, traversal and outside-campaign files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'explorer-reader-'));
    try {
      const campaignId = 'explorer-nine-9f28da0d51a6';
      const campaignRoot = join(root, 'artifacts', campaignId);
      mkdirSync(join(campaignRoot, 'smoke-reader'), { recursive: true });
      writeFileSync(join(campaignRoot, 'smoke-reader', 'receipt.json'), '{}');
      const resolved = resolveExplorerPhysicalEvidenceArtifact({
        repositoryRoot: root,
        campaignId,
        relativeReference: 'smoke-reader/receipt.json',
      });
      expect(resolved?.endsWith('smoke-reader/receipt.json'),
        'valid campaign-relative evidence was rejected');
      const response = new PassThrough() as PassThrough & {
        statusCode: number;
        setHeader: (name: string, value: string) => void;
      };
      response.setHeader = () => {};
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      const finished = new Promise<void>((resolveFinished, rejectFinished) => {
        response.once('finish', resolveFinished);
        response.once('error', rejectFinished);
      });
      createExplorerPhysicalEvidenceMetroMiddleware({
        repositoryRoot: root,
        next: () => {
          throw new Error('valid iOS-normalised evidence path bypassed middleware');
        },
      })({
        method: 'GET',
        url: `${EXPLORER_PHYSICAL_EVIDENCE_ENDPOINT}/${campaignId}/` +
          'smoke-reader/receipt.json?nativeCachePolicy=no-store',
      }, response, () => {});
      await finished;
      expect(response.statusCode === 200 &&
        Buffer.concat(chunks).toString('utf8') === '{}',
      'iOS-normalised nested receipt path was not served exactly');
      for (const relativeReference of ['/tmp/receipt.json', '../receipt.json']) {
        try {
          resolveExplorerPhysicalEvidenceArtifact({
            repositoryRoot: root, campaignId, relativeReference,
          });
        } catch {
          continue;
        }
        throw new Error(`${relativeReference} escaped the campaign boundary`);
      }
      writeFileSync(join(root, 'outside.json'), '{}');
      symlinkSync(join(root, 'outside.json'), join(campaignRoot, 'smoke-reader', 'link.json'));
      try {
        resolveExplorerPhysicalEvidenceArtifact({
          repositoryRoot: root,
          campaignId,
          relativeReference: 'smoke-reader/link.json',
        });
      } catch {
        return;
      }
      throw new Error('symlink escaped the campaign boundary');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await test('one receipt submission and marker wait own acknowledgement correctness', () => {
    const runner = readFileSync('scripts/run-explorer-nine-live.ts', 'utf8');
    const bridge = readFileSync(
      'src/dev/e2e/explorerPhysicalEvidenceDevBridge.ts', 'utf8');
    expect((runner.match(/deepLink: explorerEvidenceAcknowledgementUrl/g) ?? [])
      .length === 1, 'runner submits the same receipt through multiple paths');
    const submission = runner.indexOf(
      'deepLink: explorerEvidenceAcknowledgementUrl(acknowledgement)',
    );
    const markerWait = runner.indexOf('await waitForHierarchyValue({', submission);
    expect(submission >= 0 && markerWait > submission &&
      !/\bsleep\b|setTimeout\s*\(/.test(runner.slice(submission, markerWait)),
    'arbitrary runner sleep replaced the correlated marker wait');
    expect(!/setTimeout\s*\(/.test(bridge) &&
      bridge.includes('pendingCaptureWaits.get(captureId)?.resolve(result.receipt)'),
    'polling rather than bridge completion owns acknowledgement timing');
    expect(runner.includes(
      '`e2e-explorer-capture-accepted-${request.captureId}`',
    ), 'runner waits for a marker other than the app capture identity');
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
