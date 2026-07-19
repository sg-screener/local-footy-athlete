import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  buildExplorerAppLaunchPlan,
  buildExplorerDeepLinkCommand,
  explorerBuildShaDiagnosticMarker,
  explorerMetroDiagnosticMarker,
  explorerNativeBridgeDiagnosticMarker,
  explorerRequestedMetroDiagnosticMarker,
  explorerResolvedMetroDiagnosticMarker,
  type ExplorerAppLaunchPurpose,
} from './explorer-app-launch';
import {
  EXPLORER_HIERARCHY_FORMAT,
  EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION,
  explorerCampaignArtifactDirectory,
  explorerPhysicalEvidenceReceiptRelativeReference,
  parseExplorerPhysicalCaptureRequest,
  validateExplorerPhysicalEvidenceReceipt,
  type ExplorerPhysicalCaptureRequestV1,
  type ExplorerPhysicalEvidenceReceiptV1,
} from '../src/dev/e2e/explorerPhysicalEvidence';
import { EXPLORER_NON_COACH_SMOKE_MANIFESTS } from
  '../src/dev/e2e/explorerSmokeScenarioManifests';
import {
  EXPLORER_CAMPAIGN_HARD_STOP_MS,
  EXPLORER_CAMPAIGN_NORMAL_TARGET_MS,
} from '../src/dev/e2e/explorerScenarioRunner';
import { explorerCampaignDeterministicClockFingerprint } from
  '../src/dev/e2e/explorerCampaignBootstrapContract';
import {
  EXPLORER_APP_BUNDLE_IDENTIFIER,
  EXPLORER_NATIVE_BUILD_IDENTITY_RESOURCE,
  EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_BRIDGE_VERSION,
  EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_SCHEMA_VERSION,
} from '../src/dev/e2e/explorerNativeLaunchDiagnostic';

export const EXPLORER_LIVE_RUNNER_TARGET_MS = EXPLORER_CAMPAIGN_NORMAL_TARGET_MS;
export const EXPLORER_LIVE_RUNNER_HARD_STOP_MS = EXPLORER_CAMPAIGN_HARD_STOP_MS;
export const EXPLORER_LIVE_RUNNER_INFRASTRUCTURE_RETRY_LIMIT = 1 as const;

export interface ExplorerLiveCommand {
  readonly command: string;
  readonly args: readonly string[];
}

export interface ExplorerLiveRunnerOptions {
  readonly simulatorId: string;
  readonly metroUrl: string;
  readonly reservedMetroPort: number;
  readonly repositoryRoot: string;
  readonly integratedRepositorySha: string;
  readonly maestroBinary?: string;
  readonly nowMs?: () => number;
}

export interface BootedIOSSimulator {
  readonly udid: string;
  readonly name: string;
}

export class ExplorerLiveRunnerError extends Error {
  readonly kind: 'infrastructure' | 'product' | 'oracle' | 'trace';
  readonly reasonCode: string;

  constructor(
    kind: ExplorerLiveRunnerError['kind'],
    reasonCode: string,
    detail?: string,
  ) {
    super(detail ? `${reasonCode}:${detail}` : reasonCode);
    this.name = 'ExplorerLiveRunnerError';
    this.kind = kind;
    this.reasonCode = reasonCode;
  }
}

const RETRYABLE_INFRASTRUCTURE_REASONS = new Set([
  'checkpoint_failed',
  'reload_checkpoint_order_invalid',
  'seed_reset_failed',
  'maestro_command_failed',
  'capture_file_missing',
  'capture_file_empty',
]);
const CAPTURE_ENVELOPE_PATTERN =
  /e2e-explorer-capture-envelope-([A-Za-z0-9%._~'()!*\-]+)/g;
const SCENARIO_ERROR_PATTERN = /e2e-scenario-error-([a-z0-9_-]+)/;
const CAMPAIGN_ERROR_PATTERN = /e2e-explorer-campaign-error-([a-z0-9-]+)/;
const LAUNCH_ERROR_PATTERN = /e2e-explorer-launch-error-([a-z0-9-]+)/;
const CAPTURE_ERROR_PATTERN = /e2e-explorer-capture-error-([a-z0-9_-]+)/;

function throwForScenarioErrorMarker(hierarchy: string): void {
  const captureReasonCode = CAPTURE_ERROR_PATTERN.exec(hierarchy)?.[1];
  if (captureReasonCode) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      `physical_evidence_${captureReasonCode}`,
    );
  }
  const launchReasonCode = LAUNCH_ERROR_PATTERN.exec(hierarchy)?.[1];
  if (launchReasonCode) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      launchReasonCode === 'stale-debug-binary'
        ? 'stale_debug_binary'
        : `explorer_launch_${launchReasonCode.replace(/-/g, '_')}`,
    );
  }
  const campaignReasonCode = CAMPAIGN_ERROR_PATTERN.exec(hierarchy)?.[1];
  if (campaignReasonCode) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      `campaign_${campaignReasonCode.replace(/-/g, '_')}`,
    );
  }
  const reasonCode = SCENARIO_ERROR_PATTERN.exec(hierarchy)?.[1];
  if (!reasonCode) return;
  if (RETRYABLE_INFRASTRUCTURE_REASONS.has(reasonCode)) {
    throw new ExplorerLiveRunnerError('infrastructure', reasonCode);
  }
  if (reasonCode.includes('oracle')) {
    throw new ExplorerLiveRunnerError('oracle', reasonCode);
  }
  if (reasonCode.includes('trace')) {
    throw new ExplorerLiveRunnerError('trace', reasonCode);
  }
  throw new ExplorerLiveRunnerError('product', reasonCode);
}

