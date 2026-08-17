/**
 * BLOCK TWO — THE LADDER'S THIRD RUNG, ON GLASS.
 *
 * Subject: the approved contract's *"Add another session only when phase,
 * schedule and gym availability permit it, and after athlete confirmation"*, and
 * the order's verbatim sentence and two buttons.
 *
 *   1. the offer is raised only for a block that was completed, recovered from
 *      and reported CONSISTENTLY EASY, after the two smaller rungs were spent;
 *   2. it is raised only when generation has already BUILT the larger week;
 *   3. nothing is added until a button is tapped;
 *   4. accepting writes exactly one more session, through the existing door;
 *   5. declining changes nothing and is not asked again in the same block;
 *   6. both answers survive a relaunch.
 *
 * ⚠ **THE CARD IS CALLED, NOT READ.** Same construction as
 * `blockTwoScreenDeliveryTests`: the real component, the real element tree, the
 * node's own `onPress`. The programme is a real `generateProgramLocally` world
 * and the history is harvested from the block the generator produced.
 *
 * Run: npm run test:block-two-extra-session
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

const durable = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => durable.get(key) ?? null,
    setItem: (key: string, value: string) => { durable.set(key, value); },
    removeItem: (key: string) => { durable.delete(key); },
    clear: () => durable.clear(),
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED');
};

/** The host-component stub — see `blockTwoScreenDeliveryTests` for why. */
const reactNativeStub: Record<string, unknown> = new Proxy({
  StyleSheet: { create: (sheet: unknown) => sheet, flatten: (style: unknown) => style },
  Platform: { OS: 'ios', select: (map: Record<string, unknown>) => map.ios ?? map.default },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
}, {
  get: (target, property: string) => (property in target ? target[property] : property),
  has: () => true,
});
require.cache[require.resolve('react-native')] = {
  id: 'react-native', filename: 'react-native', loaded: true, exports: reactNativeStub,
} as unknown as NodeModule;

import { generateProgramLocally } from '../services/api/generateProgram';
/* ⚠ Blocks the athlete ACCEPTED go through the canonical door, which records
 * what they selected. Speculative calls stay on `generateProgramLocally` and
 * record nothing — the two are different names on purpose. */
import { acceptBlock, resetBlockSelectionHistory } from './support/acceptBlock';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
import { deriveBlockBoundaryPrompts } from '../screens/home/useBlockBoundaryPrompts';
import { ExtraSessionOfferCard } from '../screens/home/BlockBoundaryCards';
import { declineWeeklyCommitment } from '../store/weeklyCommitmentAnswer';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import {
  availableTrainingDays,
  decideExtraSessionOffer,
  EXTRA_SESSION_STEP,
} from '../rules/extraSessionOffer';
import { commitmentPatchFor } from '../rules/weeklyCommitmentQuestion';
import { commitmentLegalityProbe } from '../rules/weeklyCommitmentLegality';
import {
  countMainSecondarySets,
  readBlockHistory,
} from '../rules/blockBoundaryProgression';
import type { DecisionLedgerEntry } from '../types/decisionLedger';
import type { SessionFeedback } from '../store/programStore';
import type { DayOfWeek, OnboardingData, TrainingProgram } from '../types/domain';

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) { pass++; console.log(`  PASS ${name}`); }
  else {
    fail++; failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ── The element walker — same construction as the screen-delivery suite ── */
interface Elementish { props?: Record<string, unknown> }
function walk(node: unknown, visit: (element: Elementish) => void): void {
  if (node === null || node === undefined || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) walk(child, visit); return; }
  const element = node as Elementish;
  if (element.props) { visit(element); walk(element.props.children, visit); }
}
function nodeWithTestID(tree: unknown, testID: string): Elementish | null {
  let found: Elementish | null = null;
  walk(tree, (element) => {
    if (found) return;
    if (element.props?.testID === testID) found = element;
  });
  return found;
}
function textOf(node: Elementish | null): string {
  if (!node) return '';
  const parts: string[] = [];
  const collect = (value: unknown): void => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string' || typeof value === 'number') {
      parts.push(String(value)); return;
    }
    if (Array.isArray(value)) { for (const item of value) collect(item); return; }
    const element = value as Elementish;
    if (element.props) collect(element.props.children);
  };
  collect(node.props?.children);
  return parts.join('');
}
/**
 * The label a chip carries.
 *
 * ⚠ **`ChoiceChip` IS AN ELEMENT, NOT A RENDERED TREE.** Calling the card
 * returns `<ChoiceChip label=... />` — the chip's own function has not run, so
 * its `accessibilityLabel` does not exist yet and the words are on `label`.
 * Reading `accessibilityLabel` here returned `''` for both buttons and the cell
 * passed nothing while looking like it passed the words.
 */
