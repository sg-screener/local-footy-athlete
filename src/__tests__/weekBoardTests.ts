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

import {
  WEEK_BOARD_MAX_BOXES,
  buildWeekBoard,
  buildWeekBoardDay,
  weekBoardDropRefusal,
  weekBoardMoveScope,
  type WeekBoardBox,
} from '../rules/weekBoard';

let passed = 0;
const failures: string[] = [];
function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) { passed += 1; console.log(`  PASS ${name}`); return; }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

const part = (kind: string, bucket: string): any => ({
  id: `${kind}-1`, kind, headline: bucket, bucket, detail: null, rows: [],
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
  ok('a fixture cannot be dragged from the board',
    refuse(gameBox, gameDay, emptyBox, openDay) === 'not_movable');
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
  const sheet = fs.readFileSync(
    path.resolve(__dirname, '..', 'screens', 'home', 'PlanChangeSheet.tsx'), 'utf8');

  ok('the pan only activates after a long press, so a flick still scrolls the week',
    /Gesture\.Pan\(\)\s*\n?\s*\.activateAfterLongPress\(\d+\)/.test(board),
    'a pan that claimed the touch immediately would steal every scroll past the board');

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

  ok('a fixture is neither dragged nor binned',
    /const draggable = box\.kind !== 'game'/.test(board)
      && /const removable = box\.kind !== 'game'/.test(board));

  ok('the box always springs home — the program re-renders the result, not the finger',
    /onFinalize\(\(\) => \{[\s\S]{0,220}dx\.value = 0;[\s\S]{0,60}dy\.value = 0;/.test(board));

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

  /* ⚠ **THE BOARD ASKS THE PRODUCER WHETHER THE DESTINATION WAS EVER OFFERED.**
   * This was in the plan and was NOT built in the first drag commit, so a drag
   * could commit a move the menu it replaced would never have listed —
   * `weekBoardDropRefusal` only ever answered the board's own SHAPE rules. */
  ok('a drop the producer never offered is refused, not committed',
    /listPlanChangeOptionsForDay\(\{[\s\S]{0,160}date: args\.fromDate/.test(home)
      && /offer\?\.destinations\.find\(\(entry\) => entry\.date === args\.toDate\)/.test(home)
      && /if \(!scope \|\| !destination\) \{[\s\S]{0,220}return;/.test(home),
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

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`- ${failure}`);
  process.exit(1);
}
