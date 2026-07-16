/** Convert a persisted/domain identity into a stable native-test token. */
export function stableTestIdToken(value: string | number | null | undefined): string {
  const token = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return token || 'unknown';
}

const DAY_OF_WEEK_TEST_TOKENS = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
] as const;

/** Native-test identity derived from the schedule domain, never display copy. */
export function dayOfWeekTestIdToken(dayOfWeek: number): string {
  return DAY_OF_WEEK_TEST_TOKENS[dayOfWeek] ?? 'unknown';
}
