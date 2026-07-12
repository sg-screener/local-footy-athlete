/**
 * Exercise Scorer — Scoring, composition, selection, and substitution.
 *
 * Pure functions. No React. No Zustand. No AI.
 *
 * COMPOSITION MODEL:
 *   Sessions are built from SLOTS, not just "top N by score".
 *   Each slot has a role (primary, secondary, unilateral, accessory, finisher)
 *   and constraints (load cap, fatigue cap, movement preference).
 *
 *   This prevents:
 *   - Two heavy compounds in one session
 *   - Movement pattern stacking (2 squats)
 *   - Silent region drift (lower → upper)
 *   - Fatigue overload
 *
 * SESSION INTENT PRESERVATION:
 *   If targetRegion is set, ONLY exercises matching that region are
 *   eligible. If not enough candidates exist after filtering, the
 *   session returns fewer exercises rather than drifting to another
 *   region. The resolver upstream should have already changed the
 *   session type if the date context requires it (e.g. G-1 → arms_pump).
 *
 * MINIMUM VIABLE SESSION (MVS):
 *   When a session is heavily filtered (e.g. G-1 or injury-restricted)
 *   and falls below MIN_SESSION_SIZE, safe low-cost fillers are added:
 *   core work, arm isolation, carries. These never violate hard filters
 *   and never introduce fatigue. The session feels complete even when
 *   the primary region is heavily constrained.
 */

import {
  EXERCISE_TAGS,
  type ExerciseTag,
  type MovementPattern,
  type Region,
  type LoadLevel,
  type FatigueLevel,
} from '../data/exerciseTags';
import type { FilterContext } from './exerciseFilter';
import {
  normalizeStrengthIntent,
  type MainStrengthPattern,
  type StrengthIntent,
} from '../rules/strengthPatternContributions';

// ─── Session Intent ───

export interface SessionIntent {
  /** Primary movement patterns this session should include. */
  targetMovements: MovementPattern[];
  /** Primary region focus. ENFORCED — no off-region exercises. */
  targetRegion: Region | null;
  /** Number of exercises to select. */
  exerciseCount: number;
  /** Composition slots. Defines the structure of the session. */
  slots: SlotDef[];
}

// ─── Slot-Based Composition ───

export interface SlotDef {
  /** Human-readable role name. */
  role: 'primary' | 'secondary' | 'unilateral' | 'accessory' | 'finisher';
  /** Preferred movement patterns for this slot (best match wins). */
  preferredMovements: MovementPattern[];
  /** Maximum load level for this slot. null = no cap. */
  maxLoad: LoadLevel | null;
  /** Maximum fatigue level for this slot. null = no cap. */
  maxFatigue: FatigueLevel | null;
  /** Require unilateral? null = no preference. */
  requireUnilateral: boolean | null;
}

// ─── Level Ordinals ───

const LEVEL_ORD: Record<string, number> = {
  'low': 0, 'moderate': 1, 'high': 2,
};

function levelAtMost(value: string, cap: string): boolean {
  return (LEVEL_ORD[value] ?? 0) <= (LEVEL_ORD[cap] ?? 2);
}

// ─── Scoring ───

/**
 * Score a single exercise given session intent and context.
 * Higher score = better fit. Range roughly 0-100.
 */
