import { sha256Hex, stableSemanticJsonV2 } from '../../utils/semanticFingerprintV2';

export const COACH_INTERPRETATION_RECEIPT_SCHEMA_VERSION = 1 as const;
export const COACH_INTERPRETATION_SEMANTIC_HASH_CONTRACT =
  'coach-interpretation-semantic-sha256-v1' as const;
export const COACH_INTERPRETATION_RECEIPT_HASH_CONTRACT =
  'coach-interpretation-receipt-sha256-v1' as const;

export type CoachSemanticHash = `${string}:${string}`;
export type CoachInterpretationReceiptHash =
  `${typeof COACH_INTERPRETATION_RECEIPT_HASH_CONTRACT}:${string}`;

export const COACH_INTERPRETATION_PROVIDERS = [
  'deterministic',
  'semantic_service',
  'replay',
] as const;
export type CoachInterpretationProvider =
  (typeof COACH_INTERPRETATION_PROVIDERS)[number];

export const COACH_INTENT_KINDS = [
  'fixture_change',
  'injury_report',
  'injury_update',
  'session_change',
  'source_fact_change',
  'general_conversation',
] as const;
export type CoachIntentKind = (typeof COACH_INTENT_KINDS)[number];

export type CoachConfidenceBucket = 'low' | 'medium' | 'high' | 'unavailable';
export type CoachUnavailableReason =
  | 'semantic_service_unavailable'
  | 'timeout'
  | 'invalid_response'
  | 'capability_disabled';

export interface CoachFixtureTargetReceiptV1 {
  readonly kind: 'fixture';
  readonly action: 'add' | 'move' | 'remove';
  readonly fixtureKind: 'game' | 'practice-match';
  readonly sourceDate: string | null;
  readonly targetDate: string | null;
  readonly acceptedRevision: number;
}

export type CoachInjuryEpisodeTargetV1 =
  | { readonly kind: 'new-report' }
  | { readonly kind: 'existing-episode'; readonly episodeId: string };

export interface CoachInjuryTargetReceiptV1 {
  readonly kind: 'injury';
  readonly operation: 'report' | 'update';
  readonly episodeTarget: CoachInjuryEpisodeTargetV1;
  readonly bodyPartToken: string;
  readonly severity: 'minor' | 'moderate' | 'severe';
  readonly acceptedRevision: number;
}

export interface CoachSessionTargetReceiptV1 {
  readonly kind: 'session';
  readonly sessionId: string;
  readonly componentId: string | null;
  readonly sourceDate: string | null;
  readonly targetDate: string | null;
  readonly acceptedRevision: number;
}

export interface CoachSourceFactTargetReceiptV1 {
  readonly kind: 'source-fact';
  readonly factKind: 'fixture' | 'injury' | 'readiness' | 'equipment' | 'session-feedback';
  readonly factId: string;
  readonly operation: 'set' | 'update' | 'clear' | 'resolve' | 'remove';
  readonly acceptedRevision: number;
}

export type CoachResolvedTargetReceiptV1 =
  | CoachFixtureTargetReceiptV1
  | CoachInjuryTargetReceiptV1
  | CoachSessionTargetReceiptV1
  | CoachSourceFactTargetReceiptV1;

export interface CoachNoClarificationV1 {
  readonly kind: 'none';
}

export interface CoachPendingClarificationV1 {
  readonly kind: 'severity' | 'target' | 'date' | 'operation' | 'generic';
  readonly candidateIdentities: readonly string[];
  readonly pendingStateSemanticHash: CoachSemanticHash;
}

export type CoachClarificationStateV1 =
  | CoachNoClarificationV1
  | CoachPendingClarificationV1;

interface CoachInterpretationReceiptBaseV1 {
  readonly schemaVersion: typeof COACH_INTERPRETATION_RECEIPT_SCHEMA_VERSION;
  readonly receiptId: CoachInterpretationReceiptHash;
  readonly messageSemanticHash: CoachSemanticHash;
  readonly classifierSchemaVersion: string;
  readonly classifierPromptVersion: string;
  readonly interpretationProvider: CoachInterpretationProvider;
  readonly confidenceBucket: CoachConfidenceBucket;
  readonly needsClarification: boolean;
  readonly clockFingerprint: CoachSemanticHash;
  readonly canonicalContextFingerprint: CoachSemanticHash;
  readonly clarification: CoachClarificationStateV1;
  readonly sourceInterpretationReceiptHash?: CoachInterpretationReceiptHash;
}

export interface CoachClassifiedInterpretationReceiptV1
  extends CoachInterpretationReceiptBaseV1 {
  readonly classificationStatus: 'classified';
  readonly intentKind: CoachIntentKind;
  readonly intentSemanticHash: CoachSemanticHash;
  /** Null means either genuine conversation or a mutation awaiting clarification. */
  readonly resolvedTarget: CoachResolvedTargetReceiptV1 | null;
}

