/**
 * Catalogue-order-independent diversity for candidates that are otherwise
 * equal under programming policy.
 *
 * This is rendezvous selection, not a global alphabetical/random carousel:
 * every candidate receives a stable value from the DECISION identity plus its
 * own identity. Adding, removing or reordering unrelated catalogue rows cannot
 * move the winner. The caller must apply legality, athlete preference, phase,
 * role and history first; this only resolves the remaining equal cohort.
 */
function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function stableDecisionOrder<T>(
  candidates: readonly T[],
  decisionIdentity: string,
  identityOf: (candidate: T) => string,
): T[] {
  return [...candidates].sort((left, right) => {
    const leftIdentity = identityOf(left);
    const rightIdentity = identityOf(right);
    const leftValue = stableHash(`${decisionIdentity}\u0000${leftIdentity}`);
    const rightValue = stableHash(`${decisionIdentity}\u0000${rightIdentity}`);
    return rightValue - leftValue || leftIdentity.localeCompare(rightIdentity);
  });
}

export function stableDecisionChoice<T>(
  candidates: readonly T[],
  decisionIdentity: string,
  identityOf: (candidate: T) => string,
): T | null {
  return stableDecisionOrder(candidates, decisionIdentity, identityOf)[0] ?? null;
}
