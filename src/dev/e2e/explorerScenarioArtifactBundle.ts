import type { AthleteActionTraceRecordV2, TraceField } from './AthleteActionTraceCoordinator';
import {
  assertAthleteActionArtifactBundleV2,
  type AthleteActionArtifactBundleV2,
} from './athleteActionArtifactBundle';
import type { DevE2EClockReceipt } from './DevE2EClock';
import { parseDevE2EClockReceipt } from './DevE2EClock';
import type {
  DevE2ECheckpointRecord,
  DevE2EFingerprintMap,
} from './devE2ECheckpoint';
import type { DevE2ESeedId } from './devE2ESeedIds';
import {
  parseDevE2EScenarioSessionRecord,
  type DevE2EScenarioSessionRecord,
} from './devE2EScenarioSession';
import {
  semanticFingerprintV2,
  type SemanticFingerprintV2,
} from '../../utils/semanticFingerprintV2';

export const EXPLORER_SCENARIO_ARTIFACT_SCHEMA_VERSION = 1 as const;
export const EXPLORER_SCENARIO_RELOAD_RECEIPT_VERSION = 1 as const;

export const EXPLORER_SCENARIO_ARTIFACT_FAILURE = {
  INVALID_BUNDLE: 'explorer_scenario_artifact_invalid_bundle',
  SCHEMA_VERSION_UNSUPPORTED: 'explorer_scenario_artifact_schema_version_unsupported',
  IDENTITY_MISMATCH: 'explorer_scenario_artifact_identity_mismatch',
  MANIFEST_SEMANTIC_HASH_MISMATCH: 'explorer_scenario_manifest_semantic_hash_mismatch',
  STEP_ORDER_MISMATCH: 'explorer_scenario_step_order_mismatch',
  ACTION_BUNDLE_INVALID: 'explorer_scenario_action_bundle_invalid',
  TRACE_ROOT_MISMATCH: 'explorer_scenario_trace_root_mismatch',
  TRACE_PRIOR_LINKAGE_BROKEN: 'explorer_scenario_trace_prior_linkage_broken',
  RELOAD_COUNT_NON_MONOTONIC: 'explorer_scenario_reload_count_non_monotonic',
  SCREENSHOT_MISSING: 'explorer_scenario_screenshot_missing',
  HIERARCHY_MISSING: 'explorer_scenario_hierarchy_missing',
  FINGERPRINT_MISSING: 'explorer_scenario_fingerprint_missing',
  INTENDED_ACTION_SEMANTIC_HASH_MISMATCH:
    'explorer_scenario_intended_action_semantic_hash_mismatch',
  ENVIRONMENT_SPECIFIC_SEMANTIC_HASH_INPUT:
    'explorer_scenario_environment_specific_semantic_hash_input',
  ORACLE_UNEVALUATED: 'explorer_scenario_oracle_unevaluated',
  PASSED_WITH_FAILED_HARD_ORACLE: 'explorer_scenario_passed_with_failed_hard_oracle',
  FIRST_FAILING_STEP_MISSING: 'explorer_scenario_first_failing_step_missing',
  FIRST_FAILING_ORACLE_MISMATCH: 'explorer_scenario_first_failing_oracle_mismatch',
  FIRST_DIVERGENT_PROJECTION_MISSING:
    'explorer_scenario_first_divergent_projection_missing',
  FAILURE_CLUSTER_SIGNATURE_MISMATCH:
    'explorer_scenario_failure_cluster_signature_mismatch',
  SHRINK_ORIGINAL_CHAIN_MISSING: 'explorer_scenario_shrink_original_chain_missing',
  GENERATED_METADATA_INVALID: 'explorer_scenario_generated_metadata_invalid',
  PRIVACY_FORBIDDEN_FIELD: 'explorer_scenario_privacy_forbidden_field',
  SEMANTIC_HASH_MISMATCH: 'explorer_scenario_artifact_semantic_hash_mismatch',
} as const;

export type ExplorerScenarioArtifactFailureCode =
  (typeof EXPLORER_SCENARIO_ARTIFACT_FAILURE)[keyof typeof EXPLORER_SCENARIO_ARTIFACT_FAILURE];

export class ExplorerScenarioArtifactValidationError extends Error {
  readonly code: ExplorerScenarioArtifactFailureCode;

  constructor(code: ExplorerScenarioArtifactFailureCode, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = 'ExplorerScenarioArtifactValidationError';
    this.code = code;
  }
}

export interface ExplorerArtifactReferenceV1 {
  /** Stable logical ID, never an absolute filesystem path. */
  artifactId: string;
  /** Integrity receipt. Media content fingerprints are excluded from scenario semantic hashes. */
  contentFingerprint: string;
}

export interface ExplorerScenarioManifestReferenceV1 {
  scenarioId: string;
  seedId: DevE2ESeedId;
  schemaVersion: number;
  semanticHash: SemanticFingerprintV2;
  orderedStepIds: string[];
}

export interface ExplorerScenarioSeedWitnessV1 {
  witnessId: string;
  status: 'passed' | 'failed';
  evidenceFingerprint: string;
}

export interface ExplorerScenarioSeedWitnessReportV1 {
  seedId: DevE2ESeedId;
  complete: boolean;
  witnesses: ExplorerScenarioSeedWitnessV1[];
}

export interface ExplorerScenarioSeedEvidenceV1 {
  witnessReport: ExplorerScenarioSeedWitnessReportV1;
  initialAcceptedSemanticFingerprint: string;
  initialPersistedStoreFingerprints: DevE2EFingerprintMap;
  initialScreenshotReference: ExplorerArtifactReferenceV1;
  initialAccessibilityHierarchyReference: ExplorerArtifactReferenceV1;
}

export interface ExplorerScenarioCheckpointEvidenceV1 {
  scenarioId: string;
  stepId: string;
  /** Reload count before the cold reload that follows this checkpoint. */
  reloadCount: number;
  checkpointRecord: DevE2ECheckpointRecord;
  scenarioSessionRecord: DevE2EScenarioSessionRecord;
}

export interface ExplorerScenarioReloadReceiptV1 {
  protocolVersion: typeof EXPLORER_SCENARIO_RELOAD_RECEIPT_VERSION;
  receiptId: string;
  scenarioId: string;
  stepId: string;
  reloadCount: number;
  traceV2RootId: string;
  acceptedSemanticFingerprint: string;
  persistedStoreFingerprints: DevE2EFingerprintMap;
  clockFingerprint: string;
  scenarioSessionRecord: DevE2EScenarioSessionRecord;
}

