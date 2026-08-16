/**
 * THE SMALLEST AUTHORED INCREASE A CONDITIONING SESSION STILL HAS LEFT.
 *
 * **Sam's ruling, 2026-08-17, on what "one step harder" means:**
 *
 *   1. Check the phase. In-season may hold for freshness.
 *   2. Stay within the same conditioning quality and make the smallest authored
 *      increase available: low-end → normal dose, one authored rep/block, an
 *      authored duration increase, or an authored rest reduction.
 *   3. After repeated easy feedback, easy aerobic may move to tempo when the
 *      phase and weekly placement permit it.
 *   4. Aerobic Power never automatically becomes Anaerobic merely because it
 *      felt easy.
 *   5. If the authoritative templates provide no valid next dose, hold the
 *      session and report that no progression step exists. Never invent one.
 *
 * ## THIS MODULE ANSWERS RULE 2 AND RULE 5, AND NOTHING ELSE
 *
 * It never changes the template, the quality or the category — so rule 4 holds
 * STRUCTURALLY rather than by a check that could be forgotten: there is no code
 * path here that can return a different quality. Rule 1 is the caller's (the
 * phase is not this module's fact) and rule 3 is deliberately NOT built — see
 * the note at the foot.
 *
 * ## EVERY NUMBER COMES OUT OF THE AUTHORED STRING
 *
 * `parseConditioningDose` is the single ingress into the sheet's quantities and
 * it returns the authored `min` and `max` verbatim. A step moves BETWEEN those
 * two and can never leave them. **When `min === max` the sheet authored one
 * value and there is no step** — that is rule 5, and it is the common case:
 * `Classic 4×4` is "4 reps", full stop.
 *
 * ⚠ **THE APP ALREADY SITS AT THE MIDPOINT, NOT THE LOW END.**
 * `conditioningSelection.headlineSets` prescribes `round(doseMidpoint(...))`.
 * So Sam's "low-end → normal dose" rung is ALREADY SPENT before the athlete
 * ever gives feedback, and the only rung this module can still offer on sets is
 * "one authored rep/block" — midpoint toward the authored max. Stating that
 * plainly because it makes the ladder one rung shorter than the ruling reads,
 * and a reader who assumed otherwise would look for a step that cannot exist.
 */
import {
  doseSeconds,
  parseConditioningDose,
  type ConditioningDoseQuantity,
} from './conditioningDose';
import type { ConditioningTemplate } from '../data/conditioningTemplates';

/** Which authored field the step moved. Reported, never inferred downstream. */
export type ConditioningStepKind =
  /** One more authored rep, round, block or set, inside the authored range. */
  | 'authored_sets_increase'
  /** A longer authored work period, inside the authored range. */
  | 'authored_duration_increase'
  /** A shorter authored rest, inside the authored range. */
  | 'authored_rest_reduction';

/** Why no step was available. Rule 5 — reported, never papered over. */
export type ConditioningNoStepReason =
  /** Every authored field states a single value; the sheet offers no next dose. */
  | 'authored_dose_is_a_single_value'
  /** The dose strings could not be read as quantities at all. */
  | 'authored_dose_not_readable'
  /** The session is already at the top of every authored range. */
  | 'already_at_authored_maximum';

export interface ConditioningStep {
  readonly kind: ConditioningStepKind;
  /** The value the athlete is on now, derived the same way generation derives it. */
  readonly from: number;
  /** The next authored value. NEVER outside the sheet's own min..max. */
  readonly to: number;
  /** The authored string this step was read out of, verbatim. Provenance. */
  readonly authoredFrom: string;
}

export type ConditioningStepOutcome =
  | { readonly stepped: true; readonly step: ConditioningStep }
  | { readonly stepped: false; readonly reason: ConditioningNoStepReason };

/** How generation itself turns an authored range into the prescribed number. */
function prescribedFrom(quantity: ConditioningDeltaQuantity): number {
  return Math.max(1, Math.round((quantity.min + quantity.max) / 2));
}

type ConditioningDeltaQuantity = Pick<ConditioningDoseQuantity, 'min' | 'max'>;

/**
 * ONE RUNG UP INSIDE AN AUTHORED RANGE, or null.
 *
 * `+1` rather than "jump to the max" because the ruling says the SMALLEST
 * authored increase. `Math.min` is what makes the authored maximum a wall: this
 * function cannot return a number the sheet does not contain.
 */
