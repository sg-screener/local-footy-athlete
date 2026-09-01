import type { SeasonPhase } from '../types/domain';

/**
 * The 52-week Australian-football calendar used by the full-year audit.
 *
 * The audit starts on Monday 28 September 2026. Seven off-season weeks put the
 * first pre-season Monday on 16 November; nineteen pre-season weeks put the
 * first in-season Monday on 29 March. These functions drive the real profile
 * phase shifts in the audit, not only its printed headings.
 */
export const ANNUAL_FOOTBALL_PHASE_WEEKS = {
  'Off-season': 7,
  'Pre-season': 19,
  'In-season': 26,
} as const satisfies Record<SeasonPhase, number>;

export const PRE_SEASON_ANNUAL_INDEX = ANNUAL_FOOTBALL_PHASE_WEEKS['Off-season'];
export const IN_SEASON_ANNUAL_INDEX = PRE_SEASON_ANNUAL_INDEX
  + ANNUAL_FOOTBALL_PHASE_WEEKS['Pre-season'];

export function annualFootballPhaseForIndex(index: number): SeasonPhase {
  if (index < PRE_SEASON_ANNUAL_INDEX) return 'Off-season';
  if (index < IN_SEASON_ANNUAL_INDEX) return 'Pre-season';
  return 'In-season';
}

export function annualFootballPhaseWeek(index: number): number {
  if (index < PRE_SEASON_ANNUAL_INDEX) return index + 1;
  if (index < IN_SEASON_ANNUAL_INDEX) return index - PRE_SEASON_ANNUAL_INDEX + 1;
  return index - IN_SEASON_ANNUAL_INDEX + 1;
}