export interface ExplorerScenarioSessionEvidenceV1 {
  protocolVersion: number;
  scenarioSessionRecordAtReset: DevE2EScenarioSessionRecord;
  checkpointRecords: ExplorerScenarioCheckpointEvidenceV1[];
  reloadReceipts: ExplorerScenarioReloadReceiptV1[];
  finalScenarioSessionRecord: DevE2EScenarioSessionRecord;
  reloadCount: number;
  completionStatus: {
    status: 'complete' | 'blocked';
    reasonCode: string;
  };
}

export interface ExplorerScenarioIntendedActionReceiptV1 {
  actionKind: string;
  productionSurface: string;
  /** Privacy-safe typed preimage. Raw Coach or injury text is forbidden. */
  semanticInput: unknown;
}

export interface ExplorerScenarioSelectorReceiptV1 {
  selectorId: string;
  strategy: 'test_id' | 'accessibility_id' | 'semantic_control_id';
}

export interface ExplorerScenarioActionFingerprintsV1 {
  acceptedSemanticFingerprint: string;
  persistedStoreFingerprints: DevE2EFingerprintMap;
}

export interface ExplorerScenarioActionEvidenceV1 {
  stepId: string;
  intendedActionSemanticHash: SemanticFingerprintV2;
  intendedActionReceipt: ExplorerScenarioIntendedActionReceiptV1;
  actualProductionReceiptReference: ExplorerArtifactReferenceV1;
  actionArtifactBundle: AthleteActionArtifactBundleV2;
  traceV2RootId: string;
  priorActionTraceId: string | null;
  fingerprints: {
    beforeAction: ExplorerScenarioActionFingerprintsV1;
    afterAction: ExplorerScenarioActionFingerprintsV1;
    afterReload: ExplorerScenarioActionFingerprintsV1;
  };
  selectorsUsed: ExplorerScenarioSelectorReceiptV1[];
  screenshots: {
    afterAction: ExplorerArtifactReferenceV1;
    afterReload: ExplorerArtifactReferenceV1;
  };
  accessibilityHierarchies: {
    afterAction: ExplorerArtifactReferenceV1;
    afterReload: ExplorerArtifactReferenceV1;
  };
}

export type ExplorerOracleValueV1 =
  | { representation: 'value'; value: unknown }
  | { representation: 'semantic_fingerprint'; fingerprint: string };

export interface ExplorerScenarioOracleEvidenceV1 {
  oracleId: string;
  stepId: string;
  evaluationPoint: 'after_action' | 'after_reload' | 'scenario_end';
  enforcement: 'hard' | 'advisory';
  evaluationStatus: 'evaluated';
  expectedValue: ExplorerOracleValueV1;
  actualValueOrFingerprint: ExplorerOracleValueV1;
  passed: boolean;
  failureCode: string | null;
  firstDivergentProjection: string | null;
}

export type ExplorerScenarioDisposition =
  | 'passed'
  | 'product_failure'
  | 'oracle_failure'
  | 'infrastructure_failure'
  | 'incomplete_artifact';

export interface ExplorerScenarioResultV1 {
  disposition: ExplorerScenarioDisposition;
  firstFailingStepId: string | null;
  firstFailingOracleId: string | null;
  firstDivergentProjection: string | null;
  failureClusterSignature: SemanticFingerprintV2 | null;
  runnerLogReference: ExplorerArtifactReferenceV1;
  reproductionCommand: string;
}

export interface ExplorerGeneratedActionChainEntryV1 {
  stepId: string;
  intendedActionSemanticHash: SemanticFingerprintV2;
}

export interface ExplorerShrinkLineageEntryV1 {
  attempt: number;
  parentChainSemanticHash: SemanticFingerprintV2;
  candidateChainSemanticHash: SemanticFingerprintV2;
  result: 'retained' | 'rejected';
}

export interface ExplorerScenarioGeneratedCaseMetadataV1 {
  pairwiseDimensions?: Record<string, string>;
  coveredPairIds?: string[];
  originalActionChain?: ExplorerGeneratedActionChainEntryV1[];
  minimizedActionChain?: ExplorerGeneratedActionChainEntryV1[];
  shrinkLineage?: ExplorerShrinkLineageEntryV1[];
  shrinkAttemptCount?: number;
}

export interface ExplorerScenarioArtifactBundleV1 {
  schemaVersion: typeof EXPLORER_SCENARIO_ARTIFACT_SCHEMA_VERSION;
  semanticHash: SemanticFingerprintV2;
  identity: {
    scenarioId: string;
    scenarioTier: string;
    manifestSchemaVersion: number;
    manifestSemanticHash: SemanticFingerprintV2;
    seedId: DevE2ESeedId;
    campaignSeed?: string;
    repositoryCommit: string;
    buildIdentifier: string;
    deterministicClockReceipt: DevE2EClockReceipt;
  };
  resolvedScenarioManifestReference: ExplorerScenarioManifestReferenceV1;
  seedEvidence: ExplorerScenarioSeedEvidenceV1;
  scenarioSessionEvidence: ExplorerScenarioSessionEvidenceV1;
  actions: ExplorerScenarioActionEvidenceV1[];
  oracles: ExplorerScenarioOracleEvidenceV1[];
  result: ExplorerScenarioResultV1;
  generatedCaseMetadata?: ExplorerScenarioGeneratedCaseMetadataV1;
}

type ExplorerScenarioArtifactBundleWithoutHashV1 =
  Omit<ExplorerScenarioArtifactBundleV1, 'schemaVersion' | 'semanticHash'>;

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const NON_CLOCK_TIMESTAMP_KEY =
  /(?:timestamp|(?:created|updated|started|ended|finalized|observed|captured)At)$/i;
const ENVIRONMENT_KEY =
  /^(?:absolutePath|localPath|temporaryPath|tempPath|repositoryRoot|metroPort|temporaryMetroPort|simulatorDeviceId|simulatorDeviceIdentifier|simulatorUdid|deviceUdid|udid)$/i;
