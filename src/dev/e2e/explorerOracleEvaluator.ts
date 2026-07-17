import type {
  ExplorerInvariantId,
  ExplorerOracleAssertion,
  ExplorerOracleSubject,
} from './explorerOracleContracts';
import { EXPLORER_REQUIRED_INVARIANT_IDS } from './explorerOracleContracts';
import {
  explorerActionCapability,
  type ExplorerActionType,
  type ExplorerJsonValue,
  type ExplorerScenarioContract,
  type ExplorerScenarioStep,
} from './explorerScenarioContracts';
import {
  semanticFingerprintV2,
  stableSemanticJsonV2,
} from '../../utils/semanticFingerprintV2';

export const EXPLORER_ORACLE_EVALUATION_POINTS = [
  'after-action',
  'after-reload',
  'scenario-end',
] as const;

export type ExplorerOracleEvaluationPoint =
  (typeof EXPLORER_ORACLE_EVALUATION_POINTS)[number];

export const EXPLORER_ORACLE_FAILURE_CODES = [
  'expected_projection_missing',
  'actual_projection_missing',
  'projection_mismatch',
  'expected_absence_but_present',
  'fingerprint_mismatch',
  'render_witness_missing',
  'render_identity_mismatch',
  'trace_receipt_missing',
  'trace_result_mismatch',
  'prior_trace_link_broken',
  'persistence_mismatch',
  'interpretation_receipt_missing',
  'metamorphic_mismatch',
  'restoration_mismatch',
  'unrelated_state_changed',
  'invalid_evaluation_point',
  'unsupported_capability',
] as const;

export type ExplorerOracleFailureCode =
  (typeof EXPLORER_ORACLE_FAILURE_CODES)[number];

interface ExplorerEvidenceReference {
  /** Stable logical evidence ID. Absolute filesystem paths are never emitted. */
  readonly evidenceReferenceId: string;
}

interface ExplorerProjectionIdentity extends ExplorerEvidenceReference {
  readonly stepId: string;
  readonly subject: ExplorerOracleSubject;
  readonly selector: string;
}

export type ExplorerProjectionSnapshot =
  | (ExplorerProjectionIdentity & {
      readonly presence: 'present';
      readonly value: ExplorerJsonValue;
    })
  | (ExplorerProjectionIdentity & {
      readonly presence: 'absent';
    });

export interface ExplorerSemanticFingerprintReceipt
  extends ExplorerEvidenceReference {
  readonly stepId: string;
  readonly subject: ExplorerOracleSubject;
  readonly phase: 'before' | 'after' | 'accepted';
  readonly fingerprint: string;
}

export type ExplorerRenderWitnessReceipt =
  | (ExplorerEvidenceReference & {
      readonly stepId: string;
      readonly testId: string;
      readonly selector: string;
      readonly presence: 'present';
      readonly semanticFingerprint: string;
    })
  | (ExplorerEvidenceReference & {
      readonly stepId: string;
      readonly testId: string;
      readonly selector: string;
      readonly presence: 'absent';
    });

export interface ExplorerTraceV2ProductionReceipt
  extends ExplorerEvidenceReference {
  readonly stepId: string;
  readonly traceId: string;
  readonly schemaVersion: number;
  readonly terminalStatus: 'finalized_success' | 'finalized_failure';
}

export interface ExplorerInterpretationReceipt
  extends ExplorerEvidenceReference {
  readonly stepId: string;
  readonly conversationId: string;
  readonly messageId: string;
  readonly actionType: ExplorerActionType;
}

export interface ExplorerUnchangedStateWitness
  extends ExplorerEvidenceReference {
  readonly stepId: string;
  readonly selector: string;
  readonly beforeFingerprint: string;
  readonly afterFingerprint: string;
}

export interface ExplorerFixtureAnchorWitness
  extends ExplorerEvidenceReference {
  readonly stepId: string;
  readonly selector: string;
  readonly acceptedFingerprint: string;
  readonly fixtureAnchorFingerprint: string;
  readonly valid: boolean;
}

export interface ExplorerCardDetailWitness
  extends ExplorerEvidenceReference {
  readonly stepId: string;
  readonly selector: string;
  readonly cardPresence: 'present' | 'absent';
  readonly detailPresence: 'present' | 'absent';
  readonly cardFingerprint: string | null;
  readonly detailFingerprint: string | null;
}

/**
 * Pure runtime-to-oracle boundary. Every field is an already-captured typed
 * receipt or snapshot; the evaluator has no store, React, persistence, file,
 * service, or reply-text dependency.
 */
