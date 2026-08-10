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

/**
 * ══ A DROPPED DURABLE WRITE IS NEVER SILENT (2026-08-10) ══
 *
 * The drop above is deliberate and stays. What was NOT deliberate is that it
 * left no trace: the dev-E2E seed installs a world THROUGH this window, and a
 * measured seeded world ended with **four game days in memory and one on disk**
 * — three of the athlete's fixtures never reached storage and nothing anywhere
 * said so. It took a convergence check, a hand-read of the simulator's
 * AsyncStorage and a walk through three modules to learn that much.
 *
 * **THIS IS THE REPORT, NOT THE FIX.** What the boundary between "boot may not
 * write" and "an install must" should be is an ownership question, priced
 * separately. Until it is answered, the drops are COUNTED BY KEY so the next
 * reader gets the fact in one line instead of an afternoon — and so a cell can
 * assert the silence is gone.
 */
const droppedWritesByKey = new Map<string, number>();

/** Record a durable write the latch dropped. Called at the storage boundary. */
export function recordDroppedDurableWrite(storeKey: string): void {
  droppedWritesByKey.set(storeKey, (droppedWritesByKey.get(storeKey) ?? 0) + 1);
}

/** Every store whose durable writes the latch has swallowed, and how many. */
export function droppedDurableWrites(): ReadonlyMap<string, number> {
  return new Map(droppedWritesByKey);
}

/** Test-only reset; the counter is process-lifetime otherwise. */
export function __resetDroppedDurableWritesForTest(): void {
  droppedWritesByKey.clear();
}

export function beginLedgerReplay(): void {
  depth += 1;
}

export function endLedgerReplay(): void {
  depth = Math.max(0, depth - 1);
}

export function ledgerReplayActive(): boolean {
  return depth > 0;
}
