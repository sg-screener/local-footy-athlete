/**
 * ONBOARDING ANSWER PRESENTATION — when a refusal is spoken, and what Review shows.
 *
 * Two device findings from Sam's 2026-07-29 pass, both about PRESENTATION. The
 * ingress law is untouched by either: an out-of-range answer is still refused
 * and never clamped, and the one ingress still owns what "acceptable" means.
 *
 * ─── (1) A PARTIAL ANSWER IS NOT A WRONG ANSWER ───
 *
 * Bodyweight, height and the 2km time all validated on every keystroke and
 * rendered the refusal immediately. Typing "90" showed "That weight looks off.
 * Enter a weight between 30 and 200 kg" the instant the "9" landed, then took it
 * back when the "0" arrived. The athlete was told they were wrong while they
 * were still answering.
 *
 * The bound had not misjudged anything — "9" IS outside 30-200. The mistake was
 * asking it at all. A number mid-typing is not a submitted answer, so there is
 * nothing yet to accept or refuse.
 *
 * THE LAW, and it is one law in one place (`useRefusalOnContinue`):
 *
 *   - a refusal is shown when the athlete presses Continue, never before;
 *   - editing an answer WITHDRAWS the refusal — it does not re-judge, because a
 *     half-retyped number is a partial answer again;
 *   - Continue is disabled for ABSENCE and never for refusal. A disabled button
 *     on a refused answer would leave the refusal with no door to come out of,
 *     which is how "validate on submit" usually gets shipped broken.
 *
 * ─── (2) EVERY ANSWER SHOWS ON REVIEW ───
 *
 * The 2km time trial shipped with no Review row. Nothing was wrong with the
 * stored answer — it simply could not be seen or corrected from the screen whose
 * whole job is seeing and correcting answers.
 *
 * The general defect is that Review's rows were hand-listed, so a step could be
 * added to the flow and silently not appear here. Rows are now declared against
 * `ONBOARDING_STEPS` — the same registry that owns visibility, satisfaction and
 * the generator's required fields — and this gate walks several profiles
 * asserting every step the athlete was ASKED has a row that routes back to it.
 * Adding a step without a row now fails here rather than on a device.
 *
 * Run: npm run test:onboarding-presentation
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import { refusalState } from '../hooks/useRefusalOnContinue';
import { buildReviewSections } from '../screens/onboarding/reviewRows';
import {
  answerableOnboardingSteps,
  ONBOARDING_STEPS,
  type OnboardingStepName,
} from '../utils/onboardingSteps';
import { validateOnboardingMeasurement } from '../data/onboardingNumericBounds';
import { validateTwoKmTime } from '../data/twoKmTimeTrial';
import { stripComments } from './support/sourceText';
import type { OnboardingData } from '../types/domain';

const repoRoot = path.resolve(__dirname, '../..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const read = (relative: string): string =>
  stripComments(fs.readFileSync(path.join(repoRoot, relative), 'utf8'));

// ───────────────────────────────────────────────────────────────────────────
// (1) The timing law
// ───────────────────────────────────────────────────────────────────────────

console.log('\n[1] A refusal is not spoken while the athlete is still typing');
{
  // "9" on the way to "90". The bound refuses it — correctly — and the screen
  // must still say nothing, because nothing has been submitted.
  const midTyping = { weightKg: validateOnboardingMeasurement('weightKg', 9) };
  ok('the bound does refuse 9 kg', !midTyping.weightKg.ok,
    'if this ever passes, the test below proves nothing');

  const beforeContinue = refusalState(midTyping, false);
  ok('nothing is shown before Continue', beforeContinue.refusals.weightKg === null,
    String(beforeContinue.refusals.weightKg));

  const afterContinue = refusalState(midTyping, true);
  ok('the refusal is shown after Continue',
    afterContinue.refusals.weightKg === midTyping.weightKg.message,
    String(afterContinue.refusals.weightKg));
}

console.log('\n[2] An accepted answer is never given a message');
{
  const accepted = { weightKg: validateOnboardingMeasurement('weightKg', 90) };
  for (const revealed of [false, true]) {
    ok(`90 kg carries no refusal (revealed=${revealed})`,
      refusalState(accepted, revealed).refusals.weightKg === null);
  }
}

console.log('\n[3] An absent answer is not a refused one');
{
  // An empty box has not been answered. Revealing must not invent a complaint
  // about it — the screen simply has nothing to say yet.
  const empty = { weightKg: null };
  ok('an untouched field shows nothing even after Continue',
    refusalState(empty, true).refusals.weightKg === null);
  ok('an untouched field leaves Continue disabled',
    refusalState(empty, true).continueDisabled);
  ok('an untouched field is not accepted',
    !refusalState(empty, true).accepted);
}

console.log('\n[4] Continue is disabled for ABSENCE, never for refusal');
{
  // This is the half that gets shipped broken. If Continue stays disabled while
  // an answer is refused, pressing it is impossible, so the refusal can never be
  // revealed and the athlete is stuck at a dead button with no explanation.
  const refused = { weightKg: validateOnboardingMeasurement('weightKg', 9) };
  const state = refusalState(refused, false);
  ok('a refused answer leaves Continue PRESSABLE', !state.continueDisabled,
    'a refusal needs a door to come out of');
  ok('a refused answer is not accepted', !state.accepted);

  const half = {
    heightCm: validateOnboardingMeasurement('heightCm', 183),
    weightKg: null,
  };
  ok('one answered field and one empty still disables Continue',
    refusalState(half, false).continueDisabled);
}

console.log('\n[5] Every field is judged, not just the first');
{
  const both = {
    heightCm: validateOnboardingMeasurement('heightCm', 9),
    weightKg: validateOnboardingMeasurement('weightKg', 9),
  };
  const shown = refusalState(both, true).refusals;
  ok('both refusals are shown at once',
    Boolean(shown.heightCm) && Boolean(shown.weightKg),
    JSON.stringify(shown));

  const oneBad = {
    heightCm: validateOnboardingMeasurement('heightCm', 183),
    weightKg: validateOnboardingMeasurement('weightKg', 900),
  };
  ok('a good answer beside a bad one stays silent',
    refusalState(oneBad, true).refusals.heightCm === null);
  ok('the bad one still speaks',
    Boolean(refusalState(oneBad, true).refusals.weightKg));
  ok('one refused answer is enough to withhold acceptance',
    !refusalState(oneBad, true).accepted);
}

console.log('\n[6] The 2km time rides the same law');
{
  // A blank MINUTES box is not a time at all — the total is NaN and the bound
  // refuses it with words rather than coercing it to something plausible.
  const blankMinutes = { time: validateTwoKmTime(NaN) };
  ok('a secondsonly entry is refused, not coerced', !blankMinutes.time.ok);
  ok('and it says nothing until Continue',
    refusalState(blankMinutes, false).refusals.time === null);
  ok('and it speaks on Continue',
    Boolean(refusalState(blankMinutes, true).refusals.time));

  // 7:15 -> 435s, inside the ruled 300-900.
  const good = { time: validateTwoKmTime(435) };
  ok('7:15 is accepted', refusalState(good, true).accepted);
  ok('7:15 carries no refusal', refusalState(good, true).refusals.time === null);
}

console.log('\n[7] The screens use the owner — no second copy of the timing rule');
{
  const screens = [
    'src/screens/onboarding/BodyMeasurementsScreen.tsx',
    'src/screens/onboarding/TwoKmTimeTrialScreen.tsx',
  ];
  for (const relative of screens) {
    const screen = read(relative);
    const name = relative.split('/').pop();

    ok(`${name} reads its refusals from the owner`,
      /useRefusalOnContinue/.test(screen),
      'a screen with its own submitted flag is a second copy of the law');

    // The defect in one regex: a screen that renders `validation.message`
    // directly is rendering it on every keystroke, whatever else it does.
    ok(`${name} never renders a validation message directly`,
      !/validation[A-Za-z]*\s*&&\s*![A-Za-z]*validation[A-Za-z]*\.ok/.test(screen)
      && !/Issue\?\.\s*message/.test(screen),
      'the refusal must come from the owner, which knows whether it may be spoken');

    ok(`${name} still validates through the authored bound`,
      /validateOnboardingMeasurement|validateTwoKmTime/.test(screen),
      'the timing change must not move what "acceptable" means');

    // Continue gated on validity is exactly the dead-button failure: the refusal
    // would have no press to be revealed by.
    ok(`${name} does not gate Continue on the answer being ACCEPTED`,
      !/continueDisabled=\{!(isValid|canContinue)\}/.test(screen),
      'Continue is disabled for absence only');
  }
}

// ───────────────────────────────────────────────────────────────────────────
// (2) Review shows every answer
// ───────────────────────────────────────────────────────────────────────────

const COMPLETE_IN_SEASON = {
  firstName: 'Sam',
  heightCm: 183,
  weightKg: 84,
  position: 'Midfielder',
  motivation: 'Run out games',
  seasonPhase: 'In-season',
  gameDay: 'Saturday',
  teamTrainingDaysPerWeek: 2,
  teamTrainingDays: ['Tuesday', 'Thursday'],
  teamTrainingDuration: '90 minutes',
  teamTrainingIntensity: 'Moderate',
  trainingDaysPerWeek: 3,
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  experienceLevel: '2-5 years',
  squatStrength: 'Around bodyweight',
  benchStrength: 'Around bodyweight',
  twoKmTimeTrial: { seconds: 435, recordedOn: '2026-07-29', source: 'onboarding' },
  conditioningLevel: 'Good',
  sprintExposure: 'Occasionally',
  recentTrainingLoad: 'Pretty consistent',
  injuries: [],
} as unknown as OnboardingData;

const BEGINNER_OFF_SEASON = {
  ...COMPLETE_IN_SEASON,
  seasonPhase: 'Off-season',
  gameDay: undefined,
  experienceLevel: 'Complete beginner',
  squatStrength: undefined,
  benchStrength: undefined,
  twoKmTimeTrial: { seconds: null, recordedOn: '2026-07-29', source: 'onboarding' },
} as unknown as OnboardingData;

const allRows = (data: OnboardingData) =>
  buildReviewSections(data).flatMap((section) => section.rows);

console.log('\n[8] Every step the athlete was ASKED has a row that routes back to it');
{
  const profiles: Array<[string, OnboardingData]> = [
    ['complete in-season', COMPLETE_IN_SEASON],
    ['complete-beginner off-season', BEGINNER_OFF_SEASON],
  ];
  for (const [label, data] of profiles) {
    const covered = new Set<OnboardingStepName>(allRows(data).map((row) => row.step));
    const asked = answerableOnboardingSteps(data).map((step) => step.name);
    const missing = asked.filter((name) => !covered.has(name));
    ok(`${label}: no asked step is missing from Review`,
      missing.length === 0, `missing rows for: ${missing.join(', ')}`);
  }
}

console.log('\n[9] Review never shows a question the athlete was not asked');
{
  // A complete beginner is never asked about squat or bench. A row reading
  // "Squat Strength — Not selected" invites them to correct an answer that was
  // never wanted, and reads as an incomplete profile when it is complete.
  const data = BEGINNER_OFF_SEASON;
  const visible = new Set(answerableOnboardingSteps(data).map((step) => step.name));
  const strays = allRows(data)
    .map((row) => row.step)
    .filter((step) => !visible.has(step));
  ok('the beginner off-season profile shows no unasked step',
    strays.length === 0, `stray rows for: ${[...new Set(strays)].join(', ')}`);
}

console.log('\n[10] Every row names a real step');
{
  const known = new Set(ONBOARDING_STEPS.map((step) => step.name));
  const unknown = allRows(COMPLETE_IN_SEASON)
    .map((row) => row.step)
    .filter((step) => !known.has(step));
  ok('no row points at a step that does not exist',
    unknown.length === 0, unknown.join(', '));
  ok('no row points at Review itself',
    !allRows(COMPLETE_IN_SEASON).some((row) => row.step === 'Review'));
}

console.log('\n[11] The 2km row speaks all three of its states');
{
  const rowFor = (data: OnboardingData) =>
    allRows(data).find((row) => row.step === 'TwoKmTimeTrial');

  const measured = rowFor(COMPLETE_IN_SEASON);
  ok('a measured time is shown as the athlete said it', measured?.value === '7:15',
    String(measured?.value));

  const skipped = rowFor(BEGINNER_OFF_SEASON);
  ok('"haven\'t tested" is shown as an ANSWER, not as a gap',
    /haven't tested/i.test(String(skipped?.value)), String(skipped?.value));

  const unanswered = rowFor({ ...COMPLETE_IN_SEASON, twoKmTimeTrial: undefined } as OnboardingData);
  ok('an unanswered time reads as not provided',
    /not provided|not selected/i.test(String(unanswered?.value)),
    String(unanswered?.value));

  ok('the 2km row sits in the Physical section',
    buildReviewSections(COMPLETE_IN_SEASON)
      .find((section) => section.rows.some((row) => row.step === 'TwoKmTimeTrial'))
      ?.title === 'Physical');
}

console.log('\n[12] The Review screen renders the owner rather than a second list');
{
  const review = read('src/screens/onboarding/ReviewScreen.tsx');
  ok('the screen builds its sections from the owner',
    /buildReviewSections/.test(review),
    'hand-listed rows are what let a step ship without one');

  // The formatters moved to the owner with the rows. A copy left behind on the
  // screen is a second answer to "what does this value say".
  ok('the screen no longer carries its own value formatters',
    !/const formatExperience\b/.test(review) && !/const formatConditioning\b/.test(review),
    'one owner formats a review value');

  ok('the 2km answer is reachable from Review',
    /TwoKmTimeTrial/.test(read('src/screens/onboarding/reviewRows.ts')),
    'the row must route back to the step that owns the answer');
}

const total = passed + failures.length;
console.log(`\nOnboarding answer presentation: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
