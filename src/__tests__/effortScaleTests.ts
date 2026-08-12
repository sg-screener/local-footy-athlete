/**
 * THE EFFORT SCALE AND ITS READOUT — Sam's two 2026-08-12 rulings, celled.
 *
 *   "make it 1-10 everywhere instead of 1-5"
 *   "It must start empty, not on 5 — an untouched form must not look like a
 *    real answer. Show the word beside the number as it moves: 7 — hard."
 *
 * The second sentence is the one that needs a cell most: an empty state is
 * invisible in a screenshot and trivially lost in a refactor that gives the
 * slider a "sensible default". `effortReadout(null)` is where that regression
 * would show first.
 *
 * Run: npm run test:effort-scale
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import {
  EFFORT_MAX,
  EFFORT_MIN,
  effortReadout,
  effortWord,
} from '../rules/effortScale';
import { isSessionEffortRating } from '../utils/sessionFeedbackForm';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: unknown): void {
  if (condition) { pass += 1; console.log(`  PASS ${name}`); }
  else { fail += 1; failures.push(name); console.error(`  FAIL ${name}`, detail ?? ''); }
}

console.log('\n-- The effort scale --');

// ── THE SCALE IS 1-10, AND THE VALIDATOR AGREES WITH THE VOCABULARY ──
//
// Two owners of "what is a legal rating" would drift the first time either
// moved; the defect this whole unit exists for was exactly that shape at a
// different altitude (one field, two scales). So the cell asserts they MATCH
// rather than asserting each separately.
ok('the scale runs 1 to 10', EFFORT_MIN === 1 && EFFORT_MAX === 10);
ok('every number on the scale has a word, and none is the empty prompt',
  Array.from({ length: EFFORT_MAX }, (_, index) => index + 1)
    .every((rating) => effortWord(rating) !== effortWord(null)));
ok('the validator accepts exactly the scale the vocabulary covers',
  Array.from({ length: 12 }, (_, index) => index).every((value) =>
    isSessionEffortRating(value) === (value >= EFFORT_MIN && value <= EFFORT_MAX)));

// ── SAM'S ONE NAMED WORD ──
ok('7 reads "7 — hard", verbatim', effortReadout(7) === '7 — hard');

// ── EMPTY IS EMPTY ──
//
// BOTH HALVES. A readout that returned "" would satisfy "no number" while
// leaving the athlete with a blank space and nothing to tap toward, and a
// readout that returned "5 — steady" is the lie the ruling names.
ok('an untouched rating shows NO number', !/\d/.test(effortReadout(null)));
ok('an untouched rating still says something', effortReadout(null).trim().length > 0);
ok('an untouched rating is not silently the middle of the scale',
  effortReadout(null) !== effortReadout(5) && effortReadout(null) !== effortReadout(1));

// ── THE READOUT SHAPE, FOR EVERY LEGAL RATING ──
ok('every rating reads "N — word"',
  Array.from({ length: EFFORT_MAX }, (_, index) => index + 1).every((rating) =>
    new RegExp(`^${rating} — .+$`).test(effortReadout(rating))));

// ── OUT OF RANGE IS TREATED AS UNANSWERED, NOT AS A NEIGHBOUR ──
//
// Clamping 11 to 10 would invent an answer the athlete never gave — the same
// class as defaulting an untouched slider.
for (const bad of [0, 11, -1, 3.5, Number.NaN]) {
  ok(`${String(bad)} is not a rating and reads as unanswered`,
    effortReadout(bad as number) === effortReadout(null));
}

// ── THE WORDS ARE DISTINCT ──
//
// Two numbers sharing a word makes the word useless for calibration, which is
// the only reason it is shown at all.
const words = Array.from({ length: EFFORT_MAX }, (_, index) => effortWord(index + 1));
ok('all ten words are distinct', new Set(words).size === words.length, words);

console.log(`\nEffort scale totals: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
