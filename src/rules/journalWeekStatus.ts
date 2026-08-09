/**
 * WEEK STATUS — "one calm line", addendum Group 1 item 3.
 *
 * L14 domain purity: no React, no navigation, no stores, no device clock.
 *
 * ── THIS EXISTS BECAUSE A GATE REFUSED THE EASY VERSION ──
 *
 * The first attempt at a week status read `achievedCount` and
 * `unresolvedMinimumShortfall` off the STORED contract, and
 * `section18ShortfallCopyTests` refused it: *"no caller reads an achieved tally
 * off a stored contract."* A stored tally is derived output and goes stale — the
 * athlete trains on Thursday and the snapshot still says what it said on Monday.
 *
 * I then recorded the item as BLOCKED, and **that was an inference rather than a
 * measurement**. The gate refused a stale READ; it never said the derivation was
 * unreachable. `evaluateSection18EffectiveWeek` takes the V2 contract, the
 * week's workouts and its start date — all of which a surface already holds —
 * and **builds a fresh ledger internally**. That is exactly the derivation the
 * gate demanded, sitting in the open the whole time.
 *
 * ── SO THIS MODULE ANSWERS NOTHING ITSELF ──
 *
 * It does not evaluate, count, or classify. It takes the blocking findings the
 * Section 18 evaluator produced and turns them into the athlete's words through
 * the EXISTING owner. Every number in the answer was derived by the owner of
 * that question, this turn, from this week's workouts.
 *
 * ── A DOMAIN WITH NO ATHLETE WORD IS NEVER DISCLOSED BY NAME ──
 *
 * `identity`, `migration` and `anchor_credit` are bookkeeping about the contract
 * itself. `ATHLETE_WORD_FOR_DOMAIN` returns null for them and they are dropped —
 * the honest-outcome law, and the same rule `journalWeekJob` follows.
 */

import { ATHLETE_WORD_FOR_DOMAIN } from './section18ShortfallDisclosure';
import type { Section18Finding } from './section18EffectiveWeekEvaluator';

/** One thing the week asked for and has not got. */
export interface JournalWeekGap {
  readonly athleteWord: string;
}

export interface JournalWeekStatus {
  /** True when nothing blocking is outstanding. */
  readonly onTrack: boolean;
  /**
   * What is outstanding, in the athlete's words, each named once. Empty when
   * `onTrack`, and empty is NOT the same as on-track being false.
   */
  readonly gaps: readonly JournalWeekGap[];
}

/**
 * The week's status from the evaluator's BLOCKING findings.
 *
 * ADVISORIES ARE NOT GAPS. The evaluator separates blocking violations from
 * advisories deliberately; treating an advisory as a gap would tell the athlete
 * their week is short when the contract itself does not think so.
 *
 * Returns null when there is nothing to evaluate — a week with no contract has
 * no status, and saying "on track" about an ungoverned week would be a claim
 * about a standard that does not exist.
 */
export function buildJournalWeekStatus(
  blockingFindings: readonly Section18Finding[] | null | undefined,
): JournalWeekStatus | null {
  if (!blockingFindings) return null;

  // ONE WORD PER DOMAIN, NOT ONE PER FINDING. Two strength findings are one
  // strength gap to an athlete — `shortfallsFromFindings` merges domains for
  // exactly this reason, and a status that said "strength, strength" would be
  // counting findings while claiming to count training.
  const words: string[] = [];
  for (const finding of blockingFindings) {
    const athleteWord = ATHLETE_WORD_FOR_DOMAIN[finding.domain];
    if (athleteWord === null) continue;
    if (!words.includes(athleteWord)) words.push(athleteWord);
  }

  return {
    onTrack: words.length === 0,
    gaps: words.map((athleteWord) => ({ athleteWord })),
  };
}