function commandResult(
  spec: ExplorerLiveCommand,
  cwd: string,
  timeoutMs = 30_000,
  failureReasonCode = 'maestro_command_failed',
): string {
  const result = spawnSync(spec.command, [...spec.args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
  });
  if (result.status !== 0) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      failureReasonCode,
      `${spec.command}:${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

export function parseBootedIOSSimulators(raw: string): readonly BootedIOSSimulator[] {
  const parsed = JSON.parse(raw) as {
    devices?: Record<string, Array<{ udid?: string; name?: string; state?: string }>>;
  };
  return Object.values(parsed.devices ?? {}).flat()
    .filter((device) => device.state === 'Booted' && !!device.udid && !!device.name)
    .map((device) => ({ udid: device.udid!, name: device.name! }));
}

export function assertOneSelectedSimulator(
  simulators: readonly BootedIOSSimulator[],
  selectedSimulatorId: string,
): BootedIOSSimulator {
  if (!selectedSimulatorId || simulators.length !== 1 ||
    simulators[0]?.udid !== selectedSimulatorId) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      'simulator_selection_invalid',
      `booted=${simulators.map((simulator) => simulator.udid).join(',')}`,
    );
  }
  return simulators[0];
}

export interface ExplorerInstalledDebugAppBuildIdentity {
  readonly schemaVersion: 1;
  readonly nativeBridgeVersion: string;
  readonly integratedRepositorySha: string;
}

export function parseExplorerInstalledDebugAppBuildIdentity(
  raw: string,
  expectedRepositorySha: string,
): ExplorerInstalledDebugAppBuildIdentity {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      'stale_debug_binary',
      'installed_build_identity_invalid',
    );
  }
  const record = value as Partial<ExplorerInstalledDebugAppBuildIdentity>;
  if (!record || typeof record !== 'object' ||
    record.schemaVersion !==
      EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_SCHEMA_VERSION ||
    typeof record.integratedRepositorySha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(record.integratedRepositorySha)) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      'stale_debug_binary',
      'installed_build_identity_missing_or_invalid',
    );
  }
  if (record.integratedRepositorySha !== expectedRepositorySha) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      'stale_debug_binary',
      `installed=${record.integratedRepositorySha}:expected=${expectedRepositorySha}`,
    );
  }
  if (record.nativeBridgeVersion !==
    EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_BRIDGE_VERSION) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      'installed_native_bridge_version_unsupported',
      String(record.nativeBridgeVersion ?? 'missing'),
    );
  }
  return record as ExplorerInstalledDebugAppBuildIdentity;
}

export function preflightInstalledExplorerDebugApp(args: {
  simulatorId: string;
  repositoryRoot: string;
  integratedRepositorySha: string;
}): ExplorerInstalledDebugAppBuildIdentity {
  const appBundlePath = commandResult({
    command: 'xcrun',
    args: [
      'simctl',
      'get_app_container',
      args.simulatorId,
      EXPLORER_APP_BUNDLE_IDENTIFIER,
      'app',
    ],
  }, args.repositoryRoot, 30_000, 'installed_debug_app_missing').trim();
  const identityPath = resolve(
    appBundlePath,
    EXPLORER_NATIVE_BUILD_IDENTITY_RESOURCE,
  );
  const raw = commandResult({
    command: '/usr/bin/plutil',
    args: ['-convert', 'json', '-o', '-', identityPath],
  }, args.repositoryRoot, 30_000, 'stale_debug_binary');
  return parseExplorerInstalledDebugAppBuildIdentity(
    raw,
    args.integratedRepositorySha,
  );
}

export function assertExplicitMetroUrl(value: string): URL {
  if (!value) {
    throw new ExplorerLiveRunnerError('infrastructure', 'metro_url_required');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ExplorerLiveRunnerError('infrastructure', 'metro_url_invalid');
  }
  if (url.protocol !== 'http:' ||
    (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') ||
    !url.port || url.pathname !== '/' || url.search || url.hash ||
    value !== `http://${url.hostname}:${url.port}`) {
    throw new ExplorerLiveRunnerError('infrastructure', 'metro_url_invalid');
  }
  return url;
}

export function assertReservedMetroUrl(
  value: string,
  reservedMetroPort: number,
): URL {
  const url = assertExplicitMetroUrl(value);
  if (!Number.isInteger(reservedMetroPort) || reservedMetroPort < 1 ||
    reservedMetroPort > 65_535) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      'reserved_metro_port_invalid',
    );
  }
  if (Number(url.port) !== reservedMetroPort) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      'reserved_metro_port_mismatch',
      `selected=${url.port}:reserved=${reservedMetroPort}`,
    );
  }
  return url;
}

