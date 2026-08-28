/**
 * **THE PAYLOAD FOR "REPLACE THIS ROW WITH THAT EXERCISE".**
 *
 * Extracted from `DayWorkoutScreenV2`'s local `baseSuggestion` on 2026-08-18,
 * because what it decides is a RULE and not a rendering: *which load does the
 * athlete see on an exercise they have just swapped in.* Sam ruled it the same
 * day — *"the replacement exercise must show its own history, authored estimate,
 * bodyweight default or blank — never the outgoing exercise's load"* — and a
 * rule living inside a 4,400-line screen cannot be asserted by anything that
 * does not mount React Native. It is here so a headless cell can hold it.
 *
 * ## THE DEFECT THIS SHAPE EXISTS TO PREVENT, measured on glass 2026-08-18
 *
 * `Single-Leg RDL` (20 kg) swapped for the app's own offered `Glute Bridge`
 * produced **`BW + 20kg`** on the athlete's session screen, while
 * `loadForReplacementExercise` — the one owner of what a replacement starts at —
 * answers **UNSET** for `Glute Bridge` on that athlete.
 *
 * **THE WRITER WAS ALREADY CORRECT AND WAS BEING TALKED OVER.**
 * `replaceExerciseAtDate` consults the load owner, but only when the payload
 * carries no weight of its own:
 *
 *     Number.isFinite(Number(toExercise.weight)) ? …the caller's… : …the owner's…
 *
 * The screen pre-filled the OUTGOING row's `prescribedWeightKg`, so the caller's
 * arm always won and the fix landed at the writer could never run on the door
 * the athlete actually uses. **Screen-local state outranking stored authority.**
 *
 * ## THE RULE, STATED
 *
 * - **The DOSE carries over from the row being replaced** — sets, rep range,
 *   rest, per-side. A dose belongs to the SLOT the new movement steps into.
 * - **The LOAD does not, ever.** A load belongs to an EXERCISE. Absent here
 *   means "the load owner decides", and the owner's ladder is: the athlete's own
 *   recorded history → the authored starting estimate → bodyweight/blank.
 * - **A choice that PRESCRIBES a load still wins**, because that is stating one
 *   rather than inheriting one. The recovery fallbacks (`Easy Bike`,
 *   `Breathing Reset`) send `weight: 0` to mean unloaded, and that is their
 *   answer to give. Every ordinary `same_movement_pattern` choice sends no
 *   prescription at all — exactly the population that was inheriting.
 */

export type SwapSuggestionPayload = {
  sessionSection?: import('../types/domain').WorkoutExercise['sessionSection'];
  role?: import('../types/domain').WorkoutExercise['role'];
  composedOptionalKind?: import('../types/domain').WorkoutExercise['composedOptionalKind'];
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  weight?: number;
  notes?: string;
  prescriptionType?: 'reps' | 'duration' | 'duration_minutes' | 'distance';
  perSide?: boolean;
  restSeconds?: number;
};

/**
 * @param name        the REPLACEMENT's name.
 * @param outgoingRow the row being replaced. Its DOSE is read; its LOAD is not.
 * @param prescribed  what the choice itself prescribes, if anything. Wins.
 */
export function buildSwapSuggestionPayload(
  name: string,
  outgoingRow?: any,
  prescribed: Partial<SwapSuggestionPayload> = {},
): SwapSuggestionPayload {
  const sets = Number(outgoingRow?.prescribedSets) || 3;
  const repsMin = Number(outgoingRow?.prescribedRepsMin) || 8;
  const repsMax = Number(outgoingRow?.prescribedRepsMax) || Math.max(repsMin, 10);
  return {
    name,
    sets,
    repsMin,
    repsMax,
    // ⚠ NO `?? outgoingRow?.prescribedWeightKg`. See the header. Absent is not a
    // gap to be filled here — it is the instruction that the load owner decides.
    weight: prescribed.weight,
    notes: prescribed.notes,
    prescriptionType: prescribed.prescriptionType ?? outgoingRow?.prescriptionType,
    perSide: prescribed.perSide ?? outgoingRow?.perSide,
    restSeconds: prescribed.restSeconds ?? outgoingRow?.restSeconds,
    ...prescribed,
  };
}
