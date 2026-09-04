/**
 * R-070 — ONE MAIN PER PATTERN PER SESSION.
 *
 * SAM'S BIBLE, `:226`, verbatim:
 *   *"ONE MAIN PER PATTERN PER SESSION. Never two heavy lifts of the same
 *   movement pattern in one session. Deadlift + RDL is two heavy hinges and is
 *   illegal. Box squat + back squat is two heavy squats and is illegal. A second
 *   heavy lift in a session must be a different pattern."*
 *
 * It has been ruled since before the app existed and **nothing has ever checked
 * it** — registry row R-070 read `UNENFORCED`, census A4. This is that check.
 *
 * ## IT ASKS TWO QUESTIONS AND BORROWS BOTH ANSWERS
 *
 * **"Is this a heavy lift?"** — the app already answers it. `classifyExerciseRole`
 * returns `main_lift` when the exercise pools call the row an ANCHOR, and that is
 * the same authority the session order, the mobility flow and the muscle-block
 * logic read. Inventing a second heaviness test here would be a second
 * representation of a question the pools have answered since D13.
 *
 * **"Which pattern is it?"** — `slotsFilledByRow` answers it, and it is the ONLY
 * answer this law may use. Sam's own ladders are written in slot terms, and the
 * granularity is load-bearing in both directions:
 *   - a horizontal press and a vertical press are DIFFERENT patterns, because his
 *     upper ladder asks for both in one day. Reading the coarse "push" would make
 *     his own prescription illegal;
 *   - a BILATERAL squat and a UNILATERAL one are different patterns, because his
 *     lower ladder asks for a squat AND a single-leg knee lift in one day.
 *     `slotsFilledByRow` already splits unilateral work off, and that split was
 *     paid for once — see its own comment about flagging his fill order.
 *
 * ## WHAT COUNTS AS A DUPLICATE, AND WHY IT IS THE NARROW READING
 *
 * Two main lifts conflict when each can fill ONE slot and it is the same slot. A
 * row with more than one home has somewhere else to go and is not a duplicate —
 * the same convention `sessionSlotCoverage.duplicated` settled on, kept
 * deliberately so the app does not hold two answers to "is this doubled".
 *
 * ## MEASURED BEFORE IT WAS BUILT, 2026-08-13, so nothing here is assumed
 *
 * - **The weekly generator ships ZERO violations** — 58 sessions, 62 main lifts,
 *   5 worlds x 3 weeks. This law is a ratchet on that, not a repair of it.
 * - **`role` is authored on 34 of 232 generated rows.** The classifier fallback
 *   below is therefore load-bearing, not a courtesy: read `row.role` alone and
 *   this law would be blind to six sessions in seven.
 * - **The scorer shipped 36 violations** across 396 built sessions, every one the
 *   same shape — `Bench Press + Close Grip Bench`, two heavy horizontal presses.
 *   Fixed in `exerciseScorer.selectExercises` in the same commit as this file.
 * - **CENSUS A4's OWN PREMISE IS PARTLY REFUTED.** It reads *"`defaultProgram`
 *   emits RDLs + Hip Thrusts, both classify as main lifts"*. Measured: `RDLs` is
 *   `main_lift`, `Hip Thrust` is `accessory` — one heavy hinge and one accessory
 *   hinge, which is not what `:226` forbids. The pair the census named at `:1194`
 *   (Overhead Press + Incline DB Bench) is likewise one `vertical_push` main and
 *   one `horizontal_push` accessory. **The law is real; two of the three worked
 *   examples the census offered for it are not.**
 */

import { getExerciseTags } from '../data/exerciseTags';
import type { WorkoutExercise } from '../types/domain';
import { slotsFilledByRow, type SessionSlot } from './sessionSlotCoverage';

/**
 * The slot a MAIN lift occupies, or null when it has more than one home (or
 * none the ladders name). Null is "not comparable", never "legal".
 */
export function mainLiftSlot(exerciseName: string): SessionSlot | null {
  const name = String(exerciseName ?? '').trim();
  if (!name) return null;
  const slots = slotsFilledByRow({
    role: 'main_lift',
    exercise: { name },
  } as WorkoutExercise);
  return slots.length === 1 ? slots[0] : null;
}

/** Is this row one of the session's heavy lifts? */
export function isMainLift(row: Pick<WorkoutExercise, 'role' | 'exercise'>): boolean {
  const name = String(row?.exercise?.name ?? '').trim();
  if (!name) return false;
  // AUTHORED ROLE WINS, AND THE FALLBACK IS NOT OPTIONAL — 198 of 232 generated
  // rows carry no `role` at all (measured 2026-08-13), so a reader that trusted
  // the field alone would see almost no main lifts and report a clean app.
  if (row.role) return row.role === 'main_lift';
  // ⚠ **THE SAME FALLBACK THE SCREEN USES, AND IT MUST STAY THE SAME ONE.**
  // Those 198 role-less rows are not roleless: they carry the composer's
  // `section18Evidence.role`, which `sessionRoleForRow` reads before it reaches
  // the name. Leaving this reader on the bare name classifier would make the
  // law and the glass disagree about which rows are main lifts — the law would
  // miss a real second main off the accessory bench (measured: `Leg Press`
  // filled the squat seat 406 times out of 406) and could flag a supporting
  // `Barbell Row` that is not one. One fact, one resolver.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { sessionRoleForRow } = require('../utils/sessionRoles') as {
    sessionRoleForRow: (row: unknown, raw: string) => string;
  };
  return sessionRoleForRow(row, name) === 'main_lift';
}

export interface MainLiftPatternConflict {
  /** The pattern doubled, in the slot vocabulary Sam's ladders are written in. */
  readonly slot: SessionSlot;
  /** The offending lifts, in the order the session lists them. */
  readonly exercises: readonly string[];
}

/**
 * Every pattern this session spends more than one heavy lift on. Empty is legal.
 *
 * PURE, and it repairs nothing — it NAMES the breach. A composer that wants to
 * avoid one asks before it picks (`exerciseScorer` does exactly that); a gate
 * that wants to prove the app obeys asks afterwards.
 */
export function mainLiftPatternConflicts(
  rows: readonly WorkoutExercise[] | null | undefined,
): readonly MainLiftPatternConflict[] {
  const bySlot = new Map<SessionSlot, string[]>();
  for (const row of rows ?? []) {
    if (!isMainLift(row)) continue;
    const name = String(row?.exercise?.name ?? '').trim();
    const slot = mainLiftSlot(name);
    if (!slot) continue;
    bySlot.set(slot, [...(bySlot.get(slot) ?? []), name]);
  }
  const conflicts: MainLiftPatternConflict[] = [];
  for (const [slot, exercises] of bySlot) {
    if (exercises.length > 1) conflicts.push({ slot, exercises });
  }
  return conflicts;
}

/**
 * THE NON-VACUITY QUESTION, EXPORTED SO CALLERS CAN ASK IT.
 *
 * A session whose names resolve to nothing has no conflicts and no lifts, and
 * those two states are reported identically by the function above. A census that
 * cannot tell them apart certifies an unreadable corpus as a lawful one — the
 * exact shape `getExerciseTags` was caught in when 151 rows resolved to nothing.
 */
export function mainLiftsSeen(
  rows: readonly WorkoutExercise[] | null | undefined,
): readonly string[] {
  return (rows ?? [])
    .filter((row) => isMainLift(row))
    .map((row) => String(row?.exercise?.name ?? ''))
    .filter((name) => name.length > 0 && !!getExerciseTags(name));
}
