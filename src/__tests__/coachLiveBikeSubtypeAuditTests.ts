/**
 * coachLiveBikeSubtypeAuditTests — live-path replay of Sam's bug report.
 *
 * Phase G runtime audit, item F. The live trace from the bug report:
 *
 *   Turn 1: "Why is there a mid week row"
 *           → conversation/explain. lastExplainedSession set to the
 *             Wednesday Easy Aerobic Flush rower.
 *   Turn 2: "Can you change to a bike"
 *           → resolver binds via implicit_recent_context (rare clarifier
 *             only when no fresh recent target). Router emits a modality
 *             swap mutate command. Confidence ≥ 0.55.
 *   Turn 3: "You changed to an assault bike, i want a normal bike"
 *           → parseBikeSubtypeIntent returns desiredLabel='standard',
 *             source='positive_regular'. Router emits
 *             set_bike_subtype_preference (mode=mutate). Resolver
 *             collapses same-canonical-family contexts via
 *             implicit_recent_session_family.
 *   Turn 4: "Wednesday" (only fires if turn 3 still emitted clarify)
 *           → resumes the pending bike subtype command, never falls
 *             through to legacy.
 *
 * The fail mode this test guards against: pre-Phase-G code path where
 *   • turn 3 returned ambiguous → router emitted clarify
 *   • capture refused to stash set_bike_subtype_preference
 *   • turn 4 fell through to /coach-chat
 *   • legacy /coach-chat hallucinated set_preferred_alternative.
 *
 * If this test goes red, Phase G has regressed.
 *
 * Run: sucrase-node src/__tests__/coachLiveBikeSubtypeAuditTests.ts
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  resolveCoachReference,
  type CoachReferenceResolution,
} from '../utils/coachReferenceResolver';
import {
  routeCoachCommand,
  isMutateCommand,
  type CoachCommand,
  type RouteCoachCommandInput,
} from '../utils/coachCommandRouter';
import {
  captureFromExecutorClarify,
  resumeFromPending,
} from '../utils/coachClarifierResume';
import { filterLegacyCoachActions } from '../utils/legacyCoachActionFilter';
import { parseBikeSubtypeIntent } from '../utils/coachModalitySwap';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { CoachContextEntry } from '../store/coachContextStateStore';

// ─── Tiny harness ──────────────────────────────────────────────────

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
function section(label: string) { console.log(`\n${label}`); }

// ─── Fixtures ──────────────────────────────────────────────────────

const FIXED_TODAY = '2026-05-10'; // Sunday — matches Sam's live build date
const FIXED_MONDAY = '2026-05-04';
const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const NOW = 1746835200000;

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
function buildSampleCurrentWeek(): ResolvedDay[] {
  // Mirrors Sam's live week: a Wednesday Easy Aerobic Flush (rower-tagged).
  const monLower = wk('Lower Body Strength', 1, [ex('Trap Bar Deadlift')]);
  const wedFlush = wk('Easy Aerobic Flush (20min Rower)', 3, [
    ex('Easy Aerobic Flush (20min Rower)'),
  ]);
  const friPull = wk('Upper Pull', 5, [ex('Pull-Up')]);
  const days: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(FIXED_MONDAY, i);
    const dow = isoToDow(date);
    let w: any = null;
    if (dow === 1) w = monLower;
    else if (dow === 3) w = wedFlush;
    else if (dow === 5) w = friPull;
    days.push(buildResolvedDay(date, w));
  }
  return days;
}
function entry(
  date: string,
  sessionName: string,
  modalities: string[] = [],
  ageMs = 0,
): CoachContextEntry {
  return {
    date,
    sessionName,
    updatedAt: NOW - ageMs,
    source: 'coach_explanation',
    modalities,
  };
}

// ─── Turn 1 — explanation establishes lastExplainedSession ─────────
section('[Turn 1] "Why is there a mid week row" → conversation, sets lastExplained');
{
  const turn1Message = 'Why is there a mid week row';
  const res1 = resolveCoachReference({
    userMessage: turn1Message,
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: null,
    lastExplainedSession: null,
    lastDiscussedWorkout: null,
    now: NOW,
  });
  const cmd1 = routeCoachCommand({
    userMessage: turn1Message,
    todayISO: FIXED_TODAY,
    referenceResolution: res1,
  } as RouteCoachCommandInput);
  ok(
    'T1.1 routes to conversation/explain (NOT mutate)',
    cmd1.mode === 'conversation' || cmd1.mode === 'explain',
    `got mode=${cmd1.mode}`,
  );
  ok(
    'T1.2 turn 1 NOT a mutate command (no legacy mutation)',
    !isMutateCommand(cmd1),
  );
}

// ─── Turn 2 — "Can you change to a bike" with fresh lastExplained ──
section('[Turn 2] "Can you change to a bike" → mutate (or clarify), never legacy mutation');
{
  // Coach just explained Wednesday Easy Aerobic Flush rower (turn 1).
  const lastExplained = entry('2026-05-06', 'Easy Aerobic Flush (20min Rower)', ['rower']);
  const turn2Message = 'Can you change to a bike';
  const res2 = resolveCoachReference({
    userMessage: turn2Message,
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: null,
    lastExplainedSession: lastExplained,
    lastDiscussedWorkout: lastExplained,
    now: NOW,
  });
  ok(
    'T2.1 resolver binds via implicit_recent_context',
    res2.status === 'resolved' && res2.target?.method === 'implicit_recent_context',
    `got status=${res2.status}, method=${res2.target?.method}`,
  );
  ok(
    'T2.2 resolved date matches the explained Wednesday',
    res2.target?.date === '2026-05-06',
  );

  const cmd2 = routeCoachCommand({
    userMessage: turn2Message,
    todayISO: FIXED_TODAY,
    referenceResolution: res2,
  } as RouteCoachCommandInput);
  ok(
    'T2.3 router emits mutate (or clarify) — NEVER conversation',
    cmd2.mode === 'mutate' || cmd2.mode === 'clarify',
    `got mode=${cmd2.mode}`,
  );
  if (cmd2.mode === 'mutate') {
    ok(
      'T2.4a mutate operation is a swap (one_off or recurring), never set_preferred_alternative',
      cmd2.operation === 'swap_conditioning_modality_once'
        || cmd2.operation === 'set_conditioning_modality_preference',
      `got operation=${cmd2.operation}`,
    );
    ok(
      'T2.5a target.date is in the visible week (no historical drift)',
      cmd2.target.kind === 'date' && cmd2.target.date.startsWith('2026-05-'),
    );
  }
}

// ─── Turn 3 — bike subtype correction (Sam's exact live message) ───
section('[Turn 3] "You changed to an assault bike, i want a normal bike" → set_bike_subtype_preference');
{
  const turn3Message = 'You changed to an assault bike, i want a normal bike';

  // Bike-intent parser must produce desiredLabel='standard' deterministically.
  const intent = parseBikeSubtypeIntent(turn3Message);
  ok('T3.1 parseBikeSubtypeIntent.desiredLabel === "standard"',
    intent.desiredLabel === 'standard',
    `got ${intent.desiredLabel} (source=${intent.source})`);
  ok('T3.2 intent source is positive_regular (NOT bare token, NOT complaint)',
    intent.source === 'positive_regular',
    `got source=${intent.source}`);

  // Two same-canonical-family contexts on different dates — exactly the
  // shape that triggered the live ambiguity. The Phase-G family-collapse
  // path must pick the future-most context with method
  // implicit_recent_session_family.
  const may06 = entry('2026-05-06', 'Easy Aerobic Flush', ['rower']);
  const may13 = {
    ...entry('2026-05-13', 'Easy Aerobic Flush (20min Rower)', ['rower']),
    source: 'day_workout' as const,
  };
  const res3 = resolveCoachReference({
    userMessage: turn3Message,
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: may13,
    lastExplainedSession: may06,
    lastDiscussedWorkout: may13,
    now: NOW,
  });
  ok('T3.3 resolver collapses same canonical family → resolved (not ambiguous)',
    res3.status === 'resolved',
    `got status=${res3.status}`);
  ok('T3.4 method = implicit_recent_session_family',
    res3.target?.method === 'implicit_recent_session_family',
    `got method=${res3.target?.method}`);
  ok('T3.5 picks future-most date (2026-05-13)',
    res3.target?.date === '2026-05-13');

  const cmd3 = routeCoachCommand({
    userMessage: turn3Message,
    todayISO: FIXED_TODAY,
    referenceResolution: res3,
  } as RouteCoachCommandInput);
  ok('T3.6 router emits mutate (NEVER conversation, NEVER clarify on resolved family)',
    cmd3.mode === 'mutate',
    `got mode=${cmd3.mode}`);
  if (cmd3.mode === 'mutate') {
    eq('T3.7 operation = set_bike_subtype_preference',
      cmd3.operation, 'set_bike_subtype_preference');
    ok('T3.8 payload bikeLabel = "standard"',
      (cmd3.payload as any).bikeLabel === 'standard',
      `got bikeLabel=${(cmd3.payload as any).bikeLabel}`);
    ok('T3.9 needsClarification = false (target was resolved)',
      cmd3.needsClarification === false);
    ok('T3.10 target is the resolved Easy Aerobic Flush family',
      cmd3.target.kind === 'date' && cmd3.target.date === '2026-05-13');
  }
}

// ─── Turn 3 (fallback) — clarifier path when no recent context ─────
section('[Turn 3-fallback] no recent context → clarifier captured, NOT legacy fallthrough');
{
  // Same message but with NO lastExplained / lastDiscussed — resolver
  // can't bind a target. Router emits set_bike_subtype_preference with
  // needsClarification=true. Capture must stash it (Phase G Fix A).
  const turn3Message = 'You changed to an assault bike, i want a normal bike';
  const resBlank = resolveCoachReference({
    userMessage: turn3Message,
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: null,
    lastExplainedSession: null,
    lastDiscussedWorkout: null,
    now: NOW,
  });
  const cmd3b = routeCoachCommand({
    userMessage: turn3Message,
    todayISO: FIXED_TODAY,
    referenceResolution: resBlank,
  } as RouteCoachCommandInput);
  ok('T3F.1 router emits mutate even without target (capture-or-die path)',
    cmd3b.mode === 'mutate',
    `got mode=${cmd3b.mode}`);
  if (cmd3b.mode === 'mutate') {
    eq('T3F.2 operation = set_bike_subtype_preference',
      cmd3b.operation, 'set_bike_subtype_preference');
    ok('T3F.3 needsClarification = true (no target)',
      cmd3b.needsClarification === true);
    ok('T3F.4 payload bikeLabel preserved through to clarify',
      (cmd3b.payload as any).bikeLabel === 'standard');

    const captured = captureFromExecutorClarify({
      routedCommand: cmd3b,
      askedQuestion: cmd3b.clarificationQuestion ?? 'Which session?',
      originalMessage: turn3Message,
    });
    ok('T3F.5 capture stashes pending clarifier (Phase G Fix A)',
      captured != null);
    ok('T3F.6 captured.operation = set_bike_subtype_preference',
      captured?.operation === 'set_bike_subtype_preference');
    ok('T3F.7 captured.partialPayload.bikeLabel = "standard"',
      (captured?.partialPayload as any)?.bikeLabel === 'standard');
  }
}

// ─── Turn 4 — "Wednesday" resumes the pending command ──────────────
section('[Turn 4] "Wednesday" → resume from pending, never legacy, never set_preferred_alternative');
{
  // Stash exactly what turn 3-fallback captured, then resume on "Wednesday".
  const turn3Message = 'You changed to an assault bike, i want a normal bike';
  const resBlank = resolveCoachReference({
    userMessage: turn3Message,
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: null,
    lastExplainedSession: null,
    lastDiscussedWorkout: null,
    now: NOW,
  });
  const cmd3b = routeCoachCommand({
    userMessage: turn3Message,
    todayISO: FIXED_TODAY,
    referenceResolution: resBlank,
  } as RouteCoachCommandInput);
  if (cmd3b.mode !== 'mutate') {
    ok('T4 precondition: turn 3 fallback emitted mutate', false,
      `instead got mode=${cmd3b.mode}`);
  } else {
    const captured = captureFromExecutorClarify({
      routedCommand: cmd3b,
      askedQuestion: cmd3b.clarificationQuestion ?? 'Which session?',
      originalMessage: turn3Message,
    });

    // Athlete answers "Wednesday".
    const turn4Message = 'Wednesday';
    const res4 = resolveCoachReference({
      userMessage: turn4Message,
      todayISO: FIXED_TODAY,
      currentWeek: buildSampleCurrentWeek(),
      lastOpenedWorkout: null,
      lastExplainedSession: null,
      lastDiscussedWorkout: null,
      now: NOW,
    });
    ok('T4.1 "Wednesday" resolves to the visible-week Wednesday',
      res4.status === 'resolved' && res4.target?.date === '2026-05-06',
      `got status=${res4.status}, target=${JSON.stringify(res4.target)}`);

    const resumed = resumeFromPending({
      pending: { ...captured!, createdAt: NOW },
      newMessage: turn4Message,
      newResolution: res4,
    });
    ok('T4.2 resumeFromPending returned a command (NOT null)',
      resumed != null);
    ok('T4.3 resumed.mode = "mutate" — legacy path is hard-blocked',
      resumed?.mode === 'mutate');
    if (resumed?.mode === 'mutate') {
      eq('T4.4 resumed.operation = set_bike_subtype_preference',
        resumed.operation, 'set_bike_subtype_preference');
      ok('T4.5 resumed payload bikeLabel="standard" (preserved through resume)',
        (resumed.payload as any).bikeLabel === 'standard');
      ok('T4.6 resumed needsClarification = false',
        resumed.needsClarification === false);
      ok('T4.7 resumed target.date is in 2026-05-* (not historical 2025-*)',
        resumed.target.kind === 'date'
        && resumed.target.date.startsWith('2026-05-'));
      ok('T4.8 isMutateCommand(resumed) = true',
        isMutateCommand(resumed));
    }
  }
}

// ─── Turn 4 — bare "Yes" reply must NEVER permit legacy structural action
section('[Turn 4-yes] bare "Yes" reply on pending — legacy filter strips set_preferred_alternative');
{
  // The exact live failure: legacy /coach-chat returned
  //   set_preferred_alternative(permanent_preference)
  // for a "Yes" reply. The legacy action filter must block it even if
  // the legacy path were hit. Belt-and-suspenders proof.
  const hallucinated = [
    {
      kind: 'set_preferred_alternative',
      scope: 'permanent_preference',
      payload: { exerciseName: 'Easy Aerobic Flush', alternative: 'standard bike' },
    },
  ];
  const filtered = filterLegacyCoachActions(hallucinated as any);
  eq('T4Y.1 hallucinated set_preferred_alternative kept count = 0',
    filtered.kept.length, 0);
  eq('T4Y.2 blocked count = 1', filtered.blocked.length, 1);
  ok('T4Y.3 block reason = permanent_pref_blocked',
    filtered.blocked[0]?.reason === 'permanent_pref_blocked',
    `got reason=${filtered.blocked[0]?.reason}`);
}

// ─── End-to-end assertion: no path through the live trace can result
// ─── in a legacy structural action being applied ───────────────────
section('[End-to-end] every action a turn-3+turn-4 sequence could produce is router-controlled');
{
  // The combined assertion: across all tested branches above, every
  // command that emerged was either (a) a typed CoachCommand from the
  // router or (b) a legacy action that the legacy filter strips. There
  // is no surviving permanent_preference structural action.
  const possibleLegacyOutputs = [
    { kind: 'replace_exercise', scope: 'permanent_preference', payload: {} },
    { kind: 'set_preferred_alternative', scope: 'permanent_preference', payload: {} },
    { kind: 'ban_exercise_globally', scope: 'permanent_preference', payload: {} },
    { kind: 'move_session', scope: 'weekly_adjustment', payload: {} },
    { kind: 'lighten_session', scope: 'local_adjustment', payload: {} },
  ];
  const r = filterLegacyCoachActions(possibleLegacyOutputs as any);
  eq('E2E.1 zero legacy structural/preference actions survive the filter',
    r.kept.length, 0);
  eq('E2E.2 all hallucinations are explicitly blocked',
    r.blocked.length, possibleLegacyOutputs.length);
}

// ─── Summary ───────────────────────────────────────────────────────

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
