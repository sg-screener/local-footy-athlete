/**
 * Shared device-exact `spent-week-friday` harness.
 *
 * Two suites need the same seed (durable fact horizon, injury authority
 * ownership) and a second copy would drift, so the install lives here once.
 *
 * Ground truth: today FRIDAY 2026-07-24, week starting MON 2026-07-20.
 *   MON Strength/core  TUE Team Training/core  WED Rest
 *   THU Team Training/core  FRI Strength/optional  SAT Game  SUN Recovery
 * On this profile there is NO app-authored conditioning or sprint: all of it is
 * anchor credit from the two team trainings and the game. That is exactly why
 * this seed exposes anchor-participation defects that a five-day profile hides.
 *
 * Install ONE seed per process. Re-seeding twice in one process leaves the
 * second install unable to record a session outcome
 * (`incomplete_component_outcomes`) — a harness artifact that would otherwise be
 * reported as an invariant failure (M6).
 */

import { generationAnchorForProgram, useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { useReadinessStore } from '../store/readinessStore';
import { useCoachUpdatesStore } from '../store/coachUpdatesStore';
import { normalizeAcceptedMaterialContext } from '../store/acceptedStateColdStart';
import { createEmptyReversibleAdjustmentLedger } from '../rules/reversibleAdjustmentLedger';
import {
  commitAcceptedStateTransaction,
  getAcceptedMaterialContext,
} from '../store/acceptedStateTransaction';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
  resolveSessionOutcomeTarget,
} from '../store/sessionOutcomeTransaction';
import { buildDevE2ESeed, devE2EWeekStartForSeed } from '../dev/e2e/devE2ESeedRegistry';
import { seedOnboardingProgram } from '../utils/onboardingCompletion';
import { deriveStoredBlockStateFromProgram } from '../utils/programBlockState';
import { rebaseAcceptedEffectiveWeek } from '../rules/acceptedEffectiveWeek';
import { addDaysISO } from '../utils/programBlockState';

export const SPENT_WEEK_1 = '2026-07-20';
export const SPENT_WEEK_2 = '2026-07-27';
export const SPENT_WEEK_3 = '2026-08-03';
export const SPENT_TODAY = '2026-07-24';
/** MON, TUE, THU of week 1 — the days this seed records as already Done. */
export const SPENT_DONE_DATES = ['2026-07-20', '2026-07-21', '2026-07-23'];

export function quiet<T>(body: () => T): T {
  const warn = console.warn; const error = console.error; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined; console.log = () => undefined;
  try { return body(); } finally { console.warn = warn; console.error = error; console.log = log; }
}

export async function quietAsync<T>(body: () => Promise<T>, loud = false): Promise<T> {
  if (loud) return body();
  const warn = console.warn; const error = console.error; const log = console.log;
  console.warn = () => undefined; console.error = () => undefined; console.log = () => undefined;
  try { return await body(); } finally { console.warn = warn; console.error = error; console.log = log; }
}

/**
 * Device-exact install. The fixture mark is published through the
 * accepted-state boundary exactly as `defaultDevE2ESeedCoordinator` does, never
 * the live calendar-mutation path — that path would rebuild the accepted week
 * into one_off_game overlays before any assertion runs.
 */
export function seedSpentWeekFriday(): { anchor: string; weekStart: string } {
  useCalendarStore.setState({ markedDays: {}, selectedDate: null } as never);
  useReadinessStore.setState({ signalsByDate: {} } as never);
  useCoachUpdatesStore.setState({ activeConstraints: [], activeInjury: null } as never);
  useProgramStore.setState({
    weekScopedOverlays: {},
    dateOverrides: {},
    overrideContexts: {},
    userRemovalConstraints: [],
    reversibleAdjustmentLedger: createEmptyReversibleAdjustmentLedger(),
    exposureContractsByWeek: {},
    sessionFeedback: {},
    weightOverrides: {},
    acceptedMaterialContext: normalizeAcceptedMaterialContext({ revision: 0 }),
  } as never);
  const seed = buildDevE2ESeed('spent-week-friday');
  const weekStarts = seed.program.microcycles.map((m) => m.startDate.slice(0, 10));
  const weekStart = devE2EWeekStartForSeed('spent-week-friday');
  quiet(() => seedOnboardingProgram({
    onboardingData: seed.profile,
    program: seed.program,
    todayISO: seed.anchorDate,
    programStore: {
      setCurrentProgram: (program) => {
        commitAcceptedStateTransaction({
          // Harness seed: installs a world, never restores one.
          operation: 'forward_decision',
          reason: 'spent-week-friday-support:install',
          program: {
            currentProgram: program,
            currentMicrocycle: null,
            todayWorkout: null,
            blockState: deriveStoredBlockStateFromProgram(program),
            // THE ANCHOR THIS SEED ALWAYS OWED (Sam's ruling, 2026-08-06).
            // Real generation stamps `generationAnchorISO` onto every program
            // it produces; the dev E2E seeds carry none, so this world was a
            // state no athlete could reach — and it read as ordinary until
            // boot stopped guessing today and started refusing. The seed's
            // own `anchorDate` IS the day it represents being generated on,
            // so it is what generation would have written. Through the one
            // owner, like every install door.
            generationAnchorISO: generationAnchorForProgram(program)
              ?? seed.anchorDate.slice(0, 10),
          },
          profile: seed.profile,
          preserveExactAcceptedWorkouts: true,
          validateWeekStarts: weekStarts,
        } as never);
      },
      setCurrentMicrocycle: (microcycle) => commitAcceptedStateTransaction({
        // Harness seed: installs a world, never restores one.
        operation: 'forward_decision',
        reason: 'spent-week-friday-support:mc',
        program: { currentMicrocycle: microcycle },
        profile: seed.profile,
        preserveExactAcceptedWorkouts: true,
        validateWeekStarts: microcycle ? [microcycle.startDate.slice(0, 10)] : [],
      } as never),
      setTodayWorkout: (workout) => commitAcceptedStateTransaction({
        // Harness seed: installs a world, never restores one.
        operation: 'forward_decision',
        reason: 'spent-week-friday-support:today',
        program: { todayWorkout: workout },
        profile: seed.profile,
        preserveExactAcceptedWorkouts: true,
        validateWeekStarts: [weekStart],
      } as never),
    },
    calendarStore: {
      setGameDay: (date: string) => {
        const accepted = getAcceptedMaterialContext();
        const program = useProgramStore.getState().currentProgram!;
        commitAcceptedStateTransaction({
          // Harness seed: installs a world, never restores one.
          operation: 'forward_decision',
          reason: `spent-week-friday-support:calendar_game:${date}`,
          markedDays: { ...accepted.markedDays, [date]: 'game' },
          profile: seed.profile,
          preserveExactAcceptedWorkouts: true,
          validateWeekStarts: program.microcycles.map((m) => m.startDate.slice(0, 10)),
        } as never);
      },
    },
  } as never));
  useProfileStore.setState({ onboardingData: seed.profile, isOnboardingComplete: true });
  return { anchor: seed.anchorDate, weekStart };
}

