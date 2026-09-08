/** Existing hard-conditioning categories, shared by progression and whole-day load. */
export type HardConditioningCategory = 'sprint' | 'vo2' | 'glycolytic' | 'repeat_sprint' | 'cod_decel';
export const HARD_CONDITIONING_CATEGORIES: ReadonlySet<HardConditioningCategory> =
  new Set<HardConditioningCategory>(['sprint', 'vo2', 'glycolytic', 'repeat_sprint', 'cod_decel']);
export function isHardConditioningCategory(category: string | null | undefined): boolean {
  return HARD_CONDITIONING_CATEGORIES.has(category as HardConditioningCategory);
}

/** Metabolic work has its own fixture rules; separately typed Speed keeps its policy. */
export function isHardMetabolicConditioningCategory(category: string | null | undefined): boolean {
  return isHardConditioningCategory(category) && category !== 'sprint' && category !== 'cod_decel';
}
