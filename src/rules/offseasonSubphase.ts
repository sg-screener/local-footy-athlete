import type { SeasonPhase } from '../types/domain';
import {
  resolveSeasonSubphaseAtPhaseWeek,
  type CanonicalOffseasonSubphase,
} from './seasonPhaseClock';

export type OffseasonSubphase = CanonicalOffseasonSubphase;

export interface OffseasonSubphaseContext {
  seasonPhase?: SeasonPhase | null;
  explicitSubphase?: OffseasonSubphase | null;
  /** 1-based week since the persisted Off-season entry Monday. */
  phaseWeekNumber?: number | null;
}

export function resolveOffseasonSubphase(
  context: OffseasonSubphaseContext,
): OffseasonSubphase | null {
  if (context.seasonPhase !== 'Off-season') return null;
  if (context.explicitSubphase) return context.explicitSubphase;

  const phaseWeekNumber = positiveInteger(context.phaseWeekNumber);
  if (phaseWeekNumber) {
    return resolveSeasonSubphaseAtPhaseWeek('Off-season', phaseWeekNumber) as OffseasonSubphase;
  }

  // Missing phase-clock context must choose the least aggressive policy.
  // Callers that want mid/late behaviour must provide explicit progression
  // state; otherwise a brand-new/post-season athlete could receive running,
  // hard conditioning or contrast work intended for later in the phase.
  return 'early_offseason';
}

function positiveInteger(value: number | null | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const n = Math.floor(Number(value));
  return n > 0 ? n : undefined;
}
