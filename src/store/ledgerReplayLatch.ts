/**
 * THE BOOT/REPLAY LATCH — R1.3 of the shell rebuild. No imports, so any
 * module (stores, the action log, the storage compat layer) can consult it
 * without a cycle.
 *
 * While held: the decision ledger refuses appends (replay READS the ledger),
 * durable writes are dropped at the storage boundary (THE BOOT DOES NOT
 * WRITE — disk is already the truth of inputs, and outputs are never
 * persisted), and the athlete-action ring stays quiet (a replayed
 * interpreter is not the athlete acting; the boot flood that evicted Sam's
 * taps — evening-1 — dies here).
 */

let depth = 0;

export function beginLedgerReplay(): void {
  depth += 1;
}

export function endLedgerReplay(): void {
  depth = Math.max(0, depth - 1);
}

export function ledgerReplayActive(): boolean {
  return depth > 0;
}
