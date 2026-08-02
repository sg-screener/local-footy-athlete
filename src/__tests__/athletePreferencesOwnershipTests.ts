/**
 * ATHLETE PREFERENCES STORE OWNERSHIP — the store-armour recipe, application 1.
 *
 * `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`. Exclusions, pins and active
 * injuries are ANSWERS the athlete gave; on 2026-07-30 this store had the
 * profile store's 2026-07-28 shape — anything could assign `prefs`, `clear()`
 * erased silently, and no write reached the tape. This suite holds the four
 * protections: one door with typed refusals, every write on the tape, a
 * quarantine boundary at the persistence writer, and a build failure on any
 * writer around the owner.
 *
 * Run: npm run test:athlete-prefs-ownership
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
  useAthletePreferencesStore,
  applyAthletePrefsWrite,
  beginAthletePrefsResetAction,
  endAthletePrefsResetAction,
  INITIAL_ATHLETE_PREFS,
  athletePrefsGuardedStorage,
} from '../store/athletePreferencesStore';
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
const pendingAsync: Promise<void>[] = [];

/** The store's built-in empty default, written through the door with a reset act. */
function resetPrefs(): void {
  const id = beginAthletePrefsResetAction('test_reset');
  try {
    applyAthletePrefsWrite({ next: INITIAL_ATHLETE_PREFS, writer: 'reset', resetActionId: id });
  } finally {
    endAthletePrefsResetAction(id);
  }
}

console.log('\n-- Athlete preferences ownership (store-armour recipe) --');

run('the door refuses the default over answered prefs', () => {
  resetPrefs();
  clearAllQuarantines();
  useAthletePreferencesStore.getState().addExclusion('Back Squat');
  useAthletePreferencesStore.getState().addActiveInjury('hamstring');
  const before = JSON.stringify(useAthletePreferencesStore.getState().prefs);

  const outcome = applyAthletePrefsWrite({
    next: INITIAL_ATHLETE_PREFS,
    writer: 'preference_control',
  });
  assert(!outcome.ok && outcome.reason === 'default_over_answered_prefs',
    `the wipe shape was not refused: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useAthletePreferencesStore.getState().prefs) === before,
    'the refused write changed the store anyway');
});

run('a stale reset id is refused', () => {
  useAthletePreferencesStore.getState().addExclusion('Back Squat');
  const id = beginAthletePrefsResetAction('test_stale');
  endAthletePrefsResetAction(id);
  const outcome = applyAthletePrefsWrite({
    next: INITIAL_ATHLETE_PREFS,
    writer: 'reset',
    resetActionId: id,
  });
  assert(!outcome.ok && outcome.reason === 'reset_action_not_in_flight',
    `a finished reset's id still erased the prefs: ${JSON.stringify(outcome)}`);
  assert(useAthletePreferencesStore.getState().prefs.excluded.length > 0,
    'the stale-reset write emptied the store');
});

run('an in-flight reset erases, and says so', () => {
  useAthletePreferencesStore.getState().addExclusion('Back Squat');
  const from = athleteActionLogEntries().length;
  useAthletePreferencesStore.getState().clear();
  const prefs = useAthletePreferencesStore.getState().prefs;
  assert(prefs.excluded.length === 0 && prefs.pinned.length === 0
    && (prefs.activeInjuries ?? []).length === 0,
    'clear() through the door did not empty the store');
  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'athlete_prefs_write');
  assert(writes.length === 1 && writes[0]!.writer === 'reset'
    && writes[0]!.outcome === 'applied',
    `the reset write is not named on the tape: ${JSON.stringify(writes)}`);
});

run('every prefs write is on the tape, refused or not — counts, never answers', () => {
  resetPrefs();
  useAthletePreferencesStore.getState().addExclusion('Back Squat');
  useAthletePreferencesStore.getState().addPinned('Trap Bar Deadlift');
  useAthletePreferencesStore.getState().addActiveInjury('hamstring');
  const from = athleteActionLogEntries().length;

  const refused = applyAthletePrefsWrite({
    next: INITIAL_ATHLETE_PREFS,
    writer: 'preference_control',
  });
  assert(!refused.ok, 'precondition: the wipe shape must refuse');
  useAthletePreferencesStore.getState().removePinned('Trap Bar Deadlift');

  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'athlete_prefs_write');
  assert(writes.length === 2, `the tape saw ${writes.length} of 2 prefs writes`);
  assert(writes[0]!.outcome === 'refused'
    && writes[0]!.writer === 'preference_control'
    && writes[0]!.internalResultCode === 'default_over_answered_prefs',
    `the refused write is not named on the tape: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.outcome === 'applied' && writes[1]!.writer === 'preference_control',
    `the applied write is not named on the tape: ${JSON.stringify(writes[1])}`);
  assert(writes[0]!.excludedCountBefore === 1 && writes[0]!.pinnedCountBefore === 1
    && writes[0]!.activeInjuryCountBefore === 1,
    `the tape does not record the material counts before the write: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.pinnedCountAfter === 0 && writes[1]!.pinnedCountBefore === 1,
    `the tape does not record the counts either side: ${JSON.stringify(writes[1])}`);
  const serialised = JSON.stringify(writes);
  assert(!serialised.includes('Back Squat') && !serialised.includes('Trap Bar Deadlift')
    && !serialised.includes('hamstring'),
    `an answer VALUE reached the tape: ${serialised}`);
});

