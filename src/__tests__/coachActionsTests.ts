/**
 * coachActionsTests — Scope-leak + dispatcher tests for the 8 coach actions.
 *
 * The action handlers in src/utils/coachActions.ts are the ONLY way the AI
 * can edit the program. Each action is scoped (LOCAL = single date, WEEKLY =
 * current Mon–Sun, PERMANENT = athlete preferences). These tests:
 *
 *   1. Verify the dispatcher routes every kind to the right handler.
 *   2. Verify each action mutates ONLY within its scope (no leakage).
 *   3. Verify silent-failure paths return { success: false, reason } so the
 *      CoachScreen no-op fallback fires instead of false-positive
 *      "Program updated" messages.
 *
 * Strategy:
 *   The handlers call into `useProgramStore.getState()` and
 *   `useAthletePreferencesStore.getState()`. We monkeypatch those getState
 *   methods to return spy objects that record calls. We also stub
 *   `resolveDateWithConditioning` so we can hand the handler a fixture
 *   workout for any date without booting the resolver.
 *
 * Run: sucrase-node src/__tests__/coachActionsTests.ts
 */

// React Native global used by some imports — mock for Node.
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

// Weekly actions intentionally resolve the current Mon-Sun window. Freeze the
// suite clock so those tests stay aligned with their 2026-04-20 fixtures.
const RealDate = Date;
const FIXED_NOW = '2026-04-26T12:00:00';

class FixedDate extends RealDate {
  constructor(...args: any[]) {
    if (args.length === 0) {
      super(FIXED_NOW);
      return;
    }
    if (args.length === 1) {
      super(args[0]);
      return;
    }
    super(
      args[0],
      args[1],
      args[2] ?? 1,
      args[3] ?? 0,
      args[4] ?? 0,
      args[5] ?? 0,
      args[6] ?? 0,
    );
  }

  static now(): number {
    return new RealDate(FIXED_NOW).getTime();
  }
}

global.Date = FixedDate as DateConstructor;

import * as sessionResolver from '../utils/sessionResolver';
import * as coachWeekDiff from '../utils/coachWeekDiff';
import { useProgramStore } from '../store/programStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import type { Workout, WorkoutExercise } from '../types/domain';

// ─── Spies / mocks ───

interface OverrideCall { date: string; workout: Workout; ctx?: any; }
let overrideCalls: OverrideCall[] = [];
let removeCalls: string[] = [];
let exclusionCalls: string[] = [];
let pinnedCalls: string[] = [];

function resetSpies() {
  overrideCalls = [];
  removeCalls = [];
  exclusionCalls = [];
  pinnedCalls = [];
}

(useProgramStore as any).getState = () => ({
  setManualOverride: (date: string, workout: Workout, ctx?: any) => {
    overrideCalls.push({ date, workout, ctx });
  },
  removeManualOverride: (date: string) => {
    removeCalls.push(date);
  },
});

(useAthletePreferencesStore as any).getState = () => ({
  addExclusion: (e: string) => exclusionCalls.push(e),
  addPinned: (e: string) => pinnedCalls.push(e),
});

// `buildScheduleStateImperative` only exists to feed `resolveDateWithConditioning`,
// which we're stubbing — so it doesn't matter what this returns.
(coachWeekDiff as any).buildScheduleStateImperative = () => ({});

// Per-test fixture for the resolver — defaults to "no workout on this date"
// so handlers without an explicit fixture exercise the no-op path.
let fixtureByDate: Record<string, Workout | null> = {};
(sessionResolver as any).resolveDateWithConditioning = (date: string) => {
  const w = fixtureByDate[date];
  return w ? { workout: w } : null;
};

function setFixture(date: string, workout: Workout | null) {
  fixtureByDate[date] = workout;
}
function resetFixtures() {
  fixtureByDate = {};
}

// Import AFTER spies are installed so the handlers see the mocks.
// (Module-level `import` is hoisted, but the .getState() calls happen at
// handler invocation time, so the order works out.)
import {
  lightenSession,
  moveSession,
  makeSessionOptional,
  replaceExerciseAtDate,
  removeExerciseAtDate,
  addExerciseAtDate,
  addWeeklyOverride,
  banExerciseGlobally,
  setPreferredAlternative,
  applyCoachAction,
  applyCoachActions,
  type CoachAction,
} from '../utils/coachActions';

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

function reset() {
  resetSpies();
  resetFixtures();
}

// ─── Workout factories ───