export interface CoachUnavailableInterpretationReceiptV1
  extends CoachInterpretationReceiptBaseV1 {
  readonly classificationStatus: 'unavailable';
  readonly confidenceBucket: 'unavailable';
  readonly needsClarification: false;
  readonly clarification: CoachNoClarificationV1;
  readonly unavailableReason: CoachUnavailableReason;
}

export type CoachInterpretationReceiptV1 =
  | CoachClassifiedInterpretationReceiptV1
  | CoachUnavailableInterpretationReceiptV1;

export type CoachClassifiedInterpretationReceiptDraftV1 = Omit<
  CoachClassifiedInterpretationReceiptV1,
  'schemaVersion' | 'receiptId' | 'intentSemanticHash'
> & { readonly intentSemanticHash?: CoachSemanticHash };

export type CoachUnavailableInterpretationReceiptDraftV1 = Omit<
  CoachUnavailableInterpretationReceiptV1,
  'schemaVersion' | 'receiptId'
>;

export type CoachInterpretationReceiptDraftV1 =
  | CoachClassifiedInterpretationReceiptDraftV1
  | CoachUnavailableInterpretationReceiptDraftV1;

export type CoachInterpretationReceiptValidationIssueCode =
  | 'unknown-field'
  | 'privacy-forbidden-field'
  | 'unsupported-schema-version'
  | 'missing-field'
  | 'invalid-value'
  | 'invalid-hash'
  | 'invalid-combination'
  | 'integrity-mismatch';

export interface CoachInterpretationReceiptValidationIssue {
  readonly code: CoachInterpretationReceiptValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export class CoachInterpretationReceiptValidationError extends Error {
  readonly issues: readonly CoachInterpretationReceiptValidationIssue[];

  constructor(issues: readonly CoachInterpretationReceiptValidationIssue[]) {
    super(issues.map((entry) => `${entry.path}: ${entry.message}`).join('\n'));
    this.name = 'CoachInterpretationReceiptValidationError';
    this.issues = issues;
  }
}

type UnknownRecord = Record<string, unknown>;

const HASH_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[0-9a-f]{64}$/;
const RECEIPT_HASH_PATTERN = new RegExp(
  `^${COACH_INTERPRETATION_RECEIPT_HASH_CONTRACT}:[0-9a-f]{64}$`,
);
const CANONICAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BODY_PART_TOKEN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORBIDDEN_PRIVACY_KEYS = new Set([
  'message',
  'rawmessage',
  'reply',
  'rawreply',
  'question',
  'rawquestion',
  'athleteresponse',
  'injurydescription',
  'injurynote',
  'notes',
  'athletewording',
  'healthdetails',
]);
const ROOT_KEYS = [
  'canonicalContextFingerprint',
  'classificationStatus',
  'classifierPromptVersion',
  'classifierSchemaVersion',
  'clarification',
  'clockFingerprint',
  'confidenceBucket',
  'intentKind',
  'intentSemanticHash',
  'interpretationProvider',
  'messageSemanticHash',
  'needsClarification',
  'receiptId',
  'resolvedTarget',
  'schemaVersion',
  'sourceInterpretationReceiptHash',
  'unavailableReason',
] as const;

function addIssue(
  issues: CoachInterpretationReceiptValidationIssue[],
  code: CoachInterpretationReceiptValidationIssueCode,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function exactKeys(
  value: UnknownRecord,
  allowed: readonly string[],
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
): void {
  const allowedSet = new Set(allowed);
  Object.keys(value).forEach((key) => {
    if (!allowedSet.has(key)) {
      addIssue(issues, 'unknown-field', `${path}.${key}`, 'is not part of this contract');
    }
  });
}

function required(
  value: UnknownRecord,
  key: string,
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
): unknown {
  if (!hasOwn(value, key)) {
    addIssue(issues, 'missing-field', `${path}.${key}`, 'is required');
    return undefined;
  }
  return value[key];
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
): value is T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    addIssue(issues, 'invalid-value', path, `must be one of: ${allowed.join(', ')}`);
    return false;
  }
  return true;
}

function validateHash(
  value: unknown,
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
  receiptHash = false,
): value is CoachSemanticHash {
  if (typeof value !== 'string' || !(receiptHash ? RECEIPT_HASH_PATTERN : HASH_PATTERN).test(value)) {
    addIssue(issues, 'invalid-hash', path, 'must be a lowercase, versioned SHA-256 hash');
    return false;
  }
  return true;
}

function validateCanonicalId(
  value: unknown,
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
): value is string {
  if (typeof value !== 'string' || !CANONICAL_ID_PATTERN.test(value)) {
    addIssue(issues, 'invalid-value', path, 'must be a canonical stable ID');
    return false;
  }
  return true;
}

