/**
 * THE READINESS LAW + THE ILLNESS LAW — Sam, 2026-07-27 (Bible §14, §19).
 *
 * Both doors deload. Neither invents its own reductions: they decide WHETHER
 * and FOR HOW LONG, and `DELOAD_LAW` decides what a deload does. That split is
 * the point — an illness-specific or readiness-specific set of numbers is
 * exactly what these laws retired.
 *
 * ── Readiness ──
 *
 * Low readiness, declared by the athlete or detected by the app, deloads THE
 * NEXT 7 DAYS: a rolling window from the declaration day, NOT the remainder of
 * the calendar week. Declaring on a Friday deloads the following week, not just
 * the weekend.
 *
 * The four-tier system it replaces (slight / moderate / major / full pause) is
 * retired down to the TYPE. Readiness exposes deloaded-or-not, so it cannot
 * grow graduations back. Three consequences, all deliberate:
 *
 *   - There is no full pause. The app never empties a week on readiness alone;
 *     the athlete can always skip, and severe cases route through the illness
 *     or injury doors.
 *   - Readiness never REMOVES sessions. The old tiers cut session counts by
 *     degree, and counts are structure — which the deload law holds constant
 *     while the work inside shrinks.
 *   - Nothing preserves the graduations in another form. Every graduated site
 *     was graduating on how much to cut from the week, and the law abolishes
 *     that behaviour rather than rescaling it.
 *
 * ── Illness ──
 *
 * Three tiers, and severity decides exactly TWO things: deload or not, optional
 * or not. Moderate and severe stay deloaded while the illness fact is ACTIVE —
 * open until cleared, on the existing illness horizon, NOT the readiness law's
 * fixed 7 days. Confusing those two horizons is the obvious mistake here, so
 * the illness directive deliberately carries no window at all.
 */

/* ── The shape both doors share ── */

/**
 * What a tier DOES. EXACTLY two fields, by Sam's law — "severity decides
 * exactly two things: deload or not, optional or not."
 *
 * Adding a third field here would be the beginning of a private dosing system,
 * which is what these laws retired; the test asserts the key set.
 */
export interface TierDirective {
  readonly deloaded: boolean;
  readonly sessionsOptional: boolean;
}

/**
 * The ONE tier ladder. Both doors have three tiers and both map them the same
 * way, so the mapping lives once:
 *
 *   noted     nothing happens to the program
 *   deloaded  the deload transform applies; every minimum still stands
 *   optional  deloaded AND nothing is required
 *
 * The doors differ in exactly ONE thing, and it is not this: the HORIZON.
 * Readiness runs a fixed 7-day rolling window; illness holds open until
 * cleared. Keeping the ladder shared is what stops one door growing a dose the
 * other lacks.
 */
export type LawTier = 'noted' | 'deloaded' | 'optional';

const NOTHING: TierDirective = { deloaded: false, sessionsOptional: false };

export function resolveTierDirective(tier: LawTier): TierDirective {
  switch (tier) {
    case 'noted':
      // The fact is still RECORDED and can move other signals; this law simply
      // does not reach into the program.
      return NOTHING;
    case 'deloaded':
      return { deloaded: true, sessionsOptional: false };
    case 'optional':
      return { deloaded: true, sessionsOptional: true };
  }
}

/* ── Readiness ── */

/** "the next 7 days are deloaded" — a rolling window, not a calendar week. */
export const READINESS_DELOAD_WINDOW_DAYS = 7;

/**
 * THE READINESS DOOR — three tiers, Sam's labels (2026-07-27).
 *
 *   tired              "Tired"             noted only
 *   wrecked            "Wrecked"           7 days deloaded
 *   absolutely_cooked  "Absolutely cooked" 7 days deloaded + every session optional
 *
 * This SUPERSEDES the two-level draft and the original single boolean. Note
 * what "absolutely cooked" does NOT do: it does not empty the week. It lifts
 * the MINIMUMS so nothing is required, and the sessions remain, offered — which
 * is how "the app never empties a week on readiness alone" survives alongside a
 * third tier.
 */
export type ReadinessTier = 'tired' | 'wrecked' | 'absolutely_cooked';

export const READINESS_TIERS: readonly ReadinessTier[] = [
  'tired',
  'wrecked',
  'absolutely_cooked',
];

/**
 * THE SEVERITY LADDER -> TIER, OWNED HERE.
 *
 * This lived privately inside `generationConstraints.readinessTierFromConstraint`
 * while only that module needed it. The READINESS DOOR needs the same answer —
 * it has to know whether a declaration deloads before it can decide whether to
 * attach the 7-day window — and two copies of a threshold is how a door and a
 * generator start disagreeing about what "wrecked" means.
 */