function makeExercise(name: string, sets = 3, repsMin = 6, repsMax = 8): WorkoutExercise {
  return {
    id: `we-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    workoutId: '',
    exerciseId: `ex-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    exerciseOrder: 0,
    prescribedSets: sets,
    prescribedRepsMin: repsMin,
    prescribedRepsMax: repsMax,
    prescribedWeightKg: 0,
    restSeconds: 0,
    exercise: {
      id: `ex-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name,
      description: name,
      exerciseType: 'Compound' as any,
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate' as any,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as any,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function makeWorkout(
  name: string,
  exercises: WorkoutExercise[] = [],
  overrides: Partial<Workout> = {},
): Workout {
  return {
    id: `wk-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    microcycleId: 'mc-test',
    dayOfWeek: 1,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate' as any,
    workoutType: 'Strength' as any,
    sessionTier: 'core',
    exercises,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Workout;
}

// ─── Test cases ───

// 1. lighten_session — default level=optional halves sets and flips tier
console.log('\n[coachActions] lighten_session (level=optional)');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Strength', [
    makeExercise('Back Squat', 4),
    makeExercise('RDL', 3),
  ]));
  const result = lightenSession({ date });
  eq('returns success', result.success, true);
  eq('one override written', overrideCalls.length, 1);
  eq('override date == input date', overrideCalls[0]?.date, date);
  eq('tier flipped to optional', overrideCalls[0]?.workout?.sessionTier, 'optional');
  // 4 → 2, 3 → 2 (Math.ceil(3/2))
  eq('Back Squat sets halved', overrideCalls[0]?.workout?.exercises[0]?.prescribedSets, 2);
  eq('RDL sets halved (ceil)', overrideCalls[0]?.workout?.exercises[1]?.prescribedSets, 2);
  // SCOPE: only one date touched
  eq('no other dates touched', overrideCalls.length, 1);
  eq('no removeManualOverride calls', removeCalls.length, 0);
  eq('no preference writes', exclusionCalls.length + pinnedCalls.length, 0);
}

// 2. lighten_session level=recovery → empty exercises, recovery shell
console.log('\n[coachActions] lighten_session (level=recovery)');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Strength', [makeExercise('Back Squat', 4)]));
  const result = lightenSession({ date, level: 'recovery' });
  eq('success', result.success, true);
  eq('tier=recovery', overrideCalls[0]?.workout?.sessionTier, 'recovery');
  eq('exercises empty', overrideCalls[0]?.workout?.exercises?.length, 0);
  eq('workoutType=Recovery', overrideCalls[0]?.workout?.workoutType, 'Recovery');
}

// 3. lighten_session no-op when no workout
console.log('\n[coachActions] lighten_session (no workout → no-op)');
{
  reset();
  const result = lightenSession({ date: '2026-04-27' });
  eq('success=false', result.success, false);
  ok('reason mentions the date', !!result.reason && result.reason.includes('2026-04-27'), result.reason);
  eq('zero overrides written', overrideCalls.length, 0);
}

// 4. move_session — full swap when both have workouts
console.log('\n[coachActions] move_session (full swap)');
{
  reset();
  const fromDate = '2026-04-22'; // Wed
  const toDate = '2026-04-23';   // Thu
  setFixture(fromDate, makeWorkout('Wed-Lower'));
  setFixture(toDate, makeWorkout('Thu-Upper'));
  const result = moveSession({ fromDate, toDate });
  eq('success', result.success, true);
  eq('two overrides written', overrideCalls.length, 2);
  // First call: from → to
  eq('first override targets toDate', overrideCalls[0]?.date, toDate);
  eq('first override carries Wed workout name', overrideCalls[0]?.workout?.name, 'Wed-Lower');
  // Second call: to → from (swap)
  eq('second override targets fromDate', overrideCalls[1]?.date, fromDate);
  eq('second override carries Thu workout name', overrideCalls[1]?.workout?.name, 'Thu-Upper');
  // SCOPE: removeManualOverride NOT called when both sides have workouts
  eq('no remove calls (full swap)', removeCalls.length, 0);
}

// 5. move_session — clear source when destination is empty
console.log('\n[coachActions] move_session (empty target)');
{
  reset();
  setFixture('2026-04-22', makeWorkout('Wed-Lower'));
  // toDate has no fixture → resolver returns null
  const result = moveSession({ fromDate: '2026-04-22', toDate: '2026-04-23' });
  eq('success', result.success, true);
  eq('one override (to-side only)', overrideCalls.length, 1);
  eq('override targets toDate', overrideCalls[0]?.date, '2026-04-23');
  eq('one remove (source cleared)', removeCalls.length, 1);
  eq('remove targets fromDate', removeCalls[0], '2026-04-22');
}

// 6. move_session — same-date no-op
console.log('\n[coachActions] move_session (same date)');
{
  reset();
  setFixture('2026-04-22', makeWorkout('Anything'));
  const result = moveSession({ fromDate: '2026-04-22', toDate: '2026-04-22' });
  eq('success=false', result.success, false);
  eq('no overrides written', overrideCalls.length, 0);
  eq('no removes written', removeCalls.length, 0);
}

// 7. move_session — no source workout
console.log('\n[coachActions] move_session (no source)');
{
  reset();
  const result = moveSession({ fromDate: '2026-04-22', toDate: '2026-04-23' });
  eq('success=false', result.success, false);
  ok('reason names the source', !!result.reason && result.reason.includes('2026-04-22'), result.reason);
  eq('no writes', overrideCalls.length + removeCalls.length, 0);
}

