/**
 * L12 — WHAT CATCHES THE NEXT REFUSE-THEN-OVERWRITE, IN ANY STORE.
 *
 * The wipe has now happened twice: `profileStore` (2026-07-24, the mirror wipe)
 * and `programStore` (2026-07-29, this unit). Fixing the second one is not an
 * answer to the class — an answer has to say what stops the third, in a store
 * nobody has looked at yet.
 *
 * SAM'S ANSWER, WHICH THIS SUITE ENFORCES: the law is PER STORE, not per call.
 * Every persisted store declares ONE writer boundary that refuses to persist
 * while that store holds a refused payload. A store with no boundary cannot obey
 * the law, so the audit's job is to enumerate every persisted store and name the
 * ones that currently cannot.
 *
 * WHY AN ENUMERATION AND NOT A SPOT-CHECK. The wipe was never a bad caller — it
 * was the ABSENCE of anything between a bare fallback and the disk. An absence
 * is invisible to any test that checks a store it already thought about, which is
 * how the same defect reached a second store after the first was fixed and
 * documented. This suite reads the boot registry — the same list
 * `appHydrationGate` gates on, which `onboardingReliabilityTests` D1 already
 * pins as complete — so a NEW persisted store cannot escape the audit by not
 * being remembered here.
 *
 * The unprotected stores are listed as a DECLARED DEBT rather than a silent
 * pass. Shrinking that list is the unit's own ratchet: a store may leave it, and
 * nothing may join it.
 *
 * Run: npm run test:stored-state-writer-audit
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
  PERSISTED_STORE_HYDRATION_REGISTRY,
  RETIRED_STORE_PERSIST_KEYS,
  removeRetiredStoreEnvelopes,
} from '../store/appHydrationGate';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';
import {
  clearAllQuarantines,
  decideQuarantinedWrite,
  quarantineBoundaryKeys,
  quarantineRefusedPayload,
  registerQuarantineBoundary,
} from '../store/refusedPayloadQuarantine';

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
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

const srcRoot = path.resolve(__dirname, '..');

/** Every .ts/.tsx file under src/, repo-relative paths, node_modules excluded. */
function walkSrc(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (/\.tsx?$/.test(entry.name)) out.push(path.relative(srcRoot, full));
    }
  };
  walk(srcRoot);
  return out;
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

/**
 * Persisted stores with NO writer boundary yet — the declared debt.
 *
 * A store on this list can still be wiped by a refuse-then-overwrite. It is
 * written down so that fact is visible instead of implied, and the ratchet below
 * makes the list one-way: entries may be deleted as boundaries are added, and
 * adding one requires editing this constant, which is a decision somebody has to
 * make on purpose.
 *
 * `program-store` is deliberately absent: it is the store this unit protected.
 */
const UNPROTECTED_STORES_DEBT: readonly string[] = [
];

console.log('\n-- Stored-state writer audit (L12) --');

run('every persisted store is either protected or a declared debt', () => {
  const persisted = PERSISTED_STORE_HYDRATION_REGISTRY.map((store) => store.key).sort();
  const protectedKeys = new Set(quarantineBoundaryKeys());
  const unaccounted = persisted.filter((key) =>
    !protectedKeys.has(key) && !UNPROTECTED_STORES_DEBT.includes(key));
  assert(unaccounted.length === 0,
    `persisted store(s) with no writer boundary and no declared debt: `
    + `${JSON.stringify(unaccounted)}. A new persisted store inherits the wipe `
    + 'until someone decides otherwise — declare a boundary or add it to the '
    + 'debt list on purpose.');
});

run('the debt list is a ratchet — nothing on it is already protected', () => {
  const protectedKeys = new Set(quarantineBoundaryKeys());
  const stale = UNPROTECTED_STORES_DEBT.filter((key) => protectedKeys.has(key));
  assert(stale.length === 0,
    `${JSON.stringify(stale)} now has a writer boundary but is still listed as `
    + 'unprotected. Delete it from UNPROTECTED_STORES_DEBT — a debt list that '
    + 'lags reality stops being read.');
});

