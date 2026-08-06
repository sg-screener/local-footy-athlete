/**
 * WHERE THE WEEK'S OFFER GOES — one rule, called by generation and by repair.
 *
 * Sam's flush ruling (`docs/FLUSH_OFFER_RULING_2026-08-05.md`): "the app always
 * presents it; doing it is the athlete's choice". Ruled 2026-08-06
 * (`docs/1B_OFFER_SURVIVAL_RULINGS_2026-08-06.md`) to be a property of the WEEK
 * at all times, not of the moment of generation — so a week that stops offering,
 * by any path, is out of conformance and the repair owner restores it.
 *
 * WHY THIS MODULE EXISTS RATHER THAN A SECOND PLACER. The offer used to be
 * placed only in `applySection18ConditioningAllocation`'s tail, which runs at
 * generation. Measured: delete an unrelated session from an in-season game week
 * and the week comes back with no offer at all — the repair path never went
 * through the placer, and nothing else could put one back
 * (`docs/1B_OFFER_SURVIVAL_REASSESSMENT_2026-08-06.md`). Teaching each repair
 * path about flushes would have been the fourth site to learn the same thing;
 * this is the rule they share instead.
 *
 * IT IS SELECTION ONLY, AND THAT IS DELIBERATE. Generation places on a plan
 * ALLOCATION before any content exists; repair places on a materialised
 * `Workout`. Those two cannot share a body — but they must not disagree about
 * WHICH DAY, which is the part that would silently drift. So the shape-agnostic
 * choice lives here and each caller performs its own attachment. The candidate
 * view below is the minimum both shapes can answer.
 */

import type { Microcycle, OnboardingData, Workout } from '../types/domain';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { composedOptionalClearingPatch } from '../utils/composedOptionalMarker';
import { normalizeVisibleWorkoutIdentity } from '../utils/visibleWorkoutIdentity';
import { hasMeaningfulWorkoutContent } from '../utils/workoutContent';
import type { WeeklyExposureContractV2 } from './weeklyExposureContractV2';

/**
 * What the rule needs to know about a session, in terms both a plan allocation
 * and a materialised workout can answer.
 */
export interface Section18OfferCandidate {
  /** JS day-of-week, 0 = Sunday. */
  dayOfWeek: number;
  /** A club night is never the app's to add work to. */
  isTeamDay: boolean;
  /** Already carries conditioning — the offer would be a second helping. */
  hasConditioning: boolean;
  /** Bible `:81` puts the flush ON the strength days, so these are preferred. */
  hasStrength: boolean;
  hasSpeed: boolean;
  /** Chosen to satisfy the week's CORE conditioning. Never also the offer. */
  isSelectedCore: boolean;
}

/**
 * Days relative to the fixture, matching the engine's own `gOffset`: negative
 * before the game, `0` on it, `+1` the day after. `null` when the week has no
 * fixture at all.
 */
export function offerFixtureOffset(dayOfWeek: number, fixtureDay: number | null): number | null {
  if (fixtureDay === null) return null;
  let diff = dayOfWeek - fixtureDay;
  if (diff > 0) diff -= 7;
  if (diff === 0) return 0;
  if (diff === -6) return 1;
  return diff;
}

/**
 * May the offer sit here without crowding the fixture?
 *
 * G-3 or earlier always. G-2 only when the offer would be the day's whole
 * content — an easy flush beside a lift or a speed session two days out is the
 * load the fixture protection exists to prevent.
 */
export function offerFixtureSafe(
  candidate: Section18OfferCandidate,
  fixtureDay: number | null,
): boolean {
  const offset = offerFixtureOffset(candidate.dayOfWeek, fixtureDay);
  return offset === null || offset <= -3 ||
    (offset === -2 && !candidate.hasStrength && !candidate.hasSpeed);
}

/** Training order, tie-broken Monday-first with Sunday last. */
function inTrainingOrder(
  left: Section18OfferCandidate,
  right: Section18OfferCandidate,
  fixtureDay: number | null,
): number {
  const leftOffset = offerFixtureOffset(left.dayOfWeek, fixtureDay);
  const rightOffset = offerFixtureOffset(right.dayOfWeek, fixtureDay);
  if (leftOffset !== null && rightOffset !== null && leftOffset !== rightOffset) {
    return leftOffset - rightOffset;
  }
  const leftDay = left.dayOfWeek === 0 ? 7 : left.dayOfWeek;
  const rightDay = right.dayOfWeek === 0 ? 7 : right.dayOfWeek;
  return leftDay - rightDay;
}

