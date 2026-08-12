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
 * EVERY WORD IS SIGNED, and the provenance says HOW. Sam named `hard`, `cruisy`
 * and the two ends; he moved `comfortable` and `steady` to agree with the
 * deload law; the rest he was shown in full and approved. Nothing here is a
 * guess wearing a ruling's provenance, which is the thing signing exists to
 * prevent.
 */
import { registerSignedCopy, signedCopy } from './signedCopy';

/**
 * SAM REVIEWED ALL TEN AND RULED, 2026-08-12. He was shown the full list,
 * changed three, and said *"Rest are fine"* — so nothing here is the terminal's
 * guess any more and the PROPOSED marks are gone.
 */
const NAMED = 'Sam 2026-08-12, named verbatim';
const APPROVED = 'Sam 2026-08-12; proposed by the terminal, shown to him in full '
  + 'and approved — "Rest are fine"';
/**
 * THE DELOAD LAW OWNS THE EASY END, AND SAM POINTED AT IT.
 *
 * *"My deload law says RPE 5-6 is easy, so 5 and 6 read too hard here."* Verified
 * against the law rather than taken on trust: `deloadWeekRules.ts:39` —
 * *"Every set easy — RPE 5-6 ... nowhere near failure."* So `steady` moved DOWN
 * from 5 to 6 and `comfortable` took 5, and this scale now agrees with the one
 * the deload week already prescribes against. Two vocabularies for one number
 * is the defect this whole file exists to end; the deload law was here first.
 */
const DELOAD_ALIGNED = 'Sam 2026-08-12: "my deload law says RPE 5-6 is easy" — '
  + 'aligned with deloadWeekRules.ts:39';

registerSignedCopy([
  { id: 'effort.1', source: 'sam_ruling', provenance: 'Sam 2026-08-12; the low anchor, carried from the 1-5 scale', text: 'very easy' },
  { id: 'effort.2', source: 'sam_ruling', provenance: APPROVED, text: 'easy' },
  // `light` sat here and read as a second way of saying `easy` — Sam:
  // *"2 and 3 are the same word twice"*.
  { id: 'effort.3', source: 'sam_ruling', provenance: NAMED, text: 'cruisy' },
  { id: 'effort.4', source: 'sam_ruling', provenance: APPROVED, text: 'moderate' },
  { id: 'effort.5', source: 'sam_ruling', provenance: DELOAD_ALIGNED, text: 'comfortable' },
  { id: 'effort.6', source: 'sam_ruling', provenance: DELOAD_ALIGNED, text: 'steady' },
  { id: 'effort.7', source: 'sam_ruling', provenance: NAMED, text: 'hard' },
  { id: 'effort.8', source: 'sam_ruling', provenance: APPROVED, text: 'very hard' },
  { id: 'effort.9', source: 'sam_ruling', provenance: APPROVED, text: 'brutal' },
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
