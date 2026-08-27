import type { SeasonPhase, WeekKind } from '../types/domain';
import {
  resolveDeloadWeekPolicy,
  type DeloadWeekPolicy,
} from './deloadWeekRules';

/**
 * The phase clock's accepted answer for one scheduled deload week.
 *
 * This state says WHEN and WHICH week. `DeloadWeekPolicy` remains the single
 * owner of WHAT a deload does. Keeping the target Monday on the fact prevents
 * a week-four answer from leaking into a neighbouring week during a one-week
 * rebuild or rollover.
 */
export interface CanonicalWeeklyScheduledDeloadState {
  readonly kind: 'scheduled_deload';
  readonly id: string;
  readonly targetWeekStartISO: string;
  readonly source: 'season_phase_clock';
  readonly policy: DeloadWeekPolicy;
}

/** Translate the phase clock's typed week identity once at compiler ingress. */
export function canonicalWeeklyScheduledDeloadStateFrom(args: {
  readonly weekStartISO: string;
  readonly seasonPhase: SeasonPhase | null | undefined;
  readonly weekKind: WeekKind | null | undefined;
}): CanonicalWeeklyScheduledDeloadState | null {
  const policy = resolveDeloadWeekPolicy(args.seasonPhase, args.weekKind);
  if (!policy) return null;
  return {
    kind: 'scheduled_deload',
    id: `scheduled-deload:${args.weekStartISO}`,
    targetWeekStartISO: args.weekStartISO,
    source: 'season_phase_clock',
    policy,
  };
}

/** A scheduled fact can govern only the exact week named by its clock row. */
export function scheduledDeloadPolicyForWeek(
  state: CanonicalWeeklyScheduledDeloadState | null | undefined,
  weekStartISO: string,
): DeloadWeekPolicy | null {
  return state?.targetWeekStartISO === weekStartISO ? state.policy : null;
}
