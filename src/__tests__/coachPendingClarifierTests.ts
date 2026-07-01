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
  resolvePendingProgramEditAnswer,
  type ProgramEdit,
} from '../utils/coachProgramEdit';
import {
  capturePendingDateClarificationFromProgramEditRejection,
  handleCoachTurn,
  type CoachTurnDebug,
  type CoachTurnMessage,
} from '../utils/coachTurnController';
import type {
  ProgramEditDraft,
  ProgramEditDraftAction,
  ProgramEditVerifierExpectation,
} from '../utils/coachProgramEditDraft';
import {
  SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
  type SemanticProgramEditDraftAdapter,
  type SemanticProgramEditDraftAdapterInput,
} from '../utils/semanticProgramEditDraft';
import type { ExecutionResult } from '../utils/coachCommandExecutor';
import {
  captureFromExecutorClarify,
  resumeFromPending,
  resolvePendingScheduleTransactionAnswer,
} from '../utils/coachClarifierResume';
import {
  usePendingCoachClarifierStore,
  getPendingClarifierSnapshot,
  isCancelClarifierMessage,
  classifyPendingClarificationAnswer,
  PENDING_CLARIFIER_TTL_MS,
} from '../store/pendingCoachClarifierStore';
import { filterLegacyCoachActions } from '../utils/legacyCoachActionFilter';
import { buildSmokeCoachBikeFlowProgram, buildSmokeWednesdayWorkout } from '../data/smokeCoachBikeFlowProgram';
import { useProgramStore } from '../store/programStore';
import type { ResolvedDay } from '../utils/sessionResolver';
import {
  useCoachContextStateStore,
  type CoachContextEntry,
} from '../store/coachContextStateStore';

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
  ok('4.4b "leave it" detected', isCancelClarifierMessage('leave it'));
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

