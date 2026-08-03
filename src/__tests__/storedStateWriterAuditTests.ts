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

import fs from 'fs';
import path from 'path';
import { PERSISTED_STORE_HYDRATION_REGISTRY } from '../store/appHydrationGate';
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
  'coach-store',
  'coach-memory-store',
  'ui-store',
  'auth-store',
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
  // case-insensitively (`programHydrationIngress.ts` names the ingress lift).
  const offenders = walkSrc().filter((f) =>
    !f.toLowerCase().includes('hydration') &&
    !f.endsWith('storedStateWriterAuditTests.ts') &&
    read(f).match(/repeat_week|repeatWeek/i)
  );
  assert(offenders.length === 0, `repeat-week survives in: ${offenders.join(', ')}`);
});

console.log(`\nStored-state writer audit totals: ${passed} passed, ${failed} failed`);
console.log(`  protected: ${JSON.stringify(quarantineBoundaryKeys())}`);
console.log(`  declared debt: ${UNPROTECTED_STORES_DEBT.length} store(s) still wipeable`);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
