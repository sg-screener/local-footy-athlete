import type { WorkoutExercise } from '../types/domain';
import type { SessionFeedback } from '../store/programStore';
import type { WeekLog } from '../utils/conditioningRules';
import {
  buildConditioningSession,
  condEx,
  DEFAULT_ATHLETE_CONTEXT,
  deriveConditioningProgressionInputOverrides,
} from '../utils/sessionBuilder';
import {
  resolveConditioningProgression,
  type ConditioningAdjustment,
} from '../utils/conditioningProgressionRules';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  fail ${name}${detail ? `\n      ${detail}` : ''}`);
  }
}

function baseWeekLog(overrides: Partial<WeekLog> = {}): WeekLog {
  return {
    sessions: [],
    strengthSessions: [],
    teamTrainingSessions: 0,
    byeWeek: true,
    missedTeamTraining: false,
    doubleGameWeek: false,
    weeksOffTraining: 0,
    readiness: 'high',
    ...overrides,
  };
}

function conditioningFeedback(args: {
  date: string;
  completion: SessionFeedback['completion'];
  feeling?: SessionFeedback['feeling'];
  soreness?: SessionFeedback['soreness'];
  rpe?: number;
  totalTimeMinutes?: number;
  intervalsCompleted?: number;
  roundsCompleted?: number;
  calories?: number;
  distanceMeters?: number;
}): SessionFeedback {
  return {
    dateStr: args.date,
    completion: args.completion,
    feeling: args.feeling,
    soreness: args.soreness ?? 'none',
    difficulty: args.rpe,
    components: [{
      componentId: 'conditioning',
      kind: 'conditioning',
      label: 'conditioning',
      completion: args.completion,
    }],
    conditioning: args.completion === 'skipped'
      ? undefined
      : {
          sessionName: 'Tempo Run',
          mode: 'run',
          rpe: args.rpe,
          totalTimeMinutes: args.totalTimeMinutes,
          intervalsCompleted: args.intervalsCompleted,
          roundsCompleted: args.roundsCompleted,
          calories: args.calories,
          distanceMeters: args.distanceMeters,
        },
  };
}

function buildFor(feedback?: SessionFeedback, weekLog: WeekLog = baseWeekLog()) {
  return buildConditioningSession(
    '2026-07-14',
    [],
    DEFAULT_ATHLETE_CONTEXT,
    'Off-season',
    weekLog,
    'micro-1',
    feedback ? { sessionFeedback: { [feedback.dateStr]: feedback } } : {},
  ) as any;
}

function nonZeroAdjustmentCount(adjustment: ConditioningAdjustment): number {
  return [
    adjustment.repsDelta,
    adjustment.intervalsDelta,
    adjustment.durationDelta,
    adjustment.restDelta,
    adjustment.intensityDelta === 'none' ? 0 : 1,
  ].filter((value) => value !== 0).length;
}

function hasPositiveProgression(adjustment: ConditioningAdjustment): boolean {
  return (
    adjustment.repsDelta > 0 ||
    adjustment.intervalsDelta > 0 ||
    adjustment.durationDelta > 0 ||
    adjustment.restDelta < 0 ||
    adjustment.intensityDelta === 'slight_up'
  );
}

console.log('\n-- Conditioning progression real inputs --');

{
  const baseline = buildFor();
  const emptyFeedback = buildConditioningSession(
    '2026-07-14',
    [],
    DEFAULT_ATHLETE_CONTEXT,
    'Off-season',
    baseWeekLog(),
    'micro-1',
    { sessionFeedback: {} },
  ) as any;
  ok('no feedback keeps baseline state', emptyFeedback?._progressionState === baseline?._progressionState);
  ok('no feedback keeps baseline adjustment',
    JSON.stringify(emptyFeedback?._progressionAdjustment) === JSON.stringify(baseline?._progressionAdjustment));
}

{
  const workout = buildFor(conditioningFeedback({
    date: '2026-07-07',
    completion: 'full',
    feeling: 'easy',
    rpe: 4,
  }));
  ok('completed good conditioning can nudge slightly', workout?._progressionState === 'build');
  ok('good conditioning changes one variable only',
    nonZeroAdjustmentCount(workout?._progressionAdjustment) === 1,
    JSON.stringify(workout?._progressionAdjustment));
}

{
  const workout = buildFor(conditioningFeedback({
    date: '2026-07-07',
    completion: 'full',
    feeling: 'good',
    rpe: 6,
  }));
  ok('average/solid conditioning repeats', workout?._progressionState === 'maintain');
  ok('average/solid conditioning has no progression adjustment',
    nonZeroAdjustmentCount(workout?._progressionAdjustment) === 0);
}

{
  const workout = buildFor(conditioningFeedback({
    date: '2026-07-07',
    completion: 'full',
    feeling: 'very_hard',
    soreness: 'moderate',
    rpe: 9,
  }));
  ok('too hard conditioning holds or reduces',
    workout?._progressionState === 'hold' || workout?._progressionState === 'deload');
  ok('too hard conditioning does not progress',
    !hasPositiveProgression(workout?._progressionAdjustment));
}

{
  const workout = buildFor(conditioningFeedback({
    date: '2026-07-07',
    completion: 'partial',
    feeling: 'good',
    rpe: 6,
  }));
  ok('partial completion holds or reduces',
    workout?._progressionState === 'hold' || workout?._progressionState === 'deload');
  ok('partial completion does not progress',
    !hasPositiveProgression(workout?._progressionAdjustment));
}

{
  const workout = buildFor(conditioningFeedback({
    date: '2026-07-07',
    completion: 'skipped',
  }));
  ok('skipped/missed does not create catch-up overload', workout?._progressionState === 'hold');
  ok('skipped/missed has no positive adjustment',
    !hasPositiveProgression(workout?._progressionAdjustment));
}

{
  const feedback: SessionFeedback = {
    dateStr: '2026-07-07',
    completion: 'full',
    feeling: 'good',
    soreness: 'none',
    components: [
      {
        componentId: 'strength',
        kind: 'strength',
        label: 'strength work',
        completion: 'full',
      },
      {
        componentId: 'finisher',
        kind: 'finisher',
        label: 'finisher',
        completion: 'skipped',
      },
    ],
  };
  const workout = buildFor(feedback);
  ok('skipped finisher holds conditioning while the session aggregate remains full',
    feedback.completion === 'full' && workout?._progressionState === 'hold');
  ok('skipped finisher cannot create positive conditioning progression',
    !hasPositiveProgression(workout?._progressionAdjustment));
}

{
  const feedback: SessionFeedback = {
    dateStr: '2026-07-07',
    completion: 'full',
    feeling: 'easy',
    soreness: 'none',
    components: [
      {
        componentId: 'power',
        kind: 'power',
        label: 'power work',
        completion: 'full',
      },
      {
        componentId: 'strength',
        kind: 'strength',
        label: 'strength work',
        completion: 'full',
      },
    ],
  };
  const baseline = buildFor();
  const workout = buildFor(feedback);
  ok('power completion does not become conditioning feedback',
    workout?._progressionState === baseline?._progressionState);
  ok('power completion does not change conditioning progression',
    JSON.stringify(workout?._progressionAdjustment) === JSON.stringify(baseline?._progressionAdjustment));
}

{
  const output = resolveConditioningProgression({
    tier: 'B-high',
    readiness: 'high',
    recentRPE: 4,
    completionQuality: 'full',
    hasRecentFeedback: true,
    hasAvoidInjury: false,
    hasModifyInjury: false,
    seasonPhase: 'In-season',
    weeklyConditioningCount: 1,
    daysToGame: 5,
    doubleGameWeek: false,
    highFatigueStrengthThisWeek: false,
    lastSessionProgressed: false,
    weeklyLoad: 1,
    previousWeekLoad: 1,
    currentReps: 6,
    currentIntervals: 4,
    currentDuration: 30,
    currentRest: 60,
  });
  ok('in-season hard conditioning does not aggressively progress',
    output.state === 'maintain' && !hasPositiveProgression(output.adjustment));
}

{
  const output = resolveConditioningProgression({
    tier: 'B-low',
    readiness: 'low',
    recentRPE: 4,
    completionQuality: 'full',
    hasRecentFeedback: true,
    sorenessLevel: 'none',
    hasAvoidInjury: false,
    hasModifyInjury: false,
    seasonPhase: 'Off-season',
    weeklyConditioningCount: 1,
    daysToGame: null,
    doubleGameWeek: false,
    highFatigueStrengthThisWeek: false,
    lastSessionProgressed: false,
    weeklyLoad: 1,
    previousWeekLoad: 1,
    currentReps: 6,
    currentIntervals: 4,
    currentDuration: 30,
    currentRest: 60,
  });
  ok('low readiness with recent feedback does not progress conditioning',
    output.state !== 'build' && !hasPositiveProgression(output.adjustment));
}

{
  const output = resolveConditioningProgression({
    tier: 'B-low',
    readiness: 'high',
    recentRPE: 4,
    completionQuality: 'full',
    hasRecentFeedback: true,
    sorenessLevel: 'high',
    hasAvoidInjury: false,
    hasModifyInjury: false,
    seasonPhase: 'Off-season',
    weeklyConditioningCount: 1,
    daysToGame: null,
    doubleGameWeek: false,
    highFatigueStrengthThisWeek: false,
    lastSessionProgressed: false,
    weeklyLoad: 1,
    previousWeekLoad: 1,
    currentReps: 6,
    currentIntervals: 4,
    currentDuration: 30,
    currentRest: 60,
  });
  ok('soreness feedback does not progress conditioning',
    output.state !== 'build' && !hasPositiveProgression(output.adjustment));
}

{
  const rows: WorkoutExercise[] = [
    condEx('cond-test-warmup', 'Warm-up', 1, 1, 1, 1, 0),
    condEx('cond-test-main', 'Tempo intervals', 2, 4, 1, 1, 60),
  ];
  const overrides = deriveConditioningProgressionInputOverrides({
    feedback: conditioningFeedback({
      date: '2026-07-07',
      completion: 'full',
      feeling: 'easy',
      rpe: 4,
      totalTimeMinutes: 38,
      intervalsCompleted: 5,
      roundsCompleted: 3,
      calories: 120,
      distanceMeters: 2200,
    }),
    exercises: rows,
    baseDuration: 35,
  });
  ok('performance logs feed recent RPE', overrides.recentRPE === 4);
  ok('performance logs feed duration', overrides.currentDuration === 38);
  ok('performance logs feed intervals', overrides.currentIntervals === 5);
  ok('performance logs feed rounds as reps', overrides.currentReps === 3);
}

{
  const workout = buildConditioningSession(
    '2026-07-14',
    [],
    DEFAULT_ATHLETE_CONTEXT,
    'Off-season',
    baseWeekLog({
      sessions: [
        { dateStr: '2026-07-14', tier: 'B-high', exerciseName: 'Hard Row Intervals', fatigue: 'high' },
      ],
    }),
    'micro-1',
    {
      sessionFeedback: {
        '2026-07-07': conditioningFeedback({
          date: '2026-07-07',
          completion: 'full',
          feeling: 'easy',
          rpe: 4,
          totalTimeMinutes: 20,
        }),
      },
    },
  ) as any;
  ok('previous week conditioning load is used when available',
    /spike/i.test(workout?._progressionNote ?? ''));
}

console.log(`\nconditioningProgressionInputsTests: ${pass} passed, ${fail} failed`);

if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((name) => console.log(`  - ${name}`));
  process.exit(1);
}
