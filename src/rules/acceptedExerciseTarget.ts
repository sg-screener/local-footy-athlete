/** Stable coordinates of the row the athlete chose; never a regenerated row ID. */
import type { Workout, WorkoutExercise } from '../types/domain';
export interface AcceptedExerciseTarget {
  readonly protocolVersion: 1;
  readonly originalIdentity: string;
  readonly role: string;
  readonly slot: string | null;
  readonly pattern: string | null;
  readonly uniqueSeat: boolean;
}
function sameSeat(row: WorkoutExercise, target: AcceptedExerciseTarget): boolean {
  const e = row.section18Evidence;
  return !!e && e.role === target.role && (e.slot ?? null) === target.slot
    && (e.strengthPattern ?? null) === target.pattern;
}
export function captureAcceptedExerciseTarget(workout: Workout, row: WorkoutExercise): AcceptedExerciseTarget | undefined {
  const e = row.section18Evidence;
  if (!e) return undefined;
  const target: AcceptedExerciseTarget = { protocolVersion: 1,
    originalIdentity: row.exercise.name, role: e.role, slot: e.slot ?? null,
    pattern: e.strengthPattern ?? null, uniqueSeat: false };
  return { ...target, uniqueSeat: !!target.slot && workout.exercises.filter(r => sameSeat(r,target)).length === 1 };
}
export function resolveAcceptedExerciseTarget(workout: Workout, target: AcceptedExerciseTarget, componentId?: string | null): number | null {
  const seats = workout.exercises.map((row,index)=>({row,index})).filter(x=>sameSeat(x.row,target));
  const exact = seats.filter(x=>[x.row.id,x.row.exerciseId,x.row.exercise.id].includes(componentId ?? ''));
  if (exact.length === 1) return exact[0]!.index;
  const identity = seats.filter(x=>x.row.exercise.name === target.originalIdentity);
  if (identity.length === 1) return identity[0]!.index;
  // A unique authored slot may change its exercise. Ambiguous/missing slots
  // never fall back to a similar muscle group or an array position.
  return target.uniqueSeat && seats.length === 1 ? seats[0]!.index : null;
}
