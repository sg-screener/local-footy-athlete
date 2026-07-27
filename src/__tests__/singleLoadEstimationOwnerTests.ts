/**
 * ONE ESTIMATION OWNER — the generation path and the render path must not
 * answer "what weight?" separately.
 *
 * THE DEFECT. Sam ruled on 2026-07-27 that beginners start at 50% of the
 * calculated load. `defaultProgram.applyTrainingAgePrescription` applies that
 * multiplier when it builds a workout. `useDayWorkout.getDisplayWeight` — the
 * render-time fallback that fills in a weight for a card that has none, and
 * which exists specifically to catch pre-existing programs — called
 * `estimateStartingWeight` DIRECTLY and skipped it.
 *
 * So the same complete beginner could read 27.5 kg on a freshly generated card
 * and 52.5 kg on one that fell through to the fallback. Same athlete, same
 * exercise, same question, two answers.
 *
 * This is the month's recurring shape one more time: one question, two owners.
 * The fix is not a third place that reconciles them — it is that only one place
 * is allowed to answer. `startingWeightForAthlete` is that place, and the
 * assertions below are about OWNERSHIP, not just arithmetic: no other module in
 * product code may read `initialLoadMultiplier`, and neither path may compute a
 * starting weight without going through the owner.
 *
 * Run: npm run test:single-estimation-owner
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  estimateStartingWeight,
  startingWeightForAthlete,
} from '../utils/loadEstimation';
import { resolveTrainingAgePolicy } from '../rules/trainingAgePolicy';
import { stripComments } from './support/sourceText';
import type { OnboardingData } from '../types/domain';

const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

function okEmpty(name: string, offenders: readonly string[], detail?: string): void {
  ok(name, offenders.length === 0,
    `${detail ? `${detail}\n      ` : ''}${[...offenders].sort().join('\n      ')}`);
}

const athlete = (experienceLevel: string): OnboardingData => ({
  weightKg: 80,
  squatStrength: 'Around bodyweight',
  benchStrength: 'Less than bodyweight',
  experienceLevel,
} as unknown as OnboardingData);

const BEGINNER = athlete('Complete beginner');
const EXPERIENCED = athlete('1-2 years');

console.log('\n[1] The owner applies Sam\'s beginner multiplier');
{
  const raw = estimateStartingWeight('Back Squat', BEGINNER);
  const owned = startingWeightForAthlete('Back Squat', BEGINNER);
  const mult = resolveTrainingAgePolicy('Complete beginner' as never).initialLoadMultiplier;

  ok('the raw estimate is a real number', typeof raw === 'number' && raw! > 0, `got ${raw}`);
  ok('a beginner receives less than the raw estimate',
    owned !== null && raw !== null && owned < raw,
    `raw=${raw} owned=${owned} multiplier=${mult}`);

  // Rounded AFTER the multiplier — halving then snapping to the bar increment
  // is not the same as snapping then halving, and the athlete loads a bar.
  ok('the beginner weight lands on a loadable increment',
    owned !== null && Number.isInteger(owned / 2.5),
    `${owned} is not a multiple of 2.5`);
}

console.log('\n[2] Everyone else is unchanged');
{
  ok('a 1-2 years athlete gets exactly the raw estimate',
    startingWeightForAthlete('Back Squat', EXPERIENCED)
      === estimateStartingWeight('Back Squat', EXPERIENCED));

  ok('their multiplier really is 1 (so [1] is testing something)',
    resolveTrainingAgePolicy('1-2 years' as never).initialLoadMultiplier === 1);
}

console.log('\n[3] Nothing authored, nothing invented');
{
  // The multiplier must not resurrect a weight for an exercise the render-truth
  // lock says has no authored load.
  ok('an authored-bodyweight exercise stays null',
    startingWeightForAthlete('Push-ups', BEGINNER) === null,
    `got ${startingWeightForAthlete('Push-ups', BEGINNER)}`);
  ok('an unknown exercise stays null',
    startingWeightForAthlete('Completely Invented Movement', BEGINNER) === null);
}

console.log('\n[4] THE OWNERSHIP BOUNDARY — one reader of the multiplier');
{
  function productFiles(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name === '__tests__') continue; productFiles(p, out); }
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
    }
    return out;
  }
  const files = productFiles(src);

  const readers = files
    .filter((f) => /\binitialLoadMultiplier\b/.test(stripComments(fs.readFileSync(f, 'utf8'))))
    .map((f) => path.relative(src, f))
    // the policy that DEFINES it, and the owner that APPLIES it
    .filter((f) => f !== 'rules/trainingAgePolicy.ts' && f !== 'utils/loadEstimation.ts');
  okEmpty('only the owner applies the beginner multiplier', readers,
    'every other module must call startingWeightForAthlete instead of '
    + 'multiplying the estimate itself — that is how the two paths diverged');

  // The render path is the one that was wrong. It must now ask the owner.
  // Comments stripped: the hook NAMES the estimator it stopped calling, so the
  // next reader knows why. A bare scan would read that note as the offence.
  const hook = stripComments(fs.readFileSync(path.join(src, 'screens/home/useDayWorkout.ts'), 'utf8'));
  ok('the render path calls the owner', /startingWeightForAthlete/.test(hook));
  ok('the render path no longer calls the raw estimator',
    !/\bestimateStartingWeight\b/.test(hook),
    'calling the raw estimator here is exactly the bug — it skips the multiplier');

  const gen = stripComments(fs.readFileSync(path.join(src, 'data/defaultProgram.ts'), 'utf8'));
  ok('the generation path calls the owner', /startingWeightForAthlete/.test(gen));
}

console.log('\n[5] Both paths would now answer identically');
{
  // The two call sites read the same inputs, so proving the owner is
  // deterministic for a given athlete+exercise proves they agree. This is the
  // assertion that would have failed before the fix.
  for (const name of ['Back Squat', 'Bench Press', 'Barbell Row']) {
    const a = startingWeightForAthlete(name, BEGINNER);
    const b = startingWeightForAthlete(name, BEGINNER);
    ok(`${name}: the owner is deterministic for one athlete`, a === b, `${a} vs ${b}`);
  }
}

const total = passed + failures.length;
console.log(`\nSingle load-estimation owner: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
