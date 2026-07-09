/**
 * coachConstraintProducersTests — proves the four non-injury producers
 * convert CoachIntent → typed ActiveConstraint correctly:
 *
 *   buildFatigueConstraintFromIntent
 *   buildSorenessConstraintFromIntent     (returns null on unmapped body part)
 *   buildBusyWeekConstraintFromIntent
 *   buildMissedSessionConstraintFromIntent
 *
 * Run: npm run test:coach-constraint-producers
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  buildFatigueConstraintFromIntent,
  buildSorenessConstraintFromIntent,
  buildBusyWeekConstraintFromIntent,
  buildMissedSessionConstraintFromIntent,
  bucketToRegion,
} from '../utils/coachConstraintProducers';
import type { CoachIntent, CoachIntentKind } from '../utils/coachIntent';

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

const NOW = '2026-04-26T08:00:00.000Z';

function intent(kind: CoachIntentKind, payload: Record<string, any> = {}): CoachIntent {
  return {
    intent: kind,
    confidence: 1,
    needsClarification: false,
    payload,
  };
}

// ─── [1] buildFatigueConstraintFromIntent ───────────────────────────
section('[1] fatigue producer — defaults severity 5 when missing');
{
  const c = buildFatigueConstraintFromIntent(intent('fatigue'), NOW);
  eq('type fatigue', c.type, 'fatigue');
  eq('severity defaults to 5', c.severity, 5);
  eq('status active', c.status, 'active');
  eq('id is fatigue-active', c.id, 'fatigue-active');
  eq('startDate uses nowISO', c.startDate, NOW);
  eq('tired today affects current day', c.modifierAffects, ['current_day']);
  eq('tired today expires end of day', c.expiresAt, '2026-04-26');
  eq('tired today scoped to today', c.appliesToDate, '2026-04-26');
  ok('rules non-empty', c.rules.length > 0);
  ok('safeFocus non-empty', c.safeFocus.length > 0);
}

section('[2] fatigue producer — severe (sev 9) emits hard advice');
{
  const c = buildFatigueConstraintFromIntent(intent('fatigue', { severity: 9 }), NOW);
  eq('severity clamped/passed 9', c.severity, 9);
  eq('cooked fatigue affects current week', c.modifierAffects, ['current_week']);
  eq('cooked fatigue expires end of selected week', c.expiresAt, '2026-04-26');
  eq('cooked fatigue has load-reduced title', c.modifierTitle, 'Load reduced this week');
  ok('rules mention drop max-effort', c.rules.some((r) => /max-effort/i.test(r)));
  ok('advice mentions sleep + food', c.advice.some((a) => /sleep|food/i.test(a)));
}

section('[2b] fatigue producer — cooked wording is week-scoped even with estimated severity');
{
  const c = buildFatigueConstraintFromIntent(
    intent('fatigue', { severity: 5 }),
    NOW,
    { userMessage: "I'm cooked this week", selectedDateISO: '2026-04-22' },
  );
  eq('estimated severity preserved', c.severity, 5);
  eq('cooked wording affects week', c.modifierAffects, ['current_week']);
  eq('selected week ends Sunday', c.expiresAt, '2026-04-26');
  eq('no day-only scope for cooked week', c.appliesToDate, undefined);
}

section('[3] fatigue producer — clamps invalid severity');
{
  const c = buildFatigueConstraintFromIntent(intent('fatigue', { severity: 99 }), NOW);
  eq('severity clamped to 10', c.severity, 10);
  const cn = buildFatigueConstraintFromIntent(intent('fatigue', { severity: -3 }), NOW);
  eq('negative clamped to 1', cn.severity, 1);
}

// ─── [2] buildSorenessConstraintFromIntent ──────────────────────────
section('[4] soreness producer — quads 6/10 maps to knee bucket');
{
  const c = buildSorenessConstraintFromIntent(
    intent('soreness', { bodyPart: 'quads', severity: 6 }),
    NOW,
  );
  ok('returns a constraint (non-null)', !!c);
  if (c) {
    eq('type soreness', c.type, 'soreness');
    eq('bucket knee (quads → knee)', c.bucket, 'knee');
    eq('severity 6', c.severity, 6);
    eq('bodyPart preserved (lower-cased)', c.bodyPart, 'quads');
    eq('id is soreness-knee', c.id, 'soreness-knee');
    ok('rules mention quads context', c.rules.some((r) => /quads/i.test(r)));
  }
}

section('[5] soreness producer — hammy → hamstring bucket');
{
  const c = buildSorenessConstraintFromIntent(
    intent('soreness', { bodyPart: 'hammies', severity: 4 }),
    NOW,
  );
  ok('not null', !!c);
  eq('hammies → hamstring bucket', c?.bucket, 'hamstring');
  eq('mild soreness affects current day', c?.modifierAffects, ['current_day']);
  eq('mild soreness expires end of day', c?.expiresAt, '2026-04-26');
  eq('mild soreness scoped to today', c?.appliesToDate, '2026-04-26');
}

section('[5b] soreness producer — moderate soreness expires at selected week end');
{
  const c = buildSorenessConstraintFromIntent(
    intent('soreness', { bodyPart: 'quads', severity: 6 }),
    NOW,
    { selectedDateISO: '2026-04-22' },
  );
  eq('moderate soreness affects current week', c?.modifierAffects, ['current_week']);
  eq('moderate soreness expires selected week end', c?.expiresAt, '2026-04-26');
  eq('moderate soreness is not day-only', c?.appliesToDate, undefined);
}

section('[6] soreness producer — adductor → adductor bucket');
{
  const c = buildSorenessConstraintFromIntent(
    intent('soreness', { bodyPart: 'groin', severity: 5 }),
    NOW,
  );
  ok('not null', !!c);
  eq('groin → adductor bucket', c?.bucket, 'adductor');
}

section('[7] soreness producer — unmapped body part returns null');
{
  const c = buildSorenessConstraintFromIntent(
    intent('soreness', { bodyPart: 'unicorn', severity: 5 }),
    NOW,
  );
  eq('returns null when bucket unresolved', c, null);

  const c2 = buildSorenessConstraintFromIntent(intent('soreness'), NOW);
  eq('returns null when no body part', c2, null);
}

section('[8] soreness producer — free-text body part with surrounding words');
{
  const c = buildSorenessConstraintFromIntent(
    intent('soreness', { bodyPart: 'really sore quads after the gym', severity: 5 }),
    NOW,
  );
  ok('free-text quads → knee bucket', c?.bucket === 'knee');
}

// ─── [3] buildBusyWeekConstraintFromIntent ──────────────────────────
section('[9] busy-week producer — defaults severity 5');
{
  const c = buildBusyWeekConstraintFromIntent(intent('busy_week'), NOW);
  eq('type schedule', c.type, 'schedule');
  eq('severity defaults to 5', c.severity, 5);
  eq('id is schedule-busy-week', c.id, 'schedule-busy-week');
  eq('busy week affects current week', c.modifierAffects, ['current_week']);
  eq('busy week starts selected week', c.weekStartISO, '2026-04-20');
  eq('busy week expires end of selected week', c.expiresAt, '2026-04-26');
  ok('rules non-empty (moderate guidance)', c.rules.length > 0);
}

section('[10] busy-week producer — sev 8 emits drop-max-effort rule');
{
  const c = buildBusyWeekConstraintFromIntent(intent('busy_week', { severity: 8 }), NOW);
  eq('severity 8', c.severity, 8);
  ok('rules drop max-effort', c.rules.some((r) => /max-effort/i.test(r)));
}

// ─── [4] buildMissedSessionConstraintFromIntent ─────────────────────
section('[11] missed-session producer — severity always 0');
{
  const c = buildMissedSessionConstraintFromIntent(
    intent('missed_session', { requestedDate: '2026-04-22', requestedSession: 'Lower' }),
    NOW,
  );
  eq('type missed_session', c.type, 'missed_session');
  eq('severity 0', c.severity, 0);
  eq('missedDate threaded', c.missedDate, '2026-04-22');
  eq('sessionName threaded', c.sessionName, 'Lower');
  eq('id deterministic from missedDate', c.id, 'missed-2026-04-22');
  eq('rules empty (informational)', c.rules.length, 0);
  ok('safeFocus mentions pick-up', c.safeFocus.some((s) => /pick up/i.test(s)));
}

section('[12] missed-session producer — falls back to "recent" id');
{
  const c = buildMissedSessionConstraintFromIntent(intent('missed_session'), NOW);
  eq('id fallback recent', c.id, 'missed-recent');
  eq('missedDate undefined', c.missedDate, undefined);
}

// ─── [5] bucketToRegion sanity ──────────────────────────────────────
section('[13] bucketToRegion — covers core mappings');
{
  eq('hamstring → hamstring', bucketToRegion('hamstring'), 'hamstring');
  eq('adductor → groin', bucketToRegion('adductor'), 'groin');
  eq('lowerBack → back', bucketToRegion('lowerBack'), 'back');
  eq('shoulder → shoulder', bucketToRegion('shoulder'), 'shoulder');
}

// ─── Report ─────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
} else {
  process.exit(0);
}
