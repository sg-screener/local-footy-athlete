"use strict";
/**
 * Session Resolver — Pure Scheduling Engine
 *
 * ARCHITECTURE:
 *   Single source of truth for "what session belongs on date X?"
 *   Zero React. Zero Zustand. Pure functions only.
 *
 *   resolveDate() is the atomic unit. Every other function calls it.
 *
 * RESOLUTION PRIORITY:
 *   1. Manual override (human/coach authored workout swap)
 *   2. Calendar mark: rest → null workout
 *   3. Calendar mark: game → game stub
 *   4. Template says game but calendar doesn't → freed slot (optional session)
 *   5. Template + game proximity rules (G+1 recovery, G-1 demote, G-2 moderate)
 *   6. Unmodified template
 *   7. No workout (out of block or rest day)
 *
 * DESIGN PRINCIPLES:
 *   - Automatic adjustments (game proximity) are DERIVED, not stored
 *   - Only manual human/coach edits are persisted (manualOverrides)
 *   - Every screen calls these functions through hooks — one pipeline everywhere
 *   - No useMemo for schedule data — derive on every render (trivial cost)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDate = formatDate;
exports.addDays = addDays;
exports.computeBlockBounds = computeBlockBounds;
exports.getMondayStr = getMondayStr;
exports.isProtectedCoreExposure = isProtectedCoreExposure;
exports.canReplaceSession = canReplaceSession;
exports.resolveDate = resolveDate;
exports.resolveWeek = resolveWeek;
exports.resolveMonthIndicators = resolveMonthIndicators;
exports.getMondayForDate = getMondayForDate;
exports.resolveWeekWithConditioning = resolveWeekWithConditioning;
exports.resolveDateWithConditioning = resolveDateWithConditioning;
exports.resolveMonthIndicatorsWithConditioning = resolveMonthIndicatorsWithConditioning;
exports.getBlockBounds = getBlockBounds;
exports.computeGameDatesForBlock = computeGameDatesForBlock;
exports.formatWeekLabel = formatWeekLabel;
const sessionBuilder_1 = require("./sessionBuilder");
const weekLogBuilder_1 = require("./weekLogBuilder");
const recoveryRules_1 = require("./recoveryRules");
const strengthProgressionIntegration_1 = require("./strengthProgressionIntegration");
const feedbackPatterns_1 = require("./feedbackPatterns");
const feedbackAdapter_1 = require("./feedbackAdapter");
// ─── Constants ───
const DAY_SHORT = {
    0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT',
};
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// ─── Date Helpers ───
function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function addDays(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0, 0);
    date.setDate(date.getDate() + n);
    return formatDate(date);
}
function shiftDate(dateStr, days) {
    return addDays(dateStr, days);
}
/**
 * Build a map of exerciseId → last performed weight from weight overrides.
 * Only considers dates strictly before `beforeDate`.
 * Returns an empty record if no overrides exist.
 */
function buildLastPerformedWeights(allOverrides, beforeDate) {
    const result = {};
    // Walk dates in reverse chronological order
    const dates = Object.keys(allOverrides).filter(d => d < beforeDate).sort().reverse();
    for (const d of dates) {
        const exerciseWeights = allOverrides[d];
        for (const [exId, weight] of Object.entries(exerciseWeights)) {
            // Only take the most recent for each exercise
            if (!(exId in result)) {
                result[exId] = weight;
            }
        }
    }
    return result;
}
function dateToDayOfWeek(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
}
function isInBlock(dateStr, program) {
    if (!program)
        return false;
    const start = program.startDate.split('T')[0];
    const end = program.endDate.split('T')[0];
    return dateStr >= start && dateStr <= end;
}
// ─── Block Boundary Computation ───
//
// Aligns training blocks to calendar week boundaries (Mon-Sun).
//
// Rule: "The week the user starts in is Week 1. Then give them the next
// 3 full weeks, ending on Sunday."
//
// This means:
//   - Block start = Monday of the week containing the actual start date
//   - Block end = Sunday of the 3rd full week after the start week
//   - Start week counts as Week 1 (even if partial)
//   - Total span = 4 calendar weeks (Mon→Sun × 4 = 28 days)
//
// Examples:
//   Start Monday    7 Apr → block = 7 Apr (Mon) – 4 May (Sun) → 4 full weeks
//   Start Thursday 10 Apr → block = 7 Apr (Mon) – 4 May (Sun) → partial W1 + 3 full
//   Start Saturday 12 Apr → block = 7 Apr (Mon) – 4 May (Sun) → partial W1 + 3 full
//   Start Sunday   13 Apr → block = 7 Apr (Mon) – 4 May (Sun) → 1 day of W1 + 3 full
/**
 * Compute week-aligned block start (Monday) and end (Sunday) from
 * any start date. Returns ISO date strings (YYYY-MM-DD).
 *
 * Exported so generateProgram and defaultProgram can share the same
 * boundary logic instead of ad-hoc date arithmetic.
 */