export function scoreExercise(
  name: string,
  tags: ExerciseTag,
  intent: SessionIntent,
  ctx: FilterContext,
  weekExercises: Set<string>,
): number {
  let score = 50;

  // ── 1. Movement pattern match (±20) ──
  if (intent.targetMovements.includes(tags.movement)) {
    score += 20;
  } else {
    score -= 10;
  }

  // ── 2. Region match (±10) ──
  if (intent.targetRegion && tags.region === intent.targetRegion) {
    score += 10;
  } else if (intent.targetRegion && tags.region !== intent.targetRegion) {
    score -= 5;
  }

  // ── 3. Fatigue preference (late week = prefer low) ──
  if (isLateWeek(ctx.dayOfWeek)) {
    score -= (LEVEL_ORD[tags.fatigue] || 0) * 8;
  }

  // ── 4. DOMS penalty (late week) ──
  if (isLateWeek(ctx.dayOfWeek)) {
    score -= (LEVEL_ORD[tags.doms] || 0) * 6;
  }

  // ── 5. Stability preference (injury present = prefer high) ──
  if (Object.keys(ctx.activeInjuries).length > 0) {
    if (tags.stability === 'high') score += 5;
    if (tags.stability === 'low') score -= 5;
  }

  // ── 6. Injury caution penalty ──
  for (const [rawArea, severity] of Object.entries(ctx.activeInjuries)) {
    const area = normaliseArea(rawArea);
    if (!area) continue;
    if (tags.injury[area] === 'caution') {
      score -= severity === 'avoid' ? 8 : 4;
    }
  }

  // ── 7. Plyo in-season penalty ──
  if (ctx.inSeason && tags.movement === 'plyo') {
    score -= 10;
  }

  // ── 8. Variety: penalise if already used this week ──
  if (weekExercises.has(name)) {
    score -= 25;
  }

  // ── 9. Late-week lateWeek tag bonus ──
  if (isLateWeek(ctx.dayOfWeek)) {
    if (tags.lateWeek === 'good') score += 8;
    if (tags.lateWeek === 'caution') score -= 3;
  }

  return score;
}

/**
 * Score and rank all candidate exercises. Returns sorted (best first).
 */
export function rankExercises(
  candidates: string[],
  intent: SessionIntent,
  ctx: FilterContext,
  weekExercises: Set<string>,
): Array<{ name: string; score: number }> {
  const scored = candidates.map(name => {
    const tags = EXERCISE_TAGS[name];
    if (!tags) return { name, score: -999 };
    return { name, score: scoreExercise(name, tags, intent, ctx, weekExercises) };
  });
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored;
}

// ─── Selection with Composition Rules ───

/**
 * SESSION COMPOSITION LIMITS — enforced across the whole session.
 *
 * These prevent fatigue/DOMS/load overload regardless of slot rules.
 */
const SESSION_LIMITS = {
  maxHighLoad: 1,       // at most 1 high-load exercise per session
  maxHighFatigue: 2,    // at most 2 high-fatigue exercises per session
  maxHighDoms: 1,       // at most 1 high-DOMS exercise per session
};

/**
 * Minimum session size before fillers are considered.
 * If slot-filling produces fewer than this, safe low-cost exercises
 * are appended (core, arm isolation, carries) to make the session
 * feel complete without violating intent or introducing fatigue.
 */
const MIN_SESSION_SIZE = 4;

/**
 * Filler-eligible regions by target region.
 * These are the "safe supplement" regions that don't violate session intent.
 * A lower session can add core/carries/arm isolation without becoming an upper session.
 */
const FILLER_REGIONS: Record<Region, Region[]> = {
  lower: ['core', 'full', 'upper'],   // core, carries, arm pump
  upper: ['core', 'full'],             // core, carries
  core:  ['full', 'upper'],            // carries, arm pump
  full:  ['core', 'upper'],            // core, arm pump
};

/**
 * Filler priority tiers — selected in order so constrained sessions
 * feel coached rather than arbitrary.
 *
 * Order:
 *   1. Trunk / core  — always appropriate, low systemic cost
 *   2. Arms / pump   — isolation curls, pushdowns, raises
 *   3. Shoulder health / light upper accessories — face pulls, push-ups
 *   4. Carries        — moderate cost, used only if still short
 *   5. Other low-cost — catch-all (horizontal pull/push not caught above)
 *
 * Each tier specifies allowed movements and max fatigue.
 * Within a tier, exercises are ranked by the standard scorer.
 */
interface FillerTier {
  movements: MovementPattern[];
  maxFatigue: FatigueLevel;
}

const FILLER_TIERS: FillerTier[] = [
  { movements: ['core'],                          maxFatigue: 'low' },
  { movements: ['isolation_upper'],                maxFatigue: 'low' },
  { movements: ['horizontal_pull', 'horizontal_push'], maxFatigue: 'low' },
  { movements: ['carry'],                          maxFatigue: 'moderate' },
];

