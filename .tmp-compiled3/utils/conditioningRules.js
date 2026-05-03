"use strict";
/**
 * Conditioning Rules — Tier selection, placement, and weekly load management.
 *
 * Pure functions. No React. No Zustand. No AI.
 *
 * Implements the Final Conditioning Rule Design:
 *   - Tier A: field-based sprinting only (Sprint Intervals, Hill Sprints,
 *     Quality Sprints, MAS Training, Flog Friday)
 *   - Tier B-high: high output (MetCon, Long Run, 6x1km, Hard Row/Ski/Bike)
 *   - Tier B-low: moderate output (Tempo Run, Bike Sprints, Row/Ski/Bike Intervals)
 *   - Tier C: recovery/flush (Flush Run, Easy Bike/Row/Ski/Swim, Light Circuits)
 *
 * Hard rules:
 *   - 48h game buffer (all tiers blocked)
 *   - No Tier A in-season (except fresh bye week)
 *   - G+1 = Tier C only
 *   - Stacking guard (tier-based, not just fatigue)
 *   - Strength interaction
 *   - Non-forcing (return null if nothing fits)
 *
 * Injury integration:
 *   - Tier A blocked for any lower-limb caution+
 *   - Running-based conditioning blocked when injury requires it
 *   - Low-impact modalities (bike, row, ski, swim) allowed as alternatives
 *
 * Lives alongside exerciseFilter.ts and exerciseScorer.ts in the
 * filter → score → select pipeline.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveConditioning = resolveConditioning;
exports.getWeeklyConditioningSummary = getWeeklyConditioningSummary;
exports.getAllowedTiersForDate = getAllowedTiersForDate;
exports.getEligibleTiers = getEligibleTiers;
exports.getStackingBlockedTiers = getStackingBlockedTiers;
exports.getStrengthBlockedTiers = getStrengthBlockedTiers;
exports.getWeeklyCaps = getWeeklyCaps;
exports.filterConditioningByInjury = filterConditioningByInjury;
exports.hasLowerLimbInjury = hasLowerLimbInjury;
exports.hasRunningInjury = hasRunningInjury;
exports.countByTier = countByTier;
exports.inferFresh = inferFresh;
const exerciseTags_1 = require("../data/exerciseTags");
// ─── Bye Week Freshness ───
/**
 * Infer whether athlete is "fresh" for bye week logic.
 * Fresh = no active injury at 'avoid' AND readiness medium or high.
 */
function inferFresh(activeInjuries, readiness) {
    if (readiness === 'low')
        return false;
    for (const sev of Object.values(activeInjuries)) {
        if (sev === 'avoid')
            return false;
    }
    return true;
}
function getWeeklyCaps(phase, weekLog, activeInjuries) {
    // ── Double game week ──
    // Tier A and B blocked entirely. Tier C allowed on each G+1.
    // IMPORTANT: On double game weeks, the second G+1 should default to
    // null (full rest) in the recovery resolver. The system should NOT
    // attempt to auto-fill the second G+1 slot — rest is the correct
    // outcome when the athlete has played two games in one week.
    if (weekLog.doubleGameWeek) {
        return { maxTierA: 0, maxTierB: 0, maxTierC: 99, maxTotal: 99, bLowOnly: false };
    }
    // ── Return from extended break ──
    if (weekLog.weeksOffTraining >= 2) {
        // Week 1 back: Tier C only
        return { maxTierA: 0, maxTierB: 0, maxTierC: 99, maxTotal: 99, bLowOnly: false };
    }
    if (weekLog.weeksOffTraining === 1) {
        // Week 2 back: add Tier B
        return { maxTierA: 0, maxTierB: 2, maxTierC: 99, maxTotal: 4, bLowOnly: false };
    }
    switch (phase) {
        case 'In-season': {
            if (weekLog.byeWeek) {
                const fresh = inferFresh(activeInjuries, weekLog.readiness);
                if (fresh) {
                    // Bye week fresh: unlock Tier A
                    return { maxTierA: 1, maxTierB: 2, maxTierC: 99, maxTotal: 99, bLowOnly: false };
                }
                // Bye week fatigued/injured: B-low only, C prioritised
                return { maxTierA: 0, maxTierB: 1, maxTierC: 99, maxTotal: 99, bLowOnly: true };
            }
            if (weekLog.missedTeamTraining) {
                // Missed team training: unlock extra B session
                return { maxTierA: 0, maxTierB: 2, maxTierC: 99, maxTotal: 99, bLowOnly: false };
            }
            // Normal in-season: 0 A, 1 B, unlimited C
            return { maxTierA: 0, maxTierB: 1, maxTierC: 99, maxTotal: 99, bLowOnly: false };
        }
        case 'Pre-season':
            // 1A + 2B, up to 5 total (including team training)
            return { maxTierA: 1, maxTierB: 2, maxTierC: 99, maxTotal: 5, bLowOnly: false };
        case 'Off-season':
            // 2A + 2B, cap at 5 if 1-2 are Tier C else 4
            return { maxTierA: 2, maxTierB: 2, maxTierC: 99, maxTotal: 5, bLowOnly: false };
        default:
            return { maxTierA: 0, maxTierB: 1, maxTierC: 99, maxTotal: 99, bLowOnly: false };
    }
}
// ─── Tier Counting ───
function countByTier(weekLog) {
    const counts = { 'A': 0, 'B-high': 0, 'B-low': 0, 'C': 0 };
    for (const s of weekLog.sessions) {
        counts[s.tier]++;
    }
    return counts;
}
// ─── Lower-Limb Injury Detection ───
const LOWER_LIMB_AREAS = [
    'hamstring', 'hamstrings', 'calf', 'calves', 'ankle', 'ankles',
    'achilles', 'knee', 'knees', 'adductor', 'adductors', 'groin',
    'shin', 'shins', 'pubalgia',
];
function hasLowerLimbInjury(injuries) {
    for (const area of Object.keys(injuries)) {
        if (LOWER_LIMB_AREAS.includes(area.toLowerCase().trim()))
            return true;
    }
    return false;
}
// ─── Stacking Guard ───
/**
 * Tier-based stacking guard.
 * No two conditioning sessions with fatigue >= moderate within 24h.
 *
 * Matrix (from spec):
 *   Today A     → next day: A blocked, B-high blocked, B-low OK, C OK
 *   Today B-high→ next day: A blocked, B-high blocked, B-low OK, C OK
 *   Today B-low → next day: all OK
 *   Today C     → next day: all OK
 *
 * Returns the set of tiers BLOCKED by the stacking guard.
 */
