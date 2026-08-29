/**
 * SAM'S TWELVE PHRASES, AND THE TWO KINDS THAT DELIBERATELY HAVE NONE.
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
import {
  selectActiveProgramModifiers,
  type ActiveProgramModifierEffect,
} from '../utils/activeProgramModifiers';

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

console.log('\n-- Modifier effect phrases (SEAT_INBOX 22a/22b + 23) --');

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
  // SEAT_INBOX 23, signed 2026-08-13. Typed by hand like the eight above,
  // because this array IS the signing record: importing them from the registry
  // this suite exists to check would make it agree with itself.
  ['exercise_preference_applied', 'Exercise preference applied'],
  ['exercise_removed', 'Exercise removed'],
  ['exercise_prioritised', 'Exercise prioritised'],
  ['conditioning_swapped', 'Conditioning swapped'],
];

run('all twelve of Sam\'s phrases ship exactly as he wrote them', () => {
  for (const [effect, expected] of SAM_PHRASES) {
    const actual = signedCopy(`modifiers.effect.${effect}`) as unknown as string;
    assert(actual === expected,
      `the phrase for "${effect}" reads "${actual}" — Sam signed "${expected}". `
      + 'These are his words; an edit here is a rewrite of a signed sentence.');
  }
});

run('all effects including time limits are visible (R-262)', () => {
  assert(PROGRAM_HIDDEN_EFFECTS.length === 0,
    `Program hides ${JSON.stringify(PROGRAM_HIDDEN_EFFECTS)}. Sam withdrew TIME CAPS `
    + 'and nothing else; every other modifier must still be visible and counted.');
  assert(isShownOnProgram({ effect: 'session_time_limited' }),
    'an active time-cap modifier is hidden from Program despite R-262');
  for (const [effect] of SAM_PHRASES) {
    assert(isShownOnProgram({ effect }),
      `"${effect}" is hidden from Program. Sam signed a phrase for it, which is `
      + 'him asking for it to be SHOWN.');
  }
  assert(isShownOnProgram({ effect: 'unsigned' }),
    'modifiers without a signed phrase have been hidden from Program. They are '
    + 'real and active; a missing phrase is a gap in the WORDS, never a reason '
      + 'to stop telling the athlete their program changed.');
  assert(isShownOnProgram({ effect: 'readiness_noted' })
      && String(signedCopy('readiness.fatigue.noted')).startsWith('Noted'),
    'a record-only tired report is hidden or described as a program change');
});

// THE COUNT AND THE LIST ARE THE SAME ARRAY, AND THIS IS WHY IT MATTERS.
// Hiding a row while still counting it is the defect this ruling created the
// risk of: the notice would read "2 active modifiers" over a list of one.
run('the count includes every listed effect', () => {
  const notes = [
    { effect: 'volume_adjusted' as const },
    { effect: 'session_time_limited' as const },
    { effect: 'unsigned' as const },
  ];
  const shown = notes.filter(isShownOnProgram);
  assert(shown.length === 3,
    `Program would count ${shown.length} of these three. The notice counts what `
    + 'the sheet lists, so any difference is a number the athlete can see is wrong.');
});

// ── THE CORRECTION ITEM 23 WAS BUILT ON, HELD BY A CELL ──
//
// Every doc said THREE unnamed kinds. It was four, because
// `athletePreferenceModifier` is ONE builder carrying `kind: 'excluded' |
// 'pinned'` and those are OPPOSITES: excluded takes an exercise OUT, pinned
// asks for MORE of it. A single effect for both compiles, ships, and is false
// every second time it renders — and nothing else in this suite would notice,
// because both would still have a signed phrase and both would still be shown.
//
// So this cell drives the REAL builder with both preferences present and
// asserts the two outcomes differ.
run('an excluded exercise and a pinned one do not share a phrase', () => {
  // THE EXCLUDED SIDE IS A SCOPED DECISION NOW (Block Two, 2026-08-16), not a
  // bare name: `prefs.excluded` is a DERIVED projection and the builder reads
  // `prefs.exclusions`. The fixture is built the way the STORE holds it, so this
  // cell keeps driving the real builder instead of a shape nothing produces.
  // The claim itself is untouched — excluded and pinned are OPPOSITES and must
  // not share a phrase.
  const modifiers = selectActiveProgramModifiers({
    athletePrefs: {
      excluded: [],
      pinned: ['Chin-Up'],
      exclusions: [{
        exercise: 'Back Squat',
        scope: 'until_changed',
        decidedOnISO: '2026-08-16',
        activeThroughISO: null,
        blockNumber: null,
      }],
    } as never,
    todayISO: '2026-08-16',
  });
  const effects = modifiers
    .filter((m) => m.source === 'athlete_preferences')
    .map((m) => m.effect);
  assert(effects.length >= 2,
    `the pool builder produced ${effects.length} modifier(s) for one excluded and `
    + 'one pinned exercise; this cell cannot compare what it cannot reach');
  assert(new Set(effects).size === effects.length,
    `excluded and pinned both resolved to ${JSON.stringify(effects)}. They are `
    + 'OPPOSITES — one removes an exercise, the other asks for more of it — so a '
    + 'shared phrase is wrong every second time it renders. That is exactly why '
    + 'SEAT_INBOX 23 is four phrases and not three.');
  assert(effects.includes('exercise_removed') && effects.includes('exercise_prioritised'),
    `the pool effects are ${JSON.stringify(effects)}; Sam signed "Exercise removed" `
    + 'for excluded and "Exercise prioritised" for pinned');
});

console.log(`\nmodifier effect phrases: ${passed} passed, ${failed} failed`);
if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log(`  - ${f}`); }
totalsPrinted(failures.length);
process.exit(failed === 0 ? 0 : 1);
