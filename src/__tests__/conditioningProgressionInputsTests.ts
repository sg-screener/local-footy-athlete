/**
 * THE RETIRED CONDITIONING PROGRESSION LAYER — this suite now guards its ABSENCE.
 *
 * ## What it used to be, and why it is not that any more
 *
 * It asserted the per-tier progression's behaviour: that feedback nudged the next
 * conditioning session's duration, that `_progressionState` moved from `maintain`
 * to `build`, and so on. **Every one of those cells was testing a system Sam
 * abolished on 2026-07-27.**
 *
 * Bible `:4966`: the `TIER_CAPS` progression is *"retired outright"*, its caps
 * *"were never authored: they are invented numbers that quietly decide an
 * athlete's conditioning dose, which is exactly what Section 6's law forbids"* —
 * and Section 6 `:1546` reads *"Doses come from the templates sheet. A layer that
 * invents its own conditioning dose is a defect."*
 *
 * **The layer kept running anyway** (census B1,
 * `docs/RULINGS_NOT_IN_THE_APP_2026-08-13.md`): `sessionBuilder` adjusted the
 * authored duration by a progression delta and stamped `_progression*` onto the
 * Workout, while the replacement ran at `conditioningSelection` at the same time.
 * Two systems dosing conditioning, the older one inventing its numbers — the
 * exact state he forbade.
 *
 * ## Why INVERTED rather than deleted
 *
 * Deleting it would remove the only thing that notices the layer coming back. A
 * suite whose subject is retired becomes the guard on the retirement — the same
 * move as inverting a cell rather than dropping it. What it asserts now is that
 * the authored dose reaches the athlete UNMODIFIED, which is Section 6's law
 * stated as a property rather than as prose.
 *
 * Run: npm run test:conditioning-progression-inputs
 */

import { readFileSync } from 'fs';
import { join } from 'path';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

const builder = readFileSync(join(__dirname, '..', 'utils', 'sessionBuilder.ts'), 'utf8');

console.log('\n[1] The retired layer does not dose conditioning');

ok('the session builder source was actually read', builder.length > 4000, String(builder.length));

// THE DOSE REACHES THE ATHLETE UNMODIFIED. `baseDuration` is the authored
// template's own number; the retired layer added a delta to it.
ok('the conditioning session ships the AUTHORED duration, not an adjusted one',
  /durationMinutes: baseDuration,/.test(builder),
  'sessionBuilder is not shipping `baseDuration` — something is adjusting the '
  + 'authored conditioning dose again (Bible :1546)');

ok('no progression delta is applied to the authored duration',
  !/baseDuration \+ \(progression\.adjustment/.test(builder),
  'the retired progression delta is back on the authored dose');

ok('the builder no longer calls the retired resolver',
  !/\bconst progression = resolveConditioningProgression\(/.test(builder),
  'sessionBuilder calls resolveConditioningProgression again — Bible :4966 '
  + 'retired that system outright');

// THE STAMPS WENT WITH IT. They had no production reader when removed; if they
// return, something is carrying the retired system's state forward again.
for (const field of ['_progressionState', '_progressionNote', '_progressionAdjustment']) {
  ok(`the workout carries no ${field}`,
    !new RegExp(`${field}: progression\\.`).test(builder),
    `${field} is being stamped onto the Workout again`);
}

// LIVENESS: the scan must be capable of seeing the thing it denies, or every
// cell above is green because the regexes match nothing at all.
ok('the detectors can see a fabricated relapse (liveness)',
  /baseDuration \+ \(progression\.adjustment/.test(
    'const x = baseDuration + (progression.adjustment.durationDelta || 0);')
  && /\bconst progression = resolveConditioningProgression\(/.test(
    '  const progression = resolveConditioningProgression(input);'));

console.log(`\nConditioning progression retirement: ${pass} passed, ${fail} failed`);
console.log('  NOT COVERED: this is a SOURCE guard. It proves the layer is not '
  + 'called from the builder; it does not prove no other module doses '
  + 'conditioning — conditioningSelection remains the one owner by ruling, not '
  + 'by a cell here.');
if (fail > 0) {
  console.error(`\nFAILURES:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