// ─── 13. Move-scope clarification resolves before legacy ───────────
section('[13] move-scope pending answers resolve to typed commands');
{
  const partialMove: CoachCommand = {
    mode: 'mutate',
    operation: 'move_session',
    target: { kind: 'date', date: '2026-04-30', sessionName: 'Lower Squat' },
    payload: {
      operation: 'move_session',
      toDate: '2026-05-02',
      toDow: 6,
      moveScope: 'unknown',
    },
    scope: 'one_off',
    confidence: 0.85,
    needsClarification: true,
    clarificationQuestion: 'Do you want to move Thursday to Saturday just this week, or every week going forward?',
    options: ['Just this week', 'Every week going forward'],
    missingFields: ['target_scope'],
    reason: 'whole_day_move_detected',
  };
  const stashed = captureFromExecutorClarify({
    routedCommand: partialMove,
    askedQuestion: partialMove.clarificationQuestion!,
    originalMessage: 'move all of Thursday to Saturday',
    missingFields: ['target_scope'],
  });
  ok('13.1 move-scope clarifier captured', stashed != null);
  ok('13.2 pending preserves source date',
    stashed?.targetDate === '2026-04-30',
    JSON.stringify(stashed));
  ok('13.3 pending preserves options/scope metadata',
    stashed?.moveScope === 'unknown' &&
      (stashed.partialPayload as any).toDate === '2026-05-02' &&
      (stashed.partialPayload as any).toDow === 6);
  ok('13.3b pending stores a move_session_transaction',
    stashed?.scheduleTransaction?.kind === 'move_session_transaction' &&
      stashed.scheduleTransaction.sourceDate === '2026-04-30' &&
      stashed.scheduleTransaction.targetDate === '2026-05-02' &&
      stashed.scheduleTransaction.scope === 'unknown',
    JSON.stringify(stashed?.scheduleTransaction));

  const oneOff = resumeFromPending({
    pending: { ...stashed!, createdAt: NOW },
    newMessage: 'just this week',
    newResolution: null,
  });
  ok('13.4 "just this week" resumes one-off move_session',
    oneOff?.mode === 'mutate' &&
      oneOff.operation === 'move_session' &&
      oneOff.scope === 'one_off' &&
      oneOff.target.kind === 'date' &&
      oneOff.target.date === '2026-04-30' &&
      oneOff.payload.operation === 'move_session' &&
      oneOff.payload.toDate === '2026-05-02' &&
      oneOff.payload.moveScope === 'one_off');

  const recurring = resumeFromPending({
    pending: { ...stashed!, createdAt: NOW },
    newMessage: 'every week going forward',
    newResolution: null,
  });
  ok('13.5 "every week going forward" resumes setup update',
    recurring?.mode === 'mutate' &&
      recurring.operation === 'update_program_setup' &&
      recurring.scope === 'permanent' &&
      recurring.payload.operation === 'update_program_setup' &&
      recurring.payload.removeTrainingDays?.includes('Thursday') &&
      recurring.payload.addTrainingDays?.includes('Saturday') &&
      recurring.payload.rebuildRequired === true);

  const unclear = resumeFromPending({
    pending: { ...stashed!, createdAt: NOW },
    newMessage: 'yeah',
    newResolution: null,
  });
  ok('13.6 unclear move-scope answer does not resume to legacy-capable command',
    unclear === null);

  const transactionUnclear = resolvePendingScheduleTransactionAnswer({
    pending: { ...stashed!, createdAt: NOW },
    userMessage: 'yeah',
    todayISO: FIXED_TODAY,
  });
  ok('13.7 unclear transaction answer re-asks inside transaction',
    transactionUnclear.kind === 'clarify' &&
      /just this week|every week going forward/i.test(transactionUnclear.reply));

  const transactionDetails = resolvePendingScheduleTransactionAnswer({
    pending: { ...stashed!, createdAt: NOW },
    userMessage: 'Next Saturday = upper pull and zone 2 row',
    todayISO: FIXED_TODAY,
  });
  ok('13.8 session-detail answer stays inside existing move transaction',
    transactionDetails.kind === 'clarify' &&
      transactionDetails.transaction.kind === 'move_session_transaction' &&
      /just this week|every week going forward/i.test(transactionDetails.reply),
    transactionDetails.kind === 'clarify' ? transactionDetails.reply : JSON.stringify(transactionDetails));

  const pastSourceMove: CoachCommand = {
    mode: 'mutate',
    operation: 'move_session',
    target: { kind: 'date', date: '2026-04-25', sessionName: 'Saturday Session' },
    payload: {
      operation: 'move_session',
      fromDow: 6,
      toDate: '2026-04-30',
      toDow: 4,
      moveScope: 'unknown',
    },
    scope: 'one_off',
    confidence: 0.8,
    needsClarification: true,
    clarificationQuestion: "This week's Saturday has already passed. Do you mean next Saturday's session, or do you want to change future Saturdays going forward?",
    options: ["Next Saturday's session", 'Future Saturdays going forward'],
    missingFields: ['source_date'],
    reason: 'move_session_source_date_past',
  };
  const pastStashed = captureFromExecutorClarify({
    routedCommand: pastSourceMove,
    askedQuestion: pastSourceMove.clarificationQuestion!,
    originalMessage: 'move all of Saturday to Thursday',
    missingFields: ['source_date'],
  });
  ok('13.9 past source move captures transaction without executable source date',
    pastStashed?.scheduleTransaction?.kind === 'move_session_transaction' &&
      pastStashed.scheduleTransaction.sourceDate === undefined &&
      pastStashed.scheduleTransaction.sourceDay === 'Saturday');
  const nextSaturdayDetails = resolvePendingScheduleTransactionAnswer({
    pending: { ...pastStashed!, createdAt: NOW },
    userMessage: 'Next Saturday = upper pull and zone 2 row',
    todayISO: FIXED_TODAY,
  });
  ok('13.10 next Saturday details update transaction date/session, not row replacement',
    nextSaturdayDetails.kind === 'clarify' &&
      nextSaturdayDetails.transaction.kind === 'move_session_transaction' &&
      nextSaturdayDetails.transaction.sourceDate === '2026-05-02' &&
      nextSaturdayDetails.transaction.sourceSessionSnapshot?.summary === 'Upper Pull + Zone 2 Row' &&
      /Upper Pull \+ Zone 2 Row/i.test(nextSaturdayDetails.reply),
    nextSaturdayDetails.kind === 'clarify' ? nextSaturdayDetails.reply : JSON.stringify(nextSaturdayDetails));
  const futureSaturdays = resolvePendingScheduleTransactionAnswer({
    pending: { ...pastStashed!, createdAt: NOW },
    userMessage: 'Future Saturdays going forward',
    todayISO: FIXED_TODAY,
  });
  ok('13.11 future Saturdays answer becomes recurring setup transaction',
    futureSaturdays.kind === 'complete' &&
      futureSaturdays.command.mode === 'mutate' &&
      futureSaturdays.command.operation === 'update_program_setup' &&
      futureSaturdays.command.payload.operation === 'update_program_setup' &&
      futureSaturdays.command.payload.removeTrainingDays?.includes('Saturday') &&
      futureSaturdays.command.payload.addTrainingDays?.includes('Thursday'));

  const staleTarget = resolvePendingScheduleTransactionAnswer({
    pending: {
      ...pastStashed!,
      scheduleTransaction: {
        kind: 'move_session_transaction',
        originalUserMessage: 'move all of Saturday to Thursday',
        sourceDate: '2026-05-02',
        sourceDay: 'Saturday',
        sourceSessionSnapshot: {
          date: '2026-05-02',
          day: 'Saturday',
          summary: 'Upper Pull + Zone 2 Row',
        },
        targetDate: '2026-04-23',
        targetDay: 'Thursday',
        scope: 'unknown',
        missingFields: ['target_scope'],
        createdFromVisibleWeek: true,
        currentStep: 'resolve_scope',
      },
      createdAt: NOW,
    },
    userMessage: 'Next Thursday',
    todayISO: FIXED_TODAY,
  });
  ok('13.12 stale target date resolves inside move transaction',
    staleTarget.kind === 'clarify' &&
      staleTarget.transaction.kind === 'move_session_transaction' &&
      staleTarget.transaction.sourceDate === '2026-05-02' &&
      staleTarget.transaction.targetDate === '2026-04-30' &&
      /Upper Pull \+ Zone 2 Row/i.test(staleTarget.reply) &&
      /just this week|every week going forward/i.test(staleTarget.reply),
    staleTarget.kind === 'clarify' ? staleTarget.reply : JSON.stringify(staleTarget));

  const confirmationMove: CoachCommand = {
    mode: 'mutate',
    operation: 'move_session',
    target: { kind: 'date', date: '2026-06-13', sessionName: 'Upper Pull + Zone 2 Row' },
    payload: {
      operation: 'move_session',
      fromDow: 6,
      toDate: '2026-06-11',
      toDow: 4,
      moveScope: 'one_off',
    },
    scope: 'one_off',
    confidence: 0.85,
    needsClarification: true,
    clarificationQuestion: 'Do you want me to move the entire Saturday session to Thursday on 2026-06-11, replacing the current Rest day?',
    options: ['Yes', 'No'],
    missingFields: ['confirmation'],
    reason: 'move_session_confirmation',
  };
  const confirmationStashed = captureFromExecutorClarify({
    routedCommand: confirmationMove,
    askedQuestion: confirmationMove.clarificationQuestion!,
    originalMessage: 'Can you move all of Saturday to Thursday?',
    missingFields: ['confirmation'],
  });
  ok('13.13 confirmation capture stores confirm step',
    confirmationStashed?.scheduleTransaction?.kind === 'move_session_transaction' &&
      confirmationStashed.scheduleTransaction.currentStep === 'confirm' &&
      confirmationStashed.scheduleTransaction.missingFields.includes('confirmation'));
  for (const answer of ['Yes', 'Yep', 'Do it']) {
    const confirmed = resolvePendingScheduleTransactionAnswer({
      pending: { ...confirmationStashed!, createdAt: NOW },
      userMessage: answer,
      todayISO: '2026-06-06',
    });
    ok(`13.14 confirmation answer "${answer}" executes move transaction`,
      confirmed.kind === 'complete' &&
        confirmed.command.mode === 'mutate' &&
        confirmed.command.operation === 'move_session' &&
        confirmed.command.target.kind === 'date' &&
        confirmed.command.target.date === '2026-06-13' &&
        confirmed.command.payload.operation === 'move_session' &&
        confirmed.command.payload.toDate === '2026-06-11',
      confirmed.kind === 'complete' ? JSON.stringify(confirmed.command) : JSON.stringify(confirmed));
  }
  for (const answer of ['No', 'Cancel']) {
    const cancelled = resolvePendingScheduleTransactionAnswer({
      pending: { ...confirmationStashed!, createdAt: NOW },
      userMessage: answer,
      todayISO: '2026-06-06',
    });
    ok(`13.15 confirmation answer "${answer}" cancels without mutation`,
      cancelled.kind === 'cancelled' &&
        /left the plan unchanged/i.test(cancelled.reply),
      JSON.stringify(cancelled));
  }
  const repeatedDayDuringConfirmation = resolvePendingScheduleTransactionAnswer({
    pending: { ...confirmationStashed!, createdAt: NOW },
    userMessage: 'Saturday',
    todayISO: '2026-06-06',
  });
  ok('13.16 repeated day answer stays inside confirmation transaction',
    repeatedDayDuringConfirmation.kind === 'clarify' &&
      /Move Saturday's Upper Pull \+ Zone 2 Row to Thursday this week/i.test(repeatedDayDuringConfirmation.reply) &&
      !/Which Thursday/i.test(repeatedDayDuringConfirmation.reply),
    repeatedDayDuringConfirmation.kind === 'clarify'
      ? repeatedDayDuringConfirmation.reply
      : JSON.stringify(repeatedDayDuringConfirmation));
  const legacyShapeYes = resolvePendingScheduleTransactionAnswer({
    pending: {
      ...confirmationStashed!,
      scheduleTransaction: undefined,
      createdAt: NOW,
    },
    userMessage: 'Yes',
    todayISO: '2026-06-06',
  });
  ok('13.16b confirmation resolves before generic fallback even without stored transaction',
    legacyShapeYes.kind === 'complete' &&
      legacyShapeYes.command.mode === 'mutate' &&
      legacyShapeYes.command.operation === 'move_session',
    JSON.stringify(legacyShapeYes));

  const conflictMove: CoachCommand = {
    mode: 'mutate',
    operation: 'move_session',
    target: { kind: 'date', date: '2026-06-13', sessionName: 'Recovery Session' },
    payload: {
      operation: 'move_session',
      fromDow: 6,
      toDate: '2026-06-11',
      toDow: 4,
      moveScope: 'one_off',
    },
    scope: 'one_off',
    confidence: 0.85,
    needsClarification: true,
    clarificationQuestion: 'Thursday already has Lower Squat. Do you want to replace it, swap the two days, or cancel?',
    options: ['Replace Thursday', 'Swap the two days', 'Cancel'],
    missingFields: ['conflict_resolution'],
    reason: 'whole_day_move_target_conflict',
  };
  const conflictStashed = captureFromExecutorClarify({
    routedCommand: conflictMove,
    askedQuestion: conflictMove.clarificationQuestion!,
    originalMessage: 'Can you move all of Saturday to Thursday?',
    missingFields: ['conflict_resolution'],
  });
  const repeatedDayDuringConflict = resolvePendingScheduleTransactionAnswer({
    pending: { ...conflictStashed!, createdAt: NOW },
    userMessage: 'Saturday',
    todayISO: '2026-06-06',
  });
  ok('13.17 repeated day answer stays inside target-conflict transaction',
    repeatedDayDuringConflict.kind === 'clarify' &&
      /already has a session|replace it, swap the two days, or cancel/i.test(repeatedDayDuringConflict.reply) &&
      !/Which Thursday/i.test(repeatedDayDuringConflict.reply),
    repeatedDayDuringConflict.kind === 'clarify'
      ? repeatedDayDuringConflict.reply
      : JSON.stringify(repeatedDayDuringConflict));
  const swapConflict = resolvePendingScheduleTransactionAnswer({
    pending: { ...conflictStashed!, createdAt: NOW },
    userMessage: 'swap the two days',
    todayISO: '2026-06-06',
  });
  ok('13.18 target-conflict swap answer executes swap move',
    swapConflict.kind === 'complete' &&
      swapConflict.command.mode === 'mutate' &&
      swapConflict.command.operation === 'move_session' &&
      swapConflict.command.payload.operation === 'move_session' &&
      swapConflict.command.payload.swap === true,
    JSON.stringify(swapConflict));
  const replaceConflict = resolvePendingScheduleTransactionAnswer({
    pending: { ...conflictStashed!, createdAt: NOW },
    userMessage: 'replace Thursday',
    todayISO: '2026-06-06',
  });
  ok('13.19 target-conflict replace answer executes one-way move',
    replaceConflict.kind === 'complete' &&
      replaceConflict.command.mode === 'mutate' &&
      replaceConflict.command.operation === 'move_session' &&
      replaceConflict.command.payload.operation === 'move_session' &&
      replaceConflict.command.payload.swap !== true,
    JSON.stringify(replaceConflict));

  const legacyLoggedBadMove: CoachCommand = {
    mode: 'mutate',
    operation: 'move_session',
    target: { kind: 'date', date: '2026-06-04', sessionName: 'Recovery Session' },
    payload: {
      operation: 'move_session',
      toDate: '2026-06-04',
    },
    scope: 'this_week',
    confidence: 0.5,
    needsClarification: true,
    clarificationQuestion: 'Where do you want me to move "Recovery Session" to instead of Thu 2026-06-04?',
    missingFields: ['target_session'],
    reason: 'clarify_same_date:move_session',
  };
  const repairedBadMove = captureFromExecutorClarify({
    routedCommand: legacyLoggedBadMove,
    askedQuestion: legacyLoggedBadMove.clarificationQuestion!,
    originalMessage: 'Can you move all of Saturday to Thursday?',
    missingFields: ['target_session'],
  });
  ok('13.20 logged bad move capture does not keep target_session',
    repairedBadMove?.missingFields.includes('source_date') === true &&
      repairedBadMove.missingFields.includes('target_session') === false,
    JSON.stringify(repairedBadMove));
  ok('13.21 logged bad move capture preserves source/target weekdays',
    repairedBadMove?.scheduleTransaction?.kind === 'move_session_transaction' &&
      repairedBadMove.scheduleTransaction.sourceDay === 'Saturday' &&
      repairedBadMove.scheduleTransaction.targetDay === 'Thursday' &&
      (repairedBadMove.partialPayload as any).fromDow === 6 &&
      (repairedBadMove.partialPayload as any).toDow === 4,
    JSON.stringify(repairedBadMove));
  const repairedBadMoveFollowUp = resolvePendingScheduleTransactionAnswer({
    pending: { ...repairedBadMove!, createdAt: NOW },
    userMessage: 'Saturday',
    todayISO: '2026-06-06',
  });
  ok('13.22 logged bad move follow-up resolves source inside transaction',
    repairedBadMoveFollowUp.kind === 'clarify' &&
      repairedBadMoveFollowUp.transaction.kind === 'move_session_transaction' &&
      repairedBadMoveFollowUp.transaction.sourceDay === 'Saturday' &&
      repairedBadMoveFollowUp.transaction.targetDay === 'Thursday' &&
      !/Which Thursday/i.test(repairedBadMoveFollowUp.reply),
    repairedBadMoveFollowUp.kind === 'clarify'
      ? repairedBadMoveFollowUp.reply
      : JSON.stringify(repairedBadMoveFollowUp));
}

