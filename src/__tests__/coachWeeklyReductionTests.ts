/**
 * THE WEEKLY-REDUCTION CONVERSATION, DRIVEN THROUGH THE REAL DOORS — R-105.
 *
 * Sam, 2026-08-19: *"This should not be popping up on the main page - it should
 * show up in the coaches chat with a notification"*.
 *
 *   npm run test:coach-weekly-reduction
 *
 * ## WHAT IS REAL HERE
 *
 * One athlete, installed through `CompleteScreen`'s own three calls, walked
 * through a whole block with `recordDay` — the app's one live outcome writer —
 * rolled over through `rolloverProgramBlock`, and then asked the COACH's own
 * assembly (`coachWeeklyCommitmentInputs`) what the conversation is. Accepting
 * goes through `confirmWeeklyCommitment` → `commitProfileProgramTransaction`,
 * the canonical accepted-program transaction. Close/reopen is `relaunchApp`: the
 * stores are emptied, their writes settle, the disk snapshot is restored and
 * every registered store rehydrates.
 *
 * ## THE ONE CLAIM THIS SUITE EXISTS FOR
 *
 * **What the athlete is shown before accepting is what accepting produces.** The
 * rejected `codex/finish-product` candidate predicted the changed day from the
 * CURRENT week and was measured wrong on 11 of 20 generated worlds — the athlete
 * found out by accepting. Section [3] takes the preview, then runs the real
 * transaction, then compares the PUBLISHED program's prescriptions against the
 * previewed candidate's. Not similar. Equal.
 *
 * ## WHAT IS NOT REAL, STATED SO IT IS NOT MISTAKEN FOR PROOF
 *
 * No pixels and no simulator — another lane owns the device exclusively today.
 * The card is called as the function it is and its own `onPress` closures are
 * invoked, which proves the wiring and not the layout.
 */

// ── Headless bootstrap. MUST precede every app import. ────────────────────
//
// `__DEV__` IS TRUE: this is a simulation of TIME PASSING, and
// `isDevE2EClockAvailable()` refuses outside dev, so `setDevE2EClock` would
// return null SILENTLY and every door would read the wall clock.
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
const localStorageData = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => localStorageData.get(key) ?? null,
    setItem: (key: string, value: string) => { localStorageData.set(key, value); },
    removeItem: (key: string) => { localStorageData.delete(key); },
    clear: () => { localStorageData.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — this athlete trains entirely on-device');
};
process.env.TZ = 'Australia/Melbourne';

/* ── The `react-native` stand-in ───────────────────────────────────────────
 * A HOST-COMPONENT STUB, NOT A BEHAVIOUR STUB — `blockTwoScreenDeliveryTests`'s
 * own, so the card's logic is the card's. Every export becomes the STRING that
 * names it, which is what React uses for a host component, so a `<Pressable
 * testID onPress>` still produces an element carrying that testID and that
 * onPress. */
const reactNativeStub: Record<string, unknown> = new Proxy({
  StyleSheet: { create: (sheet: unknown) => sheet, flatten: (style: unknown) => style },
  Platform: { OS: 'ios', select: (map: Record<string, unknown>) => map.ios ?? map.default },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
}, {
  get: (target, property: string) => (property in target ? target[property] : property),
  has: () => true,
});
require.cache[require.resolve('react-native')] = {
  id: 'react-native', filename: 'react-native', loaded: true,
  exports: reactNativeStub,
} as unknown as NodeModule;

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { readFileSync } from 'fs';
import { join } from 'path';
import type { OnboardingData, TrainingProgram } from '../types/domain';
import { addDaysISO } from '../utils/programBlockState';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import {
  coldStartThroughOnboarding,
  followTheWeek,
  quiet,
  quietAsync,
  recordDay,
  relaunchApp,
  rolloverIfDue,
  setJourneyClock,
} from './support/athleteJourney';
import { conversationFor } from './support/coachCommitment';
import { coachCommitmentNotification } from '../screens/coach/useCoachWeeklyCommitment';
import { commitmentChangePreview } from '../rules/commitmentChangePreview';
import { CommitmentCard } from '../components/CommitmentCard';
import {
  confirmWeeklyCommitment,
  declineWeeklyCommitment,
} from '../store/weeklyCommitmentAnswer';
import {
  commitmentPreviewDaySentence,
  commitmentPreviewUnavailableSentence,
  sessionComponentName,
  commitmentConversationNoticeSentence,
  commitmentConfirmedSentence,
  commitmentDeclinedSentence,
} from '../rules/projectionCopy';
import { shortDayMonthLabel } from '../utils/appDate';
import { shortDateCopy } from '../rules/projectionCopy';
import type { CommitmentConversation } from '../rules/weeklyCommitmentConversation';

let pass = 0; let fail = 0; const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) { pass += 1; console.log(`  PASS ${name}`); }
  else {
    fail += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ── The element walker — a node is FOUND, never assumed ───────────────────*/
interface Elementish { props?: Record<string, unknown> }
function walk(node: unknown, visit: (element: Elementish) => void): void {
  if (node === null || node === undefined || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) walk(child, visit); return; }
  const element = node as Elementish;
  if (element.props) { visit(element); walk(element.props.children, visit); }
}
function testIDs(tree: unknown): string[] {
  const ids: string[] = [];
  walk(tree, (element) => {
    const id = element.props?.testID;
    if (typeof id === 'string') ids.push(id);
  });
  return ids;
}
function tap(tree: unknown, testID: string): boolean {
  let onPress: unknown = null;
  walk(tree, (element) => {
    if (onPress) return;
    if (element.props?.testID === testID) onPress = element.props?.onPress;
  });
  if (typeof onPress !== 'function') return false;
  (onPress as () => void)();
  return true;
}

