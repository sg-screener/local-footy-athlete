/**
 * ══ A DROPPED DURABLE WRITE IS NEVER SILENT ══
 *
 * FOUNDING CASE, MEASURED 2026-08-10 on the rig's second working pass: a seeded
 * world ended with **four game days in memory and one on disk**. The other three
 * were dropped at the storage boundary while the ledger replay latch was held —
 * "THE BOOT DOES NOT WRITE", R1.3, deliberate — and **nothing anywhere recorded
 * that they had been dropped**. The divergence surfaced only because a
 * convergence check in the E2E harness happened to fingerprint that store, and
 * turning "calendar-storage did not converge" into the sentence above took a
 * hand-read of the simulator's AsyncStorage and a walk through three modules.
 *
 * THIS CELL DOES NOT CLAIM THE DROP IS CORRECT OR INCORRECT. Where the boundary
 * between "boot may not write" and "an install must" belongs is an ownership
 * question, priced separately and deliberately not answered here. **What it
 * holds is that the drop leaves a trace** — so the next person reading a
 * memory/disk divergence gets the fact in one line.
 */

import {
  beginLedgerReplay,
  endLedgerReplay,
  ledgerReplayActive,
  droppedDurableWrites,
  __resetDroppedDurableWritesForTest,
} from '../store/ledgerReplayLatch';
import { asyncStorageDurable } from '../store/asyncStorageCompat';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing, cleared only by the printed
// totals. This suite sits in test:bible; unarmed, it exits 0 on a drained loop
// and the chain calls that green.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

let passed = 0;
const failures: string[] = [];
function check(name: string, condition: boolean): void {
  if (condition) { passed += 1; console.log(`  ✓ ${name}`); return; }
  failures.push(name);
  console.log(`  ✗ ${name}`);
}

async function main(): Promise<void> {
  __resetDroppedDurableWritesForTest();

  // [1] THE LATCH STILL DROPS. Asserted first, so a future change that made the
  //     boot write again cannot pass this file by making the counter empty.
  beginLedgerReplay();
  check('the latch is held', ledgerReplayActive());
  await asyncStorageDurable.setItem('calendar-storage', '{"state":{"markedDays":{}}}');
  await asyncStorageDurable.setItem('calendar-storage', '{"state":{"markedDays":{}}}');
  await asyncStorageDurable.removeItem('program-store');
  endLedgerReplay();

  // [2] AND EVERY DROP IS ON THE RECORD, BY KEY AND BY COUNT. The founding case
  //     was three drops on ONE key, so a boolean "something was dropped" would
  //     not have carried the fact that mattered.
  const dropped = droppedDurableWrites();
  check('the dropped write names its store', dropped.has('calendar-storage'));
  check('repeat drops on one store are counted, not collapsed',
    dropped.get('calendar-storage') === 2);
  check('a dropped removal is recorded too', dropped.get('program-store') === 1);

  // [3] LIVENESS BOTH DIRECTIONS. A counter that only ever grows would pass [2]
  //     while recording writes that were never dropped — the cell would then be
  //     green over an app that had stopped dropping anything at all.
  __resetDroppedDurableWritesForTest();
  check('the record is empty with nothing dropped', droppedDurableWrites().size === 0);
  await asyncStorageDurable.setItem('coach-store', '{"state":{}}');
  check('a write made OUTSIDE the latch is not recorded as dropped',
    !droppedDurableWrites().has('coach-store'));

  console.log(`\nDurable-write silence: ${passed} passed, ${failures.length} failed`);
  totalsPrinted(failures.length);
  if (failures.length > 0) process.exit(1);
}

void main();
