/**
 * Exercise-name ownership boundary (Part B / Stage 3, B5 §7).
 *
 * The curated layer owns every athlete-visible word; generation provides
 * structure only. Every athlete-visible reader canonicalises an exercise name
 * onto Sam's vocabulary FIRST (canonicalExerciseName), so an off-vocabulary
 * spelling from the AI backend ("Farmers Carry") can never silently fall through
 * to a generic cue or drop its load anchor.
 *
 * The four B5.7 boundary tests + the "Farmers Carry" regression fixture:
 *   1. Vocabulary-closure — every prescribable name lands on a curated cue key.
 *   2. No-generic-in-product — no prescribable exercise renders the generic cue.
 *   3. Anchor-resolves — every loaded exercise keeps a load profile.
 *   4. Ordering — the curated cue is the always-visible lead; generator
 *      per-exercise notes are not rendered.
 *
 * Run: npm run test:exercise-canonicalisation
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import fs from 'fs';
import path from 'path';
import { EXERCISE_CUES, getExerciseCue } from '../data/exerciseCues';
import { CONDITIONING_META } from '../data/exerciseTags';
import { POOL_REGISTRY } from '../data/exercisePools';
import { STRENGTH_POOLS } from '../data/exercisePoolsStrength';
import {
  EXERCISE_LOAD_MAP,
  isTrueBodyweightExercise,
  resolveExerciseName,
} from '../utils/loadEstimation';
import {
  canonicalExerciseName,
  hasCuratedCue,
  collectUnresolvedCues,
  assertCuratedExerciseCues,
  ExerciseVocabularyViolation,
} from '../utils/exerciseCanonicalisation';
import { buildCueText } from '../screens/home/dayWorkoutHelpers';
import { cuelessStrengthCards, enforceCuratedCueContract } from '../rules/curatedCueContract';

const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/** Every exercise the app can actually prescribe (mirrors authoredCueLibraryTests). */
function poolExerciseNames(): string[] {
  const names = new Set<string>();
  for (const pool of Object.values(POOL_REGISTRY)) {
    for (const entry of pool) names.add(entry.name);
  }
  for (const slot of Object.values(STRENGTH_POOLS)) {
    for (const definition of [slot.anchor, slot.accessory]) {
      for (const entry of definition.entries) names.add(entry.name);
    }
  }
  return [...names].sort();
}

const GENERIC_PRIMARY = 'Control the movement.';
const GENERIC_SECONDARY = 'Stay tight through the full range.';
const pool = poolExerciseNames();

console.log('\n[1] Vocabulary-closure — every prescribable name lands on a curated cue key');
{
  const unresolved = pool.filter((name) => !EXERCISE_CUES[canonicalExerciseName(name)]);
  ok('every prescribable exercise canonicalises to a curated cue key', unresolved.length === 0,
    `no curated key via the boundary: ${unresolved.join(', ')}`);
}

console.log('\n[2] No-generic-in-product — the generic cue is unreachable for prescribable exercises');
{
  const generic = pool.filter((name) => {
    const cue = getExerciseCue(canonicalExerciseName(name));
    return cue.primaryCue === GENERIC_PRIMARY && cue.secondaryCue === GENERIC_SECONDARY;
  });
  ok('no prescribable exercise renders the generic fallback cue', generic.length === 0,
    `fell through to generic: ${generic.join(', ')}`);

  // The stronger product guarantee: buildCueText NEVER returns the generic
  // filler — for a pool name, a non-pool defaultProgram fallback, or an
  // off-vocabulary AI-backend name, it returns a curated cue or nothing.
  const genericText = `${GENERIC_PRIMARY} ${GENERIC_SECONDARY}`;
  const offVocabulary = ['Mobility Flow', 'Hamstring Curl', 'Zerg Rush Deadlift', 'Some Made Up Move'];
  const leaked = [...pool, ...offVocabulary].filter((name) => buildCueText(name) === genericText);
  ok('buildCueText never renders the generic filler (curated cue or none)', leaked.length === 0,
    `buildCueText returned generic for: ${leaked.join(', ')}`);
}

