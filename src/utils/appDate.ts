/**
 * Local calendar-date helpers.
 *
 * Use these for athlete-facing YYYY-MM-DD keys. `toISOString().slice(0, 10)`
 * is UTC-based and can drift from the local day around timezone boundaries.
 */

declare const __DEV__: boolean | undefined;

interface AppDateClockSnapshot {
  instant: Date;
  timezone: string;
}

interface AppDateGlobal {
  __LFA_DEV_E2E_CLOCK_RECEIPT__?: {
    anchorInstant: string;
    timezone: string;
  };
}

function runtimeIsDev(): boolean {
  if (typeof __DEV__ !== 'undefined') return __DEV__;
  return (globalThis as { __DEV__?: boolean }).__DEV__ === true;
}

function devE2EClockSnapshot(): AppDateClockSnapshot | null {
  if (!runtimeIsDev()) return null;
  // DevE2EClock is the only writer of this development-only receipt slot.
  // appDate does not import the clock module, keeping it out of the release
  // dependency graph entirely.
  const receipt =
    (globalThis as typeof globalThis & AppDateGlobal).__LFA_DEV_E2E_CLOCK_RECEIPT__;
  if (!receipt) return null;
  return {
    instant: new Date(receipt.anchorInstant),
    timezone: receipt.timezone,
  };
}

function formatISODateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function appDateNow(): Date {
  const clock = devE2EClockSnapshot();
  return clock ? new Date(clock.instant.getTime()) : new Date();
}

export function appDateTimezone(): string | null {
  return devE2EClockSnapshot()?.timezone ?? null;
}

export function formatLocalISODate(date?: Date): string {
  if (!date) {
    const clock = devE2EClockSnapshot();
    if (clock) return formatISODateInTimezone(clock.instant, clock.timezone);
  }
  const effectiveDate = date ?? new Date();
  const y = effectiveDate.getFullYear();
  const m = String(effectiveDate.getMonth() + 1).padStart(2, '0');
  const d = String(effectiveDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISOLocal(): string {
  return formatLocalISODate();
}

export function dayOfWeekForISODate(dateISO: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO.slice(0, 10));
  if (!match) throw new Error(`Invalid ISO date: ${dateISO}`);
  return new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  )).getUTCDay();
}

/**
 * The inverse of `dayOfWeekForISODate`: which date a weekday falls on in a week.
 *
 * ONE OWNER, because the Monday..Sunday convention is a rule and not an
 * expression. `dayOfWeek` is JS-style (Sunday 0), and the week runs Monday first,
 * so Sunday is six days after the Monday rather than one day before it — get that
 * backwards and a top-up lands in the previous week. There were already two
 * identical private copies of this (`generateProgram`, `temporarySourceFactTransaction`)
 * when a third consumer arrived; both now call here.
 */
export function isoDateForWeekday(weekStartISO: string, dayOfWeek: number): string {
  const date = new Date(`${weekStartISO.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return date.toISOString().slice(0, 10);
}

/**
 * Athlete-facing short calendar date, e.g. "3/7" (day/month, no padding,
 * AU order). Single owner of the d/m display rule — every surface that
 * shows a calendar date beside a weekday label formats it here, so the
 * app can never disagree with itself about date order or padding.
 */
export function shortDayMonthLabel(dateISO: string): string {
  const [, month, day] = dateISO.slice(0, 10).split('-').map(Number);
  return `${day}/${month}`;
}

/**
 * The calendar day alone, e.g. "3". For a week strip, where the month is
 * already established by the week label above it and seven "3/7"s would be
 * seven times the ink for one fact. Same single-owner rule as the label above:
 * no surface re-slices an ISO date for itself.
 */
export function dayOfMonthLabel(dateISO: string): string {
  return String(Number(dateISO.slice(8, 10)));
}

/**
 * THE SEVEN WEEKDAYS, IN FULL — batch 30, PROPOSED 2026-08-09.
 *
 * ONE TABLE OF FULL WORDS, WITH THE ABBREVIATIONS DERIVED. This is the C5
 * precedent from the journal signing (2026-08-09), where the twelve months were
 * about to be authored twice — once long, once short — and the second table is
 * where the two silently disagree. The three-letter forms below are exactly the
 * first three characters of these seven words, which is why the abbreviation is
 * a `slice` rather than a list, and why `coachTabSlice1Tests` proves the derived
 * seven are byte-identical to the seven this function shipped before today.
 *
 * Indexed JS-style (Sunday 0) to match `dayOfWeekForISODate`, which is the one
 * owner of that conversion.
 */
export const WEEKDAY_NAMES: readonly string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** The weekday a date falls on, named in full — "Saturday". */
export function weekdayName(dateISO: string): string {
  return WEEKDAY_NAMES[dayOfWeekForISODate(dateISO)];
}

/** The same weekday, abbreviated — "Sat". Derived, never a second table. */
export function shortWeekdayName(dateISO: string): string {
  return weekdayName(dateISO).slice(0, 3);
}

/**
 * Weekday + short date, e.g. "Fri 3/7". For surfaces that don't already
 * render their own weekday label.
 */
export function shortWeekdayDateLabel(dateISO: string): string {
  return `${shortWeekdayName(dateISO)} ${shortDayMonthLabel(dateISO)}`;
}