// 8. make_session_optional — flips tier without touching exercises
console.log('\n[coachActions] make_session_optional');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Strength', [
    makeExercise('Back Squat', 4),
    makeExercise('RDL', 3),
  ]));
  const result = makeSessionOptional({ date });
  eq('success', result.success, true);
  eq('tier=optional', overrideCalls[0]?.workout?.sessionTier, 'optional');
  // Exercises preserved at original sets
  eq('Back Squat sets unchanged', overrideCalls[0]?.workout?.exercises[0]?.prescribedSets, 4);
  eq('RDL sets unchanged', overrideCalls[0]?.workout?.exercises[1]?.prescribedSets, 3);
}

// 9. replace_exercise — single exercise swapped on a single date
console.log('\n[coachActions] replace_exercise (case-insensitive match)');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Strength', [
    makeExercise('Back Squat', 4),
    makeExercise('RDL', 3),
  ]));
  const result = replaceExerciseAtDate({
    date,
    fromExercise: 'back squat', // case-insensitive
    toExercise: { name: 'Front Squat', sets: 3, repsMin: 5, repsMax: 7 },
  });
  eq('success', result.success, true);
  eq('one override on the input date', overrideCalls.length, 1);
  eq('override date matches', overrideCalls[0]?.date, date);
  const exercises = overrideCalls[0]?.workout?.exercises || [];
  eq('still 2 exercises', exercises.length, 2);
  eq('first exercise renamed', exercises[0]?.exercise?.name, 'Front Squat');
  eq('first exercise sets=3', exercises[0]?.prescribedSets, 3);
  eq('second exercise untouched (RDL)', exercises[1]?.exercise?.name, 'RDL');
}

// 10. replace_exercise — no match → no-op
console.log('\n[coachActions] replace_exercise (not found)');
{
  reset();
  setFixture('2026-04-27', makeWorkout('Upper Push', [makeExercise('Bench Press', 3)]));
  const result = replaceExerciseAtDate({
    date: '2026-04-27',
    fromExercise: 'Back Squat',
    toExercise: { name: 'Front Squat', sets: 3, repsMin: 5, repsMax: 7 },
  });
  eq('success=false', result.success, false);
  ok('reason names the missing exercise', !!result.reason && result.reason.includes('Back Squat'), result.reason);
  eq('no override written', overrideCalls.length, 0);
}

// 11. remove_exercise — exercise filtered out
console.log('\n[coachActions] remove_exercise');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Strength', [
    makeExercise('Back Squat', 4),
    makeExercise('RDL', 3),
    makeExercise('Pallof Press', 3),
  ]));
  const result = removeExerciseAtDate({ date, exercise: 'RDL' });
  eq('success', result.success, true);
  const exercises = overrideCalls[0]?.workout?.exercises || [];
  eq('two exercises remain', exercises.length, 2);
  eq('Back Squat kept', exercises[0]?.exercise?.name, 'Back Squat');
  eq('Pallof Press kept', exercises[1]?.exercise?.name, 'Pallof Press');
}

// 12. remove_exercise — not found
console.log('\n[coachActions] remove_exercise (not found)');
{
  reset();
  setFixture('2026-04-27', makeWorkout('Upper Push', [makeExercise('Bench Press', 3)]));
  const result = removeExerciseAtDate({ date: '2026-04-27', exercise: 'RDL' });
  eq('success=false', result.success, false);
  eq('no override written', overrideCalls.length, 0);
}

// 13. add_weekly_override — reduce_lower_volume halves only lower-pattern sets
console.log('\n[coachActions] add_weekly_override (reduce_lower_volume)');
{
  reset();
  // The fixed suite clock is Sunday 2026-04-26, so the current week is
  // Monday 2026-04-20 through Sunday 2026-04-26.
  // We'll seed two days: Mon (lower) + Wed (upper) and verify only Mon mutates.
  setFixture('2026-04-20', makeWorkout('Lower Strength', [
    makeExercise('Back Squat', 4),
    makeExercise('RDL', 3),
  ]));
  setFixture('2026-04-22', makeWorkout('Upper Push', [
    makeExercise('Bench Press', 4),
    makeExercise('Lateral Raise', 3),
  ]));
  const result = addWeeklyOverride({ rule: 'reduce_lower_volume' });
  eq('success', result.success, true);
  // SURGICAL: only the Mon (lower) day should get an override. The Wed
  // upper day has no lower-pattern exercises → no proposal built → no
  // override written. This is the key surgical-behavior test.
  eq('one override (lower day only — surgical)', overrideCalls.length, 1);
  eq('override targets Mon (2026-04-20)', overrideCalls[0]?.date, '2026-04-20');
  const monEx = overrideCalls[0]?.workout?.exercises || [];
  eq('Mon Back Squat halved (4→2)', monEx[0]?.prescribedSets, 2);
  eq('Mon RDL halved (3→2 ceil)', monEx[1]?.prescribedSets, 2);
  // Wed must NOT have an override at all
  ok('no override for Wed (upper-only day)',
    !overrideCalls.some(c => c.date === '2026-04-22'),
    overrideCalls.map(c => c.date).join(','));
  // SCOPE: nothing outside Mon-Sun touched, nothing in athletePreferences touched
  ok('all override dates within current week',
    overrideCalls.every(c => c.date >= '2026-04-20' && c.date <= '2026-04-26'),
    overrideCalls.map(c => c.date).join(','));
  eq('no preference writes', exclusionCalls.length + pinnedCalls.length, 0);
}

