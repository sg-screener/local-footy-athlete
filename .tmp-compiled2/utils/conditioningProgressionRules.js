"use strict";
/**
 * Conditioning Progression Rules — State resolution and adjustment mechanics.
 *
 * Pure functions. No React. No Zustand. No side effects.
 *
 * Lighter than strength progression — 4 states (no overreach/return).
 * Respects existing conditioning tier system. NEVER affects placement
 * logic, caps, or resolver behavior. Lives in the builder layer.
 *
 * Called inside buildConditioningSession() AFTER tier and exercise selection,
 * BEFORE final parameter prescription. Returns adjustments to duration,
 * reps, intervals, rest — does NOT change tier or placement.
 *
 * Architecture:
 *   resolveConditioningProgression(input) → ConditioningProgressionOutput
 *   Builder applies adjustment.repsDelta, intervalsDelta, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveConditioningProgression = resolveConditioningProgression;
const TIER_CAPS = {
    'A': { maxReps: 8, maxIntervals: 8, maxDuration: 40, minRest: 90 },
    'B-high': { maxReps: 12, maxIntervals: 8, maxDuration: 40, minRest: 30 },
    'B-low': { maxReps: 12, maxIntervals: 6, maxDuration: 40, minRest: 30 },
    'C': { maxReps: 0, maxIntervals: 0, maxDuration: 0, minRest: 999 },
};
// ─── Zero Adjustment ───
const ZERO_ADJUSTMENT = {
    repsDelta: 0,
    intervalsDelta: 0,
    durationDelta: 0,
    restDelta: 0,
    intensityDelta: 'none',
};
// ─── Main API ───
/**
 * Resolve conditioning progression state and adjustments.
 *
 * 5-step priority chain + 3 guards. Only adjusts parameters
 * within an already-placed session. Never changes placement.
 */
