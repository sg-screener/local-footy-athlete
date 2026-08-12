/**
 * SAM'S EIGHT PHRASES, AND THE TWO KINDS THAT DELIBERATELY HAVE NONE.
 *
 * SEAT_INBOX item 22(a)/(b), ruled 2026-08-13. This suite is the READER half of
 * the `effect` field's contract: the field names its writer (every builder in
 * `activeProgramModifiers.ts`), its reader (`ModifiersSheet`) and its
 * behavioural test, which is this file.
 *
 * IT ASSERTS OVER THE REAL TABLE, NOT A COPY OF IT. The mapping is imported
 * from the component, so a phrase changed in the source changes what this
 * suite checks — a transcribed expectation would pass while the glass was
 * wrong.
 */
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
import { registerProjectionCopy } from '../rules/projectionCopy';
import { signedCopy } from '../rules/signedCopy';
import { isShownOnProgram, PROGRAM_HIDDEN_EFFECTS } from '../rules/programModifierVisibility';
import type { ActiveProgramModifierEffect } from '../utils/activeProgramModifiers';

armTotalsOrRed();
registerProjectionCopy();

let passed = 0;
let failed = 0;
const failures: string[] = [];
function run(name: string, fn: () => void): void {
  try { fn(); passed += 1; console.log(`  PASS ${name}`); }
  catch (e) { failed += 1; failures.push(`${name}: ${(e as Error).message}`); console.log(`  FAIL ${name}`); console.log(`      ${(e as Error).message}`); }
}
function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(msg); }

console.log('\n-- Modifier effect phrases (SEAT_INBOX 22a/22b) --');

// Sam's list, transcribed ONCE here because this is the signing record itself:
// the suite's job is to prove the shipped words are his, so it must hold his
// words independently of the registry it is checking.
const SAM_PHRASES: ReadonlyArray<[ActiveProgramModifierEffect, string]> = [
  ['volume_adjusted', 'Training volume adjusted'],
  ['training_eased', 'Training eased back'],
  ['exercises_swapped', 'Exercises swapped out'],
  ['training_paused', 'Training paused'],
  ['exercises_substituted', 'Exercises substituted'],
  ['sessions_moved', 'Sessions moved'],
  ['planned_lighter', 'Planned lighter week'],
  ['week_rebuilt', 'Week rebuilt around the game'],
];

run('all eight of Sam\'s phrases ship exactly as he wrote them', () => {
  for (const [effect, expected] of SAM_PHRASES) {
    const actual = signedCopy(`modifiers.effect.${effect}`) as unknown as string;
    assert(actual === expected,
      `the phrase for "${effect}" reads "${actual}" — Sam signed "${expected}". `
      + 'These are his words; an edit here is a rewrite of a signed sentence.');
  }
});

run('a time cap is hidden from Program, and nothing else is', () => {
  assert(PROGRAM_HIDDEN_EFFECTS.length === 1 && PROGRAM_HIDDEN_EFFECTS[0] === 'not_shown',
    `Program hides ${JSON.stringify(PROGRAM_HIDDEN_EFFECTS)}. Sam withdrew TIME CAPS `
    + 'and nothing else; every other modifier must still be visible and counted.');
  assert(!isShownOnProgram({ effect: 'not_shown' }),
    'a time-cap modifier is being shown on Program again — Sam took time caps out');
  for (const [effect] of SAM_PHRASES) {
    assert(isShownOnProgram({ effect }),
      `"${effect}" is hidden from Program. Sam signed a phrase for it, which is `
      + 'him asking for it to be SHOWN.');
  }
  assert(isShownOnProgram({ effect: 'unsigned' }),
    'modifiers without a signed phrase have been hidden from Program. They are '
    + 'real and active; a missing phrase is a gap in the WORDS, never a reason '
    + 'to stop telling the athlete their program changed.');
});

// THE COUNT AND THE LIST ARE THE SAME ARRAY, AND THIS IS WHY IT MATTERS.
// Hiding a row while still counting it is the defect this ruling created the
// risk of: the notice would read "2 active modifiers" over a list of one.
run('hiding a row also removes it from the count', () => {
  const notes = [
    { effect: 'volume_adjusted' as const },
    { effect: 'not_shown' as const },
    { effect: 'unsigned' as const },
  ];
  const shown = notes.filter(isShownOnProgram);
  assert(shown.length === 2,
    `Program would count ${shown.length} of these three. The notice counts what `
    + 'the sheet lists, so any difference is a number the athlete can see is wrong.');
});

console.log(`\nmodifier effect phrases: ${passed} passed, ${failed} failed`);
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log(`  - ${f}`); }
totalsPrinted(failures.length);
process.exit(failed === 0 ? 0 : 1);
