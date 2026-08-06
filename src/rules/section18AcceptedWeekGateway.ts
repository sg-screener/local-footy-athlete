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
  /** The week was not presenting the offer its contract declares; it is now. */
  | 'offer_presented'
  | 'offer_withdrawn'
  | 'core_conditioning_presented'
  | 'obsolete_derived_work_expired'
  | 'optional_work_removed_for_rest'
  | 'core_work_stacked_on_existing_stress_day'
  | 'athlete_removal_typed_reduction'
  | 'regenerated_candidate'
  | 'safe_fallback_candidate';

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
  const budget = ineligible
    ? 0
    : fixture && teamCount >= 2
      ? 0
      : fixture || teamCount >= 2
        ? 1
        : 2;
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

function signature(evaluation: Section18EffectiveWeekEvaluation): string {
  return evaluation.blockingViolations
    .map((finding) => `${finding.code}:${finding.domain}:${JSON.stringify(finding.actual)}`)
    .sort()
    .join('|');
}

function localRepairCandidates(args: {
  workouts: readonly Workout[];
  evaluation: Section18EffectiveWeekEvaluation;
  contract: WeeklyExposureContractV2;
  weekStart: string;
  profile?: OnboardingData | null;
}): Array<{ workouts: Workout[]; repair: Section18WeekRepair }> {
  const restShort = args.evaluation.blockingViolations.some((finding) =>
    finding.domain === 'full_rest');
  const hardBreach = args.evaluation.blockingViolations.some((finding) =>
    finding.code === 'hard_day_breach');
  return [
    ...(restShort ? repairOptionalRestCandidates(args) : []),
    ...(hardBreach
      ? repairByStackingCandidates({ ...args, requireHardTarget: true })
      : []),
    ...(restShort
      ? repairByStackingCandidates({ ...args, requireHardTarget: false })
      : []),
    ...repairCoreConditioningShortfallCandidates(args),
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
  const shortfall = args.evaluation.contract.conditioning.core.unresolvedMinimumShortfall ?? 0;
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
  // A persisted athlete deletion is an accepted-state input, not a render
  // filter. Apply it before lifecycle, safety and repair so those owners can
  // never restore content onto the prohibited target and then lose it again
  // only at the final visible projection.
  const constrainedCandidateWorkouts = applyUserRemovalConstraintsToWeek({
    workouts: args.candidate.workouts,
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
  };
  const search = searchWholeWeekRepairCandidates<CandidateState, CandidateEvaluation>({
    initial: { workouts: offered.workouts, repairs: initialRepairs },
    maxCandidates,
    trace: args.input.trace ?? currentAthleteActionTrace(),
    diagnosticBoundary: 'section18AcceptedWeekGateway',
    diagnosticWeekId: args.input.weekStart,
    diagnosticRejection: (assessment) => ({
      codes: assessment.evaluation.evaluation.blockingViolations.map((finding) =>
        `${finding.code}:${finding.domain}`),
      invariant: Array.from(new Set(assessment.evaluation.evaluation.blockingViolations
        .map((finding) => finding.domain))).sort().join(','),
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
      const visibleWorkouts = resolver(candidate.workouts);
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
      return {
        accepted: evaluation.blockingViolations.length === 0,
        blockingCount: evaluation.blockingViolations.length,
        evaluation: { contract, visibleWorkouts, evaluation },
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
        contract: evaluated.contract,
        weekStart: args.input.weekStart,
        profile: args.input.profile,
      }).map((repair) => ({
        workouts: repair.workouts,
        repairs: [...candidate.repairs, repair.repair],
      }));
      return [...expiryCandidates, ...repairCandidates];
    },
  });
  const selected = search.candidate;
  const selectedEvaluation = search.evaluation;
  return {
    status: search.outcome === 'impossible'
      ? 'impossible'
      : selected.repairs.some((repair) => repair.kind === 'regenerated_candidate')
        ? 'regenerated'
        : selected.repairs.length > 0 ? 'repaired' : 'accepted',
    contract: selectedEvaluation.contract,
    canonicalWorkouts: selected.workouts,
    visibleWorkouts: selectedEvaluation.visibleWorkouts,
    evaluation: selectedEvaluation.evaluation,
    repairs: selected.repairs,
    attempts: search.candidatesEvaluated,
    failureSignature: search.outcome === 'impossible'
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
