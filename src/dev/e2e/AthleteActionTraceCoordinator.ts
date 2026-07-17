import {
  SEMANTIC_FINGERPRINT_CONTRACT_V2,
  semanticFingerprintV2,
  type SemanticFingerprintV2,
} from '../../utils/semanticFingerprintV2';

export const ATHLETE_ACTION_TRACE_SCHEMA_VERSION = 2 as const;

export type TraceField<T> =
  | { status: 'captured'; value: T }
  | { status: 'not_applicable'; reason: string }
  | { status: 'missing'; reason: string };

export interface AthleteActionTraceTokenV2 {
  traceId: string;
  spanId: string;
}

export interface AthleteActionTraceRootInputV2 {
  source: 'tap' | 'coach' | 'system';
  actionType: string;
  route?: string;
  campaignId?: string;
  scenarioRunId?: string;
  scenarioStepId?: string;
  seedId?: string;
  buildId?: string;
  priorActionTraceId?: string | null;
  canonicalRequestedAction?: unknown;
  sourceSurface?: string;
  controlId?: string;
  sourceDate?: string;
  targetDate?: string;
  identities?: Partial<AthleteActionStableIdentitiesV2>;
}

export interface AthleteActionStableIdentitiesV2 {
  sessionId: string | null;
  componentId: string | null;
  fixtureId: string | null;
  adjustmentId: string | null;
  injuryEpisodeId: string | null;
}

export interface AthleteSemanticStateV2 {
  reversibleAdjustmentLedger: unknown;
  userRemovalConstraints: unknown;
  injuryEpisodes: unknown;
  temporarySourceFacts: unknown;
  activeConstraints: unknown;
  readiness: unknown;
  sessionFeedback: unknown;
  coachNoteOwnership: unknown;
  overlays: unknown;
  overrides: unknown;
  contracts: unknown;
  provenance: unknown;
  typedReductions: unknown;
}

export interface AthleteSemanticSnapshotV2 {
  fingerprintContract: typeof SEMANTIC_FINGERPRINT_CONTRACT_V2;
  fingerprint: SemanticFingerprintV2;
  componentFingerprints: Record<keyof AthleteSemanticStateV2, SemanticFingerprintV2>;
  state: AthleteSemanticStateV2;
  /** Revision is concurrency/publication metadata and is never hashed into state. */
  acceptedRevision: number;
}

export interface AthleteActionTraceSpanV2 {
  spanId: string;
  parentSpanId: string | null;
  name: string;
  startedAt: string;
  endedAt: string | null;
}

export interface AthleteActionPersistenceEvidenceV2 {
  operation: 'read_before' | 'write_attempt' | 'readback' | 'mirror_write' | 'mirror_readback' | 'rollback_write' | 'rollback_readback';
  store: string;
  attempted: boolean;
  acknowledged: boolean;
  expectedFingerprint: TraceField<SemanticFingerprintV2>;
  actualFingerprint: TraceField<SemanticFingerprintV2>;
  timestamp: string;
}

export interface AthleteActionRepairCandidateV2 {
  candidateId: TraceField<string>;
  selected: boolean;
  rejectedRuleIds: string[];
  rejectedCodes: string[];
  expected: TraceField<unknown>;
  actual: TraceField<unknown>;
  rejectingBoundary: TraceField<string>;
}

export interface AthleteActionUIObservationV2 {
  observationId: string;
  domainReturn: TraceField<unknown>;
  actualRenderedText: TraceField<unknown>;
  controlId: TraceField<string>;
  accessibilityNode: TraceField<unknown>;
  screenshotReference: TraceField<string>;
  hierarchyReference: TraceField<string>;
  observedAt: string | null;
}

export interface CoachClassificationEvidenceV2 {
  status: 'classified' | 'unavailable';
  intentKind: string | null;
  confidenceBucket: 'low' | 'medium' | 'high' | null;
  clarificationFlag: boolean | null;
  provenance: 'deterministic' | 'semantic_service' | null;
  unavailableReasonCode: string | null;
}

export type CoachLegacyFallbackDecisionV2 =
  | 'allowed:genuine_conversation'
  | 'forbidden:deterministic_owner'
  | 'forbidden:policy'
  | 'forbidden:classification_unavailable'
  | 'forbidden:deterministic_failure';