/**
 * Which days should carry the week's offer — in the order they should take it.
 *
 * Returns at most `count` day-of-week values. A strength day is preferred over
 * an empty one because that is the shape Bible `:81` authors ("optional
 * flushout/ aerobic conditioning off-leg" ON the strength days); an empty day
 * is taken only when no strength day can safely hold it.
 */
export function selectOfferDays(args: {
  candidates: readonly Section18OfferCandidate[];
  count: number;
  fixtureDay: number | null;
}): number[] {
  if (args.count <= 0) return [];
  return args.candidates
    .filter((candidate) => !candidate.isTeamDay && !candidate.hasConditioning &&
      !candidate.hasSpeed && !candidate.isSelectedCore &&
      offerFixtureSafe(candidate, args.fixtureDay))
    .sort((left, right) =>
      Number(!left.hasStrength) - Number(!right.hasStrength) ||
      inTrainingOrder(left, right, args.fixtureDay))
    .slice(0, args.count)
    .map((candidate) => candidate.dayOfWeek);
}

/**
 * How many offers the week should be presenting, from the contract alone.
 *
 * The planner's declaration, capped by the authored allowance — the same two
 * numbers the demote path respects, so a week can never be repaired past its
 * own maximum.
 */
export function declaredOfferCount(conditioning: {
  optionalFlush: {
    permitted: boolean;
    preferredRange: { max: number };
    plannerSelectedCount: number | null;
  };
}): number {
  if (!conditioning.optionalFlush.permitted) return 0;
  return Math.max(0, Math.min(
    conditioning.optionalFlush.plannerSelectedCount ?? 0,
    conditioning.optionalFlush.preferredRange.max,
  ));
}

/** Does this workout already carry the week's offer? */
function carriesOffer(workout: Workout): boolean {
  return workout.section18Evidence?.conditioningRole === 'optional_flush' ||
    (workout.section18ConditioningRole === 'optional_flush' && hasConditioningContent(workout));
}

function hasConditioningContent(workout: Workout): boolean {
  return !!workout.conditioningBlock?.options.length ||
    !!workout.conditioningCategory ||
    workout.hasCombinedConditioning === true;
}

/**
 * Take the offer back off a day, leaving everything else exactly as it was.
 *
 * The inverse of `attachOffer` below, and deliberately the same body
 * `fixtureMinimalReplan.stripConditioningComponent` used while the replan owned
 * ruling 2 — so re-homing the rule did not also change what "withdrawing an
 * offer" means. Returns `null` when nothing meaningful is left, which is the
 * signal to drop the day entirely rather than keep an empty session.
 */
function stripOffer(workout: Workout): Workout | null {
  const linkedRows = new Set(
    (workout.conditioningBlock?.options ?? []).flatMap((option) => option.exerciseIds),
  );
  const stripped = normalizeVisibleWorkoutIdentity({
    ...workout,
    exercises: (workout.exercises ?? []).filter((row) =>
      !linkedRows.has(row.id) && row.section18Evidence?.role !== 'conditioning'),
    conditioningBlock: undefined,
    conditioningCategory: undefined,
    conditioningFlavour: undefined,
    conditioningFeasibility: undefined,
    hasCombinedConditioning: false,
    attachedConditioningKind: undefined,
    coachAddedConditioningLabel: undefined,
    section18ConditioningRole: 'none',
    section18Evidence: {
      protocolVersion: 1,
      conditioningRole: 'none',
      conditioningStress: 'unknown',
      provenance: 'explicit_mutation',
    },
    derivedSessionProvenance: workout.derivedSessionProvenance?.filter((record) =>
      record.scope !== 'conditioning_component' && record.targetMetric !== 'conditioning_core'),
  });
  return hasMeaningfulWorkoutContent(stripped) ? stripped : null;
}

function hasMainStrengthRow(workout: Workout): boolean {
  return (workout.exercises ?? []).some((row) =>
    row.section18Evidence?.role === 'main_strength');
}

