/**
 * The 2km time trial, as a SESSION.
 *
 * SAM'S RULING (2026-07-29): "it is a TEST, not a dose — lives outside the 55
 * conditioning rows, no conditioning-sheet entry; D14's 'run 2km, time it' is
 * its complete specification."
 *
 * That ruling is why this file exists rather than a 56th row in
 * `conditioningTemplates`. Every row on that sheet answers "how much, how hard,
 * how long" — a dose Sam authored. A time trial has no such answer to author:
 * the prescription IS the measurement. Adding a row would have meant inventing
 * work:rest, intensity and set structure for something whose whole content is
 * "run 2km as fast as you can", on a sheet signed at 55 rows whose own residue
 * section says the sessions it lacks are "listed, not invented".
 *
 * WHAT IT STILL NEEDED. Membership of `CONDITIONING_META` — one of the five
 * systems that define "this exercise exists" — plus its row on the master
 * exercise sheet with Sam's cue. Without those the session could never be
 * prescribed and the name would fail the hardcoded-literal lock. The exercise
 * name is therefore a curated one, resolved through the vocabulary rather than
 * written as a literal anywhere else.
 *
 * WHAT IT DID NOT NEED. Anything in the exposure counters. A `hard_conditioning`
 * unit on feet already counts as a running exposure, so the Bible's 4-run cap,
 * the team-training-day gates and the off-feet placement rules all apply to
 * this session the moment it exists, with no change to the cap owner.
 *
 * NAMING. `TT` means TEAM TRAINING in this codebase. Sam ruled the time trial
 * never shares that token — it is `timeTrial` / `time_trial` / `twoKm` here.
 */

import type { Workout, WorkoutExercise } from '../types/domain';
import { condEx } from '../utils/sessionBuilder';
import { formatTwoKmTime, recordTwoKmTime, type RecordTwoKmTimeResult } from './twoKmTimeTrial';

/**
 * The curated exercise name, exactly as it appears on the master sheet and in
 * `CONDITIONING_META`. Exported so no consumer writes the literal itself — a
 * second spelling would read as an unreconciled second exercise.
 */
export const TIME_TRIAL_EXERCISE_NAME = '2km Time Trial';

/** The distance, in metres. D14 chose 2km: the AFL club standard. */
export const TIME_TRIAL_DISTANCE_M = 2000;

/**
 * The session's exercise rows.
 *
 * One row, because there is one thing to do. The warm-up matters for a maximal
 * effort, so it is prescribed — but as guidance on the row, not as an invented
 * second dose with sets and reps of its own.
 */
export function buildTimeTrialSession(prefix: string): WorkoutExercise[] {
  return [
    condEx(
      `${prefix}-time-trial`,
      TIME_TRIAL_EXERCISE_NAME,
      1, 1, 1, 1, 0,
      [
        'Run 2km as fast as you can, and record your time.',
        'Warm up properly first — 10min easy jog + 3 x 80m strides.',
        'This sets every running pace in your program.',
      ].join('\n'),
    ),
  ];
}

/**
 * A `Workout` carrying the time trial, for the classifier and the exposure
 * counters.
 *
 * `conditioningCategory: 'vo2'` is the typed energy system, which resolves to
 * `hard_conditioning`; the exercise name resolves to a running modality. Those
 * two together make this a running exposure without any rule in the exposure
 * counter ever naming the time trial. D14 calls it "a real aerobic-power
 * session", which is what 'vo2' means in this enum.
 */
export function timeTrialWorkout(date: string): Workout {
  const now = new Date().toISOString();
  return {
    id: `time-trial-${date}`,
    name: '2km Time Trial',
    date,
    workoutType: 'Conditioning',
    conditioningCategory: 'vo2',
    exercises: buildTimeTrialSession(`time-trial-${date}`),
    createdAt: now,
    updatedAt: now,
  } as unknown as Workout;
}

/** Is this workout the time trial? Name-free — asks the exercise vocabulary. */
export function isTimeTrialSession(workout: Workout | null | undefined): boolean {
  if (!workout) return false;
  const rows = (workout.exercises ?? []) as WorkoutExercise[];
  return rows.some((ex) => ex.exercise?.name === TIME_TRIAL_EXERCISE_NAME);
}

/**
 * Record the result of a time trial the athlete actually ran.
 *
 * Straight through the one ingress with `source: 'session_log'`. The athlete's
 * real run beats whatever they estimated at onboarding — the same law as
 * weights, where `applyLoadEstimates` puts performed history above the
 * onboarding estimate.
 *
 * The bound applies here exactly as it does on the onboarding screen. A
 * mis-tapped stopwatch is refused rather than stored, because a stored
 * nonsense time would silently reprice every %MAS session in the app.
 */
export function recordTimeTrialResult(
  seconds: number,
  today: string,
): RecordTwoKmTimeResult {
  return recordTwoKmTime(seconds, 'session_log', today);
}

/** "7:15 for 2km" — for a result the athlete has just logged. */
export function timeTrialResultLabel(seconds: number): string {
  return `${formatTwoKmTime(seconds)} for 2km`;
}
