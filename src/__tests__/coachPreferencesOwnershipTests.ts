/**
 * COACH PREFERENCES STORE OWNERSHIP — the store-armour recipe, fleet phase.
 *
 * `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`. A modality preference is a DECISION
 * the athlete gave through the coach ("bike instead of rower for that session,
 * going forward") — losing the map silently reverts future weeks to a modality
 * the athlete rejected. Before this unit the store had the profile store's
 * 2026-07-28 shape: anything could assign `modalityPreferences`,
 * `clearAllModalityPreferences()` erased silently, the coach-mutation rollback
 * restored via raw setState, and no write reached the tape. This suite holds
 * the four protections: one door (`applyCoachModalityPrefsWrite`) with typed
 * refusals, every write on the tape, a quarantine boundary at the persistence
 * writer, and a build failure on any writer around the owner.
 *
 * LR-6 note: this unit is store-ownership work (Sam's sequencing ruling 1). It
 * changes HOW `modalityPreferences` is physically written, never WHAT any
 * coach path decides — cell 2 pins the single-clear behaviour the undo engine
 * depends on precisely so that stays true.
 *
 * Run: npm run test:coach-prefs-ownership
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
  useCoachPreferencesStore,
  applyCoachModalityPrefsWrite,
  beginCoachModalityPrefsResetAction,
  endCoachModalityPrefsResetAction,
  coachModalityPrefsGuardedStorage,
  COACH_PREFS_PERSISTENCE_KEY,
} from '../store/coachPreferencesStore';
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

/** Empty the map through the door with a reset act — the legitimate erasure. */
function resetPrefs(): void {
  const id = beginCoachModalityPrefsResetAction('test_reset');
  try {
    applyCoachModalityPrefsWrite({ next: {}, writer: 'reset', resetActionId: id });
  } finally {
    endCoachModalityPrefsResetAction(id);
  }
}

console.log('\n-- Coach preferences ownership (store-armour recipe) --');

run('the door refuses the default over answered preferences', () => {
  resetPrefs();
  clearAllQuarantines();
  useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', {
    from: 'row',
    to: 'bike',
  });
  useCoachPreferencesStore.getState().setModalityPreference('Hard Row Intervals', {
    from: null,
    to: 'ski',
  });
  const before = JSON.stringify(useCoachPreferencesStore.getState().modalityPreferences);
  assert(Object.keys(useCoachPreferencesStore.getState().modalityPreferences).length === 2,
    'precondition: acting preferences in through the store actions failed');

  const outcome = applyCoachModalityPrefsWrite({
    next: {},
    writer: 'coach_pipeline',
  });
  assert(!outcome.ok && outcome.reason === 'default_over_answered_preferences',
    `the wipe shape was not refused: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useCoachPreferencesStore.getState().modalityPreferences) === before,
    'the refused write changed the store anyway');
});

run('a single clear is not the wipe — even when it clears the last preference', () => {
  // LR-6 behaviour pin. `clearModalityPreference` is how the undo engine
  // restores "no preference existed before" — refusing it when the map holds
  // exactly one entry would break undo, which is a coach-path behaviour change
  // this unit is forbidden to make. Clearing one of two is a reduction
  // (recipe lesson 3); clearing the last is a targeted erasure the action
  // declares with its own reset act, and both must pass.
  useCoachPreferencesStore.getState().clearModalityPreference('Hard Row Intervals');
  assert(Object.keys(useCoachPreferencesStore.getState().modalityPreferences).length === 1,
    'clearing one preference of two did not land');
  useCoachPreferencesStore.getState().clearModalityPreference('Easy Aerobic Flush');
  assert(Object.keys(useCoachPreferencesStore.getState().modalityPreferences).length === 0,
    'clearing the LAST preference was refused — that breaks the undo engine');
});

run('a stale reset id is refused', () => {
  useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', {
    from: 'row',
    to: 'bike',
  });
  const id = beginCoachModalityPrefsResetAction('test_stale');
  endCoachModalityPrefsResetAction(id);
  const outcome = applyCoachModalityPrefsWrite({
    next: {},
    writer: 'reset',
    resetActionId: id,
  });
  assert(!outcome.ok && outcome.reason === 'reset_action_not_in_flight',
    `a finished reset's id still erased the preferences: ${JSON.stringify(outcome)}`);
  assert(Object.keys(useCoachPreferencesStore.getState().modalityPreferences).length === 1,
    'the stale-reset write emptied the store');
});

run('an in-flight reset erases, and says so', () => {
  const from = athleteActionLogEntries().length;
  useCoachPreferencesStore.getState().clearAllModalityPreferences();
  assert(Object.keys(useCoachPreferencesStore.getState().modalityPreferences).length === 0,
    'clearAllModalityPreferences through the door did not empty the store');
  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'coach_prefs_write');
  assert(writes.length === 1 && writes[0]!.writer === 'reset'
    && writes[0]!.outcome === 'applied',
    `the reset write is not named on the tape: ${JSON.stringify(writes)}`);
});