export interface AthleteActionTraceRecordV2 {
  schemaVersion: typeof ATHLETE_ACTION_TRACE_SCHEMA_VERSION;
  fingerprintContract: typeof SEMANTIC_FINGERPRINT_CONTRACT_V2;
  traceId: string;
  status: 'unfinished' | 'finalized_success' | 'finalized_failure';
  requestedTerminalOutcome: TraceField<'success' | 'failure'>;
  startedAt: string;
  finalizedAt: string | null;
  root: {
    campaignId: TraceField<string>;
    scenarioRunId: TraceField<string>;
    scenarioStepId: TraceField<string>;
    seedId: TraceField<string>;
    buildId: TraceField<string>;
    priorActionTraceId: TraceField<string | null>;
    canonicalRequestedAction: TraceField<unknown>;
    source: TraceField<'tap' | 'coach' | 'system'>;
    actionType: TraceField<string>;
    sourceSurface: TraceField<string>;
    controlId: TraceField<string>;
    sourceDate: TraceField<string>;
    targetDate: TraceField<string>;
    identities: {
      sessionId: TraceField<string | null>;
      componentId: TraceField<string | null>;
      fixtureId: TraceField<string | null>;
      adjustmentId: TraceField<string | null>;
      injuryEpisodeId: TraceField<string | null>;
    };
  };
  spans: AthleteActionTraceSpanV2[];
  evidence: {
    coachClassification: TraceField<CoachClassificationEvidenceV2>;
    legacyFallbackDecision: TraceField<CoachLegacyFallbackDecisionV2>;
    acceptedRevisionBefore: TraceField<number>;
    acceptedRevisionAfter: TraceField<number>;
    acceptedRevisionPostReload: TraceField<number>;
    semanticAcceptedBefore: TraceField<AthleteSemanticSnapshotV2>;
    visibleCardBefore: TraceField<unknown>;
    visibleDetailBefore: TraceField<unknown>;
    persistedBefore: TraceField<SemanticFingerprintV2>;
    factsCreated: TraceField<unknown[]>;
    factsExpired: TraceField<unknown[]>;
    constraintsCreated: TraceField<unknown[]>;
    constraintsExpired: TraceField<unknown[]>;
    reversibleAdjustments: TraceField<unknown[]>;
    repairCandidates: TraceField<AthleteActionRepairCandidateV2[]>;
    selectedHorizon: TraceField<unknown>;
    provenanceCreated: TraceField<unknown[]>;
    provenanceExpired: TraceField<unknown[]>;
    typedReductionsCreated: TraceField<unknown[]>;
    typedReductionsRemoved: TraceField<unknown[]>;
    publication: TraceField<unknown>;
    persistence: TraceField<AthleteActionPersistenceEvidenceV2[]>;
    semanticAcceptedAfter: TraceField<AthleteSemanticSnapshotV2>;
    visibleCardAfter: TraceField<unknown>;
    visibleDetailAfter: TraceField<unknown>;
    coachNoteOwnership: TraceField<unknown>;
    renderedCoachNoteCardIds: TraceField<string[]>;
    uiObservation: TraceField<AthleteActionUIObservationV2>;
    rollbackMemory: TraceField<unknown>;
    rollbackProgramEnvelope: TraceField<unknown>;
    rollbackMirrorEnvelopes: TraceField<unknown>;
    rollbackVisibleProjection: TraceField<unknown>;
    postReloadAccepted: TraceField<unknown>;
    postReloadPersisted: TraceField<unknown>;
    postReloadVisible: TraceField<unknown>;
    postReloadCoachNotes: TraceField<unknown>;
    reloadVerified: TraceField<boolean>;
  };
  events: Array<{
    event: string;
    spanId: string;
    timestamp: string;
    fields: Record<string, unknown>;
    /** True only for the coordinator's post-durable finalization event. */
    terminalAuthority: boolean;
  }>;
  missingRequiredFields: string[];
}

export interface AthleteActionTraceCheckpointV2 {
  version: typeof ATHLETE_ACTION_TRACE_SCHEMA_VERSION;
  fingerprintContract: typeof SEMANTIC_FINGERPRINT_CONTRACT_V2;
  records: AthleteActionTraceRecordV2[];
}

export interface AthleteActionReloadEvidenceV2 {
  accepted: unknown;
  persisted: unknown;
  visible: unknown;
  coachNotes: unknown;
  acceptedRevision?: number;
  verified: boolean;
}

const SENSITIVE_KEY = /(?:raw.*(?:coach|health)|coach.*text|health.*detail|bodypart|symptom|medical|prescription|exercise.*detail|message|description|note$)/i;
const TEXT_VALUE_KEY = /(?:text|message|description|note|reason|label|title|content)/i;

function missing<T>(reason = 'not captured by an instrumented boundary'): TraceField<T> {
  return { status: 'missing', reason };
}

export function capturedTraceField<T>(value: T): TraceField<T> {
  return { status: 'captured', value };
}

export function notApplicableTraceField<T>(reason: string): TraceField<T> {
  return { status: 'not_applicable', reason };
}

