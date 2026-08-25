/**
 * CONDITIONING FEEDBACK EASE — R-232 (Sam, 2026-08-26: *"yes build it"*).
 *
 * Sam's want: *"i just want session feedback saved, monitored in progress
 * tab, and then that should effect future programming - for both strength
 * and conditioning."* His July ruling stands untouched underneath: the
 * 2026-07-27 retirement killed the layer that ADJUSTED conditioning doses
 * with invented numbers (Bible :4966 — caps "were never authored"), and
 * Section 6 says doses come from the authored templates. So feedback here
 * never edits a dose — it PICKS AMONG Sam's authored tiers:
 *
 *   Two rough sessions of a tier in the current block window → that tier is
 *   EASED: the resolver's preference ladder skips it when an authored easier
 *   tier is still legal for the day. Nothing is stored — the ease derives
 *   from the feedback each time (north star), so when the feedback stops
 *   saying "too much", the normal session simply returns. Every law that
 *   outranks this (game proximity, weekly caps, strength interaction,
 *   injuries) already filtered the eligible tiers BEFORE the ladder runs,
 *   so this can never override one.
 *
 * ROUGH means what Sam approved: high effort AND incomplete — *"came back
 * 'too much' (high effort + incomplete)"*. Effort ≥ 8 on his own 1-10 scale.
 *
 * THE WINDOW is the app's own block length (28 days), so a brutal fortnight
 * from last season cannot ease today's week. Not an invented dose number —
 * a recency bound on evidence.
 */

import type { ConditioningTier } from '../data/exerciseTags';

export const ROUGH_EFFORT_MINIMUM = 8;
export const EASE_EVIDENCE_WINDOW_DAYS = 28;
export const EASE_AFTER_ROUGH_COUNT = 2;

export interface ConditioningFeedbackEntry {
  /** ISO date of the logged session. */
  readonly date: string;
  /** The AUTHORED tier of the session that was logged. */
  readonly tier: ConditioningTier;
  /** The athlete's effort answer (1-10), however their form derived it. */
  readonly effort: number | null;
  /** True only when the session was completed in full. */
  readonly completedFully: boolean;
}

/** Sam's approved definition: high effort AND incomplete. */
export function roughConditioningEntry(entry: ConditioningFeedbackEntry): boolean {
  return (entry.effort ?? 0) >= ROUGH_EFFORT_MINIMUM && !entry.completedFully;
}

function withinWindow(entryDate: string, dateStr: string): boolean {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const cutoff = new Date(y, m - 1, d - EASE_EVIDENCE_WINDOW_DAYS, 12);
  const iso = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  return entryDate >= iso && entryDate < dateStr.slice(0, 10);
}

/**
 * The tiers whose LAST TWO logged sessions (inside the window, before the
 * day being planned) were both rough. The resolver's ladder skips these when
 * an authored easier tier is still legal for the day.
 */
export function easedConditioningTiers(args: {
  dateStr: string;
  entries: readonly ConditioningFeedbackEntry[];
}): ReadonlySet<ConditioningTier> {
  const byTier = new Map<ConditioningTier, ConditioningFeedbackEntry[]>();
  for (const entry of args.entries) {
    if (!withinWindow(entry.date, args.dateStr)) continue;
    const list = byTier.get(entry.tier) ?? [];
    list.push(entry);
    byTier.set(entry.tier, list);
  }
  const eased = new Set<ConditioningTier>();
  for (const [tier, list] of byTier) {
    const newestFirst = [...list].sort((a, b) => b.date.localeCompare(a.date));
    const lastTwo = newestFirst.slice(0, EASE_AFTER_ROUGH_COUNT);
    if (lastTwo.length === EASE_AFTER_ROUGH_COUNT && lastTwo.every(roughConditioningEntry)) {
      eased.add(tier);
    }
  }
  return eased;
}

/**
 * The athlete-facing WHY, shown on the eased session (coach-note line).
 * PROPOSED — awaiting Sam's approval; drafted 2026-08-26 as ordered
 * ("draft the wording and I'll approve").
 */
export const CONDITIONING_EASE_NOTE =
  'Eased back today — your last couple of conditioning sessions looked like a lot.';
