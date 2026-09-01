/**
 * Explicit exercise-variation identity for same-session composition.
 *
 * Movement tags answer what a row trains; pool slots answer where it may be
 * programmed. Neither says whether two separately named rows are effectively
 * the same variation for one session. This table does, without parsing words
 * from athlete-facing names.
 */
import { resolveExerciseName } from '../utils/loadEstimation';

export type ExerciseVariationFamily =
  | 'bench_press'
  | 'overhead_press'
  | 'chest_supported_row'
  | 'bodyweight_vertical_pull'
  | 'bodyweight_horizontal_push'
  | 'lat_pulldown'
  | 'romanian_deadlift';

const FAMILY_MEMBERS: Readonly<Record<ExerciseVariationFamily, readonly string[]>> = {
  bench_press: [
    'Bench Press',
    'Incline Bench',
    'Close Grip Bench',
    'DB Bench Press',
    'Incline DB Bench',
    'Single-Arm DB Bench Press',
    'Single-Arm DB Floor Press',
  ],
  overhead_press: [
    'Overhead Press',
    'Landmine Press',
    'DB Shoulder Press',
    'Seated DB Press',
    'Half-Kneeling Single-Arm Overhead Press',
    'Z-Press',
  ],
  chest_supported_row: [
    'Chest Supported Row',
    'Chest-Supported DB Row',
  ],
  bodyweight_vertical_pull: ['Pull-Ups', 'Band-Assisted Pull-Up', 'Chin-Ups'],
  bodyweight_horizontal_push: ['Push-ups', 'Incline Push-Up'],
  lat_pulldown: [
    'Lat Pulldown',
    'Neutral-Grip Pulldown',
    'Single-Arm Lat Pulldown',
  ],
  romanian_deadlift: ['RDLs', 'Single-Leg RDL'],
};

const FAMILY_BY_CANONICAL_NAME: ReadonlyMap<string, ExerciseVariationFamily> = new Map(
  (Object.entries(FAMILY_MEMBERS) as [ExerciseVariationFamily, readonly string[]][])
    .flatMap(([family, names]) => names.map((name) => [
      resolveExerciseName(name).toLowerCase(), family,
    ] as const)),
);

export function exerciseVariationFamily(
  rawName: string | null | undefined,
): ExerciseVariationFamily | null {
  if (!rawName) return null;
  return FAMILY_BY_CANONICAL_NAME.get(resolveExerciseName(rawName).toLowerCase()) ?? null;
}

export function sameExerciseVariationFamily(left: string, right: string): boolean {
  const family = exerciseVariationFamily(left);
  return family !== null && family === exerciseVariationFamily(right);
}

export function sessionHasExerciseVariationCollision(
  exerciseNames: readonly string[],
): boolean {
  const seen = new Set<ExerciseVariationFamily>();
  for (const name of exerciseNames) {
    const family = exerciseVariationFamily(name);
    if (!family) continue;
    if (seen.has(family)) return true;
    seen.add(family);
  }
  return false;
}

export function exerciseVariationConflictsWithSession(args: {
  readonly candidate: string;
  readonly existingExerciseNames: readonly string[];
  /** A swap removes this row before inserting the candidate. Add omits it. */
  readonly replacingExerciseName?: string;
}): boolean {
  const candidateFamily = exerciseVariationFamily(args.candidate);
  if (!candidateFamily) return false;
  const replacing = args.replacingExerciseName
    ? resolveExerciseName(args.replacingExerciseName).toLowerCase()
    : null;
  return args.existingExerciseNames.some((name) => (
    resolveExerciseName(name).toLowerCase() !== replacing
    && exerciseVariationFamily(name) === candidateFamily
  ));
}
