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
  EXPLORER_HIERARCHY_FORMAT,
  EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION,
  explorerCampaignArtifactDirectory,
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

function throwForScenarioErrorMarker(hierarchy: string): void {
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
      'maestro_command_failed',
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

export function assertExplicitMetroUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ExplorerLiveRunnerError('infrastructure', 'metro_url_invalid');
  }
  if (url.protocol !== 'http:' ||
    (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') ||
    !url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new ExplorerLiveRunnerError('infrastructure', 'metro_url_invalid');
  }
  return url;
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

export function buildSimulatorOpenUrlCommand(args: {
  simulatorId: string;
  url: string;
}): ExplorerLiveCommand {
  return {
    command: 'xcrun',
    args: ['simctl', 'openurl', args.simulatorId, args.url],
  };
}

export function explorerEvidenceCampaignStartUrl(args: {
  campaignId: string;
  integratedRepositorySha: string;
}): string {
  return 'localfootyathlete://e2e/explorer/evidence/start/' +
    `${args.campaignId}/${args.integratedRepositorySha}`;
}

export function explorerScenarioRunUrl(scenarioId: string): string {
  return `localfootyathlete://e2e/explorer/run/${scenarioId}`;
}

export function explorerEvidenceAcknowledgementUrl(
  receipt: ExplorerPhysicalEvidenceReceiptV1,
): string {
  return `localfootyathlete://e2e/explorer/evidence/${receipt.captureId}` +
    `?receipt=${encodeURIComponent(JSON.stringify(receipt))}`;
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

async function confirmMetro(url: URL): Promise<void> {
  let response: Response;
  try {
    response = await fetch(new URL('/status', url), {
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new ExplorerLiveRunnerError('infrastructure', 'metro_unreachable');
  }
  const status = await response.text();
  if (!response.ok || !status.includes('packager-status:running')) {
    throw new ExplorerLiveRunnerError('infrastructure', 'metro_not_running');
  }
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

async function runScenario(args: {
  options: ExplorerLiveRunnerOptions;
  campaignId: string;
  campaignDirectory: string;
  plan: ReturnType<typeof compileExplorerNineCapturePlan>[number];
  hardDeadline: number;
}): Promise<readonly ExplorerPhysicalEvidenceReceiptV1[]> {
  commandResult(buildSimulatorOpenUrlCommand({
    simulatorId: args.options.simulatorId,
    url: explorerScenarioRunUrl(args.plan.scenarioId),
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
    if (request.capturePhase === 'seed-reset' ||
      (request.capturePhase === 'after-reload' && nextStep)) {
      if (!nextStep ||
        !hierarchy.includes(
          `e2e-next-action-eligible-${args.plan.scenarioId}-${nextStep.stepId}`,
        ) || !hierarchy.includes(
          `e2e-explorer-next-action-eligible-${args.plan.scenarioId}-${nextStep.stepId}`,
        )) {
        throw new ExplorerLiveRunnerError(
          'product',
          'eligibility_markers_missing',
          nextStep?.stepId ?? args.plan.scenarioId,
        );
      }
    }
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
    writeFileSync(resolve(scenarioDirectory, 'physical-evidence-receipts.json'),
      JSON.stringify({
        schemaVersion: EXPLORER_PHYSICAL_EVIDENCE_SCHEMA_VERSION,
        campaignId: args.campaignId,
        scenarioId: args.plan.scenarioId,
        receipts,
      }, null, 2) + '\n', 'utf8');
    commandResult(buildSimulatorOpenUrlCommand({
      simulatorId: args.options.simulatorId,
      url: explorerEvidenceAcknowledgementUrl(receipt),
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
  const metro = assertExplicitMetroUrl(options.metroUrl);
  const booted = parseBootedIOSSimulators(commandResult({
    command: 'xcrun',
    args: ['simctl', 'list', 'devices', 'booted', '--json'],
  }, options.repositoryRoot));
  assertOneSelectedSimulator(booted, options.simulatorId);
  await confirmMetro(metro);
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
  const campaignId = `explorer-nine-${currentSha.slice(0, 12)}`;
  const campaignDirectory = explorerCampaignArtifactDirectory(campaignId);
  const startedAt = nowMs();
  const hardDeadline = startedAt + EXPLORER_LIVE_RUNNER_HARD_STOP_MS;
  commandResult(buildSimulatorOpenUrlCommand({
    simulatorId: options.simulatorId,
    url: explorerEvidenceCampaignStartUrl({
      campaignId,
      integratedRepositorySha: currentSha,
    }),
  }), options.repositoryRoot, Math.max(1, hardDeadline - nowMs()));
  const completed: Array<{
    plan: ReturnType<typeof compileExplorerNineCapturePlan>[number];
    receipts: readonly ExplorerPhysicalEvidenceReceiptV1[];
  }> = [];
  for (const plan of compileExplorerNineCapturePlan()) {
    if (nowMs() >= hardDeadline) {
      throw new ExplorerLiveRunnerError('infrastructure', 'campaign_hard_stop_expired');
    }
    const scenario = await runWholeScenarioWithInfrastructureRetry({
      run: () => runScenario({
        options,
        campaignId,
        campaignDirectory,
        plan,
        hardDeadline,
      }),
    });
    completed.push({ plan, receipts: scenario.result });
  }
  await waitForHierarchyValue({
    options,
    deadline: hardDeadline,
    predicate: (value) => completed.every(({ plan }) => value.includes(
      `e2e-explorer-artifact-accepted-${plan.scenarioId}`,
    )),
  });
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

async function main(): Promise<void> {
  const repositoryRoot = process.cwd();
  const result = await runExplorerNineLive({
    simulatorId: argument('--simulator'),
    metroUrl: argument('--metro-url'),
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
