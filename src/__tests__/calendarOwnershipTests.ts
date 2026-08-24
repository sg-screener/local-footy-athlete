/**
 * CALENDAR STORE OWNERSHIP — the store-armour recipe, application 2.
 *
 * `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`. Game, rest and noGame marks are
 * FACTS the athlete stated about their life, and the census's founding
 * evidence for LR-2 was this store: six writers marked COMPATIBILITY-ONLY in
 * their own JSDoc, three live callers, no tape, and a `markedDays` any file
 * could assign. This suite holds the four protections: one door
 * (`applyCalendarMarkedDaysWrite`) with typed refusals, every write on the
 * tape, a quarantine boundary at the persistence writer, and a build failure
 * on any writer around the owner.
 *
 * The door is below the transactions on purpose: `commitCalendarMark/
 * StateTransaction` stays the athlete-facing owner of WHAT a mark means
 * (accept-and-reduce, §18 repair); the door owns HOW `markedDays` is
 * physically written, whoever asks. The transactions are two of its writers.
 *
 * Run: npm run test:calendar-ownership
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
  useCalendarStore,
  applyCalendarMarkedDaysWrite,
  beginCalendarResetAction,
  endCalendarResetAction,
  calendarGuardedStorage,
  CALENDAR_PERSISTENCE_KEY,
  calendarPersistedInputs,
} from '../store/calendarStore';
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

/** Empty the marks through the door with a reset act — the legitimate erasure. */
function resetMarks(): void {
  const id = beginCalendarResetAction('test_reset');
  try {
    applyCalendarMarkedDaysWrite({ next: {}, writer: 'reset', resetActionId: id });
  } finally {
    endCalendarResetAction(id);
  }
}

console.log('\n-- Calendar ownership (store-armour recipe) --');

run('a fresh unhydrated calendar slice is the canonical empty map', () => {
  useCalendarStore.setState({ markedDays: undefined as never });
  const outcome = applyCalendarMarkedDaysWrite({
    next: {},
    writer: 'accepted_transaction',
  });
  assert(outcome.ok, `cold-start empty write failed: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useCalendarStore.getState().markedDays) === '{}',
    `cold-start calendar state was not normalised: ${JSON.stringify(useCalendarStore.getState().markedDays)}`);
});

run('disk keeps calendar facts, never the derived fixture projection', () => {
  const inputs = calendarPersistedInputs({
    '2026-08-07': 'game',
    '2026-08-08': 'rest',
    '2026-08-09': 'noGame',
  });
  assert(JSON.stringify(inputs) === JSON.stringify({ '2026-08-08': 'rest' }),
    `calendar persistence still owns a fixture projection: ${JSON.stringify(inputs)}`);

  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(path.join(srcRoot, 'store', 'calendarStore.ts'), 'utf8');
  const persistenceSource = fs.readFileSync(
    path.join(srcRoot, 'dev', 'e2e', 'devE2EPersistence.ts'), 'utf8');
  const transactionSource = fs.readFileSync(
    path.join(srcRoot, 'store', 'coachMutationTransaction.ts'), 'utf8');
  assert(storeSource.includes(
    'partialize: (state) => ({ markedDays: calendarPersistedInputs(state.markedDays) })'),
  'the calendar envelope does not use the input-only selector');
  assert(persistenceSource.includes(
    'select: (state) => ({ markedDays: calendarPersistedInputs(state.markedDays) })'),
  'reload still compares the live fixture projection against the input-only disk envelope');
  assert(transactionSource.includes(
    'state: { markedDays: calendarPersistedInputs(mirrors.markedDays) }'),
  'the acknowledged coach transaction writes the fixture projection around the calendar input boundary');
});

run('the door refuses the default over answered marks', () => {
  resetMarks();
  clearAllQuarantines();
  const applied = applyCalendarMarkedDaysWrite({
    next: { '2026-08-07': 'game', '2026-08-10': 'rest' },
    writer: 'accepted_transaction',
  });
  assert(applied.ok, `precondition: acting marks in through the door failed: ${JSON.stringify(applied)}`);
  const before = JSON.stringify(useCalendarStore.getState().markedDays);

  const outcome = applyCalendarMarkedDaysWrite({
    next: {},
    writer: 'accepted_transaction',
  });
  assert(!outcome.ok && outcome.reason === 'default_over_answered_marks',
    `the wipe shape was not refused: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useCalendarStore.getState().markedDays) === before,
    'the refused write changed the store anyway');
});

run('a reduced-but-nonempty write passes untouched', () => {
  // `clearAllGames` legitimately writes FEWER marks (rest marks survive a
  // phase transition). Reduction is not the wipe; only the bare default is.
  const outcome = applyCalendarMarkedDaysWrite({
    next: { '2026-08-10': 'rest' },
    writer: 'accepted_transaction',
  });
  assert(outcome.ok, `a reduction was refused as if it were the wipe: ${JSON.stringify(outcome)}`);
  assert(Object.keys(useCalendarStore.getState().markedDays).length === 1,
    'the reduction did not land');
});

run('a stale reset id is refused', () => {
  const id = beginCalendarResetAction('test_stale');
  endCalendarResetAction(id);
  const outcome = applyCalendarMarkedDaysWrite({
    next: {},
    writer: 'reset',
    resetActionId: id,
  });
  assert(!outcome.ok && outcome.reason === 'reset_action_not_in_flight',
    `a finished reset's id still erased the marks: ${JSON.stringify(outcome)}`);
  assert(Object.keys(useCalendarStore.getState().markedDays).length === 1,
    'the stale-reset write emptied the store');
});