export interface ExplorerOracleEvaluationContext {
  readonly scenarioId: string;
  readonly stepId: string;
  readonly evaluationPoint: ExplorerOracleEvaluationPoint;
  readonly canonicalAcceptedStateProjections: readonly ExplorerProjectionSnapshot[];
  readonly persistedStateProjections: readonly ExplorerProjectionSnapshot[];
  readonly semanticFingerprints: readonly ExplorerSemanticFingerprintReceipt[];
  readonly renderWitnessReceipts: readonly ExplorerRenderWitnessReceipt[];
  readonly traceV2ProductionReceipts: readonly ExplorerTraceV2ProductionReceipt[];
  readonly activeTraceId: string | null;
  readonly priorTraceId: string | null;
  readonly interpretationReceipts: readonly ExplorerInterpretationReceipt[];
  readonly beforeProjections: readonly ExplorerProjectionSnapshot[];
  readonly afterProjections: readonly ExplorerProjectionSnapshot[];
  readonly restoredProjections: readonly ExplorerProjectionSnapshot[];
  readonly unchangedStateWitnesses: readonly ExplorerUnchangedStateWitness[];
  readonly fixtureAnchorWitnesses: readonly ExplorerFixtureAnchorWitness[];
  readonly cardDetailWitnesses: readonly ExplorerCardDetailWitness[];
}

export type ExplorerOracleFingerprintOrValue =
  | { readonly kind: 'semantic-fingerprint'; readonly fingerprint: string }
  | { readonly kind: 'value'; readonly value: ExplorerJsonValue }
  | { readonly kind: 'missing' };

export interface ExplorerOracleEvaluationReceipt {
  readonly scenarioId: string;
  readonly oracleId: string;
  readonly stepId: string;
  readonly evaluationPoint: ExplorerOracleEvaluationPoint | 'invalid';
  readonly passed: boolean;
  readonly expectedFingerprintOrValue: ExplorerOracleFingerprintOrValue;
  readonly actualFingerprintOrValue: ExplorerOracleFingerprintOrValue;
  readonly failureCode: ExplorerOracleFailureCode | null;
  readonly firstDivergentProjection: string | null;
  readonly evidenceReferenceIds: readonly string[];
  readonly invariantIdsAffected: readonly ExplorerInvariantId[];
}

export interface ExplorerScenarioOracleEvaluationSummary {
  readonly passed: boolean;
  readonly firstFailingStepId: string | null;
  readonly firstFailingOracleId: string | null;
  readonly firstDivergentProjection: string | null;
  readonly orderedEvaluationReceipts: readonly ExplorerOracleEvaluationReceipt[];
  readonly hardFailureCount: number;
}

const MISSING: ExplorerOracleFingerprintOrValue = { kind: 'missing' };

const ORACLE_INVARIANTS: Readonly<
  Record<ExplorerOracleAssertion['type'], readonly ExplorerInvariantId[]>
> = {
  'accepted-state-projection': [
    'no-false-success',
    'source-fact-has-programming-effect',
    'fixture-anchor-valid',
  ],
  absence: ['no-false-success', 'fixture-anchor-valid'],
  'semantic-fingerprint': [
    'no-false-success',
    'source-fact-has-programming-effect',
  ],
  'rendered-witness': [
    'render-equals-accepted-state',
    'card-detail-equality',
    'coach-response-agrees-with-visible-plan',
  ],
  'trace-v2-production-receipt': ['no-false-success'],
  'prior-trace-linkage': ['trace-chain-contiguous'],
  'persisted-accepted-equality': ['durable-readback-equals-accepted-state'],
  'interpretation-receipt': ['coach-response-agrees-with-visible-plan'],
  'metamorphic-equality': ['same-seed-same-replay'],
  'restoration-equality': ['restoration-equals-pre-mutation-state'],
  'unrelated-state-unchanged': ['unrelated-state-unchanged'],
};

function fingerprint(value: ExplorerJsonValue): ExplorerOracleFingerprintOrValue {
  return {
    kind: 'semantic-fingerprint',
    fingerprint: semanticFingerprintV2(value),
  };
}

function fingerprintReceipt(value: string): ExplorerOracleFingerprintOrValue {
  return { kind: 'semantic-fingerprint', fingerprint: value };
}

function protocolValue(value: ExplorerJsonValue): ExplorerOracleFingerprintOrValue {
  return { kind: 'value', value };
}

function snapshotValue(
  snapshot: ExplorerProjectionSnapshot,
): ExplorerOracleFingerprintOrValue {
  return snapshot.presence === 'present'
    ? fingerprint(snapshot.value)
    : protocolValue('absent');
}

