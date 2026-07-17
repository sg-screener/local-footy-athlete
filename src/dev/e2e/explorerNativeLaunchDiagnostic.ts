import type { DevE2EKeyValueStorage } from './devE2ECheckpoint';
import {
  assertExplorerLocalMetroUrl,
  isExplorerAppLaunchPurpose,
  type ExplorerAppLaunchPurpose,
} from './explorerAppLaunchContract';

declare const __DEV__: boolean | undefined;

export const EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_SCHEMA_VERSION = 1 as const;
export const EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_BRIDGE_VERSION = '1' as const;
export const EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_STORAGE_KEY =
  'dev-e2e-explorer-native-launch-diagnostic-v1';
export const EXPLORER_NATIVE_BUILD_IDENTITY_RESOURCE =
  'DevE2EBuildIdentity.plist';
export const EXPLORER_APP_BUNDLE_IDENTIFIER = 'com.localfootyathlete.app';

export const EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON = {
  RELEASE_BUILD: 'release-build',
  NATIVE_RECEIPT_MISSING: 'native-receipt-missing',
  RECEIPT_CORRUPT: 'native-receipt-corrupt',
  SCHEMA_VERSION_UNSUPPORTED: 'schema-version-unsupported',
  BRIDGE_VERSION_UNSUPPORTED: 'native-bridge-version-unsupported',
  LAUNCH_PURPOSE_MISMATCH: 'launch-purpose-mismatch',
  REQUESTED_METRO_URL_MISMATCH: 'requested-metro-url-mismatch',
  RESOLVED_METRO_URL_MISMATCH: 'resolved-metro-url-mismatch',
  APP_BUNDLE_IDENTIFIER_MISMATCH: 'app-bundle-identifier-mismatch',
  BUILD_SHA_MISMATCH: 'build-sha-mismatch',
  RECEIPT_FINGERPRINT_MISMATCH: 'receipt-fingerprint-mismatch',
  PERSISTENCE_READBACK_MISMATCH: 'persistence-readback-mismatch',
  RECEIPT_CONFLICT: 'native-receipt-conflict',
} as const;

export type ExplorerNativeLaunchDiagnosticReasonCode =
  typeof EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON[keyof
    typeof EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON];

export interface ExplorerNativeLaunchDiagnosticReceiptV1 {
  readonly schemaVersion: 1;
  readonly nativeBridgeVersion: '1';
  readonly launchPurpose: ExplorerAppLaunchPurpose;
  readonly requestedMetroUrl: string;
  readonly resolvedMetroUrl: string;
  readonly resolvedBundleFingerprint: string;
  readonly appBundleIdentifier: string;
  readonly integratedRepositorySha: string;
  readonly receiptFingerprint: string;
}

const ACKNOWLEDGED_NATIVE_RECEIPT: unique symbol =
  Symbol('acknowledged-native-launch-receipt');

/** Only the exact persistence-readback transaction can construct this type. */
export type AcknowledgedExplorerNativeLaunchDiagnosticReceiptV1 =
  ExplorerNativeLaunchDiagnosticReceiptV1 & {
    readonly [ACKNOWLEDGED_NATIVE_RECEIPT]: true;
  };

export interface ExplorerNativeLaunchDiagnosticExpectation {
  readonly launchPurpose?: ExplorerAppLaunchPurpose;
  readonly selectedMetroUrl?: string;
  readonly integratedRepositorySha?: string;
  readonly appBundleIdentifier?: string;
}

export class ExplorerNativeLaunchDiagnosticError extends Error {
  constructor(
    readonly reasonCode: ExplorerNativeLaunchDiagnosticReasonCode,
    detail?: string,
  ) {
    super(detail ? `${reasonCode}:${detail}` : reasonCode);
    this.name = 'ExplorerNativeLaunchDiagnosticError';
  }
}

const RECEIPT_KEYS = [
  'appBundleIdentifier',
  'integratedRepositorySha',
  'launchPurpose',
  'nativeBridgeVersion',
  'receiptFingerprint',
  'requestedMetroUrl',
  'resolvedBundleFingerprint',
  'resolvedMetroUrl',
  'schemaVersion',
] as const;

