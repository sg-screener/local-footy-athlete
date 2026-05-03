"use strict";
/**
 * Coaching Engine — Deterministic S&C Decision Logic
 *
 * This module owns all STRATEGIC coaching decisions:
 *   - Readiness classification (low / medium / high)
 *   - Hard exposure counting & caps
 *   - Core / Optional / Recovery session allocation
 *   - Injury & sprint constraints
 *   - Ramp-up conservatism for inconsistent athletes
 *
 * The AI receives the OUTPUT of this engine as constraints,
 * then handles exercise selection, progression style, and coaching tone.
 *
 * Principle: "Code decides the dose. AI decides the details."
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateReadiness = calculateReadiness;
exports.countTeamHardExposures = countTeamHardExposures;
exports.getHardExposureCap = getHardExposureCap;
exports.getCoreSessionCount = getCoreSessionCount;
exports.buildCoachingPlan = buildCoachingPlan;
exports.onboardingToCoachingInputs = onboardingToCoachingInputs;
// ─── Step 1: Determine Readiness ───
function calculateReadiness(inputs) {
    let score = 0;
    const factors = [];
    // Recent training consistency (0-3 points)
    switch (inputs.recentTrainingLoad) {
        case 'Very consistent':
            score += 3;
            factors.push('Very consistent recent training (+3)');
            break;
        case 'Pretty consistent':
            score += 2;
            factors.push('Pretty consistent recent training (+2)');
            break;
        case 'A bit':
            score += 1;
            factors.push('Some recent training (+1)');
            break;
        case 'Hardly at all':
            score += 0;
            factors.push('Minimal recent training (+0)');
            break;
        default:
            score += 1;
            factors.push('Unknown training history, defaulting conservative (+1)');
    }
    // Current fitness / conditioning level (0-3 points)
    switch (inputs.conditioningLevel) {
        case 'Elite':
            score += 3;
            factors.push('Elite conditioning (+3)');
            break;
        case 'Good':
            score += 2;
            factors.push('Good conditioning (+2)');
            break;
        case 'Average':
            score += 1;
            factors.push('Average conditioning (+1)');
            break;
        case 'Poor':
            score += 0;
            factors.push('Poor conditioning (+0)');
            break;
        default:
            score += 1;
            factors.push('Unknown conditioning, defaulting conservative (+1)');
    }
    // Injury adjustment — injuries MODIFY training, they don't eliminate it.
    // Mild niggles barely affect readiness. Only severe/constant injuries reduce capacity.
    // Cap total penalty so multiple mild injuries don't stack to crush the score.
    if (inputs.injuries.length > 0) {
        let injuryPenalty = 0;
        for (const injury of inputs.injuries) {
            if (injury.severity === 'Severe') {
                injuryPenalty += 1.5;
            }
            else if (injury.severity === 'Moderate') {
                injuryPenalty += 0.5;
            }
            else {
                // Mild = niggle — negligible impact on readiness
                injuryPenalty += 0;
            }
        }
        // Cap total injury penalty at 2 — injuries change WHAT you train, not WHETHER you train
        injuryPenalty = Math.min(injuryPenalty, 2);
        score -= injuryPenalty;
        factors.push(`${inputs.injuries.length} injur${inputs.injuries.length === 1 ? 'y' : 'ies'} (-${injuryPenalty}) — training modified, not removed`);
    }
    else {
        factors.push('No injuries (+0)');
    }
    // Sprint exposure context
    if (inputs.sprintExposure === 'No sprint training') {
        // Not a penalty per se, but means we need to be careful adding sprint load
        factors.push('No current sprint exposure — ramp carefully');
    }
    else if (inputs.sprintExposure === '2+ times per week') {
        score += 0.5;
        factors.push('Regular sprint exposure (+0.5)');
    }
    // Season context — in-season adds fatigue from games
    if (inputs.seasonPhase === 'In-season') {
        score -= 1;
        factors.push('In-season fatigue penalty (-1)');
    }
    // Classify
    let level;
    if (score <= 2) {
        level = 'low';
    }
    else if (score <= 4) {
        level = 'medium';
    }
    else {
        level = 'high';
    }
    return { level, factors };
}
// ─── Step 2: Count Existing Hard Exposures from Team Environment ───
function countTeamHardExposures(inputs) {
    let count = 0;
    const breakdown = [];
    // Game = 1 hard exposure
    if (inputs.hasGame && inputs.seasonPhase !== 'Off-season') {
        count += 1;
        breakdown.push('Game (1)');
    }
    // Team training — depends on intensity
    const teamDays = inputs.teamTrainingDaysPerWeek || 0;
    if (teamDays > 0) {
        const intensity = inputs.teamTrainingIntensity;
        if (intensity === 'Very intense' || intensity === 'Hard') {
            // All team sessions count as hard
            count += teamDays;
            breakdown.push(`Team training × ${teamDays} @ ${intensity} (${teamDays})`);
        }
        else if (intensity === 'Moderate') {
            // Only count half (rounded up) as hard
            const hardTeamDays = Math.ceil(teamDays / 2);
            count += hardTeamDays;
            breakdown.push(`Team training × ${teamDays} @ ${intensity} — ${hardTeamDays} counted as hard`);
        }
        else {
            // Light team training = 0 hard exposures
            breakdown.push(`Team training × ${teamDays} @ Light — not counted as hard`);
        }
    }
    // Sprint exposure from other sources
    if (inputs.sprintExposure === '2+ times per week') {
        // Don't double-count if sprints happen during team training
        if (inputs.seasonPhase === 'Off-season') {
            // Off-season sprints are separate sessions
            count += 1; // Count 1 (conservative — they said 2+ but we don't stack)
            breakdown.push('Independent sprint sessions (1)');
        }
        // In-season/pre-season sprints are likely part of team training, already counted
    }
    return { count, breakdown };
}
// ─── Step 3: Hard Exposure Caps by Season Phase ───
function getHardExposureCap(phase, readiness) {
    switch (phase) {
        case 'In-season':
            // Target 3–4 total hard exposures per week
            return readiness === 'low' ? 3 : 4;
        case 'Pre-season':
            // Target 4–5 hard exposures per week
            if (readiness === 'low')
                return 4;
            if (readiness === 'medium')
                return 4;
            return 5;
        case 'Off-season':
            // Target 3–5 depending on readiness
            if (readiness === 'low')
                return 3;
            if (readiness === 'medium')
                return 4;
            return 5;
        default:
            return 4;
    }
}
// ─── Step 4: Core Training Dose ───
function getCoreSessionCount(phase, readiness) {
    switch (phase) {
        case 'In-season':
            // In-season: 2-3 CORE gym sessions (lower + pull + push = 3 required exposures)
            // The G−2 push session is CORE but low-fatigue (moderate intensity, low volume)
            // so it doesn't consume hard budget the way a heavy session does.
            // 3 CORE is the target when the athlete has 3+ gym days and medium+ readiness.
            if (readiness === 'low')
                return { min: 1, max: 2 };
            if (readiness === 'medium')
                return { min: 2, max: 3 };
            return { min: 3, max: 3 };
        case 'Pre-season':
            if (readiness === 'low')
                return { min: 2, max: 2 };
            if (readiness === 'medium')
                return { min: 3, max: 3 };
            return { min: 3, max: 4 };
        case 'Off-season':
            if (readiness === 'low')
                return { min: 2, max: 3 };
            if (readiness === 'medium')
                return { min: 3, max: 4 };
            return { min: 4, max: 4 };
        default:
            return { min: 2, max: 3 };
    }
}
// ─── Step 5–8: Build the Full Coaching Plan ───
function buildCoachingPlan(inputs) {
    // Step 1: Readiness
    const { level: readiness, factors: readinessFactors } = calculateReadiness(inputs);
    // Step 2: Existing hard exposures from team environment
    const { count: existingHard, breakdown: hardBreakdown } = countTeamHardExposures(inputs);
    // Step 3: Hard exposure cap
    const hardCap = getHardExposureCap(inputs.seasonPhase, readiness);
    const remainingBudget = Math.max(0, hardCap - existingHard);
    // Step 4: Core session count
    let coreRange = getCoreSessionCount(inputs.seasonPhase, readiness);
    // ── H-PRE-8: structure priority (4 strength exposures) ──
    // Pre-season with ≥2 team days, no game, and at least 5 training days
    // should target a 4-exposure week (2 lower + 2 upper) instead of the
    // default 3-exposure 1L+1U+FB shape. This forces an extra dedicated
    // strength slot over a conditioning/recovery slot when room exists.
    //   medium readiness: {3,3} → {3,4}  (allow but don't force — engine
    //     chooses 4 when availableDays accommodates it)
    //   high readiness:   {3,4} → {4,4}  (force the target shape)
    //   low readiness:    {2,2} stays — safety rail, FB fallback still applies
    // When trigger conditions are NOT met, coreRange is unchanged and the
    // existing H-PRE-6 fallback (1L+1U+FB at core=3) still governs.
    const shouldTarget4Strength = inputs.seasonPhase === 'Pre-season' &&
        (inputs.teamTrainingDays || []).length >= 2 &&
        !inputs.hasGame &&
        inputs.availableDays >= 5;
    if (shouldTarget4Strength) {
        if (readiness === 'medium')
            coreRange = { min: 3, max: 4 };
        else if (readiness === 'high')
            coreRange = { min: 4, max: 4 };
    }
    // In-season: not all CORE sessions are hard exposures. The G−2 push session is CORE
    // (non-negotiable for movement balance) but moderate intensity — it doesn't consume
    // hard budget the way a heavy lower body or pull session does.
    // So: cap heavy CORE by remaining budget, but allow 1 extra moderate CORE on top.
    const isInSeason = inputs.seasonPhase === 'In-season';
    const heavyCoreCap = Math.min(coreRange.max, remainingBudget, inputs.availableDays);
    // In-season with 3+ days and budget for at least 1 heavy session: allow +1 moderate CORE.
    // The G−2 upper session doesn't consume hard budget. It needs only 1 heavy slot (lower)
    // to justify it. Works for both:
    //   - 3-core weeks (push at G−2, moderate)
    //   - 2-core weeks (balanced upper at G−2, moderate)
    // Gate uses coreRange.max >= 2 so low-readiness athletes (max=2) still get the balanced upper.
    const moderateCoreBonus = (isInSeason && inputs.availableDays >= 3 && heavyCoreCap >= 1 && coreRange.max >= 2) ? 1 : 0;
    const coreSessions = Math.min(heavyCoreCap + moderateCoreBonus, coreRange.max, inputs.availableDays);
    const actualCore = Math.max(coreRange.min, coreSessions);
    // Step 5: Fill extra days with optional/recovery
    const extraDays = Math.max(0, inputs.availableDays - actualCore);
    // Optional sessions — even low readiness athletes get at least 1 optional session
    // if they have extra days. Training stimulus > pure recovery for adaptation.
    const optionalSessions = Math.min(extraDays, readiness === 'low' ? 1 : readiness === 'medium' ? 2 : 2);
    const recoverySessions = Math.max(0, extraDays - optionalSessions);
    // Build weekly plan
    console.log('[ENGINE-TRACE] ═══ buildCoachingPlan inputs ═══');
    console.log('[ENGINE-TRACE] seasonPhase:', inputs.seasonPhase);
    console.log('[ENGINE-TRACE] gameDay:', inputs.gameDay ?? 'NONE');
    console.log('[ENGINE-TRACE] hasGame:', inputs.hasGame);
    console.log('[ENGINE-TRACE] selectedDays:', inputs.selectedDays);
    console.log('[ENGINE-TRACE] availableDays:', inputs.availableDays);
    console.log('[ENGINE-TRACE] teamTrainingDays:', inputs.teamTrainingDays);
    console.log('[ENGINE-TRACE] readiness:', readiness);
    console.log('[ENGINE-TRACE] coreRange:', JSON.stringify(coreRange), '→ actualCore:', actualCore);
    console.log('[ENGINE-TRACE] optional:', optionalSessions, 'recovery:', recoverySessions);
    const weeklyPlan = buildWeeklyPlan(inputs, actualCore, optionalSessions, recoverySessions);
    console.log('[ENGINE-TRACE] ═══ weeklyPlan output ═══');
    weeklyPlan.forEach(s => console.log(`[ENGINE-TRACE]   ${s.dayOfWeek}: [${s.tier}] ${s.focus}${s.isHardExposure ? ' (HARD)' : ''}`));
    // ── Post-generation validation: required exposures ──
    // In-season with game: validate movement coverage based on core count.
    //   1-core → must be full body (covers lower + push + pull in one session)
    //   2-core → lower + balanced upper (push + pull merged)
    //   3-core → lower + push + pull (separate sessions)
    if (isInSeason && inputs.hasGame && actualCore >= 1) {
        if (actualCore === 1) {
            // 1-core: must be full body
            const hasFullBody = weeklyPlan.some(s => s.tier === 'core' && /full body/i.test(s.focus));
            if (!hasFullBody) {
                console.error('[ENGINE-VALIDATE] INVARIANT VIOLATION: 1-core week missing full body session');
                console.error('[ENGINE-VALIDATE] Plan:', weeklyPlan.map(s => `${s.dayOfWeek}:[${s.tier}]${s.focus}`).join(' | '));
                // Emergency fix: relabel the sole core session
                const soleCore = weeklyPlan.find(s => s.tier === 'core');
                if (soleCore) {
                    console.log(`[ENGINE-VALIDATE] Emergency relabel: ${soleCore.dayOfWeek} → basic full body`);
                    soleCore.focus = 'Basic full body (1 squat/hinge + 1 push + 1 pull — cover all patterns, moderate volume)';
                }
            }
        }
        else {
            // 2+ cores: validate lower + upper coverage
            const hasLower = weeklyPlan.some(s => s.tier === 'core' && /lower/i.test(s.focus));
            const hasPush = weeklyPlan.some(s => s.tier === 'core' && /push/i.test(s.focus));
            const hasBalanced = weeklyPlan.some(s => s.tier === 'core' && /balanced upper/i.test(s.focus));
            const hasFullBody = weeklyPlan.some(s => s.tier === 'core' && /full body/i.test(s.focus));
            const hasUpperCoverage = hasPush || hasBalanced || hasFullBody;
            if (!hasUpperCoverage) {
                console.error('[ENGINE-VALIDATE] INVARIANT VIOLATION: In-season weekly plan missing upper body coverage (push or balanced)');
                console.error('[ENGINE-VALIDATE] Plan:', weeklyPlan.map(s => `${s.dayOfWeek}:[${s.tier}]${s.focus}`).join(' | '));
                // Emergency fix: promote best optional slot to balanced upper
                const promotable = weeklyPlan.find(s => s.tier === 'optional' && s.dayOfWeek &&
                    !/arm|pump|G.1/i.test(s.focus));
                if (promotable) {
                    console.log(`[ENGINE-VALIDATE] Emergency promotion: ${promotable.dayOfWeek} optional → balanced upper`);
                    promotable.tier = 'core';
                    promotable.focus = 'Balanced upper (push + pull — moderate intensity, maintain both patterns before game)';
                    promotable.isHardExposure = false;
                }
            }
            if (!hasLower) {
                console.error('[ENGINE-VALIDATE] INVARIANT VIOLATION: In-season weekly plan missing LOWER exposure');
            }
        }
    }
    // Build AI constraints
    const constraints = buildAIConstraints(inputs, readiness, hardCap, existingHard, actualCore, optionalSessions, recoverySessions);
    return {
        readiness,
        readinessFactors,
        hardExposureCap: hardCap,
        existingHardExposures: existingHard,
        remainingHardBudget: remainingBudget,
        coreSessions: actualCore,
        optionalSessions,
        recoverySessions,
        weeklyPlan,
        constraints,
    };
}
// ─── Day numbering helper ───
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function dayNameToNumber(name) {
    const idx = DAY_NAMES.indexOf(name);
    return idx >= 0 ? idx : -1;
}
/**
 * Calculate G-offset: how many days before game day is this day?
 * Returns negative numbers (e.g. -5 means G−5).
 * If no game day, returns 0 for all days.
 */
