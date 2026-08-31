/**
 * THE WEEK BOARD — Sam, 2026-08-25 (R-218).
 *
 * Pins the SHAPE rules only: how many boxes a day shows, which box a part
 * becomes, and which drops the board itself refuses. Whether the PROGRAM allows
 * a move is `planChangeProducer`'s question and is asked separately — see the
 * note on `weekBoardDropRefusal`.
 *
 * Run: npm run test:week-board
 */
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { registerProjectionCopy } from '../rules/projectionCopy';

import {
  WEEK_BOARD_MAX_BOXES,
  buildWeekBoard,
  buildWeekBoardDay,
  weekBoardEditFingerprint,
  weekBoardDropRefusal,
  weekBoardMoveScope,
  type WeekBoardBox,
} from '../rules/weekBoard';
import { signedCopy } from '../rules/signedCopy';

// Registers the ruled athlete-facing strings before the direct copy checks.
registerProjectionCopy();

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const part = (kind: string, bucket: string, headline = bucket): any => ({
  id: `${kind}-1`, kind, headline, bucket, detail: null, rows: [],
  capabilities: {}, countsTowardLoad: true,
});
const day = (date: string, parts: any[]): any => ({
  date, kind: 'training', headline: 'Day', parts, gaps: [],
});

/* ══ 1. Boxes are parts plus room ══ */
console.log('\n[1] Boxes = the day\'s parts, plus ONE empty box while there is room');
{
  const solo = buildWeekBoardDay(day('2026-08-24', [part('strength', 'Strength')]));
  ok('a day with one session shows that session and an empty box beside it',
    solo.boxes.length === 2 && solo.boxes[0].kind === 'session' && solo.boxes[1].kind === 'empty');
  ok('and it is not full', solo.isFull === false);

  const paired = buildWeekBoardDay(day('2026-08-25', [
    part('strength', 'Strength'), part('team_training', 'Team Training'),
  ]));
  ok('a strength + team training day shows exactly those two, no empty box',
    paired.boxes.length === 2
      && paired.boxes.map((b: WeekBoardBox) => b.kind).join(',') === 'session,team_training');
  ok('and it IS full', paired.isFull === true);

  /* ⚠ SAM'S OWN CORRECTION: the single box is a property of ROOM, not of rest
   * days. A rest day has no parts, so its one box IS the empty box — which is
   * why adding a session there produces "session + empty" with no rule change. */
  const rest = buildWeekBoardDay(day('2026-08-26', []));
  ok('a rest or unplanned day is ONE box, and that box is the empty one',
    rest.boxes.length === 1 && rest.boxes[0].kind === 'empty');
  ok('and dropping a session there would leave it looking like any other day',
    buildWeekBoardDay(day('2026-08-26', [part('conditioning', 'Conditioning')]))
      .boxes.map((b: WeekBoardBox) => b.kind).join(',') === 'session,empty');

  const game = buildWeekBoardDay(day('2026-08-29', [part('game', 'Game Day')]));
  ok('game day is ONE box with no empty beside it',
    game.boxes.length === 1 && game.boxes[0].kind === 'game' && game.isFull === true);
  ok('and a fixture carries no move scope — it travels through its own door',
    game.boxes[0].scope === null);

  ok('the cap Sam answered is two', WEEK_BOARD_MAX_BOXES === 2);
  ok('a whole week maps one day to one board day',
    buildWeekBoard([day('a', []), day('b', [])]).length === 2);
}