export function explorerIOSBundleEndpoint(metroUrl: URL): URL {
  const endpoint = new URL('/.expo/.virtual-metro-entry.bundle', metroUrl);
  endpoint.searchParams.set('platform', 'ios');
  endpoint.searchParams.set('dev', 'true');
  endpoint.searchParams.set('minify', 'false');
  return endpoint;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: URL,
): Promise<Response> {
  try {
    return await fetchImpl(input, {
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ExplorerLiveRunnerError('infrastructure', 'metro_unreachable');
  }
}

export async function preflightExplorerMetro(args: {
  metroUrl: string;
  reservedMetroPort: number;
  fetchImpl?: typeof fetch;
}): Promise<{ metroUrl: URL; bundleEndpoint: URL }> {
  const metroUrl = assertReservedMetroUrl(
    args.metroUrl,
    args.reservedMetroPort,
  );
  const fetchImpl = args.fetchImpl ?? fetch;
  const statusResponse = await fetchWithTimeout(
    fetchImpl,
    new URL('/status', metroUrl),
  );
  const statusBody = await statusResponse.text();
  if (statusResponse.status !== 200 || statusBody !== 'packager-status:running') {
    throw new ExplorerLiveRunnerError('infrastructure', 'metro_not_running');
  }
  const bundleEndpoint = explorerIOSBundleEndpoint(metroUrl);
  const bundleResponse = await fetchWithTimeout(fetchImpl, bundleEndpoint);
  if (bundleResponse.status !== 200) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      'metro_ios_bundle_unavailable',
      `status=${bundleResponse.status}`,
    );
  }
  return { metroUrl, bundleEndpoint };
}

export function buildMaestroHierarchyCommand(args: {
  simulatorId: string;
  maestroBinary?: string;
}): ExplorerLiveCommand {
  return {
    command: args.maestroBinary ?? 'maestro',
    args: ['--no-ansi', `--device=${args.simulatorId}`, 'hierarchy'],
  };
}

export function buildMaestroScreenshotCommand(args: {
  simulatorId: string;
  metroUrl: string;
  screenshotRelativePath: string;
  maestroBinary?: string;
}): ExplorerLiveCommand {
  const withoutPng = args.screenshotRelativePath.replace(/\.png$/, '');
  return {
    command: args.maestroBinary ?? 'maestro',
    args: [
      '--no-ansi',
      `--device=${args.simulatorId}`,
      'test',
      '.maestro/common/capture-explorer-evidence.yaml',
      '-e',
      `E2E_METRO_URL=${args.metroUrl}`,
      '-e',
      `SCREENSHOT_PATH=${withoutPng}`,
    ],
  };
}

export function buildMaestroActionIngressTapCommand(args: {
  simulatorId: string;
  controlId: string;
  maestroBinary?: string;
}): ExplorerLiveCommand {
  if (!args.controlId) {
    throw new ExplorerLiveRunnerError('product', 'action_ingress_control_missing');
  }
  return {
    command: args.maestroBinary ?? 'maestro',
    args: [
      '--no-ansi',
      `--device=${args.simulatorId}`,
      'test',
      '.maestro/common/tap-explorer-action-ingress.yaml',
      '-e',
      `CONTROL_ID=${args.controlId}`,
    ],
  };
}

export function explorerEvidenceCampaignStartUrl(args: {
  campaignId: string;
  integratedRepositorySha: string;
}): string {
  return 'localfootyathlete://e2e/explorer/evidence/start/' +
    `${args.campaignId}/${args.integratedRepositorySha}`;
}

export function explorerScenarioRunUrl(args: {
  scenarioId: string;
  campaignId: string;
  integratedRepositorySha: string;
}): string {
  const url = new URL(
    `localfootyathlete://e2e/explorer/run/${args.scenarioId}`,
  );
  url.searchParams.set('campaignId', args.campaignId);
  url.searchParams.set(
    'integratedRepositorySha',
    args.integratedRepositorySha,
  );
  url.searchParams.set(
    'deterministicClockFingerprint',
    explorerCampaignDeterministicClockFingerprint(),
  );
  return url.toString();
}

export function explorerEvidenceAcknowledgementUrl(
  acknowledgement: {
    captureId: string;
    receiptFileReference: string;
    receiptSha256: string;
  },
): string {
  const url = new URL(
    `localfootyathlete://e2e/explorer/evidence/${acknowledgement.captureId}`,
  );
  url.searchParams.set('receiptFile', acknowledgement.receiptFileReference);
  url.searchParams.set('receiptSha256', acknowledgement.receiptSha256);
  return url.toString();
}

export function extractPendingCaptureRequests(
  hierarchy: string,
): readonly ExplorerPhysicalCaptureRequestV1[] {
  const requests: ExplorerPhysicalCaptureRequestV1[] = [];
  for (const match of hierarchy.matchAll(CAPTURE_ENVELOPE_PATTERN)) {
    try {
      requests.push(parseExplorerPhysicalCaptureRequest(
        JSON.parse(decodeURIComponent(match[1])),
      ));
    } catch {
      // Ignore unrelated or partially rendered accessibility values.
    }
  }
  return requests;
}

