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
import { searchWholeWeekRepairCandidates } from './wholeWeekRepairEngine';
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

export type Section18WeekAcceptanceStatus =
  | 'accepted'
  | 'repaired'
  | 'regenerated'
  | 'fallback'
  | 'impossible';

export type Section18WeekRepairKind =
  | 'weekly_power_budget'
  /** A required pattern's day was consumed; its lift moved rather than died. */
  | 'displaced_strength_relocated'
  /** The week was not presenting the offer its contract declares; it is now. */
  | 'offer_presented'
  | 'offer_withdrawn'
  | 'core_conditioning_presented'
  | 'obsolete_derived_work_expired'
  | 'optional_work_removed_for_rest'
  | 'core_work_stacked_on_existing_stress_day'
  | 'athlete_removal_typed_reduction'
  | 'regenerated_candidate'
  | 'safe_fallback_candidate'
  /** A session broke a Section 17 craft rule on its day; it moved rather than died. */
  | 'craft_violation_relocated'
  /**
   * The craft tier rejected every candidate the search could reach, and the
   * week published anyway with the violation named. A candidate may fail; a
   * fact may not be vetoed (§18 ownership reassessment 2026-08-05, D3).
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
  /**
   * The week's AUTHORED plan, as relocation templates for the repair search.
   * A displaced session is gone from the candidate by definition, so the week
   * cannot supply its own template.
   */
  strengthTemplates?: readonly Workout[];
  maxRepairAttempts?: number;
  regenerate?: () => Section18AcceptedWeekCandidate | null;
  safeFallback?: () => Section18AcceptedWeekCandidate | null;
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
    readiness: args.contract.safety.reasons.includes('low_readiness') ? 'low' : 'medium',
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

function powerReductionReason(contract: WeeklyExposureContractV2): Section18AuthorisedReduction['reason'] {
  if (contract.safety.trainingPaused) return 'full_pause';
  if (contract.identity.weekKind === 'deload') return 'deload_policy';
  if (contract.identity.mode === 'optional_week') return 'optional_week_mode';
  if (contract.identity.mode === 'in_season_bye_recovery') return 'bye_recovery_mode';
  if (contract.safety.reasons.includes('low_readiness')) return 'low_readiness';
  if (contract.safety.prohibitedPower || contract.safety.prohibitedPowerFamilies.length >= 2) {
    return 'injury_restriction';
  }
  if (contract.identity.mode === 'practice_match_week') return 'practice_match_load';
  return 'game_load_protection';
}

function withPowerReduction(
  contract: WeeklyExposureContractV2,
  original: number,
  budget: number,
  detail: string,
): WeeklyExposureContractV2 {
  contract.authorisedReductions = contract.authorisedReductions.filter((entry) =>
    entry.metric !== 'power_primer_budget');
  if (budget < original) {
    contract.authorisedReductions.push({
      metric: 'power_primer_budget',
      originalApprovedTarget: original,
      reducedTarget: budget,
      reason: powerReductionReason(contract),
      scope: 'week',
      change: 'frequency',
      detail,
      provenance: 'live_typed_reduction',
    });
  }
  return contract;
}

function weeklyPowerBudget(args: {
  contract: WeeklyExposureContractV2;
  workouts: readonly Workout[];
  profile?: OnboardingData | null;
}): { contract: WeeklyExposureContractV2; workouts: Workout[]; budget: number; removed: number } {
  const contract = cloneContract(args.contract);
  const beginner = args.profile?.experienceLevel === 'Complete beginner';
  // THE DELOAD LAW (Sam, 2026-07-27): "Power/speed: KEEP a small sharp dose ...
  // Power is not removed on a deload; a deload is not a reason to lose
  // sharpness." Three terms are gone from this budget: a scheduled deload week,
  // the optional week (which IS a deloaded week), and the low_readiness safety
  // reason. All three are deload doors, and the law reaches every door.
  //
  // A bye recovery week is NOT a deload door and keeps its removal; a beginner,
  // a genuine training pause and an injury prohibition all still remove power.
  const ineligible = contract.power.eligible === false || beginner ||
    contract.identity.mode === 'in_season_bye_recovery' ||
    contract.safety.trainingPaused || contract.safety.prohibitedPower;
  const normalAnchors = contract.anchors.filter((anchor) =>
    anchor.participation === 'normal_unrestricted');
  const teamCount = normalAnchors.filter((anchor) => anchor.kind === 'team_training').length;
  const fixture = normalAnchors.find((anchor) =>
    anchor.kind === 'game' || anchor.kind === 'practice_match');
  const fieldLoadBudget = ineligible
    ? 0
    : fixture && teamCount >= 2
      ? 0
      : fixture || teamCount >= 2
        ? 1
        : 2;
  const budget = fieldLoadBudget;
  const fixtureDay = fixture?.dayOfWeek;
  // RULING 4a (Sam, 2026-08-06) — THE THIRD READER.
  //
  // `budgetedPowerSession`, not `hasPowerRow`. This selector is the WEEKLY
  // BUDGET owner, and the G-2 quality-lower session's authored jumps are
  // outside that budget: the Bible prescription that names them ("2x3 box
  // squats to high box + 2x3 vertical jumps") is game-aware BY DEFINITION,
  // because it exists precisely because the day is two out from a fixture.
  //
  // It was the last owner still asking the question its own way, and it was
  // the one that actually removed the jumps. Both of its exclusion terms fire
  // on the G-2 day and neither can ever be satisfied: `tooCloseToFixture` is
  // true for every day within two of the game (which is what G-2 MEANS), and
  // `anchorDay` is true because the placer puts this session on a team day. So
  // the session could not be kept at ANY budget — a week with no fixture at
  // all was the only world where the authored half survived.
  //
  // The predicate's own header says a second copy of it is the bug. This is
  // that copy retired: the finaliser decides what may be STRIPPED, the
  // evaluator's primer ledger decides what is COUNTED, and this selector
  // decides what COMPETES for the budget — three readers, one question.
  const candidates = args.workouts
    .filter(budgetedPowerSession)
    .map((workout, index) => ({
      workout,
      index,
      tooCloseToFixture: fixtureDay === undefined
        ? false
        : ((fixtureDay - workout.dayOfWeek + 7) % 7) <= 2,
      anchorDay: normalAnchors.some((anchor) => anchor.dayOfWeek === workout.dayOfWeek),
    }))
    .sort((a, b) =>
      Number(a.tooCloseToFixture) - Number(b.tooCloseToFixture) ||
      Number(a.anchorDay) - Number(b.anchorDay) ||
      a.workout.dayOfWeek - b.workout.dayOfWeek ||
      a.index - b.index);
  const keep = new Set<string>();
  const usedFamilies = new Set<string>();
  for (const candidate of candidates) {
    if (keep.size >= budget || candidate.tooCloseToFixture || candidate.anchorDay) continue;
    const family = powerRows(candidate.workout)[0]?.power?.family;
    if (family && usedFamilies.has(family) && candidates.some((other) =>
      !keep.has(other.workout.id) && powerRows(other.workout)[0]?.power?.family !== family &&
      !other.tooCloseToFixture && !other.anchorDay)) continue;
    keep.add(candidate.workout.id);
    if (family) usedFamilies.add(family);
  }
  // THE STRIP. This used to delete a field — `({ powerBlock, ...rest }) => rest`
  // — which no owner could see: nothing recorded that content left, and the
  // workout's name and type could go on describing work that was gone. As rows,
  // a strip is an ordinary content mutation and goes back through the canonical
  // owner, so identity and §18 evidence are re-derived from what actually
  // survives.
  const workouts = args.workouts.map((workout) => {
    if (!budgetedPowerSession(workout) || keep.has(workout.id)) return { ...workout };
    return finaliseWorkoutAfterMutation(withoutPowerRows(workout), {
      phase: contract.identity.seasonPhase,
      offseasonSubphase: canonicalContextSubphase(
        contract.identity.seasonPhase,
        contractOffseasonSubphase(contract),
      ),
      weekKind: contract.identity.weekKind,
      profile: args.profile ?? undefined,
      planIntentValid: !!workout.planEntryId,
      referenceWorkout: workout,
      // The removal is the point; restoring a pattern here would undo it.
      restoreMissingPlanPatterns: false,
    }).workout;
  });
  // COUNTED, not merely present: the exempt session is outside the budget, so
  // it must not be reported as consuming it. The evaluator's primer ledger
  // reads the same predicate, which is what keeps the content and the verdict
  // agreeing by construction rather than agreeing until an anchor changes.
  const achieved = workouts.filter(budgetedPowerSession).length;
  contract.power.eligible = !ineligible;
  contract.power.plannerSelectedWeeklyBudget = budget;
  contract.power.achievedPrimerCount = achieved;
  contract.power.removalReason = ineligible
    ? beginner ? 'training_age_ineligible' : contract.power.removalReason ?? 'weekly_power_ineligible'
    : budget < 2 ? 'field_load_budget_reduction' : null;
  withPowerReduction(
    contract,
    2,
    budget,
    `Weekly selector budget=${budget}; normal anchors=${normalAnchors.map((anchor) => anchor.kind).join(',') || 'none'}.`,
  );
  return {
    contract,
    workouts,
    budget,
    removed: candidates.length - achieved,
  };
}

