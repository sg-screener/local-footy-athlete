/**
 * A REHYDRATION MAY RESTORE ANSWERS. IT MAY NEVER TAKE THEM AWAY.
 *
 * ## The defect, and where it came from
 *
 * `docs/SEAT_INBOX.md` item 2, recorded 2026-08-12 and marked **"NOT PAID, NOT
 * INVESTIGATED — a second defect found on the way past"**:
 *
 *   > Rehydrating an EMPTY profile envelope does not merely fail to restore
 *   > answers: `profileStore`'s `merge` spreads `...persisted` over the live
 *   > state, so it flips `isOnboardingComplete` from **true to false** in
 *   > memory. An empty envelope actively un-finishes a finished profile.
 *   > Reachable whenever disk is bare and memory is not.
 *
 * It was found beside the L16 data-loss fix (`fd4f68a2`) — a wipe issued FIRST
 * landing LAST, on top of the athlete's 40 answers, leaving a 103-byte shell on
 * disk. **That write ordering is fixed. This is the OTHER half**: what the app
 * does when it reads a shell like that back, whatever wrote it.
 *
 * ## WHY `onboardingData` WAS ALREADY SAFE AND THE REST WAS NOT
 *
 * The merge takes care over exactly one field — `onboardingData` is spread
 * `{...current, ...persisted}` so a missing answer cannot erase a live one. Then
 * the return spreads `...persisted` over `...currentState` wholesale, so **every
 * other field takes the disk's word for it**, including the one that decides
 * whether the athlete has an app at all.
 *
 * The asymmetry is the whole bug: someone saw the danger for the answers and
 * did not see that the FLAG saying those answers exist is the same danger.
 *
 * ## WHAT AN ATHLETE SEES
 *
 * `isOnboardingComplete` gates the app: false sends them back to onboarding.
 * So a bare disk plus a finished profile in memory means a finished athlete is
 * shown the first-run flow, with their program still sitting in the other
 * stores. Nothing throws. Nothing is logged as wrong.
 *
 * ## COMPLETION IS MONOTONIC WITHIN A PROCESS, AND THAT IS THE RULE
 *
 * Onboarding finishing is an EVENT. Nothing about reading the disk can un-do it
 * — only the athlete resetting can, and reset goes through its own door
 * (`resetProfile`), not through rehydration. So the merge may raise the flag
 * from the disk and may never lower it.
 *
 * Run: npm run test:profile-rehydration-cannot-unfinish
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
import { mergePersistedProfileState } from '../store/profileStore';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
  } catch (error) {
    failed += 1;
    failures.push(`${name}: ${(error as Error)?.message ?? String(error)}`);
  }
}

/** A finished athlete, in memory, mid-session. */
function finishedInMemory() {
  return {
    isOnboardingComplete: true,
    onboardingData: { name: 'Sam', position: 'Midfielder', age: 27 },
  } as never;
}

/** The 103-byte shell an interrupted wipe leaves on disk. */
const BARE_ENVELOPE = {
  isOnboardingComplete: false,
  onboardingData: {},
} as never;

// ── [1] THE DEFECT ITSELF ──────────────────────────────────────────────────

run('a bare envelope cannot un-finish a finished profile', () => {
  const merged = mergePersistedProfileState(BARE_ENVELOPE, finishedInMemory());
  assert(merged.isOnboardingComplete === true,
    'reading a bare profile envelope set `isOnboardingComplete` to false over a '
    + 'live true. That flag gates the whole app: the athlete is sent back to '
    + 'onboarding with their program still sitting in the other stores, and '
    + 'nothing throws or logs.');
});

run('and it cannot erase the answers either', () => {
  const merged = mergePersistedProfileState(BARE_ENVELOPE, finishedInMemory());
  assert(Object.keys(merged.onboardingData ?? {}).length === 3,
    `the live answers went from 3 to ${Object.keys(merged.onboardingData ?? {}).length}. `
    + 'This half was already protected before the fix; it is asserted so the '
    + 'protection cannot be lost while the new one is added.');
});

// ── [2] NON-VACUITY: THE MERGE STILL RESTORES ──────────────────────────────
//
// Cell [1] alone is satisfied by a merge that ignores the disk entirely, which
// would break every relaunch. Restoring IS the job; only the taking-away is
// forbidden.

run('a real envelope still finishes an unfinished live state', () => {
  const merged = mergePersistedProfileState(
    { isOnboardingComplete: true, onboardingData: { name: 'Sam' } } as never,
    { isOnboardingComplete: false, onboardingData: {} } as never,
  );
  assert(merged.isOnboardingComplete === true,
    'a relaunch no longer restores a finished profile — the guard was written '
    + 'as "ignore the disk" rather than "never go backwards"');
  assert((merged.onboardingData as { name?: string }).name === 'Sam',
    'the persisted answers no longer reach the live state on a cold start');
});

run('persisted answers still merge over live ones', () => {
  const merged = mergePersistedProfileState(
    { onboardingData: { name: 'Disk', age: 30 } } as never,
    { isOnboardingComplete: true, onboardingData: { name: 'Memory' } } as never,
  );
  const data = merged.onboardingData as { name?: string; age?: number };
  assert(data.name === 'Disk' && data.age === 30,
    `the disk stopped winning for answers it actually has (${JSON.stringify(data)}). `
    + 'A rehydration that ignored stored answers would lose every edit made '
    + 'before the last launch.');
});

// ── [3] THE OTHER FIELDS ARE NOT SILENTLY EXEMPT ──────────────────────────
//
// The founding asymmetry was that ONE field got care and the rest took the
// disk's word. Naming what is protected — and that it is deliberately narrow —
// stops the next reader assuming the merge is generally safe.

run('the rule is stated as monotonic completion, not as a field allow-list', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'store', 'profileStore.ts'), 'utf8');
  const owner = source.indexOf('export function mergePersistedProfileState');
  assert(owner > -1,
    'the merge is no longer a named exported function — this suite cannot reach '
    + 'it, and an inline zustand callback is a rule nothing can test '
    + '(anchoring law: prove the anchor was found)');
  const body = source.slice(owner, owner + 2500);
  assert(/isOnboardingComplete/.test(body),
    'the merge owner no longer mentions `isOnboardingComplete` — the one field '
    + 'whose reversal sends a finished athlete back to onboarding');
});

console.log(`\nprofile rehydration cannot unfinish: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFAILURES:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
totalsPrinted(failed);
process.exit(failed === 0 ? 0 : 1);
