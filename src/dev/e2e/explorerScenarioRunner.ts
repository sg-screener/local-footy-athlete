import {
  EXPLORER_DEFAULT_CAPABILITY_STATUS,
  EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS,
  type ExplorerScenarioContract,
  type ExplorerScenarioStep,
} from './explorerScenarioContracts';
import {
  validateExplorerScenarioContract,
} from './explorerScenarioContractValidation';
import {
  EXPLORER_NON_COACH_SMOKE_MANIFESTS,
  resolveExplorerSmokeScenarioManifest,
} from './explorerSmokeScenarioManifests';
import {
  EXPLORER_BOUND_ACTION_TYPES,
  createExplorerProductionBindings,
  type ExplorerProductionBindingDependencies,
  type ExplorerProductionBindings,
} from './explorerProductionBindings';
import {
  bindExplorerRenderExpectationToManifestStep,
  buildExplorerRenderExpectation,
  waitForExplorerRenderReceipt,
  type ExplorerCorrelatedRenderReceipt,
} from './explorerRenderReceiptBindings';
import {
  runExplorerScenario,
  type ExplorerRuntimeDependencies,
  type ExplorerRuntimeResult,
} from './explorerRuntime';
import type { ExplorerExecutableAction } from './explorerActionBridge';

export const EXPLORER_LIVE_ARTIFACT_REASON =
  'live_screenshot_and_accessibility_hierarchy_required' as const;

export type ExplorerScenarioPreflightStatus =
  | 'executable-incomplete-live-artifacts'
  | 'blocked';

export interface ExplorerScenarioPreflightReceipt {
  readonly scenarioId: string;
  readonly status: ExplorerScenarioPreflightStatus;
  readonly reasonCode: string;
  readonly actionTypes: readonly string[];
  readonly ownerBindingsComplete: boolean;
  readonly semanticRenderBindingsComplete: boolean;
  readonly externalArtifacts: {
    readonly screenshot: 'required-live';
    readonly accessibilityHierarchy: 'required-live';
    readonly complete: false;
  };
}

type ExplorerScenarioHostDependencies = Omit<
  ExplorerRuntimeDependencies,
  'loadManifest' | 'actionBridge' | 'waitForReactRender'
>;

export interface ExplorerProductionScenarioRunner {
  readonly productionBindings: ExplorerProductionBindings;
  readonly preflightReceipts: readonly ExplorerScenarioPreflightReceipt[];
  readonly run: (scenarioId: string) => Promise<ExplorerRuntimeResult>;
}

const BOUND_ACTION_TYPES = new Set<string>(EXPLORER_BOUND_ACTION_TYPES);

function actionCanonicalIdentity(action: ExplorerExecutableAction): string {
  switch (action.target.kind) {
    case 'fixture': return action.target.fixtureId;
    case 'session': return action.target.sessionId;
    case 'component': return action.target.componentId;
    case 'injury-episode': return action.target.injuryEpisodeId;
    case 'readiness': return action.target.readinessId;
    case 'equipment-fact': return action.target.equipmentFactId;
    case 'session-feedback': return action.target.feedbackId;
    case 'adjustment': return action.target.adjustmentId;
    case 'week': return action.target.weekId;
  }
}