export function compileExplorerNineCapturePlan(): readonly {
  scenarioId: string;
  captures: readonly {
    capturePhase: 'seed-reset' | 'after-action' | 'after-reload';
    stepId?: string;
    controlId?: string;
    reloadCount: number;
    screenshotBasename: string;
    hierarchyBasename: string;
  }[];
}[] {
  return EXPLORER_NON_COACH_SMOKE_MANIFESTS.map((manifest) => ({
    scenarioId: manifest.scenarioId,
    captures: [
      {
        capturePhase: 'seed-reset' as const,
        reloadCount: 0,
        screenshotBasename: 'seed-initial.png',
        hierarchyBasename: 'seed-initial.accessibility.json',
      },
      ...manifest.steps.flatMap((step, index) => [
        {
          capturePhase: 'after-action' as const,
          stepId: step.stepId,
          controlId: step.controlTestId,
          reloadCount: index,
          screenshotBasename:
            `${String(index + 1).padStart(2, '0')}-${step.stepId}-after-action.png`,
          hierarchyBasename:
            `${String(index + 1).padStart(2, '0')}-${step.stepId}-after-action.accessibility.json`,
        },
        {
          capturePhase: 'after-reload' as const,
          stepId: step.stepId,
          controlId: step.controlTestId,
          reloadCount: index + 1,
          screenshotBasename:
            `${String(index + 1).padStart(2, '0')}-${step.stepId}-after-reload.png`,
          hierarchyBasename:
            `${String(index + 1).padStart(2, '0')}-${step.stepId}-after-reload.accessibility.json`,
        },
      ]),
    ],
  }));
}

export interface ExplorerCampaignEnvironmentReceiptV1 {
  readonly schemaVersion: 1;
  readonly campaignId: string;
  readonly integratedRepositorySha: string;
  readonly e2eMetroUrl: string;
  readonly reservedMetroPort: number;
  readonly metroStatusEndpoint: string;
  readonly iosBundleEndpoint: string;
}

export function writeExplorerCampaignEnvironmentReceipt(args: {
  repositoryRoot: string;
  campaignDirectory: string;
  campaignId: string;
  integratedRepositorySha: string;
  e2eMetroUrl: string;
  metroUrl: URL;
  reservedMetroPort: number;
  bundleEndpoint: URL;
}): ExplorerCampaignEnvironmentReceiptV1 {
  const receipt: ExplorerCampaignEnvironmentReceiptV1 = {
    schemaVersion: 1,
    campaignId: args.campaignId,
    integratedRepositorySha: args.integratedRepositorySha,
    e2eMetroUrl: args.e2eMetroUrl,
    reservedMetroPort: args.reservedMetroPort,
    metroStatusEndpoint: new URL('/status', args.metroUrl).toString(),
    iosBundleEndpoint: args.bundleEndpoint.toString(),
  };
  const directory = resolve(args.repositoryRoot, args.campaignDirectory);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, 'campaign-environment-receipt.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
    'utf8',
  );
  return receipt;
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function assertPhysicalFile(path: string): { sha256: string; byteSize: number } {
  if (!existsSync(path)) {
    throw new ExplorerLiveRunnerError('infrastructure', 'capture_file_missing', path);
  }
  const byteSize = statSync(path).size;
  if (byteSize <= 0) {
    throw new ExplorerLiveRunnerError('infrastructure', 'capture_file_empty', path);
  }
  return { sha256: sha256File(path), byteSize };
}

export function createEvidenceReceiptFromFiles(args: {
  request: ExplorerPhysicalCaptureRequestV1;
  repositoryRoot: string;
  campaignDirectory: string;
  integratedRepositorySha: string;
}): ExplorerPhysicalEvidenceReceiptV1 {
  const screenshot = assertPhysicalFile(resolve(
    args.repositoryRoot,
    args.campaignDirectory,
    args.request.requestedScreenshotRelativePath,
  ));
  const hierarchy = assertPhysicalFile(resolve(
    args.repositoryRoot,
    args.campaignDirectory,
    args.request.requestedHierarchyRelativePath,
  ));
  return validateExplorerPhysicalEvidenceReceipt({
    request: args.request,
    expectedIntegratedRepositorySha: args.integratedRepositorySha,
    currentDeterministicClockFingerprint:
      args.request.deterministicClockFingerprint,
    receipt: {
      schemaVersion: EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION,
      captureId: args.request.captureId,
      campaignId: args.request.campaignId,
      scenarioId: args.request.scenarioId,
      ...(args.request.stepId ? { stepId: args.request.stepId } : {}),
      capturePhase: args.request.capturePhase,
      reloadCount: args.request.reloadCount,
      traceId: args.request.traceId,
      controlId: args.request.controlId,
      observationId: args.request.observationId,
      expectedSemanticIdentity: args.request.expectedSemanticIdentity,
      screenshot: {
        relativeReference: args.request.requestedScreenshotRelativePath,
        sha256: screenshot.sha256,
        byteSize: screenshot.byteSize,
        mediaType: 'image/png',
      },
      hierarchy: {
        relativeReference: args.request.requestedHierarchyRelativePath,
        sha256: hierarchy.sha256,
        byteSize: hierarchy.byteSize,
        format: EXPLORER_HIERARCHY_FORMAT,
      },
      capturedIntegratedRepositorySha: args.integratedRepositorySha,
      deterministicClockFingerprint:
        args.request.deterministicClockFingerprint,
    },
  });
}

