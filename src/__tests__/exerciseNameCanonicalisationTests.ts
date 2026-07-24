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
import { canonicalExerciseName, hasCuratedCue } from '../utils/exerciseCanonicalisation';
import { buildCueText } from '../screens/home/dayWorkoutHelpers';

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

console.log(`\nexercise canonicalisation: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