const REPO_ROOT = join(__dirname, '..', '..');
/**
 * A source file with its COMMENTS REMOVED.
 *
 * ⚠ **A NOTE IS OUTPUT, NEVER EVIDENCE — AND THIS FILE PAID FOR THAT LAW ON ITS
 * FIRST RUN.** `EVERY REMOVAL NAMES WHERE THE BEHAVIOUR WENT` requires the
 * comment left behind at a deletion to name the function that moved. A scan of
 * raw text then reads that comment as a call, so the cell fired on
 * `useHomeScreen` for a sentence saying the door had moved AWAY. The note
 * yields, not the gate: the gate reads code.
 */
function source(relative: string): string {
  return readFileSync(join(REPO_ROOT, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * EVERY PRESCRIPTION IN A PROGRAM, as a comparable string.
 *
 * ⚠ **PRESCRIPTIONS, NOT THE WHOLE OBJECT.** Two builds of the same world differ
 * in row ids and `createdAt` stamps, so a `JSON.stringify` of the microcycles
 * compares the clock as well as the coaching and can never be equal. What
 * "the preview equals what acceptance produced" means is that every day, every
 * session, every exercise, every set, rep and load is the same.
 */
function prescriptionsOf(program: TrainingProgram | null | undefined): string {
  const rows: string[] = [];
  for (const microcycle of program?.microcycles ?? []) {
    for (const workout of microcycle.workouts) {
      for (const row of workout.exercises ?? []) {
        rows.push(`${microcycle.startDate.slice(0, 10)}:d${workout.dayOfWeek}`
          + `:${workout.name}:${row.exercise?.name}:${row.prescribedSets}`
          + `:${row.prescribedRepsMin}-${row.prescribedRepsMax}:${row.prescribedWeightKg}`);
      }
    }
  }
  return rows.sort().join('|');
}

/** Every persisted store, as it sits on disk. The no-silent-mutation instrument. */
function diskFingerprint(): string {
  return JSON.stringify([...localStorageData.entries()].sort());
}

// ═══════════════════════════════════════════════════════════════════════════
// THE ATHLETE — the journey suite's own, so two suites cannot disagree about
// what a legal athlete is. In-season, Saturday game, two club nights, three gym
// days, full kit, capacity-scored (§18 refuses a world it cannot score).
// ═══════════════════════════════════════════════════════════════════════════

const INSTALL_DAY = '2026-07-13'; // a Monday

function theAthlete(): OnboardingData {
  return {
    firstName: 'Jordan',
    ageRange: '22-26',
    position: 'inside_mid',
    heightCm: 182,
    weightKg: 84,
    motivation: 'Dominate your level',
    // OFF-SEASON, NO CLUB, NO GAME — and the phase is a MEASUREMENT, not taste.
    // See section [2b]: for an in-season athlete with a Saturday game and two
    // club nights the scheduler builds the IDENTICAL week at three days and at
    // four, so the extra-session offer is correctly refused there and this
    // suite's whole preview arm would be vacuous. R-002: off-season has NO team
    // training, ever.
    seasonPhase: 'Off-season',
    trainingDaysPerWeek: 2,
    preferredTrainingDays: ['Monday', 'Thursday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
    usualGameDay: null,
    gameDay: null,
    trainingLocation: 'Commercial gym',
    equipment: ['barbell', 'dumbbells', 'squat_rack', 'pullup_bar', 'cable_machine',
      'hamstring_curl', 'knee_extension', 'bands'],
    equipmentAnswer: {
      tags: {
        barbell: 'have', dumbbells: 'have', cables: 'have', machine: 'have', bands: 'have',
        bench: 'have', pullup_bar: 'have', kettlebell: 'have', foam_roller: 'have',
        plyo_box: 'have',
      },
      modalities: {
        bike_erg: 'have', air_bike: 'have', row: 'have', ski: 'have', treadmill: 'have',
      },
      answeredOn: INSTALL_DAY,
    },
    injuries: [],
    goals: ['Get stronger'],
    experienceLevel: '5+ years',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    conditioningLevel: 'Good',
    sprintExposure: '2+ times per week',
    recentTrainingLoad: 'Pretty consistent',
    twoKmTimeTrial: { seconds: 420, recordedOn: INSTALL_DAY, source: 'onboarding' },
  } as unknown as OnboardingData;
}

/**
 * THE ATHLETE WHOSE EXTRA SESSION THE SCHEDULER WILL NOT PLACE.
 *
 * In-season, Saturday game, club Tuesday and Thursday, gym Monday/Wednesday/
 * Friday — the shape Sam calls real, and the one `completeAthleteJourneyTests`
 * walks. Used by section [2b] and never walked: the finding is about GENERATION,
 * so a direct build is the whole instrument.
 */
function theBlockedAthlete(over: Partial<OnboardingData> = {}): OnboardingData {
  return {
    ...theAthlete(),
    seasonPhase: 'In-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Hard',
    usualGameDay: 'Saturday',
    gameDay: 'Saturday',
    ...over,
  } as unknown as OnboardingData;
}

/** Which weekday indices the first built week actually puts WORK on. */
function builtTrainingDays(profile: OnboardingData, todayISO: string): number[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { generateProgramLocally } = require('../services/api/generateProgram');
  try {
    const program = quiet(() => generateProgramLocally(profile, {
      todayISO, blockNumber: 2, recordSelections: false,
      progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
    })) as TrainingProgram;
    return (program.microcycles[0]?.workouts ?? [])
      .filter((workout) => (workout.exercises ?? []).length > 0)
      .map((workout) => workout.dayOfWeek)
      .sort((left, right) => left - right);
  } catch {
    return [];
  }
}

/** The coach's conversation, from the LIVE stores, through the production assembly. */
function coachConversation() {
  const store = useProgramStore.getState();
  return conversationFor({
    program: store.currentProgram,
    blockNumber: store.blockState?.blockNumber ?? null,
    blockStartISO: store.blockState?.blockStartDate ?? null,
    todayISO: store.blockState?.blockStartDate ?? INSTALL_DAY,
    feedback: store.sessionFeedback,
    profile: useProfileStore.getState().onboardingData,
    ledgerEntries: useDecisionLedgerStore.getState().entries,
    acceptedBlocks: store.acceptedBlocks ?? {},
  });
}

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════ */
  console.log('\n[0] THE WORLD — a real athlete, installed and walked through a block');

  const install = await coldStartThroughOnboarding({
    profile: theAthlete(), installDayISO: INSTALL_DAY,
  });
  ok(
    'onboarding installed a program without refusing',
    install.onboardingRefusal === null && install.program.microcycles.length > 0,
    `refusal=${install.onboardingRefusal} weeks=${install.program.microcycles.length}`,
  );

  // WALK THE WHOLE BLOCK, ANSWERING EVERYTHING EASY. The extra-session offer's
  // gate is *"everything consistently easy"* — including the CONDITIONING RPE,
  // which `readBlockHistory` reads on its own and which an athlete who never
  // answers it leaves as `conditioningEasy: false` forever.
  const blockOneStart = install.blockOneStart;
  for (let offset = 0; offset < 28; offset += 1) {
    const dateISO = addDaysISO(blockOneStart, offset);
    setJourneyClock(dateISO);
    followTheWeek(dateISO);
    await recordDay(dateISO, {
      record: true,
      completion: 'full',
      feeling: 'easy',
      soreness: 'none',
      // 1-10, and `<= 5` is the EASY arm. `difficulty: 3` on a 1-5 reading would
      // silently mean "middling" — docs/EFFORT_SCALE_INVERSION_2026-08-12.md.
      difficulty: 2,
      logWeights: true,
      conditioningRpe: 3,
    });
  }

  const blockTwoStart = addDaysISO(blockOneStart, 28);
  setJourneyClock(blockTwoStart);
  const rollover = rolloverIfDue(blockTwoStart);
  ok(
    'the block rolled over through the production owner',
    rollover.fired && rollover.toBlock === 2,
    `fired=${rollover.fired} refusal=${rollover.refusal} to=${rollover.toBlock}`,
  );
  followTheWeek(blockTwoStart);

  // ⚠ THE DENOMINATOR IS THE BLOCK'S OWN SESSION COUNT, NOT A ROUND NUMBER.
  // `recordDay` records the days that CARRY a session; this athlete trains two
  // or three days a week, so a "20 days" threshold would be asserting a world
  // this athlete does not live in. Counted from the block that was walked.
  const feedbackDays = Object.keys(useProgramStore.getState().sessionFeedback ?? {}).length;
  const sessionsInBlockOne = install.program.microcycles
    .reduce((total, microcycle) => total + microcycle.workouts
      .filter((workout) => (workout.exercises ?? []).length > 0).length, 0);
  ok(
    'the app can SEE the block that was walked — every session it contained was recorded',
    feedbackDays > 0 && feedbackDays >= sessionsInBlockOne,
    `stored feedback days = ${feedbackDays}, block one contained ${sessionsInBlockOne} sessions`,
  );
  const acceptedBlockKeys = Object.keys(useProgramStore.getState().acceptedBlocks ?? {});
  ok(
    'and the accepted block recorded what it REQUIRED — the denominator exists',
    acceptedBlockKeys.length > 0,
    `acceptedBlocks keys = ${JSON.stringify(acceptedBlockKeys)}`,
  );

  /* ═════════════════════════════════════════════════════════════════════════ */
  console.log('\n[1] THE COACH RAISES IT — and the Program page does not');

  const raised = coachConversation();
  ok(
    'LIVENESS — the coach really has a conversation to raise in this world',
    raised.value !== null,
    `refusal = ${JSON.stringify(raised.refusal)}`,
  );
  const conversation = raised.value as CommitmentConversation;
  if (!conversation) {
    console.log('\n  ⚠ NO CONVERSATION IN THIS WORLD — every cell below would pass');
    console.log('    vacuously, so they are REPORTED AS FAILURES rather than skipped.');
  }
  // ⚠ THE NOTIFICATION IS READ THROUGH ITS OWN OWNER, NOT RE-ASSERTED.
  // The first cut of these two cells both read `raised.value`, so a mutation
  // making the notification permanently on — the stored-flag shape R-099 exists
  // to prevent — survived the entire suite. Both directions are checked, on the
  // live world and on the answered one.
  ok(
    'the notification is ON exactly while there is a conversation',
    coachCommitmentNotification(raised) === (raised.value !== null),
    `notification=${coachCommitmentNotification(raised)} conversation=${raised.value !== null}`,
  );
  ok(
    'the coach announces it with a signed line that claims nothing about the program',
    /coach/i.test(String(commitmentConversationNoticeSentence()))
      && !/rebuilt|changed|added|removed/i.test(String(commitmentConversationNoticeSentence())),
    String(commitmentConversationNoticeSentence()),
  );

  // ── NO PROGRAM-PAGE DUPLICATE, READ AT THE SOURCE ──
  //
  // ⚠ THE DERIVATION, NOT JUST THE RENDER. A screen that stopped drawing the
  // card while its hook still derived it is one JSX line from putting it back.
  const homeScreen = source('src/screens/home/HomeScreenV2.tsx');
  const homeHook = source('src/screens/home/useHomeScreen.ts');
  const programPrompts = source('src/screens/home/useBlockBoundaryPrompts.ts');
  const programCards = source('src/screens/home/BlockBoundaryCards.tsx');
  ok(
    'the Program screen mounts NEITHER moved card',
    !/<WeeklyCommitmentPromptCard/.test(homeScreen)
      && !/<ExtraSessionOfferCard/.test(homeScreen),
    'the Program page still draws the conversation R-105 moved',
  );
  ok(
    'and its hook no longer DERIVES either of them',
    !/weeklyCommitmentPrompt|extraSessionOffer|confirmWeeklyCommitment/.test(homeHook),
    'the derivation is still on the Program hook — one JSX line from returning',
  );
  ok(
    'the Program surface\'s prompt module derives only the NOTICE',
    !/decideWeeklyCommitmentQuestion|decideExtraSessionOffer/.test(programPrompts)
      && /deriveNotice/.test(programPrompts),
    'the moved derivation is still in the Program hook module',
  );
  ok(
    'and the two moved card components are gone from the Program card file',
    !/export function WeeklyCommitmentPromptCard/.test(programCards)
      && !/export function ExtraSessionOfferCard/.test(programCards),
    'a deleted card that still exports is a card one import from returning',
  );
  /**
   * ⚠ **THE SURFACE IS MOUNTED, AND THIS IS THE CELL THAT WOULD HAVE CAUGHT THE
   * REJECTED CANDIDATE'S WORST FINDING.** `codex/finish-product` built ~330
   * lines behind `CoachScreen`, which `AppNavigator` DEFINES AND NEVER RENDERS —
   * so its work could not reach an athlete at all, and separately its one
   * reachable path put unsigned emergency-medical copy in front of one. A
   * feature nothing mounts is a feature nobody has, however green its cells are.
   */
  const coachScreenSource = source('src/screens/coach/CoachTabScreen.tsx');
  const navigator = source('src/navigation/AppNavigator.tsx');
  /**
   * ⚠ **THE CONDITION, NOT THE OCCURRENCE — AND A MUTATION IS WHY.** The first
   * cut of this cell tested `/<CommitmentCard/`, and a mutation replacing the
   * card's guard with `{false ? (` SURVIVED: the occurrence was still there and
   * the card never rendered. *A count is never the whole assertion — locate the
   * REGION and assert what makes it run.* So the anchors are FOUND first (an
   * `indexOf` that missed returns -1, which compares perfectly well), and then
   * what stands between them is checked.
   */
  const cardAt = coachScreenSource.indexOf('<CommitmentCard');
  const guardAt = coachScreenSource.lastIndexOf('weeklyCommitment.conversation ?', cardAt);
  ok(
    'both anchors were FOUND in the coach screen — the cell below can fail',
    cardAt > 0 && guardAt > 0 && cardAt - guardAt < 400,
    `cardAt=${cardAt} guardAt=${guardAt}`,
  );
  ok(
    'the COACH TAB really mounts the conversation — hook, bubbles and card',
    /useCoachWeeklyCommitment\(\)/.test(coachScreenSource)
      && cardAt > 0 && guardAt > 0 && guardAt < cardAt
      && /coach-tab-commitment-notice/.test(coachScreenSource)
      && /coach-tab-commitment-question/.test(coachScreenSource),
    'the conversation is derived and never drawn — a feature nothing mounts',
  );
  ok(
    'and the card is drawn ONLY when there IS a conversation — no dead affordance',
    coachScreenSource.slice(guardAt, cardAt).indexOf('false') === -1,
    coachScreenSource.slice(Math.max(0, guardAt - 40), cardAt + 20),
  );
  ok(
    'and the navigator mounts THAT screen as the Coach tab, with the derived badge',
    /component=\{CoachTabScreen\}/.test(navigator)
      && /tabBarBadge: coachCommitment\.hasNotification/.test(navigator),
    'the tab points somewhere else, or the badge is not the derived notification',
  );
  ok(
    'the badge is a DOT with no stored counter behind it',
    !/unread|badgeCount|notificationCount/i.test(navigator),
    'a stored unread count has appeared — R-099: only the ANSWER is stored',
  );
  ok(
    'CONTROL — the Program surface DID hold them, so the four cells above are not vacuous',
    /BlockBoundaryNoticeCard/.test(homeScreen) && /blockBoundaryNotice/.test(homeHook),
    'the notice is gone too, so those cells prove nothing about what MOVED',
  );

  /* ═════════════════════════════════════════════════════════════════════════ */
  console.log('\n[2] THE PREVIEW — the actual regenerated week, or an honest refusal');

  const preview = conversation?.preview ?? null;
  if (conversation?.direction === 'extra_session') {
    ok(
      'the extra-session offer carries a preview of the REGENERATED week',
      preview !== null,
      `previewRefusal = ${String(conversation.previewRefusal)}`,
    );
    ok(
      'and it names a real calendar date, not a weekday alone',
      (preview?.changedDays ?? []).every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.dateISO)),
      JSON.stringify((preview?.changedDays ?? []).map((day) => day.dateISO)),
    );
    ok(
      'every changed day says whether it is NEW or joins a day already trained',
      (preview?.changedDays ?? []).length > 0
        && (preview?.changedDays ?? []).every((day) =>
          day.arrival === 'new_training_date' || day.arrival === 'combined_with_existing'),
      JSON.stringify((preview?.changedDays ?? []).map((day) => [day.dayOfWeek, day.arrival])),
    );
    ok(
      'R-106 — a combined day reports ONE day and lists its components separately',
      (preview?.changedDays ?? []).every((day) =>
        day.arrival !== 'combined_with_existing' || day.existingComponents.length > 0),
      'a day reported as combined carried nothing before, which makes it a new day',
    );
    ok(
      'and a NEW training date is one the athlete was NOT training on',
      (preview?.changedDays ?? []).every((day) =>
        day.arrival !== 'new_training_date' || day.existingComponents.length === 0),
      JSON.stringify((preview?.changedDays ?? [])
        .map((day) => [day.dayOfWeek, day.arrival, day.existingComponents])),
    );
    ok(
      'every changed day names the session\'s actual typed components',
      (preview?.changedDays ?? []).every((day) => day.components.length > 0
        && day.componentLabels.length === day.components.length),
      JSON.stringify((preview?.changedDays ?? []).map((day) => day.components)),
    );
    ok(
      'the load/recovery lines are the PROGRAM\'S OWN — week kind, deload door, day counts',
      preview !== null
        && typeof preview.load.trainingDaysBefore === 'number'
        && typeof preview.load.trainingDaysAfter === 'number'
        && preview.load.trainingDaysAfter > 0,
      JSON.stringify(preview?.load),
    );
    /**
     * ⚠ **NO `after === before + 1` CELL, AND THE FIRST DRAFT HAD ONE.** It
     * failed on the real world: this athlete's off-season week already carries
     * five days of work at a TWO-day commitment, because conditioning fills days
     * the gym does not, and the rebuild rearranged rather than appended. "One
     * more committed session" is a fact about the COMMITMENT; how many days the
     * week ends up with is generation's to decide. Asserting the arithmetic
     * would have been this suite predicting the scheduler — the exact thing the
     * preview exists to stop.
     */
    ok(
      'at least one day really changed, which is what an offer must be able to show',
      (preview?.changedDays ?? []).length > 0,
      JSON.stringify(preview?.load),
    );
    for (const day of preview?.changedDays ?? []) {
      console.log(`    PREVIEW: ${String(commitmentPreviewDaySentence(day))}`);
    }
    /**
     * ⚠ **THE SENTENCE ITSELF, NOT JUST THE MODEL BEHIND IT.** A first pass
     * printed these lines and asserted nothing about them, so a mutation
     * replacing `joinSignedCopy` with a raw `.join(', ')` over the component
     * KINDS survived: the athlete would have read *"Saturday 15/8 … strength,
     * conditioning"* — unsigned words, the app's internal identifiers, and a
     * separator this file chose. `copy.joiner.plus` is Sam's own " + " from the
     * compound-bucket ruling.
     */
    ok(
      'every previewed sentence names components in SIGNED words, joined by Sam\'s " + "',
      (preview?.changedDays ?? []).every((day) => {
        const sentence = String(commitmentPreviewDaySentence(day));
        const namedInFull = day.components
          .every((kind) => sentence.includes(String(sessionComponentName(kind))));
        const joinedHisWay = day.components.length < 2 || sentence.includes(' + ');
        // The raw kind identifiers must not appear — they are addresses, not words.
        const noIdentifiers = !/\b(team_training|recovery_addon)\b/.test(sentence);
        return namedInFull && joinedHisWay && noIdentifiers;
      }),
      JSON.stringify((preview?.changedDays ?? [])
        .map((day) => String(commitmentPreviewDaySentence(day)))),
    );
  } else {
    console.log(`    (this world raised the ${conversation?.direction} direction;`
      + ' the preview cells above are the extra-session offer\'s)');
  }

  /**
   * ⚠ **ONE ATHLETE IN THE CONVERSATION.** The preview patches the profile every
   * gate above reasoned about; acceptance patches the ACCEPTED profile snapshot.
   * In a healthy world those are the same object, and this cell is what makes
   * that a checked fact rather than an assumption — if they ever diverge, the
   * preview and the acceptance are describing two different athletes, and this
   * reds before anybody finds out by accepting.
   */
  {
    const live = useProfileStore.getState().onboardingData;
    const snapshot = useProgramStore.getState()
      .acceptedMaterialContext?.acceptedProfileSnapshot?.onboardingData ?? null;
    ok(
      'the accepted profile snapshot and the live profile are the same athlete',
      snapshot === null
        || JSON.stringify((snapshot as { preferredTrainingDays?: unknown })
          .preferredTrainingDays)
          === JSON.stringify(live?.preferredTrainingDays),
      `snapshot=${JSON.stringify((snapshot as { preferredTrainingDays?: unknown } | null)
        ?.preferredTrainingDays)} live=${JSON.stringify(live?.preferredTrainingDays)}`,
    );
  }
  ok(
    'the two date owners agree — the signed short date IS `shortDayMonthLabel`',
    ['2026-01-05', '2026-07-13', '2026-11-30', '2026-12-25'].every((dateISO) =>
      String(shortDateCopy(dateISO)) === shortDayMonthLabel(dateISO)),
    'a second d/m formatter has appeared; `shortDayMonthLabel` calls itself the one owner',
  );
  ok(
    'a preview that cannot be built REFUSES rather than describing the current week',
    /not guess|could not build/i.test(String(commitmentPreviewUnavailableSentence())),
    String(commitmentPreviewUnavailableSentence()),
  );

  /* ═════════════════════════════════════════════════════════════════════════ */
  console.log('\n[3] NOTHING MOVES BEFORE THE ATHLETE SAYS YES');

  const diskBeforeDerivation = diskFingerprint();
  const programBeforeDerivation = prescriptionsOf(useProgramStore.getState().currentProgram);
  // Derive again — which BUILDS the preview program a second time.
  coachConversation();
  ok(
    'BUILDING THE PREVIEW WRITES NOTHING TO DISK',
    diskFingerprint() === diskBeforeDerivation,
    'a preview mutated persisted state — the athlete has not agreed to anything yet',
  );
  ok(
    'and it moves no prescription in the live program',
    prescriptionsOf(useProgramStore.getState().currentProgram) === programBeforeDerivation,
    'the program changed while the athlete was only being asked',
  );
  const ledgerBefore = useDecisionLedgerStore.getState().entries.length;
  ok(
    'and it appends no decision',
    ledgerBefore === useDecisionLedgerStore.getState().entries.length,
    'a question recorded itself as an answer',
  );

  /* ═════════════════════════════════════════════════════════════════════════ */
  console.log('\n[4] THE CARD — the real tap closures, on the coach\'s coordinates');

  let tapped: number | null = null;
  let declines = 0;
  const card = conversation ? CommitmentCard({
    conversation,
    onAccept: (sessionsPerWeek: number) => { tapped = sessionsPerWeek; },
    onDecline: () => { declines += 1; },
  }) : null;
  ok(
    'the card mounts on the COACH coordinates a flow can find',
    testIDs(card).includes('coach-tab-commitment-card')
      && testIDs(card).includes('coach-tab-commitment-decline'),
    JSON.stringify(testIDs(card)),
  );
  ok(
    'NOTHING HAPPENS BY RENDERING — no handler fired on its own',
    tapped === null && declines === 0,
    'the card answered the question merely by being drawn',
  );
  const firstOption = conversation?.options[0]?.sessionsPerWeek ?? -1;
  ok(
    'tapping an option hands the handler the count the athlete chose',
    tap(card, `coach-tab-commitment-option-${firstOption}`) && tapped === firstOption,
    `tapped=${String(tapped)} expected=${firstOption}`,
  );
  ok(
    'tapping decline calls the decline and nothing else',
    tap(card, 'coach-tab-commitment-decline')
      && declines === 1 && tapped === firstOption,
    `declines=${declines}`,
  );

  /* ═════════════════════════════════════════════════════════════════════════ */
  console.log('\n[5] DECLINE — it changes nothing, it persists, and it stops the asking');

  const beforeDecline = prescriptionsOf(useProgramStore.getState().currentProgram);
  quiet(() => declineWeeklyCommitment({ forBlockNumber: conversation!.forBlockNumber }));
  ok(
    'the decline is on the decision ledger, filed against the block that ENDED',
    useDecisionLedgerStore.getState().entries.some((entry) =>
      entry.decision.kind === 'weekly_commitment_answer'
      && entry.decision.forBlockNumber === conversation!.forBlockNumber
      && entry.decision.answer.kind === 'declined'),
    JSON.stringify(useDecisionLedgerStore.getState().entries.map((e) => e.decision.kind)),
  );
  ok(
    'DECLINING MOVES NO PRESCRIPTION — every set, rep and load is identical',
    prescriptionsOf(useProgramStore.getState().currentProgram) === beforeDecline,
    'declining changed the program',
  );
  ok(
    'AND THE COACH DOES NOT ASK AGAIN ON THE NEXT VISIT',
    coachConversation().value === null,
    'the athlete is asked a question they have already answered',
  );
  ok(
    'and it says which gate closed — answered, not "no reason"',
    JSON.stringify(coachConversation().refusal ?? '')
      .includes('already_answered_for_this_block'),
    JSON.stringify(coachConversation().refusal),
  );
  ok(
    'AND THE NOTIFICATION GOES OFF WITH IT — there is no flag left to clear',
    coachCommitmentNotification(coachConversation()) === false,
    'the coach tab still advertises a question the athlete has answered',
  );
  ok(
    'the coach\'s reply to a decline claims nothing happened, because nothing did',
    /left your week as it is/i.test(String(commitmentDeclinedSentence())),
    String(commitmentDeclinedSentence()),
  );

  /* ═════════════════════════════════════════════════════════════════════════ */
  console.log('\n[6] CLOSE AND REOPEN — the outcome survives a real process death');

  const relaunch = await relaunchApp({ storage: localStorageData, todayISO: blockTwoStart });
  ok('the app relaunched', relaunch.ok, String(relaunch.error));
  followTheWeek(blockTwoStart);
  ok(
    'THE DECLINE SURVIVED — the coach still does not ask',
    coachConversation().value === null,
    'a relaunch re-asked a question the athlete had already answered',
  );

  /* ═════════════════════════════════════════════════════════════════════════ */
  console.log('\n[7] ACCEPT — and the accepted program IS the previewed one');

  // A CLEAN WORLD FOR THE ACCEPTANCE, because the decline above is a recorded
  // answer and the derivation correctly refuses to ask twice.
  useDecisionLedgerStore.setState({ entries: [] } as never);
  const second = coachConversation();
  ok(
    'clearing the answer brings the same question back — it was DERIVED, not stored',
    second.value !== null,
    `refusal = ${JSON.stringify(second.refusal)}`,
  );
  const offer = second.value as CommitmentConversation;
  const previewedProgram = offer?.preview
    // The preview's own program is not carried on the model — it is re-derived
    // here from the SAME builder, which is the property under test.
    ? prescriptionsOf(previewedCandidate(offer))
    : '';
  const chosen = offer?.options[0]?.sessionsPerWeek ?? -1;

  // THE WEEK THE ATHLETE WAS LOOKING AT WHEN THEY WERE SHOWN THE PREVIEW.
  // Captured rather than re-read, because the whole claim under test is a
  // comparison and a comparison whose "before" is fetched afterwards is not one.
  const programBeforeAccepting = useProgramStore.getState().currentProgram;
  const result = await quietAsync(() => confirmWeeklyCommitment({
    forBlockNumber: offer.forBlockNumber,
    sessionsPerWeek: chosen,
    profile: useProfileStore.getState().onboardingData,
    todayISO: blockTwoStart,
    availableDays: availableDaysNow(),
    sourceSurface: 'extra_session_offer',
  }));
  ok(
    'the acceptance went through the canonical accepted-program transaction',
    result.ok === true && result.changedProgram === true,
    `ok=${result.ok} changedProgram=${result.changedProgram} reason=${result.reason}`,
  );
  ok(
    'the ledger records what the DOOR committed, not what was tapped',
    useDecisionLedgerStore.getState().entries.some((entry) =>
      entry.decision.kind === 'weekly_commitment_answer'
      && entry.decision.answer.kind === 'confirmed'
      && entry.decision.answer.sessionsPerWeek === chosen),
    JSON.stringify(result.committed),
  );
  ok(
    'the coach\'s confirmation speaks the count the door committed',
    String(commitmentConfirmedSentence(result.committed?.sessionsPerWeek ?? -1))
      .includes(String(result.committed?.sessionsPerWeek)),
    String(commitmentConfirmedSentence(result.committed?.sessionsPerWeek ?? -1)),
  );

  const acceptedProgram = prescriptionsOf(useProgramStore.getState().currentProgram);
  /**
   * ⚠ **THE COMPARISON IS THE PREVIEW'S OWN CLAIMS AGAINST WHAT ARRIVED, AND
   * THAT IS STRICTER THAN IT SOUNDS.** `commitmentChangePreview` is run a second
   * time here — same function, same `current` week the athlete was looking at,
   * but with the ACCEPTED program as the candidate. If what the athlete was
   * shown differs from what landed in any day, any arrival, any component or any
   * session name, these two lists differ and this cell reds.
   *
   * ⚠ **AND IT IS NOT A PRESCRIPTION-FOR-PRESCRIPTION COMPARISON, BECAUSE THAT
   * ONE IS MEASURABLY IMPOSSIBLE — SEE THE FINDING BELOW.** A profile change
   * regenerates TWICE: measured on this athlete, the program that lands is
   * reproduced EXACTLY by re-running the same builder AFTER acceptance (whose
   * `previousProgram` is then the first build), and differs from the same
   * builder run BEFORE in 60 of 90 loads. `weightOverrides` are byte-identical
   * across the transaction, so the sweep is not the cause. The DAY SET is
   * identical either way — `["d1","d2","d3","d4","d6"]` before and after — which
   * is why the preview claims structure and does not claim loads.
   */
  const actualChange = commitmentChangePreview({
    current: programBeforeAccepting,
    candidate: useProgramStore.getState().currentProgram,
    todayISO: blockTwoStart,
  });
  ok(
    'WHAT THE ATHLETE WAS SHOWN IS WHAT ARRIVED — day for day, component for component',
    JSON.stringify(actualChange.value?.changedDays ?? null)
      === JSON.stringify(offer.preview?.changedDays ?? undefined),
    `\n      shown:    ${JSON.stringify(offer.preview?.changedDays)}`
    + `\n      arrived:  ${JSON.stringify(actualChange.value?.changedDays)}`,
  );
  ok(
    'and the accepted week really carries the previewed day',
    (offer.preview?.changedDays ?? []).every((day) =>
      prescriptionsOf(useProgramStore.getState().currentProgram)
        .includes(`:d${weekdayIndex(day.dateISO)}:`)),
    JSON.stringify((offer.preview?.changedDays ?? []).map((day) => day.dateISO)),
  );

  // ── THE DISCLOSED MEASUREMENT, PRINTED RATHER THAN ASSERTED ──
  // A number in a report has to come from a run. This is that run.
  {
    const shown = previewedProgram.split('|');
    const arrived = prescriptionsOf(useProgramStore.getState().currentProgram).split('|');
    let differing = 0;
    for (let index = 0; index < arrived.length; index += 1) {
      if (shown[index] !== arrived[index]) differing += 1;
    }
    console.log(`    MEASURED: ${differing} of ${arrived.length} prescriptions differ`
      + ' between a pre-acceptance build and the delivered program (loads only;'
      + ' the day set is identical). Cause: the profile change regenerates twice.');
  }

  /* ═════════════════════════════════════════════════════════════════════════ */
  console.log('\n[8] NO MEDICAL ESCALATION CAN COME OUT OF THIS CONVERSATION');

  // R-108 — the keyword/escalation authority is DELETED and stays deleted. This
  // is not a re-test of `test:injury-guard`; it is the new surface's own arm:
  // the words this conversation can produce, checked against the vocabulary that
  // ruling removed.
  const everySentence = [
    String(commitmentConversationNoticeSentence()),
    String(offer.sentence),
    ...offer.options.map((option) => String(option.label)),
    String(offer.declineLabel),
    String(commitmentDeclinedSentence()),
    String(commitmentConfirmedSentence(3)),
    ...(offer.preview?.changedDays ?? []).map((day) => String(commitmentPreviewDaySentence(day))),
  ];
  ok(
    'no sentence this conversation can produce carries medical instruction',
    everySentence.every((sentence) =>
      !/emergency services|physio|medical|stop training now|do not run/i.test(sentence)),
    JSON.stringify(everySentence.filter((sentence) =>
      /emergency|physio|medical/i.test(sentence))),
  );
  ok(
    'CONTROL — the detector really fires on the words R-108 deleted',
    /emergency services|physio/i.test('call emergency services if symptoms are severe')
      && /physio/i.test('needs a physio or medical assessment'),
    'the cell above passes because it cannot see anything, not because nothing is there',
  );
  const coachScreen = source('src/screens/coach/CoachTabScreen.tsx');
  ok(
    'and the coach tab reaches no keyword detector',
    !/detectRedFlagSymptoms|RED_FLAG/.test(coachScreen),
    'the deleted keyword authority has a caller again',
  );

  /* ═════════════════════════════════════════════════════════════════════════ */
  console.log('\n[9] THE COACH AUTHORS NO SECOND PROGRAM');

  const conversationModule = source('src/rules/weeklyCommitmentConversation.ts');
  const previewModule = source('src/rules/commitmentChangePreview.ts');
  ok(
    'the conversation imports nothing that can build or write a program',
    !/generateProgramLocally|commitAcceptedStateTransaction|useProgramStore/
      .test(conversationModule),
    'the derivation reached a generator or a store directly',
  );
  ok(
    'the preview has no generator import at all — it DIFFS two programs it is handed',
    !/generateProgram|weeklyScheduler|composeWeek/.test(previewModule),
    'the preview can build its own week, which makes it a second author',
  );
  ok(
    'the coach hook reaches exactly the two commitment doors and no third writer',
    /confirmWeeklyCommitment/.test(source('src/screens/coach/useCoachWeeklyCommitment.ts'))
      && /declineWeeklyCommitment/.test(source('src/screens/coach/useCoachWeeklyCommitment.ts'))
      && !/commitAcceptedStateTransaction|applyAdjustmentEvents/
        .test(source('src/screens/coach/useCoachWeeklyCommitment.ts')),
    'the coach hook reaches a writer that is not the commitment door',
  );

  /* ═════════════════════════════════════════════════════════════════════════ */
  console.log('\n[10] AN OFFER THE SCHEDULER WOULD NOT KEEP IS NOT PUT AT ALL');

  /**
   * ⚠ **A SECOND REAL ATHLETE, COLD-STARTED AND WALKED — NOT THE FIRST ONE'S
   * WORLD WITH A DIFFERENT PROFILE OBJECT.** The first cut of this section did
   * exactly that and the instrument was worthless: it compared an off-season
   * athlete's stored program against a candidate built for an in-season one, so
   * everything differed and the gate never fired. A world is a world.
   *
   * THIS ATHLETE IS THE ONE THE FINDING IS ABOUT: in-season, Saturday game, club
   * Tuesday and Thursday, gym Monday/Wednesday/Friday — the shape Sam calls real
   * and the one `completeAthleteJourneyTests` walks. Every gate on the offer
   * opens for them: the block qualifies, they answer everything easy, Sunday is
   * free, and `commitmentLegalityProbe` says a four-day commitment builds.
   *
   * **AND GENERATION BUILDS THEM THE SAME TWO GYM DAYS EITHER WAY.** Friday is
   * held as G-1, Saturday is the game, Sunday is the day after it. An offer
   * gated on legality alone would promise this athlete a session they never
   * receive, and they would find out by accepting.
   */
  const blockedInstall = await coldStartThroughOnboarding({
    profile: theBlockedAthlete(), installDayISO: INSTALL_DAY,
  });
  ok(
    'the blocked athlete installed a program — the world below is real',
    blockedInstall.onboardingRefusal === null
      && blockedInstall.program.microcycles.length > 0,
    `refusal=${blockedInstall.onboardingRefusal}`,
  );
  for (let offset = 0; offset < 28; offset += 1) {
    const dateISO = addDaysISO(blockedInstall.blockOneStart, offset);
    setJourneyClock(dateISO);
    followTheWeek(dateISO);
    await recordDay(dateISO, {
      record: true, completion: 'full', feeling: 'easy', soreness: 'none',
      difficulty: 2, logWeights: true, conditioningRpe: 3,
    });
  }
  const blockedBlockTwo = addDaysISO(blockedInstall.blockOneStart, 28);
  setJourneyClock(blockedBlockTwo);
  const blockedRollover = rolloverIfDue(blockedBlockTwo);
  followTheWeek(blockedBlockTwo);
  ok(
    'and their block rolled over, so they are standing where the offer is put',
    blockedRollover.fired,
    `refusal=${blockedRollover.refusal}`,
  );

  const blockedAt3 = builtTrainingDays(theBlockedAthlete(), blockedBlockTwo);
  const blockedAt4 = builtTrainingDays(theBlockedAthlete({
    trainingDaysPerWeek: 4,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday', 'Sunday'],
  } as Partial<OnboardingData>), blockedBlockTwo);
  console.log(`    BLOCKED WORLD: asked 3 -> built ${JSON.stringify(blockedAt3)};`
    + ` asked 4 -> built ${JSON.stringify(blockedAt4)}`);
  ok(
    'CONTROL — the blocked world really builds a week, so the cell below is not vacuous',
    blockedAt3.length > 0,
    'the in-season athlete builds nothing at all; this section proves nothing',
  );
  ok(
    'A FOURTH COMMITTED DAY THAT GENERATION WILL NOT PLACE BUILDS THE SAME WEEK',
    JSON.stringify(blockedAt3) === JSON.stringify(blockedAt4),
    'the scheduler did place the fourth day after all — re-measure before claiming it',
  );

  const blockedOutcome = coachConversation();
  console.log(`    BLOCKED WORLD REFUSAL: ${JSON.stringify(blockedOutcome.refusal)}`);
  ok(
    'CONTROL — every CHEAP gate opened for them, so the rebuild is what refuses',
    blockedOutcome.refusal === 'extra_session_rebuild_adds_nothing',
    `got ${JSON.stringify(blockedOutcome.refusal)} — if this names an earlier gate,`
    + ' the world does not reach the gate under test and the cell below is vacuous',
  );
  ok(
    'AND NO OFFER IS PUT — the app does not promise a session it will not deliver',
    blockedOutcome.value === null,
    'the offer was raised for an athlete whose week does not change',
  );

  console.log(`\nCoach weekly reduction: passed=${pass} failures=${fail}`);
  if (failures.length > 0) {
    console.log('\nFAILURES:');
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  totalsPrinted(fail);
}

/** The candidate program the offer's preview was taken from. The same builder. */
function previewedCandidate(conversation: CommitmentConversation): TrainingProgram | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { coachWeeklyCommitmentInputs } = require('../screens/coach/useCoachWeeklyCommitment');
  const store = useProgramStore.getState();
  const inputs = coachWeeklyCommitmentInputs({
    currentProgram: store.currentProgram,
    blockNumber: store.blockState?.blockNumber ?? null,
    blockStartISO: store.blockState?.blockStartDate ?? null,
    sessionFeedback: store.sessionFeedback,
    acceptedBlocks: store.acceptedBlocks ?? {},
    onboardingData: useProfileStore.getState().onboardingData,
    ledgerEntries: useDecisionLedgerStore.getState().entries,
    todayISO: store.blockState?.blockStartDate ?? INSTALL_DAY,
  });
  return quiet(() => inputs.candidateProgramFor(
    conversation.options[0]?.sessionsPerWeek ?? 0,
  )) as TrainingProgram | null;
}

function availableDaysNow(): readonly import('../types/domain').DayOfWeek[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { availableTrainingDays } = require('../rules/extraSessionOffer');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DAYS_OF_WEEK } = require('../rules/gameAnchor');
  return availableTrainingDays({
    profile: useProfileStore.getState().onboardingData,
    weekOrder: DAYS_OF_WEEK,
  });
}

/** The weekday index (0 = Sunday) an ISO date genuinely falls on. The calendar. */
function weekdayIndex(dateISO: string): number {
  const [year, month, day] = dateISO.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The first row where two prescription strings diverge — a diff, not a verdict. */
function firstDifference(left: string, right: string): string {
  const leftRows = left.split('|');
  const rightRows = right.split('|');
  for (let index = 0; index < Math.max(leftRows.length, rightRows.length); index += 1) {
    if (leftRows[index] === rightRows[index]) continue;
    return `\n      FIRST DIFFERENCE at row ${index}:`
      + `\n        preview:  ${leftRows[index] ?? '(absent)'}`
      + `\n        accepted: ${rightRows[index] ?? '(absent)'}`;
  }
  return '';
}

void main();
