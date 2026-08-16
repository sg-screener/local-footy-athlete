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
  /**
   * `delivered` is the set of movement patterns the FINAL week actually contains,
   * read off the built rows. Passing it in keeps this file free of any opinion
   * about how a workout declares its pattern — that belongs to the reader that
   * owns the row shape.
   */
  readonly gap?: (
    schedule: WeeklySchedule,
    delivered?: ReadonlySet<string>,
  ) => string | null;
  /** Set INSTEAD of `gap` when another owner genuinely validates this clause. */
  readonly validatedElsewhere?: string;
}

export const COMPLETENESS_CHECKS: readonly CompletenessCheck[] = [
  {
    // WC-020 — at least one meaningful exposure in each of the eight patterns.
    //
    // ⚠ **THIS USED TO MEASURE THE REQUEST, NOT THE DELIVERY.** It asked whether
    // the week INTENDED any patterns, which the scheduler decides and therefore
    // can never fail — a completeness check that reads its own side of the
    // handover is green by construction. Sam, 2026-08-16: check *"against the
    // actual delivered final week"*.
    //
    // It now reads the built workouts' declared `main_strength` patterns. A week
    // that asks for a hinge and ships no hinge row FAILS, which is the whole
    // point and is proven by mutation in `test:clause-enforcement`.
    clauseId: 'WC-020',
    gap: (schedule, delivered) => {
      if (!delivered) return 'no delivered week was supplied to measure';
      const intended = new Set(schedule.intendedPatterns);
      if (intended.size === 0) return 'the week intends no movement patterns at all';
      const missing = [...intended].filter((pattern) => !delivered.has(pattern));
      return missing.length > 0
        ? `intended but not delivered: ${missing.sort().join(', ')}`
        : null;
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
export function completenessGaps(
  schedule: WeeklySchedule,
  delivered?: ReadonlySet<string>,
): readonly CompletenessGap[] {
  const gaps: CompletenessGap[] = [];
  for (const check of COMPLETENESS_CHECKS) {
    if (!check.gap) continue;
    const shortfall = check.gap(schedule, delivered);
    if (shortfall !== null) gaps.push({ clauseId: check.clauseId, shortfall });
  }
  return gaps;
}
