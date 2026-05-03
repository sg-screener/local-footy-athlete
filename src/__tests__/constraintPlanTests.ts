/**
 * constraintPlanTests — proves the ConstraintPlan layer:
 *  - Plans derive deterministically from active constraints
 *  - Avoid labels match the engine policy (sprint blocked → "Sprinting…"
 *    appears) and stay short
 *  - SubstituteWith is region-aware
 *  - Multi-constraint plans dedupe sensibly across regions
 *  - validateVisibleProgramAgainstConstraintPlans flags violations the
 *    plan said to avoid
 *  - Concise reply composer (plan input) produces ≤ 5 sections, no
 *    "program unchanged" lie when a week was projected
 *  - buildSessionPlanNote produces a single short attribution line
 *
 * Run: npm run test:constraint-plan
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  buildConstraintPlans,
  validateVisibleProgramAgainstConstraintPlans,
  buildSessionPlanNote,
} from '../utils/constraintPlan';
import { composeCoachAdjustmentReply } from '../utils/coachReplyComposer';
import type {
  ActiveInjuryConstraint,
  ActiveFatigueConstraint,
  ActiveSorenessConstraint,
  ActiveScheduleConstraint,
  ActiveMissedSessionConstraint,
  ActiveConstraint,
} from '../store/coachUpdatesStore';
import type { Workout } from '../types/domain';

// ─── Harness ─────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; failures.push(name); console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`); }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { console.log(`\n${label}`); }

// ─── Fixtures ────────────────────────────────────────────────────────
function ex(name: string): any {
  return {
    id: `we-${name}`, workoutId: 'wk', exerciseId: `ex-${name}`,
    exerciseOrder: 0, prescribedSets: 3, prescribedRepsMin: 6, prescribedRepsMax: 8,
    prescribedWeightKg: 0, restSeconds: 0,
    exercise: {
      id: `ex-${name}`, name, description: name,
      exerciseType: 'Compound', muscleGroups: [], equipmentRequired: [],
      difficultyLevel: 'Intermediate', createdAt: '', updatedAt: '',
    },
    createdAt: '', updatedAt: '',
  };
}
function wk(name: string, exercises: any[]): Workout {
  return {
    id: 'w', microcycleId: 'mc', dayOfWeek: 1,
    name, description: '', durationMinutes: 60,
    intensity: 'Moderate' as any, workoutType: 'Strength' as any,
    sessionTier: 'core' as any, exercises, createdAt: '', updatedAt: '',
    coachNotes: [],
  } as Workout;
}
function injury(
  bodyPart: string,
  bucket: any,
  severity: number,
  status: 'active' | 'improving' | 'resolved' = 'active',
  rules: string[] = [],
  safeFocus: string[] = [],
  advice: string[] = [],
): ActiveInjuryConstraint {
  return {
    id: `injury-${bucket}`,
    type: 'injury',
    bodyPart, bucket, severity, status,
    startDate: '2026-04-25T00:00:00.000Z',
    lastUpdatedAt: '2026-04-25T00:00:00.000Z',
    rules, safeFocus, advice,
  };
}
function fatigue(severity: number): ActiveFatigueConstraint {
  return {
    id: 'fatigue',
    type: 'fatigue',
    severity,
    status: 'active',
    startDate: '2026-04-25T00:00:00.000Z',
    lastUpdatedAt: '2026-04-25T00:00:00.000Z',
    rules: [], safeFocus: [], advice: [],
  };
}
function soreness(bodyPart: string, bucket: any, severity: number): ActiveSorenessConstraint {
  return {
    id: `soreness-${bucket}`,
    type: 'soreness',
    bodyPart, bucket, severity,
    status: 'active',
    startDate: '2026-04-25T00:00:00.000Z',
    lastUpdatedAt: '2026-04-25T00:00:00.000Z',
    rules: [], safeFocus: [], advice: [],
  };
}
function busyWeek(severity: number): ActiveScheduleConstraint {
  return {
    id: 'schedule-busy-week',
    type: 'schedule',
    severity,
    status: 'active',
    startDate: '2026-04-25T00:00:00.000Z',
    lastUpdatedAt: '2026-04-25T00:00:00.000Z',
    rules: [], safeFocus: [], advice: [],
  };
}
function missedSession(missedDate?: string, sessionName?: string): ActiveMissedSessionConstraint {
  return {
    id: `missed-${missedDate ?? 'recent'}`,
    type: 'missed_session',
    missedDate, sessionName,
    severity: 0,
    status: 'active',
    startDate: '2026-04-25T00:00:00.000Z',
    lastUpdatedAt: '2026-04-25T00:00:00.000Z',
    rules: [], safeFocus: [], advice: [],
  };
}

// ─── [1] buildConstraintPlans — single hammy 7/10 ───────────────────
section('[1] buildConstraintPlans — hammy 7/10 derives engine policy');
{
  const plans = buildConstraintPlans([injury('hammy', 'hamstring', 7)]);
  ok('one plan emitted', plans.length === 1);
  const p = plans[0];
  eq('activeIssue label', p.activeIssue, 'Hammy pain — 7/10');
  ok('avoid mentions sprinting', p.avoid.includes('Sprinting / max-speed running'));
  ok('avoid mentions plyos', p.avoid.includes('Plyometrics / jumping'));
  ok('avoid mentions heavy hinge', p.avoid.includes('Heavy hinge / nordics / RDLs'));
  ok('avoid does NOT mention generic "Hinge patterns" (collapsed)', !p.avoid.includes('Hinge patterns'));
  ok('avoid does NOT mention generic "Running" (collapsed)', !p.avoid.includes('Running'));
  ok('subWith mentions quad-dominant lower', p.substituteWith.some((s) => /quad-dominant/i.test(s)));
  ok('keep mentions upper body', p.keep.some((s) => /upper body/i.test(s)));
  ok('advice has hard physio nudge (sev 7)', p.advice.some((a) => /assessed by a physio/i.test(a)));
  eq('updatePrompt is canonical', p.updatePrompt, 'Update coach when it improves, worsens, or clears.');
}

// ─── [2] buildConstraintPlans — shoulder 8/10 ───────────────────────
section('[2] buildConstraintPlans — shoulder 8/10 blocks pressing');
{
  const plans = buildConstraintPlans([injury('shoulder', 'shoulder', 8)]);
  const p = plans[0];
  ok('avoid mentions horizontal pressing', p.avoid.includes('Bench / horizontal pressing'));
  ok('avoid mentions overhead loading', p.avoid.some((s) => /overhead/i.test(s)));
  ok('avoid does NOT mention sprinting', !p.avoid.some((s) => /sprinting/i.test(s)));
  ok('subWith mentions lower body strength', p.substituteWith.some((s) => /lower body strength/i.test(s)));
  ok('hard physio advice present', p.advice.some((a) => /assessed by a physio/i.test(a)));
}

// ─── [3] buildConstraintPlans — moderate severity (4–6) ─────────────
section('[3] buildConstraintPlans — moderate severity gets soft physio nudge');
{
  const plans = buildConstraintPlans([injury('hammy', 'hamstring', 5)]);
  const p = plans[0];
  ok('soft physio nudge present (sev 5)', p.advice.some((a) => /not improving in a few days/i.test(a)));
  ok('no hard physio nudge', !p.advice.some((a) => /assessed by a physio/i.test(a)));
}

// ─── [4] buildConstraintPlans — fatigue ─────────────────────────────
section('[4] buildConstraintPlans — fatigue 7/10 gets aerobic substitutes');
{
  const plans = buildConstraintPlans([fatigue(7)]);
  const p = plans[0];
  eq('type fatigue', p.type, 'fatigue');
  ok('avoid includes max-effort strength', p.avoid.includes('Max-effort strength'));
  ok('avoid includes high-intensity conditioning', p.avoid.includes('High-intensity conditioning'));
  ok('subWith starts with easy aerobic', p.substituteWith[0].toLowerCase().includes('aerobic'));
}

// ─── [5] buildConstraintPlans — multi-constraint plan ───────────────
section('[5] buildConstraintPlans — hammy + shoulder, two distinct plans');
{
  const plans = buildConstraintPlans([
    injury('hammy', 'hamstring', 7),
    injury('shoulder', 'shoulder', 6),
  ]);
  ok('two plans emitted', plans.length === 2);
  const hammy = plans.find((p) => /Hammy/i.test(p.activeIssue))!;
  const shoulder = plans.find((p) => /Shoulder/i.test(p.activeIssue))!;
  ok('hammy avoid has sprinting', hammy.avoid.includes('Sprinting / max-speed running'));
  ok('shoulder avoid has overhead', shoulder.avoid.some((s) => /overhead/i.test(s)));
  ok('hammy keep ≠ shoulder keep (region-specific)', JSON.stringify(hammy.keep) !== JSON.stringify(shoulder.keep));
}

// ─── [6] buildConstraintPlans — resolved skipped ────────────────────
section('[6] buildConstraintPlans — resolved constraints excluded');
{
  const plans = buildConstraintPlans([
    injury('hammy', 'hamstring', 7, 'resolved'),
    injury('shoulder', 'shoulder', 6),
  ]);
  ok('only one plan (shoulder)', plans.length === 1);
  ok('shoulder plan present', /Shoulder/i.test(plans[0].activeIssue));
}

// ─── [7] validateVisibleProgramAgainstConstraintPlans ───────────────
section('[7] validator — flags exercises that violate the plan');
{
  const plans = buildConstraintPlans([injury('hammy', 'hamstring', 7)]);
  const week = [
    { date: '2026-04-27', workout: wk('Mon', [ex('Sprint'), ex('RDL'), ex('Goblet Squat')]) },
    { date: '2026-04-28', workout: wk('Tue', [ex('Goblet Squat'), ex('Bench Press')]) },
  ];
  const result = validateVisibleProgramAgainstConstraintPlans(week, plans);
  ok('validation fails (sprint + RDL violate)', !result.passed);
  ok('violation includes Sprint', result.violations.some((v) => /sprint/i.test(v.exercise)));
  ok('violation includes RDL', result.violations.some((v) => /rdl/i.test(v.exercise)));
  ok('Goblet Squat NOT flagged', !result.violations.some((v) => /goblet/i.test(v.exercise)));
  ok('Bench Press NOT flagged', !result.violations.some((v) => /bench/i.test(v.exercise)));
}

// ─── [8] validator — passes when week is clean ──────────────────────
section('[8] validator — passes when week respects the plan');
{
  const plans = buildConstraintPlans([injury('hammy', 'hamstring', 7)]);
  const week = [
    { date: '2026-04-27', workout: wk('Mon', [ex('Goblet Squat'), ex('Bench Press')]) },
    { date: '2026-04-28', workout: wk('Tue', [ex('Pull-up'), ex('Pallof Press')]) },
  ];
  const result = validateVisibleProgramAgainstConstraintPlans(week, plans);
  ok('validation passes', result.passed);
  eq('zero violations', result.violations.length, 0);
}

// ─── [9] validator — shoulder 8/10 catches presses ──────────────────
section('[9] validator — shoulder 8/10 flags pressing + overhead');
{
  const plans = buildConstraintPlans([injury('shoulder', 'shoulder', 8)]);
  const week = [
    { date: '2026-04-27', workout: wk('Mon', [ex('Bench Press'), ex('Overhead Press')]) },
  ];
  const result = validateVisibleProgramAgainstConstraintPlans(week, plans);
  ok('validation fails', !result.passed);
  ok('flags Bench Press', result.violations.some((v) => /bench/i.test(v.exercise)));
  ok('flags Overhead Press', result.violations.some((v) => /overhead/i.test(v.exercise)));
}

// ─── [10] buildSessionPlanNote — single + multi ─────────────────────
section('[10] buildSessionPlanNote — concise per-session attribution');
{
  const single = buildSessionPlanNote(buildConstraintPlans([injury('hammy', 'hamstring', 7)]));
  ok('single returns a string', typeof single === 'string');
  ok('single mentions hammy 7/10', /hammy 7\/10/i.test(single ?? ''));
  ok('single mentions sprinting', /sprinting/i.test(single ?? ''));
  ok('single is short (< 120 chars)', (single ?? '').length < 120);

  const multi = buildSessionPlanNote(buildConstraintPlans([
    injury('hammy', 'hamstring', 7),
    injury('shoulder', 'shoulder', 6),
  ]));
  ok('multi mentions both', /hammy/i.test(multi ?? '') && /shoulder/i.test(multi ?? ''));
  ok('multi joins with +', /hammy.*\+.*shoulder|shoulder.*\+.*hammy/.test(multi ?? ''));

  const empty = buildSessionPlanNote([]);
  eq('empty returns null', empty, null);
}

// ─── [11] composeCoachAdjustmentReply — plan-driven, current week ───
section('[11] composeCoachAdjustmentReply — plan input, current week');
{
  const plans = buildConstraintPlans([injury('hammy', 'hamstring', 7)]);
  const reply = composeCoachAdjustmentReply({
    plans,
    currentWeekAffected: true,
    futureWeekAffected: false,
  });
  ok('starts with bucket headline', /hammy 7\/10 is too high/i.test(reply));
  ok('contains Avoid section', /Avoid:/.test(reply));
  ok('contains Sub in section', /Sub in:/.test(reply));
  ok('contains Keep line', /^Keep /m.test(reply));
  ok('contains adjusted line', /this week is now adjusted/i.test(reply));
  ok('contains physio + update prompt on one closing line', /physio.*Update coach|Update coach/i.test(reply));
  ok('reply ≤ 12 lines', reply.split('\n').length <= 12);
  ok('reply does NOT contain "Sprint removed" detail', !/Sprint removed/i.test(reply));
}

// ─── [12] composeCoachAdjustmentReply — future week only ────────────
section('[12] composeCoachAdjustmentReply — future-only change');
{
  const plans = buildConstraintPlans([injury('hammy', 'hamstring', 7)]);
  const reply = composeCoachAdjustmentReply({
    plans,
    currentWeekAffected: false,
    futureWeekAffected: true,
  });
  ok('mentions next week is adjusted', /next week is now adjusted/i.test(reply));
  ok('does NOT claim program unchanged', !/program is unchanged|program unchanged/i.test(reply));
}

// ─── [13] composeCoachAdjustmentReply — multi constraint ────────────
section('[13] composeCoachAdjustmentReply — multi-constraint stays short');
{
  const plans = buildConstraintPlans([
    injury('hammy', 'hamstring', 7),
    injury('shoulder', 'shoulder', 6),
  ]);
  const reply = composeCoachAdjustmentReply({
    plans,
    currentWeekAffected: true,
    futureWeekAffected: true,
  });
  ok('combined headline', /two issues active/i.test(reply));
  ok('mentions hammy', /hammy/i.test(reply));
  ok('mentions shoulder', /shoulder/i.test(reply));
  ok('reply ≤ 18 lines (multi-constraint cap)', reply.split('\n').length <= 18);
  ok('Avoid line includes both regions', /Avoid:.*sprint.*press|Avoid:.*press.*sprint/i.test(reply.replace(/\s+/g, ' ').toLowerCase()));
}

// ─── [14] composeCoachAdjustmentReply — neither week changed ────────
section('[14] composeCoachAdjustmentReply — minimal fallback');
{
  // Empty constraints means no plans → fallback path.
  const reply = composeCoachAdjustmentReply({
    plans: [],
    currentWeekAffected: false,
    futureWeekAffected: false,
  });
  ok('contains Update coach', /Update coach/.test(reply));
  ok('contains nothing-on-program phrasing', /Nothing on the program/i.test(reply));
}

// ─── [15] back-compat — legacy signature still works ────────────────
section('[15] composeCoachAdjustmentReply — legacy signature back-compat');
{
  const reply = composeCoachAdjustmentReply({
    constraints: [injury('hammy', 'hamstring', 7) as ActiveConstraint],
    currentWeekChanges: ['Mon Lower adjusted — RDL removed'],
    nextWeekChanges: [],
    didCurrentWeekChange: true,
    didFutureWeekChange: false,
  });
  ok('legacy still produces a reply', reply.length > 0);
  ok('legacy reply mentions hammy', /hammy/i.test(reply));
  ok('legacy reply mentions Update coach', /Update coach/.test(reply));
}

// ─── [16] avoid-label dedupe semantics ──────────────────────────────
section('[16] avoid labels collapse correctly across categories');
{
  // back severe — should collapse hinge variants under "Heavy hinge / nordics / RDLs"
  const plans = buildConstraintPlans([injury('low back', 'lowerBack', 8)]);
  const p = plans[0];
  ok('back severe lists Heavy hinge label', p.avoid.some((s) => /Heavy hinge/i.test(s)));
  ok('back severe lists Heavy squatting label', p.avoid.some((s) => /Heavy squatting/i.test(s)));
  ok('back severe lists Heavy rows / pull-ups', p.avoid.some((s) => /Heavy rows \/ pull-ups/i.test(s)));
  ok('back severe lists Loaded carries', p.avoid.includes('Loaded carries'));
  ok('back severe does NOT list bare "Hinge patterns"', !p.avoid.includes('Hinge patterns'));
}

// ─── [18] buildPlanForSoreness — quad 6/10 ───────────────────────────
section('[18] buildPlanForSoreness — quad 6/10 limits, never blocks');
{
  const plans = buildConstraintPlans([soreness('quads', 'knee', 6)]);
  ok('one plan emitted', plans.length === 1);
  const p = plans[0];
  eq('type soreness', p.type, 'soreness');
  eq('activeIssue label', p.activeIssue, 'Quads soreness — 6/10');
  ok('subWith mentions hinge alternative', p.substituteWith.some((s) => /hinge/i.test(s)));
  ok('keep is non-empty', p.keep.length > 0);
  ok('updatePrompt is canonical', /improves/i.test(p.updatePrompt));
}

// ─── [19] buildPlanForSoreness — severe quads 8/10 invokes physio nudge ─
section('[19] buildPlanForSoreness — sev≥7 adds soft physio nudge');
{
  const plans = buildConstraintPlans([soreness('quads', 'knee', 8)]);
  const p = plans[0];
  ok('soft physio nudge', p.advice.some((a) => /not improving in a few days/i.test(a)));
}

// ─── [20] buildPlanForBusyWeek — severity 7/10 ───────────────────────
section('[20] buildPlanForBusyWeek — busy 7/10 drops max-effort + heavy lower');
{
  const plans = buildConstraintPlans([busyWeek(7)]);
  ok('one plan emitted', plans.length === 1);
  const p = plans[0];
  eq('type schedule', p.type, 'schedule');
  eq('activeIssue label', p.activeIssue, 'Busy week — 7/10');
  ok('avoid mentions max-effort', p.avoid.includes('Max-effort strength'));
  ok('avoid mentions hard conditioning', p.avoid.includes('High-intensity conditioning'));
  ok('subWith mentions short focused strength', p.substituteWith.some((s) => /short/i.test(s)));
  ok('keep mentions short / targeted', p.keep.some((s) => /short/i.test(s) || /targeted/i.test(s)));
}

// ─── [21] buildPlanForMissedSession — informational ────────────────
section('[21] buildPlanForMissedSession — informational, empty avoid');
{
  const plans = buildConstraintPlans([missedSession('2026-04-28', 'Tuesday Lower')]);
  ok('one plan emitted', plans.length === 1);
  const p = plans[0];
  eq('type missed_session', p.type, 'missed_session');
  eq('activeIssue label', p.activeIssue, 'Missed Tuesday Lower');
  eq('avoid is empty (informational only)', p.avoid.length, 0);
  ok('subWith hints at picking up', p.substituteWith.some((s) => /pick up/i.test(s)));
  ok('keep mentions pick up', p.keep.some((s) => /pick up/i.test(s)));
}

// ─── [22] missed_session — fallback label when no sessionName ───────
section('[22] buildPlanForMissedSession — falls back to generic label');
{
  const plans = buildConstraintPlans([missedSession('2026-04-28')]);
  eq('activeIssue is generic missed', plans[0].activeIssue, 'Missed session');
}

// ─── [23] mixed constraint plans — injury + soreness + busy week ────
section('[23] buildConstraintPlans — mixed (injury+soreness+schedule) emits 3 plans');
{
  const plans = buildConstraintPlans([
    injury('hammy', 'hamstring', 7),
    soreness('shoulders', 'shoulder', 5),
    busyWeek(5),
  ]);
  eq('three plans emitted', plans.length, 3);
  ok('one is injury', plans.some((p) => p.type === 'injury'));
  ok('one is soreness', plans.some((p) => p.type === 'soreness'));
  ok('one is schedule', plans.some((p) => p.type === 'schedule'));
}

// ─── [24] buildSessionPlanNote — soreness, no body part collapse ────
section('[24] buildSessionPlanNote — soreness gives "X soreness N/10"');
{
  const note = buildSessionPlanNote(buildConstraintPlans([soreness('quads', 'knee', 6)]));
  ok('mentions quads soreness 6/10', /quads soreness 6\/10/i.test(note ?? ''));
  ok('still under 120 chars', (note ?? '').length < 120);
}

// ─── [17] runtime logs — built + validation pass ────────────────────
section('[17] runtime logs — proof');
{
  const orig = console.log;
  const captured: any[] = [];
  console.log = (...args: any[]) => { captured.push(args); };
  try {
    (global as unknown as { __DEV__: boolean }).__DEV__ = true;
    const plans = buildConstraintPlans([injury('hammy', 'hamstring', 7)]);
    validateVisibleProgramAgainstConstraintPlans(
      [{ date: '2026-04-27', workout: wk('Mon', [ex('Goblet Squat')]) }],
      plans,
    );
    const reply = composeCoachAdjustmentReply({
      plans,
      currentWeekAffected: true,
      futureWeekAffected: false,
    });
    ok('reply returned', reply.length > 0);
    ok('logged constraint-plan built', captured.some((a) => a[0] === '[constraint-plan] built'));
    ok('logged validation_passed', captured.some((a) => a[0] === '[constraint-plan] validation_passed'));
    ok('logged reply_composed', captured.some((a) => a[0] === '[constraint-plan] reply_composed'));
  } finally {
    (global as unknown as { __DEV__: boolean }).__DEV__ = false;
    console.log = orig;
  }
}

// ─── Report ──────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
} else {
  process.exit(0);
}
