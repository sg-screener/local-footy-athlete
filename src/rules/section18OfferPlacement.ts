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

import type {
  DerivedSessionProvenance,
  Microcycle,
  OnboardingData,
  Workout,
} from '../types/domain';
import { buildWorkoutsFromCoach } from '../data/defaultProgram';
import { composedOptionalClearingPatch } from '../utils/composedOptionalMarker';
import { canonicalConditioningLabel } from '../utils/sessionNaming';
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

/**
 * THE PROVENANCE LAW APPLIED TO WITHDRAWAL (seat ruling, 2026-08-07).
 * An offer IS an offer because this rule PLACED it as one — the stamp below
 * is that typed provenance, in the placer's own trigger namespace. A session
 * whose shape merely LOOKS like an offer (the athlete's added light
 * conditioning derived `optional_flush` by shape and was withdrawn as
 * surplus — the destroy-class on a decision) never carries it, so the
 * withdrawal structurally cannot reach it.
 */
const OFFER_TRIGGER_PREFIX = 'section18-offer:';

function carriesOfferProvenance(workout: Workout): boolean {
  return (workout.derivedSessionProvenance ?? []).some((record) =>
    record.triggerSignature.startsWith(OFFER_TRIGGER_PREFIX));
}

function offerProvenanceRecord(weekStart: string): DerivedSessionProvenance {
  const date = weekStart.slice(0, 10);
  return {
    protocolVersion: 2,
    authorship: 'system',
    origin: 'optional_planner_addition',
    scope: 'conditioning_component',
    triggerSignature: `${OFFER_TRIGGER_PREFIX}${date}`,
    targetMetric: 'optional_non_core',
    credit: { metric: 'optional_non_core', amount: 1, conditioningRole: 'optional_flush' },
    originatingFixtureDate: null,
    originatingDate: date,
    validWhile: [],
    invalidWhen: [],
    history: [{ action: 'created', date }],
    sourcePlanEntryId: null,
  };
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
      if (!carriesOfferProvenance(target)) continue;
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
    const attached = attachOffer(workouts[index], offer);
    // THE PLACER STAMPS WHAT IT PLACES — that stamp is what makes the
    // withdrawal above reachable, and only for what this rule placed.
    workouts[index] = {
      ...attached,
      derivedSessionProvenance: [
        ...(attached.derivedSessionProvenance ?? []),
        offerProvenanceRecord(args.weekStart),
      ],
    };
    placedDays.push(dayOfWeek);
  }
  return { workouts, placedDays, withdrawnDays: [] };
}

/**
 * PRESENT THE CORE CONDITIONING THE CONTRACT REQUIRES — the same rule as the
 * offer above, one line up the same contract.
 *
 * WHY THIS EXISTS (R5.3, 2026-08-06 —
 * `docs/R53_RESIDUAL_ATTRIBUTION_2026-08-06.md`). Required core conditioning was
 * in exactly the state the OFFER was in before this module was written: placed
 * only by generation's allocator, with no owner any repair path could reach.
 * Measured through the fixture door — remove a Saturday game and the week
 * becomes a bye-build week declaring three core conditioning exposures while
 * delivering two, because the game had been paying one. §18 named the shortfall
 * precisely (`required_minimum_shortfall`) and could do nothing about it.
 *
 * ⚠ THAT PARAGRAPH USED TO NAME A REPAIR ENGINE. It described how
 * `repairByStackingCandidates` only relocated existing work and
 * `repairOptionalRestCandidates` only rested days, so the search returned
 * `impossible`. Those generators and that search were deleted on 2026-08-19 —
 * §18 validates and refuses, it does not author — so the sentence is kept in
 * its corrected form rather than deleted: the SHORTFALL it describes is real
 * and is still this file's reason to exist.
 *
 * Nothing was inventing content, which is why the week simply came back short.
 *
 * THE CONTENT IS NOT CHOSEN HERE, and that is the point. The session's stress
 * comes from the contract's own `requiredCoreStress`, and its rows come from
 * `buildWorkoutsFromCoach` — the same signed pools generation uses, through the
 * same `demandCategoryFor`/`selectConditioningTemplate` owners. No words are
 * invented in this module and none may be.
 *
 * WHICH DAY comes from `selectOfferDays`, unchanged: a club night is never the
 * app's to add work to, a day already carrying conditioning never takes a second
 * helping, and fixture protection is respected. Sharing that selector is what
 * stops the core placer and the offer placer disagreeing about where work
 * belongs.
 */
