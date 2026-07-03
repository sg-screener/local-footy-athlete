/**
 * Local calendar-date helpers.
 *
 * Use these for athlete-facing YYYY-MM-DD keys. `toISOString().slice(0, 10)`
 * is UTC-based and can drift from the local day around timezone boundaries.
 */

export function formatLocalISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISOLocal(): string {
  return formatLocalISODate(new Date());
}

/**
 * Athlete-facing short calendar date, e.g. "3/7" (day/month, no padding,
 * AU order). Single owner of the d/m display rule — every surface that
 * shows a calendar date beside a weekday label formats it here, so the
 * app can never disagree with itself about date order or padding.
 */
export function shortDayMonthLabel(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * Weekday + short date, e.g. "Fri 3/7". For surfaces that don't already
 * render their own weekday label.
 */
export function shortWeekdayDateLabel(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);
  const weekday = d.toLocaleDateString('en-AU', { weekday: 'short' });
  return `${weekday} ${shortDayMonthLabel(dateISO)}`;
}
