/**
 * IS A SMALLER WEEKLY COMMITMENT LEGAL FOR THIS ATHLETE?
 *
 * ## THE ANSWER IS GENERATION'S, AND THIS MODULE ONLY ASKS IT
 *
 * The mission's clause B5 — *"offer only legal session-count choices supported
 * by their phase, gym access and schedule"* — has exactly one truthful source in
 * this app: the week validator, reached by building the week and seeing whether
 * it refuses. Measured refusals from a 48-world sweep at `6117a9fd` include
 * `sprint_high_speed_required_minimum`, `main_strength_permitted_maximum`,
 * `hard_day_permitted_maximum` and `required_safe_patterns_present:hinge` —
 * four different laws, in four different owners, none of which a phase/gym
 * lookup table in this file could reproduce.
 *
 * ⚠ **A TABLE HERE WOULD BE A SECOND AUTHORITY.** It would be free to disagree
 * with the first, and the athlete would find out by choosing an option that then
 * refused to build — an offer the app cannot honour. So the probe BUILDS.
 *
 * ## IT IS DELIBERATELY EXPENSIVE, AND THAT IS BOUNDED
 *
 * One generation per candidate count, and the candidates are only the counts
 * BELOW the athlete's current commitment — at most five, in practice one or two.
 * It runs when the question is raised, which is at most once per block.
 *
 * ## IT PROBES WITH AN EMPTY HISTORY, ON PURPOSE
 *
 * The question is *"could you train this often"*, not *"what would this block
 * have looked like"*. Feeding the athlete's history in would let a load
 * progression or a very-hard reduction decide whether an option is OFFERED,
 * which is the attendance question being answered by the recovery question.
 */

import type { DayOfWeek, OnboardingData } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import type { CommitmentLegalityProbe } from './weeklyCommitmentQuestion';
import { commitmentPatchFor } from './weeklyCommitmentQuestion';
import { DAYS_OF_WEEK } from './gameAnchor';

export function commitmentLegalityProbe(args: {
  profile: OnboardingData;
  /** The Monday the rebuilt block would start on. */
  blockStartISO: string;
  blockNumber: number;
  weekOrder?: readonly DayOfWeek[];
  /**
   * The days the athlete could train and has not committed. Present only for the
   * GROWING direction — `commitmentPatchFor` consults it when the asked-for count
   * is larger than the day set they already have, and ignores it otherwise, so
   * the shrinking caller is unaffected by passing nothing.
   */
  availableDays?: readonly DayOfWeek[];
}): CommitmentLegalityProbe {
  const { profile, blockStartISO, blockNumber, weekOrder = DAYS_OF_WEEK } = args;
  return (sessionsPerWeek: number): boolean => {
    if (sessionsPerWeek > (profile.preferredTrainingDays ?? []).length) return false;
    const patch = commitmentPatchFor({
      profile,
      sessionsPerWeek,
      weekOrder,
      ...(args.availableDays !== undefined ? { availableDays: args.availableDays } : {}),
    });
    try {
      const program = generateProgramLocally({ ...profile, ...patch }, {
        todayISO: blockStartISO,
        blockNumber,
        // EMPTY, and the module header says why: this asks whether the athlete
        // COULD train this often, not what this particular block would become.
        progressionHistory: { sessionFeedback: {}, weightOverrides: {}, blockState: null },
      });
      // A program that builds but carries no microcycle is not a legal offer
      // either — it is a refusal that forgot to throw.
      return program.microcycles.length > 0;
    } catch {
      // ⚠ SWALLOWED ON PURPOSE, AND ONLY HERE. A refusal IS the answer to this
      // question — `GeneratedWeekRefusedError` means "this commitment does not
      // produce a legal week for this athlete", which is exactly what the
      // caller asked. Nothing else in this app treats a refusal as data.
      return false;
    }
  };
}