/**
 * Select exercises using slot-based composition.
 *
 * REGION ENFORCEMENT:
 *   If intent.targetRegion is set, only exercises matching that region
 *   (or region='full'/'core' for carries/core work) are eligible.
 *   If not enough candidates exist, returns fewer exercises.
 *   NEVER silently drifts to another region.
 *
 * SLOT FILLING:
 *   Each slot is filled in order. For each slot, the best-scoring
 *   candidate that satisfies slot constraints AND session-wide limits
 *   is selected. Already-used movements are penalised to prevent
 *   pattern stacking.
 *
 * MINIMUM VIABLE SESSION (MVS):
 *   If slot-filling produces fewer than MIN_SESSION_SIZE exercises,
 *   safe low-cost fillers are appended: core work, arm isolation,
 *   carries. These must pass hard filters, be low fatigue/DOMS,
 *   and come from filler-eligible regions. The session target region
 *   determines which filler regions are allowed.
 *
 * Deterministic: same inputs → same outputs.
 */
export function selectExercises(
  candidates: string[],
  intent: SessionIntent,
  ctx: FilterContext,
  weekExercises: Set<string>,
): string[] {
  // ── Region enforcement: hard-filter candidates to target region ──
  const regionCandidates = intent.targetRegion
    ? candidates.filter(name => {
        const tags = EXERCISE_TAGS[name];
        if (!tags) return false;
        // Allow target region + 'full' (carries) + 'core' (trunk work)
        return tags.region === intent.targetRegion
            || tags.region === 'full'
            || tags.region === 'core';
      })
    : candidates;

  const ranked = rankExercises(regionCandidates, intent, ctx, weekExercises);

  const selected: string[] = [];
  const usedMovements = new Map<MovementPattern, number>(); // movement → count
  let highLoadCount = 0;
  let highFatigueCount = 0;
  let highDomsCount = 0;

  // ── Fill slots in order ──
  for (const slot of intent.slots) {
    const pick = findBestForSlot(
      ranked, selected, slot, usedMovements,
      highLoadCount, highFatigueCount, highDomsCount,
    );
    if (!pick) continue;

    const tags = EXERCISE_TAGS[pick]!;
    selected.push(pick);

    // Update session-wide counters
    const mv = tags.movement;
    usedMovements.set(mv, (usedMovements.get(mv) || 0) + 1);
    if (tags.load === 'high') highLoadCount++;
    if (tags.fatigue === 'high') highFatigueCount++;
    if (tags.doms === 'high') highDomsCount++;
  }

  // ── Minimum Viable Session: top up with safe fillers if under-filled ──
  //
  // Fillers are selected tier-by-tier (core first, then arms, then
  // shoulder health, then carries) so constrained sessions feel
  // intentionally programmed rather than arbitrary.
  if (selected.length < MIN_SESSION_SIZE && intent.targetRegion) {
    const fillerRegions = FILLER_REGIONS[intent.targetRegion] || [];
    const targetCount = Math.min(intent.exerciseCount, MIN_SESSION_SIZE);

    for (const tier of FILLER_TIERS) {
      if (selected.length >= targetCount) break;

      // Build this tier's candidate pool
      const tierPool = candidates.filter(name => {
        if (selected.includes(name)) return false;
        const tags = EXERCISE_TAGS[name];
        if (!tags) return false;

        // Must be from an allowed filler region
        if (!fillerRegions.includes(tags.region)) return false;

        // Must match this tier's movement patterns
        if (!tier.movements.includes(tags.movement)) return false;

        // Fatigue capped per tier (core/arms = low, carries = moderate)
        if (!levelAtMost(tags.fatigue, tier.maxFatigue)) return false;

        // DOMS must be low for all fillers
        if (tags.doms !== 'low') return false;

        // No heavy fillers
        if (tags.load === 'high') return false;

        return true;
      });

      // Rank within tier by standard scorer, then pick
      const rankedTier = rankExercises(tierPool, intent, ctx, weekExercises);

      for (const { name } of rankedTier) {
        if (selected.length >= targetCount) break;

        // Prevent movement stacking even in fillers
        const tags = EXERCISE_TAGS[name]!;
        const currentCount = usedMovements.get(tags.movement) || 0;
        if (currentCount >= 2) continue;

        selected.push(name);
        usedMovements.set(tags.movement, currentCount + 1);
      }
    }
  }

  return selected;
}

