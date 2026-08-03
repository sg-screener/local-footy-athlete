/**
 * PROFILE STORE QUARANTINE — the store-armour recipe, fleet tail (2026-08-03).
 *
 * The profile store has carried its door, tape and writer sweep since the
 * profile-wipe unit (`profileMirrorNarrowingTests` holds those). What it never
 * had was the HYDRATION wipe's counter-shape: a boundary at the persistence
 * writer, so a refusal cannot be followed by a bare envelope travelling over
 * the athlete's only disk copy. This suite holds exactly that missing piece —
 * the boundary cell of the recipe (§3 + gate 6) — and nothing the narrowing
 * suite already owns.
 *
 * Run: npm run test:profile-quarantine
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
import {
  PROFILE_STORE_PERSISTENCE_KEY,
  applyProfileOnboardingWrite,
  beginProfileResetAction,
  endProfileResetAction,
  profileGuardedStorage,
  useProfileStore,
} from '../store/profileStore';
import {
  clearAllQuarantines,
  quarantineBoundaryKeys,
  quarantineRefusedPayload,
  quarantinedPayload,
} from '../store/refusedPayloadQuarantine';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

// STRICTLY SEQUENTIAL — every cell acts on the same persist key, and the
// store's own persist middleware writes through the same guarded storage on
// every door write. Two interleaved async cells would overwrite each other's
// envelopes and clear each other's holds (observed on this suite's first run).
const cells: Array<{ name: string; body: () => void | Promise<void> }> = [];
function run(name: string, body: () => void | Promise<void>): void {
  cells.push({ name, body });
}

/** Empty the profile through the door with a reset act — the legitimate erasure. */
function resetProfile(): void {
  const id = beginProfileResetAction('quarantine_test_reset');
  try {
    applyProfileOnboardingWrite({
      next: {},
      writer: 'reset',
      resetActionId: id,
      isOnboardingComplete: false,
    });
  } finally {
    endProfileResetAction(id);
  }
}

const MATERIAL_ENVELOPE = JSON.stringify({
  state: {
    onboardingData: { firstName: 'Sam', seasonPhase: 'In-season' },
    isOnboardingComplete: true,
  },
  version: 0,
});
const BARE_ENVELOPE = JSON.stringify({
  state: { onboardingData: {}, isOnboardingComplete: false },
  version: 0,
});

console.log('\n-- Profile store quarantine (store-armour recipe, fleet tail) --');

run('the profile store declares its writer boundary', () => {
  assert(quarantineBoundaryKeys().includes(PROFILE_STORE_PERSISTENCE_KEY),
    'the profile store never registered its quarantine boundary — the store the '
    + 'wipe law was WRITTEN FOR is the one store the audit cannot see');
});

run('the boundary knows material from bare — by answered fields, not by bytes', () => {
  // The registration must reuse the store's own answered-count semantics: an
  // envelope whose profile holds one answered field is material; an empty
  // profile, an all-empty profile and unreadable bytes are not.
  clearAllQuarantines();
  quarantineRefusedPayload(PROFILE_STORE_PERSISTENCE_KEY, BARE_ENVELOPE);
  assert(quarantinedPayload(PROFILE_STORE_PERSISTENCE_KEY) === null,
    'a bare envelope armed the quarantine — a fresh install would be blocked');
  quarantineRefusedPayload(PROFILE_STORE_PERSISTENCE_KEY, JSON.stringify({
    state: { onboardingData: { firstName: '  ', injuries: [] } }, version: 0,
  }));
  assert(quarantinedPayload(PROFILE_STORE_PERSISTENCE_KEY) === null,
    'blank-string and empty-array fields counted as answers');
  quarantineRefusedPayload(PROFILE_STORE_PERSISTENCE_KEY, 'not json at all {{{');
  assert(quarantinedPayload(PROFILE_STORE_PERSISTENCE_KEY) === null,
    'unreadable bytes armed the quarantine — bytes we cannot parse prove nothing');
  quarantineRefusedPayload(PROFILE_STORE_PERSISTENCE_KEY, MATERIAL_ENVELOPE);
  assert(quarantinedPayload(PROFILE_STORE_PERSISTENCE_KEY) === MATERIAL_ENVELOPE,
    'a material envelope did not arm the quarantine');
  clearAllQuarantines();
});

