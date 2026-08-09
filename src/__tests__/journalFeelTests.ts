(global as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  },
};

/**
 * THE FEEL SLICE — the post-game body-feel rating and the "felt different" tap.
 *
 * VERIFICATION STRATEGY (L12). Two inputs on an EXISTING door, so the defect
 * classes are not "the number is wrong" — they are about questions and answers
 * getting out of step with each other:
 *
 *   - AN ANSWER CAN OUTLIVE ITS QUESTION. The app must never hold a rating for a
 *     question it did not put on the screen. [3] and [5] assert the ask-flag and
 *     the send-flag are the SAME flag, on a game and on a non-game — the cell
 *     that would catch the next `teamNightSize`-shaped leak.
 *   - A PAIR CAN HALF-ANSWER. "It was harder than expected" with no why is a
 *     question opened and left open, and the form will not ask again. [4]
 *     asserts the draft is refused rather than the reason silently dropped.
 *   - TWO QUESTIONS CAN COLLAPSE INTO ONE. `feeling` answers how HARD it was;
 *     the tap answers whether it MATCHED THE PLAN. [8] asserts they are
 *     independent — a `very_hard` session that was exactly as expected is a
 *     state the model must be able to represent, and one field could not.
 *   - A PREDICATE CAN GROW A FIFTH COPY. "Is this a game" already has four
 *     spellings and no owner. [6] sweeps the panel's source and requires it asks
 *     `classifyDaySessions` — the cell that would catch the next
 *     `one-predicate-grows-copies-in-other-modules`.
 *
 * Run: npm run test:journal-feel
 */

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import {
  FEEDBACK_EXPECTATIONS,
  FEEDBACK_EXPECTATION_REASONS,
  FEEDBACK_GAME_FEELS,
  expectationAsksWhy,
  parseFeedbackExpectation,
  parseFeedbackExpectationReason,
  parseFeedbackGameFeel,
} from '../types/sessionOutcome';
import {
  EXPECTATION_OPTIONS,
  EXPECTATION_REASON_OPTIONS,
  GAME_FEEL_OPTIONS,
  buildSessionFeedbackPayload,
  canSaveFeedbackDraft,
  getVisibleFeedbackSections,
} from '../utils/sessionFeedbackForm';
import { buildJournalWeek, type JournalSessionOutcome } from '../rules/journalWeek';
import type { VisibleDay, VisiblePart } from '../rules/visibleProjection';
import type { WeeklyExposureCounts } from '../rules/weeklyExposureCounts';
import { readFileSync } from 'fs';
import { join } from 'path';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

const sectionIds = (
  completion: 'full' | 'partial' | 'skipped' | null,
  options: Parameters<typeof getVisibleFeedbackSections>[1] = {},
): string[] => getVisibleFeedbackSections(completion, options).map((s) => s.id);

const baseDraft = {
  dateStr: '2026-08-11',
  completion: 'full' as const,
  feeling: 'good' as const,
  soreness: 'mild' as const,
  partialReason: null,
  skipReason: null,
};

// ─── [1] The vocabularies, as ruled ──────────────────────────────────────

console.log('\n[1] THE VOCABULARIES — the design\'s own words, as values');
{
  ok('the tap has the addendum\'s four answers, in its order',
    FEEDBACK_EXPECTATIONS.join(',')
      === 'as_expected,harder_than_expected,easier_than_expected,stopped_early',
    FEEDBACK_EXPECTATIONS);

  ok('the why has the addendum\'s seven reasons',
    FEEDBACK_EXPECTATION_REASONS.length === 7
    && ['soreness', 'energy', 'sleep', 'time', 'pain', 'equipment', 'motivation']
      .every((r) => (FEEDBACK_EXPECTATION_REASONS as readonly string[]).includes(r)),
    FEEDBACK_EXPECTATION_REASONS);

  ok('the body-feel rating is the design\'s 1-5, and nothing else',
    FEEDBACK_GAME_FEELS.join(',') === '1,2,3,4,5', FEEDBACK_GAME_FEELS);

  // EVERY VALUE THE ATHLETE CAN TAP HAS A WORD. A key with no label is a chip
  // that renders blank, which no type catches.
  ok('every expectation has a label', EXPECTATION_OPTIONS.length === FEEDBACK_EXPECTATIONS.length
    && EXPECTATION_OPTIONS.every((o) => o.label.trim().length > 0));
  ok('every reason has a label',
    EXPECTATION_REASON_OPTIONS.length === FEEDBACK_EXPECTATION_REASONS.length
    && EXPECTATION_REASON_OPTIONS.every((o) => o.label.trim().length > 0));
  ok('every body-feel tap has a WORD, not a bare number',
    GAME_FEEL_OPTIONS.length === 5
    && GAME_FEEL_OPTIONS.every((o) => o.label.trim().length > 0 && !/^\d+$/.test(o.label)),
    GAME_FEEL_OPTIONS.map((o) => o.label));

  // THE RATING IS A NUMBER, so its parse is not the string one copied.
  ok('a stored string rating is REFUSED, not coerced',
    parseFeedbackGameFeel('3') === null && parseFeedbackGameFeel(3) === 3);
  ok('an off-scale or fractional rating is refused',
    parseFeedbackGameFeel(0) === null && parseFeedbackGameFeel(6) === null
    && parseFeedbackGameFeel(2.5) === null);
  ok('an unknown expectation or reason is refused',
    parseFeedbackExpectation('felt_weird') === null
    && parseFeedbackExpectationReason('vibes') === null);
}

