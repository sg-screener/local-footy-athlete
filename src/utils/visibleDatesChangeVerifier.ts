import type { ResolvedDay } from './sessionResolver';
import {
  semanticFingerprint,
  snapshotSemanticResolvedDay,
} from './programSemanticSnapshot';

export interface VisibleDatesChangeVerification {
  ok: boolean;
  unchangedDates: string[];
  missingDates: string[];
}

/** Confirm that every claimed date changed in the athlete-visible projection. */
export function verifyVisibleDatesChanged(args: {
  before: readonly ResolvedDay[];
  after: readonly ResolvedDay[];
  dates: readonly string[];
}): VisibleDatesChangeVerification {
  const unchangedDates: string[] = [];
  const missingDates: string[] = [];

  for (const date of Array.from(new Set(args.dates))) {
    const beforeDay = args.before.find((day) => day.date === date);
    const afterDay = args.after.find((day) => day.date === date);
    if (!afterDay) {
      missingDates.push(date);
      continue;
    }
    if (!beforeDay) continue;
    if (
      semanticFingerprint(snapshotSemanticResolvedDay(beforeDay)) ===
      semanticFingerprint(snapshotSemanticResolvedDay(afterDay))
    ) {
      unchangedDates.push(date);
    }
  }

  return {
    ok: unchangedDates.length === 0 && missingDates.length === 0,
    unchangedDates,
    missingDates,
  };
}
