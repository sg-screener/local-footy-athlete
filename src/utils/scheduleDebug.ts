/**
 * Schedule Debug — Pure functions that build diagnostic info
 * from the same data the app already has.
 *
 * DEV ONLY. Never imported in production paths.
 */

import type { ResolvedDay, ScheduleState } from './sessionResolver';
import { addDays, getMondayForDate } from './sessionResolver';
import {
  buildCoachingPlan,
  onboardingToCoachingInputs,
  type CoachingPlan,
} from './coachingEngine';
import type { OnboardingData, Workout } from '../types/domain';

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export type MismatchSeverity = 'critical' | 'warning' | 'info';

export interface Mismatch {
  day: string;
  date: string;
  engineFocus: string;
  engineTier: string;
  resolvedName: string | null;
  resolvedSource: string;
  reason: string;
  severity: MismatchSeverity;
}

export interface WeekDebugInfo {
  // Engine inputs
  seasonPhase: string;
  gameDay: string | null;
  hasGame: boolean;
  selectedDays: string[];
  availableDays: number;
  teamTrainingDays: string[];
  teamTrainingIntensity: string | null;

  // Engine decisions
  readiness: string;
  readinessFactors: string[];
  hardExposureCap: number;
  existingHardExposures: number;
  remainingHardBudget: number;
  coreSessions: number;
  optionalSessions: number;
  recoverySessions: number;

  // Weekly plan from engine
  weeklyPlan: Array<{
    day: string;
    tier: string;
    focus: string;
    isHardExposure: boolean;
  }>;

  // Resolver pass summary
  resolverSummary: Array<{
    date: string;
    day: string;
    source: string;
    sessionName: string | null;
    tier: string | null;
    indicator: string | null;
  }>;

  // Mismatches: engine plan vs resolver output
  mismatches: Mismatch[];
}

export interface DayDebugInfo {
  date: string;
  dayOfWeek: string;

  // Resolution
  source: string;
  sourceExplanation: string;
  resolvedSessionName: string | null;
  resolvedTier: string | null;
  resolvedWorkoutType: string | null;
  resolvedIntensity: string | null;

  // Origin tracking
  templateSessionName: string | null;
  wasTemplateReplaced: boolean;
  wasEmptySlotFilled: boolean;
  wasDerived: boolean;
  replacementReason: string | null;

  // Game proximity
  isGameDay: boolean;
  isGMinus1: boolean;
  isGMinus2: boolean;
  isGPlus1: boolean;
  daysToNextGame: number | null;
  daysSinceLastGame: number | null;
  gameProximityModified: boolean;

  // Template vs derived
  cameFromTemplate: boolean;
  cameFromDerived: boolean;
  wasOverridden: boolean;

  // Flags
  isOptional: boolean;
  isRecovery: boolean;
  isConditioning: boolean;

  // Exercise count
  exerciseCount: number;
}

