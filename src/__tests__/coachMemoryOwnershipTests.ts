/**
 * COACH MEMORY STORE OWNERSHIP — the store-armour recipe, fleet wave 2a.
 *
 * `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`. A coach note is durable memory
 * about THIS athlete — "prefers morning sessions", "hamstring niggle, avoid
 * sprint volume" — extracted from what the athlete told the coach. Losing the
 * notes silently un-tells the coach everything the athlete taught it. This
 * suite holds the four protections: one door (`applyCoachMemoryWrite`) with
 * typed refusals, every write on the tape, a quarantine boundary at the
 * persistence writer, and a build failure on any writer around the owner.
 *
 * LR-6 note: store-ownership work only, allowed under Sam's sequencing ruling.
 * What the coach pipeline decides to remember is unchanged — `addNote`,
 * `removeNote` and `clearNotes` become thin builders of the one door.
 *
 * Lesson 11 is pinned here on its FOUNDING store shape: removing the last
 * note is the athlete's change, not the wipe — it lands under a named
 * erasure act instead of being refused.
 *
 * Run: npm run test:coach-memory-ownership
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
  useCoachMemoryStore,
  applyCoachMemoryWrite,
  beginCoachMemoryResetAction,
  endCoachMemoryResetAction,
  coachMemoryGuardedStorage,
  COACH_MEMORY_PERSISTENCE_KEY,
  type CoachNote,
} from '../store/coachMemoryStore';
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

/** REAL note text, so the privacy assertions test the values that matter. */
const NOTE_ONE = 'Athlete prefers morning sessions and hates burpees';
const NOTE_TWO = 'Hamstring niggle reported 2026-08-03 — keep sprint volume low';

function materialNote(id: string, note: string): CoachNote {
  return { id, note, createdAt: new Date().toISOString() };
}

/** Empty the notes through the door with a reset act. */
function resetNotes(): void {
  const id = beginCoachMemoryResetAction('test_reset');
  try {
    applyCoachMemoryWrite({ next: [], writer: 'reset', resetActionId: id });
  } finally {
    endCoachMemoryResetAction(id);
  }
}

console.log('\n-- Coach memory ownership (store-armour recipe, wave 2a) --');

run('the door refuses the default over answered notes', () => {
  resetNotes();
  clearAllQuarantines();
  // Acted through the store's own action — the real writer. The store's
  // PRE-EXISTING id scheme is `Date.now().toString()` (untouched under LR-6),
  // so two notes acted in the same millisecond would share an id; a real
  // athlete cannot type two notes in one ms, and the removal cell below needs
  // the ids distinct, so wait out the tick between them.
  useCoachMemoryStore.getState().addNote(NOTE_ONE);
  const tick = Date.now();
  while (Date.now() === tick) { /* one-ms spin — see the comment above */ }
  useCoachMemoryStore.getState().addNote(NOTE_TWO);
  const before = JSON.stringify(useCoachMemoryStore.getState().notes);

  const outcome = applyCoachMemoryWrite({ next: [], writer: 'coach_screen' });
  assert(!outcome.ok && outcome.reason === 'default_over_answered_notes',
    `the wipe shape was not refused: ${JSON.stringify(outcome)}`);
  assert(JSON.stringify(useCoachMemoryStore.getState().notes) === before,
    'the refused write changed the store anyway');
});

run('a stale reset id is refused', () => {
  const id = beginCoachMemoryResetAction('test_stale');
  endCoachMemoryResetAction(id);
  const outcome = applyCoachMemoryWrite({
    next: [],
    writer: 'reset',
    resetActionId: id,
  });
  assert(!outcome.ok && outcome.reason === 'reset_action_not_in_flight',
    `a finished reset's id still erased the store: ${JSON.stringify(outcome)}`);
  assert(useCoachMemoryStore.getState().notes.length === 2,
    'the stale-reset write emptied the store');
});