function fail(
  reasonCode: ExplorerNativeLaunchDiagnosticReasonCode,
  detail?: string,
): never {
  throw new ExplorerNativeLaunchDiagnosticError(reasonCode, detail);
}

function available(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  if (typeof __DEV__ !== 'undefined') return __DEV__;
  return (globalThis as { __DEV__?: boolean }).__DEV__ === true;
}

function defaultStorage(): DevE2EKeyValueStorage {
  // Loaded only by the guarded development entry.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const module = require('@react-native-async-storage/async-storage');
  return module.default ?? module;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertExactKeys(record: Record<string, unknown>): void {
  const keys = Object.keys(record).sort();
  if (keys.length !== RECEIPT_KEYS.length ||
    keys.some((key, index) => key !== RECEIPT_KEYS[index])) {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_CORRUPT);
  }
}

function assertRepositorySha(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)) {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_CORRUPT);
  }
}

function assertBundleIdentifier(value: unknown): asserts value is string {
  if (typeof value !== 'string' ||
    !/^[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)+$/.test(value)) {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_CORRUPT);
  }
}

function assertFingerprint(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^fnv1a32:[a-f0-9]{8}$/.test(value)) {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_CORRUPT);
  }
}

function canonicalReceiptPayload(args: Omit<
ExplorerNativeLaunchDiagnosticReceiptV1,
'receiptFingerprint'
>): string {
  return [
    `schemaVersion=${args.schemaVersion}`,
    `nativeBridgeVersion=${args.nativeBridgeVersion}`,
    `launchPurpose=${args.launchPurpose}`,
    `requestedMetroUrl=${args.requestedMetroUrl}`,
    `resolvedMetroUrl=${args.resolvedMetroUrl}`,
    `resolvedBundleFingerprint=${args.resolvedBundleFingerprint}`,
    `appBundleIdentifier=${args.appBundleIdentifier}`,
    `integratedRepositorySha=${args.integratedRepositorySha}`,
  ].join('\n');
}

/** Deterministic non-security fingerprint shared exactly with the native owner. */
export function explorerDiagnosticFNV1A32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code > 0x7f) {
      fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_CORRUPT);
    }
    hash = Math.imul(hash ^ code, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
}

export function explorerNativeLaunchReceiptFingerprint(args: Omit<
ExplorerNativeLaunchDiagnosticReceiptV1,
'receiptFingerprint'
>): string {
  return explorerDiagnosticFNV1A32(canonicalReceiptPayload(args));
}

export function createExplorerNativeLaunchDiagnosticReceipt(args: Omit<
ExplorerNativeLaunchDiagnosticReceiptV1,
'schemaVersion' | 'nativeBridgeVersion' | 'receiptFingerprint'
>): ExplorerNativeLaunchDiagnosticReceiptV1 {
  const unsigned = {
    schemaVersion: EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_SCHEMA_VERSION,
    nativeBridgeVersion: EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_BRIDGE_VERSION,
    launchPurpose: args.launchPurpose,
    requestedMetroUrl: args.requestedMetroUrl,
    resolvedMetroUrl: args.resolvedMetroUrl,
    resolvedBundleFingerprint: args.resolvedBundleFingerprint,
    appBundleIdentifier: args.appBundleIdentifier,
    integratedRepositorySha: args.integratedRepositorySha,
  } as const;
  return {
    ...unsigned,
    receiptFingerprint: explorerNativeLaunchReceiptFingerprint(unsigned),
  };
}

/** Matches JSONSerialization.sortedKeys in the native bridge. */
export function serializeExplorerNativeLaunchDiagnosticReceipt(
  receipt: ExplorerNativeLaunchDiagnosticReceiptV1,
): string {
  return JSON.stringify({
    appBundleIdentifier: receipt.appBundleIdentifier,
    integratedRepositorySha: receipt.integratedRepositorySha,
    launchPurpose: receipt.launchPurpose,
    nativeBridgeVersion: receipt.nativeBridgeVersion,
    receiptFingerprint: receipt.receiptFingerprint,
    requestedMetroUrl: receipt.requestedMetroUrl,
    resolvedBundleFingerprint: receipt.resolvedBundleFingerprint,
    resolvedMetroUrl: receipt.resolvedMetroUrl,
    schemaVersion: receipt.schemaVersion,
  });
}

