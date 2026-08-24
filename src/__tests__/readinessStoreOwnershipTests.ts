/**
 * READINESS STORE OWNERSHIP — the store-armour recipe, application 3.
 *
 * `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`. A readiness signal is a FACT the
 * athlete stated about their body on a date. This store is the downstream
 * compatibility mirror of the accepted canonical context — every legitimate
 * writer PROJECTS canonical state (the accepted transaction's publish, the
 * rollback restore, the store's own canonical projections) — which is exactly
 * why an unowned `signalsByDate` was dangerous: any file could assign it a
 * bare `{}` that no canonical decision produced. This suite holds the four
 * protections: one door (`applyReadinessSignalsWrite`) with typed refusals,
 * every write on the tape, a quarantine boundary at the persistence writer,
 * and a build failure on any product writer around the owner.
 *
 * Because every product writer projects canonical truth — and an EMPTY signal
 * map is the most common real state (no check-in today) — each of them runs
 * under a named reset act. The refusal therefore guards the bare-wipe class:
 * a `{}` written by anything that is not projecting an accepted decision.
 *
 * Run: npm run test:readiness-store-ownership
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

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
  throw new Error('NETWORK DISABLED');
};


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';
import {
  useReadinessStore,
  applyReadinessSignalsWrite,
  beginReadinessResetAction,
  endReadinessResetAction,
  readinessGuardedStorage,
  READINESS_PERSISTENCE_KEY,
} from '../store/readinessStore';
import {
  clearAllQuarantines,
  quarantineBoundaryKeys,
  quarantineRefusedPayload,
} from '../store/refusedPayloadQuarantine';
import { athleteActionLogEntries } from '../utils/athleteActionLog';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';
import type { ReadinessSignal } from '../utils/readiness';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

const pendingAsync: Promise<void>[] = [];
function run(name: string, body: () => void | Promise<void>): void {
  const settle = (error?: unknown) => {
    if (error === undefined) {
      passed += 1;
      console.log(`  PASS ${name}`);
    } else {
      failed += 1;
      failures.push(name);
      console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
    }
  };
  try {
    const result = body();
    if (result instanceof Promise) {
      pendingAsync.push(result.then(() => settle(), (error) => settle(error)));
      return;
    }
    settle();
  } catch (error) {
    settle(error);
  }
}

function signal(date: string, energy: 'low' | 'okay' | 'good'): ReadinessSignal {
  return { date, energy, source: 'quick_check', updatedAt: new Date().toISOString() };
}

/** Empty the signals through the door with a reset act — the legitimate erasure. */
function resetSignals(): void {
  const id = beginReadinessResetAction('test_reset');
  try {
    applyReadinessSignalsWrite({ next: {}, writer: 'reset', resetActionId: id });
  } finally {
    endReadinessResetAction(id);
  }
}

console.log('\n-- Readiness store ownership (store-armour recipe) --');

run('a fresh unhydrated readiness slice is the canonical empty map', () => {
  useReadinessStore.setState({ signalsByDate: undefined as never });
  const outcome = applyReadinessSignalsWrite({
    next: {},
    writer: 'accepted_transaction',
  });
  assert(outcome.ok, `cold-start empty write failed: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useReadinessStore.getState().signalsByDate) === '{}',
    `cold-start readiness state was not normalised: ${JSON.stringify(useReadinessStore.getState().signalsByDate)}`);
});

run('the door refuses the default over answered signals', () => {
  resetSignals();
  clearAllQuarantines();
  const applied = applyReadinessSignalsWrite({
    next: { '2026-08-07': signal('2026-08-07', 'low'), '2026-08-08': signal('2026-08-08', 'okay') },
    writer: 'accepted_transaction',
  });
  assert(applied.ok, `precondition: acting signals in through the door failed: ${JSON.stringify(applied)}`);
  const before = JSON.stringify(useReadinessStore.getState().signalsByDate);

  const outcome = applyReadinessSignalsWrite({
    next: {},
    writer: 'accepted_transaction',
  });
  assert(!outcome.ok && outcome.reason === 'default_over_answered_signals',
    `the wipe shape was not refused: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useReadinessStore.getState().signalsByDate) === before,
    'the refused write changed the store anyway');
});

run('a reduced-but-nonempty write passes untouched', () => {
  // `pruneBefore` legitimately drops past-day signals; clearing one signal of
  // two is a decision. Reduction is not the wipe; only the bare default is.
  const outcome = applyReadinessSignalsWrite({
    next: { '2026-08-08': signal('2026-08-08', 'okay') },
    writer: 'accepted_transaction',
  });
  assert(outcome.ok, `a reduction was refused as if it were the wipe: ${JSON.stringify(outcome)}`);
  assert(Object.keys(useReadinessStore.getState().signalsByDate).length === 1,
    'the reduction did not land');
});

run('a stale reset id is refused', () => {
  const id = beginReadinessResetAction('test_stale');
  endReadinessResetAction(id);
  const outcome = applyReadinessSignalsWrite({
    next: {},
    writer: 'reset',
    resetActionId: id,
  });
  assert(!outcome.ok && outcome.reason === 'reset_action_not_in_flight',
    `a finished reset's id still erased the signals: ${JSON.stringify(outcome)}`);
  assert(Object.keys(useReadinessStore.getState().signalsByDate).length === 1,
    'the stale-reset write emptied the store');
});

run('an in-flight reset erases, and says so', () => {
  const from = athleteActionLogEntries().length;
  resetSignals();
  assert(Object.keys(useReadinessStore.getState().signalsByDate).length === 0,
    'the reset did not empty the signals');
  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'readiness_write');
  assert(writes.length === 1 && writes[0]!.writer === 'reset'
    && writes[0]!.outcome === 'applied',
    `the reset write is not named on the tape: ${JSON.stringify(writes)}`);
});