// ─── [2] One predicate, three readers ────────────────────────────────────

console.log('\n[2] `expectationAsksWhy` — ONE predicate, and three readers of it');
{
  ok('"as expected" asks nothing', expectationAsksWhy('as_expected') === false);
  ok('the other three all ask why',
    expectationAsksWhy('harder_than_expected')
    && expectationAsksWhy('easier_than_expected')
    && expectationAsksWhy('stopped_early'));
  ok('an unanswered tap asks nothing — absence is not a differing answer',
    expectationAsksWhy(null) === false && expectationAsksWhy(undefined) === false);

  // THE THREE READERS MUST READ THE SAME FUNCTION. A copy of `!== 'as_expected'`
  // in any of them is how the form starts asking a question the payload then
  // throws away, or the Journal counts a week the form never flagged.
  for (const [label, file] of [
    ['the form', join(__dirname, '..', 'utils', 'sessionFeedbackForm.ts')],
    ['the Journal', join(__dirname, '..', 'rules', 'journalWeek.ts')],
    ['the panel', join(__dirname, '..', 'components', 'SessionFeedbackPanel.tsx')],
  ] as const) {
    const source = readFileSync(file, 'utf8');
    ok(`${label} source was read`, source.length > 1000, source.length);
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    ok(`${label} asks the predicate rather than re-spelling it`,
      /\bexpectationAsksWhy\s*\(/.test(code)
      && !/!==\s*'as_expected'/.test(code),
      code.match(/!==\s*'as_expected'/g));
  }
}

// ─── [3] The form asks the right questions ───────────────────────────────

console.log('\n[3] WHICH QUESTIONS GET ASKED');
{
  ok('a non-game performed session is NOT asked for a body-feel rating',
    !sectionIds('full').includes('gameFeel'), sectionIds('full'));
  ok('a GAME is', sectionIds('full', { isGameDay: true }).includes('gameFeel'));

  // EFFORT ON A STRENGTH SESSION IS THIS TAP, per Sam's "one tap, no per-set
  // anything" — so the tap must appear on an ordinary performed session, which
  // is the only place a strength effort could ever be recorded today.
  ok('every performed session is offered the tap — this is effort-on-strength',
    sectionIds('full').includes('expectation')
    && sectionIds('partial').includes('expectation'));

  ok('a SKIPPED session is asked none of it — there is nothing to compare',
    !sectionIds('skipped').includes('expectation')
    && !sectionIds('skipped', { isGameDay: true }).includes('gameFeel'),
    sectionIds('skipped', { isGameDay: true }));

  ok('the why is not asked until the athlete says it differed',
    !sectionIds('full', { expectation: 'as_expected' }).includes('expectationReason')
    && !sectionIds('full').includes('expectationReason'));
  ok('and it IS asked once they do — and it is REQUIRED',
    sectionIds('full', { expectation: 'harder_than_expected' }).includes('expectationReason')
    && getVisibleFeedbackSections('full', { expectation: 'stopped_early' })
      .find((s) => s.id === 'expectationReason')?.required === true);

  // THE TAP IS OPTIONAL AND THAT IS A RULING, not an oversight: it is a new
  // question on a flow athletes already use, and requiring it would change what
  // an existing save costs them.
  ok('the tap itself is optional',
    getVisibleFeedbackSections('full').find((s) => s.id === 'expectation')?.required === false);
}

// ─── [4] A half-answered pair is refused at the draft ────────────────────

console.log('\n[4] THE SAVE GATE — a question opened and left open');
{
  ok('a complete draft with no tap at all still saves',
    canSaveFeedbackDraft({ ...baseDraft }) === true);
  ok('"as expected" needs no why',
    canSaveFeedbackDraft({ ...baseDraft, expectation: 'as_expected' }) === true);
  ok('"harder than expected" with NO why is REFUSED, not silently dropped',
    canSaveFeedbackDraft({ ...baseDraft, expectation: 'harder_than_expected' }) === false);
  ok('and it saves once the why is answered',
    canSaveFeedbackDraft({
      ...baseDraft, expectation: 'harder_than_expected', expectationReason: 'sleep',
    }) === true);
}

// ─── [5] The answer cannot outlive its question ──────────────────────────

console.log('\n[5] THE PAYLOAD — ask-flag and send-flag are the SAME flag');
{
  const onAGame = buildSessionFeedbackPayload({ ...baseDraft, gameFeel: 4 });
  ok('a rating the form asked for is stored', onAGame?.gameFeel === 4, onAGame);

  // THE TEAM-NIGHT LAW, APPLIED. The caller passes null unless the question was
  // put, so a non-game cannot carry a body-feel rating — the app never holds an
  // answer to a question it did not ask.
  const notAGame = buildSessionFeedbackPayload({ ...baseDraft, gameFeel: null });
  ok('a session that was never asked carries NO rating',
    notAGame !== null && !('gameFeel' in notAGame), notAGame);

  const differed = buildSessionFeedbackPayload({
    ...baseDraft, expectation: 'easier_than_expected', expectationReason: 'energy',
  });
  ok('a differing tap stores both halves',
    differed?.expectation === 'easier_than_expected'
    && differed?.expectationReason === 'energy');

  // TAPPING BACK MUST NOT LEAVE THE REASON BEHIND. "As expected because of
  // soreness" is an answer to a question that is no longer being asked.
  const tappedBack = buildSessionFeedbackPayload({
    ...baseDraft, expectation: 'as_expected', expectationReason: 'soreness',
  });
  ok('tapping back to "as expected" drops the stale why',
    tappedBack?.expectation === 'as_expected'
    && !('expectationReason' in (tappedBack ?? {})), tappedBack);

  const noTap = buildSessionFeedbackPayload({ ...baseDraft });
  ok('an unanswered tap stores NOTHING — absence, never a default',
    noTap !== null && !('expectation' in noTap) && !('expectationReason' in noTap), noTap);

  // A SKIPPED SESSION HAS NOTHING TO COMPARE, and the form does not ask — so
  // even a draft carrying answers must not smuggle them onto the receipt.
  const skipped = buildSessionFeedbackPayload({
    dateStr: '2026-08-11',
    completion: 'skipped',
    feeling: null,
    soreness: null,
    partialReason: null,
    skipReason: 'busy_no_time',
    gameFeel: 5,
    expectation: 'stopped_early',
    expectationReason: 'time',
  });
  ok('a skipped session carries neither answer',
    skipped !== null && !('gameFeel' in skipped) && !('expectation' in skipped), skipped);
}

// ─── [6] The panel asks the predicate's owner ────────────────────────────

console.log('\n[6] OWNERSHIP — no fifth spelling of "is this a game"');
{
  const panel = readFileSync(
    join(__dirname, '..', 'components', 'SessionFeedbackPanel.tsx'), 'utf8');
  ok('the panel source was read', panel.length > 4000, panel.length);
  const code = panel.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  ok('it asks `classifyDaySessions`, the owner', /\bclassifyDaySessions\s*\(/.test(code));
  // THE FIFTH SPELLING IS WHAT THIS CELL EXISTS TO FORBID. Four already exist
  // elsewhere and are named as census debt; a new one here would be the shape
  // this repo has already paid for.
  ok('and it does not roll its own workoutType check',
    !/workoutType\s*===\s*'Game'/.test(code) && !/\/\^game/.test(code),
    code.match(/workoutType\s*===\s*'Game'/g));
  ok('the team-night predicate is still asked of ITS owner too',
    /\bisTeamTrainingSession\s*\(/.test(code));

  // THE PANEL'S OWN GUARDS, AND THEY WERE UNASSERTED UNTIL A MUTATION SAID SO.
  //
  // Section [5] above proves the PAYLOAD BUILDER stores only what it is handed —
  // but every one of its cells hands the builder `null` itself. Nothing checked
  // that the panel decides to hand it null, so removing both guards left the
  // whole suite green while a non-game happily stored a body-feel rating. That
  // is the ask-flag/send-flag claim failing at the exact seam it is about.
  //
  // No cell in this repo mounts the panel, so the honest instrument is its
  // source — anchored to the payload call first, because a regex that finds
  // nothing passes every "does not contain" test ever written.
  const payloadStart = code.indexOf('buildSessionFeedbackPayload({');
  const payloadEnd = code.indexOf('});', payloadStart);
  ok('the panel\'s payload call was located',
    payloadStart > 0 && payloadEnd > payloadStart, { payloadStart, payloadEnd });
  const payloadCall = code.slice(payloadStart, payloadEnd);
  ok('and the located call is substantial, not an empty slice',
    payloadCall.length > 200, payloadCall.length);

  ok('the panel sends a body-feel rating ONLY when it asked for one',
    /gameFeel:\s*isGameDay\s*\?\s*gameFeel\s*:\s*null/.test(payloadCall), payloadCall);
  ok('and it sends a why ONLY while the tap is still asking for one',
    /expectationReason:\s*expectationAsksWhy\(expectation\)\s*\?\s*expectationReason\s*:\s*null/
      .test(payloadCall), payloadCall);
  ok('the team-night answer keeps the same guard it always had',
    /teamNightSize:\s*isTeamNight\s*\?\s*teamNightSize\s*:\s*null/.test(payloadCall));
}

// ─── [7] The Journal counts them, and interprets nothing ─────────────────

console.log('\n[7] THE JOURNAL — counted, never interpreted');
{
  const part: VisiblePart = {
    id: 'p', kind: 'strength',
    headline: 'Strength' as VisiblePart['headline'],
    bucket: 'Strength' as VisiblePart['bucket'],
    detail: null, rows: [],
    capabilities: { canSwap: false, canMove: false, canRemove: false, canEditRows: false },
    countsTowardLoad: true,
  };
  const day = (date: string, kind: VisibleDay['kind']): VisibleDay => ({
    date, kind,
    headline: 'Day' as VisibleDay['headline'],
    parts: [part],
    capabilities: { canAdd: false, canMoveWholeDay: false, canRemoveWholeDay: false, refusal: null },
    owner: 'plan',
  });
  const exposures: WeeklyExposureCounts = {
    hardExposures: 0, hardDays: 0, mainStrengthExposures: 0, conditioningExposures: 0,
    extraConditioningSessions: 0, runningExposures: 0, sprintCodExposures: 0,
    gunshowSessions: 0, recoverySessions: 0, teamTrainingSessions: 0, games: 0,
    byCategory: {},
    days: ['2026-08-10', '2026-08-11'].map((date) => ({
      date, workoutName: null, workoutNames: [], units: [], isHardDay: false,
    })),
  };
  const outcome = (over: Partial<JournalSessionOutcome>): JournalSessionOutcome => ({
    completion: 'full', reason: null, feeling: null, soreness: null,
    gameFeel: null, expectation: null, ...over,
  });

  const week = buildJournalWeek({
    weekStart: '2026-08-10',
    days: [day('2026-08-10', 'game'), day('2026-08-11', 'training')],
    exposures,
    outcomesByDate: {
      '2026-08-10': outcome({ gameFeel: 2 }),
      '2026-08-11': outcome({ expectation: 'harder_than_expected' }),
    },
    weeksOfHistory: 1,
  });

  ok('a rated game is counted', week.felt.gameFeelsRecorded === 1, week.felt);
  ok('a session that differed is counted', week.felt.differedFromPlan === 1, week.felt);

  // THE HONEST-ABSENCE LINE HAD TO LEARN THE NEW FACTS. A week where the athlete
  // rated a game and nothing else used to render "you haven't recorded how
  // anything felt" beside the rating they had just given.
  ok('and "nothing recorded" is FALSE once either new answer exists',
    week.felt.nothingRecorded === false, week.felt);

  const silent = buildJournalWeek({
    weekStart: '2026-08-10',
    days: [day('2026-08-10', 'game')],
    exposures,
    outcomesByDate: { '2026-08-10': outcome({ expectation: 'as_expected' }) },
    weeksOfHistory: 1,
  });
  ok('"as expected" is not counted as a session that differed',
    silent.felt.differedFromPlan === 0 && silent.felt.nothingRecorded === true, silent.felt);

  // ── THE RATING ITSELF, not the count of ratings — the UI slice's tile ──
  //
  // A COUNT AND A RATING ARE DIFFERENT FACTS. `gameFeelsRecorded` says how many
  // games were rated; the ruling's glanceable shows what the athlete actually
  // said. The value was stored per session from the feel slice onward and simply
  // never aggregated — so this is a read, not a new field.
  ok('the week carries the rating, not only the count',
    week.felt.gameFeelLatest === 2, week.felt);
  ok('and a week with no rated game carries null rather than a zero',
    silent.felt.gameFeelLatest === null, silent.felt);

  // IT IS THE LATEST, NEVER A MEAN, AND THIS IS THE CELL THAT HOLDS IT. Two
  // games rated 2 and 5 average to 3.5 — a number no game earned, shown to the
  // athlete as though one had. A mean would pass every cell above.
  const twoGames = buildJournalWeek({
    weekStart: '2026-08-10',
    days: [day('2026-08-10', 'game'), day('2026-08-11', 'game')],
    exposures,
    outcomesByDate: {
      '2026-08-10': outcome({ gameFeel: 2 }),
      '2026-08-11': outcome({ gameFeel: 5 }),
    },
    weeksOfHistory: 1,
  });
  ok('two rated games report the LATEST, never a mean',
    twoGames.felt.gameFeelLatest === 5 && twoGames.felt.gameFeelsRecorded === 2,
    twoGames.felt);

  const screen = readFileSync(
    join(__dirname, '..', 'screens', 'journal', 'JournalScreen.tsx'), 'utf8');
  ok('the screen source was read', screen.length > 4000, screen.length);
  for (const testId of ['journal-felt-game', 'journal-felt-differed']) {
    ok(`the screen renders \`${testId}\``, new RegExp(`testID="${testId}"`).test(screen));
  }
}

// ─── [8] The two questions stay two questions ────────────────────────────

console.log('\n[8] `feeling` IS NOT THE TAP, and the model must show it');
{
  // THE STATE THAT ONE FIELD COULD NOT REPRESENT: a session that was brutally
  // hard AND exactly what the plan asked for. If these two ever collapse, this
  // is the cell that fails — and it fails on a real athlete's ordinary Tuesday.
  const payload = buildSessionFeedbackPayload({
    ...baseDraft, feeling: 'very_hard', expectation: 'as_expected',
  });
  ok('a very_hard session can be exactly as expected',
    payload?.feeling === 'very_hard' && payload?.expectation === 'as_expected', payload);

  const easyButHarder = buildSessionFeedbackPayload({
    ...baseDraft, feeling: 'easy', expectation: 'harder_than_expected',
    expectationReason: 'sleep',
  });
  ok('and an easy session can still have been harder than planned',
    easyButHarder?.feeling === 'easy'
    && easyButHarder?.expectation === 'harder_than_expected', easyButHarder);

  // NO SHARED VOCABULARY EITHER. Reusing the partial-reason list would make
  // "harder than expected because too_hard_today" expressible, which answers
  // nothing.
  ok('the why vocabulary is its own, not the partial-reason list',
    !(FEEDBACK_EXPECTATION_REASONS as readonly string[]).includes('too_hard_today')
    && !(FEEDBACK_EXPECTATION_REASONS as readonly string[]).includes('ran_out_of_time'));
}

console.log(`\njournalFeelTests: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  DEPTH (L13): 0 — a unit sweep over the form owner, the payload builder and '
  + 'the pure Journal derivation. It does NOT tap a real panel, and no cell here mounts '
  + 'a surface.');
console.log('  NOT COVERED: nothing asserts what the athlete SEES on a device — chip '
  + 'wrapping, the length of the seven reason chips on a phone, and whether the tap reads '
  + 'as one more thing to do are unverified by eye. The post-game rating is RECORDED and '
  + 'COUNTED only: it feeds no observation line yet, because those belong to the monthly '
  + 'review slice. `test:session-feedback-form` remains UNGATED with 4 pre-existing '
  + 'failures about a power component `getSessionComponents` no longer emits — measured, '
  + 'reported, and not absorbed by this slice.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