run('the debt names only stores that actually exist', () => {
  const persisted = new Set(PERSISTED_STORE_HYDRATION_REGISTRY.map((store) => store.key));
  const phantom = UNPROTECTED_STORES_DEBT.filter((key) => !persisted.has(key));
  assert(phantom.length === 0,
    `the debt list names store(s) that are not persisted: ${JSON.stringify(phantom)}`);
});

run('the program store has a writer boundary', () => {
  // Non-vacuity for the audit itself: if registration silently stopped
  // happening, every cell above would pass by finding nothing protected and
  // everything excused.
  require('../store/programStore');
  assert(quarantineBoundaryKeys().includes('program-store'),
    'the program store — the one this unit protected — has no registered writer '
    + 'boundary, so the audit is measuring nothing');
});

run('a boundary refuses a bare payload and admits a material one', () => {
  // THE LAW ITSELF, asserted on the owner rather than through one store, so it
  // holds the same way for whichever store adopts it next.
  clearAllQuarantines();
  const key = 'audit-fixture-store';
  registerQuarantineBoundary(key, {
    carriesMaterial: (envelope) => envelope.includes('"material":true'),
  });
  const real = '{"material":true,"who":"the athlete"}';
  const bare = '{"material":false}';

  assert(decideQuarantinedWrite(key, bare).allowed,
    'a bare write was refused with nothing quarantined — the boundary must be '
    + 'inert until a refusal actually happens');

  quarantineRefusedPayload(key, real);
  assert(!decideQuarantinedWrite(key, bare).allowed,
    'a bare payload was allowed to overwrite a quarantined one — this is the wipe');
  assert(decideQuarantinedWrite(key, real).allowed,
    'a material payload was refused while quarantined — that strands the athlete '
    + 'instead of protecting them, and blocks the very lift that resolves it');

  clearAllQuarantines();
  assert(decideQuarantinedWrite(key, bare).allowed,
    'the hold outlived its quarantine');
});

run('quarantine holds nothing when there is nothing to hold', () => {
  // A fresh install must be completely unaffected. Sam's closing device check is
  // delete-the-app-and-onboard, and a quarantine that armed itself on an empty
  // store would block his first write.
  clearAllQuarantines();
  const key = 'audit-empty-store';
  registerQuarantineBoundary(key, {
    carriesMaterial: (envelope) => envelope.includes('"material":true'),
  });
  quarantineRefusedPayload(key, null);
  quarantineRefusedPayload(key, '{"material":false}');
  assert(decideQuarantinedWrite(key, '{"material":false}').allowed,
    'quarantining an empty payload armed the boundary — a refusal with nothing '
    + 'to protect must protect nothing');
});

run('repeat-week has no writer and no surface (HOME_SCREEN_REDESIGN ruling 1)', () => {
  // This suite's own name and assertion text are exempt — they are the law
  // statement, not a surviving surface. The hydration exemption is matched
  // case-insensitively (`programHydrationProjection.ts` names the read lift).
  // The retired-overlay DROPPER went with `programHydrationIngress.ts` on
  // 2026-08-19; it had zero production callers, so this law is now held by
  // there being no writer at all rather than by a filter at hydration.
  const offenders = walkSrc().filter((f) =>
    !f.toLowerCase().includes('hydration') &&
    !f.endsWith('storedStateWriterAuditTests.ts') &&
    read(f).match(/repeat_week|repeatWeek/i)
  );
  assert(offenders.length === 0, `repeat-week survives in: ${offenders.join(', ')}`);
});

