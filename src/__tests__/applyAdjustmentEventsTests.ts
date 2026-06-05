/**
 * applyAdjustmentEventsTests — Validates the Stage 3 event-application
 * helper (src/utils/applyAdjustmentEvents.ts).
 *
 * The helper translates a list of AdjustmentEvents into a single
 * setManualOverride write per touched date. It is the seam between the
 * deterministic UAE engine (which only emits events) and the Zustand
 * program store (which actually persists them).
 *
 * STRATEGY
 *   - Inject a stub `buildState`, `resolveWeek`, and `setManualOverride`
 *     so the helper never reaches into real stores or the actual resolver.
 *   - Hand-build a fixture week with WED conditioning + THU strength + FRI
 *     strength so each event-handler scenario gets the workout shape it
 *     needs.
 *   - Assert on the captured override-call list rather than reading state
 *     back through a resolver — the helper's contract is "one
 *     setManualOverride per touched date with the final folded workout",
 *     and that's exactly what we verify here.
 *
 * Run: sucrase-node src/__tests__/applyAdjustmentEventsTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  applyAdjustmentEvents,
  APPLY_REJECT_KIND,
  type ApplyOptions,
} from '../utils/applyAdjustmentEvents';
import type {
  AdjustmentEvent,
  AdjustmentEventKind,
} from '../utils/programAdjustmentEngine';
import type {
  Workout,
  WorkoutExercise,
  ConditioningBlock,
  OverrideContext,
} from '../types/domain';
import type { ResolvedDay, ScheduleState } from '../utils/sessionResolver';

// ─────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────

const FIXED_TODAY = '2026-04-29'; // Wednesday
const FIXED_MONDAY = '2026-04-27';

const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  date.setDate(date.getDate() + n);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

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

function strengthWorkout(name: string, exercises: WorkoutExercise[]): Workout {
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

function conditioningWorkout(
  name: string,
  exercises: WorkoutExercise[],
  options: { title: string; description: string; exerciseIds: string[] }[],
): Workout {
  const block: ConditioningBlock = {
    intent: 'high-intensity',
    options,
  };
  return {
    id: `wk-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    microcycleId: 'mc-test',
    dayOfWeek: 3,
    name,
    description: '',
    durationMinutes: 45,
    intensity: 'High' as any,
    workoutType: 'Conditioning' as any,
    sessionTier: 'core',
    exercises,
    conditioningBlock: block,
    hasCombinedConditioning: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  } as Workout;
}

/** Mon→Sun fixture rooted on FIXED_MONDAY. */
function buildBaseWeek(per: Record<number, Workout | null>): ResolvedDay[] {
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(FIXED_MONDAY, i);
    const dow = isoToDow(date);
    out.push({
      date,
      dayOfWeek: dow,
      short: SHORT[dow],
      isToday: date === FIXED_TODAY,
      workout: per[dow] ?? null,
      source: per[dow] ? ('template' as any) : ('rest' as any),
      indicator: null as any,
    } as ResolvedDay);
  }
  return out;
}

function emptyScheduleState(): ScheduleState {
  return {
    currentProgram: null,
    currentMicrocycle: null,
    manualOverrides: {},
    markedDays: {},
    athleteContext: {} as any,
    seasonPhase: null,
    readiness: 'medium',
  } as ScheduleState;
}

// ─────────────────────────────────────────────────────────────────────────
// Captured-write spy
// ─────────────────────────────────────────────────────────────────────────

interface OverrideCall {
  date: string;
  workout: Workout;
  ctx?: OverrideContext;
}

function makeSpy() {
  const calls: OverrideCall[] = [];
  return {
    calls,
    setManualOverride: (date: string, workout: Workout, ctx?: OverrideContext) => {
      calls.push({ date, workout, ctx });
    },
  };
}