run('an in-flight reset erases, and says so', () => {
  const from = athleteActionLogEntries().length;
  resetMarks();
  assert(Object.keys(useCalendarStore.getState().markedDays).length === 0,
    'the reset did not empty the marks');
  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'calendar_write');
  assert(writes.length === 1 && writes[0]!.writer === 'reset'
    && writes[0]!.outcome === 'applied',
    `the reset write is not named on the tape: ${JSON.stringify(writes)}`);
});

run('every calendar write is on the tape, refused or not — counts, never dates', () => {
  applyCalendarMarkedDaysWrite({
    next: { '2026-08-07': 'game', '2026-08-10': 'rest', '2026-08-14': 'noGame' },
    writer: 'accepted_transaction',
  });
  const from = athleteActionLogEntries().length;

  const refused = applyCalendarMarkedDaysWrite({ next: {}, writer: 'coach_mutation_mirror' });
  assert(!refused.ok, 'precondition: the wipe shape must refuse');
  applyCalendarMarkedDaysWrite({
    next: { '2026-08-07': 'game' },
    writer: 'coach_mutation_mirror',
  });

  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'calendar_write');
  assert(writes.length === 2, `the tape saw ${writes.length} of 2 calendar writes`);
  assert(writes[0]!.outcome === 'refused'
    && writes[0]!.writer === 'coach_mutation_mirror'
    && writes[0]!.internalResultCode === 'default_over_answered_marks',
    `the refused write is not named on the tape: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.outcome === 'applied'
    && writes[1]!.markCountBefore === 3 && writes[1]!.markCountAfter === 1,
    `the tape does not record the counts either side: ${JSON.stringify(writes[1])}`);
  const serialised = JSON.stringify(writes);
  // A date an athlete marked is an ANSWER. Counts travel; dates stay.
  assert(!/\d{4}-\d{2}-\d{2}/.test(serialised.replace(/"at":"[^"]*"/g, '')),
    `a marked DATE reached the tape: ${serialised}`);
});

run('no writer can reach markedDays around the owner', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(path.join(srcRoot, 'store', 'calendarStore.ts'), 'utf8');
  const ownerStart = storeSource.indexOf('export function applyCalendarMarkedDaysWrite');
  assert(ownerStart > 0, 'the calendar write owner is gone');

  const setStateCalls = storeSource.split('useCalendarStore.setState(').length - 1;
  assert(setStateCalls === 1,
    `${setStateCalls} direct setState calls in calendarStore — exactly one, the owner's, may exist`);
  const ownerEnd = storeSource.indexOf('\n}\n', ownerStart);
  const setStateAt = storeSource.indexOf('useCalendarStore.setState(');
  assert(setStateAt > ownerStart && setStateAt < ownerEnd,
    `the one setState (offset ${setStateAt}) is outside the write owner (${ownerStart}..${ownerEnd})`);

  // zustand's own `set` may still carry selectedDate; never the marks.
  for (const match of storeSource.matchAll(/\bset\(\{[^}]*\}/g)) {
    assert(!match[0].includes('markedDays'),
      `a store action assigns markedDays directly: ${match[0].slice(0, 80)}`);
  }

  // PRODUCT CODE ONLY — `__tests__/` is excluded, and that is a DECLARED
  // asymmetry with the prefs sweep, not an oversight: 31 established suites
  // seed `markedDays` directly as fixture state. Converting them to act
  // through doors is the walker's arc (hand-built fixtures are deprecated for
  // athlete-facing suites, AGENTS.md), not this unit's. Every writer an
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
      if (relative === path.join('store', 'calendarStore.ts')) continue;
      if (fs.readFileSync(full, 'utf8').includes('useCalendarStore.setState(')) {
        offenders.push(relative);
      }
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `product file(s) write the calendar store around the owner: ${offenders.join(', ')}`);
});

run('the writer boundary refuses a bare payload over a held one', async () => {
  resetMarks();
  clearAllQuarantines();
  assert(quarantineBoundaryKeys().includes(CALENDAR_PERSISTENCE_KEY),
    'the calendar store never registered its writer boundary');

  const material = JSON.stringify({
    state: { markedDays: { '2026-08-07': 'game' } }, version: 0,
  });
  const bare = JSON.stringify({ state: { markedDays: {} }, version: 0 });

  await calendarGuardedStorage.setItem(CALENDAR_PERSISTENCE_KEY, material);
  quarantineRefusedPayload(CALENDAR_PERSISTENCE_KEY, material);
  await calendarGuardedStorage.setItem(CALENDAR_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await calendarGuardedStorage.getItem(CALENDAR_PERSISTENCE_KEY) === material,
    'a bare payload overwrote a quarantined one — this is the wipe');

  await calendarGuardedStorage.setItem(CALENDAR_PERSISTENCE_KEY, material);
  await flushPendingStorageWrites();
  assert(await calendarGuardedStorage.getItem(CALENDAR_PERSISTENCE_KEY) === material,
    'a material payload was refused while quarantined — that strands the athlete');
  await calendarGuardedStorage.setItem(CALENDAR_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await calendarGuardedStorage.getItem(CALENDAR_PERSISTENCE_KEY) === bare,
    'the hold outlived the material write that should have released it');
  clearAllQuarantines();
});

void Promise.all(pendingAsync).then(() => {
  console.log(`\nCalendar ownership totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
});
