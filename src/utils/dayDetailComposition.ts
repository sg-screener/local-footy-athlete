/**
 * THE DAY DETAIL SURFACE, MADE CALLABLE.
 *
 * Extracted VERBATIM from `useDayWorkout`'s `derived` memo, whose dependency list
 * was already exactly `[rawWorkout, workout]` — the composition was pure and was
 * merely trapped inside a React hook. Nothing about it changed in the move.
 *
 * WHY IT HAD TO COME OUT. Sam photographed three surfaces telling three stories
 * about one day. The card's story and the canonical projection's story can both be
 * read from a node harness; the DETAIL's story could not, because it is composed
 * here at render. So `surfaceAgreementTests` cells 1, 3 and 4 passed while
 * comparing two DOMAIN projections that agree, and the two defects he actually
 * photographed were not in the comparison at all — `harness-enters-below-the-door`
 * for the third time, render-side.
 *
 * This module is not the fix. It is what makes the defect assertable. The
 * composition it contains is on the reassessment's deletion list (path 3 of nine):
 * once `project()` ships `parts` with `rows` already resolved, the detail screen
 * renders them and this file goes. Until then it exists so the harness enters the
 * door the athlete uses.
 *
 * NO CALLER MAY GROW A SECOND ONE. `useDayWorkout` is the only production caller;
 * `dayDetailCompositionOwnershipTests` pins that, so a second surface cannot start
 * composing its own detail while the migration is in flight.
 */

import type { Workout } from '../types/domain';
import { getTeamTrainingWorkoutState } from './teamTraining';
import { getSessionComponentRows } from './sessionComponents';
import { projectConditioningVisibleIdentity } from './conditioningVisibleIdentity';
import { DESCRIPTIVE_CONDITIONING_TYPES, LEGACY_FLAVOUR_TITLE, DAY_NAMES } from '../screens/home/dayWorkoutHelpers';

export interface ResolvedConditioningOption {
  title: string;
  description: string;
  rows: any[];
}

export interface ComposedDayDetail {
  exerciseCount: number;
  dayName: string;
  isTeamOnly: boolean;
  isRecovery: boolean;
  isConditioning: boolean;
  isCombinedDay: boolean;
  hasTeamTraining?: boolean;
  strengthExercises: any[];
  supportExercises: any[];
  conditioningExercises: any[];
  conditioningOptions: ResolvedConditioningOption[];
  conditioningRowCount: number;
}

/** The detail surface's own account of a day. Pure; same inputs, same answer. */
export function composeDayDetail(
  workout: Workout | null | undefined,
  rawWorkout: Workout | null | undefined,
): ComposedDayDetail {
  if (!workout) {
    return {
      exerciseCount: 0,
      dayName: '',
      isTeamOnly: false,
      isRecovery: false,
      isConditioning: false,
      isCombinedDay: false,
      strengthExercises: [] as any[],
      supportExercises: [] as any[],
      conditioningExercises: [] as any[],
      conditioningOptions: [] as ResolvedConditioningOption[],
      conditioningRowCount: 0,
    };
  }

  const teamState = getTeamTrainingWorkoutState(rawWorkout);
  const exerciseCount = teamState.renderableExercises.length;
  const dayName = DAY_NAMES[workout.dayOfWeek] || '';

  // Team Training is a session commitment, not a gym exercise. The
  // shared state object filters malformed legacy rows out of every
  // render branch and tells the UI whether a separate Team Training
  // card should be shown.
  const hasTeamTraining = teamState.hasTeamTraining;
  const isTeamOnly = teamState.isTeamTrainingOnly;

  // Recovery sessions — structured prescriptions, play buttons, formatted
  // sets/duration/reps. Detect via workoutType OR sessionTier to catch
  // AI-generated sessions with the wrong workoutType but correct tier.
  const isRecovery =
    !isTeamOnly &&
    (workout.workoutType === 'Recovery' ||
      (workout as any).sessionTier === 'recovery');

  // Conditioning sessions — descriptive phase cards, no numbered exercises.
  // Recovery wins when both would match (AI may tag recovery as Conditioning).
  const isConditioning =
    !isTeamOnly &&
    DESCRIPTIVE_CONDITIONING_TYPES.has(workout.workoutType) &&
    !isRecovery;

  // ── Combined S+C day: resolve conditioning from workout.conditioningBlock ──
  //
  // The builder attaches a structured `conditioningBlock` with a single
  // intent and one or more training-equivalent options. Each option owns
  // its title, description, and the ids of the WorkoutExercise rows it
  // renders — so header and rows can never drift.
  const isCombinedDay =
    !!workout.hasCombinedConditioning && !isConditioning && !isRecovery;
  const condBlock = workout.conditioningBlock;
  const conditioningIdentity = projectConditioningVisibleIdentity(workout);
  const componentRows = getSessionComponentRows(workout);
  const strengthExercises = componentRows.strengthRows;
  const supportExercises = componentRows.supportRows;
  const conditioningExercises = componentRows.conditioningRows;
  let conditioningOptions: ResolvedConditioningOption[] = [];

  if (isCombinedDay && condBlock) {
    // Structured path — drive rows from resolved exerciseIds only.
    conditioningOptions = condBlock.options.map((opt: any) => {
      const optIds = new Set<string>(opt.exerciseIds);
      return {
        title: conditioningIdentity?.attachedLabel ?? opt.title,
        description: opt.description,
        rows: conditioningExercises.filter((ex: any) => optIds.has(ex.id)),
      };
    });
  } else if (isCombinedDay && conditioningExercises.length > 0) {
    // Legacy fallback uses the shared component owner to separate the tail;
    // trunk/support rows cannot leak into conditioning.
    const legacyTitle =
      (workout.conditioningFlavour &&
        LEGACY_FLAVOUR_TITLE[workout.conditioningFlavour]) ||
      'Conditioning';
    conditioningOptions = [
      {
        title: conditioningIdentity?.attachedLabel ?? legacyTitle,
        description: '',
        rows: conditioningExercises,
      },
    ];
  }

  const conditioningRowCount = conditioningOptions.reduce(
    (sum, o) => sum + o.rows.length,
    0,
  );

  return {
    exerciseCount,
    dayName,
    isTeamOnly,
    isRecovery,
    isConditioning,
    isCombinedDay,
    hasTeamTraining,
    strengthExercises,
    supportExercises,
    conditioningExercises,
    conditioningOptions,
    conditioningRowCount,
  };
}
