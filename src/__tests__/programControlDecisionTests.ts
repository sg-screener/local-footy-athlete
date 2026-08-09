/**
 * THE DOOR IS THE ONLY APPENDER, AND WHAT IT APPENDS IS THE ACTION ITSELF.
 *
 * The ownership boundary from `docs/COACH_ARCHITECTURE_REASSESSMENT_2026-08-09.md`
 * §9, gated:
 *
 *   > A program mutation is one appended decision. The door appends it. Nothing
 *   > else appends, and nothing else persists a mutation's effect.
 *
 * WHAT THIS SUITE IS FOR, and it is not "the ledger route works" — the tape
 * (`npm run tape:exercise-edit-durability`) proves that end to end on a real
 * process death, and a suite cannot improve on it. These cells hold the three
 * things that would rot QUIETLY:
 *
 *   1. **The allow-list and the replay arms are one set.** A general
 *      `program_control` kind carrying a 26-member union is only safe while
 *      every recorded action type can actually be replayed. Recording a type
 *      the boot cannot reproduce is WORSE than recording nothing: the edit
 *      looks durable and vanishes anyway.
 *   2. **The action goes in VERBATIM.** This is the cell that fails on
 *      OMISSION. §3 of the reassessment measured a real defect where one word
 *      (`scope`) carried two axes and a boundary silently widened a session
 *      move into a whole-day move — no error, no guard, nothing to catch it
 *      except a round trip. A deep-equality cell is the only shape that reds
 *      when a field is dropped rather than mangled.
 *   3. **One act is ONE decision.** Session-level actions already append a
 *      `plan_change` inside `applyPlanChange`. If they were also recorded here
 *      the athlete would need two undos to undo one move.
 *
 * Run: npm run test:program-control-decisions
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
  LEDGER_RECORDED_ACTION_TYPES,
  isLedgerRecordedActionType,
  programControlDecisionFor,
} from '../rules/programControlDecisions';
import { replayableEntries, lastUndoableEntry } from '../rules/decisionLedgerReplay';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type { ProgramControlAction } from '../utils/programControlActions';

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

const src = (...parts: string[]) =>
  fs.readFileSync(path.resolve(__dirname, '..', ...parts), 'utf8');

/** A realistic exercise-level action, with every optional field populated —
 *  a verbatim cell is only as strong as the richness of what it round-trips. */
const removeAction = (): ProgramControlAction => ({
  type: 'remove_exercise',
  source: { screen: 'session_detail', surface: 'day-workout', initiatedBy: 'tap' },
  payload: { date: '2026-08-06', exercise: 'Bird Dog', exerciseId: 'ex-77', futureWeeksToo: false },
  requiresRebuild: false,
  createsActiveModifier: false,
  oneOffOnly: true,
  scope: 'today_only',
} as never as ProgramControlAction);

const moveAction = (): ProgramControlAction => ({
  type: 'move_session',
  source: { screen: 'program_tab', surface: 'plan-change-sheet', initiatedBy: 'tap' },
  payload: { fromDate: '2026-08-06', toDate: '2026-08-07' },
  requiresRebuild: false,
  createsActiveModifier: false,
  oneOffOnly: true,
} as never as ProgramControlAction);

console.log('\n── PROGRAM CONTROL DECISIONS ──');

run('[1] the allow-list is exactly the exercise-level destination', () => {
  // A RATCHET, not a description. This list growing is the moment somebody must
  // also teach replay the new type, and the cell exists to make that deliberate.
  assert(
    JSON.stringify([...LEDGER_RECORDED_ACTION_TYPES].sort())
      === JSON.stringify(['add_exercise', 'remove_exercise', 'swap_exercise']),
    `the recorded action types moved: ${JSON.stringify(LEDGER_RECORDED_ACTION_TYPES)}. `
    + 'Adding one is fine — in the commit that also gives it a replay arm and a '
    + 'durability reading in the tape. Never on its own.');
});

run('[2] every recorded type has a case arm in the door\'s executor', () => {
  // The invariant that makes ONE general kind safe. Anchoring law (AGENTS.md):
  // the region is located and PROVEN non-trivial before anything is asserted
  // about it — a `slice` between two markers that both missed returns something
  // a regex passes over happily.
  const source = src('utils', 'programControlActions.ts');
  const start = source.indexOf('function executeProgramControlActionWithinTrace');
  assert(start > 0, 'the synchronous executor was not found — this cell is asserting on nothing');
  const body = source.slice(start);
  assert(body.length > 2000, 'the executor slice is implausibly short — anchor probably drifted');
  for (const type of LEDGER_RECORDED_ACTION_TYPES) {
    assert(new RegExp(`case '${type}':`).test(body),
      `'${type}' is recorded on the ledger but has no case arm in the executor, so a `
      + 'replay would record a decision the boot cannot reproduce — an edit that '
      + 'looks durable and vanishes anyway');
  }
});

