/**
 * UI STORE OWNERSHIP — the store-armour recipe, fleet tail (2026-08-03), at
 * this store's honest size.
 *
 * The census called this store's blast radius negligible and reading it
 * confirms that: nothing in it is an athlete answer. The armour is therefore
 * the MINIMUM the recipe allows, each absence decided and pinned here rather
 * than defaulted:
 *
 *   - a door owns the durable chosen-settings slice (theme, designVersion)
 *     and names its writers on the tape;
 *   - the door has NO wipe refusal — the defaults are a legitimate chosen
 *     state, and refusing them would refuse the athlete's own resets
 *     (cell 3 pins this as a decision);
 *   - the quarantine boundary is registered and the guarded writer asks the
 *     law's question, but with no refusal path nothing can arm it today
 *     (cell 5 proves the boundary machinery anyway);
 *   - activeTab/isOnline stay outside the door and off the tape — a tab
 *     switch per navigation would flood the ring with non-decisions.
 *
 * There is NO walker refusal-replay cell for this store: the recipe's §6
 * replays a refusal, and this door has none to replay.
 *
 * Run: npm run test:ui-store-ownership
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
  INITIAL_UI_SETTINGS,
  UI_STORE_PERSISTENCE_KEY,
  applyUiSettingsWrite,
  uiGuardedStorage,
  useUIStore,
} from '../store/uiStore';
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

// STRICTLY SEQUENTIAL — the persist middleware writes through the same
// guarded storage on every door write (the profile quarantine suite's lesson).
const cells: Array<{ name: string; body: () => void | Promise<void> }> = [];
function run(name: string, body: () => void | Promise<void>): void {
  cells.push({ name, body });
}

console.log('\n-- UI store ownership (store-armour recipe, fleet tail) --');

run('the chosen settings travel through the door and land', () => {
  clearAllQuarantines();
  useUIStore.getState().clear();
  useUIStore.getState().setTheme('light');
  useUIStore.getState().setDesignVersion('v2');
  assert(useUIStore.getState().theme === 'light'
    && useUIStore.getState().designVersion === 'v2',
    'acting settings in through the store actions failed');
});

run('every settings write is on the tape — writer, outcome, flags', () => {
  useUIStore.getState().clear();
  const writesOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'ui_store_write');
  const from = writesOnTape().length;

  useUIStore.getState().setTheme('light');
  useUIStore.getState().clear();

  const writes = writesOnTape().slice(from);
  assert(writes.length === 2, `the tape saw ${writes.length} of 2 settings writes`);
  assert(writes[0]!.writer === 'settings_control' && writes[0]!.outcome === 'applied'
    && writes[0]!.themeChanged === true && writes[0]!.nonDefaultAfter === true,
    `the settings write is not named on the tape: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.writer === 'reset' && writes[1]!.outcome === 'applied'
    && writes[1]!.nonDefaultAfter === false,
    `the reset write is not named on the tape: ${JSON.stringify(writes[1])}`);
});

run('the door has NO wipe refusal — pinned as a decision, not an omission', () => {
  // Nothing in this store is an athlete answer; the defaults are a chosen
  // state. A refusal added here later must consciously delete this cell and
  // say why. The door's outcome type admits no failure, and writing the
  // defaults over non-default settings always lands.
  useUIStore.getState().setTheme('light');
  const outcome = applyUiSettingsWrite({
    next: INITIAL_UI_SETTINGS,
    writer: 'settings_control',
  });
  assert(outcome.ok === true,
    'the defaults were refused — this store has no athlete answer to protect, '
    + 'so a refusal here refuses the athlete');
  assert(useUIStore.getState().theme === 'dark'
    && useUIStore.getState().designVersion === 'classic',
    'the default write did not land');
});

run('no writer can reach the settings slice around the owner', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(path.join(srcRoot, 'store', 'uiStore.ts'), 'utf8');
  const ownerStart = storeSource.indexOf('export function applyUiSettingsWrite');
  assert(ownerStart > 0, 'the ui settings write owner is gone');

  const setStateCalls = storeSource.split('useUIStore.setState(').length - 1;
  assert(setStateCalls === 1,
    `${setStateCalls} direct setState calls in uiStore — exactly one, the owner's, may exist`);
  const ownerEnd = storeSource.indexOf('\n}\n', ownerStart);
  const setStateAt = storeSource.indexOf('useUIStore.setState(');
  assert(setStateAt > ownerStart && setStateAt < ownerEnd,
    `the one setState (offset ${setStateAt}) is outside the write owner `
    + `(${ownerStart}..${ownerEnd})`);

  // The zustand actions may keep a bare `set` only for activeTab/isOnline.
  // WORD match, not `field:` — `set({ theme })` shorthand carries no colon,
  // and this unit's own mutation pass proved the colon form blind to it.
  for (const match of storeSource.matchAll(/\bset\(\{[^}]*\}/g)) {
    for (const field of ['theme', 'designVersion']) {
      assert(!new RegExp(`\\b${field}\\b`).test(match[0]),
        `a store action assigns ${field} directly: ${match[0].slice(0, 80)}`);
    }
  }

  // REPO-WIDE, tests included — no external writer exists. This suite
  // carries the search string as a literal (the law statement).
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
      if (relative === path.join('store', 'uiStore.ts')) continue;
      if (relative === path.join('__tests__', 'uiStoreOwnershipTests.ts')) continue;
      if (fs.readFileSync(full, 'utf8').includes('useUIStore.setState(')) {
        offenders.push(relative);
      }
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `file(s) write the ui store around the owner: ${offenders.join(', ')}`);
});

run('the writer boundary machinery is real, even though no refusal can arm it', async () => {
  // The registration and the guarded writer are proven with a hand-armed
  // hold: if this store ever grows a refusal path, the protection downstream
  // of it already works — and until then the audit enumerates a boundary
  // that is genuinely wired, not a registry entry.
  useUIStore.getState().clear();
  clearAllQuarantines();
  assert(quarantineBoundaryKeys().includes(UI_STORE_PERSISTENCE_KEY),
    'the ui store never registered its writer boundary');

  const material = JSON.stringify({
    state: { theme: 'light', designVersion: 'v2', activeTab: 'home', isOnline: true },
    version: 0,
  });
  const bare = JSON.stringify({
    state: { theme: 'dark', designVersion: 'classic', activeTab: 'home', isOnline: true },
    version: 0,
  });

  await uiGuardedStorage.setItem(UI_STORE_PERSISTENCE_KEY, material);
  quarantineRefusedPayload(UI_STORE_PERSISTENCE_KEY, material);
  await uiGuardedStorage.setItem(UI_STORE_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await uiGuardedStorage.getItem(UI_STORE_PERSISTENCE_KEY) === material,
    'a bare payload overwrote a held one — the guarded writer is not asking');

  await uiGuardedStorage.setItem(UI_STORE_PERSISTENCE_KEY, material);
  await flushPendingStorageWrites();
  await uiGuardedStorage.setItem(UI_STORE_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await uiGuardedStorage.getItem(UI_STORE_PERSISTENCE_KEY) === bare,
    'the hold outlived the material write that should have released it');
  clearAllQuarantines();
});

void (async () => {
  for (const cell of cells) {
    try {
      await cell.body();
      await flushPendingStorageWrites();
      passed += 1;
      console.log(`  PASS ${cell.name}`);
    } catch (error) {
      failed += 1;
      failures.push(cell.name);
      console.error(`  FAIL ${cell.name}\n      ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`\nUI store ownership totals: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
})();