// 14. add_weekly_override — no_running strips conditioning blocks
console.log('\n[coachActions] add_weekly_override (no_running)');
{
  reset();
  const wedWorkout = makeWorkout('Mixed', [
    makeExercise('Back Squat', 4),
    makeExercise('400m Run', 3),
  ], {
    hasCombinedConditioning: true,
    conditioningBlock: { id: 'cb-1', intent: 'conditioning', options: [] } as any,
  });
  setFixture('2026-04-22', wedWorkout);
  const result = addWeeklyOverride({ rule: 'no_running' });
  eq('success', result.success, true);
  eq('one override written', overrideCalls.length, 1);
  eq('conditioning block cleared', overrideCalls[0]?.workout?.conditioningBlock, undefined);
  eq('hasCombinedConditioning false', overrideCalls[0]?.workout?.hasCombinedConditioning, false);
  // 400m Run filtered by RUN_PATTERN
  const remaining = overrideCalls[0]?.workout?.exercises || [];
  eq('one exercise remains', remaining.length, 1);
  eq('Back Squat kept', remaining[0]?.exercise?.name, 'Back Squat');
}

// 15. add_weekly_override — no matches → success=false (week is empty for that rule)
console.log('\n[coachActions] add_weekly_override (no-op week)');
{
  reset();
  // Empty week — nothing to touch
  const result = addWeeklyOverride({ rule: 'reduce_lower_volume' });
  eq('success=false', result.success, false);
  eq('no overrides written', overrideCalls.length, 0);
}

// 16. ban_exercise_globally
console.log('\n[coachActions] ban_exercise_globally');
{
  reset();
  const result = banExerciseGlobally({ exercise: 'Lateral Raise' });
  eq('success', result.success, true);
  eq('one exclusion added', exclusionCalls.length, 1);
  eq('exclusion is the exact name', exclusionCalls[0], 'Lateral Raise');
  // SCOPE: no current-week mutations
  eq('no override writes', overrideCalls.length, 0);
  eq('no remove writes', removeCalls.length, 0);
  eq('no pinned writes', pinnedCalls.length, 0);
}

// 17. ban_exercise_globally — empty input
console.log('\n[coachActions] ban_exercise_globally (empty)');
{
  reset();
  const result = banExerciseGlobally({ exercise: '   ' });
  eq('success=false', result.success, false);
  eq('no exclusion added', exclusionCalls.length, 0);
}

// 18. set_preferred_alternative — composes addExclusion + addPinned
console.log('\n[coachActions] set_preferred_alternative');
{
  reset();
  const result = setPreferredAlternative({ exercise: 'Back Squat', alternative: 'Front Squat' });
  eq('success', result.success, true);
  eq('one exclusion added', exclusionCalls.length, 1);
  eq('exclusion is original', exclusionCalls[0], 'Back Squat');
  eq('one pinned added', pinnedCalls.length, 1);
  eq('pinned is alternative', pinnedCalls[0], 'Front Squat');
  // SCOPE: no current-week mutations
  eq('no override writes', overrideCalls.length, 0);
}

// 19. set_preferred_alternative — same exercise rejected
console.log('\n[coachActions] set_preferred_alternative (same)');
{
  reset();
  const result = setPreferredAlternative({ exercise: 'Squat', alternative: 'squat' });
  eq('success=false', result.success, false);
  eq('no exclusion added', exclusionCalls.length, 0);
  eq('no pinned added', pinnedCalls.length, 0);
}

// ─── Surgical-behavior tests: no-op days never get overrides ───

console.log('\n[coachActions] lighten_session no-op when already at minimum load');
{
  reset();
  const date = '2026-04-27';
  // Already a recovery shell with no exercises — lightening to optional
  // would still flip tier, so the comparator will detect a change. Use an
  // already-optional 1-set workout to truly trigger the no-op path.
  setFixture(date, makeWorkout('Mobility', [makeExercise('Foam Roll', 1)], { sessionTier: 'optional' }));
  const result = lightenSession({ date });
  eq('success=false (already minimum)', result.success, false);
  ok('reason mentions minimum load', !!result.reason && /minimum|already/i.test(result.reason), result.reason);
  eq('no override written', overrideCalls.length, 0);
}

console.log('\n[coachActions] lighten_session level=recovery no-op when already recovery');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Recovery', [], {
    sessionTier: 'recovery',
    workoutType: 'Recovery',
    hasCombinedConditioning: false,
  }));
  const result = lightenSession({ date, level: 'recovery' });
  eq('success=false (already recovery)', result.success, false);
  eq('no override written', overrideCalls.length, 0);
}

console.log('\n[coachActions] make_session_optional no-op when already optional');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Mobility', [makeExercise('Foam Roll', 2)], { sessionTier: 'optional' }));
  const result = makeSessionOptional({ date });
  eq('success=false (already optional)', result.success, false);
  ok('reason mentions already optional', !!result.reason && result.reason.includes('already'), result.reason);
  eq('no override written', overrideCalls.length, 0);
}

