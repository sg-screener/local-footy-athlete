/**
 * sessionImpactBands.ts — how much of a week a change removed, as a label.
 *
 * SAM'S RULING (2026-07-28, Batch 6):
 * > Impact labels blessed — high at >=0.5 of week removed, moderate at >=2
 * > sessions; collapse the duplicate copies to one owner.
 *
 * The numbers were already right. What was wrong is that there were TWO copies:
 * `exposureEngine` and `trainAroundEngine` each carried their own `>= 0.5`, on
 * two paths an athlete can reach the same screen by. Two copies of a display
 * rule agree until one is tuned, and then the same change reports "high impact"
 * down one path and "moderate" down the other, with nothing anywhere noticing.
 *
 * The blessing is the smaller half of this ruling; the collapse is the point.
 *
 * NOT IN SCOPE. The 0.75 cut point that converts a stripped session to recovery
 * or rebuild keeps its existing citation (Bible Section 14 addendum, where Sam's
 * 2026-07-27 ruling abolished its fatigue path and left it injury-only). It is a
 * PROGRAM decision, not a label, so it does not belong in this file.
 */

export type SessionImpact = 'none' | 'low' | 'moderate' | 'high';

export const SESSION_IMPACT_RULING = {
  ruledOn: '2026-07-28',
  where: 'docs/BATCH4_BATCH6_RULINGS_2026-07-28.md',
  quote: 'Impact labels blessed — high at >=0.5 of week removed, moderate at >=2 sessions.',
} as const;

/** At or above this share of scored items removed, the change reads as high impact. */
export const HIGH_IMPACT_REMOVED_SHARE = 0.5;

/** At or above this many removed items, the change reads as moderate impact. */
export const MODERATE_IMPACT_REMOVED_COUNT = 2;

/**
 * The single classifier. `totalScored` of 0 means nothing was assessed, which is
 * not the same as nothing being removed — it reports `none` rather than dividing.
 */
export function classifySessionImpact(args: {
  removedCount: number;
  limitedCount?: number;
  totalScored: number;
}): SessionImpact {
  const limited = args.limitedCount ?? 0;
  if (args.removedCount === 0 && limited === 0) return 'none';
  if (args.totalScored > 0 &&
      args.removedCount / args.totalScored >= HIGH_IMPACT_REMOVED_SHARE) return 'high';
  if (args.removedCount >= MODERATE_IMPACT_REMOVED_COUNT) return 'moderate';
  return 'low';
}