section('[14] add-to-date pending transaction accumulates target/type');
{
  const todayISO = '2026-06-07';
  const addTodayClarify: CoachCommand = {
    mode: 'clarify',
    question: 'What would you like to add: conditioning, strength, recovery, or a named session?',
    options: ['Conditioning', 'Strength', 'Recovery', 'Named session'],
    missingFields: ['add_type'],
    reason: 'add_conditioning_missing_target_and_activity',
  };
  const captured = captureFromExecutorClarify({
    routedCommand: addTodayClarify,
    askedQuestion: addTodayClarify.question,
    originalMessage: 'I want to put a workout on today',
    todayISO,
  });
  ok('14.1 add-to-date capture stores transaction',
    !!captured && captured.scheduleTransaction?.kind === 'add_to_date_transaction',
    JSON.stringify(captured));
  ok('14.2 add-to-date capture keeps today target',
    captured?.scheduleTransaction?.kind === 'add_to_date_transaction' &&
      captured.scheduleTransaction.targetDate === todayISO,
    JSON.stringify(captured?.scheduleTransaction));
  ok('14.3 add-to-date capture only needs add type once target is known',
    captured?.scheduleTransaction?.kind === 'add_to_date_transaction' &&
      captured.scheduleTransaction.missingFields.includes('add_type') &&
      !captured.scheduleTransaction.missingFields.includes('target_date'),
    JSON.stringify(captured?.scheduleTransaction));
  ok('14.3b add-to-date capture marks one-off extra, not setup change',
    captured?.scheduleTransaction?.kind === 'add_to_date_transaction' &&
      captured.scheduleTransaction.overrideType === 'one_off_extra' &&
      captured.scheduleTransaction.setupChange === false,
    JSON.stringify(captured?.scheduleTransaction));

  const conditioningAnswer = resolvePendingScheduleTransactionAnswer({
    pending: { ...captured!, createdAt: NOW },
    userMessage: 'conditioning',
    todayISO,
    currentWeek: [{ date: todayISO, sessionName: 'Rest', workout: null }],
  });
  ok('14.4 "conditioning" completes pending add-to-date transaction',
    conditioningAnswer.kind === 'complete' &&
      conditioningAnswer.command.mode === 'mutate' &&
      conditioningAnswer.command.operation === 'add_conditioning' &&
      conditioningAnswer.command.target.kind === 'date' &&
      conditioningAnswer.command.target.date === todayISO &&
      conditioningAnswer.command.payload.operation === 'add_conditioning' &&
      conditioningAnswer.command.payload.overrideType === 'one_off_extra' &&
      conditioningAnswer.command.payload.setupChange === false,
    JSON.stringify(conditioningAnswer));

  const noTargetCaptured = captureFromExecutorClarify({
    routedCommand: addTodayClarify,
    askedQuestion: addTodayClarify.question,
    originalMessage: 'I just said I want to add something',
    todayISO,
  });
  const conditioningToToday = resolvePendingScheduleTransactionAnswer({
    pending: { ...noTargetCaptured!, createdAt: NOW },
    userMessage: 'Conditioning to today',
    todayISO,
    currentWeek: [{ date: todayISO, sessionName: 'Rest', workout: null }],
  });
  ok('14.5 "conditioning to today" fills both missing slots',
    conditioningToToday.kind === 'complete' &&
      conditioningToToday.command.mode === 'mutate' &&
      conditioningToToday.command.operation === 'add_conditioning' &&
      conditioningToToday.command.target.kind === 'date' &&
      conditioningToToday.command.target.date === todayISO,
    JSON.stringify(conditioningToToday));

  const existingSessionAnswer = resolvePendingScheduleTransactionAnswer({
    pending: { ...captured!, createdAt: NOW },
    userMessage: 'conditioning',
    todayISO,
    currentWeek: [{
      date: todayISO,
      sessionName: 'Upper Pull',
      workout: { id: 'upper-pull', name: 'Upper Pull', workoutType: 'Strength' },
    }],
  });
  ok('14.6 existing-session target asks add-to-existing vs separate',
    existingSessionAnswer.kind === 'clarify' &&
      /already has a session/i.test(existingSessionAnswer.reply) &&
      /Add to existing session/i.test((existingSessionAnswer.options ?? []).join(' ')),
    JSON.stringify(existingSessionAnswer));

  const recurringConditioningAnswer = resolvePendingScheduleTransactionAnswer({
    pending: { ...noTargetCaptured!, createdAt: NOW },
    userMessage: 'Conditioning to today every week',
    todayISO,
    currentWeek: [{ date: todayISO, sessionName: 'Rest', workout: null }],
  });
  ok('14.7 recurring add answer asks setup-vs-one-off instead of mutating',
    recurringConditioningAnswer.kind === 'clarify' &&
      recurringConditioningAnswer.transaction.kind === 'add_to_date_transaction' &&
      recurringConditioningAnswer.transaction.setupChange === true &&
      /weekly setup|one-off extra/i.test(recurringConditioningAnswer.reply),
    JSON.stringify(recurringConditioningAnswer));

  const oneOffAfterRecurring = recurringConditioningAnswer.kind === 'clarify'
    ? resolvePendingScheduleTransactionAnswer({
        pending: {
          ...noTargetCaptured!,
          scheduleTransaction: recurringConditioningAnswer.transaction,
          createdAt: NOW,
        },
        userMessage: 'one-off extra session',
        todayISO,
        currentWeek: [{ date: todayISO, sessionName: 'Rest', workout: null }],
      })
    : null;
  ok('14.8 one-off answer resolves recurring-scope add transaction safely',
    oneOffAfterRecurring?.kind === 'complete' &&
      oneOffAfterRecurring.command.mode === 'mutate' &&
      oneOffAfterRecurring.command.operation === 'add_conditioning' &&
      oneOffAfterRecurring.command.payload.operation === 'add_conditioning' &&
      oneOffAfterRecurring.command.payload.overrideType === 'one_off_extra',
    JSON.stringify(oneOffAfterRecurring));
}