console.log('\n[coachActions] add_weekly_override (no_running) leaves clean weeks alone');
{
  reset();
  // Lower day with no running exercises and no conditioning block — should
  // be left completely alone by the no_running rule.
  setFixture('2026-04-20', makeWorkout('Lower Strength', [
    makeExercise('Back Squat', 4),
    makeExercise('RDL', 3),
  ]));
  const result = addWeeklyOverride({ rule: 'no_running' });
  eq('success=false (nothing to strip)', result.success, false);
  eq('no overrides written', overrideCalls.length, 0);
}

console.log('\n[coachActions] add_weekly_override (remove_optional_sessions) only touches optional days');
{
  reset();
  // Mon = core lower (must stay), Wed = optional (must be cleared)
  setFixture('2026-04-20', makeWorkout('Lower Strength', [makeExercise('Back Squat', 4)], { sessionTier: 'core' }));
  setFixture('2026-04-22', makeWorkout('Optional Arms', [makeExercise('Curls', 3)], { sessionTier: 'optional' }));
  const result = addWeeklyOverride({ rule: 'remove_optional_sessions' });
  eq('success', result.success, true);
  eq('exactly one override (the optional day only)', overrideCalls.length, 1);
  eq('override targets Wed', overrideCalls[0]?.date, '2026-04-22');
  eq('Wed converted to Rest shell', overrideCalls[0]?.workout?.name, 'Rest');
  ok('no override for Mon core day',
    !overrideCalls.some(c => c.date === '2026-04-20'),
    overrideCalls.map(c => c.date).join(','));
}

console.log('\n[coachActions] add_weekly_override (reduce_intensity) on mixed week');
{
  reset();
  // Core day (must change: tier flips + sets halve) + recovery shell day
  // (no exercises, recovery tier — must NOT be touched)
  setFixture('2026-04-20', makeWorkout('Lower Strength', [makeExercise('Back Squat', 4)], { sessionTier: 'core' }));
  setFixture('2026-04-22', makeWorkout('Recovery', [], { sessionTier: 'recovery', workoutType: 'Recovery' }));
  const result = addWeeklyOverride({ rule: 'reduce_intensity' });
  eq('success', result.success, true);
  eq('one override (core day only, recovery skipped)', overrideCalls.length, 1);
  eq('override targets Mon (the core day)', overrideCalls[0]?.date, '2026-04-20');
  eq('Mon tier flipped to optional', overrideCalls[0]?.workout?.sessionTier, 'optional');
  eq('Mon Back Squat sets halved (4→2)', overrideCalls[0]?.workout?.exercises[0]?.prescribedSets, 2);
  ok('Wed recovery untouched',
    !overrideCalls.some(c => c.date === '2026-04-22'),
    overrideCalls.map(c => c.date).join(','));
}

console.log('\n[coachActions] replace_exercise no-op when from === to');
{
  reset();
  const date = '2026-04-27';
  // A "swap" with identical sets/reps/weight on a same-named exercise.
  setFixture(date, makeWorkout('Lower Strength', [makeExercise('Back Squat', 3, 6, 8)]));
  const result = replaceExerciseAtDate({
    date,
    fromExercise: 'Back Squat',
    toExercise: { name: 'Back Squat', sets: 3, repsMin: 6, repsMax: 8 },
  });
  eq('success=false (same prescription)', result.success, false);
  eq('no override written', overrideCalls.length, 0);
}

// 20. applyCoachAction — dispatches each kind correctly
console.log('\n[coachActions] applyCoachAction (dispatcher routing)');
{
  // We just verify each kind reaches its handler by checking the recorded
  // side-effect (or success/failure for input-only handlers).
  reset();
  setFixture('2026-04-27', makeWorkout('X', [makeExercise('Bench Press', 3)]));
  const cases: Array<{ kind: CoachAction['kind']; payload: any; expectsSuccess: boolean; }> = [
    { kind: 'lighten_session', payload: { date: '2026-04-27' }, expectsSuccess: true },
    { kind: 'make_session_optional', payload: { date: '2026-04-27' }, expectsSuccess: true },
    { kind: 'remove_exercise', payload: { date: '2026-04-27', exercise: 'Bench Press' }, expectsSuccess: true },
    { kind: 'ban_exercise_globally', payload: { exercise: 'Burpees' }, expectsSuccess: true },
    { kind: 'set_preferred_alternative', payload: { exercise: 'A', alternative: 'B' }, expectsSuccess: true },
    { kind: 'save_note', payload: {}, expectsSuccess: true },
  ];
  for (const c of cases) {
    // Re-seed fixture between iterations since some handlers consume it.
    setFixture('2026-04-27', makeWorkout('X', [makeExercise('Bench Press', 3)]));
    const r = applyCoachAction({ kind: c.kind, payload: c.payload });
    ok(`${c.kind} → success=${c.expectsSuccess}`, r.success === c.expectsSuccess, `got ${JSON.stringify(r)}`);
  }
  // Unknown kind
  const unknown = applyCoachAction({ kind: 'nonsense' as any, payload: {} });
  eq('unknown kind → success=false', unknown.success, false);
  ok('unknown kind reason mentions kind', !!unknown.reason && unknown.reason.includes('nonsense'), unknown.reason);
}

