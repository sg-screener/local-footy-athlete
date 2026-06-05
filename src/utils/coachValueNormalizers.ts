export function parseCoachDurationMinutes(
  message: string,
  opts: { allowBareNumber?: boolean } = {},
): number | null {
  const cleaned = String(message ?? '').trim().toLowerCase();
  if (!cleaned) return null;

  if (/\b(?:an?|one)\s+hours?\b/i.test(cleaned) || /^(?:an?|one)?\s*hours?\s*[.!?]?$/.test(cleaned)) {
    return 60;
  }
  if (/\bhalf\s+an?\s+hours?\b/i.test(cleaned)) return 30;

  const clockMatch = /^\s*(\d{1,2}):(\d{2})\s*[.!?]?\s*$/.exec(cleaned);
  if (clockMatch) {
    return boundedMinutes(Number(clockMatch[1]) * 60 + Number(clockMatch[2]));
  }

  const hourMinuteMatch = /\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\s*(?:(\d{1,2})\s*(?:m|min|mins|minute|minutes)?)?\b/i.exec(cleaned);
  if (hourMinuteMatch) {
    const hours = Number(hourMinuteMatch[1]);
    const extraMinutes = hourMinuteMatch[2] ? Number(hourMinuteMatch[2]) : 0;
    if (!Number.isFinite(hours) || !Number.isFinite(extraMinutes) || hours <= 0) return null;
    return boundedMinutes(Math.round(hours * 60 + extraMinutes));
  }

  const minuteMatch = /\b(\d{1,3})\s*(?:m|min|mins|minute|minutes)\b/i.exec(cleaned);
  if (minuteMatch) return boundedMinutes(Number(minuteMatch[1]));

  const bareNumber = /\b(\d{1,3})\b/.exec(cleaned);
  if (bareNumber && (opts.allowBareNumber || hasDurationEditCue(cleaned))) {
    return boundedMinutes(Number(bareNumber[1]));
  }

  return null;
}

function boundedMinutes(value: number): number | null {
  if (!Number.isFinite(value) || value < 5 || value > 180) return null;
  return value;
}

function hasDurationEditCue(message: string): boolean {
  return /\b(?:make|set|change|adjust|duration|time|longer|shorter|hour|hours|mins?|minutes?|to|for)\b/i.test(message);
}