export function readinessTierForSeverity(severity: number): ReadinessTier {
  return severity >= 8 ? 'absolutely_cooked' : severity >= 4 ? 'wrecked' : 'tired';
}

export function resolveReadinessDirective(tier: ReadinessTier): TierDirective {
  return resolveTierDirective(
    tier === 'absolutely_cooked' ? 'optional' : tier === 'wrecked' ? 'deloaded' : 'noted',
  );
}

export interface ReadinessDeloadWindow {
  /** Inclusive first day: the day the low-readiness call was made. */
  readonly startISO: string;
  /** Inclusive last day, 7 days of deload in total. */
  readonly endISO: string;
}

function addDaysISO(iso: string, days: number): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  // UTC arithmetic on a date-only value: no timezone can shift the day across a
  // boundary, which a local-time Date would do for half the world.
  const base = Date.UTC(year, month - 1, day);
  const moved = new Date(base + days * 24 * 60 * 60 * 1000);
  return moved.toISOString().slice(0, 10);
}

/**
 * The deload window a low-readiness call opens, or null when readiness is fine.
 *
 * Deliberately returns a WINDOW and nothing else — no tier, no severity, no
 * magnitude. A caller that wants to know "how bad" is asking the question this
 * law removed.
 */
export function resolveReadinessDeload(input: {
  readonly declaredOnISO: string;
  readonly lowReadiness: boolean;
}): ReadinessDeloadWindow | null {
  if (!input.lowReadiness) return null;
  const startISO = input.declaredOnISO.slice(0, 10);
  return {
    startISO,
    // Inclusive of the declaration day, so the 7th day is start + 6.
    endISO: addDaysISO(startISO, READINESS_DELOAD_WINDOW_DAYS - 1),
  };
}

/** Whether a date falls inside an open readiness deload window. */
export function isDateInReadinessDeloadWindow(
  dateISO: string,
  window: ReadinessDeloadWindow,
): boolean {
  const date = dateISO.slice(0, 10);
  return date >= window.startISO && date <= window.endISO;
}

/* ── Illness ── */

export type IllnessSeverityTier = 'mild' | 'moderate' | 'severe';

export const ILLNESS_SEVERITY_TIERS: readonly IllnessSeverityTier[] = [
  'mild',
  'moderate',
  'severe',
];

/**
 * Illness speaks the same directive as readiness. Kept as an alias rather than
 * a second interface: two identically-shaped types are how two dosing systems
 * start.
 */
export type IllnessDirective = TierDirective;

/**
 * Note what is absent: any window. Moderate and severe hold while the illness
 * fact is ACTIVE, on the existing illness horizon — open until cleared. That is
 * a different horizon from readiness's fixed 7 days, and carrying a window here
 * would invite a caller to apply the wrong one.
 */
export function resolveIllnessDirective(tier: IllnessSeverityTier): IllnessDirective {
  // The same ladder readiness uses. MILD is 'noted': the illness is still
  // logged as a fact, and that fact can lower readiness — which may open a
  // deload by the OTHER door. This law does not reach into the program.
  return resolveTierDirective(
    tier === 'severe' ? 'optional' : tier === 'moderate' ? 'deloaded' : 'noted',
  );
}

/* ── The one question a generator asks ── */

/**
 * Whether a given day is deloaded, and whether its sessions are optional.
 *
 * The single read point for both doors. A generator asks this and gets two
 * booleans; it never asks how bad the readiness is or how ill the athlete is,
 * because those questions no longer have answers.
 */
export function resolveDayDirective(input: {
  readonly dateISO: string;
  readonly readinessWindow?: ReadinessDeloadWindow | null;
  readonly activeIllnessTier?: IllnessSeverityTier | null;
  /** A scheduled deload week already resolved by `resolveDeloadWeekPolicy`. */
  readonly scheduledDeload?: boolean;
}): IllnessDirective {
  const illness = input.activeIllnessTier
    ? resolveIllnessDirective(input.activeIllnessTier)
    : { deloaded: false, sessionsOptional: false };

  const readinessDeloaded = !!input.readinessWindow
    && isDateInReadinessDeloadWindow(input.dateISO, input.readinessWindow);

  return {
    deloaded: illness.deloaded || readinessDeloaded || !!input.scheduledDeload,
    sessionsOptional: illness.sessionsOptional,
  };
}
