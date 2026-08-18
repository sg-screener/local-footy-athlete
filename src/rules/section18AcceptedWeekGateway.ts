import type {
  Microcycle,
  OnboardingData,
  TrainingProgram,
  UserRemovalConstraint,
  Workout,
} from '../types/domain';
import { composedOptionalClearingPatch } from '../utils/composedOptionalMarker';
import { resolveEquipmentCapabilities } from '../utils/equipmentAvailability';
import {
  DEFAULT_ATHLETE_CONTEXT,
  type AthleteContext,
} from '../utils/sessionBuilder';
import {
  resolveWeekWithConditioning,
  type ScheduleState,
} from '../utils/sessionResolver';
import {
  evaluateSection18EffectiveWeek,
  type Section18EffectiveWeekEvaluation,
  type Section18Finding,
} from './section18EffectiveWeekEvaluator';
import { finaliseSection18SafetyWeek } from './section18SafetyFinaliser';
import { resolverMayDisplace } from './athletePlacement';
import {
  assessWeekCraft,
  craftBlockingSummary,
  type WeekCraftAssessment,
} from './section18CraftTier';
import {
  presentDeclaredOffer,
  presentRequiredCoreConditioning,
} from './section18OfferPlacement';
import { applyGenerationSafetyToSection18Contract } from './section18SafetyPolicy';
import {
  contractOffseasonSubphase,
  type Section18AuthorisedReduction,
  type WeeklyExposureContractV2,
} from './weeklyExposureContractV2';
import {
  canonicalContextSubphase,
  finaliseWorkoutAfterMutation,
} from '../utils/workoutCanonicalisation';
// NO `hasPowerRow` HERE, deliberately (ruling 4a, 2026-08-06). Every question
// this module asks about power is a WEEKLY BUDGET question — what competes for
// it, what is stripped for exceeding it, what is counted against it, what the
// repair detail reports. `hasPowerRow` answers a different question ("is there
// a power row at all"), and each of the four sites that used it here was a
// separate copy of the budget rule that did not know about the G-2 exemption.
// Not importing it is what keeps the copy from growing back.
import {
  budgetedPowerSession,
  powerRows,
  withoutPowerRows,
} from './sessionRowCounting';
import { stripConditioningComponent } from './strengthRelocationTemplate';
import { resolveProfileTargetWeekAvailability } from './fixtureConditionedAvailability';
import { ownSeasonPhaseForGeneration } from './seasonPhaseOwner';
import {
  buildDerivedSessionExpiryCandidates,
  createDerivedSessionProvenance,
  rebindDerivedSessionProvenance,
} from './derivedSessionProvenance';
import type { CalendarDayType } from '../store/calendarStore';
import type { AcceptedStateOperationKind } from '../store/acceptedStateTransaction';
import { applyUserRemovalConstraintsToWeek } from './userRemovalConstraints';
import type { AcceptedEffectiveWeekSurfaces } from './acceptedEffectiveWeek';
import { liveAcceptedEffectiveWeekSurfaces } from '../utils/liveEvaluationSurfaces';
import { strengthPatternLedger } from './strengthPatternContributions';
import {
  currentAthleteActionTrace,
  emitAthleteActionEvent,
  type AthleteActionTraceContext,
} from '../utils/athleteActionDiagnostics';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/**
 * THE UNIT'S OWN PROOF (`SURFACES_CONTEXT_RULING_2026-08-06.md` condition 1).
 *
 * The same instrument that refuted the previous mechanism is what signs this
 * one off, with the same taxonomy so the two runs are comparable line for
 * line: FORGOTTEN must fall to 0 (a required parameter cannot be omitted),
 * PROPOSAL must be preserved (a staged decision must still reach the gateway
 * intact), and agree/absent must not move.
 *
 * An INSTRUMENT, not a gate: prints only under `LFA_CONSTRAINT_ENTRY_PROBE=1`
 * and is inert otherwise. It names the site by its own call stack so the
 * census counts the DOORS rather than my reading of them, and it reports the
 * threaded value's ABSENCE separately from its emptiness — those are the two
 * things the original residual confused.
 */