/**
 * Find the best candidate for a specific slot.
 *
 * Returns the exercise name, or null if nothing fits.
 */
function findBestForSlot(
  ranked: Array<{ name: string; score: number }>,
  alreadySelected: string[],
  slot: SlotDef,
  usedMovements: Map<MovementPattern, number>,
  highLoadCount: number,
  highFatigueCount: number,
  highDomsCount: number,
): string | null {
  for (const { name } of ranked) {
    if (alreadySelected.includes(name)) continue;

    const tags = EXERCISE_TAGS[name];
    if (!tags) continue;

    // ── Slot constraint: max load ──
    if (slot.maxLoad && !levelAtMost(tags.load, slot.maxLoad)) continue;

    // ── Slot constraint: max fatigue ──
    if (slot.maxFatigue && !levelAtMost(tags.fatigue, slot.maxFatigue)) continue;

    // ── Slot constraint: unilateral ──
    if (slot.requireUnilateral === true && !tags.unilateral) continue;
    if (slot.requireUnilateral === false && tags.unilateral) continue;

    // ── Session-wide limits ──
    if (tags.load === 'high' && highLoadCount >= SESSION_LIMITS.maxHighLoad) continue;
    if (tags.fatigue === 'high' && highFatigueCount >= SESSION_LIMITS.maxHighFatigue) continue;
    if (tags.doms === 'high' && highDomsCount >= SESSION_LIMITS.maxHighDoms) continue;

    // ── Movement stacking prevention ──
    // Prefer slot's preferred movements, but don't hard-require them.
    // If a movement is already used 2+ times, skip unless no other option.
    const currentCount = usedMovements.get(tags.movement) || 0;
    if (currentCount >= 2) continue; // hard cap: never 3 of same pattern

    // ── Prefer slot's preferred movements ──
    // This is soft — handled by the ranked order + the bonus below.
    // But if preferredMovements is set, strongly prefer a match.
    if (slot.preferredMovements.length > 0) {
      const isPreferred = slot.preferredMovements.includes(tags.movement);
      // If we already have a same-movement exercise and this slot prefers
      // a different pattern, skip to encourage diversity
      if (!isPreferred && currentCount >= 1) continue;
    }

    return name;
  }

  // Fallback: relax movement stacking to find anything
  for (const { name } of ranked) {
    if (alreadySelected.includes(name)) continue;
    const tags = EXERCISE_TAGS[name];
    if (!tags) continue;
    if (slot.maxLoad && !levelAtMost(tags.load, slot.maxLoad)) continue;
    if (slot.maxFatigue && !levelAtMost(tags.fatigue, slot.maxFatigue)) continue;
    if (slot.requireUnilateral === true && !tags.unilateral) continue;
    if (tags.load === 'high' && highLoadCount >= SESSION_LIMITS.maxHighLoad) continue;
    if (tags.fatigue === 'high' && highFatigueCount >= SESSION_LIMITS.maxHighFatigue) continue;
    if (tags.doms === 'high' && highDomsCount >= SESSION_LIMITS.maxHighDoms) continue;
    return name;
  }

  return null;
}

// ─── Substitutions ───

/**
 * Find the best substitute for a given exercise.
 *
 * Preserves:
 *   - Movement pattern (must match)
 *   - Fatigue profile (similarity scored)
 *   - DOMS level (similarity scored)
 *   - Passes all injury constraints
 */