function validateVersion(
  value: unknown,
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
): value is string {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    addIssue(issues, 'invalid-value', path, 'must be a stable version identifier');
    return false;
  }
  return true;
}

function isISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3]);
}

function validateNullableDate(
  value: unknown,
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
): value is string | null {
  if (value === null || isISODate(value)) return true;
  addIssue(issues, 'invalid-value', path, 'must be null or a real ISO date (YYYY-MM-DD)');
  return false;
}

function validateAcceptedRevision(
  value: UnknownRecord,
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
): void {
  const revision = required(value, 'acceptedRevision', path, issues);
  if (revision !== undefined &&
    (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0)) {
    addIssue(
      issues,
      'invalid-value',
      `${path}.acceptedRevision`,
      'must be a non-negative integer',
    );
  }
}

function normalizedPrivacyKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function scanPrivacyForbiddenFields(
  value: unknown,
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
  seen = new WeakSet<object>(),
): void {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value as object)) return;
  seen.add(value as object);
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      scanPrivacyForbiddenFields(entry, `${path}[${index}]`, issues, seen));
    return;
  }
  Object.entries(value as UnknownRecord).forEach(([key, child]) => {
    if (FORBIDDEN_PRIVACY_KEYS.has(normalizedPrivacyKey(key))) {
      addIssue(
        issues,
        'privacy-forbidden-field',
        `${path}.${key}`,
        'raw athlete, reply, or health wording must never be stored',
      );
    }
    scanPrivacyForbiddenFields(child, `${path}.${key}`, issues, seen);
  });
}

function validateClarification(
  value: unknown,
  issues: CoachInterpretationReceiptValidationIssue[],
): void {
  const path = '$.clarification';
  if (!isRecord(value)) {
    addIssue(issues, 'invalid-value', path, 'must be an object');
    return;
  }
  const kind = required(value, 'kind', path, issues);
  if (kind === 'none') {
    exactKeys(value, ['kind'], path, issues);
    return;
  }
  exactKeys(value, ['candidateIdentities', 'kind', 'pendingStateSemanticHash'], path, issues);
  if (!enumValue(kind, ['severity', 'target', 'date', 'operation', 'generic'], `${path}.kind`, issues)) {
    return;
  }
  const candidates = required(value, 'candidateIdentities', path, issues);
  if (!Array.isArray(candidates)) {
    addIssue(issues, 'invalid-value', `${path}.candidateIdentities`, 'must be an array');
  } else {
    candidates.forEach((candidate, index) => {
      if (typeof candidate !== 'string' ||
        (!CANONICAL_ID_PATTERN.test(candidate) && !HASH_PATTERN.test(candidate))) {
        addIssue(
          issues,
          'invalid-value',
          `${path}.candidateIdentities[${index}]`,
          'must be a stable ID or semantic hash',
        );
      }
    });
    if (new Set(candidates).size !== candidates.length) {
      addIssue(issues, 'invalid-combination', `${path}.candidateIdentities`, 'must be unique');
    }
    if (kind === 'target' && candidates.length === 0) {
      addIssue(
        issues,
        'invalid-combination',
        `${path}.candidateIdentities`,
        'target clarification requires at least one candidate identity',
      );
    }
  }
  validateHash(required(value, 'pendingStateSemanticHash', path, issues),
    `${path}.pendingStateSemanticHash`, issues);
}

function validateFixtureTarget(
  value: UnknownRecord,
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
): void {
  exactKeys(
    value,
    ['acceptedRevision', 'action', 'fixtureKind', 'kind', 'sourceDate', 'targetDate'],
    path,
    issues,
  );
  const action = required(value, 'action', path, issues);
  enumValue(action, ['add', 'move', 'remove'], `${path}.action`, issues);
  enumValue(required(value, 'fixtureKind', path, issues), ['game', 'practice-match'],
    `${path}.fixtureKind`, issues);
  const sourceDate = required(value, 'sourceDate', path, issues);
  const targetDate = required(value, 'targetDate', path, issues);
  validateNullableDate(sourceDate, `${path}.sourceDate`, issues);
  validateNullableDate(targetDate, `${path}.targetDate`, issues);
  validateAcceptedRevision(value, path, issues);
  if (action === 'add' && (sourceDate !== null || !isISODate(targetDate))) {
    addIssue(issues, 'invalid-combination', path, 'fixture add requires sourceDate=null and targetDate');
  }
  if (action === 'move' &&
    (!isISODate(sourceDate) || !isISODate(targetDate) || sourceDate === targetDate)) {
    addIssue(issues, 'invalid-combination', path, 'fixture move requires distinct source and target dates');
  }
  if (action === 'remove' && (!isISODate(sourceDate) || targetDate !== null)) {
    addIssue(issues, 'invalid-combination', path, 'fixture remove requires sourceDate and targetDate=null');
  }
}