function getStackingBlockedTiers(dateStr, weekLog) {
    const blocked = new Set();
    const target = new Date(dateStr + 'T12:00:00');
    for (const s of weekLog.sessions) {
        // B-low and C don't block anything
        if (s.tier === 'B-low' || s.tier === 'C')
            continue;
        const existing = new Date(s.dateStr + 'T12:00:00');
        const diffHours = Math.abs(target.getTime() - existing.getTime()) / (1000 * 60 * 60);
        if (diffHours <= 24) {
            // A or B-high within 24h blocks A and B-high
            blocked.add('A');
            blocked.add('B-high');
        }
    }
    return blocked;
}
// ─── Strength Interaction ───
/**
 * High-fatigue strength day → blocks Tier A + B-high, allows B-low + C.
 * Moderate-fatigue strength day → blocks Tier A, allows B-high + B-low + C.
 * Low-fatigue / no strength → all allowed.
 */
function getStrengthBlockedTiers(dateStr, weekLog) {
    const blocked = new Set();
    for (const s of weekLog.strengthSessions) {
        if (s.dateStr !== dateStr)
            continue;
        if (s.fatigue === 'high') {
            blocked.add('A');
            blocked.add('B-high');
        }
        else if (s.fatigue === 'moderate') {
            blocked.add('A');
        }
    }
    return blocked;
}
// ─── Hard Placement Rules ───
/**
 * Get the set of tiers allowed on this specific date.
 * Applies game proximity, late-week, and G+1 rules.
 */
