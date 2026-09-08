/** End-to-end ownership pins for dated fatigue input -> derived program policy. */
import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import {
  composeTemporarySourceFactCompatibility,
  createTemporaryFatigueFact,
  temporaryFactScope,
} from '../rules/temporarySourceFact';
import { readinessActionForKind } from '../utils/weekReadinessActions';
import { selectActiveProgramModifiers } from '../utils/activeProgramModifiers';

armTotalsOrRed();
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean) {
  if (condition) { pass += 1; console.log(`  PASS ${name}`); }
  else { fail += 1; failures.push(name); console.log(`  FAIL ${name}`); }
}
const read = (...segments: string[]) => fs.readFileSync(path.resolve(__dirname, '..', ...segments), 'utf8');

const monday = '2026-08-24';
const tuesday = '2026-08-25';
const first = createTemporaryFatigueFact({
  observedDate: monday,
  scope: temporaryFactScope({ kind: 'date', date: monday }),
  athleteReportedLevel: 'slight',
  sourceSurface: 'test',
  now: `${monday}T08:00:00.000Z`,
});
const expiredFirst = { ...first, status: 'expired' as const, resolvedAt: `${tuesday}T00:01:00.000Z` };
const second = createTemporaryFatigueFact({
  observedDate: tuesday,
  scope: temporaryFactScope({ kind: 'date', date: tuesday }),
  athleteReportedLevel: 'moderate',
  sourceSurface: 'test',
  now: `${tuesday}T08:00:00.000Z`,
});

console.log('\n[1] All three buttons store one dated fact');
for (const kind of ['tired_today', 'flat_today', 'cooked_week'] as const) {
  const action = readinessActionForKind(kind, { anchorDateISO: monday, todayISO: tuesday });
  ok(`${kind} is today-only`, action.type === 'set_fatigue_status'
    && action.scope === 'today_only' && action.payload.date === tuesday);
}

console.log('\n[2] Expired history completes the streak; Clear breaks it');
{
  const composed = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: [expiredFirst, second],
  });
  const sequence = composed.activeConstraints.find((constraint) =>
    constraint.id === `source-fact:fatigue-sequence:${tuesday}`);
  ok('second date emits the one sequence constraint', !!sequence);
  ok('constraint starts on day two and ends Sunday',
    sequence?.startDate === tuesday && sequence?.expiresAt === '2026-08-30');
  ok('constraint carries both factual reports',
    sequence?.temporarySourceFactIds?.length === 2);
  ok('athlete receives the named reason', sequence?.type === 'fatigue'
    && sequence.reasonLabel === 'Two tired days in a row');

  const clearedFirst = { ...expiredFirst, status: 'resolved' as const };
  const afterClear = composeTemporarySourceFactCompatibility({
    temporarySourceFacts: [clearedFirst, second],
  });
  ok('resolving either report removes the sequence constraint',
    !afterClear.activeConstraints.some((constraint) => constraint.id.includes('fatigue-sequence')));
}

console.log('\n[3] The compiler and screen consume the policy');
{
  const compiler = read('rules', 'canonicalWeeklySourceFactCompiler.ts');
  const home = read('screens', 'home', 'HomeScreenV2.tsx');
  ok('pretty flat uses the canonical lighter-day compiler',
    compiler.includes('compileCanonicalLighterDayWorkout(workout).workout'));
  const restBranch = compiler.match(/if \(policy\.effect === 'rest'\) \{([\s\S]*?)\n\s*\}/)?.[1];
  ok('the rest branch records its typed reason beside the dated removal',
    !!restBranch && restBranch.includes("= 'fatigue'") && restBranch.includes('return [date, null]'));
  ok('the contract records low readiness rather than an unexplained deficit',
    /reason: 'low_readiness'/.test(compiler) && compiler.includes('compileCanonicalFrequencyReducedContract'));
  ok('fatigue does not enter the old opt-in lighter offer',
    /const todayScoped = kind === 'poor_sleep_today' \|\| kind === 'sore_today' \|\| kind === 'illness_mild'/.test(home));
  ok('the exact two-day notice is selected from signed copy',
    home.includes("'readiness.fatigue.sequence'"));
}

console.log('\n[4] My Status keeps the accepted dated fact and its Clear identity');
{
  const flatRows = selectActiveProgramModifiers({
    temporarySourceFacts: [second],
    todayISO: tuesday,
  });
  const flat = flatRows.find((row) =>
    (row.payload?.temporarySourceFactIds as string[] | undefined)?.includes(second.factId));
  ok('pretty flat has one current-day Status row',
    flatRows.length === 1 && flat?.affects.includes('current_day') === true);
  ok('the Status row carries the accepted fact id for Clear',
    flat?.payload?.temporarySourceFactIds?.[0] === second.factId);
  ok('the Status row reports the automatic reduction', flat?.effect === 'volume_adjusted');

  const cooked = createTemporaryFatigueFact({
    observedDate: tuesday,
    scope: temporaryFactScope({ kind: 'date', date: tuesday }),
    athleteReportedLevel: 'cooked',
    sourceSurface: 'test',
    now: `${tuesday}T09:00:00.000Z`,
  });
  const cookedRow = selectActiveProgramModifiers({
    temporarySourceFacts: [cooked],
    todayISO: tuesday,
  })[0];
  ok('cooked Status says training is paused for that day', cookedRow?.effect === 'training_paused');
  const notedProjection = composeTemporarySourceFactCompatibility({ temporarySourceFacts: [first] });
  const notedRow = selectActiveProgramModifiers({
    temporarySourceFacts: [first],
    readinessSignalsByDate: notedProjection.readinessSignalsByDate,
    todayISO: monday,
  })[0];
  ok('bit tired remains visible as noted without claiming a program reduction',
    notedRow?.effect === 'readiness_noted'
      && notedRow.payload?.temporarySourceFactIds?.[0] === first.factId);
}

console.log(`\nfatiguePlumbingTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) { console.log(`Failures: ${failures.join(', ')}`); process.exit(1); }