function present<T>(value: T | undefined, reason?: string): TraceField<T> {
  return value === undefined ? missing(reason) : capturedTraceField(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function redactValue(value: unknown, key = ''): unknown {
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    if (SENSITIVE_KEY.test(key) || TEXT_VALUE_KEY.test(key)) {
      return {
        redacted: true,
        fingerprint: semanticFingerprintV2(value),
        length: value.length,
      };
    }
    return value.length > 240
      ? { redacted: true, fingerprint: semanticFingerprintV2(value), length: value.length }
      : value;
  }
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, key));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([childKey]) => !SENSITIVE_KEY.test(childKey) || !/(?:raw|detail|bodypart|symptom|medical)/i.test(childKey))
      .map(([childKey, child]) => [childKey, redactValue(child, childKey)]));
  }
  return String(value);
}

function append<T>(field: TraceField<T[]>, value: T): TraceField<T[]> {
  return capturedTraceField([
    ...(field.status === 'captured' ? field.value : []),
    value,
  ]);
}

function envBuildId(): string | undefined {
  return process.env.EXPO_PUBLIC_BUILD_ID ?? process.env.EXPO_PUBLIC_GIT_SHA;
}

export function buildAthleteSemanticSnapshotV2(
  state: AthleteSemanticStateV2,
  acceptedRevision: number,
): AthleteSemanticSnapshotV2 {
  const componentFingerprints = Object.fromEntries(
    (Object.keys(state) as Array<keyof AthleteSemanticStateV2>).map((key) => [
      key,
      semanticFingerprintV2(state[key]),
    ]),
  ) as Record<keyof AthleteSemanticStateV2, SemanticFingerprintV2>;
  return {
    fingerprintContract: SEMANTIC_FINGERPRINT_CONTRACT_V2,
    fingerprint: semanticFingerprintV2(state),
    componentFingerprints,
    // The coordinator proves semantic identity component-by-component without
    // retaining raw health, Coach, or prescription payloads in the default trace.
    state: Object.fromEntries((Object.keys(state) as Array<keyof AthleteSemanticStateV2>)
      .map((key) => [key, { fingerprint: componentFingerprints[key] }])) as unknown as AthleteSemanticStateV2,
    acceptedRevision,
  };
}

function initialRecord(
  traceId: string,
  spanId: string,
  input: AthleteActionTraceRootInputV2,
  timestamp: string,
): AthleteActionTraceRecordV2 {
  const identities = input.identities ?? {};
  return {
    schemaVersion: ATHLETE_ACTION_TRACE_SCHEMA_VERSION,
    fingerprintContract: SEMANTIC_FINGERPRINT_CONTRACT_V2,
    traceId,
    status: 'unfinished',
    requestedTerminalOutcome: missing('no terminal outcome requested'),
    startedAt: timestamp,
    finalizedAt: null,
    root: {
      campaignId: present(input.campaignId),
      scenarioRunId: present(input.scenarioRunId),
      scenarioStepId: present(input.scenarioStepId),
      seedId: present(input.seedId),
      buildId: present(input.buildId ?? envBuildId()),
      priorActionTraceId: input.priorActionTraceId === undefined
        ? notApplicableTraceField('action is not part of a linked scenario session')
        : capturedTraceField(input.priorActionTraceId),
      canonicalRequestedAction: present(input.canonicalRequestedAction ?? {
        type: input.actionType,
        sourceDate: input.sourceDate ?? null,
        targetDate: input.targetDate ?? null,
      }),
      source: capturedTraceField(input.source),
      actionType: capturedTraceField(input.actionType),
      sourceSurface: present(input.sourceSurface ?? input.route),
      controlId: present(input.controlId),
      sourceDate: input.sourceDate
        ? capturedTraceField(input.sourceDate)
        : notApplicableTraceField('action has no source date'),
      targetDate: input.targetDate
        ? capturedTraceField(input.targetDate)
        : notApplicableTraceField('action has no target date'),
      identities: {
        sessionId: present(identities.sessionId),
        componentId: present(identities.componentId),
        fixtureId: present(identities.fixtureId),
        adjustmentId: present(identities.adjustmentId),
        injuryEpisodeId: present(identities.injuryEpisodeId),
      },
    },
    spans: [{ spanId, parentSpanId: null, name: 'athlete_action_root', startedAt: timestamp, endedAt: null }],
    evidence: {
      coachClassification: input.source === 'coach'
        ? missing('Coach classification has not been recorded')
        : notApplicableTraceField('action did not originate from Coach classification'),
      legacyFallbackDecision: input.source === 'coach'
        ? missing('Coach legacy fallback decision has not been recorded')
        : notApplicableTraceField('action did not originate from Coach'),
      acceptedRevisionBefore: missing(),
      acceptedRevisionAfter: missing(),
      acceptedRevisionPostReload: missing(),
      semanticAcceptedBefore: missing(),
      visibleCardBefore: missing(),
      visibleDetailBefore: missing(),
      persistedBefore: missing(),
      factsCreated: capturedTraceField([]),
      factsExpired: capturedTraceField([]),
      constraintsCreated: capturedTraceField([]),
      constraintsExpired: capturedTraceField([]),
      reversibleAdjustments: capturedTraceField([]),
      repairCandidates: capturedTraceField([]),
      selectedHorizon: missing(),
      provenanceCreated: capturedTraceField([]),
      provenanceExpired: capturedTraceField([]),
      typedReductionsCreated: capturedTraceField([]),
      typedReductionsRemoved: capturedTraceField([]),
      publication: missing(),
      persistence: capturedTraceField([]),
      semanticAcceptedAfter: missing(),
      visibleCardAfter: missing(),
      visibleDetailAfter: missing(),
      coachNoteOwnership: missing(),
      renderedCoachNoteCardIds: missing(),
      uiObservation: missing(),
      rollbackMemory: notApplicableTraceField('rollback not requested'),
      rollbackProgramEnvelope: notApplicableTraceField('rollback not requested'),
      rollbackMirrorEnvelopes: notApplicableTraceField('rollback not requested'),
      rollbackVisibleProjection: notApplicableTraceField('rollback not requested'),
      postReloadAccepted: missing(),
      postReloadPersisted: missing(),
      postReloadVisible: missing(),
      postReloadCoachNotes: missing(),
      reloadVerified: missing(),
    },
    events: [],
    missingRequiredFields: [],
  };
}

