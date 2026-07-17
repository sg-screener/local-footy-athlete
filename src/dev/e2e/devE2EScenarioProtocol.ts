import type { DevE2EClockReceipt } from './DevE2EClock';
import type { DevE2EScenarioSessionRecord } from './devE2EScenarioSession';
import { isDevE2ESeedId, type DevE2ESeedId } from './devE2ESeedIds';

export const DEV_E2E_SCENARIO_PROTOCOL_VERSION = 2 as const;

export const DEV_E2E_SCENARIO_REASON = {
  ELIGIBLE: 'eligible',
  COMPLETE: 'scenario_complete',
  RELOAD_REQUIRED: 'reload_required',
  ACTION_IN_PROGRESS: 'action_in_progress',
  CHECKPOINT_DUPLICATE: 'checkpoint_duplicate',
  CHECKPOINT_OUT_OF_ORDER: 'checkpoint_out_of_order',
  STALE_FINGERPRINT: 'stale_fingerprint',
  CORRUPT_SESSION: 'corrupt_session',
  CORRUPT_CHECKPOINT: 'corrupt_checkpoint',
  SESSION_CHECKPOINT_MISMATCH: 'session_checkpoint_mismatch',
  CLOCK_MISMATCH: 'clock_mismatch',
  TRACE_CORRELATION_MISMATCH: 'trace_correlation_mismatch',
  ACTIVE_ACTION_TRACE_MISSING: 'active_action_trace_missing',
  NEXT_ACTION_BLOCKED: 'next_action_blocked',
  NEXT_ACTION_MISMATCH: 'next_action_mismatch',
  ELIGIBILITY_MARKER_MISSING: 'eligibility_marker_missing',
  MANIFEST_NOT_FOUND: 'manifest_not_found',
  MANIFEST_INVALID: 'manifest_invalid',
} as const;

export type DevE2EScenarioReasonCode =
  (typeof DEV_E2E_SCENARIO_REASON)[keyof typeof DEV_E2E_SCENARIO_REASON] | string;

export class DevE2EScenarioProtocolError extends Error {
  readonly reasonCode: DevE2EScenarioReasonCode;

  constructor(reasonCode: DevE2EScenarioReasonCode, message: string) {
    super(message);
    this.name = 'DevE2EScenarioProtocolError';
    this.reasonCode = reasonCode;
  }
}

export function devE2EScenarioReasonCode(error: unknown): string | null {
  return error instanceof DevE2EScenarioProtocolError ? error.reasonCode : null;
}

export interface DevE2EScenarioActionMatcher {
  actionType?: string;
  sources?: Array<'tap' | 'coach' | 'system'>;
  controlId?: string;
  sourceSurface?: string;
}

export interface DevE2EScenarioManifestStep {
  stepId: string;
  action?: DevE2EScenarioActionMatcher;
  eligibilityWitnessIds: string[];
}

export interface DevE2EScenarioManifest {
  protocolVersion: typeof DEV_E2E_SCENARIO_PROTOCOL_VERSION;
  scenarioId: string;
  seedId: DevE2ESeedId;
  steps: DevE2EScenarioManifestStep[];
}

export interface DevE2EScenarioEligibilityContext {
  phase: 'reset' | 'reload';
  manifest: DevE2EScenarioManifest;
  session: DevE2EScenarioSessionRecord;
  nextStep: DevE2EScenarioManifestStep;
}

export interface DevE2EScenarioEligibilityDecision {
  status: 'eligible' | 'blocked';
  reasonCode: string;
  witnessIds: string[];
}

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isDevE2EScenarioProtocolId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