function validateInjuryTarget(
  value: UnknownRecord,
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
): void {
  exactKeys(
    value,
    ['acceptedRevision', 'bodyPartToken', 'episodeTarget', 'kind', 'operation', 'severity'],
    path,
    issues,
  );
  const operation = required(value, 'operation', path, issues);
  enumValue(operation, ['report', 'update'], `${path}.operation`, issues);
  const episodeTarget = required(value, 'episodeTarget', path, issues);
  if (!isRecord(episodeTarget)) {
    addIssue(issues, 'invalid-value', `${path}.episodeTarget`, 'must be an object');
  } else if (episodeTarget.kind === 'new-report') {
    exactKeys(episodeTarget, ['kind'], `${path}.episodeTarget`, issues);
    if (operation !== 'report') {
      addIssue(issues, 'invalid-combination', path, 'injury update requires an exact episode ID');
    }
  } else if (episodeTarget.kind === 'existing-episode') {
    exactKeys(episodeTarget, ['episodeId', 'kind'], `${path}.episodeTarget`, issues);
    validateCanonicalId(required(episodeTarget, 'episodeId', `${path}.episodeTarget`, issues),
      `${path}.episodeTarget.episodeId`, issues);
    if (operation === 'report') {
      addIssue(issues, 'invalid-combination', path, 'new injury report cannot target an existing episode');
    }
  } else {
    addIssue(
      issues,
      'invalid-value',
      `${path}.episodeTarget.kind`,
      'must be new-report or existing-episode',
    );
  }
  const bodyPartToken = required(value, 'bodyPartToken', path, issues);
  if (typeof bodyPartToken !== 'string' || !BODY_PART_TOKEN_PATTERN.test(bodyPartToken)) {
    addIssue(issues, 'invalid-value', `${path}.bodyPartToken`, 'must be a normalized token');
  }
  enumValue(required(value, 'severity', path, issues), ['minor', 'moderate', 'severe'],
    `${path}.severity`, issues);
  validateAcceptedRevision(value, path, issues);
}

function validateSessionTarget(
  value: UnknownRecord,
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
): void {
  exactKeys(
    value,
    ['acceptedRevision', 'componentId', 'kind', 'sessionId', 'sourceDate', 'targetDate'],
    path,
    issues,
  );
  validateCanonicalId(required(value, 'sessionId', path, issues), `${path}.sessionId`, issues);
  const componentId = required(value, 'componentId', path, issues);
  if (componentId !== null) validateCanonicalId(componentId, `${path}.componentId`, issues);
  const sourceDate = required(value, 'sourceDate', path, issues);
  const targetDate = required(value, 'targetDate', path, issues);
  validateNullableDate(sourceDate, `${path}.sourceDate`, issues);
  validateNullableDate(targetDate, `${path}.targetDate`, issues);
  if (sourceDate === null && targetDate === null) {
    addIssue(issues, 'invalid-combination', path, 'session target requires a source or target date');
  }
  if (isISODate(sourceDate) && sourceDate === targetDate) {
    addIssue(issues, 'invalid-combination', path, 'session source and target dates must differ');
  }
  validateAcceptedRevision(value, path, issues);
}

function validateSourceFactTarget(
  value: UnknownRecord,
  path: string,
  issues: CoachInterpretationReceiptValidationIssue[],
): void {
  exactKeys(value, ['acceptedRevision', 'factId', 'factKind', 'kind', 'operation'], path, issues);
  enumValue(required(value, 'factKind', path, issues),
    ['fixture', 'injury', 'readiness', 'equipment', 'session-feedback'],
    `${path}.factKind`, issues);
  validateCanonicalId(required(value, 'factId', path, issues), `${path}.factId`, issues);
  enumValue(required(value, 'operation', path, issues),
    ['set', 'update', 'clear', 'resolve', 'remove'], `${path}.operation`, issues);
  validateAcceptedRevision(value, path, issues);
}

function validateResolvedTarget(
  value: unknown,
  issues: CoachInterpretationReceiptValidationIssue[],
): void {
  const path = '$.resolvedTarget';
  if (value === null) return;
  if (!isRecord(value)) {
    addIssue(issues, 'invalid-value', path, 'must be null or a target object');
    return;
  }
  switch (value.kind) {
    case 'fixture':
      validateFixtureTarget(value, path, issues);
      return;
    case 'injury':
      validateInjuryTarget(value, path, issues);
      return;
    case 'session':
      validateSessionTarget(value, path, issues);
      return;
    case 'source-fact':
      validateSourceFactTarget(value, path, issues);
      return;
    default:
      addIssue(issues, 'invalid-value', `${path}.kind`, 'is not a supported target kind');
  }
}

