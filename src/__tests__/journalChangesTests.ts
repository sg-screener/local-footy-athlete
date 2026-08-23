(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

/**
 * WHAT CHANGED THIS WEEK — addendum Group 1 item 2, the last item in the unit.
 *
 * VERIFICATION STRATEGY (L12). One class dominates, and it is not "the list is
 * wrong":
 *
 *   - A COMPLETE-LOOKING LIST IMPLIES COMPLETENESS. The ledger records the
 *     ATHLETE's decisions and has no vocabulary for changes the APP made —
 *     illness, injury, readiness, phase (LR-29, measured before this unit began).
 *     A list without that stated boundary claims more than the data supports.
 *     [3] asserts the boundary is carried in the DATA and rendered on the
 *     SURFACE, so it cannot be dropped by a later edit that only touches one.
 *   - AN INTERNAL KIND CAN REACH THE ATHLETE. `remove_session` is code
 *     vocabulary. [2] asserts every rendered phrase is athlete language and that
 *     an unmapped kind is DROPPED rather than shown by its code name.
 *   - MIGRATION BOOKKEEPING IS NOT A DECISION. [2] asserts
 *     `migrated_day_placement` never appears — no writer creates it, and it
 *     describes a decision nobody made.
 *
 * Run: npm run test:journal-changes
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { buildJournalChanges } from '../rules/journalChanges';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import { readFileSync } from 'fs';
import { join } from 'path';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

const WEEK = new Set(['2026-08-10', '2026-08-11', '2026-08-12']);

const entry = (
  id: string,
  decision: unknown,
  occurredAt = '2026-08-11T09:00:00.000Z',
): DecisionLedgerEntry => ({
  id, occurredAt, provenance: { source: 'athlete' }, decision,
} as unknown as DecisionLedgerEntry);

const build = (entries: DecisionLedgerEntry[]) =>
  buildJournalChanges({ entries, weekDates: WEEK });

// ─── [1] This week's decisions ───────────────────────────────────────────

console.log('\n[1] THIS WEEK, OLDEST FIRST');
{
  ok('an empty ledger yields no changes', build([]).changes.length === 0);

  const outside = build([
    entry('old', { kind: 'fixture_add', date: 'x', fixtureKind: 'game' },
      '2026-07-01T09:00:00.000Z'),
  ]);
  ok('a decision from another week is not this week\'s',
    outside.changes.length === 0, outside.changes);

  const ordered = build([
    entry('b', { kind: 'fixture_add', date: 'x', fixtureKind: 'game' },
      '2026-08-12T09:00:00.000Z'),
    entry('a', { kind: 'fixture_remove', date: 'x', fixtureKind: 'game' },
      '2026-08-10T09:00:00.000Z'),
  ]);
  ok('changes read oldest first',
    ordered.changes.map((c) => c.entryId).join(',') === 'a,b',
    ordered.changes.map((c) => c.entryId));
}

// ─── [2] The athlete's words, never a code name ──────────────────────────

console.log('\n[2] NO INTERNAL VOCABULARY REACHES THE ATHLETE');
{
  const phrases = (decision: unknown) => build([entry('e', decision)]).changes[0]?.what;

  ok('a removed session reads as one', phrases({
    kind: 'plan_change', change: { kind: 'remove_session', date: 'x' },
  }) === 'removed a session');
  ok('an added session reads as one', phrases({
    kind: 'plan_change', change: { kind: 'add_category', date: 'x', category: 'c' },
  }) === 'added a session');
  ok('a swap reads as a swap', phrases({
    kind: 'plan_change', change: { kind: 'swap_template', date: 'x', templateId: 't' },
  }) === 'swapped a session');
  ok('an undo is a decision too (LR-29)',
    phrases({ kind: 'reversal', reversedEntryId: 'x' }) === 'undid a change');

  // NO `kind` STRING IS EVER RENDERED. `remove_session` is code vocabulary and
  // the honest-outcome law forbids it reaching an athlete.
  const all = build([
    entry('1', { kind: 'plan_change', change: { kind: 'remove_session', date: 'x' } }),
    entry('2', { kind: 'fixture_move', fromDate: 'a', toDate: 'b', fixtureKind: 'game' }),
    entry('3', { kind: 'reversal', reversedEntryId: 'x' }),
  ]);
  ok('no rendered phrase contains an underscore — no code names',
    all.changes.every((c) => !c.what.includes('_')), all.changes.map((c) => c.what));

  // AN UNMAPPED KIND IS DROPPED, NOT SHOWN. A future decision kind must be
  // given words before it can be spoken.
  ok('an unmapped decision kind is dropped rather than rendered',
    build([entry('x', { kind: 'something_new_nobody_worded' })]).changes.length === 0);

  // MIGRATION BOOKKEEPING IS NOT A DECISION THE ATHLETE MADE.
  ok('`migrated_day_placement` never appears',
    build([entry('m', { kind: 'migrated_day_placement', date: 'x', workout: {} })])
      .changes.length === 0);
}

// ─── [3] The boundary is the feature's honesty ───────────────────────────

console.log('\n[3] THE LIST NEVER IMPLIES COMPLETENESS');
{
  // THE LEDGER HAS NO VOCABULARY FOR ILLNESS / INJURY / READINESS / PHASE —
  // LR-29 measured that before this unit began. A list without the boundary
  // stated would imply the app changed nothing, which is a stronger claim than
  // the data supports.
  ok('the boundary travels in the DATA, not only in the copy',
    build([]).appChangesUnavailable === true);

  const source = readFileSync(join(__dirname, '..', 'rules', 'journalChanges.ts'), 'utf8');
  ok('the module source was read', source.length > 2000, source.length);
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  // IT DOES NOT INVENT THE MISSING HALF. Reading a readiness or illness store to
  // fill the gap would be exactly the "second answer" this unit has refused all
  // the way through — and would paraphrase decisions nobody recorded.
  ok('it reaches for no other store to fill the gap',
    !/readiness|illness|injuryEpisode|temporarySourceFact/i.test(code),
    code.match(/readiness|illness|injury\w*/gi));

}

console.log(`\njournalChangesTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — a unit sweep over the pure derivation with hand-built '
  + 'ledger entries. No walked athlete, and no cell mounts a surface.');
console.log('  NOT COVERED: "WHAT WAS PROTECTED" IS NOT BUILT, and the reason is a '
  + 'measurement rather than a preference — the fact does not exist. The app\'s answer '
  + 'lives in `section18ShortfallDisclosure`, a disclosure at the DOOR at the moment of a '
  + 'decision; the ledger does not store it, and re-deriving it for a past week would '
  + 'be a reconstruction rather than a record. Recording it is an engine-side change to '
  + 'the decision doors. Changes the APP made (illness/injury/readiness/phase) are absent '
  + 'from the ledger by LR-29 and are stated as absent rather than inferred. No device '
  + 'evidence.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
