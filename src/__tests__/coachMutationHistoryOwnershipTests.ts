/**
 * COACH MUTATION HISTORY STORE OWNERSHIP — the store-armour recipe, fleet phase.
 *
 * `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`. The mutation history is the record
 * AGENTS.md requires for coach follow-up target resolution — "undo that",
 * "make them shorter" — and every entry is a DECISION the athlete made through
 * the coach plus the deterministic plan to revert it. Losing `entries` silently
 * severs undo from everything the athlete changed. Before this unit anything
 * could assign `entries`, `clearAll()` erased silently, the coach-mutation
 * rollback restored via raw setState, and no write reached the tape. This
 * suite holds the four protections: one door (`applyCoachMutationHistoryWrite`)
 * with typed refusals, every write on the tape, a quarantine boundary at the
 * persistence writer, and a build failure on any product writer around the
 * owner.
 *
 * LR-6 note: this unit is store-ownership work (Sam's sequencing ruling 1). It
 * changes HOW `entries` is physically written, never WHAT the executor records
 * or the undo engine reverts.
 *
 * Run: npm run test:coach-mutation-history-ownership
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

import fs from 'fs';
import path from 'path';
import {
  useCoachMutationHistoryStore,
  applyCoachMutationHistoryWrite,
  beginCoachMutationHistoryResetAction,
  endCoachMutationHistoryResetAction,
  coachMutationHistoryGuardedStorage,
  COACH_MUTATION_HISTORY_PERSISTENCE_KEY,
} from '../store/coachMutationHistoryStore';
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

/** Empty the history through the door with a reset act — the legitimate erasure. */
function resetHistory(): void {
  const id = beginCoachMutationHistoryResetAction('test_reset');
  try {
    applyCoachMutationHistoryWrite({ next: [], writer: 'reset', resetActionId: id });
  } finally {
    endCoachMutationHistoryResetAction(id);
  }
}

/** Act one real mutation into the history through the store's own action. */
function recordOneMutation(userMessage: string): void {
  useCoachMutationHistoryStore.getState().recordMutation({
    operation: 'swap_conditioning_modality_once',
    mutationKind: 'modality_swap_once',
    userMessage,
    appliedReply: 'Done — Tuesday is on the bike this week.',
    affectedDates: ['2026-08-04'],
    scope: 'one_off',
    revertPlan: { kind: 'restore_snapshot', dateOverrides: [] },
  });
}

console.log('\n-- Coach mutation history ownership (store-armour recipe) --');

run('the door refuses the default over answered history', () => {
  resetHistory();
  clearAllQuarantines();
  recordOneMutation('swap my Tuesday row for a bike');
  const before = JSON.stringify(useCoachMutationHistoryStore.getState().entries);
  assert(useCoachMutationHistoryStore.getState().entries.length === 1,
    'precondition: acting a mutation in through recordMutation failed');

  const outcome = applyCoachMutationHistoryWrite({
    next: [],
    writer: 'executor_record',
  });
  assert(!outcome.ok && outcome.reason === 'default_over_answered_history',
    `the wipe shape was not refused: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useCoachMutationHistoryStore.getState().entries) === before,
    'the refused write changed the store anyway');
});

run('a stale reset id is refused', () => {
  const id = beginCoachMutationHistoryResetAction('test_stale');
  endCoachMutationHistoryResetAction(id);
  const outcome = applyCoachMutationHistoryWrite({
    next: [],
    writer: 'reset',
    resetActionId: id,
  });
  assert(!outcome.ok && outcome.reason === 'reset_action_not_in_flight',
    `a finished reset's id still erased the history: ${JSON.stringify(outcome)}`);
  assert(useCoachMutationHistoryStore.getState().entries.length === 1,
    'the stale-reset write emptied the store');
});

run('an in-flight reset erases, and says so', () => {
  const from = athleteActionLogEntries().length;
  useCoachMutationHistoryStore.getState().clearAll();
  assert(useCoachMutationHistoryStore.getState().entries.length === 0,
    'clearAll through the door did not empty the store');
  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'coach_mutation_history_write');
  assert(writes.length === 1 && writes[0]!.writer === 'reset'
    && writes[0]!.outcome === 'applied',
    `the reset write is not named on the tape: ${JSON.stringify(writes)}`);
});