function canonicalClarification(value: CoachClarificationStateV1): CoachClarificationStateV1 {
  if (value.kind === 'none') return { kind: 'none' };
  return {
    kind: value.kind,
    candidateIdentities: [...value.candidateIdentities].sort(),
    pendingStateSemanticHash: value.pendingStateSemanticHash,
  };
}

function canonicalTarget(value: CoachResolvedTargetReceiptV1 | null): CoachResolvedTargetReceiptV1 | null {
  if (value === null) return null;
  if (value.kind === 'fixture') {
    return {
      kind: 'fixture',
      action: value.action,
      fixtureKind: value.fixtureKind,
      sourceDate: value.sourceDate,
      targetDate: value.targetDate,
      acceptedRevision: value.acceptedRevision,
    };
  }
  if (value.kind === 'injury') {
    return {
      kind: 'injury',
      operation: value.operation,
      episodeTarget: value.episodeTarget.kind === 'new-report'
        ? { kind: 'new-report' }
        : { kind: 'existing-episode', episodeId: value.episodeTarget.episodeId },
      bodyPartToken: value.bodyPartToken,
      severity: value.severity,
      acceptedRevision: value.acceptedRevision,
    };
  }
  if (value.kind === 'session') {
    return {
      kind: 'session',
      sessionId: value.sessionId,
      componentId: value.componentId,
      sourceDate: value.sourceDate,
      targetDate: value.targetDate,
      acceptedRevision: value.acceptedRevision,
    };
  }
  return {
    kind: 'source-fact',
    factKind: value.factKind,
    factId: value.factId,
    operation: value.operation,
    acceptedRevision: value.acceptedRevision,
  };
}

export function coachInterpretationSemanticHash(value: unknown): CoachSemanticHash {
  const canonical = stableSemanticJsonV2({
    contract: COACH_INTERPRETATION_SEMANTIC_HASH_CONTRACT,
    value,
  });
  return `${COACH_INTERPRETATION_SEMANTIC_HASH_CONTRACT}:${sha256Hex(canonical)}`;
}

function intentSemanticPayload(receipt: Pick<
  CoachClassifiedInterpretationReceiptV1,
  | 'schemaVersion'
  | 'interpretationProvider'
  | 'intentKind'
  | 'resolvedTarget'
  | 'clarification'
  | 'canonicalContextFingerprint'
>): unknown {
  return {
    schemaVersion: receipt.schemaVersion,
    interpretationProvider: receipt.interpretationProvider,
    intentKind: receipt.intentKind,
    resolvedTarget: canonicalTarget(receipt.resolvedTarget),
    clarification: canonicalClarification(receipt.clarification),
    canonicalContextFingerprint: receipt.canonicalContextFingerprint,
  };
}

export function coachIntentSemanticHashV1(receipt: Pick<
  CoachClassifiedInterpretationReceiptV1,
  | 'schemaVersion'
  | 'interpretationProvider'
  | 'intentKind'
  | 'resolvedTarget'
  | 'clarification'
  | 'canonicalContextFingerprint'
>): CoachSemanticHash {
  return coachInterpretationSemanticHash(intentSemanticPayload(receipt));
}

function receiptSemanticPayload(receipt: CoachInterpretationReceiptV1): unknown {
  const base = {
    schemaVersion: receipt.schemaVersion,
    messageSemanticHash: receipt.messageSemanticHash,
    classifierSchemaVersion: receipt.classifierSchemaVersion,
    classifierPromptVersion: receipt.classifierPromptVersion,
    interpretationProvider: receipt.interpretationProvider,
    confidenceBucket: receipt.confidenceBucket,
    needsClarification: receipt.needsClarification,
    classificationStatus: receipt.classificationStatus,
    clockFingerprint: receipt.clockFingerprint,
    canonicalContextFingerprint: receipt.canonicalContextFingerprint,
    clarification: canonicalClarification(receipt.clarification),
    ...(receipt.sourceInterpretationReceiptHash === undefined
      ? {}
      : { sourceInterpretationReceiptHash: receipt.sourceInterpretationReceiptHash }),
  };
  return receipt.classificationStatus === 'classified'
    ? {
        ...base,
        intentKind: receipt.intentKind,
        intentSemanticHash: receipt.intentSemanticHash,
        resolvedTarget: canonicalTarget(receipt.resolvedTarget),
      }
    : { ...base, unavailableReason: receipt.unavailableReason };
}

function computeReceiptId(receipt: CoachInterpretationReceiptV1): CoachInterpretationReceiptHash {
  const canonical = stableSemanticJsonV2({
    contract: COACH_INTERPRETATION_RECEIPT_HASH_CONTRACT,
    value: receiptSemanticPayload(receipt),
  });
  return `${COACH_INTERPRETATION_RECEIPT_HASH_CONTRACT}:${sha256Hex(canonical)}`;
}

