/**
 * DECISION LEDGER OWNERSHIP — the store-armour recipe applied at BIRTH.
 *
 * R1.1 of the shell rebuild (`docs/SHELL_REBUILD_PLAN_2026-08-05.md`, approved
 * 2026-08-05). The decision ledger is the rebuild's one new persisted store:
 * every athlete edit is one appended, typed entry, and the visible week is
 * derived — never stored. Unlike every store the recipe was retro-fitted to,
 * this one is born armoured: one door, typed refusals, every write on the
 * tape, a quarantine boundary, and a build failure on any writer around the
 * owner.
 *
 * One law is the ledger's own, beyond the recipe: APPEND-ONLY. A write that
 * drops or edits an existing entry is the ledger's wipe shape even when the
 * result is non-empty, so it refuses without an in-flight reset act. Undo is
 * a reversal ENTRY (LR-29 dies by construction); compaction is a named future
 * unit, not a writer.
 *
 * Run: npm run test:decision-ledger-ownership
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
  useDecisionLedgerStore,
  applyDecisionLedgerWrite,
  appendDecisionEntry,
  decisionLedgerEntries,
  beginDecisionLedgerResetAction,
  endDecisionLedgerResetAction,
  DECISION_LEDGER_PERSISTENCE_KEY,
  decisionLedgerGuardedStorage,
} from '../store/decisionLedgerStore';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import {
  clearAllQuarantines,
  quarantineBoundaryKeys,
  quarantineRefusedPayload,
} from '../store/refusedPayloadQuarantine';
import { athleteActionLogEntries } from '../utils/athleteActionLog';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';

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

/** Empty the ledger through the door, the declared way. */
function resetLedger(): void {
  const id = beginDecisionLedgerResetAction('test_reset');
  try {
    applyDecisionLedgerWrite({ next: [], writer: 'reset', resetActionId: id });
  } finally {
    endDecisionLedgerResetAction(id);
  }
}

/** One real decision, appended through the convenience appender. */
function appendRemoveSession(date: string): DecisionLedgerEntry {
  const outcome = appendDecisionEntry({
    decision: { kind: 'plan_change', change: { kind: 'remove_session', date, scope: 'whole_day' } },
    provenance: 'athlete_tap',
    writer: 'program_control',
  });
  assert(outcome.ok && outcome.entry, `append failed: ${JSON.stringify(outcome)}`);
  return outcome.entry;
}

console.log('\n-- Decision ledger ownership (store-armour recipe, applied at birth) --');

run('the door refuses the default over an answered ledger', () => {
  resetLedger();
  clearAllQuarantines();
  appendRemoveSession('2026-08-08');
  const before = JSON.stringify(decisionLedgerEntries());

  const outcome = applyDecisionLedgerWrite({ next: [], writer: 'program_control' });
  assert(!outcome.ok && outcome.reason === 'default_over_answered_ledger',
    `the wipe shape was not refused: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(decisionLedgerEntries()) === before,
    'the refused write changed the ledger anyway');
});

run('a stale reset id is refused', () => {
  resetLedger();
  appendRemoveSession('2026-08-08');
  const id = beginDecisionLedgerResetAction('test_stale');
  endDecisionLedgerResetAction(id);
  const outcome = applyDecisionLedgerWrite({ next: [], writer: 'reset', resetActionId: id });
  assert(!outcome.ok && outcome.reason === 'reset_action_not_in_flight',
    `a finished reset's id still erased the ledger: ${JSON.stringify(outcome)}`);
  assert(decisionLedgerEntries().length === 1,
    'the stale-reset write emptied the ledger');
});

run('an in-flight reset erases, and says so', () => {
  resetLedger();
  appendRemoveSession('2026-08-08');
  const from = athleteActionLogEntries().length;
  useDecisionLedgerStore.getState().clear();
  assert(decisionLedgerEntries().length === 0,
    'clear() through the door did not empty the ledger');
  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'decision_ledger_write');
  assert(writes.length === 1 && writes[0]!.writer === 'reset'
    && writes[0]!.outcome === 'applied',
    `the reset write is not named on the tape: ${JSON.stringify(writes)}`);
});

run('the ledger is append-only: a rewrite that drops an entry refuses without a reset act', () => {
  resetLedger();
  const first = appendRemoveSession('2026-08-08');
  const second = appendRemoveSession('2026-08-09');
  // Dropping the FIRST entry while keeping the second: non-empty result, so
  // the default-over-answered refusal cannot see it — the prefix law must.
  const outcome = applyDecisionLedgerWrite({ next: [second], writer: 'program_control' });
  assert(!outcome.ok && outcome.reason === 'ledger_rewrite_without_reset',
    `a rewrite that dropped an entry was not refused: ${JSON.stringify(outcome)}`);
  assert(decisionLedgerEntries().length === 2
    && decisionLedgerEntries()[0]!.id === first.id,
    'the refused rewrite changed the ledger anyway');
  // Editing an existing entry in place is the same wipe shape.
  const edited = { ...first, decision: { kind: 'plan_change' as const, change: { kind: 'remove_session' as const, date: '2026-08-10' } } };
  const editOutcome = applyDecisionLedgerWrite({ next: [edited, second], writer: 'program_control' });
  assert(!editOutcome.ok && editOutcome.reason === 'ledger_rewrite_without_reset',
    `an in-place edit of a ledger entry was not refused: ${JSON.stringify(editOutcome)}`);
});

