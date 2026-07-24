/**
 * The runtime generation-contract for athlete-visible exercise cues.
 *
 * Sam ruling (L10 run 3): the curated layer owns every athlete-visible word, so
 * a strength card must never render without a cue. A name that resolves to no
 * cue is a LOUD generation-contract violation at program acceptance, never a
 * silent cueless card.
 *
 * Scope is the render truth, not a name heuristic. Only rows that render as a
 * cued `StrengthExerciseCard` are in scope — and `getSessionComponentRows` is
 * the very partition the screen uses, so conditioning and recovery sessions
 * already yield NO strength rows (their freeform "Speed warm-up" / "Brisk
 * Walking" text renders in blocks, not as cued cards, and is exempt by that
 * render path). The predicate is `buildCueText === null`: a family-fallback cue
 * is still a curated cue, so a movement the app recognises is never flagged —
 * only a name that renders genuinely blank.
 */
import { getSessionComponentRows } from '../utils/sessionComponents';
import { buildCueText, DESCRIPTIVE_CONDITIONING_TYPES } from '../screens/home/dayWorkoutHelpers';
import { ExerciseVocabularyViolation } from '../utils/exerciseCanonicalisation';
import { logger } from '../utils/logger';
import type { Workout } from '../types/domain';

/**
 * Whether a session is in scope for the strength-cue contract. Conditioning,
 * recovery and speed sessions are exempt BY KIND (Sam ruling: conditioning /
 * flow content is not an exercise). Recovery and descriptive-conditioning types
 * are the screen's own top-level branches. Speed sessions carry `condExercises`
 * (a speed warm-up / acceleration micro-dose is conditioning content, not a
 * strength lift), so a `speedBlock` marks the whole session as conditioning-
 * family and exempt — its rows are not strength cards even though the current
 * partition leaves them in `strengthRows`.
 */
function rendersStrengthCards(workout: Partial<Workout> | null | undefined): boolean {
  const workoutType = workout?.workoutType;
  const isRecovery =
    workoutType === 'Recovery' || (workout as { sessionTier?: string })?.sessionTier === 'recovery';
  const isConditioning =
    !!workoutType && DESCRIPTIVE_CONDITIONING_TYPES.has(workoutType) && !isRecovery;
  const isSpeed = !!workout?.speedBlock;
  return !isRecovery && !isConditioning && !isSpeed;
}

/**
 * The distinct strength-card exercise names in a workout that render with NO
 * cue at all — the generation-contract violations for that workout. Empty for
 * conditioning / recovery sessions (they have no strength rows).
 */
export function cuelessStrengthCards(workout: Partial<Workout> | null | undefined): string[] {
  if (!rendersStrengthCards(workout)) return [];
  const rows = getSessionComponentRows(workout).strengthRows;
  const cueless: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name: string | undefined = row?.exercise?.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (buildCueText(name) === null) cueless.push(name);
  }
  return cueless;
}

/**
 * Enforce the cue contract over accepted workouts. Loud, but non-throwing: it
 * surfaces every offending name via `logger.error` rather than crashing program
 * generation, because an unresolved name is usually a curation gap that is Sam's
 * to close (a new cue), not a code fault to hard-fail on. The
 * `ExerciseVocabularyViolation` message names every offender so the gap is
 * actionable the moment it appears.
 */
export function enforceCuratedCueContract(
  workouts: ReadonlyArray<Partial<Workout> | null | undefined>,
  context: string,
): void {
  const seen = new Set<string>();
  for (const workout of workouts) {
    for (const name of cuelessStrengthCards(workout)) seen.add(name);
  }
  if (seen.size === 0) return;
  const violation = new ExerciseVocabularyViolation(context, [...seen]);
  logger.error(violation.message, { unresolved: violation.unresolved });
}
