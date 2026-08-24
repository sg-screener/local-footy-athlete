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

console.log('\n[3] The live Log Session door captures before opening feedback');
const hook = read('screens/home/useDayWorkout.ts');
ok('the finish handler ends only the opened workout timer before showing feedback',
  /const handleFinishWorkout = useCallback\(\(\) => \{[\s\S]{0,320}endStopwatchFor\(\{[\s\S]{0,180}workoutId: workout\.id[\s\S]{0,180}dateISO: date[\s\S]{0,180}setIsFinished\(true\)/.test(hook));
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