export class AthleteActionTraceCoordinator {
  private records = new Map<string, AthleteActionTraceRecordV2>();
  private activeTokens: AthleteActionTraceTokenV2[] = [];
  private traceCounter = 0;
  private spanCounter = 0;

  constructor(
    private readonly enabled: () => boolean,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  currentToken(): AthleteActionTraceTokenV2 | undefined {
    return this.activeTokens[this.activeTokens.length - 1];
  }

  startRoot(
    input: AthleteActionTraceRootInputV2,
    options: { forceRoot?: boolean } = {},
  ): AthleteActionTraceTokenV2 {
    const current = this.currentToken();
    if (current && !options.forceRoot) {
      return this.startSpan(current, input.route ?? input.actionType);
    }
    const timestamp = this.clock().toISOString();
    this.traceCounter += 1;
    this.spanCounter += 1;
    const traceId = `aa-v2-${semanticFingerprintV2({
      timestamp,
      counter: this.traceCounter,
      source: input.source,
      actionType: input.actionType,
      sourceDate: input.sourceDate ?? null,
      targetDate: input.targetDate ?? null,
      scenarioRunId: input.scenarioRunId ?? null,
      scenarioStepId: input.scenarioStepId ?? null,
      priorActionTraceId: input.priorActionTraceId ?? null,
    }).slice(-24)}`;
    const token = { traceId, spanId: `span-${this.spanCounter}` };
    if (this.enabled()) this.records.set(traceId, initialRecord(traceId, token.spanId, input, timestamp));
    return token;
  }

  startSpan(parent: AthleteActionTraceTokenV2, name: string): AthleteActionTraceTokenV2 {
    this.spanCounter += 1;
    const token = { traceId: parent.traceId, spanId: `span-${this.spanCounter}` };
    const record = this.records.get(parent.traceId);
    if (record && this.enabled()) {
      record.spans.push({
        spanId: token.spanId,
        parentSpanId: parent.spanId,
        name,
        startedAt: this.clock().toISOString(),
        endedAt: null,
      });
    }
    return token;
  }

  run<T>(token: AthleteActionTraceTokenV2, operation: () => T): T {
    this.activeTokens.push(token);
    let result: T;
    try {
      result = operation();
    } catch (error) {
      this.leave(token);
      throw error;
    }
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      return Promise.resolve(result).finally(() => this.leave(token)) as T;
    }
    this.leave(token);
    return result;
  }

  private leave(token: AthleteActionTraceTokenV2): void {
    const index = this.activeTokens.lastIndexOf(token);
    if (index >= 0) this.activeTokens.splice(index, 1);
    const record = this.records.get(token.traceId);
    const span = record?.spans.find((candidate) => candidate.spanId === token.spanId);
    if (span && !span.endedAt) span.endedAt = this.clock().toISOString();
  }

  recordEvent(
    token: AthleteActionTraceTokenV2 | undefined,
    event: string,
    fields: Record<string, unknown>,
  ): void {
    if (!token || !this.enabled()) return;
    const record = this.records.get(token.traceId);
    if (!record) return;
    const safeFields = redactValue(fields) as Record<string, unknown>;
    record.events.push({
      event: event === 'athlete_action_completed'
        ? 'athlete_action_completion_requested'
        : event,
      spanId: token.spanId,
      timestamp: this.clock().toISOString(),
      fields: safeFields,
      terminalAuthority: false,
    });
    this.applyEvent(record, event, safeFields);
    this.refreshMissing(record);
  }

