import {
  semanticFingerprintV2,
  stableSemanticJsonV2,
} from '../../utils/semanticFingerprintV2';

export function stableSemanticJson(value: unknown): string {
  return stableSemanticJsonV2(value);
}

/** Dev E2E and athlete traces share the one versioned SHA-256 contract. */
export function semanticFingerprint(value: unknown): string {
  return semanticFingerprintV2(value);
}
