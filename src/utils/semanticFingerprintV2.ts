export const SEMANTIC_FINGERPRINT_CONTRACT_V2 = 'athlete-semantic-sha256-v2' as const;

function normalizeSemanticValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null) return null;
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return value;
  if (seen.has(value as object)) throw new Error('Semantic state contains a circular reference.');
  seen.add(value as object);
  if (Array.isArray(value)) {
    const normalized = value.map((entry) =>
      normalizeSemanticValue(entry, seen) ?? null);
    seen.delete(value as object);
    return normalized;
  }
  if (value instanceof Date) {
    seen.delete(value as object);
    return value.toISOString();
  }
  if (value instanceof Map) {
    const normalized = Array.from(value.entries())
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
      .map(([key, entry]) => [key, normalizeSemanticValue(entry, seen)]);
    seen.delete(value as object);
    return normalized;
  }
  if (value instanceof Set) {
    const normalized = Array.from(value.values())
      .map((entry) => normalizeSemanticValue(entry, seen))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    seen.delete(value as object);
    return normalized;
  }
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const child = normalizeSemanticValue((value as Record<string, unknown>)[key], seen);
    if (child !== undefined) normalized[key] = child;
  }
  seen.delete(value as object);
  return normalized;
}

export function stableSemanticJsonV2(value: unknown): string {
  return JSON.stringify(normalizeSemanticValue(value, new WeakSet<object>()));
}

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const low = value.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        index += 1;
      }
    }
    if (code <= 0x7f) bytes.push(code);
    else if (code <= 0x7ff) {
      bytes.push(0xc0 | (code >>> 6), 0x80 | (code & 0x3f));
    } else if (code <= 0xffff) {
      bytes.push(0xe0 | (code >>> 12), 0x80 | ((code >>> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >>> 18),
        0x80 | ((code >>> 12) & 0x3f),
        0x80 | ((code >>> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

const SHA256_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

/** Pure synchronous SHA-256 so the same contract works in Expo and Node. */
export function sha256Hex(value: string): string {
  const message = utf8Bytes(value);
  const bitLengthHigh = Math.floor((message.length * 8) / 0x100000000);
  const bitLengthLow = (message.length * 8) >>> 0;
  message.push(0x80);
  while (message.length % 64 !== 56) message.push(0);
  for (let shift = 24; shift >= 0; shift -= 8) message.push((bitLengthHigh >>> shift) & 0xff);
  for (let shift = 24; shift >= 0; shift -= 8) message.push((bitLengthLow >>> shift) & 0xff);

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Array<number>(64).fill(0);
  for (let offset = 0; offset < message.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const cursor = offset + index * 4;
      words[index] = (
        (message[cursor] << 24) |
        (message[cursor + 1] << 16) |
        (message[cursor + 2] << 8) |
        message[cursor + 3]
      ) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15];
      const right = words[index - 2];
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map((word) => word.toString(16).padStart(8, '0')).join('');
}

export type SemanticFingerprintV2 = `${typeof SEMANTIC_FINGERPRINT_CONTRACT_V2}:${string}`;

export function semanticFingerprintV2(value: unknown): SemanticFingerprintV2 {
  const canonical = stableSemanticJsonV2({
    contract: SEMANTIC_FINGERPRINT_CONTRACT_V2,
    value,
  });
  return `${SEMANTIC_FINGERPRINT_CONTRACT_V2}:${sha256Hex(canonical)}`;
}
