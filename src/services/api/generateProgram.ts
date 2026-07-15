import {
  OnboardingData,
  TrainingProgram,
  Microcycle,
  type DayOfWeek,
  type ConditioningEquipmentModality,
  type Workout,
} from '../../types/domain';
import { buildWorkoutsFromCoach } from '../../data/defaultProgram';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingInputs,
  type CoachingPlan,
  type AIConstraints,
} from '../../utils/coachingEngine';
import { todayISOLocal } from '../../utils/appDate';
import { getAthletePrefs } from '../../store/athletePreferencesStore';
import { useCoachUpdatesStore, type ActiveConstraint } from '../../store/coachUpdatesStore';
import { useReadinessStore } from '../../store/readinessStore';
import {
  buildBlockWeekStates,
  computeBlockBounds,
} from '../../utils/programBlockState';
import {
  applyGenerationConstraintsToProfile,
  buildGenerationConstraintContext,
  mergeAthletePrefsWithGenerationConstraints,
  type GenerationConstraintContext,
} from '../../utils/generationConstraints';
import { buildReadinessActiveConstraints } from '../../utils/readinessConstraints';
import { attachRecoveryAddonsToWeek } from '../../utils/recoveryAddonBuilder';
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
} from '../../utils/equipmentAvailability';
import { getSessionComponents } from '../../utils/sessionComponents';
import type { StrengthIntent } from '../../rules/strengthPatternContributions';
import {
  resolveConditioningSubstitutionPolicy,
  resolveWeeklyConditioningFeasibility,
} from '../../rules/conditioningFeasibility';
import { evaluateEffectiveWeekExposureContract } from '../../rules/weeklyExposureContract';
import { requireSection18AcceptedWeek } from '../../rules/section18AcceptedWeekGateway';
import {
  rebindDerivedSessionProvenance,
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

export interface GenerateProgramFromProfileOptions {
  todayISO?: string;
  /** 1-based training block number. Defaults to 1 for a fresh generated block. */
  blockNumber?: number;
  /**
   * Active injury/readiness constraints to feed into generation before the
   * week is built. When omitted, generation reads the current local stores.
   */
  activeConstraints?: readonly ActiveConstraint[];
  readinessSignal?: ReadinessSignal | null;
  generationConstraints?: GenerationConstraintContext;
  /** Explicit continuity input for pure callers; normal app paths use the live persisted program. */
  previousProgram?: TrainingProgram | null;
  seasonPhaseClock?: SeasonPhaseClock | null;
  /** Shared target-week availability result; fixture paths must not rebuild it ad hoc. */
  targetWeekAvailability?: FixtureConditionedAvailability;
  /** undefined = profile fixture, null = bye/no fixture, day = proposed fixture. */
  targetFixtureDay?: DayOfWeek | null;
  /** Build only the target week when the caller needs a contract/fallback candidate. */
  microcycleLimit?: 1 | 4;
}

type CoachGeneratedWorkouts = Parameters<typeof buildWorkoutsFromCoach>[0];
type AthletePoolPrefsArg = Parameters<typeof buildWorkoutsFromCoach>[5];

function dateAtNoonISO(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00`).toISOString();
}

function dateFromOption(todayISO?: string): Date {
  return todayISO ? new Date(`${todayISO}T12:00:00`) : new Date();
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

function generationPhaseResolution(
  profile: OnboardingData,
  blockStartISO: string,
  options: GenerateProgramFromProfileOptions,
): SeasonPhaseClockResolution {
  const selectedPhase = profile.seasonPhase ?? 'Pre-season';
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
  const { blockStart } = computeBlockBounds(dateFromOption(args.todayISO));
  const [firstState] = buildBlockWeekStates({
    blockStartISO: blockStart,
    blockNumber: args.blockNumber ?? 1,
    seasonPhase: args.profile.seasonPhase,
    seasonPhaseClock: args.seasonPhaseClock,
  });
  if (!firstState) return buildCoachingPlan(args.coachingInputs);
  return buildCoachingPlan({
    ...args.coachingInputs,
    miniCycleNumber: firstState.miniCycleNumber,
    weekInBlock: firstState.weekInBlock,
    weekNumber: firstState.weekNumber,
    weekKind: firstState.weekKind,
    phaseWeekNumber: firstState.phaseWeekNumber,
    phaseEntryWeekStartISO: firstState.phaseClock.phaseEntryWeekStartISO,
    phaseClockSelectedPhase: firstState.phaseClock.selectedPhase,
    phaseClockProvenance: firstState.phaseResolution.provenance,
    offseasonSubphase: firstState.phaseResolution.offseasonSubphase ?? undefined,
    preseasonSubphase: firstState.phaseResolution.preseasonSubphase ?? undefined,
  });
}

function collectActiveConstraintsForGeneration(
  options: GenerateProgramFromProfileOptions,
  todayISO: string,
): ActiveConstraint[] {
  const storedConstraints = options.activeConstraints ??
    (useCoachUpdatesStore.getState().activeConstraints ?? []);
  const readinessSignal = options.readinessSignal !== undefined
    ? options.readinessSignal
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
  });
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
  availableEquipmentTags: readonly EquipmentTag[];
  availableConditioningModalities?: readonly ConditioningEquipmentModality[];
  generationConstraints?: GenerationConstraintContext;
  activeConstraints?: readonly ActiveConstraint[];
  weekLimit?: 1 | 4;
}): Microcycle[] {
  const states = buildBlockWeekStates({
    blockStartISO: args.blockStartISO,
    blockNumber: args.blockNumber ?? 1,
    seasonPhase: args.profile.seasonPhase,
    seasonPhaseClock: args.seasonPhaseClock,
  }).slice(0, args.weekLimit ?? 4);

  return states.map((blockState, stateIndex) => {
    const microcycleId = `${args.microcyclePrefix}-${blockState.weekNumber}`;
    const generationConstraints = args.activeConstraints
      ? buildGenerationConstraintContext({
          activeConstraints: args.activeConstraints,
          todayISO: blockState.weekStart,
          periodEndISO: blockState.weekEnd,
        })
      : args.generationConstraints;
    const profile = applyGenerationConstraintsToProfile(args.profile, generationConstraints);
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
    const allocatedWeekPlan = args.coachingInputs
      ? buildCoachingPlan({
          ...args.coachingInputs,
          generationConstraints,
          injuries: profile.injuries ?? [],
          appConditioningFeasible: substitutionPolicy.appConditioningFeasible ?? undefined,
          conditioningSubstitutionPolicy: substitutionPolicy,
          miniCycleNumber: blockState.miniCycleNumber,
          weekInBlock: blockState.weekInBlock,
          weekNumber: blockState.weekNumber,
          weekKind: blockState.weekKind,
          phaseWeekNumber: blockState.phaseWeekNumber,
          phaseEntryWeekStartISO: blockState.phaseClock.phaseEntryWeekStartISO,
          phaseClockSelectedPhase: blockState.phaseClock.selectedPhase,
          phaseClockProvenance: blockState.phaseResolution.provenance,
          offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? undefined,
          preseasonSubphase: blockState.phaseResolution.preseasonSubphase ?? undefined,
        })
      : args.plan;
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
    const sourceCoachWorkouts = stateIndex === 0 ? args.coachWorkouts : [];
    let exposureContractV2 = weekPlan.weeklyExposureContractV2;
    const buildCanonicalCandidate = (source: typeof sourceCoachWorkouts): Workout[] => {
      const built = attachRecoveryAddonsToWeek({
        workouts: buildWorkoutsFromCoach(
          source,
          microcycleId,
          weekPlan.weeklyPlan,
          profile,
          {
            miniCycleNumber: blockState.miniCycleNumber,
            weekInBlock: blockState.weekInBlock,
            weekStartISO: blockState.weekStart,
            weekKind: blockState.weekKind,
            intensityMultiplier: blockState.intensityMultiplier,
            offseasonSubphase: blockState.phaseResolution.offseasonSubphase ?? undefined,
          },
          {
            ...mergeAthletePrefsWithGenerationConstraints(args.athletePrefs, generationConstraints),
            availableEquipment: equipment.tags,
            conditioningModalities: equipment.conditioningModalities,
          },
        ),
        profile,
        weekKind: blockState.weekKind,
        generationConstraints,
      });
      return exposureContractV2
        ? stampPlannerDerivedSessionProvenance({
            workouts: built,
            contract: exposureContractV2,
            weekStart: blockState.weekStart,
          })
        : built;
    };
    let workouts = buildCanonicalCandidate(sourceCoachWorkouts);
    if (exposureContractV2) {
      const accepted = requireSection18AcceptedWeek({
        contract: exposureContractV2,
        workouts,
        weekStart: blockState.weekStart,
        profile,
        // Edge-authored and deterministic candidates both regenerate from the
        // same phase-owned plan before the final safe fallback is considered.
        regenerate: () => ({
          contract: exposureContractV2!,
          workouts: buildCanonicalCandidate([]),
        }),
        safeFallback: () => ({
          contract: exposureContractV2!,
          workouts: buildCanonicalCandidate([]),
        }),
      });
      workouts = rebindDerivedSessionProvenance({
        workouts: accepted.canonicalWorkouts,
        contract: accepted.contract,
        weekStart: blockState.weekStart,
      });
      exposureContractV2 = accepted.contract;
    }
    const exposureContract = weekPlan.weeklyExposureContract;
    // Contract v2 is the accepted-week authority. The legacy ledger cannot
    // represent two valid credits stacked on one day (for example TT plus an
    // app core block), so it remains a compatibility gate only when v2 is
    // absent.
    if (exposureContract && !exposureContractV2) {
      const finalValidation = evaluateEffectiveWeekExposureContract(
        exposureContract,
        workouts,
        blockState.weekStart,
      );
      if (!finalValidation.accepted) {
        const detail = finalValidation.unresolvedShortfalls
          .map((entry) => `${entry.code}:${entry.domain ?? 'safety'}=${JSON.stringify(entry.actual)}`)
          .join(', ');
        logger.error('[ProgramGen] Final effective-week exposure rejection', {
          weekNumber: blockState.weekNumber,
          contract: exposureContract,
          ledger: finalValidation.ledger,
          unresolvedShortfalls: finalValidation.unresolvedShortfalls,
        });
        throw new Error(`Final effective-week exposure contract unresolved (${detail})`);
      }
    }
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
      weekKind: blockState.weekKind,
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
  const availabilityDateISO = options.todayISO ?? todayISOLocal();
  const today = dateFromOption(options.todayISO);
  const { blockStart, blockEnd } = computeBlockBounds(today);
  const activeConstraintsForGeneration = collectActiveConstraintsForGeneration(options, availabilityDateISO);
  const generationConstraints = resolveGenerationConstraints(options, availabilityDateISO);
  const baseProfile = normalizeOnboardingRole(onboardingData);
  const generationProfile = applyGenerationConstraintsToProfile(
    baseProfile,
    generationConstraints,
  );
  const resolvedEquipment = resolveEquipmentCapabilities(
    generationProfile,
    activeConstraintsForGeneration,
    availabilityDateISO,
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
  });
  const plan = buildInitialGeneratedCoachingPlan({
    coachingInputs,
    profile: generationProfile,
    todayISO: options.todayISO,
    blockNumber: options.blockNumber,
    seasonPhaseClock: phaseResolution.clock,
  });

  logger.debug('[ProgramGen] Local deterministic build', {
    readiness: plan.readiness,
    coreSessions: plan.coreSessions,
    gameDay: generationProfile.usualGameDay || generationProfile.gameDay || null,
    activeConstraints: generationConstraints?.activeConstraintIds ?? [],
  });

  const startDate = new Date(blockStart + 'T12:00:00');
  const endDate = new Date(blockEnd + 'T12:00:00');
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
    athletePrefs: getAthletePrefs(),
    availableEquipmentTags: resolvedEquipmentTags,
    availableConditioningModalities: resolvedEquipment.conditioningModalities,
    generationConstraints,
    activeConstraints: activeConstraintsForGeneration,
    weekLimit: options.microcycleLimit,
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

  return {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
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

const REQUIRED_PROGRAM_GEN_PROFILE_FIELDS: Array<keyof OnboardingData> = [
  'firstName',
  'heightCm',
  'weightKg',
  'position',
  'motivation',
  'seasonPhase',
  'trainingDaysPerWeek',
  'preferredTrainingDays',
  'sessionDurationMinutes',
  'trainingLocation',
  'equipment',
  'experienceLevel',
  'squatStrength',
  'benchStrength',
  'conditioningLevel',
  'sprintExposure',
  'recentTrainingLoad',
  'injuries',
];

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
  const missingRequired = REQUIRED_PROGRAM_GEN_PROFILE_FIELDS
    .filter((field) => !hasProfileValue(data, field))
    .map(String);

  if (
    data.seasonPhase === 'In-season' &&
    !data.usualGameDay &&
    !data.gameDay
  ) {
    missingRequired.push('usualGameDay/gameDay');
  }

  if (
    (data.teamTrainingDaysPerWeek ?? 0) > 0 &&
    (!data.teamTrainingDays || data.teamTrainingDays.length === 0)
  ) {
    missingRequired.push('teamTrainingDays');
  }

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
): Record<string, unknown> {
  const generationProfile = normalizeOnboardingRole(onboardingData);
  const derivedInputs = onboardingToCoachingInputs(generationProfile, {
    availabilityDateISO: todayISOLocal(),
  });
  const diagnosticsWeek = computeBlockBounds(dateFromOption()).blockStart;
  const diagnosticsClock = resolveSeasonPhaseClock({
    selectedPhase: generationProfile.seasonPhase ?? 'Pre-season',
    targetWeekStartISO: diagnosticsWeek,
  }).clock;
  const derivedPlan = plan ?? buildInitialGeneratedCoachingPlan({
    coachingInputs: derivedInputs,
    profile: generationProfile,
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
        sessionDurationMinutes: generationProfile.sessionDurationMinutes ?? null,
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
      readiness: derivedPlan.readiness,
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
export async function generateProgramFromProfile(
  onboardingData: OnboardingData,
  options: GenerateProgramFromProfileOptions = {},
): Promise<TrainingProgram> {
  const env = getClientEnvConfig();
  const devBuild = isDevBuild();
  const availabilityDateISO = options.todayISO ?? todayISOLocal();
  const activeConstraintsForGeneration = collectActiveConstraintsForGeneration(options, availabilityDateISO);
  const generationConstraints = resolveGenerationConstraints(options, availabilityDateISO);
  const baseProfile = normalizeOnboardingRole(onboardingData);
  const generationProfile = applyGenerationConstraintsToProfile(
    baseProfile,
    generationConstraints,
  );
  const resolvedEquipment = resolveEquipmentCapabilities(
    generationProfile,
    activeConstraintsForGeneration,
    availabilityDateISO,
  );
  const resolvedEquipmentTags = resolvedEquipment.tags;
  const generationDate = dateFromOption(options.todayISO);
  const generationBounds = computeBlockBounds(generationDate);
  const phaseResolution = generationPhaseResolution(
    generationProfile,
    generationBounds.blockStart,
    options,
  );
  const substitutionPolicy = resolveConditioningSubstitutionPolicy({
    phase: generationProfile.seasonPhase,
    equipment: resolvedEquipment,
    profile: generationProfile,
    generationConstraints,
  });
  if (!env.isReady) {
    logMissingClientEnv('generateProgramFromProfile', env);
    throw new ProgramGenError(
      'unauthorized',
      'Program generation is not configured for this build. Please contact support.',
      `missing public env: ${env.missing.join(', ')}`,
      false,
    );
  }

  // ─── Step 1: Deterministic coaching logic ───
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
  });
  const plan = buildInitialGeneratedCoachingPlan({
    coachingInputs,
    profile: generationProfile,
    todayISO: options.todayISO,
    blockNumber: options.blockNumber,
    seasonPhaseClock: phaseResolution.clock,
  });

  logger.debug('[ProgramGen] Coaching plan built', {
    readiness: plan.readiness,
    coreSessions: plan.coreSessions,
    optionalSessions: plan.optionalSessions,
    recoverySessions: plan.recoverySessions,
    activeConstraints: generationConstraints?.activeConstraintIds ?? [],
  });

  // ─── Step 2: Build AI prompt from coaching plan ───
  const message = buildGenerationPrompt(
    generationProfile,
    plan,
    resolvedEquipmentTags,
    resolvedEquipment.conditioningModalities,
  );
  const requestDiagnostics = buildProgramGenerationRequestDiagnostics(
    generationProfile,
    plan,
    message,
    env,
    resolvedEquipmentTags,
    resolvedEquipment.conditioningModalities,
  );

  const promptWords = message.split(/\s+/).length;
  logger.debug(`[ProgramGen] Calling edge function via direct fetch... (prompt: ${promptWords} words, ~${Math.round(promptWords * 1.3)} tokens)`);

  if (devBuild) {
    const missingRequired = getProgramGenerationProfileFieldDiagnostics(generationProfile).missingRequired;
    logger.warn('[ProgramGen][dev] Edge function request payload summary', requestDiagnostics);
    if (missingRequired.length > 0) {
      logger.warn('[ProgramGen][dev] Profile is missing fields used by program generation', {
        missingRequired,
      });
    }
  }

  // Use direct fetch with both apikey + Authorization headers.
  // The Supabase gateway requires BOTH headers for edge function auth.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': env.supabaseAnonKey,
    'Authorization': `Bearer ${env.supabaseAnonKey}`,
  };

  // ─── Fetch with typed error classification ───
  //
  // The edge function can fail in several ways:
  //   - Network error (fetch throws)          → transient, retryable
  //   - 5xx + Cloudflare/Supabase HTML page   → backend outage, retryable
  //   - 401/403                                → auth/config, NOT retryable
  //   - 200 + HTML body                        → proxy replaced JSON, treat as outage
  //   - 200 + JSON with `.error`              → application-level failure
  //   - 200 + JSON but no workouts            → bad response
  //
  // No code path here allows raw HTML or raw payload text to escape into the
  // UI layer. We always throw `ProgramGenError` whose `userMessage` is safe
  // copy; raw payload previews are gated behind debug logging only.

  const requestBody = buildProgramGenerationEdgePayload({
    generationProfile,
    message,
    coachingPlan: plan.constraints,
    resolvedEquipmentTags,
    resolvedConditioningModalities: resolvedEquipment.conditioningModalities,
  });

  let response: Response;
  try {
    response = await fetch(env.coachChatEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
  } catch (fetchErr: any) {
    logger.error('[ProgramGen] Network error on fetch:', fetchErr?.message || fetchErr);
    throw new ProgramGenError(
      'network',
      'Couldn\u2019t reach the server. Check your connection and try again.',
      `fetch threw: ${fetchErr?.message || fetchErr}`,
      true,
      { request: requestDiagnostics },
    );
  }

  logger.debug(`[ProgramGen] Response status: ${response.status}`);

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const rawBody = await response.text().catch(() => '');
  if (devBuild) {
    logger.warn('[ProgramGen][dev] Edge function response received', {
      status: response.status,
      contentType,
      bodyPreview: previewBody(rawBody, 700),
    });
  }
  const bodyIsHtml = contentType.includes('text/html') || looksLikeHtml(rawBody);

  // ── Response is HTML (Cloudflare / Supabase proxy page) → treat as outage ──
  if (bodyIsHtml) {
    logger.error(`[ProgramGen] HTML body received (status=${response.status}, content-type=${contentType})`);
    logger.debug('[ProgramGen] HTML body preview:', previewBody(rawBody));
    throw new ProgramGenError(
      'server_outage',
      'Couldn\u2019t rebuild right now. There was a temporary server issue. Please try again in a minute.',
      `HTML response. status=${response.status} content-type=${contentType} preview="${previewBody(rawBody, 200)}"`,
      true,
      {
        request: requestDiagnostics,
        response: {
          status: response.status,
          contentType,
          bodyPreview: previewBody(rawBody, 300),
        },
      },
    );
  }

  // ── Non-2xx HTTP status ──
  if (!response.ok) {
    logger.error(`[ProgramGen] HTTP ${response.status}`);
    logger.debug('[ProgramGen] HTTP body preview:', previewBody(rawBody));
    if (response.status === 401 || response.status === 403) {
      throw new ProgramGenError(
        'unauthorized',
        'Couldn\u2019t authorise the rebuild request. Please close the app and sign in again.',
        `HTTP ${response.status} preview="${previewBody(rawBody, 200)}"`,
        false,
        {
          request: requestDiagnostics,
          response: {
            status: response.status,
            contentType,
            bodyPreview: previewBody(rawBody, 300),
          },
        },
      );
    }
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      throw new ProgramGenError(
        'server_outage',
        'Couldn\u2019t rebuild right now. There was a temporary server issue. Please try again in a minute.',
        `HTTP ${response.status} preview="${previewBody(rawBody, 200)}"`,
        true,
        {
          request: requestDiagnostics,
          response: {
            status: response.status,
            contentType,
            bodyPreview: previewBody(rawBody, 300),
          },
        },
      );
    }
    // Other 4xx — likely a request bug, not retryable on the user's side.
    throw new ProgramGenError(
      'bad_response',
      'Something went wrong rebuilding your week. Please try again, or contact support if it keeps happening.',
      `HTTP ${response.status} preview="${previewBody(rawBody, 200)}"`,
      false,
      {
        request: requestDiagnostics,
        response: {
          status: response.status,
          contentType,
          bodyPreview: previewBody(rawBody, 300),
        },
      },
    );
  }

  // ── 2xx with a body we expect to be JSON ──
  let data: any;
  try {
    data = rawBody ? JSON.parse(rawBody) : null;
  } catch (parseErr: any) {
    logger.error('[ProgramGen] Failed to parse JSON body');
    logger.debug('[ProgramGen] JSON parse failure body preview:', previewBody(rawBody));
    throw new ProgramGenError(
      'bad_response',
      'The server sent an unexpected response. Please try again.',
      `JSON parse error: ${parseErr?.message}. preview="${previewBody(rawBody, 200)}"`,
      true,
      {
        request: requestDiagnostics,
        response: {
          status: response.status,
          contentType,
          bodyPreview: previewBody(rawBody, 300),
        },
      },
    );
  }

  logger.debug(`[ProgramGen] Edge function version: ${data?._v || 'unknown (old version)'}`);

  // ── 200 with application-level error in body ──
  if (data?.error) {
    const errorPreview = String(data.error).slice(0, 500);
    logger.error('[ProgramGen] Edge function returned error', {
      status: response.status,
      functionVersion: data?._v || 'unknown',
      error: errorPreview,
      diagnostic: data?.diagnostic ?? null,
    });
    if (devBuild) {
      logger.warn('[ProgramGen][dev] Edge function failure diagnostics', {
        request: requestDiagnostics,
        response: {
          status: response.status,
          contentType,
          functionVersion: data?._v || 'unknown',
          error: errorPreview,
          diagnostic: data?.diagnostic ?? null,
        },
      });
    }

    // Overload errors get a user-friendly message and a detectable error kind.
    if (typeof data.error === 'string' && data.error.includes('[OVERLOADED]')) {
      logger.error('[ProgramGen] FAILED: All retry attempts exhausted — coach LLM provider overloaded');
      throw new ProgramGenError(
        'overloaded',
        'The AI service is under heavy load right now. Please try again in a minute.',
        `status=${response.status} functionVersion=${data?._v || 'unknown'} overloaded: ${String(data.error).slice(0, 300)}`,
        true,
        {
          request: requestDiagnostics,
          response: {
            status: response.status,
            contentType,
            functionVersion: data?._v || 'unknown',
            error: errorPreview,
            diagnostic: data?.diagnostic ?? null,
          },
        },
      );
    }

    throw new ProgramGenError(
      'bad_response',
      'Something went wrong rebuilding your week. Please try again.',
      `status=${response.status} functionVersion=${data?._v || 'unknown'} edge error: ${String(data.error).slice(0, 500)}`,
      true,
      {
        request: requestDiagnostics,
        response: {
          status: response.status,
          contentType,
          functionVersion: data?._v || 'unknown',
          error: errorPreview,
          diagnostic: data?.diagnostic ?? null,
        },
      },
    );
  }

  const result: CoachResponse = data;

  if (!result?.programUpdate?.workouts || result.programUpdate.workouts.length === 0) {
    logger.error('[ProgramGen] No workouts in response');
    logger.debug('[ProgramGen] No-workouts reply preview:', previewBody(result?.reply || ''));
    throw new ProgramGenError(
      'bad_response',
      'The AI didn\u2019t return a program this time. Please try again.',
      `no workouts. reply preview="${previewBody(result?.reply || '', 200)}"`,
      true,
      {
        request: requestDiagnostics,
        response: {
          status: response.status,
          contentType,
          functionVersion: data?._v || 'unknown',
          replyPreview: previewBody(result?.reply || '', 300),
        },
      },
    );
  }

  logger.debug(`[ProgramGen] Success: ${result.programUpdate.workouts.length} workouts generated`);

  // ── TRACE: Log what the AI returned for each day ──
  logger.debug('[AI-TRACE] Raw AI response summary (per workout)');
  result.programUpdate.workouts.forEach(w => {
    logger.debug(`[AI-TRACE]   day=${w.dayOfWeek} name="${w.name}" type="${w.workoutType}" tier="${w.sessionTier}" exercises=${w.exercises?.length}`);
  });

  const generatedWorkoutDiagnostics = buildGeneratedWorkoutAcceptanceDiagnostics(
    result.programUpdate.workouts,
  );
  if (devBuild) {
    logger.warn('[ProgramGen][dev] programUpdate.workouts received', generatedWorkoutDiagnostics);
  }

  // Convert the AI workout JSON into app domain types.
  // Pass the coaching engine's weeklyPlan so structural fields (tier, intensity)
  // are enforced deterministically — the AI is not trusted for these.
  let microcycles: Microcycle[];
  try {
    const today = dateFromOption(options.todayISO);
    const { blockStart } = computeBlockBounds(today);
    microcycles = buildGeneratedMicrocycles({
      coachWorkouts: result.programUpdate.workouts,
      plan,
      coachingInputs,
      profile: baseProfile,
      programId: 'prog-ai-1',
      microcyclePrefix: 'mc-ai',
      blockStartISO: blockStart,
      blockNumber: options.blockNumber ?? 1,
      seasonPhaseClock: phaseResolution.clock,
      athletePrefs: getAthletePrefs(),
      availableEquipmentTags: resolvedEquipmentTags,
      availableConditioningModalities: resolvedEquipment.conditioningModalities,
      generationConstraints,
      activeConstraints: activeConstraintsForGeneration,
    });
  } catch (normaliseErr: any) {
    const diagnostic = `generated program normalisation failed: ${errorDiagnostic(normaliseErr)}`;
    logger.error('[ProgramGen] Generated program normalisation failed before client acceptance', {
      diagnostic,
      response: {
        status: response.status,
        contentType,
        functionVersion: data?._v || 'unknown',
      },
      generatedWorkoutDiagnostics,
    });
    throw new ProgramGenError(
      'bad_response',
      'The server returned a program, but the app could not read it. Please try again.',
      diagnostic,
      true,
      {
        request: requestDiagnostics,
        response: {
          status: response.status,
          contentType,
          functionVersion: data?._v || 'unknown',
        },
        generatedProgram: generatedWorkoutDiagnostics,
      },
    );
  }

  const workouts = microcycles[0]?.workouts ?? [];
  if (!workouts.length) {
    const diagnostic = 'generated program normalisation returned zero workouts';
    logger.error('[ProgramGen] Generated program rejected after normalisation', {
      diagnostic,
      generatedWorkoutDiagnostics,
    });
    throw new ProgramGenError(
      'bad_response',
      'The server returned a program, but the app could not read it. Please try again.',
      diagnostic,
      true,
      {
        request: requestDiagnostics,
        response: {
          status: response.status,
          contentType,
          functionVersion: data?._v || 'unknown',
        },
        generatedProgram: generatedWorkoutDiagnostics,
      },
    );
  }

  if (devBuild) {
    logger.warn('[ProgramGen][dev] generated program accepted by client normaliser', {
      inputWorkoutCount: result.programUpdate.workouts.length,
      outputWorkoutCount: workouts.length,
      workoutTypes: countValues(workouts.map((w) => w.workoutType)),
      sessionTiers: countValues(workouts.map((w) => w.sessionTier)),
      firstWorkout: workouts[0]
        ? {
          dayOfWeek: workouts[0].dayOfWeek,
          name: workouts[0].name,
          workoutType: workouts[0].workoutType,
          sessionTier: workouts[0].sessionTier ?? null,
          exerciseCount: workouts[0].exercises?.length ?? 0,
        }
        : null,
    });
  }

  // Build dates — aligned to calendar week boundaries (Mon-Sun).
  // The week containing "today" is Week 1. Block runs through
  // the Sunday of the 3rd full week after (4 weeks total).
  const today = dateFromOption(options.todayISO);
  const { blockStart, blockEnd } = computeBlockBounds(today);
  const startDate = new Date(blockStart + 'T12:00:00');
  const endDate = new Date(blockEnd + 'T12:00:00');

  const phaseMap: Record<string, string> = {
    'Off-season': 'Base-Building',
    'Pre-season': 'Pre-Season-Skills',
    'In-season': 'In-Season',
  };

  const program: TrainingProgram = {
    id: 'prog-ai-1',
    userId: 'user-default',
    name: buildProgramName(generationProfile, plan),
    description: result.reply || 'AI-generated program based on your profile',
    programPhase: (phaseMap[generationProfile.seasonPhase || ''] || 'Pre-Season-Skills') as any,
    seasonPhaseClock: phaseResolution.clock,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    primaryFocus: generationProfile.motivation || 'Strength and Conditioning',
    isActive: true,
    microcycles,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (devBuild) {
    logger.warn('[ProgramGen][dev] Using generated program from coach-chat', {
      programId: program.id,
      programName: program.name,
      microcycleCount: program.microcycles.length,
      workoutCount: workouts.length,
      firstWorkout: workouts[0]
        ? {
          dayOfWeek: workouts[0].dayOfWeek,
          name: workouts[0].name,
          workoutType: workouts[0].workoutType,
          sessionTier: workouts[0].sessionTier ?? null,
          exerciseCount: workouts[0].exercises?.length ?? 0,
        }
        : null,
    });
  }

  return program;
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
    const effectiveGameDay = data.usualGameDay || data.gameDay;
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
