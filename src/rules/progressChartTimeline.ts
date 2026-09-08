import { filterProgressPeriod, type ProgressDateRange } from './progressPeriod';

/** Pure layout for Progress charts whose horizontal axis is real time. */

export interface ProgressChartDatum {
  readonly dateISO: string;
  readonly value: number;
}

export interface ProgressChartPoint extends ProgressChartDatum {
  readonly x: number;
  readonly y: number;
}

export interface ProgressChartGeometry {
  readonly width: number;
  readonly height: number;
  readonly padding: number;
}

function isoDay(dateISO: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const value = Date.UTC(year, month - 1, day) / 86_400_000;
  const parsed = new Date(value * 86_400_000);
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    ? value
    : null;
}

/**
 * Position recorded values without converting a missing month into one step.
 * Invalid dates and non-finite values are absent rather than plotted at a
 * believable coordinate.
 */
export function buildProgressChartPoints(
  values: readonly ProgressChartDatum[],
  geometry: ProgressChartGeometry,
  higherIsBetter = true,
  range?: ProgressDateRange,
): readonly ProgressChartPoint[] {
  const dated = (range ? filterProgressPeriod(values, range, (value) => value.dateISO) : values)
    .map((value, index) => ({ ...value, day: isoDay(value.dateISO), index }))
    .filter((value): value is ProgressChartDatum & { day: number; index: number } =>
      value.day !== null && Number.isFinite(value.value))
    .sort((left, right) => (left.day - right.day) || (left.index - right.index));
  if (dated.length === 0) return [];

  const performance = dated.map((value) => higherIsBetter ? value.value : -value.value);
  const minPerformance = Math.min(...performance);
  const maxPerformance = Math.max(...performance);
  const performanceSpan = maxPerformance - minPerformance;
  const firstDay = dated[0].day;
  const lastDay = dated[dated.length - 1].day;
  const daySpan = lastDay - firstDay;
  const usableWidth = geometry.width - geometry.padding * 2;
  const usableHeight = geometry.height - geometry.padding * 2;

  return dated.map((value, index) => ({
    dateISO: value.dateISO,
    value: value.value,
    x: daySpan === 0
      ? geometry.width / 2
      : geometry.padding + ((value.day - firstDay) / daySpan) * usableWidth,
    y: performanceSpan === 0
      ? geometry.height / 2
      : geometry.padding
        + ((maxPerformance - performance[index]) / performanceSpan) * usableHeight,
  }));
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function shortDate(dateISO: string, includeYear: boolean): string | null {
  const dayNumber = isoDay(dateISO);
  if (dayNumber === null) return null;
  const date = new Date(dayNumber * 86_400_000);
  const value = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return includeYear ? `${value} ${date.getUTCFullYear()}` : value;
}

/** The visible receipt that makes a two-point long gap explicit too. */
export function progressChartDateRangeLabel(
  values: readonly Pick<ProgressChartDatum, 'dateISO'>[],
): string | null {
  const dates = values
    .map((value) => ({ dateISO: value.dateISO, day: isoDay(value.dateISO) }))
    .filter((value): value is { dateISO: string; day: number } => value.day !== null)
    .sort((left, right) => left.day - right.day);
  if (dates.length < 2 || dates[0].day === dates[dates.length - 1].day) return null;
  const firstYear = Number(dates[0].dateISO.slice(0, 4));
  const lastYear = Number(dates[dates.length - 1].dateISO.slice(0, 4));
  const includeYear = firstYear !== lastYear;
  const first = shortDate(dates[0].dateISO, includeYear);
  const last = shortDate(dates[dates.length - 1].dateISO, includeYear);
  return first && last ? `${first} – ${last}` : null;
}

/** One scale supplies both the lift line and its weight labels. */
export function progressLiftChartModel(values: readonly ProgressChartDatum[], geometry: ProgressChartGeometry, range: ProgressDateRange) {
  const recorded = buildProgressChartPoints(values, geometry, true, range);
  if (!recorded.length) return null;
  const minimum = Math.min(...recorded.map(point => point.value));
  const maximum = Math.max(...recorded.map(point => point.value));
  const roughStep = Math.max((maximum - minimum) / 2, 1);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 5, 10].map(value => value * magnitude).find(value => value >= roughStep)!;
  const lower = Math.max(0, Math.floor(minimum / step) * step - (minimum === maximum ? step : 0));
  const upper = Math.max(lower + step * 2, Math.ceil(maximum / step) * step);
  const y = (value: number) => geometry.padding + (upper - value) / (upper - lower) * (geometry.height - geometry.padding * 2);
  return {
    points: recorded.map(point => ({ ...point, y: y(point.value) })),
    ticks: [upper, (upper + lower) / 2, lower].map(value => ({ value, y: y(value) })),
    latest: recorded[recorded.length - 1].value,
    change: recorded.length > 1 ? Math.round((recorded[recorded.length - 1].value - recorded[0].value) * 10) / 10 : null,
    dates: [recorded[0].dateISO, recorded[recorded.length - 1].dateISO],
  };
}
