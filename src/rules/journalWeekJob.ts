/**
 * THIS WEEK'S JOB — Monday card / addendum Group 1 item 4.
 *
 * Item 3 (week STATUS — "is it done?") is deliberately NOT here; see the second
 * section below, which is the reason.
 *
 * L14 domain purity: no React, no navigation, no stores, no device clock.
 *
 * ── IT ASKS THE CONTRACT. IT DOES NOT BUILD ONE, AND IT DOES NOT COUNT. ──
 *
 * This is the trap the Monday card plan named in advance, and it is the one
 * every slice of this unit has had to refuse: the week's contract already exists
 * as a typed fact on the microcycle (`Microcycle.exposureContractV2`), authored
 * by the Section 18 resolver. Building a second contract from the same inputs
 * would be a second answer to "what does this week ask of the athlete".
 *
 * ── AND IT READS TARGETS ONLY. THE ACHIEVED TALLIES ARE OFF LIMITS. ──
 *
 * THE FIRST VERSION OF THIS MODULE READ `achievedCount` AND
 * `unresolvedMinimumShortfall` STRAIGHT OFF THE STORED CONTRACT, and
 * `section18ShortfallCopyTests` went red on its first run with exactly the right
 * sentence: *"no caller reads an achieved tally off a stored contract"*.
 *
 * That gate is the north star in miniature and it was right. A TARGET is policy —
 * a decision about what the week asks, and stable. An ACHIEVED TALLY is derived
 * output, and a stored one goes stale beside the facts it was derived from: the
 * athlete trains on Thursday and the contract's snapshot still says what it said
 * on Monday. Reading it here would have put a stale number on the athlete's
 * screen and called it their week.
 *
 * So this module answers ONE question — **what does this week ask of you** — from
 * the policy half of the contract. Whether the week is SATISFIED is a derivation
 * over a freshly-built ledger (`ledgerFromEffectiveWorkouts` +
 * `evaluateWeeklyExposureContract`), it belongs to the owners the gate names, and
 * it is not this module's to answer.
 *
 * WHAT IT ACTUALLY DOES: reads three numeric policies for their targets,
 * translates their domains into athlete words through the EXISTING owner, and
 * reports absence as absence.
 */

import { ATHLETE_WORD_FOR_DOMAIN } from './section18ShortfallDisclosure';
import type { Section18FindingDomain } from './section18EffectiveWeekEvaluator';
import type {
  Section18NumericPolicy,
  WeeklyExposureContractV2,
} from './weeklyExposureContractV2';

/** One thing the week asks of the athlete, in their own word. */
export interface JournalWeekAsk {
  readonly domain: Section18FindingDomain;
  /** The athlete's word, from the existing owner. Never a contract noun. */
  readonly athleteWord: string;
  /** What the week asks for. Policy — a decision, not a tally. */
  readonly target: number;
}

export interface JournalWeekJob {
  readonly asks: readonly JournalWeekAsk[];
}

/**
 * What a domain asks for.
 *
 * THE PLANNER'S SELECTION WINS OVER THE DEFAULT, because the planner's number is
 * what this athlete's week was actually built to — `defaultTarget` is what
 * Section 18 asks of everybody. Falling back to the default when the planner
 * selected nothing is not a guess; it is the contract's own floor.
 */
function targetFor(policy: Section18NumericPolicy): number {
  return policy.plannerSelectedTarget ?? policy.defaultTarget;
}

function askFrom(
  domain: Section18FindingDomain,
  policy: Section18NumericPolicy,
): JournalWeekAsk | null {
  const athleteWord = ATHLETE_WORD_FOR_DOMAIN[domain];
  // A DOMAIN WITH NO ATHLETE WORD IS NEVER DISCLOSED BY NAME. The owner's table
  // returns null for contract bookkeeping, and the honest-outcome law forbids
  // the raw code reaching the athlete — so the ask is dropped rather than
  // rendered with its internal name.
  if (athleteWord === null) return null;
  const target = targetFor(policy);
  if (target <= 0) return null;
  return { domain, athleteWord, target };
}

/**
 * The week's job, read off the contract the resolver already authored.
 *
 * Returns null when there is no contract — a week the app has not governed has
 * no job to state, and inventing one from the projection is exactly what this
 * module exists not to do.
 */
export function buildJournalWeekJob(
  contract: WeeklyExposureContractV2 | null | undefined,
): JournalWeekJob | null {
  if (!contract) return null;

  const asks = [
    askFrom('main_strength', contract.mainStrength.exposure),
    askFrom('conditioning', contract.conditioning.core),
    askFrom('sprint_high_speed', contract.sprintHighSpeed.exposure),
  ].filter((ask): ask is JournalWeekAsk => ask !== null);

  if (asks.length === 0) return null;
  return { asks };
}