function snapshotSemanticFingerprint(snapshot: ExplorerProjectionSnapshot): string {
  return snapshot.presence === 'present'
    ? semanticFingerprintV2(snapshot.value)
    : semanticFingerprintV2({ presence: 'absent' });
}

function isEvaluationPoint(value: unknown): value is ExplorerOracleEvaluationPoint {
  return EXPLORER_ORACLE_EVALUATION_POINTS.includes(
    value as ExplorerOracleEvaluationPoint,
  );
}

function safeEvidenceReferenceId(value: string): boolean {
  return !(
    value.startsWith('/') ||
    value.startsWith('\\\\') ||
    value.startsWith('file:') ||
    /^[A-Za-z]:[\\/]/.test(value)
  );
}

function evidenceReferenceIds(
  ...receipts: ReadonlyArray<ExplorerEvidenceReference | null | undefined>
): readonly string[] {
  return [...new Set(
    receipts
      .map((receipt) => receipt?.evidenceReferenceId)
      .filter((value): value is string =>
        typeof value === 'string' && safeEvidenceReferenceId(value)),
  )].sort((left, right) => left.localeCompare(right));
}

function stableReceipt<T extends ExplorerEvidenceReference>(
  values: readonly T[],
  predicate: (value: T) => boolean,
): T | undefined {
  return values
    .filter(predicate)
    .slice()
    .sort((left, right) =>
      left.evidenceReferenceId.localeCompare(right.evidenceReferenceId))[0];
}

function affectedInvariants(
  step: ExplorerScenarioStep,
  oracle: ExplorerOracleAssertion,
): readonly ExplorerInvariantId[] {
  const mapped = new Set(ORACLE_INVARIANTS[oracle.type]);
  const required = new Set(step.requiredInvariants);
  return EXPLORER_REQUIRED_INVARIANT_IDS.filter(
    (invariant): invariant is ExplorerInvariantId =>
      mapped.has(invariant) && required.has(invariant),
  );
}

interface ReceiptResult {
  readonly passed: boolean;
  readonly expected: ExplorerOracleFingerprintOrValue;
  readonly actual: ExplorerOracleFingerprintOrValue;
  readonly failureCode: ExplorerOracleFailureCode | null;
  readonly divergent: string | null;
  readonly evidence: readonly ExplorerEvidenceReference[];
}

function result(
  passed: boolean,
  expected: ExplorerOracleFingerprintOrValue,
  actual: ExplorerOracleFingerprintOrValue,
  failureCode: ExplorerOracleFailureCode | null,
  divergent: string | null,
  evidence: readonly ExplorerEvidenceReference[] = [],
): ReceiptResult {
  return { passed, expected, actual, failureCode, divergent, evidence };
}

function projection(
  values: readonly ExplorerProjectionSnapshot[],
  stepId: string,
  subject: ExplorerOracleSubject,
  selector: string,
): ExplorerProjectionSnapshot | undefined {
  return stableReceipt(
    values,
    (candidate) =>
      candidate.stepId === stepId &&
      candidate.subject === subject &&
      candidate.selector === selector,
  );
}

function currentSubjectProjection(
  context: ExplorerOracleEvaluationContext,
  subject: ExplorerOracleSubject,
  selector: string,
): ExplorerProjectionSnapshot | undefined {
  if (subject === 'persisted-state') {
    return projection(
      context.persistedStateProjections,
      context.stepId,
      subject,
      selector,
    );
  }
  if (subject === 'accepted-state' || subject === 'source-facts') {
    return projection(
      context.canonicalAcceptedStateProjections,
      context.stepId,
      subject,
      selector,
    );
  }
  return undefined;
}

function evaluateAcceptedProjection(
  oracle: Extract<ExplorerOracleAssertion, { type: 'accepted-state-projection' }>,
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  const expected = fingerprint(oracle.expectedValue);
  const actual = projection(
    context.canonicalAcceptedStateProjections,
    context.stepId,
    'accepted-state',
    oracle.selector,
  );
  if (!actual || actual.presence === 'absent') {
    return result(
      false,
      expected,
      actual ? snapshotValue(actual) : MISSING,
      'actual_projection_missing',
      oracle.selector,
      actual ? [actual] : [],
    );
  }
  const actualValue = snapshotValue(actual);
  const passed = actualValue.kind === 'semantic-fingerprint' &&
    expected.kind === 'semantic-fingerprint' &&
    actualValue.fingerprint === expected.fingerprint;
  return result(
    passed,
    expected,
    actualValue,
    passed ? null : 'projection_mismatch',
    passed ? null : oracle.selector,
    [actual],
  );
}

