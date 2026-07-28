/**
 * timeAvailabilityPolicy.ts — "short on time", authored once.
 *
 * SAM'S RULING (2026-07-28, Batch 4):
 * > "short on time" = 35 minutes, one owner — the coach path's 45 conforms. The
 * > minutes->severity conversion dies per the existing law that time caps are
 * > session-scoped facts off the fatigue ladder — short time shapes the
 * > session, never scores the athlete.
 *
 * WHAT THIS REPLACES. Three sites held the number and two of them disagreed:
 * `readiness.ts` and `readinessConstraints.ts` said 35, `coachReadinessAdapter`
 * said 45. So whether an athlete with 40 minutes was "short on time" depended
 * on whether they typed it into the coach or answered the readiness door — the
 * same athlete, the same day, two answers.
 *
 * AND ONE SITE SCORED THEM FOR IT. `readinessConstraints` mapped minutes onto a
 * SEVERITY: under 20 minutes became severity 7, otherwise 5. That put a
 * calendar fact onto the injury/fatigue ladder, where a 7 means "limiting" and
 * carries program consequences an athlete's busy Tuesday should never carry.
 * Sam killed the conversion outright. Being short on time changes the shape of
 * the session in front of you; it does not say anything about your body.
 *
 * The session SHAPES that consume the fact live in `sessionBuilder` and are
 * separately authored (10 and 20 minutes, blessed in the same ruling). They are
 * shapes, not severities, and they stay where they are.
 */

/**
 * At or below this many available minutes, the athlete is short on time.
 *
 * RULING ANCHOR, NOT A BIBLE ANCHOR. The Bible does not state a
 * short-on-time threshold anywhere — I marked this `BIBLE_ANCHOR` first and the
 * anchor gate rejected it, correctly. 35 is Sam's, ruled conversationally on
 * 2026-07-28, and claiming a Bible citation for it would be the invented
 * provenance this whole unit exists to remove.
 */
export const SHORT_ON_TIME_MINUTES = 35;

export const SHORT_ON_TIME_RULING = {
  ruledOn: '2026-07-28',
  where: 'docs/BATCH4_BATCH6_RULINGS_2026-07-28.md',
  quote: '"short on time" = 35 minutes, one owner — the coach path\'s 45 conforms.',
} as const;

/** The single reader. `undefined` minutes is not a claim of being short. */
export function isShortOnTime(minutes: number | null | undefined): boolean {
  return typeof minutes === 'number' && Number.isFinite(minutes)
    && minutes < SHORT_ON_TIME_MINUTES;
}