function computeBlockBounds(startDate) {
    // Find Monday of the week containing startDate
    const dow = startDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysToMonday = dow === 0 ? -6 : -(dow - 1);
    const monday = new Date(startDate);
    monday.setDate(startDate.getDate() + daysToMonday);
    monday.setHours(12, 0, 0, 0);
    // Block end = 27 days later (4 calendar weeks: Mon→Sun × 4)
    // Mon + 27 days = Sunday of 4th week
    const endSunday = new Date(monday);
    endSunday.setDate(monday.getDate() + 27);
    endSunday.setHours(12, 0, 0, 0);
    return {
        blockStart: formatDate(monday),
        blockEnd: formatDate(endSunday),
    };
}
/** Get ISO date string for Monday of the week containing today, offset by N weeks. */
function getMondayStr(weekOffset) {
    const now = new Date();
    const dow = now.getDay(); // 0=Sun
    const mondayOffset = dow === 0 ? -6 : -(dow - 1);
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset + weekOffset * 7);
    monday.setHours(12, 0, 0, 0);
    return formatDate(monday);
}
function toDateString(year, month, day) {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
}
// ─── Classification Helpers (from blockAdjuster) ───
function isLowerDominant(workout) {
    const name = workout.name.toLowerCase();
    return name.includes('lower') || name.includes('leg') || name.includes('squat') || name.includes('hinge');
}
// ─── Core Exposure Protection ───
/**
 * REQUIRED EXPOSURE TYPES — the movement patterns the engine plans as
 * non-negotiable within a microcycle. If a session's name matches one of
 * these and it carries tier === 'core', it represents a required exposure
 * that the resolver must NOT delete, replace, or downgrade.
 */
const REQUIRED_EXPOSURE_PATTERNS = [
    'lower', 'push', 'pull', 'upper', 'full body', 'balanced',
];
/**
 * Returns true when a workout is a protected core exposure that the resolver
 * must never remove or replace. Such sessions may only be intensity-modified,
 * exercise-adjusted, or annotated.
 *
 * A session is protected when:
 *   1. It has tier === 'core'
 *   2. Its name matches a required exposure pattern (lower, push, pull, upper, balanced, full body)
 *
 * Game stubs (workoutType === 'Game') are NOT protected by this guard — they
 * follow their own calendar-mark resolution path.
 */
function isProtectedCoreExposure(workout) {
    if (!workout)
        return false;
    if (workout.sessionTier !== 'core')
        return false;
    if (workout.workoutType === 'Game')
        return false;
    const name = workout.name.toLowerCase();
    return REQUIRED_EXPOSURE_PATTERNS.some(p => name.includes(p));
}
/**
 * Shared guard: can this session be replaced by the resolver?
 *
 * Returns false (replacement blocked) when:
 *   - The session is a protected core exposure (see isProtectedCoreExposure)
 *   - AND it came from 'template' or 'manual' source (engine-planned or coach-authored)
 *
 * Returns true (replacement allowed) when:
 *   - The session is derived (source: gameProximity, conditioning, recovery)
 *   - OR it's non-core / non-exposure (prehab, accessories, arms/pump)
 *   - OR workout is null
 *
 * @param workout  The workout that would be replaced
 * @param source   The ResolvedDay source of the session
 * @param context  Descriptive label for dev logging (e.g. 'G+1 recovery', 'fatigue-stacking guard')
 * @param date     ISO date string for dev logging
 */
function canReplaceSession(workout, source, context, date) {
    if (!workout)
        return true;
    // Only protect template (engine-planned) and manual (coach-authored) sessions
    if (source !== 'template' && source !== 'manual')
        return true;
    if (isProtectedCoreExposure(workout)) {
        if (__DEV__) {
            console.log(`[resolver] BLOCKED replacement of protected core "${workout.name}" ` +
                `(tier=${workout.sessionTier}, source=${source}) on ${date} — context: ${context}`);
        }
        return false;
    }
    return true;
}
function createGameStub(dateStr, dow) {
    const now = new Date().toISOString();
    return {
        id: `calendar-game-${dateStr}`,
        microcycleId: 'calendar',
        dayOfWeek: dow,
        name: 'Game Day',
        description: 'Match day',
        durationMinutes: 120,
        intensity: 'High',
        workoutType: 'Game',
        sessionTier: 'core',
        exercises: [],
        createdAt: now,
        updatedAt: now,
    };
}
// ─── Game Proximity Logic (from blockAdjuster) ───
/** Extract all game date strings from markedDays. */
function getAllGameDates(markedDays) {
    const games = new Set();
    for (const [date, type] of Object.entries(markedDays)) {
        if (type === 'game')
            games.add(date);
    }
    return games;
}
/**
 * Check if a nearby game modifies this session via proximity rules.
 * Returns a modified Workout if so, null if the template is fine as-is.
 *
 * Rules:
 *   G+1 (day after game)  → Recovery Session (flush, mobilise, restore)
 *   G-1 (day before game) → Arms / Pump (always — low-fatigue upper body)
 *   G-2 (2 days before)   → moderate lower-dominant sessions
 *
 * G-1 defaults to Arms/Pump but preserves recovery and rest sessions
 * (for fatigue/injury flexibility). This ensures the pre-game session
 * follows the game dynamically when the game date moves.
 */