run('every prefs write is on the tape, refused or not — counts, never answers', () => {
  resetPrefs();
  useCoachPreferencesStore.getState().setModalityPreference('Easy Aerobic Flush', {
    from: 'row',
    to: 'bike',
  });
  const from = athleteActionLogEntries().length;

  const refused = applyCoachModalityPrefsWrite({ next: {}, writer: 'coach_pipeline' });
  assert(!refused.ok, 'precondition: the wipe shape must refuse');
  useCoachPreferencesStore.getState().setModalityPreference('Hard Row Intervals', {
    from: null,
    to: 'ski',
  });

  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'coach_prefs_write');
  assert(writes.length === 2, `the tape saw ${writes.length} of 2 prefs writes`);
  assert(writes[0]!.outcome === 'refused'
    && writes[0]!.writer === 'coach_pipeline'
    && writes[0]!.internalResultCode === 'default_over_answered_preferences',
    `the refused write is not named on the tape: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.outcome === 'applied'
    && writes[1]!.preferenceCountBefore === 1 && writes[1]!.preferenceCountAfter === 2,
    `the tape does not record the counts either side: ${JSON.stringify(writes[1])}`);
  const serialised = JSON.stringify(writes);
  // A session name and a modality KEY ('bike', 'row', 'ski') are the athlete's
  // answers — the mapping stays on the device; only counts travel.
  assert(!serialised.toLowerCase().includes('aerobic flush')
    && !serialised.toLowerCase().includes('row intervals')
    && !serialised.includes('"bike"') && !serialised.includes('"row"')
    && !serialised.includes('"ski"'),
    `an answer VALUE reached the tape: ${serialised}`);
});

run('no writer can reach modalityPreferences around the owner', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(
    path.join(srcRoot, 'store', 'coachPreferencesStore.ts'), 'utf8');
  const ownerStart = storeSource.indexOf('export function applyCoachModalityPrefsWrite');
  assert(ownerStart > 0, 'the coach prefs write owner is gone');

  const setStateCalls = storeSource.split('useCoachPreferencesStore.setState(').length - 1;
  assert(setStateCalls === 1,
    `${setStateCalls} direct setState calls in coachPreferencesStore — exactly one, `
    + "the owner's, may exist");
  const ownerEnd = storeSource.indexOf('\n}\n', ownerStart);
  const setStateAt = storeSource.indexOf('useCoachPreferencesStore.setState(');
  assert(setStateAt > ownerStart && setStateAt < ownerEnd,
    `the one setState (offset ${setStateAt}) is outside the write owner `
    + `(${ownerStart}..${ownerEnd})`);

  // The zustand actions may keep a bare `set` only if it never carries the map.
  for (const match of storeSource.matchAll(/\bset\(\{[^}]*\}/g)) {
    assert(!match[0].includes('modalityPreferences'),
      `a store action assigns modalityPreferences directly: ${match[0].slice(0, 80)}`);
  }
  for (const match of storeSource.matchAll(/\bset\(\(state\)[^)]*\)/g)) {
    assert(!match[0].includes('modalityPreferences'),
      `a store action assigns modalityPreferences via updater: ${match[0].slice(0, 80)}`);
  }

  // REPO-WIDE, tests included — the prefs-sweep variant. The five test seeding
  // sites that existed were converted to the store's own actions (cheap, and
  // the fixture law prefers it), so no `__tests__` exemption is needed here.
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
      if (relative === path.join('store', 'coachPreferencesStore.ts')) continue;
      // This suite's own sweep carries the search string as a literal — the
      // law statement, not a surviving writer (the audit suite's precedent).
      if (relative === path.join('__tests__', 'coachPreferencesOwnershipTests.ts')) continue;
      if (fs.readFileSync(full, 'utf8').includes('useCoachPreferencesStore.setState(')) {
        offenders.push(relative);
      }
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `file(s) write the coach prefs store around the owner: ${offenders.join(', ')}`);
});

run('the writer boundary refuses a bare payload over a held one', async () => {
  resetPrefs();
  clearAllQuarantines();
  assert(quarantineBoundaryKeys().includes(COACH_PREFS_PERSISTENCE_KEY),
    'the coach prefs store never registered its writer boundary');

  const material = JSON.stringify({
    state: {
      modalityPreferences: {
        'easy aerobic flush': { from: 'row', to: 'bike', createdAt: 1 },
      },
    },
    version: 0,
  });
  const bare = JSON.stringify({ state: { modalityPreferences: {} }, version: 0 });

  await coachModalityPrefsGuardedStorage.setItem(COACH_PREFS_PERSISTENCE_KEY, material);
  quarantineRefusedPayload(COACH_PREFS_PERSISTENCE_KEY, material);
  await coachModalityPrefsGuardedStorage.setItem(COACH_PREFS_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await coachModalityPrefsGuardedStorage.getItem(COACH_PREFS_PERSISTENCE_KEY) === material,
    'a bare payload overwrote a quarantined one — this is the wipe');

  await coachModalityPrefsGuardedStorage.setItem(COACH_PREFS_PERSISTENCE_KEY, material);
  await flushPendingStorageWrites();
  assert(await coachModalityPrefsGuardedStorage.getItem(COACH_PREFS_PERSISTENCE_KEY) === material,
    'a material payload was refused while quarantined — that strands the athlete');
  await coachModalityPrefsGuardedStorage.setItem(COACH_PREFS_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await coachModalityPrefsGuardedStorage.getItem(COACH_PREFS_PERSISTENCE_KEY) === bare,
    'the hold outlived the material write that should have released it');
  clearAllQuarantines();
});

void Promise.all(pendingAsync).then(() => {
  console.log(`\nCoach preferences ownership totals: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
});
