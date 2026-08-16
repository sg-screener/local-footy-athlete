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
  type Section18AuthorisedReduction,
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

/**
 * THE APPROVED LAYOUT'S OWN STRENGTH COUNT, HANDED TO §18 AS A TYPED REDUCTION.
 *
 * ## ⚠ THE DEFECT THIS CLOSES, MEASURED
 *
 * A pre-season athlete with TWO gym days:
 *
 *     scheduler   clause WC-110, requiredStrengthSessions = 2   ← Full Body ×2
 *     §18 table   early/mid/late_preseason, strength.required = 3
 *     result      REFUSED (main_strength_required_minimum, actual 2)
 *
 * **The week the approved contract asked for could not be built at all.** Sam's
 * approved source is explicit — *"Four is preferred when availability permits.
 * Two days gets Full Body ×2; three days gets three sessions"*
 * (`docs/WEEKLY_PROGRAMMING_SOURCE_REVIEW_2026-08-14.md`), and clauses WC-100 /
 * WC-110 / WC-120 state Full Body ×2 for two gym days in ALL THREE phases. §18's
 * phase table is a SECOND representation of the same number and it disagreed.
 *
 * Sam already ruled which one wins (2026-08-15, this file's own header):
 * *"§18 derives its acceptance contract from the scheduler's completed weekly
 * schedule. It is not an independent planner."*
 *
 * ## WHAT IT DOES **NOT** DO — §18 KEEPS ITS TEETH
 *
 * It lowers the FLOOR to the count the approved layout authored for THIS
 * athlete's availability. It does not lower the floor to what the week
 * DELIVERED. A week that ships one main-strength session when WC-110 required
 * two is still refused, which is exactly the check this file's header warns must
 * survive — *"collapsing them would make the contract unable to say the
 * scheduler got it wrong."*
 *
 * It is also strictly one-directional: `Math.min` against the phase floor, so a
 * layout asking for MORE than the phase requires never raises the minimum.
 *
 * `insufficient_availability` is the existing typed reason — the same one the V1
 * contract already records when selected-day availability cannot hold the
 * original strength target. Nothing new is minted.
 */
function availabilityReductions(
  schedule: WeeklySchedule,
  phaseRequiredMinimum: number,
): Section18AuthorisedReduction[] {
  const layoutRequired = schedule.requiredStrengthSessions;
  if (!(layoutRequired < phaseRequiredMinimum)) return [];
  return [{
    metric: 'main_strength_frequency',
    originalApprovedTarget: phaseRequiredMinimum,
    reducedTarget: layoutRequired,
    reason: 'insufficient_availability',
    scope: 'week',
    change: 'frequency',
    detail: `Approved layout ${schedule.layoutClauseId} requires ${layoutRequired} `
      + `strength session(s) on this athlete's gym-day availability; the phase floor `
      + `of ${phaseRequiredMinimum} cannot be placed.`,
    provenance: 'live_typed_reduction',
  }];
}

export function schedulerExposureContract(
  input: SchedulerExposureContractInput,
): WeeklyExposureContractV2 {
  const { demand } = input.schedule;
  // THE PHASE FLOOR IS READ FROM THE BUILDER ITSELF, NOT TRANSCRIBED.
  // A copy of the per-phase number here would be a THIRD representation of the
  // very thing this reduction exists to reconcile. One throwaway build answers
  // "what would the floor be without me", and the real build follows.
  const phaseFloor = buildSection18WeeklyExposureContractV2({
    ...input.identity,
    teamTrainingDays: input.clubNights,
    fixtureDays: input.gameDays,
    plannerSelected: {
      mainStrength: demand.mainStrength,
      coreConditioning: demand.coreConditioning,
      sprintHighSpeed: demand.sprintHighSpeed,
      powerPrimers: null,
    },
  }).mainStrength.exposure.requiredMinimum;

  return buildSection18WeeklyExposureContractV2({
    ...input.identity,
    teamTrainingDays: input.clubNights,
    fixtureDays: input.gameDays,
    reductions: [
      ...(input.identity.reductions ?? []),
      ...availabilityReductions(input.schedule, phaseFloor),
    ],
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