function oneRungUp(quantity: ConditioningDeltaQuantity): { from: number; to: number } | null {
  const from = prescribedFrom(quantity);
  if (quantity.max <= from) return null;
  return { from, to: Math.min(from + 1, quantity.max) };
}

/** One rung DOWN — the rest-reduction rung. Bounded by the authored minimum. */
function oneRungDown(quantity: ConditioningDeltaQuantity): { from: number; to: number } | null {
  const from = prescribedFrom(quantity);
  if (quantity.min >= from) return null;
  return { from, to: Math.max(from - 1, quantity.min) };
}

/**
 * THE NEXT AUTHORED DOSE FOR THIS TEMPLATE, in Sam's stated order.
 *
 * Sets first, then duration, then rest — *"one authored rep/block, an authored
 * duration increase, or an authored rest reduction"*, read as a priority chain
 * rather than a menu, because the ruling asks for the SMALLEST increase
 * available and lists them smallest-first.
 *
 * ⚠ **A REFUSAL FROM THE PARSER IS NOT A ZERO.** `composite_dose` ("3 × 8 min,
 * or 4 × 6 min") means the sheet authored a SHAPE this owner deliberately does
 * not reduce to one number. Treating that as "no range, therefore no step" is
 * correct and is reported as `authored_dose_is_a_single_value`'s sibling rather
 * than silently becoming a step of +1 on a number nobody authored.
 */
export function nextAuthoredDose(template: ConditioningTemplate): ConditioningStepOutcome {
  const sets = parseConditioningDose(template.setsRounds);
  const work = parseConditioningDose(template.workPeriod);
  const rest = parseConditioningDose(template.restPeriod);

  if (!sets.ok && !work.ok && !rest.ok) {
    return { stepped: false, reason: 'authored_dose_not_readable' };
  }

  // ── RUNG 1: one more authored rep, round, block or set ───────────────────
  if (sets.ok) {
    const rung = oneRungUp(sets.quantity);
    if (rung) {
      return {
        stepped: true,
        step: {
          kind: 'authored_sets_increase',
          from: rung.from,
          to: rung.to,
          authoredFrom: template.setsRounds,
        },
      };
    }
  }

  // ── RUNG 2: a longer authored work period ────────────────────────────────
  //
  // Read in SECONDS so a "30–50 min continuous" range and a "15–20 s hard" one
  // are the same question. The step is one authored minute or second, whichever
  // the sheet wrote — `doseSeconds` returns the authored band, not a rounding.
  if (work.ok) {
    const seconds = doseSeconds(work.quantity);
    if (seconds && seconds.max > seconds.min) {
      const rung = oneRungUp(work.quantity);
      if (rung) {
        return {
          stepped: true,
          step: {
            kind: 'authored_duration_increase',
            from: rung.from,
            to: rung.to,
            authoredFrom: template.workPeriod,
          },
        };
      }
    }
  }

  // ── RUNG 3: a shorter authored rest ──────────────────────────────────────
  if (rest.ok) {
    const rung = oneRungDown(rest.quantity);
    if (rung) {
      return {
        stepped: true,
        step: {
          kind: 'authored_rest_reduction',
          from: rung.from,
          to: rung.to,
          authoredFrom: template.restPeriod,
        },
      };
    }
  }

  const anyRange = [sets, work, rest].some(
    (parse) => parse.ok && parse.quantity.max > parse.quantity.min);
  return {
    stepped: false,
    reason: anyRange ? 'already_at_authored_maximum' : 'authored_dose_is_a_single_value',
  };
}

/**
 * ⚠ **RULE 3 IS NOT BUILT, AND THIS IS WHERE A READER WOULD LOOK FOR IT.**
 *
 * *"After repeated easy feedback, easy aerobic may move to tempo when the phase
 * and weekly placement permit it."* **REPEATED** is the word that stops it: the
 * app's block history answers *"was this block easy?"* and nothing records
 * whether the block BEFORE it was easy too. Building it on a single easy block
 * would be a different rule from the one Sam ruled.
 *
 * It is also a "may", not a "must" — so leaving it unbuilt costs the athlete a
 * permission, never a required exposure. Recorded here rather than in a doc so
 * the next reader finds it at the code that would host it.
 */
export const AEROBIC_BASE_TO_TEMPO_REQUIRES_REPEATED_EASY = true;