/* ── The shell retirement (Sam's §6 ruling, 2026-08-03) ──────────────────────
 *
 * authStore and uiStore retired WHOLE: both persisted only never-written
 * defaults (no reachable screen ever wrote either, verified back to the MVP
 * commit) — stored non-decisions under the north star. The L15 read-ingress
 * lift for a shape that never carried a value is DELETION at boot
 * (`removeRetiredStoreEnvelopes` in appHydrationGate).
 *
 * These pins live HERE and not only in `onboardingReliabilityTests` D1b
 * because that suite silently exits 0 after its B1 cell on clean main (a
 * pre-existing LR-14 silent-suite defect, A/B-proven in a detached worktree
 * on 2026-08-03 and parked as §9) — a pin in a dead block holds nothing.
 * This suite runs, is in `test:bible`, and already audits the boot registry.
 */

run('the retired shells stay retired — gone from src, gone from the registry', () => {
  assert(
    RETIRED_STORE_PERSIST_KEYS.length === 2
      && RETIRED_STORE_PERSIST_KEYS.includes('auth-store')
      && RETIRED_STORE_PERSIST_KEYS.includes('ui-store'),
    `the retired-key list drifted: ${JSON.stringify(RETIRED_STORE_PERSIST_KEYS)}. `
    + 'Shrinking it is a rebuild landing (fine, with the store re-registered '
    + 'armoured); growing it is a NEW retirement that needs its own ruling.');
  const registered = new Set(PERSISTED_STORE_HYDRATION_REGISTRY.map((s) => s.key));
  const cameBack = RETIRED_STORE_PERSIST_KEYS.filter((key) => registered.has(key));
  assert(cameBack.length === 0,
    `retired key(s) re-registered while still on the retired list: `
    + `${JSON.stringify(cameBack)}. A rebuilt store leaves `
    + 'RETIRED_STORE_PERSIST_KEYS in the same commit it registers, or boot '
    + 'eats its state.');
  const survivors = walkSrc().filter((f) =>
    f === 'store/authStore.ts' || f === 'store/uiStore.ts');
  assert(survivors.length === 0,
    `retired store file(s) back in src: ${survivors.join(', ')} — a rebuild `
    + 'arrives armoured (STORE_ARMOUR_RECIPE) and registered, not as the shell');
});

run('boot removes the retired envelopes before the app settles (static pin)', () => {
  // Shape-coupled by design (a tripwire, not the proof — the behavioural cell
  // below is the proof the remover removes; this one pins that BOOT calls it).
  const gate = read('store/appHydrationGate.ts');
  const settleIdx = gate.indexOf('settlement = (async () => {');
  const cleanupIdx = gate.indexOf('await removeRetiredStoreEnvelopes()');
  const outcomesIdx = gate.indexOf('const outcomes = await Promise.all(');
  assert(settleIdx >= 0, 'awaitAppHydration settlement block not found — the pin needs re-aiming');
  assert(cleanupIdx > settleIdx && (outcomesIdx === -1 || cleanupIdx < outcomesIdx),
    'awaitAppHydration no longer awaits removeRetiredStoreEnvelopes() before '
    + 'settling — a stale retired envelope would be readable again, which L15 forbids');
});

async function runRetiredEnvelopeCell(): Promise<void> {
  const name = 'a stale retired envelope does not survive the remover';
  try {
    for (const key of RETIRED_STORE_PERSIST_KEYS) {
      durable.set(key, JSON.stringify({ state: {}, version: 0 }));
    }
    await removeRetiredStoreEnvelopes();
    await flushPendingStorageWrites();
    const survivors = RETIRED_STORE_PERSIST_KEYS.filter((key) => durable.has(key));
    assert(survivors.length === 0,
      `retired envelope(s) survived the remover: ${survivors.join(', ')}`);
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

// A dropped or hanging tail must NOT read as green: the process is red until
// the totals actually print (the exact silent-exit-0 shape found in
// onboardingReliabilityTests on 2026-08-03, parked as §9). The arm itself now
// lives at module top, under the shared TOTALS-OR-RED owner.
void runRetiredEnvelopeCell().then(() => {
  console.log(`\nStored-state writer audit totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  console.log(`  protected: ${JSON.stringify(quarantineBoundaryKeys())}`);
  console.log(`  declared debt: ${UNPROTECTED_STORES_DEBT.length} store(s) still wipeable`);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
});