function getAllowedTiersForDate(ctx) {
    const allowed = new Set(['A', 'B-high', 'B-low', 'C']);
    // Within 48h of game: block everything
    if (ctx.daysToGame !== null && ctx.daysToGame <= 2) {
        allowed.clear();
        return allowed;
    }
    // G+1 (day after game): only Tier C (recovery/flush)
    if (ctx.daysSinceGame === 1) {
        allowed.delete('A');
        allowed.delete('B-high');
        allowed.delete('B-low');
        return allowed;
    }
    // G+2: block Tier A, allow B and C
    if (ctx.daysSinceGame === 2) {
        allowed.delete('A');
        return allowed;
    }
    // Late week (Thu/Fri, days 4/5):
    // In-season: Tier A blocked, Tier B allowed if passes other rules
    // Offseason: Tier A allowed, still respect stacking guard
    if (ctx.dayOfWeek === 4 || ctx.dayOfWeek === 5) {
        if (ctx.seasonPhase === 'In-season' || ctx.seasonPhase === 'Pre-season') {
            allowed.delete('A');
            // B-high blocked if game within 3 days
            if (ctx.daysToGame !== null && ctx.daysToGame <= 3) {
                allowed.delete('B-high');
            }
        }
    }
    return allowed;
}
// ─── Tier Eligibility (Weekly Caps + Season Rules) ───
function getEligibleTiers(ctx, weekLog, dateTiers) {
    const caps = getWeeklyCaps(ctx.seasonPhase, weekLog, ctx.activeInjuries);
    const counts = countByTier(weekLog);
    const totalBCount = counts['B-high'] + counts['B-low'];
    // Preseason: team training counts toward total exposure
    const totalCount = ctx.seasonPhase === 'Pre-season'
        ? weekLog.sessions.length + weekLog.teamTrainingSessions
        : weekLog.sessions.length;
    const eligible = [];
    // Tier A
    if (dateTiers.has('A') && counts['A'] < caps.maxTierA) {
        // In-season (non-bye): always blocked
        if (ctx.seasonPhase === 'In-season' && !weekLog.byeWeek) {
            // blocked
        }
        else {
            eligible.push('A');
        }
    }
    // Tier B-high
    if (dateTiers.has('B-high') && totalBCount < caps.maxTierB) {
        if (!caps.bLowOnly) {
            eligible.push('B-high');
        }
    }
    // Tier B-low
    if (dateTiers.has('B-low') && totalBCount < caps.maxTierB) {
        eligible.push('B-low');
    }
    // Tier C (effectively unlimited within reason)
    if (dateTiers.has('C')) {
        eligible.push('C');
    }
    // Offseason total cap logic: cap at 5 if 1-2 are Tier C, else 4
    if (ctx.seasonPhase === 'Off-season') {
        const cCount = counts['C'];
        const nonCCount = weekLog.sessions.length - cCount;
        const effectiveMax = cCount >= 1 ? 5 : 4;
        if (totalCount >= effectiveMax) {
            // Only Tier C allowed beyond the effective cap
            return eligible.filter(t => t === 'C');
        }
    }
    // Check total cap for other phases
    if (totalCount >= caps.maxTotal) {
        return eligible.filter(t => t === 'C');
    }
    return eligible;
}
// ─── Injury Filtering for Conditioning ───
/** Normalise body area to canonical key. */
function normaliseArea(area) {
    const a = area.toLowerCase().trim();
    const map = {
        'hamstrings': 'hamstring', 'calves': 'calf', 'ankles': 'ankle',
        'achilles': 'ankle', 'knees': 'knee', 'adductors': 'adductor',
        'groin': 'adductor', 'shins': 'ankle',
        'shoulders': 'shoulder', 'elbows': 'elbow', 'wrists': 'wrist',
    };
    return map[a] || a;
}
/**
 * Modality-aware injury filtering.
 *
 * Key principle: low-impact modalities (bike, row, ski, swim) are allowed
 * when running is restricted. Running-based conditioning is blocked when
 * injury requires it.
 *
 * Per-area rules from spec:
 *
 * Hamstring avoid:  Tier A blocked. B blocked if running. bike/row OK. C OK.
 * Hamstring caution: Tier A blocked. B allowed, deprioritise running. C OK.
 * Calf avoid:       Tier A blocked. B blocked if running. C OK.
 * Calf caution:     Tier A blocked. B allowed reduced volume. C OK.
 * Ankle avoid:      Tier A blocked. B blocked if running. C OK bike only.
 * Ankle caution:    Tier A blocked. B allowed. C OK.
 * Adductor avoid:   Tier A blocked. B blocked if lateral/CoD. C OK.
 * Adductor caution: Tier A blocked. B allowed, no lateral. C OK.
 * Pubalgia avoid:   Tier A blocked. B blocked if running. C OK bike/upper.
 * Pubalgia caution: Tier A blocked. B allowed low intensity. C OK.
 */