function resolveConditioningProgression(input) {
    // Tier C: always maintain, no progression ever
    if (input.tier === 'C') {
        return {
            state: 'maintain',
            adjustment: { ...ZERO_ADJUSTMENT },
            note: 'Tier C — recovery conditioning, no progression',
        };
    }
    // ── Step 1: Hard deload triggers (any ONE fires) ──
    if (input.doubleGameWeek) {
        return buildConditioningDeload(input, 'Double game week — conditioning deload');
    }
    if (input.hasAvoidInjury) {
        return {
            state: 'deload',
            adjustment: { ...ZERO_ADJUSTMENT },
            note: 'Session skipped — injury avoidance',
        };
    }
    // ── Step 2: Soft deload triggers (require 2+) ──
    let softCount = 0;
    if (input.readiness === 'low')
        softCount++;
    if (input.recentRPE >= 8)
        softCount++;
    if (input.completionQuality === 'failed')
        softCount++;
    if (softCount >= 2) {
        const signals = [];
        if (input.readiness === 'low')
            signals.push('low readiness');
        if (input.recentRPE >= 8)
            signals.push('high RPE');
        if (input.completionQuality === 'failed')
            signals.push('failed completion');
        return buildConditioningDeload(input, `Soft deload: ${signals.join(' + ')}`);
    }
    // ── Step 3: Game proximity hold ──
    if (input.daysToGame !== null && input.daysToGame <= 2) {
        return {
            state: 'hold',
            adjustment: { ...ZERO_ADJUSTMENT },
            note: 'Game proximity — conditioning hold',
        };
    }
    // ── Step 4: Season phase default ──
    let state;
    let note;
    if (input.seasonPhase === 'In-season') {
        state = 'maintain';
        note = 'In-season default — maintain';
    }
    else if (input.seasonPhase === 'Pre-season') {
        // Pre-season early → build, late → maintain
        // Approximation: if daysToGame is known and close, it's late pre-season
        // Otherwise default to build
        state = 'build';
        note = 'Pre-season — build';
    }
    else {
        // Off-season
        state = 'build';
        note = 'Off-season — build';
    }
    // ── Step 5: Tier constraint (can only downgrade) ──
    if (input.tier === 'A' && input.seasonPhase === 'In-season') {
        if (state === 'build') {
            state = 'maintain';
            note = 'Tier A in-season — capped at maintain';
        }
    }
    if (input.tier === 'B-high' && input.seasonPhase === 'In-season') {
        if (state === 'build') {
            state = 'maintain';
            note = 'Tier B-high in-season — capped at maintain';
        }
    }
    // Tier B-low: build allowed in all phases (no cap)
    // ── Guard A: High fatigue strength week ──
    if (input.highFatigueStrengthThisWeek && state === 'build') {
        state = 'maintain';
        note = 'High-fatigue strength this week — conditioning progression paused';
    }
    // ── Guard B: No consecutive progression ──
    if (input.lastSessionProgressed && state === 'build') {
        state = 'maintain';
        note = 'Previous session progressed — earn next progression';
    }
    // ── Guard C: Weekly load spike ──
    if (state === 'build' &&
        input.weeklyLoad > input.previousWeekLoad &&
        input.previousWeekLoad > 0) {
        const increase = (input.weeklyLoad - input.previousWeekLoad) / input.previousWeekLoad;
        if (increase > 0.35) {
            state = 'maintain';
            note = 'Conditioning load spike detected — progression paused this week';
        }
    }
    // ── Build output ──
    if (state === 'build') {
        return buildConditioningBuild(input, note);
    }
    if (state === 'maintain') {
        return {
            state: 'maintain',
            adjustment: { ...ZERO_ADJUSTMENT },
            note,
        };
    }
    return {
        state: 'hold',
        adjustment: { ...ZERO_ADJUSTMENT },
        note,
    };
}
// ─── Build Mechanics by Tier ───
function buildConditioningBuild(input, note) {
    const caps = TIER_CAPS[input.tier];
    const adjustment = { ...ZERO_ADJUSTMENT };
    // One variable per session — pick the stalest one that hasn't hit cap.
    // Priority order varies by tier.
    if (input.tier === 'A') {
        // Tier A: progress reps → distance (approx via rest reduction)
        // Never increase all at once
        if (input.currentReps < caps.maxReps) {
            adjustment.repsDelta = 1;
            return { state: 'build', adjustment, note: note + ' — +1 rep' };
        }
        if (input.currentRest > caps.minRest) {
            adjustment.restDelta = -5;
            return { state: 'build', adjustment, note: note + ' — rest reduced 5s' };
        }
        // All at cap
        return { state: 'maintain', adjustment: { ...ZERO_ADJUSTMENT }, note: note + ' — all variables at cap' };
    }
    if (input.tier === 'B-high') {
        // Tier B-high: intervals → rest reduction (density)
        if (input.currentIntervals < caps.maxIntervals) {
            adjustment.intervalsDelta = 1;
            return { state: 'build', adjustment, note: note + ' — +1 interval' };
        }
        if (input.currentRest > caps.minRest) {
            adjustment.restDelta = -10;
            return { state: 'build', adjustment, note: note + ' — rest reduced 10s' };
        }
        return { state: 'maintain', adjustment: { ...ZERO_ADJUSTMENT }, note: note + ' — all variables at cap' };
    }
    if (input.tier === 'B-low') {
        // B-low: prefer duration → interval count
        // In-season: explicitly prefer duration/interval-count, NOT rest reduction
        if (input.currentDuration < caps.maxDuration) {
            adjustment.durationDelta = 5;
            return { state: 'build', adjustment, note: note + ' — +5 min duration' };
        }
        if (input.currentIntervals < caps.maxIntervals) {
            adjustment.intervalsDelta = 1;
            return { state: 'build', adjustment, note: note + ' — +1 interval' };
        }
        // Only use rest reduction in non-in-season phases
        if (input.seasonPhase !== 'In-season' && input.currentRest > caps.minRest) {
            adjustment.restDelta = -5;
            return { state: 'build', adjustment, note: note + ' — rest reduced 5s (off/pre-season)' };
        }
        return { state: 'maintain', adjustment: { ...ZERO_ADJUSTMENT }, note: note + ' — all variables at cap' };
    }
    // Shouldn't reach here (Tier C handled above), but safety net
    return { state: 'maintain', adjustment: { ...ZERO_ADJUSTMENT }, note };
}
// ─── Deload Mechanics ───
function buildConditioningDeload(input, note) {
    const adjustment = { ...ZERO_ADJUSTMENT };
    switch (input.tier) {
        case 'A':
            // Drop reps by 2, increase rest by 15s
            adjustment.repsDelta = -2;
            adjustment.restDelta = 15;
            break;
        case 'B-high':
            // Drop 2 intervals, increase rest by 15s
            adjustment.intervalsDelta = -2;
            adjustment.restDelta = 15;
            break;
        case 'B-low':
            // Reduce duration by 10 min (floor enforced by builder), reduce 1 interval
            adjustment.durationDelta = -10;
            adjustment.intervalsDelta = -1;
            break;
        // C: no change (handled at top of resolveConditioningProgression)
    }
    return { state: 'deload', adjustment, note };
}