// 21. applyCoachActions — batch with one failure, one success
console.log('\n[coachActions] applyCoachActions (batch)');
{
  reset();
  setFixture('2026-04-27', makeWorkout('X', [makeExercise('Bench Press', 3)]));
  const results = applyCoachActions([
    { kind: 'lighten_session', payload: { date: '2026-04-27' } },
    { kind: 'lighten_session', payload: { date: '2026-04-29' } }, // no fixture → no-op
    { kind: 'ban_exercise_globally', payload: { exercise: 'Burpees' } },
  ]);
  eq('three results returned', results.length, 3);
  eq('first succeeded', results[0]?.success, true);
  eq('second failed (no workout)', results[1]?.success, false);
  eq('third succeeded', results[2]?.success, true);
}

// ─── Exercise-swap precision tests ───
//
// These cover the upgraded findExerciseMatch tier ladder (exact → alias →
// safe-fuzzy) and the alias-resolved permanent preferences. The key
// invariant: when the user's phrase could mean two different exercises in
// the resolved session, the action must REJECT (success=false) with the
// candidates surfaced — never silently pick the first match.

// 22. replace_exercise — exact canonical match wins immediately
console.log('\n[coachActions] replace_exercise (precision: exact canonical)');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Strength', [
    makeExercise('Back Squat', 4),
    makeExercise('Goblet Squat', 3),
  ]));
  const result = replaceExerciseAtDate({
    date,
    fromExercise: 'Back Squat', // exact canonical
    toExercise: { name: 'Front Squat', sets: 3, repsMin: 5, repsMax: 7 },
  });
  eq('success', result.success, true);
  eq('one override written', overrideCalls.length, 1);
  const ex = overrideCalls[0]?.workout?.exercises || [];
  eq('Back Squat → Front Squat', ex[0]?.exercise?.name, 'Front Squat');
  eq('Goblet Squat untouched', ex[1]?.exercise?.name, 'Goblet Squat');
}

// 23. replace_exercise — alias resolves to single canonical
console.log('\n[coachActions] replace_exercise (precision: alias match)');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Strength', [
    makeExercise('RDLs', 3),
    makeExercise('Back Squat', 4),
  ]));
  // "romanian deadlift" → alias → "RDLs" (canonical) → unique match in workout
  const result = replaceExerciseAtDate({
    date,
    fromExercise: 'romanian deadlift',
    toExercise: { name: 'Hip Thrusts', sets: 3, repsMin: 8, repsMax: 10 },
  });
  eq('success (alias resolved)', result.success, true);
  const ex = overrideCalls[0]?.workout?.exercises || [];
  eq('RDLs replaced', ex[0]?.exercise?.name, 'Hip Thrusts');
  eq('Back Squat untouched', ex[1]?.exercise?.name, 'Back Squat');
}

// 24. replace_exercise — ambiguous "squat" returns candidates, writes nothing
console.log('\n[coachActions] replace_exercise (precision: ambiguous squat)');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Strength', [
    makeExercise('Back Squat', 4),
    makeExercise('Goblet Squat', 3),
    makeExercise('Bulgarian Split Squats', 3),
  ]));
  const result = replaceExerciseAtDate({
    date,
    fromExercise: 'squat', // matches 3 candidates via tier-3 fuzzy
    toExercise: { name: 'Front Squat', sets: 3, repsMin: 5, repsMax: 7 },
  });
  eq('success=false (ambiguous)', result.success, false);
  ok('ambiguous candidates populated', !!result.ambiguous && result.ambiguous.candidates.length === 3,
    `ambiguous=${JSON.stringify(result.ambiguous)}`);
  ok('candidates include all three squats',
    !!result.ambiguous &&
    result.ambiguous.candidates.includes('Back Squat') &&
    result.ambiguous.candidates.includes('Goblet Squat') &&
    result.ambiguous.candidates.includes('Bulgarian Split Squats'),
    JSON.stringify(result.ambiguous));
  eq('NO override written (ambiguous never mutates)', overrideCalls.length, 0);
  ok('reason explains the ambiguity', !!result.reason && /multiple/i.test(result.reason), result.reason);
}

// 25. replace_exercise — RDL vs Single-Leg RDL precision
console.log('\n[coachActions] replace_exercise (precision: RDL vs Single-Leg RDL)');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Hinge', [
    makeExercise('RDLs', 3),
    makeExercise('Single-Leg RDL', 2),
  ]));
  // "rdl" alias → canonical "RDLs" → matches RDLs uniquely (Single-Leg RDL
  // has a different canonical name).
  const result = replaceExerciseAtDate({
    date,
    fromExercise: 'rdl',
    toExercise: { name: 'Hip Thrusts', sets: 3, repsMin: 8, repsMax: 10 },
  });
  eq('success (RDL → RDLs uniquely)', result.success, true);
  const ex = overrideCalls[0]?.workout?.exercises || [];
  eq('RDLs replaced', ex[0]?.exercise?.name, 'Hip Thrusts');
  eq('Single-Leg RDL untouched', ex[1]?.exercise?.name, 'Single-Leg RDL');
  eq('Single-Leg RDL sets unchanged', ex[1]?.prescribedSets, 2);
}

