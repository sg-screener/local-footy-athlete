/**
 * R-379 — WHY AN EMPTY DAY IS EMPTY, AS THE ATHLETE READS IT.
 *
 * **Sam, 2026-09-05:** *"put it on the day … it should replace fresh up, adapt
 * go again - when it's needed"*, and *"it should not include any fuckign M
 * dashes"*.
 *
 * These cells hold the four things that make it true rather than merely built:
 * the sentence REPLACES the standing line instead of stacking with it, an
 * ordinary rest day is untouched, a day that got filled after the fact stops
 * explaining itself as empty, and the copy carries no em dash.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ALL_REST_DAY_REASONS,
  REST_DAY_REASON_COPY_ID,
  restDayReasonsForWeek,
  type RestDayReason,
} from '../rules/restDayReason';
import { signedCopy } from '../rules/signedCopy';
import { registerProjectionCopy } from '../rules/projectionCopy';

// The sheet is registered on demand, the same way every production reader
// gets it. Without this the ids are genuinely absent and cell [1] would red
// for the harness's reason rather than the app's.
registerProjectionCopy();

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean, detail = ''): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `: ${detail}` : ''}`);
}

console.log('\n── R-379: the empty day says why ──');

// ── 1. EVERY REASON HAS A SENTENCE, AND IT IS A REAL ONE. ────────────────────
// A copy id that resolves to nothing would render an empty line in place of the
// standing one, which is worse than not shipping the feature at all.
for (const reason of ALL_REST_DAY_REASONS) {
  const text = signedCopy(REST_DAY_REASON_COPY_ID[reason]);
  ok(`[1] "${reason}" resolves to a real sentence`,
    typeof text === 'string' && text.trim().length > 0 && !text.includes('.reason.'),
    `got ${JSON.stringify(text)}`);
}

// ── 2. NO EM DASHES. Sam's rule, held against the character itself. ──────────
// The en dash and the double hyphen he also called out are refused with it: he
// objected to the punctuation, not to one codepoint.
for (const reason of ALL_REST_DAY_REASONS) {
  const text = String(signedCopy(REST_DAY_REASON_COPY_ID[reason]));
  ok(`[2] "${reason}" carries no em dash`,
    !text.includes('—') && !text.includes('–') && !text.includes('--'),
    `got ${JSON.stringify(text)}`);
}
ok('[2] the standing rest line carries no em dash either',
  !String(signedCopy('day.rest.default')).includes('—'));

// ── 3. THE LOOKUP READS THE STORED WEEK AND INVENTS NOTHING. ─────────────────
const program = {
  microcycles: [
    { startDate: '2026-09-28T12:00:00.000Z', restDayReasonByDay: { 4: 'injury' as RestDayReason } },
    { startDate: '2026-10-05T12:00:00.000Z', restDayReasonByDay: {} },
  ],
};
ok('[3] the week\'s own reasons are found by its Monday',
  restDayReasonsForWeek(program, '2026-09-28')[4] === 'injury');
ok('[3] a different week does not inherit them',
  restDayReasonsForWeek(program, '2026-10-05')[4] === undefined);
ok('[3] an unknown week answers empty, never undefined',
  JSON.stringify(restDayReasonsForWeek(program, '2026-11-30')) === '{}');
ok('[3] no program answers empty rather than throwing',
  JSON.stringify(restDayReasonsForWeek(null, '2026-09-28')) === '{}');

// ── 4. THE CARD REPLACES, IT DOES NOT STACK — asserted on the source. ────────
//
// The two lines must never both render: "Freshen up. Adapt. Go again." directly
// above "No session today" is the app contradicting itself in two sentences.
// Read off the card because the alternative is mounting the whole Program tab,
// and what is being pinned is a STRUCTURAL property of one branch.
const card = readFileSync(join(__dirname, '../screens/home/HomeScreenV2.tsx'), 'utf8');
ok('[4] the rest line is no longer a bare literal in the card',
  !card.includes('>Freshen up. Adapt. Go again.<'),
  'the hardcoded string is still rendered directly');
ok('[4] the card chooses ONE line through signed copy',
  /day\.rest\.default/.test(card) && /REST_DAY_REASON_COPY_ID\[day\.restReason\]/.test(card));
ok('[4] the reason is rendered inside the no-workout branch only',
  card.indexOf('home-rest-day-reason') > card.indexOf('!hasWorkout && normal'),
  'the reason line escaped the rest-day branch');

// ── 5. A DAY THAT IS NOT EMPTY MAY NOT EXPLAIN ITSELF AS EMPTY. ──────────────
// The stored reason is the scheduler's statement at GENERATION. If a later pass
// or the athlete put something on that day, the day is no longer empty and the
// sentence would be a lie about a session sitting directly under it.
const readModel = readFileSync(
  join(__dirname, '../utils/visibleProgramReadModel.ts'), 'utf8');
ok('[5] the reason is attached only to a day with no workout',
  /reason && !day\.workout/.test(readModel),
  'a filled day can still carry an emptiness reason');

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
