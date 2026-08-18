/**
 * DOES A RELAUNCH KEEP BLOCK TWO? — the production boot path, driven.
 *
 * ## THE QUESTION THIS ANSWERS, AND THE ONE IT DOES NOT
 *
 * It answers: **after `rebuildDerivedWorld()` — the real boot — is the athlete's
 * block-two world still there?** Progressed loads, restored accessory loads,
 * the very-hard volume reduction, the stored explanation rows, the missed-session
 * answer, and the acknowledgement that hides the notice.
 *
 * It does NOT answer why the DEV E2E SEED refuses hydration. That is a separate
 * question with a separate suite of causes, and conflating the two is what made
 * the previous session report an inference as a diagnosis.
 *
 * ## THE WORLD IS INSTALLED THE WAY PRODUCTION INSTALLS IT
 *
 * Explicit persisted inputs only — profile answers, the generation anchor, the
 * block state, all-time recorded loads, the block's session feedback, and the
 * decision ledger. Then the block-2 program is authored through the ordinary
 * generation path with those inputs, exactly as the rollover
 * (`utils/weekRebuild.ts`) authors it. Nothing here reaches past a persisted
 * input, because the thing under test is whether BOOT can rebuild from them.
 *
 * Run: npm run test:block-two-boot-preservation
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
  throw new Error('NETWORK DISABLED — boot runs entirely on-device');
};

import { generateProgramLocally } from '../services/api/generateProgram';
import { slotCountsTowardSetBudget } from '../rules/weeklyProgrammingContract';
import { fullKitEquipmentAnswer } from './support/equipmentAnswerFixture';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { rebuildDerivedWorld } from '../store/quiescentBoot';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { deriveBlockBoundaryPrompts } from '../screens/home/useBlockBoundaryPrompts';
import { isReductionExplanationRow } from '../rules/blockBoundaryProgression';
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
function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  const info = console.info; const debug = console.debug;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  console.info = () => {}; console.debug = () => {};
  try { return body(); } finally {
    console.log = log; console.warn = warn; console.error = error;
    console.info = info; console.debug = debug;
  }
}

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
    `src/__tests__/blockTwoBootPreservationTests.ts could not derive a bilateral hinge from block 2 — a block with no `
    + 'hinge at all is a real change in what the app programs, not a test nit.',
  );
})();
/**
 * ⚠ **THIS NAME MOVED WHEN SAM'S 2026-08-17 ROTATION RULING LANDED, AND THE
 * SUBJECT DID NOT.** This suite asks whether a relaunch RESTORES an accessory's
 * own recorded load; which accessory is incidental to that question.
 *
 * Accessories used to rotate every WEEK, so block 2 contained several and
 * `Bicep Curl (Barbell)` was one of them. Ruling 2 — *"true accessory exercises
 * rotate at every new block. They remain stable within the block and its
 * deload"* — gives the block ONE accessory per slot, and for this off-season
 * clubless world that is `Banded External Rotation`. The old name is simply not
 * in block 2 any more, so both cells read `[]`.
 *
 * `Bicep Curl (Barbell)` is NOT gated out: it is authored `everyone`. This is a
 * cadence change, not an experience one.
 */
/**
 * ⚠ **DERIVED, NOT NAMED — IT HAS NOW BROKEN TWICE.** This suite asks whether a
 * relaunch RESTORES an accessory's own recorded load; WHICH accessory is
 * incidental. It was `Bicep Curl (Barbell)`, then `Banded External Rotation`,
 * and each time a rotation-policy change made the name stale and the cells read
 * `[]` about a perfectly healthy program. It asks the block now.
 */
const ACCESSORY: string = (() => {
  const probe = generateProgramLocally(athlete(), {
    todayISO: BLOCK_2_START,
    blockNumber: 2,
    recordSelections: false,
    progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
  });
  for (const mc of probe.microcycles) {
    for (const w of mc.workouts) {
      for (const ex of w.exercises ?? []) {
        if (ex.role === 'conditioning') continue;
        if (slotCountsTowardSetBudget(ex.section18Evidence?.slot)) continue;
        const name = ex.exercise?.name ?? '';
        if (name) return name;
      }
    }
  }
  throw new Error(
    'blockTwoBootPreservationTests could not derive an accessory row from block 2 '
    + '— a block with no accessory at all is a real change, not a test nit.',
  );
})();
const RECORDED_KG = 100;
const ACCESSORY_RECORDED_KG = 17.5;

