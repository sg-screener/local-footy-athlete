/**
 * Deterministic power / contrast primer policy.
 *
 * PURPOSE
 * -------
 * Decide whether a strength session should carry a small, high-quality power
 * primer (or contrast intent), per the Bible's "Power / explosive rules"
 * (§ Power work). This is NOT a new hard-session system: it is a low-dose,
 * fresh-only, quality-first layer that attaches to a SUITABLE strength session
 * and never forces extra sessions, conditioning, or fatigue.
 *
 * The engine (which owns phase, game proximity, readiness, injury, deload and
 * beginner state) calls `decidePowerPrimer` and stamps the returned typed spec
 * on the session allocation. The rendering layer turns that spec into a
 * separate `powerBlock` — power is never mixed into the conditioning block and
 * never becomes a finisher.
 *
 * SAFETY MODEL (every gate that can say "no"):
 *  - Only strength sessions (must have a strengthPattern).
 *  - Deload week           → no fatiguing power.
 *  - Low readiness         → no power (quality would be poor).
 *  - Game day / G-1 / G+1  → no added power.
 *  - G-2                   → only a tiny neural primer, experienced + high
 *                            readiness only.
 *  - Active relevant injury (≥ moderate) → no power through that region;
 *                            mild niggle → reduced dose only.
 *  - Beginner              → conservative: tiny primer, off/pre-season only,
 *                            never contrast, never in-season.
 *  - Phase                 → off-season expresses most; pre-season controlled
 *                            (extra caution on team days); in-season tiny only.
 *  - Role/goal power nudge → can upgrade an already-allowed primer to contrast
 *                            in off/pre-season, but never creates power where a
 *                            gate said no.
 * Equipment is enforced downstream at exercise selection (bodyweight jumps /
 * explosive push-ups are the default, so equipment can only *substitute*, never
 * force an unavailable implement).
 */

import type { SeasonPhase, ReadinessLevel } from '../types/domain';

export type PowerFamily = 'lower' | 'upper';
export type PowerKind = 'primer' | 'contrast';

/** Typed power intent stamped on a session allocation by the engine. */
export interface PowerPrimerSpec {
  kind: PowerKind;
  family: PowerFamily;
  /** Contrast sets (2-4). */
  sets: number;
  /** Power-movement reps (2-5). */
  repsMin: number;
  repsMax: number;
  /** True when dose was reduced for a mild same-region niggle. */
  reduced: boolean;
  /** Human-readable reason for tests/debug. */
  reason: string;
}

/** Minimal injury shape the policy needs (area text + 1-10 severity). */
export interface PowerInjuryInput {
  area: string;
  severity: number;
}

export interface PowerPrimerContext {
  phase: SeasonPhase;
  /** Strength pattern of the session — power only attaches to strength days. */
  strengthPattern?: 'lower' | 'lower_combined' | 'push' | 'pull' | 'upper_combined' | 'full_body';
  /** Whether a real game is scheduled this week. */
  hasGame: boolean;
  /** Game offset for this day (0 = game, -1 = G-1, -2 = G-2, +1 = day after). */
  gOffset: number;
  /** True when the strength session lands on a team-training day. */
  isTeamDay: boolean;
  readiness: ReadinessLevel;
  isDeload: boolean;
  isBeginner: boolean;
  /** Experienced enough for a G-2 neural primer (2+ years training age). */
  experienced: boolean;
  injuries: PowerInjuryInput[];
  /** Role/goal power/speed/strength signal — nudges quality, never forces. */
  powerGoalNudge: boolean;
}

const LOWER_LIMB_RX = /\b(knee|patella|acl|mcl|meniscus|calf|achilles|ankle|groin|adductor|hamstring|hammy|hip|quad|shin|glute|lower ?back|lowerback|lumbar)\b/i;
const UPPER_LIMB_RX = /\b(shoulder|pec|rotator|elbow|wrist|forearm|rib|neck)\b/i;

/** Moderate+ severity removes power through the affected region. */
const INJURY_BLOCK_SEVERITY = 4;

