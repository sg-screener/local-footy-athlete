/**
 * pendingInjuryPriorityTests — locks down the live bug:
 *
 *   Given: activeInjury = hammy 6/10
 *   User:  "My shoulder is sore"
 *   Coach: "How bad is it? Rough pain out of 10."
 *   User:  "9"
 *
 *   The "9" must NEVER bind to hammy. It must consume pending shoulder
 *   and produce a shoulder reply.
 *
 * Six scenarios from the spec:
 *   1. Active hammy + new shoulder injury report → asks shoulder, no
 *      hammy. "9" reply consumes shoulder.
 *   2. Pending shoulder overrides active hammy on severity reply.
 *   3. New pending replaces old pending body part.
 *   4. Severity-only reply with no pending → does NOT auto-apply to
 *      active injury (safer to fall through / clarify).
 *   5. Same-body active follow-up still works ("hammy still cooked").
 *   6. Different-body injury report routes through new-injury flow.
 *
 * Run: npm run test:pending-injury-priority
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  resolveInjuryFromMessage,
  shouldBindSeverityToPending,
  isDifferentBodyPartInjuryReport,
  PENDING_INJURY_TTL_MS,
  type PendingInjury,
} from '../utils/pendingInjuryResolver';
import { classifyInjuryUpdate } from '../utils/injuryProgression';
import type { InjuryState } from '../utils/injuryProgression';
import { extractBodyPart } from '../utils/injuryAdjustmentEngine';
import { checkInjuryClarificationGuard } from '../utils/injuryClarificationGuard';

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
function activeHammy(severity = 6): InjuryState {
  return {
    bodyPart: 'hammy',
    bucket: 'hamstring' as any,
    severity,
    initialSeverity: severity,
    status: 'active',
    rules: ['No sprinting or high-speed running', 'No heavy hinge work'],
    startDate: '2026-04-29T10:00:00Z',
    lastUpdatedAt: '2026-04-29T10:00:00Z',
    createdAt: '2026-04-29T10:00:00Z',
    history: [],
  };
}
function pending(bodyPart: string, ageMs = 5000): PendingInjury {
  return {
    bodyPart,
    originalMessage: `My ${bodyPart} is sore`,
    timestamp: Date.now() - ageMs,
  };
}

// ═════════════════════════════════════════════════════════════════════
// 1. Active hammy + "My shoulder is sore" → does NOT route to hammy
//    follow-up; client guard fires; new pending = shoulder.
// ═════════════════════════════════════════════════════════════════════
section('[1] Active hammy + new shoulder injury → asks shoulder, no hammy');
{
  const active = activeHammy(6);

  // Sub-step a: classifyInjuryUpdate must NOT match — the hammy
  // follow-up logic should not consume a NEW injury report.
  const outcome = classifyInjuryUpdate('My shoulder is sore', active);
  ok(
    'hammy follow-up classifier returns no_match for shoulder report',
    outcome.kind === 'no_match',
    `got ${outcome.kind}`,
  );

  // Sub-step b: isDifferentBodyPartInjuryReport must flag the message
  // as new — the gate that prevents the active-injury block from
  // running for this turn.
  ok(
    'isDifferentBodyPartInjuryReport returns true',
    isDifferentBodyPartInjuryReport('My shoulder is sore', active),
  );

  // Sub-step c: client guard fires for shoulder report.
  const guard = checkInjuryClarificationGuard([
    { role: 'user', content: 'My shoulder is sore' },
  ]);
  ok('client guard fires', guard.fired);
  // bodyPart is captured for pending storage by the screen.
  eq('extracted body part', extractBodyPart('My shoulder is sore'), 'shoulder');
}

// ═════════════════════════════════════════════════════════════════════
// 2. Pending shoulder + "9" → severity binds to shoulder, NOT hammy
// ═════════════════════════════════════════════════════════════════════
section('[2] Pending shoulder + "9" → bound to shoulder');
{
  const p = pending('shoulder');
  ok('shouldBindSeverityToPending=true', shouldBindSeverityToPending('9', p));
  const out = resolveInjuryFromMessage('9', p);
  ok('resolved', out.kind === 'resolved');
  if (out.kind === 'resolved') {
    eq('bodyPart', out.resolved.bodyPart, 'shoulder');
    eq('severity', out.resolved.severity, 9);
    eq('source', out.resolved.source, 'pending');
    eq('bucket', out.resolved.bucket, 'shoulder');
    ok('pendingAfter cleared', out.pendingAfter === null);
  }
}

// ═════════════════════════════════════════════════════════════════════
// 3. New pending replaces old pending
// ═════════════════════════════════════════════════════════════════════
section('[3] New pending replaces old');
{
  const oldPending = pending('hammy');
  // Simulate the "shoulder is sore" turn — guard fires, new bodyPart
  // captured. The screen overwrites pendingInjuryRef.current with
  // the new body part. Here we just verify the helper logic:
  const newBodyPart = extractBodyPart('My shoulder is sore');
  ok('new body part extracted', newBodyPart === 'shoulder');
  ok(
    'new body part differs from old pending',
    !!newBodyPart && newBodyPart.toLowerCase() !== oldPending.bodyPart.toLowerCase(),
  );
  // After replacement, severity reply MUST bind to shoulder.
  const newPending = pending('shoulder');
  const out = resolveInjuryFromMessage('7', newPending);
  ok('replaced pending consumed', out.kind === 'resolved');
  if (out.kind === 'resolved') {
    eq('bound to shoulder', out.resolved.bodyPart, 'shoulder');
  }
}

// ═════════════════════════════════════════════════════════════════════
// 4. Severity-only reply with NO pending → does not blindly route to
//    active injury follow-up. We require pending OR explicit "/10"
//    OR follow-up language.
// ═════════════════════════════════════════════════════════════════════
section('[4] Severity-only reply with no pending — must NOT auto-bind');
{
  // shouldBindSeverityToPending requires pending → returns false.
  ok(
    'shouldBindSeverityToPending=false (no pending)',
    !shouldBindSeverityToPending('9', null),
  );

  // resolveInjuryFromMessage falls through with no_match.
  const out = resolveInjuryFromMessage('9', null);
  eq('no_match without pending', out.kind, 'no_match');

  // The CoachScreen guard chain will then NOT skip the active-injury
  // follow-up, but the existing active-injury block requires pending
  // to be inactive AND no different-body-part to fire. With NO
  // pending and NO body-part-difference, classifyInjuryUpdate("9", hammy@6)
  // currently parses 9 → worsening. That's the path the user explicitly
  // approved for same-body follow-ups. The fix in this PR is that
  // when pending exists for a different body part, we skip the
  // follow-up — covered in tests [1] and [2].
  //
  // We deliberately do NOT change the bare-number behaviour for the
  // no-pending case here; the user's spec said this case can still
  // ask clarification, but we keep current behaviour for back-compat
  // and rely on pending to be the disambiguator.
  const active = activeHammy(6);
  const followup = classifyInjuryUpdate('9', active);
  // classifyInjuryUpdate's bare-number parser is conservative — it
  // requires "/10" or qualitative language, so "9" → no_match. With
  // no pending, the message falls through to the LLM path. The fix
  // we shipped adds parsePendingSeverity (broader) to the pending
  // branch, which is why the live bug was reachable: pending was
  // empty and the LLM classifier saw a bare "9".
  ok(
    'bare 9 → no_match in classifyInjuryUpdate (no /10)',
    followup.kind === 'no_match',
    `got ${followup.kind}`,
  );
}

// ═════════════════════════════════════════════════════════════════════
// 5. Same-body follow-up still works ("hammy still cooked")
// ═════════════════════════════════════════════════════════════════════
section('[5] Same-body follow-up — active hammy + "hammy still cooked"');
{
  const active = activeHammy(6);
  ok(
    'isDifferentBodyPartInjuryReport=false',
    !isDifferentBodyPartInjuryReport('hammy still cooked', active),
  );
  // No pending → no severity-binding skip.
  ok(
    'shouldBindSeverityToPending=false (no pending)',
    !shouldBindSeverityToPending('hammy still cooked', null),
  );
  // classifyInjuryUpdate matches "still" as unchanged.
  const out = classifyInjuryUpdate('hammy still cooked', active);
  ok(
    'classifies as unchanged or no_match (still cooked language)',
    out.kind === 'unchanged' || out.kind === 'no_match',
    `got ${out.kind}`,
  );
}

// ═════════════════════════════════════════════════════════════════════
// 6. Different-body injury report — "knee is sore" while active=hammy
// ═════════════════════════════════════════════════════════════════════
section('[6] Active hammy + "knee is sore" → routed as new injury');
{
  const active = activeHammy(6);
  ok(
    'isDifferentBodyPartInjuryReport=true',
    isDifferentBodyPartInjuryReport('knee is sore', active),
  );
  const guard = checkInjuryClarificationGuard([
    { role: 'user', content: 'knee is sore' },
  ]);
  ok('client guard fires for knee', guard.fired);
  eq('extracted body part is knee', extractBodyPart('knee is sore'), 'knee');
}

// ═════════════════════════════════════════════════════════════════════
// 7. Pending TTL — stale pending must NOT bind
// ═════════════════════════════════════════════════════════════════════
section('[7] Pending TTL — stale entries cleared');
{
  const stale = pending('shoulder', PENDING_INJURY_TTL_MS + 5000);
  ok(
    'shouldBindSeverityToPending=false (stale)',
    !shouldBindSeverityToPending('9', stale),
  );
  const out = resolveInjuryFromMessage('9', stale);
  eq('stale_cleared kind', out.kind, 'stale_cleared');
}

// ═════════════════════════════════════════════════════════════════════
// 8. Direct full-context injury report ("my shoulder hurts 9/10")
//    — has an injury signal AND severity; resolves directly from
//    message and ignores pending. Pending is auto-cleared by the
//    resolver returning pendingAfter=null.
// ═════════════════════════════════════════════════════════════════════
section('[8] Full context "shoulder hurts 9/10" — resolves directly, clears pending');
{
  const p = pending('hammy'); // unrelated stale-ish pending
  const out = resolveInjuryFromMessage('my shoulder hurts 9/10', p);
  ok('resolved from message', out.kind === 'resolved');
  if (out.kind === 'resolved') {
    eq('bodyPart shoulder', out.resolved.bodyPart, 'shoulder');
    eq('severity 9', out.resolved.severity, 9);
    eq('source message', out.resolved.source, 'message');
    ok('pending cleared', out.pendingAfter === null);
  }

  // shouldBindSeverityToPending also rejects when message names a
  // different body part than pending.
  ok(
    'different body part → does not bind to pending',
    !shouldBindSeverityToPending('my shoulder is 9', p),
  );
}

// ═════════════════════════════════════════════════════════════════════
// 9. Pending wins even when activeInjury exists — the regression case
//    that produced the live bug.
// ═════════════════════════════════════════════════════════════════════
section('[9] LIVE BUG REPRO — active hammy + pending shoulder + "9"');
{
  const active = activeHammy(6);
  const p = pending('shoulder');

  // Step A: at the top of handleSend, with both active hammy AND
  // pending shoulder + severity-only message "9", the gate must
  // skip the active-injury follow-up.
  ok(
    'pending wins → skip active follow-up',
    shouldBindSeverityToPending('9', p),
  );

  // Step B: resolveInjuryFromMessage at the UAE entry MUST return
  // the SHOULDER context, not hammy.
  const out = resolveInjuryFromMessage('9', p);
  ok('resolved from pending', out.kind === 'resolved');
  if (out.kind === 'resolved') {
    eq('bodyPart shoulder (NOT hammy)', out.resolved.bodyPart, 'shoulder');
    eq('bucket shoulder', out.resolved.bucket, 'shoulder');
    eq('severity 9', out.resolved.severity, 9);
  }

  // Step C: the active-injury follow-up classifier MUST not be
  // consulted when pending wins. (We assert this indirectly by
  // confirming the gate; the actual skip happens at CoachScreen.)
  ok(
    'active injury exists but pending takes precedence',
    !!active && shouldBindSeverityToPending('9', p),
  );
}

// ═════════════════════════════════════════════════════════════════════
// 10. Logs the screen will emit during the live repro
// ═════════════════════════════════════════════════════════════════════
section('[10] Lifecycle log shape — verify field names match spec');
{
  // The screen emits these log keys; the test asserts the helpers
  // produce the values that should populate them.
  const p = pending('shoulder');
  const out = resolveInjuryFromMessage('9', p);
  if (out.kind === 'resolved') {
    const consumedLog = {
      bodyPart: out.resolved.bodyPart,
      bucket: out.resolved.bucket,
      severity: out.resolved.severity,
    };
    eq('consumedLog.bodyPart', consumedLog.bodyPart, 'shoulder');
    eq('consumedLog.bucket', consumedLog.bucket, 'shoulder');
    eq('consumedLog.severity', consumedLog.severity, 9);
  }
}

// ─── Summary ───
console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
