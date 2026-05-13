/**
 * request_program_adjustment tests — MVP deterministic coach path.
 *
 * Run: npm run test:request-program-adjustment
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as sessionResolver from '../utils/sessionResolver';
import type { ResolvedDay } from '../utils/sessionResolver';
import { useProgramStore } from '../store/programStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { buildCoachContextPacket } from '../utils/coachContextPacket';
import { dispatchCoachIntent, type DispatchDeps } from '../utils/coachIntentDispatcher';
import { buildLiveDispatchDeps } from '../utils/coachDispatchDeps';
import type { CoachIntent, PendingCoachProposal } from '../utils/coachIntent';
import { PENDING_PROGRAM_PROPOSAL_TTL_MS } from '../utils/programAdjustmentRequests';
import { buildEvent } from '../utils/programAdjustmentEngine';
import {
  buildDayWorkoutProjectedDay,
  buildProgramTabProjectedWeek,
  dayWorkoutShowsConditioningAfterStrength,
  programTabWorkoutShowsConditioning,
} from '../utils/visibleProgramReadModel';
import type { Workout, WorkoutExercise } from '../types/domain';

const TODAY = '2026-04-29'; // Wednesday, so current Monday is past.
const MONDAY_TODAY = '2026-04-27';
const MONDAY = '2026-04-27';
const NEXT_MONDAY = '2026-05-04';
const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

let baseWeekDef: Record<number, Workout | null> = {};
let currentTestToday = TODAY;
(sessionResolver as any).getMondayStr = () => MONDAY;
(sessionResolver as any).addDays = (iso: string, n: number) => addDaysISO(iso, n);
(sessionResolver as any).getMondayForDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = dt.getDay();
  dt.setDate(dt.getDate() + (dow === 0 ? -6 : -(dow - 1)));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
(sessionResolver as any).resolveWeekWithConditioning = (
  monday: string,
  state: any,
): ResolvedDay[] => {
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(monday, i);
    const dow = isoToDow(date);
    const override = state?.manualOverrides?.[date];
    const workout = override ?? baseWeekDef[dow] ?? null;
    out.push({
      date,
      dayOfWeek: dow,
      short: SHORT[dow],
      isToday: date === currentTestToday,
      workout,
      source: override ? 'manual' : workout ? 'template' : 'rest',
      indicator: null,
    } as any);
  }
  return out;
};

function ex(name: string, order = 0): WorkoutExercise {
  const id = `ex-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  return {
    id: `we-${id}`,
    workoutId: 'wk-lower',
    exerciseId: id,
    exerciseOrder: order,
    prescribedSets: 3,
    prescribedRepsMin: 6,
    prescribedRepsMax: 8,
    prescribedWeightKg: 0,
    restSeconds: 90,
    exercise: {
      id,
      name,
      description: name,
      exerciseType: 'Compound',
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate',
      createdAt: '',
      updatedAt: '',
    } as any,
    createdAt: '',
    updatedAt: '',
  };
}

function workout(name: string): Workout {
  return {
    id: 'wk-lower',
    microcycleId: 'mc',
    dayOfWeek: 1,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate' as any,
    workoutType: 'Strength' as any,
    sessionTier: 'core',
    exercises: [ex('Back Squat', 0), ex('Romanian Deadlift', 1)],
    coachNotes: [],
    createdAt: '',
    updatedAt: '',
  } as Workout;
}

function mixedWorkoutWithStrengthContent(name: string): Workout {
  return {
    ...workout(name),
    workoutType: 'Mixed' as any,
  } as Workout;
}

function nonStrengthWorkout(name: string): Workout {
  const touch = ex('Touch Skills', 0);
  const mobility = ex('Mobility Flow', 1);
  (touch.exercise as any).exerciseType = 'Skill';
  (mobility.exercise as any).exerciseType = 'Mobility';
  return {
    ...workout(name),
    workoutType: 'Technical' as any,
    exercises: [touch, mobility],
  } as Workout;
}

function reset(today = TODAY) {
  currentTestToday = today;
  baseWeekDef = { 1: workout('Lower Body Strength') };
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    dateOverrides: {},
    overrideContexts: {},
    sessionFeedback: {},
    weightOverrides: {},
  } as any);
  useCoachUpdatesStore.setState({
    updatesByWeek: {},
    activeInjury: null,
    activeConstraints: [],
  });
}

function packet(message: string, pendingCoachProposal?: PendingCoachProposal | null, todayISO = currentTestToday) {
  return buildCoachContextPacket({
    userMessage: message,
    recentMessages: [],
    todayISO,
    pendingCoachProposal,
  });
}

function intent(payload: CoachIntent['payload'] = {}): CoachIntent {
  return {
    intent: 'request_program_adjustment',
    confidence: 0.95,
    needsClarification: false,
    payload,
  };
}

function fakeDeps(applyResult: { eventsApplied: number; success: boolean; visibleDiff?: string[] }): DispatchDeps {
  return {
    reapplyInjuryAtSeverity: () => ({ applied: 0, visibleDiffDetected: false }),
    runProgression: () => '',
    runUAEForInjury: () => '',
    inspect: () => ({ kind: 'general_state', message: '' }),
    generalReply: () => '',
    applyNonInjuryConstraint: () => ({ reply: '', mutated: false }),
    applyConstraintResolution: () => ({ cleared: [] }),
    applyProgramAdjustmentEvents: () => ({
      eventsApplied: applyResult.eventsApplied,
      success: applyResult.success,
      visibleDiff: applyResult.visibleDiff ?? [],
    }),
  };
}

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n      ${detail}` : ''));
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}
function eq<T>(name: string, actual: T, expected: T) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function section(label: string) {
  console.log(`\n${label}`);
}

section('[1] first request routes to deterministic clarifier, not fall_through');
{
  reset(TODAY);
  const classified = intent({ requestedSession: 'Monday', concern: 'add conditioning' });
  eq('classifier intent = request_program_adjustment', classified.intent, 'request_program_adjustment');
  const outcome = dispatchCoachIntent(classified, packet('add conditioning to Monday sessions'), fakeDeps({ eventsApplied: 0, success: false }));
  eq('handled', outcome.handled, true);
  ok('does not fall through', outcome.replyMode !== 'fall_through');
  eq('asks clarifier', outcome.replyMode, 'program_adjustment_clarifier');
  eq('stores pending conditioning need', outcome.pendingCoachProposal?.needs, 'conditioning_type');
  eq('stores target date for pending clarification', outcome.pendingCoachProposal?.targetDate, MONDAY);
  eq(
    'uses friendly clarifier copy',
    outcome.reply,
    'What type of conditioning are you after — light aerobic intervals, a short bike flush, tempo running, or something else?',
  );
}

section('[1b] Monday name can omit strength when exercises are strength-based');
{
  reset(TODAY);
  baseWeekDef[1] = mixedWorkoutWithStrengthContent('Main Lift Day');
  const outcome = dispatchCoachIntent(
    intent({ requestedSession: 'Monday', concern: 'add conditioning' }),
    packet('add conditioning to Monday sessions'),
    fakeDeps({ eventsApplied: 0, success: false }),
  );
  eq('still asks conditioning clarifier', outcome.replyMode, 'program_adjustment_clarifier');
  eq('selected visible Monday date', outcome.pendingCoachProposal?.targetDate, MONDAY);
}

section('[1c] visible Monday without strength asks before adding');
{
  reset(TODAY);
  baseWeekDef[1] = nonStrengthWorkout('Skills Session');
  const outcome = dispatchCoachIntent(
    intent({ requestedSession: 'Monday', concern: 'add conditioning' }),
    packet('add conditioning to Monday sessions'),
    fakeDeps({ eventsApplied: 0, success: false }),
  );
  eq('clarifier mode', outcome.replyMode, 'program_adjustment_clarifier');
  eq(
    'asks non-strength confirmation',
    outcome.reply,
    "I found Monday, but it doesn't look like a strength session. Do you still want me to add light conditioning to it?",
  );
}

section('[2] clarification creates pending proposal without success claim');
{
  reset(MONDAY_TODAY);
  const pending = dispatchCoachIntent(
    intent({ requestedSession: 'Monday', concern: 'add conditioning' }),
    packet('add conditioning to Monday sessions'),
    fakeDeps({ eventsApplied: 0, success: false }),
  ).pendingCoachProposal;
  const outcome = dispatchCoachIntent(
    intent({ concern: 'light aerobic intervals after strength' }),
    packet('Just some light aerobic intervals I can do after the strength work', pending),
    fakeDeps({ eventsApplied: 0, success: false }),
  );
  eq('proposal mode', outcome.replyMode, 'program_adjustment_proposed');
  ok('pending proposal has prescription', !!outcome.pendingCoachProposal?.prescription);
  eq('light option stored', outcome.pendingCoachProposal?.conditioningOption, 'light_aerobic_intervals');
  eq(
    'light proposal copy',
    outcome.reply,
    'I can add light aerobic intervals after Monday strength — 8 x 2 min at 75–80% max HR with 1 min easy recovery. Reply "sounds good" and I\'ll apply it.',
  );
  ok('reply does not claim locked/done', !/locked in|done|now finishes|added/i.test(outcome.reply), outcome.reply);
}

section('[2b] short bike flush answer resolves pending clarification');
{
  reset(TODAY);
  const pending = dispatchCoachIntent(
    intent({ requestedSession: 'Monday', concern: 'add conditioning' }),
    packet('add conditioning to Monday sessions'),
    fakeDeps({ eventsApplied: 0, success: false }),
  ).pendingCoachProposal;
  const outcome = dispatchCoachIntent(
    { intent: 'general_question', confidence: 0.6, needsClarification: false },
    packet('Short bike flush', pending, TODAY),
    fakeDeps({ eventsApplied: 0, success: false }),
  );
  eq('proposal mode', outcome.replyMode, 'program_adjustment_proposed');
  eq('does not repeat original clarifier', outcome.reply.includes('What type of conditioning are you after'), false);
  eq('bike option stored', outcome.pendingCoachProposal?.conditioningOption, 'short_bike_flush');
  eq(
    'bike proposal copy',
    outcome.reply,
    'I can add a short bike flush after Monday strength — 12–20 min easy spin at 3–4/10 intensity. Reply "sounds good" and I\'ll apply it.',
  );
}

section('[2c] tempo running answer resolves pending clarification');
{
  reset(TODAY);
  const pending = dispatchCoachIntent(
    intent({ requestedSession: 'Monday', concern: 'add conditioning' }),
    packet('add conditioning to Monday sessions'),
    fakeDeps({ eventsApplied: 0, success: false }),
  ).pendingCoachProposal;
  const outcome = dispatchCoachIntent(
    { intent: 'general_question', confidence: 0.6, needsClarification: false },
    packet('tempo running', pending, TODAY),
    fakeDeps({ eventsApplied: 0, success: false }),
  );
  eq('proposal mode', outcome.replyMode, 'program_adjustment_proposed');
  eq('tempo option stored', outcome.pendingCoachProposal?.conditioningOption, 'tempo_running');
  eq(
    'tempo proposal copy',
    outcome.reply,
    'I can add tempo running after Monday strength — controlled reps at around 6–7/10 intensity, not a hard sprint session. Reply "sounds good" and I\'ll apply it.',
  );
}

section('[2d] unrecognised conditioning answer gets one helpful follow-up');
{
  reset(TODAY);
  const pending = dispatchCoachIntent(
    intent({ requestedSession: 'Monday', concern: 'add conditioning' }),
    packet('add conditioning to Monday sessions'),
    fakeDeps({ eventsApplied: 0, success: false }),
  ).pendingCoachProposal;
  const outcome = dispatchCoachIntent(
    { intent: 'general_question', confidence: 0.6, needsClarification: false },
    packet('make it spicy but not too spicy', pending, TODAY),
    fakeDeps({ eventsApplied: 0, success: false }),
  );
  eq('still handled as program adjustment', outcome.replyMode, 'program_adjustment_clarifier');
  eq('pending need survives', outcome.pendingCoachProposal?.needs, 'conditioning_type');
  eq(
    'helpful follow-up copy',
    outcome.reply,
    'I can do that — choose light aerobic intervals, a short bike flush, tempo running, or tell me the exact conditioning you want.',
  );
}

section('[3] confirmation applies and visible Monday includes conditioning');
{
  reset(TODAY);
  const pending: PendingCoachProposal = {
    type: 'program_adjustment',
    target: 'Monday Lower Body Strength',
    targetDay: 'Monday',
    targetDate: MONDAY,
    targetSessionName: 'Lower Body Strength',
    action: 'add_conditioning',
    prescription: '8 x 2 min @ 75-80% max HR, 1 min easy recovery',
    modality: 'bike or track',
    createdAt: Date.now(),
  };
  const outcome = dispatchCoachIntent(
    { intent: 'general_question', confidence: 0.8, needsClarification: false },
    packet('Sounds good', pending, TODAY),
    buildLiveDispatchDeps(TODAY),
  );
  eq('applied mode', outcome.replyMode, 'program_adjustment_applied');
  ok('reply says Done only after apply', /^Done/.test(outcome.reply), outcome.reply);
  const override = useProgramStore.getState().dateOverrides[MONDAY];
  ok('current visible Monday override exists', !!override);
  ok('visible conditioning block present', !!override?.conditioningBlock?.options?.some((o) => /aerobic/i.test(o.title)));
  ok('conditioning flavour set for Program tab', override?.conditioningFlavour === 'aerobic');
  ok('coachNotes include added conditioning', override?.coachNotes?.some((n) => /Added light aerobic intervals/i.test(n)) ?? false);
  const state = {
    currentProgram: null,
    currentMicrocycle: null,
    manualOverrides: useProgramStore.getState().dateOverrides,
    markedDays: {},
    athleteContext: {} as any,
    seasonPhase: null,
    readiness: 'medium' as const,
    activeInjury: null,
    activeConstraints: [],
  };
  const programTabMonday = buildProgramTabProjectedWeek({
    mondayISO: MONDAY,
    todayISO: TODAY,
    state,
    overrideContexts: useProgramStore.getState().overrideContexts,
  }).find((d) => d.date === MONDAY);
  ok(
    'Program tab projection shows conditioning',
    programTabWorkoutShowsConditioning(programTabMonday?.workout ?? null),
  );
  const dayWorkoutMonday = buildDayWorkoutProjectedDay({
    date: MONDAY,
    todayISO: TODAY,
    state,
    overrideContext: useProgramStore.getState().overrideContexts[MONDAY],
  });
  ok(
    'DayWorkout projection shows conditioning after strength',
    dayWorkoutShowsConditioningAfterStrength(dayWorkoutMonday.workout),
  );
}

section('[3b] completed current Monday targets next Monday');
{
  reset(TODAY);
  useProgramStore.setState({
    sessionFeedback: {
      [MONDAY]: {
        dateStr: MONDAY,
        feeling: 'good',
        completion: 'full',
      },
    },
  } as any);
  const outcome = dispatchCoachIntent(
    intent({ requestedSession: 'Monday', concern: 'add light aerobic intervals after strength' }),
    packet('add light aerobic intervals after strength to Monday', undefined, TODAY),
    buildLiveDispatchDeps(TODAY),
  );
  eq('applied mode', outcome.replyMode, 'program_adjustment_applied');
  ok('does not edit completed current Monday', !useProgramStore.getState().dateOverrides[MONDAY]);
  ok('edits next Monday', !!useProgramStore.getState().dateOverrides[NEXT_MONDAY]);
}

section('[3c] short bike proposal confirmation applies visible bike flush');
{
  reset(TODAY);
  const clarifier = dispatchCoachIntent(
    intent({ requestedSession: 'Monday', concern: 'add conditioning' }),
    packet('add conditioning to Monday sessions', undefined, TODAY),
    fakeDeps({ eventsApplied: 0, success: false }),
  ).pendingCoachProposal;
  const proposal = dispatchCoachIntent(
    { intent: 'general_question', confidence: 0.6, needsClarification: false },
    packet('Short bike flush', clarifier, TODAY),
    fakeDeps({ eventsApplied: 0, success: false }),
  ).pendingCoachProposal;
  const outcome = dispatchCoachIntent(
    { intent: 'general_question', confidence: 0.8, needsClarification: false },
    packet('sounds good', proposal, TODAY),
    buildLiveDispatchDeps(TODAY),
  );
  eq('applied mode', outcome.replyMode, 'program_adjustment_applied');
  eq('bike done copy', outcome.reply, 'Done — Monday now finishes with a short bike flush after strength.');
  const override = useProgramStore.getState().dateOverrides[MONDAY];
  ok('bike flush rendered in conditioning block', !!override?.conditioningBlock?.options?.some((o) => /bike flush/i.test(o.title)));
  ok('coachNotes include bike flush', override?.coachNotes?.some((n) => /bike flush/i.test(n)) ?? false);
  const state = {
    currentProgram: null,
    currentMicrocycle: null,
    manualOverrides: useProgramStore.getState().dateOverrides,
    markedDays: {},
    athleteContext: {} as any,
    seasonPhase: null,
    readiness: 'medium' as const,
    activeInjury: null,
    activeConstraints: [],
  };
  const programTabMonday = buildProgramTabProjectedWeek({
    mondayISO: MONDAY,
    todayISO: TODAY,
    state,
    overrideContexts: useProgramStore.getState().overrideContexts,
  }).find((d) => d.date === MONDAY);
  ok('Program tab projection shows bike conditioning', programTabWorkoutShowsConditioning(programTabMonday?.workout ?? null));
  const dayWorkoutMonday = buildDayWorkoutProjectedDay({
    date: MONDAY,
    todayISO: TODAY,
    state,
    overrideContext: useProgramStore.getState().overrideContexts[MONDAY],
  });
  ok('DayWorkout projection shows bike conditioning after strength', dayWorkoutShowsConditioningAfterStrength(dayWorkoutMonday.workout));
}

section('[4] zero applied events cannot claim success');
{
  reset(MONDAY_TODAY);
  const outcome = dispatchCoachIntent(
    intent({ requestedSession: 'Monday', concern: 'add light aerobic intervals after strength' }),
    packet('add light aerobic intervals after strength to Monday', undefined, MONDAY_TODAY),
    fakeDeps({ eventsApplied: 0, success: true, visibleDiff: [NEXT_MONDAY] }),
  );
  eq('failed mode', outcome.replyMode, 'program_adjustment_failed');
  ok('does not claim Done', !/^Done/.test(outcome.reply), outcome.reply);
}

section('[5] visible diff failure cannot claim success');
{
  reset(MONDAY_TODAY);
  const outcome = dispatchCoachIntent(
    intent({ requestedSession: 'Monday', concern: 'add light aerobic intervals after strength' }),
    packet('add light aerobic intervals after strength to Monday', undefined, MONDAY_TODAY),
    fakeDeps({ eventsApplied: 1, success: false, visibleDiff: [] }),
  );
  eq('failed mode', outcome.replyMode, 'program_adjustment_failed');
  ok('truthful failure reply', /didn't land in the visible program/i.test(outcome.reply), outcome.reply);
}

section('[6] state inspector answers truthfully after apply');
{
  reset(MONDAY_TODAY);
  const pending: PendingCoachProposal = {
    type: 'program_adjustment',
    targetDay: 'Monday',
    action: 'add_conditioning',
    prescription: '8 x 2 min @ 75-80% max HR, 1 min easy recovery',
    modality: 'bike or track',
    createdAt: Date.now(),
  };
  dispatchCoachIntent(
    { intent: 'general_question', confidence: 0.8, needsClarification: false },
    packet('sounds good', pending, MONDAY_TODAY),
    buildLiveDispatchDeps(MONDAY_TODAY),
  );
  const outcome = dispatchCoachIntent(
    {
      intent: 'why_didnt_program_change',
      confidence: 0.9,
      needsClarification: false,
      payload: { requestedSession: 'Monday', concern: "conditioning hasn't been added" },
    },
    packet("It hasn't been added to the program?", undefined, MONDAY_TODAY),
    buildLiveDispatchDeps(MONDAY_TODAY),
  );
  ok('inspector mentions visible program', /visible program/i.test(outcome.reply), outcome.reply);
  ok('inspector sees conditioning present', /includes/i.test(outcome.reply), outcome.reply);
}

section('[6b] no current or next Monday session fails honestly');
{
  reset(TODAY);
  baseWeekDef = {};
  const outcome = dispatchCoachIntent(
    intent({ requestedSession: 'Monday', concern: 'add light aerobic intervals after strength' }),
    packet('add light aerobic intervals after strength to Monday', undefined, TODAY),
    buildLiveDispatchDeps(TODAY),
  );
  eq('not found mode', outcome.replyMode, 'program_adjustment_failed');
  eq('not mutated', outcome.mutated, false);
  eq('honest not found reply', outcome.reply, "I couldn't find a Monday session to edit.");
}

section('[6c] target outside current/next visible weeks fails closed');
{
  reset(TODAY);
  const deps = buildLiveDispatchDeps(TODAY);
  const farMonday = '2026-05-18';
  const ev = buildEvent(
    'add_conditioning_block',
    farMonday,
    'Added light aerobic intervals after strength',
    null,
    {
      title: 'Light Aerobic Intervals',
      description: '8 x 2 min @ 75-80% max HR, 1 min easy recovery. Use bike or track.',
      coachNote: 'Added light aerobic intervals after strength',
      sets: 8,
      minutes: 2,
      restSeconds: 60,
    },
  );
  const result = deps.applyProgramAdjustmentEvents([ev], {
    type: 'add_conditioning',
    targetDates: [farMonday],
    requiredText: 'aerobic',
  });
  eq('outside window fails', result.success, false);
  eq('failure reason', result.reason, 'target_outside_visible_window');
}

section('[7] pending proposal cancel clears without mutation');
{
  reset();
  const pending: PendingCoachProposal = {
    type: 'program_adjustment',
    targetDay: 'Monday',
    action: 'add_conditioning',
    prescription: '8 x 2 min @ 75-80% max HR, 1 min easy recovery',
    modality: 'bike or track',
    createdAt: Date.now(),
  };
  const outcome = dispatchCoachIntent(
    { intent: 'general_question', confidence: 0.8, needsClarification: false },
    packet('cancel that', pending),
    buildLiveDispatchDeps(TODAY),
  );
  eq('handled cancel', outcome.handled, true);
  eq('pending cleared', outcome.pendingCoachProposal, null);
  eq('not mutated', outcome.mutated, false);
  ok('no override written', !useProgramStore.getState().dateOverrides[MONDAY]);
}

section('[8] expired pending proposal does not apply on confirmation');
{
  reset();
  const pending: PendingCoachProposal = {
    type: 'program_adjustment',
    targetDay: 'Monday',
    action: 'add_conditioning',
    prescription: '8 x 2 min @ 75-80% max HR, 1 min easy recovery',
    modality: 'bike or track',
    createdAt: Date.now() - PENDING_PROGRAM_PROPOSAL_TTL_MS - 1,
  };
  const outcome = dispatchCoachIntent(
    { intent: 'general_question', confidence: 0.8, needsClarification: false },
    packet('sounds good', pending),
    buildLiveDispatchDeps(TODAY),
  );
  eq('handled expired confirmation', outcome.handled, true);
  eq('pending cleared after expiry', outcome.pendingCoachProposal, null);
  eq('not mutated after expiry', outcome.mutated, false);
  ok('expiry reply says did not change', /did not change/i.test(outcome.reply), outcome.reply);
  ok('no override written', !useProgramStore.getState().dateOverrides[MONDAY]);
}

section('[9] unsupported response copy is human');
{
  reset(MONDAY_TODAY);
  const outcome = dispatchCoachIntent(
    intent({ requestedSession: 'Monday', concern: 'redesign my whole week' }),
    packet('Can you redesign my whole week?', undefined, MONDAY_TODAY),
    fakeDeps({ eventsApplied: 0, success: false }),
  );
  eq('unsupported mode', outcome.replyMode, 'program_adjustment_unsupported');
  ok('copy mentions smaller change', /smaller change/i.test(outcome.reply), outcome.reply);
  ok('copy is not old robotic version', !/I can’t apply that exact edit yet/i.test(outcome.reply), outcome.reply);
}

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