export function presentRequiredCoreConditioning(args: {
  workouts: readonly Workout[];
  contract: WeeklyExposureContractV2;
  shortfall: number;
  weekStart: string;
  profile?: OnboardingData | null;
  microcycleId: string;
  weekKind: Microcycle['weekKind'];
}): { workouts: Workout[]; placedDays: number[] } {
  const workouts = [...args.workouts];
  if (args.shortfall <= 0) return { workouts, placedDays: [] };

  const fixtureDay = args.contract.anchors
    .find((anchor) => anchor.kind === 'game' || anchor.kind === 'practice_match')
    ?.dayOfWeek ?? null;
  const anchorDays = new Set(args.contract.anchors.map((anchor) => anchor.dayOfWeek));
  const candidateDays = selectOfferDays({
    candidates: workouts.map((workout) => ({
      dayOfWeek: workout.dayOfWeek,
      isTeamDay: workout.workoutType === 'Team Training' || anchorDays.has(workout.dayOfWeek),
      hasConditioning: hasConditioningContent(workout),
      hasStrength: hasMainStrengthRow(workout),
      hasSpeed: !!workout.speedBlock,
      isSelectedCore: false,
    })),
    count: args.shortfall,
    fixtureDay,
  });
  // AN EMPTY DAY IS PREFERRED, and this is where required work parts company
  // with the offer.
  //
  // `selectOfferDays` can only choose among days that already carry a session,
  // because the OFFER stacks — Bible `:81` authors the flush ON the strength
  // days, and an easy aerobic flush beside a lift is a small addition. A
  // REQUIRED core exposure is not: in a bye-build week it is a hard glycolytic
  // session, and stacking that onto a strength day spends a day the athlete
  // could have trained on twice while making one day much harder.
  //
  // So the order inverts here. The week this repairs is short precisely because
  // a day emptied, and that day is where the work belongs — which is also what
  // the pre-V3 baseline built (freed Saturday, "Hard Conditioning",
  // required_core, glycolytic) and what `phaseStructureConformanceTests` cell 8
  // pins. A week with no free day has NO fallback any more: §18 used to stack
  // the work onto an occupied day and no longer may, so such a week refuses and
  // the scheduler owns finding it a day.
  const occupied = new Set(workouts.map((workout) => workout.dayOfWeek));
  const emptyDays: number[] = [];
  for (const dayOfWeek of [1, 2, 3, 4, 5, 6, 0]) {
    if (occupied.has(dayOfWeek) || anchorDays.has(dayOfWeek)) continue;
    if (!offerFixtureSafe({
      dayOfWeek,
      isTeamDay: false,
      hasConditioning: false,
      hasStrength: false,
      hasSpeed: false,
      isSelectedCore: false,
    }, fixtureDay)) continue;
    emptyDays.push(dayOfWeek);
  }
  const targetDays = [...emptyDays, ...candidateDays].slice(0, args.shortfall);

  const placedDays: number[] = [];
  for (const dayOfWeek of targetDays) {
    const session = buildCoreConditioningSession({
      dayOfWeek,
      weekStart: args.weekStart,
      profile: args.profile,
      microcycleId: args.microcycleId,
      weekKind: args.weekKind,
      contract: args.contract,
    });
    if (!session) continue;
    const index = workouts.findIndex((workout) => workout.dayOfWeek === dayOfWeek);
    if (index < 0) workouts.push(session);
    else workouts[index] = attachCore(workouts[index], session);
    placedDays.push(dayOfWeek);
  }
  return { workouts, placedDays };
}

/**
 * The required session's CONTENT, from the same owner generation uses.
 *
 * `requiredCoreStress` is the contract's authored answer for how hard this
 * week's core conditioning must be; the category follows it rather than being
 * chosen here. `buildWorkoutsFromCoach` then composes the rows from the signed
 * pools, so the athlete sees the same authored session whether the week was
 * generated or repaired.
 */