function canonicalReceipt(receipt: CoachInterpretationReceiptV1): CoachInterpretationReceiptV1 {
  const base = {
    schemaVersion: COACH_INTERPRETATION_RECEIPT_SCHEMA_VERSION,
    receiptId: receipt.receiptId,
    messageSemanticHash: receipt.messageSemanticHash,
    classifierSchemaVersion: receipt.classifierSchemaVersion,
    classifierPromptVersion: receipt.classifierPromptVersion,
    interpretationProvider: receipt.interpretationProvider,
    confidenceBucket: receipt.confidenceBucket,
    needsClarification: receipt.needsClarification,
    classificationStatus: receipt.classificationStatus,
    clockFingerprint: receipt.clockFingerprint,
    canonicalContextFingerprint: receipt.canonicalContextFingerprint,
    clarification: canonicalClarification(receipt.clarification),
    ...(receipt.sourceInterpretationReceiptHash === undefined
      ? {}
      : { sourceInterpretationReceiptHash: receipt.sourceInterpretationReceiptHash }),
  };
  if (receipt.classificationStatus === 'classified') {
    return {
      ...base,
      classificationStatus: 'classified',
      confidenceBucket: receipt.confidenceBucket as 'low' | 'medium' | 'high',
      intentKind: receipt.intentKind,
      intentSemanticHash: receipt.intentSemanticHash,
      resolvedTarget: canonicalTarget(receipt.resolvedTarget),
    };
  }
  return {
    ...base,
    classificationStatus: 'unavailable',
    confidenceBucket: 'unavailable',
    needsClarification: false,
    clarification: { kind: 'none' },
    unavailableReason: receipt.unavailableReason,
  };
}

function validateIntentTargetConsistency(
  record: UnknownRecord,
  clarificationKind: unknown,
  issues: CoachInterpretationReceiptValidationIssue[],
): void {
  const intentKind = record.intentKind;
  const target = record.resolvedTarget;
  if (intentKind === 'general_conversation') {
    if (target !== null) {
      addIssue(issues, 'invalid-combination', '$.resolvedTarget', 'general conversation has no mutation target');
    }
    if (clarificationKind !== 'none') {
      addIssue(issues, 'invalid-combination', '$.clarification', 'general conversation cannot carry mutation clarification');
    }
    return;
  }
  if (target === null) {
    if (clarificationKind === 'none') {
      addIssue(
        issues,
        'invalid-combination',
        '$.resolvedTarget',
        'resolved mutation intent requires a target with acceptedRevision',
      );
    }
    return;
  }
  if (!isRecord(target)) return;
  const expectedKind = intentKind === 'fixture_change'
    ? 'fixture'
    : intentKind === 'injury_report' || intentKind === 'injury_update'
      ? 'injury'
      : intentKind === 'session_change'
        ? 'session'
        : intentKind === 'source_fact_change'
          ? 'source-fact'
          : null;
  if (expectedKind !== null && target.kind !== expectedKind) {
    addIssue(issues, 'invalid-combination', '$.resolvedTarget.kind', 'does not match intentKind');
  }
  if (intentKind === 'injury_report' && target.operation !== 'report') {
    addIssue(issues, 'invalid-combination', '$.resolvedTarget.operation', 'must be report');
  }
  if (intentKind === 'injury_update' && target.operation !== 'update') {
    addIssue(issues, 'invalid-combination', '$.resolvedTarget.operation', 'must be update');
  }
}

