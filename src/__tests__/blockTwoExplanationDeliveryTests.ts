/**
 * THE BLOCK-BOUNDARY EXPLANATION, ON A REAL ATHLETE, THROUGH THE REAL READ PATH.
 *
 * Sam, 2026-08-17: *"Close the one admitted projection gap: build a real Block 1
 * athlete, record the required completion/recovery history, roll into Block 2,
 * and verify the actual athlete-facing program shows the stored load-increase
 * explanation with the correct exercise and old/new weights."*
 *
 * ## THE GAP THIS CLOSES, STATED EXACTLY
 *
 * `athleteVisibleProjectionTests` proved the CARRIER — `project()` returns a
 * sentence when handed a program with a stored explanation row — with a
 * hand-built row, and said in its own comment that a fixture does not replace a
 * real Block Two world. And `blockTwoProgressionTests` [11]/[12] proved the
 * other end: a real rollover STORES the explanation and
 * `blockBoundaryExplanationSentences` renders it.
 *
 * **Neither one crossed the middle.** No test built a real block boundary and
 * then asked the ATHLETE-FACING READ CHAIN what it shows. That chain is
 * `buildProgramTabProjectedWeek` -> `project()`, the same two calls
 * `useSchedule.projectWeekFor` makes, and the explanation could have been
 * dropped anywhere along it while both existing suites stayed green.
 *
 * ## WHAT IS REAL HERE, AND WHAT IS NOT
 *
 * REAL: the athlete profile, block 1 generated and its selections recorded, a
 * full block of recorded completion and recovery history, block 2 generated
 * FROM that history by the app's own generator, the resolver, and the
 * projection. Nothing about the explanation is hand-written.
 *
 * NOT REAL, and it does not need to be: the twelve session-feedback records are
 * constructed rather than tapped in on a phone. They are the STORED SHAPE the
 * logging screen writes (`SessionFeedback`), which is the input the progression
 * reads — the same shape `blockTwoProgressionTests` uses.
 *
 * ## RESTART
 *
 * Two different things could be meant by "survives restart", and this suite
 * proves BOTH rather than picking the convenient one:
 *
 *   1. **The stored program is serialised and read back.** The explanation must
 *      survive JSON round-trip and re-project identically.
 *   2. **The program is REGENERATED from the same stored inputs**, which is what
 *      this app actually does on boot. Generating block 2 again from the same
 *      profile and the same history must produce the same explanation and the
 *      same sentence.
 *
 * Run: npm run test:block-two-explanation-delivery
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
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
  throw new Error('NETWORK DISABLED');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing; only the report clears it.
armTotalsOrRed();

import { acceptBlock, resetBlockSelectionHistory } from './support/acceptBlock';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
import { generateProgramLocally } from '../services/api/generateProgram';
import { buildProgramTabProjectedWeek } from '../utils/visibleProgramReadModel';
import { project } from '../rules/projectVisibleWeek';
import { blockBoundaryExplanationSentences } from '../rules/projectionCopy';
import { isLoadExplanationRow } from '../rules/blockBoundaryProgression';
import { scheduleStateFor } from '../../scripts/print-week';
import type { SessionFeedback } from '../store/programStore';
import type { OnboardingData, TrainingProgram } from '../types/domain';

let pass = 0; let fail = 0; const failures: string[] = [];
function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) { pass += 1; console.log(`  PASS ${name}`); }
  else { fail += 1; failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}
function quiet<T>(b: () => T): T {
  const w = console.warn, e = console.error, d = console.debug, i = console.info, l = console.log;
  console.warn = console.error = console.debug = console.info = console.log = (() => undefined) as never;
  try { return b(); } finally { console.warn = w; console.error = e; console.debug = d; console.info = i; console.log = l; }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE ATHLETE, AND THEIR RECORDED BLOCK 1
// ═══════════════════════════════════════════════════════════════════════════

const BLOCK_1_START = '2026-07-06';
const BLOCK_2_START = '2026-08-03';

/** Every training date of block 1 — three sessions a week for four weeks. */
const BLOCK_1_DATES = [
  '2026-07-06', '2026-07-08', '2026-07-10', '2026-07-13', '2026-07-15', '2026-07-17',
  '2026-07-20', '2026-07-22', '2026-07-24', '2026-07-27', '2026-07-29', '2026-07-31',
];

