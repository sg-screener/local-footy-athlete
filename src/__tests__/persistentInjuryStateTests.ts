/**
 * persistentInjuryStateTests — proves the activeInjury state is the
 * primary constraint that influences ALL future weeks, not just the
 * current one.
 *
 * Covers (per spec):
 *   1. Injury persists across weeks (week+1, week+2, week+3 all filtered)
 *   2. Deadlifts removed from next week (no override needed)
 *   3. Sprinting removed globally (multiple sprint sessions across weeks)
 *   4. InjuryState carries rules + startDate
 *   5. getInjuryRules derives live rules from current severity
 *   6. Resolved injury → all weeks return to template
 *   7. Severity change → rules update, all future weeks reflect new tier
 *
 * Run: npm run test:persistent-injury
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  resolveWeekWithConditioning,
  resolveDate,
} from '../utils/sessionResolver';
import type { ScheduleState } from '../utils/sessionResolver';
import type { Workout, Microcycle, TrainingProgram } from '../types/domain';
import type { InjuryState } from '../utils/injuryProgression';
import { getInjuryRules } from '../utils/injuryProgression';
import { buildInjuryPolicy } from '../utils/programAdjustmentEngine';

// ─── Harness ────────────────────────────────────────────────────────
let pass = 0; let fail = 0; const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; failures.push(name); console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`); }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { console.log(`\n${label}`); }

// ─── Fixtures ───────────────────────────────────────────────────────
function ex(name: string): any {
  return { id:`we-${name}`, workoutId:'wk', exerciseId:`ex-${name}`, exerciseOrder:0, prescribedSets:3, prescribedRepsMin:6, prescribedRepsMax:8, prescribedWeightKg:0, restSeconds:0,
    exercise:{ id:`ex-${name}`, name, description:name, exerciseType:'Compound', muscleGroups:[], equipmentRequired:[], difficultyLevel:'Intermediate', createdAt:'', updatedAt:'' },
    createdAt:'', updatedAt:'' };
}
function wk(name: string, dow: number, opts: any = {}): Workout {
  return { id:`w-${dow}`, microcycleId:'mc', dayOfWeek:dow, name, description:'', durationMinutes:60, intensity:'Moderate' as any, workoutType: opts.workoutType || ('Strength' as any), sessionTier: opts.sessionTier || ('core' as any), exercises: opts.exercises || [], createdAt:'', updatedAt:'' } as Workout;
}

function programState(workouts: Workout[], activeInjury: InjuryState | null = null, mondayISO: string = '2026-05-04'): ScheduleState {
  const microcycle: Microcycle = {
    id: 'mc', macrocycleId: 'macro', weekNumber: 1,
    startDate: mondayISO, endDate: '2026-12-31',
    workouts, createdAt: '', updatedAt: '',
  } as any;
  const program: TrainingProgram = {
    id: 'p', userId: 'u', name: 'T', startDate: mondayISO, endDate: '2026-12-31',
    macrocycles: [{ id: 'm', programId: 'p', name: 'M', startDate: mondayISO, endDate: '2026-12-31', microcycles: [microcycle], createdAt: '', updatedAt: '' } as any],
    createdAt: '', updatedAt: '',
  } as any;
  return {
    currentProgram: program,
    currentMicrocycle: microcycle,
    manualOverrides: {},
    markedDays: {},
    athleteContext: {} as any,
    seasonPhase: null,
    readiness: 'medium',
    activeInjury,
  };
}

function hammy(severity: number, status: InjuryState['status'] = 'active'): InjuryState {
  const policy = buildInjuryPolicy('hamstring' as any, severity);
  const nowISO = '2026-04-29T10:00:00Z';
  return {
    bodyPart: 'hammy',
    bucket: 'hamstring' as any,
    severity,
    initialSeverity: severity,
    status,
    rules: status === 'resolved' ? [] : [...policy.globalRules],
    startDate: nowISO,
    createdAt: nowISO,
    lastUpdatedAt: nowISO,
    history: [],
  };
}

// ─────────────────────────────────────────────────────────────────────
// 1. InjuryState carries rules + startDate
// ─────────────────────────────────────────────────────────────────────
section('[1] InjuryState — rules + startDate present');
{
  const s = hammy(6);
  ok('rules is non-empty array', Array.isArray(s.rules) && s.rules.length > 0);
  ok(
    'rules contains "No sprinting"',
    s.rules.some((r) => /no sprinting/i.test(r)),
  );
  ok(
    'rules contains "No heavy hinge"',
    s.rules.some((r) => /heavy hinge/i.test(r)),
  );
  ok('startDate is ISO timestamp', /^\d{4}-\d{2}-\d{2}T/.test(s.startDate));
  eq('startDate equals createdAt', s.startDate, s.createdAt);
}

// ─────────────────────────────────────────────────────────────────────
// 2. getInjuryRules — re-derives live rules from current severity
// ─────────────────────────────────────────────────────────────────────
section('[2] getInjuryRules — live derivation');
{
  const s = hammy(6);
  const live = getInjuryRules(s);
  ok('live rules has ≥1 entry', live.length >= 1);
  ok(
    'live rules matches stored snapshot',
    JSON.stringify(live) === JSON.stringify(s.rules),
  );

  // Stale-snapshot scenario: state.rules is empty but severity is 6.
  const stale: InjuryState = { ...s, rules: [] };
  const liveFromStale = getInjuryRules(stale);
  ok(
    'live derives correctly even when snapshot is stale',
    liveFromStale.some((r) => /no sprinting/i.test(r)),
  );

  // Resolved injury → empty live rules.
  const resolved = hammy(0, 'resolved');
  eq('resolved → empty live rules', getInjuryRules(resolved), []);
  eq('null state → empty live rules', getInjuryRules(null), []);
}

// ─────────────────────────────────────────────────────────────────────
// 3. Injury persists across week+1, week+2, week+3
// ─────────────────────────────────────────────────────────────────────
section('[3] activeInjury filters week+1 .. week+3 (no overrides written)');
{
  const fri = wk('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] });
  const injury = hammy(6);
  const state = programState([fri], injury);

  const mondays = ['2026-05-04', '2026-05-11', '2026-05-18']; // current + 1 + 2

  for (const monday of mondays) {
    const week = resolveWeekWithConditioning(monday, state);
    const friOfWeek = week.find((d) => d.dayOfWeek === 5);
    ok(
      `${monday}: Fri Lower Strength resolved`,
      !!friOfWeek?.workout,
    );
    ok(
      `${monday}: RDLs gone (filter applied)`,
      !friOfWeek?.workout?.exercises.some((e) => e.exercise?.name === 'RDLs'),
    );
    ok(
      `${monday}: coachNotes mention sprinting`,
      !!friOfWeek?.workout?.coachNotes?.some((n) => /sprint/i.test(n)),
    );
    ok(
      `${monday}: source remains template (no override written)`,
      friOfWeek?.source === 'template',
    );
  }

  // Confirm zero overrides written across all the calls.
  eq(
    'manualOverrides untouched across all weeks',
    Object.keys(state.manualOverrides).length,
    0,
  );
}

// ─────────────────────────────────────────────────────────────────────
// 4. Sprinting removed globally — multiple sprint sessions across weeks
// ─────────────────────────────────────────────────────────────────────
section('[4] Sprinting removed globally across multiple weeks');
{
  const sprintCond = wk('Sprint Intervals', 6, {
    workoutType: 'Conditioning',
    exercises: [ex('10m Sprint')],
  });
  const teamDay = wk('Team Training', 4, { workoutType: 'Team Training' });
  const lowerStrength = wk('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] });
  const injury = hammy(6);
  const state = programState([teamDay, lowerStrength, sprintCond], injury);

  const mondays = ['2026-05-04', '2026-05-11', '2026-05-18'];

  for (const monday of mondays) {
    const week = resolveWeekWithConditioning(monday, state);
    const thu = week.find((d) => d.dayOfWeek === 4);
    const fri = week.find((d) => d.dayOfWeek === 5);
    const sat = week.find((d) => d.dayOfWeek === 6);
    ok(
      `${monday}: Thu Team Training carries sprinting note`,
      !!thu?.workout?.coachNotes?.some((n) => /sprint/i.test(n)),
    );
    ok(
      `${monday}: Fri Lower Strength carries sprinting note`,
      !!fri?.workout?.coachNotes?.some((n) => /sprint/i.test(n)),
    );
    ok(
      `${monday}: Sat Sprint Intervals carries sprinting note`,
      !!sat?.workout?.coachNotes?.some((n) => /sprint/i.test(n)),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// 5. Resolved → all weeks return to template
// ─────────────────────────────────────────────────────────────────────
section('[5] Resolved injury → all weeks return to template');
{
  const fri = wk('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] });
  const injury = hammy(6, 'resolved');
  const state = programState([fri], injury);

  const mondays = ['2026-05-04', '2026-05-11', '2026-05-25'];

  for (const monday of mondays) {
    const week = resolveWeekWithConditioning(monday, state);
    const friOfWeek = week.find((d) => d.dayOfWeek === 5);
    ok(
      `${monday}: RDLs back (resolved)`,
      !!friOfWeek?.workout?.exercises.some((e) => e.exercise?.name === 'RDLs'),
    );
    ok(
      `${monday}: no coachNotes`,
      (friOfWeek?.workout?.coachNotes ?? []).length === 0,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// 6. Severity tier transitions affect ALL future weeks
// ─────────────────────────────────────────────────────────────────────
section('[6] Severity tier transitions affect all future weeks');
{
  const fri = wk('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] });

  // Tier matrix: at each severity, every future week renders consistently.
  const tierCases: Array<[number, 'has' | 'no']> = [
    [6, 'no'],   // strict tier — RDLs removed
    [4, 'has'],  // relaxed tier — RDLs back, notes only
    [1, 'has'],  // light tier — RDLs back, gradual note
    [0, 'has'],  // resolved — template
  ];

  for (const [severity, expectRDLs] of tierCases) {
    const status = severity === 0 ? 'resolved' : 'active';
    const injury = hammy(severity, status as any);
    const state = programState([fri], injury);

    for (const monday of ['2026-05-04', '2026-05-18']) {
      const week = resolveWeekWithConditioning(monday, state);
      const friOfWeek = week.find((d) => d.dayOfWeek === 5);
      const hasRDLs = !!friOfWeek?.workout?.exercises.some((e) => e.exercise?.name === 'RDLs');
      ok(
        `sev ${severity} on ${monday}: RDLs ${expectRDLs === 'has' ? 'present' : 'gone'}`,
        hasRDLs === (expectRDLs === 'has'),
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 7. Single-date resolveDate also respects activeInjury
// ─────────────────────────────────────────────────────────────────────
section('[7] resolveDate (single date) — activeInjury filter applied');
{
  const fri = wk('Lower Strength', 5, { exercises: [ex('RDLs')] });
  const injury = hammy(6);
  const state = programState([fri], injury);
  // The fri workout is dow=5; pick a Friday that's a known future date.
  const friday = '2026-05-15'; // a Friday in the future
  const day = resolveDate(friday, state);
  ok('day has workout', !!day.workout);
  ok(
    'RDLs filtered out',
    !day.workout?.exercises.some((e) => e.exercise?.name === 'RDLs'),
  );
  ok(
    'coachNotes present',
    (day.workout?.coachNotes ?? []).length > 0,
  );
}

// ─── Summary ────
console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
