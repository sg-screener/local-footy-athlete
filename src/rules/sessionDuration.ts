/**
 * One duration unit for every session feedback form — R-170.
 *
 * The stored domain value was already total minutes. This owner removes the
 * presentation-only hours/minutes split, so a 90-minute answer stays `90`
 * from input to transaction rather than being taken apart and rebuilt.
 */

export interface ParsedSessionDurationMinutes {
  readonly valid: boolean;
  readonly totalMinutes: number;
}

export function parseSessionDurationMinutes(
  value: string,
): ParsedSessionDurationMinutes {
  const trimmed = value.trim();
  const parsed = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  const valid = Number.isSafeInteger(parsed) && parsed > 0;
  return {
    valid,
    totalMinutes: valid ? parsed : 0,
  };
}