const MEDIA_KEY = /(?:screenshot|accessibilityHierarchy|accessibilityHierarchies|hierarchy)/i;
const MEDIA_BYTES_KEY = /^(?:bytes|base64|content|contentFingerprint|data)$/i;
const ABSOLUTE_PATH =
  /(?:^|[\s"'=])(?:\/Users\/|\/home\/|\/private\/(?:tmp|var\/folders)\/|\/tmp\/|[a-zA-Z]:\\(?:Users|Temp)\\)[^\s"']*/g;
const METRO_ENDPOINT = /((?:localhost|127\.0\.0\.1):)\d{2,5}/g;

interface NormalizationContext {
  clockOwned: boolean;
  media: boolean;
  path: string[];
}

function summarizeActionBundleForSemanticHash(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<AthleteActionArtifactBundleV2>;
  const root = typeof record.root === 'string' ? record.root : '';
  const files = record.files && typeof record.files === 'object'
    ? Object.keys(record.files).sort().map((filePath) => {
        const relativePath = root && filePath.startsWith(`${root}/`)
          ? filePath.slice(root.length + 1)
          : filePath;
        if (/^(?:screenshots|accessibility-hierarchy)\//.test(relativePath)) {
          return { path: relativePath };
        }
        const contents = record.files![filePath];
        let semanticContents: unknown = contents;
        if (filePath.endsWith('.json')) {
          try {
            semanticContents = JSON.parse(contents);
            if (relativePath === 'manifest.json' && isRecord(semanticContents) &&
              Array.isArray(semanticContents.files)) {
              semanticContents = {
                ...semanticContents,
                files: semanticContents.files.map((entry) =>
                  isRecord(entry) && nonEmptyString(entry.path)
                    ? { path: entry.path }
                    : null),
              };
            }
          } catch {
            semanticContents = contents;
          }
        }
        return {
          path: relativePath,
          semanticContents: normalizeSemanticValue(
            semanticContents,
            {
              clockOwned: false,
              media: false,
              path: ['actionArtifactBundle', 'files', relativePath],
            },
            new WeakSet<object>(),
          ),
        };
      })
    : [];
  return { root, files };
}

function normalizeString(value: string, context: NormalizationContext): unknown {
  const key = context.path[context.path.length - 1] ?? '';
  if (!context.clockOwned && (NON_CLOCK_TIMESTAMP_KEY.test(key) || ISO_INSTANT.test(value))) {
    return undefined;
  }
  if (/^(?:simulatorDeviceId|simulatorDeviceIdentifier|simulatorUdid|deviceUdid|udid)$/i.test(key)) {
    return undefined;
  }
  const withoutPaths = value.replace(ABSOLUTE_PATH, (matched) => {
    const prefix = /^[\s"'=]/.test(matched) ? matched[0] : '';
    return `${prefix}<absolute-path>`;
  });
  return withoutPaths.replace(METRO_ENDPOINT, '$1<metro-port>');
}

function normalizeSemanticValue(
  value: unknown,
  context: NormalizationContext,
  seen: WeakSet<object>,
): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return normalizeString(value, context);
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) {
    throw new ExplorerScenarioArtifactValidationError(
      EXPLORER_SCENARIO_ARTIFACT_FAILURE.INVALID_BUNDLE,
      'circular_semantic_input',
    );
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const normalized = value.map((entry, index) =>
      normalizeSemanticValue(entry, {
        ...context,
        path: [...context.path, String(index)],
      }, seen) ?? null);
    seen.delete(value);
    return normalized;
  }
  if (value instanceof Date) {
    seen.delete(value);
    return context.clockOwned ? value.toISOString() : undefined;
  }
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (context.path.length === 0 && key === 'semanticHash') continue;
    if (key === 'actionArtifactBundle') {
      normalized[key] = summarizeActionBundleForSemanticHash(
        (value as Record<string, unknown>)[key],
      );
      continue;
    }
    const clockOwned = context.clockOwned || key === 'deterministicClockReceipt';
    const media = context.media || MEDIA_KEY.test(key);
    if (ENVIRONMENT_KEY.test(key) || (!clockOwned && NON_CLOCK_TIMESTAMP_KEY.test(key))) continue;
    if (media && MEDIA_BYTES_KEY.test(key)) continue;
    const child = normalizeSemanticValue(
      (value as Record<string, unknown>)[key],
      { clockOwned, media, path: [...context.path, key] },
      seen,
    );
    if (child !== undefined) normalized[key] = child;
  }
  seen.delete(value);
  return normalized;
}

/** Deterministic semantic projection shared by the collector, validator, and writer. */
export function normalizeExplorerScenarioSemanticValue(value: unknown): unknown {
  return normalizeSemanticValue(value, {
    clockOwned: false,
    media: false,
    path: [],
  }, new WeakSet<object>());
}

export function explorerScenarioSemanticHash(value: unknown): SemanticFingerprintV2 {
  return semanticFingerprintV2({
    contract: 'explorer-scenario-artifact-v1',
    value: normalizeExplorerScenarioSemanticValue(value),
  });
}

export function explorerScenarioManifestSemanticHash(
  reference: Omit<ExplorerScenarioManifestReferenceV1, 'semanticHash'>,
): SemanticFingerprintV2 {
  return explorerScenarioSemanticHash({
    kind: 'resolved_scenario_manifest_reference',
    ...reference,
  });
}

export function explorerIntendedActionSemanticHash(
  receipt: ExplorerScenarioIntendedActionReceiptV1,
): SemanticFingerprintV2 {
  return explorerScenarioSemanticHash({
    kind: 'intended_action_receipt',
    ...receipt,
  });
}

export function buildExplorerFailureClusterSignature(args: {
  oracleId: string;
  primaryFailureCode: string;
  actionKind: string;
  productionSurface: string;
  firstDivergentProjection: string;
  firstFailingStepId: string;
}): SemanticFingerprintV2 {
  return explorerScenarioSemanticHash({
    kind: 'explorer_failure_cluster_signature_v1',
    oracleId: args.oracleId,
    primaryFailureCode: args.primaryFailureCode,
    actionKind: args.actionKind,
    productionSurface: args.productionSurface,
    firstDivergentProjection: args.firstDivergentProjection,
    firstFailingStepId: args.firstFailingStepId,
  });
}