function applyGameProximity(date, templateWorkout, gameDates, microcycleId, athlete) {
    // G+1: day after a game → recovery (even if no template workout)
    if (gameDates.has(shiftDate(date, -1))) {
        if (!templateWorkout || (templateWorkout.sessionTier !== 'recovery' && templateWorkout.workoutType !== 'Game')) {
            // GUARD: never replace a protected core exposure with recovery.
            // The engine placed this session here for a reason (required exposure).
            // Template workouts passed to this function always have source='template'.
            if (isProtectedCoreExposure(templateWorkout)) {
                if (__DEV__) {
                    console.log(`[resolver] BLOCKED G+1 recovery replacing protected core "${templateWorkout.name}" on ${date}`);
                }
                return null; // keep the template as-is
            }
            return (0, sessionBuilder_1.buildDerivedSession)('recovery', date, microcycleId, 'Post-game recovery', athlete);
        }
    }
    // G-1: day before a game → Arms / Pump
    // BUT preserve recovery sessions and rest days (fatigue/injury flexibility)
    if (gameDates.has(shiftDate(date, 1))) {
        // Keep recovery as-is
        if (templateWorkout?.sessionTier === 'recovery' || templateWorkout?.workoutType === 'Recovery') {
            return null;
        }
        // Keep game as-is (shouldn't happen but guard)
        if (templateWorkout?.workoutType === 'Game') {
            return null;
        }
        // GUARD: never replace a protected core exposure with Arms/Pump.
        // The engine placed this session (e.g. Lower Strength on G-1) deliberately.
        if (isProtectedCoreExposure(templateWorkout)) {
            if (__DEV__) {
                console.log(`[resolver] BLOCKED G-1 Arms/Pump replacing protected core "${templateWorkout.name}" on ${date}`);
            }
            return null; // keep the template as-is
        }
        // Everything else → Arms / Pump
        return (0, sessionBuilder_1.buildDerivedSession)('arms_pump', date, microcycleId, 'Pre-game day', athlete);
    }
    if (!templateWorkout)
        return null;
    // G-2: 2 days before a game → moderate lower-dominant sessions
    if (gameDates.has(shiftDate(date, 2))) {
        if (isLowerDominant(templateWorkout) && templateWorkout.sessionTier === 'core') {
            return {
                ...templateWorkout,
                id: `derived-nearGame-${date}`,
                intensity: 'Moderate',
                description: `${templateWorkout.description} (48h to game — moderate load)`,
                exercises: templateWorkout.exercises.map(e => ({
                    ...e,
                    // Preserve nested exercise sub-object for display
                    exercise: e.exercise || { id: e.exerciseId, name: e.notes || `Exercise ${e.exerciseOrder}`, description: '' },
                })),
                updatedAt: new Date().toISOString(),
            };
        }
    }
    return null; // no proximity effect
}
// ─── Indicator Helper ───
function workoutToIndicator(workout, source) {
    if (source === 'rest')
        return 'rest';
    if (source === 'game')
        return 'game';
    if (source === 'conditioning')
        return 'conditioning';
    if (!workout)
        return null;
    if (workout.workoutType === 'Game')
        return 'game';
    if (workout.sessionTier === 'recovery' || workout.workoutType === 'Recovery')
        return 'recovery';
    if (workout.sessionTier === 'optional')
        return 'optional';
    return 'core';
}
// ─── Build Helper ───
function buildDay(date, dow, today, workout, source) {
    return {
        date,
        dayOfWeek: dow,
        short: DAY_SHORT[dow],
        isToday: date === today,
        workout,
        source,
        indicator: workoutToIndicator(workout, source),
    };
}
// ─── Core Function ───
/**
 * resolveDate — Single source of truth for any date's workout.
 *
 * Resolution priority:
 *   1. Manual override (human/coach)
 *   2. Calendar rest mark → null
 *   3. Calendar game mark → game stub
 *   4. Template says game but no calendar mark → freed slot (optional session)
 *   5. Template + game proximity rules
 *   6. Unmodified template
 *   7. No workout
 */
