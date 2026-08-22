/**
 * TWO missed-session answers, at the TOP of the screen, one per door.
 *
 * ⚠ **THIS SUITE IS INVERTED, NOT WEAKENED — SAM, 2026-08-22.** It pinned three
 * choices ("Did it", "Skipped it", "Move it forward") on a card at the bottom
 * of the Program screen. His ruling: *"right now it pops up at the bottom of the
 * screen ... Notifications at top of screen above or below active modifiers ...
 * 'Yes, log it' ... or 'no, skip it' and the session is skipped"*, and *"i think
 * the current set up has like 4 options but they're unneccesary"*.
 *
 * What the old cells were REALLY holding survives here, aimed at the new shape:
 * every answer routes to an existing owner, nothing invents an athlete's
 * answer, and no answer deletes or moves content behind their back. The move
 * pathway is still asserted — on the change sheet, which owns it — because
 * removing the option must not remove the road.
 *
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

console.log('\n[1] Exactly two answers, and they are the signed words');
{
  const start = home.indexOf('function MissedSessionNotices');
  const end = home.indexOf('function missedQuestion', start);
  ok('notice region found', start >= 0 && end > start);
  const prompt = start >= 0 && end > start ? home.slice(start, end) : '';
  ok('exactly two chips', (prompt.match(/<MissedChip\b/g) ?? []).length === 2);
  ok('yes reads the signed row', prompt.includes("signedCopy('missed.prompt.yes')"));
  ok('no reads the signed row', prompt.includes("signedCopy('missed.prompt.no')"));
  // THE THIRD OPTION IS GONE FROM THE SURFACE AND FROM THE TYPE.
  ok('Move it forward is gone', !home.includes('label="Move it forward"') && !home.includes('move_forward'));
  ok('the response type carries two answers', /'did_it' \| 'skipped_it'/.test(model)
    && !model.includes("'move_forward'"));
  // THE WORDS ARE THE SHEET'S — including the weekday, which is why the
  // parameter is a signed row rather than a formatted string.
  ok('no question is authored in the screen',
    !/Did you do \{/.test(home) && !home.includes('Did you complete'));
  ok('the weekday is a signed parameter', /signedCopy\(`day\.name\.\$\{weekdayNameForISO/.test(home));
}

console.log('\n[2] It is at the TOP of the screen, above both shapes');
{
  const noticeAt = home.indexOf('<MissedSessionNotices');
  const weekAt = home.indexOf('{dayFirst ? (');
  const dayCardAt = home.indexOf('{dayFirstDay ? renderDayRow');
  ok('mounted before the day/week branch', noticeAt > 0 && weekAt > noticeAt);
  ok('and therefore before the day card', dayCardAt > noticeAt);
  ok('exactly one mount for both shapes', (home.match(/<MissedSessionNotices/g) ?? []).length === 1);
}

console.log('\n[3] Yes routes to the door that owns each kind');
{
  ok('the club night opens the club form in place',
    /case 'team_training':[\s\S]{0,120}setClubTrainingDate\(missed\.date\)/.test(home));
  ok('the game opens the game form in place',
    /case 'game':[\s\S]{0,120}setGameFeedbackDate\(missed\.date\)/.test(home));
  ok('the programmed session opens the session view',
    /default:[\s\S]{0,400}handleLogMissedSession\(missed\)/.test(home));
  // ⚠ `startFinished` IS THE RULING. It opened the session ALREADY FINISHED,
  // straight into the feedback form, so an athlete answering "yes, I did
  // Thursday" could not say which of it they did. Sam: *"taken to the session
  // view screen and the athlete can then tick the boxes for what they did"*.
  ok('the session view opens to be ticked, not already finished',
    /const handleLogMissedSession[\s\S]{0,700}navigation\.navigate\('DayWorkout'/.test(hook)
      && !/const handleLogMissedSession[\s\S]{0,700}startFinished/.test(hook));
  ok('no fake good/full response remains', !/feeling:\s*'good'[\s\S]{0,80}completion:\s*'full'/.test(model));
}

console.log('\n[4] No records an outcome for ONE thing, not a deletion');
{
  ok('skip owner uses outcome transaction', /handleSkipMissedSession[\s\S]{0,1500}commitSessionOutcomeTransaction[\s\S]{0,600}missed_session_prompt/.test(hook));
  ok('skip owner does not bin or move content', !/handleSkipMissedSession[\s\S]{0,1500}(?:type:\s*'bin_session'|type:\s*'move_session')/.test(hook));
  ok('the skip names its components', /missedSessionSkippedFeedback\(missed\.date, \{[\s\S]{0,200}kind: missed\.kind/.test(hook));
  const skipped = missedSessionSkippedFeedback('2026-08-10');
  ok('helper records skipped', skipped.completion === 'skipped');
  ok('helper invents no feeling', !('feeling' in skipped));
}

console.log('\n[5] The move road still exists — on the sheet that owns it');
{
  // Removing the OPTION must not remove the pathway: moving a missed session is
  // a plan edit, and the change sheet is where every other move is made.
  // The union grew past the two this cell was written against ('add', 'swap',
  // 'remove' arrived with the change hub); what it holds is that MOVE is one of
  // them, which is the road the retired option used.
  ok('PlanChangeSheet accepts move entry',
    /type PlanChangeInitialAction = [^;]*'move'/.test(sheet)
      && /initialAction\??:\s*PlanChangeInitialAction/.test(sheet));
  ok('move entry and menu use startMove',
    /initialAction === 'move'[\s\S]{0,160}startMove\(\)/.test(sheet) &&
    /label="Move this session"[\s\S]*?onPress=\{\(\) => startMove\(\)\}/.test(sheet));
  const closedSheetExit = sheet.indexOf('if (!date) return null;');
  ok('closed and open sheet renders call the same hooks',
    closedSheetExit >= 0 &&
    !/\buse(?:Effect|Memo|State|Callback|Reducer|Ref|Context|LayoutEffect)\s*\(/.test(
      sheet.slice(closedSheetExit),
    ));
}

console.log(`\nmissedSessionPromptOwnershipTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) { console.log(`Failures: ${failures.join(', ')}`); process.exit(1); }
