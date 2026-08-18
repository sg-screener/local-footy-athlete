/**
 * ── WHICH IMPLEMENT DOES EACH AUTHORED CUE ASSUME ──────────────────────────
 *
 * Sam, 2026-08-18 (R-104): the form cues must agree with the implement actually
 * selected — *"reuse existing authored equipment-specific cues; add a typed cue
 * variant where setup genuinely differs; use a generic cue only where it is
 * correct for every supported implement; flag missing authored technique
 * guidance rather than invent coaching copy."*
 *
 * ## THE PROOF CASE, REACHABLE TODAY
 *
 * `RDLs` is the one exercise Sam's sheet marks as an OR-GROUP
 * (`[['barbell', 'dumbbells']]`), and its authored cue is:
 *
 *     "Push hips back, BAR slides down leg."
 *
 * An athlete who unticks the barbell keeps `RDLs` — correctly, it is legal on
 * dumbbells — and was still told to slide a bar down their leg. **A cue naming
 * equipment the athlete has just said they do not have.**
 *
 * ## WHY THIS IS A SEPARATE FILE FROM `EXERCISE_CUES`
 *
 * `EXERCISE_CUES` is a projection of Sam's master sheet and is equality-gated to
 * it IN BOTH DIRECTIONS (`test:authored-cues`), so nothing may be added there
 * without his sign-off — which is exactly the protection that stops a dumbbell
 * RDL cue being invented here. **This table holds no athlete-visible words.** It
 * records only which implement each already-authored cue was written for, so the
 * renderer can tell when a cue does not fit the implement in the athlete's hands.
 *
 * ## AND IT IS A CLOSED, AUDITED SET
 *
 * Measured over the library 2026-08-18: **32 of 176 authored cues name an
 * implement**; the other 144 are implement-neutral and need no row here. A cue
 * that starts naming one is caught by `test:visible-surfaces`, which re-runs that
 * scan and reds on any cue that names an implement and is missing from this
 * table — so this file cannot quietly fall behind the library.
 */

import type { EquipmentTag } from './exercisePools';

/**
 * The implement each listed cue was written for. Absent = implement-neutral,
 * which is the default and the majority.
 *
 * ⚠ **A ROW HERE IS A READING OF SAM'S EXISTING WORDS, NEVER A NEW CLAIM.** Each
 * entry records the implement the cue text already names.
 */
export const CUE_ASSUMED_IMPLEMENT: Readonly<Record<string, EquipmentTag>> = {
  // ── The OR-GROUP row. The only one where the cue can be wrong for a legal
  // selection, and the reason this table exists.
  'RDLs': 'barbell',                          // "bar slides down leg"
  'Romanian Deadlift': 'barbell',             // same exercise, other spelling

  // ── Fixed-implement rows. Their cues name the implement and that is always
  // the one selected, so these never mismatch — they are listed so the coverage
  // gate can tell "checked and neutral" from "never looked at".
  'Bench Press': 'barbell',
  'Bicep Curl (Barbell)': 'barbell',
  'Deadlift': 'barbell',
  'Explosive Landmine Press': 'barbell',
  'Overhead Press': 'barbell',
  'Speed Trap Bar Deadlift': 'barbell',
  'Bottoms-Up KB Press': 'kettlebell',
  'Kettlebell Swings': 'kettlebell',
  'DB Bench Press': 'dumbbells',
  'Dumbbell Pullovers': 'dumbbells',
  'Weighted Dead Bug': 'dumbbells',
  'Chest Supported Row': 'dumbbells',
  'Chest-Supported DB Row': 'dumbbells',
  'Seated DB Press': 'dumbbells',
  'Banded Bicep Curl': 'bands',
  'Banded Dead Bug': 'bands',
  'Banded External Rotation': 'bands',
  'Banded TKE': 'bands',
  'Crab Walks': 'bands',
  'Side Plank Row': 'bands',
  'Spanish Squat Hold': 'bands',
  'Hamstring Curl': 'machine',
  'Single-Arm Pulldown': 'machine',
  'Single-Leg Leg Press': 'machine',
  'Single-Arm Lat Pulldown': 'machine',

  // ── ⚠ FOUR CUES WHOSE WORDS DISAGREE WITH SAM'S OWN REQUIREMENT SHEET.
  // Recorded as what the CUE says, which is this table's only job. **They are
  // authoring inconsistencies in his source documents, not selection defects,
  // and they are named in `docs/STATUS_VISIBLE.md` for his ruling rather than
  // silently reconciled here** — picking a side would be editing his answers.
  'Skull Crushers': 'barbell',                // sheet says dumbbells; cue says "straight or Z bar"
  'Z-Press': 'dumbbells',                     // sheet says barbell; cue says "or with dumbbells"
  'Inverted Row (Bodyweight)': 'bodyweight',  // sheet says rings_trx; cue says "chest to bar"
  'Tib Raises': 'bodyweight',                 // sheet says nothing; cue says "can use a Tib bar"
  'Pull-Ups': 'bodyweight',                   // sheet says pullup_bar; the bar is SUPPORT, not the implement
  'Scap Pull Ups': 'bodyweight',              // same
};

/**
 * Does this authored cue fit the implement in the athlete's hands?
 *
 * A cue with no row here is implement-neutral and always fits. A cue written for
 * one implement does not fit another — and there is deliberately **no clever
 * near-miss rule**: a barbell hinge and a dumbbell hinge are set up differently,
 * which is the whole reason Sam asked for this.
 */
export function cueFitsImplement(
  exerciseName: string,
  selectedImplement: EquipmentTag | null | undefined,
): boolean {
  const assumed = CUE_ASSUMED_IMPLEMENT[exerciseName];
  if (!assumed) return true;
  if (!selectedImplement) return true;
  return assumed === selectedImplement;
}
