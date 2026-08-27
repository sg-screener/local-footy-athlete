import { compileCanonicalProgram, type CanonicalProgramCompilerInput } from '../../rules/canonicalProgramCompiler';
import { compileCanonicalProgramWeeks, canonicalReadinessFactFrom, canonicalIllnessFactFrom, type CanonicalProgramWeeksInput } from '../../rules/canonicalWeeklyRowCompiler';
export { GeneratedWeekRefusedError } from '../../rules/canonicalWeeklyRowCompiler';
import { OnboardingData, TrainingProgram, Microcycle, type DayOfWeek, type ConditioningEquipmentModality, type Workout } from '../../types/domain';
import { buildWorkoutsFromCoach } from '../../data/defaultProgram';
import { previousBlockBoundsISO } from '../../utils/programBlockState';
import { progressedFromOwnHistory, readBlockHistory } from '../../rules/blockBoundaryProgression';
import { composedIdentityFor } from '../../rules/composedRowLegality';
import { deriveProfileReadiness } from '../../utils/readiness';
import {
  onboardingToCoachingInputs,
  type CoachingInputs,
  type CoachingPlan,
  type AIConstraints,
} from '../../utils/coachingEngine';
import { todayISOLocal } from '../../utils/appDate';
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
  buildGenerationConstraintContext,
  type GenerationConstraintContext,
} from '../../utils/generationConstraints';
import { canonicalWeeklyInjuryStateFrom } from '../../rules/canonicalWeeklyInjuryState';
import { buildReadinessActiveConstraints } from '../../utils/readinessConstraints';
import type { ReadinessSignal } from '../../utils/readiness';
import type { EquipmentTag } from '../../data/exercisePools';
import { logger } from '../../utils/logger';
import {
  resolveEquipmentAvailability,
  resolveEquipmentCapabilities,
  type ResolvedEquipmentCapabilities,
} from '../../utils/equipmentAvailability';
import type { StrengthIntent } from '../../rules/strengthPatternContributions';
import {
  resolveWeeklyConditioningFeasibility,
} from '../../rules/conditioningFeasibility';
import { storedGameAnchor } from '../../rules/gameAnchor';
import { compileCanonicalWeek } from '../../rules/canonicalWeeklyCompiler';
import {
  canonicalWeeklyScheduledDeloadStateFrom,
} from '../../rules/canonicalWeeklyScheduledDeloadState';
import { resolveTrainingAgePolicy } from '../../rules/trainingAgePolicy';
import type { OffseasonSubphase } from '../../rules/offseasonSubphase';
import { WeeklyScheduleRefusedError, ageFromRange, offseasonBlockFrom } from '../../rules/weeklySchedulerInputs';
import type { AcceptedStateOperationKind } from '../../store/acceptedStateTransaction';
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
import {
  ExerciseVocabularyViolation,
  canonicalExerciseName,
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
 * The athlete's gender, or a refusal — R-130's field applied the same way as
 * seasonPhase. *"No it can't be changed after onboarding"*, *"there are no
 * existing athletes"* — the answer is REQUIRED and has NO DEFAULT, so a profile
 * without one is refused rather than silently generated as male. The flow's
 * required Gender step means no athlete reaches generation in this state
 * through the app; this door exists so a dev seed, a test fixture or a future
 * writer cannot manufacture a default-for-the-unrecorded.
 */
export function generationGenderOrThrow(
  profile: OnboardingData,
): NonNullable<OnboardingData['gender']> {
  if (profile.gender !== 'male' && profile.gender !== 'female') {
    throw new ProgramGenError(
      'missing_required_profile',
      'I still need to know your gender before I can build your program.',
      'generation refused: onboarding never collected gender (R-130)',
      false,
      { missingRequired: missingRequiredProfileFields(profile) },
    );
  }
  return profile.gender;
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
  // R-130: refused at the same door, for the same reason, in the same breath.
  generationGenderOrThrow(profile);
  const previousProgram = currentPersistedProgram(options);
  return resolveSeasonPhaseClock({
    selectedPhase,
    targetWeekStartISO: blockStartISO,
    seasonFinishedOn: profile.seasonFinishedOn,
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
  // Diagnostics and prompt previews enter the same compiler as product
  // generation. They no longer carry a private schedule/materialise/connect
  // orchestration that can drift from the week the athlete receives.
  const inputs = args.coachingInputs;
  const weekStartISO = firstState?.weekStart ?? blockStart;
  const schedInputs = coachingInputsToSchedulerInputs(inputs, {
    weekStartISO,
    offseasonSubphase: firstState?.phaseResolution.offseasonSubphase ?? null,
  });
  const agePolicy = resolveTrainingAgePolicy(inputs.experienceLevel);
  const weeklyInjury = canonicalWeeklyInjuryStateFrom({
    profile: { injuries: inputs.injuries ?? [] },
    generationConstraints: inputs.generationConstraints,
  });
  const compiled = compileCanonicalWeek({
    scheduler: schedInputs,
    coaching: inputs,
    readiness: canonicalReadinessFactFrom(inputs.generationConstraints),
    illness: canonicalIllnessFactFrom(inputs.generationConstraints),
    scheduledDeload: canonicalWeeklyScheduledDeloadStateFrom({
      weekStartISO,
      seasonPhase: inputs.seasonPhase,
      weekKind: firstState?.weekKind,
    }),
    injury: weeklyInjury,
    materialisation: {
      weekStartISO,
      miniCycleNumber: firstState?.miniCycleNumber,
      powerGoalNudge: false,
      runOnly: false,
      phase: inputs.seasonPhase as never,
      offseasonSubphase: firstState?.phaseResolution.offseasonSubphase ?? null,
    },
    connector: {
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
      v1Input: {
        seasonPhase: inputs.seasonPhase,
        weekKind: firstState?.weekKind,
        offseasonSubphase: firstState?.phaseResolution.offseasonSubphase ?? null,
        preseasonSubphase: firstState?.phaseResolution.preseasonSubphase ?? null,
        maxStrengthSessions: agePolicy.maxCoreSessions,
        byeMode: inputs.byeMode,
      } as never,
    },
  });
  if (compiled.ok === false) throw new WeeklyScheduleRefusedError(compiled.refusal);
  return compiled.plan;
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
  const offSeason = inputs.seasonPhase === 'Off-season';
  return {
    weekStartISO: args.weekStartISO,
    phase: inputs.seasonPhase as never,
    offseasonBlock: offseasonBlockFrom(args.offseasonSubphase),
    gymAccessDays: nums(inputs.selectedDays),
    clubNights: offSeason ? [] : nums(inputs.teamTrainingDays),
    gameDay: !offSeason && inputs.hasGame ? toNumber(inputs.gameDay) : null,
    // **ALWAYS RECURRING.** `hasGame` + a usual game day means there was a
    // fixture last week too, so a Sunday game makes Monday G+1. Nothing in
    // `CoachingInputs` can say "first fixture ever", so nothing here claims it.
    fixtureRecurrence: 'recurring' as const,
    age: ageFromRange((inputs as { ageRange?: never }).ageRange),
    // R-130: carried verbatim from CoachingInputs (which carried it verbatim
    // from the profile) — translation, not a decision.
    athleteGender: inputs.gender,
    readiness: {
      // The compiler owns the readiness fact and overwrites this neutral value.
      lowReadiness: false,
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
 * WHAT THE COMPOSER IS TOLD ABOUT EXCLUSIONS, BUILT IN ONE PLACE.
 *
 * The scoped decisions are the truth (`prefs.exclusions`). The legacy flat
 * `excluded` array is still unioned in as a WEEK-WIDE set, because a caller may
 * hand-build `athletePrefs` and never go near the store — tests, dev seeds and
 * the coach path all do — and a hand-built list has always meant "out, full
 * stop". Dropping it here would silently un-ban those athletes' exercises.
 */
/**
 * ⚠ **A REPLAY MAY NOT RE-DECIDE A BLOCK BECAUSE AN EXCLUSION APPEARED.**
 *
 * Sam, 2026-08-19: *"Remove means simply remove the selected exercise/component.
 * Nothing replaces it ... Do not ask the composer to fill the empty slot."*
 *
 * MEASURED, and it is the reason this function exists. An athlete removed
 * `RDLs` for the block, closed the app and reopened it. The boot regenerates
 * (`quiescentBoot`), the exclusion narrowed the hinge slot's legal candidates,
 * `decideExerciseForBlock`'s *restore-before-decide* rule could no longer
 * restore the recorded `RDLs`, and it made an honest new decision:
 * **`Deadlift@77.5` walked into the hinge slot.** The athlete removed a lift and
 * got a different lift back for closing the app. The read filter could not save
 * them — it removes `RDLs`, and the row was no longer `RDLs`.
 *
 * This is the SAME defect class the `'author' | 'replay'` distinction was
 * introduced for on 2026-08-18 (LAW `hidden-authority-never-authors`): a
 * reversible, dated athlete decision reaching a layer entitled to author
 * permanent structure. That fix stopped a replay RECORDING the re-derived
 * selection; it did not stop a replay MAKING one. This is the other half.
 *
 *   - `'author'` — this door decides the block (onboarding, acceptance,
 *     rollover). A block being authored for the first time simply never chooses
 *     an excluded exercise. That is *"until restored removes it from ... future
 *     sessions/blocks"*, and it is authoring, not refilling.
 *   - `'replay'` / a probe — this caller reconstructs a block it did not decide.
 *     The athlete's removal is owned end-to-end by the read-time filter
 *     (`rules/exerciseExclusions.applyExclusionsToAuthoredDay`), which takes the
 *     row out and puts nothing back. So the replay must rebuild the block the
 *     athlete actually has, `RDLs` and all, and let the filter do the removing.
 *
 * **ONLY THE DATED DECISIONS ARE WITHHELD.** `prefs.excluded` — the flat,
 * undated "avoid this forever" list a caller may hand-build — is untouched, for
 * the reason `composerExclusionInput` already states: a hand-built list has
 * always meant "out, full stop", and silently un-banning those athletes'
 * exercises on every boot would be a second defect wearing this one's clothes.
 */
function exclusionsForSelectionAuthority(
  prefs: AthletePoolPrefsArg,
  recordSelections: 'author' | 'replay' | false | undefined,
): AthletePoolPrefsArg {
  // ONLY AN EXPLICIT REPLAY IS WITHHELD FROM. `'author'`, `false` and absent all
  // author: a probe that asks "would a 2-day week even build?" must see the
  // athlete's world as it is, and a caller that has not declared itself has not
  // declared itself a replay. Narrowing this to `!== 'author'` also withheld
  // from every probe and reddened nine cells that are right about the contract.
  if (recordSelections !== 'replay') return prefs;
  const dated = prefs?.exclusions ?? [];
  if (dated.length === 0) return prefs;
  // ⚠ **CLEARING `exclusions` ALONE IS NOT ENOUGH, AND THE FIRST CUT DID
  // EXACTLY THAT AND CHANGED NOTHING.** `getAthletePrefs` is a PROJECTION: it
  // derives `excluded` from `exclusions` for the day being read
  // (`store/athletePreferencesStore.ts`), and `composerExclusionInput` unions
  // that derived list in as a week-wide ban. Withholding the decisions while
  // leaving their own projection behind withholds nothing.
  //
  // So the derived names are withdrawn BY NAME, which leaves a genuinely
  // hand-built `excluded` list — the tests', the dev seeds' and the coach
  // path's — exactly as it arrived.
  const derived = new Set(dated.map((exclusion) => exclusion.exercise));
  return {
    ...prefs,
    exclusions: [],
    excluded: (prefs?.excluded ?? []).filter(
      (name) => !derived.has(canonicalExerciseName(String(name ?? '').trim())),
    ),
  };
}

/** Compatibility entry for existing callers; final row policy lives in the compiler. */
export function buildGeneratedMicrocycles(args: Omit<CanonicalProgramWeeksInput, 'authoredAtISO'> & {
  plansOut?: CoachingPlan[]; selectionsOut?: import('../../rules/blockExerciseSelection').BlockExerciseSelection[];
}): Microcycle[] {
  const result = compileCanonicalProgramWeeks({ ...args, authoredAtISO: new Date(args.blockStartISO + 'T12:00:00').toISOString() });
  args.plansOut?.push(...result.plans);
  args.selectionsOut?.push(...result.selections);
  for (const diagnostic of result.diagnostics) logger.warn('[ProgramGen] ' + diagnostic.message, diagnostic.details);
  return result.microcycles;
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
export function canonicalProgramInputFromProfile(
  onboardingData: OnboardingData,
  options: GenerateProgramFromProfileOptions = {},
): CanonicalProgramCompilerInput {
  const effectiveTodayISO = options.todayISO ?? todayISOLocal();
  const availabilityDateISO = effectiveTodayISO;
  const { blockStart, blockEnd } = generationBlockBounds(options, effectiveTodayISO);
  const activeConstraintsForGeneration = collectActiveConstraintsForGeneration(options, availabilityDateISO);
  const generationConstraints = resolveGenerationConstraints(options, availabilityDateISO);
  const baseProfile = normalizeOnboardingRole(onboardingData);
  const generationInjury = canonicalWeeklyInjuryStateFrom({
    profile: baseProfile,
    generationConstraints,
  });
  const generationProfile: OnboardingData = {
    ...baseProfile,
    injuries: [...generationInjury.mergedProfileInjuries],
  };
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
  const coachingInputs = onboardingToCoachingInputs(generationProfile, {
    availabilityDateISO,
    generationConstraints,
    phaseWeekNumber: phaseResolution.phaseWeekNumber,
    phaseClock: phaseResolution.clock,
    phaseClockProvenance: phaseResolution.provenance,
    offseasonSubphase: phaseResolution.offseasonSubphase ?? undefined,
    preseasonSubphase: phaseResolution.preseasonSubphase ?? undefined,
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
  /**
   * THE ATHLETE'S PREFS AS THEY ACTUALLY ARE, CAPTURED BEFORE THEY ARE NARROWED.
   *
   * `exclusionsForSelectionAuthority` deliberately WITHHOLDS the dated decisions
   * from a REPLAY so the composer restores the recorded lift instead of choosing
   * a new one for the emptied slot — Sam, 2026-08-19: *"Remove means simply
   * remove the selected exercise/component. Nothing replaces it."* The removal
   * itself still has to happen, and it happens below, so it needs the real list.
   */
  const athletePrefsAsRecorded = options.athletePrefs ?? getAthletePrefs();

  const authoredAtISO = new Date().toISOString();
  const weeksInput: CanonicalProgramWeeksInput = {
    authoredAtISO,
    coachWorkouts: [],
    coachingInputs,
    profile: baseProfile,
    programId: 'prog-ai-1',
    microcyclePrefix: 'mc-ai',
    blockStartISO: blockStart,
    blockNumber: options.blockNumber ?? 1,
    seasonPhaseClock: phaseResolution.clock,
    athletePrefs: exclusionsForSelectionAuthority(
      athletePrefsAsRecorded,
      options.recordSelections,
    ),
    progressedIdentities,
    selectionHistory: selectionHistoryForBuild,
    availableEquipmentTags: resolvedEquipmentTags,
    availableConditioningModalities: resolvedEquipment.conditioningModalities,
    generationConstraints,
    activeConstraints: activeConstraintsForGeneration,
    temporarySourceFacts: options.temporarySourceFacts ??
      require('../../store/programStore').useProgramStore.getState()
        .acceptedMaterialContext?.temporarySourceFacts,
    weekLimit: options.microcycleLimit,
    targetWeekStartISO: getMondayISOForDate(effectiveTodayISO),
    targetFixtureDay: options.targetFixtureDay,
    targetWeekAvailability: options.targetWeekAvailability,
    weekAcceptance: options.weekAcceptance,
    remainderBoundary: options.remainderBoundary ?? null,
  };
  const localPhaseMap: Record<string, string> = {
    'Off-season': 'Base-Building',
    'Pre-season': 'Pre-Season-Skills',
    'In-season': 'In-Season',
  };

  const metadata: Omit<TrainingProgram, 'microcycles'> = {
    id: 'prog-ai-1',
    userId: 'user-default',
    name: '',
    description: 'Week rebuilt around your schedule change.',
    programPhase: (localPhaseMap[generationProfile.seasonPhase || ''] || 'Pre-Season-Skills') as TrainingProgram['programPhase'],
    seasonPhaseClock: phaseResolution.clock,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    primaryFocus: generationProfile.motivation || 'Strength and Conditioning',
    isActive: true,
    // R1.3 (shell rebuild): generation records its own anchor input.
    generationAnchorISO: effectiveTodayISO,
    createdAt: authoredAtISO,
    updatedAt: authoredAtISO,
  };

  return {
    metadata, weeks: weeksInput, exclusions: athletePrefsAsRecorded?.exclusions,
    progression: {
      blockStartISO: blockStart, blockNumber: options.blockNumber ?? 1,
      asOfISO: effectiveTodayISO,
      previousRequiredStrengthSessions: options.progressionHistory?.acceptedBlocks?.[previousBlockBoundsISO(blockStart).startISO]?.requiredStrengthSessions ?? 0,
      profile: baseProfile,
      state: {
        manualOverrides: {}, markedDays: {},
        athleteContext: { injuries: baseProfile.injuries || [], equipmentTags: [...resolvedEquipmentTags], onboardingData: baseProfile },
        seasonPhase: generationProfile.seasonPhase || null,
        gameDay: baseProfile.gameDay, usualGameDay: baseProfile.usualGameDay,
        capacity: deriveProfileReadiness(baseProfile),
        sessionFeedback: options.progressionHistory?.sessionFeedback ?? {},
        weightOverrides: options.progressionHistory?.weightOverrides ?? {},
        workoutHistory: [], blockState: options.progressionHistory?.blockState ?? null,
      },
    },
  };
}

export function generateProgramLocally(
  onboardingData: OnboardingData,
  options: GenerateProgramFromProfileOptions = {},
): TrainingProgram {
  const input = canonicalProgramInputFromProfile(onboardingData, options);
  const blockStart = input.weeks.blockStartISO;
  const compilation = compileCanonicalProgram(input);
  const { program, selections: selectionsAuthored } = compilation;
  const plan = compilation.plans[0];
  if (!plan || !program.microcycles[0]?.workouts.length) {
    throw new ProgramGenError('bad_response', 'The app could not rebuild your week. Please try again.', 'canonical compiler produced no populated week', true);
  }
  for (const diagnostic of compilation.diagnostics) logger.warn('[ProgramGen] ' + diagnostic.message, diagnostic.details);

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
  _retiredMessage?: string,
  _retiredRemoteConfig?: unknown,
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
    seasonFinishedOn: generationProfile.seasonFinishedOn,
  }).clock;
  const derivedPlan = plan ?? buildInitialGeneratedCoachingPlan({
    coachingInputs: derivedInputs,
    profile: generationProfile,
    todayISO,
    seasonPhaseClock: diagnosticsClock,
  });
  const roleContext = buildRoleContext(generationProfile);
  const profileFields = Object.keys(generationProfile).sort();
  const profileFieldDiagnostics = getProgramGenerationProfileFieldDiagnostics(generationProfile);

  return {
    owner: 'local-program-composer',
    mode: 'local',
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
    injury: canonicalWeeklyInjuryStateFrom({ profile: data }),
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