function resolveDate(date, state) {
    const { currentProgram, currentMicrocycle, manualOverrides, markedDays } = state;
    const dow = dateToDayOfWeek(date);
    const today = formatDate(new Date());
    const inBlock = isInBlock(date, currentProgram);
    // ── Priority 1: Manual override (human/coach authored) ──
    if (manualOverrides && manualOverrides[date]) {
        return buildDay(date, dow, today, manualOverrides[date], 'manual');
    }
    // ── Priority 2: Calendar marks (game / rest) ──
    const mark = markedDays ? markedDays[date] : undefined;
    if (mark === 'rest') {
        return buildDay(date, dow, today, null, 'rest');
    }
    if (mark === 'game') {
        return buildDay(date, dow, today, createGameStub(date, dow), 'game');
    }
    // ── No block data → nothing to resolve ──
    if (!inBlock || !currentMicrocycle) {
        return buildDay(date, dow, today, null, 'none');
    }
    const templateWorkout = currentMicrocycle.workouts.find(w => w.dayOfWeek === dow) || null;
    // ── Priority 4: Game proximity rules (G+1 recovery, G-1 arms/pump, G-2 moderate) ──
    // Evaluated BEFORE freed-game-slot so that a moved game's G+1 takes priority
    // over a template game that no longer has a calendar mark.
    const gameDates = getAllGameDates(markedDays || {});
    const effectiveTemplate = (templateWorkout?.workoutType === 'Game' && !mark)
        ? null // template game without calendar mark → treat as empty for proximity
        : templateWorkout;
    const proximityResult = applyGameProximity(date, effectiveTemplate, gameDates, currentMicrocycle.id, state.athleteContext);
    if (proximityResult) {
        console.log(`[RESOLVER-PROXIMITY] date=${date} dow=${dow} → ${proximityResult.name} (tier=${proximityResult.sessionTier})`);
        return buildDay(date, dow, today, proximityResult, 'gameProximity');
    }
    // ── Priority 5: Template says game but calendar doesn't (freed slot) ──
    // Only reached if game proximity didn't claim this date.
    // If other games still exist THIS WEEK → low-priority prehab (athlete has game fatigue).
    // If NO games this week (bye / game removed) → promote to core training slot.
    // This prevents the freed game day from being wasted on prehab when the athlete
    // has full recovery capacity and should use the day for real training.
    //
    // IMPORTANT: gameDates includes ALL marked games across the entire block.
    // We must filter to only games within the same Mon–Sun week as `date`.
    if (templateWorkout?.workoutType === 'Game' && !mark) {
        const mondayOfWeek = getMondayForDate(date);
        const sundayOfWeek = addDays(mondayOfWeek, 6);
        let gamesThisWeek = 0;
        for (const gd of gameDates) {
            if (gd >= mondayOfWeek && gd <= sundayOfWeek) {
                gamesThisWeek++;
            }
        }
        console.log(`[RESOLVER-FREED-GAME] date=${date} dow=${dow} mondayOfWeek=${mondayOfWeek} gamesThisWeek=${gamesThisWeek} totalGameDates=${gameDates.size}`);
        if (gamesThisWeek > 0) {
            // Other games exist THIS WEEK — athlete still has game fatigue. Light prehab is appropriate.
            console.log(`[RESOLVER-FREED-GAME] other games remain this week -> returning prehab`);
            return buildDay(date, dow, today, (0, sessionBuilder_1.buildDerivedSession)('prehab_accessories', date, currentMicrocycle.id, 'Freed game slot', state.athleteContext), 'gameProximity');
        }
        else {
            // No games this week — freed capacity. Return null workout so
            // conditioning pass (Pass 2) can fill this as the primary training slot.
            // Source 'none' lets conditioning/recovery passes claim it.
            console.log(`[RESOLVER-FREED-GAME] no games this week -> returning none (freed for conditioning)`);
            return buildDay(date, dow, today, null, 'none');
        }
    }
    // ── Priority 6a: Recovery template → replace with derived pool session ──
    // AI-generated recovery workouts lack structured prescription fields (prescriptionType,
    // perSide, restSeconds). Replace them with deterministic pool-built sessions so every
    // recovery exercise has proper sets/duration/reps for the structured renderer.
    if (templateWorkout &&
        (templateWorkout.sessionTier === 'recovery' || templateWorkout.workoutType === 'Recovery')) {
        return buildDay(date, dow, today, (0, sessionBuilder_1.buildDerivedSession)('recovery', date, currentMicrocycle.id, 'Scheduled recovery — active', state.athleteContext), 'template');
    }
    // ── Priority 6b: Unmodified template ──
    return buildDay(date, dow, today, templateWorkout, templateWorkout ? 'template' : 'none');
}
// ─── Wrapper Functions ───
/** Resolve 7 days (Mon→Sun) for the week starting at mondayStr. */
function resolveWeek(mondayStr, state) {
    const days = [];
    for (let i = 0; i < 7; i++) {
        days.push(resolveDate(addDays(mondayStr, i), state));
    }
    return days;
}
/** Resolve indicator for every date in a month. Used by Calendar grid. */
function resolveMonthIndicators(year, month, state) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result = {};
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = toDateString(year, month, d);
        result[dateStr] = resolveDate(dateStr, state).indicator;
    }
    return result;
}
// ─── Conditioning-Aware Resolution ───
/**
 * Get the Monday (ISO date) of the week containing a given date.
 */
function getMondayForDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0, 0);
    const dow = date.getDay(); // 0=Sun
    const mondayOffset = dow === 0 ? -6 : -(dow - 1);
    date.setDate(date.getDate() + mondayOffset);
    return formatDate(date);
}
/**
 * Resolve a full week with conditioning and recovery placement.
 *
 * Three-pass approach:
 *   Pass 1: Resolve all 7 days normally (strength templates, game proximity, overrides).
 *   Pass 2: Walk Mon→Sun. For each empty day within the active block,
 *           try conditioning placement via the rule engine. Earlier days'
 *           placements feed into later days' WeekLog (progressive accumulation).
 *   Pass 3: Walk Mon→Sun again. For each STILL-empty day within the block,
 *           try recovery placement. Recovery never coexists with strength
 *           or conditioning on the same day. Uses readiness-based category
 *           selection (passive / active / extended) with frequency guards.
 *
 * Resolution order: Strength → Conditioning → Recovery fills gaps.
 * Each pass is additive — never displaces prior passes.
 *
 * If no seasonPhase is available (pre-onboarding), passes 2 and 3 are skipped.
 */