// 26. replace_exercise — Single-Leg RDL targeted via specific phrase
console.log('\n[coachActions] replace_exercise (precision: single-leg specific)');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Hinge', [
    makeExercise('RDLs', 3),
    makeExercise('Single-Leg RDL', 2),
  ]));
  const result = replaceExerciseAtDate({
    date,
    fromExercise: 'single leg rdl', // alias → 'Single-Leg RDL'
    toExercise: { name: 'Step Ups', sets: 3, repsMin: 6, repsMax: 8 },
  });
  eq('success', result.success, true);
  const ex = overrideCalls[0]?.workout?.exercises || [];
  eq('RDLs untouched', ex[0]?.exercise?.name, 'RDLs');
  eq('Single-Leg RDL replaced', ex[1]?.exercise?.name, 'Step Ups');
}

// 27. remove_exercise — ambiguous bench (Bench Press + DB Bench Press)
console.log('\n[coachActions] remove_exercise (precision: ambiguous bench)');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Upper Push', [
    makeExercise('Bench Press', 4),
    makeExercise('DB Bench Press', 3),
  ]));
  // "bench" appears as substring in both candidate names → ambiguous
  const result = removeExerciseAtDate({ date, exercise: 'bench' });
  eq('success=false (ambiguous)', result.success, false);
  ok('ambiguous candidates populated', !!result.ambiguous, JSON.stringify(result.ambiguous));
  eq('two candidates returned', result.ambiguous?.candidates.length, 2);
  eq('NO override written', overrideCalls.length, 0);
}

// 27b. remove_exercise — tapped row identity beats ambiguous text
console.log('\n[coachActions] remove_exercise (row id disambiguates)');
{
  reset();
  const date = '2026-04-27';
  const bench = makeExercise('Bench Press', 4);
  const dbBench = makeExercise('DB Bench Press', 3);
  setFixture(date, makeWorkout('Upper Push', [bench, dbBench]));
  const result = removeExerciseAtDate({
    date,
    exercise: 'bench',
    exerciseId: bench.id,
  });
  eq('success with row id', result.success, true);
  const exercises = overrideCalls[0]?.workout?.exercises || [];
  eq('one exercise remains', exercises.length, 1);
  eq('specific tapped row removed', exercises[0]?.exercise?.name, 'DB Bench Press');
}

// 27c. replace_exercise — tapped row identity beats ambiguous text
console.log('\n[coachActions] replace_exercise (row id disambiguates)');
{
  reset();
  const date = '2026-04-27';
  const bench = makeExercise('Bench Press', 4);
  const dbBench = makeExercise('DB Bench Press', 3);
  setFixture(date, makeWorkout('Upper Push', [bench, dbBench]));
  const result = replaceExerciseAtDate({
    date,
    fromExercise: 'bench',
    fromExerciseId: dbBench.id,
    toExercise: { name: 'Push-Ups', sets: 3, repsMin: 8, repsMax: 12 },
  });
  eq('success with row id', result.success, true);
  const exercises = overrideCalls[0]?.workout?.exercises || [];
  eq('exercise count unchanged', exercises.length, 2);
  eq('untapped row untouched', exercises[0]?.exercise?.name, 'Bench Press');
  eq('specific tapped row replaced', exercises[1]?.exercise?.name, 'Push-Ups');
}

// 27d. add_exercise — appends a deterministic date override
console.log('\n[coachActions] add_exercise (append to date override)');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Upper Push', [
    makeExercise('Bench Press', 4),
  ]));
  const result = addExerciseAtDate({
    date,
    exercise: { name: 'Pallof Press', sets: 2, repsMin: 10, repsMax: 12 },
  });
  eq('success', result.success, true);
  const exercises = overrideCalls[0]?.workout?.exercises || [];
  eq('exercise appended', exercises.length, 2);
  eq('new exercise name', exercises[1]?.exercise?.name, 'Pallof Press');
  eq('new exercise order follows existing rows', exercises[1]?.exerciseOrder, 1);
}

// 28. ban_exercise_globally — alias resolves to canonical before persisting
console.log('\n[coachActions] ban_exercise_globally (alias-resolved canonical)');
{
  reset();
  const result = banExerciseGlobally({ exercise: 'romanian deadlift' });
  eq('success', result.success, true);
  eq('one exclusion added', exclusionCalls.length, 1);
  // Critical: the canonical "RDLs" is stored, NOT the user's input phrase.
  // This is what the pool rotation actually emits, so the exclusion list
  // matches what future programs would generate.
  eq('exclusion stored as canonical (RDLs)', exclusionCalls[0], 'RDLs');
}

// 29. ban_exercise_globally — non-alias name passes through unchanged
console.log('\n[coachActions] ban_exercise_globally (no alias → unchanged)');
{
  reset();
  const result = banExerciseGlobally({ exercise: 'Lateral Raise' });
  eq('success', result.success, true);
  eq('one exclusion added', exclusionCalls.length, 1);
  eq('exclusion stored verbatim', exclusionCalls[0], 'Lateral Raise');
}

