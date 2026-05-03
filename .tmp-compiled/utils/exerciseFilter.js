"use strict";
/**
 * Exercise Filter — Hard filters and injury filters for tag-based selection.
 *
 * Pure functions. No React. No Zustand. No AI.
 *
 * These are NON-NEGOTIABLE exclusions. If an exercise fails a hard filter,
 * it is removed from the candidate pool entirely — no scoring can override it.
 *
 * Two stages:
 *   1. Hard filters — game proximity, late-week, plyos
 *   2. Injury filters — per-area exclusions based on injury tags
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normaliseInjuryArea = normaliseInjuryArea;
exports.applyHardFilters = applyHardFilters;
exports.buildFilterContext = buildFilterContext;
const exerciseTags_1 = require("../data/exerciseTags");
const INJURY_AREA_MAP = {
    'adductor': 'adductor',
    'adductors': 'adductor',
    'groin': 'adductor',
    'pubalgia': 'pubalgia',
    'lower back': 'lowerBack',
    'lower_back': 'lowerBack',
    'back': 'lowerBack',
    'knee': 'knee',
    'knees': 'knee',
    'hamstring': 'hamstring',
    'hamstrings': 'hamstring',
    'calf': 'calf',
    'calves': 'calf',
    'ankle': 'ankle',
    'ankles': 'ankle',
    'achilles': 'ankle',
    'shoulder': 'shoulder',
    'shoulders': 'shoulder',
    'elbow': 'elbow',
    'elbows': 'elbow',
    'wrist': 'wrist',
    'wrists': 'wrist',
};
/** Normalise an injury body area string to our InjuryArea key. */
function normaliseInjuryArea(area) {
    return INJURY_AREA_MAP[area.toLowerCase().trim()] || null;
}
// ─── Hard Filters ───
/**
 * Apply all hard filters to the full exercise catalog.
 * Returns the names of exercises that PASS all filters.
 */
function applyHardFilters(exerciseNames, ctx) {
    return exerciseNames.filter(name => {
        const tags = exerciseTags_1.EXERCISE_TAGS[name];
        if (!tags)
            return false; // untagged exercises are excluded
        // ── Game Proximity Filters ──
        // G-1 (day before game): only upper body + low fatigue + low DOMS
        if (ctx.daysToGame === 1) {
            if (tags.region === 'lower')
                return false;
            if (tags.fatigue === 'high')
                return false;
            if (tags.doms === 'high')
                return false;
            // Allow: upper + low/moderate fatigue + low/moderate DOMS
        }
        // Within 72h of game (daysToGame 1,2,3 or daysSinceGame 1):
        // No high-load lower body
        if (isWithin72hOfGame(ctx)) {
            if (tags.region === 'lower' && tags.load === 'high')
                return false;
        }
        // G+1 (day after game): only recovery-level work
        if (ctx.daysSinceGame === 1) {
            if (tags.fatigue === 'high')
                return false;
            if (tags.region === 'lower' && tags.load !== 'low')
                return false;
        }
        // ── Late-week DOMS filter ──
        // No high-DOMS lower body work on Thursday/Friday (days 4,5) when game is Saturday
        if (isLateWeek(ctx)) {
            if (tags.region === 'lower' && tags.doms === 'high')
                return false;
        }
        // ── Plyo filters ──
        if (tags.movement === 'plyo') {
            // Remove all plyos late week
            if (isLateWeek(ctx))
                return false;
            // Will be deprioritised (not excluded) in-season via scoring
        }
        // ── Conditioning ──
        // Basic hard filter: no conditioning within 48h of game.
        // Fine-grained tier logic (stacking guard, strength interaction,
        // weekly caps) lives in conditioningRules.ts and is applied
        // separately by the session builder.
        if (tags.movement === 'conditioning') {
            if (ctx.daysToGame !== null && ctx.daysToGame <= 2)
                return false;
        }
        // ── Late-week "avoid" exercises ──
        if (isLateWeek(ctx) && tags.lateWeek === 'avoid')
            return false;
        // ── Injury filters ──
        if (!passesInjuryFilter(tags, ctx.activeInjuries))
            return false;
        return true;
    });
}
// ─── Injury Filter Logic ───
/**
 * Check if an exercise passes injury constraints.
 *
 * Logic per injury area:
 *   - 'avoid' severity: exclude exercises rated 'avoid' for that area.
 *     Also exclude high-eccentric exercises for hamstring injuries.
 *   - 'caution' severity: exclude exercises rated 'avoid' for that area.
 *     Exercises rated 'caution' are kept but will be penalised in scoring.
 */