  private applyEvent(
    record: AthleteActionTraceRecordV2,
    event: string,
    fields: Record<string, unknown>,
  ): void {
    if (event === 'coach_intent_classification_result') {
      record.evidence.coachClassification = capturedTraceField({
        status: fields.classificationStatus === 'unavailable' ? 'unavailable' : 'classified',
        intentKind: typeof fields.classifiedIntentKind === 'string'
          ? fields.classifiedIntentKind
          : null,
        confidenceBucket:
          fields.confidenceBucket === 'low' ||
          fields.confidenceBucket === 'medium' ||
          fields.confidenceBucket === 'high'
            ? fields.confidenceBucket
            : null,
        clarificationFlag: typeof fields.clarificationFlag === 'boolean'
          ? fields.clarificationFlag
          : null,
        provenance:
          fields.classificationProvenance === 'deterministic' ||
          fields.classificationProvenance === 'semantic_service'
            ? fields.classificationProvenance
            : null,
        unavailableReasonCode: typeof fields.unavailableCode === 'string'
          ? fields.unavailableCode
          : null,
      });
    }
    if (event === 'coach_legacy_fallback_decision') {
      const decision = fields.legacyDecision;
      if (
        decision === 'allowed:genuine_conversation' ||
        decision === 'forbidden:deterministic_owner' ||
        decision === 'forbidden:policy' ||
        decision === 'forbidden:classification_unavailable' ||
        decision === 'forbidden:deterministic_failure'
      ) {
        record.evidence.legacyFallbackDecision = capturedTraceField(decision);
      }
    }
    if (event === 'athlete_action_parsed') {
      record.root.canonicalRequestedAction = capturedTraceField({
        actionType: record.root.actionType.status === 'captured' ? record.root.actionType.value : null,
        parsedMutationType: fields.parsedMutationType ?? fields.operation ?? null,
        sourceDate: record.root.sourceDate.status === 'captured' ? record.root.sourceDate.value : null,
        targetDate: record.root.targetDate.status === 'captured' ? record.root.targetDate.value : null,
        targetIdentityHash: fields.targetIdentityHash ?? null,
      });
    }
    if (event === 'mutation_constraint_created') {
      const item = {
        id: fields.constraintId ?? null,
        type: fields.constraintType ?? null,
        status: fields.constraintStatus ?? null,
      };
      if (/expired|resolved|removed|cleared/.test(String(fields.constraintStatus ?? ''))) {
        record.evidence.constraintsExpired = append(record.evidence.constraintsExpired, item);
        record.evidence.factsExpired = append(record.evidence.factsExpired, item);
      } else {
        record.evidence.constraintsCreated = append(record.evidence.constraintsCreated, item);
        record.evidence.factsCreated = append(record.evidence.factsCreated, item);
      }
    }
    if (event === 'repair_horizon_selected') {
      record.evidence.selectedHorizon = capturedTraceField(fields.dependencyWeeksSelected ?? fields);
    }
    if (event === 'repair_candidate_rejected' || event === 'repair_candidate_selected') {
      const candidate: AthleteActionRepairCandidateV2 = {
        candidateId: present(typeof fields.candidateId === 'string' ? fields.candidateId : undefined),
        selected: event === 'repair_candidate_selected',
        rejectedRuleIds: Array.isArray(fields.rejectedRuleIds)
          ? fields.rejectedRuleIds.map(String)
          : typeof fields.invariant === 'string' ? [fields.invariant] : [],
        rejectedCodes: Array.isArray(fields.rejectionCodes)
          ? fields.rejectionCodes.map(String)
          : fields.originalRejectionCode ? [String(fields.originalRejectionCode)] : [],
        expected: fields.expected === undefined ? missing() : capturedTraceField(fields.expected),
        actual: fields.actual === undefined ? missing() : capturedTraceField(fields.actual),
        rejectingBoundary: present(typeof fields.rejectingBoundary === 'string'
          ? fields.rejectingBoundary
          : typeof fields.boundary === 'string' ? fields.boundary : undefined),
      };
      record.evidence.repairCandidates = append(record.evidence.repairCandidates, candidate);
    }
    if (event === 'accepted_state_publication_result' || event === 'transaction_publish_result') {
      record.evidence.publication = capturedTraceField(fields);
      if (typeof fields.acceptedStateVersion === 'number') {
        record.evidence.acceptedRevisionAfter = capturedTraceField(fields.acceptedStateVersion);
      }
    }
    if (event === 'coach_notes_result') {
      record.evidence.coachNoteOwnership = capturedTraceField(fields);
      if (Array.isArray(fields.noteIdentitiesDerived)) {
        record.evidence.renderedCoachNoteCardIds = capturedTraceField(fields.noteIdentitiesDerived.map(String));
      }
    }
    if (event === 'athlete_action_completed') {
      record.requestedTerminalOutcome = capturedTraceField('success');
    }
    if (event === 'athlete_action_failed') {
      record.requestedTerminalOutcome = capturedTraceField('failure');
    }
  }