function gOffset(dayNum, gameDayNum) {
    if (gameDayNum === null)
        return 0;
    let diff = dayNum - gameDayNum;
    if (diff > 0)
        diff -= 7; // wrap around: Sunday after Saturday game = -6 → actually +1, but we want G+1
    if (diff === 0)
        return 0; // game day itself
    // Special case: day after game = G+1
    if (diff === -6)
        return 1; // e.g. Sunday (0) after Saturday (6) game
    return diff;
}
// ─── Weekly Plan Builder (Game-Day Relative) ───
//
// DESIGN PRINCIPLES (in-season):
//   1. Exactly 3 CORE gym sessions: Lower, Upper Pull, Upper Push
//   2. CORE means true key sessions ONLY — everything else is OPTIONAL or RECOVERY
//   3. Prefer Tuesday = Pull, Thursday = Push (when paired with team training)
//   4. Wednesday defaults to OPTIONAL/RECOVERY — never CORE unless no alternative
//   5. No back-to-back upper pattern loading (push → pull → push is bad)
//   6. Prioritise spacing and freshness over squeezing in extra work
function buildWeeklyPlan(inputs, core, optional, recovery) {
    const plan = [];
    const days = [...inputs.selectedDays];
    const gameDayNum = inputs.gameDay ? dayNameToNumber(inputs.gameDay) : null;
    const teamDayNums = (inputs.teamTrainingDays || []).map(dayNameToNumber).filter(d => d >= 0);
    // Convert selected days to numbers with G-offsets
    const daySlots = days.map(dayName => {
        const num = dayNameToNumber(dayName);
        const offset = gOffset(num, gameDayNum);
        const isTeamDay = teamDayNums.includes(num);
        return { dayName, num, offset, isTeamDay };
    });
    // Sort by day of week number for consistent processing.
    // Training-week order: Mon(1) → Sat(6) → Sun(0).
    // Sunday is always the lowest-priority day for core allocation — it should
    // be optional/recovery, not promoted to core ahead of Saturday.
    const trainingOrder = (num) => num === 0 ? 7 : num; // Sun(0) → 7 (last)
    daySlots.sort((a, b) => {
        // For game-relative, sort by offset (most negative first = earliest in week)
        if (gameDayNum !== null)
            return a.offset - b.offset;
        return trainingOrder(a.num) - trainingOrder(b.num);
    });
    const isInSeason = inputs.seasonPhase === 'In-season';
    const hasGameThisWeek = isInSeason && gameDayNum !== null;
    if (hasGameThisWeek) {
        // ─── In-season WITH game: G-relative placement with spacing intelligence ───
        const assigned = new Map();
        // Classify available slots
        const highLoad = daySlots.filter(d => d.offset <= -4 && d.offset >= -5); // G−5 to G−4
        const midWeek = daySlots.filter(d => d.offset === -3); // G−3
        const lateWeek = daySlots.filter(d => d.offset === -2); // G−2
        const preGame = daySlots.filter(d => d.offset === -1); // G−1
        const postGame = daySlots.filter(d => d.offset === 1 || d.offset <= -6); // G+1
        // ── STEP 1: Place PRIMARY CORE ──
        // 1-core week → Basic Full Body (1 lower + 1 push + 1 pull, minimal accessory)
        // 2+ core week → Lower body strength (squat + hinge), upper handled in Steps 2+3
        const lowerSlot = highLoad.find(d => !d.isTeamDay)
            || highLoad[0]; // fallback: any high load day
        if (lowerSlot && core >= 1) {
            if (core === 1) {
                // Only 1 CORE session — must cover all movement categories in one session
                assigned.set(lowerSlot.dayName, {
                    tier: 'core',
                    focus: 'Basic full body (1 squat/hinge + 1 push + 1 pull — cover all patterns, moderate volume)',
                    dayOfWeek: lowerSlot.dayName,
                    isHardExposure: true,
                });
            }
            else {
                // 2+ CORE — dedicate this slot to lower, upper comes in Steps 2+3
                assigned.set(lowerSlot.dayName, {
                    tier: 'core', focus: 'Lower body strength (squat + hinge)',
                    dayOfWeek: lowerSlot.dayName, isHardExposure: true
                });
            }
        }
        // ── STEP 2 + 3: Place UPPER session(s) ──
        //
        // 3-core week (ideal):
        //   Step 2 → Upper Push at G−2 (moderate intensity, not a hard exposure)
        //   Step 3 → Upper Pull at G−4 (hard exposure, pair with team training)
        //
        // 2-core week (constrained):
        //   Step 2 → Balanced Upper (push + pull) at G−2 (moderate intensity)
        //   "Never simply omit a movement category" — when only 1 upper slot exists,
        //   merge push + pull into a balanced upper session so neither is dropped.
        //
        // The late-week G−2 slot is the anchor for the upper session in both cases.
        // Find the best upper slot (G−2 preferred)
        const upperSlotCandidates = [
            ...lateWeek.filter(d => !assigned.has(d.dayName)),
            ...highLoad.filter(d => !assigned.has(d.dayName)),
        ];
        const upperSlot = upperSlotCandidates[0];
        let pullSlot = null;
        if (core >= 3) {
            // ── 3-core: separate push + pull ──
            // Place PUSH at G−2 (moderate)
            if (upperSlot) {
                const isLateWeekSlot = upperSlot.offset === -2;
                assigned.set(upperSlot.dayName, {
                    tier: 'core',
                    focus: isLateWeekSlot
                        ? 'Upper body — push emphasis (moderate intensity, low fatigue — maintain strength, keep CNS sharp)'
                        : 'Upper body — push emphasis',
                    dayOfWeek: upperSlot.dayName,
                    isHardExposure: !isLateWeekSlot,
                });
            }
            // Place PULL at G−4 (hard)
            const upperDayNum = upperSlot ? upperSlot.num : -99;
            const pullCandidates = [
                // 1st: team training day in high load, not adjacent to push
                ...highLoad.filter(d => d.isTeamDay && !assigned.has(d.dayName) && Math.abs(d.num - upperDayNum) > 1),
                // 2nd: any team training day in high load
                ...highLoad.filter(d => d.isTeamDay && !assigned.has(d.dayName)),
                // 3rd: any unassigned high load day
                ...highLoad.filter(d => !assigned.has(d.dayName)),
            ];
            pullSlot = pullCandidates[0] || null;
            if (pullSlot) {
                assigned.set(pullSlot.dayName, {
                    tier: 'core', focus: 'Upper body — pull emphasis',
                    dayOfWeek: pullSlot.dayName, isHardExposure: true
                });
            }
            // Validate spacing — no back-to-back upper
            if (pullSlot && upperSlot && Math.abs(pullSlot.num - upperSlot.num) === 1) {
                const betterPull = highLoad.find(d => !assigned.has(d.dayName) && d.dayName !== pullSlot.dayName && Math.abs(d.num - upperDayNum) > 1)
                    || daySlots.find(d => !assigned.has(d.dayName) && d.offset <= -3 && d.offset >= -5 && Math.abs(d.num - upperDayNum) > 1);
                if (betterPull) {
                    assigned.delete(pullSlot.dayName);
                    pullSlot = betterPull;
                    assigned.set(betterPull.dayName, {
                        tier: 'core', focus: 'Upper body — pull emphasis',
                        dayOfWeek: betterPull.dayName, isHardExposure: true
                    });
                }
            }
        }
        else if (core >= 2 && upperSlot) {
            // ── 2-core: balanced upper (push + pull merged) ──
            const isLateWeekSlot = upperSlot.offset === -2;
            assigned.set(upperSlot.dayName, {
                tier: 'core',
                focus: isLateWeekSlot
                    ? 'Balanced upper (push + pull — moderate intensity, maintain both patterns before game)'
                    : 'Balanced upper (push + pull)',
                dayOfWeek: upperSlot.dayName,
                isHardExposure: !isLateWeekSlot,
            });
        }
        // ── STEP 5: Fill remaining slots as OPTIONAL / RECOVERY ──
        // G−3 always defaults to OPTIONAL or RECOVERY (never CORE)
        // G−1 always OPTIONAL arms/pump
        // G+1 always RECOVERY
        const remainingDays = daySlots.filter(d => !assigned.has(d.dayName));
        let optCount = 0;
        let recCount = 0;
        for (const slot of remainingDays) {
            if (slot.offset === 1 || slot.offset <= -6) {
                // Post-game → always recovery
                plan.push({ tier: 'recovery', focus: 'Post-game recovery — flush, mobility, stretching', dayOfWeek: slot.dayName, isHardExposure: false });
                recCount++;
            }
            else if (slot.offset === -1) {
                // G−1 → optional arms/pump only
                plan.push({ tier: 'optional', focus: 'Optional arms/pump — biceps, triceps, lateral raises only', dayOfWeek: slot.dayName, isHardExposure: false });
                optCount++;
            }
            else if (slot.offset === -3) {
                // G−3 → optional light work or recovery (NEVER CORE)
                plan.push({
                    tier: optCount < optional ? 'optional' : 'recovery',
                    focus: optCount < optional
                        ? 'Light accessories — trunk, calves, groin, shoulder prehab, mobility'
                        : 'Mobility, foam rolling, light movement',
                    dayOfWeek: slot.dayName,
                    isHardExposure: false,
                });
                if (optCount < optional)
                    optCount++;
                else
                    recCount++;
            }
            else {
                // Other unassigned days
                if (optCount < optional) {
                    plan.push({ tier: 'optional', focus: 'Light accessories — trunk, calves, groin, shoulder prehab, mobility', dayOfWeek: slot.dayName, isHardExposure: false });
                    optCount++;
                }
                else if (recCount < recovery) {
                    plan.push({ tier: 'recovery', focus: 'Mobility, foam rolling, light movement', dayOfWeek: slot.dayName, isHardExposure: false });
                    recCount++;
                }
            }
        }
        // Add all assigned CORE sessions to plan
        Array.from(assigned.values()).forEach(session => plan.push(session));
    }
    else if (isInSeason && !hasGameThisWeek) {
        // ─── In-season NO GAME (bye week / game removed) ───
        //
        // PHILOSOPHY:
        //   No game = freed recovery window. Use it to build, not coast.
        //   Saturday becomes a primary training day (lower + conditioning emphasis).
        //   Sunday stays recovery/off — athletes expect a rest day here.
        //
        // PLACEMENT:
        //   1. Early-week core sessions: standard lower/upper alternation
        //   2. Saturday: core lower body + conditioning emphasis (the "bonus" session)
        //   3. Sunday: always off / recovery (never gets a session)
        //   4. Remaining days: optional → recovery as normal
        //
        // This re-optimises the week around the absence of game-day fatigue
        // rather than just removing the game and leaving a weird structure.
        // Partition days: Saturday gets special handling, Sunday is always off
        const saturdaySlot = daySlots.find(d => d.dayName === 'Saturday');
        const sundaySlot = daySlots.find(d => d.dayName === 'Sunday');
        const regularSlots = daySlots.filter(d => d.dayName !== 'Saturday' && d.dayName !== 'Sunday');
        // If Sunday is in the plan, force it to recovery
        if (sundaySlot) {
            plan.push({
                tier: 'recovery',
                focus: 'Full rest or light walk',
                dayOfWeek: 'Sunday',
                isHardExposure: false,
            });
        }
        let coreCount = 0;
        let optCount = 0;
        let recCount = 0;
        // Place core sessions on regular (non-Sat/Sun) days.
        // Saturday already covers lower+conditioning, so regular days need:
        //   - Non-team days → lower body (gym legs without team fatigue)
        //   - Team days → upper body (pair with team running/drills)
        // This ensures balanced upper/lower distribution.
        const regularCoreTarget = core - (saturdaySlot ? 1 : 0);
        // Separate non-team and team slots to place lower first, upper second
        const nonTeamSlots = regularSlots.filter(s => !s.isTeamDay);
        const teamSlots = regularSlots.filter(s => s.isTeamDay);
        const orderedForCore = [...nonTeamSlots, ...teamSlots]; // lower-first, then upper
        for (const slot of regularSlots) {
            // Determine if this slot should be core
            const coreIdx = orderedForCore.indexOf(slot);
            const isCoreCandidateByOrder = coreIdx >= 0 && coreIdx < regularCoreTarget;
            if (isCoreCandidateByOrder && coreCount < regularCoreTarget) {
                let focus;
                if (slot.isTeamDay) {
                    focus = 'Upper body strength';
                }
                else {
                    // Non-team day: lower if we need it, upper otherwise
                    // With Saturday covering lower, first non-team day should also be lower
                    // only if we have enough core budget (2+ regular cores).
                    // With 1 regular core: just upper (Saturday handles lower).
                    const lowerPlaced = plan.some(p => p.focus.toLowerCase().includes('lower'));
                    focus = (!lowerPlaced && !saturdaySlot) ? 'Lower body strength' : (!lowerPlaced && regularCoreTarget >= 2 ? 'Lower body strength' : 'Upper body strength');
                }
                plan.push({ tier: 'core', focus, dayOfWeek: slot.dayName, isHardExposure: true });
                coreCount++;
            }
            else if (optCount < optional) {
                plan.push({ tier: 'optional', focus: getOptionalFocus(inputs), dayOfWeek: slot.dayName, isHardExposure: false });
                optCount++;
            }
            else if (recCount < recovery) {
                plan.push({ tier: 'recovery', focus: 'Mobility, foam rolling, light movement', dayOfWeek: slot.dayName, isHardExposure: false });
                recCount++;
            }
        }
        // Saturday: core lower body + conditioning emphasis
        // This is the "bonus" session freed up by no game day.
        // Lower body emphasis because the athlete isn't accumulating game-day
        // lower body fatigue this week, so there's capacity to train it harder.
        if (saturdaySlot) {
            plan.push({
                tier: 'core',
                focus: 'Lower body strength + conditioning emphasis (no game this week — build capacity)',
                dayOfWeek: 'Saturday',
                isHardExposure: true,
            });
            coreCount++;
        }
    }
    else {
        const STRENGTH_CANDIDATES = ['L-sq', 'L-hi', 'U-pu', 'U-pl', 'FB', 'L-co', 'U-co'];
        // Free-form candidate list excludes combined-region types: L-co / U-co
        // only enter the plan via an approved structure queue, never via the
        // open scorer. This prevents core ≥ 5 weeks from replacing dedicated
        // sessions with combined ones for no reason.
        const FREEFORM_STRENGTH = ['L-sq', 'L-hi', 'U-pu', 'U-pl', 'FB'];
        const ALL_CANDIDATES = [...FREEFORM_STRENGTH, 'COND', 'S+C', 'ACC', 'REC'];
        const COND_FLAVOURS = ['aerobic', 'tempo', 'high-intensity'];
        const COND_FLAVOUR_CAPS = { aerobic: 2, tempo: 2, 'high-intensity': 1 };
        // ── Category-based weekly distribution (off-season / pre-season) ──
        // Priority order (head = highest priority — covered first when slots
        // are limited). Off-season uses the full priority; pre-season drops
        // aerobic + sprint to the bottom because team training already covers
        // those (long runs + sprint work happen at training).
        const CATEGORY_PRIORITY_OFF = ['aerobic_base', 'sprint', 'vo2', 'glycolytic'];
        const CATEGORY_PRIORITY_PRE = ['vo2', 'glycolytic', 'aerobic_base', 'sprint'];
        // Does this phase use category-based distribution?
        const useCategoryPlanner = inputs.seasonPhase === 'Off-season' || inputs.seasonPhase === 'Pre-season';
        const categoryPriority = inputs.seasonPhase === 'Pre-season'
            ? CATEGORY_PRIORITY_PRE
            : CATEGORY_PRIORITY_OFF;
        // Map category → legacy flavour (for backward compat with downstream code).
        function categoryToFlavour(cat) {
            switch (cat) {
                case 'aerobic_base': return 'aerobic';
                case 'vo2': return 'tempo';
                case 'sprint': return 'high-intensity';
                case 'glycolytic': return 'high-intensity';
            }
        }
        function isStrength(c) { return STRENGTH_CANDIDATES.includes(c) || c === 'S+C'; }
        function isLower(c) { return c === 'L-sq' || c === 'L-hi' || c === 'L-co' || c === 'FB'; }
        function isUpper(c) { return c === 'U-pu' || c === 'U-pl' || c === 'U-co' || c === 'FB'; }
        function isConditioning(c) { return c === 'COND' || c === 'S+C'; }
        // "Heavy lower" = any dedicated lower or combined lower session. Blocked
        // on team days under H-PRE-2. FB is NOT heavy lower (moderate mixed load).
        function isHeavyLower(c) { return c === 'L-sq' || c === 'L-hi' || c === 'L-co'; }
        // ── Pattern-based targets ──
        //
        // The week must balance 4 movement patterns: squat, hinge, push, pull.
        // Instead of region targets (lower vs upper), each pattern gets an equal
        // share of the core budget. This prevents 2:0 imbalances like double-lower
        // with no pull, and ensures every week looks like a real S&C program.
        //
        // FB (full body) partially covers all patterns — valuable when there aren't
        // enough slots to place each pattern individually.
        const patternShare = core / 4; // ideal per-pattern count
        // ── Pre-season flag + team-day awareness ──
        //
        // Pre-season is NOT "off-season + team training". It's a third ruleset:
        //   • Team days are PRIMARY field-load anchors. They are not gym-neutral
        //     days that happen to have team training "on top" — they ARE hard
        //     exposures, and the gym plan must be built around them.
        //   • No standalone or combined conditioning on a team day (field load
        //     already counts).
        //   • No heavy lower on a team day (dedicated L-sq / L-hi are blocked;
        //     FB / upper / low-fatigue support only).
        //   • Sprint is NEVER scheduled the day before or day after a team day
        //     (neural freshness + soreness protection).
        //   • Total standalone conditioning is REDUCED compared with off-season
        //     because team training already covers field stress.
        const isPreSeason = inputs.seasonPhase === 'Pre-season';
        const teamDayNumSet = new Set(teamDayNums);
        const hasTeamDays = teamDayNumSet.size > 0;
        const isTeamDayPos = (pos) => {
            // pos uses trainingOrder (Sun=7, Mon..Sat=1..6). Map back to dayNum.
            const dayNum = pos === 7 ? 0 : pos;
            return teamDayNumSet.has(dayNum);
        };
        const isAdjacentToTeamDay = (pos) => {
            // pos is trainingOrder (Mon=1..Sat=6, Sun=7). Check pos-1 and pos+1
            // in calendar-day terms (not in trainingOrder), because adjacency is
            // about the real week, not our sort order.
            const dayNum = pos === 7 ? 0 : pos;
            // Adjacent calendar days are dayNum-1 and dayNum+1 mod 7.
            const prevDay = (dayNum + 6) % 7;
            const nextDay = (dayNum + 1) % 7;
            return teamDayNumSet.has(prevDay) || teamDayNumSet.has(nextDay);
        };
        // Conditioning target: at least as many conditioning exposures as strength,
        // minimum 3, baseline 4, high-end 5
        let condTarget = Math.max(core, 4);
        if (inputs.availableDays <= 3)
            condTarget = 3;
        else if (inputs.conditioningLevel === 'Poor')
            condTarget = Math.max(3, core);
        if (inputs.readinessOverride === 'low' || core <= 2) {
            condTarget = Math.max(3, condTarget - 1);
        }
        condTarget = Math.max(3, Math.min(5, condTarget));
        // Pre-season conditioning volume reduction.
        // Team training provides significant field load (sprints, drills, long
        // aerobic exposure). Each team day in pre-season substitutes for roughly
        // one standalone conditioning exposure — so drop the target and the cap
        // accordingly. Floor at 2 to keep at least some gym-side conditioning
        // variety (usually a VO2/glyco day and an aerobic base flush).
        if (isPreSeason && hasTeamDays) {
            const reduction = Math.min(2, teamDayNumSet.size);
            condTarget = Math.max(2, condTarget - reduction);
            // Pre-season also caps the top end at 4 (off-season's 5 is too much
            // cumulative load when team training is present).
            condTarget = Math.min(4, condTarget);
        }
        // ── Conditioning feasibility ──
        const standaloneSlotsAvailable = Math.max(0, daySlots.length - core);
        // Pre-season with team days: floor is 1 (team training covers the bulk
        // of field load; the one standalone conditioning guarantees VO2 or
        // aerobic base doesn't disappear entirely). Otherwise 2 as before.
        const MIN_COND_FLOOR = (isPreSeason && hasTeamDays) ? 1 : 2;
        const condViaStandaloneMax = Math.min(standaloneSlotsAvailable, condTarget);
        const condShortfall = Math.max(0, MIN_COND_FLOOR - condViaStandaloneMax);
        const minCombinedDays = condShortfall > 0 ? Math.ceil(condShortfall / 0.75) : 0;
        function getApprovedStructures() {
            // ── Pre-season with team days: tighter structure ──
            // Sam's pre-season ruleset: the gym week must be 2 lower + 2 upper
            // (squat/hinge × push/pull). FB is only allowed when core ≤ 2 (where it
            // replaces upper+lower rather than stacking on top of them). Mixing FB
            // with dedicated lower AND upper in the same week creates redundant
            // volume — explicitly forbidden here.
            if (isPreSeason && hasTeamDays) {
                // Movement-pattern integrity is non-negotiable here: the week must
                // always hit squat + hinge + push + pull, even when total strength
                // frequency is small. The tool for that is the combined-region
                // session (L-co / U-co) — when there's only room for ONE lower
                // slot the athlete trains both squat AND hinge in that session,
                // and likewise for a single upper slot (push + pull together).
                switch (core) {
                    case 2:
                        // 2 slots → one combined upper + one combined lower. This
                        // lands all four patterns (squat, hinge, push, pull) in the
                        // two sessions we have. Splitting into e.g. 1 push + 1 squat
                        // would drop hinge and pull entirely — the exact failure
                        // mode Sam called out.
                        return [
                            ['U-co', 'L-co'],
                        ];
                    case 3:
                        // 3 slots → STRENGTH DISTRIBUTION BALANCE (H-PRE-6).
                        //   Team training already delivers heavy lower load (running,
                        //   cuts, contact). Stacking 2 dedicated lower sessions on top
                        //   compounds soft-tissue stress and starves upper development.
                        //   Likewise 2 upper + 1 lower under-doses lower strength.
                        //
                        //   Rule: exactly 1 lower + 1 upper + 1 full body. FB carries
                        //   the "missing" pattern so weekly squat + hinge + push + pull
                        //   coverage is preserved even when a region only has one slot.
                        //     [L-co, U-co, FB] — optimal, every pattern twice
                        //     [L-sq, U-co, FB] — hinge covered via FB
                        //     [L-hi, U-co, FB] — squat covered via FB
                        //     [L-co, U-pu, FB] — pull  covered via FB
                        //     [L-co, U-pl, FB] — push  covered via FB
                        //   Forbidden shapes (imbalanced): 2L+1U, 2U+1L.
                        return [
                            ['L-co', 'U-co', 'FB'],
                            ['L-sq', 'U-co', 'FB'],
                            ['L-hi', 'U-co', 'FB'],
                            ['L-co', 'U-pu', 'FB'],
                            ['L-co', 'U-pl', 'FB'],
                        ];
                    case 4:
                        // 4 slots → full 2L + 2U split. Every pattern gets its own
                        // dedicated session. This is Sam's explicit target shape.
                        return [
                            ['U-pu', 'L-sq', 'U-pl', 'L-hi'],
                            ['U-pu', 'L-hi', 'U-pl', 'L-sq'],
                            ['U-pl', 'L-sq', 'U-pu', 'L-hi'],
                            ['U-pl', 'L-hi', 'U-pu', 'L-sq'],
                        ];
                    default:
                        return []; // core ≥ 5 uses free-form scoring
                }
            }
            // ── Off-season / pre-season without team days: original list ──
            switch (core) {
                case 2:
                    return [
                        ['U-pu', 'L-sq'], ['U-pl', 'L-hi'],
                        ['U-pu', 'L-hi'], ['U-pl', 'L-sq'],
                        ['FB', 'FB'],
                    ];
                case 3:
                    return [
                        ['U-pu', 'U-pl', 'L-sq'], ['U-pu', 'U-pl', 'L-hi'],
                        ['U-pu', 'L-sq', 'FB'], ['U-pl', 'L-hi', 'FB'],
                        ['U-pu', 'L-hi', 'FB'], ['U-pl', 'L-sq', 'FB'],
                        ['FB', 'FB', 'FB'],
                    ];
                case 4:
                    return [
                        ['U-pu', 'L-sq', 'U-pl', 'L-hi'],
                        ['U-pu', 'L-hi', 'U-pl', 'L-sq'],
                        ['U-pl', 'L-sq', 'U-pu', 'L-hi'],
                    ];
                default:
                    return []; // core ≥ 5 uses free-form scoring
            }
        }
        function scoreStructure(struct) {
            let score = 0;
            // Pattern coverage
            let sq = 0, hi = 0, pu = 0, pl = 0;
            for (const s of struct) {
                if (s === 'L-sq')
                    sq++;
                if (s === 'L-hi')
                    hi++;
                if (s === 'U-pu')
                    pu++;
                if (s === 'U-pl')
                    pl++;
                if (s === 'FB') {
                    sq += 0.5;
                    hi += 0.5;
                    pu += 0.5;
                    pl += 0.5;
                }
                // Combined-region sessions cover both sub-patterns of their
                // region at moderate dose (0.5 each, like FB within its region).
                if (s === 'L-co') {
                    sq += 0.5;
                    hi += 0.5;
                }
                if (s === 'U-co') {
                    pu += 0.5;
                    pl += 0.5;
                }
            }
            // Reward covering all 4 patterns
            const covered = [sq, hi, pu, pl].filter(x => x > 0).length;
            score += covered * 25;
            // Reward having both lower patterns (squat + hinge)
            if (sq > 0 && hi > 0)
                score += 15;
            // Reward having both upper patterns (push + pull)
            if (pu > 0 && pl > 0)
                score += 15;
            // Lower body MUST be present — massive penalty if missing
            const hasLower = struct.some(s => s === 'L-sq' || s === 'L-hi');
            const hasFB = struct.some(s => s === 'FB');
            if (!hasLower && !hasFB)
                score -= 100;
            // Variety bonus — more distinct session types
            const uniqueTypes = new Set(struct).size;
            score += uniqueTypes * 5;
            // Team day compatibility: upper/FB sessions fit well on team days
            const teamDayCount = daySlots.filter(s => s.isTeamDay).length;
            if (teamDayCount > 0) {
                const upperOrFBCount = struct.filter(s => s === 'U-pu' || s === 'U-pl' || s === 'FB').length;
                score += Math.min(upperOrFBCount, teamDayCount) * 5;
            }
            // For core=3: dedicated splits > all-FB when enough spacing exists
            if (core === 3 && struct.every(s => s === 'FB')) {
                score -= 10;
            }
            // ── H-PRE-6: strength distribution balance (pre-season + team days) ──
            //
            // Belt-and-suspenders alongside getApprovedStructures(): even if a
            // legacy or hand-added imbalanced structure slips into the pool,
            // scoring steers the engine toward the balanced 1L + 1U + FB shape.
            // Heavy lower is penalised more than heavy upper because team
            // training already loads lower-body tissue (running, cuts, contact).
            if (isPreSeason && hasTeamDays && core === 3) {
                const lowerCount = struct.filter(s => s === 'L-sq' || s === 'L-hi' || s === 'L-co').length;
                const upperCount = struct.filter(s => s === 'U-pu' || s === 'U-pl' || s === 'U-co').length;
                const fullCount = struct.filter(s => s === 'FB').length;
                if (lowerCount > 1)
                    score -= 40; // strong: 2L+1U is the failure mode
                if (upperCount > 1)
                    score -= 25; // moderate: 2U+1L under-doses lower
                if (lowerCount === 1 && upperCount === 1 && fullCount === 1) {
                    score += 30;
                }
                // ── Muddy-overlap penalty ──
                // [L-co, U-co, FB] covers every pattern twice (L-co has sq+hi, U-co
                // has pu+pl, FB has all four). That "feels" doubled up on the card.
                // Bias toward shapes with a DEDICATED single-pattern session as
                // the main lower or upper anchor, using FB purely for coverage:
                //   [L-sq, U-co, FB]  — dedicated squat, FB backs hinge
                //   [L-hi, U-co, FB]  — dedicated hinge, FB backs squat
                //   [L-co, U-pu, FB]  — dedicated push,  FB backs pull
                //   [L-co, U-pl, FB]  — dedicated pull,  FB backs push
                if (struct.includes('L-co') && struct.includes('U-co') && struct.includes('FB')) {
                    score -= 10;
                }
            }
            // ── H-PRE-8: 4-exposure structure priority (pre-season + team days + core=4) ──
            //
            // When the week runs at core=4 in pre-season with team days, the
            // canonical shape is 2 lower + 2 upper (one squat, one hinge, one
            // push, one pull). FB is explicitly NOT a primary slot at core=4
            // (H-PRE-9) — it under-doses pattern specificity when room exists
            // for a dedicated session. Any imbalanced 3+1 shape is a failure
            // mode (under-doses the short side).
            if (isPreSeason && hasTeamDays && core === 4) {
                const lowerCount = struct.filter(s => s === 'L-sq' || s === 'L-hi' || s === 'L-co').length;
                const upperCount = struct.filter(s => s === 'U-pu' || s === 'U-pl' || s === 'U-co').length;
                const fbCount = struct.filter(s => s === 'FB').length;
                // Canonical target: exactly 2L + 2U + 0 FB
                if (lowerCount === 2 && upperCount === 2 && fbCount === 0) {
                    score += 40;
                }
                // Imbalanced 3+1 shape under-doses the short side
                if (lowerCount === 1 || upperCount === 1)
                    score -= 30;
                // H-PRE-9: FB is not a primary slot at core=4 in this regime
                score -= fbCount * 20;
            }
            return score;
        }
        // Select the best approved structure (or empty for free-form)
        const approvedStructures = getApprovedStructures();
        let strengthQueue = [];
        const useStructureMode = approvedStructures.length > 0;
        if (useStructureMode) {
            let bestStruct = approvedStructures[0];
            let bestStructScore = -Infinity;
            for (const struct of approvedStructures) {
                const s = scoreStructure(struct);
                if (s > bestStructScore) {
                    bestStructScore = s;
                    bestStruct = struct;
                }
            }
            strengthQueue = [...bestStruct];
        }
        // ── Rest day distribution ──
        //
        // Off-season needs rest days distributed across the week, not stacked
        // at the end. When the week has enough slack (more days than required
        // sessions), pre-designate some positions as rest/conditioning-only
        // slots where strength cannot be placed.
        //
        // This ensures the finished week has breaks between hard training days,
        // not 4+ consecutive hard days followed by rest at the end.
        const weekSlack = daySlots.length - core;
        const restCount = daySlots.length >= 5 ? Math.min(weekSlack, 2) : 0;
        const restSlotIndices = new Set();
        if (restCount === 2) {
            if (daySlots.length <= 5) {
                // 5 slots: rest at positions 1 and 3 → train/rest/train/rest/train
                restSlotIndices.add(1);
                restSlotIndices.add(3);
            }
            else {
                // 6+ slots: rest at 2 and 4 → train/train/rest/train/rest/train
                restSlotIndices.add(2);
                restSlotIndices.add(4);
            }
        }
        else if (restCount === 1) {
            // Single rest day in the middle
            restSlotIndices.add(Math.floor(daySlots.length / 2));
        }
        const st = {
            consecutiveCoreCalendarDays: 0,
            prevSlotDayNum: -99,
            prevSlotWasCore: false,
            lastLowerDay: -99,
            lastLowerSubtype: null,
            lastUpperDay: -99,
            lastUpperSubtype: null,
            lastCondDay: -99,
            lastCondCategory: null,
            sqCount: 0,
            hiCount: 0,
            puCount: 0,
            plCount: 0,
            lowerCount: 0,
            upperCount: 0,
            condCount: 0,
            condFlavours: { aerobic: 0, tempo: 0, 'high-intensity': 0 },
            condCategories: { aerobic_base: 0, sprint: 0, vo2: 0, glycolytic: 0 },
            fbCount: 0,
            coreStrengthCount: 0,
            lastCoreSubtype: null,
            optCount: 0,
            recCount: 0,
        };
        // ── Hard constraint check ──
        function violatesHard(c, dayNum) {
            const pos = trainingOrder(dayNum);
            const isConsecutiveDay = pos === st.prevSlotDayNum + 1;
            const onTeamDay = isPreSeason && teamDayNumSet.has(dayNum);
            const adjacentTeamDay = isPreSeason && isAdjacentToTeamDay(pos);
            // ── H-PRE-1: No separate conditioning on a team training day ──
            // Team training IS the field-load session. Adding standalone COND or
            // combining strength with conditioning (S+C) stacks running/HR stress
            // on top of an already-hard day. Gym on a team day = low-fatigue
            // strength support only (FB / upper / accessories).
            if (onTeamDay && (c === 'COND' || c === 'S+C'))
                return true;
            // ── H-PRE-2: No heavy lower on a team training day ──
            // Team training already delivers repeated high-force running, cuts,
            // and contact. Dedicated lower strength (squat or hinge focus, or
            // the combined L-co which loads both patterns) compounds the same
            // tissue load. FB is allowed only at core ≤ 2 (see H-PRE-4 below)
            // because its dose is moderate and distributed.
            if (onTeamDay && isHeavyLower(c))
                return true;
            // ── H-PRE-4: No FB stacking on a team training day at core ≥ 3 ──
            // When the week already has 3+ strength slots (enough for a
            // dedicated 2L+2U or 2L+1U split), placing FB on top of team
            // training creates redundant volume — the exact failure mode Sam
            // called out. FB stays legal at core ≤ 2, where FB+FB or FB+split
            // is the only way to hit every movement pattern.
            if (onTeamDay && c === 'FB' && core >= 3)
                return true;
            // ── H-PRE-3: Sprint conditioning not adjacent to a team day ──
            // Standalone sprint work the day before a team session leaves legs
            // unprepared for team sprints; the day after stacks neural + soft
            // tissue load while recovery is incomplete. Sprint (category='sprint'
            // on a COND slot, or an S+C slot the picker would pair with sprint)
            // is blocked on days adjacent to any team training day. Other
            // categories (aerobic_base, vo2, glycolytic) are still allowed.
            if (isPreSeason && adjacentTeamDay && c === 'COND') {
                const wouldPickCat = pickCondCategory(pos);
                if (wouldPickCat === 'sprint')
                    return true;
            }
            if (isPreSeason && adjacentTeamDay && c === 'S+C') {
                const wouldPickCat = pickCondCategory(pos);
                if (wouldPickCat === 'sprint')
                    return true;
            }
            // ── H-PRE-7: Block sprint / glycolytic on days SANDWICHED by team days ──
            // When prev AND next calendar days are BOTH team training days (e.g.
            // Tue+Thu team with a Wed slot), the middle day must be low-stress.
            // Sprint and glycolytic work on a sandwiched day taxes CNS + soft
            // tissue that still has team work on both sides — classic overlap
            // failure mode. Aerobic base / VO2 are still allowed (VO2 because
            // it is lower-intensity sustained work rather than true max-effort).
            // This is a stricter rule than H-PRE-3: H-PRE-3 blocks sprint
            // adjacent to any team day; H-PRE-7 additionally blocks glycolytic
            // when the day is sandwiched between two team days.
            if (isPreSeason && (c === 'COND' || c === 'S+C')) {
                const prevDay = (dayNum + 6) % 7;
                const nextDay = (dayNum + 1) % 7;
                const sandwichedBetweenTeam = teamDayNumSet.has(prevDay) && teamDayNumSet.has(nextDay);
                if (sandwichedBetweenTeam) {
                    const wouldPickCat = pickCondCategory(pos);
                    if (wouldPickCat === 'sprint' || wouldPickCat === 'glycolytic') {
                        return true;
                    }
                }
            }
            // H6: Core strength budget
            if (isStrength(c) && c !== 'COND') {
                const strengthCost = (c === 'S+C') ? 1 : (c === 'FB' ? 1 : 1);
                if (st.coreStrengthCount + strengthCost > core)
                    return true;
            }
            // H1: No 3+ consecutive calendar days of core strength
            if (isStrength(c)) {
                const runIfPlaced = isConsecutiveDay && st.prevSlotWasCore
                    ? st.consecutiveCoreCalendarDays + 1
                    : 1;
                if (runIfPlaced >= 3)
                    return true;
            }
            // ── H-PRE-5: No >3 consecutive core days in pre-season ──
            // Counts calendar-consecutive days that are either (a) team days
            // (immutable core), or (b) already-placed core sessions in `plan`,
            // including the candidate we're considering. If placing a
            // strength candidate here would produce a run of 4+, reject.
            // Conditioning candidates are NOT checked — they can be demoted
            // to optional post-validation to break streaks, so blocking them
            // here over-constrains placement.
            if (isPreSeason && isStrength(c)) {
                let streak = 1; // the candidate day itself
                // Walk backward
                for (let back = 1; back < 7; back++) {
                    const d = dayNum - back;
                    if (d < 0)
                        break;
                    const placed = plan.find(s => s.dayOfWeek && dayNameToNumber(s.dayOfWeek) === d);
                    const coreHere = teamDayNumSet.has(d) || (placed && placed.tier === 'core');
                    if (coreHere)
                        streak++;
                    else
                        break;
                }
                // Walk forward — only team days are known future-core
                for (let fwd = 1; fwd < 7; fwd++) {
                    const d = dayNum + fwd;
                    if (d > 6)
                        break;
                    if (teamDayNumSet.has(d))
                        streak++;
                    else
                        break;
                }
                if (streak >= 4)
                    return true;
            }
            // H3: Dedicated lower exposure separated by ≥1 calendar day
            // FB is NOT counted here — it's moderate load across all patterns,
            // not a dedicated lower session. FB → squat/hinge the next day is
            // valid and normal in off-season programming. L-co IS counted: it
            // loads both squat and hinge tissue at moderate-to-high dose, so
            // stacking it on consecutive days stacks lower tissue load.
            const isDedicatedLower = (c === 'L-sq' || c === 'L-hi' || c === 'L-co');
            if (isDedicatedLower && st.lastLowerDay >= 0) {
                if (pos - st.lastLowerDay < 2)
                    return true;
            }
            // H2: Same lower subtype separated by ≥2 calendar days
            if ((c === 'L-sq' || c === 'L-hi') && st.lastLowerSubtype === c) {
                if (st.lastLowerDay >= 0 && pos - st.lastLowerDay < 3)
                    return true;
            }
            // Budget for optional / recovery
            if (c === 'ACC' && st.optCount >= optional)
                return true;
            if (c === 'REC' && st.recCount >= recovery)
                return true;
            return false;
        }
        // ── Pick conditioning category (off-season / pre-season) ──
        //
        // Walks the priority order for the current phase. If `slotPos` is
        // supplied, a zone-aware preference is layered on top so the week
        // sequences intentionally:
        //   - early (first third)  → VO2 / glycolytic  (higher fatigue up front)
        //   - mid   (middle third) → sprint            (freshness-dependent quality)
        //   - late  (last third)   → aerobic base      (low-fatigue deload feel)
        //
        // Sprint protection: when the previous day was conditioning with a
        // vo2 or glycolytic category, sprint is skipped for the consecutive
        // slot so the athlete is fresh for neural work.
        //
        // Short-week fallback: on 4-day weeks the mid zone is a single slot
        // that often sits the day after an early vo2/glyco → sprint-blocked.
        // When that happens, sprint falls through Pass 2 and lands wherever
        // protection allows (typically late). Zone rule yields to protection.
        //
        // All four categories still get covered across the week — this only
        // changes which uncovered category is picked FIRST at a given slot.
        function pickCondCategory(slotPos) {
            const weekLen = daySlots.length;
            const zone = slotPos === undefined ? null
                : slotPos <= Math.ceil(weekLen / 3) ? 'early'
                    : slotPos <= Math.ceil((weekLen * 2) / 3) ? 'mid'
                        : 'late';
            // Zone priority encodes Sam's sequencing intent:
            //   early → high-fatigue first  (vo2 / glyco)
            //   mid   → quality sprint      (athlete should be relatively fresh)
            //   late  → aerobic base flush  (low-fatigue deload feel)
            //
            // Short-week bias: on ≤4-day weeks sprint has no room in a "middle"
            // slot that isn't adjacent to a vo2/glyco day, so it risks being
            // stranded by sprint-protection. Bias it EARLY so it lands before
            // the high-fatigue categories rather than after them. The week still
            // plays out early→high-fatigue→aerobic overall because slotPos 1
            // gets sprint and slotPos 2 gets vo2/glyco.
            const shortWeek = weekLen <= 4;
            const zonePriority = shortWeek ? {
                early: ['sprint', 'vo2', 'glycolytic', 'aerobic_base'],
                mid: ['vo2', 'glycolytic', 'aerobic_base', 'sprint'],
                late: ['aerobic_base', 'vo2', 'glycolytic', 'sprint'],
            } : {
                early: ['vo2', 'glycolytic', 'sprint', 'aerobic_base'],
                mid: ['sprint', 'vo2', 'glycolytic', 'aerobic_base'],
                late: ['aerobic_base', 'vo2', 'glycolytic', 'sprint'],
            };
            // Sprint protection — ABSOLUTE. Per Sam's explicit design rule,
            // sprint must never follow a vo2/glycolytic day, even if that means
            // sprint ends up duplicated or uncovered in a given week. Coverage
            // is secondary to recovery quality for sprint sessions.
            const isConsecutive = slotPos !== undefined && slotPos === st.lastCondDay + 1;
            const sprintBlocked = isConsecutive &&
                (st.lastCondCategory === 'vo2' || st.lastCondCategory === 'glycolytic');
            const allow = (c) => !(c === 'sprint' && sprintBlocked);
            // Pass 1 — zone priority among UNCOVERED categories (respecting block).
            if (zone) {
                for (const c of zonePriority[zone]) {
                    if (!allow(c))
                        continue;
                    if (st.condCategories[c] === 0)
                        return c;
                }
            }
            // Pass 2 — global phase priority among UNCOVERED categories (respecting block).
            for (const c of categoryPriority) {
                if (!allow(c))
                    continue;
                if (st.condCategories[c] === 0)
                    return c;
            }
            // Pass 3 — all non-sprint covered: return least-used (respecting sprint block).
            let best = categoryPriority[0];
            let bestCount = Infinity;
            for (const c of categoryPriority) {
                if (!allow(c))
                    continue;
                if (st.condCategories[c] < bestCount) {
                    bestCount = st.condCategories[c];
                    best = c;
                }
            }
            return best;
        }
        // ── Pick conditioning flavour for a slot ──
        function pickCondFlavour(slotPos) {
            // Off-season & pre-season: route through the category planner so
            // each week covers all 4 energy systems before duplicating. When
            // slotPos is provided, the category picker additionally applies
            // the weekly sequencing + sprint-protection rules.
            if (useCategoryPlanner) {
                const cat = pickCondCategory(slotPos);
                return categoryToFlavour(cat);
            }
            // Other phases: preserve legacy flavour balance behaviour.
            let best = 'aerobic';
            let bestCount = Infinity;
            for (const f of COND_FLAVOURS) {
                if (st.condFlavours[f] >= COND_FLAVOUR_CAPS[f])
                    continue;
                if (st.condFlavours[f] < bestCount) {
                    bestCount = st.condFlavours[f];
                    best = f;
                }
            }
            return best;
        }
        /**
         * For category-planner phases: resolve the category that a given
         * flavour represents in the CURRENT week, by walking the priority
         * list. Used at placement time — the flavour chosen by pickCondFlavour
         * corresponds to whichever priority-category slot still needs filling.
         * For flavours that map to more than one category (high-intensity →
         * sprint OR glycolytic), we pick the highest-priority uncovered
         * category first.
         */
        function flavourToSelectedCategory(f, slotPos) {
            if (!useCategoryPlanner) {
                // Legacy mapping when category planner isn't active.
                if (f === 'aerobic')
                    return 'aerobic_base';
                if (f === 'tempo')
                    return 'vo2';
                return 'glycolytic';
            }
            const candidates = f === 'aerobic' ? ['aerobic_base']
                : f === 'tempo' ? ['vo2']
                    : ['sprint', 'glycolytic']; // high-intensity
            // Sprint protection — ABSOLUTE. Must match pickCondCategory: sprint
            // is never scheduled the day after a vo2/glycolytic slot, regardless
            // of weekly coverage state. If the flavour chosen was "high-intensity"
            // and sprint is blocked, fall through to glycolytic.
            const isConsecutive = slotPos !== undefined && slotPos === st.lastCondDay + 1;
            const sprintBlocked = isConsecutive &&
                (st.lastCondCategory === 'vo2' || st.lastCondCategory === 'glycolytic');
            const allow = (c) => !(c === 'sprint' && sprintBlocked);
            // Walk the priority list to find the first uncovered candidate.
            for (const c of categoryPriority) {
                if (!allow(c))
                    continue;
                if (candidates.includes(c) && st.condCategories[c] === 0)
                    return c;
            }
            // Fallback: least-used from the candidates set (still respecting sprint block).
            let best = candidates[0];
            let bestCount = Infinity;
            for (const c of candidates) {
                if (!allow(c))
                    continue;
                if (st.condCategories[c] < bestCount) {
                    bestCount = st.condCategories[c];
                    best = c;
                }
            }
            return best;
        }
        // ── Soft preference scoring ──
        const W_PATTERN = 30; // per-pattern exposure need
        const W_OVERSHOOT = 15; // penalty for exceeding pattern target
        const W_BALANCE = 25; // missing-pattern urgency bonus
        const W_SPACING = 20; // spacing quality
        const W_TEAM_UPPER = 10; // upper on team day
        const W_TEAM_LOWER = 5; // lower on team day penalty
        const W_COMBINED = 12; // S+C combined day bonus
        const W_FATIGUE_WAVE = 5; // early-week strength, late-week deload
        const W_VARIETY = 10; // same-subtype penalty / alternation bonus
        const W_COND_FLAVOUR = 8; // conditioning flavour balance (legacy phases)
        const W_COND_CATEGORY = 18; // conditioning category coverage (off/pre-season)
        const W_COND_CATEGORY_DUP = 35; // penalty: duplicate category while others uncovered
        const W_COND_EXPOSURE = 30; // conditioning exposure need
        const W_REGION_CONSECUTIVE = 45; // penalty: same region on consecutive days
        const W_SEQUENCING = 10; // zone-matched conditioning (early/mid/late)
        const W_SEQUENCING_MISS = 6; // penalty for wrong-zone conditioning
        const W_SPRINT_MIDWEEK_BONUS = 6; // extra nudge to land sprint in mid zone
        const W_SPRINT_OFFZONE = 3; // soft penalty for sprint in early/late zones
        const W_SPRINT_BLOCK = 40; // HARD-STYLE penalty: sprint the day after vo2/glyco
        const W_SC_PAIRING_GOOD = 10; // preferred S+C pairing (lower+aerobic, upper+vo2)
        // Bad-pairing penalty raised from 12 → 20 per Sam's refinement goal
        // of keeping bad pairings <20% of combined days. The combined
        // conditioning builder still auto-swaps to ergometer modality
        // (SkiErg / Rower / Bike) when forced into a lower+sprint/glyco
        // pairing, so the legs-twice problem is mitigated; this penalty
        // strength pushes pattern selection toward better pairings WHEN
        // CHOICE EXISTS, without overriding category coverage (top rule).
        const W_SC_PAIRING_BAD = 35; // soft penalty for lower+glyco / lower+sprint
        const W_SEQUENCE_REGION = 25; // H-PRE-10: standalone-slot region preference vs team-day upper
        // Helper: count for a specific pattern
        function patternCount(c) {
            switch (c) {
                case 'L-sq': return st.sqCount;
                case 'L-hi': return st.hiCount;
                case 'U-pu': return st.puCount;
                case 'U-pl': return st.plCount;
                default: return 0;
            }
        }
        function scoreCandidate(c, slot, slotIndex) {
            let score = 0;
            const pos = trainingOrder(slot.num);
            const strengthSlotsLeft = core - st.coreStrengthCount;
            // ── Effective strength region ───────────────────────────────────────
            // Region-based rules (e.g. H-PRE-10) must operate on the strength
            // region actually being placed, not the candidate token. A pure
            // strength candidate carries its own region; an S+C candidate carries
            // whatever scStrength pickSCStrengthType would select for this slot.
            // If region rules gated on `c` alone, S+C with scStrength='U-pu'
            // would bypass Upper penalties and land Upper on days that region
            // sequencing meant to protect for Lower.
            const effectiveRegion = (c === 'U-pu' || c === 'U-pl' || c === 'U-co')
                ? 'upper'
                : (c === 'L-sq' || c === 'L-hi' || c === 'L-co')
                    ? 'lower'
                    : c === 'S+C'
                        ? (() => {
                            const sc = pickSCStrengthType(pos);
                            if (sc === 'U-pu' || sc === 'U-pl' || sc === 'U-co')
                                return 'upper';
                            if (sc === 'L-sq' || sc === 'L-hi' || sc === 'L-co')
                                return 'lower';
                            return null;
                        })()
                        : null;
            // ── Pattern exposure need ──
            // Each pattern (sq, hi, pu, pl) gets an equal share of core budget.
            // Score based on per-pattern deficit from that share.
            if (c === 'L-sq' || c === 'L-hi' || c === 'U-pu' || c === 'U-pl') {
                const myCount = patternCount(c);
                const deficit = patternShare - myCount;
                score += deficit > 0 ? W_PATTERN * Math.min(deficit, 1) : -W_OVERSHOOT;
            }
            // Combined-region sessions contribute 0.5 to each sub-pattern.
            // Reward L-co when at least one of (sq, hi) is uncovered; reward
            // U-co when at least one of (pu, pl) is uncovered.
            if (c === 'L-co') {
                const lowerDeficit = (st.sqCount === 0 ? 1 : 0) + (st.hiCount === 0 ? 1 : 0);
                score += lowerDeficit > 0 ? W_PATTERN * 0.75 * lowerDeficit : -W_OVERSHOOT * 0.5;
            }
            if (c === 'U-co') {
                const upperDeficit = (st.puCount === 0 ? 1 : 0) + (st.plCount === 0 ? 1 : 0);
                score += upperDeficit > 0 ? W_PATTERN * 0.75 * upperDeficit : -W_OVERSHOOT * 0.5;
            }
            if (c === 'FB') {
                // FB covers all 4 patterns partially — valuable when patterns are missing
                const missingPatterns = [st.sqCount, st.hiCount, st.puCount, st.plCount]
                    .filter(x => x === 0).length;
                if (missingPatterns >= 2 && missingPatterns > strengthSlotsLeft) {
                    // More missing patterns than remaining strength slots → FB is efficient
                    score += W_BALANCE * missingPatterns * 0.75;
                }
                else if (core <= 2) {
                    // Low-core weeks benefit from FB coverage
                    score += W_PATTERN * 0.5;
                }
                else {
                    // Dedicated pattern sessions preferred over FB when slots allow
                    score -= W_OVERSHOOT * 0.5;
                }
            }
            // ── H-PRE-6 sequence guard: FB must not PRE-LOAD a heavy day ──
            //
            // In pre-season core=3 weeks the FB slot is a SUPPORT session. The
            // failure mode Sam flagged is FB SITTING BEFORE a heavy day:
            //   Mon FB  →  Tue Team+Upper   (FB upper primes a full upper day)
            //   Fri FB  →  Sat Lower        (FB lower primes a dedicated lower)
            // The asymmetric rule: penalise FB when the NEXT day is a team day,
            // a dedicated lower, or a dedicated upper. FB AFTER a heavy day is
            // tolerable — the light full-body dose acts like active recovery
            // rather than pre-loading the next hard exposure.
            //
            // Mirror rule: when placing a dedicated L/U after an already-placed
            // FB, the same "FB precedes heavy" anti-pattern holds → penalise.
            if (isPreSeason && hasTeamDays && core === 3) {
                const W_FB_ADJACENT = 40; // strong — comparable to W_REGION_CONSECUTIVE
                const regionOnDay = (dayNum) => {
                    if (teamDayNumSet.has(dayNum))
                        return 'TEAM';
                    const entry = plan.find(s => s.dayOfWeek && dayNameToNumber(s.dayOfWeek) === dayNum);
                    if (!entry || entry.tier !== 'core')
                        return null;
                    const f = entry.focus;
                    if (/^Full body/i.test(f))
                        return 'FB';
                    if (/squat emphasis|Hip-dominant lower|quad-dominant main/i.test(f))
                        return 'L';
                    if (/push emphasis|pull emphasis|combined push \+ pull/i.test(f))
                        return 'U';
                    return null;
                };
                const isHeavyNeighbour = (r) => r === 'L' || r === 'U' || r === 'TEAM';
                const prev = regionOnDay(slot.num - 1);
                const next = regionOnDay(slot.num + 1);
                // Placing FB with a heavy NEXT day → FB pre-loads → penalty.
                if (c === 'FB' && isHeavyNeighbour(next))
                    score -= W_FB_ADJACENT;
                // Placing a dedicated L/U with FB on the PREV day → same
                // "FB precedes heavy" pattern, detected from the other side.
                const isDedicatedStrength = c === 'L-sq' || c === 'L-hi' || c === 'L-co' ||
                    c === 'U-pu' || c === 'U-pl' || c === 'U-co';
                if (isDedicatedStrength && prev === 'FB')
                    score -= W_FB_ADJACENT;
            }
            if (isConditioning(c)) {
                const condCredit = c === 'S+C' ? 0.75 : 1.0;
                const deficit = condTarget - st.condCount;
                score += deficit > 0 ? W_COND_EXPOSURE * Math.min(deficit, condCredit) : -W_OVERSHOOT;
            }
            // S+C also adds a strength pattern — score the pattern coverage value
            if (c === 'S+C') {
                // The strength component will be picked by pickSCStrengthType.
                // Bonus if there are missing patterns we can fill.
                const missingPatterns = [st.sqCount, st.hiCount, st.puCount, st.plCount]
                    .filter(x => x === 0).length;
                if (missingPatterns > 0)
                    score += W_PATTERN * 0.5;
            }
            // ── Conditioning urgency: S+C is REQUIRED when standalone slots are scarce ──
            // "Think like a coach": if there's no room for standalone conditioning,
            // combine strength + conditioning into the same session. This is not a
            // bonus — it's a structural necessity.
            if (c === 'S+C') {
                const totalSlotsLeft = daySlots.length - slotIndex;
                const strengthBudgetLeft = core - st.coreStrengthCount;
                const standaloneLeft = Math.max(0, totalSlotsLeft - strengthBudgetLeft);
                const condDeficit = condTarget - st.condCount;
                const condFloorRemaining = Math.max(0, MIN_COND_FLOOR - st.condCount);
                if (condFloorRemaining > 0 && standaloneLeft < Math.ceil(condFloorRemaining)) {
                    // Can't reach minimum conditioning without combined days — S+C is mandatory
                    score += W_COND_EXPOSURE * 2.0;
                }
                else if (condDeficit > 0 && standaloneLeft < condDeficit) {
                    // Not enough standalone slots for full target — strongly prefer S+C
                    score += W_COND_EXPOSURE * 1.0;
                }
            }
            // ── Penalize pure strength when conditioning is starving ──
            // If choosing a pure strength session in this slot would leave insufficient
            // room for conditioning, penalize it so S+C wins instead.
            if (STRENGTH_CANDIDATES.includes(c) && c !== 'S+C') {
                const totalSlotsLeft = daySlots.length - slotIndex;
                const strengthBudgetLeft = core - st.coreStrengthCount;
                const standaloneLeft = Math.max(0, totalSlotsLeft - strengthBudgetLeft);
                const condFloorRemaining = Math.max(0, MIN_COND_FLOOR - st.condCount);
                if (condFloorRemaining > 0 && standaloneLeft < Math.ceil(condFloorRemaining)) {
                    // Taking this as pure strength makes conditioning impossible to fit
                    score -= W_COND_EXPOSURE * 1.0;
                }
            }
            if (c === 'ACC')
                score += 5;
            if (c === 'REC')
                score += 3;
            // ── Global pattern balance urgency ──
            // Strong bonus for placing a pattern that hasn't appeared yet.
            // Urgency increases dramatically as remaining strength slots decrease.
            if (core >= 3 && (c === 'L-sq' || c === 'L-hi' || c === 'U-pu' || c === 'U-pl')) {
                const myCount = patternCount(c);
                if (myCount === 0) {
                    const missingPatterns = [st.sqCount, st.hiCount, st.puCount, st.plCount]
                        .filter(x => x === 0).length;
                    // Urgency: how tight are we on slots vs missing patterns?
                    // If missingPatterns > strengthSlotsLeft, we can't cover everything
                    // individually — panic mode.
                    const urgency = missingPatterns > strengthSlotsLeft ? 2.5 : 1.0;
                    score += W_BALANCE * urgency;
                }
                else if (myCount >= 1) {
                    // Already have this pattern — penalize duplication when other patterns missing
                    const missingPatterns = [st.sqCount, st.hiCount, st.puCount, st.plCount]
                        .filter(x => x === 0).length;
                    if (missingPatterns > 0)
                        score -= W_BALANCE * 0.5;
                }
            }
            // ── Spacing quality (region-based) ──
            if (isLower(c)) {
                const gap = st.lastLowerDay >= 0 ? pos - st.lastLowerDay : 99;
                if (gap >= 3)
                    score += W_SPACING;
                else if (gap >= 2)
                    score += W_SPACING * 0.5;
            }
            if (isUpper(c)) {
                const gap = st.lastUpperDay >= 0 ? pos - st.lastUpperDay : 99;
                if (gap >= 3)
                    score += W_SPACING;
                else if (gap >= 2)
                    score += W_SPACING * 0.5;
            }
            if (isConditioning(c)) {
                const gap = st.lastCondDay >= 0 ? pos - st.lastCondDay : 99;
                if (gap >= 2)
                    score += W_SPACING * 0.5;
            }
            // ── Region consecutive penalty ──
            // Push/pull are both upper body; squat/hinge are both lower body.
            // Placing two same-region sessions on consecutive days clusters stimulus
            // and hinders recovery. Penalize heavily to force interleaving U/L.
            // FB is neutral (full body doesn't cluster one region).
            if ((c === 'U-pu' || c === 'U-pl') && st.lastUpperDay >= 0 && pos - st.lastUpperDay < 2) {
                score -= W_REGION_CONSECUTIVE;
            }
            if ((c === 'L-sq' || c === 'L-hi') && st.lastLowerDay >= 0 && pos - st.lastLowerDay < 2) {
                score -= W_REGION_CONSECUTIVE;
            }
            // S+C inherits region from its strength component
            if (c === 'S+C') {
                const scType = pickSCStrengthType(pos);
                if ((scType === 'U-pu' || scType === 'U-pl') && st.lastUpperDay >= 0 && pos - st.lastUpperDay < 2) {
                    score -= W_REGION_CONSECUTIVE;
                }
                if ((scType === 'L-sq' || scType === 'L-hi') && st.lastLowerDay >= 0 && pos - st.lastLowerDay < 2) {
                    score -= W_REGION_CONSECUTIVE;
                }
            }
            // ── Team day preference ──
            if (slot.isTeamDay) {
                if (isUpper(c) || c === 'FB')
                    score += W_TEAM_UPPER;
                if (isLower(c) && c !== 'FB')
                    score -= W_TEAM_LOWER;
            }
            // ── Pre-season team-day shaping ──
            // In pre-season, team days are PRIMARY CORE anchors. Hard rules in
            // violatesHard() already block COND / S+C / dedicated lower on a
            // team day. Here the scorer strongly prefers a light upper session
            // (core) layered on top of team training. Sam's pre-season ruleset
            // says: "Strength allowed on team days = upper or light full body
            // only" — so upper wins decisively, FB is a weak fallback, and
            // ACC/REC are only chosen when no strength pattern is needed (e.g.
            // budget already met).
            if (isPreSeason && slot.isTeamDay) {
                // Upper dominates — team day + upper is the default pairing.
                // Both dedicated upper and combined upper (U-co) qualify; the
                // combined-upper variant is the correct placement when the week
                // only has room for one upper slot.
                if (c === 'U-pu' || c === 'U-pl' || c === 'U-co')
                    score += 30;
                // FB penalised on team days when core ≥ 3: if the week already
                // has dedicated lower + upper slots elsewhere, stacking FB on a
                // team day creates redundant full-body volume (Sam's complaint).
                // When core ≤ 2 we leave FB neutral — it may be the only way to
                // hit all movement patterns.
                if (c === 'FB') {
                    score += core >= 3 ? -20 : 2;
                }
                // Accessories / recovery still allowed on team days when strength
                // budget is exhausted, but they lose to upper strength when there
                // is still pattern coverage work to do.
                if (c === 'ACC') {
                    const strengthBudgetLeft = core - st.coreStrengthCount;
                    // If strength budget remains, strongly deprioritise ACC so an
                    // upper strength session wins; if budget is spent, ACC is the
                    // natural fill for remaining team-day slots.
                    score += strengthBudgetLeft > 0 ? -15 : 8;
                }
                if (c === 'REC') {
                    const strengthBudgetLeft = core - st.coreStrengthCount;
                    score += strengthBudgetLeft > 0 ? -20 : 4;
                }
            }
            // ── Pre-season sprint-adjacency penalty ──
            // Soft reinforcement of H-PRE-3 — if the hard constraint somehow
            // doesn't fire (e.g. category flips between scoring and placement),
            // the scorer still pushes non-sprint options ahead.
            if (isPreSeason && isConditioning(c) && isAdjacentToTeamDay(pos)) {
                const pickedCat = pickCondCategory(pos);
                if (pickedCat === 'sprint')
                    score -= W_SPRINT_BLOCK;
            }
            // ── H-PRE-7 placement penalty: sandwiched day between two team days ──
            // Belt-and-suspenders for the hard rule in violatesHard(): if a
            // conditioning candidate with sprint or glycolytic flavour would
            // otherwise score highly on a day with team training on BOTH sides,
            // crush the score so a safer flavour (aerobic base / VO2) wins.
            if (isPreSeason && isConditioning(c)) {
                const dayNum = slot.num;
                const prevDay = (dayNum + 6) % 7;
                const nextDay = (dayNum + 1) % 7;
                const sandwichedBetweenTeam = teamDayNumSet.has(prevDay) && teamDayNumSet.has(nextDay);
                if (sandwichedBetweenTeam) {
                    const pickedCat = pickCondCategory(pos);
                    if (pickedCat === 'sprint' || pickedCat === 'glycolytic') {
                        score -= 50;
                    }
                }
            }
            // ── H-PRE-10: region sequencing (pre-season 4-exposure regime) ──
            //
            // In the pre-season 4-exposure regime (core=4, ≥2 team days, no game,
            // ≥5 days), team days are core anchors that almost always host Upper
            // (H-PRE-2 blocks dedicated lower on team days; W_TEAM_UPPER + the
            // pre-season team-day shaping block favour upper strength). That
            // means standalone strength slots should carry LOWER, not Upper —
            // placing a standalone Upper before a team-day Upper produces an
            // Upper-Upper cluster at the start of the week, and leaves the
            // remaining Lower slots to clump at the end (U, Team+U, _, L, L).
            //
            // Sam flagged the exact failure: Mon=U-pu, Tue=Team+U-pl, Fri=L-sq,
            // Sat=L-hi. The queue is correct (2L+2U) but the sequence clusters.
            // This rule tips placement decisions toward alternating/interleaved
            // regions by:
            //   1. Rewarding Lower on any standalone (non-team) strength slot.
            //   2. Penalising standalone Upper while team days are still unplaced
            //      (those upcoming team days will carry Upper themselves).
            //   3. Extra nudge for the FIRST standalone slot BEFORE the first
            //      team day — that slot should strongly prefer Lower so the
            //      week opens L → Team+U rather than U → Team+U.
            //
            // Weight sized so it wins against W_VARIETY alternation (10) and
            // pattern-deficit tie-breakers but stays below W_REGION_CONSECUTIVE
            // (45) so it doesn't override the spacing guard.
            //
            // Gated to core === 4 only. At core=3 the H-PRE-6 regime is already
            // 1L + 1U + FB — no cluster is possible by construction, and adding
            // a lower-preference on the standalone slot can force the single FB
            // into a pre-team pre-load position (breaking H-PRE-6 adjacency).
            if (isPreSeason && hasTeamDays && core === 4 && !slot.isTeamDay) {
                // Count team days not yet placed into `plan`. Placement iterates
                // in training-order, so unplaced team days are always those whose
                // training-order position comes after the current slot.
                const placedTeamDayCount = plan.filter(s => s.tier === 'core' && s.dayOfWeek
                    && teamDayNumSet.has(dayNameToNumber(s.dayOfWeek))).length;
                const upcomingTeamDays = teamDayNumSet.size - placedTeamDayCount;
                // Use effectiveRegion (computed above) so S+C candidates are classed
                // by their scStrength region — closes the H-PRE-10 bypass where an
                // S+C with scStrength='U-pu' was treated as region-neutral and
                // landed Upper strength on a slot that should have carried Lower.
                //
                // (1) Standalone Upper while team days will still host Upper →
                //     redundant cluster. Penalty scales with unplaced team days.
                if (effectiveRegion === 'upper' && upcomingTeamDays > 0) {
                    score -= W_SEQUENCE_REGION;
                }
                // (2) Standalone Lower complements team-upper days → reward.
                if (effectiveRegion === 'lower') {
                    score += W_SEQUENCE_REGION * 0.5;
                }
                // (3) First standalone slot BEFORE the first team day: extra nudge.
                //     firstTeamPos uses trainingOrder so Sunday-last weeks resolve
                //     correctly (Sun→7). In the canonical 2L+2U queue the two
                //     team days consume both Upper items, leaving standalone slots
                //     to carry Lower — this rule strengthens that choice for the
                //     very first slot (the highest-leverage anti-cluster decision).
                const teamPositions = Array.from(teamDayNumSet).map(trainingOrder);
                const firstTeamPos = Math.min.apply(null, teamPositions);
                if (pos < firstTeamPos) {
                    if (effectiveRegion === 'lower')
                        score += W_SEQUENCE_REGION * 0.5;
                    if (effectiveRegion === 'upper')
                        score -= W_SEQUENCE_REGION * 0.5;
                }
            }
            // ── Combined day bonus ──
            if (c === 'S+C') {
                const condDeficit = condTarget - st.condCount;
                if (condDeficit > 0) {
                    const canHandle = inputs.conditioningLevel === 'Good' || inputs.conditioningLevel === 'Elite';
                    score += canHandle ? W_COMBINED : W_COMBINED * 0.5;
                }
            }
            // ── Fatigue wave ──
            if (pos <= 3 && isStrength(c))
                score += W_FATIGUE_WAVE;
            if (pos >= 6 && (c === 'COND' || c === 'REC' || c === 'ACC'))
                score += W_FATIGUE_WAVE;
            // ── Variety ──
            if (st.lastCoreSubtype === c && isStrength(c))
                score -= W_VARIETY;
            // ── Subtype alternation ──
            if (c === 'U-pl' && st.lastUpperSubtype === 'U-pu')
                score += W_VARIETY;
            if (c === 'U-pu' && st.lastUpperSubtype === 'U-pl')
                score += W_VARIETY;
            if (c === 'L-hi' && st.lastLowerSubtype === 'L-sq')
                score += W_VARIETY;
            if (c === 'L-sq' && st.lastLowerSubtype === 'L-hi')
                score += W_VARIETY;
            // ── Conditioning category / flavour balance ──
            if (isConditioning(c)) {
                if (useCategoryPlanner) {
                    // Off-season / Pre-season: the week should cover all 4 energy-system
                    // categories distinctly before any duplicates. Reward conditioning
                    // slots that fill an uncovered category, penalise ones that would
                    // duplicate a covered category while gaps remain.
                    const pickedCat = pickCondCategory(pos);
                    const ALL_CATS = ['aerobic_base', 'sprint', 'vo2', 'glycolytic'];
                    const uncovered = ALL_CATS.filter(cat => st.condCategories[cat] === 0).length;
                    if (st.condCategories[pickedCat] === 0) {
                        // Filling an uncovered slot — urgency scales with gaps.
                        score += W_COND_CATEGORY + uncovered * 3;
                    }
                    else if (uncovered > 0) {
                        // All picks would hit a covered category but uncovered ones
                        // remain — heavy penalty. The category planner shouldn't reach
                        // here unless every uncovered category is structurally impossible.
                        score -= W_COND_CATEGORY_DUP;
                    }
                    // ── Weekly sequencing bonus ──
                    // Reward conditioning slots that fall in their "natural" zone:
                    //   early → vo2 / glycolytic (higher fatigue up front)
                    //   mid   → sprint           (freshness-dependent neural quality)
                    //   late  → aerobic_base     (low fatigue, flush volume)
                    // Short weeks can still strand sprint after vo2/glyco; when
                    // protection wins we accept a zone miss (sprint will slide
                    // elsewhere) rather than penalising it heavily.
                    const weekLen = daySlots.length;
                    const zone = pos <= Math.ceil(weekLen / 3) ? 'early'
                        : pos <= Math.ceil((weekLen * 2) / 3) ? 'mid'
                            : 'late';
                    const zoneFavoured = {
                        early: ['vo2', 'glycolytic'],
                        mid: ['sprint'],
                        late: ['aerobic_base'],
                    };
                    if (zoneFavoured[zone].includes(pickedCat)) {
                        score += W_SEQUENCING;
                        // Sprint mid-week preference — reinforce. When sprint lands in
                        // its preferred zone we ADD extra weight beyond the generic
                        // zone bonus, making "mid-week sprint" sticky against other
                        // late-stage tie-breakers. Sam's explicit rule: prefer placing
                        // sprint mid-week when possible, even under constraints.
                        if (pickedCat === 'sprint' && zone === 'mid') {
                            score += W_SPRINT_MIDWEEK_BONUS;
                        }
                    }
                    else if (zone === 'late' && (pickedCat === 'vo2' || pickedCat === 'glycolytic')) {
                        // Late-week high-intensity conditioning is the worst-case — the
                        // athlete should be freshest early week for this. Penalise.
                        score -= W_SEQUENCING_MISS;
                    }
                    else if (pickedCat === 'sprint' && zone !== 'mid') {
                        // Soft nudge: prefer sprint in mid over early/late, without
                        // overriding sprint-protection or category coverage. Weaker
                        // than W_SPRINT_MIDWEEK_BONUS — just tips ties.
                        score -= W_SPRINT_OFFZONE;
                    }
                    // ── Sprint protection ──
                    // Heavy penalty if picking sprint the day immediately after a
                    // vo2/glyco conditioning session. Acts as a soft hard constraint.
                    const isConsecutive = pos === st.lastCondDay + 1;
                    const sprintBlocked = isConsecutive &&
                        (st.lastCondCategory === 'vo2' || st.lastCondCategory === 'glycolytic');
                    if (sprintBlocked && pickedCat === 'sprint') {
                        score -= W_SPRINT_BLOCK;
                    }
                }
                else {
                    // In-season / Finals: legacy flavour-balance behaviour.
                    const flavour = pickCondFlavour();
                    const lowestCount = Math.min(...COND_FLAVOURS.map(f => st.condFlavours[f]));
                    if (st.condFlavours[flavour] === lowestCount)
                        score += W_COND_FLAVOUR;
                }
            }
            // ── S+C pairing rules ──
            // Combined days couple strength-region + conditioning-category. Some
            // pairings compound fatigue badly (heavy lower + glycolytic — hammers
            // legs twice), others complement each other (lower + aerobic base
            // flushes volume, upper + vo2 keeps the intense work off the legs).
            if (c === 'S+C' && useCategoryPlanner) {
                // Peek at what the picker would pair — we only know after we build
                // the S+C allocation, but pickCondCategory is side-effect-free so
                // we can ask it now using the slot's position.
                const pairedCat = pickCondCategory(pos);
                const scStrength = pickSCStrengthType(pos);
                const isLowerSC = isLower(scStrength) && scStrength !== 'FB';
                const isUpperSC = isUpper(scStrength);
                const isFullSC = scStrength === 'FB';
                // Bad pairings
                if (isLowerSC && pairedCat === 'glycolytic')
                    score -= W_SC_PAIRING_BAD;
                if (isLowerSC && pairedCat === 'sprint')
                    score -= W_SC_PAIRING_BAD;
                // Good pairings
                if (isLowerSC && pairedCat === 'aerobic_base')
                    score += W_SC_PAIRING_GOOD;
                if (isUpperSC && pairedCat === 'vo2')
                    score += W_SC_PAIRING_GOOD;
                if (isFullSC && pairedCat === 'glycolytic')
                    score += W_SC_PAIRING_GOOD;
            }
            return score;
        }
        // ── Build focus string for a candidate ──
        //
        // Pre-season + team days + core=3 (H-PRE-6): the FB slot is a LIGHTER
        // support session, not a third heavy anchor. Team training already
        // supplies field lower load, and the week's dedicated L + U carry
        // the main strength stress — FB only exists to cover any missing
        // sub-patterns and add movement balance. The focus string reflects
        // that explicitly so downstream prescription + athlete UI both
        // treat it as support rather than a hard exposure.
        function buildFocus(c, flavour) {
            const isFbSupport = isPreSeason && hasTeamDays && core === 3;
            switch (c) {
                case 'L-sq': return 'Lower body — squat emphasis (quad-dominant: squat, lunge, leg press)';
                case 'L-hi': return 'Hip-dominant lower (RDL, hip thrust, hamstring curl)';
                case 'U-pu': return 'Upper body — push emphasis (bench, OHP, dips)';
                case 'U-pl': return 'Upper body — pull emphasis (rows, pull-ups, face pulls)';
                case 'FB': return isFbSupport
                    ? 'Full body support — light load, balance and movement-pattern coverage (not a heavy lower or upper day)'
                    : 'Full body — moderate load, cover all movement patterns (1 squat/hinge + 1 push + 1 pull)';
                case 'L-co': return 'Lower body — combined squat + hinge (quad-dominant main + hip-dominant assistance in one session)';
                case 'U-co': return 'Upper body — combined push + pull (horizontal + vertical, balanced load)';
                case 'COND': {
                    const fl = flavour || 'aerobic';
                    if (fl === 'aerobic')
                        return 'Conditioning — aerobic base / zone 2 (steady state, conversational pace)';
                    if (fl === 'tempo')
                        return 'Conditioning — tempo / repeat effort (threshold work, controlled intensity)';
                    return 'Conditioning — high intensity intervals (short, hard repeats with short rest)';
                }
                case 'S+C': {
                    // Focus string is set by the strength component; conditioning is appended
                    return ''; // placeholder — overridden below
                }
                case 'ACC': return 'Low-fatigue accessories — trunk, calves, groin, shoulder prehab';
                case 'REC': return 'Mobility, foam rolling, light movement';
                default: return '';
            }
        }
        // ── Determine strength subtype for S+C ──
        // Position-aware: avoids picking a type that creates consecutive same-region.
        function pickSCStrengthType(currentPos) {
            // Peek at the conditioning category that would pair with this slot
            // so we can bias pattern selection toward non-lower when pairing
            // against sprint or glycolytic (protects the legs from a double hit
            // even with ergometer swap). Only a tie-breaker — pattern coverage
            // and region spacing still win.
            const pairedCat = useCategoryPlanner
                ? pickCondCategory(currentPos)
                : null;
            const avoidLower = pairedCat === 'sprint' || pairedCat === 'glycolytic';
            // In structure mode: pick from the remaining queue items
            if (useStructureMode && strengthQueue.length > 0) {
                const available = [...new Set(strengthQueue)];
                // Sort: lowest pattern count first, then pairing bias, then region
                // spacing, then alternation. Pairing bias ranks ABOVE region spacing
                // because a bad sprint/glyco+lower pairing hammers the legs within
                // the same session, whereas consecutive-day same-region just
                // squeezes recovery — we'd rather accept tighter recovery than a
                // legs-twice single session.
                available.sort((a, b) => {
                    const aCount = patternCount(a);
                    const bCount = patternCount(b);
                    if (aCount !== bCount)
                        return aCount - bCount;
                    // Category-aware pairing bias: when conditioning is sprint or
                    // glycolytic, prefer non-lower strength patterns (upper / FB)
                    // to reduce bad pairings.
                    if (avoidLower) {
                        const aIsLower = isLower(a) && a !== 'FB';
                        const bIsLower = isLower(b) && b !== 'FB';
                        if (aIsLower !== bIsLower)
                            return aIsLower ? 1 : -1;
                    }
                    // Region spacing: avoid consecutive same-region
                    // If placing upper here and last was upper (gap < 2), penalize.
                    // Same for lower. This prevents push→pull or squat→hinge clustering.
                    if (currentPos !== undefined) {
                        const aIsUpper = (a === 'U-pu' || a === 'U-pl');
                        const aIsLower = (a === 'L-sq' || a === 'L-hi');
                        const bIsUpper = (b === 'U-pu' || b === 'U-pl');
                        const bIsLower = (b === 'L-sq' || b === 'L-hi');
                        const aConsec = (aIsUpper && st.lastUpperDay >= 0 && currentPos - st.lastUpperDay < 2)
                            || (aIsLower && st.lastLowerDay >= 0 && currentPos - st.lastLowerDay < 2);
                        const bConsec = (bIsUpper && st.lastUpperDay >= 0 && currentPos - st.lastUpperDay < 2)
                            || (bIsLower && st.lastLowerDay >= 0 && currentPos - st.lastLowerDay < 2);
                        if (aConsec !== bConsec)
                            return aConsec ? 1 : -1; // prefer non-consecutive
                    }
                    // Alternation preference
                    const aAlt = isLower(a)
                        ? (st.lastLowerSubtype !== null && st.lastLowerSubtype !== a)
                        : (st.lastUpperSubtype !== null && st.lastUpperSubtype !== a);
                    const bAlt = isLower(b)
                        ? (st.lastLowerSubtype !== null && st.lastLowerSubtype !== b)
                        : (st.lastUpperSubtype !== null && st.lastUpperSubtype !== b);
                    if (aAlt !== bAlt)
                        return aAlt ? -1 : 1;
                    return 0; // No upper-over-lower bias in off-season
                });
                return available[0];
            }
            // Free-form fallback (core ≥ 5): original pattern-balance logic
            const patterns = [
                {
                    type: 'L-sq', count: st.sqCount,
                    alternates: st.lastLowerSubtype !== null && st.lastLowerSubtype !== 'L-sq',
                },
                {
                    type: 'L-hi', count: st.hiCount,
                    alternates: st.lastLowerSubtype !== null && st.lastLowerSubtype !== 'L-hi',
                },
                {
                    type: 'U-pu', count: st.puCount,
                    alternates: st.lastUpperSubtype !== null && st.lastUpperSubtype !== 'U-pu',
                },
                {
                    type: 'U-pl', count: st.plCount,
                    alternates: st.lastUpperSubtype !== null && st.lastUpperSubtype !== 'U-pl',
                },
            ];
            patterns.sort((a, b) => {
                if (a.count !== b.count)
                    return a.count - b.count;
                if (a.alternates !== b.alternates)
                    return a.alternates ? -1 : 1;
                return 0;
            });
            return patterns[0].type;
        }
        // ── Main scoring loop ──
        for (let slotIdx = 0; slotIdx < daySlots.length; slotIdx++) {
            const slot = daySlots[slotIdx];
            let bestCandidate = 'REC';
            let bestScore = -Infinity;
            let bestFlavour;
            let bestSCStrength;
            // ── Queue completion enforcement ──
            // If remaining slots == remaining queue items, every remaining slot
            // MUST place a strength session. Override rest slots and soft preferences.
            const slotsRemaining = daySlots.length - slotIdx;
            const queueMustComplete = useStructureMode && strengthQueue.length > 0
                && strengthQueue.length >= slotsRemaining;
            // Build candidate list: in structure mode, limit strength to queue items.
            // Rest slots only allow COND/ACC/REC — UNLESS queue completion is forced.
            const isRestSlot = restSlotIndices.has(slotIdx) && !queueMustComplete;
            let slotCandidates;
            if (isRestSlot) {
                // Rest/conditioning slot — no strength allowed
                slotCandidates = ['COND', 'ACC', 'REC'];
            }
            else if (useStructureMode) {
                const uniqueStrength = [...new Set(strengthQueue)];
                if (queueMustComplete) {
                    // Must place strength — only strength candidates + S+C
                    slotCandidates = [
                        ...uniqueStrength,
                        ...(uniqueStrength.length > 0 ? ['S+C'] : []),
                    ];
                }
                else {
                    slotCandidates = [
                        ...uniqueStrength,
                        'COND',
                        ...(uniqueStrength.length > 0 ? ['S+C'] : []),
                        'ACC', 'REC',
                    ];
                }
            }
            else {
                slotCandidates = [...ALL_CANDIDATES];
            }
            for (const candidate of slotCandidates) {
                // In queue-must-complete mode, relax H3 (lower spacing) to avoid
                // dropping required movements. H1 (3+ consecutive) and H2 (same
                // subtype spacing) still enforced — they protect against injury.
                if (queueMustComplete) {
                    // Only enforce H1, H2, H6 — skip H3.
                    // Pre-season team-day guards (H-PRE-1/2) are ALWAYS enforced, even
                    // in queue-must-complete mode: stacking team + lower or team + S+C
                    // is the exact failure mode Sam called out.
                    const pos2 = trainingOrder(slot.num);
                    const isConsec = pos2 === st.prevSlotDayNum + 1;
                    const onTeamDay2 = isPreSeason && teamDayNumSet.has(slot.num);
                    // H-PRE-1: no conditioning on team day
                    if (onTeamDay2 && (candidate === 'COND' || candidate === 'S+C'))
                        continue;
                    // H-PRE-2: no heavy lower on team day — includes L-co (combined
                    // lower still fully loads both squat and hinge tissue).
                    if (onTeamDay2 && isHeavyLower(candidate))
                        continue;
                    // H-PRE-4: no FB stacking on team day at core ≥ 3
                    if (onTeamDay2 && candidate === 'FB' && core >= 3)
                        continue;
                    // H6: budget
                    if (isStrength(candidate) && candidate !== 'COND') {
                        if (st.coreStrengthCount + 1 > core)
                            continue;
                    }
                    // H1: 3+ consecutive
                    if (isStrength(candidate)) {
                        const run = isConsec && st.prevSlotWasCore
                            ? st.consecutiveCoreCalendarDays + 1 : 1;
                        if (run >= 3)
                            continue;
                    }
                    // H2: same lower subtype spacing
                    if ((candidate === 'L-sq' || candidate === 'L-hi') && st.lastLowerSubtype === candidate) {
                        if (st.lastLowerDay >= 0 && pos2 - st.lastLowerDay < 3)
                            continue;
                    }
                    if (candidate === 'ACC' || candidate === 'REC')
                        continue;
                    if (candidate === 'S+C') {
                        const scType = pickSCStrengthType(pos2);
                        // Check H6 and H1 for S+C
                        if (st.coreStrengthCount + 1 > core)
                            continue;
                        if (isStrength(candidate)) {
                            const run = isConsec && st.prevSlotWasCore
                                ? st.consecutiveCoreCalendarDays + 1 : 1;
                            if (run >= 3)
                                continue;
                        }
                        // Pre-season adjacency: skip S+C if picker would pair with sprint
                        if (isPreSeason && isAdjacentToTeamDay(pos2)) {
                            const wouldPickCat = pickCondCategory(pos2);
                            if (wouldPickCat === 'sprint')
                                continue;
                        }
                    }
                }
                else {
                    if (violatesHard(candidate, slot.num))
                        continue;
                }
                // For S+C, also check hard constraints on the strength component
                let scStrength;
                if (candidate === 'S+C') {
                    scStrength = pickSCStrengthType(trainingOrder(slot.num));
                    if (!queueMustComplete && violatesHard(scStrength, slot.num))
                        continue;
                }
                const score = scoreCandidate(candidate, slot, slotIdx);
                if (score > bestScore) {
                    bestScore = score;
                    bestCandidate = candidate;
                    if (isConditioning(candidate))
                        bestFlavour = pickCondFlavour(trainingOrder(slot.num));
                    if (candidate === 'S+C')
                        bestSCStrength = scStrength;
                }
            }
            // ── Build allocation from winner ──
            const pos = trainingOrder(slot.num);
            const isConsecutiveDay = pos === st.prevSlotDayNum + 1;
            if (bestCandidate === 'S+C' && bestSCStrength) {
                // Combined day: strength + conditioning
                const flavour = bestFlavour || pickCondFlavour(pos);
                const category = flavourToSelectedCategory(flavour, pos);
                const strengthFocus = buildFocus(bestSCStrength);
                const condLabel = flavour === 'aerobic' ? 'aerobic base finisher (20min zone 2)'
                    : flavour === 'tempo' ? 'tempo conditioning finisher (20min repeat effort)'
                        : category === 'sprint'
                            ? 'sprint conditioning finisher (quality, ≤15min)'
                            : 'high-intensity conditioning finisher (15min intervals)';
                plan.push({
                    tier: 'core',
                    focus: `${strengthFocus} + ${condLabel}`,
                    dayOfWeek: slot.dayName,
                    isHardExposure: true,
                    hasCombinedConditioning: true,
                    conditioningFlavour: flavour,
                    conditioningCategory: category,
                });
                // Update state for BOTH strength and conditioning
                st.coreStrengthCount++;
                st.condCount += 0.75;
                st.condFlavours[flavour]++;
                st.condCategories[category]++;
                // Pattern count for the strength component
                if (bestSCStrength === 'L-sq')
                    st.sqCount++;
                if (bestSCStrength === 'L-hi')
                    st.hiCount++;
                if (bestSCStrength === 'U-pu')
                    st.puCount++;
                if (bestSCStrength === 'U-pl')
                    st.plCount++;
                if (isLower(bestSCStrength)) {
                    st.lowerCount++;
                    st.lastLowerDay = pos;
                    st.lastLowerSubtype = bestSCStrength;
                }
                if (isUpper(bestSCStrength)) {
                    st.upperCount++;
                    st.lastUpperDay = pos;
                    st.lastUpperSubtype = bestSCStrength;
                }
                st.lastCondDay = pos;
                st.lastCondCategory = category;
                st.lastCoreSubtype = bestSCStrength;
                st.consecutiveCoreCalendarDays = isConsecutiveDay && st.prevSlotWasCore
                    ? st.consecutiveCoreCalendarDays + 1 : 1;
                st.prevSlotWasCore = true;
            }
            else if (bestCandidate === 'COND') {
                const flavour = bestFlavour || pickCondFlavour(pos);
                const category = flavourToSelectedCategory(flavour, pos);
                // Rest-slot conditioning is optional — breaks up core streaks and
                // gives the athlete flexibility. Non-rest-slot conditioning stays core.
                const condTier = isRestSlot ? 'optional' : 'core';
                plan.push({
                    tier: condTier,
                    focus: buildFocus('COND', flavour),
                    dayOfWeek: slot.dayName,
                    isHardExposure: condTier === 'core' && flavour === 'high-intensity',
                    conditioningFlavour: flavour,
                    conditioningCategory: category,
                });
                st.condCount += 1.0;
                st.condFlavours[flavour]++;
                st.condCategories[category]++;
                st.lastCondDay = pos;
                st.lastCondCategory = category;
                st.consecutiveCoreCalendarDays = 0; // COND breaks core strength runs
                st.prevSlotWasCore = false;
            }
            else if (STRENGTH_CANDIDATES.includes(bestCandidate)) {
                plan.push({
                    tier: 'core',
                    focus: buildFocus(bestCandidate),
                    dayOfWeek: slot.dayName,
                    isHardExposure: true,
                });
                st.coreStrengthCount++;
                // Pattern counts
                if (bestCandidate === 'L-sq')
                    st.sqCount++;
                if (bestCandidate === 'L-hi')
                    st.hiCount++;
                if (bestCandidate === 'U-pu')
                    st.puCount++;
                if (bestCandidate === 'U-pl')
                    st.plCount++;
                if (bestCandidate === 'L-co') {
                    // Combined lower covers both lower sub-patterns at moderate dose.
                    st.sqCount += 0.5;
                    st.hiCount += 0.5;
                }
                if (bestCandidate === 'U-co') {
                    // Combined upper covers both upper sub-patterns at moderate dose.
                    st.puCount += 0.5;
                    st.plCount += 0.5;
                }
                if (bestCandidate === 'FB') {
                    // FB partially covers all patterns
                    st.sqCount += 0.5;
                    st.hiCount += 0.5;
                    st.puCount += 0.5;
                    st.plCount += 0.5;
                    st.fbCount++;
                    // FB updates upper tracking but NOT lastLowerDay —
                    // FB is moderate load and should not block next-day dedicated lower via H3
                    st.upperCount++;
                    st.lastUpperDay = pos;
                    st.lowerCount++;
                }
                else if (isLower(bestCandidate)) {
                    // L-sq / L-hi / L-co — all load the lower chain and count for H3.
                    st.lowerCount++;
                    st.lastLowerDay = pos;
                    st.lastLowerSubtype = bestCandidate;
                }
                else if (isUpper(bestCandidate)) {
                    // U-pu / U-pl / U-co — all load the upper chain.
                    st.upperCount++;
                    st.lastUpperDay = pos;
                    st.lastUpperSubtype = bestCandidate;
                }
                st.lastCoreSubtype = bestCandidate;
                st.consecutiveCoreCalendarDays = isConsecutiveDay && st.prevSlotWasCore
                    ? st.consecutiveCoreCalendarDays + 1 : 1;
                st.prevSlotWasCore = true;
            }
            else if (bestCandidate === 'ACC') {
                plan.push({
                    tier: 'optional',
                    focus: buildFocus('ACC'),
                    dayOfWeek: slot.dayName,
                    isHardExposure: false,
                });
                st.optCount++;
                st.consecutiveCoreCalendarDays = 0;
                st.prevSlotWasCore = false;
            }
            else {
                // REC or fallback
                plan.push({
                    tier: 'recovery',
                    focus: buildFocus('REC'),
                    dayOfWeek: slot.dayName,
                    isHardExposure: false,
                });
                st.recCount++;
                st.consecutiveCoreCalendarDays = 0;
                st.prevSlotWasCore = false;
            }
            // ── Update structure queue: remove placed strength type ──
            if (useStructureMode) {
                const placedStrength = bestCandidate === 'S+C' ? (bestSCStrength || null) :
                    STRENGTH_CANDIDATES.includes(bestCandidate) ? bestCandidate : null;
                if (placedStrength) {
                    const qIdx = strengthQueue.indexOf(placedStrength);
                    if (qIdx >= 0)
                        strengthQueue.splice(qIdx, 1);
                }
            }
            st.prevSlotDayNum = pos;
        }
        // ── Post-validation: H5a — minimum conditioning via S+C conversion ──
        // If conditioning is below the absolute floor (2 exposures), convert
        // pure-strength sessions to S+C combined days. This is the safety net:
        // the scorer should handle this in-loop, but if it doesn't, we enforce here.
        if (st.condCount < MIN_COND_FLOOR) {
            // Find pure-strength sessions that can become S+C (no existing conditioning)
            const convertible = plan
                .map((s, i) => ({ s, i }))
                .filter(({ s }) => s.tier === 'core' && s.isHardExposure
                && !s.hasCombinedConditioning && !s.conditioningFlavour)
                .reverse(); // prefer later-in-week sessions
            for (const { s, i } of convertible) {
                if (st.condCount >= MIN_COND_FLOOR)
                    break;
                const slotPos = i < daySlots.length ? trainingOrder(daySlots[i].num) : undefined;
                const flavour = pickCondFlavour(slotPos);
                const category = flavourToSelectedCategory(flavour, slotPos);
                const condLabel = flavour === 'aerobic' ? 'aerobic base finisher (20min zone 2)'
                    : flavour === 'tempo' ? 'tempo conditioning finisher (20min repeat effort)'
                        : category === 'sprint'
                            ? 'sprint conditioning finisher (quality, ≤15min)'
                            : 'high-intensity conditioning finisher (15min intervals)';
                plan[i] = {
                    ...s,
                    focus: `${s.focus} + ${condLabel}`,
                    hasCombinedConditioning: true,
                    conditioningFlavour: flavour,
                    conditioningCategory: category,
                };
                st.condCount += 0.75;
                st.condFlavours[flavour]++;
                st.condCategories[category]++;
                if (slotPos !== undefined) {
                    st.lastCondDay = slotPos;
                    st.lastCondCategory = category;
                }
            }
        }
        // ── Post-validation: H5b — promote ACC/REC to standalone conditioning ──
        // If still short of 3 conditioning exposures, promote optional/recovery slots.
        if (st.condCount < 3) {
            const promotable = plan
                .map((s, i) => ({ s, i }))
                .filter(({ s }) => s.tier === 'optional' || s.tier === 'recovery')
                // PRE-SEASON GUARD (H-PRE-1): never promote a team training day into
                // a standalone conditioning session. Team training already IS the
                // field-load exposure for that day.
                .filter(({ s }) => {
                if (!isPreSeason)
                    return true;
                const dayNum = s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1;
                return dayNum < 0 || !teamDayNumSet.has(dayNum);
            })
                .sort((a, b) => {
                if (a.s.tier !== b.s.tier)
                    return a.s.tier === 'optional' ? -1 : 1;
                return 0;
            });
            // Sort by plan index ascending so chronological sprint-protection applies.
            promotable.sort((a, b) => a.i - b.i);
            // Recompute lastCondDay / lastCondCategory from current plan so the
            // picker's sprint-protection sees the real chronological predecessor,
            // not whichever slot happened to be processed last in H5a.
            let lastCondPos = -99;
            let lastCondCat = null;
            for (let k = 0; k < plan.length; k++) {
                if (plan[k].conditioningCategory && k < daySlots.length) {
                    const p = trainingOrder(daySlots[k].num);
                    if (p > lastCondPos) {
                        lastCondPos = p;
                        lastCondCat = plan[k].conditioningCategory;
                    }
                }
            }
            for (const { i } of promotable) {
                if (st.condCount >= 3)
                    break;
                const slotPos = i < daySlots.length ? trainingOrder(daySlots[i].num) : undefined;
                // Reset state for this promotion: compute predecessor cat/day based on
                // chronologically previous conditioning placement.
                let predCat = null;
                let predDay = -99;
                for (let k = 0; k < i; k++) {
                    if (plan[k].conditioningCategory && k < daySlots.length) {
                        predDay = trainingOrder(daySlots[k].num);
                        predCat = plan[k].conditioningCategory;
                    }
                }
                const prevLastCondDay = st.lastCondDay;
                const prevLastCondCategory = st.lastCondCategory;
                st.lastCondDay = predDay;
                st.lastCondCategory = predCat;
                const flavour = pickCondFlavour(slotPos);
                const category = flavourToSelectedCategory(flavour, slotPos);
                plan[i] = {
                    tier: 'core',
                    focus: buildFocus('COND', flavour),
                    dayOfWeek: plan[i].dayOfWeek,
                    isHardExposure: flavour === 'high-intensity',
                    conditioningFlavour: flavour,
                    conditioningCategory: category,
                };
                st.condCount += 1.0;
                st.condFlavours[flavour]++;
                st.condCategories[category]++;
                // Restore / update state. Use the max chronological slot seen.
                if (slotPos !== undefined && slotPos > prevLastCondDay) {
                    st.lastCondDay = slotPos;
                    st.lastCondCategory = category;
                }
                else {
                    st.lastCondDay = prevLastCondDay;
                    st.lastCondCategory = prevLastCondCategory;
                }
                void lastCondPos;
                void lastCondCat; // silence unused
            }
        }
        // ── Post-validation: sprint-rescue ──
        // Sprint must always appear somewhere in the week. If the main loop
        // plus H5a/H5b left sprint uncovered (e.g. every candidate slot was
        // blocked by sprint-protection), retrofit it now using Sam's fallback
        // chain:
        //   1. Slide earlier — pick the EARLIEST conditioning slot whose
        //      chronological predecessor (if any) isn't vo2/glycolytic, and
        //      swap its category to sprint.
        //   2. Reduce volume — if every candidate slot is adjacent to a
        //      vo2/glyco day, still pick the earliest but mark the variant as
        //      'reduced' so the builder produces ~50% volume.
        //   3. Micro-dose — if the slot has no room at all (e.g. standalone
        //      conditioning with a blocking predecessor), convert it to a
        //      3–4×10s flying-sprint micro-dose that's low enough volume to
        //      ignore sprint-protection safely.
        // This guarantees sprint coverage without ever removing sprint.
        if (useCategoryPlanner && st.condCategories.sprint === 0) {
            const condSlots = [];
            for (let i = 0; i < plan.length; i++) {
                const s = plan[i];
                if (!s.conditioningCategory)
                    continue;
                if (i >= daySlots.length)
                    continue;
                const slotPos = trainingOrder(daySlots[i].num);
                // Find chronologically-preceding conditioning slot.
                let prevCat = null;
                let prevPos = -99;
                for (const c of condSlots) {
                    if (c.slotPos < slotPos && c.slotPos > prevPos) {
                        prevPos = c.slotPos;
                        prevCat = plan[c.planIdx].conditioningCategory;
                    }
                }
                condSlots.push({ planIdx: i, slotPos, prevCat, prevPos });
            }
            if (condSlots.length > 0) {
                // Tier 1: slide-earlier — first unblocked slot.
                let chosen = condSlots.find(cs => {
                    const adjacent = cs.slotPos === cs.prevPos + 1;
                    const blocking = cs.prevCat === 'vo2' || cs.prevCat === 'glycolytic';
                    return !(adjacent && blocking);
                });
                let variant = 'standard';
                if (!chosen) {
                    // Tier 2/3: everything is adjacent to a vo2/glyco predecessor.
                    // Pick the earliest slot. If the slot is a standalone core
                    // conditioning day, use reduced volume; if it's combined (already
                    // a short dose) OR sandwiched between two blocking slots, drop
                    // to micro-dose.
                    chosen = condSlots[0];
                    const isCombined = !!plan[chosen.planIdx].hasCombinedConditioning;
                    variant = isCombined ? 'micro_dose' : 'reduced';
                }
                // ── Cross-week micro-dose guard ──
                // Sam's rule: never schedule micro-dose sprint two weeks in a row.
                // If last week's sprint was micro-dose, force at least 'reduced'
                // this week — even on a combined day where that means a tighter
                // squeeze on the finisher. Sprint EXPOSURE quality trumps the
                // legs-twice concern here because the athlete already had a
                // deload-level sprint exposure last week.
                if (variant === 'micro_dose' && inputs.previousWeekSprintVariant === 'micro_dose') {
                    variant = 'reduced';
                    console.log('[SprintRescue] Cross-week guard: previous week was micro_dose ' +
                        '— upgrading this week from micro_dose → reduced.');
                }
                const target = plan[chosen.planIdx];
                const prevCat = target.conditioningCategory;
                // Convert: decrement previous cat, increment sprint.
                if (prevCat && st.condCategories[prevCat] > 0) {
                    st.condCategories[prevCat]--;
                }
                st.condCategories.sprint++;
                target.conditioningCategory = 'sprint';
                // Sprint is always high-intensity flavour; keep flavour in sync.
                if (target.conditioningFlavour && target.conditioningFlavour !== 'high-intensity') {
                    // Adjust flavour counts
                    const fprev = target.conditioningFlavour;
                    if (st.condFlavours[fprev] > 0)
                        st.condFlavours[fprev]--;
                    st.condFlavours['high-intensity']++;
                    target.conditioningFlavour = 'high-intensity';
                }
                target.conditioningVariant = variant;
                // Update focus copy so UI reflects the sprint retrofit.
                if (target.hasCombinedConditioning) {
                    // Preserve strength focus prefix; replace conditioning suffix.
                    const parts = target.focus.split(' + ');
                    const strengthFocus = parts[0];
                    const suffix = variant === 'micro_dose'
                        ? 'sprint micro-dose finisher (3×10s flying, ~8min)'
                        : variant === 'reduced'
                            ? 'sprint finisher (reduced volume, ≤10min)'
                            : 'sprint conditioning finisher (quality, ≤15min)';
                    target.focus = `${strengthFocus} + ${suffix}`;
                }
                else {
                    target.focus = variant === 'micro_dose'
                        ? 'Conditioning — sprint micro-dose (3×10s flying, ~10min)'
                        : variant === 'reduced'
                            ? 'Conditioning — sprint (reduced volume, ~12min)'
                            : buildFocus('COND', 'high-intensity');
                }
            }
        }
        // ── Post-validation: weekly feel balance + feel/region pairing ──
        // Assigns `conditioningFeel` to every slot that has a category, honouring:
        //   • Heavy lower S+C + sprint/glyco → force 'sharp' (short work, long
        //     rest — avoids stacking grindy density on legs that were just
        //     hammered by compound lifts).
        //   • Upper S+C → prefer 'grindy' (legs are fresh; embrace density).
        //   • Week must contain ≥1 'sharp' and ≥1 'flowing' session.
        //   • Never cluster all sessions into 'grindy'.
        // This pass is the SOURCE OF TRUTH for feel assignment — defaultProgram
        // only falls back to hash-based feel if the engine left it unset.
        if (useCategoryPlanner) {
            const feelSlots = [];
            for (let i = 0; i < plan.length; i++) {
                const s = plan[i];
                if (!s.conditioningCategory)
                    continue;
                if (i >= daySlots.length)
                    continue;
                const slotPos = trainingOrder(daySlots[i].num);
                const focus = (s.focus || '').toLowerCase();
                const isCombined = !!s.hasCombinedConditioning;
                const region = !isCombined
                    ? 'none'
                    : /squat|hinge|lower|rdl|hip/.test(focus) ? 'lower'
                        : /full body/.test(focus) ? 'full'
                            : /upper|push|pull|bench|row/.test(focus) ? 'upper'
                                : 'none';
                feelSlots.push({
                    planIdx: i,
                    slotPos,
                    region,
                    cat: s.conditioningCategory,
                    isCombined,
                    isMicroDose: s.conditioningVariant === 'micro_dose',
                });
            }
            feelSlots.sort((a, b) => a.slotPos - b.slotPos);
            const counts = {
                grindy: 0, sharp: 0, flowing: 0,
            };
            // Pass 1 — apply hard pairing rules (lower+sprint/glyco → sharp).
            for (const fs of feelSlots) {
                if (fs.isMicroDose)
                    continue; // feel is irrelevant for micro-dose
                if (fs.region === 'lower' && (fs.cat === 'sprint' || fs.cat === 'glycolytic')) {
                    plan[fs.planIdx].conditioningFeel = 'sharp';
                    counts.sharp++;
                }
            }
            // Pass 2 — fill remaining slots balancing for ≥1 sharp, ≥1 flowing,
            // and respecting region preferences (lower→sharp, upper→grindy).
            // We walk chronologically and pick the feel that (a) honours the
            // region rule and (b) satisfies the weakest-covered global feel.
            for (const fs of feelSlots) {
                if (fs.isMicroDose)
                    continue;
                if (plan[fs.planIdx].conditioningFeel)
                    continue; // set in Pass 1
                let pick;
                const remaining = feelSlots
                    .filter(x => !plan[x.planIdx].conditioningFeel && !x.isMicroDose).length;
                const needSharp = counts.sharp === 0 && remaining <= 2;
                const needFlowing = counts.flowing === 0 && remaining <= 2;
                if (needSharp) {
                    pick = 'sharp';
                }
                else if (needFlowing) {
                    pick = 'flowing';
                }
                else if (fs.region === 'lower') {
                    // Lower → prefer sharp (avoid grindy).
                    pick = counts.sharp <= counts.flowing ? 'sharp' : 'flowing';
                }
                else if (fs.region === 'upper') {
                    // Upper → prefer grindy.
                    pick = 'grindy';
                }
                else {
                    // Neutral / full — take the feel with the lowest count, preferring
                    // whichever feel is still zero.
                    const order = ['sharp', 'flowing', 'grindy'];
                    pick = order.sort((a, b) => counts[a] - counts[b])[0];
                }
                plan[fs.planIdx].conditioningFeel = pick;
                counts[pick]++;
            }
            // Pass 3 — correction. If still missing sharp or flowing (possible
            // when the week has only 1–2 eligible slots), convert the first
            // grindy slot.
            if (feelSlots.length >= 2) {
                const convertFirstGrindyTo = (target) => {
                    const victim = feelSlots.find(fs => !fs.isMicroDose && plan[fs.planIdx].conditioningFeel === 'grindy'
                        // Don't rewrite a lower+sprint/glyco slot — pairing rule wins.
                        && !(fs.region === 'lower' && (fs.cat === 'sprint' || fs.cat === 'glycolytic')));
                    if (victim) {
                        plan[victim.planIdx].conditioningFeel = target;
                        counts.grindy--;
                        counts[target]++;
                    }
                };
                if (counts.sharp === 0)
                    convertFirstGrindyTo('sharp');
                if (counts.flowing === 0)
                    convertFirstGrindyTo('flowing');
            }
        }
        // ── Post-validation: if 5th conditioning exposure exists, ensure it's lighter ──
        if (st.condCount >= 5) {
            const condSessions = plan.filter(s => s.conditioningFlavour && !s.hasCombinedConditioning && s.conditioningFlavour !== 'aerobic');
            // Downgrade the last high-intensity standalone to aerobic
            const lastHigh = condSessions.reverse().find(s => s.conditioningFlavour === 'high-intensity');
            if (lastHigh) {
                const prevCat = lastHigh.conditioningCategory;
                lastHigh.focus = buildFocus('COND', 'aerobic');
                lastHigh.conditioningFlavour = 'aerobic';
                lastHigh.conditioningCategory = 'aerobic_base';
                lastHigh.isHardExposure = false;
                if (prevCat)
                    st.condCategories[prevCat]--;
                st.condCategories['aerobic_base']++;
            }
        }
        // ── Post-validation: movement-pattern integrity in pre-season ──
        //
        // When placement drops one side of a regional pattern (e.g. L-sq lands
        // but L-hi can't find a slot, leaving the week with only squat and no
        // hinge), swap the remaining dedicated session to its combined-region
        // equivalent so BOTH sub-patterns are covered in a single session.
        //   Rule: if strict dedicated SQ exists but no HI → swap L-sq → L-co
        //         if strict dedicated HI exists but no SQ → swap L-hi → L-co
        //         if strict dedicated PU exists but no PL → swap U-pu → U-co
        //         if strict dedicated PL exists but no PU → swap U-pl → U-co
        // Full-body sessions contribute to both regions (0.5 each) and therefore
        // do NOT trigger a swap — FB means both patterns are already touched.
        if (isPreSeason && teamDayNumSet.size > 0) {
            const isSqFocus = (f) => /squat emphasis/i.test(f) && !/quad-dominant main/i.test(f);
            const isHiFocus = (f) => /^Hip-dominant lower/i.test(f);
            const isPuFocus = (f) => /push emphasis/i.test(f);
            const isPlFocus = (f) => /pull emphasis/i.test(f);
            const isFbFocus = (f) => /^Full body/i.test(f);
            const isLcoFocus = (f) => /quad-dominant main \+ hip-dominant assistance/i.test(f);
            const isUcoFocus = (f) => /combined push \+ pull/i.test(f);
            const sqSessions = plan.filter(s => s.tier === 'core' && isSqFocus(s.focus));
            const hiSessions = plan.filter(s => s.tier === 'core' && isHiFocus(s.focus));
            const puSessions = plan.filter(s => s.tier === 'core' && isPuFocus(s.focus));
            const plSessions = plan.filter(s => s.tier === 'core' && isPlFocus(s.focus));
            const hasFb = plan.some(s => s.tier === 'core' && isFbFocus(s.focus));
            const hasLco = plan.some(s => s.tier === 'core' && isLcoFocus(s.focus));
            const hasUco = plan.some(s => s.tier === 'core' && isUcoFocus(s.focus));
            if (sqSessions.length >= 1 && hiSessions.length === 0 && !hasFb && !hasLco) {
                sqSessions[0].focus = buildFocus('L-co');
            }
            else if (hiSessions.length >= 1 && sqSessions.length === 0 && !hasFb && !hasLco) {
                hiSessions[0].focus = buildFocus('L-co');
            }
            if (puSessions.length >= 1 && plSessions.length === 0 && !hasFb && !hasUco) {
                puSessions[0].focus = buildFocus('U-co');
            }
            else if (plSessions.length >= 1 && puSessions.length === 0 && !hasFb && !hasUco) {
                plSessions[0].focus = buildFocus('U-co');
            }
        }
    }
    // ══════════════════════════════════════════════════════════════════════
    // COMMON POST-VALIDATION TAIL (runs for every phase / branch above)
    // ══════════════════════════════════════════════════════════════════════
    //
    // The branches above all produce an unordered `plan: SessionAllocation[]`.
    // The tail below normalises that plan against the UNIVERSAL rules — the
    // ones that must hold regardless of in-season / pre-season / off-season:
    //
    //   (1) Region adjacency FIRST: no 3 consecutive upper/lower days. Runs
    //       before team-label so Strategy 1 (demote-optional) can still see
    //       optional-tier team days (G-1 arms / G-3 light accessories) as
    //       candidates. Once team-label promotes them to `core`, Strategy 1
    //       has nothing to demote and Strategy 2 (day-swap) / Strategy 3
    //       (focus-flip) kick in — which break team-day semantics (team
    //       labels get moved to non-team days, or focus gets overwritten to
    //       "Lower body strength" losing the "Team training + " prefix).
    //
    //   (2) Team-day label: every day the athlete trains with the team must
    //       lead with "Team training" in its focus string so the UI never
    //       hides the anchor session — applies to IN-season team days too,
    //       not just pre-season (previously pre-season-gated, which left
    //       in-season Tue/Thu team days rendering as plain gym titles).
    //
    //   (3) Weekend peak (H-PRE-11, pre-season no-game only): Saturday is
    //       the marquee training day of a no-game pre-season week. If the
    //       hardest standalone conditioning (VO2 / glycolytic / HI) sits on
    //       a weekday while Saturday holds a vanilla strength slot, we SWAP
    //       them. This is the ONLY place the tail reshuffles day slots —
    //       everything else prefers conversion.
    //
    //   (4) Field-load streak cap (H-PRE-12, all non-game weeks): no more
    //       than 3 consecutive field-load days (team, strength-core, or
    //       standalone conditioning). A 4+ streak is broken by CONVERTING
    //       the interior day (preferring to drop conditioning rather than
    //       swapping day assignments).
    //
    //   (5) Pre-season core-streak cap (existing): no more than 3 core days
    //       in a row. Runs only for pre-season — off-season already self-
    //       limits via placement.
    //
    // Local vars re-derived here (the original `isPreSeason` / `teamDayNumSet`
    // were scoped to the else-branch above).
    const phaseIsPreSeason = inputs.seasonPhase === 'Pre-season';
    const teamDaySetTail = new Set(teamDayNums);
    // Sort plan by day of week for display before adjacency (which also sorts)
    plan.sort((a, b) => dayNameToNumber(a.dayOfWeek || '') - dayNameToNumber(b.dayOfWeek || ''));
    // (1) Region adjacency FIRST — preserves optional-tier demotion path ───
    const adjusted = enforceAdjacentRegionLimit(plan);
    // (2) Universal team-day label ─────────────────────────────────────────
    // "Wholesale replace" list is deliberately narrow: these three focuses
    // represent "no dedicated gym prescription today" — mobility/rest fillers
    // that team training itself is meant to fill. Every other focus (arms/pump,
    // light accessories, post-game recovery, strength, conditioning, etc.) is
    // a REAL prescription that must be preserved alongside "Team training + ".
    //
    // Game proximity guard: on G-1 team days the club typically runs a
    // captain's run (light tactical walkthrough) — NOT a full sprint/skills/
    // contact session. We downgrade the wholesale-replace label accordingly
    // so the G-1 "low fatigue" rule holds even when the team schedules a
    // session the day before the game.
    if (teamDaySetTail.size > 0) {
        for (const s of adjusted) {
            const dayNum = s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1;
            if (dayNum < 0 || !teamDaySetTail.has(dayNum))
                continue;
            s.tier = 'core';
            s.isTeamDay = true;
            const focusLc = s.focus.toLowerCase();
            if (focusLc.startsWith('team training'))
                continue;
            const offset = gOffset(dayNum, gameDayNum);
            const isG1 = hasGameThisWeek && offset === -1;
            if (focusLc.startsWith('low-fatigue accessories')
                || focusLc.startsWith('mobility, foam rolling')
                || focusLc.startsWith('full rest')) {
                s.focus = isG1
                    ? 'Team training — captain\u2019s run (walkthrough, low-load)'
                    : 'Team training — field session (sprint + skills + contact)';
            }
            else {
                s.focus = 'Team training + ' + s.focus;
            }
        }
    }
    // (3) Weekend-peak swap (pre-season, no-game weeks only) ───────────────
    if (phaseIsPreSeason && !hasGameThisWeek) {
        enforceWeekendPeak(adjusted);
    }
    // (4) Field-load streak cap — max 3 consecutive field-load days ────────
    if (!hasGameThisWeek) {
        enforceFieldLoadStreak(adjusted);
    }
    // (5) Pre-season strength-streak cap (existing rule) ───────────────────
    if (phaseIsPreSeason) {
        enforcePreSeasonCoreStreak(adjusted, teamDaySetTail);
    }
    // Final sort (weekend-peak / field-load / core-streak may have mutated)
    adjusted.sort((a, b) => dayNameToNumber(a.dayOfWeek || '') - dayNameToNumber(b.dayOfWeek || ''));
    return adjusted;
}
function getSessionRegion(session) {
    const focus = session.focus.toLowerCase();
    // Recovery tier is always neutral — it's restorative, not loading
    if (session.tier === 'recovery')
        return 'neutral';
    // Standalone full body or conditioning → neutral (doesn't cluster either region)
    // Use startsWith to avoid catching combined S+C days where "conditioning" appears
    // in the appended finisher text (e.g. "Hip-dominant lower... + tempo conditioning finisher")
    if (focus.startsWith('full body') || focus.startsWith('conditioning'))
        return 'neutral';
    // Explicit lower body patterns — check BEFORE upper since "lower" is unambiguous
    if (focus.includes('lower body') || focus.includes('hip-dominant lower') || focus.includes('squat') || focus.includes('hinge') || focus.includes('leg'))
        return 'lower';
    // Explicit upper body patterns — push, pull, arms, etc.
    if (focus.includes('upper body') || focus.includes('pull') || focus.includes('push'))
        return 'upper';
    if (focus.includes('arm') || focus.includes('pump') || focus.includes('bicep') || focus.includes('tricep'))
        return 'upper';
    // Low-fatigue accessories that span both regions (trunk, calves, groin,
    // shoulder prehab) → neutral. These are whole-body accessory work, not
    // upper-biased. Check BEFORE the in-season-specific accessor/prehab rule.
    if (focus.includes('low-fatigue accessor') || focus.includes('low-fatigue accessori'))
        return 'neutral';
    // In-season accessory / prehab sessions count toward upper exposure tracking.
    // "Light accessories — trunk, calves, groin, shoulder prehab, mobility" is
    // primarily upper-body-adjacent work when placed in the in-season context
    // (G-3 slot). Check these BEFORE the mobility catch-all.
    if (focus.includes('accessor') || focus.includes('prehab') || focus.includes('trunk'))
        return 'upper';
    if (focus.includes('shoulder'))
        return 'upper';
    // Pure mobility / recovery sessions that don't include accessory work → neutral
    if (focus.includes('mobility') || focus.includes('foam rolling') || focus.includes('recovery'))
        return 'neutral';
    // Default: neutral (unknown focus doesn't trigger clustering)
    return 'neutral';
}
// ─── Adjacency Constraint Pass ───
//
// RULE: No more than 2 consecutive days with the same region (upper or lower).
//       Optional sessions count toward exposure tracking.
//       Neutral sessions (recovery, mobility) break runs.
//
// ALGORITHM:
//   1. Walk the sorted plan and detect runs of >2 consecutive same-region days.
//   2. For each violation, try to swap the offending session with the nearest
//      non-adjacent session of a different region (or neutral).
//   3. If no swap target exists, demote the offending session's focus to neutral
//      (e.g., change optional upper accessories → mobility/recovery).
//   4. Single pass is sufficient — swaps only redistribute, they don't create
//      new violations because we swap with a different-region session.
// enforcePreSeasonCoreStreak: never allow >3 consecutive core days in pre-season.
//
// Runs BEFORE the plan is sorted for output. The pre-season branch produces
// the final `plan` array; we scan days in calendar order (Mon→Sun, taking the
// entries the user actually selected) and identify runs of ≥4 consecutive
// core-tier sessions. Team-day core slots are IMMUTABLE (can't downgrade),
// and isHardExposure strength sessions are the week's primary stimulus —
// those are also immutable. Breakable candidates inside a run are downgraded
// to 'optional' tier (and, when appropriate, their focus is softened).
//
// Downgrade preference (first-match):
//   1. Core conditioning that is NOT on a team day → demote to optional
//   2. Core non-hard-exposure, non-team session → demote to optional
//
// Notes:
//   - We identify "consecutive" via calendar day numbers (dayNameToNumber),
//     not plan array order, so Friday + Saturday are consecutive regardless
//     of where they sit in the selected training days array.
//   - We leave `isTeamDay === true` slots untouched no matter what.
function enforcePreSeasonCoreStreak(plan, teamDayNumSet) {
    if (!plan || plan.length === 0)
        return plan;
    // Sort a shallow view by calendar day for streak detection
    const byDay = [...plan]
        .map(s => ({ ref: s, dayNum: s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1 }))
        .filter(x => x.dayNum >= 0)
        .sort((a, b) => a.dayNum - b.dayNum);
    // Build an ordered array of CONSECUTIVE-calendar core entries.
    // Two entries are consecutive if their dayNum differs by exactly 1.
    // We want to find runs of ≥4 and downgrade one slot.
    // Perform multiple passes in case one downgrade isn't enough.
    for (let pass = 0; pass < 3; pass++) {
        let changed = false;
        // Walk through byDay and find runs
        let runStart = 0;
        for (let i = 0; i <= byDay.length; i++) {
            const curr = byDay[i];
            const prev = byDay[i - 1];
            const breaks = i === byDay.length ||
                curr.ref.tier !== 'core' ||
                !prev ||
                prev.ref.tier !== 'core' ||
                curr.dayNum - prev.dayNum !== 1;
            if (breaks) {
                // Run [runStart, i-1] ended
                const runLen = i - runStart;
                // Only count if all are core and consecutive
                if (runLen >= 4) {
                    // Find first breakable candidate in the run
                    // Priority 1: non-team conditioning
                    // Priority 2: non-team, non-hard-exposure core
                    let target = null;
                    for (let j = runStart; j < i; j++) {
                        const s = byDay[j].ref;
                        if (s.isTeamDay)
                            continue;
                        if (s.tier !== 'core')
                            continue;
                        if (s.conditioningFlavour && !s.isHardExposure) {
                            target = s;
                            break;
                        }
                    }
                    if (!target) {
                        for (let j = runStart; j < i; j++) {
                            const s = byDay[j].ref;
                            if (s.isTeamDay)
                                continue;
                            if (s.tier !== 'core')
                                continue;
                            if (s.isHardExposure)
                                continue;
                            target = s;
                            break;
                        }
                    }
                    // Priority 3 (LAST RESORT): hard-exposure standalone
                    // conditioning. When every non-team slot is a hard
                    // exposure (common in high-readiness athletes with many
                    // available days), a 3-day cap still wins over preserving
                    // every stimulus. Conditioning sessions are the most
                    // replaceable hard exposure — demoting one keeps both
                    // strength emphases and both team days intact while
                    // breaking the streak. We prefer a MIDDLE-of-run slot so
                    // the streak splits rather than merely shortening.
                    if (!target) {
                        const midStart = runStart + 1;
                        const midEnd = i - 1;
                        for (let j = midStart; j < midEnd; j++) {
                            const s = byDay[j].ref;
                            if (s.isTeamDay)
                                continue;
                            if (s.tier !== 'core')
                                continue;
                            if (s.conditioningFlavour && !s.hasCombinedConditioning) {
                                target = s;
                                break;
                            }
                        }
                        if (!target) {
                            for (let j = runStart; j < i; j++) {
                                const s = byDay[j].ref;
                                if (s.isTeamDay)
                                    continue;
                                if (s.tier !== 'core')
                                    continue;
                                if (s.conditioningFlavour && !s.hasCombinedConditioning) {
                                    target = s;
                                    break;
                                }
                            }
                        }
                    }
                    // NOTE: We deliberately do NOT downgrade hard STRENGTH
                    // sessions (the week's primary stimulus). If even priority
                    // 3 finds nothing, we accept the streak and rely on
                    // placement-time prevention (H-PRE-5) for future weeks.
                    if (target) {
                        target.tier = 'optional';
                        changed = true;
                        // One downgrade per pass is enough — break out and reloop
                        break;
                    }
                }
                runStart = i;
            }
        }
        if (!changed)
            break;
    }
    return plan;
}
// ─── H-PRE-11: Weekend Peak ─────────────────────────────────────────────
//
// Pre-season no-game weeks: Saturday is the marquee training day. If the
// week's HARDEST standalone conditioning (VO2 / glycolytic / HI) is sitting
// on a weekday while Saturday holds a vanilla strength slot, swap them so
// the peak stimulus lands on the weekend. Friday becomes the strength
// buffer into it.
//
// This is the ONE place the tail reshuffles day assignments. All other
// post-validation passes prefer CONVERSION.
//
// Rules:
//   - Only operates when Saturday exists in the plan.
//   - Skipped entirely if Saturday is already a team day (team > peak) or
//     already hosts a hard standalone conditioning session (nothing to do).
//   - Skipped if Saturday is a hard-strength session that also carries
//     combined conditioning (it's already doing the peak work).
//   - Target swap partner: the highest-priority weekday standalone
//     conditioning. Priority: vo2 > glycolytic > high-intensity > sprint.
//     Aerobic base and tempo conditioning are NOT the peak — leave them.
//   - Never swaps INTO a team day or a day adjacent to one (fatigue).
//   - Never swaps if the swap would leave the chosen weekday vacant of
//     load it shouldn't lose (hard-exposure strength).
function enforceWeekendPeak(plan) {
    const saturday = plan.find(s => s.dayOfWeek === 'Saturday');
    if (!saturday)
        return;
    if (saturday.isTeamDay)
        return;
    const isPeakConditioning = (s) => {
        if (s.isTeamDay)
            return false;
        if (s.hasCombinedConditioning)
            return false; // combined = strength+cond, not standalone peak
        // Must be a STANDALONE conditioning session (no strength focus).
        const focusLc = s.focus.toLowerCase();
        const looksStandalone = focusLc.startsWith('conditioning')
            || focusLc.includes('standalone')
            || !(focusLc.includes('strength') || focusLc.includes('upper body') || focusLc.includes('lower body') || focusLc.includes('full body'));
        if (!looksStandalone)
            return false;
        return s.conditioningCategory === 'vo2'
            || s.conditioningCategory === 'glycolytic'
            || s.conditioningFlavour === 'high-intensity';
    };
    // If Saturday is already a peak standalone, nothing to do.
    if (isPeakConditioning(saturday))
        return;
    // Priority order: vo2 > glycolytic > high-intensity flavour > anything else peak
    const peakRank = (s) => {
        if (s.conditioningCategory === 'vo2')
            return 3;
        if (s.conditioningCategory === 'glycolytic')
            return 2;
        if (s.conditioningFlavour === 'high-intensity')
            return 1;
        return 0;
    };
    const candidates = plan
        .filter(s => s !== saturday && s.dayOfWeek !== 'Sunday' && isPeakConditioning(s))
        .sort((a, b) => peakRank(b) - peakRank(a));
    const swapPartner = candidates[0];
    if (!swapPartner || !swapPartner.dayOfWeek)
        return;
    // Saturday itself must be something we're willing to move to a weekday.
    // Don't relocate team days (handled above), recovery slots, or Game days.
    if (saturday.tier === 'recovery')
        return;
    if (/^game/i.test(saturday.focus))
        return;
    // Execute swap: exchange dayOfWeek only. All other properties stay with
    // the session (so the "peak" stimulus moves to Saturday, not the label).
    const originalSatDow = saturday.dayOfWeek;
    const originalPartnerDow = swapPartner.dayOfWeek;
    saturday.dayOfWeek = originalPartnerDow;
    swapPartner.dayOfWeek = originalSatDow;
}
// ─── H-PRE-12: Max 3 Consecutive Field-Load Days ────────────────────────
//
// "Field load" = any day that stresses the athlete's locomotor/contact
// system: team training, core strength, or standalone conditioning.
// When 4+ such days stack consecutively, the body can't recover — we
// break the streak.
//
// Mechanism: CONVERSION, not reshuffling.
//   - Team days are IMMUTABLE (field load is the point of the day).
//   - Core strength hard-exposures are IMMUTABLE (primary stimulus).
//   - Breakable targets, in priority order:
//       1. Non-team standalone conditioning (downgrade tier OR demote
//          combined-cond off the day).
//       2. Non-team optional-tier days that happen to carry cond.
//   - We break the MIDDLE of the run first so the 4+ streak splits into
//     two shorter streaks rather than just being trimmed at the edge.
function enforceFieldLoadStreak(plan) {
    if (!plan || plan.length === 0)
        return;
    const isFieldLoad = (s) => {
        if (s.isTeamDay)
            return true;
        if (s.tier === 'recovery')
            return false;
        if (s.tier === 'optional' && !s.conditioningFlavour && !s.conditioningCategory)
            return false;
        // Any core session is field load.
        if (s.tier === 'core')
            return true;
        // Optional day with conditioning also counts.
        return !!(s.conditioningFlavour || s.conditioningCategory);
    };
    const isBreakable = (s) => {
        if (s.isTeamDay)
            return false;
        if (s.tier === 'recovery')
            return false;
        // Hard strength exposures are sacrosanct — don't touch them.
        if (s.isHardExposure && !s.conditioningFlavour && !s.conditioningCategory && !s.hasCombinedConditioning)
            return false;
        // Standalone conditioning is the most replaceable field-load day.
        const standalone = !!(s.conditioningFlavour || s.conditioningCategory) && !s.hasCombinedConditioning;
        if (standalone)
            return true;
        // Combined conditioning on a non-hard-exposure day is also breakable
        // (we can strip the conditioning tail and keep the strength).
        if (s.hasCombinedConditioning && !s.isHardExposure)
            return true;
        return false;
    };
    const breakDay = (s) => {
        // Convert, don't relocate. Two strategies, in order:
        //   (a) If standalone conditioning → demote to recovery (mobility).
        //   (b) If combined conditioning → strip the conditioning tail.
        const standalone = !!(s.conditioningFlavour || s.conditioningCategory) && !s.hasCombinedConditioning;
        if (standalone) {
            s.tier = 'recovery';
            s.focus = 'Mobility, foam rolling, light movement';
            s.conditioningFlavour = undefined;
            s.conditioningCategory = undefined;
            s.conditioningFeel = undefined;
            s.conditioningVariant = undefined;
            s.ergModality = undefined;
            s.isHardExposure = false;
            return;
        }
        if (s.hasCombinedConditioning) {
            s.hasCombinedConditioning = false;
            s.conditioningFlavour = undefined;
            s.conditioningCategory = undefined;
            s.conditioningFeel = undefined;
            s.conditioningVariant = undefined;
            s.ergModality = undefined;
        }
    };
    // Multiple passes — one break per pass, in case the week has nested
    // streaks that only separate after a mid-run demotion.
    for (let pass = 0; pass < 3; pass++) {
        const byDay = [...plan]
            .map(s => ({ ref: s, dayNum: s.dayOfWeek ? dayNameToNumber(s.dayOfWeek) : -1 }))
            .filter(x => x.dayNum >= 0)
            .sort((a, b) => a.dayNum - b.dayNum);
        let runStart = 0;
        let broke = false;
        for (let i = 0; i <= byDay.length; i++) {
            const curr = byDay[i];
            const prev = byDay[i - 1];
            const ends = i === byDay.length
                || !isFieldLoad(curr.ref)
                || !prev
                || !isFieldLoad(prev.ref)
                || curr.dayNum - prev.dayNum !== 1;
            if (ends) {
                const runLen = i - runStart;
                if (runLen >= 4) {
                    // Prefer mid-run break: indices runStart+1 .. i-2.
                    // Try middle slots first, then edges.
                    const midStart = runStart + 1;
                    const midEnd = i - 2;
                    let target = null;
                    for (let j = midStart; j <= midEnd; j++) {
                        if (isBreakable(byDay[j].ref)) {
                            target = byDay[j].ref;
                            break;
                        }
                    }
                    if (!target) {
                        for (let j = runStart; j < i; j++) {
                            if (isBreakable(byDay[j].ref)) {
                                target = byDay[j].ref;
                                break;
                            }
                        }
                    }
                    if (target) {
                        breakDay(target);
                        broke = true;
                        break;
                    }
                }
                runStart = i;
            }
        }
        if (!broke)
            break;
    }
}
function enforceAdjacentRegionLimit(plan) {
    if (plan.length <= 2)
        return plan;
    // Work on a mutable copy sorted by day of week
    const result = [...plan].sort((a, b) => dayNameToNumber(a.dayOfWeek || '') - dayNameToNumber(b.dayOfWeek || ''));
    // We may need multiple passes since a swap can create new adjacency.
    // Cap iterations to prevent infinite loops.
    for (let pass = 0; pass < 3; pass++) {
        let changed = false;
        for (let i = 2; i < result.length; i++) {
            const regionA = getSessionRegion(result[i - 2]);
            const regionB = getSessionRegion(result[i - 1]);
            const regionC = getSessionRegion(result[i]);
            // Only care about non-neutral runs of 3
            if (regionA === 'neutral' || regionB === 'neutral' || regionC === 'neutral')
                continue;
            if (regionA !== regionB || regionB !== regionC)
                continue;
            // Check they're actually consecutive days (not e.g. Mon, Wed, Fri)
            const dayA = dayNameToNumber(result[i - 2].dayOfWeek || '');
            const dayB = dayNameToNumber(result[i - 1].dayOfWeek || '');
            const dayC = dayNameToNumber(result[i].dayOfWeek || '');
            if (dayB - dayA !== 1 || dayC - dayB !== 1)
                continue;
            const offendingRegion = regionC;
            let fixed = false;
            // ── Strategy 1: Demote an optional session in the run to neutral ──
            // Cheapest fix — preserves day assignments and G-relative placement.
            // Prefer the middle session (creates region → neutral → region).
            //
            // Team-day guard: never demote a team-day session here. Team days
            // are always promoted back to core by the team-label pass and their
            // focus gets overwritten — so demoting would silently undo itself
            // (and for a mobility demotion specifically, team-label would
            // wholesale-replace with a HARDER "field session" focus, inverting
            // the load-reduction intent).
            for (const idx of [i - 1, i, i - 2]) {
                if (result[idx].isTeamDay)
                    continue;
                if (result[idx].tier === 'optional') {
                    result[idx] = {
                        ...result[idx],
                        focus: 'Mobility, foam rolling, light movement',
                        tier: 'recovery',
                        isHardExposure: false,
                    };
                    fixed = true;
                    changed = true;
                    break;
                }
            }
            if (fixed)
                break;
            // ── Strategy 2: Swap day assignments with a different-region session ──
            // Moves sessions to different days to break clustering. More disruptive
            // than demoting, so only used when no optional sessions are available.
            //
            // Team-day guard: never swap across a team-day / non-team-day boundary
            // (in either direction). Team days are scheduling anchors fixed by the
            // club — their `dayOfWeek` is NOT ours to move. A cross-boundary swap
            // would either (a) leave a stale isTeamDay flag on the session moved
            // OUT of a team-day slot, or (b) allow a non-team session to land on
            // a team day where the team-label pass would then prefix "Team
            // training + " onto a focus that was never meant for the team-day
            // context. Restricting both endpoints to the same team/non-team class
            // preserves team-day semantics.
            for (let j = 0; j < result.length; j++) {
                if (j >= i - 2 && j <= i)
                    continue; // skip the violating trio
                if (!!result[i].isTeamDay !== !!result[j].isTeamDay)
                    continue;
                const candidateRegion = getSessionRegion(result[j]);
                if (candidateRegion === offendingRegion)
                    continue;
                const candidateDayNum = dayNameToNumber(result[j].dayOfWeek || '');
                // Check candidate's neighbours won't form a 3-run after swap
                const jPrev = j > 0 ? result[j - 1] : null;
                const jNext = j < result.length - 1 ? result[j + 1] : null;
                const jPrevDay = jPrev ? dayNameToNumber(jPrev.dayOfWeek || '') : -99;
                const jNextDay = jNext ? dayNameToNumber(jNext.dayOfWeek || '') : -99;
                const jPrevRegion = jPrev ? getSessionRegion(jPrev) : 'neutral';
                const jNextRegion = jNext ? getSessionRegion(jNext) : 'neutral';
                const adjBefore = (candidateDayNum - jPrevDay === 1) && jPrevRegion === offendingRegion;
                const adjAfter = (jNextDay - candidateDayNum === 1) && jNextRegion === offendingRegion;
                if (adjBefore && adjAfter)
                    continue;
                // Swap day assignments (not array positions)
                const tempDay = result[i].dayOfWeek;
                result[i] = { ...result[i], dayOfWeek: result[j].dayOfWeek };
                result[j] = { ...result[j], dayOfWeek: tempDay };
                // Re-sort after swap
                result.sort((a, b) => dayNameToNumber(a.dayOfWeek || '') - dayNameToNumber(b.dayOfWeek || ''));
                fixed = true;
                changed = true;
                break;
            }
            if (fixed)
                break;
            // ── Strategy 3: Flip the middle session's focus to opposite region ──
            // Last resort for all-core runs (e.g. 3 consecutive team days forced upper).
            // Flip the middle to create: upper → LOWER → upper.
            const newFocus = offendingRegion === 'upper'
                ? 'Lower body strength'
                : 'Upper body strength';
            result[i - 1] = {
                ...result[i - 1],
                focus: newFocus,
            };
            changed = true;
            break;
        }
        if (!changed)
            break; // no violations found, we're done
    }
    return result;
}
function getOptionalFocus(inputs) {
    if (inputs.seasonPhase === 'In-season') {
        return 'Upper body hypertrophy / trunk & accessory work';
    }
    if (inputs.seasonPhase === 'Pre-season') {
        return 'Light conditioning / accessory work / mobility';
    }
    // Off-season: low-fatigue accessories only — conditioning is handled
    // as a first-class session by the resolver, not shoehorned into optional.
    return 'Low-fatigue accessories — trunk, calves, groin, shoulder prehab';
}
// ─── AI Constraint Builder ───
function buildAIConstraints(inputs, readiness, hardCap, existingHard, core, optional, recovery) {
    // Lower body loading strategy — injuries MODIFY movement selection, not eliminate training.
    // 'avoid' is reserved for severe + constant pain only. Otherwise we train around it.
    let lowerBodyLoading = 'normal';
    const lowerInjuries = inputs.injuries.filter((i) => ['Hip', 'Knee', 'Ankle', 'Hamstring', 'Groin', 'Lower back'].includes(i.bodyArea));
    if (lowerInjuries.length > 0) {
        const hasSevereConstant = lowerInjuries.some((i) => i.severity === 'Severe' &&
            i.movementTriggers?.includes('Constant'));
        // Only 'avoid' if severe AND constant — otherwise conservative (modify, don't eliminate)
        lowerBodyLoading = hasSevereConstant ? 'avoid' : 'conservative';
    }
    // Sprint loading strategy
    let sprintLoading = 'allowed';
    if (inputs.sprintExposure === 'No sprint training') {
        sprintLoading = readiness === 'low' ? 'do-not-add' : 'conservative';
    }
    if (inputs.seasonPhase === 'In-season') {
        // In-season: footy training IS the running
        sprintLoading = 'do-not-add';
    }
    // Conditioning loading
    let conditioningLoading = 'full';
    if (inputs.seasonPhase === 'In-season') {
        conditioningLoading = 'light-only'; // No extra running in-season
    }
    else if (readiness === 'low') {
        conditioningLoading = 'moderate';
    }
    // Injury restrictions as strings for AI prompt — include severity-aware action guidance
    const injuryRestrictions = inputs.injuries.map((i) => {
        const parts = [i.bodyArea];
        if (i.severity)
            parts.push(i.severity.toLowerCase());
        if (i.movementTriggers && i.movementTriggers.length > 0) {
            parts.push(`triggers: ${i.movementTriggers.join(', ')}`);
        }
        else if (i.whenItHurts) {
            parts.push(`hurts when ${i.whenItHurts.toLowerCase()}`);
        }
        if (i.notes)
            parts.push(`notes: ${i.notes}`);
        // Add severity-aware action so the AI knows how to respond
        if (i.severity === 'Mild') {
            parts.push('ACTION: train normally, slight awareness — swap only directly painful movements');
        }
        else if (i.severity === 'Moderate') {
            parts.push('ACTION: modify trigger movements, reduce load/ROM — keep training structure intact');
        }
        else if (i.severity === 'Severe') {
            const isConstant = i.movementTriggers?.includes('Constant');
            parts.push(isConstant
                ? 'ACTION: avoid directly aggravating patterns, replace with safe alternatives — still train other patterns'
                : 'ACTION: remove only the specific trigger movements, replace with non-aggravating alternatives — maintain training volume');
        }
        return parts.join(' — ');
    });
    // Ramp-up flag
    const rampUp = readiness === 'low' ||
        inputs.recentTrainingLoad === 'Hardly at all' ||
        inputs.recentTrainingLoad === 'A bit';
    // Safety notes
    const notes = [];
    if (rampUp) {
        notes.push('Athlete needs gradual ramp-up — do NOT prescribe full volume immediately');
    }
    if (inputs.seasonPhase === 'Pre-season') {
        const teamDayList = (inputs.teamTrainingDays && inputs.teamTrainingDays.length > 0)
            ? inputs.teamTrainingDays.join(' and ')
            : null;
        notes.push('PRE-SEASON: Team training days are PRIMARY FIELD-LOAD ANCHORS — treat them as real running/field stress, not as rest days with gym on top.');
        if (teamDayList) {
            notes.push(`PRE-SEASON TEAM DAYS: ${teamDayList}. These days count as hard exposures because team training provides sprint, aerobic, and contact load.`);
        }
        notes.push('NO separate conditioning on a team training day. No tempo / VO2 / glycolytic / sprint finisher. No "+ conditioning" suffix. The team session IS the conditioning.');
        notes.push('NO heavy lower strength on a team training day (no dedicated squat or hinge focus). If gym is programmed on a team day, use: light upper, light full body (moderate load, cover all patterns), or low-fatigue support work (accessories, trunk, calves, groin, prehab).');
        notes.push('NO standalone sprint/speed conditioning on the day before or day after a team training day. Protect neural freshness and soft tissue recovery around team sessions.');
        notes.push('PRIORITISE VO2 and glycolytic first, then aerobic base; sprint work is mostly covered by team training and should only be added when team load is light.');
        notes.push('STANDALONE CONDITIONING VOLUME is reduced compared with off-season because team training already covers field load. Gym complements team load — extra conditioning only fills gaps.');
        notes.push('PRE-SEASON WEEKLY STRUCTURE: team sessions provide major field stress → gym complements team load → extra conditioning fills remaining gaps only where appropriate.');
    }
    if (inputs.seasonPhase === 'In-season') {
        notes.push('IN-SEASON: Anchor ENTIRE week to game day (G). All scheduling is G-relative, NOT fixed weekdays.');
        notes.push('PREFERRED TARGET: 3 CORE gym sessions (1× Lower, 1× Upper Pull, 1× Upper Push). If only 2 CORE sessions fit (low budget or readiness), use: 1× Lower + 1× Balanced Upper (push + pull merged). If only 1 CORE session fits, use: 1× Basic Full Body (1 squat/hinge + 1 push + 1 pull, moderate volume). NEVER omit an entire movement category.');
        notes.push('3-CORE PLACEMENT: Lower earliest (G−5), Pull next (G−4, pair with team training), Push late (G−2, moderate intensity). This creates: Lower → Pull → gap → Push — good spacing.');
        notes.push('2-CORE PLACEMENT: Lower earliest (G−5), Balanced Upper at G−2 (moderate intensity). The balanced upper should include 1 main push (moderate load, 3×4-6), 1 main pull (moderate load), plus 1-2 accessories. Both push and pull patterns are covered in a single session.');
        notes.push('1-CORE PLACEMENT: Basic Full Body at best available slot (G−5 preferred). Include 1 squat or hinge, 1 horizontal/vertical push, 1 horizontal/vertical pull, plus 1-2 prehab accessories. Moderate volume — cover all patterns rather than loading any one heavily.');
        notes.push('NO BACK-TO-BACK UPPER: Do NOT place pull and push on consecutive days (e.g. Tue pull → Wed push → Thu push). Space upper exposures with at least 1 day gap where possible.');
        notes.push('G−3 (WEDNESDAY) = OPTIONAL or RECOVERY by default. Light accessories, trunk, calves, groin, shoulder prehab, mobility. ONLY promote to CORE if a required exposure genuinely cannot fit elsewhere.');
        notes.push('G−2 UPPER IS CORE: The upper session at G−2 is a required exposure (not optional). If 3-core: push emphasis. If 2-core: balanced upper (push + pull). Moderate intensity in both cases. Do NOT make it a hypertrophy pump session.');
        notes.push('G−1: ABSOLUTE ZERO sprinting, speed work, conditioning, lower body, or plyometrics. Arms/pump ONLY. Always OPTIONAL tier.');
        notes.push('G+1: Recovery ONLY. Always RECOVERY tier.');
        notes.push('CORE means true key sessions ONLY. 3 CORE gym + Game Day is the ideal ceiling — do NOT add more. If readiness or schedule makes 3 impractical, 2 CORE is fine.');
        notes.push('OPTIONAL ≠ junk. OPTIONAL can include: trunk, calves, groin, shoulder health, arms pump, low-fatigue balancing work. But OPTIONAL should not replace a missing CORE.');
        notes.push('No conditioning within 48h of game. No high-DOMS lower body in last 72h before game. No heavy lower body after G−4.');
        notes.push('Sprint exposure covered by team training + games — do NOT add extra sprints or conditioning.');
        notes.push('PATTERN FREQUENCY: Pull max 2x/week, Push max 2-3x/week, Heavy hinge max 2x/week, Heavy squat max 2x/week. No same pattern on consecutive days.');
        notes.push('STRUCTURE FIRST: Place exposure type + tier + day FIRST, then fill exercises. Do NOT build exercises first and assign tiers after.');
        notes.push('MERGING: If 3 separate sessions cannot fit, merge intelligently. 2-core: push+pull=balanced upper. 1-core: lower+push+pull=basic full body. NEVER simply omit a movement category.');
        notes.push('PRIORITISE: 1) game day freshness, 2) sensible spacing, 3) movement balance, 4) exercise selection. Do NOT chase perfect balance by jamming patterns into adjacent days.');
    }
    if (existingHard >= hardCap) {
        notes.push(`Hard exposure budget FULL (${existingHard}/${hardCap}) — all gym sessions should be moderate or light`);
    }
    notes.push('Injuries MODIFY training — they do NOT eliminate it. Train around limitations, replace movements, maintain stimulus.');
    notes.push('NEVER default to all-recovery programs unless injuries are severe AND constant. Keep strength, power, and conditioning pillars.');
    notes.push('Ensure at least 1 true recovery / low-load day per week');
    return {
        phase: inputs.seasonPhase,
        readiness,
        hardExposureCap: hardCap,
        existingHardExposures: existingHard,
        coreSessionsToProgram: core,
        optionalSessionsAllowed: optional,
        recoverySessionsAllowed: recovery,
        lowerBodyLoading,
        sprintLoading,
        conditioningLoading,
        injuryRestrictions,
        priorities: inputs.goals || [],
        rampUp,
        maxExercisesPerSession: 6,
        notes,
    };
}
// ─── Helper: Build CoachingInputs from OnboardingData ───
function onboardingToCoachingInputs(data) {
    return {
        seasonPhase: data.seasonPhase || 'Pre-season',
        availableDays: data.trainingDaysPerWeek || 3,
        selectedDays: data.preferredTrainingDays || [],
        teamTrainingDaysPerWeek: data.teamTrainingDaysPerWeek || 0,
        teamTrainingDays: data.teamTrainingDays || [],
        teamTrainingIntensity: data.teamTrainingIntensity,
        sprintExposure: data.sprintExposure,
        conditioningLevel: data.conditioningLevel,
        recentTrainingLoad: data.recentTrainingLoad,
        injuries: data.injuries || [],
        goals: data.motivation ? data.motivation.split(', ') : [],
        // hasGame means "a specific game is scheduled this week" — it must NOT be
        // a proxy for "phase has team-level context". Previously this was
        // `seasonPhase === 'In-season' || seasonPhase === 'Pre-season'` which made
        // hasGame=true in pre-season even when no game day existed (the log output
        // "gameDay: NONE, hasGame: true" was a symptom of that). That inflated
        // hard-exposure counts in `countTeamHardExposures` for pre-season weeks.
        // Now: hasGame is true iff there is an actual game day on the profile.
        // Off-season always has hasGame=false (no game day). Pre-season only has
        // hasGame=true if the athlete has set a usualGameDay/gameDay.
        hasGame: Boolean(data.usualGameDay || data.gameDay),
        // Prefer the new usualGameDay (full DayOfWeek) over the legacy gameDay field
        // so the in-season phase-shift flow drives game-proximity scheduling immediately.
        gameDay: data.usualGameDay || data.gameDay,
    };
}