const RECORDED_KG = 100;

function athlete(): OnboardingData {
  return {
    firstName: 'Sam',
    ageRange: '22-26',
    position: 'Midfielder',
    heightCm: 183,
    seasonPhase: 'Pre-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 2,
    teamTrainingDays: ['Tuesday', 'Thursday'],
    teamTrainingDuration: '90 minutes',
    teamTrainingIntensity: 'Hard',
    equipmentAnswer: fullKitEquipmentAnswer(),
    injuries: [],
    goals: ['Get stronger'],
    experienceLevel: 'Intermediate',
    sprintExposure: 'Occasionally',
    conditioningLevel: 'Good',
    recentTrainingLoad: 'Pretty consistent',
    squatStrength: '1.5x bodyweight',
    benchStrength: '1.25x bodyweight',
    twoKmTimeTrial: { seconds: 420, testedOn: '2026-06-20' },
    weightKg: 85,
  } as unknown as OnboardingData;
}

/**
 * THE TRACKED LIFT IS DERIVED FROM THE BLOCK, NEVER NAMED.
 *
 * Sam, 2026-08-17: *"Replace brittle exercise-name assumptions with derived
 * identities where the identity itself is not the test subject."* The subject
 * here is DELIVERY of an explanation; which lift carries it is incidental, and
 * a hardcoded `Deadlift` silently stopped being block 2's hinge once phase
 * preference put RDLs ahead of it — the exact trap `blockTwoProgressionTests`
 * records having fallen into.
 */
const TRACKED: string = quiet(() => {
  const probe = generateProgramLocally(athlete(), {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    recordSelections: false,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
  } as never) as TrainingProgram;
  for (const mc of probe.microcycles) {
    for (const w of mc.workouts) {
      for (const ex of w.exercises ?? []) {
        if ((ex as any).section18Evidence?.slot !== 'hinge') continue;
        const name = ex.exercise?.name ?? '';
        if (name) return name;
      }
    }
  }
  throw new Error('no bilateral hinge in block 2 — a real change in what the app programs');
});

/**
 * A FULL BLOCK OF COMPLETION AND RECOVERY, WHICH IS WHAT PROGRESSION REQUIRES.
 *
 * `completion: 'full'` and `feeling: 'good'` are the two the boundary reads: it
 * moves load only when the athlete both DID the work and RECOVERED from it. An
 * athlete who did neither gets no increase, which is the control below.
 */
function historyFor(loads: Record<string, number>, overrides: Partial<SessionFeedback> = {}): Record<string, SessionFeedback> {
  const feedback: Record<string, SessionFeedback> = {};
  for (const dateStr of BLOCK_1_DATES) {
    feedback[dateStr] = {
      dateStr,
      completion: 'full',
      feeling: 'good',
      soreness: 'mild',
      strength: Object.keys(loads).map((exerciseName, i) => ({
        exerciseId: `ex-${i}`,
        workoutExerciseId: `wex-${i}`,
        exerciseName,
        prescribedSets: 3,
        prescribedRepsMin: 5,
        prescribedRepsMax: 5,
        weightKg: loads[exerciseName],
        completion: 'full' as const,
      })),
      ...overrides,
    } as SessionFeedback;
  }
  return feedback;
}

console.log('\n-- Block two explanation delivery --');
console.log(`  tracked lift, derived from the block: ${TRACKED}`);

// ═══════════════════════════════════════════════════════════════════════════
// THE ROLLOVER — block 1 accepted, history recorded, block 2 built from it
// ═══════════════════════════════════════════════════════════════════════════

const history = historyFor({ [TRACKED]: RECORDED_KG });

const block2 = quiet(() => {
  resetBlockSelectionHistory();
  // BLOCK 1 IS GENERATED AND ITS SELECTIONS RECORDED, not skipped. The rollover
  // is only real if block 2 is the SECOND block this athlete has been given —
  // `recordSelections: true` is what makes the block-two path the live one.
  acceptBlock(athlete(), {
    todayISO: BLOCK_1_START,
    blockNumber: 1,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
  } as never);
  return acceptBlock(athlete(), {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    progressionHistory: { sessionFeedback: history, weightOverrides: {}, blockState: null },
  } as never);
});

