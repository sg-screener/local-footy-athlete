/**
 * RENDER-TRUTH — a card's load label must derive from an authored value.
 *
 * THE GAP SAM CAUGHT. Every existing gate passed while the Dumbbell Pullovers
 * card displayed "BW" for a dumbbell exercise. The reconciliation gate asks
 * "is load handled?" — it never asks "is the label honest?". Handled and
 * honest are different questions, and only the second one is what the athlete
 * reads.
 *
 * The Pullovers fix added ATHLETE_CHOSEN_LOAD_EXERCISES plus an early exit.
 * Correct for that exercise, and a per-exercise guard for the class: the set
 * has one member while 62 of 195 selectable exercises still reach a load claim
 * through inference rather than authorship. Two inference channels:
 *
 *   LABEL   `isTrueBodyweightExercise` promotes to "BW" from a tag category
 *           (movement === 'plyo' | 'conditioning') or a name regex
 *           (/push.?up|pull.?up|plank|burpee/).
 *   WEIGHT  `estimateFromTags` returns a hardcoded 10 for loaded core, and
 *           `estimateFromNamePattern` carries an 18-row shadow load map keyed
 *           by regex — ratios that appear in no sheet and no ruling. That
 *           table is what invented 12.5kg for Dumbbell Pullovers.
 *
 * A category is not an authority. This suite requires every athlete-facing
 * load claim to name the authored source it came from, and requires the
 * absence of a source to render as absence — never as a confident "BW", and
 * never as an invented number.
 *
 * Run: npm run test:render-truth
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import { selectableExerciseNames } from '../data/selectableExerciseVocabulary';
import {
  ATHLETE_CHOSEN_LOAD_EXERCISES,
  EXERCISE_LOAD_MAP,
  TRUE_BODYWEIGHT_EXERCISES,
  estimateStartingWeight,
  formatLoadLabel,
  isTrueBodyweightExercise,
  resolveLoadAuthority,
} from '../utils/loadEstimation';
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
    `${detail ? `${detail}\n      ` : ''}${[...offenders].slice(0, 40).sort().join('\n      ')}`);
}

/** A representative athlete — the anchors any invented ratio would multiply. */
const ATHLETE = {
  bodyweightKg: 80,
  squatStrength: 'intermediate',
  benchStrength: 'intermediate',
} as unknown as OnboardingData;

const names = selectableExerciseNames();

console.log('\n[1] Every selectable exercise resolves a NAMED authority');
{
  ok('the vocabulary is non-trivial', names.length > 150, `${names.length} selectable`);

  // The whole point: `resolveLoadAuthority` returns a discriminated result that
  // names WHERE the claim came from. There is no fifth kind — an exercise the
  // authored sources do not cover is `unauthored`, explicitly, rather than
  // being quietly handed to a heuristic.
  const badKind = names.filter((n) => {
    const a = resolveLoadAuthority(n);
    return !['bodyweight', 'athlete_chosen', 'prescribed', 'unauthored'].includes(a.kind);
  });
  okEmpty('every exercise resolves to one of the four authority kinds', badKind);

  const authoredWithoutSource = names.filter((n) => {
    const a = resolveLoadAuthority(n);
    return a.kind !== 'unauthored' && !('source' in a && typeof a.source === 'string' && a.source.length > 0);
  });
  okEmpty('every AUTHORED authority names its source', authoredWithoutSource,
    'an authority without a source is indistinguishable from a guess');
}

console.log('\n[2] THE LOCK — no load claim is inferred from a category or a name');
{
  // An authority may only come from one of the three authored sets or the
  // ruled map. If `resolveLoadAuthority` ever consults EXERCISE_TAGS or a name
  // pattern again, the source string stops matching this closed list.
  const AUTHORED_SOURCES = [
    'TRUE_BODYWEIGHT_EXERCISES',
    'PREHAB_NO_LOAD_EXERCISES',
    'ATHLETE_CHOSEN_LOAD_EXERCISES',
    'EXERCISE_LOAD_MAP',
  ];
  const inferred = names
    .map((n) => ({ n, a: resolveLoadAuthority(n) }))
    .filter(({ a }) => a.kind !== 'unauthored')
    .filter(({ a }) => !AUTHORED_SOURCES.includes((a as { source: string }).source))
    .map(({ n, a }) => `${n}   [source=${(a as { source: string }).source}]`);
  okEmpty('no authority is sourced outside the authored sets', inferred, AUTHORED_SOURCES.join(' | '));
}

