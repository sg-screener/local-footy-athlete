/**
 * R-039 MECHANISM THREE — FATIGUE NEVER COLLAPSES A SESSION.
 *
 * SAM'S ABOLITION, `LFA_PROGRAMMING_BIBLE.md:4962`, 2026-07-27:
 *   *"Three sites shared the mechanism: the constraint builder, a rule
 *   escalating "limited" exposures to "removed" at severity 7+, and **a
 *   session-action rule converting a session to recovery once 75% of its rows
 *   were stripped.** All three are gone. Fatigue never blocks an exposure type
 *   and never collapses a session; the deload transform doses the work down and
 *   the session survives. **Injury is untouched** — a medical restriction may
 *   still block and pause."*
 *
 * ## WHY THIS SUITE EXISTS BESIDE `fatigueAbolitionLawTests`
 *
 * That suite (seat `patterns`, item 57) holds mechanisms ONE and TWO by
 * comparing the weekly exposure contract with the deload flag on and off. Its
 * own NOT-COVERED line names what it cannot reach, and names it honestly:
 *
 *   *"The third lives at the session-action layer, downstream of this builder,
 *   and a contract comparison cannot see it."*
 *
 * **This is that arm.** It does not re-assert what the sibling already holds.
 *
 * ## WHAT WAS MEASURED BEFORE ANY OF IT WAS WRITTEN
 *
 * Item 50's standing warning is *"if it is enforced, fix the ROW, not the app"*,
 * so the mechanism was traced before a cell was written. The 75% conversion
 * still EXISTS — `injuryAdjustmentEngine.ts:327`, *"8-10: if >= 50% of session
 * is risky, swap whole day to recovery shell"* — and `injuryAdjustmentEngine.ts`
 * contains **zero** occurrences of the word `fatigue`. The abolition is real:
 * the conversion survives for injury and has no fatigue entry.
 *
 * **SO THE INTERESTING QUESTION IS NOT "IS IT GONE" BUT "WHAT KEEPS IT GONE",
 * AND THE ANSWER TURNED OUT TO BE AN ACCIDENT.** Measured, not assumed:
 *
 *   `extractInjuryContext('im absolutely cooked 9/10')`
 *      -> `{ bodyPart: 'unknown', bucket: null, severity: 9 }`
 *
 * **A pure FATIGUE sentence — the verbatim name of R-038's most severe
 * READINESS tier — enters the INJURY door, at the pause band, on a live path**
 * (`CoachScreen.tsx:1294` -> `resolveInjuryFromMessage` -> here). It gets in
 * because "cooked" is a negative descriptor and `9/10` is a severity, and body
 * part is deliberately optional.
 *
 * **IT STRIPS NOTHING, AND ONLY FOR ONE REASON:** with `bucket: null` every
 * exercise rates `good`, so `avoidNames` and `cautionNames` are empty, so
 * `removeNames` is empty, so the 50% test can never be met and the session is
 * never swapped. **That inertness is the whole of the protection, and nothing
 * anywhere states it.** Making the region-agnostic fallback more careful —
 * *"no body part? then be cautious with everything"* is a change a reasonable
 * person would make — reinstates mechanism three for fatigue immediately, with
 * nothing red.
 *
 * **That is what block [4] pins.** Not the leak, which is harmless today: the
 * inertness that makes it harmless.
 *
 * ## THE CONTROL IS HALF THE GUARD
 *
 * A cell asserting "fatigue removes nothing" passes just as well when the
 * classifier is broken and removes nothing for anybody. Block [5] proves the
 * SAME classifier does rate real work risky for a real injury — which also pins
 * the other half of Sam's sentence, *"injury is untouched"*. The two are
 * asserted ASYMMETRIC in one cell, so it reds in both directions.
 *
 * Run: npm run test:fatigue-session-collapse
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import {
  readinessTierForSeverity,
  resolveReadinessDirective,
  resolveTierDirective,
  type LawTier,
} from '../rules/readinessIllnessLaw';
import { classifyExerciseRiskForBucket } from '../rules/injuryExerciseRisk';
import { extractInjuryContext } from '../utils/injuryAdjustmentEngine';
import {
  injurySeverityRemovesRiskyWork,
  severityPausesTraining,
} from '../rules/injurySeverityBands';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

/** The readiness door's whole vocabulary, at every severity the app can mint. */
const SEVERITIES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