function fail(code: ExplorerScenarioArtifactFailureCode, detail?: string): never {
  throw new ExplorerScenarioArtifactValidationError(code, detail);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonEmptyFingerprintMap(value: unknown): value is DevE2EFingerprintMap {
  return isRecord(value) && Object.keys(value).length > 0 &&
    Object.entries(value).every(([key, fingerprint]) =>
      key.length > 0 && nonEmptyString(fingerprint));
}

function sameFingerprintMap(left: DevE2EFingerprintMap, right: DevE2EFingerprintMap): boolean {
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
  return keys.every((key) => left[key] === right[key]);
}

function assertArtifactReference(
  value: unknown,
  missingCode: ExplorerScenarioArtifactFailureCode,
  detail: string,
): asserts value is ExplorerArtifactReferenceV1 {
  if (!isRecord(value) ||
    !nonEmptyString(value.artifactId) ||
    !nonEmptyString(value.contentFingerprint) ||
    /<absolute-path>/.test(value.artifactId) ||
    value.artifactId !== normalizeString(value.artifactId, {
      clockOwned: false,
      media: false,
      path: ['artifactId'],
    })) {
    fail(missingCode, detail);
  }
}

const FORBIDDEN_PROFILE_KEY = /^(?:profile|userProfile|athleteProfile|onboardingData|unrelatedProfileData)$/i;
const RAW_PRIVATE_KEY = /^(?:message|coachMessage|coachText|rawCoachMessage|rawCoachText|injuryDescription|injuryDetails|rawInjuryDescription|athleteName|athleteFullName|firstName|lastName|fullName|email|emailAddress)$/i;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function redactedReceipt(value: unknown): boolean {
  return isRecord(value) && value.redacted === true &&
    nonEmptyString(value.fingerprint) && typeof value.length === 'number';
}

function assertPrivacySafeValue(value: unknown, path: string[] = []): void {
  if (typeof value === 'string') {
    if (EMAIL_VALUE.test(value)) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.PRIVACY_FORBIDDEN_FIELD,
        [...path, 'email_value'].join('.'));
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPrivacySafeValue(entry, [...path, String(index)]));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PROFILE_KEY.test(key)) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.PRIVACY_FORBIDDEN_FIELD,
        [...path, key].join('.'));
    }
    if (RAW_PRIVATE_KEY.test(key) && child !== null && !redactedReceipt(child)) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.PRIVACY_FORBIDDEN_FIELD,
        [...path, key].join('.'));
    }
    assertPrivacySafeValue(child, [...path, key]);
  }
}

function bundleFileBySuffix(bundle: AthleteActionArtifactBundleV2, suffix: string): string | null {
  const entry = Object.entries(bundle.files).find(([filePath]) =>
    filePath === `${bundle.root}/${suffix}`);
  return entry?.[1] ?? null;
}

function parsedActionBundleJson(
  bundle: AthleteActionArtifactBundleV2,
  suffix: string,
): Record<string, unknown> {
  const content = bundleFileBySuffix(bundle, suffix);
  if (!content) fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.ACTION_BUNDLE_INVALID, suffix);
  try {
    const parsed = JSON.parse(content);
    if (!isRecord(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    return fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.ACTION_BUNDLE_INVALID,
      `${suffix}:invalid_json`);
  }
}

function assertActionBundlePrivacy(bundle: AthleteActionArtifactBundleV2): void {
  for (const [filePath, contents] of Object.entries(bundle.files)) {
    if (/\/(?:screenshots)\//.test(filePath)) continue;
    if (filePath.endsWith('.json')) {
      try {
        assertPrivacySafeValue(JSON.parse(contents), ['actionArtifactBundle', filePath]);
      } catch (error) {
        if (error instanceof ExplorerScenarioArtifactValidationError) throw error;
        fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.ACTION_BUNDLE_INVALID,
          `${filePath}:invalid_json`);
      }
    }
    if (filePath.endsWith('action-script.yaml')) {
      const unsafeLine = contents.split('\n').find((line) => {
        const match = line.match(/^\s*(?:message|coachText|injuryDescription|injuryDetails)\s*:\s*(.+)$/i);
        return Boolean(match && !/\[redacted:[^\]]+\]/.test(match[1]));
      });
      if (unsafeLine) {
        fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.PRIVACY_FORBIDDEN_FIELD,
          'actionArtifactBundle.action-script.yaml');
      }
    }
  }
}

function captured<T>(field: TraceField<T> | unknown): T | undefined {
  return isRecord(field) && field.status === 'captured'
    ? field.value as T
    : undefined;
}

function parseTrace(bundle: AthleteActionArtifactBundleV2): AthleteActionTraceRecordV2 {
  return parsedActionBundleJson(bundle, 'athlete-action-trace-v2.json') as unknown as
    AthleteActionTraceRecordV2;
}

function assertActionBundleManifestIntegrity(
  bundle: AthleteActionArtifactBundleV2,
  manifest: Record<string, unknown>,
  stepId: string,
): void {
  if (!Array.isArray(manifest.files)) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.ACTION_BUNDLE_INVALID,
      `${stepId}:manifest_files`);
  }
  const entries = manifest.files as unknown[];
  const expectedPaths = Object.keys(bundle.files)
    .filter((filePath) => filePath !== `${bundle.root}/manifest.json`)
    .sort();
  if (entries.length !== expectedPaths.length) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.ACTION_BUNDLE_INVALID,
      `${stepId}:manifest_file_count`);
  }
  entries.forEach((entry, index) => {
    const expectedPath = expectedPaths[index];
    const relativePath = expectedPath.slice(bundle.root.length + 1);
    if (!isRecord(entry) || entry.path !== relativePath ||
      entry.fingerprint !== semanticFingerprintV2(bundle.files[expectedPath])) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.ACTION_BUNDLE_INVALID,
        `${stepId}:manifest_integrity:${relativePath}`);
    }
  });
}

function assertActionFingerprints(
  value: ExplorerScenarioActionFingerprintsV1,
  detail: string,
): void {
  if (!isRecord(value) ||
    !nonEmptyString(value.acceptedSemanticFingerprint) ||
    !nonEmptyFingerprintMap(value.persistedStoreFingerprints)) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.FINGERPRINT_MISSING, detail);
  }
}