/** MON/TUE/THU recorded Done through the REAL session-outcome transaction. */
export async function markSpentDaysDone(): Promise<void> {
  for (const date of SPENT_DONE_DATES) {
    const target = resolveSessionOutcomeTarget(date, date);
    const intent = createRecordSessionOutcomeIntentFromFeedback({
      date,
      workout: target.workout,
      feedback: {
        dateStr: date,
        completion: 'full',
        feeling: 'very_easy',
        soreness: 'none',
        difficulty: 3,
      },
      source: {
        entryPoint: 'tap',
        surface: 'spent_week_friday_support',
        interpretedIntent: 'record_session_outcome',
        traceId: `spent-week-friday-support:done:${date}`,
      },
      todayISO: date,
    });
    const result = await quietAsync(() => commitSessionOutcomeTransaction(intent));
    if (!result.ok) {
      throw new Error(`could not record ${date} Done: ${JSON.stringify(result)}`);
    }
  }
}

/** The ACCEPTED effective week as the athlete would see it. */
export function acceptedWeek(weekStart: string): {
  mode: string;
  days: Record<string, string>;
  signature: string;
  blockingViolations: string[];
} {
  const state = useProgramStore.getState();
  const rebased = rebaseAcceptedEffectiveWeek({
    surfaces: state as never,
    weekStart,
    profile: useProfileStore.getState().onboardingData,
    markedDays: state.acceptedMaterialContext.markedDays,
  });
  const days: Record<string, string> = {};
  for (const workout of rebased.visibleWorkouts) {
    const offset = workout.dayOfWeek === 0 ? 6 : workout.dayOfWeek - 1;
    days[addDaysISO(weekStart, offset)] =
      `${workout.workoutType}/${workout.sessionTier ?? '-'}/${workout.intensity ?? '-'}/${workout.exercises.length}ex`;
  }
  return {
    mode: rebased.contract.identity.mode,
    days,
    signature: Object.entries(days).sort().map(([d, v]) => `${d}=${v}`).join('  '),
    blockingViolations: rebased.evaluation.blockingViolations.map((v) =>
      `${v.code}:${v.domain}(exp=${JSON.stringify(v.expected)},act=${JSON.stringify(v.actual)})`),
  };
}

/**
 * Fork one child process per scenario. Each child gets a virgin module registry
 * and a virgin store, which is the only way this seed can be installed more than
 * once in a run.
 */
export function runScenariosForked(args: {
  title: string;
  scenarioIds: readonly string[];
  envVar: string;
  filename: string;
}): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { spawnSync } = require('child_process');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  // Re-enter through sucrase-node explicitly: `process.argv` already points at
  // the .ts file, so re-spawning it under bare node would lose the compile hook.
  const runner = path.resolve(`${__dirname}/../../node_modules/sucrase/bin/sucrase-node`);
  console.log(`\n── ${args.title} ──`);
  let failed = 0;
  for (const id of args.scenarioIds) {
    const child = spawnSync(process.argv[0], [runner, args.filename], {
      env: { ...process.env, [args.envVar]: id, TZ: 'Australia/Melbourne' },
      encoding: 'utf8',
    });
    const output = `${child.stdout ?? ''}${child.stderr ?? ''}`
      .split('\n')
      .filter((line) => /^\s+(PASS|FAIL) \[invariant\]/.test(line))
      .join('\n');
    console.log(output || `  FAIL [invariant] ${id}: scenario produced no verdict\n${child.stderr ?? ''}`);
    if (child.status !== 0) failed += 1;
  }
  console.log(`\n${args.scenarioIds.length - failed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