const storedRow = (block2.blockBoundaryExplanation ?? [])
  .filter(isLoadExplanationRow)
  .find((row) => row.exerciseName === TRACKED);

ok(
  'a real block-1 -> block-2 rollover STORES a load-increase explanation for the tracked lift',
  storedRow?.kind === 'history_progressed'
    && typeof storedRow.previousLoadKg === 'number'
    && typeof storedRow.nextLoadKg === 'number'
    && storedRow.nextLoadKg > storedRow.previousLoadKg,
  `got ${JSON.stringify(storedRow)} — without a stored row every cell below is vacuous`,
);

const PREVIOUS_KG = storedRow?.previousLoadKg as number;
const NEXT_KG = storedRow?.nextLoadKg as number;

ok(
  `the stored explanation starts from the athlete's OWN recorded ${RECORDED_KG}kg`,
  PREVIOUS_KG === RECORDED_KG,
  `the boundary explained a move from ${PREVIOUS_KG}kg, which is not what the athlete lifted`,
);

// ═══════════════════════════════════════════════════════════════════════════
// THE ATHLETE-FACING READ PATH — the middle nobody had crossed
// ═══════════════════════════════════════════════════════════════════════════

/** `useSchedule.projectWeekFor`'s two calls, in order, on a real program. */
function projectRealWeek(program: TrainingProgram) {
  const weekDays = buildProgramTabProjectedWeek({
    mondayISO: BLOCK_2_START,
    todayISO: BLOCK_2_START,
    state: scheduleStateFor({
      profile: athlete(),
      program,
      todayISO: BLOCK_2_START,
      activeConstraints: [],
      temporarySourceFacts: [],
      markedDays: {},
    }) as never,
    overrideContexts: {},
    modalityPreferences: {},
  });
  return project({ week: weekDays, weekStart: BLOCK_2_START, program });
}

const visible = quiet(() => projectRealWeek(block2));
const shown = visible.explanations.map(String);

console.log(`  what the athlete is shown: ${JSON.stringify(shown)}`);

ok(
  'THE ATHLETE-FACING WEEK SHOWS THE EXPLANATION — the read path delivers it',
  shown.length > 0,
  'the program stored an explanation and the projection the app actually reads showed '
  + 'the athlete nothing. This is the delivery break the receipt exists to catch.',
);

const line = shown.find((text) => text.includes(TRACKED));

ok(
  `the visible sentence names the right exercise (${TRACKED})`,
  typeof line === 'string',
  `no shown line mentions ${TRACKED}; shown: ${JSON.stringify(shown)}`,
);

ok(
  `the visible sentence carries the OLD weight (${PREVIOUS_KG} kg)`,
  typeof line === 'string' && line.includes(`${PREVIOUS_KG} kg`),
  `got "${line}"`,
);

ok(
  `the visible sentence carries the NEW weight (${NEXT_KG} kg)`,
  typeof line === 'string' && line.includes(`${NEXT_KG} kg`),
  `got "${line}"`,
);

/**
 * AGREEMENT WITH STORAGE IS A SET EQUALITY, NOT A LIST EQUALITY — and the
 * difference is a defect this receipt FOUND.
 *
 * `blockBoundaryExplanation` stores one row PER OCCURRENCE of the lift across
 * the block, so a lift programmed on four days stored four identical rows and
 * the athlete was shown the same sentence four times. The storage is right; the
 * reading was not. `project()` now says each distinct sentence once.
 *
 * So the claim is: every sentence the storage renders is shown, nothing else is
 * shown, and nothing is shown twice. That is stronger than the list comparison
 * it replaces, which passed while the athlete read the same line four times.
 */
const storedRendered = blockBoundaryExplanationSentences(block2).map(String);

ok(
  'every sentence the stored explanation renders is shown, and nothing else is',
  JSON.stringify([...new Set(shown)].sort()) === JSON.stringify([...new Set(storedRendered)].sort()),
  `visible ${JSON.stringify(shown)} vs stored ${JSON.stringify(storedRendered)}`,
);

ok(
  'ONE DECISION IS SAID ONCE — the athlete never reads the same sentence twice',
  shown.length === new Set(shown).size,
  `${shown.length} lines but only ${new Set(shown).size} distinct: ${JSON.stringify(shown)}`,
);

