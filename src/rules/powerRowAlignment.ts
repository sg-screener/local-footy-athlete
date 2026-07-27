/**
 * Final-content ownership for power rows.
 *
 * Allocation policy may propose power, but the final workout rows decide
 * whether that proposal is still honest after generation, filtering or edits.
 *
 * ## Why this module survived Stage 4 as a RENAME rather than a deletion
 *
 * The ownership reassessment listed `powerRowAlignment` for outright
 * deletion, reasoning that it "exists solely to keep a parallel structure
 * consistent with the list" — so one list would leave it no job. Half of that
 * is right: the parallel-structure job is gone, and the module's old NAME was
 * about a block that no longer exists.
 *
 * The other half is not. What it actually enforces is a programming rule, not a
 * sync: power is removed from a session with no same-family strength content,
 * and CONTRAST is downgraded to a primer unless a real heavy same-family main
 * lift survives to pair with. That is Section 4's contrast rule — contrast is a
 * heavy lift paired with an explosive movement, so without the heavy lift there
 * is nothing to contrast against. Deleting the file would have deleted the rule
 * and moved the golden, which is how a "cleanup" quietly changes what an
 * athlete is prescribed.
 *
 * So the block-shaped module dies and the rule moves house, under a name that
 * says what it now governs.
 */

import type { Workout } from '../types/domain';
import type { PowerFamily } from './powerPrimerPolicy';
import { powerRows, withoutPowerRows } from './sessionRowCounting';
import { getExerciseTags } from '../data/exerciseTags';
import { resolveExerciseName } from '../utils/loadEstimation';
import { getSessionComponentRows } from '../utils/sessionComponents';

export type PowerRowAlignmentAction = 'unchanged' | 'removed' | 'downgraded';

export interface PowerRowAlignmentResult {
  workout: Workout;
  action: PowerRowAlignmentAction;
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
export function alignPowerToFinalWorkoutContent(
  workout: Workout,
): PowerRowAlignmentResult {
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
