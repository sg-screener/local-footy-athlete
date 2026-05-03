/**
 * coachPromptContractTests.ts
 *
 * Locks in the SYSTEM_PROMPT contract for the Coach edge function.
 * The Coach is an LLM, so we can't unit-test the runtime classification
 * directly — but we CAN assert that the SYSTEM_PROMPT contains the
 * required rules in the right shape. If a future edit accidentally
 * deletes the INJURY HANDLING block or the "How bad is it?" wording
 * for severity-unknown cases, this suite will catch it before it ships.
 *
 * NOTE: The full canonical spec lives in the SYSTEM_PROMPT itself —
 * these assertions only check the highest-value invariants, not every
 * phrase. The prompt is the source of truth.
 *
 * Run: npx sucrase-node src/__tests__/coachPromptContractTests.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const PROMPT_FILE = path.resolve(
  __dirname,
  '../../supabase/functions/coach-chat/index.ts',
);

const src = fs.readFileSync(PROMPT_FILE, 'utf8');

// Extract the SYSTEM_PROMPT template literal block.
const startMatch = src.match(/^const SYSTEM_PROMPT = `/m);
if (!startMatch) {
  throw new Error('Could not find SYSTEM_PROMPT declaration in edge function');
}
const startIdx = src.indexOf(startMatch[0]) + startMatch[0].length;
const endRel = src.slice(startIdx).search(/`;\s*$/m);
if (endRel === -1) {
  throw new Error('Could not find SYSTEM_PROMPT terminator');
}
const SYSTEM_PROMPT = src.slice(startIdx, startIdx + endRel);

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

function contains(needle: string): boolean {
  return SYSTEM_PROMPT.toLowerCase().includes(needle.toLowerCase());
}

// ─── 1. Identity & role ───
{
  console.log('\n[1] Identity & role');
  ok(
    'identifies as elite AFL S&C coach',
    /elite afl strength\s*&\s*conditioning coach/i.test(SYSTEM_PROMPT),
  );
  ok('explicitly NOT a physio', /you are not:[\s\S]{0,80}- a physio/i.test(SYSTEM_PROMPT));
  ok('explicitly NOT a lecturer', /- a lecturer/i.test(SYSTEM_PROMPT));
  ok(
    'explicitly NOT a motivational speaker',
    /- a motivational speaker/i.test(SYSTEM_PROMPT),
  );
}

// ─── 2. Job spec ───
{
  console.log('\n[2] Coach job spec');
  ok('keep training consistent', contains('Keep the athlete training consistently'));
  ok('adjust program intelligently', contains('Adjust their program intelligently'));
  ok('protect from injury and overload', contains('Protect them from injury and overload'));
  ok('clear, direct, practical', contains('Be clear, direct, and practical'));
}

// ─── 3. CORE PRINCIPLES section ───
{
  console.log('\n[3] CORE PRINCIPLES section');
  ok('has CORE PRINCIPLES header', /CORE PRINCIPLES/.test(SYSTEM_PROMPT));
  ok(
    'principle 1 — always think in terms of the program',
    /1\.\s*ALWAYS THINK IN TERMS OF THE PROGRAM/i.test(SYSTEM_PROMPT),
  );
  ok(
    'principle 1 — what happens to their training now?',
    /What happens to their training now\?/i.test(SYSTEM_PROMPT),
  );
  ok(
    'principle 2 — keep responses tight',
    /2\.\s*KEEP RESPONSES TIGHT/i.test(SYSTEM_PROMPT),
  );
  ok('caps at 2–4 bullets', /2[–-]4 bullet points max/i.test(SYSTEM_PROMPT));
  ok('forbids long paragraphs', /no long paragraphs/i.test(SYSTEM_PROMPT));
  ok(
    'principle 3 — ask questions only when necessary',
    /3\.\s*ASK QUESTIONS ONLY WHEN NECESSARY/i.test(SYSTEM_PROMPT),
  );
  ok('max ONE question per message', /max one question per message/i.test(SYSTEM_PROMPT));
  ok(
    'enough info → do not ask',
    /if you already have enough info[\s\S]{0,40}do not ask/i.test(SYSTEM_PROMPT),
  );
  ok(
    'principle 4 — action over diagnosis',
    /4\.\s*PRIORITISE ACTION OVER DIAGNOSIS/i.test(SYSTEM_PROMPT),
  );
  ok(
    'not diagnosing injuries',
    /you are not diagnosing injuries/i.test(SYSTEM_PROMPT),
  );
}

// ─── 4. INJURY HANDLING section ───
{
  console.log('\n[4] INJURY HANDLING section');
  ok('has INJURY HANDLING header', /INJURY HANDLING/.test(SYSTEM_PROMPT));
  ok(
    'step 1 — severity not given → ask one question',
    /step 1[\s\S]{0,80}severity is not given/i.test(SYSTEM_PROMPT),
  );
  ok(
    'canonical severity question is exact',
    SYSTEM_PROMPT.includes('"How bad is it? Rough pain out of 10."'),
  );
  ok(
    'step 1 — STOP. Do nothing else.',
    /STOP\.\s*Do nothing else\./i.test(SYSTEM_PROMPT),
  );
  ok(
    'step 2 — severity given → adjust immediately',
    /step 2[\s\S]{0,120}severity is given[\s\S]{0,120}immediately adjust the program/i.test(
      SYSTEM_PROMPT,
    ),
  );
  ok(
    'response format includes "Program changes:"',
    /Program changes:/.test(SYSTEM_PROMPT),
  );
  ok(
    'response format includes "Avoid this week:"',
    /Avoid this week:/.test(SYSTEM_PROMPT),
  );
  ok(
    'response format mentions removed/modified/swapped',
    /removed[\s\S]{0,40}modified[\s\S]{0,40}swapped/i.test(SYSTEM_PROMPT),
  );
  ok('rule: NO multiple questions', /NO multiple questions/i.test(SYSTEM_PROMPT));
  ok('rule: NO detailed diagnosis', /NO detailed diagnosis/i.test(SYSTEM_PROMPT));
  ok('rule: NO long explanations', /NO long explanations/i.test(SYSTEM_PROMPT));
}

// ─── 5. PROGRAM ADJUSTMENT STYLE section ───
{
  console.log('\n[5] PROGRAM ADJUSTMENT STYLE section');
  ok(
    'has PROGRAM ADJUSTMENT STYLE header',
    /PROGRAM ADJUSTMENT STYLE/.test(SYSTEM_PROMPT),
  );
  ok('be specific — Removed sprinting', contains('"Removed sprinting"'));
  ok('be specific — Swapped running → bike', contains('Swapped running → bike'));
  ok('be specific — Lightened lower session', contains('"Lightened lower session"'));
  ok('be specific — Kept upper body work', contains('"Kept upper body work"'));
  ok(
    'forbids vague "take it easy"',
    /avoid vague advice[\s\S]{0,80}"take it easy"/i.test(SYSTEM_PROMPT),
  );
  ok('forbids vague "listen to your body"', contains('"listen to your body"'));
}

// ─── 6. UNKNOWN / GENERAL MESSAGES section ───
{
  console.log('\n[6] UNKNOWN / GENERAL MESSAGES section');
  ok(
    'has UNKNOWN / GENERAL MESSAGES header',
    /UNKNOWN \/ GENERAL MESSAGES/.test(SYSTEM_PROMPT),
  );
  ok('do not guess on unclear input', /do not guess/i.test(SYSTEM_PROMPT));
  ok(
    'one simple clarification example',
    /What do you want to adjust[\s\S]{0,40}volume, sessions, or recovery/i.test(
      SYSTEM_PROMPT,
    ),
  );
  ok(
    'do not change program yet on unknowns',
    /Do NOT change the program yet/i.test(SYSTEM_PROMPT),
  );
}

// ─── 7. TONE section ───
{
  console.log('\n[7] TONE section');
  ok('has TONE header', /^TONE$/m.test(SYSTEM_PROMPT));
  ok('tone — Direct', /- Direct/.test(SYSTEM_PROMPT));
  ok('tone — Calm', /- Calm/.test(SYSTEM_PROMPT));
  ok('tone — Practical', /- Practical/.test(SYSTEM_PROMPT));
  ok(
    'tone — Slightly conversational AFL',
    /Slightly conversational \(AFL tone\)/i.test(SYSTEM_PROMPT),
  );
  ok('tone — Never robotic', /Never robotic/i.test(SYSTEM_PROMPT));
}

// ─── 8. GOAL section ───
{
  console.log('\n[8] GOAL section');
  ok('has GOAL header', /^GOAL$/m.test(SYSTEM_PROMPT));
  ok(
    'goal — keep athlete progressing',
    /Keep the athlete progressing/i.test(SYSTEM_PROMPT),
  );
  ok(
    'goal — managing fatigue, injury risk, real-life',
    /managing fatigue, injury risk, and real-life constraints/i.test(SYSTEM_PROMPT),
  );
  ok(
    'goal — coach making a smart call on the fly',
    /a coach making a smart call on the fly/i.test(SYSTEM_PROMPT),
  );
}

// ─── 9. Forbidden content (must NOT appear in the prompt) ───
{
  console.log('\n[9] Forbidden patterns (cleanup of old prompt)');
  ok(
    'no leftover STRICT OVERRIDE block (old architecture)',
    !/STRICT OVERRIDE/i.test(SYSTEM_PROMPT),
    'old prompt structure should be gone',
  );
  ok(
    'no leftover AMBIGUITY TRIAGE section header',
    !/AMBIGUITY TRIAGE/i.test(SYSTEM_PROMPT),
  );
  ok(
    'no leftover "section 4A" / "subsection" jargon',
    !/section 4[ABCDEF]/i.test(SYSTEM_PROMPT),
  );
  ok(
    'no leftover "Program updated — check your week." closing literal',
    !/Program updated — check your week\./i.test(SYSTEM_PROMPT),
  );
}

// ─── Summary ───
console.log(`\n[coachPromptContract] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  • ${f}`));
  process.exit(1);
}
process.exit(0);
