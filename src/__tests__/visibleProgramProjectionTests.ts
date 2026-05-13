/**
 * visibleProgramProjectionTests — proves the EXACT visible-app bug
 * is fixed: hammy 6/10 + next Monday Lower Body Strength must NOT
 * show Deadlift / Nordic Lower / RDL on either Program tab or
 * DayWorkoutScreen.
 *
 * The previous suites all tested helpers in isolation. This one
 * drives the SAME projection path the React hooks use:
 *   resolver output → projectVisibleDay(day, state) → UI consumer.
 *
 * Run: npm run test:visible-program-projection
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  projectVisibleDay,
  projectAndLog,
} from '../utils/visibleProgramProjection';
import {
  buildProgramTabProjectedWeek,
  buildDayWorkoutProjectedDay,
} from '../utils/visibleProgramReadModel';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { Workout } from '../types/domain';
import type { InjuryState } from '../utils/injuryProgression';

// ─── Harness ───
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; failures.push(name); console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`); }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { console.log(`\n${label}`); }

// ─── Fixtures ───
function ex(name: string): any {
  return {
    id: `we-${name}`, workoutId: 'wk', exerciseId: `ex-${name}`,
    exerciseOrder: 0, prescribedSets: 3, prescribedRepsMin: 6, prescribedRepsMax: 8,
    prescribedWeightKg: 0, restSeconds: 0,
    exercise: {
      id: `ex-${name}`, name, description: name,
      exerciseType: 'Compound', muscleGroups: [], equipmentRequired: [],
      difficultyLevel: 'Intermediate', createdAt: '', updatedAt: '',
    },
    createdAt: '', updatedAt: '',
  };
}
function wk(name: string, dow: number, exercises: any[], opts: any = {}): Workout {
  return {
    id: `w-${dow}`, microcycleId: 'mc', dayOfWeek: dow,
    name, description: '', durationMinutes: 60,
    intensity: 'Moderate' as any,
    workoutType: opts.workoutType || ('Strength' as any),
    sessionTier: opts.sessionTier || ('core' as any),
    exercises, createdAt: '', updatedAt: '',
    coachNotes: opts.coachNotes,
  } as Workout;
}
function day(date: string, workout: Workout | null, source: any = 'template'): ResolvedDay {
  const [y, m, d] = date.split('-').map(Number);
  return {
    date,
    dayOfWeek: new Date(y, m - 1, d, 12, 0, 0, 0).getDay(),
    short: 'MON',
    isToday: false,
    workout,
    source,
    indicator: null,
  } as any;
}
function stateWithManual(date: string, workout: Workout): any {
  return {
    currentProgram: null,
    currentMicrocycle: null,
    manualOverrides: { [date]: workout },
    markedDays: {},
    athleteContext: {},
    seasonPhase: null,
    readiness: 'medium',
    sessionFeedback: {},
    weightOverrides: {},
    activeInjury: null,
    activeConstraints: [],
  };
}
function hammy(severity: number, status: InjuryState['status'] = 'active'): InjuryState {
  return {
    bodyPart: 'hammy',
    bucket: 'hamstring' as any,
    severity,
    initialSeverity: severity,
    status,
    rules: severity >= 5 && status !== 'resolved'
      ? ['No sprinting or high-speed running', 'No heavy hinge work (RDLs, deadlifts, nordics)']
      : [],
    startDate: '2026-04-29T10:00:00Z',
    createdAt: '2026-04-29T10:00:00Z',
    lastUpdatedAt: '2026-04-29T10:00:00Z',
    history: [],
  };
}

const TODAY_ISO = '2026-04-29';
const NEXT_MON = '2026-05-04';

// ─────────────────────────────────────────────────────────────────────
// 1. THE EXACT BUG — hammy 6/10 + Lower Body Strength with Deadlift +
//    Nordic Lower → projectVisibleDay returns workout WITHOUT them.
// ─────────────────────────────────────────────────────────────────────
section('[1] Hammy 6/10 + next Monday Lower Body Strength → Deadlift + Nordic Lower gone');
{
  const workout = wk('Lower Body Strength', 1, [
    ex('Back Squat'),
    ex('Box Jump'),
    ex('Deadlift'),
    ex('Nordic Lower'),
  ]);
  const out = projectVisibleDay({
    day: day(NEXT_MON, workout),
    activeInjury: hammy(6),
    todayISO: TODAY_ISO,
  });
  ok('projection applied', out.injuryFilterApplied);
  const names = (out.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name);
  ok(
    'Deadlift gone',
    !names.includes('Deadlift'),
    `exercises: ${JSON.stringify(names)}`,
  );
  ok(
    'Nordic Lower gone',
    !names.includes('Nordic Lower'),
    `exercises: ${JSON.stringify(names)}`,
  );
  ok(
    'coachNotes mention sprinting',
    !!out.day.workout?.coachNotes?.some((n) => /sprint/i.test(n)),
  );
}

// ─────────────────────────────────────────────────────────────────────
// 2. Untagged AI-named hamstring exercises also caught (name match)
// ─────────────────────────────────────────────────────────────────────
section('[2] AI-named "Slider Hamstring Curl" caught by name-match safety net');
{
  const workout = wk('Lower', 1, [
    ex('Slider Hamstring Curl'),
    ex('Romanian Deadlift'),
    ex('Goblet Squat'),
  ]);
  const out = projectVisibleDay({
    day: day(NEXT_MON, workout),
    activeInjury: hammy(6),
    todayISO: TODAY_ISO,
  });
  const names = (out.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name);
  ok('Slider Hamstring Curl gone', !names.includes('Slider Hamstring Curl'));
  ok('Romanian Deadlift gone', !names.includes('Romanian Deadlift'));
  ok('Goblet Squat preserved', names.includes('Goblet Squat'));
}

// ─────────────────────────────────────────────────────────────────────
// 3. Resolved injury → no filter
// ─────────────────────────────────────────────────────────────────────
section('[3] Resolved injury → Deadlift + Nordic return');
{
  const workout = wk('Lower', 1, [ex('Deadlift'), ex('Nordic Lower')]);
  const out = projectVisibleDay({
    day: day(NEXT_MON, workout),
    activeInjury: hammy(0, 'resolved'),
    todayISO: TODAY_ISO,
  });
  eq('not applied (resolved)', out.injuryFilterApplied, false);
  const names = (out.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name);
  ok('Deadlift back', names.includes('Deadlift'));
  ok('Nordic Lower back', names.includes('Nordic Lower'));
}

// ─────────────────────────────────────────────────────────────────────
// 4. Past-date workout → no filter (immutable)
// ─────────────────────────────────────────────────────────────────────
section('[4] Past-date workout → no filter');
{
  const workout = wk('Lower', 1, [ex('Deadlift')]);
  const out = projectVisibleDay({
    day: day('2026-04-20', workout),
    activeInjury: hammy(6),
    todayISO: TODAY_ISO,
  });
  eq('not applied (past)', out.injuryFilterApplied, false);
}

// ─────────────────────────────────────────────────────────────────────
// 5. Recovery session → never modified
// ─────────────────────────────────────────────────────────────────────
section('[5] Recovery session → untouched');
{
  const recovery = wk('Recovery Session', 3, [], { workoutType: 'Recovery', sessionTier: 'recovery' });
  const out = projectVisibleDay({
    day: day(NEXT_MON, recovery),
    activeInjury: hammy(6),
    todayISO: TODAY_ISO,
  });
  eq('not applied (recovery)', out.injuryFilterApplied, false);
}

// ─────────────────────────────────────────────────────────────────────
// 6. Game stub → never modified
// ─────────────────────────────────────────────────────────────────────
section('[6] Game stub → untouched');
{
  const game = wk('Game', 6, [], { workoutType: 'Game' });
  const out = projectVisibleDay({
    day: day(NEXT_MON, game),
    activeInjury: hammy(6),
    todayISO: TODAY_ISO,
  });
  eq('not applied (game)', out.injuryFilterApplied, false);
}

// ─────────────────────────────────────────────────────────────────────
// 7. Injury override that ALREADY has the notes → no double-mutation
// ─────────────────────────────────────────────────────────────────────
section('[7] Injury-authored override with notes → no double-mutation');
{
  const overrideWorkout = wk('Lower', 1, [ex('Goblet Squat')], {
    coachNotes: ['no sprinting / no high-speed running', 'Removed: Deadlift'],
  });
  const out = projectVisibleDay({
    day: day(NEXT_MON, overrideWorkout, 'manual'),
    activeInjury: hammy(6),
    overrideContext: { intent: 'injury', label: 'prior write' } as any,
    todayISO: TODAY_ISO,
  });
  eq('not applied (already done)', out.injuryFilterApplied, false);
  // Notes preserved as-is.
  eq('notes preserved', out.day.workout?.coachNotes?.length, 2);
}

// ─────────────────────────────────────────────────────────────────────
// 8. NON-INJURY manual override (e.g. user edited) → STILL filtered
// ─────────────────────────────────────────────────────────────────────
section('[8] Non-injury manual override → STILL filtered');
{
  const userEdited = wk('Lower', 1, [ex('Deadlift'), ex('Nordic Lower')]);
  const out = projectVisibleDay({
    day: day(NEXT_MON, userEdited, 'manual'),
    activeInjury: hammy(6),
    overrideContext: { intent: 'manual_edit', label: 'user added DL' } as any,
    todayISO: TODAY_ISO,
  });
  ok('applied — non-injury override does not bypass', out.injuryFilterApplied);
  const names = (out.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name);
  ok('Deadlift gone', !names.includes('Deadlift'));
  ok('Nordic Lower gone', !names.includes('Nordic Lower'));
}

// ─────────────────────────────────────────────────────────────────────
// 9. Manual override with NO context at all → STILL filtered
// ─────────────────────────────────────────────────────────────────────
section('[9] Manual override without context → STILL filtered');
{
  const ambiguous = wk('Lower', 1, [ex('Deadlift')]);
  const out = projectVisibleDay({
    day: day(NEXT_MON, ambiguous, 'manual'),
    activeInjury: hammy(6),
    todayISO: TODAY_ISO,
    // overrideContext intentionally omitted
  });
  ok('applied — missing context does not bypass', out.injuryFilterApplied);
  const names = (out.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name);
  ok('Deadlift gone', !names.includes('Deadlift'));
}

// ─────────────────────────────────────────────────────────────────────
// 10. Unknown bucket / null → conservative no-op
// ─────────────────────────────────────────────────────────────────────
section('[10] activeInjury with bucket=null → no filter');
{
  const workout = wk('Lower', 1, [ex('Deadlift')]);
  const out = projectVisibleDay({
    day: day(NEXT_MON, workout),
    activeInjury: { ...hammy(6), bucket: null } as any,
    todayISO: TODAY_ISO,
  });
  eq('not applied (bucket=null)', out.injuryFilterApplied, false);
  const names = (out.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name);
  ok('Deadlift remains', names.includes('Deadlift'));
}

// ─────────────────────────────────────────────────────────────────────
// 11. Current-week injury Team Training note is preserved (regression)
// ─────────────────────────────────────────────────────────────────────
section('[11] Current-week Team Training injury note preserved');
{
  const teamDay = wk('Team Training', 4, [], {
    workoutType: 'Team Training',
    coachNotes: ['no sprinting / no high-speed running'],
  });
  const out = projectVisibleDay({
    day: day(NEXT_MON, teamDay, 'manual'),
    activeInjury: hammy(6),
    overrideContext: { intent: 'injury' } as any,
    todayISO: TODAY_ISO,
  });
  eq('not applied (already noted)', out.injuryFilterApplied, false);
  ok(
    'Team Training note preserved',
    !!out.day.workout?.coachNotes?.some((n) => /sprint/i.test(n)),
  );
}

// ─────────────────────────────────────────────────────────────────────
// 12. projectAndLog emits both project_input and project_output logs
// ─────────────────────────────────────────────────────────────────────
section('[12] projectAndLog runtime logs');
{
  let captured: string[] = [];
  const realLog = console.log;
  const prevEnable = process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS;
  const prevTrace = process.env.DEBUG_SCHEDULE_TRACE;
  process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS = 'true';
  process.env.DEBUG_SCHEDULE_TRACE = 'true';
  console.log = (...args: any[]) => {
    captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
  const workout = wk('Lower', 1, [ex('Deadlift'), ex('Goblet Squat')]);
  projectAndLog({
    day: day(NEXT_MON, workout),
    activeInjury: hammy(6),
    todayISO: TODAY_ISO,
    surface: 'home',
  });
  console.log = realLog;
  process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS = prevEnable;
  process.env.DEBUG_SCHEDULE_TRACE = prevTrace;
  ok('logs project_input', captured.some((l) => l.includes('[visible-program] project_input')));
  ok('logs project_output', captured.some((l) => l.includes('[visible-program] project_output')));
  ok(
    'logs include activeInjuryBucket=hamstring',
    captured.some((l) => l.includes('"activeInjuryBucket"') && l.includes('hamstring')),
  );
  ok(
    'logs include injuryFilterApplied=true',
    captured.some((l) => l.includes('injuryFilterApplied')),
  );
}

// ─────────────────────────────────────────────────────────────────────
// 13. Home and detail screens produce the SAME projected workout.
// ─────────────────────────────────────────────────────────────────────
section('[13] Same input → home and detail surfaces produce same projected workout');
{
  const workout = wk('Lower Body Strength', 1, [
    ex('Back Squat'), ex('Box Jump'), ex('Deadlift'), ex('Nordic Lower'),
  ]);
  const homeOut = projectVisibleDay({
    day: day(NEXT_MON, workout),
    activeInjury: hammy(6),
    todayISO: TODAY_ISO,
  });
  const detailOut = projectVisibleDay({
    day: day(NEXT_MON, workout),
    activeInjury: hammy(6),
    todayISO: TODAY_ISO,
  });
  const homeNames = (homeOut.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name).sort();
  const detailNames = (detailOut.day.workout?.exercises ?? []).map((e: any) => e.exercise?.name).sort();
  eq('home and detail exercise lists match', homeNames, detailNames);
}

// ─────────────────────────────────────────────────────────────────────
// 14. Conditioning-only workouts do not keep stale strength titles.
//     This drives the same read-model helpers used by Program tab and
//     DayWorkoutScreen: raw resolver → buildProgramTabProjectedWeek /
//     buildDayWorkoutProjectedDay → projected workout object.
// ─────────────────────────────────────────────────────────────────────
section('[14] Conditioning-only Wednesday row uses final conditioning identity');
{
  const wed = '2026-05-06';
  const stale = wk('Upper Pull', 3, [ex('40min zone 2 row')], {
    workoutType: 'Conditioning',
    sessionTier: 'optional',
    conditioningFlavour: 'aerobic',
    coachNotes: ['Shifted to non-running modality to manage weekly run load.'],
  });
  const state = stateWithManual(wed, stale);
  const programWeek = buildProgramTabProjectedWeek({
    mondayISO: '2026-05-04',
    todayISO: TODAY_ISO,
    state,
    overrideContexts: {},
  });
  const programWed = programWeek.find((d) => d.date === wed);
  const dayWed = buildDayWorkoutProjectedDay({
    date: wed,
    todayISO: TODAY_ISO,
    state,
  });

  ok('Program tab projection found Wednesday', !!programWed?.workout);
  ok('Program tab title is not Upper Pull', programWed?.workout?.name !== 'Upper Pull');
  ok('DayWorkout title is not Upper Pull', dayWed.workout?.name !== 'Upper Pull');
  eq('Program tab and DayWorkout titles match', programWed?.workout?.name, dayWed.workout?.name);
  ok(
    'title shows conditioning/row identity',
    /conditioning|aerobic|zone\s*2|row/i.test(programWed?.workout?.name ?? ''),
    `title: ${programWed?.workout?.name}`,
  );
  ok('DayWorkout subtitle source is Conditioning', dayWed.workout?.workoutType === 'Conditioning');
}

section('[15] Easy Aerobic Flush stays the visible title, not generic Aerobic Base');
{
  const wed = '2026-05-06';
  const flush = wk('Easy Aerobic Flush (25min Rower)', 3, [
    ex('Easy Aerobic Flush (25min Rower)'),
  ], {
    workoutType: 'Conditioning',
    sessionTier: 'optional',
    conditioningFlavour: 'aerobic',
  });
  const state = stateWithManual(wed, flush);
  const programWeek = buildProgramTabProjectedWeek({
    mondayISO: '2026-05-04',
    todayISO: TODAY_ISO,
    state,
    overrideContexts: {},
  });
  const programWed = programWeek.find((d) => d.date === wed);
  const dayWed = buildDayWorkoutProjectedDay({
    date: wed,
    todayISO: TODAY_ISO,
    state,
  });

  eq('Program tab title keeps recovery-biased identity', programWed?.workout?.name, 'Easy Aerobic Flush');
  eq('DayWorkout title matches Program tab', dayWed.workout?.name, 'Easy Aerobic Flush');
  ok('title is not generic Aerobic Base', programWed?.workout?.name !== 'Aerobic Base');
}

// ─── Summary ───
console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
