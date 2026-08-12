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
 * A DELOAD IS NOT A GATE (Sam's deload law, 2026-07-27). This policy used to
 * take `isDeload` and return null on a deload week — power removed entirely.
 * The law supersedes that: "Power/speed: KEEP a small sharp dose … a deload is
 * not a reason to lose sharpness." A deload changes the DOSE, and the dose
 * transform is `deloadPowerDose`'s job, applied where the block is built. So
 * the input is gone rather than inverted: there is no deload field left here
 * to grow a branch on, which is what stops the removal coming back.
 *
 * CAPACITY IS A DOSE, NOT A GATE (Sam's readiness law, 2026-07-28). Low
 * readiness used to `return null` here — power removed entirely — on the
 * reasoning that the capacity score was a different signal from the readiness
 * declaration. The ruling closed that exemption: "capacity/readiness affects
 * DOSE only". It is the deload sentence one step along, so it takes the deload
 * answer: the same authored `deloadPowerDose` shrink, applied once, at the end.
 *
 * That placement is the point. The decision body below now contains no readiness
 * branch that can return `null`, so there is no gate left for the removal to
 * grow back on — exactly how the deload input was retired rather than inverted.
 *
 * SAFETY MODEL (every gate that can say "no"):
 *  - Only strength sessions (must have a strengthPattern).
 *  - Game day / G-1 / G+1  → no added power.
 *  - G-2                   → only a tiny neural primer, experienced only; below
 *                            high capacity it shrinks rather than disappears.
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
import { deloadPowerDose } from './deloadWeekRules';
import type { OffseasonSubphase } from './offseasonSubphase';

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
  /** Required for aggressive off-season power; missing context is early/safe. */
  offseasonSubphase?: OffseasonSubphase | null;
  /** Strength pattern of the session — power only attaches to strength days. */
  strengthPattern?: 'lower' | 'lower_combined' | 'push' | 'pull' | 'upper_combined' | 'full_body';
  /** Whether a real game is scheduled this week. */
  hasGame: boolean;
  /** Game offset for this day (0 = game, -1 = G-1, -2 = G-2, +1 = day after). */
  gOffset: number;
  /** True when the strength session lands on a team-training day. */
  isTeamDay: boolean;
  readiness: ReadinessLevel;
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
 * Whether this athlete's capacity shrinks the power dose in this window.
 *
 * Two cases, both of which used to remove power outright:
 *   - low capacity anywhere;
 *   - anything below high capacity at G-2, where the full dose is already the
 *     smallest one the policy hands out.
 *
 * The G-2 WINDOW itself is a schedule fact and keeps its own gates. Only the
 * readiness half of that gate became a dose.
 */
function capacityShrinksDose(ctx: PowerPrimerContext): boolean {
  if (ctx.readiness === 'low') return true;
  return ctx.hasGame && ctx.gOffset === -2 && ctx.readiness !== 'high';
}

/** Apply the authored deload power shrink to a decided spec. */
function shrunkSharpPrimer(full: PowerPrimerSpec): PowerPrimerSpec {
  const dose = deloadPowerDose({
    sets: full.sets,
    repsMin: full.repsMin,
    repsMax: full.repsMax,
  });
  // `deloadPowerDose` returns null only if the deload law stops keeping power
  // at all. If that ever changes, low capacity must not be the path that
  // discovers it — keep the exposure and let the deload gate say so.
  if (!dose) return full;
  return { ...full, ...dose, reason: `${full.reason} — reduced dose for low capacity` };
}

/**
 * Decide the power primer for a single strength session, or null when no power
 * should be added. Pure and deterministic.
 *
 * Capacity is applied HERE and nowhere inside: one place, one transform, no
 * branch that can turn a shrink back into a removal.
 */
export function decidePowerPrimer(ctx: PowerPrimerContext): PowerPrimerSpec | null {
  const full = decideFullPowerPrimer(ctx);
  if (!full) return null;
  return capacityShrinksDose(ctx) ? shrunkSharpPrimer(full) : full;
}

/** The power decision at full capacity — phase, schedule, injury and training age. */
function decideFullPowerPrimer(ctx: PowerPrimerContext): PowerPrimerSpec | null {
  // ── Only suitable strength sessions ──
  if (!ctx.strengthPattern) return null;

  // ── Off-season progression ──
  // Missing subphase is deliberately treated as early off-season. Power is
  // rebuilt progressively: none early, primer-only mid, contrast eligibility
  // only late after every other safety gate passes.
  const offseasonSubphase = ctx.phase === 'Off-season'
    ? (ctx.offseasonSubphase ?? 'early_offseason')
    : null;
  if (offseasonSubphase === 'early_offseason') return null;

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
      // Tiny neural primer only: experienced, no niggle. Capacity below high
      // shrinks this dose (see `capacityShrinksDose`) rather than removing it.
      if (ctx.isBeginner || !ctx.experienced || reduced) {
        return null;
      }
      return spec('primer', family, 2, 3, 3, false, 'G-2 tiny neural primer (experienced)');
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
  //
  // AND ONLY AT `consistent` OR `advanced` ON THE LADDER (census A2). Sam, Bible
  // `:225`, restated `:4940`: *"Contrast is allowed only for athletes at
  // training age `consistent` or `advanced`. A `developing` athlete does not
  // receive contrast work."*
  //
  // THE RUNG WAS NOWHERE IN THIS EXPRESSION. It read readiness, niggle and
  // team-day only, and the one experience input in scope — `ctx.isBeginner` — is
  // `level === 'new'`, so a `developing` athlete (the "1-2 years" answer) sailed
  // through and received true contrast prescriptions TWO RUNGS below his gate.
  //
  // `ctx.experienced` IS THE RUNG, ALREADY CORRECT AND ALREADY SUPPLIED: it is
  // `'2-5 years' || '5+ years'`, which the experience crosswalk maps to exactly
  // `consistent` and `advanced`. No new field, no second representation — the
  // input was here and the gate did not read it.
  const contrastEligible = ctx.readiness === 'high' && !reduced && !isPreseasonTeamDay
    && ctx.experienced;
  // Off-season is the best time to build power → contrast by default when
  // eligible. Pre-season only upgrades to contrast when the athlete's goal
  // actually pulls toward power (nudge, not force).
  const offseasonContrastEligible =
    ctx.phase === 'Off-season' && offseasonSubphase === 'late_offseason';
  const useContrast = contrastEligible && (offseasonContrastEligible || (
    ctx.phase === 'Pre-season' && ctx.powerGoalNudge
  ));

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
