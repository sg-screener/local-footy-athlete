import { calendarActionsForTest } from './support/calendarActionsForTest';
/**
 * RESULTS PERSIST — R4 of the shell rebuild.
 *
 * Plan §2 class 4: "Training results — what was done: workout logs, session
 * feedback, weights/TT times." §3 R4, what Sam sees: "log a session, force-quit,
 * relaunch — the log is still there. That has never been true."
 *
 * ── LEGACY CENSUS ENTRY 18, DIAGNOSED BEFORE BUILDING ──────────────────────
 *
 * The census entry says: "workoutLogStore.ts has no persist(...), so logged sets
 * do not survive a relaunch. Four readers. EITHER A REAL DATA-LOSS DEFECT OR
 * DEAD CODE… Whether an absent persist() is a defect depends on whether the
 * surface that feeds it is meant to exist."
 *
 * It is dead code. Measured 2026-08-06: no product file calls `startWorkout`,
 * `logSet`, `updateSet`, `getExerciseSets`, `nextExercise`, `prevExercise`,
 * `setCurrentExerciseIndex`, `completeWorkout` or `setIsLogging`. The only
 * product uses are one READ in `SessionFeedbackPanel` (of a Map nothing ever
 * fills) and three `clear()` calls on reset paths. There is no set-logging
 * surface in this app.
 *
 * SO R4 DOES NOT PERSIST IT. Adding persistence to a store nothing writes would
 * be new stored state that is not an input, which the north star presumes wrong,
 * and it would put a durable key on Sam's phone for a feature that does not
 * exist. Cell 5 holds that line: the day a set-logging surface is built, the
 * store joins the results class and this suite reds until it does.
 *
 * What the app ACTUALLY produces as results is the session outcome — completion,
 * feeling, soreness, component outcomes, the receipt — and the weights the
 * athlete edits. Those are what "the log is still there" means today, and those
 * are what this suite proves, by acting and relaunching.
 *
 * Run: npm run test:results-persist
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const disk = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => { disk.set(key, value); },
    removeItem: (key: string) => { disk.delete(key); },
    clear: () => { disk.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — results are recorded on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import { readFileSync } from 'fs';
import path from 'path';
import type { TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { useReadinessStore } from '../store/readinessStore';
import { useDecisionLedgerStore } from '../store/decisionLedgerStore';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveDateWithConditioning, resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import { flushPendingStorageWrites, pendingStorageWriteCount } from '../store/asyncStorageCompat';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
} from '../store/sessionOutcomeTransaction';
import { getSessionComponents } from '../utils/sessionComponents';
import {
  samDevicePass20260805Profile,
  SAM_PASS_20260805_TODAY_ISO,
  SAM_PASS_20260805_CURRENT_WEEK,
  SAM_PASS_20260805_ENTRY_WEEK,
  SAM_PASS_20260805_GENERATION_DAY,
  SAM_PASS_20260805_MARKED_DAYS,
} from './support/samDevicePass20260805Fixture';

const TODAY = SAM_PASS_20260805_TODAY_ISO;
const WEEK = SAM_PASS_20260805_CURRENT_WEEK;
const SRC = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL ${name}`);
    console.log(`      ${message}`);
  }
}

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return await body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

function reachWorldByActing(): void {
  disk.clear();
  resetStoresToFreshInstall('results-persist');
  const profile = samDevicePass20260805Profile();
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  for (const [date, mark] of Object.entries(SAM_PASS_20260805_MARKED_DAYS)) {
    if (mark === 'game') calendarActionsForTest().setGameDay(date, SAM_PASS_20260805_GENERATION_DAY);
  }
  const program = quiet(() => generateProgramLocally(profile, {
    weekAcceptance: 'forward_decision',
    todayISO: SAM_PASS_20260805_GENERATION_DAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'Pre-season',
      phaseEntryWeekStartISO: SAM_PASS_20260805_ENTRY_WEEK,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {},
    selectedDate: SAM_PASS_20260805_GENERATION_DAY,
    reason: 'results-persist:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

/** Force-quit and relaunch: the derived world dies, the persisted inputs do not. */
async function relaunch(): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await flushPendingStorageWrites().catch(() => undefined);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (pendingStorageWriteCount() === 0) break;
  }
  const snapshot = new Map(disk);
  useProgramStore.setState({
    currentProgram: null, currentMicrocycle: null, todayWorkout: null,
    dateOverrides: {}, overrideContexts: {}, weekScopedOverlays: {},
    userRemovalConstraints: [], exposureContractsByWeek: {}, blockState: null,
    sessionFeedback: {}, weightOverrides: {},
  } as never);
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  await flushPendingStorageWrites().catch(() => undefined);
  disk.clear();
  for (const [key, value] of snapshot) disk.set(key, value);
  await quietAsync(async () => {
    await useProgramStore.persist.rehydrate();
    await useCalendarStore.persist.rehydrate();
    await useProfileStore.persist.rehydrate();
    await useCoachUpdatesStore.persist.rehydrate();
    await useReadinessStore.persist.rehydrate();
    await useDecisionLedgerStore.persist.rehydrate();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runQuiescentBoot } = require('../store/quiescentBoot');
    await runQuiescentBoot();
  });
}