/* ══ 2. Speed is conditioning ══ */
console.log('\n[2] Speed is energy-system work, so it is a conditioning box');
{
  const speedDay = buildWeekBoardDay(day('2026-08-27', [part('speed', 'Speed')]));
  ok('a speed part is an ordinary movable session box',
    speedDay.boxes[0].kind === 'session');
  ok('and it travels under the CONDITIONING scope, the slot it occupies',
    speedDay.boxes[0].scope === 'conditioning',
    `got ${speedDay.boxes[0].scope}`);
  /* Not a load claim: SpeedBlockCountingFence keeps conditioningCredit 'none',
     and this file never reads or contradicts that. */
  const strengthDay = buildWeekBoardDay(day('2026-08-28', [part('strength', 'Strength')]));
  ok('strength still travels under its own scope', strengthDay.boxes[0].scope === 'strength');
  ok('recovery still travels under its own scope',
    buildWeekBoardDay(day('x', [part('recovery', 'Recovery')])).boxes[0].scope === 'recovery');
  ok('the club night carries NO move_session scope — it has its own typed action',
    buildWeekBoardDay(day('y', [part('team_training', 'Team Training')])).boxes[0].scope === null);

  /* ⚠ **BIN AND MOVE ARE DIFFERENT VOCABULARIES.** Sam, 2026-08-25, on seeing
   * the bin still ask "just the gym session or just team training": *"it should
   * know which one I'm trying to delete because i hit the bin icon on that
   * day"*. The box carries the answer, and for the club night that answer
   * exists on the BIN axis while the move axis has none. */
  ok('the club night DOES carry a bin scope, even with no move scope',
    buildWeekBoardDay(day('y', [part('team_training', 'Team Training')])).boxes[0].binScope
      === 'team');
  ok('a strength box bins under strength',
    buildWeekBoardDay(day('z', [part('strength', 'Strength')])).boxes[0].binScope === 'strength');
  ok('a speed box bins under conditioning, the slot it occupies',
    buildWeekBoardDay(day('z2', [part('speed', 'Speed')])).boxes[0].binScope === 'conditioning');
  ok('a fixture carries no bin scope — it clears through its own door',
    buildWeekBoardDay(day('z3', [part('game', 'Game Day')])).boxes[0].binScope === null);
  ok('an empty box has nothing to bin',
    buildWeekBoardDay(day('z4', [])).boxes[0].binScope === null);
}

/* ══ 3. A day over the cap is shown, never truncated ══ */
console.log('\n[3] Three parts is a defect to SEE, not a part to hide');
{
  const three = buildWeekBoardDay(day('2026-08-30', [
    part('strength', 'Strength'), part('conditioning', 'Conditioning'),
    part('team_training', 'Team Training'),
  ]));
  ok('every part still renders',
    three.boxes.length === 3,
    'hiding one would make a programming defect invisible on the surface built to show the week');
  ok('and the day takes no more', three.isFull === true);
}

/* ══ 4. The drops the board itself refuses ══ */
console.log('\n[4] Drop rules — the board\'s own shape, not the program\'s legality');
{
  const strengthBox: WeekBoardBox =
    { id: 's', kind: 'session', label: 'Strength', scope: 'strength', binScope: 'strength' };
  const emptyBox: WeekBoardBox =
    { id: 'e', kind: 'empty', label: null, scope: null, binScope: null };
  const teamBox: WeekBoardBox =
    { id: 't', kind: 'team_training', label: 'Team Training', scope: null, binScope: 'team' };
  const gameBox: WeekBoardBox =
    { id: 'g', kind: 'game', label: 'Game Day', scope: null, binScope: null };
  const openDay = { date: 'mon', boxes: [strengthBox, emptyBox], isFull: false };
  const fullDay = { date: 'tue', boxes: [strengthBox, teamBox], isFull: true };
  const gameDay = { date: 'sat', boxes: [gameBox], isFull: true };
  const refuse = (box: WeekBoardBox, from: any, target: WeekBoardBox, to: any) =>
    weekBoardDropRefusal({ box, from, target, to });

  ok('a strength onto a free day is allowed',
    refuse(strengthBox, fullDay, emptyBox, openDay) === null);
  ok('a strength onto another session is allowed — they swap (his answer)',
    refuse(strengthBox, openDay, strengthBox, fullDay) === null);
  ok('a strength onto a TEAM TRAINING box is refused',
    refuse(strengthBox, openDay, teamBox, fullDay) === 'onto_team_training');
  ok('nothing may be dropped onto game day',
    refuse(strengthBox, openDay, gameBox, gameDay) === 'onto_game');
  ok('a fixture can be dragged onto an empty day',
    refuse(gameBox, gameDay, emptyBox, openDay) === null);
  ok('a fixture can be dragged onto training and replaces that day',
    refuse(gameBox, gameDay, strengthBox, fullDay) === null);
  ok('a fixture can be dragged onto team training and replaces that day',
    refuse(gameBox, gameDay, teamBox, fullDay) === null);
  /* Across two days — dragging an empty box onto its OWN day would be caught by
     the same-day rule first and prove nothing about whether it can be lifted. */
  ok('an empty box is not a thing you can pick up',
    refuse(emptyBox, openDay, emptyBox, fullDay) === 'not_movable');
  ok('dropping onto the day it came from is a no-op, not a move',
    refuse(strengthBox, openDay, emptyBox, openDay) === 'same_day');

  /* ⚠ THE CAP BITES ON THE **ADD**, NOT ON THE SWAP, and that is the whole
   * reason a swap is allowed onto a full day: it conserves the count. */
  const fullWithRoomlessEmpty = { date: 'wed', boxes: [strengthBox, emptyBox], isFull: true };
  ok('a drop onto a full day\'s empty box is refused',
    refuse(strengthBox, openDay, emptyBox, fullWithRoomlessEmpty) === 'day_full');
  ok('but a SWAP onto that same full day is still allowed',
    refuse(strengthBox, openDay, strengthBox, fullWithRoomlessEmpty) === null,
    'a swap conserves the day\'s count, so the cap has nothing to refuse');
}