run('[3] every recorded type has a REPLAY arm reached from the boot', () => {
  // The other direction of cell [2]: the boot must actually route this kind to
  // the door. Asserted on the located region, never file-wide — a file-wide
  // match would be satisfied by the word appearing in a comment.
  const source = src('store', 'quiescentBoot.ts');
  const start = source.indexOf("if (decision.kind === 'program_control')");
  assert(start > 0, 'the boot has no `program_control` replay arm — recorded edits are dropped');
  const arm = source.slice(start, start + 2500);
  assert(/executeProgramControlAction\b/.test(arm),
    'the replay arm no longer calls the door — replay must re-run the interpreter '
    + 'that recorded the decision, not a second copy of it');
  assert(/decision\.action/.test(arm),
    'the replay arm no longer passes the recorded action verbatim');
});

run('[4] the decision carries the action VERBATIM — the omission cell', () => {
  // THE CELL THAT CATCHES A LOST FIELD. Not "the decision is shaped right" —
  // deep equality, because a boundary that drops `exerciseId` or `scope` is
  // still perfectly well-typed and every other assertion still passes.
  const action = removeAction();
  const decision = programControlDecisionFor(action);
  assert(decision, 'an allow-listed action produced no decision');
  assert(decision.kind === 'program_control', `wrong kind: ${decision.kind}`);
  assert(JSON.stringify(decision.action) === JSON.stringify(action),
    'the recorded action is not byte-identical to the action the door executed. '
    + 'A field lost here is lost silently and forever: replay reruns what was '
    + 'recorded, so the athlete gets a DIFFERENT edit back after a relaunch.');
  // And prove the cell could fail — a fixture with nothing in it would pass the
  // comparison above and assert nothing at all.
  assert(Object.keys((action as unknown as { payload: object }).payload).length >= 4,
    'the fixture is too thin to prove a verbatim round trip');
});

run('[5] session-level actions record NOTHING here — one act, one decision', () => {
  assert(programControlDecisionFor(moveAction()) === null,
    'move_session produced a program_control decision. It already appends a '
    + 'plan_change inside applyPlanChange, so this would be TWO decisions for one '
    + 'tap — and the athlete would need two undos to undo one move.');
  for (const type of ['swap_session', 'add_to_day', 'bin_session', 'move_team_night']) {
    assert(!isLedgerRecordedActionType(type as never),
      `${type} is session-level and must not be recorded twice`);
  }
});

run('[6] fact destinations are NOT recorded — the staging is deliberate', () => {
  // Injury, illness and readiness PERSIST today in their own input slices. A
  // ledger kind without removing those slices would be TWO stored
  // representations of one input, which is worse than one. They arrive with
  // their migration (reassessment §8.3), not before it.
  for (const type of [
    'set_injury_modifier', 'clear_injury_modifier',
    'set_illness_status', 'set_fatigue_status', 'set_recovery_mode',
    'update_program_setup',
  ]) {
    assert(!isLedgerRecordedActionType(type as never),
      `${type} is recorded on the ledger while its fact slice is still persisted — `
      + 'that is two stored representations of one input. Remove the slice from '
      + 'partialize in the same commit, or do not record it yet.');
  }
});

run('[7] the appender set is closed — the door is the only new writer', () => {
  // §7 cell 1 of the reassessment. A new representation always arrives as a new
  // WRITER first, so the set is pinned rather than counted. Word boundaries,
  // because a count is satisfied by dead code and a prefix matches its own
  // extension.
  const root = path.resolve(__dirname, '..');
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)
        && /\bappendDecisionEntry\s*\(/.test(fs.readFileSync(full, 'utf8'))) {
        found.push(path.relative(root, full));
      }
    }
  };
  walk(root);
  const expected = [
    'store/decisionLedgerStore.ts',
    'store/fixtureMutationTransaction.ts',
    'store/preRebuildEnvelopeMigration.ts',
    'store/undoLastDecision.ts',
    'utils/planChangeProducer.ts',
    'utils/programControlActions.ts',
  ];
  assert(found.length > 0, 'the sweep found no appenders at all — it is asserting on nothing');
  assert(JSON.stringify(found.sort()) === JSON.stringify(expected),
    `the set of ledger appenders changed:\n  found:    ${found.join(', ')}\n  expected: ${expected.join(', ')}\n`
    + 'A new appender is a new representation of a decision. Add it here only '
    + 'with the reason written down.');
});

