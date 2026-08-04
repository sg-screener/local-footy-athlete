/**
 * MAS copy + intensity helpers.
 *
 * Single source of truth for:
 *   1. MAS-based work-interval intensity prescription
 *   2. Athlete-facing MAS fallback explanation
 *
 * ⚠️ THE BINARY RULE BELOW IS ACCRETED CODE, NOT AUTHORED LAW.
 *
 * SAM RULED, 2026-08-06: he does NOT remember authoring "≤30s → 110% MAS".
 * It has no anchor anywhere — the 55 conditioning templates' `intensity`
 * strings are equality-gated to his signed workbook
 * (`conditioningTemplateEqualityTests`), and this binary is gated to nothing.
 * It reads like a ruling and is not one.
 *
 * **THE 55 SIGNED TEMPLATES' RANGES OWN CONDITIONING INTENSITY.** Where the
 * two disagree — 'Classic 4×4' is the measured case, ranges say '90–100% MAS'
 * and this binary says 110% — the authored range wins, because it is the thing
 * Sam signed.
 *
 * **THIS FUNCTION DIES WHEN MAS WIRING LANDS** (Sam's ruling 4). It survives
 * only because the conflict is still latent: both representations are display
 * STRINGS today and `deriveMas` has zero generation-path consumers, so nothing
 * breaks yet. The moment MAS becomes a real number in the generation path,
 * these are two representations of one intensity and this one goes. Anything
 * athlete-visible that came from it returns through the copy sheet.
 *
 * DO NOT add a caller. A new consumer of this binary is a new site to unpick
 * when the wiring lands, and it would be citing a rule nobody authored.
 *
 * The accreted rule, recorded so the deletion can be checked against it:
 *   • Work interval ≤ 30s  → 110% MAS
 *   • Work interval  > 30s → 100% MAS
 *
 * Examples:
 *   • MAS 15:15           → 15s work → 110% MAS
 *   • 20s efforts         → 110% MAS
 *   • 30s efforts         → 110% MAS
 *   • 40s efforts         → 100% MAS
 *   • 1 min reps          → 100% MAS
 *   • 2 min / 4 min reps  → 100% MAS
 *
 * The athlete's MAS itself is NOT derived here. It has one owner —
 * `data/twoKmTimeTrial` — which derives it from their 2km time or, when
 * they have not tested, from Sam's ruled default for their experience
 * level. This module owns only the intensity rule and the copy.
 */

/** Percentage of MAS for a given work-interval length (in seconds). */
export function masIntensityForWorkSeconds(workSeconds: number): 100 | 110 {
  return workSeconds <= 30 ? 110 : 100;
}

/** Formatted label, e.g. "110% MAS" or "100% MAS". */
export function masIntensityLabel(workSeconds: number): string {
  return `${masIntensityForWorkSeconds(workSeconds)}% MAS`;
}

/**
 * Athlete-friendly fallback note for any MAS-prescribed session.
 * Most athletes won't know what MAS means or what their MAS number is,
 * so every MAS session must carry this line.
 */
export const MAS_FALLBACK_NOTE =
  "Don't know MAS? Send your 2km or 3km time trial.";

/**
 * Build a full MAS intensity + fallback block for pasting into a
 * session description.
 *
 * @param workSeconds  length of a single work interval
 * @param opts.includeGloss  when true, adds a one-line gloss of what
 *   MAS means (Maximum Aerobic Speed). Off by default so we don't
 *   bloat descriptions — the fallback line is usually enough.
 */
export function masIntensityBlock(
  workSeconds: number,
  opts: { includeGloss?: boolean } = {},
): string {
  const pace = `Target pace: ${masIntensityLabel(workSeconds)} on each work interval.`;
  const gloss = opts.includeGloss
    ? '\n(MAS = Maximum Aerobic Speed - the slowest pace that maxes out your aerobic system.)'
    : '';
  return `${pace}${gloss}\n${MAS_FALLBACK_NOTE}`;
}

// ───────────────────────────────────────────────────────────────────────
// WHAT USED TO BE HERE, AND WHY IT IS GONE (Stage C, 2026-07-29)
//
// This module carried a MAS distance calculator: `masKmhToMs`,
// `estimateMasFromTimeTrial`, `masDistancePerRep` and a ±tolerance band.
// It had ZERO consumers — it was written against an athlete MAS that did
// not exist yet, and nothing ever called it.
//
// `estimateMasFromTimeTrial` did the same arithmetic the owner now does,
// unauthored, justified by a comment that contradicted itself:
//
//   "Conservative estimate — actual MAS is typically 1-3% higher than TT
//    average pace because TTs are run slightly above MAS"
//
// If a time trial is run ABOVE MAS then MAS is LOWER than time-trial pace,
// not higher. It argued for a discount, called that conservative, and
// applied neither. Sam ruled the multiplier at 1.00 on 2026-07-29 and the
// derivation moved to its owner, `data/twoKmTimeTrial`, with the ruling
// attached. Two functions that both claim to know what MAS is are two
// representations of one fact — and the dead one is the one that drifts
// without anybody noticing.
//
// The distance-per-rep calculator went with it. Its ±3m/±5m tolerance
// bands were invented by this file and never ruled, and turning a %MAS
// into a rendered pace is Stage B's consumer layer. Stage B re-authors it
// against the templates' intensity ranges, which is also where the
// range-vs-binary question below gets settled.
//
// WHAT STAYS HERE: the INTENSITY rule — what percentage of MAS a work
// interval asks for. That is a different fact from what the athlete's MAS
// is, two conditioning template rows cite it by name, and it is not the
// owner's business.
//
// OPEN, FOR STAGE B: the fifteen %MAS template rows carry RANGES
// ('90–100% MAS'), while `masIntensityForWorkSeconds` above is a BINARY
// (≤30s → 110%, >30s → 100%). For 'Classic 4×4' they disagree. Nothing
// breaks while both are only rendered as text; the moment MAS is a real
// number they are two representations of one intensity.
// ───────────────────────────────────────────────────────────────────────