function resolveWeekWithConditioning(mondayStr, state) {
    // Pass 1: base resolution (strength, game proximity, templates)
    const baseDays = resolveWeek(mondayStr, state);
    // Guard: skip conditioning + recovery if no season context
    if (!state.seasonPhase)
        return baseDays;
    // ── Availability hard-filter ──
    // Build a Set of allowed day-of-week numbers for O(1) lookup.
    // If availableDayNumbers is undefined/empty, all days are allowed.
    const availableSet = state.availableDayNumbers && state.availableDayNumbers.length > 0
        ? new Set(state.availableDayNumbers)
        : null;
    const isDayAvailable = (dayOfWeek) => availableSet === null || availableSet.has(dayOfWeek);
    // Extract all game dates from markedDays (full calendar, not just this week)
    const gameDates = [];
    for (const [date, type] of Object.entries(state.markedDays || {})) {
        if (type === 'game')
            gameDates.push(date);
    }
    // Determine block bounds for in-block check
    const blockStart = state.currentProgram?.startDate?.split('T')[0] || null;
    const blockEnd = state.currentProgram?.endDate?.split('T')[0] || null;
    // ── Strength Progression Pass ──
    // Apply progression adjustments to template strength sessions.
    // This is a builder-layer operation that modifies prescriptions
    // (sets, reps, weight, rest) based on the progression engine.
    // Only affects exercises classified as primary_strength or secondary_strength.
    // Does NOT modify resolveDate() or change any placement logic.
    const injuries = (state.athleteContext?.injuries || []).map(i => ({
        bodyArea: i.bodyArea,
        severity: i.severity,
    }));
    // Build sorted feedback array once for the whole week.
    // Newest first, filtered to entries before the earliest day in the week.
    const feedbackMap = state.sessionFeedback || {};
    const allFeedbackSorted = Object.values(feedbackMap)
        .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    // Pattern summary for conditioning/recovery biases (computed once per week)
    const weekPatternSummary = (0, feedbackPatterns_1.analyzeFeedbackPatterns)(allFeedbackSorted.filter((fb) => fb.dateStr < baseDays[0]?.date));
    // Build a workout-type-by-date map for session type matching.
    // Uses resolved base days + template workouts to map dates → workoutType.
    const workoutTypeByDate = {};
    for (const day of baseDays) {
        if (day.workout) {
            workoutTypeByDate[day.date] = day.workout.workoutType;
        }
    }
    // Also include historical dates from feedback that have no resolved day
    // (previous weeks). Use the workout name/type from the template by dayOfWeek.
    if (state.currentMicrocycle) {
        for (const fb of allFeedbackSorted) {
            if (!workoutTypeByDate[fb.dateStr] && state.currentMicrocycle.workouts) {
                const [fy, fm, fd] = fb.dateStr.split('-').map(Number);
                const fbDate = new Date(fy, fm - 1, fd);
                const fbDow = fbDate.getDay();
                const matchingWorkout = state.currentMicrocycle.workouts.find((w) => w.dayOfWeek === fbDow);
                if (matchingWorkout) {
                    workoutTypeByDate[fb.dateStr] = matchingWorkout.workoutType;
                }
            }
        }
    }
    for (let i = 0; i < baseDays.length; i++) {
        const day = baseDays[i];
        if (day.workout &&
            day.workout.workoutType === 'Strength' &&
            (day.source === 'template' || day.source === 'manual')) {
            // Recent feedback before this date — for per-day pattern analysis
            const priorFeedback = allFeedbackSorted.filter((fb) => fb.dateStr < day.date);
            const lastFeedbackFeeling = priorFeedback.length > 0
                ? priorFeedback[0].feeling || null
                : null;
            // Session-type-matched adaptation (from new difficulty/soreness fields)
            const matchedFeedback = (0, feedbackAdapter_1.findMatchingFeedback)(day.workout.workoutType, feedbackMap, workoutTypeByDate, day.date);
            const adaptation = (0, feedbackAdapter_1.deriveAdaptation)(matchedFeedback);
            const progressionCtx = (0, strengthProgressionIntegration_1.buildProgressionContext)(state.seasonPhase, state.readiness || 'medium', gameDates, day.date, injuries, state.markedDays || {}, 
            // workoutHistory: empty default — caller can provide via extended state
            [], lastFeedbackFeeling, priorFeedback.slice(0, 4), // analysis window for pattern biases
            adaptation.explanation ? adaptation : null);
            // Build last-performed-weight map from weight overrides (dates before today)
            const lastPerformedWeights = buildLastPerformedWeights(state.weightOverrides || {}, day.date);
            const progressedWorkout = (0, strengthProgressionIntegration_1.applyStrengthProgression)(day.workout, progressionCtx, Object.keys(lastPerformedWeights).length > 0 ? lastPerformedWeights : undefined);
            // Attach adaptation explanation as metadata for UI consumption
            if (adaptation.explanation) {
                progressedWorkout._adaptationExplanation = adaptation.explanation;
            }
            baseDays[i] = {
                ...day,
                workout: progressedWorkout,
            };
        }
    }
    // ── Double game week: second G+1 → full rest ──
    // On double game weeks, game proximity places recovery on BOTH G+1 days.
    // The second G+1 should be full rest — the athlete played two games in
    // one week and needs complete recovery, not another session.
    // Convert the later G+1 recovery to rest before conditioning/recovery passes
    // so neither pass attempts to fill it.
    const result = [...baseDays];
    const today = formatDate(new Date());
    const g1Indices = [];
    for (let i = 0; i < result.length; i++) {
        const day = result[i];
        if (day.source === 'gameProximity' &&
            day.workout &&
            (day.workout.workoutType === 'Recovery' || day.workout.sessionTier === 'recovery')) {
            g1Indices.push(i);
        }
    }
    if (g1Indices.length >= 2) {
        // Keep the first G+1 recovery, convert all subsequent to full rest
        for (let k = 1; k < g1Indices.length; k++) {
            const idx = g1Indices[k];
            result[idx] = buildDay(result[idx].date, result[idx].dayOfWeek, today, null, 'rest');
        }
    }
    // ── Pre-game fatigue-stacking guard ──
    // After Pass 1, game proximity may have assigned G-1 as Arms/Pump.
    // If G-2 is ALSO an arms/pump or derived game-proximity session (NOT a
    // template core session), the athlete gets redundant upper-body stress
    // in the 48h pre-game window.
    //
    // CRITICAL INVARIANT: Template core sessions on G-2 are NEVER replaced.
    // The coaching engine specifically places a moderate push/upper session
    // at G-2. That is the intended design — Upper Push on G-2 + Arms/Pump
    // on G-1 is the correct fatigue wave. Only derived/proximity duplicates
    // should be downgraded (e.g. two Arms/Pump from adjacent games).
    for (let i = 0; i < result.length; i++) {
        const day = result[i];
        // Find G-1 days (Arms/Pump placed by game proximity)
        if (day.source === 'gameProximity' &&
            day.workout &&
            day.workout.name === 'Arms / Pump') {
            // G-2 is the day before G-1 in the result array
            const g2Idx = i - 1;
            if (g2Idx < 0)
                continue;
            const g2Day = result[g2Idx];
            if (!g2Day.workout)
                continue;
            // Shared guard: block replacement of any protected core exposure
            if (!canReplaceSession(g2Day.workout, g2Day.source, 'fatigue-stacking guard G-2→prehab', g2Day.date)) {
                continue;
            }
            // Only downgrade derived/proximity duplicates (e.g. two Arms/Pump
            // from adjacent games) or non-core upper sessions.
            const isArmsPump = g2Day.workout.name === 'Arms / Pump';
            const isDerivedUpper = g2Day.source === 'gameProximity' &&
                (g2Day.workout.name.toLowerCase().includes('arm') ||
                    g2Day.workout.name.toLowerCase().includes('pump'));
            if (isArmsPump || isDerivedUpper) {
                // Downgrade derived G-2 to Prehab & Accessories (low-fatigue, no upper bias)
                result[g2Idx] = buildDay(g2Day.date, g2Day.dayOfWeek, today, (0, sessionBuilder_1.buildDerivedSession)('prehab_accessories', g2Day.date, state.currentMicrocycle?.id || 'derived', 'Pre-game window — avoiding upper-body stacking with G-1', state.athleteContext), 'gameProximity');
            }
        }
    }
    // Pass 2: progressive conditioning placement
    // Apply feedback pattern bias to conditioning readiness (one-step max)
    const conditioningReadiness = (0, feedbackPatterns_1.biasConditioningReadiness)(state.readiness || 'medium', weekPatternSummary);
    const conditioningPlaced = [];
    // ── In-season primary conditioning cap ──
    // For in-season weeks (including bye/freed-game weeks), limit the
    // conditioning pass to ONE primary (A or B-tier) placement.
    // After that primary slot is filled, remaining empty days should fall
    // through to Pass 3 (recovery) rather than stacking back-to-back
    // conditioning sessions on the weekend.
    // Pre-season and off-season allow multiple primary conditioning sessions.
    const inSeasonPrimaryCap = state.seasonPhase === 'In-season' ? 1 : Infinity;
    let primaryConditioningCount = 0;
    // ── Running exposure cap ──
    // Max 4 running-based conditioning sessions per week.
    // When the cap is reached, additional running sessions are converted to
    // off-feet modalities (bike/row/ski) while preserving the conditioning stimulus.
    // This is invisible to the user — same session intent, different modality.
    const MAX_RUNNING_SESSIONS = 4;
    let runningSessionCount = 0;
    // ── Pre-season team-day guard (safety belt) ──
    // In pre-season, team training days are FIELD-LOAD ANCHORS. Even if the
    // AI/engine did not place a workout on a team day (or the team workout was
    // stripped somehow), the conditioning pass must NEVER add a standalone
    // conditioning session on a known team training day. The engine already
    // enforces this upstream; this is a belt-and-braces guard at placement time.
    const DAY_NAME_TO_NUM = {
        Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
        Thursday: 4, Friday: 5, Saturday: 6,
    };
    const preSeasonTeamDayNums = new Set(state.seasonPhase === 'Pre-season'
        ? (state.athleteContext?.onboardingData?.teamTrainingDays || [])
            .map((n) => DAY_NAME_TO_NUM[n])
            .filter((n) => typeof n === 'number')
        : []);
    // Note: sprint-adjacency to team days is already enforced by the coaching
    // engine's H-PRE-3 constraint and scorer. The resolver does not need to
    // re-enforce it here because the AI's weeklyPlan already reflects the
    // engine's category choices.
    for (let i = 0; i < result.length; i++) {
        const day = result[i];
        // Only place conditioning on truly empty days within the active block
        if (day.workout !== null)
            continue;
        if (day.source !== 'none')
            continue;
        if (!blockStart || !blockEnd)
            continue;
        if (day.date < blockStart || day.date > blockEnd)
            continue;
        // HARD CONSTRAINT: never place sessions on unavailable days
        if (!isDayAvailable(day.dayOfWeek))
            continue;
        // PRE-SEASON HARD GUARD: never place standalone conditioning on a team
        // training day. Team training IS the conditioning for that day.
        if (preSeasonTeamDayNums.has(day.dayOfWeek)) {
            console.log(`[PRE-SEASON-GUARD] ${day.date} (dayOfWeek=${day.dayOfWeek}): skipping conditioning — team training day.`);
            continue;
        }
        // In-season: skip if we've already placed the primary conditioning session.
        // Tier C (flush/recovery conditioning) is still allowed beyond the cap.
        if (primaryConditioningCount >= inSeasonPrimaryCap && state.seasonPhase === 'In-season') {
            // Allow only Tier C (recovery-level conditioning) beyond the cap.
            // For simplicity, skip entirely — Pass 3 (recovery) will fill this day
            // with a proper recovery session instead.
            continue;
        }
        // Build WeekLog with accumulated placements (biased readiness)
        const weekLog = (0, weekLogBuilder_1.buildWeekLog)(baseDays, state.markedDays || {}, conditioningReadiness, conditioningPlaced);
        // Try conditioning placement
        const condWorkout = (0, sessionBuilder_1.buildConditioningSession)(day.date, gameDates, state.athleteContext, state.seasonPhase, weekLog, state.currentMicrocycle?.id || 'derived');
        if (condWorkout) {
            // ── Running exposure cap enforcement ──
            // If this is a running-based session and we've hit the cap,
            // swap exercises to off-feet modality (bike/row/ski).
            // The workout name, type, and tier stay the same — only the exercises change.
            //
            // EXCEPTION: Flying Sprints are NEVER converted off-feet.
            // They are top-end speed exposure and must always remain running-based.
            // They still count toward the running total but are exempt from conversion.
            const isRunning = (0, sessionBuilder_1.isRunningBasedConditioning)(condWorkout.name);
            const isFlyingSprints = condWorkout.name === 'Flying Sprints';
            if (isRunning && !isFlyingSprints && runningSessionCount >= MAX_RUNNING_SESSIONS) {
                const offFeet = (0, sessionBuilder_1.switchToOffFeetModality)(condWorkout.name, day.date);
                if (offFeet) {
                    for (const ex of offFeet) {
                        ex.workoutId = condWorkout.id;
                    }
                    condWorkout.exercises = offFeet;
                    console.log(`[RUNNING-CAP] ${day.date}: "${condWorkout.name}" → off-feet modality (running sessions=${runningSessionCount}/${MAX_RUNNING_SESSIONS})`);
                }
            }
            else if (isRunning) {
                runningSessionCount++;
            }
            result[i] = buildDay(day.date, day.dayOfWeek, today, condWorkout, 'conditioning');
            const entry = (0, weekLogBuilder_1.conditioningToWeekLogEntry)(day.date, condWorkout.name);
            conditioningPlaced.push(entry);
            // Count primary (non-C) placements for the in-season cap
            if (entry.tier !== 'C') {
                primaryConditioningCount++;
            }
        }
    }
    // Pass 3: recovery placement on remaining empty days
    // Count existing recovery sessions (including G+1 from game proximity)
    let weekRecoveryCount = 0;
    for (const day of result) {
        if (day.workout?.workoutType === 'Recovery' || day.workout?.sessionTier === 'recovery') {
            weekRecoveryCount++;
        }
    }
    for (let i = 0; i < result.length; i++) {
        const day = result[i];
        // Only place recovery on truly empty days within the active block
        if (day.workout !== null)
            continue;
        if (day.source !== 'none')
            continue;
        if (!blockStart || !blockEnd)
            continue;
        if (day.date < blockStart || day.date > blockEnd)
            continue;
        // HARD CONSTRAINT: never place sessions on unavailable days
        if (!isDayAvailable(day.dayOfWeek))
            continue;
        // Compute game proximity for this date
        const [y, m, d] = day.date.split('-').map(Number);
        const dateMs = new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
        let daysToGame = null;
        let daysSinceGame = null;
        for (const gd of gameDates) {
            const [gy, gm, gdd] = gd.split('-').map(Number);
            const gameMs = new Date(gy, gm - 1, gdd, 12, 0, 0, 0).getTime();
            const diffDays = Math.round((gameMs - dateMs) / (1000 * 60 * 60 * 24));
            if (diffDays > 0 && (daysToGame === null || diffDays < daysToGame)) {
                daysToGame = diffDays;
            }
            if (diffDays < 0 && (daysSinceGame === null || -diffDays < daysSinceGame)) {
                daysSinceGame = -diffDays;
            }
        }
        // Check if high-tier conditioning was placed yesterday (stacking concern)
        const yesterday = addDays(day.date, -1);
        const recentHighTier = conditioningPlaced.some(s => s.dateStr === yesterday && (s.tier === 'A' || s.tier === 'B-high'));
        // Feedback pattern: prefer full rest over additional recovery
        // if athlete has been reporting 'cooked' repeatedly and already has recovery
        if ((0, feedbackPatterns_1.shouldPreferRest)(weekPatternSummary, weekRecoveryCount)) {
            continue; // leave this day empty — full rest
        }
        // Try recovery placement
        const recoveryResult = (0, recoveryRules_1.resolveRecovery)(daysToGame, daysSinceGame, state.seasonPhase, state.readiness || 'medium', weekRecoveryCount, recentHighTier);
        if (recoveryResult) {
            const recoveryWorkout = (0, sessionBuilder_1.buildDerivedSession)(recoveryResult.derivedType, day.date, state.currentMicrocycle?.id || 'derived', `Scheduled recovery — ${recoveryResult.category}`, state.athleteContext);
            result[i] = buildDay(day.date, day.dayOfWeek, today, recoveryWorkout, 'recovery');
            weekRecoveryCount++;
        }
    }
    return result;
}
/**
 * Resolve a single date with conditioning context.
 *
 * Resolves the full week containing this date (for WeekLog context),
 * then returns just the target day. This ensures conditioning placement
 * considers the week's strength load, stacking guard, and weekly caps.
 */
