import type { SeasonPhase } from '../types/domain';

export type OffseasonSubphase =
  | 'early_offseason'
  | 'mid_offseason'
  | 'late_offseason';

export interface OffseasonSubphaseContext {
  seasonPhase?: SeasonPhase | null;
  explicitSubphase?: OffseasonSubphase | null;
  blockNumber?: number | null;
  miniCycleNumber?: number | null;
  weekInBlock?: number | null;
  weekNumber?: number | null;
}

export function resolveOffseasonSubphase(
  context: OffseasonSubphaseContext,
): OffseasonSubphase | null {
  if (context.seasonPhase !== 'Off-season') return null;
  if (context.explicitSubphase) return context.explicitSubphase;

  const weekInBlock = positiveInteger(context.weekInBlock);
  const blockNumber = positiveInteger(context.blockNumber) ?? positiveInteger(context.miniCycleNumber);
  const weekNumber = positiveInteger(context.weekNumber) ??
    (blockNumber && weekInBlock ? ((blockNumber - 1) * 4) + weekInBlock : undefined);

  if (weekNumber) {
    if (weekNumber <= 2) return 'early_offseason';
    if (weekNumber >= 4) return 'late_offseason';
    return 'mid_offseason';
  }

  if (weekInBlock) {
    if (weekInBlock <= 2) return 'early_offseason';
    if (weekInBlock >= 4) return 'late_offseason';
    return 'mid_offseason';
  }

  // Missing block/week context must choose the least aggressive policy.
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
