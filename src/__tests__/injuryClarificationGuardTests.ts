/**
 * injuryClarificationGuardTests.ts
 *
 * Unit tests for the deterministic pre-LLM injury clarification guard.
 * The guard exists to make the FIRST clarifier turn deterministic — any
 * regression here re-opens the multi-question violation the prompt-only
 * approach couldn't fully prevent.
 *
 * Run: npx sucrase-node src/__tests__/injuryClarificationGuardTests.ts
 */

import {
  SEVERITY_QUESTION,
  RED_FLAG_URGENT_MEDICAL_REPLY,
  RED_FLAG_PHYSIO_MEDICAL_REPLY,
  detectInjurySignals,
  detectRedFlagSymptoms,
  normalizeText,
  checkInjuryClarificationGuard,
  GuardMessage,
} from '../utils/injuryClarificationGuard';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(label: string, condition: boolean, hint?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ''}`);
    fail++;
    failures.push(label);
  }
}

function user(content: string): GuardMessage {
  return { role: 'user', content };
}
function asst(content: string): GuardMessage {
  return { role: 'assistant', content };
}

// ─── 0. Red-flag hard stops run before severity clarification ───
{
  console.log('\n[0] Red-flag hard stops');
  const cases: Array<[string, 'urgent_medical' | 'physio_medical']> = [
    ["chest hurts and I'm dizzy, 4/10", 'urgent_medical'],
    ['short of breath and chest tight', 'urgent_medical'],
    ['my leg is numb/tingling', 'urgent_medical'],
    ['I heard a pop in my hamstring', 'physio_medical'],
    ["I can't bear weight", 'physio_medical'],
    ["I can't walk", 'physio_medical'],
    ['my knee has severe swelling', 'physio_medical'],
    ['suspected concussion after a head knock', 'urgent_medical'],
  ];
  for (const [input, advice] of cases) {
    const r = checkInjuryClarificationGuard([user(input)]);
    ok(`"${input}" → guard hard-stops`, r.fired === true);
    ok(`"${input}" → kind is red_flag_hard_stop`, r.kind === 'red_flag_hard_stop');
    ok(`"${input}" → does not ask severity`, r.reply !== SEVERITY_QUESTION && !/how bad/i.test(r.reply ?? ''));
    ok(`"${input}" → reply says stop training`, /stop training/i.test(r.reply ?? ''));
    ok(`"${input}" → detector advice is ${advice}`, r.redFlag?.advice === advice);
    if (advice === 'urgent_medical') {
      ok(`"${input}" → urgent medical reply`, r.reply === RED_FLAG_URGENT_MEDICAL_REPLY && /urgent medical/i.test(r.reply ?? ''));
    } else {
      ok(`"${input}" → physio/medical reply`, r.reply === RED_FLAG_PHYSIO_MEDICAL_REPLY && /physio|medical assessment/i.test(r.reply ?? ''));
    }
    ok(`"${input}" → exported detector matches`, detectRedFlagSymptoms(input)?.advice === advice);
  }
}

// ─── 1. Validation contract from the user spec ───
{
  console.log('\n[1] Validation contract (spec input/output pairs)');
  const cases: Array<[string, string]> = [
    ['I hurt my hammy', SEVERITY_QUESTION],
    ['Tweaked my shoulder', SEVERITY_QUESTION],
    ['tweaked my hamstring', SEVERITY_QUESTION],
    ['shoulder feels off', SEVERITY_QUESTION], // body + "feels off" descriptor pattern
    ["I'm injured", SEVERITY_QUESTION],
    ['picked up a niggle', SEVERITY_QUESTION],
    ['knee pain', SEVERITY_QUESTION], // body + "pain" descriptor
    ['my hammy is cooked', SEVERITY_QUESTION], // body + "cooked" descriptor
    ['I’ve picked up a niggle — I hurt my hammy', SEVERITY_QUESTION],
    ['got a twinge in my back', SEVERITY_QUESTION], // new "twinge" kw
  ];
  for (const [input, expected] of cases) {
    const r = checkInjuryClarificationGuard([user(input)]);
    ok(`"${input}" → guard fires with severity question`, r.fired === true);
    ok(`"${input}" → reply matches "${expected}"`, r.reply === expected);
  }
}

// ─── 2. Severity already given → guard does NOT fire ───
{
  console.log('\n[2] Severity already given → falls through to LLM');
  const cases: string[] = [
    'My hamstring is a 7/10',
    'sharp 8/10 in my left hammy',
    'calf is killing me, 7/10',
    'really bad pain in my groin',
    'mild tweak in my shoulder',
    'minor strain in my quad',
    'pulled my hamstring, pain is a 6',
  ];
  for (const input of cases) {
    const r = checkInjuryClarificationGuard([user(input)]);
    ok(`"${input}" → guard does NOT fire (severity present)`, r.fired === false);
  }
}

// ─── 3. Non-injury messages → guard does NOT fire ───
{
  console.log('\n[3] Non-injury messages pass through');
  const cases: string[] = [
    "What's my session today?",
    'Move Tuesday to Wednesday',
    'Swap squats for lunges on Monday',
    'Feeling cooked this week',
    'Busy Tuesday and Thursday',
    'I want a tougher leg session',
    "I'm sore", // matches injury kw "sore" but no body part — see [4]
  ];
  for (const input of cases) {
    const r = checkInjuryClarificationGuard([user(input)]);
    if (input === "I'm sore") continue; // covered in [4]
    ok(`"${input}" → guard does NOT fire`, r.fired === false);
  }
}

// ─── 4. "I'm sore" (no body part) → guard fires (severity-first default) ───
{
  console.log('\n[4] Both missing → severity-first default still fires');
  const r = checkInjuryClarificationGuard([user("I'm sore")]);
  ok('"I\'m sore" → guard fires (injury kw present, both signals missing)', r.fired === true);
  ok('"I\'m sore" → reply is the severity question', r.reply === SEVERITY_QUESTION);

  const r2 = checkInjuryClarificationGuard([user('picked up a niggle')]);
  ok('"picked up a niggle" → fires', r2.fired === true);
  ok('"picked up a niggle" → reply is severity question', r2.reply === SEVERITY_QUESTION);
}

// ─── 5. Loop safety (NARROW): only suppress fire on both-missing branch ───
{
  console.log('\n[5] Loop safety — narrow scope, both-missing only');

  // [5.1] Athlete reply with no body part and no injury kw after prior clarifier
  // → no injury kw → no fire (handled at the isInjury gate, not loop-safety).
  const r = checkInjuryClarificationGuard([
    user('I hurt my hammy'),
    asst('How bad is it? Rough pain out of 10.'),
    user('about a 7'),
  ]);
  ok('reply "about a 7" after severity question → no fire (no injury kw)', r.fired === false);

  // [5.2] Severity present in current message → no fire regardless of history.
  const r2 = checkInjuryClarificationGuard([
    user('I hurt my hammy'),
    asst('How bad is it? Rough pain out of 10.'),
    user('actually now my shoulder hurts too, like a 4'),
  ]);
  ok(
    'severity present in current message → no fire (severity satisfied)',
    r2.fired === false,
  );

  // [5.3] Loop-safety NARROW scope — the user reply is JUST an injury kw with
  // no body part, after a prior clarifier. Both signals missing → suppress
  // to avoid loops; the LLM should interpret the reply.
  const r3 = checkInjuryClarificationGuard([
    user("I'm sore"),
    asst('How bad is it? Rough pain out of 10.'),
    user("still sore"),
  ]);
  ok(
    'both-missing reply after prior clarifier → guard does NOT re-fire (loop safety)',
    r3.fired === false,
  );
}

// ─── 5b. Fresh body part after prior clarifier → ALWAYS fires ───
{
  console.log('\n[5b] Fresh body-part mention overrides loop-safety');

  // Critical fix case: athlete reports a NEW injury after prior hammy clarifier.
  // Loop-safety must NOT suppress this — the new body part is fresh injury context.
  const r = checkInjuryClarificationGuard([
    user('I hurt my hammy'),
    asst('How bad is it? Rough pain out of 10.'),
    user('Tweaked my shoulder'),
  ]);
  ok('"Tweaked my shoulder" after prior hammy clarifier → guard FIRES', r.fired === true);
  ok('reply is severity question for the new (shoulder) injury', r.reply === SEVERITY_QUESTION);

  // Under the new body+descriptor gate, a bare body-part reply (e.g. "hammy")
  // to "Where is it?" does NOT fire — "hammy" alone has no descriptor and no
  // injury keyword. The LLM gets the turn and can ask "how bad?" itself, or
  // resolve via the classifier. This is the deliberate fix that eliminates
  // false-positives like "rolled out my hammy" / "calves are fine".
  const r2 = checkInjuryClarificationGuard([
    user("I'm sore"),
    asst("Where is it?"),
    user('hammy'),
  ]);
  ok('"hammy" alone after "Where is it?" → guard does NOT fire (body alone, no descriptor)', r2.fired === false);

  // A body-part reply with an injury kw (e.g. "my hammy hurts") still fires
  // via body+descriptor ("hurt"/"hurts" is a descriptor) AND via kw+body.
  const r3 = checkInjuryClarificationGuard([
    user("I'm sore"),
    asst("Where is it?"),
    user('my hammy hurts'),
  ]);
  ok('"my hammy hurts" after "Where is it?" → guard fires for severity', r3.fired === true);
  ok('reply asks for severity', r3.reply === SEVERITY_QUESTION);
}

// ─── 5c. Fresh-thread validation contract per user spec ───
{
  console.log('\n[5c] Fresh-thread validation (user spec)');

  // Each case is its OWN thread — no cross-pollination.
  const fresh1 = checkInjuryClarificationGuard([user('I hurt my hammy')]);
  ok('Fresh: "I hurt my hammy" → fires', fresh1.fired === true);
  ok('Fresh: "I hurt my hammy" → exact severity question', fresh1.reply === SEVERITY_QUESTION);

  const fresh2 = checkInjuryClarificationGuard([user('Tweaked my shoulder')]);
  ok('Fresh: "Tweaked my shoulder" → fires', fresh2.fired === true);
  ok('Fresh: "Tweaked my shoulder" → exact severity question', fresh2.reply === SEVERITY_QUESTION);

  // Follow-up with severity provided → guard passes through to LLM.
  const followUp = checkInjuryClarificationGuard([user('My hammy is a 6/10')]);
  ok('Follow-up: "My hammy is a 6/10" → does NOT fire (LLM continues)', followUp.fired === false);
}

// ─── 6. Body-part vocabulary coverage ───
{
  console.log('\n[6] Body-part vocabulary');
  const parts = [
    'hamstring', 'hammy', 'hammies', 'shoulder', 'shoulders', 'knee', 'knees',
    'back', 'lower back', 'upper back', 'groin', 'quad', 'calf', 'ankle',
    'hip', 'neck', 'glute', 'achilles', 'elbow', 'wrist',
  ];
  for (const p of parts) {
    const sig = detectInjurySignals(`I hurt my ${p}`);
    ok(`"${p}" recognised as a body part`, sig.hasLocation === true);
  }
}

// ─── 7. Severity pattern coverage ───
{
  console.log('\n[7] Severity pattern coverage');
  const yesSeverity = [
    '7/10', '8 out of 10', 'pain is a 6', 'really bad', 'sharp pain',
    "can't walk", 'killing me', 'mild', 'minor', 'a bit tight',
  ];
  for (const phrase of yesSeverity) {
    const sig = detectInjurySignals(`hurt my hammy ${phrase}`);
    ok(`"${phrase}" recognised as severity`, sig.hasSeverity === true);
  }

  const noSeverity = [
    'tweaked it', 'feels off', 'something happened', 'not sure',
  ];
  for (const phrase of noSeverity) {
    const sig = detectInjurySignals(`hurt my hammy ${phrase}`);
    ok(`"${phrase}" NOT recognised as severity (correctly)`, sig.hasSeverity === false);
  }
}

// ─── 8. Empty / malformed input ───
{
  console.log('\n[8] Empty / malformed input');
  ok('empty messages array → no fire', checkInjuryClarificationGuard([]).fired === false);
  ok('null messages → no fire', checkInjuryClarificationGuard(null).fired === false);
  ok('undefined → no fire', checkInjuryClarificationGuard(undefined).fired === false);
  ok(
    'last message is assistant (not user) → no fire',
    checkInjuryClarificationGuard([user('hi'), asst('hello')]).fired === false,
  );
  ok(
    'empty string user message → no fire',
    checkInjuryClarificationGuard([user('')]).fired === false,
  );
}

// ─── 9. Multi-message threads — guard reads only the LAST user message ───
{
  console.log('\n[9] Multi-turn threads — only the last user message is inspected');
  const r = checkInjuryClarificationGuard([
    user('What is my session today?'),
    asst("You've got Lower today."),
    user('I hurt my hammy'),
  ]);
  ok('guard fires on injury msg even after unrelated prior turns', r.fired === true);
  ok('reply is the severity question', r.reply === SEVERITY_QUESTION);
}

// ─── 9b. Robust detection — slang, misspellings, phrase patterns ───
{
  console.log('\n[9b] Robust detection (slang / misspellings / phrases)');

  // Spec validation cases — every one must fire deterministically.
  const fires: Array<[string, string]> = [
    ['I’ve picked up a niggle — I hurt my hammy', 'niggle kw + hammy body'],
    ['my hammie feels cooked', 'hammie → hammy normalization (body part)'],
    ['sholder feels off', 'sholder → shoulder normalization (body part)'],
    ['felt something go in my leg', 'phrase pattern "felt something go"'],
    ['hammy pinged', 'hammy body part + pinged kw'],
    ['groin is tight', 'tight kw + groin body part'],
    // Other misspelling/slang coverage.
    ['my ankel is sore', 'ankel → ankle normalization'],
    ['achelies playing up', 'achelies → achilles normalization'],
    ['tweeked my back', 'tweeked → tweaked normalization'],
    ['my grain is cooked', 'grain → groin typo normalization'],
  ];
  for (const [input, why] of fires) {
    const r = checkInjuryClarificationGuard([user(input)]);
    ok(`"${input}" → fires (${why})`, r.fired === true);
    ok(`"${input}" → reply is severity question`, r.reply === SEVERITY_QUESTION);
  }

  const redFlagFires = ['something popped in my knee', 'felt it pop'];
  for (const input of redFlagFires) {
    const r = checkInjuryClarificationGuard([user(input)]);
    ok(`"${input}" → hard-stops, not normal severity clarifier`, r.kind === 'red_flag_hard_stop');
    ok(`"${input}" → physio/medical advice`, r.reply === RED_FLAG_PHYSIO_MEDICAL_REPLY);
  }

  // Severity given → no fire, even with slang/misspellings.
  const passThrough = checkInjuryClarificationGuard([user('My hammy is a 6/10')]);
  ok('"My hammy is a 6/10" → does NOT fire (severity present)', passThrough.fired === false);

  // Action / scheduling messages → no fire.
  const noFire: string[] = [
    "what's today's session?",
    'move tuesday to wednesday',
    'swap squats for lunges on monday',
  ];
  for (const input of noFire) {
    const r = checkInjuryClarificationGuard([user(input)]);
    ok(`"${input}" → does NOT fire (no injury context)`, r.fired === false);
  }

  // normalizeText sanity check — exposed for the deno mirror's expectations.
  ok(
    'normalizeText("my HAMMIE is sore") → contains "hammy"',
    normalizeText('my HAMMIE is sore').includes('hammy'),
  );
  ok(
    'normalizeText("sholder feels off") → contains "shoulder"',
    normalizeText('sholder feels off').includes('shoulder'),
  );
  ok(
    'normalizeText("tweeked my back") → contains "tweaked"',
    normalizeText('tweeked my back').includes('tweaked'),
  );
}

// ─── 10. Word-boundary safety — body-part-alone NO LONGER false-fires ───
{
  console.log('\n[10] Body-part-alone is filtered out (no descriptor, no kw)');

  // Previously the OR-gate fired on "back squats" / "calves are fine" because
  // body-part-alone was enough. The new body+descriptor gate eliminates these
  // false-positives — body part WITHOUT a negative descriptor or injury kw
  // now correctly passes through to the LLM.
  const r = checkInjuryClarificationGuard([user('I want to do back squats')]);
  ok('"back squats" — no descriptor, no kw → no fire', r.fired === false);

  // Training "pull" terminology is not an injury signal by itself.
  const r2 = checkInjuryClarificationGuard([user('Pull-ups feel good today')]);
  ok(
    '"Pull-ups feel good today" — training pull term → no fire',
    r2.fired === false,
  );

  // True non-injury: no kw, no body part → no fire.
  const r3 = checkInjuryClarificationGuard([user('Move Tuesday to Wednesday')]);
  ok('"Move Tuesday to Wednesday" → no fire (no kw, no body part)', r3.fired === false);

  // Body-part alone passes through cleanly.
  const r4 = checkInjuryClarificationGuard([user('did some hamstring work')]);
  ok('"did some hamstring work" — body alone → no fire', r4.fired === false);
}

// ─── 10b. Training session terminology must not route as injury ───
{
  console.log('\n[10b] Training session terminology is not injury');

  const noFires: string[] = [
    'Why is upper pull on Wednesday a rowing session?',
    'Why do I have upper pull listed as Wednesday but it opens as rowing?',
    'upper pull',
    'pull day',
    'pull session',
    'push/pull',
    'upper/lower',
    'session mismatch',
  ];
  for (const input of noFires) {
    const r = checkInjuryClarificationGuard([user(input)]);
    ok(`"${input}" → does NOT ask pain severity`, r.fired === false);
  }

  const sore = checkInjuryClarificationGuard([user('Upper pull feels sore')]);
  ok('"Upper pull feels sore" → soreness/injury language may ask severity', sore.fired === true);

  const pulled = checkInjuryClarificationGuard([user('I pulled my upper back')]);
  ok('"I pulled my upper back" → real injury phrase still fires', pulled.fired === true);
}

// ─── 11. Body + negative descriptor shortcut (high-priority gate) ───
{
  console.log('\n[11] Body + negative descriptor shortcut');

  // MUST FIRE: body part paired with a negative descriptor — these are normal
  // athlete phrasings that don't contain an INJURY_KEYWORD on their own but
  // are unambiguously injury reports.
  const fires: Array<[string, string]> = [
    ['hammy cooked', 'hammy + cooked'],
    ['my hammy is cooked', 'hammy + cooked'],
    ['shoulder feels off', 'shoulder + "feels off" pattern'],
    ['groin pinged', 'groin + pinged'],
    ['calf is gone', 'calf + gone'],
    ['hamstring playing up', 'hamstring + "playing up" pattern'],
    ['knee is locked up', 'knee + "locked up" pattern'],
    ['ankle not right', 'ankle + "not right" pattern'],
    ['quad is tight', 'quad + tight'],
    ['back is stiff', 'back + stiff'],
    ['grabbed my hammy', 'hammy + grabbed'],
    ['hammy went on me', 'hammy + went'],
    ['shoulder feels weird', 'shoulder + "feels weird" pattern'],
  ];
  for (const [input, why] of fires) {
    const r = checkInjuryClarificationGuard([user(input)]);
    ok(`"${input}" → fires (${why})`, r.fired === true);
    ok(`"${input}" → reply is severity question`, r.reply === SEVERITY_QUESTION);
  }

  // MUST NOT FIRE: body part alone with no negative descriptor and no
  // injury kw — these are training/recovery/scheduling phrases that should
  // pass through to the LLM.
  const noFires: string[] = [
    'rolled out my hammy', // recovery action, "rolled" not in descriptor list
    'calves are fine',
    'I did calf raises',
    'did some hamstring work',
    'back squats today',
    'shoulder press is heavy',
    'knee drive felt great',
  ];
  for (const input of noFires) {
    const r = checkInjuryClarificationGuard([user(input)]);
    ok(`"${input}" → does NOT fire (body alone, no descriptor)`, r.fired === false);
  }

  // hasNegativeDescriptor signal directly.
  const sig1 = detectInjurySignals('hammy cooked');
  ok('detectInjurySignals("hammy cooked").hasNegativeDescriptor === true', sig1.hasNegativeDescriptor === true);
  const sig2 = detectInjurySignals('shoulder feels off');
  ok('detectInjurySignals("shoulder feels off").hasNegativeDescriptor === true (pattern)', sig2.hasNegativeDescriptor === true);
  const sig3 = detectInjurySignals('back squats today');
  ok('detectInjurySignals("back squats today").hasNegativeDescriptor === false', sig3.hasNegativeDescriptor === false);
  const sig4 = detectInjurySignals('rolled out my hammy');
  ok('detectInjurySignals("rolled out my hammy").hasNegativeDescriptor === false', sig4.hasNegativeDescriptor === false);

  // Severity-bearing body+descriptor → no fire (severity satisfied).
  const r = checkInjuryClarificationGuard([user('hammy is cooked, 7/10')]);
  ok('"hammy is cooked, 7/10" → does NOT fire (severity present trumps shortcut)', r.fired === false);

  // Body+descriptor mid-thread after a prior clarifier → still fires (no loop-safety).
  const r2 = checkInjuryClarificationGuard([
    user("I'm sore"),
    asst('How bad is it? Rough pain out of 10.'),
    user('actually my hammy is cooked'),
  ]);
  ok('"my hammy is cooked" mid-thread → fires (shortcut bypasses loop-safety)', r2.fired === true);
  ok('reply is severity question', r2.reply === SEVERITY_QUESTION);
}

// ─── Summary ───
console.log(`\n[injuryClarificationGuard] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  • ${f}`));
  process.exit(1);
}
process.exit(0);