export function findSubstitute(
  original: string,
  candidates: string[],
  ctx: FilterContext,
): string | null {
  const origTags = EXERCISE_TAGS[original];
  if (!origTags) return null;

  const scored: Array<{ name: string; score: number }> = [];

  for (const name of candidates) {
    if (name === original) continue;
    const tags = EXERCISE_TAGS[name];
    if (!tags) continue;

    // Must match movement pattern
    if (tags.movement !== origTags.movement) continue;

    let score = 50;

    if (tags.region === origTags.region) score += 10;

    const fatigueDiff = Math.abs(LEVEL_ORD[tags.fatigue] - LEVEL_ORD[origTags.fatigue]);
    if (fatigueDiff === 0) score += 10;
    else if (fatigueDiff === 1) score += 5;
    else score -= 5;

    const domsDiff = Math.abs(LEVEL_ORD[tags.doms] - LEVEL_ORD[origTags.doms]);
    if (domsDiff === 0) score += 8;
    else if (domsDiff === 1) score += 4;
    else score -= 4;

    score -= Math.abs(LEVEL_ORD[tags.stability] - LEVEL_ORD[origTags.stability]) * 3;
    score -= Math.abs(LEVEL_ORD[tags.eccentric] - LEVEL_ORD[origTags.eccentric]) * 3;

    if (tags.unilateral === origTags.unilateral) score += 5;

    score -= Math.abs(LEVEL_ORD[tags.load] - LEVEL_ORD[origTags.load]) * 4;

    scored.push({ name, score });
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.length > 0 ? scored[0].name : null;
}

// ─── Session Intent Builders ───

/**
 * Build a SessionIntent from a workout name/type.
 *
 * Each intent includes SLOT DEFINITIONS that encode composition rules.
 * Slots are filled in order — primary first, finisher last.
 */
export function buildIntent(
  workoutName: string,
  workoutType: string,
  exerciseCount: number = 5,
  strengthIntent?: StrengthIntent,
): SessionIntent {
  if (strengthIntent) {
    const intent = normalizeStrengthIntent(strengthIntent);
    const patterns = intent.effectivePatterns.length > 0
      ? intent.effectivePatterns
      : intent.plannedPatterns;
    if (patterns.length > 0) {
      const preferred = (pattern: MainStrengthPattern): MovementPattern[] => {
        switch (pattern) {
          case 'squat': return ['squat'];
          case 'hinge': return ['hinge'];
          case 'push': return ['horizontal_push', 'vertical_push'];
          case 'pull': return ['horizontal_pull', 'vertical_pull'];
        }
      };
      const targetMovements = Array.from(new Set([
        ...patterns.flatMap(preferred),
        ...(patterns.includes('squat') ? ['lunge' as MovementPattern] : []),
      ]));
      const primary = intent.primaryPattern && patterns.includes(intent.primaryPattern)
        ? intent.primaryPattern
        : patterns[0];
      const slots: SlotDef[] = [{
        role: 'primary',
        preferredMovements: preferred(primary),
        maxLoad: null,
        maxFatigue: null,
        requireUnilateral: false,
      }];
      for (const pattern of patterns.filter((pattern) => pattern !== primary)) {
        slots.push({
          role: 'secondary',
          preferredMovements: preferred(pattern),
          maxLoad: 'moderate',
          maxFatigue: null,
          requireUnilateral: null,
        });
      }
      if (patterns.includes('squat') && slots.length < exerciseCount) {
        slots.push({
          role: 'unilateral',
          preferredMovements: ['lunge', 'squat'],
          maxLoad: 'moderate',
          maxFatigue: 'moderate',
          requireUnilateral: true,
        });
      }
      while (slots.length < exerciseCount) {
        slots.push({
          role: slots.length === exerciseCount - 1 ? 'finisher' : 'accessory',
          preferredMovements: targetMovements,
          maxLoad: 'low',
          maxFatigue: 'moderate',
          requireUnilateral: null,
        });
      }
      return {
        targetMovements,
        targetRegion: intent.archetype === 'full_body' ? null : intent.archetype,
        exerciseCount,
        slots,
      };
    }
  }
  if (/strength/i.test(workoutType)) {
    // Ambiguous legacy strength shells must not invent squat+hinge+push+pull.
    // The session-builder ingress supplies typed content-derived intent when
    // real main rows exist; otherwise keep this a conservative support shell.
    return {
      targetMovements: ['core', 'carry'],
      targetRegion: null,
      exerciseCount,
      slots: Array.from({ length: exerciseCount }, (_, index): SlotDef => ({
        role: index === 0 ? 'primary' : index === exerciseCount - 1 ? 'finisher' : 'accessory',
        preferredMovements: ['core', 'carry'],
        maxLoad: 'low',
        maxFatigue: 'low',
        requireUnilateral: null,
      })),
    };
  }
  const name = workoutName.toLowerCase();

  // ── Lower Strength ──
  if (name.includes('lower') && (name.includes('strength') || name.includes('squat'))) {
    return {
      targetMovements: ['squat', 'hinge', 'lunge'],
      targetRegion: 'lower',
      exerciseCount,
      slots: [
        { role: 'primary',    preferredMovements: ['squat'],  maxLoad: null,       maxFatigue: null,       requireUnilateral: false },
        { role: 'secondary',  preferredMovements: ['hinge'],  maxLoad: 'moderate', maxFatigue: null,       requireUnilateral: null },
        { role: 'unilateral', preferredMovements: ['lunge', 'squat', 'hinge'], maxLoad: 'moderate', maxFatigue: null, requireUnilateral: true },
        { role: 'accessory',  preferredMovements: ['hinge'],  maxLoad: 'low',      maxFatigue: 'moderate', requireUnilateral: null },
        { role: 'finisher',   preferredMovements: ['squat', 'hinge', 'lunge'], maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
      ],
    };
  }

  // ── Lower Hypertrophy / Power ──
  if (name.includes('lower') && (name.includes('hyper') || name.includes('power'))) {
    return {
      targetMovements: ['hinge', 'squat', 'plyo', 'lunge'],
      targetRegion: 'lower',
      exerciseCount,
      slots: [
        { role: 'primary',    preferredMovements: ['hinge'],  maxLoad: null,       maxFatigue: null,       requireUnilateral: false },
        { role: 'secondary',  preferredMovements: ['squat', 'plyo'], maxLoad: 'moderate', maxFatigue: null, requireUnilateral: null },
        { role: 'unilateral', preferredMovements: ['lunge', 'squat'], maxLoad: 'moderate', maxFatigue: null, requireUnilateral: true },
        { role: 'accessory',  preferredMovements: ['hinge'],  maxLoad: 'low',      maxFatigue: 'moderate', requireUnilateral: null },
        { role: 'finisher',   preferredMovements: ['squat', 'hinge'], maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
      ],
    };
  }

  // ── Upper Push ──
  if (name.includes('upper') && name.includes('push')) {
    return {
      targetMovements: ['horizontal_push', 'vertical_push'],
      targetRegion: 'upper',
      exerciseCount,
      slots: [
        { role: 'primary',    preferredMovements: ['horizontal_push'], maxLoad: null, maxFatigue: null, requireUnilateral: null },
        { role: 'secondary',  preferredMovements: ['vertical_push'],   maxLoad: 'moderate', maxFatigue: null, requireUnilateral: null },
        { role: 'accessory',  preferredMovements: ['horizontal_push'], maxLoad: 'moderate', maxFatigue: 'moderate', requireUnilateral: null },
        { role: 'accessory',  preferredMovements: ['isolation_upper'],  maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
        { role: 'finisher',   preferredMovements: ['isolation_upper', 'horizontal_pull'], maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
      ],
    };
  }

  // ── Upper Pull ──
  if (name.includes('upper') && name.includes('pull')) {
    return {
      targetMovements: ['horizontal_pull', 'vertical_pull'],
      targetRegion: 'upper',
      exerciseCount,
      slots: [
        { role: 'primary',    preferredMovements: ['vertical_pull'],    maxLoad: null, maxFatigue: null, requireUnilateral: null },
        { role: 'secondary',  preferredMovements: ['horizontal_pull'],  maxLoad: 'moderate', maxFatigue: null, requireUnilateral: null },
        { role: 'accessory',  preferredMovements: ['horizontal_pull'],  maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
        { role: 'accessory',  preferredMovements: ['isolation_upper'],   maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
        { role: 'finisher',   preferredMovements: ['isolation_upper'],   maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
      ],
    };
  }

  // ── Upper Strength / Hypertrophy (mixed push + pull) ──
  if (name.includes('upper')) {
    return {
      targetMovements: ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'],
      targetRegion: 'upper',
      exerciseCount,
      slots: [
        { role: 'primary',    preferredMovements: ['horizontal_push'],  maxLoad: null, maxFatigue: null, requireUnilateral: null },
        { role: 'secondary',  preferredMovements: ['horizontal_pull'],  maxLoad: 'moderate', maxFatigue: null, requireUnilateral: null },
        { role: 'secondary',  preferredMovements: ['vertical_push'],    maxLoad: 'moderate', maxFatigue: null, requireUnilateral: null },
        { role: 'accessory',  preferredMovements: ['vertical_pull', 'horizontal_pull'], maxLoad: 'low', maxFatigue: 'moderate', requireUnilateral: null },
        { role: 'finisher',   preferredMovements: ['isolation_upper'],   maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
      ],
    };
  }

  // ── Full Body ──
  if (name.includes('full body')) {
    return {
      targetMovements: ['squat', 'hinge', 'horizontal_push', 'horizontal_pull', 'carry'],
      targetRegion: null,
      exerciseCount,
      slots: [
        { role: 'primary',    preferredMovements: ['squat'],            maxLoad: null, maxFatigue: null, requireUnilateral: null },
        { role: 'secondary',  preferredMovements: ['horizontal_push'],  maxLoad: 'moderate', maxFatigue: null, requireUnilateral: null },
        { role: 'secondary',  preferredMovements: ['horizontal_pull'],  maxLoad: 'moderate', maxFatigue: null, requireUnilateral: null },
        { role: 'accessory',  preferredMovements: ['hinge'],            maxLoad: 'moderate', maxFatigue: 'moderate', requireUnilateral: null },
        { role: 'finisher',   preferredMovements: ['carry'],            maxLoad: 'moderate', maxFatigue: 'low', requireUnilateral: null },
      ],
    };
  }

  // ── Arms / Pump (pre-game) ──
  if (name.includes('arm') || name.includes('pump') || name.includes('gun show')) {
    return {
      targetMovements: ['isolation_upper', 'horizontal_pull'],
      targetRegion: 'upper',
      exerciseCount,
      slots: [
        { role: 'primary',    preferredMovements: ['isolation_upper'],   maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
        { role: 'secondary',  preferredMovements: ['isolation_upper'],   maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
        { role: 'accessory',  preferredMovements: ['horizontal_pull'],   maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
        { role: 'accessory',  preferredMovements: ['isolation_upper'],   maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
        { role: 'finisher',   preferredMovements: ['isolation_upper'],   maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
      ],
    };
  }

  // ── Default: mixed (fallback) ──
  return {
    targetMovements: ['squat', 'hinge', 'horizontal_push', 'horizontal_pull'],
    targetRegion: null,
    exerciseCount,
    slots: [
      { role: 'primary',    preferredMovements: ['squat'],            maxLoad: null, maxFatigue: null, requireUnilateral: null },
      { role: 'secondary',  preferredMovements: ['horizontal_push'],  maxLoad: 'moderate', maxFatigue: null, requireUnilateral: null },
      { role: 'secondary',  preferredMovements: ['horizontal_pull'],  maxLoad: 'moderate', maxFatigue: null, requireUnilateral: null },
      { role: 'accessory',  preferredMovements: ['hinge'],            maxLoad: 'moderate', maxFatigue: 'moderate', requireUnilateral: null },
      { role: 'finisher',   preferredMovements: ['carry', 'core'],    maxLoad: 'low', maxFatigue: 'low', requireUnilateral: null },
    ],
  };
}

// ─── Helpers ───

function isLateWeek(dow: number): boolean {
  return dow === 4 || dow === 5;
}

type InjuryArea = keyof ExerciseTag['injury'];

const AREA_MAP: Record<string, InjuryArea> = {
  'adductor': 'adductor', 'adductors': 'adductor', 'groin': 'adductor',
  'pubalgia': 'pubalgia',
  'lower back': 'lowerBack', 'lower_back': 'lowerBack', 'back': 'lowerBack',
  'knee': 'knee', 'knees': 'knee',
  'hamstring': 'hamstring', 'hamstrings': 'hamstring',
  'calf': 'calf', 'calves': 'calf',
  'ankle': 'ankle', 'ankles': 'ankle',
  'shoulder': 'shoulder', 'shoulders': 'shoulder',
  'elbow': 'elbow', 'elbows': 'elbow',
  'wrist': 'wrist', 'wrists': 'wrist',
};

function normaliseArea(raw: string): InjuryArea | null {
  return AREA_MAP[raw.toLowerCase().trim()] || null;
}
