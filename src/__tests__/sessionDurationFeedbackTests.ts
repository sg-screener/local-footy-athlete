/**
 * Session-duration feedback contract — R-170 (Sam, 2026-08-24).
 *
 * Run: npm run test:session-duration-feedback
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseSessionDurationMinutes } from '../rules/sessionDuration';
import { useSessionStopwatchStore, measuredMinutesFor } from '../store/sessionStopwatchStore';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean): void {
  if (condition) {
    pass += 1;
    return;
  }
  fail += 1;
  failures.push(name);
  console.error(`  FAIL: ${name}`);
}

function read(relative: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');
}

console.log('\n[1] Every duration answer is one whole-minute value');
ok('ninety minutes is valid without an hours field',
  parseSessionDurationMinutes('90').valid
    && parseSessionDurationMinutes('90').totalMinutes === 90);
ok('blank, zero and fractional minutes are not completed answers',
  !parseSessionDurationMinutes('').valid
    && !parseSessionDurationMinutes('0').valid
    && !parseSessionDurationMinutes('12.5').valid);

const panel = read('components/SessionFeedbackPanel.tsx');
ok('team training, game and strength each render their one minutes field',
  /testID="club-training-feedback-minutes"/.test(panel)
    && /testID="game-feedback-minutes"/.test(panel)
    && /testID="strength-feedback-minutes"/.test(panel));
ok('no feedback form renders an hours field',
  !/-feedback-hours"/.test(panel)
    && !/GAME_FEEDBACK_COPY\.hours/.test(panel)
    && !/parseHoursMinutes/.test(panel));
ok('all three forms use the one minute parser',
  (panel.match(/parseSessionDurationMinutes\(/g) ?? []).length === 3);

console.log('\n[2] Pause, End and Log Session produce the same measurement');
const store = useSessionStopwatchStore;
store.setState({ current: null, lastEnded: null });
ok('no timer leaves the strength duration empty for a manual estimate',
  measuredMinutesFor({
    workoutId: 'strength-a',
    dateISO: '2026-08-24',
    nowISO: '2026-08-24T00:00:00.000Z',
  }) === null);
store.getState().start({
  workoutId: 'strength-a',
  dateISO: '2026-08-24',
  nowISO: '2026-08-24T00:00:00.000Z',
});
store.getState().pause('2026-08-24T00:42:20.000Z');
ok('a paused stopwatch immediately supplies its saved elapsed minutes',
  measuredMinutesFor({
    workoutId: 'strength-a',
    dateISO: '2026-08-24',
    nowISO: '2026-08-24T01:30:00.000Z',
  }) === 42);
ok('a different workout cannot inherit the paused measurement',
  measuredMinutesFor({
    workoutId: 'strength-b',
    dateISO: '2026-08-24',
    nowISO: '2026-08-24T01:30:00.000Z',
  }) === null);

const wrongEnd = store.getState().endFor({
  workoutId: 'strength-b',
  dateISO: '2026-08-24',
  nowISO: '2026-08-24T01:30:00.000Z',
});
ok('logging another workout does not stop this stopwatch',
  wrongEnd === null && store.getState().current?.workoutId === 'strength-a');

const logged = store.getState().endFor({
  workoutId: 'strength-a',
  dateISO: '2026-08-24',
  nowISO: '2026-08-24T01:30:00.000Z',
});
ok('Log Session finalises the paused value rather than counting the pause',
  logged?.measuredMinutes === 42
    && store.getState().current === null
    && store.getState().lastEnded?.measuredMinutes === 42);
ok('the ended measurement still pre-fills the matching strength session',
  measuredMinutesFor({
    workoutId: 'strength-a',
    dateISO: '2026-08-24',
    nowISO: '2026-08-24T02:00:00.000Z',
  }) === 42);

/* ⚠ **THE TIMER ENDS AT SAVE & FINISH, NOT AT LOG SESSION — SAM, 2026-08-25
 * (R-215): *"can you remove the option to hit 'end' after you hit start
 * session? the timer will just end when the user logs their session and hits
 * 'save and finish'."***
 *
 * The cell here USED TO REQUIRE the opposite — `handleFinishWorkout` ending the
 * stopwatch before `setIsFinished(true)` — and it is inverted rather than
 * deleted (`gate-must-watch-the-deleted-surface`).
 *
 * ⚠ **AND MOVING IT FIXES A SEPARATE DEFECT NOBODY HAD NAMED.** Log Session
 * only OPENS the feedback sheet, and `handleCancelFeedback` flips that flag
 * straight back — so under the old placement an athlete who opened the form and
 * cancelled had already lost their running timer, with no way to resume it. The
 * end now happens on the one action that cannot be taken back. */
console.log('\n[3] The timer ends when the session is saved, not when the form opens');
const hook = read('screens/home/useDayWorkout.ts');
ok('opening the feedback sheet no longer ends the timer — Log Session opens a '
  + 'sheet the athlete can still cancel out of',
  /const handleFinishWorkout = useCallback\(\(\) => \{\s*setIsFinished\(true\);\s*\}/.test(hook));
ok('Save & Finish ends only the opened workout timer',
  /const handleFeedbackSaved = useCallback\([\s\S]{0,700}endStopwatchFor\(\{[\s\S]{0,180}workoutId: workout\.id[\s\S]{0,180}dateISO: date/.test(hook));
ok('and cancelling the form cannot end it — the athlete who backs out keeps the '
  + 'count they were running',
  /const handleCancelFeedback = useCallback\(\(\) => \{\s*setIsFinished\(false\);\s*\}/.test(hook));

/* ══ 4. The End control is gone ══ */
console.log('\n[4] The header offers Start, Pause and Resume — never End');
const control = read('components/SessionStopwatchControl.tsx');
ok('the End button is removed from the running control — R-132 offered "pause or '
  + 'end", R-215 keeps the pause half only',
  !/session-stopwatch-end/.test(control)
    && !/SESSION_STOPWATCH_COPY\.end/.test(control));
ok('and the control no longer reaches the store\'s whole-session end at all — a '
  + 'handler with no button is the next screen\'s dead affordance',
  !/state\) => state\.end\b/.test(control));
ok('Pause and Resume both survive — only End was retired',
  /session-stopwatch-pause-resume/.test(control)
    && /SESSION_STOPWATCH_COPY\.pause/.test(control)
    && /SESSION_STOPWATCH_COPY\.resume/.test(control));
ok('the retired word is deregistered, not left signed for nobody — a signed '
  + 'string with no surface is copy the next build will find and use',
  // Comments stripped: the file still EXPLAINS the retirement by name, and a
  // cell that reddened on its own explanation would force the reason out too.
  !/session\.stopwatch\.end/.test(
    read('rules/sessionStopwatchCopy.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, ''),
  ));

/* THE STORE KEEPS `end`, AND THAT IS NOT AN OVERSIGHT: `endFor` is built on it
 * and Save & Finish is now its one caller. What was deleted is the BUTTON. */
ok('the store still ends a session, for the save door to call',
  typeof store.getState().end === 'function'
    && typeof store.getState().endFor === 'function');

console.log('\n[3b] The measurement the form reads is unchanged by the move');
ok('the strength form matches the timer by workout and date',
  /measuredMinutesFor\(\{[\s\S]{0,160}workoutId: workout\.id[\s\S]{0,160}dateISO: date/.test(panel));
ok('a previously saved manual answer outranks a timer measurement',
  /existing\?\.actualMinutes\s*\?\?\s*stopwatchMinutes/.test(panel));

console.log(`\nSummary: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}