export function parseExplorerNativeLaunchDiagnosticReceipt(
  rawValue: unknown,
): ExplorerNativeLaunchDiagnosticReceiptV1 {
  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.NATIVE_RECEIPT_MISSING);
  }
  let value: unknown;
  try {
    value = JSON.parse(rawValue);
  } catch {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_CORRUPT);
  }
  if (!isRecord(value)) {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_CORRUPT);
  }
  assertExactKeys(value);
  if (value.schemaVersion !==
    EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_SCHEMA_VERSION) {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.SCHEMA_VERSION_UNSUPPORTED);
  }
  if (value.nativeBridgeVersion !==
    EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_BRIDGE_VERSION) {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.BRIDGE_VERSION_UNSUPPORTED);
  }
  if (typeof value.launchPurpose !== 'string' ||
    !isExplorerAppLaunchPurpose(value.launchPurpose)) {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_CORRUPT);
  }
  if (typeof value.requestedMetroUrl !== 'string' ||
    typeof value.resolvedMetroUrl !== 'string') {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_CORRUPT);
  }
  assertExplorerLocalMetroUrl(value.requestedMetroUrl);
  assertExplorerLocalMetroUrl(value.resolvedMetroUrl);
  assertFingerprint(value.resolvedBundleFingerprint);
  assertBundleIdentifier(value.appBundleIdentifier);
  assertRepositorySha(value.integratedRepositorySha);
  assertFingerprint(value.receiptFingerprint);
  const receipt: ExplorerNativeLaunchDiagnosticReceiptV1 = {
    schemaVersion: value.schemaVersion,
    nativeBridgeVersion: value.nativeBridgeVersion,
    launchPurpose: value.launchPurpose,
    requestedMetroUrl: value.requestedMetroUrl,
    resolvedMetroUrl: value.resolvedMetroUrl,
    resolvedBundleFingerprint: value.resolvedBundleFingerprint,
    appBundleIdentifier: value.appBundleIdentifier,
    integratedRepositorySha: value.integratedRepositorySha,
    receiptFingerprint: value.receiptFingerprint,
  };
  const expectedFingerprint = explorerNativeLaunchReceiptFingerprint({
    schemaVersion: receipt.schemaVersion,
    nativeBridgeVersion: receipt.nativeBridgeVersion,
    launchPurpose: receipt.launchPurpose,
    requestedMetroUrl: receipt.requestedMetroUrl,
    resolvedMetroUrl: receipt.resolvedMetroUrl,
    resolvedBundleFingerprint: receipt.resolvedBundleFingerprint,
    appBundleIdentifier: receipt.appBundleIdentifier,
    integratedRepositorySha: receipt.integratedRepositorySha,
  });
  if (receipt.receiptFingerprint !== expectedFingerprint) {
    fail(
      EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_FINGERPRINT_MISMATCH,
    );
  }
  return receipt;
}

export function verifyExplorerNativeLaunchDiagnosticReceipt<
  Receipt extends ExplorerNativeLaunchDiagnosticReceiptV1,
>(
  receipt: Receipt | null,
  expectation: ExplorerNativeLaunchDiagnosticExpectation = {},
): Receipt {
  if (!receipt) {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.NATIVE_RECEIPT_MISSING);
  }
  if (expectation.launchPurpose &&
    receipt.launchPurpose !== expectation.launchPurpose) {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.LAUNCH_PURPOSE_MISMATCH);
  }
  if (expectation.selectedMetroUrl) {
    assertExplorerLocalMetroUrl(expectation.selectedMetroUrl);
    if (receipt.requestedMetroUrl !== expectation.selectedMetroUrl) {
      fail(
        EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.REQUESTED_METRO_URL_MISMATCH,
      );
    }
    if (receipt.resolvedMetroUrl !== expectation.selectedMetroUrl) {
      fail(
        EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RESOLVED_METRO_URL_MISMATCH,
      );
    }
  }
  if (expectation.integratedRepositorySha &&
    receipt.integratedRepositorySha !== expectation.integratedRepositorySha) {
    fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.BUILD_SHA_MISMATCH);
  }
  const expectedBundleIdentifier = expectation.appBundleIdentifier ??
    EXPLORER_APP_BUNDLE_IDENTIFIER;
  if (receipt.appBundleIdentifier !== expectedBundleIdentifier) {
    fail(
      EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.APP_BUNDLE_IDENTIFIER_MISMATCH,
    );
  }
  return receipt;
}