console.log('\n[1] The readiness door CANNOT SPELL the abolished behaviour');
{
  // The strongest form this guard can take. Mechanism three removed rows and
  // changed a session's type; the door that fatigue actually travels through
  // returns a `TierDirective`, and if that type cannot carry "remove" or
  // "convert" then no amount of downstream code can be handed the instruction.
  //
  // Pinned as an EXACT key set, not a subset: a new field named
  // `removesExposures` or `convertToRecovery` reds here on the day it is added,
  // which is the day someone is reinstating the mechanism.
  const EXPECTED = ['deloaded', 'sessionsOptional'];
  const tiers: LawTier[] = ['noted', 'deloaded', 'optional'];
  for (const tier of tiers) {
    const keys = Object.keys(resolveTierDirective(tier)).sort();
    ok(`the '${tier}' directive carries exactly deloaded + sessionsOptional`,
      keys.length === EXPECTED.length && keys.every((k, i) => k === EXPECTED[i]),
      `got [${keys.join(', ')}] — a third field is a way to tell the session layer to `
      + 'remove or convert, which is exactly what Sam abolished');
  }
}

console.log('\n[2] There is NO severity-7 edge — the abolished trigger point is gone');
{
  // Sam's abolished mechanism fired at **severity 7+**. `injurySeverityBands`
  // records why that number is now indefensible: *"7 was never a band edge — it
  // is the INTERIOR of 6-7, so a cut point there split a band the Bible draws
  // whole."* So a reinstated 7+ trigger is visible as 6 and 7 diverging.
  const six = resolveReadinessDirective(readinessTierForSeverity(6));
  const seven = resolveReadinessDirective(readinessTierForSeverity(7));
  ok('[the abolished trigger] severity 6 and 7 give the IDENTICAL directive',
    six.deloaded === seven.deloaded && six.sessionsOptional === seven.sessionsOptional,
    `6 -> ${JSON.stringify(six)}, 7 -> ${JSON.stringify(seven)} — a 7+ cut point is `
    + 'the abolished escalation returning');

  ok('severity 6 and 7 are also the same TIER',
    readinessTierForSeverity(6) === readinessTierForSeverity(7),
    `${readinessTierForSeverity(6)} vs ${readinessTierForSeverity(7)}`);

  // And nothing anywhere on the ladder grows a third effect.
  const stray = SEVERITIES.filter((s) => {
    const keys = Object.keys(resolveReadinessDirective(readinessTierForSeverity(s)));
    return keys.length !== 2;
  });
  ok('no severity in 0..10 produces a directive with a third field',
    stray.length === 0, `severities with extra fields: ${stray.join(', ')}`);
}

console.log('\n[3] The WORST fatigue there is still keeps the session');
{
  const worst = resolveReadinessDirective(readinessTierForSeverity(10));
  ok('severity 10 is deloaded', worst.deloaded === true);
  ok('severity 10 makes sessions optional', worst.sessionsOptional === true);
  // "Optional" is the athlete's choice not to train. It is NOT the app removing
  // the session, and the distinction is the entire ruling: the deload transform
  // doses the work down and the session survives.
  ok('[R-039] and there is no third thing severity 10 can do to a session',
    Object.keys(worst).length === 2,
    `severity 10 directive = ${JSON.stringify(worst)}`);
}

