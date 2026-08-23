/**
 * THE STRUCTURAL COMPLETION GATE — R5.8's sweep half
 * (`docs/SHELL_REBUILD_PLAN_2026-08-05.md` §7, approved 2026-08-05).
 *
 * The rebuild's completion condition is a PROPERTY, not a clean pass:
 *
 *   every persisted key's schema is in the inputs schema
 *
 * §2 says persistence holds exactly four classes of input and nothing else —
 * profile answers, life-facts, the decision ledger, training results. This
 * suite enumerates what actually reaches storage and fails on any key that is
 * not declared as one of the four. A new persisted OUTPUT cannot be added
 * without turning this red, which is the review the north star demands.
 *
 * WHY IT READS THE DISK AND NOT `partialize`. The property is about what is
 * PERSISTED, and `partialize` is only one of the ways a key gets there — the
 * athlete action log writes its own envelope with no zustand persist at all,
 * and was invisible to every enumeration in the repo until this suite measured
 * the storage layer instead of the source. A gate defined over
 * `persist(...)` stores is a gate over the writers someone remembered; a gate
 * defined over storage is a gate over the property. This is the
 * `gate-passing-on-coordinates-it-never-builds` shape, avoided by construction.
 *
 * TWO-DIRECTIONAL, which is what makes it a ratchet rather than a checklist. A
 * key on disk with no declaration reds (something new is being stored). A
 * declaration with no key on disk also reds (the declaration went stale and
 * would have quietly blessed a re-introduction). Neither list may drift.
 *
 * THE TWO DEBT LISTS ARE DECLARED, DATED AND SHRINK-ONLY — they are not
 * exemptions, they are the measured distance to the property:
 *
 *   1. COACH_ERA_KEYS — §7's named carry. Frozen until the coach rebuild;
 *      LR-6's STOP is why they are not being fixed here.
 *   2. TRANSIENT_STATE_DEBT — found by this suite, NOT carried by §7:
 *      `profile-store` persists `error` and `isLoading`. They are neither
 *      answers nor facts nor decisions nor results; they are render state on
 *      disk. Declared rather than fixed, because giving a store a `partialize`
 *      it never had is a behaviour change with its own hydration question, and
 *      it is not this sweep's to make silently.
 *   3. UNREGISTERED_PERSISTED_KEYS — `lfa.athlete-action-log.v1` reaches
 *      storage without a `PERSISTED_STORE_HYDRATION_REGISTRY` handle, so the
 *      boot gate never waits on it and `storedStateWriterAuditTests` never
 *      audits it.
 *
 * Each list carries a ceiling. A list may shrink; nothing may join it without
 * moving a number a reviewer has to look at.
 *
 * Run: npm run test:persisted-inputs-schema
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
  throw new Error('NETWORK DISABLED — this suite runs entirely on-device');
};

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import { PERSISTED_STORE_HYDRATION_REGISTRY } from '../store/appHydrationGate';
import { flushPendingStorageWrites } from '../store/asyncStorageCompat';
import { resetStoresToFreshInstall } from './support/freshInstallStores';

// ── §2's four classes, and nothing else ──────────────────────────────────
type InputClass = 'profile' | 'fact' | 'decision' | 'result';

/**
 * Every persisted key, declared against the class §2 puts it in. The nested
 * form `program-store.inputs.<key>` is used because `programStore.partialize`
 * writes one `inputs` object — declaring only `inputs` would let a seventh
 * key join it without this suite noticing, which is the whole failure mode.
 */
const DECLARED: Readonly<Record<string, InputClass>> = {
  // §2.1 profile answers
  'profile-store.onboardingData': 'profile',
  'profile-store.isOnboardingComplete': 'profile',
  'athlete-preferences-store.prefs': 'profile',
  'program-store.inputs.seasonPhaseClock': 'profile',

  // R-132: the session stopwatch. The timing acts are FACTS (timestamps the
  // athlete created; elapsed is derived); the ended measurement is a RESULT
  // the feedback form offers back.
  'session-stopwatch-store.current': 'fact',
  'session-stopwatch-store.lastEnded': 'result',

  // §2.2 life-facts — typed, dated
  'calendar-storage.markedDays': 'fact',
  'readiness-store.signalsByDate': 'fact',
  'program-store.inputs.injuryEpisodes': 'fact',
  'program-store.inputs.temporarySourceFacts': 'fact',

  // §2.3 the decision ledger. The generation anchor is a DECISION and boot
  // READS it (Sam, 2026-08-06) — the ruling that replaced the re-anchor bug.
  'decision-ledger-store.entries': 'decision',
  'program-store.inputs.generationAnchorISO': 'decision',
  /**
   * ACCEPTING A BLOCK IS A DECISION, and this is what that decision recorded:
   * the block's identity (its number) and what it required of the athlete.
   *
   * Classed with `generationAnchorISO` because it is the same shape of fact and
   * for the same reason — recorded at the moment a program is ACCEPTED, read by
   * boot, and **not re-derivable afterwards**, because the program it describes is
   * gone by the time anyone asks. Sam ruled it 2026-08-18: *"persisted when that
   * block is accepted and restored before boot regenerates the program … Once
   * Block 2 is accepted, restart must never infer or reset them to Block 1."*
   *
   * It is NOT a `result`: `sessionFeedback` and `weightOverrides` are what the
   * athlete DID, whereas this is what the app COMMITTED to give them.
   */
  'program-store.inputs.acceptedBlocks': 'decision',

  // §2.4 training results — what was done
  'program-store.inputs.sessionFeedback': 'result',
  'program-store.inputs.weightOverrides': 'result',
};