run('removing the last answer is the athlete\'s change, not the wipe', () => {
  // Found by the coach-store application (recipe lesson 11): a remove action
  // whose result happens to be the empty default is an attributed erasure —
  // refusing it strands the athlete with an exclusion they cannot take back.
  resetPrefs();
  useAthletePreferencesStore.getState().addExclusion('Back Squat');
  const from = athleteActionLogEntries().length;
  useAthletePreferencesStore.getState().removeExclusion('Back Squat');
  assert(useAthletePreferencesStore.getState().prefs.excluded.length === 0,
    'removing the last exclusion was refused — the athlete is stranded');
  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'athlete_prefs_write');
  assert(writes.length === 1 && writes[0]!.outcome === 'applied'
    && typeof writes[0]!.erasureActId === 'string'
    && String(writes[0]!.erasureActId).includes('remove_exclusion'),
    `the last-answer removal is not a named erasure on the tape: ${JSON.stringify(writes)}`);

  // And the same shape for the last active injury.
  useAthletePreferencesStore.getState().addActiveInjury('hamstring');
  useAthletePreferencesStore.getState().removeActiveInjury('hamstring');
  assert((useAthletePreferencesStore.getState().prefs.activeInjuries ?? []).length === 0,
    'removing the last active injury was refused');
});

run('no writer can reach prefs around the owner', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(
    path.join(srcRoot, 'store', 'athletePreferencesStore.ts'), 'utf8');
  const ownerStart = storeSource.indexOf('export function applyAthletePrefsWrite');
  assert(ownerStart > 0, 'the prefs write owner is gone');

  const setStateCalls = storeSource.split('useAthletePreferencesStore.setState(').length - 1;
  assert(setStateCalls === 1,
    `${setStateCalls} direct setState calls in athletePreferencesStore — exactly one, `
    + "the owner's, may exist");
  const ownerEnd = storeSource.indexOf('\n}\n', ownerStart);
  const setStateAt = storeSource.indexOf('useAthletePreferencesStore.setState(');
  assert(setStateAt > ownerStart && setStateAt < ownerEnd,
    `the one setState (offset ${setStateAt}) is outside the write owner `
    + `(${ownerStart}..${ownerEnd})`);

  // The zustand actions may keep a bare `set` only if it never carries `prefs`.
  for (const match of storeSource.matchAll(/\bset\(\{[^}]*\}/g)) {
    assert(!match[0].includes('prefs'),
      `a store action assigns prefs directly: ${match[0].slice(0, 80)}`);
  }
  for (const match of storeSource.matchAll(/\bset\(\(state\)[^)]*\)/g)) {
    assert(!match[0].includes('prefs'),
      `a store action assigns prefs via updater: ${match[0].slice(0, 80)}`);
  }

  // Repo-wide: no other file reaches the store's setState.
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
      if (relative === path.join('store', 'athletePreferencesStore.ts')) continue;
      // This suite's own sweep carries the search string as a literal — the
      // law statement, not a surviving writer (the audit suite's precedent).
      if (relative === path.join('__tests__', 'athletePreferencesOwnershipTests.ts')) continue;
      if (fs.readFileSync(full, 'utf8').includes('useAthletePreferencesStore.setState(')) {
        offenders.push(relative);
      }
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `file(s) write the prefs store around the owner: ${offenders.join(', ')}`);
});

run('the writer boundary refuses a bare payload over a held one', async () => {
  resetPrefs();
  clearAllQuarantines();
  assert(quarantineBoundaryKeys().includes('athlete-preferences-store'),
    'the prefs store never registered its writer boundary');

  const material = JSON.stringify({
    state: { prefs: { excluded: ['Back Squat'], pinned: [], activeInjuries: [] } },
    version: 0,
  });
  const bare = JSON.stringify({
    state: { prefs: { excluded: [], pinned: [], activeInjuries: [] } },
    version: 0,
  });
  const key = 'athlete-preferences-store';

  await athletePrefsGuardedStorage.setItem(key, material);
  quarantineRefusedPayload(key, material);
  await athletePrefsGuardedStorage.setItem(key, bare);
  await flushPendingStorageWrites();
  assert(await athletePrefsGuardedStorage.getItem(key) === material,
    'a bare payload overwrote a quarantined one — this is the wipe');

  await athletePrefsGuardedStorage.setItem(key, material);
  await flushPendingStorageWrites();
  assert(await athletePrefsGuardedStorage.getItem(key) === material,
    'a material payload was refused while quarantined — that strands the athlete');
  await athletePrefsGuardedStorage.setItem(key, bare);
  await flushPendingStorageWrites();
  assert(await athletePrefsGuardedStorage.getItem(key) === bare,
    'the hold outlived the material write that should have released it');
  clearAllQuarantines();
});

void Promise.all(pendingAsync).then(() => {
  console.log(`\nAthlete preferences ownership totals: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
});
