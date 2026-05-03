import { OnboardingData, TrainingProgram, Microcycle } from '../../types/domain';
import { buildWorkoutsFromCoach } from '../../data/defaultProgram';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
  type AIConstraints,
} from '../../utils/coachingEngine';
import { computeBlockBounds } from '../../utils/sessionResolver';
import { getAthletePrefs } from '../../store/athletePreferencesStore';
import {
  getClientEnvConfig,
  logMissingClientEnv,
} from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Kinds of program-generation failure — used by the UI to decide whether
 * to offer retry, and which friendly copy to show. Raw payloads (HTML,
 * 500 stack traces, etc.) must NEVER flow into user-facing error text.
 */
export type ProgramGenErrorKind =
  | 'server_outage'   // 5xx, 503, Cloudflare/Supabase HTML "temporarily unavailable"
  | 'overloaded'     // Anthropic/AI overloaded
  | 'unauthorized'   // 401/403 — config problem
  | 'bad_response'   // 200 but shape is wrong / empty
  | 'network'        // fetch threw (offline, DNS, timeout)
  | 'unknown';

export class ProgramGenError extends Error {
  public readonly kind: ProgramGenErrorKind;
  public readonly canRetry: boolean;
  public readonly userMessage: string;
  public readonly diagnostic: string;

  constructor(kind: ProgramGenErrorKind, userMessage: string, diagnostic: string, canRetry: boolean) {
    // Parent Error `message` is the USER-FACING string so any accidental
    // render (e.g. `err.message`) still produces safe copy instead of raw HTML.
    super(userMessage);
    this.name = 'ProgramGenError';
    this.kind = kind;
    this.canRetry = canRetry;
    this.userMessage = userMessage;
    this.diagnostic = diagnostic;
  }
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
): Promise<TrainingProgram> {
  const env = getClientEnvConfig();
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
  const coachingInputs = onboardingToCoachingInputs(onboardingData);
  const plan = buildCoachingPlan(coachingInputs);

  logger.debug('[ProgramGen] Coaching plan built', {
    readiness: plan.readiness,
    coreSessions: plan.coreSessions,
    optionalSessions: plan.optionalSessions,
    recoverySessions: plan.recoverySessions,
  });

  // ─── Step 2: Build AI prompt from coaching plan ───
  const message = buildGenerationPrompt(onboardingData, plan);

  const promptWords = message.split(/\s+/).length;
  logger.debug(`[ProgramGen] Calling edge function via direct fetch... (prompt: ${promptWords} words, ~${Math.round(promptWords * 1.3)} tokens)`);

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

  let response: Response;
  try {
    response = await fetch(env.coachChatEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        athleteProfile: onboardingData,
        coachingPlan: plan.constraints,
        mode: 'generate',
      }),
    });
  } catch (fetchErr: any) {
    logger.error('[ProgramGen] Network error on fetch:', fetchErr?.message || fetchErr);
    throw new ProgramGenError(
      'network',
      'Couldn\u2019t reach the server. Check your connection and try again.',
      `fetch threw: ${fetchErr?.message || fetchErr}`,
      true,
    );
  }

  logger.debug(`[ProgramGen] Response status: ${response.status}`);

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const rawBody = await response.text().catch(() => '');
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
        `HTTP ${response.status}`,
        false,
      );
    }
    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      throw new ProgramGenError(
        'server_outage',
        'Couldn\u2019t rebuild right now. There was a temporary server issue. Please try again in a minute.',
        `HTTP ${response.status} preview="${previewBody(rawBody, 200)}"`,
        true,
      );
    }
    // Other 4xx — likely a request bug, not retryable on the user's side.
    throw new ProgramGenError(
      'bad_response',
      'Something went wrong rebuilding your week. Please try again, or contact support if it keeps happening.',
      `HTTP ${response.status} preview="${previewBody(rawBody, 200)}"`,
      false,
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
    );
  }

  logger.debug(`[ProgramGen] Edge function version: ${data?._v || 'unknown (old version)'}`);

  // ── 200 with application-level error in body ──
  if (data?.error) {
    logger.error('[ProgramGen] Edge function returned error');
    logger.debug('[ProgramGen] Edge function error detail:', String(data.error).slice(0, 300));

    // Overload errors get a user-friendly message and a detectable error kind.
    if (typeof data.error === 'string' && data.error.includes('[OVERLOADED]')) {
      logger.error('[ProgramGen] FAILED: All retry attempts exhausted — Anthropic API overloaded');
      throw new ProgramGenError(
        'overloaded',
        'The AI service is under heavy load right now. Please try again in a minute.',
        `overloaded: ${String(data.error).slice(0, 200)}`,
        true,
      );
    }

    throw new ProgramGenError(
      'bad_response',
      'Something went wrong rebuilding your week. Please try again.',
      `edge error: ${String(data.error).slice(0, 300)}`,
      true,
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
    );
  }

  logger.debug(`[ProgramGen] Success: ${result.programUpdate.workouts.length} workouts generated`);

  // ── TRACE: Log what the AI returned for each day ──
  logger.debug('[AI-TRACE] Raw AI response summary (per workout)');
  result.programUpdate.workouts.forEach(w => {
    logger.debug(`[AI-TRACE]   day=${w.dayOfWeek} name="${w.name}" type="${w.workoutType}" tier="${w.sessionTier}" exercises=${w.exercises?.length}`);
  });

  // Convert the AI workout JSON into app domain types.
  // Pass the coaching engine's weeklyPlan so structural fields (tier, intensity)
  // are enforced deterministically — the AI is not trusted for these.
  // Cross-cycle variation: first program generation always starts at
  // block 1, week 1 of the rotation. Regenerations mid-program are
  // driven from CoachScreen with the ongoing microcycle's values.
  const workouts = buildWorkoutsFromCoach(
    result.programUpdate.workouts,
    'mc-ai-1',
    plan.weeklyPlan,
    onboardingData,
    { miniCycleNumber: 1, weekInBlock: 1 },
    getAthletePrefs(),
  );

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
    name: buildProgramName(onboardingData, plan),
    description: result.reply || 'AI-generated program based on your profile',
    programPhase: (phaseMap[onboardingData.seasonPhase || ''] || 'Pre-Season-Skills') as any,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    primaryFocus: onboardingData.motivation || 'Strength and Conditioning',
    isActive: true,
    microcycles: [microcycle],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

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
    parts.push('\nFollow the above tiers EXACTLY. Do NOT promote OPTIONAL/RECOVERY to CORE.');
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

/**
 * Build a descriptive program name
 */
function buildProgramName(data: OnboardingData, plan: CoachingPlan): string {
  const phase = data.seasonPhase || 'Training';
  const core = plan.coreSessions;
  const total = plan.coreSessions + plan.optionalSessions + plan.recoverySessions;
  return `${phase} Program — ${core} Core + ${total - core} Support`;
}
