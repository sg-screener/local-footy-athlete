/**
 * coachScreenInjuryClientGuardTests.ts
 *
 * Validates the CLIENT-side injury guard wired into CoachScreen.handleSend.
 * Simulates the same call shape the screen uses: build a GuardMessage[]
 * history (existing messages + the new user message, filtering the welcome
 * message and system messages), call checkInjuryClarificationGuard, and
 * assert (a) whether it fires and (b) the reply is the canonical severity
 * question. This is the predicate that decides "fetch vs no fetch" in the
 * real screen — if these assertions pass, no network call happens for
 * fired cases.
 *
 * Run: npx sucrase-node src/__tests__/coachScreenInjuryClientGuardTests.ts
 */

import {
  SEVERITY_QUESTION,
  checkInjuryClarificationGuard,
  GuardMessage,
} from '../utils/injuryClarificationGuard';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    fail++;
    failures.push(label);
  }
}

// Mirrors the way CoachScreen.handleSend builds the guard input:
// history = [...messages, userMessage], filtered to exclude welcome (id 0)
// and system messages, mapped to {role, content}.
function simulateClientGuard(
  prior: GuardMessage[],
  newUserContent: string,
): { fired: boolean; reply?: string; reason: string } {
  const history: GuardMessage[] = [
    ...prior,
    { role: 'user', content: newUserContent },
  ];
  const r = checkInjuryClarificationGuard(history);
  return { fired: r.fired, reply: r.reply, reason: r.reason };
}

// ─── Spec validation cases (verbatim from request) ───
{
  console.log('\n[A] Spec validation cases');

  // MUST FIRE — local reply only, no API request.
  const fires: Array<[string, string]> = [
    ['Hammy cooked', 'body + descriptor'],
    ['I hurt my hammy', 'kw "hurt" + body / body + desc "hurt"'],
    ['Shoulder feels off', 'body + "feels off" pattern'],
  ];
  for (const [input, why] of fires) {
    const r = simulateClientGuard([], input);
    ok(`"${input}" → guard FIRES (${why})`, r.fired === true);
    ok(`"${input}" → reply is exactly SEVERITY_QUESTION`, r.reply === SEVERITY_QUESTION);
  }

  // MUST NOT FIRE — sends to API normally.
  const passes: string[] = [
    'My hammy is a 6/10', // severity present
    'rolled out my hammy', // body alone
    "what's today's session?", // unrelated
  ];
  for (const input of passes) {
    const r = simulateClientGuard([], input);
    ok(`"${input}" → guard does NOT fire (passes through to API)`, r.fired === false);
  }
}

// ─── Mid-thread (history) cases ───
{
  console.log('\n[B] Mid-thread interactions with history');

  // Welcome message + chat — the screen filters id "0" out before calling
  // the guard. Confirm fresh injury after a non-injury exchange fires.
  const r1 = simulateClientGuard(
    [
      { role: 'user', content: 'What is my session today?' },
      { role: 'assistant', content: "You've got Lower today." },
    ],
    'I hurt my hammy',
  );
  ok('after unrelated chat → "I hurt my hammy" fires', r1.fired === true);
  ok('  reply === SEVERITY_QUESTION', r1.reply === SEVERITY_QUESTION);

  // Body+descriptor mid-thread after a prior clarifier — shortcut bypasses
  // loop-safety so the new injury report still fires.
  const r2 = simulateClientGuard(
    [
      { role: 'user', content: "I'm sore" },
      { role: 'assistant', content: 'How bad is it? Rough pain out of 10.' },
    ],
    'actually my hammy is cooked',
  );
  ok(
    'after prior clarifier → "my hammy is cooked" still fires (shortcut)',
    r2.fired === true,
  );

  // Severity-bearing reply after prior clarifier → no fire (LLM adjusts).
  const r3 = simulateClientGuard(
    [
      { role: 'user', content: 'I hurt my hammy' },
      { role: 'assistant', content: 'How bad is it? Rough pain out of 10.' },
    ],
    'about a 7',
  );
  ok('severity reply → does NOT fire (passes to API)', r3.fired === false);

  // Loop-safety: bare-injury-kw reply after prior clarifier → no fire.
  const r4 = simulateClientGuard(
    [
      { role: 'user', content: "I'm sore" },
      { role: 'assistant', content: 'How bad is it? Rough pain out of 10.' },
    ],
    'still sore',
  );
  ok('bare "still sore" reply → does NOT fire (loop-safety)', r4.fired === false);
}

// ─── Body + negative descriptor matrix ───
{
  console.log('\n[C] Body + negative descriptor matrix (must fire)');

  const cases: string[] = [
    'hammy cooked',
    'shoulder feels off',
    'calf is gone',
    'hamstring playing up',
    'knee is locked up',
    'ankle not right',
    'quad is tight',
    'back is stiff',
    'grabbed my hammy',
    'shoulder feels weird',
    'groin pinged',
    'hip is sore',
  ];
  for (const c of cases) {
    const r = simulateClientGuard([], c);
    ok(`"${c}" → fires`, r.fired === true && r.reply === SEVERITY_QUESTION);
  }
}

// ─── Body alone or non-injury (must pass through) ───
{
  console.log('\n[D] Body-alone / non-injury (must pass through to API)');

  const cases: string[] = [
    'rolled out my hammy',
    'calves are fine',
    'I did calf raises',
    'did some hamstring work',
    'back squats today',
    'shoulder press is heavy',
    'knee drive felt great',
    'Move Tuesday to Wednesday',
    "what's my session today?",
    'Swap squats for lunges on Monday',
    'Feeling cooked this week', // no body part — vague fatigue, LLM handles
  ];
  for (const c of cases) {
    const r = simulateClientGuard([], c);
    ok(`"${c}" → does NOT fire`, r.fired === false);
  }
}

// ─── Severity-already-present cases ───
{
  console.log('\n[E] Severity present → never fires (LLM adjusts program)');
  const cases: string[] = [
    'My hammy is a 6/10',
    'sharp 8/10 in my left hammy',
    "calf is killing me, can't walk",
    'really bad pain in my groin',
    'mild tweak in my shoulder',
    'hammy is cooked, 7/10', // body+desc but severity present → no fire
  ];
  for (const c of cases) {
    const r = simulateClientGuard([], c);
    ok(`"${c}" → does NOT fire (severity present)`, r.fired === false);
  }
}

// ─── Summary ───
console.log(`\n[coachScreenClientGuard] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  • ${f}`));
  process.exit(1);
}
process.exit(0);