export function writeExplorerPhysicalEvidenceReceiptFile(args: {
  receipt: ExplorerPhysicalEvidenceReceiptV1;
  repositoryRoot: string;
  campaignDirectory: string;
}): {
  captureId: string;
  receiptFileReference: string;
  receiptSha256: string;
} {
  const receiptFileReference =
    explorerPhysicalEvidenceReceiptRelativeReference(args.receipt);
  const receiptPath = resolve(
    args.repositoryRoot,
    args.campaignDirectory,
    receiptFileReference,
  );
  const serialized = JSON.stringify(args.receipt);
  if (existsSync(receiptPath)) {
    if (readFileSync(receiptPath, 'utf8') !== serialized) {
      throw new ExplorerLiveRunnerError(
        'infrastructure',
        'physical_evidence_receipt_file_conflict',
        args.receipt.captureId,
      );
    }
  } else {
    writeFileSync(receiptPath, serialized, 'utf8');
  }
  return {
    captureId: args.receipt.captureId,
    receiptFileReference,
    receiptSha256: sha256File(receiptPath),
  };
}

export function validateScenarioPhysicalEvidenceBundle(args: {
  scenarioId: string;
  plan: ReturnType<typeof compileExplorerNineCapturePlan>[number];
  receipts: readonly ExplorerPhysicalEvidenceReceiptV1[];
  repositoryRoot: string;
  campaignDirectory: string;
  integratedRepositorySha: string;
}): void {
  if (args.receipts.length !== args.plan.captures.length) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      'scenario_physical_bundle_incomplete',
      args.scenarioId,
    );
  }
  args.receipts.forEach((receipt, index) => {
    const expected = args.plan.captures[index];
    if (receipt.scenarioId !== args.scenarioId ||
      receipt.capturePhase !== expected.capturePhase ||
      receipt.stepId !== expected.stepId ||
      receipt.reloadCount !== expected.reloadCount ||
      receipt.capturedIntegratedRepositorySha !== args.integratedRepositorySha ||
      receipt.screenshot.relativeReference.split('/').pop() !==
        expected.screenshotBasename ||
      receipt.hierarchy.relativeReference.split('/').pop() !==
        expected.hierarchyBasename) {
      throw new ExplorerLiveRunnerError(
        'infrastructure',
        'scenario_physical_bundle_mismatch',
        `${args.scenarioId}:${index}`,
      );
    }
    const rebuilt = createEvidenceReceiptFromFiles({
      request: {
        schemaVersion: receipt.schemaVersion,
        captureId: receipt.captureId,
        campaignId: receipt.campaignId,
        scenarioId: receipt.scenarioId,
        ...(receipt.stepId ? { stepId: receipt.stepId } : {}),
        capturePhase: receipt.capturePhase,
        reloadCount: receipt.reloadCount,
        traceId: receipt.traceId,
        controlId: receipt.controlId,
        observationId: receipt.observationId,
        expectedSemanticIdentity: receipt.expectedSemanticIdentity,
        deterministicClockFingerprint: receipt.deterministicClockFingerprint,
        requestedScreenshotRelativePath: receipt.screenshot.relativeReference,
        requestedHierarchyRelativePath: receipt.hierarchy.relativeReference,
      },
      repositoryRoot: args.repositoryRoot,
      campaignDirectory: args.campaignDirectory,
      integratedRepositorySha: args.integratedRepositorySha,
    });
    if (JSON.stringify(rebuilt) !== JSON.stringify(receipt)) {
      throw new ExplorerLiveRunnerError(
        'infrastructure',
        'scenario_physical_bundle_hash_mismatch',
        receipt.captureId,
      );
    }
  });
}