function resolveDateWithConditioning(date, state) {
    const monday = getMondayForDate(date);
    const weekDays = resolveWeekWithConditioning(monday, state);
    return weekDays.find(d => d.date === date) || resolveDate(date, state);
}
/**
 * Resolve month indicators with conditioning awareness.
 *
 * Resolves each week overlapping the month with conditioning placement,
 * then extracts indicators for dates within the month.
 */
function resolveMonthIndicatorsWithConditioning(year, month, state) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result = {};
    const firstDay = toDateString(year, month, 1);
    const lastDay = toDateString(year, month, daysInMonth);
    const firstMonday = getMondayForDate(firstDay);
    // Walk week by week, resolving with conditioning
    let monday = firstMonday;
    for (let safety = 0; safety < 7; safety++) { // max 6 weeks overlap a month
        if (monday > lastDay)
            break;
        const weekDays = resolveWeekWithConditioning(monday, state);
        for (const day of weekDays) {
            if (day.date >= firstDay && day.date <= lastDay) {
                result[day.date] = day.indicator;
            }
        }
        monday = addDays(monday, 7);
    }
    return result;
}
/** Block bounds helper. */
function getBlockBounds(state) {
    const { currentProgram } = state;
    if (!currentProgram) {
        return { startDate: null, endDate: null, nextBlockDate: null };
    }
    const start = currentProgram.startDate.split('T')[0];
    const end = currentProgram.endDate.split('T')[0];
    // Next block is the day after the current block ends
    const nextBlock = addDays(end, 1);
    return {
        startDate: start,
        endDate: end,
        nextBlockDate: nextBlock,
    };
}
// ─── Calendar Seeding ───
/** Map a GameDay name to JS dayOfWeek number (0=Sun..6=Sat). */
const GAME_DAY_MAP = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
};
/**
 * Compute all dates within a block that fall on a given weekday.
 * Used to seed calendarStore with game dates after onboarding.
 *
 * Example: gameDay='Saturday', block 2026-03-15 to 2026-04-05
 *   → ['2026-03-21', '2026-03-28', '2026-04-04']
 *
 * Returns empty array for 'Varies' (user must set manually).
 */
