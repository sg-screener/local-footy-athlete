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
  unreadableEntryCount,
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
    entry('dl-2', {
      kind: 'fixture_add', date: '2026-08-10', fixtureKind: 'game',
    } as never),
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
    entry('dl-2', {
      kind: 'fixture_add', date: '2026-08-10', fixtureKind: 'game',
    } as never),
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
  // AIMED AT THE PROPERTY, NOT THE LITERAL. This cell first pinned the exact
  // call text and reddened when the replay phase was wrapped in its own
  // try/catch — a correct change. What must hold is that the boot's replay loop
  // iterates the FILTER's output and nothing else.
  assert(/for \(const entry of replayableEntries\(/.test(source),
    'the boot no longer replays through replayableEntries');
  assert(!/for \(const entry of decisionLedgerEntries\(\)\)/.test(source),
    'the boot iterates the raw ledger somewhere — annulled decisions would replay');
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

run('11b a board bin raises its toast in the door’s own vocabulary', () => {
  // Launch audit 2026-08-25, finding #7b: Sam saw NO undo toast on any board
  // edit. Probed at HEAD (2026-08-26, device snapshot, real doors): the bin
  // appends `plan_change`/`remove_session`, phraseFor maps it, the model
  // appears and the undo restores the week byte-identically — the silence he
  // saw keyed on finding #6's relaunch-duplicated ledger ids. This cell pins
  // the door's LIVE vocabulary to the phrase owner: if the bin ever appends a
  // kind phraseFor does not map, the toast goes silent again and this reds.
  const ledger = [entry('dl-1',
    { kind: 'plan_change', change: { kind: 'remove_session', date: '2026-08-24', scope: 'whole_day' } } as never)];
  const toast = undoToastFor(ledger, null);
  assert(toast?.entryId === 'dl-1', 'a landed bin raised no toast');
  assert(toast?.sentence === 'removed a session',
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

// ── [15-17] A BOOT MUST NOT DIE ON DATA THE APP ITSELF WROTE ────────────────

run('15 an unreadable persisted row is DROPPED, never thrown on', () => {
  // A DEVICE FAILED TO OPEN BECAUSE OF THIS. `entry.decision.kind` on a row
  // whose `decision` is missing throws a TypeError, and the replay SET is
  // computed OUTSIDE quiescentBoot's per-entry try/catch — so one unreadable
  // row took the whole derived-world rebuild with it and the athlete met the
  // boot error screen. Before the filter existed, a bad row could only break
  // its own replay.
  const corrupt = [
    { id: 'dl-1', occurredAt: 'x', provenance: 'athlete_tap' },
    { id: 'dl-2', occurredAt: 'x', provenance: 'athlete_tap', decision: null },
    null,
    entry('dl-3', move('2026-08-08', '2026-08-09')),
  ] as never as DecisionLedgerEntry[];
  const replayed = replayableEntries(corrupt).map((row) => row.id);
  assert(JSON.stringify(replayed) === JSON.stringify(['dl-3']),
    `the readable decision did not survive its corrupt neighbours: ${JSON.stringify(replayed)}`);
  assert(unreadableEntryCount(corrupt) === 3,
    `unreadable rows should be counted, got ${unreadableEntryCount(corrupt)}`);
  // The whole point: the athlete keeps the app AND keeps the decision that
  // could still be read.
  assert(lastUndoableEntry(corrupt)?.id === 'dl-3',
    'a corrupt neighbour hid the undoable decision');
});

run('16 every reader of the ledger is total — no shape can throw', () => {
  // Asserted as a PROPERTY over the whole exported surface rather than on the
  // one shape that bit us, because the next corrupt payload will not be the
  // same shape as the last one.
  const shapes: unknown[][] = [
    [], [null], [undefined], [{}], [{ id: 1 }],
    [{ id: 'a', decision: {} }],
    [{ id: 'a', decision: { kind: 'reversal' } }],
    [{ id: 'a', decision: { kind: 'reversal', reversedEntryId: 7 } }],
    [{ id: 'a', decision: { kind: 'not_a_kind' } }],
  ];
  for (const shape of shapes) {
    for (const [name, fn] of [
      ['annulledEntryIds', annulledEntryIds],
      ['replayableEntries', replayableEntries],
      ['undoableEntries', undoableEntries],
      ['lastUndoableEntry', lastUndoableEntry],
      ['unreadableEntryCount', unreadableEntryCount],
    ] as [string, (e: never) => unknown][]) {
      try {
        fn(shape as never);
      } catch (error) {
        assert(false,
          `${name} threw on ${JSON.stringify(shape)}: ${(error as Error).message}`);
      }
    }
  }
});

run('17 the boot tolerates a failed replay PHASE, not just a failed entry', () => {
  // The per-entry catch is older and narrower — it never covered computing the
  // replay SET, which is where the device's throw came from. A catch around
  // the PHASE is the difference between armour and a patch.
  //
  // And a failure to build the BASE world must still surface: there is nothing
  // to degrade to, and a blank app serves an athlete worse than the error
  // screen with its Try Again. This cell pins the scope, in both directions.
  const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'store', 'quiescentBoot.ts'), 'utf8');
  const replayPhase = source.slice(source.indexOf('THE REPLAY PHASE CANNOT KILL THE BOOT'));
  assert(/try \{[\s\S]*replayableEntries\(entries\)[\s\S]*\} catch/.test(replayPhase),
    'the replay phase is no longer wrapped — one corrupt row can kill the boot again');
  const generation = source.slice(
    source.indexOf('const program = generateProgramLocally'),
    source.indexOf('THE REPLAY PHASE CANNOT KILL THE BOOT'));
  assert(!/\} catch/.test(generation),
    'generation is now caught too — an athlete with no program would get a blank '
    + 'app instead of the boot error screen, which is not an improvement');
});

// ── [18-19] A REMOVAL IS TWO WRITES, AND UNDO MUST REACH BOTH ────────────────

run('18 a removal has an undo phrase at all, or the toast can never appear', () => {
  // MEASURED ON DEVICE 2026-08-19: the ledger held the `remove_exercise` entry
  // and `replayableEntries` returned it, so it WAS undoable — but `phraseFor`
  // had no case for `program_control`, `undoToastFor` returns null on an
  // unmapped kind by design, and the toast therefore never rendered. The
  // athlete's only immediate way back from a removal was unreachable, and
  // nothing was red.
  //
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { phraseFor } = require('../rules/journalChanges');
  const removal = entry('dl-1', {
    kind: 'program_control',
    action: {
      type: 'remove_exercise',
      source: { screen: 'program_tab', surface: 'home_change_card', initiatedBy: 'tap' },
      scope: 'today_only',
      payload: { date: '2026-07-13', exercise: 'Back Squat' },
      requiresRebuild: false,
      createsActiveModifier: false,
      oneOffOnly: true,
    },
  } as unknown as AthleteDecision);
  const phrase = phraseFor(removal);
  assert(typeof phrase === 'string' && phrase.length > 0,
    'a removal has no undo phrase, so the undo toast cannot render for it');

  // AND THE TOAST ACTUALLY RESOLVES, which is the property the athlete has.
  // Asserting the phrase alone would pass while `undoToastFor` still returned
  // null for some other reason.
  const model = undoToastFor([removal], null);
  assert(model !== null && model.entryId === 'dl-1',
    'the undo toast does not resolve for a removal even though it has a phrase');
});

run('19 undoing a removal reaches the EXCLUSION, not just the ledger entry', () => {
  // ⚠ TWO WEAK VERSIONS OF THIS CELL WERE CAUGHT BY THE SAME MUTATION.
  //
  // (1) A SOURCE SCAN: deleting the `restoreExcludedExercise(exercise)` CALL
  //     left the import and the `remove_exercise` literal in place, so a regex
  //     for either stayed green while the behaviour was gone.
  // (2) AN `async` CELL: `run` above takes `() => void` and does NOT await, so
  //     the body returned a promise, the cell counted as passed IMMEDIATELY,
  //     and every assertion after the first `await` ran outside the try/catch
  //     as an unhandled rejection. It was green and empty.
  //
  // It is SYNCHRONOUS on purpose. `undoLastDecision` is async, but its only
  // `await` is the world settle at the very end — the ledger append and the
  // exclusion clearing both run before it. Asserting synchronously after an
  // un-awaited call therefore observes exactly the writes this cell is about.
  // Deleting the `restoreExcludedExercise(exercise)` CALL left the import and
  // the `remove_exercise` literal in place, so a regex for either stayed green
  // while the behaviour was gone — the exact "a set asserted in its own file is
  // not a gate" shape. It drives the real owners now.
  //
  // The two writes: the program-control action lands on the ledger (annulled by
  // the reversal) and the canonical exclusion lands in athlete preferences,
  // which replay never touches. Annulling only the first leaves the exclusion
  // standing, and the exclusion is what keeps the exercise out — so the toast
  // reported success while Back Squat stayed gone. Measured on device
  // 2026-08-19 before this cell existed.
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { applyExerciseExclusionDecision } = require('../utils/exerciseExclusionOwner');
  const { useAthletePreferencesStore } = require('../store/athletePreferencesStore');
  const { appendDecisionEntry } = require('../store/decisionLedgerStore');
  const { undoLastDecision } = require('../store/undoLastDecision');
  /* eslint-enable @typescript-eslint/no-var-requires */

  const written = applyExerciseExclusionDecision({
    exercise: 'Back Squat',
    scope: 'today_only',
    decidedOnISO: '2026-07-13',
  });
  // LIVENESS: an assertion about a removal that starts from zero proves nothing.
  assert(written.ok, 'the exclusion never got written, so this cell proves nothing');
  const before = useAthletePreferencesStore.getState().prefs.exclusions ?? [];
  assert(before.some((row: { exercise: string }) => row.exercise === 'Back Squat'),
    'Back Squat is not excluded before the undo — nothing to reverse');

  const appended = appendDecisionEntry({
    decision: {
      kind: 'program_control',
      action: {
        type: 'remove_exercise',
        source: { screen: 'program_tab', surface: 'home_change_card', initiatedBy: 'tap' },
        scope: 'today_only',
        payload: { date: '2026-07-13', exercise: 'Back Squat' },
        requiresRebuild: false,
        createsActiveModifier: false,
        oneOffOnly: true,
      },
    },
    provenance: 'athlete_tap',
    writer: 'test',
  });
  assert(appended.ok, 'the ledger refused the removal entry, so there is no undo to run');

  // NOT awaited, deliberately — see the note above. `void` because the settle
  // it returns is not what is being asserted.
  void undoLastDecision();

  const after = useAthletePreferencesStore.getState().prefs.exclusions ?? [];
  assert(!after.some((row: { exercise: string }) => row.exercise === 'Back Squat'),
    'the exclusion survived the undo — the reversal reached the ledger and not '
    + 'the fact that actually keeps the exercise out');
});

/* ─── R-107 — UNDO IS ON THE SURFACE THAT MADE THE CHANGE ──────────────────
 *
 * Sam, 2026-08-20: *"Keep the athlete on the current screen. Undo must appear
 * on whichever screen initiated the change, including inside the active
 * session. Do not send them back to the Day page."*
 *
 * ## WHY THIS SECTION READS SOURCE
 *
 * The claim is about which screens MOUNT the toast and about a guard inside the
 * component — the same class of question `test:session-change-hub` and
 * `test:dead-affordances` already answer by reading the screen. The toast's
 * BEHAVIOUR (what it offers, and that undoing reverses the fact and not just
 * the ledger) is the runtime section above.
 *
 * ## THE HALF THAT IS EASY TO GET WRONG
 *
 * "Mounted on both" is not the ruling. **"At most one visible, and one action
 * produces one toast, once"** is. So three cells assert the guard, not just the
 * mounts: the focus check, the render bail-out, and — the one a careless fix
 * would drop — that an UNFOCUSED mount keeps its seen-marker current. Without
 * that last one a removal made in a session announces itself again the moment
 * the athlete goes back to the Day screen. */
{
  const readSource = (...parts: string[]): string =>
    fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
  const toast = readSource('components', 'UndoToast.tsx');
  const day = readSource('screens', 'home', 'HomeScreenV2.tsx');
  const session = readSource('screens', 'home', 'DayWorkoutScreenV2.tsx');

  // ⚠ CONTROL. Every cell below is a substring test, and a substring test is
  // meaningless on a file that failed to read. If the paths ever drift these
  // would all quietly agree with each other about nothing.
  run('CONTROL — all three sources were really read', () => {
    assert(toast.length > 2000 && day.length > 50000 && session.length > 50000,
      `toast=${toast.length} day=${day.length} session=${session.length}`);
  });

  run('R-107 — both surfaces that own changes mount the toast', () => {
    assert(/<UndoToast \/>/.test(day),
      'the Program screen no longer mounts UndoToast');
    assert(/<UndoToast \/>/.test(session),
      'the SESSION screen does not mount UndoToast. The five labelled changes '
      + 'live there, so until it does, every Equipment/Injury/Add/Remove/Swap '
      + 'raises its Undo on the screen behind it and expires unseen.');
    assert(/import \{ UndoToast \}/.test(session),
      'the session screen names UndoToast without importing it');
  });

  run('R-107 — at most one is visible, and the guard is in the COMPONENT', () => {
    assert(/useIsFocused/.test(toast),
      'UndoToast does not read focus, so two mounts can both draw');
    assert(/if \(!model \|\| !isFocused\) return null;/.test(toast),
      'UndoToast renders without checking focus — two toasts on one screen');
    // THE RULE LIVES WITH THE COMPONENT, NOT AT THE CALL SITES. A guard each
    // screen has to remember is a guard one screen will forget.
    assert(!/isFocused/.test(day) || !/UndoToast[\s\S]{0,80}isFocused/.test(day),
      'a surface is guarding the toast from outside; the component owns this');
  });

  run('R-107 — an unfocused mount stays CURRENT, not merely silent', () => {
    const region = toast.slice(toast.indexOf('if (isFocused) return;'));
    assert(region.length > 0,
      'the unfocused branch is gone. Without it this mount\u2019s seen-marker '
      + 'still predates a decision another surface announced, so returning here '
      + 'replays that surface\u2019s toast — one action, two toasts.');
    assert(/setSeenEntryId\(undoToastSeenMarker\(entries\)\)/.test(region.slice(0, 200)),
      'the unfocused branch no longer advances the seen marker');
  });

  run('R-107 — the athlete is NOT navigated away to reach the toast', () => {
    // The rejected alternative, named so it cannot come back quietly: sending
    // the athlete to the Day page after a session change so the old single
    // mount could be reached. Sam refused it outright.
    //
    // RE-ANCHORED 2026-08-26: the hub MOUNT moved from DayWorkoutScreenV2 to
    // HomeScreenV2's day-first card (Sam's 2026-08-25 one-day-status-card
    // ruling); this cell read the old surface and was red on the anchor, not
    // on the law. It now follows the mount: wherever `<SessionChangeHub`
    // renders, its region must not navigate.
    const hubHost = [session, day].find((text) => text.includes('<SessionChangeHub'));
    const hubAt = hubHost ? hubHost.indexOf('<SessionChangeHub') : -1;
    const region = hubHost ? hubHost.slice(hubAt, hubAt + 1200) : '';
    assert(hubAt > 0, 'the change hub is mounted on neither surface; this cell is reading nothing');
    assert(!/navigation\.(navigate|goBack|popTo)\(/.test(region),
      'a change control on the session screen navigates away. R-107: "Do not '
      + 'send them back to the Day page."');
  });
}

console.log(`\nUndo reversal totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