function labelOf(tree: unknown, testID: string): string {
  const props = nodeWithTestID(tree, testID)?.props;
  const label = props?.label ?? props?.accessibilityLabel;
  return typeof label === 'string' ? label : '';
}
function tap(tree: unknown, testID: string): boolean {
  const onPress = nodeWithTestID(tree, testID)?.props?.onPress;
  if (typeof onPress !== 'function') return false;
  (onPress as () => void)();
  return true;
}

/* ── Sam's words, PINNED as literals ──────────────────────────────────────
 *
 * Not imported from the registry entry: a cell that reads its expectation out
 * of the value under test cannot fail (`docs/STATUS_BLOCKTWO.md`, finding 2).
 * These are the words the order gives verbatim.
 */
const APPROVED_OFFER_SENTENCE =
  'You’ve been completing your training consistently and recovering well. '
  + 'Your schedule allows another session. Would you like to add one session '
  + 'each week?';
const APPROVED_ACCEPT_LABEL = 'Add one session';
const APPROVED_DECLINE_LABEL = 'Keep my current schedule';

const WEEK_ORDER: readonly DayOfWeek[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];
const BLOCK_1_START = '2026-07-06';
const BLOCK_2_START = '2026-08-03';
const BLOCK_1_DATES = [
  '2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
  '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31',
];

/**
 * ⚠ **ONE TEAM NIGHT, AND THAT IS A MEASURED CHOICE, NOT A CONVENIENCE.**
 *
 * The growing week has to be one generation actually BUILDS, and it is not
 * legal for every athlete. Measured at `3b5b59d0` across 27 worlds (3 phases ×
 * {2,3,4} gym days × {0,1,2} team nights), `n → n+1` is legal in **11**:
 *
 *   - **every world with NO team night refuses** — the week loses the exposures
 *     the club night was carrying and cannot satisfy §18 at the larger count;
 *   - **off-season refuses above two gym days** — WC-122, no fifth strength
 *     session, and the off-season ceiling is lower;
 *   - pre-season and in-season with a club night grow cleanly.
 *
 * This athlete — pre-season, three gym days, one team night — is one of the
 * eleven. The refusing worlds are guarded too, three cells down.
 */
function athlete(over: Partial<OnboardingData> = {}): OnboardingData {
  return {
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 1,
    teamTrainingDays: ['Tuesday'],
    equipmentAnswer: fullKitEquipmentAnswer(),
    injuries: [], goals: ['Get stronger'], experienceLevel: 'Intermediate',
    sprintExposure: 'Occasionally', conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight', weightKg: 85,
    ...over,
  } as unknown as OnboardingData;
}

function build(
  sessionFeedback: Record<string, SessionFeedback>,
  profile: OnboardingData = athlete(),
): TrainingProgram {
  return acceptBlock(profile, {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    progressionHistory: { sessionFeedback, weightOverrides: {}, blockState: null },
  });
}

/** The history is the block the generator actually produced; only the ANSWERS vary. */
function logRealBlock(
  program: TrainingProgram,
  answers: Partial<SessionFeedback>,
): Record<string, SessionFeedback> {
  const sessions: SessionFeedback['strength'][] = [];
  for (const microcycle of program.microcycles) {
    for (const workout of microcycle.workouts) {
      const rows = (workout.exercises ?? [])
        .filter((row) => row.role !== 'conditioning' && (row.exercise?.name ?? '') !== '')
        .map((row) => ({
          exerciseId: row.exerciseId,
          workoutExerciseId: row.id,
          exerciseName: row.exercise?.name ?? '',
          prescribedSets: row.prescribedSets,
          prescribedRepsMin: row.prescribedRepsMin,
          prescribedRepsMax: row.prescribedRepsMax,
          weightKg: row.prescribedWeightKg ?? null,
          completion: 'full' as const,
        }));
      if (rows.length > 0) sessions.push(rows);
    }
  }
  const feedback: Record<string, SessionFeedback> = {};
  BLOCK_1_DATES.forEach((dateStr, index) => {
    feedback[dateStr] = {
      dateStr,
      completion: 'full',
      strength: sessions[index % Math.max(1, sessions.length)] ?? [],
      ...answers,
    } as SessionFeedback;
  });
  return feedback;
}