function computeGameDatesForBlock(gameDay, blockStartDate, blockEndDate) {
    const targetDow = GAME_DAY_MAP[gameDay];
    if (targetDow === undefined)
        return []; // 'Varies' or unknown
    const dates = [];
    const start = blockStartDate.split('T')[0];
    const end = blockEndDate.split('T')[0];
    // Walk from start to end, collecting dates that match the target weekday
    let current = start;
    for (let i = 0; i < 366; i++) { // safety cap
        if (current > end)
            break;
        const [y, m, d] = current.split('-').map(Number);
        const dow = new Date(y, m - 1, d, 12, 0, 0, 0).getDay();
        if (dow === targetDow) {
            dates.push(current);
        }
        current = addDays(current, 1);
    }
    return dates;
}
/** Format a week label like "6 – 12 Apr" from a Monday date string. */
function formatWeekLabel(mondayStr) {
    const sunDate = addDays(mondayStr, 6);
    const [, mm, md] = mondayStr.split('-').map(Number);
    const [, sm, sd] = sunDate.split('-').map(Number);
    const mMon = MONTH_SHORT[mm - 1];
    const sMon = MONTH_SHORT[sm - 1];
    return mMon === sMon
        ? `${md} – ${sd} ${sMon}`
        : `${md} ${mMon} – ${sd} ${sMon}`;
}
