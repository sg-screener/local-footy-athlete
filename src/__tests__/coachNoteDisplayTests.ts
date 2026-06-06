/**
 * coachNoteDisplayTests — proves the V2 coach-note UI uses useful
 * one-line restriction copy instead of the old generic system flag.
 *
 * Run: npm run test:coach-note-display
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import { getCoachNoteDisplay } from '../utils/coachNoteSummary';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; failures.push(name); console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`); }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { console.log(`\n${label}`); }

const HOME_V2 = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'),
  'utf8',
);
const HOME_CLASSIC = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreen.tsx'),
  'utf8',
);
const READINESS_QUICK_CHECK = fs.readFileSync(
  path.resolve(__dirname, '..', 'components', 'ReadinessQuickCheck.tsx'),
  'utf8',
);
const DAY_V2 = fs.readFileSync(
  path.resolve(__dirname, '..', 'screens', 'home', 'DayWorkoutScreenV2.tsx'),
  'utf8',
);

section('[1] helper — generic flag produces no summary');
{
  const display = getCoachNoteDisplay(['Coach adjusted']);
  ok('no summaryLine for generic-only notes', !display.summaryLine);
  ok('summary never equals Coach adjusted', display.summaryLine !== 'Coach adjusted');
}

section('[2] helper — useful restriction summary wins');
{
  const display = getCoachNoteDisplay([
    'Removed: Flying 30m Sprints',
    'No sprinting or high-speed running',
    'Focus: Upper body',
  ]);
  eq('summary is concise sprint restriction', display.summaryLine, 'No sprinting / high-speed running');
  ok('summary has no bullet prefix', !/^[•*-]/.test(display.summaryLine ?? ''));
  ok('summary is within row copy limit', (display.summaryLine ?? '').length <= 55);
}

section('[3] helper — one line only when many notes exist');
{
  const display = getCoachNoteDisplay([
    'Removed: Trap Bar Deadlift',
    'Replaced RDL with Goblet Squat',
    'Focus: Easy bike',
    'Focus: Trunk',
    'No heavy hinge work (RDLs, deadlifts, nordics)',
  ]);
  eq('summary picks one high-priority line', display.summaryLine, 'No heavy hinge / hamstring loading');
  ok('summary has no newline', !/\n/.test(display.summaryLine ?? ''));
}

section('[4] helper — audit notes translate without raw audit detail');
{
  const sprint = getCoachNoteDisplay(['Removed: Flying 30m Sprints']);
  eq('removed sprint becomes rule copy', sprint.summaryLine, 'No sprinting / high-speed running');
  ok('summary does not expose Removed audit text', !/^Removed:/i.test(sprint.summaryLine ?? ''));

  const press = getCoachNoteDisplay(['Removed: Bench Press', 'Removed: Overhead Press']);
  eq('pressing audit becomes rule copy', press.summaryLine, 'No pressing / overhead loading');

  const jump = getCoachNoteDisplay(['Removed: Box Jumps']);
  eq('jump audit becomes rule copy', jump.summaryLine, 'No jumping / explosive lower');
}

section('[5] helper — local session change beats global hammy sprint rule');
{
  const display = getCoachNoteDisplay([
    'no sprinting / no high-speed running',
    'Removed: Nordic Lower',
    'Replaced Deadlift with Goblet Squat',
  ], {
    workoutName: 'Lower Body Strength',
    workoutType: 'Strength',
  });
  eq('summary describes local hinge/hamstring change', display.summaryLine, 'No heavy hinge / hamstring loading');
  ok(
    'summary is NOT sprinting for non-running lower session',
    display.summaryLine !== 'No sprinting / high-speed running',
  );
  ok('details include removed Nordic', display.detailLines.some((l) => /Removed: Nordic Lower/i.test(l)));
  ok('details include replaced Deadlift', display.detailLines.some((l) => /Replaced Deadlift/i.test(l)));
  ok('real extra details trigger Show changes', display.shouldShowDetails);
}

section('[6] helper — team training can use sprint restriction');
{
  const display = getCoachNoteDisplay([
    'no sprinting / no high-speed running',
  ], {
    workoutName: 'Team Training',
    workoutType: 'Mixed',
  });
  eq('team training summary keeps sprint restriction', display.summaryLine, 'No sprinting / high-speed running');
  ok('duplicate-only detail is hidden', !display.shouldShowDetails);
  eq('duplicate-only detailLines empty', display.detailLines, []);
}

section('[7] helper — generic fallback only when local changes absent');
{
  const misleading = getCoachNoteDisplay([
    'no sprinting / no high-speed running',
  ], {
    workoutName: 'Lower Body Strength',
    workoutType: 'Strength',
  });
  ok('non-running lower session does not show global sprint rule alone', !misleading.summaryLine);

  const display = getCoachNoteDisplay([
    'Adjusted for active hammy — update coach if symptoms improve.',
  ], {
    workoutName: 'Lower Body Strength',
    workoutType: 'Strength',
  });
  eq('hammy attribution fallback', display.summaryLine, 'Hammy restriction active');
  ok('no details for attribution-only summary', !display.shouldShowDetails);
}

section('[8] HomeScreenV2 — Program rows use helper + one-line row');
{
  ok('HomeScreenV2 imports getCoachNoteDisplay', /getCoachNoteDisplay/.test(HOME_V2));
  ok('HomeScreenV2 keeps lower adjustment prompt', /Need to adjust your weekly plan\?/.test(HOME_V2));
  ok(
    'HomeScreenV2 does not render Today Feel quick check',
    !/ReadinessQuickCheck|readiness-quick-check|Today feel|Today Feel/.test(HOME_V2),
  );
  ok(
    'classic HomeScreen does not render Today Feel quick check',
    !/ReadinessQuickCheck|readiness-quick-check|Today feel|Today Feel/.test(HOME_CLASSIC),
  );
  ok(
    'stale ReadinessQuickCheck component is inert if mounted',
    /return null;/.test(READINESS_QUICK_CHECK)
      && !/Today feel|Today Feel|Short time|readiness-quick-check/.test(READINESS_QUICK_CHECK),
  );
  ok('HomeScreenV2 does not render CoachUpdateCard', !/CoachUpdateCard/.test(HOME_V2));
  ok('classic HomeScreen does not render CoachUpdateCard', !/CoachUpdateCard/.test(HOME_CLASSIC));
  const v2AddGameIdx = HOME_V2.indexOf('No game this week — add one');
  const v2WeekListIdx = HOME_V2.indexOf('/* ── Week list ── */');
  const v2QuickActionsIdx = HOME_V2.indexOf('Need to adjust your weekly plan?');
  ok(
    'HomeScreenV2 places add-game CTA below weekly plan',
    v2AddGameIdx > v2WeekListIdx && v2AddGameIdx < v2QuickActionsIdx,
    `indices add=${v2AddGameIdx} list=${v2WeekListIdx} quick=${v2QuickActionsIdx}`,
  );
  const classicAddGameIdx = HOME_CLASSIC.indexOf('No game this week — add one');
  const classicDayRowsIdx = HOME_CLASSIC.indexOf('/* ─── Day Rows ─── */');
  const classicQuickActionsIdx = HOME_CLASSIC.indexOf('NEED TO ADJUST YOUR WEEKLY PLAN?');
  ok(
    'classic HomeScreen places add-game CTA below weekly plan',
    classicAddGameIdx > classicDayRowsIdx && classicAddGameIdx < classicQuickActionsIdx,
    `indices add=${classicAddGameIdx} rows=${classicDayRowsIdx} quick=${classicQuickActionsIdx}`,
  );
  ok('Program row summary testID exists', /testID="day-row-coach-summary"/.test(HOME_V2));
  ok(
    'Program row caps summary to one line',
    /testID="day-row-coach-summary"[\s\S]{0,220}numberOfLines=\{1\}/.test(HOME_V2),
  );
  ok(
    'Program row source does not render generic Coach adjusted literal',
    !/Coach adjusted/.test(HOME_V2),
  );
  ok(
    'Program row passes workout context into helper',
    /getCoachNoteDisplay\(day\.workout\.coachNotes,\s*{[\s\S]*workoutName:\s*day\.workout\.name[\s\S]*workoutType:\s*day\.workout\.workoutType[\s\S]*}\)/.test(HOME_V2),
  );
}

section('[9] DayWorkoutScreenV2 — card copy + expanded details');
{
  ok('card eyebrow is COACH UPDATE', />COACH UPDATE</.test(DAY_V2));
  ok('default body uses helper summary', /getCoachNoteDisplay\(notes,\s*{/.test(DAY_V2));
  ok('default body renders summaryLine', /\{summary\.summaryLine\}/.test(DAY_V2));
  ok('default body source does not render Coach adjusted literal', !/Coach adjusted/.test(DAY_V2));
  ok('detail toggle uses shouldShowDetails', /const hasDetails = summary\.shouldShowDetails/.test(DAY_V2));
  ok('expanded details testID exists', /testID="coach-note-banner-details"/.test(DAY_V2));
  ok('expanded state maps detailLines', /summary\.detailLines\.map/.test(DAY_V2));
}

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
