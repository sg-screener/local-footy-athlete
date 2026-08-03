/**
 * A REFUSAL MUST NEVER PERSIST THE STATE IT REFUSED INTO.
 *
 * Sam's law for this unit, and the second occurrence of the profile-mirror wipe
 * class — this time at the program store. His 2026-07-29 tape
 * (`device-export-2026-07-29-hydration-failure.json`): hydration read v43
 * intact, the acceptance transaction threw `accepted_state_ledger_mismatch` and
 * rolled back cleanly, and then — 13.4 seconds later, after the boot gate's
 * 10s timeout and the error screen's Try Again — a second cycle started from an
 * EMPTY baseline and persisted it over the refused data. Profile and calendar
 * marks survived; the program did not.
 *
 * THE REFUSAL IS INJECTED, AND THAT IS THE RIGHT STRENGTH FOR THIS LAW.
 * Reproducing his exact CAUSE would mean acting a pre-release build's edits into
 * a week today's evaluator scores differently — archaeology Sam has ruled out,
 * because the whole population of pre-release stores is his own test device and
 * it is being deleted. This is not an authored seed: the tape documents the
 * refusal happening in reality, at this exact boundary, and a law about what
 * must happen AFTER **any** refusal is rightly proven cause-independently. An
 * injected throw covers every future cause, including ones nobody has thought of
 * — which a single reproduced week never could.
 *
 * The payload underneath is real: `previousBuildStore-1e9c822.json`, acted
 * through a genuine pre-canonical build's own doors in a worktree.
 *
 * Run: npm run test:hydration-refusal-quarantine
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

/** The durable store, and the only one — "what is on disk" must be answerable. */
const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => durable.clear(),
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — the quarantine law is an on-device law');
};


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import * as fs from 'fs';
import * as path from 'path';
import { useProgramStore } from '../store/programStore';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

const FIXTURE = path.join(__dirname, 'fixtures', 'previousBuildStore-1e9c822.json');

function seedFromPreviousBuild(): void {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as {
    envelopes: Record<string, string | null>;
  };
  durable.clear();
  for (const [key, value] of Object.entries(fixture.envelopes)) {
    if (typeof value === 'string') durable.set(key, value);
  }
}

function persistedProgramMicrocycleCount(): number {
  const raw = durable.get('program-store');
  if (!raw) return 0;
  const state = (JSON.parse(raw) as { state?: Record<string, unknown> }).state ?? {};
  const program = state.currentProgram as { microcycles?: unknown[] } | null | undefined;
  return program ? (program.microcycles ?? []).length : 0;
}

/**
 * Inject the recorded failure at the recorded boundary.
 *
 * `programStore` reaches the transaction through a dynamic `require`, so
 * replacing the module's export is the same seam the real call travels. Returns
 * a restore function; every cell restores in `finally` so one cell's injection
 * can never leak into the next.
 */
function injectAcceptanceRefusal(): () => void {
  const module = require('../store/acceptedStateTransaction') as
    Record<string, unknown> & { commitAcceptedStateTransaction: unknown };
  const real = module.commitAcceptedStateTransaction;
  module.commitAcceptedStateTransaction = (proposal: { reason?: string }) => {
    if (proposal?.reason === 'program:hydration_acceptance') {
      const error = new Error(
        're-evaluation produced blockers maximum_breach:conditioning',
      );
      error.name = 'AcceptedStateLedgerMismatchError';
      (error as { code?: string }).code = 'accepted_state_ledger_mismatch';
      throw error;
    }
    return (real as (value: unknown) => unknown)(proposal);
  };
  return () => { module.commitAcceptedStateTransaction = real; };
}

async function hydrate(): Promise<{ threw: Error | null }> {
  try {
    await useProgramStore.persist.rehydrate();
    return { threw: null };
  } catch (error) {
    return { threw: error instanceof Error ? error : new Error(String(error)) };
  }
}

async function main(): Promise<void> {
  console.log('\n-- Hydration refusal quarantine --');

  await run('the injected refusal actually refuses', async () => {
    // NON-VACUITY. Every law below is about the aftermath of a refusal; if the
    // injection stopped firing — a renamed reason, a changed call path — the
    // cells would pass by never refusing at all. That is precisely how the
    // upgrade-path suite next door is a guard rather than a proof, and it must
    // not happen silently twice.
    seedFromPreviousBuild();
    const restore = injectAcceptanceRefusal();
    try {
      const { threw } = await hydrate();
      assert(threw, 'the injected refusal did not reach the hydration acceptance — '
        + 'the seam has moved and every cell below is vacuous');
      assert(/ledger|mismatch|blocker/i.test(`${threw.name} ${threw.message}`),
        `something other than the injected refusal threw: ${threw.name} — ${threw.message}`);
    } finally { restore(); }
  });

  await run('a refused hydration leaves the refused payload untouched on disk', async () => {
    // QUARANTINE, half one. The refused payload is held, not consumed and not
    // destroyed — it is the athlete's program, and the only copy.
    seedFromPreviousBuild();
    const before = persistedProgramMicrocycleCount();
    assert(before > 0, 'seeding put no program on disk');
    const restore = injectAcceptanceRefusal();
    try {
      await hydrate();
    } finally { restore(); }
    assert(persistedProgramMicrocycleCount() === before,
      `the refusal changed the persisted payload it refused — ${before} microcycles `
      + `before, ${persistedProgramMicrocycleCount()} after. A refusal must never `
      + 'persist the state it refused into.');
  });

  await run('the bare fallback cannot overwrite a quarantined payload', async () => {
    // QUARANTINE, half two — THE WIPE ITSELF.
    //
    // His second cycle hydrated an EMPTY baseline (v1, 0 weeks) and published it,
    // and `persistence_result` recorded the write at 18:32:21.258. The refused
    // payload was still the only copy of his program. So: while a refused payload
    // is held, a publication that carries no program must not reach the disk.
    //
    // Modelled exactly as his second cycle was reached — the boot error screen's
    // Try Again, which is `persist.rehydrate()` — with the store emptied first,
    // because that is the state his second cycle started from.
    seedFromPreviousBuild();
    const before = persistedProgramMicrocycleCount();
    const restore = injectAcceptanceRefusal();
    try {
      await hydrate();
    } finally { restore(); }

    // The bare fallback: nothing in memory, and a hydration that now succeeds.
    useProgramStore.setState({ currentProgram: null, currentMicrocycle: null } as never);
    await hydrate();

    assert(persistedProgramMicrocycleCount() === before,
      'THE WIPE: a bare fallback published over the refused payload. The '
      + `persisted program went from ${before} microcycles to `
      + `${persistedProgramMicrocycleCount()}. While a refused payload is `
      + 'quarantined, a publication carrying no program must be unpersistable.');
  });

  console.log(`\nHydration refusal quarantine totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

void main();
