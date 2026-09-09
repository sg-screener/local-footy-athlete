/**
 * Three missed-session answers, at the TOP of the screen, one per door.
 *
 * The 2026-08-22 ruling moved the prompt to the top and reduced it to log/skip.
 * Sam's 2026-08-30 ruling restores one narrowly authorised plan-editing answer:
 * "No, move it", which opens Week and may move only that unlogged past thing.
 *
 * What the old cells were REALLY holding survives here, aimed at the new shape:
 * every answer routes to an existing owner, nothing invents an athlete's
 * answer, and no answer deletes or moves content behind their back. The Week
 * board and plan-change producer remain the owners of the actual move.
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
const producer = read('utils', 'planChangeProducer.ts');
const board = read('screens', 'home', 'WeekBoard.tsx');

console.log('\n[1] Exactly three answers, and they are the signed words');
{
  const start = home.indexOf('function MissedSessionNotice(');
  const end = home.indexOf('function missedQuestion', start); // spans MissedSessionNotice and MissedSessionAnswers
  ok('notice region found', start >= 0 && end > start);
  const prompt = start >= 0 && end > start ? home.slice(start, end) : '';
  // The three answers live in MissedSessionAnswers (one per half); the notice
  // itself mounts that component for the head and each follow-up.
  const answersStart = home.indexOf('function MissedSessionAnswers(');
  const answersEnd = home.indexOf('function missedQuestion', answersStart);
  const answers = answersStart >= 0 && answersEnd > answersStart ? home.slice(answersStart, answersEnd) : '';
  ok('exactly three chips', (answers.match(/<NoticeChip\b/g) ?? []).length === 3);
  ok('yes reads the signed row', prompt.includes("signedCopy('missed.prompt.yes')"));
  ok('no reads the signed row', prompt.includes("signedCopy('missed.prompt.no')"));
  ok('move reads the signed row', prompt.includes("signedCopy('missed.prompt.move')"));
  ok('the response type carries three answers',
    /'did_it' \| 'skipped_it' \| 'move_it'/.test(model));
  // THE WORDS ARE THE SHEET'S — including the weekday, which is why the
  // parameter is a signed row rather than a formatted string.
  ok('no question is authored in the screen',
    !/Did you do \{/.test(home) && !home.includes('Did you complete'));
  ok('the weekday is a signed parameter', /signedCopy\(`day\.name\.\$\{weekdayNameForISO/.test(home));
}

console.log('\n[2] It is at the TOP of the screen, above both shapes — and ONE at a time');
{
  // Sam, 2026-08-22: *"they should come up one at a time - not all at once.
  // start with most recent first"*. The hook derives the whole list — answering
  // one writes an outcome and the next takes its place — and the screen shows
  // its head, which the hook has already ordered newest-first.
  // One DAY at a time (Sam, 2026-09-09: both halves of a club night in the
  // same card): the head's date selects every notice for that day.
  ok('the screen renders the head of the list — every half of the most recent day',
    /notices=\{missedSessionNotices\.filter\(\(missed\) => missed\.date === missedSessionNotices\[0\]\.date\)\}/.test(home));
  ok('a club night\'s second half rides in the same card as a follow-up question',
    /followUps=\{rest\.map\(/.test(home) && /function MissedSessionAnswers\(/.test(home));
  ok('and does not stack them', !/notices=\{missedSessionNotices\}/.test(home));
  // TWO FACTS, NOT ONE WINDOWED REGEX: the memo between them carries the
  // three-fact boundary chain and is long enough that any character window is a
  // guess about prose length rather than a claim about behaviour.
  const noticesMemo = hook.slice(
    hook.indexOf('const missedSessionNotices = useMemo('),
    hook.indexOf('// ── THE BLOCK-BOUNDARY NOTICE ──'),
  );
  ok('the list is ordered newest-first by the owner',
    noticesMemo.includes('detectMissedSessions(') && noticesMemo.includes('.reverse()'));
}
console.log('\n[2] It is at the TOP of the screen, above both shapes');
{
  const noticeAt = home.indexOf('<MissedSessionNotice');
  const weekAt = home.indexOf('{dayFirst ? (', noticeAt);
  const dayCardAt = home.indexOf('{dayFirstDay ? renderDayRow');
  ok('mounted before the day/week branch', noticeAt > 0 && weekAt > noticeAt);
  ok('and therefore before the day card', dayCardAt > noticeAt);
  ok('exactly one mount for both shapes', (home.match(/<MissedSessionNotice\b/g) ?? []).length === 1);
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

console.log('\n[5] Move opens Week and uses the board owner');
{
  ok('move switches to Week and opens the existing board',
    /const openMissedMoveBoard[\s\S]{0,700}setPreferredProgramView\('week'\)[\s\S]{0,500}setWeekBoardOpen\(true\)/.test(home));
  ok('the missed identity reaches the board',
    /setMissedMoveSource\(\{ date: missed\.date, kind: missed\.kind \}\)/.test(home)
      && /moveSource=\{weekBoardMoveSource\}/.test(home));
  ok('dragging the named missed box directly is itself an explicit move answer',
    /const weekBoardMoveSource = useMemo/.test(home)
      && /const missed = weekBoardOpen \? missedSessionNotices\[0\] : null/.test(home));
  ok('past permission reaches the producer',
    /pastUnloggedMove:[\s\S]{0,120}sourceDate: weekBoardMoveSource\.date/.test(home));
  ok('past rows stay locked except for the one unlogged thing named by the prompt',
    /moveEnabled=\{row\.date >= todayISO \|\|/.test(board));
  ok('catch-up cannot move to another past date',
    /args\.toDate < todayISO/.test(home)
      && /!sourceIsPast \|\| candidate\.date >= args\.todayISO/.test(producer));
  ok('a past source cannot swap future work back into history',
    /if \(!sourceIsPast \|\| scope === 'team' \|\| destination\.occupiedBy === null\) return true/.test(producer));
  ok('the prompt kind limits which source scope is offered',
    /args\.pastMoveKind === 'team_training'[\s\S]{0,180}scope === 'team'/.test(producer)
      && /args\.pastMoveKind === 'session'[\s\S]{0,180}scope !== 'team'/.test(producer));
  ok('PlanChangeSheet accepts move entry',
    /type PlanChangeInitialAction = [^;]*'move'/.test(sheet)
      && /initialAction\??:\s*PlanChangeInitialAction/.test(sheet));
  const moveEntry = sheet.indexOf("initialAction === 'move'");
  const moveEntryStart = sheet.indexOf('startMove();', moveEntry);
  ok('move entry and menu use startMove', moveEntry >= 0 && moveEntryStart > moveEntry &&
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