function cardDetailPresence(
  context: ExplorerOracleEvaluationContext,
  subject: 'visible-card' | 'visible-detail',
  selector: string,
): { readonly presence: 'present' | 'absent'; readonly evidence: ExplorerCardDetailWitness } | null {
  const witness = stableReceipt(
    context.cardDetailWitnesses,
    (candidate) => candidate.stepId === context.stepId && candidate.selector === selector,
  );
  if (!witness) return null;
  return {
    presence: subject === 'visible-card'
      ? witness.cardPresence
      : witness.detailPresence,
    evidence: witness,
  };
}

function evaluateAbsence(
  oracle: Extract<ExplorerOracleAssertion, { type: 'absence' }>,
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  const expected = protocolValue('absent');
  if (oracle.subject === 'visible-card' || oracle.subject === 'visible-detail') {
    const visible = cardDetailPresence(context, oracle.subject, oracle.selector);
    if (!visible) {
      return result(
        false,
        expected,
        MISSING,
        'actual_projection_missing',
        oracle.selector,
      );
    }
    const passed = visible.presence === 'absent';
    return result(
      passed,
      expected,
      protocolValue(visible.presence),
      passed ? null : 'expected_absence_but_present',
      passed ? null : oracle.selector,
      [visible.evidence],
    );
  }
  const actual = currentSubjectProjection(context, oracle.subject, oracle.selector);
  if (!actual) {
    return result(
      false,
      expected,
      MISSING,
      'actual_projection_missing',
      oracle.selector,
    );
  }
  const passed = actual.presence === 'absent';
  return result(
    passed,
    expected,
    actual.presence === 'absent' ? protocolValue('absent') : snapshotValue(actual),
    passed ? null : 'expected_absence_but_present',
    passed ? null : oracle.selector,
    [actual],
  );
}

function semanticReceipt(
  context: ExplorerOracleEvaluationContext,
  subject: ExplorerOracleSubject,
  phase: ExplorerSemanticFingerprintReceipt['phase'],
): ExplorerSemanticFingerprintReceipt | undefined {
  return stableReceipt(
    context.semanticFingerprints,
    (candidate) =>
      candidate.stepId === context.stepId &&
      candidate.subject === subject &&
      candidate.phase === phase,
  );
}

function evaluateSemanticFingerprint(
  oracle: Extract<ExplorerOracleAssertion, { type: 'semantic-fingerprint' }>,
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  const expectedReceipt = oracle.relation === 'equals-accepted'
    ? semanticReceipt(context, 'accepted-state', 'accepted')
    : semanticReceipt(context, oracle.subject, 'before');
  const actualReceipt = semanticReceipt(context, oracle.subject, 'after');
  const divergent = `/semantic-fingerprints/${oracle.subject}`;
  if (!expectedReceipt) {
    return result(
      false,
      MISSING,
      actualReceipt ? fingerprintReceipt(actualReceipt.fingerprint) : MISSING,
      'expected_projection_missing',
      divergent,
      actualReceipt ? [actualReceipt] : [],
    );
  }
  if (!actualReceipt) {
    return result(
      false,
      fingerprintReceipt(expectedReceipt.fingerprint),
      MISSING,
      'actual_projection_missing',
      divergent,
      [expectedReceipt],
    );
  }
  const equal = expectedReceipt.fingerprint === actualReceipt.fingerprint;
  const passed = oracle.relation === 'changed-from-before' ? !equal : equal;
  return result(
    passed,
    fingerprintReceipt(expectedReceipt.fingerprint),
    fingerprintReceipt(actualReceipt.fingerprint),
    passed ? null : 'fingerprint_mismatch',
    passed ? null : divergent,
    [expectedReceipt, actualReceipt],
  );
}