console.log('\n[3] Absence renders as absence — never "BW", never a number');
{
  const unauthored = names.filter((n) => resolveLoadAuthority(n).kind === 'unauthored');
  console.log(`      (${unauthored.length} exercises currently carry no authored load source)`);

  // This is the Pullovers defect stated generally. "BW" is a CLAIM about how
  // the exercise is loaded. Making it the fallback means the app's least
  // informed state is also its most confident one.
  okEmpty('no unauthored exercise reports itself as bodyweight',
    unauthored.filter((n) => isTrueBodyweightExercise(n)),
    'these have no authored bodyweight ruling but render "BW"');

  okEmpty('no unauthored exercise receives an estimated weight',
    unauthored.filter((n) => estimateStartingWeight(n, ATHLETE) !== null),
    'a weight with no authored ratio behind it is invented');

  okEmpty('no unauthored exercise renders a load label',
    unauthored.filter((n) => formatLoadLabel(resolveLoadAuthority(n), null) !== '-'),
    'the honest label for "we were never told" is "-"');
}

console.log('\n[4] The render seam formats from the AUTHORITY, not from a weight');
{
  // formatWeight (useDayWorkout) previously decided "BW" by asking
  // isTrueBodyweightExercise separately from the weight lookup, so the label
  // and the number could disagree. One input, one decision.
  ok('an authored bodyweight exercise reads BW',
    formatLoadLabel({ kind: 'bodyweight', source: 'TRUE_BODYWEIGHT_EXERCISES' }, null) === 'BW');

  ok('an authored bodyweight exercise with added load reads BW + Xkg',
    formatLoadLabel({ kind: 'bodyweight', source: 'TRUE_BODYWEIGHT_EXERCISES' }, 12) === 'BW + 12kg');

  // The Pullovers case, pinned as behaviour rather than as a set membership.
  ok('an athlete-chosen load never reads BW, even with no weight entered',
    formatLoadLabel({ kind: 'athlete_chosen', source: 'ATHLETE_CHOSEN_LOAD_EXERCISES' }, null) === '-');

  ok('an athlete-chosen load renders the athlete\'s own number verbatim',
    formatLoadLabel({ kind: 'athlete_chosen', source: 'ATHLETE_CHOSEN_LOAD_EXERCISES' }, 12) === '12kg');

  ok('an unauthored exercise never reads BW even when a weight exists',
    formatLoadLabel({ kind: 'unauthored' }, 12) === '12kg');
}

console.log('\n[5] The invention channels are GONE from the module');
{
  // Source-level, deliberately. A behavioural assertion proves no CURRENT
  // exercise reaches the heuristic; it cannot stop the heuristic being handed
  // a name tomorrow. Deleting the code is what closes it for names that do
  // not exist yet — including the ones the generator invents.
  // Comments are stripped first. The module's header DESCRIBES the heuristics
  // it retired, naming them verbatim so the next reader knows why they are
  // gone — a bare `includes` would read that explanation as the offence.
  const source = fs.readFileSync(path.join(src, 'utils/loadEstimation.ts'), 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');

  ok('the name-pattern shadow load map is deleted',
    !/function estimateFromNamePattern/.test(source),
    'an 18-row regex→ratio table is a second EXERCISE_LOAD_MAP that nobody authored');

  ok('the tag-category weight heuristic is deleted',
    !/function estimateFromTags/.test(source),
    'a movement category is not an authority on kilograms');

  ok('no tag category can still promote a name to bodyweight',
    !/movement === '(plyo|conditioning)'/.test(source),
    'this is the label half of the same defect');
}

console.log('\n[6] The authored sets still hold their own members');
{
  // Guard against "fixing" the lock by emptying the sets it reads.
  okEmpty('every TRUE_BODYWEIGHT member resolves as bodyweight',
    [...TRUE_BODYWEIGHT_EXERCISES].filter((n) => resolveLoadAuthority(n).kind !== 'bodyweight'));

  okEmpty('every ATHLETE_CHOSEN member resolves as athlete-chosen',
    [...ATHLETE_CHOSEN_LOAD_EXERCISES].filter((n) => resolveLoadAuthority(n).kind !== 'athlete_chosen'));

  okEmpty('every EXERCISE_LOAD_MAP entry resolves as prescribed or bodyweight',
    Object.keys(EXERCISE_LOAD_MAP)
      .filter((n) => !['prescribed', 'bodyweight'].includes(resolveLoadAuthority(n).kind)));

  ok('Dumbbell Pullovers is still athlete-chosen (the original ruling)',
    resolveLoadAuthority('Dumbbell Pullovers').kind === 'athlete_chosen');
}

const total = passed + failures.length;
console.log(`\nRender-truth load label: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
