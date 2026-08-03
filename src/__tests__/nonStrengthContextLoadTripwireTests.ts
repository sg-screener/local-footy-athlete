/**
 * TRIPWIRE — the strength-context gap, logged as debt rather than fixed.
 *
 * THE GAP (Sam, accepted as logged debt 2026-07-28). `startingWeightForAthlete`
 * owns the beginner load multiplier and both paths call it. But the GENERATION
 * path only reaches the owner from inside `applyTrainingAgePrescription`, which
 * early-returns unless `isStrengthPrescriptionContext` is true. The owner does
 * not model that gate. The render-time fallback has no such gate.
 *
 * So the two paths agree everywhere they both compute a weight, EXCEPT for a
 * prescribed-load exercise appearing in a NON-strength context with no stored
 * weight. Generation would skip the multiplier; the fallback would apply it.
 *
 * WHY IT IS NOT FIXED. That gate also owns sets, reps and RPE for beginners.
 * Touching it is a behaviour change across three prescriptions, not one, and
 * deserves its own before/after. Sam ruled: log the debt, do not expand scope.
 *
 * WHY A TRIPWIRE AND NOT A COMMENT. The gap is DORMANT, not theoretical. It is
 * dormant only because no exercise carrying a prescribed load ratio is reachable
 * on a non-strength surface THAT ASKS FOR A WEIGHT — every recovery-context pool
 * holds bodyweight, prehab or unauthored movements, where the owner returns null
 * either way and the divergence cannot express itself.
 *
 * That is a property of today's exercise DATA, not of the code. Nothing stops
 * someone adding a dumbbell movement to the mobility pool, and the day that
 * happens the gap goes live silently — a beginner reads one weight on a
 * generated card and another on a fallback card, with no test objecting. This
 * suite is what objects. If [2] fails, the gap is live and the strength-context
 * unit is due; do not silence it by moving the exercise.
 *
 * WHAT THIS SUITE FOUND ON ITS FIRST RUN. An earlier revision tested "a
 * prescribed-load name on any non-strength surface" and fired immediately, on
 * Face Pull and Suitcase Carry in the recovery add-ons. That was the check being
 * wrong, not the gap being live: the add-on surface carries a dose STRING and no
 * weight field, so it never asks the estimator anything and the two paths cannot
 * disagree there. The condition is therefore about WEIGHT-BEARING surfaces, and
 * [3] pins the reason that carve-out holds instead of assuming it — the moment
 * add-ons gain a weight, the carve-out is void and those two are live.
 *
 * Run: npm run test:nonstrength-tripwire
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

import { POOL_REGISTRY } from '../data/exercisePools';
import { recoveryAddonExerciseVocabulary } from '../utils/recoveryAddonBuilder';
import { resolveLoadAuthority } from '../utils/loadEstimation';

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

/**
 * Categories that CANNOT satisfy `isStrengthPrescriptionContext`.
 *
 * Read off that function directly: it returns true for anything matching
 * strength / upper / lower / push / pull / squat / hinge / full body / gunshow /
 * accessor / prehab / pump. So the arms-pump and prehab pools ARE strength
 * contexts and are correctly absent here. What remains is the recovery family.
 */
const NON_STRENGTH_CATEGORIES = [
  'tissue_quality',
  'mobility',
  'easy_cardio',
  'breathing_reset',
] as const;

const prescribed = (name: string): boolean =>
  resolveLoadAuthority(name).kind === 'prescribed';

console.log('\n[1] The tripwire is watching something real');
{
  const total = NON_STRENGTH_CATEGORIES
    .reduce((n, c) => n + ((POOL_REGISTRY as Record<string, unknown[]>)[c] ?? []).length, 0);
  ok('the recovery-context pools are non-empty', total > 20, `${total} exercises`);


  // Proof the detector can see a prescribed load at all — otherwise [2] would
  // pass because the check is broken rather than because the gap is dormant.
  ok('the detector recognises a prescribed-load exercise',
    prescribed('Back Squat'), 'resolveLoadAuthority no longer reports prescribed');
  ok('the detector does not fire on bodyweight', !prescribed('Push-ups'));
}