function evaluateRenderedWitness(
  oracle: Extract<ExplorerOracleAssertion, { type: 'rendered-witness' }>,
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  const witness = stableReceipt(
    context.renderWitnessReceipts,
    (candidate) =>
      candidate.stepId === context.stepId &&
      candidate.testId === oracle.testId &&
      candidate.selector === oracle.selector,
  );
  const divergent = oracle.selector;
  if (!witness) {
    return result(
      false,
      oracle.relation === 'absent' ? protocolValue('absent') : protocolValue('present'),
      MISSING,
      'render_witness_missing',
      divergent,
    );
  }
  if (oracle.relation === 'present' || oracle.relation === 'absent') {
    const expectedPresence = oracle.relation;
    const passed = witness.presence === expectedPresence;
    return result(
      passed,
      protocolValue(expectedPresence),
      protocolValue(witness.presence),
      passed ? null : 'render_identity_mismatch',
      passed ? null : divergent,
      [witness],
    );
  }
  const accepted = projection(
    context.canonicalAcceptedStateProjections,
    context.stepId,
    'accepted-state',
    oracle.selector,
  );
  if (!accepted || accepted.presence === 'absent') {
    return result(
      false,
      MISSING,
      witness.presence === 'present'
        ? fingerprintReceipt(witness.semanticFingerprint)
        : protocolValue('absent'),
      'expected_projection_missing',
      divergent,
      accepted ? [accepted, witness] : [witness],
    );
  }
  const expectedFingerprint = snapshotSemanticFingerprint(accepted);
  if (witness.presence === 'absent') {
    return result(
      false,
      fingerprintReceipt(expectedFingerprint),
      protocolValue('absent'),
      'render_identity_mismatch',
      divergent,
      [accepted, witness],
    );
  }
  const passed = expectedFingerprint === witness.semanticFingerprint;
  return result(
    passed,
    fingerprintReceipt(expectedFingerprint),
    fingerprintReceipt(witness.semanticFingerprint),
    passed ? null : 'render_identity_mismatch',
    passed ? null : divergent,
    [accepted, witness],
  );
}

function evaluateTraceReceipt(
  oracle: Extract<ExplorerOracleAssertion, { type: 'trace-v2-production-receipt' }>,
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  const expected = protocolValue({
    schemaVersion: oracle.schemaVersion,
    terminalStatus: oracle.terminalStatus,
  });
  const receipt = stableReceipt(
    context.traceV2ProductionReceipts,
    (candidate) => candidate.stepId === context.stepId,
  );
  if (!receipt) {
    return result(
      false,
      expected,
      MISSING,
      'trace_receipt_missing',
      '/trace-v2',
    );
  }
  const actual = protocolValue({
    schemaVersion: receipt.schemaVersion,
    terminalStatus: receipt.terminalStatus,
    traceId: receipt.traceId,
    activeTraceId: context.activeTraceId,
  });
  const passed = receipt.schemaVersion === oracle.schemaVersion &&
    receipt.terminalStatus === oracle.terminalStatus &&
    context.activeTraceId === receipt.traceId;
  return result(
    passed,
    expected,
    actual,
    passed ? null : 'trace_result_mismatch',
    passed ? null : '/trace-v2',
    [receipt],
  );
}

function evaluatePriorTraceLinkage(
  oracle: Extract<ExplorerOracleAssertion, { type: 'prior-trace-linkage' }>,
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  const priorReceipt = stableReceipt(
    context.traceV2ProductionReceipts,
    (candidate) => candidate.stepId === oracle.priorStepId,
  );
  if (!priorReceipt) {
    return result(
      false,
      MISSING,
      context.priorTraceId === null ? MISSING : protocolValue(context.priorTraceId),
      'trace_receipt_missing',
      '/trace-v2/priorActionTraceId',
    );
  }
  const currentReceipt = stableReceipt(
    context.traceV2ProductionReceipts,
    (candidate) => candidate.stepId === context.stepId,
  );
  const passed = context.priorTraceId === priorReceipt.traceId &&
    currentReceipt !== undefined &&
    context.activeTraceId === currentReceipt.traceId;
  return result(
    passed,
    protocolValue(priorReceipt.traceId),
    context.priorTraceId === null ? MISSING : protocolValue(context.priorTraceId),
    passed ? null : 'prior_trace_link_broken',
    passed ? null : '/trace-v2/priorActionTraceId',
    currentReceipt ? [priorReceipt, currentReceipt] : [priorReceipt],
  );
}

function evaluatePersistedAcceptedEquality(
  oracle: Extract<ExplorerOracleAssertion, { type: 'persisted-accepted-equality' }>,
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  const accepted = projection(
    context.canonicalAcceptedStateProjections,
    context.stepId,
    'accepted-state',
    oracle.selector,
  );
  const persisted = projection(
    context.persistedStateProjections,
    context.stepId,
    'persisted-state',
    oracle.selector,
  );
  if (!accepted) {
    return result(
      false,
      MISSING,
      persisted ? snapshotValue(persisted) : MISSING,
      'expected_projection_missing',
      oracle.selector,
      persisted ? [persisted] : [],
    );
  }
  if (!persisted) {
    return result(
      false,
      snapshotValue(accepted),
      MISSING,
      'actual_projection_missing',
      oracle.selector,
      [accepted],
    );
  }
  const passed = snapshotSemanticFingerprint(accepted) ===
    snapshotSemanticFingerprint(persisted);
  return result(
    passed,
    snapshotValue(accepted),
    snapshotValue(persisted),
    passed ? null : 'persistence_mismatch',
    passed ? null : oracle.selector,
    [accepted, persisted],
  );
}

