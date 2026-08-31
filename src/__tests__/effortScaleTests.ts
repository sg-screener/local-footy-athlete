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
import {
  parseGameSessionOutcome,
  parseTeamTrainingSessionOutcome,
} from '../types/sessionOutcome';

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


// ── EVERY GATE THE ANSWER PASSES THROUGH ACCEPTS THE WHOLE SCALE ──
//
// THE GAP THIS CLOSES, AND IT WAS LIVE FOR ONE COMMIT. The scale moved to 1-10
// and the slider offered ten values, while `parseGameSessionOutcome` and
// `parseTeamTrainingSessionOutcome` still refused anything over 5 — so the UI
// collected an answer the transaction threw away, with no cell anywhere
// comparing the two. Every suite stayed green because each end was internally
// consistent.
//
// A range restated as a literal in four files is four owners. These cells bind
// them to one, and they are written so that ANY of the four regressing reds
// them — not just the one that regressed last time.
console.log('\n-- Every gate accepts the whole scale --');

// `feel` is a DIFFERENT 1-5 scale and stays one: Heavy/Bad/Normal/Good/Flying
// answers HOW YOU FEEL, not how hard it was. Sam's ruling moved the EFFORT
// scale only, and conflating the two is the defect this whole unit is about.
const gameAt = (bodyRpe: number) => parseGameSessionOutcome({
  playedWholeGame: true, timeOnGroundMinutes: 90, bodyRpe, feel: 3,
});
const teamAt = (effort: number) => parseTeamTrainingSessionOutcome({
  durationMinutes: 90, effort,
});

for (let rating = EFFORT_MIN; rating <= EFFORT_MAX; rating += 1) {
  ok(`the game transaction accepts ${rating}`, gameAt(rating) !== null);
  ok(`the team-training transaction accepts ${rating}`, teamAt(rating) !== null);
}

// AND STILL REFUSE WHAT IS OFF THE SCALE — otherwise "accepts everything" would
// pass these cells just as well as "accepts the scale".
for (const bad of [0, EFFORT_MAX + 1, -1, 2.5]) {
  ok(`the game transaction refuses ${bad}`, gameAt(bad) === null);
  ok(`the team-training transaction refuses ${bad}`, teamAt(bad) === null);
}

// ── THE SLIDER'S TOUCH CONTRACT (Sam, 2026-08-26: the feedback continuums
// were glitchy). The one owner is DiscreteSlider; both defects red here if
// they return: a visual child that can become the touch target makes
// `locationX` change meaning mid-drag (the thumb-jump stutter), and a
// responder that does not hold its grant lets the scrolling sheet steal the
// drag mid-slide.
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');
  const slider = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'DiscreteSlider.tsx'), 'utf8');
  ok('every visual child of the track is pointerEvents="none"',
    (slider.match(/pointerEvents="none"/g) ?? []).length >= 3);
  ok('the slider holds its gesture once granted',
    /onPanResponderTerminationRequest: \(\) => false/.test(slider));
  ok('the emission dedup (lastEmitted) is still in place',
    /lastEmitted/.test(slider));
  ok('the slider emits during movement, not only on release',
    /onPanResponderMove: \(event\) => commitFromTouch\(event.nativeEvent.locationX\)/.test(slider));
  ok('the selected number follows the current slider value',
    /value === label && styles.stepLabelSelected/.test(slider));
  ok('labelled endpoints reserve the whole thumb and align number centres',
    /trackWithLabels:\s*\{\s*marginHorizontal: THUMB_SIZE \/ 2/.test(slider)
      && /minWidth: THUMB_SIZE/.test(slider));
  const rir = fs.readFileSync(path.join(__dirname, '..', 'components', 'LastSetRirQuestion.tsx'), 'utf8');
  ok('last-set RIR reuses the shared bounded slider',
    /<DiscreteSlider\b[^>]*min=\{0\} max=\{5\}/.test(rir));
  ok('the RIR endpoint is stored open-ended, not numeric five',
    /rir: value === 5 \? '5\+'/.test(rir));
  ok('the minimal picker starts empty without adding a separate readout line',
    /showReadout=\{false\}/.test(rir));
  ok('the question uses the exact ruled words and the popup typography owner',
    rir.includes('How many more clean reps could you have done on your last set?')
      && (rir.match(/variant="bodySmallEmphasis"/g) ?? []).length === 2
      && !/fontSize:|fontWeight:/.test(rir));
  ok('the lift question contains no duplicate fields, setup, Skip or caveat',
    !/NumberAnswer|AppTextInput|setup|technique|testID=\{`\$\{id\}-skip`\}|>Skip<|Undo skip|Estimated 1RM is approximate|Last completed working set/i.test(rir));
  const panel = fs.readFileSync(path.join(__dirname, '..', 'components', 'SessionFeedbackPanel.tsx'), 'utf8');
  ok('main-lift questions render after the existing estimated-minutes field',
    /testID="strength-feedback-minutes"[\s\S]*lastSetInputs\.map\(\(input\)/.test(panel)
      && (panel.match(/lastSetInputs\.map\(\(input\)/g) ?? []).length === 1);
}

console.log(`\nEffort scale totals: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) {
  console.error(`FAILURES:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
