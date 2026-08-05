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
import {
  quarantineRefusedPayload,
  decideQuarantinedWrite,
  clearAllQuarantines,
} from '../store/refusedPayloadQuarantine';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';

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
    // NON-VACUITY, re-seated by the shell rebuild
    // (docs/SHELL_REBUILD_RULING_2026-08-05.md): the hydration-acceptance
    // transaction no longer runs at boot, so a refusal can no longer arise
    // THERE — hydration restores no outputs and cannot refuse them. The
    // surviving (and always-final) refusal seam is the WRITER BOUNDARY,
    // which is where the 2026-07-29 wipe actually landed: the wipe was a
    // persistence event. The cells below hold the same two laws at that
    // boundary; this cell proves the boundary refuses at all.
    seedFromPreviousBuild();
    const { threw } = await hydrate();
    assert(!threw,
      `hydration itself threw under the new boot: ${threw?.name} — ${threw?.message}`);
    const material = durable.get('program-store');
    assert(material, 'seeding put nothing on disk');
    quarantineRefusedPayload('program-store', material);
    try {
      const bare = JSON.stringify({ state: { inputs: {} }, version: 0 });
      const decision = decideQuarantinedWrite('program-store', bare);
      assert(!decision.allowed,
        'the writer boundary allowed a bare payload over a quarantined one — '
        + 'the seam has moved and every cell below is vacuous');
    } finally {
      clearAllQuarantines();
    }
  });

  await run('a refused hydration leaves the refused payload untouched on disk', async () => {
    // QUARANTINE, half one, re-seated by the shell-rebuild ruling. The
    // OLD fat envelope's protection is the PARK: hydrating a previous-build
    // store writes back the reduced inputs shape, and the boundary parks the
    // fat copy byte-identical BEFORE that overwrite can land — nothing the
    // athlete had is destroyed, and R2 migrates from the parked copy.
    seedFromPreviousBuild();
    const fatEnvelope = durable.get('program-store');
    assert(fatEnvelope && persistedProgramMicrocycleCount() > 0,
      'seeding put no program on disk');
    durable.delete('program-store.pre-rebuild-envelope');
    await hydrate();
    // Force a write-back through the real writer so the park is exercised
    // deterministically rather than raced.
    useProgramStore.setState({ isLoading: false } as never);
    await flushPendingStorageWrites().catch(() => undefined);
    assert(durable.get('program-store.pre-rebuild-envelope') === fatEnvelope,
      'the fat envelope was overwritten WITHOUT being parked — R2 has nothing '
      + 'to migrate; a refusal (or reduction) must never destroy the state it '
      + 'refused.');
  });

  await run('the bare fallback cannot overwrite a quarantined payload', async () => {
    // QUARANTINE, half two — THE WIPE ITSELF, at the surviving seam. The
    // new shape's material is INPUTS (a result, a fact, an anchor). While a
    // refused material payload is held, the bare fallback is unpersistable;
    // the next MATERIAL write releases the hold. Same two laws as the wipe
    // diagnosis, applied to what the store now persists.
    seedFromPreviousBuild();
    await hydrate();
    // Build a MATERIAL new-shape disk state through the real writer.
    useProgramStore.setState({
      sessionFeedback: {
        'quarantine-probe-before': { completion: 'done' },
      },
    } as never);
    await flushPendingStorageWrites().catch(() => undefined);
    const material = durable.get('program-store');
    const materialParsed = (JSON.parse(material ?? '{}') as {
      state?: { inputs?: { sessionFeedback?: Record<string, unknown> } };
    }).state?.inputs;
    assert(materialParsed?.sessionFeedback?.['quarantine-probe-before'],
      'the material fixture write did not land — the cell would be vacuous');
    quarantineRefusedPayload('program-store', material);

    // The bare fallback, through the real writer.
    useProgramStore.setState({ sessionFeedback: {} } as never);
    await flushPendingStorageWrites().catch(() => undefined);
    assert(durable.get('program-store') === material,
      'THE WIPE: a bare fallback published over the refused payload. While a '
      + 'refused payload is quarantined, a publication carrying no inputs '
      + 'must be unpersistable.');

    // The release: a material write passes and lifts the hold.
    useProgramStore.setState({
      sessionFeedback: {
        'quarantine-probe-after': { completion: 'done' },
      },
    } as never);
    await flushPendingStorageWrites().catch(() => undefined);
    const released = durable.get('program-store');
    assert(released && released !== material,
      'a material input write was refused while quarantined — that strands the athlete');
    const releasedInputs = (JSON.parse(released) as {
      state?: { inputs?: { sessionFeedback?: Record<string, unknown> } };
    }).state?.inputs;
    assert(releasedInputs?.sessionFeedback?.['quarantine-probe-after'],
      'the releasing write did not carry the material that released it');
    clearAllQuarantines();
  });

  console.log(`\nHydration refusal quarantine totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

void main();
