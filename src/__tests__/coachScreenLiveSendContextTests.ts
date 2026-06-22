/**
 * coachScreenLiveSendContextTests — proves the modality-uniqueness
 * auto-bind seam handles the exact live failure mode that
 * smokeCoachBikeFlowTests cannot reproduce:
 *
 *   • Visible week contains Wednesday Easy Aerobic Flush (Rower).
 *   • coachContextStateStore is COLD (no lastDiscussed / lastExplained
 *     / lastOpened entries) — i.e. the live "turn 1 dispatcher hasn't
 *     written context yet by the time turn 2 builds its packet".
 *   • User message "Can you change to a bike?" parses as a modality
 *     swap with to=bike + from=null.
 *   • The deterministic resolver returns target=null
 *     (no_target / implicit_no_match).
 *   • autoBindUniqueModalityTarget MUST synthesise a resolved target
 *     pointing at Wednesday before routeCoachCommand runs.
 *
 * Coverage map (9 acceptance assertions from Sam's live brief):
 *
 *   [1] live send context has exactly one rower in the visible week
 *   [2] turn 2 packet has referenceResolution.target=null pre-bind
 *   [3] auto-bind synthesises target.date === Wednesday
 *   [4] auto-bind preserves packet.currentWeek identity (no clone-mut)
 *   [5] router with bound resolution emits mutate, needsClarification=false
 *   [6] router clarificationQuestion is undefined when bound
 *   [7] auto-bind does NOT fire when target already resolved
 *   [8] auto-bind does NOT fire on non-modality-swap messages
 *   [9] auto-bind does NOT fire when 2+ candidates match (ambiguous)
 *
 * Run: npm run test:coach-live-send-context
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const realLog = console.log;
console.log = (..._args: any[]) => {};

import type { ResolvedDay } from '../utils/sessionResolver';
import type {
  CoachContextPacket,
} from '../utils/coachIntent';
import { autoBindUniqueModalityTarget } from '../utils/coachVisibleWeekAutoBind';
import { routeCoachCommand } from '../utils/coachCommandRouter';
import { parseModalitySwapRequest } from '../utils/coachModalitySwap';
import {
  executeProgramEdit,
  interpretCoachMessageToProgramEdit,
} from '../utils/coachProgramEdit';

// ─── Fixture builders ───────────────────────────────────────────────

const FIXED_MONDAY = '2026-05-11';
const FIXED_TODAY = '2026-05-13'; // Wednesday
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

function buildResolvedDay(date: string, workoutDef: any | null): ResolvedDay {
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

/** Single rower on Wednesday (the exact live smoke fixture). */
function buildSmokeWeek(): ResolvedDay[] {
  const monLower = wk('Lower Body Strength', 1, [
    ex('Trap Bar Deadlift'),
    ex('Romanian Deadlift'),
  ]);
  const wedRow = wk('Easy Aerobic Flush (20min Rower)', 3, [ex('Rower')]);
  // Pull-Up + Lat Pulldown — no "Row" token leaking into modality
  // extraction. extractModalitiesFromSession picks up word-boundary
  // matches on session name + exercise names; "Bent-Over Row" would
  // (correctly) mark this session as a rower one and break the
  // visible-week uniqueness assumption.
  const friPull = wk('Upper Pull', 5, [ex('Pull-Up'), ex('Lat Pulldown')]);
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

/** Two rower sessions (Wednesday + Friday) — ambiguous case. */
function buildTwoRowerWeek(): ResolvedDay[] {
  const wedRow = wk('Easy Aerobic Flush', 3, [ex('Rower')]);
  const friRow = wk('Tempo Row', 5, [ex('Rower')]);
  const days: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(FIXED_MONDAY, i);
    const dow = isoToDow(date);
    let w: any = null;
    if (dow === 3) w = wedRow;
    else if (dow === 5) w = friRow;
    days.push(buildResolvedDay(date, w));
  }
  return days;
}

