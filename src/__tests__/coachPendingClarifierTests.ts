/**
 * coachPendingClarifierTests — architectural assertions for the
 * two-turn modality swap fix.
 *
 * Covers the exact bug Sam reported: live app asked "Which session
 * should I switch?" then routed "The Wednesday one" through legacy
 * /coach-chat which hallucinated a `replace_exercise(local_adjustment)`
 * targeting 2025-11-19. The router/executor stack now:
 *
 *   1. Implicit recent-target resolution — mutation-like turn with no
 *      explicit cue but a single fresh discussed session binds via
 *      method='implicit_recent_context'.
 *   2. Pending clarifier handoff — mutate+clarify executor result is
 *      stashed; next turn that resolves a target resumes the command.
 *   3. Cancel verbs clear pending without applying.
 *   4. Expired pending clears (TTL 10min).
 *   5. Legacy structural actions are filtered out before being applied.
 *   6. resumeFromPending returns null when the new message can't bind
 *      a target.
 *   7. Successful mutation supersedes any outstanding clarifier.
 *   8. Capture is operation-scoped — permanent-pref ops never stash.
 *
 * Run: sucrase-node src/__tests__/coachPendingClarifierTests.ts
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
} from '../utils/coachCommandRouter';
import {
  captureFromExecutorClarify,
  resumeFromPending,
} from '../utils/coachClarifierResume';
import {
  usePendingCoachClarifierStore,
  getPendingClarifierSnapshot,
  isCancelClarifierMessage,
  PENDING_CLARIFIER_TTL_MS,
} from '../store/pendingCoachClarifierStore';
import { filterLegacyCoachActions } from '../utils/legacyCoachActionFilter';
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

const FIXED_TODAY = '2026-04-29'; // Wednesday
const FIXED_MONDAY = '2026-04-27';
const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const NOW = 1714316400000; // arbitrary fixed clock

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
  const monLower = wk('Lower Body Strength', 1, [ex('Trap Bar Deadlift')]);
  const wedRow = wk('Easy Aerobic Flush', 3, [ex('Rower')]);
  const friPull = wk('Upper Pull', 5, [ex('Pull-Up')]);
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

// ─── 1. Implicit recent-target resolution ──────────────────────────
section('[1] implicit recent-target — "Can you change to a bike?" after row explanation');
{
  // Coach just explained Wednesday Easy Aerobic Flush rower.
  const lastExplained = entry('2026-04-29', 'Easy Aerobic Flush', ['rower']);
  const res: CoachReferenceResolution = resolveCoachReference({
    userMessage: 'Can you change to a bike?',
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: null,
    lastExplainedSession: lastExplained,
    lastDiscussedWorkout: lastExplained,
    now: NOW,
  });
  ok('1.1 status resolved', res.status === 'resolved');
  ok('1.2 target.date = 2026-04-29', res.target?.date === '2026-04-29');
  ok('1.3 method = implicit_recent_context', res.target?.method === 'implicit_recent_context');
  ok('1.4 isMutationLike true', res.isMutationLike === true);
  ok('1.5 confidence ≤ 0.7', (res.confidence ?? 1) <= 0.7);
}

// ─── 2. Pending clarification resumes command ──────────────────────
section('[2] pending clarification resumes command on next turn');
{
  // The router emitted mutate+clarify for "Can you change to a bike?"
  // (no resolved target — pretend the resolver lost continuity here).
  const partialCommand: CoachCommand = {
    mode: 'mutate',
    operation: 'swap_conditioning_modality_once',
    target: { kind: 'unbound' },
    payload: {
      operation: 'swap_conditioning_modality_once',
      from: 'rower',
      to: 'bike',
      bikeLabel: null,
    },
    scope: 'one_off',
    confidence: 0.6,
    needsClarification: true,
    clarificationQuestion: 'Which session should I switch?',
    missingFields: ['target_session'],
    reason: 'modality_swap_no_target',
  };
  const captured = captureFromExecutorClarify({
    routedCommand: partialCommand,
    askedQuestion: 'Which session should I switch?',
    originalMessage: 'Can you change to a bike?',
  });
  ok('2.1 capture returns entry', !!captured);
  eq('2.2 captured operation', captured?.operation, 'swap_conditioning_modality_once');
  eq('2.3 captured scope', captured?.scope, 'one_off');
  eq('2.4 captured missingFields', captured?.missingFields, ['target_session']);

  // User then says "The Wednesday one" — resolve to Wednesday session.
  const newRes = resolveCoachReference({
    userMessage: 'The Wednesday one',
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: null,
    lastExplainedSession: null,
    lastDiscussedWorkout: null,
    now: NOW,
  });
  ok('2.5 new message resolves Wednesday',
    newRes.status === 'resolved' && newRes.target?.date === '2026-04-29');

  const resumed = resumeFromPending({
    pending: { ...captured!, createdAt: NOW },
    newMessage: 'The Wednesday one',
    newResolution: newRes,
  });
  ok('2.6 resumed != null', !!resumed);
  ok('2.7 resumed.mode = mutate', resumed?.mode === 'mutate');
  ok('2.8 resumed.needsClarification = false',
    resumed?.mode === 'mutate' && resumed.needsClarification === false);
  ok('2.9 resumed.target.kind = date',
    resumed?.mode === 'mutate' && resumed.target.kind === 'date');
  ok('2.10 resumed payload preserved (rower→bike)',
    resumed?.mode === 'mutate' &&
    resumed.payload.operation === 'swap_conditioning_modality_once' &&
    (resumed.payload as any).from === 'rower' &&
    (resumed.payload as any).to === 'bike');
}

// ─── 2b. Pending add-activity answer uses the main activity compiler ──
section('[2b] pending add-activity answer preserves exact activity slots');
{
  const fridayRes: CoachReferenceResolution = {
    status: 'resolved',
    target: {
      date: '2026-05-01',
      sessionName: 'Upper Pull',
      method: 'explicit_day',
    },
    confidence: 0.95,
    clarifierQuestion: '',
    isMutationLike: true,
  };
  const clarifyCommand = routeCoachCommand({
    userMessage: "Can you add something to Friday's session?",
    todayISO: FIXED_TODAY,
    referenceResolution: fridayRes,
  });
  ok('2b.1 add-something asks for activity',
    clarifyCommand.mode === 'clarify' &&
    clarifyCommand.reason === 'add_conditioning_missing_activity');
  const captured = captureFromExecutorClarify({
    routedCommand: clarifyCommand,
    askedQuestion: clarifyCommand.mode === 'clarify' ? clarifyCommand.question : '',
    originalMessage: "Can you add something to Friday's session?",
    referenceResolution: fridayRes,
  });
  ok('2b.2 add-activity clarifier captured',
    !!captured && captured.operation === 'add_conditioning');

  const resumed = resumeFromPending({
    pending: { ...captured!, createdAt: NOW },
    newMessage: 'assault bike sprints please',
    newResolution: null,
  });
  ok('2b.3 answer resumes without a fresh target',
    resumed?.mode === 'mutate');
  ok('2b.4 answer keeps assault-bike sprint slots',
    resumed?.mode === 'mutate' &&
    resumed.operation === 'add_conditioning' &&
    (resumed.payload as any).customActivity === 'Assault Bike Sprints' &&
    (resumed.payload as any).modality === 'bike' &&
    (resumed.payload as any).bikeLabel === 'assault' &&
    (resumed.payload as any).effortKind === 'sprint',
    JSON.stringify(resumed?.mode === 'mutate' ? resumed.payload : null));
}

// ─── 2c. Pending duration question accepts scalar answer ───────────
section('[2c] pending duration clarifier resumes from "1 hour"');
{
  const durationCommand: CoachCommand = {
    mode: 'mutate',
    operation: 'add_conditioning',
    target: { kind: 'date', date: '2026-04-29', sessionName: 'Easy Aerobic Flush' },
    payload: {
      operation: 'add_conditioning',
      modality: 'bike',
      customActivity: 'Easy Aerobic Flush (25min Assault Bike)',
      intensity: 'light',
      durationMinutes: 25,
      bikeLabel: 'assault',
      replaceActivity: 'Easy Aerobic Flush (25min Assault Bike)',
    },
    scope: 'one_off',
    confidence: 0.82,
    needsClarification: true,
    clarificationQuestion: 'How much longer would you like the Wednesday Easy Aerobic Flush to be?',
    missingFields: ['durationMinutes'],
    reason: 'llm_command_adapter:duration_missing',
  };
  const captured = captureFromExecutorClarify({
    routedCommand: durationCommand,
    askedQuestion: durationCommand.clarificationQuestion!,
    originalMessage: 'Can you make it a longer session?',
    missingFields: durationCommand.missingFields,
  });
  ok('2c.1 duration clarifier captured target date',
    !!captured && captured.targetDate === '2026-04-29');

  const resumed = resumeFromPending({
    pending: { ...captured!, createdAt: NOW },
    newMessage: '1 hour',
    newResolution: null,
  });
  ok('2c.2 scalar duration answer resumes without fresh resolver target',
    resumed?.mode === 'mutate');
  ok('2c.3 scalar answer becomes 60 minute deterministic edit',
    resumed?.mode === 'mutate' &&
    resumed.operation === 'add_conditioning' &&
    resumed.target.kind === 'date' &&
    resumed.target.date === '2026-04-29' &&
    (resumed.payload as any).customActivity === 'Easy Aerobic Flush (60min Assault Bike)' &&
    (resumed.payload as any).replaceActivity === 'Easy Aerobic Flush (25min Assault Bike)' &&
    (resumed.payload as any).bikeLabel === 'assault' &&
    (resumed.payload as any).durationMinutes === 60 &&
    resumed.reason === 'pending_duration_answer',
    JSON.stringify(resumed?.mode === 'mutate' ? resumed : null));

  const tooAmbiguous = resumeFromPending({
    pending: { ...captured!, createdAt: NOW },
    newMessage: '1',
    newResolution: null,
  });
  ok('2c.4 bare "1" is not treated as one minute',
    tooAmbiguous === null);
}

// ─── 3. Pending clarification blocks legacy on next turn ──────────
section('[3] pending clarifier — resumed command is mutate, never legacy');
{
  // Resumed command must NOT be a conversation/explain command.
  const partialCommand: CoachCommand = {
    mode: 'mutate',
    operation: 'swap_conditioning_modality_once',
    target: { kind: 'unbound' },
    payload: {
      operation: 'swap_conditioning_modality_once',
      from: 'rower',
      to: 'bike',
      bikeLabel: null,
    },
    scope: 'one_off',
    confidence: 0.6,
    needsClarification: true,
    reason: 'modality_swap_no_target',
  };
  const captured = captureFromExecutorClarify({
    routedCommand: partialCommand,
    askedQuestion: 'Which session should I switch?',
    originalMessage: 'Can you change to a bike?',
  });
  const newRes = resolveCoachReference({
    userMessage: 'Wednesday',
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: null,
    lastExplainedSession: null,
    lastDiscussedWorkout: null,
    now: NOW,
  });
  const resumed = resumeFromPending({
    pending: { ...captured!, createdAt: NOW },
    newMessage: 'Wednesday',
    newResolution: newRes,
  });
  ok('3.1 resumed is a mutate command', resumed?.mode === 'mutate');
  ok('3.2 isMutateCommand(resumed) = true (legacy fallback hard-blocked)',
    !!resumed && isMutateCommand(resumed));
}

// ─── 4. Cancel verbs clear pending without resuming ────────────────
section('[4] "never mind" / "forget it" cancel verbs');
{
  ok('4.1 "never mind" detected', isCancelClarifierMessage('never mind'));
  ok('4.2 "nvm" detected', isCancelClarifierMessage('nvm'));
  ok('4.3 "forget it" detected', isCancelClarifierMessage('forget it'));
  ok('4.4 "cancel that" detected', isCancelClarifierMessage('cancel that'));
  ok('4.5 "the Wednesday one" NOT cancel', !isCancelClarifierMessage('The Wednesday one'));
  ok('4.6 "no" alone NOT cancel (yes/no answers protected)',
    !isCancelClarifierMessage('no'));
  ok('4.7 empty string NOT cancel', !isCancelClarifierMessage(''));
}

// ─── 5. Expired pending clears (TTL 10min) ─────────────────────────
section('[5] expired pending clears via TTL filter');
{
  const store = usePendingCoachClarifierStore.getState();
  // Set pending 11 minutes ago — older than TTL.
  store.setPending({
    operation: 'swap_conditioning_modality_once',
    partialPayload: {
      operation: 'swap_conditioning_modality_once',
      from: 'rower',
      to: 'bike',
      bikeLabel: null,
    },
    scope: 'one_off',
    missingFields: ['target_session'],
    originalMessage: 'change to bike',
    askedQuestion: 'Which session?',
    createdAt: NOW - (PENDING_CLARIFIER_TTL_MS + 60_000),
  });
  ok('5.1 stored entry exists',
    !!usePendingCoachClarifierStore.getState().pending);
  const snap = getPendingClarifierSnapshot(NOW);
  ok('5.2 snapshot returns null when older than TTL', snap === null);
  // Cleanup
  store.clearPending();

  // Fresh entry — within TTL.
  store.setPending({
    operation: 'swap_conditioning_modality_once',
    partialPayload: {
      operation: 'swap_conditioning_modality_once',
      from: 'rower',
      to: 'bike',
      bikeLabel: null,
    },
    scope: 'one_off',
    missingFields: ['target_session'],
    originalMessage: 'change to bike',
    askedQuestion: 'Which session?',
    createdAt: NOW - 60_000, // 1 minute ago
  });
  const fresh = getPendingClarifierSnapshot(NOW);
  ok('5.3 fresh entry returns from snapshot', !!fresh);
  store.clearPending();
}

// ─── 6. Legacy structural + permanent-pref actions all blocked ─────
// Phase G Fix C: permanent prefs (ban_exercise_globally,
// set_preferred_alternative) used to ride through legacy. Live bug:
// /coach-chat returned set_preferred_alternative for "Yes" replies.
// They are now blocked. Only `save_note` survives the legacy filter.
section('[6] legacy /coach-chat — every program-affecting action is blocked');
{
  // Hallucinated structural action — the original live bug.
  const structural = [
    { kind: 'replace_exercise', scope: 'local_adjustment', payload: { date: '2025-11-19' } },
    { kind: 'move_session', scope: 'weekly_adjustment', payload: { fromDate: '2025-01-01', toDate: '2025-01-02' } },
    { kind: 'lighten_session', scope: 'local_adjustment', payload: { date: '2025-12-25' } },
  ];
  const r1 = filterLegacyCoachActions(structural as any);
  eq('6.1 all 3 structural actions blocked', r1.kept.length, 0);
  eq('6.2 blocked count = 3', r1.blocked.length, 3);
  ok('6.3 every block reason = structural_action_blocked',
    r1.blocked.every((b) => b.reason === 'structural_action_blocked'));

  // Permanent prefs that USED to be allowed are now BLOCKED.
  const forbiddenPrefs = [
    { kind: 'ban_exercise_globally', scope: 'permanent_preference', payload: {} },
    { kind: 'set_preferred_alternative', scope: 'permanent_preference', payload: {} },
  ];
  const r2 = filterLegacyCoachActions(forbiddenPrefs as any);
  eq('6.4 ban_exercise_globally + set_preferred_alternative both blocked', r2.kept.length, 0);
  eq('6.5 prefs blocked count = 2', r2.blocked.length, 2);
  ok('6.6 every reason is permanent_pref_blocked',
    r2.blocked.every((b) => b.reason === 'permanent_pref_blocked'));

  // save_note is still allowed (coach-memory only, never structural).
  const noteOnly = [
    { kind: 'save_note', scope: 'permanent_preference', payload: { note: 'no rotators' } },
  ];
  const r3 = filterLegacyCoachActions(noteOnly as any);
  eq('6.7 save_note kept', r3.kept.length, 1);
  eq('6.8 save_note blocked count', r3.blocked.length, 0);

  // Mixed payload — only save_note survives.
  const mixed = [
    ...structural,
    ...forbiddenPrefs,
    { kind: 'save_note', scope: 'permanent_preference', payload: { note: 'a' } },
  ];
  const r4 = filterLegacyCoachActions(mixed as any);
  eq('6.9 mixed: only save_note survives',
    { kept: r4.kept.length, keptKind: r4.kept[0]?.kind, blocked: r4.blocked.length },
    { kept: 1, keptKind: 'save_note', blocked: 5 });

  // local_adjustment scope is forbidden regardless of action kind.
  const localAdjustmentOnNote = [
    { kind: 'save_note', scope: 'local_adjustment', payload: {} },
  ];
  const r5 = filterLegacyCoachActions(localAdjustmentOnNote as any);
  eq('6.10 save_note + local_adjustment scope is blocked', r5.kept.length, 0);
  eq('6.11 forbidden_scope_blocked reason emitted',
    r5.blocked[0]?.reason, 'forbidden_scope_blocked');

  // Empty / null inputs are safe.
  const r6 = filterLegacyCoachActions([]);
  eq('6.12 empty input → empty kept/blocked', { kept: r6.kept.length, blocked: r6.blocked.length },
    { kept: 0, blocked: 0 });
  const r7 = filterLegacyCoachActions(null);
  eq('6.13 null input → empty', { kept: r7.kept.length, blocked: r7.blocked.length },
    { kept: 0, blocked: 0 });
}

// ─── 7. No random historical action dates — Wednesday resolves
// ─── to the visible week, never to a 2025 date ─────────────────────
section('[7] resumed command cannot target dates outside the visible week');
{
  const partialCommand: CoachCommand = {
    mode: 'mutate',
    operation: 'swap_conditioning_modality_once',
    target: { kind: 'unbound' },
    payload: {
      operation: 'swap_conditioning_modality_once',
      from: 'rower',
      to: 'bike',
      bikeLabel: null,
    },
    scope: 'one_off',
    confidence: 0.6,
    needsClarification: true,
    reason: 'modality_swap_no_target',
  };
  const captured = captureFromExecutorClarify({
    routedCommand: partialCommand,
    askedQuestion: 'Which session should I switch?',
    originalMessage: 'Can you change to a bike?',
  });
  const newRes = resolveCoachReference({
    userMessage: 'The Wednesday one',
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: null,
    lastExplainedSession: null,
    lastDiscussedWorkout: null,
    now: NOW,
  });
  const resumed = resumeFromPending({
    pending: { ...captured!, createdAt: NOW },
    newMessage: 'The Wednesday one',
    newResolution: newRes,
  });
  ok('7.1 resumed target.date is in the visible week (no historical drift)',
    resumed?.mode === 'mutate' &&
    (resumed.target.kind === 'date' || resumed.target.kind === 'exercise') &&
    resumed.target.date.startsWith('2026-04-'));
  ok('7.2 resumed target.date is NOT 2025-anything',
    resumed?.mode === 'mutate' &&
    (resumed.target.kind === 'date' || resumed.target.kind === 'exercise') &&
    !resumed.target.date.startsWith('2025-'));

  // No-resolution path — new message can't bind a target → resume returns null.
  const blankRes = resolveCoachReference({
    userMessage: 'maybe later',
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: null,
    lastExplainedSession: null,
    lastDiscussedWorkout: null,
    now: NOW,
  });
  const noResume = resumeFromPending({
    pending: { ...captured!, createdAt: NOW },
    newMessage: 'maybe later',
    newResolution: blankRes,
  });
  ok('7.3 unresolvable answer → resume returns null', noResume === null);
}

// ─── 8. Capture is operation-scoped — every mutating op is resumable
// Phase G Fix A: permanent prefs are now resumable too. Live bug:
// router emitted set_bike_subtype_preference with needsClarification=true,
// but capture refused to stash it. Next user message ("Wednesday") fell
// through to legacy /coach-chat, which hallucinated structural actions.
section('[8] every mutate op with needsClarification=true is resumable');
{
  // Permanent modality preference — capture MUST stash so next answer
  // doesn't fall through to legacy.
  const prefCommand: CoachCommand = {
    mode: 'mutate',
    operation: 'set_conditioning_modality_preference',
    target: { kind: 'unbound' },
    payload: {
      operation: 'set_conditioning_modality_preference',
      from: null,
      to: 'bike',
      bikeLabel: null,
    },
    scope: 'permanent',
    confidence: 0.7,
    needsClarification: true,
    clarificationQuestion: 'Which session?',
    reason: 'pref_no_target',
  };
  const captured = captureFromExecutorClarify({
    routedCommand: prefCommand,
    askedQuestion: 'Which session?',
    originalMessage: 'I prefer the bike',
  });
  ok('8.1 permanent modality pref IS resumable',
    !!captured && captured.operation === 'set_conditioning_modality_preference');

  // set_bike_subtype_preference — same rule. Phase G Fix A.
  const bikeCommand: CoachCommand = {
    mode: 'mutate',
    operation: 'set_bike_subtype_preference',
    target: { kind: 'unbound' },
    payload: {
      operation: 'set_bike_subtype_preference',
      bikeLabel: 'standard',
    },
    scope: 'recurring',
    confidence: 0.6,
    needsClarification: true,
    clarificationQuestion: 'Which session should the bike change apply to?',
    reason: 'bike_subtype_correction',
  };
  const captured2 = captureFromExecutorClarify({
    routedCommand: bikeCommand,
    askedQuestion: 'Which session should the bike change apply to?',
    originalMessage: 'i want a normal bike not assault',
  });
  ok('8.2 bike subtype pref IS resumable (Phase G Fix A)',
    !!captured2 && captured2.operation === 'set_bike_subtype_preference');
  ok('8.3 captured payload preserved bikeLabel=standard',
    captured2 != null
    && (captured2.partialPayload as any).bikeLabel === 'standard');

  // Modality SWAP (one-off) IS resumable — sanity check.
  const swapCommand: CoachCommand = {
    mode: 'mutate',
    operation: 'swap_conditioning_modality_once',
    target: { kind: 'unbound' },
    payload: {
      operation: 'swap_conditioning_modality_once',
      from: null,
      to: 'bike',
      bikeLabel: null,
    },
    scope: 'one_off',
    confidence: 0.7,
    needsClarification: true,
    reason: 'one_off_no_target',
  };
  const captured3 = captureFromExecutorClarify({
    routedCommand: swapCommand,
    askedQuestion: 'Which session?',
    originalMessage: 'change to bike just this week',
  });
  ok('8.4 one-off modality swap IS resumable',
    !!captured3 && captured3.operation === 'swap_conditioning_modality_once');

  // Resume of a stashed bike subtype pref must yield a fully-formed
  // mutate command with bikeLabel preserved.
  const newRes = resolveCoachReference({
    userMessage: 'Wednesday',
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: null,
    lastExplainedSession: null,
    lastDiscussedWorkout: null,
    now: NOW,
  });
  const resumed = resumeFromPending({
    pending: { ...captured2!, createdAt: NOW },
    newMessage: 'Wednesday',
    newResolution: newRes,
  });
  ok('8.5 bike subtype pref resumes with target',
    resumed?.mode === 'mutate'
    && resumed.operation === 'set_bike_subtype_preference'
    && (resumed.payload as any).bikeLabel === 'standard');
  ok('8.6 resumed bike subtype pref needsClarification=false',
    resumed?.mode === 'mutate' && resumed.needsClarification === false);
}

// ─── 9. Implicit recent-context refuses ambiguity ──────────────────
section('[9] implicit recent-context refuses when multiple fresh contexts conflict');
{
  // lastOpened points to Monday, lastExplained points to Wednesday —
  // ambiguous. Implicit branch must NOT silently pick one.
  const wedExplained = entry('2026-04-29', 'Easy Aerobic Flush', ['rower']);
  const monOpened = {
    ...entry('2026-04-27', 'Lower Body Strength', []),
    source: 'day_workout' as const,
  };
  // Most-recent-pointer: lastDiscussedWorkout = whichever has the
  // larger updatedAt — they have the SAME timestamp here, so pick one.
  const res = resolveCoachReference({
    userMessage: 'Can you change to a bike?',
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: monOpened,
    lastExplainedSession: wedExplained,
    lastDiscussedWorkout: wedExplained, // assume Wed is most recent
    now: NOW,
  });
  ok('9.1 ambiguous fresh contexts → status=ambiguous',
    res.status === 'ambiguous',
    `got status=${res.status}, target=${JSON.stringify(res.target)}`);
}

// ─── 10. Phase G Fix B — same canonical session-family collapse ────
// Live bug: lastExplainedSession on 2026-05-06 (Easy Aerobic Flush) and
// lastOpenedWorkout on 2026-05-13 (Easy Aerobic Flush). Different dates,
// same canonical session-family. Resolver USED to call this ambiguous
// and force a clarifier. Now it picks the future-most date with method
// = implicit_recent_session_family.
section('[10] resolver collapses same canonical session-family');
{
  // Same canonical name on two different dates → collapse, future-most wins.
  const may06 = entry('2026-05-06', 'Easy Aerobic Flush', ['rower']);
  const may13 = {
    ...entry('2026-05-13', 'Easy Aerobic Flush (20min Rower)', ['rower']),
    source: 'day_workout' as const,
  };
  const futureToday = '2026-05-10';
  const res = resolveCoachReference({
    userMessage: 'You changed to an assault bike I want a normal bike',
    todayISO: futureToday,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: may13,
    lastExplainedSession: may06,
    lastDiscussedWorkout: may13,
    now: NOW,
  });
  ok('10.1 same canonical family → resolved (not ambiguous)',
    res.status === 'resolved',
    `got status=${res.status}`);
  ok('10.2 method = implicit_recent_session_family',
    res.target?.method === 'implicit_recent_session_family');
  ok('10.3 picks future-most date (2026-05-13)',
    res.target?.date === '2026-05-13');
  ok('10.4 isMutationLike still true',
    res.isMutationLike === true);

  // Different canonical names → still ambiguous. (Use a message with no
  // pronoun/day/modality cue so the resolver hits the implicit-recent-
  // context branch where the family-collapse decision is made.)
  const monLower2 = {
    ...entry('2026-04-27', 'Lower Body Strength', []),
    source: 'day_workout' as const,
  };
  const wedRow2 = entry('2026-04-29', 'Easy Aerobic Flush', ['rower']);
  const res2 = resolveCoachReference({
    userMessage: 'switch to a bike',
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: monLower2,
    lastExplainedSession: wedRow2,
    lastDiscussedWorkout: wedRow2,
    now: NOW,
  });
  ok('10.5 different canonical names → ambiguous (no false collapse)',
    res2.status === 'ambiguous',
    `got status=${res2.status}, target=${JSON.stringify(res2.target)}`);

  // Family collapse handles parenthetical dosage suffix. Use a message
  // free of "the bike" so we don't tip into modality-match.
  const may20 = entry('2026-05-20', 'Easy Aerobic Flush', ['rower']);
  const may27 = {
    ...entry('2026-05-27', 'Easy Aerobic Flush (25min Rower)', ['rower']),
    source: 'day_workout' as const,
  };
  const res3 = resolveCoachReference({
    userMessage: 'switch to a standard bike',
    todayISO: '2026-05-25',
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: may27,
    lastExplainedSession: may20,
    lastDiscussedWorkout: may27,
    now: NOW,
  });
  ok('10.6 family collapse handles parenthetical dosage suffix',
    res3.status === 'resolved'
    && res3.target?.method === 'implicit_recent_session_family',
    `got status=${res3.status}, method=${res3.target?.method}`);
}

// ─── 11. Phase G Fix D — bare yes/no never falls through to legacy ─
section('[11] pending clarifier — bare yes/no replies are protected');
{
  // Phase G Fix D: when a clarifier is pending, bare "Yes"/"No" replies
  // must never be classified as conversation (which would call legacy).
  // The detectors here gate that behavior in CoachScreen.
  // (Importing the helpers directly to assert the contract.)
  const {
    isAffirmativeClarifierMessage,
    isNegativeClarifierMessage,
  } = require('../store/pendingCoachClarifierStore');

  ok('11.1 "Yes" detected affirmative', isAffirmativeClarifierMessage('Yes'));
  ok('11.2 "yeah" detected affirmative', isAffirmativeClarifierMessage('yeah'));
  ok('11.3 "yep" detected affirmative', isAffirmativeClarifierMessage('yep'));
  ok('11.4 "sure" detected affirmative', isAffirmativeClarifierMessage('sure'));
  ok('11.5 "ok." detected affirmative', isAffirmativeClarifierMessage('ok.'));
  ok('11.6 "no" detected negative', isNegativeClarifierMessage('no'));
  ok('11.7 "nope" detected negative', isNegativeClarifierMessage('nope'));
  ok('11.8 "nah" detected negative', isNegativeClarifierMessage('nah'));

  // Bare-only — phrases with concrete content must NOT match
  // (they need to flow through the resolver normally).
  ok('11.9 "yes please change wednesday" is NOT bare affirmative',
    !isAffirmativeClarifierMessage('yes please change wednesday'));
  ok('11.10 "the wednesday one" is NOT affirmative',
    !isAffirmativeClarifierMessage('the wednesday one'));
  ok('11.11 "no thanks make it monday" is NOT bare negative',
    !isNegativeClarifierMessage('no thanks make it monday'));

  // Affirmative and negative are mutually exclusive.
  ok('11.12 "Yes" is NOT negative',
    !isNegativeClarifierMessage('Yes'));
  ok('11.13 "no" is NOT affirmative',
    !isAffirmativeClarifierMessage('no'));
}

// ─── 12. Phase G end-to-end — bike subtype correction path ─────────
// Live bug from Sam's bug report:
//   1. User: "You changed to an assault bike I want a normal bike"
//   2. Resolver returned ambiguous → router emitted set_bike_subtype_preference
//      with needsClarification=true.
//   3. Capture refused (op excluded from RESUMABLE_OPS) → next reply fell
//      through to legacy → set_preferred_alternative hallucinated.
// Phase G Fix A + B: capture stashes the pending command; resolver collapses
// to single canonical-family target so the clarifier is rare; if the
// clarifier IS asked, the next reply ("Wednesday") resumes the command.
section('[12] Phase G end-to-end — bike subtype correction never reaches legacy');
{
  // Resolver collapse: same canonical family on two dates → resolved,
  // no clarifier needed.
  const explainedRow = entry('2026-05-06', 'Easy Aerobic Flush', ['rower']);
  const openedRow = {
    ...entry('2026-05-13', 'Easy Aerobic Flush (20min Rower)', ['rower']),
    source: 'day_workout' as const,
  };
  const liveRes = resolveCoachReference({
    userMessage: 'You changed to an assault bike I want a normal bike',
    todayISO: '2026-05-10',
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: openedRow,
    lastExplainedSession: explainedRow,
    lastDiscussedWorkout: openedRow,
    now: NOW,
  });
  ok('12.1 live-bug resolver returns resolved (not ambiguous)',
    liveRes.status === 'resolved',
    `got status=${liveRes.status}`);

  // Even if router DID emit clarify, capture stashes it.
  const partial: CoachCommand = {
    mode: 'mutate',
    operation: 'set_bike_subtype_preference',
    target: { kind: 'unbound' },
    payload: {
      operation: 'set_bike_subtype_preference',
      bikeLabel: 'standard',
    },
    scope: 'recurring',
    confidence: 0.6,
    needsClarification: true,
    clarificationQuestion: 'Which session should the bike change apply to?',
    reason: 'bike_subtype_correction',
  };
  const stashed = captureFromExecutorClarify({
    routedCommand: partial,
    askedQuestion: 'Which session should the bike change apply to?',
    originalMessage: 'You changed to an assault bike I want a normal bike',
  });
  ok('12.2 bike subtype pref capture succeeds', stashed != null);

  // Next message "Wednesday" resumes — never legacy.
  const wedRes = resolveCoachReference({
    userMessage: 'Wednesday',
    todayISO: FIXED_TODAY,
    currentWeek: buildSampleCurrentWeek(),
    lastOpenedWorkout: null,
    lastExplainedSession: null,
    lastDiscussedWorkout: null,
    now: NOW,
  });
  const wedResume = resumeFromPending({
    pending: { ...stashed!, createdAt: NOW },
    newMessage: 'Wednesday',
    newResolution: wedRes,
  });
  ok('12.3 "Wednesday" resumes set_bike_subtype_preference',
    wedResume?.mode === 'mutate'
    && wedResume.operation === 'set_bike_subtype_preference');
  ok('12.4 resumed payload bikeLabel=standard preserved',
    wedResume?.mode === 'mutate'
    && (wedResume.payload as any).bikeLabel === 'standard');
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