run('appendDecisionEntry appends one typed decision with identity and time', () => {
  resetLedger();
  const entry = appendRemoveSession('2026-08-08');
  assert(decisionLedgerEntries().length === 1, 'the append did not land');
  assert(typeof entry.id === 'string' && entry.id.length > 0, 'the entry has no id');
  assert(!Number.isNaN(Date.parse(entry.occurredAt)),
    `occurredAt is not a parseable instant: ${entry.occurredAt}`);
  assert(entry.provenance === 'athlete_tap', `provenance lost: ${entry.provenance}`);
  const decision = entry.decision;
  assert(decision.kind === 'plan_change' && decision.change.kind === 'remove_session'
    && decision.change.date === '2026-08-08',
    `the typed decision did not survive verbatim: ${JSON.stringify(decision)}`);
  const again = appendRemoveSession('2026-08-09');
  assert(again.id !== entry.id, 'two appends shared one id');
});

run('every ledger write is on the tape, refused or not — counts and door labels, never dates', () => {
  resetLedger();
  appendRemoveSession('2026-08-08');
  const from = athleteActionLogEntries().length;

  const refused = applyDecisionLedgerWrite({ next: [], writer: 'program_control' });
  assert(!refused.ok, 'precondition: the wipe shape must refuse');
  appendRemoveSession('2026-08-11');

  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'decision_ledger_write');
  assert(writes.length === 2, `the tape saw ${writes.length} of 2 ledger writes`);
  assert(writes[0]!.outcome === 'refused'
    && writes[0]!.writer === 'program_control'
    && writes[0]!.internalResultCode === 'default_over_answered_ledger',
    `the refused write is not named on the tape: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.outcome === 'applied'
    && writes[1]!.entryCountBefore === 1 && writes[1]!.entryCountAfter === 2
    && writes[1]!.decisionKind === 'remove_session',
    `the applied write does not carry counts and the door label: ${JSON.stringify(writes[1])}`);
  const serialised = JSON.stringify(writes);
  assert(!serialised.includes('2026-08-08') && !serialised.includes('2026-08-11'),
    `an answer VALUE (a date) reached the tape: ${serialised}`);
});

run('no writer can reach the entries around the owner', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(
    path.join(srcRoot, 'store', 'decisionLedgerStore.ts'), 'utf8');
  const ownerStart = storeSource.indexOf('export function applyDecisionLedgerWrite');
  assert(ownerStart > 0, 'the ledger write owner is gone');

  const setStateCalls = storeSource.split('useDecisionLedgerStore.setState(').length - 1;
  assert(setStateCalls === 1,
    `${setStateCalls} direct setState calls in decisionLedgerStore — exactly one, `
    + "the owner's, may exist");
  const ownerEnd = storeSource.indexOf('\n}\n', ownerStart);
  const setStateAt = storeSource.indexOf('useDecisionLedgerStore.setState(');
  assert(setStateAt > ownerStart && setStateAt < ownerEnd,
    `the one setState (offset ${setStateAt}) is outside the write owner `
    + `(${ownerStart}..${ownerEnd})`);

  // Repo-wide, tests included: this store is born under the law, so no
  // fixture-seeding exemption exists to declare (recipe deviation 4 inverted).
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const relative = path.relative(srcRoot, full);
      if (relative === path.join('store', 'decisionLedgerStore.ts')) continue;
      // This suite's own sweep carries the search string as a literal — the
      // law statement, not a surviving writer (the audit suite's precedent).
      if (relative === path.join('__tests__', 'decisionLedgerOwnershipTests.ts')) continue;
      if (fs.readFileSync(full, 'utf8').includes('useDecisionLedgerStore.setState(')) {
        offenders.push(relative);
      }
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `file(s) write the decision ledger around the owner: ${offenders.join(', ')}`);
});

run('the writer boundary refuses a bare payload over a held one', async () => {
  resetLedger();
  clearAllQuarantines();
  assert(quarantineBoundaryKeys().includes(DECISION_LEDGER_PERSISTENCE_KEY),
    'the decision ledger never registered its writer boundary');

  const material = JSON.stringify({
    state: {
      entries: [{
        id: 'dl-boundary-1',
        occurredAt: '2026-08-05T09:00:00.000Z',
        provenance: 'athlete_tap',
        decision: { kind: 'plan_change', change: { kind: 'remove_session', date: '2026-08-08' } },
      }],
    },
    version: 0,
  });
  const bare = JSON.stringify({ state: { entries: [] }, version: 0 });
  const key = DECISION_LEDGER_PERSISTENCE_KEY;

  await decisionLedgerGuardedStorage.setItem(key, material);
  quarantineRefusedPayload(key, material);
  await decisionLedgerGuardedStorage.setItem(key, bare);
  await flushPendingStorageWrites();
  assert(await decisionLedgerGuardedStorage.getItem(key) === material,
    'a bare payload overwrote a quarantined one — this is the wipe');

  await decisionLedgerGuardedStorage.setItem(key, material);
  await flushPendingStorageWrites();
  assert(await decisionLedgerGuardedStorage.getItem(key) === material,
    'a material payload was refused while quarantined — that strands the athlete');
  await decisionLedgerGuardedStorage.setItem(key, bare);
  await flushPendingStorageWrites();
  assert(await decisionLedgerGuardedStorage.getItem(key) === bare,
    'the hold outlived the material write that should have released it');
  clearAllQuarantines();
});

void Promise.all(pendingAsync).then(() => {
  console.log(`\nDecision ledger ownership totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
});
