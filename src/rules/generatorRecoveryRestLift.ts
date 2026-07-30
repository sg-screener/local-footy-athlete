/**
 * The read-ingress lift that takes back the recovery sessions the generator
 * placed uninvited.
 *
 * Sam's ruling, 2026-07-30 (`docs/SESSION_TYPE_CHARTER_2026-07-30.md`): the
 * generator never places optional work uninvited, and Recovery is the athlete's
 * to choose. Nine placement sites in `coachingEngine.ts` are deleted in the same
 * commit as this file. This is what happens to the ones already on a phone.
 *
 * ## Why a lift is not optional
 *
 * `currentProgram` is persisted whole. Every athlete who generated before this
 * commit has recovery sessions sitting in storage that the app placed and no
 * authored source called for. Without a lift they stay there until the next
 * regeneration — so the deletion would ship as a change that only affects new
 * athletes, and Sam's own week would keep showing the sessions the ruling
 * removed.
 *
 * ## L15 — this is a READ-INGRESS LIFT, never a writer
 *
 * "New saves are always written in the current canonical format; superseded
 * formats are never written again, by anything, ever. Old formats exist only as
 * read-ingress lifts at the boundary." It runs where
 * `migrateStoredPowerBlocks` runs, for the same reason and with the same
 * property: idempotent by construction, so running it on every read forever
 * costs nothing and cannot drift.
 *
 * ## Rest is an ABSENCE here, and that is deliberate
 *
 * The lift REMOVES the workout rather than replacing it with a rest stub. A rest
 * stub would be a stored derived output — the thing `docs/NORTH_STAR.md` presumes
 * wrong — and it would leave stored weeks carrying a shape freshly generated
 * weeks do not, which is two formats for one fact. After the lift a hydrated week
 * and a regenerated week agree, which is the whole point of doing it at ingress.
 *
 * ## What it refuses to touch, and why the boundary is drawn HERE
 *
 * Only the GENERATOR's placements are taken back. The athlete's own recovery —
 * chosen through the recovery door, which the Bible grants outright at :122 — is
 * theirs and is never lifted. Three rules keep that true, and all three are
 * conservative in the same direction, because the two mistakes are not
 * symmetrical: leaving one generator session behind costs an athlete nothing
 * (it no longer breaks their rest either way), while removing one session they
 * chose is deleting their decision.
 *
 *   1. It runs on the PLAN only — `currentProgram` and `currentMicrocycle`.
 *      `dateOverrides` and `weekScopedOverlays` are athlete-owned surfaces and
 *      are never visited.
 *   2. Inside the plan, a workout carrying registry-template rows
 *      (`template:<id>:…`) came through an athlete door and stays.
 *   3. Anything carrying an athlete-placement stamp or an athlete/coach-owned
 *      provenance stays.
 */

import type { Workout } from '../types/domain';

/** Is this stored workout a recovery session at all? */
function isRecoverySession(workout: Workout): boolean {
  return workout.workoutType === 'Recovery' || workout.sessionTier === 'recovery';
}

/**
 * Did an athlete door put this here?
 *
 * Registry templates stamp every row `template:<templateId>:<key>`, and the
 * recovery door is the only way one of those reaches a program. The stamp is on
 * the ROWS rather than the workout, which is why this reads them.
 */
function carriesRegistryTemplateRows(workout: Workout): boolean {
  return (workout.exercises ?? []).some((row) =>
    typeof row?.id === 'string' && row.id.startsWith('template:'));
}

/**
 * Is this a recovery session the GENERATOR placed?
 *
 * Every clause is a reason to LEAVE IT ALONE. There is no clause that makes a
 * borderline workout liftable, and that asymmetry is the design: an unlifted
 * generator session is harmless under the Rest law, and a lifted athlete session
 * is a deleted decision.
 */
export function isGeneratorPlacedRecovery(workout: Workout | null | undefined): boolean {
  if (!workout) return false;
  if (!isRecoverySession(workout)) return false;
  if (workout.athletePlacement) return false;
  if (carriesRegistryTemplateRows(workout)) return false;
  const provenance = workout.derivedSessionProvenance ?? [];
  if (provenance.some((record) => record?.origin && String(record.origin).includes('athlete'))) {
    return false;
  }
  return true;
}

/**
 * The lift. Returns the SAME array reference when nothing changes, so hydration
 * can run it unconditionally without churning object identity.
 */
export function liftGeneratorRecoveryToRest(
  workouts: readonly Workout[] | undefined,
): Workout[] {
  const list = workouts ?? [];
  const kept = list.filter((workout) => !isGeneratorPlacedRecovery(workout));
  return kept.length === list.length ? (list as Workout[]) : kept;
}

/**
 * Does this set still carry a generator-placed recovery session?
 *
 * The second lock, in the gate's hands rather than as a runtime throw: a
 * freshly generated program must contain none, which is
 * "the generator never places optional work uninvited" in the only form that can
 * be checked by running the generator instead of by reading it.
 */
export function hasGeneratorPlacedRecovery(workouts: readonly Workout[] | undefined): boolean {
  return (workouts ?? []).some(isGeneratorPlacedRecovery);
}