section('[15] pending slot resolver fills targetDate before generic routing');
{
  const todayISO = '2026-06-24'; // Wednesday
  const staleMonday = '2026-06-22';
  const nextMonday = '2026-06-29';
  const futureFlush = wk('Easy Aerobic Flush', 1, [ex('Rower')]);
  const removeCommand: CoachCommand = {
    mode: 'mutate',
    operation: 'remove_conditioning',
    target: {
      kind: 'date',
      date: staleMonday,
      sessionName: 'Easy Aerobic Flush',
    },
    payload: {
      operation: 'remove_conditioning',
      modality: null,
      targetItemId: 'stale-flush-item',
    },
    scope: 'one_off',
    confidence: 0.82,
    needsClarification: false,
    reason: 'remove_conditioning_detected',
  };
  const pendingDateEdit: ProgramEdit = {
    targetDate: staleMonday,
    targetSessionId: 'stale-session',
    targetItemId: null,
    targetDomain: 'conditioning',
    intent: 'ask_question',
    editScope: 'remove_conditioning_item',
    requestedChange: 'unknown',
    newValue: {
      operation: 'remove_conditioning',
      modality: null,
    },
    missingFields: ['targetDate', 'targetItemId'],
    confidence: 0.82,
    naturalLanguageReason: 'remove_conditioning_past_date_blocked',
    command: removeCommand,
    question: "That session is in the past — which date should I use?",
    options: ['Today', 'Tomorrow', 'Next Monday'],
    candidateItems: [],
  };
  const pending = {
    operation: 'remove_conditioning' as const,
    partialPayload: removeCommand.payload,
    scope: 'one_off' as const,
    missingFields: ['targetDate', 'targetItemId'],
    originalMessage: 'remove conditioning from Monday',
    askedQuestion: "That session is in the past — which date should I use?",
    createdAt: NOW,
    targetDate: staleMonday,
    targetSessionName: 'Easy Aerobic Flush',
    programEdit: pendingDateEdit,
    candidateItems: [],
    pendingClarification: {
      originalIntent: 'remove:conditioning:remove_conditioning_item',
      missingField: 'targetDate',
      expectedAnswerType: 'date' as const,
      proposedCandidate: {
        label: 'Next Monday',
        value: nextMonday,
        answerType: 'date' as const,
      },
      candidateOptions: ['Today', 'Tomorrow', 'Next Monday'],
      reason: 'apply_rejected:remove_conditioning:past_date_blocked',
    },
  };

  const terminalPastResult: ExecutionResult = {
    kind: 'verified_no_op',
    reply: "That session (Mon 2026-06-22) is in the past — I can't change it.",
    applied: false,
    route: 'apply_rejected:remove_conditioning:past_date_blocked',
    progress: ['checking_program', 'applying_change', 'verifying_update', 'composing_reply'],
  };
  const capturedPastDate = capturePendingDateClarificationFromProgramEditRejection({
    result: terminalPastResult,
    programEdit: pendingDateEdit,
    command: removeCommand,
    draft: null,
    originalMessage: 'remove conditioning from Monday',
    todayISO,
  });
  ok('15.0a verified_no_op past-date branch creates pending targetDate slot',
    !!capturedPastDate &&
      capturedPastDate.pendingClarification?.missingField === 'targetDate' &&
      capturedPastDate.pendingClarification.expectedAnswerType === 'date',
    JSON.stringify(capturedPastDate));
  ok('15.0b pending slot stores stale date and requested weekday',
    capturedPastDate?.pendingClarification?.staleDate === staleMonday &&
      capturedPastDate.pendingClarification.requestedDow === 'Monday',
    JSON.stringify(capturedPastDate?.pendingClarification));
  ok('15.0b2 pending slot stores a typed proposed date candidate',
    capturedPastDate?.pendingClarification?.proposedCandidate?.value === nextMonday,
    JSON.stringify(capturedPastDate?.pendingClarification));
  ok('15.0c branch reply asks a live question instead of terminal refusal',
    !!capturedPastDate &&
      /do you mean next monday/i.test(capturedPastDate.askedQuestion) &&
      !/can't change it/i.test(capturedPastDate.askedQuestion),
    capturedPastDate?.askedQuestion);

  const staleThursday = '2026-06-18';
  const thursdayEdit = {
    ...pendingDateEdit,
    targetDate: staleThursday,
    targetSessionId: 'stale-thursday-session',
    naturalLanguageReason: 'remove_conditioning_past_date_blocked_thursday',
  } as ProgramEdit;
  const thursdayCommand: CoachCommand = {
    ...removeCommand,
    target: {
      kind: 'date',
      date: staleThursday,
      sessionName: 'Easy Aerobic Flush',
    },
  };
  const capturedPastThursday = capturePendingDateClarificationFromProgramEditRejection({
    result: {
      ...terminalPastResult,
      reply: "That session (Thu 2026-06-18) is in the past — I can't change it.",
    },
    programEdit: thursdayEdit,
    command: thursdayCommand,
    draft: null,
    originalMessage: 'remove conditioning from Thursday',
    todayISO,
  });
  ok('15.0d same pending-date capture works for any stale weekday',
    capturedPastThursday?.pendingClarification?.requestedDow === 'Thursday' &&
      /next thursday/i.test(capturedPastThursday.askedQuestion),
    JSON.stringify(capturedPastThursday));

  const resolvedNextMonday = resolvePendingProgramEditAnswer({
    pending,
    userMessage: 'Yeah the next Monday',
    todayISO,
    currentWeek: [{
      date: nextMonday,
      sessionName: 'Easy Aerobic Flush',
      workout: futureFlush,
    }],
  });
  ok('15.1 next-week answer completes pending date slot',
    resolvedNextMonday.kind === 'complete' &&
      resolvedNextMonday.programEdit.targetDate === nextMonday,
    JSON.stringify(resolvedNextMonday));
  ok('15.2 retargeting drops stale conditioning item id',
    resolvedNextMonday.kind === 'complete' &&
      resolvedNextMonday.programEdit.targetItemId !== 'stale-flush-item' &&
      !!resolvedNextMonday.programEdit.targetItemId,
    JSON.stringify(resolvedNextMonday));
  ok('15.3 command target is retargeted before execution',
    resolvedNextMonday.kind === 'complete' &&
      resolvedNextMonday.programEdit.command?.mode === 'mutate' &&
      resolvedNextMonday.programEdit.command.target.kind === 'date' &&
      resolvedNextMonday.programEdit.command.target.date === nextMonday,
    JSON.stringify(resolvedNextMonday));

  for (const answer of ['yeah', 'yep', 'correct']) {
    const acceptedProposedDate = resolvePendingProgramEditAnswer({
      pending,
      userMessage: answer,
      todayISO,
      currentWeek: [{
        date: nextMonday,
        sessionName: 'Easy Aerobic Flush',
        workout: futureFlush,
      }],
    });
    ok(`15.3a pending date proposal + "${answer}" resolves to proposed candidate`,
      acceptedProposedDate.kind === 'complete' &&
        acceptedProposedDate.programEdit.targetDate === nextMonday &&
        acceptedProposedDate.programEdit.targetDomain === 'conditioning',
      JSON.stringify(acceptedProposedDate));
  }

  const rejectedProposedDate = resolvePendingProgramEditAnswer({
    pending,
    userMessage: 'no',
    todayISO,
    currentWeek: [{
      date: nextMonday,
      sessionName: 'Easy Aerobic Flush',
      workout: futureFlush,
    }],
  });
  ok('15.3b pending date proposal + "no" cancels instead of re-asking',
    rejectedProposedDate.kind === 'cancelled',
    JSON.stringify(rejectedProposedDate));

  const ambiguousAffirmativePending = {
    ...pending,
    pendingClarification: {
      ...pending.pendingClarification,
      proposedCandidate: undefined,
      candidateOptions: ['Today', 'Tomorrow'],
    },
  };
  const ambiguousAffirmative = resolvePendingProgramEditAnswer({
    pending: ambiguousAffirmativePending,
    userMessage: 'yeah',
    todayISO,
    currentWeek: [{
      date: nextMonday,
      sessionName: 'Easy Aerobic Flush',
      workout: futureFlush,
    }],
  });
  ok('15.3c multi-candidate pending date + "yeah" asks which option',
    ambiguousAffirmative.kind === 'clarify' &&
      ambiguousAffirmative.programEdit.missingFields.includes('targetDate'),
    JSON.stringify(ambiguousAffirmative));

  const semanticAlternative = classifyPendingClarificationAnswer({
    message: 'next Tuesday actually',
    pendingClarification: pending.pendingClarification,
    askedQuestion: pending.askedQuestion,
  });
  ok('15.3d alternative date answer is classified as a value, not accept-proposed',
    semanticAlternative.kind === 'provide_alternative_value',
    JSON.stringify(semanticAlternative));

  const rowerCandidate = {
    id: 'rower-conditioning-item',
    title: '20min zone 2 rower',
    domain: 'conditioning' as const,
    modality: 'rower' as const,
    durationMinutes: 20,
    source: 'conditioning_exercise' as const,
  };
  const pendingItemClarifier = {
    ...pending,
    missingFields: ['targetItemId'],
    askedQuestion: 'Do you mean the rower?',
    targetDate: nextMonday,
    programEdit: {
      ...pendingDateEdit,
      targetDate: nextMonday,
      targetItemId: null,
      missingFields: ['targetItemId'],
      question: 'Do you mean the rower?',
      options: ['20min zone 2 rower'],
      candidateItems: [rowerCandidate],
    } as ProgramEdit,
    candidateItems: [rowerCandidate],
    pendingClarification: {
      originalIntent: 'remove:conditioning:remove_conditioning_item',
      missingField: 'targetItemId',
      expectedAnswerType: 'item' as const,
      proposedCandidate: {
        label: 'the rower',
        value: 'rower-conditioning-item',
        answerType: 'item' as const,
      },
      candidateOptions: ['20min zone 2 rower'],
      reason: 'program_edit_clarify:targetItemId',
    },
  };
  const acceptedRower = resolvePendingProgramEditAnswer({
    pending: pendingItemClarifier,
    userMessage: 'yes',
    todayISO,
  });
  ok('15.3e pending item proposal + "yes" resolves the proposed rower',
    acceptedRower.kind === 'complete' &&
      acceptedRower.programEdit.targetItemId === 'rower-conditioning-item',
    JSON.stringify(acceptedRower));

  const scopeAffirmative = classifyPendingClarificationAnswer({
    message: 'yes',
    askedQuestion: 'Do you want that just this week or every week?',
    pendingClarification: {
      originalIntent: 'move:session:day',
      missingField: 'scope',
      expectedAnswerType: 'scope',
      candidateOptions: ['Just this week', 'Every week'],
    },
  });
  ok('15.3f scope question with two options + "yes" remains unclear',
    scopeAffirmative.kind === 'unclear',
    JSON.stringify(scopeAffirmative));

  const unresolvedDateAnswer = resolvePendingProgramEditAnswer({
    pending,
    userMessage: 'the one I meant',
    todayISO,
    currentWeek: [{
      date: nextMonday,
      sessionName: 'Easy Aerobic Flush',
      workout: futureFlush,
    }],
  });
  ok('15.4 vague answer keeps the pending date question closed to legacy',
    unresolvedDateAnswer.kind === 'clarify' &&
      unresolvedDateAnswer.programEdit.missingFields.includes('targetDate'),
    JSON.stringify(unresolvedDateAnswer));

  const noVisibleItemAnswer = resolvePendingProgramEditAnswer({
    pending,
    userMessage: 'next Monday',
    todayISO,
    currentWeek: [{
      date: nextMonday,
      sessionName: 'Rest',
      workout: null,
    }],
  });
  ok('15.5 resolved date with no visible item asks typed item clarification',
    noVisibleItemAnswer.kind === 'clarify' &&
      noVisibleItemAnswer.programEdit.targetDate === nextMonday &&
      noVisibleItemAnswer.programEdit.missingFields.includes('targetItemId') &&
      /can't see a visible conditioning item/i.test(noVisibleItemAnswer.reply),
    JSON.stringify(noVisibleItemAnswer));

  const removeSessionCommand: CoachCommand = {
    mode: 'mutate',
    operation: 'remove_session',
    target: {
      kind: 'date',
      date: staleMonday,
      sessionName: 'Easy Aerobic Flush',
    },
    payload: {
      operation: 'remove_session',
      reason: 'athlete requested removal',
    },
    scope: 'one_off',
    confidence: 0.8,
    needsClarification: false,
    reason: 'remove_session_detected',
  };
  const pendingSessionDate = {
    ...pending,
    operation: 'remove_session' as const,
    partialPayload: removeSessionCommand.payload,
    missingFields: ['targetDate'],
    programEdit: {
      targetDate: staleMonday,
      targetSessionId: 'stale-session',
      targetItemId: null,
      targetDomain: 'session',
      intent: 'remove',
      editScope: 'remove_whole_session',
      requestedChange: 'day',
      newValue: { reason: 'athlete requested removal' },
      missingFields: ['targetDate'],
      confidence: 0.8,
      naturalLanguageReason: 'remove_session_past_date_blocked',
      command: removeSessionCommand,
      question: "That session is in the past — which date should I use?",
      options: ['Today', 'Tomorrow'],
    } as ProgramEdit,
    pendingClarification: {
      originalIntent: 'remove:session:remove_whole_session',
      missingField: 'targetDate',
      expectedAnswerType: 'date' as const,
      candidateOptions: ['Today', 'Tomorrow'],
      reason: 'apply_rejected:remove_session:past_date_blocked',
    },
  };
  const tomorrowSession = resolvePendingProgramEditAnswer({
    pending: pendingSessionDate,
    userMessage: 'tomorrow',
    todayISO,
    currentWeek: [{
      date: '2026-06-25',
      sessionName: 'Upper Pull',
      workout: wk('Upper Pull', 4, [ex('Pull-Up')]),
    }],
  });
  ok('15.6 generic pending date slot handles tomorrow for session edits',
    tomorrowSession.kind === 'complete' &&
      tomorrowSession.programEdit.targetDomain === 'session' &&
      tomorrowSession.programEdit.targetDate === '2026-06-25',
    JSON.stringify(tomorrowSession));
}

