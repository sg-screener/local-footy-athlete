/**
 * Training capacity rubric — Sam-authored, Bible Section 9.
 *
 * BIBLE_ANCHOR: capacity_rubric_ladders
 * BIBLE_ANCHOR: capacity_rubric_bands
 *
 * This scores the athlete's STANDING capacity from two onboarding answers. It
 * is not the readiness declaration and not a fatigue signal — those are the
 * doors further down Section 9. Capacity affects DOSE only: progression steps,
 * recovery category, RPE ceiling and power dose. It never sets session counts,
 * per the structure/dose ruling in `data/readinessStructureCensus.ts`.
 *
 * WHAT THIS FILE REPLACED. The rubric used to live as 18 loose numbers inside
 * `calculateReadiness` with no source of any kind — the largest unsourced
 * cluster the provenance inventory found. Sam authored it down to eight ladder
 * values and three bands, and deleted three whole terms:
 *
 *   sprint +0.5   a boundary-only half-point. Because the bands sat on
 *                 integers, it could only ever act at exactly two scores —
 *                 flipping a band on half a point — and the Bible owns sprint
 *                 exposure as a WEEKLY FLOOR, not a capacity signal.
 *   in-season -1  double-counting. Phase already shapes the week through the
 *                 exposure contracts, and game fatigue arrives through the
 *                 readiness facts.
 *   injury        injury acts only through its own law family. Scoring it here
 *                 gave injury a second channel into the athlete's dose.
 *
 * Those are DELETIONS, not guards. `capacityRubricTests` asserts the terms are
 * absent from the engine source, because a deleted term can be re-added by one
 * locally-reasonable line and every behavioural test would still pass — the
 * score would just be quietly different.
 */

import type { RecentTrainingLoad, ConditioningLevel, CapacityBand } from '../types/domain';

/**
 * PROVENANCE: `bible_anchor`. The quotes below must still appear verbatim in
 * the Bible and must still state the shipped numbers — asserted in both
 * directions, so the code and the section cannot drift apart.
 */
export const CAPACITY_RUBRIC_ANCHOR = {
  ruledOn: '2026-07-28',
  where: 'docs/LFA_PROGRAMMING_BIBLE.md',
  section: 'Section 9 — Fatigue, sickness and readiness rules / Training capacity score',
  quotes: [
    '* Recent training consistency: Very consistent 3, Pretty consistent 2, A bit 1, Hardly at all 0. ',
    '* Current conditioning level: Elite 3, Good 2, Average 1, Poor 0. ',
    'Total runs 0-6. Bands: 0-2 low, 3-4 medium, 5-6 high.',
  ],
} as const;

/* ══ The two ladders — equal weight, 0-3 each ══ */

export const CONSISTENCY_SCORES: Record<RecentTrainingLoad, number> = {
  'Very consistent': 3,
  'Pretty consistent': 2,
  'A bit': 1,
  'Hardly at all': 0,
};

export const CONDITIONING_SCORES: Record<ConditioningLevel, number> = {
  Elite: 3,
  Good: 2,
  Average: 1,
  Poor: 0,
};

/* ══ Fail loud ══ */

/**
 * Raised when capacity is asked for without both answers.
 *
 * Same law as the deleted `DEFAULT_BODYWEIGHT_KG = 82`. A default here is worse
 * than it first looks: it does not merely guess, it guesses CONFIDENTLY, and
 * the athlete receives a progression tier, an RPE ceiling and a recovery
 * category that nobody chose for them — all looking exactly as authoritative as
 * a real answer. Absence renders as absence.
 */
export class MissingCapacityAnswerError extends Error {
  constructor(missing: readonly string[]) {
    super(
      `Capacity cannot be scored: missing or unrecognised ${missing.join(' and ')}. `
      + 'Both answers are required (Bible Section 9); there is no default and no unknown tier.',
    );
    this.name = 'MissingCapacityAnswerError';
  }
}

/**
 * Score standing capacity, 0-6.
 *
 * Throws rather than returning a fallback. Onboarding requires both answers, so
 * a throw means a profile reached generation without them — which is a real
 * defect and must be visible, not absorbed.
 */
export function scoreCapacity(
  recentTrainingLoad: RecentTrainingLoad | undefined,
  conditioningLevel: ConditioningLevel | undefined,
): number {
  const missing: string[] = [];
  // An UNRECOGNISED value is refused alongside a missing one. Mapping it to 0
  // would make a typo indistinguishable from "Hardly at all" / "Poor".
  const consistency = recentTrainingLoad === undefined
    ? undefined
    : CONSISTENCY_SCORES[recentTrainingLoad];
  const conditioning = conditioningLevel === undefined
    ? undefined
    : CONDITIONING_SCORES[conditioningLevel];

  if (consistency === undefined) missing.push('recentTrainingLoad');
  if (conditioning === undefined) missing.push('conditioningLevel');
  if (missing.length > 0) throw new MissingCapacityAnswerError(missing);

  return consistency! + conditioning!;
}

/* ══ Bands ══ */

/**
 * One row of the rubric table: the score window that lands on a band.
 *
 * RENAMED from `CapacityBand` (2026-08-13) — the scalar band moved into
 * `types/domain.ts` under that name when `ReadinessLevel` was retired, and this
 * interface is a RANGE, not a band. Naming the row after the thing it maps to
 * is how the collision happened.
 */
export interface CapacityBandRange {
  readonly level: CapacityBand;
  readonly min: number;
  readonly max: number;
}

/**
 * Sam ruled the edges explicitly, including the one that reads harshest:
 * *"'A bit' + 'Average' = low is intended — show some training before we
 * build."* That case scores 2 and lands low by design, not by an off-by-one.
 */
export const CAPACITY_BANDS: readonly CapacityBandRange[] = [
  { level: 'low', min: 0, max: 2 },
  { level: 'medium', min: 3, max: 4 },
  { level: 'high', min: 5, max: 6 },
];

export function capacityBandFor(score: number): CapacityBand {
  const band = CAPACITY_BANDS.find((b) => score >= b.min && score <= b.max);
  if (!band) {
    // Unreachable while `scoreCapacity` owns the input, and loud if that ever
    // stops being true rather than clamping to a plausible-looking tier.
    throw new RangeError(`Capacity score ${score} is outside the ruled 0-6 range.`);
  }
  return band.level;
}

/**
 * Can capacity be scored for this profile?
 *
 * For callers that REFINE something already built and have a defined
 * do-nothing outcome — not for callers that prescribe. A prescriber must let
 * the refusal propagate; asking this first and substituting a tier would be the
 * silent default under a new name.
 */
export function canScoreCapacity(profile: {
  recentTrainingLoad?: RecentTrainingLoad;
  conditioningLevel?: ConditioningLevel;
} | null | undefined): boolean {
  if (!profile) return false;
  try {
    scoreCapacity(profile.recentTrainingLoad, profile.conditioningLevel);
    return true;
  } catch {
    return false;
  }
}

/** Score and band in one step — the shape every caller actually wants. */
export function capacityFor(
  recentTrainingLoad: RecentTrainingLoad | undefined,
  conditioningLevel: ConditioningLevel | undefined,
): { score: number; level: CapacityBand } {
  const score = scoreCapacity(recentTrainingLoad, conditioningLevel);
  return { score, level: capacityBandFor(score) };
}