/** §7's named carry: frozen until the coach rebuild, under LR-6's STOP. */
const COACH_ERA_KEYS: readonly string[] = [
  'coach-store.activeConversation',
  'coach-store.conversations',
  'coach-store.error',
  'coach-store.isLoading',
  'coach-store.isStreaming',
  'coach-store.messages',
  'coach-memory-store.notes',
  'coach-mutation-history-store.entries',
  'coach-preferences-store.modalityPreferences',
  'coach-updates.activeConstraints',
  'coach-updates.activeInjury',
  'coach-updates.dismissedCoachNoteIds',
  'coach-updates.updatesByWeek',
];
const COACH_ERA_CEILING = 13; // dated 2026-08-06. Shrinks only.

/** Render state on disk. Found by this suite; NOT one of §7's carries. */
const TRANSIENT_STATE_DEBT: readonly string[] = [
  'profile-store.error',
  'profile-store.isLoading',
];
const TRANSIENT_STATE_CEILING = 2; // dated 2026-08-06. Shrinks only.

/** Reaches storage with no registry handle, so the boot gate never waits. */
const UNREGISTERED_PERSISTED_KEYS: readonly string[] = [
  'lfa.athlete-action-log.v1',
];
const UNREGISTERED_CEILING = 1; // dated 2026-08-06. Shrinks only.

let passed = 0;
let failed = 0;
const failures: string[] = [];