console.log('\n[2] THE TRIPWIRE — no prescribed load on a WEIGHT-BEARING non-strength surface');
{
  // "Weight-bearing" is load-bearing in the condition, and it is not a
  // convenience narrowing. The divergence needs a surface that ASKS the
  // estimator for a weight. These two produce `WorkoutExercise` rows whose
  // weight comes from the estimator, so they can express it. The recovery-addon
  // surface cannot, and [3] pins the reason rather than assuming it.
  const offenders: string[] = [];

  for (const category of NON_STRENGTH_CATEGORIES) {
    const pool = (POOL_REGISTRY as Record<string, Array<{ name: string }>>)[category] ?? [];
    for (const exercise of pool) {
      if (prescribed(exercise.name)) offenders.push(`${category}: ${exercise.name}`);
    }
  }

  // The flow bundles are retired (2026-07-30); the composed flow draws from
  // POOL_REGISTRY.mobility, which the loop above already sweeps — so this surface
  // is still covered, by the pool rather than by ten groupings of it.

  okEmpty('no weight-bearing non-strength surface offers a prescribed-load exercise', offenders,
    'THE GAP IS NOW LIVE. A beginner can read one weight on a generated card and '
    + 'another on a fallback card for these. This is the trigger condition for the '
    + 'applyTrainingAgePrescription strength-context unit — see '
    + 'docs/PROVENANCE_INVENTORY_2026-07-28.md. Do NOT silence this by relocating '
    + 'the exercise; the gate is what needs the fix');
}

console.log('\n[3] The recovery-addon carve-out, and the reason it holds');
{
  // FOUND BY THIS SUITE ON ITS FIRST RUN. `recoveryAddonExerciseVocabulary()`
  // — enumerated by running the real selection logic — offers two exercises
  // that DO carry a prescribed load ratio: Face Pull and Suitcase Carry.
  //
  // By the letter of the trigger condition that is the gap going live. It is
  // not, because the recovery-addon surface has no weight channel at all:
  // `RecoveryAddonExercise` is { id, name, prescription, source } with no
  // weight field, the builder never sets `prescribedWeightKg`, and
  // `RecoveryAddonSection` renders the `prescription` STRING. Nothing on that
  // path ever asks the estimator anything, so the two paths cannot disagree.
  //
  // The carve-out is therefore about the SURFACE, not about those two names —
  // which is why the assertions below pin the surface. The moment recovery
  // addons gain a weight, the carve-out is void and these two are live.
  const namesWithLoad = recoveryAddonExerciseVocabulary().filter(prescribed);

  ok('the carve-out is still about the two known names',
    namesWithLoad.length === 2
      && namesWithLoad.includes('Face Pull')
      && namesWithLoad.includes('Suitcase Carry'),
    `recovery-addon vocabulary now offers ${namesWithLoad.length} prescribed-load `
    + `exercises: ${namesWithLoad.join(', ')}. A NEW one means re-checking whether `
    + 'the surface is still weightless before extending this carve-out');

  const builder = fs.readFileSync(path.join(src, 'utils/recoveryAddonBuilder.ts'), 'utf8');
  ok('the recovery-addon builder still assigns no weight',
    !/prescribedWeightKg/.test(builder),
    'the addon surface has gained a weight channel — the carve-out is VOID and '
    + 'the strength-context unit is now due');

  const domain = fs.readFileSync(path.join(src, 'types/domain.ts'), 'utf8');
  const shape = domain.slice(domain.indexOf('interface RecoveryAddonExercise'));
  ok('RecoveryAddonExercise still carries no weight field',
    !/weight/i.test(shape.slice(0, shape.indexOf('}'))),
    'a weight field on the addon row voids the carve-out');
}

const total = passed + failures.length;
console.log(`\nNon-strength context load tripwire: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