function filterConditioningByInjury(candidates, injuries) {
    if (Object.keys(injuries).length === 0)
        return candidates;
    const hasLowerLimb = hasLowerLimbInjury(injuries);
    // Build a set of normalised injury areas with severities
    const normInjuries = {};
    for (const [area, sev] of Object.entries(injuries)) {
        const norm = normaliseArea(area);
        // Keep the worst severity
        if (!normInjuries[norm] || sev === 'avoid') {
            normInjuries[norm] = sev;
        }
    }
    return candidates.filter(name => {
        const meta = exerciseTags_1.CONDITIONING_META[name];
        if (!meta)
            return false;
        // Tier A: blocked for ANY lower-limb injury at caution+
        if (meta.tier === 'A' && hasLowerLimb)
            return false;
        // Mixed-modality sessions (Flog Friday, MetCon) include running,
        // so treat them the same as 'run' for injury routing purposes.
        const isRunning = meta.modality === 'run' || meta.modality === 'mixed';
        const isLowImpact = meta.impact === 'low';
        // ── Hamstring ──
        if (normInjuries['hamstring'] === 'avoid') {
            if (meta.tier === 'A')
                return false;
            if ((meta.tier === 'B-high' || meta.tier === 'B-low') && isRunning)
                return false;
            // bike/row/ski/swim OK for B, C always OK
        }
        if (normInjuries['hamstring'] === 'caution') {
            if (meta.tier === 'A')
                return false;
            // B allowed — running deprioritised (handled in selection, not filtering)
        }
        // ── Calf ──
        if (normInjuries['calf'] === 'avoid') {
            if (meta.tier === 'A')
                return false;
            if ((meta.tier === 'B-high' || meta.tier === 'B-low') && isRunning)
                return false;
        }
        if (normInjuries['calf'] === 'caution') {
            if (meta.tier === 'A')
                return false;
            // B allowed at reduced volume (prescription concern, not filter)
        }
        // ── Ankle ──
        if (normInjuries['ankle'] === 'avoid') {
            if (meta.tier === 'A')
                return false;
            if ((meta.tier === 'B-high' || meta.tier === 'B-low') && isRunning)
                return false;
            // Tier C: only bike allowed
            if (meta.tier === 'C' && isRunning)
                return false;
            if (meta.tier === 'C' && meta.modality === 'swim')
                return false; // kick pressure
        }
        if (normInjuries['ankle'] === 'caution') {
            if (meta.tier === 'A')
                return false;
            // B and C allowed
        }
        // ── Adductor ──
        if (normInjuries['adductor'] === 'avoid') {
            if (meta.tier === 'A')
                return false;
            // B blocked if running (lateral/CoD risk from field running)
            if ((meta.tier === 'B-high' || meta.tier === 'B-low') && isRunning)
                return false;
        }
        if (normInjuries['adductor'] === 'caution') {
            if (meta.tier === 'A')
                return false;
            // B allowed, no lateral work (running is linear so OK)
        }
        // ── Pubalgia ──
        if (normInjuries['pubalgia'] === 'avoid') {
            if (meta.tier === 'A')
                return false;
            if ((meta.tier === 'B-high' || meta.tier === 'B-low') && isRunning)
                return false;
            // C: bike/upper only
            if (meta.tier === 'C' && isRunning)
                return false;
        }
        if (normInjuries['pubalgia'] === 'caution') {
            if (meta.tier === 'A')
                return false;
            // B allowed at low intensity (prescription concern, not filter)
        }
        // ── Knee ──
        if (normInjuries['knee'] === 'avoid') {
            if (meta.tier === 'A')
                return false;
            // Check exercise-level injury tag
            const tags = exerciseTags_1.EXERCISE_TAGS[name];
            if (tags && tags.injury.knee === 'avoid')
                return false;
        }
        if (normInjuries['knee'] === 'caution') {
            if (meta.tier === 'A')
                return false;
            const tags = exerciseTags_1.EXERCISE_TAGS[name];
            if (tags && tags.injury.knee === 'avoid')
                return false;
        }
        // ── Also check exercise-level injury tags for non-lower-limb areas ──
        const tags = exerciseTags_1.EXERCISE_TAGS[name];
        if (tags) {
            for (const [normArea, sev] of Object.entries(normInjuries)) {
                const areaKey = mapToInjuryKey(normArea);
                if (!areaKey)
                    continue;
                const rating = tags.injury[areaKey];
                if (sev === 'avoid' && rating === 'avoid')
                    return false;
                if (sev === 'caution' && rating === 'avoid')
                    return false;
            }
        }
        return true;
    });
}
/** Map normalised body area to InjuryProfile key. */
function mapToInjuryKey(area) {
    const map = {
        'adductor': 'adductor', 'pubalgia': 'pubalgia',
        'lowerback': 'lowerBack', 'lower back': 'lowerBack', 'lower_back': 'lowerBack', 'back': 'lowerBack',
        'knee': 'knee', 'hamstring': 'hamstring', 'calf': 'calf', 'ankle': 'ankle',
        'shoulder': 'shoulder', 'elbow': 'elbow', 'wrist': 'wrist',
    };
    return map[area] || null;
}
// ─── Main API ───
/**
 * Resolve which conditioning session (if any) should be placed on a given date.
 *
 * Non-forcing: returns null if no valid conditioning placement exists.
 * Conditioning is additive, not required.
 *
 * @param ctx      - Date and game context
 * @param weekLog  - What's already been scheduled this week
 * @returns        - A ConditioningResult or null
 */
