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

/* ── Readiness ── */

/** "the next 7 days are deloaded" — a rolling window, not a calendar week. */
export const READINESS_DELOAD_WINDOW_DAYS = 7;

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
 * What an illness tier does. EXACTLY two fields, by Sam's law — "severity
 * decides exactly two things: deload or not, optional or not. No other
 * illness-specific numbers may exist."
 *
 * Adding a third field here would be the beginning of a private illness dosing
 * system, which is what the law forbids; the test asserts the key set.
 */
export interface IllnessDirective {
  readonly deloaded: boolean;
  readonly sessionsOptional: boolean;
}

/**
 * Note what is absent: any window. Moderate and severe hold while the illness
 * fact is ACTIVE, on the existing illness horizon — open until cleared. That is
 * a different horizon from readiness's fixed 7 days, and carrying a window here
 * would invite a caller to apply the wrong one.
 */
export function resolveIllnessDirective(tier: IllnessSeverityTier): IllnessDirective {
  switch (tier) {
    case 'mild':
      // Training unchanged. The illness is still logged as a fact, and that
      // fact can lower readiness — which may open a readiness deload by its
      // own door. This law does not reach into the program.
      return { deloaded: false, sessionsOptional: false };
    case 'moderate':
      return { deloaded: true, sessionsOptional: false };
    case 'severe':
      return { deloaded: true, sessionsOptional: true };
  }
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
