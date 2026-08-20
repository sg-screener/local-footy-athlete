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
  'christmas-break-ask',
  // ── SANCTIONED 2026-08-19 FOR THE REMOVE SLICE'S RESTART PROOF ──
  // The restart proof needs a world the one-week seeds structurally cannot
  // reach: FOUR production-generated microcycles, so the requirement boot
  // derives for the accepted block matches the one the seed installs. The two
  // existing four-week candidates both refuse — their Sunday
  // `visible_card_detail_equality` witness hand-builds an expected workout id
  // the generator no longer produces. This seed exists so neither of them has
  // to be altered.
  'exercise-removal-restart',
  /* ── DEV-ONLY, FOR THE R-116 LAYOUT EVIDENCE (Sam, 2026-08-20) ─────────────
   * A session-layout showcase: TODAY carries Conditioning, Team Training and a
   * genuinely long authored exercise name, so the three remaining screenshots
   * can be taken without touching production programming or exercise content.
   * Every component it shows is real — the conditioning block and the team
   * commitment are lifted from days the SAME generated week already produced,
   * and the long name is `Half-Kneeling Single-Arm Overhead Press`, 39
   * characters and already in the authored pool. Nothing is invented. */
  'session-layout-showcase',
  /* ── DEV-ONLY, THE CONDITIONING HALF OF THE SAME EVIDENCE ─────────────────
   * Sam, 2026-08-20: *"Select a real authored conditioning template and pass it
   * through the canonical production materialisation/projection path into a
   * dev-only accepted week."* This seed answers onboarding as a PRE-SEASON
   * full-gym athlete — the world the real generator does place conditioning in —
   * and then does nothing else. The template, its name, its dose and its
   * section all arrive through production code. */
  'conditioning-showcase',
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
  // ── THE ONLY SEED NOT IN JULY, AND THAT IS ITS WHOLE POINT ──
  // The Christmas-break ask is DATE-GATED (SEAT_INBOX item 31 part 5, Sam:
  // *"maybe around the 10th of December"*), so its four screen cells are
  // SOURCE-PINNED and no device has ever rendered them. The DevE2EClock pins
  // `todayISOLocal()` (`appDate.ts:63-77` reads `devE2EClockSnapshot()` before
  // the wall clock), so anchoring a seed on the 10th is the ONLY way to put a
  // simulator inside the window. **10 December 2026 is Sam's own date.**
  'christmas-break-ask': '2026-12-10',
  // Same July anchor as every other in-season seed: the Remove slice's scopes
  // ("today", "this block") are read against it, and reusing it keeps this
  // seed's world comparable to `standard-in-season-week`'s.
  'exercise-removal-restart': '2026-07-13',
  'session-layout-showcase': '2026-07-13',
  'conditioning-showcase': '2026-07-13',
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