/**
 * PRESENT EXACTLY THE OFFERS THE WEEK'S CONTRACT DECLARES — the repair half of
 * the shared rule, and RULING 2'S OWNER.
 *
 * Called on an accepted-week candidate before it is judged, so every path that
 * reaches the gateway (generation, rebuild, rollover, deletion repair, coach
 * edit, rehydration) presents the offer its contract declares without any of
 * them knowing what a flush is. Sam ruled it repairable and ADVISORY on
 * 2026-08-06: this restores the offer, and a week that cannot hold one is never
 * refused for it.
 *
 * IT IS SYMMETRIC (R5.3, 2026-08-06 — ruling 2 re-homed). It used to be
 * additive only, on the reasoning that "a repair that could also take one away
 * would be a second opinion about the same field". That reasoning held while
 * `fixtureMinimalReplan:294` owned the taking-away — and ruling 2 (Sam,
 * 2026-08-06, "2a": a flush does NOT survive a fixture change) was implemented
 * THERE, inside the layer the R5.3 switchover stops publishing. With that layer
 * no longer reaching the athlete's week, nothing dropped the offer and the
 * planner's offer laundered across a fixture decision.
 *
 * So it re-homes here, as one statement rather than two: the week presents
 * EXACTLY what its contract declares — placing a shortfall, withdrawing a
 * surplus. That is not a second opinion, it is the single opinion; the removed
 * half was never a different rule, only the same rule read backwards.
 *
 * The demote path in the allocator still owns turning existing CORE
 * conditioning into an offer. This owns how many offers the week carries.
 *
 * Withdrawal walks the week in REVERSE training order so that when a week must
 * shed more than one offer it sheds the latest first, leaving the earliest — the
 * same "earlier in training order takes precedence" the core-slot derivation
 * uses, so the two cannot disagree about which session survives.
 */
export function presentDeclaredOffer(args: {
  workouts: readonly Workout[];
  contract: WeeklyExposureContractV2;
  weekStart: string;
  profile?: OnboardingData | null;
  microcycleId: string;
  weekKind: Microcycle['weekKind'];
}): { workouts: Workout[]; placedDays: number[]; withdrawnDays: number[] } {
  const workouts = [...args.workouts];
  const declared = declaredOfferCount(args.contract.conditioning);
  const present = workouts.filter(carriesOffer).length;
  const shortfall = declared - present;
  if (shortfall < 0) {
    let surplus = present - declared;
    const withdrawnDays: number[] = [];
    const dropped = new Set<number>();
    for (let index = workouts.length - 1; index >= 0 && surplus > 0; index--) {
      const target = workouts[index];
      if (!carriesOffer(target)) continue;
      const stripped = stripOffer(target);
      // A day whose ONLY content was the offer stops being a session at all.
      // `stripOffer` returns null there and the day is DROPPED, so it derives
      // as a typed rest day rather than surviving as an empty shell — the same
      // answer `stripConditioningComponent` gives on the replan path.
      if (stripped) workouts[index] = stripped;
      else dropped.add(index);
      withdrawnDays.push(target.dayOfWeek);
      surplus--;
    }
    return {
      workouts: workouts.filter((_, index) => !dropped.has(index)),
      placedDays: [],
      withdrawnDays,
    };
  }
  if (shortfall <= 0) return { workouts, placedDays: [], withdrawnDays: [] };

  const fixtureDay = args.contract.anchors
    .find((anchor) => anchor.kind === 'game' || anchor.kind === 'practice_match')
    ?.dayOfWeek ?? null;
  // A day already carrying core conditioning is not a candidate — the offer is
  // what the week adds BEYOND what its contract asks for, never a second
  // helping on a day already doing the asking.
  const coreDays = new Set(args.contract.anchors.map((anchor) => anchor.dayOfWeek));
  const offerDays = selectOfferDays({
    candidates: workouts.map((workout) => ({
      dayOfWeek: workout.dayOfWeek,
      isTeamDay: workout.workoutType === 'Team Training' || coreDays.has(workout.dayOfWeek),
      hasConditioning: hasConditioningContent(workout),
      hasStrength: hasMainStrengthRow(workout),
      hasSpeed: !!workout.speedBlock,
      isSelectedCore: false,
    })),
    count: shortfall,
    fixtureDay,
  });

  const placedDays: number[] = [];
  for (const dayOfWeek of offerDays) {
    const index = workouts.findIndex((workout) => workout.dayOfWeek === dayOfWeek);
    if (index < 0) continue;
    const offer = buildOfferSession({
      dayOfWeek,
      weekStart: args.weekStart,
      profile: args.profile,
      microcycleId: args.microcycleId,
      weekKind: args.weekKind,
      contract: args.contract,
    });
    if (!offer) continue;
    workouts[index] = attachOffer(workouts[index], offer);
    placedDays.push(dayOfWeek);
  }
  return { workouts, placedDays, withdrawnDays: [] };
}

