/**
 * §18's ACCEPTANCE CONTRACT, DERIVED FROM THE SCHEDULER'S COMPLETED WEEK.
 *
 * **Sam, 2026-08-15:** *"§18 derives its acceptance contract from the scheduler's
 * completed weekly schedule. It is not an independent planner."*
 *
 * ## ⚠ THE SHAPE IS PRESERVED. ONLY THE PRODUCER CHANGES.
 *
 * `WeeklyExposureContractV2` is read by 34 non-test modules — the store, hydration
 * ingress, the accepted-week gateway, the journal, offer placement, safety policy,
 * the session resolver, the coach's edit path. **Those are consumers of the DATA
 * SHAPE, not callers of the old planner**, and nothing about them needs to change.
 *
 * So this does NOT rewrite the contract. It calls the same pure builder,
 * `buildSection18WeeklyExposureContractV2`, with `plannerSelected` taken from the
 * SCHEDULER'S OWN COUNTS instead of the legacy allocator's.
 *
 * **That single substitution is what closes the disagreement** that cost 44
 * refusals: the judge measured a composed week against a session count the
 * scheduler had never chosen. Builder and judge now read the same number.
 *
 * ## WHAT IS STILL §18's, AND DELIBERATELY
 *
 * The per-phase POLICY — required minimums, permitted maximums, preferred ranges,
 * power eligibility — stays in `weeklyExposureContractV2`'s own table. The
 * scheduler supplies what the week SELECTED; the policy says what is REQUIRED and
 * PERMITTED. Those are two different questions and collapsing them would make the
 * contract unable to say the scheduler got it wrong.
 */
import {
  buildSection18WeeklyExposureContractV2,
  type Section18ContractV2Input,
  type WeeklyExposureContractV2,
} from './weeklyExposureContractV2';
import type { WeeklySchedule } from './weeklyScheduler';
import type { MainStrengthPattern } from './strengthPatternContributions';

export interface SchedulerExposureContractInput {
  readonly schedule: WeeklySchedule;
  /** Everything §18 needs that is not a scheduling decision. */
  readonly identity: Omit<Section18ContractV2Input,
    'plannerSelected' | 'teamTrainingDays' | 'fixtureDays'>;
  readonly clubNights: readonly number[];
  readonly gameDays: readonly number[];
  readonly kitUnachievablePatterns?: readonly MainStrengthPattern[];
}

export function schedulerExposureContract(
  input: SchedulerExposureContractInput,
): WeeklyExposureContractV2 {
  const { demand } = input.schedule;
  return buildSection18WeeklyExposureContractV2({
    ...input.identity,
    teamTrainingDays: input.clubNights,
    fixtureDays: input.gameDays,
    kitUnachievablePatterns: input.kitUnachievablePatterns
      ?? input.identity.kitUnachievablePatterns,
    // ── THE SUBSTITUTION ────────────────────────────────────────────────────
    //
    // Every one of these was the legacy allocator's answer. They are now the
    // scheduler's, counted from the DATED WEEK it produced.
    plannerSelected: {
      mainStrength: demand.mainStrength,
      coreConditioning: demand.coreConditioning,
      sprintHighSpeed: demand.sprintHighSpeed,
      // ⚠ POWER PRIMERS ARE NOT A SCHEDULER DECISION AND THE CONTRACT SAYS SO.
      //
      // Sam's approved source mentions power exactly twice: *"then you can throw
      // power and stuff in there"* (§3 Session size) and G-2's *"no added speed
      // work"*. It gives eligibility and a placement fence, **never a weekly
      // count** — and §18's own per-phase table already owns `power.eligible` and
      // `preferredWeeklyRange`.
      //
      // `null` means THE SCHEDULER SELECTS NO BUDGET, which leaves the phase
      // policy's own preferred range in charge — the pre-existing behaviour for
      // every route that never selected one. It is not a zero and must not be
      // written as one: zero would assert the week is owed no power at all.
      powerPrimers: null,
    },
  });
}
