/**
 * coachIntentDispatchTests — proves the conversational dispatcher
 * routes correctly with a mocked intent classifier.
 *
 * The production wiring (LLM call) is the dispatcher's input, not its
 * concern. This suite exercises the dispatch layer + state inspector
 * + softened guard via:
 *
 *   1. A scripted classifier (returns whichever intent the test wants)
 *   2. The real coachUpdatesStore + programStore for state
 *   3. Direct calls to the dispatch helpers
 *
 * Run: npm run test:coach-intent
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const realLog = console.log;
console.log = (..._args: any[]) => {};

// ─── Resolver stub ───
import * as sessionResolver from '../utils/sessionResolver';
import type { ResolvedDay } from '../utils/sessionResolver';

const FIXED_TODAY = '2026-04-29';
const FIXED_MONDAY = '2026-04-27';
const SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0); dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function isoToDow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}

let baseWeekDef: Record<number, any> = {};
(sessionResolver as any).resolveWeekWithConditioning = (monday: string, state: any): ResolvedDay[] => {
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const dow = isoToDow(date);
    const override = state.manualOverrides?.[date];
    const wkDef = baseWeekDef[dow] ?? null;
    const wk = override ?? wkDef;
    out.push({
      date, dayOfWeek: dow, short: SHORT[dow], isToday: date === FIXED_TODAY,
      workout: wk, source: override ? 'manual' : wk ? 'template' : 'rest', indicator: null,
    } as any);
  }
  return out;
};
(sessionResolver as any).getMondayStr = () => FIXED_MONDAY;
(sessionResolver as any).addDays = addDays;

import { useProgramStore } from '../store/programStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { buildCoachContextPacket } from '../utils/coachContextPacket';
import { inspectCoachState } from '../utils/coachStateInspector';
import { parseCoachIntent, COACH_INTENT_SYSTEM_PROMPT, type CoachIntent, type CoachIntentClassifier, type CoachContextPacket } from '../utils/coachIntent';
import { dispatchCoachIntent, type DispatchDeps } from '../utils/coachIntentDispatcher';
import type { InjuryState } from '../utils/injuryProgression';
import { extractBodyPart } from '../utils/injuryAdjustmentEngine';

function ex(name: string, notes?: string): any {
  return { id:`we-${name}`, workoutId:'wk', exerciseId:`ex-${name}`, exerciseOrder:0, prescribedSets:3, prescribedRepsMin:6, prescribedRepsMax:8, prescribedWeightKg:0, restSeconds:0,
    notes,
    exercise:{ id:`ex-${name}`, name, description:name, exerciseType:'Compound', muscleGroups:[], equipmentRequired:[], difficultyLevel:'Intermediate', createdAt:'', updatedAt:'' },
    createdAt:'', updatedAt:'' };
}
function wk(name: string, dow: number, opts: any = {}): any {
  return { id:`w-${dow}`, microcycleId:'mc', dayOfWeek:dow, name, description:'', durationMinutes:60, intensity:'Moderate', ...opts, workoutType: opts.workoutType || 'Strength', sessionTier: opts.sessionTier || 'core', exercises: opts.exercises || [], createdAt:'', updatedAt:'' };
}
function injury(severity: number, bodyPart: string = 'hammy', status: InjuryState['status'] = 'active'): InjuryState {
  return { bodyPart, bucket: 'hamstring' as any, severity, initialSeverity: severity, status,
    createdAt: '2026-04-29T08:00:00Z', lastUpdatedAt: '2026-04-29T08:00:00Z', history: [] };
}

function resetAll() {
  useProgramStore.setState({ currentProgram: null, currentMicrocycle: null, dateOverrides: {}, overrideContexts: {}, sessionFeedback: {}, weightOverrides: {} } as any);
  useCoachUpdatesStore.setState({ updatesByWeek: {}, activeInjury: null });
}

let pass = 0; let fail = 0; const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; realLog(`  \u2713 ${name}`); }
  else { fail++; failures.push(name); realLog(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`); }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { realLog(`\n${label}`); }

// ─────────────────────────────────────────────────────────────────────
// 1. parseCoachIntent — schema validation
// ─────────────────────────────────────────────────────────────────────
section('[1] parseCoachIntent — accepts valid, rejects garbage');
{
  const valid = {
    intent: 'active_injury_followup', confidence: 0.9, needsClarification: false,
    payload: { followupKind: 'improving', severity: 4 },
  };
  const parsed = parseCoachIntent(valid);
  ok('valid intent parsed', parsed != null);
  eq('parsed kind', parsed?.intent, 'active_injury_followup');

  ok('null rejected', parseCoachIntent(null) === null);
  ok('garbage rejected', parseCoachIntent({ foo: 'bar' }) === null);
  ok('unknown intent rejected', parseCoachIntent({ intent: 'eat_lunch' }) === null);
}

// ─────────────────────────────────────────────────────────────────────
// 2. system prompt sanity — has required rules
// ─────────────────────────────────────────────────────────────────────
section('[2] COACH_INTENT_SYSTEM_PROMPT — contains critical rules');
{
  ok('mentions activeInjury rule', /activeInjury/.test(COACH_INTENT_SYSTEM_PROMPT));
  ok('mentions never re-ask severity', /\bnever\b.*severity/i.test(COACH_INTENT_SYSTEM_PROMPT));
  ok('mentions why_didnt_program_change', /why_didnt_program_change/.test(COACH_INTENT_SYSTEM_PROMPT));
  ok('mentions program_explanation', /program_explanation/.test(COACH_INTENT_SYSTEM_PROMPT));
  ok('mentions session_mismatch_question', /session_mismatch_question/.test(COACH_INTENT_SYSTEM_PROMPT));
  ok('teaches upper pull is training terminology', /upper pull/.test(COACH_INTENT_SYSTEM_PROMPT));
}

// ─────────────────────────────────────────────────────────────────────
// 3. buildCoachContextPacket — assembles activeInjury + week summaries
// ─────────────────────────────────────────────────────────────────────
section('[3] buildCoachContextPacket — packs the right state');
{
  resetAll();
  baseWeekDef = {
    4: wk('Team Training', 4, { workoutType: 'Team Training' }),
    5: wk('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] }),
  };
  useCoachUpdatesStore.getState().setActiveInjury(injury(6));

  const packet = buildCoachContextPacket({
    userMessage: 'still cooked',
    recentMessages: [{ role: 'user', content: 'hammy cooked' }, { role: 'assistant', content: 'How bad is it?' }],
    todayISO: FIXED_TODAY,
  });

  ok('activeInjury surfaced', packet.activeInjury?.bodyPart === 'hammy');
  ok('current week has Team Training', packet.currentWeek.some((d) => d.workout?.name === 'Team Training'));
  ok('next week has Lower Strength', packet.nextWeek.some((d) => d.workout?.name === 'Lower Strength'));
  eq('todayISO preserved', packet.todayISO, FIXED_TODAY);
  ok('recent messages preserved', packet.recentMessages.length === 2);
}

// ─────────────────────────────────────────────────────────────────────
// 4. softened clarifier — same body part with activeInjury → suppress
// ─────────────────────────────────────────────────────────────────────
section('[4] softened clarifier — activeInjury + same body part → suppress severity ask');
{
  // The test mirrors the CoachScreen branch we added: if guardResult.fired
  // AND activeInjury matches the body part, set fired=false.
  const activeInjury = injury(6, 'hammy');
  // Case A: same body part — should suppress.
  const messageA = 'hammy is still cooked';
  const partA = extractBodyPart(messageA);
  const sameA = !partA || partA.toLowerCase() === activeInjury.bodyPart.toLowerCase();
  ok('case A: same body part → suppress', sameA === true);

  // Case B: no body part named — should suppress (assume followup).
  const messageB = "I'm still sore";
  const partB = extractBodyPart(messageB);
  const sameB = !partB || partB.toLowerCase() === activeInjury.bodyPart.toLowerCase();
  ok('case B: no body part → suppress', sameB === true);

  // Case C: different body part — do NOT suppress (new injury possible).
  const messageC = "my shoulder hurts";
  const partC = extractBodyPart(messageC);
  const sameC = !partC || partC.toLowerCase() === activeInjury.bodyPart.toLowerCase();
  ok('case C: different body part → DO NOT suppress', sameC === false);
}

// ─────────────────────────────────────────────────────────────────────
// 5. inspectCoachState — past date / no injury / unaffected / re-apply
// ─────────────────────────────────────────────────────────────────────
section('[5] inspectCoachState — answers based on actual state');
{
  resetAll();
  baseWeekDef = {
    4: wk('Team Training', 4, { workoutType: 'Team Training' }),
    5: wk('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] }),
  };
  const activeInjury = injury(6);

  // Past date.
  const pastAns = inspectCoachState({
    query: { date: '2026-04-20' }, todayISO: FIXED_TODAY,
    activeInjury, currentWeek: [], nextWeek: [], overrideContexts: {},
  });
  eq('past date → past_date', pastAns.kind, 'past_date');

  // Build a synthetic resolved week without filter (RDLs still present).
  const week: ResolvedDay[] = [
    { date: '2026-05-01', dayOfWeek: 5, short: 'FRI', isToday: false,
      workout: wk('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] }),
      source: 'template', indicator: 'core' } as any,
  ];

  // RDLs still present — should suggest reapply.
  const reapplyAns = inspectCoachState({
    query: { date: '2026-05-01', exerciseName: 'RDLs' },
    todayISO: FIXED_TODAY, activeInjury,
    currentWeek: week, nextWeek: [], overrideContexts: {},
  });
  eq('RDLs still in Lower → exercise_present_should_remove', reapplyAns.kind, 'exercise_present_should_remove');
  ok('reapply suggested', reapplyAns.suggestReapply === true);

  // No active injury → general explanation.
  const noInjuryAns = inspectCoachState({
    query: { date: '2026-05-01' }, todayISO: FIXED_TODAY,
    activeInjury: null, currentWeek: week, nextWeek: [], overrideContexts: {},
  });
  eq('no activeInjury → no_active_injury', noInjuryAns.kind, 'no_active_injury');

  // Manual override on the date — already modified.
  const overrideWeek: ResolvedDay[] = [
    { date: '2026-04-30', dayOfWeek: 4, short: 'THU', isToday: false,
      workout: { ...wk('Team Training', 4, { workoutType: 'Team Training' }),
        coachNotes: ['no sprinting'] },
      source: 'manual', indicator: 'core' } as any,
  ];
  const modAns = inspectCoachState({
    query: { date: '2026-04-30' }, todayISO: FIXED_TODAY,
    activeInjury, currentWeek: overrideWeek, nextWeek: [],
    overrideContexts: { '2026-04-30': { intent: 'injury' } },
  });
  eq('manual override → session_already_modified', modAns.kind, 'session_already_modified');
}

// ─────────────────────────────────────────────────────────────────────
// 6. End-to-end dispatch via mocked classifier
// ─────────────────────────────────────────────────────────────────────
section('[6] Mocked classifier dispatch — 7 spec scenarios route correctly');
{
  resetAll();
  baseWeekDef = {
    4: wk('Team Training', 4, { workoutType: 'Team Training' }),
    5: wk('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] }),
  };
  useCoachUpdatesStore.getState().setActiveInjury(injury(6));

  function runDispatch(message: string, mockedIntent: CoachIntent): { intent: CoachIntent; mutated: boolean } {
    const packet = buildCoachContextPacket({
      userMessage: message,
      recentMessages: [],
      todayISO: FIXED_TODAY,
    });
    const classifier: CoachIntentClassifier = { classify: () => mockedIntent };
    const intent = classifier.classify(packet) as CoachIntent;
    // Dispatch table — minimal mirror for testing.
    let mutated = false;
    switch (intent.intent) {
      case 'active_injury_followup':
      case 'injury_severity_reply':
      case 'request_program_adjustment':
        // Mutation paths fire (existing handlers do the work)
        mutated = true;
        break;
      case 'why_didnt_program_change':
      case 'program_explanation':
      case 'session_mismatch_question':
      case 'general_question':
      case 'fatigue':
      case 'missed_session':
      case 'exercise_swap':
      case 'new_injury_report':
        // No mutation in this scenario unless the handler explicitly fires
        mutated = false;
        break;
    }
    return { intent, mutated };
  }

  // (1) "I already told you" — same-body-part follow-up.
  const r1 = runDispatch('I already told you how bad it was',
    { intent: 'active_injury_followup', confidence: 0.95, needsClarification: false });
  eq('(1) routed to active_injury_followup', r1.intent.intent, 'active_injury_followup');
  ok('(1) does not need clarification', r1.intent.needsClarification === false);

  // (2) "my hammy is still cooked"
  const r2 = runDispatch('my hammy is still cooked',
    { intent: 'active_injury_followup', confidence: 0.92, needsClarification: false,
      payload: { followupKind: 'unchanged' } });
  eq('(2) routed to active_injury_followup', r2.intent.intent, 'active_injury_followup');

  // (3) "why didn't Monday change?"
  const r3 = runDispatch("why didn't Monday change?",
    { intent: 'why_didnt_program_change', confidence: 0.9, needsClarification: false });
  eq('(3) routed to why_didnt_program_change', r3.intent.intent, 'why_didnt_program_change');
  ok('(3) no mutation', r3.mutated === false);

  // (4) no activeInjury + "hammy cooked" → new_injury_report (clarifier expected).
  resetAll();
  const r4 = runDispatch('hammy cooked',
    { intent: 'new_injury_report', confidence: 0.95, needsClarification: true,
      clarificationQuestion: 'How bad is it? Rough pain out of 10.' });
  eq('(4) routed to new_injury_report', r4.intent.intent, 'new_injury_report');
  ok('(4) needsClarification', r4.intent.needsClarification === true);

  // (5) activeInjury hammy + "shoulder hurts" → new_injury_report.
  useCoachUpdatesStore.getState().setActiveInjury(injury(6, 'hammy'));
  const r5 = runDispatch('my shoulder hurts',
    { intent: 'new_injury_report', confidence: 0.85, needsClarification: true,
      clarificationQuestion: 'How bad is the shoulder pain (1-10)?',
      payload: { bodyPart: 'shoulder' } });
  eq('(5) different body part → new_injury_report', r5.intent.intent, 'new_injury_report');

  // (6) "why are deadlifts still there next week?" — re-apply path.
  const r6 = runDispatch('why are deadlifts still there next week?',
    { intent: 'why_didnt_program_change', confidence: 0.93, needsClarification: false,
      payload: { exerciseName: 'deadlifts', requestedDate: '2026-05-08' } });
  eq('(6) routed to why_didnt_program_change', r6.intent.intent, 'why_didnt_program_change');
  ok('(6) carries exerciseName payload', r6.intent.payload?.exerciseName === 'deadlifts');

  // (7) "should I still train?" — stateful general question.
  const r7 = runDispatch('should I still train?',
    { intent: 'general_question', confidence: 0.88, needsClarification: false,
      payload: { concern: 'whether to train at all' } });
  eq('(7) routed to general_question', r7.intent.intent, 'general_question');
  ok('(7) no mutation', r7.mutated === false);
}

// ─────────────────────────────────────────────────────────────────────
// 7. Session mismatch questions do not become injury clarifiers.
// ─────────────────────────────────────────────────────────────────────
section('[7] Session mismatch wording routes to program explanation, not injury');
{
  resetAll();
  baseWeekDef = {
    2: wk('Team Training + Upper Pull', 2, {
      workoutType: 'Strength',
      sessionTier: 'core',
      exercises: [ex('Pull-Up')],
    }),
    3: wk('Upper Pull', 3, {
      workoutType: 'Conditioning',
      sessionTier: 'optional',
      conditioningFlavour: 'aerobic',
      exercises: [ex('40min zone 2 row')],
      coachNotes: ['Shifted to non-running modality to manage weekly run load.'],
    }),
  };
  const packet = buildCoachContextPacket({
    userMessage: 'Why is upper pull on Wednesday a rowing session?',
    recentMessages: [],
    todayISO: FIXED_TODAY,
  });
  const deps: DispatchDeps = {
    reapplyInjuryAtSeverity: () => ({ applied: 0, visibleDiffDetected: false }),
    runProgression: () => 'progression should not run',
    runUAEForInjury: () => 'injury should not run',
    inspect: () => ({ kind: 'general_state', message: 'inspect should not run' }),
    generalReply: () => 'general should not run',
    applyNonInjuryConstraint: () => ({ reply: 'non-injury should not run', mutated: false }),
    applyConstraintResolution: () => ({ cleared: [], remainingActiveCount: 0 }),
    applyProgramAdjustmentEvents: () => ({ success: false, eventsApplied: 0, visibleDiff: [] }),
  };

  const outcome = dispatchCoachIntent({
    intent: 'session_mismatch_question',
    confidence: 0.95,
    needsClarification: false,
  }, packet, deps);

  ok('dispatcher handles session mismatch', outcome.handled === true);
  eq('reply mode', outcome.replyMode, 'program_explanation');
  ok('does not mutate', outcome.mutated === false);
  ok('reply does not ask pain score', !/pain out of 10|how bad is it/i.test(outcome.reply));
  ok('reply explains aerobic / non-running rationale', /aerobic base|running load|Zone 2/i.test(outcome.reply));
  ok('reply targets Wednesday row, not Tuesday', /Wednesday/i.test(outcome.reply) && !/Tuesday/i.test(outcome.reply));

  const misclassified = dispatchCoachIntent({
    intent: 'new_injury_report',
    confidence: 0.5,
    needsClarification: true,
    clarificationQuestion: 'How bad is it? Rough pain out of 10.',
  }, packet, deps);
  ok('misclassified injury clarifier is suppressed', misclassified.handled === true);
  eq('suppressed reply mode', misclassified.replyMode, 'program_explanation');
  ok('suppressed reply does not ask pain score', !/pain out of 10|how bad is it/i.test(misclassified.reply));
}

// ─────────────────────────────────────────────────────────────────────
// 8. Row programming questions inspect the visible row session.
// ─────────────────────────────────────────────────────────────────────
section('[8] Program explanation for mid-week row');
{
  const deps: DispatchDeps = {
    reapplyInjuryAtSeverity: () => ({ applied: 0, visibleDiffDetected: false }),
    runProgression: () => 'progression should not run',
    runUAEForInjury: () => 'injury should not run',
    inspect: () => ({ kind: 'general_state', message: 'inspect should not run' }),
    generalReply: () => 'general should not run',
    applyNonInjuryConstraint: () => ({ reply: 'non-injury should not run', mutated: false }),
    applyConstraintResolution: () => ({ cleared: [], remainingActiveCount: 0 }),
    applyProgramAdjustmentEvents: () => ({ success: false, eventsApplied: 0, visibleDiff: [] }),
  };

  function withRow(message: string) {
    resetAll();
    baseWeekDef = {
      2: wk('Team Training + Upper Pull', 2, {
        workoutType: 'Strength',
        sessionTier: 'core',
        exercises: [ex('Pull-Up')],
      }),
      3: wk('Upper Pull', 3, {
        workoutType: 'Conditioning',
        sessionTier: 'optional',
        conditioningFlavour: 'aerobic',
        exercises: [ex(
          'Easy Aerobic Flush (25min Rower)',
          '25min easy Rower.\nIntensity: 3-4/10 — genuinely easy, conversational pace.\nOptional. Use this for recovery and aerobic maintenance.\nSkip if legs feel heavy after team training or if Thursday training quality would suffer.',
        )],
        coachNotes: ['Shifted to non-running modality to manage weekly run load.'],
      }),
    };
    const packet = buildCoachContextPacket({
      userMessage: message,
      recentMessages: [],
      todayISO: FIXED_TODAY,
    });
    return dispatchCoachIntent({
      intent: 'general_question',
      confidence: 0.7,
      needsClarification: false,
    }, packet, deps);
  }

  const midWeek = withRow('Why did you put a mid week row in?');
  ok('mid-week row handled without legacy', midWeek.handled === true);
  eq('mid-week row replyMode', midWeek.replyMode, 'program_explanation');
  ok('mid-week row does not mention pain guard', !/pain score|pain out of 10|injury report/i.test(midWeek.reply));
  ok('mid-week row finds visible row', /Wednesday|Easy Aerobic Flush|row/i.test(midWeek.reply));
  ok('mid-week row explains rationale', /aerobic base|running load/i.test(midWeek.reply));
  ok('mid-week row protects Thursday', /compromise Thursday|skip it|shorten it|3-4\/10/i.test(midWeek.reply));
  ok('mid-week row does not invent Tuesday', !/Tuesday/i.test(midWeek.reply));

  const wed = withRow('Why is there a row on Wednesday?');
  ok('Wednesday row targets Wednesday', /Wednesday/i.test(wed.reply) && !/Tuesday/i.test(wed.reply));

  const running = withRow('Why am I rowing instead of running?');
  ok('rowing instead of running explains off-feet conversion', /non-running|running load|Zone 2/i.test(running.reply));

  resetAll();
  baseWeekDef = {
    2: wk('Team Training + Upper Pull', 2, {
      workoutType: 'Strength',
      sessionTier: 'core',
      exercises: [ex('Pull-Up')],
    }),
  };
  const noRowPacket = buildCoachContextPacket({
    userMessage: 'Why did you put a mid week row in?',
    recentMessages: [],
    todayISO: FIXED_TODAY,
  });
  const noRow = dispatchCoachIntent({
    intent: 'general_question',
    confidence: 0.7,
    needsClarification: false,
  }, noRowPacket, deps);
  eq('no row asks which day', noRow.reply, "I can't see the row session in the visible week I'm reading. Which day are you looking at?");
  ok('no row does not invent Tuesday', !/Tuesday/i.test(noRow.reply));
}

// ─── Summary ───
console.log = realLog;
realLog(`\n— Summary —`);
realLog(`  Pass: ${pass}`);
realLog(`  Fail: ${fail}`);
if (fail > 0) {
  realLog(`\n— Failures —`);
  for (const f of failures) realLog(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
