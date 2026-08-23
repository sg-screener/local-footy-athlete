/**
 * THE TYPE MENU AS DATA — what the Add/Swap sheet can actually offer.
 *
 * The sheet used to hold this vocabulary only as JSX: five MenuOption blocks,
 * each gated by its own `offers(...)` condition. That shape made
 * "findability" unassertable — the producer offered a chartered category
 * (`recovery`) that no row could reach, and every suite entered below the
 * screen, so the gap was found on Sam's phone (device pass 2026-08-05,
 * finding 3).
 *
 * This module is the render vocabulary's single owner. Each row names the
 * category ids whose offer makes it visible AND which its flow can reach;
 * the sheet derives row visibility from `reaches`, so a category the model
 * cannot reach is a category the sheet cannot silently drop — the
 * findability cell (`test:device-pass-2026-08-05`, finding-3) asserts
 * producer-offered ids ⊆ menu-reachable ids.
 *
 * Plain module, no React (L14): callable from any test with no screen.
 */

import type { PlanChangeCategoryId } from '../../utils/planChangeTypes';

export type PlanChangeTypeMenuRowId =
  | 'strength'
  | 'conditioning'
  | 'gunshow'
  | 'mobility'
  | 'recovery'
  | 'prehab'
  | 'primer';

export interface PlanChangeTypeMenuRow {
  /** Stable row identity; the sheet's testID is `plan-change-type-<id>`. */
  readonly id: PlanChangeTypeMenuRowId;
  /**
   * The category ids whose producer offer makes this row visible, and which
   * its flow can reach. Visibility and reachability are the SAME list on
   * purpose — a row that shows for categories it cannot reach, or reaches
   * categories it never shows for, is the divergence this model exists to
   * make unrepresentable.
   */
  readonly reaches: readonly PlanChangeCategoryId[];
}

/**
 * Row order is the sheet's render order. Ruling 9 named the five types the
 * menu offered; Sam's 2026-08-05 ruling (docs/DISPLAY_TIMES_RULING §1) added
 * the missing recovery CHOICE — the charter still forbids the app PLACING
 * recovery uninvited; this is the athlete's own door to choose it.
 */
export const PLAN_CHANGE_TYPE_MENU: readonly PlanChangeTypeMenuRow[] = [
  { id: 'strength', reaches: ['strength_upper', 'strength_lower', 'strength_full'] },
  { id: 'conditioning', reaches: ['conditioning_light', 'conditioning_hard'] },
  { id: 'gunshow', reaches: ['gunshow'] },
  // PRIMER sits directly under Gunshow — Sam, 2026-08-23, after seeing it on
  // glass: *"put primer below gunshow in the list"*. It landed last when it was
  // added, which put two optional gym sessions at opposite ends of the menu.
  { id: 'primer', reaches: ['primer'] },
  { id: 'mobility', reaches: ['mobility'] },
  { id: 'recovery', reaches: ['recovery'] },
  { id: 'prehab', reaches: ['prehab'] },
];

export function menuRowFor(id: PlanChangeTypeMenuRowId): PlanChangeTypeMenuRow {
  const row = PLAN_CHANGE_TYPE_MENU.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`plan-change type menu has no row '${id}'`);
  return row;
}

/** Every category id some menu row can reach. */
export function menuReachableCategoryIds(): ReadonlySet<PlanChangeCategoryId> {
  return new Set(PLAN_CHANGE_TYPE_MENU.flatMap((row) => [...row.reaches]));
}