// ═══════════════════════════════════════════════
// DAY LABELS
// ═══════════════════════════════════════════════

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT: Record<number, string> = { 0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT' };

// ═══════════════════════════════════════════════
// WEEK-LEVEL DEBUG
// ═══════════════════════════════════════════════

/**
 * Build week-level debug info.
 * Runs the coaching engine against onboarding data to show
 * the strategic decisions, then maps resolved days for comparison.
 */
export function buildWeekDebugInfo(
  onboarding: OnboardingData | null,
  resolvedWeek: ResolvedDay[],
  state: ScheduleState,
): WeekDebugInfo | null {
  if (!onboarding) return null;

  // Run the coaching engine with current onboarding data
  let plan: CoachingPlan;
  try {
    const inputs = onboardingToCoachingInputs(onboarding);
    plan = buildCoachingPlan(inputs);
  } catch (e) {
    // Engine might fail if onboarding incomplete — return partial info
    return {
      seasonPhase: onboarding.seasonPhase || '?',
      gameDay: onboarding.gameDay || null,
      hasGame: onboarding.seasonPhase === 'In-season' || onboarding.seasonPhase === 'Pre-season',
      selectedDays: onboarding.preferredTrainingDays || [],
      availableDays: onboarding.trainingDaysPerWeek || 0,
      teamTrainingDays: onboarding.teamTrainingDays || [],
      teamTrainingIntensity: onboarding.teamTrainingIntensity || null,
      readiness: '?',
      readinessFactors: [`Engine error: ${e}`],
      hardExposureCap: 0,
      existingHardExposures: 0,
      remainingHardBudget: 0,
      coreSessions: 0,
      optionalSessions: 0,
      recoverySessions: 0,
      weeklyPlan: [],
      resolverSummary: resolvedWeek.map(d => ({
        date: d.date,
        day: d.short,
        source: d.source,
        sessionName: d.workout?.name || null,
        tier: d.workout?.sessionTier || null,
        indicator: d.indicator,
      })),
      mismatches: [],
    };
  }

  return {
    seasonPhase: onboarding.seasonPhase || '?',
    gameDay: onboarding.gameDay || null,
    hasGame: plan.weeklyPlan.length > 0,
    selectedDays: onboarding.preferredTrainingDays || [],
    availableDays: onboarding.trainingDaysPerWeek || 0,
    teamTrainingDays: onboarding.teamTrainingDays || [],
    teamTrainingIntensity: onboarding.teamTrainingIntensity || null,

    readiness: plan.readiness,
    readinessFactors: plan.readinessFactors,
    hardExposureCap: plan.hardExposureCap,
    existingHardExposures: plan.existingHardExposures,
    remainingHardBudget: plan.remainingHardBudget,
    coreSessions: plan.coreSessions,
    optionalSessions: plan.optionalSessions,
    recoverySessions: plan.recoverySessions,

    weeklyPlan: plan.weeklyPlan.map(s => ({
      day: s.dayOfWeek || '?',
      tier: s.tier,
      focus: s.focus,
      isHardExposure: s.isHardExposure,
    })),

    resolverSummary: resolvedWeek.map(d => ({
      date: d.date,
      day: d.short,
      source: d.source,
      sessionName: d.workout?.name || null,
      tier: d.workout?.sessionTier || null,
      indicator: d.indicator,
    })),

    mismatches: computeMismatches(plan.weeklyPlan, resolvedWeek),
  };
}

// ═══════════════════════════════════════════════
// MISMATCH DETECTION
// ═══════════════════════════════════════════════

/**
 * Compare engine weekly plan against resolver output day-by-day.
 * A "mismatch" = the engine planned one thing but the resolver produced something different.
 * Expected mismatches (game proximity, conditioning fill) get explanatory reasons.
 */
function computeMismatches(
  enginePlan: Array<{ dayOfWeek?: string; tier: string; focus: string; isHardExposure: boolean }>,
  resolvedWeek: ResolvedDay[],
): Mismatch[] {
  const mismatches: Mismatch[] = [];

  for (const planned of enginePlan) {
    const dayName = planned.dayOfWeek || '?';
    const dayShort = dayName.substring(0, 3).toUpperCase();

    // Find the matching resolved day by day-of-week name
    const resolved = resolvedWeek.find(d => d.short === dayShort);
    if (!resolved) {
      mismatches.push({
        day: dayShort,
        date: '?',
        engineFocus: planned.focus,
        engineTier: planned.tier,
        resolvedName: null,
        resolvedSource: 'missing',
        reason: 'Engine planned a session but no resolved day found for this weekday',
        severity: 'critical',
      });
      continue;
    }

    const resolvedName = resolved.workout?.name || null;
    const resolvedTier = resolved.workout?.sessionTier || null;

    // No mismatch if resolver preserved a template session with matching tier
    if (resolved.source === 'template' && resolvedTier === planned.tier) continue;

    // Check for tier demotion or focus change
    if (resolved.source !== 'template') {
      // Resolver replaced or overrode the engine's planned session
      let reason: string;
      switch (resolved.source) {
        case 'game':
          reason = 'Calendar game mark overrode planned session';
          break;
        case 'rest':
          reason = 'Calendar rest mark overrode planned session';
          break;
        case 'gameProximity':
          reason = `Game proximity replaced planned ${planned.tier} → ${resolvedName || 'derived'}`;
          break;
        case 'manual':
          reason = 'Manual override replaced planned session';
          break;
        case 'conditioning':
          reason = 'Conditioning pass replaced planned session (unexpected)';
          break;
        case 'recovery':
          reason = 'Recovery pass replaced planned session (unexpected)';
          break;
        case 'none':
          reason = 'No workout resolved - engine plan was dropped';
          break;
        default:
          reason = `Source changed: ${resolved.source}`;
      }

      const severity = classifySeverity(planned.tier, planned.focus, resolved.source, resolvedTier);

      mismatches.push({
        day: dayShort,
        date: resolved.date,
        engineFocus: planned.focus,
        engineTier: planned.tier,
        resolvedName,
        resolvedSource: resolved.source,
        reason,
        severity,
      });
    } else if (resolvedTier !== planned.tier) {
      // Template preserved but tier differs (e.g. engine said core, template says optional)
      const severity = classifySeverity(planned.tier, planned.focus, resolved.source, resolvedTier);
      mismatches.push({
        day: dayShort,
        date: resolved.date,
        engineFocus: planned.focus,
        engineTier: planned.tier,
        resolvedName,
        resolvedSource: resolved.source,
        reason: `Tier mismatch: engine planned ${planned.tier}, template has ${resolvedTier}`,
        severity,
      });
    }
  }

  return mismatches;
}

/**
 * Classify mismatch severity.
 *
 * CRITICAL — a core session was lost, demoted, or dropped.
 *   Core sessions carry the week's primary movement exposure (lower, push,
 *   pull, full body). Losing one means an entire movement pattern is missing.
 *
 * WARNING — an optional/recovery session changed in a notable but non-breaking
 *   way, OR an expected game-proximity swap happened on a non-core slot.
 *
 * INFO — benign expected changes (manual override, game/rest calendar mark
 *   on a recovery or optional slot).
 */
function classifySeverity(
  engineTier: string,
  engineFocus: string,
  resolvedSource: string,
  resolvedTier: string | null,
): MismatchSeverity {
  const isCorePlanned = engineTier === 'core';
  const focusLower = engineFocus.toLowerCase();
  const isKeyFocus = focusLower.includes('lower') || focusLower.includes('push')
    || focusLower.includes('pull') || focusLower.includes('upper')
    || focusLower.includes('full body');

  // ── CRITICAL ──
  // Core session disappeared entirely
  if (isCorePlanned && resolvedSource === 'none') return 'critical';
  // Core session demoted to non-core tier
  if (isCorePlanned && resolvedTier !== 'core') return 'critical';
  // Key movement focus (lower/push/pull/upper/full body) lost regardless of tier
  if (isKeyFocus && resolvedSource === 'none') return 'critical';

  // ── INFO ──
  // Manual overrides are intentional human edits — always info
  if (resolvedSource === 'manual') return 'info';
  // Game/rest calendar marks on non-core slots are expected
  if (!isCorePlanned && (resolvedSource === 'game' || resolvedSource === 'rest')) return 'info';

  // ── WARNING ── (everything else)
  // Game proximity swaps on core (expected near game weeks but still notable)
  // Optional/recovery tier changes, conditioning/recovery replacements
  return 'warning';
}

// ═══════════════════════════════════════════════
// DAY-LEVEL DEBUG
// ═══════════════════════════════════════════════

/**
 * Build day-level debug info from a resolved day + schedule state.
 * Includes origin tracking: what was the template session before any modification?
 */
export function buildDayDebugInfo(
  resolved: ResolvedDay,
  state: ScheduleState,
): DayDebugInfo {
  const { date, source, workout } = resolved;
  const gameDates = getGameDatesFromState(state);
  const dayName = DAY_NAMES[resolved.dayOfWeek] || '?';

  // Game proximity
  const isGameDay = source === 'game' || workout?.workoutType === 'Game';
  const isGMinus1 = gameDates.has(addDays(date, 1));
  const isGMinus2 = gameDates.has(addDays(date, 2));
  const isGPlus1 = gameDates.has(addDays(date, -1));

  const daysToNextGame = findDaysToNextGame(date, gameDates);
  const daysSinceLastGame = findDaysSinceLastGame(date, gameDates);

  const gameProximityModified = source === 'gameProximity';
  const cameFromTemplate = source === 'template';
  const cameFromDerived = source === 'gameProximity' || source === 'conditioning' || source === 'recovery';
  const wasOverridden = source === 'manual';

  // Origin tracking — what was the original template session for this day?
  const templateSessionName = findTemplateSessionName(date, state);
  const resolvedName = workout?.name || null;
  const wasTemplateReplaced = templateSessionName !== null && resolvedName !== templateSessionName && source !== 'template';
  const wasEmptySlotFilled = templateSessionName === null && (source === 'conditioning' || source === 'recovery');
  const wasDerived = source === 'gameProximity' || source === 'conditioning' || source === 'recovery';
  const replacementReason = buildReplacementReason(source, templateSessionName, resolvedName, resolved, gameDates);

  return {
    date,
    dayOfWeek: dayName,

    source,
    sourceExplanation: explainSource(resolved, state, templateSessionName),
    resolvedSessionName: resolvedName,
    resolvedTier: workout?.sessionTier || null,
    resolvedWorkoutType: workout?.workoutType || null,
    resolvedIntensity: workout?.intensity || null,

    templateSessionName,
    wasTemplateReplaced,
    wasEmptySlotFilled,
    wasDerived,
    replacementReason,

    isGameDay,
    isGMinus1,
    isGMinus2,
    isGPlus1,
    daysToNextGame,
    daysSinceLastGame,
    gameProximityModified,

    cameFromTemplate,
    cameFromDerived,
    wasOverridden,

    isOptional: workout?.sessionTier === 'optional',
    isRecovery: workout?.sessionTier === 'recovery' || workout?.workoutType === 'Recovery',
    isConditioning: source === 'conditioning',

    exerciseCount: workout?.exercises?.length || 0,
  };
}

// ═══════════════════════════════════════════════
// SOURCE EXPLANATION — "Why this day changed"
// ═══════════════════════════════════════════════

function explainSource(
  resolved: ResolvedDay,
  state: ScheduleState,
  templateName: string | null,
): string {
  const { source, workout, date } = resolved;
  const resolvedName = workout?.name || null;

  switch (source) {
    case 'manual':
      return templateName
        ? `Manual override: "${templateName}" → "${resolvedName || 'custom workout'}"`
        : `Manual override applied → "${resolvedName || 'custom workout'}"`;

    case 'game':
      return templateName
        ? `Calendar game mark replaced "${templateName}" → Game Day stub`
        : 'Calendar game mark → Game Day stub';

    case 'rest':
      return templateName
        ? `Calendar rest mark replaced "${templateName}" → rest day`
        : 'Calendar rest mark → rest day (no workout)';

    case 'gameProximity': {
      const gameDates = getGameDatesFromState(state);
      const tmpl = templateName ? ` (was "${templateName}")` : '';

      if (gameDates.has(addDays(date, -1))) {
        return `G+1 recovery: template replaced → "${resolvedName || 'Recovery'}"${tmpl}`;
      }
      if (gameDates.has(addDays(date, 1))) {
        return `G-1 pre-game: template replaced → "${resolvedName || 'Gunshow'}"${tmpl}`;
      }
      if (gameDates.has(addDays(date, 2))) {
        const name = workout?.name?.toLowerCase() || '';
        if (name.includes('prehab') || name.includes('accessor')) {
          return `Freed game slot → "${resolvedName || 'Prehab & Accessories'}"${tmpl}`;
        }
        return `G-2 moderate: template intensity capped → "${resolvedName || '?'}"${tmpl}`;
      }
      if (workout?.description?.includes('Freed game slot')) {
        return `Freed game slot → "${resolvedName || 'Prehab & Accessories'}"${tmpl}`;
      }
      return `Game proximity rule applied → "${resolvedName || '?'}"${tmpl}`;
    }

    case 'conditioning':
      return `Empty slot filled by conditioning → "${resolvedName || '?'}"`;

    case 'recovery':
      return `Empty slot filled by recovery → "${resolvedName || 'Recovery session'}"`;

    case 'template': {
      const tier = workout?.sessionTier || '';
      if (workout?.sessionTier === 'recovery' || workout?.workoutType === 'Recovery') {
        return `Template recovery session preserved → "${resolvedName || '?'}"`;
      }
      return `Template ${tier} session preserved → "${resolvedName || '?'}"`;
    }

    case 'none':
      return templateName
        ? `Template "${templateName}" dropped - out of block or rest day`
        : 'No workout (out of block, rest, or empty slot)';

    default:
      return `Unknown source: ${source}`;
  }
}

// ═══════════════════════════════════════════════
// ORIGIN HELPERS
// ═══════════════════════════════════════════════

/**
 * Find the original template session name for a given date.
 * Looks up the microcycle workouts by day-of-week index.
 */
function findTemplateSessionName(date: string, state: ScheduleState): string | null {
  if (!state.currentMicrocycle?.workouts) return null;

  const [y, m, d] = date.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d, 12, 0, 0);
  const dayOfWeek = dateObj.getDay(); // 0=Sun..6=Sat

  // Microcycle workouts are indexed 0-6 (Mon=0..Sun=6) or by day name
  // Try to find workout matching this day of week
  const workouts = state.currentMicrocycle.workouts;
  for (const w of workouts) {
    if (w.dayOfWeek === dayOfWeek) {
      return w.name || null;
    }
  }
  return null;
}