async function runControllerPendingDateSection() {
  section('[16] CoachTurnController stores pending date slot on stale visible date');
  const todayISO = '2026-07-01';
  const program = buildSmokeCoachBikeFlowProgram(new Date(`${todayISO}T12:00:00`)) as any;
  const microcycle = program.microcycles[0];
  const mondayFlush = {
    ...buildSmokeWednesdayWorkout(microcycle.id),
    id: 'wk-smoke-mon-easy-flush',
    dayOfWeek: 1,
    exercises: buildSmokeWednesdayWorkout(microcycle.id).exercises.map((item: any) => ({
      ...item,
      id: `mon-${item.id}`,
      workoutId: 'wk-smoke-mon-easy-flush',
    })),
  };
  microcycle.workouts = microcycle.workouts.map((workout: any) =>
    workout.dayOfWeek === 1 ? mondayFlush : workout,
  );
  useProgramStore.getState().clear();
  useProgramStore.getState().setCurrentProgram(program);
  useProgramStore.getState().setCurrentMicrocycle(microcycle);
  useCoachContextStateStore.getState().clearCoachContext();
  usePendingCoachClarifierStore.getState().clearPending();

  const messages: CoachTurnMessage[] = [];
  let debug: CoachTurnDebug | null = null;
  const inputMessage: CoachTurnMessage = {
    id: 'turn-stale-monday',
    role: 'user',
    content: 'Can you remove conditioning from Monday?',
  };
  const handled = await handleCoachTurn({
    userMessage: inputMessage,
    messages,
    todayISO,
    classifier: {
      classify: async () => ({
        intent: 'conversation',
        confidence: 0,
        needsClarification: false,
      } as any),
    },
    pendingCoachProposal: null,
    pendingReadiness: null,
    pendingInjury: null,
    smokeCoachBikeFlow: false,
    isFocused: true,
    smokeWednesdayMissingReason: null,
    smokeWednesdayOpenTarget: null,
    setPendingCoachProposal: () => {},
    setPendingReadiness: () => {},
    appendUser: () => messages.push(inputMessage),
    appendAssistant: (message) => messages.push(message),
    appendUserAndAssistant: (message) => {
      messages.push(inputMessage, message);
    },
    clearInput: () => {},
    setIsLoading: () => {},
    setCoachProgressLabel: () => {},
    startSetupRebuildProgress: () => {},
    clearSetupRebuildProgress: () => {},
    setLastCoachDebug: (nextDebug) => {
      debug = nextDebug;
    },
  });
  const pendingAfter = getPendingClarifierSnapshot(NOW);
  const assistantReply = messages.find((message) => message.role === 'assistant')?.content ?? '';

  ok('16.1 CoachTurnController handled the stale-date mutation',
    handled.handled === true,
    JSON.stringify(handled));
  ok('16.2 stale date is caught before executor terminal refusal',
    debug?.route === 'pending_clarification:target_date:past_date',
    JSON.stringify(debug));
  ok('16.3 controller branch populated pending targetDate slot',
    pendingAfter?.pendingClarification?.missingField === 'targetDate' &&
      pendingAfter.pendingClarification.expectedAnswerType === 'date',
    JSON.stringify(pendingAfter));
  ok('16.4 pending slot preserves original remove-conditioning intent',
    pendingAfter?.operation === 'remove_conditioning' &&
      pendingAfter.programEdit?.targetDomain === 'conditioning',
    JSON.stringify(pendingAfter));
  ok('16.5 assistant reply is a clarification, not terminal refusal',
    /do you mean next monday/i.test(assistantReply) &&
      !/can't change it/i.test(assistantReply),
    assistantReply);
  ok('16.6 pending store carries stale date and requested weekday',
    pendingAfter?.pendingClarification?.staleDate === '2026-06-29' &&
      pendingAfter.pendingClarification.requestedDow === 'Monday',
    JSON.stringify(pendingAfter?.pendingClarification));
  usePendingCoachClarifierStore.getState().clearPending();

  section('[17] Pending date answer resumes stored ProgramEditDraft, not legacy command');
  const program2 = buildSmokeCoachBikeFlowProgram(new Date(`${todayISO}T12:00:00`)) as any;
  const microcycle2 = program2.microcycles[0];
  const mondayBase = microcycle2.workouts.find((workout: any) => workout.dayOfWeek === 1);
  const flushTemplate = buildSmokeWednesdayWorkout(microcycle2.id);
  const lowerStrengthRow = {
    id: 'mon-draft-strength-back-squat',
    workoutId: mondayBase.id,
    exerciseId: 'mon-draft-strength-back-squat',
    exerciseOrder: 0,
    prescribedSets: 3,
    prescribedRepsMin: 5,
    prescribedRepsMax: 8,
    prescriptionType: 'reps',
    restSeconds: 120,
    notes: 'Lower strength work',
    exercise: {
      id: 'mon-draft-strength-back-squat',
      name: 'Back Squat',
      description: 'Lower strength work',
    },
  };
  const mondayLowerWithFlush = {
    ...mondayBase,
    name: 'Lower Body Strength',
    workoutType: 'Strength',
    conditioningBlock: flushTemplate.conditioningBlock,
    exercises: [
      lowerStrengthRow,
      ...flushTemplate.exercises.map((item: any) => ({
        ...item,
        id: `mon-draft-${item.id}`,
        workoutId: mondayBase.id,
      })),
    ],
  };
  microcycle2.workouts = microcycle2.workouts.map((workout: any) =>
    workout.dayOfWeek === 1 ? mondayLowerWithFlush : workout,
  );
  useProgramStore.getState().clear();
  useProgramStore.getState().setCurrentProgram(program2);
  useProgramStore.getState().setCurrentMicrocycle(microcycle2);
  useCoachContextStateStore.getState().clearCoachContext();
  usePendingCoachClarifierStore.getState().clearPending();

  const semanticStrengthAdapter: SemanticProgramEditDraftAdapter = {
    buildDraft: (input: SemanticProgramEditDraftAdapterInput) => {
      const targetDay = input.visibleWeek.find((day) => day.date === '2026-06-29');
      const targetSessionId = String((targetDay?.workout as any)?.id ?? 'wk-smoke-dow-1');
      const sourceTarget = {
        kind: 'session' as const,
        date: '2026-06-29',
        sessionName: targetDay?.workout?.name ?? 'Lower Body Strength',
        itemId: targetSessionId,
        domain: 'strength' as const,
        stillVisible: true,
      };
      const removeStrength: ProgramEditDraftAction = {
        intent: 'remove',
        targetDomain: 'strength',
        actionScope: 'strength_block',
        targetDate: '2026-06-29',
        targetSessionId,
        targetItemId: null,
        sourceTarget,
        reason: 'semantic_lower_strength_remove',
      };
      const protectedConditioning = {
        targetDomain: 'conditioning' as const,
        actionScope: 'conditioning_block' as const,
        targetDate: '2026-06-29',
        targetItemId: null,
        title: 'Easy Aerobic Flush',
        reason: 'explicit_keep_conditioning',
      };
      const verifierExpectations: ProgramEditVerifierExpectation[] = [
        {
          kind: 'domain_changed',
          targetDomain: 'strength',
          actionScope: 'strength_block',
          targetDate: '2026-06-29',
          reason: 'remove_lower_strength',
        },
        {
          kind: 'domain_unchanged',
          targetDomain: 'conditioning',
          actionScope: 'conditioning_block',
          targetDate: '2026-06-29',
          reason: 'keep_flush',
        },
      ];
      const semanticDraft: ProgramEditDraft = {
        intent: 'remove',
        targetDomain: 'strength',
        actionScope: 'strength_block',
        targetDate: '2026-06-29',
        targetSessionId,
        targetItemId: null,
        sourceTarget,
        explicitDateRole: 'referent',
        explicitUserWording: input.userMessage,
        missingFields: ['targetItemId'],
        confidence: 0.91,
        protectedTargets: [protectedConditioning],
        constraints: ['keep conditioning:conditioning_block'],
        proposedActions: [removeStrength],
        verifierExpectations,
        isCompound: true,
        reason: 'semantic_lower_strength_keep_flush_overmarked_compound',
      };
      return {
        schemaVersion: SEMANTIC_PROGRAM_EDIT_DRAFT_SCHEMA_VERSION,
        status: 'draft',
        confidence: 0.91,
        draft: semanticDraft,
        reason: 'semantic_lower_strength_keep_flush_overmarked_compound',
      };
    },
  };

  const firstMessages: CoachTurnMessage[] = [];
  let firstDebug: CoachTurnDebug | null = null;
  const firstMessage: CoachTurnMessage = {
    id: 'turn-stale-strength-keep-flush',
    role: 'user',
    content: 'Can you drop the lower work Monday but keep the flush',
  };
  const controllerInputBase = {
    todayISO,
    classifier: {
      classify: async () => ({
        intent: 'conversation',
        confidence: 0,
        needsClarification: false,
      } as any),
    },
    pendingCoachProposal: null,
    pendingReadiness: null,
    pendingInjury: null,
    smokeCoachBikeFlow: false,
    isFocused: true,
    smokeWednesdayMissingReason: null,
    smokeWednesdayOpenTarget: null,
    setPendingCoachProposal: () => {},
    setPendingReadiness: () => {},
    clearInput: () => {},
    setIsLoading: () => {},
    setCoachProgressLabel: () => {},
    startSetupRebuildProgress: () => {},
    clearSetupRebuildProgress: () => {},
    semanticProgramEditDraftMode: 'active' as const,
    semanticProgramEditDraftAdapter: semanticStrengthAdapter,
  };
  const firstHandled = await handleCoachTurn({
    ...controllerInputBase,
    userMessage: firstMessage,
    messages: firstMessages,
    appendUser: () => firstMessages.push(firstMessage),
    appendAssistant: (message) => firstMessages.push(message),
    appendUserAndAssistant: (message) => {
      firstMessages.push(firstMessage, message);
    },
    setLastCoachDebug: (nextDebug) => {
      firstDebug = nextDebug;
    },
  });
  const draftPending = getPendingClarifierSnapshot(NOW);
  const firstReply = firstMessages.find((message) => message.role === 'assistant')?.content ?? '';
  ok('17.1 stale date turn still asks date clarification',
    firstHandled.handled === true &&
      firstDebug?.route === 'pending_clarification:target_date:past_date' &&
      /do you mean next monday/i.test(firstReply),
    JSON.stringify({ firstDebug, firstReply }));
  ok('17.2 pending slot stores full draft envelope',
    draftPending?.programEditDraftEnvelope?.draft.targetDomain === 'strength' &&
      draftPending.programEditDraftEnvelope.draft.actionScope === 'strength_block' &&
      draftPending.programEditDraftEnvelope.draft.protectedTargets.some((target) =>
        target.targetDomain === 'conditioning',
      ),
    JSON.stringify(draftPending?.programEditDraftEnvelope));

  const secondMessages: CoachTurnMessage[] = [];
  let secondDebug: CoachTurnDebug | null = null;
  const secondMessage: CoachTurnMessage = {
    id: 'turn-stale-strength-keep-flush-yes',
    role: 'user',
    content: 'Yeah',
  };
  const secondHandled = await handleCoachTurn({
    ...controllerInputBase,
    userMessage: secondMessage,
    messages: secondMessages,
    appendUser: () => secondMessages.push(secondMessage),
    appendAssistant: (message) => secondMessages.push(message),
    appendUserAndAssistant: (message) => {
      secondMessages.push(secondMessage, message);
    },
    setLastCoachDebug: (nextDebug) => {
      secondDebug = nextDebug;
    },
  });
  const secondReply = secondMessages.find((message) => message.role === 'assistant')?.content ?? '';
  ok('17.3 affirmative date answer resumes stored strength draft',
    secondHandled.handled === true &&
      /^Done\b/i.test(secondReply) &&
      /strength work/i.test(secondReply) &&
      !/which visible item/i.test(secondReply) &&
      !/compound edit|remove-and-add/i.test(secondReply),
    JSON.stringify({ secondDebug, secondReply }));
  const nextMondayOverride = useProgramStore.getState().dateOverrides?.['2026-07-06'] as any;
  ok('17.4 resumed draft removes strength and preserves protected conditioning',
    nextMondayOverride &&
      !(nextMondayOverride.exercises ?? []).some((row: any) =>
        /squat|deadlift|lunge|split/i.test(row.exercise?.name ?? ''),
      ) &&
      (nextMondayOverride.exercises ?? []).some((row: any) =>
        /easy aerobic flush|zone 2|row|bike/i.test(row.exercise?.name ?? ''),
      ) &&
      !/removed\s+\d+min|removed.*flush|removed.*bike/i.test(secondReply),
    JSON.stringify({ secondReply, nextMondayOverride }));
  ok('17.5 resumed strength draft writes only the patched next-Monday override',
    Object.keys(useProgramStore.getState().dateOverrides ?? {}).join(',') === '2026-07-06',
    JSON.stringify(useProgramStore.getState().dateOverrides ?? {}));
  ok('17.6 draft continuation clears finished transaction',
    getPendingClarifierSnapshot(NOW) === null,
    JSON.stringify(getPendingClarifierSnapshot(NOW)));

  useProgramStore.getState().clear();
  useProgramStore.getState().setCurrentProgram(program2);
  useProgramStore.getState().setCurrentMicrocycle(microcycle2);
  useCoachContextStateStore.getState().clearCoachContext();
  usePendingCoachClarifierStore.getState().clearPending();

  const repeatFirstMessages: CoachTurnMessage[] = [];
  const repeatFirstMessage: CoachTurnMessage = {
    id: 'turn-stale-strength-keep-flush-repeat',
    role: 'user',
    content: 'Can you drop the lower work Monday but keep the flush',
  };
  await handleCoachTurn({
    ...controllerInputBase,
    userMessage: repeatFirstMessage,
    messages: repeatFirstMessages,
    appendUser: () => repeatFirstMessages.push(repeatFirstMessage),
    appendAssistant: (message) => repeatFirstMessages.push(message),
    appendUserAndAssistant: (message) => {
      repeatFirstMessages.push(repeatFirstMessage, message);
    },
    setLastCoachDebug: () => {},
  });
  const explicitAnswerMessages: CoachTurnMessage[] = [];
  let explicitAnswerDebug: CoachTurnDebug | null = null;
  const explicitAnswerMessage: CoachTurnMessage = {
    id: 'turn-stale-strength-keep-flush-yep-next',
    role: 'user',
    content: 'Yep next Monday',
  };
  await handleCoachTurn({
    ...controllerInputBase,
    userMessage: explicitAnswerMessage,
    messages: explicitAnswerMessages,
    appendUser: () => explicitAnswerMessages.push(explicitAnswerMessage),
    appendAssistant: (message) => explicitAnswerMessages.push(message),
    appendUserAndAssistant: (message) => {
      explicitAnswerMessages.push(explicitAnswerMessage, message);
    },
    setLastCoachDebug: (nextDebug) => {
      explicitAnswerDebug = nextDebug;
    },
  });
  const explicitAnswerReply = explicitAnswerMessages.find((message) => message.role === 'assistant')?.content ?? '';
  ok('17.7 explicit next-Monday answer also resumes stored strength draft',
    /^Done\b/i.test(explicitAnswerReply) &&
      /strength work/i.test(explicitAnswerReply) &&
      /left conditioning alone/i.test(explicitAnswerReply),
    JSON.stringify({ explicitAnswerDebug, explicitAnswerReply }));

  usePendingCoachClarifierStore.getState().clearPending();
}

// ─── Summary ───────────────────────────────────────────────────────

runControllerPendingDateSection()
  .then(() => {
    console.log(`\n— Summary —`);
    console.log(`  Pass: ${pass}`);
    console.log(`  Fail: ${fail}`);
    if (fail > 0) {
      console.log(`\n— Failures —`);
      for (const f of failures) console.log(`  • ${f}`);
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    fail++;
    const detail = err instanceof Error ? err.stack ?? err.message : String(err);
    failures.push(`controller pending-date section threw\n      ${detail}`);
    console.log(`\n— Summary —`);
    console.log(`  Pass: ${pass}`);
    console.log(`  Fail: ${fail}`);
    console.log(`\n— Failures —`);
    for (const f of failures) console.log(`  • ${f}`);
    process.exit(1);
  });