function familyFromPattern(pattern: PowerPrimerContext['strengthPattern']): PowerFamily {
  switch (pattern) {
    case 'push':
    case 'pull':
    case 'upper_combined':
      return 'upper';
    // lower, lower_combined, full_body → lower-body power (jumps) best supports
    // footy athleticism.
    default:
      return 'lower';
  }
}

/** Highest severity among injuries matching this family's region. */
function regionInjurySeverity(family: PowerFamily, injuries: PowerInjuryInput[]): number {
  const rx = family === 'lower' ? LOWER_LIMB_RX : UPPER_LIMB_RX;
  let max = 0;
  for (const inj of injuries) {
    if (rx.test(inj.area) && inj.severity > max) max = inj.severity;
  }
  return max;
}

function spec(
  kind: PowerKind,
  family: PowerFamily,
  sets: number,
  repsMin: number,
  repsMax: number,
  reduced: boolean,
  reason: string,
): PowerPrimerSpec {
  return { kind, family, sets, repsMin, repsMax, reduced, reason };
}

/**
 * Decide the power primer for a single strength session, or null when no power
 * should be added. Pure and deterministic.
 */
export function decidePowerPrimer(ctx: PowerPrimerContext): PowerPrimerSpec | null {
  // ── Only suitable strength sessions ──
  if (!ctx.strengthPattern) return null;

  // ── Hard blocks: deload, low readiness ──
  if (ctx.isDeload) return null;
  if (ctx.readiness === 'low') return null;

  const family = familyFromPattern(ctx.strengthPattern);
  const regionSeverity = regionInjurySeverity(family, ctx.injuries);
  if (regionSeverity >= INJURY_BLOCK_SEVERITY) return null; // injury wins
  const reduced = regionSeverity > 0; // mild niggle → reduced dose

  // ── Game proximity (only meaningful when a game is scheduled) ──
  if (ctx.hasGame) {
    const g = ctx.gOffset;
    if (g === 0) return null;   // game day
    if (g === 1) return null;   // day after game — not fresh
    if (g === -1) return null;  // G-1 — no meaningful power loading
    if (g === -2) {
      // Tiny neural primer only: experienced, high readiness, no niggle.
      if (ctx.isBeginner || !ctx.experienced || ctx.readiness !== 'high' || reduced) {
        return null;
      }
      return spec('primer', family, 2, 3, 3, false, 'G-2 tiny neural primer (experienced, fresh)');
    }
    // g <= -3 (or +>1, which won't occur) → treated as clear of the game.
  }

  // ── Beginner: conservative low-risk prep only ──
  if (ctx.isBeginner) {
    if (ctx.phase === 'In-season') return null; // skip in-season for beginners
    return spec('primer', family, 2, 3, 3, reduced, 'Beginner conservative low-risk power prep');
  }

  // ── In-season: only a small, familiar, non-fatiguing primer ──
  if (ctx.phase === 'In-season') {
    return spec('primer', family, 2, 3, 3, reduced, 'In-season small familiar power primer');
  }

  // ── Off-season / Pre-season dosing ──
  const isPreseasonTeamDay = ctx.phase === 'Pre-season' && ctx.isTeamDay;

  // Contrast is the higher-quality option — only when fresh (high readiness),
  // no niggle, and not stacked on a pre-season team day.
  const contrastEligible = ctx.readiness === 'high' && !reduced && !isPreseasonTeamDay;
  // Off-season is the best time to build power → contrast by default when
  // eligible. Pre-season only upgrades to contrast when the athlete's goal
  // actually pulls toward power (nudge, not force).
  const useContrast = contrastEligible && (ctx.phase === 'Off-season' || ctx.powerGoalNudge);

  if (useContrast) {
    return spec('contrast', family, 3, 3, 5, false, `${ctx.phase} contrast power (fresh, high quality)`);
  }

  // Primer. Pre-season team days keep the dose minimal to avoid stacking with
  // team-training load; mild niggle also trims the dose.
  const sets = isPreseasonTeamDay || reduced ? 2 : 3;
  const reason = isPreseasonTeamDay
    ? 'Pre-season team-day primer (kept low to respect team load)'
    : `${ctx.phase} power primer`;
  return spec('primer', family, sets, 3, 3, reduced, reason);
}