run('[8] a program_control entry is replayable and undoable like any other', () => {
  // Undo is a PROPERTY of being on the ledger, not a feature built per kind
  // (reassessment §4.3). This cell is what makes that claim checkable: the
  // generic filter must pick the new kind up with no arm of its own.
  const entries: DecisionLedgerEntry[] = [
    { id: 'e1', occurredAt: '2026-08-06T01:00:00.000Z', provenance: 'athlete_tap',
      decision: programControlDecisionFor(removeAction())! },
  ];
  assert(replayableEntries(entries).length === 1, 'the new kind is not replayed');
  assert(lastUndoableEntry(entries)?.id === 'e1', 'the new kind is not undoable');
  const annulled: DecisionLedgerEntry[] = [
    ...entries,
    { id: 'e2', occurredAt: '2026-08-06T02:00:00.000Z', provenance: 'athlete_tap',
      decision: { kind: 'reversal', reversedEntryId: 'e1' } },
  ];
  assert(replayableEntries(annulled).length === 0,
    'undoing a recorded door action does not remove it from the replay set');
});

run('[9] the door records only what LANDED, never what was attempted', () => {
  // A decision is recorded when the transaction kept it. A ledger entry for a
  // rolled-back edit would be replayed onto a world that rejected it, forever.
  const source = src('utils', 'programControlActions.ts');
  const start = source.indexOf('THE DECISION IS RECORDED HERE, AND ONLY HERE');
  assert(start > 0, 'the append site was not found — this cell is asserting on nothing');
  // The region ENDS at the next anchor rather than at a character count. A
  // fixed window is a silent trip-wire: this cell went red once already, not
  // because the guard had gone but because a comment was added above it and
  // pushed the code past `start + 2200`. A window measured in bytes is a claim
  // about formatting; the claim here is about what is inside the block.
  const end = source.indexOf('return transaction.value;', start);
  assert(end > start, 'the append block\'s closing return was not found — anchor drifted');
  const region = source.slice(start, end);
  assert(region.length > 400, 'the append region is implausibly short');
  assert(/transaction\.value\.ok\s*&&\s*transaction\.value\.changedProgram/.test(region),
    'the append no longer requires the transaction to have applied the change');
  assert(/appendDecisionEntry\(/.test(region), 'the append site no longer appends');
});

run('[10] replay never re-records — the latch is the guard, and it is real', () => {
  // Asserted at the LATCH rather than at the call site: the boot replays through
  // the same door, so if `appendDecisionEntry` did not return early under the
  // latch, every boot would append a duplicate decision per recorded edit and
  // the ledger would grow without bound.
  const source = src('store', 'decisionLedgerStore.ts');
  const start = source.indexOf('export function appendDecisionEntry');
  assert(start > 0, 'appendDecisionEntry was not found');
  const body = source.slice(start, start + 700);
  assert(/if\s*\(ledgerReplayActive\(\)\)\s*return/.test(body),
    'appendDecisionEntry no longer returns early during replay — every boot would '
    + 'duplicate every recorded door action');
});

run('[11] the action type module is type-only, and never reaches the ledger back', () => {
  // THE CYCLE THIS UNIT PAID FOR, GATED SO IT CANNOT COME BACK.
  //
  // `ProgramControlAction` used to live in `utils/programControlActions.ts`.
  // The ledger records it verbatim, so `types/decisionLedger.ts` must name it —
  // and naming it from the executor closed
  // `programControlActions -> planChangeProducer -> decisionLedgerStore ->
  //  types/decisionLedger -> programControlActions`, which silently degraded a
  // type guard 1,200 lines away and produced four errors that pointed at
  // innocent code. The fix was to move the declaration below both consumers.
  //
  // Two halves, because only together do they mean "this cannot cycle":
  //   (a) every import in the moved module is `import type` — erased, so the
  //       ledger type's load path stays free of stores;
  //   (b) nothing it imports leads back to `types/decisionLedger`.
  const file = src('types', 'programControlAction.ts');
  const imports = [...file.matchAll(/^\s*import\s+(type\s+)?[\s\S]*?from\s*'([^']+)'/gm)];
  assert(imports.length >= 5,
    `only ${imports.length} imports found — the scan is not seeing this module's imports`);
  const valueImports = imports.filter((match) => !match[1]).map((match) => match[2]);
  assert(valueImports.length === 0,
    `types/programControlAction.ts has VALUE imports (${valueImports.join(', ')}). `
    + 'Every import here must be `import type`, or the ledger type gains a runtime '
    + 'load path into the stores and the cycle is back.');
  // (b) — one hop is enough to catch the regression that matters, and it is
  // asserted on the FILES rather than on a promise in a comment.
  const root = path.resolve(__dirname, '..');
  for (const spec of imports.map((match) => match[2])) {
    if (!spec.startsWith('.')) continue;
    const base = path.resolve(root, 'types', spec);
    const resolved = ['.ts', '.tsx', '/index.ts'].map((ext) => base + ext).find((p) => fs.existsSync(p));
    if (!resolved) continue;
    assert(!/from\s*'[^']*decisionLedger'/.test(fs.readFileSync(resolved, 'utf8')),
      `${spec} imports types/decisionLedger, which closes the cycle this module was `
      + 'split out to break');
  }
});

console.log(`\nProgram control decision totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
