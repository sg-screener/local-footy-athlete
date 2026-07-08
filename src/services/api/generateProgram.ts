import { OnboardingData, TrainingProgram, Microcycle } from '../../types/domain';
import { buildWorkoutsFromCoach } from '../../data/defaultProgram';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
  type AIConstraints,
} from '../../utils/coachingEngine';
import { todayISOLocal } from '../../utils/appDate';
import { computeBlockBounds } from '../../utils/sessionResolver';
import { getAthletePrefs } from '../../store/athletePreferencesStore';
import {
  getClientEnvConfig,
  logMissingClientEnv,
} from '../../config/env';
import { logger } from '../../utils/logger';
import {
  getProgrammingRoleBias,
  normalizeOnboardingRole,
  normalizeRoleBucket,
  programmingRoleBiasLabel,
  roleBucketLabel,
} from '../../utils/roleBuckets';

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
  const generationProfile = normalizeOnboardingRole(onboardingData);
  const availabilityDateISO = options.todayISO ?? todayISOLocal();
  const coachingInputs = onboardingToCoachingInputs(generationProfile, { availabilityDateISO });
  const plan = buildCoachingPlan(coachingInputs);

  logger.debug('[ProgramGen] Local deterministic build', {
    readiness: plan.readiness,
    coreSessions: plan.coreSessions,
    gameDay: generationProfile.usualGameDay || generationProfile.gameDay || null,
  });

  const workouts = buildWorkoutsFromCoach(
    [],
    'mc-ai-1',
    plan.weeklyPlan,
    generationProfile,
    { miniCycleNumber: 1, weekInBlock: 1 },
    getAthletePrefs(),
  );
  if (!workouts.length) {
    throw new ProgramGenError(
      'bad_response',
      'The app could not rebuild your week. Please try again.',
      'local generation produced zero workouts',
      true,
    );
  }

  const today = new Date();
  const { blockStart, blockEnd } = computeBlockBounds(today);
  const startDate = new Date(blockStart + 'T12:00:00');
  const endDate = new Date(blockEnd + 'T12:00:00');

  const microcycle: Microcycle = {
    id: 'mc-ai-1',
    programId: 'prog-ai-1',
    weekNumber: 1,
    startDate: startDate.toISOString(),
    endDate: new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    miniCycleNumber: 1,
    intensityMultiplier: 1.0,
    workouts,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

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
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    primaryFocus: generationProfile.motivation || 'Strength and Conditioning',
    isActive: true,
    microcycles: [microcycle],
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
): Record<string, unknown> {
  const generationProfile = normalizeOnboardingRole(onboardingData);
  const derivedPlan = plan ?? buildCoachingPlan(onboardingToCoachingInputs(generationProfile, {
    availabilityDateISO: todayISOLocal(),
  }));
  const derivedMessage = message ?? buildGenerationPrompt(generationProfile, derivedPlan);
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
  const payloadForSize = {
    messages: [{ role: 'user', content: derivedMessage }],
    athleteProfile: generationProfile,
    roleContext,
    coachingPlan: derivedPlan.constraints,
    mode: 'generate',
  };

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
        dayOfWeek: session.dayOfWeek,
        tier: session.tier,
        focus: session.focus,
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
  const generationProfile = normalizeOnboardingRole(onboardingData);
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
  const availabilityDateISO = options.todayISO ?? todayISOLocal();
  const coachingInputs = onboardingToCoachingInputs(generationProfile, { availabilityDateISO });
  const plan = buildCoachingPlan(coachingInputs);

  logger.debug('[ProgramGen] Coaching plan built', {
    readiness: plan.readiness,
    coreSessions: plan.coreSessions,
    optionalSessions: plan.optionalSessions,
    recoverySessions: plan.recoverySessions,
  });

  // ─── Step 2: Build AI prompt from coaching plan ───
  const message = buildGenerationPrompt(generationProfile, plan);
  const requestDiagnostics = buildProgramGenerationRequestDiagnostics(
    generationProfile,
    plan,
    message,
    env,
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

  const requestBody = {
    messages: [{ role: 'user', content: message }],
    athleteProfile: generationProfile,
    roleContext: buildRoleContext(generationProfile),
    coachingPlan: plan.constraints,
    mode: 'generate',
  };

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
  // Cross-cycle variation: first program generation always starts at
  // block 1, week 1 of the rotation. Regenerations mid-program are
  // driven from CoachScreen with the ongoing microcycle's values.
  let workouts;
  try {
    workouts = buildWorkoutsFromCoach(
      result.programUpdate.workouts,
      'mc-ai-1',
      plan.weeklyPlan,
      generationProfile,
      { miniCycleNumber: 1, weekInBlock: 1 },
      getAthletePrefs(),
    );
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
  const today = new Date();
  const { blockStart, blockEnd } = computeBlockBounds(today);
  const startDate = new Date(blockStart + 'T12:00:00');
  const endDate = new Date(blockEnd + 'T12:00:00');

  const microcycle: Microcycle = {
    id: 'mc-ai-1',
    programId: 'prog-ai-1',
    weekNumber: 1,
    startDate: startDate.toISOString(),
    endDate: new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    miniCycleNumber: 1,
    intensityMultiplier: 1.0,
    workouts,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

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
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    primaryFocus: generationProfile.motivation || 'Strength and Conditioning',
    isActive: true,
    microcycles: [microcycle],
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
function buildGenerationPrompt(data: OnboardingData, plan: CoachingPlan): string {
  const c = plan.constraints;
  const parts: string[] = [];

  parts.push('Generate my initial training program using the update_program tool.');

  if (data.position) {
    const roleContext = buildRoleContext(data);
    parts.push('\nROLE BIAS:');
    parts.push(`• Athlete selected role: ${roleContext.selectedRoleLabel} (${roleContext.selectedRole}).`);
    parts.push(`• Programming role bias: ${roleContext.programmingRoleBias} — ${roleContext.programmingRoleBiasLabel}. Outside mid and High forward / back use the same programming bias.`);
    parts.push('• Do not let role override season phase, game day, team training, injuries, fatigue, training age, strength, fitness, goals, availability, or the weekly skeleton below.');
  }

  // ─── Weekly skeleton from coaching engine ───
  if (plan.weeklyPlan.length > 0) {
    parts.push('\nWEEKLY PLAN (from coaching engine — fill each session with exercises):');
    // Prefer the new DayOfWeek-typed usualGameDay; fall back to legacy gameDay.
    // Without this, the G-offset labels disagree with the engine's weeklyPlan
    // (engine already uses usualGameDay via onboardingToCoachingInputs).
    const effectiveGameDay = data.usualGameDay || data.gameDay;
    const gameDayNum = effectiveGameDay ? DAY_MAP[effectiveGameDay] : null;
    plan.weeklyPlan.forEach((session) => {
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
      parts.push(`  ${session.dayOfWeek || 'TBD'}${gLabel}: [${session.tier.toUpperCase()}] ${session.focus}${session.isHardExposure ? ' (HARD)' : ''}`);
    });
    const expectedDayNumbers = plan.weeklyPlan
      .map((session) => session.dayOfWeek ? DAY_MAP[session.dayOfWeek] : null)
      .filter((day): day is number => day !== null);
    parts.push(`\nReturn exactly one workout object for every WEEKLY PLAN line above. Do not omit optional, recovery, team-training, or Saturday sessions. Expected numeric dayOfWeek values: ${expectedDayNumbers.join(', ')}.`);
    parts.push('\nFollow the above tiers EXACTLY. Do NOT promote OPTIONAL/RECOVERY to CORE.');
  }

  const setupConstraints = formatAvailabilityConstraintsForPrompt(data);
  if (setupConstraints.length > 0) {
    parts.push('\nPROGRAM SETUP CONSTRAINTS:');
    setupConstraints.forEach((line) => parts.push(`• ${line}`));
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