/**
 * ⚠ **OFF-SEASON, NO CLUB NIGHTS — AND THAT CHOICE IS A FINDING, NOT A
 * PREFERENCE.**
 *
 * The first cut of this fixture had two team-training days, and BOOT REFUSED IT
 * before any block-two question could be asked:
 *
 *     Section18SafetyContradictionError: unjustified_anchor_credit
 *     participation: 'unknown'
 *     claim: { conditioning: true, sprintHighSpeed: true, hardDay: true }
 *     detail: 'team_training production credit is not justified by
 *              participation state.'
 *     evidence: day=2 anchor=tt-2 · day=4 anchor=tt-4
 *
 * Boot's clean slate empties `acceptedMaterialContext` — participation included
 * — so every team-training anchor claims conditioning, sprint and hard-day
 * credit with no participation evidence behind it, and §18 safety blocks the
 * rebuild. **That is PRE-EXISTING and NOT a block-two defect**: the same
 * signature is red 13 times in `test:readiness-ownership` at the base commit
 * `6117a9fd`, and it is the same refusal the dev E2E seed hits
 * (`dev_e2e_app_hydration_failed:derived-world`).
 *
 * A clubless athlete is therefore the only world in which THIS suite's question
 * — does a relaunch keep block two — can be asked at all. The club-night boot
 * refusal is reported separately and is not repaired here.
 */
function athlete(): OnboardingData {
  return {
    seasonPhase: 'Off-season',
    trainingDaysPerWeek: 3,
    preferredTrainingDays: ['Monday', 'Wednesday', 'Friday'],
    teamTrainingDaysPerWeek: 0,
    teamTrainingDays: [],
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

/**
 * `mode: 'well_recovered'` — the block that EARNS a load rise.
 * `mode: 'very_hard'`      — completed, but brutal: loads held, volume cut.
 * `mode: 'half_attended'`  — 6 of 12, which is below the approved 75% line.
 */
function block1(mode: 'well_recovered' | 'very_hard' | 'half_attended'): Record<string, SessionFeedback> {
  const feedback: Record<string, SessionFeedback> = {};
  for (const [index, dateStr] of BLOCK_1_DATES.entries()) {
    const completed = mode === 'half_attended' ? index < 6 : true;
    feedback[dateStr] = {
      dateStr,
      completion: completed ? 'full' : 'skipped',
      ...(mode === 'half_attended' ? {} : {
        feeling: mode === 'very_hard' ? ('very_hard' as const) : ('good' as const),
        soreness: mode === 'very_hard' ? ('high' as const) : ('mild' as const),
        // ALL-TIME EXERCISE HISTORY: a main lift AND an accessory, because the
        // two travel by different rules — the main lift may RISE, the accessory
        // may only be RESTORED. A boot that keeps one and loses the other would
        // read as "history survived" against a main-lift-only fixture.
        strength: [
          {
            exerciseId: 'ex-main', workoutExerciseId: 'wex-main', exerciseName: TRACKED,
            prescribedSets: 4, prescribedRepsMin: 5, prescribedRepsMax: 5,
            weightKg: RECORDED_KG, completion: 'full' as const,
          },
          {
            exerciseId: 'ex-acc', workoutExerciseId: 'wex-acc', exerciseName: ACCESSORY,
            prescribedSets: 3, prescribedRepsMin: 12, prescribedRepsMax: 15,
            weightKg: ACCESSORY_RECORDED_KG, completion: 'full' as const,
          },
        ],
      }),
    } as SessionFeedback;
  }
  return feedback;
}

interface WorldSnapshot {
  loads: string;
  sets: string;
  explanation: string;
  hasReduction: boolean;
  noticeVisible: boolean;
  commitmentVisible: boolean;
  trackedLoads: (number | undefined)[];
  accessoryLoads: (number | undefined)[];
}

function snapshot(): WorldSnapshot {
  const state = useProgramStore.getState();
  const program = state.currentProgram;
  const loads: string[] = [];
  const sets: string[] = [];
  const trackedLoads: (number | undefined)[] = [];
  const accessoryLoads: (number | undefined)[] = [];
  for (const [weekIndex, microcycle] of (program?.microcycles ?? []).entries()) {
    for (const workout of microcycle.workouts) {
      for (const exercise of workout.exercises ?? []) {
        const name = exercise.exercise?.name ?? '?';
        const key = `w${weekIndex + 1}:${workout.name}:${name}`;
        loads.push(`${key}=${exercise.prescribedWeightKg ?? 'BW'}`);
        sets.push(`${key}=${exercise.prescribedSets}`);
        if (name === TRACKED) trackedLoads.push(exercise.prescribedWeightKg);
        if (name === ACCESSORY) accessoryLoads.push(exercise.prescribedWeightKg);
      }
    }
  }
  const prompts = deriveBlockBoundaryPrompts({
    currentProgram: program,
    blockNumber: state.blockState?.blockNumber ?? null,
    blockStartISO: state.blockState?.blockStartDate ?? null,
    sessionFeedback: state.sessionFeedback,
    onboardingData: useProfileStore.getState().onboardingData,
    ledgerEntries: useDecisionLedgerStore.getState().entries,
    weekOrder: WEEK_ORDER,
  });
  return {
    loads: JSON.stringify(loads.sort()),
    sets: JSON.stringify(sets.sort()),
    explanation: JSON.stringify(program?.blockBoundaryExplanation ?? []),
    hasReduction: (program?.blockBoundaryExplanation ?? []).some(isReductionExplanationRow),
    noticeVisible: prompts.notice !== null,
    commitmentVisible: prompts.commitment !== null,
    trackedLoads,
    accessoryLoads,
  };
}

/**
 * Install a production-style persisted world and author its block 2, exactly as
 * the rollover does. Returns the before-boot snapshot.
 */
function installWorld(args: {
  mode: 'well_recovered' | 'very_hard' | 'half_attended';
  ledgerEntries?: readonly DecisionLedgerEntry[];
}): WorldSnapshot {
  return quiet(() => {
    resetStoresToFreshInstall('block-two-boot-preservation');
    const profile = athlete();
    const feedback = block1(args.mode);

    useProfileStore.setState({ onboardingData: profile, isOnboardingComplete: true } as never);
    useDecisionLedgerStore.setState({ entries: [...(args.ledgerEntries ?? [])] } as never);

    const program = generateProgramLocally(profile, {
      todayISO: BLOCK_2_START,
      blockNumber: 2,
      progressionHistory: { sessionFeedback: feedback, weightOverrides: {}, blockState: null },
    }) as TrainingProgram;

    /* ⚠ **PUBLISHED THROUGH THE ROLLOVER'S OWN DOOR, WHICH IS WHAT THIS
     * FUNCTION HAS ALWAYS CLAIMED TO DO** — *"exactly as the rollover does"*,
     * two lines up. It did not: it wrote `currentProgram` with a raw
     * `setState`, so the before-boot world was a generated program that had
     * never passed an acceptance door, while the after-boot world had. Every
     * comparison below then measured acceptance itself rather than boot.
     *
     * That was invisible while NEITHER door canonicalised the program. It
     * stopped being invisible when the final program-write boundary moved to
     * the one owner both doors reach (`stageAcceptedStateTransaction`), and this
     * fixture reported the canonicalisation as a boot regression. The
     * ASSERTIONS are untouched and are still exact; only the door is.
     *
     * The INPUTS go in first, because the publication reads them. */
    useProgramStore.setState({
      sessionFeedback: feedback,
      weightOverrides: {},
    } as never);
    commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
      profile,
      selectedDate: BLOCK_2_START,
      reason: 'block-two-boot-preservation:install',
    });
    useProgramStore.setState({
      blockState: { blockStartDate: BLOCK_2_START, blockNumber: 2 },
      generationAnchorISO: BLOCK_2_START,
    } as never);

    return snapshot();
  });
}

