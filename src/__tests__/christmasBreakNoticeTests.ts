/**
 * The Christmas questions use the Program screen's compact question notice.
 *
 * This is deliberately separate from the older end-to-end Christmas suite:
 * presentation should stay measurable even when generation debt prevents that
 * longer suite reaching its screen assertions.
 *
 * Run: npm run test:christmas-break (first arm)
 */
import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();
let passed = 0;
let failed = 0;
const failures: string[] = [];
function run(name: string, condition: boolean): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failed += 1;
  failures.push(name);
  console.log(`  FAIL ${name}`);
}

const screen = fs.readFileSync(
  path.join(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'),
  'utf8',
);
const decision = fs.readFileSync(
  path.join(__dirname, '..', 'rules', 'christmasBreakAsk.ts'),
  'utf8',
);

console.log('\n-- Christmas question notification --');

const sharedAt = screen.indexOf('function ProgramQuestionNotice(');
const christmasAt = screen.indexOf('function ChristmasBreakNotice(');
const missedAt = screen.indexOf('function MissedSessionNotice(');
const missedEnd = screen.indexOf('function missedQuestion', missedAt);
run('[1] all three question-notice regions are found',
  sharedAt >= 0 && christmasAt > sharedAt && missedAt > christmasAt && missedEnd > missedAt);

const christmasNotice = christmasAt >= 0 && missedAt > christmasAt
  ? screen.slice(christmasAt, missedAt)
  : '';
const missedNotice = missedAt >= 0 && missedEnd > missedAt
  ? screen.slice(missedAt, missedEnd)
  : '';
run('[2] Christmas and missed sessions use one compact notice owner',
  /<ProgramQuestionNotice\b/.test(christmasNotice) &&
  /<ProgramQuestionNotice\b/.test(missedNotice) &&
  !/phaseSkewCard/.test(christmasNotice));

run('[3] the two agreed questions are the words on the notice',
  /When does team training finish before Christmas\?/.test(christmasNotice) &&
  /When does team training start again\?/.test(christmasNotice));

run('[4] the compact notice has a yellow calendar-and-snowflake icon',
  /function ChristmasBreakNoticeIcon\([\s\S]*?stroke="#D8D800"/.test(christmasNotice) &&
  /M4 8h16/.test(christmasNotice) && /M12 11v7/.test(christmasNotice));

run('[5] December offers a date or the honest trains-through answer',
  /testID="home-christmas-break-open"/.test(christmasNotice) &&
  /testID="home-christmas-break-dismiss"/.test(christmasNotice) &&
  /ask\.kind === 'last_team_training'/.test(christmasNotice));

const mountAt = screen.indexOf('<ChristmasBreakNotice');
const dayWeekAt = screen.indexOf('{dayFirst ? (', mountAt);
run('[6] one notice sits above the shared Day and Week branch',
  mountAt >= 0 && dayWeekAt > mountAt &&
  (screen.match(/<ChristmasBreakNotice\b/g) ?? []).length === 1);
run('[7] the notice is not hidden from the Day view',
  !/isNormal\s*&&\s*!dayFirst\s*&&\s*christmasBreakAsk/.test(screen));

run('[8] both questions still open the established calendar picker',
  /<ChristmasBreakSheet/.test(screen) &&
  /<DateCalendarPicker/.test(screen) &&
  /setChristmasSheetVisible\(true\)/.test(screen));

run('[9] 3 January remains the return-question date',
  /CHRISTMAS_RETURN_ASK_FROM = \{ month: 1, day: 3 \}/.test(decision));

console.log(`\nchristmas question notification: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFAILURES:');
  failures.forEach((failure) => console.log(`  - ${failure}`));
}
totalsPrinted(failures.length);
process.exit(failed === 0 ? 0 : 1);
