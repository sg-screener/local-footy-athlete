/**
 * THE EFFORT SCALE — one 1-10 vocabulary, signed, for every effort input.
 *
 * Sam, 2026-08-12, two instructions in one pass:
 *   1. *"make it 1-10 everywhere instead of 1-5"* — the scale.
 *   2. *"change the effort input from buttons to a slider ... Show the word
 *      beside the number as it moves: 7 — hard"* — the surface, and the one
 *      word he named.
 *
 * WHY A WORD PER NUMBER AT ALL. A bare number is not an answer an athlete can
 * calibrate: "7" means whatever the person guessed it meant, and two athletes'
 * sevens are not the same load. The word is what makes the number comparable
 * across sessions, and it is why it moves WITH the thumb rather than sitting in
 * a legend.
 *
 * PROVENANCE IS SPLIT, HONESTLY. `7 = hard` and the two ends are Sam's; the
 * seven words between them are PROPOSED by the terminal and are marked as such.
 * A `sam_ruling` provenance on a word he never said would be the copy system
 * lying about its own authority — the exact thing signing exists to prevent.
 * **They are athlete-facing and they await his eye.**
 */
import { registerSignedCopy, signedCopy } from './signedCopy';

const RULED = 'Sam 2026-08-12; slider ruling, "7 — hard" verbatim';
const PROPOSED = 'PROPOSED by the terminal 2026-08-12 — AWAITING SAM. '
  + 'Interpolated between his ruled anchors (1, 7, 10); not his words.';

registerSignedCopy([
  { id: 'effort.1', source: 'sam_ruling', provenance: 'Sam 2026-08-12; the low anchor, carried from the 1-5 scale', text: 'very easy' },
  { id: 'effort.2', source: 'sam_ruling', provenance: PROPOSED, text: 'easy' },
  { id: 'effort.3', source: 'sam_ruling', provenance: PROPOSED, text: 'light' },
  { id: 'effort.4', source: 'sam_ruling', provenance: PROPOSED, text: 'moderate' },
  { id: 'effort.5', source: 'sam_ruling', provenance: PROPOSED, text: 'steady' },
  { id: 'effort.6', source: 'sam_ruling', provenance: PROPOSED, text: 'solid' },
  { id: 'effort.7', source: 'sam_ruling', provenance: RULED, text: 'hard' },
  { id: 'effort.8', source: 'sam_ruling', provenance: PROPOSED, text: 'very hard' },
  { id: 'effort.9', source: 'sam_ruling', provenance: PROPOSED, text: 'brutal' },
  { id: 'effort.10', source: 'sam_ruling', provenance: 'Sam 2026-08-12; the high anchor', text: 'max effort' },
  {
    id: 'effort.empty',
    source: 'sam_ruling',
    provenance: 'Sam 2026-08-12: "It must start empty, not on 5 — an untouched '
      + 'form must not look like a real answer."',
    text: 'Slide to rate',
  },
]);

/** Lowest and highest ratings the scale accepts. */
export const EFFORT_MIN = 1;
export const EFFORT_MAX = 10;

/**
 * Is this a rating at all? One predicate, so "off the scale" cannot mean two
 * different things in two places.
 */
export function isEffortRating(rating: number | null | undefined): rating is number {
  return typeof rating === 'number' && Number.isInteger(rating)
    && rating >= EFFORT_MIN && rating <= EFFORT_MAX;
}

/**
 * The word for a rating, or the empty prompt for no rating.
 *
 * NOT A LOOKUP THE SURFACE MAY REBUILD. Both the slider and any future readout
 * ask this, so the athlete never sees two vocabularies for one number — the
 * name-as-a-data-channel shape this repo has paid for repeatedly.
 */
export function effortWord(rating: number | null): string {
  if (!isEffortRating(rating)) return signedCopy('effort.empty');
  return signedCopy(`effort.${rating}`);
}

/**
 * What the athlete reads beside the thumb: `7 — hard`.
 *
 * An UNSET slider returns the empty prompt ALONE, with no number in it. Showing
 * "5 — steady" before the athlete has touched anything is the defect Sam's
 * ruling names: an untouched form that looks like a real answer.
 */
export function effortReadout(rating: number | null): string {
  // ANY value off the scale is UNANSWERED, never clamped to a neighbour.
  // The first draft branched on `rating === null` alone and rendered
  // "0 — Slide to rate" for a 0 — a number the athlete never gave, wearing the
  // empty prompt as its word. `effortScaleTests` caught it.
  if (!isEffortRating(rating)) return effortWord(null);
  return `${rating} — ${effortWord(rating)}`;
}
