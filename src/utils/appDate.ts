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