console.log('\n[4] The fatigue->injury leak is REAL, and what makes it harmless is pinned');
{
  // HALF ONE — the leak. Recorded as a cell rather than a comment so that if it
  // is ever closed, this cell reds and whoever closed it deletes the second half
  // deliberately instead of leaving a guard standing on a premise that moved.
  const leaked = extractInjuryContext('im absolutely cooked 9/10');
  ok('[measured] a pure fatigue sentence still reaches the injury door',
    leaked !== null && leaked.bucket === null && leaked.severity === 9,
    `extractInjuryContext('im absolutely cooked 9/10') = ${JSON.stringify(leaked)} — `
    + 'if this is now null the leak was closed; delete the cells below WITH it');

  // HALF TWO — the inertness that is doing all the work. This is the load-
  // bearing assertion of the suite. Every one of these is a row a strength
  // session is built from; if a region-agnostic context ever rates one `avoid`
  // or `caution`, `removeNames` becomes non-empty, the 50%-risky test becomes
  // reachable, and mechanism three is back for fatigue.
  const ROWS = ['Back Squat', 'Bench Press', 'Romanian Deadlift', 'Walking Lunges', 'Pull-Ups'];
  const risky = ROWS.filter((n) => {
    const r = classifyExerciseRiskForBucket(n, null as never);
    return r === 'avoid' || r === 'caution';
  });
  ok('[R-039 mechanism 3] a null-bucket context rates NO strength row risky',
    risky.length === 0,
    `these rated risky with no body region: ${risky.join(', ')}. A fatigue sentence `
    + 'reaches this classifier with bucket=null (half one above), so the moment the '
    + 'region-agnostic fallback rates anything risky, fatigue starts stripping rows '
    + 'and the >=50% rule swaps the day to a recovery shell — the exact mechanism '
    + 'Sam abolished. Fix the ROUTING, never this fallback.');

  // The severity really is in the band that would convert, so the cell above is
  // not passing because 9 happens to be harmless.
  ok('[non-vacuity] severity 9 IS in the band that swaps a day to recovery',
    injurySeverityRemovesRiskyWork(9) && severityPausesTraining(9),
    'if 9 stopped being a converting severity, the cell above would pass for the '
    + 'wrong reason and the leak would need re-measuring at the new band');
}

console.log('\n[5] CONTROL — injury is untouched, and the two are ASYMMETRIC');
{
  // Without this the suite is "nothing was risky for anybody", which a broken
  // classifier passes perfectly.
  const hamstringRisky = ['Back Squat', 'Romanian Deadlift']
    .map((n) => classifyExerciseRiskForBucket(n, 'hamstring' as never))
    .filter((r) => r === 'avoid' || r === 'caution');
  ok('[control] a real injury bucket DOES rate strength work risky',
    hamstringRisky.length === 2,
    `hamstring ratings: ${hamstringRisky.join(', ')} — if this is empty the classifier `
    + 'is inert and block [4] proves nothing');

  // The asymmetry, in one cell, so it reds in both directions: same number, two
  // signals, different powers. This is Sam's sentence as an assertion.
  const fatigueAt9 = resolveReadinessDirective(readinessTierForSeverity(9));
  const fatigueRemovesRows = ['Back Squat', 'Romanian Deadlift']
    .some((n) => {
      const r = classifyExerciseRiskForBucket(n, null as never);
      return r === 'avoid' || r === 'caution';
    });
  ok('[R-039] at the SAME severity, injury may strip rows and fatigue may not',
    hamstringRisky.length > 0 && !fatigueRemovesRows && fatigueAt9.deloaded === true,
    `injury-risky=${hamstringRisky.length}, fatigue-strips=${fatigueRemovesRows}, `
    + `fatigue directive=${JSON.stringify(fatigueAt9)} — Sam: "fatigue never collapses `
    + 'a session; injury is untouched"');
}

// ── NOT COVERED, named rather than implied ─────────────────────────────────
//
// This suite holds the DOOR (block 1-3), the leak's inertness (4) and the
// asymmetry (5). It does NOT drive a generated week through the session-action
// layer and strip rows past 75% — that still needs the action walker, and it is
// still the honest remaining gap on mechanism three. What has changed is that
// the gap is now narrow: the only route from a fatigue sentence to a stripped
// row is the null-bucket fallback, and block [4] reds the moment it opens.
console.log('\n  NOT COVERED: driving a real week through the session-action layer '
  + '(needs the action walker) — see docs/STATUS_READINESS.md');

const total = passed + failures.length;
console.log(`\nFatigue session-collapse law: passed=${passed}/${total} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
