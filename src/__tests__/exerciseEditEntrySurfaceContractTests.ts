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
  /* ⚠ **RULING 12's THREE HEADER ICONS ARE GONE, AND SO IS THE CELL THAT
   * PROTECTED THEM (2026-08-19).**
   *
   * Sam replaced them: *"Remove the three unlabelled icons from the sticky
   * header ... Build one 'Need to make a change?' section: Equipment · Injury ·
   * Add · Remove · Swap."* Three unlabelled glyphs at the top became five
   * labelled actions in one place, so a cell demanding the three testIDs was
   * protecting the surface the ruling deleted.
   *
   * **IT IS REPLACED, NOT DROPPED.** The thing worth guarding is unchanged in
   * spirit — the athlete must have a labelled way in — so the cell now asserts
   * the SHARED hub is mounted with the five, which is the surface that carries
   * that duty now. */
  ok(
    'the labelled five-action hub is the entry surface',
    /<SessionChangeHub/.test(source)
      && /id: 'equipment' as const/.test(source)
      && /id: 'injury' as const/.test(source)
      && /id: 'add' as const/.test(source)
      && /id: 'remove' as const/.test(source)
      && /id: 'swap' as const/.test(source),
    'the three unlabelled header icons are replaced by five labelled actions '
      + 'in one hub — see `test:session-change-hub` for the parity contract',
  );
  ok(
    'the top icon row keeps the retired link\'s exact gate',
    /date && !isTeamOnly && editableExercises\.length > 0/.test(source),
    'team-only days and days with no editable exercises must still see no '
      + 'entry surface at all — the same condition the retired link used',
  );
  /* ⚠ **THE PER-ROW SWAP/REMOVE PAIR IS GONE, AND ITS TWO CELLS WITH IT.**
   *
   * Sam: *"Remove always-visible row Swap/Remove icons."* Two unlabelled icons
   * on every row of every session competed with the exercise name and the load,
   * and the hub replaced them with one labelled place. Cells demanding
   * `ExerciseRowActions` on three row shapes were guarding exactly what the
   * ruling removed.
   *
   * **REPLACED BY THE OPPOSITE CLAIM**, because a deleted surface still needs
   * watching (`gate-must-watch-the-deleted-surface`): the pair must NOT come
   * back, and its plumbing must not linger passed to children that ignore it —
   * which is what this cleanup removed. */
  ok(
    'the per-row swap/remove pair has not come back',
    !/function ExerciseRowActions/.test(source)
      && !/accessibilityLabel="Swap exercise"/.test(source)
      && !/accessibilityLabel="Remove exercise"/.test(source),
    'the labelled hub is the only way in; a row-level pair is the surface the '
      + 'ruling deleted',
  );
  ok(
    'and its plumbing is deleted, not left threaded through the rows',
    !/onSwapExercise/.test(source) && !/onRemoveExercise/.test(source)
      && !/swapTestID/.test(source) && !/removeTestID/.test(source)
      && !/function SwapIcon/.test(source) && !/function RemoveIcon/.test(source),
    'props passed to children that no longer read them are how a deleted '
      + 'surface quietly grows back',
  );
  ok(
    'ExerciseHeaderRow no longer carries swap/remove openers at all',
    !/onSwap\?: \(\) => void;/.test(source) && !/onRemove\?: \(\) => void;/.test(source),
    /* ⚠ THE FOURTH CELL OF THE SAME KIND (2026-08-19). Ruling 12 split one
     * `onChange` into two per-row openers; the hub then deleted both. This cell
     * asserted the SPLIT, so it was guarding the deleted pair just as the three
     * above were, and it is inverted for the same reason: the row must stay
     * clean, and the plumbing must not be threaded back through it. */
    'the per-row pair is deleted — the labelled hub is the only way in, and a '
      + 'row that still accepts openers is one prop away from drawing them',
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
  // The later session-equipment ruling replaces prepareConcern's one-row flow
  // with one whole-session owner. Every OTHER owner stays pinned, and that is
  // the point of editing the list rather than the loop.
  // ── `prepareAdd` LEAVES THIS LIST — SAM, 2026-08-19 ────────────────────
  //
  // *"Add any legal exercise, mobility or conditioning component. Respect
  // equipment, injury and genuine session limits. Own load authority."*
  //
  // `prepareAdd` read a HAND-WRITTEN table of twelve names, two per "kind", and
  // offered whichever one the session did not already contain. It asked nothing
  // about the athlete's kit and nothing about their injuries, so it cannot
  // satisfy the ruling by being kept — it is a flow that was CUT, exactly as
  // `prepareConcern` was, not an entry surface that moved.
  //
  // WHICH SIDE MOVED: the RULING, with a date. The replacement owners are
  // `openExerciseAdd`, `openAddFamily`, `openAddGroup` and `openAddLeaf` over
  // `utils/addExerciseCandidates.legalAddFamilies` / `legalAddCandidates`, and
  // they are pinned below in its place — a deletion that leaves nothing pinned
  // is how a flow quietly stops existing.
  //
  // ⚠ **THE FLAT MENU'S SINGLE OWNER IS GONE (Sam, 2026-08-20).** It owned ONE
  // level over the generation vocabulary's own 23 groups. Sam's hierarchy is
  // Strength / Conditioning / Mobility-Warm-up, then a heading, then — under
  // Lower body and Upper body ONLY — one more question, then the choices. All
  // four owners are pinned here by name. Re-pointing rather than deleting the
  // row is the rule: a gate that stops watching a surface because the surface
  // was renamed is a gate that has quietly stopped watching.
  //
  // ⚠ **THE TWO INJURY OWNERS WERE RE-POINTED ON 2026-08-20, BY THE SAME RULE
  // THIS COMMENT STATES.** Sam: *"Ask for the injured body area or movement
  // once. Find every affected exercise in the session … Show one review of all
  // proposed changes. Apply the approved changes together."*
  //
  //   `openExerciseInjuryFlow`   -> `openSessionInjuryFlow`
  //       It took an `EditableExercise`, because Injury used to make the athlete
  //       pick a row first. There is no row to take now — the door opens from
  //       the hub and the app finds every affected exercise itself.
  //   `applyExerciseGuidedInjury` -> `reviewSessionInjury` + `applySessionInjuryReview`
  //       It WROTE on completion and then offered a single-row swap afterwards.
  //       The ruling splits that in two: propose, then apply on approval. Both
  //       halves are pinned, because a review with no apply and an apply with no
  //       review are each half a flow.
  //
  // The row is RE-POINTED, never dropped. A gate that stops watching a surface
  // because the surface was renamed is a gate that has quietly stopped watching
  // — which is the rule the paragraph above already states, applied to itself.
  const flowOwners = [
    'prepareSwap', 'openExerciseAdd', 'openAddFamily', 'openAddGroup', 'openAddLeaf',
    'openSessionInjuryFlow',
    'reviewSessionInjury', 'applySessionInjuryReview', 'applySwapToday',
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
  // `add_kind` is DELETED with `prepareAdd` (Sam, 2026-08-19 — see [3]); the two
  // steps that replace it are named here so the deletion cannot take the whole
  // Add flow's coverage with it.
  // `swap_reason` is DELETED (Sam, 2026-08-19): *"Delete the entire 'Why do you
  // want to swap it?' step. Swap means only: I want a different exercise."* Its
  // replacement is no step at all — the pick lands straight on `choose_swap`,
  // which is asserted below and guarded as a ROUTE in [4b].
  // The ONE flat add level is deleted in its turn (Sam, 2026-08-20). Its FOUR
  // replacements are named here for the same reason `add_kind`'s were — and
  // `add_leaf` is named even though it is reached from only two headings,
  // because a step nothing pins is a step that can quietly stop existing.
  const survivingSteps = [
    'pick_exercise', 'confirm_remove', 'confirm_swap',
    'choose_swap', 'add_family', 'add_group', 'add_leaf', 'add_pick',
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

console.log('\n[4b] Swap is ONE question: which exercise?');
{
  /* ⚠ **THE REASON STEP IS GONE AND MUST NOT COME BACK.**
   *
   * Sam, 2026-08-19: *"Delete the entire 'Why do you want to swap it?' step.
   * Swap means only: I want a different exercise. Equipment and Injury already
   * have separate actions, so do not ask about either inside Swap. Too
   * hard/easy also does not belong here."*
   *
   * Deleting a screen is easy to half-do: the step can go while its vocabulary,
   * its icon table and its router case linger, and the next reader wires them
   * back. Each of these names one of those leftovers. */
  ok(
    "the 'swap_reason' step kind is gone entirely",
    !/'swap_reason'/.test(source),
    'the step, its title, its subtitle and its render case must all go — a '
      + 'surviving case is a screen one setter away from returning',
  );
  ok(
    'the six swap reasons are gone',
    !/const SWAP_REASONS/.test(source) && !/'Too hard'/.test(source)
      && !/'Too easy'/.test(source) && !/"Don't like it"/.test(source),
    'the reason vocabulary has no reader left once the step is deleted. The '
      + 'DECLARATION is what must go — the tombstone comment naming it is the '
      + 'record of the deletion and tripped the first version of this cell',
  );
  ok(
    'the swap-reason icon table is gone',
    !/const SWAP_REASON_ICON/.test(source),
    'six icons for six labels that no longer exist',
  );
  ok(
    'picking a row for SWAP goes straight to the ranked menu',
    /action === 'swap'\) onSwapPick\(exercise\)/.test(source),
    'the picker must call the swap preparer directly — anything else is a '
      + 'second question in front of the answer',
  );
  /**
   * ⚠ **INVERTED 2026-08-20, NOT DELETED — AND THE REPLACEMENT IS STRICTER.**
   *
   * This cell used to require that picking a row could route to Injury
   * (`action === 'injury') onInjuryStart(exercise)`). Sam's ruling deletes that
   * route outright: *"Ask for the injured body area or movement ONCE. Find EVERY
   * affected exercise in the session."* Asking "which exercise?" first made the
   * athlete do the finding, and then only ever fixed the row they named.
   *
   * So the assertion now pins the OPPOSITE, and pins more than it used to. The
   * old cell only checked that a route existed; this one checks that the wrong
   * route CANNOT exist — `ExercisePickAction` no longer has an `'injury'` member
   * to route on — while still holding the half of the original that Sam has not
   * moved: Equipment and Injury remain their own separate doors, neither folded
   * into the other and neither folded into Swap or Remove.
   */
  ok(
    'Equipment and Injury still have their own doors, and Injury asks for no row',
    /openSessionEquipment/.test(source)
      && /openSessionInjuryFlow/.test(source)
      && /type ExercisePickAction = 'swap' \| 'remove';/.test(source)
      && !/action === 'injury'/.test(source)
      && !/onInjuryStart/.test(source),
    'Sam 2026-08-19: *"do not disturb the separate Equipment or Injury flows"*, '
      + 'and Sam 2026-08-20: *"ask for the injured body area or movement ONCE"* — '
      + 'Injury keeps its own door and that door must not open a row picker',
  );
  /**
   * AND THE DOOR IT OPENS INSTEAD IS THE REVIEW. A flow that asks once but then
   * writes without showing anything would satisfy the cell above and still miss
   * the ruling, so the review step is pinned by name here.
   */
  ok(
    'the Injury door leads to ONE review of ALL proposed changes',
    /kind: 'injury_review'/.test(source)
      && /case 'injury_review':/.test(source)
      && /onApplyInjuryReview\(step\)/.test(source),
    'Sam 2026-08-20: *"Show one review of all proposed changes. Apply the '
      + 'approved changes together."* — one step, one apply, no per-row approve',
  );
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
    'the retired single-exercise equipment picker is gone',
    !/const prepareConcern = React\.useCallback/.test(source)
      && !/onConcern\(exercise, 'No equipment'\)/.test(source)
      && /<SessionEquipmentSheet/.test(source),
    'the equipment icon now reviews the requirements for the whole opened '
      + 'session, so its old single-row concern callback must not survive as a '
      + 'second temporary-equipment path',
  );
}

console.log(`\nExercise-edit entry-surface totals: passed=${passed}/${passed + failures.length} failures=${failures.length}`);
totalsPrinted(failures.length);
if (failures.length > 0) {
  console.error(`Failing: ${failures.join(', ')}`);
  process.exit(1);
}
