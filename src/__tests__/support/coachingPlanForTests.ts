/**
 * A `CoachingPlan` FOR SUITES WHOSE SUBJECT IS A BEHAVIOUR, NOT THE PLANNER.
 *
 * The legacy `buildCoachingPlan(inputs)` is deleted. Several suites called it —
 * but **the planner was their DOOR, never their subject**: they are about
 * readiness dosing, the rules kernel, strength-answer authority and weekly-dose
 * ownership. Deleting those suites would delete real coverage to make a red go
 * away, and leaving them broken makes a permanent meaningless red. So they are
 * re-pointed at the live scheduler-backed producer through this one shim.
 *
 * ## IT IS A DOOR, NOT A SECOND PRODUCER
 *
 * It supplies the `seasonPhaseClock` the new producer requires and nothing else.
 * It decides no scheduling, selects no content, and holds no defaults that could
 * drift from production — every answer comes from
 * `buildInitialGeneratedCoachingPlan`, which is what generation itself runs.
 *
 * ⚠ **The plans it returns are the SCHEDULER's, so they are not expected to
 * match the deleted planner's numbers.** Where a re-pointed suite now fails on a
 * value, that is a genuine behavioural difference to be read and reported — not
 * something to be tuned away here.
 */
import { buildInitialGeneratedCoachingPlan } from '../../services/api/generateProgram';
import type { CoachingInputs, CoachingPlan } from '../../utils/coachingEngine';
import type { SeasonPhaseClock } from '../../rules/seasonPhaseClock';

/** The week these suites generate against, so a plan is reproducible. */
export const TEST_PLAN_TODAY_ISO = '2026-07-13';

/**
 * `null` when the SCHEDULER legally refuses this athlete, instead of throwing.
 *
 * A refusal is a real answer now — the approved source forbids some day-sets
 * outright (Full Body ×2 "never back-to-back", lower spacing, plane repeats) — and
 * a suite whose subject is DOSING should not die on the first combination whose
 * calendar happens to be illegal. It threw, and killed every remaining
 * combination with it.
 *
 * ⚠ **A caller must count what it skipped and refuse to pass on an empty set.**
 * Silently dropping combinations is how a matrix suite ends up asserting nothing.
 * Only `weekly_schedule_refused` is absorbed; every other error still throws.
 */
export function coachingPlanOrRefusal(
  inputs: CoachingInputs,
  options: { todayISO?: string; blockNumber?: number } = {},
): CoachingPlan | null {
  try {
    return coachingPlanForTests(inputs, options);
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'weekly_schedule_refused') return null;
    throw error;
  }
}

export function coachingPlanForTests(
  inputs: CoachingInputs,
  options: { todayISO?: string; blockNumber?: number } = {},
): CoachingPlan {
  const todayISO = options.todayISO ?? TEST_PLAN_TODAY_ISO;
  const seasonPhaseClock: SeasonPhaseClock = {
    protocolVersion: 1,
    selectedPhase: inputs.seasonPhase,
    phaseEntryWeekStartISO: todayISO,
    originProvenance: 'explicit_user_phase_change',
    persistenceProvenance: 'preserved_persisted_state',
  } as SeasonPhaseClock;
  return buildInitialGeneratedCoachingPlan({
    coachingInputs: inputs,
    profile: { seasonPhase: inputs.seasonPhase },
    todayISO,
    blockNumber: options.blockNumber ?? 1,
    seasonPhaseClock,
  });
}
