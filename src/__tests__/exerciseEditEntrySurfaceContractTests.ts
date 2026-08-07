/**
 * SESSION-DETAIL INLINE EDITING — source-level contracts (ruling 12).
 *
 * Sam's design ruling 12 (`docs/HOME_SCREEN_REDESIGN_RULINGS_2026-07-30.md`):
 * the "Edit exercises" modal MENU on `DayWorkoutScreenV2` retires. Per-exercise-
 * row swap + remove buttons replace the "Change" pill; a top-of-page icon row
 * (add / equipment / injury) replaces the single sticky-header link. The
 * ruling's explicit boundary: "Existing guided flows behind these buttons are
 * unchanged; only the entry surface changes."
 *
 * RETIREMENT PASS (review finding, Sam ruling): `concern_reason`, `injury_area`
 * and `injury_severity` had zero forward setters even before this file
 * existed — only circular `goBack` references pointing at each other. Sam
 * ruled the equipment icon goes straight to the swap suggestion ("The tapped
 * icon states the reason; no intermediate menu"), which was already this
 * screen's behaviour (option (a)) — and that `concern_reason` may retire with
 * the other two unreachable steps. All three are now deleted (union, render
 * switch, titles/subtitles, goBack targets), not merely left dead — this
 * suite's job is to make sure that stays true, the same way it already pins
 * `menu`/`exercise_menu`'s absence.
 *
 * This suite pins BOTH halves of ruling 12's boundary as source contracts —
 * the same style as `keyboardConventionContractTests` (the repository ships
 * no native component renderer, so these read the file rather than mount it):
 *
 *   1. The retired entry surface is actually gone (no `menu`/`exercise_menu`
 *      step, no "Edit exercises" link, no "Change" pill, and — the
 *      retirement pass — no `concern_reason`/`injury_area`/`injury_severity`
 *      step either).
 *   2. The new entry surface exists (three top-icon testIDs; swap+remove
 *      testIDs on every editable-row shape).
 *   3. Every guided-flow callback the ruling named as unchanged still exists,
 *      by name, in the file — so a future rewrite of the entry surface cannot
 *      quietly rewrite the flows behind it too without this suite noticing.
 *      `prepareInjurySwap` is NOT in this list: it was `injury_severity`'s
 *      only caller, so retiring the step orphaned it — it is deleted, not
 *      "unchanged" (see [5]).
 *   4. Every step the guided flows depend on still exists as a case in the
 *      step machine.
 *   5. The orphaned callback is actually gone, not left as dead code the
 *      retired steps leave behind.
 *
 * Run: npm run test:exercise-edit-entry-surface
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();
import fs from 'fs';
import path from 'path';

const SCREEN = path.resolve(__dirname, '..', 'screens', 'home', 'DayWorkoutScreenV2.tsx');
const source = fs.readFileSync(SCREEN, 'utf8');

const TEST_ID_AUTHORITY = path.resolve(__dirname, '..', 'utils', 'stableTestId.ts');
const testIdSource = fs.readFileSync(TEST_ID_AUTHORITY, 'utf8');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

console.log('\n[1] The retired entry surface is gone');
{
  ok(
    'ExerciseEditStep has no `menu` step',
    !/\{\s*kind:\s*'menu'\s*\}/.test(source),
    'ruling 12 retires the modal MENU step entirely — a lingering `menu` step '
      + 'kind means the old two-tap entry can still be reached',
  );
  ok(
    'ExerciseEditStep has no `exercise_menu` step',
    !/'exercise_menu'/.test(source),
    'ruling 12 retires the per-exercise exercise_menu step — its five rows '
      + '(Swap/Remove/Something hurts/No equipment/Too hard-too easy) are now '
      + 'direct entries, not a sheet in front of a sheet',
  );
  ok(
    'the sticky-header "Edit exercises" link is gone',
    !source.includes('day-workout-make-change-link') && !/>Edit exercises</.test(source),
    'the single link this ruling replaces with the three-icon row must not '
      + 'still render alongside it',
  );
  ok(
    'the per-row "Change" pill is gone',
    !/function ExerciseChangeAction/.test(source) && !/exerciseChangeText/.test(source),
    'the pill that opened exercise_menu is replaced by two row buttons, not '
      + 'kept as a third way into the same retired menu',
  );
  ok(
    'ExerciseEditStep has no `concern_reason` step',
    !/'concern_reason'/.test(source),
    'Sam ruled the equipment icon goes straight to the swap suggestion — '
      + 'concern_reason (the "what needs changing?" menu it used to route '
      + 'through) has no live setter left and is retired, not left dead',
  );
  ok(
    'ExerciseEditStep has no `injury_area` step',
    !/'injury_area'/.test(source),
    'injury_area had zero forward setters before this pass (only a circular '
      + 'goBack target) — retired alongside concern_reason and injury_severity',
  );
  ok(
    'ExerciseEditStep has no `injury_severity` step',
    !/'injury_severity'/.test(source),
    'injury_severity had zero forward setters before this pass (only a '
      + 'circular goBack target) — retired alongside the other two',
  );
}

console.log('\n[2] The new entry surface exists');
{
  ok(
    'the top-of-page icon row has all three testIDs',
    source.includes('"day-workout-add-exercise-action"')
      && source.includes('"day-workout-equipment-concern-action"')
      && source.includes('"day-workout-injury-concern-action"'),
    'ruling 12 names three doors from the top of the page: add, equipment, injury',
  );
  ok(
    'the top icon row keeps the retired link\'s exact gate',
    /date && !isTeamOnly && editableExercises\.length > 0/.test(source),
    'team-only days and days with no editable exercises must still see no '
      + 'entry surface at all — the same condition the retired link used',
  );
  ok(
    'a shared row-actions component renders both a swap and a remove control',
    /function ExerciseRowActions/.test(source)
      && /accessibilityLabel="Swap exercise"/.test(source)
      && /accessibilityLabel="Remove exercise"/.test(source),
    'one row shape, two buttons — swap and remove must both exist as named '
      + 'affordances, not merged back into a single "Change" action',
  );
  ok(
    'every editable-row shape mounts the row-actions component',
    (source.match(/<ExerciseRowActions\b/g) ?? []).length >= 3,
    'strength rows (via ExerciseHeaderRow), conditioning-phase rows and '
      + 'combined-day conditioning rows each used to mount `ExerciseChangeAction` '
      + 'independently — the replacement must reach all of them, not just one',
  );
  ok(
    'ExerciseHeaderRow (strength + recovery rows) takes swap/remove, not one onChange',
    /onSwap\?: \(\) => void;/.test(source) && /onRemove\?: \(\) => void;/.test(source),
    'the single onChange callback that opened exercise_menu must be split into '
      + 'two independent openers',
  );
  ok(
    'row swap/remove testIDs are built from the same identity authority as delete',
    /componentSwapIngress:/.test(testIdSource)
      && source.includes('explorerTestId.componentSwapIngress(')
      && source.includes('explorerTestId.componentDeleteIngress('),
    'row identities are canonical domain identities, constructed only in '
      + '`stableTestId.ts` (the file\'s own rule: "Explorer selectors are '
      + 'projections of canonical domain identities. Keep their construction '
      + 'here") — matches componentDeleteIngress\'s own pattern, not a '
      + 'hand-rolled string in the screen',
  );
}

console.log('\n[3] The guided flows behind the buttons are UNCHANGED (ruling 12\'s boundary)');
{
  // `askCoachForTeamTraining` WAS PINNED HERE AND IS NOW REMOVED — R5.7, the
  // beta coach cut (§6, decision C(a), signed; Sam's "MAKE THE CUT",
  // 2026-08-07). Ruling 12's boundary was "existing guided flows behind these
  // buttons are unchanged; only the entry surface changes", and on that ground
  // this owner had to survive. The LATER ruling removes every path to a chat
  // surface, so the flow it owned no longer has a destination — it is not an
  // entry surface that moved, it is a flow that was cut.
  //
  // WHICH SIDE MOVED: the RULING, with a date. The code did not drift out from
  // under a standing expectation, which is the test `expectation-edited-to-
  // match-the-regression` demands before an assertion may be edited.
  //
  // Every OTHER owner stays pinned, and that is the point of editing the list
  // rather than the loop: ruling 12's boundary still holds for the nine flows
  // the beta cut does not touch.
  const flowOwners = [
    'prepareSwap', 'prepareAdd', 'prepareConcern', 'openExerciseInjuryFlow',
    'applyExerciseGuidedInjury', 'applySwapToday',
    'applyAddToday', 'saveFutureExerciseAdjustment', 'removeExerciseToday',
    'suggestTapSwap',
  ];
  for (const owner of flowOwners) {
    ok(
      `${owner} still owns its guided step (entry surface changed, not the flow)`,
      new RegExp(`const ${owner} = React\\.useCallback`).test(source),
      `ruling 12: "Existing guided flows behind these buttons are unchanged; `
        + `only the entry surface changes" — ${owner} must still be the one `
        + 'function that runs this flow',
    );
  }
}

console.log('\n[4] Every step the guided flows land on still exists');
{
  const survivingSteps = [
    'pick_exercise', 'swap_reason', 'add_kind', 'confirm_remove', 'confirm_swap',
    'confirm_add', 'future_scope', 'coach_fallback', 'result',
  ];
  for (const step of survivingSteps) {
    ok(
      `'${step}' step still exists`,
      new RegExp(`case '${step}':`).test(source),
      `the brief names '${step}' as a step that survives the menu's deletion `
        + 'as a guided flow behind the new direct entries',
    );
  }
}

console.log('\n[5] The orphaned callback is deleted, not left as dead code');
{
  // `prepareInjurySwap` was `injury_severity`'s only caller (via
  // `onInjurySeverity`). Retiring the step orphaned it — ruling 12 says
  // flows behind the entries are unchanged, and a flow with no entry is not
  // behind anything.
  ok(
    'prepareInjurySwap is gone',
    !/prepareInjurySwap/.test(source),
    'injury_severity was its only caller; retiring the step with the '
      + 'callback still defined would be new dead code, not a retirement',
  );
  ok(
    'onInjurySeverity is gone from the sheet\'s prop contract',
    !/onInjurySeverity/.test(source),
    'the prop existed only to carry prepareInjurySwap into the deleted '
      + 'injury_severity render',
  );
  ok(
    'the injury-area/severity picker constants are gone',
    !/INJURY_AREAS/.test(source) && !/INJURY_SEVERITIES/.test(source),
    'these arrays only ever fed the injury_area/injury_severity render lists',
  );
  ok(
    'prepareConcern is NOT deleted — it is still reached from the equipment icon',
    /const prepareConcern = React\.useCallback/.test(source)
      && /onConcern\(exercise, 'No equipment'\)/.test(source),
    'unlike prepareInjurySwap, prepareConcern gained a new caller (the '
      + 'equipment icon\'s pick_exercise collapse) rather than losing its '
      + 'last one — it must stay, byte-identical, not be treated as orphaned',
  );
}

console.log(`\nExercise-edit entry-surface totals: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
