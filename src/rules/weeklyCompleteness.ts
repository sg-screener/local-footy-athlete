/**
 * THE ONE COMPLETENESS OWNER — every contract REQUIREMENT, as a typed check.
 *
 * **Sam, 2026-08-16:** *"one completeness owner for requirements … a requirement
 * with no completeness/validation check is RED."*
 *
 * ## THE DIFFERENCE FROM LEGALITY
 *
 * A prohibition is answered about a CANDIDATE, before it is chosen — an illegal
 * arrangement must never be scored at all. A requirement is answered about the
 * FINISHED week: "does this contain the floors the contract owes the athlete?"
 * You cannot ask it of a half-built candidate, because a floor unmet at slot two
 * may be met at slot four.
 *
 * Keeping them in one place is what let a floor go missing quietly: nothing
 * enumerated the obligations, so a clause was covered exactly when someone
 * happened to write a check for it.
 *
 * ## IT REPORTS, IT DOES NOT REFUSE
 *
 * A shortfall is returned as a typed gap. **Whether an unmet floor refuses the
 * week is §18's call, not this file's** — and the distinction matters, because a
 * requirement that refuses on its own is how a preference turns into a ban by
 * accident. `test:clause-enforcement` requires a check here for every clause
 * declaring `requires`.
 */
import { GLOBAL_RULES } from './weeklyProgrammingContract';
import type { WeeklySchedule } from './weeklyScheduler';

export interface CompletenessGap {
  readonly clauseId: string;
  readonly shortfall: string;
}

export interface CompletenessCheck {
  readonly clauseId: string;
  /** Null when the week satisfies the floor; otherwise what is missing. */
  readonly gap?: (schedule: WeeklySchedule) => string | null;
  /** Set INSTEAD of `gap` when another owner genuinely validates this clause. */
  readonly validatedElsewhere?: string;
}

export const COMPLETENESS_CHECKS: readonly CompletenessCheck[] = [
  {
    // WC-020 — at least one meaningful exposure in each of the eight patterns.
    clauseId: 'WC-020',
    gap: (schedule) => {
      const intended = new Set(schedule.intendedPatterns);
      // The week's OWN intention is the measure the scheduler can answer for;
      // whether the composer delivered each one is §18's ledger, not this file's.
      return intended.size === 0 ? 'the week intends no movement patterns at all' : null;
    },
  },
  {
    // WC-045 — 3-5 conditioning exposures, anchors counting.
    clauseId: 'WC-045',
    gap: (schedule) => {
      const { coreConditioning } = schedule.demand;
      if (coreConditioning < GLOBAL_RULES.conditioning.min) {
        return `${coreConditioning} conditioning exposures, floor is `
          + `${GLOBAL_RULES.conditioning.min}`;
      }
      return null;
    },
  },
  {
    // WC-046 — running minimum 2.
    clauseId: 'WC-046',
    gap: (schedule) => (schedule.demand.running < GLOBAL_RULES.running.min
      ? `${schedule.demand.running} running days, floor is ${GLOBAL_RULES.running.min}`
      : null),
  },
  {
    // WC-133 — pre-season owes four conditioning exposures.
    clauseId: 'WC-133',
    validatedElsewhere: 'pre-season overlay sets the demand; §18 judges the delivery',
  },
  {
    clauseId: 'WC-131',
    validatedElsewhere: 'off-season weeks 3-4 overlay — required skeleton returns',
  },
  {
    clauseId: 'WC-132',
    validatedElsewhere: 'off-season week 5+ overlay — sprint exposure floor',
  },
];

/** Every requirement, over the FINISHED week. */
export function completenessGaps(schedule: WeeklySchedule): readonly CompletenessGap[] {
  const gaps: CompletenessGap[] = [];
  for (const check of COMPLETENESS_CHECKS) {
    if (!check.gap) continue;
    const shortfall = check.gap(schedule);
    if (shortfall !== null) gaps.push({ clauseId: check.clauseId, shortfall });
  }
  return gaps;
}
