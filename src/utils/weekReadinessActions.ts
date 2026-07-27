/**
 * weekReadinessActions — the SINGLE pure owner of the readiness tier → durable
 * ProgramControlAction mapping.
 *
 * After the 0.2 door unification there is exactly one "I'm not 100%" committer:
 * the week-level readiness sheet's `handleApplyWeekReadiness`. Both entry points
 * (the week-card and the day-card door, which now merely opens the same sheet)
 * commit through this mapping, so the two doors cannot diverge by construction
 * (invariant R16). Keeping the mapping pure and in one place — rather than
 * inlined in the hook and copied into tests — is what makes that guarantee
 * testable against the real owner instead of a drifting duplicate.
 */

import type { ProgramControlAction } from './programControlActions';
import type { IllnessSeverityTier } from '../rules/readinessIllnessLaw';

/**
 * The athlete-facing readiness tiers the week sheet can apply (injury + busy
 * are separate ingresses, not fact commits, so they are not here).
 */
export type WeekReadinessApplyKind =
  | 'tired_today'
  | 'poor_sleep_today'
  | 'poor_sleep_week'
  | 'cooked_week'
  | 'sore_today'
  // THE THREE SICK DOORS (Sam, 2026-07-27) — one per illness tier, named for
  // the tier. The old kinds were `sniffle_today` and `sick_week`, which named a
  // SCOPE; scope is now DERIVED from the tier (mild is today-scoped, moderate
  // and severe hold until cleared), so those names described a choice the
  // athlete no longer makes.
  | 'illness_mild'
  | 'illness_moderate'
  | 'illness_severe';

const READINESS_SOURCE = {
  screen: 'program_tab',
  surface: 'week_readiness_sheet',
  initiatedBy: 'tap',
} as const;

/**
 * Map a readiness tier to the durable action the owner commits. Week-scoped
 * tiers anchor to the viewed week's Monday; today-scoped tiers anchor to today.
 *
 * The three sick doors write the tier and NOTHING else. What each tier does is
 * THE ILLNESS LAW's answer, resolved downstream — this file must never grow a
 * second opinion about it.
 *
 * - `illness_mild` ("A bit off") → MILD, record-only and inert. Today-scoped;
 *   the sheet surfaces the opt-in "soften today?" offer.
 * - `illness_moderate` ("Properly sick") → MODERATE. Deloads while active, and
 *   every minimum still stands.
 * - `illness_severe` ("Can't get out of bed") → SEVERE. Deloads AND lifts every
 *   minimum, deriving the illness_recovery §18 week mode — never a
 *   shutdown_week or recovery-mode writer.
 *
 * Moderate and severe are BOTH week-scoped: they hold until cleared on the
 * illness horizon, so the scope follows which tiers derive, not which is worst.
 */
export function readinessActionForKind(
  kind: WeekReadinessApplyKind,
  ctx: { anchorDateISO: string; todayISO: string },
): ProgramControlAction {
  const { anchorDateISO, todayISO } = ctx;

  if (kind === 'illness_mild' || kind === 'illness_moderate' || kind === 'illness_severe') {
    const severity: IllnessSeverityTier = kind === 'illness_severe'
      ? 'severe'
      : kind === 'illness_moderate' ? 'moderate' : 'mild';
    // MILD records today. The deriving tiers hold until cleared, so they anchor
    // to the viewed week rather than a single day.
    const weekScoped = severity !== 'mild';
    return {
      type: 'set_illness_status',
      source: READINESS_SOURCE,
      scope: weekScoped ? 'current_week' : 'today_only',
      payload: { date: weekScoped ? anchorDateISO : todayISO, todayISO, severity },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    };
  }

  if (kind === 'poor_sleep_today' || kind === 'poor_sleep_week') {
    const week = kind === 'poor_sleep_week';
    return {
      type: 'set_poor_sleep_status',
      source: READINESS_SOURCE,
      scope: week ? 'current_week' : 'today_only',
      payload: {
        date: week ? anchorDateISO : todayISO,
        todayISO,
        pattern: week ? 'repeated' : 'single_night',
      },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    };
  }

  // tired_today | sore_today | cooked_week → fatigue source fact.
  const cooked = kind === 'cooked_week';
  return {
    type: 'set_fatigue_status',
    source: READINESS_SOURCE,
    scope: cooked ? 'current_week' : 'today_only',
    payload: {
      date: cooked ? anchorDateISO : todayISO,
      todayISO,
      level: cooked ? 'cooked' : kind === 'sore_today' ? 'sore' : 'low_energy',
    },
    requiresRebuild: false,
    createsActiveModifier: true,
    oneOffOnly: false,
  };
}