/**
 * Build a human-readable replacement reason from source + origin data.
 */
function buildReplacementReason(
  source: string,
  templateName: string | null,
  resolvedName: string | null,
  resolved: ResolvedDay,
  gameDates: Set<string>,
): string | null {
  if (source === 'template') return null; // No replacement happened
  if (source === 'none' && !templateName) return null; // Nothing to replace

  switch (source) {
    case 'manual':
      return templateName
        ? `User/coach manually replaced "${templateName}"`
        : 'User/coach manual override';
    case 'game':
      return templateName
        ? `Game day calendar mark replaced "${templateName}"`
        : 'Game day calendar mark';
    case 'rest':
      return templateName
        ? `Rest day calendar mark replaced "${templateName}"`
        : 'Rest day calendar mark';
    case 'gameProximity': {
      const { date } = resolved;
      if (gameDates.has(addDays(date, -1))) return `G+1 recovery rule replaced "${templateName || 'session'}"`;
      if (gameDates.has(addDays(date, 1))) return `G-1 pre-game rule replaced "${templateName || 'session'}"`;
      if (gameDates.has(addDays(date, 2))) return `G-2 moderate rule replaced "${templateName || 'session'}"`;
      return `Game proximity replaced "${templateName || 'session'}"`;
    }
    case 'conditioning':
      return 'Conditioning pass filled empty slot';
    case 'recovery':
      return 'Recovery pass filled empty slot';
    case 'none':
      return templateName ? `Template "${templateName}" dropped (out of block)` : null;
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function getGameDatesFromState(state: ScheduleState): Set<string> {
  const games = new Set<string>();
  if (state.markedDays) {
    for (const [date, type] of Object.entries(state.markedDays)) {
      if (type === 'game') games.add(date);
    }
  }
  return games;
}

function findDaysToNextGame(date: string, gameDates: Set<string>): number | null {
  for (let i = 1; i <= 14; i++) {
    if (gameDates.has(addDays(date, i))) return i;
  }
  return null;
}

function findDaysSinceLastGame(date: string, gameDates: Set<string>): number | null {
  for (let i = 1; i <= 14; i++) {
    if (gameDates.has(addDays(date, -i))) return i;
  }
  return null;
}