function preflightRenderBinding(
  manifest: ExplorerScenarioContract,
  step: ExplorerScenarioStep,
): boolean {
  if (step.action.type === 'coach.message') return false;
  const action = step.action;
  const adjustmentId = `preflight-adjustment:${manifest.scenarioId}:${step.stepId}`;
  try {
    const expectation = bindExplorerRenderExpectationToManifestStep(
      buildExplorerRenderExpectation({
        action,
        traceV2RootId: `preflight-trace:${manifest.scenarioId}:${step.stepId}`,
        canonicalSemanticIdentity: actionCanonicalIdentity(action),
        producedAdjustmentId: action.type === 'session.move' ||
          action.type === 'session.delete' ||
          action.type === 'component.delete' ||
          action.type === 'week.repeat'
          ? adjustmentId
          : null,
        exactAdjustmentId: action.type === 'adjustment.restore'
          ? adjustmentId
          : null,
        adjustmentKind: action.type === 'adjustment.restore' &&
          manifest.scenarioId.includes('repeat-week')
          ? 'repeat_week'
          : 'fixture_change',
        feedbackTransactionId: action.type === 'session-feedback.record'
          ? `preflight-feedback:${manifest.scenarioId}:${step.stepId}`
          : null,
        progressionTargetSessionId: action.type === 'session-feedback.record'
          ? action.target.sessionId
          : null,
      }),
      step,
    );
    return expectation.primaryControlId === step.controlTestId &&
      (step.targetTestIds ?? []).every((testId) =>
        expectation.requiredControlIds.includes(testId));
  } catch {
    return false;
  }
}

export function preflightExplorerScenario(
  rawManifest: ExplorerScenarioContract,
): ExplorerScenarioPreflightReceipt {
  let manifest: ExplorerScenarioContract;
  try {
    manifest = validateExplorerScenarioContract(rawManifest, {
      declaredCapabilities: EXPLORER_PRODUCTION_CAPABILITY_DECLARATIONS,
    });
  } catch {
    return {
      scenarioId: rawManifest.scenarioId,
      status: 'blocked',
      reasonCode: 'manifest_invalid',
      actionTypes: rawManifest.steps.map((step) => step.action.type),
      ownerBindingsComplete: false,
      semanticRenderBindingsComplete: false,
      externalArtifacts: {
        screenshot: 'required-live',
        accessibilityHierarchy: 'required-live',
        complete: false,
      },
    };
  }
  const ownerBindingsComplete = manifest.steps.every((step) =>
    step.action.type !== 'coach.message' && BOUND_ACTION_TYPES.has(step.action.type));
  const semanticRenderBindingsComplete = manifest.steps.every((step) =>
    preflightRenderBinding(manifest, step));
  const executable = ownerBindingsComplete && semanticRenderBindingsComplete;
  return {
    scenarioId: manifest.scenarioId,
    status: executable
      ? 'executable-incomplete-live-artifacts'
      : 'blocked',
    reasonCode: executable
      ? EXPLORER_LIVE_ARTIFACT_REASON
      : !ownerBindingsComplete
        ? 'production_owner_binding_missing'
        : 'semantic_render_binding_missing',
    actionTypes: manifest.steps.map((step) => step.action.type),
    ownerBindingsComplete,
    semanticRenderBindingsComplete,
    externalArtifacts: {
      screenshot: 'required-live',
      accessibilityHierarchy: 'required-live',
      complete: false,
    },
  };
}

export function preflightExplorerSmokeScenarios(): readonly ExplorerScenarioPreflightReceipt[] {
  return EXPLORER_NON_COACH_SMOKE_MANIFESTS.map(preflightExplorerScenario);
}

/**
 * Installs only the missing app-facing seams. Seed reset, typed eligibility,
 * oracle capture, checkpoints/reloads and artifact assembly remain owned by
 * their existing runtime/session implementations and are injected here.
 */
export function createExplorerProductionScenarioRunner(args: {
  readonly hostDependencies: ExplorerScenarioHostDependencies;
  readonly bindingDependencies?: Partial<ExplorerProductionBindingDependencies>;
  readonly renderTimeoutMs?: number;
  readonly requireExternalArtifacts?: boolean;
}): ExplorerProductionScenarioRunner {
  const productionBindings = createExplorerProductionBindings({
    dependencies: args.bindingDependencies,
  });
  const waitForReactRender: ExplorerRuntimeDependencies['waitForReactRender'] =
    async ({ receipt }): Promise<ExplorerCorrelatedRenderReceipt | null> => {
      const correlated = await waitForExplorerRenderReceipt({
        receipt,
        timeoutMs: args.renderTimeoutMs,
      });
      if (!correlated) return null;
      // Physical files are acknowledged by the app-owned evidence bridge.
      // The semantic render observer must never manufacture those receipts.
      return correlated;
    };
  return {
    productionBindings,
    preflightReceipts: preflightExplorerSmokeScenarios(),
    run: (scenarioId) => runExplorerScenario(scenarioId, {
      ...args.hostDependencies,
      loadManifest: resolveExplorerSmokeScenarioManifest,
      actionBridge: productionBindings.actionBridge,
      waitForReactRender,
    }),
  };
}

