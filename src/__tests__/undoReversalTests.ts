/**
 * UNDO — THE REVERSAL PRODUCER AND THE REPLAY THAT HONOURS IT.
 *
 * LR-29's undo, built 2026-08-09 after Sam ruled the shape (one step, "undo
 * last change" — `docs/UNDO_SHAPE_RULING_2026-08-09.md`).
 *
 * WHAT THIS SUITE IS FOR. `types/decisionLedger.ts` has declared `reversal`
 * since R1.1 and `quiescentBoot` returned early on it for as long — a typed
 * seam ahead of its producer. The producer has landed, and the thing most
 * worth gating is not that undo "works" but that **the two places undo means
 * something can never disagree**: the moment the athlete taps, and every
 * relaunch after. They are one filter, and these cells hold them to it.
 *
 * WHAT IT CLAIMS AND WHAT IT DOES NOT. Undo is complete for `move_session`,
 * proven end to end by `npm run tape:lr29-undo-durability` after the move door
 * stopped writing a calendar mark. It is UNPROVEN for every other decision
 * kind: a second non-ledger side-writer would produce the identical symptom
 * somewhere else, and cell [10] guards the one instance that is closed rather
 * than the class, which stays open.
 *
 * Run: npm run test:undo-reversal
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
  annulledEntryIds,
  replayableEntries,
  undoableEntries,
  lastUndoableEntry,
} from '../rules/decisionLedgerReplay';
import { undoToastFor, undoToastSeenMarker } from '../rules/undoToast';
import type { AthleteDecision, DecisionLedgerEntry } from '../types/decisionLedger';

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
    console.error(`  FAIL ${name}`, error);
  }
}

const move = (from: string, to: string): AthleteDecision =>
  ({ kind: 'plan_change', change: { kind: 'move_session', fromDate: from, toDate: to } } as never);

function entry(id: string, decision: AthleteDecision, at = '2026-08-09T09:00:00.000Z'): DecisionLedgerEntry {
  return { id, occurredAt: at, provenance: 'athlete_tap', decision };
}

const reversal = (id: string, target: string): DecisionLedgerEntry =>
  entry(id, { kind: 'reversal', reversedEntryId: target });

// ── [1] THE CORE: an annulled decision is not replayed ────────────────────────

run('1 a reversal removes its target from the replay set, and itself', () => {
  const ledger = [
    entry('dl-1', move('2026-08-08', '2026-08-09')),
    entry('dl-2', { kind: 'fixture_add', date: '2026-08-10', fixtureKind: 'game' }),
    reversal('dl-3', 'dl-1'),
  ];
  const replayed = replayableEntries(ledger).map((row) => row.id);
  assert(JSON.stringify(replayed) === JSON.stringify(['dl-2']),
    `the replay set should be exactly [dl-2], got ${JSON.stringify(replayed)}`);
  assert(annulledEntryIds(ledger).has('dl-1'), 'dl-1 was not annulled');
});

run('2 the reversal is dropped even when its target is absent', () => {
  // A reversal is never an ACTION. If it were replayed as one the boot would
  // have to know what to do with it, and there is nothing to do — its whole
  // effect is the absence it creates.
  const ledger = [reversal('dl-9', 'dl-does-not-exist')];
  assert(replayableEntries(ledger).length === 0,
    'a reversal reached the replay set');
});

// ── [3] THE CONDITIONS, each decided rather than left to fall out ─────────────

run('3 a reversal naming an unknown id is INERT, never fatal', () => {
  // A boot that threw here would take the athlete's whole world with it, and
  // the payload that reaches a boot is not always the payload that left.
  const ledger = [entry('dl-1', move('2026-08-08', '2026-08-09')), reversal('dl-2', 'dl-404')];
  const replayed = replayableEntries(ledger).map((row) => row.id);
  assert(JSON.stringify(replayed) === JSON.stringify(['dl-1']),
    `an unknown target changed the replay set: ${JSON.stringify(replayed)}`);
});

run('4 reversing a reversal does NOT bring the decision back — there is no redo', () => {
  // Sam ruled one step. This cell's first version asserted only that the replay
  // set was empty, and a mutation removing the no-redo guard SURVIVED it —
  // because emptiness was being carried by the reversal-drop, not by the
  // property under test. The guard turned out to be unobservable and was
  // deleted; this assertion was re-aimed at the thing that can actually change:
  // whether dl-1 is still annulled.
  const ledger = [
    entry('dl-1', move('2026-08-08', '2026-08-09')),
    reversal('dl-2', 'dl-1'),
    reversal('dl-3', 'dl-2'),
  ];
  assert(annulledEntryIds(ledger).has('dl-1'),
    'reversing the reversal un-annulled the original decision — that is redo');
  assert(replayableEntries(ledger).length === 0,
    'reversing a reversal resurrected the original decision — that is redo');
});

run('5 annulling twice is annulling once, and order does not matter', () => {
  const twice = [
    entry('dl-1', move('2026-08-08', '2026-08-09')),
    reversal('dl-2', 'dl-1'),
    reversal('dl-3', 'dl-1'),
  ];
  assert(replayableEntries(twice).length === 0, 'a double reversal did not annul');
  // A reversal names its target by ID, never by position, so a replay cannot
  // depend on ledger ordering to be correct about what still counts.
  const reordered = [
    reversal('dl-2', 'dl-1'),
    entry('dl-1', move('2026-08-08', '2026-08-09')),
  ];
  assert(replayableEntries(reordered).length === 0,
    'a reversal appended BEFORE its target was not honoured');
});

// ── [6] ONE SET, TWO QUESTIONS ───────────────────────────────────────────────

run('6 what can be undone IS what still counts — one set, never two', () => {
  // If these were computed separately the app could offer to undo something the
  // world had already stopped replaying: a button that appears to do nothing.
  const ledger = [
    entry('dl-1', move('2026-08-08', '2026-08-09')),
    entry('dl-2', { kind: 'fixture_add', date: '2026-08-10', fixtureKind: 'game' }),
    reversal('dl-3', 'dl-2'),
  ];
  assert(JSON.stringify(undoableEntries(ledger).map((row) => row.id))
    === JSON.stringify(replayableEntries(ledger).map((row) => row.id)),
    'the undoable set and the replay set disagree');
  assert(lastUndoableEntry(ledger)?.id === 'dl-1',
    'the last undoable entry is not the newest live decision');
  assert(lastUndoableEntry([]) === null, 'an empty ledger offered something to undo');
});

run('7 the last change is chosen by LEDGER ORDER, not by the device clock', () => {
  // `occurredAt` is a device clock: it moves backwards across a timezone change
  // or a manual clock set. An undo that picked its target by wall-clock would
  // undo the wrong change on the one day a year the clock goes back.
  const ledger = [
    entry('dl-1', move('2026-08-08', '2026-08-09'), '2026-08-09T10:00:00.000Z'),
    entry('dl-2', move('2026-08-06', '2026-08-07'), '2026-08-09T09:00:00.000Z'),
  ];
  assert(lastUndoableEntry(ledger)?.id === 'dl-2',
    'the undo target followed occurredAt instead of ledger order');
});

// ── [8] THE BOOT IS WIRED TO THE FILTER, AND ONLY TO IT ──────────────────────

run('8 the boot replays through the filter, with no second opinion', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'store', 'quiescentBoot.ts'), 'utf8');
  assert(/for \(const entry of replayableEntries\(decisionLedgerEntries\(\)\)\)/.test(source),
    'the boot no longer replays through replayableEntries');
  // A SECOND COPY OF THE RULE IS THE DEFECT THIS GATE EXISTS FOR. The boot must
  // not decide for itself what a reversal means.
  const body = source.slice(source.indexOf('function replayEntry'));
  const ownReversalLogic = /reversedEntryId/.test(body);
  assert(!ownReversalLogic,
    'quiescentBoot reads reversedEntryId itself — the rule has two owners now');
});

run('9 the undo door is the only writer of reversal entries', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (item.name === 'node_modules' || item.name === '__tests__') continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(item.name)) continue;
      const relative = path.relative(srcRoot, full);
      if (relative === path.join('store', 'undoLastDecision.ts')) continue;
      if (relative === path.join('types', 'decisionLedger.ts')) continue;
      if (relative === path.join('rules', 'decisionLedgerReplay.ts')) continue;
      const text = fs.readFileSync(full, 'utf8');
      // The claim is about a WRITE, so the probe is the append shape — not the
      // word, which appears in type positions and comments all over the tree.
      // (`a count taken for a record`: the instrument must count the claim's
      // own unit, and the unit here is "a site that CREATES a reversal".)
      if (/kind:\s*'reversal'/.test(text)) offenders.push(relative);
    }
  };
  walk(srcRoot);
  assert(offenders.length === 0,
    `site(s) author a reversal outside the undo door: ${offenders.join(', ')}`);
});

// ── [10] THE GAP, PINNED OPEN ────────────────────────────────────────────────

run('10 the move door never authors a calendar mark — the gap stays closed', () => {
  // MEASURED 2026-08-09: a `move_session` wrote `markedDays[sourceDate] = 'rest'`.
  // A mark is not a ledger decision, so annul + re-derive could not take it
  // back and the undone week was not the pre-change week.
  //
  // It was fixed at the SOURCE, not in the undo door — under the ruling Sam
  // already made for the sibling deletion door ("A DELETION DOOR NEVER WRITES A
  // CALENDAR MARK", 2026-07-30), because the move's own constraint already
  // owned the emptiness via the canonical rest stub.
  //
  // This cell reds if the write comes back. It is a SOURCE assertion because
  // the defect is an authoring act, and the world-level proof (the tape) is not
  // in the chain.
  const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'store', 'acceptedStateTransaction.ts'), 'utf8');
  const code = source.split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');
  assert(!/markedDays\[sourceDate\]\s*=\s*'rest'/.test(code),
    'the move door authors a calendar rest mark again — undo cannot take that '
    + "back, and Sam's 2026-07-30 ruling says a door does not speak for the "
    + 'calendar');
});

// ── [11-14] THE TOAST — undo's only screen-level affordance ──────────────────

run('11 the toast is a READING of the ledger, so no door has to raise it', () => {
  const ledger = [entry('dl-1', move('2026-08-08', '2026-08-09'))];
  const toast = undoToastFor(ledger, null);
  assert(toast?.entryId === 'dl-1', 'a landed decision raised no toast');
  assert(toast?.sentence === 'moved a session',
    `the toast did not use the phrase owner's words: ${toast?.sentence}`);
});

run('12 a toast appears only when the newest decision CHANGES', () => {
  // Transience without a clock. A timestamp window would raise a toast for a
  // change made in a previous session if the app relaunched quickly enough,
  // and would misbehave when the device clock moves backwards.
  const ledger = [entry('dl-1', move('2026-08-08', '2026-08-09'))];
  assert(undoToastFor(ledger, 'dl-1') === null,
    'an already-seen decision raised the toast again');
  const later = [...ledger, entry('dl-2', move('2026-08-06', '2026-08-07'))];
  assert(undoToastFor(later, 'dl-1')?.entryId === 'dl-2',
    'a NEW decision did not raise a toast');
});

run('13 one tap is one step — an undo does not re-offer what it uncovers', () => {
  // After the undo the target is annulled, so the marker is the decision
  // BEFORE it. Sam ruled one step; a toast that immediately offered the next
  // one would be a recent-changes list reached one tap at a time.
  const afterUndo = [
    entry('dl-1', move('2026-08-06', '2026-08-07')),
    entry('dl-2', move('2026-08-08', '2026-08-09')),
    reversal('dl-3', 'dl-2'),
  ];
  const marker = undoToastSeenMarker(afterUndo);
  assert(marker === 'dl-1', `the seen marker should be dl-1, got ${marker}`);
  assert(undoToastFor(afterUndo, marker) === null,
    'the toast re-offered the change the undo uncovered');
});

run('14 an unmapped decision kind shows NO toast, never its code name', () => {
  // The honest-outcome law. `phraseFor` returns null for anything it has no
  // athlete word for, and the toast must drop rather than render `remove_x`.
  const ledger = [entry('dl-1',
    { kind: 'migrated_day_placement', date: '2026-08-08', workout: {} } as never)];
  assert(undoToastFor(ledger, null) === null,
    'an unmapped decision kind reached the athlete as a toast');
});

console.log(`\nUndo reversal totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
