/**
 * Three missed-session choices hand off to the existing survey, accepted
 * skipped-outcome transaction, and PlanChangeSheet move entry.
 * Run: npm run test:missed-session-prompt
 */
import * as fs from 'fs';
import * as path from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { missedSessionSkippedFeedback } from '../utils/missedSessions';

armTotalsOrRed();
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean) {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`); }
  else { fail += 1; failures.push(name); console.log(`  ✗ ${name}`); }
}
const read = (...segments: string[]) => fs.readFileSync(path.resolve(__dirname, '..', ...segments), 'utf8');
const home = read('screens', 'home', 'HomeScreenV2.tsx');
const hook = read('screens', 'home', 'useHomeScreen.ts');
const sheet = read('screens', 'home', 'PlanChangeSheet.tsx');
const model = read('utils', 'missedSessions.ts');

console.log('\n[1] Exactly three approved choices');
{
  const start = home.indexOf('function MissedSessionPrompt');
  const end = home.indexOf('function MissedChip', start);
  ok('prompt region found', start >= 0 && end > start);
  const prompt = start >= 0 && end > start ? home.slice(start, end) : '';
  for (const label of ['Did it', 'Skipped it', 'Move it forward']) ok(`${label} present`, prompt.includes(`label="${label}"`));
  ok('exactly three chips', (prompt.match(/<MissedChip\b/g) ?? []).length === 3);
  ok('Missed it absent', !prompt.includes('label="Missed it"'));
  ok('Skip it absent', !prompt.includes('label="Skip it"'));
  for (const id of ['missed-session-did-it', 'missed-session-skipped-it', 'missed-session-move-forward']) {
    ok(`${id} live`, prompt.includes(`testID="${id}"`));
  }
}

console.log('\n[2] Did it opens the existing survey');
ok('Did it routes to survey opener', /case 'did_it':[\s\S]{0,180}handleLogMissedSession\(missedSessionPrompt\)/.test(home));
ok('survey opener uses DayWorkout feedback mode', /handleLogMissedSession[\s\S]{0,500}navigation\.navigate\('DayWorkout',[\s\S]{0,220}startFinished:\s*true/.test(hook));
ok('no fake good/full response remains', !/feeling:\s*'good'[\s\S]{0,80}completion:\s*'full'/.test(model));

console.log('\n[3] Skipped it records an outcome, not a deletion');
ok('Skipped routes to skip owner', /case 'skipped_it':[\s\S]{0,180}handleSkipMissedSession\(missedSessionPrompt\)/.test(home));
ok('skip owner uses outcome transaction', /handleSkipMissedSession[\s\S]{0,900}commitSessionOutcomeTransaction[\s\S]{0,400}missed_session_prompt/.test(hook));
ok('skip owner does not bin or move content', !/handleSkipMissedSession[\s\S]{0,1000}(?:type:\s*'bin_session'|type:\s*'move_session')/.test(hook));
const skipped = missedSessionSkippedFeedback('2026-08-10');
ok('helper records skipped', skipped.completion === 'skipped');
ok('helper invents no feeling', !('feeling' in skipped));

console.log('\n[4] Move enters the existing move pathway');
ok('Move selects shared sheet move entry', /case 'move_forward':[\s\S]{0,220}initialAction:\s*'move'/.test(home));
ok('PlanChangeSheet accepts move entry', /initialAction\??:\s*'actions'\s*\|\s*'move'/.test(sheet));
ok('move entry and menu use startMove',
  /initialAction === 'move'[\s\S]{0,160}startMove\(\)/.test(sheet) &&
  /label="Move this session"[\s\S]*?onPress=\{\(\) => startMove\(\)\}/.test(sheet));
ok('hook does not choose prompt destination', !/handleSkipMissedSession[\s\S]{0,1500}move_forward/.test(hook));

console.log(`\nmissedSessionPromptOwnershipTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) { console.log(`Failures: ${failures.join(', ')}`); process.exit(1); }