function run(name: string, body: () => void): void {
  try {
    body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL ${name}`);
    console.log(`      ${message}`);
  }
}

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  const debug = console.debug; const info = console.info;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.debug = () => {}; console.info = () => {};
  try { return body(); } finally {
    console.log = log; console.warn = warn; console.error = error;
    console.debug = debug; console.info = info;
  }
}

/** Every dotted key actually on disk, measured from the storage layer. */
function measurePersistedKeys(): { keys: string[]; envelopeKeys: string[] } {
  const keys: string[] = [];
  for (const envelopeKey of Array.from(durable.keys()).sort()) {
    const raw = durable.get(envelopeKey)!;
    let state: Record<string, unknown> | undefined;
    try {
      state = (JSON.parse(raw) as { state?: Record<string, unknown> }).state;
    } catch {
      state = undefined;
    }
    if (!state) continue; // non-zustand envelope; covered by cell 2 on its key
    for (const stateKey of Object.keys(state).sort()) {
      const dotted = `${envelopeKey}.${stateKey}`;
      // `program-store` writes one `inputs` object; declare its members.
      const value = state[stateKey];
      if (envelopeKey === 'program-store' && stateKey === 'inputs'
        && value && typeof value === 'object' && !Array.isArray(value)) {
        for (const nested of Object.keys(value as object).sort()) {
          keys.push(`${dotted}.${nested}`);
        }
        continue;
      }
      keys.push(dotted);
    }
  }
  return { keys, envelopeKeys: Array.from(durable.keys()).sort() };
}

console.log('\n[R5.8 §7] THE STRUCTURAL COMPLETION GATE');

quiet(() => resetStoresToFreshInstall('persisted-inputs-schema:fresh-install'));

async function main(): Promise<void> {
  await flushPendingStorageWrites();
  const { keys, envelopeKeys } = measurePersistedKeys();
  const registryKeys = PERSISTED_STORE_HYDRATION_REGISTRY.map((store) => store.key).sort();
  const accountedFor = new Set<string>([
    ...Object.keys(DECLARED), ...COACH_ERA_KEYS, ...TRANSIENT_STATE_DEBT,
  ]);

  console.log(`\n  measured: ${envelopeKeys.length} envelopes, ${keys.length} persisted keys`);

  run('every persisted key is declared as profile / fact / decision / result, '
    + 'or carried on a dated list', () => {
    const undeclared = keys.filter((key) => !accountedFor.has(key));
    assert(undeclared.length === 0,
      `${undeclared.length} persisted key(s) are stored and declared NOWHERE:\n      `
      + `${undeclared.join('\n      ')}\n      `
      + 'Plan §2: persistence holds exactly four classes of input and nothing '
      + 'else. A key that reaches storage without a class is a stored OUTPUT '
      + 'until someone says otherwise — declare it, or stop persisting it.');
  });

  run('no declaration is stale — every declared key is actually on disk', () => {
    const missing = Array.from(accountedFor).filter((key) => !keys.includes(key)).sort();
    assert(missing.length === 0,
      `${missing.length} declared key(s) no longer reach storage:\n      `
      + `${missing.join('\n      ')}\n      `
      + 'A stale declaration is not harmless: it silently pre-blesses the key '
      + 'if it ever comes back. Delete the entry in the commit that removed '
      + 'the write.');
  });

  run('every storage envelope belongs to a registered store, or is declared '
    + 'unregistered', () => {
    const strays = envelopeKeys.filter((key) =>
      !registryKeys.includes(key) && !UNREGISTERED_PERSISTED_KEYS.includes(key));
    assert(strays.length === 0,
      `${strays.length} envelope(s) reach storage with no hydration registry `
      + `handle:\n      ${strays.join('\n      ')}\n      `
      + 'The boot gate waits on the registry, so an unregistered envelope is a '
      + 'key nothing waits for and nothing audits.');
  });

  run('the declared UNREGISTERED envelopes are all still real', () => {
    const gone = UNREGISTERED_PERSISTED_KEYS.filter((key) => !envelopeKeys.includes(key));
    assert(gone.length === 0,
      `${gone.length} unregistered envelope(s) no longer appear — the debt was `
      + `paid and the entry owes its deletion:\n      ${gone.join('\n      ')}`);
  });

  run('the coach-era carry has not grown', () => {
    const live = COACH_ERA_KEYS.filter((key) => keys.includes(key));
    assert(live.length <= COACH_ERA_CEILING,
      `the coach-era list holds ${live.length} live keys against a ceiling of `
      + `${COACH_ERA_CEILING}. It is frozen until the coach rebuild and may `
      + 'only shrink.');
    assert(COACH_ERA_KEYS.length <= COACH_ERA_CEILING,
      `the coach-era list itself has grown to ${COACH_ERA_KEYS.length} entries `
      + `against its dated ceiling of ${COACH_ERA_CEILING} — a new coach key was `
      + 'added to the exception list instead of being questioned.');
  });

  run('the transient-state debt has not grown', () => {
    assert(TRANSIENT_STATE_DEBT.length <= TRANSIENT_STATE_CEILING,
      `${TRANSIENT_STATE_DEBT.length} transient keys against a ceiling of `
      + `${TRANSIENT_STATE_CEILING}. Render state does not belong on disk; this `
      + 'list shrinks or the ceiling drops in the same commit.');
    const live = TRANSIENT_STATE_DEBT.filter((key) => keys.includes(key));
    assert(live.length === TRANSIENT_STATE_DEBT.length,
      'a transient-state debt entry no longer reaches storage — it was paid, '
      + 'and the entry plus the ceiling owe their drop in that commit: '
      + `${TRANSIENT_STATE_DEBT.filter((k) => !keys.includes(k)).join(', ')}`);
  });

  run('the unregistered-envelope debt has not grown', () => {
    assert(UNREGISTERED_PERSISTED_KEYS.length <= UNREGISTERED_CEILING,
      `${UNREGISTERED_PERSISTED_KEYS.length} unregistered envelopes against a `
      + `ceiling of ${UNREGISTERED_CEILING}.`);
  });

  run('no persisted key is classified into two classes at once', () => {
    const collisions = Object.keys(DECLARED).filter((key) =>
      COACH_ERA_KEYS.includes(key) || TRANSIENT_STATE_DEBT.includes(key));
    assert(collisions.length === 0,
      `${collisions.length} key(s) are both declared and carried as debt, so `
      + `the gate would pass them twice and shrink neither:\n      `
      + collisions.join('\n      '));
  });

  // The distance to §7's property, printed so it cannot be lost in a totals line.
  const debtTotal = COACH_ERA_KEYS.length + TRANSIENT_STATE_DEBT.length
    + UNREGISTERED_PERSISTED_KEYS.length;
  console.log(`\n  DISTANCE TO THE PROPERTY: ${Object.keys(DECLARED).length} keys `
    + `declared in the inputs schema, ${debtTotal} carried as dated debt `
    + `(coach-era ${COACH_ERA_KEYS.length}, transient ${TRANSIENT_STATE_DEBT.length}, `
    + `unregistered ${UNREGISTERED_PERSISTED_KEYS.length}).`);
  console.log('  §7 is met when the debt total reaches 0.');

  console.log(`\nPersisted inputs schema totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('persisted inputs schema suite THREW outside a cell', error);
  totalsPrinted(failed + 1);
  process.exit(1);
});
