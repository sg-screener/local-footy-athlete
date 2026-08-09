(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const disk = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => { disk.set(key, value); },
    removeItem: (key: string) => { disk.delete(key); },
    clear: () => { disk.clear(); },
  },
};
process.env.TZ = 'Australia/Melbourne';

/**
 * THE JOURNAL NOTE STORE — one ownership suite, per the store-armour recipe
 * (`docs/STORE_ARMOUR_RECIPE_2026-08-03.md` §4).
 *
 * This store is armoured AT BIRTH rather than retro-fitted, so this suite's job
 * is to keep it that way. The recipe's own lesson is that a store gains writers
 * around its door in the weeks before anyone gets round to the armour.
 *
 * VERIFICATION STRATEGY (L12). The classes this store can fail in, and the cell
 * group that owns each:
 *
 *   [1] THE DOOR CAN BE BYPASSED. A new writer calls `setState` directly and
 *       the refusals never run. Gated by a SOURCE SWEEP over all of `src/`,
 *       written per AGENTS.md's anchoring law: locate the region, prove it was
 *       found, then assert.
 *   [2] THE WIPE SHAPE. Emptying answered notes without an in-flight reset is
 *       the profile-loss shape this whole recipe exists for. Both refusals are
 *       asserted, and — the half that matters — the state must SURVIVE.
 *   [3] THE TAPE CAN CARRY ANSWERS. A note's TEXT is the athlete's own words.
 *       Counts and labels only; the serialized entries must contain no note
 *       text and no tag.
 *   [4] THE VOCABULARY CAN GROW. Tags are a closed union; a surface must not be
 *       able to introduce one.
 *   [5] THE NOTE CAN LEAK INTO THE PROGRAM. The design's non-negotiable: notes
 *       never derive program state. Gated by asserting no rules/ or resolver
 *       module reads this store at all.
 *
 * Run: npm run test:journal-note-ownership
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import {
  JOURNAL_NOTE_TAGS,
  applyJournalNoteWrite,
  beginJournalNoteResetAction,
  endJournalNoteResetAction,
  getJournalNotes,
  journalNoteWeekCount,
  parseJournalNoteTag,
  recordJournalNote,
  removeJournalNote,
  useJournalNoteStore,
  type JournalNote,
} from '../store/journalNoteStore';
import { athleteActionLogEntries } from '../utils/athleteActionLog';

const SRC = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}
function run(name: string, body: () => void): void {
  try { body(); passed += 1; console.log(`  PASS ${name}`); }
  catch (error) {
    failed += 1; failures.push(name);
    console.error(`  FAIL ${name}\n      ${error instanceof Error ? error.message : error}`);
  }
}

function reset(): void {
  const id = beginJournalNoteResetAction('suite_setup');
  try { applyJournalNoteWrite({ next: [], writer: 'reset', resetActionId: id }); }
  finally { endJournalNoteResetAction(id); }
}

const NOTE_TEXT = 'Busy week at work but felt much better than expected on Saturday.';

function seedOneNote(): JournalNote {
  reset();
  const outcome = recordJournalNote({
    weekStart: '2026-08-10',
    text: NOTE_TEXT,
    tags: ['work_stress', 'recovery'],
    nowISO: '2026-08-10T09:00:00.000Z',
  });
  assert(outcome.ok && outcome.note, 'seed failed — the door refused a legitimate note');
  return outcome.note;
}

console.log('\n-- Journal note ownership (store-armour recipe) --');

// ─── [1] ONE DOOR ────────────────────────────────────────────────────────

console.log('\n[1] ONE DOOR');

run('no module outside the store writes the notes slice', () => {
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (full.endsWith(path.join('store', 'journalNoteStore.ts'))) continue;
      const text = readFileSync(full, 'utf8');
      if (!/useJournalNoteStore/.test(text)) continue;
      // A raw setState on this store, or a direct call to the write owner.
      if (/useJournalNoteStore\.setState\s*\(/.test(text)
        || /\bapplyJournalNoteWrite\s*\(/.test(text)) {
        offenders.push(path.relative(SRC, full));
      }
    }
  };
  walk(SRC);
  assert(offenders.length === 0,
    `these modules write the note slice around its door: ${offenders.join(', ')}. `
    + 'Every write goes through recordJournalNote/removeJournalNote so the refusals run.');
});

run('the region was found — the store IS imported somewhere', () => {
  // NON-VACUITY, per the anchoring law: a sweep that matched nothing would pass
  // the cell above for the wrong reason.
  const importers: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(full); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (full.endsWith(path.join('store', 'journalNoteStore.ts'))) continue;
      if (/journalNoteStore/.test(readFileSync(full, 'utf8'))) {
        importers.push(path.relative(SRC, full));
      }
    }
  };
  walk(SRC);
  assert(importers.length >= 3,
    `only ${importers.length} modules reference the store (${importers.join(', ')}) — `
    + 'expected at least the screen, the hydration gate and the reset path');
});

run('the store joined the hydration gate and the fresh-install reset day one', () => {
  const gate = readFileSync(path.join(SRC, 'store/appHydrationGate.ts'), 'utf8');
  assert(/JOURNAL_NOTE_PERSISTENCE_KEY/.test(gate) && /useJournalNoteStore/.test(gate),
    'the note store is not hydrated before first render — a persisted input store '
    + 'that hydrates late renders an empty Journal and then fills it in');
  const resetPath = readFileSync(path.join(SRC, 'utils/resetCoach.ts'), 'utf8');
  const clears = [...resetPath.matchAll(/deps\.journalNoteStore\.clear\(\)/g)];
  assert(clears.length >= 2,
    `the note store is cleared on ${clears.length} reset paths — a new store joins `
    + 'the reset day one, or a "fresh install" keeps the last athlete\'s notes');
});

run('the tape event is a DECISION event', () => {
  const log = readFileSync(path.join(SRC, 'utils/athleteActionLog.ts'), 'utf8');
  assert(/'journal_note_write'/.test(log),
    'journal_note_write is not in DECISION_EVENTS — one §18 repair search can '
    + 'evict the athlete\'s note write from the ring (export 6\'s lesson)');
});

// ─── [2] THE WIPE SHAPE ──────────────────────────────────────────────────

console.log('\n[2] THE WIPE SHAPE');

run('an unattributed empty write over answered notes is REFUSED', () => {
  seedOneNote();
  const outcome = applyJournalNoteWrite({ next: [], writer: 'dev_seed' });
  assert(outcome.ok === false, 'the door allowed an unattributed wipe');
  assert(outcome.reason === 'default_over_answered_notes',
    `wrong refusal reason: ${outcome.reason}`);
});

run('and the athlete\'s note SURVIVES the refusal', () => {
  // THE HALF THAT MATTERS. A door that returns {ok:false} and writes anyway is
  // worse than no door, because the refusal reads as protection.
  assert(getJournalNotes().length === 1,
    `the notes were emptied despite the refusal (${getJournalNotes().length} left)`);
  assert(getJournalNotes()[0].text === NOTE_TEXT, 'the surviving note was altered');
});

run('a STALE reset id is refused — an in-flight reset, not one that happened', () => {
  seedOneNote();
  const staleId = beginJournalNoteResetAction('stale');
  endJournalNoteResetAction(staleId);
  const outcome = applyJournalNoteWrite({ next: [], writer: 'reset', resetActionId: staleId });
  assert(outcome.ok === false && outcome.reason === 'reset_action_not_in_flight',
    `a finished reset's id was accepted: ${JSON.stringify(outcome)}`);
  assert(getJournalNotes().length === 1, 'the notes were emptied by a stale reset');
});

run('an IN-FLIGHT reset may empty the store', () => {
  seedOneNote();
  const id = beginJournalNoteResetAction('legitimate');
  try {
    const outcome = applyJournalNoteWrite({ next: [], writer: 'reset', resetActionId: id });
    assert(outcome.ok, `a legitimate reset was refused: ${JSON.stringify(outcome)}`);
  } finally { endJournalNoteResetAction(id); }
  assert(getJournalNotes().length === 0, 'the reset did not empty the store');
});

run('removing the LAST note is the athlete\'s change, not the wipe', () => {
  // Recipe lesson 11: refusing this would strand the athlete with a note they
  // cannot take back.
  const note = seedOneNote();
  const outcome = removeJournalNote(note.id);
  assert(outcome.ok, `the athlete could not delete their own last note: ${outcome.reason}`);
  assert(getJournalNotes().length === 0, 'the note survived its own deletion');
});

run('a blank note is refused before the door', () => {
  reset();
  for (const text of ['', '   ', '\n\t ']) {
    const outcome = recordJournalNote({
      weekStart: '2026-08-10', text, tags: [], nowISO: '2026-08-10T09:00:00.000Z',
    });
    assert(!outcome.ok, `a blank note was recorded: ${JSON.stringify(text)}`);
  }
  assert(getJournalNotes().length === 0, 'a blank note reached the store');
});

// ─── [3] THE TAPE CARRIES COUNTS, NEVER ANSWERS ──────────────────────────

console.log('\n[3] THE TAPE');

run('the tape carries no note text and no tag', () => {
  reset();
  recordJournalNote({
    weekStart: '2026-08-10',
    text: NOTE_TEXT,
    tags: ['injury', 'sleep'],
    nowISO: '2026-08-10T09:00:00.000Z',
  });
  const serialized = JSON.stringify(athleteActionLogEntries());
  assert(serialized.includes('journal_note_write'),
    'the note write is not on the tape at all');
  assert(!serialized.includes(NOTE_TEXT),
    'THE NOTE TEXT IS ON THE TAPE. It is the athlete\'s own words about their '
    + 'life — counts and labels only.');
  assert(!/"(injury|sleep)"/.test(serialized.replace(/"writer":"[^"]*"/g, '')),
    'a tag leaked onto the tape — tags are answers too');
});

run('the tape records the counts either side', () => {
  const serialized = JSON.stringify(athleteActionLogEntries());
  assert(/noteCountBefore/.test(serialized) && /noteCountAfter/.test(serialized),
    'the note write does not record material counts, so a wipe would be invisible');
});

// ─── [4] THE TAG VOCABULARY IS CLOSED ────────────────────────────────────

console.log('\n[4] THE VOCABULARY');

run('the eight design tags are the vocabulary, exactly', () => {
  assert(JOURNAL_NOTE_TAGS.length === 8, `${JOURNAL_NOTE_TAGS.length} tags, expected 8`);
  for (const tag of ['recovery', 'mobility', 'injury', 'diet', 'work_stress',
    'sleep', 'illness', 'travel']) {
    assert((JOURNAL_NOTE_TAGS as readonly string[]).includes(tag), `missing tag: ${tag}`);
  }
});

run('an unknown tag cannot enter through the door', () => {
  reset();
  const outcome = recordJournalNote({
    weekStart: '2026-08-10',
    text: 'a note',
    tags: ['recovery', 'not_a_real_tag' as never, 'sleep'],
    nowISO: '2026-08-10T09:00:00.000Z',
  });
  assert(outcome.ok && outcome.note, 'the note was refused outright');
  assert(outcome.note.tags.length === 2 && !outcome.note.tags.includes('not_a_real_tag' as never),
    `an unauthored tag was stored: ${JSON.stringify(outcome.note.tags)}`);
  assert(parseJournalNoteTag('not_a_real_tag') === null, 'the parser accepted a stray tag');
});

run('duplicate tags are collapsed', () => {
  reset();
  const outcome = recordJournalNote({
    weekStart: '2026-08-10', text: 'a note',
    tags: ['sleep', 'sleep', 'sleep'], nowISO: '2026-08-10T09:00:00.000Z',
  });
  assert(outcome.ok && outcome.note.tags.length === 1,
    `duplicates survived: ${JSON.stringify(outcome.note?.tags)}`);
});

run('the week count is derived from the notes, never stored', () => {
  reset();
  for (const [week, when] of [['2026-08-03', '2026-08-03T09:00:00.000Z'],
    ['2026-08-10', '2026-08-10T09:00:00.000Z'],
    ['2026-08-10', '2026-08-11T09:00:00.000Z']] as const) {
    recordJournalNote({ weekStart: week, text: 'a note', tags: [], nowISO: when });
  }
  assert(getJournalNotes().length === 3, 'three notes were not recorded');
  assert(journalNoteWeekCount() === 2,
    `week count ${journalNoteWeekCount()}, expected 2 — it counts WEEKS, not notes`);
  const state = useJournalNoteStore.getState() as unknown as Record<string, unknown>;
  assert(!('weekCount' in state) && !('noteCount' in state),
    'the store holds a derived counter — the north star presumes stored derivations wrong');
});

// ─── [5] A NOTE NEVER DERIVES PROGRAM STATE ──────────────────────────────

console.log('\n[5] NOTES NEVER DERIVE PROGRAM STATE');

run('no rules/ or resolver module reads the note store', () => {
  // THE DESIGN'S NON-NEGOTIABLE, asserted structurally rather than promised in
  // a comment. If generation, repair or placement could read a note, the
  // Journal would have become a mutation door by the back way in.
  const offenders: string[] = [];
  for (const dir of ['rules', 'utils', 'services', 'hooks']) {
    const base = path.join(SRC, dir);
    const walk = (current: string): void => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) { if (entry.name !== '__tests__') walk(full); continue; }
        if (!/\.tsx?$/.test(entry.name)) continue;
        // resetCoach legitimately clears it — erasure is not derivation.
        if (full.endsWith(path.join('utils', 'resetCoach.ts'))) continue;
        if (/journalNoteStore/.test(readFileSync(full, 'utf8'))) {
          offenders.push(path.relative(SRC, full));
        }
      }
    };
    walk(base);
  }
  assert(offenders.length === 0,
    `these engine modules read the athlete's notes: ${offenders.join(', ')}. `
    + 'Notes are record-only — they never derive program state (Journal design, '
    + 'non-negotiable). If one of these genuinely needs the fact, the fact is a '
    + 'typed life-fact, not a free-text note.');
});

console.log(`\nJournal note ownership totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
console.log('  DEPTH (L13): 0 — the door is driven directly. No athlete is walked '
  + 'through a week to reach these states.');
console.log('  NOT COVERED: the quarantine boundary is registered and its predicate is '
  + 'not exercised here — `storedStateWriterAuditTests` owns the empty-payload no-arm '
  + 'property across stores. Relaunch survival is asserted by the hydration-gate '
  + 'membership cell, not by an actual process restart.');
if (failed > 0) console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
