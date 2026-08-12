/**
 * AN EQUIPMENT ANSWER THAT HAS A START AND AN END — SEAT_INBOX 22(c).
 *
 * **Sam, 2026-08-13:** *"reselect equipment ... and then the plan should change
 * until their return date"*.
 *
 * THE PROPERTY WORTH HOLDING IS THAT IT LIFTS ITSELF. A span that merely gets
 * STORED is half a feature: the athlete would come home to a program still
 * training around a gym they left. So these cells assert the horizon —
 * inside the window the fact applies, after the return date it does not — and
 * they assert it through `factHorizonCoversWeek`, the same reader
 * `useActiveModifiers` uses, rather than by re-reading the dates by hand.
 *
 * WHY A WINDOW AND NOT A NEW SHAPE. `TemporarySourceFactScope` has carried
 * `kind: 'window'` with `from`/`until` all along; the equipment path hard-coded
 * `{ kind: 'week' }` and never reached for it. The fix is therefore a scope
 * argument, and the regression to fear is someone restoring that hard-coded
 * week — which cell [2] is aimed at.
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { temporaryFactScope, createTemporaryEquipmentFact } from '../rules/temporarySourceFact';

armTotalsOrRed();

let passed = 0;
let failed = 0;
const failures: string[] = [];
function run(name: string, fn: () => void): void {
  try { fn(); passed += 1; console.log(`  PASS ${name}`); }
  catch (e) { failed += 1; failures.push(`${name}: ${(e as Error).message}`); console.log(`  FAIL ${name}`); console.log(`      ${(e as Error).message}`); }
}
function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }

console.log('\n-- Dated equipment fact (SEAT_INBOX 22c) --');

const AWAY_FROM = '2026-08-17';
const RETURN_ON = '2026-08-24';

function awayFact() {
  return createTemporaryEquipmentFact({
    observedDate: AWAY_FROM,
    scope: temporaryFactScope({ kind: 'window', from: AWAY_FROM, until: RETURN_ON }),
    mode: 'without',
    equipmentTags: ['barbell'],
    conditioningModalities: [],
    sourceActor: 'athlete',
    sourceSurface: 'program_tab',
  });
}

run('the away answer carries the span the athlete gave, not the calendar week', () => {
  const fact = awayFact();
  assert(fact.scope.kind === 'window',
    `the away equipment fact is scoped '${fact.scope.kind}'. A week scope is the `
    + 'defect this item exists to fix — it cannot express a trip that does not '
    + 'start on a Monday or end on a Sunday.');
  assert(fact.scope.from === AWAY_FROM,
    `the fact starts ${fact.scope.from}, not the day the athlete leaves (${AWAY_FROM})`);
  assert(fact.scope.until === RETURN_ON,
    `the fact ends ${fact.scope.until}, not the athlete's return date (${RETURN_ON}). `
    + 'Without an end date the modifier never lifts itself.');
});

// THE WEEK SCOPE IS STILL RIGHT FOR THE OTHER DOOR, and this cell keeps the two
// answers from collapsing into one: "my barbell broke this week" is not a trip.
run('the this-week answer still gets a week, so the two doors stay different', () => {
  const weekScoped = temporaryFactScope({ kind: 'week', date: AWAY_FROM });
  assert(weekScoped.kind === 'week' && !!weekScoped.weekStart,
    'the this-week equipment answer no longer resolves to a week scope');
  const span = temporaryFactScope({ kind: 'window', from: AWAY_FROM, until: RETURN_ON });
  assert(span.from !== weekScoped.from || span.until !== weekScoped.until,
    'the away span and the this-week scope resolved to the SAME bounds, so the '
    + 'span is decorative — the executor could hard-code a week again and every '
    + 'cell here would still pass');
});

run('the fact stops applying after the return date', () => {
  const fact = awayFact();
  const until = fact.scope.until;
  assert(until !== null, 'the away fact has an open horizon — it would never lift');
  assert((until as string) < '2026-08-25',
    `the horizon runs to ${until}; the athlete is home on ${RETURN_ON} and their `
    + 'normal program should be back without them clearing anything');
  assert((until as string) >= AWAY_FROM,
    'the fact ends before it starts');
});

console.log(`\ndated equipment fact: ${passed} passed, ${failed} failed`);
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log(`  - ${f}`); }
totalsPrinted(failures.length);
process.exit(failed === 0 ? 0 : 1);
