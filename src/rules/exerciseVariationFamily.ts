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
  | 'face_pull'
  | 'tib_raise'
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
  face_pull: ['Face Pull', 'Cable Face Pull'],
  tib_raise: ['Tib Raises', 'T-Bar Tib Raises'],
  lat_pulldown: [
    'Lat Pulldown',
    'Neutral-Grip Pulldown',
    'Single-Arm Lat Pulldown',
  ],
  romanian_deadlift: ['RDLs', 'Single-Leg RDL'],
};

/**
 * A loaded exercise that replaces one equipment-free base movement when it is
 * legal in the current candidate set. The target's authored equipment row owns
 * what makes it legal; this relation owns only the progression identity.
 */
export interface EquipmentExerciseProgression {
  readonly source: string;
  readonly target: string;
}

export const EQUIPMENT_EXERCISE_PROGRESSIONS: readonly EquipmentExerciseProgression[] = [
  { source: 'Tib Raises', target: 'T-Bar Tib Raises' },
];

export function equipmentExerciseProgressionFor(
  source: string,
): EquipmentExerciseProgression | null {
  const canonical = resolveExerciseName(source);
  return EQUIPMENT_EXERCISE_PROGRESSIONS.find((row) =>
    resolveExerciseName(row.source) === canonical) ?? null;
}

/**
 * Prefer an available progression without inventing availability. Callers pass
 * candidates after their normal equipment, injury and experience legality
 * filters; if the target survived, the base identity yields its seat.
 */
export function preferAvailableEquipmentProgressions<T>(
  candidates: readonly T[],
  nameOf: (candidate: T) => string,
): T[] {
  const names = new Set(candidates.map((candidate) => resolveExerciseName(nameOf(candidate))));
  const replaced = new Set(EQUIPMENT_EXERCISE_PROGRESSIONS
    .filter((row) => names.has(resolveExerciseName(row.target)))
    .map((row) => resolveExerciseName(row.source)));
  return candidates.filter((candidate) => !replaced.has(resolveExerciseName(nameOf(candidate))));
}

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
