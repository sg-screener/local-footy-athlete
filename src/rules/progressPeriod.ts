import type { CoachSnapshotLoad } from './liveAthleteSnapshot';
import type { ProgressMainLiftHistory } from './progressMainLiftStrength';

export type ProgressPeriod = '4w' | '12w' | 'year';
export interface ProgressDateRange {
  readonly startDateISO: string;
  readonly endDateISO: string;
}
export const PROGRESS_PERIODS: readonly { id: ProgressPeriod; label: string }[] = [
  { id: '4w', label: '4 weeks' },
  { id: '12w', label: '12 weeks' },
  { id: 'year', label: 'Year' },
];

function dateValue(dateISO: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return NaN;
  const value = Date.parse(`${dateISO}T00:00:00.000Z`);
  return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === dateISO
    ? value : NaN;
}

/** One date window for every Progress history reader, with no device-clock read. */
export function progressDateRange(period: ProgressPeriod, endDateISO: string): ProgressDateRange {
  const end = dateValue(endDateISO);
  if (!Number.isFinite(end)) throw new Error('Progress requires a valid end date');
  const start = new Date(end);
  if (period === 'year') {
    const year = start.getUTCFullYear() - 1;
    const month = start.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    start.setUTCFullYear(year, month, Math.min(start.getUTCDate(), lastDay));
    start.setUTCDate(start.getUTCDate() + 1);
  } else {
    const daysSinceMonday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - daysSinceMonday - (period === '4w' ? 3 : 11) * 7);
  }
  return { startDateISO: start.toISOString().slice(0, 10), endDateISO };
}

export function filterProgressPeriod<T>(
  values: readonly T[], range: ProgressDateRange, dateOf: (value: T) => string,
): T[] {
  return values.filter((value) => {
    const date = dateOf(value);
    return Number.isFinite(dateValue(date)) && date >= range.startDateISO && date <= range.endDateISO;
  });
}

/** Filter presentation only: preserve the live load status and every stored record. */
export function progressHistoryInRange(
  load: CoachSnapshotLoad,
  histories: readonly ProgressMainLiftHistory[],
  range: ProgressDateRange,
): { load: CoachSnapshotLoad; mainLiftEstimates: readonly ProgressMainLiftHistory[] } {
  return {
    load: { ...load, weeklyCompletedLoadAU: filterProgressPeriod(
      load.weeklyCompletedLoadAU, range, (point) => point.weekStart,
    ) },
    mainLiftEstimates: histories.map((history) => ({
      ...history,
      points: filterProgressPeriod(history.points, range, (point) => point.weekStart),
      series: history.series.map((series) => ({
        ...series,
        points: filterProgressPeriod(series.points, range, (point) => point.weekStart),
      })).filter((series) => series.points.length > 0),
    })),
  };
}

/** The chosen lookback is a maximum; never label time before the available history. */
export function progressAvailableDateRange(
  range: ProgressDateRange, dates: readonly string[],
): ProgressDateRange | null {
  const available = filterProgressPeriod(dates, range, date => date).sort();
  return available.length ? { startDateISO: available[0], endDateISO: range.endDateISO } : null;
}


export interface ProgressLoadComparison {
  readonly percentChange: number;
  readonly direction: 'up' | 'down' | 'flat';
  readonly baselineWeeks: number;
  readonly label: string;
}

/** Compare the displayed week to a complete selected baseline; missing weeks are not zero load. */
export function progressLoadComparison(
  history: readonly { weekStart: string; value: number }[],
  latest: { weekStart: string; value: number } | undefined,
  period: ProgressPeriod,
): ProgressLoadComparison | null {
  if (!latest || !Number.isFinite(latest.value) || latest.value < 0) return null;
  const latestDay = dateValue(latest.weekStart);
  if (!Number.isFinite(latestDay)) return null;
  const weekMs = 7 * 86400000;
  const lookbackWeeks = period === '4w' ? 4 : period === '12w' ? 12 : 52;
  const priorByWeek = new Map(history.filter(point => {
    const day = dateValue(point.weekStart);
    return Number.isFinite(day) && day >= latestDay - lookbackWeeks * weekMs && day < latestDay
      && Number.isFinite(point.value) && point.value >= 0;
  }).map(point => [point.weekStart, point]));
  const prior = [...priorByWeek.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  if (prior.length !== lookbackWeeks || !prior.every((point, index) =>
    dateValue(point.weekStart) === latestDay - (index + 1) * weekMs)) return null;
  const average = prior.reduce((sum, point) => sum + point.value, 0) / prior.length;
  if (average <= 0) return null;
  const percentChange = Math.round((latest.value / average - 1) * 100) || 0;
  return {
    percentChange,
    direction: percentChange > 0 ? 'up' : percentChange < 0 ? 'down' : 'flat',
    baselineWeeks: prior.length,
    label: period === 'year' ? 'vs. previous year' : `vs. previous ${lookbackWeeks} weeks`,
  };
}