run('removing a note is a decision; removing the LAST note is a named erasure (lesson 11)', () => {
  const notes = useCoachMemoryStore.getState().notes;
  assert(notes.length === 2, `precondition: expected the two acted-in notes, got ${notes.length}`);

  // Removing one of two is a reduction — a plain applied write.
  let from = athleteActionLogEntries().length;
  useCoachMemoryStore.getState().removeNote(notes[0]!.id);
  assert(useCoachMemoryStore.getState().notes.length === 1,
    'removing a non-last note did not land');
  let writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'coach_memory_write');
  assert(writes.length === 1 && writes[0]!.outcome === 'applied'
    && writes[0]!.erasureActId === undefined,
    `a mid-list removal should be a plain applied write: ${JSON.stringify(writes)}`);

  // Removing the last one empties the store — the athlete's change, not the
  // wipe. It lands, and declares the erasure under `erasureActId` (lesson 12:
  // any key containing "set" is eaten by the diagnostics filter).
  from = athleteActionLogEntries().length;
  useCoachMemoryStore.getState().removeNote(useCoachMemoryStore.getState().notes[0]!.id);
  assert(useCoachMemoryStore.getState().notes.length === 0,
    'removing the last note was refused — the athlete is stranded with a note they cannot take back');
  writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'coach_memory_write');
  assert(writes.length === 1 && writes[0]!.outcome === 'applied'
    && typeof writes[0]!.erasureActId === 'string'
    && String(writes[0]!.erasureActId).includes('remove_note'),
    `the last-note removal is not a named erasure on the tape: ${JSON.stringify(writes)}`);
  assert(!('resetActionId' in writes[0]!),
    'the act travelled under a key the diagnostics filter eats — use erasureActId');
});

run('an in-flight reset erases, and says so', () => {
  useCoachMemoryStore.getState().addNote(NOTE_ONE);
  const from = athleteActionLogEntries().length;
  useCoachMemoryStore.getState().clearNotes();
  assert(useCoachMemoryStore.getState().notes.length === 0,
    'the reset did not empty the store');
  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'coach_memory_write');
  assert(writes.length === 1 && writes[0]!.writer === 'reset'
    && writes[0]!.outcome === 'applied'
    && typeof writes[0]!.erasureActId === 'string'
    && String(writes[0]!.erasureActId).includes('coach_memory_store_clear'),
    `the reset write is not named on the tape: ${JSON.stringify(writes)}`);
});