/* ══ 5. The drag surface ══ */

/**
 * ⚠ **R-218b — SOURCE CELLS, BECAUSE THERE IS NO RENDERER HERE.** What these
 * pin are the three things that make a drag inside a SCROLLING week work at
 * all, each of which was a real decision and not a detail.
 */
console.log('\n[5] The drag: long-press to lift, measured frames, one move door');
{
  const fs = require('fs');
  const path = require('path');
  const board = fs.readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'WeekBoard.tsx'), 'utf8');
  const home = fs.readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'), 'utf8');
  const hook = fs.readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'useHomeScreen.ts'), 'utf8');
  const sheet = fs.readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx'), 'utf8');

  ok('the pan only activates after a long press, so a flick still scrolls the week',
    /Gesture\.Pan\(\)[\s\S]{0,100}\.activateAfterLongPress\(\d+\)/.test(board),
    'a pan that claimed the touch immediately would steal every scroll past the board');

  // Sam's phone, 2026-08-26: leave the week for Day view with the board up,
  // come back — the board was still there. The board is transient week
  // detail; the shape-change owner closes it with the rest.
  ok('a Day/Week shape change closes the board',
    /const handleClearWeekPresentation = \(\) => \{[\s\S]{0,600}setWeekBoardOpen\(false\)/.test(home),
    'the board outlives the week shape it belongs to');

  ok('the frames are MEASURED by onLayout, not computed from the stylesheet',
    /const frames = React\.useRef/.test(board)
      && /event\.nativeEvent\.layout/.test(board)
      && !/height: 58[\s\S]{0,80}hitTest/.test(board),
    'a hit-test built from style constants is a second copy of the layout');

  ok('the gesture\'s box-relative point is converted into board space before hit-testing',
    /boxAt\(left \+ origin\.x \+ localX, rowTop \+ origin\.y \+ localY\)/.test(board),
    'raw x/y would match the same offset inside every row — "wrong day" that is really "wrong space"');

  /* ⚠ **THE DROP POINT IS START + TRANSLATION, AND THE FIRST BUILD SHIPPED THE
   * BUG THIS CATCHES.** Sam: *"the drag works but i cant seem to drop anything
   * anywhere"*. `onEnd`'s `event.x` is relative to a view the finger is
   * DRAGGING, so it barely changes across the whole gesture; every drop
   * hit-tested back onto its own box, resolved `same_day`, and returned
   * silently. Start offset and translation are the two numbers the transform
   * cannot corrupt. */
  ok('the drop point is the START offset plus the TRANSLATION, never onEnd\'s x/y',
    /startX\.value \+ event\.translationX/.test(board)
      && /startY\.value \+ event\.translationY/.test(board)
      && /onStart\(\(event\) => \{[\s\S]{0,400}startX\.value = event\.x/.test(board),
    'a drag that visibly works and can never land is what onEnd x/y produces');
  ok('and onEnd does not pass its own x/y through to the hit-test',
    !/runOnJS\(onDrop\)\(\s*date, box\.id, event\.x, event\.y/.test(board));

  ok('a fixture is both draggable and removable on the Week board',
    /return <GestureDetector gesture=\{pan\}>\{content\}<\/GestureDetector>/.test(board)
      && /onPress=\{\(\) => onRemove\(date, box\)\}/.test(board)
      && /moveEnabled=\{row\.date >= todayISO \|\|/.test(board)
      && /moveSource\.kind === 'game' \? box\.kind === 'game'/.test(board));

  // #14, SECOND ROUND (Sam's phone, 2026-08-26: "nope still not working
  // properly"): the immediate glide still landed the box on its OLD day
  // before the slower re-derivation moved it. The drop VERDICT decides now —
  // a dispatched move HOLDS the box at the drop point ('held'); everything
  // that ends immediately returns it by glide ('returned'); a held box whose
  // flow ended without a change glides home on settleNonce; and only a
  // cancelled gesture (no drop) returns from onFinalize.
  ok('a dispatched move HOLDS the box; only a verdict or settleNonce sends it home',
    /'held' \| 'returned'/.test(board)
      && /return 'held';/.test(board)
      && /=== 'returned'\) glideHome\(\)/.test(board)
      && /if \(!dropDecided\.value\) \{/.test(board)
      && /settleNonce !== lastSettle\.current/.test(board)
      && !/dx\.value = 0;/.test(board));
  ok('the parent ends a held box\'s flow from BOTH exits — sheet close and board refusal',
    /setChangeSheetEntry\(null\);\s*setBoardSettleNonce/.test(home)
      && /setBoardRefusal\(offered[\s\S]{0,300}setBoardSettleNonce/.test(home));

  ok('a refused drop gives a reason, one per typed refusal',
    /DROP_REFUSAL_COPY/.test(board)
      && ['not_movable', 'onto_team_training', 'onto_game', 'day_full']
        .every((code) => new RegExp(`${code}:`).test(board)),
    'a spring-back with no sentence reads as a fumbled drag');
  ok('and the screen actually shows it',
    /testID="week-board-refusal"/.test(home) && /boardRefusal/.test(home),
    'a refusal state with no reader is dead weight');

  /* ⚠ THE BOARD CHOSE THE CHANGE; IT DOES NOT DECIDE IF THE CHANGE IS ALLOWED. */
  ok('a dragged move goes through the ONE move door, not a new commit path',
    /initialAction: 'move'[\s\S]{0,200}move: \{ toDate: args\.toDate, scope \}/.test(home)
      && /if \(initialMove\) \{[\s\S]{0,600}apply\(/.test(sheet),
    'the producer still refuses an illegal move and still raises the G-1 ask');
  ok('a dragged game goes through the canonical fixture transaction owner',
    /if \(args\.box\.kind === 'game'\)[\s\S]{0,500}handleMoveGameOnBoard/.test(home)
      && /executeFixtureMutationTransaction\(/.test(hook),
    'the board must route a fixture by date, never through move_session');
  ok('a game bin uses the same canonical fixture transaction owner',
    /if \(box\.kind === 'game'\)[\s\S]{0,300}handleRemoveGameOnDate/.test(home));
  ok('the board plus offers training or a game through one add chooser',
    /function WeekBoardAddSheet/.test(home)
      && /label=\{signedCopy\('week\.board\.add\.training\.label'\)\}/.test(home)
      && /label=\{signedCopy\('week\.board\.add\.game\.label'\)\}/.test(home));

  /* ⚠ **THE BOARD ASKS THE PRODUCER WHETHER THE DESTINATION WAS EVER OFFERED.**
   * This was in the plan and was NOT built in the first drag commit, so a drag
   * could commit a move the menu it replaced would never have listed —
   * `weekBoardDropRefusal` only ever answered the board's own SHAPE rules. */
  ok('a drop the producer never offered is refused, not committed',
    /listPlanChangeOptionsForDay\(\{[\s\S]{0,160}date: args\.fromDate/.test(home)
      && /offer\?\.destinations\.find\(\(entry\) => entry\.date === args\.toDate\)/.test(home)
      && /if \(!scope \|\| !destination\) \{[\s\S]{0,420}return;/.test(home),
    'the board must ask the owner, not answer for it');
  ok('and it repeats the producer\'s own refusal rather than inventing words',
    /setBoardRefusal\(offered\?\.move\.refusal\?\.message/.test(home));
  /* ⚠ The screen must ASK `weekBoardMoveScope` rather than send the box's own
   * scope — the difference between a swap and a destroyed session. */
  ok('the screen chooses the scope from the producer\'s offer, not from the box',
    /weekBoardMoveScope\(\{[\s\S]{0,220}offeredScopeIds: offered\.move\.scopes\.map/.test(home)
      && !/const scope = args\.box\.kind === 'team_training' \? 'team' : args\.box\.scope/.test(home),
    'sending the box\'s own scope is what absorbed and destroyed the destination');
  ok('the club night drags as this-week-only, and never raises the permanent ask',
    /teamNightRoute: 'this_week_only'/.test(sheet)
      && !/teamNightRoute: 'permanent'/.test(sheet),
    'Sam, 2026-08-25: dragging it moves it for this week, no question');
  ok('and it travels by move_team_night, never by move_session',
    /initialMove\.scope === 'team'[\s\S]{0,120}kind: 'move_team_night'/.test(sheet));
}

/* ══ 5a. Finish editing explicitly ══ */

/**
 * R-245 — the transactions beneath Manage Week still save immediately, but the
 * ATHLETE finishes the editing visit explicitly. The dirty signal is derived
 * from the same board projection they are looking at, so a new add/move/remove
 * door cannot forget to set a private boolean.
 */
console.log('\n[5a] A changed Week board finishes through Save changes');
{
  const baseline = [
    buildWeekBoardDay(day('mon', [part('strength', 'Strength', 'Lower Squat')])),
    buildWeekBoardDay(day('tue', [])),
  ];
  const sameVisibleWeek = [
    buildWeekBoardDay(day('mon', [part('strength', 'Strength', 'Lower Squat')])),
    buildWeekBoardDay(day('tue', [])),
  ];
  const moved = [
    buildWeekBoardDay(day('mon', [])),
    buildWeekBoardDay(day('tue', [part('strength', 'Strength', 'Lower Squat')])),
  ];

  ok('an unchanged re-projection is not a pending edit',
    weekBoardEditFingerprint(baseline) === weekBoardEditFingerprint(sameVisibleWeek));
  ok('a visible add, move or removal changes the edit fingerprint',
    weekBoardEditFingerprint(baseline) !== weekBoardEditFingerprint(moved));

  const fs = require('fs');
  const path = require('path');
  const home = fs.readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'HomeScreenV2.tsx'), 'utf8');
  const projectionCopy = fs.readFileSync(
    path.resolve(__dirname, '..', 'rules', 'projectionCopy.ts'), 'utf8');
  const pickerStart = home.indexOf('{/* ── Picker banners ── */}');
  const refusalStart = home.indexOf('{/* ⚠ **A REFUSED DROP SAYS WHY.');
  const pickerRegion = pickerStart >= 0 && refusalStart > pickerStart
    ? home.slice(pickerStart, refusalStart)
    : '';
  const boardRegion = home.slice(
    home.indexOf('{weekBoardOpen\n              ? ('),
    home.indexOf(': weekViewDays.map', home.indexOf('{weekBoardOpen\n              ? (')),
  );
  ok('Manage Week owns an explicit Save changes action',
    home.includes("'week.board.save'")
      && home.includes('testID="week-board-save"')
      && signedCopy('week.board.save') === 'Save changes');
  ok('Save appears only after the visible board differs from its opening state',
    /const weekBoardSaveVisible = weekBoardOpen[\s\S]{0,100}weekBoardHasChanges \|\| weekBoardFinishState === 'confirmed'/.test(home)
      && /\{weekBoardSaveVisible \? \(/.test(home)
      && /weekBoardEditFingerprint\(weekBoardRows\.map\(\(row\) => row\.board\)\)/.test(home));
  ok('saving briefly confirms, then returns to the ordinary Week view',
    home.includes("'week.board.saved'")
      && signedCopy('week.board.saved') === 'Changes saved'
      && /setWeekBoardFinishState\('confirmed'\)[\s\S]{0,1000}setWeekBoardOpen\(false\)/.test(home));
  ok('the picker-banner region is found before its contents are checked',
    pickerStart >= 0 && refusalStart > pickerStart && pickerRegion.length > 100);
  ok('the Week editor has no redundant Sessions / games heading',
    !home.includes("signedCopy('week.board.banner')")
      && !projectionCopy.includes("id: 'week.board.banner'")
      && !pickerRegion.includes('weekBoardOpen'),
    'the heading was still mounted and registered as signed product copy');
  ok('an unchanged board can leave through the existing Day / Week shape control',
    /if \(weekBoardOpen && weekBoardHasChanges\) return;/.test(home),
    'removing the banner must not remove the only way out of an unchanged editor');
  ok('a changed board still cannot silently leave without Save changes',
    /if \(weekBoardOpen && weekBoardHasChanges\) return;/.test(home)
      && /const weekBoardSaveVisible = weekBoardOpen[\s\S]{0,100}weekBoardHasChanges \|\| weekBoardFinishState === 'confirmed'/.test(home)
      && /\{weekBoardSaveVisible \? \(/.test(home));
  ok('the real game move and add modes keep their instructional banners',
    /mode\.type === 'moveGame'[\s\S]{0,140}<MoveBanner text="Tap the day to move the game to"/.test(pickerRegion)
      && /mode\.type === 'addGame'[\s\S]{0,220}<MoveBanner/.test(pickerRegion));
}

/* ══ 6. The scope a dragged box travels under ══ */

/**
 * ⚠ **THE BUG SAM HIT, PINNED.** *"pulling a strength day to a strength day just
 * disappeared the session that was originally there = it didnt swap them"*.
 *
 * The board sent the box's own `'strength'` scope. A day whose only content is a
 * gym session does not OFFER that scope — `moveOptionsForDay` gives it
 * `['whole_day']`, because *"moving 'just the gym session' off a day that is
 * only a gym session IS the whole-day move"*. A scoped move the producer never
 * offered does not swap: the scoped path ABSORBS, overwrites the destination
 * and returns nothing to the source.
 */
console.log('\n[6] A dragged box speaks the producer\'s scope vocabulary');
{
  const strengthBox: WeekBoardBox =
    { id: 's', kind: 'session', label: 'Strength', scope: 'strength', binScope: 'strength' };
  const condBox: WeekBoardBox =
    { id: 'c', kind: 'session', label: 'Conditioning', scope: 'conditioning', binScope: 'conditioning' };
  const emptyBox: WeekBoardBox =
    { id: 'e', kind: 'empty', label: null, scope: null, binScope: null };
  const teamBox: WeekBoardBox =
    { id: 't', kind: 'team_training', label: 'Team Training', scope: null, binScope: 'team' };

  const soloDay = { date: 'mon', boxes: [strengthBox, emptyBox], isFull: false };
  const combinedDay = { date: 'tue', boxes: [strengthBox, condBox], isFull: true };
  const teamDay = { date: 'wed', boxes: [strengthBox, teamBox], isFull: true };

  ok('THE DEFECT: a solo strength day offers only whole_day, and that is what travels',
    weekBoardMoveScope({ box: strengthBox, day: soloDay, offeredScopeIds: ['whole_day'] })
      === 'whole_day',
    'sending the unoffered "strength" scope here is what absorbed and destroyed the destination');

  ok('a combined day DOES offer the component scope, so the box travels as itself',
    weekBoardMoveScope({
      box: strengthBox, day: combinedDay,
      offeredScopeIds: ['whole_day', 'strength', 'conditioning'],
    }) === 'strength');

  /* ⚠ THE FALLBACK IS BOUNDED, AND THIS IS THE CELL THAT KEEPS IT SO. Falling
   * back to whole_day whenever the component scope is missing would let a drag
   * of ONE part of a combined day take the entire day — the team night with it.
   * That is the same defect one step to the left. */
  ok('a part of a COMBINED day never falls back to moving the whole day',
    weekBoardMoveScope({
      box: strengthBox, day: combinedDay, offeredScopeIds: ['whole_day'],
    }) === null,
    'the athlete dragged one box, not the day');
  ok('and a day holding a team night never falls back to whole_day either',
    weekBoardMoveScope({
      box: strengthBox, day: teamDay, offeredScopeIds: ['whole_day'],
    }) === null,
    'the club night would have travelled with it');

  ok('the club night itself travels under the team scope',
    weekBoardMoveScope({ box: teamBox, day: teamDay, offeredScopeIds: ['strength', 'team'] })
      === 'team');
  ok('and is refused when that scope is not offered',
    weekBoardMoveScope({ box: teamBox, day: teamDay, offeredScopeIds: ['strength'] }) === null);
  ok('an empty box has no scope to travel under',
    weekBoardMoveScope({ box: emptyBox, day: soloDay, offeredScopeIds: ['whole_day'] }) === null);
  ok('an offer of nothing moves nothing',
    weekBoardMoveScope({ box: strengthBox, day: soloDay, offeredScopeIds: [] }) === null);
}

/* ══ 7. The box names the session, not the category ══ */

/**
 * ⚠ **R-222 (Sam, 2026-08-25): *"we need a bit more details on the strength
 * session and the conditioning sessions — otherwise it's too hard to know what
 * days you're swapping ... if all 3 are strength but they're really lowers,
 * upper push, upper pull, then it's too hard to know what you're changing"*.**
 *
 * Every box read `Strength`, so a week of three different sessions looked like
 * three identical ones and the athlete dragged blind.
 */
console.log('\n[7] A box names its session, so two of them can be told apart');
{
  const lower = buildWeekBoardDay(day('mon', [part('strength', 'Strength', 'Lower Squat')]));
  const push = buildWeekBoardDay(day('tue', [part('strength', 'Strength', 'Upper Push')]));
  ok('a strength box shows the session, not the category',
    lower.boxes[0].label === 'Lower Squat', `got "${lower.boxes[0].label}"`);
  ok('so two strength days no longer read identically',
    lower.boxes[0].label !== push.boxes[0].label);
  ok('conditioning names itself too',
    buildWeekBoardDay(day('wed', [part('conditioning', 'Conditioning', 'Tempo Intervals')]))
      .boxes[0].label === 'Tempo Intervals');
  /* The bucket is the FALLBACK, not the choice: a part with no specific name
     still labels its box rather than rendering blank. */
  ok('a part with no specific name falls back to its category word',
    buildWeekBoardDay(day('thu', [{ ...part('recovery', 'Recovery'), headline: null }]))
      .boxes[0].label === 'Recovery');
  ok('and the club night still reads as itself',
    buildWeekBoardDay(day('fri', [part('team_training', 'Team Training')]))
      .boxes[0].label === 'Team Training');
}

/* ══ 8. The name the board shows has to EXIST ══ */

/**
 * ⚠ **R-224 — 42 OF 42 SESSIONS WERE CALLED "Strength", AND §7 ABOVE COULD NOT
 * SEE IT.** Sam, 2026-08-25, after §7 landed: *"this still just says strength"*.
 *
 * §7 proves the board reads `headline` rather than `bucket`. It says nothing
 * about whether `headline` ever HOLDS a specific name — its fixtures supply one.
 * Measured over `generateProgramLocally` for all three season phases: **every
 * session carrying exercises resolved to "Session"**, missed the strength label
 * map, and fell through to the generic word.
 *
 * **THE CAUSE WAS TWO OWNERS OF ONE QUESTION DISAGREEING.**
 * `classifyGenerationSession` falls back from an empty `effectivePatterns` to
 * `plannedPatterns`; `resolveSessionDisplayName` did not, and the quieter one
 * won on every athlete-facing surface. This cell is on the NAMER, because that
 * is where the disagreement was — a cell on the board would have gone green
 * against a fixture while the app said "Strength" to Sam.
 *
 * ⚠ **THIS RUNS HERE BECAUSE `test:session-naming` DIES AT IMPORT** — it has
 * done at HEAD since before this work, throwing `B1-PIVOT` before a single cell
 * runs. Putting the rule in a suite that reports nothing would be writing it
 * into the dark. Move it back when that suite is alive.
 */
console.log('\n[8] A typed plan names its session, even with no delivery record');
{
  const { resolveSessionDisplayName } = require('../utils/sessionNaming');
  const name = (intent: any) => resolveSessionDisplayName({
    strengthIntent: intent, exercises: [{ name: 'Barbell Row' }],
    isTeamDay: false, tier: 'core',
  }).trim();

  ok('CONTROL — a delivered pattern names the session, as it always did',
    name({ archetype: 'upper', primaryPattern: 'pull',
      plannedPatterns: ['pull'], effectivePatterns: ['pull'] }) === 'Upper Pull');

  /* THE DEFECT: the generator writes exactly this — a planned pattern with no
     delivery record — on the majority of real sessions. */
  ok('an EMPTY delivery record falls back to the plan, and the session is named',
    name({ archetype: 'upper', primaryPattern: 'pull',
      plannedPatterns: ['pull'], effectivePatterns: [] }) === 'Upper Pull',
    'this returned "Session" and every surface then printed "Strength"');
  ok('and the same holds for a push day',
    name({ archetype: 'upper', primaryPattern: 'push',
      plannedPatterns: ['push'], effectivePatterns: [] }) === 'Upper Push');
  ok('and for a squat day',
    name({ archetype: 'lower', primaryPattern: 'squat',
      plannedPatterns: ['squat'], effectivePatterns: [] }) === 'Lower Squat');

  /* ⚠ THE FALLBACK IS TO THE TYPED PLAN, NOT TO PROSE. `focus` and `name` stay
     unread — that pass-through leaked planner text onto an athlete's screen
     once (surfaceAgreementTests cell 3) and stays shut. */
  ok('a session with NO typed plan is still not named from its raw text',
    name(undefined) !== 'Lower Hinge' && name(undefined) !== 'Upper Pull',
    'inferring a name from planner prose is a different defect, still closed');
}

/* ══ 9. A composer-owned day keeps its own plan ══ */

/**
 * ⚠ **SAM, 2026-08-25: *"why the fuck would monday be different"* — R-225.**
 *
 * It was not Monday, it was WHICH BUILDER made the day. A club night is retained
 * from the adapter and carries its typed plan. A pure strength day is
 * COMPOSER-owned, and `assembleAuthoredWeek` makes the composer's workout the
 * merge BASE, so the adapter's copy never lands on it. The composer read
 * `planned.strengthIntent` to decide the entire session and then did not carry
 * it out — so every composer day in the app reached the athlete as "Strength",
 * while the two club nights named themselves.
 *
 * **THE CELL IS ON THE MERGE, NOT ON THE NAME.** The name was the symptom; any
 * reader of a composed day's typed identity had the same hole. `strengthIntent`
 * is already an adapter-contributable field, which is exactly why this looked
 * fine on a club night and failed everywhere else.
 *
 * ⚠ **IT RUNS HERE BECAUSE `test:generated-week-assembly` DIES AT IMPORT** — at
 * HEAD, before this work, on a `composeWeek` call with incomplete inputs. It is
 * the THIRD suite found dead today (`athlete-session-move`, `session-naming`,
 * this one). A rule filed in a suite that reports nothing is filed in the dark.
 */
console.log('\n[9] The composer carries the plan it composed from');
{
  const { assembleAuthoredWeek } = require('../rules/assembleAuthoredWeek');
  const workoutish = (over: any = {}) => ({
    id: 'w', microcycleId: 'mc', dayOfWeek: 2, name: 'Lower Body Strength',
    description: '', durationMinutes: 0, intensity: 'High',
    workoutType: 'Strength', exercises: [], ...over,
  });
  const lower = {
    archetype: 'lower', primaryPattern: 'squat',
    plannedPatterns: ['squat', 'hinge'], effectivePatterns: ['squat', 'hinge'],
  };

  const composed = assembleAuthoredWeek({
    composerWorkouts: [workoutish({ strengthIntent: lower })],
    adapterWorkouts: [workoutish({ id: 'a', name: 'Conditioning' })],
  }).workouts.find((w: any) => w.dayOfWeek === 2);
  ok('a composer-owned day keeps its own typed plan through the merge',
    !!composed?.strengthIntent && composed.strengthIntent.primaryPattern === 'squat',
    'without it every reader falls back to the generic word');

  /* THE CLUB-NIGHT CASE — the one that always worked, and must keep working. */
  const fromAdapter = assembleAuthoredWeek({
    composerWorkouts: [workoutish()],
    adapterWorkouts: [workoutish({
      id: 'a', name: 'Team Training',
      strengthIntent: { archetype: 'upper', primaryPattern: 'pull',
        plannedPatterns: ['pull'], effectivePatterns: ['pull'] },
    })],
  }).workouts.find((w: any) => w.dayOfWeek === 2);
  ok('and the adapter still supplies the plan where the composer has none',
    fromAdapter?.strengthIntent?.primaryPattern === 'pull');

  /* THE CARRY IS AT THE SOURCE TOO: the materialiser must put the composed
     day's plan onto the workout, or the merge above has nothing to keep. */
  const fs = require('fs');
  const path = require('path');
  const materialiser = fs.readFileSync(
    path.resolve(__dirname, '..', 'rules', 'materialiseComposedWeek.ts'), 'utf8');
  ok('the materialiser carries the composed day\'s plan onto the workout',
    /strengthIntent: day\.strengthIntent/.test(materialiser));
  const composer = fs.readFileSync(
    path.resolve(__dirname, '..', 'rules', 'composeWeek.ts'), 'utf8');
  ok('and the composed day carries it from the planned day, never recomputed',
    /strengthIntent: planned\.strengthIntent/.test(composer)
      && /readonly strengthIntent: StrengthIntent;/.test(composer));
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}
