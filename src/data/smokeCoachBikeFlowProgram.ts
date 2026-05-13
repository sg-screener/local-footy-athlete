/**
 * Shared fixture for the coach-bike-flow smoke.
 *
 * Both the deterministic pipeline test (src/__tests__/smokeCoachBikeFlowTests.ts)
 * and the live smoke bootstrap (src/utils/smokeBootstrap.ts → seedOnboardingProgram)
 * import from this file so the program/profile they install matches byte-for-byte.
 *
 * Without this shared fixture, the pipeline runs against a hand-rolled
 * Wednesday Easy Aerobic Flush ResolvedDay while the live app gets
 * DEFAULT_PROGRAM (whose Wednesday is "Upper Strength"). The coach
 * conversation then enters with no rower session to discuss, the first
 * turn answers with "Which day are you looking at?", and the smoke fails.
 *
 * The Wednesday workout shape mirrors what Sam's live engine produces for
 * an in-season Wednesday aerobic-base conditioning slot — parenthetical
 * dosage in name + description, Rower-tagged conditioning option title,
 * and a per-exercise note string. That shape is what the bike-subtype +
 * row→bike rewrite chain in the deterministic pipeline assumes.
 */

import type {
  TrainingProgram,
  Microcycle,
  Workout,
  WorkoutExercise,
} from '../types/domain';
import { computeBlockBounds } from '../utils/sessionResolver';

// Canonical labels — exported so callers (CoachScreen smoke-visible-week-ready
// gate, contract tests, pipeline fixture, harness diagnostics) compare against
// the SAME strings the fixture emits.
export const SMOKE_WEDNESDAY_WORKOUT_NAME = 'Easy Aerobic Flush';
export const SMOKE_WEDNESDAY_DESCRIPTION =
  '20min easy Rower. Cruise pace. 3-4/10.';
export const SMOKE_WEDNESDAY_OPTION_TITLE = 'Easy Aerobic Flush (20min Rower)';
export const SMOKE_WEDNESDAY_DOSAGE_TOKEN = '20min';
export const SMOKE_WEDNESDAY_PRE_CHANGE_MODALITY = /\brower\b/i;

const NOW_ISO = '2026-01-01T00:00:00.000Z';

function fixtureWorkoutExercise(
  workoutId: string,
  exerciseId: string,
  name: string,
  notes: string,
): WorkoutExercise {
  return {
    id: `we-${workoutId}`,
    workoutId,
    exerciseId,
    exerciseOrder: 1,
    prescribedSets: 1,
    prescribedRepsMin: 1,
    prescribedRepsMax: 1,
    prescribedWeightKg: 0,
    restSeconds: 0,
    notes,
    exercise: {
      id: exerciseId,
      name,
      description: name,
      exerciseType: 'Compound' as any,
      muscleGroups: [],
      equipmentRequired: [],
      difficultyLevel: 'Intermediate' as any,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    } as any,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
}

/**
 * Build a Wednesday Easy Aerobic Flush (20min Rower) workout that mirrors
 * the live engine's "in-season aerobic-base mid-week" shape. Used by both
 * the live smoke bootstrap (inside a TrainingProgram) and the pipeline
 * test (as a standalone Workout it can stuff into ResolvedDay).
 */
export function buildSmokeWednesdayWorkout(microcycleId: string): Workout {
  const exerciseId = 'ex-easy-aerobic-flush-rower';
  const workoutId = 'wk-smoke-wed-easy-flush';
  const wx = fixtureWorkoutExercise(
    workoutId,
    exerciseId,
    SMOKE_WEDNESDAY_OPTION_TITLE,
    'Cruise on the Rower. 20min easy. 3-4/10.',
  );
  return {
    id: workoutId,
    microcycleId,
    dayOfWeek: 3,
    name: SMOKE_WEDNESDAY_WORKOUT_NAME,
    description: SMOKE_WEDNESDAY_DESCRIPTION,
    durationMinutes: 20,
    intensity: 'Easy' as any,
    workoutType: 'Conditioning' as any,
    sessionTier: 'core' as any,
    hasCombinedConditioning: false,
    conditioningCategory: 'aerobic_base',
    conditioningBlock: {
      intent: 'aerobic' as any,
      options: [
        {
          title: SMOKE_WEDNESDAY_OPTION_TITLE,
          description: SMOKE_WEDNESDAY_DESCRIPTION,
          exerciseIds: [wx.id],
        },
      ],
    },
    coachNotes: [],
    exercises: [wx],
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
}

function minimalDayWorkout(
  microcycleId: string,
  dayOfWeek: number,
  name: string,
  workoutType: string,
  sessionTier: 'core' | 'optional' = 'core',
): Workout {
  const workoutId = `wk-smoke-dow-${dayOfWeek}`;
  const wx = fixtureWorkoutExercise(
    workoutId,
    `ex-smoke-${dayOfWeek}`,
    name,
    '',
  );
  return {
    id: workoutId,
    microcycleId,
    dayOfWeek,
    name,
    description: name,
    durationMinutes: 45,
    intensity: 'Moderate' as any,
    workoutType: workoutType as any,
    sessionTier,
    coachNotes: [],
    exercises: [wx],
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
}

/**
 * Build a deterministic TrainingProgram whose Wednesday entry is the
 * Easy Aerobic Flush rower session the pipeline + coach flow expect.
 *
 * The block starts on the current week's Monday so that today's date is
 * always in-block — sessionResolver.resolveWeekWithConditioning only
 * looks up template workouts when the requested date is inside the
 * program block, otherwise the resolved week comes back empty.
 */
export function buildSmokeCoachBikeFlowProgram(today: Date = new Date()): TrainingProgram {
  const { blockStart, blockEnd } = computeBlockBounds(today);
  const startISO = new Date(blockStart + 'T12:00:00').toISOString();
  const endISO = new Date(blockEnd + 'T12:00:00').toISOString();
  const programId = 'prog-smoke-coach-bike-flow';
  const microcycleId = 'mc-smoke-coach-bike-flow';

  const microcycle: Microcycle = {
    id: microcycleId,
    programId,
    weekNumber: 1,
    startDate: startISO,
    endDate: endISO,
    miniCycleNumber: 1,
    intensityMultiplier: 1.0,
    workouts: [
      minimalDayWorkout(microcycleId, 1, 'Lower Body Strength', 'Strength'),
      minimalDayWorkout(microcycleId, 2, 'Team Training', 'Team Training'),
      buildSmokeWednesdayWorkout(microcycleId),
      minimalDayWorkout(microcycleId, 4, 'Team Training', 'Team Training'),
      minimalDayWorkout(microcycleId, 5, 'Upper Body Strength', 'Strength'),
      minimalDayWorkout(microcycleId, 6, 'Game Day', 'Game', 'core'),
    ],
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };

  return {
    id: programId,
    userId: 'user-smoke-coach-bike-flow',
    name: 'Smoke: Coach bike-flow fixture',
    description:
      'Deterministic program installed by the coach-bike-flow smoke. ' +
      'Wednesday = Easy Aerobic Flush (20min Rower); the three-turn coach ' +
      'mutation rewrites it into a regular bike Easy Aerobic Flush.',
    programPhase: 'In-Season' as any,
    startDate: startISO,
    endDate: endISO,
    primaryFocus: 'Conditioning + Strength',
    isActive: true,
    microcycles: [microcycle],
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
}