function containsEnvironmentSpecificSemanticInput(value: unknown): boolean {
  if (typeof value === 'string') {
    ABSOLUTE_PATH.lastIndex = 0;
    const hasPath = ABSOLUTE_PATH.test(value);
    ABSOLUTE_PATH.lastIndex = 0;
    METRO_ENDPOINT.lastIndex = 0;
    const hasMetroEndpoint = METRO_ENDPOINT.test(value);
    METRO_ENDPOINT.lastIndex = 0;
    return hasPath || hasMetroEndpoint;
  }
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsEnvironmentSpecificSemanticInput);
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    ENVIRONMENT_KEY.test(key) || containsEnvironmentSpecificSemanticInput(child));
}

function assertScenarioSession(
  value: unknown,
  detail: string,
): DevE2EScenarioSessionRecord {
  try {
    return parseDevE2EScenarioSessionRecord(value);
  } catch {
    return fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.IDENTITY_MISMATCH, detail);
  }
}

function assertOracleValue(value: unknown, detail: string): void {
  if (!isRecord(value) ||
    (value.representation !== 'value' && value.representation !== 'semantic_fingerprint') ||
    (value.representation === 'semantic_fingerprint' && !nonEmptyString(value.fingerprint)) ||
    (value.representation === 'value' && !Object.prototype.hasOwnProperty.call(value, 'value'))) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.ORACLE_UNEVALUATED, detail);
  }
}

/**
 * Scenario-level cross-record validator. It never mutates or widens the embedded
 * AthleteActionArtifactBundleV2 contract.
 */
