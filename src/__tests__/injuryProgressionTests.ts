/**
 * injuryProgressionTests — covers the follow-up classifier (pure)
 * AND the end-to-end progression flow that mirrors the CoachScreen
 * follow-up handler:
 *
 *    initial 6/10 → "better" → fewer overrides + improving status
 *    initial 6/10 → "pain gone" → all overrides cleared + card deactivated
 *    initial 6/10 → "worse" 8/10 → recovery shells emitted
 *    initial 6/10 → "same" → no mutation; physio nudge after 3+ days
 *
 * Run: npm run test:injury-progression
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const realLog = console.log;
console.log = (..._args: any[]) => {};

// ─── Resolver stub (real store + real engine) ──────────────────────────

import * as sessionResolver from '../utils/sessionResolver';
import type { ResolvedDay } from '../utils/sessionResolver';

const FIXED_TODAY = '2026-04-29';
const FIXED_MONDAY = '2026-04-27';
const SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  date.setDate(date.getDate() + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

import { useProgramStore } from '../store/programStore';
import {
  useCoachUpdatesStore,
  getActiveCoachUpdate,
} from '../store/coachUpdatesStore';
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
  classifyInjuryUpdate,
  shouldSuggestPhysio,
  daysBetween,
  type InjuryState,
} from '../utils/injuryProgression';
import { hasActiveInjurySeverity } from '../rules/injurySeverityBands';

function ex(name: string, sets = 3): any {
  const id = `ex-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  return {
    id: `we-${id}`, workoutId: '', exerciseId: id, exerciseOrder: 0,
    prescribedSets: sets, prescribedRepsMin: 6, prescribedRepsMax: 8,
    prescribedWeightKg: 0, restSeconds: 0,
    exercise: { id, name, description: name, exerciseType: 'Compound', muscleGroups: [], equipmentRequired: [], difficultyLevel: 'Intermediate', createdAt: '', updatedAt: '' },
    createdAt: '', updatedAt: '',
  };
}
function workout(name: string, opts: any = {}): any {
  return {
    id: `wk-${name}`, microcycleId: 'mc', dayOfWeek: 0,
    name, description: '', durationMinutes: 60, intensity: 'Moderate',
    workoutType: opts.workoutType || 'Strength',
    sessionTier: opts.sessionTier || 'core',
    exercises: opts.exercises || [],
    createdAt: '', updatedAt: '',
  };
}
function buildState() {
  return {
    currentProgram: null, currentMicrocycle: null,
    manualOverrides: useProgramStore.getState().dateOverrides || {},
    markedDays: {}, athleteContext: {}, seasonPhase: null, readiness: 'medium',
  } as any;
}
function resetAll() {
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null,
    dateOverrides: {}, overrideContexts: {},
    sessionFeedback: {}, weightOverrides: {},
  } as any);
  useCoachUpdatesStore.setState({ updatesByWeek: {}, activeInjury: null });
}

// Mirror of CoachScreen's NEW-injury success path: write override + card
// + activeInjury.
function seedInjury(bodyPart: string, severity: number, msg: string = 'My hammy is cooked') {
  const result = applyProgramAdjustment(
    {
      intent: 'injury', todayISO: FIXED_TODAY,
      payload: { bodyPart, severity }, source: 'client_guard',
    } as any,
    buildState(),
  );
  const apply = applyAdjustmentEvents(result.events, { todayISO: FIXED_TODAY, buildState });
  const cardBucket = bodyPart && bodyPart !== 'unknown' ? resolveInjuryBucket(bodyPart) : null;
  const policy = buildInjuryPolicy(cardBucket, severity);
  if (apply.applied.length > 0) {
    useCoachUpdatesStore.getState().upsertCoachUpdate(FIXED_MONDAY, {
      source: 'uae',
      reason: `${bodyPart[0].toUpperCase() + bodyPart.slice(1)} pain — ${severity}/10`,
      rules: [...policy.globalRules],
      changes: result.events.map(eventToBullet),
    });
  }
  const nowISO = new Date().toISOString();
  const state: InjuryState = {
    bodyPart, bucket: cardBucket, severity, initialSeverity: severity,
    status: 'active', createdAt: nowISO, lastUpdatedAt: nowISO,
    history: [{ timestamp: nowISO, fromStatus: 'new', toStatus: 'active', severity, note: msg }],
  };
  useCoachUpdatesStore.getState().setActiveInjury(state);
  return { result, apply };
}

// Mirror of handleInjuryProgression — pure-ish replica that touches the
// real stores. Lets us test the wire without mounting React.
function runProgression(message: string): { applied: number; replyKind: string } {
  const current = useCoachUpdatesStore.getState().activeInjury!;
  const outcome = classifyInjuryUpdate(message, current);
  const monday = FIXED_MONDAY;
  const nowISO = new Date().toISOString();

  if (outcome.kind === 'no_match') return { applied: 0, replyKind: 'no_match' };

  if (outcome.kind === 'resolved') {
    removeInjuryOverridesForWeek(monday);
    useCoachUpdatesStore.getState().deactivateCoachUpdate(monday);
    useCoachUpdatesStore.getState().transitionInjuryStatus({
      toStatus: 'resolved', severity: 0, note: message, timestamp: nowISO,
    });
    useCoachUpdatesStore.getState().setActiveInjury(null);
    return { applied: 0, replyKind: 'resolved' };
  }

  if (outcome.kind === 'unchanged') {
    useCoachUpdatesStore.getState().transitionInjuryStatus({
      toStatus: 'active', severity: current.severity, note: message, timestamp: nowISO,
    });
    return { applied: 0, replyKind: 'unchanged' };
  }

  // improving / worsening
  removeInjuryOverridesForWeek(monday);
  const newSev = outcome.newSeverity;
  let applied = 0;
  if (hasActiveInjurySeverity(newSev)) {
    const result = applyProgramAdjustment(
      {
        intent: 'injury', todayISO: FIXED_TODAY,
        payload: { bodyPart: current.bodyPart, severity: newSev }, source: 'client_guard',
      } as any,
      buildState(),
    );
    const apply = applyAdjustmentEvents(result.events, { todayISO: FIXED_TODAY, buildState });
    applied = apply.applied.length;

    if (apply.applied.length > 0) {
      const cardBucket =
        current.bucket ?? (current.bodyPart ? resolveInjuryBucket(current.bodyPart) : null);
      const policy = buildInjuryPolicy(cardBucket, newSev);
      const trend = outcome.kind === 'improving' ? 'improving' : 'worse';
      useCoachUpdatesStore.getState().upsertCoachUpdate(monday, {
        source: 'uae',
        reason: `${current.bodyPart[0].toUpperCase() + current.bodyPart.slice(1)} ${trend} — ${newSev}/10`,
        rules: [...policy.globalRules],
        changes: result.events.map(eventToBullet),
      });
    }
  } else {
    // resolved/zero — engine declines, deactivate card
    useCoachUpdatesStore.getState().deactivateCoachUpdate(monday);
  }
  useCoachUpdatesStore.getState().transitionInjuryStatus({
    toStatus: outcome.kind === 'improving' ? 'improving' : 'active',
    severity: newSev, note: message, timestamp: nowISO,
  });
  return { applied, replyKind: outcome.kind };
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
// 1. classifyInjuryUpdate — pure unit tests
// ─────────────────────────────────────────────────────────────────────
section('[1] classifyInjuryUpdate — phrase classification');
{
  const base: InjuryState = {
    bodyPart: 'hammy', bucket: 'hamstring' as any, severity: 6, initialSeverity: 6,
    status: 'active', createdAt: '2026-04-29T10:00:00Z', lastUpdatedAt: '2026-04-29T10:00:00Z', history: [],
  };
  // resolved
  eq('"pain is gone" → resolved', classifyInjuryUpdate('pain is gone', base).kind, 'resolved');
  eq('"all good now" → resolved', classifyInjuryUpdate('all good now', base).kind, 'resolved');
  eq('"feels great" → resolved', classifyInjuryUpdate('feels great', base).kind, 'resolved');
  eq('"0/10" → resolved', classifyInjuryUpdate('0/10', base).kind, 'resolved');

  // numeric improving
  const impr = classifyInjuryUpdate('4/10', base);
  ok('"4/10" → improving', impr.kind === 'improving');
  if (impr.kind === 'improving') eq('improving severity = 4', impr.newSeverity, 4);

  // numeric worsening
  const worse = classifyInjuryUpdate('8/10', base);
  ok('"8/10" → worsening', worse.kind === 'worsening');
  if (worse.kind === 'worsening') eq('worsening severity = 8', worse.newSeverity, 8);

  // numeric same → unchanged
  eq('"6/10" → unchanged', classifyInjuryUpdate('6/10', base).kind, 'unchanged');

  // qualitative
  eq('"better" → improving', classifyInjuryUpdate('feeling better', base).kind, 'improving');
  eq('"worse" → worsening', classifyInjuryUpdate('feels worse today', base).kind, 'worsening');
  eq('"same" → unchanged', classifyInjuryUpdate('still the same', base).kind, 'unchanged');

  // no match
  eq('"random msg" → no_match', classifyInjuryUpdate('random text about lunch', base).kind, 'no_match');

  // worsening trumps stray "better" elsewhere
  const mixed = classifyInjuryUpdate('feels worse than better days', base);
  eq('mixed phrase → worsening (worse precedence)', mixed.kind, 'worsening');
}

// ─────────────────────────────────────────────────────────────────────
// 2. daysBetween / shouldSuggestPhysio
// ─────────────────────────────────────────────────────────────────────
section('[2] daysBetween + shouldSuggestPhysio');
{
  eq('daysBetween same day = 0', daysBetween('2026-04-29T10:00:00Z', '2026-04-29T20:00:00Z'), 0);
  eq('daysBetween 3 day delta', daysBetween('2026-04-29T10:00:00Z', '2026-05-02T10:00:00Z'), 3);

  const fresh: InjuryState = {
    bodyPart: 'hammy', bucket: null, severity: 6, initialSeverity: 6,
    status: 'active', createdAt: '2026-04-29T10:00:00Z', lastUpdatedAt: '2026-04-29T10:00:00Z', history: [],
  };
  ok('day 0 → no physio nudge', !shouldSuggestPhysio(fresh, '2026-04-29T11:00:00Z', 3));
  ok('day 3 → physio nudge', shouldSuggestPhysio(fresh, '2026-05-02T10:00:00Z', 3));
  const resolved: InjuryState = { ...fresh, status: 'resolved' };
  ok('resolved → no physio nudge regardless of days', !shouldSuggestPhysio(resolved, '2026-05-10T10:00:00Z', 3));
}

// ─────────────────────────────────────────────────────────────────────
// 3. SCENARIO: hammy 6/10 → "better" → fewer overrides
// ─────────────────────────────────────────────────────────────────────
section('[3] Hammy 6/10 → "better" 4/10 → restrictions ease');
{
  resetAll();
  baseWeekDef = {
    3: workout('Recovery Session', { workoutType: 'Recovery', sessionTier: 'recovery', exercises: [] }),
    4: workout('Team Training', { workoutType: 'Team Training', exercises: [] }),
    5: workout('Lower Strength', { exercises: [ex('RDLs', 4), ex('Goblet Squat', 3)] }),
  };
  seedInjury('hammy', 6);
  const initialOverrides = Object.keys(useProgramStore.getState().dateOverrides).sort();
  ok('initial: ≥1 override exists', initialOverrides.length >= 1);
  ok('initial: card present', getActiveCoachUpdate(FIXED_MONDAY) != null);

  // Follow-up: better (numeric 4/10).
  const r = runProgression('4/10');
  eq('follow-up classified as improving', r.replyKind, 'improving');

  // Severity 4 remains an active moderate band: reduce affected work,
  // but do not treat it as cleared.
  ok('severity 4 re-applies lighter restrictions', r.applied >= 1);
  const afterOverrides = Object.keys(useProgramStore.getState().dateOverrides).sort();
  ok('after improving: overrides remain', afterOverrides.length >= 1);

  // Status updated.
  const state = useCoachUpdatesStore.getState().activeInjury;
  ok('status = improving', state?.status === 'improving');
  eq('severity = 4', state?.severity, 4);

  ok('card remains active at 4/10', getActiveCoachUpdate(FIXED_MONDAY) != null);
}

// ─────────────────────────────────────────────────────────────────────
// 4. SCENARIO: hammy 6/10 → "better" but still 5/10 → engine fires gentler
// ─────────────────────────────────────────────────────────────────────
section('[4] Hammy 6/10 → "5/10" → engine still fires in moderate band');
{
  resetAll();
  baseWeekDef = {
    4: workout('Team Training', { workoutType: 'Team Training', exercises: [] }),
    5: workout('Lower Strength', { exercises: [ex('RDLs', 4), ex('Goblet Squat', 3)] }),
  };
  seedInjury('hammy', 6);

  const beforeOverrideKeys = Object.keys(useProgramStore.getState().dateOverrides).sort();
  ok('initial overrides present', beforeOverrideKeys.length >= 1);

  const r = runProgression('5/10');
  eq('classified improving', r.replyKind, 'improving');
  ok('engine still applied at sev 5', r.applied >= 1);

  // Severity 5 only removes 'avoid' (RDLs); doesn't remove 'caution'
  // unlike sev 6. So we still see fewer per-exercise removals.
  const card = getActiveCoachUpdate(FIXED_MONDAY);
  ok('card refreshed', card != null);
  if (card) {
    ok('card.reason mentions "improving"', /improving/i.test(card.reason));
    ok('card.reason includes 5/10', /5\/10/.test(card.reason));
  }
}

// ─────────────────────────────────────────────────────────────────────
// 5. SCENARIO: hammy 6/10 → "pain gone" → all clear
// ─────────────────────────────────────────────────────────────────────
section('[5] Hammy 6/10 → "pain gone" → overrides cleared, card deactivated');
{
  resetAll();
  baseWeekDef = {
    4: workout('Team Training', { workoutType: 'Team Training', exercises: [] }),
    5: workout('Lower Strength', { exercises: [ex('RDLs', 4), ex('Goblet Squat', 3)] }),
  };
  seedInjury('hammy', 6);
  ok('pre-resolve: overrides exist', Object.keys(useProgramStore.getState().dateOverrides).length >= 1);

  const r = runProgression('pain is gone');
  eq('classified resolved', r.replyKind, 'resolved');

  // ALL injury overrides for the week are wiped.
  eq(
    'post-resolve: zero overrides remain',
    Object.keys(useProgramStore.getState().dateOverrides).length,
    0,
  );

  // Card deactivated; activeInjury cleared.
  ok('card deactivated', getActiveCoachUpdate(FIXED_MONDAY) === null);
  eq('activeInjury cleared', useCoachUpdatesStore.getState().activeInjury, null);
}

// ─────────────────────────────────────────────────────────────────────
// 6. SCENARIO: hammy 6/10 → "worse" 8/10 → affected work paused
// ─────────────────────────────────────────────────────────────────────
section('[6] Hammy 6/10 → "8/10" → pauses affected work without auto-rest');
{
  resetAll();
  baseWeekDef = {
    5: workout('Lower Strength', { exercises: [ex('RDLs', 4), ex('Deadlift', 3), ex('Nordic Lower', 3)] }),
  };
  seedInjury('hammy', 6);

  const r = runProgression('8/10');
  eq('classified worsening', r.replyKind, 'worsening');
  ok('engine fired at sev 8', r.applied >= 1);

  // Fri Lower Strength has 3/3 risky exercises for hamstring at sev 8.
  // Slice 4.2 should swap/remove those before resting the whole day.
  const friOverride = useProgramStore.getState().dateOverrides['2026-05-01'];
  ok('Fri override exists', !!friOverride);
  ok('Fri not converted straight to recovery', friOverride?.workoutType !== 'Recovery');
  const names = (friOverride?.exercises ?? []).map((row: any) => row.exercise?.name);
  ok(
    'Fri affected hamstring work gone',
    !names.includes('RDLs') && !names.includes('Deadlift') && !names.includes('Nordic Lower'),
    JSON.stringify(names),
  );
  ok('Fri safe alternate work remains', names.length > 0, JSON.stringify(names));

  // Card reason updated.
  const card = getActiveCoachUpdate(FIXED_MONDAY);
  ok('card refreshed with worse', card != null);
  if (card) {
    ok('card.reason includes "worse"', /worse/i.test(card.reason));
    ok('card.reason includes 8/10', /8\/10/.test(card.reason));
  }

  // Status updated.
  const state = useCoachUpdatesStore.getState().activeInjury;
  ok('status = active (post-worse)', state?.status === 'active');
  eq('severity = 8', state?.severity, 8);
  ok('history records the transition', (state?.history.length ?? 0) >= 2);
}

// ─────────────────────────────────────────────────────────────────────
// 7. SCENARIO: hammy 6/10 → "same" → no mutation; physio nudge after 3 days
// ─────────────────────────────────────────────────────────────────────
section('[7] Hammy 6/10 → "same" → no overrides changed');
{
  resetAll();
  baseWeekDef = {
    5: workout('Lower Strength', { exercises: [ex('RDLs', 4), ex('Goblet Squat', 3)] }),
  };
  seedInjury('hammy', 6);
  const beforeKeys = Object.keys(useProgramStore.getState().dateOverrides).sort();
  ok('initial overrides exist', beforeKeys.length >= 1);

  const r = runProgression('still the same');
  eq('classified unchanged', r.replyKind, 'unchanged');

  const afterKeys = Object.keys(useProgramStore.getState().dateOverrides).sort();
  eq('overrides unchanged on "same"', afterKeys, beforeKeys);
  ok('card preserved', getActiveCoachUpdate(FIXED_MONDAY) != null);

  // Status and severity preserved.
  const state = useCoachUpdatesStore.getState().activeInjury;
  ok('status remains active', state?.status === 'active');
  eq('severity unchanged', state?.severity, 6);

  // History records the unchanged turn.
  ok('history grew by 1', (state?.history.length ?? 0) >= 2);
}

// ─────────────────────────────────────────────────────────────────────
// 8. Card: deactivated entry survives in raw store (for history)
// ─────────────────────────────────────────────────────────────────────
section('[8] Resolved → raw card has active=false; getActiveCoachUpdate=null');
{
  resetAll();
  baseWeekDef = {
    5: workout('Lower Strength', { exercises: [ex('RDLs', 4)] }),
  };
  seedInjury('hammy', 6);
  runProgression('pain gone');

  const raw = useCoachUpdatesStore.getState().updatesByWeek[FIXED_MONDAY];
  ok('raw entry preserved with active=false', raw != null && raw.active === false);
  ok('getActiveCoachUpdate returns null', getActiveCoachUpdate(FIXED_MONDAY) === null);
}

// ─── Summary ───────────────────────────────────────────────────────────

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