  recordBefore(args: {
    token?: AthleteActionTraceTokenV2;
    semantic: AthleteSemanticSnapshotV2;
    visibleCard: unknown;
    visibleDetail: unknown;
    persistedEnvelope: unknown;
  }): void {
    const record = this.resolve(args.token);
    if (!record) return;
    record.evidence.acceptedRevisionBefore = capturedTraceField(args.semantic.acceptedRevision);
    record.evidence.semanticAcceptedBefore = capturedTraceField(clone(args.semantic));
    record.evidence.visibleCardBefore = capturedTraceField(redactValue(args.visibleCard));
    record.evidence.visibleDetailBefore = capturedTraceField(redactValue(args.visibleDetail));
    record.evidence.persistedBefore = capturedTraceField(semanticFingerprintV2(args.persistedEnvelope));
    this.refreshMissing(record);
  }

  recordAfter(args: {
    token?: AthleteActionTraceTokenV2;
    semantic: AthleteSemanticSnapshotV2;
    visibleCard: unknown;
    visibleDetail: unknown;
  }): void {
    const record = this.resolve(args.token);
    if (!record) return;
    record.evidence.acceptedRevisionAfter = capturedTraceField(args.semantic.acceptedRevision);
    record.evidence.semanticAcceptedAfter = capturedTraceField(clone(args.semantic));
    record.evidence.visibleCardAfter = capturedTraceField(redactValue(args.visibleCard));
    record.evidence.visibleDetailAfter = capturedTraceField(redactValue(args.visibleDetail));
    const before = record.evidence.semanticAcceptedBefore;
    if (before.status === 'captured') {
      const transition = (key: keyof AthleteSemanticStateV2) => ({
        component: key,
        before: before.value.componentFingerprints[key],
        after: args.semantic.componentFingerprints[key],
      });
      if (before.value.componentFingerprints.reversibleAdjustmentLedger !==
        args.semantic.componentFingerprints.reversibleAdjustmentLedger) {
        record.evidence.reversibleAdjustments = append(
          record.evidence.reversibleAdjustments,
          transition('reversibleAdjustmentLedger'),
        );
      }
      if (before.value.componentFingerprints.provenance !==
        args.semantic.componentFingerprints.provenance) {
        const evidence = transition('provenance');
        record.evidence.provenanceCreated = append(record.evidence.provenanceCreated, evidence);
        record.evidence.provenanceExpired = append(record.evidence.provenanceExpired, evidence);
      }
      if (before.value.componentFingerprints.typedReductions !==
        args.semantic.componentFingerprints.typedReductions) {
        const evidence = transition('typedReductions');
        record.evidence.typedReductionsCreated = append(record.evidence.typedReductionsCreated, evidence);
        record.evidence.typedReductionsRemoved = append(record.evidence.typedReductionsRemoved, evidence);
      }
    }
    this.refreshMissing(record);
  }

  recordPersistence(
    token: AthleteActionTraceTokenV2 | undefined,
    evidence: Omit<AthleteActionPersistenceEvidenceV2, 'timestamp'>,
  ): void {
    const record = this.resolve(token);
    if (!record) return;
    record.evidence.persistence = append(record.evidence.persistence, {
      ...clone(evidence),
      timestamp: this.clock().toISOString(),
    });
    this.refreshMissing(record);
  }

  recordRollback(token: AthleteActionTraceTokenV2 | undefined, evidence: {
    memory: unknown;
    programEnvelope: unknown;
    mirrorEnvelopes: unknown;
    visibleProjection: unknown;
  }): void {
    const record = this.resolve(token);
    if (!record) return;
    record.evidence.rollbackMemory = capturedTraceField(redactValue(evidence.memory));
    record.evidence.rollbackProgramEnvelope = capturedTraceField(redactValue(evidence.programEnvelope));
    record.evidence.rollbackMirrorEnvelopes = capturedTraceField(redactValue(evidence.mirrorEnvelopes));
    record.evidence.rollbackVisibleProjection = capturedTraceField(redactValue(evidence.visibleProjection));
    this.refreshMissing(record);
  }

  registerUIOutcome(
    token: AthleteActionTraceTokenV2 | undefined,
    observationId: string,
    domainReturn: unknown,
    controlId?: string,
  ): void {
    const record = this.resolve(token);
    if (!record) return;
    record.evidence.uiObservation = capturedTraceField({
      observationId,
      domainReturn: capturedTraceField(redactValue(domainReturn)),
      actualRenderedText: missing('React render observation has not fired'),
      controlId: present(controlId),
      accessibilityNode: missing(),
      screenshotReference: missing(),
      hierarchyReference: missing(),
      observedAt: null,
    });
    this.refreshMissing(record);
  }