function explicitRestStub(dayOfWeek: number, source?: Workout): Workout {
  const timestamp = source?.updatedAt ?? new Date(0).toISOString();
  return {
    id: source?.id ?? `section18-rest-${dayOfWeek}`,
    microcycleId: source?.microcycleId ?? 'section18-rest',
    dayOfWeek,
    name: 'Rest',
    description: '',
    durationMinutes: 0,
    intensity: 'Light',
    workoutType: 'Rest',
    sessionTier: 'recovery',
    exercises: [],
    createdAt: source?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function workoutHasMainStrength(workout: Workout): boolean {
  return workout.exercises.some((row) => row.section18Evidence?.role === 'main_strength') ||
    !!workout.strengthIntent?.effectivePatterns.length;
}

function workoutHasAppCoreConditioning(workout: Workout): boolean {
  const role = workout.section18Evidence?.conditioningRole;
  return role === 'core' || role === 'required_core' || role === 'planner_selected_core';
}

function mergeCoreWork(source: Workout, target: Workout): Workout | null {
  const sourceConditioning = workoutHasAppCoreConditioning(source);
  const targetConditioning = workoutHasAppCoreConditioning(target);
  if (sourceConditioning && targetConditioning) return null;
  const exercises = [
    ...target.exercises,
    ...source.exercises.map((row, index) => ({
      ...row,
      workoutId: target.id,
      exerciseOrder: target.exercises.length + index + 1,
    })),
  ];
  const preserveTargetType = target.workoutType === 'Team Training';
  const stackedDate = source.derivedSessionProvenance?.[0]?.originatingDate ??
    source.updatedAt.slice(0, 10);
  const sourceProvenance = (source.derivedSessionProvenance ?? []).map((record) => ({
    ...record,
    scope: record.scope === 'session'
      ? record.targetMetric === 'main_strength' || record.targetMetric === 'strength_pattern'
        ? 'strength_component' as const
        : record.targetMetric === 'conditioning_core'
          ? 'conditioning_component' as const
          : record.targetMetric === 'sprint_high_speed'
            ? 'speed_component' as const
            : record.scope
      : record.scope,
    history: [...record.history, {
      action: 'stacked' as const,
      date: stackedDate,
      fromDayOfWeek: source.dayOfWeek,
      toDayOfWeek: target.dayOfWeek,
    }],
  }));
  const combinedProvenance = [
    ...(target.derivedSessionProvenance ?? []),
    ...sourceProvenance,
  ];
  // THE CONDITIONING THE TARGET GAINS, NAMED so the marker rule can read it.
  //
  // A STACK IS THE CLONE'S TWIN, AND ONLY THE CLONE HAD LEARNED THE RULE.
  // `composedOptionalMarker` owns "the marker dies where the day gains
  // conditioning", but its only shape was a clone's `Partial<Workout>`
  // overrides — so the three STACK sites (here, `postGenerationConstraint
  // Validation`, `fixtureMinimalReplan`) could not reach it and each spread
  // `...target` with the source's conditioning laid on top. A Gunshow that
  // absorbed a conditioning session kept claiming it was one composed Gunshow:
  // the deep walker's SEED 3 L-P6 offence, `renders ["Gunshow","Conditioning"]`.
  //
  // Naming the gain instead of inlining it means the site does not decide
  // anything — it hands the owner exactly the fields it is about to write, and
  // the owner answers. Nothing to remember, and no fourth copy of the rule.
  const conditioningGain: Partial<Workout> = sourceConditioning && !targetConditioning ? {
    hasCombinedConditioning: true,
    attachedConditioningKind: source.attachedConditioningKind,
    conditioningFlavour: source.conditioningFlavour,
    conditioningCategory: source.conditioningCategory,
    conditioningFeasibility: source.conditioningFeasibility,
    conditioningBlock: source.conditioningBlock,
    section18ConditioningRole: source.section18ConditioningRole,
    section18Evidence: source.section18Evidence,
  } : {};
  return {
    ...target,
    name: preserveTargetType ? target.name : `${target.name} + ${source.name}`,
    workoutType: preserveTargetType ? target.workoutType : 'Mixed',
    sessionTier: 'core',
    intensity: target.intensity === 'High' || target.intensity === 'Maximal' ||
      source.intensity === 'High' || source.intensity === 'Maximal'
      ? 'High'
      : 'Moderate',
    durationMinutes: target.durationMinutes + source.durationMinutes,
    exercises,
    derivedSessionProvenance: combinedProvenance.length > 0 ? combinedProvenance : undefined,
    ...(source.strengthIntent ? { strengthIntent: source.strengthIntent } : {}),
    ...(source.strengthPatternContributions
      ? { strengthPatternContributions: [...source.strengthPatternContributions] }
      : {}),

    ...(source.speedBlock && !target.speedBlock ? { speedBlock: source.speedBlock } : {}),
    ...conditioningGain,
    ...composedOptionalClearingPatch(conditioningGain),
    recoveryAddons: [...(target.recoveryAddons ?? []), ...(source.recoveryAddons ?? [])],
    updatedAt: source.updatedAt > target.updatedAt ? source.updatedAt : target.updatedAt,
  };
}

function replaceDay(workouts: readonly Workout[], day: number, replacement: Workout): Workout[] {
  const without = workouts.filter((workout) => workout.dayOfWeek !== day);
  return [...without, replacement].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

function repairOptionalRestCandidates(args: {
  workouts: readonly Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  contract: WeeklyExposureContractV2;
  weekStart: string;
}): Array<{ workouts: Workout[]; repair: Section18WeekRepair }> {
  const fixtureDays = args.contract.anchors
    .filter((anchor) => anchor.kind === 'game' || anchor.kind === 'practice_match')
    .map((anchor) => anchor.dayOfWeek);
  const protectedRecoveryDays = new Set(fixtureDays.map((day) => (day + 1) % 7));
  const optionalDays = args.workouts
    .filter((workout) => workout.sessionTier === 'optional')
    .map((workout) => workout.dayOfWeek);
  const candidates = Array.from(new Set([
    ...args.evaluation.ledger.restStress.activeRecoveryDays,
    ...optionalDays,
  ])).filter((day) => !protectedRecoveryDays.has(day));
  const crossWeekFixtureDependency = args.workouts
    .flatMap((workout) => workout.derivedSessionProvenance ?? [])
    .find((record) => record.dependency?.crossesWeekBoundary === true);
  return candidates.flatMap((day) => {
    const source = args.workouts.find((workout) => workout.dayOfWeek === day);
    if (source && (workoutHasMainStrength(source) || workoutHasAppCoreConditioning(source))) return [];
    const rest = explicitRestStub(day, source);
    const targetDate = dateForDay(args.weekStart, day);
    const dependencyOwnedRest = crossWeekFixtureDependency?.dependency
      ? {
          ...rest,
          derivedSessionProvenance: [createDerivedSessionProvenance({
            origin: 'rest_distribution_repair',
            scope: 'session',
            triggerSignature: crossWeekFixtureDependency.triggerSignature,
            credit: { metric: 'full_rest', amount: 1 },
            originatingDate: targetDate,
            originatingFixtureDate: crossWeekFixtureDependency.dependency.source.date,
            sourcePlanEntryId: source?.planEntryId ?? null,
            validWhile: crossWeekFixtureDependency.validWhile,
            invalidWhen: crossWeekFixtureDependency.invalidWhen,
            dependency: {
              kind: 'fixture_to_session',
              source: { ...crossWeekFixtureDependency.dependency.source },
              target: { date: targetDate, weekStart: args.weekStart },
              crossesWeekBoundary:
                crossWeekFixtureDependency.dependency.source.weekStart !== args.weekStart,
              displacedSession: {
                targetDate,
                sourcePlanEntryId: source?.planEntryId ?? null,
                workout: source ? JSON.parse(JSON.stringify(source)) as Workout : null,
              },
              restoration: {
                targetDate,
                sourcePlanEntryId: source?.planEntryId ?? null,
                workout: source ? JSON.parse(JSON.stringify(source)) as Workout : null,
              },
            },
          })],
        }
      : rest;
    return [{
      workouts: replaceDay(args.workouts, day, dependencyOwnedRest),
      repair: {
        kind: 'optional_work_removed_for_rest',
        detail: `Removed optional/recovery-only work from ${DAY_NAMES[day]} to create true full rest.`,
        sourceDay: day,
      },
    }];
  });
}

function repairByStackingCandidates(args: {
  workouts: readonly Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  contract: WeeklyExposureContractV2;
  requireHardTarget: boolean;
}): Array<{ workouts: Workout[]; repair: Section18WeekRepair }> {
  const anchorByDay = new Map(args.contract.anchors.map((anchor) => [anchor.dayOfWeek, anchor]));
  const hardDays = new Set(args.evaluation.ledger.restStress.hardDays);
  const sources = args.workouts
    .filter((workout) => workoutHasMainStrength(workout) && !anchorByDay.has(workout.dayOfWeek))
    .sort((a, b) => b.dayOfWeek - a.dayOfWeek);
  const targets = args.workouts
    .filter((workout) => {
      const anchor = anchorByDay.get(workout.dayOfWeek);
      if (anchor?.kind === 'game' || anchor?.kind === 'practice_match') return false;
      if (workoutHasMainStrength(workout)) return false;
      if (args.requireHardTarget && !hardDays.has(workout.dayOfWeek)) return false;
      return workout.workoutType === 'Team Training' || workoutHasAppCoreConditioning(workout);
    })
    .sort((a, b) => Number(!hardDays.has(a.dayOfWeek)) - Number(!hardDays.has(b.dayOfWeek)) ||
      a.dayOfWeek - b.dayOfWeek);
  return sources.flatMap((source) => targets.flatMap((target) => {
      if (source.dayOfWeek === target.dayOfWeek) return [];
      const merged = mergeCoreWork(source, target);
      if (!merged) return [];
      let workouts = replaceDay(args.workouts, target.dayOfWeek, merged);
      workouts = replaceDay(workouts, source.dayOfWeek, explicitRestStub(source.dayOfWeek, source));
      return [{
        workouts,
        repair: {
          kind: 'core_work_stacked_on_existing_stress_day',
          detail: `Stacked required ${source.name} onto ${target.name}; no required exposure was removed.`,
          sourceDay: source.dayOfWeek,
          targetDay: target.dayOfWeek,
        },
      }];
  }));
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
 * `repairDisplacedStrengthCandidates` does — relocation before substitution
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
function repairCraftViolationCandidates(args: {
  workouts: readonly Workout[];
  craft: WeekCraftAssessment;
  contract: WeeklyExposureContractV2;
  weekStart: string;
  /** Handed down from candidate assembly — never re-derived here. */
  governableDates: ReadonlySet<string>;
  availableDayNumbers?: readonly number[];
}): Array<{ workouts: Workout[]; repair: Section18WeekRepair }> {
  if (args.craft.blocking.length === 0) return [];
  const anchorDays = new Set(args.contract.anchors.map((anchor) => anchor.dayOfWeek));
  const governable = (day: number): boolean =>
    !anchorDays.has(day) && args.governableDates.has(dateForDay(args.weekStart, day));
  const occupantByDay = new Map(args.workouts
    .filter((workout) => (workout.exercises ?? []).length > 0)
    .map((workout) => [workout.dayOfWeek, workout] as const));
  const displaceable = (workout: Workout | undefined): boolean =>
    workout === undefined || resolverMayDisplace(workout);
  const targetDays = (args.availableDayNumbers ?? [])
    .filter(governable)
    .sort((a, b) => a - b);
  if (targetDays.length === 0) return [];

  const implicated = new Map<string, Set<string>>(); // date -> session names
  for (const finding of args.craft.blocking) {
    for (const date of finding.dates) {
      const names = implicated.get(date) ?? new Set<string>();
      for (const session of finding.sessions) names.add(session);
      implicated.set(date, names);
    }
  }
  const sources = args.workouts.filter((workout) => {
    if (!governable(workout.dayOfWeek)) return false;
    if (!resolverMayDisplace(workout)) return false;
    const names = implicated.get(dateForDay(args.weekStart, workout.dayOfWeek));
    return names !== undefined && names.has(workout.name);
  });
  const ruleIds = Array.from(new Set(args.craft.blocking.map((finding) => finding.ruleId)))
    .sort()
    .join(', ');

  return sources.flatMap((source) => targetDays.flatMap((day) => {
    if (day === source.dayOfWeek) return [];
    const occupant = occupantByDay.get(day);
    // The target day is the other half of the move: swapping a template session
    // onto the athlete's own day displaces THEIR session just as surely.
    if (!displaceable(occupant)) return [];
    const moved = replaceDay(args.workouts, day, { ...source, dayOfWeek: day });
    const withSourceDayResolved = occupant
      ? replaceDay(moved, source.dayOfWeek, { ...occupant, dayOfWeek: source.dayOfWeek })
      // The stub keeps the source's microcycle and timestamps and DROPS its id.
      // The moved session still carries that id, and a week holding the same id
      // twice is a week no override, provenance or removal record can address.
      : replaceDay(moved, source.dayOfWeek, {
          ...explicitRestStub(source.dayOfWeek, source),
          id: `section18-rest-${source.dayOfWeek}`,
        });
    return [{
      workouts: withSourceDayResolved,
      repair: {
        kind: 'craft_violation_relocated' as const,
        detail: occupant
          ? `Swapped ${source.name} with ${occupant.name} (${DAY_NAMES[source.dayOfWeek]} ↔ ${DAY_NAMES[day]}) — its original day breaks ${ruleIds}.`
          : `Moved ${source.name} to ${DAY_NAMES[day]} — its original day breaks ${ruleIds}.`,
        sourceDay: source.dayOfWeek,
        targetDay: day,
      },
    }];
  }));
}

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
 * The Bible's :4688 order is respected by POSITION in `localRepairCandidates`:
 * relocate first (this), then substitute/stack, then move optional work, and a
 * typed reduction only when nothing else answers.
 *
 * THE TEMPLATE SOURCE is the week's AUTHORED plan, which is exactly what the
 * publisher used (`targetMicrocycle.workouts`). A displaced session is gone
 * from the derived week by definition, so the week cannot supply its own
 * relocation template.
 */
function repairDisplacedStrengthCandidates(args: {
  workouts: readonly Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  contract: WeeklyExposureContractV2;
  weekStart: string;
  profile?: OnboardingData | null;
  strengthTemplates?: readonly Workout[];
  /** The world the week is judged against. The search asks it ONE question,
   * and it asks the RECORD (`removalDecisions`), never the application input:
   * "does a decision explain this missing pattern?" It never applies a
   * removal, which is why an emptied `userRemovalConstraints` is no answer at
   * all (`docs/REMOVAL_RECORD_SPLIT_RULING_2026-08-06.md`). */
  surfaces: AcceptedEffectiveWeekSurfaces;
  availableDayNumbers?: readonly number[];
}): Array<{ workouts: Workout[]; repair: Section18WeekRepair }> {
  // CONDITION 1 — the search runs ONLY on violation. A conforming week never
  // reaches here, and a week whose violation is a different domain does not
  // pay for this one.
  const missingPattern = args.evaluation.blockingViolations.some((finding) =>
    finding.domain === 'strength_patterns');
  const strengthShort = args.evaluation.blockingViolations.some((finding) =>
    finding.domain === 'main_strength');
  if (!missingPattern && !strengthShort) return [];
  const templates = args.strengthTemplates ?? [];
  if (templates.length === 0) return [];

  const achieved = args.evaluation.ledger.strengthPatterns.meaningfulMainLiftCount;
  const missing = args.contract.strengthPatterns.requiredSafePatterns
    .filter((pattern) => (achieved[pattern] ?? 0) === 0);
  const present = new Set(args.workouts.map((workout) => workout.planEntryId ?? workout.id));
  // A SESSION THE ATHLETE DELETED IS NOT A RELOCATION TEMPLATE.
  //
  // The template source is the week's AUTHORED plan, so a session the athlete
  // binned is still in it — and "not present in the week" is exactly what a
  // deletion produces. Without this the search re-adds the deleted session on
  // another day and calls it a pattern repair, which is decision LOSS wearing a
  // repair's name. The deletion class has its OWN relocation, which records the
  // constraint as it moves; this one must not compete with it.
  //
  // AND MORE THAN THAT: when a DELETION explains the missing pattern, the
  // deletion class owns the repair and this one stands down entirely. Its
  // relocation records the typed ownership that makes a restore reversible;
  // mine does not, so a candidate of mine that greens the week first would
  // leave the athlete's bin un-restorable. This is condition 3 read the right
  // way round — a repair carries the authority of what TRIGGERED it, so a
  // missing pattern caused by a decision belongs to that decision's repair and
  // a missing pattern caused by a fixture belongs to this one.
  //
  // IT READS THE RECORD, NOT THE APPLICATION INPUT. This is the split's whole
  // reason: by the time tier 4 reaches this line the removals have already
  // been folded into the composed week and `userRemovalConstraints` has been
  // blanked for that reason, so asking it returned `[]` every single time.
  const decisionsForSearch = args.surfaces.removalDecisions;
  const removalSpeaksForThisWeek = decisionsForSearch.some((constraint) => {
    if (constraint.status !== 'active') return false;
    for (let day = 0; day < 7; day++) {
      if (dateForDay(args.weekStart, day) === constraint.targetDate) return true;
    }
    return false;
  });
  if (removalSpeaksForThisWeek) return [];

  // CONDITION 3 — an athlete-emptied day STAYS EMPTY. Last is not highest, and
  // a relocation that lands on a day the athlete cleared is the conformance
  // pass overruling a decision.
  //
  // The RECORD again, and for the same reason: asking which days a decision
  // emptied is an explanation question. (Reached only when no decision speaks
  // for this week at all, so today it can add nothing the stand-down did not
  // already answer — it reads the record so that stays true if the stand-down
  // is ever narrowed to a single pattern.)
  const emptied = new Set<number>();
  for (const constraint of decisionsForSearch) {
    if (constraint.status !== 'active') continue;
    for (let day = 0; day < 7; day++) {
      if (dateForDay(args.weekStart, day) === constraint.targetDate) emptied.add(day);
    }
  }

  const byDayNumber = new Map(args.workouts.map((workout) => [workout.dayOfWeek, workout]));
  const anchorDays = new Set(args.contract.anchors.map((anchor) => anchor.dayOfWeek));
  const allowed = (args.availableDayNumbers && args.availableDayNumbers.length > 0
    ? args.availableDayNumbers
    : [1, 2, 3, 4, 5, 6, 0]);
  // DETERMINISTIC ORDERING (condition 2): a stable preference, then the day
  // number. No wall-clock, no set iteration order.
  const placementDays = Array.from(new Set(allowed))
    .filter((day) => {
      if (emptied.has(day) || anchorDays.has(day)) return false;
      const existing = byDayNumber.get(day);
      if (!existing) return true;
      return !hasMainStrength(existing);
    })
    .sort((left, right) => {
      const leftEmpty = byDayNumber.has(left) ? 1 : 0;
      const rightEmpty = byDayNumber.has(right) ? 1 : 0;
      return leftEmpty - rightEmpty || left - right;
    });
  if (placementDays.length === 0) return [];

  const candidates: Array<{ workouts: Workout[]; repair: Section18WeekRepair }> = [];
  for (const pattern of missing) {
    // ONLY THE LIFT TRAVELS. A stacked conditioning component pays the bill of
    // the DAY it was placed on; carrying it to the relocation target
    // double-counts the week and breaches the conditioning maximum.
    const template = templates
      .filter((workout) => !present.has(workout.planEntryId ?? workout.id) &&
        strengthPatternLedger([workout] as never, 'effective')[pattern] > 0)
      .flatMap((workout) => {
        // ONLY THE LIFT TRAVELS — power rows come off for the same reason the
        // conditioning component does, and ruling 4a is why it matters here:
        // the WEEKLY BUDGET decides what competes for a primer slot, and that
        // decision was already taken above, before this relocation existed.
        // Carrying a primer in would put the week over its own authorised
        // reduction (`reduction_contradiction:power`) — a repair breaking the
        // arithmetic of the repair that preceded it.
        const stripped = stripConditioningComponent(withoutPowerRows(workout));
        return stripped ? [{ ...stripped, dayOfWeek: workout.dayOfWeek }] : [];
      })[0];
    if (!template) continue;
    for (const day of placementDays) {
      const relocated = relocateStrengthTemplate({
        template, dayOfWeek: day, weekStart: args.weekStart,
        contract: args.contract, profile: args.profile,
      });
      candidates.push({
        workouts: [
          ...args.workouts.filter((workout) => workout.dayOfWeek !== day),
          relocated,
        ].sort((left, right) => left.dayOfWeek - right.dayOfWeek),
        repair: {
          kind: 'displaced_strength_relocated',
          sourceDay: template.dayOfWeek,
          targetDay: day,
          // CONDITION 3 — the repair NAMES what authorises it.
          detail: `Relocated the week's ${pattern} main lift from ${DAY_NAMES[template.dayOfWeek]} to `
            + `${DAY_NAMES[day]}; authorised by ${authorityForDisplacement(args.contract)}.`,
        },
      });
    }
  }
  return candidates;
}

/** The week's available days, read through the ONE availability owner. */
function profileAvailableDayNumbers(args: {
  contract: WeeklyExposureContractV2;
  weekStart: string;
  profile?: OnboardingData | null;
}): number[] {
  if (!args.profile) return [];
  return resolveProfileTargetWeekAvailability({
    profile: args.profile,
    weekStart: args.weekStart,
    markedDays: fixtureAwareMarkedDaysForWeek({
      contract: args.contract,
      weekStart: args.weekStart,
      profile: args.profile,
    }),
    ownedPhase: ownSeasonPhaseForGeneration(args.profile),
  }).effectiveAvailableDayNumbers ?? [];
}

/** Does this workout carry a meaningful main lift? The ledger is the owner. */
function hasMainStrength(workout: Workout): boolean {
  const ledger = strengthPatternLedger([workout] as never, 'effective');
  return ledger.squat + ledger.hinge + ledger.push + ledger.pull > 0;
}

/** RESOLVED AUTHORITY at the relocation (condition 3): what displaced the day. */
function authorityForDisplacement(contract: WeeklyExposureContractV2): string {
  const fixture = contract.anchors.find((anchor) =>
    anchor.kind === 'game' || anchor.kind === 'practice_match');
  if (fixture) return `week.fixture.${fixture.kind} on ${DAY_NAMES[fixture.dayOfWeek]}`;
  const decision = contract.authorisedReductions.find((reduction) => reduction.deletionIdentity);
  if (decision) return `decision ${decision.deletionIdentity}`;
  return 'week.contract.required_pattern_coverage';
}

function relocateStrengthTemplate(args: {
  template: Workout;
  dayOfWeek: number;
  weekStart: string;
  contract: WeeklyExposureContractV2;
  profile?: OnboardingData | null;
}): Workout {
  const dayName = DAY_NAMES[args.dayOfWeek].toLowerCase();
  const id = `${args.template.id}:tier4-replan:${args.weekStart}:${dayName}`;
  const moved: Workout = {
    ...args.template,
    id,
    dayOfWeek: args.dayOfWeek,
    planEntryId: `tier4-replan:${args.weekStart}:${dayName}:strength`,
    exercises: args.template.exercises.map((row, index) => ({
      ...row,
      id: `${id}:row:${index + 1}`,
      workoutId: id,
      exerciseOrder: index + 1,
    })),
  };
  return finaliseWorkoutAfterMutation(moved, {
    phase: args.contract.identity.seasonPhase,
    offseasonSubphase: canonicalContextSubphase(
      args.contract.identity.seasonPhase,
      contractOffseasonSubphase(args.contract),
    ),
    weekKind: args.contract.identity.weekKind,
    profile: args.profile ?? undefined,
    planIntentValid: true,
    referenceWorkout: args.template,
    restoreMissingPlanPatterns: false,
  }).workout;
}

/**
 * A typed reduction for capacity a FACT took away, named by that fact.
 *
 * The week declares a planner-selected core-conditioning target it can no
 * longer reach because a fixture consumed one of its days and the displaced
 * lift had to occupy another. Relocation ran first and substitution after it;
 * this is what is left, and the Bible puts it last for exactly that reason.
 */
function withDisplacedCapacityReduction(args: {
  contract: WeeklyExposureContractV2;
  workouts: readonly Workout[];
  weekStart: string;
  profile?: OnboardingData | null;
}): WeeklyExposureContractV2 {
  const fixture = args.contract.anchors.find((anchor) =>
    anchor.kind === 'game' || anchor.kind === 'practice_match');
  // NOTHING DISPLACED, NOTHING AUTHORISED.
  if (!fixture) return args.contract;
  const evaluation = evaluateSection18EffectiveWeek({
    contract: args.contract,
    workouts: args.workouts,
    weekStart: args.weekStart,
  });
  const core = evaluation.contract.conditioning.core;
  const gap = core.unresolvedPlannerSelectedShortfall ?? 0;
  if (gap <= 0) return args.contract;
  // The floor is never reduced here — only the planner's SELECTED target, and
  // only down to what the week can actually deliver.
  const delivered = evaluation.ledger.conditioning.coreCount;
  if (delivered < core.requiredMinimum) return args.contract;
  const contract = cloneContract(args.contract);
  const reason: Section18AuthorisedReduction['reason'] = fixture.kind === 'game'
    ? 'game_load_protection'
    : 'practice_match_load';
  contract.authorisedReductions = contract.authorisedReductions.filter((entry) =>
    !(entry.metric === 'conditioning_core_frequency' && entry.reason === reason));
  contract.authorisedReductions.push({
    metric: 'conditioning_core_frequency',
    originalApprovedTarget: core.plannerSelectedTarget ?? core.requiredMinimum,
    reducedTarget: delivered,
    reason,
    scope: 'week',
    change: 'frequency',
    detail: `The ${fixture.kind === 'game' ? 'game' : 'practice match'} on `
      + `${DAY_NAMES[fixture.dayOfWeek]} consumed a training day and displaced the week's `
      + `lift onto another; core conditioning delivers ${delivered} of `
      + `${core.plannerSelectedTarget ?? core.requiredMinimum} selected, floor `
      + `${core.requiredMinimum} held.`,
    provenance: 'live_typed_reduction',
    affectedWeek: args.weekStart,
  });
  contract.conditioning.core.plannerSelectedTarget = delivered;
  contract.conditioning.reductions = contract.authorisedReductions.filter((entry) =>
    entry.metric === 'conditioning_core_frequency');
  return contract;
}

function localRepairCandidates(args: {
  workouts: readonly Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  craft: WeekCraftAssessment;
  governableDates: ReadonlySet<string>;
  contract: WeeklyExposureContractV2;
  weekStart: string;
  profile?: OnboardingData | null;
  strengthTemplates?: readonly Workout[];
  surfaces: AcceptedEffectiveWeekSurfaces;
  availableDayNumbers?: readonly number[];
}): Array<{ workouts: Workout[]; repair: Section18WeekRepair }> {
  const restShort = args.evaluation.blockingViolations.some((finding) =>
    finding.domain === 'full_rest');
  const hardBreach = args.evaluation.blockingViolations.some((finding) =>
    finding.code === 'hard_day_breach');
  return [
    // THE :4688 ORDER. Relocate first — moving the athlete's own authored
    // session is always cheaper than substituting for it or reducing the week.
    ...repairDisplacedStrengthCandidates(args),
    ...(restShort ? repairOptionalRestCandidates(args) : []),
    ...(hardBreach
      ? repairByStackingCandidates({ ...args, requireHardTarget: true })
      : []),
    ...(restShort
      ? repairByStackingCandidates({ ...args, requireHardTarget: false })
      : []),
    ...repairCoreConditioningShortfallCandidates(args),
    // LAST, because it is the cheapest thing to be wrong about. Everything above
    // answers a CONTRACT breach — a week that is unlawful until it is fixed. A
    // craft relocation answers a quality judgement on a week that already
    // conforms, so it takes its turn after the lawfulness repairs have had
    // theirs, exactly as the offer and the reduction do.
    ...repairCraftViolationCandidates(args),
  ];
}

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
function repairCoreConditioningShortfallCandidates(args: {
  workouts: readonly Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  contract: WeeklyExposureContractV2;
  weekStart: string;
  profile?: OnboardingData | null;
}): Array<{ workouts: Workout[]; repair: Section18WeekRepair }> {
  const core = args.evaluation.contract.conditioning.core;
  // THE :4688 ORDER's THIRD STEP, reached at last. This generator already knew
  // how to place required core conditioning; it was only ever ASKED when the
  // week missed its floor. A relocation that lands on a day which was paying a
  // conditioning bill leaves the week short against the PLANNER-SELECTED
  // target instead — the same gap, one rung up, and the same answer. Under the
  // deriver-acquires-repair-search ruling tier 4 performs the whole order, so
  // the question it asks widens to the shortfall the week actually has.
  const selectedShortfall = args.evaluation.blockingViolations.some((finding) =>
      finding.code === 'planner_selected_target_miss' && finding.domain === 'conditioning')
    ? core.unresolvedPlannerSelectedShortfall ?? 0
    : 0;
  const shortfall = Math.max(core.unresolvedMinimumShortfall ?? 0, selectedShortfall);
  if (shortfall <= 0) return [];
  const placed = presentRequiredCoreConditioning({
    workouts: args.workouts,
    contract: args.evaluation.contract,
    shortfall,
    weekStart: args.weekStart,
    profile: args.profile,
    microcycleId: `section18-core:${args.weekStart}`,
    weekKind: args.evaluation.contract.identity.weekKind,
  });
  if (placed.placedDays.length === 0) return [];
  return [{
    workouts: placed.workouts,
    repair: {
      kind: 'core_conditioning_presented',
      detail: `Presented ${placed.placedDays.length} required core conditioning exposure${placed.placedDays.length === 1 ? '' : 's'} the week's contract declares but the week did not carry, on ${placed.placedDays.map((day) => DAY_NAMES[day]).join(', ')}.`,
    },
  }];
}

function resolveCandidate(args: {
  input: Section18AcceptedWeekGatewayInput;
  candidate: Section18AcceptedWeekCandidate;
  inheritedRepairs?: Section18WeekRepair[];
}): Section18AcceptedWeekGatewayResult {
  const maxCandidates = Math.max(1, args.input.maxRepairAttempts ?? 48);
  const initialRepairs = [...(args.inheritedRepairs ?? [])];
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
  const power = weeklyPowerBudget({
    contract: safety.contract,
    workouts: safety.workouts,
    profile: args.input.profile,
  });
  if (power.removed > 0 || power.budget < 2) {
    initialRepairs.push({
      kind: 'weekly_power_budget',
      // Counted the same way the budget is decided. Reading `hasPowerRow` here
      // made the sentence contradict itself on the G-2 world — "kept 1 primers
      // within budget 0" — by counting a session that is outside the budget.
      detail: `Weekly selector kept ${power.workouts.filter(budgetedPowerSession).length} primers within budget ${power.budget}.`,
    });
  }
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
  type CandidateState = { workouts: Workout[]; repairs: Section18WeekRepair[] };
  type CandidateEvaluation = {
    contract: WeeklyExposureContractV2;
    visibleWorkouts: Workout[];
    evaluation: Section18EffectiveWeekEvaluation;
    craft: WeekCraftAssessment;
  };
  const search = searchWholeWeekRepairCandidates<CandidateState, CandidateEvaluation>({
    initial: { workouts: offered.workouts, repairs: initialRepairs },
    maxCandidates,
    trace: args.input.trace ?? currentAthleteActionTrace(),
    diagnosticBoundary: 'section18AcceptedWeekGateway',
    diagnosticWeekId: args.input.weekStart,
    diagnosticRejection: (assessment) => ({
      codes: [
        ...assessment.evaluation.evaluation.blockingViolations.map((finding) =>
          `${finding.code}:${finding.domain}`),
        // NAMED IN THE SAME LIST AS THE CONTRACT'S OWN. A rejection the log
        // cannot name is the shape `repairKinds` was added to end.
        ...assessment.evaluation.craft.blocking.map((finding) =>
          `${finding.ruleId}:craft`),
      ],
      invariant: Array.from(new Set([
        ...assessment.evaluation.evaluation.blockingViolations.map((finding) => finding.domain),
        ...(assessment.evaluation.craft.blocking.length > 0 ? ['week_craft'] : []),
      ])).sort().join(','),
    }),
    stateSignature: (candidate) => JSON.stringify(candidate.workouts.map((workout) => ({
      ...workout,
      exercises: workout.exercises.map((row) => ({ ...row, exercise: row.exercise?.name ?? null })),
    }))),
    assess: (candidate) => {
      let contract = cloneContract(baseContract);
      const resolver = args.input.resolveVisibleWorkouts ?? ((candidateWorkouts: readonly Workout[]) =>
        resolveFinalVisibleSection18Week({
          contract,
          workouts: candidateWorkouts,
          weekStart: args.input.weekStart,
          profile: args.input.profile,
          surfaces: args.input.surfaces,
        }));
      // Readers see the assembled week (facts included); the assembly is
      // re-applied to the resolver's OUTPUT so the projection's fact days are
      // byte-exact candidate facts no matter what any stage inside did.
      const visibleWorkouts = assembleWithFactDays(
        resolver(assembleWithFactDays(candidate.workouts)),
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
      // THE CRAFT TIER, ON THE SAME VISIBLE WEEK THE CONTRACT IS JUDGING.
      //
      // Two questions, two owners, one boundary: the evaluator asks whether the
      // week CONFORMS (counts, ceilings, floors, prohibitions), the craft tier
      // asks whether it reads like a coach wrote it (G-1, G-2, G+1, double-day
      // pairings, team training pretending to be recovery). Both must be true
      // for a candidate to be accepted, and both count toward the search's
      // preference order — so a repair that fixes the contract while breaking
      // the shape can no longer win.
      const craft = assessWeekCraft({
        contract,
        workouts: visibleWorkouts,
        weekStart: args.input.weekStart,
        profile: args.input.profile,
        governableDates,
      });
      return {
        accepted: evaluation.blockingViolations.length === 0 && craft.blocking.length === 0,
        blockingCount: evaluation.blockingViolations.length + craft.blocking.length,
        evaluation: { contract, visibleWorkouts, evaluation, craft },
      };
    },
    expand: (candidate, assessment) => {
      const evaluated = assessment.evaluation;
      const expiryCandidates = buildDerivedSessionExpiryCandidates({
        workouts: candidate.workouts,
        contract: evaluated.contract,
        weekStart: args.input.weekStart,
        activeFixtureDates: args.input.activeFixtureDates,
      }).map((expiry) => ({
        workouts: expiry.workouts,
        repairs: [...candidate.repairs, {
          kind: 'obsolete_derived_work_expired' as const,
          detail: `Expired ${expiry.expiries.length} obsolete system-derived session/component${expiry.expiries.length === 1 ? '' : 's'} before preservation scoring.`,
        }],
      }));
      const repairCandidates = localRepairCandidates({
        workouts: candidate.workouts,
        evaluation: evaluated.evaluation,
        craft: evaluated.craft,
        governableDates,
        contract: evaluated.contract,
        weekStart: args.input.weekStart,
        profile: args.input.profile,
        strengthTemplates: args.input.strengthTemplates,
        surfaces: args.input.surfaces,
        availableDayNumbers: profileAvailableDayNumbers({
          contract: evaluated.contract,
          weekStart: args.input.weekStart,
          profile: args.input.profile,
        }),
      }).map((repair) => ({
        workouts: repair.workouts,
        repairs: [...candidate.repairs, repair.repair],
      }));
      return [...expiryCandidates, ...repairCandidates];
    },
  });
  const selected = search.candidate;
  const selectedEvaluation = search.evaluation;
  // A CRAFT VIOLATION MAY FAIL A CANDIDATE; IT MAY NEVER VETO A FACT.
  //
  // The search exhausted, but the contract itself is satisfied — what is left
  // is a SHAPE the repair generators could not reach. Reporting that as
  // `impossible` would send the week on to the regenerate/fallback cascade and,
  // under a restoration, throw: a stored week built before this tier existed
  // would stop hydrating and the app would refuse to open on its own history.
  // So the week publishes and the violation is named in the repairs, where the
  // gateway's own log already reads the kinds.
  const craftOnlyShortfall =
    search.outcome === 'impossible' &&
    selectedEvaluation.evaluation.blockingViolations.length === 0 &&
    selectedEvaluation.craft.blocking.length > 0;
  const repairs = craftOnlyShortfall
    ? [...selected.repairs, {
        kind: 'craft_violation_disclosed' as const,
        detail: `Published with unrepaired Section 17 craft violation${selectedEvaluation.craft.blocking.length === 1 ? '' : 's'}: ${craftBlockingSummary(selectedEvaluation.craft.blocking)}.`,
      }]
    : selected.repairs;
  return {
    status: search.outcome === 'impossible' && !craftOnlyShortfall
      ? 'impossible'
      : repairs.some((repair) => repair.kind === 'regenerated_candidate')
        ? 'regenerated'
        : repairs.length > 0 ? 'repaired' : 'accepted',
    contract: selectedEvaluation.contract,
    canonicalWorkouts: assembleWithFactDays(selected.workouts),
    visibleWorkouts: selectedEvaluation.visibleWorkouts,
    evaluation: selectedEvaluation.evaluation,
    craft: selectedEvaluation.craft,
    repairs,
    attempts: search.candidatesEvaluated,
    failureSignature: search.outcome === 'impossible' && !craftOnlyShortfall
      ? signature(selectedEvaluation.evaluation)
      : null,
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
  const primary = resolveCandidate({ input, candidate: input });
  if (primary.status !== 'impossible') return traced(primary, 'primary');

  // THE :4688 ORDER's LAST STEP, and LAST is the whole point.
  //
  // This was first written as a normalisation beside the power budget, which
  // put it BEFORE the search — and a reduction taken before relocation ran
  // deleted the shortfall the relocation existed to answer, so the deletion
  // class's own relocation stopped happening (`relocated=undefined`). The
  // Bible's order is not decoration: reduce only what relocation and
  // substitution could not.
  //
  // So it runs here, after the search has exhausted, and only then. The
  // contract change cannot ride a search candidate because `assess` re-clones
  // the contract from the base every time; a second pass over the same
  // machinery is how a contract-level repair takes its turn in the order.
  const reduced = withDisplacedCapacityReduction({
    contract: input.contract,
    workouts: primary.visibleWorkouts,
    weekStart: input.weekStart,
    profile: input.profile,
  });
  if (reduced !== input.contract) {
    const result = resolveCandidate({
      input: { ...input, regenerate: undefined, safeFallback: undefined },
      candidate: { contract: reduced, workouts: input.workouts },
    });
    if (result.status !== 'impossible') return traced(result, 'displaced_capacity_reduced');
  }

  const regenerated = input.regenerate?.();
  if (regenerated) {
    const reboundRegenerated = {
      ...regenerated,
      workouts: rebindDerivedSessionProvenance({
        workouts: regenerated.workouts,
        contract: regenerated.contract,
        weekStart: input.weekStart,
      }),
    };
    const result = resolveCandidate({
      input: { ...input, regenerate: undefined, safeFallback: undefined },
      candidate: reboundRegenerated,
      inheritedRepairs: [...primary.repairs, {
        kind: 'regenerated_candidate',
        detail: 'The first deterministic candidate remained invalid; regenerated candidate entered the same gateway.',
      }],
    });
    if (result.status !== 'impossible') {
      return traced({ ...result, status: 'regenerated' }, 'regenerated');
    }
  }

  const fallback = input.safeFallback?.();
  if (fallback) {
    const reboundFallback = {
      ...fallback,
      workouts: rebindDerivedSessionProvenance({
        workouts: fallback.workouts,
        contract: fallback.contract,
        weekStart: input.weekStart,
      }),
    };
    const result = resolveCandidate({
      input: { ...input, regenerate: undefined, safeFallback: undefined },
      candidate: reboundFallback,
      inheritedRepairs: [...primary.repairs, {
        kind: 'safe_fallback_candidate',
        detail: 'Safe deterministic fallback entered the same gateway.',
      }],
    });
    if (result.status !== 'impossible') {
      return traced({ ...result, status: 'fallback' }, 'fallback');
    }
    return traced(result, 'fallback');
  }
  return traced(primary, 'primary');
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
