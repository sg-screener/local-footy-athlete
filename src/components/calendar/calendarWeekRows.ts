/**
 * SEVEN CELLS PER ROW, BY CONSTRUCTION.
 *
 * The month grid used to lay its cells out with `width: '14.2857…%'` under
 * `flexWrap`. Yoga stores that percentage as float32 and breaks a line on a
 * strict `>`, so on some container widths (any width ≡ 3, 5 or 6 mod 7 —
 * the onboarding grid's 362 pt among them) seven cells summed to a hair over
 * the row and the seventh wrapped: "Sun" on its own line and the dates flowing
 * six per row under the wrong weekday names (everyday acceptance F1,
 * 2026-09-09, iPhone 17 Pro simulator). Rows are now explicit: the layout
 * engine is never asked whether a seventh cell fits.
 */
export const CALENDAR_COLUMNS = 7;

export function calendarWeekRows<T>(cells: readonly T[]): (T | null)[][] {
  const rows: (T | null)[][] = [];
  for (let start = 0; start < cells.length; start += CALENDAR_COLUMNS) {
    const row: (T | null)[] = cells.slice(start, start + CALENDAR_COLUMNS);
    while (row.length < CALENDAR_COLUMNS) row.push(null);
    rows.push(row);
  }
  return rows;
}