  observeRenderedUI(args: {
    traceId: string;
    observationId: string;
    renderedText: unknown;
    controlId: string;
    accessibilityNode: unknown;
    screenshotReference?: string;
    hierarchyReference?: string;
  }): void {
    const record = this.records.get(args.traceId);
    if (!record || !this.enabled()) return;
    const existing = record.evidence.uiObservation;
    if (existing.status !== 'captured' || existing.value.observationId !== args.observationId) return;
    record.evidence.uiObservation = capturedTraceField({
      ...existing.value,
      actualRenderedText: capturedTraceField(redactValue(args.renderedText, 'renderedText')),
      controlId: capturedTraceField(args.controlId),
      accessibilityNode: capturedTraceField(redactValue(args.accessibilityNode)),
      screenshotReference: args.screenshotReference
        ? capturedTraceField(args.screenshotReference)
        : missing('screenshot collector has not attached a reference'),
      hierarchyReference: args.hierarchyReference
        ? capturedTraceField(args.hierarchyReference)
        : missing('hierarchy collector has not attached a reference'),
      observedAt: this.clock().toISOString(),
    });
    this.refreshMissing(record);
  }

  exportCheckpoint(): AthleteActionTraceCheckpointV2 {
    return {
      version: ATHLETE_ACTION_TRACE_SCHEMA_VERSION,
      fingerprintContract: SEMANTIC_FINGERPRINT_CONTRACT_V2,
      records: this.getRecords().filter((record) => record.status === 'unfinished'),
    };
  }

  resumeCheckpoint(
    checkpoint: AthleteActionTraceCheckpointV2 | null | undefined,
    evidence?: AthleteActionReloadEvidenceV2,
  ): string[] {
    if (!checkpoint || checkpoint.version !== ATHLETE_ACTION_TRACE_SCHEMA_VERSION ||
      checkpoint.fingerprintContract !== SEMANTIC_FINGERPRINT_CONTRACT_V2 || !this.enabled()) return [];
    const resumed: string[] = [];
    for (const checkpointRecord of checkpoint.records) {
      const record = clone(checkpointRecord);
      record.status = 'unfinished';
      record.finalizedAt = null;
      this.records.set(record.traceId, record);
      const parent = record.spans[record.spans.length - 1];
      this.spanCounter += 1;
      record.spans.push({
        spanId: `span-${this.spanCounter}`,
        parentSpanId: parent?.spanId ?? null,
        name: 'post_reload_verification',
        startedAt: this.clock().toISOString(),
        endedAt: this.clock().toISOString(),
      });
      if (evidence) this.applyReloadEvidence(record, evidence);
      const requested = record.requestedTerminalOutcome;
      if (requested.status === 'captured') {
        try {
          this.finalize(record.traceId, requested.value);
        } catch {
          // A resumed record remains unfinished until every durable, UI and
          // reload witness required by the requested outcome is present.
        }
      }
      resumed.push(record.traceId);
    }
    return resumed;
  }

  private applyReloadEvidence(
    record: AthleteActionTraceRecordV2,
    evidence: AthleteActionReloadEvidenceV2,
  ): void {
    record.evidence.postReloadAccepted = capturedTraceField(redactValue(evidence.accepted));
    record.evidence.postReloadPersisted = capturedTraceField(redactValue(evidence.persisted));
    record.evidence.postReloadVisible = capturedTraceField(redactValue(evidence.visible));
    record.evidence.postReloadCoachNotes = capturedTraceField(redactValue(evidence.coachNotes));
    const renderedCardIds = (evidence.coachNotes as { renderedCardIds?: unknown })?.renderedCardIds;
    if (Array.isArray(renderedCardIds)) {
      record.evidence.renderedCoachNoteCardIds = capturedTraceField(renderedCardIds.map(String));
    }
    record.evidence.reloadVerified = capturedTraceField(evidence.verified);
    if (evidence.acceptedRevision !== undefined) {
      record.evidence.acceptedRevisionPostReload = capturedTraceField(evidence.acceptedRevision);
    }
    this.refreshMissing(record);
  }