function promptsFor(args: {
  program: TrainingProgram;
  feedback: Record<string, SessionFeedback>;
  profile?: OnboardingData;
  ledgerEntries?: readonly DecisionLedgerEntry[];
}) {
  return deriveBlockBoundaryPrompts({
    currentProgram: args.program,
    blockNumber: 2,
    blockStartISO: BLOCK_2_START,
    sessionFeedback: args.feedback,
    onboardingData: args.profile ?? athlete(),
    ledgerEntries: args.ledgerEntries ?? [],
    weekOrder: WEEK_ORDER,
  });
}

const block1 = acceptBlock(athlete(), { todayISO: BLOCK_1_START, blockNumber: 1 });
/** Everything consistently easy — the contract's third case. */
const EASY = logRealBlock(block1, { feeling: 'easy', soreness: 'none' });
/** Completed and recovered well, but not EASY. Load and a set; no session. */
const GOOD_NOT_EASY = logRealBlock(block1, { feeling: 'good', soreness: 'mild' });
/** Completed, and brutal. */
const VERY_HARD = logRealBlock(block1, { feeling: 'very_hard', soreness: 'high' });

const easyProgram = build(EASY);
const goodProgram = build(GOOD_NOT_EASY);
const hardProgram = build(VERY_HARD);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[0] LIVENESS — the world the offer is asked in really exists');