export function validateDevE2EScenarioManifest(
  manifest: DevE2EScenarioManifest,
): DevE2EScenarioManifest {
  if (manifest.protocolVersion !== DEV_E2E_SCENARIO_PROTOCOL_VERSION ||
    !isDevE2EScenarioProtocolId(manifest.scenarioId) ||
    !isDevE2ESeedId(manifest.seedId) ||
    !Array.isArray(manifest.steps) ||
    manifest.steps.length === 0) {
    throw new DevE2EScenarioProtocolError(
      DEV_E2E_SCENARIO_REASON.MANIFEST_INVALID,
      'Dev E2E scenario manifest is invalid.',
    );
  }
  const stepIds = manifest.steps.map((step) => step.stepId);
  if (stepIds.some((stepId) => !isDevE2EScenarioProtocolId(stepId)) ||
    new Set(stepIds).size !== stepIds.length ||
    manifest.steps.some((step) =>
      !Array.isArray(step.eligibilityWitnessIds) ||
      step.eligibilityWitnessIds.some((witnessId) =>
        typeof witnessId !== 'string' || witnessId.length === 0) ||
      (step.action !== undefined && (
        (step.action.actionType !== undefined &&
          (typeof step.action.actionType !== 'string' ||
            step.action.actionType.length === 0)) ||
        (step.action.sources !== undefined && (
          !Array.isArray(step.action.sources) ||
          step.action.sources.length === 0 ||
          step.action.sources.some((source) =>
            source !== 'tap' && source !== 'coach' && source !== 'system')
        )) ||
        (step.action.controlId !== undefined &&
          (typeof step.action.controlId !== 'string' ||
            step.action.controlId.length === 0)) ||
        (step.action.sourceSurface !== undefined &&
          (typeof step.action.sourceSurface !== 'string' ||
            step.action.sourceSurface.length === 0))
      )))) {
    throw new DevE2EScenarioProtocolError(
      DEV_E2E_SCENARIO_REASON.MANIFEST_INVALID,
      `Dev E2E scenario manifest is invalid: ${manifest.scenarioId}.`,
    );
  }
  return manifest;
}

export function devE2EScenarioStep(
  manifest: DevE2EScenarioManifest,
  stepId: string,
): DevE2EScenarioManifestStep | null {
  return manifest.steps.find((step) => step.stepId === stepId) ?? null;
}

export function expectedDevE2ENextStep(
  manifest: DevE2EScenarioManifest,
  checkpointStepId: string | null,
): DevE2EScenarioManifestStep | null {
  if (!checkpointStepId) return manifest.steps[0] ?? null;
  const index = manifest.steps.findIndex((step) => step.stepId === checkpointStepId);
  if (index < 0) {
    throw new DevE2EScenarioProtocolError(
      DEV_E2E_SCENARIO_REASON.CORRUPT_SESSION,
      `Dev E2E scenario session references unknown checkpoint step: ${checkpointStepId}.`,
    );
  }
  return manifest.steps[index + 1] ?? null;
}

/**
 * Protocol-only sessions have no accepted witness vocabulary. They must never
 * become eligible merely because a manifest listed opaque witness IDs; a
 * caller must install a typed evaluator that reads current accepted state.
 */
export function failClosedDevE2EScenarioEligibility(
  context: DevE2EScenarioEligibilityContext,
): DevE2EScenarioEligibilityDecision {
  return {
    status: 'blocked',
    reasonCode: 'typed_eligibility_evaluator_required',
    witnessIds: [
      ...context.nextStep.eligibilityWitnessIds,
      `scenario:${context.manifest.scenarioId}`,
      `seed:${context.manifest.seedId}`,
      `phase:${context.phase}`,
    ],
  };
}

export function deterministicDevE2EScenarioUpdatedAt(args: {
  clockReceipt: DevE2EClockReceipt;
  manifest: DevE2EScenarioManifest;
  checkpointStepId: string | null;
  reloadCount: number;
}): string {
  const stepIndex = args.checkpointStepId
    ? args.manifest.steps.findIndex((step) => step.stepId === args.checkpointStepId)
    : -1;
  if (args.checkpointStepId && stepIndex < 0) {
    throw new DevE2EScenarioProtocolError(
      DEV_E2E_SCENARIO_REASON.CORRUPT_SESSION,
      `Dev E2E scenario session references unknown checkpoint step: ${args.checkpointStepId}.`,
    );
  }
  const transitionOrdinal = args.checkpointStepId
    ? stepIndex + args.reloadCount + 1
    : 0;
  return new Date(
    Date.parse(args.clockReceipt.anchorInstant) + transitionOrdinal,
  ).toISOString();
}
