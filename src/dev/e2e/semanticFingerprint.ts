function normalizeSemanticValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null) return null;
  // Match JSON persistence semantics: object properties disappear while
  // undefined array slots become null (handled in the array branch below).
  if (value === undefined) return undefined;
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (typeof value !== 'object') return value;
  if (seen.has(value as object)) {
    throw new Error('Semantic state contains a circular reference.');
  }
  seen.add(value as object);
  if (Array.isArray(value)) {
    const normalized = value.map((item) =>
      normalizeSemanticValue(item, seen) ?? null);
    seen.delete(value as object);
    return normalized;
  }
  if (value instanceof Map) {
    const normalized = Array.from(value.entries())
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
      .map(([key, item]) => [key, normalizeSemanticValue(item, seen)]);
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

export function stableSemanticJson(value: unknown): string {
  return JSON.stringify(normalizeSemanticValue(value, new WeakSet<object>()));
}

/** Two independent 32-bit streams plus length make accidental matches visible. */
export function semanticFingerprint(value: unknown): string {
  const input = stableSemanticJson(value);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 0x01000193) >>> 0;
    second ^= code + index;
    second = Math.imul(second, 0x85ebca6b) >>> 0;
  }
  return `${input.length}:${first.toString(16).padStart(8, '0')}:${second.toString(16).padStart(8, '0')}`;
}
