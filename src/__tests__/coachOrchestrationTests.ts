/**
 * coachOrchestrationTests — end-to-end orchestration of the coach
 * flow with a MOCKED LLM intent classifier. Proves the dispatcher
 * routes correctly across the 7 non-negotiable acceptance scenarios.
 *
 * Acceptance scenarios from the spec:
 *   1. New injury — "Hammy cooked" → "6/10" → activeInjury created,
 *      visible current week, future weeks filtered.
 *   2. "I already told you" → no severity question, acknowledges
 *      existing severity.
 *   3. "Why didn't Monday change?" — past-date explanation, no
 *      severity question.
 *   4. "Why are deadlifts still there next week?" → state-inspector
 *      flags or fixes, reply grounded in resolved state.
 *   5. Resolved injury — "pain is gone" → activeInjury cleared,
 *      future filter stops applying.
 *   6. Different new injury — "my shoulder hurts" → may ask severity.
 *   7. "Should I train today?" → state-grounded answer using active
 *      injury + today's session, no severity question.
 *
 * The LLM is MOCKED — we focus on the dispatcher's routing decisions
 * and the deterministic engines. The production LLM call is covered
 * by `npm run test:llm-classifier`.
 *
 * Run: npm run test:coach-orchestration
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

// Mirror production behaviour: the real `resolveWeekWithConditioning`
// applies the resolver-level injury filter at its tail end. The stub
// must do the same so tests reflect what the user sees.
import { applyInjuryFilterToWorkout } from '../utils/injuryWorkoutFilter';

(sessionResolver as any).resolveWeekWithConditioning = (monday: string, state: any): ResolvedDay[] => {
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(monday, i);
    const dow = isoToDow(date);
    const override = state.manualOverrides?.[date];
    const wkDef = baseWeekDef[dow] ?? null;
    let wk = override ?? wkDef;
    const source = override ? 'manual' : wkDef ? 'template' : 'rest';
    // Apply the activeInjury filter to non-override, non-rest days
    // — same gate the real `applyInjuryFilterPass` uses.
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

import { useProgramStore } from '../store/programStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import {
  applyAdjustmentEvents,
  removeInjuryOverridesForWeek,
} from '../utils/applyAdjustmentEvents';
import {
  applyProgramAdjustment,
  buildInjuryPolicy,
  resolveInjuryBucket,
  eventToBullet,
} from '../utils/programAdjustmentEngine';
import {
  snapshotVisibleWorkout,
  computeVisibleDiff,
} from '../utils/visibleWorkoutDiff';
import { inspectCoachState } from '../utils/coachStateInspector';
import {
  dispatchCoachIntent,
  type DispatchDeps,
} from '../utils/coachIntentDispatcher';
import type {
  CoachContextPacket,
  CoachIntent,
} from '../utils/coachIntent';
import { buildCoachContextPacket } from '../utils/coachContextPacket';
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
    // Read activeInjury so the stubbed resolveWeekWithConditioning can
    // mirror the production filter behaviour.
    activeInjury: useCoachUpdatesStore.getState().activeInjury,
  } as any;
}
function resetAll() {
  useProgramStore.setState({ currentProgram: null, currentMicrocycle: null, dateOverrides: {}, overrideContexts: {}, sessionFeedback: {}, weightOverrides: {} } as any);
  useCoachUpdatesStore.setState({ updatesByWeek: {}, activeInjury: null });
}

// Mirror of CoachScreen helpers — these are the same deps the
// dispatcher needs in production, wired here for the test.
function makeDeps(): DispatchDeps {
  return {
    runUAEForInjury(bodyPart, severity, note) {
      const result = applyProgramAdjustment(
        { intent: 'injury', todayISO: FIXED_TODAY,
          payload: { bodyPart, severity }, source: 'client_guard' } as any,
        buildState(),
      );
      const apply = applyAdjustmentEvents(result.events, { todayISO: FIXED_TODAY, buildState });
      // Seed activeInjury and write the card.
      const cardBucket = bodyPart && bodyPart !== 'unknown' ? resolveInjuryBucket(bodyPart) : null;
      const policy = buildInjuryPolicy(cardBucket, severity);
      const monday = FIXED_MONDAY;
      const nowISO = new Date().toISOString();
      if (apply.applied.length > 0) {
        useCoachUpdatesStore.getState().upsertCoachUpdate(monday, {
          source: 'uae',
          reason: `${bodyPart[0].toUpperCase() + bodyPart.slice(1)} pain — ${severity}/10`,
          rules: [...policy.globalRules],
          changes: result.events.map(eventToBullet),
        });
      }
      const existing = useCoachUpdatesStore.getState().activeInjury;
      const seedRules = [...policy.globalRules];
      const newState: InjuryState = existing && existing.bodyPart.toLowerCase() === bodyPart.toLowerCase()
        ? { ...existing, severity, status: 'active', rules: seedRules, lastUpdatedAt: nowISO,
            history: [...existing.history, { timestamp: nowISO, fromStatus: existing.status, toStatus: 'active', severity, note }] }
        : { bodyPart, bucket: cardBucket as any, severity, initialSeverity: severity,
            status: 'active', rules: seedRules, startDate: nowISO, createdAt: nowISO, lastUpdatedAt: nowISO,
            history: [{ timestamp: nowISO, fromStatus: 'new', toStatus: 'active', severity, note }] };
      useCoachUpdatesStore.getState().setActiveInjury(newState);
      return result.reply;
    },
    runProgression(outcome, current, note) {
      const monday = FIXED_MONDAY;
      const nowISO = new Date().toISOString();
      if (outcome.kind === 'resolved') {
        removeInjuryOverridesForWeek(monday);
        useCoachUpdatesStore.getState().deactivateCoachUpdate(monday);
        useCoachUpdatesStore.getState().setActiveInjury(null);
        return `Cleared the ${current.bodyPart} restrictions — back to normal.`;
      }
      if (outcome.kind === 'unchanged') {
        useCoachUpdatesStore.getState().transitionInjuryStatus({
          toStatus: 'active', severity: current.severity, note, timestamp: nowISO,
        });
        return `Got it — keeping the ${current.bodyPart} ${current.severity}/10 restrictions in place.`;
      }
      // improving / worsening
      removeInjuryOverridesForWeek(monday);
      const newSev = outcome.newSeverity;
      let applied = 0;
      if (newSev >= 5) {
        const result = applyProgramAdjustment(
          { intent: 'injury', todayISO: FIXED_TODAY,
            payload: { bodyPart: current.bodyPart, severity: newSev }, source: 'client_guard' } as any,
          buildState(),
        );
        const apply = applyAdjustmentEvents(result.events, { todayISO: FIXED_TODAY, buildState });
        applied = apply.applied.length;
      }
      useCoachUpdatesStore.getState().transitionInjuryStatus({
        toStatus: outcome.kind === 'improving' ? 'improving' : 'active',
        severity: newSev, note, timestamp: nowISO,
      });
      return outcome.kind === 'improving'
        ? `Good — ${current.bodyPart} easing to ${newSev}/10.`
        : `Sorry to hear — ${current.bodyPart} worse at ${newSev}/10.`;
    },
    inspect(query) {
      const monday = FIXED_MONDAY;
      const next = addDaysISO(monday, 7);
      const cw = (sessionResolver as any).resolveWeekWithConditioning(monday, buildState());
      const nw = (sessionResolver as any).resolveWeekWithConditioning(next, buildState());
      return inspectCoachState({
        query,
        todayISO: FIXED_TODAY,
        activeInjury: useCoachUpdatesStore.getState().activeInjury,
        currentWeek: cw,
        nextWeek: nw,
        overrideContexts: useProgramStore.getState().overrideContexts ?? {},
      });
    },
    reapplyInjuryAtSeverity(bodyPart, severity, monday, todayISO) {
      removeInjuryOverridesForWeek(monday);
      const result = applyProgramAdjustment(
        { intent: 'injury', todayISO,
          payload: { bodyPart, severity }, source: 'client_guard' } as any,
        buildState(),
      );
      const apply = applyAdjustmentEvents(result.events, { todayISO, buildState });
      // Visible-diff check.
      const before: any = {};
      const after: any = {};
      const week = (sessionResolver as any).resolveWeekWithConditioning(monday, buildState());
      for (const d of week) after[d.date] = snapshotVisibleWorkout(d.workout);
      const dates = result.events.map((e) => e.date);
      const diff = computeVisibleDiff(dates, before, after);
      return { applied: apply.applied.length, visibleDiffDetected: diff.length > 0 };
    },
    generalReply(intent, packet) {
      const i = packet.activeInjury;
      if (!i) return `Sure — what would you like to do?`;
      // "Should I train today?" style — ground in active injury + today's session.
      const today = packet.currentWeek.find((d) => d.isToday);
      const todayName = today?.workout?.name ?? 'today';
      return `With ${i.bodyPart} at ${i.severity}/10 (${i.status}), today's ${todayName} should follow the active restriction: ${i.rules.join('; ')}.`;
    },
    // Stub: this orchestration suite predates the non-injury constraint
    // route, so we just ack any non-injury intent. The real producer is
    // exercised by coachLivePathV2IntegrationTests + coachIntentDispatchTests.
    applyNonInjuryConstraint(_kind, _intent, _packet) {
      return { reply: '(non-injury stub)', mutated: false };
    },
    // Stub: orchestration suite predates constraint resolution.
    applyConstraintResolution(_ids, _todayISO) {
      return { cleared: [] };
    },
  };
}

// ─── Harness ───
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
// Test 1 — New injury current + future
// ─────────────────────────────────────────────────────────────────────
section('[1] New injury → activeInjury + visible current + future filtered');
{
  resetAll();
  baseWeekDef = {
    3: wk('Recovery Session', 3, { workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] }),
    4: wk('Team Training', 4, { workoutType: 'Team Training' }),
    5: wk('Lower Strength', 5, { exercises: [ex('RDLs'), ex('Goblet Squat')] }),
  };
  const deps = makeDeps();

  // Step 1 — clarifier turn ("hammy cooked", no severity).
  const packetA = buildCoachContextPacket({
    userMessage: 'hammy cooked',
    recentMessages: [],
    todayISO: FIXED_TODAY,
  });
  const intentA: CoachIntent = {
    intent: 'new_injury_report', confidence: 0.93, needsClarification: true,
    clarificationQuestion: 'How bad is it? Rough pain out of 10.',
    payload: { bodyPart: 'hammy' },
  };
  captureLogs();
  const outA = dispatchCoachIntent(intentA, packetA, deps);
  restoreLogs();
  ok('clarifier handled', outA.handled);
  eq('clarifier mode', outA.replyMode, 'severity_clarifier');
  ok('asks "How bad is it"', /how bad is it/i.test(outA.reply));

  // Step 2 — severity reply ("6/10").
  const packetB = buildCoachContextPacket({
    userMessage: '6/10',
    recentMessages: [
      { role: 'user', content: 'hammy cooked' },
      { role: 'assistant', content: 'How bad is it? Rough pain out of 10.' },
    ],
    todayISO: FIXED_TODAY,
  });
  const intentB: CoachIntent = {
    intent: 'injury_severity_reply', confidence: 0.96, needsClarification: false,
    payload: { bodyPart: 'hammy', severity: 6 },
  };
  captureLogs();
  const outB = dispatchCoachIntent(intentB, packetB, deps);
  restoreLogs();
  ok('severity reply handled', outB.handled);
  ok('mutated', outB.mutated);

  // Assertions: activeInjury set, current week visibly changed, future week filtered.
  const inj = useCoachUpdatesStore.getState().activeInjury;
  ok('activeInjury set', inj?.bodyPart === 'hammy' && inj?.severity === 6);
  ok('rules stored', (inj?.rules ?? []).some((r) => /sprinting/i.test(r)));
  ok('startDate stored', !!inj?.startDate);

  const friOverride = useProgramStore.getState().dateOverrides['2026-05-01'];
  ok('current Fri override written', !!friOverride);
  ok(
    'current Fri RDLs gone',
    !friOverride?.exercises.some((e: any) => e.exercise?.name === 'RDLs'),
  );

  // Future week (no override) reflects activeInjury via resolver filter.
  const nextMonday = addDaysISO(FIXED_MONDAY, 7);
  const nextWeek = (sessionResolver as any).resolveWeekWithConditioning(nextMonday, buildState());
  const nextFri = nextWeek.find((d: any) => d.dayOfWeek === 5);
  ok(
    'next-week Fri RDLs filtered (no override)',
    !nextFri?.workout?.exercises.some((e: any) => e.exercise?.name === 'RDLs'),
  );
  ok(
    'next-week Fri carries coachNotes',
    (nextFri?.workout?.coachNotes ?? []).length > 0,
  );

  // Coach Update card present.
  const card = useCoachUpdatesStore.getState().updatesByWeek[FIXED_MONDAY];
  ok('Coach Update card written', card?.active === true);
}

// ─────────────────────────────────────────────────────────────────────
// Test 2 — "I already told you"
// ─────────────────────────────────────────────────────────────────────
section('[2] activeInjury + "I already told you" → no severity question');
{
  resetAll();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('RDLs')] }) };
  // Pre-set activeInjury.
  const nowISO = new Date().toISOString();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'hammy', bucket: 'hamstring' as any, severity: 6, initialSeverity: 6,
    status: 'active', rules: ['No sprinting or high-speed running'],
    startDate: nowISO, createdAt: nowISO, lastUpdatedAt: nowISO, history: [],
  });

  const deps = makeDeps();
  const packet = buildCoachContextPacket({
    userMessage: 'I already told you how bad it was',
    recentMessages: [],
    todayISO: FIXED_TODAY,
  });
  // The LLM correctly classifies as active_injury_followup.
  const intent: CoachIntent = {
    intent: 'active_injury_followup', confidence: 0.94, needsClarification: false,
  };
  captureLogs();
  const out = dispatchCoachIntent(intent, packet, deps);
  restoreLogs();
  ok('handled by progression', out.replyMode === 'progression');
  ok('does NOT ask severity', !/how bad is it/i.test(out.reply));
  ok(
    'acknowledges existing severity',
    /6\/10|hammy/i.test(out.reply),
  );

  // Even if LLM mis-classifies as new_injury_report with same body part
  // and needsClarification=true, dispatcher MUST suppress.
  const intentMisclass: CoachIntent = {
    intent: 'new_injury_report', confidence: 0.5, needsClarification: true,
    clarificationQuestion: 'How bad is it? Rough pain out of 10.',
    payload: { bodyPart: 'hammy' },
  };
  captureLogs();
  const outMis = dispatchCoachIntent(intentMisclass, packet, deps);
  restoreLogs();
  ok('clarifier suppressed on activeInjury+sameBodyPart', outMis.replyMode === 'progression');
  ok('logs suppressed_clarifier', loggedAny('suppressed_clarifier'));
}

// ─────────────────────────────────────────────────────────────────────
// Test 3 — "Why didn't Monday change?" past-date
// ─────────────────────────────────────────────────────────────────────
section('[3] "Why didn\'t Monday change?" past-date → state inspector');
{
  resetAll();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('RDLs')] }) };
  const nowISO = new Date().toISOString();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'hammy', bucket: 'hamstring' as any, severity: 6, initialSeverity: 6,
    status: 'active', rules: ['No sprinting'], startDate: nowISO, createdAt: nowISO,
    lastUpdatedAt: nowISO, history: [],
  });

  const deps = makeDeps();
  const packet = buildCoachContextPacket({
    userMessage: "why didn't Monday change?",
    recentMessages: [],
    todayISO: FIXED_TODAY,
  });
  const intent: CoachIntent = {
    intent: 'why_didnt_program_change', confidence: 0.92, needsClarification: false,
    payload: { requestedDate: '2026-04-27' }, // Mon — past
  };
  captureLogs();
  const out = dispatchCoachIntent(intent, packet, deps);
  restoreLogs();
  eq('routed via state_inspector', out.replyMode, 'state_inspector');
  ok('mentions past', /past|already/i.test(out.reply));
  ok('does NOT ask severity', !/how bad is it/i.test(out.reply));
  ok('logs explanation_path', loggedAny('explanation_path'));
}

// ─────────────────────────────────────────────────────────────────────
// Test 4 — "Why are deadlifts still there next week?"
// ─────────────────────────────────────────────────────────────────────
section('[4] "Deadlifts still there next week?" → re-apply');
{
  resetAll();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('Deadlift'), ex('Goblet Squat')] }) };
  const nowISO = new Date().toISOString();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'hammy', bucket: 'hamstring' as any, severity: 6, initialSeverity: 6,
    status: 'active', rules: ['No sprinting'], startDate: nowISO, createdAt: nowISO,
    lastUpdatedAt: nowISO, history: [],
  });

  const deps = makeDeps();
  const packet = buildCoachContextPacket({
    userMessage: 'why are deadlifts still there next week?',
    recentMessages: [],
    todayISO: FIXED_TODAY,
  });
  // Looking up in NEXT week's resolved view — but the resolver filter
  // already removes Deadlift for hammy/hamstring. So the inspector
  // returns 'exercise_already_removed' (good signal — system is sound).
  // The test asserts the inspector path runs and references real state,
  // not that we always re-apply.
  const intent: CoachIntent = {
    intent: 'why_didnt_program_change', confidence: 0.94, needsClarification: false,
    payload: {
      requestedSession: 'Lower Strength',
      requestedDate: '2026-05-08', // Fri next week
      concern: 'deadlifts still there',
    } as any,
  };
  // Push exerciseName via concern parser.
  (intent.payload as any).exerciseName = 'Deadlift';
  captureLogs();
  const out = dispatchCoachIntent(intent, packet, deps);
  restoreLogs();
  ok('inspector handled', out.handled);
  ok(
    'reply references actual state (Deadlift / Lower Strength / no longer present)',
    /deadlift|Lower Strength|already|no longer/i.test(out.reply),
  );
  ok('does NOT ask severity', !/how bad is it/i.test(out.reply));
}

// ─────────────────────────────────────────────────────────────────────
// Test 5 — Resolved injury
// ─────────────────────────────────────────────────────────────────────
section('[5] "pain is gone" → activeInjury cleared, future filter stops');
{
  resetAll();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('RDLs')] }) };
  const nowISO = new Date().toISOString();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'hammy', bucket: 'hamstring' as any, severity: 6, initialSeverity: 6,
    status: 'active', rules: ['No sprinting'], startDate: nowISO, createdAt: nowISO,
    lastUpdatedAt: nowISO, history: [],
  });
  // Seed a current-week override.
  const deps = makeDeps();
  deps.runUAEForInjury('hammy', 6, 'seed');
  ok('pre-resolve: override exists', Object.keys(useProgramStore.getState().dateOverrides).length > 0);

  const packet = buildCoachContextPacket({
    userMessage: 'pain is gone',
    recentMessages: [],
    todayISO: FIXED_TODAY,
  });
  const intent: CoachIntent = {
    intent: 'active_injury_followup', confidence: 0.97, needsClarification: false,
    payload: { followupKind: 'resolved' },
  };
  captureLogs();
  const out = dispatchCoachIntent(intent, packet, deps);
  restoreLogs();
  ok('handled', out.handled);
  ok('mutated (cleared overrides)', out.mutated);

  // activeInjury cleared.
  ok('activeInjury cleared', useCoachUpdatesStore.getState().activeInjury == null);
  // Overrides cleared.
  eq('overrides cleared', Object.keys(useProgramStore.getState().dateOverrides).length, 0);
  // Future week — resolver filter stops applying.
  const nextMonday = addDaysISO(FIXED_MONDAY, 7);
  const nextWeek = (sessionResolver as any).resolveWeekWithConditioning(nextMonday, buildState());
  const nextFri = nextWeek.find((d: any) => d.dayOfWeek === 5);
  ok(
    'next-week Fri: RDLs back (no filter)',
    nextFri?.workout?.exercises.some((e: any) => e.exercise?.name === 'RDLs'),
  );
}

// ─────────────────────────────────────────────────────────────────────
// Test 6 — Different new injury
// ─────────────────────────────────────────────────────────────────────
section('[6] activeInjury hammy + "my shoulder hurts" → new injury possible');
{
  resetAll();
  baseWeekDef = { 5: wk('Lower Strength', 5, { exercises: [ex('RDLs')] }) };
  const nowISO = new Date().toISOString();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'hammy', bucket: 'hamstring' as any, severity: 6, initialSeverity: 6,
    status: 'active', rules: ['No sprinting'], startDate: nowISO, createdAt: nowISO,
    lastUpdatedAt: nowISO, history: [],
  });

  const deps = makeDeps();
  const packet = buildCoachContextPacket({
    userMessage: 'my shoulder hurts',
    recentMessages: [],
    todayISO: FIXED_TODAY,
  });
  // LLM correctly identifies as new injury (different body part).
  const intent: CoachIntent = {
    intent: 'new_injury_report', confidence: 0.86, needsClarification: true,
    clarificationQuestion: 'How bad is the shoulder pain (1-10)?',
    payload: { bodyPart: 'shoulder' },
  };
  captureLogs();
  const out = dispatchCoachIntent(intent, packet, deps);
  restoreLogs();
  // Different body part → clarifier NOT suppressed.
  eq('clarifier mode', out.replyMode, 'severity_clarifier');
  ok('asks shoulder severity', /shoulder|how bad/i.test(out.reply));
}

// ─────────────────────────────────────────────────────────────────────
// Test 7 — "Should I train today?"
// ─────────────────────────────────────────────────────────────────────
section('[7] "Should I train today?" → state-grounded answer');
{
  resetAll();
  baseWeekDef = {
    3: wk('Lower Strength', 3, { exercises: [ex('RDLs')] }), // Wed = today
  };
  const nowISO = new Date().toISOString();
  useCoachUpdatesStore.getState().setActiveInjury({
    bodyPart: 'hammy', bucket: 'hamstring' as any, severity: 6, initialSeverity: 6,
    status: 'active', rules: ['No sprinting or high-speed running'],
    startDate: nowISO, createdAt: nowISO, lastUpdatedAt: nowISO, history: [],
  });
  const deps = makeDeps();
  const packet = buildCoachContextPacket({
    userMessage: 'should I train today?',
    recentMessages: [],
    todayISO: FIXED_TODAY,
  });
  const intent: CoachIntent = {
    intent: 'general_question', confidence: 0.86, needsClarification: false,
    payload: { concern: 'whether to train today' } as any,
  };
  captureLogs();
  const out = dispatchCoachIntent(intent, packet, deps);
  restoreLogs();
  ok('handled', out.handled);
  ok('does NOT ask severity', !/how bad is it/i.test(out.reply));
  ok('not mutated', !out.mutated);
  ok(
    'reply mentions hammy + severity + rule',
    /hammy/i.test(out.reply) && /6\/10/.test(out.reply) && /sprinting/i.test(out.reply),
  );
}

// ─── Summary ───
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
