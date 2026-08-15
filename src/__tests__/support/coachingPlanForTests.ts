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
