(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as sessionResolver from '../utils/sessionResolver';
import type { ResolvedDay, ScheduleState } from '../utils/sessionResolver';
import type { ActiveInjuryConstraint } from '../store/coachUpdatesStore';
import type { Workout } from '../types/domain';

const FIXED_TODAY = '2026-04-29';
const FIXED_MONDAY = '2026-04-27';
const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

let baseWeek: ResolvedDay[] = [];

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  date.setDate(date.getDate() + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

function buildWeekFixture(): ResolvedDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(FIXED_MONDAY, i);
    const dow = isoToDow(date);
    return {
      date,
      dayOfWeek: dow,
      short: SHORT[dow],
      isToday: date === FIXED_TODAY,
      workout: null,
      source: 'none',
      indicator: null,
    } as ResolvedDay;
  });
}

(sessionResolver as any).resolveWeekWithConditioning = (): ResolvedDay[] => baseWeek;

import {
  classifyBibleInjurySeverity,
  injurySeverityPausesAffectedTraining,
  injurySeverityRecommendsPhysio,
  injurySeverityReducesAffectedWork,
  injurySeverityRemovesRiskyWork,
} from '../rules/injurySeverityBands';
import {
  applyProgramAdjustment,
  buildInjuryPolicy,
  resolveInjuryBucket,
  type AdjustmentRequest,
} from '../utils/programAdjustmentEngine';
import { buildInjuryConstraint, severityToTier as exposureSeverityToTier } from '../utils/exposureEngine';
import {
  buildGuidedInjuryConstraint,
  guidedInjuryBucketForArea,
  type GuidedInjuryFlowResult,
} from '../utils/guidedInjuryControl';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  fail ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T): void {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function ex(name: string): any {
  return {
    id: `we-${name}`,
    workoutId: 'wk',
    exerciseId: `ex-${name}`,
    exerciseOrder: 1,
    prescribedSets: 3,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    prescribedWeightKg: 0,
    restSeconds: 0,
    exercise: {
      id: `ex-${name}`,
      name,
      description: name,
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    },
    createdAt: '',
    updatedAt: '',
  };
}

function workout(name: string, exercises: any[], opts: Partial<Workout> = {}): Workout {
  return {
    id: `wk-${name}`,
    microcycleId: 'mc',
    dayOfWeek: 3,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate' as any,
    workoutType: 'Strength' as any,
    sessionTier: 'core' as any,
    exercises,
    createdAt: '',
    updatedAt: '',
    ...opts,
  } as Workout;
}

function placeWorkouts(byOffset: Record<number, Workout | null>): void {
  baseWeek = buildWeekFixture().map((day, index) => ({
    ...day,
    workout: byOffset[index] ?? null,
    source: byOffset[index] ? 'template' : 'none',
    indicator: byOffset[index] ? 'core' : null,
  } as ResolvedDay));
}

function emptyState(): ScheduleState {
  return {
    currentProgram: null,
    currentMicrocycle: null,
    manualOverrides: {},
    markedDays: {},
    athleteContext: {} as any,
    seasonPhase: null,
    capacity: 'medium',
  } as ScheduleState;
}

function injuryRequest(bodyPart: string, severity: number): AdjustmentRequest {
  return {
    intent: 'injury',
    todayISO: FIXED_TODAY,
    payload: { bodyPart, severity },
    source: 'client_guard',
  };
}

function activeInjury(bodyPart: string, bucket: any, severity: number): ActiveInjuryConstraint {
  return {
    id: `injury-${bucket}`,
    type: 'injury',
    bodyPart,
    bucket,
    severity,
    status: 'active',
    startDate: FIXED_TODAY,
    lastUpdatedAt: FIXED_TODAY,
    rules: [],
    safeFocus: [],
    advice: [],
  };
}

function guided(severity: number): GuidedInjuryFlowResult {
  return {
    region: 'lower_body',
    area: 'Hip / groin',
    severity,
    severityBand: 'mild',
    adjustmentLevel: 'minimal',
    triggers: ['Sprinting'],
    seriousSymptoms: false,
  };
}

console.log('\n-- Injury severity bands --');

eq('2/10 maps to mild band', classifyBibleInjurySeverity(2).band, 'avoid_trigger_1_3');
eq('4/10 maps to moderate band', classifyBibleInjurySeverity(4).band, 'reduce_affected_4_5');
eq('6/10 maps to limiting band', classifyBibleInjurySeverity(6).band, 'restrict_and_refer_6_7');
eq('9/10 maps to severe band', classifyBibleInjurySeverity(9).band, 'pause_affected_8_10');
ok('4/10 reduces affected work', injurySeverityReducesAffectedWork(4));
ok('6/10 removes risky work', injurySeverityRemovesRiskyWork(6));
ok('6/10 recommends physio', injurySeverityRecommendsPhysio(6));
ok('7/10 does not pause affected training', !injurySeverityPausesAffectedTraining(7));
ok('9/10 pauses affected training', injurySeverityPausesAffectedTraining(9));

console.log('\n-- Migrated consumers --');

// THREE DOORS THIS SECTION USED TO WALK NO LONGER EXIST, and their rows went
// with them rather than being kept pointing at nothing:
//   `injuryProgression.severityToTier` and `trainAroundEngine.severityToTier`
//   were removed by the 2026-08-19 burn — this suite had been DEAD AT IMPORT on
//   `main` ever since, so those rows have not run in either case;
//   `constraintPlan.buildConstraintPlans` was removed on 2026-08-21 with zero
//   production execution.
// The doors that remain are asserted below, and the shared scale is what the
// section is for — not the number of doors that happen to exist.
eq('exposure 4/10 tier', exposureSeverityToTier(4), 'moderate');
eq('exposure 6/10 tier', exposureSeverityToTier(6), 'limiting');
eq('exposure 9/10 tier', exposureSeverityToTier(9), 'severe');
// LR-27 convergence (Sam's ruling 2026-08-02): hip complaints take the HIP
// profile at every door — the owner's sheet wins every row. (These two rows
// previously expected an 'adductor' bucket no engine ever produced — they
// were red on main before the convergence.)
eq('program hip routes to the hip profile', resolveInjuryBucket('hip'), 'hip');
eq('guided hip routes to the hip profile', guidedInjuryBucketForArea('Hip / groin'), 'hip');

{
  const c6 = buildInjuryConstraint({ region: 'shoulder', severity: 6 });
  ok('exposure constraint adds hard physio at 6/10',
    !!c6.advice?.some((advice) => /assessed by a physio/i.test(advice)),
    JSON.stringify(c6.advice));
  const c5 = buildInjuryConstraint({ region: 'shoulder', severity: 5 });
  ok('exposure constraint keeps soft advice at 5/10',
    !!c5.advice?.some((advice) => /not improving/i.test(advice)),
    JSON.stringify(c5.advice));
}

// The constraint-plan pair that stood here made the SAME 6/10-hard-physio and
// 5/10-soft-advice claim through the deleted plan builder. The live exposure
// constraint above asserts it at the owner that still runs, so no claim is lost.

{
  const g7 = buildGuidedInjuryConstraint(guided(7), { todayISO: FIXED_TODAY });
  eq('guided 7/10 is moderate, not paused', g7.adjustmentLevel, 'moderate');
  ok('guided 7/10 includes physio advice', g7.advice.some((advice) => /physio/i.test(advice)));
  const g9 = buildGuidedInjuryConstraint(guided(9), { todayISO: FIXED_TODAY });
  eq('guided 9/10 pauses affected training', g9.adjustmentLevel, 'training_paused');
}

console.log('\n-- Program adjustment behaviour --');

{
  placeWorkouts({
    2: workout('Wed Lower', [ex('RDLs'), ex('Bench Press')]),
  });
  const result = applyProgramAdjustment(injuryRequest('hamstring', 2), emptyState());
  ok('severity 2 applies exact trigger change', result.applied);
  ok('severity 2 targets RDLs',
    result.events.some((event) => event.before === 'RDLs'),
    JSON.stringify(result.events));
  ok('severity 2 keeps unaffected upper work implied by no recovery shell',
    !result.events.some((event) => event.kind === 'set_session_recovery'));
}

{
  placeWorkouts({
    2: workout('Wed Lower', [ex('Goblet Squat')]),
  });
  const result = applyProgramAdjustment(injuryRequest('hamstring', 4), emptyState());
  ok('severity 4 is not a no-op', result.applied);
  ok('severity 4 reduces affected work with a lighten event',
    result.events.some((event) => event.kind === 'lighten_session'),
    JSON.stringify(result.events));
}

{
  placeWorkouts({
    2: workout('Wed Push', [ex('Bench Press'), ex('Overhead Press'), ex('Goblet Squat')]),
  });
  const result = applyProgramAdjustment(injuryRequest('shoulder', 6), emptyState());
  ok('severity 6 applies risky-work removal', result.applied);
  ok('severity 6 targets pressing work',
    result.events.some((event) => event.before === 'Bench Press') &&
      result.events.some((event) => event.before === 'Overhead Press'),
    JSON.stringify(result.events));
  ok('severity 6 reply recommends physio', /physio/i.test(result.reply));
}

{
  placeWorkouts({
    2: workout('Wed Lower', [ex('RDLs'), ex('Bench Press')]),
  });
  const result = applyProgramAdjustment(injuryRequest('hamstring', 9), emptyState());
  ok('severity 9 applies pause to affected work', result.applied);
  ok('severity 9 replaces/removes affected work before rest',
    result.events.some((event) =>
      (event.kind === 'replace_exercise' || event.kind === 'remove_exercise') &&
      event.before === 'RDLs'),
    JSON.stringify(result.events));
  ok('severity 9 does not rest when unaffected work remains',
    !result.events.some((event) => event.kind === 'set_session_recovery'));
  ok('severity 9 keeps unaffected upper work',
    !result.events.some((event) => event.before === 'Bench Press'));
}

// `utils/injuryWorkoutFilter.applyInjuryFilterToWorkout` — the read-time injury
// filter — was removed by the 2026-08-19 burn and has NO successor: the census
// there recorded "injury / equipment row removal after authoring" on the rebuild
// list, owned by the composer plus specialists. Its two rows are removed rather
// than left importing a module that is not there. THIS IS AN UNCOVERED
// CAPABILITY, not a covered one — it is on that rebuild list, not in this suite.

console.log(`\ninjurySeverityBandTests: ${pass} passed, ${fail} failed`);

if (fail > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