export function validateCoachInterpretationReceiptV1(
  value: unknown,
): CoachInterpretationReceiptV1 {
  const issues: CoachInterpretationReceiptValidationIssue[] = [];
  scanPrivacyForbiddenFields(value, '$', issues);
  if (!isRecord(value)) {
    addIssue(issues, 'invalid-value', '$', 'must be an object');
    throw new CoachInterpretationReceiptValidationError(issues);
  }
  exactKeys(value, ROOT_KEYS, '$', issues);
  if (value.schemaVersion !== COACH_INTERPRETATION_RECEIPT_SCHEMA_VERSION) {
    addIssue(
      issues,
      'unsupported-schema-version',
      '$.schemaVersion',
      `only schema version ${COACH_INTERPRETATION_RECEIPT_SCHEMA_VERSION} is supported`,
    );
  }
  validateHash(required(value, 'receiptId', '$', issues), '$.receiptId', issues, true);
  validateHash(required(value, 'messageSemanticHash', '$', issues), '$.messageSemanticHash', issues);
  validateVersion(required(value, 'classifierSchemaVersion', '$', issues),
    '$.classifierSchemaVersion', issues);
  validateVersion(required(value, 'classifierPromptVersion', '$', issues),
    '$.classifierPromptVersion', issues);
  const provider = required(value, 'interpretationProvider', '$', issues);
  enumValue(provider, COACH_INTERPRETATION_PROVIDERS, '$.interpretationProvider', issues);
  const status = required(value, 'classificationStatus', '$', issues);
  enumValue(status, ['classified', 'unavailable'], '$.classificationStatus', issues);
  const confidence = required(value, 'confidenceBucket', '$', issues);
  enumValue(confidence, ['low', 'medium', 'high', 'unavailable'], '$.confidenceBucket', issues);
  const needsClarification = required(value, 'needsClarification', '$', issues);
  if (typeof needsClarification !== 'boolean') {
    addIssue(issues, 'invalid-value', '$.needsClarification', 'must be boolean');
  }
  validateHash(required(value, 'clockFingerprint', '$', issues), '$.clockFingerprint', issues);
  validateHash(required(value, 'canonicalContextFingerprint', '$', issues),
    '$.canonicalContextFingerprint', issues);
  const clarification = required(value, 'clarification', '$', issues);
  validateClarification(clarification, issues);
  const clarificationKind = isRecord(clarification) ? clarification.kind : undefined;
  if (typeof needsClarification === 'boolean' &&
    needsClarification !== (clarificationKind !== 'none')) {
    addIssue(
      issues,
      'invalid-combination',
      '$.needsClarification',
      'must exactly match whether clarification is pending',
    );
  }

  if (provider === 'replay') {
    validateHash(
      required(value, 'sourceInterpretationReceiptHash', '$', issues),
      '$.sourceInterpretationReceiptHash',
      issues,
      true,
    );
  } else if (hasOwn(value, 'sourceInterpretationReceiptHash')) {
    addIssue(
      issues,
      'invalid-combination',
      '$.sourceInterpretationReceiptHash',
      'is only valid for replay provider receipts',
    );
  }

  if (status === 'classified') {
    const intentKind = required(value, 'intentKind', '$', issues);
    enumValue(intentKind, COACH_INTENT_KINDS, '$.intentKind', issues);
    validateHash(required(value, 'intentSemanticHash', '$', issues), '$.intentSemanticHash', issues);
    const target = required(value, 'resolvedTarget', '$', issues);
    if (target !== undefined) validateResolvedTarget(target, issues);
    if (hasOwn(value, 'unavailableReason')) {
      addIssue(issues, 'invalid-combination', '$.unavailableReason', 'classified receipt cannot be unavailable');
    }
    if (confidence === 'unavailable') {
      addIssue(issues, 'invalid-combination', '$.confidenceBucket', 'classified receipt requires a confidence bucket');
    }
    validateIntentTargetConsistency(value, clarificationKind, issues);
  } else if (status === 'unavailable') {
    enumValue(required(value, 'unavailableReason', '$', issues),
      ['semantic_service_unavailable', 'timeout', 'invalid_response', 'capability_disabled'],
      '$.unavailableReason', issues);
    ['intentKind', 'intentSemanticHash', 'resolvedTarget'].forEach((key) => {
      if (hasOwn(value, key)) {
        addIssue(issues, 'invalid-combination', `$.${key}`, 'unavailable receipt cannot contain an interpretation');
      }
    });
    if (confidence !== 'unavailable') {
      addIssue(issues, 'invalid-combination', '$.confidenceBucket', 'must be unavailable');
    }
    if (needsClarification !== false || clarificationKind !== 'none') {
      addIssue(issues, 'invalid-combination', '$.clarification', 'unavailable classification cannot ask clarification');
    }
  }

  if (issues.length > 0) throw new CoachInterpretationReceiptValidationError(issues);
  const normalized = canonicalReceipt(value as unknown as CoachInterpretationReceiptV1);
  if (normalized.classificationStatus === 'classified') {
    const expectedIntentHash = coachIntentSemanticHashV1(normalized);
    if (normalized.intentSemanticHash !== expectedIntentHash) {
      addIssue(
        issues,
        'integrity-mismatch',
        '$.intentSemanticHash',
        `expected ${expectedIntentHash}`,
      );
    }
  }
  const expectedReceiptId = computeReceiptId(normalized);
  if (normalized.receiptId !== expectedReceiptId) {
    addIssue(issues, 'integrity-mismatch', '$.receiptId', `expected ${expectedReceiptId}`);
  }
  if (issues.length > 0) throw new CoachInterpretationReceiptValidationError(issues);
  return normalized;
}

export const parseCoachInterpretationReceiptV1 = validateCoachInterpretationReceiptV1;

