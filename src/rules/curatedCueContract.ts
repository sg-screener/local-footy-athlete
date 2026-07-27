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
 * The add-on rows in a workout that would render with no cue.
 *
 * Sam's run-7 ruling 3 extended the no-uncurated-text invariant here. Until then
 * an add-on row's display text came from a note string hardcoded in
 * `recoveryAddonBuilder`, so it was never missing and never checked — the
 * hardcoded string WAS the fallback that hid the gap. With the inline strings
 * retired, an add-on row shows the curated cue or nothing, which makes "nothing"
 * a visible defect and therefore worth enforcing.
 *
 * Unlike the strength scope there is no render-path exemption: an add-on row
 * renders on EVERY day type. The badged list gives it an ordinary row inside the
 * optional cluster, and a recovery-type day — exempt from the strength contract
 * because it has no strength rows — still renders its add-on box (§6 item 3).
 */
export function cuelessAddonRows(workout: Partial<Workout> | null | undefined): string[] {
  const addons = (workout as { recoveryAddons?: Array<{ exercises?: Array<{ name?: string }> }> })
    ?.recoveryAddons ?? [];
  const cueless: string[] = [];
  const seen = new Set<string>();
  for (const addon of addons) {
    for (const row of addon?.exercises ?? []) {
      const name = row?.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      if (buildCueText(name) === null) cueless.push(name);
    }
  }
  return cueless;
}

/**
 * Every name in a workout that would render as a cueless row — the whole session,
 * not one partition of it. This is what the acceptance gate enforces.
 */
export function cuelessSessionCards(workout: Partial<Workout> | null | undefined): string[] {
  const seen = new Set<string>([
    ...cuelessStrengthCards(workout),
    ...cuelessAddonRows(workout),
  ]);
  return [...seen];
}

/**
 * Enforce the cue contract over accepted workouts. THROWS
 * `ExerciseVocabularyViolation` naming every offender.
 *
 * This gate shipped first as a non-fatal `logger.error`, on the reasoning that
 * an unresolved name is a curation gap for Sam to close rather than a code fault
 * to hard-fail on. Device run 5 showed why that was wrong: a log nobody reads is
 * indistinguishable from no gate at all, and three superset-token variants
 * reached the athlete as blank cards while the "contract" quietly passed. Sam's
 * ruling is a loud generation-contract violation, never a silent cueless card —
 * so the invariant is ENFORCED at acceptance, not merely OBSERVED at render.
 *
 * Callers own the policy for the refusal: `generateProgram` turns it into an
 * honest, retryable `ProgramGenError` so the athlete is offered a rebuild rather
 * than shown a half-finished session.
 */
export function enforceCuratedCueContract(
  workouts: ReadonlyArray<Partial<Workout> | null | undefined>,
  context: string,
): void {
  refuse(workouts, context, cuelessSessionCards);
}

/**
 * The same refusal, scoped to add-on rows only.
 *
 * Each stage enforces what IT produced. `attachRecoveryAddonsToWeek` adds add-on
 * rows to workouts whose strength rows were already gated at acceptance, so
 * re-checking those there would report the same violation twice and, worse,
 * blame the attach stage for content it did not author.
 */
export function enforceCuratedAddonCueContract(
  workouts: ReadonlyArray<Partial<Workout> | null | undefined>,
  context: string,
): void {
  refuse(workouts, context, cuelessAddonRows);
}

function refuse(
  workouts: ReadonlyArray<Partial<Workout> | null | undefined>,
  context: string,
  offendersIn: (workout: Partial<Workout> | null | undefined) => string[],
): void {
  const seen = new Set<string>();
  for (const workout of workouts) {
    for (const name of offendersIn(workout)) seen.add(name);
  }
  if (seen.size === 0) return;
  const violation = new ExerciseVocabularyViolation(context, [...seen]);
  logger.error(violation.message, { unresolved: violation.unresolved });
  throw violation;
}