function resolveConditioning(ctx, weekLog) {
    // Step 1: Date-level tier filtering
    const dateTiers = getAllowedTiersForDate(ctx);
    if (dateTiers.size === 0)
        return null;
    // Step 2: Stacking guard — tier-based blocking
    const stackingBlocked = getStackingBlockedTiers(ctx.dateStr, weekLog);
    for (const t of stackingBlocked) {
        dateTiers.delete(t);
    }
    if (dateTiers.size === 0)
        return null;
    // Step 3: Strength interaction
    const strengthBlocked = getStrengthBlockedTiers(ctx.dateStr, weekLog);
    for (const t of strengthBlocked) {
        dateTiers.delete(t);
    }
    if (dateTiers.size === 0)
        return null;
    // Step 4: Weekly caps + season rules
    const eligibleTiers = getEligibleTiers(ctx, weekLog, dateTiers);
    if (eligibleTiers.length === 0)
        return null;
    // Step 5: Get all conditioning exercises for eligible tiers
    const allConditioning = Object.keys(exerciseTags_1.CONDITIONING_META);
    const tierFiltered = allConditioning.filter(name => {
        const meta = exerciseTags_1.CONDITIONING_META[name];
        return meta && eligibleTiers.includes(meta.tier);
    });
    if (tierFiltered.length === 0)
        return null;
    // Step 5b: Day-name filtering — exclude sessions named for a specific day
    // when placed on a different day (e.g. "Flog Friday" only on Fridays).
    const dayNameFiltered = tierFiltered.filter(name => {
        if (name === 'Flog Friday' && ctx.dayOfWeek !== 5)
            return false;
        return true;
    });
    if (dayNameFiltered.length === 0)
        return null;
    // Step 6: Injury filtering (modality-aware)
    const injuryFiltered = filterConditioningByInjury(dayNameFiltered, ctx.activeInjuries);
    if (injuryFiltered.length === 0)
        return null;
    // Step 7: Select — prefer highest eligible tier, then deterministic within tier
    // Priority: A > B-high > B-low > C
    const tierPriority = ['A', 'B-high', 'B-low', 'C'];
    for (const tier of tierPriority) {
        const tierCandidates = injuryFiltered.filter(name => exerciseTags_1.CONDITIONING_META[name]?.tier === tier);
        if (tierCandidates.length > 0) {
            // Prefer low-impact alternatives when running injuries exist
            const preferLowImpact = hasRunningInjury(ctx.activeInjuries);
            let selected;
            if (preferLowImpact && tier !== 'A') {
                // Prefer low-impact candidates within this tier
                const lowImpact = tierCandidates.filter(n => exerciseTags_1.CONDITIONING_META[n]?.impact === 'low');
                const pool = lowImpact.length > 0 ? lowImpact : tierCandidates;
                const seed = dateHash(ctx.dateStr);
                selected = pool[seed % pool.length];
            }
            else {
                const seed = dateHash(ctx.dateStr);
                selected = tierCandidates[seed % tierCandidates.length];
            }
            const meta = exerciseTags_1.CONDITIONING_META[selected];
            return { exerciseName: selected, tier: meta.tier, meta };
        }
    }
    return null;
}
/** Check if any running-restricting injury is active. */
function hasRunningInjury(injuries) {
    const runRestricting = ['hamstring', 'hamstrings', 'calf', 'calves', 'ankle', 'ankles', 'achilles', 'pubalgia'];
    for (const area of Object.keys(injuries)) {
        if (runRestricting.includes(area.toLowerCase().trim()))
            return true;
    }
    return false;
}
/**
 * Get a summary of the week's conditioning load.
 * Useful for UI display and debugging.
 */
function getWeeklyConditioningSummary(weekLog) {
    const counts = countByTier(weekLog);
    const highFatigueDays = weekLog.sessions
        .filter(s => s.fatigue === 'high')
        .map(s => s.dateStr);
    return {
        totalSessions: weekLog.sessions.length,
        tierCounts: counts,
        highFatigueDays,
    };
}
// ─── Date Hash (deterministic variety) ───
function dateHash(dateStr) {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}