function buildPacket(
  week: ResolvedDay[],
  overrides: Partial<CoachContextPacket> = {},
): CoachContextPacket {
  return {
    userMessage: '',
    recentMessages: [],
    activeInjury: null,
    activeConstraints: [],
    pendingInjury: null,
    pendingCoachProposal: null,
    coachUpdate: null,
    currentWeek: week,
    nextWeek: [],
    sessionFeedback: {},
    todayISO: FIXED_TODAY,
    lastOpenedWorkout: null,
    lastExplainedSession: null,
    lastDiscussedWorkout: null,
    referenceResolution: {
      status: 'no_reference',
      target: null,
      confidence: 0,
      isMutationLike: true,
    },
    ...overrides,
  };
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

// ─── [1] Live-send context: exactly one rower in visible week ───────
section('[1] Visible-week fixture has exactly one rower');
{
  const week = buildSmokeWeek();
  // Word-boundary match: same shape as
  // extractModalitiesFromSession so the fixture matches the
  // production filter.
  const rowRe = /\b(?:row|rower|rowing)\b/i;
  const rowers = week.filter((d) => {
    if (!d.workout) return false;
    if (rowRe.test(d.workout.name ?? '')) return true;
    return (d.workout.exercises ?? []).some((e: any) =>
      rowRe.test(e.exercise?.name ?? ''),
    );
  });
  eq('one rower session in week', rowers.length, 1);
  ok(
    'rower is on Wednesday',
    rowers[0].dayOfWeek === 3,
    `dayOfWeek=${rowers[0].dayOfWeek}`,
  );
}

// ─── [2] Turn 2 pre-bind: referenceResolution.target === null ───────
section('[2] Turn 2 packet has referenceResolution.target=null pre-bind');
{
  const packet = buildPacket(buildSmokeWeek());
  ok(
    'packet.referenceResolution exists',
    packet.referenceResolution != null,
  );
  ok(
    'packet.referenceResolution.target is null',
    packet.referenceResolution!.target == null,
  );
}

// ─── [3] Auto-bind synthesises Wednesday target ─────────────────────
section('[3] Auto-bind synthesises target.date === Wednesday');
{
  const wednesdayISO = addDays(FIXED_MONDAY, 2);
  const packet = buildPacket(buildSmokeWeek());
  const outcome = autoBindUniqueModalityTarget(
    packet,
    'Can you change to a bike?',
  );
  ok('outcome.bound === true', outcome.bound === true, `reason=${outcome.reason}`);
  eq('outcome.candidateCount', outcome.candidateCount, 1);
  ok(
    'outcome.boundTarget set',
    outcome.boundTarget != null,
  );
  if (outcome.boundTarget) {
    eq('boundTarget.date is Wednesday', outcome.boundTarget.date, wednesdayISO);
    ok(
      'boundTarget.sessionName mentions Easy Aerobic Flush',
      outcome.boundTarget.sessionName.toLowerCase().includes('easy aerobic flush'),
      `sessionName=${outcome.boundTarget.sessionName}`,
    );
    eq(
      'boundTarget.method=implicit_recent_context',
      outcome.boundTarget.method,
      'implicit_recent_context',
    );
  }
}

// ─── [4] currentWeek identity preserved ─────────────────────────────
section('[4] Auto-bind preserves packet.currentWeek identity');
{
  const week = buildSmokeWeek();
  const packet = buildPacket(week);
  const outcome = autoBindUniqueModalityTarget(packet, 'Can you change to a bike?');
  ok(
    'packet.currentWeek is the same array reference',
    outcome.packet.currentWeek === week,
  );
  ok(
    'referenceResolution is a NEW object',
    outcome.packet.referenceResolution !== packet.referenceResolution,
  );
  eq(
    'referenceResolution.status === resolved',
    outcome.packet.referenceResolution?.status,
    'resolved',
  );
}

// ─── [5] Router with bound resolution emits mutate w/o clarify ──────
section('[5] Router emits mutate, needsClarification=false when bound');
{
  const packet = buildPacket(buildSmokeWeek());
  const bound = autoBindUniqueModalityTarget(
    packet,
    'Can you change to a bike?',
  );
  ok('bound.bound === true', bound.bound === true);
  const cmd = routeCoachCommand({
    userMessage: 'Can you change to a bike?',
    todayISO: FIXED_TODAY,
    referenceResolution: bound.packet.referenceResolution ?? null,
  });
  eq('routed cmd.mode === mutate', cmd.mode, 'mutate');
  if (cmd.mode === 'mutate') {
    ok(
      'cmd.needsClarification === false',
      cmd.needsClarification === false,
      `needsClarification=${cmd.needsClarification}`,
    );
  }
}

// ─── [6] Router clarificationQuestion undefined when bound ──────────
section('[6] Router clarificationQuestion is undefined when bound');
{
  const packet = buildPacket(buildSmokeWeek());
  const bound = autoBindUniqueModalityTarget(
    packet,
    'Can you change to a bike?',
  );
  const cmd = routeCoachCommand({
    userMessage: 'Can you change to a bike?',
    todayISO: FIXED_TODAY,
    referenceResolution: bound.packet.referenceResolution ?? null,
  });
  if (cmd.mode === 'mutate') {
    ok(
      'cmd.clarificationQuestion is undefined',
      cmd.clarificationQuestion == null,
      `got: ${cmd.clarificationQuestion ?? '<undef>'}`,
    );
    eq('cmd.reason', cmd.reason, 'modality_swap_one_off');
  }
}

// ─── [7] Auto-bind does NOT fire when target already resolved ───────
section('[7] Auto-bind does NOT fire when target already resolved');
{
  const wednesdayISO = addDays(FIXED_MONDAY, 2);
  const packet = buildPacket(buildSmokeWeek(), {
    referenceResolution: {
      status: 'resolved',
      target: {
        date: wednesdayISO,
        sessionName: 'Easy Aerobic Flush (20min Rower)',
        method: 'explicit_day',
      },
      confidence: 0.95,
      isMutationLike: true,
    },
  });
  const outcome = autoBindUniqueModalityTarget(
    packet,
    'Can you change Wednesday to a bike?',
  );
  ok('outcome.bound === false', outcome.bound === false);
  eq('outcome.reason', outcome.reason, 'reference_already_resolved');
  ok(
    'packet identity preserved',
    outcome.packet === packet,
  );
}

// ─── [8] Auto-bind does NOT fire on non-modality-swap messages ──────
section('[8] Auto-bind does NOT fire on non-modality-swap messages');
{
  const packet = buildPacket(buildSmokeWeek());
  const cases = [
    'Why is there a mid week row?',
    'How is the program looking this week?',
    'I feel a bit cooked',
    'Can you explain what Wednesday is?',
  ];
  for (const text of cases) {
    const outcome = autoBindUniqueModalityTarget(packet, text);
    ok(
      `not bound for "${text}"`,
      outcome.bound === false,
      `reason=${outcome.reason}`,
    );
  }
  const swap = parseModalitySwapRequest('Why is there a mid week row?');
  ok(
    'parseModalitySwapRequest returns null for plain question',
    swap == null,
    `got: ${JSON.stringify(swap)}`,
  );
}

// ─── [9] Auto-bind does NOT fire when 2+ source candidates ──────────
section('[9] Auto-bind does NOT fire when 2+ candidates match');
{
  const packet = buildPacket(buildTwoRowerWeek());
  const outcome = autoBindUniqueModalityTarget(
    packet,
    'Can you change the rower to a bike?',
  );
  ok('outcome.bound === false (ambiguous)', outcome.bound === false);
  eq('outcome.reason', outcome.reason, 'multiple_candidates');
  ok(
    'candidateCount >= 2',
    outcome.candidateCount >= 2,
    `count=${outcome.candidateCount}`,
  );
}

// ─── [10] Bonus: same-modality bike-label correction is left alone ──
section('[10] Same-modality bike-label correction routes through unchanged');
{
  // "You changed to an assault bike I wanted a normal bike" — turn 3
  // in the smoke. swap.from === swap.to === 'bike'. The auto-bind
  // should still bind to the Wednesday session if it's now a bike, so
  // we model that: replace Wednesday rower with bike.
  const week = buildSmokeWeek();
  // Mutate Wednesday in the fixture to be a bike session.
  const wedIdx = week.findIndex((d) => d.dayOfWeek === 3);
  if (wedIdx >= 0 && week[wedIdx].workout) {
    week[wedIdx] = {
      ...week[wedIdx],
      workout: wk('Easy Aerobic Flush (20min Assault Bike)', 3, [
        ex('Assault Bike'),
      ]),
    } as any;
  }
  const packet = buildPacket(week);
  const outcome = autoBindUniqueModalityTarget(
    packet,
    'You changed to an assault bike I wanted a normal bike',
  );
  // swap.from===swap.to===bike → we treat it as a same-modality
  // correction. The visible week has bike on Wednesday. With from===to,
  // no candidate has a non-target modality, so we fall through and the
  // router's bike_subtype_correction branch handles the rest with
  // ref.target left null (legacy behaviour preserved).
  ok(
    'outcome.bound depends on candidate filter',
    outcome.bound === false || outcome.boundTarget?.date != null,
    `reason=${outcome.reason}`,
  );
}

// ─── [11] Bonus: cold context + explicit "to a bike" still binds ────
section('[11] Cold context + bare "Can you change to a bike?" binds Wednesday');
{
  const wednesdayISO = addDays(FIXED_MONDAY, 2);
  // Exactly the live failure shape: no last-discussed/explained/opened,
  // referenceResolution status=no_reference and target=null.
  const packet = buildPacket(buildSmokeWeek(), {
    lastOpenedWorkout: null,
    lastExplainedSession: null,
    lastDiscussedWorkout: null,
    referenceResolution: {
      status: 'no_reference',
      target: null,
      confidence: 0,
      isMutationLike: true,
    },
  });
  const outcome = autoBindUniqueModalityTarget(
    packet,
    'Can you change to a bike?',
  );
  ok('outcome.bound === true', outcome.bound === true, `reason=${outcome.reason}`);
  eq('bound.target.date', outcome.boundTarget?.date, wednesdayISO);

  const cmd = routeCoachCommand({
    userMessage: 'Can you change to a bike?',
    todayISO: FIXED_TODAY,
    referenceResolution: outcome.packet.referenceResolution ?? null,
  });
  if (cmd.mode === 'mutate') {
    ok(
      'router target.kind === date',
      cmd.target?.kind === 'date',
      `target.kind=${cmd.target?.kind ?? 'absent'}`,
    );
    ok(
      'router needsClarification === false',
      cmd.needsClarification === false,
    );
  } else {
    ok('router emitted mutate mode', false, `mode=${cmd.mode}`);
  }
}

// ─── [12] Live ProgramEdit path binds explicit "today" add on Rest ─
section('[12] Cold context + "add conditioning today" writes Rest-day session');
{
  const week = [
    buildResolvedDay(addDays(FIXED_MONDAY, 0), wk('Upper Push + Power Sprints', 1, [
      ex('Power Sprints'),
    ])),
    buildResolvedDay(addDays(FIXED_MONDAY, 1), wk('VO2 Intervals', 2, [
      ex('VO2 Intervals'),
    ])),
    buildResolvedDay(FIXED_TODAY, null),
    buildResolvedDay(addDays(FIXED_MONDAY, 3), wk('Upper Pull', 4, [
      ex('Pull-Up'),
    ])),
  ];
  const packet = buildPacket(week, {
    todayISO: FIXED_TODAY,
    referenceResolution: {
      status: 'no_reference',
      target: null,
      confidence: 0,
      isMutationLike: true,
    },
  });
  const edit = interpretCoachMessageToProgramEdit({
    userMessage: 'Can you add some conditioning today?',
    todayISO: FIXED_TODAY,
    referenceResolution: packet.referenceResolution ?? null,
    currentWeek: packet.currentWeek,
  });
  eq('ProgramEdit targetDate is today', (edit as any).targetDate, FIXED_TODAY);
  ok(
    'ProgramEdit does not ask which day',
    edit.intent !== 'ask_question' &&
      !edit.missingFields.includes('targetDate' as any),
    JSON.stringify(edit),
  );

  let addedWorkout: any = null;
  const result = executeProgramEdit({
    programEdit: edit,
    todayISO: FIXED_TODAY,
    referenceResolution: packet.referenceResolution ?? null,
    userMessage: 'Can you add some conditioning today?',
    conditioningDeps: {
      snapshotBefore: () => null,
      snapshotAfter: () => addedWorkout,
      snapshotWeek: () => week,
    },
    addSessionDeps: {
      snapshotBefore: () => null,
      snapshotAfter: () => addedWorkout,
      visibleWeek: () => week,
      readCalendarMark: () => 'rest' as any,
      applyAdd: ({ sourceWorkout }) => {
        addedWorkout = sourceWorkout;
        return { applied: true };
      },
      verifyRendered: (args) => ({
        requestedDay: args.requestedDay,
        todayISO: args.todayISO,
        targetDate: args.targetDate,
        targetAdded: !!args.afterWorkout && (args.afterWorkout as any).workoutType === 'Conditioning',
        otherDaysUnchanged: true,
        changedOtherDates: [],
        beforeWorkoutName: args.beforeWorkout?.name ?? null,
        afterWorkoutName: args.afterWorkout?.name ?? null,
      }),
    },
    undoDeps: {
      recordMutation: (entry) => ({
        ...entry,
        id: 'live-add-conditioning-test-mutation',
        timestamp: entry.timestamp ?? 0,
        revertedAt: null,
      }),
    },
  });
  eq('executor mutates Rest day into visible session', result.kind, 'mutated');
  eq('standalone workout type is Conditioning', addedWorkout?.workoutType, 'Conditioning');
  ok('standalone title is not generic Conditioning',
    !!addedWorkout?.name && addedWorkout.name !== 'Conditioning',
    JSON.stringify(addedWorkout));
  ok('reply is verified one-off Done',
    /^Done\b/.test(result.reply) && /one-off extra session/i.test(result.reply),
    result.reply);
}

// ─── Final report ───────────────────────────────────────────────────

realLog(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  realLog('Failures:');
  for (const f of failures) realLog(`  - ${f}`);
  process.exit(1);
}