const easyHistory = readBlockHistory({
  feedbackByDate: EASY,
  blockStartISO: BLOCK_1_START,
  blockEndISO: '2026-08-02',
  requiredStrengthSessions: 12,
});
ok(
  'the easy block QUALIFIES and reads as consistently easy',
  easyHistory.qualifies && easyHistory.byQuality.strengthEasy,
  `qualifies=${easyHistory.qualifies} strengthEasy=${easyHistory.byQuality.strengthEasy}`,
);
const available = availableTrainingDays({ profile: athlete(), weekOrder: WEEK_ORDER });
ok(
  'the athlete really has a free day to put a session on',
  available.length > 0,
  `available=${available.join(',')} — Mon/Wed/Fri training, Tue/Thu team`,
);
ok(
  'and the LARGER week is one generation actually builds',
  commitmentLegalityProbe({
    profile: athlete(), blockStartISO: BLOCK_2_START, blockNumber: 2,
    weekOrder: WEEK_ORDER, availableDays: available,
  })(4),
  'a four-day pre-season week refused — the offer would have nothing legal to make',
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[1] THE OFFER — raised only on a consistently easy block');

const easyPrompts = promptsFor({ program: easyProgram, feedback: EASY });
ok(
  'a consistently easy block RAISES the offer',
  easyPrompts.extraSession !== null,
);
ok(
  'and it offers exactly ONE more session',
  easyPrompts.extraSession?.offer.offeredSessionsPerWeek === 4
    && easyPrompts.extraSession?.offer.currentSessionsPerWeek === 3
    && EXTRA_SESSION_STEP === 1,
  JSON.stringify(easyPrompts.extraSession?.offer),
);
ok(
  'the offered day set keeps every day the athlete already chose',
  ['Monday', 'Wednesday', 'Friday'].every((day) =>
    (easyPrompts.extraSession?.offer.trainingDays ?? []).includes(day as DayOfWeek)),
  `offered ${easyPrompts.extraSession?.offer.trainingDays.join(',')}`,
);
ok(
  'and adds exactly one day the athlete had free',
  easyPrompts.extraSession?.offer.trainingDays.length === 4
    && (easyPrompts.extraSession?.offer.trainingDays ?? [])
      .filter((day) => available.includes(day)).length === 1,
  `offered ${easyPrompts.extraSession?.offer.trainingDays.join(',')}`,
);

ok(
  'a GOOD but not easy block gets NO offer — good buys load and a set, not a day',
  promptsFor({ program: goodProgram, feedback: GOOD_NOT_EASY }).extraSession === null,
);
ok(
  'a VERY HARD block gets NO offer',
  promptsFor({ program: hardProgram, feedback: VERY_HARD }).extraSession === null,
);
ok(
  'a SILENT block gets NO offer — silence is not ease',
  promptsFor({
    program: easyProgram,
    feedback: logRealBlock(block1, { feeling: undefined, soreness: undefined }),
  }).extraSession === null,
);

const MISSED: Record<string, SessionFeedback> = {};
for (const [index, dateStr] of BLOCK_1_DATES.entries()) {
  MISSED[dateStr] = index < 5
    ? EASY[dateStr]
    : { ...EASY[dateStr], completion: 'skipped' } as SessionFeedback;
}
ok(
  'a block below 75% attendance gets NO offer — it gets the other question',
  promptsFor({ program: easyProgram, feedback: MISSED }).extraSession === null,
);
ok(
  'AND THE TWO QUESTIONS ARE NEVER BOTH ON SCREEN',
  (() => {
    for (const feedback of [EASY, GOOD_NOT_EASY, VERY_HARD, MISSED]) {
      const prompts = promptsFor({ program: easyProgram, feedback });
      if (prompts.extraSession !== null && prompts.commitment !== null) return false;
    }
    return true;
  })(),
  'the shrinking question and the growing offer appeared together',
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[2] GYM AVAILABILITY — a day the athlete cannot train is not one');

const noFreeDay = athlete({
  preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
  teamTrainingDays: ['Tuesday', 'Thursday'],
  usualGameDay: 'Saturday',
  availabilityConstraints: [
    { id: 'c1', kind: 'unavailable_day', scope: 'permanent', dayOfWeek: 'Sunday' },
  ],
} as Partial<OnboardingData>);
/** A world where the larger week is genuinely refused by generation. */
const noClubNight = athlete({ teamTrainingDaysPerWeek: 0, teamTrainingDays: [] });
ok(
  'a game day and an unavailable day leave nothing free',
  availableTrainingDays({ profile: noFreeDay, weekOrder: WEEK_ORDER }).length === 0,
  availableTrainingDays({ profile: noFreeDay, weekOrder: WEEK_ORDER }).join(','),
);
ok(
  'and then NO offer is made',
  promptsFor({ program: easyProgram, feedback: EASY, profile: noFreeDay })
    .extraSession === null,
);
ok(
  'an INACTIVE constraint does not block the day — `active: false` is not a block',
  availableTrainingDays({
    profile: athlete({
      availabilityConstraints: [
        { id: 'c1', kind: 'unavailable_day', scope: 'permanent', dayOfWeek: 'Saturday', active: false },
      ],
    } as Partial<OnboardingData>),
    weekOrder: WEEK_ORDER,
  }).includes('Saturday'),
);
ok(
  'a constraint with NO `active` flag DOES block it — absent means live',
  !availableTrainingDays({
    profile: athlete({
      availabilityConstraints: [
        { id: 'c1', kind: 'unavailable_day', scope: 'permanent', dayOfWeek: 'Saturday' },
      ],
    } as Partial<OnboardingData>),
    weekOrder: WEEK_ORDER,
  }).includes('Saturday'),
);

ok(
  'AN ILLEGAL LARGER WEEK IS NOT OFFERED — the probe has the last word',
  decideExtraSessionOffer({
    history: easyHistory,
    forBlockNumber: 1,
    profile: athlete(),
    weekOrder: WEEK_ORDER,
    ledgerEntries: [],
    // The refusal generation would give, stated directly: this is the ONLY
    // authority on whether a commitment builds, and the offer must obey it.
    isCommitmentLegal: () => false,
    currentSessionsPerWeek: 3,
    patchFor: (sessionsPerWeek) => commitmentPatchFor({
      profile: athlete(), sessionsPerWeek, weekOrder: WEEK_ORDER, availableDays: available,
    }),
  }).offer === false,
);

/**
 * ⚠ **THE COORDINATE THAT KILLS "BLOCK 1 IS OFFERED A SESSION TOO".** Mutation
 * E16 deleted the `blockNumber < 2` guard and nothing moved — every fixture was
 * already at block 2. An athlete four weeks into their first block has no
 * completed block to have found easy.
 */
ok(
  'BLOCK 1 IS NEVER OFFERED A SESSION — there is no previous block to have earned it',
  deriveBlockBoundaryPrompts({
    currentProgram: easyProgram,
    blockNumber: 1,
    blockStartISO: BLOCK_2_START,
    sessionFeedback: EASY,
    onboardingData: athlete(),
    ledgerEntries: [],
    weekOrder: WEEK_ORDER,
  }).extraSession === null,
);

/**
 * ⚠ **THE COORDINATE THAT KILLS "THE ANSWER IS FILED AGAINST THE WRONG BLOCK".**
 * Mutation E21 shifted the offer's `forBlockNumber` by one and every cell stayed
 * green, because the decline cell below used a hand-written `1` rather than the
 * number the card would actually hand the door. An answer filed against the
 * wrong block is an offer that comes straight back.
 */
ok(
  'the offer is filed against the block that just ENDED',
  easyPrompts.extraSession?.offer.forBlockNumber === 1,
  `got ${String(easyPrompts.extraSession?.offer.forBlockNumber)}`,
);

/**
 * ⚠ **AND AN ATHLETE WHO IS NOT GOING TO BE OFFERED ANYTHING MUST NOT PAY FOR
 * IT.** The legality probe BUILDS A WHOLE PROGRAMME. This card is derived on
 * every redraw of the Program surface, so a gate that runs after the probe is a
 * generation per redraw for every athlete in the app.
 *
 * The instrument is `test:block-two-screen-delivery`'s: a profile proxy counting
 * reads of `preferredTrainingDays`, which nothing on this path touches until the
 * gates have passed. An earlier cut computed the free days eagerly and reddened
 * two of that suite's cells.
 */
{
  let profileReads = 0;
  const counting = new Proxy(athlete() as Record<string, unknown>, {
    get: (target, property: string) => {
      if (property === 'preferredTrainingDays') profileReads++;
      return target[property];
    },
  }) as unknown as OnboardingData;

  profileReads = 0;
  promptsFor({ program: easyProgram, feedback: EASY, profile: counting });
  const whenOffering = profileReads;
  ok(
    'the probe DOES run when the offer is live (control for the cell below)',
    whenOffering > 0,
    'the counter never moves — the cost cell below would pass vacuously',
  );

  profileReads = 0;
  promptsFor({ program: hardProgram, feedback: VERY_HARD, profile: counting });
  ok(
    'A BLOCK THAT WILL NOT BE OFFERED ANYTHING NEVER PAYS FOR THE PROBE',
    profileReads === 0,
    `the profile was read ${profileReads} time(s) for an athlete the first gate refuses`,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[2b] A CLUB NIGHT IS NOT AN ELIGIBILITY REQUIREMENT');

/**
 * ⚠ **RULED BY SAM, 2026-08-17:** *"Confirm club training is not itself an
 * eligibility requirement for the extra-session offer. The offer must depend on
 * spare gym availability and scheduler legality."*
 *
 * It is not, and it cannot become one: the only mention of team training on this
 * whole path is `availableTrainingDays` REMOVING club nights from the free days,
 * which makes a club night reduce availability, never grant it.
 *
 * ⚠ **AND MY EARLIER SUMMARY OF THIS WAS WRONG.** `docs/STATUS_LADDER.md` first
 * recorded *"every world with no club night refuses the larger week"*. Measured
 * properly, with the athlete's CURRENT week probed alongside the larger one:
 *
 * | phase | club | current week | larger week |
 * | --- | --- | --- | --- |
 * | Pre-season / In-season, any gym days | none | **ALREADY REFUSED** `sprint_high_speed_required_minimum:0` | refused, same clause |
 * | **Off-season, 2 gym days** | **none** | **BUILDS** | **BUILDS — the offer is made** |
 * | Off-season, 3+ gym days | none | builds | refused `main_strength_permitted_maximum:4` |
 *
 * A no-club pre-season athlete has no legal week AT ANY COUNT, including the one
 * they are on — the club night was carrying the sprint exposure §18 requires. So
 * the missing offer there is not this unit's doing; those athletes have no
 * programme to add a session to. **A no-club athlete whose week is legal at
 * `n+1` IS offered the session, and the cell below is that athlete.**
 */
const noClubAthlete = athlete({
  seasonPhase: 'Off-season',
  trainingDaysPerWeek: 2,
  preferredTrainingDays: ['Monday', 'Thursday'],
  teamTrainingDaysPerWeek: 0,
  teamTrainingDays: [],
} as Partial<OnboardingData>);
const noClubBlock1 = acceptBlock(noClubAthlete, {
  todayISO: BLOCK_1_START, blockNumber: 1,
});
const NO_CLUB_EASY = logRealBlock(noClubBlock1, { feeling: 'easy', soreness: 'none' });
const noClubProgram = acceptBlock(noClubAthlete, {
  todayISO: BLOCK_2_START,
  blockNumber: 2,
  progressionHistory: {
    sessionFeedback: NO_CLUB_EASY, weightOverrides: {}, blockState: null,
  },
});

ok(
  'the CLUBLESS athlete\'s week builds and their block reads consistently easy',
  noClubProgram.microcycles.length > 0
    && readBlockHistory({
      feedbackByDate: NO_CLUB_EASY,
      blockStartISO: BLOCK_1_START,
      blockEndISO: '2026-08-02',
      requiredStrengthSessions: 8,
    }).byQuality.strengthEasy,
  'without this the cell below would pass because the world is broken, not the rule right',
);
/**
 * ⚠ **AND THIS ATHLETE IS THE CONTRACT'S "UNAVAILABLE" CASE, IN A REAL WORLD.**
 * Every one of their sessions is authored at **16 main/secondary sets** — the
 * WC-030 ceiling exactly — so the set rung has nowhere to go, and every load
 * decision in their block reads `history_held`. An earlier cut of this unit
 * demanded that the two smaller rungs had LANDED before a session could be
 * offered, and refused exactly the athlete the word *unavailable* was written
 * for. That gate is gone.
 */
ok(
  'their sessions really are AT the ceiling — the "unavailable" case has coordinates',
  noClubProgram.microcycles[0].workouts
    .filter((workout) => (workout.exercises ?? []).length > 0)
    .every((workout) => countMainSecondarySets(workout) === 16),
  noClubProgram.microcycles[0].workouts
    .map((workout) => `${workout.name}=${countMainSecondarySets(workout)}`).join(' '),
);
ok(
  'A CLUBLESS ATHLETE IS OFFERED THE EXTRA SESSION — club training is NOT a requirement',
  deriveBlockBoundaryPrompts({
    currentProgram: noClubProgram,
    blockNumber: 2,
    blockStartISO: BLOCK_2_START,
    sessionFeedback: NO_CLUB_EASY,
    onboardingData: noClubAthlete,
    ledgerEntries: [],
    weekOrder: WEEK_ORDER,
  }).extraSession !== null,
  'the offer refused an athlete whose only difference is having no club night',
);
ok(
  'and the clubless athlete\'s free days are MORE, not fewer — a club night takes a day',
  availableTrainingDays({ profile: noClubAthlete, weekOrder: WEEK_ORDER }).length
    > availableTrainingDays({
      profile: athlete({
        seasonPhase: 'Off-season',
        trainingDaysPerWeek: 2,
        preferredTrainingDays: ['Monday', 'Thursday'],
      } as Partial<OnboardingData>),
      weekOrder: WEEK_ORDER,
    }).length,
);

/**
 * ⚠ **AND WHERE A CLUBLESS ATHLETE IS NOT OFFERED ONE, IT IS THE SCHEDULER'S
 * ANSWER AND NOT A CLUB CHECK.** A clubless pre-season athlete is refused at
 * their CURRENT commitment too, for the same typed reason — so the offer is not
 * what is withholding anything.
 */
ok(
  'a clubless PRE-SEASON athlete has no legal week at their CURRENT count either',
  (() => {
    const clubless = athlete({ teamTrainingDaysPerWeek: 0, teamTrainingDays: [] });
    try {
      generateProgramLocally(clubless, { todayISO: BLOCK_2_START, blockNumber: 2 });
      return false;
    } catch (error) {
      return String((error as Error).message)
        .includes('sprint_high_speed_required_minimum');
    }
  })(),
  'the clubless pre-season refusal is not the sprint-exposure clause after all — re-measure before claiming it',
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[3] ON GLASS — the exact words, the two buttons, the real taps');

const model = easyPrompts.extraSession!;
let accepted: number | null = null;
let declined = 0;
const card = ExtraSessionOfferCard({
  model,
  onAccept: (sessionsPerWeek) => { accepted = sessionsPerWeek; },
  onDecline: () => { declined++; },
});

ok(
  'the card renders SAM\'S SENTENCE, word for word',
  textOf(nodeWithTestID(card, 'home-extra-session-offer-sentence')) === APPROVED_OFFER_SENTENCE,
  `got "${textOf(nodeWithTestID(card, 'home-extra-session-offer-sentence'))}"`,
);
ok(
  'and BOTH of Sam\'s buttons, word for word',
  labelOf(card, 'home-extra-session-accept') === APPROVED_ACCEPT_LABEL
    && labelOf(card, 'home-extra-session-decline') === APPROVED_DECLINE_LABEL,
  `accept="${labelOf(card, 'home-extra-session-accept')}" `
  + `decline="${labelOf(card, 'home-extra-session-decline')}"`,
);
ok(
  'NOTHING HAPPENS BY RENDERING — no handler fired on its own',
  accepted === null && declined === 0,
  'the card added a session merely by being drawn',
);
ok(
  'tapping "Add one session" asks for exactly one more',
  tap(card, 'home-extra-session-accept') && accepted === 4,
  `accepted=${String(accepted)}`,
);
ok(
  'tapping "Keep my current schedule" calls the decline and nothing else',
  tap(card, 'home-extra-session-decline') && declined === 1 && accepted === 4,
  `declined=${declined}`,
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[4] THE ANSWER PERSISTS, AND THE QUESTION IS NOT PUT AGAIN');

useDecisionLedgerStore.setState({ entries: [] });
// ⚠ THE NUMBER THE CARD WOULD ACTUALLY HAND THE DOOR, not a hand-written 1.
declineWeeklyCommitment({ forBlockNumber: model.offer.forBlockNumber });
const afterDecline = useDecisionLedgerStore.getState().entries;
ok(
  'the decline is on the decision ledger',
  afterDecline.some((entry) => entry.decision.kind === 'weekly_commitment_answer'
    && entry.decision.forBlockNumber === 1
    && entry.decision.answer.kind === 'declined'),
  JSON.stringify(afterDecline.map((entry) => entry.decision.kind)),
);
ok(
  'AND THE OFFER IS NOT PUT AGAIN IN THIS BLOCK',
  promptsFor({
    program: easyProgram, feedback: EASY, ledgerEntries: afterDecline,
  }).extraSession === null,
);
/**
 * ⚠ **PRESCRIPTIONS, NOT THE WHOLE OBJECT.** Two generations of the same world
 * differ in row ids and `createdAt` stamps, so a `JSON.stringify` of the
 * microcycles compares the clock as well as the coaching and can never be equal.
 * What "declining changes nothing" means is that no set, rep or load moved.
 */
function prescriptionsOf(program: TrainingProgram): string {
  const rows: string[] = [];
  for (const [weekIndex, microcycle] of program.microcycles.entries()) {
    for (const workout of microcycle.workouts) {
      for (const row of workout.exercises ?? []) {
        rows.push(`w${weekIndex + 1}:${workout.name}:${row.exercise?.name}`
          + `:${row.prescribedSets}:${row.prescribedRepsMin}-${row.prescribedRepsMax}`
          + `:${row.prescribedWeightKg}`);
      }
    }
  }
  return rows.join('|');
}
/* ⚠ **BOTH SIDES BUILT INTO THE SAME UNCONTAMINATED HISTORY.** Selection history
 * is a real persisted store and every scenario between `easyProgram` and this
 * line ACCEPTED its own block, overwriting the record this comparison is about.
 * The two sides are re-authored together so they are the same athlete. */
resetBlockSelectionHistory();
const declineBaseline = prescriptionsOf(build(EASY));
const declineAfter = prescriptionsOf(build(EASY));
ok(
  'a decline changes NO prescription — every set, rep and load is identical',
  declineAfter === declineBaseline,
  'declining moved a prescription',
);

/**
 * ⚠ **THE RELAUNCH IS A REDERIVATION, AND THAT IS STRONGER THAN PERSISTENCE.**
 * The question is derived from the logged sessions and the ledger every time the
 * surface draws, so "it survives reload" is proven by handing the derivation the
 * persisted ledger again and getting the same silence — there is no cached
 * answer that could come back different.
 */
const relaunchedEntries: DecisionLedgerEntry[] = JSON.parse(JSON.stringify(afterDecline));
ok(
  'after a relaunch the decline still silences the offer',
  promptsFor({
    program: build(EASY), feedback: EASY, ledgerEntries: relaunchedEntries,
  }).extraSession === null,
);
ok(
  'and an answer recorded against ANOTHER block does not silence this one',
  promptsFor({
    program: easyProgram,
    feedback: EASY,
    ledgerEntries: relaunchedEntries.map((entry) => ({
      ...entry,
      decision: { ...entry.decision, forBlockNumber: 99 },
    })) as DecisionLedgerEntry[],
  }).extraSession !== null,
  'the ledger read is not scoped to the block that raised the question',
);

/**
 * ACCEPTING. The door is `confirmWeeklyCommitment`, which rebuilds through
 * `commitProfileProgramTransaction` — the app's one owner of "apply a profile
 * change and rebuild". Driving that whole transaction needs the store stack the
 * screen-delivery suite stands up; what is asserted here is the PATCH it is
 * handed, which is the thing this unit authors.
 */
const acceptPatch = commitmentPatchFor({
  profile: athlete(), sessionsPerWeek: 4, weekOrder: WEEK_ORDER, availableDays: available,
});
ok(
  'accepting writes FOUR training days, not three and not five',
  acceptPatch.trainingDaysPerWeek === 4 && acceptPatch.preferredTrainingDays.length === 4,
  JSON.stringify(acceptPatch),
);
ok(
  'and the week it writes is one generation builds',
  (() => {
    try {
      const program = generateProgramLocally(
        { ...athlete(), ...acceptPatch } as OnboardingData,
        { todayISO: BLOCK_2_START, blockNumber: 2 },
      );
      return program.microcycles.length > 0;
    } catch { return false; }
  })(),
  `${acceptPatch.preferredTrainingDays.join(',')} did not build`,
);
/**
 * ⚠ **AND THE CLAIM IS "BEST SEPARATED", NOT "NEVER BACK-TO-BACK".** Four
 * training days on a seven-day ring have a smallest cyclic gap of 1 whichever
 * four they are — the first version of this cell demanded every gap be two or
 * more and was arithmetically impossible. What the shared scorer actually
 * promises is that no OTHER single addition would be better spaced.
 */
function separation(days: readonly DayOfWeek[]): readonly [number, number] {
  const idx = days.map((day) => WEEK_ORDER.indexOf(day)).sort((a, b) => a - b);
  const gaps = idx.map((value, i) =>
    (i === 0 ? value + WEEK_ORDER.length - idx[idx.length - 1] : value - idx[i - 1]));
  return [Math.min(...gaps), -gaps.reduce((total, gap) => total + gap * gap, 0)];
}
ok(
  'the day it added is one the athlete actually had free',
  acceptPatch.preferredTrainingDays
    .filter((day) => !['Monday', 'Wednesday', 'Friday'].includes(day))
    .every((day) => available.includes(day)),
  `${acceptPatch.preferredTrainingDays.join(',')} against free ${available.join(',')}`,
);
ok(
  'and NO other free day would have left the week better separated',
  (() => {
    const chosen = separation(acceptPatch.preferredTrainingDays);
    return available.every((day) => {
      const other = separation([...(athlete().preferredTrainingDays ?? []), day]);
      return chosen[0] > other[0] || (chosen[0] === other[0] && chosen[1] >= other[1]);
    });
  })(),
  `${acceptPatch.preferredTrainingDays.join(',')} is not the best-separated addition`,
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log(`\nBlock two extra session: passed=${pass} failures=${fail}`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
