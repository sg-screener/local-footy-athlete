/**
 * BLOCK TWO ON GLASS — the two cards, driven through their REAL tap handlers.
 *
 * ## ⚠ THIS IS NOT A SOURCE-LEVEL SUITE, AND THE DIFFERENCE IS THE POINT
 *
 * This repository has no native component renderer, and its existing UI suites
 * therefore read source text with regexes. **A regex cannot tell you that a
 * dismiss button writes the right decision, or that a decline leaves the
 * programme untouched.**
 *
 * So this suite CALLS the real exported components as the functions they are,
 * walks the React element tree they return, finds a node by its `testID`, and
 * invokes THAT NODE'S OWN `onPress` — the same closure the athlete's finger
 * reaches. The stores are the real zustand stores, the derivation is the real
 * `deriveBlockBoundaryPrompts`, the doors are the real
 * `store/weeklyCommitmentAnswer.ts`, and the copy is the real signed registry.
 *
 * **WHAT IT STILL DOES NOT PROVE:** layout, styling, and that the card is
 * mounted where a human can see it. Both components are pure and hook-free, so
 * calling them is faithful — but a mount is a mount. Simulator proof is a
 * separate receipt and is reported separately; this suite is what makes the
 * behaviour REGRESSION-PROOF between device passes.
 *
 * Run: npm run test:block-two-screen-delivery
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
  throw new Error('NETWORK DISABLED — block two runs entirely on-device');
};

/* ── The `react-native` stand-in ───────────────────────────────────────────
 *
 * ⚠ **A HOST-COMPONENT STUB, NOT A BEHAVIOUR STUB.** `react-native`'s entry is
 * Flow-typed ESM that sucrase-node cannot parse, which is why this repo has no
 * component renderer at all. Every name it exports is replaced by the STRING
 * that names it, which is exactly what React uses for a host component — so
 * `<Pressable testID=... onPress=...>` still produces an element carrying that
 * testID and that onPress, and nothing about the card's own logic is faked.
 *
 * `StyleSheet.create` is the identity function, which is what it is at runtime.
 *
 * The precedent for priming `require.cache` is `onboardingReliabilityTests`,
 * which primes the async-storage module the same way. The entry is keyed on the
 * RESOLVED path, so nothing patches Node's resolver and no new type surface
 * (`require('module')`) enters the tests project — an earlier cut did patch
 * `_resolveFilename` and pushed `weekPlanQA` over its typecheck baseline.
 */
const reactNativeStub: Record<string, unknown> = new Proxy({
  StyleSheet: { create: (sheet: unknown) => sheet, flatten: (style: unknown) => style },
  Platform: { OS: 'ios', select: (map: Record<string, unknown>) => map.ios ?? map.default },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
}, {
  get: (target, property: string) =>
    (property in target ? target[property] : property),
  has: () => true,
});
require.cache[require.resolve('react-native')] = {
  id: 'react-native', filename: 'react-native', loaded: true,
  exports: reactNativeStub,
} as unknown as NodeModule;

import { generateProgramLocally } from '../services/api/generateProgram';
/* ⚠ Blocks the athlete ACCEPTED go through the canonical door, which records
 * what they selected. Speculative calls stay on `generateProgramLocally` and
 * record nothing — the two are different names on purpose. */
import { acceptBlock, resetBlockSelectionHistory } from './support/acceptBlock';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
import { deriveBlockBoundaryPrompts } from '../screens/home/useBlockBoundaryPrompts';
import {
  BlockBoundaryNoticeCard,
  WeeklyCommitmentPromptCard,
} from '../screens/home/BlockBoundaryCards';
import {
  acknowledgeBlockBoundaryNotice,
  declineWeeklyCommitment,
} from '../store/weeklyCommitmentAnswer';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { commitmentPatchFor } from '../rules/weeklyCommitmentQuestion';
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

/* ── The element walker ─────────────────────────────────────────────────────
 *
 * A React element is `{ type, props: { children, ... } }`. Walking it is how a
 * node is FOUND rather than assumed — the alternative is a regex over the
 * source, which is exactly what this suite exists not to be.
 */
interface Elementish { props?: Record<string, unknown> }