console.log('\n[3] Anchor-resolves — every loaded exercise keeps a load profile');
{
  const unloaded = pool
    .filter((name) => !CONDITIONING_META[name])
    .filter((name) => {
      const resolved = resolveExerciseName(name);
      return !EXERCISE_LOAD_MAP[resolved] && !isTrueBodyweightExercise(name);
    });
  ok('every loaded exercise resolves a load profile (or is bodyweight)', unloaded.length === 0,
    `no load profile: ${unloaded.join(', ')}`);
}

console.log('\n[4] Ordering — curated cue is the always-visible lead; generator notes are gone');
{
  const screen = fs.readFileSync(path.join(src, 'screens/home/DayWorkoutScreenV2.tsx'), 'utf8');
  ok(
    'the strength/recovery cards no longer render generator per-exercise notes',
    !/styles\.exerciseNotes/.test(screen.replace(/exerciseNotes:\s*\{[\s\S]*?\},/, '')),
    'exercise.notes (styles.exerciseNotes) must not be rendered on the session screen',
  );
  ok(
    'the curated cue renders directly (not collapsed behind a note-gated toggle)',
    /cueText \? <Text style=\{styles\.cueText\}>\{cueText\}<\/Text>/.test(screen),
    'the cue is always visible, never hidden behind a "Form cues" disclosure',
  );
  ok(
    'buildCueText canonicalises before lookup',
    /canonicalExerciseName\(exerciseName\)/.test(
      fs.readFileSync(path.join(src, 'screens/home/dayWorkoutHelpers.ts'), 'utf8')),
  );
}

console.log('\n[5] "Farmers Carry" regression fixture (the AI-backend spelling)');
{
  ok('canonicalExerciseName("Farmers Carry") === "Farmer Carry"',
    canonicalExerciseName('Farmers Carry') === 'Farmer Carry',
    `got ${JSON.stringify(canonicalExerciseName('Farmers Carry'))}`);
  ok('the possessive form resolves too',
    canonicalExerciseName("Farmer's Carry") === 'Farmer Carry');
  ok('"Farmers Carry" has a curated cue (not generic)',
    hasCuratedCue('Farmers Carry'));
  ok('buildCueText("Farmers Carry") equals the curated Farmer Carry cue',
    buildCueText('Farmers Carry') === buildCueText('Farmer Carry') &&
    buildCueText('Farmers Carry') !== `${GENERIC_PRIMARY} ${GENERIC_SECONDARY}`,
    `got ${JSON.stringify(buildCueText('Farmers Carry'))}`);
  ok('resolveExerciseName("Farmers Carry") keeps the curated load anchor',
    Boolean(EXERCISE_LOAD_MAP[resolveExerciseName('Farmers Carry')]),
    `resolved to ${JSON.stringify(resolveExerciseName('Farmers Carry'))}`);
}

console.log('\n[6] Token-order & abbreviation variants resolve (run-3 cue coverage hole)');
{
  // The reported hole: "single-arm half-kneeling OHP" rendered cueless because
  // the whole-string alias table cannot match a reordered/abbreviated spelling.
  // The ingress boundary must be TOTAL — a token-normalised signature so word
  // order and in-compound abbreviations collapse onto the one curated key.
  const CANON = 'Half-Kneeling Single-Arm Overhead Press';
  ok('the reported variant resolves to the curated key',
    canonicalExerciseName('single-arm half-kneeling OHP') === CANON,
    `got ${JSON.stringify(canonicalExerciseName('single-arm half-kneeling OHP'))}`);
  ok('...and therefore has a curated cue (never a silent cueless card)',
    hasCuratedCue('single-arm half-kneeling OHP'));
  ok('...and buildCueText matches the canonical cue',
    buildCueText('single-arm half-kneeling OHP') === buildCueText(CANON) &&
    buildCueText('single-arm half-kneeling OHP') !== null,
    `got ${JSON.stringify(buildCueText('single-arm half-kneeling OHP'))}`);

  for (const variant of [
    'Single Arm Half Kneeling Overhead Press',   // spaces for hyphens
    'half-kneeling SA OHP',                       // both abbreviations
    'Press Overhead Single-Arm Half-Kneeling',    // full reorder
  ]) {
    ok(`variant "${variant}" resolves to the curated key`,
      canonicalExerciseName(variant) === CANON,
      `got ${JSON.stringify(canonicalExerciseName(variant))}`);
  }

  // The general invariant (not one phrase): every curated key resolves from a
  // word-order permutation of itself. This also guards against signature
  // collisions — a permuted key that resolved to a DIFFERENT curated key would
  // fail here.
  const curatedKeys = Object.keys(EXERCISE_CUES);
  const orderBroken = curatedKeys.filter((key) => {
    const reordered = key.split(/[\s-]+/).filter(Boolean).reverse().join(' ');
    return canonicalExerciseName(reordered) !== key;
  });
  ok('every curated key resolves from a word-order permutation of itself',
    orderBroken.length === 0,
    `did not resolve reordered: ${orderBroken.slice(0, 12).join(' | ')}`);
}

