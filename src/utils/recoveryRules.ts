/**
 * Recovery Rules — Category selection and placement guard.
 *
 * Pure functions. No React. No Zustand.
 *
 * Three recovery categories:
 *   Passive  — tissue quality + breathing only. For low readiness or
 *              high accumulated fatigue. Lightest option (15 min).
 *   Active   — tissue quality + mobility + easy cyclical + breathing.
 *              Standard recovery session (30 min).
 *   Extended — active recovery + low-load trunk / prehab work.
 *              For high-readiness days away from games (40 min).
 *              NOT additional training volume.
 *
 * Placement rules:
 *   - Recovery fills truly empty days AFTER strength and conditioning
 *   - Never coexists with strength or conditioning on the same day
 *   - G+1 recovery is handled by game proximity in the resolver
 *     (this engine handles non-G+1 recovery days only)
 *   - Non-forcing: returns null when full rest is the correct outcome
 *
 * Frequency guards by season:
 *   In-season:   max 2 recovery sessions per week
 *   Pre-season:  max 3 recovery sessions per week
 *   Off-season:  max 3 recovery sessions per week
 *
 * IMPORTANT: Extended Recovery is a low-load capacity / prehab session,
 * NOT additional training volume. It must remain fatigue: low, doms: low,
 * with no progressive overload intent. All components must pass the same
 * hard filter as recovery.
 */

import type { SeasonPhase, ReadinessLevel } from '../types/domain';
import type { ConditioningTier } from '../data/exerciseTags';
import type { DerivedSessionType } from './sessionBuilder';

// ─── Types ───

export type RecoveryCategory = 'passive' | 'active' | 'extended';

export interface RecoveryResult {
  /** Which recovery category to build. */
  category: RecoveryCategory;
  /** Maps to DerivedSessionType for the session builder. */
  derivedType: DerivedSessionType;
}

// ─── Frequency Caps ───

function getMaxRecoveryPerWeek(phase: SeasonPhase): number {
  switch (phase) {
    case 'In-season':  return 2;
    case 'Pre-season': return 3;
    case 'Off-season': return 3;
    default:           return 2;
  }
}

// ─── Main API ───

/**
 * Resolve which recovery session (if any) should be placed on a given date.
 *
 * Non-forcing: returns null if no recovery should be placed (full rest
 * is the correct outcome, or weekly cap already reached).
 *
 * Called only for days that are truly empty — no strength, no conditioning,
 * no game, no rest mark, no manual override. The resolver guarantees this.
 *
 * @param daysToGame        - Days until next game (null if no upcoming game)
 * @param daysSinceGame     - Days since last game (null if no recent game)
 * @param seasonPhase       - Current season phase
 * @param readiness         - Athlete readiness level
 * @param weekRecoveryCount - Recovery sessions already placed this week
 *                            (including G+1 from game proximity)
 * @param recentHighTier    - Whether Tier A or B-high conditioning was placed
 *                            within 24h (yesterday or today in the week)
 * @returns                 - RecoveryResult or null (full rest)
 */
export function resolveRecovery(
  daysToGame: number | null,
  daysSinceGame: number | null,
  seasonPhase: SeasonPhase,
  readiness: ReadinessLevel,
  weekRecoveryCount: number,
  recentHighTier: boolean,
): RecoveryResult | null {
  // ── Frequency guard ──
  const maxRecovery = getMaxRecoveryPerWeek(seasonPhase);
  if (weekRecoveryCount >= maxRecovery) return null;

  // ── Category selection based on readiness ──
  if (readiness === 'low') {
    return { category: 'passive', derivedType: 'passive_recovery' };
  }

  if (readiness === 'medium') {
    return { category: 'active', derivedType: 'recovery' };
  }

  // readiness === 'high' → Extended Recovery eligible, but check guards
  //
  // Extended Recovery restrictions:
  //   - Not within 48h of game (allow recovery time, not prehab)
  //   - Not the day after Tier A/B-high conditioning (CNS recovery needed)
  //   Both restrictions fall back to Active Recovery, not null.

  if (daysToGame !== null && daysToGame <= 2) {
    return { category: 'active', derivedType: 'recovery' };
  }

  if (recentHighTier) {
    return { category: 'active', derivedType: 'recovery' };
  }

  return { category: 'extended', derivedType: 'extended_recovery' };
}

// ─── Exports for Testing ───

export { getMaxRecoveryPerWeek };