function evaluateInterpretationReceipt(
  oracle: Extract<ExplorerOracleAssertion, { type: 'interpretation-receipt' }>,
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  const expected = protocolValue({
    conversationId: oracle.conversationId,
    messageId: oracle.messageId,
    actionType: oracle.expectedActionType,
  });
  const receipt = stableReceipt(
    context.interpretationReceipts,
    (candidate) =>
      candidate.stepId === context.stepId &&
      candidate.conversationId === oracle.conversationId &&
      candidate.messageId === oracle.messageId,
  );
  if (!receipt) {
    return result(
      false,
      expected,
      MISSING,
      'interpretation_receipt_missing',
      '/interpretation',
    );
  }
  const actual = protocolValue({
    conversationId: receipt.conversationId,
    messageId: receipt.messageId,
    actionType: receipt.actionType,
  });
  const passed = receipt.actionType === oracle.expectedActionType;
  return result(
    passed,
    expected,
    actual,
    passed ? null : 'projection_mismatch',
    passed ? null : '/interpretation/actionType',
    [receipt],
  );
}

function evaluateMetamorphicEquality(
  oracle: Extract<ExplorerOracleAssertion, { type: 'metamorphic-equality' }>,
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  const left = projection(
    context.afterProjections,
    oracle.leftStepId,
    'accepted-state',
    oracle.selector,
  );
  const right = projection(
    context.afterProjections,
    oracle.rightStepId,
    'accepted-state',
    oracle.selector,
  );
  if (!left) {
    return result(
      false,
      MISSING,
      right ? snapshotValue(right) : MISSING,
      'expected_projection_missing',
      oracle.selector,
      right ? [right] : [],
    );
  }
  if (!right) {
    return result(
      false,
      snapshotValue(left),
      MISSING,
      'actual_projection_missing',
      oracle.selector,
      [left],
    );
  }
  const passed = snapshotSemanticFingerprint(left) === snapshotSemanticFingerprint(right);
  return result(
    passed,
    snapshotValue(left),
    snapshotValue(right),
    passed ? null : 'metamorphic_mismatch',
    passed ? null : oracle.selector,
    [left, right],
  );
}

function evaluateRestorationEquality(
  oracle: Extract<ExplorerOracleAssertion, { type: 'restoration-equality' }>,
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  const baseline = projection(
    context.beforeProjections,
    oracle.baselineStepId,
    'accepted-state',
    oracle.selector,
  );
  const restored = projection(
    context.restoredProjections,
    context.stepId,
    'accepted-state',
    oracle.selector,
  );
  if (!baseline) {
    return result(
      false,
      MISSING,
      restored ? snapshotValue(restored) : MISSING,
      'expected_projection_missing',
      oracle.selector,
      restored ? [restored] : [],
    );
  }
  if (!restored) {
    return result(
      false,
      snapshotValue(baseline),
      MISSING,
      'actual_projection_missing',
      oracle.selector,
      [baseline],
    );
  }
  const passed = snapshotSemanticFingerprint(baseline) ===
    snapshotSemanticFingerprint(restored);
  return result(
    passed,
    snapshotValue(baseline),
    snapshotValue(restored),
    passed ? null : 'restoration_mismatch',
    passed ? null : oracle.selector,
    [baseline, restored],
  );
}

function evaluateUnrelatedStateUnchanged(
  oracle: Extract<ExplorerOracleAssertion, { type: 'unrelated-state-unchanged' }>,
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  const witnesses = oracle.selectors.map((selector) => stableReceipt(
    context.unchangedStateWitnesses,
    (candidate) => candidate.stepId === context.stepId && candidate.selector === selector,
  ));
  const missingIndex = witnesses.findIndex((witness) => witness === undefined);
  if (missingIndex >= 0) {
    return result(
      false,
      MISSING,
      MISSING,
      'actual_projection_missing',
      oracle.selectors[missingIndex],
      witnesses.filter((witness): witness is ExplorerUnchangedStateWitness =>
        witness !== undefined),
    );
  }
  const captured = witnesses as readonly ExplorerUnchangedStateWitness[];
  const divergentIndex = captured.findIndex(
    (witness) => witness.beforeFingerprint !== witness.afterFingerprint,
  );
  const expected = fingerprint(
    captured.map((witness) => [witness.selector, witness.beforeFingerprint]),
  );
  const actual = fingerprint(
    captured.map((witness) => [witness.selector, witness.afterFingerprint]),
  );
  const passed = divergentIndex < 0;
  return result(
    passed,
    expected,
    actual,
    passed ? null : 'unrelated_state_changed',
    passed ? null : oracle.selectors[divergentIndex],
    captured,
  );
}