const OFFER_DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/**
 * The offer's CONTENT, built by the same owner generation uses.
 *
 * `buildWorkoutsFromCoach` composes it from the signed pools, so the athlete
 * sees the same authored flush whether the week was generated or repaired —
 * no words are invented here, and none may be.
 */
function buildOfferSession(args: {
  dayOfWeek: number;
  weekStart: string;
  profile?: OnboardingData | null;
  microcycleId: string;
  weekKind: Microcycle['weekKind'];
  contract: WeeklyExposureContractV2;
}): Workout | null {
  const dayName = OFFER_DAY_NAMES[args.dayOfWeek];
  const [built] = buildWorkoutsFromCoach(
    [],
    args.microcycleId,
    [{
      tier: 'optional',
      focus: 'Aerobic flush — optional off-leg conditioning',
      dayOfWeek: dayName,
      isHardExposure: false,
      conditioningFlavour: 'aerobic',
      conditioningCategory: 'aerobic_base',
      section18ConditioningRole: 'optional_flush',
      conditioningVariant: 'reduced',
      conditioningOffFeet: true,
      stressLevel: 'low',
      planEntryId: `offer:${args.weekStart}:${dayName.toLowerCase()}:flush`,
    }] as never,
    args.profile ?? undefined,
    {
      miniCycleNumber: args.contract.identity.blockNumber ?? 1,
      weekInBlock: args.contract.identity.weekInBlock ?? 1,
      weekStartISO: args.weekStart,
      weekKind: args.weekKind,
      intensityMultiplier: args.weekKind === 'deload' ? 0.9 : 1,
    } as never,
  );
  return built ?? null;
}

/**
 * Stack the offer onto the day, keeping everything already there.
 *
 * The conditioning the day GAINS is named rather than inlined, so
 * `composedOptionalMarker` can read the very fields this merge is about to
 * write — the same convention the three other stack sites follow, and the
 * reason a Gunshow that absorbs a conditioning part stops claiming to be one
 * composed Gunshow.
 */
function attachOffer(target: Workout, offer: Workout): Workout {
  // ONLY THE CONDITIONING WORK TRAVELS.
  //
  // The offer is built as a standalone session so its content comes from the
  // same signed pools generation uses — and a standalone session correctly
  // carries its own warm-up. Stacked onto a day that already warms up, that
  // warm-up is a second one. Measured rather than guessed: the restored Monday
  // came back `Back Squat, Deadlift, Pallof Press, Warm-up, Short Flush` where
  // generation's component placement produces `Back Squat, Deadlift, Pallof
  // Press, Short Flush`. One extra row changes the day's visible signature,
  // which is exactly what decides whether the athlete is told their Monday was
  // rebalanced — so a repair that restored the offer would have disclosed a
  // change it did not really make.
  //
  // The discriminator is the row's TYPED ROLE, not its name and not the block's
  // membership: the block links its warm-up too, and that row is typed
  // `strength_accessory` because it is support the standalone session added for
  // itself. Only rows typed `conditioning` are the offer.
  const rows = (offer.exercises ?? [])
    .filter((row) => row.section18Evidence?.role === 'conditioning')
    .map((row, index) => ({
      ...row,
      workoutId: target.id,
      exerciseOrder: (target.exercises?.length ?? 0) + index + 1,
    }));
  // The block may only name rows that actually landed.
  const survivingIds = new Set(rows.map((row) => row.id));
  const conditioningBlock = offer.conditioningBlock
    ? {
        ...offer.conditioningBlock,
        options: offer.conditioningBlock.options.map((option) => ({
          ...option,
          exerciseIds: option.exerciseIds.filter((id) => survivingIds.has(id)),
        })),
      }
    : undefined;
  const conditioningGain: Partial<Workout> = {
    hasCombinedConditioning: true,
    attachedConditioningKind: 'component',
    conditioningFlavour: offer.conditioningFlavour,
    conditioningCategory: offer.conditioningCategory,
    conditioningFeasibility: offer.conditioningFeasibility,
    conditioningBlock,
    section18ConditioningRole: 'optional_flush',
    section18Evidence: offer.section18Evidence,
  };
  return {
    ...target,
    workoutType: target.workoutType === 'Team Training' ? target.workoutType : 'Mixed',
    durationMinutes: target.durationMinutes + offer.durationMinutes,
    exercises: [...(target.exercises ?? []), ...rows],
    ...conditioningGain,
    ...composedOptionalClearingPatch(conditioningGain),
  };
}
