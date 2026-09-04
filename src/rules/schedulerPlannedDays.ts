/**
 * THE SCHEDULER → COMPOSER SEAM. Session intentions in, `ComposerPlannedDay[]` out.
 *
 * **THIS REPLACES `composedPlannedDaysFrom` AS THE SOURCE OF SESSION COUNT,
 * PURPOSE AND WEEKDAY.** That function read the legacy planner's `weeklyPlan`;
 * this reads the approved contract's scheduler. The composer's own interface does
 * not change — it still receives planned days and still owns every exercise.
 *
 * Pure, and deliberately thin: it names no exercise, chooses no dose and drops no
 * day. It changes SHAPE only, exactly as `composedPlannedDaysFrom` promised to.
 */
import {
  MAIN_PATTERNS_FOR_PURPOSE,
  PATTERNS_FOR_PURPOSE,
  type SessionPurpose,
} from './weeklyProgrammingContract';
import type { SessionIntention } from './weeklyScheduler';
import type { ComposerPlannedDay } from './composeWeek';

/**
 * The composer's archetype vocabulary, from the contract's purpose vocabulary.
 *
 * ⚠ **`full_body` MAPS TO `full_body`, AND THAT IS THE WHOLE POINT OF R-087.**
 * The composer treats a `full_body` archetype as a coverage day that asks the week
 * what is open. Mapping it to `lower` here would reintroduce, at the seam, exactly
 * the collapse that cost 36 refusal occurrences.
 */
const ARCHETYPE_FOR_PURPOSE: Readonly<Record<SessionPurpose, string>> = {
  full_body: 'full_body',
  lower: 'lower',
  lower_squat: 'lower',
  lower_hinge: 'lower',
  upper: 'upper',
  upper_push: 'upper',
  upper_pull: 'upper',
};

/* The patterns the composer should treat as MAIN-LIFTED for this purpose now
 * come from `weeklyProgrammingContract.MAIN_PATTERNS_FOR_PURPOSE` — the copy that
 * stood here was identical to `scheduleToCoachingPlan`'s and both are folded into
 * that one owner (R-378). The old comment here claimed `MainStrengthPattern`
 * cannot name the single-leg slots; R-087 widened the type on 2026-08-13 and
 * neither copy was swept, which is exactly why a third reader was not allowed to
 * add a third copy. */

/**
 * A stable id for the day, so downstream readers that key on `planEntryId` keep
 * working. **The MERGE key is `dayOfWeek`** (`assembleAuthoredWeek`), so this is an
 * identifier and not a join key — stated because assuming otherwise is how a
 * composed day would silently fail to find its adapter counterpart.
 */
function planEntryIdFor(weekStartISO: string, intention: SessionIntention): string {
  return `sched:${weekStartISO}:${intention.dayOfWeek}:${intention.purpose}`;
}

export function schedulerPlannedDays(args: {
  readonly weekStartISO: string;
  readonly days: readonly SessionIntention[];
  /** The planner's own session names, by weekday, when it has one for that day. */
  readonly nameByDayOfWeek?: Readonly<Record<number, string>>;
  readonly tierByDayOfWeek?: Readonly<Record<number, string>>;
}): ComposerPlannedDay[] {
  const out: ComposerPlannedDay[] = [];
  for (const intention of args.days) {
    if (intention.owner !== 'strength' || !intention.purpose) continue;
    const purpose = intention.purpose;
    out.push({
      dayOfWeek: intention.dayOfWeek,
      // A club night that also holds gym work is a TEAM DAY — the contract's
      // "Gym may share a club-training day", carried through rather than lost.
      isTeamDay: intention.clubTraining,
      planEntryId: planEntryIdFor(args.weekStartISO, intention),
      strengthIntent: {
        archetype: ARCHETYPE_FOR_PURPOSE[purpose],
        primaryPattern: MAIN_PATTERNS_FOR_PURPOSE[purpose][0],
        /* Copied, not aliased: the owner's table is `readonly` and
         * `StrengthIntent` holds mutable arrays that downstream normalisation
         * sorts in place. Handing out the shared row would let one day's
         * normalisation reorder every other day's patterns. */
        plannedPatterns: [...MAIN_PATTERNS_FOR_PURPOSE[purpose]],
        effectivePatterns: [...MAIN_PATTERNS_FOR_PURPOSE[purpose]],
      } as ComposerPlannedDay['strengthIntent'],
      // ⚠ THE NAME IS THE PLANNER'S WHERE IT HAS ONE. Composition never renames a
      // day, and inventing athlete-facing wording here is explicitly outside what
      // the contract owns (§1). Where the planner has no name for a day the
      // scheduler chose, the purpose is used as a neutral internal label.
      name: args.nameByDayOfWeek?.[intention.dayOfWeek] ?? purpose,
      workoutType: intention.clubTraining ? 'Team Training' : 'Strength',
      sessionTier: args.tierByDayOfWeek?.[intention.dayOfWeek] ?? 'core',
    });
  }
  return out;
}

/** The movement intention, for readers that want it without re-deriving. */
export function intendedPatternsFor(purpose: SessionPurpose): readonly string[] {
  return PATTERNS_FOR_PURPOSE[purpose];
}