function evaluateOracleBase(
  oracle: ExplorerOracleAssertion,
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  switch (oracle.type) {
    case 'accepted-state-projection':
      return evaluateAcceptedProjection(oracle, context);
    case 'absence':
      return evaluateAbsence(oracle, context);
    case 'semantic-fingerprint':
      return evaluateSemanticFingerprint(oracle, context);
    case 'rendered-witness':
      return evaluateRenderedWitness(oracle, context);
    case 'trace-v2-production-receipt':
      return evaluateTraceReceipt(oracle, context);
    case 'prior-trace-linkage':
      return evaluatePriorTraceLinkage(oracle, context);
    case 'persisted-accepted-equality':
      return evaluatePersistedAcceptedEquality(oracle, context);
    case 'interpretation-receipt':
      return evaluateInterpretationReceipt(oracle, context);
    case 'metamorphic-equality':
      return evaluateMetamorphicEquality(oracle, context);
    case 'restoration-equality':
      return evaluateRestorationEquality(oracle, context);
    case 'unrelated-state-unchanged':
      return evaluateUnrelatedStateUnchanged(oracle, context);
    default: {
      const exhaustive: never = oracle;
      return exhaustive;
    }
  }
}

function enforceFixtureAnchorInvariant(
  base: ReceiptResult,
  oracle: ExplorerOracleAssertion,
  invariants: readonly ExplorerInvariantId[],
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  if (!base.passed || !invariants.includes('fixture-anchor-valid')) return base;
  const selector = 'selector' in oracle ? oracle.selector : null;
  const witness = stableReceipt(
    context.fixtureAnchorWitnesses,
    (candidate) =>
      candidate.stepId === context.stepId &&
      (selector === null || candidate.selector === selector),
  );
  if (!witness) {
    return result(
      false,
      MISSING,
      MISSING,
      'actual_projection_missing',
      selector ?? '/fixture-anchor',
      base.evidence,
    );
  }
  const passed = witness.valid &&
    witness.acceptedFingerprint === witness.fixtureAnchorFingerprint;
  if (passed) {
    return { ...base, evidence: [...base.evidence, witness] };
  }
  return result(
    false,
    fingerprintReceipt(witness.acceptedFingerprint),
    fingerprintReceipt(witness.fixtureAnchorFingerprint),
    'projection_mismatch',
    witness.selector,
    [...base.evidence, witness],
  );
}

function enforceCardDetailInvariant(
  base: ReceiptResult,
  oracle: ExplorerOracleAssertion,
  invariants: readonly ExplorerInvariantId[],
  context: ExplorerOracleEvaluationContext,
): ReceiptResult {
  if (
    !base.passed ||
    oracle.type !== 'rendered-witness' ||
    !invariants.includes('card-detail-equality')
  ) {
    return base;
  }
  const witness = stableReceipt(
    context.cardDetailWitnesses,
    (candidate) =>
      candidate.stepId === context.stepId && candidate.selector === oracle.selector,
  );
  if (!witness || witness.cardPresence !== 'present' || witness.detailPresence !== 'present') {
    return result(
      false,
      MISSING,
      MISSING,
      'render_witness_missing',
      oracle.selector,
      witness ? [...base.evidence, witness] : base.evidence,
    );
  }
  const passed = witness.cardFingerprint !== null &&
    witness.detailFingerprint !== null &&
    witness.cardFingerprint === witness.detailFingerprint;
  if (passed) {
    return { ...base, evidence: [...base.evidence, witness] };
  }
  return result(
    false,
    witness.cardFingerprint === null
      ? MISSING
      : fingerprintReceipt(witness.cardFingerprint),
    witness.detailFingerprint === null
      ? MISSING
      : fingerprintReceipt(witness.detailFingerprint),
    'render_identity_mismatch',
    oracle.selector,
    [...base.evidence, witness],
  );
}

