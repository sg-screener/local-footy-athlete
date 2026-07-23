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
  | 'sniffle_today'
  | 'sick_week';

const READINESS_SOURCE = {
  screen: 'program_tab',
  surface: 'week_readiness_sheet',
  initiatedBy: 'tap',
} as const;

/**
 * Map a readiness tier to the durable action the owner commits. Week-scoped
 * tiers anchor to the viewed week's Monday; today-scoped tiers anchor to today.
 *
 * - `sick_week` → SEVERE illness week-fact (derives the illness_recovery §18
 *   week mode: minimums lifted, remaining work optional/reduced — never a
 *   shutdown_week or recovery-mode writer).
 * - `sniffle_today` → MINOR illness (record-only + inert; the sheet surfaces the
 *   opt-in "soften today?" offer for today-scoped tiers).
 */
export function readinessActionForKind(
  kind: WeekReadinessApplyKind,
  ctx: { anchorDateISO: string; todayISO: string },
): ProgramControlAction {
  const { anchorDateISO, todayISO } = ctx;

  if (kind === 'sick_week') {
    return {
      type: 'set_illness_status',
      source: READINESS_SOURCE,
      scope: 'current_week',
      payload: { date: anchorDateISO, todayISO, severity: 'severe' },
      requiresRebuild: false,
      createsActiveModifier: true,
      oneOffOnly: false,
    };
  }

  if (kind === 'sniffle_today') {
    return {
      type: 'set_illness_status',
      source: READINESS_SOURCE,
      scope: 'today_only',
      payload: { date: todayISO, todayISO, severity: 'minor' },
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