/** Today's session — the one an athlete finishes and logs. */
function todaysSession(): { date: string; workout: Workout } {
  const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
  const day = week.find((candidate) => candidate.date === TODAY
    && !!(candidate as unknown as { workout?: Workout | null }).workout);
  assert(day, `no session on ${TODAY} to log`);
  return { date: TODAY, workout: (day as unknown as { workout: Workout }).workout };
}

function storedFeedback(date: string): Record<string, unknown> | null {
  const feedback = (useProgramStore.getState() as unknown as {
    sessionFeedback: Record<string, Record<string, unknown>>;
  }).sessionFeedback;
  return feedback[date] ?? null;
}

const main = async () => {
  console.log('\n-- Results persist (plan §2 class 4, R4) --');

  // ── 1. THE SESSION LOG SURVIVES A FORCE-QUIT ─────────────────────────────
  await run('1 a logged session is still there after a force-quit and relaunch', async () => {
    reachWorldByActing();
    const target = todaysSession();
    const result = await quietAsync(() => commitSessionOutcomeTransaction(
      createRecordSessionOutcomeIntentFromFeedback({
        date: target.date,
        feedback: {
          date: target.date,
          completion: 'full',
          feeling: 'good',
          soreness: 'none',
          notes: 'felt strong',
          difficulty: 4,
          executionItems: [
            {
              itemId: 'exercise:proof-row',
              sectionId: 'strength',
              componentId: 'strength',
              completed: true,
            },
            {
              itemId: 'mobility:proof-row',
              sectionId: 'mobility',
              componentId: null,
              completed: false,
            },
          ],
        } as never,
        workout: target.workout,
        source: { entryPoint: 'tap', surface: 'session_feedback_panel' },
      } as never),
    )) as { ok: boolean; code?: string };
    assert(result.ok, `the session did not log at all: ${result.code}`);
    const before = storedFeedback(TODAY);
    assert(before, 'the commit reported ok but stored no feedback for today');

    await relaunch();

    const after = storedFeedback(TODAY);
    assert(after,
      'THE LOGGED SESSION IS GONE after a relaunch. Plan §2 puts training results in the '
      + 'inputs schema as their own class; a result that dies with the process is the '
      + 'defect R4 exists to close');
    assert(after.completion === 'partial',
      `the completion came back as ${String(after.completion)} instead of 'partial' for skipped mobility`);
    assert(after.notes === 'felt strong',
      `the athlete's note did not survive: ${JSON.stringify(after.notes)}`);
    assert(after.difficulty === 4,
      `the session effort did not survive: ${JSON.stringify(after.difficulty)}`);
    assert(Array.isArray(after.executionItems) && after.executionItems.length === 2,
      `the per-item completion evidence did not survive: ${JSON.stringify(after.executionItems)}`);
    assert((after.executionItems as Array<{ sectionId?: string; completed?: boolean }>)[1]?.sectionId === 'mobility'
      && (after.executionItems as Array<{ sectionId?: string; completed?: boolean }>)[1]?.completed === false,
    `the mobility result changed across relaunch: ${JSON.stringify(after.executionItems)}`);
  });

  // ── 2. AND THE RECEIPT SURVIVES, so the day reads as done ────────────────
  await run('2 the day still reads as complete after the relaunch', async () => {
    reachWorldByActing();
    const target = todaysSession();
    await quietAsync(() => commitSessionOutcomeTransaction(
      createRecordSessionOutcomeIntentFromFeedback({
        date: target.date,
        feedback: { date: target.date, completion: 'full', feeling: 'good', soreness: 'none' } as never,
        workout: target.workout,
        source: { entryPoint: 'tap', surface: 'session_feedback_panel' },
      } as never),
    ));
    await relaunch();
    const after = storedFeedback(TODAY);
    assert(after?.outcomeReceipt,
      'the outcome RECEIPT did not survive. `useDayWorkout` reads exactly this key to '
      + 'decide `isAlreadyComplete`, so without it the athlete reopens a session they '
      + 'already finished and is asked to finish it again (GROUPB finding 1)');
  });

  await run('2b a real game result can be saved again without losing its existing record', async () => {
    reachWorldByActing();
    const date = Object.keys(SAM_PASS_20260805_MARKED_DAYS)[0];
    const workout = quiet(() => resolveDateWithConditioning(
      date,
      buildScheduleStateImperative(),
    ).workout);
    assert(workout, `the acted game mark on ${date} resolved no workout`);
    const componentIdsBefore = getSessionComponents(workout).map((component) => component.id);
    const first = await quietAsync(() => commitSessionOutcomeTransaction(
      createRecordSessionOutcomeIntentFromFeedback({
        date,
        feedback: {
          dateStr: date,
          completion: 'full',
          game: { playedWholeGame: true, timeOnGroundMinutes: 80, bodyRpe: 7, feel: 3 },
        } as never,
        workout,
        source: { entryPoint: 'tap', surface: 'game_feedback_panel' },
      }),
      TODAY,
    ));
    assert(first.ok, `the first real game save refused: ${'code' in first ? first.code : 'unknown'}`);
    const existing = useProgramStore.getState().sessionFeedback[date];
    assert(existing?.game, 'the first save reported success but stored no game result');

    const currentWorkout = quiet(() => resolveDateWithConditioning(
      date,
      buildScheduleStateImperative(),
    ).workout);
    assert(currentWorkout, `the saved game on ${date} no longer resolves a workout`);
    const second = await quietAsync(() => commitSessionOutcomeTransaction(
      createRecordSessionOutcomeIntentFromFeedback({
        date,
        feedback: {
          ...existing,
          game: { playedWholeGame: false, timeOnGroundMinutes: 63, bodyRpe: 6, feel: 4 },
        },
        workout: currentWorkout,
        source: { entryPoint: 'tap', surface: 'game_feedback_panel' },
      }),
      TODAY,
    ));
    assert(second.ok, `re-saving the real game refused: ${'code' in second ? second.code : 'unknown'}`);
    const after = useProgramStore.getState().sessionFeedback[date];
    assert(after?.game?.timeOnGroundMinutes === 63,
      `the second game answer did not replace the first: ${JSON.stringify(after?.game)}`);
    assert(JSON.stringify(after.executionItems) === JSON.stringify(existing.executionItems),
      're-saving the game changed the programmed-session item evidence sharing its date');
    const componentIdsAfter = getSessionComponents(currentWorkout).map((component) => component.id);
    assert(JSON.stringify(componentIdsAfter) === JSON.stringify(componentIdsBefore),
      `the accepted fixture route changed component identity between saves: `
      + `${JSON.stringify(componentIdsBefore)} -> ${JSON.stringify(componentIdsAfter)}`);
  });

  // ── 3. A WEIGHT THE ATHLETE EDITED SURVIVES ──────────────────────────────
  await run('3 an edited weight is still there after a relaunch', async () => {
    reachWorldByActing();
    // A day with LIFTS on it — the athlete only edits weights on a strength
    // session, and today's happens to be a team night.
    const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
    const lifting = week.find((candidate) => {
      const workout = (candidate as unknown as { workout?: Workout | null }).workout;
      return !!workout && (workout.exercises ?? []).length > 0;
    });
    assert(lifting, 'no session in the week carries exercises to weight');
    const date = lifting.date;
    const exercise = ((lifting as unknown as { workout: Workout }).workout.exercises ?? [])[0] as
      { exerciseId?: string; id?: string } | undefined;
    assert(exercise, 'the chosen session lost its exercises between the two reads');
    const key = exercise.exerciseId ?? exercise.id!;
    quiet(() => (useProgramStore.getState() as unknown as {
      setWeightOverride: (date: string, id: string, weight: number) => void;
    }).setWeightOverride(date, key, 92.5));
    const before = (useProgramStore.getState() as unknown as {
      weightOverrides: Record<string, Record<string, number>>;
    }).weightOverrides[date]?.[key];
    assert(before === 92.5, `the weight edit did not land (${String(before)})`);

    await relaunch();

    const after = (useProgramStore.getState() as unknown as {
      weightOverrides: Record<string, Record<string, number>>;
    }).weightOverrides[date]?.[key];
    assert(after === 92.5,
      `the athlete's weight came back as ${String(after)} — weights are a RESULT (plan §2 `
      + 'class 4: "weights/TT times"), and re-entering them every launch is the same '
      + 'data loss as losing the log');
  });

  // ── 4. RESULTS ARE INPUTS, SO THE BOOT STILL APPENDS NOTHING ─────────────
  await run('4 a boot with results present still appends no decision', async () => {
    reachWorldByActing();
    const target = todaysSession();
    await quietAsync(() => commitSessionOutcomeTransaction(
      createRecordSessionOutcomeIntentFromFeedback({
        date: target.date,
        feedback: { date: target.date, completion: 'full', feeling: 'good', soreness: 'none' } as never,
        workout: target.workout,
        source: { entryPoint: 'tap', surface: 'session_feedback_panel' },
      } as never),
    ));
    await relaunch();
    const first = useDecisionLedgerStore.getState().entries.length;
    await relaunch();
    assert(useDecisionLedgerStore.getState().entries.length === first,
      'the boot appended a decision with a result present — a RESULT is what was done, '
      + 'never a decision, and "boot appends nothing" is the plan\'s strongest law');
  });

  // ── 5. LEGACY CENSUS ENTRY 18: THE LINE, HELD ────────────────────────────
  //
  // The census asked for a diagnosis before a build. The diagnosis is that
  // nothing writes this store, so it is not persisted. If a set-logging surface
  // is ever built, this cell reds and the store joins the results class in the
  // same commit — which is the only way an absent persist() stays honest.
  await run('5 workoutLogStore is unpersisted BECAUSE no surface writes it', () => {
    const WRITERS = [
      'startWorkout', 'logSet', 'updateSet', 'nextExercise', 'prevExercise',
      'setCurrentExerciseIndex', 'completeWorkout', 'setIsLogging',
    ];
    const callers: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of require('fs').readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'dev') continue;
          walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          if (full.endsWith(path.join('store', 'workoutLogStore.ts'))) continue;
          const text = readFileSync(full, 'utf8');
          if (!/useWorkoutLogStore/.test(text)) continue;
          for (const writer of WRITERS) {
            if (new RegExp(`\\.${writer}\\s*\\(`).test(text)) {
              callers.push(`${path.relative(SRC, full)} → ${writer}()`);
            }
          }
        }
      }
    };
    walk(SRC);
    assert(callers.length === 0,
      `a product surface now WRITES the workout log (${callers.join(', ')}), so logged sets `
      + 'are real athlete results that die with the process. Census entry 18 stops being dead code '
      + 'the moment this cell reds: persist the store through the armour recipe, add it to '
      + '`resetStoresToFreshInstall` in the same commit (the L16 lesson), and close census entry 18');
    const source = readFileSync(path.join(SRC, 'store/workoutLogStore.ts'), 'utf8');
    assert(!/persist\(/.test(source),
      'workoutLogStore gained persistence while nothing writes it — that is a durable key '
      + "on the athlete's phone for a feature that does not exist, which the north star "
      + 'presumes wrong. Build the surface first; this cell will tell you when.');
  });

  console.log(`\n  results-persist ownership totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.log('\n  FAILURES');
    for (const failure of failures) console.log(`   - ${failure}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('results-persist ownership suite crashed', error);
  process.exit(1);
});