run('the writer boundary refuses a bare payload over a held one', async () => {
  clearAllQuarantines();
  await profileGuardedStorage.setItem(PROFILE_STORE_PERSISTENCE_KEY, MATERIAL_ENVELOPE);
  quarantineRefusedPayload(PROFILE_STORE_PERSISTENCE_KEY, MATERIAL_ENVELOPE);

  await profileGuardedStorage.setItem(PROFILE_STORE_PERSISTENCE_KEY, BARE_ENVELOPE);
  await flushPendingStorageWrites();
  assert(await profileGuardedStorage.getItem(PROFILE_STORE_PERSISTENCE_KEY) === MATERIAL_ENVELOPE,
    'a bare payload overwrote a quarantined profile — this is the wipe');

  await profileGuardedStorage.setItem(PROFILE_STORE_PERSISTENCE_KEY, MATERIAL_ENVELOPE);
  await flushPendingStorageWrites();
  assert(await profileGuardedStorage.getItem(PROFILE_STORE_PERSISTENCE_KEY) === MATERIAL_ENVELOPE,
    'a material payload was refused while quarantined — that strands the athlete '
    + 'instead of protecting them, and blocks the very lift that resolves it');

  // A material write IS the lift succeeding: the hold must be gone.
  await profileGuardedStorage.setItem(PROFILE_STORE_PERSISTENCE_KEY, BARE_ENVELOPE);
  await flushPendingStorageWrites();
  assert(await profileGuardedStorage.getItem(PROFILE_STORE_PERSISTENCE_KEY) === BARE_ENVELOPE,
    'the hold outlived the material write that should have released it');
  clearAllQuarantines();
});

run("a door refusal captures the DISK copy — the athlete's surviving envelope", async () => {
  // The profile door has refused since 2026-07-30; what was missing is that a
  // refusal now HOLDS what it protected. Memory rolled back correctly in both
  // wipes — the disk copy is the one a later writer can destroy.
  clearAllQuarantines();
  resetProfile();
  applyProfileOnboardingWrite({
    next: { firstName: 'Sam', seasonPhase: 'In-season' } as never,
    writer: 'onboarding_step',
  });
  // Let the store's own persist middleware put the answered profile on disk —
  // that envelope, whatever its exact bytes, is the athlete's surviving copy.
  await flushPendingStorageWrites();
  const diskBefore = await profileGuardedStorage.getItem(PROFILE_STORE_PERSISTENCE_KEY);
  assert(diskBefore && diskBefore.includes('firstName'),
    'precondition: the answered profile never reached the disk');

  const outcome = applyProfileOnboardingWrite({ next: {}, writer: 'compatibility_mirror' });
  assert(!outcome.ok && outcome.reason === 'default_over_answered_profile',
    `precondition: the wipe shape must refuse (got ${JSON.stringify(outcome)})`);
  // The capture is deliberately best-effort and async; give it its ticks.
  await flushPendingStorageWrites();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert(quarantinedPayload(PROFILE_STORE_PERSISTENCE_KEY) === diskBefore,
    'the refusal did not hold the disk copy — a bare fallback written after '
    + 'this refusal would still travel, which is exactly the hydration wipe');

  clearAllQuarantines();
  resetProfile();
});

run('the guarded storage is what the store actually persists through', () => {
  // A boundary the persist config does not use is a green gate that lies. The
  // storage literal is pinned by content: the persist options must name the
  // guarded writer, not the compat base.
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'store', 'profileStore.ts'), 'utf8');
  assert(source.includes('createJSONStorage(() => profileGuardedStorage)'),
    "profileStore's persist storage is not the guarded writer");
  assert(!source.includes('createJSONStorage(() => asyncStorageCompat)'),
    'profileStore still persists through the unguarded compat base');
  assert(useProfileStore.persist.getOptions().name === PROFILE_STORE_PERSISTENCE_KEY,
    'the persist key drifted from the registered boundary key');
});

void (async () => {
  for (const cell of cells) {
    try {
      await cell.body();
      // Let the store's own persist middleware settle before the next cell
      // touches the shared envelope.
      await flushPendingStorageWrites();
      passed += 1;
      console.log(`  PASS ${cell.name}`);
    } catch (error) {
      failed += 1;
      failures.push(cell.name);
      console.error(`  FAIL ${cell.name}\n      ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`\nProfile store quarantine totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
})();