  finalize(traceId: string, outcome: 'success' | 'failure'): AthleteActionTraceRecordV2 {
    const record = this.records.get(traceId);
    if (!record) throw new Error(`athlete_action_trace_not_found:${traceId}`);
    if (record.status !== 'unfinished') {
      const finalizedOutcome = record.status === 'finalized_success' ? 'success' : 'failure';
      if (finalizedOutcome !== outcome) {
        throw new Error(`athlete_action_trace_terminal_conflict:${finalizedOutcome}:${outcome}`);
      }
      return clone(record);
    }
    const requested = record.requestedTerminalOutcome;
    if (requested.status === 'captured' && requested.value !== outcome) {
      throw new Error(`athlete_action_trace_terminal_conflict:${requested.value}:${outcome}`);
    }
    record.requestedTerminalOutcome = capturedTraceField(outcome);
    this.refreshMissing(record);
    const persistence = record.evidence.persistence.status === 'captured'
      ? record.evidence.persistence.value
      : [];
    const publicationSucceeded = record.evidence.publication.status === 'captured' &&
      (record.evidence.publication.value as { published?: unknown }).published === true;
    const matchingReadback = (entry: AthleteActionPersistenceEvidenceV2): boolean =>
      entry.acknowledged &&
      entry.expectedFingerprint.status === 'captured' &&
      entry.actualFingerprint.status === 'captured' &&
      entry.expectedFingerprint.value === entry.actualFingerprint.value;
    const durableReadback = persistence.some((entry) =>
      (entry.operation === 'readback' || entry.operation === 'mirror_readback') && matchingReadback(entry));
    const durablePreRead = persistence.some((entry) =>
      entry.operation === 'read_before' && entry.acknowledged &&
      entry.actualFingerprint.status === 'captured');
    const uiObserved = record.evidence.uiObservation.status === 'not_applicable' || (
      record.evidence.uiObservation.status === 'captured' &&
      record.evidence.uiObservation.value.actualRenderedText.status === 'captured'
    );
    const reloadVerified = record.evidence.reloadVerified.status === 'captured' &&
      record.evidence.reloadVerified.value === true;
    const rollbackVerified = record.evidence.rollbackMemory.status === 'captured' &&
      record.evidence.rollbackProgramEnvelope.status === 'captured' &&
      record.evidence.rollbackMirrorEnvelopes.status === 'captured' &&
      record.evidence.rollbackVisibleProjection.status === 'captured';
    const publicationRejected = record.evidence.publication.status === 'captured' &&
      (record.evidence.publication.value as { published?: unknown }).published === false;
    const ready = outcome === 'success'
      ? publicationSucceeded && durableReadback && uiObserved && reloadVerified
      : (publicationRejected || rollbackVerified) &&
        (durableReadback || (durablePreRead && rollbackVerified)) &&
        uiObserved && reloadVerified;
    if (!ready) {
      throw new Error(`athlete_action_trace_${outcome}_not_durable:${record.missingRequiredFields.join(',')}`);
    }
    record.status = outcome === 'success' ? 'finalized_success' : 'finalized_failure';
    record.finalizedAt = this.clock().toISOString();
    record.events.push({
      event: outcome === 'success'
        ? 'athlete_action_finalized_success'
        : 'athlete_action_finalized_failure',
      spanId: record.spans[record.spans.length - 1]?.spanId ?? 'finalization',
      timestamp: record.finalizedAt,
      fields: {
        durableReadback,
        durablePreRead,
        rollbackVerified,
        uiObserved,
        reloadVerified,
      },
      terminalAuthority: true,
    });
    return clone(record);
  }

  markUINotApplicable(traceId: string, reason: string): void {
    const record = this.records.get(traceId);
    if (!record || !this.enabled()) return;
    record.evidence.uiObservation = notApplicableTraceField(reason);
    this.refreshMissing(record);
  }

  getRecord(traceId: string): AthleteActionTraceRecordV2 | null {
    const record = this.records.get(traceId);
    return record ? clone(record) : null;
  }

  getRecords(): AthleteActionTraceRecordV2[] {
    return Array.from(this.records.values()).map((record) => clone(record));
  }

  clear(): void {
    this.records.clear();
    this.activeTokens.length = 0;
    this.traceCounter = 0;
    this.spanCounter = 0;
  }

  private resolve(token?: AthleteActionTraceTokenV2): AthleteActionTraceRecordV2 | null {
    if (!this.enabled()) return null;
    const resolved = token ?? this.currentToken();
    return resolved ? this.records.get(resolved.traceId) ?? null : null;
  }

  private refreshMissing(record: AthleteActionTraceRecordV2): void {
    const missingPaths: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (!value || typeof value !== 'object') return;
      const field = value as Partial<TraceField<unknown>>;
      if (field.status === 'missing') {
        missingPaths.push(path);
        return;
      }
      if (field.status === 'captured' || field.status === 'not_applicable') return;
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key !== 'events' && key !== 'missingRequiredFields') walk(child, path ? `${path}.${key}` : key);
      }
    };
    walk(record.root, 'root');
    walk(record.evidence, 'evidence');
    record.missingRequiredFields = missingPaths.sort();
  }
}
