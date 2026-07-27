/**
 * ANCHOR MULTIPLIERS — Sam's ruled ladders, and the two structural rules in them.
 *
 * These sit UPSTREAM OF ALL 77 LOAD RATIOS: `anchor 1RM = bodyweight ×
 * multiplier`, and every ratio multiplies that anchor. They were unauthored
 * until 2026-07-28; six of the thirteen rows moved when Sam ruled them.
 *
 * Two of the rulings are not just values, and those are what this suite is for:
 *
 * 1. "Not sure" is TIED to "Less than bodyweight" — Sam: *"if less-than ever
 *    changes, Not-sure follows it."* That is a derivation, not a coincidence
 *    that both read 0.75 today. A second literal would satisfy an equality test
 *    forever while silently failing the actual rule the first time less-than
 *    moved. So the tie is asserted STRUCTURALLY: "Not sure" must not be a
 *    numeric literal in the module at all.
 *
 * 2. Missing bodyweight FAILS LOUD. `DEFAULT_BODYWEIGHT_KG = 82` ("average AFL
 *    player") is gone. With no recorded bodyweight there is no anchor, so
 *    nothing is prescribed and the card shows "—". This is the render-truth
 *    principle at the top of the chain rather than the bottom: absence renders
 *    as absence, and the app never guesses an athlete's body to two figures.
 *
 * Run: npm run test:anchor-multipliers
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  ANCHOR_MULTIPLIER_RULING,
  BENCH_ANCHOR_MULTIPLIERS,
  SQUAT_ANCHOR_MULTIPLIERS,
} from '../data/anchorMultipliers';
import {
  EXERCISE_LOAD_MAP,
  estimateAnchors,
  estimateStartingWeight,
} from '../utils/loadEstimation';
import { prescribableWeight } from '../data/equipmentLattice';
import { stripComments } from './support/sourceText';
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

console.log('\n[1] The ruled squat ladder, exactly');
{
  const ruled: Array<[string, number]> = [
    ["I don't squat", 0.5],
    ['Less than bodyweight', 0.75],
    ['Around bodyweight', 1.0],
    ['1.5x bodyweight', 1.5],
    ['2x bodyweight+', 2.0],
    ['Not sure', 0.75],
  ];
  for (const [answer, value] of ruled) {
    ok(`squat "${answer}" = ${value}`,
      (SQUAT_ANCHOR_MULTIPLIERS as Record<string, number>)[answer] === value,
      `got ${(SQUAT_ANCHOR_MULTIPLIERS as Record<string, number>)[answer]}`);
  }
  ok('the squat ladder has exactly the six onboarding answers',
    Object.keys(SQUAT_ANCHOR_MULTIPLIERS).length === 6,
    Object.keys(SQUAT_ANCHOR_MULTIPLIERS).join(', '));
}

console.log('\n[2] The ruled bench ladder, exactly');
{
  const ruled: Array<[string, number]> = [
    ["I don't bench", 0.5],
    ['Less than bodyweight', 0.75],
    ['Around bodyweight', 1.0],
    ['1.25x bodyweight', 1.25],
    ['1.5x bodyweight+', 1.5],
    ['Not sure', 0.75],
  ];
  for (const [answer, value] of ruled) {
    ok(`bench "${answer}" = ${value}`,
      (BENCH_ANCHOR_MULTIPLIERS as Record<string, number>)[answer] === value,
      `got ${(BENCH_ANCHOR_MULTIPLIERS as Record<string, number>)[answer]}`);
  }
  ok('the bench ladder has exactly the six onboarding answers',
    Object.keys(BENCH_ANCHOR_MULTIPLIERS).length === 6,
    Object.keys(BENCH_ANCHOR_MULTIPLIERS).join(', '));
}

console.log('\n[3] THE TIE IS STRUCTURAL — "Not sure" is derived, never written');
{
  // Equality alone cannot tell a tie from a coincidence: both read 0.75 today.
  // Sam's rule is that less-than MOVES not-sure, so the only honest check is
  // that no number was written for "Not sure" in the first place.
  const source = stripComments(
    fs.readFileSync(path.join(src, 'data/anchorMultipliers.ts'), 'utf8'));

  const literalNotSure = /'Not sure'\s*:\s*-?\d/.test(source);
  ok('"Not sure" is not assigned a numeric literal', !literalNotSure,
    'a copied number satisfies an equality test forever and breaks Sam\'s rule '
    + 'the first time "Less than bodyweight" moves — derive it instead');

  ok('both ladders currently agree with their tied source',
    SQUAT_ANCHOR_MULTIPLIERS['Not sure'] === SQUAT_ANCHOR_MULTIPLIERS['Less than bodyweight']
    && BENCH_ANCHOR_MULTIPLIERS['Not sure'] === BENCH_ANCHOR_MULTIPLIERS['Less than bodyweight']);
}

console.log('\n[4] FAIL LOUD — no bodyweight, no anchor, no prescription');
{
  const noBodyweight = {
    squatStrength: 'Around bodyweight',
    benchStrength: 'Around bodyweight',
  } as unknown as OnboardingData;

  ok('estimateAnchors refuses without a bodyweight',
    estimateAnchors(noBodyweight) === null,
    `got ${JSON.stringify(estimateAnchors(noBodyweight))}`);

  ok('no weight is prescribed without a bodyweight',
    estimateStartingWeight('Back Squat', noBodyweight) === null,
    `got ${estimateStartingWeight('Back Squat', noBodyweight)}`);

  // The specific number that used to fill the gap.
  const loadSource = stripComments(
    fs.readFileSync(path.join(src, 'utils/loadEstimation.ts'), 'utf8'));
  ok('the 82 kg "average AFL player" default is gone',
    !/DEFAULT_BODYWEIGHT_KG/.test(loadSource),
    'a default bodyweight is a guess about the athlete\'s body that then '
    + 'prescribes every load in the app');

  // And a real bodyweight still works, so [4] is not passing by breaking it.
  const real = {
    weightKg: 80, squatStrength: 'Around bodyweight', benchStrength: 'Around bodyweight',
  } as unknown as OnboardingData;
  ok('a recorded bodyweight still resolves anchors',
    estimateAnchors(real)?.squat1RM === 80);
}

console.log('\n[5] The ruled values reach the card');
{
  // Proves the ladders are WIRED, not just declared. Bench "Less than
  // bodyweight" moved 0.65 -> 0.75, so an 80 kg athlete's bench anchor moves
  // 52 -> 60 and every bench-anchored suggestion moves with it.
  const athlete = {
    weightKg: 80, squatStrength: 'Not sure', benchStrength: 'Less than bodyweight',
  } as unknown as OnboardingData;
  const anchors = estimateAnchors(athlete);

  ok('squat "Not sure" resolves through the tie (80 × 0.75 = 60)',
    anchors?.squat1RM === 60, `got ${anchors?.squat1RM}`);
  ok('bench "Less than bodyweight" resolves to the ruled 0.75 (80 × 0.75 = 60)',
    anchors?.bench1RM === 60, `got ${anchors?.bench1RM}`);

  // Derived from the SHIPPED ratio and lattice, not from a transcribed figure —
  // this assertion previously hardcoded Bench Press at 0.82 and broke the moment
  // Sam ruled it 0.8. What is being tested is that the ruled ANCHOR reaches the
  // card, not what any one exercise's ratio happens to be today.
  const bench = estimateStartingWeight('Bench Press', athlete);
  const expected = prescribableWeight(
    anchors!.bench1RM * EXERCISE_LOAD_MAP['Bench Press'].ratio, 'barbell');
  ok(`the Bench Press card reflects the ruled anchor (${anchors?.bench1RM} × `
    + `${EXERCISE_LOAD_MAP['Bench Press'].ratio} → ${expected}kg)`,
    bench === expected, `got ${bench}, expected ${expected}`);
}

console.log('\n[6] PROVENANCE — the ladders trace to Sam\'s ruling');
{
  const { ruledOn, where, squatAnchor, benchAnchor, fallbackAnchor } = ANCHOR_MULTIPLIER_RULING;

  ok('the ruling is dated', /^\d{4}-\d{2}-\d{2}$/.test(ruledOn), ruledOn);

  const wherePath = path.join(repoRoot, where);
  ok('the attributed document exists', fs.existsSync(wherePath), where);

  if (fs.existsSync(wherePath)) {
    const doc = fs.readFileSync(wherePath, 'utf8');
    for (const [label, anchor] of [
      ['squat', squatAnchor], ['bench', benchAnchor], ['fallback', fallbackAnchor],
    ] as Array<[string, string]>) {
      ok(`the ${label} anchor appears verbatim in the ruling document`,
        doc.includes(anchor), anchor.slice(0, 80));
    }
  }

  // Whole-number match, not substring: `includes('0.5')` is satisfied by "0.75".
  const states = (anchor: string, n: number): boolean =>
    new RegExp(`(?<![\\d.])${String(n).replace('.', '\\.')}(?![\\d])`).test(anchor);

  for (const [answer, value] of Object.entries(SQUAT_ANCHOR_MULTIPLIERS)) {
    if (answer === 'Not sure') continue; // tied, stated as a rule not a number
    ok(`the squat anchor states ${answer} = ${value}`, states(squatAnchor, value),
      `"${value}" not stated as a whole value in the anchor`);
  }
  for (const [answer, value] of Object.entries(BENCH_ANCHOR_MULTIPLIERS)) {
    if (answer === 'Not sure') continue;
    ok(`the bench anchor states ${answer} = ${value}`, states(benchAnchor, value),
      `"${value}" not stated as a whole value in the anchor`);
  }
}

const total = passed + failures.length;
console.log(`\nAnchor multipliers: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
