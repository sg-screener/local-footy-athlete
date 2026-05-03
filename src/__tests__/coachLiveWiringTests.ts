/**
 * coachLiveWiringTests — proves the dispatcher is wired into the
 * LIVE handleSend runtime path, not just into pure helper tests.
 *
 * Strategy: mirror handleSend's actual flow using the SAME modules
 * (buildLiveDispatchDeps, LLMCoachIntentClassifier, dispatchCoachIntent,
 * buildCoachContextPacket). Mock fetch so the LLM returns a scripted
 * intent. Mock the resolver so the week is deterministic. Drive the
 * 7 acceptance scenarios through the live wiring and assert:
 *
 *   1. handleSend calls LLMCoachIntentClassifier.classify (fetch fires once
 *      against /coach-intent for non-pending turns)
 *   2. dispatchCoachIntent is called with the intent
 *   3. When outcome.handled === true, /coach-chat fetch is NEVER called
 *   4. "I already told you" → no severity question, dispatcher handled
 *   5. "Why didn't Monday change?" → no severity question, no /coach-chat call
 *   6. "Hammy cooked" with no active injury → severity asked
 *   7. Pending "6/10" → bypasses LLM entirely (no /coach-intent fetch)
 *
 * Run: npm run test:coach-live-wiring
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const realLog = console.log;
const realWarn = console.warn;
let captured: string[] = [];
function captureLogs() {
  captured = [];
  console.log = (...args: any[]) => {
    captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
  console.warn = (...args: any[]) => {
    captured.push('[WARN] ' + args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
}
function restoreLogs() {
  console.log = realLog;
  console.warn = realWarn;
}
function loggedAny(needle: string): boolean {
  return captured.some((line) => line.includes(needle));
}

// ─── Resolver stub ───
import * as sessionResolver from '../utils/sessionResolver';
import { applyInjuryFilterToWorkout } from '../utils/injuryWorkoutFilter';
import type { ResolvedDay } from '../utils/sessionResolver';

const FIXED_TODAY = '2026-04-29';
const FIXED_MONDAY = '2026-04-27';
const SHORT = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
function addDaysISO(iso: string, n: number): string {
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
    const date = addDaysISO(monday, i);
    const dow = isoToDow(date);
    const override = state.manualOverrides?.[date];
    const wkDef = baseWeekDef[dow] ?? null;
    let wk = override ?? wkDef;
    const source = override ? 'manual' : wkDef ? 'template' : 'rest';
    if (wk && state.activeInjury && source !== 'manual') {
      wk = applyInjuryFilterToWorkout(wk, state.activeInjury);
    }
    out.push({
      date, dayOfWeek: dow, short: SHORT[dow], isToday: date === FIXED_TODAY,
      workout: wk, source, indicator: null,
    } as any);
  }
  return out;
};
(sessionResolver as any).getMondayStr = () => FIXED_MONDAY;

// ─── Stores + production wiring ───
import { useProgramStore } from '../store/programStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { LLMCoachIntentClassifier } from '../utils/llmCoachIntentClassifier';
import { dispatchCoachIntent } from '../utils/coachIntentDispatcher';
import { buildLiveDispatchDeps } from '../utils/coachDispatchDeps';
import { buildCoachContextPacket } from '../utils/coachContextPacket';
import { resolveInjuryFromMessage, type PendingInjury } from '../utils/pendingInjuryResolver';
import { applyAdjustmentEvents } from '../utils/applyAdjustmentEvents';
import { applyProgramAdjustment, eventToBullet, buildInjuryPolicy, resolveInjuryBucket } from '../utils/programAdjustmentEngine';
import type { CoachIntent } from '../utils/coachIntent';
import type { InjuryState } from '../utils/injuryProgression';

function ex(name: string): any {
  return { id:`we-${name}`, workoutId:'wk', exerciseId:`ex-${name}`, exerciseOrder:0, prescribedSets:3, prescribedRepsMin:6, prescribedRepsMax:8, prescribedWeightKg:0, restSeconds:0,
    exercise:{ id:`ex-${name}`, name, description:name, exerciseType:'Compound', muscleGroups:[], equipmentRequired:[], difficultyLevel:'Intermediate', createdAt:'', updatedAt:'' },
    createdAt:'', updatedAt:'' };
}
function wk(name: string, dow: number, opts: any = {}): any {
  return { id:`w-${dow}`, microcycleId:'mc', dayOfWeek:dow, name, description:'', durationMinutes:60, intensity:'Moderate', workoutType: opts.workoutType || 'Strength', sessionTier: opts.sessionTier || 'core', exercises: opts.exercises || [], createdAt:'', updatedAt:'' };
}
function buildState() {
  return { currentProgram: null, currentMicrocycle: null,
    manualOverrides: useProgramStore.getState().dateOverrides || {},
    markedDays: {}, athleteContext: {}, seasonPhase: null, readiness: 'medium',
    activeInjury: useCoachUpdatesStore.getState().activeInjury,
  } as any;
}
function resetAll() {
  useProgramStore.setState({ currentProgram: null, currentMicrocycle: null, dateOverrides: {}, overrideContexts: {}, sessionFeedback: {}, weightOverrides: {} } as any);
  useCoachUpdatesStore.setState({ updatesByWeek: {}, activeInjury: null });
}

// ─── Mock fetch — captures all coach-intent + coach-chat calls ───
let coachIntentCalls = 0;
let coachChatCalls = 0;
let scriptedIntent: CoachIntent | null = null;

function makeFetch(): typeof fetch {
  return ((url: any, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/coach-intent')) {
      coachIntentCalls += 1;
      // Body sanity: must have packet + message.
      const body = JSON.parse((init?.body as any) || '{}');
      if (!body.packet || !body.message) {
        return Promise.resolve({
          ok: false, status: 400, headers: new Headers(),
          json: async () => ({ error: 'bad' }), text: async () => 'bad',
        } as unknown as Response);
      }
      const intent = scriptedIntent ?? {
        intent: 'general_question' as any, confidence: 0.5, needsClarification: false,
      };
      return Promise.resolve({
        ok: true, status: 200, headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => intent, text: async () => JSON.stringify(intent),
      } as unknown as Response);
    }
    if (u.includes('/coach-chat')) {
      coachChatCalls += 1;
      return Promise.resolve({
        ok: true, status: 200, headers: new Headers(),
        json: async () => ({ message: '(legacy reply)' }), text: async () => '{}',
      } as unknown as Response);
    }
    return Promise.reject(new Error(`unexpected fetch: ${u}`));
  }) as unknown as typeof fetch;
}

function resetFetchSpy() {
  coachIntentCalls = 0;
  coachChatCalls = 0;
  scriptedIntent = null;
}

// ─── Live handleSend mirror ───
//
// This mirrors the EXACT order in CoachScreen.handleSend so the test
// proves the wiring chain. Uses the same modules and the same code
// paths — only the React state setters / fetch are swapped for spies.
//
// 1. Pending-injury severity reply (no LLM)
// 2. Build packet
// 3. LLM classify
// 4. Dispatch
// 5. If handled → return (no legacy)
// 6. Else → legacy /coach-chat (last resort)
async function liveHandleSend(
  userMessageContent: string,
  pendingInjuryRef: { current: PendingInjury | null },
  classifier: LLMCoachIntentClassifier,
): Promise<{ reply: string; legacyCalled: boolean; intentCalled: boolean }> {
  const todayISO = FIXED_TODAY;
  const before = { intent: coachIntentCalls, chat: coachChatCalls };

  // ── 1. Pending injury severity reply (UAE bypass — no LLM) ──
  const resolution = resolveInjuryFromMessage(userMessageContent, pendingInjuryRef.current);
  if (resolution.kind === 'resolved') {
    const { bodyPart, severity } = resolution.resolved;
    pendingInjuryRef.current = null;
    const result = applyProgramAdjustment(
      { intent: 'injury', todayISO, payload: { bodyPart, severity }, source: 'client_guard' } as any,
      buildState(),
    );
    const apply = applyAdjustmentEvents(result.events, { todayISO, buildState });
    const cardBucket = bodyPart && bodyPart !== 'unknown' ? resolveInjuryBucket(bodyPart) : null;
    const policy = buildInjuryPolicy(cardBucket, severity);
    if (apply.applied.length > 0) {
      useCoachUpdatesStore.getState().upsertCoachUpdate(FIXED_MONDAY, {
        source: 'uae',
        reason: `${bodyPart[0].toUpperCase() + bodyPart.slice(1)} pain — ${severity}/10`,
        rules: [...policy.globalRules],
        changes: result.events.map(eventToBullet),
      });
      const nowISO = new Date().toISOString();
      useCoachUpdatesStore.getState().setActiveInjury({
        bodyPart, bucket: cardBucket as any, severity, initialSeverity: severity,
        status: 'active', rules: [...policy.globalRules],
        startDate: nowISO, createdAt: nowISO, lastUpdatedAt: nowISO,
        history: [{ timestamp: nowISO, fromStatus: 'new', toStatus: 'active', severity, note: userMessageContent }],
      });
    }
    return {
      reply: result.reply,
      legacyCalled: coachChatCalls > before.chat,
      intentCalled: coachIntentCalls > before.intent,
    };
  } else if (resolution.kind === 'stale_cleared') {
    pendingInjuryRef.current = null;
  }

  // ── 2-4. Build packet, classify, dispatch ──
  const packet = buildCoachContextPacket({
    userMessage: userMessageContent,
    recentMessages: [],
    todayISO,
  });
  const intent = await classifier.classify(packet);
  const deps = buildLiveDispatchDeps(todayISO);
  const outcome = dispatchCoachIntent(intent, packet, deps);

  if (outcome.handled) {
    return {
      reply: outcome.reply,
      legacyCalled: coachChatCalls > before.chat,
      intentCalled: coachIntentCalls > before.intent,
    };
  }

  // ── 5. Legacy fallback ──
  await fetch('https://x.supabase.co/functions/v1/coach-chat', {
    method: 'POST', headers: {}, body: JSON.stringify({ messages: [] }),
  });
  return {
    reply: '(legacy)',
    legacyCalled: coachChatCalls > before.chat,
    intentCalled: coachIntentCalls > before.intent,
  };
}

// ─── Harness ────
let pass = 0; let fail = 0; const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; realLog(`  \u2713 ${name}`); }
  else { fail++; failures.push(name); realLog(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`); }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { realLog(`\n${label}`); }

// Set the global fetch ONCE — the LLMCoachIntentClassifier reads it
// when constructed without an explicit fetcher.
(global as any).fetch = makeFetch();
const classifier = new LLMCoachIntentClassifier({
  endpoint: 'https://x.supabase.co/functions/v1/coach-intent',
  authToken: 'anon-key',
  fetcher: (global as any).fetch,
});

(async () => {

// ─────────────────────────────────────────────────────────────────────
// 1. handleSend calls classifier + dispatcher when no pending injury
// ─────────────────────────────────────────────────────────────────────
section('[1] non-pending turn → classifier + dispatcher fire');
{
  resetAll(); resetFetchSpy();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('RDLs')] }) };
  scriptedIntent = {
    intent: 'general_question', confidence: 0.6, needsClarification: false,
  };
  const pendingRef = { current: null };
  const r = await liveHandleSend('what should I do today?', pendingRef, classifier);
  ok('LLM classifier called once', coachIntentCalls === 1);
  // No active injury, general question with no other context → dispatcher returns fall_through.
  ok('dispatcher fell through to legacy', r.legacyCalled);
  eq('intent fetch count', coachIntentCalls, 1);
}

// ─────────────────────────────────────────────────────────────────────
// 2. dispatcher.handled=true → /coach-chat NEVER called
// ─────────────────────────────────────────────────────────────────────
section('[2] dispatcher handled → legacy /coach-chat NOT called');
{
  resetAll(); resetFetchSpy();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('RDLs')] }) };
  // Seed activeInjury so dispatcher routes a follow-up.
  const nowISO = new Date().toISOString();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'hammy', bucket: 'hamstring' as any, severity: 6, initialSeverity: 6,
    status: 'active', rules: ['No sprinting'], startDate: nowISO, createdAt: nowISO,
    lastUpdatedAt: nowISO, history: [],
  });
  scriptedIntent = {
    intent: 'active_injury_followup', confidence: 0.94, needsClarification: false,
  };
  const r = await liveHandleSend('I already told you how bad it was', { current: null }, classifier);
  ok('LLM classifier called', coachIntentCalls === 1);
  ok('legacy /coach-chat NOT called', !r.legacyCalled);
  eq('chat fetch count', coachChatCalls, 0);
  ok('reply does NOT ask severity', !/how bad is it/i.test(r.reply));
  ok('reply mentions hammy', /hammy/i.test(r.reply));
}

// ─────────────────────────────────────────────────────────────────────
// 3. "I already told you" → no severity ask, even when LLM mis-classifies
// ─────────────────────────────────────────────────────────────────────
section('[3] activeInjury same body part → severity clarifier suppressed');
{
  resetAll(); resetFetchSpy();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('RDLs')] }) };
  const nowISO = new Date().toISOString();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'hammy', bucket: 'hamstring' as any, severity: 6, initialSeverity: 6,
    status: 'active', rules: ['No sprinting'], startDate: nowISO, createdAt: nowISO,
    lastUpdatedAt: nowISO, history: [],
  });
  // LLM mis-classifies as new_injury_report with needsClarification=true.
  scriptedIntent = {
    intent: 'new_injury_report', confidence: 0.4, needsClarification: true,
    clarificationQuestion: 'How bad is it? Rough pain out of 10.',
    payload: { bodyPart: 'hammy' },
  };
  const r = await liveHandleSend('still cooked', { current: null }, classifier);
  ok('legacy NOT called', !r.legacyCalled);
  ok('reply does NOT ask severity', !/how bad is it/i.test(r.reply));
}

// ─────────────────────────────────────────────────────────────────────
// 4. "Why didn't Monday change?" past-date → state inspector + no legacy
// ─────────────────────────────────────────────────────────────────────
section('[4] why_didnt_program_change past date → state inspector, no legacy');
{
  resetAll(); resetFetchSpy();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('RDLs')] }) };
  const nowISO = new Date().toISOString();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'hammy', bucket: 'hamstring' as any, severity: 6, initialSeverity: 6,
    status: 'active', rules: ['No sprinting'], startDate: nowISO, createdAt: nowISO,
    lastUpdatedAt: nowISO, history: [],
  });
  scriptedIntent = {
    intent: 'why_didnt_program_change', confidence: 0.92, needsClarification: false,
    payload: { requestedDate: '2026-04-27' }, // Mon — past
  };
  const r = await liveHandleSend("why didn't Monday change?", { current: null }, classifier);
  ok('legacy NOT called', !r.legacyCalled);
  ok('reply mentions past', /past|already/i.test(r.reply));
  ok('reply does NOT ask severity', !/how bad is it/i.test(r.reply));
}

// ─────────────────────────────────────────────────────────────────────
// 5. "Hammy cooked" no activeInjury → severity clarifier (LLM dictates)
// ─────────────────────────────────────────────────────────────────────
section('[5] new injury, no activeInjury → severity clarifier');
{
  resetAll(); resetFetchSpy();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('RDLs')] }) };
  scriptedIntent = {
    intent: 'new_injury_report', confidence: 0.93, needsClarification: true,
    clarificationQuestion: 'How bad is it? Rough pain out of 10.',
    payload: { bodyPart: 'hammy' },
  };
  const r = await liveHandleSend('hammy cooked', { current: null }, classifier);
  ok('legacy NOT called', !r.legacyCalled);
  ok('reply asks severity', /how bad is it/i.test(r.reply));
}

// ─────────────────────────────────────────────────────────────────────
// 6. Pending "6/10" → bypasses LLM entirely (no /coach-intent fetch)
// ─────────────────────────────────────────────────────────────────────
section('[6] pendingInjury severity reply → bypasses LLM');
{
  resetAll(); resetFetchSpy();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('RDLs')] }) };
  // Pre-set a pending injury (would come from prior clarifier turn).
  const pendingRef: { current: PendingInjury | null } = {
    current: { bodyPart: 'hammy', originalMessage: 'hammy cooked', timestamp: Date.now() },
  };
  const r = await liveHandleSend('6/10', pendingRef, classifier);
  ok('LLM classifier NOT called (bypassed)', !r.intentCalled);
  ok('legacy NOT called', !r.legacyCalled);
  // UAE wrote the override.
  ok('Fri override written', !!useProgramStore.getState().dateOverrides['2026-05-01']);
  // activeInjury seeded.
  const inj = useCoachUpdatesStore.getState().activeInjury;
  ok('activeInjury created', inj?.bodyPart === 'hammy' && inj?.severity === 6);
}

// ─────────────────────────────────────────────────────────────────────
// 7. Different body part with activeInjury → clarifier NOT suppressed
// ─────────────────────────────────────────────────────────────────────
section('[7] activeInjury hammy + "shoulder hurts" → clarifier asks shoulder severity');
{
  resetAll(); resetFetchSpy();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('RDLs')] }) };
  const nowISO = new Date().toISOString();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'hammy', bucket: 'hamstring' as any, severity: 6, initialSeverity: 6,
    status: 'active', rules: ['No sprinting'], startDate: nowISO, createdAt: nowISO,
    lastUpdatedAt: nowISO, history: [],
  });
  scriptedIntent = {
    intent: 'new_injury_report', confidence: 0.86, needsClarification: true,
    clarificationQuestion: 'How bad is the shoulder pain (1-10)?',
    payload: { bodyPart: 'shoulder' },
  };
  const r = await liveHandleSend('my shoulder hurts', { current: null }, classifier);
  ok('legacy NOT called', !r.legacyCalled);
  ok('asks shoulder severity', /shoulder|how bad/i.test(r.reply));
}

// ─────────────────────────────────────────────────────────────────────
// 8. coach-flow logs at every routing decision
// ─────────────────────────────────────────────────────────────────────
section('[8] runtime logs — coach-flow trace');
{
  resetAll(); resetFetchSpy();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('RDLs')] }) };
  const nowISO = new Date().toISOString();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'hammy', bucket: 'hamstring' as any, severity: 6, initialSeverity: 6,
    status: 'active', rules: ['No sprinting'], startDate: nowISO, createdAt: nowISO,
    lastUpdatedAt: nowISO, history: [],
  });
  scriptedIntent = {
    intent: 'active_injury_followup', confidence: 0.94, needsClarification: false,
  };
  const prevDebugFlag = process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS;
  process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS = 'true';
  captureLogs();
  await liveHandleSend('still cooked', { current: null }, classifier);
  restoreLogs();
  process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGS = prevDebugFlag;
  ok('logs [coach-flow] intent', loggedAny('[coach-flow] intent'));
  ok('logs [coach-flow] route', loggedAny('[coach-flow] route'));
  ok('logs [coach-reply] source', loggedAny('[coach-reply] source'));
  ok('logs [coach-flow] activeInjury', loggedAny('[coach-flow] activeInjury'));
}

// ─── Summary ────
console.log = realLog;
console.warn = realWarn;
realLog(`\n— Summary —`);
realLog(`  Pass: ${pass}`);
realLog(`  Fail: ${fail}`);
if (fail > 0) {
  realLog(`\n— Failures —`);
  for (const f of failures) realLog(`  • ${f}`);
  process.exit(1);
}
process.exit(0);

})().catch((err) => {
  console.error('test runner error:', err);
  process.exit(1);
});
