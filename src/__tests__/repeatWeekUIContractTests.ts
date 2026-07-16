import { readFileSync } from 'fs';
import path from 'path';

const home = readFileSync(path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'), 'utf8');
const hook = readFileSync(path.resolve(__dirname, '..', 'screens', 'home', 'useHomeScreen.ts'), 'utf8');
const repeat = readFileSync(path.resolve(__dirname, '..', 'utils', 'repeatWeek.ts'), 'utf8');

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); }
  else { failed += 1; console.error(`  FAIL ${name}`); }
}

console.log('\n-- Repeat Week Home contract --');
const ids = [
  'program-week-repeat',
  'repeat-week-confirm-sheet',
  'repeat-week-confirm',
  'repeat-week-cancel',
  'repeat-week-result-message',
  'repeat-week-active-card',
  'repeat-week-restore',
  'repeat-week-restore-status',
  'home-visible-week-after-repeat',
  'home-visible-week-after-repeat-restoration',
];
for (const id of ids) check(`stable selector ${id}`, home.includes(id) || hook.includes(id));
check('Home action copy names the displayed-to-next-week operation',
  home.includes('Repeat this week into next week'));
check('Home passes weekDays[0].date as the source',
  /const sourceWeekDate = weekDays\[0\]\?\.date/.test(hook));
check('success navigation uses the accepted target week',
  /goToDate\(result\.targetWeekStart\)/.test(hook));
check('production restore uses clearReversibleAdjustment(adjustmentId)',
  /clearReversibleAdjustment\([\s\S]*activeRepeatWeekAdjustment\.id/.test(hook));
check('legacy direct clearRepeatWeek production door is retired',
  !/export function clearRepeatWeek/.test(repeat));
check('durable and failure result copy are present',
  home.includes('repeat-week-result-message') &&
  hook.includes('Repeated week saved. Your next week is ready.') &&
  hook.includes('Repeat Week wasn’t saved. Your program is unchanged.'));

console.log(`\nRepeat Week UI contract: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
