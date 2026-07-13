/**
 * Weekly plan display owns placement; conditioningVisibleIdentity owns every
 * canonical conditioning label and dose.
 */

import type { Workout } from '../types/domain';
import {
  projectConditioningVisibleIdentity,
  type ConditioningVisibleIdentity,
} from './conditioningVisibleIdentity';
import { splitSessionName } from './sessionNaming';

export type ConditioningDisplayCategory = ConditioningVisibleIdentity['primaryLabel'];

export type WeeklyDisplayWorkout = Partial<Workout> & {
  name?: string | null;
  workoutType?: string | null;
  sessionTier?: string | null;
};

function legacyConditioningText(workout: WeeklyDisplayWorkout): string {
  return [
    workout.name,
    workout.description,
    ...(workout.exercises ?? []).flatMap((row: any) => [
      row?.exercise?.name,
      row?.exercise?.description,
      row?.notes,
    ]),
  ].filter(Boolean).join(' ');
}

/** Controlled display-only fallback for genuinely legacy, untyped records. */
function legacyConditioningLabel(workout: WeeklyDisplayWorkout): ConditioningDisplayCategory {
  const text = legacyConditioningText(workout);
  if (/\b(?:sprint|speed|flying)\b/i.test(text)) return 'Speed Conditioning';
  if (/\b(?:vo2|glycolytic|tabata|mas|hard|all[-\s]?out|work.?capacity|emom)\b/i.test(text)) {
    return 'Hard Intervals';
  }
  if (/\btempo\b/i.test(text)) return 'Tempo Intervals';
  if (/\b(?:aerobic\s+flush|flush(?:\s+out)?)\b/i.test(text)) return 'Aerobic Flush';
  if (/\brecovery\b/i.test(text)) return 'Recovery Conditioning';
  const repeated = text.match(/\b(\d+)\s*(?:x|×)\s*\(?\s*(\d+(?:\.\d+)?)\s*(?:min|minute|sec|second|s)\b/i);
  if (repeated) {
    const duration = Number(repeated[2]);
    const seconds = /(?:sec|second|s)\b/i.test(repeated[0]) && !/min|minute/i.test(repeated[0])
      ? duration
      : duration * 60;
    return seconds >= 180 ? 'Long Aerobic Intervals' : 'Short Aerobic Intervals';
  }
  if (/\b\d+(?:\.\d+)?\s*(?:min|minute)s?\b/i.test(text)) return 'Continuous Aerobic';
  return 'Aerobic Conditioning';
}

/** Canonical structure/purpose identity, with a legacy fallback only when no typed owner exists. */
export function classifyConditioningWorkout(
  workout: WeeklyDisplayWorkout,
): ConditioningDisplayCategory {
  return projectConditioningVisibleIdentity(workout as Partial<Workout>)?.primaryLabel ??
    legacyConditioningLabel(workout);
}

export function conditioningIdentityForWeeklyPlan(
  workout: WeeklyDisplayWorkout | null | undefined,
): ConditioningVisibleIdentity | null {
  if (!workout) return null;
  return projectConditioningVisibleIdentity(workout as Partial<Workout>);
}

/** Structure label for the conditioning half of an attached session. */
export function combinedConditioningCategoryLabel(
  workout: WeeklyDisplayWorkout,
): ConditioningDisplayCategory | null {
  if (!workout?.hasCombinedConditioning && !workout?.conditioningBlock?.attachedKind) return null;
  return projectConditioningVisibleIdentity(workout as Partial<Workout>)?.attachedLabel ??
    legacyConditioningLabel(workout);
}

function isStandaloneConditioning(workout: WeeklyDisplayWorkout): boolean {
  if (workout.hasCombinedConditioning || workout.conditioningBlock?.attachedKind) return false;
  return !!projectConditioningVisibleIdentity(workout as Partial<Workout>) ||
    /\b(?:conditioning|aerobic|tempo|interval|sprint|run|flush)\b/i.test(
      `${workout.workoutType ?? ''} ${workout.name ?? ''}`,
    );
}

/** Primary title shown on the weekly plan. */
export function weeklyPlanTitle(workout: WeeklyDisplayWorkout): string {
  const name = String(workout.name ?? '').trim();
  if (!name) return '';

  const identity = projectConditioningVisibleIdentity(workout as Partial<Workout>);
  if (identity && isStandaloneConditioning(workout)) return identity.primaryLabel;

  const isRecovery = workout.workoutType === 'Recovery' || workout.sessionTier === 'recovery';
  if (isRecovery) return 'Recovery';
  if (name === 'Prehab & Accessories') return 'Accessories';

  if (isStandaloneConditioning(workout)) return legacyConditioningLabel(workout);
  return splitSessionName(name).title || name;
}

/** Secondary weekly line: attached family, or standalone canonical dose. */
export function weeklyPlanContextLabel(
  workout: WeeklyDisplayWorkout | null | undefined,
): string | null {
  if (!workout) return null;
  const identity = projectConditioningVisibleIdentity(workout as Partial<Workout>);
  if (workout.hasCombinedConditioning || workout.conditioningBlock?.attachedKind) {
    return identity?.attachedLabel ?? legacyConditioningLabel(workout);
  }
  return identity?.doseLabel ?? null;
}
