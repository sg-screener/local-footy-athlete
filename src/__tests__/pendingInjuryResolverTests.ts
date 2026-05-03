/**
 * pendingInjuryResolverTests — covers the two-turn injury flow handshake.
 *
 * The resolver is pure (in/out), so we can simulate the ref state
 * directly without mounting the screen.
 *
 * Run: npm run test:pending-injury  (sucrase-node)
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  resolveInjuryFromMessage,
  PENDING_INJURY_TTL_MS,
  type PendingInjury,
} from '../utils/pendingInjuryResolver';

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

function section(label: string) {
  console.log(`\n${label}`);
}

const NOW = 1_700_000_000_000;
const FRESH = NOW - 1000; // 1 second old
const STALE = NOW - PENDING_INJURY_TTL_MS - 1; // just past TTL

function pending(bodyPart: string, ts: number = FRESH): PendingInjury {
  return { bodyPart, originalMessage: `${bodyPart} cooked`, timestamp: ts };
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Direct context — message has body part + severity → resolved from message
// ─────────────────────────────────────────────────────────────────────────

section('[1] Direct context: "hammy cooked 6/10"');
{
  const out = resolveInjuryFromMessage('hammy cooked 6/10', null, NOW);
  ok('resolved from message', out.kind === 'resolved');
  if (out.kind === 'resolved') {
    eq('bodyPart=hammy', out.resolved.bodyPart, 'hammy');
    eq('severity=6', out.resolved.severity, 6);
    eq('source=message', out.resolved.source, 'message');
  }
  ok('pendingAfter is null', out.pendingAfter === null);
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Severity-only follow-up with fresh pending → consumes pending
// ─────────────────────────────────────────────────────────────────────────

section('[2] Severity-only "6/10" with fresh pending hammy → consumed');
{
  const out = resolveInjuryFromMessage('6/10', pending('hammy'), NOW);
  ok('resolved', out.kind === 'resolved');
  if (out.kind === 'resolved') {
    eq('bodyPart from pending', out.resolved.bodyPart, 'hammy');
    eq('severity from message', out.resolved.severity, 6);
    eq('source=pending', out.resolved.source, 'pending');
  }
  ok('pending cleared', out.pendingAfter === null);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Severity-only "7/10" with shoulder pending
// ─────────────────────────────────────────────────────────────────────────

section('[3] Severity-only "7/10" with fresh pending shoulder → consumed');
{
  const out = resolveInjuryFromMessage('7/10', pending('shoulder'), NOW);
  ok('resolved', out.kind === 'resolved');
  if (out.kind === 'resolved') {
    eq('bodyPart from pending', out.resolved.bodyPart, 'shoulder');
    eq('severity=7', out.resolved.severity, 7);
    eq('source=pending', out.resolved.source, 'pending');
  }
  ok('pending cleared', out.pendingAfter === null);
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Severity-only "6/10" with no pending → no_match (let LLM handle)
// ─────────────────────────────────────────────────────────────────────────

section('[4] "6/10" with no pending → no_match');
{
  const out = resolveInjuryFromMessage('6/10', null, NOW);
  eq('kind=no_match', out.kind, 'no_match');
  ok('pendingAfter unchanged (null)', out.pendingAfter === null);
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Stale pending — drop it, do not fire
// ─────────────────────────────────────────────────────────────────────────

section('[5] "6/10" with stale pending → stale_cleared, no fire');
{
  const stalePending = pending('hammy', STALE);
  const out = resolveInjuryFromMessage('6/10', stalePending, NOW);
  eq('kind=stale_cleared', out.kind, 'stale_cleared');
  ok('pendingAfter cleared', out.pendingAfter === null);
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Non-severity follow-up message — leave pending alone
// ─────────────────────────────────────────────────────────────────────────

section('[6] "what about deadlifts?" with pending → no_match, pending preserved');
{
  const p = pending('hammy');
  const out = resolveInjuryFromMessage('what about deadlifts?', p, NOW);
  eq('kind=no_match', out.kind, 'no_match');
  ok('pending preserved', out.pendingAfter === p);
}

// ─────────────────────────────────────────────────────────────────────────
// 7. Direct context with pending present → message wins, pending cleared
// ─────────────────────────────────────────────────────────────────────────

section('[7] "calf 7/10" while pending=hammy → message wins, pending cleared');
{
  const out = resolveInjuryFromMessage('calf hurts 7/10', pending('hammy'), NOW);
  ok('resolved from message', out.kind === 'resolved');
  if (out.kind === 'resolved') {
    eq('bodyPart=calf (not hammy)', out.resolved.bodyPart, 'calf');
    eq('severity=7', out.resolved.severity, 7);
    eq('source=message', out.resolved.source, 'message');
  }
  ok('pending cleared', out.pendingAfter === null);
}

// ─────────────────────────────────────────────────────────────────────────
// 8. Severity-only with unknown bodyPart pending — passes through bodyPart
// ─────────────────────────────────────────────────────────────────────────

section('[8] Severity-only "8/10" with pending unknown body part is fine');
{
  // (Defensive — extractBodyPart can match nontrivial tokens; this just
  //  verifies the resolver doesn't reject pending whose bodyPart isn't a
  //  bucketed name. The engine handles the bucket=null fallback.)
  const out = resolveInjuryFromMessage('8/10', pending('forelimb'), NOW);
  ok('resolved', out.kind === 'resolved');
  if (out.kind === 'resolved') {
    eq('bodyPart=forelimb', out.resolved.bodyPart, 'forelimb');
    eq('severity=8', out.resolved.severity, 8);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 9. Pending exactly at the TTL boundary is still fresh
// ─────────────────────────────────────────────────────────────────────────

section('[9] Pending exactly at TTL is fresh; one ms past is stale');
{
  const atTtl = pending('hammy', NOW - PENDING_INJURY_TTL_MS);
  const out1 = resolveInjuryFromMessage('6/10', atTtl, NOW);
  eq('at TTL → resolved', out1.kind, 'resolved');

  const overTtl = pending('hammy', NOW - PENDING_INJURY_TTL_MS - 1);
  const out2 = resolveInjuryFromMessage('6/10', overTtl, NOW);
  eq('1ms past TTL → stale_cleared', out2.kind, 'stale_cleared');
}

// ─────────────────────────────────────────────────────────────────────────
// 10. Severity 4 (sub-threshold) — the resolver still resolves; the engine
//     downstream is what decides to decline. Verifies the resolver isn't
//     hiding low-severity messages from the engine.
// ─────────────────────────────────────────────────────────────────────────

section('[10] Severity-only "4/10" with fresh pending → resolved (engine decides)');
{
  const out = resolveInjuryFromMessage('4/10', pending('hammy'), NOW);
  ok('resolved', out.kind === 'resolved');
  if (out.kind === 'resolved') {
    eq('severity=4', out.resolved.severity, 4);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 11. "Shoulder feels off" → "7/10" — full two-turn handshake
// ─────────────────────────────────────────────────────────────────────────

section('[11] Two-turn: "shoulder feels off" → "7/10" (caller stash + resolve)');
{
  // First message — would be handled by the severity-unknown guard. The
  // caller would extractBodyPart and stash. We simulate that.
  const turn1Message = 'shoulder feels off';
  const turn1Resolution = resolveInjuryFromMessage(turn1Message, null, NOW);
  eq(
    'turn 1: no_match (no severity, guard would fire)',
    turn1Resolution.kind,
    'no_match',
  );

  // Caller stashes pending (this happens in CoachScreen's guard branch).
  const stashed: PendingInjury = {
    bodyPart: 'shoulder',
    originalMessage: turn1Message,
    timestamp: NOW,
  };

  // Second message — bare "7/10".
  const turn2 = resolveInjuryFromMessage('7/10', stashed, NOW + 5000);
  ok('turn 2 resolved', turn2.kind === 'resolved');
  if (turn2.kind === 'resolved') {
    eq('bodyPart=shoulder (carried)', turn2.resolved.bodyPart, 'shoulder');
    eq('severity=7', turn2.resolved.severity, 7);
    eq('source=pending', turn2.resolved.source, 'pending');
  }
  ok('pending cleared after consume', turn2.pendingAfter === null);
}

// ─────────────────────────────────────────────────────────────────────────
// 12. "My hammy is cooked" → "6/10" — the canonical bug repro
// ─────────────────────────────────────────────────────────────────────────

section('[12] Two-turn canonical repro: "My hammy is cooked" → "6/10"');
{
  // Turn 1: guard would fire ("cooked" is a NEGATIVE_DESCRIPTOR + bodyPart).
  // The resolver itself doesn't see turn 1 — but if it did, it would
  // return no_match (no severity).
  const turn1Resolution = resolveInjuryFromMessage(
    'My hammy is cooked',
    null,
    NOW,
  );
  eq('turn 1 no_match', turn1Resolution.kind, 'no_match');

  // Caller stashes after guard fire.
  const stashed: PendingInjury = {
    bodyPart: 'hammy',
    originalMessage: 'My hammy is cooked',
    timestamp: NOW,
  };

  // Turn 2.
  const turn2 = resolveInjuryFromMessage('6/10', stashed, NOW + 1000);
  ok('turn 2 resolved', turn2.kind === 'resolved');
  if (turn2.kind === 'resolved') {
    eq('bodyPart=hammy', turn2.resolved.bodyPart, 'hammy');
    eq('severity=6', turn2.resolved.severity, 6);
    eq('source=pending', turn2.resolved.source, 'pending');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