run('every readiness write is on the tape, refused or not — counts, never answers', () => {
  applyReadinessSignalsWrite({
    next: {
      '2026-08-07': signal('2026-08-07', 'low'),
      '2026-08-08': signal('2026-08-08', 'okay'),
      '2026-08-09': signal('2026-08-09', 'good'),
    },
    writer: 'accepted_transaction',
  });
  const from = athleteActionLogEntries().length;

  const refused = applyReadinessSignalsWrite({ next: {}, writer: 'coach_mutation_mirror' });
  assert(!refused.ok, 'precondition: the wipe shape must refuse');
  applyReadinessSignalsWrite({
    next: { '2026-08-07': signal('2026-08-07', 'low') },
    writer: 'coach_mutation_mirror',
  });

  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'readiness_write');
  assert(writes.length === 2, `the tape saw ${writes.length} of 2 readiness writes`);
  assert(writes[0]!.outcome === 'refused'
    && writes[0]!.writer === 'coach_mutation_mirror'
    && writes[0]!.internalResultCode === 'default_over_answered_signals',
    `the refused write is not named on the tape: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.outcome === 'applied'
    && writes[1]!.signalCountBefore === 3 && writes[1]!.signalCountAfter === 1,
    `the tape does not record the counts either side: ${JSON.stringify(writes[1])}`);
  const serialised = JSON.stringify(writes);
  // The DATE an athlete checked in on and how they FELT are both answers.
  // Counts travel; dates and energy/soreness/illness values stay.
  assert(!/\d{4}-\d{2}-\d{2}/.test(serialised.replace(/"at":"[^"]*"/g, '')),
    `a signal DATE reached the tape: ${serialised}`);
  assert(!/energy|soreness|painFlag|"low"|"good"/.test(serialised),
    `a signal VALUE reached the tape: ${serialised}`);
});

run('no product writer can reach signalsByDate around the owner', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(path.join(srcRoot, 'store', 'readinessStore.ts'), 'utf8');
  const ownerStart = storeSource.indexOf('export function applyReadinessSignalsWrite');
  assert(ownerStart > 0, 'the readiness write owner is gone');

  const setStateCalls = storeSource.split('useReadinessStore.setState(').length - 1;
  assert(setStateCalls === 1,
    `${setStateCalls} direct setState calls in readinessStore — exactly one, the owner's, may exist`);
  const ownerEnd = storeSource.indexOf('\n}\n', ownerStart);
  const setStateAt = storeSource.indexOf('useReadinessStore.setState(');
  assert(setStateAt > ownerStart && setStateAt < ownerEnd,
    `the one setState (offset ${setStateAt}) is outside the write owner (${ownerStart}..${ownerEnd})`);

  // No zustand action may carry the slice through a bare `set`.
  for (const match of storeSource.matchAll(/\bset\(\{[^}]*\}/g)) {
    assert(!match[0].includes('signalsByDate'),
      `a store action assigns signalsByDate directly: ${match[0].slice(0, 80)}`);
  }

  // PRODUCT CODE ONLY — `__tests__/` is excluded, and that is a DECLARED
  // asymmetry with the prefs sweep, not an oversight: ~38 established suites
  // seed `signalsByDate` directly as fixture state (including the walker's
  // `declare_source_fact` state-reacher, which is itself a declared stand-in
  // until the schedule executor's declared red 1 is paid). Converting them to
  // act through doors is the walker's arc (hand-built fixtures are deprecated
  // for athlete-facing suites, AGENTS.md), not this unit's. Every writer an
  // athlete can meet — screens, utils, stores, dev/e2e seams — is swept.
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const relative = path.relative(srcRoot, full);
      if (relative === path.join('store', 'readinessStore.ts')) continue;
      if (fs.readFileSync(full, 'utf8').includes('useReadinessStore.setState(')) {
        offenders.push(relative);
      }
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `product file(s) write the readiness store around the owner: ${offenders.join(', ')}`);
});

run('the writer boundary refuses a bare payload over a held one', async () => {
  resetSignals();
  clearAllQuarantines();
  assert(quarantineBoundaryKeys().includes(READINESS_PERSISTENCE_KEY),
    'the readiness store never registered its writer boundary');

  const material = JSON.stringify({
    state: { signalsByDate: { '2026-08-07': signal('2026-08-07', 'low') } }, version: 0,
  });
  const bare = JSON.stringify({ state: { signalsByDate: {} }, version: 0 });

  await readinessGuardedStorage.setItem(READINESS_PERSISTENCE_KEY, material);
  quarantineRefusedPayload(READINESS_PERSISTENCE_KEY, material);
  await readinessGuardedStorage.setItem(READINESS_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await readinessGuardedStorage.getItem(READINESS_PERSISTENCE_KEY) === material,
    'a bare payload overwrote a quarantined one — this is the wipe');

  await readinessGuardedStorage.setItem(READINESS_PERSISTENCE_KEY, material);
  await flushPendingStorageWrites();
  assert(await readinessGuardedStorage.getItem(READINESS_PERSISTENCE_KEY) === material,
    'a material payload was refused while quarantined — that strands the athlete');
  await readinessGuardedStorage.setItem(READINESS_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await readinessGuardedStorage.getItem(READINESS_PERSISTENCE_KEY) === bare,
    'the hold outlived the material write that should have released it');
  clearAllQuarantines();
});

void Promise.all(pendingAsync).then(() => {
  console.log(`\nReadiness store ownership totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
});
