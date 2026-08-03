/**
 * AUTH STORE OWNERSHIP — the store-armour recipe, fleet tail (2026-08-03).
 *
 * The material slice is SESSION IDENTITY. Tokens are not training answers,
 * but losing a login strands the athlete outside their own data — so the
 * signed-out default written over a live session with no named act is the
 * wipe shape, and it refuses. Sign-out is the athlete's own erasure and
 * declares itself with a reset act (recipe lesson 11).
 *
 * TAPE PRIVACY IS ABSOLUTE: this suite acts real-shaped identity values in
 * (an email, tokens, an id) and asserts none of them reach the serialized
 * tape — flags only.
 *
 * HONESTY NOTE: no product code writes this store today (signOut/clear are
 * its only callers and no sign-in flow exists). The armour owns the writes
 * before that flow arrives; the retire-or-wire question is parked, not
 * decided here.
 *
 * Run: npm run test:auth-store-ownership
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
  AUTH_STORE_PERSISTENCE_KEY,
  INITIAL_AUTH_SESSION,
  applyAuthSessionWrite,
  authGuardedStorage,
  beginAuthResetAction,
  endAuthResetAction,
  useAuthStore,
} from '../store/authStore';
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

// STRICTLY SEQUENTIAL — every cell acts on the same persist key, and the
// store's persist middleware writes through the same guarded storage on every
// door write (the profile quarantine suite's lesson).
const cells: Array<{ name: string; body: () => void | Promise<void> }> = [];
function run(name: string, body: () => void | Promise<void>): void {
  cells.push({ name, body });
}

/** Real-shaped identity values, acted in so the privacy cell can hunt them. */
const REAL_USER = { id: 'athlete-7f3a', email: 'sam.athlete@example.com' };
const REAL_SESSION = {
  accessToken: 'eyJ-access-token-value',
  refreshToken: 'refresh-token-value-9c1d',
};

function signIn(): void {
  useAuthStore.getState().setUser(REAL_USER);
  useAuthStore.getState().setSession(REAL_SESSION);
  useAuthStore.getState().setAuthenticated(true);
}

console.log('\n-- Auth store ownership (store-armour recipe, fleet tail) --');

run('the door refuses the signed-out default over a live session', () => {
  clearAllQuarantines();
  useAuthStore.getState().clear();
  signIn();
  const before = JSON.stringify(useAuthStore.getState().session);
  assert(useAuthStore.getState().session?.accessToken === REAL_SESSION.accessToken,
    'precondition: acting a session in through the store actions failed');

  const outcome = applyAuthSessionWrite({
    next: INITIAL_AUTH_SESSION,
    writer: 'auth_flow',
  });
  assert(!outcome.ok && outcome.reason === 'default_over_answered_session',
    `the wipe shape was not refused: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useAuthStore.getState().session) === before
    && useAuthStore.getState().user !== null
    && useAuthStore.getState().isAuthenticated,
    'the refused write changed the session anyway');
});

run('a stale reset id is refused', () => {
  const id = beginAuthResetAction('test_stale');
  endAuthResetAction(id);
  const outcome = applyAuthSessionWrite({
    next: INITIAL_AUTH_SESSION,
    writer: 'reset',
    resetActionId: id,
  });
  assert(!outcome.ok && outcome.reason === 'reset_action_not_in_flight',
    `a finished reset's id still erased the session: ${JSON.stringify(outcome)}`);
  assert(useAuthStore.getState().session !== null,
    'the stale-reset write emptied the session');
});

run('sign-out erases, and says so — the athlete can always leave', () => {
  const writesOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'auth_write');
  const from = writesOnTape().length;
  useAuthStore.getState().signOut();
  assert(useAuthStore.getState().session === null
    && useAuthStore.getState().user === null
    && !useAuthStore.getState().isAuthenticated,
    'signOut through the door did not clear the session — a refusal here '
    + 'strands the athlete signed in on a shared device');
  const writes = writesOnTape().slice(from);
  assert(writes.length === 1 && writes[0]!.writer === 'sign_out'
    && writes[0]!.outcome === 'applied'
    && typeof writes[0]!.erasureActId === 'string'
    && (writes[0]!.erasureActId as string).includes('sign_out'),
    `the sign-out is not named on the tape: ${JSON.stringify(writes)}`);
});

