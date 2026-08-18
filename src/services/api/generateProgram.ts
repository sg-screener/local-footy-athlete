import {
  OnboardingData,
  TrainingProgram,
  Microcycle,
  type DayOfWeek,
  type ConditioningEquipmentModality,
  type Workout,
  type WeekKind,
} from '../../types/domain';
import {
  buildWorkoutsFromCoach,
  type CoachGeneratedWorkoutInput,
} from '../../data/defaultProgram';
import { bakeMicrocycleStrengthProgression } from '../../utils/sessionResolver';
import { previousBlockBoundsISO, WEEKS_PER_BLOCK } from '../../utils/programBlockState';
import { effectiveAnchorParticipation } from '../../rules/weeklyExposureContractV2';
import {
  applyBlockBoundaryConditioning,
  applyBlockBoundaryProgression,
  applyBlockBoundarySetAdditions,
  applyBlockBoundaryVolume,
  buildBlockBoundaryExplanation,
  buildBlockBoundaryReductionExplanation,
  applyBlockBoundaryConditioningAdvance,
  decideBlockBoundaryConditioning,
  decideBlockBoundaryConditioningAdvance,
  decideBlockBoundaryLoads,
  decideBlockBoundarySetAdditions,
  decideBlockBoundaryVolume,
  progressedFromOwnHistory,
  readBlockHistory,
  snapshotAuthoredSets,
  type BlockBoundaryConditioningAdvance,
  type BlockBoundaryConditioningDecision,
  type BlockBoundaryLiftDecision,
  type BlockBoundaryVolumeDecision,
} from '../../rules/blockBoundaryProgression';
import { composedIdentityFor } from '../../rules/composedRowLegality';
import { deriveProfileReadiness } from '../../utils/readiness';
import {
  onboardingToCoachingInputs,
  type CoachingInputs,
  type CoachingPlan,
  type AIConstraints,
} from '../../utils/coachingEngine';
import { isoDateForWeekday, todayISOLocal } from '../../utils/appDate';
import { missingRequiredProfileFields } from '../../utils/onboardingSteps';
import { getAthletePrefs } from '../../store/athletePreferencesStore';
import { useCoachUpdatesStore, type ActiveConstraint } from '../../store/coachUpdatesStore';
import type { TemporarySourceFact } from '../../rules/temporarySourceFact';
import { useReadinessStore } from '../../store/readinessStore';
import {
  buildBlockWeekStates,
  computeBlockBounds,
  getMondayISOForDate,
  type BlockBounds,
} from '../../utils/programBlockState';
import {
  applyGenerationConstraintsToProfile,
  buildGenerationConstraintContext,
  mergeAthletePrefsWithGenerationConstraints,
  type GenerationConstraintContext,
} from '../../utils/generationConstraints';
import { buildReadinessActiveConstraints } from '../../utils/readinessConstraints';
import type { ReadinessSignal } from '../../utils/readiness';
import type { EquipmentTag } from '../../data/exercisePools';
import {
  getClientEnvConfig,
  logMissingClientEnv,
} from '../../config/env';
import { logger } from '../../utils/logger';
import {
  resolveEquipmentAvailability,
  resolveEquipmentCapabilities,
  resolveEffectiveEquipmentWindow,
  type ResolvedEquipmentCapabilities,
} from '../../utils/equipmentAvailability';
import { getSessionComponents } from '../../utils/sessionComponents';
import type { StrengthIntent } from '../../rules/strengthPatternContributions';
import {
  resolveConditioningSubstitutionPolicy,
  resolveWeeklyConditioningFeasibility,
} from '../../rules/conditioningFeasibility';
import { stampSection18GovernedBoundary } from '../../rules/weeklyExposureContractV2';
import { storedGameAnchor } from '../../rules/gameAnchor';
import { composeWeek, kitUnachievablePatterns } from '../../rules/composeWeek';
import { resolveWeekExclusions } from '../../rules/exerciseExclusions';
import { composedPlannedDaysFrom } from '../../rules/composerPlannedDays';
import { schedulerPlannedDays } from '../../rules/schedulerPlannedDays';
import { scheduleToCoachingPlan } from '../../rules/scheduleToCoachingPlan';
import { materialiseAuthoredSessions } from '../../rules/materialiseAuthoredSessions';
import { calculateCapacity } from '../../utils/coachingEngine';
import { resolveTrainingAgePolicy } from '../../rules/trainingAgePolicy';
import type { OffseasonSubphase } from '../../rules/offseasonSubphase';
import { scheduleRefused, scheduleWeek } from '../../rules/weeklyScheduler';
import { WeeklyScheduleRefusedError, ageFromRange, offseasonBlockFrom, weeklySchedulerInputsFrom } from '../../rules/weeklySchedulerInputs';
// THE DELOAD OWNER, READ NOT REIMPLEMENTED — the same two resolvers the
// retained adapter uses, so a composed week answers to one table and not a
// second copy of it.
import {
  resolveDeloadWeekPolicy,
  resolveDoorDeloadPolicy,
  type DeloadWeekPolicy,
} from '../../rules/deloadWeekRules';
import { isDateInReadinessDeloadWindow } from '../../rules/readinessIllnessLaw';
import { generatedWeekContractFrom } from '../../rules/generatedWeekContract';
import {
  generatedWeekFailureSignature,
  validateGeneratedWeek,
  type GeneratedWeekFinding,
} from '../../rules/validateGeneratedWeek';
import { materialiseComposedWeek } from '../../rules/materialiseComposedWeek';
import { assembleAuthoredWeek } from '../../rules/assembleAuthoredWeek';
import { awaySpansFromConstraints } from '../../rules/awaySpans';
import { withCraftSafeTopUps } from '../../rules/section18CraftTier';
import type { AcceptedStateOperationKind } from '../../store/acceptedStateTransaction';
import { applyOptionalTopUps } from '../../utils/optionalTopUpPlacement';
import { weakPointFocusFor } from '../../rules/weakPointFocus';
import {
  stampPlannerDerivedSessionProvenance,
} from '../../rules/derivedSessionProvenance';
import {
  getProgrammingRoleBias,
  normalizeOnboardingRole,
  normalizeRoleBucket,
  programmingRoleBiasLabel,
  roleBucketLabel,
} from '../../utils/roleBuckets';
import {
  resolveSeasonPhaseClock,
  type SeasonPhaseClock,
  type SeasonPhaseClockResolution,
} from '../../rules/seasonPhaseClock';
import type { FixtureConditionedAvailability } from '../../rules/fixtureConditionedAvailability';
import { validateWorkoutAgainstActiveConstraints } from '../../utils/postGenerationConstraintValidation';
import { collapseWorkoutToRest } from '../../utils/workoutContent';
import {
  ExerciseVocabularyViolation,
} from '../../utils/exerciseCanonicalisation';
import { selectableVocabularyGroups } from '../../data/selectableExerciseVocabulary';

/**
 * Kinds of program-generation failure — used by the UI to decide whether
 * to offer retry, and which friendly copy to show. Raw payloads (HTML,
 * 500 stack traces, etc.) must NEVER flow into user-facing error text.
 */
export type ProgramGenErrorKind =
  | 'server_outage'   // 5xx, 503, Cloudflare/Supabase HTML "temporarily unavailable"
  | 'overloaded'     // coach LLM provider overloaded
  | 'unauthorized'   // 401/403 — config problem
  | 'bad_response'   // 200 but shape is wrong / empty
  | 'network'        // fetch threw (offline, DNS, timeout)
  | 'missing_required_profile' // onboarding never collected a required answer
  | 'unknown';

export class ProgramGenError extends Error {
  public readonly kind: ProgramGenErrorKind;
  public readonly canRetry: boolean;
  public readonly userMessage: string;
  public readonly diagnostic: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    kind: ProgramGenErrorKind,
    userMessage: string,
    diagnostic: string,
    canRetry: boolean,
    details?: Record<string, unknown>,
  ) {
    // Parent Error `message` is the USER-FACING string so any accidental
    // render (e.g. `err.message`) still produces safe copy instead of raw HTML.
    super(userMessage);
    this.name = 'ProgramGenError';
    this.kind = kind;
    this.canRetry = canRetry;
    this.userMessage = userMessage;
    this.diagnostic = diagnostic;
    this.details = details;
  }
}

/**
 * The honest refusal for a program that reached acceptance carrying an exercise
 * the app cannot cue.
 *
 * Sam ruling (device run 5): a loud generation-contract violation, never a
 * silent cueless card. The athlete is told the program was withheld and offered
 * a rebuild — the generation prompt now carries the vocabulary, so a retry is
 * genuinely likely to succeed. The offending names stay in the developer
 * diagnostic; athlete-facing copy never carries internal identifiers.
 */
export function programGenErrorForCuelessCards(
  violation: ExerciseVocabularyViolation,
  details?: Record<string, unknown>,
): ProgramGenError {
  return new ProgramGenError(
    'bad_response',
    'Some exercises came back without coaching cues, so I’ve held your program back '
      + 'rather than show you a session with blank instructions. Please try again.',
    `cueless exercise names at program acceptance: ${violation.unresolved.join(', ')}`,
    true,
    { ...details, unresolvedExerciseNames: violation.unresolved },
  );
}

export interface GenerateProgramFromProfileOptions {
  todayISO?: string;
  /** 1-based training block number. Defaults to 1 for a fresh generated block. */
  blockNumber?: number;
  /**
   * THE ATHLETE'S RECORDED HISTORY, FED TO THE AUTHORING-TIME FREEZE.
   *
   * Sam, 2026-08-16: *"feed the real persisted history, selected loads and block
   * state into the existing generation-time progression owner."*
   *
   * ⚠ **THE FREEZE ALWAYS EXISTED; IT WAS FED NOTHING.** Until this landed the
   * `bakeMicrocycleStrengthProgression` call below passed `sessionFeedback: {}`,
   * `weightOverrides: {}`, `workoutHistory: []`, `blockState: null` — four empty
   * arguments — so it baked a history-free load into storage while the screen,
   * reading the live store, could derive a different one. That was the whole of
   * the stored-vs-visible split.
   *
   * **Absent means "read the live store"**, matching how `temporarySourceFacts`
   * already behaves here, so the rollover path inherits this with no threading.
   * A caller passes them explicitly only to author against a stated history —
   * which is what makes the boundary testable without a live store.
   */
  /**
   * RECORDED block selections, most recent first.
   *
   * **Absent means "read the live store"**, matching how `temporarySourceFacts`
   * already behaves here. Boot and rollover pass them EXPLICITLY, which is what
   * makes the selection history testable without a live store — and what stops
   * the domain selector ever reaching for one.
   */
  selectionHistory?: readonly import('../../rules/blockExerciseSelection').BlockExerciseSelection[];
  /**
   * Record this block's selections durably? **DEFAULT FALSE.**
   *
   * ⚠ **RECORDING BELONGS TO ACCEPTANCE, NOT TO GENERATION.** Sam: *"add one
   * typed BlockExerciseSelection history record at BLOCK ACCEPTANCE."* This
   * function is also called speculatively — `weeklyCommitmentLegality` asks
   * "would a 2-day week even build?", `postGenerationConstraintValidation`
   * re-authors to check itself — and a probe that writes history corrupts it.
   *
   * MEASURED: with recording on by default, an exclusion suite that probed
   * blocks 3 and 4 while an exercise was excluded made those probes the
   * athlete's permanent history, and restoring the exercise brought it back in
   * NO block. The callers that COMMIT a program opt in; probes stay silent.
   *
   * ⚠ **AND THE CALLER MUST SAY WHICH KIND OF WRITE IT IS.** A boolean could
   * only say "write"; it could not say whether this caller DECIDES the block or
   * merely RE-DERIVES it, and that distinction is the whole defect measured on
   * 2026-08-18:
   *
   *   - `'author'` — this door decides the block (onboarding, acceptance,
   *     rollover). It may replace the block's rows, because it is the layer
   *     entitled to change what the block chose.
   *   - `'replay'` — this caller reconstructs a block it did not decide (a boot,
   *     a temporary-fact regeneration). It may record a block that has NEVER
   *     been recorded, and it may NEVER re-author one.
   *
   * The boot passed the old `true` and so re-recorded the block under whatever
   * exclusions happened to be live at launch. A reversible, dated `today_only`
   * removal was thereby laundered into a permanent generation INPUT and the
   * athlete's original main lift was destroyed — `recordBlockSelections`
   * replaces a block's rows by design, so the original was not shadowed but
   * lost. The recorder exists to stop a boot re-deriving a different past when
   * exclusions change; the boot was defeating it with the recorder's own pen.
   *
   *   - `false` / absent — a PROBE. `weeklyCommitmentLegality` asking "would a
   *     2-day week even build?" must never leave a trace in the athlete's
   *     history, which is why the default is silence.
   */
  recordSelections?: 'author' | 'replay' | false;
  progressionHistory?: {
    sessionFeedback?: Readonly<Record<string, import('../../store/programStore').SessionFeedback>>;
    weightOverrides?: Readonly<Record<string, Record<string, number | null>>>;
    blockState?: import('../../utils/programBlockState').StoredProgramBlockState | null;
    /**
     * EVERY ACCEPTED BLOCK'S OWN RECORD — its number and what it required of the
     * athlete — keyed by block start.
     *
     * The block-boundary completion denominator (Sam, 2026-08-17). Stated by the
     * caller that owns the grid — `weekRebuild` at the rollover and
     * `quiescentBoot` at a relaunch both state the same persisted map, so both
     * paths reach the identical value.
     *
     * ⚠ **NO FALLBACK.** An absent entry means this authoring has no accepted
     * previous block to measure against — block 1, or a speculative probe — and
     * the honest denominator is then 0, which makes the completion gate
     * unreachable rather than measuring the athlete against a number nobody
     * delivered. Substituting `plan.coreSessions` or the contract's
     * `strength.targetCount` here is explicitly forbidden: both were measured
     * wrong on a real athlete (see `deriveAcceptedBlockStrengthRequirement`).
     */
    acceptedBlocks?: Readonly<Record<string,
      import('../../store/programStore').AcceptedBlockRecord>>;
  };
  /**
   * The Monday this block began on, stated by the caller that owns the grid
   * (the stored block anchor, via `getBlockPositionForGeneration`).
   *
   * §18 ownership reassessment (2026-08-05, defect D1). Generation used to take
   * the block NUMBER from that anchor and re-derive the block START from
   * `todayISO`. The two agree only when `todayISO` is itself a block start, so
   * re-authoring any later week of a block called it week 1 — and because the
   * strength allocator alternates on `weekNumber % 2`, the mirror week's
   * patterns were planned onto the real week. That is what refused a sick
   * athlete's report: the composite week covered two patterns instead of four
   * and §18 rejected it as `pattern_imbalance`.
   *
   * Omitting it keeps the fresh-block meaning — a first generation genuinely
   * starts its block on the athlete's own week — which is exactly the contract
   * `blockNumber` already has. Stating it and `blockNumber` from the same read
   * is what makes the two owners one.
   */
  blockStartISO?: string;
  /**
   * Active injury/readiness constraints to feed into generation before the
   * week is built. When omitted, generation reads the current local stores.
   */
  activeConstraints?: readonly ActiveConstraint[];
  readinessSignal?: ReadinessSignal | null;
  generationConstraints?: GenerationConstraintContext;
  /**
   * Pending temporary source facts to mint the week mode from, supplied by an
   * authoring caller mid-transaction (the facts are not yet in the store). When
   * omitted, generation reads the current accepted facts. Threaded to the
   * per-week `buildGenerationConstraintContext` so a severe illness derives the
   * illness_recovery mode during a scoped-regen commit.
   */
  temporarySourceFacts?: readonly TemporarySourceFact[] | null;
  /**
   * The athlete's pool preferences (exclusions and pins).
   *
   * L14 PAYMENT (Sam ratified 2026-07-30, Stage B stage 1 Task D). Domain
   * logic must be callable from a plain test with explicit inputs, and
   * generation had NO injection point for this: it read the store
   * unconditionally at both call sites below, so a caller could not generate a
   * week for a stated athlete without first mutating global state.
   *
   * The store read survives only as the BOUNDARY DEFAULT — omitting the option
   * is the same read the engine did before, which is why the stage-B generation
   * differential predicted (and measured) ZERO golden movement for this change.
   */
  athletePrefs?: AthletePoolPrefsArg;
  /** Explicit continuity input for pure callers; normal app paths use the live persisted program. */
  previousProgram?: TrainingProgram | null;
  seasonPhaseClock?: SeasonPhaseClock | null;
  /** Shared target-week availability result; fixture paths must not rebuild it ad hoc. */
  targetWeekAvailability?: FixtureConditionedAvailability;
  /** undefined = profile fixture, null = bye/no fixture, day = proposed fixture. */
  targetFixtureDay?: DayOfWeek | null;
  /** Build only the target week when the caller needs a contract/fallback candidate. */
  microcycleLimit?: 1 | 4;
  /**
   * Author the remainder AS a remainder. When the generated week contains
   * `governedFromISO`, days before it are HISTORY: the candidate week pins
   * `pinnedHistoryWorkouts` (what the athlete actually has/did) in their
   * place, the week contract is stamped with the boundary, and pre-boundary
   * anchors keep their settled participation. §18 acceptance then evaluates
   * the true week — delivered history plus the authored remainder — instead
   * of a fictional whole week whose first days will be discarded. See
   * docs/SECTION18_DELIVERED_VS_REMAINING_REASSESSMENT_2026-07-24.md
   * Addendum B2.
   */
  remainderBoundary?: {
    governedFromISO: string;
    pinnedHistoryWorkouts: readonly Workout[];
  } | null;
  /**
   * Whether an unacceptable week is fatal HERE, in the vocabulary
   * `acceptedStateTransaction` already ratified.
   *
   * §18 ownership reassessment (2026-08-05, defect D3). Absent means
   * `restoration` — strict, exactly as generation has always behaved. A caller
   * that is carrying out a FORWARD ATHLETE DECISION states `forward_decision`,
   * and generation then publishes the best achievable week instead of throwing:
   * it is not generation's place to veto a fact the athlete stated, and the
   * transaction downstream already owns accept-and-disclose.
   */
  weekAcceptance?: AcceptedStateOperationKind;
}