function buildCoreConditioningSession(args: {
  dayOfWeek: number;
  weekStart: string;
  profile?: OnboardingData | null;
  microcycleId: string;
  weekKind: Microcycle['weekKind'];
  contract: WeeklyExposureContractV2;
}): Workout | null {
  const dayName = OFFER_DAY_NAMES[args.dayOfWeek];
  // The contract's authored stress decides the demand. `hard` is the in-season
  // bye-build answer and maps to the glycolytic pool; anything softer takes the
  // aerobic pool. The choice is the CONTRACT's, read here, never made here.
  const stress = args.contract.conditioning.requiredCoreStress;
  const wantsHard = stress.includes('hard');
  const [built] = buildWorkoutsFromCoach(
    [],
    args.microcycleId,
    [{
      tier: 'core',
      focus: wantsHard
        ? 'Hard conditioning — required core exposure'
        : 'Aerobic conditioning — required core exposure',
      dayOfWeek: dayName,
      isHardExposure: wantsHard,
      conditioningFlavour: wantsHard ? 'glycolytic' : 'aerobic',
      // `glycolytic` and `aerobic_base` are the AUTHORED category names
      // (`rules/conditioningSelection.AthleteConditioningCategory`), read from
      // that union rather than spelled here — an unknown category silently
      // empties `poolForCategory` and the selector throws on it.
      conditioningCategory: wantsHard ? 'glycolytic' : 'aerobic_base',
      section18ConditioningRole: 'required_core',
      conditioningVariant: 'full',
      // `'medium'`, NOT `'moderate'` — seat item 4, 2026-08-12.
      //
      // This line said `'moderate'` for as long as it has existed. The union is
      // `'high' | 'medium' | 'low'` (`weeklyExposureContract.ts:149`) and the
      // array is cast `as never` two lines below, so the compiler never saw it.
      // **The §18 ledger counts a moderate day by `stressLevel === 'medium'`**,
      // so every offer this placer marked as the easier option was invisible to
      // the count — which is why `achievedModerateDayCount` reads 0 on every
      // in-season fixture week, and why the half of Sam's shape that says "plus
      // one moderate/easy day" could never be satisfied by the app's own offer.
      stressLevel: wantsHard ? 'high' : 'medium',
      planEntryId: `core:${args.weekStart}:${dayName.toLowerCase()}:conditioning`,
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
  if (!built) return null;
  // THE TYPE NAMES ITSELF (ruled 2026-08-06,
  // `docs/CORE_PLACER_NAMING_AND_SCOPE_RULING_2026-08-06.md` §1). The pools hand
  // back a session named after the structure family they drew from — "Hard
  // Intervals", a `CONDITIONING_VISIBLE_LABELS` entry — which is the session's
  // CONTENT. Its IDENTITY is the typed exposure the contract required, and the
  // charter's type-names-itself rule (L-P6, the law the deep walker already
  // enforces for Gunshow) says a typed session renders its charter name.
  //
  // The name is not spelled here. `canonicalConditioningLabel` is the one
  // producer, shared with the canonicaliser's typed fallback, so a repaired
  // session and a generated one can never disagree about what the athlete is
  // looking at — and so the words survive the deletion of any one composer.
  return {
    ...built,
    name: canonicalConditioningLabel(wantsHard ? 'high-intensity' : 'aerobic'),
  };
}

/** Stack required conditioning onto a day, keeping everything already there. */
function attachCore(target: Workout, session: Workout): Workout {
  // Same discriminator and same reasoning as `attachOffer` below: only rows
  // typed `conditioning` travel, so the standalone session's own warm-up does
  // not become a second warm-up on a day that already has one.
  const rows = (session.exercises ?? [])
    .filter((row) => row.section18Evidence?.role === 'conditioning')
    .map((row, index) => ({
      ...row,
      workoutId: target.id,
      exerciseOrder: (target.exercises?.length ?? 0) + index + 1,
    }));
  const survivingIds = new Set(rows.map((row) => row.id));
  const conditioningBlock = session.conditioningBlock
    ? {
        ...session.conditioningBlock,
        options: session.conditioningBlock.options.map((option) => ({
          ...option,
          exerciseIds: option.exerciseIds.filter((id) => survivingIds.has(id)),
        })),
      }
    : undefined;
  const conditioningGain: Partial<Workout> = {
    hasCombinedConditioning: true,
    attachedConditioningKind: 'component',
    conditioningFlavour: session.conditioningFlavour,
    conditioningCategory: session.conditioningCategory,
    conditioningFeasibility: session.conditioningFeasibility,
    conditioningBlock,
    section18ConditioningRole: 'required_core',
    section18Evidence: session.section18Evidence,
  };
  return {
    ...target,
    workoutType: target.workoutType === 'Team Training' ? target.workoutType : 'Mixed',
    durationMinutes: target.durationMinutes + session.durationMinutes,
    exercises: [...(target.exercises ?? []), ...rows],
    ...conditioningGain,
    ...composedOptionalClearingPatch(conditioningGain),
  };
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