function probeConstraintEntry(
  door: string,
  threaded: readonly UserRemovalConstraint[] | undefined,
): void {
  if (process.env.LFA_CONSTRAINT_ENTRY_PROBE !== '1') return;
  const canonical = liveAcceptedEffectiveWeekSurfaces().userRemovalConstraints;
  const frames = (new Error().stack ?? '').split('\n').slice(2, 12)
    .map((line) => line.trim())
    .filter((line) => /\/src\//.test(line) && !/section18AcceptedWeekGateway\.ts/.test(line))
    .map((line) => {
      const match = /\/src\/(.+?\.tsx?):(\d+):\d+/.exec(line);
      return match ? `${match[1]}:${match[2]}` : null;
    })
    .filter((line): line is string => line !== null);
  const stack = frames[0] ?? 'unknown';
  const key = (constraint: UserRemovalConstraint) =>
    `${constraint.status}:${constraint.targetDate}:${constraint.id}`;
  const threadedKeys = (threaded ?? []).map(key).sort().join(',');
  const canonicalKeys = canonical.map(key).sort().join(',');
  const canonicalIds = new Set(canonical.map((constraint) => constraint.id));
  const threadedIds = new Set((threaded ?? []).map((constraint) => constraint.id));
  process.stdout.write('[ENTRY] ' + JSON.stringify({
    door,
    site: stack,
    threaded: threaded === undefined ? 'ABSENT' : threaded.length,
    canonical: canonical.length,
    agree: threaded === undefined
      ? canonical.length === 0
      : threadedKeys === canonicalKeys,
    // WHICH SIDE HOLDS WHAT THE OTHER DOES NOT. A threaded-only constraint is
    // a decision the store has not been told about yet — a PROPOSAL under
    // evaluation, not a forgotten input.
    threadedOnly: [...threadedIds].filter((id) => !canonicalIds.has(id)).length,
    canonicalOnly: [...canonicalIds].filter((id) => !threadedIds.has(id)).length,
    statusDiff: threadedKeys !== canonicalKeys &&
      [...threadedIds].filter((id) => !canonicalIds.has(id)).length === 0 &&
      [...canonicalIds].filter((id) => !threadedIds.has(id)).length === 0,
    ...(process.env.LFA_CONSTRAINT_ENTRY_DETAIL === '1'
      ? { t: threadedKeys, c: canonicalKeys, stack: frames.slice(0, 6) }
      : {}),
  }) + '\n');
}

/**
 * §18 HAS TWO ANSWERS. IT USED TO HAVE FIVE.
 *
 * `repaired`, `regenerated` and `fallback` each named a week the VALIDATOR had
 * authored to make the answer come out yes — the repair search, a regenerated
 * candidate, a "safe" fallback. A boundary that can report `repaired` is a
 * boundary that can write, and this one may not (Sam, 2026-08-19: "It may not
 * return a modified week, candidate week, repaired week or replacement day").
 *
 * What is left is the only honest pair: the finished authored week is either
 * acceptable or it is refused, and a refusal is the scheduler's or composer's
 * problem to fix rather than the validator's to paper over.
 */
export type Section18WeekAcceptanceStatus =
  | 'accepted'
  | 'impossible';

/**
 * WHAT §18 MAY STILL SAY ABOUT A WEEK — and every one of these is a STATEMENT,
 * not a change it made.
 *
 * The authoring kinds are gone with the search that produced them:
 * `optional_work_removed_for_rest` (Rest substitution),
 * `core_work_stacked_on_existing_stress_day` and `craft_violation_relocated`
 * and `displaced_strength_relocated` (session movement),
 * `core_conditioning_presented` (conditioning injection),
 * `regenerated_candidate` and `safe_fallback_candidate` (candidate-week
 * authoring), `athlete_removal_typed_reduction`.
 *
 * ⚠ THE FOUR THAT REMAIN ARE NOT YET PURE, AND THAT IS RECORDED HONESTLY.
 * `weekly_power_budget`, `offer_presented`, `offer_withdrawn` and
 * `obsolete_derived_work_expired` are normalisation stages that still run
 * inside this boundary and still change the week. They are class B: the
 * capability belongs to the power specialist, the optional-session specialist
 * and the derived-provenance owner respectively, and each must be built and
 * guarded THERE before the stage is deleted here. Naming them in this union is
 * what stops them being forgotten.
 */
export type Section18WeekRepairKind =
  | 'weekly_power_budget'
  | 'offer_presented'
  | 'offer_withdrawn'
  | 'obsolete_derived_work_expired'
  /**
   * The athlete's own removal was PRESERVED and paid for with an authorised
   * contract reduction. Written by `fixtureMinimalReplan`, never by §18, and it
   * discloses that a DECISION survived — the opposite of the repair kinds, which
   * disclosed that the validator had overruled one.
   */
  | 'athlete_removal_typed_reduction'
  /**
   * The craft tier found a violation the week publishes with. A candidate may
   * fail; a fact may not be vetoed. This is the one kind that was ALWAYS a
   * disclosure and never a change.
   */
  | 'craft_violation_disclosed';

export interface Section18WeekRepair {
  kind: Section18WeekRepairKind;
  detail: string;
  sourceDay?: number;
  targetDay?: number;
}

export interface Section18AcceptedWeekCandidate {
  contract: WeeklyExposureContractV2;
  workouts: Workout[];
}

export interface Section18AcceptedWeekGatewayInput extends Section18AcceptedWeekCandidate {
  weekStart: string;
  profile?: OnboardingData | null;
  /** Exact fixture dates across the rolling dependency horizon. */
  activeFixtureDates?: ReadonlySet<string>;
  /**
   * THE WORLD THIS WEEK IS JUDGED AGAINST — required, never a bare array
   * (`docs/SURFACES_CONTEXT_RULING_2026-08-06.md`).
   *
   * It was `userRemovalConstraints?`, and optional is what made it
   * forgettable: six doors never passed it, so the repair search could not
   * tell that a DECISION explained a missing pattern and relocated anyway,
   * greening the week before the deletion class's own relocation — the one
   * recording the typed ownership that makes a restore reversible — ever ran.
   *
   * A required parameter cannot be forgotten, so the class dies structurally
   * rather than one instance at a time. And because the context is the world
   * rather than the store, a transaction staging a deletion or a move passes
   * the world it is composing: a decision in flight is a decision, and it is
   * the one this week must be judged against.
   */
  surfaces: AcceptedEffectiveWeekSurfaces;
  /** The caller may supply the exact live projection; generation uses the canonical resolver below. */
  resolveVisibleWorkouts?: (workouts: readonly Workout[]) => Workout[];
  /* ── FOUR INPUTS WERE DELETED HERE, AND EACH ONE WAS A LICENCE TO AUTHOR. ──
   * `strengthTemplates` fed relocation templates to the repair search;
   * `maxRepairAttempts` bounded that search; `regenerate` and `safeFallback`
   * handed the validator two more weeks to try when it disliked the first.
   * A validator does not need a way to build another week. */
  /** Development-only action correlation; never participates in acceptance. */
  trace?: AthleteActionTraceContext;
}

export interface Section18AcceptedWeekGatewayResult {
  status: Section18WeekAcceptanceStatus;
  contract: WeeklyExposureContractV2;
  canonicalWorkouts: Workout[];
  visibleWorkouts: Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  /**
   * The Section 17 craft verdict on the SELECTED week. `blocking` is empty on
   * every accepted result by construction; a non-empty one always arrives with
   * a `craft_violation_disclosed` repair beside it.
   */
  craft: WeekCraftAssessment;
  repairs: Section18WeekRepair[];
  attempts: number;
  failureSignature: string | null;
}

export class Section18WeekAcceptanceError extends Error {
  readonly code = 'section18_week_rejected' as const;
  readonly userMessage = 'We couldn’t safely build your week from your current settings. Please review your availability, readiness and injury information.';

  constructor(public readonly result: Section18AcceptedWeekGatewayResult) {
    super(`Section 18 final-week rejection (${result.failureSignature ?? 'unknown'})`);
    this.name = 'Section18WeekAcceptanceError';
  }
}

function cloneContract(contract: WeeklyExposureContractV2): WeeklyExposureContractV2 {
  return JSON.parse(JSON.stringify(contract)) as WeeklyExposureContractV2;
}

function dateForDay(weekStart: string, dayOfWeek: number): string {
  const date = new Date(`${weekStart.slice(0, 10)}T12:00:00`);
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function programPhaseFor(contract: WeeklyExposureContractV2): TrainingProgram['programPhase'] {
  if (contract.identity.seasonPhase === 'In-season') return 'In-Season';
  if (contract.identity.seasonPhase === 'Pre-season') return 'Pre-Season-Skills';
  return 'Base-Building';
}

function athleteContext(profile: OnboardingData | null | undefined): AthleteContext {
  if (!profile) return DEFAULT_ATHLETE_CONTEXT;
  const equipment = resolveEquipmentCapabilities(profile);
  return {
    injuries: profile.injuries ?? [],
    equipmentTags: equipment.tags,
    onboardingData: profile,
  };
}

/**
 * The week's calendar marks WITH its contract fixture folded in.
 *
 * A game or practice match lives in the contract's anchors, not in
 * `markedDays` — so anything that asks `markedDays` alone "is there a game this
 * week?" is blind to a practice-match week. That blindness is exactly what let
 * the G-1 ask miss the case this whole unit exists for.
 *
 * Extracted so the gateway and the G-1 ask-flow read ONE answer. An explicit
 * athlete mark on the fixture day still wins — the anchor only fills a gap.
 */
export function fixtureAwareMarkedDaysForWeek(args: {
  contract: WeeklyExposureContractV2;
  weekStart: string;
  profile?: OnboardingData | null;
  markedDays?: Readonly<Record<string, CalendarDayType>>;
}): Record<string, CalendarDayType> {
  const weekStart = args.weekStart.slice(0, 10);
  const markedDays: Record<string, CalendarDayType> = { ...(args.markedDays ?? {}) };
  const fixture = args.contract.anchors.find((anchor) =>
    anchor.kind === 'game' || anchor.kind === 'practice_match');
  if (fixture) {
    const fixtureDate = dateForDay(weekStart, fixture.dayOfWeek);
    if (!Object.prototype.hasOwnProperty.call(markedDays, fixtureDate)) {
      markedDays[fixtureDate] = 'game';
    }
  }
  if (!fixture && args.contract.identity.mode.startsWith('in_season_bye')) {
    const profileGameDay = args.profile?.usualGameDay ?? args.profile?.gameDay;
    const gameDayIndex = profileGameDay
      ? DAY_NAMES.indexOf(profileGameDay as typeof DAY_NAMES[number])
      : -1;
    if (gameDayIndex >= 0) markedDays[dateForDay(weekStart, gameDayIndex)] = 'noGame';
  }
  return markedDays;
}

/**
 * Resolve exactly what the athlete will see, including fixture replacement,
 * G+1 recovery, G-1 protection, conditioning fill and recovery fill.
 */
export function resolveFinalVisibleSection18Week(args: {
  contract: WeeklyExposureContractV2;
  workouts: readonly Workout[];
  weekStart: string;
  profile?: OnboardingData | null;
  scheduleState?: Partial<ScheduleState>;
  /** The world this projection is resolved against — required, as above. */
  surfaces: AcceptedEffectiveWeekSurfaces;
}): Workout[] {
  probeConstraintEntry('visible_resolver', args.surfaces.userRemovalConstraints);
  const weekStart = args.weekStart.slice(0, 10);
  const weekEnd = dateForDay(weekStart, 0);
  const constrainedWorkouts = applyUserRemovalConstraintsToWeek({
    workouts: args.workouts,
    weekStart,
    constraints: args.surfaces.userRemovalConstraints,
  });
  const microcycle: Microcycle = {
    id: `section18-visible:${weekStart}`,
    programId: `section18-visible-program:${weekStart}`,
    weekNumber: args.contract.identity.globalWeek ?? 1,
    startDate: `${weekStart}T12:00:00.000Z`,
    endDate: `${weekEnd}T12:00:00.000Z`,
    miniCycleNumber: args.contract.identity.blockNumber ?? 1,
    intensityMultiplier: args.contract.identity.weekKind === 'deload' ? 0.9 : 1,
    weekKind: args.contract.identity.weekKind,
    exposureContractV2: args.contract,
    workouts: constrainedWorkouts,
    createdAt: `${weekStart}T00:00:00.000Z`,
    updatedAt: `${weekStart}T00:00:00.000Z`,
  };
  const program: TrainingProgram = {
    id: microcycle.programId,
    userId: 'section18-gateway',
    name: 'Section 18 accepted-week candidate',
    description: '',
    programPhase: programPhaseFor(args.contract),
    startDate: microcycle.startDate,
    endDate: microcycle.endDate,
    microcycles: [microcycle],
    primaryFocus: 'Section 18 conformance',
    isActive: true,
    createdAt: microcycle.createdAt,
    updatedAt: microcycle.updatedAt,
  };
  const markedDays = fixtureAwareMarkedDaysForWeek({
    contract: args.contract,
    weekStart,
    profile: args.profile,
    markedDays: args.scheduleState?.markedDays,
  });
  const targetWeekAvailability = args.profile
    ? resolveProfileTargetWeekAvailability({
        profile: args.profile,
        weekStart,
        markedDays,
        // The candidate week under validation was built from this profile;
        // validating it against the persisted clock would judge a rebuild by
        // the phase it is replacing.
        ownedPhase: ownSeasonPhaseForGeneration(args.profile),
      })
    : null;
  const profileAvailableDays = targetWeekAvailability?.effectiveAvailableDayNumbers ?? [];
  const canonicalAvailableDays = Array.from(new Set(
    constrainedWorkouts.map((workout) => workout.dayOfWeek),
  ));

  const state: ScheduleState = {
    // THE THREE BLANKS, and why they are correct rather than a divergence to
    // retire (`rules/dayPrecedence.ts` carries the full reasoning).
    //
    // By the time this runs, all three surfaces have ALREADY been folded into
    // `constrainedWorkouts` above: overrides and overlays by
    // `rebaseAcceptedEffectiveWeek`'s compose loop, removals by
    // `applyUserRemovalConstraintsToWeek`. Re-feeding them would apply each
    // twice — and for removals that is not merely redundant, it would re-remove
    // the `remainingWorkout` remainder a bin left behind.
    //
    // The map that preceded the unification read the two override blanks as the
    // "genuine unknown" that might force a larger unit, because blanking loses
    // the `owner` distinction. It does not need to survive: under THE ordering
    // an emptying decision outranks composed content whoever composed it, so
    // there is nothing here for ownership to change. `userRemovalConstraints`
    // is blanked explicitly from 2026-08-04 — the resolver gained the field in
    // the same unit, and `...args.scheduleState` below could otherwise
    // reintroduce it silently.
    manualOverrides: {},
    weekScopedOverlays: {},
    userRemovalConstraints: [],
    athleteContext: athleteContext(args.profile),
    seasonPhase: args.contract.identity.seasonPhase,
    usualGameDay: args.profile?.usualGameDay,
    gameDay: args.profile?.gameDay,
    capacity: args.contract.safety.reasons.includes('low_readiness') ? 'low' : 'medium',
    // The resolver's historical empty-array convention means "all days".
    // At the commit boundary, a missing profile instead falls back to the
    // candidate's allocated days; a truly empty/full-pause candidate uses a
    // sentinel that permits no optional fill.
    availableDayNumbers: profileAvailableDays.length > 0
      ? profileAvailableDays
      : canonicalAvailableDays.length > 0
        ? canonicalAvailableDays
        : [-1],
    ...args.scheduleState,
    currentProgram: program,
    currentMicrocycle: microcycle,
    markedDays,
    // THE RECORD SURVIVES THE BLANKING
    // (`docs/REMOVAL_RECORD_SPLIT_RULING_2026-08-06.md`).
    //
    // `userRemovalConstraints` above is blanked because it has been APPLIED.
    // This is the other question, and it is not consumed by anything: the
    // derivation below runs §18 as tier 4, and its repair search must be able
    // to ask whether a DECISION explains a missing pattern so it can stand
    // down for the deletion class's own relocation. Measured before the split:
    // 1,045 of 1,045 search entries reached that question with nothing to
    // answer it. Set BELOW the spread, like the three lines above it, because
    // it is owned by the surfaces and no caller may substitute its own.
    removalDecisions: args.surfaces.removalDecisions,
  };
  return resolveWeekWithConditioning(weekStart, state)
    .flatMap((day) => day.workout ? [day.workout] : []);
}

/* ── THE WEEKLY POWER BUDGET MOVED OUT (2026-08-19, seat `demolition`) ────────
 * `powerReductionReason`, `withPowerReduction` and `weeklyPowerBudget` — 160
 * lines — now live in `rules/weeklyPowerBudget.ts`, the power specialist.
 * §18 still CALLS it, which is why §18 is not yet validation-only; the call is
 * cut when the authoring side applies the budget itself. The code moved first
 * so the move and the ownership change are separate, reviewable commits and a
 * behaviour change cannot hide inside a relocation. */


function workoutHasMainStrength(workout: Workout): boolean {
  return workout.exercises.some((row) => row.section18Evidence?.role === 'main_strength') ||
    !!workout.strengthIntent?.effectivePatterns.length;
}

function workoutHasAppCoreConditioning(workout: Workout): boolean {
  const role = workout.section18Evidence?.conditioningRole;
  return role === 'core' || role === 'required_core' || role === 'planner_selected_core';
}





/**
 * RELOCATE THE SESSION THE CRAFT TIER NAMED.
 *
 * Without this the craft tier would only ever DISCLOSE — a second opinion
 * nobody reads, wearing a new hat. A finding names the day and the session, and
 * a Section 17 violation is almost always a session that is on the wrong DAY
 * rather than a session that should not exist: a hard lower two days before the
 * game is a fine session on Monday.
 *
 * So the repair is a MOVE, and it obeys THE :4688 ORDER the same way
 * `repairDisplacedStrengthCandidates` did — relocation before substitution
 * before reduction.
 *
 * TWO MOVES, AND THE SECOND IS THE ONE THAT MATTERS. Onto an empty day when the
 * week has one; otherwise a SWAP with another day's session. Measured on the
 * first week this was run against: a six-day in-season athlete has no empty
 * day, so a move-only generator produced zero candidates and every craft
 * violation fell through to disclosure. A swap creates and destroys nothing —
 * it is the smallest change that can answer "this session is on the wrong day"
 * on a full week.
 *
 * Anchor days (the game, the practice match, team training) are never a source
 * or a target: those days are the athlete's club commitments, not the app's to
 * move. Correctness is not this function's job either — every candidate it
 * proposes is re-assessed against the contract AND the craft tier before it can
 * win, so a move that trades one violation for another simply loses.
 *
 * AND IT ASKS `resolverMayDisplace` BEFORE IT TOUCHES ANYTHING, on both sides
 * of the move. This is a deriver that displaces content, so it answers the
 * app's ONE displacement predicate like every other deriver does — the first
 * version of it did not, and `resolverDisplacementSweepTests` plus four other
 * athlete-door suites reddened on the spot. A session the athlete put somewhere
 * is not a defect to be tidied away.
 */

function signature(evaluation: Section18EffectiveWeekEvaluation): string {
  return evaluation.blockingViolations
    .map((finding) => `${finding.code}:${finding.domain}:${JSON.stringify(finding.actual)}`)
    .sort()
    .join('|');
}

/**
 * THE RELOCATION THE PUBLISHER USED TO OWN — migrated, not copied
 * (`docs/DERIVER_ACQUIRES_REPAIR_SEARCH_RULING_2026-08-06.md`).
 *
 * When a fixture consumes the day carrying a required pattern — G-1 demotes
 * the Friday, and the Friday was the week's only HINGE — the week must
 * RE-PLAN or it is unlawful. `fixtureMinimalReplan`'s strength-shortfall path
 * was the only thing in the app that did it, and it lives on the PUBLISH side,
 * so a derivation could never produce the lawful week. The ruling moves the
 * capability here, where the week is made, and the publisher defers to it.
 *
 * The Bible's :4688 order was respected by POSITION in `localRepairCandidates`,
 * a repair expander deleted on 2026-08-19 with the rest of §18's authoring:
 * relocate first (this), then substitute/stack, then move optional work, and a
 * typed reduction only when nothing else answers.
 *
 * THE TEMPLATE SOURCE is the week's AUTHORED plan, which is exactly what the
 * publisher used (`targetMicrocycle.workouts`). A displaced session is gone
 * from the derived week by definition, so the week cannot supply its own
 * relocation template.
 */

/** The week's available days, read through the ONE availability owner. */

/** Does this workout carry a meaningful main lift? The ledger is the owner. */

/** RESOLVED AUTHORITY at the relocation (condition 3): what displaced the day. */


/**
 * A typed reduction for capacity a FACT took away, named by that fact.
 *
 * The week declares a planner-selected core-conditioning target it can no
 * longer reach because a fixture consumed one of its days and the displaced
 * lift had to occupy another. Relocation ran first and substitution after it;
 * this is what is left, and the Bible puts it last for exactly that reason.
 */


/**
 * THE SHORTFALL THE ENGINE COULD NOT ANSWER (R5.3, 2026-08-06 —
 * `docs/R53_RESIDUAL_ATTRIBUTION_2026-08-06.md`).
 *
 * Every other generator here MOVES work: stacking relocates an existing session,
 * the rest repair converts one to rest. So a week that is simply SHORT an
 * exposure produced zero candidates, the search evaluated one state and returned
 * `impossible`, and the athlete's week published a disclosed shortfall it could
 * have filled. Measured through the fixture door: removing a Saturday game makes
 * the week a bye-build declaring three core conditioning exposures and
 * delivering two, because the game had been paying one.
 *
 * The placement owner is `rules/section18OfferPlacement` — the same module that
 * already answers "which day does the week's conditioning belong on", so the
 * required session and the optional offer can never disagree about where work
 * goes or where its words come from.
 *
 * It is a CANDIDATE, not a normalisation, and that is deliberate: required core
 * conditioning is blocking, so the repaired week must be re-evaluated and may
 * still be rejected. The offer is advisory and is normalised instead.
 */

function resolveCandidate(args: {
  input: Section18AcceptedWeekGatewayInput;
  candidate: Section18AcceptedWeekCandidate;
}): Section18AcceptedWeekGatewayResult {
  // `inheritedRepairs` went with the cascade that fed it: there is no second
  // candidate to carry a first candidate's disclosures into.
  const initialRepairs: Section18WeekRepair[] = [];
  // ── THE ONE-OWNER GOVERNANCE BOUNDARY (fourteenth-pass ruling,
  // 2026-08-07). The contract's `governedFromISO` partitions the week
  // HERE, where the mutable day-set is assembled. Days before the boundary are
  // FACTS: they never enter the normaliser chain or the repair search, so a
  // downstream writer that never learned the law CANNOT over-reach — the
  // safety finaliser and the offer placer stop being trusted to know it.
  // Reassembly re-attaches the fact days byte-exact, which by construction
  // also refuses anything a writer tried to place on a fact day. Readers keep
  // the whole week: the visible resolver and the evaluator see facts (the
  // evaluator already counts them as delivered history).
  const governedBoundaryISO = (args.candidate.contract as { governedFromISO?: string | null })
    .governedFromISO ?? null;
  const isFactDay = (day: number): boolean =>
    governedBoundaryISO !== null &&
    dateForDay(args.input.weekStart, day) < governedBoundaryISO;
  // THE ONE OWNER'S ANSWER, HANDED OUT RATHER THAN RE-DERIVED. The craft tier
  // and its repair generator both need to know which days are still the app's
  // to change; neither may read `governedFromISO` to find out, because the
  // ruling above puts exactly one reader of that field in the app and it is
  // three lines up. `test:gateway-authority-census` holds this.
  const governableDates: ReadonlySet<string> = new Set(
    [0, 1, 2, 3, 4, 5, 6]
      .filter((day) => !isFactDay(day))
      .map((day) => dateForDay(args.input.weekStart, day)),
  );
  const factDayWorkouts: readonly Workout[] = governedBoundaryISO === null
    ? []
    : args.candidate.workouts.filter((workout) => isFactDay(workout.dayOfWeek));
  const governableCandidateWorkouts: readonly Workout[] =
    governedBoundaryISO === null
      ? args.candidate.workouts
      : args.candidate.workouts.filter((workout) => !isFactDay(workout.dayOfWeek));
  const assembleWithFactDays = (workouts: readonly Workout[]): Workout[] =>
    governedBoundaryISO === null
      ? [...workouts]
      : [
          ...factDayWorkouts,
          ...workouts.filter((workout) => !isFactDay(workout.dayOfWeek)),
        ];
  // A persisted athlete deletion is an accepted-state input, not a render
  // filter. Apply it before lifecycle, safety and repair so those owners can
  // never restore content onto the prohibited target and then lose it again
  // only at the final visible projection.
  const constrainedCandidateWorkouts = applyUserRemovalConstraintsToWeek({
    workouts: governableCandidateWorkouts,
    weekStart: args.input.weekStart,
    constraints: args.input.surfaces.userRemovalConstraints,
  });
  const preScoreExpiry = buildDerivedSessionExpiryCandidates({
    workouts: constrainedCandidateWorkouts,
    contract: args.candidate.contract,
    weekStart: args.input.weekStart,
    activeFixtureDates: args.input.activeFixtureDates,
  })[0];
  if (preScoreExpiry) {
    initialRepairs.push({
      kind: 'obsolete_derived_work_expired',
      detail: `Expired ${preScoreExpiry.expiries.length} obsolete system-derived session/component${preScoreExpiry.expiries.length === 1 ? '' : 's'} before preservation scoring: ${preScoreExpiry.expiries.map((expiry) => `${expiry.origin}/${expiry.scope}/${expiry.reason}/${expiry.planEntryId ?? expiry.workoutId}`).join(', ')}.`,
    });
  }
  const safety = finaliseSection18SafetyWeek({
    contract: args.candidate.contract,
    workouts: preScoreExpiry?.workouts ?? constrainedCandidateWorkouts,
    weekStart: args.input.weekStart,
    canonicalContext: {
      phase: args.candidate.contract.identity.seasonPhase,
      offseasonSubphase: canonicalContextSubphase(
        args.candidate.contract.identity.seasonPhase,
        contractOffseasonSubphase(args.candidate.contract),
      ),
      weekKind: args.candidate.contract.identity.weekKind,
      profile: args.input.profile ?? undefined,
    },
  });
  /* ── §18 NO LONGER TRIMS POWER (MOVE 1, 2026-08-19) ──────────────────────
   *
   * `weeklyPowerBudget` ran HERE and stripped power rows the week exceeded its
   * budget by. That made the validator the owner of a coaching dose, which
   * Sam's contract gives to the power specialist: *"Power belongs to authorised
   * strength work."*
   *
   * `generateProgramLocally` now applies the budget on the AUTHORING side,
   * immediately after the candidate is assembled and before this gateway is
   * called, so the week that arrives here already respects it. There is nothing
   * left to trim — and, more importantly, §18 no longer HAS the ability to trim,
   * which is the property `test:weekly-power-budget` holds.
   *
   * The `weekly_power_budget` disclosure went with it: §18 does not report a
   * reduction it did not make. */
  const power = { contract: safety.contract, workouts: safety.workouts };
  // THE WEEK PRESENTS THE OFFER ITS CONTRACT DECLARES (Sam's ruling, 2026-08-06
  // — `docs/1B_OFFER_SURVIVAL_RULINGS_2026-08-06.md`).
  //
  // Here rather than in the repair search below, and that placement is the whole
  // point. A missing offer is ADVISORY by the ruling — "doing it is the
  // athlete's choice" — so it never produces a blocking violation, and the
  // search only ever expands a candidate that has one. Restoring the offer is a
  // normalisation of the accepted week, exactly like the safety finaliser and
  // the power budget it stands beside, not a repair the week has to fail into.
  //
  // MEASURED: this gateway never destroys an offer (376 visible resolutions of
  // a week carrying one, none lost) — the candidates simply ARRIVE without it,
  // because the paths that build them do not run the placer. Every one of them
  // converges here, which is why one call fixes deletion, relocation, coach
  // edits and fixture moves at once without any of those paths learning what a
  // flush is.
  const offered = presentDeclaredOffer({
    workouts: power.workouts,
    contract: power.contract,
    weekStart: args.input.weekStart,
    profile: args.input.profile,
    microcycleId: `section18-offer:${args.input.weekStart}`,
    weekKind: power.contract.identity.weekKind,
  });
  if (offered.placedDays.length > 0) {
    initialRepairs.push({
      kind: 'offer_presented',
      detail: `Presented the week's ${offered.placedDays.length} declared optional flush offer${offered.placedDays.length === 1 ? '' : 's'} on ${offered.placedDays.map((day) => DAY_NAMES[day]).join(', ')}.`,
    });
  }
  // A WITHDRAWAL IS DISCLOSED LIKE A PLACEMENT, or ruling 2 removes the
  // athlete's visible session silently. Same repair channel, opposite
  // direction: the week carried more offers than its contract declares —
  // which is what a fixture change makes true — so the surplus came off.
  if (offered.withdrawnDays.length > 0) {
    initialRepairs.push({
      kind: 'offer_withdrawn',
      detail: `Withdrew ${offered.withdrawnDays.length} optional flush offer${offered.withdrawnDays.length === 1 ? '' : 's'} the week's contract no longer declares, on ${offered.withdrawnDays.map((day) => DAY_NAMES[day]).join(', ')}.`,
    });
  }
  const baseContract = power.contract;
  /* ══ ONE ASSESSMENT, ON THE WEEK AS AUTHORED ═══════════════════════════════
   *
   * **§18 VALIDATES AND REFUSES. IT DOES NOT AUTHOR.** (Sam, 2026-08-19.)
   *
   * What stood here was a breadth-first REPAIR SEARCH: it generated candidate
   * weeks, scored them and published whichever one passed. Five generators fed
   * it — Rest substitution, stacking work onto other days, relocating craft
   * violations, re-placing displaced strength, and injecting conditioning after
   * authorship. That made the validator the app's SECOND weekly programming
   * authority, sitting downstream of the scheduler and composer and quietly
   * overruling both.
   *
   * It also hid their defects. A week the scheduler sited badly was silently
   * restacked; a pattern the composer failed to cover was silently added. The
   * repair count was the only evidence, and nobody read it.
   *
   * So the search is gone and the week is judged EXACTLY AS IT ARRIVED. The
   * only outcomes are `accepted` and `impossible`. A week that used to be
   * repaired into legality now REFUSES, and the refusal names the owner that
   * has to build it properly — which is the point of removing the repair, not
   * a side effect of it.
   *
   * `attempts` is 1 by construction. It is kept in the result because callers
   * and the diagnostic log read it, and a boundary that once searched should be
   * able to say, truthfully, that it no longer does.
   */
  let contract = cloneContract(baseContract);
  const resolver = args.input.resolveVisibleWorkouts ?? ((candidateWorkouts: readonly Workout[]) =>
    resolveFinalVisibleSection18Week({
      contract,
      workouts: candidateWorkouts,
      weekStart: args.input.weekStart,
      profile: args.input.profile,
      surfaces: args.input.surfaces,
    }));
  // Readers see the assembled week (facts included); the assembly is re-applied
  // to the resolver's OUTPUT so the projection's fact days are byte-exact
  // candidate facts no matter what any stage inside did.
  const visibleWorkouts = assembleWithFactDays(
    resolver(assembleWithFactDays(offered.workouts)),
  );
  let evaluation = evaluateSection18EffectiveWeek({
    contract,
    workouts: visibleWorkouts,
    weekStart: args.input.weekStart,
  });
  contract = evaluation.contract;
  if (evaluation.blockingViolations.length === 0) {
    contract = applyGenerationSafetyToSection18Contract({ contract });
    evaluation = evaluateSection18EffectiveWeek({
      contract,
      workouts: visibleWorkouts,
      weekStart: args.input.weekStart,
    });
    contract = evaluation.contract;
  }
  // THE CRAFT TIER, ON THE SAME VISIBLE WEEK THE CONTRACT IS JUDGING. Two
  // questions, two owners, one boundary: the evaluator asks whether the week
  // CONFORMS, the craft tier asks whether it reads like a coach wrote it.
  const craft = assessWeekCraft({
    contract,
    workouts: visibleWorkouts,
    weekStart: args.input.weekStart,
    profile: args.input.profile,
    governableDates,
    activeFixtureDates: args.input.activeFixtureDates,
  });
  // A CRAFT VIOLATION MAY FAIL A CANDIDATE; IT MAY NEVER VETO A FACT.
  //
  // The contract itself is satisfied and what is left is a SHAPE. Refusing here
  // would stop a stored week built before this tier existed from hydrating, and
  // the app would refuse to open on its own history. So the week publishes and
  // the violation is DISCLOSED — the one thing §18 may still add to its result,
  // because it is an explanation and not a change.
  const craftOnlyShortfall =
    evaluation.blockingViolations.length === 0 && craft.blocking.length > 0;
  const accepted = evaluation.blockingViolations.length === 0;
  const repairs = craftOnlyShortfall
    ? [...initialRepairs, {
        kind: 'craft_violation_disclosed' as const,
        detail: `Published with unrepaired Section 17 craft violation${craft.blocking.length === 1 ? '' : 's'}: ${craftBlockingSummary(craft.blocking)}.`,
      }]
    : initialRepairs;
  return {
    status: accepted ? 'accepted' : 'impossible',
    contract,
    canonicalWorkouts: assembleWithFactDays(offered.workouts),
    visibleWorkouts,
    evaluation,
    craft,
    repairs,
    attempts: 1,
    failureSignature: accepted ? null : signature(evaluation),
  };
}

/**
 * The only Section 18 commit decision. Every candidate, regenerated week and
 * fallback is evaluated by the same safety → visible resolver → evaluator
 * boundary; approved targets are never reconciled down to deficient output.
 */
export function runSection18AcceptedWeekGateway(
  input: Section18AcceptedWeekGatewayInput,
): Section18AcceptedWeekGatewayResult {
  probeConstraintEntry('gateway', input.surfaces.userRemovalConstraints);
  const traced = (result: Section18AcceptedWeekGatewayResult, candidatePath: string) => {
    emitAthleteActionEvent(input.trace ?? currentAthleteActionTrace(), 'accepted_week_gateway_result', {
      weekId: input.weekStart,
      gatewayStatus: result.status,
      candidatePath,
      candidateCount: result.attempts,
      rejectionCodes: result.evaluation.blockingViolations.map((finding) =>
        `${finding.code}:${finding.domain}`),
      gatewayViolations: result.evaluation.blockingViolations.map((finding) => ({
        code: finding.code,
        domain: finding.domain,
        expected: finding.expected,
        actual: finding.actual,
      })),
      typedReductionCreated: result.contract.authorisedReductions.some((reduction) =>
        reduction.reason === 'explicit_user_override'),
      // WHICH REPAIR RAN. Added 2026-08-10 because the log could not say.
      //
      // Sam's coach export showed `gatewayStatus: "repaired"` FOUR times in one
      // transaction with `rejectionCodes: []` and `gatewayViolations: []`, and
      // the pair reads like a contradiction: a repair ran over a week the
      // gateway also reported as violating nothing. It is not a contradiction —
      // **the violations reported are the SELECTED candidate's, i.e. the state
      // AFTER repair** — but nothing at the field said so, and with no repair
      // kind there was no way to ask what had been changed or why.
      //
      // `LAW-count-names-instrument`: an empty list named the unit "what is
      // still wrong", and it was read as "what was wrong". The kinds are typed
      // and already on the result; the log was simply throwing them away.
      repairKinds: result.repairs.map((repair) => repair.kind),
      repairCount: result.repairs.length,
      // THE CRAFT VERDICT TRAVELS WITH THE CONTRACT VERDICT. Same reasoning as
      // `repairKinds` above: a week that shipped with a known bad shape has to
      // be answerable afterwards, and only the log can be asked.
      craftBlocking: result.craft.blocking.map((finding) =>
        `${finding.ruleId}@${finding.dates.join(',') || 'week'}`),
      craftFindingCount: result.craft.findings.length,
      outcome: result.status === 'impossible' ? 'rejected' : result.status,
      rejectingBoundary: result.status === 'impossible'
        ? 'section18AcceptedWeekGateway'
        : null,
      failureSignature: result.failureSignature,
    });
    return result;
  };
  /* ══ ONE CANDIDATE. THERE IS NO CASCADE. ═══════════════════════════════════
   *
   * What stood here tried FOUR weeks in turn: the authored one, then the same
   * week with its CONTRACT reduced so the shortfall stopped counting, then a
   * regenerated week, then a "safe fallback" week. Each was a fresh attempt to
   * find something — anything — the validator would sign.
   *
   * Every one of those is authoring, and the second is the worst of them: it
   * did not fix the week, it lowered the bar until the week cleared it. That is
   * conform-back rewriting, and it is exactly how a scheduler defect stays
   * invisible for months.
   *
   * §18 now judges the week the authoring owners produced, and says yes or no.
   * If the answer is no, the owners have work to do and the refusal says so.
   */
  return traced(resolveCandidate({ input, candidate: input }), 'primary');
}

/**
 * The gateway's verdict, delivered to whoever owns the acceptance decision.
 *
 * §18 OWNERSHIP REASSESSMENT (2026-08-05, defect D3; approved by Sam). The gate
 * is a candidate-quality instrument: it may fail a candidate, it must never veto
 * a FACT. Generation used to throw unconditionally here, which killed the one
 * thing the athlete actually decided — "I'm sick" — because a week derived from
 * that decision could not meet its own contract. That is the honest consequence
 * of the fact, not a reason to discard it.
 *
 * So the verdict now routes by the operation, in the vocabulary
 * `acceptedStateTransaction` already ratified for exactly this split:
 *
 *   • `restoration` — replaying state that was accepted once. A week it cannot
 *     reproduce means the stored snapshot is corrupt, and publishing a reduced
 *     version of a corrupt snapshot would merge a defect into accepted state.
 *     It throws, as it always did.
 *   • `forward_decision` — the athlete just stated something. The best
 *     achievable week (the search's own selected candidate, carried on the
 *     result even when `impossible`) is published, and the shortfall is
 *     disclosed downstream by `assertAcceptedVisibleLedgerEquivalence`, which
 *     owns accept-and-reduce and already re-evaluates the accepted week.
 *
 * No new mode and no per-kind branch: one distinction, already ruled, extended
 * to the caller that lacked it.
 */
export function acceptSection18Week(
  input: Section18AcceptedWeekGatewayInput & {
    operation: AcceptedStateOperationKind;
  },
): Section18AcceptedWeekGatewayResult {
  const result = runSection18AcceptedWeekGateway(input);
  if (result.status === 'impossible' && input.operation === 'restoration') {
    throw new Section18WeekAcceptanceError(result);
  }
  return result;
}

/** The strict door: `acceptSection18Week` under a restoration. */
export function requireSection18AcceptedWeek(
  input: Section18AcceptedWeekGatewayInput,
): Section18AcceptedWeekGatewayResult {
  return acceptSection18Week({ ...input, operation: 'restoration' });
}

export function section18BlockingSummary(findings: readonly Section18Finding[]): string {
  return findings.map((finding) => `${finding.code}:${finding.domain}`).sort().join(',');
}