function passesInjuryFilter(tags, injuries) {
    for (const [rawArea, severity] of Object.entries(injuries)) {
        const area = normaliseInjuryArea(rawArea);
        if (!area)
            continue;
        const rating = tags.injury[area];
        if (severity === 'avoid') {
            // Hard exclude: exercise rated 'avoid' for this area
            if (rating === 'avoid')
                return false;
            // Hamstring-specific: also exclude high eccentric + high DOMS
            if (area === 'hamstring') {
                if (tags.eccentric === 'high' && tags.region === 'lower')
                    return false;
                if (tags.doms === 'high' && tags.movement === 'hinge')
                    return false;
            }
            // Adductor-specific: exclude lunges and lateral plyos
            if (area === 'adductor') {
                if (tags.movement === 'lunge')
                    return false;
                if (tags.movement === 'plyo' && tags.unilateral)
                    return false;
            }
            // Lower back: exclude high-load bilateral + low stability
            if (area === 'lowerBack') {
                if (tags.load === 'high' && !tags.unilateral)
                    return false;
                if (tags.stability === 'low' && tags.region === 'lower')
                    return false;
            }
            // Knee: hard exclude if rated avoid
            // Caution-rated knee exercises kept but deprioritised in scoring
            // Calf/ankle: remove plyos
            if (area === 'calf' || area === 'ankle') {
                if (tags.movement === 'plyo')
                    return false;
            }
        }
        if (severity === 'caution') {
            // Only exclude exercises rated 'avoid' for this area
            if (rating === 'avoid')
                return false;
        }
    }
    return true;
}
// ─── Helper Functions ───
/** Is this date within 72 hours of a game? */
function isWithin72hOfGame(ctx) {
    if (ctx.daysToGame !== null && ctx.daysToGame <= 3)
        return true;
    if (ctx.daysSinceGame !== null && ctx.daysSinceGame <= 1)
        return true;
    return false;
}
/** Is this a late-week training day (Thursday or Friday)? */
function isLateWeek(ctx) {
    // Thursday=4, Friday=5
    return ctx.dayOfWeek === 4 || ctx.dayOfWeek === 5;
}
/** Build a FilterContext from the resolver's available data. */
function buildFilterContext(dateStr, gameDates, injuries, inSeason) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0, 0);
    const dayOfWeek = date.getDay();
    // Calculate days to next game
    let daysToGame = null;
    let daysSinceGame = null;
    for (const gd of gameDates) {
        const [gy, gm, gdd] = gd.split('-').map(Number);
        const gameDate = new Date(gy, gm - 1, gdd, 12, 0, 0, 0);
        const diffMs = gameDate.getTime() - date.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > 0 && (daysToGame === null || diffDays < daysToGame)) {
            daysToGame = diffDays;
        }
        if (diffDays < 0 && (daysSinceGame === null || -diffDays < daysSinceGame)) {
            daysSinceGame = -diffDays;
        }
    }
    // Build active injuries map
    const activeInjuries = {};
    for (const inj of injuries) {
        const sev = (inj.severity?.toLowerCase() === 'mild') ? 'caution' : 'avoid';
        activeInjuries[inj.bodyArea] = sev;
    }
    return { daysToGame, daysSinceGame, dayOfWeek, inSeason, activeInjuries };
}