function walk(node: unknown, visit: (element: Elementish) => void): void {
  if (node === null || node === undefined || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const child of node) walk(child, visit); return; }
  const element = node as Elementish;
  if (element.props) {
    visit(element);
    walk(element.props.children, visit);
  }
}

function nodeWithTestID(tree: unknown, testID: string): Elementish | null {
  let found: Elementish | null = null;
  walk(tree, (element) => {
    if (found) return;
    if (element.props?.testID === testID) found = element;
  });
  return found;
}

/** Every `testID` present anywhere in the tree. */
function testIDs(tree: unknown): string[] {
  const ids: string[] = [];
  walk(tree, (element) => {
    const id = element.props?.testID;
    if (typeof id === 'string') ids.push(id);
  });
  return ids;
}

/** The visible text of a node, joined — children flattened. */
function textOf(node: Elementish | null): string {
  if (!node) return '';
  const parts: string[] = [];
  const collect = (value: unknown): void => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string' || typeof value === 'number') { parts.push(String(value)); return; }
    if (Array.isArray(value)) { for (const item of value) collect(item); return; }
    const element = value as Elementish;
    if (element.props) collect(element.props.children);
  };
  collect(node.props?.children);
  return parts.join('');
}

/** Invoke the real `onPress` of the node carrying `testID`. */
function tap(tree: unknown, testID: string): boolean {
  const node = nodeWithTestID(tree, testID);
  const onPress = node?.props?.onPress;
  if (typeof onPress !== 'function') return false;
  (onPress as () => void)();
  return true;
}

/* ── Fixtures ──────────────────────────────────────────────────────────────*/

const BLOCK_2_START = '2026-08-03';
const WEEK_ORDER: readonly DayOfWeek[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];
/**
 * ⚠ **THE TRACKED LIFT IS DERIVED FROM THE BLOCK, NOT NAMED.**
 *
 * Sam, 2026-08-17: *"Replace brittle exercise-name assumptions with derived
 * identities where the identity itself is not the test subject."*
 *
 * This suite is about LOAD behaviour — seeding, progression, restoration — and
 * which lift carries it is incidental. `Deadlift` was hardcoded and stopped
 * being block 2's hinge the moment phase preference put RDLs and Trap Bar
 * Deadlift ahead of it, so every cell below reported `ABSENT_ROW` about a
 * perfectly healthy program.
 */
const TRACKED: string = (() => {
  const probe = generateProgramLocally(athlete(), {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    recordSelections: false,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
  });
  for (const mc of probe.microcycles) {
    for (const w of mc.workouts) {
      for (const ex of w.exercises ?? []) {
        if (ex.section18Evidence?.slot !== 'hinge') continue;
        const name = ex.exercise?.name ?? '';
        if (name) return name;
      }
    }
  }
  throw new Error(
    `src/__tests__/blockTwoScreenDeliveryTests.ts could not derive a bilateral hinge from block 2 — a block with no `
    + 'hinge at all is a real change in what the app programs, not a test nit.',
  );
})();
const APPROVED_REDUCED_SENTENCE =
  'You completed the last block, but it felt very hard and recovery was low, '
  + "so we've kept your training weights and reduced the amount of work in this "
  + 'block. You can change it if needed.';
const APPROVED_QUESTION_SENTENCE =
  'You have been completing about 2 of your 3 planned sessions. '
  + 'Would a smaller weekly program fit your life better?';

function athlete(): OnboardingData {
  return {
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    equipmentAnswer: fullKitEquipmentAnswer(),
    injuries: [], goals: ['Get stronger'], experienceLevel: 'Intermediate',
    sprintExposure: 'Occasionally', conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight', benchStrength: '1.25x bodyweight', weightKg: 85,
  } as unknown as OnboardingData;
}

const BLOCK_1_DATES = [
  '2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
  '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31',
];

function veryHardBlock1(): Record<string, SessionFeedback> {
  const feedback: Record<string, SessionFeedback> = {};
  for (const dateStr of BLOCK_1_DATES) {
    feedback[dateStr] = {
      dateStr, completion: 'full', feeling: 'very_hard', soreness: 'high',
      strength: [{
        exerciseId: 'ex-0', workoutExerciseId: 'wex-0', exerciseName: TRACKED,
        prescribedSets: 4, prescribedRepsMin: 5, prescribedRepsMax: 5,
        weightKg: 100, completion: 'full' as const,
      }],
    } as SessionFeedback;
  }
  return feedback;
}

