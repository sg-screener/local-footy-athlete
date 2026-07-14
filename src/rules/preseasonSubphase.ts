import type { SeasonPhase } from '../types/domain';
import {
  resolveSeasonSubphaseAtPhaseWeek,
  type CanonicalPreseasonSubphase,
} from './seasonPhaseClock';

export type PreseasonSubphase = CanonicalPreseasonSubphase;

export interface PreseasonSubphaseContext {
  seasonPhase?: SeasonPhase | null;
  explicitSubphase?: PreseasonSubphase | null;
  /** 1-based week since the persisted Pre-season entry Monday. */
  phaseWeekNumber?: number | null;
}

/**
 * Resolve continuous Pre-season age. Explicit input remains available for
 * deterministic simulations; production uses the persisted phase clock.
 */
export function resolvePreseasonSubphase(
  context: PreseasonSubphaseContext,
): PreseasonSubphase | null {
  if (context.seasonPhase !== 'Pre-season') return null;
  if (context.explicitSubphase) return context.explicitSubphase;

  const phaseWeekNumber = positiveInteger(context.phaseWeekNumber);
  if (phaseWeekNumber) {
    return resolveSeasonSubphaseAtPhaseWeek('Pre-season', phaseWeekNumber) as PreseasonSubphase;
  }
  return 'mid_preseason';
}

function positiveInteger(value: number | null | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const n = Math.floor(Number(value));
  return n > 0 ? n : undefined;
}
