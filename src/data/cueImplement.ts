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

  // ── ⚠ THE FOUR CONFLICTS — RULED BY SAM 2026-08-18, AND RECONCILED HERE.
  // They were listed for his decision rather than silently picked; these rows
  // are now the ruling's consequences, not my readings.

  // RULED: *"legal with dumbbells OR barbell. Straight/EZ bar belongs to the
  // barbell option."* So the cue IS the barbell variant, and on a dumbbell
  // selection it is suppressed and flagged — which is the honest outcome and
  // surfaces that a dumbbell Skull Crushers cue is owed. **Not reworded here:
  // splitting his sentence would be inventing the coaching copy he forbade.**
  'Skull Crushers': 'barbell',

  // RULED: *"legal with barbell OR dumbbells."* Its cue OFFERS the alternative
  // rather than assuming one (*"Can be done seated on a bench, or with
  // dumbbells"*), so it is correct for both — Sam's third category. It is filed
  // in `CUE_IMPLEMENT_NEUTRAL` below rather than here.

  // RULED AGAINST WIDENING: *"a pull-up bar does NOT qualify. Retain its genuine
  // ring/suspension equipment requirement."* The sheet keeps `rings_trx`, so the
  // implement is the rings and the cue's "bar" is loose wording for the handle.
  'Inverted Row (Bodyweight)': 'rings_trx',

  // RULED: *"Do not change Tib Raises without another established conflict."*
  // Unchanged — the bar its cue mentions is genuinely optional on a bodyweight
  // movement, and the sheet's empty requirement is correct.
  'Tib Raises': 'bodyweight',

  'Pull-Ups': 'bodyweight',                   // sheet says pullup_bar; the bar is SUPPORT, not the implement
  'Scap Pull Ups': 'bodyweight',              // same
};

/**
 * ── CUES THAT MENTION AN IMPLEMENT AND ARE STILL CORRECT FOR ALL OF THEM ────
 *
 * Sam's third category, 2026-08-18: *"use a generic cue only where it is correct
 * for every supported implement."*
 *
 * **THIS IS NOT THE SAME AS BEING ABSENT FROM THE TABLE ABOVE.** Absent means
 * "no implement word, never looked at"; a row here means "names one, and was
 * READ and ruled neutral". The coverage gate accepts either, so a cue cannot sit
 * in the gap between them.
 *
 * `Z-Press` is the worked example: it says *"Can be done seated on a bench, or
 * with dumbbells"* — that OFFERS an alternative to the default rather than
 * assuming an implement, so it is right whichever the athlete picks. **No regex
 * can be trusted to tell "or with dumbbells" from "the dumbbells should…", which
 * is exactly why this is a hand-ruled list and not an inference.**
 */
export const CUE_IMPLEMENT_NEUTRAL: ReadonlySet<string> = new Set([
  'Z-Press',
]);

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
  if (CUE_IMPLEMENT_NEUTRAL.has(exerciseName)) return true;
  const assumed = CUE_ASSUMED_IMPLEMENT[exerciseName];
  if (!assumed) return true;
  if (!selectedImplement) return true;
  return assumed === selectedImplement;
}
