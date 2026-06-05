/**
 * coachReferenceResolverTests — durable target context + deterministic
 * reference resolver (Phase 2).
 *
 * Proves:
 *   - DayWorkoutScreen-equivalent open writes lastOpenedWorkout, and a
 *     follow-up "change it to a bike" anchors that day.
 *   - Coach-explanation write of lastExplainedSession anchors "it" /
 *     "that session".
 *   - "the row" matches against modality stamps + the visible week.
 *   - Explicit "Monday" beats a Wednesday last-discussed entry.
 *   - "change it" with no context → clarifier (no_target).
 *   - Stale (> TTL) context → clarifier (expired).
 *   - isMutationLike correctly flags change/swap/remove/add language.
 *
 * Run: npm run test:coach-reference-resolver
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const realLog = console.log;
console.log = (..._args: any[]) => {};

import type { ResolvedDay } from '../utils/sessionResolver';
import {
  resolveCoachReference,
  isMutationLike,
  extractModalitiesFromSession,
} from '../utils/coachReferenceResolver';
import {
  useCoachContextStateStore,
  getCoachContextSnapshot,
  COACH_CONTEXT_TTL_MS,
} from '../store/coachContextStateStore';

// ─── Fixtures ───────────────────────────────────────────────────────

const FIXED_TODAY = '2026-04-29'; // Wednesday
const FIXED_MONDAY = '2026-04-27';
const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

function ex(name: string): any {
  return {
    id: `we-${name}`,
    workoutId: 'wk',
    exerciseId: `ex-${name}`,
    exerciseOrder: 0,
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

function wk(name: string, dow: number, exercises: any[] = []): any {
  return {
    id: `w-${dow}`,
    microcycleId: 'mc',
    dayOfWeek: dow,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: 'Conditioning',
    sessionTier: 'core',
    exercises,
    createdAt: '',
    updatedAt: '',
  };
}

function buildResolvedDay(
  date: string,
  workoutDef: any | null,
): ResolvedDay {
  const dow = isoToDow(date);
  return {
    date,
    dayOfWeek: dow,
    short: SHORT[dow],
    isToday: date === FIXED_TODAY,
    workout: workoutDef,
    source: workoutDef ? 'template' : 'rest',
    indicator: null,
  } as any;
}

/**
 * Build the sample week the coach report calls out:
 * Monday Lower Body Strength, Wednesday Easy Aerobic Flush rower,
 * Friday Upper Pull, Sat game.
 */
function buildSampleCurrentWeek(): ResolvedDay[] {
  const monLower = wk('Lower Body Strength', 1, [
    ex('Trap Bar Deadlift'),
    ex('Romanian Deadlift'),
  ]);
  const wedRow = wk('Easy Aerobic Flush', 3, [ex('Rower')]);
  const friPull = wk('Upper Pull', 5, [ex('Pull-Up'), ex('Bent-Over Row')]);
  const days: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(FIXED_MONDAY, i);
    const dow = isoToDow(date);
    let w: any = null;
    if (dow === 1) w = monLower;
    else if (dow === 3) w = wedRow;
    else if (dow === 5) w = friPull;
    days.push(buildResolvedDay(date, w));
  }
  return days;
}