export function assertExplorerScenarioArtifactBundleV1(
  bundle: ExplorerScenarioArtifactBundleV1,
): void {
  if (!isRecord(bundle)) fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.INVALID_BUNDLE);
  if (bundle.schemaVersion !== EXPLORER_SCENARIO_ARTIFACT_SCHEMA_VERSION) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.SCHEMA_VERSION_UNSUPPORTED);
  }
  assertPrivacySafeValue(bundle);

  const identity = bundle.identity;
  const manifest = bundle.resolvedScenarioManifestReference;
  if (!isRecord(identity) || !isRecord(manifest) ||
    !nonEmptyString(identity.scenarioId) ||
    !nonEmptyString(identity.scenarioTier) ||
    !nonEmptyString(identity.repositoryCommit) ||
    !nonEmptyString(identity.buildIdentifier) ||
    typeof identity.manifestSchemaVersion !== 'number' ||
    !Number.isInteger(identity.manifestSchemaVersion) ||
    identity.manifestSchemaVersion < 1 ||
    !nonEmptyString(identity.manifestSemanticHash) ||
    !nonEmptyString(identity.seedId) ||
    (identity.campaignSeed !== undefined && !nonEmptyString(identity.campaignSeed)) ||
    manifest.scenarioId !== identity.scenarioId ||
    manifest.seedId !== identity.seedId ||
    manifest.schemaVersion !== identity.manifestSchemaVersion ||
    manifest.semanticHash !== identity.manifestSemanticHash ||
    !Array.isArray(manifest.orderedStepIds) ||
    manifest.orderedStepIds.length === 0 ||
    manifest.orderedStepIds.some((stepId) => !nonEmptyString(stepId)) ||
    new Set(manifest.orderedStepIds).size !== manifest.orderedStepIds.length) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.IDENTITY_MISMATCH);
  }
  let clockReceipt: DevE2EClockReceipt;
  try {
    clockReceipt = parseDevE2EClockReceipt(identity.deterministicClockReceipt);
  } catch {
    return fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.IDENTITY_MISMATCH,
      'deterministic_clock_receipt');
  }
  if (clockReceipt.seedId !== identity.seedId) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.IDENTITY_MISMATCH,
      'clock_seed_id');
  }
  const expectedManifestHash = explorerScenarioManifestSemanticHash({
    scenarioId: manifest.scenarioId,
    seedId: manifest.seedId,
    schemaVersion: manifest.schemaVersion,
    orderedStepIds: manifest.orderedStepIds,
  });
  if (manifest.semanticHash !== expectedManifestHash) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.MANIFEST_SEMANTIC_HASH_MISMATCH);
  }

  const seed = bundle.seedEvidence;
  if (!isRecord(seed) || !isRecord(seed.witnessReport) ||
    seed.witnessReport.seedId !== identity.seedId ||
    seed.witnessReport.complete !== true ||
    !Array.isArray(seed.witnessReport.witnesses) ||
    seed.witnessReport.witnesses.some((witness) =>
      !isRecord(witness) ||
      !nonEmptyString(witness.witnessId) ||
      (witness.status !== 'passed' && witness.status !== 'failed') ||
      !nonEmptyString(witness.evidenceFingerprint)) ||
    new Set(seed.witnessReport.witnesses.map((witness) => witness.witnessId)).size !==
      seed.witnessReport.witnesses.length ||
    !nonEmptyString(seed.initialAcceptedSemanticFingerprint) ||
    !nonEmptyFingerprintMap(seed.initialPersistedStoreFingerprints)) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.FINGERPRINT_MISSING, 'seed_evidence');
  }
  assertArtifactReference(seed.initialScreenshotReference,
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.SCREENSHOT_MISSING, 'seed_initial');
  assertArtifactReference(seed.initialAccessibilityHierarchyReference,
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.HIERARCHY_MISSING, 'seed_initial');

  const sessionEvidence = bundle.scenarioSessionEvidence;
  if (!isRecord(sessionEvidence) ||
    typeof sessionEvidence.protocolVersion !== 'number' ||
    !Array.isArray(sessionEvidence.checkpointRecords) ||
    !Array.isArray(sessionEvidence.reloadReceipts) ||
    !isRecord(sessionEvidence.completionStatus) ||
    (sessionEvidence.completionStatus.status !== 'complete' &&
      sessionEvidence.completionStatus.status !== 'blocked') ||
    !nonEmptyString(sessionEvidence.completionStatus.reasonCode)) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.INVALID_BUNDLE, 'scenario_session_evidence');
  }
  const resetSession = assertScenarioSession(
    sessionEvidence.scenarioSessionRecordAtReset,
    'scenario_session_at_reset',
  );
  if (resetSession.protocolVersion !== sessionEvidence.protocolVersion ||
    resetSession.scenarioId !== identity.scenarioId ||
    resetSession.seedId !== identity.seedId ||
    resetSession.reloadCount !== 0 ||
    resetSession.checkpointStepId !== null ||
    resetSession.currentAcceptedSemanticFingerprint !==
      seed.initialAcceptedSemanticFingerprint ||
    !sameFingerprintMap(resetSession.persistedStoreFingerprints,
      seed.initialPersistedStoreFingerprints)) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.IDENTITY_MISMATCH,
      'scenario_session_at_reset');
  }

  if (!Array.isArray(bundle.actions) || bundle.actions.length === 0 ||
    bundle.actions.some((action, index) =>
      !isRecord(action) || action.stepId !== manifest.orderedStepIds[index])) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.STEP_ORDER_MISMATCH);
  }
  if (sessionEvidence.completionStatus.status === 'complete' &&
    bundle.actions.length !== manifest.orderedStepIds.length) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.STEP_ORDER_MISMATCH,
      'complete_scenario_missing_steps');
  }
  if (sessionEvidence.checkpointRecords.length !== bundle.actions.length ||
    sessionEvidence.reloadReceipts.length !== bundle.actions.length) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.RELOAD_COUNT_NON_MONOTONIC,
      'action_checkpoint_reload_cardinality');
  }

  let expectedPriorTraceId: string | null = null;
  bundle.actions.forEach((action, index) => {
    if (!nonEmptyString(action.stepId) ||
      !nonEmptyString(action.traceV2RootId) ||
      action.priorActionTraceId !== expectedPriorTraceId ||
      !isRecord(action.intendedActionReceipt) ||
      !nonEmptyString(action.intendedActionReceipt.actionKind) ||
      !nonEmptyString(action.intendedActionReceipt.productionSurface)) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.TRACE_PRIOR_LINKAGE_BROKEN,
        action.stepId);
    }
    assertPrivacySafeValue(action.intendedActionReceipt.semanticInput,
      ['actions', action.stepId, 'intendedActionReceipt', 'semanticInput']);
    const expectedIntendedHash = explorerIntendedActionSemanticHash(
      action.intendedActionReceipt,
    );
    if (action.intendedActionSemanticHash !== expectedIntendedHash) {
      fail(containsEnvironmentSpecificSemanticInput(action.intendedActionReceipt.semanticInput)
        ? EXPLORER_SCENARIO_ARTIFACT_FAILURE.ENVIRONMENT_SPECIFIC_SEMANTIC_HASH_INPUT
        : EXPLORER_SCENARIO_ARTIFACT_FAILURE.INTENDED_ACTION_SEMANTIC_HASH_MISMATCH,
      action.stepId);
    }
    assertArtifactReference(action.actualProductionReceiptReference,
      EXPLORER_SCENARIO_ARTIFACT_FAILURE.INVALID_BUNDLE,
      `${action.stepId}:production_receipt`);
    try {
      assertAthleteActionArtifactBundleV2(action.actionArtifactBundle);
    } catch {
      return fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.ACTION_BUNDLE_INVALID,
        action.stepId);
    }
    assertActionBundlePrivacy(action.actionArtifactBundle);
    const trace = parseTrace(action.actionArtifactBundle);
    const actionManifest = parsedActionBundleJson(action.actionArtifactBundle, 'manifest.json');
    assertActionBundleManifestIntegrity(action.actionArtifactBundle, actionManifest, action.stepId);
    const traceStepId = captured<string>(trace.root?.scenarioStepId);
    const traceScenarioId = captured<string>(trace.root?.scenarioRunId);
    const traceSeedId = captured<string>(trace.root?.seedId);
    const tracePriorId = captured<string | null>(trace.root?.priorActionTraceId);
    const traceActionKind = captured<string>(trace.root?.actionType);
    const traceSurface = captured<string>(trace.root?.sourceSurface);
    if (trace.traceId !== action.traceV2RootId ||
      actionManifest.traceId !== action.traceV2RootId) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.TRACE_ROOT_MISMATCH, action.stepId);
    }
    if (traceStepId !== action.stepId ||
      traceScenarioId !== identity.scenarioId ||
      traceSeedId !== identity.seedId) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.IDENTITY_MISMATCH,
        `${action.stepId}:trace_identity`);
    }
    if (tracePriorId !== expectedPriorTraceId ||
      action.priorActionTraceId !== expectedPriorTraceId) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.TRACE_PRIOR_LINKAGE_BROKEN,
        action.stepId);
    }
    if (traceActionKind !== action.intendedActionReceipt.actionKind ||
      traceSurface !== action.intendedActionReceipt.productionSurface) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.IDENTITY_MISMATCH,
        `${action.stepId}:action_receipt`);
    }
    assertActionFingerprints(action.fingerprints?.beforeAction,
      `${action.stepId}:before_action`);
    assertActionFingerprints(action.fingerprints?.afterAction,
      `${action.stepId}:after_action`);
    assertActionFingerprints(action.fingerprints?.afterReload,
      `${action.stepId}:after_reload`);
    if (!Array.isArray(action.selectorsUsed) || action.selectorsUsed.length === 0 ||
      action.selectorsUsed.some((selector) =>
        !isRecord(selector) || !nonEmptyString(selector.selectorId) ||
        (selector.strategy !== 'test_id' &&
          selector.strategy !== 'accessibility_id' &&
          selector.strategy !== 'semantic_control_id'))) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.INVALID_BUNDLE,
        `${action.stepId}:selectors_used`);
    }
    assertArtifactReference(action.screenshots?.afterAction,
      EXPLORER_SCENARIO_ARTIFACT_FAILURE.SCREENSHOT_MISSING,
      `${action.stepId}:after_action`);
    assertArtifactReference(action.screenshots?.afterReload,
      EXPLORER_SCENARIO_ARTIFACT_FAILURE.SCREENSHOT_MISSING,
      `${action.stepId}:after_reload`);
    assertArtifactReference(action.accessibilityHierarchies?.afterAction,
      EXPLORER_SCENARIO_ARTIFACT_FAILURE.HIERARCHY_MISSING,
      `${action.stepId}:after_action`);
    assertArtifactReference(action.accessibilityHierarchies?.afterReload,
      EXPLORER_SCENARIO_ARTIFACT_FAILURE.HIERARCHY_MISSING,
      `${action.stepId}:after_reload`);

    const checkpoint = sessionEvidence.checkpointRecords[index];
    const checkpointSession = assertScenarioSession(
      checkpoint?.scenarioSessionRecord,
      `${action.stepId}:checkpoint_session`,
    );
    if (!checkpoint || checkpoint.scenarioId !== identity.scenarioId ||
      checkpoint.stepId !== action.stepId ||
      checkpoint.reloadCount !== index ||
      checkpoint.checkpointRecord.scenarioId !== identity.scenarioId ||
      checkpoint.checkpointRecord.checkpointStepId !== action.stepId ||
      checkpoint.checkpointRecord.activeActionTraceId !== action.traceV2RootId ||
      checkpoint.checkpointRecord.priorActionTraceId !== expectedPriorTraceId ||
      checkpointSession.scenarioId !== identity.scenarioId ||
      checkpointSession.checkpointStepId !== action.stepId ||
      checkpointSession.activeActionTraceId !== action.traceV2RootId ||
      checkpointSession.priorActionTraceId !== expectedPriorTraceId ||
      checkpointSession.reloadCount !== index) {
      fail(checkpoint?.reloadCount !== index || checkpointSession.reloadCount !== index
        ? EXPLORER_SCENARIO_ARTIFACT_FAILURE.RELOAD_COUNT_NON_MONOTONIC
        : EXPLORER_SCENARIO_ARTIFACT_FAILURE.IDENTITY_MISMATCH,
      `${action.stepId}:checkpoint`);
    }
    const reload = sessionEvidence.reloadReceipts[index];
    const reloadSession = assertScenarioSession(
      reload?.scenarioSessionRecord,
      `${action.stepId}:reload_session`,
    );
    if (!reload ||
      reload.protocolVersion !== EXPLORER_SCENARIO_RELOAD_RECEIPT_VERSION ||
      !nonEmptyString(reload.receiptId) ||
      reload.scenarioId !== identity.scenarioId ||
      reload.stepId !== action.stepId ||
      reload.traceV2RootId !== action.traceV2RootId ||
      reload.reloadCount !== index + 1 ||
      reloadSession.reloadCount !== index + 1) {
      fail(reload?.reloadCount !== index + 1 || reloadSession.reloadCount !== index + 1
        ? EXPLORER_SCENARIO_ARTIFACT_FAILURE.RELOAD_COUNT_NON_MONOTONIC
        : EXPLORER_SCENARIO_ARTIFACT_FAILURE.IDENTITY_MISMATCH,
      `${action.stepId}:reload_receipt`);
    }
    if (reloadSession.scenarioId !== identity.scenarioId ||
      reloadSession.seedId !== identity.seedId ||
      reloadSession.checkpointStepId !== action.stepId ||
      reloadSession.activeActionTraceId !== null ||
      reloadSession.priorActionTraceId !== action.traceV2RootId ||
      reload.acceptedSemanticFingerprint !==
        action.fingerprints.afterReload.acceptedSemanticFingerprint ||
      reloadSession.currentAcceptedSemanticFingerprint !==
        action.fingerprints.afterReload.acceptedSemanticFingerprint ||
      !sameFingerprintMap(reload.persistedStoreFingerprints,
        action.fingerprints.afterReload.persistedStoreFingerprints) ||
      !sameFingerprintMap(reloadSession.persistedStoreFingerprints,
        action.fingerprints.afterReload.persistedStoreFingerprints) ||
      !nonEmptyString(reload.clockFingerprint)) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.IDENTITY_MISMATCH,
        `${action.stepId}:reload_evidence`);
    }
    expectedPriorTraceId = action.traceV2RootId;
  });

  const finalSession = assertScenarioSession(
    sessionEvidence.finalScenarioSessionRecord,
    'final_scenario_session',
  );
  const finalAction = bundle.actions[bundle.actions.length - 1];
  if (sessionEvidence.reloadCount !== bundle.actions.length ||
    finalSession.reloadCount !== sessionEvidence.reloadCount ||
    finalSession.scenarioId !== identity.scenarioId ||
    finalSession.seedId !== identity.seedId ||
    finalSession.checkpointStepId !== finalAction.stepId ||
    finalSession.priorActionTraceId !== finalAction.traceV2RootId ||
    finalSession.nextActionEligibility.status !== sessionEvidence.completionStatus.status ||
    finalSession.nextActionEligibility.reasonCode !==
      sessionEvidence.completionStatus.reasonCode) {
    fail(finalSession.reloadCount !== sessionEvidence.reloadCount
      ? EXPLORER_SCENARIO_ARTIFACT_FAILURE.RELOAD_COUNT_NON_MONOTONIC
      : EXPLORER_SCENARIO_ARTIFACT_FAILURE.IDENTITY_MISMATCH,
    'final_scenario_session');
  }

  if (!Array.isArray(bundle.oracles) || bundle.oracles.length === 0) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.ORACLE_UNEVALUATED, 'no_oracles');
  }
  const stepOrder = new Map(manifest.orderedStepIds.map((stepId, index) => [stepId, index]));
  let lastOracleStep = -1;
  const oracleIds = new Set<string>();
  for (const oracle of bundle.oracles) {
    const oracleStep = stepOrder.get(oracle?.stepId ?? '');
    if (!isRecord(oracle) || !nonEmptyString(oracle.oracleId) ||
      oracleIds.has(oracle.oracleId) || oracleStep === undefined ||
      oracleStep < lastOracleStep ||
      (oracle.evaluationPoint !== 'after_action' &&
        oracle.evaluationPoint !== 'after_reload' &&
        oracle.evaluationPoint !== 'scenario_end') ||
      (oracle.enforcement !== 'hard' && oracle.enforcement !== 'advisory') ||
      oracle.evaluationStatus !== 'evaluated' || typeof oracle.passed !== 'boolean') {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.ORACLE_UNEVALUATED,
        oracle?.oracleId);
    }
    assertOracleValue(oracle.expectedValue, `${oracle.oracleId}:expected`);
    assertOracleValue(oracle.actualValueOrFingerprint, `${oracle.oracleId}:actual`);
    if (oracle.passed) {
      if (oracle.failureCode !== null || oracle.firstDivergentProjection !== null) {
        fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.ORACLE_UNEVALUATED,
          `${oracle.oracleId}:passed_oracle_failure_fields`);
      }
    } else {
      if (!nonEmptyString(oracle.failureCode)) {
        fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.ORACLE_UNEVALUATED,
          `${oracle.oracleId}:failure_code`);
      }
      if (!nonEmptyString(oracle.firstDivergentProjection)) {
        fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.FIRST_DIVERGENT_PROJECTION_MISSING,
          oracle.oracleId);
      }
    }
    oracleIds.add(oracle.oracleId);
    lastOracleStep = oracleStep;
  }

  const result = bundle.result;
  if (!isRecord(result) ||
    !['passed', 'product_failure', 'oracle_failure', 'infrastructure_failure',
      'incomplete_artifact'].includes(result.disposition as string) ||
    !nonEmptyString(result.reproductionCommand)) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.INVALID_BUNDLE, 'result');
  }
  assertArtifactReference(result.runnerLogReference,
    EXPLORER_SCENARIO_ARTIFACT_FAILURE.INVALID_BUNDLE, 'runner_log');
  const failedHardOracle = bundle.oracles.find((oracle) =>
    oracle.enforcement === 'hard' && !oracle.passed);
  if (result.disposition === 'passed') {
    if (failedHardOracle) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.PASSED_WITH_FAILED_HARD_ORACLE,
        failedHardOracle.oracleId);
    }
    if (result.firstFailingStepId !== null ||
      result.firstFailingOracleId !== null ||
      result.firstDivergentProjection !== null ||
      result.failureClusterSignature !== null) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.INVALID_BUNDLE,
        'passed_result_failure_fields');
    }
  } else {
    if (!nonEmptyString(result.firstFailingStepId) ||
      !stepOrder.has(result.firstFailingStepId)) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.FIRST_FAILING_STEP_MISSING);
    }
    if (result.disposition === 'product_failure' || result.disposition === 'oracle_failure') {
      if (!failedHardOracle ||
        result.firstFailingOracleId !== failedHardOracle.oracleId ||
        result.firstFailingStepId !== failedHardOracle.stepId) {
        fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.FIRST_FAILING_ORACLE_MISMATCH);
      }
      if (!nonEmptyString(result.firstDivergentProjection) ||
        result.firstDivergentProjection !== failedHardOracle.firstDivergentProjection) {
        fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.FIRST_DIVERGENT_PROJECTION_MISSING);
      }
      const action = bundle.actions.find((entry) =>
        entry.stepId === result.firstFailingStepId)!;
      const expectedSignature = buildExplorerFailureClusterSignature({
        oracleId: failedHardOracle.oracleId,
        primaryFailureCode: failedHardOracle.failureCode!,
        actionKind: action.intendedActionReceipt.actionKind,
        productionSurface: action.intendedActionReceipt.productionSurface,
        firstDivergentProjection: result.firstDivergentProjection,
        firstFailingStepId: result.firstFailingStepId,
      });
      if (result.failureClusterSignature !== expectedSignature) {
        fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.FAILURE_CLUSTER_SIGNATURE_MISMATCH);
      }
    }
  }

  const generated = bundle.generatedCaseMetadata;
  if (generated !== undefined) {
    if (!isRecord(generated)) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.GENERATED_METADATA_INVALID);
    }
    const hasShrinkResult = generated.minimizedActionChain !== undefined ||
      generated.shrinkLineage !== undefined || generated.shrinkAttemptCount !== undefined;
    if (hasShrinkResult &&
      (!Array.isArray(generated.originalActionChain) ||
        generated.originalActionChain.length === 0)) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.SHRINK_ORIGINAL_CHAIN_MISSING);
    }
    const chains = [generated.originalActionChain, generated.minimizedActionChain]
      .filter((chain): chain is ExplorerGeneratedActionChainEntryV1[] => Array.isArray(chain));
    const shrinkAttemptCount = generated.shrinkAttemptCount;
    const shrinkLineageLength = Array.isArray(generated.shrinkLineage)
      ? generated.shrinkLineage.length
      : 0;
    if (chains.some((chain) => chain.some((entry) =>
      !isRecord(entry) || !stepOrder.has(entry.stepId) ||
      !nonEmptyString(entry.intendedActionSemanticHash))) ||
      (generated.coveredPairIds !== undefined &&
        (!Array.isArray(generated.coveredPairIds) ||
          generated.coveredPairIds.some((pairId) => !nonEmptyString(pairId)))) ||
      (generated.pairwiseDimensions !== undefined &&
        (!isRecord(generated.pairwiseDimensions) ||
          Object.entries(generated.pairwiseDimensions).some(([key, value]) =>
            !nonEmptyString(key) || !nonEmptyString(value)))) ||
      (generated.shrinkLineage !== undefined &&
        (!Array.isArray(generated.shrinkLineage) ||
          generated.shrinkLineage.some((entry, index) =>
            !isRecord(entry) || entry.attempt !== index + 1 ||
            !nonEmptyString(entry.parentChainSemanticHash) ||
            !nonEmptyString(entry.candidateChainSemanticHash) ||
            (entry.result !== 'retained' && entry.result !== 'rejected')))) ||
      (shrinkAttemptCount !== undefined &&
        (typeof shrinkAttemptCount !== 'number' ||
          !Number.isInteger(shrinkAttemptCount) ||
          shrinkAttemptCount < 0 ||
          shrinkAttemptCount !== shrinkLineageLength))) {
      fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.GENERATED_METADATA_INVALID);
    }
  }

  const expectedBundleHash = explorerScenarioSemanticHash(bundle);
  if (bundle.semanticHash !== expectedBundleHash) {
    fail(EXPLORER_SCENARIO_ARTIFACT_FAILURE.SEMANTIC_HASH_MISMATCH);
  }
}

/** Adds the self-verifying semantic receipt and immediately validates the bundle. */
export function collectExplorerScenarioArtifactBundleV1(
  input: ExplorerScenarioArtifactBundleWithoutHashV1,
): ExplorerScenarioArtifactBundleV1 {
  const draft = {
    schemaVersion: EXPLORER_SCENARIO_ARTIFACT_SCHEMA_VERSION,
    semanticHash: '' as SemanticFingerprintV2,
    ...input,
  };
  const bundle: ExplorerScenarioArtifactBundleV1 = {
    ...draft,
    semanticHash: explorerScenarioSemanticHash(draft),
  };
  assertExplorerScenarioArtifactBundleV1(bundle);
  return bundle;
}