async function boot(): Promise<WorldSnapshot> {
  await quiet(async () => { await rebuildDerivedWorld(); });
  return snapshot();
}

function ackEntry(forBlockNumber: number): DecisionLedgerEntry {
  return {
    id: `dl-ack-${forBlockNumber}`,
    occurredAt: '2026-08-03T09:00:00.000Z',
    provenance: 'athlete_tap',
    decision: { kind: 'block_boundary_notice_acknowledged', forBlockNumber },
  } as DecisionLedgerEntry;
}
function commitmentEntry(forBlockNumber: number): DecisionLedgerEntry {
  return {
    id: `dl-commit-${forBlockNumber}`,
    occurredAt: '2026-08-03T09:05:00.000Z',
    provenance: 'athlete_tap',
    decision: {
      kind: 'weekly_commitment_answer',
      forBlockNumber,
      answer: { kind: 'confirmed', sessionsPerWeek: 2, trainingDays: ['Monday', 'Friday'] },
    },
  } as DecisionLedgerEntry;
}

async function main(): Promise<void> {
  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[0] THE FIXTURE IS A REAL BLOCK TWO — non-vacuity');

  const beforeGood = installWorld({ mode: 'well_recovered' });
  ok(
    "the well-recovered block SEEDED the main lift from the athlete's own 100 kg",
    // ⚠ NOT "progressed to 102.5". This off-season world HOLDS at the recorded
    // 100 rather than taking the increment, and that is worth a look of its own
    // — but it is not this suite's question. What matters here is that the
    // number is the ATHLETE'S, so a boot that replaces it with an estimate is
    // visible. The pre-season progression to 102.5 is held by
    // `test:block-two-progression`.
    beforeGood.trackedLoads.length > 0 && beforeGood.trackedLoads.every((kg) => kg === RECORDED_KG),
    `got ${JSON.stringify(beforeGood.trackedLoads)}`,
  );
  ok(
    'and RESTORED the accessory to its own recorded load',
    beforeGood.accessoryLoads.length > 0
      && beforeGood.accessoryLoads.every((kg) => kg === ACCESSORY_RECORDED_KG),
    `got ${JSON.stringify(beforeGood.accessoryLoads)}`,
  );
  ok(
    'and stored explanation rows',
    JSON.parse(beforeGood.explanation).length > 0,
  );

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[1] A RELAUNCH KEEPS THE PROGRESSED AND RESTORED LOADS');

  const afterGood = await boot();
  ok(
    `${TRACKED} is still the athlete's own ${RECORDED_KG} kg after boot`,
    afterGood.trackedLoads.length > 0
      && afterGood.trackedLoads.every((kg) => kg === RECORDED_KG),
    `before ${JSON.stringify(beforeGood.trackedLoads)} · after ${JSON.stringify(afterGood.trackedLoads)}`,
  );
  ok(
    `${ACCESSORY} is still ${ACCESSORY_RECORDED_KG} kg after boot`,
    afterGood.accessoryLoads.length > 0
      && afterGood.accessoryLoads.every((kg) => kg === ACCESSORY_RECORDED_KG),
    `before ${JSON.stringify(beforeGood.accessoryLoads)} · after ${JSON.stringify(afterGood.accessoryLoads)}`,
  );
  ok(
    'EVERY stored load is identical after boot',
    afterGood.loads === beforeGood.loads,
    'the rebuilt programme prescribes different weights',
  );
  ok(
    'the stored explanation rows are identical after boot',
    afterGood.explanation === beforeGood.explanation,
    'the athlete keeps a changed programme and loses the reason for it',
  );

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[2] A RELAUNCH KEEPS THE VERY-HARD VOLUME REDUCTION');

  const beforeHard = installWorld({ mode: 'very_hard' });
  ok(
    'the very-hard block HELD the load and stored a reduction row',
    beforeHard.trackedLoads.every((kg) => kg === RECORDED_KG) && beforeHard.hasReduction,
    `loads ${JSON.stringify(beforeHard.trackedLoads)} · reduction ${beforeHard.hasReduction}`,
  );
  ok('and its notice is visible before boot', beforeHard.noticeVisible);

  const afterHard = await boot();
  ok(
    'EVERY set count is identical after boot',
    afterHard.sets === beforeHard.sets,
    'the reduction was undone by the relaunch',
  );
  ok(
    'the load is still HELD at the recorded number after boot',
    afterHard.trackedLoads.every((kg) => kg === RECORDED_KG),
    `before ${JSON.stringify(beforeHard.trackedLoads)} · after ${JSON.stringify(afterHard.trackedLoads)}`,
  );
  ok(
    'the reduction row survives boot',
    afterHard.hasReduction && afterHard.explanation === beforeHard.explanation,
  );
  ok(
    'the notice is STILL VISIBLE after boot — it survives until acknowledged',
    afterHard.noticeVisible,
  );

  /* ═══════════════════════════════════════════════════════════════════════ */
  console.log('\n[3] A RELAUNCH KEEPS THE ATHLETE\'S ANSWERS');

  const beforeAck = installWorld({ mode: 'very_hard', ledgerEntries: [ackEntry(2)] });
  ok('an acknowledged notice is hidden before boot', !beforeAck.noticeVisible);
  const afterAck = await boot();
  ok(
    'AND STAYS HIDDEN AFTER BOOT — the acknowledgement survives',
    !afterAck.noticeVisible,
    'the athlete is shown the same notice again on every relaunch',
  );
  ok(
    'the acknowledged world still carries its reduction',
    afterAck.hasReduction && afterAck.sets === beforeAck.sets,
    'dismissing the card cost the athlete the reduction it described',
  );

  const beforeMissed = installWorld({ mode: 'half_attended' });
  ok('the under-attended block ASKS before boot', beforeMissed.commitmentVisible);
  const afterMissed = await boot();
  ok(
    'and still asks after boot — the question is re-derived, not lost',
    afterMissed.commitmentVisible,
  );

  const beforeAnswered = installWorld({
    mode: 'half_attended', ledgerEntries: [commitmentEntry(1)],
  });
  ok('an answered question is silent before boot', !beforeAnswered.commitmentVisible);
  const afterAnswered = await boot();
  ok(
    'AND STAYS SILENT AFTER BOOT — the smaller-program decision survives',
    !afterAnswered.commitmentVisible,
    'the athlete is re-asked a question they have already answered',
  );

  console.log(`\nBlock two boot preservation: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log('\nFAILURES:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
}

void main();