export const EXPLORER_CAMPAIGN_NORMAL_TARGET_MS = 35 * 60 * 1_000;
export const EXPLORER_CAMPAIGN_HARD_STOP_MS = 45 * 60 * 1_000;

export interface ExplorerCampaignScenarioReceipt {
  readonly scenarioId: string;
  readonly attempts: 1 | 2;
  readonly result: ExplorerRuntimeResult;
}

export interface ExplorerCampaignResult {
  readonly status: 'complete' | 'blocked';
  readonly reasonCode: string;
  readonly elapsedMs: number;
  readonly exceededNormalTarget: boolean;
  readonly scenarios: readonly ExplorerCampaignScenarioReceipt[];
}

const RETRYABLE_INFRASTRUCTURE_REASONS = new Set<string>([
  'checkpoint_failed',
  'reload_checkpoint_order_invalid',
  'seed_reset_failed',
]);

/** Runs the exact registry order with one whole-scenario infrastructure retry. */
export async function runAllExplorerSmokeScenarios(args: {
  readonly runner: Pick<ExplorerProductionScenarioRunner, 'run'>;
  readonly nowMs?: () => number;
}): Promise<ExplorerCampaignResult> {
  const nowMs = args.nowMs ?? Date.now;
  const startedAt = nowMs();
  const scenarios: ExplorerCampaignScenarioReceipt[] = [];
  for (const manifest of EXPLORER_NON_COACH_SMOKE_MANIFESTS) {
    if (nowMs() - startedAt >= EXPLORER_CAMPAIGN_HARD_STOP_MS) {
      return {
        status: 'blocked',
        reasonCode: 'campaign_hard_stop_expired',
        elapsedMs: nowMs() - startedAt,
        exceededNormalTarget: true,
        scenarios,
      };
    }
    let result = await args.runner.run(manifest.scenarioId);
    let attempts: 1 | 2 = 1;
    if (result.status === 'blocked' &&
      RETRYABLE_INFRASTRUCTURE_REASONS.has(result.reasonCode) &&
      nowMs() - startedAt < EXPLORER_CAMPAIGN_HARD_STOP_MS) {
      result = await args.runner.run(manifest.scenarioId);
      attempts = 2;
    }
    scenarios.push({ scenarioId: manifest.scenarioId, attempts, result });
    if (result.status !== 'complete') {
      return {
        status: 'blocked',
        reasonCode: result.reasonCode,
        elapsedMs: nowMs() - startedAt,
        exceededNormalTarget:
          nowMs() - startedAt > EXPLORER_CAMPAIGN_NORMAL_TARGET_MS,
        scenarios,
      };
    }
  }
  const elapsedMs = nowMs() - startedAt;
  return {
    status: 'complete',
    reasonCode: 'campaign_complete',
    elapsedMs,
    exceededNormalTarget: elapsedMs > EXPLORER_CAMPAIGN_NORMAL_TARGET_MS,
    scenarios,
  };
}

export function explorerCoachFlowIsDisabled(): boolean {
  return EXPLORER_DEFAULT_CAPABILITY_STATUS['coach.message'] === 'disabled' &&
    EXPLORER_NON_COACH_SMOKE_MANIFESTS.every((manifest) =>
      manifest.steps.every((step) => step.action.type !== 'coach.message'));
}