run('every auth write is on the tape, refused or not — flags, NEVER identity values', () => {
  useAuthStore.getState().clear();
  const writesOnTape = () => athleteActionLogEntries()
    .filter((entry) => entry.event === 'auth_write');
  const from = writesOnTape().length;

  signIn(); // three applied writes
  const refused = applyAuthSessionWrite({ next: INITIAL_AUTH_SESSION, writer: 'auth_flow' });
  assert(!refused.ok, 'precondition: the wipe shape must refuse');

  const writes = writesOnTape().slice(from);
  assert(writes.length === 4, `the tape saw ${writes.length} of 4 auth writes`);
  assert(writes[3]!.outcome === 'refused'
    && writes[3]!.writer === 'auth_flow'
    && writes[3]!.internalResultCode === 'default_over_answered_session',
    `the refused write is not named on the tape: ${JSON.stringify(writes[3])}`);
  assert(writes[1]!.outcome === 'applied'
    && writes[1]!.hadSessionBefore === false && writes[1]!.hadSessionAfter === true,
    `the tape does not record the session flags either side: ${JSON.stringify(writes[1])}`);

  // TAPE PRIVACY ABSOLUTE — hunt the real values this suite acted in.
  const serialised = JSON.stringify(writes);
  for (const secret of [REAL_USER.email, REAL_USER.id,
    REAL_SESSION.accessToken, REAL_SESSION.refreshToken, 'example.com']) {
    assert(!serialised.includes(secret),
      `an identity value reached the tape (${secret.slice(0, 8)}…): ${serialised}`);
  }
});

run('no writer can reach the session slice around the owner', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(path.join(srcRoot, 'store', 'authStore.ts'), 'utf8');
  const ownerStart = storeSource.indexOf('export function applyAuthSessionWrite');
  assert(ownerStart > 0, 'the auth session write owner is gone');

  const setStateCalls = storeSource.split('useAuthStore.setState(').length - 1;
  assert(setStateCalls === 1,
    `${setStateCalls} direct setState calls in authStore — exactly one, the owner's, may exist`);
  const ownerEnd = storeSource.indexOf('\n}\n', ownerStart);
  const setStateAt = storeSource.indexOf('useAuthStore.setState(');
  assert(setStateAt > ownerStart && setStateAt < ownerEnd,
    `the one setState (offset ${setStateAt}) is outside the write owner `
    + `(${ownerStart}..${ownerEnd})`);

  // The zustand actions may keep a bare `set` only for isLoading/error.
  // WORD match, not `field:` — `set({ session })` shorthand carries no colon,
  // and the ui sweep's mutation pass proved the colon form blind to it.
  for (const match of storeSource.matchAll(/\bset\(\{[^}]*\}/g)) {
    for (const field of ['user', 'session', 'isAuthenticated']) {
      assert(!new RegExp(`\\b${field}\\b`).test(match[0]),
        `a store action assigns ${field} directly: ${match[0].slice(0, 80)}`);
    }
  }

  // REPO-WIDE, tests included — no external writer exists to convert, so the
  // sweep is total from day one. This suite carries the search string as a
  // literal (the law statement, not a surviving writer).
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
      if (relative === path.join('store', 'authStore.ts')) continue;
      if (relative === path.join('__tests__', 'authStoreOwnershipTests.ts')) continue;
      if (fs.readFileSync(full, 'utf8').includes('useAuthStore.setState(')) {
        offenders.push(relative);
      }
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `file(s) write the auth store around the owner: ${offenders.join(', ')}`);
});

run('the writer boundary refuses a bare payload over a held one', async () => {
  useAuthStore.getState().clear();
  clearAllQuarantines();
  assert(quarantineBoundaryKeys().includes(AUTH_STORE_PERSISTENCE_KEY),
    'the auth store never registered its writer boundary');

  const material = JSON.stringify({
    state: {
      user: REAL_USER, session: REAL_SESSION, isAuthenticated: true,
    },
    version: 0,
  });
  const bare = JSON.stringify({
    state: { user: null, session: null, isAuthenticated: false },
    version: 0,
  });

  await authGuardedStorage.setItem(AUTH_STORE_PERSISTENCE_KEY, material);
  quarantineRefusedPayload(AUTH_STORE_PERSISTENCE_KEY, material);
  await authGuardedStorage.setItem(AUTH_STORE_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await authGuardedStorage.getItem(AUTH_STORE_PERSISTENCE_KEY) === material,
    'a bare payload overwrote a quarantined session — this is the wipe');

  await authGuardedStorage.setItem(AUTH_STORE_PERSISTENCE_KEY, material);
  await flushPendingStorageWrites();
  assert(await authGuardedStorage.getItem(AUTH_STORE_PERSISTENCE_KEY) === material,
    'a material payload was refused while quarantined — that strands the athlete');
  await authGuardedStorage.setItem(AUTH_STORE_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await authGuardedStorage.getItem(AUTH_STORE_PERSISTENCE_KEY) === bare,
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
  console.log(`\nAuth store ownership totals: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
})();