// ─── Test harness ───────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    realLog(`  \u2713 ${name}`);
  } else {
    fail++;
    failures.push(name);
    realLog(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function eq<T>(name: string, a: T, b: T) {
  ok(
    name,
    JSON.stringify(a) === JSON.stringify(b),
    `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`,
  );
}

function section(label: string) {
  realLog(`\n${label}`);
}

function resetStore() {
  useCoachContextStateStore.getState().clearCoachContext();
}

// ─── 1. extractModalitiesFromSession ────────────────────────────────
section('[1] extractModalitiesFromSession');
{
  const tokens = extractModalitiesFromSession({
    name: 'Easy Aerobic Flush',
    exercises: [{ exercise: { name: 'Rower' } }],
  });
  ok('rower modality detected', tokens.includes('rower'));

  const upper = extractModalitiesFromSession({
    name: 'Upper Pull',
    exercises: [{ exercise: { name: 'Pull-Up' } }, { exercise: { name: 'Bent-Over Row' } }],
  });
  // "Bent-Over Row" includes "row" word → matches the row modality
  ok('row token picked up from exercise list', upper.includes('row'));

  const sprint = extractModalitiesFromSession({
    name: 'Sprint Mechanics',
    exercises: [{ exercise: { name: 'Hill Sprints' } }],
  });
  ok('sprint modality detected', sprint.includes('sprint'));
}

// ─── 2. isMutationLike ──────────────────────────────────────────────
section('[2] isMutationLike — change/swap/remove/add language');
{
  ok('"change it" is mutation-like', isMutationLike('Can you change it to a bike?'));
  ok('"swap" is mutation-like', isMutationLike('Swap the rower for a bike'));
  ok('"remove" is mutation-like', isMutationLike('Remove the Wednesday session'));
  ok('"add" is mutation-like', isMutationLike('Add conditioning to Monday'));
  ok('"move" is mutation-like', isMutationLike('Move my Monday to Tuesday'));
  ok(
    '"why is the row there?" is NOT mutation-like',
    !isMutationLike('why is the row there?'),
  );
  ok(
    'plain question NOT mutation-like',
    !isMutationLike("what's on tomorrow?"),
  );
}

// ─── 3. DayWorkoutScreen open → "change it to bike" resolves ────────
section('[3] open Wednesday Easy Aerobic Flush, then "change it to bike"');
{
  resetStore();
  const week = buildSampleCurrentWeek();
  // simulate DayWorkoutScreen mount writing the open workout
  useCoachContextStateStore.getState().setLastOpenedWorkout({
    date: '2026-04-29', // Wednesday
    sessionName: 'Easy Aerobic Flush',
    modalities: ['rower', 'row'],
    source: 'day_workout',
  });

  const ctx = getCoachContextSnapshot();
  ok('lastOpenedWorkout populated', ctx.lastOpenedWorkout?.date === '2026-04-29');
  ok('lastDiscussedWorkout mirrors open', ctx.lastDiscussedWorkout?.date === '2026-04-29');

  const res = resolveCoachReference({
    userMessage: 'Can you change it to a bike instead of a row?',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });
  // Note: "the row" will match modality first; "bike" is also a token
  // but only the row exists in the visible week — so the resolver
  // should resolve to Wednesday via modality match (preferring last-
  // discussed since it has rower modality).
  eq('status resolved', res.status, 'resolved');
  eq('target date is Wednesday', res.target?.date, '2026-04-29');
  ok('mutation flagged', res.isMutationLike === true);
}

// ─── 4. Pure pronoun ("change it") after open ───────────────────────
section('[4] open Wednesday, then "Can you change it?" with no modality');
{
  resetStore();
  const week = buildSampleCurrentWeek();
  useCoachContextStateStore.getState().setLastOpenedWorkout({
    date: '2026-04-29',
    sessionName: 'Easy Aerobic Flush',
    modalities: ['rower'],
    source: 'day_workout',
  });
  const ctx = getCoachContextSnapshot();
  const res = resolveCoachReference({
    userMessage: 'Can you change it?',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });
  eq('pronoun resolves to Wed', res.target?.date, '2026-04-29');
  ok('method = pronoun_last_opened', res.target?.method === 'pronoun_last_opened');
  ok('mutationLike true', res.isMutationLike);
}

// ─── 5. Coach explanation populates lastExplainedSession ────────────
section('[5] coach explains Wednesday row, then "change it to bike"');
{
  resetStore();
  const week = buildSampleCurrentWeek();
  // Simulate dispatcher writing lastExplainedSession after a
  // program_explanation reply.
  useCoachContextStateStore.getState().setLastExplainedSession({
    date: '2026-04-29',
    sessionName: 'Easy Aerobic Flush',
    modalities: ['rower', 'row'],
    source: 'coach_explanation',
  });
  const ctx = getCoachContextSnapshot();
  ok('lastExplainedSession populated', ctx.lastExplainedSession?.date === '2026-04-29');

  const res = resolveCoachReference({
    userMessage: 'Can you change it to a bike instead of a row?',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });
  eq('explained-session anchor wins', res.target?.date, '2026-04-29');
  eq('status resolved', res.status, 'resolved');
}

// ─── 6. "the row" alone matches modality on visible week ───────────
section('[6] "swap the row for a bike" — modality scan of visible week');
{
  resetStore();
  const week = buildSampleCurrentWeek();
  // No prior context — resolver must scan the visible week.
  const ctx = getCoachContextSnapshot();
  const res = resolveCoachReference({
    userMessage: 'Can you swap the rower for a bike?',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });
  // Wednesday Easy Aerobic Flush has Rower; Friday Upper Pull has
  // "Bent-Over Row" — both will match modality "row". With "rower"
  // explicitly used, the alias group includes 'row'/'rower'/'rowing'
  // so both still match. Test expects: at least Wednesday is among
  // candidates and resolution status is one of resolved/ambiguous.
  ok(
    'status is resolved or ambiguous',
    res.status === 'resolved' || res.status === 'ambiguous',
    `got ${res.status}`,
  );
  if (res.status === 'resolved') {
    eq('row session resolved', res.target?.date, '2026-04-29');
  }
}

// ─── 7. Explicit "Monday" overrides Wednesday context ──────────────
section('[7] explicit "Monday" overrides the Wednesday last-discussed');
{
  resetStore();
  const week = buildSampleCurrentWeek();
  useCoachContextStateStore.getState().setLastExplainedSession({
    date: '2026-04-29',
    sessionName: 'Easy Aerobic Flush',
    modalities: ['rower'],
    source: 'coach_explanation',
  });
  const ctx = getCoachContextSnapshot();
  const res = resolveCoachReference({
    userMessage: 'Can you change Monday to something easier?',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });
  eq('Monday wins', res.target?.date, '2026-04-27');
  ok('method = explicit_day', res.target?.method === 'explicit_day');
  ok('explicit confidence high', (res.confidence ?? 0) >= 0.9);
}

// ─── 8. Ambiguous "change it" with no context ──────────────────────
section('[8] no context + "change it" → clarifier');
{
  resetStore();
  const week = buildSampleCurrentWeek();
  const ctx = getCoachContextSnapshot();
  const res = resolveCoachReference({
    userMessage: 'Can you change it?',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });
  eq('status no_target', res.status, 'no_target');
  ok('clarifier present', !!res.clarifierQuestion && res.clarifierQuestion.length > 0);
  eq('failureReason', res.failureReason, 'pronoun_no_context');
}

// ─── 9. Expired context → clarifier ────────────────────────────────
section('[9] context older than TTL is treated as expired');
{
  resetStore();
  const week = buildSampleCurrentWeek();
  // Manually inject an entry with a stale timestamp by using the raw
  // setter then mutating updatedAt. We bypass setLastOpenedWorkout's
  // automatic timestamp by writing through the store API.
  useCoachContextStateStore.setState({
    lastOpenedWorkout: {
      date: '2026-04-29',
      sessionName: 'Easy Aerobic Flush',
      modalities: ['rower'],
      updatedAt: Date.now() - (COACH_CONTEXT_TTL_MS + 60_000),
      source: 'day_workout',
    },
    lastExplainedSession: null,
    lastDiscussedWorkout: {
      date: '2026-04-29',
      sessionName: 'Easy Aerobic Flush',
      modalities: ['rower'],
      updatedAt: Date.now() - (COACH_CONTEXT_TTL_MS + 60_000),
      source: 'day_workout',
    },
  } as any);

  const ctx = getCoachContextSnapshot();
  ok('snapshot filters stale lastOpened', ctx.lastOpenedWorkout === null);

  // Even with the stale entry passed manually to the resolver, the
  // resolver must treat it as expired.
  const stale = useCoachContextStateStore.getState();
  const res = resolveCoachReference({
    userMessage: 'Can you change it?',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    lastOpenedWorkout: stale.lastOpenedWorkout, // pre-snapshot raw
    lastExplainedSession: stale.lastExplainedSession,
    lastDiscussedWorkout: stale.lastDiscussedWorkout,
  });
  eq('status expired', res.status, 'expired');
  eq('failureReason', res.failureReason, 'pronoun_context_expired');
  ok('clarifier present', !!res.clarifierQuestion);
}

// ─── 10. Modality reference with no week match ─────────────────────
section('[10] "change the bike" when no bike session exists → no_target');
{
  resetStore();
  const week = buildSampleCurrentWeek(); // no bike sessions
  const ctx = getCoachContextSnapshot();
  const res = resolveCoachReference({
    userMessage: 'Can you change the bike to something else?',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });
  eq('status no_target', res.status, 'no_target');
  eq('failureReason', res.failureReason, 'modality_no_match');
}

// ─── 11. Day with no workout ────────────────────────────────────────
section('[11] "change Sunday" when Sunday has no workout → ambiguous');
{
  resetStore();
  const week = buildSampleCurrentWeek();
  const ctx = getCoachContextSnapshot();
  const res = resolveCoachReference({
    userMessage: 'Can you change Sunday?',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });
  eq('status ambiguous', res.status, 'ambiguous');
  eq('failureReason', res.failureReason, 'explicit_day_no_workout');
}

// ─── 12. Last-discussed picks the most recent of opened/explained ──
section('[12] lastDiscussedWorkout = whichever is most recent');
{
  resetStore();
  // open Mon then explain Wed
  useCoachContextStateStore.getState().setLastOpenedWorkout({
    date: '2026-04-27',
    sessionName: 'Lower Body Strength',
    modalities: [],
    source: 'day_workout',
  });
  // small delay to guarantee distinct timestamp ordering
  const before = useCoachContextStateStore.getState().lastOpenedWorkout?.updatedAt ?? 0;
  // overwrite explained slightly later
  useCoachContextStateStore.setState((s: any) => ({
    ...s,
    lastExplainedSession: {
      date: '2026-04-29',
      sessionName: 'Easy Aerobic Flush',
      modalities: ['rower'],
      updatedAt: before + 1000,
      source: 'coach_explanation',
    },
    lastDiscussedWorkout: {
      date: '2026-04-29',
      sessionName: 'Easy Aerobic Flush',
      modalities: ['rower'],
      updatedAt: before + 1000,
      source: 'coach_explanation',
    },
  }));
  const ctx = getCoachContextSnapshot();
  eq('lastDiscussedWorkout = explained (Wednesday)', ctx.lastDiscussedWorkout?.date, '2026-04-29');
}

// ─── 13. Add-conditioning payload modality is not the target ───────
section('[13] "add 10 min ski erg onto that day" uses pronoun target, not ski modality');
{
  resetStore();
  const week = buildSampleCurrentWeek();
  useCoachContextStateStore.getState().setLastExplainedSession({
    date: '2026-04-29',
    sessionName: 'Easy Aerobic Flush',
    modalities: ['rower', 'row'],
    source: 'coach_explanation',
  });
  const ctx = getCoachContextSnapshot();
  const res = resolveCoachReference({
    userMessage: 'Can you also add a 10 min ski erg onto that day',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });
  eq('status resolved', res.status, 'resolved');
  eq('target remains last-discussed Wednesday', res.target?.date, '2026-04-29');
  ok('method is pronoun, not modality match', res.target?.method === 'pronoun_last_explained');
}

section('[14] add-conditioning payload with no pronoun context asks which day');
{
  resetStore();
  const week = buildSampleCurrentWeek();
  const ctx = getCoachContextSnapshot();
  const res = resolveCoachReference({
    userMessage: 'Can you also add a 10 min ski erg onto that day',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });
  eq('status no_target', res.status, 'no_target');
  eq('failureReason is pronoun context, not modality match', res.failureReason, 'pronoun_no_context');
}

section('[15] deictic weekday after coach mutation uses verified mutation focus');
{
  resetStore();
  const week = buildSampleCurrentWeek();
  const nextWed = '2026-05-06';
  useCoachContextStateStore.getState().setLastExplainedSession({
    date: nextWed,
    sessionName: 'Rest',
    modalities: [],
    source: 'coach_mutation',
  });
  const ctx = getCoachContextSnapshot();
  const res = resolveCoachReference({
    userMessage: 'Can you add a Gunshow to that Wednesday?',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    nextWeek: [
      buildResolvedDay('2026-05-04', null),
      buildResolvedDay('2026-05-05', null),
      buildResolvedDay(nextWed, null),
    ],
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });
  eq('that Wednesday resolves to mutation date', res.target?.date, nextWed);
  ok('method uses recent mutation context', res.target?.contextSource === 'coach_mutation');
}

section('[16] "there" after coach mutation uses verified mutation focus');
{
  resetStore();
  const week = buildSampleCurrentWeek();
  const nextWed = '2026-05-06';
  useCoachContextStateStore.getState().setLastExplainedSession({
    date: nextWed,
    sessionName: 'Rest',
    modalities: [],
    source: 'coach_mutation',
  });
  const ctx = getCoachContextSnapshot();
  const res = resolveCoachReference({
    userMessage: 'put Gunshow there',
    todayISO: FIXED_TODAY,
    currentWeek: week,
    lastOpenedWorkout: ctx.lastOpenedWorkout,
    lastExplainedSession: ctx.lastExplainedSession,
    lastDiscussedWorkout: ctx.lastDiscussedWorkout,
  });
  eq('there resolves to mutation date', res.target?.date, nextWed);
  ok('there does not fall back to current-week Wednesday', res.target?.date !== '2026-04-29');
}

// ─── Summary ───────────────────────────────────────────────────────
realLog(`\n— Summary —`);
realLog(`  Pass: ${pass}`);
realLog(`  Fail: ${fail}`);
if (fail > 0) {
  realLog(`  Failures:`);
  for (const f of failures) realLog(`    - ${f}`);
  process.exit(1);
}
process.exit(0);