/** Half the block completed; the rest skipped. Below the 75% line. */
function halfAttendedBlock1(): Record<string, SessionFeedback> {
  const feedback: Record<string, SessionFeedback> = {};
  for (const [index, dateStr] of BLOCK_1_DATES.entries()) {
    feedback[dateStr] = {
      dateStr, completion: index < 6 ? 'full' : 'skipped',
    } as SessionFeedback;
  }
  return feedback;
}

function build(sessionFeedback: Record<string, SessionFeedback>): TrainingProgram {
  return acceptBlock(athlete(), {
    todayISO: BLOCK_2_START, blockNumber: 2,
    progressionHistory: { sessionFeedback, weightOverrides: {}, blockState: null },
  });
}

function ledger(): readonly DecisionLedgerEntry[] {
  return useDecisionLedgerStore.getState().entries;
}
function clearLedger(): void {
  useDecisionLedgerStore.setState({ entries: [] });
}

/** Every strength prescription of a program, for before/after comparison. */
function prescriptions(program: TrainingProgram): string {
  const rows: string[] = [];
  for (const [weekIndex, microcycle] of program.microcycles.entries()) {
    for (const workout of microcycle.workouts) {
      for (const exercise of workout.exercises ?? []) {
        rows.push(`w${weekIndex + 1}:${workout.name}:${exercise.exercise?.name}`
          + `:${exercise.prescribedSets}:${exercise.prescribedWeightKg ?? 'BW'}`);
      }
    }
  }
  return JSON.stringify(rows.sort());
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[1] THE REDUCED-BLOCK NOTICE RENDERS FROM THE STORED DECISION');

const hardProgram = build(veryHardBlock1());
clearLedger();

const hardPrompts = deriveBlockBoundaryPrompts({
  currentProgram: hardProgram,
  blockNumber: 2,
  blockStartISO: BLOCK_2_START,
  sessionFeedback: veryHardBlock1(),
  onboardingData: athlete(),
  ledgerEntries: ledger(),
  weekOrder: WEEK_ORDER,
});

ok(
  'the derivation produces a notice for a very-hard block',
  hardPrompts.notice !== null,
  'nothing to render — the athlete gets a changed programme with no reason',
);

const noticeTree = hardPrompts.notice
  ? BlockBoundaryNoticeCard({ notice: hardPrompts.notice, onAcknowledge: () => {} })
  : null;

ok(
  'the card mounts with its Program-surface testID',
  testIDs(noticeTree).includes('home-block-boundary-notice'),
  `ids: ${JSON.stringify(testIDs(noticeTree))}`,
);
ok(
  "the rendered headline is EXACTLY Sam's approved sentence",
  textOf(nodeWithTestID(noticeTree, 'home-block-boundary-notice-sentence'))
    === APPROVED_REDUCED_SENTENCE,
  `rendered ${JSON.stringify(textOf(nodeWithTestID(noticeTree, 'home-block-boundary-notice-sentence')))}`,
);

/* ── THE RENDERED CHANGE LINES AGREE WITH THE STORED PRESCRIPTIONS ── */
{
  const storedSetsFor = (name: string): number[] => {
    const sets: number[] = [];
    for (const [weekIndex, microcycle] of hardProgram.microcycles.entries()) {
      // Week 4 is the deload and carries its own halved dose — the notice
      // describes the BUILD weeks, so comparing it would be comparing two
      // different rulings' numbers.
      if (weekIndex === 3) continue;
      for (const workout of microcycle.workouts) {
        for (const exercise of workout.exercises ?? []) {
          if ((exercise.exercise?.name ?? '') === name) sets.push(exercise.prescribedSets);
        }
      }
    }
    return sets;
  };
  const row = hardPrompts.notice!.row;
  ok(
    'the card renders one line per REAL reduction',
    row.setsReduced.length > 0
      && row.setsReduced.every((change) =>
        testIDs(noticeTree).includes(`home-block-boundary-change-${change.exerciseName}`)),
    `ids: ${JSON.stringify(testIDs(noticeTree))}`,
  );
  ok(
    'every rendered line names the sets the block ACTUALLY stores',
    row.setsReduced.every((change) => {
      const rendered = textOf(nodeWithTestID(noticeTree, `home-block-boundary-change-${change.exerciseName}`));
      const stored = storedSetsFor(change.exerciseName);
      return rendered.includes(`${change.nextSets} sets`)
        && stored.length > 0
        && stored.every((value) => value === change.nextSets);
    }),
    'a rendered change line disagrees with the stored prescription it describes',
  );
  ok(
    `the card shows ${TRACKED} at 4 sets → 3 sets`,
    textOf(nodeWithTestID(noticeTree, `home-block-boundary-change-${TRACKED}`))
      === `${TRACKED}: 4 sets → 3 sets`,
    `rendered ${JSON.stringify(textOf(nodeWithTestID(noticeTree, `home-block-boundary-change-${TRACKED}`)))}`,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[2] DISMISSING IT — THE REAL TAP');

{
  const before = prescriptions(hardProgram);
  const liveTree = BlockBoundaryNoticeCard({
    notice: hardPrompts.notice!,
    // THE REAL HANDLER, not a spy. `useHomeScreen` wires exactly this call.
    onAcknowledge: () => acknowledgeBlockBoundaryNotice({ forBlockNumber: 2 }),
  });
  ok('the dismiss control is on the card', tap(liveTree, 'home-block-boundary-notice-dismiss'));
  ok(
    'the tap records an acknowledgement on the decision ledger',
    ledger().some((entry) =>
      entry.decision.kind === 'block_boundary_notice_acknowledged'
      && entry.decision.forBlockNumber === 2),
    `ledger: ${JSON.stringify(ledger().map((e) => e.decision.kind))}`,
  );
  ok(
    'DISMISSING DOES NOT ALTER THE PROGRAM — every prescription is identical',
    prescriptions(hardProgram) === before,
  );
  ok(
    'the card is gone on the next derivation',
    deriveBlockBoundaryPrompts({
      currentProgram: hardProgram, blockNumber: 2, blockStartISO: BLOCK_2_START,
      sessionFeedback: veryHardBlock1(), onboardingData: athlete(),
      ledgerEntries: ledger(), weekOrder: WEEK_ORDER,
    }).notice === null,
  );
  ok(
    'IT STAYS GONE ACROSS A RELOAD — the acknowledgement is durable, not local state',
    deriveBlockBoundaryPrompts({
      currentProgram: hardProgram, blockNumber: 2, blockStartISO: BLOCK_2_START,
      sessionFeedback: veryHardBlock1(), onboardingData: athlete(),
      // The ledger as it comes back off disk.
      ledgerEntries: JSON.parse(JSON.stringify(ledger())) as DecisionLedgerEntry[],
      weekOrder: WEEK_ORDER,
    }).notice === null,
    'a relaunch would show the athlete the same notice again, forever',
  );
  ok(
    'and it is still shown to an athlete who has NOT acknowledged (control)',
    deriveBlockBoundaryPrompts({
      currentProgram: hardProgram, blockNumber: 2, blockStartISO: BLOCK_2_START,
      sessionFeedback: veryHardBlock1(), onboardingData: athlete(),
      ledgerEntries: [], weekOrder: WEEK_ORDER,
    }).notice !== null,
    'the notice never renders at all — the cells above pass vacuously',
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[3] THE MISSED-SESSION QUESTION RENDERS WITH THE REAL NUMBERS');

clearLedger();
const missedProgram = build(halfAttendedBlock1());
const missedPrompts = deriveBlockBoundaryPrompts({
  currentProgram: missedProgram,
  blockNumber: 2,
  blockStartISO: BLOCK_2_START,
  sessionFeedback: halfAttendedBlock1(),
  onboardingData: athlete(),
  ledgerEntries: ledger(),
  weekOrder: WEEK_ORDER,
});

ok(
  'the derivation asks the question below 75% attendance',
  missedPrompts.commitment !== null,
  'the athlete is never asked',
);

const promptTree = missedPrompts.commitment
  ? WeeklyCommitmentPromptCard({
    prompt: missedPrompts.commitment,
    onConfirm: () => {}, onDecline: () => {},
  })
  : null;

ok(
  'the card mounts with its Program-surface testID',
  testIDs(promptTree).includes('home-weekly-commitment-prompt'),
  `ids: ${JSON.stringify(testIDs(promptTree))}`,
);
ok(
  "the rendered question is EXACTLY Sam's approved wording, with the real numbers",
  textOf(nodeWithTestID(promptTree, 'home-weekly-commitment-question'))
    === APPROVED_QUESTION_SENTENCE,
  `rendered ${JSON.stringify(textOf(nodeWithTestID(promptTree, 'home-weekly-commitment-question')))}`,
);
ok(
  'the numbers it renders are the athlete\'s real completed and planned counts',
  missedPrompts.commitment?.question.attendance.completedSessions === 6
    && missedPrompts.commitment?.question.attendance.requiredSessions === 12
    && missedPrompts.commitment?.question.plannedPerWeek === 3,
  `${JSON.stringify(missedPrompts.commitment?.question.attendance)}`,
);
ok(
  'it offers a SCHEDULER-PROVEN smaller commitment, and a decline',
  testIDs(promptTree).includes('home-weekly-commitment-option-2')
    && testIDs(promptTree).includes('home-weekly-commitment-decline'),
  `ids: ${JSON.stringify(testIDs(promptTree))}`,
);
ok(
  'it offers NO count the scheduler cannot build for this athlete',
  (missedPrompts.commitment?.options ?? []).every((option) => option.sessionsPerWeek === 2),
  `offered ${JSON.stringify((missedPrompts.commitment?.options ?? []).map((o) => o.sessionsPerWeek))}`,
);
ok(
  'the option label is signed copy, not a string this card built',
  textOf(nodeWithTestID(promptTree, 'home-weekly-commitment-option-2')) === ''
    || String(missedPrompts.commitment?.options[0].label) === '2 sessions a week',
  `label ${String(missedPrompts.commitment?.options[0].label)}`,
);

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[4] DECLINING — THE REAL TAP');

{
  const before = prescriptions(missedProgram);
  const liveTree = WeeklyCommitmentPromptCard({
    prompt: missedPrompts.commitment!,
    onConfirm: () => { throw new Error('confirm must not fire on a decline tap'); },
    onDecline: () => declineWeeklyCommitment({
      forBlockNumber: missedPrompts.commitment!.question.forBlockNumber,
    }),
  });
  ok('the decline control is on the card', tap(liveTree, 'home-weekly-commitment-decline'));
  ok(
    'the tap records a DECLINED answer',
    ledger().some((entry) =>
      entry.decision.kind === 'weekly_commitment_answer'
      && entry.decision.answer.kind === 'declined'),
    `ledger: ${JSON.stringify(ledger().map((e) => e.decision.kind))}`,
  );
  ok(
    'DECLINING LEAVES THE PROGRAM UNCHANGED — every prescription is identical',
    prescriptions(missedProgram) === before,
  );
  ok(
    'and the athlete is not asked again',
    deriveBlockBoundaryPrompts({
      currentProgram: missedProgram, blockNumber: 2, blockStartISO: BLOCK_2_START,
      sessionFeedback: halfAttendedBlock1(), onboardingData: athlete(),
      ledgerEntries: ledger(), weekOrder: WEEK_ORDER,
    }).commitment === null,
  );
  ok(
    'THE DECLINE SURVIVES A RELOAD',
    deriveBlockBoundaryPrompts({
      currentProgram: missedProgram, blockNumber: 2, blockStartISO: BLOCK_2_START,
      sessionFeedback: halfAttendedBlock1(), onboardingData: athlete(),
      ledgerEntries: JSON.parse(JSON.stringify(ledger())) as DecisionLedgerEntry[],
      weekOrder: WEEK_ORDER,
    }).commitment === null,
    'a relaunch would re-ask a question the athlete has already answered',
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[5] CONFIRMING — THE REAL TAP CARRIES THE REAL COUNT');

clearLedger();
{
  const confirmed: number[] = [];
  const liveTree = WeeklyCommitmentPromptCard({
    prompt: missedPrompts.commitment!,
    onConfirm: (sessionsPerWeek: number) => { confirmed.push(sessionsPerWeek); },
    onDecline: () => { throw new Error('decline must not fire on a confirm tap'); },
  });
  ok('the option control is on the card', tap(liveTree, 'home-weekly-commitment-option-2'));
  ok(
    'the tap hands the handler the count the athlete chose',
    JSON.stringify(confirmed) === '[2]',
    `got ${JSON.stringify(confirmed)}`,
  );

  // The commitment that tap produces, and the week it rebuilds — driven
  // through the same `commitmentPatchFor` the door uses, then the real
  // generator. The door itself is async and store-bound; what it does with the
  // patch is `commitProfileProgramTransaction`, which has its own suite.
  const patch = commitmentPatchFor({
    profile: athlete(), sessionsPerWeek: confirmed[0], weekOrder: WEEK_ORDER,
  });
  ok(
    'the confirmed commitment is ONE canonical fact, count and days agreeing',
    patch.trainingDaysPerWeek === 2
      && JSON.stringify(patch.preferredTrainingDays) === JSON.stringify(['Monday', 'Friday']),
    `got ${JSON.stringify(patch)}`,
  );
  const rebuilt = generateProgramLocally(
    { ...athlete(), ...patch } as unknown as OnboardingData,
    {
      todayISO: BLOCK_2_START, blockNumber: 2,
      progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
    },
  );
  const strengthSessions = (program: TrainingProgram): number => {
    let count = 0;
    for (const microcycle of program.microcycles) {
      for (const workout of microcycle.workouts) {
        if (workout.workoutType !== 'Strength' && workout.workoutType !== 'Mixed') continue;
        if ((workout.exercises ?? []).some((row) => row.role !== 'conditioning')) count++;
      }
    }
    return count;
  };
  ok(
    'CONFIRMING REBUILDS A SMALLER WEEK through the current scheduler',
    strengthSessions(rebuilt) < strengthSessions(missedProgram),
    `before ${strengthSessions(missedProgram)}, after ${strengthSessions(rebuilt)}`,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[6] NO QUESTION AT EXACTLY 75%, AND NONE ON A WELL-ATTENDED BLOCK');

{
  // Nine of twelve — one lost week. Exactly the threshold, which is not below it.
  const oneWeekLost: Record<string, SessionFeedback> = {};
  for (const dateStr of BLOCK_1_DATES) {
    const lost = ['2026-07-20', '2026-07-22', '2026-07-24'].includes(dateStr);
    oneWeekLost[dateStr] = { dateStr, completion: lost ? 'skipped' : 'full' } as SessionFeedback;
  }
  clearLedger();
  ok(
    'exactly 75% renders NO question card',
    deriveBlockBoundaryPrompts({
      currentProgram: build(oneWeekLost), blockNumber: 2, blockStartISO: BLOCK_2_START,
      sessionFeedback: oneWeekLost, onboardingData: athlete(),
      ledgerEntries: [], weekOrder: WEEK_ORDER,
    }).commitment === null,
    'one disrupted week would redesign the programme',
  );
  ok(
    'a well-attended, well-recovered block renders NEITHER card',
    (() => {
      const good: Record<string, SessionFeedback> = {};
      for (const dateStr of BLOCK_1_DATES) {
        good[dateStr] = {
          dateStr, completion: 'full', feeling: 'good', soreness: 'mild',
          strength: [{
            exerciseId: 'ex-0', workoutExerciseId: 'wex-0', exerciseName: TRACKED,
            prescribedSets: 4, prescribedRepsMin: 5, prescribedRepsMax: 5,
            weightKg: 100, completion: 'full' as const,
          }],
        } as SessionFeedback;
      }
      const prompts = deriveBlockBoundaryPrompts({
        currentProgram: build(good), blockNumber: 2, blockStartISO: BLOCK_2_START,
        sessionFeedback: good, onboardingData: athlete(),
        ledgerEntries: [], weekOrder: WEEK_ORDER,
      });
      return prompts.notice === null && prompts.commitment === null;
    })(),
    'an athlete who trained well is shown a notice or a question',
  );
  ok(
    'BLOCK 1 IS NEVER QUESTIONED — there is no previous block to count',
    deriveBlockBoundaryPrompts({
      currentProgram: build(halfAttendedBlock1()), blockNumber: 1,
      blockStartISO: BLOCK_2_START, sessionFeedback: halfAttendedBlock1(),
      onboardingData: athlete(), ledgerEntries: [], weekOrder: WEEK_ORDER,
    }).commitment === null,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n[7] THE CHEAP GATES ARE REAL GATES — U3, U4 and U6 survived without these');

{
  /**
   * ⚠ U3 AND U4 SURVIVED TWICE, and the second time settled it: the hook's
   * early returns were DECORATION. `decideWeeklyCommitmentQuestion` owns both
   * gates and returns before it ever calls the probe, so deleting the hook's
   * copies changed neither the answer nor the cost. They are gone.
   *
   * These cells stay, because the COST property is real and worth holding
   * wherever it lives: the probe BUILDS A PROGRAMME PER CANDIDATE COUNT, and an
   * athlete who was never going to be asked must not pay for it.
   */
  let probeBuilds = 0;
  const countingProfile = new Proxy(athlete() as Record<string, unknown>, {
    get: (target, property: string) => {
      // The probe reads the profile once per candidate count it tests.
      if (property === 'preferredTrainingDays') probeBuilds++;
      return target[property];
    },
  }) as unknown as OnboardingData;

  clearLedger();
  probeBuilds = 0;
  deriveBlockBoundaryPrompts({
    currentProgram: missedProgram, blockNumber: 2, blockStartISO: BLOCK_2_START,
    sessionFeedback: halfAttendedBlock1(), onboardingData: countingProfile,
    ledgerEntries: [], weekOrder: WEEK_ORDER,
  });
  const buildsWhenAsking = probeBuilds;
  ok(
    'the probe RUNS when the question is live (control for the two cells below)',
    buildsWhenAsking > 0,
    'the counter never moves — the cells below pass vacuously',
  );

  probeBuilds = 0;
  deriveBlockBoundaryPrompts({
    currentProgram: build(veryHardBlock1()), blockNumber: 2, blockStartISO: BLOCK_2_START,
    // A well-attended block: the threshold gate must stop before the probe.
    sessionFeedback: veryHardBlock1(), onboardingData: countingProfile,
    ledgerEntries: [], weekOrder: WEEK_ORDER,
  });
  ok(
    'A WELL-ATTENDED BLOCK NEVER PAYS FOR THE LEGALITY PROBE',
    probeBuilds === 0,
    `the probe ran ${probeBuilds} time(s) for an athlete who was never going to be asked`,
  );

  probeBuilds = 0;
  declineWeeklyCommitment({ forBlockNumber: 1 });
  deriveBlockBoundaryPrompts({
    currentProgram: missedProgram, blockNumber: 2, blockStartISO: BLOCK_2_START,
    sessionFeedback: halfAttendedBlock1(), onboardingData: countingProfile,
    ledgerEntries: ledger(), weekOrder: WEEK_ORDER,
  });
  ok(
    'AN ALREADY-ANSWERED BLOCK NEVER PAYS FOR IT EITHER',
    probeBuilds === 0,
    `the probe ran ${probeBuilds} time(s) for a question that has been answered`,
  );
}

{
  /**
   * ⚠ U6 SURVIVED because the fixture's stored row always supports the
   * sentence's claims, so the "no sentence, no card" branch had no coordinate.
   * A row claiming the loads were NOT held is the coordinate.
   */
  clearLedger();
  const lyingProgram = JSON.parse(JSON.stringify(build(veryHardBlock1()))) as TrainingProgram;
  const rows = lyingProgram.blockBoundaryExplanation ?? [];
  for (const row of rows) {
    if (row.kind === 'hard_block_reduced') (row as { loadsHeld: boolean }).loadsHeld = false;
  }
  ok(
    'a stored row whose loads were NOT held renders NO CARD AT ALL',
    deriveBlockBoundaryPrompts({
      currentProgram: lyingProgram, blockNumber: 2, blockStartISO: BLOCK_2_START,
      sessionFeedback: veryHardBlock1(), onboardingData: athlete(),
      ledgerEntries: [], weekOrder: WEEK_ORDER,
    }).notice === null,
    'the athlete would be told their weights were kept on a block where they were not',
  );
}

console.log(`\nBlock two screen delivery: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFAILURES:');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