function evaluateOne(
  step: ExplorerScenarioStep,
  oracle: ExplorerOracleAssertion,
  context: ExplorerOracleEvaluationContext,
): ExplorerOracleEvaluationReceipt {
  const invariants = affectedInvariants(step, oracle);
  let evaluated: ReceiptResult;
  if (!isEvaluationPoint(context.evaluationPoint)) {
    evaluated = result(
      false,
      protocolValue([...EXPLORER_ORACLE_EVALUATION_POINTS]),
      protocolValue('invalid'),
      'invalid_evaluation_point',
      '/evaluation-point',
    );
  } else if (explorerActionCapability(step.action)?.status === 'disabled') {
    const capability = explorerActionCapability(step.action);
    evaluated = result(
      false,
      protocolValue({ capabilityId: capability?.capabilityId ?? null, status: 'enabled' }),
      protocolValue({ capabilityId: capability?.capabilityId ?? null, status: 'disabled' }),
      'unsupported_capability',
      '/capability',
    );
  } else {
    evaluated = evaluateOracleBase(oracle, context);
    evaluated = enforceFixtureAnchorInvariant(evaluated, oracle, invariants, context);
    evaluated = enforceCardDetailInvariant(evaluated, oracle, invariants, context);
  }
  return {
    scenarioId: context.scenarioId,
    oracleId: oracle.oracleId,
    stepId: step.stepId,
    evaluationPoint: isEvaluationPoint(context.evaluationPoint)
      ? context.evaluationPoint
      : 'invalid',
    passed: evaluated.passed,
    expectedFingerprintOrValue: evaluated.expected,
    actualFingerprintOrValue: evaluated.actual,
    failureCode: evaluated.failureCode,
    firstDivergentProjection: evaluated.divergent,
    evidenceReferenceIds: evidenceReferenceIds(...evaluated.evidence),
    invariantIdsAffected: invariants,
  };
}

/** Evaluate one manifest step in manifest oracle order. */
export function evaluateExplorerStepOracles(
  step: ExplorerScenarioStep,
  context: ExplorerOracleEvaluationContext,
): readonly ExplorerOracleEvaluationReceipt[] {
  return step.oracleAssertions.map((oracle) => evaluateOne(step, oracle, context));
}

const EVALUATION_POINT_ORDER: Readonly<
  Record<ExplorerOracleEvaluationReceipt['evaluationPoint'], number>
> = {
  'after-action': 0,
  'after-reload': 1,
  'scenario-end': 2,
  invalid: 3,
};

/**
 * Order already-evaluated receipts by canonical manifest step and oracle order,
 * then select the first hard failure. Canonical Explorer oracles are hard by
 * definition at this layer.
 */
export function summarizeExplorerOracleEvaluations(
  scenario: Pick<ExplorerScenarioContract, 'steps'>,
  receipts: readonly ExplorerOracleEvaluationReceipt[],
): ExplorerScenarioOracleEvaluationSummary {
  const stepOrder = new Map<string, number>();
  const oracleOrder = new Map<string, number>();
  scenario.steps.forEach((step, stepIndex) => {
    stepOrder.set(step.stepId, stepIndex);
    step.oracleAssertions.forEach((oracle, oracleIndex) => {
      oracleOrder.set(`${step.stepId}\u0000${oracle.oracleId}`, oracleIndex);
    });
  });
  const ordered = receipts.slice().sort((left, right) => {
    const leftStep = stepOrder.get(left.stepId) ?? Number.MAX_SAFE_INTEGER;
    const rightStep = stepOrder.get(right.stepId) ?? Number.MAX_SAFE_INTEGER;
    if (leftStep !== rightStep) return leftStep - rightStep;
    const leftOracle = oracleOrder.get(`${left.stepId}\u0000${left.oracleId}`) ??
      Number.MAX_SAFE_INTEGER;
    const rightOracle = oracleOrder.get(`${right.stepId}\u0000${right.oracleId}`) ??
      Number.MAX_SAFE_INTEGER;
    if (leftOracle !== rightOracle) return leftOracle - rightOracle;
    const point = EVALUATION_POINT_ORDER[left.evaluationPoint] -
      EVALUATION_POINT_ORDER[right.evaluationPoint];
    if (point !== 0) return point;
    const identity = left.oracleId.localeCompare(right.oracleId);
    if (identity !== 0) return identity;
    return stableSemanticJsonV2(left).localeCompare(stableSemanticJsonV2(right));
  });
  const failures = ordered.filter((receipt) => !receipt.passed);
  const firstFailure = failures[0] ?? null;
  return {
    passed: failures.length === 0,
    firstFailingStepId: firstFailure?.stepId ?? null,
    firstFailingOracleId: firstFailure?.oracleId ?? null,
    firstDivergentProjection: firstFailure?.firstDivergentProjection ?? null,
    orderedEvaluationReceipts: ordered,
    hardFailureCount: failures.length,
  };
}
