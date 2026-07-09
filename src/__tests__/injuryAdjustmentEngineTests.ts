/**
 * injuryAdjustmentEngineTests — Validates the deterministic injury engine.
 *
 * The engine (src/utils/injuryAdjustmentEngine.ts) owns the severity-known
 * injury path: it parses the message, classifies future-session exercises
 * via `exerciseTags.injury`, mutates the week through `applyCoachAction`,
 * and returns a reply built ONLY from the actual filtered diff.
 *
 * Strategy:
 *   - Stub `resolveWeekWithConditioning` + `resolveDateWithConditioning` so
 *     the engine's snapshot/diff round-trip walks a fixture week we control.
 *   - Stub `useProgramStore.getState` so override writes flow into a
 *     mutable record that the resolver mock reads back. After-snapshot
 *     reflects mutations naturally.
 *   - Stub `getMondayStr` so the test is stable regardless of clock.
 *   - Real data: `EXERCISE_TAGS` (so actual injury ratings drive
 *     classification — that's the contract under test).
 *
 * Run: sucrase-node src/__tests__/injuryAdjustmentEngineTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as sessionResolver from '../utils/sessionResolver';
import * as coachWeekDiff from '../utils/coachWeekDiff';
import { useProgramStore } from '../store/programStore';
import { useAthletePreferencesStore } from '../store/athletePreferencesStore';
import type { Workout, WorkoutExercise } from '../types/domain';

// ─── Spies / mocks ───

interface OverrideCall { date: string; workout: Workout; ctx?: any; }
let overrideCalls: OverrideCall[] = [];
let dateOverrides: Record<string, Workout> = {};

// Day-by-day base fixture for the current week. Tests overwrite this
// before each scenario — the resolver mock then merges in any overrides
// that have been written since.
let baseWeekFixture: Array<{
  date: string;
  dayOfWeek: number;
  short: string;
  workout: Workout | null;
}> = [];

function resetSpies() {
  overrideCalls = [];
  dateOverrides = {};
}

(useProgramStore as any).getState = () => ({
  setManualOverride: (date: string, workout: Workout, ctx?: any) => {
    dateOverrides[date] = workout;
    overrideCalls.push({ date, workout, ctx });
  },
  removeManualOverride: (date: string) => {
    delete dateOverrides[date];
  },
  // Engine snapshot path uses these via buildScheduleStateImperative —
  // we stub buildScheduleStateImperative below so these are unused, but
  // include them defensively.
  dateOverrides,
  overrideContexts: {},
  sessionFeedback: {},
  weightOverrides: {},
  currentProgram: null,
  currentMicrocycle: null,
});

(useAthletePreferencesStore as any).getState = () => ({
  addExclusion: () => {},
  addPinned: () => {},
});

// State assembly is irrelevant here — the resolver mock ignores it.
(coachWeekDiff as any).buildScheduleStateImperative = () => ({});

// Pin the Monday so tests are stable regardless of clock.
const FIXED_MONDAY = '2026-04-27'; // Monday
(sessionResolver as any).getMondayStr = (_offset: number) => FIXED_MONDAY;

// Resolver mock: walk the base week and substitute overrides where
// present. This is what makes "snapshot before / mutate / snapshot after"
// produce a real diff.
(sessionResolver as any).resolveWeekWithConditioning = (
  _monday: string,
  _state: any,
) =>
  baseWeekFixture.map((d) => {
    const w = dateOverrides[d.date] !== undefined ? dateOverrides[d.date] : d.workout;
    return {
      date: d.date,
      dayOfWeek: d.dayOfWeek,
      short: d.short,
      workout: w,
      source: dateOverrides[d.date] ? 'override' : w ? 'template' : 'rest',
      indicator: null,
    };
  });

// resolveDateWithConditioning is what coachActions calls when applying
// remove_exercise / lighten_session. Read from overrides first, then base.
(sessionResolver as any).resolveDateWithConditioning = (date: string) => {
  if (dateOverrides[date] !== undefined) {
    return { workout: dateOverrides[date] } as any;
  }
  const found = baseWeekFixture.find((d) => d.date === date);
  return found?.workout ? { workout: found.workout } : null;
};

// Import AFTER stubs are installed.
import {
  applyInjuryAdjustment,
  extractInjuryContext,
  parseSeverityNumber,
  extractBodyPart,
} from '../utils/injuryAdjustmentEngine';

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
  baseWeekFixture = [];
}

// ─── Workout factories ───

function ex(name: string, sets = 3, repsMin = 6, repsMax = 8): WorkoutExercise {
  const id = `ex-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  return {
    id: `we-${id}`,
    workoutId: '',
    exerciseId: id,
    exerciseOrder: 0,
    prescribedSets: sets,
    prescribedRepsMin: repsMin,
    prescribedRepsMax: repsMax,
    prescribedWeightKg: 0,
    restSeconds: 0,
    exercise: {
      id,
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

function workout(name: string, exercises: WorkoutExercise[]): Workout {
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
  } as Workout;
}

const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function buildBaseWeek(per: Record<number, Workout | null>) {
  // FIXED_MONDAY = 2026-04-27 (Mon, dow=1). Walk Mon→Sun.
  const monday = new Date('2026-04-27T12:00:00');
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dow = d.getDay();
    days.push({ date, dayOfWeek: dow, short: SHORT[dow], workout: per[dow] || null });
  }
  return days;
}

// Today for tests = Monday so the entire week is "future". Individual
// scenarios that need a mid-week today (to test past-date suppression)
// override this in the test body.
const TODAY_ISO = '2026-04-27';

// ─── 1. parseSeverityNumber ───

console.log('\n[1] parseSeverityNumber');
{
  eq('numeric "6/10"', parseSeverityNumber("hammy 6/10"), 6);
  eq('numeric "8 / 10"', parseSeverityNumber("knee 8 / 10"), 8);
  eq('numeric "pain is a 7"', parseSeverityNumber("pain is a 7"), 7);
  eq('"pain out of 10" with number', parseSeverityNumber("9/10 pain"), 9);
  eq('qualitative "really bad" → 8', parseSeverityNumber("really bad pain in my groin"), 8);
  eq('qualitative "severe" → 8', parseSeverityNumber("severe shoulder pain"), 8);
  eq('qualitative "moderate" → 6', parseSeverityNumber("moderate ankle pain"), 6);
  eq('qualitative "mild" → 3', parseSeverityNumber("mild calf tightness"), 3);
  eq('no severity → null', parseSeverityNumber("my hammy is sore"), null);
  eq('empty → null', parseSeverityNumber(""), null);
}

// ─── 2. extractBodyPart ───

console.log('\n[2] extractBodyPart');
{
  eq('hamstring', extractBodyPart("Tweaked my hamstring"), 'hamstring');
  eq('hammy via normalization', extractBodyPart("My hammie is cooked"), 'hammy');
  eq('lower back beats back', extractBodyPart("Lower back is sore"), 'lower back');
  eq('groin', extractBodyPart("groin strain 6/10"), 'groin');
  eq('shoulder', extractBodyPart("shoulder pain"), 'shoulder');
  eq('knee', extractBodyPart("knee tweak"), 'knee');
  eq('calf', extractBodyPart("calf tight 5/10"), 'calf');
  eq('ankle', extractBodyPart("rolled my ankle"), 'ankle');
  eq('no body part → null', extractBodyPart("I feel sore"), null);
}

// ─── 3. extractInjuryContext (composite) ───

console.log('\n[3] extractInjuryContext — bucket mapping for 7 body parts');
{
  const cases: Array<[string, string, number, string]> = [
    ['Hamstring 6/10', 'tweaked my hamstring 6/10', 6, 'hamstring'],
    ['Knee 6/10', 'sore knee 6/10', 6, 'knee'],
    ['Groin 6/10', 'pulled my groin 6/10', 6, 'adductor'],
    ['Ankle 6/10', 'tweaked my ankle 6/10', 6, 'ankle'],
    ['Shoulder 6/10', 'shoulder pain 6/10', 6, 'shoulder'],
    ['Lower back 6/10', 'lower back hurts 6/10', 6, 'lowerBack'],
    ['Calf 6/10', 'calf strain 6/10', 6, 'calf'],
  ];
  for (const [label, msg, expectedSev, expectedBucket] of cases) {
    const ctx = extractInjuryContext(msg);
    ok(`${label} → context produced`, ctx !== null);
    if (ctx) {
      eq(`${label} → severity`, ctx.severity, expectedSev);
      eq(`${label} → bucket`, ctx.bucket, expectedBucket);
    }
  }
}

console.log('\n[3b] extractInjuryContext — proxy mappings');
{
  // Quad → knee (closest InjuryProfile key)
  eq('quad → knee', extractInjuryContext('quad strain 6/10')?.bucket, 'knee');
  // Glute → hamstring (posterior chain proxy)
  eq('glute → hamstring', extractInjuryContext('glute strain 6/10')?.bucket, 'hamstring');
  // Hip → adductor (lower-limb/groin proxy)
  eq('hip → adductor', extractInjuryContext('hip pain 6/10')?.bucket, 'adductor');
  // Pec → shoulder
  eq('pec → shoulder', extractInjuryContext('pec strain 6/10')?.bucket, 'shoulder');
  // Foot → ankle
  eq('foot → ankle', extractInjuryContext('foot pain 6/10')?.bucket, 'ankle');
  // Bicep → elbow
  eq('bicep → elbow', extractInjuryContext('bicep tweak 6/10')?.bucket, 'elbow');
}

console.log('\n[3c] extractInjuryContext — gates on severity only');
{
  // Severity is the ONLY hard gate. Without a body-part token we still
  // return context (bodyPart='unknown', bucket=null) so the UAE can run
  // its region-agnostic protective fallback.
  const noBodyPart = extractInjuryContext('I feel sore 6/10');
  ok('no body part → still returns context', noBodyPart !== null);
  eq('no body part → bodyPart="unknown"', noBodyPart?.bodyPart, 'unknown');
  eq('no body part → bucket=null', noBodyPart?.bucket, null);
  eq('no body part → severity preserved', noBodyPart?.severity, 6);
  eq('no severity → null', extractInjuryContext('hammy hurts'), null);
  eq('no injury signal → null', extractInjuryContext('quad day 6/10 reps'), null);
}

// ─── 4. Engine — mild severity avoids exact trigger ───

console.log('\n[4] applyInjuryAdjustment — severity 3/10 avoids exact trigger');
{
  reset();
  baseWeekFixture = buildBaseWeek({
    1: workout('Lower Strength', [ex('RDLs', 3), ex('Back Squat', 4)]),
  });
  const result = applyInjuryAdjustment({
    message: 'hammy hurts 3/10',
    todayISO: TODAY_ISO,
  });
  eq('fired = true', result.fired, true);
  const monChange = result.diff?.changedDays.find((d) => d.date === '2026-04-27');
  ok(
    'RDLs removed as exact trigger',
    monChange ? !monChange.after.exerciseNames.includes('RDLs') : false,
    JSON.stringify(monChange?.after.exerciseNames),
  );
  ok(
    'Back Squat remains',
    monChange ? monChange.after.exerciseNames.includes('Back Squat') : false,
    JSON.stringify(monChange?.after.exerciseNames),
  );
}

console.log('\n[5] applyInjuryAdjustment — declines unparseable inputs');
{
  reset();
  baseWeekFixture = buildBaseWeek({
    1: workout('Lower Strength', [ex('RDLs', 3)]),
  });
  eq(
    'no body part → fired false',
    applyInjuryAdjustment({ message: 'sore 6/10', todayISO: TODAY_ISO }).fired,
    false,
  );
  eq(
    'no severity → fired false',
    applyInjuryAdjustment({ message: 'hammy hurts', todayISO: TODAY_ISO }).fired,
    false,
  );
}

// ─── 6. Engine — Hamstring 6/10 removes RDLs ───

console.log('\n[6] Hamstring 6/10 — RDLs removed (avoid)');
{
  reset();
  baseWeekFixture = buildBaseWeek({
    1: workout('Lower Strength', [ex('Back Squat', 4), ex('RDLs', 3)]),
    3: workout('Upper Push', [ex('Bench Press', 4)]),
  });
  const result = applyInjuryAdjustment({
    message: 'tweaked my hamstring 6/10',
    todayISO: TODAY_ISO,
  });
  ok('engine fired', result.fired);
  ok('diff produced', result.diff?.hasChanges === true);
  ok(
    'Monday changed (RDLs removed)',
    !!result.diff?.changedDays.find((d) => d.date === '2026-04-27'),
  );
  const monChange = result.diff?.changedDays.find((d) => d.date === '2026-04-27');
  ok(
    'Monday after-exercises do NOT include RDLs',
    !monChange?.after.exerciseNames.includes('RDLs'),
    JSON.stringify(monChange?.after.exerciseNames),
  );
  ok(
    'Monday after-exercises STILL include Back Squat',
    monChange?.after.exerciseNames.includes('Back Squat') === true,
    JSON.stringify(monChange?.after.exerciseNames),
  );
  ok(
    'reply contains program-changes header',
    /Program changes:/.test(result.reply || ''),
  );
  ok(
    'reply mentions Avoid this week',
    /Avoid this week:/.test(result.reply || ''),
  );
  ok(
    'reply ends with "Program updated"',
    /Program updated [-—] check your week\./.test(result.reply || ''),
  );
}

// ─── 7. Engine — Lower-back 6/10 removes Back Squat (avoid) ───

console.log('\n[7] Lower-back 6/10 — Back Squat removed (avoid)');
{
  reset();
  baseWeekFixture = buildBaseWeek({
    1: workout('Lower Strength', [ex('Back Squat', 4), ex('RDLs', 3)]),
  });
  const result = applyInjuryAdjustment({
    message: 'lower back hurts 6/10',
    todayISO: TODAY_ISO,
  });
  ok('engine fired', result.fired);
  const monChange = result.diff?.changedDays.find((d) => d.date === '2026-04-27');
  ok(
    'Back Squat removed',
    monChange ? !monChange.after.exerciseNames.includes('Back Squat') : false,
    JSON.stringify(monChange?.after.exerciseNames),
  );
}

// ─── 8. Engine — Knee 6/10 removes caution-rated risky work ───

console.log('\n[8] Knee 6/10 — caution-rated work is removed');
{
  reset();
  // Back Squat = caution for knee, RDLs = good for knee → at sev 6 the
  // limiting band removes caution-rated risky work.
  baseWeekFixture = buildBaseWeek({
    1: workout('Lower Strength', [ex('Back Squat', 4), ex('RDLs', 3)]),
  });
  const result = applyInjuryAdjustment({
    message: 'sore knee 6/10',
    todayISO: TODAY_ISO,
  });
  ok('engine fired', result.fired);
  ok(
    'diff has changes (fallback applied)',
    result.diff?.hasChanges === true,
    `reply was: ${result.reply}`,
  );
  const monChange = result.diff?.changedDays.find((d) => d.date === '2026-04-27');
  ok(
    'Back Squat removed at 6/10',
    monChange ? !monChange.after.exerciseNames.includes('Back Squat') : false,
    JSON.stringify(monChange?.after.exerciseNames),
  );
}

// ─── 9. Engine — Severity 6/10 also removes "caution" exercises ───

console.log('\n[9] Hamstring 6/10 — caution exercises also dropped');
{
  reset();
  // Trap Bar Deadlift hamstring='caution'; RDLs hamstring='avoid'
  baseWeekFixture = buildBaseWeek({
    1: workout('Lower Strength', [
      ex('Trap Bar Deadlift', 3),
      ex('RDLs', 3),
      ex('Back Squat', 4),
    ]),
  });
  const result = applyInjuryAdjustment({
    message: 'hamstring hurts 6/10',
    todayISO: TODAY_ISO,
  });
  ok('engine fired', result.fired);
  const monChange = result.diff?.changedDays.find((d) => d.date === '2026-04-27');
  ok(
    'RDLs removed (avoid)',
    monChange ? !monChange.after.exerciseNames.includes('RDLs') : false,
  );
  ok(
    'Trap Bar Deadlift removed (caution at 6/10)',
    monChange ? !monChange.after.exerciseNames.includes('Trap Bar Deadlift') : false,
    JSON.stringify(monChange?.after.exerciseNames),
  );
  ok(
    'Back Squat kept (good for hamstring)',
    monChange ? monChange.after.exerciseNames.includes('Back Squat') : false,
  );
}

// ─── 10. Engine — Severity 8/10 substitutes before resting ───

console.log('\n[10] Hamstring 8/10 — mostly-risky session rescued with safe alternatives');
{
  reset();
  baseWeekFixture = buildBaseWeek({
    1: workout('Lower Strength', [
      ex('RDLs', 3),                // hamstring: avoid
      ex('Trap Bar Deadlift', 3),   // hamstring: caution
    ]),
  });
  const result = applyInjuryAdjustment({
    message: 'hamstring hurts 8/10',
    todayISO: TODAY_ISO,
  });
  ok('engine fired', result.fired);
  const monChange = result.diff?.changedDays.find((d) => d.date === '2026-04-27');
  ok(
    'Monday does not flip straight to Recovery',
    monChange?.after.workoutName !== 'Recovery',
    `actual workoutName: ${monChange?.after.workoutName}`,
  );
  ok(
    'affected hinge work removed or replaced',
    monChange
      ? !monChange.after.exerciseNames.includes('RDLs') &&
        !monChange.after.exerciseNames.includes('Trap Bar Deadlift')
      : false,
    JSON.stringify(monChange?.after.exerciseNames),
  );
  ok(
    'safe alternate work remains',
    monChange ? monChange.after.exerciseNames.length > 0 : false,
    JSON.stringify(monChange?.after.exerciseNames),
  );
}

// ─── 11. Engine — Future-only: past sessions never edited ───

console.log('\n[11] Future-only — past Mon NOT touched, future Wed IS');
{
  reset();
  // todayISO = Wed 2026-04-29 → Mon (Apr 27) is in the past, Wed and Fri are
  // future. Both Mon and Wed have RDLs (avoid for hamstring). Engine should
  // only edit Wed.
  baseWeekFixture = buildBaseWeek({
    1: workout('Lower Strength', [ex('RDLs', 3), ex('Back Squat', 4)]),
    3: workout('Lower Strength', [ex('RDLs', 3), ex('Back Squat', 4)]),
  });
  const result = applyInjuryAdjustment({
    message: 'hamstring hurts 6/10',
    todayISO: '2026-04-29',
  });
  ok('engine fired', result.fired);
  // The diff is filtered to today-forward, so a Monday change can't appear
  // in the diff at all. But we also want to confirm we didn't write a
  // past-Monday override — the override-call list captures every write.
  const wroteToMon = overrideCalls.some((c) => c.date === '2026-04-27');
  const wroteToWed = overrideCalls.some((c) => c.date === '2026-04-29');
  ok(
    'no override written on past Monday',
    !wroteToMon,
    `overrideCalls dates: ${overrideCalls.map((c) => c.date).join(', ')}`,
  );
  ok('override written on future Wednesday', wroteToWed);
  ok(
    'diff has only future days',
    result.diff?.changedDays.every((d) => d.date >= '2026-04-29') === true,
  );
}

// ─── 12. Engine — No future sessions → honest no-change reply ───

console.log('\n[12] No future sessions → honest "couldn\'t find any" reply');
{
  reset();
  // Today is Sunday end-of-week, only had Mon session which is gone now.
  baseWeekFixture = buildBaseWeek({
    1: workout('Lower Strength', [ex('RDLs', 3)]),
  });
  const result = applyInjuryAdjustment({
    message: 'hamstring hurts 7/10',
    todayISO: '2026-05-04', // next Mon — outside the fixture week entirely
  });
  ok('engine fired', result.fired);
  ok(
    'reply mentions no future sessions',
    /couldn'?t find any future sessions/i.test(result.reply || ''),
    result.reply,
  );
  eq('no overrides written', overrideCalls.length, 0);
}

// ─── 13. Engine — Lower-limb adds no_running weekly override ───

console.log('\n[13] Lower-limb (calf) + running session → no_running strips run');
{
  reset();
  baseWeekFixture = buildBaseWeek({
    1: workout('Lower Strength', [ex('Back Squat', 4)]),
    2: workout('Conditioning', [ex('Tempo Run', 1)]), // calf: caution
  });
  const result = applyInjuryAdjustment({
    message: 'calf strain 6/10',
    todayISO: TODAY_ISO,
  });
  ok('engine fired', result.fired);
  ok(
    'diff has changes',
    result.diff?.hasChanges === true,
    `reply: ${result.reply}`,
  );
  // The no_running rule strips running content. Tempo Run should be gone
  // from Tuesday's exercises after the rule applies.
  const tueChange = result.diff?.changedDays.find((d) => d.date === '2026-04-28');
  ok(
    'Tuesday touched by no_running override',
    !!tueChange,
    JSON.stringify(result.diff?.changedDays.map((d) => d.date)),
  );
  ok(
    'Tempo Run removed from Tuesday',
    tueChange ? !tueChange.after.exerciseNames.includes('Tempo Run') : false,
    JSON.stringify(tueChange?.after.exerciseNames),
  );
}

// ─── 14. Engine — Upper-limb does NOT add no_running ───

console.log('\n[14] Upper-limb (shoulder) + running session → run untouched');
{
  reset();
  baseWeekFixture = buildBaseWeek({
    1: workout('Upper Push', [ex('Overhead Press', 4)]), // shoulder: caution
    2: workout('Conditioning', [ex('Tempo Run', 1)]),
  });
  const result = applyInjuryAdjustment({
    message: 'shoulder pain 6/10',
    todayISO: TODAY_ISO,
  });
  ok('engine fired', result.fired);
  // We're not asserting the exact upper-session edit here. The contract under
  // test is: NO override on Tue from a no_running rule.
  const tueChange = result.diff?.changedDays.find((d) => d.date === '2026-04-28');
  ok(
    'Tuesday running session untouched (upper-limb injury)',
    !tueChange || tueChange.after.exerciseNames.includes('Tempo Run'),
    `tueChange: ${JSON.stringify(tueChange)}`,
  );
}

// ─── 15. Engine — Reply is grounded in actual diff ───

console.log('\n[15] Reply only mentions exercises that actually changed');
{
  reset();
  baseWeekFixture = buildBaseWeek({
    1: workout('Lower Strength', [ex('Back Squat', 4), ex('RDLs', 3)]),
  });
  const result = applyInjuryAdjustment({
    message: 'hamstring hurts 6/10',
    todayISO: TODAY_ISO,
  });
  ok('engine fired', result.fired);
  // RDLs were removed → reply may mention them; Back Squat stayed → reply
  // should NOT claim Back Squat changed.
  const reply = result.reply || '';
  // We don't constrain the exact wording here, but we DO constrain that
  // the reply doesn't fabricate "removed Back Squat" / "swapped Back Squat"
  // language since Back Squat was untouched.
  ok(
    'reply does NOT claim Back Squat was removed',
    !/swapped Back Squat|removed Back Squat/i.test(reply),
    reply,
  );
}

// ─── 16. Engine — Empty input is robust ───

console.log('\n[16] Empty / non-injury input → no-op');
{
  reset();
  baseWeekFixture = buildBaseWeek({ 1: workout('Lower Strength', [ex('RDLs', 3)]) });
  eq('empty string', applyInjuryAdjustment({ message: '', todayISO: TODAY_ISO }).fired, false);
  eq(
    'unrelated message',
    applyInjuryAdjustment({ message: 'how are you', todayISO: TODAY_ISO }).fired,
    false,
  );
  eq('no overrides written', overrideCalls.length, 0);
}

// ─── Summary ───

console.log(`\n[injuryAdjustmentEngine] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  • ${f}`));
  process.exit(1);
}
process.exit(0);
