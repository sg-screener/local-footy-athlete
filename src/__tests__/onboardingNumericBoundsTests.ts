/**
 * ONBOARDING NUMERIC BOUNDS — an out-of-range answer is refused, not absorbed.
 *
 * THE DEFECT (read-only finding, 2026-07-28). Onboarding validated numeric
 * answers with `> 0` and nothing else. No upper bound, no `maxLength`, no schema
 * validator anywhere in the app. Bodyweight is not a record field — it is the
 * FIRST TERM of the anchor chain (`anchor 1RM = bodyweight x multiplier`), and
 * all 77 load ratios multiply it. Entering 5000 produced a 4100 kg Back Squat
 * card; "800" for "80" is one keystroke.
 *
 * Both directions failed silently, in different ways:
 *   TOO HIGH  propagated faithfully into an absurd prescription.
 *   TOO LOW   was clamped — not by any judgement about the athlete, but by
 *             MIN_WEIGHTS.barbell happening to catch it. A 3 kg athlete got a
 *             plausible-looking 20 kg card, which is the harder one to notice:
 *             nonsense in, sane-looking number out.
 *
 * SAM'S RULING (2026-07-28): bodyweight 30-200 kg, height 100-230 cm,
 * out-of-range re-asked with a plain message, never accepted and NEVER CLAMPED.
 *
 * The no-clamping half is the point. A clamp substitutes the app's number for
 * the athlete's and then proceeds as if they had agreed — the same defect class
 * as the render-truth "BW", where the least-informed state was also the most
 * confident one. Refusing and re-asking is the only honest answer to an input
 * nobody can interpret.
 *
 * Run: npm run test:onboarding-bounds
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';


import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import {
  ONBOARDING_NUMERIC_BOUNDS,
  validateOnboardingMeasurement,
} from '../data/onboardingNumericBounds';
import { estimateStartingWeight } from '../utils/loadEstimation';
import { stripComments, statesWholeNumber } from './support/sourceText';
import type { OnboardingData } from '../types/domain';

const repoRoot = path.resolve(__dirname, '../..');
const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

console.log('\n[1] The ruled ranges, exactly');
{
  const w = ONBOARDING_NUMERIC_BOUNDS.weightKg;
  const h = ONBOARDING_NUMERIC_BOUNDS.heightCm;
  ok('bodyweight is 30-200 kg', w.min === 30 && w.max === 200, `${w.min}-${w.max}`);
  ok('height is 100-230 cm', h.min === 100 && h.max === 230, `${h.min}-${h.max}`);
}

console.log('\n[2] REFUSAL in both directions, for both fields');
{
  // Below, above, and the absurd typo that motivated the unit.
  const cases: Array<[keyof typeof ONBOARDING_NUMERIC_BOUNDS, number, string]> = [
    ['weightKg', 29.9, 'just below the floor'],
    ['weightKg', 3, 'the value that used to be clamped to a 20 kg card'],
    ['weightKg', 200.1, 'just above the ceiling'],
    ['weightKg', 5000, 'the value that used to produce a 4100 kg card'],
    ['weightKg', 800, 'the one-keystroke typo for 80'],
    ['heightCm', 99, 'just below the floor'],
    ['heightCm', 231, 'just above the ceiling'],
  ];
  for (const [field, value, why] of cases) {
    const result = validateOnboardingMeasurement(field, value);
    ok(`${field}=${value} is refused (${why})`, !result.ok);
  }
}

console.log('\n[3] Valid answers, including the exact endpoints');
{
  // Sam ruled the ranges as "30-200" and "100-230", which are inclusive. An
  // off-by-one here would refuse a real athlete standing exactly on the bound.
  for (const [field, value] of [
    ['weightKg', 30], ['weightKg', 80], ['weightKg', 200],
    ['heightCm', 100], ['heightCm', 184], ['heightCm', 230],
  ] as Array<[keyof typeof ONBOARDING_NUMERIC_BOUNDS, number]>) {
    ok(`${field}=${value} is accepted`,
      validateOnboardingMeasurement(field, value).ok);
  }
}

console.log('\n[4] Non-numeric and empty are refused, not coerced to 0');
{
  for (const value of [NaN, Infinity, -Infinity]) {
    ok(`weightKg=${value} is refused`,
      !validateOnboardingMeasurement('weightKg', value).ok);
  }
}

console.log('\n[5] The refusal REACHES the athlete, in plain words');
{
  const result = validateOnboardingMeasurement('weightKg', 5000);
  ok('a refusal carries a message', !result.ok && typeof result.message === 'string'
    && result.message.length > 0);

  if (!result.ok) {
    // The message has to say what will be accepted. "Invalid input" sends the
    // athlete back to the same field with nothing new to go on.
    ok('the message names the accepted range',
      result.message.includes('30') && result.message.includes('200'),
      `got: ${result.message}`);
    ok('the message is plain — no field names, no jargon',
      !/weightKg|heightCm|NaN|parse|valid(ate|ation)/i.test(result.message),
      `got: ${result.message}`);
  }
}

console.log('\n[6] NEVER CLAMPED — the screen refuses rather than substituting');
{
  const screen = stripComments(
    fs.readFileSync(path.join(src, 'screens/onboarding/BodyMeasurementsScreen.tsx'), 'utf8'));

  ok('the screen validates through the authored bounds',
    /validateOnboardingMeasurement/.test(screen),
    'the screen must not carry its own copy of the ruled numbers');

  ok('the screen no longer gates on a bare > 0',
    !/parseFloat\((heightCm|weightKg)\)\s*>\s*0/.test(screen),
    'the old presence-only check has to be gone, not merely supplemented');

  // The ruling is explicit that a clamp is not an acceptable resolution.
  ok('the screen never clamps a measurement',
    !/Math\.(min|max)\s*\([^)]*(heightCm|weightKg)/.test(screen),
    'clamping substitutes the app\'s number for the athlete\'s');

  ok('the ruled numbers are not duplicated into the screen',
    !/\b(30|200|100|230)\b/.test(
      screen.split('\n').filter((l) => /min|max|bound|range/i.test(l)).join('\n')),
    'one owner for the ruled values — the screen reads them, it does not restate them');
}

console.log('\n[7] A refused answer never becomes a card');
{
  // The end-to-end claim in one assertion: the values the bounds refuse are
  // exactly the values that would have produced a nonsense prescription. This
  // is what makes the bound a load-path guard rather than tidy input hygiene.
  for (const weightKg of [3, 5000]) {
    const refused = !validateOnboardingMeasurement('weightKg', weightKg).ok;
    const athlete = {
      weightKg,
      squatStrength: 'Around bodyweight',
      benchStrength: 'Around bodyweight',
    } as unknown as OnboardingData;
    const card = estimateStartingWeight('Back Squat', athlete);
    ok(`bodyweight ${weightKg} is refused before it can prescribe ${card}kg`,
      refused, `would have produced a ${card}kg Back Squat card`);
  }
}

console.log('\n[8] PROVENANCE — the ranges trace to Sam\'s ruling');
{
  const { attribution, anchor } = ONBOARDING_NUMERIC_BOUNDS.weightKg;

  ok('the ruling is dated', /^\d{4}-\d{2}-\d{2}$/.test(attribution.ruledOn),
    attribution.ruledOn);

  const wherePath = path.join(repoRoot, attribution.where);
  ok('the attributed document exists', fs.existsSync(wherePath), attribution.where);

  if (fs.existsSync(wherePath)) {
    const doc = fs.readFileSync(wherePath, 'utf8');
    // The anchor must be the sentence that STATES the rule, and the gate proves
    // it still says so — this is the anchor discipline from the provenance spec.
    ok('the anchor appears verbatim in the attributed document',
      doc.includes(anchor), `anchor not found: ${anchor}`);
    ok('the anchor actually states the numbers it is cited for',
      anchor.includes('30') && anchor.includes('200'),
      `a nearby sentence is not a citation: ${anchor}`);
  }

  // THE BINDING. Not "an anchor exists" but "the anchor states THESE numbers".
  // Without this the shipped bound could drift to any value while still citing
  // a real sentence — a citation that no longer supports what it is cited for,
  // which is the failure mode the whole provenance unit exists to close.

  for (const [field, bound] of Object.entries(ONBOARDING_NUMERIC_BOUNDS)) {
    ok(`${field}: the anchor states the shipped floor (${bound.min})`,
      statesWholeNumber(bound.anchor, bound.min),
      `anchor "${bound.anchor}" does not state ${bound.min} as a whole number`);
    ok(`${field}: the anchor states the shipped ceiling (${bound.max})`,
      statesWholeNumber(bound.anchor, bound.max),
      `anchor "${bound.anchor}" does not state ${bound.max} as a whole number`);
    ok(`${field}: the anchor is present in the ruling document`,
      fs.readFileSync(path.join(repoRoot, bound.attribution.where), 'utf8')
        .includes(bound.anchor),
      bound.anchor);
  }
}

console.log('\n[9] Height stays OFF the load path');
{
  // Sam scoped height to data quality. If it ever reaches load estimation, that
  // is a scope change needing its own ruling, not a quiet extension of this one.
  const loadEstimation = stripComments(
    fs.readFileSync(path.join(src, 'utils/loadEstimation.ts'), 'utf8'));
  ok('load estimation does not read height',
    !/heightCm/.test(loadEstimation),
    'height was ruled data-quality scope only');
}

const total = passed + failures.length;
console.log(`\nOnboarding numeric bounds: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