// 30. set_preferred_alternative — both sides alias-resolved
console.log('\n[coachActions] set_preferred_alternative (canonical pair)');
{
  reset();
  const result = setPreferredAlternative({
    exercise: 'barbell squat',     // alias → 'Back Squat'
    alternative: 'goblet squats',  // alias → 'Goblet Squat'
  });
  eq('success', result.success, true);
  eq('one exclusion (canonical Back Squat)', exclusionCalls[0], 'Back Squat');
  eq('one pinned (canonical Goblet Squat)', pinnedCalls[0], 'Goblet Squat');
}

// 31. set_preferred_alternative — same canonical pair rejected
console.log('\n[coachActions] set_preferred_alternative (alias collision)');
{
  reset();
  // "rdl" and "romanian deadlift" both alias to "RDLs" — must reject.
  const result = setPreferredAlternative({
    exercise: 'rdl',
    alternative: 'romanian deadlift',
  });
  eq('success=false (resolves to same canonical)', result.success, false);
  eq('no exclusion added', exclusionCalls.length, 0);
  eq('no pinned added', pinnedCalls.length, 0);
}

// 32. replace_exercise — not-found returns success=false, no override (no
// hallucinated update). Already covered by test 10 but re-asserted here in
// the precision context.
console.log('\n[coachActions] replace_exercise (precision: not-found is silent)');
{
  reset();
  setFixture('2026-04-27', makeWorkout('Upper Push', [makeExercise('Bench Press', 3)]));
  const result = replaceExerciseAtDate({
    date: '2026-04-27',
    fromExercise: 'Burpees', // not present anywhere
    toExercise: { name: 'Push-ups', sets: 3, repsMin: 8, repsMax: 12 },
  });
  eq('success=false', result.success, false);
  eq('no override (would have been a hallucinated update)', overrideCalls.length, 0);
  eq('no ambiguous flag', result.ambiguous, undefined);
  ok('reason explains the miss', !!result.reason && /Burpees/i.test(result.reason), result.reason);
}

// 33. replace_exercise — only one candidate via fuzzy matches uniquely
console.log('\n[coachActions] replace_exercise (precision: single fuzzy candidate)');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Hinge', [
    makeExercise('Trap Bar Deadlift', 4),
    makeExercise('Pallof Press', 3),
  ]));
  // "deadlift" matches only "Trap Bar Deadlift" (no other deadlifts present)
  // → safe to fuzzy-match → unique.
  const result = replaceExerciseAtDate({
    date,
    fromExercise: 'deadlift',
    toExercise: { name: 'Hip Thrusts', sets: 3, repsMin: 8, repsMax: 10 },
  });
  eq('success', result.success, true);
  eq('one override written', overrideCalls.length, 1);
  const ex = overrideCalls[0]?.workout?.exercises || [];
  eq('Trap Bar Deadlift replaced', ex[0]?.exercise?.name, 'Hip Thrusts');
  eq('Pallof Press untouched', ex[1]?.exercise?.name, 'Pallof Press');
}

// 34. replace_exercise — two deadlift variants → ambiguous
console.log('\n[coachActions] replace_exercise (precision: two deadlift variants)');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Hinge', [
    makeExercise('Deadlift', 4),
    makeExercise('Trap Bar Deadlift', 3),
  ]));
  // "deadlift" — tier 1 case-insensitive matches "Deadlift" exactly (1
  // unique). This should resolve to the bare Deadlift, NOT trigger
  // ambiguous (because tier 1 has a single match).
  const result = replaceExerciseAtDate({
    date,
    fromExercise: 'deadlift',
    toExercise: { name: 'Hip Thrusts', sets: 3, repsMin: 8, repsMax: 10 },
  });
  eq('success (tier 1 exact wins over tier 3 fuzzy)', result.success, true);
  const ex = overrideCalls[0]?.workout?.exercises || [];
  eq('Deadlift replaced (not Trap Bar)', ex[0]?.exercise?.name, 'Hip Thrusts');
  eq('Trap Bar Deadlift untouched', ex[1]?.exercise?.name, 'Trap Bar Deadlift');
}

// 35. ambiguous result must NOT write override (no-side-effect guarantee)
console.log('\n[coachActions] precision: ambiguous never writes overrides');
{
  reset();
  const date = '2026-04-27';
  setFixture(date, makeWorkout('Lower Strength', [
    makeExercise('Back Squat', 4),
    makeExercise('Front Squat', 3),
  ]));
  const result = replaceExerciseAtDate({
    date,
    fromExercise: 'squat',
    toExercise: { name: 'Goblet Squat', sets: 3, repsMin: 8, repsMax: 10 },
  });
  eq('success=false', result.success, false);
  eq('zero overrides (hallucination guard)', overrideCalls.length, 0);
  eq('zero removes', removeCalls.length, 0);
  eq('zero exclusions', exclusionCalls.length, 0);
  eq('zero pinned', pinnedCalls.length, 0);
}

// ─── Summary ───

console.log(`\n[coachActions] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  • ${f}`));
  process.exit(1);
}
process.exit(0);