run('every history write is on the tape, refused or not — counts, never answers', () => {
  resetHistory();
  recordOneMutation('swap my Tuesday row for a bike');
  const from = athleteActionLogEntries().length;

  const refused = applyCoachMutationHistoryWrite({ next: [], writer: 'undo_engine' });
  assert(!refused.ok, 'precondition: the wipe shape must refuse');
  recordOneMutation('actually make Thursday a ski session');

  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'coach_mutation_history_write');
  assert(writes.length === 2, `the tape saw ${writes.length} of 2 history writes`);
  assert(writes[0]!.outcome === 'refused'
    && writes[0]!.writer === 'undo_engine'
    && writes[0]!.internalResultCode === 'default_over_answered_history',
    `the refused write is not named on the tape: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.outcome === 'applied'
    && writes[1]!.writer === 'executor_record'
    && writes[1]!.entryCountBefore === 1 && writes[1]!.entryCountAfter === 2,
    `the tape does not record the counts either side: ${JSON.stringify(writes[1])}`);
  const serialised = JSON.stringify(writes);
  // The athlete's words, the coach's reply and the affected dates are answers.
  // Counts travel; the transcript stays on the device.
  assert(!serialised.includes('Tuesday') && !serialised.includes('Thursday')
    && !serialised.includes('swap my') && !serialised.includes('ski session'),
    `an answer VALUE reached the tape: ${serialised}`);
  assert(!/\d{4}-\d{2}-\d{2}/.test(serialised.replace(/"at":"[^"]*"/g, '')),
    `an affected DATE reached the tape: ${serialised}`);
});

run('no product writer can reach entries around the owner', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(
    path.join(srcRoot, 'store', 'coachMutationHistoryStore.ts'), 'utf8');
  const ownerStart = storeSource.indexOf('export function applyCoachMutationHistoryWrite');
  assert(ownerStart > 0, 'the mutation history write owner is gone');

  const setStateCalls = storeSource.split('useCoachMutationHistoryStore.setState(').length - 1;
  assert(setStateCalls === 1,
    `${setStateCalls} direct setState calls in coachMutationHistoryStore — exactly one, `
    + "the owner's, may exist");
  const ownerEnd = storeSource.indexOf('\n}\n', ownerStart);
  const setStateAt = storeSource.indexOf('useCoachMutationHistoryStore.setState(');
  assert(setStateAt > ownerStart && setStateAt < ownerEnd,
    `the one setState (offset ${setStateAt}) is outside the write owner `
    + `(${ownerStart}..${ownerEnd})`);

  // The zustand actions may keep a bare `set` only if it never carries entries.
  for (const match of storeSource.matchAll(/\bset\(\{[^}]*\}/g)) {
    assert(!match[0].includes('entries'),
      `a store action assigns entries directly: ${match[0].slice(0, 80)}`);
  }
  for (const match of storeSource.matchAll(/\bset\(\(state\)[^)]*\)/g)) {
    assert(!match[0].includes('entries'),
      `a store action assigns entries via updater: ${match[0].slice(0, 80)}`);
  }

  // PRODUCT CODE ONLY — `__tests__/` is excluded, and that is a DECLARED
  // asymmetry with the coach-prefs sweep, not an oversight: ~15 established
  // suites reset `entries` directly as fixture state (`{ entries: [] }`) and
  // one seeds a stale entry to prove rollback. Converting them to act through
  // the store's own doors is the walker's arc (hand-built fixtures are
  // deprecated for athlete-facing suites, AGENTS.md), not this unit's. Every
  // writer an athlete can meet — screens, utils, stores, dev/e2e seams — is
  // swept.
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
      if (relative === path.join('store', 'coachMutationHistoryStore.ts')) continue;
      if (fs.readFileSync(full, 'utf8').includes('useCoachMutationHistoryStore.setState(')) {
        offenders.push(relative);
      }
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `product file(s) write the mutation history store around the owner: ${offenders.join(', ')}`);
});

run('the writer boundary refuses a bare payload over a held one', async () => {
  resetHistory();
  clearAllQuarantines();
  assert(quarantineBoundaryKeys().includes(COACH_MUTATION_HISTORY_PERSISTENCE_KEY),
    'the mutation history store never registered its writer boundary');

  const material = JSON.stringify({
    state: { entries: [{ id: 'mh-1', revertedAt: null }] },
    version: 0,
  });
  const bare = JSON.stringify({ state: { entries: [] }, version: 0 });
  const key = COACH_MUTATION_HISTORY_PERSISTENCE_KEY;

  await coachMutationHistoryGuardedStorage.setItem(key, material);
  quarantineRefusedPayload(key, material);
  await coachMutationHistoryGuardedStorage.setItem(key, bare);
  await flushPendingStorageWrites();
  assert(await coachMutationHistoryGuardedStorage.getItem(key) === material,
    'a bare payload overwrote a quarantined one — this is the wipe');

  await coachMutationHistoryGuardedStorage.setItem(key, material);
  await flushPendingStorageWrites();
  assert(await coachMutationHistoryGuardedStorage.getItem(key) === material,
    'a material payload was refused while quarantined — that strands the athlete');
  await coachMutationHistoryGuardedStorage.setItem(key, bare);
  await flushPendingStorageWrites();
  assert(await coachMutationHistoryGuardedStorage.getItem(key) === bare,
    'the hold outlived the material write that should have released it');
  clearAllQuarantines();
});

void Promise.all(pendingAsync).then(() => {
  console.log(`\nCoach mutation history ownership totals: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
});
