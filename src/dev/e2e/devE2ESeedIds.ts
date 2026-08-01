export const DEV_E2E_SEED_IDS = [
  'standard-in-season-week',
  'spent-week-friday',
  'stacked-team-training-upper-pull',
  'lower-body-deletion',
  'one-set-strength',
  'fixture-move',
  'injury-case',
  'equipment-restriction-case',
  'feedback-progression-case',
  'multi-reload-fixture-chain',
  'coach-production-replay',
] as const;

export type DevE2ESeedId = (typeof DEV_E2E_SEED_IDS)[number];

/**
 * The seed's "today" — the instant the DevE2EClock is pinned to.
 *
 * This is NOT necessarily the week start. Every seed before
 * `spent-week-friday` anchored on a Monday, which let "today" and "the visible
 * week's Monday" be the same value; that conflation is exactly why no seed
 * ever covered a partly-spent week (Sam's device state, 2026-07-24). Week-
 * relative arithmetic must go through `devE2EWeekStartForSeed`, never through
 * this map directly.
 */
export const DEV_E2E_DATE_ANCHORS: Record<DevE2ESeedId, string> = {
  'standard-in-season-week': '2026-07-13',
  // Friday of a week already three-quarters spent — see the registry.
  'spent-week-friday': '2026-07-24',
  'stacked-team-training-upper-pull': '2026-07-13',
  'lower-body-deletion': '2026-07-13',
  'one-set-strength': '2026-07-13',
  'fixture-move': '2026-07-13',
  'injury-case': '2026-07-13',
  'equipment-restriction-case': '2026-07-13',
  'feedback-progression-case': '2026-07-13',
  'multi-reload-fixture-chain': '2026-07-13',
  'coach-production-replay': '2026-07-13',
};

export function isDevE2ESeedId(value: string): value is DevE2ESeedId {
  return DEV_E2E_SEED_IDS.includes(value as DevE2ESeedId);
}

/**
 * The Monday of the week the seed's anchor ("today") falls in — the single
 * owner of every week-relative seed date. Timezone-independent by
 * construction: parsed at UTC noon, so no local-midnight boundary can shift
 * the weekday.
 */
export function devE2EWeekStartForSeed(seedId: DevE2ESeedId): string {
  const anchor = DEV_E2E_DATE_ANCHORS[seedId];
  const date = new Date(`${anchor}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