export function createCoachInterpretationReceiptV1(
  draft: CoachInterpretationReceiptDraftV1,
): CoachInterpretationReceiptV1 {
  const schemaVersion = COACH_INTERPRETATION_RECEIPT_SCHEMA_VERSION;
  let candidate: CoachInterpretationReceiptV1;
  if (draft.classificationStatus === 'classified') {
    const classified = {
      ...draft,
      schemaVersion,
      clarification: canonicalClarification(draft.clarification),
      resolvedTarget: canonicalTarget(draft.resolvedTarget),
    };
    const intentSemanticHash = coachIntentSemanticHashV1(classified);
    candidate = {
      ...classified,
      intentSemanticHash,
      receiptId: `${COACH_INTERPRETATION_RECEIPT_HASH_CONTRACT}:${'0'.repeat(64)}`,
    } as CoachClassifiedInterpretationReceiptV1;
  } else {
    candidate = {
      ...draft,
      schemaVersion,
      clarification: { kind: 'none' },
      receiptId: `${COACH_INTERPRETATION_RECEIPT_HASH_CONTRACT}:${'0'.repeat(64)}`,
    } as CoachUnavailableInterpretationReceiptV1;
  }
  candidate = { ...candidate, receiptId: computeReceiptId(candidate) };
  return validateCoachInterpretationReceiptV1(candidate);
}

export function stableCoachInterpretationReceiptJson(value: unknown): string {
  return stableSemanticJsonV2(validateCoachInterpretationReceiptV1(value));
}

export function coachInterpretationReceiptSemanticHash(
  value: unknown,
): CoachInterpretationReceiptHash {
  return validateCoachInterpretationReceiptV1(value).receiptId;
}

export type CoachReplayEligibilityStatus =
  | 'eligible'
  | 'schema_mismatch'
  | 'context_mismatch'
  | 'clock_mismatch'
  | 'capability_disabled'
  | 'missing_source_receipt'
  | 'invalid_receipt';

export type CoachReplayEligibilityResult =
  | { readonly status: 'eligible'; readonly receipt: CoachInterpretationReceiptV1 }
  | {
      readonly status: 'schema_mismatch';
      readonly expectedSchemaVersion: typeof COACH_INTERPRETATION_RECEIPT_SCHEMA_VERSION;
      readonly actualSchemaVersion: unknown;
    }
  | { readonly status: 'context_mismatch' }
  | { readonly status: 'clock_mismatch' }
  | { readonly status: 'capability_disabled'; readonly capabilityId: 'coach.message' }
  | { readonly status: 'missing_source_receipt' }
  | { readonly status: 'invalid_receipt'; readonly issues: readonly CoachInterpretationReceiptValidationIssue[] };

export interface CoachReplayEligibilityOptionsV1 {
  readonly canonicalContextFingerprint: CoachSemanticHash;
  readonly clockFingerprint: CoachSemanticHash;
  /** Fail-closed. This pure helper never changes the Explorer capability matrix. */
  readonly coachMessageCapabilityEnabled?: boolean;
  /** Caller-owned proof only; this layer performs no store or network lookup. */
  readonly availableSourceInterpretationReceiptHashes?: readonly CoachInterpretationReceiptHash[];
}

export function evaluateCoachReplayEligibilityV1(
  value: unknown,
  options: CoachReplayEligibilityOptionsV1,
): CoachReplayEligibilityResult {
  if (!isRecord(value) || value.schemaVersion !== COACH_INTERPRETATION_RECEIPT_SCHEMA_VERSION) {
    return {
      status: 'schema_mismatch',
      expectedSchemaVersion: COACH_INTERPRETATION_RECEIPT_SCHEMA_VERSION,
      actualSchemaVersion: isRecord(value) ? value.schemaVersion : undefined,
    };
  }
  if (value.interpretationProvider === 'replay' &&
    !hasOwn(value, 'sourceInterpretationReceiptHash')) {
    return { status: 'missing_source_receipt' };
  }
  let receipt: CoachInterpretationReceiptV1;
  try {
    receipt = validateCoachInterpretationReceiptV1(value);
  } catch (error) {
    return {
      status: 'invalid_receipt',
      issues: error instanceof CoachInterpretationReceiptValidationError
        ? error.issues
        : [{ code: 'invalid-value', path: '$', message: String(error) }],
    };
  }
  if (!HASH_PATTERN.test(options.canonicalContextFingerprint) ||
    !HASH_PATTERN.test(options.clockFingerprint)) {
    return {
      status: 'invalid_receipt',
      issues: [{
        code: 'invalid-hash',
        path: '$options',
        message: 'replay context and clock fingerprints must be valid hashes',
      }],
    };
  }
  if (options.coachMessageCapabilityEnabled !== true) {
    return { status: 'capability_disabled', capabilityId: 'coach.message' };
  }
  if (receipt.canonicalContextFingerprint !== options.canonicalContextFingerprint) {
    return { status: 'context_mismatch' };
  }
  if (receipt.clockFingerprint !== options.clockFingerprint) {
    return { status: 'clock_mismatch' };
  }
  if (receipt.interpretationProvider === 'replay') {
    const available = options.availableSourceInterpretationReceiptHashes;
    if (!available || !available.includes(receipt.sourceInterpretationReceiptHash)) {
      return { status: 'missing_source_receipt' };
    }
  }
  return { status: 'eligible', receipt };
}