export async function runWholeScenarioWithInfrastructureRetry<T>(args: {
  run: (attempt: 1 | 2) => Promise<T>;
}): Promise<{ attempts: 1 | 2; result: T }> {
  try {
    return { attempts: 1, result: await args.run(1) };
  } catch (error) {
    if (!(error instanceof ExplorerLiveRunnerError) ||
      error.kind !== 'infrastructure' ||
      !RETRYABLE_INFRASTRUCTURE_REASONS.has(error.reasonCode)) {
      throw error;
    }
    return { attempts: 2, result: await args.run(2) };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForHierarchyValue(args: {
  options: ExplorerLiveRunnerOptions;
  predicate: (hierarchy: string) => boolean;
  deadline: number;
}): Promise<string> {
  const nowMs = args.options.nowMs ?? Date.now;
  while (nowMs() < args.deadline) {
    const hierarchy = commandResult(buildMaestroHierarchyCommand({
      simulatorId: args.options.simulatorId,
      maestroBinary: args.options.maestroBinary,
    }), args.options.repositoryRoot, Math.max(1, args.deadline - nowMs()));
    throwForScenarioErrorMarker(hierarchy);
    if (args.predicate(hierarchy)) return hierarchy;
    await sleep(100);
  }
  throw new ExplorerLiveRunnerError('infrastructure', 'capture_marker_timeout');
}

async function launchExplorerApp(args: {
  options: ExplorerLiveRunnerOptions;
  purpose: ExplorerAppLaunchPurpose;
  hardDeadline: number;
}): Promise<void> {
  const nowMs = args.options.nowMs ?? Date.now;
  const plan = buildExplorerAppLaunchPlan({
    simulatorId: args.options.simulatorId,
    metroUrl: args.options.metroUrl,
    purpose: args.purpose,
    maestroBinary: args.options.maestroBinary,
  });
  for (const command of plan.commands) {
    commandResult(command, args.options.repositoryRoot, Math.max(
      1,
      args.hardDeadline - nowMs(),
    ));
  }
  await waitForHierarchyValue({
    options: args.options,
    deadline: args.hardDeadline,
    predicate: (hierarchy) => hierarchy.includes(
      explorerMetroDiagnosticMarker(args.options.metroUrl),
    ) && hierarchy.includes(
      `e2e-explorer-launch-diagnostic-${args.purpose}`,
    ) && hierarchy.includes(
      explorerRequestedMetroDiagnosticMarker(args.options.metroUrl),
    ) && hierarchy.includes(
      explorerResolvedMetroDiagnosticMarker(args.options.metroUrl),
    ) && hierarchy.includes(
      explorerBuildShaDiagnosticMarker(args.options.integratedRepositorySha),
    ) && hierarchy.includes(
      explorerNativeBridgeDiagnosticMarker(
        EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_BRIDGE_VERSION,
      ),
    ),
  });
}

export async function runExplorerInitialCampaignBootstrap(args: {
  launch: () => Promise<void>;
  sendCampaignStart: () => void;
  waitForCampaignAccepted: () => Promise<void>;
}): Promise<void> {
  await args.launch();
  args.sendCampaignStart();
  await args.waitForCampaignAccepted();
}

async function runScenario(args: {
  options: ExplorerLiveRunnerOptions;
  campaignId: string;
  campaignDirectory: string;
  plan: ReturnType<typeof compileExplorerNineCapturePlan>[number];
  hardDeadline: number;
  launchPurpose: 'scenario-reset' | 'infrastructure-retry';
}): Promise<readonly ExplorerPhysicalEvidenceReceiptV1[]> {
  await launchExplorerApp({
    options: args.options,
    purpose: args.launchPurpose,
    hardDeadline: args.hardDeadline,
  });
  await waitForHierarchyValue({
    options: args.options,
    deadline: args.hardDeadline,
    predicate: (hierarchy) => hierarchy.includes(
      `e2e-explorer-campaign-accepted-${args.campaignId}`,
    ),
  });
  commandResult(buildExplorerDeepLinkCommand({
    simulatorId: args.options.simulatorId,
    metroUrl: args.options.metroUrl,
    deepLink: explorerScenarioRunUrl({
      scenarioId: args.plan.scenarioId,
      campaignId: args.campaignId,
      integratedRepositorySha: args.options.integratedRepositorySha,
    }),
  }), args.options.repositoryRoot, Math.max(
    1,
    args.hardDeadline - (args.options.nowMs ?? Date.now)(),
  ));
  const seen = new Set<string>();
  const receipts: ExplorerPhysicalEvidenceReceiptV1[] = [];
  for (const expected of args.plan.captures) {
    const hierarchy = await waitForHierarchyValue({
      options: args.options,
      deadline: args.hardDeadline,
      predicate: (value) => extractPendingCaptureRequests(value)
        .some((request) => !seen.has(request.captureId)),
    });
    const request = extractPendingCaptureRequests(hierarchy)
      .find((candidate) => !seen.has(candidate.captureId));
    if (!request || request.campaignId !== args.campaignId ||
      request.scenarioId !== args.plan.scenarioId ||
      request.capturePhase !== expected.capturePhase ||
      request.stepId !== expected.stepId ||
      request.controlId !== (expected.controlId ?? null) ||
      request.reloadCount !== expected.reloadCount ||
      request.requestedScreenshotRelativePath.split('/').pop() !==
        expected.screenshotBasename ||
      request.requestedHierarchyRelativePath.split('/').pop() !==
        expected.hierarchyBasename) {
      throw new ExplorerLiveRunnerError(
        'infrastructure',
        'capture_plan_mismatch',
        args.plan.scenarioId,
      );
    }
    const nextStep = request.capturePhase === 'seed-reset'
      ? EXPLORER_NON_COACH_SMOKE_MANIFESTS.find((manifest) =>
          manifest.scenarioId === args.plan.scenarioId)?.steps[0]
      : request.capturePhase === 'after-reload'
        ? EXPLORER_NON_COACH_SMOKE_MANIFESTS.find((manifest) =>
            manifest.scenarioId === args.plan.scenarioId)?.steps[request.reloadCount]
        : undefined;
    if (request.capturePhase === 'after-reload' && !nextStep &&
      !hierarchy.includes(`e2e-scenario-complete-${args.plan.scenarioId}`)) {
      throw new ExplorerLiveRunnerError(
        'product',
        'final_scenario_complete_marker_missing',
        args.plan.scenarioId,
      );
    }
    seen.add(request.captureId);
    const scenarioDirectory = resolve(
      args.options.repositoryRoot,
      args.campaignDirectory,
      args.plan.scenarioId,
    );
    mkdirSync(scenarioDirectory, { recursive: true });
    commandResult(buildMaestroScreenshotCommand({
      simulatorId: args.options.simulatorId,
      metroUrl: args.options.metroUrl,
      screenshotRelativePath:
        `${args.campaignDirectory}/${request.requestedScreenshotRelativePath}`,
      maestroBinary: args.options.maestroBinary,
    }), args.options.repositoryRoot, Math.max(
      1,
      args.hardDeadline - (args.options.nowMs ?? Date.now)(),
    ));
    const capturedHierarchy = commandResult(buildMaestroHierarchyCommand({
      simulatorId: args.options.simulatorId,
      maestroBinary: args.options.maestroBinary,
    }), args.options.repositoryRoot, Math.max(
      1,
      args.hardDeadline - (args.options.nowMs ?? Date.now)(),
    ));
    writeFileSync(resolve(
      args.options.repositoryRoot,
      args.campaignDirectory,
      request.requestedHierarchyRelativePath,
    ), JSON.stringify({
      format: EXPLORER_HIERARCHY_FORMAT,
      hierarchy: capturedHierarchy,
    }, null, 2) + '\n', 'utf8');
    const receipt = createEvidenceReceiptFromFiles({
      request,
      repositoryRoot: args.options.repositoryRoot,
      campaignDirectory: args.campaignDirectory,
      integratedRepositorySha: args.options.integratedRepositorySha,
    });
    receipts.push(receipt);
    const acknowledgement = writeExplorerPhysicalEvidenceReceiptFile({
      receipt,
      repositoryRoot: args.options.repositoryRoot,
      campaignDirectory: args.campaignDirectory,
    });
    writeFileSync(resolve(scenarioDirectory, 'physical-evidence-receipts.json'),
      JSON.stringify({
        schemaVersion: EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION,
        campaignId: args.campaignId,
        scenarioId: args.plan.scenarioId,
        receipts,
      }, null, 2) + '\n', 'utf8');
    commandResult(buildExplorerDeepLinkCommand({
      simulatorId: args.options.simulatorId,
      metroUrl: args.options.metroUrl,
      deepLink: explorerEvidenceAcknowledgementUrl(acknowledgement),
    }), args.options.repositoryRoot, Math.max(
      1,
      args.hardDeadline - (args.options.nowMs ?? Date.now)(),
    ));
    await waitForHierarchyValue({
      options: args.options,
      deadline: args.hardDeadline,
      predicate: (value) => value.includes(
        `e2e-explorer-capture-accepted-${request.captureId}`,
      ),
    });
    if ((request.capturePhase === 'seed-reset' ||
      request.capturePhase === 'after-reload') && nextStep) {
      await waitForHierarchyValue({
        options: args.options,
        deadline: args.hardDeadline,
        predicate: (value) => value.includes(
          `e2e-next-action-eligible-${args.plan.scenarioId}-${nextStep.stepId}`,
        ) && value.includes(
          `e2e-explorer-next-action-eligible-${args.plan.scenarioId}-${nextStep.stepId}`,
        ) && value.includes(
          `e2e-explorer-action-awaiting-${args.plan.scenarioId}-${nextStep.stepId}`,
        ),
      });
      commandResult(buildMaestroActionIngressTapCommand({
        simulatorId: args.options.simulatorId,
        controlId: nextStep.controlTestId,
        maestroBinary: args.options.maestroBinary,
      }), args.options.repositoryRoot, Math.max(
        1,
        args.hardDeadline - (args.options.nowMs ?? Date.now)(),
      ));
      await waitForHierarchyValue({
        options: args.options,
        deadline: args.hardDeadline,
        predicate: (value) => value.includes(
          `e2e-explorer-action-claimed-${args.plan.scenarioId}-${nextStep.stepId}`,
        ),
      });
      await waitForHierarchyValue({
        options: args.options,
        deadline: args.hardDeadline,
        predicate: (value) => value.includes(
          `e2e-explorer-action-receipt-${args.plan.scenarioId}-${nextStep.stepId}`,
        ),
      });
    }
  }
  await waitForHierarchyValue({
    options: args.options,
    deadline: args.hardDeadline,
    predicate: (value) => value.includes(
      `e2e-scenario-complete-${args.plan.scenarioId}`,
    ),
  });
  await waitForHierarchyValue({
    options: args.options,
    deadline: args.hardDeadline,
    predicate: (value) => value.includes(
      `e2e-explorer-artifact-accepted-${args.plan.scenarioId}`,
    ),
  });
  validateScenarioPhysicalEvidenceBundle({
    scenarioId: args.plan.scenarioId,
    plan: args.plan,
    receipts,
    repositoryRoot: args.options.repositoryRoot,
    campaignDirectory: args.campaignDirectory,
    integratedRepositorySha: args.options.integratedRepositorySha,
  });
  return receipts;
}

export async function runExplorerNineLive(
  options: ExplorerLiveRunnerOptions,
): Promise<{ campaignId: string; elapsedMs: number; exceededTarget: boolean }> {
  const nowMs = options.nowMs ?? Date.now;
  const metroPreflight = await preflightExplorerMetro({
    metroUrl: options.metroUrl,
    reservedMetroPort: options.reservedMetroPort,
  });
  const booted = parseBootedIOSSimulators(commandResult({
    command: 'xcrun',
    args: ['simctl', 'list', 'devices', 'booted', '--json'],
  }, options.repositoryRoot));
  assertOneSelectedSimulator(booted, options.simulatorId);
  const currentSha = commandResult({
    command: 'git',
    args: ['rev-parse', 'HEAD'],
  }, options.repositoryRoot).trim();
  const dirty = commandResult({
    command: 'git',
    args: ['status', '--porcelain', '--untracked-files=all'],
  }, options.repositoryRoot).trim();
  if (dirty.length > 0) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      'integrated_repository_not_clean',
    );
  }
  if (currentSha !== options.integratedRepositorySha ||
    !/^[a-f0-9]{40}$/.test(currentSha)) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      'integrated_repository_sha_mismatch',
    );
  }
  preflightInstalledExplorerDebugApp({
    simulatorId: options.simulatorId,
    repositoryRoot: options.repositoryRoot,
    integratedRepositorySha: currentSha,
  });
  const campaignId = `explorer-nine-${currentSha.slice(0, 12)}`;
  const campaignDirectory = explorerCampaignArtifactDirectory(campaignId);
  const startedAt = nowMs();
  const hardDeadline = startedAt + EXPLORER_LIVE_RUNNER_HARD_STOP_MS;
  writeExplorerCampaignEnvironmentReceipt({
    repositoryRoot: options.repositoryRoot,
    campaignDirectory,
    campaignId,
    integratedRepositorySha: currentSha,
    e2eMetroUrl: options.metroUrl,
    metroUrl: metroPreflight.metroUrl,
    reservedMetroPort: options.reservedMetroPort,
    bundleEndpoint: metroPreflight.bundleEndpoint,
  });
  await runExplorerInitialCampaignBootstrap({
    launch: () => launchExplorerApp({
      options,
      purpose: 'initial-cold-launch',
      hardDeadline,
    }),
    sendCampaignStart: () => {
      commandResult(buildExplorerDeepLinkCommand({
        simulatorId: options.simulatorId,
        metroUrl: options.metroUrl,
        deepLink: explorerEvidenceCampaignStartUrl({
          campaignId,
          integratedRepositorySha: currentSha,
        }),
      }), options.repositoryRoot, Math.max(1, hardDeadline - nowMs()));
    },
    waitForCampaignAccepted: async () => {
      await waitForHierarchyValue({
        options,
        deadline: hardDeadline,
        predicate: (hierarchy) => hierarchy.includes(
          `e2e-explorer-campaign-accepted-${campaignId}`,
        ),
      });
    },
  });
  await launchExplorerApp({
    options,
    purpose: 'diagnostic-relaunch',
    hardDeadline,
  });
  await waitForHierarchyValue({
    options,
    deadline: hardDeadline,
    predicate: (hierarchy) => hierarchy.includes(
      `e2e-explorer-campaign-accepted-${campaignId}`,
    ),
  });
  const completed: Array<{
    plan: ReturnType<typeof compileExplorerNineCapturePlan>[number];
    receipts: readonly ExplorerPhysicalEvidenceReceiptV1[];
  }> = [];
  const observedArtifactAcceptances = new Set<string>();
  for (const plan of compileExplorerNineCapturePlan()) {
    if (nowMs() >= hardDeadline) {
      throw new ExplorerLiveRunnerError('infrastructure', 'campaign_hard_stop_expired');
    }
    const scenario = await runWholeScenarioWithInfrastructureRetry({
      run: (attempt) => runScenario({
        options,
        campaignId,
        campaignDirectory,
        plan,
        hardDeadline,
        launchPurpose: attempt === 1
          ? 'scenario-reset'
          : 'infrastructure-retry',
      }),
    });
    completed.push({ plan, receipts: scenario.result });
    // runScenario returns only after visibly observing this exact marker.
    observedArtifactAcceptances.add(plan.scenarioId);
  }
  if (!completed.every(({ plan }) =>
    observedArtifactAcceptances.has(plan.scenarioId))) {
    throw new ExplorerLiveRunnerError(
      'infrastructure',
      'campaign_artifact_acceptance_incomplete',
    );
  }
  // Campaign completion revalidates every immutable scenario bundle rather
  // than trusting the earlier per-scenario pass.
  for (const scenario of completed) {
    validateScenarioPhysicalEvidenceBundle({
      scenarioId: scenario.plan.scenarioId,
      plan: scenario.plan,
      receipts: scenario.receipts,
      repositoryRoot: options.repositoryRoot,
      campaignDirectory,
      integratedRepositorySha: options.integratedRepositorySha,
    });
  }
  const elapsedMs = nowMs() - startedAt;
  return {
    campaignId,
    elapsedMs,
    exceededTarget: elapsedMs > EXPLORER_LIVE_RUNNER_TARGET_MS,
  };
}

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? '' : process.argv[index + 1] ?? '';
  if (!value) throw new Error(`Missing required ${name}`);
  return value;
}

function environment(name: string): string {
  const value = process.env[name] ?? '';
  if (!value) throw new Error(`Missing required ${name}`);
  return value;
}

function portArgument(name: string): number {
  const raw = argument(name);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`Invalid ${name}: ${raw}`);
  }
  return value;
}

async function main(): Promise<void> {
  const repositoryRoot = process.cwd();
  const result = await runExplorerNineLive({
    simulatorId: argument('--simulator'),
    metroUrl: environment('E2E_METRO_URL'),
    reservedMetroPort: portArgument('--reserved-metro-port'),
    integratedRepositorySha: commandResult({
      command: 'git',
      args: ['rev-parse', 'HEAD'],
    }, repositoryRoot).trim(),
    repositoryRoot,
  });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