console.log('\n[7] Generation contract — an unresolved name is loud, never a silent cueless card');
{
  ok('a genuinely unknown name is reported unresolved',
    JSON.stringify(collectUnresolvedCues(['Zerg Rush Deadlift'])) === JSON.stringify(['Zerg Rush Deadlift']));
  ok('a resolved (even reordered/abbreviated) name is NOT reported',
    collectUnresolvedCues(['single-arm half-kneeling OHP', 'Hip Thrusts']).length === 0,
    `unexpected: ${collectUnresolvedCues(['single-arm half-kneeling OHP', 'Hip Thrusts']).join(', ')}`);
  ok('assertCuratedExerciseCues throws ExerciseVocabularyViolation on an unresolved name', (() => {
    try { assertCuratedExerciseCues(['Some Made Up Move'], 'unit'); return false; }
    catch (e) { return e instanceof ExerciseVocabularyViolation; }
  })());
  ok('assertCuratedExerciseCues passes clean input', (() => {
    try { assertCuratedExerciseCues(['Hip Thrusts', 'Trap Bar Deadlift'], 'unit'); return true; }
    catch { return false; }
  })());
  // The deterministic pool corpus never trips the contract — proves the
  // acceptance wiring cannot brick a normally-generated program.
  ok('no pool exercise trips the contract',
    collectUnresolvedCues(pool).length === 0,
    `pool names without a curated cue: ${collectUnresolvedCues(pool).slice(0, 12).join(', ')}`);
}

console.log('\n[8] Runtime invariant — scoped to the render truth (cued strength cards only)');
{
  // The contract is scoped by the SAME partition the screen renders with
  // (getSessionComponentRows): only rows that become a cued StrengthExerciseCard
  // are checked. Conditioning / recovery sessions have no strength rows, so their
  // freeform "Speed warm-up" / "Brisk Walking" text is exempt by render path, not
  // by a name allow-list. Predicate is buildCueText === null (a family-fallback
  // cue still counts), so only a genuinely blank card is a violation.
  const strengthWk: any = { workoutType: 'Strength', exercises: [
    { id: 'a', exercise: { name: 'Back Squat' } },                    // cued
    { id: 'b', exercise: { name: 'single-arm half-kneeling OHP' } },  // reordered/abbrev → cued
    { id: 'c', exercise: { name: 'Some Made Up Move' } },             // genuinely cueless
  ] };
  const recoveryWk: any = { workoutType: 'Recovery', sessionTier: 'recovery',
    exercises: [{ id: 'd', exercise: { name: 'Brisk Walking' } }] };
  const conditioningWk: any = { workoutType: 'Conditioning',
    exercises: [{ id: 'e', exercise: { name: 'Speed warm-up' } }] };

  ok('a cueless strength card is flagged; cued (incl. reordered/abbrev) are not',
    JSON.stringify(cuelessStrengthCards(strengthWk)) === JSON.stringify(['Some Made Up Move']),
    `got ${JSON.stringify(cuelessStrengthCards(strengthWk))}`);
  ok('conditioning freeform text is exempt by render path (no strength rows)',
    cuelessStrengthCards(conditioningWk).length === 0);
  ok('recovery freeform text is exempt by render path (no strength rows)',
    cuelessStrengthCards(recoveryWk).length === 0);
  ok('enforceCuratedCueContract is loud but non-throwing (never bricks generation)', (() => {
    try { enforceCuratedCueContract([strengthWk, recoveryWk, conditioningWk], 'unit'); }
    catch { return false; }
    return true;
  })());
}

console.log(`\nexercise canonicalisation: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
