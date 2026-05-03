/**
 * resolverInjuryFilterTests — verifies that the resolver-level injury
 * filter modifies FUTURE weeks (no overrides written) so future
 * planning is automatically injury-aware.
 *
 * Run: npm run test:resolver-injury
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { applyInjuryFilterToWorkout } from '../utils/injuryWorkoutFilter';
import { resolveDate, resolveWeek } from '../utils/sessionResolver';
import type { Workout, Microcycle, TrainingProgram } from '../types/domain';
import type { ScheduleState } from '../utils/sessionResolver';
import type { InjuryState } from '../utils/injuryProgression';

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

// ─── Fixture builders ────────────────────────────────────────────────

function ex(name: string, sets = 3): any {
  return {
    id: `we-${name}`, workoutId: 'wk', exerciseId: `ex-${name}`,
    exerciseOrder: 0, prescribedSets: sets, prescribedRepsMin: 6,
    prescribedRepsMax: 8, prescribedWeightKg: 0, restSeconds: 0,
    exercise: {
      id: `ex-${name}`, name, description: name,
      exerciseType: 'Compound' as any, muscleGroups: [],
      equipmentRequired: [], difficultyLevel: 'Intermediate' as any,
      createdAt: '', updatedAt: '',
    },
    createdAt: '', updatedAt: '',
  };
}
function workout(name: string, dayOfWeek: number, opts: any = {}): Workout {
  return {
    id: `wk-${name}`,
    microcycleId: 'mc',
    dayOfWeek,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate' as any,
    workoutType: opts.workoutType || ('Strength' as any),
    sessionTier: opts.sessionTier || ('core' as any),
    exercises: opts.exercises || [],
    createdAt: '',
    updatedAt: '',
  } as Workout;
}

const FIXED_NEXT_MONDAY = '2026-05-04'; // a future week start
const FIXED_DATE = '2026-05-08'; // Friday in that future week

function programState(workouts: Workout[], activeInjury: InjuryState | null = null): ScheduleState {
  const microcycle: Microcycle = {
    id: 'mc',
    macrocycleId: 'macro',
    weekNumber: 1,
    startDate: FIXED_NEXT_MONDAY,
    endDate: '2026-05-10',
    workouts,
    createdAt: '', updatedAt: '',
  } as any;
  const program: TrainingProgram = {
    id: 'p',
    userId: 'u',
    name: 'Test',
    startDate: FIXED_NEXT_MONDAY,
    endDate: '2026-12-31',
    macrocycles: [{
      id: 'macro', programId: 'p', name: 'M', startDate: FIXED_NEXT_MONDAY,
      endDate: '2026-12-31', microcycles: [microcycle],
      createdAt: '', updatedAt: '',
    } as any],
    createdAt: '', updatedAt: '',
  } as any;
  return {
    currentProgram: program,
    currentMicrocycle: microcycle,
    manualOverrides: {},
    markedDays: {},
    athleteContext: {} as any,
    seasonPhase: null, // skip conditioning + recovery layering
    readiness: 'medium',
    activeInjury,
  };
}

function hammy(severity: number, status: InjuryState['status'] = 'active'): InjuryState {
  return {
    bodyPart: 'hammy',
    bucket: 'hamstring' as any,
    severity,
    initialSeverity: severity,
    status,
    createdAt: '2026-04-29T10:00:00Z',
    lastUpdatedAt: '2026-04-29T10:00:00Z',
    history: [],
  };
}

// ─────────────────────────────────────────────────────────────────────
// 1. UNIT — applyInjuryFilterToWorkout
// ─────────────────────────────────────────────────────────────────────
section('[1] applyInjuryFilterToWorkout — unit');
{
  const fri = workout('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] });

  // No injury → pass-through.
  ok('no injury → identity', applyInjuryFilterToWorkout(fri, null) === fri);

  // Resolved → pass-through.
  ok('resolved → identity', applyInjuryFilterToWorkout(fri, hammy(6, 'resolved')) === fri);

  // Severity 6 strict → RDLs swapped to Goblet Squat (replacement
  // available) so the exercise list is still 2 long but RDLs is gone.
  const strict = applyInjuryFilterToWorkout(fri, hammy(6));
  ok('strict: RDLs gone', !strict.exercises.some((e) => e.exercise?.name === 'RDLs'));
  ok(
    'strict: Goblet Squat present (original or replacement)',
    strict.exercises.some((e) => e.exercise?.name === 'Goblet Squat'),
  );
  ok(
    'strict: coachNotes contains tier note',
    !!strict.coachNotes?.some((n) => /sprint/i.test(n)),
  );
  ok(
    'strict: coachNotes records the swap',
    !!strict.coachNotes?.some(
      (n) => /Replaced RDLs|Removed: RDLs/.test(n),
    ),
  );

  // Severity 4 relaxed → no removal, only notes.
  const relaxed = applyInjuryFilterToWorkout(fri, hammy(4));
  eq('relaxed: exercise count unchanged', relaxed.exercises.length, 2);
  ok(
    'relaxed: coachNotes mentions limited sprinting OR light hinge',
    !!relaxed.coachNotes?.some((n) => /limited|light hinge/i.test(n)),
  );

  // Severity 1 light → notes only, no removal.
  const light = applyInjuryFilterToWorkout(fri, hammy(1));
  eq('light: exercise count unchanged', light.exercises.length, 2);
  ok(
    'light: coachNotes contains gradual note',
    !!light.coachNotes?.some((n) => /gradually/i.test(n)),
  );

  // Severity 0 (none tier) → identity.
  ok('severity 0 → identity', applyInjuryFilterToWorkout(fri, hammy(0)) === fri);

  // Recovery session → never modified.
  const rec = workout('Recovery Session', 3, { workoutType: 'Recovery', sessionTier: 'recovery' });
  ok('recovery → identity', applyInjuryFilterToWorkout(rec, hammy(6)) === rec);

  // Game stub → never modified.
  const game = workout('Game', 6, { workoutType: 'Game' });
  ok('game → identity', applyInjuryFilterToWorkout(game, hammy(6)) === game);
}

// ─────────────────────────────────────────────────────────────────────
// 2. INTEGRATION — resolveDate on a FUTURE date returns filtered workout
//    (no overrides written; pure resolver behaviour)
// ─────────────────────────────────────────────────────────────────────
section('[2] resolveDate — future date reflects activeInjury without overrides');
{
  const friFuture = workout('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] });

  // No injury — template stands.
  const baselineState = programState([friFuture], null);
  const baseline = resolveDate(FIXED_DATE, baselineState);
  ok('baseline: returns workout', !!baseline.workout);
  ok('baseline: includes RDLs', !!baseline.workout?.exercises.some((e) => e.exercise?.name === 'RDLs'));
  ok('baseline: no coachNotes', (baseline.workout?.coachNotes ?? []).length === 0);

  // Active hammy 6/10 — filter strips RDLs.
  const injuredState = programState([friFuture], hammy(6));
  const filtered = resolveDate(FIXED_DATE, injuredState);
  ok('injured: returns workout', !!filtered.workout);
  ok(
    'injured: RDLs gone (without override)',
    !filtered.workout?.exercises.some((e) => e.exercise?.name === 'RDLs'),
    `exercises: ${JSON.stringify(filtered.workout?.exercises.map((e) => e.exercise?.name))}`,
  );
  ok(
    'injured: coachNotes mentions sprinting',
    !!filtered.workout?.coachNotes?.some((n) => /sprint/i.test(n)),
  );
  // Source is still 'template' — we didn't write an override.
  eq('injured: source remains template', filtered.source, 'template');

  // No overrides were written (manualOverrides untouched).
  eq('manualOverrides not mutated', injuredState.manualOverrides, {});
}

// ─────────────────────────────────────────────────────────────────────
// 3. SCENARIO — injury resolved → next week returns to template
// ─────────────────────────────────────────────────────────────────────
section('[3] resolveDate — resolved injury → template workout');
{
  const fri = workout('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] });
  const state = programState([fri], hammy(6, 'resolved'));
  const resolved = resolveDate(FIXED_DATE, state);
  ok('resolved: RDLs back', !!resolved.workout?.exercises.some((e) => e.exercise?.name === 'RDLs'));
  ok('resolved: no coachNotes', (resolved.workout?.coachNotes ?? []).length === 0);
}

// ─────────────────────────────────────────────────────────────────────
// 4. SCENARIO — severity progression affects future weeks
// ─────────────────────────────────────────────────────────────────────
section('[4] resolveDate — severity tier transitions reflected next week');
{
  const fri = workout('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] });

  // Severity 6 (strict) — RDLs swapped to Goblet Squat. With the
  // replacement, exercise count stays at 2 but RDLs is no longer
  // present.
  const sev6 = resolveDate(FIXED_DATE, programState([fri], hammy(6)));
  ok(
    'sev 6: RDLs gone (replaced or removed)',
    !sev6.workout?.exercises.some((e) => e.exercise?.name === 'RDLs'),
  );

  // Severity 4 (relaxed) — RDLs back, notes only.
  const sev4 = resolveDate(FIXED_DATE, programState([fri], hammy(4)));
  eq('sev 4: RDLs back', sev4.workout?.exercises.length, 2);
  ok('sev 4: coachNotes present', (sev4.workout?.coachNotes ?? []).length > 0);

  // Severity 1 (light) — RDLs back, gradual note.
  const sev1 = resolveDate(FIXED_DATE, programState([fri], hammy(1)));
  eq('sev 1: RDLs back', sev1.workout?.exercises.length, 2);
  ok(
    'sev 1: gradual note',
    !!sev1.workout?.coachNotes?.some((n) => /gradually/i.test(n)),
  );
}

// ─────────────────────────────────────────────────────────────────────
// 5. NO REGRESSION — manual overrides remain authoritative
// ─────────────────────────────────────────────────────────────────────
section('[5] Manual override on a date bypasses the filter');
{
  const fri = workout('Lower Strength', 5, { exercises: [ex('RDLs')] });
  // The override has its OWN explicit state — RDLs intentionally kept
  // and a different note. The filter must NOT double-mutate.
  const overrideWorkout: Workout = {
    ...workout('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] }),
    coachNotes: ['coach-authored note'],
  };
  const state: ScheduleState = {
    ...programState([fri], hammy(6)),
    manualOverrides: { [FIXED_DATE]: overrideWorkout },
  };
  const resolved = resolveDate(FIXED_DATE, state);
  eq('source = manual', resolved.source, 'manual');
  ok('override exercises preserved (RDLs kept)', !!resolved.workout?.exercises.some((e) => e.exercise?.name === 'RDLs'));
  ok(
    'override coachNotes preserved',
    !!resolved.workout?.coachNotes?.some((n) => n === 'coach-authored note'),
  );
  // The filter's "Removed: RDLs" note must NOT appear because the
  // override was authoritative.
  ok(
    'no double-filter mutation',
    !resolved.workout?.coachNotes?.some((n) => /Removed: RDLs/.test(n)),
  );
}

// ─────────────────────────────────────────────────────────────────────
// 6. resolveWeek — every relevant day in next week is filtered
// ─────────────────────────────────────────────────────────────────────
section('[6] resolveWeek — entire next week reflects activeInjury');
{
  const thu = workout('Team Training', 4, { workoutType: 'Team Training' });
  const fri = workout('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] });
  const state = programState([thu, fri], hammy(6));
  const week = resolveWeek(FIXED_NEXT_MONDAY, state);
  const friDay = week.find((d) => d.date === '2026-05-08');
  const thuDay = week.find((d) => d.date === '2026-05-07');
  ok('Thu Team Training has coachNote', !!thuDay?.workout?.coachNotes?.some((n) => /sprint/i.test(n)));
  ok('Fri Lower has RDLs removed', !friDay?.workout?.exercises.some((e) => e.exercise?.name === 'RDLs'));
  ok(
    'Fri Lower has coachNotes',
    (friDay?.workout?.coachNotes ?? []).length > 0,
  );
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