function makeOpts(week: ResolvedDay[], spy: ReturnType<typeof makeSpy>): ApplyOptions {
  return {
    todayISO: FIXED_TODAY,
    buildState: () => emptyScheduleState(),
    resolveWeek: () => week,
    setManualOverride: spy.setManualOverride,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Event factory
// ─────────────────────────────────────────────────────────────────────────

let eventCounter = 0;
function event(
  kind: AdjustmentEventKind,
  date: string,
  reason = 'test',
  before?: any,
  after?: any,
): AdjustmentEvent {
  eventCounter += 1;
  return {
    id: `${kind}-${eventCounter}`,
    kind,
    date,
    reason,
    before,
    after,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Tiny harness
// ─────────────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  \u2713 ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n      ${detail}` : ''));
    console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  ok(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function section(label: string) {
  console.log(`\n${label}`);
}

// ─────────────────────────────────────────────────────────────────────────
// 1. remove_exercise — removes the actual exercise from the override
// ─────────────────────────────────────────────────────────────────────────

section('[1] remove_exercise');
{
  const thuStrength = strengthWorkout('Lower Strength', [
    ex('RDLs', 3),
    ex('Back Squat', 4),
    ex('Bulgarian Split Squat', 3),
  ]);
  const week = buildBaseWeek({
    4: thuStrength, // Thursday 2026-04-30
  });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('remove_exercise', '2026-04-30', 'protect hammy', 'RDLs'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('one applied entry', result.applied.length, 1);
  eq('zero rejections', result.rejected.length, 0);
  eq('one override write', spy.calls.length, 1);
  eq('write hits Thursday', spy.calls[0].date, '2026-04-30');

  const written = spy.calls[0].workout;
  ok(
    'RDLs removed from override',
    !written.exercises.some((e) => e.exercise?.name === 'RDLs'),
  );
  ok(
    'Back Squat preserved',
    written.exercises.some((e) => e.exercise?.name === 'Back Squat'),
  );
  eq('exercise count = 2', written.exercises.length, 2);
  eq('override context intent', spy.calls[0].ctx?.intent, 'injury');
}

// ─────────────────────────────────────────────────────────────────────────
// 2. set_session_recovery — replaces the session with recovery shell
// ─────────────────────────────────────────────────────────────────────────

section('[2] set_session_recovery');
{
  const friStrength = strengthWorkout('Upper Strength', [
    ex('Bench Press', 4),
    ex('Pull-Ups', 3),
  ]);
  const week = buildBaseWeek({
    5: friStrength, // Friday 2026-05-01
  });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('set_session_recovery', '2026-05-01', 'severe injury'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('one applied', result.applied.length, 1);
  eq('one override write', spy.calls.length, 1);

  const written = spy.calls[0].workout;
  eq('name = Recovery', written.name, 'Recovery');
  eq('workoutType = Recovery', written.workoutType, 'Recovery');
  eq('sessionTier = recovery', written.sessionTier, 'recovery');
  eq('exercises empty', written.exercises.length, 0);
  ok('hasCombinedConditioning is false', written.hasCombinedConditioning === false);
  ok('conditioningBlock cleared', written.conditioningBlock === undefined);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. lighten_session — visibly changes the session
// ─────────────────────────────────────────────────────────────────────────

section('[3] lighten_session');
{
  const thuStrength = strengthWorkout('Lower Strength', [
    ex('RDLs', 4),
    ex('Back Squat', 4),
  ]);
  const week = buildBaseWeek({ 4: thuStrength });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('lighten_session', '2026-04-30', 'cooked from team training'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('one applied', result.applied.length, 1);
  const written = spy.calls[0].workout;
  eq('tier flipped to optional', written.sessionTier, 'optional');
  ok(
    'description tagged with lightened note',
    /Injury-lightened/i.test(written.description),
  );
  // 4 → ceil(4/2) = 2 sets
  eq('RDLs sets halved', written.exercises[0].prescribedSets, 2);
  eq('Back Squat sets halved', written.exercises[1].prescribedSets, 2);
}

// ─────────────────────────────────────────────────────────────────────────
// 4. swap_conditioning_modality — running conditioning → off-feet
// ─────────────────────────────────────────────────────────────────────────

section('[4] swap_conditioning_modality');
{
  const sprintEx = ex('Sprint Intervals', 1);
  const wedConditioning = conditioningWorkout(
    'Sprint Intervals',
    [sprintEx],
    [{ title: 'Sprint Intervals', description: '6×60m', exerciseIds: [sprintEx.id] }],
  );
  const week = buildBaseWeek({ 3: wedConditioning }); // 2026-04-29
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('swap_conditioning_modality', '2026-04-29', 'hammy 6/10'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('one applied', result.applied.length, 1);
  const written = spy.calls[0].workout;
  eq(
    'exercise renamed to off-feet bike option',
    written.exercises[0].exercise?.name,
    'Max Effort Sprint Accumulation',
  );
  eq(
    'conditioningBlock option title rewritten',
    written.conditioningBlock?.options[0].title,
    'Max Effort Sprint Accumulation',
  );
  ok(
    'description tagged with off-feet note',
    /Off-feet/i.test(written.description),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 4b. add_conditioning_block with replaceActivity updates, not duplicates
// ─────────────────────────────────────────────────────────────────────────

section('[4b] add_conditioning_block duration update replaces source activity');
{
  const flushEx = ex('Easy Aerobic Flush (25min Assault Bike)', 1);
  const wedConditioning = conditioningWorkout(
    'Easy Aerobic Flush (25min Assault Bike)',
    [flushEx],
    [{
      title: 'Easy Aerobic Flush (25min Assault Bike)',
      description: '25min easy Assault Bike.',
      exerciseIds: [flushEx.id],
    }],
  );
  const week = buildBaseWeek({ 3: wedConditioning });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('add_conditioning_block', '2026-04-29', 'duration update', null, {
      title: 'Easy Aerobic Flush (60min Assault Bike)',
      description: '60 min easy assault bike at conversational pace.',
      coachNote: 'Updated Easy Aerobic Flush to 60 min',
      minutes: 60,
      sets: 1,
      restSeconds: 0,
      prescriptionType: 'duration_minutes',
      replaceActivity: 'Easy Aerobic Flush (25min Assault Bike)',
      exerciseId: 'coach-easy-aerobic-flush-assault-bike',
    }),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('one applied', result.applied.length, 1);
  eq('one override write', spy.calls.length, 1);
  const written = spy.calls[0].workout;
  eq('conditioning option count remains one', written.conditioningBlock?.options.length, 1);
  eq(
    'conditioning option title updated',
    written.conditioningBlock?.options[0].title,
    'Easy Aerobic Flush (60min Assault Bike)',
  );
  ok(
    'old 25min option removed',
    !(written.conditioningBlock?.options ?? []).some((option) => /25min/i.test(option.title)),
  );
  eq('conditioning exercise count remains one', written.exercises.length, 1);
  ok(
    'exercise row updated to 60 min',
    /60 min/i.test(String(written.exercises[0].notes ?? '')) ||
      written.exercises[0].prescribedRepsMin === 60,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 5. mark_session_optional — flips tier without touching exercises
// ─────────────────────────────────────────────────────────────────────────

section('[5] mark_session_optional');
{
  const thuStrength = strengthWorkout('Lower Strength', [
    ex('RDLs', 3),
    ex('Back Squat', 4),
  ]);
  const week = buildBaseWeek({ 4: thuStrength });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('mark_session_optional', '2026-04-30', 'busy week'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('one applied', result.applied.length, 1);
  const written = spy.calls[0].workout;
  eq('tier flipped to optional', written.sessionTier, 'optional');
  eq('exercise count unchanged', written.exercises.length, 2);
  eq('RDLs sets unchanged', written.exercises[0].prescribedSets, 3);
  ok(
    'description tagged optional',
    /Marked optional/i.test(written.description),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Past-date event rejected
// ─────────────────────────────────────────────────────────────────────────

section('[6] past-date rejection');
{
  const week = buildBaseWeek({
    4: strengthWorkout('Lower Strength', [ex('RDLs', 3)]),
  });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('remove_exercise', '2026-04-28', 'past', 'RDLs'), // < 2026-04-29
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('zero applied', result.applied.length, 0);
  eq('zero overrides written', spy.calls.length, 0);
  eq('one rejection', result.rejected.length, 1);
  eq('rejection kind = past_date_blocked', result.rejected[0].kind, APPLY_REJECT_KIND.PAST_DATE);
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Missing exercise rejected
// ─────────────────────────────────────────────────────────────────────────

section('[7] exercise-not-present rejection');
{
  const thuStrength = strengthWorkout('Lower Strength', [ex('Back Squat', 4)]);
  const week = buildBaseWeek({ 4: thuStrength });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('remove_exercise', '2026-04-30', 'remove RDLs', 'RDLs'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('zero applied', result.applied.length, 0);
  eq('zero overrides written', spy.calls.length, 0);
  eq('one rejection', result.rejected.length, 1);
  eq(
    'rejection kind = exercise_not_present',
    result.rejected[0].kind,
    APPLY_REJECT_KIND.EXERCISE_NOT_PRESENT,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 8. No resolved day rejection (event date outside week fixture)
// ─────────────────────────────────────────────────────────────────────────

section('[8] invalid-target-date rejection (date outside resolved week)');
{
  const week = buildBaseWeek({
    4: strengthWorkout('Lower Strength', [ex('RDLs', 3)]),
  });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    // Date is in the future but outside the fixture week.
    event('remove_exercise', '2026-05-15', 'far future', 'RDLs'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('zero applied', result.applied.length, 0);
  eq('zero overrides written', spy.calls.length, 0);
  // Out-of-week dates are now categorised as INVALID_TARGET_DATE so
  // the dispatcher can surface "engine targeted a date outside the
  // user's program" without ambiguity.
  eq(
    'rejection kind = invalid_target_date',
    result.rejected[0].kind,
    APPLY_REJECT_KIND.INVALID_TARGET_DATE,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 9. No-workout-on-date rejection (rest day)
// ─────────────────────────────────────────────────────────────────────────

section('[9] no-workout-on-date rejection');
{
  const week = buildBaseWeek({
    // Sunday (dow=0) explicitly null — rest day
    4: strengthWorkout('Lower Strength', [ex('RDLs', 3)]),
  });
  // Friday 2026-05-01 has no workout in our fixture (per index 5 omitted).
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('remove_exercise', '2026-05-01', 'rest day attempt', 'RDLs'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('zero applied', result.applied.length, 0);
  eq(
    'rejection kind = no_workout_on_date',
    result.rejected[0].kind,
    APPLY_REJECT_KIND.NO_WORKOUT_ON_DATE,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 10. Per-date folding — multiple events on same date → 1 setManualOverride
// ─────────────────────────────────────────────────────────────────────────

section('[10] per-date folding');
{
  const thuStrength = strengthWorkout('Lower Strength', [
    ex('RDLs', 3),
    ex('Back Squat', 4),
    ex('Bulgarian Split Squat', 3),
  ]);
  const week = buildBaseWeek({ 4: thuStrength });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('remove_exercise', '2026-04-30', 'avoid hammy', 'RDLs'),
    event('remove_exercise', '2026-04-30', 'avoid hammy', 'Bulgarian Split Squat'),
    event('mark_session_optional', '2026-04-30', 'lighten lower'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('one applied entry (folded)', result.applied.length, 1);
  eq('one override write (folded)', spy.calls.length, 1);
  eq('three event ids merged', result.applied[0].eventIds.length, 3);

  const written = spy.calls[0].workout;
  eq('only Back Squat remains', written.exercises.length, 1);
  eq('Back Squat is the survivor', written.exercises[0].exercise?.name, 'Back Squat');
  eq('tier flipped to optional', written.sessionTier, 'optional');
}

// ─────────────────────────────────────────────────────────────────────────
// 11. set_session_recovery is terminal — later same-date events rejected
// ─────────────────────────────────────────────────────────────────────────

section('[11] set_session_recovery terminal');
{
  const thuStrength = strengthWorkout('Lower Strength', [ex('RDLs', 3)]);
  const week = buildBaseWeek({ 4: thuStrength });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('set_session_recovery', '2026-04-30', 'severe'),
    event('remove_exercise', '2026-04-30', 'redundant', 'RDLs'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('one applied (recovery only)', result.applied.length, 1);
  eq('one override write', spy.calls.length, 1);
  eq('one rejection (redundant)', result.rejected.length, 1);
  eq(
    'rejection kind = redundant_after_recovery',
    result.rejected[0].kind,
    APPLY_REJECT_KIND.REDUNDANT_AFTER_RECOVERY,
  );

  const written = spy.calls[0].workout;
  eq('still recovery shell', written.name, 'Recovery');
  eq('still empty exercises', written.exercises.length, 0);
}

// ─────────────────────────────────────────────────────────────────────────
// 12. Multi-date events → one override per date
// ─────────────────────────────────────────────────────────────────────────

section('[12] multi-date events');
{
  const thuStrength = strengthWorkout('Lower Strength', [ex('RDLs', 3)]);
  const friStrength = strengthWorkout('Upper Strength', [ex('Bench Press', 4)]);
  const week = buildBaseWeek({ 4: thuStrength, 5: friStrength });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('remove_exercise', '2026-04-30', 'no RDLs', 'RDLs'),
    event('mark_session_optional', '2026-05-01', 'busy fri'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('two applied entries', result.applied.length, 2);
  eq('two override writes', spy.calls.length, 2);
  const dates = spy.calls.map((c) => c.date).sort();
  eq('dates match thu+fri', dates, ['2026-04-30', '2026-05-01']);
}

// ─────────────────────────────────────────────────────────────────────────
// 13. Empty event list → no-op
// ─────────────────────────────────────────────────────────────────────────

section('[13] empty event list');
{
  const week = buildBaseWeek({});
  const spy = makeSpy();
  const result = applyAdjustmentEvents([], makeOpts(week, spy));
  eq('zero applied', result.applied.length, 0);
  eq('zero rejected', result.rejected.length, 0);
  eq('zero override writes', spy.calls.length, 0);
}

// ─────────────────────────────────────────────────────────────────────────
// 14. swap_conditioning_modality fallback — non-mapped name on Conditioning
// ─────────────────────────────────────────────────────────────────────────

section('[14] swap fallback for unmapped run name');
{
  const customRunEx = ex('Custom Long Run Variant', 1);
  const wedConditioning = conditioningWorkout(
    'Custom Run',
    [customRunEx],
    [
      {
        title: 'Custom Long Run Variant',
        description: 'unmapped',
        exerciseIds: [customRunEx.id],
      },
    ],
  );
  const week = buildBaseWeek({ 3: wedConditioning });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('swap_conditioning_modality', '2026-04-29', 'hammy 6/10'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('one applied', result.applied.length, 1);
  const written = spy.calls[0].workout;
  eq(
    'first slot rewritten to default off-feet',
    written.exercises[0].exercise?.name,
    'Assault Bike Intervals',
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 15. swap_conditioning_modality rejected on a Strength workout
// ─────────────────────────────────────────────────────────────────────────

section('[15] swap rejected on Strength session');
{
  const thuStrength = strengthWorkout('Lower Strength', [ex('Back Squat', 4)]);
  const week = buildBaseWeek({ 4: thuStrength });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('swap_conditioning_modality', '2026-04-30', 'no run here'),
  ];

  const result = applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('zero applied', result.applied.length, 0);
  eq('zero override writes', spy.calls.length, 0);
  eq('one rejection', result.rejected.length, 1);
  eq(
    'rejection kind = no_conditioning_to_swap',
    result.rejected[0].kind,
    APPLY_REJECT_KIND.NO_CONDITIONING_TO_SWAP,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 16. Override context carries the last reason as label
// ─────────────────────────────────────────────────────────────────────────

section('[16] override context label');
{
  const thuStrength = strengthWorkout('Lower Strength', [
    ex('RDLs', 3),
    ex('Back Squat', 4),
  ]);
  const week = buildBaseWeek({ 4: thuStrength });
  const spy = makeSpy();
  const events: AdjustmentEvent[] = [
    event('remove_exercise', '2026-04-30', 'protect hammy 6/10', 'RDLs'),
  ];

  applyAdjustmentEvents(events, makeOpts(week, spy));

  eq('ctx intent = injury', spy.calls[0].ctx?.intent, 'injury');
  eq('ctx label carries reason', spy.calls[0].ctx?.label, 'protect hammy 6/10');
}

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