run('every coach-memory write is on the tape, refused or not — counts, never notes', () => {
  useCoachMemoryStore.getState().addNote(NOTE_ONE);
  useCoachMemoryStore.getState().addNote(NOTE_TWO);
  const from = athleteActionLogEntries().length;

  const refused = applyCoachMemoryWrite({ next: [], writer: 'coach_screen' });
  assert(!refused.ok, 'precondition: the wipe shape must refuse');
  useCoachMemoryStore.getState().addNote('Third note: enjoys long zone 2 rides');

  const writes = athleteActionLogEntries().slice(from)
    .filter((entry) => entry.event === 'coach_memory_write');
  assert(writes.length === 2, `the tape saw ${writes.length} of 2 coach-memory writes`);
  assert(writes[0]!.outcome === 'refused'
    && writes[0]!.writer === 'coach_screen'
    && writes[0]!.internalResultCode === 'default_over_answered_notes',
    `the refused write is not named on the tape: ${JSON.stringify(writes[0])}`);
  assert(writes[1]!.outcome === 'applied'
    && writes[1]!.noteCountBefore === 2 && writes[1]!.noteCountAfter === 3,
    `the tape does not record the counts either side: ${JSON.stringify(writes[1])}`);

  // PRIVACY, asserted with the real acted-in notes: what the coach remembers
  // about the athlete is an answer and never travels. Dates too.
  const serialised = JSON.stringify(writes);
  assert(!/burpees|Hamstring|sprint volume|morning sessions|zone 2/i.test(serialised),
    `note text reached the tape: ${serialised}`);
  assert(!/\d{4}-\d{2}-\d{2}/.test(serialised.replace(/"at":"[^"]*"/g, '')),
    `a DATE reached the tape: ${serialised}`);
});

run('no writer can reach the notes around the owner', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const storeSource = fs.readFileSync(path.join(srcRoot, 'store', 'coachMemoryStore.ts'), 'utf8');
  const ownerStart = storeSource.indexOf('export function applyCoachMemoryWrite');
  assert(ownerStart > 0, 'the coach-memory write owner is gone');

  const setStateCalls = storeSource.split('useCoachMemoryStore.setState(').length - 1;
  assert(setStateCalls === 1,
    `${setStateCalls} direct setState calls in coachMemoryStore — exactly one, the owner's, may exist`);
  const ownerEnd = storeSource.indexOf('\n}\n', ownerStart);
  const setStateAt = storeSource.indexOf('useCoachMemoryStore.setState(');
  assert(setStateAt > ownerStart && setStateAt < ownerEnd,
    `the one setState (offset ${setStateAt}) is outside the write owner (${ownerStart}..${ownerEnd})`);

  // No bare `set(` may carry the notes at all — this store has no UI-only
  // slice, so the actions have nothing left to `set` directly.
  for (const match of storeSource.matchAll(/\bset\(/g)) {
    const window = storeSource.slice(match.index!, match.index! + 400);
    assert(!window.includes('notes:'),
      `a store action assigns notes directly around offset ${match.index}: `
      + window.slice(0, 120));
  }

  // REPO-WIDE INCLUDING TESTS — declared per recipe lesson 4: zero suites
  // seed this store, so the widest sweep scope costs nothing.
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
      if (relative === path.join('store', 'coachMemoryStore.ts')) continue;
      // This suite's own sweep carries the search string as a literal — the
      // law statement, not a surviving writer (the audit suite's precedent).
      if (relative === path.join('__tests__', 'coachMemoryOwnershipTests.ts')) continue;
      if (fs.readFileSync(full, 'utf8').includes('useCoachMemoryStore.setState(')) {
        offenders.push(relative);
      }
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `file(s) write the coach memory store around the owner: ${offenders.join(', ')}`);
});

run('the writer boundary refuses a bare payload over a held one', async () => {
  resetNotes();
  clearAllQuarantines();
  assert(quarantineBoundaryKeys().includes(COACH_MEMORY_PERSISTENCE_KEY),
    'the coach memory store never registered its writer boundary');

  const material = JSON.stringify({
    state: { notes: [materialNote('n1', NOTE_ONE)] },
    version: 0,
  });
  const bare = JSON.stringify({ state: { notes: [] }, version: 0 });

  await coachMemoryGuardedStorage.setItem(COACH_MEMORY_PERSISTENCE_KEY, material);
  quarantineRefusedPayload(COACH_MEMORY_PERSISTENCE_KEY, material);
  await coachMemoryGuardedStorage.setItem(COACH_MEMORY_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await coachMemoryGuardedStorage.getItem(COACH_MEMORY_PERSISTENCE_KEY) === material,
    'a bare payload overwrote a quarantined one — this is the wipe');

  await coachMemoryGuardedStorage.setItem(COACH_MEMORY_PERSISTENCE_KEY, material);
  await flushPendingStorageWrites();
  assert(await coachMemoryGuardedStorage.getItem(COACH_MEMORY_PERSISTENCE_KEY) === material,
    'a material payload was refused while quarantined — that strands the athlete');
  await coachMemoryGuardedStorage.setItem(COACH_MEMORY_PERSISTENCE_KEY, bare);
  await flushPendingStorageWrites();
  assert(await coachMemoryGuardedStorage.getItem(COACH_MEMORY_PERSISTENCE_KEY) === bare,
    'the hold outlived the material write that should have released it');
  clearAllQuarantines();
});

void Promise.all(pendingAsync).then(() => {
  console.log(`\nCoach memory ownership totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
});
