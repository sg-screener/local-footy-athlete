/**
 * coachLivePathV2IntegrationTests — proves the canonical V2 readiness path:
 *
 *   coach message
 *   → LLMCoachIntentClassifier (real)
 *   → dispatchCoachIntent (real)
 *   → source_fact_transaction_required boundary
 *   → transactTemporarySourceFact (real accepted-state transaction)
 *   → useCoachUpdatesStore.activeConstraints[] (real)
 *   → projectAndLog with extraConstraints from buildExtraConstraints
 *     (matches useResolvedDay/useResolvedWeek behaviour)
 *   → workout.coachNotes (consumed by HomeScreenV2 + DayWorkoutScreenV2)
 *   → buildWeeklyCoachUpdateFromConstraints
 *     (consumed by HomeScreenV2's CoachUpdateCard via useHomeScreen)
 *
 * Strategy: stub the resolver + getMondayStr so each scenario runs against
 * a deterministic week. Mock global fetch so /coach-intent returns the
 * scripted intent for the scenario under test. Prove the legacy compatibility
 * dispatcher cannot publish readiness mirrors upstream, then commit the
 * classified fact through the canonical transaction. After acceptance, mirror the
 * useResolvedDay / useResolvedWeek projection — buildExtraConstraints +
 * projectAndLog — and assert:
 *
 *   1. activeConstraints[] has the typed entry the producer should have
 *      written.
 *   2. The visible-day workout (DayWorkoutScreenV2 surface) carries
 *      coachNotes derived from the constraint (Removed / Caution / Focus).
 *   3. The visible-week workouts (HomeScreenV2 surface) carry the same.
 *   4. buildWeeklyCoachUpdateFromConstraints({ activeConstraints,
 *      visibleWeek, baselineWeek }) produces the expected card fields:
 *      activeIssues, avoid, substituteWith, keep, advice, ctaPrefill.
 *
 * Any wiring break — useSchedule lacks the constraint subscription, the
 * projection ignores extraConstraints, the producer doesn't write the
 * store, the card derivation drops a constraint — fails this test.
 *
 * Run: npm run test:coach-live-path-v2
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const realLog = console.log;
const realWarn = console.warn;

// ─── Resolver stub ─────────────────────────────────────────────────────
import * as sessionResolver from '../utils/sessionResolver';
import type { ResolvedDay } from '../utils/sessionResolver';

const FIXED_TODAY = '2026-04-29'; // Wed
const FIXED_MONDAY = '2026-04-27';
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

let baseWeekDef: Record<number, any> = {};
(sessionResolver as any).resolveWeekWithConditioning = (
  monday: string,
  _state: any,
): ResolvedDay[] => {
  const out: ResolvedDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(monday, i);
    const dow = isoToDow(date);
    const wkDef = baseWeekDef[dow] ?? null;
    out.push({
      date,
      dayOfWeek: dow,
      short: SHORT[dow],
      isToday: date === FIXED_TODAY,
      workout: wkDef,
      source: wkDef ? 'template' : 'rest',
      indicator: null,
    } as any);
  }
  return out;
};
(sessionResolver as any).resolveDateWithConditioning = (date: string, state: any): ResolvedDay => {
  const monday = FIXED_MONDAY;
  const week = (sessionResolver as any).resolveWeekWithConditioning(monday, state);
  return week.find((d: ResolvedDay) => d.date === date) ?? week[0];
};
(sessionResolver as any).getMondayStr = () => FIXED_MONDAY;
(sessionResolver as any).addDays = (iso: string, n: number) => addDaysISO(iso, n);

// ─── Stores + production wiring ───────────────────────────────────────
import { useProgramStore } from '../store/programStore';
import { createEmptyAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import {
  useCoachUpdatesStore,
  type ActiveConstraint,
  type ActiveSorenessConstraint,
  type ActiveFatigueConstraint,
  type ActiveScheduleConstraint,
} from '../store/coachUpdatesStore';
import { LLMCoachIntentClassifier } from '../utils/llmCoachIntentClassifier';
import { dispatchCoachIntent } from '../utils/coachIntentDispatcher';
import { buildLiveDispatchDeps } from '../utils/coachDispatchDeps';
import { buildCoachContextPacket } from '../utils/coachContextPacket';
import { projectAndLog } from '../utils/visibleProgramProjection';
import {
  buildFatigueConstraint,
  buildSorenessConstraint,
  buildScheduleConstraint,
  buildMissedSessionConstraint,
} from '../utils/exposureEngine';
import { bucketToRegion } from '../utils/coachConstraintProducers';
import { buildWeeklyCoachUpdateFromConstraints } from '../utils/weeklyCoachUpdate';
import {
  createTemporaryFatigueFact,
  createTemporaryScheduleFact,
  createTemporarySorenessFact,
  temporaryFactScope,
} from '../rules/temporarySourceFact';
import { transactTemporarySourceFact } from '../store/temporarySourceFactTransaction';
import type { CoachIntent } from '../utils/coachIntent';
import type { Workout } from '../types/domain';

// ─── Workout fixture builders ─────────────────────────────────────────
function ex(name: string, opts: any = {}): any {
  return {
    id: `we-${name}`,
    workoutId: 'wk',
    exerciseId: `ex-${name}`,
    exerciseOrder: opts.order ?? 0,
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
function wk(name: string, dow: number, opts: any = {}): any {
  return {
    id: `w-${dow}`,
    microcycleId: 'mc',
    dayOfWeek: dow,
    name,
    description: '',
    durationMinutes: 60,
    intensity: 'Moderate',
    workoutType: opts.workoutType || 'Strength',
    sessionTier: opts.sessionTier || 'core',
    exercises: opts.exercises || [],
    coachNotes: opts.coachNotes ?? [],
    createdAt: '',
    updatedAt: '',
  };
}
function resetAll() {
  useProgramStore.setState({
    currentProgram: null,
    currentMicrocycle: null,
    todayWorkout: null,
    blockState: null,
    acceptedMaterialContext: {
      ...createEmptyAcceptedMaterialContext(),
      revision: 1,
      lastTransaction: 'coach-live-path-v2:test-seed',
    },
    dateOverrides: {},
    overrideContexts: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
  } as any);
  useCoachUpdatesStore.setState({
    updatesByWeek: {},
    activeInjury: null,
    activeConstraints: [],
    dismissedCoachNoteIds: [],
  });
}

async function commitFatigue(level: number, factId?: string): Promise<string> {
  const fact = createTemporaryFatigueFact({
    observedDate: FIXED_TODAY,
    scope: temporaryFactScope({ kind: 'week', date: FIXED_TODAY }),
    athleteReportedLevel: level,
    sourceSurface: 'coach_chat',
    factId,
    now: '2026-04-29T10:00:00.000Z',
  });
  const result = await transactTemporarySourceFact({
    operation: 'create',
    fact,
    todayISO: FIXED_TODAY,
    now: '2026-04-29T10:00:00.000Z',
  });
  ok('canonical fatigue transaction accepted', result.outcome.startsWith('created_'), result.outcome);
  return fact.factId;
}

async function commitSoreness(args: {
  level: number;
  bodyPart: string;
  bucket: 'knee' | 'hamstring' | 'calf' | 'shoulder';
  factId?: string;
}): Promise<string> {
  const fact = createTemporarySorenessFact({
    observedDate: FIXED_TODAY,
    scope: temporaryFactScope({ kind: 'week', date: FIXED_TODAY }),
    athleteReportedLevel: args.level,
    distribution: 'localized',
    reportedBodyPartLanguage: args.bodyPart,
    canonicalBodyPartBucket: args.bucket,
    sourceSurface: 'coach_chat',
    factId: args.factId,
    now: '2026-04-29T10:00:00.000Z',
  });
  const result = await transactTemporarySourceFact({
    operation: 'create',
    fact,
    todayISO: FIXED_TODAY,
    now: '2026-04-29T10:00:00.000Z',
  });
  ok('canonical soreness transaction accepted', result.outcome.startsWith('created_'), result.outcome);
  return fact.factId;
}

async function commitBusyWeek(factId?: string): Promise<string> {
  const fact = createTemporaryScheduleFact({
    observedDate: FIXED_TODAY,
    scope: temporaryFactScope({ kind: 'week', date: FIXED_TODAY }),
    scheduleKind: 'busy_week',
    sourceActor: 'coach',
    sourceSurface: 'coach_chat',
    factId,
    now: '2026-04-29T10:00:00.000Z',
  });
  const result = await transactTemporarySourceFact({
    operation: 'create',
    fact,
    todayISO: FIXED_TODAY,
    now: '2026-04-29T10:00:00.000Z',
  });
  ok(
    'canonical busy-week transaction accepted',
    result.outcome.startsWith('created_'),
    result.outcome,
  );
  return fact.factId;
}

// ─── Mock fetch ────────────────────────────────────────────────────────
let coachIntentCalls = 0;
let coachChatCalls = 0;
let scriptedIntent: CoachIntent | null = null;

function makeFetch(): typeof fetch {
  return ((url: any, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/coach-intent')) {
      coachIntentCalls += 1;
      const body = JSON.parse((init?.body as any) || '{}');
      if (!body.packet || !body.message) {
        return Promise.resolve({
          ok: false,
          status: 400,
          headers: new Headers(),
          json: async () => ({ error: 'bad' }),
          text: async () => 'bad',
        } as unknown as Response);
      }
      const intent = scriptedIntent ?? {
        intent: 'general_question' as any,
        confidence: 0.5,
        needsClarification: false,
      };
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => intent,
        text: async () => JSON.stringify(intent),
      } as unknown as Response);
    }
    if (u.includes('/coach-chat')) {
      coachChatCalls += 1;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ message: '(legacy reply)' }),
        text: async () => '{}',
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

// ─── Live dispatch — mirrors the non-injury path of CoachScreen.handleSend ──
async function liveDispatchNonInjury(
  userMessage: string,
  classifier: LLMCoachIntentClassifier,
): Promise<{ handled: boolean; reply: string; mutated: boolean; replyMode: string }> {
  const todayISO = FIXED_TODAY;
  const packet = buildCoachContextPacket({
    turnId: 'coach-live-path-turn-1',
    userMessage,
    recentMessages: [],
    todayISO,
  });
  const classification = await classifier.classify(packet);
  if (classification.status === 'unavailable') {
    return { handled: true, reply: '(classification unavailable)', mutated: false, replyMode: 'safe_fallback' };
  }
  const intent = classification.intent;
  const deps = buildLiveDispatchDeps(todayISO);
  const outcome = await dispatchCoachIntent(intent, packet, deps, classification);
  return {
    handled: outcome.handled,
    reply: outcome.reply,
    mutated: outcome.mutated,
    replyMode: outcome.replyMode,
  };
}

// ─── Mirrors useSchedule.buildExtraConstraints ─────────────────────────
function buildExtraConstraints(activeConstraints: ActiveConstraint[]): any[] {
  if (!Array.isArray(activeConstraints) || activeConstraints.length === 0) return [];
  const out: any[] = [];
  for (const c of activeConstraints) {
    if (!c || c.status === 'resolved') continue;
    if (c.type === 'fatigue') {
      out.push(buildFatigueConstraint({ id: c.id, severity: c.severity, startDate: c.startDate }));
    } else if (c.type === 'soreness' && c.bucket) {
      out.push(
        buildSorenessConstraint({
          id: c.id,
          region: bucketToRegion(c.bucket),
          severity: c.severity,
          startDate: c.startDate,
        }),
      );
    } else if (c.type === 'schedule') {
      out.push(buildScheduleConstraint({ id: c.id, severity: c.severity, startDate: c.startDate }));
    } else if (c.type === 'missed_session') {
      out.push(
        buildMissedSessionConstraint({
          id: c.id,
          missedDate: c.missedDate,
          sessionName: c.sessionName,
          startDate: c.startDate,
        }),
      );
    }
  }
  return out;
}

// ─── Mirrors useResolvedWeek's render-time projection ─────────────────
function projectVisibleWeek(rawWeek: ResolvedDay[]): ResolvedDay[] {
  const activeConstraints = useCoachUpdatesStore.getState().activeConstraints ?? [];
  const activeInjury = useCoachUpdatesStore.getState().activeInjury;
  const extraConstraints = buildExtraConstraints(activeConstraints as any);
  return rawWeek.map((d) =>
    projectAndLog({
      day: d,
      activeInjury: activeInjury as any,
      extraConstraints,
      todayISO: FIXED_TODAY,
      surface: 'home',
    }),
  );
}
// Mirrors useResolvedDay
function projectVisibleDayForUI(date: string): ResolvedDay {
  const week = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, {});
  const raw = week.find((d: ResolvedDay) => d.date === date);
  const activeConstraints = useCoachUpdatesStore.getState().activeConstraints ?? [];
  const activeInjury = useCoachUpdatesStore.getState().activeInjury;
  const extraConstraints = buildExtraConstraints(activeConstraints as any);
  return projectAndLog({
    day: raw,
    activeInjury: activeInjury as any,
    extraConstraints,
    todayISO: FIXED_TODAY,
    surface: 'detail',
  });
}

// ─── Harness ──────────────────────────────────────────────────────────
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
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) {
  realLog(`\n${label}`);
}

// Helper: extract exercise names from a workout
function exNames(w: Workout | null | undefined): string[] {
  if (!w?.exercises) return [];
  return (w.exercises as any[]).map((e) => e.exercise?.name ?? '').filter(Boolean);
}

// Set the global fetch ONCE — LLMCoachIntentClassifier reads it at construct.
(global as any).fetch = makeFetch();
const classifier = new LLMCoachIntentClassifier({
  endpoint: 'https://x.supabase.co/functions/v1/coach-intent',
  authToken: 'anon-key',
  fetcher: (global as any).fetch,
});

(async () => {
  // Both persisted stores auto-hydrate on import. Settle those merges before
  // the first reset so a late hydration cannot overwrite scenario-one state.
  await Promise.all([
    useProgramStore.persist.rehydrate(),
    useCoachUpdatesStore.persist.rehydrate(),
  ]);

  // ─────────────────────────────────────────────────────────────────────
  // [1] Fatigue 7/10 → canonical fact, mirrors, coachNotes, card fields
  // ─────────────────────────────────────────────────────────────────────
  section('[1] fatigue 7/10 → full V2 chain populated');
  {
    resetAll();
    resetFetchSpy();
    // Wed = high-load Strength session containing max-effort cues
    baseWeekDef = {
      3: wk('Lower Strength', 3, {
        exercises: [
          ex('Trap Bar Deadlift', { order: 0 }),
          ex('Walking Lunge', { order: 1 }),
          ex('Hanging Leg Raise', { order: 2 }),
        ],
      }),
      5: wk('Sprint + Plyo', 5, {
        workoutType: 'Conditioning',
        exercises: [ex('Flying 30m Sprints', { order: 0 }), ex('Box Jumps', { order: 1 })],
      }),
    };
    scriptedIntent = {
      intent: 'fatigue' as any,
      confidence: 0.92,
      needsClarification: false,
      payload: { severity: 7 },
    } as any;

    const result = await liveDispatchNonInjury("I'm absolutely cooked this week", classifier);

    ok('dispatcher handled', result.handled);
    eq('replyMode requires canonical source-fact transaction', result.replyMode, 'source_fact_transaction_required');
    eq('legacy dispatcher does not mutate readiness mirrors', result.mutated, false);
    ok('legacy /coach-chat NOT called', coachChatCalls === 0);
    await commitFatigue(7);

    // 1. accepted transaction publishes the downstream typed fatigue mirror
    const constraints = useCoachUpdatesStore.getState().activeConstraints;
    const fatigue = constraints.find((c) => c.type === 'fatigue') as ActiveFatigueConstraint;
    ok('activeConstraints contains fatigue entry', !!fatigue);
    if (fatigue) {
      eq('fatigue.severity = 7', fatigue.severity, 7);
      eq('fatigue.status = active', fatigue.status, 'active');
      ok('fatigue mirror names its canonical fact owner', fatigue.temporarySourceFactIds?.length === 1);
    }

    // 2. Visible week (HomeScreenV2 surface) reflects fatigue mutation
    const rawWeek = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, {});
    const visibleWeek = projectVisibleWeek(rawWeek);
    const friDay = visibleWeek.find((d) => d.dayOfWeek === 5);
    ok('Fri day exists in visible week', !!friDay);
    ok('Fri Sprint+Plyo collapses to Rest after all training content is removed', !friDay?.workout);
    eq('Fri collapsed source = rest', friDay?.source, 'rest' as any);

    // 3. Visible day (DayWorkoutScreenV2 surface) — Wed Lower Strength carries notes
    const wedDay = projectVisibleDayForUI(FIXED_TODAY);
    ok('Wed visible workout exists', !!wedDay?.workout);
    if (wedDay?.workout) {
      ok(
        'Wed coachNotes mention Focus (safe focus from fatigue)',
        wedDay.workout.coachNotes?.some((n) => /Focus:/i.test(n)) ?? false,
        `notes=${JSON.stringify(wedDay.workout.coachNotes)}`,
      );
    }

    // 4. CoachUpdate card derivation
    const baselineWeek = rawWeek;
    const card = buildWeeklyCoachUpdateFromConstraints({
      weekStartISO: FIXED_MONDAY,
      visibleWeek,
      baselineWeek,
      activeConstraints: constraints as any,
    });
    ok('card derived (non-null)', !!card);
    if (card) {
      ok(
        'card.activeIssues mentions Fatigue 7/10',
        card.activeIssues.some((i) => /Fatigue/i.test(i) && /7/.test(i)),
        `activeIssues=${JSON.stringify(card.activeIssues)}`,
      );
      ok(
        'card.avoid is non-empty (fatigue blocks max-effort etc.)',
        card.avoid.length > 0,
        `avoid=${JSON.stringify(card.avoid)}`,
      );
      ok(
        'card.keep mentions easy aerobic / recovery',
        card.keep.some((k) => /aerobic|recovery|easy/i.test(k)),
        `keep=${JSON.stringify(card.keep)}`,
      );
      eq('card.ctaPrefill is fatigue prefill', card.ctaPrefill, 'Update on how I’m feeling: ');
      ok(
        'card.sessionsChanged includes Fri',
        card.sessionsChanged.some((s) => /Fri/.test(s)),
        `sessionsChanged=${JSON.stringify(card.sessionsChanged)}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // [2] Soreness quads 6/10 → bucket=knee, regional limits, card fields
  // ─────────────────────────────────────────────────────────────────────
  section('[2] soreness quads 6/10 → knee bucket reaches V2 surfaces');
  {
    resetAll();
    resetFetchSpy();
    baseWeekDef = {
      3: wk('Lower Strength', 3, {
        exercises: [
          ex('Back Squat', { order: 0 }),
          ex('Trap Bar Deadlift', { order: 1 }),
          ex('Bench Press', { order: 2 }),
        ],
      }),
    };
    scriptedIntent = {
      intent: 'soreness' as any,
      confidence: 0.9,
      needsClarification: false,
      payload: { bodyPart: 'quads', severity: 6 },
    } as any;

    const result = await liveDispatchNonInjury('quads are toast', classifier);
    eq('replyMode requires canonical source-fact transaction', result.replyMode, 'source_fact_transaction_required');
    eq('legacy dispatcher does not mutate readiness mirrors', result.mutated, false);
    await commitSoreness({ level: 6, bodyPart: 'quads', bucket: 'knee' });

    const constraints = useCoachUpdatesStore.getState().activeConstraints;
    const sore = constraints.find((c) => c.type === 'soreness') as ActiveSorenessConstraint;
    ok('soreness constraint persisted', !!sore);
    if (sore) {
      eq('soreness.bucket = knee', sore.bucket, 'knee');
      eq('soreness.bodyPart = quads', sore.bodyPart, 'quads');
      eq('soreness.severity = 6', sore.severity, 6);
      ok('soreness mirror names its canonical fact owner', sore.temporarySourceFactIds?.length === 1);
    }

    const rawWeek = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, {});
    const visibleWeek = projectVisibleWeek(rawWeek);
    const wed = visibleWeek.find((d) => d.dayOfWeek === 3);
    ok('Wed projected workout present', !!wed?.workout);
    if (wed?.workout) {
      // Bench Press is upper body — should remain (not in knee region).
      const names = exNames(wed.workout);
      ok(
        'Bench Press kept (upper body unaffected by knee soreness)',
        names.includes('Bench Press'),
        `names=${JSON.stringify(names)}`,
      );
      ok(
        'coachNotes carry Focus tags from constraint safeFocus',
        wed.workout.coachNotes?.some((n) => /Focus:/i.test(n)) ?? false,
      );
    }

    const card = buildWeeklyCoachUpdateFromConstraints({
      weekStartISO: FIXED_MONDAY,
      visibleWeek,
      baselineWeek: rawWeek,
      activeConstraints: constraints as any,
    });
    ok('card derived', !!card);
    if (card) {
      ok(
        'card.activeIssues mentions quads soreness 6/10',
        card.activeIssues.some((i) => /quads/i.test(i) && /soreness/i.test(i) && /6/.test(i)),
        `activeIssues=${JSON.stringify(card.activeIssues)}`,
      );
      eq(
        'card.ctaPrefill threads quads body part',
        card.ctaPrefill,
        'Update on my quads soreness: ',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // [3] Busy week → canonical schedule fact reaches V2 surfaces
  // ─────────────────────────────────────────────────────────────────────
  section('[3] busy_week → canonical schedule fact reaches V2 surfaces');
  {
    resetAll();
    resetFetchSpy();
    baseWeekDef = {
      3: wk('Lower Strength', 3, {
        exercises: [
          ex('Trap Bar Deadlift', { order: 0 }),
          ex('Walking Lunge', { order: 1 }),
        ],
      }),
    };
    scriptedIntent = {
      intent: 'busy_week' as any,
      confidence: 0.91,
      needsClarification: false,
      payload: { severity: 7 },
    } as any;

    const result = await liveDispatchNonInjury('crazy week, packed schedule', classifier);
    eq('replyMode requires canonical source-fact transaction',
      result.replyMode, 'source_fact_transaction_required');
    ok('legacy dispatcher does not mutate schedule mirrors', !result.mutated);

    const factId = await commitBusyWeek();

    const constraints = useCoachUpdatesStore.getState().activeConstraints;
    const sched = constraints.find((c) => c.type === 'schedule') as ActiveScheduleConstraint;
    ok('schedule constraint persisted', !!sched);
    if (sched) {
      eq('schedule.severity = canonical busy-week level', sched.severity, 5);
      eq('schedule mirror names its canonical fact owner',
        sched.temporarySourceFactIds?.[0], factId);
    }

    const rawWeek = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, {});
    const visibleWeek = projectVisibleWeek(rawWeek);
    const card = buildWeeklyCoachUpdateFromConstraints({
      weekStartISO: FIXED_MONDAY,
      visibleWeek,
      baselineWeek: rawWeek,
      activeConstraints: constraints as any,
    });
    ok('card derived', !!card);
    if (card) {
      ok(
        'card.activeIssues mentions canonical Busy week level',
        card.activeIssues.some((i) => /Busy week/i.test(i) && /5/.test(i)),
        `activeIssues=${JSON.stringify(card.activeIssues)}`,
      );
      eq('card.ctaPrefill is busy-week prefill', card.ctaPrefill, 'Update on my week: ');
      ok(
        'card.keep includes short / targeted',
        card.keep.some((k) => /short|targeted|skill/i.test(k)),
        `keep=${JSON.stringify(card.keep)}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // [4] Legacy missed-session dispatch is fenced from accepted state
  // ─────────────────────────────────────────────────────────────────────
  section('[4] legacy missed_session cannot recreate a constraint');
  {
    resetAll();
    resetFetchSpy();
    baseWeekDef = {
      2: wk('Lower Strength', 2, { exercises: [ex('Back Squat')] }),
    };
    scriptedIntent = {
      intent: 'missed_session' as any,
      confidence: 0.93,
      needsClarification: false,
      payload: { requestedDate: '2026-04-28', requestedSession: 'Tuesday Lower' },
    } as any;

    const result = await liveDispatchNonInjury("missed Tuesday's session", classifier);
    eq('replyMode requires canonical transaction', result.replyMode, 'session_outcome_transaction_required');
    eq('mutated = false (informational)', result.mutated, false);

    const constraints = useCoachUpdatesStore.getState().activeConstraints;
    ok('missed_session constraint not persisted', !constraints.some((c) => c.type === 'missed_session'));

    const rawWeek = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, {});
    const visibleWeek = projectVisibleWeek(rawWeek);
    const card = buildWeeklyCoachUpdateFromConstraints({
      weekStartISO: FIXED_MONDAY,
      visibleWeek,
      baselineWeek: rawWeek,
      activeConstraints: constraints as any,
    });
    ok('no Coach Note is derived from attendance feedback', !card);
  }

  // ─────────────────────────────────────────────────────────────────────
  // [5] Multi-constraint coexistence: fatigue + soreness compose
  // ─────────────────────────────────────────────────────────────────────
  section('[5] fatigue 6 + soreness quads 5 stack into one card + visible week');
  {
    resetAll();
    resetFetchSpy();
    baseWeekDef = {
      3: wk('Lower Strength', 3, {
        exercises: [ex('Back Squat', { order: 0 }), ex('Bench Press', { order: 1 })],
      }),
      5: wk('Sprint + Plyo', 5, {
        workoutType: 'Conditioning',
        exercises: [ex('Flying 30m Sprints')],
      }),
    };
    // First turn: fatigue
    scriptedIntent = {
      intent: 'fatigue' as any,
      confidence: 0.9,
      needsClarification: false,
      payload: { severity: 6 },
    } as any;
    const fatigueDispatch = await liveDispatchNonInjury('feeling cooked', classifier);
    eq('fatigue dispatch requires canonical transaction', fatigueDispatch.replyMode, 'source_fact_transaction_required');
    await commitFatigue(6);

    // Second turn: soreness quads 5
    scriptedIntent = {
      intent: 'soreness' as any,
      confidence: 0.9,
      needsClarification: false,
      payload: { bodyPart: 'quads', severity: 5 },
    } as any;
    const sorenessDispatch = await liveDispatchNonInjury('quads also tight', classifier);
    eq('soreness dispatch requires canonical transaction', sorenessDispatch.replyMode, 'source_fact_transaction_required');
    await commitSoreness({ level: 5, bodyPart: 'quads', bucket: 'knee' });

    const constraints = useCoachUpdatesStore.getState().activeConstraints;
    eq('two active constraints', constraints.length, 2);
    ok(
      'both fatigue and soreness present',
      constraints.some((c) => c.type === 'fatigue') &&
        constraints.some((c) => c.type === 'soreness'),
    );

    const rawWeek = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, {});
    const visibleWeek = projectVisibleWeek(rawWeek);

    // Sprint+Plyo Friday: fatigue limits sprint; severity 6 (moderate) → still kept
    // but with caution. We just assert the visible workout has SOME mutation
    // (coachNotes presence) — the precise decision matrix is exercised by
    // exposureEngineTests.
    const fri = visibleWeek.find((d) => d.dayOfWeek === 5);
    ok('Fri visible has coachNotes from constraints', (fri?.workout?.coachNotes?.length ?? 0) > 0);

    const card = buildWeeklyCoachUpdateFromConstraints({
      weekStartISO: FIXED_MONDAY,
      visibleWeek,
      baselineWeek: rawWeek,
      activeConstraints: constraints as any,
    });
    ok('card derived for multi-constraint', !!card);
    if (card) {
      eq('card carries 2 plans', card.plans.length, 2);
      ok(
        'card.activeIssues mentions both Fatigue and quads soreness',
        card.activeIssues.some((i) => /Fatigue/i.test(i)) &&
          card.activeIssues.some((i) => /quads/i.test(i)),
        `activeIssues=${JSON.stringify(card.activeIssues)}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // [6] Legacy seam cannot guess or publish an unresolvable soreness fact
  // ─────────────────────────────────────────────────────────────────────
  section('[6] soreness with unmapped body part → no readiness mirror');
  {
    resetAll();
    resetFetchSpy();
    baseWeekDef = { 3: wk('Lower Strength', 3, { exercises: [ex('Back Squat')] }) };
    scriptedIntent = {
      intent: 'soreness' as any,
      confidence: 0.85,
      needsClarification: false,
      payload: { bodyPart: 'unicorn', severity: 5 },
    } as any;

    const result = await liveDispatchNonInjury("I'm sore", classifier);
    eq('replyMode requires canonical source-fact transaction', result.replyMode, 'source_fact_transaction_required');
    eq('legacy seam does not claim a mutation', result.mutated, false);
    const constraints = useCoachUpdatesStore.getState().activeConstraints;
    eq('no constraint written', constraints.length, 0);
  }

  // ─────────────────────────────────────────────────────────────────────
  // [7] Resolved canonical fact disappears from card + projection
  // ─────────────────────────────────────────────────────────────────────
  section('[7] resolved canonical fatigue → projection no-op, card returns null');
  {
    resetAll();
    resetFetchSpy();
    baseWeekDef = { 5: wk('Sprint + Plyo', 5, { exercises: [ex('Flying 30m Sprints')] }) };
    scriptedIntent = {
      intent: 'fatigue' as any,
      confidence: 0.9,
      needsClarification: false,
      payload: { severity: 8 },
    } as any;
    const fatigueId = await commitFatigue(8);
    const idx = useCoachUpdatesStore.getState().activeConstraints.findIndex((c) => c.type === 'fatigue');
    ok('fatigue persisted', idx >= 0);
    const resolution = await transactTemporarySourceFact({
      operation: 'resolve',
      factId: fatigueId,
      todayISO: FIXED_TODAY,
      now: '2026-04-29T11:00:00.000Z',
    });
    ok('canonical fatigue resolution accepted', resolution.outcome.startsWith('resolved_'), resolution.outcome);

    const rawWeek = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, {});
    const visibleWeek = projectVisibleWeek(rawWeek);
    const fri = visibleWeek.find((d) => d.dayOfWeek === 5);
    const friNames = exNames(fri?.workout ?? null);
    ok('Sprint kept now that fatigue is resolved', friNames.includes('Flying 30m Sprints'), `names=${JSON.stringify(friNames)}`);
    const card = buildWeeklyCoachUpdateFromConstraints({
      weekStartISO: FIXED_MONDAY,
      visibleWeek,
      baselineWeek: rawWeek,
      activeConstraints: useCoachUpdatesStore.getState().activeConstraints as any,
    });
    eq('card returns null when no active constraints', card, null);
  }

  // ─────────────────────────────────────────────────────────────────────
  // [8] Canonical fatigue resolution preserves independent source facts
  // ─────────────────────────────────────────────────────────────────────
  section('[8] canonical fatigue resolution is surgical + Program card agrees');
  {
    resetAll();
    resetFetchSpy();
    baseWeekDef = { 5: wk('Sprint + Plyo', 5, { exercises: [ex('Flying 30m Sprints')] }) };

    const fatigueId = await commitFatigue(5);
    const afterFatigue = useCoachUpdatesStore.getState().activeConstraints;
    ok(
      'fatigue created by canonical transaction',
      afterFatigue.some((c) => c.type === 'fatigue' && c.status === 'active'),
    );

    const rawWeekWithFatigue = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, {});
    const visibleWeekWithFatigue = projectVisibleWeek(rawWeekWithFatigue);
    const fatigueCard = buildWeeklyCoachUpdateFromConstraints({
      weekStartISO: FIXED_MONDAY,
      visibleWeek: visibleWeekWithFatigue,
      baselineWeek: rawWeekWithFatigue,
      activeConstraints: afterFatigue as any,
    });
    ok(
      'Program card initially shows Fatigue — 5/10',
      !!fatigueCard && fatigueCard.activeIssues.includes('Fatigue — 5/10'),
      JSON.stringify(fatigueCard?.activeIssues ?? []),
    );

    // Add independent canonical facts to prove fatigue resolution is surgical.
    const calfId = await commitSoreness({
      level: 7,
      bodyPart: 'calves',
      bucket: 'calf',
      factId: 'coach-live-path:soreness:calf',
    });
    const shoulderId = await commitSoreness({
      level: 6,
      bodyPart: 'shoulder',
      bucket: 'shoulder',
      factId: 'coach-live-path:soreness:shoulder',
    });
    const resolution = await transactTemporarySourceFact({
      operation: 'resolve',
      factId: fatigueId,
      todayISO: FIXED_TODAY,
      now: '2026-04-29T11:00:00.000Z',
    });
    ok('fatigue resolution is accepted', resolution.outcome.startsWith('resolved_'), resolution.outcome);

    const afterResolution = useCoachUpdatesStore.getState().activeConstraints;
    ok(
      'fatigue removed from activeConstraints',
      !afterResolution.some((c) => c.type === 'fatigue'),
      JSON.stringify(afterResolution),
    );
    ok(
      'calves soreness remains active',
      afterResolution.some((c) => c.type === 'soreness' && (c as any).bodyPart === 'calves'),
    );
    ok(
      'shoulder soreness remains active',
      afterResolution.some((c) => c.type === 'soreness' && (c as any).bodyPart === 'shoulder'),
    );

    const rawWeekAfterResolution = (sessionResolver as any).resolveWeekWithConditioning(FIXED_MONDAY, {});
    const visibleWeekAfterResolution = projectVisibleWeek(rawWeekAfterResolution);
    const cardAfterResolution = buildWeeklyCoachUpdateFromConstraints({
      weekStartISO: FIXED_MONDAY,
      visibleWeek: visibleWeekAfterResolution,
      baselineWeek: rawWeekAfterResolution,
      activeConstraints: afterResolution as any,
    });
    ok(
      'Program card no longer shows Fatigue — 5/10',
      !cardAfterResolution?.activeIssues.some((issue) => /Fatigue\s+—\s+5\/10/i.test(issue)),
      JSON.stringify(cardAfterResolution?.activeIssues ?? []),
    );
    ok(
      'Program card still shows remaining soreness constraints',
      !!cardAfterResolution &&
        cardAfterResolution.activeIssues.some((issue) => /calves/i.test(issue)) &&
        cardAfterResolution.activeIssues.some((issue) => /shoulder/i.test(issue)),
      JSON.stringify(cardAfterResolution?.activeIssues ?? []),
    );

    // Now clear the other constraints too; with no active constraints,
    // HomeScreenV2's derived card path returns null immediately.
    await transactTemporarySourceFact({
      operation: 'resolve',
      factId: calfId,
      todayISO: FIXED_TODAY,
      now: '2026-04-29T11:05:00.000Z',
    });
    await transactTemporarySourceFact({
      operation: 'resolve',
      factId: shoulderId,
      todayISO: FIXED_TODAY,
      now: '2026-04-29T11:10:00.000Z',
    });
    const cardWithNoActiveConstraints = buildWeeklyCoachUpdateFromConstraints({
      weekStartISO: FIXED_MONDAY,
      visibleWeek: projectVisibleWeek(rawWeekAfterResolution),
      baselineWeek: rawWeekAfterResolution,
      activeConstraints: useCoachUpdatesStore.getState().activeConstraints as any,
    });
    eq('Program card disappears when no active constraints remain', cardWithNoActiveConstraints, null);
  }

  section('[9] fixture_change is owned before generic Coach paths');
  {
    resetAll();
    resetFetchSpy();
    scriptedIntent = {
      intent: 'fixture_change',
      confidence: 0.98,
      needsClarification: true,
      clarificationQuestion: 'What date do you want to add the fixture on?',
      payload: { action: 'add', missingFields: ['targetDate'] } as any,
    };
    const result = await liveDispatchNonInjury('add a game', classifier);
    ok('fixture_change handled by deterministic adapter',
      result.handled && result.replyMode === 'fixture_change', JSON.stringify(result));
    ok('fixture_change makes zero /coach-chat calls', coachChatCalls === 0);
    ok('fixture_change produces the typed clarification', /What date/.test(result.reply));
  }

  // ─── Summary ─────────────────────────────────────────────────────────
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
  console.log = realLog;
  console.warn = realWarn;
  console.error('test runner error:', err);
  process.exit(1);
});
