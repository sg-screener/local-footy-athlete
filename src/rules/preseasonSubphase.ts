import type { SeasonPhase } from '../types/domain';

export type PreseasonSubphase =
  | 'early_preseason'
  | 'mid_preseason'
  | 'late_preseason';

export interface PreseasonSubphaseContext {
  seasonPhase?: SeasonPhase | null;
  explicitSubphase?: PreseasonSubphase | null;
  weekInBlock?: number | null;
  weekNumber?: number | null;
}

/**
 * Resolve the phase inside each generated four-week pre-season block.
 * Explicit input is supported for deterministic simulations; product input
 * remains block/week state, so onboarding does not gain another question.
 */
export function resolvePreseasonSubphase(
  context: PreseasonSubphaseContext,
): PreseasonSubphase | null {
  if (context.seasonPhase !== 'Pre-season') return null;
  if (context.explicitSubphase) return context.explicitSubphase;

  const directWeek = positiveInteger(context.weekInBlock);
  const globalWeek = positiveInteger(context.weekNumber);
  const weekInBlock = directWeek ?? (globalWeek ? ((globalWeek - 1) % 4) + 1 : undefined);

  if (weekInBlock === 1) return 'early_preseason';
  if (weekInBlock === 2 || weekInBlock === 3) return 'mid_preseason';
  if (weekInBlock && weekInBlock >= 4) return 'late_preseason';
  return 'mid_preseason';
}

function positiveInteger(value: number | null | undefined): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const n = Math.floor(Number(value));
  return n > 0 ? n : undefined;
}