ok(
  `the tracked lift's change is stated exactly once`,
  shown.filter((text) => text.includes(TRACKED)).length === 1,
  `${TRACKED} is explained ${shown.filter((text) => text.includes(TRACKED)).length} times`,
);

/**
 * AND THE NUMBER ON THE GLASS IS THE NUMBER IN THE PRESCRIPTION.
 *
 * An explanation that says "moved to 102.5 kg" beside a row prescribing 100 kg
 * would be worse than no explanation, and it is a different failure from the
 * sentence disagreeing with the stored EXPLANATION — the explanation itself
 * could be internally consistent and still describe a week the athlete is not
 * being given.
 */
const prescribed = (() => {
  let found: number | undefined;
  for (const mc of block2.microcycles) {
    for (const w of mc.workouts) {
      for (const ex of w.exercises ?? []) {
        if ((ex.exercise?.name ?? '') === TRACKED) found = ex.prescribedWeightKg;
      }
    }
  }
  return found;
})();

ok(
  'the weight the athlete READS is the weight the athlete is PRESCRIBED',
  prescribed === NEXT_KG,
  `the sentence says ${NEXT_KG} kg, the program prescribes ${JSON.stringify(prescribed)} kg`,
);

// ═══════════════════════════════════════════════════════════════════════════
// RESTART — both meanings, proved separately
// ═══════════════════════════════════════════════════════════════════════════

const rehydrated = JSON.parse(JSON.stringify(block2)) as TrainingProgram;
const afterReload = quiet(() => projectRealWeek(rehydrated)).explanations.map(String);

ok(
  'RESTART (stored): the serialised program re-projects the identical sentence',
  JSON.stringify(afterReload) === JSON.stringify(shown),
  `before ${JSON.stringify(shown)}, after reload ${JSON.stringify(afterReload)}`,
);

/**
 * RESTART (regenerated). This app does not persist a program and read it back on
 * boot — it REGENERATES from the stored inputs, so "survives restart" has to
 * mean the regenerated week says the same thing. If it did not, an athlete would
 * be told their weights went up, close the app, and be told nothing on reopening
 * it — or worse, told a different number.
 */
const regenerated = quiet(() => {
  resetBlockSelectionHistory();
  acceptBlock(athlete(), {
    todayISO: BLOCK_1_START,
    blockNumber: 1,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
  } as never);
  return acceptBlock(athlete(), {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    progressionHistory: { sessionFeedback: history, weightOverrides: {}, blockState: null },
  } as never);
});
const afterRegen = quiet(() => projectRealWeek(regenerated)).explanations.map(String);

ok(
  'RESTART (regenerated): rebuilding from the same stored inputs shows the identical sentence',
  JSON.stringify(afterRegen) === JSON.stringify(shown),
  `before ${JSON.stringify(shown)}, after regeneration ${JSON.stringify(afterRegen)}`,
);

ok(
  'and the regenerated explanation row is byte-identical to the one first stored',
  JSON.stringify(regenerated.blockBoundaryExplanation)
    === JSON.stringify(block2.blockBoundaryExplanation),
  'the same inputs produced a different explanation — the boundary is not deterministic',
);

// ═══════════════════════════════════════════════════════════════════════════
// THE CONTROL — an athlete owed no increase is told nothing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WITHOUT THIS THE WHOLE SUITE PASSES ON AN APP THAT ALWAYS TALKS. A projection
 * hardwired to emit a sentence would satisfy every cell above; only an athlete
 * who is owed NO explanation can tell the difference.
 */
const noHistory = quiet(() => {
  resetBlockSelectionHistory();
  return acceptBlock(athlete(), {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
  } as never);
});
const noHistoryShown = quiet(() => projectRealWeek(noHistory)).explanations.map(String);

ok(
  'an athlete with no qualifying history is shown NO load-increase sentence',
  !noHistoryShown.some((text) => text.includes(TRACKED) && / kg/.test(text)),
  `got ${JSON.stringify(noHistoryShown)} — the projection is announcing a change nobody made`,
);

console.log(`\nBlock two explanation delivery: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
if (fail > 0) { console.error(`FAILURES:\n  ${failures.join('\n  ')}`); process.exit(1); }
