/**
 * Final-content ownership for rendered power blocks.
 *
 * Allocation policy may propose power, but the final workout rows decide
 * whether that proposal is still honest after generation, filtering or edits.
 */

import type { Workout } from '../types/domain';
import type { PowerFamily } from './powerPrimerPolicy';
import { powerRows, withoutPowerRows } from './sessionRowCounting';
import { getExerciseTags } from '../data/exerciseTags';
import { resolveExerciseName } from '../utils/loadEstimation';
import { getSessionComponentRows } from '../utils/sessionComponents';

export type PowerBlockAlignmentAction = 'unchanged' | 'removed' | 'downgraded';

export interface PowerBlockAlignmentResult {
  workout: Workout;
  action: PowerBlockAlignmentAction;
  reason: string | null;
}

const LOWER_MOVEMENTS = new Set(['squat', 'lunge', 'hinge']);
const UPPER_MOVEMENTS = new Set([
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
]);

function rowSignal(row: any): {
  family: PowerFamily | null;
  heavy: boolean;
} {
  const name = String(row?.exercise?.name ?? '').trim();
  const tags = name ? getExerciseTags(resolveExerciseName(name)) : undefined;
  if (!tags) return { family: null, heavy: false };

  const family: PowerFamily | null = LOWER_MOVEMENTS.has(tags.movement)
    ? 'lower'
    : UPPER_MOVEMENTS.has(tags.movement)
      ? 'upper'
      : null;
  const prescribedAsHeavyMainLift =
    tags.load !== 'low' &&
    Number(row?.prescribedRepsMax ?? 99) <= 6 &&
    (tags.load === 'high' || Number(row?.prescribedWeightKg ?? 0) > 0);
  return {
    family,
    heavy: family !== null && prescribedAsHeavyMainLift,
  };
}

/**
 * Remove power from sessions without same-family strength. Contrast is
 * downgraded to a primer unless a real heavy same-family main lift survives.
 */
export function alignPowerBlockToFinalWorkoutContent(
  workout: Workout,
): PowerBlockAlignmentResult {
  const rows = powerRows(workout);
  if (rows.length === 0) return { workout, action: 'unchanged', reason: null };
  const family = rows[0].power?.family;
  const kind = rows[0].power?.kind;

  // `strengthRows` no longer contains power — the component owner gives power its
  // own population — so this reads only real strength content, which is what it
  // always meant to ask.
  const signals = getSessionComponentRows(workout).strengthRows.map(rowSignal);
  const sameFamily = signals.filter((signal) => signal.family === family);
  if (sameFamily.length === 0) {
    return {
      workout: withoutPowerRows(workout),
      action: 'removed',
      reason: 'no_same_family_strength_content',
    };
  }

  if (kind === 'contrast' && !sameFamily.some((signal) => signal.heavy)) {
    return {
      workout: {
        ...workout,
        exercises: (workout.exercises ?? []).map((row) => row.role === 'power' && row.power
          ? {
              ...row,
              power: { ...row.power, kind: 'primer' as const },
              notes: `${(row.notes ?? '').replace(/\s*Contrast:[^]*$/i, '').trim()} Use this as a standalone primer before strength work.`.trim(),
            }
          : row),
      },
      action: 'downgraded',
      reason: 'no_heavy_same_family_main_lift',
    };
  }

  return { workout, action: 'unchanged', reason: null };
}
