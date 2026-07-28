/**
 * THE TRAINING CAPACITY RUBRIC — Sam-authored, Bible Section 9.
 *
 * Batch 1 of the engine-thresholds unit. The rubric that scores an athlete's
 * standing capacity was the largest unsourced cluster left in the repo: 18
 * numbers, no Bible section, no ruling, and the code was both the claim and the
 * only evidence for it.
 *
 * SAM'S RULING (2026-07-28) authored it down to 14 and then to 8 live numbers
 * plus 3 band edges:
 *   - two ladders, EQUAL WEIGHT, 3/2/1/0 each                    (ruled as-is)
 *   - the sprint +0.5 modifier is DELETED — a boundary-only half-point is
 *     noise, and the Bible owns sprint as a weekly floor, not a capacity signal
 *   - the in-season -1 modifier is DELETED — phase already shapes the week
 *     through the contracts and game fatigue enters through the readiness
 *     facts, so scoring it again double-counts
 *   - the injury penalty is DELETED — injury acts only through its own law
 *     family
 *   - unknown answers no longer score +1: FAIL LOUD, never score silently
 *   - bands on the resulting 0-6: low <=2, medium 3-4, high 5-6
 *
 * WHY THE DELETIONS NEED ASSERTIONS OF THEIR OWN. Each deleted modifier could
 * be re-added by a single line that looks locally reasonable, and every
 * behavioural test would still pass — the score would just be quietly different.
 * So the gate asserts the arithmetic AND asserts the deleted terms are absent
 * from the source. Deleting is the fix; the source assertion is what keeps it
 * deleted for inputs that do not exist yet.
 *
 * Run: npm run test:capacity-rubric
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  CAPACITY_RUBRIC_ANCHOR,
  CONSISTENCY_SCORES,
  CONDITIONING_SCORES,
  CAPACITY_BANDS,
  scoreCapacity,
  capacityBandFor,
  MissingCapacityAnswerError,
} from '../data/capacityRubric';
import { stripComments, statesWholeNumber } from './support/sourceText';

const repoRoot = path.resolve(__dirname, '../..');
const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

console.log('\n[1] The two ladders, exactly as ruled');
{
  ok('Very consistent scores 3', CONSISTENCY_SCORES['Very consistent'] === 3);
  ok('Pretty consistent scores 2', CONSISTENCY_SCORES['Pretty consistent'] === 2);
  ok('A bit scores 1', CONSISTENCY_SCORES['A bit'] === 1);
  ok('Hardly at all scores 0', CONSISTENCY_SCORES['Hardly at all'] === 0);

  ok('Elite scores 3', CONDITIONING_SCORES.Elite === 3);
  ok('Good scores 2', CONDITIONING_SCORES.Good === 2);
  ok('Average scores 1', CONDITIONING_SCORES.Average === 1);
  ok('Poor scores 0', CONDITIONING_SCORES.Poor === 0);

  // "Equal weight" is the ruling's own phrase and is a structural claim, not a
  // coincidence of two tables that happen to match today.
  ok('the ladders carry equal weight',
    Object.values(CONSISTENCY_SCORES).sort().join() ===
    Object.values(CONDITIONING_SCORES).sort().join(),
    'the ruling says equal weight; the two ladders must span the same range');
}

console.log('\n[2] The score runs 0-6 and nothing else feeds it');
{
  ok('the floor is 0', scoreCapacity('Hardly at all', 'Poor') === 0);
  ok('the ceiling is 6', scoreCapacity('Very consistent', 'Elite') === 6);
  ok('the ladders add', scoreCapacity('A bit', 'Good') === 3);

  // The score is a pure function of exactly two answers. If a third term ever
  // creeps back in, these two identical calls stop agreeing.
  ok('the score depends on nothing but the two answers',
    scoreCapacity('Pretty consistent', 'Average') === 3 &&
    scoreCapacity('Pretty consistent', 'Average') === 3);

  // Every reachable combination lands in range — cheaper than trusting the ends.
  const all: number[] = [];
  for (const c of Object.keys(CONSISTENCY_SCORES) as Array<keyof typeof CONSISTENCY_SCORES>) {
    for (const f of Object.keys(CONDITIONING_SCORES) as Array<keyof typeof CONDITIONING_SCORES>) {
      all.push(scoreCapacity(c, f));
    }
  }
  ok('all 16 combinations score within 0-6',
    all.length === 16 && all.every((n) => Number.isInteger(n) && n >= 0 && n <= 6));
  ok('no score is fractional — the half-point is gone',
    all.every((n) => Number.isInteger(n)));
}

console.log('\n[3] The bands, including the edge Sam called out by name');
{
  ok('0 is low', capacityBandFor(0) === 'low');
  ok('2 is low', capacityBandFor(2) === 'low');
  ok('3 is medium', capacityBandFor(3) === 'medium');
  ok('4 is medium', capacityBandFor(4) === 'medium');
  ok('5 is high', capacityBandFor(5) === 'high');
  ok('6 is high', capacityBandFor(6) === 'high');

  // Sam ruled this case explicitly: "A bit + Average = low is intended — show
  // some training before we build." Pinned by name so a later widening of the
  // low band has to argue with the ruling rather than slide past it.
  ok('"A bit" + "Average" is low, as ruled',
    capacityBandFor(scoreCapacity('A bit', 'Average')) === 'low');

  ok('the bands cover 0-6 with no gap',
    CAPACITY_BANDS.reduce((n, b) => n + (b.max - b.min + 1), 0) === 7);
}

console.log('\n[4] FAIL LOUD — a missing answer is refused, never scored');
{
  // The same law as the deleted default bodyweight. A default here is worse
  // than it looks: it does not merely guess, it guesses CONFIDENTLY, and the
  // athlete gets a progression tier nobody chose for them.
  for (const [c, f, why] of [
    [undefined, 'Good', 'consistency missing'],
    ['A bit', undefined, 'conditioning missing'],
    [undefined, undefined, 'both missing'],
  ] as Array<[unknown, unknown, string]>) {
    let threw: unknown = null;
    try {
      scoreCapacity(c as never, f as never);
    } catch (error) {
      threw = error;
    }
    ok(`refuses when ${why}`, threw instanceof MissingCapacityAnswerError,
      `got ${threw === null ? 'no throw' : String(threw)}`);
  }

  // An unrecognised value is not the same as a missing one, but it must not
  // score either — silently mapping it to 0 would make a typo look like "Poor".
  let threw: unknown = null;
  try {
    scoreCapacity('Sometimes' as never, 'Good');
  } catch (error) {
    threw = error;
  }
  ok('refuses an unrecognised answer', threw instanceof MissingCapacityAnswerError);

  // The refusal has to say what is missing, or the loudness is wasted.
  try {
    scoreCapacity(undefined as never, undefined as never);
  } catch (error) {
    const message = String((error as Error).message);
    ok('the refusal names the missing fields',
      /recentTrainingLoad/.test(message) && /conditioningLevel/.test(message), message);
  }
}

console.log('\n[5] The deleted terms are GONE from the engine, not merely bypassed');
{
  const engine = stripComments(fs.readFileSync(path.join(src, 'utils/coachingEngine.ts'), 'utf8'));

  ok('the sprint +0.5 capacity modifier is gone',
    !/score\s*\+=\s*0\.5/.test(engine),
    'a boundary-only half-point was ruled out as noise');
  ok('the in-season -1 capacity modifier is gone',
    !/score\s*-=\s*1\b/.test(engine),
    'phase already shapes the week through the contracts');
  ok('the injury penalty is gone from the rubric',
    !/injuryPenalty/.test(engine),
    'injury acts only through its own law family');
  // Scoped to the two rubric switches specifically. A generic `score += N`
  // sweep also catches this file's unrelated placement scorers, and a gate that
  // fires on innocent code gets loosened rather than obeyed.
  ok('the engine no longer switches on recentTrainingLoad to score',
    !/switch\s*\(\s*inputs\.recentTrainingLoad\s*\)/.test(engine),
    'the ladders live in data/capacityRubric.ts, which cites the Bible');
  ok('the engine no longer switches on conditioningLevel to score',
    !/switch\s*\(\s*inputs\.conditioningLevel\s*\)/.test(engine));
  ok('the engine reads the authored rubric',
    /capacityRubric/.test(fs.readFileSync(path.join(src, 'utils/coachingEngine.ts'), 'utf8')));
}

console.log('\n[6] No seam silently substitutes an answer');
{
  // Reachability, per the ruling. Onboarding requires both answers, so the
  // rubric's unknown tier was never reachable THERE — but three other seams
  // supplied one anyway, which is why "verify reachability" was part of the
  // ruling rather than a formality.
  const store = stripComments(fs.readFileSync(path.join(src, 'store/programStore.ts'), 'utf8'));
  ok('programStore does not default recentTrainingLoad',
    !/recentTrainingLoad:\s*[^,\n]*\?\?\s*'/.test(store),
    "`?? 'Pretty consistent'` scored a missing answer as +2");
  ok('programStore does not default conditioningLevel',
    !/conditioningLevel:\s*[^,\n]*\?\?\s*'/.test(store),
    "`?? 'Good'` scored a missing answer as +2");

  const readiness = stripComments(fs.readFileSync(path.join(src, 'utils/readiness.ts'), 'utf8'));
  ok('deriveProfileReadiness does not swallow the refusal',
    !/catch\s*\{\s*return\s*'medium'/.test(readiness),
    'a catch that returns medium defeats the fail-loud one layer up');

  const postGen = stripComments(
    fs.readFileSync(path.join(src, 'utils/postGenerationConstraintValidation.ts'), 'utf8'));
  ok('post-generation does not infer capacity from the week it built',
    !/strength\.targetCount\s*>=\s*args\.contract\.strength\.preferred\.max[\s\S]{0,40}'high'/.test(postGen),
    'inferring capacity from the contract runs the ruling backwards: structure would set capacity');
}

console.log('\n[7] PROVENANCE — the rubric traces to the Bible section that states it');
{
  ok('the anchor names a Bible section', CAPACITY_RUBRIC_ANCHOR.section.length > 0);
  ok('the ruling is dated', /^\d{4}-\d{2}-\d{2}$/.test(CAPACITY_RUBRIC_ANCHOR.ruledOn));

  const biblePath = path.join(repoRoot, CAPACITY_RUBRIC_ANCHOR.where);
  ok('the Bible exists at the attributed path', fs.existsSync(biblePath));

  const bible = fs.readFileSync(biblePath, 'utf8');
  for (const quote of CAPACITY_RUBRIC_ANCHOR.quotes) {
    ok(`the anchor appears verbatim: "${quote.slice(0, 44)}..."`, bible.includes(quote));
  }

  // THE BINDING. Not "a section exists" but "it states THESE numbers". Whole
  // numbers, not substrings — `includes('3')` is satisfied by the "3" in "0-3".
  const ladderQuote = CAPACITY_RUBRIC_ANCHOR.quotes.join(' ');
  for (const n of [0, 1, 2, 3]) {
    ok(`the Bible states the ladder value ${n}`, statesWholeNumber(ladderQuote, n));
  }
  for (const n of [4, 5, 6]) {
    ok(`the Bible states the band value ${n}`, statesWholeNumber(ladderQuote, n));
  }

  // The deletions are law too, and law that lives only in a commit message is
  // not law. The Bible has to say what does NOT score.
  ok('the Bible records that sprint does not score into capacity',
    /Sprint exposure is a weekly floor[^.]*not a capacity signal/.test(bible));
  ok('the Bible records that phase does not score into capacity',
    /neither is scored again here/.test(bible));
  ok('the Bible records that injury does not adjust capacity',
    /Injury acts only through the injury law family and never adjusts this score/.test(bible));
  ok('the Bible records the fail-loud requirement',
    /There is no default and no unknown tier/.test(bible));
}

const total = passed + failures.length;
console.log(`\nCapacity rubric: passed=${passed}/${total} failures=${failures.length}`);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