type CoachGeneratedWorkouts = Parameters<typeof buildWorkoutsFromCoach>[0];
type AthletePoolPrefsArg = Parameters<typeof buildWorkoutsFromCoach>[5];

function dateAtNoonISO(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00`).toISOString();
}

/** One owner of the Monday-first weekday-to-date rule. */
const dateForWeekday = isoDateForWeekday;

/**
 * The game's day-of-week, for the top-up's caps.
 *
 * Read from the WEEK first — a Game session in the built week is the fact — and
 * from the profile's usual game day only when the week has none, so a virtual
 * Saturday still protects its G-1 for the authored Gunshow.
 */
function gameDayOfWeekFor(
  workouts: readonly Workout[],
  profile: OnboardingData,
): number | null {
  const game = workouts.find((workout) => workout.workoutType === 'Game');
  if (game) return game.dayOfWeek;
  const usual = storedGameAnchor(profile);
  return usual ? DAY_MAP[usual] ?? null : null;
}

/**
 * Days the top-up may place on.
 *
 * TWO EXCLUSIONS, both of them the athlete's own inputs rather than the app's
 * preferences. Days they did not name as training days are not the app's to fill —
 * an optional session on an excluded day overrides a stated answer. And days before
 * the governed boundary are history: the week's earlier days are pinned, and adding
 * a session to one would be the app editing a day that has already happened.
 */
function topUpCandidateDays(args: {
  profile: OnboardingData;
  weekStart: string;
  governedFromISO: string | null;
}): number[] {
  const declared = (args.profile.preferredTrainingDays ?? [])
    .map((day) => DAY_MAP[day])
    .filter((day): day is number => typeof day === 'number');
  return [0, 1, 2, 3, 4, 5, 6].filter((day) => {
    if (declared.length > 0 && !declared.includes(day)) return false;
    if (args.governedFromISO &&
      dateForWeekday(args.weekStart, day) < args.governedFromISO) return false;
    return true;
  });
}

function dateFromISO(todayISO: string): Date {
  return new Date(`${todayISO}T12:00:00`);
}

/**
 * The block this generation belongs to: STATED by the caller when it owns the
 * grid, derived from the target date only when nobody does.
 *
 * §18 ownership reassessment (2026-08-05, D1). The re-derivation was never
 * wrong for a fresh block — it is wrong for a caller that already knows, which
 * is every mid-block regen. One function so both generation entry points read
 * week identity from the same place.
 */
function generationBlockBounds(
  options: GenerateProgramFromProfileOptions,
  effectiveTodayISO: string,
): BlockBounds {
  // computeBlockBounds week-aligns and spans four weeks from whatever day it is
  // given, so handing it the stated block start yields that block exactly.
  return computeBlockBounds(dateFromISO(options.blockStartISO ?? effectiveTodayISO));
}

function currentPersistedProgram(
  options: GenerateProgramFromProfileOptions,
): TrainingProgram | null {
  if (options.previousProgram !== undefined) return options.previousProgram;
  try {
    // Dynamic import avoids making the persisted store a generation owner.
    // It supplies continuity only; the pure phase-clock resolver owns policy.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../../store/programStore').useProgramStore.getState().currentProgram ?? null;
  } catch {
    return null;
  }
}

/**
 * Phase used only to keep diagnostics renderable when the athlete never
 * answered. Never reaches a generated program.
 */
const DIAGNOSTICS_PHASE_WHEN_UNANSWERED = 'Pre-season' as const;

/**
 * The athlete's season phase, or a refusal.
 *
 * Generation used to substitute Pre-season for a missing answer. When
 * onboarding lost the answer, an in-season athlete silently received a
 * pre-season program and had no way to tell it was wrong
 * (docs/ONBOARDING_PERSISTENCE_DIAGNOSIS_2026-07-24.md §2). Generation now
 * refuses; Review and Complete catch the refusal and send the athlete back to
 * the step that owns the answer.
 */
export function generationSeasonPhaseOrThrow(
  profile: OnboardingData,
): NonNullable<OnboardingData['seasonPhase']> {
  if (!profile.seasonPhase) {
    throw new ProgramGenError(
      'missing_required_profile',
      "I still need to know where you are in the season before I can build your program.",
      'generation refused: onboarding never collected seasonPhase',
      false,
      { missingRequired: missingRequiredProfileFields(profile) },
    );
  }
  return profile.seasonPhase;
}

/**
 * The athlete's equipment input, or a refusal — the seasonPhase rule applied
 * to equipment (Sam's ruling 2, 2026-07-31: generation does not run without an
 * equipment answer).
 *
 * "Input" is the typed `equipmentAnswer` OR a legacy checklist lifted at read
 * (L15): existing installs keep generating on the kit they actually recorded.
 * What no longer exists is the third case — a profile with NOTHING that used
 * to inherit a commercial-gym kit from a constant. That profile is refused,
 * exactly as a missing seasonPhase is, and the flow's required Equipment step
 * means no athlete can reach generation in that state through the app.
 */
export function generationEquipmentInputOrThrow(
  profile: OnboardingData,
  resolved: ResolvedEquipmentCapabilities,
): ResolvedEquipmentCapabilities {
  if (resolved.source === 'unanswered_floor') {
    throw new ProgramGenError(
      'missing_required_profile',
      'I still need to know what equipment you can train with before I can build your program.',
      'generation refused: no equipment answer and no legacy equipment selection',
      false,
      { missingRequired: missingRequiredProfileFields(profile) },
    );
  }
  return resolved;
}

function generationPhaseResolution(
  profile: OnboardingData,
  blockStartISO: string,
  options: GenerateProgramFromProfileOptions,
): SeasonPhaseClockResolution {
  const selectedPhase = generationSeasonPhaseOrThrow(profile);
  const previousProgram = currentPersistedProgram(options);
  return resolveSeasonPhaseClock({
    selectedPhase,
    targetWeekStartISO: blockStartISO,
    persistedClock: options.seasonPhaseClock ?? previousProgram?.seasonPhaseClock,
    legacyProgram: previousProgram,
  });
}

/**
 * Build the exact coaching plan used by the first generated microcycle.
 *
 * Pre-season/off-season policies can change by block week. The edge prompt
 * and the client normaliser must therefore share the same block-state input;
 * otherwise the model can fill a mid-block mixed session which the client
 * later interprets as an early-block standalone conditioning day.
 */
export function buildInitialGeneratedCoachingPlan(args: {
  coachingInputs: CoachingInputs;
  profile: Pick<OnboardingData, 'seasonPhase'>;
  todayISO?: string;
  blockNumber?: number;
  seasonPhaseClock: SeasonPhaseClock;
}): CoachingPlan {
  const effectiveTodayISO = args.todayISO ?? todayISOLocal();
  const { blockStart } = computeBlockBounds(dateFromISO(effectiveTodayISO));
  const [firstState] = buildBlockWeekStates({
    blockStartISO: blockStart,
    blockNumber: args.blockNumber ?? 1,
    seasonPhase: args.profile.seasonPhase,
    seasonPhaseClock: args.seasonPhaseClock,
  });
  // ── THE SECOND PRODUCER CUTOVER ─────────────────────────────────────────
  //
  // This built the plan with `buildCoachingPlan` and was **180 of the corpus's 572
  // legacy-planner executions** — one per generated world. It now builds the same
  // `CoachingPlan` shape from the scheduler, the specialists and the connector,
  // exactly as `buildGeneratedMicrocycles` does.
  const inputs = args.coachingInputs;
  const weekStartISO = firstState?.weekStart ?? blockStart;
  const schedInputs = coachingInputsToSchedulerInputs(inputs, {
    weekStartISO,
    offseasonSubphase: firstState?.phaseResolution.offseasonSubphase ?? null,
  });
  const sched = scheduleWeek(schedInputs);
  if (scheduleRefused(sched)) throw new WeeklyScheduleRefusedError(sched);
  const { level: capacity, factors } = calculateCapacity(inputs);
  const agePolicy = resolveTrainingAgePolicy(inputs.experienceLevel);
  const materialised = materialiseAuthoredSessions({
    schedule: sched,
    facts: {
      weekStartISO,
      miniCycleNumber: firstState?.miniCycleNumber,
      capacity,
      isBeginner: agePolicy.level === 'new',
      experienced: agePolicy.level !== 'new',
      powerGoalNudge: false,
      injuries: (inputs.injuries ?? []) as never,
      runOnly: false,
      phase: inputs.seasonPhase as never,
      offseasonSubphase: firstState?.phaseResolution.offseasonSubphase ?? null,
    },
    gameDay: schedInputs.gameDay,
  });
  return scheduleToCoachingPlan({
    schedule: sched,
    materialised,
    coachingInputs: inputs,
    capacity,
    capacityFactors: factors,
    offseasonSubphase: firstState?.phaseResolution.offseasonSubphase ?? undefined,
    preseasonSubphase: firstState?.phaseResolution.preseasonSubphase ?? undefined,
    section18Identity: {
      seasonPhase: inputs.seasonPhase,
      blockNumber: firstState?.miniCycleNumber ?? null,
      weekInBlock: firstState?.weekInBlock ?? null,
      globalWeek: firstState?.weekNumber ?? null,
      phaseWeek: firstState?.phaseWeekNumber ?? null,
      phaseEntryWeekStartISO: firstState?.phaseClock.phaseEntryWeekStartISO ?? null,
      phaseClockSelectedPhase: firstState?.phaseClock.selectedPhase ?? null,
      phaseWeekProvenance: firstState?.phaseResolution.provenance ?? 'legacy_unknown',
      weekKind: firstState?.weekKind,
      participationProvenance: 'derived_healthy_unrestricted',
      currentProductionClaimsAnchorCredit: true,
    } as never,
    clubNights: schedInputs.clubNights,
    gameDays: schedInputs.gameDay === null ? [] : [schedInputs.gameDay],
    v1Input: {
      seasonPhase: inputs.seasonPhase,
      capacity,
      selectedDayNumbers: [...schedInputs.gymAccessDays],
      teamTrainingDayNumbers: [...schedInputs.clubNights],
      hasGame: schedInputs.gameDay !== null,
      gameDay: schedInputs.gameDay,
      weekKind: firstState?.weekKind,
      offseasonSubphase: firstState?.phaseResolution.offseasonSubphase ?? null,
      preseasonSubphase: firstState?.phaseResolution.preseasonSubphase ?? null,
      readinessDeloaded: inputs.generationConstraints?.readiness?.deloaded === true,
      maxStrengthSessions: agePolicy.maxCoreSessions,
      profileInjuries: inputs.injuries ?? [],
      activeInjuries: inputs.generationConstraints?.injuries,
      byeMode: inputs.byeMode,
      weekModeOverride: inputs.generationConstraints?.weekMode,
    } as never,
  });
}

const SCHED_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday'];

/** `CoachingInputs` → scheduler inputs. Translation only, no decisions. */
function coachingInputsToSchedulerInputs(
  inputs: CoachingInputs,
  args: { weekStartISO: string; offseasonSubphase: OffseasonSubphase | null },
) {
  const toNumber = (name: unknown): number | null => {
    const index = SCHED_DAY_NAMES.indexOf(String(name ?? ''));
    return index < 0 ? null : index;
  };
  const nums = (list: readonly unknown[] | undefined): number[] =>
    (list ?? []).map(toNumber).filter((n): n is number => n !== null);
  return {
    weekStartISO: args.weekStartISO,
    phase: inputs.seasonPhase as never,
    offseasonBlock: offseasonBlockFrom(args.offseasonSubphase),
    gymAccessDays: nums(inputs.selectedDays),
    clubNights: nums(inputs.teamTrainingDays),
    gameDay: inputs.hasGame ? toNumber(inputs.gameDay) : null,
    // **ALWAYS RECURRING.** `hasGame` + a usual game day means there was a
    // fixture last week too, so a Sunday game makes Monday G+1. Nothing in
    // `CoachingInputs` can say "first fixture ever", so nothing here claims it.
    fixtureRecurrence: 'recurring' as const,
    age: ageFromRange((inputs as { ageRange?: never }).ageRange),
    readiness: {
      lowReadiness: inputs.generationConstraints?.readiness?.deloaded === true,
      highReadiness: false, lowFatigue: false, consistentlyCompletesThree: false,
    },
    unavailableDays: [] as number[],
  };
}

/**
 * THE LIVE TRIPS OVER THE WEEK BEING PLANNED — SEAT_INBOX item 30.
 *
 * Read straight off the active constraints, because a `travel` constraint IS a
 * span: `startDate` to `expiresAt`, both already published by
 * `scheduleProjection`. A constraint with no end is not a trip and is skipped —
 * an open horizon would take the club off the calendar forever.
 *
 * MOVED TO `rules/awaySpans.ts` ON 2026-08-13 (item 61, sighting 3, seat
 * `vocab`), AND ITS `any[]` WENT WITH IT. This read
 * `type`/`startDate`/`expiresAt` off an untyped array while the derived-week
 * contract read `factKind`/`effectiveFrom`/`effectiveUntil` off the typed fact
 * — one trip, two word-lists, no field name in common, and nothing that could
 * notice if a rename broke one of them. The owner's parameter is now
 * `ActiveConstraint`, so those field names are compiler-checked.
 */

/**
 * THE SPANS WHERE THE CLUB IS SHUT — SEAT_INBOX item 31 part 5.
 *
 * Same reading as the trip above, DIFFERENT REACH, and the difference is the
 * whole reason it is a second function rather than a second `scheduleKind` in
 * the same filter. Away drops the team night AND the fixture; the Christmas
 * break drops the team night ONLY — the athlete is home, and a game he typed in
 * himself over the break is his own fact.
 *
 * AN OPEN END IS KEPT, NOT SKIPPED. `awaySpansFromConstraints` requires an
 * `expiresAt` because an endless trip would take the club off forever. Here the
 * open end is the ANSWER: on 10 December the athlete knows when his last
 * session is and nobody knows when the club reopens — Sam: *"that way the app
 * isn't guessing"*. The January question is what closes it, and until then
 * `until: null` is exactly true.
 */
function noTeamTrainingSpansFromConstraints(
  constraints: readonly any[] | undefined,
): { from: string; until: string | null }[] {
  return (constraints ?? [])
    .filter((constraint) => constraint?.type === 'schedule' &&
      constraint?.scheduleKind === 'no_team_training' &&
      constraint?.status !== 'resolved' &&
      typeof constraint?.startDate === 'string')
    .map((constraint) => ({
      from: String(constraint.startDate).slice(0, 10),
      until: typeof constraint.expiresAt === 'string'
        ? String(constraint.expiresAt).slice(0, 10)
        : null,
    }));
}

function collectActiveConstraintsForGeneration(
  options: GenerateProgramFromProfileOptions,
  todayISO: string,
): ActiveConstraint[] {
  const accepted = require('../../store/programStore').useProgramStore.getState()
    .acceptedMaterialContext;
  const hasCanonicalAcceptedContext = (accepted?.revision ?? 0) > 0;
  const storedConstraints = options.activeConstraints ??
    (hasCanonicalAcceptedContext
      ? accepted?.activeConstraints ?? []
      : useCoachUpdatesStore.getState().activeConstraints ?? []);
  const readinessSignal = options.readinessSignal !== undefined
    ? options.readinessSignal
    : hasCanonicalAcceptedContext
      ? accepted?.readinessSignalsByDate?.[todayISO] ?? null
      : useReadinessStore.getState().signalsByDate?.[todayISO] ?? null;
  const readinessConstraints = buildReadinessActiveConstraints(readinessSignal);
  const byId = new Map<string, ActiveConstraint>();
  for (const constraint of storedConstraints) byId.set(constraint.id, constraint);
  for (const constraint of readinessConstraints) byId.set(constraint.id, constraint);
  return Array.from(byId.values());
}

function resolveGenerationConstraints(
  options: GenerateProgramFromProfileOptions,
  todayISO: string,
): GenerationConstraintContext | undefined {
  if (options.generationConstraints) return options.generationConstraints;
  const activeConstraints = collectActiveConstraintsForGeneration(options, todayISO);
  return buildGenerationConstraintContext({
    activeConstraints,
    todayISO,
    temporarySourceFacts: options.temporarySourceFacts ??
      require('../../store/programStore').useProgramStore.getState()
        .acceptedMaterialContext?.temporarySourceFacts,
  });
}

/**
 * A generated week that does not satisfy `GeneratedWeekContract`.
 *
 * It carries the clause findings verbatim, so the refusal names WHICH rule the
 * week broke and by how much — never a builder-shaped signature.
 */
export class GeneratedWeekRefusedError extends Error {
  readonly code = 'generated_week_refused';

  readonly findings: readonly GeneratedWeekFinding[];

  constructor(signature: string, findings: readonly GeneratedWeekFinding[]) {
    super(`Generated week refused (${signature})`);
    this.name = 'GeneratedWeekRefusedError';
    this.findings = findings;
  }
}

/**
 * WHAT THE COMPOSER IS TOLD ABOUT EXCLUSIONS, BUILT IN ONE PLACE.
 *
 * The scoped decisions are the truth (`prefs.exclusions`). The legacy flat
 * `excluded` array is still unioned in as a WEEK-WIDE set, because a caller may
 * hand-build `athletePrefs` and never go near the store — tests, dev seeds and
 * the coach path all do — and a hand-built list has always meant "out, full
 * stop". Dropping it here would silently un-ban those athletes' exercises.
 */
function composerExclusionInput(
  prefs: AthletePoolPrefsArg,
  weekStartISO: string,
): { excludedIdentities: readonly string[]; excludedIdentitiesByDate: Readonly<Record<string, readonly string[]>> } {
  const resolved = resolveWeekExclusions(prefs?.exclusions, weekStartISO);
  return {
    excludedIdentities: [
      ...new Set([...(prefs?.excluded ?? []), ...resolved.wholeWeek]),
    ],
    excludedIdentitiesByDate: resolved.byDate,
  };
}

/**
 * THE WINDOW'S DATED HALF, ON THE AXIS THE COMPOSER WORKS IN.
 *
 * The equipment owner answers by ISO DATE, because that is what a fact carries;
 * `composeWeek` addresses days by WEEKDAY NUMBER, because that is what a
 * `ComposerPlannedDay` carries. This is the one place the two meet, and it is a
 * projection rather than a second answer — the dates come from the same week
 * start the window was asked for, so the two cannot drift.
 *
 * **Only days that actually LOST something get an entry.** A day at full kit is
 * absent, and the composer reads an absent day as the permanent answer, so every
 * world with no dated removal produces `undefined` here and is byte-identical to
 * the behaviour before this argument existed.
 */
function temporaryKitByDayOfWeekFrom(
  window: { permanent: readonly string[]; byDate: Readonly<Record<string, readonly string[]>> },
): Record<number, readonly string[]> {
  const out: Record<number, readonly string[]> = {};
  for (const [dateISO, tags] of Object.entries(window.byDate)) {
    if (tags.length === window.permanent.length) continue;
    const date = new Date(`${dateISO}T12:00:00`);
    out[date.getDay()] = tags;
  }
  return out;
}

export function buildGeneratedMicrocycles(args: {
  coachWorkouts: CoachGeneratedWorkouts;
  plan: CoachingPlan;
  coachingInputs?: CoachingInputs;
  profile: OnboardingData;
  programId: string;
  microcyclePrefix: string;
  blockStartISO: string;
  blockNumber?: number;
  seasonPhaseClock: SeasonPhaseClock;
  athletePrefs: AthletePoolPrefsArg;
  /**
   * Identities the athlete trained and earned a rise on, per
   * `blockBoundaryProgression.progressedFromOwnHistory`. The ONLY history fact
   * `rules/blockExerciseSelection.ts` reads, and the contract's *"main and secondary
   * lifts may remain for a second consecutive block when progression, comfort
   * and technical continuity justify it"*. Absent = nothing recorded, so every
   * slot rotates, which is the contract's default.
   */
  progressedIdentities?: readonly string[];
  /**
   * RECORDED selections for earlier blocks. Read from
   * `blockSelectionHistoryStore` by the caller and passed down, so the domain
   * selector performs no hidden store read and boot/rollover feed it explicitly.
   */
  selectionHistory?: readonly import('../../rules/blockExerciseSelection').BlockExerciseSelection[];
  /** Written by `buildGeneratedMicrocycles` — what this block actually selected. */
  selectionsOut?: import('../../rules/blockExerciseSelection').BlockExerciseSelection[];
  availableEquipmentTags: readonly EquipmentTag[];
  availableConditioningModalities?: readonly ConditioningEquipmentModality[];
  generationConstraints?: GenerationConstraintContext;
  activeConstraints?: readonly ActiveConstraint[];
  /** Raw facts, threaded per-week to mint the illness_recovery week mode. */
  temporarySourceFacts?: readonly TemporarySourceFact[] | null;
  weekLimit?: 1 | 4;
  /**
   * Which week a `weekLimit: 1` build must author. Not an extra owner: it is the
   * caller's own target Monday, and the block position that week holds comes
   * from `blockStartISO`. `weekLimit: 1` used to mean "the block's FIRST week",
   * which is only the target week when the target IS a block start — the §18
   * reassessment's D1 (2026-08-05).
   */
  targetWeekStartISO?: string;
  /** See GenerateProgramFromProfileOptions.weekAcceptance. */
  weekAcceptance?: AcceptedStateOperationKind;
  /** See GenerateProgramFromProfileOptions.remainderBoundary. */
  remainderBoundary?: {
    governedFromISO: string;
    pinnedHistoryWorkouts: readonly Workout[];
  } | null;
}): Microcycle[] {
  const blockStates = buildBlockWeekStates({
    blockStartISO: args.blockStartISO,
    blockNumber: args.blockNumber ?? 1,
    seasonPhase: args.profile.seasonPhase,
    seasonPhaseClock: args.seasonPhaseClock,
  });
  const targetWeekStartISO = args.targetWeekStartISO ?? args.blockStartISO;
  const states = args.weekLimit === 1
    ? blockStates.filter((state) => state.weekStart === targetWeekStartISO)
    : blockStates;
  // A single-week build that cannot find its week has been handed a block it
  // does not belong to. Silently authoring week 1 instead is the defect this
  // unit retired, so the disagreement is raised where it happens.
  if (args.weekLimit === 1 && states.length !== 1) {
    throw new Error(
      `week ${targetWeekStartISO} is not in the block starting ${args.blockStartISO}`,
    );
  }

  return states.map((blockState, stateIndex) => {
    const microcycleId = `${args.microcyclePrefix}-${blockState.weekNumber}`;
    const generationConstraints = args.activeConstraints
      ? buildGenerationConstraintContext({
          activeConstraints: args.activeConstraints,
          todayISO: blockState.weekStart,
          periodEndISO: blockState.weekEnd,
          temporarySourceFacts: args.temporarySourceFacts,
        })
      : args.generationConstraints;
    // THE ILLNESS LAW's first answer, applied. The illness door has no phase gate
    // (D16 names readiness/bye recovery as the in-season way to back off), so an
    // active moderate-or-severe illness deloads this week whatever the block plan
    // scheduled. Deriving `weekDeloaded` and not consuming it here would look
    // identical to never deriving it — the week would be normal-dose and merely
    // optional, which Sam ruled out.
    const doorDeload = generationConstraints?.weekDeloaded === true;
    // The door changes the DOSE, not the week's identity. `weekKind` is
    // structure — the block plan's own statement about what this week is — and
    // Sam's law holds structure constant while the work shrinks. Overwriting it
    // here also collided with a real block rule (the first four Off-season
    // weeks are an approved no-deload exception), because that rule governs what
    // the app SCHEDULES and an athlete-declared deload is not a schedule change.
    const effectiveWeekKind: WeekKind = blockState.weekKind;
    const profile = applyGenerationConstraintsToProfile(args.profile, generationConstraints);
    /* ── THE ONE EQUIPMENT OWNER, ASKED FOR THE WHOLE WEEK ───────────────────
     *
     * ⚠ **THE KIT USED TO BE ONE ANSWER RESOLVED AT `blockState.weekStart`, AND
     * A WEEK IS NOT A DAY.** An away span beginning on the Wednesday does not
     * cover the Monday, so the resolver returned the FULL gym and the whole week
     * — the trip days included — was composed against it. Measured 2026-08-17
     * (`npm run trace:equipment-scopes`, boundary B3): the resolver answered 3
     * tags for the Thursday of the trip while the composer received all 19,
     * inside the same run, and the athlete read `Back Squat` from a hotel room.
     *
     * The window owner answers both questions at once and keeps them apart:
     * `permanent` is what he OWNS and decides what gets RECORDED, `byDate` is
     * what he can REACH each day and decides what ships. */
    const equipmentWindow = resolveEffectiveEquipmentWindow({
      profile,
      constraints: args.activeConstraints,
      fromISO: blockState.weekStart,
      days: 7,
    });
    const profileEquipment = resolveEquipmentCapabilities(
      profile,
      args.activeConstraints,
      blockState.weekStart,
    );
    const equipment = args.activeConstraints
      ? profileEquipment
      : {
          ...profileEquipment,
          tags: [...args.availableEquipmentTags],
          conditioningModalities: [...(
            args.availableConditioningModalities ??
            (args.availableEquipmentTags.includes('bike_or_treadmill')
              ? profileEquipment.conditioningModalities
              : [])
          )],
        };
    const substitutionPolicy = resolveConditioningSubstitutionPolicy({
      phase: profile.seasonPhase,
      offseasonSubphase: blockState.phaseResolution.offseasonSubphase,
      preseasonSubphase: blockState.phaseResolution.preseasonSubphase,
      equipment,
      profile,
      generationConstraints,
    });
    // ── B1-PIVOT: THE COMPOSER IS THE ONLY STRENGTH-CONTENT BUILDER ─────────
    //
    // Sam, 2026-08-14: *"isn't this like the ai? we just realise it's going to
    // suck for a bit and then build a better one with all the info in there?
    // because right now it just seems like we're fixing shit thats going to be
    // deleted anyway"*. **The migration allowlist is deleted, not widened.**
    // Every world's strength content is composed; the planner still owns the
    // skeleton (days, counts, planned patterns) and conditioning is untouched.
    // A world the composer cannot build now FAILS LOUDLY. It is never answered
    // by the legacy builder.
    // ══ THE PRODUCER CUTOVER ═══════════════════════════════════════════════
    //
    // `buildCoachingPlan` used to fill `CoachingPlan` here. **The scheduler and
    // the specialists fill it now**, through the pure connector. The SHAPE is
    // unchanged — the adapter, the §18 gateway, the store and the coach all read
    // it and none of them moved.
    //
    // Order matters and is the whole point: SCHEDULE first (it owns existence,
    // count, purpose, weekday, hard/rest and spacing), then MATERIALISE (the
    // specialists fill content into days they cannot change), then CONNECT
    // (translation only). The old order asked the planner first and let the
    // scheduler disagree with it afterwards.
    const cutoverInputs = args.coachingInputs;
    let allocatedWeekPlan: CoachingPlan;
    if (cutoverInputs) {
      const schedInputs = weeklySchedulerInputsFrom({
        profile,
        weekStartISO: blockState.weekStart,
        offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? null,
        generationConstraints,
        activeConstraints: args.activeConstraints ?? [],
        exposureContract: null,
        miniCycleNumber: blockState.miniCycleNumber ?? null,
        weekKind: effectiveWeekKind,
      });
      const sched = scheduleWeek(schedInputs);
      if (scheduleRefused(sched)) throw new WeeklyScheduleRefusedError(sched);
      const { level: cutoverCapacity, factors: cutoverFactors } =
        calculateCapacity(cutoverInputs);
      const materialised = materialiseAuthoredSessions({
        schedule: sched,
        facts: {
          weekStartISO: blockState.weekStart,
          miniCycleNumber: blockState.miniCycleNumber,
          capacity: cutoverCapacity,
          isBeginner: resolveTrainingAgePolicy(cutoverInputs.experienceLevel).level === 'new',
          experienced: resolveTrainingAgePolicy(cutoverInputs.experienceLevel).level !== 'new',
          powerGoalNudge: false,
          injuries: (profile.injuries ?? []) as never,
          availableMachines: undefined,
          runOnly: false,
          phase: profile.seasonPhase as never,
          offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? null,
        },
        gameDay: schedInputs.gameDay,
      });
      allocatedWeekPlan = scheduleToCoachingPlan({
        schedule: sched,
        materialised,
        coachingInputs: cutoverInputs,
        capacity: cutoverCapacity,
        capacityFactors: cutoverFactors,
        offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? undefined,
        preseasonSubphase: blockState.phaseResolution.preseasonSubphase ?? undefined,
        section18Identity: {
          seasonPhase: profile.seasonPhase as never,
          blockNumber: blockState.miniCycleNumber ?? null,
          weekInBlock: blockState.weekInBlock ?? null,
          globalWeek: blockState.weekNumber ?? null,
          phaseWeek: blockState.phaseWeekNumber ?? null,
          phaseEntryWeekStartISO: blockState.phaseClock.phaseEntryWeekStartISO ?? null,
          phaseClockSelectedPhase: blockState.phaseClock.selectedPhase ?? null,
          phaseWeekProvenance: blockState.phaseResolution.provenance ?? 'legacy_unknown',
          weekKind: effectiveWeekKind,
          participationProvenance: 'derived_healthy_unrestricted',
          currentProductionClaimsAnchorCredit: true,
          /* THE WEEK'S OWN ANSWER, not one day's. A pattern the athlete can
           * train on the Monday is achievable this week even if Thursday is
           * spent in a hotel, and exempting it would weaken an achievable
           * requirement — which R-090 forbids by name. */
          kitUnachievablePatterns: kitUnachievablePatterns(
            equipmentWindow.reachableAcrossWindow),
        } as never,
        clubNights: schedInputs.clubNights,
        gameDays: schedInputs.gameDay === null ? [] : [schedInputs.gameDay],
        v1Input: {
          seasonPhase: profile.seasonPhase,
          capacity: cutoverCapacity,
          selectedDayNumbers: [...schedInputs.gymAccessDays],
          teamTrainingDayNumbers: [...schedInputs.clubNights],
          hasGame: schedInputs.gameDay !== null,
          gameDay: schedInputs.gameDay,
          weekKind: effectiveWeekKind,
          offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? null,
          preseasonSubphase: blockState.phaseResolution.preseasonSubphase ?? null,
          readinessDeloaded: generationConstraints?.readiness?.deloaded === true,
          maxStrengthSessions:
            resolveTrainingAgePolicy(cutoverInputs.experienceLevel).maxCoreSessions,
          appConditioningFeasible: substitutionPolicy.appConditioningFeasible ?? undefined,
          attemptedConditioningSubstitutions: substitutionPolicy.consideredSubstitutions,
          profileInjuries: profile.injuries ?? [],
          activeInjuries: generationConstraints?.injuries,
          byeMode: cutoverInputs.byeMode,
          weekModeOverride: generationConstraints?.weekMode,
        } as never,
      });
    } else {
      allocatedWeekPlan = args.plan;
    }
    const weekPlan: CoachingPlan = {
      ...allocatedWeekPlan,
      weeklyPlan: resolveWeeklyConditioningFeasibility(
        allocatedWeekPlan.weeklyPlan,
        {
          phase: profile.seasonPhase,
          offseasonSubphase: blockState.phaseResolution.offseasonSubphase,
          preseasonSubphase: blockState.phaseResolution.preseasonSubphase,
          equipment,
          profile,
          generationConstraints,
        },
      ),
    };
    // An edge response describes exactly the block state sent in its prompt:
    // week 1. Never replay that single array against week 2-4 allocations.
    // Later weeks use their own deterministic plan/fallback content.
    // ── THE CUTOVER: THE APPROVED CONTRACT OWNS COUNT, PURPOSE AND WEEKDAY ──
    //
    // `composedPlannedDaysFrom(weekPlan.weeklyPlan)` read the LEGACY PLANNER's
    // allocation. The contract's §1 target is one owner — *"ONE approved weekly
    // contract -> ONE weekly scheduler -> composition"* — so the composer's
    // planned days now come from `scheduleWeek`, and no later layer may change
    // the session count, purpose or weekday it chose.
    //
    // **THE PLANNER STILL RUNS, AND STILL OWNS WHAT THE CONTRACT DOES NOT.**
    // Conditioning content, warm-ups and the §18 exposure contract are its work;
    // the contract explicitly does not own exercise selection or dose. What it
    // no longer owns is WHICH DAYS carry strength and WHAT THOSE SESSIONS ARE.
    const schedulerInputs = weeklySchedulerInputsFrom({
      profile,
      weekStartISO: blockState.weekStart,
      offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? null,
      generationConstraints,
      activeConstraints: args.activeConstraints ?? [],
      exposureContract: weekPlan.weeklyExposureContractV2 ?? null,
      miniCycleNumber: blockState.miniCycleNumber ?? null,
      weekKind: effectiveWeekKind,
    });
    const scheduled = scheduleWeek(schedulerInputs);
    if (scheduleRefused(scheduled)) {
      // A schedule that cannot be built is a TYPED REFUSAL, never a quietly
      // smaller week. It is thrown here so the same acceptance path that handles
      // a refused generated week handles this one.
      throw new WeeklyScheduleRefusedError(scheduled);
    }
    // The planner's own names and tiers, by weekday, so a composed day keeps the
    // athlete-facing label it already had where the two agree on the day.
    const blockSelectionsAuthored = args.selectionsOut ?? [];
    const plannerNameByDay: Record<number, string> = {};
    const plannerTierByDay: Record<number, string> = {};
    for (const entry of weekPlan.weeklyPlan) {
      const dayNumber = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
        'Friday', 'Saturday'].indexOf(String(entry.dayOfWeek ?? ''));
      if (dayNumber < 0) continue;
      if (entry.focus) plannerNameByDay[dayNumber] = String(entry.focus);
      if (entry.tier) plannerTierByDay[dayNumber] = String(entry.tier);
    }
    const schedulerOwnedPlannedDays = schedulerPlannedDays({
      weekStartISO: blockState.weekStart,
      days: scheduled.days,
      nameByDayOfWeek: plannerNameByDay,
      tierByDayOfWeek: plannerTierByDay,
    });
    const composedWeek = composeWeek({
          profile,
          phaseClock: { weekNumber: blockState.weekNumber },
          // B1-M1: the phase the DOSE is resolved against, before authorship.
          seasonPhase: profile.seasonPhase as never,
          offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? null,
          plannedDays: schedulerOwnedPlannedDays,
          /* PERMANENT, so a five-day trip cannot enter the athlete's rotation
           * history. The dated half rides the next argument. */
          kit: equipmentWindow.permanent,
          temporaryKitByDayOfWeek: equipmentWindow.hasTemporaryLoss
            ? temporaryKitByDayOfWeekFrom(equipmentWindow)
            : undefined,
          injuries: {
            // §18's OWN safety answer, not a second injury reading.
            prohibitedPatterns:
              weekPlan.weeklyExposureContractV2?.strengthPatterns.prohibitedPatterns ?? [],
            /* ── THE ATHLETE'S EXCLUSIONS, RESOLVED AGAINST THE WEEK BEING BUILT ──
             *
             * It used to be `args.athletePrefs?.excluded` — a flat list of names
             * with no scope, applied to every week forever. Sam's approved
             * contract gives the answer THREE spans and only one of them is
             * week-wide, so a flat list can be right for at most one of them.
             *
             * `resolveWeekExclusions` splits the one predicate two ways: names
             * out for the WHOLE week, and names out on PARTICULAR DAYS. A "today
             * only" answer must not take the exercise out of Thursday's session
             * as well, and this seam is where that stops happening. */
            ...composerExclusionInput(args.athletePrefs, blockState.weekStart),
          },
      todayISO: blockState.weekStart,
      /* ── THE SELECTION OWNER'S INPUTS. See `rules/blockExerciseSelection.ts`. ──────
       * Selection is keyed by the BLOCK, so the block identity that was already
       * resolved here has to reach the composer. It was not passed before, which
       * is why the composer fell back to the phase WEEK number and a main lift
       * changed every week. */
      blockNumber: blockState.miniCycleNumber ?? 1,
      pinnedIdentities: (args.athletePrefs?.pinned ?? []).map(composedIdentityFor),
      progressedIdentities: args.progressedIdentities ?? [],
      /* ── THE RECORDED PAST, HANDED DOWN EXPLICITLY ────────────────────────
       * The composer never reads a store. Boot and rollover reach this same
       * argument, so every path feeds the selector the same history. */
      blockStartISO: blockState.blockStart,
      selectionHistory: args.selectionHistory ?? [],
    });
    /* What this block chose, carried out so the caller can RECORD it. The
     * composer decides; persistence is the caller's job. */
    for (const selection of composedWeek.selections) {
      if (!blockSelectionsAuthored.some((entry) => entry.slot === selection.slot)) {
        blockSelectionsAuthored.push(selection);
      }
    }
    // ⚠ THE HANDOVER. Composer rows are MATERIALISED straight into domain
    // workouts and NEVER enter `buildWorkoutsFromCoach`. The retained adapter
    // still receives the COMPLETE planner week — this app hangs conditioning,
    // running and sprint work off the strength days — and is simply told which
    // days' STRENGTH the composer owns, so it authors no lifts there.
    // ── EVERY STRENGTH DAY THE LEGACY BUILDER MUST STAND DOWN ON ────────────
    //
    // The composer's OWN days, **plus every day the planner still marks as
    // strength.** Once the scheduler owns the weekday, the planner's allocation
    // can name a day the scheduler did not choose — and that orphaned entry fell
    // through to the severed legacy builder, which throws by design.
    //
    // Measured: 6 worlds died exactly that way
    // (`B1-PIVOT: the legacy strength-content builder is severed`). **Strength is
    // the composer's, on every day, so the stand-down list is the union** — not
    // a fallback, not a repair: the legacy builder authors no lifts anywhere.
    const plannerStrengthDays = weekPlan.weeklyPlan
      .map((entry) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
        'Friday', 'Saturday'].indexOf(String(entry.dayOfWeek ?? '')))
      .filter((day) => day >= 0);
    const composedStrengthDays = [...new Set([
      ...composedWeek.days.map((day) => day.dayOfWeek),
      ...plannerStrengthDays,
    ])];
    const sourceCoachWorkouts: CoachGeneratedWorkoutInput[] = [];
    let exposureContractV2 = weekPlan.weeklyExposureContractV2;
    // The governed boundary, when it falls inside THIS week. Days before it are
    // history: the contract is stamped, pre-boundary anchors keep settled
    // participation, and the candidate pins the athlete's actual days so §18
    // acceptance evaluates the true week (remainder authored AS a remainder).
    const boundary = args.remainderBoundary &&
      args.remainderBoundary.governedFromISO > blockState.weekStart &&
      args.remainderBoundary.governedFromISO <= blockState.weekEnd
      ? args.remainderBoundary
      : null;
    if (boundary && exposureContractV2) {
      exposureContractV2 = stampSection18GovernedBoundary({
        contract: exposureContractV2,
        weekStartISO: blockState.weekStart,
        governedFromISO: boundary.governedFromISO,
      });
    }
    const pinHistoryDays = (built: Workout[]): Workout[] => {
      if (!boundary) return built;
      const isHistoryDate = (dayOfWeek: number): boolean =>
        dateForWeekday(blockState.weekStart, dayOfWeek) < boundary.governedFromISO;
      return [
        ...built.filter((workout) => !isHistoryDate(workout.dayOfWeek)),
        ...boundary.pinnedHistoryWorkouts.filter((workout) =>
          isHistoryDate(workout.dayOfWeek)),
      ];
    };
    const buildCanonicalCandidate = (source: typeof sourceCoachWorkouts): Workout[] => {
      // RECOVERY ADD-ONS ARE NOT PLACED BY GENERATION ANY MORE (2026-08-01,
      // device-pass fail 3). `attachRecoveryAddonsToWeek` put 2-4 generator-
      // chosen add-ons on every generated week — including team nights, which
      // is exactly Sam's "TT + Recovery" card — and recovery is a
      // charter-deleted type whose placement is ATHLETE-ONLY (the charter's
      // rest law: the generator stops placing optional work uninvited). The
      // builder module stays for its classifier exports; the placement pass is
      // retired here. Add-ons ALREADY STORED on devices are not stripped at
      // hydration in this round — they render the mobility vocabulary their
      // rows always were (`part.headline.recovery` → "Mobility"), and content
      // removal from §18-verified stored surfaces is its own unit (recorded in
      // the fix-round boundary notes, with `dropRetiredWeekOverlaysAtHydration`
      // as the pattern to follow).
      // ⚠ THE ADAPTER GETS THE WHOLE WEEK, AND AUTHORS NO LIFTS ON COMPOSED DAYS.
      const adapterWorkouts = buildWorkoutsFromCoach(
          source,
          microcycleId,
          weekPlan.weeklyPlan,
          profile,
          {
            miniCycleNumber: blockState.miniCycleNumber,
            weekInBlock: blockState.weekInBlock,
            weekStartISO: blockState.weekStart,
            weekKind: effectiveWeekKind,
            intensityMultiplier: blockState.intensityMultiplier,
            offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? undefined,
            deloadDoor: doorDeload ? 'illness' : undefined,
            composedStrengthDays,
            readinessDeloadWindow: generationConstraints?.readinessDeloadWindow,
          },
          {
            ...mergeAthletePrefsWithGenerationConstraints(args.athletePrefs, generationConstraints),
            availableEquipment: equipment.tags,
            conditioningModalities: equipment.conditioningModalities,
          },
        );
      // The composer's own rows, materialised directly. No re-dosing, no
      // rotation, no identity rewrite — `assembleAuthoredWeek` lays them onto
      // the adapter's day, which keeps everything non-strength it built.
      // ── THE GOVERNED DOSE INSTRUCTION, RESOLVED ONCE BY THE EXISTING OWNER ──
      //
      // Same two resolvers `buildWorkoutsFromCoach` uses, in the same order and
      // for the same reason: the readiness and illness doors are not
      // phase-gated, so routing them through the scheduled resolver would
      // silently return null and drop the deload. Nothing here is a second
      // table — this READS the owner and hands its answer to the composer,
      // which had been the only week-builder the instruction never reached.
      const composedDeloadPolicy = doorDeload
        ? resolveDoorDeloadPolicy({ door: 'illness', seasonPhase: profile.seasonPhase })
        : resolveDeloadWeekPolicy(profile.seasonPhase, effectiveWeekKind);
      const composedReadinessWindow = generationConstraints?.readinessDeloadWindow ?? null;
      const deloadPolicyForDay = (dayOfWeek: number): DeloadWeekPolicy | null => {
        if (!composedDeloadPolicy) return null;
        // R-035: the deload applies to the DAYS IN THE WINDOW, not to the week.
        // An absent window means every day, and that is load-bearing — the
        // illness door governs while the fact is active and the scheduled door
        // governs a whole authored week; neither carries a window.
        if (!composedReadinessWindow) return composedDeloadPolicy;
        return isDateInReadinessDeloadWindow(
          isoDateForWeekday(blockState.weekStart, dayOfWeek),
          { startISO: composedReadinessWindow.startISO,
            endISO: composedReadinessWindow.endISO },
        )
          ? composedDeloadPolicy
          : null;
      };
      const authored = assembleAuthoredWeek({
        composerWorkouts: materialiseComposedWeek(composedWeek, {
          microcycleId,
          weekStartISO: blockState.weekStart,
          deloadPolicyForDay,
          /* ── THE SPECIALIST'S PRIMER, HANDED TO THE DAY THAT CARRIES IT ────
           * The plan already holds `powerPrimer` per day — `powerPrimerPolicy`
           * decided it and `scheduleToCoachingPlan` carried it. Nothing placed
           * it, because the only row builder lived in the adapter and the
           * adapter authors no strength on composer-owned days. Power is part
           * of a strength session, so the composer places it. */
          power: {
            primerByDay: Object.fromEntries(
              weekPlan.weeklyPlan
                .map((entry) => [
                  DAY_MAP[String(entry.dayOfWeek ?? '')],
                  (entry as { powerPrimer?: unknown }).powerPrimer ?? null,
                ])
                .filter(([day, primer]) => day !== undefined && primer !== null),
            ),
            allowance: exposureContractV2?.power?.eligible === true
              ? exposureContractV2.power.plannerSelectedWeeklyBudget ?? 0
              : 0,
            phase: profile.seasonPhase,
            experienceLevel: profile.experienceLevel,
            availableEquipment: profile.equipment ?? [],
            blockId: `mini-${blockState.miniCycleNumber ?? 1}`,
          },
        }),
        adapterWorkouts,
      });
      const built = authored.workouts as Workout[];
      /* ── BURN THE BOATS: EQUIPMENT AND TRAVEL NO LONGER REACH THIS PASS ─────
       *
       * `validateWorkoutAgainstActiveConstraints` is a filter over a FINISHED
       * week. It used to run for `equipment` and for `travel`, and by 2026-08-17
       * both were a SECOND authority over a question the composer and the
       * scheduler now own outright — the shape the mission calls "an old
       * travel/equipment filter that rewrites, repairs, rejects or duplicates
       * the new scheduler/composer result".
       *
       * ⚠ **AND IT WAS NOT A HARMLESS DUPLICATE. IT REFUSED THE WEEK.** Measured
       * (`npm run trace:equipment-scopes`, B8) with a FULL commercial gym and a
       * travel fact and NO equipment change: the pass collapsed Tuesday and
       * Thursday to REST while they carried six of the athlete's own lifts, and
       * stripped `Back Squat`, `RDLs` and `Bulgarian Split Squats` off two more
       * days. §18 then refused the week for training no squat, hinge, push or
       * pull. **A trip with a full gym produced no week at all.**
       *
       * WHERE EACH BEHAVIOUR WENT, named as the removal law requires:
       *
       *   EQUIPMENT → `composeWeek`'s per-day kit (`temporaryKitByDayOfWeek`,
       *   from `resolveEffectiveEquipmentWindow`). The composer refuses an
       *   illegal row BEFORE authoring it and discloses a typed gap, instead of
       *   authoring it and having a later pass delete it. It also asks the right
       *   oracle: this pass filtered on the materialised row's authored
       *   `equipmentRequired` STRING, which answers "what kit does this use",
       *   while `exerciseIsAvailableWith` answers "can this athlete do it" and
       *   knows Sam's OR-groups. Measured: `RDLs` is legal on dumbbells by the
       *   sheet and was deleted by the string — and then reported back to §18 as
       *   "the week trains no hinge".
       *
       *   TRAVEL → `weeklySchedulerInputs.clubInputsAfterTravel`, which takes the
       *   club night and the fixture out of the facts the PLAN is built from.
       *   That is the fix this pass's own comment named and did not build.
       *
       * Every OTHER schedule kind is untouched and still runs here. */
      const hardPostGenerationConstraints = (args.activeConstraints ?? []).filter((constraint) =>
        constraint.type === 'schedule' &&
        constraint.scheduleKind !== undefined &&
        constraint.scheduleKind !== 'busy_week' &&
        constraint.scheduleKind !== 'max_sessions' &&
        constraint.scheduleKind !== 'travel');
      const constrained = hardPostGenerationConstraints.length > 0
        ? built.map((workout) =>
            validateWorkoutAgainstActiveConstraints({
              workout,
              date: dateForWeekday(blockState.weekStart, workout.dayOfWeek),
              todayISO: blockState.weekStart,
              activeConstraints: hardPostGenerationConstraints,
              profile,
            }).workout ?? collapseWorkoutToRest(workout))
        : built;
      return pinHistoryDays(exposureContractV2
        ? stampPlannerDerivedSessionProvenance({
            workouts: constrained,
            contract: exposureContractV2,
            weekStart: blockState.weekStart,
          })
        : constrained);
    };
    let workouts = buildCanonicalCandidate(sourceCoachWorkouts);
    /* ── THE WEEKLY POWER BUDGET, APPLIED BY THE AUTHORING SIDE ──────────────
     *
     * MOVE 1 of the §18 demolition (Sam, 2026-08-19): *"Power trimming → power
     * specialist."*
     *
     * This decision used to live inside `section18AcceptedWeekGateway`, which
     * meant the VALIDATOR decided how much power the week could carry and
     * stripped the excess on its way through. A week therefore left the
     * composer with more power than it was allowed to have, and only a
     * downstream boundary knew it. That is the same shape as every other defect
     * this mission is deleting: the authoring owner could not tell whether its
     * own output was what shipped.
     *
     * Applied HERE — after the candidate is authored, before §18 sees it — the
     * budget is part of what the specialist AUTHORS, and §18 receives a week
     * that already respects it. §18 then has nothing to trim, which is what
     * lets its call be cut.
     *
     * The contract is carried too, because the budget writes the week's
     * `power.plannerSelectedWeeklyBudget`, `achievedPrimerCount`, `eligible`
     * and `removalReason`. The evaluator reads those, so the numbers and the
     * rows must move together or the verdict disagrees with the content. */
    /* ⚠ **THE ALLOWANCE IS A PLACEMENT LIMIT, NOT A STRIP** (2026-08-19).
     *
     * `weeklyPowerBudget` ran here and REMOVED power rows the week exceeded its
     * allowance by. Measured the day power first reached athletes: on a 4-day
     * pre-season bodyweight week it did not merely take the third primer off
     * Thursday — `finaliseWorkoutAfterMutation` re-finalised the stripped day
     * and **DESTROYED IT ENTIRELY**, main lift included. The day went from
     * `power, main_strength:push, strength_accessory` to EMPTY, main-strength
     * exposures fell 3 -> 2, and four worlds were refused.
     *
     * It had been dormant only because no generated week had ever contained a
     * power row for it to act on. Its first live action was to delete an
     * authored strength session.
     *
     * So it is GONE, and the allowance is honoured where it belongs: the
     * composer places at most the allowance, so there is never anything to
     * strip. Nothing re-finalises an authored day to enforce a count. */
    if (exposureContractV2) {
      // ── THE GENERATED WEEK IS JUDGED, NOT REPAIRED ───────────────────────
      //
      // This was `acceptSection18Week`, which could answer a week with a
      // DIFFERENT week: a regenerate arm, a safe-fallback arm, a whole-week
      // repair search, offer placement and a safety finaliser that inserted
      // fallback rows. **That is why a composer could never tell whether its
      // week was accepted or quietly replaced**, and why acceptance depended on
      // residue the legacy builder left behind rather than on what the week
      // contained.
      //
      // Generation now answers to `GeneratedWeekContract` alone. The validator
      // accepts, refuses with typed findings, or accepts while disclosing a
      // typed gap — and it never rewrites a row. **The editing route keeps the
      // gateway unchanged**; nothing here is deleted from under an edit.
      const generatedContract = generatedWeekContractFrom(
        exposureContractV2,
        // Same week-wide answer the contract was built with, so the validator
        // and the contract cannot disagree about what the kit can reach.
        kitUnachievablePatterns(equipmentWindow.reachableAcrossWindow),
      );
      const validation = validateGeneratedWeek({
        workouts,
        contract: generatedContract,
        // ── WHAT AN ANCHOR IS WORTH BEFORE IT HAS HAPPENED ─────────────────
        //
        // **Sam, 2026-08-15:** *"conditioning/sprint credit supplied by those
        // visible anchors"*.
        //
        // A club night or a fixture the athlete has not attended yet carries
        // `participation: 'unknown'` — nobody has reported anything, because the
        // week is being AUTHORED. Read literally that means no credit, so a week
        // whose high-speed running is entirely supplied by two club nights and a
        // game was refused for having no sprint in it. The app's own contract
        // then had no legal way to satisfy the minimum either: the approved
        // source forbids ADDING sprint work on a club-training week.
        //
        // The contract already records what generation knows, on the anchor
        // itself: `participationProvenance: 'derived_healthy_unrestricted'` —
        // *"we derived that this athlete is healthy and unrestricted"*. That is
        // the plan's stated assumption, and a plan is authored on it. So a
        // DERIVED-healthy anchor participates normally for the purposes of
        // judging the week we are about to hand over.
        //
        // ⚠ It is not promoted to `explicit`, and nothing here is written back.
        // `explicit` means the ATHLETE said so, and the safety boundary treats
        // it very differently; a derived assumption that laundered itself into a
        // reported fact would be the worse defect by far. The moment a real
        // participation fact exists it is not derived any more, and it wins.
        anchors: (exposureContractV2.anchors ?? []).map((anchor) => {
          // ⚠ DELEGATED, NOT RESTATED. This condition used to live here as a
          // local `derivedHealthy` boolean, and the §18 effective-week evaluator
          // — the OTHER judge of the same anchor — had never heard of it. The
          // same week this gate accepted, that one refused with
          // `unjustified_anchor_credit`, which is why no club-night athlete
          // could relaunch the app. One owner now answers for both.
          const participation = String(effectiveAnchorParticipation(anchor));
          return {
            dayOfWeek: anchor.dayOfWeek,
            participation,
            // "Was the athlete there?" — the two states that mean no.
            attended: participation !== 'did_not_participate'
              && participation !== 'unknown',
          };
        }),
      });
      if (validation.verdict === 'refused') {
        throw new GeneratedWeekRefusedError(
          generatedWeekFailureSignature(validation),
          validation.findings,
        );
      }
    }
    // ── THE NEED-BASED TOP-UP PASS ──
    //
    // Sam's ruling, 2026-07-30: "No defaults. Build the program; if anything is
    // lacking, add a spare optional session to make up for it." This is the only
    // place in the app that places optional accessory or mobility work into a
    // generated week — R2, R3, R4 and R5 are deleted from the allocator in the same
    // commit, so there is nothing left that places it by day.
    //
    // AND IT RUNS HERE, AFTER ACCEPTANCE, BECAUSE THE SEAM IS THE ARGUMENT. The
    // contract was satisfied before these sessions existed and is never
    // re-evaluated against them, so a top-up is INCAPABLE of affecting compliance
    // or load rather than merely checked not to.
    //
    // THAT ARGUMENT COVERS COUNTS AND NOT SHAPE, which is how this pass was
    // escaping the craft tier the gateway now runs. A top-up landing on G-1, or
    // stacking an upper session beside a lower one, is a Section 17 question and
    // arrives after the only place that asks it. `withCraftSafeTopUps` closes
    // the seam in the shape a top-up already has: an optional session that
    // introduces a craft violation is simply not added.
    const acceptedWeekBeforeTopUps = workouts;
    workouts = applyOptionalTopUps({
      workouts,
      seasonPhase: blockState.phaseClock.selectedPhase,
      athlete: {
        injuries: profile.injuries ?? [],
        equipmentTags: [...equipment.tags],
        onboardingData: profile,
      },
      microcycleId,
      weekStartISO: blockState.weekStart,
      gameDayOfWeek: gameDayOfWeekFor(workouts, profile),
      // Only days the athlete said they train, and never a day already governed as
      // history: a top-up on a pinned past day would be the app editing a day that
      // has already been.
      // Reading A, at the only place it touches placement: a mobility or injury-history
      // weakness leans the OPTIONAL needs (Sam's ruling 3). Required work is untouched.
      weakPointFocus: weakPointFocusFor(profile.biggestLimitation),
      candidateDays: topUpCandidateDays({
        profile,
        weekStart: blockState.weekStart,
        governedFromISO: boundary?.governedFromISO ?? null,
      }),
    }).workouts;
    if (exposureContractV2) {
      const craftSafe = withCraftSafeTopUps({
        contract: exposureContractV2,
        weekStart: blockState.weekStart,
        profile,
        // The same boundary `topUpCandidateDays` above is already given, in the
        // same shape the gateway hands its own consumers: a top-up never lands
        // on a governed history day, so a finding there can never be one it
        // introduced.
        governableDates: new Set([0, 1, 2, 3, 4, 5, 6]
          .map((day) => isoDateForWeekday(blockState.weekStart, day))
          .filter((date) => !boundary?.governedFromISO || date >= boundary.governedFromISO)),
        base: acceptedWeekBeforeTopUps,
        placed: workouts.filter((workout) =>
          !acceptedWeekBeforeTopUps.some((accepted) => accepted.id === workout.id)),
      });
      if (craftSafe.withheld.length > 0) {
        logger.warn('[ProgramGen] optional top-ups withheld by the craft tier', {
          microcycleId,
          withheld: craftSafe.withheld.map((workout) => `${workout.dayOfWeek}:${workout.name}`),
        });
      }
      workouts = craftSafe.workouts;
    }
    // THE V1 GENERATION-TIME FALLBACK IS RETIRED (Sam, 2026-08-10: "well
    // fucking delete the old shit here?"). Contract v2 is the accepted-week
    // authority. **V1 cannot represent two valid credits stacked on one day**
    // (team training PLUS an app core block), so it UNDERCOUNTS exactly the
    // combined days the app now builds — and it was still the acceptance gate
    // whenever v2 was absent, i.e. on pre-rebuild saved programs. A week with
    // no v2 contract now regenerates rather than being accepted by a weaker
    // set of rules.
    //
    // The value is still READ here because the microcycle persists it below;
    // retiring the STORED field is a separate unit with a migration, and
    // `evaluateEffectiveWeekExposureContract` still runs at three sites in
    // postGenerationConstraintValidation — see
    // docs/V1_EXPOSURE_CONTRACT_CUT_2026-08-10.md.
    const exposureContract = weekPlan.weeklyExposureContract;
    if (isDevBuild()) {
      const sourceByDay = new Map(sourceCoachWorkouts.map((workout) => [workout.dayOfWeek, workout]));
      const planByDay = new Map(
        weekPlan.weeklyPlan
          .filter((entry) => !!entry.dayOfWeek)
          .map((entry) => [DAY_MAP[entry.dayOfWeek!], entry]),
      );
      logger.warn('[ProgramGen][dev] Microcycle plan-entry alignment', {
        microcycleId,
        weekNumber: blockState.weekNumber,
        sourceMode: stateIndex === 0 ? 'edge_exact_week' : 'deterministic_week_fallback',
        days: workouts.map((workout) => {
          const source = sourceByDay.get(workout.dayOfWeek);
          const entry = planByDay.get(workout.dayOfWeek);
          const finalRowNames = new Set(
            workout.exercises.map((row) => String(row.exercise?.name ?? '').toLowerCase()),
          );
          return {
            dayOfWeek: workout.dayOfWeek,
            sourceGeneratedWorkout: source?.name ?? null,
            sourcePlanEntryId: source?.planEntryId ?? null,
            matchedPlanEntryId: entry?.planEntryId ?? null,
            planEntryId: entry?.planEntryId ?? null,
            archetype: entry?.strengthIntent?.archetype ?? null,
            primaryStrengthPattern: entry?.strengthIntent?.primaryPattern ?? null,
            plannedStrengthPatterns: entry?.strengthIntent?.plannedPatterns ?? [],
            effectiveStrengthPatterns: workout.strengthIntent?.effectivePatterns ?? [],
            strengthPatternChanges: workout.strengthIntentDiagnostics ?? [],
            finalTier: workout.sessionTier ?? null,
            finalComponents: getSessionComponents(workout).map((component) => component.kind),
            finalWorkoutType: workout.workoutType,
            removedOrReplacedSourceRows: (source?.exercises ?? [])
              .map((row) => row.name)
              .filter((name) => !finalRowNames.has(String(name).toLowerCase())),
            fallbackReason: stateIndex === 0
              ? source ? null : 'edge_omitted_day'
              : 'edge_week_not_replayed_across_microcycles',
          };
        }),
      });
    }

    return {
      id: microcycleId,
      programId: args.programId,
      weekNumber: blockState.weekNumber,
      startDate: dateAtNoonISO(blockState.weekStart),
      endDate: dateAtNoonISO(blockState.weekEnd),
      miniCycleNumber: blockState.miniCycleNumber,
      weekKind: effectiveWeekKind,
      deloadDoor: doorDeload ? 'illness' : undefined,
            readinessDeloadWindow: generationConstraints?.readinessDeloadWindow,
      exposureContract,
      exposureContractV2,
      intensityMultiplier: blockState.intensityMultiplier,
      workouts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * DETERMINISTIC local program generation — no network, no LLM.
 *
 * Product rule (Sam, 2026-07-08): adding / moving / removing a game day
 * from the tap/edit UI must NOT depend on the AI coach or OpenAI. This
 * builds the full program with the exact same machinery the AI path uses,
 * minus the AI:
 *
 *   1. buildCoachingPlan — deterministic allocations (already game-aware:
 *      H-GAME, stress-aware placement, pre-season game structures).
 *   2. buildWorkoutsFromCoach([]) — passing NO coach workouts makes
 *      completeCoachWorkoutsFromPlan synthesise EVERY day from the plan's
 *      deterministic fallbacks, then the normal normaliser applies tier /
 *      intensity enforcement, conditioning blocks, and pool rotation
 *      (which rewrites fallback exercise names to the block's variants).
 *
 * Content is deliberately simpler than an AI-enriched program (3-ish core
 * exercises per session) — correct structure NOW beats rich copy in 55s
 * (or a timeout). Synchronous and throw-safe for atomic commit flows:
 * callers only apply state when this returns.
 */
export function generateProgramLocally(
  onboardingData: OnboardingData,
  options: GenerateProgramFromProfileOptions = {},
): TrainingProgram {
  const effectiveTodayISO = options.todayISO ?? todayISOLocal();
  const availabilityDateISO = effectiveTodayISO;
  const { blockStart, blockEnd } = generationBlockBounds(options, effectiveTodayISO);
  const activeConstraintsForGeneration = collectActiveConstraintsForGeneration(options, availabilityDateISO);
  const generationConstraints = resolveGenerationConstraints(options, availabilityDateISO);
  const baseProfile = normalizeOnboardingRole(onboardingData);
  const generationProfile = applyGenerationConstraintsToProfile(
    baseProfile,
    generationConstraints,
  );
  const resolvedEquipment = generationEquipmentInputOrThrow(
    generationProfile,
    resolveEquipmentCapabilities(
      generationProfile,
      activeConstraintsForGeneration,
      availabilityDateISO,
    ),
  );
  const resolvedEquipmentTags = resolvedEquipment.tags;
  const phaseResolution = generationPhaseResolution(generationProfile, blockStart, options);
  const substitutionPolicy = resolveConditioningSubstitutionPolicy({
    phase: generationProfile.seasonPhase,
    equipment: resolvedEquipment,
    profile: baseProfile,
    generationConstraints,
  });
  const coachingInputs = onboardingToCoachingInputs(generationProfile, {
    availabilityDateISO,
    generationConstraints,
    appConditioningFeasible: substitutionPolicy.appConditioningFeasible ?? undefined,
    conditioningSubstitutionPolicy: substitutionPolicy,
    phaseWeekNumber: phaseResolution.phaseWeekNumber,
    phaseClock: phaseResolution.clock,
    phaseClockProvenance: phaseResolution.provenance,
    offseasonSubphase: phaseResolution.offseasonSubphase ?? undefined,
    preseasonSubphase: phaseResolution.preseasonSubphase ?? undefined,
    targetWeekAvailability: options.targetWeekAvailability,
    targetFixtureDay: options.targetFixtureDay,
    awaySpans: awaySpansFromConstraints(options.activeConstraints),
    noTeamTrainingSpans: noTeamTrainingSpansFromConstraints(options.activeConstraints),
  });
  const plan = buildInitialGeneratedCoachingPlan({
    coachingInputs,
    profile: generationProfile,
    todayISO: effectiveTodayISO,
    blockNumber: options.blockNumber,
    seasonPhaseClock: phaseResolution.clock,
  });

  logger.debug('[ProgramGen] Local deterministic build', {
    capacity: plan.capacity,
    coreSessions: plan.coreSessions,
    gameDay: storedGameAnchor(generationProfile),
    activeConstraints: generationConstraints?.activeConstraintIds ?? [],
  });

  const startDate = new Date(blockStart + 'T12:00:00');
  const endDate = new Date(blockEnd + 'T12:00:00');
  /* ── WHICH LIFTS THE ATHLETE EARNED A RISE ON, READ FROM RECORDED HISTORY ──
   *
   * `rules/blockExerciseSelection.ts` retains a main lift for a second consecutive
   * block only when the EXISTING progression decision supports it. That decision
   * is `blockBoundaryProgression`'s, and its `history_progressed` condition is
   * exported as `progressedFromOwnHistory` precisely so rotation reads it rather
   * than owning a second copy.
   *
   * `decideBlockBoundaryLoads` itself cannot be asked here: it takes the next
   * block's WORKOUTS, and rotation is what decides which exercises are in them. */
  const rotationPreviousBlock = previousBlockBoundsISO(blockStart);
  const rotationHistory = readBlockHistory({
    feedbackByDate: options.progressionHistory?.sessionFeedback ?? {},
    // THE BLOCK THAT JUST ENDED — the same window the load boundary reads. The
    // recorded LOADS are not windowed by it (a lift that sat out a block keeps
    // its own number); only the completion/recovery gate is.
    blockStartISO: rotationPreviousBlock.startISO,
    blockEndISO: rotationPreviousBlock.endISO,
    // THE ACCEPTED PREVIOUS BLOCK'S OWN REQUIREMENT, never the athlete's
    // requested availability and never a recalculated planning target.
    requiredStrengthSessions:
      options.progressionHistory?.acceptedBlocks?.[
        rotationPreviousBlock.startISO]?.requiredStrengthSessions ?? 0,
  });
  const progressedIdentities = Object.keys(rotationHistory.lastRecordedLoadByExercise)
    .filter((exerciseName) => progressedFromOwnHistory({ exerciseName, history: rotationHistory }))
    .map(composedIdentityFor);

  /* ── THE RECORDED PAST IN, THE NEW DECISION OUT ───────────────────────────
   * The store is read HERE, in the service, never inside the domain selector.
   * An explicit `selectionHistory` wins so boot, rollover and tests can state
   * the world instead of depending on ambient state. */
  const selectionHistoryForBuild = options.selectionHistory
    ?? require('../../store/blockSelectionHistoryStore').blockSelectionHistory();
  const selectionsAuthored:
    import('../../rules/blockExerciseSelection').BlockExerciseSelection[] = [];

  const microcycles = buildGeneratedMicrocycles({
    coachWorkouts: [],
    plan,
    coachingInputs,
    profile: baseProfile,
    programId: 'prog-ai-1',
    microcyclePrefix: 'mc-ai',
    blockStartISO: blockStart,
    blockNumber: options.blockNumber ?? 1,
    seasonPhaseClock: phaseResolution.clock,
    athletePrefs: options.athletePrefs ?? getAthletePrefs(),
    progressedIdentities,
    selectionHistory: selectionHistoryForBuild,
    selectionsOut: selectionsAuthored,
    availableEquipmentTags: resolvedEquipmentTags,
    availableConditioningModalities: resolvedEquipment.conditioningModalities,
    generationConstraints,
    activeConstraints: activeConstraintsForGeneration,
    temporarySourceFacts: options.temporarySourceFacts ??
      require('../../store/programStore').useProgramStore.getState()
        .acceptedMaterialContext?.temporarySourceFacts,
    weekLimit: options.microcycleLimit,
    targetWeekStartISO: getMondayISOForDate(effectiveTodayISO),
    weekAcceptance: options.weekAcceptance,
    remainderBoundary: options.remainderBoundary ?? null,
  });
  const firstMicrocycle = microcycles[0];
  if (!firstMicrocycle?.workouts.length) {
    throw new ProgramGenError(
      'bad_response',
      'The app could not rebuild your week. Please try again.',
      'local generation produced zero workouts',
      true,
    );
  }

  const localPhaseMap: Record<string, string> = {
    'Off-season': 'Base-Building',
    'Pre-season': 'Pre-Season-Skills',
    'In-season': 'In-Season',
  };

  const program: TrainingProgram = {
    id: 'prog-ai-1',
    userId: 'user-default',
    name: buildProgramName(generationProfile, plan),
    description: 'Week rebuilt around your schedule change.',
    programPhase: (localPhaseMap[generationProfile.seasonPhase || ''] || 'Pre-Season-Skills') as TrainingProgram['programPhase'],
    seasonPhaseClock: phaseResolution.clock,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    primaryFocus: generationProfile.motivation || 'Strength and Conditioning',
    isActive: true,
    microcycles,
    // R1.3 (shell rebuild): generation records its own anchor input.
    generationAnchorISO: effectiveTodayISO,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Authoring-time freeze (§18 ownership redesign, stage 1): materialise strength
  // progression into the stored microcycles once. Resolution then merely projects
  // these loads — it no longer recomputes progression on read.
  //
  // ⚠ THIS USED TO PASS FOUR EMPTY ARGUMENTS. `sessionFeedback: {}`,
  // `weightOverrides: {}`, `workoutHistory: []`, `blockState: null`. The freeze
  // was correct and starved: it baked a history-free load into storage, and the
  // screen — reading the live store — could derive a different one. Feeding it
  // is what makes stored == visible == reloaded true rather than lucky.
  // ⚠ NO STORE READ HERE. This used to be
  // `require('../../store/programStore').useProgramStore.getState()`, and Sam
  // ordered it out at product close: *"Same explicit inputs must always produce
  // the same stored block."* A hidden read makes generation a function of
  // ambient app state, so the SAME arguments could author two different blocks
  // depending on what happened to be in the store — which is exactly the class
  // of thing that cannot be tested and cannot be reproduced from a bug report.
  //
  // **ABSENT NOW MEANS EMPTY, NOT "GO AND LOOK".** The rollover caller
  // (`utils/weekRebuild.ts`) passes the athlete's real history, overrides and
  // block state explicitly; fresh onboarding passes nothing and therefore
  // authors against an explicitly empty history, which is the truthful input
  // for an athlete who has not trained yet.
  const progressionSessionFeedback = options.progressionHistory?.sessionFeedback ?? {};
  const progressionWeightOverrides = options.progressionHistory?.weightOverrides ?? {};
  const progressionBlockState = options.progressionHistory?.blockState ?? null;

  // ⚠ TAKEN HERE, ONE LINE BEFORE THE FREEZE, AND THAT POSITION IS THE POINT.
  // The block boundary's reduction is bounded by what the COMPOSER authored;
  // after the freeze has run there is no way to read that number back, because
  // a very-hard block's rows have already been collapsed to a single set. Taken
  // afterwards, the reduction's own ceiling would be the value it exists to
  // correct. It also carries the DELOAD week's already-halved dose, which is
  // what stops the reduction raising week 4.
  const authoredSetsByRowId = snapshotAuthoredSets(program.microcycles);

  bakeMicrocycleStrengthProgression(program, {
    manualOverrides: {},
    markedDays: {},
    athleteContext: {
      injuries: baseProfile.injuries || [],
      equipmentTags: [...resolvedEquipmentTags],
      onboardingData: baseProfile,
    },
    seasonPhase: generationProfile.seasonPhase || null,
    gameDay: baseProfile.gameDay,
    usualGameDay: baseProfile.usualGameDay,
    capacity: deriveProfileReadiness(baseProfile),
    sessionFeedback: progressionSessionFeedback,
    weightOverrides: progressionWeightOverrides,
    workoutHistory: [],
    blockState: progressionBlockState,
  });

  // ── THE BLOCK BOUNDARY HAS THE LAST WORD ON A STRENGTH ROW'S LOAD ──
  //
  // The freeze above is the general progression owner and stays that way. What
  // it cannot decide is the question only a BOUNDARY poses: this lift ran last
  // block and earned its 2.5 kg, that one is new and must start blank.
  //
  // Sam ruled the rotated half twice (2026-08-16, option B): *"leave its
  // starting load unset and let the athlete choose... never infer one from the
  // movement pattern, exercise name or previous weight"*, and for this slice
  // *"rotated lift → no inherited load and no automatic estimate."* The freeze,
  // left alone, does the opposite — `extractSlotExposureHistory` deliberately
  // carries a rotated pool anchor's load across a sibling mapping.
  //
  // Applied only from block 2 onward: block 1 has no previous block to retain
  // from, and running it there would blank every load an onboarding estimate
  // legitimately produced.
  const authoringBlockNumber = options.blockNumber ?? 1;
  if (authoringBlockNumber > 1) {
    const allDecisions: BlockBoundaryLiftDecision[] = [];
    const allConditioningAdvances: BlockBoundaryConditioningAdvance[] = [];
    const previousBlock = previousBlockBoundsISO(blockStart);
    const history = readBlockHistory({
      feedbackByDate: progressionSessionFeedback,
      blockStartISO: previousBlock.startISO,
      blockEndISO: previousBlock.endISO,
      // The same recorded requirement the rotation read above uses, keyed on the
      // same window, so one athlete cannot be rotated off one denominator and
      // progressed off another.
      requiredStrengthSessions:
        options.progressionHistory?.acceptedBlocks?.[
          previousBlock.startISO]?.requiredStrengthSessions ?? 0,
    });
    const allVolumeDecisions: BlockBoundaryVolumeDecision[] = [];
    const allConditioningDecisions: BlockBoundaryConditioningDecision[] = [];
    for (const [weekIndex, microcycle] of program.microcycles.entries()) {
      const decisions = decideBlockBoundaryLoads({
        history,
        nextBlockWorkouts: microcycle.workouts,
        // PRIORITY 2 needs the athlete's own squat/bench answers — the authored
        // anchor estimate is a function of them, and of nothing the outgoing
        // exercise knows.
        onboardingData: baseProfile,
      });
      microcycle.workouts = applyBlockBoundaryProgression({
        workouts: microcycle.workouts,
        decisions,
      });
      for (const decision of decisions) allDecisions.push(decision);

      // ── THE LADDER'S SECOND RUNG — ONE SET, ONLY WHERE LOAD DID NOT MOVE ──
      //
      // ORDER IS THE CONTRACT'S: *"1. Increase load... 2. Add one set when more
      // volume is appropriate and the session remains inside its approved cap."*
      // It runs AFTER the load pass because it is fed that pass's decisions —
      // *"do not increase load and sets on the same exercise in the same
      // rollover"* is only answerable once the load rung has been decided.
      //
      // It is a no-op on every block that is not well-completed AND
      // well-recovered AND tolerated in the strength quality, so the ordinary
      // and the beaten-up athlete both reach the reduction below unchanged.
      const setAdditions = decideBlockBoundarySetAdditions({
        history,
        nextBlockWorkouts: microcycle.workouts,
        weekIndex,
        ...(microcycle.weekKind !== undefined ? { weekKind: microcycle.weekKind } : {}),
        loadDecisions: decisions,
        authoredSetsByRowId,
      });
      microcycle.workouts = applyBlockBoundarySetAdditions({
        workouts: microcycle.workouts,
        decisions: setAdditions,
      });
      // ── THE REDUCTION, ON A BLOCK THE ATHLETE SAID WAS VERY HARD ──
      //
      // ORDER IS THE CONTRACT'S, NOT AN IMPLEMENTATION CONVENIENCE. Its "Low
      // readiness or high soreness" list is: hard conditioning first, then main-
      // and secondary-lift sets, then easier aerobic work in place of what was
      // removed. Conditioning is decided and applied before volume so that the
      // one thing the contract cuts FIRST is the one thing that cannot be
      // starved by a volume pass that ran ahead of it.
      //
      // Both are no-ops unless `history.reduces` — the decision functions
      // return an empty list for every other verdict, so the ordinary
      // well-recovered block reaches `return program` having changed nothing
      // here.
      const conditioningDecisions = decideBlockBoundaryConditioning({
        history,
        nextBlockWorkouts: microcycle.workouts,
        weekIndex,
      });
      microcycle.workouts = applyBlockBoundaryConditioning({
        workouts: microcycle.workouts,
        decisions: conditioningDecisions,
        seedISO: microcycleStartISO(microcycle, blockStart, weekIndex),
        miniCycleNumber: weekIndex + 1,
      });
      for (const decision of conditioningDecisions) allConditioningDecisions.push(decision);

      // ── WC-137: THE OTHER DIRECTION, AT THE SAME BOUNDARY ────────────────
      //
      // Conditioning easy while strength was difficult -> exactly one authored
      // step. It runs AFTER the reduce pass on purpose: `reduces` and
      // `conditioningEasy` can both be true of one block, and reduce outranks
      // advance. The decider refuses that combination itself, so this ordering
      // is belt to that braces rather than the only thing stopping it.
      const conditioningAdvances = decideBlockBoundaryConditioningAdvance({
        history,
        nextBlockWorkouts: microcycle.workouts,
        weekIndex,
        phase: onboardingData.seasonPhase,
      });
      microcycle.workouts = applyBlockBoundaryConditioningAdvance({
        workouts: microcycle.workouts,
        advances: conditioningAdvances,
      });
      for (const advance of conditioningAdvances) allConditioningAdvances.push(advance);

      const volumeDecisions = decideBlockBoundaryVolume({
        history,
        nextBlockWorkouts: microcycle.workouts,
        authoredSetsByRowId,
      });
      microcycle.workouts = applyBlockBoundaryVolume({
        workouts: microcycle.workouts,
        decisions: volumeDecisions,
      });
      for (const decision of volumeDecisions) allVolumeDecisions.push(decision);
    }
    // Stored beside the prescriptions it explains, so the two cannot drift.
    const reduction = buildBlockBoundaryReductionExplanation({
      history,
      loadDecisions: allDecisions,
      volumeDecisions: allVolumeDecisions,
      conditioningDecisions: allConditioningDecisions,
    });
    program.blockBoundaryExplanation = [
      // THE REDUCTION ROW LEADS. It is the block-level answer to "what happened
      // to my programme"; the per-lift load rows are its detail.
      ...(reduction ? [reduction] : []),
      ...buildBlockBoundaryExplanation(allDecisions),
    ];
  }

  /* ── RECORD THE DECISION ──────────────────────────────────────────────────
   * The block has been authored, so what it selected is now a FACT about the
   * athlete's history rather than a derivation. Recording it is what stops the
   * next boot re-deriving a different past when their kit or exclusions change —
   * the defect `scripts/trace-selection-history.ts` measured.
   *
   * Re-authoring the same block REPLACES its rows (identity is `blockStartISO`),
   * so a rebuild or a rollover re-run cannot make one block look like several.
   *
   * ⚠ **AND A REPLAY MAY NOT RE-AUTHOR.** `'author'` is the door that decides
   * the block; `'replay'` is a caller re-deriving one it did not decide. A
   * replay records only a block nobody has recorded yet — otherwise the boot
   * writes down whatever the composer happened to pick under the exclusions,
   * kit or facts that were live at launch, and a reversible decision becomes a
   * permanent input. That is not a hypothetical: it destroyed a main lift. */
  if (options.recordSelections && selectionsAuthored.length > 0) {
    const historyStore = require('../../store/blockSelectionHistoryStore');
    const alreadyRecorded: boolean = historyStore.blockHasRecordedSelections(blockStart);
    if (options.recordSelections === 'author' || !alreadyRecorded) {
      historyStore.recordBlockSelections(blockStart, selectionsAuthored);
    }
  }
  return program;
}

/**
 * The Monday a microcycle starts on, as `YYYY-MM-DD`.
 *
 * `Microcycle.startDate` is stored as a full timestamp and the conditioning
 * owner wants a plain day string, so it is narrowed here rather than at the call
 * site. Falls back to counting weeks off the block start when a microcycle
 * carries no date at all — the same grid the caller already owns, never a fresh
 * one derived from today.
 */
function microcycleStartISO(
  microcycle: { startDate?: string | Date },
  blockStartISO: string,
  weekIndex: number,
): string {
  const stored = microcycle.startDate;
  if (typeof stored === 'string' && stored.length >= 10) return stored.slice(0, 10);
  const start = new Date(`${blockStartISO}T12:00:00`);
  start.setDate(start.getDate() + weekIndex * 7);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

/** Is a response body HTML (Cloudflare/Supabase proxy page etc.)? */
function looksLikeHtml(body: string): boolean {
  const trimmed = body.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<?xml') ||
    /\s<html[\s>]/i.test(trimmed.slice(0, 200));
}

/** Short, redacted preview of a body for logs only. */
function previewBody(body: string, max = 500): string {
  return (body || '').slice(0, max).replace(/\s+/g, ' ').trim();
}

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined'
    ? __DEV__
    : process.env.NODE_ENV !== 'production';
}

function buildRoleContext(data: OnboardingData) {
  const selectedRole = normalizeRoleBucket(data.position);
  const programmingRoleBias = getProgrammingRoleBias(selectedRole);
  return {
    selectedRole,
    selectedRoleLabel: roleBucketLabel(selectedRole),
    programmingRoleBias,
    programmingRoleBiasLabel: programmingRoleBiasLabel(selectedRole),
  };
}

export interface ProgramGenerationEdgePayload {
  messages: Array<{ role: 'user'; content: string }>;
  athleteProfile: OnboardingData & {
    resolvedEquipmentTags: EquipmentTag[];
    resolvedConditioningModalities: ConditioningEquipmentModality[];
  };
  roleContext: ReturnType<typeof buildRoleContext>;
  coachingPlan: AIConstraints;
  mode: 'generate';
}

/**
 * Single request-shape owner for full edge generation. Equipment has already
 * been resolved from onboarding plus active constraints before it reaches this
 * boundary; raw profile equipment remains alongside it for old edge fallbacks.
 */
export function buildProgramGenerationEdgePayload(args: {
  generationProfile: OnboardingData;
  message: string;
  coachingPlan: AIConstraints;
  resolvedEquipmentTags: readonly EquipmentTag[];
  resolvedConditioningModalities?: readonly ConditioningEquipmentModality[];
}): ProgramGenerationEdgePayload {
  return {
    messages: [{ role: 'user', content: args.message }],
    athleteProfile: {
      ...args.generationProfile,
      resolvedEquipmentTags: [...args.resolvedEquipmentTags],
      resolvedConditioningModalities: [...(
        args.resolvedConditioningModalities ??
        resolveEquipmentCapabilities(args.generationProfile).conditioningModalities
      )],
    },
    roleContext: buildRoleContext(args.generationProfile),
    coachingPlan: args.coachingPlan,
    mode: 'generate',
  };
}

/**
 * Fields that improve a generated program but are not required to produce one.
 *
 * `sessionDurationMinutes` used to sit here as a documented interim state: the
 * screen was registered in the navigator but nothing ever navigated to it, so
 * onboarding never collected the field and requiring it would have refused
 * every genuine onboarding. Sam ruled it KILLED
 * (PROGRAMMING_DESIGN_SESSION_2026-07-23.md D6b) and the Phase 1.6 purge
 * (2026-07-25) deleted the screen, the type, the field and BOTH sides of the
 * generation contract — client and edge function. Nothing expects it now.
 */
const RECOMMENDED_PROGRAM_GEN_PROFILE_FIELDS: Array<keyof OnboardingData> = [
  'biggestLimitation',
  'biggestFrustration',
  'successVision',
];

function hasProfileValue(data: OnboardingData, field: keyof OnboardingData): boolean {
  const value = data[field];
  if (field === 'injuries') return Array.isArray(value);
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function getProgramGenerationProfileFieldDiagnostics(data: OnboardingData): {
  missingRequired: string[];
  missingRecommended: string[];
} {
  // The required set is derived from the onboarding step registry, so the
  // generator and the flow can never disagree about what an athlete was asked.
  const missingRequired = missingRequiredProfileFields(data);

  const missingRecommended = RECOMMENDED_PROGRAM_GEN_PROFILE_FIELDS
    .filter((field) => !hasProfileValue(data, field))
    .map(String);

  return { missingRequired, missingRecommended };
}

export function buildProgramGenerationRequestDiagnostics(
  onboardingData: OnboardingData,
  plan?: CoachingPlan,
  message?: string,
  env: ReturnType<typeof getClientEnvConfig> = getClientEnvConfig(),
  resolvedEquipmentTags: readonly EquipmentTag[] = resolveEquipmentAvailability(onboardingData),
  resolvedConditioningModalities: readonly ConditioningEquipmentModality[] =
    resolveEquipmentCapabilities(onboardingData).conditioningModalities,
  todayISO: string = todayISOLocal(),
): Record<string, unknown> {
  const generationProfile = normalizeOnboardingRole(onboardingData);
  const derivedInputs = onboardingToCoachingInputs(generationProfile, {
    availabilityDateISO: todayISO,
  });
  const diagnosticsWeek = computeBlockBounds(dateFromISO(todayISO)).blockStart;
  // Diagnostics describe a profile that may be broken — that is their job — so
  // this one function must not throw on a missing phase the way generation does.
  // The substitution is named and reported (`seasonPhaseAnswered` below) rather
  // than silently standing in for an answer.
  const diagnosticsClock = resolveSeasonPhaseClock({
    selectedPhase: generationProfile.seasonPhase ?? DIAGNOSTICS_PHASE_WHEN_UNANSWERED,
    targetWeekStartISO: diagnosticsWeek,
  }).clock;
  const derivedPlan = plan ?? buildInitialGeneratedCoachingPlan({
    coachingInputs: derivedInputs,
    profile: generationProfile,
    todayISO,
    seasonPhaseClock: diagnosticsClock,
  });
  const derivedMessage = message ?? buildGenerationPrompt(
    generationProfile,
    derivedPlan,
    resolvedEquipmentTags,
    resolvedConditioningModalities,
  );
  const roleContext = buildRoleContext(generationProfile);
  const profileFields = Object.keys(generationProfile).sort();
  const profileFieldDiagnostics = getProgramGenerationProfileFieldDiagnostics(generationProfile);
  const payloadShape = {
    messages: [{ role: 'user', content: '[generation prompt omitted from log]' }],
    athleteProfile: '[onboarding profile object]',
    roleContext: '[selected role + programming bias]',
    coachingPlan: '[coaching constraints object]',
    mode: 'generate',
  };
  const payloadForSize = buildProgramGenerationEdgePayload({
    generationProfile,
    message: derivedMessage,
    coachingPlan: derivedPlan.constraints,
    resolvedEquipmentTags,
    resolvedConditioningModalities,
  });

  return {
    endpoint: env.coachChatEndpoint || '(missing)',
    functionName: 'coach-chat',
    mode: 'generate',
    payloadShape,
    request: {
      messageCount: 1,
      promptWords: derivedMessage.split(/\s+/).filter(Boolean).length,
      promptPreview: previewBody(derivedMessage, 240),
      approxPayloadBytes: JSON.stringify(payloadForSize).length,
    },
    profile: {
      presentFields: profileFields,
      missingRequired: profileFieldDiagnostics.missingRequired,
      missingRecommended: profileFieldDiagnostics.missingRecommended,
      // Makes the diagnostics-only phase substitution above visible in the log
      // instead of reading as an answer the athlete gave.
      seasonPhaseAnswered: Boolean(generationProfile.seasonPhase),
      summary: {
        firstName: generationProfile.firstName ?? null,
        position: generationProfile.position ?? null,
        roleLabel: generationProfile.position ? roleBucketLabel(generationProfile.position) : null,
        selectedRole: roleContext.selectedRole,
        selectedRoleLabel: roleContext.selectedRoleLabel,
        programmingRoleBias: roleContext.programmingRoleBias,
        programmingRoleBiasLabel: roleContext.programmingRoleBiasLabel,
        seasonPhase: generationProfile.seasonPhase ?? null,
        gameDay: generationProfile.gameDay ?? null,
        usualGameDay: generationProfile.usualGameDay ?? null,
        teamTrainingDaysPerWeek: generationProfile.teamTrainingDaysPerWeek ?? null,
        teamTrainingDays: generationProfile.teamTrainingDays ?? [],
        trainingDaysPerWeek: generationProfile.trainingDaysPerWeek ?? null,
        preferredTrainingDays: generationProfile.preferredTrainingDays ?? [],
        trainingLocation: generationProfile.trainingLocation ?? null,
        equipmentCount: generationProfile.equipment?.length ?? 0,
        resolvedEquipmentTags,
        resolvedConditioningModalities,
        goalsCount: generationProfile.goals?.length ?? 0,
        injuriesCount: generationProfile.injuries?.length ?? 0,
        conditioningLevel: generationProfile.conditioningLevel ?? null,
        sprintExposure: generationProfile.sprintExposure ?? null,
        recentTrainingLoad: generationProfile.recentTrainingLoad ?? null,
      },
    },
    coachingPlan: {
      capacity: derivedPlan.capacity,
      weeklyPlanCount: derivedPlan.weeklyPlan.length,
      coreSessions: derivedPlan.coreSessions,
      optionalSessions: derivedPlan.optionalSessions,
      recoverySessions: derivedPlan.recoverySessions,
      constraintNoteCount: derivedPlan.constraints.notes.length,
      weeklyPlan: derivedPlan.weeklyPlan.map((session) => ({
        planEntryId: session.planEntryId,
        dayOfWeek: session.dayOfWeek,
        tier: session.tier,
        focus: session.focus,
        strengthIntent: session.strengthIntent ?? null,
        strengthPatternContributions: session.strengthPatternContributions ?? [],
        isHardExposure: session.isHardExposure,
      })),
    },
  };
}

/**
 * Response shape from the coach-chat edge function
 */
interface CoachResponse {
  reply: string;
  programUpdate?: {
    workouts: Array<{
      planEntryId?: string;
      strengthIntent?: StrengthIntent;
      dayOfWeek: number;
      name: string;
      workoutType: string;
      sessionTier?: string;
      exercises: Array<{
        name: string;
        sets: number;
        repsMin: number;
        repsMax: number;
        weight?: number;
        notes?: string;
        supersetGroup?: string;
        supersetOrder?: number;
        pairType?: string;
      }>;
    }>;
  } | null;
  newNotes?: string[] | null;
}

type GeneratedWorkout = NonNullable<NonNullable<CoachResponse['programUpdate']>['workouts']>[number];

const VALID_APP_WORKOUT_TYPES = new Set([
  'Strength',
  'Conditioning',
  'Technical',
  'Recovery',
  'Mixed',
  'Flush-Out',
  'Sprint-Intervals',
  'Team Training',
  'Game',
  'Nordic-4x4',
  'Long-Run',
  'MetCon',
  'Flog-Friday',
  '6x1km',
  'Hill-Sprints',
  'MAS-Training',
  'Tempo-Run',
  'Quality-Sprints',
]);
const VALID_SESSION_TIERS = new Set(['core', 'optional', 'recovery']);
const WORKOUT_TYPE_TIER_LABELS = new Set(['core', 'optional', 'recovery']);
const RAW_WORKOUT_TYPE_VALUES_NORMALIZED_BY_CLIENT = new Set([
  'core',
  'optional',
  'recovery',
  'team',
]);

function countValues(values: unknown[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    const key = String(value ?? '').trim() || '(missing)';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(
    values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  ));
}

function summarizeExerciseShape(exercises: unknown) {
  const isArray = Array.isArray(exercises);
  const rows = isArray ? exercises as any[] : [];
  return {
    exercisesIsArray: isArray,
    exerciseCount: isArray ? rows.length : null,
    exerciseIdsExpectedFromAI: false,
    missingNameCount: rows.filter((ex) => !String(ex?.name ?? '').trim()).length,
    missingSetsCount: rows.filter((ex) => !Number.isFinite(Number(ex?.sets))).length,
    missingRepsMinCount: rows.filter((ex) => !Number.isFinite(Number(ex?.repsMin))).length,
    missingRepsMaxCount: rows.filter((ex) => !Number.isFinite(Number(ex?.repsMax))).length,
  };
}

function buildGeneratedWorkoutAcceptanceDiagnostics(workouts: GeneratedWorkout[] | null | undefined) {
  const rows = Array.isArray(workouts) ? workouts : [];
  const rawWorkoutTypes = rows.map((w) => w?.workoutType);
  const rawSessionTiers = rows.map((w) => w?.sessionTier);
  const rawWorkoutTypesNotInAppEnum = uniqueStrings(rawWorkoutTypes)
    .filter((type) => !VALID_APP_WORKOUT_TYPES.has(type));
  const tierLabelsInWorkoutType = rawWorkoutTypesNotInAppEnum
    .filter((type) => WORKOUT_TYPE_TIER_LABELS.has(type));
  return {
    receivedProgramUpdateWorkouts: Array.isArray(workouts),
    workoutCount: rows.length,
    workoutTypes: countValues(rawWorkoutTypes),
    sessionTiers: countValues(rawSessionTiers),
    rawWorkoutTypesNotInAppEnum,
    tierLabelsInWorkoutType,
    rawWorkoutTypesNormalizedByClient: rawWorkoutTypesNotInAppEnum
      .filter((type) => RAW_WORKOUT_TYPE_VALUES_NORMALIZED_BY_CLIENT.has(type)),
    invalidWorkoutTypesAfterClientTolerance: rawWorkoutTypesNotInAppEnum
      .filter((type) => !RAW_WORKOUT_TYPE_VALUES_NORMALIZED_BY_CLIENT.has(type)),
    invalidSessionTiers: uniqueStrings(rawSessionTiers)
      .filter((tier) => !VALID_SESSION_TIERS.has(tier)),
    workoutTypeCoreIsInvalidAppEnum: rawWorkoutTypesNotInAppEnum.includes('core'),
    workoutTypeCoreWillNormalizeClientSide: rawWorkoutTypesNotInAppEnum.includes('core'),
    workoutTypeTeamWillNormalizeClientSide: rawWorkoutTypesNotInAppEnum.includes('team'),
    sessionTierCoreIsValid: rawSessionTiers.some((tier) => String(tier ?? '').trim() === 'core'),
    normalizerExpectations: {
      workoutDatesExpectedFromAI: false,
      exerciseIdsExpectedFromAI: false,
      requiredExercisePrescriptionFields: ['name', 'sets', 'repsMin', 'repsMax'],
    },
    workouts: rows.map((w, index) => ({
      index,
      dayOfWeek: w?.dayOfWeek ?? null,
      name: w?.name ?? null,
      workoutType: w?.workoutType ?? null,
      sessionTier: w?.sessionTier ?? null,
      exerciseShape: summarizeExerciseShape((w as any)?.exercises),
    })),
  };
}

function errorDiagnostic(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/**
 * Call the coach-chat edge function to generate a personalised program.
 *
 * Flow:
 * 1. Coaching engine calculates readiness, hard exposures, session tiers (deterministic)
 * 2. AI receives those constraints and generates exercises, progression, coaching tone
 *
 * "Code decides the dose. AI decides the details."
 */
/**
 * ── R-091: THE CODE BUILDS THE WEEK. THE AI DOES NOT. ──────────────────────
 *
 * Sam, 2026-08-14, verbatim: *"it makes sense to just remove the ai from
 * building week 1 or doing a complete rebuild in the app (never going to happen
 * for an athlete) - so i think it's more elegant that the code just builds the
 * first block, then updates for the second block based on what they did etc"*.
 *
 * **THIS IS THE ONE DOOR EVERY PRODUCTION CALLER USES** — onboarding's
 * `CompleteScreen`, `useProgramRebuild`, `coachTurnController` and
 * `coachProgramEdit`'s injected generator all arrive here. Severing it here
 * rather than at four call sites removes REACHABILITY in one place: there is no
 * argument, flag or option that reaches the removed path, because the path is
 * gone.
 *
 * **WHAT WAS DELETED:** 528 lines that built a generation prompt, posted a
 * generate-mode payload to the coach edge function and parsed a week back out
 * of the reply. **THE ENDPOINT ITSELF IS SHARED WITH COACH CHAT**
 * (`env.coachChatEndpoint`, also posted to by `CoachScreen`), so the ENDPOINT
 * and its plumbing are untouched — only the generation MODE is gone. The AI
 * still converses and explains; it no longer builds.
 *
 * **IT STAYS `async`, AND THAT IS DELIBERATE.** Every caller awaits it. Making
 * it synchronous would be a signature change rippling through four screens for
 * no behavioural gain, and this slice changes ownership, not output.
 *
 * **THE SECOND HALF OF HIS QUOTE IS NOT CLAIMED HERE.** *"then updates for the
 * second block based on what they did"* is the history-responsive progression
 * work and belongs to its own slice; nothing below implements it.
 */
export async function generateProgramFromProfile(
  onboardingData: OnboardingData,
  options: GenerateProgramFromProfileOptions = {},
): Promise<TrainingProgram> {
  return generateProgramLocally(onboardingData, options);
}

/**
 * Map day name to dayOfWeek number (0=Sun, 1=Mon, ..., 6=Sat)
 */
const DAY_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

/**
 * Build the user message for program generation.
 *
 * LEAN: the system prompt + athlete context + coaching constraints already contain
 * all rules and athlete details. This message just provides the weekly skeleton
 * from the coaching engine so the AI knows what sessions to fill.
 *
 * Previously ~120 lines / ~1500 words. Now ~40 lines / ~400 words.
 */
export function buildGenerationPrompt(
  data: OnboardingData,
  plan: CoachingPlan,
  resolvedEquipmentTags: readonly EquipmentTag[] = resolveEquipmentAvailability(data),
  resolvedConditioningModalities?: readonly ConditioningEquipmentModality[],
): string {
  const c = plan.constraints;
  const parts: string[] = [];
  const profileEquipment = resolveEquipmentCapabilities(data);
  const equipment = {
    ...profileEquipment,
    tags: [...resolvedEquipmentTags],
    conditioningModalities: [...(
      resolvedConditioningModalities ??
      (resolvedEquipmentTags.includes('bike_or_treadmill')
        ? profileEquipment.conditioningModalities
        : [])
    )],
  };
  const weeklyPlan = resolveWeeklyConditioningFeasibility(plan.weeklyPlan, {
    phase: data.seasonPhase,
    offseasonSubphase: plan.offseasonSubphase,
    preseasonSubphase: plan.preseasonSubphase,
    equipment,
    profile: data,
  });

  parts.push('Generate my initial training program using the update_program tool.');

  // ─── Exercise vocabulary (the generator does not get naming rights) ───
  // The curated layer owns every athlete-visible word, so it must also own the
  // NAMES the model is allowed to return. Before this, generation invented
  // superset spellings of curated movements ("Single Arm Half Kneeling OHP
  // (DB)") and the athlete got a card with no coaching cue at all (device run
  // 5). Widening the ingress matcher alone is a tail-chase while the generator
  // can name anything; the fix is upstream — offer the vocabulary and require
  // selection from it. Derived from the curated cue layer (never hand-copied),
  // so a cue Sam authors is offered on the very next generation.
  //
  // GROUPED, because the grouping retires a second representation. `coach-chat`
  // used to carry its own hand-copied "MOVEMENT PATTERNS" list to teach the
  // model which pattern each exercise belonged to — a list that could drift
  // from the pools with nothing to catch it. Emitting the vocabulary grouped by
  // the pool slot that owns each name teaches BOTH the names and the patterns
  // from ONE derived source, so that list could be deleted rather than synced.
  parts.push('\nEXERCISE VOCABULARY (authoritative — these are the ONLY exercise names that exist,');
  parts.push('grouped by movement pattern; every exercise belongs to exactly one group):');
  for (const group of selectableVocabularyGroups()) {
    parts.push(`${group.label}: ${group.names.join(' | ')}`);
  }
  parts.push(
    'Every exercise `name` you return must be copied EXACTLY from that list, character for '
    + 'character. Do NOT invent a new name, abbreviate one ("OHP", "SA"), pluralise one '
    + '("Hamstring Curls"), or add a qualifier in brackets or in front ("(DB)", "Incline …"). '
    + 'If the movement you had in mind is not listed, pick the closest listed movement instead. '
    + 'The client refuses any program containing a name that is not in this vocabulary.',
  );

  if (data.position) {
    const roleContext = buildRoleContext(data);
    parts.push('\nROLE BIAS:');
    parts.push(`• Athlete selected role: ${roleContext.selectedRoleLabel} (${roleContext.selectedRole}).`);
    parts.push(`• Programming role bias: ${roleContext.programmingRoleBias} — ${roleContext.programmingRoleBiasLabel}. Outside mid and High forward / back use the same programming bias.`);
    parts.push('• Do not let role override season phase, game day, team training, injuries, fatigue, training age, strength, fitness, goals, availability, or the weekly skeleton below.');
  }

  // ─── Weekly skeleton from coaching engine ───
  if (weeklyPlan.length > 0) {
    parts.push('\nWEEKLY PLAN (from coaching engine — fill each session with exercises):');
    if (c.weeklyExposureContract) {
      const exposure = c.weeklyExposureContract;
      parts.push(
        `WEEKLY EXPOSURE CONTRACT (${exposure.identity.mode}): strength=${exposure.strength.targetCount} ` +
        `[${exposure.strength.requiredPatterns.join('+')}]; conditioning=${exposure.conditioning.targetCount} ` +
        `(team credit=${exposure.conditioning.creditedTeamTrainingCount}, ` +
        `game/practice credit=${exposure.conditioning.creditedGameOrPracticeMatchCount}, ` +
        `additional components=${exposure.conditioning.additionalRequiredCount}); ` +
        `sprint/COD=${exposure.sprintCod.targetCount}; ` +
        `preferred hard days=${exposure.hardDays.preferredCount}, ` +
        `permitted=${exposure.hardDays.permittedCount}; ` +
        `minimum full rest days=${exposure.recovery.minimumFullRestDays}.`,
      );
      parts.push('This contract and the planEntryId skeleton below are authoritative. Do not omit or downgrade an allocated strength or conditioning component.');
    }
    // Prefer the new DayOfWeek-typed usualGameDay; fall back to legacy gameDay.
    // Without this, the G-offset labels disagree with the engine's weeklyPlan
    // (engine already uses usualGameDay via onboardingToCoachingInputs).
    const effectiveGameDay = storedGameAnchor(data);
    const gameDayNum = effectiveGameDay ? DAY_MAP[effectiveGameDay] : null;
    weeklyPlan.forEach((session) => {
      let gLabel = '';
      if (gameDayNum !== null && session.dayOfWeek) {
        const dayNum = DAY_MAP[session.dayOfWeek];
        if (dayNum !== undefined) {
          let diff = dayNum - gameDayNum;
          if (diff > 0) diff -= 7;
          if (diff === -6) diff = 1;
          gLabel = diff === 0 ? ' (GAME DAY)' : ` (G${diff > 0 ? '+' : ''}${diff})`;
        }
      }
      const intent = session.strengthIntent;
      const patternLabel = intent
        ? ` [STRENGTH INTENT: archetype=${intent.archetype}; primary=${intent.primaryPattern ?? 'none'}; planned=${intent.plannedPatterns.join('+') || 'none'}]`
        : '';
      const feasibility = session.conditioningFeasibility;
      const feasibilityLabel = feasibility
        ? ` [CONDITIONING FEASIBILITY: ${feasibility.status}; allowed=${feasibility.allowedModalities.join('+') || 'none'}; resolved=${feasibility.resolvedModality ?? 'default'}]`
        : '';
      parts.push(`  ${session.dayOfWeek || 'TBD'}${gLabel}: planEntryId=${session.planEntryId ?? 'missing'} [${session.tier.toUpperCase()}]${patternLabel}${feasibilityLabel} ${session.focus}${session.isHardExposure ? ' (HARD)' : ''}`);
    });
    const expectedDayNumbers = weeklyPlan
      .map((session) => session.dayOfWeek ? DAY_MAP[session.dayOfWeek] : null)
      .filter((day): day is number => day !== null);
    parts.push(`\nReturn exactly one workout object for every WEEKLY PLAN line above. Do not omit optional, recovery, team-training, or Saturday sessions. Expected numeric dayOfWeek values: ${expectedDayNumbers.join(', ')}.`);
    parts.push('Copy each planEntryId exactly into its workout object. STRENGTH INTENT is authoritative: use its primary pattern for main-lift emphasis and include meaningful lower-dose work for every other planned pattern. Do not infer exact pattern credit from focus or names. Minor balancing accessories are okay, but do not add another session\'s main pattern.');
    parts.push('Do not put conditioning, running, ergs, jumps, plyometrics, explosive presses or contrast work inside ordinary strength exercises unless the WEEKLY PLAN explicitly assigns that component. The client enforces this contract.');
    parts.push('\nFollow the above tiers EXACTLY. Do NOT promote OPTIONAL/RECOVERY to CORE.');
  }

  if (data.seasonPhase === 'Off-season' && weeklyPlan.every((session) => session.tier === 'optional')) {
    parts.push('\nEARLY OFF-SEASON WEEKS 1-2: every session is OPTIONAL; use 8-12 rep body-armour strength and easy off-feet aerobic/base work only. No running, power, jumps, explosive push-ups or contrast pairings.');
  }

  const setupConstraints = formatAvailabilityConstraintsForPrompt(data);
  const rawEquipment = data.equipment?.filter(Boolean) ?? [];
  if (setupConstraints.length > 0) {
    parts.push('\nPROGRAM SETUP CONSTRAINTS:');
    setupConstraints.forEach((line) => parts.push(`• ${line}`));
  }
  parts.push('\nEQUIPMENT AVAILABILITY:');
  parts.push(`• Canonical available equipment tags: ${resolvedEquipmentTags.join(', ')}.`);
  parts.push(`• Canonical conditioning modalities: ${equipment.conditioningModalities.join(', ') || 'none'}. These are authoritative; treadmill is not off-feet.`);
  if (rawEquipment.length > 0) {
    parts.push(`• Raw checklist values: ${rawEquipment.join(', ')}. Use the canonical tags above as the source of truth.`);
  } else {
    parts.push(`• Raw checklist is empty; canonical tags are inferred from trainingLocation=${data.trainingLocation ?? 'Commercial gym'}.`);
  }

  // ─── Safety notes (engine-generated, always relevant) ───
  if (c.notes.length > 0) {
    parts.push('\nSAFETY:');
    c.notes.forEach((n) => parts.push(`• ${n}`));
  }

  // ─── Phase-specific conditioning note ───
  if (c.phase === 'Off-season' && c.conditioningLoading !== 'light-only') {
    parts.push('\nFinish CORE sessions with 20-30min conditioning. Hit all 3 energy systems across the week.');
  } else if (c.phase === 'Pre-season') {
    // Pre-season is a dedicated ruleset — team training days are field-load
    // anchors and conditioning is built around them, not on top of them.
    parts.push('\nPRE-SEASON RULES (dedicated — not off-season + team, not in-season lite):');
    parts.push('• Team training days = PRIMARY FIELD-LOAD ANCHORS. Build the week AROUND them.');
    parts.push('• NO separate conditioning on a team training day (no tempo, VO2, glycolytic, sprint, or finisher alongside team).');
    parts.push('• NO heavy lower strength on a team training day. Allowed: light upper, light full body, accessories, or recovery only.');
    parts.push('• NO standalone sprint/speed conditioning on the day BEFORE or AFTER a team training day.');
    parts.push('• Standalone conditioning priority: VO2 + glycolytic first, then aerobic base. Team training already covers sprint + aerobic.');
    parts.push('• REDUCED standalone conditioning volume vs off-season (team sessions carry substantial load).');
    if (c.conditioningLoading !== 'light-only') {
      parts.push('• Fill remaining non-team days with complementary gym (heavier lower, structured upper) and 2-3 standalone conditioning sessions max.');
    }
  }

  return parts.join('\n');
}

function formatAvailabilityConstraintsForPrompt(data: OnboardingData): string[] {
  return (data.availabilityConstraints ?? [])
    .filter((constraint) => constraint.active !== false)
    .map((constraint) => {
      if (constraint.kind === 'unavailable_day' && constraint.dayOfWeek) {
        const range = constraint.scope === 'temporary'
          ? ` from ${constraint.startDate ?? 'now'} to ${constraint.endDate ?? 'the stated end date'}`
          : '';
        const reason = constraint.reason ? ` (${constraint.reason})` : '';
        return `${constraint.dayOfWeek} is unavailable${range}${reason}. Do not schedule training there. If this conflicts with team training or game day, preserve the availability constraint and move other work away.`;
      }
      if (constraint.kind === 'time_limit' && constraint.dayOfWeek && constraint.maxSessionMinutes) {
        const range = constraint.scope === 'temporary'
          ? ` from ${constraint.startDate ?? 'now'} to ${constraint.endDate ?? 'the stated end date'}`
          : '';
        return `${constraint.dayOfWeek} has a ${constraint.maxSessionMinutes} minute training cap${range}. Keep that day short or move load elsewhere.`;
      }
      if (constraint.kind === 'travel') {
        const range = constraint.startDate || constraint.endDate
          ? ` from ${constraint.startDate ?? 'the start date'} to ${constraint.endDate ?? 'the end date'}`
          : '';
        return `Athlete is away${range}. Ask or avoid scheduling sessions in that window if dates are incomplete.`;
      }
      return '';
    })
    .filter(Boolean);
}

/**
 * Build a descriptive program name
 */
function buildProgramName(data: OnboardingData, plan: CoachingPlan): string {
  const phase = data.seasonPhase || 'Training';
  const core = plan.coreSessions;
  const total = plan.coreSessions + plan.optionalSessions + plan.recoverySessions;
  return `${phase} Program — ${core} Core + ${total - core} Support`;
}
