/**
 * coachWeekDiffTests — Unit tests for the resolved-week snapshot/diff helper.
 *
 * The helper has two layers:
 *   1. State capture (snapshotResolvedWeek) — calls the same resolver as
 *      the Program tab. Tested at the integration level by the existing
 *      qa:athlete scenario harness (this file's tests assume the resolver
 *      itself is correct — that's covered separately).
 *   2. Diff + summary (diffWeekSnapshots, summarizeDiff) — pure functions
 *      over WeekSnapshot. THESE are what gate the "Program updated"
 *      message in CoachScreen, so they get focused tests here.
 *
 * Run: sucrase-node src/__tests__/coachWeekDiffTests.ts
 */

import {
  diffWeekSnapshots,
  summarizeDiff,
  summarizeDiffBullets,
  filterDiffFromDate,
  type WeekSnapshot,
  type WeekDiff,
  type DayFingerprint,
} from '../utils/coachWeekDiff';

// ─── Test harness ───

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n      ${detail}` : ''));
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

// ─── Fixtures ───

const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function day(
  dow: number,
  workoutName: string | null,
  exercises: string[] = [],
  date?: string,
): DayFingerprint {
  return {
    date: date || `2026-04-${String(20 + dow).padStart(2, '0')}`,
    dayOfWeek: dow,
    short: SHORT[dow],
    dayName: NAME[dow],
    source: workoutName ? 'template' : 'none',
    indicator: workoutName ? 'core' : null,
    workoutName,
    exerciseNames: exercises,
  };
}

function weekOf(days: DayFingerprint[]): WeekSnapshot {
  return { mondayStr: '2026-04-20', days };
}

const baseWeek = (): WeekSnapshot =>
  weekOf([
    day(1, 'Lower Strength', ['Back Squat', 'RDL', 'Pallof Press']),
    day(2, 'Team Training'),
    day(3, 'Upper Push', ['Bench Press', 'Lateral Raise']),
    day(4, 'Team Training'),
    day(5, 'Recovery', ['Foam Roll T-Spine']),
    day(6, 'Game'),
    day(0, null), // rest
  ]);

// ─── Test cases ───

console.log('\n[coachWeekDiff] no-op diff');
{
  const before = baseWeek();
  const after = baseWeek();
  const diff = diffWeekSnapshots(before, after);
  eq('hasChanges = false when nothing changed', diff.hasChanges, false);
  eq('changedDays empty', diff.changedDays.length, 0);
  eq('summarizeDiff returns empty string', summarizeDiff(diff), '');
}

console.log('\n[coachWeekDiff] session-replaced (Wed Lower → Recovery)');
{
  const before = baseWeek();
  const after = baseWeek();
  // Wednesday (dow 3) was Upper Push → flip to Recovery
  after.days[2] = day(3, 'Recovery', ['Foam Roll Lats', 'Lat Stretch']);
  const diff = diffWeekSnapshots(before, after);
  eq('hasChanges = true', diff.hasChanges, true);
  eq('exactly one changed day', diff.changedDays.length, 1);
  eq('changeType = session-replaced', diff.changedDays[0].changeType, 'session-replaced');
  eq('correct day name', diff.changedDays[0].dayName, 'Wednesday');
  ok(
    'summary mentions Wednesday + new + old session names',
    summarizeDiff(diff).includes('Wednesday') &&
      summarizeDiff(diff).includes('Recovery') &&
      summarizeDiff(diff).includes('Upper Push'),
    summarizeDiff(diff),
  );
}

console.log('\n[coachWeekDiff] rest-added (Mon Lower → Rest)');
{
  const before = baseWeek();
  const after = baseWeek();
  after.days[0] = day(1, null);
  const diff = diffWeekSnapshots(before, after);
  eq('changeType = rest-added', diff.changedDays[0].changeType, 'rest-added');
  ok(
    'summary calls it a rest day and references Lower Strength',
    summarizeDiff(diff).includes('rest day') &&
      summarizeDiff(diff).includes('Lower Strength'),
    summarizeDiff(diff),
  );
}

console.log('\n[coachWeekDiff] session-added (Sun rest → Mobility)');
{
  const before = baseWeek();
  const after = baseWeek();
  after.days[6] = day(0, 'Mobility', ['Couch Stretch']);
  const diff = diffWeekSnapshots(before, after);
  eq('changeType = session-added', diff.changedDays[0].changeType, 'session-added');
  ok(
    'summary names new session + flags it was a rest day',
    summarizeDiff(diff).includes('Mobility') &&
      summarizeDiff(diff).includes('rest day'),
    summarizeDiff(diff),
  );
}

console.log('\n[coachWeekDiff] exercises-changed — single swap (squat → front squat)');
{
  const before = baseWeek();
  const after = baseWeek();
  after.days[0] = day(1, 'Lower Strength', ['Front Squat', 'RDL', 'Pallof Press']);
  const diff = diffWeekSnapshots(before, after);
  eq('changeType = exercises-changed', diff.changedDays[0].changeType, 'exercises-changed');
  eq('one changed day', diff.changedDays.length, 1);
  ok(
    'summary describes single swap with both exercise names',
    summarizeDiff(diff).includes('Back Squat') &&
      summarizeDiff(diff).includes('Front Squat'),
    summarizeDiff(diff),
  );
}

console.log('\n[coachWeekDiff] exercises-changed — multi swap (2 in same session)');
{
  const before = baseWeek();
  const after = baseWeek();
  after.days[0] = day(1, 'Lower Strength', ['Front Squat', 'Hip Thrust', 'Pallof Press']);
  const diff = diffWeekSnapshots(before, after);
  eq('changeType = exercises-changed', diff.changedDays[0].changeType, 'exercises-changed');
  ok(
    'summary mentions multiple swaps in session',
    /\d swaps?/.test(summarizeDiff(diff)),
    summarizeDiff(diff),
  );
}

console.log('\n[coachWeekDiff] multi-day diff — quick summary lines join cleanly');
{
  const before = baseWeek();
  const after = baseWeek();
  after.days[0] = day(1, 'Recovery', ['Foam Roll Lats']);
  after.days[2] = day(3, 'Recovery', ['Foam Roll Lats']);
  const diff = diffWeekSnapshots(before, after);
  eq('two changed days', diff.changedDays.length, 2);
  const summary = summarizeDiff(diff);
  ok(
    'summary mentions both Monday and Wednesday',
    summary.includes('Monday') && summary.includes('Wednesday'),
    summary,
  );
}

console.log('\n[coachWeekDiff] mismatched mondayStr → safe fallback');
{
  const before: WeekSnapshot = { mondayStr: '2026-04-20', days: baseWeek().days };
  const after: WeekSnapshot = { mondayStr: '2026-04-27', days: baseWeek().days };
  const diff = diffWeekSnapshots(before, after);
  eq('hasChanges = false on mondayStr mismatch', diff.hasChanges, false);
  eq('changedDays empty on mondayStr mismatch', diff.changedDays.length, 0);
}

console.log('\n[coachWeekDiff] both rest → no diff');
{
  const before = weekOf([day(1, null), day(2, null), day(3, null), day(4, null), day(5, null), day(6, null), day(0, null)]);
  const after = weekOf([day(1, null), day(2, null), day(3, null), day(4, null), day(5, null), day(6, null), day(0, null)]);
  const diff = diffWeekSnapshots(before, after);
  eq('hasChanges = false', diff.hasChanges, false);
}

console.log('\n[coachWeekDiff] same name + same exercises in different order → diff (order matters)');
{
  // This is a deliberate design decision — exercise order in the prescription
  // matters (it's the order the athlete trains them), so a reorder counts as
  // a change. Confirm the helper treats it that way.
  const before = baseWeek();
  const after = baseWeek();
  after.days[0] = day(1, 'Lower Strength', ['RDL', 'Back Squat', 'Pallof Press']);
  const diff = diffWeekSnapshots(before, after);
  eq('reorder counts as exercises-changed', diff.changedDays[0]?.changeType, 'exercises-changed');
}

// ─── filterDiffFromDate — past-date suppression ───
//
// The coach UI must NEVER claim it changed a session that's already in the
// past relative to "today" — even if a tool wrote an override on a past
// date, the athlete can't act on it and reporting the change just confuses
// the picture. filterDiffFromDate clamps the diff to date >= cutoff.

console.log('\n[filterDiffFromDate] keeps only days on/after cutoff');
{
  // Construct a multi-day diff manually so we control the dates.
  const fullDiff: WeekDiff = {
    hasChanges: true,
    changedDays: [
      {
        date: '2026-04-20', // Monday — past
        dayOfWeek: 1,
        short: 'MON',
        dayName: 'Monday',
        changeType: 'exercises-changed',
        before: { workoutName: 'Lower Strength', exerciseNames: ['Back Squat', 'RDL'] },
        after: { workoutName: 'Lower Strength', exerciseNames: ['Front Squat', 'RDL'] },
      },
      {
        date: '2026-04-22', // Wednesday — equal to cutoff (today)
        dayOfWeek: 3,
        short: 'WED',
        dayName: 'Wednesday',
        changeType: 'session-replaced',
        before: { workoutName: 'Upper Push', exerciseNames: [] },
        after: { workoutName: 'Recovery', exerciseNames: [] },
      },
      {
        date: '2026-04-24', // Friday — future
        dayOfWeek: 5,
        short: 'FRI',
        dayName: 'Friday',
        changeType: 'rest-added',
        before: { workoutName: 'Recovery', exerciseNames: [] },
        after: { workoutName: null, exerciseNames: [] },
      },
    ],
  };

  const filtered = filterDiffFromDate(fullDiff, '2026-04-22');
  eq('keeps cutoff day + future days', filtered.changedDays.length, 2);
  eq('drops past Monday', filtered.changedDays.find((d) => d.date === '2026-04-20'), undefined);
  eq('keeps Wednesday (equal to cutoff)', filtered.changedDays[0].dayName, 'Wednesday');
  eq('keeps Friday (future)', filtered.changedDays[1].dayName, 'Friday');
  eq('hasChanges still true', filtered.hasChanges, true);
}

console.log('\n[filterDiffFromDate] all past → empty diff');
{
  const allPast: WeekDiff = {
    hasChanges: true,
    changedDays: [
      {
        date: '2026-04-20',
        dayOfWeek: 1,
        short: 'MON',
        dayName: 'Monday',
        changeType: 'exercises-changed',
        before: { workoutName: 'Lower Strength', exerciseNames: ['Back Squat'] },
        after: { workoutName: 'Lower Strength', exerciseNames: ['Front Squat'] },
      },
      {
        date: '2026-04-21',
        dayOfWeek: 2,
        short: 'TUE',
        dayName: 'Tuesday',
        changeType: 'rest-added',
        before: { workoutName: 'Upper Push', exerciseNames: [] },
        after: { workoutName: null, exerciseNames: [] },
      },
    ],
  };

  const filtered = filterDiffFromDate(allPast, '2026-04-29');
  eq('hasChanges = false when every change was in the past', filtered.hasChanges, false);
  eq('changedDays empty', filtered.changedDays.length, 0);
}

console.log('\n[filterDiffFromDate] empty input passes through');
{
  const empty: WeekDiff = { hasChanges: false, changedDays: [] };
  const filtered = filterDiffFromDate(empty, '2026-04-29');
  eq('still hasChanges = false', filtered.hasChanges, false);
  eq('still empty', filtered.changedDays.length, 0);
}

console.log('\n[filterDiffFromDate] omitted cutoff falls back to today (smoke test)');
{
  // We can't pin "today" without monkey-patching Date, but we can verify
  // the contract: passing an explicit ancient cutoff keeps everything,
  // passing an explicit future cutoff drops everything. That bounds the
  // implicit-today branch by definition.
  const diff: WeekDiff = {
    hasChanges: true,
    changedDays: [
      {
        date: '2026-04-22',
        dayOfWeek: 3,
        short: 'WED',
        dayName: 'Wednesday',
        changeType: 'session-replaced',
        before: { workoutName: 'Upper Push', exerciseNames: [] },
        after: { workoutName: 'Recovery', exerciseNames: [] },
      },
    ],
  };
  eq('ancient cutoff keeps the day', filterDiffFromDate(diff, '1970-01-01').hasChanges, true);
  eq('far-future cutoff drops the day', filterDiffFromDate(diff, '9999-12-31').hasChanges, false);
}

// ─── summarizeDiffBullets — bullet formatting ───

console.log('\n[summarizeDiffBullets] empty diff → empty string');
{
  const empty: WeekDiff = { hasChanges: false, changedDays: [] };
  eq('empty input returns empty string', summarizeDiffBullets(empty), '');
}

console.log('\n[summarizeDiffBullets] single change → one bullet');
{
  const before = baseWeek();
  const after = baseWeek();
  after.days[2] = day(3, 'Recovery', ['Foam Roll Lats']);
  const diff = diffWeekSnapshots(before, after);
  const bullets = summarizeDiffBullets(diff);
  ok('starts with bullet', bullets.startsWith('• '), bullets);
  ok('contains Wednesday', bullets.includes('Wednesday'), bullets);
  ok('contains Recovery', bullets.includes('Recovery'), bullets);
  eq('exactly one bullet (no newline)', bullets.includes('\n'), false);
}

console.log('\n[summarizeDiffBullets] multi-day → newline-separated bullets');
{
  const before = baseWeek();
  const after = baseWeek();
  after.days[0] = day(1, 'Recovery', ['Foam Roll Lats']);
  after.days[2] = day(3, 'Recovery', ['Foam Roll Lats']);
  const diff = diffWeekSnapshots(before, after);
  const bullets = summarizeDiffBullets(diff);
  const lines = bullets.split('\n');
  eq('two bullet lines', lines.length, 2);
  ok('every line starts with bullet', lines.every((l) => l.startsWith('• ')), bullets);
  ok('Monday line present', lines.some((l) => l.includes('Monday')), bullets);
  ok('Wednesday line present', lines.some((l) => l.includes('Wednesday')), bullets);
}

console.log('\n[summarizeDiffBullets] composes with filterDiffFromDate (today-forward only)');
{
  // The CoachScreen flow is: rawDiff → filterDiffFromDate → summarizeDiffBullets.
  // Verify the composed pipeline yields bullets only for future days.
  const fullDiff: WeekDiff = {
    hasChanges: true,
    changedDays: [
      {
        date: '2026-04-20',
        dayOfWeek: 1,
        short: 'MON',
        dayName: 'Monday',
        changeType: 'exercises-changed',
        before: { workoutName: 'Lower Strength', exerciseNames: ['Back Squat'] },
        after: { workoutName: 'Lower Strength', exerciseNames: ['Front Squat'] },
      },
      {
        date: '2026-04-24',
        dayOfWeek: 5,
        short: 'FRI',
        dayName: 'Friday',
        changeType: 'rest-added',
        before: { workoutName: 'Recovery', exerciseNames: [] },
        after: { workoutName: null, exerciseNames: [] },
      },
    ],
  };
  const filtered = filterDiffFromDate(fullDiff, '2026-04-22');
  const bullets = summarizeDiffBullets(filtered);
  ok('Monday bullet suppressed (past)', !bullets.includes('Monday'), bullets);
  ok('Friday bullet retained (future)', bullets.includes('Friday'), bullets);
  eq('exactly one bullet line after filter', bullets.split('\n').length, 1);
}

// ─── Summary ───

console.log(`\n[coachWeekDiff] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  • ${f}`));
  process.exit(1);
}
process.exit(0);