export class ExplorerNativeLaunchDiagnosticTransaction {
  private active: {
    raw: string;
    receipt: AcknowledgedExplorerNativeLaunchDiagnosticReceiptV1;
  } |
    null = null;
  private operation: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: DevE2EKeyValueStorage,
    private readonly isDev: boolean,
  ) {}

  hydrate(
    nativeReceiptJson: unknown,
  ): Promise<AcknowledgedExplorerNativeLaunchDiagnosticReceiptV1> {
    return this.serialize(async () => {
      if (!this.isDev) {
        fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RELEASE_BUILD);
      }
      const receipt = parseExplorerNativeLaunchDiagnosticReceipt(
        nativeReceiptJson,
      );
      // A receipt is not acknowledgeable unless native requested and resolved
      // the same canonical Metro and the app identity is current-format valid.
      verifyExplorerNativeLaunchDiagnosticReceipt(receipt, {
        selectedMetroUrl: receipt.requestedMetroUrl,
      });
      const raw = nativeReceiptJson as string;
      if (this.active) {
        if (this.active.raw === raw) return this.active.receipt;
        fail(EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON.RECEIPT_CONFLICT);
      }

      const durable = await this.storage.getItem(
        EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_STORAGE_KEY,
      );
      if (durable !== raw) {
        await this.storage.setItem(
          EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_STORAGE_KEY,
          raw,
        );
      }
      const readback = await this.storage.getItem(
        EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_STORAGE_KEY,
      );
      if (readback !== raw) {
        fail(
          EXPLORER_NATIVE_LAUNCH_DIAGNOSTIC_REASON
            .PERSISTENCE_READBACK_MISMATCH,
        );
      }
      const readbackReceipt = {
        ...parseExplorerNativeLaunchDiagnosticReceipt(readback),
        [ACKNOWLEDGED_NATIVE_RECEIPT]: true as const,
      };
      Object.freeze(readbackReceipt);
      this.active = { raw, receipt: readbackReceipt };
      return readbackReceipt;
    });
  }

  readActive(): AcknowledgedExplorerNativeLaunchDiagnosticReceiptV1 | null {
    return this.active?.receipt ?? null;
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operation.then(operation, operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }
}

let defaultTransaction: ExplorerNativeLaunchDiagnosticTransaction | null = null;

function sharedTransaction(args: {
  storage?: DevE2EKeyValueStorage;
  isDev?: boolean;
} = {}): ExplorerNativeLaunchDiagnosticTransaction {
  if (!defaultTransaction || args.storage || args.isDev !== undefined) {
    defaultTransaction = new ExplorerNativeLaunchDiagnosticTransaction(
      args.storage ?? defaultStorage(),
      available(args.isDev),
    );
  }
  return defaultTransaction;
}

export function hydrateExplorerNativeLaunchDiagnostic(args: {
  nativeReceiptJson: unknown;
  storage?: DevE2EKeyValueStorage;
  isDev?: boolean;
}): Promise<AcknowledgedExplorerNativeLaunchDiagnosticReceiptV1> {
  return sharedTransaction(args).hydrate(args.nativeReceiptJson);
}

export function readActiveExplorerNativeLaunchDiagnostic():
AcknowledgedExplorerNativeLaunchDiagnosticReceiptV1 | null {
  return defaultTransaction?.readActive() ?? null;
}

export function requireActiveExplorerNativeLaunchDiagnostic(
  expectation: ExplorerNativeLaunchDiagnosticExpectation,
): AcknowledgedExplorerNativeLaunchDiagnosticReceiptV1 {
  return verifyExplorerNativeLaunchDiagnosticReceipt(
    readActiveExplorerNativeLaunchDiagnostic(),
    expectation,
  );
}

export function __resetExplorerNativeLaunchDiagnosticForTest(): void {
  defaultTransaction = null;
}
