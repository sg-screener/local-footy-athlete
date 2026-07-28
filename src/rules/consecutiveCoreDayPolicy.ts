/**
 * consecutiveCoreDayPolicy.ts — how many hard/core days may run back to back.
 *
 * SAM'S RULING (2026-07-28, Batch 6, re-ruled):
 * > 4 consecutive core/team days is the placement scorer's SOFT preference
 * > boundary — the scorer prefers breaking streaks at 4; hard permission remains
 * > 5 straight per the Batch 2 hard-days ruling.
 *
 * WHY THIS WAS RE-RULED. I first presented this number to Sam as a coach
 * observation streak — "four weeks earns a coach note" — and he blessed it on
 * that description. It is not that. It counts CONSECUTIVE CORE OR TEAM DAYS in
 * the pre-season placement scorer, and it decides whether a candidate session
 * may take a day. The blessing was therefore attached to a rule that does not
 * exist, so it was returned unwired and re-ruled against what the code does.
 *
 * Attributing a ruling to a number the ruling was not about is worse than
 * leaving the number unattributed: unattributed reads as "nobody has looked at
 * this", which is true and actionable, while a false attribution reads as
 * settled and stops anyone looking again.
 *
 * RULING ANCHOR, NOT A BIBLE ANCHOR. Bible Section 2 states the WEEKLY hard-day
 * budget — prefer 4, permit 5 — and says nothing about consecutive days. Sam's
 * ruling carries the same two numbers across to the consecutive-day question
 * deliberately, which is a decision he made rather than a line the Bible states.
 * Marking it `BIBLE_ANCHOR` would claim a citation that does not exist.
 */

export const CONSECUTIVE_CORE_DAY_RULING = {
  ruledOn: '2026-07-28',
  where: 'docs/BATCH4_BATCH6_RULINGS_2026-07-28.md',
  kind: 'ruling_anchor',
  quote: '4 consecutive core/team days is the placement scorer\'s SOFT preference '
    + 'boundary — the scorer prefers breaking streaks at 4; hard permission remains '
    + '5 straight per the Batch 2 hard-days ruling.',
} as const;

/**
 * The scorer PREFERS to break a run here. A candidate that would extend a run to
 * this length is passed over while any other placement is available — but the
 * preference yields, because it is not permission.
 */
export const PREFERRED_CONSECUTIVE_CORE_DAY_BREAK = 4;

/**
 * The ceiling. No path may place a core/high-stress session that would run past
 * this, whoever is asking — including the exposure contract, which previously
 * bypassed the run check entirely because a required session was assumed to
 * outrank it. A required session may take a day; it may not take a sixth
 * straight hard one.
 */
export const PERMITTED_CONSECUTIVE_CORE_DAYS = 5;

/** True when extending a run to `run` days crosses the soft preference. */
export function exceedsPreferredConsecutiveCoreDays(run: number): boolean {
  return run >= PREFERRED_CONSECUTIVE_CORE_DAY_BREAK;
}

/** True when extending a run to `run` days crosses the hard permission. */
export function exceedsPermittedConsecutiveCoreDays(run: number): boolean {
  return run > PERMITTED_CONSECUTIVE_CORE_DAYS;
}
